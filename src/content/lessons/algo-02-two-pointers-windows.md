---
id: algo-windows
track: algo
title: Two pointers & sliding windows
summary: Two indexes that move in step turn nested loops into a single pass: pointers closing in from both ends of sorted data, and windows that grow and shrink along an array or string.
---

## The idea in one sentence

Instead of checking every pair or every range with a **loop inside a loop**, keep **two indexes** and move them in a way that **never needs to go back** — so the whole job is one pass, **O(n)**.

> **Analogy** Measuring a rope against a doorway with your two hands: you don't try every possible spacing — if the gap is too wide you bring one hand in, too narrow you move the other out. Each adjustment rules out a whole family of possibilities at once.

Two closely related patterns do most of the work:

| Pattern | Pointers | Typical job |
| --- | --- | --- |
| **Two pointers** | one at each end, moving **towards each other** | pairs in sorted data, palindromes, "container with most water" |
| **Sliding window** | a `left` and a `right` that both only move **forward** | best/shortest/longest *contiguous* run (substring, subarray) |

## Two pointers: close in from both ends

If the data is **sorted**, you can reason about what moving a pointer does. Looking for two numbers that add to a target:

![Two pointers on a sorted array, with the rule for moving each](fig:alg-two-pointers "Too big? Lower the high end. Too small? Raise the low end. Each move discards a value for good.")

```stepper Finding a pair that sums to 10
code:
  function pairWithSum(nums, target) {
    let lo = 0, hi = nums.length - 1;
    while (lo < hi) {
      const sum = nums[lo] + nums[hi];
      if (sum === target) return [lo, hi];
      if (sum < target) lo++;
      else hi--;
    }
    return null;
  }
  pairWithSum([1, 3, 4, 6, 8, 11], 10);
---
line: 2
say: One pointer at each end. The array is sorted, so `lo` points at the smallest value and `hi` at the largest.
lo: 0 (value 1)
hi: 5 (value 11)
---
line: 4-7
say: `1 + 11 = 12` is **too big**. The largest value `11` is too big for *every* partner (even the smallest, `1`), so it can never be part of the answer: discard it with `hi--`.
sum: 12
hi: 4 (value 8)
---
line: 4-6
say: `1 + 8 = 9` is **too small**. By the same argument `1` can't pair with anything left (its best partner `8` is already too small), so `lo++`.
sum: 9
lo: 1 (value 3)
---
line: 4-7
say: `3 + 8 = 11` is too big: `hi--`.
sum: 11
hi: 3 (value 6)
---
line: 4-6
say: `3 + 6 = 9` is too small: `lo++`.
sum: 9
lo: 2 (value 4)
---
line: 5
say: `4 + 6 = 10`: **found** `[2, 3]`. Each step threw away one value permanently, so at most `n` steps: **O(n)**, versus O(n²) for trying every pair.
sum: 10
Result: [2, 3]
```

The key requirement: **moving a pointer must have a predictable effect** (sorted order gives that). Without sorting you'd use a `Map` (the hash-table lesson) instead.

```js try predict
function maxArea(heights) {
  let lo = 0, hi = heights.length - 1, best = 0;
  while (lo < hi) {
    best = Math.max(best, Math.min(heights[lo], heights[hi]) * (hi - lo));
    if (heights[lo] < heights[hi]) lo++; else hi--;      // the shorter wall limits the water: it can only improve by moving it
  }
  return best;
}
console.log(maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]));
```

That "container with most water" move shows the general idea: **move the pointer that is limiting you**, because moving the other can only make things worse (the width shrinks and the height is still capped).

## Sliding window: grow, shrink, record

For **contiguous** ranges, keep a window `[left, right]`. Move `right` forward to **take in** the next item; while the window **breaks a rule**, move `left` forward to **drop** items; whenever it is valid, **record** it.

![A sliding window over "abcabcbb" with left and right pointers](fig:alg-window-shape "Both pointers only move forward, so there are at most 2n moves in total.")

### Fixed-size windows

When the window size `k` is given, slide it by one step: **add the new item, subtract the one that left**. Never re-add the whole window.

![Fixed and variable sliding windows](fig:alg-fixed-variable "Update the running total as items enter and leave instead of recomputing it.")

```js try
function maxWindowSum(nums, k) {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];            // the first window
  let best = sum;
  for (let right = k; right < nums.length; right++) {
    sum += nums[right] - nums[right - k];                // slide: one in, one out
    best = Math.max(best, sum);
  }
  return best;
}
console.log(maxWindowSum([2, 1, 5, 1, 3, 2], 3));
```

### Variable-size windows

When you're asked for the **shortest** or **longest** window that satisfies something, let both pointers move:

```js try
function shortestAtLeast(target, nums) {      // nums are positive
  let left = 0, sum = 0, best = Infinity;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];                       // expand
    while (sum >= target) {                   // shrink while it is still valid...
      best = Math.min(best, right - left + 1);//   ...and record each valid size
      sum -= nums[left++];
    }
  }
  return best === Infinity ? 0 : best;
}
console.log(shortestAtLeast(7, [2, 3, 1, 2, 4, 3]));   // 2  ([4, 3])
```

Is it really O(n) with a loop inside a loop? Yes: `left` and `right` each only move forward, so together they make at most `2n` moves.

```stepper Longest substring without repeating characters
code:
  function longestUnique(s) {
    const lastSeen = new Map();
    let left = 0, best = 0;
    for (let right = 0; right < s.length; right++) {
      const ch = s[right];
      if (lastSeen.has(ch) && lastSeen.get(ch) >= left) left = lastSeen.get(ch) + 1;
      lastSeen.set(ch, right);
      best = Math.max(best, right - left + 1);
    }
    return best;
  }
  longestUnique('abcabcbb');
---
line: 4-8
say: `right = 0`: `'a'` has not been seen. The window is `"a"` (left 0). Record `last['a'] = 0`.
window: a
best: 1
---
line: 4-8
say: `'b'`, then `'c'` are new: the window grows to `"abc"`.
window: abc
best: 3
---
line: 6
say: `right = 3`, `'a'` again. Last seen at index `0`, which is **inside** the window (`0 >= left`). To drop the duplicate, jump `left` to just past it: `left = 1`.
window: bca
best: 3
---
line: 6
say: `'b'` repeats (last seen at 1, inside): `left = 2`. Window `"cab"`.
window: cab
best: 3
---
line: 6
say: `'c'` repeats: `left = 3`. Window `"abc"`.
window: abc
best: 3
---
line: 6
say: `right = 6`, `'b'`: last seen at index 4, inside the window → `left = 5`. The window shrinks to `"cb"`.
window: cb
best: 3
---
line: 6-8
say: `right = 7`, `'b'` again (last seen at 6) → `left = 7`. Window `"b"`. The string ends: the best window ever was length **3**.
window: b
Result: 3
```

(The `lastSeen.get(ch) >= left` test matters: an old occurrence **outside** the window must not move `left` backwards. Try `"abba"` in the exercise.)

## When a window works, and when it doesn't

Sliding windows rely on a **monotonic** property: *adding an item can only push you towards invalid* and *removing one can only push you towards valid* (all-positive sums, "no repeats", "at most K distinct"). If numbers can be **negative**, removing an item might *increase* the sum, so shrinking logic breaks; use **prefix sums** with a hash map instead (see the data-structures track).

## Quick check

```check
Q: Why can two pointers find a pair summing to a target in O(n) on a sorted array?
A) Sorting makes every pair equal
B) Each comparison tells you which end to move, discarding a value that can never be in the answer *
C) It checks every pair quickly
D) The array is searched twice
Why: If the sum is too big, the largest value is too big for every partner, so it can be dropped for good (and symmetrically for too small).
---
Q: In "container with most water" you move the pointer at the shorter wall because…
A) The taller wall is more important
B) The shorter wall limits the area, so moving the taller one can only shrink the width without raising the height cap *
C) It is the left pointer
D) It is faster
Why: The area is capped by the shorter wall; the only way to beat the current area is to find a taller wall to replace it.
---
Q: A fixed window of size k slides one step. How should the running sum change?
A) Recompute all k items
B) Add the new item and subtract the item that left *
C) Subtract the new item
D) Reset to zero
Why: That keeps each slide O(1) rather than O(k).
---
Q: The window code has a `while` inside a `for`. Why is it still O(n)?
A) The while never runs
B) `left` and `right` each only move forward, so total moves are at most 2n *
C) Windows are free
D) JavaScript optimises it
Why: Count total pointer moves, not loop depth.
---
Q: Why does the longest-unique-substring code check `lastSeen.get(ch) >= left`?
A) To save memory
B) An earlier occurrence outside the window is irrelevant and must not move `left` backwards *
C) To sort the map
D) To handle uppercase letters
Why: With "abba", the second `a` was last seen before the window's left edge; ignoring that check would shrink the window wrongly.
```

## Recap

- **Two pointers**: ends moving inwards on sorted data (pair sums, container, palindromes). Move the pointer that the rule says is *wrong*; each step discards a value.
- **Sliding window**: `right` expands, `left` shrinks while invalid, record when valid. Both only move forward → **O(n)**.
- **Fixed window**: add one, remove one. **Variable window**: expand and shrink to find the shortest/longest.
- Windows need a **monotonic** property; with negative numbers reach for prefix sums and a hash map.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: pair with a sum | The pair-sum stepper |
| Loose palindrome | Pointers from both ends that skip non-letters |
| Best fixed window | Add the entering item, subtract the leaving one |
| Container with most water | Move the pointer at the shorter wall |
| Longest unique substring | The last-seen map and the `>= left` guard |
| Shortest subarray with a sum | Expand, then shrink while still valid |
| Minimum window substring | Counts of what you still need, and a "missing" counter |

%% exercise alg-guided-pair-sum | Guided: pair with a sum | 1 | js | js | pairWithSum | 8 | guided
`nums` is sorted ascending. Return the indexes `[i, j]` (with `i < j`) of two numbers that add up to `target`, using **two pointers** (no `Map`, no nested loops). If several pairs work, return the one the scan finds first (the outermost). Return `null` if there is none.

```js
pairWithSum([1, 3, 4, 6, 8, 11], 10); // [2, 3]
pairWithSum([1, 2, 3, 4], 5);         // [0, 3]
```

%% worked
**A similar problem, solved: `countPairsAtMost(nums, limit)`** — how many pairs sum to at most `limit`, in a sorted array?

```js
function countPairsAtMost(nums, limit) {
  let lo = 0, hi = nums.length - 1, count = 0;
  while (lo < hi) {
    if (nums[lo] + nums[hi] <= limit) {
      count += hi - lo;               // ① nums[lo] pairs with EVERY value between lo+1 and hi
      lo++;
    } else {
      hi--;                           // ② too big even with the smallest partner: drop hi
    }
  }
  return count;
}
```

Same skeleton: `lo` and `hi` at the ends, a `while (lo < hi)` loop, and each comparison decides **which pointer to move**. For `pairWithSum`: equal → return, sum too small → `lo++`, too big → `hi--`.

%% explain
- **Sorted input**, ascending.
- **Returns `[lo, hi]`** the moment the sum matches; `i < j`.
- **`null`** when the pointers meet without a match.
- **O(n)** with O(1) extra memory.

%% nudge
- If the current sum is too small, which pointer can make it bigger?
- When does the loop stop?

%% starter
```js
export function pairWithSum(nums, target) {
  // Step 1 — let lo = 0, hi = nums.length - 1.
  // Step 2 — while (lo < hi): sum = nums[lo] + nums[hi].
  // Step 3 — equal → return [lo, hi]; too small → lo++; too big → hi--.
  // Step 4 — otherwise return null.
  return undefined;
}
```

%% tests
```js
describe('pairWithSum', () => {
  it('finds a pair', () => {
    expect(pairWithSum([1, 3, 4, 6, 8, 11], 10)).toEqual([2, 3]);
    expect(pairWithSum([2, 7, 11, 15], 9)).toEqual([0, 1]);
  });

  it('returns the outermost pair when several work', () => {
    expect(pairWithSum([1, 2, 3, 4], 5)).toEqual([0, 3]);
  });

  it('handles duplicates and negatives', () => {
    expect(pairWithSum([3, 3], 6)).toEqual([0, 1]);
    expect(pairWithSum([-4, -1, 1, 3, 5], 0)).toEqual([1, 2]);
  });

  it('returns null when there is no pair', () => {
    expect(pairWithSum([1, 2, 3], 100)).toBeNull();
    expect(pairWithSum([], 1)).toBeNull();
    expect(pairWithSum([5], 5)).toBeNull();
  });

  it('is linear', () => {
    const nums = Array.from({ length: 500000 }, (_, i) => i * 2);
    const t = Date.now();
    expect(pairWithSum(nums, 1)).toBeNull();
    expect(pairWithSum(nums, 999998)).toEqual([0, 499999]);
    expect(Date.now() - t).toBeLessThan(400);
  });
});
```

%% hints
- `while (lo < hi) { const sum = nums[lo] + nums[hi]; if (sum === target) return [lo, hi]; if (sum < target) lo++; else hi--; } return null;`

%% solution
```js
export function pairWithSum(nums, target) {
  let lo = 0;
  let hi = nums.length - 1;
  while (lo < hi) {
    const sum = nums[lo] + nums[hi];
    if (sum === target) return [lo, hi];
    if (sum < target) lo++;
    else hi--;
  }
  return null;
}
```

%% exercise alg-loose-palindrome | Loose palindrome | 2 | js | js | isLoosePalindrome | 14
Return whether a string reads the same forwards and backwards **ignoring case and every character that isn't a letter or digit** (`a`–`z`, `0`–`9`). An empty string, or one with no letters or digits, counts as a palindrome. Use **two pointers** that skip over the ignored characters; don't build a cleaned copy.

```js
isLoosePalindrome('A man, a plan, a canal: Panama'); // true
isLoosePalindrome('race a car');                      // false
```

%% worked
**A similar problem, solved: `isPalindrome(s)`** — the strict version, two pointers from the ends.

```js
function isPalindrome(s) {
  let lo = 0, hi = s.length - 1;
  while (lo < hi) {
    if (s[lo] !== s[hi]) return false;    // ① a mismatch ends it
    lo++; hi--;                           // ② otherwise close in
  }
  return true;
}
```

The loose version adds two small loops inside: **skip** `lo` forward while it points at an ignored character (and `lo < hi`), skip `hi` backward the same way, **then** compare lowercased characters. Each pointer still only moves one way, so it stays O(n).

%% explain
- **Ignore** anything that isn't `[a-z0-9]` (case-insensitive).
- **Two pointers** skip ignored characters, then compare.
- **No letters at all** → `true`.
- **Linear**: a million characters are tested.

%% nudge
- What must you do when a pointer lands on a comma or space?
- How do you compare `'A'` and `'a'` as equal?

%% starter
```js
export function isLoosePalindrome(s) {
  // your code
  return false;
}
```

%% tests
```js
describe('isLoosePalindrome', () => {
  it('ignores case, spaces and punctuation', () => {
    expect(isLoosePalindrome('A man, a plan, a canal: Panama')).toBe(true);
    expect(isLoosePalindrome('Was it a car or a cat I saw?')).toBe(true);
  });

  it('rejects non-palindromes', () => {
    expect(isLoosePalindrome('race a car')).toBe(false);
    expect(isLoosePalindrome('0P')).toBe(false);
  });

  it('treats an empty string or only punctuation as a palindrome', () => {
    expect(isLoosePalindrome('')).toBe(true);
    expect(isLoosePalindrome(' ')).toBe(true);
    expect(isLoosePalindrome('.,!?')).toBe(true);
  });

  it('handles single characters and digits', () => {
    expect(isLoosePalindrome('a')).toBe(true);
    expect(isLoosePalindrome('12 21')).toBe(true);
    expect(isLoosePalindrome('1 2 3')).toBe(false);
  });

  it('is linear on a million characters', () => {
    const left = 'ab, '.repeat(250000);
    const s = left + left.split('').reverse().join('');
    const t = Date.now();
    expect(isLoosePalindrome(s)).toBe(true);
    expect(isLoosePalindrome(s + 'x')).toBe(false);
    expect(Date.now() - t).toBeLessThan(800);
  });
});
```

%% hints
- A helper `const isAlnum = (c) => /[a-z0-9]/i.test(c);`
- `while (lo < hi && !isAlnum(s[lo])) lo++;` then the same for `hi`, then compare `s[lo].toLowerCase()` with `s[hi].toLowerCase()`.

%% solution
```js
export function isLoosePalindrome(s) {
  const isAlnum = (c) => (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
  let lo = 0;
  let hi = s.length - 1;
  while (lo < hi) {
    while (lo < hi && !isAlnum(s[lo])) lo++;
    while (lo < hi && !isAlnum(s[hi])) hi--;
    if (s[lo].toLowerCase() !== s[hi].toLowerCase()) return false;
    lo++;
    hi--;
  }
  return true;
}
```

%% exercise alg-max-window-sum | Best fixed window | 2 | js | js | maxWindowSum | 14
Return the **largest sum of any `k` consecutive items** of `nums`. Return `null` if `k < 1` or `k` is larger than the array. It must be **O(n)** — a million items with `k = 1000` is tested, so adding up each window from scratch is too slow.

```js
maxWindowSum([2, 1, 5, 1, 3, 2], 3); // 9   (5 + 1 + 3)
```

%% worked
**A similar problem, solved: `runningTotals(nums)`** — the principle of reusing the previous answer.

```js
function runningTotals(nums) {
  const out = [];
  let total = 0;
  for (const x of nums) {
    total += x;                  // ① each new total is the previous one plus ONE item: no re-adding
    out.push(total);
  }
  return out;
}
```

A window sum works the same way: from one window to the next, **one item enters and one leaves**, so `sum += nums[right] - nums[right - k]`. Add up the first `k` items once to start.

%% explain
- **Window size `k`**, windows overlap by `k − 1` items.
- **First window** is summed directly.
- **Each slide** is one addition and one subtraction.
- **Invalid `k`** (below 1 or above the length) returns `null`.
- **Negative numbers** are fine (it's just a sum).

%% nudge
- What changes in the sum when the window moves one step right?
- What is the best sum so far after the first window?

%% starter
```js
export function maxWindowSum(nums, k) {
  // your code
  return null;
}
```

%% tests
```js
describe('maxWindowSum', () => {
  it('finds the best window', () => {
    expect(maxWindowSum([2, 1, 5, 1, 3, 2], 3)).toBe(9);
    expect(maxWindowSum([1, 4, 2, 10, 23, 3, 1, 0, 20], 4)).toBe(39);
  });

  it('handles k = 1 and k = n', () => {
    expect(maxWindowSum([4, -2, 9], 1)).toBe(9);
    expect(maxWindowSum([4, -2, 9], 3)).toBe(11);
  });

  it('handles negative numbers', () => {
    expect(maxWindowSum([-1, -2, -3, -4], 2)).toBe(-3);
  });

  it('returns null for impossible windows', () => {
    expect(maxWindowSum([1, 2], 3)).toBeNull();
    expect(maxWindowSum([1, 2], 0)).toBeNull();
    expect(maxWindowSum([], 1)).toBeNull();
  });

  it('is linear: a million items, k = 1000', () => {
    const nums = Array.from({ length: 1000000 }, (_, i) => i % 7);
    const t = Date.now();
    const r = maxWindowSum(nums, 1000);
    expect(Date.now() - t).toBeLessThan(500);
    expect(r).toBeGreaterThan(2900);
  });
});
```

%% hints
- Sum the first `k` items into `sum` and set `best = sum`.
- For `right` from `k` to the end: `sum += nums[right] - nums[right - k]; best = Math.max(best, sum);`

%% solution
```js
export function maxWindowSum(nums, k) {
  if (k < 1 || k > nums.length) return null;
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];
  let best = sum;
  for (let right = k; right < nums.length; right++) {
    sum += nums[right] - nums[right - k];
    if (sum > best) best = sum;
  }
  return best;
}
```

%% exercise alg-max-area | Container with most water | 2 | js | js | maxArea | 18
`heights[i]` is the height of a vertical wall at position `i`. Choose two walls: together with the x-axis they form a container whose water area is `min(heights[i], heights[j]) × (j − i)`. Return the **largest area** you can get. It must be **O(n)**: 200 000 walls are tested.

```js
maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7]); // 49   (walls at positions 1 and 8)
```

%% worked
**A similar problem, solved: `widestPairAtLeast(heights, h)`** — the widest gap between two walls that are both at least `h` tall.

```js
function widestPairAtLeast(heights, h) {
  let lo = 0, hi = heights.length - 1;
  while (lo < hi && heights[lo] < h) lo++;     // ① the left end must be tall enough: skip short walls
  while (lo < hi && heights[hi] < h) hi--;     // ② and so must the right end
  return lo < hi ? hi - lo : 0;
}
```

The idea is the same: start at the **widest** pair and decide which pointer to move. For the water problem the shorter wall caps the height, so a narrower container can only beat the current one by **replacing the shorter wall**: move the pointer at the shorter wall inward and try again.

%% explain
- **Area** = `min(h[i], h[j]) × (j − i)`.
- **Start widest** (`lo = 0`, `hi = n − 1`).
- **Move the shorter wall**'s pointer: moving the taller one can't help.
- **Fewer than two walls** → `0`.

%% nudge
- What limits the height of the water?
- Which pointer should move after you record an area?

%% starter
```js
export function maxArea(heights) {
  // your code
  return 0;
}
```

%% tests
```js
describe('maxArea', () => {
  it('finds the largest container', () => {
    expect(maxArea([1, 8, 6, 2, 5, 4, 8, 3, 7])).toBe(49);
    expect(maxArea([4, 3, 2, 1, 4])).toBe(16);
    expect(maxArea([1, 2, 1])).toBe(2);
  });

  it('handles tiny inputs', () => {
    expect(maxArea([1, 1])).toBe(1);
    expect(maxArea([5])).toBe(0);
    expect(maxArea([])).toBe(0);
  });

  it('handles zeros', () => {
    expect(maxArea([0, 0, 0])).toBe(0);
    expect(maxArea([0, 3, 0])).toBe(0);
  });

  it('matches brute force on random inputs', () => {
    let seed = 4;
    const rand = () => (seed = (seed * 48271) % 2147483647) % 30;
    for (let round = 0; round < 30; round++) {
      const h = Array.from({ length: 25 }, rand);
      let brute = 0;
      for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) brute = Math.max(brute, Math.min(h[i], h[j]) * (j - i));
      expect(maxArea(h)).toBe(brute);
    }
  });

  it('is linear: 200 000 walls', () => {
    const n = 200000;
    const h = Array.from({ length: n }, (_, i) => i + 1);
    const t = Date.now();
    expect(maxArea(h)).toBe(10000000000);
    expect(Date.now() - t).toBeLessThan(400);
  });
});
```

%% hints
- `lo = 0, hi = n - 1, best = 0`. Each loop: compute the area, update `best`, then move the pointer at the shorter wall (`lo++` if `h[lo] < h[hi]`, else `hi--`).

%% solution
```js
export function maxArea(heights) {
  let lo = 0;
  let hi = heights.length - 1;
  let best = 0;
  while (lo < hi) {
    const area = Math.min(heights[lo], heights[hi]) * (hi - lo);
    if (area > best) best = area;
    if (heights[lo] < heights[hi]) lo++;
    else hi--;
  }
  return best;
}
```

%% exercise alg-longest-unique | Longest substring without repeats | 3 | js | js | longestUnique | 22
Return the **length of the longest substring of `s` that has no repeated character**. Use a sliding window: 200 000 characters are tested.

```js
longestUnique('abcabcbb'); // 3  ("abc")
longestUnique('pwwkew');   // 3  ("wke")
longestUnique('abba');     // 2  ("ab" or "ba")
```

%% worked
**A similar problem, solved: `longestRunOf(s)`** — the longest run of the same repeated character.

```js
function longestRunOf(s) {
  let best = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== s[start]) start = i;          // ① the run broke: a new window starts here
    best = Math.max(best, i - start + 1);       // ② record the size of the current window
  }
  return best;
}
```

Here the window only ever restarts. For unique characters the window should instead **shrink just enough**: remember where each character was **last seen**; when `s[right]` was seen at an index inside the window, move `left` to **one past** that index. Keep `left` from ever moving backwards (`"abba"`!).

%% explain
- **Window `[left, right]`** always holds distinct characters.
- **`lastSeen`** maps a character to its latest index.
- **Duplicate inside the window** → `left = lastSeen + 1`; one outside it is ignored.
- **Empty string** returns `0`.

%% nudge
- When the new character was last seen before `left`, should `left` move?
- What is the window's length in terms of `left` and `right`?

%% starter
```js
export function longestUnique(s) {
  // your code
  return 0;
}
```

%% tests
```js
describe('longestUnique', () => {
  it('finds the longest repeat-free substring', () => {
    expect(longestUnique('abcabcbb')).toBe(3);
    expect(longestUnique('pwwkew')).toBe(3);
    expect(longestUnique('dvdf')).toBe(3);
  });

  it('handles all-same and all-different strings', () => {
    expect(longestUnique('bbbbb')).toBe(1);
    expect(longestUnique('abcdef')).toBe(6);
  });

  it('never moves the left edge backwards', () => {
    expect(longestUnique('abba')).toBe(2);
    expect(longestUnique('tmmzuxt')).toBe(5);
  });

  it('handles empty and single-character strings', () => {
    expect(longestUnique('')).toBe(0);
    expect(longestUnique('z')).toBe(1);
  });

  it('is linear on 200 000 characters', () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz';
    const s = alphabet.repeat(Math.ceil(200000 / 26)).slice(0, 200000);
    const t = Date.now();
    expect(longestUnique(s)).toBe(26);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- `const lastSeen = new Map(); let left = 0, best = 0;`
- For each `right`: if `lastSeen.has(ch) && lastSeen.get(ch) >= left`, set `left = lastSeen.get(ch) + 1`. Then `lastSeen.set(ch, right)` and update `best` with `right - left + 1`.

%% solution
```js
export function longestUnique(s) {
  const lastSeen = new Map();
  let left = 0;
  let best = 0;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) left = lastSeen.get(ch) + 1;
    lastSeen.set(ch, right);
    if (right - left + 1 > best) best = right - left + 1;
  }
  return best;
}
```

%% exercise alg-min-subarray | Shortest subarray with a sum | 3 | js | js | minSubarrayLen | 22
Given a target and an array of **positive** integers, return the **length of the shortest contiguous subarray whose sum is at least `target`**, or `0` if there is none. It must be **O(n)**: 200 000 items are tested.

```js
minSubarrayLen(7, [2, 3, 1, 2, 4, 3]); // 2   ([4, 3])
```

%% worked
**A similar problem, solved: `longestAtMost(nums, limit)`** — the *longest* window whose sum stays at most `limit` (positive numbers).

```js
function longestAtMost(nums, limit) {
  let left = 0, sum = 0, best = 0;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];                           // ① expand
    while (sum > limit) sum -= nums[left++];       // ② shrink until valid again
    best = Math.max(best, right - left + 1);       // ③ now the window is valid: record it
  }
  return best;
}
```

For the **shortest** window, flip the roles: expand until the sum is **big enough**, then **shrink as long as it stays big enough**, recording the size at each step. Positive numbers make this safe: removing an item can only lower the sum.

%% explain
- **Positive integers**, so the sum only grows when you expand and only shrinks when you remove.
- **Expand `right`**; **while `sum >= target`** record the length and shrink `left`.
- **`0`** when no subarray reaches the target.
- **Linear**: each index enters and leaves once.

%% nudge
- When the sum reaches the target, is the window the shortest it can be ending at this `right`?
- What do you subtract when you move `left`?

%% starter
```js
export function minSubarrayLen(target, nums) {
  // your code
  return 0;
}
```

%% tests
```js
describe('minSubarrayLen', () => {
  it('finds the shortest qualifying subarray', () => {
    expect(minSubarrayLen(7, [2, 3, 1, 2, 4, 3])).toBe(2);
    expect(minSubarrayLen(4, [1, 4, 4])).toBe(1);
    expect(minSubarrayLen(15, [1, 2, 3, 4, 5])).toBe(5);
  });

  it('returns 0 when the total is not enough', () => {
    expect(minSubarrayLen(11, [1, 1, 1, 1, 1, 1, 1, 1])).toBe(0);
    expect(minSubarrayLen(5, [])).toBe(0);
  });

  it('handles a single item', () => {
    expect(minSubarrayLen(3, [5])).toBe(1);
    expect(minSubarrayLen(6, [5])).toBe(0);
  });

  it('matches brute force on random inputs', () => {
    let seed = 6;
    const rand = () => ((seed = (seed * 48271) % 2147483647) % 9) + 1;
    for (let round = 0; round < 30; round++) {
      const nums = Array.from({ length: 20 }, rand);
      const target = rand() * 4;
      let brute = 0;
      for (let i = 0; i < nums.length; i++) {
        let s = 0;
        for (let j = i; j < nums.length; j++) {
          s += nums[j];
          if (s >= target) { if (!brute || j - i + 1 < brute) brute = j - i + 1; break; }
        }
      }
      expect(minSubarrayLen(target, nums)).toBe(brute);
    }
  });

  it('is linear on 200 000 items', () => {
    const nums = Array.from({ length: 200000 }, (_, i) => (i % 5) + 1);
    const t = Date.now();
    expect(minSubarrayLen(700000, nums)).toBe(0);
    expect(minSubarrayLen(1000, nums)).toBeGreaterThan(300);
    expect(Date.now() - t).toBeLessThan(600);
  });
});
```

%% hints
- `let left = 0, sum = 0, best = Infinity;`
- For each `right`: `sum += nums[right]; while (sum >= target) { best = Math.min(best, right - left + 1); sum -= nums[left++]; }`.
- Return `best === Infinity ? 0 : best`.

%% solution
```js
export function minSubarrayLen(target, nums) {
  let left = 0;
  let sum = 0;
  let best = Infinity;
  for (let right = 0; right < nums.length; right++) {
    sum += nums[right];
    while (sum >= target) {
      if (right - left + 1 < best) best = right - left + 1;
      sum -= nums[left++];
    }
  }
  return best === Infinity ? 0 : best;
}
```

%% exercise alg-min-window | Minimum window substring | 4 | js | js | minWindow | 38
Given strings `s` and `t`, return the **smallest substring of `s` that contains every character of `t`** (counting repeats: `t = "aab"` needs two `a`s and a `b`). Return `''` if there is no such window; if several windows have the same smallest length, return the **leftmost**. It must be **O(|s| + |t|)**: 200 000 characters are tested.

```js
minWindow('ADOBECODEBANC', 'ABC'); // 'BANC'
minWindow('a', 'aa');              // ''
```

%% worked
**A similar problem, solved: `shortestWithAll(nums, a, b)`** — the shortest window of `nums` that contains both the values `a` and `b`.

```js
function shortestWithAll(nums, a, b) {
  const need = new Map([[a, 1], [b, 1]]);     // ① what the window still has to cover
  let missing = need.size, left = 0, best = Infinity;
  for (let right = 0; right < nums.length; right++) {
    const x = nums[right];
    if (need.has(x)) { need.set(x, need.get(x) - 1); if (need.get(x) === 0) missing--; }   // ② one requirement satisfied
    while (missing === 0) {                    // ③ the window is valid: try to shrink it
      best = Math.min(best, right - left + 1);
      const y = nums[left++];
      if (need.has(y)) { need.set(y, need.get(y) + 1); if (need.get(y) === 1) missing++; }  // ④ dropping y may break validity
    }
  }
  return best === Infinity ? 0 : best;
}
```

For `minWindow`, `need` holds the **required count of each character** of `t` and `missing` counts how many **distinct characters still lack enough copies**. A count may go negative (extra copies in the window). Remember where the best window starts so you can slice it out at the end.

%% explain
- **`need[ch]`** = required copies still missing (negative when the window has extras).
- **`missing`** = number of characters whose `need` is still above 0.
- **Expand** `right`; **while `missing === 0`**, record the window and shrink `left`.
- **Leftmost on ties**: only record when strictly shorter.
- **Empty `t`** returns `''`.

%% nudge
- How do you know the window currently covers all of `t` without scanning it?
- When you drop a character on the left, when does the window stop being valid?

%% starter
```js
export function minWindow(s, t) {
  // your code
  return '';
}
```

%% tests
```js
describe('minWindow', () => {
  it('finds the smallest covering window', () => {
    expect(minWindow('ADOBECODEBANC', 'ABC')).toBe('BANC');
    expect(minWindow('abc', 'cba')).toBe('abc');
  });

  it('counts repeated characters', () => {
    expect(minWindow('aa', 'aa')).toBe('aa');
    expect(minWindow('a', 'aa')).toBe('');
    expect(minWindow('aabdec', 'aab')).toBe('aab');
  });

  it('returns the leftmost smallest window', () => {
    expect(minWindow('abcabc', 'abc')).toBe('abc');
    expect(minWindow('bba', 'ab')).toBe('ba');
  });

  it('handles impossible and empty cases', () => {
    expect(minWindow('abc', 'z')).toBe('');
    expect(minWindow('abc', '')).toBe('');
    expect(minWindow('', 'a')).toBe('');
    expect(minWindow('ab', 'abc')).toBe('');
  });

  it('handles a single matching character', () => {
    expect(minWindow('a', 'a')).toBe('a');
    expect(minWindow('xyz', 'y')).toBe('y');
  });

  it('is linear on 200 000 characters', () => {
    const s = 'a'.repeat(100000) + 'xyz' + 'a'.repeat(100000);
    const t0 = Date.now();
    expect(minWindow(s, 'zyx')).toBe('xyz');
    expect(minWindow(s, 'q')).toBe('');
    expect(Date.now() - t0).toBeLessThan(700);
  });
});
```

%% hints
- Build `need = new Map()` with the count of each char in `t`; `missing = need.size` (distinct characters).
- Expand `right`: if `need.has(ch)`, decrement it and when it hits `0` do `missing--`.
- While `missing === 0`: record `[left, right]` if shorter, then un-count `s[left]` (increment its `need`; if it becomes `1`, `missing++`) and `left++`.

%% solution
```js
export function minWindow(s, t) {
  if (t.length === 0 || s.length < t.length) return '';
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) ?? 0) + 1);
  let missing = need.size;
  let left = 0;
  let bestStart = 0;
  let bestLen = Infinity;
  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if (need.has(ch)) {
      need.set(ch, need.get(ch) - 1);
      if (need.get(ch) === 0) missing--;
    }
    while (missing === 0) {
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestStart = left;
      }
      const drop = s[left++];
      if (need.has(drop)) {
        need.set(drop, need.get(drop) + 1);
        if (need.get(drop) === 1) missing++;
      }
    }
  }
  return bestLen === Infinity ? '' : s.slice(bestStart, bestStart + bestLen);
}
```
