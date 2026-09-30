---
id: prod-resilience
track: prod
title: Case study: the feed that lied
summary: Sockets die silently, reconnects stampede the server, and messages arrive out of order. Build a reconnecting client, gap detection, and an honest "how fresh is this data?" indicator.
---

> **INCIDENT — 21:40, Champions League night.** Two things go wrong within ten minutes.
>
> **(1)** A load-balancer deploy drops 80 000 WebSocket connections at once. Every client reconnects **immediately**, in lock-step, then again after 1 second, then again… The API tier is knocked over by its own clients. Recovery takes 25 minutes.
>
> **(2)** Meanwhile, users on trains report prices that "don't move" — the app looks fine, but the odds are 40 seconds old and bets are being rejected. The socket is **half-open**: the OS never told the browser the link died, so there was no `close` event to react to.

## The idea in one sentence

A network connection **will** fail in ways you can't see, so a real-time client must **notice failure itself, retry politely, repair what it missed, and be honest with the user** about how fresh its data is.

> **Analogy** You're on a phone call in a tunnel. If you both redial **the instant** the line drops, you keep blocking each other (thundering herd). If the line goes quiet you can't tell "they're thinking" from "we're disconnected" — so you agree that **if nobody speaks for 10 seconds, you hang up and call back** (heartbeat). When you reconnect, you say "**I last heard number 41 — what did I miss?**" (sequence numbers). And you tell your boss "my info might be out of date" instead of pretending it's current (honest UI).

## Failure modes to design for

1. **Clean disconnects** — server restart, deploy, idle timeout. You get a `close` event.
2. **Silent failure (half-open TCP)** — Wi-Fi/cell handover, sleeping laptop, NAT timeout. **No event at all.** Your only defence is your **own liveness check**: expect a message or heartbeat within N seconds, otherwise tear the socket down and reconnect.
3. **Thundering herd** — synchronised retries. Fixed delays make it worse.
4. **Lost state on reconnect** — a new socket has no subscriptions; the server has forgotten you.
5. **Gaps and reordering** — messages lost in the reconnect window, or delivered out of order by a relay.
6. **A lying UI** — showing stale data as if it were live.

![A silent link failure: no close event, so a heartbeat timer must notice](fig:half-open "No message for too long? Assume the link is dead: close it yourself and reconnect.")

## Backoff with jitter

Wait longer after each failed attempt (**exponential backoff**) so a struggling server gets breathing room, and **randomise** the wait (**jitter**) so clients spread out instead of retrying together. "Full jitter":

```
delay = random() × min(maxDelay, baseDelay × 2^attempt)
```

![Without jitter everyone retries together; with full jitter retries spread out inside a growing window](fig:backoff-jitter "Reset the attempt counter once a connection is actually established.")

```js try
const baseDelay = 500;
const maxDelay = 30000;

function delay(attempt, random = Math.random) {
  return random() * Math.min(maxDelay, baseDelay * 2 ** attempt);
}

// The UPPER bound of the window doubles each attempt, until it hits the cap:
for (let attempt = 0; attempt <= 8; attempt++) {
  const upper = Math.min(maxDelay, baseDelay * 2 ** attempt);
  console.log('attempt', attempt, '→ wait somewhere between 0 and', upper, 'ms');
}

console.log('example picks:', [0, 1, 2, 3].map((a) => Math.round(delay(a))));
```

Give up (or slow to a long fixed interval) after a maximum number of attempts, and **tell the user**. Make `random` **injectable** so tests are deterministic.

## Reconnecting properly

On every (re)connect:

- **Resubscribe** to every active topic (the server forgot them).
- **Flush** the outgoing queue — with a **cap**; an unbounded queue is a memory leak while offline.
- **Ignore events from stale sockets**: an old socket's late `close` must not kill the new one.
- Distinguish a **manual `close()`** from a failure, so closing doesn't trigger a reconnect.

## Snapshots + deltas + sequence numbers

The standard recipe for live data: fetch a **snapshot** (the state at sequence *N*), then apply **deltas** numbered *N+1, N+2, …*. For each message with `seq`:

- `seq <= last` → a duplicate or old message: **drop** it.
- `seq === last + 1` → **apply** it (then apply any buffered messages that now follow).
- `seq > last + 1` → a **gap**: buffer it, ask for a fresh snapshot (or the missing range), then continue.

![Messages 11 and 12 apply; 14 and 15 are buffered until 13 arrives](fig:seq-gap "This gives at-least-once delivery and correct order — it's how order books, collaborative editors and chat sync work.")

```stepper Sequence numbers in action
code:
  function push(msg) {
    if (msg.seq <= lastSeq) return;                    // duplicate or old
    if (msg.seq === lastSeq + 1) { apply(msg); drain(); return; }
    buffer.set(msg.seq, msg);                          // a gap: keep it for later
  }
---
line: 2-3
say: We've applied everything up to `seq 10`. Message **11** arrives: it's exactly `lastSeq + 1`, so we apply it.
lastSeq: 11
Buffer (waiting):
Applied: 11
---
line: 4
say: Message **14** arrives. We expected **12**. `14 > lastSeq + 1`, so there is a **gap** (12 and 13 are missing). Buffer it and report the gap — once.
lastSeq: 11
Buffer (waiting): 14
Applied: 11
---
line: 3
say: Message **12** arrives. It's the next one, so apply it. `drain()` looks in the buffer for 13 — not there yet.
lastSeq: 12
Buffer (waiting): 14
Applied: 11 | 12
---
line: 3
say: Message **13** arrives and is applied. Now `drain()` finds **14** waiting in the buffer and applies it too.
lastSeq: 14
Buffer (waiting):
Applied: 11 | 12 | 13 | 14
---
line: 2
say: A late duplicate of **12** shows up. `12 <= lastSeq`, so it is dropped.
lastSeq: 14
Applied: 11 | 12 | 13 | 14
```

## Tell the truth in the UI

Show the connection state (`live`, `delayed`, `offline`) and **disable or annotate** anything that depends on fresh data ("Prices delayed — bets paused"). Compute it from the **time since the last message**, using timers scheduled for the *exact next threshold* — not a 1-second polling loop that keeps waking a background tab.

```js try
function statusOf(ageMs, staleAfterMs = 5000, offlineAfterMs = 15000) {
  if (ageMs < staleAfterMs) return 'live';
  if (ageMs < offlineAfterMs) return 'delayed';
  return 'offline';
}

console.log([0, 4999, 5000, 14999, 15000].map((age) => age + 'ms → ' + statusOf(age)));

// "Exact next threshold": how long until the status CHANGES from a given age?
const nextChangeIn = (age, stale = 5000, offline = 15000) => (age < stale ? stale - age : age < offline ? offline - age : null);
console.log('next change in', nextChangeIn(1200), 'ms (then', nextChangeIn(5000), 'ms more, then nothing:', nextChangeIn(15000) + ')');
```

## Other things to mention in an interview

- `navigator.onLine` only reports the *network interface*, not the internet — use it as a hint to retry sooner, never as proof.
- Pause reconnect attempts while the tab is hidden; resume on `visibilitychange`.
- Offer a **fallback transport** (SSE or long-polling) for networks that block WebSockets.
- Server side: rate-limit reconnects, **drain connections** gradually during deploys, stagger restarts.

## Quick check

```check
Q: Why can a WebSocket fail without ever firing a `close` event?
A) Browsers never fire close
B) The OS may not have noticed the link died (half-open connection) *
C) The server always closes cleanly
D) Only when using HTTP/2
Why: Silent failures (Wi-Fi/cell handover, NAT timeout) leave the socket looking open. Only your own timeout can detect it.
---
Q: What does "full jitter" add to exponential backoff?
A) A longer maximum delay
B) Encryption
C) A random delay inside the window, so clients don't retry in lock-step *
D) More retries
Why: Randomising spreads the retries over time instead of creating synchronised spikes.
---
Q: After reconnecting, what must a client do about subscriptions?
A) Nothing; the server remembers
B) Resubscribe to every active topic *
C) Reload the page
D) Wait for the server to ask
Why: A new socket is a new session. The server has forgotten your topics.
---
Q: A feed delivers `seq 11`, then `seq 14`. What should the client do with 14?
A) Apply it immediately
B) Drop it
C) Crash
D) Buffer it, report a gap, and resync *
Why: 12 and 13 are missing; applying 14 would leave the state wrong. Buffer it until the gap is filled or a snapshot covers it.
---
Q: Why schedule a timer for the exact next status threshold instead of polling every second?
A) It keeps an idle background tab from waking constantly, and is precise *
B) Polling is illegal
C) Timers are faster than polling
D) It removes the need for state
Why: One timer for the next change wakes the app only when something happens.
```

## Recap

- Assume **silent failure**: heartbeat/liveness timeout, then tear down and reconnect.
- **Exponential backoff + full jitter**; reset the counter after a successful open; cap attempts; tell the user.
- On reconnect: **resubscribe**, **flush a bounded queue**, ignore stale sockets, respect manual `close()`.
- **Snapshot + sequenced deltas**: drop old, apply next, buffer and report gaps.
- **Show freshness honestly** (`live / delayed / offline`) using timers for exact thresholds.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: backoff delay | The `delay` snippet |
| Reconnecting socket | Everything above: backoff, resubscribe, queue cap, heartbeat, stale-socket guard |
| Gap detection with sequence numbers | The stepper: drop / apply / buffer, and draining |
| Honest staleness indicator | The status snippet and "exact next threshold" timers |

%% exercise prod-guided-backoff | Guided: backoff with jitter | 1 | js | js | backoffDelay | 5 | guided
Write `backoffDelay(attempt, { baseMs = 500, maxMs = 30000, random = Math.random } = {})`. It returns how long to wait before reconnect attempt number `attempt` (0, 1, 2, …).

The formula is **full jitter**:

```
random() × min(maxMs, baseMs × 2^attempt)
```

```js
backoffDelay(0, { random: () => 1 });  // 500       (window: 0 … 500)
backoffDelay(3, { random: () => 1 });  // 4000      (window: 0 … 4000)
backoffDelay(10, { random: () => 1 }); // 30000     (capped by maxMs)
```

%% worked
**A similar problem, solved: `retryAfter(attempt, stepMs, capMs)`** — linear growth with a cap (no jitter).

```js
function retryAfter(attempt, stepMs, capMs) {
  return Math.min(capMs, stepMs * (attempt + 1));   // ① grow, then ② cap with Math.min
}
```

Backoff uses the same two ideas — **grow** (here exponentially: `baseMs * 2 ** attempt`) and **cap** (`Math.min(maxMs, …)`) — and then multiplies by `random()` so each client picks a different point inside the window. The `random` parameter is injectable so tests can make it predictable (`() => 1` = the top of the window, `() => 0.5` = the middle).

%% explain
- **Window** for attempt *n* is `min(maxMs, baseMs × 2ⁿ)`.
- **The result** is `random()` × window (so `random: () => 0` gives `0`).
- **Defaults**: `baseMs = 500`, `maxMs = 30000`, `random = Math.random`.
- **Cap**: large attempts never exceed `maxMs`.

%% nudge
- Which operator is `2 ** attempt`, and which function caps the window?
- Where does `random()` come in — before or after the cap?

%% starter
```js
export function backoffDelay(attempt, { baseMs = 500, maxMs = 30000, random = Math.random } = {}) {
  // Step 1 — the window grows exponentially:  baseMs * 2 ** attempt
  // Step 2 — cap it:                          Math.min(maxMs, ...)
  // Step 3 — pick a random point inside it:   random() * window
  return 0;
}
```

%% tests
```js
describe('backoffDelay', () => {
  const top = () => 1;

  it('doubles the window each attempt', () => {
    expect(backoffDelay(0, { random: top })).toBe(500);
    expect(backoffDelay(1, { random: top })).toBe(1000);
    expect(backoffDelay(3, { random: top })).toBe(4000);
  });

  it('caps the window at maxMs', () => {
    expect(backoffDelay(10, { random: top })).toBe(30000);
    expect(backoffDelay(6, { random: top, baseMs: 100, maxMs: 5000 })).toBe(5000);
  });

  it('applies jitter', () => {
    expect(backoffDelay(2, { random: () => 0.5 })).toBe(1000);
    expect(backoffDelay(2, { random: () => 0 })).toBe(0);
  });

  it('uses Math.random by default', () => {
    const d = backoffDelay(1);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThanOrEqual(1000);
  });
});
```

%% hints
- `const window = Math.min(maxMs, baseMs * 2 ** attempt);`
- `return random() * window;`

%% solution
```js
export function backoffDelay(attempt, { baseMs = 500, maxMs = 30000, random = Math.random } = {}) {
  const window = Math.min(maxMs, baseMs * 2 ** attempt);
  return random() * window;
}
```

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

%% worked
**How to approach a big one: write down the states and the events, then handle each pair.**

| Event \ State | connecting | open | reconnecting | closed / failed |
| --- | --- | --- | --- | --- |
| socket `open` | → **open** (reset attempt, resubscribe, flush queue) | — | → **open** (same) | ignore |
| socket `close` (unexpected) | → **reconnecting** | → **reconnecting** | schedule next | ignore |
| heartbeat timeout | — | drop the socket → **reconnecting** | — | — |
| `close()` called | → **closed** | → **closed** | → **closed** | no-op |

A sketch of the reconnect scheduling, which is the trickiest part:

```js
function scheduleReconnect() {
  if (attempt >= maxAttempts) return setStatus('failed');            // ① give up
  setStatus('reconnecting');
  const wait = random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);   // ② full jitter
  attempt += 1;
  timer = setTimeout(connect, wait);                                 // ③ keep the timer id so close() can cancel it
}

function connect() {
  const socket = createSocket();
  current = socket;                                                  // ④ remember which socket is CURRENT
  socket.addEventListener('close', () => { if (socket !== current) return; scheduleReconnect(); });   // ⑤ stale sockets are ignored
  // …open / message handlers check `socket !== current` the same way…
}
```

Everything else is bookkeeping: a `Set` of active topics (resubscribed on `open`), a bounded queue (drop the **oldest** beyond `maxQueue`), a heartbeat timer that restarts on every message, and a `closed` flag checked everywhere so `close()` can never be followed by a reconnect.

%% explain
- **Statuses**: `connecting`, `open`, `reconnecting`, `closed`, `failed`; `onStatus` fires only on **changes**.
- **On open**: reset attempts, **resubscribe** every topic (`{action:'subscribe', topic}`), then flush queued sends in order.
- **`send`** queues while not open (keeping at most `maxQueue`, dropping the oldest); ignored after `close()`.
- **`subscribe(topic)`** returns an unsubscribe that sends `{action:'unsubscribe', topic}` if open.
- **Unexpected close**: schedule with full-jitter backoff; at `maxAttempts` → `failed`.
- **Heartbeat**: no message in `heartbeatTimeoutMs` → drop the socket **without waiting for `close`**, call `close()` on it, reconnect.
- **Stale-socket events are ignored**; **`close()`** cancels every timer and never reconnects.

%% nudge
- How do you make sure a late event from an *old* socket can't affect the new one?
- Which timers exist (reconnect, heartbeat) and does `close()` clear them all?

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

%% worked
**A similar problem, solved: a "next ticket" counter** — serve numbered tickets strictly in order, holding early arrivals.

```js
function createTicketDesk(serve) {
  let next = 1;                        // ① the number we expect next
  const waiting = new Map();           // ② early arrivals, keyed by number

  return function arrive(ticket) {
    if (ticket < next) return;                       // ③ already served (duplicate/old): drop
    waiting.set(ticket, true);                       // ④ remember it…
    while (waiting.has(next)) {                      // ⑤ …and serve everything that is now consecutive
      waiting.delete(next);
      serve(next);
      next += 1;
    }
  };
}
```

The `while (waiting.has(next))` **drain loop** is exactly what the feed needs after each applied message. The feed adds: the **first message ever** sets the baseline; `onGap({ from: lastSeq + 1, to: seq - 1 })` is called **once** when a gap opens (remember that one is already open, and clear that memory when the gap closes); and `resync(seq)` jumps `lastSeq` forward, discards buffered messages at or below it, then drains — reporting a *new* gap if one still remains.

%% explain
- **First message** establishes the baseline: delivered, sets `lastSeq`.
- **`seq <= lastSeq`** → dropped. **`seq === lastSeq + 1`** → delivered, then any consecutive buffered messages.
- **`seq > lastSeq + 1`** → buffered; `onGap({ from, to })` **once** when the gap is first detected.
- **`resync(seq)`**: sets `lastSeq`, discards buffered `seq <=` it, delivers consecutive ones, and calls `onGap` again if a gap remains.
- **`pending`** = number of buffered messages.

%% nudge
- After applying a message, what must you check the buffer for?
- How do you avoid calling `onGap` again for the *same* open gap?

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

%% worked
**A similar problem, solved: `useCountdownLabel(deadline)`** — a label that changes itself at exact moments, with no polling.

```tsx
import { useEffect, useState } from 'react';

export function useDeadlineLabel(deadline: number): 'soon' | 'now' | 'passed' {
  const compute = () => {
    const left = deadline - Date.now();
    return left > 10_000 ? 'soon' : left > 0 ? 'now' : 'passed';
  };
  const [label, setLabel] = useState(compute);

  useEffect(() => {
    setLabel(compute());                                     // ① recompute when the input changes
    const left = deadline - Date.now();
    // ② how long until the label CHANGES next? (null = never)
    const wait = left > 10_000 ? left - 10_000 : left > 0 ? left : null;
    if (wait === null) return;                               // ③ nothing left to wait for → NO timer
    const id = setTimeout(() => setLabel(compute()), wait);  // ④ one timer, scheduled for the exact moment
    return () => clearTimeout(id);                           // ⑤ cleanup (a new deadline re-runs the effect)
  }, [deadline]);

  return label;
}
```

For `useFeedStatus`, the thresholds are `staleAfterMs` and `offlineAfterMs`, measured from `lastMessageAt`: age `< stale` → `live` (next change in `stale - age`), age `< offline` → `delayed` (next change in `offline - age`), otherwise `offline` (no timer). `null` → `connecting` (no timer). Each timer callback re-computes the status; the effect depends on `lastMessageAt`, so a new message cancels the old timer and starts over.

%% explain
- **`null`** → `'connecting'`; age `< staleAfterMs` → `'live'`; `< offlineAfterMs` → `'delayed'`; else `'offline'`.
- **The status changes by itself** as time passes, using **one timer scheduled for the exact next threshold** (no polling).
- **No timer** when nothing is left to wait for (`offline` or `null`).
- **A new `lastMessageAt`** resets everything; timers are cleaned up on unmount.

%% nudge
- Given the current age, how many milliseconds until the status next changes?
- What should happen to the old timer when `lastMessageAt` changes?

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
