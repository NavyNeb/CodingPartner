---
id: prod-resilience
track: prod
title: Case study: the feed that lied
summary: Sockets die silently, reconnects stampede the server, and messages arrive out of order. Build a reconnecting client, gap detection, and an honest staleness indicator.
---

> **INCIDENT — 21:40, Champions League night.** Two things go wrong within ten minutes.
>
> **(1)** A load-balancer deploy drops 80 000 WebSocket connections at once. Every client reconnects **immediately**, in lock-step, then again after 1 second, then again… The API tier is knocked over by its own clients. Recovery takes 25 minutes.
>
> **(2)** Meanwhile, users on trains report prices that "don't move" — the app looks fine, but the odds are 40 seconds old and bets are being rejected. The socket is **half-open**: the OS never told the browser the link died, so there was no `close` event to react to.

## Failure modes you must design for

1. **Clean disconnects** — server restarts, deploys, idle timeouts. You get a `close` event.
2. **Silent failure (half-open TCP)** — Wi-Fi/cell handover, sleeping laptops, NAT timeouts. **No event at all.** The only defence is *your own liveness check*: expect a message or heartbeat within N seconds, otherwise tear it down and reconnect.
3. **Thundering herd** — synchronised retries. Fixed delays make it worse.
4. **Lost state on reconnect** — a new socket has no subscriptions; the server has forgotten you.
5. **Gaps and reordering** — messages lost across the reconnect window, or delivered out of order by a relay.
6. **Lying UI** — showing stale data as if it were live.

## Backoff with jitter

Retry delay grows exponentially so a struggling server gets breathing room, and is **randomised** so clients spread out. "Full jitter":

```
delay = random() × min(maxDelay, baseDelay × 2^attempt)
```

Reset `attempt` to 0 once a connection has actually been established. Give up (or slow to a long fixed interval) after a maximum, and surface that to the user. Make `random` injectable so tests are deterministic.

## Reconnecting properly

On every (re)connect: **resubscribe** to all active topics, **flush** the outgoing queue (with a cap — an unbounded queue is a memory leak while offline), and ignore events from **stale sockets** (an old socket's late `close` must not kill the new one). Distinguish **manual close** from failure so `close()` doesn't trigger a reconnect.

## Snapshots + deltas + sequence numbers

The standard recipe for live data: fetch a **snapshot** (state at sequence *N*), then apply **deltas** with `seq = N+1, N+2, …`.

- `seq <= last` → duplicate or old: **drop**.
- `seq === last + 1` → apply.
- `seq > last + 1` → **gap**: buffer it, ask for a fresh snapshot (or the missing range), then apply buffered messages that follow the snapshot.

This gives you at-least-once delivery *and* correctness, and it's how order books, collaborative editors, and chat sync work.

## Tell the truth in the UI

Show connection state (`live`, `delayed`, `offline`) and *disable or annotate* actions that depend on fresh data ("Prices delayed — bets paused"). Compute it from **time since the last message**, using timers scheduled for the exact next threshold — not a 1-second polling loop that keeps waking a background tab.

## Other things to mention in an interview

- `navigator.onLine` only tells you about the *network interface*, not the internet — don't trust it alone. Use it as a hint to retry sooner.
- Pause reconnect attempts while the tab is hidden; resume on `visibilitychange`.
- Have a **fallback transport** (SSE or long-polling) for networks that block WebSockets.
- Server-side: rate-limit reconnects, use **connection draining** during deploys, spread restarts.

%% exercise prod-reconnecting-socket | Reconnecting socket | 4 | js | js | createReconnectingSocket | 45
Build `createReconnectingSocket(options)` around a WebSocket-like object.

Options: `createSocket()` (returns a socket with `addEventListener`, `send`, `close`, `readyState`), `onMessage(data)`, `onStatus(status)`, `baseDelayMs = 500`, `maxDelayMs = 30000`, `maxAttempts = Infinity`, `heartbeatTimeoutMs = 0` (disabled), `maxQueue = 100`, `random = Math.random`.

Returns `{ send(data), subscribe(topic), close(), get status }`.

**Status** is one of `connecting` (first connection attempt), `open`, `reconnecting`, `closed` (you called `close()`), `failed` (gave up). `onStatus` fires only when the status *changes*.

- Connect immediately. On `open`: status `open`, reset the attempt counter, **resubscribe** every active topic by sending `JSON.stringify({ action: 'subscribe', topic })`, then flush queued sends (in order).
- `send(data)`: sends if open, otherwise **queues** it (keep at most `maxQueue`, dropping the oldest). After `close()`, sends are ignored.
- `subscribe(topic)` remembers the topic (and sends the subscribe frame if open). It returns an unsubscribe function that forgets the topic (and sends `{"action":"unsubscribe","topic":…}` if open).
- Incoming messages call `onMessage(event.data)`.
- **Unexpected close:** status `reconnecting`; schedule a reconnect after `random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt)` ms, then `attempt++`. If `attempt` has reached `maxAttempts`, set status `failed` instead and stop.
- **Heartbeat:** if `heartbeatTimeoutMs > 0`, expect a message within that time after opening (and after each message). On timeout, drop the socket **without waiting for its `close` event**, call `close()` on it, and reconnect as above.
- Events from a socket that is no longer current are ignored.
- `close()` cancels every timer, closes the socket and never reconnects.

%% starter
```js
export function createReconnectingSocket({
  createSocket,
  onMessage = () => {},
  onStatus = () => {},
  baseDelayMs = 500,
  maxDelayMs = 30000,
  maxAttempts = Infinity,
  heartbeatTimeoutMs = 0,
  maxQueue = 100,
  random = Math.random,
}) {
  // your code
}
```

%% tests
```js
function setup(options = {}) {
  jest.useFakeTimers();
  const sockets = [];
  const statuses = [];
  const messages = [];
  const client = createReconnectingSocket({
    createSocket: () => { const s = createFakeSocket('wss://feed'); sockets.push(s); return s; },
    onMessage: (d) => messages.push(d),
    onStatus: (s) => statuses.push(s),
    random: () => 1,
    ...options,
  });
  return { client, sockets, statuses, messages };
}
const last = (a) => a[a.length - 1];

describe('createReconnectingSocket — connecting', () => {
  it('connects immediately and reports statuses', () => {
    const { client, sockets, statuses } = setup();
    expect(sockets).toHaveLength(1);
    expect(client.status).toBe('connecting');
    sockets[0].open();
    expect(client.status).toBe('open');
    expect(statuses).toEqual(['connecting', 'open']);
  });

  it('delivers incoming messages', () => {
    const { sockets, messages } = setup();
    sockets[0].open();
    sockets[0].receive({ a: 1 });
    sockets[0].receive('plain');
    expect(messages).toEqual(['{"a":1}', 'plain']);
  });

  it('queues sends until open and flushes them in order', () => {
    const { client, sockets } = setup();
    client.send('one');
    client.send('two');
    expect(sockets[0].sent).toEqual([]);
    sockets[0].open();
    expect(sockets[0].sent).toEqual(['one', 'two']);
    client.send('three');
    expect(sockets[0].sent).toEqual(['one', 'two', 'three']);
  });

  it('caps the offline queue, dropping the oldest', () => {
    const { client, sockets } = setup({ maxQueue: 3 });
    ['a', 'b', 'c', 'd', 'e'].forEach((m) => client.send(m));
    sockets[0].open();
    expect(sockets[0].sent).toEqual(['c', 'd', 'e']);
  });

  it('subscribes immediately when open and remembers topics', () => {
    const { client, sockets } = setup();
    sockets[0].open();
    client.subscribe('market:1');
    expect(sockets[0].sent).toEqual([JSON.stringify({ action: 'subscribe', topic: 'market:1' })]);
  });

  it('sends subscribe frames before queued messages once open', () => {
    const { client, sockets } = setup();
    client.subscribe('t1');
    client.send('hello');
    sockets[0].open();
    expect(sockets[0].sent).toEqual([JSON.stringify({ action: 'subscribe', topic: 't1' }), 'hello']);
  });

  it('unsubscribe forgets the topic', () => {
    const { client, sockets } = setup();
    sockets[0].open();
    const off = client.subscribe('t1');
    off();
    expect(last(sockets[0].sent)).toBe(JSON.stringify({ action: 'unsubscribe', topic: 't1' }));
    sockets[0].drop();
    jest.advanceTimersByTime(500);
    sockets[1].open();
    expect(sockets[1].sent).toEqual([]);
  });
});

describe('createReconnectingSocket — reconnecting', () => {
  it('reconnects after an unexpected close using exponential backoff', () => {
    const { sockets, statuses } = setup();
    sockets[0].open();
    sockets[0].drop();
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting']);
    jest.advanceTimersByTime(499);
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
    sockets[1].drop(); // never opened: attempt counter keeps growing → 1000 ms
    jest.advanceTimersByTime(999);
    expect(sockets).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2].drop(); // 2000 ms
    jest.advanceTimersByTime(1999);
    expect(sockets).toHaveLength(3);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(4);
  });

  it('caps the delay at maxDelayMs', () => {
    const { sockets } = setup({ baseDelayMs: 1000, maxDelayMs: 3000 });
    for (let i = 0; i < 5; i++) {
      sockets[sockets.length - 1].drop();
      jest.advanceTimersByTime(3000);
    }
    const before = sockets.length;
    sockets[before - 1].drop();
    jest.advanceTimersByTime(2999);
    expect(sockets).toHaveLength(before);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(before + 1);
  });

  it('applies jitter', () => {
    const { sockets } = setup({ random: () => 0.5 });
    sockets[0].drop();
    jest.advanceTimersByTime(249);
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('resets the attempt counter once a connection opens', () => {
    const { sockets } = setup();
    sockets[0].drop(); jest.advanceTimersByTime(500);
    sockets[1].drop(); jest.advanceTimersByTime(1000);
    sockets[2].open();
    sockets[2].drop();
    jest.advanceTimersByTime(499);
    expect(sockets).toHaveLength(3);
    jest.advanceTimersByTime(1);
    expect(sockets).toHaveLength(4);
  });

  it('resubscribes and flushes queued messages after reconnecting', () => {
    const { client, sockets, statuses } = setup();
    sockets[0].open();
    client.subscribe('a');
    client.subscribe('b');
    sockets[0].drop();
    client.send('while-down');
    jest.advanceTimersByTime(500);
    sockets[1].open();
    expect(last(statuses)).toBe('open');
    expect(sockets[1].sent).toEqual([
      JSON.stringify({ action: 'subscribe', topic: 'a' }),
      JSON.stringify({ action: 'subscribe', topic: 'b' }),
      'while-down',
    ]);
  });

  it('gives up after maxAttempts', () => {
    const { client, sockets, statuses } = setup({ maxAttempts: 2 });
    sockets[0].drop(); jest.advanceTimersByTime(500);
    sockets[1].drop(); jest.advanceTimersByTime(1000);
    sockets[2].drop();
    expect(client.status).toBe('failed');
    expect(last(statuses)).toBe('failed');
    jest.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(3);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores late events from an old socket', () => {
    const { client, sockets } = setup();
    sockets[0].open();
    sockets[0].drop();
    jest.advanceTimersByTime(500);
    sockets[1].open();
    sockets[0].drop();
    sockets[0].receive('ghost');
    expect(client.status).toBe('open');
    jest.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(2);
  });
});

describe('createReconnectingSocket — heartbeat & close', () => {
  it('reconnects when the feed goes silent, without waiting for a close event', () => {
    const { sockets, statuses } = setup({ heartbeatTimeoutMs: 5000 });
    sockets[0].open();
    jest.advanceTimersByTime(4999);
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(statuses).toContain('reconnecting');
    expect(sockets[0].readyState).toBe(3);
    jest.advanceTimersByTime(500);
    expect(sockets).toHaveLength(2);
  });

  it('every message pushes the heartbeat deadline back', () => {
    const { sockets } = setup({ heartbeatTimeoutMs: 5000 });
    sockets[0].open();
    jest.advanceTimersByTime(4000); sockets[0].receive('tick');
    jest.advanceTimersByTime(4000); sockets[0].receive('tick');
    jest.advanceTimersByTime(4000);
    expect(sockets).toHaveLength(1);
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(500);
    expect(sockets).toHaveLength(2);
  });

  it('close() stops everything and never reconnects', () => {
    const { client, sockets, statuses } = setup({ heartbeatTimeoutMs: 5000 });
    sockets[0].open();
    client.close();
    expect(client.status).toBe('closed');
    expect(last(statuses)).toBe('closed');
    expect(sockets[0].readyState).toBe(3);
    jest.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('close() while a reconnect is pending cancels it', () => {
    const { client, sockets } = setup();
    sockets[0].drop();
    client.close();
    jest.advanceTimersByTime(100000);
    expect(sockets).toHaveLength(1);
  });

  it('sends after close() are ignored', () => {
    const { client, sockets } = setup();
    sockets[0].open();
    client.close();
    expect(() => client.send('late')).not.toThrow();
    expect(sockets[0].sent).toEqual([]);
  });

  it('onStatus only fires on changes', () => {
    const { sockets, statuses } = setup();
    sockets[0].drop(); jest.advanceTimersByTime(500);
    sockets[1].drop(); jest.advanceTimersByTime(1000);
    expect(statuses).toEqual(['connecting', 'reconnecting']);
  });
});
```

%% hints
- State: `socket`, `status`, `attempt`, `reconnectTimer`, `heartbeatTimer`, `manuallyClosed`, `topics` (a `Set`) and `queue`.
- One function `connect()` creates the socket and attaches listeners that all start with `if (socket !== s) return;` — that's the stale-socket guard.
- One function `handleDown()` that computes the jittered delay, bumps `attempt`, sets status, and schedules `connect`. Call it from both the `close` listener and the heartbeat expiry.
- On heartbeat expiry: set `socket = null` **before** calling `dead.close()`, so the `close` event the fake emits is ignored as stale.
- Reset `attempt = 0` only in the `open` handler.
- Flush order on open: subscribe frames first, then the queue.

%% solution
```js
export function createReconnectingSocket({
  createSocket,
  onMessage = () => {},
  onStatus = () => {},
  baseDelayMs = 500,
  maxDelayMs = 30000,
  maxAttempts = Infinity,
  heartbeatTimeoutMs = 0,
  maxQueue = 100,
  random = Math.random,
}) {
  let socket = null;
  let status = null;
  let attempt = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  let manuallyClosed = false;
  const topics = new Set();
  let queue = [];

  const setStatus = (next) => {
    if (status === next) return;
    status = next;
    onStatus(next);
  };

  const isOpen = () => socket !== null && socket.readyState === 1;
  const frame = (action, topic) => JSON.stringify({ action, topic });

  function armHeartbeat() {
    if (!heartbeatTimeoutMs) return;
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      const dead = socket;
      socket = null;
      try {
        dead?.close();
      } catch {
        /* best effort */
      }
      handleDown();
    }, heartbeatTimeoutMs);
  }

  function handleDown() {
    clearTimeout(heartbeatTimer);
    if (manuallyClosed) return;
    if (attempt >= maxAttempts) {
      setStatus('failed');
      return;
    }
    setStatus('reconnecting');
    const delay = random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
    attempt++;
    reconnectTimer = setTimeout(connect, delay);
  }

  function connect() {
    reconnectTimer = null;
    if (manuallyClosed) return;
    const s = createSocket();
    socket = s;
    if (status === null) setStatus('connecting');

    s.addEventListener('open', () => {
      if (socket !== s) return;
      attempt = 0;
      setStatus('open');
      topics.forEach((t) => s.send(frame('subscribe', t)));
      const pending = queue;
      queue = [];
      pending.forEach((d) => s.send(d));
      armHeartbeat();
    });
    s.addEventListener('message', (e) => {
      if (socket !== s) return;
      armHeartbeat();
      onMessage(e.data);
    });
    s.addEventListener('close', () => {
      if (socket !== s) return;
      socket = null;
      handleDown();
    });
  }

  connect();

  return {
    send(data) {
      if (manuallyClosed) return;
      if (isOpen()) socket.send(data);
      else {
        queue.push(data);
        if (queue.length > maxQueue) queue.shift();
      }
    },
    subscribe(topic) {
      topics.add(topic);
      if (isOpen()) socket.send(frame('subscribe', topic));
      return () => {
        topics.delete(topic);
        if (isOpen()) socket.send(frame('unsubscribe', topic));
      };
    },
    close() {
      manuallyClosed = true;
      clearTimeout(reconnectTimer);
      clearTimeout(heartbeatTimer);
      const s = socket;
      socket = null;
      s?.close();
      setStatus('closed');
    },
    get status() {
      return status;
    },
  };
}
```

%% exercise prod-sequenced-feed | Gap detection with sequence numbers | 3 | js | js | createSequencedFeed | 30
Messages on a delta feed carry a `seq` number. Write `createSequencedFeed({ onMessage, onGap })` returning `{ push(msg), resync(seq), get lastSeq, get pending }`.

- The **first** message ever received establishes the baseline: it is delivered and sets `lastSeq`.
- After that, for a message with `seq`:
  - `seq <= lastSeq` → **drop** (duplicate/old).
  - `seq === lastSeq + 1` → deliver it, update `lastSeq`, then deliver any **buffered** messages that now follow consecutively.
  - `seq > lastSeq + 1` → a **gap**. **Buffer** the message. Call `onGap({ from: lastSeq + 1, to: seq - 1 })` **once** when the gap is first detected (further out-of-order messages while the same gap is open must not call it again).
- `resync(seq)` is called after fetching a snapshot that reflects everything up to `seq`: set `lastSeq = seq`, discard buffered messages with `seq <=` that, deliver the buffered ones that now follow consecutively. If a gap still remains afterwards, call `onGap` again for it.
- `pending` is the number of buffered messages.

%% starter
```js
export function createSequencedFeed({ onMessage, onGap }) {
  // your code
}
```

%% tests
```js
function setup() {
  const delivered = [];
  const gaps = [];
  const feed = createSequencedFeed({ onMessage: (m) => delivered.push(m.seq), onGap: (g) => gaps.push(g) });
  return { feed, delivered, gaps };
}
const m = (seq) => ({ seq, price: seq * 10 });

describe('createSequencedFeed', () => {
  it('delivers in-order messages and the first message sets the baseline', () => {
    const { feed, delivered } = setup();
    feed.push(m(100));
    feed.push(m(101));
    feed.push(m(102));
    expect(delivered).toEqual([100, 101, 102]);
    expect(feed.lastSeq).toBe(102);
  });

  it('passes the message object through unchanged', () => {
    const got = [];
    const feed = createSequencedFeed({ onMessage: (x) => got.push(x), onGap: () => {} });
    const msg = { seq: 1, price: 2.5 };
    feed.push(msg);
    expect(got[0]).toBe(msg);
  });

  it('drops duplicates and stale messages', () => {
    const { feed, delivered, gaps } = setup();
    feed.push(m(5)); feed.push(m(6)); feed.push(m(6)); feed.push(m(3)); feed.push(m(5));
    expect(delivered).toEqual([5, 6]);
    expect(gaps).toEqual([]);
  });

  it('buffers out-of-order messages and reports the gap once', () => {
    const { feed, delivered, gaps } = setup();
    feed.push(m(1));
    feed.push(m(4));
    feed.push(m(5));
    expect(delivered).toEqual([1]);
    expect(gaps).toEqual([{ from: 2, to: 3 }]);
    expect(feed.pending).toBe(2);
  });

  it('fills the gap when the missing messages arrive, flushing the buffer in order', () => {
    const { feed, delivered } = setup();
    feed.push(m(1)); feed.push(m(4)); feed.push(m(3)); feed.push(m(2));
    expect(delivered).toEqual([1, 2, 3, 4]);
    expect(feed.lastSeq).toBe(4);
    expect(feed.pending).toBe(0);
  });

  it('does not report the same gap again while it is open', () => {
    const { feed, gaps } = setup();
    feed.push(m(1)); feed.push(m(5)); feed.push(m(7)); feed.push(m(6));
    expect(gaps).toHaveLength(1);
  });

  it('resync() jumps to the snapshot and flushes what follows', () => {
    const { feed, delivered, gaps } = setup();
    feed.push(m(1));
    feed.push(m(10));
    feed.push(m(11));
    feed.push(m(12));
    expect(gaps).toEqual([{ from: 2, to: 9 }]);
    feed.resync(9);
    expect(delivered).toEqual([1, 10, 11, 12]);
    expect(feed.lastSeq).toBe(12);
    expect(feed.pending).toBe(0);
  });

  it('resync() discards buffered messages the snapshot already covers', () => {
    const { feed, delivered } = setup();
    feed.push(m(1)); feed.push(m(5)); feed.push(m(6)); feed.push(m(9));
    feed.resync(6);
    expect(delivered).toEqual([1]);
    expect(feed.lastSeq).toBe(6);
    expect(feed.pending).toBe(1);
  });

  it('reports a new gap if one remains after resync', () => {
    const { feed, delivered, gaps } = setup();
    feed.push(m(1)); feed.push(m(5)); feed.push(m(9));
    feed.resync(4);
    expect(delivered).toEqual([1, 5]);
    expect(gaps).toEqual([{ from: 2, to: 4 }, { from: 6, to: 8 }]);
  });

  it('works after a resync with no buffer', () => {
    const { feed, delivered } = setup();
    feed.push(m(1));
    feed.resync(50);
    feed.push(m(51));
    feed.push(m(50));
    expect(delivered).toEqual([1, 51]);
  });

  it('can report a fresh gap after the previous one was resolved', () => {
    const { feed, gaps } = setup();
    feed.push(m(1)); feed.push(m(3)); feed.push(m(2));
    feed.push(m(6));
    expect(gaps).toEqual([{ from: 2, to: 2 }, { from: 4, to: 5 }]);
  });

  it('starts with lastSeq undefined-ish and pending 0', () => {
    const { feed } = setup();
    expect(feed.pending).toBe(0);
    expect(feed.lastSeq == null).toBe(true);
  });
});
```

%% hints
- State: `last` (number or `null` before the first message), `buffer` (a `Map<seq, msg>`), and `gapOpen` (boolean).
- A `drain()` helper: `while (buffer.has(last + 1)) { deliver(buffer.get(last + 1)); buffer.delete(last + 1); last++; }`.
- After draining, if the buffer is empty the gap is closed; if it still holds messages there is a *remaining* gap — but only *report* it from `resync`, or from `push` when it is a brand-new gap.
- `resync(seq)`: set `last = seq`; delete buffered keys `<= seq`; `drain()`; if `buffer.size > 0` report the gap `{ from: last + 1, to: min(buffer keys) - 1 }`.

%% solution
```js
export function createSequencedFeed({ onMessage, onGap }) {
  let last = null;
  const buffer = new Map();
  let gapOpen = false;

  function drain() {
    while (buffer.has(last + 1)) {
      const next = buffer.get(last + 1);
      buffer.delete(last + 1);
      last++;
      onMessage(next);
    }
    if (buffer.size === 0) gapOpen = false;
  }

  function reportGap() {
    gapOpen = true;
    onGap({ from: last + 1, to: Math.min(...buffer.keys()) - 1 });
  }

  return {
    push(msg) {
      if (last === null) {
        last = msg.seq;
        onMessage(msg);
        return;
      }
      if (msg.seq <= last || buffer.has(msg.seq)) return;
      if (msg.seq === last + 1) {
        last = msg.seq;
        onMessage(msg);
        drain();
        return;
      }
      buffer.set(msg.seq, msg);
      if (!gapOpen) reportGap();
    },
    resync(seq) {
      last = seq;
      for (const key of [...buffer.keys()]) if (key <= seq) buffer.delete(key);
      gapOpen = false;
      drain();
      if (buffer.size > 0) reportGap();
    },
    get lastSeq() {
      return last;
    },
    get pending() {
      return buffer.size;
    },
  };
}
```

%% exercise prod-feed-status | Honest staleness indicator | 2 | tsx | react | useFeedStatus | 20
Write `useFeedStatus(lastMessageAt, { staleAfterMs, offlineAfterMs })` for a "Live / Delayed / Offline" badge.

`lastMessageAt` is a millisecond timestamp (or `null` before the first message).

- `null` → `'connecting'`.
- age < `staleAfterMs` → `'live'`; age < `offlineAfterMs` → `'delayed'`; otherwise `'offline'` (age = `Date.now() - lastMessageAt`).
- The status must **change by itself** as time passes, with **timers scheduled for the exact next threshold** — no polling interval. When there's nothing left to wait for (`offline`, or `null`), there must be **no timer**.
- A new `lastMessageAt` resets everything. Clean up on unmount.

%% starter
```tsx
import { useEffect, useState } from 'react';

export type FeedStatus = 'connecting' | 'live' | 'delayed' | 'offline';

export function useFeedStatus(
  lastMessageAt: number | null,
  { staleAfterMs, offlineAfterMs }: { staleAfterMs: number; offlineAfterMs: number },
): FeedStatus {
  return 'connecting';
}
```

%% tests
```tsx
const opts = { staleAfterMs: 2000, offlineAfterMs: 10000 };
const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

describe('useFeedStatus', () => {
  beforeEach(() => jest.useFakeTimers());

  it('is "connecting" before the first message and keeps no timer', () => {
    const { result } = renderHook(() => useFeedStatus(null, opts));
    expect(result.current).toBe('connecting');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('is live right after a message', () => {
    const at = Date.now();
    const { result } = renderHook(() => useFeedStatus(at, opts));
    expect(result.current).toBe('live');
  });

  it('turns delayed, then offline, at exactly the thresholds', () => {
    const at = Date.now();
    const { result } = renderHook(() => useFeedStatus(at, opts));
    advance(1999);
    expect(result.current).toBe('live');
    advance(1);
    expect(result.current).toBe('delayed');
    advance(7999);
    expect(result.current).toBe('delayed');
    advance(1);
    expect(result.current).toBe('offline');
  });

  it('uses one pending timer at a time and none once offline', () => {
    const at = Date.now();
    renderHook(() => useFeedStatus(at, opts));
    expect(jest.getTimerCount()).toBe(1);
    advance(2000);
    expect(jest.getTimerCount()).toBe(1);
    advance(8000);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not poll: no timer wakes up in between thresholds', () => {
    const spy = jest.spyOn(globalThis, 'setInterval');
    const at = Date.now();
    renderHook(() => useFeedStatus(at, opts));
    advance(20000);
    expect(spy).not.toHaveBeenCalled();
  });

  it('a fresh message resets the status and the schedule', () => {
    const { result, rerender } = renderHook(({ at }) => useFeedStatus(at, opts), { initialProps: { at: Date.now() } });
    advance(5000);
    expect(result.current).toBe('delayed');
    rerender({ at: Date.now() });
    expect(result.current).toBe('live');
    advance(1999);
    expect(result.current).toBe('live');
    advance(1);
    expect(result.current).toBe('delayed');
  });

  it('starts as delayed or offline for an old timestamp', () => {
    const now = Date.now();
    expect(renderHook(() => useFeedStatus(now - 5000, opts)).result.current).toBe('delayed');
    expect(renderHook(() => useFeedStatus(now - 60000, opts)).result.current).toBe('offline');
  });

  it('clears its timer on unmount', () => {
    const at = Date.now();
    const { unmount } = renderHook(() => useFeedStatus(at, opts));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('goes from connecting to live when the first message arrives', () => {
    const { result, rerender } = renderHook(({ at }: { at: number | null }) => useFeedStatus(at, opts), { initialProps: { at: null as number | null } });
    rerender({ at: Date.now() });
    expect(result.current).toBe('live');
  });
});
```

%% hints
- A pure helper `statusFor(age)` plus a `msUntilNextChange(age)` (`staleAfterMs - age`, or `offlineAfterMs - age`, or `null` when already offline).
- Effect on `[lastMessageAt, staleAfterMs, offlineAfterMs]`: define `tick()` that sets state from the current age and schedules `setTimeout(tick, msUntilNextChange)` if there is a next change. Call `tick()` once immediately.
- Cleanup clears whichever timeout is pending.

%% solution
```tsx
import { useEffect, useState } from 'react';

export type FeedStatus = 'connecting' | 'live' | 'delayed' | 'offline';

export function useFeedStatus(
  lastMessageAt: number | null,
  { staleAfterMs, offlineAfterMs }: { staleAfterMs: number; offlineAfterMs: number },
): FeedStatus {
  const statusFor = (at: number | null): FeedStatus => {
    if (at === null) return 'connecting';
    const age = Date.now() - at;
    return age >= offlineAfterMs ? 'offline' : age >= staleAfterMs ? 'delayed' : 'live';
  };

  const [status, setStatus] = useState<FeedStatus>(() => statusFor(lastMessageAt));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      setStatus(statusFor(lastMessageAt));
      if (lastMessageAt === null) return;
      const age = Date.now() - lastMessageAt;
      const wait = age < staleAfterMs ? staleAfterMs - age : age < offlineAfterMs ? offlineAfterMs - age : null;
      if (wait !== null) timer = setTimeout(tick, wait);
    };

    tick();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessageAt, staleAfterMs, offlineAfterMs]);

  return status;
}
```
