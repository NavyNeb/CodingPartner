---
id: arrays
track: js
title: Arrays, iteration & immutable updates
summary: The array toolkit (map, filter, reduce, sort) explained from scratch — plus why you copy instead of change, the habit React depends on.
---

## The idea in one sentence

Most everyday JavaScript is **"take a list, get another list (or one value) out of it"** — and arrays come with a method for each shape of answer.

> **Analogy** Think of a production line. `map` is a machine that changes every item that passes (paint it red). `filter` is a quality gate that lets only some items through. `reduce` is the packing station that squeezes everything into a single box. None of them touch the original pile — they hand you a *new* one.

![map keeps the length, filter keeps fewer, reduce makes one value](fig:array-toolkit "map transforms every item. filter keeps the items that pass a test. reduce folds everything into a single value.")

## Pick the method by the shape of the result

| You want | Use |
| --- | --- |
| Same number of items, each one changed | `map` |
| Fewer items (only some) | `filter` |
| One value (a sum, an object, a Map…) | `reduce` |
| Map, then flatten one level | `flatMap` |
| "Does any / every item match?" | `some` / `every` (they stop early) |
| The first match (or its position) | `find` / `findIndex` |
| Just do something for each item | `for…of` (or `forEach`) |

Each one takes a **callback**: a small function that JavaScript calls for every item. Try them:

```js try
const prices = [12, 5, 30, 8];

console.log(prices.map((p) => p * 2));         // every price doubled
console.log(prices.filter((p) => p > 10));     // only prices above 10
console.log(prices.reduce((sum, p) => sum + p, 0)); // the total
console.log(prices.find((p) => p < 10));       // the first price under 10
console.log(prices.some((p) => p > 25), prices.every((p) => p > 25));
```

### `reduce`, slowly

`reduce` is the one people find scary, so let's watch it work. It keeps a running result (the **accumulator**, usually called `acc`), and your callback says how to combine it with the next item.

```stepper reduce adds up a list
code:
  const total = [10, 20, 5].reduce((acc, n) => {
    return acc + n;
  }, 0);
---
line: 3
say: The `0` at the end is the **starting value** of `acc`. Nothing has been added yet.
acc (running result): 0
n (current item):
---
line: 1-2
say: First item: `n` is `10`. The callback returns `acc + n = 0 + 10`. Whatever it returns becomes the **next** `acc`.
acc (running result): 10
n (current item): 10
---
line: 1-2
say: Second item: `n` is `20`. `acc` is now `10`, so the callback returns `10 + 20`.
acc (running result): 30
n (current item): 20
---
line: 1-2
say: Third item: `n` is `5`. `30 + 5 = 35`.
acc (running result): 35
n (current item): 5
---
line: 1
say: No items left. The final `acc` is what `reduce` returns, so `total` is `35`.
acc (running result): 35 (final)
n (current item):
```

`reduce` can build anything — not just numbers. Here it counts how many orders each customer placed:

```js try
const orders = ['ada', 'grace', 'ada', 'linus', 'ada'];

const counts = orders.reduce((acc, name) => {
  acc[name] = (acc[name] ?? 0) + 1;   // "?? 0" means: start at 0 the first time we see a name
  return acc;                          // ← don't forget this line!
}, {});

console.log(counts);
```

Two classic `reduce` mistakes: **forgetting the starting value** (the first item becomes `acc`, and an empty array throws an error) and **forgetting to `return acc`** (the next round gets `undefined`).

### The callback receives more than the item

Callbacks get `(value, index, array)`. That can bite you:

```js try predict
console.log(['1', '2', '3'].map(parseInt));
```

`parseInt(string, radix)` takes a second argument, and `map` helpfully passes the **index** there: `parseInt('2', 1)` is `NaN`. Wrap it so you control the arguments: `.map((s) => parseInt(s, 10))`.

## Changing vs copying

Some array methods **change the array itself** ("mutate"), others **return a new one**:

| Changes the original | Returns a new array |
| --- | --- |
| `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill` | `map`, `filter`, `slice`, `concat`, `flat`, spread `[...a]`, `toSorted`, `toReversed`, `toSpliced`, `with` |

```js try predict
const a = [1, 2, 3];
const b = a;          // NOT a copy: both names point at the same array
b.push(4);
console.log(a);

const c = [...a];     // a real (shallow) copy
c.push(5);
console.log(a, c);
```

Why care? In React, Redux, and anywhere else that decides "did it change?" by comparing **identity** (`===`), you must **never mutate — always build a new array**. The four everyday moves:

```js
const add    = [...items, item];                                        // add to the end
const remove = items.filter((x) => x.id !== id);                        // remove one
const update = items.map((x) => (x.id === id ? { ...x, done: true } : x)); // change one
const insert = [...items.slice(0, i), item, ...items.slice(i)];        // insert at position i
```

### But the copy is *shallow*

`[...items]` makes a **new array**, but the objects **inside** are still the very same objects:

![Copying with spread creates a new array that still points at the same objects](fig:shallow-copy "Two arrays, one set of objects. Changing an object through either array changes it for both.")

That's why the `update` line above builds a **new object** (`{ ...x, done: true }`) instead of writing `x.done = true`.

## Sorting: three gotchas

```js try predict
console.log([10, 9, 1].sort());
console.log([10, 9, 1].sort((a, b) => a - b));
```

![Default sort compares as text and gives 1,10,9; a comparator gives 1,9,10](fig:sort-default "Without a comparator, `sort` turns numbers into text first.")

1. **No comparator = sorted as text.** Always pass one for numbers: `(a, b) => a - b`. For text use `a.localeCompare(b)`.
2. The comparator must return a **number** (negative = `a` first, positive = `b` first, `0` = equal). Never return `true`/`false`.
3. `sort` **changes the array in place**. Copy first (`[...arr].sort(...)`) or use `toSorted(...)`. Since ES2019 it is **stable**: items that compare equal keep their original order — that's what makes "sort by several columns" work.

## Speed: `includes` inside a loop is a trap

`includes`, `indexOf` and `find` look at items one by one — **O(n)**. Put one inside a loop over *n* items and you get O(n²): 10,000 items means up to 100,000,000 checks. A `Set` or `Map` answers "have I seen this?" in one step (**O(1)**), so the loop becomes O(n):

```js try
const items = ['a', 'b', 'a', 'c', 'b'];

const seen = new Set();
const duplicates = items.filter((x) => {
  if (seen.has(x)) return true;   // seen before → keep it in the "duplicates" list
  seen.add(x);
  return false;
});

console.log(duplicates);
```

This "swap the inner loop for a Set/Map" move is the most common interview optimisation.

## Quick check

```check
Q: You have a list of users and want only the admins. Which method?
A) `map`
B) `reduce` (nothing else can do it)
C) `filter` *
D) `find`
Why: You want fewer items, possibly several, so `filter`. `find` returns only the first match and `map` keeps the same length.
---
Q: What does `['10', '10', '10'].map(parseInt)` return?
A) `[10, NaN, 2]` *
B) `[10, 10, 10]`
C) `[NaN, NaN, NaN]`
D) It throws an error
Why: `map` passes `(value, index)`, so the calls are `parseInt('10', 0)`, `parseInt('10', 1)`, `parseInt('10', 2)`, which give 10, NaN and 2.
---
Q: `const copy = [...todos]; copy[0].done = true;` — what happens to `todos[0].done`?
A) Nothing; the copy is independent
B) It throws because the array is frozen
C) It becomes `undefined`
D) It becomes `true` too, because both arrays share the same object *
Why: Spread is a shallow copy: the array is new, the objects inside are the same references.
---
Q: What is `[1, 10, 2].sort()`?
A) `[1, 2, 10]`
B) `[1, 10, 2]` *
C) `[10, 2, 1]`
D) `[2, 10, 1]`
Why: With no comparator, numbers are compared as text: "1" < "10" < "2".
---
Q: What happens with `[].reduce((a, b) => a + b)` (no starting value)?
A) It returns `0`
B) It returns `undefined`
C) It throws a `TypeError` *
D) It returns `[]`
Why: With no starting value, `reduce` uses the first item as the start. An empty array has none, so it throws. Pass a start value (`, 0`) to be safe.
```

## Recap

- Pick the method by the **shape of the answer**: `map` (same length), `filter` (fewer), `reduce` (one value), `find`/`some`/`every` (questions).
- `reduce` = a running **accumulator**; always give it a starting value and always `return` it.
- Callbacks get `(value, index, array)` — mind `parseInt`.
- `push/pop/splice/sort/reverse` **change** the array; `map/filter/slice/spread/toSorted` **return new** ones. In React-style code, never mutate.
- Copies are **shallow**: to change an item, replace it with a new object.
- `sort()` without a comparator sorts as **text**; comparator returns a **number**; `sort` mutates; it's stable.
- `includes` in a loop is O(n²); use a `Set`/`Map` to make it O(n).

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: double the evens | `filter` then `map` |
| `chunk` & `zip` | A `for` loop with a step; `Math.min` for the shortest length |
| Immutable list updates | "Changing vs copying": `slice`, spread, `filter`, `map` |
| `map`, `filter`, `reduce` from scratch | The callback signature `(value, index, array)` and how `reduce` and its start value work |
| `groupBy` & `countBy` | `reduce` building an object |
| `flatten` with depth | Arrays inside arrays; a loop with a "to do" list instead of recursion |
| Multi-key `sortBy` | Sorting: comparators, stability, copying before sorting |

%% exercise arrays-guided-double-evens | Guided: double the evens | 1 | js | js | doubleEvens | 5 | guided
Write `doubleEvens(nums)`. It returns a **new** array containing only the even numbers from `nums`, each one doubled.

```js
doubleEvens([1, 2, 3, 4]); // [4, 8]   (2 and 4 are even → 4 and 8)
doubleEvens([1, 3]);       // []
```

The skeleton walks you through it: first `filter`, then `map`.

%% worked
**A similar problem, solved: `squaresOfOdds(nums)`** — the squares of the odd numbers.

```js
function squaresOfOdds(nums) {
  return nums
    .filter((n) => n % 2 !== 0)   // ① keep only the ones that pass the test (fewer items)
    .map((n) => n * n);           // ② change each remaining item (same length as step ①)
}

squaresOfOdds([1, 2, 3, 4, 5]); // [1, 9, 25]
```

`filter` and `map` each return a **new** array, so you can chain them like a production line, and the original `nums` is never touched. `n % 2` is the remainder after dividing by 2: `0` for even numbers, `1` for odd ones.

%% explain
- **Only evens survive**, in their original order.
- **Each one is doubled.**
- **Empty or all-odd input** gives `[]`.
- **The input array is not changed** (tests compare it afterwards).

%% nudge
- Do you need to drop some items, change items, or both? In which order?
- What is `n % 2` for an even number?

%% starter
```js
export function doubleEvens(nums) {
  // Step 1 — keep only the even numbers:   nums.filter((n) => n % 2 === 0)
  // Step 2 — double each one by chaining:  .map((n) => n * 2)
  // Step 3 — return the final array.
  return [];
}
```

%% tests
```js
describe('doubleEvens', () => {
  it('doubles the even numbers', () => {
    expect(doubleEvens([1, 2, 3, 4])).toEqual([4, 8]);
  });

  it('keeps the original order', () => {
    expect(doubleEvens([6, 2, 4])).toEqual([12, 4, 8]);
  });

  it('returns an empty array when there are no evens', () => {
    expect(doubleEvens([1, 3, 5])).toEqual([]);
    expect(doubleEvens([])).toEqual([]);
  });

  it('handles zero and negatives', () => {
    expect(doubleEvens([0, -2, -3])).toEqual([0, -4]);
  });

  it('does not change its input', () => {
    const input = [1, 2, 3, 4];
    doubleEvens(input);
    expect(input).toEqual([1, 2, 3, 4]);
  });
});
```

%% hints
- Start with `nums.filter(...)`.
- Then chain `.map(...)` straight onto it.
- Return the whole chain.

%% solution
```js
export function doubleEvens(nums) {
  return nums.filter((n) => n % 2 === 0).map((n) => n * 2);
}
```

%% exercise arrays-chunk-zip | chunk & zip | 1 | js | js | chunk, zip | 8
Two small utilities.

- `chunk(array, size)` splits into groups of `size` (the last may be shorter). `size` ≤ 0 throws a `RangeError`.
- `zip(...arrays)` pairs items by index: `zip([1,2],['a','b'])` → `[[1,'a'],[2,'b']]`. The result is as long as the **shortest** input.

Neither may mutate its inputs.

%% starter
```js
export function chunk(array, size) {
  // your code
}

export function zip(...arrays) {
  // your code
}
```

%% tests
```js
describe('chunk', () => {
  it('splits evenly', () => expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]));
  it('keeps a shorter last chunk', () => expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
  it('handles size larger than the array', () => expect(chunk([1, 2], 10)).toEqual([[1, 2]]));
  it('handles an empty array', () => expect(chunk([], 3)).toEqual([]));
  it('rejects a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], -1)).toThrow(RangeError);
  });
  it('does not mutate the input', () => {
    const src = [1, 2, 3];
    chunk(src, 2);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe('zip', () => {
  it('pairs by index', () => expect(zip([1, 2], ['a', 'b'])).toEqual([[1, 'a'], [2, 'b']]));
  it('stops at the shortest input', () => expect(zip([1, 2, 3], ['a'])).toEqual([[1, 'a']]));
  it('supports more than two arrays', () => expect(zip([1, 2], [3, 4], [5, 6])).toEqual([[1, 3, 5], [2, 4, 6]]));
  it('returns [] with no arguments', () => expect(zip()).toEqual([]));
});
```

%% worked
**A similar problem, solved: `pairUp(array)`** — groups items in twos: `[1,2,3,4,5]` → `[[1,2],[3,4],[5]]`.

```js
function pairUp(array) {
  const out = [];
  for (let i = 0; i < array.length; i += 2) {   // ① jump forward 2 at a time
    out.push(array.slice(i, i + 2));            // ② slice never goes past the end, so the last group can be short
  }
  return out;                                   // ③ a new array; `array` was only read
}
```

`chunk` is the same with `size` in place of `2` (plus a `RangeError` for `size <= 0`).

For `zip`, the new idea is "as long as the **shortest** array":

```js
function zip2(a, b) {
  const length = Math.min(a.length, b.length);  // ① the shorter one decides
  const out = [];
  for (let i = 0; i < length; i++) out.push([a[i], b[i]]);
  return out;
}
```

`zip(...arrays)` takes any number of arrays — the rest parameter `...arrays` collects them into one array, and `Math.min(...arrays.map((a) => a.length))` finds the shortest.

%% explain
- **`chunk`** splits into groups of `size`, the last group may be shorter; `size <= 0` throws a `RangeError`.
- **`zip`** pairs items by position and stops at the **shortest** input.
- **Empty inputs** give empty results.
- **Inputs are never changed.**

%% nudge
- In `chunk`, how far should the loop counter jump each turn?
- In `zip`, which array decides how many pairs there are?

%% hints
- `chunk`: loop with `i += size` and `slice(i, i + size)`.
- `zip`: the length is `Math.min(...arrays.map((a) => a.length))`; `Array.from({ length }, (_, i) => arrays.map((a) => a[i]))`.
- With no arrays, `Math.min()` is `Infinity` — handle it.

%% solution
```js
export function chunk(array, size) {
  if (!(size > 0)) throw new RangeError('size must be positive');
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

export function zip(...arrays) {
  if (!arrays.length) return [];
  const length = Math.min(...arrays.map((a) => a.length));
  return Array.from({ length }, (_, i) => arrays.map((a) => a[i]));
}
```

%% exercise arrays-immutable | Immutable list updates | 2 | js | js | insertAt, removeAt, moveItem, updateWhere | 12
These are the moves you make on React state every day. Each returns a **new** array and never touches the input (items you don't change keep their identity).

- `insertAt(list, index, item)`
- `removeAt(list, index)` — out-of-range index returns an equal copy.
- `moveItem(list, from, to)` — remove the item at `from`, then insert it so it ends up at index `to`.
- `updateWhere(list, predicate, patch)` — shallow-merge `patch` into every object matching `predicate`; other objects are the *same references*.

%% starter
```js
export function insertAt(list, index, item) {
  // your code
}

export function removeAt(list, index) {
  // your code
}

export function moveItem(list, from, to) {
  // your code
}

export function updateWhere(list, predicate, patch) {
  // your code
}
```

%% tests
```js
const frozen = (a) => Object.freeze([...a]);

describe('insertAt', () => {
  it('inserts in the middle', () => expect(insertAt(frozen([1, 2, 4]), 2, 3)).toEqual([1, 2, 3, 4]));
  it('inserts at the ends', () => {
    expect(insertAt(frozen([2]), 0, 1)).toEqual([1, 2]);
    expect(insertAt(frozen([1]), 1, 2)).toEqual([1, 2]);
  });
  it('returns a new array', () => {
    const a = frozen([1]);
    expect(insertAt(a, 0, 0)).not.toBe(a);
  });
});

describe('removeAt', () => {
  it('removes an item', () => expect(removeAt(frozen(['a', 'b', 'c']), 1)).toEqual(['a', 'c']));
  it('ignores out-of-range indexes', () => {
    const a = frozen([1, 2]);
    expect(removeAt(a, 5)).toEqual([1, 2]);
    expect(removeAt(a, -1)).toEqual([1, 2]);
  });
});

describe('moveItem', () => {
  it('moves forward', () => expect(moveItem(frozen(['a', 'b', 'c', 'd']), 0, 2)).toEqual(['b', 'c', 'a', 'd']));
  it('moves backward', () => expect(moveItem(frozen(['a', 'b', 'c', 'd']), 3, 1)).toEqual(['a', 'd', 'b', 'c']));
  it('does nothing when from === to', () => expect(moveItem(frozen([1, 2, 3]), 1, 1)).toEqual([1, 2, 3]));
});

describe('updateWhere', () => {
  const list = Object.freeze([{ id: 1, done: false }, { id: 2, done: false }, { id: 3, done: true }]);
  it('patches only matching items', () => {
    const out = updateWhere(list, (x) => x.id === 2, { done: true });
    expect(out).toEqual([{ id: 1, done: false }, { id: 2, done: true }, { id: 3, done: true }]);
  });
  it('keeps identity of untouched items and does not mutate the originals', () => {
    const out = updateWhere(list, (x) => x.id === 2, { done: true });
    expect(out[0]).toBe(list[0]);
    expect(out[2]).toBe(list[2]);
    expect(out[1]).not.toBe(list[1]);
    expect(list[1].done).toBe(false);
  });
});
```

%% worked
**A similar problem, solved: `replaceAt(list, index, item)` and `swap(list, i, j)`** — both return new arrays.

```js
function replaceAt(list, index, item) {
  return [...list.slice(0, index), item, ...list.slice(index + 1)];
  //       ① everything before   ② the new item   ③ everything after the old one
}

function swap(list, i, j) {
  const copy = [...list];          // ① make a copy FIRST so the original is untouched
  [copy[i], copy[j]] = [copy[j], copy[i]];   // ② swap two items using destructuring
  return copy;
}
```

Notice the two styles: **build from slices** (great for insert/remove/replace) or **copy, then change the copy** (great for moves and swaps). Both leave the input alone.

For `updateWhere`, use `map`: return `{ ...item, ...patch }` for matches and the **same `item`** for everything else (so unchanged items keep their identity). `moveItem` = remove the item at `from`, then insert it at `to`.

%% explain
- **New arrays every time**: the input is never mutated.
- **`insertAt` / `removeAt`** put in or take out the right position; an out-of-range `removeAt` returns an equal copy.
- **`moveItem`** ends with the item at index `to`.
- **`updateWhere`** merges the patch into matching objects only; other objects are the *same references* (tests check identity with `toBe`).

%% nudge
- Which of `splice` / `slice` changes the original? Which one is safe?
- For `updateWhere`, what should you return for items that *don't* match?

%% hints
- `slice` never mutates; `[...a.slice(0, i), item, ...a.slice(i)]`.
- `moveItem`: `const next = removeAt(list, from)`, then `insertAt(next, to, list[from])`.
- `updateWhere` is `map` with a ternary that either spreads or returns the original.

%% solution
```js
export function insertAt(list, index, item) {
  return [...list.slice(0, index), item, ...list.slice(index)];
}

export function removeAt(list, index) {
  if (index < 0 || index >= list.length) return [...list];
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

export function moveItem(list, from, to) {
  if (from === to) return [...list];
  return insertAt(removeAt(list, from), to, list[from]);
}

export function updateWhere(list, predicate, patch) {
  return list.map((item) => (predicate(item) ? { ...item, ...patch } : item));
}
```

%% exercise arrays-hof | map, filter & reduce from scratch | 2 | js | js | myMap, myFilter, myReduce | 15
Implement the three workhorses **without** calling the native `map`, `filter` or `reduce`.

- Callbacks receive `(value, index, array)`.
- `myReduce(array, fn, initial?)`: if `initial` is **not provided** (check `arguments.length`), start from the first element and iterate from index 1. An empty array with no initial value throws a `TypeError`.
- Holes in sparse arrays are skipped (`i in array`).
- Results are new arrays; the input is untouched.

%% starter
```js
export function myMap(array, fn) {
  // your code
}

export function myFilter(array, fn) {
  // your code
}

export function myReduce(array, fn, initial) {
  // your code
}
```

%% tests
```js
describe('myMap', () => {
  it('maps values', () => expect(myMap([1, 2, 3], (x) => x * 2)).toEqual([2, 4, 6]));
  it('passes (value, index, array)', () => {
    const src = ['a', 'b'];
    const spy = jest.fn((v) => v);
    myMap(src, spy);
    expect(spy).toHaveBeenNthCalledWith(1, 'a', 0, src);
    expect(spy).toHaveBeenNthCalledWith(2, 'b', 1, src);
  });
  it('skips holes but preserves length', () => {
    const out = myMap([1, , 3], (x) => x + 1);
    expect(out.length).toBe(3);
    expect(1 in out).toBe(false);
  });
  it('does not use native map', () => {
    const orig = Array.prototype.map;
    Array.prototype.map = () => { throw new Error('native map used'); };
    let out;
    try { out = myMap([1], (x) => x); } finally { Array.prototype.map = orig; }
    expect(out).toEqual([1]);
  });
});

describe('myFilter', () => {
  it('keeps matching items', () => expect(myFilter([1, 2, 3, 4], (x) => x % 2 === 0)).toEqual([2, 4]));
  it('passes the index', () => expect(myFilter(['a', 'b', 'c'], (_, i) => i !== 1)).toEqual(['a', 'c']));
  it('returns a new array', () => {
    const src = [1];
    expect(myFilter(src, () => true)).not.toBe(src);
  });
  it('does not use native filter', () => {
    const orig = Array.prototype.filter;
    Array.prototype.filter = () => { throw new Error('native filter used'); };
    let out;
    try { out = myFilter([1, 2], (x) => x > 1); } finally { Array.prototype.filter = orig; }
    expect(out).toEqual([2]);
  });
});

describe('myReduce', () => {
  it('reduces with an initial value', () => expect(myReduce([1, 2, 3], (a, x) => a + x, 10)).toBe(16));
  it('uses the first element when no initial value is given', () => {
    const spy = jest.fn((a, x) => a + x);
    expect(myReduce([1, 2, 3], spy)).toBe(6);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 1, 2, 1, [1, 2, 3]);
  });
  it('treats an explicit undefined initial value as provided', () => {
    expect(myReduce([1], (a, x) => [a, x], undefined)).toEqual([undefined, 1]);
  });
  it('returns the initial value for an empty array', () => expect(myReduce([], (a) => a, 'init')).toBe('init'));
  it('throws on an empty array without an initial value', () => {
    expect(() => myReduce([], (a) => a)).toThrow(TypeError);
  });
  it('can build objects', () => {
    expect(myReduce(['a', 'b'], (acc, k, i) => ({ ...acc, [k]: i }), {})).toEqual({ a: 0, b: 1 });
  });
});
```

%% worked
**A similar problem, solved: `myForEach(array, fn)`** — it shows the three details the exercise needs: the callback arguments, skipping holes, and not touching the input.

```js
function myForEach(array, fn) {
  for (let i = 0; i < array.length; i++) {
    if (i in array) {                 // ① skip "holes" in sparse arrays like [1, , 3]
      fn(array[i], i, array);         // ② callbacks get (value, index, array)
    }
  }
}
```

For `myReduce` the new part is the **optional starting value**. You can't use `if (initial === undefined)` because `undefined` could be a real starting value. Count the arguments instead:

```js
function myReduce(array, fn, initial) {
  let i = 0;
  let acc;
  if (arguments.length >= 3) {
    acc = initial;                    // a start value was given (even if it's undefined)
  } else {
    while (i < array.length && !(i in array)) i++;   // find the first real item
    if (i >= array.length) throw new TypeError('Reduce of empty array with no initial value');
    acc = array[i++];                 // the first item becomes the accumulator
  }
  for (; i < array.length; i++) if (i in array) acc = fn(acc, array[i], i, array);
  return acc;
}
```

%% explain
- **Callbacks get `(value, index, array)`**.
- **`myMap` / `myFilter`** return new arrays and leave the input untouched.
- **`myReduce` without a start value** begins with the first element; an empty array then throws a `TypeError`.
- **Holes** in sparse arrays are skipped.
- **No cheating**: the tests check that native `map`/`filter`/`reduce` are not called.

%% nudge
- How can you tell "no initial value passed" from "initial value is `undefined`"?
- What does `i in array` tell you about a hole?

%% hints
- A plain `for` loop with `if (!(i in array)) continue;`.
- `myReduce(array, fn, initial)` — `arguments.length >= 3` tells you if `initial` was passed. Arrow functions don't have `arguments`, so keep this a regular function.
- Sparse `map` result: `const out = new Array(array.length)` and assign only where present.

%% solution
```js
export function myMap(array, fn) {
  const out = new Array(array.length);
  for (let i = 0; i < array.length; i++) {
    if (i in array) out[i] = fn(array[i], i, array);
  }
  return out;
}

export function myFilter(array, fn) {
  const out = [];
  for (let i = 0; i < array.length; i++) {
    if (i in array && fn(array[i], i, array)) out.push(array[i]);
  }
  return out;
}

export function myReduce(array, fn, initial) {
  let i = 0;
  let acc = initial;
  if (arguments.length < 3) {
    while (i < array.length && !(i in array)) i++;
    if (i >= array.length) throw new TypeError('Reduce of empty array with no initial value');
    acc = array[i++];
  }
  for (; i < array.length; i++) {
    if (i in array) acc = fn(acc, array[i], i, array);
  }
  return acc;
}
```

%% exercise arrays-group-by | groupBy & countBy | 2 | js | js | groupBy, countBy | 10
- `groupBy(items, key)` returns an object mapping each key to the array of items with that key. `key` is either a property name (`'role'`) or a function `(item) => key`.
- `countBy(items, key)` does the same but with counts.
- Items keep their original relative order inside each group.
- Keys like `constructor`, `toString` and `__proto__` must work as ordinary keys.

%% starter
```js
export function groupBy(items, key) {
  // your code
}

export function countBy(items, key) {
  // your code
}
```

%% tests
```js
const people = [
  { name: 'Ada', role: 'eng' },
  { name: 'Grace', role: 'admiral' },
  { name: 'Linus', role: 'eng' },
];

describe('groupBy', () => {
  it('groups by property name', () => {
    expect(groupBy(people, 'role')).toEqual({
      eng: [people[0], people[2]],
      admiral: [people[1]],
    });
  });
  it('groups by function', () => {
    expect(groupBy([1, 2, 3, 4, 5], (n) => (n % 2 ? 'odd' : 'even'))).toEqual({ odd: [1, 3, 5], even: [2, 4] });
  });
  it('returns {} for an empty list', () => expect(groupBy([], 'x')).toEqual({}));
  it('handles keys that collide with Object.prototype', () => {
    const out = groupBy([{ k: 'constructor' }, { k: '__proto__' }, { k: 'toString' }], 'k');
    expect(Object.keys(out).sort()).toEqual(['__proto__', 'constructor', 'toString']);
    expect(out.constructor).toEqual([{ k: 'constructor' }]);
  });
  it('keeps the same item references', () => {
    expect(groupBy(people, 'role').eng[0]).toBe(people[0]);
  });
});

describe('countBy', () => {
  it('counts by property', () => expect(countBy(people, 'role')).toEqual({ eng: 2, admiral: 1 }));
  it('counts by function', () => expect(countBy(['a', 'bb', 'cc'], (s) => s.length)).toEqual({ 1: 1, 2: 2 }));
  it('handles prototype-named keys', () => {
    expect(countBy(['constructor', 'constructor'], (x) => x).constructor).toBe(2);
  });
});
```

%% worked
**A similar problem, solved: `indexBy(items, key)`** — builds a lookup object from a list (`[{id:1,…}]` → `{1: {id:1,…}}`).

```js
function indexBy(items, key) {
  const getKey = typeof key === 'function' ? key : (item) => item[key];   // ① accept a name OR a function
  const out = Object.create(null);        // ② an object with NO prototype: keys like "constructor" are safe
  for (const item of items) {
    out[getKey(item)] = item;             // ③ later items with the same key overwrite earlier ones
  }
  return out;
}
```

`groupBy` adds one idea: instead of overwriting, **push** into an array for that key (create it the first time):

```js
(out[k] ??= []).push(item);   // "if there's no array yet, make one, then push"
```

`countBy` is the same with `out[k] = (out[k] ?? 0) + 1`. A plain `{}` has inherited keys (`toString`, `__proto__`…), which is why the test with those key names is a trap — `Object.create(null)` or a `Map` avoids it.

%% explain
- **`groupBy`** maps each key to the array of matching items; the key is a **property name** or a **function**.
- **`countBy`** does the same with counts.
- **Order inside each group** matches the original order.
- **Tricky keys** like `constructor`, `toString` and `__proto__` behave as ordinary keys.

%% nudge
- What should happen the *first* time you see a key?
- Why might a plain `{}` misbehave with the key `"constructor"`?

%% hints
- Resolve the key function once: `const fn = typeof key === 'function' ? key : (x) => x[key]`.
- A plain `{}` already has `constructor` on its prototype, so `acc[k] ??= []` is wrong for that key. Start from `Object.create(null)`.
- `toEqual` ignores the prototype, so a null-prototype result still equals `{ … }`.

%% solution
```js
function keyFn(key) {
  return typeof key === 'function' ? key : (item) => item[key];
}

export function groupBy(items, key) {
  const get = keyFn(key);
  const out = Object.create(null);
  for (const item of items) {
    const k = get(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

export function countBy(items, key) {
  const get = keyFn(key);
  const out = Object.create(null);
  for (const item of items) {
    const k = get(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
```

%% exercise arrays-flatten | flatten with depth | 3 | js | js | flatten | 12
Implement `flatten(array, depth = 1)` **without** `Array.prototype.flat`.

- `depth` levels of nesting are flattened; `Infinity` flattens everything.
- `depth = 0` returns a shallow copy.
- Only real arrays are flattened (strings, objects and array-likes are left alone).
- Holes are dropped, like the native `flat`.
- Must not blow the call stack on 10 000 levels of nesting **when `depth` is `Infinity`**. (Hint: iterate, don't recurse.)

%% starter
```js
export function flatten(array, depth = 1) {
  // your code
}
```

%% tests
```js
describe('flatten', () => {
  it('flattens one level by default', () => {
    expect(flatten([1, [2, [3, [4]]]])).toEqual([1, 2, [3, [4]]]);
  });
  it('flattens to a given depth', () => {
    expect(flatten([1, [2, [3, [4]]]], 2)).toEqual([1, 2, 3, [4]]);
  });
  it('flattens everything with Infinity', () => {
    expect(flatten([1, [2, [3, [4, [5]]]]], Infinity)).toEqual([1, 2, 3, 4, 5]);
  });
  it('depth 0 is a shallow copy', () => {
    const src = [1, [2]];
    const out = flatten(src, 0);
    expect(out).toEqual([1, [2]]);
    expect(out).not.toBe(src);
  });
  it('leaves strings and objects alone', () => {
    expect(flatten(['ab', { a: [1] }, [['c']]], Infinity)).toEqual(['ab', { a: [1] }, 'c']);
  });
  it('drops holes', () => {
    expect(flatten([1, , [2, , 3]], Infinity)).toEqual([1, 2, 3]);
  });
  it('keeps order', () => {
    expect(flatten([[1, 2], [3], [[4], 5]], Infinity)).toEqual([1, 2, 3, 4, 5]);
  });
  it('survives very deep nesting', () => {
    let deep = [1];
    for (let i = 0; i < 10000; i++) deep = [deep];
    expect(flatten(deep, Infinity)).toEqual([1]);
  });
  it('does not use native flat', () => {
    const orig = Array.prototype.flat;
    Array.prototype.flat = () => { throw new Error('native flat used'); };
    let out;
    try { out = flatten([[1]], 1); } finally { Array.prototype.flat = orig; }
    expect(out).toEqual([1]);
  });
});
```

%% worked
**A similar problem, solved: `flattenAll(array)`** — flatten everything, without recursion, using a "to do" stack.

```js
function flattenAll(array) {
  const stack = [...array];            // ① the to-do list, starting with all items
  const out = [];
  while (stack.length) {
    const item = stack.pop();          // ② take the LAST item
    if (Array.isArray(item)) {
      stack.push(...item);             // ③ an array? put its items back on the to-do list
    } else {
      out.push(item);                  // ④ a plain value? it's part of the result
    }
  }
  return out.reverse();                // ⑤ we took items from the end, so flip the order back
}
```

A loop with its own stack never grows the call stack, so 10,000 levels of nesting is fine. For `depth`, keep **the level along with each item** — push pairs like `[item, depth]` — and only open an array while its remaining depth is above 0. Holes in the input are skipped automatically by `for…of` only if you check `i in array`; when spreading with `push(...item)` holes become `undefined`, so iterate with an index and `in` instead.

%% explain
- **`depth` levels** are flattened; `Infinity` flattens everything; `0` gives a shallow copy.
- **Only real arrays** are opened (strings, objects, array-likes stay as they are).
- **Holes are dropped**, like native `flat`.
- **Deep nesting** (10,000 levels, `depth = Infinity`) must not overflow the call stack.

%% nudge
- What data structure can replace the call stack so you don't need recursion?
- How do you remember how many levels you may still open for each item?

%% hints
- Recursion is the obvious version. It's fine for small depth, but 10 000 frames deep it will overflow.
- Iterative version: keep an explicit stack of `[value, remainingDepth]` pairs, pushing items in reverse so they pop in order.
- Skip holes with `i in array` when you expand an array onto the stack.

%% solution
```js
export function flatten(array, depth = 1) {
  const out = [];
  const stack = [];
  for (let i = array.length - 1; i >= 0; i--) {
    if (i in array) stack.push([array[i], depth]);
  }
  while (stack.length) {
    const [value, d] = stack.pop();
    if (Array.isArray(value) && d > 0) {
      for (let i = value.length - 1; i >= 0; i--) {
        if (i in value) stack.push([value[i], d - 1]);
      }
    } else {
      out.push(value);
    }
  }
  return out;
}
```

%% exercise arrays-sort-by | Multi-key stable sortBy | 3 | js | js | sortBy | 20
Write `sortBy(items, ...keys)` returning a **new** sorted array.

- Each key is a property name (`'age'`), a property name prefixed with `-` for descending (`'-age'`), or a function `(item) => value` (ascending).
- Earlier keys take priority; later keys break ties.
- Numbers compare numerically, strings with `localeCompare`; `null`/`undefined` sort **last** regardless of direction.
- The sort must be **stable** and must not mutate the input.

%% starter
```js
export function sortBy(items, ...keys) {
  // your code
}
```

%% tests
```js
const people = [
  { name: 'Cy', age: 30, team: 'b' },
  { name: 'Al', age: 25, team: 'a' },
  { name: 'Bo', age: 30, team: 'a' },
  { name: 'Di', age: 25, team: 'b' },
];
const names = (l) => l.map((p) => p.name);

describe('sortBy', () => {
  it('sorts ascending by one key', () => {
    expect(names(sortBy(people, 'age'))).toEqual(['Al', 'Di', 'Cy', 'Bo']);
  });
  it('is stable for equal keys', () => {
    expect(names(sortBy(people, 'team'))).toEqual(['Al', 'Bo', 'Cy', 'Di']);
  });
  it('supports descending with a - prefix', () => {
    expect(names(sortBy(people, '-age'))).toEqual(['Cy', 'Bo', 'Al', 'Di']);
  });
  it('breaks ties with later keys', () => {
    expect(names(sortBy(people, 'team', '-age', 'name'))).toEqual(['Bo', 'Al', 'Cy', 'Di']);
  });
  it('accepts functions', () => {
    expect(names(sortBy(people, (p) => p.name.toLowerCase().charCodeAt(1)))).toEqual(['Al', 'Bo', 'Cy', 'Di'].sort((a, b) => a.charCodeAt(1) - b.charCodeAt(1)));
  });
  it('compares numbers numerically, not as strings', () => {
    expect(sortBy([{ n: 10 }, { n: 9 }, { n: 1 }], 'n').map((x) => x.n)).toEqual([1, 9, 10]);
  });
  it('compares strings with localeCompare', () => {
    expect(sortBy([{ s: 'b' }, { s: 'A' }, { s: 'a' }], 's').map((x) => x.s)).toEqual(['a', 'A', 'b']);
  });
  it('puts null/undefined last in both directions', () => {
    const list = [{ v: 2 }, { v: null }, { v: 1 }, {}];
    expect(sortBy(list, 'v').map((x) => x.v ?? null)).toEqual([1, 2, null, null]);
    expect(sortBy(list, '-v').map((x) => x.v ?? null)).toEqual([2, 1, null, null]);
  });
  it('does not mutate the input', () => {
    const src = Object.freeze([...people]);
    const out = sortBy(src, 'age');
    expect(out).not.toBe(src);
    expect(names(src)).toEqual(['Cy', 'Al', 'Bo', 'Di']);
  });
  it('with no keys returns a copy in the same order', () => {
    expect(sortBy([3, 1, 2])).toEqual([3, 1, 2]);
  });
});
```

%% worked
**A similar problem, solved: `sortByAgeThenName(people)`** — two keys, ascending, without changing the input.

```js
function sortByAgeThenName(people) {
  return [...people].sort((a, b) =>        // ① copy first: sort() changes the array it is called on
    (a.age - b.age) ||                     // ② compare by age; if that's 0 (a tie) the || moves on…
    a.name.localeCompare(b.name)           // ③ …to the second key
  );
}
```

The `||` trick works because a tie returns `0`, which is falsy, so the next comparison is used. For `sortBy` build the comparator from the list of keys: for each key, compute both values, return early if they differ. Two extra rules from the exercise: **descending** just flips the sign (`-compare`), and **`null`/`undefined` go last in both directions**, so handle them *before* flipping the sign.

```js
function compare(x, y) {
  if (x == null && y == null) return 0;
  if (x == null) return 1;      // x goes after y
  if (y == null) return -1;
  return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
}
```

%% explain
- **New array**, input untouched.
- **Keys**: `'age'` (ascending), `'-age'` (descending), or a function `(item) => value`.
- **Earlier keys win**; later keys only break ties.
- **Numbers compare numerically, strings with `localeCompare`.**
- **`null`/`undefined` always last**, even for descending keys.
- **Stable**: items that tie on every key keep their original order.

%% nudge
- What does a comparator return when two items tie — and how can that help you chain keys?
- If the order is descending, should `null` still go last? Where do you apply the sign flip?

%% hints
- Normalise each key into `{ get, dir }` first: `'-age'` → `get: (x) => x.age`, `dir: -1`.
- Comparator: loop over keys; return the first non-zero result.
- Handle nullish **before** applying `dir`, so they stay last either way.
- `[...items].sort(cmp)` — native `sort` is stable in every modern engine.

%% solution
```js
function compileKey(key) {
  if (typeof key === 'function') return { get: key, dir: 1 };
  const desc = key.startsWith('-');
  const prop = desc ? key.slice(1) : key;
  return { get: (item) => item[prop], dir: desc ? -1 : 1 };
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  return String(a).localeCompare(String(b));
}

export function sortBy(items, ...keys) {
  const compiled = keys.map(compileKey);
  return [...items].sort((x, y) => {
    for (const { get, dir } of compiled) {
      const a = get(x);
      const b = get(y);
      const aNil = a == null;
      const bNil = b == null;
      if (aNil || bNil) {
        if (aNil && bNil) continue;
        return aNil ? 1 : -1;
      }
      const c = compareValues(a, b);
      if (c !== 0) return c * dir;
    }
    return 0;
  });
}
```
