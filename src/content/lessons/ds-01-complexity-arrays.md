---
id: ds-arrays
track: ds
title: Complexity & arrays: what they cost
summary: Big-O you can feel, how an array really sits in memory, why push is cheap and shift is not, and the two moves (two pointers, binary search) that beat a nested loop.
---

## The idea in one sentence

A data structure is **a way of arranging data so that the operations you need are cheap** — and every choice trades one cost for another, which is why you need to know what each operation really costs.

> **Analogy** A row of numbered lockers: if you know the number, you walk straight to it (fast). If you only know what's *inside*, you open them one by one (slow). Arrays are the row of lockers; everything else in this track is a cleverer way to arrange the lockers for a different question.

## Big-O in plain words

Big-O describes **how the work grows when the input grows**, ignoring constants.

| Notation | Plain meaning | Example |
| --- | --- | --- |
| **O(1)** | the same work for any size | `arr[i]` |
| **O(log n)** | the work grows by one step each time the input *doubles* | binary search |
| **O(n)** | the work grows in step with the input | scanning with `includes` |
| **O(n log n)** | scan, but with a log factor | a good sort |
| **O(n²)** | work grows with the *square* | a loop inside a loop over the same data |

Two habits make you fast at this: **count the loops that depend on the input**, and **spot the hidden loops** — `includes`, `indexOf`, `slice`, spread and `shift` all hide an O(n) scan inside one line.

```js try predict
const small = Array.from({ length: 2000 }, (_, i) => i);
const t0 = performance.now();
let hits = 0;
for (const x of small) if (small.includes(x)) hits++;   // a loop hiding a loop
console.log(hits, 'hits — about', 2000 * 2000 / 2, 'comparisons');
```

## How an array sits in memory

![An array is a contiguous row of slots; index i is found by arithmetic](fig:ds-array-memory "Contiguous slots make reads O(1): the address is start + i × slot size.")

Conceptually an array is **one contiguous block** of equal-sized slots. To read `arr[3]` the machine doesn't search — it computes `start + 3 × slot size` and goes there. That is why **indexing is O(1)** whatever the length.

(JavaScript engines are cleverer and messier than this picture — sparse arrays, mixed types — but dense arrays of one type behave like it, and the costs below hold.)

## Why `push` is cheap and `shift` is not

A real array has a fixed block. A *dynamic* array (JavaScript's `Array`, Java's `ArrayList`, Python's `list`) hides that: when the block is full it **allocates a bigger one, copies everything over, and carries on**.

![A full array of capacity 2 grows to capacity 4 by copying](fig:ds-array-growth "Doubling the capacity makes resizes rare: the total copying over n pushes is under 2n.")

If it grew by one slot each time, every push would copy everything → O(n) each. **Doubling** makes resizes rare, so the average cost of a push is **O(1) amortised**: sometimes expensive, cheap on average.

```stepper Pushing into a dynamic array
code:
  const a = new DynamicArray();   // capacity 2
  a.push('a');
  a.push('b');
  a.push('c');                    // full → grow
  a.push('d');
---
line: 1
say: A new array starts with a small **capacity** (2 here) and **length** 0.
capacity: 2
length: 0
slots: _ | _
---
line: 2-3
say: Two pushes fill it. Each push just writes into the next free slot — **O(1)**.
length: 2
slots: a | b
---
line: 4
say: `push('c')` finds no room. The array **allocates a block of double the size** (4), **copies** `a` and `b` over (2 copies), then writes `c`.
capacity: 4
length: 3
slots: a | b | c | _
---
line: 5
say: `push('d')` fits in the existing room again — **O(1)**. The next resize will be at the 5th push, copying 4.
length: 4
slots: a | b | c | d
```

`shift()` (remove the **first** item) is different: every other item must **slide one slot left**. That is **O(n)** every time — so `while (queue.length) queue.shift()` over a big array is secretly O(n²).

![Costs of common array operations](fig:ds-array-costs "Know which operations are a single step and which hide a scan.")

## Two pointers

Many "scan with a nested loop" problems become **one pass** if you keep two indexes that move towards each other, or one behind the other:

```js try
// Is this *sorted* array free of duplicates? Compare neighbours, one pass.
function hasNoDuplicates(sorted) {
  for (let i = 1; i < sorted.length; i++) if (sorted[i] === sorted[i - 1]) return false;
  return true;
}
console.log(hasNoDuplicates([1, 2, 4, 7]), hasNoDuplicates([1, 2, 2, 7]));
```

The pattern for **in-place** edits is a **read pointer** that scans every item and a **write pointer** that marks where the next *kept* item goes. You'll use it in the exercises.

## Binary search: halve the problem

If an array is **sorted**, you never need to look at everything: check the middle, and throw away the half that can't contain the target.

![Binary search halves the range each step](fig:ds-binary-search "Eight items need at most 3 looks; a million need about 20.")

```stepper Binary search for 23
code:
  function search(nums, target) {
    let lo = 0, hi = nums.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (nums[mid] === target) return mid;
      if (nums[mid] < target) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }
  search([2, 5, 8, 12, 16, 23, 38, 56], 23);
---
line: 2
say: The search range is the whole array: indexes `lo = 0` to `hi = 7`.
lo: 0
hi: 7
---
line: 4
say: Look at the **middle**: `mid = 3`, and `nums[3]` is `12`.
mid: 3
value: 12
---
line: 6
say: `12 < 23`, so the target can only be to the **right**. Discard `lo … mid` by setting `lo = mid + 1`.
lo: 4
hi: 7
---
line: 4-5
say: New middle: `mid = 5`, and `nums[5]` is `23` — **found**. Two looks instead of up to eight.
mid: 5
value: 23
Result: 5
```

Each step halves the range, so the cost is **O(log n)**. The two classic mistakes are `lo = mid` (it can loop forever — always move *past* `mid`) and forgetting the `<=` (so a one-item range is never checked).

## Quick check

```check
Q: What is the time complexity of reading `arr[i]` in a dynamic array?
A) O(n), the array scans to index i
B) O(log n)
C) O(1), the address is computed directly *
D) It depends on the value stored
Why: Slots are equal-sized and contiguous, so the address is start + i × size. No scanning.
---
Q: Why is `push` amortised O(1) even though resizing copies the whole array?
A) Resizing never happens
B) The capacity doubles, so resizes are rare and the total copying over n pushes is under 2n *
C) Copying is free in JavaScript
D) Push writes to a linked list
Why: A copy of size n happens only after about n cheap pushes, so the cost spread over all pushes is constant on average.
---
Q: A loop calls `queue.shift()` until a 100 000-item array is empty. What is the total cost?
A) O(n)
B) O(n²), because each shift moves every remaining item *
C) O(log n)
D) O(1)
Why: Each `shift` re-indexes the rest. n shifts of up to n moves each is quadratic.
---
Q: Binary search needs which precondition?
A) The array has no duplicates
B) The array holds numbers only
C) The array is sorted *
D) The array length is a power of two
Why: Discarding half the range is only valid if the order tells you which half can contain the target.
---
Q: In an in-place "remove duplicates" with a read pointer and a write pointer, what does the write pointer mark?
A) The item currently being inspected
B) Where the next kept item will be written *
C) The end of the array
D) The last duplicate
Why: The read pointer scans everything; the write pointer only advances when an item is kept, so the front of the array becomes the answer.
```

## Recap

- **Big-O** is about growth. Count the loops, and hunt for hidden ones (`includes`, `indexOf`, `slice`, `shift`).
- **Indexing is O(1)** because an array is a contiguous block; **push/pop are amortised O(1)** because capacity doubles; **shift/unshift/middle inserts are O(n)**.
- **Two pointers** (read/write, or low/high) turn nested loops into one pass.
- **Binary search** on sorted data is **O(log n)**: move *past* `mid`, loop while `lo <= hi`.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: binary search | The binary-search stepper |
| Dynamic array | The growth figure: allocate, copy, then write |
| Remove duplicates in place | Read and write pointers |
| Rotate an array | Reversal, three times |
| First and last position | Binary search that keeps going after a hit |
| Merge sorted arrays | Two pointers, filled from the back |

%% exercise dst-guided-binary-search | Guided: binary search | 1 | js | js | binarySearch | 6 | guided
Write `binarySearch(nums, target)` for a **sorted** array of numbers. Return the **index** of `target`, or `-1` if it isn't there.

```js
binarySearch([2, 5, 8, 12, 16, 23, 38, 56], 23); // 5
binarySearch([2, 5, 8], 7);                      // -1
```

It must be **O(log n)** — a one-million-element array is tested with a counter on the comparisons.

%% worked
**A similar problem, solved: `insertPosition(nums, target)`** — where would `target` go to keep the array sorted?

```js
function insertPosition(nums, target) {
  let lo = 0, hi = nums.length;            // ① the answer can be nums.length ("after everything")
  while (lo < hi) {                        // ② the range is [lo, hi)
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] < target) lo = mid + 1;  // ③ too small → answer is to the right
    else hi = mid;                         // ④ big enough → mid could be the answer, keep it
  }
  return lo;
}
```

Same idea as the lesson: look at the middle, throw away the half that can't contain the answer. Here the range is half-open, so the loop is `lo < hi` and one side keeps `mid` instead of skipping it. For `binarySearch`, return `mid` the moment you see the target.

%% explain
- **Returns the index** of the target in the sorted array.
- **Returns `-1`** when it is absent, including for an empty array.
- **Logarithmic**: the test counts how many elements you read.

%% nudge
- Which half can you throw away after comparing `nums[mid]` with `target`?
- When does the loop end if the target is not there?

%% starter
```js
export function binarySearch(nums, target) {
  // Step 1 — let lo = 0, hi = nums.length - 1.
  // Step 2 — while (lo <= hi): mid = Math.floor((lo + hi) / 2).
  // Step 3 — equal → return mid; too small → lo = mid + 1; too big → hi = mid - 1.
  // Step 4 — nothing found: return -1.
  return 0;
}
```

%% tests
```js
describe('binarySearch', () => {
  it('finds items', () => {
    const a = [2, 5, 8, 12, 16, 23, 38, 56];
    expect(binarySearch(a, 23)).toBe(5);
    expect(binarySearch(a, 2)).toBe(0);
    expect(binarySearch(a, 56)).toBe(7);
  });

  it('returns -1 when absent', () => {
    expect(binarySearch([2, 5, 8], 7)).toBe(-1);
    expect(binarySearch([2, 5, 8], 1)).toBe(-1);
    expect(binarySearch([2, 5, 8], 9)).toBe(-1);
  });

  it('handles empty and single-element arrays', () => {
    expect(binarySearch([], 1)).toBe(-1);
    expect(binarySearch([4], 4)).toBe(0);
    expect(binarySearch([4], 5)).toBe(-1);
  });

  it('is logarithmic', () => {
    let reads = 0;
    const n = 1000000;
    const nums = new Proxy({ length: n }, { get: (t, k) => (k === 'length' ? n : (reads++, Number(k) * 2)) });
    expect(binarySearch(nums, 1234 * 2)).toBe(1234);
    expect(reads).toBeLessThan(60);
    reads = 0;
    expect(binarySearch(nums, 7)).toBe(-1);
    expect(reads).toBeLessThan(60);
  });
});
```

%% hints
- `Math.floor((lo + hi) / 2)` is the middle. Keep `lo <= hi` as the loop condition.
- After a miss, move *past* `mid` (`mid + 1` / `mid - 1`), never to `mid` itself.

%% solution
```js
export function binarySearch(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}
```

%% exercise dst-dynamic-array | Build a dynamic array | 2 | js | js | DynamicArray | 15
Build `class DynamicArray` on top of a **fixed-size** block, the way real arrays work.

- `new DynamicArray()` starts with **capacity 2** and **length 0**. `capacity` and `length` are readable properties.
- `push(x)` adds at the end. If the block is full, allocate a block of **double** the capacity, copy the items over, then add. Returns the new length.
- `get(i)` returns the item at `i`, or `undefined` if `i` is out of range.
- `set(i, x)` overwrites an existing index; **throws a `RangeError`** if `i` is out of range.
- `pop()` removes and returns the last item (or `undefined` if empty). It does not need to shrink the block.
- `resizes` counts how many times the block was replaced.

Use `new Array(capacity)` for the block, but **don't call `push` / `splice` on it** — the point is to do it yourself.

%% worked
**A similar problem, solved: a `Stack` with a fixed capacity** — `push` throws when full.

```js
class FixedStack {
  constructor(capacity) { this.items = new Array(capacity); this.length = 0; }   // ① a fixed block + a length
  push(x) {
    if (this.length === this.items.length) throw new RangeError('full');          // ② full: this one cannot grow
    this.items[this.length++] = x;                                                  // ③ write at the next free slot
    return this.length;
  }
  pop() {
    if (this.length === 0) return undefined;
    const x = this.items[--this.length];
    this.items[this.length] = undefined;                                            // ④ don't keep a stale reference
    return x;
  }
}
```

A dynamic array is this plus one step: instead of throwing at ②, **allocate a bigger block, copy, swap**, then continue. Notice `length` (how many are used) and `capacity` (how many fit) are two separate numbers.

%% explain
- **`capacity` starts at 2** and doubles when `push` finds no room: 2, 4, 8, 16…
- **`length` ≠ `capacity`**: length is how many items are stored.
- **`get`** is safe (returns `undefined` out of range); **`set`** is strict (throws `RangeError`).
- **`resizes`** counts block replacements, so 9 pushes → 3 resizes (at items 3, 5 and 9).

%% nudge
- What must you do *before* writing the item when `length === capacity`?
- After growing, which array does `this.items` point to?

%% starter
```js
export class DynamicArray {
  constructor() {
    this.items = new Array(2);
    this.length = 0;
    this.resizes = 0;
  }

  get capacity() {
    return this.items.length;
  }

  push(x) {
    // your code
  }

  get(i) {
    // your code
  }

  set(i, x) {
    // your code
  }

  pop() {
    // your code
  }
}
```

%% tests
```js
describe('DynamicArray', () => {
  it('starts empty with capacity 2', () => {
    const a = new DynamicArray();
    expect(a.length).toBe(0);
    expect(a.capacity).toBe(2);
    expect(a.get(0)).toBeUndefined();
  });

  it('pushes and reads back', () => {
    const a = new DynamicArray();
    expect(a.push('a')).toBe(1);
    expect(a.push('b')).toBe(2);
    expect(a.get(0)).toBe('a');
    expect(a.get(1)).toBe('b');
    expect(a.get(2)).toBeUndefined();
    expect(a.get(-1)).toBeUndefined();
  });

  it('doubles the capacity when full', () => {
    const a = new DynamicArray();
    a.push(1); a.push(2);
    expect(a.capacity).toBe(2);
    a.push(3);
    expect(a.capacity).toBe(4);
    a.push(4); a.push(5);
    expect(a.capacity).toBe(8);
    expect([0, 1, 2, 3, 4].map((i) => a.get(i))).toEqual([1, 2, 3, 4, 5]);
  });

  it('counts resizes', () => {
    const a = new DynamicArray();
    for (let i = 0; i < 9; i++) a.push(i);
    expect(a.resizes).toBe(3);
    expect(a.capacity).toBe(16);
  });

  it('set overwrites and rejects bad indexes', () => {
    const a = new DynamicArray();
    a.push('x'); a.push('y');
    a.set(1, 'z');
    expect(a.get(1)).toBe('z');
    expect(() => a.set(2, 'w')).toThrow(RangeError);
    expect(() => a.set(-1, 'w')).toThrow(RangeError);
  });

  it('pops from the end', () => {
    const a = new DynamicArray();
    expect(a.pop()).toBeUndefined();
    a.push(1); a.push(2); a.push(3);
    expect(a.pop()).toBe(3);
    expect(a.length).toBe(2);
    expect(a.get(2)).toBeUndefined();
    a.push(9);
    expect(a.get(2)).toBe(9);
  });

  it('is amortised O(1): 200 000 pushes are fast', () => {
    const a = new DynamicArray();
    const t = Date.now();
    for (let i = 0; i < 200000; i++) a.push(i);
    expect(a.length).toBe(200000);
    expect(a.get(199999)).toBe(199999);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- Full means `this.length === this.items.length`. Then: `const bigger = new Array(this.items.length * 2)`, copy with a `for` loop, `this.items = bigger`, `this.resizes++`.
- `get` / `set` must check `i >= 0 && i < this.length` (an index past `length` is out of range even if the block has room).
- In `pop`, decrement `length` and clear the old slot.

%% solution
```js
export class DynamicArray {
  constructor() {
    this.items = new Array(2);
    this.length = 0;
    this.resizes = 0;
  }

  get capacity() {
    return this.items.length;
  }

  push(x) {
    if (this.length === this.items.length) {
      const bigger = new Array(this.items.length * 2);
      for (let i = 0; i < this.length; i++) bigger[i] = this.items[i];
      this.items = bigger;
      this.resizes++;
    }
    this.items[this.length++] = x;
    return this.length;
  }

  get(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this.length) return undefined;
    return this.items[i];
  }

  set(i, x) {
    if (!Number.isInteger(i) || i < 0 || i >= this.length) throw new RangeError('index out of range');
    this.items[i] = x;
  }

  pop() {
    if (this.length === 0) return undefined;
    const x = this.items[--this.length];
    this.items[this.length] = undefined;
    return x;
  }
}
```

%% exercise dst-remove-duplicates | Remove duplicates in place | 2 | js | js | removeDuplicates | 12
Given a **sorted** array of numbers, remove duplicates **in place** so each value appears once. Return the **new length** `k`; the first `k` items of the array must be the unique values in order. What is beyond `k` doesn't matter.

```js
const a = [1, 1, 2, 2, 2, 3];
removeDuplicates(a); // 3  → a starts [1, 2, 3, …]
```

Use **O(1) extra memory** — no new array, no `Set`.

%% worked
**A similar problem, solved: `removeValue(nums, val)`** — remove every `val` in place and return the new length.

```js
function removeValue(nums, val) {
  let write = 0;                          // ① where the next kept item goes
  for (let read = 0; read < nums.length; read++) {   // ② read looks at every item
    if (nums[read] !== val) {
      nums[write] = nums[read];           // ③ keep it: copy it to the write spot
      write++;                            // ④ the kept region grows by one
    }
  }
  return write;                           // ⑤ write = how many we kept
}
```

The read pointer visits everything; the write pointer only moves when an item is kept, so the front of the array *becomes* the result. For sorted duplicates, "keep it" means *"it's different from the last kept item"*.

%% explain
- **Returns `k`**, the count of unique values.
- **`nums[0..k-1]`** holds those values in their original order.
- **In place**: the same array object is modified; no auxiliary array or Set.
- Works for an **empty array** (returns `0`) and for **all-equal** arrays (returns `1`).

%% nudge
- Since the array is sorted, what does a duplicate look like compared with the last item you kept?
- Which pointer should start at 1?

%% starter
```js
export function removeDuplicates(nums) {
  // your code
  return nums.length;
}
```

%% tests
```js
describe('removeDuplicates', () => {
  it('removes duplicates in place', () => {
    const a = [1, 1, 2, 2, 2, 3];
    const k = removeDuplicates(a);
    expect(k).toBe(3);
    expect(a.slice(0, k)).toEqual([1, 2, 3]);
  });

  it('handles all-equal and all-unique inputs', () => {
    const a = [4, 4, 4, 4];
    expect(removeDuplicates(a)).toBe(1);
    expect(a[0]).toBe(4);
    const b = [1, 2, 3];
    expect(removeDuplicates(b)).toBe(3);
    expect(b.slice(0, 3)).toEqual([1, 2, 3]);
  });

  it('handles empty and single-element arrays', () => {
    expect(removeDuplicates([])).toBe(0);
    const a = [9];
    expect(removeDuplicates(a)).toBe(1);
  });

  it('handles negatives', () => {
    const a = [-3, -3, -1, 0, 0, 2];
    const k = removeDuplicates(a);
    expect(a.slice(0, k)).toEqual([-3, -1, 0, 2]);
  });

  it('mutates the same array and is linear', () => {
    const big = Array.from({ length: 200000 }, (_, i) => Math.floor(i / 2));
    const ref = big;
    const t = Date.now();
    const k = removeDuplicates(big);
    expect(Date.now() - t).toBeLessThan(500);
    expect(k).toBe(100000);
    expect(big).toBe(ref);
    expect(big[99999]).toBe(99999);
  });
});
```

%% hints
- Keep `write = 1` (the first item is always kept). Loop `read` from 1.
- If `nums[read] !== nums[write - 1]`, copy it to `nums[write]` and increment `write`.

%% solution
```js
export function removeDuplicates(nums) {
  if (nums.length === 0) return 0;
  let write = 1;
  for (let read = 1; read < nums.length; read++) {
    if (nums[read] !== nums[write - 1]) {
      nums[write] = nums[read];
      write++;
    }
  }
  return write;
}
```

%% exercise dst-rotate | Rotate an array | 2 | js | js | rotate | 15
Rotate `nums` **to the right by `k` steps, in place**. `k` can be larger than the length, or `0`.

```js
const a = [1, 2, 3, 4, 5, 6, 7];
rotate(a, 3); // a is now [5, 6, 7, 1, 2, 3, 4]
```

Use **O(1) extra memory** and **O(n)** time: no new array, no `splice` / `shift` loop.

%% worked
**A similar problem, solved: `reverseInPlace(nums)`** — the building block.

```js
function reverseInPlace(nums, lo = 0, hi = nums.length - 1) {
  while (lo < hi) {                                  // ① two pointers walking towards each other
    [nums[lo], nums[hi]] = [nums[hi], nums[lo]];     // ② swap the ends
    lo++; hi--;
  }
}
```

A right rotation by `k` is a neat trick: **reverse everything, then reverse the first `k` items, then reverse the rest.** For `[1,2,3,4,5,6,7]` and `k = 3`: reverse all → `[7,6,5,4,3,2,1]`; reverse the first 3 → `[5,6,7,4,3,2,1]`; reverse the last 4 → `[5,6,7,1,2,3,4]`.

%% explain
- **Rotate right by `k`**: the last `k` items move to the front.
- **`k` is reduced modulo the length**: `k = 10` on 7 items is the same as `k = 3`.
- **In place**: the same array object ends up rotated; nothing is returned.
- **Empty or single-item arrays** and **`k = 0`** are unchanged.

%% nudge
- What is `k % nums.length` when `k` is bigger than the array?
- Can you write one helper that reverses a range, then call it three times?

%% starter
```js
export function rotate(nums, k) {
  // your code
}
```

%% tests
```js
describe('rotate', () => {
  it('rotates right by k', () => {
    const a = [1, 2, 3, 4, 5, 6, 7];
    rotate(a, 3);
    expect(a).toEqual([5, 6, 7, 1, 2, 3, 4]);
  });

  it('handles k larger than the length and k = 0', () => {
    const a = [1, 2, 3];
    rotate(a, 4);
    expect(a).toEqual([3, 1, 2]);
    const b = [1, 2, 3];
    rotate(b, 0);
    expect(b).toEqual([1, 2, 3]);
    const c = [1, 2, 3];
    rotate(c, 3);
    expect(c).toEqual([1, 2, 3]);
  });

  it('handles empty and single-element arrays', () => {
    const a = [];
    rotate(a, 5);
    expect(a).toEqual([]);
    const b = [1];
    rotate(b, 5);
    expect(b).toEqual([1]);
  });

  it('rotates in place and is linear', () => {
    const big = Array.from({ length: 200000 }, (_, i) => i);
    const ref = big;
    const t = Date.now();
    rotate(big, 50000);
    expect(Date.now() - t).toBeLessThan(500);
    expect(big).toBe(ref);
    expect(big[0]).toBe(150000);
    expect(big[50000]).toBe(0);
  });
});
```

%% hints
- Start with `k %= nums.length` (guard the empty array first).
- Write `reverse(lo, hi)` as a local helper, then: `reverse(0, n-1); reverse(0, k-1); reverse(k, n-1);`.

%% solution
```js
export function rotate(nums, k) {
  const n = nums.length;
  if (n < 2) return;
  k %= n;
  if (k === 0) return;
  const reverse = (lo, hi) => {
    while (lo < hi) {
      const t = nums[lo];
      nums[lo] = nums[hi];
      nums[hi] = t;
      lo++;
      hi--;
    }
  };
  reverse(0, n - 1);
  reverse(0, k - 1);
  reverse(k, n - 1);
}
```

%% exercise dst-search-range | First and last position | 3 | js | js | searchRange | 22
Given a **sorted** array that may contain **duplicates**, return `[first, last]` — the first and last index of `target` — or `[-1, -1]` if it isn't present.

```js
searchRange([5, 7, 7, 8, 8, 10], 8); // [3, 4]
searchRange([5, 7, 7, 8, 8, 10], 6); // [-1, -1]
```

It must be **O(log n)**: with a million equal values, scanning outwards from a hit is too slow.

%% worked
**A similar problem, solved: `countLessThan(nums, x)`** — how many items are strictly smaller than `x`?

```js
function countLessThan(nums, x) {
  let lo = 0, hi = nums.length;             // ① the answer is somewhere in [0, n]
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (nums[mid] < x) lo = mid + 1;        // ② mid is smaller → the boundary is to the right
    else hi = mid;                          // ③ mid is not smaller → the boundary is here or left
  }
  return lo;                                // ④ the first index whose value is >= x
}
```

That is a **lower bound**: the first index with `nums[i] >= x`. The first position of `target` is `lowerBound(target)` (if it holds `target`), and the last is `lowerBound(target + 1) - 1`. Two binary searches, each O(log n).

%% explain
- **Returns `[first, last]`** indexes of `target`.
- **`[-1, -1]`** when it is absent (including an empty array).
- **One occurrence** returns the same index twice: `[2, 2]`.
- **O(log n)**: a million-element array of one repeated value is tested.

%% nudge
- What does "the first index with value `>= x`" look like as a binary search?
- How would a second search find the end of the run?

%% starter
```js
export function searchRange(nums, target) {
  // your code
  return [-1, -1];
}
```

%% tests
```js
describe('searchRange', () => {
  it('finds a run of duplicates', () => {
    expect(searchRange([5, 7, 7, 8, 8, 10], 8)).toEqual([3, 4]);
    expect(searchRange([1, 2, 2, 2, 2, 3], 2)).toEqual([1, 4]);
  });

  it('finds a single occurrence', () => {
    expect(searchRange([1, 3, 5, 7], 5)).toEqual([2, 2]);
    expect(searchRange([4], 4)).toEqual([0, 0]);
  });

  it('returns [-1, -1] when absent', () => {
    expect(searchRange([5, 7, 7, 8, 8, 10], 6)).toEqual([-1, -1]);
    expect(searchRange([5, 7], 1)).toEqual([-1, -1]);
    expect(searchRange([5, 7], 9)).toEqual([-1, -1]);
    expect(searchRange([], 0)).toEqual([-1, -1]);
  });

  it('handles runs at the edges', () => {
    expect(searchRange([2, 2, 2, 5], 2)).toEqual([0, 2]);
    expect(searchRange([1, 5, 5, 5], 5)).toEqual([1, 3]);
    expect(searchRange([7, 7, 7], 7)).toEqual([0, 2]);
  });

  it('is logarithmic on a million equal values', () => {
    const nums = new Array(1000000).fill(3);
    const t = Date.now();
    expect(searchRange(nums, 3)).toEqual([0, 999999]);
    expect(searchRange(nums, 4)).toEqual([-1, -1]);
    expect(Date.now() - t).toBeLessThan(100);
  });
});
```

%% hints
- Write a helper `lowerBound(x)`: the first index where `nums[i] >= x` (or `nums.length`).
- `first = lowerBound(target)`. If `first === nums.length` or `nums[first] !== target`, return `[-1, -1]`.
- `last = lowerBound(target + 1) - 1`.

%% solution
```js
export function searchRange(nums, target) {
  const lowerBound = (x) => {
    let lo = 0, hi = nums.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (nums[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const first = lowerBound(target);
  if (first === nums.length || nums[first] !== target) return [-1, -1];
  return [first, lowerBound(target + 1) - 1];
}
```

%% exercise dst-merge-sorted | Merge sorted arrays in place | 3 | js | js | merge | 22
`nums1` has length `m + n`: its first `m` items are sorted, and the last `n` slots are **empty padding** (`0`). `nums2` has `n` sorted items. **Merge `nums2` into `nums1` in place** so `nums1` is fully sorted. Return nothing.

```js
const a = [1, 3, 5, 0, 0, 0];
merge(a, 3, [2, 4, 6], 3); // a is now [1, 2, 3, 4, 5, 6]
```

No extra array of size `m + n`. (Hint: where is there free room?)

%% worked
**A similar problem, solved: `mergeToNew(a, b)`** — merge into a *new* array with two pointers.

```js
function mergeToNew(a, b) {
  const out = [];
  let i = 0, j = 0;                        // ① one pointer per input
  while (i < a.length && j < b.length) {
    out.push(a[i] <= b[j] ? a[i++] : b[j++]);   // ② take the smaller front item
  }
  while (i < a.length) out.push(a[i++]);   // ③ one side ran out: copy the rest of the other
  while (j < b.length) out.push(b[j++]);
  return out;
}
```

Filling from the **front** of `nums1` would overwrite items you haven't read yet. But the **back** of `nums1` is free padding: fill from the back, taking the *largest* remaining item each time, and nothing is overwritten before it is used.

%% explain
- **In place**: `nums1` ends up sorted; nothing is returned.
- **Padding at the back** is overwritten with the largest items first.
- **`n = 0`** leaves `nums1` unchanged; **`m = 0`** copies all of `nums2`.
- **Duplicates** across the arrays are kept.

%% nudge
- Three indexes: the last real item of `nums1`, the last of `nums2`, and the last slot to write. Which end should you fill from?
- When `nums1`'s items run out, what is left to do?

%% starter
```js
export function merge(nums1, m, nums2, n) {
  // your code
}
```

%% tests
```js
describe('merge', () => {
  it('merges two sorted arrays in place', () => {
    const a = [1, 3, 5, 0, 0, 0];
    merge(a, 3, [2, 4, 6], 3);
    expect(a).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('handles all of nums2 being smaller', () => {
    const a = [4, 5, 6, 0, 0, 0];
    merge(a, 3, [1, 2, 3], 3);
    expect(a).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('handles empty inputs', () => {
    const a = [1, 2, 3];
    merge(a, 3, [], 0);
    expect(a).toEqual([1, 2, 3]);
    const b = [0, 0];
    merge(b, 0, [5, 9], 2);
    expect(b).toEqual([5, 9]);
  });

  it('keeps duplicates', () => {
    const a = [2, 2, 0, 0];
    merge(a, 2, [2, 2], 2);
    expect(a).toEqual([2, 2, 2, 2]);
  });

  it('does not allocate a merged copy and is linear', () => {
    const m = 100000, n = 100000;
    const a = Array.from({ length: m }, (_, i) => i * 2).concat(new Array(n).fill(0));
    const b = Array.from({ length: n }, (_, i) => i * 2 + 1);
    const ref = a;
    const t = Date.now();
    merge(a, m, b, n);
    expect(Date.now() - t).toBeLessThan(500);
    expect(a).toBe(ref);
    expect(a[0]).toBe(0);
    expect(a[1]).toBe(1);
    expect(a[199999]).toBe(199999);
  });
});
```

%% hints
- Use `i = m - 1`, `j = n - 1`, `k = m + n - 1`. Write the larger of `nums1[i]` and `nums2[j]` to `nums1[k]`, then move that pointer and `k` down.
- Loop `while (j >= 0)`: if `nums1`'s items run out first, just copy the rest of `nums2`; if `nums2` runs out, the remaining `nums1` items are already in place.

%% solution
```js
export function merge(nums1, m, nums2, n) {
  let i = m - 1, j = n - 1, k = m + n - 1;
  while (j >= 0) {
    if (i >= 0 && nums1[i] > nums2[j]) nums1[k--] = nums1[i--];
    else nums1[k--] = nums2[j--];
  }
}
```
