---
id: promises
track: js
title: Promises, from the inside
summary: States, chaining, error flow, combinators — and how to build a promise yourself.
---

A **promise** is an object representing a value that will exist later. It is in exactly one of three states and can only move once:

```
pending ──► fulfilled(value)
        └─► rejected(reason)
```

Once settled, a promise is immutable. Any number of consumers can attach handlers, before *or after* settlement — late handlers still fire.

## `then` returns a new promise

This is the mechanism behind chaining:

```js
fetchUser(1)
  .then((u) => u.id)              // returns a value → next promise fulfills with it
  .then((id) => fetchPosts(id))   // returns a promise → next promise ADOPTS its outcome
  .then((posts) => { throw new Error('boom'); })   // throw → next promise rejects
  .catch((err) => 'fallback')     // handles it → chain is fulfilled again
  .finally(() => hideSpinner());  // runs either way, passes the outcome through
```

Rules worth memorising:

1. Return **inside** `then` to pass a value on. Forgetting `return` is the #1 chaining bug (next handler sees `undefined`, and a returned-nothing promise isn't awaited).
2. A throw (or rejected promise returned) skips forward to the next rejection handler. `.catch(f)` is just `.then(undefined, f)`.
3. `then(onOk, onErr)` — `onErr` does **not** catch errors thrown in `onOk` of the same call. `.then(ok).catch(err)` does.
4. `finally(fn)` ignores `fn`'s return value (unless it throws) and re-emits the previous outcome.

## Handlers always run asynchronously

Even on an already-resolved promise, callbacks are queued as **microtasks** and run after the current synchronous code finishes, before the next timer or I/O task:

```js
console.log('a');
Promise.resolve().then(() => console.log('b'));
console.log('c');
// a c b
```

This guarantees consistent ordering ("never sometimes-sync"). We look at the queue in the event-loop lesson.

## The executor runs synchronously

`new Promise((resolve, reject) => { … })` calls the executor **immediately**. Calling `resolve` twice does nothing after the first; a synchronous `throw` in the executor rejects the promise. `resolve(p)` with another promise/thenable makes this promise follow that one.

## Combinators

| | Fulfills when | Rejects when |
| --- | --- | --- |
| `Promise.all` | all fulfilled (values in input order) | **first** rejection |
| `Promise.allSettled` | always, with `{status, value/reason}` for each | never |
| `Promise.race` | first to settle fulfills | first to settle rejects |
| `Promise.any` | **first fulfillment** | all rejected (`AggregateError`) |

They accept any iterable and treat non-promises as already-resolved values. Note `all` doesn't cancel the others — nothing cancels a promise; only the code that produced it can be told to stop (`AbortController`).

## Classic mistakes

```js
// 1. Nesting instead of chaining
getA().then((a) => getB(a).then((b) => use(a, b)));       // ok but a pyramid
// 2. Fire-and-forget without catch  → "Unhandled promise rejection"
save(data);
// 3. Sequential when it could be parallel
const a = await getA(); const b = await getB();            // b doesn't need a!
// 4. Creating a promise around a promise (the "explicit construction antipattern")
new Promise((res) => getA().then(res));                    // just return getA()
```

## Thenables

Anything with a `then` method is a **thenable**; `await` and `resolve()` will adopt it. That's how libraries interoperate — and how you'll build your own promise in the last exercise.

%% exercise promises-delay | delay() | 1 | js | js | delay | 5
Write `delay(ms, value?)` returning a promise that fulfills with `value` after `ms` milliseconds.

%% starter
```js
export function delay(ms, value) {
  // your code
}
```

%% tests
```js
describe('delay', () => {
  it('returns a promise', () => {
    jest.useFakeTimers();
    expect(delay(10)).toBeInstanceOf(Promise);
  });

  it('does not resolve early, resolves on time', async () => {
    jest.useFakeTimers();
    const done = jest.fn();
    delay(100, 'ok').then(done);
    await jest.advanceTimersByTimeAsync(99);
    expect(done).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalledWith('ok');
  });

  it('resolves with undefined when no value is given', async () => {
    jest.useFakeTimers();
    const p = delay(5);
    await jest.advanceTimersByTimeAsync(5);
    await expect(p).resolves.toBeUndefined();
  });

  it('supports await', async () => {
    jest.useFakeTimers();
    const p = (async () => (await delay(50, 1)) + (await delay(50, 2)))();
    await jest.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBe(3);
  });
});
```

%% hints
- `new Promise((resolve) => setTimeout(resolve, ms, value))` — `setTimeout` forwards extra arguments.

%% solution
```js
export function delay(ms, value) {
  return new Promise((resolve) => setTimeout(resolve, ms, value));
}
```

%% exercise promises-promisify | promisify() | 2 | js | js | promisify | 10
Node-style APIs take a callback `(err, result)` as the **last** argument. Write `promisify(fn)` returning a function that returns a promise instead.

- Resolves with the callback's second argument; rejects with `err` when it's truthy.
- `this` and all arguments are forwarded.
- If `fn` throws synchronously, the promise rejects (no sync throw escapes).
- Extra callback arguments (`cb(null, a, b)`) are ignored — only the first result is used.

%% starter
```js
export function promisify(fn) {
  // your code
}
```

%% tests
```js
describe('promisify', () => {
  it('resolves with the callback result', async () => {
    const readFile = (path, cb) => cb(null, `contents of ${path}`);
    await expect(promisify(readFile)('a.txt')).resolves.toBe('contents of a.txt');
  });

  it('rejects when the callback receives an error', async () => {
    const failing = (cb) => cb(new Error('nope'));
    await expect(promisify(failing)()).rejects.toThrow('nope');
  });

  it('forwards all arguments', async () => {
    const add = jest.fn((a, b, cb) => cb(null, a + b));
    await expect(promisify(add)(2, 3)).resolves.toBe(5);
    expect(add).toHaveBeenCalledWith(2, 3, expect.any(Function));
  });

  it('preserves this', async () => {
    const obj = { base: 10, add(n, cb) { cb(null, this.base + n); } };
    obj.addAsync = promisify(obj.add);
    await expect(obj.addAsync(5)).resolves.toBe(15);
  });

  it('turns synchronous throws into rejections', async () => {
    const boom = () => { throw new Error('sync'); };
    let p;
    expect(() => { p = promisify(boom)(); }).not.toThrow();
    await expect(p).rejects.toThrow('sync');
  });

  it('uses only the first result value', async () => {
    const multi = (cb) => cb(null, 'first', 'second');
    await expect(promisify(multi)()).resolves.toBe('first');
  });

  it('works with callbacks invoked asynchronously', async () => {
    const later = (cb) => setTimeout(() => cb(null, 'late'), 5);
    await expect(promisify(later)()).resolves.toBe('late');
  });
});
```

%% hints
- Return a regular `function (...args)` so you can capture `this`.
- `new Promise((resolve, reject) => fn.call(this, ...args, (err, value) => (err ? reject(err) : resolve(value))))`.
- A throw inside the Promise executor already becomes a rejection.

%% solution
```js
export function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, value) => (err ? reject(err) : resolve(value)));
    });
  };
}
```

%% exercise promises-all | Promise.all from scratch | 3 | js | js | promiseAll, promiseAllSettled | 20
Implement `promiseAll(iterable)` and `promiseAllSettled(iterable)` **without** using `Promise.all`, `allSettled`, `race` or `any`.

`promiseAll`:
- Accepts any iterable; non-promise values count as already resolved.
- Fulfills with results **in input order** (not completion order).
- Rejects with the first rejection reason. Empty input fulfills with `[]`.

`promiseAllSettled` fulfills with `{ status: 'fulfilled', value }` / `{ status: 'rejected', reason }` for every input, in order, and never rejects.

%% starter
```js
export function promiseAll(iterable) {
  // your code
}

export function promiseAllSettled(iterable) {
  // your code
}
```

%% tests
```js
const later = (ms, v, fail) => new Promise((res, rej) => setTimeout(() => (fail ? rej(v) : res(v)), ms));

describe('promiseAll', () => {
  it('resolves values in input order', async () => {
    await expect(promiseAll([later(20, 'a'), later(5, 'b'), 'c'])).resolves.toEqual(['a', 'b', 'c']);
  });
  it('accepts non-promise values only', async () => {
    await expect(promiseAll([1, 2, 3])).resolves.toEqual([1, 2, 3]);
  });
  it('resolves [] for empty input', async () => {
    await expect(promiseAll([])).resolves.toEqual([]);
  });
  it('rejects with the first rejection', async () => {
    await expect(promiseAll([later(20, 'slow'), later(5, 'boom', true), later(10, 'x', true)])).rejects.toBe('boom');
  });
  it('accepts any iterable', async () => {
    await expect(promiseAll(new Set([1, 2]))).resolves.toEqual([1, 2]);
    function* gen() { yield later(1, 'g1'); yield 'g2'; }
    await expect(promiseAll(gen())).resolves.toEqual(['g1', 'g2']);
  });
  it('does not wait for the slower promises once one rejects', async () => {
    const start = Date.now();
    await promiseAll([later(300, 'slow'), later(5, 'x', true)]).catch(() => {});
    expect(Date.now() - start).toBeLessThan(150);
  });
  it('does not call Promise.all', async () => {
    const orig = Promise.all;
    Promise.all = () => { throw new Error('native used'); };
    let out;
    try { out = await promiseAll([1, Promise.resolve(2)]); } finally { Promise.all = orig; }
    expect(out).toEqual([1, 2]);
  });
});

describe('promiseAllSettled', () => {
  it('reports every outcome in order', async () => {
    const out = await promiseAllSettled([later(10, 'ok'), later(5, 'bad', true), 42]);
    expect(out).toEqual([
      { status: 'fulfilled', value: 'ok' },
      { status: 'rejected', reason: 'bad' },
      { status: 'fulfilled', value: 42 },
    ]);
  });
  it('resolves [] for empty input', async () => {
    await expect(promiseAllSettled([])).resolves.toEqual([]);
  });
});
```

%% hints
- Wrap each item: `Promise.resolve(item).then(onOk, onErr)` (that is allowed — it's only the *combinators* that are banned).
- Write into `results[index]`, not `push` — completion order differs from input order.
- Count completions; resolve when `done === total`. Handle `total === 0` up front.
- `allSettled` is `all` where each input is first converted to never-rejecting `{ status, … }` promises.

%% solution
```js
export function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);
    const results = new Array(items.length);
    let remaining = items.length;
    if (remaining === 0) return resolve(results);
    items.forEach((item, i) => {
      Promise.resolve(item).then((value) => {
        results[i] = value;
        if (--remaining === 0) resolve(results);
      }, reject);
    });
  });
}

export function promiseAllSettled(iterable) {
  return promiseAll(
    Array.from(iterable, (item) =>
      Promise.resolve(item).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason }),
      ),
    ),
  );
}
```

%% exercise promises-timeout | withTimeout() | 3 | js | js | withTimeout, TimeoutError | 15
Write `withTimeout(promise, ms)`.

- Fulfills/rejects like `promise` if it settles within `ms`.
- Otherwise rejects with a `TimeoutError` (export it; `error.name === 'TimeoutError'`, message `Timed out after <ms>ms`).
- **Clean up**: once settled either way, the internal timer must be cleared (no dangling timers).
- Late settlement of the original promise afterwards must not cause an unhandled rejection.

%% starter
```js
export class TimeoutError extends Error {
  // your code
}

export function withTimeout(promise, ms) {
  // your code
}
```

%% tests
```js
describe('withTimeout', () => {
  it('passes through a fast success', async () => {
    jest.useFakeTimers();
    const p = withTimeout(new Promise((r) => setTimeout(r, 50, 'ok')), 100);
    await jest.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('ok');
  });

  it('passes through a fast failure', async () => {
    jest.useFakeTimers();
    const p = withTimeout(new Promise((_, rej) => setTimeout(rej, 10, new Error('inner'))), 100);
    const assertion = expect(p).rejects.toThrow('inner');
    await jest.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it('rejects with a TimeoutError when too slow', async () => {
    jest.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 100);
    const assertion = expect(p).rejects.toMatchObject({ name: 'TimeoutError', message: 'Timed out after 100ms' });
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
    expect(new TimeoutError('x')).toBeInstanceOf(Error);
  });

  it('does not time out before the deadline', async () => {
    jest.useFakeTimers();
    const settled = jest.fn();
    withTimeout(new Promise(() => {}), 100).catch(settled);
    await jest.advanceTimersByTimeAsync(99);
    expect(settled).not.toHaveBeenCalled();
  });

  it('clears its timer once the promise settles', async () => {
    jest.useFakeTimers();
    const p = withTimeout(Promise.resolve('x'), 1000);
    await p;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clears its timer on rejection too', async () => {
    jest.useFakeTimers();
    await withTimeout(Promise.reject(new Error('e')), 1000).catch(() => {});
    expect(jest.getTimerCount()).toBe(0);
  });

  it('accepts plain values', async () => {
    jest.useFakeTimers();
    await expect(withTimeout(5, 10)).resolves.toBe(5);
  });
});
```

%% hints
- Build it with `new Promise((resolve, reject) => { const id = setTimeout(...); promise.then(...) })`.
- Use `Promise.resolve(promise)` so plain values work.
- In both settle callbacks call `clearTimeout(id)` first. (`Promise.race` + `finally` also works.)
- `class TimeoutError extends Error { constructor(ms) { super(...); this.name = 'TimeoutError'; } }`.

%% solution
```js
export class TimeoutError extends Error {
  constructor(ms) {
    super(`Timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new TimeoutError(ms)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(id); resolve(value); },
      (err) => { clearTimeout(id); reject(err); },
    );
  });
}
```

%% exercise promises-mypromise | Build a Promise | 4 | js | js | MyPromise | 40
Implement a spec-shaped `MyPromise` class (a lightly trimmed Promises/A+).

- `new MyPromise(executor)` — the executor runs **synchronously** with `(resolve, reject)`. A throw inside rejects. Only the first `resolve`/`reject` counts.
- `then(onFulfilled, onRejected)` returns a **new** `MyPromise`. Handlers run **asynchronously** (microtask) even if already settled; they run at most once; several `then`s on one promise fire in order.
- Non-function handlers pass the value/reason through.
- The value a handler returns resolves the next promise; if it's a **thenable** (promise or `{ then }`), adopt its outcome. A throw rejects the next promise.
- Resolving a promise with itself rejects with a `TypeError`.
- `catch(fn)`, `finally(fn)` (passes the outcome through; if `fn` throws/rejects, that wins).
- Statics `MyPromise.resolve(v)` / `MyPromise.reject(e)`.
- Instances must work with native `await` (they're thenables).

%% starter
```js
export class MyPromise {
  constructor(executor) {
    // your code
  }

  then(onFulfilled, onRejected) {
    // your code
  }

  catch(onRejected) {
    // your code
  }

  finally(onFinally) {
    // your code
  }

  static resolve(value) {
    // your code
  }

  static reject(reason) {
    // your code
  }
}
```

%% tests
```js
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('MyPromise — basics', () => {
  it('runs the executor synchronously', () => {
    const log = [];
    new MyPromise(() => log.push('executor'));
    log.push('after');
    expect(log).toEqual(['executor', 'after']);
  });

  it('calls then handlers asynchronously, even when already resolved', async () => {
    const log = [];
    MyPromise.resolve(1).then(() => log.push('then'));
    log.push('sync');
    expect(log).toEqual(['sync']);
    await tick();
    expect(log).toEqual(['sync', 'then']);
  });

  it('delivers the fulfilled value', async () => {
    const fn = jest.fn();
    new MyPromise((res) => setTimeout(() => res(42), 5)).then(fn);
    await tick(); await new Promise((r) => setTimeout(r, 10));
    expect(fn).toHaveBeenCalledWith(42);
  });

  it('delivers the rejection reason', async () => {
    const fn = jest.fn();
    MyPromise.reject('why').then(null, fn);
    await tick();
    expect(fn).toHaveBeenCalledWith('why');
  });

  it('only honours the first resolve/reject', async () => {
    const ok = jest.fn(), bad = jest.fn();
    new MyPromise((res, rej) => { res('first'); res('second'); rej('third'); }).then(ok, bad);
    await tick();
    expect(ok).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledWith('first');
    expect(bad).not.toHaveBeenCalled();
  });

  it('rejects when the executor throws', async () => {
    const fn = jest.fn();
    new MyPromise(() => { throw new Error('boom'); }).catch(fn);
    await tick();
    expect(fn.mock.calls[0][0].message).toBe('boom');
  });

  it('calls multiple handlers in registration order, once each', async () => {
    const log = [];
    const p = MyPromise.resolve('v');
    p.then(() => log.push(1));
    p.then(() => log.push(2));
    p.then(() => log.push(3));
    await tick();
    expect(log).toEqual([1, 2, 3]);
  });
});

describe('MyPromise — chaining', () => {
  it('returns a new promise and chains values', async () => {
    const p = MyPromise.resolve(1);
    const q = p.then((x) => x + 1);
    expect(q).not.toBe(p);
    expect(await q.then((x) => x * 10)).toBe(20);
  });

  it('adopts a returned promise', async () => {
    const out = await MyPromise.resolve(1).then((x) => new MyPromise((r) => setTimeout(() => r(x + 100), 5)));
    expect(out).toBe(101);
  });

  it('adopts a returned native promise and plain thenables', async () => {
    expect(await MyPromise.resolve(0).then(() => Promise.resolve('native'))).toBe('native');
    expect(await MyPromise.resolve(0).then(() => ({ then: (r) => r('thenable') }))).toBe('thenable');
  });

  it('turns a throw into a rejection that skips then handlers', async () => {
    const skipped = jest.fn(), caught = jest.fn();
    MyPromise.resolve(1).then(() => { throw new Error('x'); }).then(skipped).catch(caught);
    await tick();
    expect(skipped).not.toHaveBeenCalled();
    expect(caught).toHaveBeenCalledTimes(1);
  });

  it('passes values through missing handlers', async () => {
    expect(await MyPromise.resolve('v').then().then(undefined).then((x) => x)).toBe('v');
    await expect(MyPromise.reject('e').then((x) => x).catch((e) => e)).resolves.toBe('e');
  });

  it('lets catch recover the chain', async () => {
    expect(await MyPromise.reject('e').catch(() => 'recovered').then((v) => v + '!')).toBe('recovered!');
  });

  it('rejects when resolved with itself', async () => {
    let p;
    p = MyPromise.resolve(1).then(() => p);
    const err = await p.then(null, (e) => e);
    expect(err).toBeInstanceOf(TypeError);
  });

  it('resolves through a thenable passed to resolve()', async () => {
    const v = await new MyPromise((res) => res(MyPromise.resolve('inner')));
    expect(v).toBe('inner');
  });
});

describe('MyPromise — finally & interop', () => {
  it('finally passes the value through', async () => {
    const f = jest.fn(() => 'ignored');
    expect(await MyPromise.resolve('v').finally(f)).toBe('v');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('finally passes a rejection through', async () => {
    await expect(MyPromise.reject('r').finally(() => {}).then(null, (e) => e)).resolves.toBe('r');
  });

  it('finally waits for a returned promise and lets a throw override', async () => {
    let done = false;
    await MyPromise.resolve(1).finally(() => new MyPromise((r) => setTimeout(() => { done = true; r(); }, 5)));
    expect(done).toBe(true);
    const err = await MyPromise.resolve(1).finally(() => { throw new Error('override'); }).then(null, (e) => e);
    expect(err.message).toBe('override');
  });

  it('is awaitable with native await', async () => {
    expect(await MyPromise.resolve(3)).toBe(3);
    await expect((async () => { await MyPromise.reject(new Error('nope')); })()).rejects.toThrow('nope');
  });

  it('MyPromise.resolve returns the same instance for a MyPromise', () => {
    const p = MyPromise.resolve(1);
    expect(MyPromise.resolve(p)).toBe(p);
  });
});
```

%% hints
- State: `#state`, `#value`, and a `#handlers` queue. `then` pushes a handler; if already settled, schedule a flush.
- Schedule with `queueMicrotask`. Flush copies and clears the queue so each handler runs once.
- The promise returned by `then` needs its own `resolve`/`reject`. Wrap the user's callback in `try { resolve(cb(value)) } catch (e) { reject(e) }`.
- Keep the resolution logic in one place — `resolvePromise(x)`: if `x === this` reject `TypeError`; if `x` is an object/function with a callable `then`, call it with once-guarded resolve/reject callbacks; otherwise fulfill.
- `finally(fn)`: `this.then((v) => MyPromise.resolve(fn()).then(() => v), (e) => MyPromise.resolve(fn()).then(() => { throw e; }))`.

%% solution
```js
export class MyPromise {
  #state = 'pending';
  #value;
  #handlers = [];

  constructor(executor) {
    let done = false;
    const resolve = (v) => { if (!done) { done = true; this.#resolve(v); } };
    const reject = (e) => { if (!done) { done = true; this.#settle('rejected', e); } };
    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  #settle(state, value) {
    if (this.#state !== 'pending') return;
    this.#state = state;
    this.#value = value;
    this.#flush();
  }

  #resolve(x) {
    if (x === this) return this.#settle('rejected', new TypeError('Chaining cycle detected for promise'));
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
      let then;
      try {
        then = x.then;
      } catch (e) {
        return this.#settle('rejected', e);
      }
      if (typeof then === 'function') {
        let called = false;
        try {
          then.call(
            x,
            (v) => { if (!called) { called = true; this.#resolve(v); } },
            (e) => { if (!called) { called = true; this.#settle('rejected', e); } },
          );
        } catch (e) {
          if (!called) { called = true; this.#settle('rejected', e); }
        }
        return;
      }
    }
    this.#settle('fulfilled', x);
  }

  #flush() {
    if (this.#state === 'pending') return;
    const queue = this.#handlers;
    this.#handlers = [];
    queue.forEach((h) => queueMicrotask(h));
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      this.#handlers.push(() => {
        const fulfilled = this.#state === 'fulfilled';
        const cb = fulfilled ? onFulfilled : onRejected;
        if (typeof cb !== 'function') return fulfilled ? resolve(this.#value) : reject(this.#value);
        try {
          resolve(cb(this.#value));
        } catch (e) {
          reject(e);
        }
      });
      this.#flush();
    });
  }

  catch(onRejected) {
    return this.then(undefined, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (v) => MyPromise.resolve(onFinally()).then(() => v),
      (e) => MyPromise.resolve(onFinally()).then(() => { throw e; }),
    );
  }

  static resolve(value) {
    return value instanceof MyPromise ? value : new MyPromise((res) => res(value));
  }

  static reject(reason) {
    return new MyPromise((_, rej) => rej(reason));
  }
}
```
