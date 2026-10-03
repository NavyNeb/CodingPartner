---
id: ds-graphs
track: ds
title: Graphs: BFS, DFS & shortest paths
summary: Things connected to things — maps, networks, dependencies, grids. How to store a graph, explore it breadth-first and depth-first, order tasks with a topological sort, and find cheapest routes with Dijkstra.
---

## The idea in one sentence

A graph is **things (nodes) and the connections between them (edges)** — and a huge number of problems (routes, networks, dependencies, grids, puzzles) turn out to be graph problems wearing a disguise.

> **Analogy** A subway map. Stations are nodes, the lines between them are edges. "How many stops to get there?" is a shortest-path question; "can I get there at all?" is reachability; "which order should I do these chores, given that some must come first?" is a dependency question. A tree is just a graph with no loops — and you have been walking graphs since the linked-list lesson.

## Vocabulary

![An undirected, a directed and a weighted graph](fig:ds-graph-vocab "Same idea, three flavours: do edges go both ways, and do they cost something?")

- **Undirected** edges work both ways (friendship); **directed** edges are one-way (follows, links, prerequisites).
- **Weighted** edges carry a cost (distance, time, price).
- A **path** is a sequence of connected nodes; a **cycle** is a path that returns to its start.
- A **connected component** is a group of nodes that can reach one another.
- A **DAG** is a *directed acyclic graph* — directed with no cycles — the shape of dependency problems.

## Storing a graph

![One graph stored as an adjacency list and as an adjacency matrix](fig:ds-graph-reps "Lists are compact and fast to iterate; matrices answer 'is there an edge?' instantly but cost V².")

In JavaScript the everyday choice is an **adjacency list**: an object or `Map` from each node to the list of its neighbours.

```js try
function buildGraph(edges) {
  const graph = new Map();
  const add = (a, b) => { if (!graph.has(a)) graph.set(a, []); graph.get(a).push(b); };
  for (const [a, b] of edges) { add(a, b); add(b, a); }       // undirected: record both directions
  return graph;
}
const g = buildGraph([['A', 'B'], ['A', 'C'], ['B', 'C'], ['C', 'D']]);
console.log(g.get('C'));                                       // neighbours of C
```

(For a **directed** graph, record only `a → b`.)

## Breadth-first search: ring by ring

BFS explores outwards in **rings**: everything one step away, then everything two steps away… It uses a **queue**, and — crucially — a **visited set**, because graphs (unlike trees) have cycles and you would loop forever.

![BFS from S, in rings of increasing distance](fig:ds-bfs-layers "The first time BFS reaches a node is along a shortest path, in an unweighted graph.")

```stepper BFS: distances from S
code:
  function bfs(graph, start) {
    const dist = new Map([[start, 0]]);        // doubles as the visited set
    const queue = [start];
    for (let i = 0; i < queue.length; i++) {
      const node = queue[i];
      for (const next of graph[node]) {
        if (dist.has(next)) continue;          // already discovered: skip
        dist.set(next, dist.get(node) + 1);
        queue.push(next);
      }
    }
    return dist;
  }
  // graph: S–A, S–B, A–C, B–C, C–D
---
line: 2-3
say: Start at `S`: distance `0`, and it is the only thing in the queue.
dist: S=0
queue: S
---
line: 5-9
say: Visit `S`. Its neighbours `A` and `B` are new, so each gets distance `0 + 1 = 1` and joins the queue.
dist: S=0 | A=1 | B=1
queue: S | A | B
---
line: 5-9
say: Visit `A`. Neighbour `S` is already in `dist` (skipped). `C` is new: distance `1 + 1 = 2`.
dist: S=0 | A=1 | B=1 | C=2
queue: S | A | B | C
---
line: 5-9
say: Visit `B`. Its neighbours `S` and `C` are both already discovered. Nothing to add. (`C` was reached first via `A`, and that was a shortest route.)
---
line: 5-9
say: Visit `C`. `A` and `B` are known; `D` is new: distance `3`.
dist: S=0 | A=1 | B=1 | C=2 | D=3
queue: S | A | B | C | D
---
line: 5-9
say: Visit `D`: only `C`, already known. The queue has run out. Every node and edge was handled once: **O(V + E)**.
Result: S=0, A=1, B=1, C=2, D=3
```

BFS gives **shortest paths in unweighted graphs**, because it reaches every node in order of distance.

## Depth-first search: dive deep

DFS follows one path as far as it goes, then backs up. It is a **stack** (or recursion), and it is the right tool for "is there *any* path?", finding connected components, detecting cycles, and exploring every possibility.

```js try
function dfs(graph, start, visited = new Set()) {
  visited.add(start);
  for (const next of graph[start]) if (!visited.has(next)) dfs(graph, next, visited);
  return visited;
}
const graph = { S: ['A', 'B'], A: ['S', 'C'], B: ['S', 'C'], C: ['A', 'B', 'D'], D: ['C'] };
console.log([...dfs(graph, 'S')]);    // the order of discovery: deep first
```

Both searches do the same work — **O(V + E)** — and differ only in the data structure: **queue → BFS**, **stack → DFS**. Swapping `queue[i]` for `stack.pop()` is the whole change.

## Grids are graphs

![A grid of land and water with five islands](fig:ds-grid-islands "Each cell is a node; its four neighbours are its edges. No adjacency list needed: the neighbours are just r±1, c±1.")

Mazes, flood fill, "number of islands" and "shortest steps in a board game" are all graph searches where the edges are *implicit*: the neighbours of `(r, c)` are `(r±1, c)` and `(r, c±1)`, if they are in bounds. Use an **explicit stack** for big grids — a 400×400 block of land would overflow the call stack with recursion.

```js try
function countIslands(grid) {
  const rows = grid.length, cols = rows ? grid[0].length : 0;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  let islands = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== '1' || seen[r][c]) continue;
      islands++;                                     // a new, unvisited island: flood it
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] === '1' && !seen[ny][nx]) {
            seen[ny][nx] = true;
            stack.push([ny, nx]);
          }
        }
      }
    }
  }
  return islands;
}
console.log(countIslands(['110001', '100111', '001000', '100011']));   // 5, as in the figure
```

## Ordering tasks: topological sort

When edges mean "**must come before**" (course prerequisites, build steps, spreadsheet formulas), you need an order where **every arrow points forward**: a **topological sort**. It exists exactly when the graph has **no cycle**.

![A course dependency graph and a valid order](fig:ds-topo-sort "Kahn's algorithm: keep taking nodes with no unmet prerequisites.")

**Kahn's algorithm:** count each node's **in-degree** (how many prerequisites it still waits on). Put every node with in-degree `0` in a queue. Repeatedly take one, output it, and decrease the in-degree of the nodes that depend on it — any that reach `0` join the queue. If you output fewer nodes than exist, the rest are stuck in a **cycle**.

## Weighted graphs: Dijkstra

When edges have **costs**, BFS counts *edges*, not *cost*, so it can pick the wrong route. **Dijkstra's algorithm** is BFS with a **priority queue**: always expand the **closest unexplored node** next. Once a node is popped with distance `d`, that is its final shortest distance (as long as no weight is negative). With a binary heap it runs in **O((V + E) log V)**.

The heap is why the previous lesson matters: "give me the unexplored node with the smallest distance" is exactly `pop()`.

## Quick check

```check
Q: Why must graph search keep a visited set, when tree traversal doesn't need one?
A) Graphs are bigger
B) Graphs can contain cycles, so you could walk in circles forever *
C) Graphs have no root
D) Sets are faster than arrays
Why: In a tree there is exactly one path to each node. In a graph a cycle lets you come back to where you started.
---
Q: Which data structure turns a graph search from DFS into BFS?
A) A hash map
B) A stack
C) A queue *
D) A heap
Why: A queue visits nodes in order of discovery, so closer nodes come before farther ones. A stack dives deep first.
---
Q: BFS finds the shortest path in terms of what?
A) Total edge weight, always
B) The number of edges, in an unweighted graph *
C) Memory used
D) Alphabetical order
Why: BFS reaches nodes in rings of increasing edge count. With weighted edges you need Dijkstra.
---
Q: A graph has 1 000 nodes and 3 000 edges. Which representation is more compact?
A) An adjacency matrix (1 000 × 1 000 cells)
B) An adjacency list (about V + E entries) *
C) They are identical
D) Neither can store it
Why: The matrix always costs V² (a million cells), but a sparse graph only needs the edges that exist.
---
Q: What does it mean if Kahn's algorithm outputs fewer nodes than the graph has?
A) The graph is disconnected
B) The graph has a cycle, so a valid ordering does not exist *
C) The graph is a tree
D) The queue was too small
Why: Nodes on a cycle each wait for another on the cycle, so their in-degree never reaches 0.
```

## Recap

- A graph is **nodes + edges** (directed/undirected, weighted/unweighted). Store it as an **adjacency list** by default.
- **BFS** (queue) explores in rings and gives **shortest paths in unweighted graphs**; **DFS** (stack/recursion) dives deep. Both are **O(V + E)** and need a **visited set**.
- **Grids** are graphs with implicit edges: use an explicit stack/queue for big ones.
- **Topological sort** (Kahn: in-degree 0 first) orders a DAG and detects cycles.
- **Dijkstra** = BFS with a **min-heap**, for non-negative weights: **O((V + E) log V)**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: build an adjacency list | The `buildGraph` snippet |
| Shortest path (BFS) | The BFS stepper |
| Number of islands | The grid snippet: a visited array and an explicit stack |
| Course order | Kahn's algorithm: in-degrees and a queue |
| Two-colouring | BFS with a colour per node |
| Dijkstra | The `Heap` that is provided, entries like `[distance, node]` |

%% exercise dst-guided-build-graph | Guided: build an adjacency list | 1 | js | js | buildGraph | 8 | guided
Write `buildGraph(edges)`. `edges` is an array of `[a, b]` pairs describing **undirected** edges. Return a `Map` from each node to an **array of its neighbours**, in the order the edges were given. Nodes appear in the map in order of first appearance. Assume there are no duplicate edges.

```js
buildGraph([['A', 'B'], ['A', 'C'], ['B', 'C']]);
// Map { 'A' => ['B', 'C'], 'B' => ['A', 'C'], 'C' => ['A', 'B'] }
```

%% worked
**A similar problem, solved: `degrees(edges)`** — count how many edges touch each node.

```js
function degrees(edges) {
  const deg = new Map();
  const bump = (n) => deg.set(n, (deg.get(n) ?? 0) + 1);   // ① read the old count (default 0), write it back plus one
  for (const [a, b] of edges) { bump(a); bump(b); }        // ② an undirected edge touches both ends
  return deg;
}
```

Same loop, but instead of a counter, each node gets a **list**: create it the first time you see the node, then push the neighbour. Remember **both directions**: `a → b` and `b → a`.

%% explain
- **Undirected**: each edge adds `b` to `a`'s list *and* `a` to `b`'s list.
- **Order**: neighbours in the order of the edges; map keys in order of first appearance.
- **Empty input** returns an empty Map.

%% nudge
- What must you do the first time you see a node?
- How many `push` calls does one edge need?

%% starter
```js
export function buildGraph(edges) {
  const graph = new Map();
  // Step 1 — for each [a, b]: make sure both nodes have a list in the map.
  // Step 2 — push b onto a's list, and a onto b's list.
  return graph;
}
```

%% tests
```js
describe('buildGraph', () => {
  it('builds an undirected adjacency list', () => {
    const g = buildGraph([['A', 'B'], ['A', 'C'], ['B', 'C']]);
    expect([...g]).toEqual([['A', ['B', 'C']], ['B', ['A', 'C']], ['C', ['A', 'B']]]);
  });

  it('returns a Map', () => {
    expect(buildGraph([[1, 2]])).toBeInstanceOf(Map);
  });

  it('lists neighbours in edge order', () => {
    const g = buildGraph([['C', 'D'], ['A', 'C'], ['C', 'B']]);
    expect(g.get('C')).toEqual(['D', 'A', 'B']);
    expect([...g.keys()]).toEqual(['C', 'D', 'A', 'B']);
  });

  it('handles an empty edge list and a single edge', () => {
    expect(buildGraph([]).size).toBe(0);
    expect([...buildGraph([['x', 'y']])]).toEqual([['x', ['y']], ['y', ['x']]]);
  });

  it('works with numeric nodes', () => {
    const g = buildGraph([[1, 2], [2, 3]]);
    expect(g.get(2)).toEqual([1, 3]);
  });
});
```

%% hints
- `if (!graph.has(a)) graph.set(a, []);` (same for `b`), then `graph.get(a).push(b); graph.get(b).push(a);`.

%% solution
```js
export function buildGraph(edges) {
  const graph = new Map();
  for (const [a, b] of edges) {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a).push(b);
    graph.get(b).push(a);
  }
  return graph;
}
```

%% exercise dst-shortest-path | Shortest path with BFS | 2 | js | js | shortestPath | 20
`graph` is an adjacency list as a plain object: `{ node: [neighbours…] }`, with every edge listed in both directions. Return the **number of edges** on a shortest path from `start` to `goal`, or `-1` if there is none. `start === goal` is `0`.

```js
const graph = { S: ['A', 'B'], A: ['S', 'C'], B: ['S', 'C'], C: ['A', 'B', 'D'], D: ['C'] };
shortestPath(graph, 'S', 'D'); // 3
```

It must cope with **cycles** (don't loop forever) and a **100 000-node chain**.

%% worked
**A similar problem, solved: `reachable(graph, start)`** — every node you can reach, without caring about distance.

```js
function reachable(graph, start) {
  const seen = new Set([start]);              // ① remember what we've discovered: this stops cycles
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {    // ② an index instead of shift(): O(1) per step
    for (const next of graph[queue[i]]) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}
```

For `shortestPath`, record **how far** each node is (a `Map` of node → distance doubles as the `seen` set) and stop as soon as you reach `goal`. BFS reaches nodes in order of distance, so that first arrival is a shortest path.

%% explain
- **Edges, not nodes**: a direct neighbour is distance `1`.
- **`-1`** when unreachable.
- **`start === goal`** returns `0`.
- **Visited tracking** prevents infinite loops in cyclic graphs.
- **Linear**: `queue.shift()` on a huge queue would be too slow.

%% nudge
- What stops BFS from going round a cycle forever?
- When do you know the distance to `goal` is final?

%% starter
```js
export function shortestPath(graph, start, goal) {
  // your code
  return -1;
}
```

%% tests
```js
describe('shortestPath', () => {
  const g = { S: ['A', 'B'], A: ['S', 'C'], B: ['S', 'C'], C: ['A', 'B', 'D'], D: ['C'] };

  it('finds the fewest edges', () => {
    expect(shortestPath(g, 'S', 'D')).toBe(3);
    expect(shortestPath(g, 'S', 'C')).toBe(2);
    expect(shortestPath(g, 'A', 'B')).toBe(2);
  });

  it('returns 0 for the same node', () => {
    expect(shortestPath(g, 'C', 'C')).toBe(0);
  });

  it('returns -1 when unreachable', () => {
    const h = { A: ['B'], B: ['A'], C: [] };
    expect(shortestPath(h, 'A', 'C')).toBe(-1);
  });

  it('survives cycles', () => {
    const cyc = { 1: [2, 3], 2: [1, 3], 3: [1, 2, 4], 4: [3] };
    expect(shortestPath(cyc, 1, 4)).toBe(2);
  });

  it('picks the shorter of two routes', () => {
    const h = { A: ['B', 'D'], B: ['A', 'C'], C: ['B', 'E'], D: ['A', 'E'], E: ['C', 'D'] };
    expect(shortestPath(h, 'A', 'E')).toBe(2);
  });

  it('is linear on a 100 000-node chain', () => {
    const n = 100000;
    const chain = {};
    for (let i = 0; i < n; i++) chain[i] = [...(i > 0 ? [i - 1] : []), ...(i < n - 1 ? [i + 1] : [])];
    const t = Date.now();
    expect(shortestPath(chain, 0, n - 1)).toBe(n - 1);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- `const dist = new Map([[start, 0]]); const queue = [start];` and loop with an index.
- For each unvisited neighbour: `dist.set(next, dist.get(node) + 1)`, push it, and `if (next === goal) return dist.get(next)`.

%% solution
```js
export function shortestPath(graph, start, goal) {
  if (start === goal) return 0;
  const dist = new Map([[start, 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const node = queue[i];
    for (const next of graph[node] ?? []) {
      if (dist.has(next)) continue;
      dist.set(next, dist.get(node) + 1);
      if (next === goal) return dist.get(next);
      queue.push(next);
    }
  }
  return -1;
}
```

%% exercise dst-num-islands | Number of islands | 3 | js | js | numIslands | 24
`grid` is an array of equal-length strings of `'1'` (land) and `'0'` (water). An **island** is a group of land cells connected **up, down, left or right** (not diagonally). Return how many islands there are.

```js
numIslands(['11000', '11000', '00100', '00011']); // 3
```

Use an **explicit stack or queue**, not recursion: the tests include a 400×400 block of land.

%% worked
**A similar problem, solved: `landCells(grid)`** — count land cells, visiting every cell once.

```js
function landCells(grid) {
  let count = 0;
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c] === '1') count++;           // ① a plain double loop: no connectivity yet
  return count;
}
```

For islands, the **outer double loop stays**: whenever you meet land you haven't seen yet, you've found a **new island** — count it, then **flood-fill** the whole island (push the cell, repeatedly pop one and push its unvisited land neighbours, marking each as seen as you push it) so none of its cells start another count.

%% explain
- **4-directional** connectivity.
- **Count flood fills**, not land cells.
- **Mark cells as seen** when you push them (not when you pop them) to avoid duplicates on the stack.
- **Empty grid** or all water returns `0`.

%% nudge
- How do you avoid counting the same island twice?
- Why mark a cell as seen when pushing it?

%% starter
```js
export function numIslands(grid) {
  // your code
  return 0;
}
```

%% tests
```js
describe('numIslands', () => {
  it('counts islands', () => {
    expect(numIslands(['11000', '11000', '00100', '00011'])).toBe(3);
    expect(numIslands(['110001', '100111', '001000', '100011'])).toBe(5);
  });

  it('does not connect diagonals', () => {
    expect(numIslands(['10', '01'])).toBe(2);
  });

  it('handles empty and all-water grids', () => {
    expect(numIslands([])).toBe(0);
    expect(numIslands(['000', '000'])).toBe(0);
  });

  it('handles one big island and single cells', () => {
    expect(numIslands(['111', '111'])).toBe(1);
    expect(numIslands(['1'])).toBe(1);
  });

  it('handles winding islands', () => {
    expect(numIslands(['11111', '00001', '11101', '10001', '11111'])).toBe(1);
  });

  it('survives a 400 x 400 block of land (no recursion)', () => {
    const row = '1'.repeat(400);
    const grid = Array.from({ length: 400 }, () => row);
    const t = Date.now();
    expect(numIslands(grid)).toBe(1);
    expect(Date.now() - t).toBeLessThan(1000);
    const checker = Array.from({ length: 300 }, (_, r) => Array.from({ length: 300 }, (_, c) => ((r + c) % 2 ? '1' : '0')).join(''));
    expect(numIslands(checker)).toBe(45000);
  });
});
```

%% hints
- `seen` as a 2-D array of booleans (or a `Set` of `r * cols + c`).
- Outer loops over every cell; for an unseen `'1'`: `count++`, then pop/push on a stack with the four direction offsets and a bounds check.

%% solution
```js
export function numIslands(grid) {
  const rows = grid.length;
  if (rows === 0) return 0;
  const cols = grid[0].length;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let islands = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== '1' || seen[r][c]) continue;
      islands++;
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [y, x] = stack.pop();
        for (const [dy, dx] of dirs) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && grid[ny][nx] === '1' && !seen[ny][nx]) {
            seen[ny][nx] = true;
            stack.push([ny, nx]);
          }
        }
      }
    }
  }
  return islands;
}
```

%% exercise dst-bipartite | Can it be two-coloured? | 3 | js | js | isBipartite | 22
A graph is **bipartite** if you can colour every node one of two colours so that **no edge joins two nodes of the same colour**. `graph` is an array of neighbour arrays (node `i`'s neighbours are `graph[i]`, edges listed both ways). The graph may be **disconnected**. Return `true` or `false`.

```js
isBipartite([[1, 3], [0, 2], [1, 3], [0, 2]]); // true   (a square: alternate colours)
isBipartite([[1, 2], [0, 2], [0, 1]]);          // false  (a triangle: 3 nodes, all adjacent)
```

%% worked
**A similar problem, solved: `countComponents(graph)`** — how many separate groups does the graph have?

```js
function countComponents(graph) {
  const seen = new Array(graph.length).fill(false);
  let groups = 0;
  for (let start = 0; start < graph.length; start++) {
    if (seen[start]) continue;                 // ① already part of a group we explored
    groups++;                                  // ② new group: explore all of it
    const stack = [start];
    seen[start] = true;
    while (stack.length) {
      for (const next of graph[stack.pop()]) if (!seen[next]) { seen[next] = true; stack.push(next); }
    }
  }
  return groups;
}
```

Two-colouring uses the same skeleton, but "seen" becomes a **colour** (`0` or `1`, with `-1` for uncoloured). When you walk from `node` to `next`: if `next` is uncoloured, give it the **opposite** colour; if it already has the **same** colour as `node`, the graph is not bipartite. Start a fresh search from every uncoloured node so disconnected parts are covered.

%% explain
- **Two colours** (0 and 1); neighbours must differ.
- **Every component** needs its own start, since the graph may be disconnected.
- **A conflict**: `next` already has `node`'s colour → `false`.
- **Odd cycles** make it impossible; trees and even cycles are fine.

%% nudge
- What does "already visited" look like when you track colours instead of a boolean?
- Why do you need to start a search from *every* uncoloured node?

%% starter
```js
export function isBipartite(graph) {
  // your code
  return false;
}
```

%% tests
```js
describe('isBipartite', () => {
  it('accepts a square and a path', () => {
    expect(isBipartite([[1, 3], [0, 2], [1, 3], [0, 2]])).toBe(true);
    expect(isBipartite([[1], [0, 2], [1]])).toBe(true);
  });

  it('rejects a triangle (odd cycle)', () => {
    expect(isBipartite([[1, 2], [0, 2], [0, 1]])).toBe(false);
    expect(isBipartite([[1, 2, 3], [0, 2], [0, 1, 3], [0, 2]])).toBe(false);
  });

  it('handles disconnected graphs', () => {
    expect(isBipartite([[1], [0], [3, 4], [2, 4], [2, 3]])).toBe(false);
    expect(isBipartite([[1], [0], [3], [2]])).toBe(true);
  });

  it('handles empty graphs and isolated nodes', () => {
    expect(isBipartite([])).toBe(true);
    expect(isBipartite([[], [], []])).toBe(true);
  });

  it('handles a star', () => {
    expect(isBipartite([[1, 2, 3, 4], [0], [0], [0], [0]])).toBe(true);
  });

  it('is linear on a 100 000-node cycle', () => {
    const even = Array.from({ length: 100000 }, (_, i) => [(i + 1) % 100000, (i + 99999) % 100000]);
    const odd = Array.from({ length: 99999 }, (_, i) => [(i + 1) % 99999, (i + 99998) % 99999]);
    const t = Date.now();
    expect(isBipartite(even)).toBe(true);
    expect(isBipartite(odd)).toBe(false);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- `color = new Array(graph.length).fill(-1)`. For each uncoloured `start`, set `color[start] = 0` and search (stack or queue).
- For an edge `node → next`: if `color[next] === -1` set it to `1 - color[node]` and push it; else if `color[next] === color[node]` return `false`.

%% solution
```js
export function isBipartite(graph) {
  const color = new Array(graph.length).fill(-1);
  for (let start = 0; start < graph.length; start++) {
    if (color[start] !== -1) continue;
    color[start] = 0;
    const stack = [start];
    while (stack.length) {
      const node = stack.pop();
      for (const next of graph[node]) {
        if (color[next] === -1) {
          color[next] = 1 - color[node];
          stack.push(next);
        } else if (color[next] === color[node]) {
          return false;
        }
      }
    }
  }
  return true;
}
```

%% exercise dst-course-order | Course order (topological sort) | 3 | js | js | courseOrder | 26
There are `n` courses numbered `0 … n-1`. `prerequisites` is an array of `[course, prereq]` pairs meaning you must take `prereq` **before** `course`. Return an array containing **every course in a valid order**, or `[]` if it's impossible (there is a cycle). Any valid order is accepted.

```js
courseOrder(4, [[1, 0], [2, 0], [3, 1], [3, 2]]); // e.g. [0, 1, 2, 3] or [0, 2, 1, 3]
courseOrder(2, [[0, 1], [1, 0]]);                  // []
```

Use **Kahn's algorithm** (in-degrees and a queue). It must be linear: 100 000 courses are tested.

%% worked
**A similar problem, solved: `inDegrees(n, edges)`** — how many incoming edges does each node have?

```js
function inDegrees(n, edges) {
  const degree = new Array(n).fill(0);
  for (const [from, to] of edges) degree[to]++;     // ① every edge adds one incoming edge to its target
  return degree;
}
```

Kahn's algorithm: **in-degree 0** means "no unmet prerequisites". Queue all such courses. Repeatedly **take one**, add it to the order, and for each course that depends on it **decrease its in-degree** — when that reaches `0`, queue it. Build the adjacency list `prereq → [courses that need it]` first. If the order ends up shorter than `n`, the leftovers are in a cycle.

%% explain
- **`[course, prereq]`**: an edge `prereq → course`.
- **In-degree** = number of unmet prerequisites.
- **Valid order**: every `prereq` appears before its `course`.
- **`[]` on a cycle**; with `n = 0` the answer is `[]` too (nothing to do).
- **Linear**: O(V + E), with an index-based queue.

%% nudge
- Which courses can you take immediately?
- What changes when you take a course?

%% starter
```js
export function courseOrder(n, prerequisites) {
  // your code
  return [];
}
```

%% tests
```js
const valid = (n, pre, order) => {
  if (order.length !== n || new Set(order).size !== n) return false;
  const pos = new Map(order.map((c, i) => [c, i]));
  return pre.every(([course, prereq]) => pos.get(prereq) < pos.get(course));
};

describe('courseOrder', () => {
  it('orders courses with prerequisites', () => {
    const pre = [[1, 0], [2, 0], [3, 1], [3, 2]];
    expect(valid(4, pre, courseOrder(4, pre))).toBe(true);
  });

  it('handles no prerequisites', () => {
    const order = courseOrder(3, []);
    expect([...order].sort()).toEqual([0, 1, 2]);
  });

  it('returns [] when there is a cycle', () => {
    expect(courseOrder(2, [[0, 1], [1, 0]])).toEqual([]);
    expect(courseOrder(4, [[1, 0], [2, 1], [3, 2], [1, 3]])).toEqual([]);
  });

  it('handles a cycle hiding behind valid courses', () => {
    expect(courseOrder(5, [[1, 0], [2, 1], [3, 2], [2, 3], [4, 0]])).toEqual([]);
  });

  it('handles empty input', () => {
    expect(courseOrder(0, [])).toEqual([]);
    expect(courseOrder(1, [])).toEqual([0]);
  });

  it('handles a diamond and a long chain', () => {
    const pre = [[1, 0], [2, 0], [3, 1], [3, 2], [4, 3]];
    expect(valid(5, pre, courseOrder(5, pre))).toBe(true);
    const n = 100000;
    const chain = Array.from({ length: n - 1 }, (_, i) => [i + 1, i]);
    const t = Date.now();
    const order = courseOrder(n, chain);
    expect(Date.now() - t).toBeLessThan(800);
    expect(order[0]).toBe(0);
    expect(order[n - 1]).toBe(n - 1);
  });
});
```

%% hints
- Build `next[prereq] = [courses…]` and `indegree[course]++` for each pair.
- `queue` = all courses with `indegree 0`; loop with an index: push to `order`, then for each dependant decrement and queue it at `0`.
- `return order.length === n ? order : []`.

%% solution
```js
export function courseOrder(n, prerequisites) {
  const next = Array.from({ length: n }, () => []);
  const indegree = new Array(n).fill(0);
  for (const [course, prereq] of prerequisites) {
    next[prereq].push(course);
    indegree[course]++;
  }
  const queue = [];
  for (let c = 0; c < n; c++) if (indegree[c] === 0) queue.push(c);
  for (let i = 0; i < queue.length; i++) {
    for (const c of next[queue[i]]) {
      if (--indegree[c] === 0) queue.push(c);
    }
  }
  return queue.length === n ? queue : [];
}
```

%% exercise dst-dijkstra | Dijkstra: cheapest routes | 4 | js | js | dijkstra | 35
`graph` is a **weighted adjacency list**: `{ node: [[neighbour, weight], …] }`, where every node appears as a key (possibly with an empty list) and weights are **non-negative**. Return an object mapping **every node** to its **shortest distance from `source`** (`Infinity` if unreachable).

```js
const graph = { A: [['B', 1], ['C', 4]], B: [['C', 2], ['D', 6]], C: [['D', 3]], D: [] };
dijkstra(graph, 'A'); // { A: 0, B: 1, C: 3, D: 6 }
```

A min-heap (`Heap` with a comparator) is **provided**. A 150×150 grid (22 500 nodes) is tested, so scanning for the closest node each step is too slow.

%% worked
**A similar problem, solved: `cheapestNext(frontier)`** — the "give me the closest unexplored node" step, done the slow way.

```js
function cheapestNext(frontier) {              // frontier: array of [distance, node]
  let best = 0;
  for (let i = 1; i < frontier.length; i++) {
    if (frontier[i][0] < frontier[best][0]) best = i;   // ① scan everything: O(n) per step
  }
  return frontier.splice(best, 1)[0];
}
```

That scan makes Dijkstra O(V²). A **min-heap** returns the closest entry in O(log n). Push `[distance, node]`; **pop the smallest**; if its distance is larger than the best known for that node (a **stale entry** — you pushed a better one later), skip it; otherwise **relax** each edge: if `dist[node] + weight` beats `dist[next]`, record it and push `[newDist, next]`.

%% explain
- **Distances** start at `Infinity`, with `0` for the source.
- **Relaxing** an edge updates `dist[next]` only when the new route is shorter.
- **Stale entries** (popped with a distance worse than the known one) are skipped.
- **Non-negative weights** make the first pop of a node final.

%% nudge
- What do you store in the heap, and what is the comparator?
- How can the same node be in the heap twice, and what do you do when you pop the worse entry?

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

export function dijkstra(graph, source) {
  const dist = {};
  for (const node of Object.keys(graph)) dist[node] = Infinity;
  // your code
  return dist;
}
```

%% tests
```js
describe('dijkstra', () => {
  it('finds cheapest routes', () => {
    const graph = { A: [['B', 1], ['C', 4]], B: [['C', 2], ['D', 6]], C: [['D', 3]], D: [] };
    expect(dijkstra(graph, 'A')).toEqual({ A: 0, B: 1, C: 3, D: 6 });
  });

  it('prefers a cheap long route over an expensive short one', () => {
    const graph = { S: [['T', 10], ['A', 1]], A: [['B', 1]], B: [['T', 1]], T: [] };
    expect(dijkstra(graph, 'S').T).toBe(3);
  });

  it('reports Infinity for unreachable nodes', () => {
    const graph = { A: [['B', 1]], B: [], C: [['A', 1]] };
    const d = dijkstra(graph, 'A');
    expect(d.A).toBe(0);
    expect(d.B).toBe(1);
    expect(d.C).toBe(Infinity);
  });

  it('handles zero-weight edges and cycles', () => {
    const graph = { A: [['B', 0], ['C', 5]], B: [['A', 0], ['C', 1]], C: [['A', 5]] };
    expect(dijkstra(graph, 'A')).toEqual({ A: 0, B: 0, C: 1 });
  });

  it('handles a single node', () => {
    expect(dijkstra({ X: [] }, 'X')).toEqual({ X: 0 });
  });

  it('is fast on a 150 x 150 grid', () => {
    const n = 150;
    const graph = {};
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const edges = [];
        if (r > 0) edges.push([(r - 1) * n + c, 1]);
        if (r < n - 1) edges.push([(r + 1) * n + c, 1]);
        if (c > 0) edges.push([r * n + c - 1, 1]);
        if (c < n - 1) edges.push([r * n + c + 1, 1]);
        graph[r * n + c] = edges;
      }
    }
    const t = Date.now();
    const d = dijkstra(graph, 0);
    expect(Date.now() - t).toBeLessThan(1500);
    expect(d[n * n - 1]).toBe(2 * (n - 1));
    expect(d[5 * n + 7]).toBe(12);
  });
});
```

%% hints
- `dist[source] = 0; const heap = new Heap((x, y) => x[0] - y[0]); heap.push([0, source]);`
- Loop: `const [d, node] = heap.pop(); if (d > dist[node]) continue;` then for each `[next, w]`: `const nd = d + w; if (nd < dist[next]) { dist[next] = nd; heap.push([nd, next]); }`.

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

export function dijkstra(graph, source) {
  const dist = {};
  for (const node of Object.keys(graph)) dist[node] = Infinity;
  dist[source] = 0;
  const heap = new Heap((x, y) => x[0] - y[0]);
  heap.push([0, source]);
  while (heap.size) {
    const [d, node] = heap.pop();
    if (d > dist[node]) continue;
    for (const [next, w] of graph[node] ?? []) {
      const nd = d + w;
      if (nd < dist[next]) {
        dist[next] = nd;
        heap.push([nd, next]);
      }
    }
  }
  return dist;
}
```
