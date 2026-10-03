---
id: algo-dp-tables
track: algo
title: Dynamic programming II: grids, strings & knapsack
summary: Tables with two indexes: counting grid paths, comparing strings (longest common subsequence, edit distance), choosing items under a limit (0/1 knapsack and subset sum), and palindromes by expanding from the centre.
---

## The idea in one sentence

When the state needs **two numbers** — a row and a column, a position in each of two strings, or "items so far" and "capacity used" — the DP **table has two dimensions**, and every cell is computed from a few neighbours that are already filled in.

> **Analogy** Comparing two long documents sentence by sentence. You keep a grid: rows for how far you've read in document A, columns for document B. Each square answers "how well do the first *i* sentences of A match the first *j* sentences of B?" — and you fill it by looking at the squares just above and to the left.

The recipe is unchanged: **state** (what does `dp[i][j]` mean?), **recurrence**, **base cases** (the first row and column), **order** (usually row by row), **answer** (often the bottom-right cell).

## Grids: counting paths

Moving only **right or down** from the top-left to the bottom-right corner, how many different paths exist? Every cell can be reached from **above** or from the **left**, so its count is the sum of those two cells.

![Number of paths to each cell of a 4 by 5 grid](fig:alg-dp-grid-paths "dp[r][c] = dp[r−1][c] + dp[r][c−1]; the first row and column are all 1.")

```js try
function uniquePaths(rows, cols) {
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(1));   // first row and column: exactly 1 way
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
  }
  return dp[rows - 1][cols - 1];
}
console.log(uniquePaths(3, 7), uniquePaths(4, 5));
```

Swap "sum" for "min" and add the cell's own cost and you get the **minimum path sum**. Since each row only needs the row above it, memory can drop from O(rows × cols) to O(cols).

## Two strings: longest common subsequence

A **subsequence** keeps order but may skip letters (`ace` is in `abcde`). `dp[i][j]` = length of the **longest common subsequence of the first `i` letters of `a` and the first `j` letters of `b`**. Look at the last letters:

- **Equal:** they extend the best of the shorter prefixes: `dp[i][j] = dp[i−1][j−1] + 1`.
- **Different:** one of them isn't used: `dp[i][j] = max(dp[i−1][j], dp[i][j−1])`.

![The LCS table for abcde and ace](fig:alg-dp-lcs-table "Matches (green) add 1 to the diagonal; other cells take the better of above and left.")

```stepper LCS of "abcde" and "ace"
code:
  function lcs(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }
  lcs('abcde', 'ace');
---
line: 2
say: The table has one extra row and column for the **empty prefix**, all zeros: comparing against nothing shares nothing.
cell: -
row for a: 0 | 0 | 0 | 0
---
line: 4-5
say: `i = 1` (`'a'`), `j = 1` (`'a'`): the letters **match**, so `dp[1][1] = dp[0][0] + 1 = 1`.
cell: dp[1][1]
row for a: 0 | 1 | 1 | 1
---
line: 4-6
say: Still on `'a'`: against `'c'` and `'e'` there is no match, so each cell takes the better of *above* and *left*: both give `1`. Row `'b'` has no matches either, so it copies row `'a'`.
cell: dp[1][2]
row for b: 0 | 1 | 1 | 1
---
line: 4-5
say: `i = 3` (`'c'`), `j = 2` (`'c'`): a match! `dp[3][2] = dp[2][1] + 1 = 2` (the common subsequence `a`,`c`).
cell: dp[3][2]
row for c: 0 | 1 | 2 | 2
---
line: 4-5
say: Row `'d'` has no matches (copies row `'c'`). Row `'e'`, column `'e'`: a match: `dp[5][3] = dp[4][2] + 1 = 3`.
cell: dp[5][3]
row for e: 0 | 1 | 2 | 3
---
line: 8
say: The bottom-right cell is the answer: **3** (`"ace"`). The table has `a.length × b.length` cells and each costs O(1): **O(n·m)**.
Result: 3
```

## Edit distance

*How many single-letter edits (insert, delete, replace) turn `a` into `b`?* Same table, with three neighbours:

![An edit-distance cell reads its diagonal, upper and left neighbours](fig:alg-dp-edit-cell "If the letters are equal the diagonal is free; otherwise 1 + the cheapest of replace, delete, insert.")

```js try
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);   // first column: i deletions
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;                                                 // first row: j insertions
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
console.log(editDistance('kitten', 'sitting'));   // 3
```

## Choosing items under a limit: 0/1 knapsack

Each item can be taken **once or not at all** and has a cost; you have a limited budget. State: `dp[w]` = best value using capacity `w` (for the items considered so far). Adding an item with weight `wt` and value `val`:

`dp[w] = max(dp[w], dp[w − wt] + val)`

The crucial detail: loop capacity **from high to low**, so the item can't be counted twice in the same pass (looping upwards would let `dp[w − wt]` already include this item — that's the *unbounded* knapsack, like coin change).

```js try
function knapsack(weights, values, capacity) {
  const dp = new Array(capacity + 1).fill(0);               // dp[w] = best value with room w
  weights.forEach((wt, i) => {
    for (let w = capacity; w >= wt; w--) {                  // HIGH to LOW: each item used at most once
      dp[w] = Math.max(dp[w], dp[w - wt] + values[i]);
    }
  });
  return dp[capacity];
}
console.log(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7));       // 9 (the items of weight 3 and 4)
```

A famous special case is **subset sum**: can some subset add up to a target (and so, "can the items be split into two equal halves?")? Track which sums are **reachable**; an item `x` makes `s` reachable if `s − x` already was.

![Reachable sums after each item for 1, 5, 11, 5](fig:alg-dp-subset-sum "Each item adds a copy of the reachable set shifted by its size. 11 is reachable → the items split evenly.")

## Palindromes: expand from the centre

For the **longest palindromic substring**, a DP table works, but a simpler O(n²) idea needs no memory: **every palindrome has a centre** (a letter, or the gap between two letters). From each centre, expand outwards while the two ends match:

```js try
function longestPalindrome(s) {
  let start = 0, bestLen = 0;
  const expand = (l, r) => {
    while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; }
    if (r - l - 1 > bestLen) { bestLen = r - l - 1; start = l + 1; }
  };
  for (let i = 0; i < s.length; i++) { expand(i, i); expand(i, i + 1); }   // odd-length and even-length centres
  return s.slice(start, start + bestLen);
}
console.log(longestPalindrome('babad'), longestPalindrome('cbbd'));
```

## Choosing a DP shape

| Problem looks like… | State |
| --- | --- |
| One sequence, decisions left to right | `dp[i]` = best using the first `i` items |
| A grid | `dp[r][c]` |
| Two sequences / strings | `dp[i][j]` over prefixes |
| Items and a budget | `dp[w]` over capacity (loop direction matters!) |
| "Best run ending here" | `dp[i]` = best ending at `i` |

## Quick check

```check
Q: In the LCS table, what do you do when `a[i-1] === b[j-1]`?
A) Take the max of above and left
B) Take the diagonal value plus 1 *
C) Set the cell to 0
D) Copy the cell above
Why: The matching letters extend the best common subsequence of the two shorter prefixes.
---
Q: What does `dp[i][j]` mean for edit distance?
A) The number of equal letters
B) The fewest edits turning the first i letters of a into the first j letters of b *
C) The longest common prefix
D) The number of deletions needed
Why: A precise definition makes the three-neighbour recurrence obvious.
---
Q: Why does the 0/1 knapsack loop capacity from high to low?
A) It is faster
B) So an item can't be added twice in the same pass (dp[w − wt] hasn't yet been updated with it) *
C) Low values overflow
D) It sorts the items
Why: Going upwards would reuse the freshly updated entry, turning it into the unbounded version.
---
Q: How can the row-by-row grid DP use less memory?
A) It can't
B) Each row only needs the previous row, so keep two rows (or one) *
C) Store only the diagonal
D) Use recursion instead
Why: Once a row is no longer read it can be discarded or overwritten.
---
Q: How many centres must you try when expanding around the middle for palindromes?
A) n (each letter)
B) 2n − 1: each letter and each gap between letters *
C) n²
D) Only the first half
Why: Odd-length palindromes centre on a letter, even-length ones on a gap.
```

## Recap

- Two-dimensional DP: define `dp[i][j]` precisely; fill row by row from the base row and column.
- **Grid paths**: sum of above and left; **min path** swaps in `min` plus the cell cost.
- **LCS** and **edit distance** compare string prefixes; the last letters decide the recurrence. **O(n·m)**.
- **0/1 knapsack** and **subset sum**: `dp[w]` over capacity, looping **high to low**.
- **Longest palindromic substring**: expand around the `2n − 1` centres, O(n²), no table.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: unique paths | The grid-paths table |
| Minimum path sum | `min(above, left) + cost` |
| Longest common subsequence | The LCS stepper |
| Edit distance | The three-neighbour figure and base row/column |
| 0/1 knapsack | A one-dimensional table updated from high to low |
| Equal subset sum | Subset sum: `reachable[s] \|= reachable[s − x]` |
| Longest palindromic substring | Expand around each centre |

%% exercise alg-guided-unique-paths | Guided: unique paths | 1 | js | js | uniquePaths | 8 | guided
A robot starts at the top-left of an `m × n` grid (`m` rows, `n` columns) and can only move **right or down**. Return the **number of distinct paths** to the bottom-right corner. (Tests keep the grid small enough that the answer fits exactly in a JavaScript number.)

```js
uniquePaths(3, 7); // 28
uniquePaths(3, 2); // 3
```

%% worked
**A similar problem, solved: `countPathsWithWalls(grid)`** — the same table, but cells marked `1` are walls.

```js
function countPathsWithWalls(grid) {
  const rows = grid.length, cols = grid[0].length;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
  dp[0][0] = grid[0][0] === 1 ? 0 : 1;                           // ① the start (blocked → no paths)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 1) { dp[r][c] = 0; continue; }          // ② a wall: nothing reaches it
      if (r > 0) dp[r][c] += dp[r - 1][c];                       // ③ paths arriving from above
      if (c > 0) dp[r][c] += dp[r][c - 1];                       // ④ paths arriving from the left
    }
  }
  return dp[rows - 1][cols - 1];
}
```

Without walls: every cell in the first row or column has exactly **one** path (all the way along the edge); every other cell is `above + left`.

%% explain
- **`dp[r][c]`** = number of paths to that cell.
- **First row and column** are `1`.
- **Others**: `dp[r−1][c] + dp[r][c−1]`.
- **Answer**: the bottom-right cell.

%% nudge
- How can a path arrive at an interior cell?
- What is the count for any cell on the top row?

%% starter
```js
export function uniquePaths(m, n) {
  // Step 1 — make an m × n table filled with 1s.
  // Step 2 — for r from 1 and c from 1: dp[r][c] = dp[r-1][c] + dp[r][c-1].
  // Step 3 — return the bottom-right cell.
  return 0;
}
```

%% tests
```js
describe('uniquePaths', () => {
  it('counts paths', () => {
    expect(uniquePaths(3, 7)).toBe(28);
    expect(uniquePaths(3, 2)).toBe(3);
    expect(uniquePaths(7, 3)).toBe(28);
    expect(uniquePaths(10, 10)).toBe(48620);
  });

  it('handles single rows and columns', () => {
    expect(uniquePaths(1, 1)).toBe(1);
    expect(uniquePaths(1, 9)).toBe(1);
    expect(uniquePaths(9, 1)).toBe(1);
  });

  it('handles a bigger grid', () => {
    expect(uniquePaths(23, 12)).toBe(193536720);
  });
});
```

%% hints
- `const dp = Array.from({ length: m }, () => new Array(n).fill(1));`
- Nested loops from 1; `dp[r][c] = dp[r - 1][c] + dp[r][c - 1]`.

%% solution
```js
export function uniquePaths(m, n) {
  const dp = Array.from({ length: m }, () => new Array(n).fill(1));
  for (let r = 1; r < m; r++) {
    for (let c = 1; c < n; c++) dp[r][c] = dp[r - 1][c] + dp[r][c - 1];
  }
  return dp[m - 1][n - 1];
}
```

%% exercise alg-min-path-sum | Minimum path sum | 2 | js | js | minPathSum | 16
`grid` is a non-empty rectangle of non-negative numbers. Moving only **right or down** from the top-left to the bottom-right cell, return the **smallest total** of the cells on a path (including both ends). It must handle a 500 × 500 grid quickly.

```js
minPathSum([[1, 3, 1], [1, 5, 1], [4, 2, 1]]); // 7   (1 → 3 → 1 → 1 → 1)
```

%% worked
**A similar problem, solved: `maxRowSum(grid)`** — rows reduced to one number each, the first step of many grid problems.

```js
function maxRowSum(grid) {
  let best = -Infinity;
  for (const row of grid) {
    let sum = 0;
    for (const x of row) sum += x;               // ① accumulate along the row
    if (sum > best) best = sum;
  }
  return best;
}
```

For the path problem, each cell stores the **cheapest cost to reach it**: its own value plus the **smaller** of the cost from above and the cost from the left. On the top row only "from the left" exists; in the first column only "from above".

%% explain
- **`dp[r][c]`** = cheapest path cost to `(r, c)`.
- **Recurrence**: `grid[r][c] + min(dp[r−1][c], dp[r][c−1])`.
- **Edges** have just one source.
- **One row of memory** is enough, but a full table is fine.

%% nudge
- How do you handle the first row and the first column?
- Which two neighbours does an interior cell look at?

%% starter
```js
export function minPathSum(grid) {
  // your code
  return 0;
}
```

%% tests
```js
describe('minPathSum', () => {
  it('finds the cheapest path', () => {
    expect(minPathSum([[1, 3, 1], [1, 5, 1], [4, 2, 1]])).toBe(7);
    expect(minPathSum([[1, 2, 3], [4, 5, 6]])).toBe(12);
  });

  it('handles one row, one column and one cell', () => {
    expect(minPathSum([[1, 2, 3]])).toBe(6);
    expect(minPathSum([[1], [2], [3]])).toBe(6);
    expect(minPathSum([[5]])).toBe(5);
  });

  it('handles zeros', () => {
    expect(minPathSum([[0, 0], [0, 0]])).toBe(0);
  });

  it('does not modify the grid', () => {
    const g = [[1, 2], [3, 4]];
    minPathSum(g);
    expect(g).toEqual([[1, 2], [3, 4]]);
  });

  it('is fast on 500 x 500', () => {
    const n = 500;
    const grid = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => ((r * 31 + c * 17) % 9) + 1));
    const t = Date.now();
    const r = minPathSum(grid);
    expect(Date.now() - t).toBeLessThan(600);
    expect(r).toBeGreaterThan(n);
  });
});
```

%% hints
- Copy a table of the same shape; `dp[0][0] = grid[0][0]`; fill the first row and column by adding along the edge.
- Interior: `dp[r][c] = grid[r][c] + Math.min(dp[r - 1][c], dp[r][c - 1])`.

%% solution
```js
export function minPathSum(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) dp[r][c] = grid[r][c];
      else if (r === 0) dp[r][c] = dp[r][c - 1] + grid[r][c];
      else if (c === 0) dp[r][c] = dp[r - 1][c] + grid[r][c];
      else dp[r][c] = grid[r][c] + Math.min(dp[r - 1][c], dp[r][c - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}
```

%% exercise alg-lcs | Longest common subsequence | 3 | js | js | longestCommonSubsequence | 26
Return the **length of the longest common subsequence** of two strings (letters in the same order in both, not necessarily adjacent). It must be **O(n·m)**: two 2 000-letter strings are tested.

```js
longestCommonSubsequence('abcde', 'ace'); // 3  ("ace")
longestCommonSubsequence('abc', 'def');   // 0
```

%% worked
**A similar problem, solved: `isSubsequence(small, big)`** — is `small` a subsequence of `big`? (One pointer suffices.)

```js
function isSubsequence(small, big) {
  let i = 0;
  for (const ch of big) {
    if (i < small.length && ch === small[i]) i++;       // ① consume the next needed letter when it appears
  }
  return i === small.length;
}
```

When you need the **longest** common one, a single pointer isn't enough: use `dp[i][j]` = LCS of `a[0..i)` and `b[0..j)` with a zero first row and column. Equal last letters: `dp[i−1][j−1] + 1`; different: `max(dp[i−1][j], dp[i][j−1])`.

%% explain
- **`dp[i][j]`** for the first `i` and `j` letters.
- **Match** → diagonal + 1; **no match** → max of above and left.
- **Empty strings** give `0`.
- **Answer**: `dp[a.length][b.length]`.

%% nudge
- Why is there an extra row and column of zeros?
- Which three cells does `dp[i][j]` read?

%% starter
```js
export function longestCommonSubsequence(a, b) {
  // your code
  return 0;
}
```

%% tests
```js
describe('longestCommonSubsequence', () => {
  it('finds the length', () => {
    expect(longestCommonSubsequence('abcde', 'ace')).toBe(3);
    expect(longestCommonSubsequence('AGGTAB', 'GXTXAYB')).toBe(4);
    expect(longestCommonSubsequence('abc', 'abc')).toBe(3);
  });

  it('returns 0 for no overlap or empty strings', () => {
    expect(longestCommonSubsequence('abc', 'def')).toBe(0);
    expect(longestCommonSubsequence('', 'abc')).toBe(0);
    expect(longestCommonSubsequence('abc', '')).toBe(0);
  });

  it('is symmetric', () => {
    expect(longestCommonSubsequence('bsbininm', 'jmjkbkjkv')).toBe(longestCommonSubsequence('jmjkbkjkv', 'bsbininm'));
  });

  it('handles repeated letters', () => {
    expect(longestCommonSubsequence('aaaa', 'aa')).toBe(2);
    expect(longestCommonSubsequence('abab', 'baba')).toBe(3);
  });

  it('is fast on two 2 000-letter strings', () => {
    const a = 'ab'.repeat(1000);
    const b = 'ba'.repeat(1000);
    const t = Date.now();
    expect(longestCommonSubsequence(a, b)).toBe(1999);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))`.
- Nested loops from 1: if `a[i - 1] === b[j - 1]` then `dp[i - 1][j - 1] + 1`, else `Math.max(dp[i - 1][j], dp[i][j - 1])`.

%% solution
```js
export function longestCommonSubsequence(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
```

%% exercise alg-edit-distance | Edit distance | 4 | js | js | editDistance | 36
Return the **minimum number of single-character edits** — insert a character, delete a character, or replace a character — that turn string `a` into string `b` (the Levenshtein distance). It must be **O(n·m)**: two 1 500-letter strings are tested.

```js
editDistance('horse', 'ros');         // 3   (horse → rorse → rose → ros)
editDistance('intention', 'execution'); // 5
```

%% worked
**A similar problem, solved: `hammingDistance(a, b)`** — only replacements, for equal-length strings.

```js
function hammingDistance(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;    // ① one replacement per differing position
  return diff;
}
```

With inserts and deletes allowed, positions no longer line up, so you need the table. `dp[i][j]` = fewest edits turning the first `i` letters of `a` into the first `j` of `b`. **Base cases:** `dp[i][0] = i` (delete `i` letters) and `dp[0][j] = j` (insert `j` letters). If `a[i−1] === b[j−1]` the last letters already agree: `dp[i][j] = dp[i−1][j−1]`. Otherwise `1 + min(replace: dp[i−1][j−1], delete: dp[i−1][j], insert: dp[i][j−1])`.

%% explain
- **Base row and column** are `0, 1, 2, …`.
- **Equal letters**: free (diagonal).
- **Different**: 1 + the cheapest of replace, delete, insert.
- **Answer**: `dp[a.length][b.length]`.

%% nudge
- What is the cost of turning an empty string into `b`?
- Which neighbour corresponds to "delete a letter of `a`"?

%% starter
```js
export function editDistance(a, b) {
  // your code
  return 0;
}
```

%% tests
```js
describe('editDistance', () => {
  it('computes classic examples', () => {
    expect(editDistance('horse', 'ros')).toBe(3);
    expect(editDistance('intention', 'execution')).toBe(5);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });

  it('is 0 for equal strings', () => {
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', '')).toBe(0);
  });

  it('handles empty strings', () => {
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('abc', '')).toBe(3);
  });

  it('is symmetric', () => {
    expect(editDistance('flaw', 'lawn')).toBe(2);
    expect(editDistance('lawn', 'flaw')).toBe(2);
  });

  it('handles totally different strings', () => {
    expect(editDistance('abc', 'xyz')).toBe(3);
    expect(editDistance('a', 'bcd')).toBe(3);
  });

  it('is fast on two 1 500-letter strings', () => {
    const a = 'a'.repeat(1500);
    const b = 'b'.repeat(1500);
    const t = Date.now();
    expect(editDistance(a, b)).toBe(1500);
    expect(editDistance(a, a)).toBe(0);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- Table of `(a.length + 1) × (b.length + 1)`; first column `dp[i][0] = i`, first row `dp[0][j] = j`.
- Equal letters → `dp[i - 1][j - 1]`; otherwise `1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])`.

%% solution
```js
export function editDistance(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[n][m];
}
```

%% exercise alg-knapsack | 0/1 knapsack | 3 | js | js | knapsack | 28
`weights[i]` and `values[i]` describe item `i`; each item can be **taken at most once**. Return the **maximum total value** that fits within `capacity`. It must be **O(items × capacity)**: 100 items and capacity 10 000 are tested.

```js
knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7); // 9   (weights 3 + 4)
```

%% worked
**A similar problem, solved: `maxItemsWithinBudget(prices, budget)`** — when every item has the same value, greedy by price works. (Contrast!)

```js
function maxItemsWithinBudget(prices, budget) {
  const sorted = prices.slice().sort((a, b) => a - b);    // ① cheapest first
  let count = 0, spent = 0;
  for (const p of sorted) {
    if (spent + p > budget) break;                        // ② can't afford the next cheapest: stop
    spent += p; count++;
  }
  return count;
}
```

Different values break the greedy argument, so use `dp[w]` = best value with capacity `w`. For each item, update from **high capacity to low**: `dp[w] = max(dp[w], dp[w − weight] + value)`. Going downwards means `dp[w − weight]` still reflects the situation *before* this item, so it is used at most once.

%% explain
- **`dp[w]`** = best value with capacity `w` using the items so far.
- **Per item**: loop `w` from `capacity` down to `weight`.
- **Each item once** (the reason for the downward loop).
- **Capacity 0** gives `0`; items heavier than the capacity are skipped.

%% nudge
- What would happen if you looped `w` upwards?
- What does `dp[w − weight] + value` represent?

%% starter
```js
export function knapsack(weights, values, capacity) {
  // your code
  return 0;
}
```

%% tests
```js
describe('knapsack', () => {
  it('finds the best value', () => {
    expect(knapsack([1, 3, 4, 5], [1, 4, 5, 7], 7)).toBe(9);
    expect(knapsack([10, 20, 30], [60, 100, 120], 50)).toBe(220);
  });

  it('takes each item at most once', () => {
    expect(knapsack([2], [3], 10)).toBe(3);
    expect(knapsack([5, 5], [4, 4], 10)).toBe(8);
  });

  it('handles zero capacity, no items and oversized items', () => {
    expect(knapsack([1, 2], [5, 6], 0)).toBe(0);
    expect(knapsack([], [], 10)).toBe(0);
    expect(knapsack([20], [99], 10)).toBe(0);
  });

  it('matches brute force on random inputs', () => {
    let seed = 17;
    const rand = (m) => ((seed = (seed * 48271) % 2147483647) % m) + 1;
    for (let round = 0; round < 25; round++) {
      const n = 1 + (round % 8);
      const w = Array.from({ length: n }, () => rand(9));
      const v = Array.from({ length: n }, () => rand(20));
      const cap = rand(25);
      let best = 0;
      for (let mask = 0; mask < 1 << n; mask++) {
        let tw = 0, tv = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) { tw += w[i]; tv += v[i]; }
        if (tw <= cap && tv > best) best = tv;
      }
      expect(knapsack(w, v, cap)).toBe(best);
    }
  });

  it('is fast: 100 items, capacity 10 000', () => {
    const w = Array.from({ length: 100 }, (_, i) => (i % 50) + 5);
    const v = Array.from({ length: 100 }, (_, i) => ((i * 7) % 30) + 1);
    const t = Date.now();
    const r = knapsack(w, v, 10000);
    expect(Date.now() - t).toBeLessThan(800);
    expect(r).toBe(v.reduce((a, b) => a + b, 0));
  });
});
```

%% hints
- `const dp = new Array(capacity + 1).fill(0);`
- `for (let i = 0; i < weights.length; i++) for (let w = capacity; w >= weights[i]; w--) dp[w] = Math.max(dp[w], dp[w - weights[i]] + values[i]);`

%% solution
```js
export function knapsack(weights, values, capacity) {
  const dp = new Array(capacity + 1).fill(0);
  for (let i = 0; i < weights.length; i++) {
    for (let w = capacity; w >= weights[i]; w--) {
      const candidate = dp[w - weights[i]] + values[i];
      if (candidate > dp[w]) dp[w] = candidate;
    }
  }
  return dp[capacity];
}
```

%% exercise alg-can-partition | Equal subset sum | 3 | js | js | canPartition | 26
Return whether the array of positive integers can be **split into two groups with the same sum**. Every number goes in exactly one group. It must be **O(n × sum)**: 200 numbers are tested.

```js
canPartition([1, 5, 11, 5]); // true   ([1, 5, 5] and [11])
canPartition([1, 2, 3, 5]);  // false
```

%% worked
**A similar problem, solved: `canMakeExactly(nums, target)`** — can some subset add up to `target`?

```js
function canMakeExactly(nums, target) {
  const reachable = new Array(target + 1).fill(false);
  reachable[0] = true;                                        // ① the empty subset makes 0
  for (const x of nums) {
    for (let s = target; s >= x; s--) {                       // ② high → low: each number used once
      if (reachable[s - x]) reachable[s] = true;              // ③ s is reachable if s − x was
    }
  }
  return reachable[target];
}
```

Splitting evenly is just `canMakeExactly(nums, total / 2)`: if the total is **odd** the answer is immediately `false`; otherwise look for a subset summing to **half**.

%% explain
- **Odd total** → `false`.
- **Target** = `total / 2`; find a subset with that sum.
- **`reachable[s]`** updated from high to low.
- **Answer**: `reachable[target]`.

%% nudge
- What can you say immediately about an odd total?
- Why must the loop over `s` go downwards?

%% starter
```js
export function canPartition(nums) {
  // your code
  return false;
}
```

%% tests
```js
describe('canPartition', () => {
  it('splits evenly when possible', () => {
    expect(canPartition([1, 5, 11, 5])).toBe(true);
    expect(canPartition([2, 2])).toBe(true);
    expect(canPartition([3, 3, 3, 3])).toBe(true);
  });

  it('rejects impossible splits', () => {
    expect(canPartition([1, 2, 3, 5])).toBe(false);
    expect(canPartition([1])).toBe(false);
    expect(canPartition([1, 2, 5])).toBe(false);
  });

  it('rejects an odd total immediately', () => {
    expect(canPartition([1, 2, 4])).toBe(false);
  });

  it('uses each number once', () => {
    expect(canPartition([7, 7, 1])).toBe(false);
    expect(canPartition([6, 6, 6, 6, 12])).toBe(true);
  });

  it('is fast on 200 numbers', () => {
    const t = Date.now();
    expect(canPartition(new Array(200).fill(1))).toBe(true);
    expect(canPartition([...new Array(199).fill(100), 1])).toBe(false);
    expect(canPartition(Array.from({ length: 200 }, (_, i) => (i % 50) + 1))).toBe(true);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `const total = nums.reduce((a, b) => a + b, 0); if (total % 2) return false; const target = total / 2;`
- Subset-sum table `reachable[0..target]`; for each number loop `s` from `target` down to `x`.

%% solution
```js
export function canPartition(nums) {
  const total = nums.reduce((a, b) => a + b, 0);
  if (total % 2 !== 0) return false;
  const target = total / 2;
  const reachable = new Array(target + 1).fill(false);
  reachable[0] = true;
  for (const x of nums) {
    for (let s = target; s >= x; s--) {
      if (reachable[s - x]) reachable[s] = true;
    }
    if (reachable[target]) return true;
  }
  return reachable[target];
}
```

%% exercise alg-longest-palindrome | Longest palindromic substring | 3 | js | js | longestPalindrome | 26
Return the **longest substring of `s` that reads the same forwards and backwards**. If several have the same length, return the **leftmost**. The empty string returns `''`. It must run in **O(n²)** with no table: 2 000 identical letters are tested.

```js
longestPalindrome('babad'); // 'bab'  (leftmost of 'bab' and 'aba')
longestPalindrome('cbbd');  // 'bb'
```

%% worked
**A similar problem, solved: `countPalindromicSubstrings(s)`** — how many substrings are palindromes? Same centre-expansion, counting instead of tracking the best.

```js
function countPalindromicSubstrings(s) {
  let count = 0;
  const expand = (l, r) => {
    while (l >= 0 && r < s.length && s[l] === s[r]) { count++; l--; r++; }   // ① each successful step is another palindrome
  };
  for (let i = 0; i < s.length; i++) { expand(i, i); expand(i, i + 1); }     // ② odd and even centres
  return count;
}
```

For the longest one, record how far each expansion got: after the loop, the palindrome is `s.slice(l + 1, r)` with length `r − l − 1`. Keep the best (replace it only when **strictly longer**, so the leftmost wins) and return its slice.

%% explain
- **Centres**: each letter (odd length) and each gap (even length).
- **Expand** while both ends are in bounds and equal.
- **Leftmost on ties**: only replace when strictly longer.
- **No table**: O(1) extra memory.

%% nudge
- Why two expansions per index?
- After the `while` loop stops, which indexes bound the palindrome?

%% starter
```js
export function longestPalindrome(s) {
  // your code
  return '';
}
```

%% tests
```js
describe('longestPalindrome', () => {
  it('finds the longest palindromic substring', () => {
    expect(longestPalindrome('babad')).toBe('bab');
    expect(longestPalindrome('cbbd')).toBe('bb');
    expect(longestPalindrome('forgeeksskeegfor')).toBe('geeksskeeg');
  });

  it('handles tiny strings', () => {
    expect(longestPalindrome('')).toBe('');
    expect(longestPalindrome('a')).toBe('a');
    expect(longestPalindrome('ab')).toBe('a');
    expect(longestPalindrome('aa')).toBe('aa');
  });

  it('returns the whole string when it is a palindrome', () => {
    expect(longestPalindrome('racecar')).toBe('racecar');
    expect(longestPalindrome('abba')).toBe('abba');
  });

  it('prefers the leftmost on ties', () => {
    expect(longestPalindrome('abcd')).toBe('a');
    expect(longestPalindrome('xabay')).toBe('aba');
    expect(longestPalindrome('abaxcdc')).toBe('aba');
  });

  it('is fast: 2 000 identical letters', () => {
    const s = 'a'.repeat(2000);
    const t = Date.now();
    expect(longestPalindrome(s)).toBe(s);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- Helper `expand(l, r)`: `while (l >= 0 && r < s.length && s[l] === s[r]) { l--; r++; }` then the length is `r - l - 1`.
- For each `i`, call `expand(i, i)` and `expand(i, i + 1)`; if the length beats `bestLen`, set `start = l + 1`.

%% solution
```js
export function longestPalindrome(s) {
  let start = 0;
  let bestLen = 0;
  const expand = (l, r) => {
    while (l >= 0 && r < s.length && s[l] === s[r]) {
      l--;
      r++;
    }
    const len = r - l - 1;
    if (len > bestLen) {
      bestLen = len;
      start = l + 1;
    }
  };
  for (let i = 0; i < s.length; i++) {
    expand(i, i);
    expand(i, i + 1);
  }
  return s.slice(start, start + bestLen);
}
```
