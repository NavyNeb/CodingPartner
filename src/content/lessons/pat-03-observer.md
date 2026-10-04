---
id: pat-observer
track: pat
title: Observer, events & signals
summary: Letting one part of a program announce changes without knowing who listens: emitters and pub/sub buses, observable stores, cleaning up subscriptions so nothing leaks, and signals that track their own dependencies.
---

## The idea in one sentence

**Observer** lets something announce "I changed" to a list of **subscribers** it knows nothing about, so the parts of your program stay **decoupled**.

> **Analogy** A newsletter. The publisher doesn't know who you are or what you'll do with the email; it just sends to its list. You can join or leave the list any time, and the publisher never changes.

You already use this everywhere: `addEventListener`, DOM events, Node's `EventEmitter`, Redux stores, React state, RxJS and signals.

## The smallest observer

A subject keeps an **array of functions**. `subscribe` adds one and returns a function that removes it. `emit` calls them all.

![The observer pattern](fig:pat-observer "The subject knows a list of functions, never who they belong to.")

```stepper A tiny emitter
code:
  const bus = createEmitter();
  const off = bus.on('price', (p) => console.log('A', p));
  bus.on('price', (p) => console.log('B', p));
  bus.emit('price', 10);
  off();
  bus.emit('price', 11);
---
line: 2
say: `on` stores listener **A** under the event name `price` and returns `off`, a function that removes exactly this listener.
price listeners: A
---
line: 3
say: Listener **B** joins. Listeners are called in the order they subscribed.
price listeners: A, B
---
line: 4
say: `emit` calls every listener with the arguments. Output: `A 10` then `B 10`.
output: A 10, B 10
---
line: 5
say: `off()` unsubscribes **A**. B stays.
price listeners: B
---
line: 6
say: The next emit only reaches B. Output: `B 11`. Unsubscribing is what stops work (and memory) from piling up.
output: B 11
```

```js try predict
function createEmitter() {
  const listeners = new Map();
  return {
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(fn);
      return () => {
        const list = listeners.get(event);
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
      };
    },
    emit(event, ...args) {
      for (const fn of [...(listeners.get(event) || [])]) fn(...args);
    },
  };
}
const bus = createEmitter();
const off = bus.on('hello', (n) => console.log('hello', n));
bus.emit('hello', 1);
off();
bus.emit('hello', 2);
console.log('done');
```

Notice `[...list]`: copying the array before looping means a listener that unsubscribes (or subscribes) **during** an emit can't corrupt the loop.

## Pub/sub: a bus between strangers

Plain observer ties a listener to one subject. **Publish/subscribe** puts a **bus** in the middle with named **topics**: publishers and subscribers share only the bus.

![Publish and subscribe](fig:pat-pubsub "Add a subscriber without touching a single publisher.")

A good bus also handles the awkward cases: a **`once`** listener, a **wildcard** listener that hears everything (handy for logging), and **errors**: one broken listener must not stop the others.

## Observable state: stores

An observable **store** holds state and notifies when it changes. Two details make it good:

- **Don't notify if nothing changed** (compare the new values with the old).
- **Let a subscriber watch just a slice** (`select`) and be told only when *that* slice changes, so a counter change doesn't wake the user-name widget.

This is the heart of Redux, Zustand and `useSyncExternalStore`.

## The leak you must avoid

Every `subscribe` creates a reference from a long-lived emitter to your listener. If the owner goes away without unsubscribing, **the listener (and everything it captured) lives forever**, and keeps running.

![A listener leak](fig:pat-leak "The emitter outlives the widget, so it keeps the widget alive.")

The cure is discipline: keep every unsubscribe function and call it when the owner is done. A small **scope** object that collects cleanups and disposes them together makes that easy. It is exactly the idea behind React's `useEffect` cleanup function.

## Signals: subscriptions that discover themselves

Manual subscription lists get tedious. **Signals** (in Solid, Vue's `ref`, Preact, Angular) track dependencies **automatically**: while a function runs, anything it reads registers it as a subscriber.

![A signal graph](fig:pat-signals "Reading a signal inside a computed or an effect is what subscribes it.")

```js
const a = signal(1), b = signal(2);
const sum = computed(() => a.get() + b.get());   // lazy and cached
effect(() => console.log('sum is', sum.get()));  // runs now, and again when a or b changes
a.set(5);                                        // logs: sum is 7
```

No subscribe calls: reading `a.get()` inside the function **is** the subscription. Dependencies can even change as the code runs (a conditional that reads `a` or `b`), and the graph follows.

## Quick check

```check
Q: What does the observer pattern decouple?
A) Data from storage
B) The thing that changes from the things that react to it *
C) Functions from classes
D) Tests from code
Why: The subject only knows a list of listener functions, not who they are.
---
Q: Why copy the listener array before looping in emit?
A) It is faster
B) A listener may subscribe or unsubscribe during the emit, which would corrupt a live loop *
C) Arrays can't be iterated twice
D) To sort listeners
Why: Iterating a snapshot keeps the emit predictable.
---
Q: What is the main danger of subscribing and never unsubscribing?
A) Syntax errors
B) The long-lived emitter keeps the listener (and what it captured) alive: a memory leak and stale work *
C) Slower typing
D) None
Why: The emitter holds a reference to every listener it hasn't dropped.
---
Q: A store with a `select(selector, listener)` should call the listener when...
A) Any state changes
B) The selected value changes (by Object.is) *
C) Every second
D) Never
Why: Subscribers watching a slice shouldn't wake up for unrelated changes.
---
Q: How does a signal-based `effect` know what to re-run on?
A) You list its dependencies by hand
B) It records which signals were read while it ran *
C) It polls every signal
D) It reruns on every change anywhere
Why: Automatic dependency tracking: reads during execution are the subscriptions.
```

## Recap

- **Observer**: a list of listener functions; `on` returns an **unsubscribe**; `emit` loops over a **snapshot**.
- **Pub/sub**: a bus with topics keeps publishers and subscribers strangers. Support `once`, wildcards and **isolated errors**.
- **Stores** notify only on **real change** and offer **selectors**.
- **Always unsubscribe**: collect cleanups in a **scope** and dispose it.
- **Signals** discover dependencies by watching reads.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: an emitter | A `Map` of arrays; `on` returns an unsubscribe |
| An event bus | A snapshot per emit, `once`, a wildcard, error isolation |
| An observable store | Shallow merge, a change check, `select` with `Object.is` |
| A subscription scope | Cleanups in reverse order, dispose once, late `add` |
| Signals, computed and effects | An "active observer" variable and sets of subscribers |

%% exercise pat-guided-emitter | Guided: an emitter | 1 | js | js | createEmitter | 8 | guided
Implement `createEmitter()`:

- `on(event, listener)` registers the listener and returns a function that **unsubscribes** it.
- `emit(event, ...args)` calls every listener for that event, **in registration order**, passing the arguments.
- Emitting an event nobody listens to does nothing.

```js
const bus = createEmitter();
const off = bus.on('hi', (n) => console.log(n));
bus.emit('hi', 1); // logs 1
off();
bus.emit('hi', 2); // nothing
```

%% worked
**A similar problem, solved: `createHooks()`** — a list of callbacks per name, with removal.

```js
function createHooks() {
  const lists = new Map();
  return {
    add(name, fn) {
      if (!lists.has(name)) lists.set(name, []);              // ① one array per name
      lists.get(name).push(fn);
      return () => {                                          // ② the removal function remembers name and fn
        const list = lists.get(name);
        list.splice(list.indexOf(fn), 1);
      };
    },
    run(name, ...args) {
      for (const fn of lists.get(name) ?? []) fn(...args);    // ③ tolerate "nobody listens"
    },
  };
}
```

Your emitter is the same shape. Guard the removal so calling it twice doesn't remove some **other** listener (`indexOf` returns `-1` the second time).

%% explain
- **A `Map`** from event name to an array of listeners.
- **`on`** returns an **unsubscribe** function.
- **`emit`** runs listeners in order with the arguments.
- **Unsubscribing twice** is harmless.

%% nudge
- What does `indexOf` return when the item is not there, and why does that matter for `splice`?
- What should `emit` do when the event has no listeners?

%% starter
```js
export function createEmitter() {
  const listeners = new Map();
  return {
    on(event, listener) {
      // register it, return a function that removes it
      return () => {};
    },
    emit(event, ...args) {
      // call every listener
    },
  };
}
```

%% tests
```js
describe('createEmitter', () => {
  it('calls listeners with the arguments, in order', () => {
    const bus = createEmitter();
    const calls = [];
    bus.on('x', (a, b) => calls.push(['first', a, b]));
    bus.on('x', (a, b) => calls.push(['second', a, b]));
    bus.emit('x', 1, 2);
    expect(calls).toEqual([['first', 1, 2], ['second', 1, 2]]);
  });
  it('keeps events separate', () => {
    const bus = createEmitter();
    const a = jest.fn(), b = jest.fn();
    bus.on('a', a); bus.on('b', b);
    bus.emit('a', 1);
    expect(a).toHaveBeenCalledWith(1);
    expect(b).not.toHaveBeenCalled();
  });
  it('unsubscribes', () => {
    const bus = createEmitter();
    const fn = jest.fn();
    const off = bus.on('x', fn);
    bus.emit('x');
    off();
    bus.emit('x');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('unsubscribing twice does not remove another listener', () => {
    const bus = createEmitter();
    const a = jest.fn(), b = jest.fn();
    const offA = bus.on('x', a);
    bus.on('x', b);
    offA(); offA();
    bus.emit('x');
    expect(b).toHaveBeenCalledTimes(1);
  });
  it('emitting with no listeners is fine', () => {
    expect(() => createEmitter().emit('nothing', 1)).not.toThrow();
  });
  it('allows the same function on two events', () => {
    const bus = createEmitter();
    const fn = jest.fn();
    bus.on('a', fn); bus.on('b', fn);
    bus.emit('a'); bus.emit('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

%% hints
- `if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(listener);`
- Unsubscribe: `const i = list.indexOf(listener); if (i >= 0) list.splice(i, 1);`
- `emit`: `for (const fn of listeners.get(event) ?? []) fn(...args);`

%% solution
```js
export function createEmitter() {
  const listeners = new Map();
  return {
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(listener);
      return () => {
        const list = listeners.get(event);
        const i = list.indexOf(listener);
        if (i >= 0) list.splice(i, 1);
      };
    },
    emit(event, ...args) {
      for (const fn of listeners.get(event) ?? []) fn(...args);
    },
  };
}
```

%% exercise pat-event-bus | A robust event bus | 3 | js | js | createBus | 26
Implement `createBus({ onError } = {})` with:

- `on(event, fn)` returns an **unsubscribe** function; `once(event, fn)` is like `on` but runs at most one time (and also returns an unsubscribe); `off(event, fn)` removes a listener by function.
- `emit(event, ...args)` calls the listeners for `event` in registration order, **then** the **wildcard** listeners registered on `'*'`, which receive `(event, ...args)`. It returns the **number of listeners called**.
- Each emit uses a **snapshot**: listeners added or removed *during* the emit don't change that emit.
- If a listener **throws**, the others still run. With `onError`, it is called as `onError(error, event)`; without it, the **first** error is rethrown **after** every listener ran. A listener that threw still counts as called.
- `listenerCount(event)` returns the number registered for that name.

```js
const bus = createBus();
bus.on('x', (n) => console.log(n));
bus.emit('x', 1); // returns 1
```

%% worked
**A similar problem, solved: `createNotifier()`** — snapshot, `once` and error isolation in one loop.

```js
function createNotifier(onError) {
  const entries = [];
  return {
    add(fn, once = false) { entries.push({ fn, once, done: false }); },
    fire(...args) {
      let called = 0;
      for (const e of [...entries]) {                   // ① a snapshot: later changes don't matter
        if (e.once) {
          if (e.done) continue;                         // ② a once-listener never fires twice, even if emit is re-entered
          e.done = true;
          entries.splice(entries.indexOf(e), 1);        // ③ remove it BEFORE calling
        }
        called++;
        try { e.fn(...args); } catch (err) { onError?.(err); }   // ④ one failure must not stop the rest
      }
      return called;
    },
  };
}
```

Combining the specific and wildcard lists is just two snapshots chained together.

%% explain
- **Registry** of entries (`fn`, `once`) per event name.
- **Emit order**: event listeners, then `'*'` listeners with the event name first.
- **`once`** removes itself before running and never fires twice.
- **Errors** are isolated: `onError`, or rethrow the first at the end.
- **Count** includes listeners that threw.

%% nudge
- When must a `once` entry be removed: before or after calling it? Why?
- How do you rethrow an error only after all listeners ran?

%% starter
```js
export function createBus({ onError } = {}) {
  return {
    on(event, fn) { return () => {}; },
    once(event, fn) { return () => {}; },
    off(event, fn) {},
    emit(event, ...args) { return 0; },
    listenerCount(event) { return 0; },
  };
}
```

%% tests
```js
describe('createBus', () => {
  it('calls listeners in order and returns the count', () => {
    const bus = createBus();
    const order = [];
    bus.on('x', (v) => order.push('a' + v));
    bus.on('x', (v) => order.push('b' + v));
    expect(bus.emit('x', 1)).toBe(2);
    expect(order).toEqual(['a1', 'b1']);
    expect(bus.emit('nobody')).toBe(0);
  });
  it('unsubscribes with the returned function and with off', () => {
    const bus = createBus();
    const a = jest.fn(), b = jest.fn();
    const offA = bus.on('x', a);
    bus.on('x', b);
    offA();
    bus.off('x', b);
    expect(bus.emit('x')).toBe(0);
    expect(bus.listenerCount('x')).toBe(0);
  });
  it('once runs a single time', () => {
    const bus = createBus();
    const fn = jest.fn();
    bus.once('x', fn);
    expect(bus.listenerCount('x')).toBe(1);
    bus.emit('x', 5); bus.emit('x', 6);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(5);
    expect(bus.listenerCount('x')).toBe(0);
  });
  it('once can be cancelled before it fires', () => {
    const bus = createBus();
    const fn = jest.fn();
    const off = bus.once('x', fn);
    off();
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
  });
  it('wildcard listeners hear everything with the event name first', () => {
    const bus = createBus();
    const seen = [];
    bus.on('x', () => seen.push('x'));
    bus.on('*', (event, ...args) => seen.push(['*', event, ...args]));
    expect(bus.emit('x', 1, 2)).toBe(2);
    expect(bus.emit('y', 3)).toBe(1);
    expect(seen).toEqual(['x', ['*', 'x', 1, 2], ['*', 'y', 3]]);
  });
  it('uses a snapshot during emit', () => {
    const bus = createBus();
    const late = jest.fn();
    const calls = [];
    const offB = bus.on('x', () => calls.push('b'));
    bus.on('x', () => calls.push('a'));
    bus.on('x', () => { bus.on('x', late); });
    bus.emit('x');
    expect(late).not.toHaveBeenCalled();
    bus.emit('x');
    expect(late).toHaveBeenCalledTimes(1);
    offB();
  });
  it('a listener removed during an emit still runs for that emit', () => {
    const bus = createBus();
    const calls = [];
    let offSecond;
    bus.on('x', () => { calls.push('first'); offSecond(); });
    offSecond = bus.on('x', () => calls.push('second'));
    bus.emit('x');
    bus.emit('x');
    expect(calls).toEqual(['first', 'second', 'first']);
  });
  it('isolates errors and reports them to onError', () => {
    const onError = jest.fn();
    const bus = createBus({ onError });
    const after = jest.fn();
    const boom = new Error('boom');
    bus.on('x', () => { throw boom; });
    bus.on('x', after);
    expect(bus.emit('x', 1)).toBe(2);
    expect(after).toHaveBeenCalledWith(1);
    expect(onError).toHaveBeenCalledWith(boom, 'x');
  });
  it('without onError the first error is rethrown after every listener ran', () => {
    const bus = createBus();
    const after = jest.fn();
    bus.on('x', () => { throw new Error('first'); });
    bus.on('x', () => { throw new Error('second'); });
    bus.on('x', after);
    expect(() => bus.emit('x')).toThrow('first');
    expect(after).toHaveBeenCalledTimes(1);
  });
});
```

%% hints
- Store `{ fn, once }` entries in `map.get(event)`; `emit` builds a snapshot `[...specific.map(e => [e, event, false]), ...wildcard.map(...)]`.
- Wildcards call `e.fn(event, ...args)`; normal listeners call `e.fn(...args)`.
- Collect `firstError` and rethrow after the loop when there's no `onError`.

%% solution
```js
export function createBus({ onError } = {}) {
  const map = new Map();
  const listOf = (event) => {
    if (!map.has(event)) map.set(event, []);
    return map.get(event);
  };
  const removeEntry = (event, entry) => {
    const list = map.get(event);
    if (!list) return;
    const i = list.indexOf(entry);
    if (i >= 0) list.splice(i, 1);
  };
  const add = (event, entry) => {
    listOf(event).push(entry);
    return () => removeEntry(event, entry);
  };
  return {
    on: (event, fn) => add(event, { fn, once: false, done: false }),
    once: (event, fn) => add(event, { fn, once: true, done: false }),
    off(event, fn) {
      const list = map.get(event);
      if (!list) return;
      const i = list.findIndex((e) => e.fn === fn);
      if (i >= 0) list.splice(i, 1);
    },
    emit(event, ...args) {
      const specific = (map.get(event) || []).map((entry) => ({ entry, name: event, wild: false }));
      const wild = event === '*' ? [] : (map.get('*') || []).map((entry) => ({ entry, name: '*', wild: true }));
      let called = 0;
      let failed = false;
      let firstError;
      for (const { entry, name, wild: isWild } of [...specific, ...wild]) {
        if (entry.once) {
          if (entry.done) continue;
          entry.done = true;
          removeEntry(name, entry);
        }
        called++;
        try {
          if (isWild) entry.fn(event, ...args);
          else entry.fn(...args);
        } catch (error) {
          if (onError) onError(error, event);
          else if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
      if (failed) throw firstError;
      return called;
    },
    listenerCount: (event) => (map.get(event) || []).length,
  };
}
```

%% exercise pat-store | An observable store | 3 | js | js | createStore | 22
Implement `createStore(initial)`:

- `getState()` returns the current state object.
- `setState(patch)` shallow-merges `patch` into a **new** state object (the old object is never mutated). `patch` may also be a **function** `(state) => patch`.
- If **no key actually changes** (every patched value is `Object.is`-equal to the current one), nothing happens: the state object stays the same reference and nobody is notified.
- `subscribe(listener)` returns an unsubscribe function. After a real change, each listener is called with `(state, prevState)`, in subscription order. It is **not** called immediately on subscribe.
- `select(selector, listener)` subscribes to a **slice**: after a change, if `selector(state)` differs (by `Object.is`) from `selector(prevState)`, call `listener(value, prevValue)`. It returns an unsubscribe function.

```js
const store = createStore({ count: 0, user: 'ada' });
store.select((s) => s.count, (v, old) => console.log(old, '→', v));
store.setState({ user: 'bo' });   // nothing logged
store.setState({ count: 1 });     // 0 → 1
```

%% worked
**A similar problem, solved: `createCell(initial)`** — one value, with change detection.

```js
function createCell(initial) {
  let value = initial;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;                   // ① no change, no news
      const prev = value;
      value = next;
      for (const l of [...listeners]) l(value, prev);       // ② snapshot, then notify with new and old
    },
    subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}
```

A store is a cell whose value is an object that is **replaced** (never mutated) on each change. `select` is just a subscriber that compares `selector(next)` with `selector(prev)` before calling the real listener.

%% explain
- **Immutable updates**: a new state object per real change.
- **Change check** over the patched keys; the same reference when unchanged.
- **Listeners** get `(state, prevState)`; selectors get `(value, prevValue)` only when it changed.
- **Function patches** receive the current state.

%% nudge
- How do you decide that a patch changes nothing?
- Can `select` be built on top of `subscribe`?

%% starter
```js
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    getState: () => state,
    setState(patch) {},
    subscribe(listener) { return () => {}; },
    select(selector, listener) { return () => {}; },
  };
}
```

%% tests
```js
describe('createStore', () => {
  it('merges patches into a new object', () => {
    const store = createStore({ a: 1, b: 2 });
    const before = store.getState();
    store.setState({ b: 3 });
    expect(store.getState()).toEqual({ a: 1, b: 3 });
    expect(before).toEqual({ a: 1, b: 2 });
    expect(store.getState()).not.toBe(before);
  });
  it('accepts a function patch', () => {
    const store = createStore({ n: 1 });
    store.setState((s) => ({ n: s.n + 1 }));
    store.setState((s) => ({ n: s.n * 10 }));
    expect(store.getState().n).toBe(20);
  });
  it('notifies with state and previous state, in order', () => {
    const store = createStore({ n: 0 });
    const calls = [];
    store.subscribe((s, p) => calls.push(['a', s.n, p.n]));
    store.subscribe((s, p) => calls.push(['b', s.n, p.n]));
    store.setState({ n: 1 });
    expect(calls).toEqual([['a', 1, 0], ['b', 1, 0]]);
  });
  it('does not notify when nothing changed', () => {
    const store = createStore({ n: 0, user: 'ada' });
    const listener = jest.fn();
    store.subscribe(listener);
    const before = store.getState();
    store.setState({ n: 0 });
    store.setState({});
    store.setState({ user: 'ada' });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });
  it('treats NaN as unchanged and objects by reference', () => {
    const obj = {};
    const store = createStore({ x: NaN, o: obj });
    const listener = jest.fn();
    store.subscribe(listener);
    store.setState({ x: NaN, o: obj });
    expect(listener).not.toHaveBeenCalled();
    store.setState({ o: {} });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('does not call a subscriber immediately and supports unsubscribe', () => {
    const store = createStore({ n: 0 });
    const listener = jest.fn();
    const off = store.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
    store.setState({ n: 1 });
    off();
    store.setState({ n: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('select reports only changes of the slice', () => {
    const store = createStore({ count: 0, user: 'ada' });
    const listener = jest.fn();
    store.select((s) => s.count, listener);
    store.setState({ user: 'bo' });
    expect(listener).not.toHaveBeenCalled();
    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledWith(1, 0);
    store.setState({ count: 1, user: 'cy' });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('select can be unsubscribed and works with derived values', () => {
    const store = createStore({ items: [1, 2] });
    const listener = jest.fn();
    const off = store.select((s) => s.items.length, listener);
    store.setState({ items: [1, 2, 3] });
    expect(listener).toHaveBeenCalledWith(3, 2);
    off();
    store.setState({ items: [1] });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
```

%% hints
- Change check: `const keys = Object.keys(next); const changed = keys.some((k) => !Object.is(next[k], state[k]));` (a missing key counts as `undefined`).
- On change: `const prev = state; state = { ...state, ...next }; for (const l of [...listeners]) l(state, prev);`
- `select`: `return subscribe((s, p) => { const a = selector(s), b = selector(p); if (!Object.is(a, b)) listener(a, b); });`

%% solution
```js
export function createStore(initial) {
  let state = initial;
  const listeners = new Set();
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    getState: () => state,
    setState(patch) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      const changed = Object.keys(next).some((k) => !Object.is(next[k], state[k]));
      if (!changed) return;
      const prev = state;
      state = { ...state, ...next };
      for (const listener of [...listeners]) listener(state, prev);
    },
    subscribe,
    select(selector, listener) {
      return subscribe((s, p) => {
        const value = selector(s);
        const old = selector(p);
        if (!Object.is(value, old)) listener(value, old);
      });
    },
  };
}
```

%% exercise pat-scope | A subscription scope | 2 | js | js | createScope | 16
Implement `createScope()`, a bag of cleanups that you dispose together.

- `add(cleanup)` registers a cleanup function and returns it. If the scope is **already disposed**, the cleanup runs **immediately**.
- `on(target, event, listener)` calls `target.on(event, listener)` (which returns an unsubscribe function), registers that unsubscribe as a cleanup, and returns it.
- `dispose()` runs every cleanup in **reverse** order of registration, **once**. Later calls do nothing. If cleanups throw, **all still run** and the **first** error is rethrown at the end.
- `disposed` is a property that is `true` after `dispose()` has been called.

```js
const scope = createScope();
scope.on(bus, 'x', handler);
scope.add(() => clearInterval(timer));
scope.dispose(); // unsubscribes and clears the timer
```

%% worked
**A similar problem, solved: `createStack()` of undo actions** — run in reverse, tolerate failure.

```js
function createUndoStack() {
  const undos = [];
  return {
    push(fn) { undos.push(fn); },
    undoAll() {
      let firstError, failed = false;
      while (undos.length) {
        const fn = undos.pop();                                 // ① last in, first out
        try { fn(); } catch (e) { if (!failed) { failed = true; firstError = e; } }   // ② keep going
      }
      if (failed) throw firstError;                             // ③ report afterwards
    },
  };
}
```

Reverse order matters: things set up later often depend on things set up earlier, so you tear down the **newest first**.

%% explain
- **Cleanups** in an array; **disposed** flag.
- **Reverse order**, each run once; **errors** don't stop the rest.
- **Late `add`** after dispose runs the cleanup at once.
- **`on`** wires up and registers the unsubscribe.

%% nudge
- What should happen if someone adds a cleanup after the scope is gone?
- How do you run everything and still report a failure?

%% starter
```js
export function createScope() {
  const cleanups = [];
  let disposed = false;
  return {
    add(cleanup) { return cleanup; },
    on(target, event, listener) { return () => {}; },
    dispose() {},
    get disposed() { return disposed; },
  };
}
```

%% tests
```js
describe('createScope', () => {
  it('runs cleanups in reverse order, once', () => {
    const scope = createScope();
    const calls = [];
    scope.add(() => calls.push('a'));
    scope.add(() => calls.push('b'));
    scope.add(() => calls.push('c'));
    scope.dispose();
    scope.dispose();
    expect(calls).toEqual(['c', 'b', 'a']);
  });
  it('add returns the cleanup', () => {
    const scope = createScope();
    const fn = () => {};
    expect(scope.add(fn)).toBe(fn);
  });
  it('tracks disposed', () => {
    const scope = createScope();
    expect(scope.disposed).toBe(false);
    scope.dispose();
    expect(scope.disposed).toBe(true);
  });
  it('runs a cleanup added after dispose immediately', () => {
    const scope = createScope();
    scope.dispose();
    const fn = jest.fn();
    scope.add(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('on() subscribes and unsubscribes through the scope', () => {
    const handlers = [];
    const target = { on: (event, fn) => { handlers.push(fn); return () => handlers.splice(handlers.indexOf(fn), 1); } };
    const scope = createScope();
    const listener = () => {};
    const off = scope.on(target, 'x', listener);
    expect(typeof off).toBe('function');
    expect(handlers).toEqual([listener]);
    scope.dispose();
    expect(handlers).toEqual([]);
  });
  it('runs every cleanup even when some throw, rethrowing the first error', () => {
    const scope = createScope();
    const calls = [];
    scope.add(() => calls.push('a'));
    scope.add(() => { calls.push('b'); throw new Error('b failed'); });
    scope.add(() => { calls.push('c'); throw new Error('c failed'); });
    expect(() => scope.dispose()).toThrow('c failed');
    expect(calls).toEqual(['c', 'b', 'a']);
    expect(scope.disposed).toBe(true);
  });
});
```

%% hints
- `dispose`: `if (disposed) return; disposed = true; while (cleanups.length) { const fn = cleanups.pop(); try { fn(); } catch (e) { ... } }`
- `add`: `if (disposed) cleanup(); else cleanups.push(cleanup); return cleanup;`
- `on`: `return scope.add(target.on(event, listener));`

%% solution
```js
export function createScope() {
  const cleanups = [];
  let disposed = false;
  const scope = {
    add(cleanup) {
      if (disposed) cleanup();
      else cleanups.push(cleanup);
      return cleanup;
    },
    on(target, event, listener) {
      return scope.add(target.on(event, listener));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      let failed = false;
      let firstError;
      while (cleanups.length) {
        const cleanup = cleanups.pop();
        try {
          cleanup();
        } catch (error) {
          if (!failed) {
            failed = true;
            firstError = error;
          }
        }
      }
      if (failed) throw firstError;
    },
    get disposed() {
      return disposed;
    },
  };
  return scope;
}
```

%% exercise pat-signals | Signals, computed values and effects | 4 | js | js | signal, computed, effect | 36
Build a tiny reactive core.

- `signal(initial)` returns `{ get(), set(next) }`. `set` with an `Object.is`-equal value does nothing.
- `computed(fn)` returns `{ get() }`. It is **lazy** (`fn` doesn't run until the first `get`) and **cached** (it only re-runs after a dependency changed).
- `effect(fn)` runs `fn` **immediately**, and again, **synchronously**, whenever a signal or computed it read changes. It returns a **dispose** function that stops it.
- Dependencies are discovered **automatically**: whatever `get()` calls run while `fn` executes. They are re-discovered on **every** run (conditional reads work).

```js
const a = signal(1), b = signal(2);
const sum = computed(() => a.get() + b.get());
effect(() => console.log(sum.get())); // 3
a.set(5);                             // 7
```

%% worked
**A similar problem, solved: `trackReads(fn)`** — find out what a function reads, by recording `get` calls.

```js
let current = null;                                    // ① "who is running right now?"

function cell(value) {
  const readers = new Set();
  return {
    get() {
      if (current) readers.add(current);               // ② reading registers the running observer
      return value;
    },
    set(next) { value = next; readers.forEach((r) => r()); },
  };
}

function observe(fn) {
  const run = () => { const prev = current; current = run; try { fn(); } finally { current = prev; } };   // ③ set, run, restore
  run();
}
```

A `signal` is `cell` plus the `Object.is` check. A `computed` is **both** an observer (of its dependencies) and a source (for whoever reads it); when a dependency changes it only marks itself **stale** and tells its readers.

%% explain
- **An "active observer" variable**, set while a computed or effect runs and restored afterwards.
- **Each signal** keeps the set of observers that read it.
- **`computed`** is dirty until read, caches its value, and notifies its own readers when a dependency changes.
- **`effect`** clears its old dependencies before each run, so conditional dependencies update.
- **Dispose** unsubscribes the effect.

%% nudge
- Why must an effect forget its previous dependencies before it re-runs?
- When a computed's dependency changes, should it recompute right away or wait to be read?

%% starter
```js
let active = null;

export function signal(initial) {
  let value = initial;
  return {
    get() { return value; },
    set(next) { value = next; },
  };
}

export function computed(fn) {
  return { get() { return fn(); } };
}

export function effect(fn) {
  fn();
  return () => {};
}
```

%% tests
```js
describe('signal', () => {
  it('gets and sets', () => {
    const s = signal(1);
    expect(s.get()).toBe(1);
    s.set(2);
    expect(s.get()).toBe(2);
  });
});

describe('effect', () => {
  it('runs immediately and on change', () => {
    const a = signal(1);
    const seen = [];
    effect(() => seen.push(a.get()));
    a.set(2);
    a.set(3);
    expect(seen).toEqual([1, 2, 3]);
  });
  it('does not re-run for an equal value', () => {
    const a = signal(1);
    const fn = jest.fn(() => a.get());
    effect(fn);
    a.set(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('tracks several signals', () => {
    const a = signal(1), b = signal(10);
    const seen = [];
    effect(() => seen.push(a.get() + b.get()));
    a.set(2);
    b.set(20);
    expect(seen).toEqual([11, 12, 22]);
  });
  it('re-discovers dependencies on every run', () => {
    const flag = signal(true), a = signal('a'), b = signal('b');
    const fn = jest.fn(() => (flag.get() ? a.get() : b.get()));
    effect(fn);
    b.set('b2');
    expect(fn).toHaveBeenCalledTimes(1);
    flag.set(false);
    expect(fn).toHaveBeenCalledTimes(2);
    a.set('a2');
    expect(fn).toHaveBeenCalledTimes(2);
    b.set('b3');
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it('stops after dispose', () => {
    const a = signal(1);
    const fn = jest.fn(() => a.get());
    const stop = effect(fn);
    stop();
    a.set(2);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('does not track reads from outside any effect', () => {
    const a = signal(1);
    a.get();
    const fn = jest.fn();
    effect(fn);
    a.set(2);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('computed', () => {
  it('is lazy and cached', () => {
    const a = signal(2);
    const fn = jest.fn(() => a.get() * 10);
    const c = computed(fn);
    expect(fn).not.toHaveBeenCalled();
    expect(c.get()).toBe(20);
    expect(c.get()).toBe(20);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('recomputes after a dependency changes, once', () => {
    const a = signal(1), b = signal(2);
    const fn = jest.fn(() => a.get() + b.get());
    const c = computed(fn);
    expect(c.get()).toBe(3);
    a.set(10);
    a.set(20);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(c.get()).toBe(22);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('feeds effects', () => {
    const a = signal(1), b = signal(2);
    const sum = computed(() => a.get() + b.get());
    const seen = [];
    effect(() => seen.push(sum.get()));
    a.set(5);
    b.set(5);
    expect(seen).toEqual([3, 7, 10]);
  });
  it('chains computed values', () => {
    const a = signal(1);
    const double = computed(() => a.get() * 2);
    const label = computed(() => 'x' + double.get());
    const seen = [];
    effect(() => seen.push(label.get()));
    a.set(4);
    expect(seen).toEqual(['x2', 'x8']);
  });
  it('can be read inside another computed without an effect', () => {
    const a = signal(3);
    const sq = computed(() => a.get() ** 2);
    const plus = computed(() => sq.get() + 1);
    expect(plus.get()).toBe(10);
    a.set(4);
    expect(plus.get()).toBe(17);
  });
});
```

%% hints
- A shared `active` observer object `{ deps: Set, notify() }`. `signal.get` adds `active` to its `subs` set and adds `subs` to `active.deps`.
- Before each run, `cleanup(observer)`: delete the observer from every set in `deps`, then clear `deps`.
- `computed`: `dirty` flag; `notify()` sets `dirty = true` and notifies its own `subs`; `get()` recomputes only when dirty.
- `effect.notify()` re-runs the effect (unless disposed).

%% solution
```js
let active = null;

function cleanup(observer) {
  for (const subs of observer.deps) subs.delete(observer);
  observer.deps.clear();
}

function track(observer, fn) {
  cleanup(observer);
  const previous = active;
  active = observer;
  try {
    return fn();
  } finally {
    active = previous;
  }
}

function subscribe(subs) {
  if (active) {
    subs.add(active);
    active.deps.add(subs);
  }
}

export function signal(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get() {
      subscribe(subs);
      return value;
    },
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const observer of [...subs]) observer.notify();
    },
  };
}

export function computed(fn) {
  let dirty = true;
  let cached;
  const subs = new Set();
  const observer = {
    deps: new Set(),
    notify() {
      if (dirty) return;
      dirty = true;
      for (const s of [...subs]) s.notify();
    },
  };
  return {
    get() {
      subscribe(subs);
      if (dirty) {
        cached = track(observer, fn);
        dirty = false;
      }
      return cached;
    },
  };
}

export function effect(fn) {
  let disposed = false;
  const observer = {
    deps: new Set(),
    notify() {
      if (!disposed) track(observer, fn);
    },
  };
  track(observer, fn);
  return () => {
    disposed = true;
    cleanup(observer);
  };
}
```
