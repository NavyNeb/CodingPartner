---
id: arrays
track: js
title: Arrays, iteration & immutable updates
summary: The higher-order toolkit, stable sorting, and the copy-don't-mutate habits React depends on.
---

Most day-to-day JavaScript is "take a list, produce another list". Being fluent means knowing which method to reach for **and** what it costs.

## Pick the method by the *shape of the result*

| You want | Reach for |
| --- | --- |
| Same length, each item transformed | `map` |
| Fewer items | `filter` |
| One value (sum, object, Map…) | `reduce` |
| Flatten one level after mapping | `flatMap` |
| Does *any* / *every* item match? | `some` / `every` (they **short-circuit**) |
| First match, or its index | `find` / `findIndex` (`findLast`, `at(-1)`) |
| Side effects only | `for…of` or `forEach` |

`reduce` can do all of the above, which is exactly why you shouldn't default to it: `map`/`filter` say *what* you're doing in the name.

```js
const totals = orders.reduce((acc, o) => {
  acc[o.customer] = (acc[o.customer] ?? 0) + o.amount;
  return acc;
}, {});
```

Two `reduce` traps: **forgetting the initial value** (the first element becomes the accumulator — and an empty array throws), and **forgetting to return** the accumulator.

## Callback signature

`(value, index, array)` — so `['1', '2', '3'].map(parseInt)` gives `[1, NaN, NaN]`, because `parseInt` receives the index as its radix. Wrap it: `.map((s) => parseInt(s, 10))`.

## Mutating vs. copying

| Mutates in place | Returns a new array |
| --- | --- |
| `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `fill` | `map`, `filter`, `slice`, `concat`, `flat`, spread, `toSorted`, `toReversed`, `toSpliced`, `with` |

In React state, Redux, memoized selectors — anywhere identity means "changed" — **never mutate; produce a new array**. The immutable equivalents:

```js
const add    = [...items, item];
const remove = items.filter((x) => x.id !== id);
const update = items.map((x) => (x.id === id ? { ...x, done: true } : x));
const insert = [...items.slice(0, i), item, ...items.slice(i)];
```

Note these are **shallow**: the array is new, but the objects inside are the same references unless you replaced them.

## `sort` gotchas

- Without a comparator it sorts **as strings**: `[10, 9, 1].sort()` → `[1, 10, 9]`.
- The comparator must return a number: negative → `a` first. `(a, b) => a - b` for numbers; `a.localeCompare(b)` for text. Never return a boolean.
- It sorts **in place** (use `toSorted` or copy first) and, since ES2019, is **stable**: equal items keep their relative order. That's what makes multi-key sorting by "sort by the minor key, then the major key" work.

## Complexity in one glance

`includes`/`indexOf`/`find` are O(n). Inside a loop that's O(n²). Turn the inner lookup into a `Set`/`Map` (O(1)) and the whole thing drops to O(n) — the single most common interview optimisation.

```js
const seen = new Set();
const dupes = items.filter((x) => (seen.has(x) ? true : (seen.add(x), false)));
```

%% exercise arrays-chunk-zip | chunk & zip | 1 | js | js | chunk, zip | 8
Two small utilities.

- `chunk(array, size)` splits into groups of `size` (the last may be shorter). `size` ≤ 0 throws a `RangeError`.
- `zip(...arrays)` pairs items by index: `zip([1,2],['a','b'])` → `[[1,'a'],[2,'b']]`. The result is as long as the **shortest** input.

Neither may mutate its inputs.

%% starter
```js
export function chunk(array, size) {
  // your code
}

export function zip(...arrays) {
  // your code
}
```

%% tests
```js
describe('chunk', () => {
  it('splits evenly', () => expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]));
  it('keeps a shorter last chunk', () => expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]));
  it('handles size larger than the array', () => expect(chunk([1, 2], 10)).toEqual([[1, 2]]));
  it('handles an empty array', () => expect(chunk([], 3)).toEqual([]));
  it('rejects a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], -1)).toThrow(RangeError);
  });
  it('does not mutate the input', () => {
    const src = [1, 2, 3];
    chunk(src, 2);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe('zip', () => {
  it('pairs by index', () => expect(zip([1, 2], ['a', 'b'])).toEqual([[1, 'a'], [2, 'b']]));
  it('stops at the shortest input', () => expect(zip([1, 2, 3], ['a'])).toEqual([[1, 'a']]));
  it('supports more than two arrays', () => expect(zip([1, 2], [3, 4], [5, 6])).toEqual([[1, 3, 5], [2, 4, 6]]));
  it('returns [] with no arguments', () => expect(zip()).toEqual([]));
});
```

%% hints
- `chunk`: loop with `i += size` and `slice(i, i + size)`.
- `zip`: the length is `Math.min(...arrays.map((a) => a.length))`; `Array.from({ length }, (_, i) => arrays.map((a) => a[i]))`.
- With no arrays, `Math.min()` is `Infinity` — handle it.

%% solution
```js
export function chunk(array, size) {
  if (!(size > 0)) throw new RangeError('size must be positive');
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

export function zip(...arrays) {
  if (!arrays.length) return [];
  const length = Math.min(...arrays.map((a) => a.length));
  return Array.from({ length }, (_, i) => arrays.map((a) => a[i]));
}
```

%% exercise arrays-immutable | Immutable list updates | 2 | js | js | insertAt, removeAt, moveItem, updateWhere | 12
These are the moves you make on React state every day. Each returns a **new** array and never touches the input (items you don't change keep their identity).

- `insertAt(list, index, item)`
- `removeAt(list, index)` — out-of-range index returns an equal copy.
- `moveItem(list, from, to)` — remove the item at `from`, then insert it so it ends up at index `to`.
- `updateWhere(list, predicate, patch)` — shallow-merge `patch` into every object matching `predicate`; other objects are the *same references*.

%% starter
```js
export function insertAt(list, index, item) {
  // your code
}

export function removeAt(list, index) {
  // your code
}

export function moveItem(list, from, to) {
  // your code
}

export function updateWhere(list, predicate, patch) {
  // your code
}
```

%% tests
```js
const frozen = (a) => Object.freeze([...a]);

describe('insertAt', () => {
  it('inserts in the middle', () => expect(insertAt(frozen([1, 2, 4]), 2, 3)).toEqual([1, 2, 3, 4]));
  it('inserts at the ends', () => {
    expect(insertAt(frozen([2]), 0, 1)).toEqual([1, 2]);
    expect(insertAt(frozen([1]), 1, 2)).toEqual([1, 2]);
  });
  it('returns a new array', () => {
    const a = frozen([1]);
    expect(insertAt(a, 0, 0)).not.toBe(a);
  });
});

describe('removeAt', () => {
  it('removes an item', () => expect(removeAt(frozen(['a', 'b', 'c']), 1)).toEqual(['a', 'c']));
  it('ignores out-of-range indexes', () => {
    const a = frozen([1, 2]);
    expect(removeAt(a, 5)).toEqual([1, 2]);
    expect(removeAt(a, -1)).toEqual([1, 2]);
  });
});

describe('moveItem', () => {
  it('moves forward', () => expect(moveItem(frozen(['a', 'b', 'c', 'd']), 0, 2)).toEqual(['b', 'c', 'a', 'd']));
  it('moves backward', () => expect(moveItem(frozen(['a', 'b', 'c', 'd']), 3, 1)).toEqual(['a', 'd', 'b', 'c']));
  it('does nothing when from === to', () => expect(moveItem(frozen([1, 2, 3]), 1, 1)).toEqual([1, 2, 3]));
});

describe('updateWhere', () => {
  const list = Object.freeze([{ id: 1, done: false }, { id: 2, done: false }, { id: 3, done: true }]);
  it('patches only matching items', () => {
    const out = updateWhere(list, (x) => x.id === 2, { done: true });
    expect(out).toEqual([{ id: 1, done: false }, { id: 2, done: true }, { id: 3, done: true }]);
  });
  it('keeps identity of untouched items and does not mutate the originals', () => {
    const out = updateWhere(list, (x) => x.id === 2, { done: true });
    expect(out[0]).toBe(list[0]);
    expect(out[2]).toBe(list[2]);
    expect(out[1]).not.toBe(list[1]);
    expect(list[1].done).toBe(false);
  });
});
```

%% hints
- `slice` never mutates; `[...a.slice(0, i), item, ...a.slice(i)]`.
- `moveItem`: `const next = removeAt(list, from)`, then `insertAt(next, to, list[from])`.
- `updateWhere` is `map` with a ternary that either spreads or returns the original.

%% solution
```js
export function insertAt(list, index, item) {
  return [...list.slice(0, index), item, ...list.slice(index)];
}

export function removeAt(list, index) {
  if (index < 0 || index >= list.length) return [...list];
  return [...list.slice(0, index), ...list.slice(index + 1)];
}

export function moveItem(list, from, to) {
  if (from === to) return [...list];
  return insertAt(removeAt(list, from), to, list[from]);
}

export function updateWhere(list, predicate, patch) {
  return list.map((item) => (predicate(item) ? { ...item, ...patch } : item));
}
```

%% exercise arrays-hof | map, filter & reduce from scratch | 2 | js | js | myMap, myFilter, myReduce | 15
Implement the three workhorses **without** calling the native `map`, `filter` or `reduce`.

- Callbacks receive `(value, index, array)`.
- `myReduce(array, fn, initial?)`: if `initial` is **not provided** (check `arguments.length`), start from the first element and iterate from index 1. An empty array with no initial value throws a `TypeError`.
- Holes in sparse arrays are skipped (`i in array`).
- Results are new arrays; the input is untouched.

%% starter
```js
export function myMap(array, fn) {
  // your code
}

export function myFilter(array, fn) {
  // your code
}

export function myReduce(array, fn, initial) {
  // your code
}
```

%% tests
```js
describe('myMap', () => {
  it('maps values', () => expect(myMap([1, 2, 3], (x) => x * 2)).toEqual([2, 4, 6]));
  it('passes (value, index, array)', () => {
    const src = ['a', 'b'];
    const spy = jest.fn((v) => v);
    myMap(src, spy);
    expect(spy).toHaveBeenNthCalledWith(1, 'a', 0, src);
    expect(spy).toHaveBeenNthCalledWith(2, 'b', 1, src);
  });
  it('skips holes but preserves length', () => {
    const out = myMap([1, , 3], (x) => x + 1);
    expect(out.length).toBe(3);
    expect(1 in out).toBe(false);
  });
  it('does not use native map', () => {
    const orig = Array.prototype.map;
    Array.prototype.map = () => { throw new Error('native map used'); };
    let out;
    try { out = myMap([1], (x) => x); } finally { Array.prototype.map = orig; }
    expect(out).toEqual([1]);
  });
});

describe('myFilter', () => {
  it('keeps matching items', () => expect(myFilter([1, 2, 3, 4], (x) => x % 2 === 0)).toEqual([2, 4]));
  it('passes the index', () => expect(myFilter(['a', 'b', 'c'], (_, i) => i !== 1)).toEqual(['a', 'c']));
  it('returns a new array', () => {
    const src = [1];
    expect(myFilter(src, () => true)).not.toBe(src);
  });
  it('does not use native filter', () => {
    const orig = Array.prototype.filter;
    Array.prototype.filter = () => { throw new Error('native filter used'); };
    let out;
    try { out = myFilter([1, 2], (x) => x > 1); } finally { Array.prototype.filter = orig; }
    expect(out).toEqual([2]);
  });
});

describe('myReduce', () => {
  it('reduces with an initial value', () => expect(myReduce([1, 2, 3], (a, x) => a + x, 10)).toBe(16));
  it('uses the first element when no initial value is given', () => {
    const spy = jest.fn((a, x) => a + x);
    expect(myReduce([1, 2, 3], spy)).toBe(6);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 1, 2, 1, [1, 2, 3]);
  });
  it('treats an explicit undefined initial value as provided', () => {
    expect(myReduce([1], (a, x) => [a, x], undefined)).toEqual([undefined, 1]);
  });
  it('returns the initial value for an empty array', () => expect(myReduce([], (a) => a, 'init')).toBe('init'));
  it('throws on an empty array without an initial value', () => {
    expect(() => myReduce([], (a) => a)).toThrow(TypeError);
  });
  it('can build objects', () => {
    expect(myReduce(['a', 'b'], (acc, k, i) => ({ ...acc, [k]: i }), {})).toEqual({ a: 0, b: 1 });
  });
});
```

%% hints
- A plain `for` loop with `if (!(i in array)) continue;`.
- `myReduce(array, fn, initial)` — `arguments.length >= 3` tells you if `initial` was passed. Arrow functions don't have `arguments`, so keep this a regular function.
- Sparse `map` result: `const out = new Array(array.length)` and assign only where present.

%% solution
```js
export function myMap(array, fn) {
  const out = new Array(array.length);
  for (let i = 0; i < array.length; i++) {
    if (i in array) out[i] = fn(array[i], i, array);
  }
  return out;
}

export function myFilter(array, fn) {
  const out = [];
  for (let i = 0; i < array.length; i++) {
    if (i in array && fn(array[i], i, array)) out.push(array[i]);
  }
  return out;
}

export function myReduce(array, fn, initial) {
  let i = 0;
  let acc = initial;
  if (arguments.length < 3) {
    while (i < array.length && !(i in array)) i++;
    if (i >= array.length) throw new TypeError('Reduce of empty array with no initial value');
    acc = array[i++];
  }
  for (; i < array.length; i++) {
    if (i in array) acc = fn(acc, array[i], i, array);
  }
  return acc;
}
```

%% exercise arrays-group-by | groupBy & countBy | 2 | js | js | groupBy, countBy | 10
- `groupBy(items, key)` returns an object mapping each key to the array of items with that key. `key` is either a property name (`'role'`) or a function `(item) => key`.
- `countBy(items, key)` does the same but with counts.
- Items keep their original relative order inside each group.
- Keys like `constructor`, `toString` and `__proto__` must work as ordinary keys.

%% starter
```js
export function groupBy(items, key) {
  // your code
}

export function countBy(items, key) {
  // your code
}
```

%% tests
```js
const people = [
  { name: 'Ada', role: 'eng' },
  { name: 'Grace', role: 'admiral' },
  { name: 'Linus', role: 'eng' },
];

describe('groupBy', () => {
  it('groups by property name', () => {
    expect(groupBy(people, 'role')).toEqual({
      eng: [people[0], people[2]],
      admiral: [people[1]],
    });
  });
  it('groups by function', () => {
    expect(groupBy([1, 2, 3, 4, 5], (n) => (n % 2 ? 'odd' : 'even'))).toEqual({ odd: [1, 3, 5], even: [2, 4] });
  });
  it('returns {} for an empty list', () => expect(groupBy([], 'x')).toEqual({}));
  it('handles keys that collide with Object.prototype', () => {
    const out = groupBy([{ k: 'constructor' }, { k: '__proto__' }, { k: 'toString' }], 'k');
    expect(Object.keys(out).sort()).toEqual(['__proto__', 'constructor', 'toString']);
    expect(out.constructor).toEqual([{ k: 'constructor' }]);
  });
  it('keeps the same item references', () => {
    expect(groupBy(people, 'role').eng[0]).toBe(people[0]);
  });
});

describe('countBy', () => {
  it('counts by property', () => expect(countBy(people, 'role')).toEqual({ eng: 2, admiral: 1 }));
  it('counts by function', () => expect(countBy(['a', 'bb', 'cc'], (s) => s.length)).toEqual({ 1: 1, 2: 2 }));
  it('handles prototype-named keys', () => {
    expect(countBy(['constructor', 'constructor'], (x) => x).constructor).toBe(2);
  });
});
```

%% hints
- Resolve the key function once: `const fn = typeof key === 'function' ? key : (x) => x[key]`.
- A plain `{}` already has `constructor` on its prototype, so `acc[k] ??= []` is wrong for that key. Start from `Object.create(null)`.
- `toEqual` ignores the prototype, so a null-prototype result still equals `{ … }`.

%% solution
```js
function keyFn(key) {
  return typeof key === 'function' ? key : (item) => item[key];
}

export function groupBy(items, key) {
  const get = keyFn(key);
  const out = Object.create(null);
  for (const item of items) {
    const k = get(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

export function countBy(items, key) {
  const get = keyFn(key);
  const out = Object.create(null);
  for (const item of items) {
    const k = get(item);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
```

%% exercise arrays-flatten | flatten with depth | 3 | js | js | flatten | 12
Implement `flatten(array, depth = 1)` **without** `Array.prototype.flat`.

- `depth` levels of nesting are flattened; `Infinity` flattens everything.
- `depth = 0` returns a shallow copy.
- Only real arrays are flattened (strings, objects and array-likes are left alone).
- Holes are dropped, like the native `flat`.
- Must not blow the call stack on 10 000 levels of nesting **when `depth` is `Infinity`**. (Hint: iterate, don't recurse.)

%% starter
```js
export function flatten(array, depth = 1) {
  // your code
}
```

%% tests
```js
describe('flatten', () => {
  it('flattens one level by default', () => {
    expect(flatten([1, [2, [3, [4]]]])).toEqual([1, 2, [3, [4]]]);
  });
  it('flattens to a given depth', () => {
    expect(flatten([1, [2, [3, [4]]]], 2)).toEqual([1, 2, 3, [4]]);
  });
  it('flattens everything with Infinity', () => {
    expect(flatten([1, [2, [3, [4, [5]]]]], Infinity)).toEqual([1, 2, 3, 4, 5]);
  });
  it('depth 0 is a shallow copy', () => {
    const src = [1, [2]];
    const out = flatten(src, 0);
    expect(out).toEqual([1, [2]]);
    expect(out).not.toBe(src);
  });
  it('leaves strings and objects alone', () => {
    expect(flatten(['ab', { a: [1] }, [['c']]], Infinity)).toEqual(['ab', { a: [1] }, 'c']);
  });
  it('drops holes', () => {
    expect(flatten([1, , [2, , 3]], Infinity)).toEqual([1, 2, 3]);
  });
  it('keeps order', () => {
    expect(flatten([[1, 2], [3], [[4], 5]], Infinity)).toEqual([1, 2, 3, 4, 5]);
  });
  it('survives very deep nesting', () => {
    let deep = [1];
    for (let i = 0; i < 10000; i++) deep = [deep];
    expect(flatten(deep, Infinity)).toEqual([1]);
  });
  it('does not use native flat', () => {
    const orig = Array.prototype.flat;
    Array.prototype.flat = () => { throw new Error('native flat used'); };
    let out;
    try { out = flatten([[1]], 1); } finally { Array.prototype.flat = orig; }
    expect(out).toEqual([1]);
  });
});
```

%% hints
- Recursion is the obvious version. It's fine for small depth, but 10 000 frames deep it will overflow.
- Iterative version: keep an explicit stack of `[value, remainingDepth]` pairs, pushing items in reverse so they pop in order.
- Skip holes with `i in array` when you expand an array onto the stack.

%% solution
```js
export function flatten(array, depth = 1) {
  const out = [];
  const stack = [];
  for (let i = array.length - 1; i >= 0; i--) {
    if (i in array) stack.push([array[i], depth]);
  }
  while (stack.length) {
    const [value, d] = stack.pop();
    if (Array.isArray(value) && d > 0) {
      for (let i = value.length - 1; i >= 0; i--) {
        if (i in value) stack.push([value[i], d - 1]);
      }
    } else {
      out.push(value);
    }
  }
  return out;
}
```

%% exercise arrays-sort-by | Multi-key stable sortBy | 3 | js | js | sortBy | 20
Write `sortBy(items, ...keys)` returning a **new** sorted array.

- Each key is a property name (`'age'`), a property name prefixed with `-` for descending (`'-age'`), or a function `(item) => value` (ascending).
- Earlier keys take priority; later keys break ties.
- Numbers compare numerically, strings with `localeCompare`; `null`/`undefined` sort **last** regardless of direction.
- The sort must be **stable** and must not mutate the input.

%% starter
```js
export function sortBy(items, ...keys) {
  // your code
}
```

%% tests
```js
const people = [
  { name: 'Cy', age: 30, team: 'b' },
  { name: 'Al', age: 25, team: 'a' },
  { name: 'Bo', age: 30, team: 'a' },
  { name: 'Di', age: 25, team: 'b' },
];
const names = (l) => l.map((p) => p.name);

describe('sortBy', () => {
  it('sorts ascending by one key', () => {
    expect(names(sortBy(people, 'age'))).toEqual(['Al', 'Di', 'Cy', 'Bo']);
  });
  it('is stable for equal keys', () => {
    expect(names(sortBy(people, 'team'))).toEqual(['Al', 'Bo', 'Cy', 'Di']);
  });
  it('supports descending with a - prefix', () => {
    expect(names(sortBy(people, '-age'))).toEqual(['Cy', 'Bo', 'Al', 'Di']);
  });
  it('breaks ties with later keys', () => {
    expect(names(sortBy(people, 'team', '-age', 'name'))).toEqual(['Bo', 'Al', 'Cy', 'Di']);
  });
  it('accepts functions', () => {
    expect(names(sortBy(people, (p) => p.name.toLowerCase().charCodeAt(1)))).toEqual(['Al', 'Bo', 'Cy', 'Di'].sort((a, b) => a.charCodeAt(1) - b.charCodeAt(1)));
  });
  it('compares numbers numerically, not as strings', () => {
    expect(sortBy([{ n: 10 }, { n: 9 }, { n: 1 }], 'n').map((x) => x.n)).toEqual([1, 9, 10]);
  });
  it('compares strings with localeCompare', () => {
    expect(sortBy([{ s: 'b' }, { s: 'A' }, { s: 'a' }], 's').map((x) => x.s)).toEqual(['a', 'A', 'b']);
  });
  it('puts null/undefined last in both directions', () => {
    const list = [{ v: 2 }, { v: null }, { v: 1 }, {}];
    expect(sortBy(list, 'v').map((x) => x.v ?? null)).toEqual([1, 2, null, null]);
    expect(sortBy(list, '-v').map((x) => x.v ?? null)).toEqual([2, 1, null, null]);
  });
  it('does not mutate the input', () => {
    const src = Object.freeze([...people]);
    const out = sortBy(src, 'age');
    expect(out).not.toBe(src);
    expect(names(src)).toEqual(['Cy', 'Al', 'Bo', 'Di']);
  });
  it('with no keys returns a copy in the same order', () => {
    expect(sortBy([3, 1, 2])).toEqual([3, 1, 2]);
  });
});
```

%% hints
- Normalise each key into `{ get, dir }` first: `'-age'` → `get: (x) => x.age`, `dir: -1`.
- Comparator: loop over keys; return the first non-zero result.
- Handle nullish **before** applying `dir`, so they stay last either way.
- `[...items].sort(cmp)` — native `sort` is stable in every modern engine.

%% solution
```js
function compileKey(key) {
  if (typeof key === 'function') return { get: key, dir: 1 };
  const desc = key.startsWith('-');
  const prop = desc ? key.slice(1) : key;
  return { get: (item) => item[prop], dir: desc ? -1 : 1 };
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a < b ? -1 : a > b ? 1 : 0;
  return String(a).localeCompare(String(b));
}

export function sortBy(items, ...keys) {
  const compiled = keys.map(compileKey);
  return [...items].sort((x, y) => {
    for (const { get, dir } of compiled) {
      const a = get(x);
      const b = get(y);
      const aNil = a == null;
      const bNil = b == null;
      if (aNil || bNil) {
        if (aNil && bNil) continue;
        return aNil ? 1 : -1;
      }
      const c = compareValues(a, b);
      if (c !== 0) return c * dir;
    }
    return 0;
  });
}
```
