---
id: promises
track: js
title: Promises, from the inside
summary: What a promise really is, how chaining and errors flow, what order things run in — and how to build one yourself.
---

## The idea in one sentence

A **promise** is an object that stands in for **a value that isn't ready yet** — and lets you say what to do *when* it is.

> **Analogy** You order a coffee and get a **buzzer**. The buzzer isn't coffee — it's a promise of coffee. You can keep doing other things. Later it either **buzzes: "ready!"** (the promise is *fulfilled*, and you collect your coffee) or **buzzes: "sorry, we ran out"** (the promise is *rejected*). Either way, it only buzzes **once**.

## Why promises exist

Some things take time: loading data from a server, reading a file, waiting for a timer. JavaScript can't freeze the whole page while it waits, so it gives you a way to say "call me back when you're done". The original way was a **callback**:

```js try
console.log('start');

setTimeout(() => {
  console.log('…one second later');
}, 1000);

console.log('end');
```

Notice the order: `start`, `end`, *then* the timer message. The code after `setTimeout` does **not** wait. That's what "asynchronous" means.

Callbacks work, but when step 2 depends on step 1 and step 3 on step 2, you end up nesting them deeper and deeper (the "pyramid of doom"), and handling errors in each layer is painful. Promises flatten that into a **chain**, and give every step a consistent way to succeed or fail.

## The three states

A promise is always in exactly one of three states:

![A promise starts pending, then becomes either fulfilled with a value or rejected with a reason, and never changes again](fig:promise-states "① Pending: still waiting. ② Fulfilled: it worked, and there is a value. ③ Rejected: it failed, and there is a reason (usually an Error). Once settled, it never changes again.")

- **Pending** — the result isn't ready yet.
- **Fulfilled** — it worked. The promise now holds a **value**.
- **Rejected** — it failed. The promise now holds a **reason** (normally an `Error`).

"**Settled**" just means "not pending any more" (fulfilled *or* rejected). A settled promise can never change again.

### Creating one

You rarely create promises by hand (most APIs, like `fetch`, hand you one), but it's the clearest way to see how they work:

```js try
const promise = new Promise((resolve, reject) => {
  // This function (the "executor") runs immediately.
  setTimeout(() => {
    resolve('coffee ☕');       // success → becomes fulfilled with this value
    // reject(new Error('out of beans'));   // failure → try swapping these two lines!
  }, 500);
});

promise.then((value) => {
  console.log('got:', value);
});
```

- `resolve(value)` = "it worked, here's the result".
- `reject(error)` = "it failed, here's why".
- Only the **first** call counts; later calls are ignored.

### Consuming one: `then`, `catch`, `finally`

```js try
function makeCoffee() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.5) resolve('coffee ☕');
      else reject(new Error('out of beans'));
    }, 300);
  });
}

makeCoffee()
  .then((drink) => console.log('Enjoy your', drink))   // runs if fulfilled
  .catch((err) => console.log('Sorry:', err.message))  // runs if rejected
  .finally(() => console.log('(order closed)'));        // runs either way
```

Run it a few times — it's random, so you'll see both outcomes.

## Chaining: the part that makes promises powerful

Here's the key fact: **every `.then(...)` returns a *new* promise.** Whatever your callback returns becomes the value of that new promise. That's what lets you line steps up:

```js
fetchUser(1)
  .then((user) => user.id)                 // returns a plain value
  .then((id) => fetchPosts(id))            // returns another PROMISE
  .then((posts) => render(posts))
  .catch((err) => showError(err));         // handles a failure from ANY step above
```

![A promise chain: fetchUser, then getPosts, then render, then catch; a failure anywhere skips to the catch](fig:promise-chain "Each `.then` hands its result to the next. If any step throws or rejects, the chain skips ahead to the nearest `.catch`.")

Step through it to see what each promise holds at each moment:

```stepper Following a promise chain
code:
  fetchUser(1)
    .then((user) => user.id)
    .then((id) => fetchPosts(id))
    .then((posts) => render(posts))
    .catch((err) => showError(err));
---
line: 1
say: `fetchUser(1)` starts the request and returns **promise #1**. It is *pending* — the answer isn't here yet.
Promise 1 (fetchUser): pending
Promise 2 (user.id):
Promise 3 (fetchPosts):
Promise 4 (render):
---
line: 1
say: The server replies. Promise #1 becomes **fulfilled** with the user object.
Promise 1 (fetchUser): fulfilled → { id: 1 }
---
line: 2
say: The first `.then` callback runs. It gets the user and returns a **plain number**, `1`. The promise returned by `.then` (#2) is fulfilled with `1`.
Promise 2 (user.id): fulfilled → 1
---
line: 3
say: The next callback runs with `1` and **returns a promise** (`fetchPosts(1)`). Promise #3 doesn't settle yet — it *waits for* and then copies the outcome of that returned promise.
Promise 3 (fetchPosts): pending (waiting)
---
line: 3
say: The posts arrive. The returned promise is fulfilled, so #3 becomes fulfilled with the posts.
Promise 3 (fetchPosts): fulfilled → [post, post]
---
line: 4
say: `render(posts)` runs. It returns nothing, so #4 is fulfilled with `undefined`.
Promise 4 (render): fulfilled → undefined
---
line: 5
say: Nothing went wrong, so the `.catch` callback is **skipped**. If any earlier step had failed, every `.then` in between would have been skipped and control would have jumped straight here.
```

### Four rules to remember

1. **Return inside `.then`** to pass something on. (The next most common bug is forgetting this — see below.)
2. If a callback **throws**, or returns a rejected promise, the chain **skips ahead** to the next `.catch`.
3. A `.catch` that **returns normally** "recovers": the chain carries on as fulfilled again.
4. `.finally(fn)` runs either way, ignores what `fn` returns, and passes the previous result straight through.

### Mistake: forgetting to `return`

```js try predict
function fetchPosts() {
  return new Promise((resolve) => setTimeout(() => resolve(['post 1', 'post 2']), 200));
}

Promise.resolve('start')
  .then(() => {
    fetchPosts();                 // ← no return!
  })
  .then((posts) => {
    console.log('next step got:', posts);
  });
```

The second `.then` gets `undefined` and runs **immediately** — it doesn't wait for `fetchPosts()`, because nothing told the chain to wait. Add the word `return` in front of `fetchPosts()` and run it again.

![A then callback that forgets to return hands undefined to the next step, which runs too early; returning the promise makes the chain wait](fig:forgot-return "Left: nothing is returned, so the next step runs immediately with `undefined`. Right: returning the promise makes the chain wait for it.")

## What order does everything run in?

Promise callbacks are **never** run straight away — not even on a promise that's already fulfilled. They're put in a special queue (the **microtask queue**) and run as soon as the current code has finished, but *before* any timers. Predict the order before you run this:

```js try predict
console.log('1: start');

setTimeout(() => console.log('4: timer'), 0);

Promise.resolve().then(() => console.log('3: promise'));

console.log('2: end');
```

Step through to see why:

```stepper Sync code, then promises, then timers
code:
  console.log('1: start');
  setTimeout(() => console.log('4: timer'), 0);
  Promise.resolve().then(() => console.log('3: promise'));
  console.log('2: end');
---
line: 1
say: Normal code runs top to bottom. This line prints right away.
Console: 1: start
Waiting timers:
Promise queue (microtasks):
---
line: 2
say: `setTimeout` doesn't run the callback now. It hands it to the browser's timer. Even with `0` ms, it has to wait its turn.
Waiting timers: timer callback
---
line: 3
say: The promise is already fulfilled, so its `.then` callback is placed in the **promise queue** (microtask queue) — *not* run yet.
Promise queue (microtasks): promise callback
---
line: 4
say: Still running normal code, so this prints right away.
Console: 1: start | 2: end
---
say: The script is finished. **Before** looking at timers, JavaScript empties the promise queue. The promise callback runs.
Console: 1: start | 2: end | 3: promise
Promise queue (microtasks):
---
say: Only now does JavaScript pick up the timer callback.
Console: 1: start | 2: end | 3: promise | 4: timer
Waiting timers:
```

> **Remember** Order is: **all normal code → all promise callbacks → then timers**. The event-loop lesson goes deeper, but this is enough for now.

## Running promises together

Sometimes you have several promises and want to combine them. JavaScript gives you four helpers:

![Three promises on a timeline and what Promise.all, allSettled, race and any each produce](fig:promise-combinators "A succeeds at 100ms, C fails at 200ms, B succeeds at 300ms. Each helper reacts differently.")

| | Fulfills when | Rejects when |
| --- | --- | --- |
| `Promise.all` | **all** succeeded (results in input order) | **first** failure |
| `Promise.allSettled` | always, with `{status, value/reason}` per input | never |
| `Promise.race` | the first to settle succeeds | the first to settle fails |
| `Promise.any` | the **first success** | *all* failed (`AggregateError`) |

```js try
const wait = (ms, value, fail = false) =>
  new Promise((resolve, reject) => setTimeout(() => (fail ? reject(new Error(value)) : resolve(value)), ms));

Promise.all([wait(100, 'A'), wait(300, 'B')])
  .then((results) => console.log('all →', results));

Promise.allSettled([wait(100, 'A'), wait(200, 'C', true)])
  .then((results) => console.log('allSettled →', results.map((r) => r.status)));

Promise.race([wait(300, 'slow'), wait(100, 'fast')])
  .then((winner) => console.log('race →', winner));
```

Two useful facts: anything that isn't a promise counts as "already fulfilled", and **nothing cancels a promise** — `Promise.all` failing doesn't stop the other tasks, it just stops *waiting* for them.

## More common mistakes

```js
// 1. No .catch → "Unhandled promise rejection"
save(data);                                  // ❌ if it fails, nobody is told
save(data).catch(reportError);               // ✅

// 2. Running things one-by-one that could run together
const a = await getA();
const b = await getB();                      // ❌ b didn't need a — it waited for nothing
const [a2, b2] = await Promise.all([getA(), getB()]);   // ✅ parallel

// 3. Wrapping a promise in a promise for no reason
new Promise((res) => getA().then(res));      // ❌ also swallows errors
getA();                                      // ✅ it is already a promise

// 4. then(ok, err) does not catch errors thrown in ok
p.then(ok, err);                             // ❌ a throw inside ok escapes
p.then(ok).catch(err);                       // ✅
```

## Quick check

```check
Q: Which statement about a promise is true?
A) It can switch between fulfilled and rejected many times
B) It runs its `.then` callbacks synchronously, before the next line
C) It is cancelled automatically when it takes too long
D) Once settled (fulfilled or rejected) it never changes *
Why: A promise settles **once**. `.then` callbacks are queued to run later, and nothing cancels a promise on its own.
---
Q: What does the second `.then` receive?
Code:
  Promise.resolve(1)
    .then((n) => { n + 1; })
    .then((x) => console.log(x));
A) 2
B) 1
C) undefined *
D) It throws an error
Why: The first callback uses braces but has no `return`, so it returns `undefined`. Write `(n) => n + 1` or `return n + 1`.
---
Q: What order does this print?
Code:
  console.log('A');
  setTimeout(() => console.log('B'), 0);
  Promise.resolve().then(() => console.log('C'));
  console.log('D');
A) A B C D
B) A D B C
C) A D C B *
D) A C D B
Why: Normal code first (A, D), then the promise queue (C), then timers (B).
---
Q: You have three independent requests and want all the results, and you want to fail fast if any fails. Which helper?
A) `Promise.all` *
B) `Promise.race`
C) `Promise.allSettled`
D) `Promise.any`
Why: `Promise.all` fulfills with every value in order and rejects at the first failure. `allSettled` never rejects, `race` only cares about the first to finish, and `any` only needs one success.
---
Q: A `.catch` callback returns a normal value. What state is the promise returned by `.catch` in?
A) Rejected
B) Fulfilled with that value *
C) Pending forever
D) It throws
Why: Handling an error "recovers" the chain: the promise after `.catch` is fulfilled with whatever the callback returned, and later `.then`s run.
```

## Recap

- A **promise** is a stand-in for a future value with three states: **pending → fulfilled** (value) or **rejected** (reason). It settles once.
- Use `.then` for success, `.catch` for failure, `.finally` for cleanup.
- Every `.then` returns a **new promise**; what your callback **returns** becomes its value (a returned promise is waited for).
- **Forget `return`** and the next step runs early with `undefined`.
- A throw/rejection **skips forward** to the nearest `.catch`; a `.catch` that returns normally recovers the chain.
- Callbacks run **after** the current code, from the **microtask queue**, before timers.
- `Promise.all` / `allSettled` / `race` / `any` combine several promises.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: chain two steps | "Chaining" and the `return` rule |
| `delay()` | "Creating one" — `new Promise` with `resolve` inside `setTimeout` |
| `promisify()` | "Creating one" + the callback `(err, result)` convention |
| `Promise.all` from scratch | "Running promises together" — a counter, a results array, and "first rejection wins" |
| `withTimeout()` | `race`-style thinking: two things compete, plus clearing the timer |
| Build a Promise | Everything: states, chaining, the microtask queue, `then` returns a new promise |

Every exercise has a **worked example**, a plain-English list of **what the tests check**, and a gentle **nudge** before the hints.

%% exercise promises-guided-chain | Guided: chain two steps | 1 | js | js | loadPostTitles | 8 | guided
Write `loadPostTitles(id, api)`. The `api` object has two functions that each return a promise:

- `api.fetchUser(id)` → a promise of `{ id, name }`
- `api.fetchPosts(userId)` → a promise of an array like `[{ title: 'Hello' }, { title: 'World' }]`

Your function should return a **promise of an array of titles**, e.g. `['Hello', 'World']` — fetching the user first, then their posts.

The skeleton is started for you — follow the numbered steps.

%% worked
**A similar problem, solved: `loadUserName(id, api)`** — fetch a user, then return a promise of just their upper-cased name.

```js
export function loadUserName(id, api) {
  return api.fetchUser(id)                  // ① start the chain; this is promise #1
    .then((user) => user.name)              // ② return a plain value → next promise is fulfilled with it
    .then((name) => name.toUpperCase());    // ③ each .then receives the previous result
}                                           // ④ we `return` the whole chain so the caller can wait
```

The exercise adds one twist: the *second* step has to call another async function. When a `.then` callback **returns a promise**, the chain waits for it:

```js
.then((user) => api.fetchPosts(user.id))    // returns a promise → the chain WAITS for it
```

If you forget the `return` in front of it (or use braces without `return`), the next step runs early with `undefined` — the exact mistake from the lesson.

%% explain
- **Returns a promise** — the function itself must not be `async`-less and return plain data; callers will `await` it.
- **Uses the user's id** — `fetchPosts` must be called with `user.id` (the tests check what it was called with).
- **Waits for the posts** — even when `fetchPosts` is slow, the final result must be the titles, not `undefined`.
- **Errors flow through** — if `fetchUser` rejects, your returned promise rejects with the same error (you don't need any extra code for that; a chain does it for free).

%% nudge
- Which step must wait for the other? What does `fetchPosts` need as input?
- Did you write the word `return` before `api.fetchPosts(...)`, and before the whole chain?

%% starter
```js
export function loadPostTitles(id, api) {
  // Step 1 — start with api.fetchUser(id). It returns a promise of a user object.

  // Step 2 — chain  .then((user) => ...)  and RETURN api.fetchPosts(user.id)

  // Step 3 — chain another  .then((posts) => ...)  that returns just the titles
  //          (posts.map(...) turns objects into their titles)

  // Step 4 — return the whole chain, so whoever calls loadPostTitles can wait for it.
}
```

%% tests
```js
const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));

describe('loadPostTitles', () => {
  it('returns the titles of the user\'s posts', async () => {
    const api = {
      fetchUser: (id) => wait(5, { id, name: 'Ada' }),
      fetchPosts: () => wait(5, [{ title: 'Hello' }, { title: 'World' }]),
    };
    expect(await loadPostTitles(1, api)).toEqual(['Hello', 'World']);
  });

  it('returns a promise', () => {
    const api = { fetchUser: () => wait(1, { id: 1 }), fetchPosts: () => wait(1, []) };
    expect(loadPostTitles(1, api)).toBeInstanceOf(Promise);
  });

  it('asks for posts using the user\'s id', async () => {
    const fetchPosts = jest.fn(() => wait(1, []));
    const api = { fetchUser: () => wait(1, { id: 42, name: 'Grace' }), fetchPosts };
    await loadPostTitles(7, api);
    expect(fetchPosts).toHaveBeenCalledWith(42);
  });

  it('waits for slow posts', async () => {
    const api = {
      fetchUser: () => Promise.resolve({ id: 1 }),
      fetchPosts: () => wait(30, [{ title: 'Late' }]),
    };
    expect(await loadPostTitles(1, api)).toEqual(['Late']);
  });

  it('passes errors through', async () => {
    const boom = new Error('network down');
    const api = { fetchUser: () => Promise.reject(boom), fetchPosts: () => Promise.resolve([]) };
    await expect(loadPostTitles(1, api)).rejects.toBe(boom);
  });
});
```

%% hints
- Start the chain with `return api.fetchUser(id)`.
- The second step: `.then((user) => api.fetchPosts(user.id))` — a promise returned from `.then` is waited for.
- The last step: `.then((posts) => posts.map((p) => p.title))`.

%% solution
```js
export function loadPostTitles(id, api) {
  return api
    .fetchUser(id)
    .then((user) => api.fetchPosts(user.id))
    .then((posts) => posts.map((p) => p.title));
}
```

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

%% worked
**A similar problem, solved: `rejectAfter(ms, message)`** — returns a promise that *rejects* with an `Error(message)` after `ms` milliseconds.

```js
function rejectAfter(ms, message) {
  return new Promise((resolve, reject) => {       // ① the executor gets two functions
    setTimeout(() => {                            // ② do the waiting with a timer
      reject(new Error(message));                 // ③ when the timer fires, settle the promise
    }, ms);
  });
}

rejectAfter(100, 'too slow').catch((e) => console.log(e.message));   // "too slow" after 100ms
```

The recipe for wrapping anything callback-based in a promise: **(1)** `return new Promise((resolve, reject) => { … })`, **(2)** start the slow thing inside, **(3)** call `resolve(value)` when it succeeds or `reject(error)` when it fails. `delay` is the same recipe, but it calls `resolve(value)` instead.

%% explain
- **Returns a promise** (an instance of `Promise`).
- **Doesn't resolve early** — nothing happens at `ms - 1`; it resolves at `ms`. (Tests use fake timers to jump the clock.)
- **Resolves with the given `value`**, or `undefined` if you don't pass one.
- **Works with `0` ms** (still asynchronous).

%% nudge
- Which of `resolve` / `reject` should run when the timer fires, and with what?
- Where does the `setTimeout` go — inside the function you give to `new Promise`, or outside it?

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

%% worked
**A similar problem, solved by hand: wrapping one specific callback API.** Suppose `readFake(name, callback)` calls `callback(err, text)`:

```js
function readFakePromise(name) {
  return new Promise((resolve, reject) => {
    readFake(name, (err, text) => {      // ① give it OUR callback
      if (err) reject(err);              // ② error first → reject
      else resolve(text);                // ③ otherwise resolve with the result
    });
  });
}
```

`promisify(fn)` is this **generalised**: instead of a fixed `readFake`, it returns a function that takes *any* arguments, and adds the callback as the **last** one:

```js
function promisify(fn) {
  return function (...args) {            // ...args collects whatever the caller passed
    return new Promise((resolve, reject) => {
      fn.call(this, ...args, (err, value) => { /* same two lines as above */ });
    });
  };
}
```

Things the exercise asks that the sketch above doesn't yet do: `this` forwarding (notice `fn.call(this, …)`), and **what if `fn` throws right away**? An error thrown inside the `new Promise` executor automatically rejects the promise — check whether your code gets that for free.

%% explain
- **Resolves with the callback's second argument**; **rejects with `err`** when it's truthy.
- **`this` and all arguments are forwarded** to `fn` (the callback is added last).
- **A synchronous throw in `fn`** becomes a rejection — no exception escapes.
- **Extra callback arguments are ignored** (`cb(null, a, b)` → resolve with `a`).

%% nudge
- What are the two parameters of the callback you pass to `fn`, and what does each one mean?
- Does an error thrown *inside* a `new Promise(executor)` escape, or become a rejection?

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

%% worked
**A similar problem, solved: `bothOf(a, b)`** — waits for exactly two promises and resolves with `[resultA, resultB]`. The trick is the same as `promiseAll`: **a results array, a counter, and a "done" check**.

```js
function bothOf(a, b) {
  return new Promise((resolve, reject) => {
    const results = [];                      // ① store each result at ITS OWN index
    let remaining = 2;                       // ② how many are still pending

    [a, b].forEach((item, i) => {
      Promise.resolve(item).then(            // ③ Promise.resolve turns plain values into promises
        (value) => {
          results[i] = value;                //    index i keeps the order — not the finish order!
          remaining -= 1;
          if (remaining === 0) resolve(results);   // ④ the last one to finish resolves
        },
        reject,                              // ⑤ any rejection rejects everything (first wins, later calls are ignored)
      );
    });
  });
}
```

Generalising to any iterable: turn it into an array first (`Array.from(iterable)`), use `items.length` instead of `2`, and handle the **empty** case — with nothing to wait for, no callback would ever fire, so resolve `[]` straight away. For `promiseAllSettled`, the two callbacks both *record* an outcome object (`{ status, value }` or `{ status, reason }`) instead of rejecting.

%% explain
- **Order**: results follow the *input* order, even when later items finish first.
- **Plain values** in the input count as already-fulfilled.
- **First rejection wins** for `promiseAll`; later results/rejections are ignored.
- **Empty input** → fulfills with `[]`.
- **`promiseAllSettled`** gives `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }` for every item, in order, and never rejects.
- **No cheating**: the tests check you didn't call the native `Promise.all` / `allSettled` / `race` / `any`.

%% nudge
- If three promises finish in the order 3, 1, 2, where in the results array should each one land?
- How do you know when *all* of them are done? (A counter that goes down — or up — by one each time.)
- What if the input is empty? Would any callback ever run?

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

%% worked
**A similar problem, solved: `firstOf(a, b)`** — settles with whichever of two promises settles first. It's the same "two things compete" shape as `withTimeout` (the second competitor there is a timer).

```js
function firstOf(a, b) {
  return new Promise((resolve, reject) => {
    a.then(resolve, reject);     // ① wire each competitor to the SAME resolve/reject
    b.then(resolve, reject);     // ② whoever calls first wins; the second call is ignored
  });
}
```

For `withTimeout(promise, ms)`, one competitor is `promise` and the other is a timer that rejects with a `TimeoutError`. Two extra things to get right:

```js
const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);   // keep the id...
// ...and when the real promise settles (either way), call clearTimeout(timer) so nothing dangles.
```

And a `class TimeoutError extends Error` needs `this.name = 'TimeoutError'` in its constructor (otherwise `name` is just `"Error"`).

%% explain
- **Passes through** the original result or error if it settles in time.
- **Rejects with `TimeoutError`** (message `Timed out after <ms>ms`, `name === 'TimeoutError'`) when it's too slow.
- **Cleans up** — once settled either way the timer is cleared (tests check no timers are left pending).
- **No unhandled rejection** if the original promise fails *after* the timeout already won.

%% nudge
- Which code path must call `clearTimeout`? (Think: what are all the ways this can finish?)
- If the timeout already rejected and the original rejects later, who is listening to that second rejection?

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

%% worked
**How to approach a big one: build it in milestones, running the tests after each.**

**Milestone 1 — state and `resolve`/`reject`.** A promise is: a `state` (`'pending'`, `'fulfilled'`, `'rejected'`), a `value`, and a list of callbacks waiting for it.

```js
class MyPromise {
  constructor(executor) {
    this.state = 'pending';
    this.value = undefined;
    this.callbacks = [];                              // handlers waiting for the result
    const settle = (state, value) => {
      if (this.state !== 'pending') return;           // only the FIRST call counts
      this.state = state;
      this.value = value;
      this.callbacks.forEach((cb) => cb());           // wake everyone who was waiting
    };
    try { executor((v) => settle('fulfilled', v), (e) => settle('rejected', e)); }
    catch (e) { settle('rejected', e); }              // a throw in the executor rejects
  }
}
```

**Milestone 2 — `then` returns a new promise and runs handlers in a microtask.**

```js
then(onFulfilled, onRejected) {
  return new MyPromise((resolve, reject) => {
    const run = () => queueMicrotask(() => {           // always async, even if already settled
      const handler = this.state === 'fulfilled' ? onFulfilled : onRejected;
      if (typeof handler !== 'function') {             // no handler: pass the outcome straight through
        return this.state === 'fulfilled' ? resolve(this.value) : reject(this.value);
      }
      try { resolve(handler(this.value)); } catch (e) { reject(e); }
    });
    if (this.state === 'pending') this.callbacks.push(run); else run();
  });
}
```

**Milestone 3 — adopting thenables.** `resolve(x)` must check: is `x` the promise itself (→ `TypeError`)? Does `x` have a `then` function (→ call it with `resolve`/`reject` and follow it)? Otherwise fulfill with `x`. **Milestone 4 —** `catch`, `finally`, `MyPromise.resolve/reject`: each is a few lines on top of `then`.

Notice that milestone 1 above still has a gap: its `settle` fulfills with *any* value, even a promise. Fixing that is milestone 3.

%% explain
- **Executor runs synchronously**; only the first `resolve`/`reject` counts; a throw rejects.
- **`then` returns a new `MyPromise`**; handlers run **asynchronously** (microtask), at most once, in the order registered.
- **Pass-through**: missing/non-function handlers forward the value or reason.
- **Returned thenables are adopted** (promise or any `{ then }` object); a throw in a handler rejects the next promise.
- **Self-resolution** (`p.then(() => p)`) rejects with a `TypeError`.
- **`catch`, `finally`, `MyPromise.resolve/reject`** behave like the native ones.
- **Interop**: native `await` works on your instances because they're thenables.

%% nudge
- Start with milestone 1 and only move on when its tests pass — the tests are ordered roughly the same way.
- If a handler is registered *before* the promise settles, where do you keep it until later?
- Why must handlers run in a microtask even if the promise is already settled?

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
