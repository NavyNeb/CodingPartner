---
id: ds-heaps
track: ds
title: Heaps & priority queues
summary: A structure that always hands you the smallest (or most urgent) item first: the heap property, the array trick, sift-up and sift-down, and the top-K, merge-K and running-median patterns it unlocks.
---

## The idea in one sentence

A **priority queue** always gives you the **most important item next**, and a **heap** is the clever array-based tree that makes both *adding* and *taking the next item* **O(log n)**.

> **Analogy** An emergency room: patients don't leave in arrival order (that's a queue) — the most urgent one is seen next, and a new arrival can jump the line. Sorting everyone after every arrival would be wasteful; a heap keeps *just enough* order to always know who's next.

## Why not just sort?

If you keep an array **sorted**, finding the minimum is instant but every insert shifts items (O(n)). If you keep it **unsorted**, inserts are instant but finding the minimum scans everything (O(n)). A heap gives up *fully sorted* in exchange for **O(log n) for both**.

![Costs of a priority queue as an unsorted array, a sorted array and a heap](fig:ds-heap-costs "A heap is the balanced trade-off: both operations stay logarithmic.")

## The heap property

A **min-heap** is a binary tree with **two rules**:

1. **Shape:** it is *complete* — every level is full except possibly the last, which fills left to right.
2. **Order:** every parent is **≤ its children**. (A max-heap flips it.)

So the **smallest value is always at the root**: `peek` is O(1). Notice the heap does **not** order siblings or whole levels — only parents against children. That's why it is cheaper to maintain than a sorted list.

## A tree stored in an array

Because the shape is always complete, you don't need nodes and pointers. Store the levels one after another in an array, and **index arithmetic** replaces the links:

![A min-heap as a tree and as an array, with the index formulas](fig:ds-heap-tree-array "Children of i are at 2i + 1 and 2i + 2; the parent of i is at ⌊(i − 1) / 2⌋.")

```js try
const heap = [1, 3, 2, 7, 4, 5, 9];
const parent = (i) => Math.floor((i - 1) / 2);
const left = (i) => 2 * i + 1;
const right = (i) => 2 * i + 2;
console.log(heap[parent(5)], heap[left(1)], heap[right(1)]);   // parent of index 5; children of index 1
```

## Push: add at the end, sift up

To insert, put the new item in the **next free slot** (the end of the array, keeping the shape complete), then **sift it up**: while it is smaller than its parent, swap them.

![Pushing 1 into the heap 2, 5, 3 by swapping upwards](fig:ds-heap-sift-up "At most one swap per level, and there are about log₂ n levels.")

## Pop: take the root, sift down

To remove the minimum, take the **root**. That leaves a hole — so move the **last** item into the root (keeping the shape complete), then **sift it down**: while it is bigger than a child, swap it with the **smaller** child.

![Popping the minimum from the heap 1, 2, 3, 5](fig:ds-heap-sift-down "Always swap with the SMALLER child, or the smaller one would end up below a bigger parent.")

Putting it together, a complete min-heap in about twenty lines:

```js try
class MinHeap {
  constructor() { this.a = []; }
  push(x) {
    const a = this.a; a.push(x);
    for (let i = a.length - 1; i > 0;) {                 // sift up
      const p = (i - 1) >> 1;
      if (a[p] <= a[i]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0;;) {                                // sift down
        let m = i; const l = 2 * i + 1, r = l + 1;
        if (l < a.length && a[l] < a[m]) m = l;
        if (r < a.length && a[r] < a[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}
const h = new MinHeap();
[5, 3, 8, 1, 9, 2].forEach((x) => h.push(x));
console.log([h.pop(), h.pop(), h.pop(), h.pop(), h.pop(), h.pop()]);   // sorted: a "heap sort"
```

Pushing everything and popping everything sorts the data in **O(n log n)** — that is **heap sort**. And you can build a heap from `n` items faster than `n` pushes: put them all in an array, then **sift down** each non-leaf from the last parent back to the root (**heapify**, **O(n)**).

JavaScript has **no built-in heap**, so you write one (or ask whether a sorted insert or `Math.max` is good enough). Most interview problems give a **comparator** instead of fixing "smallest first" — so a heap takes a `compare(a, b)` function, like `Array#sort`.

## The patterns a heap unlocks

- **Top K:** keep a min-heap of size `K`. For each item push it, and if the heap grows beyond `K` pop the smallest. At the end it holds the `K` largest — in **O(n log K)**, without sorting everything.
- **Merge K sorted lists:** keep one item from each list in a heap; pop the smallest, then push that list's next item.
- **Schedulers and timers:** a heap keyed by "when is it due?" always knows the next event.
- **Dijkstra's shortest path:** a heap of "closest unexplored node" (next lesson).
- **Running median:** a max-heap of the lower half and a min-heap of the upper half.

```stepper Top 3 largest with a min-heap of size 3
code:
  function topK(nums, k) {
    const heap = new MinHeap();
    for (const x of nums) {
      heap.push(x);
      if (heap.size > k) heap.pop();    // drop the smallest of the k+1
    }
    return heap.toArray();
  }
  topK([5, 1, 8, 3, 9, 2], 3);
---
line: 3-4
say: `5` goes in. The heap holds at most `k = 3` items, so nothing is dropped yet.
x: 5
heap: 5
---
line: 3-4
say: Push `1`, then push `8`. Still three items or fewer.
x: 8
heap: 1 | 5 | 8
---
line: 4-5
say: Push `3`: now **four** items, one too many. Pop the **smallest**, `1`. It can't be one of the three largest, because three bigger values are already in the heap.
x: 3
heap: 3 | 5 | 8
dropped: 1
---
line: 4-5
say: Push `9`, then pop the smallest (`3`). The heap keeps the three biggest seen so far.
x: 9
heap: 5 | 8 | 9
dropped: 3
---
line: 4-5
say: Push `2`: it's the smallest of the four, so it is popped immediately. Nothing changes.
x: 2
heap: 5 | 8 | 9
dropped: 2
---
line: 7
say: Each of the `n` items cost at most one push and one pop on a heap of size `k`: **O(n log k)**, and only `k` items in memory — handy for huge streams.
Result: [5, 8, 9]
```

## Quick check

```check
Q: Where is the smallest value in a min-heap?
A) At the last index
B) At the root, index 0 *
C) In the middle
D) It depends on the inserts
Why: Every parent is ≤ its children, so no value can be smaller than the root.
---
Q: In a heap stored in an array, where are the children of index `i`?
A) `i + 1` and `i + 2`
B) `i / 2`
C) `2i + 1` and `2i + 2` *
D) `2i` and `2i + 1`
Why: The levels are packed one after another, so the left child sits at `2i + 1` and the right at `2i + 2`.
---
Q: When popping the minimum, why move the LAST item to the root?
A) It is the smallest
B) It keeps the tree complete (the array just gets shorter); then sift it down *
C) It avoids swapping
D) The last item is always the maximum
Why: Removing from the end keeps the shape valid in O(1); only the order near the root needs repairing.
---
Q: In sift-down, which child do you swap with?
A) The left one
B) The right one
C) The smaller one (in a min-heap) *
D) The larger one
Why: Swapping with the smaller child guarantees the new parent is ≤ both children.
---
Q: What is the time and memory cost of finding the K largest of n numbers with a size-K min-heap?
A) O(n log n), O(n)
B) O(n log K), O(K) *
C) O(n²), O(1)
D) O(K log n), O(n)
Why: Each of the n items costs one push and at most one pop on a heap of at most K+1 items.
```

## Recap

- A **heap** is a complete binary tree with **parent ≤ children** (min-heap), stored in an **array**: children of `i` at `2i + 1`, `2i + 2`.
- **Push** = add at the end, **sift up**. **Pop** = take the root, move the last to the top, **sift down** (swap with the smaller child). Both **O(log n)**; `peek` is **O(1)**.
- **Heapify** builds a heap in **O(n)**; push-all/pop-all is **heap sort**.
- Patterns: **top-K** (size-K min-heap), **merge K sorted**, **schedulers**, **Dijkstra**, **running median** (two heaps).
- Pass a **comparator** to flip the order or compare objects.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: is it a min-heap? | The index formulas |
| Build a priority queue | The sift-up and sift-down figures |
| K-th largest | A min-heap of size K (a `Heap` class is provided) |
| Merge K sorted arrays | A heap of "next item from each array" |
| Running median | Two heaps: lower half and upper half |
| Timer queue | A comparator that breaks ties by arrival order |

%% exercise dst-guided-is-heap | Guided: is it a min-heap? | 1 | js | js | isMinHeap | 8 | guided
Write `isMinHeap(arr)`. An array is a **min-heap** when every item is **≤ its children**: the children of index `i` are at `2i + 1` and `2i + 2` (when those indexes exist). Return `true` or `false`.

```js
isMinHeap([1, 3, 2, 7, 4, 5, 9]); // true
isMinHeap([2, 1]);                // false  (the child 1 is smaller than its parent 2)
```

%% worked
**A similar problem, solved: `isSortedAscending(arr)`** — a check that compares neighbours.

```js
function isSortedAscending(arr) {
  for (let i = 1; i < arr.length; i++) {   // ① start at 1: there is something before it to compare with
    if (arr[i - 1] > arr[i]) return false;  // ② one out-of-order pair is enough to fail
  }
  return true;                               // ③ no violations found
}
```

`isMinHeap` is the same shape, but the pair to compare is **parent and child**. Looping over each index `i` from `1` and checking its parent `(i - 1) >> 1` visits every parent–child pair exactly once.

%% explain
- **Parent ≤ child** for every pair (equal values are fine).
- **Index math**: parent of `i` is `Math.floor((i - 1) / 2)`.
- **Empty and one-item arrays** are heaps.
- **Not sorted**: siblings can be in any order.

%% nudge
- For index `i`, which index holds its parent?
- Does the root have a parent to check?

%% starter
```js
export function isMinHeap(arr) {
  // Step 1 — loop i from 1 to arr.length - 1.
  // Step 2 — the parent of i is at Math.floor((i - 1) / 2).
  // Step 3 — if the parent is bigger than arr[i], return false.
  // Step 4 — after the loop, return true.
  return false;
}
```

%% tests
```js
describe('isMinHeap', () => {
  it('accepts valid heaps', () => {
    expect(isMinHeap([1, 3, 2, 7, 4, 5, 9])).toBe(true);
    expect(isMinHeap([1, 2, 3])).toBe(true);
    expect(isMinHeap([1, 1, 1, 1])).toBe(true);
  });

  it('accepts empty and single-item arrays', () => {
    expect(isMinHeap([])).toBe(true);
    expect(isMinHeap([5])).toBe(true);
  });

  it('rejects a child smaller than its parent', () => {
    expect(isMinHeap([2, 1])).toBe(false);
    expect(isMinHeap([1, 2, 3, 0])).toBe(false);
    expect(isMinHeap([1, 5, 2, 6, 4, 3])).toBe(false);
  });

  it('allows siblings in any order (it is not a sorted array)', () => {
    expect(isMinHeap([1, 9, 2])).toBe(true);
    expect(isMinHeap([1, 2, 9])).toBe(true);
  });

  it('is linear', () => {
    const big = Array.from({ length: 200000 }, (_, i) => i);
    const t = Date.now();
    expect(isMinHeap(big)).toBe(true);
    big[150000] = -1;
    expect(isMinHeap(big)).toBe(false);
    expect(Date.now() - t).toBeLessThan(400);
  });
});
```

%% hints
- `for (let i = 1; i < arr.length; i++) { const parent = (i - 1) >> 1; if (arr[parent] > arr[i]) return false; }`

%% solution
```js
export function isMinHeap(arr) {
  for (let i = 1; i < arr.length; i++) {
    const parent = Math.floor((i - 1) / 2);
    if (arr[parent] > arr[i]) return false;
  }
  return true;
}
```

%% exercise dst-priority-queue | Build a priority queue | 3 | js | js | PriorityQueue | 30
Build `class PriorityQueue` as a **binary heap in an array**.

- `new PriorityQueue(compare = (a, b) => a - b)`: `compare(a, b) < 0` means `a` comes out **before** `b` (so the default is a min-heap).
- `push(x)`, `pop()` (the next item, or `undefined` if empty), `peek()` (without removing), and `size`.
- `PriorityQueue.from(items, compare)` builds a queue from an array in **O(n)** using **heapify** (sift down every parent, from the last one back to the root). It must not modify `items`.

Do **not** call `Array#sort` or `Array#splice` to keep it ordered.

%% worked
**A similar problem, solved: `siftUpLast(a)`** — repair a min-heap after one item was added at the end.

```js
function siftUpLast(a) {
  let i = a.length - 1;                       // ① the new item sits at the last index
  while (i > 0) {
    const p = (i - 1) >> 1;                   // ② its parent
    if (a[p] <= a[i]) break;                  // ③ parent is already smaller: heap property restored
    [a[p], a[i]] = [a[i], a[p]];              // ④ otherwise swap and keep climbing
    i = p;
  }
}
```

`pop` mirrors it: remove `a[0]`, move the last item to the root, then **sift down**, swapping with the **smaller** child until neither child is smaller. With a `compare` function, "smaller" simply means `compare(x, y) < 0`.

%% explain
- **Comparator**: `compare(a, b) < 0` → `a` has higher priority (comes out first).
- **`push` / `pop`** are O(log n); **`peek`** is O(1); `pop`/`peek` on empty give `undefined`.
- **`from`** heapifies in O(n) and **copies** the input array.
- **Works with objects** and with reversed comparators (max-heap).

%% nudge
- When sifting down, why compare with *both* children?
- In `from`, which indexes need a sift-down, and in which order?

%% starter
```js
export class PriorityQueue {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  static from(items, compare) {
    // your code
  }

  get size() {
    return this.a.length;
  }

  peek() {
    // your code
  }

  push(x) {
    // your code
  }

  pop() {
    // your code
  }
}
```

%% tests
```js
describe('PriorityQueue', () => {
  it('pops numbers in ascending order by default', () => {
    const q = new PriorityQueue();
    [5, 3, 8, 1, 9, 2, 7].forEach((x) => q.push(x));
    const out = [];
    while (q.size) out.push(q.pop());
    expect(out).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });

  it('peeks without removing and handles empty', () => {
    const q = new PriorityQueue();
    expect(q.peek()).toBeUndefined();
    expect(q.pop()).toBeUndefined();
    q.push(4); q.push(2);
    expect(q.peek()).toBe(2);
    expect(q.size).toBe(2);
  });

  it('accepts a comparator (max-heap)', () => {
    const q = new PriorityQueue((a, b) => b - a);
    [5, 3, 8, 1].forEach((x) => q.push(x));
    expect([q.pop(), q.pop(), q.pop(), q.pop()]).toEqual([8, 5, 3, 1]);
  });

  it('works with objects', () => {
    const q = new PriorityQueue((a, b) => a.cost - b.cost);
    q.push({ name: 'c', cost: 3 }); q.push({ name: 'a', cost: 1 }); q.push({ name: 'b', cost: 2 });
    expect(q.pop().name).toBe('a');
    expect(q.pop().name).toBe('b');
    expect(q.pop().name).toBe('c');
  });

  it('keeps working with interleaved pushes and pops', () => {
    const q = new PriorityQueue();
    const mirror = [];
    let seed = 7;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 1000;
    for (let i = 0; i < 2000; i++) {
      if (mirror.length && rand() % 3 === 0) {
        mirror.sort((x, y) => x - y);
        expect(q.pop()).toBe(mirror.shift());
      } else {
        const v = rand();
        q.push(v);
        mirror.push(v);
      }
    }
    expect(q.size).toBe(mirror.length);
  });

  it('builds from an array without touching it', () => {
    const items = [9, 4, 7, 1, 8, 2];
    const q = PriorityQueue.from(items);
    expect(items).toEqual([9, 4, 7, 1, 8, 2]);
    const out = [];
    while (q.size) out.push(q.pop());
    expect(out).toEqual([1, 2, 4, 7, 8, 9]);
  });

  it('builds with a comparator', () => {
    const q = PriorityQueue.from([3, 9, 1], (a, b) => b - a);
    expect(q.pop()).toBe(9);
  });

  it('is fast: 100 000 pushes and pops', () => {
    const q = new PriorityQueue();
    const t = Date.now();
    for (let i = 0; i < 100000; i++) q.push((i * 7919) % 100003);
    let prev = -1, ok = true;
    for (let i = 0; i < 100000; i++) { const v = q.pop(); if (v < prev) ok = false; prev = v; }
    expect(ok).toBe(true);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `push`: append, then swap with the parent `(i - 1) >> 1` while `compare(a[i], a[parent]) < 0`.
- `pop`: save `a[0]`, `const last = a.pop()`, and if items remain set `a[0] = last` and sift down: pick the smaller of the children (by `compare`) and swap while it beats the current item.
- `from`: copy the array, then for `i` from `Math.floor(n / 2) - 1` down to `0` call a shared `siftDown(i)`.

%% solution
```js
export class PriorityQueue {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  static from(items, compare) {
    const q = new PriorityQueue(compare);
    q.a = items.slice();
    for (let i = Math.floor(q.a.length / 2) - 1; i >= 0; i--) q.siftDown(i);
    return q;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  siftDown(i) {
    const a = this.a;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
      if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
      if (m === i) return;
      [a[i], a[m]] = [a[m], a[i]];
      i = m;
    }
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      this.siftDown(0);
    }
    return top;
  }
}
```

%% exercise dst-kth-largest | K-th largest element | 2 | js | js | kthLargest | 16
Return the **k-th largest** value of an unsorted array (`k = 1` is the maximum). Duplicates count separately: in `[3, 3, 1]`, the 2nd largest is `3`. Use a **min-heap of size `k`** — a `Heap` class with `push`, `pop`, `peek` and `size` is **provided** in the starter. Don't sort the whole array.

```js
kthLargest([3, 2, 1, 5, 6, 4], 2); // 5
```

%% worked
**A similar problem, solved: `smallestK(nums, k)`** — the k smallest values using a *max*-heap of size `k`.

```js
function smallestK(nums, k) {
  const heap = new Heap((a, b) => b - a);    // ① comparator flipped: the biggest comes out first
  for (const x of nums) {
    heap.push(x);
    if (heap.size > k) heap.pop();           // ② too many? evict the biggest, which can't be among the k smallest
  }
  return heap.a.slice().sort((a, b) => a - b);
}
```

Flip it for the largest: keep a **min**-heap of the `k` biggest seen. Whatever sits at the top is the *smallest of the biggest k* — which is exactly the k-th largest.

%% explain
- **k-th largest**, counting duplicates.
- **Min-heap of size `k`**: push each item; pop when `size > k`.
- **Answer** is `heap.peek()` at the end.
- **`k = 1`** is the maximum; **`k = n`** is the minimum.

%% nudge
- Why does a *min*-heap, not a max-heap, help find the largest values?
- What is on top of the heap after you've seen every item?

%% starter
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export function kthLargest(nums, k) {
  // your code
  return undefined;
}
```

%% tests
```js
describe('kthLargest', () => {
  it('finds the k-th largest', () => {
    expect(kthLargest([3, 2, 1, 5, 6, 4], 2)).toBe(5);
    expect(kthLargest([3, 2, 3, 1, 2, 4, 5, 5, 6], 4)).toBe(4);
  });

  it('counts duplicates separately', () => {
    expect(kthLargest([3, 3, 1], 2)).toBe(3);
    expect(kthLargest([7, 7, 7], 3)).toBe(7);
  });

  it('handles k = 1 and k = n', () => {
    expect(kthLargest([4, 9, 2], 1)).toBe(9);
    expect(kthLargest([4, 9, 2], 3)).toBe(2);
  });

  it('handles negatives and a single item', () => {
    expect(kthLargest([-1, -5, -3], 2)).toBe(-3);
    expect(kthLargest([42], 1)).toBe(42);
  });

  it('does not modify the input and is fast on 200 000 items', () => {
    const nums = Array.from({ length: 200000 }, (_, i) => (i * 7919) % 200003);
    const copy = nums.slice();
    const t = Date.now();
    const r = kthLargest(nums, 10);
    expect(Date.now() - t).toBeLessThan(600);
    expect(nums).toEqual(copy);
    expect(r).toBe(copy.slice().sort((a, b) => b - a)[9]);
  });
});
```

%% hints
- `const heap = new Heap();` (a min-heap). For each `x`: `heap.push(x); if (heap.size > k) heap.pop();`.
- After the loop, `heap.peek()` is the answer.

%% solution
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export function kthLargest(nums, k) {
  const heap = new Heap();
  for (const x of nums) {
    heap.push(x);
    if (heap.size > k) heap.pop();
  }
  return heap.peek();
}
```

%% exercise dst-merge-k | Merge K sorted arrays | 3 | js | js | mergeKSorted | 26
Given an array of **sorted** arrays, return **one sorted array** with all their items. Use a **heap holding one candidate per array** (a `Heap` with a comparator is provided). The tests use 1 000 arrays of 100 items, so concatenating and sorting repeatedly is too slow to be the intended approach — aim for **O(N log k)** with `N` items in total and `k` arrays.

```js
mergeKSorted([[1, 4, 7], [2, 5], [3, 6, 9]]); // [1, 2, 3, 4, 5, 6, 7, 9]
```

%% worked
**A similar problem, solved: `mergeTwo(a, b)`** — the two-array version.

```js
function mergeTwo(a, b) {
  const out = [];
  let i = 0, j = 0;                             // ① a front pointer into each array
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);   // ② take the smaller front
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}
```

With `k` arrays, "compare the fronts" means comparing `k` values each step. A **min-heap of the current fronts** gives the smallest in O(log k): pop it, then push **the next item from the same array**. Store *where it came from*: `[value, arrayIndex, itemIndex]`.

%% explain
- **Heap entries** carry the value *and* its position: `[value, listIndex, itemIndex]`.
- **Seed** with the first item of each non-empty array.
- **Pop the smallest**, output it, push the next item from the same array if there is one.
- **Empty arrays** are skipped; `[]` returns `[]`.

%% nudge
- When you pop an item, how do you know which array to take the next item from?
- What goes in the heap at the start?

%% starter
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export function mergeKSorted(lists) {
  // your code
  return [];
}
```

%% tests
```js
describe('mergeKSorted', () => {
  it('merges several sorted arrays', () => {
    expect(mergeKSorted([[1, 4, 7], [2, 5], [3, 6, 9]])).toEqual([1, 2, 3, 4, 5, 6, 7, 9]);
  });

  it('handles empty inputs', () => {
    expect(mergeKSorted([])).toEqual([]);
    expect(mergeKSorted([[], []])).toEqual([]);
    expect(mergeKSorted([[], [1, 2], []])).toEqual([1, 2]);
  });

  it('handles one array and duplicates', () => {
    expect(mergeKSorted([[1, 2, 3]])).toEqual([1, 2, 3]);
    expect(mergeKSorted([[1, 1], [1, 2], [1]])).toEqual([1, 1, 1, 1, 2]);
  });

  it('does not modify its inputs', () => {
    const a = [1, 3], b = [2, 4];
    mergeKSorted([a, b]);
    expect(a).toEqual([1, 3]);
    expect(b).toEqual([2, 4]);
  });

  it('is fast: 1 000 arrays of 100 items', () => {
    const lists = Array.from({ length: 1000 }, (_, k) => Array.from({ length: 100 }, (_, i) => i * 1000 + k));
    const t = Date.now();
    const r = mergeKSorted(lists);
    expect(Date.now() - t).toBeLessThan(800);
    expect(r.length).toBe(100000);
    expect(r.every((v, i) => i === 0 || r[i - 1] <= v)).toBe(true);
  });
});
```

%% hints
- `const heap = new Heap((x, y) => x[0] - y[0]);` then push `[list[0], listIndex, 0]` for each non-empty list.
- `while (heap.size)`: `const [value, li, ii] = heap.pop(); out.push(value);` then if `ii + 1 < lists[li].length`, push `[lists[li][ii + 1], li, ii + 1]`.

%% solution
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export function mergeKSorted(lists) {
  const heap = new Heap((x, y) => x[0] - y[0]);
  lists.forEach((list, li) => {
    if (list.length) heap.push([list[0], li, 0]);
  });
  const out = [];
  while (heap.size) {
    const [value, li, ii] = heap.pop();
    out.push(value);
    if (ii + 1 < lists[li].length) heap.push([lists[li][ii + 1], li, ii + 1]);
  }
  return out;
}
```

%% exercise dst-median-finder | Running median | 4 | js | js | MedianFinder | 35
Build `class MedianFinder` for a **stream** of numbers:

- `add(x)` adds a number.
- `median()` returns the median of everything added so far: the middle value, or the **average of the two middle values** when the count is even. Returns `undefined` when empty.

Both must be fast: `add` is **O(log n)** and `median` is **O(1)**. Re-sorting on every call is too slow for the 50 000-number test. A `Heap` with a comparator is **provided**.

```js
const m = new MedianFinder();
m.add(5); m.add(2); m.median(); // 3.5
m.add(9); m.median();           // 5
```

%% worked
**A similar problem, solved: `RunningMax`** — answer "what's the largest so far?" in O(1) per update.

```js
class RunningMax {
  constructor() { this.best = -Infinity; }
  add(x) { if (x > this.best) this.best = x; }     // ① keep just enough information...
  max() { return this.best; }                      // ② ...to answer instantly
}
```

For the median, "just enough information" is the **middle**. Split the numbers into a **lower half** (kept in a **max**-heap, so its biggest item is the largest of the small ones) and an **upper half** (a **min**-heap, so its top is the smallest of the big ones). If the halves stay balanced (sizes differ by at most one), the median is read off the two tops.

%% explain
- **Two heaps**: `lower` (max-heap) and `upper` (min-heap).
- **Invariants**: everything in `lower` ≤ everything in `upper`, and `lower.size` is `upper.size` or `upper.size + 1`.
- **`add`**: push into the right heap, then rebalance by moving one top across.
- **`median`**: odd count → the top of `lower`; even → the average of both tops.

%% nudge
- Which heap should a new number go into, and what must you check afterwards?
- When the count is odd, which heap holds the extra item?

%% starter
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export class MedianFinder {
  constructor() {
    this.lower = new Heap((a, b) => b - a);   // max-heap: the smaller half
    this.upper = new Heap((a, b) => a - b);   // min-heap: the larger half
  }

  add(x) {
    // your code
  }

  median() {
    // your code
  }
}
```

%% tests
```js
describe('MedianFinder', () => {
  it('returns undefined when empty', () => {
    expect(new MedianFinder().median()).toBeUndefined();
  });

  it('computes the median of a growing stream', () => {
    const m = new MedianFinder();
    m.add(5);
    expect(m.median()).toBe(5);
    m.add(2);
    expect(m.median()).toBe(3.5);
    m.add(9);
    expect(m.median()).toBe(5);
    m.add(1);
    expect(m.median()).toBe(3.5);
  });

  it('handles duplicates and negatives', () => {
    const m = new MedianFinder();
    [-1, -1, -1].forEach((x) => m.add(x));
    expect(m.median()).toBe(-1);
    m.add(10);
    expect(m.median()).toBe(-1);
    m.add(10);
    expect(m.median()).toBe(-1);
    m.add(10);
    expect(m.median()).toBe(4.5);
  });

  it('matches a brute-force median at checkpoints', () => {
    const m = new MedianFinder();
    const seen = [];
    let seed = 11;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 10000;
    for (let i = 1; i <= 3000; i++) {
      const v = rand();
      m.add(v);
      seen.push(v);
      if (i % 250 === 0) {
        const s = seen.slice().sort((a, b) => a - b);
        const mid = s.length >> 1;
        const expected = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
        expect(m.median()).toBe(expected);
      }
    }
  });

  it('is fast: 50 000 adds with a median after each', () => {
    const m = new MedianFinder();
    const t = Date.now();
    let last;
    for (let i = 0; i < 50000; i++) {
      m.add((i * 7919) % 100003);
      last = m.median();
    }
    expect(Date.now() - t).toBeLessThan(900);
    expect(typeof last).toBe('number');
  });
});
```

%% hints
- Always push into `lower`, then move `lower.pop()` into `upper` — that keeps every item of `lower` ≤ every item of `upper`.
- If `upper.size > lower.size`, move `upper.pop()` back into `lower` so `lower` is never smaller.
- `median()`: if `lower.size > upper.size` return `lower.peek()`, otherwise `(lower.peek() + upper.peek()) / 2`.

%% solution
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export class MedianFinder {
  constructor() {
    this.lower = new Heap((a, b) => b - a);
    this.upper = new Heap((a, b) => a - b);
  }

  add(x) {
    this.lower.push(x);
    this.upper.push(this.lower.pop());
    if (this.upper.size > this.lower.size) this.lower.push(this.upper.pop());
  }

  median() {
    if (this.lower.size === 0) return undefined;
    if (this.lower.size > this.upper.size) return this.lower.peek();
    return (this.lower.peek() + this.upper.peek()) / 2;
  }
}
```

%% exercise dst-timer-queue | A timer queue | 3 | js | js | Scheduler | 26
Build `class Scheduler`, a queue of events ordered by **time**.

- `schedule(time, label)` adds an event.
- `runNext()` removes and returns the **earliest** event as `{ time, label }`, or `undefined` if there is none.
- **Ties** (the same time) come out in the order they were **scheduled** (first scheduled, first run).
- `nextTime()` returns the earliest time without removing it (or `undefined`).
- `size` is the number of pending events.

A `Heap` with a comparator is **provided**. A heap isn't stable by itself — you must break ties yourself.

%% worked
**A similar problem, solved: tie-breaking with a counter** — make "equal" items come out in insertion order.

```js
const heap = new Heap((a, b) => a.priority - b.priority || a.seq - b.seq);   // ① priority first, then arrival order
let seq = 0;
function add(priority, name) { heap.push({ priority, name, seq: seq++ }); }   // ② stamp each item with a rising number
```

`a.priority - b.priority || a.seq - b.seq` reads: *if the priorities differ, use that difference; if it is `0` (falsy), fall back to the sequence number.* Without the counter, a heap may return equal items in any order.

%% explain
- **Order by `time`** ascending.
- **Ties by arrival**: add a sequence number to each event and compare it second.
- **`runNext` returns `{ time, label }`** (without the sequence number).
- **`nextTime` / `runNext` on empty** give `undefined`.

%% nudge
- How can a comparator use two keys?
- What do you store in the heap so ties can be broken?

%% starter
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export class Scheduler {
  constructor() {
    this.heap = new Heap((a, b) => 0);   // replace this comparator
    this.seq = 0;
  }

  get size() {
    return this.heap.size;
  }

  schedule(time, label) {
    // your code
  }

  runNext() {
    // your code
  }

  nextTime() {
    // your code
  }
}
```

%% tests
```js
describe('Scheduler', () => {
  it('runs events in time order', () => {
    const s = new Scheduler();
    s.schedule(30, 'c'); s.schedule(10, 'a'); s.schedule(20, 'b');
    expect(s.runNext()).toEqual({ time: 10, label: 'a' });
    expect(s.runNext()).toEqual({ time: 20, label: 'b' });
    expect(s.runNext()).toEqual({ time: 30, label: 'c' });
  });

  it('breaks ties by scheduling order', () => {
    const s = new Scheduler();
    ['first', 'second', 'third', 'fourth'].forEach((l) => s.schedule(5, l));
    expect([s.runNext().label, s.runNext().label, s.runNext().label, s.runNext().label]).toEqual(['first', 'second', 'third', 'fourth']);
  });

  it('handles events scheduled between runs', () => {
    const s = new Scheduler();
    s.schedule(10, 'a'); s.schedule(30, 'c');
    expect(s.runNext().label).toBe('a');
    s.schedule(20, 'b'); s.schedule(30, 'd');
    expect(s.runNext().label).toBe('b');
    expect(s.runNext().label).toBe('c');
    expect(s.runNext().label).toBe('d');
  });

  it('reports size and the next time', () => {
    const s = new Scheduler();
    expect(s.nextTime()).toBeUndefined();
    expect(s.runNext()).toBeUndefined();
    s.schedule(7, 'x'); s.schedule(3, 'y');
    expect(s.size).toBe(2);
    expect(s.nextTime()).toBe(3);
    s.runNext();
    expect(s.size).toBe(1);
  });

  it('returns plain { time, label } objects', () => {
    const s = new Scheduler();
    s.schedule(1, 'x');
    expect(Object.keys(s.runNext()).sort()).toEqual(['label', 'time']);
  });

  it('is fast: 50 000 events', () => {
    const s = new Scheduler();
    const t = Date.now();
    for (let i = 0; i < 50000; i++) s.schedule((i * 7919) % 1000, 'e' + i);
    let prev = -1, ok = true;
    while (s.size) { const e = s.runNext(); if (e.time < prev) ok = false; prev = e.time; }
    expect(ok).toBe(true);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- Store `{ time, label, seq: this.seq++ }` in the heap.
- Comparator: `(a, b) => a.time - b.time || a.seq - b.seq`.
- `runNext`: pop, and return `{ time, label }` only.

%% solution
```js
class Heap {
  constructor(compare = (a, b) => a - b) {
    this.a = [];
    this.compare = compare;
  }

  get size() {
    return this.a.length;
  }

  peek() {
    return this.a[0];
  }

  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.compare(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && this.compare(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.compare(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

export class Scheduler {
  constructor() {
    this.heap = new Heap((a, b) => a.time - b.time || a.seq - b.seq);
    this.seq = 0;
  }

  get size() {
    return this.heap.size;
  }

  schedule(time, label) {
    this.heap.push({ time, label, seq: this.seq++ });
  }

  runNext() {
    const e = this.heap.pop();
    return e ? { time: e.time, label: e.label } : undefined;
  }

  nextTime() {
    const e = this.heap.peek();
    return e ? e.time : undefined;
  }
}
```
