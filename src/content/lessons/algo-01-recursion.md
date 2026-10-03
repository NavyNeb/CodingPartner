---
id: algo-recursion
track: algo
title: Recursion & divide and conquer
summary: Solving a problem by solving a smaller copy of it: the three beats of every recursive function, how the call stack works, why naive recursion can explode, and how splitting in half gives merge sort and fast exponentiation.
---

## The idea in one sentence

Recursion solves a problem by **handing a smaller copy of the same problem to itself**, until the problem is so small the answer is obvious.

> **Analogy** Russian nesting dolls. To count the dolls, open the biggest: if it's empty, the answer is 1. Otherwise the answer is **1 + however many are inside** — and "however many are inside" is the *same question*, asked of a smaller doll. You don't need to see all the dolls; you only need to trust the question gets smaller and eventually stops.

## The three beats

Every recursive function has the same three parts (you saw them with trees):

1. **Base case** — an input so small you can answer directly. *Without it, the function never stops.*
2. **Smaller problem** — call yourself on something strictly closer to the base case.
3. **Combine** — turn the smaller answer into the answer for the whole.

```js try predict
function factorial(n) {
  if (n === 0) return 1;              // ① base case
  return n * factorial(n - 1);        // ② a smaller problem, ③ combined with n
}
console.log(factorial(5), factorial(0));
```

The mental trick is to **trust the recursion**: assume `factorial(n - 1)` already works, and only ask "given that answer, what's mine?"

## The call stack

Each call waits for the call it made. The language remembers the waiting calls on the **call stack** — a real stack, as in the data-structures track.

![The call stack while computing factorial(3)](fig:alg-call-stack "Calls pile up until the base case returns; then the answers unwind back down.")

Two practical consequences:

- **Depth is limited** — roughly ten thousand frames in a browser. A recursion that goes 100 000 deep throws `RangeError: Maximum call stack size exceeded`. For very deep inputs, rewrite it as a loop with an explicit stack.
- **Forgetting the base case, or not shrinking the problem,** is the classic bug: the stack overflows.

```js try
function countDown(n) {
  if (n < 0) return 'done';           // base case: stop
  return countDown(n - 1);
}
console.log(countDown(1000));
try { countDown(1e7); } catch (e) { console.log(e instanceof RangeError ? 'stack overflow' : e); }
```

## Recursion on nested data

Recursion fits **nested** data (folders, JSON, the DOM, arrays of arrays) perfectly: the shape of the data *is* the shape of the calls.

```stepper Flattening [1, [2, [3]], 4]
code:
  function flatten(arr) {
    const out = [];
    for (const item of arr) {
      if (Array.isArray(item)) out.push(...flatten(item));
      else out.push(item);
    }
    return out;
  }
  flatten([1, [2, [3]], 4]);
---
line: 3-6
say: The outer call walks its items. `1` is not an array, so it goes straight into `out`.
stack: flatten([1,[2,[3]],4])
out (this call): 1
---
line: 4-5
say: The item `[2, [3]]` **is** an array: don't copy it, ask `flatten` to flatten it. A **new call** goes on top of the stack and the outer one waits.
stack: flatten([1,[2,[3]],4]) | flatten([2,[3]])
out (this call):
---
line: 6
say: Inside the new call, `2` is a plain value: it goes into this call's own `out`.
out (this call): 2
---
line: 4-5
say: The next item `[3]` is an array again: **another** call goes on the stack.
stack: flatten([1,[2,[3]],4]) | flatten([2,[3]]) | flatten([3])
out (this call):
---
line: 6-8
say: `3` goes in, the call finishes and returns `[3]`; its frame is popped off the stack.
stack: flatten([1,[2,[3]],4]) | flatten([2,[3]])
out (this call): 2 | 3
---
line: 8
say: `flatten([2,[3]])` returns `[2, 3]`, and the outer call spreads it into its own `out`.
stack: flatten([1,[2,[3]],4])
out (this call): 1 | 2 | 3
---
line: 6-8
say: Last item `4` is plain. The outer call returns the fully flat array. The depth of the recursion matched the depth of the nesting.
Result: [1, 2, 3, 4]
```

## When recursion explodes: overlapping subproblems

Recursion is not automatically fast. When a function calls itself **twice** and the calls overlap, the work can double at every level:

![The call tree of naive fib(4), with repeated calls highlighted](fig:alg-fib-tree "fib(2) is computed twice and fib(1) three times; the tree doubles each level, so naive Fibonacci is O(2ⁿ).")

```js try
let calls = 0;
function fib(n) { calls++; return n < 2 ? n : fib(n - 1) + fib(n - 2); }
console.log(fib(20), calls, 'calls');          // ~22 000 calls for one small number
const memo = new Map();
function fibMemo(n) {
  if (n < 2) return n;
  if (memo.has(n)) return memo.get(n);        // answered before? reuse it
  const v = fibMemo(n - 1) + fibMemo(n - 2);
  memo.set(n, v);
  return v;
}
console.log(fibMemo(80));                      // instant: each n is computed once
```

Remembering answers (**memoisation**) is the first step towards **dynamic programming**, which is its own pair of lessons later in this track.

## Divide and conquer

A powerful special case: **split the problem in half**, solve each half recursively, then **combine**. Because the problem halves each time, there are only about **log₂ n levels**.

### Merge sort

![Merge sort splitting 5 2 4 1 and merging back](fig:alg-merge-split "Divide until single items (already sorted), then merge sorted halves back up.")

The clever part is the **merge** of two already-sorted lists: keep a pointer in each and always take the smaller front item.

```stepper Merging [2, 5] and [1, 4]
code:
  function merge(a, b) {
    const out = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] <= b[j]) out.push(a[i++]);
      else out.push(b[j++]);
    }
    return out.concat(a.slice(i), b.slice(j));
  }
  merge([2, 5], [1, 4]);
---
line: 2-3
say: One pointer per list, both at the start, and an empty result.
i: 0
j: 0
out:
---
line: 4-7
say: Compare the two fronts: `2` vs `1`. `1` is smaller, so it goes first (from `b`), and `j` moves on.
i: 0
j: 1
out: 1
---
line: 4-7
say: Now `2` vs `4`. `2` is smaller (`a[i] <= b[j]`, which also keeps equal items in their original order: the sort is **stable**).
i: 1
j: 1
out: 1 | 2
---
line: 4-7
say: Now `5` vs `4`: `4` is smaller.
i: 1
j: 2
out: 1 | 2 | 4
---
line: 9
say: List `b` ran out. Whatever remains of `a` (`5`) is already sorted and larger than everything taken: append it. One pass over both lists: **O(n)**.
Result: [1, 2, 4, 5]
```

Merge sort splits into halves (log n levels) and every level merges all n items once, so it runs in **O(n log n)** — always, with no bad inputs. Written as a recurrence, `T(n) = 2·T(n/2) + O(n)`. The same shape (**split, solve halves, combine in linear time**) solves "count the inversions in an array" and many others.

### Fast exponentiation

The same halving idea computes `x` to the power `n` with about **log₂ n** multiplications instead of `n`: `x¹⁰ = (x⁵)²`, and `x⁵ = x · (x²)²`.

![pow(2, 10) via halving the exponent](fig:alg-fast-pow "Halving the exponent each step: 10 → 5 → 2 → 1 → 0.")

```js try
function pow(x, n) {
  if (n === 0) return 1;                           // base case
  const half = pow(x, Math.floor(n / 2));          // ONE recursive call, on half the size
  return n % 2 === 0 ? half * half : x * half * half;
}
console.log(pow(2, 10), pow(3, 13), pow(1, 1e12));
```

Note the detail that makes it fast: it calls itself **once** and reuses `half`. Writing `pow(x, n/2) * pow(x, n/2)` would call it twice and lose the entire benefit.

## Quick check

```check
Q: What happens if a recursive function has no base case?
A) It returns undefined
B) It runs forever until the call stack overflows (RangeError) *
C) It runs once
D) It becomes a loop
Why: Every call makes another call, so the stack grows without limit until the engine throws.
---
Q: Why is naive recursive fib(n) so slow?
A) JavaScript is slow at recursion
B) It recomputes the same subproblems many times, doubling the work each level *
C) It uses too much memory per call
D) It has no base case
Why: fib(n) calls fib(n-1) and fib(n-2), whose subtrees overlap. A memo makes each value computed once.
---
Q: What is the time complexity of merge sort?
A) O(n)
B) O(n²)
C) O(n log n) *
D) O(log n)
Why: log n levels of halving, and each level merges all n items once.
---
Q: In fast exponentiation, why must you call pow(x, n/2) once and reuse the result?
A) To save memory
B) Calling it twice makes two full recursions, throwing away the halving advantage *
C) JavaScript forbids two calls
D) The result changes between calls
Why: Two calls per level means n calls in total again; one call per level means log n.
---
Q: How would you handle recursion that must go 100 000 levels deep?
A) Increase the stack in the browser
B) Rewrite it as a loop with an explicit stack (or queue) *
C) Add more base cases
D) Use setTimeout between calls
Why: The call stack is limited to roughly ten thousand frames, but an array used as a stack has no such limit.
```

## Recap

- Recursion = **base case + smaller problem + combine**. Trust the smaller answer.
- Calls pile up on the **call stack**; depth is limited, so very deep inputs need a loop and an explicit stack.
- **Nested data** is a natural fit; the recursion mirrors the shape.
- **Overlapping subproblems** make naive recursion exponential: **memoise** (next lessons: dynamic programming).
- **Divide and conquer** splits in half: **merge sort** is O(n log n) and **fast power** is O(log n). Call once, reuse the result.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: fast power | The `pow` snippet: one call on half the exponent |
| Flatten a deeply nested array | The flatten stepper |
| Deep equality | Recurse into arrays and objects; compare primitives directly |
| Towers of Hanoi | Move n−1 away, move the big one, move n−1 back |
| Merge sort | The merge stepper plus a recursive split |
| Count inversions | Merge sort that counts while it merges |

%% exercise alg-guided-fast-pow | Guided: fast power | 1 | js | js | fastPow | 8 | guided
Write `fastPow(x, n)`: `x` raised to the integer power `n` (negative `n` allowed), using **O(log n)** multiplications: halve the exponent each call and call yourself **once**.

```js
fastPow(2, 10); // 1024
fastPow(2, -2); // 0.25
fastPow(1, 1e12); // 1   (a loop of a trillion steps would never finish)
```

%% worked
**A similar problem, solved: `digitCount(n)`** — how many digits does a non-negative integer have?

```js
function digitCount(n) {
  if (n < 10) return 1;                       // ① base case: one digit
  return 1 + digitCount(Math.floor(n / 10));  // ② drop the last digit: a smaller problem; ③ add one for it
}
```

Same three beats: a base case, a call on a strictly smaller input, a tiny combine step. For `fastPow` the smaller input is `Math.floor(n / 2)`, and combining is `half * half` (times `x` when `n` is odd). Handle a negative exponent by flipping it: `1 / fastPow(x, -n)`.

%% explain
- **`n = 0`** is the base case and returns `1`.
- **Negative `n`** is `1 / x^(-n)`.
- **One recursive call** on `Math.floor(n / 2)`, reused as `half`.
- **Odd `n`** needs one extra factor of `x`.

%% nudge
- What is `x` to the power `0`?
- If `n` is odd, how does `x^n` relate to `x^(n-1)`?

%% starter
```js
export function fastPow(x, n) {
  // Step 1 — base case: n === 0 → 1.
  // Step 2 — negative n: return 1 / fastPow(x, -n).
  // Step 3 — const half = fastPow(x, Math.floor(n / 2)).
  // Step 4 — even n: half * half. odd n: x * half * half.
  return 0;
}
```

%% tests
```js
describe('fastPow', () => {
  it('computes powers', () => {
    expect(fastPow(2, 10)).toBe(1024);
    expect(fastPow(3, 13)).toBe(1594323);
    expect(fastPow(5, 1)).toBe(5);
  });

  it('handles an exponent of 0', () => {
    expect(fastPow(7, 0)).toBe(1);
    expect(fastPow(0, 0)).toBe(1);
  });

  it('handles negative exponents', () => {
    expect(fastPow(2, -2)).toBe(0.25);
    expect(fastPow(10, -3)).toBeCloseTo(0.001, 10);
  });

  it('handles negative bases', () => {
    expect(fastPow(-2, 3)).toBe(-8);
    expect(fastPow(-2, 4)).toBe(16);
  });

  it('is logarithmic: a trillion-step loop would never finish', () => {
    expect(fastPow(1, 1e12)).toBe(1);
    expect(fastPow(-1, 1e12 + 1)).toBe(-1);
    expect(fastPow(2, 1023)).toBe(2 ** 1023);
  });
});
```

%% hints
- `if (n === 0) return 1; if (n < 0) return 1 / fastPow(x, -n);`
- `const half = fastPow(x, Math.floor(n / 2)); return n % 2 === 0 ? half * half : x * half * half;`

%% solution
```js
export function fastPow(x, n) {
  if (n === 0) return 1;
  if (n < 0) return 1 / fastPow(x, -n);
  const half = fastPow(x, Math.floor(n / 2));
  return n % 2 === 0 ? half * half : x * half * half;
}
```

%% exercise alg-flatten-deep | Flatten a deeply nested array | 2 | js | js | flattenDeep | 14
Write `flattenDeep(arr)` that returns a **new, flat array** containing every non-array value from `arr` and all arrays nested inside it, in order. Don't modify the input.

```js
flattenDeep([1, [2, [3, [4]], 5]]); // [1, 2, 3, 4, 5]
```

It must handle nesting 3 000 levels deep and a flat array of 100 000 items quickly (avoid re-copying the result array in every step).

%% worked
**A similar problem, solved: `maxDepth(arr)`** — how deeply is an array nested?

```js
function maxDepth(arr) {
  let deepest = 1;                                        // ① an array is at least one level
  for (const item of arr) {
    if (Array.isArray(item)) deepest = Math.max(deepest, 1 + maxDepth(item));   // ② nested array: ask it, add one level
  }
  return deepest;
}
```

The shape is the same: loop over the items; **plain values are handled directly, arrays are handed back to the function**. For `flattenDeep`, pass the **same output array** down the recursion (or push the spread of the recursive result) so the combining step stays cheap.

%% explain
- **Order is preserved**, depth-first, left to right.
- **Non-array values** (including `null`, `undefined`, objects) are kept as they are.
- **Empty arrays** contribute nothing.
- **Returns a new array**; the input stays unchanged.

%% nudge
- For each item: is it an array, or a plain value?
- How can you avoid building a new array at every level?

%% starter
```js
export function flattenDeep(arr) {
  const out = [];
  // your code
  return out;
}
```

%% tests
```js
describe('flattenDeep', () => {
  it('flattens nested arrays', () => {
    expect(flattenDeep([1, [2, [3, [4]], 5]])).toEqual([1, 2, 3, 4, 5]);
    expect(flattenDeep([[1, 2], [3], [[4]]])).toEqual([1, 2, 3, 4]);
  });

  it('keeps non-array values untouched', () => {
    const o = { a: 1 };
    const r = flattenDeep([o, [null, [undefined, 'x']], 0]);
    expect(r).toEqual([o, null, undefined, 'x', 0]);
    expect(r[0]).toBe(o);
  });

  it('handles empty arrays', () => {
    expect(flattenDeep([])).toEqual([]);
    expect(flattenDeep([[], [[]], [[], []]])).toEqual([]);
  });

  it('does not modify the input and returns a new array', () => {
    const input = [1, [2, [3]]];
    const copy = JSON.parse(JSON.stringify(input));
    const r = flattenDeep(input);
    expect(input).toEqual(copy);
    expect(r).not.toBe(input);
  });

  it('copes with 3 000 levels of nesting', () => {
    let nested = [7];
    for (let i = 0; i < 3000; i++) nested = [nested];
    expect(flattenDeep(nested)).toEqual([7]);
  });

  it('is fast on 100 000 items', () => {
    const big = Array.from({ length: 100000 }, (_, i) => (i % 10 === 0 ? [i, [i + 1]] : i));
    const t = Date.now();
    const r = flattenDeep(big);
    expect(Date.now() - t).toBeLessThan(600);
    expect(r.length).toBe(110000);
  });
});
```

%% hints
- Define an inner helper `walk(items)` that loops with `for (const item of items)` and either `walk(item)` (when `Array.isArray(item)`) or `out.push(item)`.
- Always push into the one shared `out` array.

%% solution
```js
export function flattenDeep(arr) {
  const out = [];
  const walk = (items) => {
    for (const item of items) {
      if (Array.isArray(item)) walk(item);
      else out.push(item);
    }
  };
  walk(arr);
  return out;
}
```

%% exercise alg-deep-equal | Deep equality | 3 | js | js | deepEqual | 24
Write `deepEqual(a, b)` for **JSON-like values**: primitives, arrays and plain objects, nested to any depth.

- Primitives are equal when `Object.is(a, b)` (so `NaN` equals `NaN`).
- Two **arrays** are equal when they have the same length and every item is deeply equal.
- Two **plain objects** are equal when they have the **same set of own keys** (order doesn't matter) and every value is deeply equal. A key holding `undefined` is **different** from a missing key.
- An array never equals an object, and `null` never equals an object.

```js
deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }); // true
deepEqual([1, 2], { 0: 1, 1: 2 });                      // false
```

%% worked
**A similar problem, solved: `sameShape(a, b)`** — do two values have the same nesting structure, ignoring the leaf values?

```js
function sameShape(a, b) {
  const aIsArr = Array.isArray(a), bIsArr = Array.isArray(b);
  if (!aIsArr || !bIsArr) return aIsArr === bIsArr;      // ① at least one leaf: they match only if both are leaves
  if (a.length !== b.length) return false;               // ② arrays of different length can't match
  return a.every((item, i) => sameShape(item, b[i]));    // ③ recurse pair by pair
}
```

`deepEqual` follows the same pattern with an extra layer of cases. **Base case:** values that aren't both containers are compared directly (`Object.is`). **Smaller problems:** each pair of children. **Combine:** *all* pairs must match. For objects, compare key counts first, then check each key of `a` exists in `b`.

%% explain
- **Leaves** (non-objects, and `null`) compare with `Object.is`.
- **Arrays**: same length, items pairwise `deepEqual`.
- **Objects**: same key count, each key present in both with equal values.
- **Array vs object**, **null vs object**: not equal.

%% nudge
- When can you answer immediately, without recursing?
- How do you make sure the two objects have exactly the same keys, no more and no fewer?

%% starter
```js
export function deepEqual(a, b) {
  // your code
  return false;
}
```

%% tests
```js
describe('deepEqual', () => {
  it('compares primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(true, false)).toBe(false);
  });

  it('compares arrays deeply', () => {
    expect(deepEqual([1, [2, [3]]], [1, [2, [3]]])).toBe(true);
    expect(deepEqual([1, 2, 3], [1, 2])).toBe(false);
    expect(deepEqual([1, [2]], [1, [3]])).toBe(false);
    expect(deepEqual([], [])).toBe(true);
  });

  it('compares objects regardless of key order', () => {
    expect(deepEqual({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(deepEqual({}, {})).toBe(true);
  });

  it('distinguishes undefined values from missing keys', () => {
    expect(deepEqual({ a: undefined }, {})).toBe(false);
    expect(deepEqual({ a: undefined }, { b: undefined })).toBe(false);
    expect(deepEqual({ a: undefined }, { a: undefined })).toBe(true);
  });

  it('keeps arrays, objects and null apart', () => {
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false);
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({}, null)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  it('handles deep and wide structures', () => {
    let a = { v: 1 }, b = { v: 1 };
    for (let i = 0; i < 2000; i++) { a = { next: a }; b = { next: b }; }
    expect(deepEqual(a, b)).toBe(true);
    const x = Array.from({ length: 100000 }, (_, i) => ({ i }));
    const y = Array.from({ length: 100000 }, (_, i) => ({ i }));
    const t = Date.now();
    expect(deepEqual(x, y)).toBe(true);
    y[99999].i = -1;
    expect(deepEqual(x, y)).toBe(false);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- Base case: if either value is not an object, or is `null`, return `Object.is(a, b)`.
- Then: if `Array.isArray(a) !== Array.isArray(b)` return `false`.
- Compare `Object.keys(a).length` with `Object.keys(b).length`; for each key `k` of `a`, require `Object.prototype.hasOwnProperty.call(b, k)` and `deepEqual(a[k], b[k])`. (Arrays work with the same code, since their keys are indexes.)

%% solution
```js
export function deepEqual(a, b) {
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return Object.is(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const k of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}
```

%% exercise alg-hanoi | Towers of Hanoi | 2 | js | js | hanoi | 16
Three pegs: `'A'`, `'B'`, `'C'`. `n` disks of different sizes start stacked on `'A'` (smallest on top). Return the **list of moves** `[from, to]` that moves the whole stack to `'C'`, moving **one disk at a time** and **never placing a larger disk on a smaller one**. The list must be the **shortest possible**: `2ⁿ − 1` moves.

```js
hanoi(2); // [['A','B'], ['A','C'], ['B','C']]
```

%% worked
**A similar problem, solved: `countdownPrint(n)`** — a recursion where *order* matters: act before or after the recursive call?

```js
function countdownPrint(n, out = []) {
  if (n === 0) return out;
  out.push(n);                       // ① act BEFORE the call: 3, 2, 1
  countdownPrint(n - 1, out);
  // out.push(n)                     // ② acting AFTER the call would give 1, 2, 3
  return out;
}
```

Hanoi needs exactly that care about order. To move `n` disks from `from` to `to` using `via`: **(1)** move the top `n − 1` disks out of the way (to `via`), **(2)** move the biggest disk to `to`, **(3)** move the `n − 1` disks from `via` onto it. Steps 1 and 3 are the *same problem with `n − 1` disks* and different pegs.

%% explain
- **`2ⁿ − 1` moves**, in a legal order.
- **Pegs**: `'A'` source, `'B'` spare, `'C'` target.
- **`n = 0`** gives `[]`.
- **Recursion**: move `n−1` aside, move one, move `n−1` on top.

%% nudge
- Which pegs play the roles of source, spare and target in each of the two recursive steps?
- What is the answer for `n = 1`?

%% starter
```js
export function hanoi(n, from = 'A', to = 'C', via = 'B') {
  // your code
  return [];
}
```

%% tests
```js
const simulate = (n, moves) => {
  const pegs = { A: Array.from({ length: n }, (_, i) => n - i), B: [], C: [] };
  for (const [from, to] of moves) {
    const disk = pegs[from].pop();
    if (disk === undefined) return false;
    const top = pegs[to][pegs[to].length - 1];
    if (top !== undefined && top < disk) return false;
    pegs[to].push(disk);
  }
  return pegs.C.length === n && pegs.A.length === 0 && pegs.B.length === 0;
};

describe('hanoi', () => {
  it('returns no moves for no disks', () => {
    expect(hanoi(0)).toEqual([]);
  });

  it('solves one and two disks', () => {
    expect(hanoi(1)).toEqual([['A', 'C']]);
    expect(hanoi(2)).toEqual([['A', 'B'], ['A', 'C'], ['B', 'C']]);
  });

  it('uses the minimum number of moves', () => {
    for (let n = 1; n <= 10; n++) expect(hanoi(n).length).toBe(2 ** n - 1);
  });

  it('only makes legal moves and ends with everything on C', () => {
    for (let n = 1; n <= 8; n++) expect(simulate(n, hanoi(n))).toBe(true);
  });

  it('handles 16 disks quickly', () => {
    const t = Date.now();
    const moves = hanoi(16);
    expect(Date.now() - t).toBeLessThan(600);
    expect(moves.length).toBe(65535);
    expect(simulate(16, moves)).toBe(true);
  });
});
```

%% hints
- Base case: `if (n === 0) return [];`
- `[...hanoi(n - 1, from, via, to), [from, to], ...hanoi(n - 1, via, to, from)]`.

%% solution
```js
export function hanoi(n, from = 'A', to = 'C', via = 'B') {
  if (n === 0) return [];
  return [
    ...hanoi(n - 1, from, via, to),
    [from, to],
    ...hanoi(n - 1, via, to, from),
  ];
}
```

%% exercise alg-merge-sort | Merge sort | 3 | js | js | mergeSort | 28
Implement `mergeSort(arr, compare = (a, b) => a - b)`. Return a **new sorted array** and **don't change the input**. It must be **stable** (equal items keep their original order), run in **O(n log n)**, and **not call `Array#sort`** (the tests make it throw). `compare(x, y) <= 0` means `x` may come first.

```js
mergeSort([5, 2, 4, 1]); // [1, 2, 4, 5]
mergeSort(people, (a, b) => a.age - b.age);
```

%% worked
**A similar problem, solved: `merge(a, b)`** — the building block, for two sorted arrays.

```js
function merge(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    out.push(a[i] <= b[j] ? a[i++] : b[j++]);     // ① take the smaller front; "<=" keeps it stable
  }
  while (i < a.length) out.push(a[i++]);           // ② one list ran out: copy the rest of the other
  while (j < b.length) out.push(b[j++]);
  return out;
}
```

`mergeSort(arr)`: **base case** — length 0 or 1 is already sorted. **Smaller problems** — sort the left half and the right half. **Combine** — merge them. For the comparator version, replace `a[i] <= b[j]` with `compare(a[i], b[j]) <= 0`.

%% explain
- **Returns a new array**; the input keeps its order.
- **Stable**: ties take the left item first.
- **Comparator**: `compare(x, y) <= 0` → `x` first.
- **No `Array#sort`**.
- **O(n log n)**: 100 000 items are tested.

%% nudge
- When is an array already sorted?
- Why does the merge use `<=` rather than `<`?

%% starter
```js
export function mergeSort(arr, compare = (a, b) => a - b) {
  // your code
  return arr;
}
```

%% tests
```js
describe('mergeSort', () => {
  const realSort = Array.prototype.sort;
  const noSort = () => { Array.prototype.sort = function () { throw new Error('do not use Array#sort'); }; };
  const restore = () => { Array.prototype.sort = realSort; };

  it('sorts numbers', () => {
    noSort();
    try {
      expect(mergeSort([5, 2, 4, 1])).toEqual([1, 2, 4, 5]);
      expect(mergeSort([3, -1, 0, 3, 2])).toEqual([-1, 0, 2, 3, 3]);
    } finally { restore(); }
  });

  it('handles empty and single-element arrays', () => {
    expect(mergeSort([])).toEqual([]);
    expect(mergeSort([7])).toEqual([7]);
  });

  it('does not modify the input', () => {
    const input = [3, 1, 2];
    const r = mergeSort(input);
    expect(input).toEqual([3, 1, 2]);
    expect(r).not.toBe(input);
  });

  it('accepts a comparator', () => {
    expect(mergeSort([1, 3, 2], (a, b) => b - a)).toEqual([3, 2, 1]);
    expect(mergeSort(['pear', 'fig', 'apple'], (a, b) => a.length - b.length)).toEqual(['fig', 'pear', 'apple']);
  });

  it('is stable', () => {
    const items = [{ k: 1, n: 'a' }, { k: 0, n: 'b' }, { k: 1, n: 'c' }, { k: 0, n: 'd' }, { k: 1, n: 'e' }];
    const r = mergeSort(items, (x, y) => x.k - y.k);
    expect(r.map((x) => x.n).join('')).toBe('bdace');
  });

  it('is O(n log n): 100 000 items', () => {
    const nums = Array.from({ length: 100000 }, (_, i) => (i * 7919) % 100003);
    noSort();
    try {
      const t = Date.now();
      const r = mergeSort(nums);
      expect(Date.now() - t).toBeLessThan(900);
      expect(r.length).toBe(100000);
      let ok = true;
      for (let i = 1; i < r.length; i++) if (r[i - 1] > r[i]) { ok = false; break; }
      expect(ok).toBe(true);
    } finally { restore(); }
  });
});
```

%% hints
- Base case: `if (arr.length < 2) return arr.slice();`
- Split at `Math.floor(arr.length / 2)`, sort both halves recursively, then merge with two pointers.

%% solution
```js
export function mergeSort(arr, compare = (a, b) => a - b) {
  if (arr.length < 2) return arr.slice();
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compare);
  const right = mergeSort(arr.slice(mid), compare);
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    out.push(compare(left[i], right[j]) <= 0 ? left[i++] : right[j++]);
  }
  while (i < left.length) out.push(left[i++]);
  while (j < right.length) out.push(right[j++]);
  return out;
}
```

%% exercise alg-count-inversions | Count inversions | 4 | js | js | countInversions | 38
An **inversion** is a pair of positions `i < j` with `arr[i] > arr[j]`: two items in the "wrong" order. Return how many inversions an array has. It must be **O(n log n)**: the tests use 100 000 items, where checking every pair (about 5 billion) is far too slow.

```js
countInversions([2, 4, 1, 3, 5]); // 3   (2,1) (4,1) (4,3)
```

%% worked
**A similar problem, solved: `countCrossPairs(left, right)`** — how many pairs `(x from left, y from right)` have `x > y`, when both are **sorted**?

```js
function countCrossPairs(left, right) {
  let count = 0, j = 0;
  for (const x of left) {                     // left ascending
    while (j < right.length && right[j] < x) j++;   // ① how many right items are smaller than x?
    count += j;                               // ② all of them form an inversion with x
  }
  return count;
}
```

That "count pairs across two sorted halves in one pass" is exactly what a **merge** already does. So run merge sort, and **while merging**, whenever you take an item from the **right** half, it is smaller than every item still waiting in the left half — add `left.length − i` to the count. Total = inversions inside the left half + inside the right half + the crossing ones counted during the merge.

%% explain
- **Inversion**: `i < j` and `arr[i] > arr[j]` (equal items don't count).
- **Sorted array** has `0`; a **reversed array of n** has `n(n − 1) / 2`.
- **Merge sort with a counter**: left count + right count + crossing count.
- **Input stays unchanged**.

%% nudge
- When the merge takes from the right half, how many left items are still waiting, and how do they compare with the taken item?
- Why does counting during the merge give each crossing pair exactly once?

%% starter
```js
export function countInversions(arr) {
  // your code
  return 0;
}
```

%% tests
```js
describe('countInversions', () => {
  it('counts inversions', () => {
    expect(countInversions([2, 4, 1, 3, 5])).toBe(3);
    expect(countInversions([5, 4, 3, 2, 1])).toBe(10);
    expect(countInversions([1, 20, 6, 4, 5])).toBe(5);
  });

  it('is 0 for sorted arrays, empty arrays and single items', () => {
    expect(countInversions([1, 2, 3, 4])).toBe(0);
    expect(countInversions([])).toBe(0);
    expect(countInversions([9])).toBe(0);
  });

  it('does not count equal items', () => {
    expect(countInversions([2, 2, 2])).toBe(0);
    expect(countInversions([3, 1, 1])).toBe(2);
  });

  it('does not modify the input', () => {
    const a = [3, 1, 2];
    countInversions(a);
    expect(a).toEqual([3, 1, 2]);
  });

  it('matches brute force on small random arrays', () => {
    let seed = 9;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 50;
    for (let round = 0; round < 40; round++) {
      const a = Array.from({ length: 30 }, rand);
      let brute = 0;
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) brute++;
      expect(countInversions(a)).toBe(brute);
    }
  });

  it('is O(n log n): 100 000 items', () => {
    const n = 100000;
    const reversed = Array.from({ length: n }, (_, i) => n - i);
    const t = Date.now();
    expect(countInversions(reversed)).toBe((n * (n - 1)) / 2);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- Write `sortCount(a)` returning `[sortedArray, inversions]`. Base case: length < 2 → `[a, 0]`.
- Merge with two pointers; when you take from the right half, `count += left.length - i`.
- Return the total of the left count, the right count and the merge count.

%% solution
```js
export function countInversions(arr) {
  const sortCount = (a) => {
    if (a.length < 2) return [a, 0];
    const mid = Math.floor(a.length / 2);
    const [left, lc] = sortCount(a.slice(0, mid));
    const [right, rc] = sortCount(a.slice(mid));
    const out = [];
    let i = 0, j = 0, cross = 0;
    while (i < left.length && j < right.length) {
      if (left[i] <= right[j]) {
        out.push(left[i++]);
      } else {
        out.push(right[j++]);
        cross += left.length - i;
      }
    }
    while (i < left.length) out.push(left[i++]);
    while (j < right.length) out.push(right[j++]);
    return [out, lc + rc + cross];
  };
  return sortCount(arr)[1];
}
```
