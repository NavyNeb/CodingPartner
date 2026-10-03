---
id: algo-sorting
track: algo
title: Sorting, selection & binary search on the answer
summary: Sorting as a way to make a hard question easy, writing comparators, partitioning without sorting, quickselect for the k-th item, and binary searching over answers instead of arrays.
---

## The idea in one sentence

Many hard-looking problems get easy once the data is in the right **order**; and many "find the best value" problems get fast once you realise the **answer itself can be binary searched**.

> **Analogy** Finding two clashing appointments in a pile of diary pages is miserable until you sort the pages by date — then a clash can only be between pages that sit next to each other. And "what's the slowest typing speed that still finishes the report on time?" doesn't need you to try every speed: if 40 words per minute is fast enough, so is 50, so you can halve the range each time.

## Sorting first, then solving

Sorting costs **O(n log n)**, which is cheap next to the O(n²) you may be avoiding. After it, **neighbours matter and distant items don't**, which turns "compare everything with everything" into "compare each item with the previous one".

![Meetings sorted by start time: a clash can only appear between neighbours](fig:alg-sort-then-solve "Sort by start, then each meeting only needs to be checked against the previous end.")

```js try
function canAttendAll(intervals) {
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);   // sort a COPY: sort() mutates
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] < sorted[i - 1][1]) return false;            // starts before the previous one ended
  }
  return true;
}
console.log(canAttendAll([[0, 30], [5, 10], [15, 20]]), canAttendAll([[7, 10], [2, 4]]));
```

The same move solves a long list of problems: **group anagrams** (sort each word's letters), **closest pair** (neighbours after sorting), **merge intervals**, **find duplicates**, **minimum meeting rooms**.

### Comparators and sort gotchas

`Array#sort` takes a **comparator** `(a, b) => number`: negative means `a` first, positive means `b` first, `0` means a tie. Three traps:

- `sort()` with **no comparator sorts as strings**: `[10, 9, 1].sort()` gives `[1, 10, 9]`. For numbers write `(a, b) => a - b`.
- `sort()` **mutates** the array. Copy first (`slice()`, spread, or `toSorted`).
- Sorting is **stable** (modern engines): ties keep their original order, which makes **multi-key sorts** easy.

```js try predict
const nums = [10, 9, 1, 100];
console.log(nums.slice().sort());                 // default: strings!
console.log(nums.slice().sort((a, b) => a - b));  // numeric

const people = [{ n: 'Bea', age: 30 }, { n: 'Al', age: 25 }, { n: 'Cy', age: 30 }];
people.sort((a, b) => b.age - a.age || a.n.localeCompare(b.n));   // by age descending, then name
console.log(people.map((p) => p.n).join(' '));
```

(`x - y || other` reads: if the first key differs use it; if it's `0` (a tie) fall back to the next key.)

## Partitioning: sorting's cheaper cousin

Sometimes you don't need a *full* sort, only to **separate** items. With only three values you can do it in **one pass with no extra memory** — the **Dutch national flag** problem (sort 0s, 1s and 2s). Three pointers keep an invariant: everything left of `lo` is 0, between `lo` and `mid` is 1, right of `hi` is 2, and `mid..hi` is not looked at yet.

![The Dutch national flag partition with lo, mid and hi pointers](fig:alg-dutch-flag "The unknown region shrinks by one every step, and every swap puts an item into its final region.")

```stepper Sorting colours 2 0 1 2 0
code:
  function sortColors(nums) {
    let lo = 0, mid = 0, hi = nums.length - 1;
    while (mid <= hi) {
      if (nums[mid] === 0) swap(nums, lo++, mid++);
      else if (nums[mid] === 1) mid++;
      else swap(nums, mid, hi--);
    }
  }
  sortColors([2, 0, 1, 2, 0]);
---
line: 2
say: All of the array is "not looked at yet". `lo` and `mid` start on the left, `hi` on the right.
nums: 2 | 0 | 1 | 2 | 0
lo: 0
mid: 0
hi: 4
---
line: 4-6
say: `nums[mid]` is `2`: it belongs on the right. Swap it with `nums[hi]` and shrink `hi`. Don't move `mid`: the item swapped in hasn't been inspected yet.
nums: 0 | 0 | 1 | 2 | 2
hi: 3
---
line: 4
say: `nums[mid]` is `0`: it belongs on the left. Swap with `lo` (the same slot here) and advance both `lo` and `mid`.
lo: 1
mid: 1
---
line: 4
say: Another `0`: advance both again.
lo: 2
mid: 2
---
line: 5
say: `nums[mid]` is `1`: already in the middle region. Just advance `mid`.
mid: 3
---
line: 6
say: `mid` is `3` and `hi` is `3`: `nums[3]` is `2`, so swap with itself and shrink `hi` to `2`. Now `mid > hi`: nothing is left unknown.
nums: 0 | 0 | 1 | 2 | 2
hi: 2
Result: [0, 0, 1, 2, 2]
```

## Quickselect: the k-th item without sorting everything

To find the **k-th smallest** you don't need the whole order. **Partition** around a pivot: smaller items go left, larger go right, and the pivot lands in its **final sorted position**. If that position is the one you want, you're done; otherwise **only one side** can contain it, so repeat on that side.

![One partition step of quickselect](fig:alg-partition "The pivot is in its final place; the answer is in just one of the two parts.")

Because each round throws away a part (about half), the work is `n + n/2 + n/4 + … = O(n)` on average (versus O(n log n) for sorting). Two practical points: pick a **random pivot** (so sorted input doesn't hit the worst case), and handle **many equal items** carefully (a three-way split into `<`, `=`, `>` avoids quadratic behaviour on arrays like `[7, 7, 7, 7…]`).

```js try
function kthSmallest(nums, k) {              // k is 1-based
  let items = nums.slice();
  while (true) {
    const pivot = items[Math.floor(Math.random() * items.length)];
    const less = items.filter((x) => x < pivot);
    const equal = items.filter((x) => x === pivot);
    if (k <= less.length) items = less;                         // it's among the smaller ones
    else if (k <= less.length + equal.length) return pivot;     // it IS the pivot value
    else { k -= less.length + equal.length; items = items.filter((x) => x > pivot); }
  }
}
console.log(kthSmallest([7, 2, 9, 4, 3, 8, 5], 3));   // 4
```

## Binary search on the answer

Binary search isn't only for arrays. Whenever you can ask a **yes/no question about a candidate answer** whose result **flips only once** (a *monotone predicate*), you can binary search the candidates themselves.

> "What's the **smallest** speed / capacity / time such that the job can be done?" — If speed *k* works, then any faster speed works too. So the answers to "does *k* work?" look like `no no no yes yes yes`, and you want the first `yes`.

![Is each eating speed fast enough? no no no then yes yes yes](fig:alg-bs-answer "A monotone predicate: binary search the boundary instead of testing every speed.")

```stepper Smallest eating speed: piles [3, 6, 7, 11] within 8 hours
code:
  function minEatingSpeed(piles, h) {
    let lo = 1, hi = Math.max(...piles);
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (hoursNeeded(piles, mid) <= h) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }
  // hoursNeeded(piles, speed) = sum of Math.ceil(pile / speed)
---
line: 2
say: The answer is somewhere between speed `1` and the biggest pile (`11`: at that speed every pile takes one hour, so no speed above it can help).
lo: 1
hi: 11
---
line: 4-6
say: Try `mid = 6`: hours = 1 + 1 + 2 + 2 = **6**, which is within 8. Speed 6 works, so the answer is **6 or less**: keep it (`hi = mid`).
mid: 6
hours: 6
hi: 6
---
line: 4-6
say: Try `mid = 3`: hours = 1 + 2 + 3 + 4 = **10**, more than 8. Too slow, and anything slower is too. Discard it: `lo = mid + 1`.
mid: 3
hours: 10
lo: 4
---
line: 4-6
say: Try `mid = 5`: 1 + 2 + 2 + 3 = **8**. Works: `hi = 5`.
mid: 5
hours: 8
hi: 5
---
line: 4-6
say: Try `mid = 4`: 1 + 2 + 2 + 3 = **8**. Still works: `hi = 4`.
mid: 4
hours: 8
hi: 4
---
line: 8
say: `lo === hi === 4`: the smallest working speed. Each check costs O(n) and there are about log₂(11) of them.
Result: 4
```

Notice the **half-open** style (`hi = mid`, loop while `lo < hi`): it fits "find the first yes", because `mid` itself might be the answer and must not be thrown away.

```js try
function mySqrt(x) {                          // the largest r with r*r <= x
  let lo = 0, hi = x;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);     // round UP when keeping `lo = mid`, or the loop can get stuck
    if (mid <= x / mid) lo = mid;             // mid is small enough: the answer is mid or bigger
    else hi = mid - 1;
  }
  return lo;
}
console.log(mySqrt(8), mySqrt(2147395599));
```

Tell-tale phrases for this pattern: **"minimise the maximum…"**, **"the smallest capacity / speed / time such that…"**, **"largest value for which…"**. Always check you can write the **yes/no test** cheaply (usually O(n)) and that it is **monotone**.

## One more shape: a rotated sorted array

A sorted array rotated at some point (`[4, 5, 6, 7, 0, 1, 2]`) is no longer sorted, yet binary search still works: at any `mid`, **at least one half is still sorted**. Check whether the target lies inside the sorted half; if so, search it, otherwise search the other. You will build this in the exercises.

## Quick check

```check
Q: What does `[10, 9, 1, 100].sort()` return?
A) [1, 9, 10, 100]
B) [1, 10, 100, 9] *
C) [100, 10, 9, 1]
D) It throws
Why: Without a comparator, sort compares items as strings: "1" < "10" < "100" < "9".
---
Q: After sorting meetings by start time, why is it enough to compare each meeting with the previous one?
A) Sorting removes overlaps
B) Any clash must involve an adjacent pair, because a meeting that overlaps a later one overlaps everything in between *
C) Only the first two can clash
D) The end times are sorted too
Why: If meeting i overlapped j > i + 1, then it would also overlap i + 1 (which starts between them).
---
Q: In the Dutch national flag partition, why don't you advance `mid` after swapping with `hi`?
A) It would skip the next item
B) The item swapped in from `hi` has not been inspected yet *
C) `hi` is always 2
D) It would cause an overflow
Why: Items from `hi` are unknown; the item you swapped *out* is a known 2, but the one that came *in* still needs a look.
---
Q: Quickselect finds the k-th smallest in O(n) on average because…
A) It sorts the whole array
B) Each partition discards one side, so work shrinks like n + n/2 + n/4 … *
C) It uses a hash map
D) It checks only the first k items
Why: After partitioning you know which side holds the k-th item and can ignore the other.
---
Q: When can you binary search over the answer?
A) When the data is sorted
B) When a yes/no test on a candidate is monotone: it flips from no to yes only once *
C) When the answer is an integer
D) Always
Why: Monotonicity is what lets you discard half of the candidates after one check.
```

## Recap

- **Sort first** to turn "all pairs" into "neighbours". Copy before sorting; give numbers a comparator; chain keys with `||`.
- **Partitioning** (Dutch flag) separates items in one pass with O(1) memory; **quickselect** finds the k-th item in O(n) on average (random pivot, handle duplicates).
- **Binary search on the answer** whenever a yes/no test is monotone: `no no no yes yes yes`. Use `hi = mid` to find the first yes.
- In a **rotated** sorted array one half is always sorted: decide which side holds the target.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: sort people | A multi-key comparator with `\|\|` |
| Can attend all meetings | Sort a copy by start; compare with the previous end |
| Sort colours | The three-pointer stepper |
| Integer square root | Binary search over `0 … x` with a yes/no test |
| K-th smallest | Partition around a random pivot; keep only one side |
| Minimum eating speed | The "first yes" binary search from the stepper |
| Search a rotated array | Find the sorted half, then check whether the target is inside it |

%% exercise alg-guided-sort-people | Guided: sort people | 1 | js | js | sortPeople | 8 | guided
`people` is an array of `{ name, age }`. Return a **new array** sorted by `age` **ascending**, and by `name` **alphabetically** (`a` before `b`, plain `<` comparison) when ages tie. Don't modify the input.

```js
sortPeople([{ name: 'Bea', age: 30 }, { name: 'Al', age: 25 }, { name: 'Abe', age: 30 }]);
// Al (25), Abe (30), Bea (30)
```

%% worked
**A similar problem, solved: `byLengthThenAlpha(words)`** — shortest first, alphabetical on ties.

```js
function byLengthThenAlpha(words) {
  return words.slice().sort((a, b) => {          // ① copy first: sort() changes the array it is called on
    if (a.length !== b.length) return a.length - b.length;   // ② first key decides when it differs
    return a < b ? -1 : a > b ? 1 : 0;           // ③ otherwise the second key
  });
}
```

A comparator returns a **negative** number when `a` should come first, **positive** when `b` should, `0` for a tie. Chain keys: use the first one when it differs, fall through to the next on a tie.

%% explain
- **Ascending age**; ties by **name** with `<`.
- **New array**: the input stays unchanged.
- **Stable**: fully identical items keep their relative order.

%% nudge
- What should the comparator return when the ages are different?
- Why call `slice()` before `sort()`?

%% starter
```js
export function sortPeople(people) {
  // Step 1 — copy: people.slice()
  // Step 2 — sort with (a, b) => ...
  // Step 3 — ages differ? return a.age - b.age. Otherwise compare names with < and >.
  return people;
}
```

%% tests
```js
describe('sortPeople', () => {
  const p = (name, age) => ({ name, age });

  it('sorts by age ascending', () => {
    expect(sortPeople([p('A', 30), p('B', 20), p('C', 25)]).map((x) => x.name)).toEqual(['B', 'C', 'A']);
  });

  it('breaks ties by name', () => {
    const r = sortPeople([p('Bea', 30), p('Al', 25), p('Abe', 30)]);
    expect(r.map((x) => x.name)).toEqual(['Al', 'Abe', 'Bea']);
  });

  it('does not modify the input', () => {
    const input = [p('B', 2), p('A', 1)];
    const r = sortPeople(input);
    expect(input.map((x) => x.name)).toEqual(['B', 'A']);
    expect(r).not.toBe(input);
  });

  it('handles empty and single-item arrays', () => {
    expect(sortPeople([])).toEqual([]);
    expect(sortPeople([p('X', 1)])).toEqual([p('X', 1)]);
  });

  it('compares ages as numbers (not strings)', () => {
    expect(sortPeople([p('A', 100), p('B', 9), p('C', 20)]).map((x) => x.age)).toEqual([9, 20, 100]);
  });
});
```

%% hints
- `people.slice().sort((a, b) => a.age - b.age || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))`

%% solution
```js
export function sortPeople(people) {
  return people.slice().sort((a, b) => {
    if (a.age !== b.age) return a.age - b.age;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}
```

%% exercise alg-can-attend | Can attend all meetings | 2 | js | js | canAttendAll | 14
Each meeting is `[start, end)` (it ends **when** `end` is reached). Return `true` if a person can attend **all** the meetings: no two overlap. Two meetings that merely **touch** (one ends exactly when the next starts) don't overlap. Don't modify the input. It must be **O(n log n)**: 200 000 meetings are tested.

```js
canAttendAll([[0, 30], [5, 10], [15, 20]]); // false
canAttendAll([[7, 10], [2, 4]]);            // true
canAttendAll([[1, 5], [5, 8]]);             // true (touching is fine)
```

%% worked
**A similar problem, solved: `hasDuplicateAfterSorting(nums)`** — sort, then look only at neighbours.

```js
function hasDuplicateAfterSorting(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);          // ① sorted copy
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) return true;             // ② equal values end up adjacent
  }
  return false;
}
```

Overlaps work the same way once the meetings are **sorted by start time**: a meeting clashes with something earlier only if it **starts before the previous meeting ends** (`start < previousEnd`). Check each pair of neighbours; sort a **copy** so the caller's array is untouched.

%% explain
- **Sort by start** (numerically!).
- **Clash** when `current.start < previous.end`; equal means touching, which is fine.
- **Empty or one meeting** → `true`.
- **Input unchanged**.

%% nudge
- Which two neighbours do you compare, and which of their numbers?
- What does "touching" mean in terms of `<` versus `<=`?

%% starter
```js
export function canAttendAll(intervals) {
  // your code
  return false;
}
```

%% tests
```js
describe('canAttendAll', () => {
  it('detects overlaps', () => {
    expect(canAttendAll([[0, 30], [5, 10], [15, 20]])).toBe(false);
    expect(canAttendAll([[1, 4], [3, 6]])).toBe(false);
  });

  it('accepts separate meetings in any order', () => {
    expect(canAttendAll([[7, 10], [2, 4]])).toBe(true);
    expect(canAttendAll([[9, 12], [1, 3], [4, 8]])).toBe(true);
  });

  it('treats touching meetings as fine', () => {
    expect(canAttendAll([[1, 5], [5, 8]])).toBe(true);
    expect(canAttendAll([[5, 8], [1, 5]])).toBe(true);
  });

  it('handles empty and single meetings', () => {
    expect(canAttendAll([])).toBe(true);
    expect(canAttendAll([[3, 9]])).toBe(true);
  });

  it('catches a long meeting that swallows others', () => {
    expect(canAttendAll([[0, 100], [10, 11], [50, 51]])).toBe(false);
  });

  it('does not modify its input', () => {
    const input = [[5, 6], [1, 2]];
    canAttendAll(input);
    expect(input).toEqual([[5, 6], [1, 2]]);
  });

  it('is O(n log n): 200 000 meetings', () => {
    const n = 200000;
    const meetings = Array.from({ length: n }, (_, i) => [((i * 7919) % n) * 2, ((i * 7919) % n) * 2 + 1]);
    const t = Date.now();
    expect(canAttendAll(meetings)).toBe(true);
    meetings.push([1, 3]);
    expect(canAttendAll(meetings)).toBe(false);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);`
- Loop from index 1: `if (sorted[i][0] < sorted[i - 1][1]) return false;`.

%% solution
```js
export function canAttendAll(intervals) {
  const sorted = intervals.slice().sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i][0] < sorted[i - 1][1]) return false;
  }
  return true;
}
```

%% exercise alg-sort-colors | Sort colours | 2 | js | js | sortColors | 18
`nums` contains only `0`, `1` and `2`. **Sort it in place** with **one pass** and **O(1) extra memory** — no `Array#sort` (the tests make it throw), no counting-then-rewriting in two passes. Return nothing.

```js
const a = [2, 0, 1, 2, 0];
sortColors(a); // a is now [0, 0, 1, 2, 2]
```

%% worked
**A similar problem, solved: `moveZeroesToEnd(nums)`** — a two-way partition with two pointers.

```js
function moveZeroesToEnd(nums) {
  let write = 0;                               // ① everything before `write` is non-zero
  for (let read = 0; read < nums.length; read++) {
    if (nums[read] !== 0) {
      [nums[write], nums[read]] = [nums[read], nums[write]];   // ② bring a non-zero forward
      write++;
    }
  }
}
```

Three values need **three regions**, so use three pointers (`lo`, `mid`, `hi`) with the invariant from the stepper: `[0, lo)` are 0s, `[lo, mid)` are 1s, `(hi, end]` are 2s, and `[mid, hi]` is unexamined. Look at `nums[mid]`: `0` → swap with `lo`, advance both; `1` → advance `mid`; `2` → swap with `hi`, shrink `hi` (and **don't** advance `mid`).

%% explain
- **In place**, one pass, constant extra memory.
- **Invariant**: 0s | 1s | unknown | 2s.
- **Swapping with `hi`** doesn't advance `mid`.
- **Empty and single arrays** are fine; all-equal arrays too.

%% nudge
- Why must `mid` stay where it is after swapping with `hi`?
- When does the loop end?

%% starter
```js
export function sortColors(nums) {
  // your code
}
```

%% tests
```js
describe('sortColors', () => {
  const realSort = Array.prototype.sort;
  const noSort = () => { Array.prototype.sort = function () { throw new Error('do not use Array#sort'); }; };
  const restore = () => { Array.prototype.sort = realSort; };

  it('sorts a mixed array in place', () => {
    noSort();
    try {
      const a = [2, 0, 1, 2, 0];
      sortColors(a);
      expect(a).toEqual([0, 0, 1, 2, 2]);
      const b = [1, 2, 0, 1, 0, 2, 1];
      sortColors(b);
      expect(b).toEqual([0, 0, 1, 1, 1, 2, 2]);
    } finally { restore(); }
  });

  it('handles empty, single and uniform arrays', () => {
    const e = [];
    sortColors(e);
    expect(e).toEqual([]);
    const one = [2];
    sortColors(one);
    expect(one).toEqual([2]);
    const same = [1, 1, 1];
    sortColors(same);
    expect(same).toEqual([1, 1, 1]);
  });

  it('handles already sorted and reversed arrays', () => {
    const s = [0, 0, 1, 2];
    sortColors(s);
    expect(s).toEqual([0, 0, 1, 2]);
    const r = [2, 2, 1, 0, 0];
    sortColors(r);
    expect(r).toEqual([0, 0, 1, 2, 2]);
  });

  it('returns nothing and mutates the given array', () => {
    const a = [1, 0];
    expect(sortColors(a)).toBeUndefined();
    expect(a).toEqual([0, 1]);
  });

  it('is linear: a million items', () => {
    noSort();
    try {
      const a = Array.from({ length: 1000000 }, (_, i) => (i * 7) % 3);
      const t = Date.now();
      sortColors(a);
      expect(Date.now() - t).toBeLessThan(700);
      let ok = true;
      for (let i = 1; i < a.length; i++) if (a[i - 1] > a[i]) { ok = false; break; }
      expect(ok).toBe(true);
    } finally { restore(); }
  });
});
```

%% hints
- `let lo = 0, mid = 0, hi = nums.length - 1; while (mid <= hi) { … }`
- `0`: swap `nums[lo]` and `nums[mid]`, then `lo++, mid++`. `1`: `mid++`. `2`: swap `nums[mid]` and `nums[hi]`, then `hi--`.

%% solution
```js
export function sortColors(nums) {
  let lo = 0;
  let mid = 0;
  let hi = nums.length - 1;
  while (mid <= hi) {
    if (nums[mid] === 0) {
      [nums[lo], nums[mid]] = [nums[mid], nums[lo]];
      lo++;
      mid++;
    } else if (nums[mid] === 1) {
      mid++;
    } else {
      [nums[mid], nums[hi]] = [nums[hi], nums[mid]];
      hi--;
    }
  }
}
```

%% exercise alg-my-sqrt | Integer square root | 2 | js | js | mySqrt | 16
Return the **integer square root** of a non-negative integer `x`: the largest integer `r` with `r × r <= x`. **Don't use `Math.sqrt`, `**` with a fraction or `Math.pow`** with a fractional exponent (the tests make `Math.sqrt` throw). Binary search the answer. `x` can be as large as `Number.MAX_SAFE_INTEGER`.

```js
mySqrt(8);   // 2
mySqrt(16);  // 4
```

%% worked
**A similar problem, solved: `firstPowerOfTwoAtLeast(n)`** — the smallest `k` where `2^k >= n`, binary searching `k`.

```js
function firstPowerOfTwoAtLeast(n) {
  let lo = 0, hi = 60;                     // ① the answer lies in [0, 60] for any safe integer
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (2 ** mid >= n) hi = mid;           // ② a yes: keep it, the first yes may be mid itself
    else lo = mid + 1;                     // ③ a no: the answer is strictly larger
  }
  return lo;
}
```

For the square root the candidate answers are `0 … x`, and "`mid × mid <= x`?" is **yes yes yes no no no** — you want the **last** yes. To avoid overflow, test `mid <= x / mid` instead of squaring `mid`. When a yes sets `lo = mid`, round `mid` **up** (`Math.ceil`), or the loop can stall when `hi = lo + 1`.

%% explain
- **Floor of the square root**: `mySqrt(8) = 2`.
- **Binary search** over `0 … x` with a yes/no test.
- **Last yes**: when `mid` works, `lo = mid`; otherwise `hi = mid − 1`.
- **Round `mid` up** to avoid an infinite loop.
- **`0` and `1`** return themselves.

%% nudge
- Is "`mid * mid <= x`" true for small `mid` and false for large, or the other way round?
- Why can `lo = mid` loop forever if `mid` is rounded down?

%% starter
```js
export function mySqrt(x) {
  // your code
  return 0;
}
```

%% tests
```js
describe('mySqrt', () => {
  const realSqrt = Math.sqrt;
  const noSqrt = () => { Math.sqrt = () => { throw new Error('do not use Math.sqrt'); }; };
  const restore = () => { Math.sqrt = realSqrt; };

  it('handles perfect squares and non-squares', () => {
    noSqrt();
    try {
      expect(mySqrt(16)).toBe(4);
      expect(mySqrt(8)).toBe(2);
      expect(mySqrt(2)).toBe(1);
      expect(mySqrt(99)).toBe(9);
      expect(mySqrt(100)).toBe(10);
    } finally { restore(); }
  });

  it('handles 0 and 1', () => {
    noSqrt();
    try {
      expect(mySqrt(0)).toBe(0);
      expect(mySqrt(1)).toBe(1);
    } finally { restore(); }
  });

  it('handles large values', () => {
    noSqrt();
    try {
      expect(mySqrt(2147395599)).toBe(46339);
      expect(mySqrt(2147483647)).toBe(46340);
      expect(mySqrt(Number.MAX_SAFE_INTEGER)).toBe(94906265);
      expect(mySqrt(94906265 * 94906265)).toBe(94906265);
    } finally { restore(); }
  });

  it('matches the true floor sqrt for 1..2000', () => {
    noSqrt();
    try {
      for (let x = 1; x <= 2000; x++) {
        const r = mySqrt(x);
        if (r * r > x || (r + 1) * (r + 1) <= x) throw new Error('wrong for ' + x);
      }
    } finally { restore(); }
  });
});
```

%% hints
- `let lo = 0, hi = x;` and loop `while (lo < hi)`.
- `const mid = Math.ceil((lo + hi) / 2); if (mid <= x / mid) lo = mid; else hi = mid - 1;`
- Return `lo`. (For `mid = 0`, `x / mid` is `Infinity`/`NaN`: `ceil` of a positive range never picks 0 when `lo < hi`.)

%% solution
```js
export function mySqrt(x) {
  let lo = 0;
  let hi = x;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (mid <= x / mid) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}
```

%% exercise alg-kth-smallest | K-th smallest with quickselect | 4 | js | js | kthSmallest | 36
Return the **k-th smallest** value of `nums` (`k = 1` is the minimum; duplicates count separately). Use **quickselect**: partition around a random pivot and keep only the side that contains the answer. Average **O(n)**. Don't call `Array#sort` (the tests make it throw) and don't modify the input.

```js
kthSmallest([7, 2, 9, 4, 3, 8, 5], 3); // 4
kthSmallest([7, 7, 7, 7], 2);          // 7
```

The tests include **200 000 equal values**, which makes a naive partition that doesn't treat "equal" specially run in quadratic time.

%% worked
**A similar problem, solved: `countLess(nums, pivot)`** — the step that tells you which side to keep.

```js
function countLess(nums, pivot) {
  let less = 0, equal = 0;
  for (const x of nums) { if (x < pivot) less++; else if (x === pivot) equal++; }
  return { less, equal };                       // ① positions 1..less are smaller; the next `equal` are the pivot value
}
```

Given those counts, the k-th smallest is in one of **three** places: if `k <= less` it is among the smaller items; if `k <= less + equal` it **is** the pivot value (done); otherwise it is among the larger items and the rank shrinks to `k - less - equal`. Splitting into `<`, `=` and `>` (a **three-way partition**) is what keeps all-equal arrays fast.

%% explain
- **1-based `k`**: `k = 1` → minimum.
- **Random pivot** value from the current items.
- **Three groups**: smaller, equal, larger; keep just the group that holds rank `k`.
- **All equal** → returns immediately.
- **Input untouched**; **no `Array#sort`**.

%% nudge
- After counting the smaller and equal items, which three cases can `k` fall into?
- Why does treating equal items as their own group fix the all-equal case?

%% starter
```js
export function kthSmallest(nums, k) {
  // your code
  return undefined;
}
```

%% tests
```js
describe('kthSmallest', () => {
  const realSort = Array.prototype.sort;
  const noSort = () => { Array.prototype.sort = function () { throw new Error('do not use Array#sort'); }; };
  const restore = () => { Array.prototype.sort = realSort; };

  it('finds the k-th smallest', () => {
    noSort();
    try {
      expect(kthSmallest([7, 2, 9, 4, 3, 8, 5], 3)).toBe(4);
      expect(kthSmallest([3, 2, 1, 5, 6, 4], 1)).toBe(1);
      expect(kthSmallest([3, 2, 1, 5, 6, 4], 6)).toBe(6);
    } finally { restore(); }
  });

  it('counts duplicates separately', () => {
    noSort();
    try {
      expect(kthSmallest([7, 7, 7, 7], 2)).toBe(7);
      expect(kthSmallest([1, 2, 2, 3], 3)).toBe(2);
      expect(kthSmallest([5, 1, 1, 5], 3)).toBe(5);
    } finally { restore(); }
  });

  it('works on single items and negatives', () => {
    noSort();
    try {
      expect(kthSmallest([42], 1)).toBe(42);
      expect(kthSmallest([-5, -1, -3], 2)).toBe(-3);
    } finally { restore(); }
  });

  it('matches a sorted copy on random arrays', () => {
    let seed = 12;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 40;
    const cases = [];
    for (let round = 0; round < 30; round++) {
      const nums = Array.from({ length: 25 }, rand);
      const sorted = nums.slice().sort((a, b) => a - b);
      cases.push([nums, 1 + (round % 25), sorted[round % 25]]);
    }
    noSort();
    try {
      for (const [nums, k, expected] of cases) expect(kthSmallest(nums, k)).toBe(expected);
    } finally { restore(); }
  });

  it('does not modify the input', () => {
    const input = [3, 1, 2];
    kthSmallest(input, 2);
    expect(input).toEqual([3, 1, 2]);
  });

  it('is fast on 500 000 random values and on 200 000 equal values', () => {
    const nums = Array.from({ length: 500000 }, (_, i) => (i * 7919) % 500009);
    const equal = new Array(200000).fill(5);
    noSort();
    try {
      const t = Date.now();
      expect(kthSmallest(nums, 250000)).toBeGreaterThanOrEqual(0);
      expect(kthSmallest(equal, 100000)).toBe(5);
      expect(Date.now() - t).toBeLessThan(1500);
    } finally { restore(); }
  });
});
```

%% hints
- Loop: pick `pivot = items[random index]`, then build `less`, `equal` counts (and lists, or recompute `greater` only when needed).
- `if (k <= less.length) items = less; else if (k <= less.length + equalCount) return pivot; else { k -= less.length + equalCount; items = greater; }`

%% solution
```js
export function kthSmallest(nums, k) {
  let items = nums;
  while (true) {
    const pivot = items[Math.floor(Math.random() * items.length)];
    const less = [];
    const greater = [];
    let equal = 0;
    for (const x of items) {
      if (x < pivot) less.push(x);
      else if (x > pivot) greater.push(x);
      else equal++;
    }
    if (k <= less.length) {
      items = less;
    } else if (k <= less.length + equal) {
      return pivot;
    } else {
      k -= less.length + equal;
      items = greater;
    }
  }
}
```

%% exercise alg-min-eating-speed | Minimum eating speed | 3 | js | js | minEatingSpeed | 24
There are piles of bananas (`piles[i]`) and `h` hours. Each hour you pick one pile and eat up to `k` bananas from it (leftovers stay for later hours; you can't move on to the next pile in the same hour). Return the **smallest integer `k`** that lets you finish **within `h` hours**. It is guaranteed that `h >= piles.length`. It must be **O(n log max)**: 100 000 piles are tested.

```js
minEatingSpeed([3, 6, 7, 11], 8); // 4
```

%% worked
**A similar problem, solved: `fewestPagesPerDay(pages, days)`** — the same pattern with different words.

```js
function fewestPagesPerDay(chapters, days) {
  let lo = 1, hi = chapters.reduce((a, b) => a + b, 0);       // ① candidate answers: 1 … all pages in a single day
  const daysNeeded = (perDay) => chapters.reduce((d, c) => d + Math.ceil(c / perDay), 0);   // ② the yes/no test: O(n)
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (daysNeeded(mid) <= days) hi = mid;     // ③ fast enough: the answer is mid or smaller
    else lo = mid + 1;                         // ④ too slow: the answer is bigger
  }
  return lo;
}
```

For bananas: candidates `1 … max(piles)`, and the test is `sum of ceil(pile / k) <= h`. A higher speed never needs more hours, so the answers read `no no no yes yes yes`; find the first `yes`.

%% explain
- **Hours needed at speed `k`**: `sum(Math.ceil(pile / k))`.
- **Binary search `k`** over `1 … max(piles)`.
- **Monotone**: faster never takes longer.
- **Result** is the smallest `k` that fits.

%% nudge
- What is the largest speed you would ever need to consider?
- When the test passes at `mid`, can the answer be smaller than `mid`?

%% starter
```js
export function minEatingSpeed(piles, h) {
  // your code
  return 0;
}
```

%% tests
```js
describe('minEatingSpeed', () => {
  it('finds the slowest sufficient speed', () => {
    expect(minEatingSpeed([3, 6, 7, 11], 8)).toBe(4);
    expect(minEatingSpeed([30, 11, 23, 4, 20], 5)).toBe(30);
    expect(minEatingSpeed([30, 11, 23, 4, 20], 6)).toBe(23);
  });

  it('handles a single pile', () => {
    expect(minEatingSpeed([10], 5)).toBe(2);
    expect(minEatingSpeed([10], 1)).toBe(10);
  });

  it('handles lots of time', () => {
    expect(minEatingSpeed([5, 5, 5], 1000)).toBe(1);
  });

  it('matches brute force on random inputs', () => {
    let seed = 8;
    const rand = (m) => ((seed = (seed * 48271) % 2147483647) % m) + 1;
    for (let round = 0; round < 25; round++) {
      const piles = Array.from({ length: 1 + (round % 6) }, () => rand(40));
      const h = piles.length + rand(30);
      let k = 1;
      while (piles.reduce((s, p) => s + Math.ceil(p / k), 0) > h) k++;
      expect(minEatingSpeed(piles, h)).toBe(k);
    }
  });

  it('is fast: 100 000 piles of up to a billion bananas', () => {
    const piles = Array.from({ length: 100000 }, (_, i) => 1 + ((i * 7919) % 1000000000));
    const t = Date.now();
    const k = minEatingSpeed(piles, 150000);
    expect(Date.now() - t).toBeLessThan(1500);
    expect(k).toBeGreaterThan(1);
    expect(piles.reduce((s, p) => s + Math.ceil(p / k), 0)).toBeLessThanOrEqual(150000);
    expect(piles.reduce((s, p) => s + Math.ceil(p / (k - 1)), 0)).toBeGreaterThan(150000);
  });
});
```

%% hints
- `lo = 1`, `hi = Math.max(...piles)` (or a loop for huge arrays), and a helper `hours(k)`.
- `while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (hours(mid) <= h) hi = mid; else lo = mid + 1; }`

%% solution
```js
export function minEatingSpeed(piles, h) {
  let lo = 1;
  let hi = 1;
  for (const p of piles) if (p > hi) hi = p;
  const hours = (k) => {
    let total = 0;
    for (const p of piles) total += Math.ceil(p / k);
    return total;
  };
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (hours(mid) <= h) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}
```

%% exercise alg-search-rotated | Search a rotated sorted array | 4 | js | js | searchRotated | 36
A sorted array of **distinct** numbers was **rotated** at an unknown point: `[0, 1, 2, 4, 5, 6, 7]` can become `[4, 5, 6, 7, 0, 1, 2]`. Return the **index** of `target`, or `-1`. It must be **O(log n)**: the tests count how many items you read from a million-element array.

```js
searchRotated([4, 5, 6, 7, 0, 1, 2], 0); // 4
searchRotated([4, 5, 6, 7, 0, 1, 2], 3); // -1
```

%% worked
**A similar problem, solved: `findMinRotated(nums)`** — the smallest value in a rotated sorted array.

```js
function findMinRotated(nums) {
  let lo = 0, hi = nums.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] > nums[hi]) lo = mid + 1;     // ① the break (and the minimum) is to the right of mid
    else hi = mid;                              // ② mid could be the minimum: keep it
  }
  return nums[lo];
}
```

For searching, use the same fact: at any `mid`, **one half is sorted**. If `nums[lo] <= nums[mid]` the **left** half is sorted: if the target lies in `[nums[lo], nums[mid])` search left, otherwise right. If not, the **right** half is sorted: check `(nums[mid], nums[hi]]` the same way.

%% explain
- **Distinct values**, rotated ascending array.
- **At each step** find which half is sorted, then test whether the target is in it.
- **O(log n)**: only a handful of reads.
- **Not found** → `-1`.

%% nudge
- How can you tell, by comparing `nums[lo]` and `nums[mid]`, that the left half is sorted?
- If the target is not inside the sorted half, where must it be?

%% starter
```js
export function searchRotated(nums, target) {
  // your code
  return -1;
}
```

%% tests
```js
describe('searchRotated', () => {
  it('finds items in a rotated array', () => {
    const a = [4, 5, 6, 7, 0, 1, 2];
    expect(searchRotated(a, 0)).toBe(4);
    expect(searchRotated(a, 4)).toBe(0);
    expect(searchRotated(a, 7)).toBe(3);
    expect(searchRotated(a, 2)).toBe(6);
  });

  it('returns -1 when absent', () => {
    expect(searchRotated([4, 5, 6, 7, 0, 1, 2], 3)).toBe(-1);
    expect(searchRotated([4, 5, 6, 7, 0, 1, 2], 8)).toBe(-1);
    expect(searchRotated([], 1)).toBe(-1);
  });

  it('handles arrays that are not rotated and tiny arrays', () => {
    expect(searchRotated([1, 2, 3, 4], 3)).toBe(2);
    expect(searchRotated([1], 1)).toBe(0);
    expect(searchRotated([1], 0)).toBe(-1);
    expect(searchRotated([3, 1], 1)).toBe(1);
    expect(searchRotated([3, 1], 3)).toBe(0);
  });

  it('matches indexOf on every rotation of a small array', () => {
    const base = [1, 3, 5, 7, 9, 11, 13];
    for (let r = 0; r < base.length; r++) {
      const arr = base.slice(r).concat(base.slice(0, r));
      for (const target of [0, 1, 3, 5, 7, 9, 11, 13, 14]) expect(searchRotated(arr, target)).toBe(arr.indexOf(target));
    }
  });

  it('is logarithmic on a million items', () => {
    const n = 1000000, r = 337000;
    let reads = 0;
    const nums = new Proxy({ length: n }, { get: (t, key) => (key === 'length' ? n : (reads++, (Number(key) + r) % n)) });
    const indexOf = (v) => (v - r + n) % n;
    expect(searchRotated(nums, 5)).toBe(indexOf(5));
    expect(reads).toBeLessThan(120);
    reads = 0;
    expect(searchRotated(nums, 999999)).toBe(indexOf(999999));
    expect(reads).toBeLessThan(120);
    reads = 0;
    expect(searchRotated(nums, -1)).toBe(-1);
    expect(reads).toBeLessThan(120);
  });
});
```

%% hints
- `lo = 0, hi = nums.length - 1`; loop while `lo <= hi`; `mid = (lo + hi) >> 1`; return `mid` if `nums[mid] === target`.
- If `nums[lo] <= nums[mid]` the left half is sorted: if `nums[lo] <= target && target < nums[mid]` then `hi = mid - 1`, else `lo = mid + 1`.
- Otherwise the right half is sorted: if `nums[mid] < target && target <= nums[hi]` then `lo = mid + 1`, else `hi = mid - 1`.

%% solution
```js
export function searchRotated(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (nums[mid] === target) return mid;
    if (nums[lo] <= nums[mid]) {
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}
```
