---
id: iterators
track: js
title: Iterators, generators & lazy pipelines
summary: The hidden protocol behind for…of and spread, generators that pause and resume, and how to process huge or endless data one item at a time.
---

## The idea in one sentence

An **iterator** is something you can ask for **"the next item"** over and over until it says **"no more"** — and that simple contract powers `for…of`, spread, destructuring and more.

> **Analogy** Think of a **ticket dispenser** ("take a number"). You don't see the whole roll; you just tear off the next ticket when you ask. Eventually the roll is empty and the dispenser tells you so. A **generator** is a *chef who pauses* after every dish until you say "next" — cooking only when asked.

## The protocol: two tiny contracts

- An **iterable** is an object with a method named `[Symbol.iterator]` that returns an iterator.
- An **iterator** is an object with a `next()` method returning `{ value, done }`.

![Iterable gives an iterator; the consumer calls next() until done is true](fig:iterator-protocol "① The iterable hands out an iterator. ② The iterator has next(). ③ The consumer — for…of, spread, destructuring — keeps calling it until `done: true`.")

Arrays, strings, `Set`, `Map` and more are all iterable. You can drive the protocol by hand:

```js try
const iterator = [10, 20][Symbol.iterator]();

console.log(iterator.next());
console.log(iterator.next());
console.log(iterator.next());   // done: true — no more items
```

That is *exactly* what `for…of` does for you behind the scenes: call `next()` until `done` is `true`, giving your loop body each `value`.

### Making your own iterable

```js try
const countdown = {
  from: 3,
  [Symbol.iterator]() {
    let n = this.from;               // state lives in a closure: each loop gets a fresh counter
    return {
      next: () => (n > 0 ? { value: n--, done: false } : { value: undefined, done: true }),
    };
  },
};

console.log([...countdown]);                 // spread uses the protocol
for (const n of countdown) console.log('loop', n);
```

### Stopping early: `return()`

An iterator can have an optional `return()` method. JavaScript calls it when the consumer **stops early** — `break`, `return`, a thrown error, or destructuring fewer items than exist. It's the cleanup hook (close a file, unsubscribe). On normal completion it is **not** called.

![When the consumer breaks early, return() runs the cleanup; when the loop finishes normally it does not](fig:early-exit "`return()` exists so iterators can release resources when nobody will read the rest.")

```js try predict
const source = {
  [Symbol.iterator]() {
    let n = 0;
    return {
      next: () => ({ value: n++, done: false }),
      return: () => { console.log('cleanup!'); return { done: true }; },
    };
  },
};

for (const x of source) {
  console.log('got', x);
  if (x === 1) break;
}
```

## Generators: iterators you write as functions

Writing `next()` by hand is fiddly. A **generator function** (`function*`) does it for you. It can **pause** at each `yield` and **resume** on the next `next()`, remembering all its local variables.

```js try
function* range(start, end) {
  for (let i = start; i < end; i++) {
    yield i;                 // hand one value to the consumer, then pause here
  }
}

console.log([...range(0, 4)]);
```

Predict what this one prints, then step through to see *when* each line runs:

```js try predict
function* count() {
  console.log('start');
  yield 1;
  console.log('middle');
  yield 2;
  console.log('end');
}

const it = count();
console.log(it.next().value);
console.log(it.next().value);
console.log(it.next().value);
```

```stepper A generator pauses at every yield
code:
  function* count() {
    console.log('start');
    yield 1;
    console.log('middle');
    yield 2;
    console.log('end');
  }
  const it = count();
  it.next();
  it.next();
  it.next();
---
line: 8
say: Calling a generator function runs **none** of its body. It just gives you a generator object, paused at the very beginning.
Console:
Generator: not started
next() returned:
---
line: 9
say: The first `next()` starts the body. It runs until the first `yield`.
Console: start
Generator: running
---
line: 3
say: `yield 1` hands the value to whoever called `next()` — and **pauses right here**.
Generator: paused at yield 1
next() returned: { value: 1, done: false }
---
line: 10
say: The second `next()` resumes from exactly where it paused.
Console: start | middle
Generator: running
---
line: 5
say: `yield 2` pauses again.
Generator: paused at yield 2
next() returned: { value: 2, done: false }
---
line: 11
say: The third `next()` resumes and runs to the end of the function.
Console: start | middle | end
Generator: running
---
line: 7
say: The function finished without another `yield`, so the result is `done: true`. The generator is now used up.
Generator: finished
next() returned: { value: undefined, done: true }
```

What that buys you:

- **Lazy by construction**: nothing runs until somebody pulls. `range(0, 1e12)` costs nothing until you start reading it. You can even describe **infinite** sequences.
- **`yield*`** hands over to another iterable — perfect for recursion (walking a tree).
- **Two-way**: `it.next(value)` sends a value *into* the generator (it becomes the result of the `yield`), and `it.return()` / `it.throw()` run `finally` blocks. That channel is what old async libraries were built on.

### Infinite sequences, safely

```js try
function* naturals() {
  let n = 1;
  while (true) yield n++;      // never ends — but only runs when asked
}

const firstThree = [];
for (const n of naturals()) {
  firstThree.push(n);
  if (firstThree.length === 3) break;   // ALWAYS stop an infinite iterator yourself
}
console.log(firstThree);
```

> **Watch out** `[...naturals()]` would never finish: spread tries to read *everything*, so the tab hangs. With infinite sources, always take a limited number.

## Lazy pipelines

Array methods are **eager**: each step builds a whole new array before the next step begins. Generators let you chain **lazy** steps:

![Eager array steps build full arrays; lazy steps pass one item at a time and stop early](fig:lazy-vs-eager "With lazy steps, `take(2)` stops the whole pipeline as soon as two results exist.")

```js try
function* map(fn, iterable) { for (const x of iterable) yield fn(x); }
function* filter(pred, iterable) { for (const x of iterable) if (pred(x)) yield x; }
function* take(n, iterable) {
  if (n <= 0) return;
  for (const x of iterable) {
    yield x;
    if (--n === 0) return;     // stop BEFORE asking the source for another item
  }
}
function* naturals() { let n = 1; while (true) yield n++; }

const result = take(3, filter((n) => n % 2 === 0, map((n) => {
  console.log('mapping', n);
  return n * 10;
}, naturals())));

console.log([...result]);
```

Look at the log: items are mapped only **as needed**, one at a time, and it stops after three. Memory stays tiny no matter how long the source is. (Modern runtimes have `Iterator.prototype.map/filter/take` built in; writing them yourself is how the idea sticks.)

## Async iteration

`for await (const x of source)` reads an **async iterable**, whose `next()` returns promises. An **async generator** (`async function*`) can both `await` and `yield` — the natural shape for paginated APIs, streams and live feeds:

```js try
const pages = [[1, 2], [3], [4, 5]];
const fetchPage = (i) => new Promise((resolve) => setTimeout(() => resolve(pages[i] ?? null), 30));

async function* allItems() {
  for (let i = 0; ; i++) {
    const page = await fetchPage(i);       // the next page is only fetched when someone asks for more
    if (!page) return;
    yield* page;
  }
}

(async () => {
  for await (const item of allItems()) console.log('item', item);
})();
```

Backpressure comes free: the producer only moves forward when the consumer asks for the next item.

## Common mistakes

1. **Spreading an infinite generator** — hangs the tab. Take a fixed number.
2. **Reusing a used-up iterator** — iterators are usually single-use; an *iterable* gives a **fresh** iterator each time you loop.
3. **`for…in` vs `for…of`** — `in` walks *keys* (including inherited ones); `of` walks *values* using the protocol. Plain objects aren't iterable.
4. **Forgetting that generators don't run until pulled** — calling `gen()` does nothing by itself.
5. **Doing cleanup only on the happy path** — use `finally` (or `return()`) so early exit still cleans up.

## Quick check

```check
Q: Which pair of things makes an object work with `for…of`?
A) A `length` property and numeric keys
B) A `forEach` method
C) An `.items` array
D) A `[Symbol.iterator]()` method that returns an object with `next()` *
Why: `for…of` calls `obj[Symbol.iterator]()` to get an iterator, then calls `next()` until `done` is true.
---
Q: What does calling a generator function (`const g = count();`) do?
A) Runs the whole body
B) Runs nothing yet; it returns a paused generator object *
C) Runs until the first `yield`
D) Throws if the body has no `yield`
Why: The body only starts running on the first `next()`.
---
Q: When is an iterator's `return()` method called?
A) When the consumer stops early, e.g. `break` *
B) Every time `next()` is called
C) After the last item, always
D) Only when an error is thrown inside `next()`
Why: `return()` is the early-exit cleanup hook. After normal completion there is nothing to clean up, so it isn't called. (A thrown error in the loop body also triggers it, but `break` is the classic case.)
---
Q: What happens with `const all = [...naturals()]` where `naturals` is an infinite generator?
A) It returns the first 100 items
B) It returns `[]`
C) It never finishes; the program hangs *
D) It throws a `RangeError` immediately
Why: Spread keeps pulling until `done: true`, which never comes.
---
Q: What is `for await…of` used for?
A) Looping over arrays faster
B) Reading an async iterable one item at a time, waiting for each *
C) Running loop bodies in parallel
D) Replacing `Promise.all`
Why: It awaits each `next()` result in turn — ideal for streams and paginated data. It is sequential, not parallel.
```

## Recap

- **Iterable** = has `[Symbol.iterator]()`; **iterator** = has `next()` returning `{ value, done }`. `for…of`, spread, destructuring and `Array.from` all use it.
- `return()` is the **early-exit cleanup** hook — called on `break`, not on normal completion.
- **Generators** (`function*` + `yield`) pause and resume and keep their locals; calling one runs nothing until you pull.
- **Lazy pipelines** process one item at a time, stop early, and work on infinite sources; array methods are eager.
- **Never spread an infinite iterator.**
- **Async generators** + `for await` are the natural way to read pages, streams and feeds, with built-in backpressure.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a counting generator | `function*` and `yield` |
| `range()` generator | Generators and laziness; thinking about negative steps |
| Hand-written iterator with cleanup | "The protocol" and "Stopping early: `return()`" |
| Lazy pipeline operators | "Lazy pipelines": the `map`/`filter`/`take` example |
| Tree traversal with `yield*` | `yield*` delegation; a queue for breadth-first |
| Async generator `paginate()` | "Async iteration": `async function*`, `await`, `yield` |

%% exercise iter-guided-count | Guided: a counting generator | 1 | js | js | countTo | 5 | guided
Write the generator function `countTo(n)`. It yields `1, 2, 3, …, n` — one number each time it is asked.

```js
[...countTo(3)];          // [1, 2, 3]
[...countTo(0)];          // []
const it = countTo(Infinity);
it.next().value;          // 1  — it is lazy, so this does NOT hang
```

%% worked
**A similar problem, solved: `evens(limit)`** — yields the even numbers below `limit`.

```js
function* evens(limit) {
  for (let i = 0; i < limit; i += 2) {   // ① a normal loop…
    yield i;                             // ② …but instead of pushing into an array, `yield` hands each value out
  }
}

[...evens(7)];   // [0, 2, 4, 6]
```

A generator function is declared with `function*`. There's **no array and no `return` of a list** — each `yield` pauses the function and gives one value to the caller; the next request resumes the loop where it stopped. That's why `countTo(Infinity)` is fine: it only ever produces what's asked for.

%% explain
- **Yields `1…n`** in order.
- **`n = 0`** yields nothing.
- **Lazy**: asking for the first value of `countTo(Infinity)` must return immediately.
- **Reusable as an iterable** — spread, `for…of` and `Array.from` all work on it.

%% nudge
- What do you write in a generator where a normal function would `push` into an array?
- Where does the loop pause between values?

%% starter
```js
export function* countTo(n) {
  // Step 1 — loop from 1 up to n:   for (let i = 1; i <= n; i++) { ... }
  // Step 2 — inside the loop, hand out each number with:   yield i;
  //          (no array, no return — the generator does the rest)
}
```

%% tests
```js
describe('countTo', () => {
  it('yields 1..n', () => {
    expect([...countTo(3)]).toEqual([1, 2, 3]);
  });

  it('yields nothing for 0', () => {
    expect([...countTo(0)]).toEqual([]);
  });

  it('is lazy: works with an endless limit', () => {
    const it = countTo(Infinity);
    expect(it.next()).toEqual({ value: 1, done: false });
    expect(it.next()).toEqual({ value: 2, done: false });
  });

  it('can be used with for…of and break', () => {
    const seen = [];
    for (const x of countTo(10)) {
      seen.push(x);
      if (x === 4) break;
    }
    expect(seen).toEqual([1, 2, 3, 4]);
  });
});
```

%% hints
- `for (let i = 1; i <= n; i++) { yield i; }` is the whole body.

%% solution
```js
export function* countTo(n) {
  for (let i = 1; i <= n; i++) {
    yield i;
  }
}
```

%% exercise iter-range | range() generator | 2 | js | js | range | 10
Write the generator function `range`.

- `range(end)` → `0 … end-1`
- `range(start, end)` → `start … end-1`
- `range(start, end, step)` — `step` may be negative (counting down; `end` still exclusive). `step` of `0` throws a `RangeError` (when iteration starts is fine).
- It must be **lazy**: `range(0, 1e12)` must not allocate anything up front.

%% starter
```js
export function* range(...args) {
  // your code
}
```

%% tests
```js
describe('range', () => {
  it('range(end)', () => expect([...range(4)]).toEqual([0, 1, 2, 3]));
  it('range(start, end)', () => expect([...range(2, 5)]).toEqual([2, 3, 4]));
  it('range(start, end, step)', () => expect([...range(0, 10, 3)]).toEqual([0, 3, 6, 9]));
  it('counts down with a negative step', () => expect([...range(5, 0, -2)]).toEqual([5, 3, 1]));
  it('is empty when the direction is wrong', () => {
    expect([...range(5, 0)]).toEqual([]);
    expect([...range(0, 5, -1)]).toEqual([]);
  });
  it('rejects a zero step', () => {
    expect(() => [...range(0, 5, 0)]).toThrow(RangeError);
  });
  it('is a real generator (lazy, iterator protocol)', () => {
    const it = range(0, 1e12);
    expect(typeof it.next).toBe('function');
    expect(it.next()).toEqual({ value: 0, done: false });
    expect(it.next()).toEqual({ value: 1, done: false });
  });
  it('can be consumed lazily with a break', () => {
    const seen = [];
    for (const n of range(0, 1e12)) { seen.push(n); if (n === 2) break; }
    expect(seen).toEqual([0, 1, 2]);
  });
  it('supports fractional steps', () => {
    expect([...range(0, 1, 0.25)]).toEqual([0, 0.25, 0.5, 0.75]);
  });
});
```

%% worked
**A similar problem, solved: `repeat(value, times)`** — yields the same value `times` times, lazily, and treats bad input up front.

```js
function* repeat(value, times) {
  if (times < 0) throw new RangeError('times must be >= 0');   // ① checks run when iteration STARTS, not when you call repeat()
  for (let i = 0; i < times; i++) yield value;
}
```

For `range`: handle the **argument shapes** first (`range(end)`, `range(start, end)`, `range(start, end, step)`), then loop with a `while` that depends on the **direction**: for a positive step keep going while `i < end`; for a negative step keep going while `i > end`. A `step` of `0` would loop forever, so throw the `RangeError`.

```js
for (let i = start; step > 0 ? i < end : i > end; i += step) yield i;
```

Because it is a generator, `range(0, 1e12)` allocates nothing until somebody starts pulling values.

%% explain
- **Argument shapes**: `range(end)`, `range(start, end)`, `range(start, end, step)`; `end` is exclusive.
- **Negative step** counts down (still exclusive of `end`).
- **`step` of 0** throws a `RangeError` (when iteration starts).
- **Lazy**: `range(0, 1e12)` allocates nothing up front.

%% nudge
- How do you make `range(5)` mean `0…4`? Which argument is which when only one is given?
- What must the loop condition be for a *negative* step?

%% hints
- Normalise arguments first: one arg → `[0, arg, 1]`; two → `[a, b, 1]`; three → as given.
- `for (let i = start; step > 0 ? i < end : i > end; i += step) yield i;`
- Check for `step === 0` before the loop.

%% solution
```js
export function* range(...args) {
  let start = 0, end, step = 1;
  if (args.length === 1) [end] = args;
  else [start, end, step = 1] = args;
  if (step === 0) throw new RangeError('step must not be 0');
  for (let i = start; step > 0 ? i < end : i > end; i += step) yield i;
}
```

%% exercise iter-countdown | Hand-written iterator with cleanup | 3 | js | js | Countdown | 15
Implement a class `Countdown` that is **iterable** *without using a generator* — write the iterator object yourself.

```js
new Countdown(3)           // iterates 3, 2, 1
new Countdown(3, { onClose })
```

- Each `for…of`/spread starts a **fresh** iteration (the same `Countdown` can be iterated many times).
- Implement `return()` so that when a consumer **stops early** (`break`, destructuring fewer items) `onClose` is called **exactly once**.
- `onClose` is **not** called when iteration runs to completion.
- `next()` after completion keeps returning `{ done: true, value: undefined }`.

%% starter
```js
export class Countdown {
  constructor(from, { onClose } = {}) {
    // your code
  }

  [Symbol.iterator]() {
    // return an iterator object: { next() { ... }, return() { ... } }
  }
}
```

%% tests
```js
describe('Countdown', () => {
  it('counts down', () => expect([...new Countdown(3)]).toEqual([3, 2, 1]));
  it('supports zero', () => expect([...new Countdown(0)]).toEqual([]));

  it('can be iterated repeatedly', () => {
    const c = new Countdown(2);
    expect([...c]).toEqual([2, 1]);
    expect([...c]).toEqual([2, 1]);
  });

  it('keeps independent iterators independent', () => {
    const c = new Countdown(3);
    const a = c[Symbol.iterator](), b = c[Symbol.iterator]();
    expect(a.next().value).toBe(3);
    expect(a.next().value).toBe(2);
    expect(b.next().value).toBe(3);
  });

  it('calls onClose once when the consumer breaks early', () => {
    const onClose = jest.fn();
    for (const n of new Countdown(5, { onClose })) { if (n === 4) break; }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when destructuring fewer items', () => {
    const onClose = jest.fn();
    const [first] = new Countdown(5, { onClose });
    expect(first).toBe(5);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose after running to completion', () => {
    const onClose = jest.fn();
    [...new Countdown(3, { onClose })];
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when the loop body throws', () => {
    const onClose = jest.fn();
    expect(() => { for (const n of new Countdown(3, { onClose })) throw new Error('x'); }).toThrow('x');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays done after completion', () => {
    const it = new Countdown(1)[Symbol.iterator]();
    it.next(); it.next();
    expect(it.next()).toEqual({ value: undefined, done: true });
    expect(it.next()).toEqual({ value: undefined, done: true });
  });

  it('is not implemented with a generator', () => {
    const it = new Countdown(1)[Symbol.iterator]();
    expect(Object.prototype.toString.call(it)).not.toBe('[object Generator]');
  });
});
```

%% worked
**A similar problem, solved: `Repeater`** — an iterable class written without a generator, with `return()` cleanup.

```js
class Repeater {
  constructor(text, times, onClose) { this.text = text; this.times = times; this.onClose = onClose; }

  [Symbol.iterator]() {
    let i = 0;                                   // ① state is created PER iteration (so you can loop again)
    const self = this;
    return {
      next() {
        return i < self.times
          ? { value: self.text, done: false }    // ② hand out a value…
          : { value: undefined, done: true };    //    …or report "finished"
        // (and don't forget i++ somewhere!)
      },
      return() {                                 // ③ called when the consumer STOPS EARLY
        self.onClose?.();
        return { value: undefined, done: true };
      },
    };
  }
}
```

Two important rules for `Countdown`: call `onClose` **exactly once** (remember if you already did), and **not at all** if the iteration ran to completion. After finishing or closing, every further `next()` should keep returning `{ done: true, value: undefined }`.

%% explain
- **Iterable without a generator**: you write `[Symbol.iterator]()` and the iterator object yourself.
- **Fresh iteration each time**: the same `Countdown` can be looped over repeatedly.
- **`return()`** is called on early exit (`break`, destructuring fewer items) and calls `onClose` **exactly once**.
- **No `onClose`** when iteration finishes normally.
- **After completion**, `next()` keeps returning `{ done: true, value: undefined }`.

%% nudge
- Where should the counter variable live so each loop starts from the beginning?
- How can `return()` make sure `onClose` runs only once, even if it is called twice?

%% hints
- `[Symbol.iterator]()` creates its own `let n = this.from` and returns `{ next, return }` closing over `n` — that's per-iteration state.
- `next()`: `n > 0 ? { value: n--, done: false } : { value: undefined, done: true }`. Track a `finished` flag.
- `return()` must return `{ value, done: true }`, call `onClose` only if the iteration wasn't already finished, and mark it finished so it can't fire twice.

%% solution
```js
export class Countdown {
  constructor(from, { onClose } = {}) {
    this.from = from;
    this.onClose = onClose;
  }

  [Symbol.iterator]() {
    let n = this.from;
    let finished = false;
    const onClose = this.onClose;
    return {
      next() {
        if (finished || n <= 0) {
          finished = true;
          return { value: undefined, done: true };
        }
        return { value: n--, done: false };
      },
      return(value) {
        if (!finished) {
          finished = true;
          onClose?.();
        }
        return { value, done: true };
      },
    };
  }
}
```

%% exercise iter-lazy-pipeline | Lazy pipeline operators | 3 | js | js | naturals, map, filter, take, toArray | 20
Write lazy, generator-based operators. Data-last signature so they compose.

- `naturals()` — infinite `1, 2, 3, …`
- `map(fn, iterable)`, `filter(pred, iterable)` — lazy; `fn`/`pred` receive `(value, index)`.
- `take(n, iterable)` — the first `n` items, then **stop pulling** the source (it must not consume item `n + 1`).
- `toArray(iterable)`.
- Early termination must propagate: when `take` finishes, generators upstream get their `finally` blocks run.

%% starter
```js
export function* naturals() {
  // your code
}

export function* map(fn, iterable) {
  // your code
}

export function* filter(pred, iterable) {
  // your code
}

export function* take(n, iterable) {
  // your code
}

export function toArray(iterable) {
  // your code
}
```

%% tests
```js
describe('lazy pipeline', () => {
  it('naturals is infinite (pull a few)', () => {
    expect(toArray(take(3, naturals()))).toEqual([1, 2, 3]);
  });

  it('map and filter compose lazily over an infinite source', () => {
    const evenSquares = filter((x) => x % 2 === 0, map((x) => x * x, naturals()));
    expect(toArray(take(4, evenSquares))).toEqual([4, 16, 36, 64]);
  });

  it('passes the index to callbacks', () => {
    expect(toArray(map((v, i) => `${i}:${v}`, ['a', 'b']))).toEqual(['0:a', '1:b']);
    expect(toArray(filter((_, i) => i % 2 === 0, ['a', 'b', 'c']))).toEqual(['a', 'c']);
  });

  it('does no work until pulled', () => {
    const fn = jest.fn((x) => x);
    const lazy = map(fn, [1, 2, 3]);
    expect(fn).not.toHaveBeenCalled();
    lazy.next();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('processes one item at a time through the whole chain', () => {
    const log = [];
    const src = (function* () { for (const x of [1, 2, 3]) { log.push(`src ${x}`); yield x; } })();
    const out = map((x) => { log.push(`map ${x}`); return x; }, filter((x) => { log.push(`filter ${x}`); return true; }, src));
    toArray(out);
    expect(log.slice(0, 3)).toEqual(['src 1', 'filter 1', 'map 1']);
  });

  it('take does not pull an extra item from the source', () => {
    let pulled = 0;
    const src = (function* () { while (true) { pulled++; yield pulled; } })();
    toArray(take(3, src));
    expect(pulled).toBe(3);
  });

  it('take(0) pulls nothing', () => {
    let pulled = 0;
    const src = (function* () { while (true) { pulled++; yield pulled; } })();
    expect(toArray(take(0, src))).toEqual([]);
    expect(pulled).toBe(0);
  });

  it('closes upstream generators when take finishes early', () => {
    const cleanup = jest.fn();
    const src = (function* () { try { yield 1; yield 2; yield 3; } finally { cleanup(); } })();
    toArray(take(1, map((x) => x, src)));
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('works on any iterable', () => {
    expect(toArray(take(2, new Set([5, 6, 7])))).toEqual([5, 6]);
    expect(toArray(map((c) => c.toUpperCase(), 'abc'))).toEqual(['A', 'B', 'C']);
  });
});
```

%% worked
**A similar problem, solved: `takeWhile(pred, iterable)`** — a lazy operator that stops the moment the test fails.

```js
function* takeWhile(pred, iterable) {
  for (const x of iterable) {
    if (!pred(x)) return;      // ① stop immediately — and do NOT pull any more items
    yield x;
  }
}
```

The shape of every lazy operator is the same: `for (const x of iterable)` to pull, `yield` to hand out. **Early termination** comes for free: when the consumer stops (or your operator `return`s), JavaScript calls `return()` on the source generator, which runs its `finally` blocks.

The subtle bit in `take(n, …)`: check **after** yielding whether you have enough (`if (--n === 0) return;`), so you never ask the source for item `n + 1`. Also handle `n <= 0` *before* pulling anything. Pass `(value, index)` to `map`/`filter` callbacks by counting with your own `let i = 0`.

%% explain
- **`naturals()`** is infinite (`1, 2, 3, …`).
- **`map` / `filter`** are lazy and call the callback with `(value, index)`.
- **`take(n, it)`** yields the first `n` items and **does not consume item `n + 1`** from the source.
- **`toArray`** collects everything.
- **Early termination** propagates: when `take` finishes, upstream `finally` blocks run.

%% nudge
- In `take`, when exactly do you check whether you already have enough?
- Why does stopping a `for…of` over a generator run its `finally` block?

%% hints
- `for (const x of iterable)` inside a generator is the shortest way to consume the source and gives you cleanup on early exit for free.
- `take`: check `if (n <= 0) return;` **before** touching the source, and `return` immediately after yielding the n-th item, before asking for another.
- Keep a running `i` for the index argument.

%% solution
```js
export function* naturals() {
  let n = 1;
  while (true) yield n++;
}

export function* map(fn, iterable) {
  let i = 0;
  for (const x of iterable) yield fn(x, i++);
}

export function* filter(pred, iterable) {
  let i = 0;
  for (const x of iterable) if (pred(x, i++)) yield x;
}

export function* take(n, iterable) {
  if (n <= 0) return;
  let count = 0;
  for (const x of iterable) {
    yield x;
    if (++count >= n) return;
  }
}

export function toArray(iterable) {
  return [...iterable];
}
```

%% exercise iter-tree | Tree traversal with yield* | 2 | js | js | preorder, levelOrder | 15
A tree node is `{ value, children?: Node[] }`. Write two generators:

- `preorder(node)` — depth-first, parent before children, children left to right. Use `yield*` for the recursion.
- `levelOrder(node)` — breadth-first (all nodes of depth 0, then depth 1, …).

Both yield **values** and must be lazy (consuming just the first value must not walk the whole tree).

%% starter
```js
export function* preorder(node) {
  // your code
}

export function* levelOrder(node) {
  // your code
}
```

%% tests
```js
const tree = {
  value: 'root',
  children: [
    { value: 'a', children: [{ value: 'a1' }, { value: 'a2', children: [{ value: 'a2x' }] }] },
    { value: 'b' },
    { value: 'c', children: [{ value: 'c1' }] },
  ],
};

describe('preorder', () => {
  it('walks depth-first', () => {
    expect([...preorder(tree)]).toEqual(['root', 'a', 'a1', 'a2', 'a2x', 'b', 'c', 'c1']);
  });
  it('handles a leaf', () => expect([...preorder({ value: 1 })]).toEqual([1]));
  it('handles empty children', () => expect([...preorder({ value: 1, children: [] })]).toEqual([1]));
  it('is lazy', () => {
    let touched = 0;
    const spy = { get value() { touched++; return 'x'; }, children: [] };
    const root = { value: 'r', children: [spy, spy, spy] };
    const it = preorder(root);
    it.next();
    expect(touched).toBe(0);
  });
});

describe('levelOrder', () => {
  it('walks breadth-first', () => {
    expect([...levelOrder(tree)]).toEqual(['root', 'a', 'b', 'c', 'a1', 'a2', 'c1', 'a2x']);
  });
  it('handles a leaf', () => expect([...levelOrder({ value: 1 })]).toEqual([1]));
  it('is a generator (iterator protocol)', () => {
    const it = levelOrder(tree);
    expect(it.next()).toEqual({ value: 'root', done: false });
    expect(it.next()).toEqual({ value: 'a', done: false });
  });
});
```

%% worked
**A similar problem, solved: `leaves(node)`** — yields only the leaf values of a tree, using `yield*` to recurse.

```js
function* leaves(node) {
  if (!node.children || node.children.length === 0) {
    yield node.value;                         // ① a leaf: hand out its value
    return;
  }
  for (const child of node.children) {
    yield* leaves(child);                     // ② yield* = "yield everything the inner generator yields"
  }
}
```

`yield*` is what makes recursive generators short — without it you'd loop over the inner generator yourself. **`preorder`** is the same idea but yields the node's own value *first*, then `yield*`s each child.

**`levelOrder`** can't use simple recursion, because breadth-first means "all of depth 1, then all of depth 2". Use a **queue** instead: start with `[root]`, repeatedly take the first node (`queue.shift()`), `yield` its value, and push its children to the back.

%% explain
- **`preorder`**: parent first, then children left to right (depth-first).
- **`levelOrder`**: all nodes of depth 0, then depth 1, then depth 2, …
- **Both yield values** (not nodes).
- **Lazy**: taking only the first value must not walk the whole tree.

%% nudge
- For breadth-first, what data structure holds "the nodes I still have to visit, in order"?
- What goes first in `preorder`: the node's value or its children?

%% hints
- `preorder`: `yield node.value; for (const child of node.children ?? []) yield* preorder(child);`
- `levelOrder`: keep a queue array; `shift()` a node, `yield` its value, `push` its children.
- Watch out: reading `node.value` only when you yield keeps the traversal lazy.

%% solution
```js
export function* preorder(node) {
  yield node.value;
  for (const child of node.children ?? []) yield* preorder(child);
}

export function* levelOrder(node) {
  const queue = [node];
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    yield current.value;
    if (current.children) queue.push(...current.children);
  }
}
```

%% exercise iter-paginate | Async generator: paginate() | 4 | js | js | paginate | 22
An API returns data a page at a time: `fetchPage(cursor)` → `Promise<{ items: T[], next: string | null }>` (`cursor` is `undefined` for the first page).

Write the **async generator** `paginate(fetchPage)` that yields items one by one across all pages.

- Pages are fetched **lazily**: don't request page N+1 until the consumer has consumed all of page N.
- If the consumer stops early (`break`), no further pages are requested.
- A page with no items is fine (skip to the next one); `next: null` ends the stream.
- Errors from `fetchPage` reject the `for await` loop.

%% starter
```js
export async function* paginate(fetchPage) {
  // your code
}
```

%% tests
```js
const makeApi = (pages) => jest.fn(async (cursor) => {
  const i = cursor === undefined ? 0 : Number(cursor);
  const page = pages[i];
  return { items: page, next: i + 1 < pages.length ? String(i + 1) : null };
});

async function collect(asyncIterable) {
  const out = [];
  for await (const x of asyncIterable) out.push(x);
  return out;
}

describe('paginate', () => {
  it('yields every item across pages, in order', async () => {
    const api = makeApi([[1, 2], [3], [4, 5]]);
    expect(await collect(paginate(api))).toEqual([1, 2, 3, 4, 5]);
    expect(api).toHaveBeenCalledTimes(3);
  });

  it('starts with an undefined cursor and passes next cursors along', async () => {
    const api = makeApi([[1], [2]]);
    await collect(paginate(api));
    expect(api).toHaveBeenNthCalledWith(1, undefined);
    expect(api).toHaveBeenNthCalledWith(2, '1');
  });

  it('is lazy: does not fetch page 2 until page 1 is consumed', async () => {
    const api = makeApi([[1, 2], [3, 4]]);
    const it = paginate(api)[Symbol.asyncIterator]();
    await it.next();
    expect(api).toHaveBeenCalledTimes(1);
    await it.next();
    expect(api).toHaveBeenCalledTimes(1);
    await it.next();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('stops requesting pages when the consumer breaks', async () => {
    const api = makeApi([[1, 2], [3, 4], [5, 6]]);
    for await (const x of paginate(api)) { if (x === 2) break; }
    expect(api).toHaveBeenCalledTimes(1);
  });

  it('skips empty pages', async () => {
    const api = makeApi([[1], [], [], [2]]);
    expect(await collect(paginate(api))).toEqual([1, 2]);
  });

  it('handles a single empty page', async () => {
    expect(await collect(paginate(makeApi([[]])))).toEqual([]);
  });

  it('propagates fetch errors', async () => {
    const api = jest.fn().mockResolvedValueOnce({ items: [1], next: '1' }).mockRejectedValueOnce(new Error('network'));
    const seen = [];
    await expect((async () => { for await (const x of paginate(api)) seen.push(x); })()).rejects.toThrow('network');
    expect(seen).toEqual([1]);
  });

  it('is an async generator', () => {
    const g = paginate(makeApi([[1]]));
    expect(typeof g[Symbol.asyncIterator]).toBe('function');
    expect(typeof g.return).toBe('function');
  });
});
```

%% worked
**A similar problem, solved: `lines(chunks)`** — an async generator that turns async chunks into individual lines, lazily.

```js
async function* lines(nextChunk) {          // ① async function* = an async generator
  let rest = '';
  while (true) {
    const chunk = await nextChunk();        // ② it can AWAIT…
    if (chunk === null) break;
    const parts = (rest + chunk).split('\n');
    rest = parts.pop();                     // the last piece may be unfinished
    for (const line of parts) yield line;   // ③ …and YIELD, one line at a time
  }
  if (rest) yield rest;
}
```

The consumer reads it with `for await (const line of lines(...)) { … }`. The generator only continues — and only calls `nextChunk()` again — when the consumer asks for the next item. That's **backpressure** for free, and it's why `break` in the consumer stops the requests: the generator is simply never resumed.

For `paginate(fetchPage)` the loop is: start with `cursor = undefined`; `await fetchPage(cursor)`; `yield*` (or `for … yield`) each item of `page.items`; set `cursor = page.next`; stop when `next` is `null`. A page with no items just loops on to the next cursor.

%% explain
- **Yields items one by one** across all pages, in order.
- **Lazy**: page N+1 is not requested until all of page N has been consumed.
- **Early `break`** means no further pages are requested.
- **Empty pages** are skipped; `next: null` ends the stream.
- **Errors** from `fetchPage` reject the `for await` loop.

%% nudge
- Which value from the last response tells you whether there is another page?
- If the consumer breaks out, what stops your generator from asking for more?

%% hints
- `let cursor; do { const { items, next } = await fetchPage(cursor); yield* items; cursor = next; } while (cursor !== null);`
- `yield*` inside an async generator works with a plain array (it delegates item by item).
- Laziness is automatic: generator code only runs when the consumer pulls.

%% solution
```js
export async function* paginate(fetchPage) {
  let cursor;
  do {
    const { items, next } = await fetchPage(cursor);
    yield* items;
    cursor = next;
  } while (cursor !== null && cursor !== undefined);
}
```
