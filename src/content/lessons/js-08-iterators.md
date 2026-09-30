---
id: iterators
track: js
title: Iterators, generators & lazy pipelines
summary: The iteration protocol under `for…of`, spread and destructuring — and generators as coroutines.
---

## The protocol

Two tiny contracts power `for…of`, spread (`[...x]`), destructuring, `Array.from`, `Promise.all`, `Map`/`Set` constructors and more:

- An **iterable** has a method at `[Symbol.iterator]` that returns an iterator.
- An **iterator** has `next()` returning `{ value, done }`. Optionally `return()` (cleanup on early exit) and `throw()`.

```js
const countdown = {
  from: 3,
  [Symbol.iterator]() {
    let n = this.from;
    return {
      next: () => (n > 0 ? { value: n--, done: false } : { value: undefined, done: true }),
      return: () => { console.log('cleanup'); return { done: true }; },
    };
  },
};
[...countdown];              // [3, 2, 1]
for (const n of countdown) { if (n === 2) break; } // logs "cleanup"
const [first] = countdown;   // destructuring stops early → also calls return()
```

`return()` is invoked when the consumer **stops early** (`break`, `return`, a thrown error, or destructuring fewer items than exist) — never on normal exhaustion. It's how iterators release resources (file handles, subscriptions).

## Generators: iterators you write as functions

```js
function* range(start, end) {
  for (let i = start; i < end; i++) yield i;
}
[...range(0, 3)]; // [0, 1, 2]
```

A generator function returns an iterator that **pauses at each `yield`** and resumes on the next `next()`, keeping its local variables (a closure, again). Consequences:

- **Lazy by construction**: nothing runs until you pull. `range(0, 1e12)` costs nothing until consumed. You can model **infinite** sequences (`naturals()`).
- `yield*` delegates to another iterable — perfect for recursion (tree traversal).
- `next(v)` sends a value *into* the generator (the result of the `yield` expression) and `gen.return()` / `gen.throw()` run `finally` blocks. That two-way channel is the basis of older async libraries (`co`, redux-saga).

## Lazy pipelines

Array methods are **eager**: each step builds a whole new array. With generators you compose lazy steps and pull only what you need:

```js
const firstFive = take(5, filter(isPrime, naturals()));
```

Each item flows through the whole pipeline before the next one starts, memory stays O(1), and `take` stops the source as soon as it has enough. (`Iterator.prototype.map/filter/take` are now built into modern runtimes, but writing them yourself is how the model sticks.)

## Async iteration

`for await (const x of source)` consumes an **async iterable** (`[Symbol.asyncIterator]`, whose `next()` returns promises). **Async generators** (`async function*`) can both `await` and `yield` — the natural shape for paginated APIs, streams, and server-sent events:

```js
async function* readLines(stream) { /* yield line by line */ }
for await (const line of readLines(s)) { … }
```

Backpressure is free: the producer only advances when the consumer asks.

## Gotchas

- Iterators are usually **single-use**; an *iterable* gives you a fresh iterator each time.
- Spreading an infinite generator hangs your tab. Always `take`.
- `for…in` iterates *keys* (including inherited); `for…of` iterates *values* via the protocol. Objects aren't iterable by default.
- Errors thrown inside a generator propagate to the caller of `next()`.

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
