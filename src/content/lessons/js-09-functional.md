---
id: functional
track: js
title: Functional patterns
summary: Treat functions like values you can pass around and combine — pure functions, pipe, curry, selectors, and a tiny reactive stream.
---

## The idea in one sentence

In JavaScript a function is just **a value** — you can store it, pass it, return it, and **build new functions out of old ones**.

> **Analogy** Functions are **Lego bricks**. A small brick (`trim`, `toLowerCase`) isn't impressive alone, but snap a few together and you get a machine. "Functional patterns" are just the ways of snapping bricks together neatly.

```js try
const double = (n) => n * 2;
const inc = (n) => n + 1;

const tools = { double, inc };          // store functions in an object
const apply = (fn, x) => fn(x);         // pass a function in
const twice = (fn) => (x) => fn(fn(x)); // build and RETURN a new function

console.log(tools.double(4));
console.log(apply(inc, 4));
console.log(twice(double)(4));
```

A function that takes or returns other functions is called a **higher-order function**. You already use them all the time: `map`, `filter`, `setTimeout`, `addEventListener`, `useCallback`…

## Pure functions

A function is **pure** if (1) its result depends **only on its arguments**, and (2) it does **nothing else** ("side effects": changing outside variables, printing, network, writing to the DOM).

```js try predict
let total = 0;

const addImpure = (n) => { total += n; return total; };  // changes something outside itself
const addPure = (sum, n) => sum + n;                     // only uses its arguments

console.log(addImpure(5), addImpure(5));
console.log(addPure(0, 5), addPure(0, 5));
```

The pure version always gives the same answer for the same input, so it is easy to test, safe to cache (`memoize` is only *safe* for pure functions), and easy to reason about. Real programs need effects, so the trick is to **keep the core pure and push the effects to the edges** — that's exactly how React components and reducers are designed.

## Composition: snapping bricks together

![An assembly line: trim, then toLowerCase, then spacesToDashes](fig:pipe-flow "Data flows through small single-purpose steps. Each takes one value and returns one value.")

```js try
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

const slugify = pipe(
  (s) => s.trim(),
  (s) => s.toLowerCase(),
  (s) => s.replace(/\s+/g, '-'),
);

console.log(slugify('  Hello World  '));
```

- `pipe(f, g, h)(x)` means `h(g(f(x)))` — read left to right, like data flowing.
- `compose(f, g, h)(x)` means `f(g(h(x)))` — right to left, like maths.
- Small, named steps beat one clever function: each can be tested and reused. This works best when every step takes **one** value.

(Look at how `pipe` is built: `reduce` threads the running value through each function. That's the accumulator idea from the arrays lesson.)

## Partial application and currying

Both are about giving a function *some* of its arguments now and the rest later:

- **Partial application** fixes **some** arguments: `const add5 = add.bind(null, 5)`.
- **Currying** turns `f(a, b, c)` into `f(a)(b)(c)`: **always one argument at a time**, each call returning a new function.

![add(1)(2)(3): each call returns a function that remembers what it has received](fig:curry-flow "A curried function is a chain of closures. Each holds the arguments so far in its backpack.")

```stepper Currying, one call at a time
code:
  const add = (a) => (b) => (c) => a + b + c;
  const step1 = add(1);
  const step2 = step1(2);
  const result = step2(3);
---
line: 1
say: `add` takes `a` and returns a function that takes `b` and returns a function that takes `c`. Nothing is added yet.
step1 remembers:
step2 remembers:
result:
---
line: 2
say: `add(1)` returns the inner function. It remembers `a = 1` in its backpack (a closure!).
step1 remembers: a = 1
---
line: 3
say: Calling `step1(2)` returns the next function, which now remembers `a` **and** `b`.
step2 remembers: a = 1 | b = 2
---
line: 4
say: The last call provides `c`. Now all three are known, so `a + b + c` is computed.
result: 6
```

```js try
const add = (a) => (b) => a + b;
const add10 = add(10);                 // a specialised function, made by giving one argument

console.log([1, 2, 3].map(add10));
```

A general `curry(fn)` uses `fn.length` (how many parameters `fn` declares) to know when it has collected enough arguments. (Caveat: default and rest parameters don't count towards `length`.)

## Point-free style — and its trap

"Point-free" means passing a function directly instead of wrapping it: `names.map(trim)` instead of `names.map((n) => trim(n))`. It's tidy, but **only safe when the function ignores extra arguments**. `map` passes `(value, index, array)`, so:

```js try predict
console.log(['10', '10', '10'].map(Number));
console.log(['10', '10', '10'].map(parseInt));
```

`parseInt` takes a second argument (the base) and receives the index there. When in doubt, write the arrow: `.map((s) => parseInt(s, 10))`.

## Memoizing by identity: selectors

State libraries derive data with **selectors** (think `reselect`, or React's `useMemo`). The trick is to recompute **only when the inputs changed** — and "changed" means *not the same reference* (`Object.is`).

```js try
function memoizeLast(fn) {
  let lastArgs;
  let lastResult;
  return (...args) => {
    const same = lastArgs && args.every((a, i) => Object.is(a, lastArgs[i]));
    if (same) return lastResult;           // same inputs → reuse the answer
    lastArgs = args;
    lastResult = fn(...args);
    return lastResult;
  };
}

let runs = 0;
const evens = memoizeLast((list) => { runs++; return list.filter((n) => n % 2 === 0); });

const numbers = [1, 2, 3, 4];
evens(numbers); evens(numbers);          // same array → computed once
evens([1, 2, 3, 4]);                     // new array with the same contents → computed again!
console.log('computed', runs, 'times');
```

This only works if you **never mutate** your data: if you `push` into `numbers` and pass the same array, the identity check says "unchanged" and you get a stale answer.

## Streams, in one page

- A **callback** gives you a value once, later.
- A **promise** gives you one value, once, later.
- An **observable** is a **sequence of values over time** (plus "completed" and "error"), and it can be **stopped** (unsubscribed). It is **lazy ("cold")**: nothing happens until you subscribe, and each subscriber gets its own run.

![A marble diagram: source, map and take operators over time](fig:marble-diagram "Operators wrap a source and return a new observable. `take(2)` completes after two values and unsubscribes upstream.")

```js try
// A tiny cold "observable": a function that receives a subscriber and returns a teardown function.
const ticker = (subscriber) => {
  let i = 0;
  const id = setInterval(() => subscriber.next(i++), 100);
  return () => clearInterval(id);            // teardown: how to stop
};

const subscribe = (producer, next) => ({ unsubscribe: producer({ next }) });

const sub = subscribe(ticker, (v) => console.log('tick', v));
setTimeout(() => { sub.unsubscribe(); console.log('unsubscribed'); }, 350);
```

RxJS is a big, polished version of exactly this: closures + callbacks + a teardown function. You'll build the core of it in the last exercise.

## Common mistakes

1. **Mutating inside a "pure" function** (e.g. `arr.sort()` on an argument) — it is no longer pure.
2. **Point-free with `parseInt`** and other functions that take extra optional parameters.
3. **Currying a function with default/rest parameters** and trusting `fn.length`.
4. **Selectors that return a new array/object every time** — they defeat the memoization downstream.
5. **Forgetting teardown** (timers, listeners) in stream code — leaks.

## Quick check

```check
Q: Which function is pure?
A) `(n) => { counter++; return n + counter; }`
B) `(n) => { console.log(n); return n * 2; }`
C) `(a, b) => a + b` *
D) `() => Date.now()`
Why: A pure function depends only on its arguments and has no side effects. The others change or read outside state, print, or read the clock.
---
Q: What does `pipe(a, b, c)(x)` compute?
A) `a(b(c(x)))`
B) `a(x) + b(x) + c(x)`
C) `[a(x), b(x), c(x)]`
D) `c(b(a(x)))` *
Why: `pipe` runs left to right: first `a`, then `b` on its result, then `c`. (`compose` is the reverse.)
---
Q: What is the difference between currying and partial application?
A) Currying always takes one argument per call; partial application fixes some arguments now *
B) They are the same thing
C) Partial application needs classes
D) Currying only works with numbers
Why: `f(a, b, c)` curried becomes `f(a)(b)(c)`. Partial application (`bind`) gives some arguments now and the rest later, in any grouping.
---
Q: Why is `['1', '2', '3'].map(parseInt)` a bug?
A) `parseInt` only works on numbers
B) `map` passes the index as a second argument, which `parseInt` treats as the base *
C) `map` can't take named functions
D) `parseInt` returns strings
Why: The calls are `parseInt('1', 0)`, `parseInt('2', 1)`, `parseInt('3', 2)` → `[1, NaN, NaN]`.
---
Q: A memoized selector recomputes every time even though the data "looks the same". What's the most likely cause?
A) The input is a new array/object each time, so the identity check says "changed" *
B) `Object.is` doesn't work on numbers
C) The selector is async
D) Selectors can't be memoized
Why: Identity-based memoization compares references. A fresh object with equal contents is still "different".
```

## Recap

- Functions are **values**: store, pass, return, build. Functions that take/return functions are **higher-order**.
- **Pure** = same input → same output, no side effects. Keep the core pure, effects at the edges.
- **`pipe`/`compose`** snap small one-argument functions into pipelines (left-to-right / right-to-left).
- **Partial application** fixes some arguments now; **currying** is one argument at a time. Both are closures.
- **Point-free** is only safe if the callee ignores extra arguments (`parseInt` isn't).
- **Selectors** memoize by **identity** — they rely on immutability.
- An **observable** is a lazy, cold sequence over time with error, complete and **teardown**; operators wrap a source.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: combine two functions | "Composition" — the idea of feeding one result into the next |
| `pipe` & `compose` | The `pipe` snippet and `reduce` / `reduceRight` |
| `curry()` | The currying stepper; `fn.length`; collecting arguments until enough |
| `pipeAsync` | `pipe` + promises (each step may be sync or async) |
| `createSelector` | "Memoizing by identity": `memoizeLast` and `Object.is` |
| Build an Observable | Streams: producer, subscriber, teardown; operators wrapping a source |

%% exercise fp-guided-andthen | Guided: combine two functions | 1 | js | js | andThen | 5 | guided
Write `andThen(f, g)`. It returns a **new function** that takes a value `x`, runs `f` on it first, then runs `g` on `f`'s result, and returns that.

```js
const double = (n) => n * 2;
const inc = (n) => n + 1;
andThen(double, inc)(5); // inc(double(5)) → 11
andThen(inc, double)(5); // double(inc(5)) → 12   (order matters!)
```

%% worked
**A similar problem, solved: `both(f, g)`** — returns a function that calls `f` and `g` on the same value and returns both results in an array.

```js
function both(f, g) {
  return function (x) {          // ① a NEW function that takes one value
    return [f(x), g(x)];         // ② it uses f and g from the backpack (closure!)
  };
}

both(Math.sqrt, Math.abs)(-9); // [NaN, 9]
```

You're building a function out of two other functions. `andThen` has the same shape; the only difference is how `f` and `g` are combined: instead of calling both on `x`, feed **`f`'s result into `g`**.

%% explain
- **Order**: `f` runs first, then `g` on `f`'s result — `andThen(double, inc)(5)` is `11`, not `12`.
- **Returns a function** (and each call is independent — no shared state).
- **Works with any values** (numbers, strings, arrays).

%% nudge
- What does the returned function receive, and what does it pass on to `g`?
- In `g(f(x))`, which one runs first?

%% starter
```js
export function andThen(f, g) {
  // Step 1 — return a NEW function that takes one value, x.
  return function (x) {
    // Step 2 — run f on x first.
    // Step 3 — run g on f's result, and return it.
  };
}
```

%% tests
```js
describe('andThen', () => {
  const double = (n) => n * 2;
  const inc = (n) => n + 1;

  it('runs f first, then g on the result', () => {
    expect(andThen(double, inc)(5)).toBe(11);
  });

  it('respects the order', () => {
    expect(andThen(inc, double)(5)).toBe(12);
  });

  it('works on other types', () => {
    const trim = (s) => s.trim();
    const shout = (s) => s.toUpperCase() + '!';
    expect(andThen(trim, shout)('  hi ')).toBe('HI!');
  });

  it('gives back a reusable function', () => {
    const f = andThen(double, inc);
    expect(f(1)).toBe(3);
    expect(f(10)).toBe(21);
  });
});
```

%% hints
- `return g(f(x));` inside the returned function.

%% solution
```js
export function andThen(f, g) {
  return function (x) {
    return g(f(x));
  };
}
```

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

%% worked
**A similar problem, solved: `sequence(...steps)`** — runs functions one after another on a running value, using `reduce`.

```js
const sequence = (...steps) => (start) =>
  steps.reduce((value, step) => step(value), start);   // ① the accumulator IS the running value

sequence((n) => n + 1, (n) => n * 10)(4); // (4 + 1) * 10 = 50
```

That is `pipe` almost exactly. Two details the exercise adds: **(1)** the *first* function may take **several** arguments — call it with all of them (`fns[0](...args)`) and feed its result through the remaining ones; **(2)** with **no** functions, return the first argument untouched (identity). `compose` is the same, but going **right to left**, where the *last* function is the one that may take multiple arguments — `reduceRight` (or reversing the list) does that.

%% explain
- **`pipe(f, g, h)(x)`** = `h(g(f(x)))`; **`compose(f, g, h)(x)`** = `f(g(h(x)))`.
- **Multiple arguments** are allowed for the *first* function of `pipe` and the *last* of `compose`.
- **No functions** → returns its first argument unchanged.
- **No shared state** between calls of the resulting function.

%% nudge
- Which array method threads a value through a list of functions?
- What should happen with zero functions?

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

%% worked
**A similar problem, solved: `collect(n, done)`** — gathers arguments over several calls until it has `n` of them, then hands them all to `done`.

```js
function collect(n, done) {
  function gather(soFar) {                                    // ① `soFar` is the backpack of arguments so far
    return (...more) => {
      const all = [...soFar, ...more];                        // ② combine old and new (a NEW array — never mutate soFar!)
      return all.length >= n ? done(...all) : gather(all);    // ③ enough? finish. Otherwise return another collector
    };
  }
  return gather([]);
}

const c = collect(3, (a, b, c) => a + b + c);
c(1)(2)(3);   // 6
c(1, 2)(3);   // 6   — several at once also works
```

Not mutating `soFar` is what makes partial functions **reusable**: `const add1 = c(1)` can be called again and again without interfering. `curry(fn)` is this with `n = fn.length` and `done = fn`; two extras: a **zero-arity** function is called on the first invocation, and `this` from the call that completes the list is forwarded (use `fn.apply(this, all)` inside a regular `function`).

%% explain
- **Collects arguments** across calls until it has at least `fn.length`, then calls `fn` with all of them.
- **Grouping doesn't matter**: `c(1)(2, 3)`, `c(1, 2)(3)` and `c(1, 2, 3)` are equal.
- **Reusable partials**: `const add1 = c(1)` can be used many times independently.
- **Zero-arity** functions run on the first call.
- **`this`** comes from the call that completes the arguments.

%% nudge
- Where do you keep the arguments received so far, and why must each call make a *new* list?
- How do you know you have "enough" arguments?

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

%% worked
**A similar problem, solved: `chainAsync(...steps)`** — like `sequence`, but each step may return a promise.

```js
const chainAsync = (...steps) => async (start) => {
  let value = start;
  for (const step of steps) {
    value = await step(value);      // ① `await` works for plain values AND promises
  }
  return value;                     // ② an async function always returns a promise
};
```

Why this is enough: `await` on a non-promise just gives the value back, so sync and async steps can be mixed. A thrown error or rejection inside the loop **exits the function**, so later steps never run, and the returned promise rejects — for free.

For `pipeAsync`: the first function may take several arguments (`await fns[0](...args)`), and with no functions you resolve with the first argument.

%% explain
- **Every step receives the resolved value** of the previous one (sync or async).
- **Returns a promise** always.
- **First function may take several arguments.**
- **An error or rejection stops the chain**: later steps do not run.
- **No functions** → resolves with the first argument.

%% nudge
- Which keyword lets one code path handle both plain values and promises?
- What happens to the remaining steps when one of them throws inside an `async` function?

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

%% worked
**A similar problem, solved: `memoizeLastBy(keyFn, compute)`** — keeps only the most recent result and reuses it when the *key* is identical.

```js
function memoizeLastBy(keyFn, compute) {
  let lastKey;
  let lastResult;
  let hasRun = false;
  let runs = 0;
  const fn = (input) => {
    const key = keyFn(input);                        // ① derive the thing we compare (a reference, not a deep value)
    if (hasRun && Object.is(key, lastKey)) return lastResult;   // ② same key → reuse
    hasRun = true;
    lastKey = key;
    runs += 1;
    return (lastResult = compute(input));            // ③ different → recompute and remember
  };
  fn.runs = () => runs;                              // ④ expose a counter for tests
  return fn;
}
```

`createSelector` has the same skeleton with **several** keys: run every input selector with the same arguments, compare each result with the previous call's (`Object.is`, one by one), and only call `resultFn` if any changed. Remember the previous **input results** *and* the previous **output**, and count recomputations for `selector.recomputations()`.

%% explain
- **Runs every input selector** with the same arguments.
- **If all results are `Object.is`-identical to the previous call**, the previous result is returned and `resultFn` does **not** run.
- **Otherwise** it recomputes.
- **`selector.recomputations()`** counts how many times `resultFn` has run.

%% nudge
- What must you store between calls to be able to compare? (Inputs *and* output.)
- Why does `Object.is` (identity) make sense here, instead of a deep comparison?

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

%% worked
**How to approach it: grow the solution in layers.** Layer 1 is the smallest thing that works:

```js
class Observable {
  constructor(producer) { this.producer = producer; }     // ① a producer function, NOT run yet (lazy)

  subscribe(next) {
    let closed = false;
    const subscriber = {
      next: (v) => { if (!closed) next(v); },              // ② ignore values after closing
      complete: () => { closed = true; },
      error: () => { closed = true; },
    };
    const teardown = this.producer(subscriber);            // ③ the producer runs when someone SUBSCRIBES (cold)
    return {
      unsubscribe() {
        if (!closed) { closed = true; teardown?.(); }      // ④ stop, and run the teardown
      },
    };
  }
}
```

What the remaining layers add, in order:
1. **Observer object / error / complete callbacks**: accept a function *or* `{ next, error, complete }`; a throw inside the producer goes to `error`.
2. **Teardown exactly once** — including when the producer completes *synchronously* (before it has even returned its teardown): remember "already closed" and run the teardown as soon as it arrives.
3. **Operators**: `map(fn)` returns `new Observable(sub => this.subscribe({ next: v => sub.next(fn(v)), error: sub.error, complete: sub.complete }).unsubscribe)` — a *new* observable wrapping the source, and its teardown unsubscribes from the source. `filter` and `take(n)` are variations (take calls `complete()` and unsubscribes after `n` values).
4. **Statics**: `of(...values)` emits then completes; `interval(ms)` uses `setInterval` and its teardown calls `clearInterval`.

%% explain
- **Lazy and cold**: the producer runs on *each* subscribe.
- **`subscribe`** takes a function or `{ next, error, complete }` and returns `{ unsubscribe() }`.
- **After complete/error/unsubscribe**, nothing more is delivered, and the teardown runs **exactly once** (even if the producer completed synchronously).
- **A throw in the producer** goes to `error`.
- **Operators** `map`, `filter`, `take(n)` return new observables, unsubscribe upstream when unsubscribed, and turn throws into `error`.
- **`Observable.of`** emits synchronously then completes; **`Observable.interval(ms)`** emits `0, 1, 2, …` and its teardown stops the timer.

%% nudge
- Who is responsible for calling the teardown when `take(2)` finishes?
- If the producer calls `complete()` *before it returns*, how can you still run its teardown afterwards?

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
