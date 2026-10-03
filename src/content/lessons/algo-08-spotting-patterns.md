---
id: algo-spotting
track: algo
title: Spotting the pattern
summary: The skill that ties the track together: reading a problem for signals, using the constraints to guess the intended complexity, climbing from brute force to the right pattern, and combining patterns in one solution.
---

## The idea in one sentence

Most interview problems are **a familiar pattern in a new costume** — so the real skill is **recognising the costume**: reading the statement for signals, using the limits to guess the intended speed, and starting from the brute force you can already write.

> **Analogy** A mechanic hears a noise and, from *when* it happens and *what it sounds like*, narrows the cause to two or three suspects before opening the bonnet. Pattern spotting is the same: you rarely derive an algorithm from scratch; you narrow the suspects and test them against an example.

## Step 1: listen for signals

![Signals in a problem statement and the pattern they suggest](fig:alg-pattern-signals "A signal is a hint, not a proof. Confirm with a small example before you commit.")

A few cues deserve special attention:

- **Sorted** or **"can I sort it?"** → two pointers, binary search, sort-then-scan.
- **Contiguous** (subarray, substring) with "longest/shortest/at most" → **sliding window**; with sums that may be negative → **prefix sums + hash map**.
- **"List every…"** → backtracking. **"How many ways…" / "minimum cost…"** → **DP**.
- **"Fewest steps"** on a grid or graph → **BFS**. "Next smallest / top K" → **heap**.
- **Intervals** → sort, then sweep or greedy.

## Step 2: read the constraints

The size limits are a free hint about the intended solution:

![Input size and the time complexity you can afford](fig:alg-constraints "Roughly 10⁸ simple steps per second. A limit of 100 000 means O(n²) is out.")

`n ≤ 20` practically **announces** backtracking or bitmasks. `n ≤ 10⁵` tells you to avoid nested loops. `n` as large as `10⁹` means you can't even loop over it: think **binary search on the answer** or a formula.

## Step 3: brute force first, then remove the repetition

Always start by saying the **simplest correct solution** out loud and its cost. Then ask **"what work does this repeat?"** — the answer names the pattern.

![Two problems climbing from brute force to an efficient pattern](fig:alg-brute-to-pattern "The repetition in the brute force is what the pattern removes.")

- Re-checking substrings from scratch → **sliding window** keeps what's still valid.
- Re-scanning for a partner value → **hash map** remembers what you've seen.
- Re-summing a range → **prefix sums**.
- Re-solving the same sub-situation → **memoise / DP**.
- Re-sorting or re-finding the minimum → **heap**.

```js try
// "Does the array contain two equal values within k positions of each other?"
function bruteForce(nums, k) {
  for (let i = 0; i < nums.length; i++)
    for (let j = i + 1; j <= i + k && j < nums.length; j++)
      if (nums[i] === nums[j]) return true;        // repeats work: re-scans the same neighbours for every i
  return false;
}
function windowed(nums, k) {
  const window = new Set();                         // only the last k values: a sliding window of "what I still care about"
  for (let i = 0; i < nums.length; i++) {
    if (window.has(nums[i])) return true;
    window.add(nums[i]);
    if (window.size > k) window.delete(nums[i - k]);
  }
  return false;
}
console.log(bruteForce([1, 2, 3, 1], 3), windowed([1, 2, 3, 1], 3), windowed([1, 2, 3, 1, 2, 3], 2));
```

## Combining patterns

Real problems often need **two** ideas working together. A few frequent pairs:

| Combination | Example |
| --- | --- |
| Sort + two pointers | 3-sum |
| Sliding window + hash map (counts) | longest substring with at most K distinct letters |
| Prefix sums + hash map | subarrays whose sum is divisible by K |
| Heap + sorting / quickselect | the K points closest to the origin |
| BFS + hash set (visited) + string manipulation | word ladder |
| Greedy + counting | task scheduling with cool-down |

```stepper 3-sum: sort, then two pointers, with duplicate skipping
code:
  function threeSum(nums) {
    nums = nums.slice().sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < nums.length - 2; i++) {
      if (i > 0 && nums[i] === nums[i - 1]) continue;
      let lo = i + 1, hi = nums.length - 1;
      while (lo < hi) {
        const sum = nums[i] + nums[lo] + nums[hi];
        if (sum === 0) {
          out.push([nums[i], nums[lo], nums[hi]]);
          lo++; hi--;
          while (lo < hi && nums[lo] === nums[lo - 1]) lo++;
        } else if (sum < 0) lo++;
        else hi--;
      }
    }
    return out;
  }
---
line: 2
say: **Sort first** so two pointers can reason about "too big / too small". `[-1, 0, 1, 2, -1, -4]` becomes `[-4, -1, -1, 0, 1, 2]`.
sorted: -4 | -1 | -1 | 0 | 1 | 2
---
line: 4-8
say: Fix the **anchor** `i = 0` (`-4`) and look for two numbers summing to `+4` among the rest with `lo` and `hi`. The biggest possible pair is `1 + 2 = 3`, so even that is too small: the pointers only slide towards each other with a negative sum and **no triple** is found.
anchor: -4
sum: -3
found: (none)
---
line: 4-10
say: Anchor `i = 1` (`-1`): `lo` at the next `-1`, `hi` at `2`. Sum `-1 + -1 + 2 = 0`: **record** `[-1, -1, 2]`, then move both pointers inward.
anchor: -1
sum: 0
found: [-1,-1,2]
---
line: 8-11
say: Now `lo` at `0`, `hi` at `1`: `-1 + 0 + 1 = 0`. **Record** `[-1, 0, 1]`. The pointers cross: this anchor is finished.
sum: 0
found: [-1,-1,2] [-1,0,1]
---
line: 5
say: Anchor `i = 2` is another `-1`: the same value as the previous anchor. Anything it could find was already found, so **skip it**. (Skipping equal anchors, and equal `lo` values after a hit, is what stops duplicate triples.)
anchor: -1 (skipped)
---
line: 4-14
say: Anchor `i = 3` (`0`): `lo` at `1`, `hi` at `2`, sum `3` is too big, so `hi--`. The pointers cross. The loop ends.
anchor: 0
sum: 3
Result: [[-1,-1,2],[-1,0,1]]
```

The cost is **O(n²)**: an outer loop over anchors times a linear two-pointer pass, after an O(n log n) sort. That matches `n ≤ 5 000`-style limits.

## Edge cases checklist

Before you call it done, run the same short list every time: **empty input**, **one item**, **all items equal**, **negatives and zeros**, **duplicates**, **already sorted / reverse sorted**, **the maximum size**. Each of the earlier lessons' exercises hid a trap from this list.

## Quick check

```check
Q: A problem says n ≤ 100 000 and the obvious solution has two nested loops over the input. What should you conclude?
A) It is fine; computers are fast
B) The intended solution is probably O(n log n) or O(n): look for a sort, hash map, heap, window or similar *
C) Use recursion instead
D) Reduce n
Why: Nested loops over 100 000 items are about 10¹⁰ steps, far beyond roughly 10⁸ per second.
---
Q: "Longest substring with at most K distinct characters" most suggests which pattern?
A) Backtracking
B) Sliding window with a count map *
C) BFS
D) Heap
Why: A contiguous run with an "at most" condition that you can restore by shrinking from the left is a variable-size window.
---
Q: After stating the brute force, what question helps you find the pattern?
A) How can I make it shorter?
B) What work does it repeat? *
C) What language is best?
D) How many lines is it?
Why: The repeated work names the fix: recomputed ranges → prefix sums, re-scanned partners → hash map, shrinking validity → window, repeated subproblems → DP.
---
Q: Why does 3-sum skip an anchor equal to the previous anchor?
A) To save memory
B) Every triple it could find was already found, so it would only add duplicates *
C) The array is sorted
D) Pointers can't start there
Why: Equal anchors explore identical remaining sets; skipping keeps results unique without a Set.
---
Q: `n ≤ 20` in the constraints most often means…
A) Use a linear scan
B) An exponential approach such as backtracking or bitmasks is intended *
C) Use binary search
D) The problem is a trick
Why: Exponential growth is affordable only for very small n, and problem setters pick tiny limits on purpose.
```

## Recap

- **Pattern spotting** = signals + constraints + brute force: say the simple solution, then ask what it repeats.
- **Signals** map to patterns (sorted → pointers/binary search; contiguous → window/prefix sums; "all" → backtracking; counts/min/max → DP; fewest steps → BFS; top K → heap; intervals → sort and sweep).
- **Limits** point at the intended complexity: ≤ 20 exponential, ≤ 5 000 quadratic, ≤ 10⁵ `n log n`, ≤ 10⁶ linear.
- **Combine** patterns when one isn't enough (sort + pointers, window + map, prefix sums + map, BFS + set).
- Finish with the **edge-case checklist**.

## Before you start the exercises

| Exercise | Pattern(s) to try |
| --- | --- |
| Guided: nearby duplicates | The `windowed` snippet: a window of the last k values in a `Set` |
| 3-sum | Sort + two pointers + skip duplicates (the stepper) |
| K distinct characters | Sliding window with counts in a `Map` |
| Subarrays divisible by K | Prefix sums + a `Map` of remainders |
| K closest points | A max-heap of size k (or quickselect) |
| Task scheduler | Greedy: the busiest task sets the frame |
| Word ladder | BFS over words, trying every one-letter change |

%% exercise alg-guided-nearby-duplicate | Guided: nearby duplicates | 1 | js | js | containsNearbyDuplicate | 8 | guided
Return `true` if the array has **two equal values at positions at most `k` apart** (`nums[i] === nums[j]` with `i ≠ j` and `|i − j| <= k`). It must be **O(n)**: a million items are tested.

```js
containsNearbyDuplicate([1, 2, 3, 1], 3); // true
containsNearbyDuplicate([1, 2, 3, 1, 2, 3], 2); // false
```

%% worked
**A similar problem, solved: `firstRepeatWithin(items, k)`** — the *index* of the first item that repeats a value from the previous `k` items.

```js
function firstRepeatWithin(items, k) {
  const recent = new Set();                       // ① only the last k values
  for (let i = 0; i < items.length; i++) {
    if (recent.has(items[i])) return i;           // ② seen within the window: found it
    recent.add(items[i]);
    if (recent.size > k) recent.delete(items[i - k]);   // ③ slide the window: the oldest value falls out
  }
  return -1;
}
```

Same structure for the guided problem: the `Set` holds exactly the values among the last `k` positions, so a membership test is the whole check.

%% explain
- **Window** = the previous `k` items, stored in a `Set`.
- **Duplicate in the window** → `true`.
- **`k = 0`** means no two different positions qualify: always `false`.
- **Linear time**.

%% nudge
- When the window is full, which value must you remove as you add a new one?
- Why does `k = 0` give `false`?

%% starter
```js
export function containsNearbyDuplicate(nums, k) {
  // Step 1 — const window = new Set();
  // Step 2 — for each i: if window.has(nums[i]) return true; window.add(nums[i]).
  // Step 3 — if window.size > k, delete nums[i - k].
  // Step 4 — after the loop, return false.
  return false;
}
```

%% tests
```js
describe('containsNearbyDuplicate', () => {
  it('finds nearby duplicates', () => {
    expect(containsNearbyDuplicate([1, 2, 3, 1], 3)).toBe(true);
    expect(containsNearbyDuplicate([1, 0, 1, 1], 1)).toBe(true);
  });

  it('rejects duplicates that are too far apart', () => {
    expect(containsNearbyDuplicate([1, 2, 3, 1, 2, 3], 2)).toBe(false);
    expect(containsNearbyDuplicate([1, 2, 3, 1], 2)).toBe(false);
  });

  it('handles k = 0, empty and single-item arrays', () => {
    expect(containsNearbyDuplicate([1, 1], 0)).toBe(false);
    expect(containsNearbyDuplicate([], 3)).toBe(false);
    expect(containsNearbyDuplicate([5], 3)).toBe(false);
  });

  it('handles a window larger than the array', () => {
    expect(containsNearbyDuplicate([7, 8, 7], 100)).toBe(true);
  });

  it('is linear: a million items', () => {
    const nums = Array.from({ length: 1000000 }, (_, i) => i);
    const t = Date.now();
    expect(containsNearbyDuplicate(nums, 1000)).toBe(false);
    nums[999999] = 999000;
    expect(containsNearbyDuplicate(nums, 1000)).toBe(true);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `if (window.has(nums[i])) return true; window.add(nums[i]); if (window.size > k) window.delete(nums[i - k]);`

%% solution
```js
export function containsNearbyDuplicate(nums, k) {
  const window = new Set();
  for (let i = 0; i < nums.length; i++) {
    if (window.has(nums[i])) return true;
    window.add(nums[i]);
    if (window.size > k) window.delete(nums[i - k]);
  }
  return false;
}
```

%% exercise alg-three-sum | 3-sum | 3 | js | js | threeSum | 28
Return all **unique triplets** `[a, b, c]` in `nums` with `a + b + c === 0`. Each triplet uses three **different positions** (equal values may repeat, like `[-1, -1, 2]`) and no triplet may appear twice (order inside a triplet and order of the result don't matter). Don't modify the input. It must be **O(n²)**: 2 000 numbers are tested.

```js
threeSum([-1, 0, 1, 2, -1, -4]); // [[-1, -1, 2], [-1, 0, 1]]
```

%% worked
**A similar problem, solved: `pairsSummingTo(sorted, target)`** — all unique pairs in a sorted array, skipping duplicates.

```js
function pairsSummingTo(sorted, target) {
  const out = [];
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const sum = sorted[lo] + sorted[hi];
    if (sum === target) {
      out.push([sorted[lo], sorted[hi]]);
      lo++; hi--;
      while (lo < hi && sorted[lo] === sorted[lo - 1]) lo++;     // ① skip equal values after a hit: no duplicate pairs
    } else if (sum < target) lo++;
    else hi--;
  }
  return out;
}
```

3-sum is that, **once per anchor**: sort, loop `i` (skipping an anchor equal to the previous one), and run the two-pointer pair search on `(i + 1 … n − 1)` for the target `−nums[i]`.

%% explain
- **Sort a copy**.
- **Anchor `i`**; two pointers `lo = i + 1`, `hi = n − 1`.
- **Skip duplicate anchors**, and after a hit **skip equal `lo` values**.
- **Result** triplets are unique.

%% nudge
- Why does sorting let two pointers work here?
- Where do duplicate triplets come from, and which two `continue`/`while` lines stop them?

%% starter
```js
export function threeSum(nums) {
  // your code
  return [];
}
```

%% tests
```js
const norm = (r) => r.map((t) => JSON.stringify(t.slice().sort((a, b) => a - b))).sort();

describe('threeSum', () => {
  it('finds unique triplets', () => {
    expect(norm(threeSum([-1, 0, 1, 2, -1, -4]))).toEqual(norm([[-1, -1, 2], [-1, 0, 1]]));
    expect(norm(threeSum([-2, 0, 1, 1, 2]))).toEqual(norm([[-2, 0, 2], [-2, 1, 1]]));
  });

  it('handles all zeros and short inputs', () => {
    expect(norm(threeSum([0, 0, 0, 0]))).toEqual(norm([[0, 0, 0]]));
    expect(threeSum([])).toEqual([]);
    expect(threeSum([0, 1])).toEqual([]);
    expect(threeSum([0, 1, 1])).toEqual([]);
  });

  it('does not modify the input', () => {
    const input = [3, -1, -2, 1, 0];
    threeSum(input);
    expect(input).toEqual([3, -1, -2, 1, 0]);
  });

  it('matches a brute force on small random arrays', () => {
    let seed = 53;
    const rand = () => ((seed = (seed * 48271) % 2147483647) % 9) - 4;
    for (let round = 0; round < 40; round++) {
      const nums = Array.from({ length: 3 + (round % 8) }, rand);
      const expected = new Set();
      for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) for (let k = j + 1; k < nums.length; k++) {
        if (nums[i] + nums[j] + nums[k] === 0) expected.add(JSON.stringify([nums[i], nums[j], nums[k]].sort((a, b) => a - b)));
      }
      expect(norm(threeSum(nums))).toEqual([...expected].sort());
    }
  });

  it('is O(n²): 2 000 numbers', () => {
    const nums = Array.from({ length: 2000 }, (_, i) => ((i * 7919) % 1001) - 500);
    const t = Date.now();
    const r = threeSum(nums);
    expect(Date.now() - t).toBeLessThan(900);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((tr) => tr[0] + tr[1] + tr[2] === 0)).toBe(true);
    expect(new Set(norm(r)).size).toBe(r.length);
  });
});
```

%% hints
- Sort a copy ascending; loop `i`; `if (i > 0 && nums[i] === nums[i - 1]) continue;`
- `lo = i + 1, hi = n - 1`; move `lo` when the sum is negative, `hi` when positive; on zero record, move both, and skip equal `lo` values.

%% solution
```js
export function threeSum(nums) {
  const sorted = nums.slice().sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length - 2; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;
    let lo = i + 1;
    let hi = sorted.length - 1;
    while (lo < hi) {
      const sum = sorted[i] + sorted[lo] + sorted[hi];
      if (sum === 0) {
        out.push([sorted[i], sorted[lo], sorted[hi]]);
        lo++;
        hi--;
        while (lo < hi && sorted[lo] === sorted[lo - 1]) lo++;
      } else if (sum < 0) {
        lo++;
      } else {
        hi--;
      }
    }
  }
  return out;
}
```

%% exercise alg-k-distinct | Longest substring with K distinct characters | 3 | js | js | longestKDistinct | 26
Return the **length of the longest substring of `s` that contains at most `k` distinct characters**. `k = 0` gives `0`. It must be **O(n)**: a million characters are tested.

```js
longestKDistinct('eceba', 2); // 3   ("ece")
longestKDistinct('aa', 1);    // 2
```

%% worked
**A similar problem, solved: `longestWithoutLetter(s, banned)`** — the longest substring that never contains one banned letter (a window with a simple rule).

```js
function longestWithoutLetter(s, banned) {
  let left = 0, best = 0;
  for (let right = 0; right < s.length; right++) {
    if (s[right] === banned) left = right + 1;      // ① the rule is broken: restart the window after it
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

With "at most `k` distinct", the rule involves a **count of each character in the window**. Keep a `Map` char → count. Expand `right` (add the character); **while the map has more than `k` keys**, remove `s[left]` (decrement; delete the key when it hits `0`) and advance `left`. Record the window length each time the window is valid.

%% explain
- **Window counts** in a `Map`.
- **Invalid** when `map.size > k`: shrink from the left.
- **Delete a key** when its count reaches `0`.
- **`k = 0`** → `0`; empty string → `0`.

%% nudge
- How do you know how many distinct characters the window has?
- What must happen to the map when a character leaves the window?

%% starter
```js
export function longestKDistinct(s, k) {
  // your code
  return 0;
}
```

%% tests
```js
describe('longestKDistinct', () => {
  it('finds the longest window', () => {
    expect(longestKDistinct('eceba', 2)).toBe(3);
    expect(longestKDistinct('aa', 1)).toBe(2);
    expect(longestKDistinct('abcadcacacaca', 3)).toBe(11);
  });

  it('handles k = 0, empty strings and large k', () => {
    expect(longestKDistinct('abc', 0)).toBe(0);
    expect(longestKDistinct('', 2)).toBe(0);
    expect(longestKDistinct('abc', 10)).toBe(3);
  });

  it('handles k = 1', () => {
    expect(longestKDistinct('aabbbcc', 1)).toBe(3);
  });

  it('matches brute force on small random strings', () => {
    let seed = 59;
    const rand = () => 'abcd'[(seed = (seed * 48271) % 2147483647) % 4];
    for (let round = 0; round < 40; round++) {
      const s = Array.from({ length: 1 + (round % 14) }, rand).join('');
      const k = 1 + (round % 3);
      let best = 0;
      for (let i = 0; i < s.length; i++) for (let j = i; j < s.length; j++) if (new Set(s.slice(i, j + 1)).size <= k) best = Math.max(best, j - i + 1);
      expect(longestKDistinct(s, k)).toBe(best);
    }
  });

  it('is linear: a million characters', () => {
    const s = 'abcdefghij'.repeat(100000);
    const t = Date.now();
    expect(longestKDistinct(s, 3)).toBe(3);
    expect(longestKDistinct(s, 10)).toBe(1000000);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `const counts = new Map(); let left = 0, best = 0;`
- Each `right`: increment `counts` for `s[right]`; `while (counts.size > k)` decrement `s[left]` (delete at 0) and `left++`; then `best = Math.max(best, right - left + 1)`.

%% solution
```js
export function longestKDistinct(s, k) {
  if (k === 0) return 0;
  const counts = new Map();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    counts.set(s[right], (counts.get(s[right]) ?? 0) + 1);
    while (counts.size > k) {
      const ch = s[left++];
      const c = counts.get(ch) - 1;
      if (c === 0) counts.delete(ch);
      else counts.set(ch, c);
    }
    if (right - left + 1 > best) best = right - left + 1;
  }
  return best;
}
```

%% exercise alg-subarrays-div-k | Subarrays divisible by K | 3 | js | js | subarraysDivByK | 28
Return how many **non-empty contiguous subarrays** have a sum **divisible by `k`** (`k >= 1`; the numbers may be negative). It must be **O(n)**: a million numbers are tested.

```js
subarraysDivByK([4, 5, 0, -2, -3, 1], 5); // 7
```

%% worked
**A similar problem, solved: `subarraysWithSum(nums, target)`** — the same trick with an exact sum (from the data-structures track).

```js
function subarraysWithSum(nums, target) {
  const seen = new Map([[0, 1]]);                  // ① prefix sum → how many times it occurred (the empty prefix counts once)
  let sum = 0, count = 0;
  for (const x of nums) {
    sum += x;
    count += seen.get(sum - target) ?? 0;           // ② an earlier prefix of (sum − target) closes a subarray summing to target
    seen.set(sum, (seen.get(sum) ?? 0) + 1);
  }
  return count;
}
```

"Divisible by `k`" means two prefix sums have the **same remainder** modulo `k`: the stretch between them sums to a multiple of `k`. So key the map by the **remainder** (normalised to `0 … k−1`, since JavaScript's `%` can be negative: `((sum % k) + k) % k`), and each time you see a remainder, add how many times it has appeared before.

%% explain
- **Prefix sums modulo `k`**: equal remainders ⇒ the subarray between is divisible by `k`.
- **Normalise** negative remainders: `((x % k) + k) % k`.
- **Seed** the map with remainder `0` appearing once.
- **Count** pairs as they appear.

%% nudge
- When do two prefix sums give a subarray divisible by `k`?
- What does `-3 % 5` give in JavaScript, and how do you fix it?

%% starter
```js
export function subarraysDivByK(nums, k) {
  // your code
  return 0;
}
```

%% tests
```js
describe('subarraysDivByK', () => {
  it('counts divisible subarrays', () => {
    expect(subarraysDivByK([4, 5, 0, -2, -3, 1], 5)).toBe(7);
    expect(subarraysDivByK([5], 9)).toBe(0);
    expect(subarraysDivByK([5], 5)).toBe(1);
  });

  it('handles zeros and k = 1', () => {
    expect(subarraysDivByK([0, 0, 0], 3)).toBe(6);
    expect(subarraysDivByK([1, 2, 3], 1)).toBe(6);
  });

  it('handles negative numbers', () => {
    expect(subarraysDivByK([-1, 2, 9], 2)).toBe(2);
    expect(subarraysDivByK([-5, -5], 5)).toBe(3);
  });

  it('handles empty arrays', () => {
    expect(subarraysDivByK([], 4)).toBe(0);
  });

  it('matches brute force on small random arrays', () => {
    let seed = 61;
    const rand = () => ((seed = (seed * 48271) % 2147483647) % 15) - 7;
    for (let round = 0; round < 40; round++) {
      const nums = Array.from({ length: 1 + (round % 12) }, rand);
      const k = 1 + (round % 6);
      let brute = 0;
      for (let i = 0; i < nums.length; i++) { let s = 0; for (let j = i; j < nums.length; j++) { s += nums[j]; if (s % k === 0) brute++; } }
      expect(subarraysDivByK(nums, k)).toBe(brute);
    }
  });

  it('is linear: a million numbers', () => {
    const nums = Array.from({ length: 1000000 }, (_, i) => (i % 7) - 3);
    const t = Date.now();
    const r = subarraysDivByK(nums, 5);
    expect(Date.now() - t).toBeLessThan(900);
    expect(Number.isInteger(r) && r > 0).toBe(true);
  });
});
```

%% hints
- `const seen = new Array(k).fill(0); seen[0] = 1; let sum = 0, count = 0;`
- For each `x`: `sum += x; const r = ((sum % k) + k) % k; count += seen[r]; seen[r]++;`

%% solution
```js
export function subarraysDivByK(nums, k) {
  const seen = new Array(k).fill(0);
  seen[0] = 1;
  let sum = 0;
  let count = 0;
  for (const x of nums) {
    sum += x;
    const r = ((sum % k) + k) % k;
    count += seen[r];
    seen[r]++;
  }
  return count;
}
```

%% exercise alg-k-closest | K closest points to the origin | 3 | js | js | kClosest | 28
`points` is an array of `[x, y]`. Return the `k` points **closest to the origin** `(0, 0)` (straight-line distance). Return them in **any order**. You can assume the `k` closest points are unambiguous apart from ties at the boundary (any valid choice is accepted). Don't modify the input. It must handle **200 000 points** quickly.

```js
kClosest([[1, 3], [-2, 2]], 1); // [[-2, 2]]   (distance² 8 beats 10)
```

%% worked
**A similar problem, solved: `squaredDistance(p)`** — compare squared distances: the square root never changes the order, and avoids floating-point noise.

```js
const squaredDistance = ([x, y]) => x * x + y * y;     // ① no Math.sqrt needed for comparisons
function closestOne(points) {
  let best = points[0];
  for (const p of points) if (squaredDistance(p) < squaredDistance(best)) best = p;   // ② a scan for the single minimum: O(n)
  return best;
}
```

For the closest **`k`**, you can **sort by squared distance and take the first `k`** (O(n log n)) — fine at this size. A heap version keeps a **max-heap of size `k`** (so the farthest of the current candidates sits on top and is evicted first): O(n log k). Either passes; pick the one you can explain.

%% explain
- **Squared distance** `x² + y²` orders points like the real distance.
- **Any order** is accepted for the `k` results.
- **Input unchanged** (sort a copy).
- **`k` ≥ number of points** returns them all.

%% nudge
- Why is it safe to skip the square root?
- Which simple approach is fast enough for 200 000 points?

%% starter
```js
export function kClosest(points, k) {
  // your code
  return [];
}
```

%% tests
```js
describe('kClosest', () => {
  const d2 = (p) => p[0] * p[0] + p[1] * p[1];

  it('returns the closest points', () => {
    expect(kClosest([[1, 3], [-2, 2]], 1)).toEqual([[-2, 2]]);
    const r = kClosest([[3, 3], [5, -1], [-2, 4]], 2);
    expect(r.map(d2).sort((a, b) => a - b)).toEqual([18, 20]);
  });

  it('handles k equal to or above the number of points', () => {
    expect(kClosest([[1, 1], [2, 2]], 2).length).toBe(2);
    expect(kClosest([[1, 1]], 5)).toEqual([[1, 1]]);
  });

  it('handles k = 0 and empty input', () => {
    expect(kClosest([[1, 1]], 0)).toEqual([]);
    expect(kClosest([], 3)).toEqual([]);
  });

  it('does not modify the input', () => {
    const pts = [[3, 3], [1, 1], [2, 2]];
    kClosest(pts, 1);
    expect(pts).toEqual([[3, 3], [1, 1], [2, 2]]);
  });

  it('returns exactly the k smallest distances on random data', () => {
    let seed = 67;
    const rand = () => ((seed = (seed * 48271) % 2147483647) % 201) - 100;
    const pts = Array.from({ length: 300 }, () => [rand(), rand()]);
    const expected = pts.map(d2).sort((a, b) => a - b).slice(0, 25);
    expect(kClosest(pts, 25).map(d2).sort((a, b) => a - b)).toEqual(expected);
  });

  it('is fast on 200 000 points', () => {
    const pts = Array.from({ length: 200000 }, (_, i) => [((i * 7919) % 20001) - 10000, ((i * 104729) % 20001) - 10000]);
    const t = Date.now();
    const r = kClosest(pts, 10);
    expect(Date.now() - t).toBeLessThan(900);
    expect(r.length).toBe(10);
  });
});
```

%% hints
- `points.slice().sort((a, b) => d2(a) - d2(b)).slice(0, k)` is enough (copy first!).
- For `O(n log k)`: keep a max-heap of size `k` keyed by squared distance.

%% solution
```js
export function kClosest(points, k) {
  const d2 = (p) => p[0] * p[0] + p[1] * p[1];
  return points.slice().sort((a, b) => d2(a) - d2(b)).slice(0, Math.max(0, k));
}
```

%% exercise alg-task-scheduler | Task scheduler | 3 | js | js | leastInterval | 28
`tasks` is an array of task labels (letters). The CPU runs one task per time unit (or sits idle). **Two runs of the same task must be at least `n` units apart** (`n` other units in between, which may be idle). Tasks can run in any order. Return the **fewest time units** needed to finish them all. It must handle **a million tasks** quickly.

```js
leastInterval(['A', 'A', 'A', 'B', 'B', 'B'], 2); // 8   (A B _ A B _ A B)
```

%% worked
**A similar problem, solved: `framesNeeded(counts, cooldown)`** — the busiest task decides the minimum length.

```js
function framesNeeded(counts, cooldown) {
  const maxCount = Math.max(...counts);
  const numMax = counts.filter((c) => c === maxCount).length;
  return (maxCount - 1) * (cooldown + 1) + numMax;      // ① (maxCount − 1) full frames of length cooldown + 1, then the last row of the busiest tasks
}
```

Picture the busiest task `A` (count `m`): it needs `m − 1` gaps, each at least `n + 1` long (`A` plus `n` slots), then a final `A`. That frame has room for other tasks in the gaps. If there are **more tasks than the frame has slots** (many different tasks), no idle time is needed and the answer is simply `tasks.length`. So: `max(tasks.length, (maxCount − 1) × (n + 1) + numberOfTasksWithMaxCount)`.

%% explain
- **Count each label**; `maxCount` = the largest count.
- **Frame length**: `(maxCount − 1) × (n + 1) + (tasks with maxCount)`.
- **Never fewer than `tasks.length`**: take the maximum.
- **`n = 0`** → `tasks.length`.

%% nudge
- Which task forces the idle gaps?
- When do enough other tasks exist to fill every gap?

%% starter
```js
export function leastInterval(tasks, n) {
  // your code
  return 0;
}
```

%% tests
```js
describe('leastInterval', () => {
  it('computes the minimum time', () => {
    expect(leastInterval(['A', 'A', 'A', 'B', 'B', 'B'], 2)).toBe(8);
    expect(leastInterval(['A', 'A', 'A', 'B', 'B', 'B'], 0)).toBe(6);
    expect(leastInterval(['A', 'A', 'A', 'A', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G'], 2)).toBe(16);
  });

  it('needs no idle time when there are enough different tasks', () => {
    expect(leastInterval(['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'], 2)).toBe(8);
    expect(leastInterval(['A', 'A', 'B', 'B', 'C', 'C'], 1)).toBe(6);
  });

  it('handles one task and an empty list', () => {
    expect(leastInterval(['A'], 5)).toBe(1);
    expect(leastInterval([], 3)).toBe(0);
  });

  it('handles repeated single-label tasks', () => {
    expect(leastInterval(['A', 'A', 'A'], 2)).toBe(7);
    expect(leastInterval(['A', 'A', 'A', 'B'], 2)).toBe(7);
  });

  it('is fast: a million tasks', () => {
    const tasks = Array.from({ length: 1000000 }, (_, i) => 'ABCDEFGH'[i % 8]);
    const t = Date.now();
    expect(leastInterval(tasks, 3)).toBe(1000000);
    expect(leastInterval(new Array(1000000).fill('A'), 2)).toBe(2999998);
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- Count labels in a `Map` (or an array of 26). `maxCount = Math.max(...counts)` (use a loop for huge arrays).
- `numMax` = how many labels have `maxCount`. Answer: `Math.max(tasks.length, (maxCount - 1) * (n + 1) + numMax)`.

%% solution
```js
export function leastInterval(tasks, n) {
  const counts = new Map();
  for (const t of tasks) counts.set(t, (counts.get(t) ?? 0) + 1);
  let maxCount = 0;
  for (const c of counts.values()) if (c > maxCount) maxCount = c;
  let numMax = 0;
  for (const c of counts.values()) if (c === maxCount) numMax++;
  return Math.max(tasks.length, (maxCount - 1) * (n + 1) + numMax);
}
```

%% exercise alg-word-ladder | Word ladder | 4 | js | js | ladderLength | 38
Transform `beginWord` into `endWord` by changing **one letter at a time**; every intermediate word (and `endWord`) must be in `wordList`. Return the **number of words** in the **shortest** such sequence, counting both `beginWord` and `endWord`, or `0` if none exists. (`beginWord` need not be in the list.) All words are lowercase and the same length. It must be fast: a list of 10 000 four-letter words is tested.

```js
ladderLength('hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log', 'cog']); // 5   hit → hot → dot → dog → cog
```

%% worked
**A similar problem, solved: `neighbours(word, dict)`** — every dictionary word that differs from `word` in exactly one letter.

```js
function neighbours(word, dict) {                       // dict is a Set
  const out = [];
  for (let i = 0; i < word.length; i++) {
    for (let c = 97; c <= 122; c++) {                   // ① try every letter 'a'…'z' at position i
      const candidate = word.slice(0, i) + String.fromCharCode(c) + word.slice(i + 1);
      if (candidate !== word && dict.has(candidate)) out.push(candidate);   // ② a Set makes the check O(1)
    }
  }
  return out;
}
```

Words are **nodes**, one-letter differences are **edges**, and "fewest steps" in an unweighted graph means **BFS** with a `visited` set. Generate neighbours on the fly (as above: `length × 26` lookups, far cheaper than comparing against every word). Track the **level** (number of words so far) and return it when you reach `endWord`.

%% explain
- **BFS** from `beginWord`; level = words in the sequence so far.
- **Neighbours**: change one letter to each of `a`–`z`, keep those in the dictionary.
- **Visited**: remove a word from the `Set` (or mark it) when you queue it.
- **`endWord` not in the list** → `0`.

%% nudge
- Why is BFS (not DFS) the right search for the *shortest* sequence?
- How do you avoid comparing a word with every other word?

%% starter
```js
export function ladderLength(beginWord, endWord, wordList) {
  // your code
  return 0;
}
```

%% tests
```js
describe('ladderLength', () => {
  it('finds the shortest sequence', () => {
    expect(ladderLength('hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log', 'cog'])).toBe(5);
    expect(ladderLength('a', 'c', ['a', 'b', 'c'])).toBe(2);
  });

  it('returns 0 when the end word is missing or unreachable', () => {
    expect(ladderLength('hit', 'cog', ['hot', 'dot', 'dog', 'lot', 'log'])).toBe(0);
    expect(ladderLength('aaa', 'zzz', ['aab', 'zzy'])).toBe(0);
  });

  it('does not require the begin word to be in the list', () => {
    expect(ladderLength('cat', 'dog', ['cot', 'cog', 'dog'])).toBe(4);
  });

  it('picks the shorter of two routes', () => {
    const list = ['hot', 'dot', 'dog', 'cog', 'cot', 'cog'];
    expect(ladderLength('hit', 'cog', list)).toBe(4);
  });

  it('does not modify the word list', () => {
    const list = ['hot', 'dot', 'dog', 'lot', 'log', 'cog'];
    ladderLength('hit', 'cog', list);
    expect(list).toEqual(['hot', 'dot', 'dog', 'lot', 'log', 'cog']);
  });

  it('is fast: 10 000 four-letter words', () => {
    const letters = 'abcdefghij';
    const words = [];
    for (const a of letters) for (const b of letters) for (const c of letters) for (const d of letters) words.push(a + b + c + d);
    const t = Date.now();
    expect(ladderLength('aaaa', 'jjjj', words)).toBe(5);
    expect(Date.now() - t).toBeLessThan(1500);
  });
});
```

%% hints
- `const dict = new Set(wordList); if (!dict.has(endWord)) return 0;` Then BFS with `queue = [beginWord]`, `level = 1`.
- Process the queue level by level: for each word try all one-letter changes; if the candidate is `endWord` return `level + 1`; if it's in `dict`, delete it from `dict` (visited) and queue it.

%% solution
```js
export function ladderLength(beginWord, endWord, wordList) {
  const dict = new Set(wordList);
  if (!dict.has(endWord)) return 0;
  dict.delete(beginWord);
  let queue = [beginWord];
  let level = 1;
  while (queue.length) {
    const next = [];
    for (const word of queue) {
      for (let i = 0; i < word.length; i++) {
        for (let c = 97; c <= 122; c++) {
          const ch = String.fromCharCode(c);
          if (ch === word[i]) continue;
          const candidate = word.slice(0, i) + ch + word.slice(i + 1);
          if (candidate === endWord) return level + 1;
          if (dict.has(candidate)) {
            dict.delete(candidate);
            next.push(candidate);
          }
        }
      }
    }
    queue = next;
    level++;
  }
  return 0;
}
```
