---
id: prod-memory
track: prod
title: Case study: the tab that ate 2 GB
summary: Traders leave the app open all day. By mid-afternoon it's slow, then it crashes. Learn to find the leaks — unbounded history, forgotten listeners, immortal timers — and bound everything.
---

> **INCIDENT — "The app gets slower all day."** Traders keep the odds board open from 08:00. By 15:00 scrolling stutters, by 17:00 Chrome shows "Aw, Snap!". Refreshing "fixes" it.
>
> **What the memory timeline shows:** JS heap climbs in a staircase (one step per update burst) and **never comes back down after GC**. DOM node count and *event listener count* both grow steadily. Heap snapshot: 480 000 retained `Message` objects, 3 800 detached `<tr>` elements, 900 live `WebSocket` objects.

## The idea in one sentence

JavaScript cleans up memory **nobody can reach** — a **leak** is memory that is **still reachable but no longer needed**, because something forgot to let go.

> **Analogy** A hotel that frees rooms only when a guest **hands in the key**. If guests walk out but keep their keys (listeners, timers, sockets), the hotel looks full forever — and eventually has no rooms left. Every "check in" needs a matching "check out".

![A root holds a listener, which holds a closure, which holds a huge object — so the garbage collector cannot free it](fig:leak-retention "Reachable from a GC root means the collector may not free it. The fix is a matching release for every acquire.")

## The usual suspects (roughly by frequency)

1. **Unbounded collections** — `history.push(msg)` forever; a `Map` cache keyed by ids that only grows; a log/undo stack with no cap.
2. **Listeners never removed** — `window.addEventListener`, `socket.addEventListener`, store subscriptions, `MutationObserver`/`IntersectionObserver` never `disconnect()`-ed. Each holds its callback, and everything the callback closes over.
3. **Timers that outlive their owner** — a `setInterval` without `clearInterval` keeps running *and* keeps its closure alive.
4. **Closures over big data** — a small long-lived callback that captured a huge array or DOM tree in its scope.
5. **Detached DOM** — nodes removed from the page but still referenced from JS (a cache, a ref, a closure).
6. **Per-mount resources not torn down** — a new socket/worker per component mount with no `close()`/`terminate()` (900 live WebSockets!).
7. **Module-level state** — globals and singletons that accumulate across route changes.

In React, almost all of these are **effects without cleanup** or **caches without eviction**. Watch one happen:

```stepper An effect without cleanup, mounted three times
code:
  useEffect(() => {
    const id = setInterval(tick, 1000);   // started…
    // …but never cleared: no return () => clearInterval(id)
  }, []);
---
line: 1-2
say: The component **mounts**. The effect starts an interval. The browser's timer table now holds our `tick` callback — and everything it closes over.
Mounted components: 1
Live timers: 1
Kept alive by timers: component #1's data
---
line: 4
say: The user navigates away; the component **unmounts**. We forgot the cleanup, so **nothing stops the timer**. It keeps running and keeps the old component's data alive.
Mounted components: 0
Live timers: 1
Kept alive by timers: component #1's data
---
line: 1-2
say: The user comes back. A **new** component mounts and starts a **second** timer. Now two ticks per second run, and two components' worth of data are retained.
Mounted components: 1
Live timers: 2
Kept alive by timers: component #1's data | component #2's data
---
say: Repeat this a hundred times over a trading day and you get 100 timers and 100 retained component trees: the "staircase" on the memory graph. The fix is one line — `return () => clearInterval(id)`.
Mounted components: 1
Live timers: 100 (leaked)
Kept alive by timers: 100 old component trees
```

## The rule that prevents most of them

> **Every acquisition needs a matching release tied to an owner's lifetime, and every collection needs a bound.**

![Each acquire is paired with a release](fig:release-pairs "Pair every one of these in the cleanup.")

- Acquire in an effect → **return the cleanup**: `addEventListener`/`removeEventListener`, `setInterval`/`clearInterval`, `subscribe`/`unsubscribe`, `new Socket`/`close`, `observe`/`disconnect`, `fetch` + `AbortController`.
- Give long-lived objects an **idempotent `dispose()`** that releases *everything*.
- **Bound** caches and histories: a **ring buffer** (cap N), an **LRU** (evict least recently used), a **TTL** (evict old entries), or both. Decide the bound from a memory budget, not from "it'll be fine".
- Use an **`AbortSignal`** as one lifetime token: pass the same signal to `fetch`, to `addEventListener(…, { signal })` and to your own APIs; abort once to release them all.
- `WeakMap` / `WeakSet` / `WeakRef` let the GC reclaim keys/values — useful for metadata attached to objects you don't own, but they don't fix "I forgot to unsubscribe".

```js try
// A bounded history: keep only the latest N messages.
function createHistory(max) {
  const items = [];
  return {
    push(item) {
      items.push(item);
      if (items.length > max) items.shift();       // drop the OLDEST when over the cap
    },
    toArray: () => [...items],
  };
}

const history = createHistory(3);
for (let i = 1; i <= 10; i++) history.push('msg ' + i);
console.log(history.toArray());
```

```js try
// One AbortSignal releases every listener at once.
const target = new EventTarget();
let calls = 0;
const controller = new AbortController();

target.addEventListener('ping', () => calls++, { signal: controller.signal });
target.addEventListener('ping', () => calls++, { signal: controller.signal });

target.dispatchEvent(new Event('ping'));
console.log('before abort:', calls);

controller.abort();                                  // releases BOTH listeners
target.dispatchEvent(new Event('ping'));
console.log('after abort:', calls);
```

## Bounded caches: LRU + TTL

An **LRU** cache keeps the `N` most recently used entries and evicts the **least recently used** when full. A **TTL** marks entries expired after some time. Together they keep memory bounded *and* data fresh.

![Entries ordered from least to most recently used; a get moves an entry to the recent end; a full set evicts the oldest](fig:lru-ttl "A JavaScript Map remembers insertion order, so delete-then-set on every hit is a one-line LRU.")

```js try
const cache = new Map();
const MAX = 3;

function get(key) {
  if (!cache.has(key)) return undefined;
  const value = cache.get(key);
  cache.delete(key);                 // re-insert → becomes the MOST recently used
  cache.set(key, value);
  return value;
}
function set(key, value) {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);   // the first key = least recently used
}

set('A', 1); set('B', 2); set('C', 3);
get('A');                            // A is now recent
set('D', 4);                         // evicts B, the least recently used
console.log([...cache.keys()]);
```

## Finding leaks

- **Chrome DevTools → Memory:**
  - Take a **heap snapshot** three times, doing the suspect action and forcing GC between them (**the 3-snapshot technique**): what was allocated in between and is still alive?
  - *Allocation instrumentation on timeline*: blue bars that never turn grey were leaked.
  - Filter for **"Detached"** to find orphaned DOM.
- **Performance monitor:** live JS heap, DOM nodes, **JS event listeners**. A rising listener count is a leak with a name.
- **In production:** sample `performance.memory` (Chromium) / `measureUserAgentSpecificMemory()`, alert on growth per hour; run **soak tests** in CI (mount/unmount 1 000 times; replay a busy hour).
- **In unit tests** you can't see the heap, but you can assert the **evidence**: after `dispose()`/unmount, `socket.listenerCount() === 0`, `jest.getTimerCount() === 0`, history length ≤ its cap. That's what the exercises here do.

## Interview angles

- *How would you find a leak in production?* → measure, snapshot diff, follow the retainer path.
- *Leak vs high memory use?* → reachable-but-useless vs legitimately large.
- *Why does an un-cleared `setInterval` leak even after unmount?* → the timer table holds the callback strongly; its closure keeps state alive.
- *When would you use `WeakRef`?* → caches keyed by objects you don't control; almost never as the primary fix.

## Quick check

```check
Q: What is a memory leak in JavaScript?
A) Memory that is unreachable
B) Memory that is reachable but no longer useful *
C) Using a lot of memory
D) A crash caused by recursion
Why: The garbage collector frees unreachable memory. A leak is something still referenced that you no longer need.
---
Q: Why does an un-cleared `setInterval` keep a component's data alive after it unmounts?
A) Intervals copy the data
B) React keeps it
C) The timer table holds the callback, whose closure holds the data *
D) It doesn't
Why: A running timer strongly references its callback, and the callback's scope references whatever it uses.
---
Q: Which is the best fix for an ever-growing message history?
A) Bound it: keep only the latest N (a ring buffer) *
B) Bigger servers
C) Store it in a global
D) Use `WeakRef` for every item
Why: Every collection needs a bound decided by a memory budget.
---
Q: What does an `AbortSignal` passed to several `addEventListener` calls allow?
A) Faster events
B) Removing all those listeners at once with one `abort()` *
C) Sending events to workers
D) Canceling timers automatically
Why: `{ signal }` ties listener lifetime to the signal; aborting removes them all.
---
Q: How do you test for leaks in a unit test where you can't see the heap?
A) You can't
B) Use `console.log`
C) Wait an hour
D) Assert the evidence: listener counts, timer counts and history sizes after dispose/unmount *
Why: The observable symptoms (registered listeners, live timers, collection length) can be checked directly.
```

## Recap

- A **leak** = reachable but useless. Usual causes: unbounded collections, listeners, timers, big closures, detached DOM, per-mount resources, module state.
- **Every acquire gets a release** (effect cleanup, `dispose()`), and **every collection gets a bound** (ring buffer, LRU, TTL).
- **`AbortSignal`** is a handy single lifetime token.
- Find leaks with heap snapshots (3-snapshot), the performance monitor, production sampling and soak tests; in unit tests assert listener/timer/size counts.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a bounded history | The `createHistory` snippet |
| Fix the leaky feed client | The suspects list: bound history and map, `dispose()`, remove listener, clear timer, unsubscribe |
| Fix the leaky live-score component | The stepper: effect cleanups for socket, interval and `resize` listener |
| LRU + TTL cache with stats | The LRU snippet, plus expiry and counters |

%% exercise prod-guided-history | Guided: a bounded history | 1 | js | js | createHistory | 5 | guided
Write `createHistory(max)` returning `{ push(item), toArray(), get size }`.

- `push` adds an item; when there are more than `max`, the **oldest** items are dropped.
- `toArray()` returns the items **oldest first** as a **new array** (changing it must not affect the history).
- `size` is the current number of stored items.

```js
const h = createHistory(3);
[1, 2, 3, 4, 5].forEach((n) => h.push(n));
h.toArray(); // [3, 4, 5]
```

%% worked
**A similar problem, solved: `createRecent(max)`** — remembers the last `max` *distinct* searches.

```js
function createRecent(max) {
  const items = [];
  return {
    add(term) {
      const i = items.indexOf(term);
      if (i !== -1) items.splice(i, 1);          // ① remove an older copy so it moves to the newest position
      items.push(term);
      while (items.length > max) items.shift();  // ② enforce the BOUND: drop the oldest until we're within it
    },
    list: () => [...items],                      // ③ return a COPY so callers can't mutate our internal array
  };
}
```

Two habits this shows: **every collection needs a bound** (②), and **don't hand out your internal array** (③) — a caller mutating it would change your state behind your back.

%% explain
- **Never more than `max` items** are kept; the oldest are dropped first.
- **`toArray()`** is oldest-first and a copy.
- **`size`** reflects the current count.
- A `max` of `0` stores nothing.

%% nudge
- Which array method removes the *first* item?
- Is it better to check the bound on every push or occasionally? Why?

%% starter
```js
export function createHistory(max) {
  const items = [];
  return {
    push(item) {
      // Step 1 — add the item to the end:   items.push(item)
      // Step 2 — while there are more than `max`, drop the OLDEST:   items.shift()
    },
    toArray() {
      // Step 3 — return a COPY:   [...items]
      return [];
    },
    get size() {
      return 0;
    },
  };
}
```

%% tests
```js
describe('createHistory', () => {
  it('keeps everything while under the cap', () => {
    const h = createHistory(3);
    h.push('a'); h.push('b');
    expect(h.toArray()).toEqual(['a', 'b']);
    expect(h.size).toBe(2);
  });

  it('drops the oldest beyond the cap', () => {
    const h = createHistory(3);
    [1, 2, 3, 4, 5].forEach((n) => h.push(n));
    expect(h.toArray()).toEqual([3, 4, 5]);
    expect(h.size).toBe(3);
  });

  it('returns a copy', () => {
    const h = createHistory(2);
    h.push('x');
    h.toArray().push('hack');
    expect(h.toArray()).toEqual(['x']);
  });

  it('never grows without bound', () => {
    const h = createHistory(100);
    for (let i = 0; i < 100000; i++) h.push(i);
    expect(h.size).toBe(100);
    expect(h.toArray()[0]).toBe(99900);
  });

  it('a cap of 0 stores nothing', () => {
    const h = createHistory(0);
    h.push(1);
    expect(h.size).toBe(0);
  });
});
```

%% hints
- `items.push(item); while (items.length > max) items.shift();`
- `toArray() { return [...items]; }` and `get size() { return items.length; }`

%% solution
```js
export function createHistory(max) {
  const items = [];
  return {
    push(item) {
      items.push(item);
      while (items.length > max) items.shift();
    },
    toArray() {
      return [...items];
    },
    get size() {
      return items.length;
    },
  };
}
```

%% exercise prod-leaky-client | Fix the leaky feed client | 3 | js | js | createFeedClient | 30
`createFeedClient(socket, options)` wraps a feed socket. It works — and leaks. The starter has **four** leaks; fix them all without changing the public behaviour.

Required behaviour:
- Every incoming message (`JSON` with a `marketId`) is recorded in history, stored as the latest per market, and delivered to subscribers.
- `getHistory()` returns the **most recent `maxHistory`** messages (default 100), oldest first. It must be **bounded**.
- `getLatest(marketId)` returns the latest message for that market. The latest-per-market map is **bounded to `maxMarkets`** (default 1 000): when full, the **least recently updated** market is evicted.
- `subscribe(listener)` returns an **unsubscribe** function. Subscribing the same function twice registers it once. A listener that throws must not stop other listeners from receiving the message.
- The client pings the server (`socket.send('ping')`) every `pingIntervalMs` (default 1 000).
- `dispose()` (idempotent) removes the socket listener, stops the ping timer, drops all subscribers, and clears history and latest. Afterwards incoming messages are ignored.

%% starter
```js
export function createFeedClient(socket, { maxHistory = 100, maxMarkets = 1000, pingIntervalMs = 1000 } = {}) {
  const history = []; // leak 1: grows forever
  const latest = new Map(); // leak 2: grows forever
  const listeners = new Set();

  socket.addEventListener('message', (e) => {
    // leak 3: this listener is never removed
    const msg = JSON.parse(e.data);
    history.push(msg);
    latest.set(msg.marketId, msg);
    listeners.forEach((l) => l(msg));
  });

  setInterval(() => socket.send('ping'), pingIntervalMs); // leak 4: never cleared

  return {
    subscribe(listener) {
      listeners.add(listener); // no way to unsubscribe
    },
    getHistory: () => history,
    getLatest: (marketId) => latest.get(marketId),
    dispose() {},
  };
}
```

%% tests
```js
function setup(options) {
  jest.useFakeTimers();
  const socket = createFakeSocket('wss://feed');
  socket.open();
  const client = createFeedClient(socket, options);
  return { socket, client };
}
const send = (socket, marketId, n = 0) => socket.receive({ marketId, n });

describe('createFeedClient — behaviour', () => {
  it('records history oldest-first and exposes the latest per market', () => {
    const { socket, client } = setup();
    send(socket, 'a', 1); send(socket, 'b', 2); send(socket, 'a', 3);
    expect(client.getHistory().map((m) => m.n)).toEqual([1, 2, 3]);
    expect(client.getLatest('a').n).toBe(3);
    expect(client.getLatest('b').n).toBe(2);
    expect(client.getLatest('zzz')).toBeUndefined();
  });

  it('delivers messages to subscribers and supports unsubscribe', () => {
    const { socket, client } = setup();
    const l = jest.fn();
    const off = client.subscribe(l);
    send(socket, 'a', 1);
    off();
    send(socket, 'a', 2);
    expect(l).toHaveBeenCalledTimes(1);
    expect(l.mock.calls[0][0].n).toBe(1);
  });

  it('registers the same listener once', () => {
    const { socket, client } = setup();
    const l = jest.fn();
    client.subscribe(l); client.subscribe(l);
    send(socket, 'a');
    expect(l).toHaveBeenCalledTimes(1);
  });

  it('a throwing listener does not stop the others', () => {
    const { socket, client } = setup();
    const good = jest.fn();
    client.subscribe(() => { throw new Error('bad listener'); });
    client.subscribe(good);
    expect(() => send(socket, 'a')).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('pings on an interval', () => {
    const { socket } = setup({ pingIntervalMs: 500 });
    jest.advanceTimersByTime(1600);
    expect(socket.sent).toEqual(['ping', 'ping', 'ping']);
  });
});

describe('createFeedClient — leaks', () => {
  it('bounds history to maxHistory, keeping the most recent', () => {
    const { socket, client } = setup({ maxHistory: 50 });
    for (let i = 0; i < 10000; i++) send(socket, `m${i % 10}`, i);
    const h = client.getHistory();
    expect(h).toHaveLength(50);
    expect(h[0].n).toBe(9950);
    expect(h[49].n).toBe(9999);
  });

  it('bounds the latest-per-market map, evicting the least recently updated', () => {
    const { socket, client } = setup({ maxMarkets: 100 });
    for (let i = 0; i < 100; i++) send(socket, `m${i}`, i);
    send(socket, 'm0', 999); // m0 becomes the freshest
    send(socket, 'm100', 100); // over capacity → evict m1 (the stalest)
    expect(client.getLatest('m1')).toBeUndefined();
    expect(client.getLatest('m0').n).toBe(999);
    expect(client.getLatest('m100').n).toBe(100);
    for (let i = 101; i < 5000; i++) send(socket, `m${i}`, i);
    let present = 0;
    for (let i = 0; i < 5000; i++) if (client.getLatest(`m${i}`)) present++;
    expect(present).toBe(100);
  });

  it('getHistory returns a snapshot, not the internal array', () => {
    const { socket, client } = setup();
    send(socket, 'a', 1);
    const h = client.getHistory();
    h.push({ marketId: 'x', n: 99 });
    expect(client.getHistory()).toHaveLength(1);
  });

  it('dispose() removes the socket listener and stops the ping timer', () => {
    const { socket, client } = setup();
    expect(socket.listenerCount()).toBe(1);
    expect(jest.getTimerCount()).toBe(1);
    client.dispose();
    expect(socket.listenerCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('dispose() drops subscribers and clears stored data', () => {
    const { socket, client } = setup();
    const l = jest.fn();
    client.subscribe(l);
    send(socket, 'a', 1);
    client.dispose();
    send(socket, 'a', 2);
    expect(l).toHaveBeenCalledTimes(1);
    expect(client.getHistory()).toEqual([]);
    expect(client.getLatest('a')).toBeUndefined();
  });

  it('dispose() is idempotent', () => {
    const { client } = setup();
    client.dispose();
    expect(() => client.dispose()).not.toThrow();
  });

  it('does not accumulate socket listeners across many create/dispose cycles', () => {
    jest.useFakeTimers();
    const socket = createFakeSocket('wss://feed');
    socket.open();
    for (let i = 0; i < 200; i++) createFeedClient(socket).dispose();
    expect(socket.listenerCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('ignores malformed frames without crashing', () => {
    const { socket, client } = setup();
    expect(() => socket.receive('not json')).not.toThrow();
    send(socket, 'a', 1);
    expect(client.getHistory()).toHaveLength(1);
  });
});
```

%% worked
**A similar problem, solved: a leaky ticker, and its four fixes.**

```js
// LEAKY version
function createTicker(socket) {
  const all = [];                                   // leak 1: grows forever
  socket.addEventListener('message', (e) => all.push(e.data));   // leak 2: listener never removed
  setInterval(() => socket.send('ping'), 1000);      // leak 3: timer never cleared
  return { all };
}

// FIXED version
function createTicker(socket, { max = 100 } = {}) {
  const items = [];
  const onMessage = (e) => { items.push(e.data); while (items.length > max) items.shift(); };   // fix 1: BOUND
  socket.addEventListener('message', onMessage);       // a NAMED function, so it can be removed later
  const timer = setInterval(() => socket.send('ping'), 1000);   // keep the id

  let disposed = false;
  return {
    items: () => [...items],
    dispose() {
      if (disposed) return;                            // idempotent: calling twice is harmless
      disposed = true;
      socket.removeEventListener('message', onMessage);   // fix 2
      clearInterval(timer);                            // fix 3
      items.length = 0;                                // fix 4: drop what we hold
    },
  };
}
```

Use that as a checklist for the exercise's four leaks — look for: something that only **grows**, something **registered** but never removed, a **timer** without `clearInterval`, and subscriber data that is never dropped. The other requirements are behaviour: `maxMarkets` eviction of the least recently **updated** market (delete-then-set on a `Map`), unsubscribe functions that work, **a throwing listener must not stop the others** (`try/catch` around each call), and ignoring messages after `dispose()`.

%% explain
- **Bounded history**: `getHistory()` returns the most recent `maxHistory` messages (default 100), oldest first.
- **Bounded latest map**: at most `maxMarkets` (default 1000); the least recently *updated* market is evicted when full.
- **`subscribe`** returns an unsubscribe; the same function twice registers once; a throwing listener doesn't block the others.
- **Ping** every `pingIntervalMs` via `socket.send('ping')`.
- **`dispose()`** (idempotent) removes the socket listener, stops the timer, drops subscribers, clears history/latest; later messages are ignored.

%% nudge
- Which of the four leaks is "something only grows", and which are "registered but never released"?
- How can `dispose()` call the *same* function `removeEventListener` needs?

%% hints
- History: after `push`, `if (history.length > maxHistory) history.shift()`. Return `[...history]` from `getHistory`.
- Latest map: **delete then set** to move a key to the end (Map keeps insertion order), then `if (latest.size > maxMarkets) latest.delete(latest.keys().next().value)`.
- Keep a reference to the handler so `dispose()` can `removeEventListener` the same function, and keep the interval id to `clearInterval`.
- Wrap each `listener(msg)` in `try/catch`. A `disposed` flag makes late messages a no-op.

%% solution
```js
export function createFeedClient(socket, { maxHistory = 100, maxMarkets = 1000, pingIntervalMs = 1000 } = {}) {
  let history = [];
  const latest = new Map();
  const listeners = new Set();
  let disposed = false;

  const onMessage = (e) => {
    if (disposed) return;
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    history.push(msg);
    if (history.length > maxHistory) history.shift();

    latest.delete(msg.marketId);
    latest.set(msg.marketId, msg);
    if (latest.size > maxMarkets) latest.delete(latest.keys().next().value);

    for (const l of [...listeners]) {
      try {
        l(msg);
      } catch {
        /* one bad listener must not break the others */
      }
    }
  };

  socket.addEventListener('message', onMessage);
  const pingTimer = setInterval(() => socket.send('ping'), pingIntervalMs);

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getHistory: () => [...history],
    getLatest: (marketId) => latest.get(marketId),
    dispose() {
      if (disposed) return;
      disposed = true;
      socket.removeEventListener('message', onMessage);
      clearInterval(pingTimer);
      listeners.clear();
      latest.clear();
      history = [];
    },
  };
}
```

%% exercise prod-leaky-component | Fix the leaky live-score component | 2 | tsx | react | LiveScore | 25
`LiveScore` shows a match's live score and a match clock. It opens a socket per mount and leaks like a sieve. Fix it.

- `createSocket(matchId)` returns a socket (`addEventListener`, `removeEventListener`, `close`). Score messages are JSON `{ home, away }`; render `Score: 2–1` (en dash) — initially `Score: 0–0`.
- A `role="timer"` element shows elapsed seconds since mount (`Clock: 12s`), ticking every second.
- The component also tracks the window width (`Width: 1024`) via `resize`.
- When `matchId` changes, the **old socket is closed and its listener removed before** the new one is opened; the score resets to `0–0`.
- On unmount **everything** is released: socket closed and unsubscribed, interval cleared, resize listener removed. Mounting and unmounting 100 times must leave **nothing** behind.

%% starter
```tsx
import { useEffect, useState } from 'react';

export interface SocketLike {
  addEventListener(type: 'message', l: (e: { data: string }) => void): void;
  removeEventListener(type: 'message', l: (e: { data: string }) => void): void;
  close(): void;
}

export function LiveScore({ matchId, createSocket }: { matchId: string; createSocket: (matchId: string) => SocketLike }) {
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [seconds, setSeconds] = useState(0);
  const [width, setWidth] = useState(window.innerWidth);

  // Everything below leaks.
  useEffect(() => {
    const socket = createSocket(matchId);
    socket.addEventListener('message', (e) => setScore(JSON.parse(e.data)));
  }, [matchId]);

  useEffect(() => {
    setInterval(() => setSeconds((s) => s + 1), 1000);
  }, []);

  useEffect(() => {
    window.addEventListener('resize', () => setWidth(window.innerWidth));
  }, []);

  return (
    <div>
      <p>Score: {score.home}–{score.away}</p>
      <p role="timer">Clock: {seconds}s</p>
      <p>Width: {width}</p>
    </div>
  );
}
```

%% tests
```tsx
function makeSockets() {
  const sockets: any[] = [];
  const createSocket = (id: string) => {
    const s = createFakeSocket(`wss://match/${id}`);
    s.open();
    const originalClose = s.close.bind(s);
    s.close = () => { originalClose(); };
    sockets.push(s);
    return s as any;
  };
  return { sockets, createSocket };
}
const openSockets = (sockets: any[]) => sockets.filter((s) => s.readyState !== 3);

describe('LiveScore', () => {
  beforeEach(() => jest.useFakeTimers());

  it('renders the initial state', () => {
    const { createSocket } = makeSockets();
    render(<LiveScore matchId="m1" createSocket={createSocket} />);
    expect(screen.getByText('Score: 0–0')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('Clock: 0s');
  });

  it('updates the score from socket messages', () => {
    const { sockets, createSocket } = makeSockets();
    render(<LiveScore matchId="m1" createSocket={createSocket} />);
    act(() => sockets[0].receive({ home: 2, away: 1 }));
    expect(screen.getByText('Score: 2–1')).toBeInTheDocument();
  });

  it('ticks the clock every second', () => {
    const { createSocket } = makeSockets();
    render(<LiveScore matchId="m1" createSocket={createSocket} />);
    act(() => { jest.advanceTimersByTime(3000); });
    expect(screen.getByRole('timer')).toHaveTextContent('Clock: 3s');
  });

  it('tracks the window width', () => {
    (window as any).innerWidth = 800;
    const { createSocket } = makeSockets();
    render(<LiveScore matchId="m1" createSocket={createSocket} />);
    expect(screen.getByText('Width: 800')).toBeInTheDocument();
    (window as any).innerWidth = 500;
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(screen.getByText('Width: 500')).toBeInTheDocument();
  });

  it('closes the socket and removes its listener on unmount', () => {
    const { sockets, createSocket } = makeSockets();
    const { unmount } = render(<LiveScore matchId="m1" createSocket={createSocket} />);
    expect(sockets[0].listenerCount()).toBe(1);
    unmount();
    expect(sockets[0].readyState).toBe(3);
    expect(sockets[0].listenerCount()).toBe(0);
  });

  it('clears the interval on unmount', () => {
    const { createSocket } = makeSockets();
    const { unmount } = render(<LiveScore matchId="m1" createSocket={createSocket} />);
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('removes the resize listener on unmount', () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const { createSocket } = makeSockets();
    const { unmount } = render(<LiveScore matchId="m1" createSocket={createSocket} />);
    const handler = add.mock.calls.find((c) => c[0] === 'resize')![1];
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', handler);
  });

  it('swaps sockets cleanly when matchId changes, and resets the score', () => {
    const { sockets, createSocket } = makeSockets();
    const { rerender } = render(<LiveScore matchId="m1" createSocket={createSocket} />);
    act(() => sockets[0].receive({ home: 3, away: 0 }));
    rerender(<LiveScore matchId="m2" createSocket={createSocket} />);
    expect(sockets).toHaveLength(2);
    expect(sockets[0].readyState).toBe(3);
    expect(sockets[0].listenerCount()).toBe(0);
    expect(sockets[1].listenerCount()).toBe(1);
    expect(screen.getByText('Score: 0–0')).toBeInTheDocument();
    act(() => sockets[0].receive({ home: 9, away: 9 })); // stale socket must be ignored
    expect(screen.getByText('Score: 0–0')).toBeInTheDocument();
    act(() => sockets[1].receive({ home: 1, away: 0 }));
    expect(screen.getByText('Score: 1–0')).toBeInTheDocument();
  });

  it('leaves nothing behind after 100 mount/unmount cycles', () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const { sockets, createSocket } = makeSockets();
    for (let i = 0; i < 100; i++) {
      const { unmount } = render(<LiveScore matchId={`m${i}`} createSocket={createSocket} />);
      unmount();
    }
    expect(openSockets(sockets)).toHaveLength(0);
    expect(sockets.every((s) => s.listenerCount() === 0)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    const adds = add.mock.calls.filter((c) => c[0] === 'resize').length;
    const removes = remove.mock.calls.filter((c) => c[0] === 'resize').length;
    expect(adds).toBe(removes);
  });
});
```

%% worked
**A similar problem, solved: a leaky clock component and its cleanups.**

```tsx
// LEAKY
function Clock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setInterval(() => setNow(Date.now()), 1000);     // never cleared
    window.addEventListener('resize', onResize);     // never removed
  });                                                // and there's no dependency array → re-acquired on EVERY render!
  return <p>{now}</p>;
}

// FIXED
function Clock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onResize = () => { /* … */ };
    window.addEventListener('resize', onResize);
    return () => {                                   // one cleanup releases EVERYTHING acquired above
      clearInterval(id);
      window.removeEventListener('resize', onResize);
    };
  }, []);                                            // acquire once per mount
  return <p>{now}</p>;
}
```

Three bugs in one: no cleanup, no dependency array (so it re-runs and re-acquires every render), and an **anonymous** function that can't be removed. In the exercise each resource has its own lifetime: the **socket** depends on `matchId` (effect with `[matchId]` — the cleanup of the old effect closes the old socket and removes its listener *before* the new effect opens the next one, and resets the score), the **interval** and the **resize listener** live for the whole mount (`[]`). Don't forget to check the score message shape and keep the en dash in `Score: 2–1`.

%% explain
- **Score** `Score: 0–0` initially (en dash), updated from socket JSON `{ home, away }`.
- **Clock**: `role="timer"` `Clock: 12s`, ticking each second since mount. **Width**: `Width: 1024` via `resize`.
- **`matchId` change**: the old socket is closed and its listener removed **before** the new one opens; score resets.
- **Unmount** releases *everything*: socket closed and unsubscribed, interval cleared, resize listener removed. 100 mount/unmount cycles leave nothing behind.

%% nudge
- Which resources live as long as the component, and which live as long as one `matchId`?
- What does the cleanup need a reference to in order to remove a listener?

%% hints
- Each `useEffect` that acquires something must `return` its release function.
- Socket effect: keep the handler in a variable so the cleanup removes *that* function, then `socket.close()`. Reset the score at the start of the effect (`setScore({ home: 0, away: 0 })`).
- Interval effect: `const id = setInterval(...); return () => clearInterval(id);`.
- Resize effect: define `onResize` inside the effect and remove it in the cleanup.

%% solution
```tsx
import { useEffect, useState } from 'react';

export interface SocketLike {
  addEventListener(type: 'message', l: (e: { data: string }) => void): void;
  removeEventListener(type: 'message', l: (e: { data: string }) => void): void;
  close(): void;
}

export function LiveScore({ matchId, createSocket }: { matchId: string; createSocket: (matchId: string) => SocketLike }) {
  const [score, setScore] = useState({ home: 0, away: 0 });
  const [seconds, setSeconds] = useState(0);
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    setScore({ home: 0, away: 0 });
    const socket = createSocket(matchId);
    const onMessage = (e: { data: string }) => setScore(JSON.parse(e.data));
    socket.addEventListener('message', onMessage);
    return () => {
      socket.removeEventListener('message', onMessage);
      socket.close();
    };
  }, [matchId, createSocket]);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div>
      <p>Score: {score.home}–{score.away}</p>
      <p role="timer">Clock: {seconds}s</p>
      <p>Width: {width}</p>
    </div>
  );
}
```

%% exercise prod-lru-ttl-cache | LRU + TTL cache with stats | 3 | js | js | createCache | 30
The fix for "unbounded cache" is a **bounded** one. Build `createCache({ maxSize, ttlMs, now = () => Date.now(), onEvict })`.

- `set(key, value, { ttlMs } = {})` stores a value. The per-call `ttlMs` overrides the default; `Infinity` means never expires. Storing when the cache is full **evicts the least recently used** entry (reason `'size'`).
- `get(key)` → the value, or `undefined`. A hit marks the entry most recently used. An **expired** entry counts as a miss, is removed on the spot (reason `'expired'`).
- `has(key)` → whether a live entry exists (does **not** change recency, removes it if expired).
- `delete(key)`, `clear()`, `size` (number of stored entries, expired ones included until touched or pruned).
- `prune()` removes every expired entry now (reason `'expired'`) and returns how many were removed.
- `stats()` → `{ hits, misses, evictions, expirations }` where `evictions` counts only size-based removals.
- `onEvict(key, value, reason)` (optional) is called for `'size'` and `'expired'` removals (not for `delete`/`clear`).
- An entry is expired when `now() >= expiresAt`.

%% starter
```js
export function createCache({ maxSize, ttlMs = Infinity, now = () => Date.now(), onEvict } = {}) {
  // your code
}
```

%% tests
```js
function make(options = {}) {
  let t = 0;
  const clock = { now: () => t, tick: (ms) => { t += ms; } };
  const evicted = [];
  const cache = createCache({ maxSize: 3, now: clock.now, onEvict: (k, v, r) => evicted.push([k, v, r]), ...options });
  return { cache, clock, evicted };
}

describe('createCache', () => {
  it('stores and retrieves values', () => {
    const { cache } = make();
    cache.set('a', 1);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('nope')).toBeUndefined();
    expect(cache.has('a')).toBe(true);
    expect(cache.size).toBe(1);
  });

  it('evicts the least recently used entry when full', () => {
    const { cache, evicted } = make();
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    cache.set('d', 4);
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(3);
    expect(evicted).toEqual([['a', 1, 'size']]);
  });

  it('a get refreshes recency', () => {
    const { cache } = make();
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    cache.get('a');
    cache.set('d', 4);
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('has() does not refresh recency', () => {
    const { cache } = make();
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    cache.has('a');
    cache.set('d', 4);
    expect(cache.has('a')).toBe(false);
  });

  it('updating an existing key refreshes it and does not evict', () => {
    const { cache, evicted } = make();
    cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
    cache.set('a', 10);
    expect(evicted).toEqual([]);
    cache.set('d', 4);
    expect(cache.get('a')).toBe(10);
    expect(cache.has('b')).toBe(false);
  });

  it('expires entries after ttlMs', () => {
    const { cache, clock, evicted } = make({ ttlMs: 1000 });
    cache.set('a', 1);
    clock.tick(999);
    expect(cache.get('a')).toBe(1);
    clock.tick(1);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
    expect(evicted).toEqual([['a', 1, 'expired']]);
  });

  it('supports a per-entry ttl override, including Infinity', () => {
    const { cache, clock } = make({ ttlMs: 1000 });
    cache.set('short', 1, { ttlMs: 100 });
    cache.set('forever', 2, { ttlMs: Infinity });
    cache.set('default', 3);
    clock.tick(500);
    expect(cache.has('short')).toBe(false);
    expect(cache.has('default')).toBe(true);
    clock.tick(10000);
    expect(cache.has('default')).toBe(false);
    expect(cache.get('forever')).toBe(2);
  });

  it('has() removes an expired entry', () => {
    const { cache, clock } = make({ ttlMs: 10 });
    cache.set('a', 1);
    clock.tick(10);
    expect(cache.has('a')).toBe(false);
    expect(cache.size).toBe(0);
  });

  it('prune() removes all expired entries and returns the count', () => {
    const { cache, clock, evicted } = make({ ttlMs: 100, maxSize: 10 });
    cache.set('a', 1); cache.set('b', 2);
    clock.tick(50);
    cache.set('c', 3);
    clock.tick(50);
    expect(cache.size).toBe(3);
    expect(cache.prune()).toBe(2);
    expect(cache.size).toBe(1);
    expect(evicted.map((e) => e[2])).toEqual(['expired', 'expired']);
    expect(cache.get('c')).toBe(3);
  });

  it('tracks hits, misses, evictions and expirations', () => {
    const { cache, clock } = make({ ttlMs: 100, maxSize: 2 });
    cache.set('a', 1); cache.set('b', 2);
    cache.get('a'); cache.get('zzz');
    cache.set('c', 3); // evicts b
    clock.tick(100);
    cache.get('a'); // expired → miss
    expect(cache.stats()).toEqual({ hits: 1, misses: 2, evictions: 1, expirations: 1 });
  });

  it('delete and clear do not notify onEvict or count as evictions', () => {
    const { cache, evicted } = make();
    cache.set('a', 1); cache.set('b', 2);
    expect(cache.delete('a')).toBe(true);
    expect(cache.delete('a')).toBe(false);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(evicted).toEqual([]);
    expect(cache.stats().evictions).toBe(0);
  });

  it('never grows beyond maxSize under a flood of keys', () => {
    const { cache } = make({ maxSize: 500 });
    for (let i = 0; i < 100000; i++) cache.set(`k${i}`, i);
    expect(cache.size).toBe(500);
    expect(cache.get('k99999')).toBe(99999);
    expect(cache.get('k0')).toBeUndefined();
  });

  it('caches falsy values', () => {
    const { cache } = make();
    cache.set('zero', 0); cache.set('nul', null); cache.set('undef', undefined);
    expect(cache.get('zero')).toBe(0);
    expect(cache.get('nul')).toBeNull();
    expect(cache.has('undef')).toBe(true);
    expect(cache.stats().hits).toBe(2);
  });
});
```

%% worked
**A similar problem, solved: an LRU with a hit counter** (no TTL yet).

```js
function createLru(max) {
  const map = new Map();                         // insertion order = recency order (oldest first)
  let hits = 0, misses = 0, evictions = 0;

  return {
    get(key) {
      if (!map.has(key)) { misses++; return undefined; }
      hits++;
      const value = map.get(key);
      map.delete(key); map.set(key, value);      // ① "touch": move to the most-recent end
      return value;
    },
    set(key, value) {
      map.delete(key);                           // ② overwrite = also "touch"
      map.set(key, value);
      if (map.size > max) {                      // ③ over the cap → evict the LEAST recent (first key)
        map.delete(map.keys().next().value);
        evictions++;
      }
    },
    stats: () => ({ hits, misses, evictions }),
  };
}
```

What TTL adds: store `{ value, expiresAt }` per entry (`expiresAt = now() + ttl`, or `Infinity`). On `get`/`has`, if `now() >= expiresAt` treat it as a **miss**, **delete it** and count an **expiration** (call `onEvict(key, value, 'expired')`). `has` must **not** change recency. `prune()` walks the map and removes expired entries, returning how many. Count `evictions` only for **size**-based removals, and call `onEvict` for `'size'` and `'expired'` but not for `delete`/`clear`. Make `now` injectable so tests can move the clock.

%% explain
- **`set(key, value, { ttlMs })`**: per-call TTL overrides the default (`Infinity` = never); when full, evicts the **least recently used** (reason `'size'`).
- **`get`**: hit marks most-recent; an **expired** entry is a miss and is removed (reason `'expired'`).
- **`has`** reports a live entry without changing recency (and removes it if expired).
- **`delete`, `clear`, `size`, `prune()`** (returns how many expired were removed).
- **`stats()`** → `{ hits, misses, evictions, expirations }`; `evictions` counts size-based removals only.
- **`onEvict(key, value, reason)`** for `'size'` and `'expired'` only. Expired means `now() >= expiresAt`.

%% nudge
- How can a `Map` give you "least recently used" for free?
- Which operations should count as "use" (change recency), and which shouldn't?

%% hints
- A `Map<key, { value, expiresAt }>` whose iteration order *is* the recency order: delete + re-set on touch, and the first key is the LRU one.
- One `remove(key, reason)` helper that deletes and updates the right counter/callback keeps `get`, `has`, `set` and `prune` consistent.
- `expiresAt = now() + (options.ttlMs ?? ttlMs)`; `Infinity` works naturally.
- `get` on an expired entry: `remove(key, 'expired')` then count a **miss**.

%% solution
```js
export function createCache({ maxSize, ttlMs = Infinity, now = () => Date.now(), onEvict } = {}) {
  const map = new Map();
  const counters = { hits: 0, misses: 0, evictions: 0, expirations: 0 };

  const isExpired = (entry) => now() >= entry.expiresAt;

  function remove(key, reason) {
    const entry = map.get(key);
    map.delete(key);
    if (reason === 'size') counters.evictions++;
    if (reason === 'expired') counters.expirations++;
    if (reason && entry) onEvict?.(key, entry.value, reason);
  }

  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) {
        counters.misses++;
        return undefined;
      }
      if (isExpired(entry)) {
        remove(key, 'expired');
        counters.misses++;
        return undefined;
      }
      counters.hits++;
      map.delete(key);
      map.set(key, entry);
      return entry.value;
    },
    set(key, value, options = {}) {
      const ttl = options.ttlMs ?? ttlMs;
      if (map.has(key)) map.delete(key);
      map.set(key, { value, expiresAt: now() + ttl });
      if (maxSize !== undefined && map.size > maxSize) remove(map.keys().next().value, 'size');
    },
    has(key) {
      const entry = map.get(key);
      if (!entry) return false;
      if (isExpired(entry)) {
        remove(key, 'expired');
        return false;
      }
      return true;
    },
    delete: (key) => map.delete(key),
    clear: () => map.clear(),
    prune() {
      let removed = 0;
      for (const [key, entry] of [...map]) {
        if (isExpired(entry)) {
          remove(key, 'expired');
          removed++;
        }
      }
      return removed;
    },
    stats: () => ({ ...counters }),
    get size() {
      return map.size;
    },
  };
}
```
