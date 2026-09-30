---
id: interview-ds
track: interview
title: Data structures & algorithms in JavaScript
summary: The recurring problem shapes — hash maps, stacks, sorted sweeps, caches, tries — and how to reason about them out loud.
---

## The idea in one sentence

Most live-coding problems are **one of about a dozen shapes wearing a costume** — your job in the first two minutes is to **name the shape**, say the complexity you're aiming for, and then write it.

> **Analogy** A mechanic hears a strange noise and doesn't start taking the engine apart — they ask "*when* does it happen?", try the most likely cause, and explain what they're doing as they go. Interviewers want to hear that same calm routine, not silent typing.

## A repeatable routine

![Six steps: restate, example, brute force, code, test, complexity](fig:interview-routine "Follow it every time; it keeps you calm and shows how you think.")

1. **Restate** the problem and ask about inputs: empty? duplicates? sorted? negative? how big?
2. Work **one small example** by hand. Say the answer out loud.
3. Propose the **brute force** and its cost. Then improve it. ("That's O(n²) — the inner loop is really a lookup; a `Map` makes it O(1).")
4. **Code it**, naming things well. Narrate invariants ("`stack` always holds unmatched openers").
5. **Test** with your example, an empty input, one element and a nasty case.
6. State **time and space** complexity.

## The JavaScript toolbox

| Need | Use | Notes |
| --- | --- | --- |
| Lookup by key, counts | `Map` / `Set` | O(1) on average. Keys can be any value. Iteration is in insertion order. |
| Dictionary of strings | `Map` (or `Object.create(null)`) | A plain `{}` inherits `toString`, `__proto__`… |
| Stack | array `push` / `pop` | O(1) |
| Queue | array `push` + `shift` | `shift` is O(n) on big arrays — use an index pointer or a linked list for BFS on large inputs |
| Sorted order | `arr.sort(cmp)` | O(n log n), stable; **the comparator must return a number** |
| Priority queue | a binary heap you write | There's no built-in one |
| Deduping | `new Set(arr)` | Uses SameValueZero (`NaN` equals `NaN`) |

## Complexity cheat-sheet

- Hash map/set operations: **O(1)** average.
- Sorting: **O(n log n)**. One scan: **O(n)**. Nested loops over the same input: **O(n²)**.
- Recursion depth counts as **space** (and the call stack is only ~10,000 frames deep in practice).
- `includes` / `indexOf` / `find` on an array are **O(n)** — inside a loop that's the classic hidden O(n²).
- Repeated `slice` or spreading an array inside a loop is O(n) *each time*.

## The shapes

### 1 · Complement lookup (Two Sum)

Store what you've **seen**; for each new number ask "have I already seen the number that completes it?" — one pass, O(n).

```stepper Two Sum with a Map
code:
  function twoSum(nums, target) {
    const seen = new Map();                 // value → index
    for (let j = 0; j < nums.length; j++) {
      const need = target - nums[j];
      if (seen.has(need)) return [seen.get(need), j];
      seen.set(nums[j], j);
    }
    return null;
  }
  twoSum([2, 7, 11, 15], 9);
---
line: 3-4
say: `j = 0`: the number is `2`, so we **need** `9 - 2 = 7`. We haven't seen anything yet.
Looking at: nums[0] = 2
Need: 7
seen (value → index):
---
line: 6
say: `7` isn't in `seen`, so remember `2` at index `0` and move on.
seen (value → index): 2 → 0
---
line: 3-4
say: `j = 1`: the number is `7`, so we need `9 - 7 = 2`.
Looking at: nums[1] = 7
Need: 2
---
line: 5
say: `seen` **has** `2` (index `0`). We found the pair: return `[0, 1]`. One pass, one lookup per item — **O(n)**, instead of the O(n²) "try every pair".
Result: [0, 1]
```

### 2 · Stack matching (brackets)

Push openers; on a closer, the **most recent** opener must match. Predict, then run:

```js try predict
function isBalanced(text) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];                                   // invariant: holds the openers not yet closed
  for (const ch of text) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (ch in pairs) {
      if (stack.pop() !== pairs[ch]) return false;    // wrong or missing opener
    }
  }
  return stack.length === 0;                          // anything left open → unbalanced
}

console.log(isBalanced('([]{})'), isBalanced('([)]'), isBalanced('a(b)c['), isBalanced(''));
```

### 3 · Sort, then sweep (intervals)

Sort by start, then walk once, extending the current interval while the next one overlaps or touches it.

![Four intervals sorted by start and merged into two](fig:interval-sweep "Sorting is O(n log n); the sweep is O(n).")

```js try
function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);   // copy first: don't mutate the input
  const out = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);   // overlaps or touches → extend
    else out.push([start, end]);                                      // a gap → start a new interval
  }
  return out;
}
console.log(mergeIntervals([[8, 10], [1, 3], [2, 6], [9, 12]]));
```

(We copy the inner arrays in the real exercise so the *input's* inner arrays aren't changed either.)

### 4 · Canonical form (anagrams)

Map every item to a key that's **identical for equivalent items** — for anagrams, the letters sorted:

```js try
const groups = new Map();
for (const word of ['eat', 'tea', 'tan', 'ate', 'nat', 'bat']) {
  const key = [...word].sort().join('');                  // "eat", "tea", "ate" → "aet"
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(word);
}
console.log([...groups.values()]);
```

### 5 · Count, then select (top K)

Build a frequency `Map`, then pick the top `k`. Sorting entries is O(d log d) for `d` distinct values; a **bucket** approach (an array where index = frequency) gets it to O(n).

```js try
const items = ['a', 'b', 'a', 'c', 'b', 'a'];
const counts = new Map();
for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);

// Map keeps first-appearance order, and sort is stable → ties keep first appearance for free:
const top2 = [...counts].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([value]) => value);
console.log(top2);
```

### 6 · Design a structure (LRU, min-stack)

Pick internal structures so **each operation hits its target complexity**. A `Map` remembers insertion order, so an **LRU cache** is delete-then-reinsert to "refresh"; the *first* key is always the least recently used:

![A cache ordered from least to most recently used; get moves an entry to the recent end; set when full evicts the first](fig:lru-ttl "Delete + set = refresh. `map.keys().next().value` = the least recently used key.")

A **min-stack** keeps a second stack of "the minimum so far" alongside the values, so `min()` is O(1).

### 7 · Prefix tree (autocomplete)

A **trie** has one node per character, so words that share a prefix **share nodes**:

![A trie for car, cat and dog](fig:trie-shape "Checking a prefix costs O(length of the prefix), no matter how many words are stored.")

```js try
const root = {};
function insert(word) {
  let node = root;
  for (const ch of word) node = node[ch] ??= {};     // walk (or create) one node per character
  node.$ = true;                                      // mark: a word ends here
}
function startsWith(prefix) {
  let node = root;
  for (const ch of prefix) { node = node[ch]; if (!node) return false; }
  return true;
}
['car', 'cat', 'dog'].forEach(insert);
console.log(startsWith('ca'), startsWith('cow'));
```

## Talking about trade-offs

Interviewers grade **how you reason**. When two approaches exist, say both, pick one, and say what would make you switch: *"If memory mattered more than speed, I'd sort in place and use two pointers."*

## Quick check

```check
Q: Two Sum with nested loops is O(n²). How does a `Map` improve it?
A) It sorts the input first
B) It uses recursion
C) It stores seen values so each element needs one O(1) lookup, giving O(n) *
D) It removes duplicates
Why: For each number you ask "have I seen the complement?" — a constant-time lookup — instead of scanning all the others.
---
Q: Why is `queue.shift()` a problem for BFS on very large inputs?
A) `shift` is O(n) on big arrays, making the whole loop O(n²) *
B) It mutates the array
C) It only works on strings
D) It returns `undefined`
Why: Removing the first element re-indexes the rest. Use an index pointer or a linked list.
---
Q: What does the stack hold in the bracket-matching solution?
A) All characters
B) Only closers
C) The openers that have not yet been matched *
D) Indices of the string
Why: That's the invariant: a closer must match the most recent unmatched opener.
---
Q: After sorting intervals by start, when do `[1, 4]` and `[4, 5]` merge?
A) Never — they only touch
B) Only if you ask
C) They merge when they overlap by at least 2
D) Always — touching counts because `start <= last.end` *
Why: The rule is `next.start <= current.end`; touching ranges merge into `[1, 5]`.
---
Q: Why does a Map-based LRU cache delete a key before setting it again on a `get`?
A) To free memory
B) Maps can't update
C) To trigger eviction
D) Re-inserting moves it to the end, which marks it most recently used *
Why: `Map` iterates in insertion order. Delete + set moves the entry to the newest end; the first key is the oldest.
```

## Recap

- **Name the shape** early; follow the **six-step routine**; state complexity.
- **Map/Set** give O(1) lookups: complement lookup, counting, canonical-form grouping.
- **Stack** for matching; **sort + sweep** for intervals; **frequency map + select** for top-K.
- **Design questions**: pick internals that hit each operation's target (Map order → LRU; second stack → min).
- **Trie** for prefix queries; watch hidden O(n²) (`includes`, `shift`, repeated `slice`).

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: first duplicate | A `Set` of seen values |
| Two Sum | Shape 1 and its stepper |
| Balanced brackets | Shape 2 |
| Min stack | Shape 6: a second stack |
| Group anagrams | Shape 4 |
| Merge intervals | Shape 3 |
| LRU cache | Shape 6 and the figure |
| Top K frequent | Shape 5 (and buckets for the bonus) |
| Trie with autocomplete | Shape 7, plus depth-first traversal for `suggest` |

%% exercise ds-guided-first-dup | Guided: first duplicate | 1 | js | js | firstDuplicate | 5 | guided
Write `firstDuplicate(items)`. Return the **first value that has already appeared earlier** in the array (scanning left to right), or `undefined` if every value is unique.

```js
firstDuplicate([3, 1, 4, 1, 5, 3]); // 1   (the second 1 is reached before the second 3)
firstDuplicate(['a', 'b']);         // undefined
```

It should be **O(n)** — no nested loops.

%% worked
**A similar problem, solved: `hasDuplicate(items)`** — does any value repeat?

```js
function hasDuplicate(items) {
  const seen = new Set();                 // ① a Set remembers what we've met; `has` and `add` are O(1)
  for (const x of items) {
    if (seen.has(x)) return true;         // ② seen before → a duplicate
    seen.add(x);                          // ③ otherwise remember it
  }
  return false;
}
```

This is the same "store what you've **seen**" idea as Two Sum. The brute-force way (for each item, `items.indexOf(...)` or a nested loop) is O(n²); the Set makes each check O(1), so the whole scan is **O(n)**. For `firstDuplicate`, return the value itself at the moment you find it (instead of `true`).

%% explain
- **Returns the value** that is the first to repeat while scanning left to right.
- **`undefined`** when all values are unique (or the array is empty).
- **Works with any values** (numbers, strings, objects by identity).
- **Fast**: a 100,000-item test must finish quickly (no nested loops).

%% nudge
- What data structure answers "have I seen this before?" in constant time?
- At which moment do you know a value is a duplicate?

%% starter
```js
export function firstDuplicate(items) {
  // Step 1 — keep a Set of the values you have seen:   const seen = new Set();
  // Step 2 — loop over items; if seen.has(x), return x.
  // Step 3 — otherwise seen.add(x). After the loop, return undefined.
  return null;
}
```

%% tests
```js
describe('firstDuplicate', () => {
  it('finds the first repeated value', () => {
    expect(firstDuplicate([3, 1, 4, 1, 5, 3])).toBe(1);
  });

  it('returns undefined when all values are unique', () => {
    expect(firstDuplicate(['a', 'b', 'c'])).toBeUndefined();
    expect(firstDuplicate([])).toBeUndefined();
  });

  it('works with strings and mixed values', () => {
    expect(firstDuplicate(['x', 'y', 'x'])).toBe('x');
    expect(firstDuplicate([1, '1', 1])).toBe(1);
  });

  it('is linear', () => {
    const big = Array.from({ length: 100000 }, (_, i) => i);
    big.push(99999);
    const t = Date.now();
    expect(firstDuplicate(big)).toBe(99999);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- `if (seen.has(x)) return x; seen.add(x);` inside the loop.

%% solution
```js
export function firstDuplicate(items) {
  const seen = new Set();
  for (const x of items) {
    if (seen.has(x)) return x;
    seen.add(x);
  }
  return undefined;
}
```

%% exercise ds-two-sum | Two Sum | 1 | js | js | twoSum | 8
Given an array of numbers `nums` and a `target`, return the **indices** `[i, j]` (with `i < j`) of two elements that add up to `target`, or `null` if none exist.

- Exactly one answer is expected when it exists; if several pairs work, return the one with the smallest `j` (the first pair discovered by a left-to-right scan).
- Don't use the same element twice.
- Aim for **O(n)** time. There is a 100 000-element test.

%% starter
```js
export function twoSum(nums, target) {
  // your code
}
```

%% tests
```js
describe('twoSum', () => {
  it('finds a basic pair', () => expect(twoSum([2, 7, 11, 15], 9)).toEqual([0, 1]));
  it('finds pairs later in the array', () => expect(twoSum([3, 2, 4], 6)).toEqual([1, 2]));
  it('handles duplicates', () => expect(twoSum([3, 3], 6)).toEqual([0, 1]));
  it('handles negatives and zero', () => {
    expect(twoSum([-3, 4, 3, 90], 0)).toEqual([0, 2]);
    expect(twoSum([0, 4, 3, 0], 0)).toEqual([0, 3]);
  });
  it('does not reuse the same element', () => expect(twoSum([5, 1], 10)).toBeNull());
  it('returns null when nothing matches', () => expect(twoSum([1, 2, 3], 100)).toBeNull());
  it('handles empty and single-element input', () => {
    expect(twoSum([], 1)).toBeNull();
    expect(twoSum([1], 1)).toBeNull();
  });
  it('prefers the pair with the smallest second index', () => {
    expect(twoSum([1, 4, 5, 2, 3], 6)).toEqual([0, 2]);
  });
  it('is fast on 100 000 elements (O(n))', () => {
    const nums = Array.from({ length: 100000 }, (_, i) => i);
    const start = Date.now();
    expect(twoSum(nums, 199997)).toEqual([99998, 99999]);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
```

%% worked
**A similar problem, solved: `hasPairWithDiff(nums, d)`** — is there a pair whose difference is exactly `d`? Same "look for the complement" trick.

```js
function hasPairWithDiff(nums, d) {
  const seen = new Set();
  for (const x of nums) {
    if (seen.has(x - d) || seen.has(x + d)) return true;   // ① the partner could be either side, so check both complements
    seen.add(x);                                           // ② remember AFTER checking (so an element never pairs with itself)
  }
  return false;
}
```

For Two Sum, the **complement** of `x` is `target - x`, and you need its **index**, so use a `Map` (value → index) instead of a `Set`. Order matters: check the map **before** adding the current number, which also guarantees "don't use the same element twice" and gives the smallest `j` (the first pair discovered while scanning left to right).

%% explain
- **Returns `[i, j]`** with `i < j`, or `null` if no pair exists.
- **If several pairs work**, return the one with the smallest `j` (the first found by a left-to-right scan).
- **Never reuses an element.**
- **O(n)**: there is a 100,000-element test.

%% nudge
- For each number, what value would complete the sum?
- Do you add the current number to the map before or after you look for its complement?

%% hints
- Brute force is two nested loops: O(n²).
- One pass: for each `x`, the partner you need is `target - x`. Have you already seen it? Keep a `Map<value, index>`.
- Check the map **before** inserting the current element, so an element can't pair with itself.

%% solution
```js
export function twoSum(nums, target) {
  const seen = new Map();
  for (let j = 0; j < nums.length; j++) {
    const need = target - nums[j];
    if (seen.has(need)) return [seen.get(need), j];
    if (!seen.has(nums[j])) seen.set(nums[j], j);
  }
  return null;
}
```

%% exercise ds-valid-parens | Balanced brackets | 2 | js | js | isBalanced | 10
`isBalanced(text)` returns `true` if every `(`, `[`, `{` is closed by the matching bracket in the right order. All **other characters are ignored**.

```
"([]{})"   → true
"([)]"     → false
"a(b)c["   → false
""         → true
```

%% starter
```js
export function isBalanced(text) {
  // your code
}
```

%% tests
```js
describe('isBalanced', () => {
  it('accepts simple pairs', () => {
    expect(isBalanced('()')).toBe(true);
    expect(isBalanced('[]')).toBe(true);
    expect(isBalanced('{}')).toBe(true);
  });
  it('accepts nested and sequential groups', () => {
    expect(isBalanced('([]{})')).toBe(true);
    expect(isBalanced('(){}[]')).toBe(true);
    expect(isBalanced('{[()()]}')).toBe(true);
  });
  it('rejects interleaved brackets', () => expect(isBalanced('([)]')).toBe(false));
  it('rejects a closer with no opener', () => {
    expect(isBalanced(')')).toBe(false);
    expect(isBalanced('())')).toBe(false);
  });
  it('rejects unclosed openers', () => {
    expect(isBalanced('(')).toBe(false);
    expect(isBalanced('((')).toBe(false);
    expect(isBalanced('a(b)c[')).toBe(false);
  });
  it('rejects mismatched types', () => expect(isBalanced('(]')).toBe(false));
  it('treats the empty string and no-bracket text as balanced', () => {
    expect(isBalanced('')).toBe(true);
    expect(isBalanced('hello world')).toBe(true);
  });
  it('ignores other characters', () => expect(isBalanced('function f(a) { return [a]; }')).toBe(true));
  it('handles long input', () => {
    expect(isBalanced('('.repeat(50000) + ')'.repeat(50000))).toBe(true);
    expect(isBalanced('('.repeat(50000) + ')'.repeat(49999))).toBe(false);
  });
});
```

%% worked
**A similar problem, solved: `isValidTags(text)`** — are `<` and `>` balanced in order? The same push/pop rhythm with one kind of bracket.

```js
function isBalancedAngles(text) {
  let open = 0;                            // with ONE kind of bracket a counter is enough (a stack of identical items)
  for (const ch of text) {
    if (ch === '<') open++;
    else if (ch === '>') {
      if (open === 0) return false;        // a closer with nothing open
      open--;
    }
  }
  return open === 0;                       // anything still open at the end → unbalanced
}
```

With **several kinds** (`()`, `[]`, `{}`) a counter isn't enough — the *kind* of the most recent opener matters — so use a real stack: push openers, and on a closer `pop()` and compare with the expected opener (`pairs[closer]`). Ignore every other character. If `pop()` returns `undefined` (nothing open) it won't equal any opener, so the same comparison covers that case.

%% explain
- **`true`** if every `(`, `[`, `{` is closed by the matching bracket in the correct order.
- **All other characters are ignored.**
- **Empty string** is balanced; leftover openers or an unexpected closer make it unbalanced.

%% nudge
- What must be true about the most recent unclosed opener when a closer appears?
- What do you check at the very end of the loop?

%% hints
- A stack of expected closers: on an opener push its closer; on a closer pop and compare.
- At the end the stack must be empty.
- A lookup table `{ '(': ')', '[': ']', '{': '}' }` keeps the code tiny.

%% solution
```js
const PAIRS = { '(': ')', '[': ']', '{': '}' };
const CLOSERS = new Set(Object.values(PAIRS));

export function isBalanced(text) {
  const stack = [];
  for (const ch of text) {
    if (ch in PAIRS) stack.push(PAIRS[ch]);
    else if (CLOSERS.has(ch) && stack.pop() !== ch) return false;
  }
  return stack.length === 0;
}
```

%% exercise ds-min-stack | Min stack | 2 | js | js | MinStack | 12
Design a stack that supports `push(x)`, `pop()`, `peek()` and `min()` — **all in O(1)**.

- `pop()` returns the removed value; `peek()` returns the top without removing it; `min()` the smallest value currently in the stack.
- On an empty stack `pop`, `peek` and `min` return `undefined`.
- `size` is a getter for the number of elements.
- Duplicates of the minimum must be handled correctly.

%% starter
```js
export class MinStack {
  // your code
}
```

%% tests
```js
describe('MinStack', () => {
  it('behaves like a stack', () => {
    const s = new MinStack();
    s.push(1); s.push(2); s.push(3);
    expect(s.peek()).toBe(3);
    expect(s.pop()).toBe(3);
    expect(s.pop()).toBe(2);
    expect(s.size).toBe(1);
  });

  it('tracks the minimum as items come and go', () => {
    const s = new MinStack();
    s.push(5); expect(s.min()).toBe(5);
    s.push(3); expect(s.min()).toBe(3);
    s.push(7); expect(s.min()).toBe(3);
    s.pop();   expect(s.min()).toBe(3);
    s.pop();   expect(s.min()).toBe(5);
  });

  it('handles duplicate minimums', () => {
    const s = new MinStack();
    s.push(2); s.push(2); s.push(2);
    s.pop();
    expect(s.min()).toBe(2);
    s.pop();
    expect(s.min()).toBe(2);
    s.pop();
    expect(s.min()).toBeUndefined();
  });

  it('returns undefined on an empty stack', () => {
    const s = new MinStack();
    expect(s.pop()).toBeUndefined();
    expect(s.peek()).toBeUndefined();
    expect(s.min()).toBeUndefined();
    expect(s.size).toBe(0);
  });

  it('handles negative numbers and zero', () => {
    const s = new MinStack();
    s.push(0); s.push(-4); s.push(3);
    expect(s.min()).toBe(-4);
  });

  it('is O(1) per operation (200 000 ops quickly)', () => {
    const s = new MinStack();
    const start = Date.now();
    for (let i = 0; i < 100000; i++) { s.push(i % 977); s.min(); }
    for (let i = 0; i < 100000; i++) { s.min(); s.pop(); }
    expect(Date.now() - start).toBeLessThan(500);
  });
});
```

%% worked
**A similar problem, solved: a stack that also tracks its maximum in O(1)** — the trick is to keep a *second stack* of "the maximum so far".

```js
class MaxStack {
  #values = [];
  #maxes = [];                                   // #maxes[i] = the maximum of values[0..i]

  push(x) {
    this.#values.push(x);
    const currentMax = this.#maxes.length ? this.#maxes[this.#maxes.length - 1] : -Infinity;
    this.#maxes.push(Math.max(currentMax, x));   // ① every push records the new running maximum
  }
  pop() {
    this.#maxes.pop();                           // ② pop BOTH stacks together, so they never get out of step
    return this.#values.pop();
  }
  max() { return this.#maxes[this.#maxes.length - 1]; }   // ③ O(1): the top of the helper stack
}
```

For `MinStack` swap `Math.max` for `Math.min`. Because the helper stack stores the running minimum for **every** depth, duplicates of the minimum are handled correctly: popping one copy still leaves the other copy's entry underneath. Return `undefined` from `pop`/`peek`/`min` on an empty stack, and expose `size` as a getter.

%% explain
- **`push`, `pop`, `peek`, `min`** all O(1).
- **`pop()`** returns the removed value; **`peek()`** the top without removing; **`min()`** the smallest current value.
- **Empty stack**: `pop`, `peek`, `min` return `undefined`; **`size`** is a getter.
- **Duplicates of the minimum** are handled correctly.

%% nudge
- What extra information would let you answer `min()` instantly after a `pop()`?
- Why must both stacks be popped together?

%% hints
- Keep a second stack holding, for each element, the **minimum at the time it was pushed**.
- `push`: `mins.push(Math.min(x, mins.at(-1) ?? x))`. `pop` pops both.
- Recomputing the min by scanning is O(n) and fails the timing test.

%% solution
```js
export class MinStack {
  #items = [];
  #mins = [];

  push(x) {
    this.#items.push(x);
    this.#mins.push(this.#mins.length ? Math.min(x, this.#mins[this.#mins.length - 1]) : x);
  }

  pop() {
    this.#mins.pop();
    return this.#items.pop();
  }

  peek() {
    return this.#items[this.#items.length - 1];
  }

  min() {
    return this.#mins[this.#mins.length - 1];
  }

  get size() {
    return this.#items.length;
  }
}
```

%% exercise ds-group-anagrams | Group anagrams | 2 | js | js | groupAnagrams | 10
`groupAnagrams(words)` groups words that are anagrams of each other (same letters, any order) and returns an array of groups.

- Words within a group keep their original relative order.
- Group order isn't important, but each word appears in exactly one group.
- Comparison is **case-sensitive**; an empty string is a valid word.
- Expected complexity: O(n · k log k) for `n` words of length `k` (or better).

%% starter
```js
export function groupAnagrams(words) {
  // your code
}
```

%% tests
```js
const norm = (groups) => groups.map((g) => [...g]).sort((a, b) => a[0].localeCompare(b[0]) || a.length - b.length);

describe('groupAnagrams', () => {
  it('groups anagrams together', () => {
    const out = groupAnagrams(['eat', 'tea', 'tan', 'ate', 'nat', 'bat']);
    expect(norm(out)).toEqual(norm([['eat', 'tea', 'ate'], ['tan', 'nat'], ['bat']]));
  });
  it('keeps original order within a group', () => {
    const out = groupAnagrams(['listen', 'silent', 'enlist']);
    expect(out).toEqual([['listen', 'silent', 'enlist']]);
  });
  it('returns [] for no words', () => expect(groupAnagrams([])).toEqual([]));
  it('handles single words and the empty string', () => {
    expect(norm(groupAnagrams(['a', '']))).toEqual(norm([[''], ['a']]));
  });
  it('is case-sensitive', () => {
    expect(groupAnagrams(['Ab', 'ba']).length).toBe(2);
  });
  it('keeps duplicates', () => {
    expect(groupAnagrams(['ab', 'ba', 'ab'])).toEqual([['ab', 'ba', 'ab']]);
  });
  it('does not confuse words that merely share a sorted-length signature', () => {
    expect(groupAnagrams(['abc', 'abd']).length).toBe(2);
  });
  it('does not mutate the input', () => {
    const src = Object.freeze(['b', 'a']);
    expect(() => groupAnagrams(src)).not.toThrow();
  });
});
```

%% worked
**A similar problem, solved: `groupByLength(words)`** — the same "group by a computed key" skeleton.

```js
function groupByLength(words) {
  const groups = new Map();                       // key → array of words
  for (const word of words) {
    const key = word.length;                      // ① the KEY is the thing equivalent items share
    if (!groups.has(key)) groups.set(key, []);    // ② first time we see this key: create the group
    groups.get(key).push(word);                   // ③ append, so the original order is kept inside each group
  }
  return [...groups.values()];
}
```

For anagrams the key is a **canonical form**: the word's letters sorted — `[...word].sort().join('')`. `"eat"`, `"tea"` and `"ate"` all become `"aet"`. Sorting a word of length `k` costs O(k log k), so for `n` words it's **O(n · k log k)**. (A letter-count key like `"a1e1t1"` gets it to O(n · k).) The empty string is a valid word: its key is `''`, which is a perfectly good `Map` key.

%% explain
- **Anagrams grouped together**; words keep their original relative order within a group.
- **Each word appears in exactly one group**; group order is unimportant.
- **Case-sensitive**; the empty string is a valid word.
- **O(n · k log k)** or better.

%% nudge
- What key is identical for `"eat"`, `"tea"` and `"ate"`, but different for `"tan"`?
- Which structure maps a key to "the list of words so far"?

%% hints
- Two words are anagrams iff their **sorted letters** are equal — that sorted string is a canonical key.
- Group with a `Map<string, string[]>` and return `[...map.values()]`.

%% solution
```js
export function groupAnagrams(words) {
  const groups = new Map();
  for (const word of words) {
    const key = [...word].sort().join('');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  return [...groups.values()];
}
```

%% exercise ds-merge-intervals | Merge intervals | 3 | js | js | mergeIntervals | 15
`mergeIntervals(intervals)` takes `[start, end]` pairs (in any order) and returns the minimal list of **non-overlapping** intervals covering the same ranges, sorted by start.

- Intervals that **touch** (`[1, 4]` and `[4, 5]`) merge.
- Fully nested intervals collapse into the outer one.
- Don't mutate the input (or its inner arrays).
- Expected: O(n log n).

%% starter
```js
export function mergeIntervals(intervals) {
  // your code
}
```

%% tests
```js
describe('mergeIntervals', () => {
  it('merges overlapping intervals', () => {
    expect(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]])).toEqual([[1, 6], [8, 10], [15, 18]]);
  });
  it('merges touching intervals', () => expect(mergeIntervals([[1, 4], [4, 5]])).toEqual([[1, 5]]));
  it('handles unsorted input', () => {
    expect(mergeIntervals([[8, 10], [1, 3], [2, 6]])).toEqual([[1, 6], [8, 10]]);
  });
  it('collapses nested intervals', () => {
    expect(mergeIntervals([[1, 10], [2, 3], [4, 5]])).toEqual([[1, 10]]);
  });
  it('handles empty and single input', () => {
    expect(mergeIntervals([])).toEqual([]);
    expect(mergeIntervals([[5, 7]])).toEqual([[5, 7]]);
  });
  it('chains many overlaps into one', () => {
    expect(mergeIntervals([[1, 2], [2, 3], [3, 4], [4, 5]])).toEqual([[1, 5]]);
  });
  it('keeps disjoint intervals separate', () => {
    expect(mergeIntervals([[1, 2], [4, 5]])).toEqual([[1, 2], [4, 5]]);
  });
  it('does not mutate the input', () => {
    const src = [[2, 6], [1, 3]];
    const frozen = src.map((p) => Object.freeze([...p]));
    const out = mergeIntervals(Object.freeze(frozen));
    expect(out).toEqual([[1, 6]]);
    expect(src).toEqual([[2, 6], [1, 3]]);
  });
  it('returns fresh inner arrays', () => {
    const src = [[1, 2]];
    const out = mergeIntervals(src);
    expect(out[0]).not.toBe(src[0]);
  });
  it('handles negatives', () => {
    expect(mergeIntervals([[-5, -1], [-3, 2]])).toEqual([[-5, 2]]);
  });
});
```

%% worked
**A similar problem, solved: `insertAndMerge(intervals, newOne)`** — uses the same "sort, then sweep" pattern, in a slightly different order.

```js
function coverage(intervals) {
  // total length covered by the union of intervals
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);   // ① sort by START (on a COPY)
  let total = 0;
  let [curStart, curEnd] = sorted[0] ?? [0, 0];
  for (const [start, end] of sorted.slice(1)) {
    if (start <= curEnd) curEnd = Math.max(curEnd, end);       // ② overlapping/touching → extend the current interval
    else { total += curEnd - curStart; [curStart, curEnd] = [start, end]; }   // ③ a gap → bank the finished one, start a new one
  }
  return total + (curEnd - curStart);                          // ④ don't forget the LAST interval
}
```

`mergeIntervals` keeps the merged intervals in a list instead of summing them. **Two traps**: `Math.max(curEnd, end)` (a nested interval like `[1, 10]` then `[2, 3]` must *not* shrink the end), and **not mutating** the input — copy the outer array before sorting *and* copy the inner pairs you extend (`[start, end]` literals, not the original arrays).

%% explain
- **Returns non-overlapping intervals** covering the same ranges, **sorted by start**.
- **Touching** intervals (`[1, 4]`, `[4, 5]`) merge; **nested** ones collapse into the outer.
- **Doesn't mutate** the input or its inner arrays.
- **O(n log n).**

%% nudge
- After sorting by start, when does the next interval belong to the current merged one?
- What should the merged end be — always the next end, or something else?

%% hints
- Sort a copy by start. Then sweep: compare each interval's start to the current merged interval's end.
- `start <= currentEnd` → extend `currentEnd = Math.max(currentEnd, end)`; else push a new interval.
- Copy the inner arrays (`[a, b]`) so you never hand back or modify the caller's pairs.

%% solution
```js
export function mergeIntervals(intervals) {
  const sorted = intervals.map(([a, b]) => [a, b]).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [start, end] of sorted) {
    const last = out[out.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else out.push([start, end]);
  }
  return out;
}
```

%% exercise ds-lru-cache | LRU cache | 3 | js | js | LRUCache | 20
Implement `LRUCache` with a fixed `capacity`, where **both `get` and `put` are O(1)**.

- `get(key)` returns the value, or `undefined` if absent. A hit marks the key as **most recently used**.
- `put(key, value)` inserts or updates (and marks most recently used). When the size would exceed `capacity`, evict the **least** recently used entry.
- `has(key)` checks presence **without** changing recency.
- `size` getter. `capacity < 1` throws a `RangeError`.
- Values may be falsy (`0`, `null`, `undefined`) and must be cached correctly.

%% starter
```js
export class LRUCache {
  constructor(capacity) {
    // your code
  }
}
```

%% tests
```js
describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const c = new LRUCache(2);
    c.put('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.get('missing')).toBeUndefined();
  });

  it('evicts the least recently used entry', () => {
    const c = new LRUCache(2);
    c.put('a', 1); c.put('b', 2); c.put('c', 3);
    expect(c.has('a')).toBe(false);
    expect(c.get('b')).toBe(2);
    expect(c.get('c')).toBe(3);
  });

  it('a get refreshes recency', () => {
    const c = new LRUCache(2);
    c.put('a', 1); c.put('b', 2);
    c.get('a');
    c.put('c', 3);
    expect(c.has('b')).toBe(false);
    expect(c.has('a')).toBe(true);
  });

  it('updating a key refreshes it and keeps size stable', () => {
    const c = new LRUCache(2);
    c.put('a', 1); c.put('b', 2);
    c.put('a', 10);
    expect(c.size).toBe(2);
    c.put('c', 3);
    expect(c.get('a')).toBe(10);
    expect(c.has('b')).toBe(false);
  });

  it('has() does not change recency', () => {
    const c = new LRUCache(2);
    c.put('a', 1); c.put('b', 2);
    c.has('a');
    c.put('c', 3);
    expect(c.has('a')).toBe(false);
  });

  it('caches falsy values', () => {
    const c = new LRUCache(3);
    c.put('zero', 0); c.put('nul', null); c.put('undef', undefined);
    expect(c.get('zero')).toBe(0);
    expect(c.get('nul')).toBeNull();
    expect(c.has('undef')).toBe(true);
    expect(c.size).toBe(3);
  });

  it('works with capacity 1', () => {
    const c = new LRUCache(1);
    c.put('a', 1); c.put('b', 2);
    expect(c.has('a')).toBe(false);
    expect(c.get('b')).toBe(2);
  });

  it('validates capacity', () => {
    expect(() => new LRUCache(0)).toThrow(RangeError);
    expect(() => new LRUCache(-3)).toThrow(RangeError);
  });

  it('supports non-string keys', () => {
    const c = new LRUCache(2);
    const obj = {};
    c.put(obj, 'o'); c.put(1, 'one');
    expect(c.get(obj)).toBe('o');
    expect(c.get(1)).toBe('one');
  });

  it('is O(1): 200 000 operations finish quickly', () => {
    const c = new LRUCache(1000);
    const start = Date.now();
    for (let i = 0; i < 100000; i++) { c.put(i, i); c.get(i - 500); }
    expect(c.size).toBe(1000);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
```

%% worked
**A similar problem, solved: a "recent items" list where `visit(x)` moves x to the front, in O(1).** Again a `Map`'s insertion order does the work.

```js
class Recent {
  #map = new Map();
  visit(x) {
    this.#map.delete(x);            // ① delete…
    this.#map.set(x, true);         // ② …and re-insert: it is now the NEWEST entry
  }
  newest() { return [...this.#map.keys()].pop(); }
  oldest() { return this.#map.keys().next().value; }   // ③ the FIRST key is the oldest, found in O(1) without copying
}
```

For `LRUCache`: `get(key)` — if present, read the value, **delete + set** to refresh, return it (careful: use `has`, not truthiness, because `0`, `null`, `undefined` and `''` are valid values). `put(key, value)` — delete any existing entry, set the new one, and if `size > capacity` delete `map.keys().next().value`. `has(key)` only checks `map.has` (no refresh). Throw `RangeError` when `capacity < 1`.

%% explain
- **`get`** returns the value (or `undefined`) and marks a hit as most recently used.
- **`put`** inserts/updates (most recent) and evicts the **least** recently used when over `capacity`.
- **`has`** doesn't change recency; **`size`** is a getter; **`capacity < 1`** throws a `RangeError`.
- **Falsy values** (`0`, `null`, `undefined`) must be cached correctly.
- **Both `get` and `put` are O(1).**

%% nudge
- Which `Map` operations move an entry to the "newest" end?
- How do you tell "the key is missing" from "the value is `undefined`"?

%% hints
- A JS `Map` iterates in insertion order, so its **first key is the oldest**.
- Refresh = `map.delete(key)` then `map.set(key, value)` (moves it to the end).
- Evict with `map.keys().next().value`.
- Use `map.has(key)` (not `get(...) !== undefined`) to detect presence.

%% solution
```js
export class LRUCache {
  #map = new Map();
  #capacity;

  constructor(capacity) {
    if (!(capacity >= 1)) throw new RangeError('capacity must be >= 1');
    this.#capacity = capacity;
  }

  get(key) {
    if (!this.#map.has(key)) return undefined;
    const value = this.#map.get(key);
    this.#map.delete(key);
    this.#map.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.#map.has(key)) this.#map.delete(key);
    this.#map.set(key, value);
    if (this.#map.size > this.#capacity) this.#map.delete(this.#map.keys().next().value);
  }

  has(key) {
    return this.#map.has(key);
  }

  get size() {
    return this.#map.size;
  }
}
```

%% exercise ds-top-k | Top K frequent | 3 | js | js | topKFrequent | 15
`topKFrequent(items, k)` returns the `k` most frequent values.

- Order by frequency **descending**; break ties by **first appearance** in `items`.
- If there are fewer than `k` distinct values, return them all. `k <= 0` returns `[]`.
- Values may be any type (compare with `Map` semantics).
- Aim for O(n log n) or better — try to finish with a **bucket** approach if you can.

%% starter
```js
export function topKFrequent(items, k) {
  // your code
}
```

%% tests
```js
describe('topKFrequent', () => {
  it('returns the most frequent items', () => {
    expect(topKFrequent([1, 1, 1, 2, 2, 3], 2)).toEqual([1, 2]);
  });
  it('breaks ties by first appearance', () => {
    expect(topKFrequent(['b', 'a', 'b', 'a', 'c'], 2)).toEqual(['b', 'a']);
    expect(topKFrequent(['x', 'y', 'z'], 2)).toEqual(['x', 'y']);
  });
  it('returns fewer when there are not enough distinct values', () => {
    expect(topKFrequent([1, 1, 2], 10)).toEqual([1, 2]);
  });
  it('handles k <= 0 and empty input', () => {
    expect(topKFrequent([1, 2], 0)).toEqual([]);
    expect(topKFrequent([1, 2], -1)).toEqual([]);
    expect(topKFrequent([], 3)).toEqual([]);
  });
  it('works with mixed types', () => {
    const obj = {};
    expect(topKFrequent([obj, 1, '1', obj, 1, obj], 2)).toEqual([obj, 1]);
  });
  it('k = 1 gives the mode', () => expect(topKFrequent([4, 5, 5, 6, 5, 4], 1)).toEqual([5]));
  it('handles large inputs', () => {
    const items = Array.from({ length: 200000 }, (_, i) => i % 1000);
    const start = Date.now();
    const out = topKFrequent(items, 3);
    expect(out).toEqual([0, 1, 2]);
    expect(Date.now() - start).toBeLessThan(500);
  });
});
```

%% worked
**A similar problem, solved: `mostCommonLetter(text)`** — count, then select the maximum.

```js
function mostCommonLetter(text) {
  const counts = new Map();
  for (const ch of text) counts.set(ch, (counts.get(ch) ?? 0) + 1);   // ① count in one pass: O(n)

  let best, bestCount = 0;
  for (const [ch, n] of counts) {          // ② a Map iterates in FIRST-SEEN order…
    if (n > bestCount) { best = ch; bestCount = n; }   // ③ …and strict `>` keeps the earliest on a tie
  }
  return best;
}
```

For top-K: after counting, sort the entries by count descending. Because `Array.prototype.sort` is **stable** and the Map iterates in first-appearance order, ties automatically keep first-appearance order. `slice(0, k)` handles "fewer than `k` distinct values" and `k <= 0` (return `[]`). For the O(n) **bucket** version: create an array of buckets indexed by frequency (`buckets[count].push(value)`), then walk from the highest frequency down collecting values until you have `k`.

%% explain
- **The `k` most frequent values**, ordered by frequency descending, ties by **first appearance**.
- **Fewer than `k` distinct** → all of them; **`k <= 0`** → `[]`.
- **Any value type** (compared with `Map` semantics).
- **O(n log n) or better**; try buckets for O(n).

%% nudge
- Which built-in behaviour gives you "ties by first appearance" without extra code?
- In the bucket approach, what is the index of each bucket?

%% hints
- Count with a `Map`. A `Map` also remembers **first insertion order**, which is your tie-breaker.
- Simple version: `[...counts].sort((a, b) => b[1] - a[1])` — the sort is stable, so ties keep insertion order.
- Bucket version: `buckets[count] = [values...]`, then walk from the highest count down and take `k`.

%% solution
```js
export function topKFrequent(items, k) {
  if (k <= 0) return [];
  const counts = new Map();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);

  const buckets = [];
  for (const [value, count] of counts) (buckets[count] ??= []).push(value);

  const out = [];
  for (let c = buckets.length - 1; c > 0 && out.length < k; c--) {
    if (buckets[c]) for (const v of buckets[c]) if (out.length < k) out.push(v);
  }
  return out;
}
```

%% exercise ds-trie | Trie with autocomplete | 3 | js | js | Trie | 22
Build a `Trie` (prefix tree).

- `insert(word)` — duplicates are fine. `has(word)` — exact match. `startsWith(prefix)` — is there any word with that prefix? (The empty prefix is true only if the trie is non-empty.)
- `suggest(prefix, limit = Infinity)` — words that start with `prefix`, in **alphabetical** order, at most `limit`.
- `remove(word)` — returns `true` if it existed. Removing must not affect other words sharing a prefix, and should not leave dead branches behind.
- `size` getter — number of distinct words.

%% starter
```js
export class Trie {
  // your code
}
```

%% tests
```js
describe('Trie', () => {
  const build = (...words) => { const t = new Trie(); words.forEach((w) => t.insert(w)); return t; };

  it('finds inserted words exactly', () => {
    const t = build('car', 'cart', 'care');
    expect(t.has('car')).toBe(true);
    expect(t.has('ca')).toBe(false);
    expect(t.has('cars')).toBe(false);
  });

  it('startsWith checks prefixes', () => {
    const t = build('apple');
    expect(t.startsWith('app')).toBe(true);
    expect(t.startsWith('apple')).toBe(true);
    expect(t.startsWith('apples')).toBe(false);
    expect(t.startsWith('b')).toBe(false);
  });

  it('empty prefix is true only when non-empty', () => {
    expect(new Trie().startsWith('')).toBe(false);
    expect(build('a').startsWith('')).toBe(true);
  });

  it('suggests alphabetically', () => {
    const t = build('car', 'cat', 'cart', 'care', 'dog', 'ca');
    expect(t.suggest('ca')).toEqual(['ca', 'car', 'care', 'cart', 'cat']);
    expect(t.suggest('car')).toEqual(['car', 'care', 'cart']);
    expect(t.suggest('x')).toEqual([]);
  });

  it('respects the limit', () => {
    const t = build('a', 'ab', 'abc', 'abd');
    expect(t.suggest('a', 2)).toEqual(['a', 'ab']);
    expect(t.suggest('a', 0)).toEqual([]);
  });

  it('suggest with an empty prefix lists everything', () => {
    expect(build('b', 'a', 'c').suggest('')).toEqual(['a', 'b', 'c']);
  });

  it('counts distinct words', () => {
    const t = build('a', 'a', 'ab');
    expect(t.size).toBe(2);
  });

  it('removes words without breaking neighbours', () => {
    const t = build('car', 'cart');
    expect(t.remove('car')).toBe(true);
    expect(t.has('car')).toBe(false);
    expect(t.has('cart')).toBe(true);
    expect(t.size).toBe(1);
    expect(t.remove('car')).toBe(false);
  });

  it('prunes dead branches', () => {
    const t = build('cart');
    t.remove('cart');
    expect(t.startsWith('c')).toBe(false);
    expect(t.size).toBe(0);
  });

  it('remove of an unknown prefix returns false', () => {
    const t = build('cart');
    expect(t.remove('car')).toBe(false);
    expect(t.has('cart')).toBe(true);
  });

  it('handles words that collide with Object.prototype names', () => {
    const t = build('constructor', 'toString', '__proto__');
    expect(t.has('constructor')).toBe(true);
    expect(t.has('con')).toBe(false);
    expect(t.suggest('_')).toEqual(['__proto__']);
  });
});
```

%% worked
**A similar problem, solved: a counting trie** — same node shape, but each node remembers how many words pass through it (for "how many words start with…?").

```js
class PrefixCounter {
  #root = { kids: new Map(), count: 0 };
  add(word) {
    let node = this.#root;
    for (const ch of word) {
      if (!node.kids.has(ch)) node.kids.set(ch, { kids: new Map(), count: 0 });   // ① one node per character
      node = node.kids.get(ch);
      node.count++;                                                               // ② every word through here passes this node
    }
  }
  countPrefix(prefix) {
    let node = this.#root;
    for (const ch of prefix) { node = node.kids.get(ch); if (!node) return 0; }   // ③ walk the prefix; a missing step → none
    return node.count;
  }
}
```

The `Trie` adds an **`end` flag** on nodes (`has` is a full walk that requires `end`; `startsWith` only requires the walk to succeed, and the empty prefix is true only when the trie has words). `suggest(prefix, limit)` walks to the prefix node and then does a **depth-first traversal** visiting children in **sorted key order**, collecting words whenever `end` is true, stopping at `limit`. `remove(word)` clears `end`, then prunes **upwards** any nodes that have no children and aren't word ends, so no dead branches remain; track `size` as the number of words.

%% explain
- **`insert`** (duplicates fine); **`has`** exact match; **`startsWith`** any word with the prefix (the empty prefix is true only for a non-empty trie).
- **`suggest(prefix, limit)`**: words starting with the prefix, **alphabetical**, at most `limit`.
- **`remove(word)`** returns `true` if it existed; it doesn't affect words sharing a prefix and leaves no dead branches.
- **`size`** = number of distinct words.

%% nudge
- How do you keep `suggest` results in alphabetical order without sorting all the words?
- After un-marking a word's end, which nodes can be deleted?

%% hints
- Node = `{ children: new Map(), end: false }`. Use a `Map` for children so keys like `constructor` are safe.
- Sort child keys when producing suggestions (or keep them sorted) — DFS in key order gives alphabetical output.
- `remove`: recurse down, unmark `end`, and on the way back up delete child nodes that are now empty and not the end of another word.

%% solution
```js
class Node {
  children = new Map();
  end = false;
}

export class Trie {
  #root = new Node();
  #size = 0;

  insert(word) {
    let node = this.#root;
    for (const ch of word) {
      if (!node.children.has(ch)) node.children.set(ch, new Node());
      node = node.children.get(ch);
    }
    if (!node.end) {
      node.end = true;
      this.#size++;
    }
  }

  #find(prefix) {
    let node = this.#root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return null;
    }
    return node;
  }

  has(word) {
    return this.#find(word)?.end === true;
  }

  startsWith(prefix) {
    const node = this.#find(prefix);
    return !!node && (node.end || node.children.size > 0);
  }

  suggest(prefix, limit = Infinity) {
    const out = [];
    const start = this.#find(prefix);
    if (!start || limit <= 0) return out;
    const walk = (node, path) => {
      if (out.length >= limit) return;
      if (node.end) out.push(path);
      for (const ch of [...node.children.keys()].sort()) {
        walk(node.children.get(ch), path + ch);
        if (out.length >= limit) return;
      }
    };
    walk(start, prefix);
    return out;
  }

  remove(word) {
    const chars = [...word];
    const path = [this.#root];
    for (const ch of chars) {
      const next = path[path.length - 1].children.get(ch);
      if (!next) return false;
      path.push(next);
    }
    const last = path[path.length - 1];
    if (!last.end) return false;
    last.end = false;
    this.#size--;
    for (let i = chars.length; i > 0; i--) {
      const node = path[i];
      if (node.end || node.children.size > 0) break;
      path[i - 1].children.delete(chars[i - 1]);
    }
    return true;
  }

  get size() {
    return this.#size;
  }
}
```
