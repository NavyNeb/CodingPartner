---
id: ds-hash-tables
track: ds
title: Hash tables: Map, Set & how they work
summary: What a hash function and a bucket really are, why collisions happen and are handled, why resizing keeps lookups O(1), and when to reach for Map, Set or a plain object.
---

## The idea in one sentence

A hash table finds things **by computing where they live from the key itself**, so a lookup jumps straight to the right spot instead of searching.

> **Analogy** A coat check: you hand over your coat, get ticket **#37**, and later the attendant goes **straight to hook 37**. Nobody walks the whole rack. A hash function is the machine that turns *any* key (a name, an id, a URL) into a hook number.

## From key to bucket

![A key is hashed to a number, then reduced to a bucket index with modulo](fig:ds-hash-pipeline "The same key always follows the same two steps, so it always lands in the same bucket.")

1. A **hash function** turns the key into a (large) number.
2. **`hash mod bucketCount`** turns that into an index in an array of **buckets**.

A good hash function is **deterministic** (same key → same number), **fast**, and **spreads keys evenly** — similar keys must not pile into the same bucket. Adding up the character codes is a *bad* hash: `"ant"` and `"tan"` are anagrams, so they add up the same. A better one multiplies as it goes, so order matters:

```js try
function hash(key, size) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % size;   // order-sensitive
  return h;
}
console.log(hash('ant', 1000), hash('tan', 1000));   // different!
```

## Collisions: two keys, one bucket

There are far more possible keys than buckets, so **some keys must share a bucket** (a *collision*). The simplest fix is **chaining**: each bucket holds a small list, and you compare keys while walking it.

![Four buckets; ant and tan collide in bucket 3 and form a chain](fig:ds-hash-chain "A lookup is: hash, jump to the bucket, walk the short chain, compare keys.")

```stepper Inserting into a hash table with chaining
code:
  const table = new HashMap();   // 4 buckets
  table.set('ant', 1);
  table.set('bee', 2);
  table.set('tan', 3);
  table.get('tan');
---
line: 2
say: To store `'ant'` we hash it. (This toy hash adds the character codes: `97 + 110 + 116 = 323`.) Then `323 mod 4 = 3`, so it goes in **bucket 3**.
key: ant
hash: 323
bucket: 3
buckets: 3: [ant]
---
line: 3
say: `'bee'` hashes to `300`, and `300 mod 4 = 0` — **bucket 0**. No clash.
key: bee
hash: 300
bucket: 0
buckets: 0: [bee] | 3: [ant]
---
line: 4
say: `'tan'` is an anagram of `'ant'`, so the toy hash gives `323` again → **bucket 3**. A **collision**: the bucket already holds `ant`, so `tan` is appended to the **chain**.
key: tan
hash: 323
bucket: 3
buckets: 0: [bee] | 3: [ant → tan]
---
line: 5
say: To find `'tan'`: hash it (bucket 3), walk the chain comparing **keys** — `ant`? no. `tan`? yes. Chains stay short when the hash spreads well, so this is still **O(1)** on average.
Result: 3
```

Bad hashes and crowded tables make chains long; in the worst case (everything in one bucket) a lookup degrades to **O(n)** — a linked-list scan. That is why the next idea matters.

## Load factor and resizing

The **load factor** is `entries / buckets`. As it rises, chains get longer. So hash tables **resize**: when the load factor passes a limit (around **0.75**), they allocate **twice as many buckets** and **re-insert every key** (the bucket index changes, because it was `hash mod oldSize`).

![Doubling buckets and rehashing spreads the entries out](fig:ds-hash-resize "One resize is O(n), but they are rare, so insertion is amortised O(1), like push on a dynamic array.")

## `Map`, `Set` and plain objects in JavaScript

`Map` and `Set` are built-in hash tables: average **O(1)** `get` / `set` / `has` / `delete` (JavaScript's `Set` uses the same *SameValueZero* equality as `includes`, so `NaN` equals `NaN`). Both **remember insertion order**.

![Map versus plain object as a dictionary](fig:ds-map-vs-object "A plain object works as a dictionary only for fixed, known string keys.")

A plain `{}` as a dictionary has traps:

```js try predict
const counts = {};
for (const w of ['constructor', 'apple', 'constructor']) counts[w] = (counts[w] || 0) + 1;
console.log(counts.constructor);          // the key already "exists"!

const m = new Map();
for (const w of ['constructor', 'apple', 'constructor']) m.set(w, (m.get(w) || 0) + 1);
console.log(m.get('constructor'));
```

```js try predict
const o = {};
o[1] = 'number';
o['1'] = 'string';          // same key: object keys are always strings
o[{ id: 1 }] = 'object';    // becomes "[object Object]"
console.log(Object.keys(o));

const m = new Map();
m.set(1, 'number');
m.set('1', 'string');
m.set({ id: 1 }, 'object');
console.log(m.size);
```

**Rule of thumb:** use a **`Map`** when keys come from data (user input, ids, objects); use an **object** for a fixed record with known field names. A **`WeakMap`** is a `Map` whose keys must be objects and are held *weakly* — when nothing else references a key, the entry disappears, which makes it ideal for attaching private data to objects without leaking memory.

## Set algebra

A `Set` answers "is it in here?" in O(1), which makes set operations linear:

```js try
const a = new Set([1, 2, 3, 4]);
const b = new Set([3, 4, 5]);
const union = new Set([...a, ...b]);
const intersection = new Set([...a].filter((x) => b.has(x)));     // O(|a|), because b.has is O(1)
const difference = new Set([...a].filter((x) => !b.has(x)));
console.log([...union], [...intersection], [...difference]);
```

## Three patterns that use a hash table

- **Count:** `map.set(x, (map.get(x) ?? 0) + 1)` — frequencies in one pass.
- **Remember what you've seen:** a `Set` of visited values answers "have I met this?" — duplicate detection, cycle detection, and "longest run" problems.
- **Prefix sums:** store the running total and where you saw it, so "does a subarray sum to `k`?" becomes a lookup of `total - k`.

## Quick check

```check
Q: Why do hash tables need a collision strategy?
A) Hash functions are random
B) There are more possible keys than buckets, so different keys must sometimes share a bucket *
C) Buckets can only store numbers
D) Modulo is slow
Why: With finitely many buckets, the pigeonhole principle guarantees collisions. Chaining (a short list per bucket) is one fix.
---
Q: What happens to lookups if every key lands in the same bucket?
A) Still O(1)
B) They get faster
C) They degrade to O(n), a scan of one long chain *
D) The table resizes itself to fix it
Why: One bucket with n entries is just a list. Good hashing and resizing keep chains short.
---
Q: When should a hash table resize?
A) When the load factor (entries / buckets) passes a limit like 0.75, to keep chains short *
B) After every insertion
C) Only when it is empty
D) When a key is deleted
Why: Doubling the bucket count and rehashing is O(n), but rare, so insertion stays amortised O(1).
---
Q: What does `o[1] = 'a'; o['1'] = 'b'` leave in a plain object?
A) Two keys
B) One key, `'1'`, holding `'b'` *
C) An error
D) One key, `1`, holding `'a'`
Why: Object keys are always strings (or symbols), so `1` and `'1'` are the same key. A `Map` keeps them separate.
---
Q: Which is the best fit for counting words from user text, where a word might be "constructor"?
A) A plain object, `counts[word]`
B) An array of words
C) A `Map`, because it has no inherited keys *
D) A `WeakMap`
Why: A plain object already has `constructor` and `toString`. A Map starts empty and accepts any key.
```

## Recap

- A hash table computes **index = hash(key) mod buckets** and jumps there: **O(1) on average**.
- A good hash is **deterministic, fast and well spread**; collisions are handled with **chaining**.
- A rising **load factor** triggers **doubling and rehashing**, keeping chains short; insertion is **amortised O(1)**.
- **`Map`/`Set`**: any key, insertion order, no inherited keys. **Plain objects** coerce keys to strings and inherit properties.
- Patterns: **count**, **seen-set**, **prefix sums**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: hash a string | The `hash` snippet above |
| Build a hash map | The chaining figure and the resize figure |
| Word frequency | Why a `Map` beats `{}` here |
| Set operations | The set algebra snippet |
| Longest consecutive run | A `Set` of seen values: only start counting at a run's beginning |
| Subarray sum equals k | Prefix sums stored in a `Map` |

%% exercise dst-guided-hash-string | Guided: hash a string | 1 | js | js | hashString | 6 | guided
Write `hashString(key, size)`. Return a bucket index from `0` to `size - 1` using this rule: start with `h = 0`; for every character, set `h = (h * 31 + charCode) % size`.

```js
hashString('abc', 1000); // 354
hashString('ab', 1000);  // 105
hashString('ba', 1000);  // 135  (order matters: anagrams differ)
```

%% worked
**A similar problem, solved: `checksum(text)`** — a number that depends on every character and their order.

```js
function checksum(text) {
  let h = 7;                                       // ① start from a fixed seed
  for (const ch of text) {                         // ② visit every character
    h = (h * 31 + ch.charCodeAt(0)) % 1000003;     // ③ mix it in, keep the number small
  }
  return h;
}
```

`hashString` is the same loop with `h` starting at `0` and the modulo being the bucket count — the modulo at the end of every step keeps the number small *and* produces the bucket index.

%% explain
- **Always in `[0, size)`**.
- **Deterministic**: the same key and size give the same index.
- **Order-sensitive**: `'ab'` and `'ba'` give different results.
- **Empty string** hashes to `0`.

%% nudge
- Which operation do you repeat for each character?
- Where does the `% size` go, inside the loop or after it?

%% starter
```js
export function hashString(key, size) {
  // Step 1 — let h = 0.
  // Step 2 — for each character: h = (h * 31 + key.charCodeAt(i)) % size.
  // Step 3 — return h.
  return 0;
}
```

%% tests
```js
describe('hashString', () => {
  it('computes the polynomial hash', () => {
    expect(hashString('abc', 1000)).toBe(354);
    expect(hashString('ab', 1000)).toBe(105);
    expect(hashString('ba', 1000)).toBe(135);
  });

  it('is order-sensitive, so anagrams usually differ', () => {
    expect(hashString('ant', 4)).not.toBe(hashString('tan', 4));
  });

  it('is deterministic and stays inside the bucket range', () => {
    for (let size = 1; size <= 50; size += 7) {
      for (const key of ['', 'a', 'hello', 'zzzzzz', 'key-123']) {
        const h = hashString(key, size);
        expect(h).toBe(hashString(key, size));
        expect(h >= 0 && h < size && Number.isInteger(h)).toBe(true);
      }
    }
  });

  it('hashes the empty string to 0', () => {
    expect(hashString('', 16)).toBe(0);
  });

  it('spreads keys across buckets', () => {
    const counts = new Array(16).fill(0);
    for (let i = 0; i < 2000; i++) counts[hashString('key' + i, 16)]++;
    expect(Math.max(...counts)).toBeLessThan(250);
    expect(Math.min(...counts)).toBeGreaterThan(40);
  });
});
```

%% hints
- `for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % size;`

%% solution
```js
export function hashString(key, size) {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) % size;
  }
  return h;
}
```

%% exercise dst-hash-map | Build a hash map | 3 | js | js | HashMap | 28
Build `class HashMap` **from scratch** with **chaining**. Keys are strings; values are anything.

- `new HashMap(hash = hashString)` starts with **8 buckets**. The optional `hash(key, size)` returns a bucket index (tests inject bad hashes to force collisions).
- `set(key, value)` inserts or **overwrites**. If the key is *new* and `size / bucketCount > 0.75`, **double the bucket count and rehash every entry**.
- `get(key)` returns the value or `undefined`; `has(key)` says whether the key exists (even if its value is `undefined`).
- `delete(key)` removes it and returns `true`, or `false` if it was absent.
- `size` is the number of entries; `bucketCount` is the number of buckets; `keys()` returns an array of keys in any order.

Do **not** use `Map`, `Set` or object-as-dictionary inside.

%% worked
**A similar problem, solved: a `Counter`** — a tiny map from key to count using one bucket array.

```js
class Counter {
  constructor() { this.buckets = Array.from({ length: 4 }, () => []); }          // ① each bucket is a list of [key, count]
  add(key) {
    const bucket = this.buckets[hashString(key, this.buckets.length)];           // ② the key decides the bucket
    const entry = bucket.find((e) => e[0] === key);                              // ③ walk the (short) chain comparing keys
    if (entry) entry[1]++;
    else bucket.push([key, 1]);                                                  // ④ new key: append to the chain
  }
}
```

A `HashMap` is this with `get`, `delete` and the resize step: when it grows, create a new bucket array and **insert every entry again** — each key must be hashed with the *new* size, because the old index no longer applies.

%% explain
- **Chaining**: each bucket is an array of `[key, value]` pairs; always compare keys inside the bucket.
- **Overwrite** keeps `size` unchanged and **does not** trigger a resize.
- **Resize** happens after inserting a *new* key when `size / bucketCount > 0.75`: 7th insert → 16 buckets, 13th → 32.
- **Works with a terrible hash**: if every key hashes to bucket 0 it is slow but still correct.

%% nudge
- What do you do inside a bucket before pushing a new pair?
- When you resize, which hash size do you use for the entries you move?

%% starter
```js
function hashString(key, size) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % size;
  return h;
}

export class HashMap {
  constructor(hash = hashString) {
    this.hash = hash;
    this.buckets = Array.from({ length: 8 }, () => []);
    this.size = 0;
  }

  get bucketCount() {
    return this.buckets.length;
  }

  set(key, value) {
    // your code
  }

  get(key) {
    // your code
  }

  has(key) {
    // your code
  }

  delete(key) {
    // your code
  }

  keys() {
    // your code
  }
}
```

%% tests
```js
describe('HashMap', () => {
  it('sets and gets', () => {
    const m = new HashMap();
    m.set('a', 1);
    m.set('b', 2);
    expect(m.get('a')).toBe(1);
    expect(m.get('b')).toBe(2);
    expect(m.get('zzz')).toBeUndefined();
    expect(m.size).toBe(2);
  });

  it('overwrites without growing', () => {
    const m = new HashMap();
    m.set('a', 1);
    m.set('a', 99);
    expect(m.get('a')).toBe(99);
    expect(m.size).toBe(1);
  });

  it('has() distinguishes a missing key from an undefined value', () => {
    const m = new HashMap();
    m.set('k', undefined);
    expect(m.has('k')).toBe(true);
    expect(m.has('other')).toBe(false);
  });

  it('deletes', () => {
    const m = new HashMap();
    m.set('a', 1);
    m.set('b', 2);
    expect(m.delete('a')).toBe(true);
    expect(m.delete('a')).toBe(false);
    expect(m.has('a')).toBe(false);
    expect(m.get('b')).toBe(2);
    expect(m.size).toBe(1);
  });

  it('lists its keys', () => {
    const m = new HashMap();
    ['x', 'y', 'z'].forEach((k, i) => m.set(k, i));
    expect(m.keys().sort()).toEqual(['x', 'y', 'z']);
  });

  it('handles collisions (every key in one bucket)', () => {
    const m = new HashMap(() => 0);
    m.set('a', 1);
    m.set('b', 2);
    m.set('c', 3);
    expect(m.get('a')).toBe(1);
    expect(m.get('b')).toBe(2);
    expect(m.get('c')).toBe(3);
    m.delete('b');
    expect(m.has('b')).toBe(false);
    expect(m.get('c')).toBe(3);
    m.set('a', 10);
    expect(m.get('a')).toBe(10);
    expect(m.size).toBe(2);
  });

  it('doubles the buckets when the load factor passes 0.75', () => {
    const m = new HashMap();
    expect(m.bucketCount).toBe(8);
    for (let i = 1; i <= 6; i++) m.set('k' + i, i);
    expect(m.bucketCount).toBe(8);
    m.set('k7', 7);
    expect(m.bucketCount).toBe(16);
    for (let i = 8; i <= 12; i++) m.set('k' + i, i);
    expect(m.bucketCount).toBe(16);
    m.set('k13', 13);
    expect(m.bucketCount).toBe(32);
  });

  it('keeps every entry reachable after resizing', () => {
    const m = new HashMap();
    for (let i = 0; i < 500; i++) m.set('key' + i, i);
    expect(m.size).toBe(500);
    for (let i = 0; i < 500; i++) expect(m.get('key' + i)).toBe(i);
  });

  it('does not resize on overwrite', () => {
    const m = new HashMap();
    for (let i = 1; i <= 6; i++) m.set('k' + i, i);
    for (let n = 0; n < 20; n++) m.set('k1', n);
    expect(m.bucketCount).toBe(8);
  });

  it('is fast: 50 000 sets and gets', () => {
    const m = new HashMap();
    const t = Date.now();
    for (let i = 0; i < 50000; i++) m.set('item-' + i, i);
    let sum = 0;
    for (let i = 0; i < 50000; i++) sum += m.get('item-' + i);
    expect(sum).toBe((49999 * 50000) / 2);
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
```

%% hints
- Find the bucket with `this.buckets[this.hash(key, this.buckets.length)]`, then `bucket.find((e) => e[0] === key)`.
- `set`: if the entry exists, update `entry[1]`; otherwise `push([key, value])`, `size++`, and check `this.size / this.buckets.length > 0.75`.
- Resize: make `next = Array.from({ length: old * 2 }, () => [])`, and for each old entry push it into `next[this.hash(key, next.length)]`.
- `delete`: find the index with `findIndex`, then `splice(index, 1)`.

%% solution
```js
function hashString(key, size) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % size;
  return h;
}

export class HashMap {
  constructor(hash = hashString) {
    this.hash = hash;
    this.buckets = Array.from({ length: 8 }, () => []);
    this.size = 0;
  }

  get bucketCount() {
    return this.buckets.length;
  }

  bucketFor(key) {
    return this.buckets[this.hash(key, this.buckets.length)];
  }

  set(key, value) {
    const bucket = this.bucketFor(key);
    const entry = bucket.find((e) => e[0] === key);
    if (entry) {
      entry[1] = value;
      return;
    }
    bucket.push([key, value]);
    this.size++;
    if (this.size / this.buckets.length > 0.75) this.resize();
  }

  resize() {
    const next = Array.from({ length: this.buckets.length * 2 }, () => []);
    for (const bucket of this.buckets) {
      for (const entry of bucket) next[this.hash(entry[0], next.length)].push(entry);
    }
    this.buckets = next;
  }

  get(key) {
    const entry = this.bucketFor(key).find((e) => e[0] === key);
    return entry ? entry[1] : undefined;
  }

  has(key) {
    return this.bucketFor(key).some((e) => e[0] === key);
  }

  delete(key) {
    const bucket = this.bucketFor(key);
    const i = bucket.findIndex((e) => e[0] === key);
    if (i === -1) return false;
    bucket.splice(i, 1);
    this.size--;
    return true;
  }

  keys() {
    const out = [];
    for (const bucket of this.buckets) for (const entry of bucket) out.push(entry[0]);
    return out;
  }
}
```

%% exercise dst-word-frequency | Word frequency | 2 | js | js | wordFrequency | 12
Write `wordFrequency(text)`. Lowercase the text, split it into **words made of letters `a`–`z`** (anything else is a separator), and return a **`Map`** from word to count. The map must list words in **order of first appearance**.

```js
wordFrequency('The cat; the CAT? A dog.');
// Map { 'the' => 2, 'cat' => 2, 'a' => 1, 'dog' => 1 }
```

It must work for any word, including `constructor`, `toString` and `__proto__`.

%% worked
**A similar problem, solved: `charCounts(str)`** — count characters with a `Map`.

```js
function charCounts(str) {
  const counts = new Map();                       // ① a Map, not {}: no inherited keys to trip over
  for (const ch of str) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);    // ② read the old count (default 0), write the new one
  }
  return counts;
}
```

`Map` iteration follows insertion order, so the first-appearance order comes for free as long as you only `set` (updating an existing key keeps its place). `text.toLowerCase().match(/[a-z]+/g)` gives the words, or `null` when there are none.

%% explain
- **Returns a `Map`** (not an object), word → count.
- **Lowercased**; punctuation, digits and spaces are separators.
- **First-appearance order** is preserved.
- **Empty or no-word text** returns an empty Map.
- **Safe for `constructor`, `__proto__`…** — that's the reason for the Map.

%% nudge
- What does `String.prototype.match(/[a-z]+/g)` return when nothing matches?
- Why does `counts.get(word) ?? 0` need to be a Map `get` and not `counts[word]`?

%% starter
```js
export function wordFrequency(text) {
  const counts = new Map();
  // your code
  return counts;
}
```

%% tests
```js
describe('wordFrequency', () => {
  it('counts words case-insensitively and ignores punctuation', () => {
    const m = wordFrequency('The cat; the CAT? A dog.');
    expect(m).toBeInstanceOf(Map);
    expect([...m]).toEqual([['the', 2], ['cat', 2], ['a', 1], ['dog', 1]]);
  });

  it('keeps first-appearance order', () => {
    expect([...wordFrequency('b a b c a b').keys()]).toEqual(['b', 'a', 'c']);
  });

  it('treats digits and symbols as separators', () => {
    expect([...wordFrequency('a1b2c--d')]).toEqual([['a', 1], ['b', 1], ['c', 1], ['d', 1]]);
  });

  it('returns an empty map for empty or wordless text', () => {
    expect(wordFrequency('').size).toBe(0);
    expect(wordFrequency('123 !?').size).toBe(0);
  });

  it('is safe for words that exist on every object', () => {
    const m = wordFrequency('constructor toString __proto__ hasOwnProperty constructor');
    expect(m.get('constructor')).toBe(2);
    expect(m.get('tostring')).toBe(1);
    const p = wordFrequency('proto proto');
    expect(p.get('proto')).toBe(2);
    const odd = wordFrequency('valueof valueof');
    expect(odd.get('valueof')).toBe(2);
  });
});
```

%% hints
- `const words = text.toLowerCase().match(/[a-z]+/g) ?? [];`
- For each word: `counts.set(word, (counts.get(word) ?? 0) + 1)`.

%% solution
```js
export function wordFrequency(text) {
  const counts = new Map();
  const words = text.toLowerCase().match(/[a-z]+/g) ?? [];
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}
```

%% exercise dst-set-ops | Set operations | 2 | js | js | setOps | 14
Write `setOps(a, b)` for two `Set`s. Return an object with four **new** `Set`s:

- `union`: items in either,
- `intersection`: items in both,
- `difference`: items in `a` but not in `b`,
- `symmetric`: items in exactly one of them.

Do **not** modify `a` or `b`. Each operation should be **O(|a| + |b|)** — use `has`, not `includes`.

```js
const { union, intersection, difference, symmetric } = setOps(new Set([1, 2, 3]), new Set([3, 4]));
// union {1,2,3,4}  intersection {3}  difference {1,2}  symmetric {1,2,4}
```

%% worked
**A similar problem, solved: `isSubset(a, b)`** — is every item of `a` also in `b`?

```js
function isSubset(a, b) {
  for (const x of a) {          // ① look at each item of the smaller set...
    if (!b.has(x)) return false; // ② ...and ask the other set in O(1)
  }
  return true;
}
```

Looping over one set and asking the other with `has` is the whole trick: each question costs O(1), so the operation is linear instead of the O(n·m) you'd get from `array.includes`.

%% explain
- **Four new Sets**; inputs are left untouched.
- **`difference` is not symmetric**: `a − b` ≠ `b − a`.
- **`symmetric`** = (a − b) ∪ (b − a).
- **Linear**: 100 000-item sets are tested for speed.

%% nudge
- Which set do you loop over, and which do you query with `has`?
- Can `symmetric` be built from `difference` twice?

%% starter
```js
export function setOps(a, b) {
  // your code
  return { union: new Set(), intersection: new Set(), difference: new Set(), symmetric: new Set() };
}
```

%% tests
```js
describe('setOps', () => {
  const sorted = (s) => [...s].sort((x, y) => x - y);

  it('computes all four operations', () => {
    const r = setOps(new Set([1, 2, 3]), new Set([3, 4]));
    expect(sorted(r.union)).toEqual([1, 2, 3, 4]);
    expect(sorted(r.intersection)).toEqual([3]);
    expect(sorted(r.difference)).toEqual([1, 2]);
    expect(sorted(r.symmetric)).toEqual([1, 2, 4]);
  });

  it('returns Sets', () => {
    const r = setOps(new Set([1]), new Set([2]));
    expect(r.union).toBeInstanceOf(Set);
    expect(r.symmetric).toBeInstanceOf(Set);
  });

  it('handles empty and disjoint sets', () => {
    const r = setOps(new Set(), new Set([1, 2]));
    expect(sorted(r.union)).toEqual([1, 2]);
    expect(r.intersection.size).toBe(0);
    expect(r.difference.size).toBe(0);
    expect(sorted(r.symmetric)).toEqual([1, 2]);
  });

  it('does not modify its inputs', () => {
    const a = new Set([1, 2]);
    const b = new Set([2, 3]);
    setOps(a, b);
    expect(sorted(a)).toEqual([1, 2]);
    expect(sorted(b)).toEqual([2, 3]);
  });

  it('works with non-number items', () => {
    const o = { id: 1 };
    const r = setOps(new Set(['x', o, NaN]), new Set([o, 'y', NaN]));
    expect(r.intersection.size).toBe(2);
    expect(r.intersection.has(o)).toBe(true);
    expect(r.intersection.has(NaN)).toBe(true);
    expect(r.difference.has('x')).toBe(true);
  });

  it('is linear', () => {
    const a = new Set(Array.from({ length: 100000 }, (_, i) => i));
    const b = new Set(Array.from({ length: 100000 }, (_, i) => i + 50000));
    const t = Date.now();
    const r = setOps(a, b);
    expect(Date.now() - t).toBeLessThan(800);
    expect(r.union.size).toBe(150000);
    expect(r.intersection.size).toBe(50000);
    expect(r.symmetric.size).toBe(100000);
  });
});
```

%% hints
- `union`: `new Set([...a, ...b])`.
- `intersection`: `[...a].filter((x) => b.has(x))`; `difference`: the same with `!b.has(x)`.
- `symmetric`: the union of `a − b` and `b − a`.

%% solution
```js
export function setOps(a, b) {
  const union = new Set([...a, ...b]);
  const intersection = new Set();
  const difference = new Set();
  for (const x of a) (b.has(x) ? intersection : difference).add(x);
  const symmetric = new Set(difference);
  for (const x of b) if (!a.has(x)) symmetric.add(x);
  return { union, intersection, difference, symmetric };
}
```

%% exercise dst-longest-consecutive | Longest consecutive run | 3 | js | js | longestConsecutive | 25
Given an **unsorted** array of integers, return the length of the **longest run of consecutive values** (the order in the array doesn't matter).

```js
longestConsecutive([100, 4, 200, 1, 3, 2]); // 4   (1, 2, 3, 4)
```

It must run in **O(n)** — sorting is O(n log n), so put the numbers in a `Set` instead.

%% worked
**A similar problem, solved: `hasPairWithDiff(nums, d)`** — is there a pair whose difference is `d` (with `d > 0`)?

```js
function hasPairWithDiff(nums, d) {
  const seen = new Set(nums);                     // ① every number, with O(1) membership
  for (const x of seen) {
    if (seen.has(x + d)) return true;             // ② is the partner there? one lookup, no scan
  }
  return false;
}
```

Same idea for runs: put all numbers in a `Set`. A number `x` **starts** a run only if `x - 1` is *not* in the set. From each start, walk `x + 1, x + 2, …` while they exist. Every number is visited by at most one walk, so the total work is O(n) even though there are nested loops.

%% explain
- **Returns the length** of the longest run of consecutive integers.
- **Duplicates** count once.
- **Negatives** work: `[-1, 0, 1]` is a run of 3.
- **Empty array** returns `0`.
- **Linear**: 100 000 shuffled numbers are tested.

%% nudge
- How can you tell, in O(1), that a number is the *start* of a run?
- Why does starting only at run beginnings keep the total linear?

%% starter
```js
export function longestConsecutive(nums) {
  // your code
  return 0;
}
```

%% tests
```js
describe('longestConsecutive', () => {
  it('finds the longest run', () => {
    expect(longestConsecutive([100, 4, 200, 1, 3, 2])).toBe(4);
    expect(longestConsecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1])).toBe(9);
  });

  it('counts duplicates once', () => {
    expect(longestConsecutive([1, 2, 2, 3, 3, 3])).toBe(3);
  });

  it('works with negatives', () => {
    expect(longestConsecutive([-1, 0, 1, -2, 10])).toBe(4);
  });

  it('handles empty and single-element arrays', () => {
    expect(longestConsecutive([])).toBe(0);
    expect(longestConsecutive([7])).toBe(1);
    expect(longestConsecutive([5, 5, 5])).toBe(1);
  });

  it('is linear on 100 000 shuffled numbers', () => {
    const nums = Array.from({ length: 100000 }, (_, i) => (i * 7919) % 100003);
    const t = Date.now();
    const r = longestConsecutive(nums);
    expect(Date.now() - t).toBeLessThan(500);
    expect(r).toBeGreaterThanOrEqual(1);
    const run = Array.from({ length: 100000 }, (_, i) => 99999 - i);
    expect(longestConsecutive(run)).toBe(100000);
  });
});
```

%% hints
- `const set = new Set(nums);`
- Loop `for (const x of set)`: skip it if `set.has(x - 1)` (not a start). Otherwise count upwards while `set.has(x + len)`.

%% solution
```js
export function longestConsecutive(nums) {
  const set = new Set(nums);
  let best = 0;
  for (const x of set) {
    if (set.has(x - 1)) continue;
    let len = 1;
    while (set.has(x + len)) len++;
    if (len > best) best = len;
  }
  return best;
}
```

%% exercise dst-subarray-sum | Subarray sum equals k | 3 | js | js | subarraySum | 28
Given an array of integers (which may be **negative**) and a target `k`, return **how many contiguous subarrays sum to `k`**.

```js
subarraySum([1, 1, 1], 2);  // 2   ([1,1] twice)
subarraySum([1, 2, 3], 3);  // 2   ([1,2] and [3])
```

It must be **O(n)** — a 100 000-element array is tested, so trying every start and end is too slow.

%% worked
**A similar problem, solved: `hasZeroSumSubarray(nums)`** — is there a non-empty contiguous subarray that sums to `0`?

```js
function hasZeroSumSubarray(nums) {
  const seen = new Set([0]);                   // ① the empty prefix has sum 0
  let total = 0;
  for (const x of nums) {
    total += x;                                // ② running total = sum of nums[0..i]
    if (seen.has(total)) return true;          // ③ same total twice → what lies between sums to 0
    seen.add(total);
  }
  return false;
}
```

The sum of `nums[i..j]` is `prefix[j] - prefix[i-1]`. So a subarray ending here sums to `k` exactly when an *earlier* prefix equals `total - k`. Keep a `Map` from prefix sum to **how many times** it has occurred, and add `map.get(total - k)` to the answer at each step.

%% explain
- **Counts** subarrays (not lengths): each distinct start/end pair counts.
- **Negatives and zeros** are allowed, so a sliding window won't work.
- **Seed the map with `0 → 1`**, so subarrays starting at index 0 are counted.
- **Linear**: one pass with a `Map` of prefix sums.

%% nudge
- If the running total is `total`, which earlier prefix total would make the part in between sum to `k`?
- Why must the map store *counts* rather than just "seen"?

%% starter
```js
export function subarraySum(nums, k) {
  // your code
  return 0;
}
```

%% tests
```js
describe('subarraySum', () => {
  it('counts the basic cases', () => {
    expect(subarraySum([1, 1, 1], 2)).toBe(2);
    expect(subarraySum([1, 2, 3], 3)).toBe(2);
  });

  it('handles negatives and zeros', () => {
    expect(subarraySum([1, -1, 0], 0)).toBe(3);
    expect(subarraySum([3, 4, 7, 2, -3, 1, 4, 2], 7)).toBe(4);
  });

  it('counts subarrays that start at index 0', () => {
    expect(subarraySum([5], 5)).toBe(1);
    expect(subarraySum([2, 3], 5)).toBe(1);
  });

  it('handles empty input and no matches', () => {
    expect(subarraySum([], 0)).toBe(0);
    expect(subarraySum([1, 2, 3], 100)).toBe(0);
  });

  it('is linear on 100 000 elements', () => {
    const ones = new Array(100000).fill(1);
    const t = Date.now();
    expect(subarraySum(ones, 1)).toBe(100000);
    expect(subarraySum(ones, 3)).toBe(99998);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- Keep `total` (running sum) and `counts = new Map([[0, 1]])`.
- For each number: `total += x; answer += counts.get(total - k) ?? 0;` then record `total` in `counts`.

%% solution
```js
export function subarraySum(nums, k) {
  const counts = new Map([[0, 1]]);
  let total = 0;
  let answer = 0;
  for (const x of nums) {
    total += x;
    answer += counts.get(total - k) ?? 0;
    counts.set(total, (counts.get(total) ?? 0) + 1);
  }
  return answer;
}
```
