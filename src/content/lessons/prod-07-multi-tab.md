---
id: prod-multi-tab
track: prod
title: Case study: five tabs, one customer
summary: A bet slip diverges between tabs and five open tabs mean five sockets. Sync state across tabs with last-writer-wins, elect a leader, and share one connection.
---

> **INCIDENT — two problems with one root cause.**
>
> **(1)** A customer places a bet in tab A. Tab B still shows the old balance and the same slip, so they place it again. Support: "double bet".
>
> **(2)** Power users keep 4–6 tabs open. Each tab opens its own WebSocket → the server sees 6× the connections and rate-limits them; feeds start dropping *for everyone on that account*.

Browser tabs of one origin are separate JavaScript worlds. They share **storage** and can **message** each other, but nothing else. Treat them like a tiny distributed system: no shared memory, unreliable timing, and any node (tab) can vanish without warning.

## Ways for tabs to talk

| Mechanism | Notes |
| --- | --- |
| **`BroadcastChannel(name)`** | Best default. Messages go to *other* contexts of the same origin, asynchronously. Structured-clone payloads. Not delivered to the sender. |
| **`storage` event** | Fires in *other* tabs when `localStorage` changes. Works everywhere, string-only, quirky. Good fallback. |
| **`SharedWorker`** | One worker shared by all tabs — a natural home for a single socket or shared state. Less supported historically (not in some mobile browsers). |
| **Service Worker** | A network proxy; can `postMessage` to clients. Different job. |
| **Web Locks API** (`navigator.locks`) | Mutual exclusion across tabs — the modern way to elect a leader (below). |

## Sharing state: last-writer-wins

For UI state (theme, slip contents, filters), a **last-writer-wins (LWW) register per key** is often enough:

- Tag each write with a **version**: `(timestamp, tabId)`. The greater version wins; the tab id breaks ties so every tab converges on the **same** answer.
- Use a **logical clock** (`max(now, lastSeen + 1)`) so a tab with a slow clock can still overwrite what it just read.
- **Deletes** need **tombstones**: remember "deleted at version v", or an old delayed `set` will resurrect the key.
- A **new tab** must catch up: broadcast `hello`; others reply with their state; merge with the same rule.

This converges *eventually* with no coordinator. For truly concurrent structured edits (lists, text) you'd graduate to a CRDT — out of scope, but know the name.

> **Money is different.** LWW is fine for showing a slip; it is **not** how you decide whether a bet is placed. The **server** is the source of truth (and idempotency keys stop double placement). Tabs should *display* and *hint*, never adjudicate.

## One connection for all tabs

Elect a **leader** tab. Only the leader opens the socket and **relays** messages to the others via the channel. If the leader closes, another tab takes over and reconnects.

**Heartbeat election** (portable): every tab broadcasts a heartbeat; each tab keeps `lastSeen` for its peers; the leader is the **alive tab with the lowest id**. Send a `bye` on `pagehide`/close for instant handover; rely on the **timeout** when a tab crashes.

**Web Locks** is simpler and more robust where available:

```js
navigator.locks.request('feed-leader', async () => {
  openSocket();                       // I'm the leader as long as this promise is pending
  await new Promise(() => {});        // hold the lock until the tab goes away
});
```

The browser releases the lock automatically when the holding tab closes or crashes, and grants it to the next waiter.

## Background-tab gotchas

- Hidden tabs get **throttled timers** (≥ 1 s), and after ~5 minutes Chrome applies **intensive throttling** (~once a minute). A heartbeat every second can look dead. Set timeouts well above the throttled interval — or use Web Locks, which don't depend on timers.
- Tabs can be **frozen** or **discarded** to save memory; the back/forward cache can restore a page with stale state. Re-sync on `visibilitychange`/`pageshow`.

## Testing

`createFakeChannelHub()` gives you `BroadcastChannel`-like objects that deliver to *other* channels of the same name, asynchronously (`await flushPromises()` to let them arrive). Combine with fake timers for heartbeats.

%% exercise prod-tab-sync | Cross-tab key-value sync | 3 | js | js | createTabSync | 35
Build `createTabSync({ channel, tabId, now = () => Date.now() })`: a small key-value store that stays consistent across tabs.

Returns `{ get(key), set(key, value), delete(key), getAll(), subscribe(listener), close() }`.

- `set`/`delete` update locally and **broadcast** the change. Every entry carries a **version** `{ ts, tabId }`.
- **Last writer wins:** a change is applied only if its version is greater than the stored one (`ts` first, then `tabId` string comparison as the tie-break). Every tab must end with the same value regardless of delivery order.
- Use a logical clock: a write's `ts` is `max(now(), highestTsSeen + 1)`, so a local write always beats what this tab has already seen.
- **Deletes are tombstones** (kept with their version), so a delayed older `set` can't resurrect the key. `get` of a deleted key is `undefined`; `getAll()` excludes deleted keys.
- `subscribe(listener)` → unsubscribe fn. Listeners get `(key, value, { remote })` for every applied change (`value` is `undefined` after a delete).
- **Catch-up:** on creation broadcast `{ type: 'hello', from: tabId }`. When a tab receives a `hello` from another tab it broadcasts its full state `{ type: 'state', from, entries }`. Receiving `state` merges every entry with the same LWW rule.
- Messages from your own `tabId` are ignored. `close()` closes the channel and stops handling messages.

Channel API: `channel.postMessage(data)`, `channel.addEventListener('message', fn)` (event has `.data`), `channel.removeEventListener`, `channel.close()`.

%% starter
```js
export function createTabSync({ channel, tabId, now = () => Date.now() }) {
  // your code
}
```

%% tests
```js
function tabs(names, options = {}) {
  const hub = createFakeChannelHub();
  const clock = { t: 1000 };
  const out = {};
  for (const name of names) out[name] = createTabSync({ channel: hub.channel('slip'), tabId: name, now: () => clock.t, ...options });
  return { ...out, clock, hub };
}
const settle = () => flushPromises();

describe('createTabSync', () => {
  it('stores values locally', () => {
    const { a } = tabs(['a']);
    a.set('theme', 'dark');
    expect(a.get('theme')).toBe('dark');
    expect(a.getAll()).toEqual({ theme: 'dark' });
    expect(a.get('nope')).toBeUndefined();
  });

  it('propagates writes to other tabs', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    a.set('stake', 1000);
    await settle();
    expect(b.get('stake')).toBe(1000);
  });

  it('does not echo a tab’s own messages back into itself', async () => {
    const { a } = tabs(['a', 'b']);
    const listener = jest.fn();
    a.subscribe(listener);
    a.set('k', 1);
    await settle();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('k', 1, { remote: false });
  });

  it('notifies subscribers of remote changes', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    const listener = jest.fn();
    b.subscribe(listener);
    a.set('k', 'v');
    await settle();
    expect(listener).toHaveBeenCalledWith('k', 'v', { remote: true });
  });

  it('unsubscribe stops notifications', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    const listener = jest.fn();
    const off = b.subscribe(listener);
    off();
    a.set('k', 1);
    await settle();
    expect(listener).not.toHaveBeenCalled();
  });

  it('last writer wins, by timestamp', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 1000; a.set('k', 'from a');
    clock.t = 2000; b.set('k', 'from b');
    await settle();
    expect(a.get('k')).toBe('from b');
    expect(b.get('k')).toBe('from b');
  });

  it('breaks timestamp ties with the tab id so all tabs converge', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 5000;
    a.set('k', 'A'); b.set('k', 'B'); // truly concurrent
    await settle();
    expect(a.get('k')).toBe(b.get('k'));
    expect(a.get('k')).toBe('B');
  });

  it('a local write always beats what the tab has already seen, even with a slow clock', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 9000; a.set('k', 'from a');
    await settle();
    clock.t = 1000; // b's clock is far behind
    b.set('k', 'from b');
    await settle();
    expect(a.get('k')).toBe('from b');
    expect(b.get('k')).toBe('from b');
  });

  it('propagates deletes and keeps tombstones so old sets cannot resurrect a key', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 1000; a.set('k', 1);
    await settle();
    clock.t = 2000; a.delete('k');
    await settle();
    expect(b.get('k')).toBeUndefined();
    expect(b.getAll()).toEqual({});
    const late = jest.fn();
    b.subscribe(late);
    // a late, older write arriving at b is ignored
    const hub2 = tabs(['x']); // separate hub, just to prove no cross-talk
    expect(hub2.x.getAll()).toEqual({});
    expect(late).not.toHaveBeenCalled();
  });

  it('a delete notifies subscribers with an undefined value', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    a.set('k', 1);
    await settle();
    const listener = jest.fn();
    b.subscribe(listener);
    a.delete('k');
    await settle();
    expect(listener).toHaveBeenCalledWith('k', undefined, { remote: true });
  });

  it('a newly opened tab catches up with existing state', async () => {
    const hub = createFakeChannelHub();
    const clock = { t: 1000 };
    const a = createTabSync({ channel: hub.channel('slip'), tabId: 'a', now: () => clock.t });
    a.set('one', 1); a.set('two', 2);
    a.delete('two');
    await settle();
    const late = createTabSync({ channel: hub.channel('slip'), tabId: 'late', now: () => clock.t });
    await settle();
    await settle();
    expect(late.getAll()).toEqual({ one: 1 });
  });

  it('merging state does not overwrite newer local entries', async () => {
    const hub = createFakeChannelHub();
    const clock = { t: 1000 };
    const a = createTabSync({ channel: hub.channel('slip'), tabId: 'a', now: () => clock.t });
    a.set('k', 'old');
    clock.t = 5000;
    const b = createTabSync({ channel: hub.channel('slip'), tabId: 'b', now: () => clock.t });
    b.set('k', 'newer');
    await settle(); await settle();
    expect(a.get('k')).toBe('newer');
    expect(b.get('k')).toBe('newer');
  });

  it('three tabs converge', async () => {
    const { a, b, c, clock } = tabs(['a', 'b', 'c']);
    await settle();
    clock.t = 100; a.set('x', 'a1');
    clock.t = 200; b.set('x', 'b1'); c.set('y', 'c1');
    clock.t = 300; c.delete('x');
    await settle(); await settle();
    for (const t of [a, b, c]) expect(t.getAll()).toEqual({ y: 'c1' });
  });

  it('close() closes the channel and stops handling messages', async () => {
    const { a, b, hub } = tabs(['a', 'b']);
    await settle();
    const before = hub.open();
    b.close();
    expect(hub.open()).toBe(before - 1);
    a.set('k', 1);
    await settle();
    expect(b.get('k')).toBeUndefined();
  });
});
```

%% hints
- `entries = new Map<key, { value, ts, tabId, deleted }>()` and a `maxTs` you update whenever you see any version.
- `isNewer(a, b)`: `!b || a.ts > b.ts || (a.ts === b.ts && a.tabId > b.tabId)`.
- One `apply(key, entry, remote)` does the comparison, stores, bumps `maxTs`, and notifies. Local `set`, remote `set` messages and `state` merges all go through it.
- Local write: `ts = Math.max(now(), maxTs + 1)`.
- Message shapes: `{ type: 'set', from, key, entry }`, `{ type: 'hello', from }`, `{ type: 'state', from, entries: [[key, entry], …] }`. Ignore messages whose `from === tabId`.

%% solution
```js
export function createTabSync({ channel, tabId, now = () => Date.now() }) {
  const entries = new Map();
  const listeners = new Set();
  let maxTs = 0;
  let closed = false;

  const isNewer = (a, b) => !b || a.ts > b.ts || (a.ts === b.ts && a.tabId > b.tabId);

  function apply(key, entry, remote) {
    maxTs = Math.max(maxTs, entry.ts);
    if (!isNewer(entry, entries.get(key))) return;
    entries.set(key, entry);
    const value = entry.deleted ? undefined : entry.value;
    listeners.forEach((l) => l(key, value, { remote }));
  }

  function write(key, value, deleted) {
    const entry = { value, ts: Math.max(now(), maxTs + 1), tabId, deleted };
    apply(key, entry, false);
    channel.postMessage({ type: 'set', from: tabId, key, entry });
  }

  const onMessage = (event) => {
    if (closed) return;
    const msg = event.data;
    if (!msg || msg.from === tabId) return;
    if (msg.type === 'set') apply(msg.key, msg.entry, true);
    else if (msg.type === 'hello') channel.postMessage({ type: 'state', from: tabId, entries: [...entries] });
    else if (msg.type === 'state') for (const [key, entry] of msg.entries) apply(key, entry, true);
  };

  channel.addEventListener('message', onMessage);
  channel.postMessage({ type: 'hello', from: tabId });

  return {
    get: (key) => {
      const entry = entries.get(key);
      return entry && !entry.deleted ? entry.value : undefined;
    },
    set: (key, value) => write(key, value, false),
    delete: (key) => write(key, undefined, true),
    getAll() {
      const out = {};
      for (const [key, entry] of entries) if (!entry.deleted) out[key] = entry.value;
      return out;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      closed = true;
      channel.removeEventListener('message', onMessage);
      channel.close();
    },
  };
}
```

%% exercise prod-leader-election | Heartbeat leader election | 4 | js | js | createLeaderElection | 40
Build `createLeaderElection({ channel, tabId, heartbeatMs = 1000, timeoutMs = 3500, now = () => Date.now(), onChange })`.

Returns `{ get isLeader, get peers, close() }`.

- Broadcast `{ type: 'heartbeat', from: tabId }` immediately on creation and then every `heartbeatMs`.
- Track each peer's `lastSeen` (using `now()` when its heartbeat arrives). A peer is **alive** while `now() - lastSeen < timeoutMs`. Ignore your own messages.
- The **leader is the alive tab with the lowest id** (string comparison), counting yourself.
- Start as **not** the leader. Evaluate on every **tick** (each `heartbeatMs`), whenever a **heartbeat** arrives, and when a **bye** arrives. A newly created tab therefore gets one heartbeat interval to hear about peers before it can claim leadership.
- `onChange(isLeader)` fires **only when leadership changes**.
- `peers` → sorted ids of alive **other** tabs.
- `close()` broadcasts `{ type: 'bye', from: tabId }`, stops the timer, removes the listener and closes the channel. Receiving a `bye` removes that peer immediately.

%% starter
```js
export function createLeaderElection({ channel, tabId, heartbeatMs = 1000, timeoutMs = 3500, now = () => Date.now(), onChange = () => {} }) {
  // your code
}
```

%% tests
```js
function makeTab(hub, id, options = {}, clock) {
  const changes = [];
  const raw = hub.channel('leader');
  let crashed = false;
  const channel = {
    postMessage: (m) => { if (!crashed) raw.postMessage(m); },
    addEventListener: (t, f) => raw.addEventListener(t, f),
    removeEventListener: (t, f) => raw.removeEventListener(t, f),
    close: () => raw.close(),
  };
  const election = createLeaderElection({ channel, tabId: id, now: () => clock.t, onChange: (v) => changes.push(v), ...options });
  return { election, changes, crash: () => { crashed = true; } };
}
async function advance(clock, ms) {
  clock.t += ms;
  await jest.advanceTimersByTimeAsync(ms);
  await flushPromises();
}

describe('createLeaderElection', () => {
  let hub, clock;
  beforeEach(() => { jest.useFakeTimers(); hub = createFakeChannelHub(); clock = { t: 0 }; });

  it('starts as a non-leader, then a lone tab becomes leader after the first tick', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    expect(a.election.isLeader).toBe(false);
    await advance(clock, 1000);
    expect(a.election.isLeader).toBe(true);
    expect(a.changes).toEqual([true]);
  });

  it('broadcasts a heartbeat immediately and on each tick', async () => {
    const seen = [];
    const spy = hub.channel('leader');
    spy.onmessage = (e) => seen.push(e.data);
    makeTab(hub, 'a', {}, clock);
    await flushPromises();
    expect(seen).toEqual([{ type: 'heartbeat', from: 'a' }]);
    await advance(clock, 1000);
    await advance(clock, 1000);
    expect(seen).toHaveLength(3);
  });

  it('the lowest id wins among several tabs', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    const c = makeTab(hub, 'c', {}, clock);
    await advance(clock, 1000);
    expect(a.election.isLeader).toBe(true);
    expect(b.election.isLeader).toBe(false);
    expect(c.election.isLeader).toBe(false);
    expect(a.election.peers).toEqual(['b', 'c']);
    expect(c.election.peers).toEqual(['a', 'b']);
  });

  it('a tab with a lower id joining later takes over, and the old leader steps down', async () => {
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(true);
    const a = makeTab(hub, 'a', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false);
    expect(b.changes).toEqual([true, false]);
    expect(a.election.isLeader).toBe(true);
  });

  it('hands over immediately when the leader says bye', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false);
    a.election.close();
    await flushPromises();
    expect(b.election.isLeader).toBe(true);
    expect(b.election.peers).toEqual([]);
  });

  it('detects a crashed leader via the heartbeat timeout', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    a.crash();
    await advance(clock, 1000);
    await advance(clock, 1000);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false); // 3000ms since a's last heartbeat: still within 3500
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(true);
    expect(b.election.peers).toEqual([]);
  });

  it('a recovered peer is alive again once its heartbeats resume', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    a.crash();
    for (let i = 0; i < 5; i++) await advance(clock, 1000);
    expect(b.election.isLeader).toBe(true);
    const a2 = makeTab(hub, 'a', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false);
    expect(a2.election.isLeader).toBe(true);
  });

  it('honours custom heartbeat and timeout values', async () => {
    const a = makeTab(hub, 'a', { heartbeatMs: 100, timeoutMs: 250 }, clock);
    const b = makeTab(hub, 'b', { heartbeatMs: 100, timeoutMs: 250 }, clock);
    await advance(clock, 100);
    expect(a.election.isLeader).toBe(true);
    a.crash();
    await advance(clock, 100);
    await advance(clock, 100);
    expect(b.election.isLeader).toBe(false);
    await advance(clock, 100);
    expect(b.election.isLeader).toBe(true);
  });

  it('onChange fires only on changes', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    for (let i = 0; i < 5; i++) await advance(clock, 1000);
    expect(a.changes).toEqual([true]);
  });

  it('close() stops the timer and detaches', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    a.election.close();
    expect(jest.getTimerCount()).toBe(0);
    expect(hub.open()).toBe(0);
  });

  it('ignores its own messages and malformed ones', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const noise = hub.channel('leader');
    noise.postMessage({ type: 'unknown', from: 'zzz' });
    noise.postMessage(null);
    await advance(clock, 1000);
    expect(a.election.isLeader).toBe(true);
    expect(a.election.peers).toEqual([]);
  });
});
```

%% hints
- `peers = new Map<id, lastSeen>()`. `evaluate()` drops peers whose `now() - lastSeen >= timeoutMs`, computes `leader = [tabId, ...peers.keys()].sort()[0]`, and calls `onChange` if `leader === tabId` differs from the previous value.
- The interval callback = `postMessage(heartbeat)` then `evaluate()`.
- On a `heartbeat` message: `peers.set(from, now())`, `evaluate()`. On `bye`: `peers.delete(from)`, `evaluate()`.
- Track `isLeader` in a variable that starts `false`.
- `close()`: `postMessage({ type: 'bye', from })`, `clearInterval`, `removeEventListener`, `channel.close()`.

%% solution
```js
export function createLeaderElection({ channel, tabId, heartbeatMs = 1000, timeoutMs = 3500, now = () => Date.now(), onChange = () => {} }) {
  const peers = new Map();
  let isLeader = false;
  let closed = false;

  function evaluate() {
    if (closed) return;
    const t = now();
    for (const [id, lastSeen] of peers) if (t - lastSeen >= timeoutMs) peers.delete(id);
    const leader = [tabId, ...peers.keys()].sort()[0];
    const next = leader === tabId;
    if (next !== isLeader) {
      isLeader = next;
      onChange(isLeader);
    }
  }

  const onMessage = (event) => {
    if (closed) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || msg.from === tabId) return;
    if (msg.type === 'heartbeat') {
      peers.set(msg.from, now());
      evaluate();
    } else if (msg.type === 'bye') {
      peers.delete(msg.from);
      evaluate();
    }
  };

  const beat = () => channel.postMessage({ type: 'heartbeat', from: tabId });

  channel.addEventListener('message', onMessage);
  beat();
  const timer = setInterval(() => {
    beat();
    evaluate();
  }, heartbeatMs);

  return {
    get isLeader() {
      return isLeader;
    },
    get peers() {
      return [...peers.keys()].sort();
    },
    close() {
      if (closed) return;
      channel.postMessage({ type: 'bye', from: tabId });
      closed = true;
      clearInterval(timer);
      channel.removeEventListener('message', onMessage);
      channel.close();
    },
  };
}
```

%% exercise prod-shared-feed | One socket for all tabs | 3 | js | js | createSharedFeed | 30
Put the election to work. Build `createSharedFeed({ channel, election, createSocket, onMessage })`.

`election` exposes `isLeader` (getter) and `subscribe(fn)` (returns unsubscribe; `fn(isLeader)` is called on changes). `createSocket()` returns a socket with `addEventListener('message', fn)` and `close()`.

- **Leader:** owns the socket. It opens it (`createSocket()`) when it becomes leader, delivers each frame to its own `onMessage(data)`, and **relays** it to other tabs with `channel.postMessage({ type: 'feed', data })`.
- **Follower:** never opens a socket. It calls `onMessage(data)` for each `feed` message that arrives on the channel.
- When leadership is **lost**, close the socket (and remove its listener). When it's **gained**, open one. Never hold more than one socket.
- If the tab is already leader at creation, open the socket immediately.
- `close()` unsubscribes from the election, closes the socket if any, removes the channel listener and stops delivering.

%% starter
```js
export function createSharedFeed({ channel, election, createSocket, onMessage }) {
  // your code
}
```

%% tests
```js
function fakeElection(initial = false) {
  const listeners = new Set();
  return {
    isLeader: initial,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(value) { this.isLeader = value; listeners.forEach((l) => l(value)); },
    listenerCount: () => listeners.size,
  };
}
function makeFeed(hub, election, received) {
  const sockets = [];
  const feed = createSharedFeed({
    channel: hub.channel('feed'),
    election,
    createSocket: () => { const s = createFakeSocket('wss://odds'); s.open(); sockets.push(s); return s; },
    onMessage: (d) => received.push(d),
  });
  return { feed, sockets };
}

describe('createSharedFeed', () => {
  it('a follower opens no socket', () => {
    const hub = createFakeChannelHub();
    const { sockets } = makeFeed(hub, fakeElection(false), []);
    expect(sockets).toHaveLength(0);
  });

  it('a leader at creation opens the socket immediately', () => {
    const hub = createFakeChannelHub();
    const { sockets } = makeFeed(hub, fakeElection(true), []);
    expect(sockets).toHaveLength(1);
  });

  it('the leader delivers frames locally and relays them to followers', async () => {
    const hub = createFakeChannelHub();
    const leaderGot = [], followerGot = [];
    const leader = makeFeed(hub, fakeElection(true), leaderGot);
    makeFeed(hub, fakeElection(false), followerGot);
    leader.sockets[0].receive({ market: 'm1', odds: 2 });
    await flushPromises();
    expect(leaderGot).toEqual(['{"market":"m1","odds":2}']);
    expect(followerGot).toEqual(['{"market":"m1","odds":2}']);
  });

  it('followers do not receive their own relays twice and leaders do not double-deliver', async () => {
    const hub = createFakeChannelHub();
    const leaderGot = [];
    const leader = makeFeed(hub, fakeElection(true), leaderGot);
    leader.sockets[0].receive('x');
    await flushPromises();
    expect(leaderGot).toEqual(['x']);
  });

  it('opens a socket when leadership is gained', () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(false);
    const { sockets } = makeFeed(hub, election, []);
    election.set(true);
    expect(sockets).toHaveLength(1);
  });

  it('closes the socket when leadership is lost', () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(true);
    const { sockets } = makeFeed(hub, election, []);
    election.set(false);
    expect(sockets[0].readyState).toBe(3);
    expect(sockets[0].listenerCount()).toBe(0);
  });

  it('never holds more than one socket across leadership flips', () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(false);
    const { sockets } = makeFeed(hub, election, []);
    election.set(true); election.set(true); election.set(false); election.set(true);
    const open = sockets.filter((s) => s.readyState !== 3);
    expect(open).toHaveLength(1);
    expect(sockets).toHaveLength(2);
  });

  it('a former leader keeps receiving via the channel as a follower', async () => {
    const hub = createFakeChannelHub();
    const oldGot = [], newGot = [];
    const oldElection = fakeElection(true), newElection = fakeElection(false);
    const oldLeader = makeFeed(hub, oldElection, oldGot);
    const newLeader = makeFeed(hub, newElection, newGot);
    oldElection.set(false);
    newElection.set(true);
    newLeader.sockets[0].receive('after-handover');
    await flushPromises();
    expect(oldGot).toEqual(['after-handover']);
    expect(newGot).toEqual(['after-handover']);
    expect(oldLeader.sockets[0].readyState).toBe(3);
  });

  it('close() releases the election subscription, socket and channel listener', async () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(true);
    const got = [];
    const { feed, sockets } = makeFeed(hub, election, got);
    feed.close();
    expect(election.listenerCount()).toBe(0);
    expect(sockets[0].readyState).toBe(3);
    expect(hub.open()).toBe(0);
  });

  it('ignores channel messages of other types and malformed data', async () => {
    const hub = createFakeChannelHub();
    const got = [];
    makeFeed(hub, fakeElection(false), got);
    const other = hub.channel('feed');
    other.postMessage({ type: 'something-else', data: 'no' });
    other.postMessage(null);
    other.postMessage({ type: 'feed', data: 'yes' });
    await flushPromises();
    expect(got).toEqual(['yes']);
  });
});
```

%% hints
- Two small functions: `openSocket()` (no-op if one exists) and `closeSocket()` (remove listener, `close()`, set to `null`).
- React to election changes: `isLeader ? openSocket() : closeSocket()`.
- The socket's message handler does both: `onMessage(e.data)` **and** `channel.postMessage({ type: 'feed', data: e.data })`.
- The channel listener only handles `type === 'feed'`; BroadcastChannel never delivers to the sender, so a leader doesn't double-deliver.

%% solution
```js
export function createSharedFeed({ channel, election, createSocket, onMessage }) {
  let socket = null;
  let closed = false;

  const onSocketMessage = (event) => {
    onMessage(event.data);
    channel.postMessage({ type: 'feed', data: event.data });
  };

  function openSocket() {
    if (socket || closed) return;
    socket = createSocket();
    socket.addEventListener('message', onSocketMessage);
  }

  function closeSocket() {
    if (!socket) return;
    socket.removeEventListener('message', onSocketMessage);
    socket.close();
    socket = null;
  }

  const onChannelMessage = (event) => {
    if (closed) return;
    const msg = event.data;
    if (msg && msg.type === 'feed') onMessage(msg.data);
  };

  channel.addEventListener('message', onChannelMessage);
  const unsubscribe = election.subscribe((isLeader) => (isLeader ? openSocket() : closeSocket()));
  if (election.isLeader) openSocket();

  return {
    close() {
      if (closed) return;
      closed = true;
      unsubscribe();
      closeSocket();
      channel.removeEventListener('message', onChannelMessage);
      channel.close();
    },
  };
}
```
