---
id: objects
track: js
title: Objects, references & copying
summary: Why copying an object doesn't always copy it, how to change nested data safely, and the everyday helpers (pick, get, set, deep clone) behind it.
---

## The idea in one sentence

Numbers and strings are **copied**; objects are **shared** — a variable holding an object holds a *link* to it, not the object itself.

> **Analogy** A number is like a photo: if you copy it and scribble on your copy, the original is untouched. An object is like a **link to a shared online document**: copy the link and you now have two links to the *same* document — edit through either and both see the change.

![Primitives are copied into separate boxes; objects are shared by reference](fig:ref-vs-value "Left: `y` got its own copy of 1. Right: `a` and `b` are two names for one object.")

## Values vs references

Primitives (`number`, `string`, `boolean`, `null`, `undefined`, `symbol`, `bigint`) are compared and copied **by value**. Everything else — objects, arrays, functions, dates, Maps — is held **by reference**.

```js try predict
let x = 1;
let y = x;
y = 2;
console.log(x, y);

const a = { n: 1 };
const b = a;        // b is another name for the SAME object
b.n = 2;
console.log(a.n);
```

### `===` on objects asks "same object?"

```js try predict
console.log({ n: 1 } === { n: 1 });   // two different objects that look alike

const user = { n: 1 };
console.log(user === user);

console.log([{ id: 1 }].includes({ id: 1 }));
```

`===` never asks "same contents?" for objects. That one fact explains why React re-renders when you pass a fresh `{}` every time, why `useEffect(..., [obj])` runs on every render, and why `arr.includes({})` is always `false`.

## Copying objects: shallow vs deep

```js
const copy1 = { ...original };               // shallow
const copy2 = Object.assign({}, original);    // shallow
const copy3 = structuredClone(original);      // deep (built in)
const copy4 = JSON.parse(JSON.stringify(original)); // deep-ish, but lossy
```

A **shallow** copy duplicates only the top level. Anything nested is still shared:

![A shallow copy shares the nested address object; a deep copy has its own](fig:shallow-deep "Shallow: two objects, one shared `address`. Deep: everything is duplicated.")

```js try predict
const user = { name: 'Ada', address: { city: 'London' } };
const copy = { ...user };

copy.name = 'Grace';           // top level: independent
copy.address.city = 'Paris';   // nested: shared!

console.log(user.name, user.address.city);
```

The **deep** options and their limits:

```js try
const original = { when: new Date(0), tags: new Set(['a']), nested: { n: 1 } };

const a = structuredClone(original);
console.log(a.when instanceof Date, a.tags instanceof Set);

const b = JSON.parse(JSON.stringify(original));
console.log(typeof b.when, b.tags);   // the Date became a string; the Set became {}
```

`structuredClone` copies Dates, Maps, Sets and even circular structures — but throws on functions and drops class prototypes. The JSON trick turns Dates into strings, drops `undefined` and functions, and fails on cycles. You'll write your own deep clone to see exactly what it takes.

## Changing nested data without mutating ("immutable updates")

To "change" state that lives three levels down, copy **every object along the path** and share everything else:

```js
const next = {
  ...state,
  user: { ...state.user, address: { ...state.user.address, city: 'Paris' } },
};
```

![Old and new state share everything off the path; only root, user and address are copied](fig:path-update "Only the objects on the path to `city` are new. `settings` is the same object in both, so `old.settings === next.settings`.")

That sharing is the whole point: `React.memo` and selectors can tell "nothing changed here" with a simple `===`. Step through how spread builds the new object:

```stepper Changing user.name without touching the old state
code:
  const next = {
    ...state,
    user: { ...state.user, name: 'Grace' },
  };
---
line: 1-4
say: We want a new state where only `user.name` differs. The old `state` has a `user` and a `settings` object.
state (old): user { name: "Ada" } | settings { theme: "dark" }
next (new):
Shared with old:
---
line: 2
say: `...state` copies the **top-level keys** into the new object. The values are copied by reference: `next.user` and `next.settings` point at the *old* objects.
next (new): user → old user | settings → old settings
Shared with old: user | settings
---
line: 3
say: The next line **overwrites** `user` with a brand-new object: a copy of the old user, with `name` replaced.
next (new): user { name: "Grace" } (new) | settings → old settings
Shared with old: settings
---
line: 4
say: Done. `state` was never changed. `next` differs only along the path, and `next.settings === state.settings` — so anything that depends only on `settings` can skip work.
```

For deep paths that gets ugly, which is why helpers like `set(obj, path, value)` exist (you'll write one).

> **Watch out** `Object.freeze` is **shallow** too, and outside strict mode it silently ignores writes. Use it in tests or dev to catch accidental mutation, not as your architecture.

## Reading properties safely

```js try predict
const user = { name: 'Ada', score: 0, address: null };

console.log(user.address?.city);      // ?. stops at null/undefined instead of crashing
console.log(user.score || 100);       // || replaces ANY falsy value
console.log(user.score ?? 100);       // ?? replaces only null/undefined
console.log('toString' in user, Object.hasOwn(user, 'toString'));
```

- `?.` = "if this is `null`/`undefined`, stop and give me `undefined`".
- Prefer `??` for defaults: `0`, `''` and `false` are real values.
- `in` also looks up the prototype chain; `Object.hasOwn(obj, key)` checks the object itself.
- Using objects as dictionaries with user-provided keys is a footgun (`__proto__`, `constructor`). Use a `Map`, or `Object.create(null)`.

## Looping over objects

```js try
const prices = { apple: 2, pear: 3 };

const doubled = Object.fromEntries(
  Object.entries(prices).map(([name, price]) => [name, price * 2]),
);
console.log(doubled);
```

`Object.keys/values/entries` give your own, enumerable, string-keyed properties. `Object.entries` + `map` + `Object.fromEntries` is the go-to recipe for "transform every value". Key order is: integer-like keys ascending first, then other keys in the order they were added.

## Property flags (a short peek)

Each property has hidden flags: `writable`, `enumerable`, `configurable` (or `get`/`set` accessors). Class methods are non-enumerable, which is why `for…in` over an instance doesn't list them. `Object.defineProperty` is how libraries attach hidden data.

## Common mistakes

1. **Thinking `const b = a` copies** an object. It creates another name for the same one.
2. **Trusting `{ ...obj }` for nested data.** It is shallow.
3. **Mutating state** (`state.user.name = 'x'`) — React and memoized selectors can't see the change.
4. **`||` for defaults** when `0`/`''`/`false` are valid values (use `??`).
5. **JSON round-trip as a "deep clone"** on data with Dates, Maps, `undefined` or cycles.

## Quick check

```check
Q: After `const a = { n: 1 }; const b = a; b.n = 2;` what is `a.n`?
A) `1`
B) `undefined`
C) `2` *
D) It throws an error
Why: `b = a` copies the link, not the object, so `a` and `b` are two names for one object.
---
Q: What does `{ id: 1 } === { id: 1 }` give?
A) `false`, because they are two different objects *
B) `true`, because the contents are equal
C) It depends on the order of the keys
D) It throws an error
Why: `===` on objects checks identity. Each `{}` literal creates a new object.
---
Q: `const copy = { ...user }; copy.address.city = 'Paris';` — what happens to `user.address.city`?
A) It stays the same because `copy` is independent
B) It becomes `undefined`
C) It throws because `address` is frozen
D) It also becomes `'Paris'`, because the spread is shallow and `address` is shared *
Why: Spread copies the top-level properties. `address` is an object, so both `user` and `copy` hold the same reference.
---
Q: `const count = 0; count || 10` versus `count ?? 10`: what do they give?
A) 0 and 0
B) 10 and 0 *
C) 10 and 10
D) 0 and 10
Why: `||` replaces any falsy value (including 0). `??` replaces only `null` and `undefined`.
---
Q: Which statement about copying is true?
A) `JSON.parse(JSON.stringify(x))` preserves Dates as Dates
B) `structuredClone` can copy functions
C) `structuredClone` copies Dates, Maps, Sets and circular references *
D) The spread operator performs a deep copy
Why: `structuredClone` is the built-in deep copy for data. JSON turns Dates into strings and can't handle cycles, structuredClone can't clone functions, and spread is shallow.
```

## Recap

- **Primitives are copied, objects are shared.** `const b = a` for an object means two names, one object.
- `===` on objects compares **identity**, not contents.
- **Spread / `Object.assign`** = shallow copy. **`structuredClone`** = deep copy for data (no functions, loses prototypes). JSON round-trips are lossy.
- **Immutable update** = copy every object along the path, share the rest. Shared parts are what make `===`-based optimisations work.
- Use **`?.`** to stop at missing values and **`??`** (not `||`) for defaults.
- `Object.entries` → `map` → `Object.fromEntries` transforms objects; beware `__proto__`-style keys in dictionaries.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: update a nested value | "Changing nested data without mutating" (the stepper) |
| Destructuring drill | `?.` and `??` for safe reads and defaults |
| `pick` & `omit` | `Object.entries` / `fromEntries`, `Object.hasOwn` |
| `get` & `set` by path | Reading safely + the immutable path-copy idea |
| `deepEqual` | `===` vs contents; recursion; remembering what you've already seen (cycles) |
| `deepClone` | Shallow vs deep; `Map` for remembering already-cloned objects |
| Flatten & unflatten keys | Looping over objects; building nested structures |

%% exercise objects-guided-update | Guided: update a nested value | 1 | js | js | moveToCity | 6 | guided
Write `moveToCity(user, city)`. It returns a **new** user whose `address.city` is `city`. The original `user` must **not** be changed.

```js
const user = { name: 'Ada', address: { city: 'London', zip: 'N1' }, settings: { theme: 'dark' } };
const next = moveToCity(user, 'Paris');

next.address;   // { city: 'Paris', zip: 'N1' }
user.address;   // { city: 'London', zip: 'N1' }   ← untouched
next.settings === user.settings;  // true — not on the path, so it is shared
```

%% worked
**A similar problem, solved: `rename(state, name)`** — change `state.profile.name` without mutating.

```js
function rename(state, name) {
  return {
    ...state,                          // ① copy the top level (shares every other key)
    profile: {                         // ② replace `profile` with a NEW object…
      ...state.profile,                // ③ …that copies all the old profile fields…
      name,                            // ④ …then overwrites just the one we want (later keys win)
    },
  };
}
```

The rule: **one `...spread` per level on the path**. `state` is one level, `profile` is the next. Your exercise has the same shape with `user` and `user.address`.

%% explain
- **Changes the city** in the returned user and keeps the other address fields (`zip`).
- **Does not touch the original** — the tests compare it before and after.
- **New objects along the path**: `next !== user` and `next.address !== user.address`.
- **Shares everything off the path**: `next.settings === user.settings` (same reference, not a copy).

%% nudge
- How many levels of object are on the path from `user` down to `city`?
- Which spread copies the top level, and which copies the address?

%% starter
```js
export function moveToCity(user, city) {
  // Step 1 — return a NEW object that starts as a copy of user:   { ...user, ... }
  // Step 2 — replace `address` with a NEW object too:             address: { ...user.address, city }
  // Step 3 — don't touch anything else; other properties stay shared.
  return user;
}
```

%% tests
```js
describe('moveToCity', () => {
  const make = () => ({ name: 'Ada', address: { city: 'London', zip: 'N1' }, settings: { theme: 'dark' } });

  it('changes the city and keeps other fields', () => {
    const next = moveToCity(make(), 'Paris');
    expect(next).toEqual({ name: 'Ada', address: { city: 'Paris', zip: 'N1' }, settings: { theme: 'dark' } });
  });

  it('does not mutate the original', () => {
    const user = make();
    moveToCity(user, 'Paris');
    expect(user).toEqual(make());
  });

  it('creates new objects along the path', () => {
    const user = make();
    const next = moveToCity(user, 'Paris');
    expect(next).not.toBe(user);
    expect(next.address).not.toBe(user.address);
  });

  it('shares everything off the path', () => {
    const user = make();
    const next = moveToCity(user, 'Paris');
    expect(next.settings).toBe(user.settings);
  });
});
```

%% hints
- Return an object literal that begins with `...user`.
- Add `address: { ...user.address, city }` after it.

%% solution
```js
export function moveToCity(user, city) {
  return { ...user, address: { ...user.address, city } };
}
```

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

%% worked
**A similar problem, solved: `describeProduct`** — destructuring right in the parameter list, with defaults and a nested value.

```js
function describeProduct({ title, price = 0, dimensions }) {
  //                        ① pull out title and price; `= 0` is the default when price is missing
  const { width = 'n/a' } = dimensions ?? {};     // ② dimensions may be missing: `?? {}` gives destructuring something to read
  return `${title} - $${price} (${width})`;
}

describeProduct({ title: 'Mug', price: 8, dimensions: { width: 10 } }); // "Mug - $8 (10)"
describeProduct({ title: 'Pen' });                                       // "Pen - $0 (n/a)"
```

Two things to remember: a destructuring **default** (`= 0`) only applies when the value is `undefined` (missing), and you can't destructure `undefined` — so guard a possibly-missing nested object with `?? {}` or use optional chaining: `user.address?.city ?? 'unknown'`.

%% explain
- **Format**: `"<name> (<role>) — <city>"` (note the em dash).
- **`role` defaults** to `"member"` when missing.
- **`city`** comes from `user.address.city`; a missing address *or* a missing city gives `"unknown"`.
- **Extra properties are ignored**, and the input is not changed.

%% nudge
- What happens if you destructure `address: { city }` and `address` is missing?
- Which gives a default only for `undefined`: `=` in destructuring, `||`, or `??`?

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

%% worked
**A similar problem, solved: `mapValues(obj, fn)`** — same keys, transformed values. It shows the `entries → map → fromEntries` recipe.

```js
function mapValues(obj, fn) {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, fn(value, key)]),
  );
}
```

`pick` is the same recipe with a **filter**: keep only entries whose key is in the list — but the tests also want "own properties only", so use `Object.hasOwn(obj, key)` rather than `key in obj`. `omit` keeps the entries whose key is *not* in the list.

One catch: `Object.entries` ignores **symbol keys**, but `omit` must preserve them. Use `Reflect.ownKeys(obj)` (strings *and* symbols) and filter those that are enumerable, or copy with spread (`{ ...obj }` keeps own enumerable symbols) and then `delete` the unwanted keys from the **copy**.

%% explain
- **`pick`** returns only the listed keys that exist as **own** properties.
- **`omit`** returns everything except the listed keys, including symbol keys.
- **Inputs are not mutated**; values are copied by reference (shallow).

%% nudge
- Does `'toString' in obj` mean the same as `Object.hasOwn(obj, 'toString')`?
- Which method lists symbol keys too?

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

%% worked
**A similar problem, solved: `getIn(obj, keys)`** — walk down an array of keys, stopping safely at missing values.

```js
function getIn(obj, keys) {
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;   // ① can't go deeper: null/undefined stops the walk
    current = current[key];                    // ② step one level down
  }
  return current;
}
```

`get` adds two jobs: **turn a string path into keys** (`'a.b[0].c'` → `['a','b','0','c']`; a regex like `/[^.[\]]+/g` pulls out the pieces) and **apply the default only when the final value is `undefined`** (so `0`, `''`, `false` and `null` are real values).

`set` returns a new object, so it is recursive "copy one level, recurse into the next":

```js
function setIn(obj, [key, ...rest], value) {
  if (rest.length === 0) return { ...obj, [key]: value };         // last key: set it
  return { ...obj, [key]: setIn(obj?.[key] ?? {}, rest, value) }; // otherwise copy this level and recurse
}
```

Extra rules for the exercise: copy **arrays as arrays** (`[...arr]`) and create a missing intermediate as an **array** when the next key is a non-negative integer, otherwise an object.

%% explain
- **`get`** accepts `'a.b[0].c'` or `['a','b',0,'c']`; returns the default only for `undefined` (not for `null`, `0`, `''`, `false`).
- **`set`** returns a **new** object; the input is unchanged.
- **Only the path is copied**: sibling objects keep their identity.
- **Missing intermediates** become arrays for integer keys, otherwise objects.

%% nudge
- How do you turn `'a.b[0].c'` into a list of keys?
- In `set`, what should you copy at each level, and what should you leave alone?

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

%% worked
**A similar problem, solved: `sameShape(a, b)`** — compare two plain values recursively (no special types). It shows the recursion pattern for `deepEqual`.

```js
function sameShape(a, b) {
  if (a === b) return true;                                   // ① same value (or same reference): done
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;   // ② different primitives / null
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;                   // ③ different number of keys
  return ka.every((k) => Object.hasOwn(b, k) && sameShape(a[k], b[k]));   // ④ same keys, equal values
}
```

For `deepEqual` add: `Object.is` for primitives (so `NaN` equals `NaN`) but treat `+0` and `-0` as equal; arrays only equal arrays; `Date`s by `getTime()`; `RegExp`s by `source` + `flags`. And **cycles**: pass along a `WeakMap`/`Set` of pairs you are *currently comparing*. If you meet a pair again, assume they're equal (you're already checking them) instead of recursing forever.

%% explain
- **Primitives** use `Object.is` (so `NaN` equals `NaN`), except `+0` equals `-0`.
- **Arrays** need the same length and pairwise-equal items; an array never equals a plain object.
- **Plain objects** need the same own keys with equal values, in any order; `{a: undefined}` does **not** equal `{}`.
- **`Date`** by time, **`RegExp`** by source and flags.
- **Circular structures** must terminate.

%% nudge
- How can you tell `{ a: undefined }` from `{}`? (Count keys, don't just read values.)
- If `a` contains itself, what do you need to remember to stop the recursion?

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

%% worked
**A similar problem, solved: `cloneTree(node, seen = new Map())`** — a tiny clone that handles **cycles** by remembering what it has already cloned. That memory is the trick for `deepClone`.

```js
function cloneTree(node, seen = new Map()) {
  if (typeof node !== 'object' || node === null) return node;   // ① primitives are returned as-is
  if (seen.has(node)) return seen.get(node);                    // ② already cloned? reuse that clone (cycles + shared refs)
  const copy = Array.isArray(node) ? [] : {};
  seen.set(node, copy);                                         // ③ register the clone BEFORE recursing into children
  for (const key of Object.keys(node)) copy[key] = cloneTree(node[key], seen);
  return copy;
}
```

Step ③ is the important one: register first, recurse second. Then a child that points back at the parent finds the half-built clone in `seen` and uses it, so `clone.self === clone` works.

Extra work for the exercise: branches for `Date` (`new Date(+d)`), `RegExp` (`new RegExp(r.source, r.flags)`), `Map` and `Set` (clone keys/members too), functions returned as-is, symbol keys (`Reflect.ownKeys`, enumerable only) and prototypes: create the copy with `Object.create(Object.getPrototypeOf(node))`.

%% explain
- **Primitives and functions** come back as they are.
- **Objects and arrays** are cloned recursively, including symbol keys.
- **`Date`, `RegExp`, `Map`, `Set`** are cloned (Map keys and Set members too).
- **Class instances keep their prototype.**
- **Cycles and shared references are preserved**: `clone.self === clone`; two properties that pointed at one object point at one clone.

%% nudge
- When must you record a new clone in the "seen" map — before or after cloning its children? Why?
- What keeps a class instance an instance of its class?

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

%% worked
**A similar problem, solved: `keysOf(obj, prefix = '')`** — list every leaf path of a nested object.

```js
function keysOf(obj, prefix = '') {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;           // ① build "a.b" from the parent path and this key
    if (value && typeof value === 'object') {
      out.push(...keysOf(value, path));                       // ② an object/array: go deeper
    } else {
      out.push(path);                                         // ③ a plain value: this path is a leaf
    }
  }
  return out;
}
```

`flattenObject` is the same walk but stores `result[path] = value`. Two rules to get right: **arrays use their index** as the key (`Object.entries` already does that), and **empty objects/arrays are leaves** (otherwise `{ a: {} }` would lose `a`).

`unflattenObject` goes backwards: split each key on `.`; walk down creating containers as you go. A container is an **array if the next segment is a whole number**, otherwise an object; the last segment receives the value.

%% explain
- **Flatten**: nested data becomes a flat map of dot-separated paths; arrays flatten by index.
- **Empty objects/arrays stay as values** so nothing is lost.
- **Unflatten** is the inverse: numeric segments create arrays, others create objects.
- **Round-trip**: `unflattenObject(flattenObject(x))` equals `x`.

%% nudge
- What should you store when a value is an *empty* object?
- When unflattening `'a.0'`, how do you know to create an array for `a`?

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
