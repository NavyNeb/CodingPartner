---
id: ds-choosing
track: ds
title: Choosing the right structure
summary: A repeatable way to pick a data structure from the operations a problem needs, how to read the input size, and how real designs (LRU, randomized sets, LFU, rate limiters) combine two structures.
---

## The idea in one sentence

You rarely have to *invent* an algorithm: list **what operations you need and how often**, **read how big the input is**, and let those two facts point at a structure — or at a **pair** of structures that cover each other's weaknesses.

> **Analogy** A carpenter doesn't ask "which tool is best?" in the abstract. They ask what they need to do — cut, join, smooth — and how much wood there is, then pick. A hammer is "worse" than a saw only for cutting.

## A routine for choosing

1. **List the operations** the problem needs: insert, delete, find by key, find the smallest, iterate in order, get the most recent…
2. **Note how often** each happens. Reads far outnumber writes? A "top 10" asked a million times?
3. **Read the input size**: it tells you which running time you can afford.
4. **Match each operation to a structure** that makes it cheap.
5. If two operations want **different structures**, use **two** and keep them in sync.
6. **Check the edges**: empty, one item, duplicates, ties, what "not found" returns.

![A chooser from what a problem needs to the structure to reach for](fig:ds-structure-chooser "Start from the operations; the structure follows.")

## What can I afford?

The size of the input narrows the choices before you think about structures at all.

![Growth rates, the input size each can handle in about a second, and examples](fig:ds-complexity-ladder "Roughly 10⁸ simple steps per second: 100 000 items rules out O(n²) but allows O(n log n).")

A constraint like "up to 100 000 items" is a hint: an O(n²) approach (≈ 10¹⁰ steps) is out, so look for a **hash map**, a **sort**, a **heap** or a **single pass** (see the earlier lessons for each). "Up to 20 items" suggests brute force or backtracking is fine.

## Two structures are better than one

Hard design questions almost always combine structures, because each is good at one job and poor at another:

![LRU cache, randomized set and LFU cache each combine two structures](fig:ds-combine "The hash map finds in O(1); the other structure supplies order, density or counts.")

- **LRU cache** (least recently used): a **hash map** finds the entry in O(1); a **doubly linked list** keeps recency order so moving to the front and evicting the tail are O(1).
- **Randomized set** (insert, remove and *random pick* all O(1)): an **array** gives O(1) random access but removing from the middle is O(n); a **hash map** of `item → index` fixes that with a trick: **swap the removed item with the last one**, then pop.
- **LFU cache** (least *frequently* used): a map from key to value and use-count, plus **buckets** from count to the keys with that count, kept in order of use.

```stepper Randomized set: O(1) removal by swapping with the last item
code:
  remove(x) {
    const i = this.index.get(x);        // where does x live in the array?
    if (i === undefined) return false;
    const last = this.items.at(-1);
    this.items[i] = last;               // move the last item into the hole
    this.index.set(last, i);            // ...and update its index
    this.items.pop();                   // drop the (now duplicate) last slot
    this.index.delete(x);
    return true;
  }
  // items = [4, 7, 9, 2], remove(7)
---
line: 2
say: The map says `7` lives at index `1`.
items: 4 | 7 | 9 | 2
index: 4→0 | 7→1 | 9→2 | 2→3
---
line: 4-5
say: Take the **last** item (`2`) and write it into `7`'s slot. Deleting from the middle of an array would shift everything (O(n)); overwriting one slot is O(1).
items: 4 | 2 | 9 | 2
---
line: 6
say: `2` now lives at index `1`: update the map so it stays correct.
index: 4→0 | 7→1 | 9→2 | 2→1
---
line: 7
say: Pop the duplicate last slot. The array is dense again, with no holes.
items: 4 | 2 | 9
---
line: 8-9
say: Finally forget `7` in the map. Order inside the array doesn't matter for a set, so every operation, including picking a random item with `items[random index]`, is **O(1)**.
index: 4→0 | 9→2 | 2→1
Result: true
```

## Other combinations to recognise

- **Sorted array + binary search** answers "the latest value *at or before* time `t`" in O(log n) (a time-based key-value store: a hash map from key to a sorted list of timestamps).
- **Queue of timestamps** gives a **rate limiter**: drop timestamps that fell out of the window from the front, count what's left.
- **Trie + sorting or a heap** powers **autocomplete**: walk to the prefix node, then rank the words below it.
- **Hash map + heap** (with *lazy deletion*) is how schedulers and Dijkstra handle "update the priority": push a new entry, skip stale ones when popped.

## Saying it out loud

In an interview, narrate the routine: *"I need lookups by key and removal of the oldest — a map alone can't order, a list alone can't find, so I'll pair them. `get` and `put` are then O(1)."* Name the operations, name the structure for each, state the cost, then code.

## Quick check

```check
Q: A problem allows up to 200 000 items and the obvious solution is two nested loops. What should you do first?
A) Use the nested loops: computers are fast
B) Look for a hash map, sort, heap or single-pass approach, because O(n²) is about 4×10¹⁰ steps *
C) Switch to a different language
D) Use recursion
Why: Roughly 10⁸ simple steps run per second, so 4×10¹⁰ is far too slow; O(n) or O(n log n) are the targets.
---
Q: Why does an LRU cache need both a hash map and a doubly linked list?
A) The map finds an entry in O(1); the list reorders and evicts in O(1) *
B) Lists are sorted
C) The map stores order
D) It saves memory
Why: Each structure covers the other's weakness: lists can't find by key, maps can't track recency.
---
Q: In the randomized set, why swap the removed item with the last one?
A) It sorts the array
B) It makes removal O(1) instead of O(n) (no shifting) while keeping the array dense for random picks *
C) Maps require it
D) It keeps insertion order
Why: Removing from the middle of an array shifts the items after it; overwriting one slot and popping the end does not.
---
Q: Which structure answers "what was the latest value at or before time t?" fastest, given values arrive in time order?
A) An unsorted list scanned each time
B) A sorted list of timestamps with binary search, O(log n) *
C) A stack
D) A set
Why: Timestamps arrive sorted, so binary search finds the boundary without scanning.
---
Q: What do you check before coding a design problem?
A) Nothing, start typing
B) The operations needed, how often each happens, the input size, and the edge cases *
C) Only the language
D) Only memory use
Why: Operations and sizes decide the structure; edge cases (empty, ties, not found) decide the details.
```

## Recap

- **Choose from the operations** you need, their frequency and the **input size**; check the edge cases.
- The size of `n` rules out whole **running-time classes** before you pick a structure.
- **Pair two structures** when no single one is good at everything: map + linked list (LRU), array + map (randomized set), map + count buckets (LFU), sorted array + map (time-based store).
- **Narrate** the operations, the structure for each, and the cost.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: rate limiter | A queue of timestamps with a head pointer |
| Leaderboard | A `Map` of totals; take the top K by sorting or a heap |
| Time-based store | A `Map` of sorted arrays and a binary search for "at or before" |
| Randomized set | The swap-with-last trick (stepper) |
| Autocomplete | A trie walk to the prefix, then rank what is below |
| LFU cache | Two maps and a minimum-frequency pointer |

%% exercise dst-guided-rate-limiter | Guided: a rate limiter | 1 | js | js | RateLimiter | 12 | guided
Build `class RateLimiter(limit, windowMs)` that allows **at most `limit` requests in any window of `windowMs` milliseconds**.

- `allow(t)` takes the request time `t` (non-decreasing across calls). Return `true` and **record** the request if fewer than `limit` allowed requests happened in the window `(t - windowMs, t]`; otherwise return `false` (and record nothing).

```js
const r = new RateLimiter(3, 10);
r.allow(1); r.allow(2); r.allow(3); // true, true, true
r.allow(4);                          // false  (3 already in the last 10)
r.allow(11);                         // true   (the request at 1 has left the window)
```

%% worked
**A similar problem, solved: `countRecent(times, t, windowMs)`** — how many timestamps fall in the window?

```js
function countRecent(times, t, windowMs) {
  let count = 0;
  for (const x of times) if (x > t - windowMs && x <= t) count++;   // ① in the window (t - windowMs, t]
  return count;
}
```

Scanning everything works but is O(n). Since timestamps only move forward, the **old ones are always at the front**: keep them in a queue, **drop from the front** while `x <= t - windowMs`, and then the queue's length *is* the count. Each timestamp is added once and dropped once, so `allow` is **amortised O(1)**.

%% explain
- **Window** is `(t - windowMs, t]`: a request exactly `windowMs` old has expired.
- **Rejected requests are not recorded**.
- **Timestamps never go backwards**, so only the front can expire.
- **Amortised O(1)**.

%% nudge
- Which end of the list holds the oldest timestamp?
- When is it safe to stop dropping?

%% starter
```js
export class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.times = [];
    this.head = 0;
  }

  allow(t) {
    // Step 1 — advance head while times[head] <= t - windowMs (expired).
    // Step 2 — count = times.length - head. If count >= limit, return false.
    // Step 3 — otherwise push t and return true.
    return false;
  }
}
```

%% tests
```js
describe('RateLimiter', () => {
  it('allows up to the limit, then rejects', () => {
    const r = new RateLimiter(3, 10);
    expect([r.allow(1), r.allow(2), r.allow(3), r.allow(4)]).toEqual([true, true, true, false]);
  });

  it('lets requests through again as old ones leave the window', () => {
    const r = new RateLimiter(3, 10);
    [1, 2, 3].forEach((t) => r.allow(t));
    expect(r.allow(10)).toBe(false);
    expect(r.allow(11)).toBe(true);
    expect(r.allow(12)).toBe(true);
    expect(r.allow(13)).toBe(true);
    expect(r.allow(14)).toBe(false);
  });

  it('does not count rejected requests', () => {
    const r = new RateLimiter(1, 5);
    expect(r.allow(0)).toBe(true);
    expect(r.allow(1)).toBe(false);
    expect(r.allow(2)).toBe(false);
    expect(r.allow(5)).toBe(true);
  });

  it('treats the window as (t - windowMs, t]', () => {
    const r = new RateLimiter(1, 10);
    r.allow(0);
    expect(r.allow(9)).toBe(false);
    expect(r.allow(10)).toBe(true);
  });

  it('handles simultaneous requests', () => {
    const r = new RateLimiter(2, 100);
    expect([r.allow(5), r.allow(5), r.allow(5)]).toEqual([true, true, false]);
  });

  it('is fast: 200 000 calls', () => {
    const r = new RateLimiter(100, 1000);
    const t = Date.now();
    let allowed = 0;
    for (let i = 0; i < 200000; i++) if (r.allow(i)) allowed++;
    expect(Date.now() - t).toBeLessThan(800);
    expect(allowed).toBeGreaterThan(19000);
  });
});
```

%% hints
- `while (this.head < this.times.length && this.times[this.head] <= t - this.windowMs) this.head++;`
- `if (this.times.length - this.head >= this.limit) return false; this.times.push(t); return true;`

%% solution
```js
export class RateLimiter {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.times = [];
    this.head = 0;
  }

  allow(t) {
    while (this.head < this.times.length && this.times[this.head] <= t - this.windowMs) this.head++;
    if (this.times.length - this.head >= this.limit) return false;
    this.times.push(t);
    if (this.head > 1024 && this.head * 2 > this.times.length) {
      this.times = this.times.slice(this.head);
      this.head = 0;
    }
    return true;
  }
}
```

%% exercise dst-leaderboard | Leaderboard | 2 | js | js | Leaderboard | 16
Build `class Leaderboard`:

- `addScore(player, score)` adds `score` to the player's total (a new player starts at `0`).
- `top(k)` returns the **sum of the `k` highest totals** (all of them if there are fewer than `k` players).
- `reset(player)` erases the player's score (they drop off the board).

```js
const lb = new Leaderboard();
lb.addScore(1, 73); lb.addScore(2, 56); lb.addScore(3, 39);
lb.top(2); // 129
```

%% worked
**A similar problem, solved: `bestK(values, k)`** — the sum of the K largest numbers.

```js
function bestK(values, k) {
  return values.slice().sort((a, b) => b - a)    // ① copy first: sort() mutates; then biggest first
    .slice(0, k)                                 // ② keep K
    .reduce((sum, x) => sum + x, 0);             // ③ add them up
}
```

For the leaderboard you also need a **lookup by player** — a `Map` from player to total — and then `top(k)` is `bestK` of `map.values()`. (If `top` were called constantly on a huge board, a heap or a sorted structure would be better; for these sizes sorting each time is fine — state that trade-off.)

%% explain
- **Totals accumulate** across `addScore` calls.
- **`reset` removes** the player entirely.
- **`top(k)`** sums the biggest `k` totals; fewer players than `k` → sum them all.
- **Empty board** gives `0`.

%% nudge
- What structure maps a player to their total?
- Does `sort` change the array you call it on?

%% starter
```js
export class Leaderboard {
  constructor() {
    this.scores = new Map();
  }

  addScore(player, score) {
    // your code
  }

  top(k) {
    // your code
    return 0;
  }

  reset(player) {
    // your code
  }
}
```

%% tests
```js
describe('Leaderboard', () => {
  it('accumulates scores and sums the top K', () => {
    const lb = new Leaderboard();
    lb.addScore(1, 73); lb.addScore(2, 56); lb.addScore(3, 39); lb.addScore(4, 51); lb.addScore(5, 4);
    expect(lb.top(1)).toBe(73);
    lb.addScore(1, 10);
    expect(lb.top(1)).toBe(83);
    expect(lb.top(2)).toBe(139);
  });

  it('resets a player', () => {
    const lb = new Leaderboard();
    lb.addScore(1, 73); lb.addScore(2, 56); lb.addScore(3, 39); lb.addScore(4, 51); lb.addScore(5, 4);
    lb.reset(1);
    lb.reset(2);
    lb.addScore(2, 51);
    expect(lb.top(3)).toBe(141);
  });

  it('handles fewer players than K and an empty board', () => {
    const lb = new Leaderboard();
    expect(lb.top(3)).toBe(0);
    lb.addScore('a', 5);
    expect(lb.top(10)).toBe(5);
  });

  it('works with string players and repeated resets', () => {
    const lb = new Leaderboard();
    lb.addScore('ann', 10); lb.addScore('bob', 20);
    lb.reset('ann'); lb.reset('ann'); lb.reset('nobody');
    expect(lb.top(2)).toBe(20);
  });

  it('is fast: 1 000 players, 1 000 top(10) queries', () => {
    const lb = new Leaderboard();
    for (let i = 0; i < 1000; i++) lb.addScore(i, (i * 7919) % 1000);
    const t = Date.now();
    let total = 0;
    for (let q = 0; q < 1000; q++) total += lb.top(10);
    expect(Date.now() - t).toBeLessThan(800);
    expect(total).toBe(1000 * lb.top(10));
    expect(lb.top(1)).toBe(999);
  });
});
```

%% hints
- `addScore`: `this.scores.set(player, (this.scores.get(player) ?? 0) + score)`.
- `top`: `[...this.scores.values()].sort((a, b) => b - a).slice(0, k)` then sum.
- `reset`: `this.scores.delete(player)`.

%% solution
```js
export class Leaderboard {
  constructor() {
    this.scores = new Map();
  }

  addScore(player, score) {
    this.scores.set(player, (this.scores.get(player) ?? 0) + score);
  }

  top(k) {
    return [...this.scores.values()]
      .sort((a, b) => b - a)
      .slice(0, k)
      .reduce((sum, x) => sum + x, 0);
  }

  reset(player) {
    this.scores.delete(player);
  }
}
```

%% exercise dst-time-map | A time-based key-value store | 3 | js | js | TimeMap | 26
Build `class TimeMap`, a store where each key's value **changes over time**.

- `set(key, value, timestamp)` records `value` for `key` at `timestamp`. For one key, timestamps are **strictly increasing** across `set` calls.
- `get(key, timestamp)` returns the value with the **largest recorded timestamp ≤ `timestamp`**, or `''` if there is none (or the key is unknown).

```js
const m = new TimeMap();
m.set('x', 'a', 1); m.set('x', 'b', 4);
m.get('x', 3); // 'a'
m.get('x', 4); // 'b'
m.get('x', 0); // ''
```

Each `get` must be **O(log n)**: the tests store 100 000 values under *one* key and then query 100 000 times.

%% worked
**A similar problem, solved: `floorIndex(sorted, x)`** — the index of the largest item `<= x`, or `-1`.

```js
function floorIndex(sorted, x) {
  let lo = 0, hi = sorted.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) { ans = mid; lo = mid + 1; }   // ① mid qualifies: remember it, look for a better one to the right
    else hi = mid - 1;                                   // ② too big: go left
  }
  return ans;
}
```

Because timestamps per key arrive in increasing order, **appending keeps each key's list sorted for free**. So: a `Map` from key to `{ times: [], values: [] }`, and `get` is `floorIndex` on `times`.

%% explain
- **Per-key sorted lists**, appended in order.
- **`get`** finds the **last time ≤ requested** by binary search.
- **Unknown key or no earlier time** returns the empty string.
- **O(log n) per get**, O(1) per set.

%% nudge
- Why is each key's list always sorted without extra work?
- When the middle qualifies, which side do you keep searching?

%% starter
```js
export class TimeMap {
  constructor() {
    this.data = new Map();
  }

  set(key, value, timestamp) {
    // your code
  }

  get(key, timestamp) {
    // your code
    return '';
  }
}
```

%% tests
```js
describe('TimeMap', () => {
  it('returns the latest value at or before the timestamp', () => {
    const m = new TimeMap();
    m.set('foo', 'bar', 1);
    expect(m.get('foo', 1)).toBe('bar');
    expect(m.get('foo', 3)).toBe('bar');
    m.set('foo', 'bar2', 4);
    expect(m.get('foo', 4)).toBe('bar2');
    expect(m.get('foo', 5)).toBe('bar2');
    expect(m.get('foo', 3)).toBe('bar');
  });

  it('returns an empty string when there is nothing earlier', () => {
    const m = new TimeMap();
    m.set('foo', 'x', 5);
    expect(m.get('foo', 4)).toBe('');
    expect(m.get('missing', 10)).toBe('');
  });

  it('keeps keys separate', () => {
    const m = new TimeMap();
    m.set('a', '1', 1); m.set('b', '2', 2); m.set('a', '3', 3);
    expect(m.get('a', 2)).toBe('1');
    expect(m.get('b', 2)).toBe('2');
    expect(m.get('a', 9)).toBe('3');
  });

  it('is fast: 100 000 values under one key', () => {
    const m = new TimeMap();
    const t = Date.now();
    for (let i = 1; i <= 100000; i++) m.set('k', 'v' + i, i * 2);
    for (let i = 1; i <= 100000; i++) {
      if (m.get('k', i * 2 + 1) !== 'v' + i) throw new Error('wrong value at ' + i);
    }
    expect(Date.now() - t).toBeLessThan(800);
    expect(m.get('k', 1)).toBe('');
  });
});
```

%% hints
- Per key store two parallel arrays (`times`, `values`) and `push` on `set`.
- `get`: binary search for the largest index with `times[i] <= timestamp`; return `values[i]` or `''` when none.

%% solution
```js
export class TimeMap {
  constructor() {
    this.data = new Map();
  }

  set(key, value, timestamp) {
    let entry = this.data.get(key);
    if (!entry) {
      entry = { times: [], values: [] };
      this.data.set(key, entry);
    }
    entry.times.push(timestamp);
    entry.values.push(value);
  }

  get(key, timestamp) {
    const entry = this.data.get(key);
    if (!entry) return '';
    const { times, values } = entry;
    let lo = 0, hi = times.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (times[mid] <= timestamp) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans === -1 ? '' : values[ans];
  }
}
```

%% exercise dst-randomized-set | Randomized set | 3 | js | js | RandomizedSet | 26
Build `class RandomizedSet` where **all three operations are O(1)** (average):

- `insert(x)` adds `x` and returns `true`, or returns `false` if it was already present.
- `remove(x)` removes `x` and returns `true`, or returns `false` if it was absent.
- `getRandom(rand = Math.random)` returns a random element, each equally likely: pick index `Math.floor(rand() * size)` (the tests pass a fixed `rand`). Return `undefined` if empty.

Use an **array** plus a **`Map` from item to its index**: remove by swapping the item with the last one.

%% worked
**A similar problem, solved: `removeAt(items, i)`** — delete one slot without shifting.

```js
function removeAt(items, i) {
  items[i] = items[items.length - 1];     // ① overwrite the slot with the last item
  items.pop();                            // ② drop the last slot: O(1), order not preserved
}
```

That is the entire trick, plus **keeping the map in sync**: when the last item moves into slot `i`, set `index.set(last, i)`. When the item removed *is* the last one, there is nothing to move — just pop and delete.

%% explain
- **Array** of items (dense, no holes) and **Map** item → index.
- **`insert`**: push, record the index.
- **`remove`**: move the last item into the removed slot, fix its index, pop, delete the removed item.
- **`getRandom`** reads `items[Math.floor(rand() * items.length)]`.

%% nudge
- What changes in the map when the last item moves?
- What if the item you remove *is* the last one?

%% starter
```js
export class RandomizedSet {
  constructor() {
    this.items = [];
    this.index = new Map();
  }

  insert(x) {
    // your code
    return false;
  }

  remove(x) {
    // your code
    return false;
  }

  getRandom(rand = Math.random) {
    // your code
    return undefined;
  }
}
```

%% tests
```js
describe('RandomizedSet', () => {
  it('inserts and removes with the right results', () => {
    const s = new RandomizedSet();
    expect(s.insert(1)).toBe(true);
    expect(s.insert(1)).toBe(false);
    expect(s.insert(2)).toBe(true);
    expect(s.remove(1)).toBe(true);
    expect(s.remove(1)).toBe(false);
    expect(s.remove(99)).toBe(false);
  });

  it('can return every element through getRandom', () => {
    const s = new RandomizedSet();
    [10, 20, 30, 40].forEach((x) => s.insert(x));
    s.remove(20);
    const seen = new Set();
    for (let i = 0; i < 3; i++) seen.add(s.getRandom(() => i / 3));
    expect([...seen].sort((a, b) => a - b)).toEqual([10, 30, 40]);
  });

  it('uses the supplied random function', () => {
    const s = new RandomizedSet();
    s.insert('a');
    expect(s.getRandom(() => 0)).toBe('a');
    expect(s.getRandom(() => 0.999)).toBe('a');
  });

  it('returns undefined when empty', () => {
    const s = new RandomizedSet();
    expect(s.getRandom()).toBeUndefined();
    s.insert(1);
    s.remove(1);
    expect(s.getRandom()).toBeUndefined();
  });

  it('survives removing the last element and removing everything', () => {
    const s = new RandomizedSet();
    [1, 2, 3].forEach((x) => s.insert(x));
    expect(s.remove(3)).toBe(true);
    expect(s.remove(1)).toBe(true);
    expect(s.remove(2)).toBe(true);
    expect(s.insert(2)).toBe(true);
    expect(s.getRandom(() => 0)).toBe(2);
  });

  it('is fast: 100 000 inserts and removals', () => {
    const s = new RandomizedSet();
    const t = Date.now();
    for (let i = 0; i < 100000; i++) s.insert(i);
    for (let i = 0; i < 100000; i += 2) s.remove(i);
    let ok = true;
    for (let i = 0; i < 1000; i++) if (s.getRandom() % 2 === 0) ok = false;
    expect(Date.now() - t).toBeLessThan(800);
    expect(ok).toBe(true);
  });
});
```

%% hints
- `insert`: if `index.has(x)` return `false`; else `index.set(x, items.length); items.push(x); return true`.
- `remove`: `const i = index.get(x)`; `const last = items[items.length - 1]; items[i] = last; index.set(last, i); items.pop(); index.delete(x);`.

%% solution
```js
export class RandomizedSet {
  constructor() {
    this.items = [];
    this.index = new Map();
  }

  insert(x) {
    if (this.index.has(x)) return false;
    this.index.set(x, this.items.length);
    this.items.push(x);
    return true;
  }

  remove(x) {
    const i = this.index.get(x);
    if (i === undefined) return false;
    const last = this.items[this.items.length - 1];
    this.items[i] = last;
    this.index.set(last, i);
    this.items.pop();
    this.index.delete(x);
    return true;
  }

  getRandom(rand = Math.random) {
    if (this.items.length === 0) return undefined;
    return this.items[Math.floor(rand() * this.items.length)];
  }
}
```

%% exercise dst-autocomplete | Autocomplete suggestions | 3 | js | js | Autocomplete | 30
Build `class Autocomplete`:

- `add(term, weight)` stores a term with a numeric weight (higher = more popular). Adding an existing term **replaces** its weight.
- `suggest(prefix, k)` returns up to `k` stored terms that **start with `prefix`**, ordered by **weight descending**, then **alphabetically** for ties. The empty prefix matches everything.

Use a **trie**: walk to the prefix's node, collect the terms below it, rank them.

```js
const a = new Autocomplete();
a.add('car', 5); a.add('cat', 9); a.add('card', 5); a.add('dog', 7);
a.suggest('ca', 2); // ['cat', 'car']
```

%% worked
**A similar problem, solved: `wordsBelow(node)`** — gather every word under a trie node with a depth-first walk.

```js
function wordsBelow(node, path = '', out = []) {
  if (node.isWord) out.push(path);                           // ① a word ends here
  for (const [ch, child] of node.children) {
    wordsBelow(child, path + ch, out);                       // ② recurse into each child with the letter added
  }
  return out;
}
```

Walk the prefix first (`node = node.children.get(ch)`, giving up with `[]` if a letter is missing), then call `wordsBelow` from that node, **prefixing** every result with the prefix path. Rank with a comparator: `b.weight - a.weight || a.term.localeCompare(b.term)`. (A production version caches the top-K suggestions at each node so a query never touches the whole subtree.)

%% explain
- **Trie of letters**; nodes mark where a term ends and store its weight.
- **`suggest`**: walk to the prefix node, collect terms below, sort by `(-weight, term)`, take `k`.
- **Missing prefix** returns `[]`; **`k` larger than the matches** returns all.
- **Re-adding** a term updates its weight.

%% nudge
- What do you store on a node to know a term ends there, and with what weight?
- How do you break ties between equal weights?

%% starter
```js
export class Autocomplete {
  constructor() {
    this.root = { children: new Map(), weight: null };
  }

  add(term, weight) {
    // your code
  }

  suggest(prefix, k) {
    // your code
    return [];
  }
}
```

%% tests
```js
describe('Autocomplete', () => {
  const build = () => {
    const a = new Autocomplete();
    a.add('car', 5); a.add('cat', 9); a.add('card', 5); a.add('dog', 7);
    return a;
  };

  it('ranks by weight, then alphabetically', () => {
    const a = build();
    expect(a.suggest('ca', 3)).toEqual(['cat', 'car', 'card']);
    expect(a.suggest('ca', 2)).toEqual(['cat', 'car']);
  });

  it('includes an exact match', () => {
    expect(build().suggest('car', 5)).toEqual(['car', 'card']);
  });

  it('returns [] for an unknown prefix', () => {
    expect(build().suggest('x', 3)).toEqual([]);
    expect(build().suggest('cow', 3)).toEqual([]);
  });

  it('matches everything for the empty prefix', () => {
    expect(build().suggest('', 2)).toEqual(['cat', 'dog']);
    expect(build().suggest('', 10)).toEqual(['cat', 'dog', 'car', 'card']);
  });

  it('replaces the weight of a re-added term', () => {
    const a = build();
    a.add('card', 100);
    expect(a.suggest('ca', 1)).toEqual(['card']);
  });

  it('returns nothing when k is 0', () => {
    expect(build().suggest('ca', 0)).toEqual([]);
  });

  it('is fast with 5 000 terms', () => {
    const a = new Autocomplete();
    for (let i = 0; i < 5000; i++) a.add('term' + i, (i * 7919) % 1000);
    const t = Date.now();
    for (let q = 0; q < 200; q++) a.suggest('term' + (q % 10), 5);
    expect(Date.now() - t).toBeLessThan(800);
    expect(a.suggest('term49', 3).length).toBe(3);
  });
});
```

%% hints
- Node shape: `{ children: new Map(), weight: null }` (`weight !== null` means a term ends here). `add` walks/creates nodes for each letter and sets `weight` on the last.
- `suggest`: walk the prefix (return `[]` if a letter is missing); depth-first collect `{ term, weight }` below, building the string as you go.
- Sort with `(x, y) => y.weight - x.weight || (x.term < y.term ? -1 : x.term > y.term ? 1 : 0)` and `slice(0, k)`.

%% solution
```js
export class Autocomplete {
  constructor() {
    this.root = { children: new Map(), weight: null };
  }

  add(term, weight) {
    let node = this.root;
    for (const ch of term) {
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map(), weight: null };
        node.children.set(ch, next);
      }
      node = next;
    }
    node.weight = weight;
  }

  suggest(prefix, k) {
    if (k <= 0) return [];
    let node = this.root;
    for (const ch of prefix) {
      node = node.children.get(ch);
      if (!node) return [];
    }
    const found = [];
    const stack = [[node, prefix]];
    while (stack.length) {
      const [n, path] = stack.pop();
      if (n.weight !== null) found.push({ term: path, weight: n.weight });
      for (const [ch, child] of n.children) stack.push([child, path + ch]);
    }
    found.sort((x, y) => y.weight - x.weight || (x.term < y.term ? -1 : x.term > y.term ? 1 : 0));
    return found.slice(0, k).map((f) => f.term);
  }
}
```

%% exercise dst-lfu-cache | LFU cache | 4 | js | js | LFUCache | 40
Build `class LFUCache(capacity)`, a cache that evicts the **least frequently used** key.

- `get(key)` returns the value, or `-1` if absent. A successful `get` counts as a **use**.
- `put(key, value)` inserts or updates. Updating an existing key also counts as a **use**. If a **new** key arrives and the cache is full, first **evict the least frequently used** key; among keys with the same frequency, evict the **least recently used**. A new key starts with frequency `1`.
- A capacity of `0` stores nothing.

Both operations must be **O(1)** on average.

```js
const c = new LFUCache(2);
c.put(1, 1); c.put(2, 2);
c.get(1);    // 1   (key 1 now used twice)
c.put(3, 3); // evicts key 2 (used once)
c.get(2);    // -1
```

%% worked
**A similar problem, solved: `UseCounter`** — track how often each key is used, and find the least used.

```js
class UseCounter {
  constructor() { this.count = new Map(); }
  use(key) { this.count.set(key, (this.count.get(key) ?? 0) + 1); }   // ① a Map key → count: O(1) to bump
  leastUsed() {
    let best, bestCount = Infinity;
    for (const [k, c] of this.count) if (c < bestCount) { best = k; bestCount = c; }   // ② but finding the minimum scans: O(n)
    return best;
  }
}
```

Bumping is O(1), but `leastUsed` scans everything. The fix is a **second structure**: **buckets by frequency**. Keep `freq → Set of keys` (a `Set` iterates in insertion order, so its first key is the least recently used one *at that frequency*) and a number `minFreq`. A use moves a key from bucket `f` to bucket `f + 1`; if bucket `f` was the minimum and is now empty, `minFreq++`. A new key resets `minFreq` to `1`. Evict = the first key of bucket `minFreq`.

%% explain
- **`entries`**: `key → { value, freq }`.
- **`buckets`**: `freq → Set of keys`, in order of last use.
- **`minFreq`** always names the lowest non-empty bucket.
- **Touching a key** moves it up one bucket (and to the back of that bucket's order).
- **Eviction** removes the first key of `buckets.get(minFreq)`.

%% nudge
- Why does a `Set` give you "least recently used within a frequency" for free?
- When is `minFreq` reset to `1`, and when does it increase?

%% starter
```js
export class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.entries = new Map();   // key -> { value, freq }
    this.buckets = new Map();   // freq -> Set of keys, oldest first
    this.minFreq = 0;
  }

  touch(key) {
    // move key from bucket freq to bucket freq + 1 (and fix minFreq)
  }

  get(key) {
    // your code
    return -1;
  }

  put(key, value) {
    // your code
  }
}
```

%% tests
```js
describe('LFUCache', () => {
  it('evicts the least frequently used key', () => {
    const c = new LFUCache(2);
    c.put(1, 1); c.put(2, 2);
    expect(c.get(1)).toBe(1);
    c.put(3, 3);
    expect(c.get(2)).toBe(-1);
    expect(c.get(3)).toBe(3);
    c.put(4, 4);
    expect(c.get(1)).toBe(-1);
    expect(c.get(3)).toBe(3);
    expect(c.get(4)).toBe(4);
  });

  it('breaks frequency ties by least recent use', () => {
    const c = new LFUCache(2);
    c.put(1, 1); c.put(2, 2);
    c.put(3, 3);
    expect(c.get(1)).toBe(-1);
    expect(c.get(2)).toBe(2);
    expect(c.get(3)).toBe(3);
  });

  it('counts an update as a use', () => {
    const c = new LFUCache(2);
    c.put(1, 1); c.put(2, 2);
    c.put(1, 10);
    c.put(3, 3);
    expect(c.get(2)).toBe(-1);
    expect(c.get(1)).toBe(10);
    expect(c.get(3)).toBe(3);
  });

  it('ignores everything at capacity 0', () => {
    const c = new LFUCache(0);
    c.put(0, 0);
    expect(c.get(0)).toBe(-1);
  });

  it('handles a capacity of 1', () => {
    const c = new LFUCache(1);
    c.put(1, 1);
    c.put(2, 2);
    expect(c.get(1)).toBe(-1);
    expect(c.get(2)).toBe(2);
  });

  it('keeps a hot key alive', () => {
    const c = new LFUCache(3);
    c.put('hot', 1);
    for (let i = 0; i < 10; i++) c.get('hot');
    for (let i = 0; i < 20; i++) c.put('k' + i, i);
    expect(c.get('hot')).toBe(1);
  });

  it('is fast: 100 000 operations', () => {
    const c = new LFUCache(1000);
    const t = Date.now();
    for (let i = 0; i < 100000; i++) {
      const k = (i * 7919) % 3000;
      if (i % 3) c.get(k); else c.put(k, i);
    }
    expect(Date.now() - t).toBeLessThan(900);
  });
});
```

%% hints
- `touch(key)`: remove `key` from `buckets.get(freq)`; if that set is now empty, delete it and, when `freq === minFreq`, do `minFreq++`. Then add the key to the bucket `freq + 1` (create it if needed) and bump the entry's `freq`.
- `put` of a new key at capacity: take the first key of `buckets.get(minFreq)` (`set.values().next().value`), delete it from `entries` and from its bucket, then insert the new one with `freq: 1`, `minFreq = 1`.

%% solution
```js
export class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.entries = new Map();
    this.buckets = new Map();
    this.minFreq = 0;
  }

  touch(key) {
    const entry = this.entries.get(key);
    const bucket = this.buckets.get(entry.freq);
    bucket.delete(key);
    if (bucket.size === 0) {
      this.buckets.delete(entry.freq);
      if (this.minFreq === entry.freq) this.minFreq++;
    }
    entry.freq++;
    if (!this.buckets.has(entry.freq)) this.buckets.set(entry.freq, new Set());
    this.buckets.get(entry.freq).add(key);
  }

  get(key) {
    if (!this.entries.has(key)) return -1;
    this.touch(key);
    return this.entries.get(key).value;
  }

  put(key, value) {
    if (this.capacity === 0) return;
    if (this.entries.has(key)) {
      this.entries.get(key).value = value;
      this.touch(key);
      return;
    }
    if (this.entries.size >= this.capacity) {
      const bucket = this.buckets.get(this.minFreq);
      const evict = bucket.values().next().value;
      bucket.delete(evict);
      if (bucket.size === 0) this.buckets.delete(this.minFreq);
      this.entries.delete(evict);
    }
    this.entries.set(key, { value, freq: 1 });
    if (!this.buckets.has(1)) this.buckets.set(1, new Set());
    this.buckets.get(1).add(key);
    this.minFreq = 1;
  }
}
```
