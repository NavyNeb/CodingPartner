---
id: ds-linked-lists
track: ds
title: Linked lists & pointer thinking
summary: Nodes that point at nodes: how to insert, remove and reverse by rewiring links, the dummy-node trick, fast and slow pointers, and the doubly linked list behind LRU caches and fast queues.
---

## The idea in one sentence

A linked list stores items in **separate nodes that each point at the next one**, so you can insert or remove anywhere by **changing a couple of pointers** — no shifting — at the price of **no instant access by position**.

> **Analogy** A treasure hunt: each clue tells you where the *next* clue is. To get to clue 7 you must follow clues 1 to 6. But to add a new clue in the middle you only change what the clue before it says.

## The shape

![A singly linked list: head, nodes with next pointers, null at the end](fig:ds-list-shape "You hold the head. Everything else is reached by following next.")

In JavaScript a node is just an object:

```js try
const head = { val: 7, next: { val: 3, next: { val: 9, next: null } } };

let length = 0;
for (let node = head; node !== null; node = node.next) length++;   // the traversal loop
console.log(length);
```

That `for (let node = head; node; node = node.next)` loop is the whole technique for *reading* a list. Everything else is about **which pointer you change, and in what order**.

| | Array | Linked list |
| --- | --- | --- |
| Read item `i` | **O(1)** | O(n): walk `i` links |
| Insert/remove at the front | O(n): shift everything | **O(1)** |
| Insert/remove after a node you already hold | O(n) | **O(1)** |
| Memory | compact, cache-friendly | an extra pointer per item; scattered |

In everyday JavaScript an array is the right default. Linked lists matter because **they are the building block** of queues, LRU caches, undo histories, and text editors — and because interviews love **pointer manipulation**.

## Insert and remove: rewire the links

![Inserting X after A: set X.next first, then A.next](fig:ds-list-insert "Order matters: write the new node's pointer before you overwrite the old one, or you lose the rest of the list.")

Removing a node is the mirror image: make the node *before* it skip over it.

```js try predict
const head = { val: 1, next: { val: 2, next: { val: 3, next: null } } };
const second = head.next;
head.next = head.next.next;          // unlink node 2: head now skips it
console.log(second.val, second.next.val, head.next.val);
```

The unlinked node still exists (we hold `second`); nothing *points at it* any more, so once we drop it, the garbage collector will reclaim it.

### The dummy-node trick

Inserting or removing at the **head** is awkward: there is no node *before* it to rewire, so the head variable itself changes. A **dummy node** in front removes the special case:

```js try
function removeAll(head, target) {
  const dummy = { val: null, next: head };     // a fake node before the real head
  let prev = dummy;
  while (prev.next) {
    if (prev.next.val === target) prev.next = prev.next.next;   // skip it
    else prev = prev.next;
  }
  return dummy.next;                           // the (possibly new) head
}
const list = { val: 5, next: { val: 5, next: { val: 8, next: null } } };
console.log(removeAll(list, 5));               // { val: 8, next: null }
```

## Reversing a list

Reversal is the classic exercise because it needs **three pointers** and careful ordering: where we came from (`prev`), where we are (`curr`), and where we're going (`next`, saved *before* we flip).

```stepper Reversing 1 → 2 → 3
code:
  function reverse(head) {
    let prev = null;
    let curr = head;
    while (curr) {
      const next = curr.next;   // remember the rest
      curr.next = prev;         // flip this arrow
      prev = curr;              // step forward
      curr = next;
    }
    return prev;
  }
  reverse(list);                // 1 → 2 → 3 → null
---
line: 2-3
say: `prev` starts as `null` (nothing reversed yet) and `curr` is the head, `1`.
prev: null
curr: 1
reversed:
rest: 1 → 2 → 3
---
line: 5
say: **Before touching anything**, save `curr.next` (node `2`). If we flipped first we'd lose the rest of the list.
next: 2
---
line: 6
say: Flip: node `1` now points **backwards** at `prev` (`null`).
reversed: 1 → null
rest: 2 → 3
---
line: 7-8
say: Step forward: `prev` becomes `1`, `curr` becomes the saved `2`.
prev: 1
curr: 2
---
line: 5-6
say: Same again. Save `3`, then flip node `2` to point back at `1`.
next: 3
reversed: 2 → 1 → null
rest: 3
---
line: 7-8
say: Step forward: `prev = 2`, `curr = 3`.
prev: 2
curr: 3
---
line: 5-8
say: Save `null`, flip node `3` to point at `2`, step forward: `prev = 3`, `curr = null`.
next: null
reversed: 3 → 2 → 1 → null
rest:
prev: 3
curr: null
---
line: 10
say: `curr` is `null`, so the loop ends. `prev` is the **new head**: `3 → 2 → 1 → null`. One pass, no extra memory: **O(n) time, O(1) space**.
Result: 3 → 2 → 1 → null
```

## Fast and slow pointers

Two pointers moving at **different speeds** solve problems that look like they need extra memory:

- **Find the middle**: when the fast pointer (2 steps) reaches the end, the slow one (1 step) is halfway.
- **Detect a cycle**: if the list loops back on itself, the fast pointer eventually **laps** the slow one and they land on the same node. If there's no cycle, fast just reaches `null`.

![Slow and fast pointers meeting inside a cycle](fig:ds-floyd-cycle "No Set of visited nodes needed: O(n) time, O(1) memory.")

The same "gap" idea finds **the nth node from the end**: move one pointer `n` steps ahead, then walk both together — when the leader hits the end, the follower is exactly `n` from it.

## Doubly linked lists

Add a **`prev`** pointer too and a node knows *both* neighbours. Then **removing a node you already hold is O(1)** — you don't need to walk from the head to find the node before it. With **dummy head and tail nodes**, there are no special cases at the ends.

![A doubly linked list with sentinel nodes](fig:ds-doubly-list "Both directions, plus dummy ends. This is the engine inside most LRU caches.")

An **LRU cache** pairs this list (most-recent at the front, so "move to front" and "evict the tail" are both O(1)) with a **hash map** from key to node (so finding the node is O(1)). Hash map for *finding*, linked list for *ordering*: two structures, each doing the one thing it's best at.

## Quick check

```check
Q: What is the time complexity of reading the 500th item of a singly linked list?
A) O(1)
B) O(log n)
C) O(n), you walk the links from the head *
D) O(n²)
Why: There is no address arithmetic: nodes can be anywhere, so you follow `next` repeatedly.
---
Q: To insert `X` after `A` you write `A.next = X` first. What goes wrong?
A) Nothing, the order doesn't matter
B) You lose the only reference to the rest of the list (the old `A.next`) *
C) X becomes the head
D) It creates a cycle automatically
Why: Save the old link first: `X.next = A.next`, then `A.next = X`.
---
Q: Why does a dummy node before the head simplify insert and remove?
A) It makes the list faster
B) The head is no longer a special case, because every real node now has a node before it *
C) It stores the length
D) It prevents cycles
Why: Without it, changing the first node means changing the `head` variable; with it, you always rewire `prev.next`.
---
Q: What does the fast/slow pointer technique use for memory when detecting a cycle?
A) O(n) for a Set of visited nodes
B) O(1), just two pointers *
C) O(log n)
D) O(n²)
Why: That is the point: you detect the loop without remembering where you have been.
---
Q: Why does an LRU cache use both a hash map and a doubly linked list?
A) The map finds a node in O(1); the list reorders and evicts in O(1) *
B) Doubly linked lists are sorted
C) The map keeps the order
D) It saves memory
Why: Each structure does the job the other is bad at: the map can't track order cheaply, the list can't find by key cheaply.
```

## Recap

- A **node** points at the next node; you only hold the **head**. Reading by position is **O(n)**, rewiring is **O(1)**.
- **Save before you overwrite**: `X.next = A.next` before `A.next = X`; `next = curr.next` before flipping.
- A **dummy node** removes the head special case.
- **Reverse** with `prev`/`curr`/`next`; **fast/slow pointers** find the middle, detect cycles, and measure from the end.
- A **doubly linked list** (with sentinels) removes any held node in O(1); paired with a map it makes an LRU cache.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a linked list class | The traversal loop and the head/tail idea |
| Reverse a list | The reverse stepper |
| Find the start of a cycle | The fast/slow figure, then restart one pointer at the head |
| Merge two sorted lists | A dummy node and a tail pointer |
| Remove the nth from the end | A dummy node and two pointers with a gap |
| Doubly linked list | Sentinels and four pointer updates |

%% exercise dst-guided-linked-list | Guided: a linked list class | 1 | js | js | LinkedList | 10 | guided
Build `class LinkedList` of numbers or anything else, with nodes shaped `{ val, next }`:

- `append(x)` adds to the **end**; `prepend(x)` adds to the **front**.
- `find(x)` returns the **index** of the first node whose `val === x`, or `-1`.
- `toArray()` returns the values front → back.
- `size` is the number of nodes (a plain property you keep up to date).

Keep a `tail` pointer so `append` is O(1) (a 100 000-item append test enforces it).

%% worked
**A similar problem, solved: `lastNode(head)`** — walk to the end.

```js
function lastNode(head) {
  if (!head) return null;
  let node = head;
  while (node.next) node = node.next;      // ① stop ON the last node (its next is null)
  return node;
}
```

Walking to the end is O(n); a **tail pointer** remembers it so `append` doesn't need to walk. The cases to handle are always the same: **empty list** (head and tail are both `null`) and **non-empty** (link the old tail to the new node, then move the tail).

%% explain
- **Nodes** are `{ val, next }`; the list holds `head` and `tail`.
- **`append`** on an empty list sets both `head` and `tail`.
- **`prepend`** on an empty list also sets `tail`.
- **`find`** returns an index (0-based) or `-1`.
- **`size`** stays correct after every operation.

%% nudge
- What changes when the list is empty versus not?
- After `prepend` to an empty list, what should `tail` be?

%% starter
```js
export class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  append(x) {
    // Step 1 — make a node: { val: x, next: null }.
    // Step 2 — empty list? head and tail both become the node.
    // Step 3 — otherwise tail.next = node, then tail = node.
    // Step 4 — size++.
  }

  prepend(x) {
    // your code
  }

  find(x) {
    // your code
  }

  toArray() {
    // your code
  }
}
```

%% tests
```js
describe('LinkedList', () => {
  it('appends in order', () => {
    const l = new LinkedList();
    l.append(1); l.append(2); l.append(3);
    expect(l.toArray()).toEqual([1, 2, 3]);
    expect(l.size).toBe(3);
  });

  it('prepends to the front', () => {
    const l = new LinkedList();
    l.prepend(2); l.prepend(1);
    l.append(3);
    expect(l.toArray()).toEqual([1, 2, 3]);
  });

  it('keeps head and tail correct on an empty list', () => {
    const l = new LinkedList();
    l.prepend('x');
    expect(l.head.val).toBe('x');
    expect(l.tail.val).toBe('x');
    const m = new LinkedList();
    m.append('y');
    expect(m.head).toBe(m.tail);
  });

  it('finds indexes', () => {
    const l = new LinkedList();
    ['a', 'b', 'c', 'b'].forEach((x) => l.append(x));
    expect(l.find('a')).toBe(0);
    expect(l.find('b')).toBe(1);
    expect(l.find('c')).toBe(2);
    expect(l.find('zzz')).toBe(-1);
  });

  it('handles an empty list', () => {
    const l = new LinkedList();
    expect(l.toArray()).toEqual([]);
    expect(l.find(1)).toBe(-1);
    expect(l.size).toBe(0);
  });

  it('append is O(1): 100 000 appends are fast', () => {
    const l = new LinkedList();
    const t = Date.now();
    for (let i = 0; i < 100000; i++) l.append(i);
    expect(Date.now() - t).toBeLessThan(400);
    expect(l.size).toBe(100000);
    expect(l.tail.val).toBe(99999);
  });
});
```

%% hints
- `append`: `const node = { val: x, next: null }; if (!this.tail) { this.head = this.tail = node; } else { this.tail.next = node; this.tail = node; } this.size++;`
- `find`: `let i = 0; for (let n = this.head; n; n = n.next, i++) if (n.val === x) return i;`

%% solution
```js
export class LinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.size = 0;
  }

  append(x) {
    const node = { val: x, next: null };
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.size++;
  }

  prepend(x) {
    const node = { val: x, next: this.head };
    this.head = node;
    if (!this.tail) this.tail = node;
    this.size++;
  }

  find(x) {
    let i = 0;
    for (let n = this.head; n; n = n.next, i++) if (n.val === x) return i;
    return -1;
  }

  toArray() {
    const out = [];
    for (let n = this.head; n; n = n.next) out.push(n.val);
    return out;
  }
}
```

%% exercise dst-reverse-list | Reverse a linked list | 2 | js | js | reverseList | 14
Reverse a singly linked list (nodes `{ val, next }`) and return the **new head**. Reverse it **in place** by flipping the `next` pointers — don't build a new list. It must be **iterative** and **O(1) extra memory**: a 100 000-node list is tested, and deep recursion would overflow the stack.

```js
// 1 → 2 → 3 → null   becomes   3 → 2 → 1 → null
```

%% worked
**A similar problem, solved: `countNodes(head)`** — the loop shape every list problem starts from.

```js
function countNodes(head) {
  let count = 0;
  for (let node = head; node !== null; node = node.next) count++;   // ① follow next until null
  return count;
}
```

For `reverseList`, the loop body *changes* `node.next`, so you must **save `node.next` first** — otherwise the flipped pointer hides the rest of the list. That is the three-variable dance from the stepper: `prev`, `curr`, `next`.

%% explain
- **Returns the new head** (the old tail); `null` for an empty list.
- **Flips pointers in place**: the same node objects, different `next`s.
- **Iterative**: no recursion, safe for 100 000 nodes.
- **Old head's `next`** must end up `null`.

%% nudge
- What must you remember before you overwrite `curr.next`?
- What is `prev` when the loop ends?

%% starter
```js
export function reverseList(head) {
  // your code
  return head;
}
```

%% tests
```js
const list = (arr) => arr.reduceRight((next, val) => ({ val, next }), null);
const toArr = (head) => { const out = []; for (let n = head; n; n = n.next) out.push(n.val); return out; };

describe('reverseList', () => {
  it('reverses a list', () => {
    expect(toArr(reverseList(list([1, 2, 3])))).toEqual([3, 2, 1]);
    expect(toArr(reverseList(list([1, 2, 3, 4, 5])))).toEqual([5, 4, 3, 2, 1]);
  });

  it('handles empty and single-node lists', () => {
    expect(reverseList(null)).toBeNull();
    expect(toArr(reverseList(list([9])))).toEqual([9]);
  });

  it('flips the existing nodes in place', () => {
    const head = list([1, 2, 3]);
    const second = head.next;
    const reversed = reverseList(head);
    expect(reversed.next).toBe(second);
    expect(head.next).toBeNull();
  });

  it('works on a 100 000-node list without overflowing the stack', () => {
    const head = list(Array.from({ length: 100000 }, (_, i) => i));
    const t = Date.now();
    const r = reverseList(head);
    expect(Date.now() - t).toBeLessThan(400);
    expect(r.val).toBe(99999);
    let n = 0;
    for (let c = r; c; c = c.next) n++;
    expect(n).toBe(100000);
  });
});
```

%% hints
- `let prev = null, curr = head; while (curr) { const next = curr.next; curr.next = prev; prev = curr; curr = next; } return prev;`

%% solution
```js
export function reverseList(head) {
  let prev = null;
  let curr = head;
  while (curr) {
    const next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev;
}
```

%% exercise dst-cycle-start | Find where a cycle starts | 3 | js | js | detectCycle | 25
Given the head of a linked list, return **the node where a cycle begins**, or `null` if the list has no cycle. Use **O(1) extra memory** (no `Set` of visited nodes).

```js
// 1 → 2 → 3 → 4 → 5 → (back to 3)       →   returns the node with val 3
```

%% worked
**A similar problem, solved: `hasCycle(head)`** — just *whether* there is a cycle.

```js
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {          // ① fast reaches null if there is no cycle
    slow = slow.next;                  // ② slow: 1 step
    fast = fast.next.next;             // ③ fast: 2 steps
    if (slow === fast) return true;    // ④ they met: they must be inside a loop
  }
  return false;
}
```

Finding the **start** adds one clever step. When they meet, put one pointer **back at the head** and move *both* one step at a time: they meet again exactly **at the start of the cycle**. (The distance from the head to the cycle start equals the distance from the meeting point onward to the start, modulo the cycle length.)

%% explain
- **Returns the node** itself (tests check identity), or `null` when there is no cycle.
- **Phase 1**: slow/fast until they meet (or fast ends).
- **Phase 2**: one pointer back to the head; both move 1 step until they meet.
- **A cycle that starts at the head** returns the head.

%% nudge
- What does it mean if `fast` becomes `null`?
- After the first meeting, why does a pointer restarted at the head meet the other at the cycle start?

%% starter
```js
export function detectCycle(head) {
  // your code
  return null;
}
```

%% tests
```js
const make = (n) => { const nodes = Array.from({ length: n }, (_, i) => ({ val: i + 1, next: null })); nodes.forEach((x, i) => { if (i < n - 1) x.next = nodes[i + 1]; }); return nodes; };

describe('detectCycle', () => {
  it('returns null for an acyclic list', () => {
    expect(detectCycle(make(5)[0])).toBeNull();
    expect(detectCycle(null)).toBeNull();
    expect(detectCycle(make(1)[0])).toBeNull();
  });

  it('finds the node where the cycle starts', () => {
    const nodes = make(5);
    nodes[4].next = nodes[2];
    expect(detectCycle(nodes[0])).toBe(nodes[2]);
  });

  it('handles a cycle that starts at the head', () => {
    const nodes = make(4);
    nodes[3].next = nodes[0];
    expect(detectCycle(nodes[0])).toBe(nodes[0]);
  });

  it('handles a self-loop', () => {
    const nodes = make(3);
    nodes[2].next = nodes[2];
    expect(detectCycle(nodes[0])).toBe(nodes[2]);
  });

  it('handles a cycle at the very end of a long list', () => {
    const nodes = make(100000);
    nodes[99999].next = nodes[99990];
    const t = Date.now();
    expect(detectCycle(nodes[0])).toBe(nodes[99990]);
    expect(Date.now() - t).toBeLessThan(400);
  });
});
```

%% hints
- Phase 1: `slow = slow.next; fast = fast.next.next` until they are equal; if `fast` or `fast.next` is `null`, return `null`.
- Phase 2: `slow = head`; move `slow` and `fast` one step each until `slow === fast`; return it.

%% solution
```js
export function detectCycle(head) {
  let slow = head;
  let fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      slow = head;
      while (slow !== fast) {
        slow = slow.next;
        fast = fast.next;
      }
      return slow;
    }
  }
  return null;
}
```

%% exercise dst-merge-lists | Merge two sorted lists | 2 | js | js | mergeTwoLists | 16
Merge two **sorted** linked lists (ascending, nodes `{ val, next }`) into **one sorted list** made by **re-linking the existing nodes** (no new nodes). Return the head of the merged list. When values are equal, take the node from the **first** list first (stable).

```js
// 1 → 3 → 5   and   2 → 4   →   1 → 2 → 3 → 4 → 5
```

%% worked
**A similar problem, solved: `appendAll(a, b)`** — attach list `b` after list `a` using a dummy node.

```js
function appendAll(a, b) {
  const dummy = { val: null, next: null };      // ① a fake first node: no "is the result empty?" special case
  let tail = dummy;
  for (let n = a; n; n = n.next) { tail.next = n; tail = n; }   // ② link each node of a
  tail.next = b;                                 // ③ then the whole of b, in one move
  return dummy.next;                             // ④ the real head
}
```

For the merge you do the same, but at each step **take the smaller front node** from the two lists: `tail.next = smaller; tail = smaller;`. When one list runs out, attach the **rest of the other** in one assignment.

%% explain
- **Re-links** the original nodes; creates none (tests check identity).
- **Sorted output**, stable: ties come from the first list first.
- **Either list can be empty** (`null`).
- **Linear**: 100 000 nodes each.

%% nudge
- Why is a dummy node helpful for the *first* node of the result?
- When one list is exhausted, how many pointer assignments finish the job?

%% starter
```js
export function mergeTwoLists(a, b) {
  // your code
  return null;
}
```

%% tests
```js
const list = (arr) => arr.reduceRight((next, val) => ({ val, next }), null);
const toArr = (head) => { const out = []; for (let n = head; n; n = n.next) out.push(n.val); return out; };

describe('mergeTwoLists', () => {
  it('merges two sorted lists', () => {
    expect(toArr(mergeTwoLists(list([1, 3, 5]), list([2, 4])))).toEqual([1, 2, 3, 4, 5]);
    expect(toArr(mergeTwoLists(list([1, 2, 3]), list([4, 5, 6])))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('handles empty lists', () => {
    expect(mergeTwoLists(null, null)).toBeNull();
    expect(toArr(mergeTwoLists(list([1, 2]), null))).toEqual([1, 2]);
    expect(toArr(mergeTwoLists(null, list([3])))).toEqual([3]);
  });

  it('is stable for equal values', () => {
    const a = list([1, 2]);
    const b = list([1, 2]);
    const m = mergeTwoLists(a, b);
    expect(m).toBe(a);
    expect(m.next).toBe(b);
  });

  it('re-links the original nodes', () => {
    const a = list([1, 4]);
    const b = list([2, 3]);
    const nodes = new Set([a, a.next, b, b.next]);
    for (let n = mergeTwoLists(a, b); n; n = n.next) expect(nodes.has(n)).toBe(true);
  });

  it('is linear on two 100 000-node lists', () => {
    const a = list(Array.from({ length: 100000 }, (_, i) => i * 2));
    const b = list(Array.from({ length: 100000 }, (_, i) => i * 2 + 1));
    const t = Date.now();
    const m = mergeTwoLists(a, b);
    expect(Date.now() - t).toBeLessThan(400);
    let prev = -1, count = 0;
    for (let n = m; n; n = n.next) { if (n.val < prev) throw new Error('not sorted'); prev = n.val; count++; }
    expect(count).toBe(200000);
  });
});
```

%% hints
- `const dummy = { val: null, next: null }; let tail = dummy;`
- Loop while both lists have nodes: pick `a` if `a.val <= b.val` (that keeps it stable), advance that list, and attach it to `tail`.
- After the loop: `tail.next = a || b;`.

%% solution
```js
export function mergeTwoLists(a, b) {
  const dummy = { val: null, next: null };
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }
  tail.next = a || b;
  return dummy.next;
}
```

%% exercise dst-remove-nth | Remove the nth from the end | 3 | js | js | removeNthFromEnd | 22
Remove the **n-th node from the end** of a linked list and return the head. `n` is at least 1 and at most the list length. Do it in **one pass** — you may not count the length first.

```js
// 1 → 2 → 3 → 4 → 5,  n = 2   →   1 → 2 → 3 → 5
```

%% worked
**A similar problem, solved: `middleNode(head)`** — the middle node in one pass, with two speeds.

```js
function middleNode(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {        // ① fast moves twice as fast...
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;                       // ② ...so when it reaches the end, slow is halfway
}
```

Here the two pointers keep a **fixed gap** instead of a fixed speed ratio: send `lead` **n steps ahead**, then move `lead` and `follow` together. When `lead` reaches the last node, `follow` stands just **before** the node to delete. A **dummy node** makes "delete the head" the same case as every other.

%% explain
- **One pass**, two pointers with a gap of `n`.
- **Dummy node** in front, so removing the first node works.
- **`n = length`** removes the head; **`n = 1`** removes the tail.
- **Single-node list** with `n = 1` returns `null`.

%% nudge
- If `lead` is `n` steps ahead and walks until its `next` is `null`, where is `follow`?
- How does a dummy node help when `n` equals the length?

%% starter
```js
export function removeNthFromEnd(head, n) {
  // your code
  return head;
}
```

%% tests
```js
const list = (arr) => arr.reduceRight((next, val) => ({ val, next }), null);
const toArr = (head) => { const out = []; for (let n = head; n; n = n.next) out.push(n.val); return out; };

describe('removeNthFromEnd', () => {
  it('removes from the middle', () => {
    expect(toArr(removeNthFromEnd(list([1, 2, 3, 4, 5]), 2))).toEqual([1, 2, 3, 5]);
  });

  it('removes the last node (n = 1)', () => {
    expect(toArr(removeNthFromEnd(list([1, 2, 3]), 1))).toEqual([1, 2]);
  });

  it('removes the head (n = length)', () => {
    expect(toArr(removeNthFromEnd(list([1, 2, 3]), 3))).toEqual([2, 3]);
  });

  it('handles a single-node list', () => {
    expect(removeNthFromEnd(list([7]), 1)).toBeNull();
  });

  it('is linear on a long list', () => {
    const head = list(Array.from({ length: 100000 }, (_, i) => i));
    const t = Date.now();
    const r = removeNthFromEnd(head, 50000);
    expect(Date.now() - t).toBeLessThan(400);
    let n = 0;
    for (let c = r; c; c = c.next) n++;
    expect(n).toBe(99999);
  });
});
```

%% hints
- `const dummy = { val: null, next: head }; let lead = dummy, follow = dummy;`
- Move `lead` forward `n` times. Then `while (lead.next) { lead = lead.next; follow = follow.next; }`.
- Now `follow.next` is the node to remove: `follow.next = follow.next.next; return dummy.next;`.

%% solution
```js
export function removeNthFromEnd(head, n) {
  const dummy = { val: null, next: head };
  let lead = dummy;
  let follow = dummy;
  for (let i = 0; i < n; i++) lead = lead.next;
  while (lead.next) {
    lead = lead.next;
    follow = follow.next;
  }
  follow.next = follow.next.next;
  return dummy.next;
}
```

%% exercise dst-doubly-list | Doubly linked list with O(1) removal | 3 | js | js | DoublyLinkedList | 28
Build `class DoublyLinkedList` with **dummy head and tail sentinels**. Nodes are `{ val, prev, next }`.

- `pushFront(x)` and `pushBack(x)` add a node and **return that node** (callers keep it as a handle).
- `remove(node)` unlinks a node **you hold** in O(1) and returns its value.
- `moveToFront(node)` moves a node you hold to the front in O(1).
- `popBack()` removes and returns the **last value** (`undefined` if empty).
- `size` is the number of real nodes; `toArray()` lists values front → back.

No walking to find a node: every operation except `toArray` must be **O(1)**.

%% worked
**A similar problem, solved: `insertBefore(node, x)`** in a doubly linked list with sentinels.

```js
function insertBefore(node, x) {
  const fresh = { val: x, prev: node.prev, next: node };   // ① the new node knows both neighbours
  node.prev.next = fresh;                                   // ② the old neighbour now points forward at it
  node.prev = fresh;                                        // ③ and `node` now points back at it
  return fresh;
}
```

Because the **sentinels** are always there, `node.prev` and `node.next` are never `null` for a real node, so there is no head/tail special case. `remove(node)` is the inverse: `node.prev.next = node.next; node.next.prev = node.prev;`. `moveToFront` is *remove, then insert after the head sentinel*.

%% explain
- **Sentinels**: `head` and `tail` dummy nodes; real nodes sit between them.
- **`pushFront` / `pushBack` return the node**, to use as a handle.
- **`remove(node)`** rewires four pointers and returns `node.val`.
- **`popBack`** removes `tail.prev` (or returns `undefined` if there isn't a real node).

%% nudge
- Which four pointers change when you insert a node between two neighbours?
- How does `moveToFront` reuse `remove` and an insert?

%% starter
```js
export class DoublyLinkedList {
  constructor() {
    this.head = { val: undefined, prev: null, next: null };   // sentinel
    this.tail = { val: undefined, prev: null, next: null };   // sentinel
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  pushFront(x) {
    // your code
  }

  pushBack(x) {
    // your code
  }

  remove(node) {
    // your code
  }

  moveToFront(node) {
    // your code
  }

  popBack() {
    // your code
  }

  toArray() {
    // your code
  }
}
```

%% tests
```js
describe('DoublyLinkedList', () => {
  it('pushes at both ends', () => {
    const l = new DoublyLinkedList();
    l.pushBack(2); l.pushBack(3); l.pushFront(1);
    expect(l.toArray()).toEqual([1, 2, 3]);
    expect(l.size).toBe(3);
  });

  it('returns the node as a handle', () => {
    const l = new DoublyLinkedList();
    const n = l.pushBack('x');
    expect(n.val).toBe('x');
  });

  it('removes a node you hold, from anywhere', () => {
    const l = new DoublyLinkedList();
    const a = l.pushBack('a');
    const b = l.pushBack('b');
    const c = l.pushBack('c');
    expect(l.remove(b)).toBe('b');
    expect(l.toArray()).toEqual(['a', 'c']);
    expect(l.remove(a)).toBe('a');
    expect(l.remove(c)).toBe('c');
    expect(l.toArray()).toEqual([]);
    expect(l.size).toBe(0);
  });

  it('moves a node to the front', () => {
    const l = new DoublyLinkedList();
    const a = l.pushBack('a');
    l.pushBack('b');
    const c = l.pushBack('c');
    l.moveToFront(c);
    expect(l.toArray()).toEqual(['c', 'a', 'b']);
    l.moveToFront(c);
    expect(l.toArray()).toEqual(['c', 'a', 'b']);
    l.moveToFront(a);
    expect(l.toArray()).toEqual(['a', 'c', 'b']);
    expect(l.size).toBe(3);
  });

  it('pops from the back', () => {
    const l = new DoublyLinkedList();
    expect(l.popBack()).toBeUndefined();
    l.pushBack(1); l.pushBack(2);
    expect(l.popBack()).toBe(2);
    expect(l.popBack()).toBe(1);
    expect(l.popBack()).toBeUndefined();
    expect(l.size).toBe(0);
  });

  it('keeps prev and next consistent', () => {
    const l = new DoublyLinkedList();
    const a = l.pushBack('a');
    const b = l.pushBack('b');
    expect(a.next).toBe(b);
    expect(b.prev).toBe(a);
    l.remove(a);
    expect(b.prev).toBe(l.head);
    expect(l.head.next).toBe(b);
  });

  it('is O(1) per operation', () => {
    const l = new DoublyLinkedList();
    const nodes = [];
    const t = Date.now();
    for (let i = 0; i < 100000; i++) nodes.push(l.pushBack(i));
    for (let i = 0; i < 100000; i += 2) l.remove(nodes[i]);
    for (let i = 1; i < 100000; i += 2) l.moveToFront(nodes[i]);
    expect(Date.now() - t).toBeLessThan(600);
    expect(l.size).toBe(50000);
    expect(l.toArray()[0]).toBe(99999);
  });
});
```

%% hints
- A private helper `insertAfter(node, fresh)` handles every insert: `fresh.prev = node; fresh.next = node.next; node.next.prev = fresh; node.next = fresh;`.
- `pushFront(x)` inserts after `this.head`; `pushBack(x)` inserts after `this.tail.prev`.
- `remove(node)`: `node.prev.next = node.next; node.next.prev = node.prev; this.size--;`.
- `moveToFront(node)` can unlink the node (without changing `size`) and re-insert it after `this.head`.

%% solution
```js
export class DoublyLinkedList {
  constructor() {
    this.head = { val: undefined, prev: null, next: null };
    this.tail = { val: undefined, prev: null, next: null };
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }

  insertAfter(node, fresh) {
    fresh.prev = node;
    fresh.next = node.next;
    node.next.prev = fresh;
    node.next = fresh;
  }

  unlink(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  pushFront(x) {
    const node = { val: x, prev: null, next: null };
    this.insertAfter(this.head, node);
    this.size++;
    return node;
  }

  pushBack(x) {
    const node = { val: x, prev: null, next: null };
    this.insertAfter(this.tail.prev, node);
    this.size++;
    return node;
  }

  remove(node) {
    this.unlink(node);
    this.size--;
    return node.val;
  }

  moveToFront(node) {
    this.unlink(node);
    this.insertAfter(this.head, node);
  }

  popBack() {
    if (this.size === 0) return undefined;
    return this.remove(this.tail.prev);
  }

  toArray() {
    const out = [];
    for (let n = this.head.next; n !== this.tail; n = n.next) out.push(n.val);
    return out;
  }
}
```
