---
id: functional
track: js
title: Functional patterns: composition, currying & streams
summary: Functions as values — compose them, partially apply them, and build a tiny reactive stream.
---

Functions in JavaScript are **first-class values**: you can store them, pass them, return them, and build new ones. Most "patterns" in this lesson are just that idea, used deliberately.

## Pure functions

A function is **pure** if its output depends only on its arguments and it causes no observable side effects. Pure code is trivially testable, cacheable (`memoize` is only *safe* for pure functions), parallelisable and easy to reason about. Real programs need effects (network, DOM, logging) — push them to the **edges** and keep the core pure. That's the whole architecture of React render functions and reducers.

## Higher-order functions

Take or return functions. `map`, `filter`, `setTimeout`, `debounce`, `useCallback`, event handlers, and every decorator you'll write.

## Composition

```js
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

const slugify = pipe(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/[^\w]+/g, '-'),
);
slugify('  Hello, World! '); // "hello-world"
```

`pipe` reads left-to-right (data flow), `compose` right-to-left (math order). Small named steps beat one clever function: each can be tested and reused. This works best when every step is **unary** (takes one value).

## Currying vs. partial application

- **Partial application** fixes *some* arguments now: `const add5 = add.bind(null, 5)`.
- **Currying** turns `f(a, b, c)` into `f(a)(b)(c)` — always one argument at a time.

```js
const add = (a) => (b) => a + b;
const inc = add(1);
[1, 2, 3].map(inc); // [2, 3, 4]
```

A general `curry(fn)` uses `fn.length` (the declared arity) to know when it has enough arguments. Caveat: default and rest parameters aren't counted in `length`.

## Point-free and its limits

`arr.map(parseInt)` is "point-free" and **wrong** (the index becomes the radix). Point-free style is only safe when the callee ignores extra arguments — otherwise write the arrow.

## Selectors & memoization by identity

State libraries derive data with *selectors*. The trick (reselect, `useMemo`): recompute only when the **inputs** changed by reference. It relies on immutability — if you mutate, the identity check lies.

## Streams, in one page

A callback answers "give me the next value once". A **promise** answers it once, later. An **observable** is a *push-based sequence over time*: many values, plus completion and error, plus **teardown** (unsubscribe). It's lazy ("cold"): nothing happens until someone subscribes, and each subscriber gets its own run. Operators (`map`, `filter`, `take`) return new observables that wrap the source — function composition again. The building blocks are exactly closures + callbacks; RxJS is a big version of the last exercise.

%% exercise fp-pipe-compose | pipe & compose | 2 | js | js | pipe, compose | 8
- `pipe(f, g, h)(x)` → `h(g(f(x)))`. The **first** function may take multiple arguments; the rest get one.
- `compose(f, g, h)(x)` → `f(g(h(x)))`. The **last** function may take multiple arguments.
- With no functions, both return their first argument unchanged.
- The result must not share state between calls.

%% starter
```js
export function pipe(...fns) {
  // your code
}

export function compose(...fns) {
  // your code
}
```

%% tests
```js
const inc = (x) => x + 1;
const dbl = (x) => x * 2;
const sq = (x) => x * x;

describe('pipe', () => {
  it('runs left to right', () => expect(pipe(inc, dbl, sq)(1)).toBe(16));
  it('lets the first function take several arguments', () => {
    expect(pipe((a, b) => a + b, dbl)(1, 2)).toBe(6);
  });
  it('is the identity with no functions', () => {
    expect(pipe()(5)).toBe(5);
    const o = {};
    expect(pipe()(o)).toBe(o);
  });
  it('works with a single function', () => expect(pipe(dbl)(4)).toBe(8));
  it('can be reused', () => {
    const f = pipe(inc, dbl);
    expect([f(1), f(2), f(1)]).toEqual([4, 6, 4]);
  });
  it('slugify example', () => {
    const slugify = pipe((s) => s.trim(), (s) => s.toLowerCase(), (s) => s.replace(/[^\w]+/g, '-'));
    expect(slugify('  Hello, World! ')).toBe('hello-world-');
  });
});

describe('compose', () => {
  it('runs right to left', () => expect(compose(inc, dbl, sq)(3)).toBe(19));
  it('lets the last function take several arguments', () => {
    expect(compose(dbl, (a, b) => a + b)(1, 2)).toBe(6);
  });
  it('is the identity with no functions', () => expect(compose()(7)).toBe(7));
  it('pipe and compose are mirror images', () => {
    expect(compose(sq, dbl, inc)(2)).toBe(pipe(inc, dbl, sq)(2));
  });
});
```

%% hints
- `pipe`: `(...args) => rest.reduce((acc, fn) => fn(acc), first(...args))`.
- Handle `fns.length === 0` separately (return `args[0]`).
- `compose(...fns)` is `pipe(...fns.reverse())` — but don't mutate the caller's array (`[...fns].reverse()`).

%% solution
```js
export function pipe(...fns) {
  if (fns.length === 0) return (x) => x;
  const [first, ...rest] = fns;
  return (...args) => rest.reduce((acc, fn) => fn(acc), first(...args));
}

export function compose(...fns) {
  return pipe(...[...fns].reverse());
}
```

%% exercise fp-curry | curry() | 3 | js | js | curry | 15
Write `curry(fn)`.

- The curried function collects arguments across calls until it has at least `fn.length` of them, then calls `fn` with all of them and returns the result.
- Calls may pass **several** arguments at once: `c(1)(2, 3)`, `c(1, 2)(3)` and `c(1, 2, 3)` are all equivalent.
- Partially applied functions are **reusable**: `const add1 = c(1); add1(2)(3)` and `add1(10)(20)` don't affect each other.
- A zero-arity function is called on the first invocation.
- `this` is forwarded to `fn` (taken from the call that completes the argument list).

%% starter
```js
export function curry(fn) {
  // your code
}
```

%% tests
```js
const add3 = (a, b, c) => a + b + c;

describe('curry', () => {
  it('curries one argument at a time', () => expect(curry(add3)(1)(2)(3)).toBe(6));
  it('accepts multiple arguments per call', () => {
    const c = curry(add3);
    expect(c(1, 2, 3)).toBe(6);
    expect(c(1, 2)(3)).toBe(6);
    expect(c(1)(2, 3)).toBe(6);
  });
  it('returns a function until enough arguments arrive', () => {
    const c = curry(add3);
    expect(typeof c(1)).toBe('function');
    expect(typeof c(1, 2)).toBe('function');
  });
  it('produces reusable partials', () => {
    const add1 = curry(add3)(1);
    expect(add1(2)(3)).toBe(6);
    expect(add1(10)(20)).toBe(31);
    expect(add1(2, 3)).toBe(6);
  });
  it('calls fn exactly once when complete', () => {
    const seen = [];
    const fn = (a, b, c) => { seen.push([a, b, c]); return a + b + c; };
    curry(fn)(1)(2)(3);
    expect(seen).toEqual([[1, 2, 3]]);
  });
  it('handles zero-arity functions', () => expect(curry(() => 'now')()).toBe('now'));
  it('handles unary functions', () => expect(curry((x) => x * 2)(4)).toBe(8));
  it('works with map via wrapper arrows', () => {
    const add = curry((a, b) => a + b);
    expect([1, 2, 3].map((n) => add(10)(n))).toEqual([11, 12, 13]);
  });
  it('forwards this', () => {
    const obj = { k: 100, sum: curry(function (a, b) { return this.k + a + b; }) };
    expect(obj.sum(1, 2)).toBe(103);
  });
  it('extra arguments beyond the arity are passed through', () => {
    const rest = [];
    const fn = function (a, b) { rest.push(...arguments); return a + b; };
    expect(curry(fn)(1, 2, 3)).toBe(3);
    expect(rest).toEqual([1, 2, 3]);
  });
});
```

%% hints
- Recursive shape: `function curried(...args) { if (args.length >= fn.length) return fn.apply(this, args); return function (...more) { return curried.apply(this, [...args, ...more]); }; }`
- Never `push` onto a shared `args` array — build a **new** array each step, that's what keeps partials reusable.

%% solution
```js
export function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return function (...more) {
      return curried.apply(this, [...args, ...more]);
    };
  };
}
```

%% exercise fp-pipe-async | pipeAsync | 3 | js | js | pipeAsync | 12
Write `pipeAsync(...fns)`: like `pipe`, but each step may be sync **or** async, and the result is always a promise.

- Each function receives the **resolved** value of the previous step.
- The first function may take several arguments.
- If any step throws/rejects, the result rejects and **later steps don't run**.
- With no functions, resolve with the first argument.

%% starter
```js
export function pipeAsync(...fns) {
  // your code
}
```

%% tests
```js
const wait = (ms, v) => new Promise((r) => setTimeout(r, ms, v));

describe('pipeAsync', () => {
  it('chains sync and async steps', async () => {
    const run = pipeAsync((x) => x + 1, async (x) => { await wait(5); return x * 2; }, (x) => `n=${x}`);
    await expect(run(1)).resolves.toBe('n=4');
  });

  it('always returns a promise', () => {
    expect(pipeAsync((x) => x)(1)).toBeInstanceOf(Promise);
    expect(pipeAsync()(1)).toBeInstanceOf(Promise);
  });

  it('is the identity with no functions', async () => {
    await expect(pipeAsync()('same')).resolves.toBe('same');
  });

  it('lets the first function take several arguments', async () => {
    await expect(pipeAsync(async (a, b) => a * b, (x) => x + 1)(3, 4)).resolves.toBe(13);
  });

  it('rejects and skips later steps on failure', async () => {
    const later = jest.fn();
    const run = pipeAsync(async () => { throw new Error('step failed'); }, later);
    await expect(run()).rejects.toThrow('step failed');
    expect(later).not.toHaveBeenCalled();
  });

  it('turns synchronous throws in the first step into rejections', async () => {
    const run = pipeAsync(() => { throw new Error('sync'); });
    let p;
    expect(() => { p = run(); }).not.toThrow();
    await expect(p).rejects.toThrow('sync');
  });

  it('runs steps strictly in sequence', async () => {
    const order = [];
    const step = (name, ms) => async (x) => { order.push(`start ${name}`); await wait(ms, 0); order.push(`end ${name}`); return x; };
    await pipeAsync(step('a', 20), step('b', 1))(0);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b']);
  });
});
```

%% hints
- Simplest: an `async` function with a `for…of` loop awaiting each step. It already converts sync throws into rejections.
- `let acc = await first(...args)` then `for (const fn of rest) acc = await fn(acc);`.

%% solution
```js
export function pipeAsync(...fns) {
  return async (...args) => {
    if (fns.length === 0) return args[0];
    const [first, ...rest] = fns;
    let acc = await first(...args);
    for (const fn of rest) acc = await fn(acc);
    return acc;
  };
}
```

%% exercise fp-selector | createSelector (memoize by identity) | 3 | js | js | createSelector | 15
Build a mini `reselect`.

```js
const selectVisible = createSelector(
  [(state) => state.todos, (state) => state.filter],
  (todos, filter) => todos.filter((t) => filter === 'all' || t.status === filter),
);
```

- `createSelector(inputSelectors, resultFn)` returns `selector(...args)`.
- The selector runs every input selector with the same arguments. If **all** input results are identical (`Object.is`) to the previous call's, it returns the **previous result** without calling `resultFn`; otherwise it recomputes.
- `selector.recomputations()` reports how many times `resultFn` has run.
- Only the most recent inputs are remembered (cache size 1).

%% starter
```js
export function createSelector(inputSelectors, resultFn) {
  // your code
}
```

%% tests
```js
const state = () => ({ todos: [{ id: 1, status: 'done' }, { id: 2, status: 'open' }], filter: 'all', unrelated: 0 });

describe('createSelector', () => {
  const make = () => createSelector(
    [(s) => s.todos, (s) => s.filter],
    (todos, filter) => todos.filter((t) => filter === 'all' || t.status === filter),
  );

  it('computes the derived value', () => {
    const sel = make();
    expect(sel(state()).map((t) => t.id)).toEqual([1, 2]);
  });

  it('returns the identical result when inputs are unchanged', () => {
    const sel = make();
    const s = state();
    const first = sel(s);
    expect(sel(s)).toBe(first);
    expect(sel({ ...s, unrelated: 99 })).toBe(first);
    expect(sel.recomputations()).toBe(1);
  });

  it('recomputes when any input changes by identity', () => {
    const sel = make();
    const s = state();
    sel(s);
    sel({ ...s, filter: 'done' });
    expect(sel.recomputations()).toBe(2);
    sel({ ...s, todos: [...s.todos] });
    expect(sel.recomputations()).toBe(3);
  });

  it('gives a new result reference only when it recomputed', () => {
    const sel = make();
    const s = state();
    const a = sel(s);
    const b = sel({ ...s, filter: 'open' });
    expect(b).not.toBe(a);
    expect(b.map((t) => t.id)).toEqual([2]);
  });

  it('passes every argument to every input selector', () => {
    const input = jest.fn((state, extra) => state.n + extra);
    const sel = createSelector([input], (x) => x * 2);
    expect(sel({ n: 1 }, 10)).toBe(22);
    expect(input).toHaveBeenCalledWith({ n: 1 }, 10);
  });

  it('treats NaN inputs as equal to themselves (Object.is)', () => {
    const fn = jest.fn((x) => x);
    const sel = createSelector([() => NaN], fn);
    sel(); sel();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps selectors independent', () => {
    const a = make(), b = make();
    a(state());
    expect(b.recomputations()).toBe(0);
  });
});
```

%% hints
- Closure state: `lastInputs` (array), `lastResult`, `computations`.
- Compare with `every((v, i) => Object.is(v, lastInputs[i]))` — and don't forget the very first call, when there is no `lastInputs` yet.
- Expose the counter with `selector.recomputations = () => computations`.

%% solution
```js
export function createSelector(inputSelectors, resultFn) {
  let lastInputs = null;
  let lastResult;
  let computations = 0;

  function selector(...args) {
    const inputs = inputSelectors.map((s) => s(...args));
    if (lastInputs && inputs.every((v, i) => Object.is(v, lastInputs[i]))) return lastResult;
    lastInputs = inputs;
    lastResult = resultFn(...inputs);
    computations++;
    return lastResult;
  }

  selector.recomputations = () => computations;
  return selector;
}
```

%% exercise fp-observable | Build an Observable | 4 | js | js | Observable | 35
Implement a small RxJS-style `Observable`.

- `new Observable(producer)` — `producer(subscriber)` runs **when someone subscribes** (lazy; each subscription re-runs it — "cold"). `subscriber` has `next(v)`, `error(e)`, `complete()`. The producer may return a **teardown** function.
- `subscribe(observerOrNextFn)` accepts a function (`next`) or `{ next, error, complete }` and returns `{ unsubscribe() }`.
- After `complete`/`error`/`unsubscribe`, nothing more is delivered, and the teardown runs **exactly once** — even if the producer completed synchronously before it could return the teardown.
- A throw inside the producer is delivered to `error`.
- Operators return **new observables** and unsubscribe from their source when unsubscribed: `map(fn)`, `filter(pred)`, `take(n)` (completes after `n` values and unsubscribes upstream). A throw in `fn`/`pred` becomes an `error`.
- Static `Observable.of(...values)` (emits synchronously then completes) and `Observable.interval(ms)` (emits `0, 1, 2, …`; teardown stops the timer).

%% starter
```js
export class Observable {
  constructor(producer) {
    // your code
  }

  subscribe(observerOrNext) {
    // your code
  }

  map(fn) {
    // your code
  }

  filter(predicate) {
    // your code
  }

  take(count) {
    // your code
  }

  static of(...values) {
    // your code
  }

  static interval(ms) {
    // your code
  }
}
```

%% tests
```js
describe('Observable — core', () => {
  it('is lazy: the producer runs only on subscribe', () => {
    const producer = jest.fn();
    const o = new Observable(producer);
    expect(producer).not.toHaveBeenCalled();
    o.subscribe(() => {});
    expect(producer).toHaveBeenCalledTimes(1);
  });

  it('is cold: every subscription runs the producer again', () => {
    const producer = jest.fn((s) => { s.next(1); s.complete(); });
    const o = new Observable(producer);
    o.subscribe(() => {}); o.subscribe(() => {});
    expect(producer).toHaveBeenCalledTimes(2);
  });

  it('delivers next/complete to an observer object', () => {
    const next = jest.fn(), complete = jest.fn();
    Observable.of(1, 2, 3).subscribe({ next, complete });
    expect(next.mock.calls).toEqual([[1], [2], [3]]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('accepts a bare next function', () => {
    const next = jest.fn();
    Observable.of('x').subscribe(next);
    expect(next).toHaveBeenCalledWith('x');
  });

  it('delivers errors and stops', () => {
    const next = jest.fn(), error = jest.fn(), complete = jest.fn();
    new Observable((s) => { s.next(1); s.error(new Error('bad')); s.next(2); s.complete(); }).subscribe({ next, error, complete });
    expect(next.mock.calls).toEqual([[1]]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(complete).not.toHaveBeenCalled();
  });

  it('routes producer exceptions to error', () => {
    const error = jest.fn();
    new Observable(() => { throw new Error('boom'); }).subscribe({ error });
    expect(error.mock.calls[0][0].message).toBe('boom');
  });

  it('ignores emissions after complete', () => {
    const next = jest.fn();
    new Observable((s) => { s.next(1); s.complete(); s.next(2); }).subscribe(next);
    expect(next.mock.calls).toEqual([[1]]);
  });

  it('runs teardown once on unsubscribe', () => {
    jest.useFakeTimers();
    const teardown = jest.fn();
    const sub = new Observable(() => teardown).subscribe(() => {});
    sub.unsubscribe();
    sub.unsubscribe();
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('runs teardown once on complete', () => {
    const teardown = jest.fn();
    new Observable((s) => { s.complete(); return teardown; }).subscribe(() => {});
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('runs teardown on error', () => {
    const teardown = jest.fn();
    new Observable((s) => { s.error('x'); return teardown; }).subscribe({ error() {} });
    expect(teardown).toHaveBeenCalledTimes(1);
  });

  it('stops delivering after unsubscribe', () => {
    jest.useFakeTimers();
    const next = jest.fn();
    const sub = Observable.interval(10).subscribe(next);
    jest.advanceTimersByTime(25);
    sub.unsubscribe();
    jest.advanceTimersByTime(100);
    expect(next.mock.calls).toEqual([[0], [1]]);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('Observable — operators', () => {
  it('map transforms values lazily', () => {
    const fn = jest.fn((x) => x * 2);
    const mapped = Observable.of(1, 2).map(fn);
    expect(fn).not.toHaveBeenCalled();
    const out = [];
    mapped.subscribe((v) => out.push(v));
    expect(out).toEqual([2, 4]);
  });

  it('filter drops values', () => {
    const out = [];
    Observable.of(1, 2, 3, 4).filter((x) => x % 2 === 0).subscribe((v) => out.push(v));
    expect(out).toEqual([2, 4]);
  });

  it('operators chain and forward completion', () => {
    const out = [], complete = jest.fn();
    Observable.of(1, 2, 3, 4, 5).filter((x) => x > 1).map((x) => x * 10).subscribe({ next: (v) => out.push(v), complete });
    expect(out).toEqual([20, 30, 40, 50]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('a throw in map becomes an error', () => {
    const error = jest.fn();
    Observable.of(1).map(() => { throw new Error('map failed'); }).subscribe({ error });
    expect(error.mock.calls[0][0].message).toBe('map failed');
  });

  it('take completes after n values', () => {
    const out = [], complete = jest.fn();
    Observable.of(1, 2, 3, 4).take(2).subscribe({ next: (v) => out.push(v), complete });
    expect(out).toEqual([1, 2]);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('take unsubscribes from an infinite source', () => {
    jest.useFakeTimers();
    const out = [];
    Observable.interval(10).take(3).subscribe((v) => out.push(v));
    jest.advanceTimersByTime(1000);
    expect(out).toEqual([0, 1, 2]);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('take(0) completes immediately without subscribing upstream values', () => {
    const complete = jest.fn(), next = jest.fn();
    Observable.of(1, 2).take(0).subscribe({ next, complete });
    expect(next).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing from a mapped observable tears down the source', () => {
    jest.useFakeTimers();
    const sub = Observable.interval(10).map((x) => x).subscribe(() => {});
    sub.unsubscribe();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('each subscription of a derived observable is independent', () => {
    const a = [], b = [];
    const o = Observable.of(1, 2).map((x) => x + 1);
    o.subscribe((v) => a.push(v));
    o.subscribe((v) => b.push(v));
    expect(a).toEqual([2, 3]);
    expect(b).toEqual([2, 3]);
  });
});
```

%% hints
- Core of `subscribe`: a `closed` flag, a `teardown` variable, and a `subscriber` object whose `next/error/complete` check `closed`.
- `complete`/`error`: `if (!closed) { closed = true; call observer; runTeardown(); }`. Make `runTeardown` clear the variable so it runs at most once.
- Synchronous producers complete *before* `producer()` returns the teardown. After calling the producer, `if (closed) runTeardown()`.
- Operators are just `new Observable((sub) => { const inner = this.subscribe({...forward to sub...}); return () => inner.unsubscribe(); })`.
- `take`: after delivering the n-th value call `sub.complete()`. For `count <= 0` complete immediately and return.

%% solution
```js
export class Observable {
  constructor(producer) {
    this.producer = producer;
  }

  subscribe(observerOrNext, error, complete) {
    const observer =
      typeof observerOrNext === 'function' ? { next: observerOrNext, error, complete } : observerOrNext || {};
    let closed = false;
    let teardown;

    const runTeardown = () => {
      const t = teardown;
      teardown = undefined;
      if (typeof t === 'function') t();
    };
    const close = () => {
      if (closed) return false;
      closed = true;
      return true;
    };

    const subscriber = {
      next(v) {
        if (!closed) observer.next?.(v);
      },
      error(e) {
        if (close()) {
          try { observer.error?.(e); } finally { runTeardown(); }
        }
      },
      complete() {
        if (close()) {
          try { observer.complete?.(); } finally { runTeardown(); }
        }
      },
    };

    try {
      teardown = this.producer(subscriber);
    } catch (e) {
      subscriber.error(e);
    }
    if (closed) runTeardown();

    return {
      unsubscribe() {
        if (close()) runTeardown();
      },
    };
  }

  map(fn) {
    return new Observable((sub) => {
      const inner = this.subscribe({
        next: (v) => {
          try { sub.next(fn(v)); } catch (e) { sub.error(e); }
        },
        error: (e) => sub.error(e),
        complete: () => sub.complete(),
      });
      return () => inner.unsubscribe();
    });
  }

  filter(predicate) {
    return new Observable((sub) => {
      const inner = this.subscribe({
        next: (v) => {
          try { if (predicate(v)) sub.next(v); } catch (e) { sub.error(e); }
        },
        error: (e) => sub.error(e),
        complete: () => sub.complete(),
      });
      return () => inner.unsubscribe();
    });
  }

  take(count) {
    return new Observable((sub) => {
      if (count <= 0) {
        sub.complete();
        return undefined;
      }
      let seen = 0;
      const inner = this.subscribe({
        next: (v) => {
          sub.next(v);
          if (++seen >= count) sub.complete();
        },
        error: (e) => sub.error(e),
        complete: () => sub.complete(),
      });
      return () => inner.unsubscribe();
    });
  }

  static of(...values) {
    return new Observable((sub) => {
      for (const v of values) sub.next(v);
      sub.complete();
    });
  }

  static interval(ms) {
    return new Observable((sub) => {
      let i = 0;
      const id = setInterval(() => sub.next(i++), ms);
      return () => clearInterval(id);
    });
  }
}
```
