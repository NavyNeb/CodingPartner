---
id: closures
track: js
title: Closures & scope
summary: The one idea underneath callbacks, hooks, module patterns and most "trick" questions.
---

A **closure** is a function bundled with the variables that were in scope where it was *created* — not where it is *called*. That's the whole definition. Everything else in this lesson is consequences.

## Lexical scope, concretely

Every time a function runs, the engine creates a fresh **environment record**: a little table of that call's variables, plus a pointer to the environment of wherever the function was defined. Looking up a name walks that chain outward until it finds a match.

```js
function outer() {
  let count = 0;            // lives in outer's environment
  return function inner() {
    count += 1;             // found by walking one link outward
    return count;
  };
}

const a = outer();
const b = outer();          // a second call → a second, separate environment
a(); a();                   // 1, 2
b();                        // 1  — b never saw a's count
```

`outer` has returned, so you might expect `count` to be gone. It isn't, because `inner` still holds a pointer to that environment. As long as *anything* can still reach `inner`, the environment stays alive.

> **Mental model:** a closure is a function with a backpack. The backpack holds *references* to variables, not copies of their values.

That last sentence matters. Two closures created in the same scope share the same variables:

```js
function pair() {
  let n = 0;
  return { inc: () => ++n, read: () => n };
}
const p = pair();
p.inc(); p.inc();
p.read(); // 2 — both functions look at the same `n`
```

## What closures buy you

- **Private state** without classes. There is no way to reach `n` above except through `inc` and `read`.
- **Function factories.** `makeMultiplier(3)` returns a function that remembers `3`.
- **Callbacks that remember context.** Every `setTimeout(() => use(x), 100)` is a closure over `x`.
- **Partial application, memoization, once-only guards, debounce** — the rest of this track builds on it.

## The classic trap: `var` in loops

```js
var fns = [];
for (var i = 0; i < 3; i++) {
  fns.push(() => i);
}
fns.map((f) => f()); // [3, 3, 3]  — not [0, 1, 2]
```

`var` is **function-scoped**, so there is exactly one `i` shared by all three arrows, and it is `3` by the time they run. `let` in a `for` header is special-cased: the engine makes a **new binding per iteration**, so each arrow captures its own `i`.

Pre-ES6 fix was an IIFE that copied the value into a fresh scope: `(function (j) { fns.push(() => j); })(i)`. Know it — interviewers still ask.

## Stale closures (a preview of React)

A closure captures the variable's *binding*, but if the thing you captured is an old *value* (say, a number you destructured), it can go stale:

```js
function makeLogger(user) {
  const { name } = user;          // snapshot of the value right now
  return () => console.log(name); // will always print the old name
}
```

React's `useEffect` and `useCallback` bugs are almost all this. Keep it in mind — we come back to it in the React track.

## Memory

A closure keeps its *entire* enclosing environment reachable (engines optimise this, but don't rely on it). Holding a long-lived callback that closes over a huge array is a classic leak. Null things out, or don't capture them.

## Checklist before you continue

- Can you say *why* `a()` and `b()` above don't interfere?
- Can you explain `[3, 3, 3]` without using the word "hoisting"?
- What's captured: the value or the variable?

%% exercise closures-counter | Counter factory | 1 | js | js | makeCounter | 4
Write `makeCounter()`. Each call returns a **new, independent** function. Calling that function returns `1`, then `2`, then `3`, and so on.

```js
const a = makeCounter();
const b = makeCounter();
a(); // 1
a(); // 2
b(); // 1
```

%% starter
```js
export function makeCounter() {
  // your code
}
```

%% tests
```js
describe('makeCounter', () => {
  it('counts up from 1', () => {
    const next = makeCounter();
    expect([next(), next(), next()]).toEqual([1, 2, 3]);
  });

  it('gives every counter its own state', () => {
    const a = makeCounter();
    const b = makeCounter();
    a(); a();
    expect(b()).toBe(1);
    expect(a()).toBe(3);
  });

  it('does not leak state through a module-level variable', () => {
    const first = makeCounter();
    first(); first();
    const later = makeCounter();
    expect(later()).toBe(1);
  });
});
```

%% hints
- The state must live *inside* `makeCounter`, but outside the function you return.
- `let count = 0;` then return `() => ++count`.

%% solution
```js
export function makeCounter() {
  let count = 0;
  return () => ++count;
}
```

%% exercise closures-once | once() | 2 | js | js | once | 8
Write `once(fn)`. It returns a function that calls `fn` **the first time only** and then keeps returning that first result, ignoring later arguments.

```js
const init = once(() => { console.log('booting'); return 42; });
init(); // logs "booting", returns 42
init(); // returns 42, no log
```

The wrapper must forward its arguments and `this` to `fn` on that first call.

%% starter
```js
export function once(fn) {
  // your code
}
```

%% tests
```js
describe('once', () => {
  it('calls the function only once', () => {
    const fn = jest.fn(() => 'x');
    const wrapped = once(fn);
    wrapped(); wrapped(); wrapped();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns the first result every time', () => {
    let n = 0;
    const wrapped = once(() => ++n);
    expect([wrapped(), wrapped(), wrapped()]).toEqual([1, 1, 1]);
  });

  it('forwards arguments on the first call and ignores later ones', () => {
    const fn = jest.fn((a, b) => a + b);
    const wrapped = once(fn);
    expect(wrapped(2, 3)).toBe(5);
    expect(wrapped(10, 20)).toBe(5);
    expect(fn).toHaveBeenCalledWith(2, 3);
  });

  it('preserves `this`', () => {
    const obj = { v: 7, get: once(function () { return this.v; }) };
    expect(obj.get()).toBe(7);
  });

  it('remembers a first result of undefined (does not re-run)', () => {
    const fn = jest.fn(() => undefined);
    const wrapped = once(fn);
    wrapped(); wrapped();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('each once() has its own flag', () => {
    const a = once(() => 'a');
    const b = once(() => 'b');
    a();
    expect(b()).toBe('b');
  });
});
```

%% hints
- You need two pieces of closed-over state: *has it run?* and *what did it return?*
- Checking `result === undefined` is a bug — a function may legitimately return `undefined`. Use a boolean flag.
- A regular `function` wrapper (not an arrow) lets you use `fn.apply(this, args)`.

%% solution
```js
export function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}
```

%% exercise closures-loop-trap | The loop trap | 2 | js | js | makeThunks | 6
`makeThunks(n)` should return an array of `n` functions, where the function at index `k` returns `k`. The version below returns `n` for all of them.

Fix it **without changing its shape** (still a loop pushing functions into an array).

%% starter
```js
export function makeThunks(n) {
  var fns = [];
  for (var i = 0; i < n; i++) {
    fns.push(function () {
      return i;
    });
  }
  return fns;
}
```

%% tests
```js
describe('makeThunks', () => {
  it('returns n functions', () => {
    expect(makeThunks(4)).toHaveLength(4);
    makeThunks(4).forEach((f) => expect(typeof f).toBe('function'));
  });

  it('each thunk returns its own index', () => {
    expect(makeThunks(3).map((f) => f())).toEqual([0, 1, 2]);
  });

  it('is stable when called after the loop is long finished', () => {
    const fns = makeThunks(5);
    expect(fns[4]()).toBe(4);
    expect(fns[0]()).toBe(0);
  });

  it('handles n = 0', () => {
    expect(makeThunks(0)).toEqual([]);
  });
});
```

%% hints
- There is only one `i`, shared by every function. The value it holds when they finally run is `n`.
- Two fixes: switch to `let`, or copy `i` into a fresh scope with an IIFE.

%% solution
```js
export function makeThunks(n) {
  const fns = [];
  for (let i = 0; i < n; i++) {
    fns.push(() => i);
  }
  return fns;
}
```

%% exercise closures-store | A tiny store | 3 | js | js | createStore | 15
Build `createStore(initialState)` — the core of Redux/Zustand in ~15 lines. It returns an object with:

- `getState()` → the current state.
- `setState(patch)` → `patch` is either an object to **shallow-merge** into state, or a function `(state) => partialObject`.
- `subscribe(listener)` → registers `listener(state, prevState)`; returns an `unsubscribe` function.

Rules:
- State is **never mutated** — every `setState` produces a new object, and `prevState` must still be the old one.
- Listeners run after the state has changed, in subscription order.
- Unsubscribing twice is harmless.
- A listener that unsubscribes *itself* while being notified must not cause other listeners to be skipped.

%% starter
```js
export function createStore(initialState) {
  // your code
}
```

%% tests
```js
describe('createStore', () => {
  it('returns the initial state', () => {
    const s = createStore({ n: 1 });
    expect(s.getState()).toEqual({ n: 1 });
  });

  it('merges object patches', () => {
    const s = createStore({ a: 1, b: 2 });
    s.setState({ b: 3 });
    expect(s.getState()).toEqual({ a: 1, b: 3 });
  });

  it('accepts an updater function', () => {
    const s = createStore({ n: 1 });
    s.setState((st) => ({ n: st.n + 1 }));
    s.setState((st) => ({ n: st.n + 1 }));
    expect(s.getState().n).toBe(3);
  });

  it('never mutates the previous state object', () => {
    const initial = { n: 1 };
    const s = createStore(initial);
    const before = s.getState();
    s.setState({ n: 2 });
    expect(before).toEqual({ n: 1 });
    expect(initial).toEqual({ n: 1 });
    expect(s.getState()).not.toBe(before);
  });

  it('notifies subscribers with (state, prevState)', () => {
    const s = createStore({ n: 0 });
    const spy = jest.fn();
    s.subscribe(spy);
    s.setState({ n: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ n: 1 }, { n: 0 });
  });

  it('getState inside a listener already sees the new state', () => {
    const s = createStore({ n: 0 });
    let seen;
    s.subscribe(() => { seen = s.getState().n; });
    s.setState({ n: 9 });
    expect(seen).toBe(9);
  });

  it('calls listeners in subscription order', () => {
    const s = createStore({});
    const order = [];
    s.subscribe(() => order.push('a'));
    s.subscribe(() => order.push('b'));
    s.setState({ x: 1 });
    expect(order).toEqual(['a', 'b']);
  });

  it('unsubscribe stops notifications, and is idempotent', () => {
    const s = createStore({ n: 0 });
    const spy = jest.fn();
    const off = s.subscribe(spy);
    s.setState({ n: 1 });
    off();
    off();
    s.setState({ n: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a listener unsubscribing itself does not skip the next listener', () => {
    const s = createStore({ n: 0 });
    const second = jest.fn();
    const off = s.subscribe(() => off());
    s.subscribe(second);
    s.setState({ n: 1 });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps separate stores independent', () => {
    const a = createStore({ n: 1 });
    const b = createStore({ n: 1 });
    a.setState({ n: 5 });
    expect(b.getState().n).toBe(1);
  });
});
```

%% hints
- State and the listener set are the two closed-over variables. No classes needed.
- Store listeners in a `Set` (or array) and iterate over a **copy** when notifying: `[...listeners].forEach(...)`.
- `typeof patch === 'function' ? patch(state) : patch`, then `state = { ...state, ...partial }`.

%% solution
```js
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState(patch) {
      const prev = state;
      const partial = typeof patch === 'function' ? patch(prev) : patch;
      state = { ...prev, ...partial };
      [...listeners].forEach((l) => l(state, prev));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
```

%% exercise closures-memoize | memoize() | 3 | js | js | memoize | 15
Write `memoize(fn, resolver?)`.

- Cache results by arguments. By default the cache key is `JSON.stringify(args)`.
- If `resolver` is given, the key is `resolver(...args)` instead.
- A cached result of `undefined` (or `null`, `0`, `false`) is still a cache hit.
- If `fn` **throws**, nothing is cached and the error propagates.
- The returned function has a `.clear()` method that empties the cache.
- `this` is forwarded to `fn`.

%% starter
```js
export function memoize(fn, resolver) {
  // your code
}
```

%% tests
```js
describe('memoize', () => {
  it('computes once per distinct argument list', () => {
    const fn = jest.fn((a, b) => a + b);
    const m = memoize(fn);
    expect(m(1, 2)).toBe(3);
    expect(m(1, 2)).toBe(3);
    expect(m(2, 1)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('treats different argument shapes as different keys', () => {
    const fn = jest.fn((...a) => a.length);
    const m = memoize(fn);
    m(1); m(1, undefined); m();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('caches falsy results, including undefined', () => {
    const fn = jest.fn(() => undefined);
    const m = memoize(fn);
    m('k'); m('k');
    const zero = jest.fn(() => 0);
    const mz = memoize(zero);
    mz(); mz();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(zero).toHaveBeenCalledTimes(1);
  });

  it('supports a custom resolver', () => {
    const fn = jest.fn((user) => user.name.toUpperCase());
    const m = memoize(fn, (user) => user.id);
    expect(m({ id: 1, name: 'ada' })).toBe('ADA');
    expect(m({ id: 1, name: 'changed' })).toBe('ADA');
    expect(m({ id: 2, name: 'bob' })).toBe('BOB');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not cache thrown errors', () => {
    let attempts = 0;
    const m = memoize(() => {
      attempts++;
      if (attempts === 1) throw new Error('boom');
      return 'ok';
    });
    expect(() => m()).toThrow('boom');
    expect(m()).toBe('ok');
    expect(m()).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('exposes clear()', () => {
    const fn = jest.fn((x) => x * 2);
    const m = memoize(fn);
    m(2); m(2);
    m.clear();
    m(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('forwards this', () => {
    const obj = { k: 10, calc: memoize(function (x) { return this.k + x; }) };
    expect(obj.calc(5)).toBe(15);
  });

  it('keeps caches of separate memoized functions apart', () => {
    const a = memoize((x) => `a${x}`);
    const b = memoize((x) => `b${x}`);
    a(1);
    expect(b(1)).toBe('b1');
  });
});
```

%% hints
- A `Map` keyed by the computed key. Use `cache.has(key)` — *not* `cache.get(key) !== undefined`.
- Only call `cache.set` after `fn` returns, so a throw leaves the cache untouched.
- Functions are objects: `memoized.clear = () => cache.clear()`.

%% solution
```js
export function memoize(fn, resolver) {
  const cache = new Map();

  function memoized(...args) {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  }

  memoized.clear = () => cache.clear();
  return memoized;
}
```
