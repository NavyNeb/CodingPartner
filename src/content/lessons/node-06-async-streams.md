---
id: node-async-streams
track: node
title: Async, streams and graceful shutdown
summary: How the Node event loop orders work, EventEmitters, lazy async-iterable pipelines, backpressure with a bounded queue, graceful shutdown, and retrying jobs with backoff.
---

## The idea in one sentence

Node runs your JavaScript on **one thread** and stays fast by never **waiting** on it: slow things (network, disk, timers) are handed off, and their **callbacks** are queued to run later, in a **strict order**.

> **Analogy** One chef with many pots. The chef never stands staring at a pot: they start one, set a timer, and move on. When a timer rings they come back. A promise callback is a sticky note on the chef's hand ("do this the moment you finish the current step"), which always beats the next timer.

*(In NestJS this shows up as `async` handlers, `EventEmitter2` events, `Observable` streams, lifecycle hooks like `onModuleDestroy` and `app.enableShutdownHooks()`. You will build the underlying parts.)*

## The event loop

![The Node event loop](fig:nd-loop "Phases in order; promise microtasks run between every callback.")

Remember two rules: **synchronous code runs to the end first**, then **microtasks** (promise callbacks, `queueMicrotask`; in Node also `process.nextTick`, which goes first), and only then does the loop move to the next phase (timers, I/O, `setImmediate`). So a promise callback **always** runs before a `setTimeout(..., 0)`.

```js try predict
const log = [];

setTimeout(() => log.push('timeout'), 0);
Promise.resolve().then(() => log.push('promise'));
log.push('sync');

new Promise((resolve) => setTimeout(resolve, 5)).then(() => console.log(log.join(' > ')));
```

```stepper Who goes first?
code:
  console.log('A');
  setTimeout(() => console.log('B'), 0);
  Promise.resolve().then(() => console.log('C'));
  console.log('D');
---
line: 1
say: Synchronous code runs immediately: prints **A**.
phase: sync
---
line: 2
say: The timer is **scheduled** for a later loop turn. Nothing prints yet.
phase: timers queue
---
line: 3
say: The promise callback goes into the **microtask queue**. Still nothing printed.
phase: microtask queue
---
line: 4
say: The script finishes its synchronous part: prints **D**.
phase: sync ends
---
line: 3
say: Now the microtask queue is emptied **before anything else**: prints **C**.
phase: microtasks
---
line: 2
say: Only then does the loop reach the timers phase: prints **B**. The order is **A D C B**.
phase: timers phase
```

Heavy synchronous work (a big `JSON.parse`, a tight loop) **blocks everything**: no timers, no requests. Keep the main thread free; push CPU work to a worker thread or another service.

## Events and streams

An **EventEmitter** lets one part announce things (`'connected'`, `'data'`, `'error'`) without knowing who listens. Two gotchas matter: emitting `'error'` **with no listener throws**, and listeners are called **synchronously**, in registration order.

A **stream** is data arriving in **chunks over time**. Modern Node code treats streams as **async iterables**: `for await (const chunk of stream)`. Async generators let you build **lazy pipelines** (`map`, `filter`, `batch`, `take`) where each stage **pulls** one item at a time, so nothing is produced that nobody asked for, and stopping early **closes** everything upstream.

## Backpressure

![Backpressure](fig:nd-backpressure "A bounded queue makes a fast producer wait for a slow consumer.")

If a producer is faster than its consumer and nothing pushes back, the gap becomes **memory**. **Backpressure** is the mechanism that slows the producer: a **bounded queue** whose `push` returns a promise that **only resolves when there is room**. Producers that `await` it are paused automatically.

## Shutting down well

![Graceful shutdown](fig:nd-shutdown "Stop accepting, drain, close in reverse order, exit; force it if it takes too long.")

Deploys, scaling and crashes send your process a **termination signal**. A graceful shutdown **stops taking new work**, **finishes what is in flight**, **closes resources in reverse order** (the server before the database it uses), and **exits**. A **timeout** guards against a closer that never finishes, and one failing closer must **not prevent the others** from running.

## Retrying work

Jobs fail for temporary reasons. A worker **retries** with **backoff** (wait longer after each failure: `100ms, 200ms, 400ms…`, capped), gives up after a maximum number of attempts, and **does not retry** errors that can never succeed (a `400`, a validation failure). Inject `sleep` so tests do not wait.

## Quick check

```check
Q: What is logged? setTimeout(() => log('T'), 0); Promise.resolve().then(() => log('P')); log('S');
A) S T P
B) S P T *
C) P S T
D) T P S
Why: Synchronous code, then microtasks (promises), then the timers phase.
---
Q: What happens if an EventEmitter emits 'error' and nobody is listening?
A) Nothing
B) The error is thrown *
C) It is logged and ignored
D) It is sent to the first listener of any event
Why: Unhandled 'error' events crash the process by design.
---
Q: What does backpressure protect you from?
A) Slow requests
B) Unbounded memory growth when a producer outpaces its consumer *
C) Duplicate events
D) Expired tokens
Why: Without a limit, buffered items accumulate without bound.
---
Q: In what order should shutdown closers run?
A) In registration order
B) In reverse registration order *
C) Alphabetically
D) In parallel, always
Why: What was created last usually depends on what was created first.
```

## Recap

- **Sync first, then microtasks, then the next phase**: promises beat timers; blocking code blocks everything.
- **EventEmitter**: synchronous, ordered listeners; an unhandled `'error'` throws.
- **Async iterables** give **lazy, pull-based** pipelines whose cleanup runs when you stop early.
- **Backpressure** = a bounded queue whose `push` waits for room.
- **Graceful shutdown**: stop, drain, close in **reverse** order, **timeout**, tolerate failures.
- **Retry** with capped backoff, a max attempt count, and no retry for non-retryable errors.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: wait for an event | A promise, `on`/`off`, cleaning up listeners |
| An EventEmitter | Listener lists, `once`, snapshots during `emit`, unhandled `'error'` |
| A stream pipeline | Async generators, `for await`, early `return` |
| A bounded queue | Promises that stay pending, FIFO waiters, closing |
| A shutdown manager | Sequential `await`, reverse order, a timeout race |
| A retrying worker | A retry loop, injected `sleep`, capped exponential backoff |

%% exercise nod-guided-once | Guided: wait for an event | 2 | js | js | onceEvent | 10 | guided
Implement `onceEvent(emitter, name)` for an emitter with `on(event, fn)` and `off(event, fn)`. It returns a **promise** that:

- resolves with an **array of the arguments** of the first `name` event;
- rejects with the first argument if an **`'error'`** event happens first;
- afterwards has **removed both listeners** (no leaks), and ignores later events.

```js
const pending = onceEvent(emitter, 'ready');
emitter.emit('ready', 1, 2);
await pending; // [1, 2]
```

%% worked
**A similar problem, solved: `nextClick(button)`** — wrap one callback in a promise and clean up after yourself.

```js
function nextClick(button) {
  return new Promise((resolve) => {
    const onClick = (event) => {
      button.off('click', onClick);       // ① remove the listener the moment it fires
      resolve(event);
    };
    button.on('click', onClick);          // ② register after defining it, so it can remove itself
  });
}
```

Yours has **two** listeners (the event and `'error'`) that **share one cleanup**: whichever fires first must remove both.

%% explain
- **Wrap in a promise**; register both listeners inside the executor.
- **One `cleanup`** removes both; each handler calls it, then settles.

%% nudge
- Which listener must be removed when the event wins, and which when the error wins?
- Why must `cleanup` be shared?

%% starter
```js
export function onceEvent(emitter, name) {
  return new Promise((resolve, reject) => {
    // register listeners here
  });
}
```

%% tests
```js
const makeEmitter = () => {
  const map = {};
  return {
    on(name, fn) { (map[name] ??= []).push(fn); },
    off(name, fn) { map[name] = (map[name] ?? []).filter((f) => f !== fn); },
    emit(name, ...args) { for (const fn of [...(map[name] ?? [])]) fn(...args); },
    count(name) { return (map[name] ?? []).length; },
  };
};

describe('onceEvent', () => {
  it('resolves with the arguments of the first event', async () => {
    const e = makeEmitter();
    const pending = onceEvent(e, 'ready');
    e.emit('ready', 1, 'two');
    expect(await pending).toEqual([1, 'two']);
  });
  it('ignores later events', async () => {
    const e = makeEmitter();
    const pending = onceEvent(e, 'ready');
    e.emit('ready', 'first');
    e.emit('ready', 'second');
    expect(await pending).toEqual(['first']);
  });
  it('does not resolve before the event', async () => {
    const e = makeEmitter();
    const done = jest.fn();
    onceEvent(e, 'ready').then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
  });
  it('rejects when an error event happens first', async () => {
    const e = makeEmitter();
    const pending = onceEvent(e, 'ready');
    const boom = new Error('boom');
    e.emit('error', boom);
    await expect(pending).rejects.toBe(boom);
  });
  it('removes both listeners after resolving', async () => {
    const e = makeEmitter();
    const pending = onceEvent(e, 'ready');
    expect(e.count('ready')).toBe(1);
    expect(e.count('error')).toBe(1);
    e.emit('ready');
    await pending;
    expect(e.count('ready')).toBe(0);
    expect(e.count('error')).toBe(0);
  });
  it('removes both listeners after rejecting', async () => {
    const e = makeEmitter();
    const pending = onceEvent(e, 'ready');
    e.emit('error', new Error('x'));
    await pending.catch(() => {});
    expect(e.count('ready')).toBe(0);
    expect(e.count('error')).toBe(0);
  });
});
```

%% hints
- `const cleanup = () => { emitter.off(name, onEvent); emitter.off('error', onError); };`
- `onEvent = (...args) => { cleanup(); resolve(args); }`, `onError = (error) => { cleanup(); reject(error); }`.
- Register with `emitter.on(name, onEvent); emitter.on('error', onError);` last.

%% solution
```js
export function onceEvent(emitter, name) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      emitter.off(name, onEvent);
      emitter.off('error', onError);
    };
    const onEvent = (...args) => {
      cleanup();
      resolve(args);
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    emitter.on(name, onEvent);
    emitter.on('error', onError);
  });
}
```

%% exercise nod-emitter | Build an EventEmitter | 3 | js | js | createEmitter | 28
`createEmitter()` returns an emitter with:

- `on(event, fn)` registers a listener (the same function may be registered twice and is then called twice) and returns an **unsubscribe** function that removes **that registration**.
- `once(event, fn)` registers a listener that runs **at most once**, and returns an unsubscribe function.
- `off(event, fn)` removes **all** registrations of `fn` for that event.
- `emit(event, ...args)` calls the listeners **synchronously, in registration order** with `args`, and returns `true` if there was at least one listener, else `false`. It iterates a **snapshot**: listeners added during the emit are not called until the next emit, and listeners removed during the emit are still called this time. If a listener throws, the exception propagates and later listeners are skipped.
- `listenerCount(event)` returns how many registrations are currently attached.
- Emitting **`'error'` with no listeners throws** its first argument if it is an `Error`, otherwise `new Error('Unhandled error: ' + String(arg))`.
- A `once` listener must never run twice, **even if the event is re-emitted from inside an earlier listener**.

```js
const e = createEmitter();
e.on('hi', (name) => console.log('hello', name));
e.emit('hi', 'Ada'); // true
```

%% worked
**A similar problem, solved: `createHooks()`** — listener records, removal by identity, and iterating a **copy**.

```js
function createHooks() {
  const hooks = [];                                       // records, not bare functions
  return {
    add(fn) {
      const record = { fn };
      hooks.push(record);
      return () => {                                      // ① unsubscribe removes THIS record
        const i = hooks.indexOf(record);
        if (i !== -1) hooks.splice(i, 1);
      };
    },
    run(...args) {
      for (const record of [...hooks]) record.fn(...args);   // ② iterate a snapshot: removing while looping is safe
    },
  };
}
```

Use **records** (`{ fn, once, fired }`) so the same function can be added twice and a `once` flag has somewhere to live.

%% explain
- **Records** per registration: `{ fn, once, fired }`.
- **Snapshot** the list at the start of `emit`.
- **`fired` flag** guards `once` against re-entrancy.

%% nudge
- Why does `once` need a `fired` flag as well as being removed?
- What does `emit` return when there are no listeners?

%% starter
```js
export function createEmitter() {
  const listeners = new Map();
  const emitter = {
    on(event, fn) {},
    once(event, fn) {},
    off(event, fn) {},
    emit(event, ...args) {
      return false;
    },
    listenerCount(event) {
      return 0;
    },
  };
  return emitter;
}
```

%% tests
```js
describe('createEmitter', () => {
  it('calls listeners in order with the arguments', () => {
    const e = createEmitter();
    const calls = [];
    e.on('x', (a, b) => calls.push(['one', a, b]));
    e.on('x', (a, b) => calls.push(['two', a, b]));
    expect(e.emit('x', 1, 2)).toBe(true);
    expect(calls).toEqual([['one', 1, 2], ['two', 1, 2]]);
  });
  it('returns false without listeners, and keeps events separate', () => {
    const e = createEmitter();
    const fn = jest.fn();
    e.on('a', fn);
    expect(e.emit('b')).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
  it('lets the same function register twice', () => {
    const e = createEmitter();
    const fn = jest.fn();
    e.on('x', fn);
    e.on('x', fn);
    e.emit('x');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(e.listenerCount('x')).toBe(2);
  });
  it('unsubscribes one registration', () => {
    const e = createEmitter();
    const fn = jest.fn();
    const off = e.on('x', fn);
    e.on('x', fn);
    off();
    e.emit('x');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    expect(e.listenerCount('x')).toBe(1);
  });
  it('removes every registration with off', () => {
    const e = createEmitter();
    const fn = jest.fn();
    const other = jest.fn();
    e.on('x', fn);
    e.on('x', fn);
    e.on('x', other);
    e.off('x', fn);
    e.emit('x');
    expect(fn).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledTimes(1);
  });
  it('runs once listeners a single time and counts them until fired', () => {
    const e = createEmitter();
    const fn = jest.fn();
    e.once('x', fn);
    expect(e.listenerCount('x')).toBe(1);
    e.emit('x', 'a');
    e.emit('x', 'b');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
    expect(e.listenerCount('x')).toBe(0);
  });
  it('lets a once listener be cancelled before it fires', () => {
    const e = createEmitter();
    const fn = jest.fn();
    const off = e.once('x', fn);
    off();
    e.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });
  it('iterates a snapshot: additions wait, removals still run this time', () => {
    const e = createEmitter();
    const calls = [];
    const late = () => calls.push('late');
    const removed = () => calls.push('removed');
    e.on('x', () => { calls.push('first'); e.on('x', late); e.off('x', removed); });
    e.on('x', removed);
    e.emit('x');
    expect(calls).toEqual(['first', 'removed']);
    calls.length = 0;
    e.emit('x');
    expect(calls).toEqual(['first', 'late']);
  });
  it('never runs a once listener twice when re-emitted from an earlier listener', () => {
    const e = createEmitter();
    const log = [];
    let again = true;
    e.on('x', () => {
      log.push('A');
      if (again) { again = false; e.emit('x'); }
    });
    e.once('x', () => log.push('B'));
    e.emit('x');
    expect(log.filter((l) => l === 'B')).toHaveLength(1);
    expect(log.filter((l) => l === 'A')).toHaveLength(2);
  });
  it('stops at a throwing listener', () => {
    const e = createEmitter();
    const after = jest.fn();
    e.on('x', () => { throw new Error('nope'); });
    e.on('x', after);
    expect(() => e.emit('x')).toThrow('nope');
    expect(after).not.toHaveBeenCalled();
  });
  it('throws an unhandled error event', () => {
    const e = createEmitter();
    const boom = new Error('boom');
    expect(() => e.emit('error', boom)).toThrow(boom);
    expect(() => e.emit('error', 'text')).toThrow('Unhandled error: text');
  });
  it('delivers an error event to its listeners instead of throwing', () => {
    const e = createEmitter();
    const fn = jest.fn();
    e.on('error', fn);
    expect(e.emit('error', new Error('x'))).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('counts per event', () => {
    const e = createEmitter();
    e.on('a', () => {});
    e.on('b', () => {});
    e.on('b', () => {});
    expect([e.listenerCount('a'), e.listenerCount('b'), e.listenerCount('c')]).toEqual([1, 2, 0]);
  });
});
```

%% hints
- Store `Map(event → array of { fn, once, fired })`.
- `add(event, fn, once)` returns an unsubscribe that removes the record by identity.
- In `emit`: `for (const rec of snapshot) { if (rec.once) { if (rec.fired) continue; rec.fired = true; remove(event, rec); } rec.fn(...args); }`.
- The `'error'` rule applies only when the snapshot is empty.

%% solution
```js
export function createEmitter() {
  const listeners = new Map();
  const list = (event) => listeners.get(event) ?? [];

  const remove = (event, record) => {
    const current = list(event);
    const i = current.indexOf(record);
    if (i !== -1) listeners.set(event, [...current.slice(0, i), ...current.slice(i + 1)]);
  };
  const add = (event, fn, once) => {
    const record = { fn, once, fired: false };
    listeners.set(event, [...list(event), record]);
    return () => remove(event, record);
  };

  const emitter = {
    on(event, fn) {
      return add(event, fn, false);
    },
    once(event, fn) {
      return add(event, fn, true);
    },
    off(event, fn) {
      listeners.set(event, list(event).filter((record) => record.fn !== fn));
    },
    emit(event, ...args) {
      const snapshot = list(event);
      if (snapshot.length === 0) {
        if (event === 'error') {
          throw args[0] instanceof Error ? args[0] : new Error('Unhandled error: ' + String(args[0]));
        }
        return false;
      }
      for (const record of snapshot) {
        if (record.once) {
          if (record.fired) continue;
          record.fired = true;
          remove(event, record);
        }
        record.fn(...args);
      }
      return true;
    },
    listenerCount(event) {
      return list(event).length;
    },
  };
  return emitter;
}
```

%% exercise nod-stream-pipeline | A lazy async pipeline | 4 | js | js | mapAsync, filterAsync, batchAsync, takeAsync, collect | 36
Build pipeline stages as **async generators** over any async (or sync) iterable `source`:

- `mapAsync(source, fn)` yields `await fn(item)` for each item.
- `filterAsync(source, predicate)` yields the items for which `await predicate(item)` is truthy.
- `batchAsync(source, size)` yields arrays of `size` items; the last array may be shorter; an empty source yields nothing. A `size` below `1` makes the first `next()` **reject** with `Error('size must be at least 1')`.
- `takeAsync(source, n)` yields at most `n` items and then **stops without asking the source for another**, so the source's cleanup (`finally`) runs. `n <= 0` must not start the source at all.
- `collect(source)` returns all items as an array.

Everything is **lazy**: nothing is pulled from the source until the consumer asks, and one item at a time. Errors from the source or the callbacks reject the consumer.

```js
async function* numbers() { yield 1; yield 2; yield 3; yield 4; }
await collect(takeAsync(mapAsync(numbers(), (x) => x * 10), 2)); // [10, 20]
```

%% worked
**A similar problem, solved: `dropAsync(source, n)`** — an async generator with `for await`, and why cleanup works for free.

```js
export async function* dropAsync(source, n) {
  let seen = 0;
  for await (const item of source) {        // ① pulls ONE item at a time, only when the consumer pulls
    if (seen++ >= n) yield item;            // ② yield = hand it downstream and pause here
  }
}
```

If the consumer stops early (a `return` inside its own `for await`), JavaScript calls `return()` on your generator, which **exits the `for await`**, which calls `return()` on the **source**: cleanup ripples all the way upstream without any code from you. That is why `takeAsync` simply **returns** once it has `n` items.

%% explain
- **`async function*`** plus **`for await`** for each stage.
- **`takeAsync`** returns right after yielding item `n` (never pulling the next).
- **`batchAsync`** keeps a buffer and flushes the remainder.

%% nudge
- When exactly should `takeAsync` stop: before or after asking for item `n + 1`?
- What would make `takeAsync(source, 0)` start the source by mistake?

%% starter
```js
export async function* mapAsync(source, fn) {}

export async function* filterAsync(source, predicate) {}

export async function* batchAsync(source, size) {}

export async function* takeAsync(source, n) {}

export async function collect(source) {
  return [];
}
```

%% tests
```js
const tracked = (items, log = []) => {
  const gen = (async function* () {
    log.push('open');
    try {
      for (const item of items) {
        log.push('pull ' + item);
        yield item;
      }
    } finally {
      log.push('close');
    }
  })();
  return { source: gen, log };
};

describe('pipeline stages', () => {
  it('collects any iterable, sync or async', async () => {
    expect(await collect([1, 2, 3])).toEqual([1, 2, 3]);
    expect(await collect(tracked([4, 5]).source)).toEqual([4, 5]);
    expect(await collect([])).toEqual([]);
  });
  it('maps, with sync or async functions', async () => {
    expect(await collect(mapAsync([1, 2, 3], (x) => x * 2))).toEqual([2, 4, 6]);
    expect(await collect(mapAsync([1, 2], async (x) => x + 1))).toEqual([2, 3]);
  });
  it('filters, with sync or async predicates', async () => {
    expect(await collect(filterAsync([1, 2, 3, 4], (x) => x % 2 === 0))).toEqual([2, 4]);
    expect(await collect(filterAsync([1, 2, 3], async (x) => x > 1))).toEqual([2, 3]);
  });
  it('batches with a short last batch', async () => {
    expect(await collect(batchAsync([1, 2, 3, 4, 5], 2))).toEqual([[1, 2], [3, 4], [5]]);
    expect(await collect(batchAsync([1, 2, 3, 4], 2))).toEqual([[1, 2], [3, 4]]);
    expect(await collect(batchAsync([], 3))).toEqual([]);
  });
  it('rejects a batch size below one', async () => {
    await expect(collect(batchAsync([1], 0))).rejects.toThrow('size must be at least 1');
  });
  it('takes the first n items', async () => {
    expect(await collect(takeAsync([1, 2, 3, 4], 2))).toEqual([1, 2]);
    expect(await collect(takeAsync([1, 2], 5))).toEqual([1, 2]);
  });
  it('is lazy: pulls one item at a time, only on demand', async () => {
    const { source, log } = tracked([1, 2, 3]);
    const it = mapAsync(source, (x) => x * 10)[Symbol.asyncIterator]();
    expect(log).toEqual([]);
    expect(await it.next()).toEqual({ value: 10, done: false });
    expect(log).toEqual(['open', 'pull 1']);
    await it.return();
  });
  it('stops taking without pulling an extra item, and closes the source', async () => {
    const { source, log } = tracked([1, 2, 3, 4]);
    expect(await collect(takeAsync(source, 2))).toEqual([1, 2]);
    expect(log).toEqual(['open', 'pull 1', 'pull 2', 'close']);
  });
  it('does not start the source for take(0)', async () => {
    const { source, log } = tracked([1, 2]);
    expect(await collect(takeAsync(source, 0))).toEqual([]);
    expect(log).not.toContain('pull 1');
  });
  it('composes stages and cleans up the whole chain', async () => {
    const { source, log } = tracked([1, 2, 3, 4, 5, 6]);
    const out = await collect(takeAsync(mapAsync(filterAsync(source, (x) => x % 2 === 0), (x) => x * 10), 2));
    expect(out).toEqual([20, 40]);
    expect(log).toEqual(['open', 'pull 1', 'pull 2', 'pull 3', 'pull 4', 'close']);
  });
  it('propagates errors and still closes the source', async () => {
    const { source, log } = tracked([1, 2, 3]);
    await expect(collect(mapAsync(source, (x) => { if (x === 2) throw new Error('bad item'); return x; }))).rejects.toThrow('bad item');
    expect(log[log.length - 1]).toBe('close');
  });
});
```

%% hints
- Every stage is `async function* name(source, ...) { for await (const item of source) { ... yield ...; } }`.
- `takeAsync`: `if (n <= 0) return; let i = 0; for await (const item of source) { yield item; if (++i >= n) return; }`.
- `batchAsync`: validate `size` first; keep `let batch = []`, `yield batch` when full, flush at the end if non-empty.
- `collect`: `const out = []; for await (const item of source) out.push(item); return out;`

%% solution
```js
export async function* mapAsync(source, fn) {
  for await (const item of source) yield await fn(item);
}

export async function* filterAsync(source, predicate) {
  for await (const item of source) {
    if (await predicate(item)) yield item;
  }
}

export async function* batchAsync(source, size) {
  if (!(size >= 1)) throw new Error('size must be at least 1');
  let batch = [];
  for await (const item of source) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}

export async function* takeAsync(source, n) {
  if (n <= 0) return;
  let taken = 0;
  for await (const item of source) {
    yield item;
    taken++;
    if (taken >= n) return;
  }
}

export async function collect(source) {
  const out = [];
  for await (const item of source) out.push(item);
  return out;
}
```

%% exercise nod-bounded-queue | A bounded queue with backpressure | 4 | js | js | createBoundedQueue | 40
`createBoundedQueue({ highWaterMark = 1 } = {})` returns `{ push(item), pull(), close(), size() }`. All of `push` and `pull` return promises.

- **`push(item)`** resolves once the item is **accepted**. If a consumer is already waiting in `pull()`, the item is handed over directly. Else, if fewer than `highWaterMark` items are buffered, it is buffered and `push` resolves immediately. Else `push` **stays pending** until a `pull` makes room (blocked pushers are served in **FIFO** order, and their items are buffered in that order).
- **`pull()`** resolves `{ value, done: false }` with the oldest item, **waiting** (FIFO) if the queue is empty. Taking an item from a full queue lets the oldest blocked pusher in.
- **`size()`** returns how many items are buffered (blocked pushers' items do **not** count).
- **`close()`**: no more items are accepted. Items already buffered can still be pulled; after they run out, `pull()` resolves `{ value: undefined, done: true }`. **Waiting pullers** are resolved `done: true` right away; **blocked pushers** reject with `Error('queue closed')`; any later `push` rejects with `Error('queue closed')`. Calling `close()` twice is harmless.

```js
const q = createBoundedQueue({ highWaterMark: 2 });
await q.push('a');
await q.push('b');
const third = q.push('c');   // pending: the queue is full
await q.pull();              // { value: 'a', done: false } and 'c' gets in
await third;                 // now resolved
```

%% worked
**A similar problem, solved: `createGate()`** — a promise that **stays pending** on purpose, with a list of waiters you resolve later.

```js
function createGate() {
  let open = false;
  const waiters = [];                                    // ① resolve functions, in arrival order
  return {
    wait() {
      if (open) return Promise.resolve();
      return new Promise((resolve) => waiters.push(resolve));   // ② pending until someone calls open()
    },
    open() {
      open = true;
      for (const resolve of waiters.splice(0)) resolve();       // ③ release everyone, oldest first
    },
  };
}
```

Backpressure **is** this: `push` hands back a promise that only resolves when a slot is free, so a producer that `await`s it simply **cannot** run ahead. You need two waiting lists: **pullers** waiting for items and **pushers** waiting for room (they can never both be non-empty).

%% explain
- **State**: `items`, a list of waiting `pullers` (resolve functions), a list of blocked `pushers` (`{ item, resolve, reject }`), a `closed` flag.
- **push**: closed → reject; puller waiting → hand over; room → buffer; else wait.
- **pull**: item buffered → take it and admit a blocked pusher; empty and closed → done; else wait.

%% nudge
- When a pull takes an item from a full queue, what must happen to the first blocked pusher?
- Why can there never be waiting pullers and blocked pushers at the same time?

%% starter
```js
export function createBoundedQueue({ highWaterMark = 1 } = {}) {
  const items = [];
  return {
    size() {
      return items.length;
    },
    push(item) {
      return Promise.resolve();
    },
    pull() {
      return Promise.resolve({ value: undefined, done: true });
    },
    close() {},
  };
}
```

%% tests
```js
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('createBoundedQueue', () => {
  it('delivers items first in, first out', async () => {
    const q = createBoundedQueue({ highWaterMark: 3 });
    await q.push('a');
    await q.push('b');
    expect(await q.pull()).toEqual({ value: 'a', done: false });
    expect(await q.pull()).toEqual({ value: 'b', done: false });
  });
  it('makes a pull wait for the next push', async () => {
    const q = createBoundedQueue({ highWaterMark: 2 });
    let got;
    q.pull().then((r) => { got = r; });
    await flush();
    expect(got).toBeUndefined();
    await q.push('x');
    await flush();
    expect(got).toEqual({ value: 'x', done: false });
    expect(q.size()).toBe(0);
  });
  it('serves waiting pullers in order', async () => {
    const q = createBoundedQueue({ highWaterMark: 2 });
    const order = [];
    q.pull().then((r) => order.push(['first', r.value]));
    q.pull().then((r) => order.push(['second', r.value]));
    await q.push(1);
    await q.push(2);
    await flush();
    expect(order).toEqual([['first', 1], ['second', 2]]);
  });
  it('resolves push immediately below the high water mark', async () => {
    const q = createBoundedQueue({ highWaterMark: 2 });
    let done = 0;
    q.push('a').then(() => done++);
    q.push('b').then(() => done++);
    await flush();
    expect(done).toBe(2);
    expect(q.size()).toBe(2);
  });
  it('keeps push pending at the high water mark until a pull makes room', async () => {
    const q = createBoundedQueue({ highWaterMark: 2 });
    await q.push('a');
    await q.push('b');
    let settled = false;
    q.push('c').then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false);
    expect(q.size()).toBe(2);
    expect(await q.pull()).toEqual({ value: 'a', done: false });
    await flush();
    expect(settled).toBe(true);
    expect(q.size()).toBe(2);
    expect((await q.pull()).value).toBe('b');
    expect((await q.pull()).value).toBe('c');
  });
  it('admits blocked pushers in FIFO order', async () => {
    const q = createBoundedQueue({ highWaterMark: 1 });
    await q.push('a');
    const order = [];
    q.push('b').then(() => order.push('b accepted'));
    q.push('c').then(() => order.push('c accepted'));
    await flush();
    expect(order).toEqual([]);
    await q.pull();
    await flush();
    expect(order).toEqual(['b accepted']);
    await q.pull();
    await flush();
    expect(order).toEqual(['b accepted', 'c accepted']);
    expect((await q.pull()).value).toBe('c');
  });
  it('lets a producer and a slow consumer run in lock-step', async () => {
    const q = createBoundedQueue({ highWaterMark: 1 });
    const produced = [];
    const producer = (async () => {
      for (let i = 1; i <= 5; i++) { await q.push(i); produced.push(i); }
      q.close();
    })();
    await flush();
    expect(produced.length).toBeLessThanOrEqual(2);
    const seen = [];
    for (;;) {
      const r = await q.pull();
      if (r.done) break;
      seen.push(r.value);
    }
    await producer;
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });
  it('drains buffered items after close, then reports done', async () => {
    const q = createBoundedQueue({ highWaterMark: 3 });
    await q.push('a');
    await q.push('b');
    q.close();
    expect(await q.pull()).toEqual({ value: 'a', done: false });
    expect(await q.pull()).toEqual({ value: 'b', done: false });
    expect(await q.pull()).toEqual({ value: undefined, done: true });
    expect(await q.pull()).toEqual({ value: undefined, done: true });
  });
  it('finishes waiting pullers on close', async () => {
    const q = createBoundedQueue();
    const results = [];
    q.pull().then((r) => results.push(r));
    q.pull().then((r) => results.push(r));
    q.close();
    await flush();
    expect(results).toEqual([{ value: undefined, done: true }, { value: undefined, done: true }]);
  });
  it('rejects blocked pushers and later pushes after close', async () => {
    const q = createBoundedQueue({ highWaterMark: 1 });
    await q.push('a');
    const blocked = q.push('b');
    q.close();
    await expect(blocked).rejects.toThrow('queue closed');
    await expect(q.push('c')).rejects.toThrow('queue closed');
    expect((await q.pull()).value).toBe('a');
  });
  it('tolerates closing twice', async () => {
    const q = createBoundedQueue();
    q.close();
    expect(() => q.close()).not.toThrow();
  });
  it('defaults to a high water mark of one', async () => {
    const q = createBoundedQueue();
    await q.push(1);
    let settled = false;
    q.push(2).then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false);
  });
});
```

%% hints
- `pullers.shift()({ value: item, done: false })` hands an item straight to a waiter.
- In `pull`: `const value = items.shift(); if (pushers.length) { const p = pushers.shift(); items.push(p.item); p.resolve(); }`.
- `close()`: set the flag, reject every blocked pusher, resolve every waiting puller with `{ value: undefined, done: true }`.

%% solution
```js
export function createBoundedQueue({ highWaterMark = 1 } = {}) {
  const items = [];
  const pullers = [];
  const pushers = [];
  let closed = false;

  return {
    size() {
      return items.length;
    },
    push(item) {
      if (closed) return Promise.reject(new Error('queue closed'));
      if (pullers.length > 0) {
        pullers.shift()({ value: item, done: false });
        return Promise.resolve();
      }
      if (items.length < highWaterMark) {
        items.push(item);
        return Promise.resolve();
      }
      return new Promise((resolve, reject) => pushers.push({ item, resolve, reject }));
    },
    pull() {
      if (items.length > 0) {
        const value = items.shift();
        if (pushers.length > 0) {
          const blocked = pushers.shift();
          items.push(blocked.item);
          blocked.resolve();
        }
        return Promise.resolve({ value, done: false });
      }
      if (closed) return Promise.resolve({ value: undefined, done: true });
      return new Promise((resolve) => pullers.push(resolve));
    },
    close() {
      if (closed) return;
      closed = true;
      for (const blocked of pushers.splice(0)) blocked.reject(new Error('queue closed'));
      for (const resolve of pullers.splice(0)) resolve({ value: undefined, done: true });
    },
  };
}
```

%% exercise nod-shutdown | A graceful shutdown manager | 4 | js | js | createShutdownManager | 42
`createShutdownManager({ timeoutMs })` returns `{ register(name, fn), shutdown() }`. Names are unique.

- `register(name, fn)` adds a closer (`fn` may be sync or async). After `shutdown()` has been called it throws `Error('shutting down')`.
- `shutdown()` returns a promise and is **idempotent**: later calls return the **same promise** and do not run closers again.
- Closers run **one at a time, in reverse registration order**, each awaited before the next starts.
- A closer that throws or rejects is recorded in `failed` as `{ name, error }` and the others still run.
- If the whole shutdown takes `timeoutMs` or longer, the promise resolves right away with what happened so far and `timedOut: true`; no new closer is started after that. A closer still running at that moment counts as `skipped`, like those never started.
- The result is `{ completed: [names], failed: [{ name, error }], skipped: [names], timedOut }`, each list in run order. On a normal finish, `skipped` is `[]` and `timedOut` is `false`. The timer must be cleared when shutdown finishes in time.

```js
const manager = createShutdownManager({ timeoutMs: 5000 });
manager.register('db', () => db.close());
manager.register('http', () => server.close());
await manager.shutdown(); // closes http first, then db
```

%% worked
**A similar problem, solved: `withDeadline(task, ms)`** — race a task against a timer and clean the timer up.

```js
function withDeadline(task, ms) {
  let timer;
  const deadline = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);          // ① the losing side of the race
  });
  return Promise.race([task.then((value) => ({ timedOut: false, value })), deadline])
    .finally(() => clearTimeout(timer));                                  // ② never leave a timer behind
}
```

For your manager the "task" is the **sequence of closers**. When the timer wins, take a **snapshot** of the lists (copies, because the sequence may still mutate them) and set a flag so the loop **stops starting** new closers.

%% explain
- **Sequence**: a loop over the reversed closers with `try/await/catch`, checking the `timedOut` flag first.
- **Race** the sequence against a timer; snapshot on timeout.
- **Memoize** the promise for idempotency.

%% nudge
- Why must the loop check the timeout flag before starting each closer?
- Where do the `skipped` names come from when the timer wins?

%% starter
```js
export function createShutdownManager({ timeoutMs }) {
  const closers = [];
  return {
    register(name, fn) {
      closers.push({ name, fn });
    },
    shutdown() {
      return Promise.resolve({ completed: [], failed: [], skipped: [], timedOut: false });
    },
  };
}
```

%% tests
```js
describe('createShutdownManager', () => {
  it('runs closers sequentially in reverse registration order', async () => {
    jest.useFakeTimers();
    const trace = [];
    const closer = (name) => async () => {
      trace.push(name + ' start');
      await Promise.resolve();
      await Promise.resolve();
      trace.push(name + ' end');
    };
    const m = createShutdownManager({ timeoutMs: 1000 });
    m.register('a', closer('a'));
    m.register('b', closer('b'));
    m.register('c', closer('c'));
    const result = await m.shutdown();
    expect(trace).toEqual(['c start', 'c end', 'b start', 'b end', 'a start', 'a end']);
    expect(result).toEqual({ completed: ['c', 'b', 'a'], failed: [], skipped: [], timedOut: false });
  });
  it('accepts synchronous closers', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 1000 });
    const fn = jest.fn();
    m.register('sync', fn);
    expect((await m.shutdown()).completed).toEqual(['sync']);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('keeps going after a failing closer and reports it', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 1000 });
    const boom = new Error('boom');
    const first = jest.fn();
    m.register('first', first);
    m.register('bad', async () => { throw boom; });
    m.register('syncbad', () => { throw new Error('sync'); });
    const result = await m.shutdown();
    expect(first).toHaveBeenCalledTimes(1);
    expect(result.completed).toEqual(['first']);
    expect(result.failed.map((f) => f.name)).toEqual(['syncbad', 'bad']);
    expect(result.failed[1].error).toBe(boom);
    expect(result.timedOut).toBe(false);
  });
  it('is idempotent', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 1000 });
    const fn = jest.fn();
    m.register('x', fn);
    const a = m.shutdown();
    const b = m.shutdown();
    expect(b).toBe(a);
    await a;
    await m.shutdown();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('refuses registrations once shutting down', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 1000 });
    m.shutdown();
    expect(() => m.register('late', () => {})).toThrow('shutting down');
  });
  it('handles no closers', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 1000 });
    expect(await m.shutdown()).toEqual({ completed: [], failed: [], skipped: [], timedOut: false });
  });
  it('times out when a closer hangs, skipping the rest', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 500 });
    const a = jest.fn();
    m.register('a', a);
    m.register('b', () => new Promise(() => {}));
    const promise = m.shutdown();
    await jest.advanceTimersByTimeAsync(500);
    expect(await promise).toEqual({ completed: [], failed: [], skipped: ['b', 'a'], timedOut: true });
    await jest.advanceTimersByTimeAsync(10000);
    expect(a).not.toHaveBeenCalled();
  });
  it('reports what finished before the timeout', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 300 });
    const wait = (ms) => () => new Promise((resolve) => setTimeout(resolve, ms));
    const a = jest.fn();
    m.register('a', a);
    m.register('b', wait(200));
    m.register('c', wait(200));
    const promise = m.shutdown();
    await jest.advanceTimersByTimeAsync(300);
    expect(await promise).toEqual({ completed: ['c'], failed: [], skipped: ['b', 'a'], timedOut: true });
    await jest.advanceTimersByTimeAsync(1000);
    expect(a).not.toHaveBeenCalled();
  });
  it('does not time out when it finishes in time', async () => {
    jest.useFakeTimers();
    const m = createShutdownManager({ timeoutMs: 500 });
    m.register('slow', () => new Promise((resolve) => setTimeout(resolve, 400)));
    const promise = m.shutdown();
    await jest.advanceTimersByTimeAsync(400);
    expect(await promise).toEqual({ completed: ['slow'], failed: [], skipped: [], timedOut: false });
    await jest.advanceTimersByTimeAsync(5000);
    expect(await promise).toEqual({ completed: ['slow'], failed: [], skipped: [], timedOut: false });
  });
});
```

%% hints
- Reverse a copy: `const order = [...closers].reverse();`.
- The loop: `for (const { name, fn } of order) { if (timedOut) break; try { await fn(); completed.push(name); } catch (error) { failed.push({ name, error }); } }`.
- On timeout: `skipped = order.map((c) => c.name).filter((n) => !completed.includes(n) && !failed.some((f) => f.name === n))`.
- `promise = Promise.race([sequence, timeout]).finally(() => clearTimeout(timer));` and keep `promise` for idempotency.

%% solution
```js
export function createShutdownManager({ timeoutMs }) {
  const closers = [];
  let promise = null;

  return {
    register(name, fn) {
      if (promise) throw new Error('shutting down');
      closers.push({ name, fn });
    },
    shutdown() {
      if (promise) return promise;
      const order = [...closers].reverse();
      const completed = [];
      const failed = [];
      let timedOut = false;
      let timer;

      const sequence = (async () => {
        for (const { name, fn } of order) {
          if (timedOut) break;
          try {
            await fn();
            completed.push(name);
          } catch (error) {
            failed.push({ name, error });
          }
        }
        return { completed, failed, skipped: [], timedOut: false };
      })();

      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          const finished = new Set([...completed, ...failed.map((f) => f.name)]);
          resolve({
            completed: [...completed],
            failed: [...failed],
            skipped: order.map((c) => c.name).filter((n) => !finished.has(n)),
            timedOut: true,
          });
        }, timeoutMs);
      });

      promise = Promise.race([sequence, timeout]).finally(() => clearTimeout(timer));
      return promise;
    },
  };
}
```

%% exercise nod-retry-worker | A retrying job worker | 3 | js | js | exponentialBackoff, createWorker | 30
Two pieces.

`exponentialBackoff({ base, factor = 2, max = Infinity })` returns a function `backoff(attempt)` (attempts are numbered from `1`) giving `Math.min(max, base * factor ** (attempt - 1))`.

`createWorker({ handler, maxAttempts = 3, backoff = () => 0, sleep })` returns `{ process(job) }` (async):

- It calls `handler(job, attempt)` with the **1-based** attempt number. On success it returns `{ status: 'done', attempts, result }`.
- On an error it waits `await sleep(backoff(attempt))` and tries again, up to `maxAttempts` attempts in total. **No sleep after the last attempt.**
- An error with `retryable === false` **stops at once** (no sleep, no more attempts).
- When it gives up, it returns `{ status: 'failed', attempts, error }` with the **last** error. `process` itself never rejects because of handler errors.

```js
const worker = createWorker({ handler: sendEmail, maxAttempts: 4, backoff: exponentialBackoff({ base: 100 }), sleep });
await worker.process({ to: 'ada@x.io' }); // { status: 'done', attempts: 2, result: ... }
```

%% worked
**A similar problem, solved: `pollUntil(check, { tries, sleep, gap })`** — a bounded loop that waits **between** tries, never after the last.

```js
async function pollUntil(check, { tries, sleep, gap }) {
  for (let i = 1; i <= tries; i++) {
    if (await check(i)) return { ok: true, tries: i };
    if (i < tries) await sleep(gap);              // ① wait only if another try is coming
  }
  return { ok: false, tries };
}
```

Your worker is the same loop with `try/catch` instead of a boolean check, a **growing** wait (`backoff(attempt)`), and an early exit for errors that can never succeed.

%% explain
- **Loop** attempts `1..maxAttempts`, remember the last error.
- **Sleep between** attempts only, using the failing attempt's number.
- **Early exit** on `retryable === false`.

%% nudge
- When should the loop *not* sleep?
- What does `attempts` report if the first error is non-retryable?

%% starter
```js
export function exponentialBackoff({ base, factor = 2, max = Infinity }) {
  return (attempt) => 0;
}

export function createWorker({ handler, maxAttempts = 3, backoff = () => 0, sleep }) {
  return {
    async process(job) {
      return { status: 'done', attempts: 1, result: await handler(job, 1) };
    },
  };
}
```

%% tests
```js
describe('exponentialBackoff', () => {
  it('doubles by default', () => {
    const b = exponentialBackoff({ base: 100 });
    expect([1, 2, 3, 4].map(b)).toEqual([100, 200, 400, 800]);
  });
  it('supports a factor and a cap', () => {
    expect([1, 2, 3].map(exponentialBackoff({ base: 10, factor: 3 }))).toEqual([10, 30, 90]);
    expect([1, 2, 3, 4].map(exponentialBackoff({ base: 100, max: 300 }))).toEqual([100, 200, 300, 300]);
  });
});

describe('createWorker', () => {
  const setup = (handler, opts = {}) => {
    const sleeps = [];
    const worker = createWorker({ handler, sleep: async (ms) => { sleeps.push(ms); }, ...opts });
    return { worker, sleeps };
  };
  it('returns the result on the first success without sleeping', async () => {
    const handler = jest.fn(async (job) => job.n * 2);
    const { worker, sleeps } = setup(handler);
    expect(await worker.process({ n: 21 })).toEqual({ status: 'done', attempts: 1, result: 42 });
    expect(handler).toHaveBeenCalledWith({ n: 21 }, 1);
    expect(sleeps).toEqual([]);
  });
  it('retries with backoff and then succeeds', async () => {
    let calls = 0;
    const handler = jest.fn(async () => { if (++calls < 3) throw new Error('flaky'); return 'ok'; });
    const { worker, sleeps } = setup(handler, { backoff: exponentialBackoff({ base: 100 }) });
    expect(await worker.process({})).toEqual({ status: 'done', attempts: 3, result: 'ok' });
    expect(sleeps).toEqual([100, 200]);
    expect(handler.mock.calls.map((c) => c[1])).toEqual([1, 2, 3]);
  });
  it('gives up after maxAttempts with the last error and no final sleep', async () => {
    const errors = [new Error('one'), new Error('two'), new Error('three')];
    let i = 0;
    const { worker, sleeps } = setup(async () => { throw errors[i++]; }, { maxAttempts: 3, backoff: () => 50 });
    const result = await worker.process({});
    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(3);
    expect(result.error).toBe(errors[2]);
    expect(sleeps).toEqual([50, 50]);
  });
  it('stops at once for non-retryable errors', async () => {
    const bad = Object.assign(new Error('invalid'), { retryable: false });
    const handler = jest.fn(async () => { throw bad; });
    const { worker, sleeps } = setup(handler, { maxAttempts: 5, backoff: () => 10 });
    expect(await worker.process({})).toEqual({ status: 'failed', attempts: 1, error: bad });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(sleeps).toEqual([]);
  });
  it('treats retryable: true and a plain error as retryable', async () => {
    let calls = 0;
    const handler = async () => { calls++; throw Object.assign(new Error('x'), { retryable: true }); };
    const { worker } = setup(handler, { maxAttempts: 2 });
    await worker.process({});
    expect(calls).toBe(2);
  });
  it('defaults to three attempts and a zero backoff', async () => {
    const handler = jest.fn(async () => { throw new Error('x'); });
    const { worker, sleeps } = setup(handler);
    expect((await worker.process({})).attempts).toBe(3);
    expect(sleeps).toEqual([0, 0]);
  });
  it('catches synchronous handler errors too', async () => {
    const { worker } = setup(() => { throw new Error('sync'); }, { maxAttempts: 2 });
    const result = await worker.process({});
    expect(result.status).toBe('failed');
    expect(result.error.message).toBe('sync');
  });
  it('keeps jobs independent', async () => {
    let calls = 0;
    const { worker } = setup(async (job) => { if (job.fail && ++calls < 5) throw new Error('x'); return job.id; });
    expect((await worker.process({ id: 1, fail: true })).status).toBe('failed');
    expect(await worker.process({ id: 2 })).toEqual({ status: 'done', attempts: 1, result: 2 });
  });
});
```

%% hints
- `exponentialBackoff`: `(attempt) => Math.min(max, base * factor ** (attempt - 1))`.
- `for (let attempt = 1; attempt <= maxAttempts; attempt++) { try { ... return done } catch (error) { lastError = error; attempts = attempt; if (error && error.retryable === false) break; if (attempt < maxAttempts) await sleep(backoff(attempt)); } }`
- Await the handler inside the `try` so sync throws and rejections both land in `catch`.

%% solution
```js
export function exponentialBackoff({ base, factor = 2, max = Infinity }) {
  return (attempt) => Math.min(max, base * factor ** (attempt - 1));
}

export function createWorker({ handler, maxAttempts = 3, backoff = () => 0, sleep }) {
  return {
    async process(job) {
      let lastError;
      let attempts = 0;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts = attempt;
        try {
          const result = await handler(job, attempt);
          return { status: 'done', attempts, result };
        } catch (error) {
          lastError = error;
          if (error && error.retryable === false) break;
          if (attempt < maxAttempts) await sleep(backoff(attempt));
        }
      }
      return { status: 'failed', attempts, error: lastError };
    },
  };
}
```
