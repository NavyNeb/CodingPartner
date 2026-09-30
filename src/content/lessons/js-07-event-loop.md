---
id: event-loop
track: js
title: The event loop, timers & rate limiting
summary: Why code runs in a surprising order, how to predict it, and how to build debounce, throttle and a request de-duplicator on top of that knowledge.
---

## The idea in one sentence

JavaScript has **one worker** (one thread) that does **one thing at a time**; the **event loop** is the rule that decides *what it picks up next*.

> **Analogy** A restaurant kitchen with a **single chef**. Orders (your code) are cooked one at a time, start to finish — the chef never splits in half. Slow things (the oven timer, a delivery) are handled by helpers outside the kitchen. When a helper finishes, they drop a ticket on a pile. The chef takes the next ticket **only when their hands are free**. There's also a small **"urgent" pile** (promises) that the chef always empties *before* touching the normal pile.

![The call stack, the microtask queue, the task queue and the host](fig:event-loop "The stack runs code. Promise callbacks wait in the microtask queue; timers, clicks and network replies wait in the task queue. ① All microtasks run first, then ② exactly one task.")

## The parts

- **Call stack** — where your code actually runs, one function at a time. (If a function calls another, the second goes on top; it must finish first.)
- **Host** — the browser or Node. It handles slow things for you: timers, network, clicks. It doesn't run your JavaScript; it just waits, and when something is ready it queues a **callback**.
- **Task queue** (macrotasks) — callbacks from `setTimeout`, `setInterval`, clicks, network, etc.
- **Microtask queue** — callbacks from promises (`.then`, code after `await`) and `queueMicrotask`.

One turn of the loop:

```
run ONE task   (the first one is your whole script)
  → then run ALL microtasks, until that queue is completely empty
      → then (in a browser) maybe repaint the screen
          → next task
```

The two consequences that explain almost every "weird order" question:

1. **Microtasks always run before the next timer** — even `setTimeout(fn, 0)`.
2. `setTimeout(fn, 0)` doesn't mean "now"; it means "**after** the current code and its microtasks are finished".

## Predict the order

Work it out on paper first, then run it:

```js try predict
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
queueMicrotask(() => console.log('4'));
console.log('5');
```

Step through to check your reasoning:

```stepper Sorting code into "now", "microtask" and "task"
code:
  console.log('1');
  setTimeout(() => console.log('2'), 0);
  Promise.resolve().then(() => console.log('3'));
  queueMicrotask(() => console.log('4'));
  console.log('5');
---
line: 1
say: Normal code runs immediately, top to bottom.
Console: 1
Microtask queue:
Task queue (timers):
---
line: 2
say: `setTimeout` asks the host to start a timer. Its callback will go to the **task queue** — later.
Task queue (timers): log 2
---
line: 3
say: The promise is already resolved, so its `.then` callback goes to the **microtask queue** right away.
Microtask queue: log 3
---
line: 4
say: `queueMicrotask` adds another microtask, behind the first one.
Microtask queue: log 3 | log 4
---
line: 5
say: The last normal line runs. The script (the first task) is finished.
Console: 1 | 5
---
say: The stack is empty, so the loop **empties the microtask queue first**, in order: 3, then 4.
Console: 1 | 5 | 3 | 4
Microtask queue:
---
say: Only now does it take ONE task from the task queue: the timer callback.
Console: 1 | 5 | 3 | 4 | 2
Task queue (timers):
```

### `await` splits a function in two

Code **before** the first `await` runs immediately. Code **after** it is a microtask:

```js try predict
async function f() {
  console.log('f: before await');
  await null;
  console.log('f: after await');
}

console.log('script: start');
f();
console.log('script: end');
```

### A timer is a *minimum* delay

If the thread is busy, a due timer just waits its turn:

```js try
const start = Date.now();

setTimeout(() => {
  const late = Math.round((Date.now() - start) / 50) * 50;
  console.log('the 0ms timer fired after about', late, 'ms');
}, 0);

while (Date.now() - start < 200) {
  // a busy loop: the thread is stuck here for 200ms
}
console.log('loop finished');
```

The `0 ms` timer had to wait for the loop. (Browsers also clamp nested timers to ≥ 4 ms and timers in background tabs to ≥ 1 s.)

## Long tasks freeze the page

While your synchronous code runs, **nothing else can** — no painting, no clicks, no timers. A loop that takes 300 ms makes the page feel broken.

![A long task blocks frames from being painted; small chunks or a worker keep the page smooth](fig:long-task "Break big work into chunks, move it to a Web Worker, or make it faster.")

A promise chain that never ends can do the same (microtasks run before painting), so don't loop forever with `.then`.

## Rate limiting user events

Scroll, resize, mouse-move and keystrokes can fire dozens of times per second. Two tools:

![Events over time; debounce fires once after each burst, throttle fires every 300ms](fig:debounce-throttle "Debounce: wait until the events stop. Throttle: at most once per window.")

| | Behaviour | Good for |
| --- | --- | --- |
| **debounce**(fn, ms) | runs **after the events stop** for `ms` | search box, autosave, resize |
| **throttle**(fn, ms) | runs **at most once every `ms`** while events keep coming | scroll position, drag, analytics |

A minimal debounce is a closure holding a timer id:

```js try
function debounce(fn, ms) {
  let timer;                                  // remembered between calls (closure!)
  return function (...args) {
    clearTimeout(timer);                      // a new call cancels the old countdown
    timer = setTimeout(() => fn.apply(this, args), ms);   // …and starts a fresh one
  };
}

const save = debounce((text) => console.log('saved:', text), 100);
save('h'); save('he'); save('hel');           // a burst of three calls…
setTimeout(() => save('hello'), 300);         // …and one later
```

Only the *last* call of each burst runs, with the **latest arguments**. Details that separate a good implementation from a bad one: passing on `this`, a `cancel()` method, and choosing the **leading** edge (run immediately, then ignore the rest) versus the **trailing** edge (run at the end).

## Dedupe: cache the promise, not the result

If ten components ask for `/api/user/1` in the same instant, you want **one** request. Store the *promise* in a cache, and everyone who asks shares it:

```js try
const cache = new Map();
let requests = 0;

function getUser(id) {
  if (!cache.has(id)) {
    requests++;
    const promise = new Promise((resolve) => setTimeout(() => resolve({ id }), 50));
    cache.set(id, promise);                   // store the PROMISE immediately, before it resolves
  }
  return cache.get(id);
}

Promise.all([getUser(1), getUser(1), getUser(1)]).then(() => console.log('network requests:', requests));
```

Also **evict on failure** (otherwise a failed request is cached forever) and decide how long a cached value stays fresh (a *TTL*).

## Frames: `requestAnimationFrame`

For visual updates use `requestAnimationFrame`: it runs once per frame, right before painting. A `setTimeout` loop drifts against the screen's refresh rate and can fire twice in one frame.

## Quick check

```check
Q: What is the logging order?
Code:
  setTimeout(() => console.log('T'), 0);
  Promise.resolve().then(() => console.log('P'));
  console.log('S');
A) T P S
B) S T P
C) P S T
D) S P T *
Why: The script's own code (S) runs first. Then all microtasks (P). Only then the next task, the timer (T).
---
Q: In an `async` function, which code runs synchronously when you call it?
A) Everything before the first `await` *
B) Nothing; it is always delayed
C) Everything, including after `await`
D) Only the `return` statement
Why: An async function runs like a normal function until its first `await`. The rest continues later as a microtask.
---
Q: A search box should call the server only once the user has *stopped typing*. Which tool?
A) `throttle`
B) `requestAnimationFrame`
C) `debounce` *
D) `setInterval`
Why: Debounce waits for a quiet period. Throttle would still call the server regularly while the user types.
---
Q: Why cache the *promise* in a request de-duplicator, rather than the result?
A) Promises use less memory
B) So concurrent callers share the in-flight request before any result exists *
C) Results can't be stored in a Map
D) Because `await` needs a cache
Why: Until the first request finishes there is no result to cache. Storing the promise immediately lets the second and third callers join the same request.
---
Q: A `for` loop runs 500 ms without yielding. What happens meanwhile?
A) The browser runs timers in parallel
B) Only painting is affected
C) No painting, clicks or timers are processed until it ends *
D) Promises are cancelled
Why: There is one thread. While it is busy with your loop, nothing else can run.
```

## Recap

- **One thread, one thing at a time.** The event loop picks the next job when the stack is empty.
- Loop turn: **one task → all microtasks → (render) → next task.**
- **Microtasks** (promises, `await` continuations, `queueMicrotask`) beat **tasks** (timers, clicks, I/O).
- `setTimeout(fn, 0)` = "after the current code and its microtasks", not "now". Timers are *minimum* delays.
- Code **before** the first `await` is synchronous; after it is a microtask.
- **Long synchronous work freezes everything** — chunk it, use a Worker, or speed it up.
- **Debounce** = run after the quiet; **throttle** = at most once per window. Both are closures over timer state.
- **Cache the promise** to dedupe in-flight work; evict on failure; add a TTL.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: predict a tiny snippet | "The parts" and the one-turn recipe (now → microtasks → tasks) |
| Predict the output | The recipe, `await` splitting a function, and the stepper |
| `debounce` | The minimal debounce above, plus forwarding `this` and the latest arguments |
| `throttle` | A window that opens on the first call, and a trailing call with the latest arguments |
| `debounce` with leading, cancel & flush | Debounce + "leading vs trailing edge" |
| `memoizeAsync` with TTL | "Dedupe: cache the promise" + the failure-eviction note |

%% exercise loop-guided-order | Guided: predict a tiny snippet | 1 | js | js | answer | 4 | guided
Read this snippet and write down **exactly** what it logs, in order, as an array of strings — *before* running anything.

```js
console.log('start');
setTimeout(() => console.log('timer'), 0);
Promise.resolve().then(() => console.log('promise'));
console.log('end');
```

Export your answer as `answer`. The skeleton helps you sort each line into the right bucket.

%% worked
**A similar problem, solved.**

```js
console.log('a');
setTimeout(() => console.log('b'), 0);
queueMicrotask(() => console.log('c'));
console.log('d');
```

1. **Sort each line into a bucket.** `log a` and `log d` run *now*. `log b` is inside a timer, so it goes to the **task queue**. `log c` is inside `queueMicrotask`, so it goes to the **microtask queue**.
2. **Run "now" lines in order:** `a`, `d`.
3. **Empty the microtask queue:** `c`.
4. **Then take one task:** `b`.

Answer: `['a', 'd', 'c', 'b']`. The recipe never changes: *now → all microtasks → one task*.

%% explain
- The test compares your array to the real output, line by line.
- It checks **order**, not just the set of messages.

%% nudge
- Which `console.log` lines are plain code that runs straight away?
- Promise callbacks versus timer callbacks: which waits in the "urgent" pile?

%% starter
```js
export const answer = [
  // Step 1 — which lines run immediately, in order?
  // Step 2 — then the microtask (the promise .then callback).
  // Step 3 — last of all, the timer callback.
];
```

%% tests
```js
describe('predicted output', () => {
  it('matches what the snippet really logs', () => {
    expect(answer).toEqual(['start', 'end', 'promise', 'timer']);
  });
});
```

%% hints
- `start` and `end` are plain code: they come first.
- Promise callbacks run before timers, even `setTimeout(..., 0)`.

%% solution
```js
export const answer = ['start', 'end', 'promise', 'timer'];
```

%% exercise loop-order | Predict the output | 1 | js | js | answer1, answer2, answer3 | 10
Read each snippet and write down **exactly** what gets logged, in order. Fill in the three arrays — no running the code first! (You'll be tempted; the point is to build the model in your head.)

**Snippet 1**
```js
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
queueMicrotask(() => console.log('D'));
(async () => {
  console.log('E');
  await null;
  console.log('F');
})();
console.log('G');
```

**Snippet 2**
```js
setTimeout(() => console.log('t1'), 0);
Promise.resolve().then(() => {
  console.log('p1');
  setTimeout(() => console.log('t2'), 0);
  Promise.resolve().then(() => console.log('p2'));
});
setTimeout(() => {
  console.log('t3');
  Promise.resolve().then(() => console.log('p3'));
}, 0);
console.log('sync');
```

**Snippet 3**
```js
async function a() { console.log('a1'); await b(); console.log('a2'); }
async function b() { console.log('b1'); }
console.log('start');
a();
new Promise((resolve) => { console.log('exec'); resolve(); })
  .then(() => console.log('then1'))
  .then(() => console.log('then2'));
console.log('end');
```

%% starter
```js
export const answer1 = []; // e.g. ['A', 'B', ...]
export const answer2 = [];
export const answer3 = [];
```

%% tests
```js
describe('event loop order', () => {
  it('snippet 1', () => {
    expect(answer1).toEqual(['A', 'E', 'G', 'C', 'D', 'F', 'B']);
  });
  it('snippet 2', () => {
    expect(answer2).toEqual(['sync', 'p1', 'p2', 't1', 't3', 'p3', 't2']);
  });
  it('snippet 3', () => {
    expect(answer3).toEqual(['start', 'a1', 'b1', 'exec', 'end', 'a2', 'then1', 'then2']);
  });
});
```

%% worked
**How to solve any "predict the output" puzzle — the recipe, applied:**

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
(async () => {
  console.log('3');
  await null;
  console.log('4');
})();
Promise.resolve().then(() => console.log('5'));
console.log('6');
```

1. **Run the script top to bottom.** Log `1`. The timer is registered (its callback waits in the task queue). The async function starts: it logs `3` *immediately* (before the first `await`), then pauses; the rest of it (`log 4`) is queued as a microtask. The promise `.then` (`log 5`) is queued as a microtask. Log `6`.
2. **Now empty the microtask queue, in the order they were queued:** `4`, then `5`.
3. **Then one task:** the timer → `2`.

Output: `1 3 6 4 5 2`. Write the queues down as you go — it's far easier than doing it in your head.

%% explain
- **Each answer is an array of strings** in the exact order they are logged.
- The tests compare with what the real code prints; partial credit doesn't exist, so trace carefully.
- No trick syntax: every puzzle follows "run now → empty microtasks → take one task → empty microtasks → …".

%% nudge
- Keep two lists on paper: "microtask queue" and "task queue". Add to them as you read each line.
- After *every* task, empty the microtask queue before taking the next task.

%% hints
- Order of business: (1) all synchronous code, (2) the whole microtask queue, (3) *one* timer, (4) microtasks again, (5) next timer…
- Snippet 1: an async function runs synchronously until its first `await`. Microtasks run in the order they were queued: the `.then`, the `queueMicrotask`, then the `await` continuation.
- Snippet 2: `t2` is scheduled *during* a microtask, i.e. after `t1` and `t3` were already queued.
- Snippet 3: `await b()` — `b()` runs synchronously and returns an already-resolved promise; the continuation `a2` is queued as a microtask *before* the `.then` chain gets to `then1`? Count carefully which microtask was queued first.

%% solution
```js
export const answer1 = ['A', 'E', 'G', 'C', 'D', 'F', 'B'];
export const answer2 = ['sync', 'p1', 'p2', 't1', 't3', 'p3', 't2'];
export const answer3 = ['start', 'a1', 'b1', 'exec', 'end', 'a2', 'then1', 'then2'];
```

%% exercise timing-debounce | debounce | 2 | js | js | debounce | 12
Write `debounce(fn, ms)`.

- The wrapper delays calling `fn` until `ms` have passed **since the last call**.
- `fn` receives the arguments and `this` of the **latest** call.
- Each call restarts the timer. Independent debounced functions don't interfere.

%% starter
```js
export function debounce(fn, ms) {
  // your code
}
```

%% tests
```js
describe('debounce', () => {
  beforeEach(() => jest.useFakeTimers());

  it('does not call immediately', () => {
    const fn = jest.fn();
    debounce(fn, 100)();
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls once after the wait', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    jest.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('restarts the timer on every call', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d(); jest.advanceTimersByTime(60);
    d(); jest.advanceTimersByTime(60);
    d(); jest.advanceTimersByTime(60);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(40);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('uses the latest arguments', () => {
    const fn = jest.fn();
    const d = debounce(fn, 50);
    d('a'); d('b'); d('c');
    jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('can fire again after a quiet period', () => {
    const fn = jest.fn();
    const d = debounce(fn, 50);
    d(1); jest.advanceTimersByTime(50);
    d(2); jest.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(2);
  });

  it('preserves this', () => {
    let self;
    const obj = { m: debounce(function () { self = this; }, 10) };
    obj.m();
    jest.advanceTimersByTime(10);
    expect(self).toBe(obj);
  });

  it('keeps separate debounced functions independent', () => {
    const a = jest.fn(), b = jest.fn();
    const da = debounce(a, 10), db = debounce(b, 10);
    da();
    jest.advanceTimersByTime(10);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    db();
  });
});
```

%% worked
**A similar problem, solved: `delayedLast(fn, ms)`** — it is a debounce without `this` handling, so you can see the skeleton.

```js
function delayedLast(fn, ms) {
  let timer;                              // ① state that survives between calls (a closure)
  return (...args) => {
    clearTimeout(timer);                  // ② cancel the previous countdown, if any
    timer = setTimeout(() => fn(...args), ms);   // ③ start a new one using THIS call's arguments
  };
}
```

What to add for `debounce`: the wrapper must be a normal `function` (not an arrow) so it has its own `this`, and then use `fn.apply(this, args)` inside the timer callback — the arrow function inside `setTimeout` keeps the wrapper's `this` and `args`. Each *debounced function* has its own `timer` variable, so two of them don't interfere.

%% explain
- **Waits `ms` after the *last* call**; each call restarts the countdown.
- **Latest arguments and `this`** are the ones `fn` receives.
- **Independent debounced functions** don't share a timer.
- Tests use **fake timers** to jump the clock, so exact timing is checked.

%% nudge
- What should happen to the previous timer when a new call arrives?
- Where should `timer` live so every call can see it, but different debounced functions get separate ones?

%% hints
- One `let timer` in the closure. On each call: `clearTimeout(timer)` then `timer = setTimeout(...)`.
- Capture `args` and `this` **per call** and use them inside the timeout callback.
- Use a regular `function` so `this` is dynamic.

%% solution
```js
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      fn.apply(this, args);
    }, ms);
  };
}
```

%% exercise timing-throttle | throttle | 2 | js | js | throttle | 15
Write `throttle(fn, ms)` with **leading and trailing** edges.

- The first call runs `fn` **immediately** and opens a window of `ms`.
- Calls made during the window are coalesced: when the window ends, `fn` runs **once** with the **latest** arguments (trailing call) and a new window opens.
- If no call arrived during the window, nothing runs at its end and the next call runs immediately.
- `this` and arguments are forwarded.

Example with `ms = 100`: calls at t=0 (`a`), 10 (`b`), 20 (`c`) → `fn('a')` at 0, `fn('c')` at 100.

%% starter
```js
export function throttle(fn, ms) {
  // your code
}
```

%% tests
```js
describe('throttle', () => {
  beforeEach(() => jest.useFakeTimers());

  it('calls immediately on the first call', () => {
    const fn = jest.fn();
    throttle(fn, 100)('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('coalesces calls in the window into one trailing call with the latest args', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t('a');
    jest.advanceTimersByTime(10); t('b');
    jest.advanceTimersByTime(10); t('c');
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(80);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('does not fire a trailing call when nothing happened in the window', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t();
    jest.advanceTimersByTime(500);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs immediately again after a quiet window', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t('a');
    jest.advanceTimersByTime(150);
    t('b');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });

  it('keeps throttling a continuous stream to one call per window', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    for (let i = 0; i <= 500; i += 10) {
      t(i);
      jest.advanceTimersByTime(10);
    }
    // leading call at 0, then one per 100ms window
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(fn.mock.calls.length).toBeLessThanOrEqual(7);
  });

  it('starts a new window after a trailing call', () => {
    const fn = jest.fn();
    const t = throttle(fn, 100);
    t('a'); t('b');
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    t('c');
    expect(fn).toHaveBeenCalledTimes(2);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('preserves this', () => {
    const seen = [];
    const obj = { m: throttle(function () { seen.push(this); }, 10) };
    obj.m(); obj.m();
    jest.advanceTimersByTime(10);
    expect(seen).toEqual([obj, obj]);
  });
});
```

%% worked
**A similar problem, solved: `oncePerWindow(fn, ms)`** — runs immediately, then ignores calls until the window closes (leading edge only, no trailing call).

```js
function oncePerWindow(fn, ms) {
  let open = true;                     // ① is the window currently open?
  return function (...args) {
    if (!open) return;                 // ② inside a window: ignore
    open = false;
    fn.apply(this, args);              // ③ run right away (the "leading" call)
    setTimeout(() => { open = true; }, ms);   // ④ re-open after ms
  };
}
```

`throttle` adds the **trailing call**: while the window is closed, don't just ignore — *remember* the latest arguments (`pendingArgs`, `pendingThis`). When the window ends, if something is remembered, run it (with the latest args) and **open a new window**; if nothing is remembered, the throttle goes back to idle so the next call runs immediately.

%% explain
- **First call runs immediately** and opens a window of `ms`.
- **Calls in the window are coalesced**: at the end, `fn` runs **once** with the latest arguments, and a new window opens.
- **No calls in the window** → nothing runs at its end; the next call is immediate again.
- Example (`ms = 100`): calls at 0 (`a`), 10 (`b`), 20 (`c`) → `fn('a')` at 0, `fn('c')` at 100.

%% nudge
- What must you remember during the window so the trailing call uses the *latest* arguments?
- When the window ends and nothing was pending, what state should you return to?

%% hints
- State: `timer` (is a window open?) and `pending` (the latest args/this received during the window).
- Call while no window is open → run `fn` now, then start the window.
- When the window's timer fires: if there's `pending`, run it and **start another window**; otherwise just close the window.

%% solution
```js
export function throttle(fn, ms) {
  let timer = null;
  let pending = null;

  function startWindow() {
    timer = setTimeout(() => {
      timer = null;
      if (pending) {
        const { args, self } = pending;
        pending = null;
        fn.apply(self, args);
        startWindow();
      }
    }, ms);
  }

  return function (...args) {
    if (timer === null) {
      fn.apply(this, args);
      startWindow();
    } else {
      pending = { args, self: this };
    }
  };
}
```

%% exercise timing-debounce-pro | debounce with leading, cancel & flush | 3 | js | js | debounce | 25
Level up your debounce: `debounce(fn, ms, { leading = false, trailing = true } = {})`.

- **trailing** (default): call `fn` after `ms` of quiet, with the latest arguments.
- **leading**: call `fn` immediately on the first call of a burst. With both flags on, a burst of one call invokes `fn` **once**; a burst of several also invokes it once more at the end (trailing) with the latest args.
- `debounced.cancel()` drops any pending call and resets the state.
- `debounced.flush()` immediately runs a pending trailing call (if any) and clears the timer.
- With `trailing: false, leading: false`, `fn` is never called by the timer.

%% starter
```js
export function debounce(fn, ms, { leading = false, trailing = true } = {}) {
  // your code
}
```

%% tests
```js
describe('debounce (options)', () => {
  beforeEach(() => jest.useFakeTimers());

  it('defaults to trailing only', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('a'); d('b');
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('b');
  });

  it('leading: true (trailing: false) fires on the first call only', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100, { leading: true, trailing: false });
    d('a'); d('b'); d('c');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    d('d');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('leading + trailing: a single call invokes once', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100, { leading: true });
    d('a');
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('leading + trailing: a burst invokes at both edges', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100, { leading: true });
    d('a'); d('b'); d('c');
    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('cancel drops the pending call', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    jest.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancel resets the burst so leading fires again', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100, { leading: true, trailing: false });
    d(); d.cancel(); d();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('flush runs the pending trailing call now', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d('x');
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('x');
    jest.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('flush does nothing when nothing is pending', () => {
    const fn = jest.fn();
    const d = debounce(fn, 100);
    d.flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('preserves this for trailing calls', () => {
    let self;
    const obj = { m: debounce(function () { self = this; }, 10) };
    obj.m();
    jest.advanceTimersByTime(10);
    expect(self).toBe(obj);
  });
});
```

%% worked
**A similar problem, solved: `delayedLast` with a `cancel()` method** — shows how to attach extra functions to a function.

```js
function delayedLast(fn, ms) {
  let timer;
  function wrapper(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; fn(...args); }, ms);
  }
  wrapper.cancel = () => { clearTimeout(timer); timer = undefined; };   // ① functions are objects: add properties
  return wrapper;
}
```

For the full version, keep a little state machine in the closure: `timer`, `lastArgs` (or `undefined` if nothing is pending), `lastThis`. Then:

- **leading**: on a call with *no active timer*, run `fn` immediately (and remember that the burst has already been served).
- **trailing**: when the timer fires, run `fn` only if a call arrived *after* the leading one (`lastArgs` is still set).
- **cancel**: clear the timer and forget `lastArgs`.
- **flush**: if `lastArgs` is set, clear the timer and run `fn` now.

Write the state down as a table (timer active? pending args?) before you code — most bugs are a missed combination.

%% explain
- **Trailing (default)**: one call after `ms` of quiet with the latest args.
- **Leading**: runs on the first call of a burst. With both flags on, a single call runs `fn` **once**; a longer burst runs it once more at the end with the latest args.
- **`cancel()`** drops any pending call and resets.
- **`flush()`** runs a pending trailing call immediately.
- **Both flags off**: the timer never calls `fn`.

%% nudge
- After a leading call, how do you know whether a trailing call is still needed?
- What exactly must `cancel()` reset so the *next* burst behaves like a fresh one?

%% hints
- Add to your simple version: `lastArgs`/`lastThis` cleared after each invocation.
- On a call: `const startOfBurst = timer === null`. If `startOfBurst && leading` → invoke now and *don't* record args; otherwise record them for the trailing call.
- At timer end: `timer = null; if (trailing && lastArgs) invoke()`.
- `cancel`: `clearTimeout`, `timer = null`, forget args. `flush`: `if (timer !== null) { clearTimeout(timer); timer = null; if (lastArgs) invoke(); }`.

%% solution
```js
export function debounce(fn, ms, { leading = false, trailing = true } = {}) {
  let timer = null;
  let lastArgs = null;
  let lastThis;

  function invokePending() {
    const args = lastArgs;
    const self = lastThis;
    lastArgs = lastThis = null;
    fn.apply(self, args);
  }

  function debounced(...args) {
    const startOfBurst = timer === null;
    if (timer !== null) clearTimeout(timer);
    if (startOfBurst && leading) {
      fn.apply(this, args);
    } else {
      lastArgs = args;
      lastThis = this;
    }
    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) invokePending();
      lastArgs = lastThis = null;
    }, ms);
  }

  debounced.cancel = () => {
    clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    if (lastArgs) invokePending();
  };

  return debounced;
}
```

%% exercise timing-memoize-async | memoizeAsync with TTL | 3 | js | js | memoizeAsync | 22
Write `memoizeAsync(fn, { ttl = Infinity, key = (...args) => JSON.stringify(args) } = {})` for async functions.

- **In-flight dedupe:** concurrent calls with the same key share **one** call to `fn` (and the same promise).
- **Cache:** after fulfillment the value is served from cache until `ttl` ms have passed (measured with `Date.now()` from when it *fulfilled*).
- **Failures are not cached** — a rejected call is evicted, so the next call retries.
- `memoized.clear()` empties the cache.

%% starter
```js
export function memoizeAsync(fn, { ttl = Infinity, key = (...args) => JSON.stringify(args) } = {}) {
  // your code
}
```

%% tests
```js
describe('memoizeAsync', () => {
  beforeEach(() => jest.useFakeTimers());

  it('dedupes concurrent calls', async () => {
    const fn = jest.fn(() => new Promise((r) => setTimeout(r, 50, 'v')));
    const m = memoizeAsync(fn);
    const a = m(1), b = m(1);
    expect(a).toBe(b);
    await jest.advanceTimersByTimeAsync(50);
    await expect(a).resolves.toBe('v');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('serves cached values after fulfillment', async () => {
    const fn = jest.fn(async (x) => x * 2);
    const m = memoizeAsync(fn);
    await expect(m(2)).resolves.toBe(4);
    await expect(m(2)).resolves.toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps different arguments apart', async () => {
    const fn = jest.fn(async (x) => x);
    const m = memoizeAsync(fn);
    await m(1); await m(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('expires entries after ttl', async () => {
    const fn = jest.fn(async () => Date.now());
    const m = memoizeAsync(fn, { ttl: 1000 });
    const first = await m();
    await jest.advanceTimersByTimeAsync(999);
    await expect(m()).resolves.toBe(first);
    expect(fn).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    await m();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not cache rejections', async () => {
    let n = 0;
    const fn = jest.fn(async () => { if (++n === 1) throw new Error('flaky'); return 'ok'; });
    const m = memoizeAsync(fn);
    await expect(m()).rejects.toThrow('flaky');
    await expect(m()).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shares a rejection between concurrent callers', async () => {
    const fn = jest.fn(() => new Promise((_, rej) => setTimeout(rej, 10, new Error('shared'))));
    const m = memoizeAsync(fn);
    const a = m(), b = m();
    const checks = Promise.all([expect(a).rejects.toThrow('shared'), expect(b).rejects.toThrow('shared')]);
    await jest.advanceTimersByTimeAsync(10);
    await checks;
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('supports a custom key function', async () => {
    const fn = jest.fn(async (user) => user.name);
    const m = memoizeAsync(fn, { key: (u) => u.id });
    await m({ id: 1, name: 'a' });
    await expect(m({ id: 1, name: 'b' })).resolves.toBe('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clear() empties the cache', async () => {
    const fn = jest.fn(async () => 1);
    const m = memoizeAsync(fn);
    await m();
    m.clear();
    await m();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

%% worked
**A similar problem, solved: `dedupe(fn)`** — concurrent calls with the same argument share one promise, and failures are forgotten.

```js
function dedupe(fn) {
  const inFlight = new Map();                          // ① key → promise
  return function (arg) {
    if (inFlight.has(arg)) return inFlight.get(arg);   // ② someone is already doing this: join them
    const promise = fn(arg).finally(() => inFlight.delete(arg));   // ③ forget it when it settles (success OR failure)
    inFlight.set(arg, promise);                        // ④ store the promise immediately
    return promise;
  };
}
```

`memoizeAsync` goes one step further: keep **successful results** after they settle. Store `{ value, at: Date.now() }` when the promise fulfils; on a later call, if `Date.now() - at < ttl`, return the cached value (wrapped in a resolved promise); otherwise call `fn` again. On **rejection**, delete the cache entry so the next call retries. `clear()` empties both maps. Default key: `JSON.stringify(args)`.

%% explain
- **In-flight dedupe**: concurrent calls with the same key get the *same* promise and call `fn` once.
- **TTL cache**: a fulfilled value is reused until `ttl` ms after it *fulfilled* (`Date.now()`).
- **Failures aren't cached**: a rejected call is evicted so the next call retries.
- **`memoized.clear()`** empties everything.

%% nudge
- Which do you need to store *before* the request finishes — the promise or the value?
- When a promise rejects, what must you delete so later calls try again?

%% hints
- `Map<key, { promise, expiresAt }>`. Store the promise itself as soon as you call `fn` — that gives you the in-flight dedupe for free.
- On fulfillment set `expiresAt = Date.now() + ttl`; while pending it's `Infinity`.
- On rejection `cache.delete(key)` — but only if the map still holds *your* entry.
- When reading: if the entry's `expiresAt <= Date.now()` treat it as missing.
- Make sure the promise you *return* is the stored one (`expect(a).toBe(b)`), while attaching side-effect handlers separately.

%% solution
```js
export function memoizeAsync(fn, { ttl = Infinity, key = (...args) => JSON.stringify(args) } = {}) {
  const cache = new Map();

  function memoized(...args) {
    const k = key(...args);
    const hit = cache.get(k);
    if (hit && hit.expiresAt > Date.now()) return hit.promise;

    const entry = { promise: null, expiresAt: Infinity };
    entry.promise = Promise.resolve().then(() => fn.apply(this, args));
    cache.set(k, entry);
    entry.promise.then(
      () => { entry.expiresAt = Date.now() + ttl; },
      () => { if (cache.get(k) === entry) cache.delete(k); },
    );
    return entry.promise;
  }

  memoized.clear = () => cache.clear();
  return memoized;
}
```
