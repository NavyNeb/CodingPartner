---
id: prod-memory
track: prod
title: Case study: the tab that ate 2 GB
summary: Traders leave the app open all day. By mid-afternoon it's slow, then it crashes. Find the leaks — unbounded history, forgotten listeners, immortal timers — and bound everything.
---

> **INCIDENT — "The app gets slower all day."** Traders keep the odds board open from 08:00. By 15:00 scrolling stutters, by 17:00 Chrome shows "Aw, Snap!". Refreshing "fixes" it.
>
> **What the memory timeline shows:** JS heap climbs in a staircase (one step per update burst) and **never comes back down after GC**. DOM node count and *event listener count* both grow steadily. Heap snapshot: 480 000 retained `Message` objects, 3 800 detached `<tr>` elements, 900 live `WebSocket` objects.

## A leak in a GC language

JavaScript frees memory that is **unreachable**. A leak is memory that's *still reachable* but *no longer useful* — something forgot to let go. The usual suspects, roughly by frequency:

1. **Unbounded collections** — `history.push(msg)` forever; a `Map` cache keyed by ids that only grows; a log/undo stack with no cap.
2. **Listeners never removed** — `window.addEventListener`, `socket.addEventListener`, store subscriptions, `MutationObserver`/`IntersectionObserver` never `disconnect()`-ed. Each holds its callback (and everything the callback closes over) alive.
3. **Timers that outlive their owner** — `setInterval` without `clearInterval` keeps running *and* keeps its closure alive.
4. **Closures over big data** — a small long-lived callback that captured a huge array/DOM tree in its scope.
5. **Detached DOM** — nodes removed from the document but still referenced from JS (a cache, a ref, a closure).
6. **Per-mount resources not torn down** — a new socket/worker per component mount with no `close()`/`terminate()`. (900 live WebSockets!)
7. **Module-level state** — globals and singletons that accumulate across route changes.

In React, almost all of these are **effects without cleanup** or **caches without eviction**.

## The rule that prevents most of them

> **Every acquisition needs a matching release tied to an owner's lifetime, and every collection needs a bound.**

- Acquire in an effect → return the cleanup. `addEventListener`/`removeEventListener`, `setInterval`/`clearInterval`, `subscribe`/`unsubscribe`, `new Socket`/`close`, `observe`/`disconnect`, `fetch`+`AbortController`.
- Give long-lived objects a `dispose()` that is **idempotent** and releases *everything*.
- **Bound** caches and histories: ring buffer (cap N), **LRU** (evict least recently used), **TTL** (evict old), or both. Decide the bound from a memory budget, not from "it'll be fine".
- Prefer **`AbortSignal`** as a single lifetime token: pass one signal to `fetch`, `addEventListener(..., { signal })`, and your own APIs; abort once to release all.
- `WeakMap`/`WeakSet`/`WeakRef` let the GC reclaim keys/values — useful for *metadata attached to objects you don't own*, but they don't fix "I forgot to unsubscribe".

## Finding leaks

- **Chrome DevTools → Memory:**
  - *Heap snapshot* ×3 with a "do the action, force GC" between them; compare (**3-snapshot technique**): what was allocated in between and is still alive?
  - *Allocation instrumentation on timeline* — blue bars that never turn grey are leaked.
  - Filter "Detached" for orphaned DOM.
- **Performance monitor:** live JS heap, DOM nodes, **JS event listeners**, documents. A rising listener count is a leak with a name.
- **In production:** sample `performance.memory` (Chromium) / `measureUserAgentSpecificMemory()`, alert on growth-per-hour; run **soak tests** (mount/unmount 1 000 times; replay a busy hour) in CI.
- **In unit tests:** you can't see the heap, but you *can* assert the **evidence**: after `dispose()`/unmount, `socket.listenerCount() === 0`, `jest.getTimerCount() === 0`, history length ≤ cap. That's what the exercises here do.

## Interview angles

- "How would you find a memory leak in production?" → measure, snapshot diff, find the retainer path.
- "What's the difference between a memory leak and high memory use?" → reachable-but-useless vs. legitimately large.
- "Why does an un-cleared `setInterval` leak even if the component unmounted?" → the timer table holds the callback strongly; closure keeps state/props alive.
- "When would you use `WeakRef`?" → caches keyed by objects you don't control; almost never as the primary fix.

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
