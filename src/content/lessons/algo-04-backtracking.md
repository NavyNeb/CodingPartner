---
id: algo-backtracking
track: algo
title: Backtracking
summary: Building every valid answer one choice at a time, undoing each choice afterwards: the choose-explore-undo template, subsets, permutations, combinations, pruning dead ends, and skipping duplicates.
---

## The idea in one sentence

Backtracking builds an answer **one choice at a time**; when a choice leads nowhere (or the answer is complete) it **undoes the choice** and tries the next one.

> **Analogy** Exploring a maze with a ball of string: at each fork you take a path, unrolling string. At a dead end you roll the string back to the last fork and try a different turn. You never lose your place, and you eventually try every route — unless you're smart enough to recognise a doomed corridor early and skip it.

It is **depth-first search over a tree of partial answers**. Problems that ask for "**all** ways to…" or "**is there any** arrangement that…" (subsets, permutations, combinations, puzzles like Sudoku and N-Queens) are usually backtracking.

## The template

![The three steps of backtracking: choose, explore, un-choose](fig:alg-backtrack-cycle "Because every choice is undone, each branch starts from the same clean state.")

Every backtracking function has the same shape. Keep a **shared `path`** you are building, and:

1. **If the path is a complete answer**, record a **copy** of it.
2. **For each available option:** *choose* it (`push`), *explore* (recurse), *un-choose* (`pop`).

```js try
function binaryStrings(n) {
  const out = [];
  const path = [];
  function backtrack() {
    if (path.length === n) { out.push(path.join('')); return; }     // complete: record a COPY (join makes a new string)
    for (const bit of ['0', '1']) {                                 // each option
      path.push(bit);       // choose
      backtrack();          // explore
      path.pop();           // un-choose
    }
  }
  backtrack();
  return out;
}
console.log(binaryStrings(3));
```

The most common bug is recording `path` itself instead of a **copy** (`[...path]`): the same array is mutated later, and every recorded answer ends up looking the same.

## Subsets

For each item, **take it or skip it**: a decision tree with two branches per level.

![The take-or-skip decision tree for subsets of 1, 2, 3](fig:alg-subsets-tree "n items give 2ⁿ subsets, one per leaf.")

A neat way to write this loops over **which item comes next**, passing a `start` index so each subset is built in increasing index order (no duplicates like `{1,2}` and `{2,1}`):

```stepper Subsets of [1, 2, 3]
code:
  function subsets(nums) {
    const result = [];
    const path = [];
    function backtrack(start) {
      result.push([...path]);
      for (let i = start; i < nums.length; i++) {
        path.push(nums[i]);        // choose
        backtrack(i + 1);          // explore
        path.pop();                // un-choose
      }
    }
    backtrack(0);
    return result;
  }
---
line: 5
say: `backtrack(0)` starts with an empty path. **Every** path along the way is itself a subset, so record a copy right away: `[]`.
path: (empty)
result: [ ]
---
line: 7-8
say: Choose `1` and explore: the path `[1]` is a subset too.
path: 1
result: [ ] [1]
---
line: 7-8
say: From `[1]`, choose `2` (only indexes after 1 are allowed): record `[1, 2]`. Then choose `3`: record `[1, 2, 3]`. No more items, so that call returns.
path: 1 2 3
result: [ ] [1] [1,2] [1,2,3]
---
line: 9
say: Back out one level at a time: **un-choose** `3`, then `2`. The path is `[1]` again, and its loop continues with `3`: record `[1, 3]`.
path: 1 3
result: [ ] [1] [1,2] [1,2,3] [1,3]
---
line: 9
say: Un-choose back to the empty path. The top loop moves on to `2`: record `[2]`, then `[2, 3]`.
path: 2 3
result: [ ] [1] [1,2] [1,2,3] [1,3] [2] [2,3]
---
line: 9
say: Finally choose `3` alone: `[3]`. The top loop ends. All **eight** subsets were produced, each exactly once.
path: 3
result: [ ] [1] [1,2] [1,2,3] [1,3] [2] [2,3] [3]
```

## Permutations

For orderings, any unused item can come next, so the loop runs over **all** items and a **`used` set** marks the ones already on the path:

```js try
function permutations(nums) {
  const out = [], path = [], used = new Array(nums.length).fill(false);
  function backtrack() {
    if (path.length === nums.length) { out.push([...path]); return; }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;                    // already on the path
      used[i] = true; path.push(nums[i]);       // choose
      backtrack();                              // explore
      path.pop(); used[i] = false;              // un-choose (undo BOTH pieces of state)
    }
  }
  backtrack();
  return out;
}
console.log(permutations([1, 2, 3]).length, permutations([1, 2, 3])[1]);
```

Whatever you change when choosing, you must change back when un-choosing: here that's both `path` and `used`.

## Combinations and reusing items

When items can be **reused** (making change, "combination sum"), recurse with the **same** `start` index so an item can be chosen again; and track the **remaining** target, stopping when it hits zero or goes negative:

```js try
function combinationSum(candidates, target) {
  const out = [], path = [];
  function backtrack(start, remaining) {
    if (remaining === 0) { out.push([...path]); return; }
    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > remaining) continue;       // too big: skip this option
      path.push(candidates[i]);
      backtrack(i, remaining - candidates[i]);       // `i`, not `i + 1`: the same number may be used again
      path.pop();
    }
  }
  backtrack(0, target);
  return out;
}
console.log(combinationSum([2, 3, 6, 7], 7));
```

## Pruning: don't explore doomed branches

A branch that can **no longer lead to a valid answer** should be cut off immediately — that's the difference between a fast solution and one that takes forever.

**Valid parentheses.** To generate all balanced strings of `n` pairs, don't try every string of `(` and `)` and filter: only add `(` while you still have some to place, and only add `)` while there are **more open than closed** brackets:

```js try
function generateParentheses(n) {
  const out = [];
  function backtrack(s, open, close) {
    if (s.length === 2 * n) { out.push(s); return; }
    if (open < n) backtrack(s + '(', open + 1, close);        // pruning rule 1
    if (close < open) backtrack(s + ')', open, close + 1);    // pruning rule 2: never close more than opened
  }
  backtrack('', 0, 0);
  return out;
}
console.log(generateParentheses(3));
```

**N-Queens.** Place one queen per row; before choosing a column, check it isn't attacked. If *no* column in a row is safe, return immediately — the whole subtree below is skipped.

![Four queens: a partial placement where row 2 has no safe square](fig:alg-queens-deadend "A dead end: undo the previous choice and try its next option.")

## Avoiding duplicate answers

If the input contains **repeated values**, plain backtracking produces duplicate answers (`[1, 2a]` and `[1, 2b]`). The standard fix: **sort**, then at each loop level **skip an option equal to the previous one that was already tried at that level**:

```js try
function subsetsWithDup(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  const out = [], path = [];
  function backtrack(start) {
    out.push([...path]);
    for (let i = start; i < sorted.length; i++) {
      if (i > start && sorted[i] === sorted[i - 1]) continue;   // same value already tried at this position
      path.push(sorted[i]);
      backtrack(i + 1);
      path.pop();
    }
  }
  backtrack(0);
  return out;
}
console.log(subsetsWithDup([1, 2, 2]).length);   // 6 distinct subsets, not 8
```

(Note `i > start`, not `i > 0`: the *first* option at each level is always allowed.)

## How expensive is it?

Backtracking is **exponential** by nature: subsets are `2ⁿ`, permutations `n!`. That is fine for `n` up to about 20 (subsets) or 10 (permutations). Pruning cuts the real cost far below the worst case, but if the **same sub-situation** keeps recurring (the Fibonacci tree from the first lesson), **memoise it** — that's **dynamic programming**, the next two lessons.

## Quick check

```check
Q: Why record `[...path]` and not `path` itself when you reach an answer?
A) Spreading is faster
B) `path` keeps changing as you backtrack, so every stored answer would end up identical/empty *
C) Arrays can't be stored
D) It sorts the answer
Why: The same array object is mutated by later push/pop calls. A copy freezes the answer at that moment.
---
Q: What does "un-choose" do?
A) Skips the next option
B) Reverses the state change made when choosing (pop, unmark used…) so the next option starts clean *
C) Ends the whole search
D) Sorts the path
Why: Without it, choices would leak into sibling branches.
---
Q: In combination sum, why recurse with `i` rather than `i + 1`?
A) To skip the current number
B) So the same number can be chosen again *
C) To avoid sorting
D) It makes the search faster
Why: `i + 1` would force strictly increasing, distinct picks; `i` allows reuse while still preventing reordered duplicates.
---
Q: What is pruning?
A) Sorting the input
B) Abandoning a branch as soon as it cannot lead to a valid answer *
C) Removing duplicates at the end
D) Caching results
Why: Cutting a doomed branch skips everything below it, which is what keeps backtracking fast in practice.
---
Q: With duplicate values, why sort and skip `sorted[i] === sorted[i - 1]` when `i > start`?
A) To reduce memory
B) Choosing an equal value at the same level would just rebuild a duplicate branch *
C) To make the output sorted
D) To avoid stack overflow
Why: The first copy at a level already explores every continuation the second copy would.
```

## Recap

- Backtracking = **choose, explore, un-choose** over a shared `path`; record a **copy** at the leaves.
- **Subsets**: `start` index. **Permutations**: a `used` set. **Reuse**: recurse with `i`, not `i + 1`.
- **Prune** as early as possible (balanced brackets, attacked squares, remaining target below zero).
- **Duplicates in the input**: sort, then skip an equal value at the same level.
- It is **exponential**; if sub-situations repeat, switch to dynamic programming.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: binary strings | The `binaryStrings` snippet |
| Subsets | The subsets stepper |
| Permutations | The `used` array and undoing both pieces of state |
| Subsets with duplicates | Sort + skip equal values at the same level |
| Combination sum | Recurse with `i`; track the remaining target |
| Generate parentheses | The two pruning rules |
| Word search | Mark a cell while you use it, unmark it afterwards |
| N-Queens (count) | Three sets: columns and the two diagonals |

%% exercise alg-guided-binary-strings | Guided: binary strings | 1 | js | js | binaryStrings | 10 | guided
Return **all binary strings of length `n`** (made of `'0'` and `'1'`) in **lexicographic order**. `binaryStrings(0)` is `['']`.

```js
binaryStrings(2); // ['00', '01', '10', '11']
```

%% worked
**A similar problem, solved: `dicePaths(n)`** — every sequence of `n` rolls of a three-sided die, as strings.

```js
function dicePaths(n) {
  const out = [];
  function go(path) {
    if (path.length === n) { out.push(path); return; }      // ① complete: record (strings are immutable, so no copy needed)
    for (const face of ['1', '2', '3']) go(path + face);    // ② each option: choose by building a longer string
  }
  go('');
  return out;
}
```

Building a **new string** each time is a tidy way to avoid the un-choose step: nothing is shared, so nothing needs undoing. For `binaryStrings` the options are `'0'` and `'1'` — try `'0'` first to get lexicographic order.

%% explain
- **`2ⁿ` strings**, each of length `n`.
- **Lexicographic order**: `'0'` before `'1'` at every position.
- **`n = 0`** gives `['']`.

%% nudge
- What is the base case, and what do you record there?
- What are the two options at each position?

%% starter
```js
export function binaryStrings(n) {
  const out = [];
  // Step 1 — a helper go(path): when path.length === n, push path and return.
  // Step 2 — otherwise call go(path + '0') and then go(path + '1').
  // Step 3 — call go('') and return out.
  return out;
}
```

%% tests
```js
describe('binaryStrings', () => {
  it('lists the strings in order', () => {
    expect(binaryStrings(2)).toEqual(['00', '01', '10', '11']);
    expect(binaryStrings(3)).toEqual(['000', '001', '010', '011', '100', '101', '110', '111']);
  });

  it('handles lengths 0 and 1', () => {
    expect(binaryStrings(0)).toEqual(['']);
    expect(binaryStrings(1)).toEqual(['0', '1']);
  });

  it('produces 2^n strings', () => {
    const r = binaryStrings(10);
    expect(r.length).toBe(1024);
    expect(new Set(r).size).toBe(1024);
  });

  it('is fast for n = 16', () => {
    const t = Date.now();
    const r = binaryStrings(16);
    expect(Date.now() - t).toBeLessThan(800);
    expect(r.length).toBe(65536);
    expect(r[65535]).toBe('1'.repeat(16));
  });
});
```

%% hints
- `function go(path) { if (path.length === n) { out.push(path); return; } go(path + '0'); go(path + '1'); }`

%% solution
```js
export function binaryStrings(n) {
  const out = [];
  function go(path) {
    if (path.length === n) {
      out.push(path);
      return;
    }
    go(path + '0');
    go(path + '1');
  }
  go('');
  return out;
}
```

%% exercise alg-subsets | Subsets | 2 | js | js | subsets | 16
Return **all subsets** (the power set) of an array of **distinct** numbers. Each subset lists its items in their original order. The result may be in any order. `subsets([])` is `[[]]`. Don't modify the input.

```js
subsets([1, 2, 3]); // [[], [1], [2], [3], [1,2], [1,3], [2,3], [1,2,3]]  (any order)
```

%% worked
**A similar problem, solved: `countSubsetsWithSum(nums, target)`** — the same tree, counting instead of listing.

```js
function countSubsetsWithSum(nums, target) {
  function go(i, remaining) {
    if (i === nums.length) return remaining === 0 ? 1 : 0;   // ① all items decided: does this subset hit the target?
    return go(i + 1, remaining - nums[i])                     // ② take nums[i]
         + go(i + 1, remaining);                              // ③ skip it
  }
  return go(0, target);
}
```

For listing, use the `start`-index form from the stepper: record a **copy** of the path at *every* call, then loop `i` from `start`, choosing `nums[i]`, recursing with `i + 1`, and un-choosing.

%% explain
- **`2ⁿ` subsets** including `[]` and the full array.
- **Items in original order** within each subset.
- **No duplicates**; order of the result doesn't matter.
- **Copy** the path when recording.

%% nudge
- When is a path a valid answer?
- Why recurse with `i + 1`?

%% starter
```js
export function subsets(nums) {
  const result = [];
  // your code
  return result;
}
```

%% tests
```js
const norm = (list) => list.map((x) => JSON.stringify(x)).sort();

describe('subsets', () => {
  it('lists every subset', () => {
    expect(norm(subsets([1, 2, 3]))).toEqual(norm([[], [1], [2], [3], [1, 2], [1, 3], [2, 3], [1, 2, 3]]));
  });

  it('handles the empty array and a single item', () => {
    expect(subsets([])).toEqual([[]]);
    expect(norm(subsets([5]))).toEqual(norm([[], [5]]));
  });

  it('keeps items in their original order', () => {
    const r = subsets([3, 1, 2]);
    expect(r).toContainEqual([3, 1, 2]);
    expect(r).toContainEqual([3, 2]);
    expect(r).not.toContainEqual([1, 3]);
  });

  it('does not modify the input and returns independent arrays', () => {
    const input = [1, 2];
    const r = subsets(input);
    expect(input).toEqual([1, 2]);
    r[0].push(99);
    expect(r.filter((s) => s.includes(99)).length).toBe(1);
  });

  it('is fast: 16 items give 65 536 subsets', () => {
    const t = Date.now();
    const r = subsets(Array.from({ length: 16 }, (_, i) => i));
    expect(Date.now() - t).toBeLessThan(900);
    expect(r.length).toBe(65536);
  });
});
```

%% hints
- `function backtrack(start) { result.push([...path]); for (let i = start; i < nums.length; i++) { path.push(nums[i]); backtrack(i + 1); path.pop(); } }`
- Call `backtrack(0)` and return `result`.

%% solution
```js
export function subsets(nums) {
  const result = [];
  const path = [];
  function backtrack(start) {
    result.push([...path]);
    for (let i = start; i < nums.length; i++) {
      path.push(nums[i]);
      backtrack(i + 1);
      path.pop();
    }
  }
  backtrack(0);
  return result;
}
```

%% exercise alg-permutations | Permutations | 2 | js | js | permutations | 16
Return **every ordering** of an array of **distinct** numbers (any order of the result). `permutations([])` is `[[]]`. Don't modify the input.

```js
permutations([1, 2, 3]); // 6 arrays: [1,2,3] [1,3,2] [2,1,3] [2,3,1] [3,1,2] [3,2,1]
```

%% worked
**A similar problem, solved: `pickTwo(items)`** — all ordered pairs of *different* items, using a `used` marker.

```js
function pickTwo(items) {
  const out = [], path = [], used = new Array(items.length).fill(false);
  function go() {
    if (path.length === 2) { out.push([...path]); return; }
    for (let i = 0; i < items.length; i++) {
      if (used[i]) continue;                    // ① already in the path
      used[i] = true; path.push(items[i]);      // ② choose: update BOTH pieces of state
      go();                                     // ③ explore
      path.pop(); used[i] = false;              // ④ un-choose both
    }
  }
  go();
  return out;
}
```

Permutations are the same with "stop when the path has `items.length` entries". Every unused item may come next, so the loop starts at `0`, not at a `start` index.

%% explain
- **`n!` results**, each a full ordering.
- **`used[i]`** marks items already placed.
- **Undo both** `path` and `used` when backtracking.
- **Empty input** gives `[[]]`.

%% nudge
- How do you know an item is already in the path?
- What are the two things to undo?

%% starter
```js
export function permutations(nums) {
  const result = [];
  // your code
  return result;
}
```

%% tests
```js
const norm = (list) => list.map((x) => JSON.stringify(x)).sort();

describe('permutations', () => {
  it('lists every ordering', () => {
    expect(norm(permutations([1, 2, 3]))).toEqual(norm([[1, 2, 3], [1, 3, 2], [2, 1, 3], [2, 3, 1], [3, 1, 2], [3, 2, 1]]));
  });

  it('handles empty and single-item inputs', () => {
    expect(permutations([])).toEqual([[]]);
    expect(permutations([7])).toEqual([[7]]);
  });

  it('has n! distinct results', () => {
    const r = permutations([1, 2, 3, 4, 5]);
    expect(r.length).toBe(120);
    expect(new Set(r.map((p) => p.join(','))).size).toBe(120);
  });

  it('works with non-numeric items and does not modify the input', () => {
    const input = ['a', 'b'];
    expect(norm(permutations(input))).toEqual(norm([['a', 'b'], ['b', 'a']]));
    expect(input).toEqual(['a', 'b']);
  });

  it('is fast: 8 items give 40 320 permutations', () => {
    const t = Date.now();
    const r = permutations([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(Date.now() - t).toBeLessThan(900);
    expect(r.length).toBe(40320);
  });
});
```

%% hints
- `used = new Array(nums.length).fill(false)`; when `path.length === nums.length` record `[...path]`.
- Loop all indexes; skip used ones; mark used and push; recurse; pop and unmark.

%% solution
```js
export function permutations(nums) {
  const result = [];
  const path = [];
  const used = new Array(nums.length).fill(false);
  function backtrack() {
    if (path.length === nums.length) {
      result.push([...path]);
      return;
    }
    for (let i = 0; i < nums.length; i++) {
      if (used[i]) continue;
      used[i] = true;
      path.push(nums[i]);
      backtrack();
      path.pop();
      used[i] = false;
    }
  }
  backtrack();
  return result;
}
```

%% exercise alg-subsets-dup | Subsets with duplicates | 3 | js | js | subsetsWithDup | 22
`nums` may contain **repeated values**. Return all **distinct** subsets (treating equal values as interchangeable), each listed in **ascending order**. Result order doesn't matter. Don't modify the input.

```js
subsetsWithDup([1, 2, 2]); // [[], [1], [1,2], [1,2,2], [2], [2,2]]  (6, not 8)
```

%% worked
**A similar problem, solved: `distinctPairs(nums)`** — all distinct unordered pairs of values from a sorted copy, skipping repeats at the same level.

```js
function distinctPairs(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);     // ① sorting puts equal values next to each other
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;  // ② same first value already used for pairs: skip
    for (let j = i + 1; j < sorted.length; j++) {
      if (j > i + 1 && sorted[j] === sorted[j - 1]) continue;   // ③ same second value at this level: skip
      out.push([sorted[i], sorted[j]]);
    }
  }
  return out;
}
```

Same rule inside the backtracking loop: after **sorting**, skip option `i` when `i > start` and `sorted[i] === sorted[i - 1]` — an equal value was already tried at this position of the loop, and exploring it again would rebuild the same subsets.

%% explain
- **Sort a copy first**.
- **Skip** `sorted[i]` if `i > start` and it equals `sorted[i − 1]`.
- **Each subset** is in ascending order and appears once.
- **Input unchanged**.

%% nudge
- Why `i > start` and not `i > 0`?
- What must the array look like for the skip rule to work?

%% starter
```js
export function subsetsWithDup(nums) {
  const result = [];
  // your code
  return result;
}
```

%% tests
```js
const norm = (list) => list.map((x) => JSON.stringify(x)).sort();

describe('subsetsWithDup', () => {
  it('returns each distinct subset once', () => {
    expect(norm(subsetsWithDup([1, 2, 2]))).toEqual(norm([[], [1], [1, 2], [1, 2, 2], [2], [2, 2]]));
  });

  it('handles all-equal and empty inputs', () => {
    expect(norm(subsetsWithDup([0, 0, 0]))).toEqual(norm([[], [0], [0, 0], [0, 0, 0]]));
    expect(subsetsWithDup([])).toEqual([[]]);
  });

  it('sorts items inside each subset', () => {
    const r = subsetsWithDup([3, 1, 3]);
    expect(norm(r)).toEqual(norm([[], [1], [1, 3], [1, 3, 3], [3], [3, 3]]));
  });

  it('does not modify the input', () => {
    const input = [2, 1, 2];
    subsetsWithDup(input);
    expect(input).toEqual([2, 1, 2]);
  });

  it('has no duplicates for a larger input', () => {
    const r = subsetsWithDup([1, 1, 2, 2, 3, 3]);
    expect(r.length).toBe(27);
    expect(new Set(r.map((s) => s.join(','))).size).toBe(27);
  });
});
```

%% hints
- `const sorted = nums.slice().sort((a, b) => a - b);`
- In the loop: `if (i > start && sorted[i] === sorted[i - 1]) continue;` before choosing.

%% solution
```js
export function subsetsWithDup(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  const result = [];
  const path = [];
  function backtrack(start) {
    result.push([...path]);
    for (let i = start; i < sorted.length; i++) {
      if (i > start && sorted[i] === sorted[i - 1]) continue;
      path.push(sorted[i]);
      backtrack(i + 1);
      path.pop();
    }
  }
  backtrack(0);
  return result;
}
```

%% exercise alg-combination-sum | Combination sum | 3 | js | js | combinationSum | 24
`candidates` are **distinct positive integers**. Return every **unique combination** whose items sum to `target`; the **same number may be used any number of times**. Two combinations are the same if they use the same numbers the same number of times. Result order doesn't matter.

```js
combinationSum([2, 3, 6, 7], 7); // [[2, 2, 3], [7]]
```

%% worked
**A similar problem, solved: `waysToMakeChange(coins, amount)`** — the *count* of combinations, with the same recursion.

```js
function waysToMakeChange(coins, amount) {
  function go(start, remaining) {
    if (remaining === 0) return 1;                  // ① exactly made it: one way
    let ways = 0;
    for (let i = start; i < coins.length; i++) {
      if (coins[i] <= remaining) ways += go(i, remaining - coins[i]);   // ② reuse: recurse with i (not i + 1)
    }
    return ways;
  }
  return go(0, amount);
}
```

To **list** the combinations instead, add the `path` (choose/un-choose) and record a copy when `remaining` reaches `0`. Passing `start = i` keeps combinations from appearing in several orders (`[2,3]` vs `[3,2]`), because you can never go back to a smaller index.

%% explain
- **Reuse allowed**: recurse with the same index.
- **`start` index** prevents permutations of the same combination.
- **Stop** when `remaining === 0` (record) or when a candidate is larger than what remains (skip).
- **No solutions** → `[]`.

%% nudge
- What changes between the recursive call and the current one: the index, the remaining target, or both?
- Why can't you go back to an earlier candidate?

%% starter
```js
export function combinationSum(candidates, target) {
  const result = [];
  // your code
  return result;
}
```

%% tests
```js
const norm = (list) => list.map((c) => JSON.stringify(c.slice().sort((a, b) => a - b))).sort();

describe('combinationSum', () => {
  it('finds all combinations', () => {
    expect(norm(combinationSum([2, 3, 6, 7], 7))).toEqual(norm([[2, 2, 3], [7]]));
    expect(norm(combinationSum([2, 3, 5], 8))).toEqual(norm([[2, 2, 2, 2], [2, 3, 3], [3, 5]]));
  });

  it('returns [] when nothing adds up', () => {
    expect(combinationSum([2], 1)).toEqual([]);
    expect(combinationSum([5, 7], 3)).toEqual([]);
  });

  it('allows reuse of a single candidate', () => {
    expect(combinationSum([3], 9)).toEqual([[3, 3, 3]]);
  });

  it('does not list the same combination twice', () => {
    const r = combinationSum([2, 3, 5], 10);
    expect(new Set(norm(r)).size).toBe(r.length);
  });

  it('matches a coin-change count and is fast', () => {
    const coins = [2, 3, 5, 7, 11];
    const target = 50;
    const ways = new Array(target + 1).fill(0);
    ways[0] = 1;
    for (const c of coins) for (let a = c; a <= target; a++) ways[a] += ways[a - c];
    const t = Date.now();
    const r = combinationSum(coins, target);
    expect(Date.now() - t).toBeLessThan(900);
    expect(r.length).toBe(ways[target]);
    expect(r.every((c) => c.reduce((s, x) => s + x, 0) === target)).toBe(true);
  });
});
```

%% hints
- `function backtrack(start, remaining) { if (remaining === 0) { result.push([...path]); return; } for (let i = start; i < candidates.length; i++) { … } }`
- Skip a candidate bigger than `remaining`; otherwise push, call `backtrack(i, remaining - candidates[i])`, pop.

%% solution
```js
export function combinationSum(candidates, target) {
  const result = [];
  const path = [];
  function backtrack(start, remaining) {
    if (remaining === 0) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < candidates.length; i++) {
      if (candidates[i] > remaining) continue;
      path.push(candidates[i]);
      backtrack(i, remaining - candidates[i]);
      path.pop();
    }
  }
  backtrack(0, target);
  return result;
}
```

%% exercise alg-parentheses | Generate parentheses | 3 | js | js | generateParentheses | 22
Return **all strings of `n` pairs of balanced parentheses**. Result order doesn't matter. `generateParentheses(0)` is `['']`. Build only valid strings (prune): `n = 10` has 16 796 results and must be fast.

```js
generateParentheses(3);
// ['((()))', '(()())', '(())()', '()(())', '()()()']
```

%% worked
**A similar problem, solved: `countBalanced(n)`** — just count them, using the same two pruning rules.

```js
function countBalanced(n) {
  function go(open, close) {
    if (open === n && close === n) return 1;            // ① used all pairs: a complete valid string
    let count = 0;
    if (open < n) count += go(open + 1, close);          // ② may place '(' while some remain
    if (close < open) count += go(open, close + 1);      // ③ may place ')' only if one is unmatched
    return count;
  }
  return go(0, 0);
}
```

The rules **never produce** an invalid prefix, so there is nothing to filter at the end. To list the strings, carry the string built so far (`s + '('`) and record it when its length reaches `2n`.

%% explain
- **Two rules**: `(` if `open < n`; `)` if `close < open`.
- **Complete** when the string has length `2n`.
- **Count** is the Catalan number (5 for `n = 3`, 16 796 for `n = 10`).
- **`n = 0`** → `['']`.

%% nudge
- When is it illegal to add a closing bracket?
- Why does this make filtering at the end unnecessary?

%% starter
```js
export function generateParentheses(n) {
  const result = [];
  // your code
  return result;
}
```

%% tests
```js
describe('generateParentheses', () => {
  it('lists the balanced strings', () => {
    expect(generateParentheses(3).sort()).toEqual(['((()))', '(()())', '(())()', '()(())', '()()()']);
    expect(generateParentheses(1)).toEqual(['()']);
  });

  it('handles n = 0 and n = 2', () => {
    expect(generateParentheses(0)).toEqual(['']);
    expect(generateParentheses(2).sort()).toEqual(['(())', '()()']);
  });

  it('only returns balanced, distinct strings', () => {
    const r = generateParentheses(6);
    expect(r.length).toBe(132);
    expect(new Set(r).size).toBe(132);
    const balanced = (s) => { let d = 0; for (const c of s) { d += c === '(' ? 1 : -1; if (d < 0) return false; } return d === 0; };
    expect(r.every(balanced)).toBe(true);
  });

  it('is fast: n = 10 gives 16 796 strings', () => {
    const t = Date.now();
    const r = generateParentheses(10);
    expect(Date.now() - t).toBeLessThan(900);
    expect(r.length).toBe(16796);
  });
});
```

%% hints
- `function go(s, open, close) { if (s.length === 2 * n) { result.push(s); return; } if (open < n) go(s + '(', open + 1, close); if (close < open) go(s + ')', open, close + 1); }`

%% solution
```js
export function generateParentheses(n) {
  const result = [];
  function go(s, open, close) {
    if (s.length === 2 * n) {
      result.push(s);
      return;
    }
    if (open < n) go(s + '(', open + 1, close);
    if (close < open) go(s + ')', open, close + 1);
  }
  go('', 0, 0);
  return result;
}
```

%% exercise alg-word-search | Word search | 3 | js | js | wordSearch | 26
`board` is an array of equal-length strings (the grid). Return whether `word` can be spelled by a path of **adjacent cells** (up, down, left, right) where **no cell is used twice** in one path. An empty word returns `true`.

```js
const board = ['ABCE', 'SFCS', 'ADEE'];
wordSearch(board, 'ABCCED'); // true
wordSearch(board, 'ABCB');   // false  (the B would be reused)
```

%% worked
**A similar problem, solved: `pathExists(grid, r, c, target)`** — can you reach `target` from `(r, c)` moving through `'.'` cells without revisiting any?

```js
function pathExists(grid, r, c, target, seen = new Set()) {
  if (r < 0 || c < 0 || r >= grid.length || c >= grid[0].length) return false;   // ① off the board
  if (grid[r][c] === '#' || seen.has(r + ',' + c)) return false;                  // ② wall or already on this path
  if (r === target[0] && c === target[1]) return true;
  seen.add(r + ',' + c);                                                          // ③ choose: mark this cell as used
  const found = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => pathExists(grid, r + dr, c + dc, target, seen));
  seen.delete(r + ',' + c);                                                       // ④ un-choose: free it for other paths
  return found;
}
```

For word search, "target" becomes "the next letter": from a cell that matches `word[index]`, try its four neighbours for `word[index + 1]`. **Mark the cell** while it is on the current path and **unmark** it afterwards, so other starting points and other branches can use it.

%% explain
- **Start** from every cell matching the first letter.
- **Each step**: match `word[index]`, mark the cell, try 4 neighbours for `index + 1`, unmark.
- **Done** when `index === word.length`.
- **No reuse** within one path, but cells are free again for other paths.

%% nudge
- What happens if you forget to unmark a cell after exploring from it?
- When does the recursion succeed?

%% starter
```js
export function wordSearch(board, word) {
  // your code
  return false;
}
```

%% tests
```js
describe('wordSearch', () => {
  const board = ['ABCE', 'SFCS', 'ADEE'];

  it('finds words along adjacent cells', () => {
    expect(wordSearch(board, 'ABCCED')).toBe(true);
    expect(wordSearch(board, 'SEE')).toBe(true);
  });

  it('does not reuse a cell within one path', () => {
    expect(wordSearch(board, 'ABCB')).toBe(false);
    expect(wordSearch(['AA'], 'AAA')).toBe(false);
  });

  it('does not connect diagonals', () => {
    expect(wordSearch(['AB', 'CD'], 'AD')).toBe(false);
    expect(wordSearch(['AB', 'CD'], 'ABDC')).toBe(true);
  });

  it('frees cells after a failed branch', () => {
    expect(wordSearch(['AAA', 'BXX'], 'AAAB')).toBe(true);
    expect(wordSearch(['AAA', 'BXX'], 'AAAAB')).toBe(false);
    expect(wordSearch(['AAB', 'ACA'], 'AAAC')).toBe(true);
  });

  it('handles single cells and an empty word', () => {
    expect(wordSearch(['A'], 'A')).toBe(true);
    expect(wordSearch(['A'], 'B')).toBe(false);
    expect(wordSearch(['A'], '')).toBe(true);
  });

  it('does not modify the board', () => {
    const b = ['AB', 'CD'];
    wordSearch(b, 'ABDC');
    expect(b).toEqual(['AB', 'CD']);
  });
});
```

%% hints
- Convert rows to arrays (`board.map((r) => r.split(''))`) or keep a `seen` grid so you can mark/unmark.
- `function dfs(r, c, i)`: out of bounds, `seen`, or wrong letter → `false`; `i === word.length - 1` → `true`; mark; try 4 directions; unmark.

%% solution
```js
export function wordSearch(board, word) {
  if (word.length === 0) return true;
  const rows = board.length;
  const cols = rows ? board[0].length : 0;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function dfs(r, c, i) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
    if (seen[r][c] || board[r][c] !== word[i]) return false;
    if (i === word.length - 1) return true;
    seen[r][c] = true;
    for (const [dr, dc] of dirs) {
      if (dfs(r + dr, c + dc, i + 1)) {
        seen[r][c] = false;
        return true;
      }
    }
    seen[r][c] = false;
    return false;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (dfs(r, c, 0)) return true;
  }
  return false;
}
```

%% exercise alg-n-queens | N-Queens: count the solutions | 4 | js | js | totalNQueens | 38
Place `n` queens on an `n × n` chessboard so that **no two attack each other** (no two share a row, column or diagonal). Return **how many different placements** exist. `totalNQueens(4)` is `2`, `totalNQueens(8)` is `92`. It must be fast: `n = 9` (352 solutions) is tested.

```js
totalNQueens(4); // 2
totalNQueens(6); // 4
```

%% worked
**A similar problem, solved: `countNonAttackingRooks(n)`** — rooks only attack along rows and columns, so one per column in each row.

```js
function countNonAttackingRooks(n) {
  const usedCols = new Set();
  function place(row) {
    if (row === n) return 1;                       // ① every row has a rook: one valid placement
    let count = 0;
    for (let col = 0; col < n; col++) {
      if (usedCols.has(col)) continue;             // ② column already attacked: prune
      usedCols.add(col);                           // ③ choose
      count += place(row + 1);                     // ④ explore the next row
      usedCols.delete(col);                        // ⑤ un-choose
    }
    return count;
  }
  return place(0);
}
```

Queens add **two diagonal families**. All squares on one `/` diagonal share the same `row + col`, and all squares on one `\` diagonal share the same `row − col`. Keep three sets (`cols`, `diag1` for `row + col`, `diag2` for `row - col`); a square is safe when none of its three values is in use. Place **one queen per row**, which handles the row rule automatically.

%% explain
- **One queen per row**: recurse row by row.
- **A square is safe** when its column, `row + col` and `row − col` are all unused.
- **Choose / un-choose** all three sets.
- **Count** one when all `n` rows are filled; `n = 2` and `n = 3` have `0`.

%% nudge
- What number identifies the diagonal a square is on, in each direction?
- Which three things must you add when placing and remove when undoing?

%% starter
```js
export function totalNQueens(n) {
  // your code
  return 0;
}
```

%% tests
```js
describe('totalNQueens', () => {
  it('counts small boards', () => {
    expect(totalNQueens(1)).toBe(1);
    expect(totalNQueens(2)).toBe(0);
    expect(totalNQueens(3)).toBe(0);
    expect(totalNQueens(4)).toBe(2);
    expect(totalNQueens(5)).toBe(10);
    expect(totalNQueens(6)).toBe(4);
  });

  it('counts larger boards', () => {
    expect(totalNQueens(7)).toBe(40);
    expect(totalNQueens(8)).toBe(92);
  });

  it('is fast: n = 9', () => {
    const t = Date.now();
    expect(totalNQueens(9)).toBe(352);
    expect(Date.now() - t).toBeLessThan(1500);
  });
});
```

%% hints
- Three `Set`s: `cols`, `diag1` (`row + col`), `diag2` (`row - col`).
- `place(row)`: if `row === n` return 1; else for each `col` not attacked, add to all three sets, add `place(row + 1)`, then delete from all three.

%% solution
```js
export function totalNQueens(n) {
  const cols = new Set();
  const diag1 = new Set();
  const diag2 = new Set();
  function place(row) {
    if (row === n) return 1;
    let count = 0;
    for (let col = 0; col < n; col++) {
      if (cols.has(col) || diag1.has(row + col) || diag2.has(row - col)) continue;
      cols.add(col);
      diag1.add(row + col);
      diag2.add(row - col);
      count += place(row + 1);
      cols.delete(col);
      diag1.delete(row + col);
      diag2.delete(row - col);
    }
    return count;
  }
  return place(0);
}
```
