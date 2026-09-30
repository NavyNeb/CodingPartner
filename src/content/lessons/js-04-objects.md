---
id: objects
track: js
title: Objects, references & copying
summary: Value vs reference, shallow vs deep, and the path helpers you'll write in every codebase.
---

## Values and references

Primitives (`number`, `string`, `boolean`, `null`, `undefined`, `symbol`, `bigint`) are compared and copied **by value**. Everything else — objects, arrays, functions, dates, maps — is a **reference**: a variable holds a pointer to the thing.

```js
const a = { n: 1 };
const b = a;          // same object, two names
b.n = 2;
a.n;                  // 2
{ n: 1 } === { n: 1 } // false — two different objects
```

`===` on objects asks "same object?", never "same contents?". That one fact explains why React re-renders, why `useEffect([obj])` fires every time, and why `arr.includes({})` is always `false`.

## Shallow vs. deep copies

```js
const copy1 = { ...original };            // shallow
const copy2 = Object.assign({}, original);// shallow
const copy3 = structuredClone(original);  // deep (built in)
const copy4 = JSON.parse(JSON.stringify(original)); // deep-ish, lossy
```

A shallow copy duplicates only the **top level**; nested objects are still shared:

```js
const user = { name: 'Ada', address: { city: 'London' } };
const copy = { ...user };
copy.address.city = 'Paris';
user.address.city; // "Paris" 😬
```

`structuredClone` handles Dates, Maps, Sets, typed arrays and cycles, but throws on functions and drops prototypes. The JSON trick turns `Date`s into strings, drops `undefined`/functions, and dies on cycles. You'll write a deep clone below to see exactly what it takes.

## Immutable updates

To "change" nested state without mutating, copy **along the path** and share the rest:

```js
const next = { ...state, user: { ...state.user, address: { ...state.user.address, city: 'Paris' } } };
```

Everything not on the path keeps its identity, which is precisely what lets `React.memo` and selectors skip work. Ugly for deep paths — hence the `set(obj, path, value)` helper you'll write.

`Object.freeze` is **shallow** and only a runtime guard (silently ignored in sloppy mode, throws in strict). Use it in tests and dev, not as architecture.

## Property access safety

- `?.` short-circuits on `null`/`undefined`: `user?.address?.city`.
- `??` falls back only on `null`/`undefined`; `||` falls back on *any* falsy value (`0`, `''`, `false`). Prefer `??` for defaults.
- `in` checks the prototype chain; `Object.hasOwn(obj, k)` checks own properties only.
- Objects as dictionaries: keys like `__proto__`/`constructor` are a footgun. Use `Map`, or `Object.create(null)`.

## Iterating

`Object.keys/values/entries` (own, enumerable, string keys) + `Object.fromEntries` cover most transformations:

```js
const doubled = Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, v * 2]));
```

Key order: integer-like keys ascending first, then string keys in insertion order. Don't build logic on it beyond that.

## Descriptors, briefly

Each property has flags: `writable`, `enumerable`, `configurable`, or accessor `get`/`set`. Class methods are non-enumerable, which is why `for…in` over an instance doesn't list them. `Object.defineProperty` is how libraries add hidden metadata.

%% exercise objects-destructure | Destructuring drill | 1 | js | js | describeUser | 6
Write `describeUser(user)` that returns a string using **destructuring in the parameter list**.

- Format: `"<name> (<role>) — <city>"`.
- `role` defaults to `"member"` when missing.
- `city` comes from `user.address.city`; when there is no address or no city, use `"unknown"`.
- Extra properties are ignored, and the input must not be mutated.

%% starter
```js
export function describeUser(user) {
  // Use destructuring — e.g. ({ name, role = 'member', address }) =>
  return '';
}
```

%% tests
```js
describe('describeUser', () => {
  it('formats a complete user', () => {
    expect(describeUser({ name: 'Ada', role: 'admin', address: { city: 'London' } })).toBe('Ada (admin) — London');
  });
  it('defaults the role', () => {
    expect(describeUser({ name: 'Linus', address: { city: 'Helsinki' } })).toBe('Linus (member) — Helsinki');
  });
  it('handles a missing address', () => {
    expect(describeUser({ name: 'Grace' })).toBe('Grace (member) — unknown');
  });
  it('handles an address without a city', () => {
    expect(describeUser({ name: 'Alan', address: {} })).toBe('Alan (member) — unknown');
  });
  it('only defaults undefined, not other falsy roles', () => {
    expect(describeUser({ name: 'X', role: '' })).toBe('X () — unknown');
  });
  it('ignores extra props', () => {
    expect(describeUser({ name: 'Y', age: 30, tags: [] })).toBe('Y (member) — unknown');
  });
});
```

%% hints
- Defaults in destructuring apply only when the value is `undefined` — exactly what the `role: ''` test checks.
- Nested: `{ name, role = 'member', address: { city = 'unknown' } = {} }`.

%% solution
```js
export function describeUser({ name, role = 'member', address: { city = 'unknown' } = {} }) {
  return `${name} (${role}) — ${city}`;
}
```

%% exercise objects-pick-omit | pick & omit | 2 | js | js | pick, omit | 10
- `pick(obj, keys)` → a new object with only the listed keys **that exist as own properties**.
- `omit(obj, keys)` → a new object without the listed keys (own enumerable properties only; symbol keys are preserved).
- Neither mutates `obj`. Values are copied by reference (shallow).

%% starter
```js
export function pick(obj, keys) {
  // your code
}

export function omit(obj, keys) {
  // your code
}
```

%% tests
```js
const src = Object.freeze({ a: 1, b: 2, c: { d: 3 } });

describe('pick', () => {
  it('picks listed keys', () => expect(pick(src, ['a', 'c'])).toEqual({ a: 1, c: { d: 3 } }));
  it('ignores keys that are not present', () => expect(pick(src, ['a', 'zzz'])).toEqual({ a: 1 }));
  it('does not pick inherited properties', () => {
    const child = Object.create({ inherited: 1 });
    child.own = 2;
    expect(pick(child, ['inherited', 'own'])).toEqual({ own: 2 });
  });
  it('keeps undefined-valued own keys', () => {
    expect(Object.keys(pick({ a: undefined }, ['a']))).toEqual(['a']);
  });
  it('is shallow', () => expect(pick(src, ['c']).c).toBe(src.c));
  it('returns a new object', () => expect(pick(src, [])).not.toBe(src));
});

describe('omit', () => {
  it('drops listed keys', () => expect(omit(src, ['a'])).toEqual({ b: 2, c: { d: 3 } }));
  it('ignores unknown keys', () => expect(omit(src, ['nope'])).toEqual({ a: 1, b: 2, c: { d: 3 } }));
  it('keeps symbol keys', () => {
    const s = Symbol('s');
    expect(omit({ a: 1, [s]: 2 }, ['a'])[s]).toBe(2);
  });
  it('does not mutate the source', () => {
    const o = { a: 1, b: 2 };
    omit(o, ['a']);
    expect(o).toEqual({ a: 1, b: 2 });
  });
});
```

%% hints
- `Object.hasOwn(obj, key)` is the modern `hasOwnProperty`.
- `omit` can be built from `Reflect.ownKeys` + a `Set` of the excluded keys, or spread-then-`delete` on a copy.

%% solution
```js
export function pick(obj, keys) {
  const out = {};
  for (const k of keys) {
    if (Object.hasOwn(obj, k)) out[k] = obj[k];
  }
  return out;
}

export function omit(obj, keys) {
  const drop = new Set(keys);
  const out = {};
  for (const k of Reflect.ownKeys(obj)) {
    if (!drop.has(k) && Object.getOwnPropertyDescriptor(obj, k).enumerable) out[k] = obj[k];
  }
  return out;
}
```

%% exercise objects-get-set | get & set by path | 3 | js | js | get, set | 20
Path helpers, à la lodash.

- `get(obj, path, defaultValue?)` — `path` is a string like `'a.b[0].c'` or an array `['a', 'b', 0, 'c']`. Returns `defaultValue` when the resolved value is `undefined` (but `null`, `0`, `''` and `false` are real values).
- `set(obj, path, value)` — returns a **new** object with the value set, leaving `obj` untouched. Only objects/arrays **along the path** are copied; siblings keep their identity. Missing intermediates are created: an **array** if the next key is a non-negative integer, otherwise an object.

%% starter
```js
export function get(obj, path, defaultValue) {
  // your code
}

export function set(obj, path, value) {
  // your code
}
```

%% tests
```js
describe('get', () => {
  const data = { a: { b: [{ c: 42 }, null] }, z: 0, n: null, u: undefined };

  it('reads dotted and bracket paths', () => {
    expect(get(data, 'a.b[0].c')).toBe(42);
    expect(get(data, 'a.b.0.c')).toBe(42);
  });
  it('reads array paths', () => expect(get(data, ['a', 'b', 0, 'c'])).toBe(42));
  it('returns the default for missing paths', () => {
    expect(get(data, 'a.x.y', 'dflt')).toBe('dflt');
    expect(get(data, 'a.b[5].c', 'dflt')).toBe('dflt');
  });
  it('returns the default when the value is undefined', () => expect(get(data, 'u', 'd')).toBe('d'));
  it('keeps falsy real values', () => {
    expect(get(data, 'z', 'd')).toBe(0);
    expect(get(data, 'n', 'd')).toBeNull();
  });
  it('does not throw through null in the middle', () => {
    expect(get(data, 'a.b[1].c', 'safe')).toBe('safe');
  });
  it('returns the object for an empty path', () => expect(get(data, [])).toBe(data));
  it('handles a nullish root', () => expect(get(undefined, 'a.b', 1)).toBe(1));
});

describe('set', () => {
  it('sets an existing nested value immutably', () => {
    const src = Object.freeze({ a: Object.freeze({ b: 1, keep: Object.freeze({ x: 1 }) }), other: Object.freeze({}) });
    const out = set(src, 'a.b', 2);
    expect(out).toEqual({ a: { b: 2, keep: { x: 1 } }, other: {} });
    expect(src.a.b).toBe(1);
  });
  it('shares untouched branches', () => {
    const src = { a: { b: 1 }, other: { y: 2 } };
    const out = set(src, 'a.b', 9);
    expect(out.other).toBe(src.other);
    expect(out.a).not.toBe(src.a);
    expect(out).not.toBe(src);
  });
  it('creates missing objects', () => {
    expect(set({}, 'a.b.c', 1)).toEqual({ a: { b: { c: 1 } } });
  });
  it('creates arrays for numeric keys', () => {
    const out = set({}, 'list[1].name', 'x');
    expect(Array.isArray(out.list)).toBe(true);
    expect(out.list[1]).toEqual({ name: 'x' });
    expect(out.list.length).toBe(2);
  });
  it('copies arrays along the path instead of mutating', () => {
    const src = { list: [1, 2, 3] };
    const out = set(src, ['list', 1], 'two');
    expect(out.list).toEqual([1, 'two', 3]);
    expect(src.list).toEqual([1, 2, 3]);
    expect(Array.isArray(out.list)).toBe(true);
  });
  it('overwrites a primitive in the way', () => {
    expect(set({ a: 5 }, 'a.b', 1)).toEqual({ a: { b: 1 } });
  });
  it('returns value itself for an empty path', () => expect(set({ a: 1 }, [], 7)).toBe(7));
});
```

%% hints
- Normalise the path once: `Array.isArray(path) ? path : path.replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean)`.
- `get`: loop, bailing to the default the moment `cur == null`.
- `set` is naturally recursive: `set(obj, [head, ...rest], v)` → copy `obj`, replace `head` with `set(obj?.[head], rest, v)`.
- To pick array vs object for a missing child, look at the *next* key: `/^\d+$/.test(String(rest[0]))`.

%% solution
```js
function toPath(path) {
  return Array.isArray(path) ? path : String(path).replace(/\[(\w+)\]/g, '.$1').split('.').filter(Boolean);
}

export function get(obj, path, defaultValue) {
  let cur = obj;
  for (const key of toPath(path)) {
    if (cur == null) return defaultValue;
    cur = cur[key];
  }
  return cur === undefined ? defaultValue : cur;
}

export function set(obj, path, value) {
  const keys = toPath(path);
  if (!keys.length) return value;
  const [head, ...rest] = keys;
  const isObj = obj !== null && typeof obj === 'object';
  const base = isObj ? obj : /^\d+$/.test(String(head)) ? [] : {};
  const copy = Array.isArray(base) ? [...base] : { ...base };
  let child = isObj ? obj[head] : undefined;
  if (rest.length) {
    if (child === null || typeof child !== 'object') child = /^\d+$/.test(String(rest[0])) ? [] : {};
    copy[head] = set(child, rest, value);
  } else {
    copy[head] = value;
  }
  return copy;
}
```

%% exercise objects-deep-equal | deepEqual | 3 | js | js | deepEqual | 20
Write `deepEqual(a, b)`.

- Primitives compare with `Object.is`, except that `+0` and `-0` are considered equal.
- Arrays are equal when same length and pairwise deep-equal. An array never equals a plain object.
- Plain objects: same set of own enumerable keys, deep-equal values, key order irrelevant. `{a: undefined}` is **not** equal to `{}`.
- `Date`s compare by time, `RegExp`s by source + flags.
- Circular structures must not cause infinite recursion.

%% starter
```js
export function deepEqual(a, b) {
  // your code
}
```

%% tests
```js
describe('deepEqual', () => {
  it('compares primitives', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual(1, '1')).toBe(false);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(null, undefined)).toBe(false);
  });
  it('treats NaN as equal to NaN and +0 as equal to -0', () => {
    expect(deepEqual(NaN, NaN)).toBe(true);
    expect(deepEqual(0, -0)).toBe(true);
  });
  it('compares arrays', () => {
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
  });
  it('compares objects regardless of key order', () => {
    expect(deepEqual({ a: 1, b: { c: 2 } }, { b: { c: 2 }, a: 1 })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
  it('distinguishes missing keys from undefined values', () => {
    expect(deepEqual({ a: undefined }, {})).toBe(false);
    expect(deepEqual({}, { a: undefined })).toBe(false);
  });
  it('never equates arrays and objects', () => {
    expect(deepEqual([], {})).toBe(false);
    expect(deepEqual({ 0: 'a', length: 1 }, ['a'])).toBe(false);
  });
  it('compares dates and regexps', () => {
    expect(deepEqual(new Date(5), new Date(5))).toBe(true);
    expect(deepEqual(new Date(5), new Date(6))).toBe(false);
    expect(deepEqual(/a/g, /a/g)).toBe(true);
    expect(deepEqual(/a/g, /a/i)).toBe(false);
  });
  it('handles null carefully', () => {
    expect(deepEqual(null, {})).toBe(false);
    expect(deepEqual({ a: null }, { a: null })).toBe(true);
  });
  it('survives circular references', () => {
    const a = { n: 1 }; a.self = a;
    const b = { n: 1 }; b.self = b;
    expect(deepEqual(a, b)).toBe(true);
    const c = { n: 2 }; c.self = c;
    expect(deepEqual(a, c)).toBe(false);
  });
  it('is symmetric on differing key counts', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
});
```

%% hints
- Start with `Object.is(a, b)` (then special-case `0`/`-0`), then bail out unless both are non-null objects.
- Compare `Array.isArray(a) !== Array.isArray(b)` and `Object.prototype.toString.call` tags for Dates/RegExps.
- For cycles carry a `WeakMap<object, Set<object>>` of pairs already being compared and treat a revisit as "equal so far".
- Keys: `Object.keys(a)` lengths must match, and each key must satisfy `Object.hasOwn(b, key)`.

%% solution
```js
export function deepEqual(a, b, seen = new WeakMap()) {
  if (Object.is(a, b) || (a === 0 && b === 0)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (seen.get(a)?.has(b)) return true;
  if (!seen.has(a)) seen.set(a, new Set());
  seen.get(a).add(b);

  const tag = Object.prototype.toString.call(a);
  if (tag !== Object.prototype.toString.call(b)) return false;
  if (tag === '[object Date]') return a.getTime() === b.getTime();
  if (tag === '[object RegExp]') return a.source === b.source && a.flags === b.flags;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k], seen));
}
```

%% exercise objects-deep-clone | deepClone | 4 | js | js | deepClone | 25
Write `deepClone(value)` — a **from-scratch** `structuredClone` that also keeps prototypes.

- Primitives are returned as-is; **functions are returned by reference**.
- Plain objects and arrays are cloned recursively (own enumerable string **and** symbol keys).
- `Date`, `RegExp`, `Map`, `Set` are cloned (Map keys and Set members are cloned too).
- Class instances keep their prototype.
- **Cycles and shared references are preserved**: `clone.self === clone`, and if two properties pointed at the same object, the clones point at one shared clone.

%% starter
```js
export function deepClone(value) {
  // your code
}
```

%% tests
```js
describe('deepClone', () => {
  it('returns primitives unchanged', () => {
    expect(deepClone(1)).toBe(1);
    expect(deepClone('s')).toBe('s');
    expect(deepClone(null)).toBeNull();
    expect(deepClone(undefined)).toBeUndefined();
  });

  it('clones nested objects and arrays without sharing references', () => {
    const src = { a: [1, { b: 2 }], c: { d: 3 } };
    const out = deepClone(src);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
    expect(out.a).not.toBe(src.a);
    expect(out.a[1]).not.toBe(src.a[1]);
    expect(out.c).not.toBe(src.c);
  });

  it('clones Date and RegExp', () => {
    const d = new Date(1234);
    const r = /x/gi;
    const out = deepClone({ d, r });
    expect(out.d).not.toBe(d);
    expect(out.d.getTime()).toBe(1234);
    expect(out.r).not.toBe(r);
    expect(out.r.flags).toBe('gi');
  });

  it('clones Map and Set deeply', () => {
    const inner = { v: 1 };
    const src = { m: new Map([['k', inner]]), s: new Set([inner]) };
    const out = deepClone(src);
    expect(out.m.get('k')).toEqual({ v: 1 });
    expect(out.m.get('k')).not.toBe(inner);
    expect([...out.s][0]).not.toBe(inner);
    expect(out.m).not.toBe(src.m);
  });

  it('preserves cycles', () => {
    const a = { name: 'a' };
    a.self = a;
    const out = deepClone(a);
    expect(out).not.toBe(a);
    expect(out.self).toBe(out);
  });

  it('preserves shared references', () => {
    const shared = { x: 1 };
    const out = deepClone({ p: shared, q: shared, list: [shared] });
    expect(out.p).toBe(out.q);
    expect(out.list[0]).toBe(out.p);
    expect(out.p).not.toBe(shared);
  });

  it('keeps functions by reference', () => {
    const fn = () => 1;
    expect(deepClone({ fn }).fn).toBe(fn);
  });

  it('keeps prototypes of class instances', () => {
    class Point { constructor(x) { this.x = x; } double() { return this.x * 2; } }
    const out = deepClone(new Point(4));
    expect(out).toBeInstanceOf(Point);
    expect(out.double()).toBe(8);
  });

  it('copies symbol keys', () => {
    const s = Symbol('k');
    expect(deepClone({ [s]: { a: 1 } })[s]).toEqual({ a: 1 });
  });

  it('keeps undefined-valued properties', () => {
    expect('a' in deepClone({ a: undefined })).toBe(true);
  });

  it('does not overflow on wide-but-shallow data', () => {
    const wide = Array.from({ length: 5000 }, (_, i) => ({ i }));
    expect(deepClone(wide)).toHaveLength(5000);
  });
});
```

%% hints
- Keep a `WeakMap<original, clone>`; register the **clone before recursing** into children. That is what makes cycles and shared references work.
- `Object.create(Object.getPrototypeOf(v))` preserves class instances; for arrays use `[]`.
- Copy keys with `Reflect.ownKeys` and skip non-enumerables if you want to be strict.
- Dispatch on `Object.prototype.toString.call(v)` (or `instanceof`) for Date/RegExp/Map/Set.

%% solution
```js
export function deepClone(value, seen = new WeakMap()) {
  if (value === null || (typeof value !== 'object')) return value; // primitives + functions
  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) {
    const r = new RegExp(value.source, value.flags);
    r.lastIndex = value.lastIndex;
    return r;
  }
  if (value instanceof Map) {
    const m = new Map();
    seen.set(value, m);
    value.forEach((v, k) => m.set(deepClone(k, seen), deepClone(v, seen)));
    return m;
  }
  if (value instanceof Set) {
    const s = new Set();
    seen.set(value, s);
    value.forEach((v) => s.add(deepClone(v, seen)));
    return s;
  }

  const out = Array.isArray(value) ? new Array(value.length) : Object.create(Object.getPrototypeOf(value));
  seen.set(value, out);
  for (const key of Reflect.ownKeys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc.enumerable && !Array.isArray(value)) continue;
    if (Array.isArray(value) && key === 'length') continue;
    out[key] = deepClone(value[key], seen);
  }
  return out;
}
```

%% exercise objects-flatten | flatten & unflatten keys | 3 | js | js | flattenObject, unflattenObject | 18
Convert nested data to a flat map of **dot-separated paths** and back.

```js
flattenObject({ a: { b: 1, c: [10, 20] }, d: 'x' });
// { 'a.b': 1, 'a.c.0': 10, 'a.c.1': 20, d: 'x' }
```

- Arrays are flattened by index.
- Empty objects/arrays are kept as **leaf values** (`{ a: {} }` → `{ a: {} }`) so nothing is lost.
- `unflattenObject` is the inverse: numeric segments create **arrays**, others create objects. `unflattenObject(flattenObject(x))` must round-trip.

%% starter
```js
export function flattenObject(obj) {
  // your code
}

export function unflattenObject(flat) {
  // your code
}
```

%% tests
```js
describe('flattenObject', () => {
  it('flattens nested objects', () => {
    expect(flattenObject({ a: { b: { c: 1 } }, d: 2 })).toEqual({ 'a.b.c': 1, d: 2 });
  });
  it('flattens arrays by index', () => {
    expect(flattenObject({ a: [1, { b: 2 }] })).toEqual({ 'a.0': 1, 'a.1.b': 2 });
  });
  it('keeps empty containers as leaves', () => {
    expect(flattenObject({ a: {}, b: [] })).toEqual({ a: {}, b: [] });
  });
  it('keeps null and undefined leaves', () => {
    expect(flattenObject({ a: null, b: undefined })).toEqual({ a: null, b: undefined });
  });
  it('treats Dates as leaves', () => {
    const d = new Date(0);
    expect(flattenObject({ when: d })['when']).toBe(d);
  });
  it('returns {} for {}', () => expect(flattenObject({})).toEqual({}));
});

describe('unflattenObject', () => {
  it('rebuilds nested objects', () => {
    expect(unflattenObject({ 'a.b.c': 1, d: 2 })).toEqual({ a: { b: { c: 1 } }, d: 2 });
  });
  it('rebuilds arrays from numeric segments', () => {
    const out = unflattenObject({ 'a.0': 1, 'a.1.b': 2 });
    expect(Array.isArray(out.a)).toBe(true);
    expect(out).toEqual({ a: [1, { b: 2 }] });
  });
  it('round-trips', () => {
    const src = { user: { name: 'Ada', tags: ['x', 'y'], meta: {} }, list: [[1, 2], [3]] };
    expect(unflattenObject(flattenObject(src))).toEqual(src);
  });
});
```

%% hints
- Recursive walk with a `prefix`. A value is a *container* if it's a plain object or an array with at least one entry.
- `Object.prototype.toString.call(v) === '[object Object]'` is a robust "plain object" check that excludes Dates.
- For `unflatten`, reuse the idea from `set`: create an array when the next segment is all digits.

%% solution
```js
const isPlain = (v) => Object.prototype.toString.call(v) === '[object Object]';

export function flattenObject(obj) {
  const out = {};
  const walk = (value, prefix) => {
    const container = Array.isArray(value) ? value.length > 0 : isPlain(value) && Object.keys(value).length > 0;
    if (!container) {
      if (prefix) out[prefix] = value;
      return;
    }
    for (const key of Object.keys(value)) walk(value[key], prefix ? `${prefix}.${key}` : key);
  };
  walk(obj, '');
  return out;
}

export function unflattenObject(flat) {
  const isIndex = (s) => /^\d+$/.test(s);
  let root;
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split('.');
    root ??= isIndex(keys[0]) ? [] : {};
    let cur = root;
    keys.forEach((key, i) => {
      if (i === keys.length - 1) {
        cur[key] = value;
      } else {
        cur[key] ??= isIndex(keys[i + 1]) ? [] : {};
        cur = cur[key];
      }
    });
  }
  return root ?? {};
}
```
