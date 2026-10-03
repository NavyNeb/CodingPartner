---
id: pat-decorators-middleware
track: pat
title: Decorators, proxies & middleware
summary: Adding behaviour around existing code without editing it: function decorators (once, memoize, timing), the middleware onion used by Express and Koa, JavaScript proxies, and chains of responsibility.
---

## The idea in one sentence

**Wrap** something in a layer that has the **same shape** but adds behaviour, so the original code stays untouched and layers can be stacked.

> **Analogy** Gift-wrapping and security checkpoints. Wrapping doesn't change the gift; you can add another layer; and the person receiving it opens the layers one by one. At an airport, your bag passes through ticket check, then security, then boarding, each doing one job, in order, and each able to stop you.

This one idea has several faces: **decorators** (wrap a function), **middleware** (wrap a request handler, in a chain), **proxies** (wrap an object) and **chain of responsibility** (pass a request along until someone takes it).

## Decorators: wrap a function

A decorator is a function that **takes a function and returns a function with the same signature**, plus something extra.

![Function decorators](fig:pat-decorator "Same signature in and out, so layers can be stacked in any order.")

```js try predict
const once = (fn) => {
  let done = false, result;
  return function (...args) {
    if (!done) { result = fn.apply(this, args); done = true; }
    return result;
  };
};
const withLogging = (fn, log) => function (...args) {
  const result = fn.apply(this, args);
  log(`${fn.name}(${args.join(', ')}) => ${result}`);
  return result;
};

function add(a, b) { return a + b; }
const logged = withLogging(add, console.log);
logged(2, 3);
const init = once(() => { console.log('initialising…'); return 42; });
console.log(init(), init());
```

Rules of good decorators: **forward `this` and all arguments** (`fn.apply(this, args)`), **return the original result**, and **don't swallow errors** unless that's the point. Because they return normal functions they **compose**: `withTiming(memoize(fn))`.

## Middleware: a chain you can step into and out of

In Express or Koa, a request passes through a list of functions. Each receives `(ctx, next)`. Calling `next()` goes **deeper**; when the inner part finishes, control **returns** to the code after `await next()`.

![The middleware onion](fig:pat-onion "In through the layers, then back out in reverse order.")

```stepper The onion in order
code:
  use(async (ctx, next) => { log('A in');  await next(); log('A out'); });
  use(async (ctx, next) => { log('B in');  await next(); log('B out'); });
  use(async (ctx) => { log('handler'); });
  run({});
---
line: 4
say: `run` starts at the **first** middleware. The context object `ctx` travels with the request.
output: (nothing yet)
---
line: 1
say: **A** runs its "before" code, then `await next()` hands control to the next middleware.
output: A in
---
line: 2
say: **B** does the same: before code, then `next()`.
output: A in, B in
---
line: 3
say: The **handler** has no `next`: it is the centre of the onion and does the real work.
output: A in, B in, handler
---
line: 2
say: The handler is done, so **B's `await next()` resolves** and B's "after" code runs. We are travelling **outwards**.
output: A in, B in, handler, B out
---
line: 1
say: Then **A's** after code. The order is the mirror image going out: that is why timing, error handling and response headers belong in outer layers.
output: A in, B in, handler, B out, A out
```

Middleware can:

- **Do something before and after** (logging, timing).
- **Stop the chain** by *not* calling `next()` (auth refusing a request).
- **Catch errors** from everything inside with `try { await next() } catch …`.
- **Change the context** that the inner layers see.

Calling `next()` **twice** from one middleware is a bug (the rest of the chain would run twice); good implementations detect it.

## Proxies: wrap an object

A JavaScript **`Proxy`** wraps an object and lets you intercept reading, writing and deleting through **traps**.

![A proxy](fig:pat-proxy "The client uses the proxy like the real thing; the proxy can check, log or block.")

```js try
const target = { name: 'ada' };
const view = new Proxy(target, {
  get(t, key, receiver) {
    console.log('read', String(key));
    return Reflect.get(t, key, receiver);
  },
  set() {
    throw new Error('read-only');
  },
});
console.log(view.name);
try { view.name = 'bo'; } catch (e) { console.log(e.message); }
```

Real uses: **read-only views**, **change notification** (Vue 3's reactivity is built on this), validation, lazy loading and access control. Remember to use `Reflect` to forward the default behaviour.

## Chain of responsibility

Several handlers might deal with a request, but only the first suitable one should. The caller sends it to a **chain**: each handler either takes it or lets the next one try. Think of support tiers, event bubbling, or approval limits. It differs from middleware in that **one** handler answers and the rest are skipped.

## Quick check

```check
Q: What must a function decorator preserve?
A) The function's name only
B) The call shape: forward `this` and arguments, and return the result *
C) The number of lines
D) Nothing
Why: Callers must not be able to tell the wrapper from the original.
---
Q: In the middleware onion, what runs after `await next()` in the first middleware?
A) Nothing
B) Its "after" code, once everything inside has finished *
C) The handler
D) The second middleware's before code
Why: Control returns outwards in reverse order, so outer layers see the final outcome.
---
Q: How does a middleware stop the request from reaching the handler?
A) It throws away the context
B) It doesn't call next() *
C) It calls next() twice
D) It returns a number
Why: next() is what continues the chain.
---
Q: What does a Proxy `set` trap let you do?
A) Only read values
B) Intercept assignments to check, log, block or forward them *
C) Replace the object
D) Change the prototype only
Why: Traps run when the operation happens on the proxy.
---
Q: What distinguishes chain of responsibility from middleware?
A) Nothing
B) One handler takes the request and the rest are skipped, instead of all layers participating *
C) It uses classes
D) It is synchronous only
Why: In a chain, the first capable handler answers.
```

## Recap

- A **decorator** wraps a function: same signature, extra behaviour; forward `this`, arguments and the result.
- **Middleware** is `(ctx, next)` functions forming an **onion**: before code in, after code out; not calling `next` stops the chain.
- A **Proxy** intercepts operations on an object: read-only views, change notification, validation.
- **Chain of responsibility** hands a request along until one handler takes it.
- All of them let you **add behaviour without editing** the wrapped code.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a logging decorator | `fn.apply(this, args)`, the original result |
| Function decorators | A `done` flag, a `Map` cache, `try/finally` for timing |
| A middleware pipeline | A `dispatch(i)` function, the "next called twice" guard |
| Proxies: read-only and observed objects | `Proxy` traps with `Reflect`; a `WeakMap` for identity |
| A chain of responsibility | An ordered list; first `canHandle` wins; immutable `append` |

%% exercise pat-guided-logged | Guided: a logging decorator | 1 | js | js | withLogging | 8 | guided
Implement `withLogging(fn, log)`. It returns a function that calls `fn` with the **same `this` and arguments**, then calls `log` with the string `NAME(ARGS) => RESULT` (the function's name, or `anonymous`, the arguments joined with `, `, and the result), and finally **returns the result**.

```js
function add(a, b) { return a + b; }
const logged = withLogging(add, console.log);
logged(2, 3); // logs 'add(2, 3) => 5' and returns 5
```

%% worked
**A similar problem, solved: `withDefaultArgs(fn, defaults)`** — a wrapper that changes the arguments and forwards `this`.

```js
function withDefaultArgs(fn, defaults) {
  return function (...args) {
    const filled = defaults.map((d, i) => (args[i] === undefined ? d : args[i]));   // ① adjust the input
    return fn.apply(this, filled);                                                    // ② forward `this` and return the result
  };
}
```

Use a regular `function` (not an arrow) for the wrapper so it gets its own `this`, then forward it with `fn.apply(this, args)`.

%% explain
- **Calls `fn`** with the same `this` and arguments.
- **Logs** `name(args) => result` **after** the call.
- **Returns** `fn`'s result.
- **Name**: `fn.name`, or `anonymous` when empty.

%% nudge
- Why must the wrapper be a normal `function` rather than an arrow?
- Where does the result come from before you log it?

%% starter
```js
export function withLogging(fn, log) {
  return function (...args) {
    // Step 1 — const result = fn.apply(this, args);
    // Step 2 — log(`${name}(${args.join(', ')}) => ${result}`);
    // Step 3 — return result;
  };
}
```

%% tests
```js
describe('withLogging', () => {
  it('logs the call and returns the result', () => {
    const log = jest.fn();
    function add(a, b) { return a + b; }
    const logged = withLogging(add, log);
    expect(logged(2, 3)).toBe(5);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith('add(2, 3) => 5');
  });
  it('uses anonymous for unnamed functions', () => {
    const log = jest.fn();
    const logged = withLogging(function () { return 1; }, log);
    logged();
    expect(log).toHaveBeenCalledWith('anonymous() => 1');
  });
  it('forwards this', () => {
    const log = jest.fn();
    const obj = { n: 10, add: withLogging(function plus(x) { return this.n + x; }, log) };
    expect(obj.add(5)).toBe(15);
    expect(log).toHaveBeenCalledWith('plus(5) => 15');
  });
  it('logs after the call, not before', () => {
    const order = [];
    const logged = withLogging(function f() { order.push('call'); return 0; }, () => order.push('log'));
    logged();
    expect(order).toEqual(['call', 'log']);
  });
  it('lets errors through without logging', () => {
    const log = jest.fn();
    const logged = withLogging(function boom() { throw new Error('x'); }, log);
    expect(() => logged()).toThrow('x');
    expect(log).not.toHaveBeenCalled();
  });
});
```

%% hints
- `const result = fn.apply(this, args);`
- `log(`${fn.name || 'anonymous'}(${args.join(', ')}) => ${result}`);`

%% solution
```js
export function withLogging(fn, log) {
  return function (...args) {
    const result = fn.apply(this, args);
    log(`${fn.name || 'anonymous'}(${args.join(', ')}) => ${result}`);
    return result;
  };
}
```

%% exercise pat-decorators | Function decorators | 3 | js | js | once, memoize, withTiming | 22
Implement three decorators. All must forward `this` and every argument, and return the wrapped function's result.

- `once(fn)`: runs `fn` the **first** time and returns that result on every later call **without** calling `fn` again (even if the result was `undefined`). If `fn` **throws**, the error propagates and nothing is cached: the next call tries again.
- `memoize(fn, key = (...args) => JSON.stringify(args))`: caches results by `key(...args)` (results of `undefined` are cached too). The returned function has `clear()` which empties the cache.
- `withTiming(fn, { clock, report })`: after **every** call (even one that throws) call `report(name, elapsedMs)`, where `name` is `fn.name || 'anonymous'` and the elapsed time comes from `clock.now()` (milliseconds) read before and after the call. Return the result or rethrow.

```js
const slow = memoize((n) => n * 2);
slow(2); slow(2); // the function body ran once
```

%% worked
**A similar problem, solved: `limit(fn, n)`** — keeps a counter between calls and forwards `this`.

```js
export function limit(fn, n) {
  let calls = 0;
  return function (...args) {
    if (calls >= n) return undefined;               // ① the wrapper decides whether to call at all
    calls++;
    return fn.apply(this, args);                    // ② otherwise forward everything
  };
}
```

`once` is `limit` with a cache; `memoize` replaces the counter with a `Map`. Use `Map.has` rather than checking the value, so a cached `undefined` or `0` still counts as cached. For `withTiming`, a `try/finally` makes sure you report even when `fn` throws.

%% explain
- **`once`**: a `done` flag and cached result; a throw leaves `done` false.
- **`memoize`**: `Map` keyed by `key(...args)`; `clear()` resets.
- **`withTiming`**: read the clock, call, and report in `finally`.
- **All**: forward `this` and arguments.

%% nudge
- What is the difference between `map.get(k) !== undefined` and `map.has(k)`?
- Where do you set `done = true` so a throwing call isn't cached?

%% starter
```js
export function once(fn) {
  return function (...args) {
    return fn.apply(this, args);
  };
}

export function memoize(fn, key = (...args) => JSON.stringify(args)) {
  const memoized = function (...args) {
    return fn.apply(this, args);
  };
  memoized.clear = () => {};
  return memoized;
}

export function withTiming(fn, { clock, report }) {
  return function (...args) {
    return fn.apply(this, args);
  };
}
```

%% tests
```js
describe('once', () => {
  it('runs once and caches the result', () => {
    const fn = jest.fn((x) => x * 2);
    const f = once(fn);
    expect(f(5)).toBe(10);
    expect(f(99)).toBe(10);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('caches an undefined result too', () => {
    const fn = jest.fn(() => undefined);
    const f = once(fn);
    f(); f();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('forwards this', () => {
    const obj = { n: 7, get: once(function () { return this.n; }) };
    expect(obj.get()).toBe(7);
  });
  it('retries after a throw', () => {
    let n = 0;
    const f = once(() => { n++; if (n === 1) throw new Error('boom'); return 'ok'; });
    expect(() => f()).toThrow('boom');
    expect(f()).toBe('ok');
    expect(f()).toBe('ok');
    expect(n).toBe(2);
  });
});

describe('memoize', () => {
  it('caches by arguments', () => {
    const fn = jest.fn((a, b) => a + b);
    const m = memoize(fn);
    expect(m(1, 2)).toBe(3);
    expect(m(1, 2)).toBe(3);
    expect(m(2, 1)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('caches falsy and undefined results', () => {
    const fn = jest.fn(() => 0);
    const m = memoize(fn);
    m(1); m(1);
    const u = jest.fn(() => undefined);
    const mu = memoize(u);
    mu(1); mu(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(u).toHaveBeenCalledTimes(1);
  });
  it('supports a custom key and clear()', () => {
    const fn = jest.fn((o) => o.id * 2);
    const m = memoize(fn, (o) => o.id);
    expect(m({ id: 2, extra: 'a' })).toBe(4);
    expect(m({ id: 2, extra: 'b' })).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
    m.clear();
    m({ id: 2 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('forwards this', () => {
    const obj = { k: 3, mul: memoize(function (x) { return this.k * x; }) };
    expect(obj.mul(4)).toBe(12);
  });
  it('does not cache a throw', () => {
    let n = 0;
    const m = memoize(() => { n++; if (n === 1) throw new Error('x'); return n; });
    expect(() => m()).toThrow('x');
    expect(m()).toBe(2);
  });
});

describe('withTiming', () => {
  const makeClock = () => { let t = 100; return { now: () => t, advance: (d) => { t += d; } }; };
  it('reports the elapsed time and returns the result', () => {
    const clock = makeClock();
    const report = jest.fn();
    function work(x) { clock.advance(25); return x + 1; }
    const timed = withTiming(work, { clock, report });
    expect(timed(1)).toBe(2);
    expect(report).toHaveBeenCalledWith('work', 25);
  });
  it('reports on every call, with anonymous for unnamed functions', () => {
    const clock = makeClock();
    const report = jest.fn();
    const timed = withTiming(function () { clock.advance(5); }, { clock, report });
    timed(); timed();
    expect(report.mock.calls).toEqual([['anonymous', 5], ['anonymous', 5]]);
  });
  it('reports and rethrows when the function throws', () => {
    const clock = makeClock();
    const report = jest.fn();
    const timed = withTiming(function boom() { clock.advance(3); throw new Error('bad'); }, { clock, report });
    expect(() => timed()).toThrow('bad');
    expect(report).toHaveBeenCalledWith('boom', 3);
  });
  it('forwards this and arguments', () => {
    const clock = makeClock();
    const obj = { n: 2, f: withTiming(function (a, b) { return this.n * (a + b); }, { clock, report: () => {} }) };
    expect(obj.f(3, 4)).toBe(14);
  });
  it('can be stacked with the other decorators', () => {
    const clock = makeClock();
    const report = jest.fn();
    const fn = jest.fn((x) => { clock.advance(10); return x; });
    const fast = withTiming(memoize(fn), { clock, report });
    fast(1); fast(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(report.mock.calls.map((c) => c[1])).toEqual([10, 0]);
  });
});
```

%% hints
- `once`: `let done = false, result; return function (...args) { if (!done) { result = fn.apply(this, args); done = true; } return result; };`
- `memoize`: `const cache = new Map(); const k = key(...args); if (!cache.has(k)) cache.set(k, fn.apply(this, args)); return cache.get(k);`
- `withTiming`: `const start = clock.now(); try { return fn.apply(this, args); } finally { report(fn.name || 'anonymous', clock.now() - start); }`

%% solution
```js
export function once(fn) {
  let done = false;
  let result;
  return function (...args) {
    if (!done) {
      result = fn.apply(this, args);
      done = true;
    }
    return result;
  };
}

export function memoize(fn, key = (...args) => JSON.stringify(args)) {
  const cache = new Map();
  const memoized = function (...args) {
    const k = key(...args);
    if (!cache.has(k)) cache.set(k, fn.apply(this, args));
    return cache.get(k);
  };
  memoized.clear = () => cache.clear();
  return memoized;
}

export function withTiming(fn, { clock, report }) {
  return function (...args) {
    const start = clock.now();
    try {
      return fn.apply(this, args);
    } finally {
      report(fn.name || 'anonymous', clock.now() - start);
    }
  };
}
```

%% exercise pat-pipeline | A middleware pipeline | 4 | js | js | createPipeline | 30
Implement `createPipeline()` in the style of Koa.

- `use(middleware)` adds a middleware `(ctx, next) => void | Promise` and returns the pipeline (so calls chain). A non-function throws `TypeError('middleware must be a function')`.
- `run(ctx, final)` returns a **promise** that resolves with `ctx` after the whole chain finished. Middleware run in the order added; `await next()` resumes after everything inside has finished (the **onion**). The optional `final(ctx)` runs after the last middleware if the chain reaches it.
- A middleware that **doesn't call `next`** stops the chain (inner middleware and `final` don't run).
- Errors (thrown or rejected) reject the promise returned by `next()`, so an outer middleware can `try/catch` them; if nobody catches, `run` rejects.
- Calling `next()` **more than once** from the same middleware makes the second call reject with `Error('next() called multiple times')`.
- Middleware added after `run` started don't affect that run.

```js
const p = createPipeline().use(async (ctx, next) => { ctx.log.push('in'); await next(); ctx.log.push('out'); });
await p.run({ log: [] }, (ctx) => ctx.log.push('final')); // log: in, final, out
```

%% worked
**A similar problem, solved: `compose(fns)`** — a recursive `dispatch(i)` that runs function `i` and gives it a `next` pointing at `i + 1`.

```js
function compose(fns) {
  return function run(ctx) {
    let last = -1;
    const dispatch = async (i) => {
      if (i <= last) throw new Error('next() called multiple times');   // ① the guard: i can only go forward
      last = i;
      const fn = fns[i];
      if (!fn) return;                                                  // ② ran off the end
      await fn(ctx, () => dispatch(i + 1));                             // ③ next = "run the following one"
    };
    return dispatch(0).then(() => ctx);
  };
}
```

`dispatch(i + 1)` returns a promise, so `await next()` waits for the entire inner chain. The `final` handler is just one more function at the end of the list that ignores `next`.

%% explain
- **`dispatch(i)`** runs middleware `i` with a `next` that dispatches `i + 1`.
- **The onion**: `await next()` resolves after the inner part completes.
- **Stop** by not calling `next`; **errors** propagate through the promises.
- **Guard**: the same middleware calling `next` twice is rejected.
- **`final`** runs at the centre if reached.

%% nudge
- How can a single counter (`last`) detect that `next()` was called twice?
- Why does the `final` handler fit into the same list as the middleware?

%% starter
```js
export function createPipeline() {
  const middleware = [];
  const pipeline = {
    use(fn) {
      return pipeline;
    },
    run(ctx, final) {
      return Promise.resolve(ctx);
    },
  };
  return pipeline;
}
```

%% tests
```js
describe('createPipeline', () => {
  it('runs middleware in an onion order and resolves with ctx', async () => {
    const log = [];
    const p = createPipeline()
      .use(async (ctx, next) => { log.push('A in'); await next(); log.push('A out'); })
      .use(async (ctx, next) => { log.push('B in'); await next(); log.push('B out'); });
    const ctx = {};
    const result = await p.run(ctx, () => log.push('final'));
    expect(result).toBe(ctx);
    expect(log).toEqual(['A in', 'B in', 'final', 'B out', 'A out']);
  });
  it('works with no middleware and with only a final handler', async () => {
    const ctx = {};
    expect(await createPipeline().run(ctx)).toBe(ctx);
    const seen = jest.fn();
    await createPipeline().run(ctx, seen);
    expect(seen).toHaveBeenCalledWith(ctx);
  });
  it('shares the context between layers', async () => {
    const p = createPipeline()
      .use((ctx, next) => { ctx.n = 1; return next(); })
      .use((ctx, next) => { ctx.n += 10; return next(); });
    expect((await p.run({})).n).toBe(11);
  });
  it('stops when next is not called', async () => {
    const inner = jest.fn();
    const final = jest.fn();
    const p = createPipeline().use(() => {}).use(inner);
    await p.run({}, final);
    expect(inner).not.toHaveBeenCalled();
    expect(final).not.toHaveBeenCalled();
  });
  it('lets an outer middleware catch inner errors', async () => {
    const caught = [];
    const p = createPipeline()
      .use(async (ctx, next) => { try { await next(); } catch (e) { caught.push(e.message); ctx.recovered = true; } })
      .use(async () => { throw new Error('inner failed'); });
    const ctx = await p.run({});
    expect(caught).toEqual(['inner failed']);
    expect(ctx.recovered).toBe(true);
  });
  it('rejects when nobody catches, including synchronous throws', async () => {
    const p = createPipeline().use(() => { throw new Error('sync boom'); });
    await expect(p.run({})).rejects.toThrow('sync boom');
    const q = createPipeline().use(async (ctx, next) => next()).use(async () => { throw new Error('async boom'); });
    await expect(q.run({})).rejects.toThrow('async boom');
  });
  it('rejects the second next() call', async () => {
    const p = createPipeline().use(async (ctx, next) => { await next(); await next(); });
    await expect(p.run({})).rejects.toThrow('next() called multiple times');
  });
  it('waits for async work inside', async () => {
    const log = [];
    const p = createPipeline()
      .use(async (ctx, next) => { await next(); log.push('after'); })
      .use(async () => { await Promise.resolve(); await Promise.resolve(); log.push('slow handler'); });
    await p.run({});
    expect(log).toEqual(['slow handler', 'after']);
  });
  it('can be run more than once', async () => {
    const p = createPipeline().use(async (ctx, next) => { ctx.count = (ctx.count || 0) + 1; await next(); });
    expect((await p.run({})).count).toBe(1);
    expect((await p.run({ count: 5 })).count).toBe(6);
  });
  it('snapshots the middleware at run time and validates use()', async () => {
    const late = jest.fn();
    const p = createPipeline().use(async (ctx, next) => { p.use(late); await next(); });
    await p.run({});
    expect(late).not.toHaveBeenCalled();
    expect(() => p.use('nope')).toThrow(TypeError);
  });
});
```

%% hints
- Copy the list at the start of `run`: `const stack = [...middleware]; if (final) stack.push((c) => final(c));`
- `dispatch(i)`: guard with `if (i <= last) throw ...; last = i;`, then `await fn(ctx, () => dispatch(i + 1))`.
- `return dispatch(0).then(() => ctx);`

%% solution
```js
export function createPipeline() {
  const middleware = [];
  const pipeline = {
    use(fn) {
      if (typeof fn !== 'function') throw new TypeError('middleware must be a function');
      middleware.push(fn);
      return pipeline;
    },
    run(ctx, final) {
      const stack = [...middleware];
      if (final) stack.push((c) => final(c));
      let last = -1;
      const dispatch = async (i) => {
        if (i <= last) throw new Error('next() called multiple times');
        last = i;
        const fn = stack[i];
        if (!fn) return;
        await fn(ctx, () => dispatch(i + 1));
      };
      return dispatch(0).then(() => ctx);
    },
  };
  return pipeline;
}
```

%% exercise pat-proxies | Proxies: read-only and observed objects | 3 | js | js | readonly, observe | 24
Implement two functions using `Proxy`.

- `readonly(obj)` returns a **deep, live, read-only view**. Assigning, deleting or defining a property (at any depth, and so also `push` on a nested array) throws `Error('read-only')`. Nested objects and arrays are returned wrapped, and the **same** nested object always gives the **same** wrapper (`view.a === view.a`). Changes made to the original are visible through the view. Primitives pass through unchanged.
- `observe(target, onChange)` returns a proxy over `target` (shallow). Setting a property calls `onChange({ type: 'set', key, value, oldValue })` **unless** the property already existed with an `Object.is`-equal value. Deleting an **existing** property calls `onChange({ type: 'delete', key, oldValue })`. The target itself is updated as usual.

```js
const view = readonly({ a: { b: 1 } });
view.a.b = 2; // throws Error('read-only')
```

%% worked
**A similar problem, solved: `counted(obj)`** — a proxy that counts reads, forwarding with `Reflect`.

```js
export function counted(obj) {
  const stats = { reads: 0 };
  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      stats.reads++;                              // ① do your extra work...
      return Reflect.get(target, key, receiver);  // ② ...then forward to the real behaviour
    },
  });
  return { proxy, stats };
}
```

For `readonly`, the `get` trap also **wraps object results**, using a `WeakMap` so each nested object keeps one wrapper. For `observe`, the `set` trap must read the **old** value (and whether it existed) **before** it writes.

%% explain
- **`readonly`**: `set`, `deleteProperty` and `defineProperty` traps throw; `get` wraps objects through a `WeakMap` cache.
- **`observe`**: `set` compares old and new; `deleteProperty` reports only existing keys.
- **Both** forward with `Reflect` so ordinary behaviour is preserved.

%% nudge
- Why is a `WeakMap` a good cache for the wrappers?
- What must you capture before calling `Reflect.set`?

%% starter
```js
export function readonly(obj) {
  return obj;
}

export function observe(target, onChange) {
  return target;
}
```

%% tests
```js
describe('readonly', () => {
  it('reads like the original', () => {
    const view = readonly({ a: 1, list: [1, 2, 3], nested: { b: 2 } });
    expect(view.a).toBe(1);
    expect(view.nested.b).toBe(2);
    expect(view.list.map((x) => x * 2)).toEqual([2, 4, 6]);
    expect(Object.keys(view)).toEqual(['a', 'list', 'nested']);
    expect(JSON.stringify(view)).toBe('{"a":1,"list":[1,2,3],"nested":{"b":2}}');
  });
  it('rejects writes at any depth', () => {
    const view = readonly({ a: 1, nested: { b: 2 }, list: [1] });
    expect(() => { view.a = 2; }).toThrow('read-only');
    expect(() => { view.nested.b = 3; }).toThrow('read-only');
    expect(() => { view.extra = 1; }).toThrow('read-only');
    expect(() => { view.list.push(2); }).toThrow('read-only');
    expect(() => { delete view.a; }).toThrow('read-only');
    expect(() => Object.defineProperty(view, 'z', { value: 1 })).toThrow();
  });
  it('is a live view of the original', () => {
    const original = { count: 1, nested: { n: 1 } };
    const view = readonly(original);
    original.count = 2;
    original.nested.n = 5;
    expect(view.count).toBe(2);
    expect(view.nested.n).toBe(5);
  });
  it('keeps wrapper identity stable', () => {
    const view = readonly({ a: { b: 1 } });
    expect(view.a).toBe(view.a);
  });
  it('passes primitives and null through', () => {
    const view = readonly({ s: 'x', n: null, u: undefined });
    expect(view.s).toBe('x');
    expect(view.n).toBeNull();
    expect(view.u).toBeUndefined();
  });
});

describe('observe', () => {
  it('reports sets with old and new values', () => {
    const onChange = jest.fn();
    const target = { a: 1 };
    const p = observe(target, onChange);
    p.a = 2;
    p.b = 'new';
    expect(onChange.mock.calls).toEqual([
      [{ type: 'set', key: 'a', value: 2, oldValue: 1 }],
      [{ type: 'set', key: 'b', value: 'new', oldValue: undefined }],
    ]);
    expect(target).toEqual({ a: 2, b: 'new' });
  });
  it('does not report unchanged values', () => {
    const onChange = jest.fn();
    const p = observe({ a: 1, n: NaN }, onChange);
    p.a = 1;
    p.n = NaN;
    expect(onChange).not.toHaveBeenCalled();
  });
  it('reports a new key even when set to undefined', () => {
    const onChange = jest.fn();
    const p = observe({}, onChange);
    p.x = undefined;
    expect(onChange).toHaveBeenCalledWith({ type: 'set', key: 'x', value: undefined, oldValue: undefined });
  });
  it('reports deletes of existing keys only', () => {
    const onChange = jest.fn();
    const target = { a: 1 };
    const p = observe(target, onChange);
    delete p.missing;
    delete p.a;
    expect(onChange.mock.calls).toEqual([[{ type: 'delete', key: 'a', oldValue: 1 }]]);
    expect('a' in target).toBe(false);
  });
  it('reads normally', () => {
    const p = observe({ a: 1 }, () => {});
    expect(p.a).toBe(1);
    expect(p.zzz).toBeUndefined();
  });
});
```

%% hints
- `readonly`: `const cache = new WeakMap(); const wrap = (o) => { if (o === null || typeof o !== 'object') return o; if (!cache.has(o)) cache.set(o, new Proxy(o, handler)); return cache.get(o); };`
- `handler.get = (t, k, r) => wrap(Reflect.get(t, k, r))`; the other three traps throw.
- `observe.set`: `const had = Object.prototype.hasOwnProperty.call(t, k); const old = t[k]; const ok = Reflect.set(t, k, v, r); if (ok && (!had || !Object.is(old, v))) onChange({...}); return ok;`

%% solution
```js
export function readonly(obj) {
  const cache = new WeakMap();
  const fail = () => {
    throw new Error('read-only');
  };
  const handler = {
    get: (target, key, receiver) => wrap(Reflect.get(target, key, receiver)),
    set: fail,
    deleteProperty: fail,
    defineProperty: fail,
  };
  function wrap(value) {
    if (value === null || typeof value !== 'object') return value;
    if (!cache.has(value)) cache.set(value, new Proxy(value, handler));
    return cache.get(value);
  }
  return wrap(obj);
}

export function observe(target, onChange) {
  return new Proxy(target, {
    set(t, key, value, receiver) {
      const had = Object.prototype.hasOwnProperty.call(t, key);
      const oldValue = t[key];
      const ok = Reflect.set(t, key, value, receiver);
      if (ok && (!had || !Object.is(oldValue, value))) {
        onChange({ type: 'set', key, value, oldValue });
      }
      return ok;
    },
    deleteProperty(t, key) {
      if (!Object.prototype.hasOwnProperty.call(t, key)) return true;
      const oldValue = t[key];
      const ok = Reflect.deleteProperty(t, key);
      if (ok) onChange({ type: 'delete', key, oldValue });
      return ok;
    },
  });
}
```

%% exercise pat-chain | A chain of responsibility | 2 | js | js | createChain | 16
Implement `createChain(handlers = [])`. A handler is `{ name, canHandle(req), handle(req) }`.

- `process(req)` asks the handlers **in order**; the first one whose `canHandle(req)` is true handles it. Returns `{ handledBy: name, result: handler.handle(req) }`, or `{ handledBy: null, result: undefined }` if nobody can.
- `trace(req)` returns the **names of the handlers consulted**, in order, up to and including the one that took the request (all of them if none did). It must **not** call `handle`.
- `append(handler)` returns a **new** chain with the handler added at the end; the original is unchanged.

```js
const chain = createChain([
  { name: 'small', canHandle: (n) => n <= 100, handle: () => 'auto-approved' },
  { name: 'big', canHandle: () => true, handle: () => 'needs manager' },
]);
chain.process(50); // { handledBy: 'small', result: 'auto-approved' }
```

%% worked
**A similar problem, solved: `firstMatch(rules, value)`** — scan in order, stop at the first that applies.

```js
function firstMatch(rules, value) {
  for (const rule of rules) {
    if (rule.test(value)) return rule.label;     // ① the first suitable one wins, and the rest are never asked
  }
  return null;                                   // ② nobody took it
}
```

A chain is this loop plus a stable order. Keep `handlers` private and copy on `append` so existing chains can't be changed by someone else.

%% explain
- **Order matters**: first `canHandle` wins; later handlers are never asked.
- **`trace`** lists consulted names without running `handle`.
- **`append`** returns a new chain; the original keeps its handlers.

%% nudge
- When should `handle` run, and when should it definitely not run?
- How do you make `append` not change the old chain?

%% starter
```js
export function createChain(handlers = []) {
  return {
    process(req) { return { handledBy: null, result: undefined }; },
    trace(req) { return []; },
    append(handler) { return createChain(handlers); },
  };
}
```

%% tests
```js
const small = { name: 'small', canHandle: (n) => n <= 100, handle: (n) => 'auto ' + n };
const mid = { name: 'mid', canHandle: (n) => n <= 1000, handle: (n) => 'manager ' + n };
const big = { name: 'big', canHandle: () => true, handle: (n) => 'director ' + n };

describe('createChain', () => {
  const chain = createChain([small, mid, big]);
  it('gives the request to the first capable handler', () => {
    expect(chain.process(50)).toEqual({ handledBy: 'small', result: 'auto 50' });
    expect(chain.process(500)).toEqual({ handledBy: 'mid', result: 'manager 500' });
    expect(chain.process(5000)).toEqual({ handledBy: 'big', result: 'director 5000' });
  });
  it('reports nobody when no handler can', () => {
    expect(createChain([small]).process(999)).toEqual({ handledBy: null, result: undefined });
    expect(createChain().process(1)).toEqual({ handledBy: null, result: undefined });
  });
  it('only calls handle on the chosen handler', () => {
    const a = { name: 'a', canHandle: () => false, handle: jest.fn() };
    const b = { name: 'b', canHandle: () => true, handle: jest.fn(() => 'b done') };
    const c = { name: 'c', canHandle: () => true, handle: jest.fn() };
    createChain([a, b, c]).process('x');
    expect(a.handle).not.toHaveBeenCalled();
    expect(b.handle).toHaveBeenCalledWith('x');
    expect(c.handle).not.toHaveBeenCalled();
    expect(c).toBeDefined();
  });
  it('stops asking after the first match', () => {
    const later = { name: 'later', canHandle: jest.fn(() => true), handle: jest.fn() };
    createChain([small, later]).process(1);
    expect(later.canHandle).not.toHaveBeenCalled();
  });
  it('traces the handlers consulted without handling', () => {
    const spy = { name: 'spy', canHandle: () => true, handle: jest.fn() };
    expect(createChain([small, mid, spy]).trace(500)).toEqual(['small', 'mid']);
    expect(createChain([small, mid]).trace(5000)).toEqual(['small', 'mid']);
    expect(createChain([spy]).trace(1)).toEqual(['spy']);
    expect(spy.handle).not.toHaveBeenCalled();
  });
  it('append returns a new chain and leaves the old one alone', () => {
    const base = createChain([small]);
    const extended = base.append(big);
    expect(base.process(5000).handledBy).toBeNull();
    expect(extended.process(5000).handledBy).toBe('big');
    expect(extended).not.toBe(base);
  });
  it('does not let the caller change a chain through the array it passed in', () => {
    const list = [small];
    const c = createChain(list);
    list.push(big);
    expect(c.process(5000).handledBy).toBeNull();
  });
});
```

%% hints
- `process`: `for (const h of list) if (h.canHandle(req)) return { handledBy: h.name, result: h.handle(req) };`
- `trace`: push each name, and stop right after the first `canHandle` that is true.
- Copy the array: `const list = [...handlers];` and `append: (h) => createChain([...list, h])`.

%% solution
```js
export function createChain(handlers = []) {
  const list = [...handlers];
  return {
    process(req) {
      for (const handler of list) {
        if (handler.canHandle(req)) return { handledBy: handler.name, result: handler.handle(req) };
      }
      return { handledBy: null, result: undefined };
    },
    trace(req) {
      const names = [];
      for (const handler of list) {
        names.push(handler.name);
        if (handler.canHandle(req)) break;
      }
      return names;
    },
    append(handler) {
      return createChain([...list, handler]);
    },
  };
}
```
