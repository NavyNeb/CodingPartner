---
id: test-async-time
track: test
title: Async code & time
summary: Testing promises without forgetting to await, controlling the clock with fake timers, injecting sleep so retries never really wait, and writing tests for debounce and retry that catch subtle timing bugs.
---

## The idea in one sentence

Async code finishes **later**, so a test must either **wait for it properly** or **control time itself** — never guess with real delays.

> **Analogy** Testing a kitchen timer. You don't stand there for ten minutes; you turn the dial forward yourself and check that it rings. **Fake timers** are the dial you control.

## Testing promises

A test can be an `async` function. Use `await`, and use the `resolves` and `rejects` matchers to say what the promise should do.

![Forgetting await](fig:tst-forgot-await "Without await the test ends first, passes, and the failure is silently lost.")

```js
it('loads the user', async () => {
  await expect(loadUser(1)).resolves.toEqual({ id: 1 });
});
it('fails for an unknown user', async () => {
  await expect(loadUser(99)).rejects.toThrow('not found');
});
```

```js try predict
async function load(id) {
  if (id !== 1) throw new Error('not found');
  return { id };
}
// "await" is what makes the failure visible
load(2).then(
  (v) => console.log('resolved', v),
  (e) => console.log('rejected:', e.message),
);
```

## Controlling time

Code with `setTimeout`, `setInterval` or `Date.now()` is slow and flaky to test for real. With **fake timers** the test owns the clock.

![Real versus fake clock](fig:tst-fake-clock "advanceTimersByTime jumps the pretend clock forward and fires what is due.")

```js
jest.useFakeTimers();
const fn = jest.fn();
setTimeout(fn, 1000);
jest.advanceTimersByTime(999);   // not yet
expect(fn).not.toHaveBeenCalled();
jest.advanceTimersByTime(1);     // now
expect(fn).toHaveBeenCalledTimes(1);
```

Always test **both sides of the boundary**: just before (`999`) and exactly at (`1000`). When promises are involved, use `await jest.advanceTimersByTimeAsync(ms)`, which also lets pending promise callbacks run.

```js try
let now = 0;
const timers = [];
const fakeSetTimeout = (fn, ms) => timers.push({ at: now + ms, fn });
const advance = (ms) => {
  now += ms;
  timers.filter((t) => t.at <= now && !t.done).forEach((t) => { t.done = true; t.fn(); });
};
fakeSetTimeout(() => console.log('rang at', now), 1000);
advance(999);
console.log('after 999: nothing yet');
advance(1);
```

That is the whole trick: a list of "things due at time T" and a number you move yourself.

## Inject the waiting

Sometimes the cleanest approach is to **pass the waiting in**, the same seam as for any collaborator. A `retry` that receives a `sleep` function can be tested with a spy that returns immediately.

![Retry with backoff](fig:tst-retry "The test checks the waits 100 and 200 by reading the spy's calls, without waiting at all.")

```stepper A retry with injected sleep
code:
  async function retry(fn, { attempts, sleep }) {
    let lastError;
    for (let i = 0; i < attempts; i++) {
      try { return await fn(); }
      catch (e) { lastError = e; if (i < attempts - 1) await sleep(100 * 2 ** i); }
    }
    throw lastError;
  }
---
line: 3
say: Try up to `attempts` times. `i` is the **attempt number** starting at zero.
attempt: 0
---
line: 4
say: If the call works, **return its value** straight away. No sleeping when nothing went wrong.
result: ok
---
line: 5
say: On failure, **remember the error**. Wait only if there is **another attempt** coming (`i < attempts - 1`), and double the wait each time: 100, 200, 400…
sleep calls: 100, then 200
---
line: 7
say: Out of attempts: throw the **last** error. A version that swallowed it, or threw the first one, would give callers the wrong picture.
result: throws "fail 3"
```

## Debounce: waiting for quiet

A **debounced** function runs only after calls have **stopped** for `ms`. Each call restarts the timer.

![Debounce timeline](fig:tst-debounce "Two calls 60 ms apart: nothing runs at 100, one run at 160 with the last arguments.")

A good test of it checks: **not before** the wait, **once after**, **last arguments win**, the **timer resets** on a new call, and `cancel()` stops it. Each assertion kills a different bug.

## Quick check

```check
Q: Why does `it('x', () => { expect(p).resolves.toBe(1); })` prove little?
A) resolves doesn't exist
B) The promise is not awaited, so the test can end and pass before the promise settles *
C) toBe is wrong for promises
D) It runs twice
Why: Without `await` (or returning the promise) the assertion's outcome is never seen by the test.
---
Q: What do fake timers let a test do?
A) Make real time pass faster for everyone
B) Control when timers fire, so the test is instant and deterministic *
C) Skip assertions
D) Remove the need for async functions
Why: The test advances a pretend clock and the harness fires what is due.
---
Q: Which pair of checks best tests a `setTimeout(fn, 1000)` boundary?
A) Only after 5000 ms
B) Not called at 999 ms, called once at 1000 ms *
C) Called at 0 ms
D) Never advance the clock
Why: Testing just before and exactly at the boundary catches off-by-one timing bugs.
---
Q: Why inject `sleep` into `retry`?
A) Because sleep is a keyword
B) So a test can pass a spy that returns at once and also read how long it would have waited *
C) To make production slower
D) It is required by Jest
Why: An injected sleep is a seam: no real waiting, and the delays become assertable values.
---
Q: A debounce implementation that does not restart the timer on a second call is caught by...
A) Checking the function name
B) Calling twice 60 ms apart and checking it has not fired at 100 ms *
C) Calling it once
D) Checking cancel
Why: Only a burst test shows that each call must reset the countdown.
```

## Recap

- **Await** promises in tests; use `resolves` and `rejects`.
- **Fake timers** give you the clock: `useFakeTimers`, `advanceTimersByTime`, and the `Async` variant when promises are involved.
- Test **both sides of a timing boundary**.
- **Inject** `sleep` or the clock so nothing really waits.
- For debounce and retry, check **timing, count, arguments and failure** separately.
- In "write the tests" exercises you will drive fake timers and spies yourself.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a delayed value | `new Promise` with `setTimeout` |
| Build a retry | `try/catch` in a loop, injected `sleep`, backoff `100 * 2 ** i` |
| Tests for a retry | `jest.fn` spies, async `check`, `sleep.mock.calls` |
| Build a debounce | `setTimeout`, `clearTimeout`, rest arguments |
| Tests for a debounce | `jest.useFakeTimers()`, `advanceTimersByTime`, the boundary |

%% exercise tst-guided-delayed | Guided: a delayed value | 1 | js | js | delayed | 8 | guided
Implement `delayed(value, ms)`: it returns a promise that **resolves with `value` after `ms` milliseconds**.

```js
await delayed('hi', 100); // 'hi', about 100 ms later
```

%% worked
**A similar problem, solved: `fail(message, ms)`** — a promise that **rejects** after a delay.

```js
function fail(message, ms) {
  return new Promise((resolve, reject) => {     // ① the promise gives you resolve and reject
    setTimeout(() => reject(new Error(message)), ms);   // ② settle it later, from a timer
  });
}
```

Because the code uses the global `setTimeout`, a test can call `jest.useFakeTimers()` and move the clock itself.

%% explain
- **Returns a promise** immediately.
- **Resolves with `value`** once `ms` have passed, not before.

%% nudge
- Which constructor creates a promise you settle yourself?
- Who calls `resolve`, and when?

%% starter
```js
export function delayed(value, ms) {
  // Step 1 — return new Promise((resolve) => { ... });
  // Step 2 — inside, setTimeout(() => resolve(value), ms);
}
```

%% tests
```js
describe('delayed', () => {
  it('does not resolve before the delay', async () => {
    jest.useFakeTimers();
    let done = false;
    delayed('x', 100).then(() => { done = true; });
    await jest.advanceTimersByTimeAsync(99);
    expect(done).toBe(false);
  });

  it('resolves with the value at the delay', async () => {
    jest.useFakeTimers();
    const p = delayed('x', 100);
    await jest.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBe('x');
  });

  it('works with other values', async () => {
    jest.useFakeTimers();
    const p = delayed({ a: 1 }, 5);
    await jest.advanceTimersByTimeAsync(5);
    await expect(p).resolves.toEqual({ a: 1 });
  });
});
```

%% hints
- `return new Promise((resolve) => { setTimeout(() => resolve(value), ms); });`

%% solution
```js
export function delayed(value, ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}
```

%% exercise tst-retry | Build a retry | 3 | js | js | retry | 20
Implement `async retry(fn, { attempts = 3, sleep, baseMs = 100 })`.

- Call `fn()`; if it resolves, **return its value** immediately (no sleeping).
- If it rejects, wait `await sleep(baseMs * 2 ** i)` before the next attempt, where `i` is the zero-based number of the attempt that just failed.
- Do **not** sleep after the **last** failed attempt.
- After `attempts` failures, **throw the last error**.

```js
await retry(fn, { attempts: 3, sleep }); // waits 100, then 200 between tries
```

%% worked
**A similar problem, solved: `pollUntil(check, { tries, sleep })`** — repeat a check with an injected wait.

```js
async function pollUntil(check, { tries, sleep }) {
  for (let i = 0; i < tries; i++) {
    if (await check()) return true;                 // ① stop at the first success
    if (i < tries - 1) await sleep(50);             // ② no pointless wait after the last try
  }
  return false;
}
```

Same skeleton: a loop, an early return on success, an injected `sleep` guarded so it isn't called after the final attempt.

%% explain
- **Loop `attempts` times**, returning the first success.
- **Sleep `baseMs * 2 ** i`** between failures only.
- **Remember the last error** and throw it at the end.

%% nudge
- Where do you store the error so you can throw it after the loop?
- Which condition stops the sleep after the last attempt?

%% starter
```js
export async function retry(fn, { attempts = 3, sleep, baseMs = 100 } = {}) {
  // your code
}
```

%% tests
```js
const flaky = (failures) => {
  let n = 0;
  return jest.fn(async () => { n++; if (n <= failures) throw new Error('fail ' + n); return 'ok'; });
};
const instant = () => jest.fn(async () => {});

describe('retry', () => {
  it('returns at once on success, with no sleeping', async () => {
    const fn = flaky(0), sleep = instant();
    await expect(retry(fn, { attempts: 3, sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries and backs off', async () => {
    const fn = flaky(2), sleep = instant();
    await expect(retry(fn, { attempts: 3, sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it('throws the last error after the last attempt, without a final sleep', async () => {
    const fn = flaky(99), sleep = instant();
    await expect(retry(fn, { attempts: 3, sleep })).rejects.toThrow('fail 3');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('honours attempts and baseMs', async () => {
    const fn = flaky(99), sleep = instant();
    await expect(retry(fn, { attempts: 4, sleep, baseMs: 10 })).rejects.toThrow('fail 4');
    expect(sleep.mock.calls).toEqual([[10], [20], [40]]);
  });

  it('with one attempt does not retry or sleep', async () => {
    const fn = flaky(99), sleep = instant();
    await expect(retry(fn, { attempts: 1, sleep })).rejects.toThrow('fail 1');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
```

%% hints
- `let lastError; for (let i = 0; i < attempts; i++) { try { return await fn(); } catch (e) { lastError = e; } ... }`
- Inside the catch: `if (i < attempts - 1) await sleep(baseMs * 2 ** i);`
- After the loop: `throw lastError;`

%% solution
```js
export async function retry(fn, { attempts = 3, sleep, baseMs = 100 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts - 1) await sleep(baseMs * 2 ** i);
    }
  }
  throw lastError;
}
```

%% exercise tst-check-retry | Tests for a retry | 4 | js | js | checkRetry | 28
The `retry(fn, { attempts, sleep })` from the previous exercise waits `100 * 2 ** i` between failures (no wait after the last) and throws the **last** error. Write an **async** `checkRetry(retry)` that passes for a correct retry and **fails** for: **never retries**, **tries one time too many**, **does not wait between attempts**, **waits the same time every attempt**, **swallows the final error**, **waits after the last failure**, **throws the first error instead of the last**.

```js
const sleep = jest.fn(async () => {});
await retry(fn, { attempts: 3, sleep });
```

%% worked
**A similar problem, solved: `checkPoll(pollUntil)`** — an async check with a flaky function and a spy sleep.

```js
export async function checkPoll(pollUntil) {
  let n = 0;
  const check = jest.fn(async () => ++n >= 3);           // ① false, false, true
  const sleep = jest.fn(async () => {});                 // ② instant
  expect(await pollUntil(check, { tries: 5, sleep })).toBe(true);
  expect(check).toHaveBeenCalledTimes(3);                // ③ stops at the first success
  expect(sleep).toHaveBeenCalledTimes(2);                // ④ slept between, not after
}
```

Make the helper `async`, **await** the code under test, and assert on **counts and arguments** of the spies. To check that an error is thrown, `try/catch` it (or use `await expect(...).rejects`).

%% explain
- **A flaky function** that fails a set number of times, as a spy.
- **Return values and call counts** for success and for exhaustion.
- **`sleep.mock.calls`** equals `[[100], [200]]` exactly.
- **The error message** is the **last** one.

%% nudge
- Which assertion tells "wait 100, 200" from "wait 100, 100"?
- How do you check the total number of calls when it always fails?

%% starter
```js
export async function checkRetry(retry) {
  let n = 0;
  const fn = jest.fn(async () => { n++; if (n < 3) throw new Error('fail ' + n); return 'ok'; });
  const sleep = jest.fn(async () => {});
  expect(await retry(fn, { attempts: 3, sleep })).toBe('ok');
  // your assertions: counts, the waits, and a case that always fails
}
```

%% tests
```js
const make = ({ extra = 0, noRetry = false, wait = true, backoff = true, swallow = false, lastWait = false, firstError = false } = {}) =>
  async (fn, { attempts = 3, sleep } = {}) => {
    const total = noRetry ? 1 : attempts + extra;
    let first, last;
    for (let i = 0; i < total; i++) {
      try { return await fn(); } catch (e) {
        if (i === 0) first = e;
        last = e;
        if (wait && (i < total - 1 || lastWait)) await sleep(backoff ? 100 * 2 ** i : 100);
      }
    }
    if (swallow) return undefined;
    throw firstError ? first : last;
  };
const correct = make();
const mutants = {
  'never retries': make({ noRetry: true }),
  'tries one time too many': make({ extra: 1 }),
  'does not wait between attempts': make({ wait: false }),
  'waits the same time every attempt': make({ backoff: false }),
  'swallows the final error': make({ swallow: true }),
  'waits after the last failure': make({ lastWait: true }),
  'throws the first error instead of the last': make({ firstError: true }),
};

describe('your checkRetry', () => {
  it('passes on a correct retry', async () => {
    await checkRetry(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a retry that ${name}`, async () => {
      let caught = false;
      try { await checkRetry(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Build a helper `flaky(k)` that fails `k` times then returns `'ok'`, as `jest.fn`.
- With `flaky(2)` and 3 attempts: `expect(sleep.mock.calls).toEqual([[100], [200]])`.
- With `flaky(99)`: catch the error, `expect(err.message).toBe('fail 3')`, `fn` called 3 times, `sleep` called 2 times.

%% solution
```js
export async function checkRetry(retry) {
  const flaky = (k) => {
    let n = 0;
    return jest.fn(async () => { n++; if (n <= k) throw new Error('fail ' + n); return 'ok'; });
  };

  const f0 = flaky(0);
  const s0 = jest.fn(async () => {});
  expect(await retry(f0, { attempts: 3, sleep: s0 })).toBe('ok');
  expect(f0).toHaveBeenCalledTimes(1);
  expect(s0).not.toHaveBeenCalled();

  const f2 = flaky(2);
  const s2 = jest.fn(async () => {});
  expect(await retry(f2, { attempts: 3, sleep: s2 })).toBe('ok');
  expect(f2).toHaveBeenCalledTimes(3);
  expect(s2.mock.calls).toEqual([[100], [200]]);

  const fx = flaky(99);
  const sx = jest.fn(async () => {});
  let error;
  try { await retry(fx, { attempts: 3, sleep: sx }); } catch (e) { error = e; }
  expect(error).toBeDefined();
  expect(error.message).toBe('fail 3');
  expect(fx).toHaveBeenCalledTimes(3);
  expect(sx).toHaveBeenCalledTimes(2);
}
```

%% exercise tst-debounce | Build a debounce | 3 | js | js | debounce | 16
Implement `debounce(fn, ms)`. It returns a function `debounced(...args)` that calls `fn(...args)` **once, `ms` after the most recent call**. Each new call **restarts** the countdown and replaces the arguments (the **last** call wins). `debounced.cancel()` drops any pending call.

```js
const save = debounce(write, 300);
save('a'); save('b'); // write('b') runs once, 300 ms after the second call
```

%% worked
**A similar problem, solved: `delayOnce(fn, ms)`** — a `setTimeout` kept in a variable so it can be cleared.

```js
function delayOnce(fn, ms) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);                          // ① cancel whatever was pending
    timer = setTimeout(() => fn(...args), ms);    // ② schedule again with these arguments
  };
}
```

That is almost a debounce already; add a `cancel` method that clears the timer.

%% explain
- **Keep the timer id** in a closure variable.
- **Every call** clears the old timer and starts a new one with the new arguments.
- **`cancel()`** clears the timer.

%% nudge
- What must happen to the pending timer when a new call arrives?
- Where do you remember the timer between calls?

%% starter
```js
export function debounce(fn, ms) {
  function debounced(...args) {
    // your code
  }
  debounced.cancel = () => {
    // your code
  };
  return debounced;
}
```

%% tests
```js
describe('debounce', () => {
  it('does not call before the wait, calls once after', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('a');
    jest.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('restarts the timer on every call and uses the last arguments', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('b');
    jest.advanceTimersByTime(60);
    d('c');
    jest.advanceTimersByTime(60);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(40);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('runs again for a later burst', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const d = debounce(fn, 50);
    d(1); jest.advanceTimersByTime(50);
    d(2); jest.advanceTimersByTime(50);
    expect(fn.mock.calls).toEqual([[1], [2]]);
  });

  it('passes several arguments', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    debounce(fn, 10)('x', 'y');
    jest.advanceTimersByTime(10);
    expect(fn).toHaveBeenCalledWith('x', 'y');
  });

  it('cancel drops the pending call', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('x');
    d.cancel();
    jest.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});
```

%% hints
- `let timer = null;` outside `debounced`.
- In `debounced`: `clearTimeout(timer); timer = setTimeout(() => fn(...args), ms);`
- `cancel`: `clearTimeout(timer); timer = null;`

%% solution
```js
export function debounce(fn, ms) {
  let timer = null;
  function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }
  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  return debounced;
}
```

%% exercise tst-check-debounce | Tests for a debounce | 4 | js | js | checkDebounce | 28
`debounce(fn, ms)` returns a function that calls `fn` once, `ms` after the **last** call, with the **last** arguments; every call restarts the timer; `.cancel()` drops a pending call. Write `checkDebounce(debounce)` using **fake timers** so it passes for a correct debounce and **fails** for: **calls immediately**, **does not restart the timer**, **uses the first arguments**, **fires too early**, **fires too late**, **calls twice**, **ignores cancel**, **drops the arguments**.

```js
jest.useFakeTimers();
const d = debounce(jest.fn(), 100);
```

%% worked
**A similar problem, solved: `checkDelayOnce(delayOnce)`** — fake timers and a boundary check.

```js
export function checkDelayOnce(delayOnce) {
  jest.useFakeTimers();                               // ① take control of time
  const fn = jest.fn();
  delayOnce(fn, 100)('a');
  jest.advanceTimersByTime(99);
  expect(fn).not.toHaveBeenCalled();                  // ② just before the boundary
  jest.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);                // ③ exactly at the boundary
  expect(fn).toHaveBeenCalledWith('a');               // ④ with the right arguments
}
```

Fake timers are cleaned up for you after each run. Think of **a burst** (two calls close together) as its own scenario: it is the only way to catch a timer that is not restarted.

%% explain
- **`jest.useFakeTimers()`** then `advanceTimersByTime`.
- **Boundary**: not called at `ms - 1`, called once at `ms`, with the arguments.
- **Burst**: a second call before the wait ends pushes the call back and the last arguments win.
- **Cancel**: nothing happens after `cancel()`.

%% nudge
- Which scenario separates "restarts the timer" from "keeps the first timer"?
- Which scenario catches a call that happens too late? Too early?

%% starter
```js
export function checkDebounce(debounce) {
  jest.useFakeTimers();
  const fn = jest.fn();
  const d = debounce(fn, 100);
  d('a');
  jest.advanceTimersByTime(100);
  expect(fn).toHaveBeenCalledTimes(1);
  // your assertions: just before the boundary, a burst, last arguments, cancel
}
```

%% tests
```js
const make = ({ leading = false, restart = true, firstArgs = false, early = 0, twice = false, cancels = true, noArgs = false } = {}) => (fn, ms) => {
  let timer = null, first;
  function debounced(...args) {
    if (leading) fn(...args);
    if (!restart && timer !== null) return;
    if (!restart) first = args;
    clearTimeout(timer);
    const use = firstArgs && first ? first : args;
    if (firstArgs && !first) first = args;
    timer = setTimeout(() => {
      timer = null; first = undefined;
      const a = noArgs ? [] : use;
      fn(...a);
      if (twice) fn(...a);
    }, ms + early);
  }
  debounced.cancel = () => { if (cancels) { clearTimeout(timer); timer = null; } };
  return debounced;
};
const correct = make();
const mutants = {
  'calls immediately': make({ leading: true }),
  'does not restart the timer': make({ restart: false }),
  'uses the first arguments': make({ firstArgs: true }),
  'fires too early': make({ early: -10 }),
  'fires too late': make({ early: 10 }),
  'calls twice': make({ twice: true }),
  'ignores cancel': make({ cancels: false }),
  'drops the arguments': make({ noArgs: true }),
};

describe('your checkDebounce', () => {
  it('passes on a correct debounce', () => {
    expect(() => checkDebounce(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a debounce that ${name}`, () => {
      expect(() => checkDebounce(impl)).toThrow();
    });
  }
});
```

%% hints
- Boundary: `d('a'); advance(99); expect(fn).not.toHaveBeenCalled(); advance(1); expect(fn).toHaveBeenCalledTimes(1); expect(fn).toHaveBeenCalledWith('a');`
- Burst: `d('b'); advance(60); d('c'); advance(60); expect(fn).toHaveBeenCalledTimes(1);` (still only the earlier call) then `advance(40)` and check the last call used `'c'`.
- Cancel: `d('x'); d.cancel(); advance(500); expect(fn).toHaveBeenCalledTimes(2);`

%% solution
```js
export function checkDebounce(debounce) {
  jest.useFakeTimers();
  const fn = jest.fn();
  const d = debounce(fn, 100);

  d('a');
  jest.advanceTimersByTime(99);
  expect(fn).not.toHaveBeenCalled();
  jest.advanceTimersByTime(1);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(fn).toHaveBeenCalledWith('a');

  d('b');
  jest.advanceTimersByTime(60);
  d('c');
  jest.advanceTimersByTime(60);
  expect(fn).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(40);
  expect(fn).toHaveBeenCalledTimes(2);
  expect(fn).toHaveBeenLastCalledWith('c');

  d('x');
  d.cancel();
  jest.advanceTimersByTime(500);
  expect(fn).toHaveBeenCalledTimes(2);
}
```
