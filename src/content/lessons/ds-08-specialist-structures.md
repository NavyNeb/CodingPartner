---
id: ds-specialist
track: ds
title: Union-find, prefix counts & Fenwick trees
summary: Three specialist tools that turn slow repeated questions into near-instant ones: union-find for "are these connected?", prefix sums and Fenwick trees for range totals, and a trie with counts for prefixes.
---

## The idea in one sentence

When you must answer **the same kind of question thousands of times**, don't recompute from scratch — **keep just enough extra information** so each question costs almost nothing.

> **Analogy** A running tally on a scoreboard. To know "how many points between round 3 and round 7?" you could re-add every round — or subtract the tally after round 2 from the tally after round 7. A little bookkeeping up front, instant answers after.

## Union-find: are these connected?

Sometimes you get connections **one at a time** and keep asking "are A and B in the same group?" — merging friend circles, networks coming online, "is this edge forming a loop?". Rebuilding a graph search every time would be slow. **Union-find** (disjoint-set union, DSU) keeps each group as a **tree where every node points to a parent**, and the **root** (a node that is its own parent) names the group.

![Union-find stores sets as trees of parent pointers](fig:ds-dsu-forest "find climbs to the root; union attaches one root under the other.")

- **`find(x)`**: climb parents until you reach a root. Same root means same group.
- **`union(a, b)`**: find both roots; if they differ, hang one root under the other.

```stepper Union-find on five elements
code:
  const uf = new UnionFind(5);   // every element starts as its own set
  uf.union(0, 1);
  uf.union(2, 3);
  uf.union(1, 3);
  uf.connected(0, 2);
  uf.connected(0, 4);
---
line: 1
say: Five elements, five separate sets. Every element is **its own parent** (and its own root).
parent: 0 | 1 | 2 | 3 | 4
sets: {0} {1} {2} {3} {4}
---
line: 2
say: `union(0, 1)`: the roots are `0` and `1`, different, so attach `1` under `0` (set `parent[1] = 0`).
parent: 0 | 0 | 2 | 3 | 4
sets: {0, 1} {2} {3} {4}
---
line: 3
say: `union(2, 3)`: attach `3` under `2`.
parent: 0 | 0 | 2 | 2 | 4
sets: {0, 1} {2, 3} {4}
---
line: 4
say: `union(1, 3)`: `find(1)` climbs `1 → 0`, root `0`. `find(3)` climbs `3 → 2`, root `2`. Different roots, so attach root `2` under root `0`. One edit merged two whole groups.
parent: 0 | 0 | 0 | 2 | 4
sets: {0, 1, 2, 3} {4}
---
line: 5
say: `connected(0, 2)`: `find(0)` is `0` and `find(2)` is `0`. Same root → `true`.
answer: true
---
line: 6
say: `connected(0, 4)`: roots `0` and `4` differ → `false`.
answer: false
```

Done naively, trees can grow into long chains and `find` becomes O(n). Two tiny tricks fix that:

- **Path compression:** while climbing in `find`, point nodes **straight at the root** (or at their grandparent) so the next climb is shorter.
- **Union by size:** always attach the **smaller** tree under the **larger** one, so trees stay shallow.

![Path compression flattens a long chain](fig:ds-dsu-compress "After one find, every node on the path points straight at the root.")

```js try
class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = new Array(n).fill(1);
    this.count = n;                                      // number of separate sets
  }
  find(x) {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];      // path compression (halving)
      x = this.parent[x];
    }
    return x;
  }
  union(a, b) {
    let ra = this.find(a), rb = this.find(b);
    if (ra === rb) return false;                         // already together
    if (this.size[ra] < this.size[rb]) [ra, rb] = [rb, ra];
    this.parent[rb] = ra;                                // smaller under larger
    this.size[ra] += this.size[rb];
    this.count--;
    return true;
  }
  connected(a, b) { return this.find(a) === this.find(b); }
}
const uf = new UnionFind(6);
uf.union(0, 1); uf.union(2, 3); uf.union(1, 3);
console.log(uf.connected(0, 2), uf.connected(0, 5), uf.count);
```

With both tricks each operation is **nearly O(1)** (technically "inverse Ackermann": under 5 for any input that fits in the universe). Typical jobs: **count connected components**, **detect a cycle in an undirected graph** (an edge whose ends are already connected closes a loop), **Kruskal's minimum spanning tree**, and merging accounts.

## Prefix sums: range totals in O(1)

For "what is the sum of items `l` to `r`?" asked many times on a fixed array, precompute **prefix sums** once: `prefix[k]` = the sum of the **first `k`** items.

![The array 3 1 4 1 5 and its prefix sums](fig:ds-prefix-sums "Subtracting two prefix sums gives any range total.")

```js try
const nums = [3, 1, 4, 1, 5];
const prefix = [0];
for (const x of nums) prefix.push(prefix[prefix.length - 1] + x);      // build once: O(n)
const rangeSum = (l, r) => prefix[r + 1] - prefix[l];                   // every query: O(1)
console.log(prefix, rangeSum(1, 3));                                     // [0,3,4,8,9,14] and 1+4+1 = 6
```

The same idea works in **two dimensions** (sum of a rectangle with four lookups), and with a `Map` for "does a subarray sum to `k`?" (the hash-table lesson).

## Fenwick tree: when the numbers change

Prefix sums break if you also **update** values: changing one item would force you to rewrite every prefix after it (O(n)). A **Fenwick tree** (binary indexed tree) keeps **partial sums over cleverly chosen ranges**, so both a **point update** and a **prefix query** cost **O(log n)**:

![A Fenwick tree: each entry covers a power-of-two-sized range](fig:ds-fenwick "Entry i covers (i − lowbit(i), i]. Queries walk down by dropping the lowest bit; updates walk up by adding it.")

The trick is the **lowest set bit** of an index, `i & -i`:

```js try
console.log([1, 2, 3, 4, 5, 6, 7, 8].map((i) => i & -i));    // 1 2 1 4 1 2 1 8: how many positions each entry covers
```

- **`prefix(i)`**: start at `i + 1` (Fenwick trees are 1-indexed) and repeatedly add `tree[i]`, then `i -= i & -i`.
- **`add(i, delta)`**: start at `i + 1` and repeatedly do `tree[i] += delta`, then `i += i & -i`.

## Tries with counts

You met the **trie** in the interview lesson. Store a **count at each node** — how many words pass through it — and prefix questions become one walk:

![A trie of car, cat and dog with counts at every node](fig:ds-trie-counts "countPrefix reads one node; erase decrements the counts along the path.")

`countPrefix("ca")` walks `c → a` and reads `2`: **O(length of the prefix)**, regardless of how many words are stored — compare with scanning every word, O(total characters).

## Quick check

```check
Q: What does `find(x)` return in union-find?
A) The size of x's group
B) The root of the tree containing x, which names its group *
C) The parent of x only
D) The number of groups
Why: Climb parent pointers until a node is its own parent. Two elements are in the same set exactly when their roots are equal.
---
Q: Why does union by size matter?
A) It makes the sets bigger
B) Attaching the smaller tree under the larger keeps the trees shallow *
C) It avoids storing parents
D) It sorts the elements
Why: A tall tree makes `find` slow. Hanging the shorter/smaller one under the taller/larger one keeps the height logarithmic.
---
Q: Which union-find use detects a cycle in an undirected graph?
A) An edge whose two ends are already connected closes a loop *
B) An edge with a large weight
C) A node with no parent
D) The last edge always
Why: If `find(a) === find(b)` before you union them, there was already a path between a and b, so the new edge forms a cycle.
---
Q: You have a fixed array and 100 000 range-sum queries. What is the best approach?
A) Re-add each range every time, O(n) per query
B) Precompute prefix sums once, then answer each query in O(1) *
C) Sort the array
D) Use a stack
Why: `sum(l..r) = prefix[r + 1] - prefix[l]`: one pass to build, two lookups per query.
---
Q: Why choose a Fenwick tree over plain prefix sums?
A) It uses less memory than the array
B) It supports point updates in O(log n) as well as prefix queries *
C) It stores sorted data
D) It handles strings
Why: A plain prefix array must be rewritten after an update. The Fenwick tree keeps both operations logarithmic.
```

## Recap

- **Union-find** answers "are these connected?" as sets merge: **path compression + union by size** make it **almost O(1)** per operation. Uses: components, cycle detection, Kruskal.
- **Prefix sums** turn range totals into **two lookups**; a **Fenwick tree** keeps them **O(log n)** even when values change.
- Index trick: `i & -i` is the **lowest set bit**.
- A **trie with counts** answers prefix-count questions in O(prefix length).
- The theme: **keep just enough extra information** and the repeated question becomes cheap.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: union-find | The `parent` array and a climbing `find` |
| Count components | `UnionFind` with compression, or union by size |
| Redundant connection | "Union fails" means a cycle |
| Prefix counter (trie) | Counts on nodes; decrement on `erase` |
| Fenwick tree | `i & -i`; walk down to query, up to update |
| 2-D range sums | Inclusion–exclusion on a prefix table |

%% exercise dst-guided-union-find | Guided: union-find | 1 | js | js | UnionFind | 10 | guided
Build `class UnionFind` for elements `0 … n-1`:

- `new UnionFind(n)` starts with every element in its own set; `count` is the number of sets.
- `find(x)` returns the **root** of `x`'s set.
- `union(a, b)` merges the sets and returns `true`, or returns `false` if they were already together. It decreases `count` when it merges.
- `connected(a, b)` says whether they are in the same set.

(The version you build here can be the plain one: no compression yet.)

%% worked
**A similar problem, solved: `rootOf(parent, x)`** — climb a parent array to the top.

```js
function rootOf(parent, x) {
  while (parent[x] !== x) x = parent[x];     // ① a root is a node that is its own parent
  return x;
}
```

`union(a, b)` is: *find both roots*; if they're equal, return `false`; otherwise point one root at the other (`parent[ra] = rb`), `count--`, return `true`. `connected` compares the two roots.

%% explain
- **Initially** `parent[i] = i` for every `i`, and `count = n`.
- **`find`** follows parents to the root.
- **`union`** returns whether it actually merged anything.
- **`count`** goes down by one per successful merge.

%% nudge
- How do you recognise a root?
- What does `union` do when both roots are already equal?

%% starter
```js
export class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.count = n;
  }

  find(x) {
    // Step 1 — while parent[x] !== x, move x to its parent.
    // Step 2 — return x (the root).
    return -1;
  }

  union(a, b) {
    // Step 1 — ra = find(a), rb = find(b).
    // Step 2 — equal? return false.
    // Step 3 — otherwise parent[ra] = rb, count--, return true.
    return false;
  }

  connected(a, b) {
    // your code
    return false;
  }
}
```

%% tests
```js
describe('UnionFind', () => {
  it('starts with every element on its own', () => {
    const uf = new UnionFind(4);
    expect(uf.count).toBe(4);
    expect(uf.connected(0, 1)).toBe(false);
    expect(uf.find(2)).toBe(2);
  });

  it('merges sets', () => {
    const uf = new UnionFind(5);
    expect(uf.union(0, 1)).toBe(true);
    expect(uf.union(2, 3)).toBe(true);
    expect(uf.connected(0, 1)).toBe(true);
    expect(uf.connected(0, 2)).toBe(false);
    expect(uf.union(1, 3)).toBe(true);
    expect(uf.connected(0, 2)).toBe(true);
    expect(uf.count).toBe(2);
  });

  it('returns false when already connected', () => {
    const uf = new UnionFind(3);
    uf.union(0, 1);
    expect(uf.union(1, 0)).toBe(false);
    expect(uf.union(0, 1)).toBe(false);
    expect(uf.count).toBe(2);
  });

  it('find returns the same root for the whole set', () => {
    const uf = new UnionFind(4);
    uf.union(0, 1); uf.union(1, 2); uf.union(2, 3);
    const r = uf.find(0);
    expect([uf.find(1), uf.find(2), uf.find(3)]).toEqual([r, r, r]);
    expect(uf.count).toBe(1);
  });

  it('treats an element as connected to itself', () => {
    expect(new UnionFind(2).connected(1, 1)).toBe(true);
  });
});
```

%% hints
- `while (this.parent[x] !== x) x = this.parent[x]; return x;`
- In `union`, compare roots with `===`; only decrement `count` when you actually link them.

%% solution
```js
export class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.count = n;
  }

  find(x) {
    while (this.parent[x] !== x) x = this.parent[x];
    return x;
  }

  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent[ra] = rb;
    this.count--;
    return true;
  }

  connected(a, b) {
    return this.find(a) === this.find(b);
  }
}
```

%% exercise dst-count-components | Count connected components | 2 | js | js | countComponents | 18
There are `n` nodes numbered `0 … n-1` and a list of undirected `edges` (`[a, b]`). Return the number of **connected components**. Use **union-find with path compression and/or union by size**: the tests chain 100 000 nodes and then connect every node to node `0`, which makes a naive union-find quadratic.

```js
countComponents(5, [[0, 1], [1, 2], [3, 4]]); // 2
```

%% worked
**A similar problem, solved: `groupCount(pairs)`** — how many groups do "friend pairs" form?

```js
function groupCount(n, pairs) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];       // ① path halving: skip a level while climbing
      x = parent[x];
    }
    return x;
  };
  let groups = n;
  for (const [a, b] of pairs) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) { parent[ra] = rb; groups--; }   // ② each successful merge removes one group
  }
  return groups;
}
```

That already is `countComponents`: start with `n` components and subtract one for every edge that joins two *different* components. The compression line is what keeps 100 000 chained nodes fast.

%% explain
- **Start with `n`** components; **each merging edge** reduces it by one.
- **Edges inside a component** change nothing.
- **Isolated nodes** count as components.
- **Compression / union by size** keep it fast.

%% nudge
- When does an edge reduce the number of components?
- What goes wrong without compression on a long chain?

%% starter
```js
export function countComponents(n, edges) {
  // your code
  return n;
}
```

%% tests
```js
describe('countComponents', () => {
  it('counts components', () => {
    expect(countComponents(5, [[0, 1], [1, 2], [3, 4]])).toBe(2);
    expect(countComponents(5, [[0, 1], [1, 2], [2, 3], [3, 4]])).toBe(1);
  });

  it('counts isolated nodes', () => {
    expect(countComponents(4, [])).toBe(4);
    expect(countComponents(0, [])).toBe(0);
    expect(countComponents(3, [[0, 1]])).toBe(2);
  });

  it('ignores redundant edges and self-loops', () => {
    expect(countComponents(3, [[0, 1], [1, 0], [0, 1], [2, 2]])).toBe(2);
    expect(countComponents(3, [[0, 1], [1, 2], [2, 0]])).toBe(1);
  });

  it('is fast on a 100 000-node chain followed by a star', () => {
    const n = 100000;
    const edges = [];
    for (let i = 0; i < n - 1; i++) edges.push([i, i + 1]);
    for (let i = 1; i < n; i++) edges.push([0, i]);
    const t = Date.now();
    expect(countComponents(n, edges)).toBe(1);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- Keep a `parent` array and `groups = n`. For each edge, find both roots; if different, link them and `groups--`.
- Make `find` compress: `parent[x] = parent[parent[x]]` inside the loop.

%% solution
```js
export function countComponents(n, edges) {
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  let groups = n;
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[ra] = rb;
      groups--;
    }
  }
  return groups;
}
```

%% exercise dst-redundant-connection | Redundant connection | 3 | js | js | findRedundantConnection | 22
You are given the edges of a graph that **started as a tree** on nodes `1 … n` and then had **one extra edge** added (so it has exactly one cycle). Return the **extra edge**: the one that, removed, leaves a tree. If several edges could be removed, return the **one that appears last** in the input.

```js
findRedundantConnection([[1, 2], [1, 3], [2, 3]]);                 // [2, 3]
findRedundantConnection([[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]]); // [1, 4]
```

%% worked
**A similar problem, solved: `firstRepeat(values)`** — the first value that has already been seen, using a `Set`.

```js
function firstRepeat(values) {
  const seen = new Set();
  for (const v of values) {
    if (seen.has(v)) return v;     // ① "already there" is the signal
    seen.add(v);
  }
  return null;
}
```

For edges, "already there" means **already connected**. Process the edges **in order**, union-ing their ends. The first edge whose ends already share a root would close a loop — that is the redundant one, and because you process in order it is the **last edge of the cycle** in input order.

%% explain
- **Nodes are `1 … n`**, so size the structure `n + 1` (or subtract one).
- **Union fails** (same root) → return that edge.
- **Order matters**: process edges as given.
- **Exactly one extra edge** exists, so an answer is always found.

%% nudge
- How can union-find tell you "this edge would make a loop"?
- Why does processing in order give the *last* removable edge?

%% starter
```js
export function findRedundantConnection(edges) {
  // your code
  return [];
}
```

%% tests
```js
describe('findRedundantConnection', () => {
  it('finds the edge that closes the cycle', () => {
    expect(findRedundantConnection([[1, 2], [1, 3], [2, 3]])).toEqual([2, 3]);
    expect(findRedundantConnection([[1, 2], [2, 3], [3, 4], [1, 4], [1, 5]])).toEqual([1, 4]);
  });

  it('returns the last edge of the cycle in input order', () => {
    expect(findRedundantConnection([[1, 2], [2, 3], [3, 1], [3, 4]])).toEqual([3, 1]);
    expect(findRedundantConnection([[3, 1], [1, 2], [2, 3]])).toEqual([2, 3]);
  });

  it('handles a two-node duplicate edge', () => {
    expect(findRedundantConnection([[1, 2], [1, 2]])).toEqual([1, 2]);
  });

  it('is fast on 100 000 edges', () => {
    const n = 100000;
    const edges = [];
    for (let i = 1; i < n; i++) edges.push([i, i + 1]);
    edges.push([1, n]);
    const t = Date.now();
    expect(findRedundantConnection(edges)).toEqual([1, n]);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- `parent` of size `edges.length + 1`; reuse the `find` with path halving.
- For each `[a, b]`: if `find(a) === find(b)` return `[a, b]`; otherwise link the roots.

%% solution
```js
export function findRedundantConnection(edges) {
  const parent = Array.from({ length: edges.length + 1 }, (_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const [a, b] of edges) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return [a, b];
    parent[ra] = rb;
  }
  return [];
}
```

%% exercise dst-prefix-counter | A trie with prefix counts | 3 | js | js | PrefixCounter | 26
Build `class PrefixCounter`, a trie where **every node counts how many inserted words pass through it**. Words are lowercase strings.

- `insert(word)` adds one occurrence (inserting the same word twice counts twice).
- `countWord(word)` → how many times exactly `word` was inserted.
- `countPrefix(prefix)` → how many inserted words **start with** `prefix` (including exact matches, counted with multiplicity). The empty prefix counts everything.
- `erase(word)` removes **one occurrence** if there is one and returns `true`; otherwise returns `false` and changes nothing.

All operations are **O(length of the word)**.

%% worked
**A similar problem, solved: `totalLetters(words)`** — a trie that counts how many nodes (distinct prefixes) were created.

```js
function distinctPrefixes(words) {
  const root = {};                                  // ① a node is just an object: letter → child node
  let nodes = 0;
  for (const word of words) {
    let node = root;
    for (const ch of word) {
      if (!node[ch]) { node[ch] = {}; nodes++; }    // ② create the child the first time we need it
      node = node[ch];                              // ③ walk down
    }
  }
  return nodes;
}
```

For `PrefixCounter`, give each node `{ children: new Map(), through: 0, ends: 0 }`. **Insert** increments `through` on every node along the path and `ends` on the last. **`countPrefix`** walks the prefix and returns the last node's `through` (or `0` if the path breaks). **`erase`** first checks `countWord(word) > 0`, then walks again **decrementing** the same counts.

%% explain
- **`through`** counts words passing the node (the root's `through` is the total).
- **`ends`** counts words that stop at the node.
- **`erase`** decrements along the path only when the word exists.
- **Missing path** means a count of `0`.

%% nudge
- Which two numbers does each node need?
- Why check that the word exists *before* erasing?

%% starter
```js
export class PrefixCounter {
  constructor() {
    this.root = { children: new Map(), through: 0, ends: 0 };
  }

  insert(word) {
    // your code
  }

  countWord(word) {
    // your code
  }

  countPrefix(prefix) {
    // your code
  }

  erase(word) {
    // your code
  }
}
```

%% tests
```js
describe('PrefixCounter', () => {
  it('counts words and prefixes', () => {
    const p = new PrefixCounter();
    ['car', 'cat', 'card', 'dog'].forEach((w) => p.insert(w));
    expect(p.countWord('car')).toBe(1);
    expect(p.countPrefix('ca')).toBe(3);
    expect(p.countPrefix('car')).toBe(2);
    expect(p.countPrefix('d')).toBe(1);
    expect(p.countPrefix('x')).toBe(0);
  });

  it('counts duplicates', () => {
    const p = new PrefixCounter();
    p.insert('go'); p.insert('go'); p.insert('goal');
    expect(p.countWord('go')).toBe(2);
    expect(p.countPrefix('go')).toBe(3);
  });

  it('counts everything for the empty prefix', () => {
    const p = new PrefixCounter();
    ['a', 'b', 'a'].forEach((w) => p.insert(w));
    expect(p.countPrefix('')).toBe(3);
    expect(new PrefixCounter().countPrefix('')).toBe(0);
  });

  it('erases one occurrence at a time', () => {
    const p = new PrefixCounter();
    p.insert('cat'); p.insert('cat'); p.insert('car');
    expect(p.erase('cat')).toBe(true);
    expect(p.countWord('cat')).toBe(1);
    expect(p.countPrefix('ca')).toBe(2);
    expect(p.erase('cat')).toBe(true);
    expect(p.countWord('cat')).toBe(0);
    expect(p.countPrefix('ca')).toBe(1);
  });

  it('does not erase what is not there', () => {
    const p = new PrefixCounter();
    p.insert('cart');
    expect(p.erase('car')).toBe(false);
    expect(p.erase('dog')).toBe(false);
    expect(p.countPrefix('ca')).toBe(1);
    expect(p.countWord('cart')).toBe(1);
  });

  it('is fast: 30 000 words', () => {
    const p = new PrefixCounter();
    const t = Date.now();
    for (let i = 0; i < 30000; i++) p.insert('word' + (i % 5000));
    expect(p.countPrefix('word1')).toBeGreaterThan(0);
    expect(p.countPrefix('word')).toBe(30000);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- Insert: `node = root; node.through++; for (const ch of word) { create child if missing; node = child; node.through++ } node.ends++`.
- Write a helper `walk(str)` that returns the node reached, or `null` if the path breaks; `countPrefix` and `countWord` can both use it.
- Erase: `if (!this.countWord(word)) return false;` then walk again decrementing `through` on every node (root included) and `ends` on the last.

%% solution
```js
export class PrefixCounter {
  constructor() {
    this.root = { children: new Map(), through: 0, ends: 0 };
  }

  insert(word) {
    let node = this.root;
    node.through++;
    for (const ch of word) {
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map(), through: 0, ends: 0 };
        node.children.set(ch, next);
      }
      node = next;
      node.through++;
    }
    node.ends++;
  }

  walk(str) {
    let node = this.root;
    for (const ch of str) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }

  countWord(word) {
    const node = this.walk(word);
    return node ? node.ends : 0;
  }

  countPrefix(prefix) {
    const node = this.walk(prefix);
    return node ? node.through : 0;
  }

  erase(word) {
    if (this.countWord(word) === 0) return false;
    let node = this.root;
    node.through--;
    for (const ch of word) {
      node = node.children.get(ch);
      node.through--;
    }
    node.ends--;
    return true;
  }
}
```

%% exercise dst-fenwick | Fenwick tree | 3 | js | js | FenwickTree | 30
Build `class FenwickTree` over `n` positions, **0-indexed** for the caller, all starting at `0`.

- `new FenwickTree(n)`.
- `add(i, delta)` adds `delta` to position `i`.
- `prefix(i)` returns the **sum of positions `0 … i`** (`prefix(-1)` is `0`).
- `range(l, r)` returns the sum of positions `l … r` inclusive.

Both `add` and `prefix` must be **O(log n)**: inside, use a **1-indexed** array and the lowest set bit, `i & -i`. 100 000 operations are tested.

%% worked
**A similar problem, solved: `lowbitSteps(i)`** — how many steps does the "go down" walk take?

```js
function lowbitSteps(i) {
  let steps = 0;
  while (i > 0) {
    steps++;
    i -= i & -i;               // ① drop the lowest set bit: 7 (111) → 6 (110) → 4 (100) → 0
  }
  return steps;
}
```

The query walk is exactly this loop, adding `tree[i]` each step (7 → 6 → 4 → 0 sums `T[7] + T[6] + T[4]`). The update walk goes the other way: `i += i & -i` (3 → 4 → 8), adding `delta` to every `tree[i]` it lands on, while `i <= n`. Convert the caller's 0-indexed `i` to `i + 1` first.

%% explain
- **Internal array is 1-indexed**, length `n + 1`.
- **`add(i, d)`**: `for (let k = i + 1; k <= n; k += k & -k) tree[k] += d`.
- **`prefix(i)`**: `for (let k = i + 1; k > 0; k -= k & -k) sum += tree[k]`.
- **`range(l, r)`** = `prefix(r) - prefix(l - 1)`.

%% nudge
- Which direction does each loop move: up (`+=`) or down (`-=`)?
- How is a range sum built from two prefix sums?

%% starter
```js
export class FenwickTree {
  constructor(n) {
    this.n = n;
    this.tree = new Array(n + 1).fill(0);
  }

  add(i, delta) {
    // your code
  }

  prefix(i) {
    // your code
    return 0;
  }

  range(l, r) {
    // your code
    return 0;
  }
}
```

%% tests
```js
describe('FenwickTree', () => {
  it('starts at zero', () => {
    const f = new FenwickTree(5);
    expect(f.prefix(4)).toBe(0);
    expect(f.range(0, 4)).toBe(0);
  });

  it('adds and sums prefixes', () => {
    const f = new FenwickTree(8);
    [3, 1, 4, 1, 5, 9, 2, 6].forEach((v, i) => f.add(i, v));
    expect(f.prefix(0)).toBe(3);
    expect(f.prefix(3)).toBe(9);
    expect(f.prefix(7)).toBe(31);
    expect(f.prefix(-1)).toBe(0);
  });

  it('computes inclusive range sums', () => {
    const f = new FenwickTree(8);
    [3, 1, 4, 1, 5, 9, 2, 6].forEach((v, i) => f.add(i, v));
    expect(f.range(1, 3)).toBe(6);
    expect(f.range(4, 4)).toBe(5);
    expect(f.range(0, 7)).toBe(31);
  });

  it('handles updates after queries (including negatives)', () => {
    const f = new FenwickTree(6);
    for (let i = 0; i < 6; i++) f.add(i, 10);
    expect(f.range(2, 4)).toBe(30);
    f.add(3, -7);
    expect(f.range(2, 4)).toBe(23);
    expect(f.prefix(5)).toBe(53);
  });

  it('matches a brute-force array on random operations', () => {
    const n = 200;
    const f = new FenwickTree(n);
    const arr = new Array(n).fill(0);
    let seed = 5;
    const rand = (m) => (seed = (seed * 48271) % 2147483647) % m;
    for (let step = 0; step < 2000; step++) {
      if (rand(2)) {
        const i = rand(n), d = rand(100) - 50;
        f.add(i, d); arr[i] += d;
      } else {
        let l = rand(n), r = rand(n);
        if (l > r) [l, r] = [r, l];
        expect(f.range(l, r)).toBe(arr.slice(l, r + 1).reduce((a, b) => a + b, 0));
      }
    }
  });

  it('is fast: 100 000 updates and queries', () => {
    const n = 100000;
    const f = new FenwickTree(n);
    const t = Date.now();
    for (let i = 0; i < n; i++) f.add(i, 1);
    let total = 0;
    for (let i = 0; i < n; i += 1) total += f.prefix(i);
    expect(Date.now() - t).toBeLessThan(800);
    expect(f.range(0, n - 1)).toBe(n);
    expect(total).toBe((n * (n + 1)) / 2);
  });
});
```

%% hints
- `add`: `for (let k = i + 1; k <= this.n; k += k & -k) this.tree[k] += delta;`
- `prefix`: `let sum = 0; for (let k = i + 1; k > 0; k -= k & -k) sum += this.tree[k]; return sum;`
- `range(l, r)`: `this.prefix(r) - this.prefix(l - 1)`.

%% solution
```js
export class FenwickTree {
  constructor(n) {
    this.n = n;
    this.tree = new Array(n + 1).fill(0);
  }

  add(i, delta) {
    for (let k = i + 1; k <= this.n; k += k & -k) this.tree[k] += delta;
  }

  prefix(i) {
    let sum = 0;
    for (let k = i + 1; k > 0; k -= k & -k) sum += this.tree[k];
    return sum;
  }

  range(l, r) {
    return this.prefix(r) - this.prefix(l - 1);
  }
}
```

%% exercise dst-num-matrix | Rectangle sums in O(1) | 2 | js | js | NumMatrix | 22
Build `class NumMatrix(matrix)` for a 2-D array of numbers. `sumRegion(r1, c1, r2, c2)` returns the **sum of the rectangle** with top-left `(r1, c1)` and bottom-right `(r2, c2)`, both inclusive. The constructor may take O(rows × cols); **each query must be O(1)** — 100 000 queries on a 500×500 matrix are tested.

```js
const m = new NumMatrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
m.sumRegion(0, 0, 1, 1); // 12   (1 + 2 + 4 + 5)
```

%% worked
**A similar problem, solved: `prefixRows(matrix)`** — a prefix sum along each row.

```js
function prefixRows(matrix) {
  return matrix.map((row) => {
    const p = [0];
    for (const x of row) p.push(p[p.length - 1] + x);     // ① p[k] = sum of the first k items of this row
    return p;
  });
}
```

For rectangles, let `P[r][c]` be the sum of the rectangle from the **top-left corner `(0, 0)` to just before `(r, c)`**. Build it with `P[r+1][c+1] = M[r][c] + P[r][c+1] + P[r+1][c] - P[r][c]` (add the cell and the two neighbours' rectangles, subtract the overlap counted twice). A query then needs **inclusion–exclusion**: `P[r2+1][c2+1] - P[r1][c2+1] - P[r2+1][c1] + P[r1][c1]` — the big rectangle, minus the strip above, minus the strip to the left, plus the corner that was subtracted twice.

%% explain
- **`P` has `rows + 1` by `cols + 1` entries**, with a zero row and column.
- **Query = 4 lookups**: big − above − left + corner.
- **Inclusive** corners.
- **Constructor** is O(rows × cols).

%% nudge
- Why is the corner added back?
- Why is the table one row and column bigger than the matrix?

%% starter
```js
export class NumMatrix {
  constructor(matrix) {
    // your code
  }

  sumRegion(r1, c1, r2, c2) {
    // your code
    return 0;
  }
}
```

%% tests
```js
describe('NumMatrix', () => {
  const grid = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

  it('sums rectangles', () => {
    const m = new NumMatrix(grid);
    expect(m.sumRegion(0, 0, 1, 1)).toBe(12);
    expect(m.sumRegion(1, 1, 2, 2)).toBe(28);
    expect(m.sumRegion(0, 0, 2, 2)).toBe(45);
  });

  it('handles single cells, rows and columns', () => {
    const m = new NumMatrix(grid);
    expect(m.sumRegion(1, 1, 1, 1)).toBe(5);
    expect(m.sumRegion(2, 0, 2, 2)).toBe(24);
    expect(m.sumRegion(0, 1, 2, 1)).toBe(15);
  });

  it('handles negative numbers', () => {
    const m = new NumMatrix([[-1, 2], [3, -4]]);
    expect(m.sumRegion(0, 0, 1, 1)).toBe(0);
    expect(m.sumRegion(0, 1, 1, 1)).toBe(-2);
  });

  it('handles a one-cell matrix', () => {
    expect(new NumMatrix([[7]]).sumRegion(0, 0, 0, 0)).toBe(7);
  });

  it('does not change the original matrix', () => {
    const g = [[1, 2], [3, 4]];
    new NumMatrix(g);
    expect(g).toEqual([[1, 2], [3, 4]]);
  });

  it('matches brute force and is fast: 100 000 queries on 500 x 500', () => {
    const n = 500;
    const big = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ((r * 31 + c * 17) % 11) - 5));
    const m = new NumMatrix(big);
    let seed = 3;
    const rand = (k) => (seed = (seed * 48271) % 2147483647) % k;
    const t = Date.now();
    let total = 0;
    for (let q = 0; q < 100000; q++) {
      let r1 = rand(n), r2 = rand(n), c1 = rand(n), c2 = rand(n);
      if (r1 > r2) [r1, r2] = [r2, r1];
      if (c1 > c2) [c1, c2] = [c2, c1];
      total += m.sumRegion(r1, c1, r2, c2);
    }
    expect(Date.now() - t).toBeLessThan(900);
    expect(Number.isInteger(total)).toBe(true);
    let brute = 0;
    for (let r = 10; r <= 99; r++) for (let c = 20; c <= 120; c++) brute += big[r][c];
    expect(m.sumRegion(10, 20, 99, 120)).toBe(brute);
  });
});
```

%% hints
- Build `P` as `rows + 1` arrays of `cols + 1` zeros. For each cell: `P[r+1][c+1] = M[r][c] + P[r][c+1] + P[r+1][c] - P[r][c]`.
- `sumRegion`: `P[r2+1][c2+1] - P[r1][c2+1] - P[r2+1][c1] + P[r1][c1]`.

%% solution
```js
export class NumMatrix {
  constructor(matrix) {
    const rows = matrix.length;
    const cols = rows ? matrix[0].length : 0;
    this.p = Array.from({ length: rows + 1 }, () => new Array(cols + 1).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.p[r + 1][c + 1] = matrix[r][c] + this.p[r][c + 1] + this.p[r + 1][c] - this.p[r][c];
      }
    }
  }

  sumRegion(r1, c1, r2, c2) {
    const p = this.p;
    return p[r2 + 1][c2 + 1] - p[r1][c2 + 1] - p[r2 + 1][c1] + p[r1][c1];
  }
}
```
