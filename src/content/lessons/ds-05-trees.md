---
id: ds-trees
track: ds
title: Trees & binary search trees
summary: Nodes with children, the three-line recursion template, depth-first and breadth-first traversals, and how a binary search tree turns "sorted" into O(log n) search, until it degenerates.
---

## The idea in one sentence

A tree is a **linked list that can branch**: every node points at several children, which lets you organise data **hierarchically** — and, when the branching follows a rule, cut a search in half at every step.

> **Analogy** A folder structure: a root folder, subfolders, files at the end of each branch. To find a file you don't read every file on the disk — you follow the path. A **binary search tree** is a folder structure where, at every fork, *smaller things go left and bigger things go right*.

## Vocabulary

![A binary tree with root, parent, child, leaf, depth and height labelled](fig:ds-tree-anatomy "Every node has at most one parent. A binary tree node has at most two children: left and right.")

A **binary tree** node is `{ val, left, right }`, where a missing child is `null`. The **root** has no parent; **leaves** have no children; the **height** is the length of the longest path down.

Trees are everywhere in frontend work: the **DOM**, the **React component tree**, **JSON**, the **file system**, **route tables**, an **AST** in a compiler. (Those usually have *many* children per node instead of exactly two — the same ideas apply.)

## The recursion template

A tree is *defined* recursively — a node plus two smaller trees — so most tree code is recursion with the **same three beats**:

1. **Base case:** an empty tree (`null`) has a known answer.
2. **Recurse** on `left` and `right`, trusting the answers.
3. **Combine** them with this node's own value.

```js try
const leaf = (val) => ({ val, left: null, right: null });
const tree = { val: 4, left: { val: 2, left: leaf(1), right: leaf(3) }, right: leaf(6) };

const count  = (n) => (n === null ? 0 : 1 + count(n.left) + count(n.right));
const height = (n) => (n === null ? 0 : 1 + Math.max(height(n.left), height(n.right)));
const sum    = (n) => (n === null ? 0 : n.val + sum(n.left) + sum(n.right));
console.log(count(tree), height(tree), sum(tree));
```

One catch: recursion depth is limited (roughly ten thousand frames). A degenerate tree with 100 000 nodes in a chain would overflow, so deep trees need an **explicit stack** — you'll write one.

## Four ways to walk a tree

![The same tree traversed pre-order, in-order, post-order and level-order](fig:ds-tree-traversals "Depth-first traversals differ only in WHEN the node is visited relative to its children.")

```js try
function inorder(n, out = []) {
  if (n === null) return out;
  inorder(n.left, out);       // left subtree first...
  out.push(n.val);            // ...then this node...
  inorder(n.right, out);      // ...then the right subtree
  return out;
}
console.log(inorder({ val: 4, left: { val: 2, left: null, right: null }, right: { val: 6, left: null, right: null } }));
```

Move that `out.push` line **before** the two recursive calls and you get **pre-order**; **after** them, **post-order**. Which one to use depends on the job: *pre-order* copies a tree (parents before children), *post-order* deletes or measures one (children first), *in-order* of a BST gives sorted order.

**Level-order** (breadth-first) is different: it uses a **queue** instead of recursion, visiting the tree row by row.

```stepper Level-order with a queue
code:
  function levelOrder(root) {
    const out = [];
    const queue = [root];
    for (let i = 0; i < queue.length; i++) {   // an index instead of shift()
      const node = queue[i];
      out.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    return out;
  }
  levelOrder(tree);   // 4 at the top, then 2 and 6, then 1 3 5 7
---
line: 2-3
say: Start with the **root** in the queue. The queue always holds the nodes we have found but not yet visited.
queue: 4
out:
---
line: 5-8
say: Visit `4`: record it, then add its **children** `2` and `6` to the *back* of the queue.
queue: 4 | 2 | 6
out: 4
---
line: 5-8
say: Next in line is `2`. Visit it and queue its children `1` and `3` behind the ones already waiting.
queue: 4 | 2 | 6 | 1 | 3
out: 4 | 2
---
line: 5-8
say: Then `6`: its children `5` and `7` go to the back. Because the queue is first-in-first-out, a whole row is finished before the next row starts.
queue: 4 | 2 | 6 | 1 | 3 | 5 | 7
out: 4 | 2 | 6
---
line: 5-8
say: `1`, `3`, `5` and `7` have no children, so nothing is added and the loop runs out of queue.
out: 4 | 2 | 6 | 1 | 3 | 5 | 7
---
line: 10
say: Every node was visited once: **O(n)** time. The queue can hold a whole row at once, so the extra memory is the width of the tree.
Result: [4, 2, 6, 1, 3, 5, 7]
```

## Binary search trees

A **binary search tree (BST)** adds one rule: at **every node**, everything in the **left** subtree is **smaller** and everything in the **right** subtree is **larger**.

![Searching a BST: compare, go left or right, discard a whole subtree](fig:ds-bst-search "Each comparison throws away an entire subtree, like binary search on an array.")

```js try
function has(node, target) {
  while (node !== null) {
    if (target === node.val) return true;
    node = target < node.val ? node.left : node.right;   // discard one whole side
  }
  return false;
}
const leaf = (val) => ({ val, left: null, right: null });
const bst = { val: 8, left: { val: 3, left: leaf(1), right: leaf(6) }, right: { val: 10, left: null, right: leaf(14) } };
console.log(has(bst, 6), has(bst, 7));
```

That rule gives you three things for free:

- **Search, insert, delete in O(height)** — O(log n) when the tree is balanced.
- **In-order traversal is sorted.**
- **Min and max** are just "go left until you can't" / "go right until you can't".

**Deleting** a node is the one fiddly operation, with three cases: a **leaf** (just unlink it), a node with **one child** (replace it with that child), and a node with **two children** (copy in the **in-order successor** — the smallest value in the right subtree — then delete *that* node, which has at most one child).

## Balance matters

![Same seven values in a balanced tree and in a chain](fig:ds-bst-balance "A BST is only fast if it stays bushy. Self-balancing trees (AVL, red-black) rotate nodes to guarantee it.")

If you insert values **already in sorted order** into a plain BST, every node goes to the right and the tree becomes a **linked list**: height `n`, search O(n). Real libraries use **self-balancing** trees (AVL, red-black, B-trees in databases) that rotate nodes after inserts to keep the height at O(log n). In interviews the key facts are: the average case is O(log n), the worst case is O(n), and *why*.

## Quick check

```check
Q: Which traversal visits a binary search tree's values in sorted order?
A) Pre-order
B) Post-order
C) In-order *
D) Level-order
Why: In-order visits left subtree, the node, then the right subtree. In a BST that is smallest to largest.
---
Q: A recursive tree function has which three beats?
A) Loop, break, return
B) Base case for null, recurse on children, combine the results *
C) Sort, merge, split
D) Hash, compare, store
Why: Handle the empty tree, trust the recursive answers for the children, then combine them with the current node.
---
Q: Why does level-order traversal use a queue rather than recursion or a stack?
A) A queue is faster
B) First-in-first-out finishes each row before starting the next *
C) Recursion cannot visit trees
D) Stacks cannot hold nodes
Why: Children are appended behind the nodes already waiting, so earlier rows are always processed first.
---
Q: You insert 1, 2, 3, 4, 5 (in that order) into a plain BST. What is the shape and the search cost?
A) Balanced, O(log n)
B) A right-leaning chain, O(n) *
C) A perfect tree, O(1)
D) It rejects sorted input
Why: Each new value is larger than everything, so it always goes right. Self-balancing trees fix this with rotations.
---
Q: To delete a BST node that has two children, what do you usually do?
A) Delete both children
B) Replace its value with the in-order successor (smallest in the right subtree), then delete that node *
C) Rebuild the whole tree
D) Mark it hidden forever
Why: The successor is the next larger value, so the ordering rule still holds; and it has at most one child, so removing it is easy.
```

## Recap

- A tree node is `{ val, left, right }`; **height** = longest path down.
- Tree code is **recursion in three beats**: base case, recurse, combine. Very deep trees need an **explicit stack**.
- **DFS**: pre-/in-/post-order differ only in *when* you visit the node. **BFS** (level-order) uses a **queue**.
- A **BST** keeps left < node < right: **O(height)** search/insert/delete, **sorted in-order**. Delete has three cases.
- Sorted inserts make a chain (**O(n)**); self-balancing trees keep the height at **O(log n)**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: maximum depth | The three-beat recursion template |
| In-order without recursion | An explicit stack: go left as far as you can, then pop |
| Level by level | The level-order stepper, plus "how many nodes are in this row?" |
| Is it a valid BST? | Bounds passed down, not just a comparison with children |
| Lowest common ancestor | Recursion that returns "found a target" upwards |
| Build a BST | The search snippet and the three delete cases |

%% exercise dst-guided-max-depth | Guided: maximum depth | 1 | js | js | maxDepth | 8 | guided
Write `maxDepth(root)` for a binary tree with nodes `{ val, left, right }`. Return the number of **nodes on the longest path** from the root down to a leaf. An empty tree (`null`) has depth `0`.

```js
// 3 with children 9 and 20; 20 has children 15 and 7   →   3
```

%% worked
**A similar problem, solved: `countLeaves(root)`**

```js
function countLeaves(node) {
  if (node === null) return 0;                              // ① base case: an empty tree has no leaves
  if (node.left === null && node.right === null) return 1;  // ② a node with no children IS a leaf
  return countLeaves(node.left) + countLeaves(node.right);  // ③ combine the answers from both sides
}
```

Same three beats for `maxDepth`: the empty tree has depth `0`; otherwise this node counts for `1`, plus **the deeper** of the two subtrees.

%% explain
- **Counts nodes**, not edges: a single node has depth `1`.
- **`null`** has depth `0`.
- **Takes the larger** of the left and right depths.

%% nudge
- What is the depth of `null`?
- How do you combine the two children's depths?

%% starter
```js
export function maxDepth(root) {
  // Step 1 — base case: null → 0.
  // Step 2 — ask the left and right subtrees for their depth.
  // Step 3 — return 1 + the larger of the two.
  return -1;
}
```

%% tests
```js
const leaf = (val) => ({ val, left: null, right: null });

describe('maxDepth', () => {
  it('handles an empty tree', () => {
    expect(maxDepth(null)).toBe(0);
  });

  it('handles a single node', () => {
    expect(maxDepth(leaf(1))).toBe(1);
  });

  it('finds the longest path', () => {
    const t = { val: 3, left: leaf(9), right: { val: 20, left: leaf(15), right: leaf(7) } };
    expect(maxDepth(t)).toBe(3);
  });

  it('follows the deeper side', () => {
    const t = { val: 1, left: { val: 2, left: { val: 3, left: leaf(4), right: null }, right: null }, right: null };
    expect(maxDepth(t)).toBe(4);
  });

  it('handles a deep chain', () => {
    let root = null;
    for (let i = 0; i < 3000; i++) root = { val: i, left: root, right: null };
    expect(maxDepth(root)).toBe(3000);
  });
});
```

%% hints
- `if (root === null) return 0; return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));`

%% solution
```js
export function maxDepth(root) {
  if (root === null) return 0;
  return 1 + Math.max(maxDepth(root.left), maxDepth(root.right));
}
```

%% exercise dst-inorder-iterative | In-order without recursion | 2 | js | js | inorder | 18
Return the **in-order** values (left, node, right) of a binary tree **without recursion** — use an explicit stack. The tests include a left-leaning chain of 100 000 nodes, which would overflow the call stack.

```js
// 4 with children 2 and 6   →   [2, 4, 6]
```

%% worked
**A similar problem, solved: `leftSpine(root)`** — list the values going down the left edge.

```js
function leftSpine(root) {
  const out = [];
  for (let node = root; node !== null; node = node.left) out.push(node.val);   // ① keep going left until the edge ends
  return out;
}
```

An iterative in-order walk is built from this: **push every node on the way down the left edge** onto a stack (they are all waiting for *their* turn), then **pop** one, visit it, and repeat the same "go left" move from its **right child**.

%% explain
- **In-order**: left subtree, node, right subtree.
- **No recursion**: an explicit `stack` array.
- **Loop shape**: go left and push; pop and visit; move to the right child.
- **Empty tree** returns `[]`.

%% nudge
- What goes on the stack, and when do you take something off?
- After visiting a node, where do you continue from?

%% starter
```js
export function inorder(root) {
  const out = [];
  // your code
  return out;
}
```

%% tests
```js
const leaf = (val) => ({ val, left: null, right: null });

describe('inorder', () => {
  it('visits left, node, right', () => {
    const t = { val: 4, left: { val: 2, left: leaf(1), right: leaf(3) }, right: { val: 6, left: leaf(5), right: leaf(7) } };
    expect(inorder(t)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('handles empty and single-node trees', () => {
    expect(inorder(null)).toEqual([]);
    expect(inorder(leaf(9))).toEqual([9]);
  });

  it('handles lopsided trees', () => {
    const left = { val: 3, left: { val: 2, left: leaf(1), right: null }, right: null };
    expect(inorder(left)).toEqual([1, 2, 3]);
    const right = { val: 1, left: null, right: { val: 2, left: null, right: leaf(3) } };
    expect(inorder(right)).toEqual([1, 2, 3]);
  });

  it('does not use recursion: a 100 000-node chain works', () => {
    let root = null;
    for (let i = 0; i < 100000; i++) root = { val: i, left: root, right: null };
    const t = Date.now();
    const r = inorder(root);
    expect(Date.now() - t).toBeLessThan(500);
    expect(r.length).toBe(100000);
    expect(r[0]).toBe(0);
    expect(r[99999]).toBe(99999);
  });
});
```

%% hints
- `const stack = []; let node = root;` then `while (node || stack.length)`.
- Inside: `while (node) { stack.push(node); node = node.left; }` then `node = stack.pop(); out.push(node.val); node = node.right;`.

%% solution
```js
export function inorder(root) {
  const out = [];
  const stack = [];
  let node = root;
  while (node || stack.length) {
    while (node) {
      stack.push(node);
      node = node.left;
    }
    node = stack.pop();
    out.push(node.val);
    node = node.right;
  }
  return out;
}
```

%% exercise dst-level-order | Level by level | 2 | js | js | levelOrder | 18
Return the values of a binary tree **grouped by level**, top to bottom, left to right: an array of arrays. An empty tree returns `[]`.

```js
// 3 with children 9 and 20; 20 has children 15 and 7   →   [[3], [9, 20], [15, 7]]
```

%% worked
**A similar problem, solved: `levelWidths(root)`** — just *how many nodes* are on each level.

```js
function levelWidths(root) {
  if (!root) return [];
  const widths = [];
  let level = [root];                        // ① the current row, as an array of nodes
  while (level.length) {
    widths.push(level.length);               // ② one row finished: record its size
    const next = [];
    for (const n of level) {
      if (n.left) next.push(n.left);         // ③ gather the next row from the children
      if (n.right) next.push(n.right);
    }
    level = next;
  }
  return widths;
}
```

Working **row by row** (instead of one long queue) means you always know where one level ends. For `levelOrder`, record the *values* of `level` instead of its length.

%% explain
- **One inner array per level**, left to right.
- **Empty tree** returns `[]`.
- **A skewed tree** gives one value per level.
- **Linear time**: each node is visited once.

%% nudge
- How do you know where one level ends and the next begins?
- What do you build from the current level to get the next one?

%% starter
```js
export function levelOrder(root) {
  // your code
  return [];
}
```

%% tests
```js
const leaf = (val) => ({ val, left: null, right: null });

describe('levelOrder', () => {
  it('groups values by level', () => {
    const t = { val: 3, left: leaf(9), right: { val: 20, left: leaf(15), right: leaf(7) } };
    expect(levelOrder(t)).toEqual([[3], [9, 20], [15, 7]]);
  });

  it('handles empty and single-node trees', () => {
    expect(levelOrder(null)).toEqual([]);
    expect(levelOrder(leaf(1))).toEqual([[1]]);
  });

  it('handles lopsided trees', () => {
    const t = { val: 1, left: { val: 2, left: leaf(3), right: null }, right: null };
    expect(levelOrder(t)).toEqual([[1], [2], [3]]);
    const r = { val: 1, left: null, right: { val: 2, left: null, right: leaf(3) } };
    expect(levelOrder(r)).toEqual([[1], [2], [3]]);
  });

  it('is linear on a wide tree', () => {
    const build = (d) => (d === 0 ? null : { val: d, left: build(d - 1), right: build(d - 1) });
    const t = build(15);
    const start = Date.now();
    const r = levelOrder(t);
    expect(Date.now() - start).toBeLessThan(800);
    expect(r.length).toBe(15);
    expect(r[14].length).toBe(16384);
  });
});
```

%% hints
- Start with `let level = [root]`. Loop while `level.length`.
- Record `level.map((n) => n.val)`, then build `next` from every node's non-null children.

%% solution
```js
export function levelOrder(root) {
  if (!root) return [];
  const result = [];
  let level = [root];
  while (level.length) {
    result.push(level.map((n) => n.val));
    const next = [];
    for (const n of level) {
      if (n.left) next.push(n.left);
      if (n.right) next.push(n.right);
    }
    level = next;
  }
  return result;
}
```

%% exercise dst-valid-bst | Is it a valid BST? | 3 | js | js | isValidBST | 24
Return whether a binary tree is a **valid binary search tree**: for **every** node, all values in its left subtree are **strictly smaller** and all values in its right subtree are **strictly larger**. Duplicates make a tree invalid.

```js
// 2 with children 1 and 3  → true
// 5 with children 1 and 4; 4 has children 3 and 6  → false   (3 is in the right subtree of 5, but 3 < 5)
```

%% worked
**A similar problem, solved: `allBetween(node, lo, hi)`** — are all values strictly between two bounds?

```js
function allBetween(node, lo, hi) {
  if (node === null) return true;                              // ① an empty tree is fine
  if (node.val <= lo || node.val >= hi) return false;          // ② outside the allowed window
  return allBetween(node.left, lo, node.val)                   // ③ left side: must be below this node...
      && allBetween(node.right, node.val, hi);                 // ④ ...right side: must be above it
}
```

That *is* `isValidBST` — start with the widest possible window `(-Infinity, Infinity)`. Comparing a node only with its **direct children** is the classic bug: it misses a `3` hiding in the right subtree of a `5`. The **window narrows** as you go down, so every ancestor's constraint is remembered.

%% explain
- **Strictly ordered**: equal values are invalid.
- **Every ancestor counts**, not just the parent: pass `lo` and `hi` bounds down.
- **Empty tree** and **single node** are valid.
- **Deep trees**: a 3000-node chain is tested.

%% nudge
- Why isn't "left child < node < right child" enough?
- What range is a node's right child allowed to be in, given all of its ancestors?

%% starter
```js
export function isValidBST(root) {
  // your code
  return true;
}
```

%% tests
```js
const leaf = (val) => ({ val, left: null, right: null });

describe('isValidBST', () => {
  it('accepts valid trees', () => {
    expect(isValidBST({ val: 2, left: leaf(1), right: leaf(3) })).toBe(true);
    expect(isValidBST({ val: 4, left: { val: 2, left: leaf(1), right: leaf(3) }, right: { val: 6, left: leaf(5), right: leaf(7) } })).toBe(true);
  });

  it('accepts empty and single-node trees', () => {
    expect(isValidBST(null)).toBe(true);
    expect(isValidBST(leaf(5))).toBe(true);
  });

  it('rejects an out-of-order child', () => {
    expect(isValidBST({ val: 2, left: leaf(3), right: leaf(1) })).toBe(false);
  });

  it('rejects a deep violation (not just parent/child)', () => {
    const t = { val: 5, left: leaf(1), right: { val: 4, left: leaf(3), right: leaf(6) } };
    expect(isValidBST(t)).toBe(false);
    const u = { val: 10, left: { val: 5, left: null, right: leaf(15) }, right: leaf(20) };
    expect(isValidBST(u)).toBe(false);
  });

  it('rejects duplicates', () => {
    expect(isValidBST({ val: 2, left: leaf(2), right: null })).toBe(false);
    expect(isValidBST({ val: 2, left: null, right: leaf(2) })).toBe(false);
  });

  it('handles extreme values and a deep valid chain', () => {
    expect(isValidBST({ val: Number.MAX_SAFE_INTEGER, left: leaf(-Number.MAX_SAFE_INTEGER), right: null })).toBe(true);
    let root = null;
    for (let i = 0; i < 3000; i++) root = { val: i + 1, left: root, right: null };
    expect(isValidBST(root)).toBe(true);
  });
});
```

%% hints
- Write a helper `check(node, lo, hi)` and call it with `(-Infinity, Infinity)`.
- For the left child use `(lo, node.val)`; for the right child `(node.val, hi)`. Reject when `node.val <= lo || node.val >= hi`.

%% solution
```js
export function isValidBST(root) {
  const check = (node, lo, hi) => {
    if (node === null) return true;
    if (node.val <= lo || node.val >= hi) return false;
    return check(node.left, lo, node.val) && check(node.right, node.val, hi);
  };
  return check(root, -Infinity, Infinity);
}
```

%% exercise dst-lca | Lowest common ancestor | 3 | js | js | lowestCommonAncestor | 24
Given a binary tree (not necessarily a BST) with **distinct values**, and two values `p` and `q` that both exist in it, return the **value of their lowest common ancestor**: the deepest node that has both `p` and `q` in its subtree (a node counts as its own descendant).

```js
// root 3; 3 → 5, 1; 5 → 6, 2; 2 → 7, 4; 1 → 0, 8
lowestCommonAncestor(root, 5, 1); // 3
lowestCommonAncestor(root, 5, 4); // 5   (5 is an ancestor of 4)
```

%% worked
**A similar problem, solved: `contains(root, target)`** — is a value anywhere in the tree?

```js
function contains(node, target) {
  if (node === null) return false;                                     // ① nothing here
  if (node.val === target) return true;                                // ② found it
  return contains(node.left, target) || contains(node.right, target);  // ③ look in either subtree
}
```

For the LCA, have the recursion **report upwards** what it found: a call returns the node if it *is* `p` or `q`, or the answer from below. Then at each node: if **both** sides returned something, this node is the meeting point — the LCA. If only one side did, pass that result up.

%% explain
- **Returns the value** of the LCA.
- **A node can be its own ancestor**: `lca(5, 4)` is `5`.
- **Distinct values**; both targets are guaranteed to exist.
- **Not a BST**, so you can't use ordering; search both sides.

%% nudge
- What should a call return when it finds `p` or `q` right at the current node?
- When do both subtrees report a hit?

%% starter
```js
export function lowestCommonAncestor(root, p, q) {
  // your code
  return undefined;
}
```

%% tests
```js
const n = (val, left = null, right = null) => ({ val, left, right });
const tree = () => n(3, n(5, n(6), n(2, n(7), n(4))), n(1, n(0), n(8)));

describe('lowestCommonAncestor', () => {
  it('finds the meeting point of two branches', () => {
    expect(lowestCommonAncestor(tree(), 5, 1)).toBe(3);
    expect(lowestCommonAncestor(tree(), 6, 4)).toBe(5);
    expect(lowestCommonAncestor(tree(), 7, 4)).toBe(2);
    expect(lowestCommonAncestor(tree(), 0, 8)).toBe(1);
  });

  it('allows a node to be its own ancestor', () => {
    expect(lowestCommonAncestor(tree(), 5, 4)).toBe(5);
    expect(lowestCommonAncestor(tree(), 3, 8)).toBe(3);
  });

  it('works when both values are the same node', () => {
    expect(lowestCommonAncestor(tree(), 6, 6)).toBe(6);
  });

  it('works on a two-node tree', () => {
    expect(lowestCommonAncestor(n(1, n(2)), 1, 2)).toBe(1);
  });

  it('handles a deep chain', () => {
    let root = null;
    for (let i = 2000; i >= 1; i--) root = n(i, root, null);
    expect(lowestCommonAncestor(root, 1999, 2000)).toBe(1999);
    expect(lowestCommonAncestor(root, 10, 1500)).toBe(10);
  });
});
```

%% hints
- Return `null` for an empty tree. If `root.val === p || root.val === q`, return `root`.
- Recurse into `left` and `right`. If both results are non-null, `root` is the LCA; otherwise return whichever is non-null.
- Return the **value** (`.val`) of the final node.

%% solution
```js
export function lowestCommonAncestor(root, p, q) {
  const find = (node) => {
    if (node === null) return null;
    if (node.val === p || node.val === q) return node;
    const left = find(node.left);
    const right = find(node.right);
    if (left && right) return node;
    return left || right;
  };
  const found = find(root);
  return found ? found.val : undefined;
}
```

%% exercise dst-bst | Build a binary search tree | 4 | js | js | BST | 35
Build `class BST` of numbers (nodes `{ val, left, right }`) with:

- `insert(x)` → `true` if inserted, `false` if `x` is already present (no duplicates).
- `has(x)` → boolean.
- `min()` / `max()` → the smallest / largest value, or `undefined` if empty.
- `remove(x)` → `true` if it was present and removed, else `false`. It must handle a **leaf**, a node with **one child**, and a node with **two children**, and removing the **root**.
- `inorder()` → all values, sorted.
- `size` → the number of values.

Use **loops or recursion**, whichever you like. The tests insert 20 000 values in a scrambled order, so keep operations O(height).

%% worked
**A similar problem, solved: `insertInto(node, x)`** — insert into a BST and return the (possibly new) subtree root.

```js
function insertInto(node, x) {
  if (node === null) return { val: x, left: null, right: null };     // ① found the empty spot: a new leaf goes here
  if (x < node.val) node.left = insertInto(node.left, x);            // ② smaller: it belongs on the left
  else if (x > node.val) node.right = insertInto(node.right, x);     // ③ larger: on the right
  return node;                                                        // ④ (equal: already there, change nothing)
}
```

The recursive style "return the new root of this subtree" makes **remove** natural too: `node.left = remove(node.left, x)`. When you find the node: no left child → return `node.right`; no right child → return `node.left`; two children → copy the **smallest value of the right subtree** into this node, then remove that value from the right subtree.

%% explain
- **No duplicates**: `insert` returns `false` for an existing value.
- **`remove`** rewires: leaf → `null`; one child → that child; two children → the in-order successor's value.
- **`size`** changes only on a successful insert/remove.
- **`inorder()`** is always sorted.

%% nudge
- What do you return for a node with only one child when you delete it?
- For two children, which value replaces the deleted one, and where is it?

%% starter
```js
export class BST {
  constructor() {
    this.root = null;
    this.size = 0;
  }

  insert(x) {
    // your code
  }

  has(x) {
    // your code
  }

  min() {
    // your code
  }

  max() {
    // your code
  }

  remove(x) {
    // your code
  }

  inorder() {
    // your code
  }
}
```

%% tests
```js
describe('BST', () => {
  const build = (xs) => { const t = new BST(); xs.forEach((x) => t.insert(x)); return t; };

  it('inserts and searches', () => {
    const t = build([8, 3, 10, 1, 6, 14]);
    expect(t.has(6)).toBe(true);
    expect(t.has(7)).toBe(false);
    expect(t.size).toBe(6);
  });

  it('rejects duplicates', () => {
    const t = new BST();
    expect(t.insert(5)).toBe(true);
    expect(t.insert(5)).toBe(false);
    expect(t.size).toBe(1);
  });

  it('keeps values sorted in order', () => {
    expect(build([8, 3, 10, 1, 6, 14, 4, 7, 13]).inorder()).toEqual([1, 3, 4, 6, 7, 8, 10, 13, 14]);
  });

  it('finds min and max', () => {
    const t = build([8, 3, 10, 1, 6, 14]);
    expect(t.min()).toBe(1);
    expect(t.max()).toBe(14);
    expect(new BST().min()).toBeUndefined();
    expect(new BST().max()).toBeUndefined();
  });

  it('removes a leaf', () => {
    const t = build([8, 3, 10, 1, 6]);
    expect(t.remove(1)).toBe(true);
    expect(t.inorder()).toEqual([3, 6, 8, 10]);
    expect(t.size).toBe(4);
  });

  it('removes a node with one child', () => {
    const t = build([8, 3, 10, 14]);
    expect(t.remove(10)).toBe(true);
    expect(t.inorder()).toEqual([3, 8, 14]);
    expect(t.has(14)).toBe(true);
  });

  it('removes a node with two children', () => {
    const t = build([8, 3, 10, 1, 6, 4, 7, 14, 13]);
    expect(t.remove(3)).toBe(true);
    expect(t.inorder()).toEqual([1, 4, 6, 7, 8, 10, 13, 14]);
    expect(t.remove(8)).toBe(true);
    expect(t.inorder()).toEqual([1, 4, 6, 7, 10, 13, 14]);
    expect(t.has(8)).toBe(false);
    expect(t.size).toBe(7);
  });

  it('removes the root, down to empty', () => {
    const t = build([2, 1, 3]);
    expect(t.remove(2)).toBe(true);
    expect(t.inorder()).toEqual([1, 3]);
    expect(t.remove(1)).toBe(true);
    expect(t.remove(3)).toBe(true);
    expect(t.size).toBe(0);
    expect(t.root).toBeNull();
    expect(t.inorder()).toEqual([]);
  });

  it('returns false when removing something absent', () => {
    const t = build([5, 2, 8]);
    expect(t.remove(99)).toBe(false);
    expect(t.size).toBe(3);
  });

  it('is fast on 20 000 scrambled values', () => {
    const t = new BST();
    const start = Date.now();
    for (let i = 0; i < 20000; i++) t.insert((i * 7919) % 20011);
    for (let i = 0; i < 20000; i += 2) t.remove((i * 7919) % 20011);
    expect(Date.now() - start).toBeLessThan(800);
    expect(t.size).toBe(10000);
    const out = t.inorder();
    expect(out.every((v, i) => i === 0 || out[i - 1] < v)).toBe(true);
  });
});
```

%% hints
- `insert`: walk down from the root comparing `x`; stop and attach a new node when you reach `null`; return `false` on equality.
- `remove` (recursive helper returning the new subtree root): not found → return `node` unchanged. One child or none → return the other child. Two children → find the min of `node.right`, copy its value into `node`, then `node.right = remove(node.right, thatValue)`.
- `min` goes left until `left === null`; `max` goes right. `inorder` can use an explicit stack or recursion.

%% solution
```js
export class BST {
  constructor() {
    this.root = null;
    this.size = 0;
  }

  insert(x) {
    const fresh = { val: x, left: null, right: null };
    if (this.root === null) {
      this.root = fresh;
      this.size++;
      return true;
    }
    let node = this.root;
    while (true) {
      if (x === node.val) return false;
      const side = x < node.val ? 'left' : 'right';
      if (node[side] === null) {
        node[side] = fresh;
        this.size++;
        return true;
      }
      node = node[side];
    }
  }

  has(x) {
    let node = this.root;
    while (node !== null) {
      if (x === node.val) return true;
      node = x < node.val ? node.left : node.right;
    }
    return false;
  }

  min() {
    let node = this.root;
    if (node === null) return undefined;
    while (node.left !== null) node = node.left;
    return node.val;
  }

  max() {
    let node = this.root;
    if (node === null) return undefined;
    while (node.right !== null) node = node.right;
    return node.val;
  }

  remove(x) {
    let removed = false;
    const walk = (node, target) => {
      if (node === null) return null;
      if (target < node.val) {
        node.left = walk(node.left, target);
        return node;
      }
      if (target > node.val) {
        node.right = walk(node.right, target);
        return node;
      }
      removed = true;
      if (node.left === null) return node.right;
      if (node.right === null) return node.left;
      let successor = node.right;
      while (successor.left !== null) successor = successor.left;
      node.val = successor.val;
      node.right = walk(node.right, successor.val);
      return node;
    };
    this.root = walk(this.root, x);
    if (removed) this.size--;
    return removed;
  }

  inorder() {
    const out = [];
    const stack = [];
    let node = this.root;
    while (node || stack.length) {
      while (node) {
        stack.push(node);
        node = node.left;
      }
      node = stack.pop();
      out.push(node.val);
      node = node.right;
    }
    return out;
  }
}
```
