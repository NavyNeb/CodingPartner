---
id: interview-ds
track: interview
title: Data structures & algorithms in JavaScript
summary: The recurring shapes — hash maps, stacks, intervals, caches, tries — and how to talk about them.
---

Most live-coding problems are one of about a dozen shapes wearing a costume. Your job in the first two minutes is to **name the shape**, state the complexity you're aiming for, and then write it.

## A repeatable routine

1. **Restate** the problem and ask about inputs: empty? duplicates? sorted? negative? size?
2. Work **one small example** by hand. Say the answer out loud.
3. Propose the **brute force** and its cost. Then improve it. ("O(n²) — the inner loop is a lookup; a `Map` makes it O(1).")
4. **Code it**, naming things well. Narrate invariants ("`stack` always holds unmatched openers").
5. **Test** with your example, an empty input, one element, and a nasty case.
6. State **time and space** complexity.

## The JavaScript toolbox

| Need | Use | Notes |
| --- | --- | --- |
| Lookup by key, counts | `Map` / `Set` | O(1) average. Keys can be any value. Iteration is insertion-ordered. |
| Dictionary of strings | `Map` (or `Object.create(null)`) | Plain `{}` inherits `toString`, `__proto__`… |
| Stack | array `push`/`pop` | O(1) |
| Queue | array `push` + `shift` | `shift` is O(n) on big arrays — use an index pointer or linked list for BFS on large inputs |
| Sorted order | `arr.sort(cmp)` | O(n log n), stable, **comparator must return a number** |
| Priority queue | binary heap you write | There's no built-in one |
| Deduping | `new Set(arr)` | Compares with SameValueZero (`NaN` equals `NaN`) |

`Map` preserves insertion order — which is exactly what you need for an **LRU cache**: "refresh" an entry by deleting and re-inserting it, and the *first* key is always the least recently used.

## Complexity cheat-sheet

- Hash map/set operations: O(1) average.
- Sorting: O(n log n). Scanning once: O(n). Nested loops over the same input: O(n²).
- Recursion depth counts as space (and the stack is only ~10k frames deep in practice).
- `includes`/`indexOf`/`find` on an array are O(n) — inside a loop that's the classic hidden O(n²).
- String concatenation in a loop is fine in modern engines; repeated `slice`/spread of arrays is O(n) each.

## Common shapes

- **Complement lookup** (two-sum): store what you've seen; ask "have I seen the number that completes this one?"
- **Stack matching** (parentheses, next-greater-element): push openers, pop on closers.
- **Sort then sweep** (intervals, meeting rooms): sort by start, then one pass merging.
- **Hash-of-canonical-form** (anagrams): map each item to a key that's identical for equivalent items.
- **Count then select** (top-K): frequency map, then sort/bucket/heap.
- **Prefix tree** (autocomplete): one node per character; shared prefixes share nodes.
- **Design a structure** (LRU, min-stack): choose internal structures so each operation hits its complexity target.

## Talking about trade-offs

Interviewers grade *how you reason*. When two approaches exist, say both, pick one, and say what would make you switch ("If memory mattered more than speed I'd sort in place and use two pointers").

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
