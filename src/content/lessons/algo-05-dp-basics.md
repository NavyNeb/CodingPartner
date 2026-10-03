---
id: algo-dp-basics
track: algo
title: Dynamic programming I: remembering sub-answers
summary: When the same smaller problems keep recurring, solve each once and keep the answer. The four-question recipe, top-down memoisation versus bottom-up tables, and the classic one-dimensional problems: stairs, house robber, coin change, longest increasing subsequence.
---

## The idea in one sentence

**Dynamic programming (DP)** is recursion that **never solves the same subproblem twice**: solve the small versions first (or remember them as you meet them), and build the big answer out of them.

> **Analogy** Adding a long column of figures by hand and writing a **running total** on every line. You never re-add the top of the column to answer "what's the total so far?" — you read the previous line and add one number. DP is that habit applied to harder questions.

You've already met the symptom: the **naive Fibonacci call tree** recomputes `fib(2)` again and again. DP removes the repetition.

## When is a problem DP?

Two properties, together:

- **Overlapping subproblems:** the recursion asks for the *same* smaller answers repeatedly.
- **Optimal substructure:** the best answer for the whole can be built from the best answers for its parts.

Wording gives it away: *"how many ways…", "the minimum / maximum…", "is it possible…"* where each step involves a **choice** (take or skip, which coin, split here or there) — and where plain recursion would be exponential. If the question wants **every** actual solution listed, it is backtracking; if it wants a **count or best value**, think DP.

## The recipe

![The four DP questions answered for house robber](fig:alg-dp-recipe "State, recurrence, base cases, order. The same four questions every time.")

1. **State.** Say in words what `dp[i]` means. Most DP bugs are a fuzzy answer here.
2. **Recurrence.** Express `dp[i]` using *smaller* entries.
3. **Base cases.** The entries you know without thinking.
4. **Order and answer.** Fill from small to large; know which entry is the result.

## Two ways to write it

### Top-down: recursion plus a memo

Write the plain recursion, then **cache each answer** so it is computed once:

```js try
function climbStairs(n, memo = new Map()) {       // ways to climb n steps taking 1 or 2 at a time
  if (n <= 2) return n;                           // base cases: 1 way for 1 step, 2 ways for 2 steps
  if (memo.has(n)) return memo.get(n);            // seen it before? reuse the answer
  const ways = climbStairs(n - 1, memo) + climbStairs(n - 2, memo);   // last move was 1 step, or 2 steps
  memo.set(n, ways);
  return ways;
}
console.log(climbStairs(5), climbStairs(45));     // instant, instead of billions of calls
```

### Bottom-up: fill a table

Skip the recursion: fill an array from the base cases upwards, **in an order where every needed answer already exists**.

![A bottom-up Fibonacci table filled left to right](fig:alg-dp-fib-table "Each cell is built from cells to its left, which are already known.")

```js try
function climbStairsTable(n) {
  const dp = [1, 1];                              // dp[i] = ways to reach step i (dp[0] = 1: do nothing)
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];
  return dp[n];
}
console.log(climbStairsTable(45));
```

Both are **O(n)**. Bottom-up avoids recursion depth limits; top-down is easier to write when the order is awkward. Because each entry only looks back **two** steps, you can often compress memory from O(n) to O(1) by keeping just the last two values.

## Choosing among options: coin change

*"What is the fewest coins that make `amount`?"* Try every coin as the **last coin used**; the rest is a smaller, already-solved amount:

`dp[a] = 1 + min(dp[a − c])` over every coin `c ≤ a`

![The coin change table for coins 1, 2, 5, amount 11](fig:alg-dp-coin-table "Each cell takes the best of a few earlier cells, plus one coin.")

```stepper Coin change: coins [1, 2, 5], amount 11
code:
  function coinChange(coins, amount) {
    const dp = new Array(amount + 1).fill(Infinity);
    dp[0] = 0;
    for (let a = 1; a <= amount; a++) {
      for (const c of coins) {
        if (c <= a) dp[a] = Math.min(dp[a], dp[a - c] + 1);
      }
    }
    return dp[amount] === Infinity ? -1 : dp[amount];
  }
---
line: 2-3
say: `dp[a]` = fewest coins for amount `a`. Everything starts at `Infinity` ("impossible so far") except `dp[0] = 0`: zero coins make amount zero.
dp (a = 0 …): 0 | ∞ | ∞ | ∞ | ∞ | ∞
---
line: 4-7
say: `a = 1`: only coin `1` fits. `dp[1] = dp[0] + 1 = 1`.
dp (a = 0 …): 0 | 1 | ∞ | ∞ | ∞ | ∞
---
line: 4-7
say: `a = 2`: coin `1` gives `dp[1] + 1 = 2`, coin `2` gives `dp[0] + 1 = 1`. The minimum is **1**.
dp (a = 0 …): 0 | 1 | 1 | ∞ | ∞ | ∞
---
line: 4-7
say: `a = 3`: coin 1 → `dp[2] + 1 = 2`; coin 2 → `dp[1] + 1 = 2`. So `dp[3] = 2`. Then `a = 4` is `2` (two 2s).
dp (a = 0 …): 0 | 1 | 1 | 2 | 2 | ∞
---
line: 4-7
say: `a = 5`: coin 5 gives `dp[0] + 1 = 1`: a single coin. And `dp[6] = 2`, `dp[7] = 2`, … the pattern continues up to `dp[10] = 2` (5 + 5).
dp (a = 0 …): 0 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 3 | 3 | 2
---
line: 4-7
say: `a = 11`: coin 1 → `dp[10] + 1 = 3`; coin 2 → `dp[9] + 1 = 4`; coin 5 → `dp[6] + 1 = 3`. The minimum is **3** (5 + 5 + 1).
dp (a = 0 …): 0 | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 3 | 3 | 2 | 3
Result: 3
```

Why not just take the biggest coin each time (a **greedy** choice)? With coins `[1, 3, 4]` and amount `6`, greedy takes `4 + 1 + 1` (3 coins) but the best is `3 + 3` (2 coins). When a locally best choice can be wrong, you need DP. (The greedy lesson later shows when greedy *is* safe.)

## Skip or take: house robber

*"Rob houses along a street, never two neighbours; maximise the loot."* At each house you either **skip** it (keep the best so far) or **rob** it (its loot plus the best from two houses back):

`dp[i] = max(dp[i − 1], dp[i − 2] + nums[i])`

![House robber on 2, 7, 9, 3, 1](fig:alg-dp-robber "Each entry only looks back two steps, so two variables are enough.")

```js try
function rob(nums) {
  let prev2 = 0, prev1 = 0;                       // best loot two houses back / one house back
  for (const loot of nums) {
    const best = Math.max(prev1, prev2 + loot);   // skip this house, or rob it
    prev2 = prev1;
    prev1 = best;
  }
  return prev1;
}
console.log(rob([2, 7, 9, 3, 1]));   // 12
```

## Kadane's algorithm: the best run ending here

For the **maximum sum contiguous subarray**, let `dp[i]` be the best sum of a subarray **ending exactly at `i`**. Either it extends the previous one, or starts fresh at `i`:

```js try
function maxSubarray(nums) {
  let endingHere = nums[0], best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    endingHere = Math.max(nums[i], endingHere + nums[i]);   // extend the run, or start over at nums[i]
    best = Math.max(best, endingHere);
  }
  return best;
}
console.log(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]));   // 6
```

Defining the state as "**ending at** i" (rather than "somewhere in 0..i") is a trick that comes up again and again.

## Longest increasing subsequence

For `dp[i] = length of the longest increasing subsequence ending at i`, the textbook recurrence looks at every earlier smaller item: `dp[i] = 1 + max(dp[j])` for `j < i` with `nums[j] < nums[i]` — **O(n²)**. A smarter version keeps `tails[k]` = the **smallest possible last value** of an increasing subsequence of length `k + 1`, and **binary searches** where each new number belongs: **O(n log n)**. You'll write that one.

## Quick check

```check
Q: What makes naive recursion for Fibonacci slow, and what fixes it?
A) Too many variables; use a loop with no memory
B) The same subproblems are recomputed many times; remember each answer once (memoise or tabulate) *
C) Recursion itself is slow; use a queue
D) Nothing: it is already optimal
Why: fib(n) calls fib(n−1) and fib(n−2), whose subtrees overlap heavily. Storing results makes each subproblem a single computation.
---
Q: What is the first and most important step of designing a DP solution?
A) Writing the loops
B) Defining in words exactly what `dp[i]` means *
C) Choosing a language
D) Sorting the input
Why: The recurrence and base cases follow from a precise definition of the state.
---
Q: Why does greedy ("always take the biggest coin") fail for coins [1, 3, 4] and amount 6?
A) Greedy never works
B) It gives 4 + 1 + 1 (3 coins) but 3 + 3 (2 coins) is better *
C) There is no solution
D) The coins are too small
Why: The locally best move can block a better overall combination, so you must compare all options (DP).
---
Q: In house robber, why can you keep just two variables instead of a whole table?
A) The table is slower
B) `dp[i]` only depends on `dp[i − 1]` and `dp[i − 2]` *
C) The houses are sorted
D) JavaScript has no arrays
Why: Once an entry is no longer needed by later ones it can be discarded.
---
Q: What does `dp[i]` mean in Kadane's algorithm?
A) The best sum anywhere in the array
B) The best sum of a subarray that ends exactly at index i *
C) The sum of the first i items
D) The largest item up to i
Why: That definition makes the recurrence tiny: extend the previous run or start again here.
```

## Recap

- DP = recursion + **never repeat a subproblem**. It needs **overlapping subproblems** and **optimal substructure**.
- Recipe: **state**, **recurrence**, **base cases**, **order and answer**.
- **Top-down** = recursion + memo; **bottom-up** = fill a table; compress memory when only the last few entries matter.
- Classics: **climb stairs / Fibonacci**, **house robber** (skip or take), **coin change** (try every last coin), **Kadane** (best run ending here), **LIS**.
- **Greedy can be wrong** where DP is right; compare all options.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: climbing stairs | The bottom-up table: `dp[i] = dp[i−1] + dp[i−2]` |
| House robber | Skip or take: `max(dp[i−1], dp[i−2] + loot)` |
| Maximum subarray | The best run ending here (Kadane) |
| Coin change | The coin-change stepper |
| Decode ways | Take one digit, or take two digits when they make 10–26 |
| Word break | `dp[i]` = can the first `i` letters be split into words? |
| Longest increasing subsequence | `tails` plus binary search for O(n log n) |

%% exercise alg-guided-climb-stairs | Guided: climbing stairs | 1 | js | js | climbStairs | 8 | guided
You climb a staircase of `n` steps (`n >= 1`), taking **1 or 2 steps at a time**. Return the **number of distinct ways** to reach the top. (Tests keep `n` small enough that the answer fits exactly in a JavaScript number.)

```js
climbStairs(3); // 3   (1+1+1, 1+2, 2+1)
climbStairs(5); // 8
```

%% worked
**A similar problem, solved: `tribonacci(n)`** — each term is the sum of the previous *three* (0, 1, 1, 2, 4, 7, …).

```js
function tribonacci(n) {
  if (n === 0) return 0;
  const dp = [0, 1, 1];                                   // ① base cases: the first three terms
  for (let i = 3; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2] + dp[i - 3];   // ② each entry from earlier entries
  return dp[n];
}
```

For the stairs, the **last move** was either a 1-step (from step `i − 1`) or a 2-step (from step `i − 2`), so `dp[i] = dp[i − 1] + dp[i − 2]`. The base cases are `dp[1] = 1` and `dp[2] = 2`.

%% explain
- **`dp[i]`** = ways to reach step `i`.
- **Recurrence**: `dp[i] = dp[i − 1] + dp[i − 2]`.
- **Base cases**: `dp[1] = 1`, `dp[2] = 2`.
- **Linear**: a naive recursion would take exponential time.

%% nudge
- How can the last move onto step `i` have been made?
- What are the answers for 1 and 2 steps?

%% starter
```js
export function climbStairs(n) {
  // Step 1 — if n <= 2, the answer is n.
  // Step 2 — dp[1] = 1, dp[2] = 2.
  // Step 3 — for i from 3 to n: dp[i] = dp[i - 1] + dp[i - 2].
  // Step 4 — return dp[n].
  return 0;
}
```

%% tests
```js
describe('climbStairs', () => {
  it('counts small staircases', () => {
    expect(climbStairs(1)).toBe(1);
    expect(climbStairs(2)).toBe(2);
    expect(climbStairs(3)).toBe(3);
    expect(climbStairs(4)).toBe(5);
    expect(climbStairs(5)).toBe(8);
    expect(climbStairs(10)).toBe(89);
  });

  it('handles bigger staircases quickly (no exponential recursion)', () => {
    expect(climbStairs(45)).toBe(1836311903);
    expect(climbStairs(70)).toBe(308061521170129);
  });
});
```

%% hints
- `let a = 1, b = 2;` (ways for steps 1 and 2); loop `i` from 3 to `n`, doing `[a, b] = [b, a + b]`; return `b` (or `n` when `n <= 2`).

%% solution
```js
export function climbStairs(n) {
  if (n <= 2) return n;
  let a = 1;
  let b = 2;
  for (let i = 3; i <= n; i++) [a, b] = [b, a + b];
  return b;
}
```

%% exercise alg-house-robber | House robber | 2 | js | js | rob | 14
`nums[i]` is the money in house `i`. You can't rob **two adjacent houses**. Return the **maximum** you can take. An empty street gives `0`. It must be **O(n)**: a million houses are tested.

```js
rob([2, 7, 9, 3, 1]); // 12   (2 + 9 + 1)
```

%% worked
**A similar problem, solved: `maxNonAdjacentCount(flags)`** — how many `1`s can you pick if no two picked ones are neighbours?

```js
function maxNonAdjacentCount(flags) {
  let skip = 0, take = 0;                      // ① best count if the previous item was skipped / taken
  for (const f of flags) {
    const nextTake = skip + (f ? 1 : 0);       // ② taking this item requires the previous one skipped
    const nextSkip = Math.max(skip, take);     // ③ skipping lets the previous be either
    take = nextTake;
    skip = nextSkip;
  }
  return Math.max(skip, take);
}
```

For `rob`: at each house the best total is the better of **skipping** it (`prev1`, the best up to the previous house) or **robbing** it (`prev2 + loot`, the best up to two houses back). Roll two variables forward.

%% explain
- **State**: best loot using the houses up to here.
- **Recurrence**: `max(skip, rob)`.
- **Constant memory**: two variables.
- **Empty or single street** handled by the initial zeros.

%% nudge
- If you rob this house, which earlier total can you add its loot to?
- Which two numbers do you need to remember?

%% starter
```js
export function rob(nums) {
  // your code
  return 0;
}
```

%% tests
```js
describe('rob', () => {
  it('maximises non-adjacent loot', () => {
    expect(rob([1, 2, 3, 1])).toBe(4);
    expect(rob([2, 7, 9, 3, 1])).toBe(12);
    expect(rob([2, 1, 1, 2])).toBe(4);
  });

  it('handles empty, one and two houses', () => {
    expect(rob([])).toBe(0);
    expect(rob([5])).toBe(5);
    expect(rob([3, 9])).toBe(9);
  });

  it('prefers a single big house when needed', () => {
    expect(rob([1, 100, 1])).toBe(100);
    expect(rob([100, 1, 1, 100])).toBe(200);
  });

  it('matches brute force on random streets', () => {
    let seed = 2;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 20;
    for (let round = 0; round < 40; round++) {
      const nums = Array.from({ length: 1 + (round % 12) }, rand);
      let best = 0;
      for (let mask = 0; mask < 1 << nums.length; mask++) {
        if (mask & (mask >> 1)) continue;
        let s = 0;
        for (let i = 0; i < nums.length; i++) if (mask & (1 << i)) s += nums[i];
        best = Math.max(best, s);
      }
      expect(rob(nums)).toBe(best);
    }
  });

  it('is linear: a million houses', () => {
    const nums = Array.from({ length: 1000000 }, (_, i) => i % 10);
    const t = Date.now();
    expect(rob(nums)).toBeGreaterThan(1000000);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- `let prev2 = 0, prev1 = 0;` then for each `loot`: `const best = Math.max(prev1, prev2 + loot); prev2 = prev1; prev1 = best;`. Return `prev1`.

%% solution
```js
export function rob(nums) {
  let prev2 = 0;
  let prev1 = 0;
  for (const loot of nums) {
    const best = Math.max(prev1, prev2 + loot);
    prev2 = prev1;
    prev1 = best;
  }
  return prev1;
}
```

%% exercise alg-max-subarray | Maximum subarray | 2 | js | js | maxSubarray | 14
Return the **largest sum of a non-empty contiguous subarray** of `nums` (which may contain negative numbers). It must be **O(n)**: a million items are tested.

```js
maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]); // 6   ([4, -1, 2, 1])
maxSubarray([-3, -1, -2]);                    // -1  (the subarray must not be empty)
```

%% worked
**A similar problem, solved: `longestRunOfPositives(nums)`** — the length of the longest streak of positive numbers ending at each point.

```js
function longestRunOfPositives(nums) {
  let endingHere = 0, best = 0;
  for (const x of nums) {
    endingHere = x > 0 ? endingHere + 1 : 0;     // ① extend the streak, or reset it
    best = Math.max(best, endingHere);           // ② remember the best streak so far
  }
  return best;
}
```

Same structure with sums: `endingHere` is the best sum of a subarray **ending at the current item**. It is either the current item alone (start fresh, when the old run was a loss) or `endingHere + x` (extend it): `endingHere = max(x, endingHere + x)`. `best` tracks the maximum seen.

%% explain
- **Non-empty**: an all-negative array returns its largest (least negative) item.
- **`endingHere`** = best sum of a subarray ending here.
- **Extend or restart**: `max(x, endingHere + x)`.
- **Linear time, O(1) memory**.

%% nudge
- When is it better to start a new subarray at the current item?
- Why initialise with `nums[0]` rather than `0`?

%% starter
```js
export function maxSubarray(nums) {
  // your code
  return 0;
}
```

%% tests
```js
describe('maxSubarray', () => {
  it('finds the best run', () => {
    expect(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4])).toBe(6);
    expect(maxSubarray([5, 4, -1, 7, 8])).toBe(23);
    expect(maxSubarray([1])).toBe(1);
  });

  it('handles all-negative arrays', () => {
    expect(maxSubarray([-3, -1, -2])).toBe(-1);
    expect(maxSubarray([-5])).toBe(-5);
  });

  it('handles zeros and mixed signs', () => {
    expect(maxSubarray([0, 0, 0])).toBe(0);
    expect(maxSubarray([-1, 0, -2])).toBe(0);
    expect(maxSubarray([2, -1, 2, -1, 2])).toBe(4);
  });

  it('matches brute force on random arrays', () => {
    let seed = 13;
    const rand = () => ((seed = (seed * 48271) % 2147483647) % 21) - 10;
    for (let round = 0; round < 40; round++) {
      const nums = Array.from({ length: 1 + (round % 15) }, rand);
      let best = -Infinity;
      for (let i = 0; i < nums.length; i++) { let s = 0; for (let j = i; j < nums.length; j++) { s += nums[j]; best = Math.max(best, s); } }
      expect(maxSubarray(nums)).toBe(best);
    }
  });

  it('is linear: a million items', () => {
    const nums = Array.from({ length: 1000000 }, (_, i) => (i % 7) - 3);
    const t = Date.now();
    expect(maxSubarray(nums)).toBeGreaterThan(0);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- `let endingHere = nums[0], best = nums[0];`
- For `i >= 1`: `endingHere = Math.max(nums[i], endingHere + nums[i]); best = Math.max(best, endingHere);`

%% solution
```js
export function maxSubarray(nums) {
  let endingHere = nums[0];
  let best = nums[0];
  for (let i = 1; i < nums.length; i++) {
    endingHere = Math.max(nums[i], endingHere + nums[i]);
    if (endingHere > best) best = endingHere;
  }
  return best;
}
```

%% exercise alg-coin-change | Coin change | 3 | js | js | coinChange | 24
Given distinct coin values and an `amount`, return the **fewest coins** that make exactly `amount`, or `-1` if it is impossible. You have an unlimited supply of each coin. An amount of `0` needs `0` coins. It must be **O(amount × coins)**.

```js
coinChange([1, 2, 5], 11); // 3   (5 + 5 + 1)
coinChange([2], 3);        // -1
```

%% worked
**A similar problem, solved: `countWays(coins, amount)`** — how many *combinations* make the amount.

```js
function countWays(coins, amount) {
  const ways = new Array(amount + 1).fill(0);
  ways[0] = 1;                                   // ① one way to make 0: use no coins
  for (const c of coins) {
    for (let a = c; a <= amount; a++) ways[a] += ways[a - c];   // ② ways to make a that end with coin c
  }
  return ways[amount];
}
```

For the **minimum**, `dp[a]` holds the fewest coins for amount `a`: start with `Infinity` ("not reachable") and `dp[0] = 0`. For each amount, try every coin as the last coin: `dp[a] = min(dp[a], dp[a − c] + 1)`. If `dp[amount]` is still `Infinity`, return `-1`.

%% explain
- **`dp[a]`** = fewest coins for amount `a`; `Infinity` = impossible so far.
- **Recurrence**: `1 + min(dp[a − c])` over coins `c ≤ a`.
- **`dp[0] = 0`**.
- **Return `-1`** if `dp[amount]` stayed `Infinity`.

%% nudge
- Why must the table start at `Infinity` rather than `0`?
- Which entries does `dp[a]` look at?

%% starter
```js
export function coinChange(coins, amount) {
  // your code
  return -1;
}
```

%% tests
```js
describe('coinChange', () => {
  it('finds the fewest coins', () => {
    expect(coinChange([1, 2, 5], 11)).toBe(3);
    expect(coinChange([1, 3, 4], 6)).toBe(2);
    expect(coinChange([186, 419, 83, 408], 6249)).toBe(20);
  });

  it('returns -1 when impossible', () => {
    expect(coinChange([2], 3)).toBe(-1);
    expect(coinChange([5, 10], 3)).toBe(-1);
    expect(coinChange([], 5)).toBe(-1);
  });

  it('handles an amount of 0 and a single exact coin', () => {
    expect(coinChange([1], 0)).toBe(0);
    expect(coinChange([7], 7)).toBe(1);
    expect(coinChange([7], 14)).toBe(2);
  });

  it('beats greedy where greedy fails', () => {
    expect(coinChange([1, 5, 6, 9], 11)).toBe(2);
  });

  it('is fast: amount 100 000', () => {
    const t = Date.now();
    expect(coinChange([1, 5, 10, 25, 50], 100000)).toBe(2000);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `const dp = new Array(amount + 1).fill(Infinity); dp[0] = 0;`
- Loop `a` from 1 to `amount`, and for each `c` with `c <= a`: `dp[a] = Math.min(dp[a], dp[a - c] + 1)`.

%% solution
```js
export function coinChange(coins, amount) {
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;
  for (let a = 1; a <= amount; a++) {
    for (const c of coins) {
      if (c <= a && dp[a - c] + 1 < dp[a]) dp[a] = dp[a - c] + 1;
    }
  }
  return dp[amount] === Infinity ? -1 : dp[amount];
}
```

%% exercise alg-decode-ways | Decode ways | 3 | js | js | numDecodings | 22
A message of letters is encoded as digits: `'A' = 1`, `'B' = 2`, …, `'Z' = 26`. Given a **non-empty string of digits**, return **how many ways** it can be decoded. A leading `0` can't stand alone (`'06'` is invalid). Return `0` when there's no valid decoding.

```js
numDecodings('12');  // 2   ("AB" as 1,2 or "L" as 12)
numDecodings('226'); // 3   (2,2,6 | 22,6 | 2,26)
numDecodings('06');  // 0
```

%% worked
**A similar problem, solved: `splitIntoOneOrTwo(n)`** — in how many ways can you write `n` as an ordered sum of 1s and 2s? (It's the stairs again.)

```js
function splitIntoOneOrTwo(n) {
  const dp = [1, 1];                                       // ① dp[i] = ways to write i
  for (let i = 2; i <= n; i++) dp[i] = dp[i - 1] + dp[i - 2];   // ② last piece was a 1, or a 2
  return dp[n];
}
```

Decoding is that with **rules**: `dp[i]` = ways to decode the first `i` digits. The last letter used **one digit** (valid if `s[i − 1]` isn't `'0'`: add `dp[i − 1]`) and/or **two digits** (valid if `s[i − 2..i)` is between 10 and 26: add `dp[i − 2]`). Start with `dp[0] = 1`.

%% explain
- **One digit** `1`–`9` is valid; `'0'` alone is not.
- **Two digits** `10`–`26` are valid.
- **`dp[0] = 1`**: the empty prefix has one decoding.
- **Answer** is `dp[n]`; `0` when stuck.

%% nudge
- When the last digit is `'0'`, which option is gone?
- For the two-digit option, what range of values counts?

%% starter
```js
export function numDecodings(s) {
  // your code
  return 0;
}
```

%% tests
```js
describe('numDecodings', () => {
  it('counts decodings', () => {
    expect(numDecodings('12')).toBe(2);
    expect(numDecodings('226')).toBe(3);
    expect(numDecodings('11106')).toBe(2);
  });

  it('handles zeros', () => {
    expect(numDecodings('06')).toBe(0);
    expect(numDecodings('0')).toBe(0);
    expect(numDecodings('10')).toBe(1);
    expect(numDecodings('100')).toBe(0);
    expect(numDecodings('2101')).toBe(1);
  });

  it('handles values above 26', () => {
    expect(numDecodings('27')).toBe(1);
    expect(numDecodings('99')).toBe(1);
  });

  it('handles single digits', () => {
    expect(numDecodings('1')).toBe(1);
    expect(numDecodings('9')).toBe(1);
  });

  it('is linear and matches a Fibonacci pattern', () => {
    const t = Date.now();
    expect(numDecodings('1'.repeat(40))).toBe(165580141);
    expect(numDecodings('1'.repeat(100000)) >= 0).toBe(true);
    expect(Date.now() - t).toBeLessThan(600);
  });
});
```

%% hints
- `dp[0] = 1`; `dp[1] = s[0] === '0' ? 0 : 1`.
- For `i` from 2: if `s[i - 1] !== '0'` add `dp[i - 1]`; let `two = Number(s.slice(i - 2, i))`; if `two >= 10 && two <= 26` add `dp[i - 2]`.

%% solution
```js
export function numDecodings(s) {
  const n = s.length;
  let prev2 = 1;                              // dp[i - 2]
  let prev1 = s[0] === '0' ? 0 : 1;           // dp[i - 1]
  for (let i = 2; i <= n; i++) {
    let cur = 0;
    if (s[i - 1] !== '0') cur += prev1;
    const two = Number(s.slice(i - 2, i));
    if (two >= 10 && two <= 26) cur += prev2;
    prev2 = prev1;
    prev1 = cur;
  }
  return prev1;
}
```

%% exercise alg-word-break | Word break | 3 | js | js | wordBreak | 24
Given a string `s` and an array of words `wordDict`, return whether `s` can be **split into a sequence of dictionary words** (words may be reused). It must be fast on adversarial input: `'a'` repeated 3 000 times followed by `'b'` with the words `['a', 'aa', 'aaa']` is tested, where plain recursion without memory takes forever.

```js
wordBreak('leetcode', ['leet', 'code']);            // true
wordBreak('catsandog', ['cats', 'dog', 'sand', 'and', 'cat']); // false
```

%% worked
**A similar problem, solved: `canMakeLength(n, pieces)`** — can you reach exactly length `n` by adding pieces of the given sizes?

```js
function canMakeLength(n, pieces) {
  const ok = new Array(n + 1).fill(false);
  ok[0] = true;                                       // ① length 0: use nothing
  for (let len = 1; len <= n; len++) {
    for (const p of pieces) if (p <= len && ok[len - p]) { ok[len] = true; break; }   // ② the last piece fits after a reachable length
  }
  return ok[n];
}
```

Words work the same: `dp[i]` = "can the first `i` characters be split?". `dp[0] = true`. For each end `i`, look for a start `j < i` where `dp[j]` is true **and** `s.slice(j, i)` is a word (use a `Set`). Only try words up to the longest dictionary word's length so each end costs at most that many checks.

%% explain
- **`dp[i]`** = the first `i` characters can be split into words.
- **`dp[0] = true`**.
- **`dp[i]`** is true if some `j < i` has `dp[j]` and `s.slice(j, i)` is in the dictionary.
- **Limit `j`** to the longest word length for speed.

%% nudge
- What does it mean for `dp[j]` to be true and the rest `s.slice(j, i)` to be a word?
- How can you avoid checking start positions that are too far back?

%% starter
```js
export function wordBreak(s, wordDict) {
  // your code
  return false;
}
```

%% tests
```js
describe('wordBreak', () => {
  it('splits into dictionary words', () => {
    expect(wordBreak('leetcode', ['leet', 'code'])).toBe(true);
    expect(wordBreak('applepenapple', ['apple', 'pen'])).toBe(true);
  });

  it('rejects impossible splits', () => {
    expect(wordBreak('catsandog', ['cats', 'dog', 'sand', 'and', 'cat'])).toBe(false);
    expect(wordBreak('abc', ['ab'])).toBe(false);
  });

  it('handles an empty string and an empty dictionary', () => {
    expect(wordBreak('', ['a'])).toBe(true);
    expect(wordBreak('a', [])).toBe(false);
  });

  it('reuses words and handles overlapping words', () => {
    expect(wordBreak('aaaaaaa', ['aaaa', 'aaa'])).toBe(true);
    expect(wordBreak('cars', ['car', 'ca', 'rs'])).toBe(true);
  });

  it('is fast on adversarial input', () => {
    const s = 'a'.repeat(3000) + 'b';
    const t = Date.now();
    expect(wordBreak(s, ['a', 'aa', 'aaa'])).toBe(false);
    expect(wordBreak('a'.repeat(3000), ['a', 'aa', 'aaa'])).toBe(true);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- `const words = new Set(wordDict); const maxLen = Math.max(0, ...wordDict.map((w) => w.length));`
- `dp[0] = true`; for `i` from 1 to `n`, for `j` from `i - 1` down to `max(0, i - maxLen)`: if `dp[j] && words.has(s.slice(j, i))` set `dp[i] = true` and stop.

%% solution
```js
export function wordBreak(s, wordDict) {
  const words = new Set(wordDict);
  let maxLen = 0;
  for (const w of wordDict) if (w.length > maxLen) maxLen = w.length;
  const n = s.length;
  const dp = new Array(n + 1).fill(false);
  dp[0] = true;
  for (let i = 1; i <= n; i++) {
    for (let j = i - 1; j >= Math.max(0, i - maxLen); j--) {
      if (dp[j] && words.has(s.slice(j, i))) {
        dp[i] = true;
        break;
      }
    }
  }
  return dp[n];
}
```

%% exercise alg-lis | Longest increasing subsequence | 4 | js | js | lengthOfLIS | 38
Return the length of the **longest strictly increasing subsequence** of `nums` (items need not be adjacent, but keep their order). It must be **O(n log n)**: 100 000 items are tested, where the O(n²) table is far too slow.

```js
lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18]); // 4   (2, 3, 7, 18)
```

%% worked
**A similar problem, solved: `lengthOfLISQuadratic(nums)`** — the textbook O(n²) table, to see the idea first.

```js
function lengthOfLISQuadratic(nums) {
  const dp = new Array(nums.length).fill(1);                // ① dp[i] = longest increasing run ENDING at i
  let best = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < i; j++) if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1);   // ② extend any smaller earlier run
    best = Math.max(best, dp[i]);
  }
  return best;
}
```

The fast version keeps `tails`: `tails[k]` = the **smallest possible last value** of an increasing subsequence of length `k + 1`. It is always **sorted**, so for each new number `x`, **binary search** the first `tails[k] >= x` and overwrite it with `x` (a smaller ending value is always better), or append `x` if it is larger than everything. The length of `tails` at the end is the answer (it does not store the actual subsequence).

%% explain
- **Strictly increasing**: equal values don't extend.
- **`tails`** stays sorted; `x` replaces the first element `>= x`, or is appended.
- **Answer** = `tails.length`.
- **O(n log n)**: one binary search per item.

%% nudge
- Why is replacing a tail with a smaller value never harmful?
- Which binary search do you need: first element `>= x`, or `> x`?

%% starter
```js
export function lengthOfLIS(nums) {
  // your code
  return 0;
}
```

%% tests
```js
describe('lengthOfLIS', () => {
  it('finds the length', () => {
    expect(lengthOfLIS([10, 9, 2, 5, 3, 7, 101, 18])).toBe(4);
    expect(lengthOfLIS([0, 1, 0, 3, 2, 3])).toBe(4);
  });

  it('requires strictly increasing values', () => {
    expect(lengthOfLIS([7, 7, 7, 7])).toBe(1);
    expect(lengthOfLIS([1, 2, 2, 3])).toBe(3);
  });

  it('handles empty, single and decreasing arrays', () => {
    expect(lengthOfLIS([])).toBe(0);
    expect(lengthOfLIS([5])).toBe(1);
    expect(lengthOfLIS([5, 4, 3, 2, 1])).toBe(1);
  });

  it('matches the O(n²) table on random arrays', () => {
    let seed = 21;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 30;
    for (let round = 0; round < 40; round++) {
      const nums = Array.from({ length: 1 + (round % 25) }, rand);
      const dp = new Array(nums.length).fill(1);
      let best = 0;
      for (let i = 0; i < nums.length; i++) { for (let j = 0; j < i; j++) if (nums[j] < nums[i]) dp[i] = Math.max(dp[i], dp[j] + 1); best = Math.max(best, dp[i]); }
      expect(lengthOfLIS(nums)).toBe(best);
    }
  });

  it('is O(n log n): 100 000 items', () => {
    const inc = Array.from({ length: 100000 }, (_, i) => i);
    const mixed = Array.from({ length: 100000 }, (_, i) => (i * 7919) % 100003);
    const t = Date.now();
    expect(lengthOfLIS(inc)).toBe(100000);
    expect(lengthOfLIS(mixed)).toBeGreaterThan(100);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- `const tails = [];` For each `x`: binary search `lo = 0, hi = tails.length` for the first index with `tails[idx] >= x`.
- If `idx === tails.length` push `x`, otherwise `tails[idx] = x`. Return `tails.length`.

%% solution
```js
export function lengthOfLIS(nums) {
  const tails = [];
  for (const x of nums) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    if (lo === tails.length) tails.push(x);
    else tails[lo] = x;
  }
  return tails.length;
}
```
