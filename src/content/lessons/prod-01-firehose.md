---
id: prod-firehose
track: prod
title: Case study: the odds firehose
summary: A live feed sends 500 updates a second and the whole page freezes. Learn to coalesce updates, render at most once per frame, and re-render only the rows that changed.
---

> **INCIDENT — Saturday 15:02, in-play football.** The trading desk reports the site is "frozen" during the second half. Customers can't tap markets; some see odds that are 20 seconds old. Support tickets spike.
>
> **What monitoring shows:** WebSocket traffic ≈ **500 messages/s** across ~2 000 live markets. Main-thread CPU pinned at 100%. Interaction to Next Paint (INP) p75 = **1.9 s**. React Profiler: hundreds of commits per second, every row rendering every time.

## The idea in one sentence

If data arrives **faster than anyone can see it**, don't render every update — **keep only the latest value and draw once per frame**.

> **Analogy** A sports scoreboard operator hears the referee shout the score 30 times in a second. They don't repaint the board 30 times — they glance up once, and write the **latest** score. The fans only ever needed the latest.

## Why it happens

The naïve client does the obvious thing:

```tsx
socket.onmessage = (e) => {
  const { marketId, odds } = JSON.parse(e.data);
  setOdds((prev) => ({ ...prev, [marketId]: odds }));   // one state update per message
};
```

Three problems stack up:

1. **Every WebSocket message is its own task.** React 18 batches updates *inside* one task (a click handler, a promise chain). But 500 separate tasks a second means ~500 renders a second. The browser has a **16 ms frame budget** (for 60 frames/second); rendering thousands of rows blows through it, and taps queue up behind rendering. That queue **is** your INP (Interaction to Next Paint — how long the page takes to respond after a tap).
2. **Most updates are obsolete before anyone could see them.** Market 42 changes price 30 times in a second; the screen refreshes at most 60 times a second. A human sees the latest one.
3. **Every row re-renders for every change.** If the parent holds all odds in one object, a change to market 7 re-renders rows 1–2 000.

![Naive: one render per message. Coalesced: one buffered update per frame](fig:firehose-flow "Drop the old values nobody could have seen, and flush once per frame.")

## The three fixes, in order of impact

### Fix 1 — Coalesce: last write wins, per key

Keep a `Map` from market id to its latest odds. A new message for the same market **replaces** the pending value:

```js try
const pending = new Map();
let received = 0;

function push(key, value) {
  received++;
  pending.set(key, value);          // same key → replaces the old value; its position in the Map stays
}

// 500 messages for just 3 markets:
for (let i = 0; i < 500; i++) push('m' + (i % 3), 1 + i / 100);

console.log('received:', received, '| distinct values to draw:', pending.size);
console.log([...pending]);
```

500 messages became **3 values**. The information you threw away was never going to be seen anyway.

### Fix 2 — Flush on a frame boundary

Apply the whole batch in **one** state update, at most once per frame (in a browser: `requestAnimationFrame`; in tests or Node: a ~16 ms `setTimeout`).

> **Watch out** This is a **fixed window** that opens at the *first* message. It is **not a debounce**. A debounce restarts its timer on every message — and while a feed keeps talking, it would *never* fire, starving the UI for as long as the firehose runs.

![Five messages inside one 16ms window produce a single flush with the latest value per key](fig:coalesce-window "The first push opens the window; further pushes do not extend it.")

```stepper One buffer window, step by step
code:
  push('m7', 2.0);
  push('m9', 1.5);
  push('m7', 2.1);
  // ...16ms after the FIRST push...
  flush();  // onFlush(Map { m7 → 2.1, m9 → 1.5 }, { received: 3 })
---
line: 1
say: The **first** push after a flush opens a window: a timer for 16 ms is started. The value is stored.
Buffer (latest per key): m7 = 2.0
Timer: running (16ms)
Pushes received: 1
---
line: 2
say: A different key goes into the buffer too. The timer is **not** restarted.
Buffer (latest per key): m7 = 2.0 | m9 = 1.5
Timer: running (16ms)
Pushes received: 2
---
line: 3
say: Same key as before: the new value **replaces** `m7`'s pending one (last write wins). Still the same timer.
Buffer (latest per key): m7 = 2.1 | m9 = 1.5
Timer: running (16ms)
Pushes received: 3
---
line: 5
say: The window ends. **One** flush delivers the latest values and reports `received: 3` so you can measure how much was coalesced. The buffer is now empty, ready for the next window.
Buffer (latest per key):
Timer: stopped
Pushes received: 0
```

### Fix 3 — Subscribe by slice

Even one update per frame re-renders every row if they all read one big object. Put the data in an **external store** and let each row subscribe to *only its own value*, using React's `useSyncExternalStore(subscribe, () => selector(getState()))`. React compares the *selected* value with `Object.is` and skips the render if it's the same. Add `memo` to the row so the parent list doesn't cascade renders.

![One store, but only the row whose value changed re-renders](fig:slice-subscribe "Rows subscribe to slices of the store, not the whole thing.")

Try it: click the buttons and read the console. Only the row you change logs a render:

```tsx try
import { memo, useSyncExternalStore } from 'react';

// A tiny external store
let odds: Record<string, number> = { m1: 2.0, m2: 3.5, m3: 1.8 };
const listeners = new Set<() => void>();
const store = {
  getState: () => odds,
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  setOdds(id: string, value: number) { odds = { ...odds, [id]: value }; listeners.forEach((l) => l()); },
};

const Row = memo(function Row({ id }: { id: string }) {
  const value = useSyncExternalStore(store.subscribe, () => store.getState()[id]);  // the slice: ONE market
  console.log('render row', id);
  return <li>{id}: {value.toFixed(2)}</li>;
});

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <ul>{['m1', 'm2', 'm3'].map((id) => <Row key={id} id={id} />)}</ul>
      {['m1', 'm2', 'm3'].map((id) => (
        <button key={id} onClick={() => store.setOdds(id, Math.round(Math.random() * 500) / 100 + 1)}>change {id}</button>
      ))}
    </div>
  );
}
```

## Trade-offs to be able to talk about

- **Coalescing vs queuing.** Coalescing is right for *state* (prices, scores). For *events* (a goal, a bet settled, a chat message) dropping is a **bug** — those must be queued and processed in order.
- **Frame rate vs freshness.** 60 fps is often more than users need; many trading UIs flush at 4–10 Hz. Make the interval a parameter.
- **Immutability cost.** `{ ...prev, ...updates }` is O(n) per flush — fine once per frame, ruinous once per message. At 50 000 keys use a `Map` with a version counter and per-key subscriptions.
- **Backpressure.** If the producer can outrun even the coalesced consumer, shed load (sample, lower-priority markets first) or ask the server to slow down.
- **Measure first.** Chrome's Performance panel (long tasks > 50 ms), React Profiler ("why did this render?"), `performance.mark/measure`, and `PerformanceObserver({ type: 'long-animation-frame' })` in production.

## Test helpers used in this track

Your tests get synthetic infrastructure (no network needed):

- `createFakeSocket(url)` — a WebSocket look-alike. Code sees `addEventListener/onmessage/send/close`; tests drive it with `.open()`, `.receive(obj)`, `.drop()`, `.fail()`, and can read `.sent` and `.listenerCount()`.
- `flushPromises()` — lets pending microtasks settle.
- `jest.useFakeTimers()` for time, as in earlier lessons.

## Quick check

```check
Q: Why do 500 WebSocket messages per second cause ~500 renders per second in the naive client?
A) React can't batch anything
B) Each message is a separate task, and React only batches updates within one task *
C) `JSON.parse` triggers a render
D) Sockets force synchronous rendering
Why: React 18 batches inside a single task. Separate tasks each get their own render.
---
Q: What is wrong with using a debounce to batch feed updates?
A) Debounce is too fast
B) It would batch too many updates
C) It needs a class component
D) The timer restarts on every message, so a constant feed would never fire *
Why: Use a fixed window opened by the first message, so a flush is guaranteed within one interval.
---
Q: When is dropping older updates (coalescing) the WRONG thing to do?
A) For prices that update constantly
B) For events that must all be processed, like a settled bet or a goal *
C) For scores
D) For odds you can't see
Why: Coalescing is for *state* where only the latest matters. Events are facts that must not be lost.
---
Q: What does a selector passed to `useSyncExternalStore` let a row do?
A) Mutate the store
B) Skip subscribing
C) Re-render only when its own slice of the store changes *
D) Fetch data
Why: React compares the selected value with `Object.is`; if it's the same, the component isn't re-rendered.
---
Q: What does a high INP (Interaction to Next Paint) tell you?
A) The page takes a long time to respond after the user taps or types *
B) The server is slow
C) The bundle is large
D) Memory is leaking
Why: INP measures responsiveness: delay between an interaction and the next frame. A busy main thread makes it worse.
```

## Recap

- Data faster than the eye → **don't render every update**.
- **Coalesce** per key (last write wins), **flush once per frame** (a fixed window, *not* a debounce), and **subscribe by slice** so only changed rows render.
- Coalescing is for **state**, never for **events**.
- Make the flush interval a parameter; measure with the Profiler and long-task tooling.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: latest value per key | "Fix 1 — Coalesce": a `Map` and `set` |
| Coalescing update buffer | Fix 1 + Fix 2 and the stepper: a `Map`, a window timer, `flushNow`, `dispose` |
| `useLiveOdds` | The buffer (given) + a `useEffect` with cleanup and safe JSON parsing |
| Re-render only the row that changed | Fix 3: `useSyncExternalStore`, a selector, `memo` |

%% exercise prod-guided-latest | Guided: the latest value per key | 1 | js | js | latestByKey | 5 | guided
Write `latestByKey(messages)`. `messages` is an array of `{ key, value }`. Return a **`Map`** from each key to the **latest** value seen for it. The keys appear in the order they were **first** seen.

```js
latestByKey([{ key: 'm7', value: 2.0 }, { key: 'm9', value: 1.5 }, { key: 'm7', value: 2.1 }]);
// Map { 'm7' → 2.1, 'm9' → 1.5 }
```

This is the heart of the update buffer, without timers.

%% worked
**A similar problem, solved: `countByKey(messages)`** — the same loop, but counting instead of keeping the latest.

```js
function countByKey(messages) {
  const counts = new Map();                              // ① a Map remembers the order keys were first inserted
  for (const { key } of messages) {
    counts.set(key, (counts.get(key) ?? 0) + 1);         // ② read the old value (or 0), write the new one
  }
  return counts;
}
```

For `latestByKey` the body of the loop is even simpler: just `map.set(key, value)`. Setting a key that already exists **replaces its value but keeps its original position** in the Map — which gives you "latest value, first-seen order" for free.

%% explain
- **One entry per key** with the **latest** value.
- **Order** is by each key's first arrival (not by last update).
- **Empty input** gives an empty Map.

%% nudge
- What does `map.set(key, value)` do when `key` is already in the map?
- Do you need an `if` at all?

%% starter
```js
export function latestByKey(messages) {
  // Step 1 — create a Map:  const latest = new Map();
  // Step 2 — loop over the messages and store each one:  latest.set(message.key, message.value)
  //          (a later message for the same key simply REPLACES the earlier value)
  // Step 3 — return the Map.
  return new Map();
}
```

%% tests
```js
describe('latestByKey', () => {
  it('keeps the latest value per key', () => {
    const out = latestByKey([{ key: 'm7', value: 2.0 }, { key: 'm9', value: 1.5 }, { key: 'm7', value: 2.1 }]);
    expect(out.get('m7')).toBe(2.1);
    expect(out.get('m9')).toBe(1.5);
    expect(out.size).toBe(2);
  });

  it('orders keys by first arrival', () => {
    const out = latestByKey([{ key: 'b', value: 1 }, { key: 'a', value: 2 }, { key: 'b', value: 3 }]);
    expect([...out.keys()]).toEqual(['b', 'a']);
  });

  it('handles empty input', () => {
    expect(latestByKey([]).size).toBe(0);
  });

  it('returns a Map', () => {
    expect(latestByKey([{ key: 'x', value: 1 }])).toBeInstanceOf(Map);
  });
});
```

%% hints
- `for (const m of messages) latest.set(m.key, m.value);`

%% solution
```js
export function latestByKey(messages) {
  const latest = new Map();
  for (const message of messages) {
    latest.set(message.key, message.value);
  }
  return latest;
}
```

%% exercise prod-update-buffer | Coalescing update buffer | 3 | js | js | createUpdateBuffer | 20
Build `createUpdateBuffer(onFlush, { intervalMs = 16 } = {})`, the heart of the fix.

Returned object: `{ push(key, value), flushNow(), dispose(), size }`.

- `push(key, value)` stores the value; a later push for the **same key replaces it** (last write wins).
- The **first** push after a flush opens a window: after `intervalMs` the buffer flushes **once**. Further pushes in that window do **not** extend it (this is not a debounce).
- `onFlush(updates, meta)` receives a `Map` of the latest value per key (in order of each key's first arrival) and `meta = { received }`, the number of pushes that were coalesced into it.
- After a flush the buffer is empty; pushes made *during* `onFlush` belong to the next batch.
- `flushNow()` flushes immediately (if anything is pending) and cancels the timer. An empty buffer never calls `onFlush`.
- `dispose()` cancels the timer and **drops** anything pending without flushing.
- `size` is the number of distinct pending keys.

%% starter
```js
export function createUpdateBuffer(onFlush, { intervalMs = 16 } = {}) {
  // your code
}
```

%% tests
```js
describe('createUpdateBuffer', () => {
  beforeEach(() => jest.useFakeTimers());

  it('does not flush synchronously', () => {
    const onFlush = jest.fn();
    createUpdateBuffer(onFlush).push('m1', 1.5);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('flushes once after the interval with the latest value per key', () => {
    const onFlush = jest.fn();
    const buf = createUpdateBuffer(onFlush, { intervalMs: 16 });
    buf.push('m1', 1.5);
    buf.push('m2', 2.0);
    buf.push('m1', 1.7);
    jest.advanceTimersByTime(15);
    expect(onFlush).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onFlush).toHaveBeenCalledTimes(1);
    const [updates, meta] = onFlush.mock.calls[0];
    expect(updates).toBeInstanceOf(Map);
    expect([...updates]).toEqual([['m1', 1.7], ['m2', 2.0]]);
    expect(meta).toEqual({ received: 3 });
  });

  it('uses a fixed window: later pushes do not postpone the flush', () => {
    const onFlush = jest.fn();
    const buf = createUpdateBuffer(onFlush, { intervalMs: 16 });
    buf.push('a', 1);
    jest.advanceTimersByTime(10);
    buf.push('a', 2);
    jest.advanceTimersByTime(6);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush.mock.calls[0][0].get('a')).toBe(2);
  });

  it('starts a fresh window for the next batch', () => {
    const onFlush = jest.fn();
    const buf = createUpdateBuffer(onFlush, { intervalMs: 16 });
    buf.push('a', 1);
    jest.advanceTimersByTime(16);
    buf.push('a', 5);
    jest.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(2);
    expect(onFlush.mock.calls[1][0].get('a')).toBe(5);
    expect(onFlush.mock.calls[1][1]).toEqual({ received: 1 });
  });

  it('survives a 500-message flood: one flush, one entry per market', () => {
    const onFlush = jest.fn();
    const buf = createUpdateBuffer(onFlush);
    for (let i = 0; i < 500; i++) buf.push(`m${i % 100}`, i);
    expect(buf.size).toBe(100);
    jest.advanceTimersByTime(16);
    expect(onFlush).toHaveBeenCalledTimes(1);
    const [updates, meta] = onFlush.mock.calls[0];
    expect(updates.size).toBe(100);
    expect(meta.received).toBe(500);
    expect(updates.get('m0')).toBe(400);
    expect(updates.get('m99')).toBe(499);
    expect(buf.size).toBe(0);
  });

  it('never calls onFlush for an empty buffer', () => {
    const onFlush = jest.fn();
    const buf = createUpdateBuffer(onFlush);
    buf.flushNow();
    jest.advanceTimersByTime(100);
    expect(onFlush).not.toHaveBeenCalled();
  });

  it('flushNow() flushes immediately and cancels the scheduled flush', () => {
    const onFlush = jest.fn();
    const buf = createUpdateBuffer(onFlush);
    buf.push('a', 1);
    buf.flushNow();
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(100);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('dispose() drops pending updates and clears the timer', () => {
    const onFlush = jest.fn();
    const buf = createUpdateBuffer(onFlush);
    buf.push('a', 1);
    buf.dispose();
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(100);
    expect(onFlush).not.toHaveBeenCalled();
    expect(buf.size).toBe(0);
  });

  it('pushes made inside onFlush go into the next batch', () => {
    const seen = [];
    let buf;
    buf = createUpdateBuffer((updates) => {
      seen.push([...updates]);
      if (seen.length === 1) buf.push('b', 2);
    });
    buf.push('a', 1);
    jest.advanceTimersByTime(16);
    expect(seen).toEqual([[['a', 1]]]);
    jest.advanceTimersByTime(16);
    expect(seen).toEqual([[['a', 1]], [['b', 2]]]);
  });

  it('keeps separate buffers separate', () => {
    const a = jest.fn(), b = jest.fn();
    const ba = createUpdateBuffer(a), bb = createUpdateBuffer(b);
    ba.push('x', 1);
    jest.advanceTimersByTime(16);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    bb.dispose();
  });
});
```

%% worked
**A similar problem, solved: `createBatcher(onBatch, ms)`** — collects items for a fixed window, then delivers them all at once. It has the same skeleton as the buffer, without keys or `flushNow`.

```js
function createBatcher(onBatch, ms = 16) {
  let items = [];
  let timer = null;

  function flush() {
    if (timer !== null) { clearTimeout(timer); timer = null; }   // ① always clear the timer when flushing
    if (items.length === 0) return;                               // ② never call onBatch with nothing
    const batch = items;
    items = [];                                                   // ③ reset BEFORE calling out, so pushes made during onBatch join the NEXT batch
    onBatch(batch);
  }

  return {
    push(item) {
      items.push(item);
      if (timer === null) timer = setTimeout(flush, ms);          // ④ only the FIRST push opens the window (not a debounce)
    },
    flush,
    dispose() { if (timer !== null) clearTimeout(timer); timer = null; items = []; },   // ⑤ drop everything silently
  };
}
```

For `createUpdateBuffer`: store a `Map` instead of an array (`pending.set(key, value)` = last write wins, keeping first-arrival order), count `received` pushes, pass `(map, { received })` to `onFlush`, and expose `size` as `pending.size` (a getter).

%% explain
- **`push(key, value)`**: last write wins per key.
- **The first push after a flush opens a window**; further pushes do **not** extend it (not a debounce). After `intervalMs` it flushes once.
- **`onFlush(updates, meta)`**: a `Map` (first-arrival order) and `{ received }`.
- **After a flush** the buffer is empty; pushes made *inside* `onFlush` belong to the next batch.
- **`flushNow()`** flushes immediately (if anything is pending) and cancels the timer; an empty buffer never calls `onFlush`.
- **`dispose()`** cancels the timer and drops pending data without flushing; **`size`** = distinct pending keys.

%% nudge
- When exactly do you start the timer — on every push, or only when none is running?
- In `flush`, what must you reset *before* calling `onFlush`, and why?

%% hints
- State: `pending` (a `Map`), `received` (a counter) and `timer` (`null` when no window is open).
- `push`: `pending.set(key, value); received++; if (timer === null) timer = setTimeout(flush, intervalMs);` — only the *first* push arms the timer.
- `flush`: clear the timer, return if empty, then **swap** in a fresh `Map` *before* calling `onFlush` so re-entrant pushes land in the next batch.
- `flushNow` can simply be `flush` — expose it.

%% solution
```js
export function createUpdateBuffer(onFlush, { intervalMs = 16 } = {}) {
  let pending = new Map();
  let received = 0;
  let timer = null;

  function flush() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    const updates = pending;
    const meta = { received };
    pending = new Map();
    received = 0;
    onFlush(updates, meta);
  }

  return {
    push(key, value) {
      pending.set(key, value);
      received++;
      if (timer === null) timer = setTimeout(flush, intervalMs);
    },
    flushNow: flush,
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = new Map();
      received = 0;
    },
    get size() {
      return pending.size;
    },
  };
}
```

%% exercise prod-live-odds-hook | useLiveOdds: one render per frame | 3 | tsx | react | useLiveOdds | 25
Write the React side: `useLiveOdds(socket, { intervalMs = 16 })` returns a `Record<marketId, odds>`.

Messages arrive as JSON strings on `socket` (`addEventListener('message', …)`): `{ "marketId": "m7", "odds": 2.35 }`.

- Batch them with the buffer below (already written for you) so the hook causes **at most one state update per interval**, however many messages arrive.
- Merge each batch into the existing record immutably.
- **Malformed messages** (bad JSON, missing/incorrectly typed fields) are ignored — the feed must not crash the page.
- Clean up: on unmount (or when `socket` changes) remove the listener **and** dispose the buffer.

%% starter
```tsx
import { useEffect, useState } from 'react';

export interface SocketLike {
  addEventListener(type: 'message', listener: (e: { data: string }) => void): void;
  removeEventListener(type: 'message', listener: (e: { data: string }) => void): void;
}

// Provided: the coalescing buffer from the previous exercise.
function createUpdateBuffer<K, V>(onFlush: (updates: Map<K, V>) => void, intervalMs = 16) {
  let pending = new Map<K, V>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (pending.size === 0) return;
    const updates = pending;
    pending = new Map();
    onFlush(updates);
  };
  return {
    push(key: K, value: V) {
      pending.set(key, value);
      if (timer === null) timer = setTimeout(flush, intervalMs);
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = new Map();
    },
  };
}

// TODO: this naive version re-renders once per message. Fix it.
export function useLiveOdds(socket: SocketLike, { intervalMs = 16 } = {}) {
  const [odds, setOdds] = useState<Record<string, number>>({});

  useEffect(() => {
    const onMessage = (e: { data: string }) => {
      const m = JSON.parse(e.data);
      setOdds((prev) => ({ ...prev, [m.marketId]: m.odds }));
    };
    socket.addEventListener('message', onMessage);
    return () => socket.removeEventListener('message', onMessage);
  }, [socket]);

  return odds;
}
```

%% tests
```tsx
const msg = (marketId: string, odds: number) => ({ marketId, odds });

describe('useLiveOdds', () => {
  beforeEach(() => jest.useFakeTimers());

  function setup(intervalMs?: number) {
    const socket = createFakeSocket('wss://feed.example/odds');
    socket.open();
    let renders = 0;
    const hook = renderHook(() => {
      renders++;
      return useLiveOdds(socket, intervalMs ? { intervalMs } : undefined);
    });
    return { socket, hook, renders: () => renders };
  }

  it('starts empty', () => {
    const { hook } = setup();
    expect(hook.result.current).toEqual({});
  });

  it('applies updates after the interval', () => {
    const { socket, hook } = setup();
    act(() => { socket.receive(msg('m1', 1.5)); });
    expect(hook.result.current).toEqual({});
    act(() => { jest.advanceTimersByTime(16); });
    expect(hook.result.current).toEqual({ m1: 1.5 });
  });

  it('turns a 500-message flood into a single render', () => {
    const { socket, hook, renders } = setup();
    const before = renders();
    act(() => {
      for (let i = 0; i < 500; i++) socket.receive(msg(`m${i % 100}`, 1 + i / 100));
    });
    expect(renders()).toBe(before);
    act(() => { jest.advanceTimersByTime(16); });
    expect(renders()).toBe(before + 1);
    expect(Object.keys(hook.result.current)).toHaveLength(100);
    expect(hook.result.current.m0).toBeCloseTo(1 + 400 / 100);
    expect(hook.result.current.m99).toBeCloseTo(1 + 499 / 100);
  });

  it('merges successive batches without losing earlier markets', () => {
    const { socket, hook } = setup();
    act(() => { socket.receive(msg('a', 1)); jest.advanceTimersByTime(16); });
    act(() => { socket.receive(msg('b', 2)); jest.advanceTimersByTime(16); });
    act(() => { socket.receive(msg('a', 3)); jest.advanceTimersByTime(16); });
    expect(hook.result.current).toEqual({ a: 3, b: 2 });
  });

  it('honours a custom interval', () => {
    const { socket, hook } = setup(100);
    act(() => { socket.receive(msg('a', 1)); jest.advanceTimersByTime(99); });
    expect(hook.result.current).toEqual({});
    act(() => { jest.advanceTimersByTime(1); });
    expect(hook.result.current).toEqual({ a: 1 });
  });

  it('ignores malformed messages', () => {
    const { socket, hook } = setup();
    act(() => {
      socket.receive('not json at all');
      socket.receive('{"marketId": "m1"}');
      socket.receive({ marketId: 5, odds: 2 });
      socket.receive({ marketId: 'm1', odds: '2.0' });
      socket.receive('null');
      socket.receive(msg('ok', 3));
      jest.advanceTimersByTime(16);
    });
    expect(hook.result.current).toEqual({ ok: 3 });
  });

  it('cleans up the listener and pending timer on unmount', () => {
    const { socket, hook } = setup();
    expect(socket.listenerCount()).toBe(1);
    act(() => { socket.receive(msg('a', 1)); });
    hook.unmount();
    expect(socket.listenerCount()).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('re-subscribes when the socket changes', () => {
    const first = createFakeSocket('a'), second = createFakeSocket('b');
    const hook = renderHook(({ s }) => useLiveOdds(s), { initialProps: { s: first as any } });
    hook.rerender({ s: second });
    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
    act(() => { second.receive(msg('x', 9)); jest.advanceTimersByTime(16); });
    expect(hook.result.current).toEqual({ x: 9 });
  });
});
```

%% worked
**A similar problem, solved: `useBufferedMessages(socket)`** — a hook that listens to a socket and collects the messages in batches.

```tsx
import { useEffect, useState } from 'react';

export function useBufferedMessages(socket: WebSocketLike, ms = 16) {
  const [batches, setBatches] = useState(0);

  useEffect(() => {
    let pending = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onMessage = (event: { data: string }) => {
      let parsed: unknown;
      try { parsed = JSON.parse(event.data); } catch { return; }       // ① malformed JSON: ignore, never crash the page
      if (typeof parsed !== 'object' || parsed === null) return;       // ② validate the SHAPE too
      pending += 1;
      if (timer === null) timer = setTimeout(() => {                   // ③ one state update per window
        timer = null;
        setBatches((n) => n + 1);
        pending = 0;
      }, ms);
    };

    socket.addEventListener('message', onMessage);
    return () => {                                                     // ④ cleanup: listener AND timer
      socket.removeEventListener('message', onMessage);
      if (timer !== null) clearTimeout(timer);
    };
  }, [socket, ms]);

  return batches;
}
```

The real hook puts the **buffer** (already written in the starter) between the listener and `setState`: on each valid message call `buffer.push(marketId, odds)`; in `onFlush`, `setOdds((prev) => ({ ...prev, ...Object.fromEntries(updates) }))`. The cleanup must call `buffer.dispose()` **and** remove the listener.

%% explain
- **Returns `Record<marketId, odds>`.**
- **At most one state update per interval**, however many messages arrive (uses the buffer).
- **Batches merge immutably** into the existing record.
- **Malformed messages** (bad JSON, missing/incorrectly typed fields) are ignored.
- **Cleanup**: on unmount or when `socket` changes, remove the listener **and** dispose the buffer.

%% nudge
- Where does a parsed message go — straight to `setState`, or into the buffer first?
- What would leak if the cleanup only removed the listener?

%% hints
- Create the buffer *inside* the effect (so each socket gets its own) with an `onFlush` that does a single `setOdds((prev) => ({ ...prev, ...Object.fromEntries(updates) }))`.
- The message handler parses defensively: `try { … } catch {}` and checks `typeof m?.marketId === 'string' && typeof m.odds === 'number'`.
- Cleanup: `socket.removeEventListener('message', onMessage); buffer.dispose();`.

%% solution
```tsx
import { useEffect, useState } from 'react';

export interface SocketLike {
  addEventListener(type: 'message', listener: (e: { data: string }) => void): void;
  removeEventListener(type: 'message', listener: (e: { data: string }) => void): void;
}

function createUpdateBuffer<K, V>(onFlush: (updates: Map<K, V>) => void, intervalMs = 16) {
  let pending = new Map<K, V>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = () => {
    timer = null;
    if (pending.size === 0) return;
    const updates = pending;
    pending = new Map();
    onFlush(updates);
  };
  return {
    push(key: K, value: V) {
      pending.set(key, value);
      if (timer === null) timer = setTimeout(flush, intervalMs);
    },
    dispose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = new Map();
    },
  };
}

export function useLiveOdds(socket: SocketLike, { intervalMs = 16 } = {}) {
  const [odds, setOdds] = useState<Record<string, number>>({});

  useEffect(() => {
    const buffer = createUpdateBuffer<string, number>((updates) => {
      setOdds((prev) => ({ ...prev, ...Object.fromEntries(updates) }));
    }, intervalMs);

    const onMessage = (e: { data: string }) => {
      try {
        const m = JSON.parse(e.data);
        if (typeof m?.marketId === 'string' && typeof m.odds === 'number') buffer.push(m.marketId, m.odds);
      } catch {
        /* malformed frame: drop it */
      }
    };

    socket.addEventListener('message', onMessage);
    return () => {
      socket.removeEventListener('message', onMessage);
      buffer.dispose();
    };
  }, [socket, intervalMs]);

  return odds;
}
```

%% exercise prod-slice-subscriptions | Re-render only the row that changed | 4 | tsx | react | useStoreSelector, MarketList | 35
The odds now live in an external store. `MarketList` currently subscribes to **all** of it, so one price change re-renders every row.

Fix it with slice subscriptions:

1. Implement `useStoreSelector(store, selector)` using **`useSyncExternalStore`**: it subscribes to the store and returns `selector(store.getState())`, re-rendering the caller **only when the selected value changes** (`Object.is`).
2. Rewrite `MarketList` so it renders `ids` (a fixed list) as **memoised** `Row`s, and each row selects **only its own odds**. `MarketList` itself must not subscribe to the odds.

Each row calls `onRowRender(id)` while rendering (so tests can count renders) and shows `<li>` with the market id and its odds (`m3: 2.5`). Update the store with `store.setOdds(id, value)`.

%% starter
```tsx
import { memo, useSyncExternalStore } from 'react';

export interface OddsState {
  odds: Record<string, number>;
}

export function createOddsStore(initial: Record<string, number>) {
  let state: OddsState = { odds: initial };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOdds(id: string, value: number) {
      state = { odds: { ...state.odds, [id]: value } };
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}
export type OddsStore = ReturnType<typeof createOddsStore>;

// TODO 1: subscribe with useSyncExternalStore
export function useStoreSelector<T>(store: OddsStore, selector: (s: OddsState) => T): T {
  return selector(store.getState());
}

interface Props {
  store: OddsStore;
  ids: string[];
  onRowRender: (id: string) => void;
}

// TODO 2: only the changed row may re-render
export function MarketList({ store, ids, onRowRender }: Props) {
  const state = useStoreSelector(store, (s) => s);
  return (
    <ul>
      {ids.map((id) => {
        onRowRender(id);
        return <li key={id}>{id}: {state.odds[id]}</li>;
      })}
    </ul>
  );
}
```

%% tests
```tsx
const ids = Array.from({ length: 50 }, (_, i) => `m${i}`);
const initial = Object.fromEntries(ids.map((id, i) => [id, 1 + i / 10]));

describe('slice subscriptions', () => {
  it('renders every market with its odds', () => {
    const store = createOddsStore(initial);
    render(<MarketList store={store} ids={ids} onRowRender={() => {}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(50);
    expect(screen.getByText('m3: 1.3')).toBeInTheDocument();
  });

  it('shows updates from the store', () => {
    const store = createOddsStore(initial);
    render(<MarketList store={store} ids={ids} onRowRender={() => {}} />);
    act(() => store.setOdds('m3', 2.5));
    expect(screen.getByText('m3: 2.5')).toBeInTheDocument();
  });

  it('re-renders ONLY the row whose odds changed', () => {
    const store = createOddsStore(initial);
    const onRowRender = jest.fn();
    render(<MarketList store={store} ids={ids} onRowRender={onRowRender} />);
    expect(onRowRender).toHaveBeenCalledTimes(50);
    onRowRender.mockClear();
    act(() => store.setOdds('m7', 9.9));
    expect(onRowRender.mock.calls.map((c) => c[0])).toEqual(['m7']);
  });

  it('does not re-render anything when the value is unchanged', () => {
    const store = createOddsStore(initial);
    const onRowRender = jest.fn();
    render(<MarketList store={store} ids={ids} onRowRender={onRowRender} />);
    onRowRender.mockClear();
    act(() => store.setOdds('m7', initial.m7));
    expect(onRowRender).not.toHaveBeenCalled();
  });

  it('a burst of updates to different markets re-renders each changed row once', () => {
    const store = createOddsStore(initial);
    const onRowRender = jest.fn();
    render(<MarketList store={store} ids={ids} onRowRender={onRowRender} />);
    onRowRender.mockClear();
    act(() => {
      store.setOdds('m1', 5);
      store.setOdds('m2', 6);
      store.setOdds('m1', 7);
    });
    const counts = onRowRender.mock.calls.reduce((acc: Record<string, number>, [id]) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});
    expect(counts).toEqual({ m1: 1, m2: 1 });
    expect(screen.getByText('m1: 7')).toBeInTheDocument();
  });

  it('subscribes once per row and unsubscribes on unmount', () => {
    const store = createOddsStore(initial);
    const { unmount } = render(<MarketList store={store} ids={ids} onRowRender={() => {}} />);
    expect(store.listenerCount()).toBe(50);
    unmount();
    expect(store.listenerCount()).toBe(0);
  });

  it('useStoreSelector returns the selected slice and follows changes', () => {
    const store = createOddsStore({ a: 1, b: 2 });
    const { result } = renderHook(() => useStoreSelector(store, (s) => s.odds.a));
    expect(result.current).toBe(1);
    act(() => store.setOdds('a', 3));
    expect(result.current).toBe(3);
  });

  it('useStoreSelector does not re-render for changes outside its slice', () => {
    const store = createOddsStore({ a: 1, b: 2 });
    let renders = 0;
    renderHook(() => { renders++; return useStoreSelector(store, (s) => s.odds.a); });
    const before = renders;
    act(() => store.setOdds('b', 99));
    expect(renders).toBe(before);
  });

  it('does not log React warnings', () => {
    const spy = jest.spyOn(console, 'error');
    const store = createOddsStore(initial);
    render(<MarketList store={store} ids={ids} onRowRender={() => {}} />);
    act(() => store.setOdds('m2', 4));
    expect(spy).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: a tiny store with a hook that selects one field.**

```tsx
import { useSyncExternalStore } from 'react';

function createCounterStore() {
  let state = { a: 0, b: 0 };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },  // ① subscribe returns an unsubscribe
    bump(key: 'a' | 'b') { state = { ...state, [key]: state[key] + 1 }; listeners.forEach((l) => l()); },  // ② new object → notify
  };
}

function useSelector<T>(store: ReturnType<typeof createCounterStore>, selector: (s: { a: number; b: number }) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
  //     ③ React calls the second function after every notification and compares results with Object.is
}

// const a = useSelector(store, (s) => s.a);   // re-renders ONLY when `a` changes
```

For the exercise: `useStoreSelector(store, selector)` is exactly that. Then `MarketList` should **not** read the odds at all — it only maps over `ids` and renders `<Row key={id} id={id} … />`, where `Row` is wrapped in `memo` and calls `useStoreSelector(store, (s) => s.odds[id])` itself. Make sure the props you pass to `Row` are stable (strings/functions that don't change), or `memo` can't skip.

%% explain
- **`useStoreSelector(store, selector)`** uses `useSyncExternalStore` and returns `selector(store.getState())`; the caller re-renders **only when the selected value changes** (`Object.is`).
- **`MarketList`** renders `ids` as **memoised** `Row`s and does **not** subscribe to the odds.
- **Each `Row`** selects only its own odds, calls `onRowRender(id)` while rendering, and shows `m3: 2.5`.
- **Updating** `store.setOdds('m3', 2.5)` re-renders only row `m3`.

%% nudge
- Which component should call the selector hook: the list or each row?
- What must be true about a memoised row's props for `memo` to skip it?

%% hints
- `useSyncExternalStore(store.subscribe, () => selector(store.getState()))`. The snapshot function must return the **same value** when nothing relevant changed — selecting a number (or any stable reference) satisfies that.
- Give each row its own component: `const Row = memo(function Row({ id, store, onRender }) { const odds = useStoreSelector(store, (s) => s.odds[id]); onRender(id); … })`.
- `MarketList` then just maps `ids` to `<Row key={id} … />` and never touches the odds — so it has no reason to re-render.

%% solution
```tsx
import { memo, useSyncExternalStore } from 'react';

export interface OddsState {
  odds: Record<string, number>;
}

export function createOddsStore(initial: Record<string, number>) {
  let state: OddsState = { odds: initial };
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOdds(id: string, value: number) {
      state = { odds: { ...state.odds, [id]: value } };
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}
export type OddsStore = ReturnType<typeof createOddsStore>;

export function useStoreSelector<T>(store: OddsStore, selector: (s: OddsState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

interface RowProps {
  id: string;
  store: OddsStore;
  onRender: (id: string) => void;
}

const Row = memo(function Row({ id, store, onRender }: RowProps) {
  const odds = useStoreSelector(store, (s) => s.odds[id]);
  onRender(id);
  return (
    <li>
      {id}: {odds}
    </li>
  );
});

interface Props {
  store: OddsStore;
  ids: string[];
  onRowRender: (id: string) => void;
}

export function MarketList({ store, ids, onRowRender }: Props) {
  return (
    <ul>
      {ids.map((id) => (
        <Row key={id} id={id} store={store} onRender={onRowRender} />
      ))}
    </ul>
  );
}
```
