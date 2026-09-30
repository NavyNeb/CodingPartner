---
id: async-await
track: js
title: async/await & concurrency patterns
summary: Write promise code that reads top to bottom, know when to run things in parallel, and learn the patterns (retry, limit, serialise, latest-wins) that real apps need.
---

## The idea in one sentence

`async`/`await` lets you write code that **waits for slow things** (network, timers) in a normal top-to-bottom style — without freezing the page.

> **Analogy** You're reading a book and need to wait for your coffee. `await` is a **bookmark**: you mark your place, go do other things, and come back to the exact line when the coffee is ready. Only *your reading* pauses — the café (the rest of the program) keeps running.

It is just nicer syntax over promises. Two rules cover most of it:

1. An **`async` function always returns a promise.** `return v` fulfils it; `throw e` rejects it.
2. **`await x`** pauses *that function* until the promise `x` settles, then gives you its value (or throws its error).

## Watching `await` pause a function

The surprise for beginners: code *after* the function call keeps running while the function waits. Predict the order first:

```js try predict
const getNumber = () => Promise.resolve(42);

async function main() {
  console.log('A');
  const n = await getNumber();
  console.log('B', n);
}

main();
console.log('C');
```

Now step through to see why it's `A C B`:

```stepper await pauses the function, not the program
code:
  const getNumber = () => Promise.resolve(42);
  async function main() {
    console.log('A');
    const n = await getNumber();
    console.log('B', n);
  }
  main();
  console.log('C');
---
line: 7
say: `main()` is called. It starts running immediately, like any function.
main(): running
Console:
---
line: 3
say: Runs normally until the first `await`.
Console: A
---
line: 4
say: `getNumber()` returns a promise. `await` says "**pause me here** until it's done" and hands control **back to whoever called `main`**.
main(): paused at await
---
line: 8
say: The caller carries on! `console.log('C')` runs *before* `main` continues. This is why `await` doesn't block the page.
Console: A | C
---
line: 4
say: The promise is ready. `main` is scheduled to continue (as a microtask — the same queue promise callbacks use), and `n` becomes `42`.
main(): resumed (n = 42)
---
line: 5
say: The rest of `main` runs.
main(): finished
Console: A | C | B 42
```

## Errors: `try` / `catch` / `finally`

Because `await` *throws* when a promise rejects, you can use ordinary `try/catch`:

```js try
async function loadUser(id) {
  try {
    const res = await fakeFetch(id);
    if (!res.ok) throw new Error('HTTP ' + res.status);   // fetch only rejects on NETWORK failure, not 404/500!
    return res.data;
  } catch (err) {
    console.log('could not load:', err.message);
    throw err;                                            // rethrow if the caller should know too
  } finally {
    console.log('(hide spinner)');                        // runs either way
  }
}

const fakeFetch = (id) => Promise.resolve(id === 1 ? { ok: true, data: 'Ada' } : { ok: false, status: 404 });

loadUser(1).then(console.log);
loadUser(2).catch(() => console.log('caller saw the failure too'));
```

> **Watch out** `fetch` only rejects when the network fails. A `404` or `500` still *fulfils*, so always check `res.ok`.

`return await x` inside a `try` is needed for the `catch` to see a rejection; outside `try` the `await` is redundant.

## Sequential vs parallel — the most common speed bug

```js
const a = await getA();   // waits for A…
const b = await getB();   // …and only THEN starts B
```

If B doesn't need A's result, you just made your code slower. Start the work first, `await` later:

```js try
const wait = (ms, v) => new Promise((resolve) => setTimeout(() => resolve(v), ms));

async function sequential() {
  const start = Date.now();
  await wait(100); await wait(100); await wait(100);
  console.log('sequential ≈', Math.round((Date.now() - start) / 100) * 100, 'ms');
}

async function parallel() {
  const start = Date.now();
  await Promise.all([wait(100), wait(100), wait(100)]);
  console.log('parallel   ≈', Math.round((Date.now() - start) / 100) * 100, 'ms');
}

sequential().then(parallel);
```

![Sequential awaits add up; Promise.all takes only as long as the slowest task](fig:seq-vs-parallel "Sequential: a + b + c. Parallel: max(a, b, c).")

### `for…of`, `map`, `forEach` — which waits?

| Code | Behaviour |
| --- | --- |
| `for (const x of xs) await work(x)` | one at a time, **on purpose** |
| `await Promise.all(xs.map(work))` | all at once (parallel) |
| `xs.forEach(async (x) => { await work(x) })` | **a bug**: `forEach` ignores the promises, so nothing waits |

```js try predict
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  [1, 2, 3].forEach(async (n) => {
    await wait(50);
    console.log('done', n);
  });
  console.log('finished');
}

run();
```

"finished" prints *before* the work is done, and if any of those promises rejected, nobody would hear about it.

## Real-world concurrency patterns

`await Promise.all(items.map(fetchOne))` starts **every** request at once. With 5,000 items you'll be rate-limited, run out of sockets, or freeze the server. These patterns are what you reach for instead (and each is a classic interview question):

| Problem | Pattern |
| --- | --- |
| Flaky network | **retry** with exponential backoff (and jitter) |
| Too many at once | **limit** — a pool of N workers |
| Writes that must not overlap | **serialise** — a promise chain acting as a queue |
| Search-as-you-type, out-of-order replies | **latest wins** — ignore stale results |
| Hung request | **timeout** + `AbortController` |
| Same request fired twice | **dedupe** the in-flight promise |

### Retry with backoff

Wait a little, then longer, then longer: `delay × 2^attempt`.

```js try
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retry(fn, tries = 3) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (attempt >= tries - 1) throw error;   // out of attempts: give up with the last error
      await wait(50 * 2 ** attempt);            // 50ms, 100ms, 200ms…
    }
  }
}

retry(async (attempt) => {
  console.log('attempt', attempt);
  if (attempt < 2) throw new Error('flaky');
  return 'worked!';
}).then(console.log);
```

### A limit: N workers sharing one list

![Two workers take tasks from a shared list; as soon as one finishes, it starts the next](fig:pool-limit "At most 2 tasks run at once, but nothing sits idle — no waiting for a whole batch to finish.")

The idea: start `limit` "workers". Each worker loops: *take the next unstarted item, run it, repeat* until the list is empty. A shared counter (`next`) is the list cursor. Nothing runs in lock-step batches.

### Serialise: a queue made from a promise chain

Keep the tail of the chain in a variable; each new call attaches itself to the end. Calls then run strictly one after another, in order.

### Latest wins: ignore stale replies

![The slow request for "ca" answers after "cat"; latest-wins ignores the stale answer](fig:latest-wins "Responses can arrive in any order. Give every call a number; when a reply comes back, only the newest number may update the screen.")

### Cancellation

A promise can't be cancelled. The standard tool is an **`AbortController`**: you pass its `signal` to `fetch` (or your own function) and call `abort()`; the operation rejects with an `AbortError`, which you should treat as *expected*, not as a failure.

```js try
const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);                 // clean up!
      reject(new Error('aborted'));
    });
  });

const controller = new AbortController();
wait(1000, controller.signal).catch((e) => console.log('caught:', e.message));
setTimeout(() => controller.abort(), 100);
```

## Testing async code

Tests must `await` (or return) their promise. With fake timers, use `await jest.advanceTimersByTimeAsync(ms)` — the async version also lets pending microtasks (your `await` continuations) run, which the plain one won't.

## Common mistakes

1. **`await` in a row** for independent things (use `Promise.all`).
2. **`forEach(async …)`** — nobody waits for it.
3. **Forgetting `try/catch`** (or `.catch`) — unhandled rejections.
4. **Not checking `res.ok`** after `fetch`.
5. **Firing thousands of requests** at once instead of limiting concurrency.
6. **Forgetting cleanup** (timers, listeners) when you time out or abort.

## Quick check

```check
Q: What does calling an `async` function return?
A) The value it `return`s, immediately
B) `undefined`
C) A plain object with a `then` method only
D) A promise, always *
Why: Even `return 1` inside an `async` function gives you a promise that fulfils with `1`. A `throw` becomes a rejected promise.
---
Q: What is printed?
Code:
  async function f() {
    console.log(1);
    await null;
    console.log(2);
  }
  f();
  console.log(3);
A) 1 2 3
B) 1 3 2 *
C) 3 1 2
D) 1 2 then 3
Why: `f()` runs until `await`, then pauses. The caller prints 3. After that the paused function resumes and prints 2.
---
Q: You need three independent API results as fast as possible. Which is best?
A) `await Promise.all([getA(), getB(), getC()])` *
B) Three `await`s in a row
C) `forEach(async …)`
D) Three nested `try` blocks
Why: `Promise.all` starts all three at once, so the total time is the slowest one rather than the sum.
---
Q: Why is `items.forEach(async (x) => { await save(x); })` a bug?
A) `forEach` can't take arrow functions
B) `await` is not allowed inside callbacks
C) `forEach` ignores the returned promises, so nothing waits and errors go unnoticed *
D) It runs the items in the wrong order
Why: `forEach` calls your function and throws away whatever it returns (here, a promise). Use `for…of` with `await`, or `Promise.all(items.map(...))`.
---
Q: You must call an API for 5,000 ids. What is the safest approach?
A) `Promise.all(ids.map(call))`
B) A pool that keeps at most N calls in flight *
C) A `while(true)` loop
D) Call them all inside `forEach`
Why: Starting 5,000 requests at once risks rate limits and exhausted sockets. A concurrency limit keeps the load steady while still using parallelism.
```

## Recap

- **`async` functions return promises**; **`await`** pauses only that function and resumes as a microtask.
- Use **`try/catch/finally`** with `await`. Check **`res.ok`** — `fetch` doesn't reject on 404/500.
- **Independent work → `Promise.all`** (total = slowest). Dependent work → `await` in order.
- **`forEach(async …)` is a bug**; use `for…of` (sequential) or `Promise.all(map(...))` (parallel).
- Patterns: **retry** (backoff), **limit** (worker pool), **serialise** (promise chain), **latest wins** (ignore stale), **timeout + AbortController**.
- Promises can't be cancelled; `AbortController` is the standard signal. Clean up timers and listeners.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: load two numbers in parallel | "Sequential vs parallel" |
| Parallel loading with partial failures | `Promise.all` / `allSettled`, and keeping results in the order of the input |
| `retry` with backoff | The retry snippet: a loop, `try/catch`, and waiting `delay × factor^attempt` |
| Concurrency-limited `mapLimit` | "A limit: N workers sharing one list" |
| Serialise async calls | "Serialise": keep the tail of a promise chain |
| Latest wins | "Latest wins": number every call, compare when it settles |

%% exercise async-guided-total | Guided: load two numbers in parallel | 1 | js | js | loadTotal | 6 | guided
Write `async function loadTotal(getA, getB)`. `getA()` and `getB()` each return a promise of a number. Return the **sum** of the two numbers — but the two calls must start **at the same time**, not one after the other.

```js
await loadTotal(() => wait(100, 1), () => wait(100, 2)); // 3, after ~100ms (not ~200ms)
```

%% worked
**A similar problem, solved: `loadPair(getUser, getPosts)`** — returns `{ user, posts }`, loading both at once.

```js
async function loadPair(getUser, getPosts) {
  const userPromise = getUser();       // ① START the first call — don't await yet
  const postsPromise = getPosts();     // ② START the second call right away (both are now running)
  const [user, posts] = await Promise.all([userPromise, postsPromise]);   // ③ now wait for both together
  return { user, posts };              // ④ an async function returns a promise of this value
}
```

Compare with the slow version: `const user = await getUser(); const posts = await getPosts();` — the second call only *starts* after the first one is finished. Starting both **before** the first `await` is what makes it parallel.

%% explain
- **Returns the sum** of the two results, as a promise.
- **Both calls start immediately**: the test checks that, right after calling `loadTotal`, *both* `getA` and `getB` have already been called (an `await` in between would delay the second).
- **Errors propagate**: if either call rejects, `loadTotal` rejects.

%% nudge
- Which line starts a call, and which line waits for it? Can you separate them?
- What does `Promise.all` return for an array of two promises?

%% starter
```js
export async function loadTotal(getA, getB) {
  // Step 1 — START both calls right now, without awaiting:
  //          const pa = getA();
  //          const pb = getB();
  // Step 2 — wait for both together:   const [a, b] = await Promise.all([pa, pb]);
  // Step 3 — return a + b
}
```

%% tests
```js
const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

describe('loadTotal', () => {
  it('adds the two numbers', async () => {
    expect(await loadTotal(() => wait(5, 1), () => wait(5, 2))).toBe(3);
  });

  it('starts both calls before either finishes', () => {
    const calls = [];
    loadTotal(() => { calls.push('a'); return wait(20, 1); }, () => { calls.push('b'); return wait(20, 2); });
    expect(calls).toEqual(['a', 'b']);
  });

  it('returns a promise', () => {
    expect(loadTotal(() => wait(1, 1), () => wait(1, 1))).toBeInstanceOf(Promise);
  });

  it('rejects if one of the calls fails', async () => {
    const boom = new Error('nope');
    await expect(loadTotal(() => wait(5, 1), () => Promise.reject(boom))).rejects.toBe(boom);
  });
});
```

%% hints
- `const pa = getA(); const pb = getB();` — no `await` on these lines.
- `const [a, b] = await Promise.all([pa, pb]);`

%% solution
```js
export async function loadTotal(getA, getB) {
  const pa = getA();
  const pb = getB();
  const [a, b] = await Promise.all([pa, pb]);
  return a + b;
}
```

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

%% worked
**A similar problem, solved: `fetchAll(urls, get)`** — run every request in parallel, but survive individual failures.

```js
async function fetchAll(urls, get) {
  const results = await Promise.allSettled(urls.map((url) => get(url)));   // ① allSettled never rejects
  const ok = [];
  const failed = [];
  results.forEach((r, i) => {                                               // ② results are in the SAME order as urls
    if (r.status === 'fulfilled') ok.push(r.value);
    else failed.push(urls[i]);                                              // ③ use the index to know which one failed
  });
  return { ok, failed };
}
```

`urls.map(...)` starts every request immediately (they all run in parallel), and `Promise.allSettled` waits for *all* of them and reports each outcome instead of failing on the first. The exercise is the same with ids and `fetchUser`.

%% explain
- **Result shape**: `{ users: [...], failed: [...] }`.
- **Order**: successful users are in the same order as `ids`.
- **`failed`** lists the ids whose request rejected.
- **Parallel**: total time is about the slowest request, not the sum.
- **One failure never rejects the whole call.**

%% nudge
- Which `Promise` helper never rejects?
- How do you know *which id* a failed result belongs to?

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

%% worked
**A similar problem, solved: `pollUntil(check, tries, delayMs)`** — call `check()` until it returns something truthy, waiting between attempts, and give up after `tries`.

```js
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pollUntil(check, tries, delayMs) {
  for (let attempt = 0; attempt < tries; attempt++) {
    const value = await check(attempt);          // ① the attempt number is passed in (zero-based)
    if (value) return value;                     // ② success → stop
    if (attempt < tries - 1) await wait(delayMs);   // ③ don't wait after the LAST attempt
  }
  throw new Error('gave up');                    // ④ out of tries
}
```

`retry` is the same loop, but it **catches errors** instead of checking a value, waits `delay * factor ** attempt` (growing each time), remembers the **last error** to throw at the end, and calls `onRetry(error, nextAttempt)` just before each wait. Attempts are `retries + 1` in total (the first try plus the retries).

%% explain
- **`fn(attempt)`** is called with the zero-based attempt number.
- **Backoff**: the wait before retry *n* is `delay * factor ** n` (defaults `retries=3`, `delay=100`, `factor=2`), so up to `retries + 1` attempts.
- **Gives up** by rejecting with the **last** error; no wait after the final failure.
- **`onRetry(error, nextAttempt)`** runs before each wait.

%% nudge
- How many attempts are there if `retries = 3`?
- On the last failed attempt, should you wait before throwing?

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

%% worked
**A similar problem, solved: `runAll(tasks, limit)`** — runs task functions with at most `limit` active, results in order. It shows the shared-cursor worker pattern.

```js
async function runAll(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;                                        // ① the shared cursor: index of the next unstarted task

  async function worker() {
    while (next < tasks.length) {                      // ② keep going until the list is empty
      const i = next++;                                // ③ take a task (this line is synchronous, so no two workers get the same one)
      results[i] = await tasks[i]();                   // ④ run it; store the result at ITS index (keeps the input order)
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);   // ⑤ start `limit` workers
  await Promise.all(workers);                          // ⑥ wait until every worker is out of work
  return results;
}
```

Why it works: each worker immediately starts another task when its current one finishes, so there are never more than `limit` in flight and no idle gaps (unlike "process in batches of N").

Extras for `mapLimit`: pass `(item, index)` to `fn`; throw `RangeError` when `limit < 1`; and on the **first rejection** make every worker stop taking new items (e.g. set a `failed` flag the `while` condition checks — `Promise.all` rejects immediately but the other workers would otherwise keep starting tasks).

%% explain
- **At most `limit` calls in flight** at any moment (the test tracks the maximum).
- **Results are in input order**, whatever order they finish in.
- **No lock-step batches**: when one finishes, the next item starts immediately.
- **On a rejection**, `mapLimit` rejects and starts no further calls.
- **`limit < 1`** throws a `RangeError`; a limit larger than the list is fine.

%% nudge
- How can several workers share "the next item" without picking the same one?
- How do you store each result so the output order matches the input order?

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

%% worked
**A similar problem, solved: `queue()`** — a tiny helper that runs the functions you give it one after another.

```js
function queue() {
  let tail = Promise.resolve();                    // ① the end of the chain (starts already finished)
  return function add(task) {
    const result = tail.then(() => task());        // ② run my task AFTER the current end of the chain
    tail = result.catch(() => {});                 // ③ the NEW end: a promise that never rejects, so one failure doesn't break the queue
    return result;                                 // ④ but the caller still gets the real outcome (including errors)
  };
}
```

Why ③ matters: if `tail` could reject, every later `.then` would be skipped. So we chain the next call onto a *swallowed* version of the result, but give the caller the original. For `serialize(fn)`, each call does `tail.then(() => fn.apply(this, args))`. Watch out for using `this` inside an arrow function here: the wrapper must be a normal `function` so it can forward the caller's `this`.

%% explain
- **No overlap**: a call starts only after the previous one has settled, in call order.
- **Each call gets its own result** (or its own rejection).
- **A rejection doesn't block later calls.**
- **Arguments and `this` are forwarded.**

%% nudge
- What variable remembers "the end of the line"?
- If the previous call failed, should the next one still run? How do you make sure of that?

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

%% worked
**A similar problem, solved: `onlyLast(fn)`** — only the last call's value is delivered; earlier ones resolve to `undefined`.

```js
function onlyLast(fn) {
  let counter = 0;                           // ① how many calls so far
  return async function (...args) {
    const mine = ++counter;                  // ② take a ticket number for THIS call
    const value = await fn(...args);         // ③ the slow part — other calls may start meanwhile
    return mine === counter ? value : undefined;   // ④ am I still the newest ticket? deliver. Otherwise: stale.
  };
}
```

`latest` uses the same ticket idea, but returns `{ stale, value }` and must handle **rejections** too: a superseded call that rejects must still resolve `{ stale: true }` (the error is irrelevant now), while the newest call's rejection should propagate. Wrap the `await` in `try/catch`, compare the ticket in both paths.

%% explain
- **The newest call** resolves `{ stale: false, value }` (or rejects if `fn` rejects).
- **Any superseded call** resolves `{ stale: true }` when it settles — whether `fn` succeeded or failed.
- **"Newest" is decided when the call settles**, by whether a newer call has been made since.

%% nudge
- How can a call know, *after* it finishes, whether a newer call happened while it was waiting?
- What should a stale call that rejected return?

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
