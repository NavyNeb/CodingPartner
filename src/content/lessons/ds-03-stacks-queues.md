---
id: ds-stacks-queues
track: ds
title: Stacks, queues & deques
summary: Last-in-first-out and first-in-first-out, why Array#shift is a trap, how a ring buffer avoids it, and the monotonic stack that answers "next bigger" questions in one pass.
---

## The idea in one sentence

Stacks and queues are **arrays with rules about which end you may touch** — and those rules are exactly what make a surprising number of problems easy.

> **Analogy** A **stack** is a pile of plates: you add and take from the top. A **queue** is a line at a café: people join at the back and leave from the front. A **deque** ("deck") is a line you can join or leave from *either* end.

## Stack: last in, first out

![A stack: push and pop at the top only](fig:ds-stack-lifo "Only the top is touched, so push and pop are O(1).")

You meet stacks everywhere: the **call stack** (each function call is pushed, each return pops), **undo** history, **bracket matching**, and **depth-first search**. In JavaScript an array already is one: `push` and `pop` work on the end, both O(1).

```js try
const undo = [];
const doc = { text: '' };
function type(s) { undo.push(doc.text); doc.text += s; }   // remember the old state
function back() { if (undo.length) doc.text = undo.pop(); }  // most recent change first
type('he'); type('llo'); back();
console.log(doc.text);   // "he"
```

The one rule to remember: **pop and peek on an empty stack return `undefined`** — decide what you want that to mean.

## Queue: first in, first out

![A queue: enqueue at the back, dequeue at the front](fig:ds-queue-fifo "Both ends are used, so a good queue makes both O(1).")

Queues model **fairness and order of arrival**: task queues, print jobs, **breadth-first search**, buffering events. With an array you would `push` to enqueue and `shift` to dequeue — but **`shift` is O(n)**: every other item slides one slot left. A loop that drains a 100 000-item array with `shift` is quietly quadratic.

Two fixes:

- **Keep a head index** instead of removing: `dequeue` reads `items[head++]`. Memory grows, so occasionally *compact* (drop the consumed prefix).
- **Use a linked list** (next lesson), where removing the first node is O(1).

```js try
class Queue {
  constructor() { this.items = []; this.head = 0; }
  enqueue(x) { this.items.push(x); }
  dequeue() {
    if (this.head === this.items.length) return undefined;
    const x = this.items[this.head];
    this.items[this.head++] = undefined;                  // let the value be garbage collected
    if (this.head > 1024 && this.head * 2 > this.items.length) {   // compact now and then
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return x;
  }
}
const q = new Queue();
q.enqueue('a'); q.enqueue('b');
console.log(q.dequeue(), q.dequeue(), q.dequeue());
```

## Ring buffer: a queue with a fixed size

Sometimes you only ever need **the last N things** — the latest 100 log lines, the last 20 prices. A **ring buffer** stores them in a fixed array and lets two indexes **wrap around** with `% capacity`:

![A ring buffer of capacity 8 with head and tail indexes](fig:ds-ring-buffer "Reading and writing only move an index forward; nothing shifts, and the oldest item is overwritten when full.")

No allocation, no shifting, O(1) at both ends — and memory use that **cannot grow**, which is why it appears in audio buffers, network drivers and any "last N events" feature.

## Deque: both ends

A **deque** supports `pushFront`, `pushBack`, `popFront` and `popBack` in O(1). JavaScript has no built-in one (`unshift` is O(n), like `shift`), but a ring buffer or a doubly linked list gives you one. It shines in problems where you add at one end and **discard stale items from the other** — like the sliding-window exercise.

## Monotonic stack: "next bigger" in one pass

For "what's the **next greater** value to the right of each item?", the obvious answer is two nested loops: O(n²). Keep a stack of **indexes whose answer is still unknown**, kept in decreasing order. When a bigger value arrives, it is the answer for everything it can pop:

![A monotonic stack processing 2, 1, 5, 3, 4](fig:ds-monotonic-stack "Each index is pushed once and popped at most once, so the whole pass is O(n).")

```stepper Next greater element
code:
  function nextGreater(nums) {
    const result = new Array(nums.length).fill(-1);
    const stack = [];                          // indexes still waiting for their answer
    for (let i = 0; i < nums.length; i++) {
      while (stack.length && nums[stack.at(-1)] < nums[i]) {
        result[stack.pop()] = nums[i];         // nums[i] is the next greater for it
      }
      stack.push(i);
    }
    return result;
  }
  nextGreater([2, 1, 5, 3, 4]);
---
line: 5-8
say: `i = 0`, value `2`. The stack is empty, so nothing to pop. Push index `0`.
value: 2
stack (values): 2
result: -1 | -1 | -1 | -1 | -1
---
line: 5-8
say: `i = 1`, value `1`. The top is `2`, which is **not** smaller, so nothing pops. Push index `1`. The stack is decreasing: `2, 1`.
value: 1
stack (values): 2 | 1
---
line: 5-7
say: `i = 2`, value `5`. It is bigger than the top (`1`), so `5` is `1`'s next greater: **pop** it. It is also bigger than `2`: pop that too.
value: 5
result: 5 | 5 | -1 | -1 | -1
stack (values):
---
line: 8
say: Push index `2`. The stack holds just `5`.
stack (values): 5
---
line: 5-8
say: `i = 3`, value `3`. The top is `5`, bigger, so nothing pops. Push. Stack: `5, 3`.
value: 3
stack (values): 5 | 3
---
line: 5-8
say: `i = 4`, value `4`. It beats the top (`3`): `3`'s next greater is `4`. Pop it. `5` is bigger than `4`, so the popping stops. Push `4`.
value: 4
result: 5 | 5 | -1 | 4 | -1
stack (values): 5 | 4
---
line: 11
say: Whatever is left on the stack never found a bigger value, so it keeps `-1`. Each index was pushed once and popped at most once: **O(n)**.
Result: [5, 5, -1, 4, -1]
```

The same shape answers "days until a warmer temperature", "largest rectangle in a histogram" and "stock span".

## Quick check

```check
Q: Which structure makes "undo" easiest to build?
A) A queue
B) A stack, because the most recent change must be undone first *
C) A Set
D) A sorted array
Why: Undo is last-in, first-out: reverse the latest action, then the one before it.
---
Q: Why is draining a 100 000-item array with `shift()` slow?
A) `shift` throws on big arrays
B) Each `shift` moves every remaining item, so the total is O(n²) *
C) `shift` returns a copy
D) Arrays cannot be emptied
Why: Removing the first element re-indexes the rest. A head index, a ring buffer or a linked list avoids that.
---
Q: A ring buffer of capacity 4 holds `[a, b, c, d]` and you write `e`. What happens?
A) It throws
B) It grows to capacity 8
C) The oldest item (`a`) is overwritten *
D) `e` is dropped
Why: A ring buffer has fixed capacity. When full, a write replaces the oldest item (in the usual "keep the last N" use).
---
Q: In next-greater-element with a monotonic stack, what does the stack hold?
A) Indexes whose next greater value is not yet known, in decreasing order *
B) The final answers
C) Only the largest value
D) All indexes seen so far
Why: An index leaves the stack the moment a bigger value arrives. What remains is still waiting.
---
Q: Why is the monotonic-stack solution O(n) even with a `while` inside the `for`?
A) The while never runs
B) Each index is pushed once and popped at most once, so total pops ≤ n *
C) Stacks are free
D) The inner loop is O(1)
Why: Count the pushes and pops across the whole run, not per iteration of the outer loop.
```

## Recap

- **Stack = LIFO** (`push`/`pop` on the end, O(1)); **queue = FIFO** (`enqueue` back, `dequeue` front).
- **`Array#shift` is O(n)**: use a head index, a **ring buffer** or a linked list for queues.
- A **ring buffer** keeps the last N items with wrapping indexes and a fixed memory footprint.
- A **deque** works at both ends; a **monotonic stack/deque** discards items that can never be the answer.
- Count pushes and pops across the *whole* run to see why nested loops can still be O(n).

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a stack | `push` / `pop` on the end of an array |
| A fast queue | The head-index idea |
| Ring buffer | `% capacity` for the head and the tail |
| Evaluate RPN | A stack of operands |
| Next greater element | The monotonic-stack stepper |
| Sliding window maximum | A deque of indexes that you trim at both ends |

%% exercise dst-guided-stack | Guided: a stack | 1 | js | js | Stack | 6 | guided
Build `class Stack` with:

- `push(x)` adds to the top and returns the new size,
- `pop()` removes and returns the top item (`undefined` when empty),
- `peek()` returns the top item without removing it (`undefined` when empty),
- `size` (a getter) and `isEmpty()`.

```js
const s = new Stack();
s.push(1); s.push(2);
s.pop();  // 2
s.peek(); // 1
```

%% worked
**A similar problem, solved: `reverse(str)` with a stack.**

```js
function reverse(str) {
  const stack = [];
  for (const ch of str) stack.push(ch);   // ① push every character
  let out = '';
  while (stack.length) out += stack.pop(); // ② pop them back: last in, first out
  return out;
}
```

Pushing everything and popping it all reverses the order — that is LIFO in one picture. A `Stack` class just wraps the array and exposes only the operations a stack allows.

%% explain
- **`push`** returns the new size.
- **`pop` / `peek` on empty** give `undefined`.
- **`size`** is a getter; `isEmpty()` is a method.
- **Last in, first out**.

%% nudge
- Which end of the array is cheap to add to and remove from?
- Does `peek` change the array?

%% starter
```js
export class Stack {
  constructor() {
    this.items = [];
  }

  push(x) {
    // your code
  }

  pop() {
    // your code
  }

  peek() {
    // your code
  }

  get size() {
    // your code
  }

  isEmpty() {
    // your code
  }
}
```

%% tests
```js
describe('Stack', () => {
  it('pushes and pops in last-in-first-out order', () => {
    const s = new Stack();
    expect(s.push(1)).toBe(1);
    expect(s.push(2)).toBe(2);
    s.push(3);
    expect(s.pop()).toBe(3);
    expect(s.pop()).toBe(2);
    expect(s.pop()).toBe(1);
  });

  it('peeks without removing', () => {
    const s = new Stack();
    s.push('a'); s.push('b');
    expect(s.peek()).toBe('b');
    expect(s.size).toBe(2);
  });

  it('returns undefined when empty', () => {
    const s = new Stack();
    expect(s.pop()).toBeUndefined();
    expect(s.peek()).toBeUndefined();
    expect(s.size).toBe(0);
  });

  it('reports emptiness', () => {
    const s = new Stack();
    expect(s.isEmpty()).toBe(true);
    s.push(1);
    expect(s.isEmpty()).toBe(false);
    s.pop();
    expect(s.isEmpty()).toBe(true);
  });
});
```

%% hints
- Use `this.items.push`, `this.items.pop`, and `this.items[this.items.length - 1]` for `peek`.

%% solution
```js
export class Stack {
  constructor() {
    this.items = [];
  }

  push(x) {
    return this.items.push(x);
  }

  pop() {
    return this.items.pop();
  }

  peek() {
    return this.items[this.items.length - 1];
  }

  get size() {
    return this.items.length;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}
```

%% exercise dst-queue | A queue with O(1) dequeue | 2 | js | js | Queue | 14
Build `class Queue` with `enqueue(x)`, `dequeue()` (returns the oldest item, or `undefined` when empty), `peek()` (the oldest item without removing it) and a `size` getter.

`dequeue` must be **O(1)** — **do not call `Array.prototype.shift`** (the tests make `shift` throw). Use a head index, and drop the consumed prefix once in a while so memory doesn't grow forever.

%% worked
**A similar problem, solved: `Countdown`** — a list you read from the front without removing anything.

```js
class Reader {
  constructor(items) { this.items = items; this.head = 0; }       // ① head = index of the next item to read
  next() { return this.head < this.items.length ? this.items[this.head++] : undefined; }  // ② move the head, don't move the data
  get remaining() { return this.items.length - this.head; }       // ③ size = length minus the consumed part
}
```

Moving a **pointer** instead of moving **data** is the whole trick. A queue is this plus `enqueue` (a `push`), and an occasional `slice` to throw away the consumed prefix.

%% explain
- **FIFO**: `dequeue` returns the oldest item.
- **`size`** excludes items already dequeued.
- **No `shift`** — tests throw if you call it.
- **Compaction**: after many dequeues the array must not keep growing without bound.

%% nudge
- What is the size of the queue in terms of `items.length` and `head`?
- What should happen when `head` catches up with the end?

%% starter
```js
export class Queue {
  constructor() {
    this.items = [];
    this.head = 0;
  }

  enqueue(x) {
    // your code
  }

  dequeue() {
    // your code
  }

  peek() {
    // your code
  }

  get size() {
    // your code
  }
}
```

%% tests
```js
describe('Queue', () => {
  it('is first in, first out', () => {
    const q = new Queue();
    q.enqueue('a'); q.enqueue('b'); q.enqueue('c');
    expect(q.dequeue()).toBe('a');
    expect(q.peek()).toBe('b');
    expect(q.dequeue()).toBe('b');
    expect(q.dequeue()).toBe('c');
  });

  it('returns undefined when empty', () => {
    const q = new Queue();
    expect(q.dequeue()).toBeUndefined();
    expect(q.peek()).toBeUndefined();
    q.enqueue(1);
    q.dequeue();
    expect(q.dequeue()).toBeUndefined();
    expect(q.size).toBe(0);
  });

  it('tracks its size', () => {
    const q = new Queue();
    q.enqueue(1); q.enqueue(2); q.enqueue(3);
    expect(q.size).toBe(3);
    q.dequeue();
    expect(q.size).toBe(2);
  });

  it('can be reused after emptying', () => {
    const q = new Queue();
    for (let round = 0; round < 3; round++) {
      q.enqueue(round); q.enqueue(round + 10);
      expect(q.dequeue()).toBe(round);
      expect(q.dequeue()).toBe(round + 10);
      expect(q.size).toBe(0);
    }
  });

  it('does not use Array#shift and stays fast', () => {
    const realShift = Array.prototype.shift;
    Array.prototype.shift = function () { throw new Error('shift is O(n): do not use it'); };
    try {
      const q = new Queue();
      const t = Date.now();
      for (let i = 0; i < 200000; i++) q.enqueue(i);
      let inOrder = true;
      for (let i = 0; i < 200000; i++) if (q.dequeue() !== i) inOrder = false;
      expect(Date.now() - t).toBeLessThan(800);
      expect(inOrder).toBe(true);
    } finally {
      Array.prototype.shift = realShift;
    }
  });

  it('does not hold on to every item forever', () => {
    const q = new Queue();
    for (let r = 0; r < 20; r++) {
      for (let i = 0; i < 5000; i++) q.enqueue(i);
      for (let i = 0; i < 5000; i++) q.dequeue();
    }
    expect(q.size).toBe(0);
    expect(q.items.length).toBeLessThan(50000);
  });
});
```

%% hints
- `size` is `this.items.length - this.head`.
- `dequeue`: if the queue is empty return `undefined`; otherwise read `this.items[this.head]`, clear that slot, and `head++`.
- Compact: when `head` is large (say above 1000) and at least half the array, `this.items = this.items.slice(this.head); this.head = 0;`.

%% solution
```js
export class Queue {
  constructor() {
    this.items = [];
    this.head = 0;
  }

  enqueue(x) {
    this.items.push(x);
  }

  dequeue() {
    if (this.head >= this.items.length) return undefined;
    const x = this.items[this.head];
    this.items[this.head] = undefined;
    this.head++;
    if (this.head > 1000 && this.head * 2 >= this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return x;
  }

  peek() {
    return this.head < this.items.length ? this.items[this.head] : undefined;
  }

  get size() {
    return this.items.length - this.head;
  }
}
```

%% exercise dst-ring-buffer | Ring buffer | 2 | js | js | RingBuffer | 16
Build `class RingBuffer` with a **fixed capacity** `n` that remembers the **last `n` items**.

- `new RingBuffer(capacity)` — throws a `RangeError` if `capacity` is not a positive integer.
- `push(x)` adds an item. If the buffer is full, the **oldest** item is overwritten; return the item that was **evicted** (or `undefined` if nothing was).
- `toArray()` returns the items **oldest → newest**.
- `size` is how many items are stored (at most `capacity`).

Use one fixed array and two indexes with `%` — **no `shift`, no growing**.

%% worked
**A similar problem, solved: `Clock`** — a counter that wraps around.

```js
class Clock {
  constructor(size) { this.size = size; this.tick = 0; }
  next() {
    const value = this.tick;
    this.tick = (this.tick + 1) % this.size;     // ① after the last slot, wrap back to slot 0
    return value;
  }
}
// size 3: 0, 1, 2, 0, 1, 2, …
```

A ring buffer is exactly this wrap-around index, used to **write** (`tail`) and **read** (`head`). When the buffer is full, `tail` and `head` point at the same slot: the one you're about to overwrite is the oldest item, so you also move `head` forward.

%% explain
- **Fixed array**, two indexes (`head` = oldest, `tail` = next write), both wrapped with `%`.
- **`push` returns the evicted item** when full, otherwise `undefined`.
- **`toArray`** reads `size` items starting at `head`.
- **Invalid capacity** throws `RangeError`.

%% nudge
- When the buffer is full, which slot are you about to overwrite, and what does that mean for `head`?
- How does `toArray` start in the middle of the array and still read in order?

%% starter
```js
export class RingBuffer {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
    this.items = new Array(capacity);
    this.head = 0;
    this.size = 0;
  }

  push(x) {
    // your code
  }

  toArray() {
    // your code
  }
}
```

%% tests
```js
describe('RingBuffer', () => {
  it('stores items oldest to newest', () => {
    const r = new RingBuffer(3);
    r.push('a'); r.push('b');
    expect(r.toArray()).toEqual(['a', 'b']);
    expect(r.size).toBe(2);
  });

  it('returns undefined while there is room', () => {
    const r = new RingBuffer(2);
    expect(r.push(1)).toBeUndefined();
    expect(r.push(2)).toBeUndefined();
  });

  it('overwrites the oldest item when full and returns it', () => {
    const r = new RingBuffer(3);
    r.push(1); r.push(2); r.push(3);
    expect(r.push(4)).toBe(1);
    expect(r.toArray()).toEqual([2, 3, 4]);
    expect(r.push(5)).toBe(2);
    expect(r.toArray()).toEqual([3, 4, 5]);
    expect(r.size).toBe(3);
  });

  it('wraps around many times', () => {
    const r = new RingBuffer(4);
    for (let i = 0; i < 25; i++) r.push(i);
    expect(r.toArray()).toEqual([21, 22, 23, 24]);
  });

  it('works with capacity 1', () => {
    const r = new RingBuffer(1);
    r.push('x');
    expect(r.push('y')).toBe('x');
    expect(r.toArray()).toEqual(['y']);
  });

  it('rejects bad capacities', () => {
    expect(() => new RingBuffer(0)).toThrow(RangeError);
    expect(() => new RingBuffer(2.5)).toThrow(RangeError);
    expect(() => new RingBuffer(-1)).toThrow(RangeError);
  });

  it('never grows and stays fast', () => {
    const r = new RingBuffer(100);
    const t = Date.now();
    for (let i = 0; i < 300000; i++) r.push(i);
    expect(Date.now() - t).toBeLessThan(500);
    expect(r.items.length).toBe(100);
    expect(r.toArray()[0]).toBe(299900);
  });
});
```

%% hints
- Next write slot: `(this.head + this.size) % capacity`. If full (`size === capacity`), that slot holds the oldest item.
- Full: save `evicted = items[head]`, overwrite the slot, `head = (head + 1) % capacity`. Not full: write and `size++`.
- `toArray`: `for (let i = 0; i < size; i++) out.push(items[(head + i) % capacity])`.

%% solution
```js
export class RingBuffer {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');
    this.items = new Array(capacity);
    this.head = 0;
    this.size = 0;
  }

  push(x) {
    const cap = this.items.length;
    if (this.size < cap) {
      this.items[(this.head + this.size) % cap] = x;
      this.size++;
      return undefined;
    }
    const evicted = this.items[this.head];
    this.items[this.head] = x;
    this.head = (this.head + 1) % cap;
    return evicted;
  }

  toArray() {
    const cap = this.items.length;
    const out = [];
    for (let i = 0; i < this.size; i++) out.push(this.items[(this.head + i) % cap]);
    return out;
  }
}
```

%% exercise dst-eval-rpn | Evaluate reverse Polish notation | 2 | js | js | evalRPN | 14
In **reverse Polish notation** the operator comes *after* its operands, so no brackets are needed. Evaluate an array of tokens made of numbers (as strings) and the operators `+`, `-`, `*`, `/`.

```js
evalRPN(['2', '1', '+', '3', '*']); // 9      ((2 + 1) * 3)
evalRPN(['4', '13', '5', '/', '+']); // 6      (4 + 13 / 5 = 4 + 2)
```

Division **truncates towards zero** (`7 / -2 = -3`). Assume the input is valid.

%% worked
**A similar problem, solved: `sumPairs(tokens)`** — numbers push, a `+` pops two and pushes their sum.

```js
function sumPairs(tokens) {
  const stack = [];
  for (const t of tokens) {
    if (t === '+') {
      const b = stack.pop();           // ① the most recent operand comes off first
      const a = stack.pop();
      stack.push(a + b);               // ② the result goes back: it is an operand for what follows
    } else stack.push(Number(t));
  }
  return stack.pop();
}
```

Every operator takes the **two most recent values** and replaces them with the result — "most recent" is exactly what a stack gives you. For `-` and `/` the order matters: the *second* pop is the left operand.

%% explain
- **Numbers push**, operators **pop two** and push the result.
- **Order matters** for `-` and `/`: `a op b` where `b` was popped first.
- **Division truncates towards zero** (`Math.trunc`).
- **Result** is the one value left on the stack.

%% nudge
- Which popped value is the left operand: the first or the second?
- How do you tell a number token from an operator?

%% starter
```js
export function evalRPN(tokens) {
  // your code
  return 0;
}
```

%% tests
```js
describe('evalRPN', () => {
  it('evaluates simple expressions', () => {
    expect(evalRPN(['2', '1', '+', '3', '*'])).toBe(9);
    expect(evalRPN(['4', '13', '5', '/', '+'])).toBe(6);
  });

  it('respects operand order for - and /', () => {
    expect(evalRPN(['10', '3', '-'])).toBe(7);
    expect(evalRPN(['8', '2', '/'])).toBe(4);
  });

  it('truncates division towards zero', () => {
    expect(evalRPN(['7', '-2', '/'])).toBe(-3);
    expect(evalRPN(['-7', '2', '/'])).toBe(-3);
    expect(evalRPN(['1', '3', '/'])).toBe(0);
  });

  it('handles negative numbers and a single number', () => {
    expect(evalRPN(['-5'])).toBe(-5);
    expect(evalRPN(['3', '-4', '*'])).toBe(-12);
  });

  it('evaluates a longer expression', () => {
    const tokens = ['10', '6', '9', '3', '+', '-11', '*', '/', '*', '17', '+', '5', '+'];
    expect(evalRPN(tokens)).toBe(22);
  });

  it('is linear on a long input', () => {
    const tokens = ['1'];
    for (let i = 0; i < 100000; i++) tokens.push('1', '+');
    expect(evalRPN(tokens)).toBe(100001);
  });
});
```

%% hints
- Operators: `'+', '-', '*', '/'`. Anything else is a number: `Number(token)`.
- `const b = stack.pop(); const a = stack.pop();` then push `a - b`, and `Math.trunc(a / b)` for division.

%% solution
```js
export function evalRPN(tokens) {
  const stack = [];
  for (const t of tokens) {
    if (t === '+' || t === '-' || t === '*' || t === '/') {
      const b = stack.pop();
      const a = stack.pop();
      if (t === '+') stack.push(a + b);
      else if (t === '-') stack.push(a - b);
      else if (t === '*') stack.push(a * b);
      else stack.push(Math.trunc(a / b));
    } else {
      stack.push(Number(t));
    }
  }
  return stack.pop();
}
```

%% exercise dst-next-greater | Next greater element | 3 | js | js | nextGreater | 22
For each number in the array, find the **next number to its right that is strictly greater**. Return an array of those values, with `-1` where there is none.

```js
nextGreater([2, 1, 5, 3, 4]); // [5, 5, -1, 4, -1]
```

It must be **O(n)**: a 100 000-element decreasing array is tested.

%% worked
**A similar problem, solved: `previousSmaller(nums)`** — for each number, the nearest smaller value to its **left**.

```js
function previousSmaller(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = [];                                   // ① values that could still be someone's "previous smaller"
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && stack.at(-1) >= nums[i]) stack.pop();   // ② too big to help anyone to the right: discard
    if (stack.length) result[i] = stack.at(-1);       // ③ what is left on top is the nearest smaller
    stack.push(nums[i]);
  }
  return result;
}
```

The pattern: **pop everything that can never be the answer**, then the top of the stack *is* the answer. For "next greater", scan left to right and let each new value **answer** the waiting items it beats (the stepper in the lesson).

%% explain
- **Strictly greater**: equal values don't count.
- **`-1`** where nothing to the right is bigger (including the last element).
- **Stack of waiting indexes**; each new value resolves everything smaller on top.
- **Linear**: each index is pushed once and popped at most once.

%% nudge
- What does the stack hold, and in what order?
- When the current value is bigger than the top of the stack, what do you know about the top?

%% starter
```js
export function nextGreater(nums) {
  const result = new Array(nums.length).fill(-1);
  // your code
  return result;
}
```

%% tests
```js
describe('nextGreater', () => {
  it('finds the next greater value to the right', () => {
    expect(nextGreater([2, 1, 5, 3, 4])).toEqual([5, 5, -1, 4, -1]);
    expect(nextGreater([1, 2, 3, 4])).toEqual([2, 3, 4, -1]);
  });

  it('uses -1 when there is none', () => {
    expect(nextGreater([4, 3, 2, 1])).toEqual([-1, -1, -1, -1]);
  });

  it('requires strictly greater', () => {
    expect(nextGreater([2, 2, 2])).toEqual([-1, -1, -1]);
    expect(nextGreater([1, 1, 2])).toEqual([2, 2, -1]);
  });

  it('handles empty and single-element arrays', () => {
    expect(nextGreater([])).toEqual([]);
    expect(nextGreater([7])).toEqual([-1]);
  });

  it('handles negatives', () => {
    expect(nextGreater([-5, -3, -4, -2, -9])).toEqual([-3, -2, -2, -1, -1]);
  });

  it('is linear on 100 000 decreasing numbers', () => {
    const nums = Array.from({ length: 100000 }, (_, i) => 100000 - i);
    const t = Date.now();
    const r = nextGreater(nums);
    expect(Date.now() - t).toBeLessThan(500);
    expect(r[0]).toBe(-1);
    expect(r[99999]).toBe(-1);
    const up = Array.from({ length: 100000 }, (_, i) => i);
    const r2 = nextGreater(up);
    expect(r2[0]).toBe(1);
    expect(r2[99998]).toBe(99999);
  });
});
```

%% hints
- Keep `stack` of **indexes**. For each `i`: `while (stack.length && nums[stack.at(-1)] < nums[i]) result[stack.pop()] = nums[i];` then `stack.push(i)`.

%% solution
```js
export function nextGreater(nums) {
  const result = new Array(nums.length).fill(-1);
  const stack = [];
  for (let i = 0; i < nums.length; i++) {
    while (stack.length && nums[stack[stack.length - 1]] < nums[i]) {
      result[stack.pop()] = nums[i];
    }
    stack.push(i);
  }
  return result;
}
```

%% exercise dst-sliding-max | Sliding window maximum | 4 | js | js | slidingMax | 35
Given an array and a window size `k`, return the **maximum of every window** of `k` consecutive items as it slides from left to right.

```js
slidingMax([1, 3, -1, -3, 5, 3, 6, 7], 3); // [3, 3, 5, 5, 6, 7]
```

It must be **O(n)**. Recomputing `Math.max` over each window is O(n·k) and the tests use `n = 200 000`, `k = 1000`.

%% worked
**A similar problem, solved: `slidingMin3(nums)`** — the minimum of every window of 3, the simple way.

```js
function slidingMin3(nums) {
  const out = [];
  for (let i = 2; i < nums.length; i++) {
    out.push(Math.min(nums[i], nums[i - 1], nums[i - 2]));   // ① cheap only because the window is tiny
  }
  return out;
}
```

For a big `k` that rescans too much. Instead keep a **deque of indexes** whose values are **decreasing**: the front is always the current window's maximum. When a new value arrives, **pop from the back** every index with a smaller value (they can never be a maximum again — the new one is bigger *and* will outlive them), push the new index, and **pop from the front** if that index slid out of the window.

%% explain
- **Returns `n - k + 1` maxima**, one per window.
- **Deque of indexes**, values decreasing front → back.
- **Front** is the current maximum; drop it when its index leaves the window (`index <= i - k`).
- **`k` larger than the array** returns an empty array; **`k = 1`** returns a copy.

%% nudge
- Which items can *never* be the maximum once a bigger, newer item arrives?
- How do you know the item at the front has fallen out of the window?

%% starter
```js
export function slidingMax(nums, k) {
  // your code
  return [];
}
```

%% tests
```js
describe('slidingMax', () => {
  it('computes the maximum of each window', () => {
    expect(slidingMax([1, 3, -1, -3, 5, 3, 6, 7], 3)).toEqual([3, 3, 5, 5, 6, 7]);
  });

  it('handles k = 1 and k = n', () => {
    expect(slidingMax([4, 2, 9], 1)).toEqual([4, 2, 9]);
    expect(slidingMax([4, 2, 9], 3)).toEqual([9]);
  });

  it('handles k larger than the array and empty input', () => {
    expect(slidingMax([1, 2], 5)).toEqual([]);
    expect(slidingMax([], 3)).toEqual([]);
  });

  it('handles equal values and decreasing arrays', () => {
    expect(slidingMax([5, 5, 5, 5], 2)).toEqual([5, 5, 5]);
    expect(slidingMax([9, 8, 7, 6, 5], 2)).toEqual([9, 8, 7, 6]);
    expect(slidingMax([1, 2, 3, 4, 5], 2)).toEqual([2, 3, 4, 5]);
  });

  it('handles negatives', () => {
    expect(slidingMax([-5, -3, -4, -1, -2], 2)).toEqual([-3, -3, -1, -1]);
  });

  it('is linear: n = 200 000, k = 1000', () => {
    const nums = Array.from({ length: 200000 }, (_, i) => (i * 7919) % 10007);
    const t = Date.now();
    const r = slidingMax(nums, 1000);
    expect(Date.now() - t).toBeLessThan(500);
    expect(r.length).toBe(199001);
    expect(r[0]).toBe(Math.max(...nums.slice(0, 1000)));
    expect(r[199000]).toBe(Math.max(...nums.slice(199000)));
  });
});
```

%% hints
- Keep `deque` as an array of indexes with a `head` pointer (avoid `shift`).
- For each `i`: pop from the back while `nums[back] <= nums[i]`; push `i`; if `deque[head] <= i - k`, advance `head`; once `i >= k - 1`, `nums[deque[head]]` is the answer for this window.

%% solution
```js
export function slidingMax(nums, k) {
  const n = nums.length;
  if (k < 1 || k > n) return [];
  const out = [];
  const deque = [];
  let head = 0;
  for (let i = 0; i < n; i++) {
    while (deque.length > head && nums[deque[deque.length - 1]] <= nums[i]) deque.pop();
    deque.push(i);
    if (deque[head] <= i - k) head++;
    if (i >= k - 1) out.push(nums[deque[head]]);
  }
  return out;
}
```
