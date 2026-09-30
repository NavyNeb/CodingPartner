---
id: event-loop
track: js
title: The event loop, timers & rate limiting
summary: Predict execution order, then build debounce, throttle and an async memoizer on top of it.
---

JavaScript runs your code on **one thread** with a **call stack**. Anything asynchronous is handed to the host (browser/Node), and when it's done a *callback is queued*. The **event loop** is the rule for when queued callbacks get the stack.

## The two queues

1. **Macrotask (task) queue** — `setTimeout`, `setInterval`, I/O, UI events, `MessageChannel`.
2. **Microtask queue** — promise reactions (`.then`, `await` continuations), `queueMicrotask`, `MutationObserver`.

One turn of the loop:

```
run ONE macrotask (the initial script counts as one)
  └─ then drain the microtask queue COMPLETELY (including microtasks queued by microtasks)
       └─ then (browser) maybe render: rAF callbacks → style → layout → paint
            └─ next macrotask
```

Consequences:

- Microtasks **always run before the next timer**, even `setTimeout(fn, 0)`. A promise chain can starve rendering if it never ends.
- `setTimeout(fn, 0)` means "no sooner than, after the current task and its microtasks"; browsers clamp nested timers to ≥ 4 ms, and background tabs to ≥ 1 s.
- A timer is a *minimum* delay: if the stack is busy, it waits.
- `await x` is roughly `Promise.resolve(x).then(continue)` — so the code after an `await` is a microtask, and code *before* the first `await` in an async function runs synchronously.

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
// 1 4 3 2
```

## Long tasks block everything

While a long synchronous loop runs, there is no rendering, no input handling, no timers. Break work into chunks (`setTimeout`/`requestIdleCallback`/`scheduler.yield`), move it to a Web Worker, or make it faster.

## Rate limiting user-driven events

Scroll, resize, mousemove and keystrokes fire far faster than you can handle. Two tools:

| | Behaviour | Use for |
| --- | --- | --- |
| **debounce**(fn, ms) | run *after the events stop* for `ms` | search box, autosave, window-resize layout |
| **throttle**(fn, ms) | run *at most once per `ms`* while events keep coming | scroll position, drag, analytics pings |

Both are closures over timer state — the closure lesson again. Details that separate a good implementation from a bad one: **latest arguments**, preserving `this`, cleaning up (`cancel`), and *leading* vs *trailing* edge.

## Deduping in-flight work

If ten components ask for `/api/user/1` in the same tick, you want one request. Cache the **promise**, not the result — then concurrent callers share it. Evict on failure so a retry is possible, and decide on a TTL for freshness.

## Frames and `requestAnimationFrame`

Visual updates should run in `requestAnimationFrame` (once per frame, right before paint). A `setTimeout` loop drifts against the display's frame timing and can run more than once per frame.

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
