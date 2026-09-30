---
id: async-await
track: js
title: async/await & concurrency patterns
summary: Sequential vs parallel, retries, concurrency limits, serialising work and ignoring stale results.
---

`async`/`await` is syntax over promises. An `async` function **always returns a promise**; `await x` pauses *that function* (not the thread), and resumes in a microtask when `x` settles. `return v` fulfills the promise, `throw e` rejects it.

```js
async function load(id) {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // fetch only rejects on network failure!
    return await res.json();
  } catch (err) {
    log(err);
    throw err;        // rethrow if the caller should know
  } finally {
    spinner.hide();
  }
}
```

`return await` vs `return`: inside `try` you need the `await` for the `catch` to see the rejection; outside `try` it's redundant.

## Sequential vs. parallel — the most common perf bug

```js
// Sequential: total time = a + b + c
const a = await getA();
const b = await getB();
const c = await getC();

// Parallel: total time = max(a, b, c)
const [a, b, c] = await Promise.all([getA(), getB(), getC()]);
```

Start the work first, `await` later. `await` inside a `for…of` is *deliberately* sequential; inside `.map()` with `Promise.all` it's parallel; **`.forEach(async …)` is a bug** — `forEach` ignores the returned promises, so nothing waits and errors go unhandled.

## Errors

- One `try/catch` can guard many awaits.
- `Promise.all` rejects on the first failure but the others keep running. Use `allSettled` when partial success is fine.
- An `async` function that throws *synchronously before its first await* still returns a rejected promise — it never throws synchronously. (A plain function returning a promise can do either; that inconsistency is why libraries prefer `async`.)

## Real-world concurrency patterns

Naive `Promise.all(items.map(fetch))` fires **everything at once**: 5 000 requests will get rate-limited or exhaust sockets. The toolbox below is what you reach for instead, and each is a classic interview question:

| Problem | Pattern |
| --- | --- |
| Flaky network | **retry** with exponential backoff (+ jitter) |
| Too many concurrent operations | **limit** the pool (N workers pulling from a shared cursor) |
| Operations that must not interleave (writes to the same resource) | **serialise** with a promise chain (a mutex) |
| Search-as-you-type, out-of-order responses | **latest-wins**: ignore results from superseded calls |
| Hung upstream | **timeout** + `AbortController` to actually cancel |
| Duplicate simultaneous requests | **dedupe** in-flight promises |

### Cancellation

Promises can't be cancelled. The standard is `AbortController`: create one, pass `signal` into `fetch` (or your own function), call `controller.abort()`. The awaited operation rejects with an `AbortError`, and you should treat that as "expected", not as a failure.

## Testing async code

Async tests should `await` (or return) their promise. With fake timers use `await jest.advanceTimersByTimeAsync(ms)` — it also lets pending microtasks (your `await` continuations) run, which the synchronous variant won't.

%% exercise async-load-users | Parallel loading with partial failures | 2 | js | js | loadUsers | 12
`loadUsers(ids, fetchUser)` calls `fetchUser(id)` (returns a promise) for every id and resolves with:

```js
{ users: [/* successful results, in the order of ids */], failed: [/* ids whose request rejected */] }
```

- Requests must run **in parallel** (total time ≈ the slowest one, not the sum).
- One failure must not reject the whole call.

%% starter
```js
export async function loadUsers(ids, fetchUser) {
  // your code
}
```

%% tests
```js
const wait = (ms, v) => new Promise((r) => setTimeout(r, ms, v));

describe('loadUsers', () => {
  it('returns successes in id order', async () => {
    jest.useFakeTimers();
    const fetchUser = (id) => wait(id === 1 ? 50 : 10, { id });
    const p = loadUsers([1, 2, 3], fetchUser);
    await jest.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toEqual({ users: [{ id: 1 }, { id: 2 }, { id: 3 }], failed: [] });
  });

  it('collects failed ids without rejecting', async () => {
    jest.useFakeTimers();
    const fetchUser = (id) => (id % 2 ? Promise.reject(new Error('x')) : wait(5, { id }));
    const p = loadUsers([1, 2, 3, 4], fetchUser);
    await jest.advanceTimersByTimeAsync(5);
    await expect(p).resolves.toEqual({ users: [{ id: 2 }, { id: 4 }], failed: [1, 3] });
  });

  it('starts every request immediately (parallel)', async () => {
    jest.useFakeTimers();
    const fetchUser = jest.fn((id) => wait(100, id));
    loadUsers([1, 2, 3], fetchUser);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchUser).toHaveBeenCalledTimes(3);
  });

  it('finishes in the time of the slowest request, not the sum', async () => {
    jest.useFakeTimers();
    let done = false;
    loadUsers([1, 2, 3], (id) => wait(100, id)).then(() => { done = true; });
    await jest.advanceTimersByTimeAsync(100);
    expect(done).toBe(true);
  });

  it('handles an empty list', async () => {
    await expect(loadUsers([], () => {})).resolves.toEqual({ users: [], failed: [] });
  });
});
```

%% hints
- `Promise.allSettled(ids.map(fetchUser))` gives you every outcome in order.
- Then split by `status`. Index `i` in the results maps back to `ids[i]`.

%% solution
```js
export async function loadUsers(ids, fetchUser) {
  const results = await Promise.allSettled(ids.map((id) => fetchUser(id)));
  const users = [];
  const failed = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') users.push(r.value);
    else failed.push(ids[i]);
  });
  return { users, failed };
}
```

%% exercise async-retry | retry with backoff | 2 | js | js | retry | 18
Write `retry(fn, options)`.

- `fn(attempt)` is called with the zero-based attempt number and may return a promise.
- On failure, wait `delay * factor ** attempt` ms then try again (defaults: `retries = 3`, `delay = 100`, `factor = 2`). So there are up to `retries + 1` attempts.
- If all attempts fail, reject with the **last** error. Don't wait after the final failure.
- `options.onRetry(error, nextAttemptNumber)` (optional) is called before each wait.

%% starter
```js
export async function retry(fn, { retries = 3, delay = 100, factor = 2, onRetry } = {}) {
  // your code
}
```

%% tests
```js
describe('retry', () => {
  it('returns immediately on success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(retry(fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(0);
  });

  it('retries with exponential backoff', async () => {
    jest.useFakeTimers();
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue('ok');
    const p = retry(fn, { retries: 3, delay: 100, factor: 2 });
    await jest.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(199);
    expect(fn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(3);
    await expect(p).resolves.toBe('ok');
    expect(fn).toHaveBeenLastCalledWith(2);
  });

  it('rejects with the last error after exhausting retries', async () => {
    jest.useFakeTimers();
    let n = 0;
    const fn = jest.fn(() => Promise.reject(new Error(`fail ${++n}`)));
    const p = retry(fn, { retries: 2, delay: 10 });
    const assertion = expect(p).rejects.toThrow('fail 3');
    await jest.advanceTimersByTimeAsync(10 + 20);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not schedule a wait after the final failure', async () => {
    jest.useFakeTimers();
    const p = retry(() => Promise.reject(new Error('x')), { retries: 1, delay: 10 });
    const assertion = expect(p).rejects.toThrow('x');
    await jest.advanceTimersByTimeAsync(10);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('retries: 0 means a single attempt', async () => {
    const fn = jest.fn(() => Promise.reject(new Error('once')));
    await expect(retry(fn, { retries: 0 })).rejects.toThrow('once');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('catches synchronous throws from fn too', async () => {
    jest.useFakeTimers();
    let n = 0;
    const fn = () => { if (++n < 2) throw new Error('sync'); return 'fine'; };
    const p = retry(fn, { delay: 5 });
    await jest.advanceTimersByTimeAsync(5);
    await expect(p).resolves.toBe('fine');
  });

  it('calls onRetry before each wait', async () => {
    jest.useFakeTimers();
    const onRetry = jest.fn();
    const err = new Error('e');
    const fn = jest.fn().mockRejectedValueOnce(err).mockResolvedValue('ok');
    const p = retry(fn, { delay: 10, onRetry });
    await jest.advanceTimersByTimeAsync(10);
    await p;
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(err, 1);
  });
});
```

%% hints
- A `for (let attempt = 0; ; attempt++)` loop with `try { return await fn(attempt); } catch (e) { … }`.
- In the `catch`: if `attempt >= retries` rethrow; otherwise call `onRetry`, then `await new Promise((r) => setTimeout(r, delay * factor ** attempt))`.

%% solution
```js
export async function retry(fn, { retries = 3, delay = 100, factor = 2, onRetry } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries) throw err;
      onRetry?.(err, attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay * factor ** attempt));
    }
  }
}
```

%% exercise async-map-limit | Concurrency-limited map | 3 | js | js | mapLimit | 25
Write `mapLimit(items, limit, fn)`: like `Promise.all(items.map(fn))` but with **at most `limit` calls in flight** at any moment.

- `fn(item, index)` may be async. Results come back **in input order**.
- As soon as one call finishes, the next item starts (don't process in lock-step batches).
- If any call rejects, `mapLimit` rejects with that error and **starts no further calls**.
- `limit` must be ≥ 1, otherwise throw a `RangeError`. A `limit` larger than the list is fine.

%% starter
```js
export async function mapLimit(items, limit, fn) {
  // your code
}
```

%% tests
```js
const wait = (ms, v) => new Promise((r) => setTimeout(r, ms, v));

describe('mapLimit', () => {
  it('returns results in input order', async () => {
    jest.useFakeTimers();
    const p = mapLimit([30, 10, 20], 2, (ms, i) => wait(ms, `#${i}`));
    await jest.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toEqual(['#0', '#1', '#2']);
  });

  it('never exceeds the limit', async () => {
    jest.useFakeTimers();
    let active = 0, peak = 0;
    const fn = async () => {
      peak = Math.max(peak, ++active);
      await wait(100);
      active--;
    };
    const p = mapLimit(Array.from({ length: 7 }), 3, fn);
    await jest.advanceTimersByTimeAsync(1000);
    await p;
    expect(peak).toBe(3);
  });

  it('starts the next item as soon as a slot frees up', async () => {
    jest.useFakeTimers();
    const fn = jest.fn((ms) => wait(ms));
    mapLimit([100, 10, 10, 10], 2, fn);
    await jest.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(10);
    expect(fn).toHaveBeenCalledTimes(3);
    await jest.advanceTimersByTimeAsync(10);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('rejects on the first error and starts nothing new', async () => {
    jest.useFakeTimers();
    const fn = jest.fn(async (n) => {
      await wait(n === 1 ? 5 : 50);
      if (n === 1) throw new Error('bad item');
      return n;
    });
    const p = mapLimit([0, 1, 2, 3, 4], 2, fn);
    const assertion = expect(p).rejects.toThrow('bad item');
    await jest.advanceTimersByTimeAsync(500);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('works when limit exceeds the number of items', async () => {
    await expect(mapLimit([1, 2], 10, async (x) => x * 2)).resolves.toEqual([2, 4]);
  });

  it('handles an empty list', async () => {
    await expect(mapLimit([], 3, async (x) => x)).resolves.toEqual([]);
  });

  it('validates limit', async () => {
    await expect(mapLimit([1], 0, async (x) => x)).rejects.toBeInstanceOf(RangeError);
  });

  it('passes the index to fn', async () => {
    const fn = jest.fn(async (x) => x);
    await mapLimit(['a', 'b'], 1, fn);
    expect(fn).toHaveBeenNthCalledWith(2, 'b', 1);
  });
});
```

%% hints
- Spawn `min(limit, items.length)` **workers**. Each is an async loop that claims the next index from a shared counter until none are left.
- `const i = next++` is safe: JS is single-threaded, so claiming an index is atomic.
- Write `results[i] = await fn(items[i], i)` so order is preserved.
- On error set a `failed` flag; workers check it before claiming more work. `await Promise.all(workers)` then rejects with the first error.

%% solution
```js
export async function mapLimit(items, limit, fn) {
  if (!(limit >= 1)) throw new RangeError('limit must be >= 1');
  const list = Array.from(items);
  const results = new Array(list.length);
  let next = 0;
  let failed = false;

  async function worker() {
    while (!failed) {
      const i = next++;
      if (i >= list.length) return;
      try {
        results[i] = await fn(list[i], i);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker));
  return results;
}
```

%% exercise async-serialize | Serialise async calls | 3 | js | js | serialize | 15
Write `serialize(fn)`, which wraps an async function so that **calls never overlap**: each call starts only after the previous one has settled, in call order. (Think: appending to a file, or saving a document.)

- Each call returns a promise for **its own** result.
- If one call rejects, later calls still run.
- Arguments and `this` are forwarded.

%% starter
```js
export function serialize(fn) {
  // your code
}
```

%% tests
```js
const wait = (ms, v) => new Promise((r) => setTimeout(r, ms, v));

describe('serialize', () => {
  it('never runs two calls at once', async () => {
    jest.useFakeTimers();
    let active = 0, peak = 0;
    const save = serialize(async () => { peak = Math.max(peak, ++active); await wait(10); active--; });
    const all = Promise.all([save(), save(), save()]);
    await jest.advanceTimersByTimeAsync(100);
    await all;
    expect(peak).toBe(1);
  });

  it('runs in call order and returns each call its own result', async () => {
    jest.useFakeTimers();
    const order = [];
    const f = serialize(async (name, ms) => { order.push(`start ${name}`); await wait(ms); order.push(`end ${name}`); return name.toUpperCase(); });
    const p = Promise.all([f('a', 30), f('b', 5), f('c', 1)]);
    await jest.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toEqual(['A', 'B', 'C']);
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });

  it('keeps going after a rejection', async () => {
    jest.useFakeTimers();
    const f = serialize(async (fail) => { await wait(5); if (fail) throw new Error('bad'); return 'fine'; });
    const first = f(true);
    const second = f(false);
    const assertion = expect(first).rejects.toThrow('bad');
    await jest.advanceTimersByTimeAsync(20);
    await assertion;
    await expect(second).resolves.toBe('fine');
  });

  it('forwards this and arguments', async () => {
    const obj = { k: 1, add: serialize(async function (n) { return this.k + n; }) };
    await expect(obj.add(2)).resolves.toBe(3);
  });

  it('does not delay the first call', async () => {
    jest.useFakeTimers();
    const fn = jest.fn(async () => {});
    serialize(fn)();
    await jest.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('handles synchronous functions and sync throws', async () => {
    const f = serialize((x) => { if (x < 0) throw new Error('neg'); return x; });
    await expect(f(-1)).rejects.toThrow('neg');
    await expect(f(2)).resolves.toBe(2);
  });
});
```

%% hints
- Keep a `tail` promise. Each call chains onto it: `const result = tail.then(run, run)`.
- The next `tail` must **not** reject, or one failure would poison the queue: `tail = result.catch(() => {})`.
- Chaining with `then(run, run)` starts `run` after the previous call settled *either way*.
- Wrap in `Promise.resolve().then(...)`-style so a synchronous throw in `fn` becomes a rejection.

%% solution
```js
export function serialize(fn) {
  let tail = Promise.resolve();
  return function (...args) {
    const run = () => fn.apply(this, args);
    const result = tail.then(run, run);
    tail = result.catch(() => {});
    return result;
  };
}
```

%% exercise async-latest | Latest wins | 3 | js | js | latest | 15
Search-as-you-type fires a request per keystroke, and responses can arrive **out of order**. Write `latest(fn)`, wrapping an async `fn` so that only the most recent call's outcome matters.

Each call returns a promise for `{ stale: boolean, value?: T }`:
- The most recent call → `{ stale: false, value }` when `fn` resolves (if `fn` rejects, the promise rejects).
- Any call that has since been superseded by a newer call → `{ stale: true }` **whenever it settles** — whether `fn` fulfilled or rejected.

%% starter
```js
export function latest(fn) {
  // your code
}
```

%% tests
```js
const wait = (ms, v) => new Promise((r) => setTimeout(r, ms, v));

describe('latest', () => {
  it('a single call is fresh', async () => {
    const search = latest(async (q) => q.toUpperCase());
    await expect(search('a')).resolves.toEqual({ stale: false, value: 'A' });
  });

  it('marks an older, slower call as stale', async () => {
    jest.useFakeTimers();
    const search = latest((q, ms) => wait(ms, q));
    const slow = search('slow', 100);
    const fast = search('fast', 10);
    await jest.advanceTimersByTimeAsync(100);
    await expect(fast).resolves.toEqual({ stale: false, value: 'fast' });
    await expect(slow).resolves.toEqual({ stale: true });
  });

  it('marks an older call stale even if it resolves first', async () => {
    jest.useFakeTimers();
    const search = latest((q, ms) => wait(ms, q));
    const first = search('first', 10);
    const second = search('second', 100);
    await jest.advanceTimersByTimeAsync(100);
    await expect(first).resolves.toEqual({ stale: true });
    await expect(second).resolves.toEqual({ stale: false, value: 'second' });
  });

  it('swallows errors of stale calls', async () => {
    jest.useFakeTimers();
    const search = latest((q, ms) => wait(ms).then(() => { if (q === 'bad') throw new Error('x'); return q; }));
    const bad = search('bad', 10);
    const good = search('good', 20);
    await jest.advanceTimersByTimeAsync(30);
    await expect(bad).resolves.toEqual({ stale: true });
    await expect(good).resolves.toEqual({ stale: false, value: 'good' });
  });

  it('propagates the error of the latest call', async () => {
    const search = latest(async () => { throw new Error('latest failed'); });
    await expect(search()).rejects.toThrow('latest failed');
  });

  it('a later call after settlement is fresh again', async () => {
    const search = latest(async (x) => x);
    await search(1);
    await expect(search(2)).resolves.toEqual({ stale: false, value: 2 });
  });
});
```

%% hints
- A counter in the closure: `const id = ++latestId;` per call.
- When `fn` settles, compare `id !== latestId` → stale.
- Write it with `try/catch`: `catch (e) { if (id !== latestId) return { stale: true }; throw e; }`.

%% solution
```js
export function latest(fn) {
  let latestId = 0;
  return async function (...args) {
    const id = ++latestId;
    try {
      const value = await fn.apply(this, args);
      return id === latestId ? { stale: false, value } : { stale: true };
    } catch (err) {
      if (id !== latestId) return { stale: true };
      throw err;
    }
  };
}
```
