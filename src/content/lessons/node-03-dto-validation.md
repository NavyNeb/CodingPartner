---
id: node-dto-validation
track: node
title: DTOs, validation and serialization
summary: How a backend turns untrusted request data into a trusted object (whitelist, coerce, validate), how it shapes what leaves (serialization by audience), and how it parses pagination safely.
---

## The idea in one sentence

Everything that crosses the network is **untrusted text**; a **DTO** (data transfer object) is the **checked, typed shape** you accept on the way in, and a **serializer** is the **audience-aware shape** you send on the way out.

> **Analogy** An airport. Security (validation) checks every bag against the rules, removes anything not on the allowed list (whitelisting), and weighs it. On arrival, customs (serialization) decides what each passenger is allowed to carry out of the building.

*(In NestJS this is a DTO class with validation decorators and a `ValidationPipe` using `whitelist` and `transform`, and response shaping with `class-transformer` through an interceptor. Here you build the rules as plain functions.)*

## Four steps in

![Input pipeline](fig:nd-dto "Whitelist, coerce, validate, then the handler gets a DTO or the client gets a 400.")

| Step | What it does | Why |
| --- | --- | --- |
| **Whitelist** | Keep only the fields you declared | Stops **mass assignment**: `{"role":"admin"}` never reaches your code |
| **Coerce** | Turn `"5"` into `5`, `"true"` into `true` *where allowed* | Query strings and forms are all text |
| **Validate** | Check type, range, length, pattern, allowed values | Reject bad data at the door, not in the database |
| **Report** | Collect **every** error with its **path** | The client can fix the whole form in one round trip |

```js try predict
const body = JSON.parse('{"name":"Ada","age":"36","role":"admin"}');
const allowed = ['name', 'age'];

const dto = {};
for (const key of allowed) {
  if (Object.prototype.hasOwnProperty.call(body, key)) dto[key] = body[key];
}
dto.age = Number(dto.age);

console.log(dto, typeof dto.age, 'role' in dto);
```

Notice what the code does **not** do: it never loops over `body`'s keys. It loops over **its own allow-list**. That one decision is what makes it safe.

```stepper Validating one bad request
code:
  body = { name: "A", age: "abc", role: "admin", tags: ["ok", ""] }
  1 whitelist   → { name, age, tags }            (role dropped)
  2 coerce      → age "abc" stays "abc"           (not a number)
  3 validate    → name too short
  3 validate    → age must be a number
  3 validate    → tags[1] must be at least 1
  report        → 400 with 3 errors, handler never runs
---
line: 1
say: The client sent an extra `role` field. It is not in the schema, so it is **not allowed through**, whatever the client claims.
phase: whitelist
---
line: 2
say: `"abc"` cannot become a number, so coercion leaves it alone and **validation will complain** that `age` must be a number.
phase: coerce
---
line: 3
say: `name` is `"A"` but the rule says at least 2 characters: error at path `name`.
phase: validate
---
line: 4
say: `age` is still a string: error at path `age`.
phase: validate
---
line: 5
say: Arrays are checked item by item. The error path is `tags[1]`, so the client knows **which element** is wrong.
phase: validate
---
line: 6
say: Because **all** errors are collected, the response lists three problems at once and the handler is never called.
phase: report
```

## Rules as data

A good validator is **driven by a schema**, a plain object describing each field. The same schema can validate, document and generate types.

```js
const schema = {
  name: { type: 'string', min: 2, max: 40 },
  age:  { type: 'number', min: 0, coerce: true },
  role: { type: 'string', oneOf: ['user', 'admin'], default: 'user' },
  tags: { type: 'array', items: { type: 'string', min: 1 }, required: false },
};
```

Fields are **required by default**; say `required: false` when they are optional. `default` fills in a missing value. Nested objects use `properties`, arrays use `items`, and error paths look like `address.city` and `tags[1]`.

## Serialize what goes out

![Serialization by audience](fig:nd-serialize "The password hash never leaves; the email depends on who is asking.")

The database entity has everything, including things nobody should see. **Never return it directly.** A serializer applies two kinds of rule:

- **Exclude**: fields that are never sent (`passwordHash`, internal flags), **at every depth**, so a nested `author.passwordHash` is removed too.
- **Groups**: fields sent only to some audiences (`email` for `admin` or the user themselves).
- **Expose**: computed fields (`displayName`) that exist only in the response.

Do it in **one place** (an interceptor, a base serializer) so a **new column is private by default** rather than public by accident.

## Paginate safely

![Offset pagination](fig:nd-pagination "page and limit become an offset; always clamp them and return metadata.")

`?page=3&limit=4` becomes `offset = (page - 1) * limit`. Treat the numbers as hostile: `page=-5`, `limit=1000000`, `limit=abc`. Clamp, default, and **only sort by an allow-list** of fields: a raw `?sort=` dropped into a query is an injection.

## Quick check

```check
Q: Why validate by looping over your own allow-list rather than the request's keys?
A) It is faster
B) Unknown keys, like "role", can never sneak through *
C) JSON requires it
D) It lets the client choose the order
Why: Mass assignment happens when you copy whatever the client sent.
---
Q: Why report all validation errors instead of stopping at the first?
A) It is easier to implement
B) The client can fix everything in one round trip *
C) The server logs less
D) The status code changes
Why: One error at a time makes forms painful.
---
Q: Where should the password hash be removed from responses?
A) In every handler, by hand
B) In one serializer or interceptor, applied everywhere *
C) In the database
D) In the browser
Why: A single choke point makes new fields private by default.
---
Q: A client sends limit=999999. What should happen?
A) Return a million rows
B) Clamp it to the maximum *
C) Crash
D) Use it as the offset
Why: Pagination limits protect the database and memory.
```

## Recap

- **Whitelist** from your own list, **coerce** where allowed, **validate** every rule, **report all** errors with paths.
- A **schema as data** drives the validator; `required` by default, `default`, `min`, `max`, `pattern`, `oneOf`, `items`, `properties`.
- **Serialize** per audience: **exclude** at every depth, **groups** for conditional fields, **expose** computed ones.
- **Pagination input is hostile**: clamp, default, allow-list the sort field, return metadata.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: whitelist | Looping an allow-list and `hasOwnProperty` |
| Rule-based validator | Recursion over objects and arrays, error paths, coercion, defaults |
| Response serializer | Recursive copy with exclusion, groups and computed fields |
| Pagination | Strict parsing, clamping, an allow-listed sort, page metadata |
| Tests for a validator | Boundary values, error paths and one case per rule |

%% exercise nod-guided-whitelist | Guided: whitelist a body | 1 | js | js | whitelist | 8 | guided
Implement `whitelist(input, allowed)`: return a **new object** containing only the keys in `allowed` that the input **owns**. Missing keys are skipped (not set to `undefined`), inherited keys and everything else are ignored, and the input is not changed.

```js
whitelist({ name: 'Ada', role: 'admin' }, ['name', 'age']); // { name: 'Ada' }
```

%% worked
**A similar problem, solved: `omit(obj, keys)`** — copy everything *except* some keys.

```js
function omit(obj, keys) {
  const out = {};
  for (const key of Object.keys(obj)) {          // ① only OWN enumerable keys
    if (!keys.includes(key)) out[key] = obj[key];
  }
  return out;
}
```

`omit` loops the **input's** keys, which is the dangerous direction for untrusted data (a deny-list always misses something). Your `whitelist` flips it: loop **your list** and ask the input for each key.

%% explain
- **Loop the allow-list**, not the input.
- **Own keys only**: `Object.prototype.hasOwnProperty.call(input, key)`.
- **Skip missing keys** and return a new object.

%% nudge
- Which list do you loop over?
- How do you tell "has this key" apart from "inherited it"?

%% starter
```js
export function whitelist(input, allowed) {
  const out = {};
  return out;
}
```

%% tests
```js
describe('whitelist', () => {
  it('keeps only allowed keys', () => {
    expect(whitelist({ name: 'Ada', role: 'admin' }, ['name'])).toEqual({ name: 'Ada' });
  });
  it('skips missing keys', () => {
    const out = whitelist({ name: 'Ada' }, ['name', 'age']);
    expect(out).toEqual({ name: 'Ada' });
    expect('age' in out).toBe(false);
  });
  it('keeps falsy values that are present', () => {
    expect(whitelist({ a: 0, b: '', c: false, d: null }, ['a', 'b', 'c', 'd'])).toEqual({ a: 0, b: '', c: false, d: null });
  });
  it('ignores inherited keys', () => {
    const input = Object.create({ role: 'admin' });
    input.name = 'Ada';
    expect(whitelist(input, ['name', 'role'])).toEqual({ name: 'Ada' });
  });
  it('does not change the input and returns a new object', () => {
    const input = { a: 1, b: 2 };
    const out = whitelist(input, ['a']);
    expect(input).toEqual({ a: 1, b: 2 });
    expect(out).not.toBe(input);
  });
  it('handles an empty allow-list', () => {
    expect(whitelist({ a: 1 }, [])).toEqual({});
  });
});
```

%% hints
- `for (const key of allowed) { ... }`
- `if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];`

%% solution
```js
export function whitelist(input, allowed) {
  const out = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(input, key)) out[key] = input[key];
  }
  return out;
}
```

%% exercise nod-validator | A rule-based validator | 4 | js | js | createValidator | 45
`createValidator(schema, { forbidUnknown = false } = {})` returns `{ validate(input) }` giving `{ ok, value, errors }`.

`schema` maps field names to rules `{ type, required, default, coerce, min, max, pattern, oneOf, items, properties }`:

- `type`: `'string' | 'number' | 'boolean' | 'array' | 'object'`. A number must be finite.
- **Missing** means `undefined` or `null`. A missing field uses `default` if there is one; else if `required === false` it is simply left out; else the error `is required`.
- `coerce: true` turns a numeric string (non-blank, finite) into a number for `type: 'number'`, and `'true'` / `'false'` into booleans for `type: 'boolean'`. Without `coerce`, strings are **not** converted.
- A wrong type gives `must be a string` / `a number` / `a boolean` / `an array` / `an object`.
- Then at most **one** of these for the field, first match wins: `min` → `must be at least N`, `max` → `must be at most N`, `pattern` (strings) → `is invalid`, `oneOf` → `must be one of: a, b`. `min` and `max` compare the **length** of strings and arrays and the **value** of numbers, **inclusively**.
- `items` (a rule) is checked for every array element, with paths like `tags[1]`. `properties` (a schema) is checked for nested objects, with paths like `address.city`.
- **All** errors are collected as `{ path, message }`, in schema order. Unknown keys are **dropped** from `value`; with `forbidUnknown` each also adds `{ path, message: 'is not allowed' }`.
- `value` holds the coerced, whitelisted result when `ok`, otherwise `undefined`. A non-object input gives `ok: false` and one error `{ path: '', message: 'must be an object' }`. The input is never changed.

```js
const v = createValidator({ age: { type: 'number', coerce: true, min: 18 } });
v.validate({ age: '30', role: 'admin' }); // { ok: true, value: { age: 30 }, errors: [] }
v.validate({ age: 3 });                   // { ok: false, value: undefined, errors: [{ path: 'age', message: 'must be at least 18' }] }
```

%% worked
**A similar problem, solved: `checkRecord(rules, record)`** — recurse into nested records and build a dotted path.

```js
function checkRecord(rules, record, path = '') {
  const errors = [];
  for (const [key, type] of Object.entries(rules)) {
    const here = path ? path + '.' + key : key;            // ① build the path as you descend
    const value = record[key];
    if (typeof type === 'object') {
      errors.push(...checkRecord(type, value ?? {}, here)); // ② recurse into the nested rules
    } else if (typeof value !== type) {
      errors.push({ path: here, message: 'must be a ' + type });
    }                                                       // ③ keep going: never return at the first error
  }
  return errors;
}
```

Your validator is this function plus **more rules per field** and **arrays** (path `tags[1]` instead of `tags.1`). Split it in two helpers that call each other: one for a **value** and one for an **object**.

%% explain
- **checkValue(rule, raw, path, errors)** handles missing, coerce, type, one constraint, then recurses.
- **checkObject(schema, obj, path, errors)** loops the schema, joins paths, and handles unknown keys.
- **Return a cleaned value** and push errors into one shared array.

%% nudge
- What is the first thing you check for a field, before its type?
- How does an array item path differ from an object key path?
- Which function calls which when the schema has nested objects?

%% starter
```js
export function createValidator(schema, { forbidUnknown = false } = {}) {
  return {
    validate(input) {
      return { ok: true, value: input, errors: [] };
    },
  };
}
```

%% tests
```js
describe('createValidator', () => {
  const schema = {
    name: { type: 'string', min: 2, max: 5 },
    age: { type: 'number', min: 18, max: 65, coerce: true },
    role: { type: 'string', oneOf: ['user', 'admin'], default: 'user' },
    nick: { type: 'string', required: false, pattern: /^[a-z]+$/ },
    tags: { type: 'array', items: { type: 'string', min: 1 }, required: false },
    address: { type: 'object', required: false, properties: { city: { type: 'string' } } },
    active: { type: 'boolean', required: false, coerce: true },
  };
  const v = createValidator(schema);

  it('returns a cleaned value: whitelisted, coerced, defaulted', () => {
    const input = { name: 'Ada', age: '30', extra: 'x', tags: ['a'], address: { city: 'Oslo', zip: 1 } };
    const copy = JSON.parse(JSON.stringify(input));
    expect(v.validate(input)).toEqual({
      ok: true,
      value: { name: 'Ada', age: 30, role: 'user', tags: ['a'], address: { city: 'Oslo' } },
      errors: [],
    });
    expect(input).toEqual(copy);
  });
  it('reports required fields', () => {
    const res = v.validate({ age: 30 });
    expect(res.ok).toBe(false);
    expect(res.value).toBeUndefined();
    expect(res.errors).toEqual([{ path: 'name', message: 'is required' }]);
  });
  it('treats null as missing and allows optional fields to be absent', () => {
    expect(v.validate({ name: 'Ada', age: 30, nick: null }).ok).toBe(true);
    expect(v.validate({ name: null, age: 30 }).errors).toEqual([{ path: 'name', message: 'is required' }]);
  });
  it('checks min and max inclusively', () => {
    expect(v.validate({ name: 'Ad', age: 18 }).ok).toBe(true);
    expect(v.validate({ name: 'Adaaa', age: 65 }).ok).toBe(true);
    expect(v.validate({ name: 'A', age: 30 }).errors).toEqual([{ path: 'name', message: 'must be at least 2' }]);
    expect(v.validate({ name: 'Adaaaa', age: 30 }).errors).toEqual([{ path: 'name', message: 'must be at most 5' }]);
    expect(v.validate({ name: 'Ada', age: 17 }).errors).toEqual([{ path: 'age', message: 'must be at least 18' }]);
    expect(v.validate({ name: 'Ada', age: 66 }).errors).toEqual([{ path: 'age', message: 'must be at most 65' }]);
  });
  it('checks types with readable messages', () => {
    const res = v.validate({ name: 1, age: 'abc', tags: 'x', address: 5, active: 'maybe' });
    expect(res.errors).toEqual([
      { path: 'name', message: 'must be a string' },
      { path: 'age', message: 'must be a number' },
      { path: 'tags', message: 'must be an array' },
      { path: 'address', message: 'must be an object' },
      { path: 'active', message: 'must be a boolean' },
    ]);
  });
  it('only coerces when asked', () => {
    const strict = createValidator({ n: { type: 'number' }, b: { type: 'boolean' } });
    expect(strict.validate({ n: '5', b: 'true' }).errors).toEqual([
      { path: 'n', message: 'must be a number' },
      { path: 'b', message: 'must be a boolean' },
    ]);
    expect(v.validate({ name: 'Ada', age: 30, active: 'false' }).value.active).toBe(false);
    expect(v.validate({ name: 'Ada', age: ' ' }).errors[0].message).toBe('must be a number');
  });
  it('does not accept NaN or Infinity as numbers', () => {
    const n = createValidator({ n: { type: 'number' } });
    expect(n.validate({ n: NaN }).ok).toBe(false);
    expect(n.validate({ n: Infinity }).ok).toBe(false);
  });
  it('checks pattern and oneOf', () => {
    expect(v.validate({ name: 'Ada', age: 30, nick: 'ABC' }).errors).toEqual([{ path: 'nick', message: 'is invalid' }]);
    expect(v.validate({ name: 'Ada', age: 30, role: 'root' }).errors).toEqual([{ path: 'role', message: 'must be one of: user, admin' }]);
    expect(v.validate({ name: 'Ada', age: 30, role: 'admin', nick: 'ok' }).ok).toBe(true);
  });
  it('collects every error in schema order', () => {
    const res = v.validate({ name: 'A', age: 'abc', role: 'root' });
    expect(res.errors.map((e) => e.path)).toEqual(['name', 'age', 'role']);
  });
  it('checks array items with indexed paths', () => {
    const res = v.validate({ name: 'Ada', age: 30, tags: ['ok', '', 5] });
    expect(res.errors).toEqual([
      { path: 'tags[1]', message: 'must be at least 1' },
      { path: 'tags[2]', message: 'must be a string' },
    ]);
  });
  it('checks nested objects with dotted paths', () => {
    expect(v.validate({ name: 'Ada', age: 30, address: { city: 5 } }).errors).toEqual([{ path: 'address.city', message: 'must be a string' }]);
    expect(v.validate({ name: 'Ada', age: 30, address: {} }).errors).toEqual([{ path: 'address.city', message: 'is required' }]);
  });
  it('can forbid unknown keys', () => {
    const strict = createValidator({ a: { type: 'number' } }, { forbidUnknown: true });
    expect(strict.validate({ a: 1, b: 2 }).errors).toEqual([{ path: 'b', message: 'is not allowed' }]);
    expect(strict.validate({ a: 1 }).ok).toBe(true);
  });
  it('rejects non-object input', () => {
    for (const bad of [null, undefined, 5, 'x', [1]]) {
      expect(v.validate(bad)).toEqual({ ok: false, value: undefined, errors: [{ path: '', message: 'must be an object' }] });
    }
  });
  it('can be reused for many inputs', () => {
    expect(v.validate({ name: 'Ada', age: 30 }).ok).toBe(true);
    expect(v.validate({ name: 'A', age: 30 }).ok).toBe(false);
    expect(v.validate({ name: 'Bob', age: 40 }).ok).toBe(true);
  });
});
```

%% hints
- `checkValue` first handles `undefined`/`null`: default, optional, or `is required`.
- Coerce next, then the type table, then the *first* failing constraint.
- Arrays: `value.map((item, i) => checkValue(rule.items, item, path + '[' + i + ']', errors))`.
- Objects: `checkObject(rule.properties, value, path, errors)`; join paths with `path ? path + '.' + key : key`.
- Top-level input must be a plain object (not null, not an array).

%% solution
```js
export function createValidator(schema, { forbidUnknown = false } = {}) {
  const NAMES = { string: 'a string', number: 'a number', boolean: 'a boolean', array: 'an array', object: 'an object' };
  const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
  const join = (path, key) => (path ? path + '.' + key : key);

  function checkValue(rule, raw, path, errors) {
    if (raw === undefined || raw === null) {
      if (rule.default !== undefined) return rule.default;
      if (rule.required === false) return undefined;
      errors.push({ path, message: 'is required' });
      return undefined;
    }
    let v = raw;
    if (rule.coerce) {
      if (rule.type === 'number' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
      if (rule.type === 'boolean' && (v === 'true' || v === 'false')) v = v === 'true';
    }
    const typeOk = {
      string: typeof v === 'string',
      number: typeof v === 'number' && Number.isFinite(v),
      boolean: typeof v === 'boolean',
      array: Array.isArray(v),
      object: isObject(v),
    }[rule.type];
    if (!typeOk) {
      errors.push({ path, message: 'must be ' + NAMES[rule.type] });
      return undefined;
    }
    const sized = rule.type === 'string' || rule.type === 'number' || rule.type === 'array';
    const size = typeof v === 'number' ? v : v.length;
    let message;
    if (sized && rule.min !== undefined && size < rule.min) message = 'must be at least ' + rule.min;
    else if (sized && rule.max !== undefined && size > rule.max) message = 'must be at most ' + rule.max;
    else if (rule.type === 'string' && rule.pattern && !rule.pattern.test(v)) message = 'is invalid';
    else if (rule.oneOf && !rule.oneOf.includes(v)) message = 'must be one of: ' + rule.oneOf.join(', ');
    if (message) errors.push({ path, message });

    if (rule.type === 'array' && rule.items) {
      return v.map((item, i) => checkValue(rule.items, item, path + '[' + i + ']', errors));
    }
    if (rule.type === 'object' && rule.properties) {
      return checkObject(rule.properties, v, path, errors);
    }
    return v;
  }

  function checkObject(sch, obj, path, errors) {
    const out = {};
    for (const [key, rule] of Object.entries(sch)) {
      const result = checkValue(rule, obj[key], join(path, key), errors);
      if (result !== undefined) out[key] = result;
    }
    if (forbidUnknown) {
      for (const key of Object.keys(obj)) {
        if (!(key in sch)) errors.push({ path: join(path, key), message: 'is not allowed' });
      }
    }
    return out;
  }

  return {
    validate(input) {
      if (!isObject(input)) return { ok: false, value: undefined, errors: [{ path: '', message: 'must be an object' }] };
      const errors = [];
      const value = checkObject(schema, input, '', errors);
      const ok = errors.length === 0;
      return { ok, value: ok ? value : undefined, errors };
    },
  };
}
```

%% exercise nod-serializer | A response serializer | 3 | js | js | createSerializer | 30
`createSerializer({ exclude = [], expose = {}, groups = {} } = {})` returns `{ serialize(value, { groups: active = [] } = {}) }` that builds a **safe copy** of an entity for a response:

- Arrays are serialized element by element; primitives, `null` and non-plain objects (like `Date`) are returned **unchanged**.
- Keys in `exclude` are removed **at every depth** (nested objects and arrays too).
- A key listed in `groups` (`{ email: ['admin', 'self'] }`) is kept only if the active groups include **at least one** of its groups, at every depth.
- `expose` maps new field names to functions that receive the **original top-level entity** (so they may read excluded fields); they are added to the top-level object only (and to each top-level array element), **not** to nested objects.
- The input is never mutated.

```js
const s = createSerializer({ exclude: ['passwordHash'], groups: { email: ['admin'] } });
s.serialize({ id: 1, email: 'a@x.io', passwordHash: 'h' });                       // { id: 1 }
s.serialize({ id: 1, email: 'a@x.io', passwordHash: 'h' }, { groups: ['admin'] }); // { id: 1, email: 'a@x.io' }
```

%% worked
**A similar problem, solved: `redact(value, secretKeys)`** — a recursive copy that drops keys at every depth.

```js
function redact(value, secretKeys) {
  if (Array.isArray(value)) return value.map((item) => redact(item, secretKeys));    // ① arrays: recurse per element
  if (value === null || typeof value !== 'object') return value;                      // ② primitives: unchanged
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    if (secretKeys.includes(key)) continue;                                           // ③ drop at THIS level
    out[key] = redact(inner, secretKeys);                                             // ④ and recurse for the rest
  }
  return out;
}
```

Your serializer adds three things: only **plain** objects are copied (a `Date` must survive), **groups** decide per key, and **expose** adds computed fields **once**, at the top, using the original entity.

%% explain
- **Plain objects only**: prototype is `Object.prototype` or `null`.
- **Exclude and groups** apply at every depth; **expose** only at the top.
- **Never mutate**: build a new object.

%% nudge
- How do you tell a plain object from a `Date`?
- When in the recursion do you know you are at the top level?

%% starter
```js
export function createSerializer({ exclude = [], expose = {}, groups = {} } = {}) {
  return {
    serialize(value, { groups: active = [] } = {}) {
      return value;
    },
  };
}
```

%% tests
```js
describe('createSerializer', () => {
  const make = () => ({
    id: 1,
    name: 'Ada',
    email: 'a@x.io',
    passwordHash: 'h',
    createdAt: new Date(0),
    profile: { bio: 'hi', passwordHash: 'h2', email: 'p@x.io' },
    posts: [{ id: 1, title: 't', passwordHash: 'z' }],
  });
  const s = createSerializer({
    exclude: ['passwordHash'],
    groups: { email: ['admin', 'self'] },
    expose: { displayName: (u) => u.name.toUpperCase(), hasPassword: (u) => Boolean(u.passwordHash) },
  });

  it('excludes keys at every depth', () => {
    const out = s.serialize(make());
    expect(JSON.stringify(out)).not.toContain('passwordHash');
    expect(out.profile.bio).toBe('hi');
    expect(out.posts[0]).toEqual({ id: 1, title: 't' });
  });
  it('hides grouped fields unless a matching group is active, at every depth', () => {
    const none = s.serialize(make());
    expect('email' in none).toBe(false);
    expect('email' in none.profile).toBe(false);
    expect(s.serialize(make(), { groups: ['other'] }).email).toBeUndefined();
    expect(s.serialize(make(), { groups: ['admin'] }).email).toBe('a@x.io');
    expect(s.serialize(make(), { groups: ['x', 'self'] }).profile.email).toBe('p@x.io');
  });
  it('adds exposed fields at the top level only, computed from the original', () => {
    const out = s.serialize(make());
    expect(out.displayName).toBe('ADA');
    expect(out.hasPassword).toBe(true);
    expect('displayName' in out.profile).toBe(false);
    expect('displayName' in out.posts[0]).toBe(false);
  });
  it('serializes arrays element by element', () => {
    const out = s.serialize([make(), make()], { groups: ['admin'] });
    expect(out).toHaveLength(2);
    expect(out[1].displayName).toBe('ADA');
    expect(out[1].email).toBe('a@x.io');
    expect('passwordHash' in out[0]).toBe(false);
  });
  it('keeps non-plain objects and primitives as they are', () => {
    const out = s.serialize(make());
    expect(out.createdAt).toBeInstanceOf(Date);
    expect(out.createdAt.getTime()).toBe(0);
    expect(s.serialize(5)).toBe(5);
    expect(s.serialize(null)).toBeNull();
    expect(s.serialize('x')).toBe('x');
  });
  it('does not change the input', () => {
    const input = make();
    const copy = make();
    s.serialize(input, { groups: ['admin'] });
    expect(input).toEqual(copy);
  });
  it('works with no options at all', () => {
    expect(createSerializer().serialize({ a: 1, b: [{ c: 2 }] })).toEqual({ a: 1, b: [{ c: 2 }] });
  });
});
```

%% hints
- Write `walk(value, top)`; arrays call `walk(item, top)` so each element counts as top.
- Plain check: `const proto = Object.getPrototypeOf(v); proto === Object.prototype || proto === null`.
- For each entry: skip if in `exclude`; skip if `k in groups` and no active group matches; else `out[k] = walk(val, false)`.
- After the loop, if `top`, add `out[name] = fn(original)` for each `expose`.

%% solution
```js
export function createSerializer({ exclude = [], expose = {}, groups = {} } = {}) {
  const isPlain = (v) => {
    if (typeof v !== 'object' || v === null) return false;
    const proto = Object.getPrototypeOf(v);
    return proto === Object.prototype || proto === null;
  };
  return {
    serialize(value, { groups: active = [] } = {}) {
      const walk = (v, top) => {
        if (Array.isArray(v)) return v.map((item) => walk(item, top));
        if (!isPlain(v)) return v;
        const out = {};
        for (const [key, inner] of Object.entries(v)) {
          if (exclude.includes(key)) continue;
          if (Object.prototype.hasOwnProperty.call(groups, key) && !groups[key].some((g) => active.includes(g))) continue;
          out[key] = walk(inner, false);
        }
        if (top) {
          for (const [name, fn] of Object.entries(expose)) out[name] = fn(v);
        }
        return out;
      };
      return walk(value, true);
    },
  };
}
```

%% exercise nod-pagination | Safe pagination | 3 | js | js | parsePagination, pageMeta | 26
Two helpers for list endpoints.

`parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100, sortable = [], defaultSort = '-createdAt' } = {})` returns `{ page, limit, offset, sort: { field, dir } }`:

- `page` and `limit` are accepted only when the value (a string or a number) is a **non-negative integer written with digits only** (`/^\d+$/`). Anything else (`'abc'`, `'-5'`, `'2.5'`, an array from `?page=1&page=2`, missing) uses the default (`1` and `defaultLimit`).
- `page` is then at least `1`; `limit` is clamped between `1` and `maxLimit`. `offset = (page - 1) * limit`.
- `sort` is a field name, with a leading `-` meaning descending (`'-price'` → `{ field: 'price', dir: 'desc' }`, `'name'` → `asc`). A field that is **not in `sortable`** falls back to `defaultSort`, parsed the same way. `defaultSort` itself is always trusted.

`pageMeta(total, { page, limit })` returns `{ page, limit, total, totalPages, hasNext, hasPrev }` where `totalPages = Math.ceil(total / limit)`, `hasNext = page < totalPages` and `hasPrev = page > 1`.

```js
parsePagination({ page: '3', limit: '4', sort: '-price' }, { sortable: ['price'] });
// { page: 3, limit: 4, offset: 8, sort: { field: 'price', dir: 'desc' } }
```

%% worked
**A similar problem, solved: `parseRating(value)`** — strict parsing with a clamp and a fallback.

```js
function parseRating(value, fallback = 3) {
  const text = String(value ?? '');
  if (!/^\d+$/.test(text)) return fallback;          // ① digits only, else the default
  return Math.min(5, Math.max(1, Number(text)));     // ② then clamp into range
}
```

`parseInt('10abc')` happily returns `10`, which is exactly the kind of leniency that lets odd input through. A **regex first, then Number** is stricter and clearer.

%% explain
- **Strict integer parse**, then **clamp**, fallback to defaults.
- **Sort allow-list** with a trusted default; `-` means descending.
- **Metadata** is plain arithmetic.

%% nudge
- Which inputs should fall back to the default instead of being clamped?
- Where does the sort direction come from?

%% starter
```js
export function parsePagination(query = {}, options = {}) {
  return { page: 1, limit: 20, offset: 0, sort: { field: 'createdAt', dir: 'desc' } };
}

export function pageMeta(total, { page, limit }) {
  return { page, limit, total, totalPages: 0, hasNext: false, hasPrev: false };
}
```

%% tests
```js
describe('parsePagination', () => {
  const opts = { sortable: ['price', 'name'] };
  it('uses defaults for an empty query', () => {
    expect(parsePagination({}, opts)).toEqual({ page: 1, limit: 20, offset: 0, sort: { field: 'createdAt', dir: 'desc' } });
    expect(parsePagination(undefined)).toEqual({ page: 1, limit: 20, offset: 0, sort: { field: 'createdAt', dir: 'desc' } });
  });
  it('parses page and limit and computes the offset', () => {
    const res = parsePagination({ page: '3', limit: '4' }, opts);
    expect(res).toMatchObject({ page: 3, limit: 4, offset: 8 });
    expect(parsePagination({ page: 2, limit: 10 }, opts).offset).toBe(10);
  });
  it('clamps page and limit', () => {
    expect(parsePagination({ page: '0' }, opts).page).toBe(1);
    expect(parsePagination({ limit: '0' }, opts).limit).toBe(1);
    expect(parsePagination({ limit: '999999' }, opts).limit).toBe(100);
    expect(parsePagination({ limit: '500' }, { maxLimit: 50 }).limit).toBe(50);
  });
  it('falls back to defaults for junk', () => {
    for (const junk of ['abc', '-5', '2.5', '', ' 3', ['1', '2'], null, {}]) {
      const res = parsePagination({ page: junk, limit: junk }, { ...opts, defaultLimit: 15 });
      expect(res).toMatchObject({ page: 1, limit: 15, offset: 0 });
    }
  });
  it('honours defaultLimit', () => {
    expect(parsePagination({}, { defaultLimit: 5 }).limit).toBe(5);
    expect(parsePagination({ page: '3' }, { defaultLimit: 5 }).offset).toBe(10);
  });
  it('parses the sort direction', () => {
    expect(parsePagination({ sort: 'name' }, opts).sort).toEqual({ field: 'name', dir: 'asc' });
    expect(parsePagination({ sort: '-price' }, opts).sort).toEqual({ field: 'price', dir: 'desc' });
  });
  it('only sorts by allow-listed fields', () => {
    expect(parsePagination({ sort: 'password' }, opts).sort).toEqual({ field: 'createdAt', dir: 'desc' });
    expect(parsePagination({ sort: '-password; DROP TABLE users' }, opts).sort).toEqual({ field: 'createdAt', dir: 'desc' });
    expect(parsePagination({ sort: ['price'] }, opts).sort).toEqual({ field: 'createdAt', dir: 'desc' });
  });
  it('parses a custom default sort the same way', () => {
    expect(parsePagination({}, { defaultSort: 'name' }).sort).toEqual({ field: 'name', dir: 'asc' });
    expect(parsePagination({ sort: 'bad' }, { defaultSort: '-price' }).sort).toEqual({ field: 'price', dir: 'desc' });
  });
});

describe('pageMeta', () => {
  it('computes totals and neighbours', () => {
    expect(pageMeta(10, { page: 1, limit: 4 })).toEqual({ page: 1, limit: 4, total: 10, totalPages: 3, hasNext: true, hasPrev: false });
    expect(pageMeta(10, { page: 3, limit: 4 })).toEqual({ page: 3, limit: 4, total: 10, totalPages: 3, hasNext: false, hasPrev: true });
  });
  it('handles an exact multiple and an empty list', () => {
    expect(pageMeta(8, { page: 2, limit: 4 }).totalPages).toBe(2);
    expect(pageMeta(8, { page: 2, limit: 4 }).hasNext).toBe(false);
    expect(pageMeta(0, { page: 1, limit: 4 })).toEqual({ page: 1, limit: 4, total: 0, totalPages: 0, hasNext: false, hasPrev: false });
  });
  it('works on a page beyond the end', () => {
    expect(pageMeta(5, { page: 9, limit: 4 })).toMatchObject({ totalPages: 2, hasNext: false, hasPrev: true });
  });
});
```

%% hints
- `const int = (v) => (/^\d+$/.test(String(v)) ? Number(v) : undefined);` (arrays stringify to `'1,2'`, `null` to `'null'`, both fail the regex).
- `limit = Math.min(maxLimit, Math.max(1, int(query.limit) ?? defaultLimit))`.
- Parse sort with a helper: `s.startsWith('-') ? { field: s.slice(1), dir: 'desc' } : { field: s, dir: 'asc' }`. Check `sortable.includes(parsed.field)` and that `query.sort` is a string.

%% solution
```js
export function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100, sortable = [], defaultSort = '-createdAt' } = {}) {
  const int = (v) => (/^\d+$/.test(String(v)) ? Number(v) : undefined);
  const parseSort = (s) => (s.startsWith('-') ? { field: s.slice(1), dir: 'desc' } : { field: s, dir: 'asc' });

  const page = Math.max(1, int(query.page) ?? 1);
  const limit = Math.min(maxLimit, Math.max(1, int(query.limit) ?? defaultLimit));

  let sort = parseSort(defaultSort);
  if (typeof query.sort === 'string') {
    const wanted = parseSort(query.sort);
    if (sortable.includes(wanted.field)) sort = wanted;
  }
  return { page, limit, offset: (page - 1) * limit, sort };
}

export function pageMeta(total, { page, limit }) {
  const totalPages = Math.ceil(total / limit);
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}
```

%% exercise nod-check-validator | Tests for a validator | 4 | js | js | checkValidator | 40
`createValidator(schema, { forbidUnknown })` returns `{ validate(input) }` giving `{ ok, value, errors }` (rules and messages as in the validator exercise: `is required`, `must be a string`, `must be at least N`, `must be at most N`, `is invalid`, `must be one of: a, b`, `is not allowed`, with paths such as `address.city` and `tags[1]`). You are given `checkValidator(createValidator)`. Write a check that passes for a correct validator and **fails** for one that: **ignores required fields**, **treats min as exclusive**, **treats max as exclusive**, **keeps unknown fields**, **stops at the first error**, **loses the path of nested errors**, **skips array items**, **treats optional fields as required**, **coerces fields that did not ask for it**, **ignores forbidUnknown**, **ignores defaults**.

```js
const v = createValidator({ name: { type: 'string', min: 2 } });
expect(v.validate({ name: 'A' }).errors).toEqual([{ path: 'name', message: 'must be at least 2' }]);
```

%% worked
**A similar problem, solved: `checkClamp(clamp)`** — test the **boundaries**, since that is where off-by-one mutants hide.

```js
export function checkClamp(clamp) {                 // clamp(n, lo, hi)
  expect(clamp(5, 1, 10)).toBe(5);                  // ① a normal value
  expect(clamp(1, 1, 10)).toBe(1);                  // ② exactly on the low edge: kills "<" vs "<="
  expect(clamp(10, 1, 10)).toBe(10);                // ③ exactly on the high edge
  expect(clamp(0, 1, 10)).toBe(1);                  // ④ just outside, both sides
  expect(clamp(11, 1, 10)).toBe(10);
}
```

For a validator, every rule needs **one value exactly on the limit** (valid) and **one just past it** (invalid), plus a case with **two problems at once**, so a validator that stops early shows up.

%% explain
- **Boundary pairs** for `min` and `max`.
- **One probe per rule**: required, optional, default, coerce, pattern, items, nested, unknown.
- **Exact error objects** (`path` and `message`), not just `ok`.

%% nudge
- Which two inputs separate "inclusive" from "exclusive"?
- What single input has two errors at once?

%% starter
```js
export function checkValidator(createValidator) {
  const v = createValidator({ name: { type: 'string', min: 2 } });
  expect(v.validate({ name: 'Ada' }).ok).toBe(true);
  // your assertions: required, boundaries, paths, items, unknown keys, defaults
}
```

%% tests
```js
const make = (f = {}) => (schema, { forbidUnknown = false } = {}) => {
  const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
  const join = (path, key) => (path && !f.flatPath ? path + '.' + key : key);
  const NAMES = { string: 'a string', number: 'a number', boolean: 'a boolean', array: 'an array', object: 'an object' };
  const checkValue = (rule, raw, path, errors) => {
    if (raw === undefined || raw === null) {
      if (rule.default !== undefined && !f.ignoreDefault) return rule.default;
      if (rule.required === false && !f.ignoreOptional) return undefined;
      if (!f.skipRequired) errors.push({ path, message: 'is required' });
      return undefined;
    }
    let v = raw;
    if (rule.coerce || f.coerceAlways) {
      if (rule.type === 'number' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) v = Number(v);
      if (rule.type === 'boolean' && (v === 'true' || v === 'false')) v = v === 'true';
    }
    const typeOk = {
      string: typeof v === 'string',
      number: typeof v === 'number' && Number.isFinite(v),
      boolean: typeof v === 'boolean',
      array: Array.isArray(v),
      object: isObject(v),
    }[rule.type];
    if (!typeOk) { errors.push({ path, message: 'must be ' + NAMES[rule.type] }); return undefined; }
    const sized = rule.type === 'string' || rule.type === 'number' || rule.type === 'array';
    const size = typeof v === 'number' ? v : v.length;
    let message;
    if (sized && rule.min !== undefined && (f.minExclusive ? size <= rule.min : size < rule.min)) message = 'must be at least ' + rule.min;
    else if (sized && rule.max !== undefined && (f.maxExclusive ? size >= rule.max : size > rule.max)) message = 'must be at most ' + rule.max;
    else if (rule.type === 'string' && rule.pattern && !rule.pattern.test(v)) message = 'is invalid';
    else if (rule.oneOf && !rule.oneOf.includes(v)) message = 'must be one of: ' + rule.oneOf.join(', ');
    if (message) errors.push({ path, message });
    if (rule.type === 'array' && rule.items && !f.skipItems) return v.map((item, i) => checkValue(rule.items, item, path + '[' + i + ']', errors));
    if (rule.type === 'object' && rule.properties) return checkObject(rule.properties, v, path, errors);
    return v;
  };
  const checkObject = (sch, obj, path, errors) => {
    const out = f.keepUnknown ? { ...obj } : {};
    for (const [key, rule] of Object.entries(sch)) {
      const result = checkValue(rule, obj[key], join(path, key), errors);
      if (result !== undefined) out[key] = result;
    }
    if (forbidUnknown && !f.ignoreForbid) {
      for (const key of Object.keys(obj)) if (!(key in sch)) errors.push({ path: join(path, key), message: 'is not allowed' });
    }
    return out;
  };
  return {
    validate(input) {
      if (!isObject(input)) return { ok: false, value: undefined, errors: [{ path: '', message: 'must be an object' }] };
      const errors = [];
      const out = checkObject(schema, input, '', errors);
      const all = f.stopAtFirst ? errors.slice(0, 1) : errors;
      return { ok: all.length === 0, value: all.length === 0 ? out : undefined, errors: all };
    },
  };
};

const correct = make();
const mutants = {
  'ignores required fields': make({ skipRequired: true }),
  'treats min as exclusive': make({ minExclusive: true }),
  'treats max as exclusive': make({ maxExclusive: true }),
  'keeps unknown fields': make({ keepUnknown: true }),
  'stops at the first error': make({ stopAtFirst: true }),
  'loses the path of nested errors': make({ flatPath: true }),
  'skips array items': make({ skipItems: true }),
  'treats optional fields as required': make({ ignoreOptional: true }),
  'coerces fields that did not ask for it': make({ coerceAlways: true }),
  'ignores forbidUnknown': make({ ignoreForbid: true }),
  'ignores defaults': make({ ignoreDefault: true }),
};

describe('your checkValidator', () => {
  it('passes on a correct validator', () => {
    checkValidator(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a validator that ${name}`, () => {
      let caught = false;
      try { checkValidator(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Build one schema with a field for every rule, then probe it with small inputs.
- Boundaries: `name` of length exactly `min` and `max` is valid; one shorter / longer is not.
- Two problems at once: `{ name: 1, age: 'abc' }` must give two errors.
- `forbidUnknown` needs a second validator: `createValidator(schema, { forbidUnknown: true })`.
- A boolean field **without** `coerce` given `'true'` must fail.

%% solution
```js
export function checkValidator(createValidator) {
  const schema = {
    name: { type: 'string', min: 2, max: 5 },
    age: { type: 'number', min: 18, max: 65, coerce: true },
    role: { type: 'string', oneOf: ['user', 'admin'], default: 'user' },
    nick: { type: 'string', required: false, pattern: /^[a-z]+$/ },
    tags: { type: 'array', items: { type: 'string', min: 1 }, required: false },
    address: { type: 'object', required: false, properties: { city: { type: 'string' } } },
    active: { type: 'boolean', required: false },
  };
  const v = createValidator(schema);

  const input = { name: 'Ada', age: '30', extra: 'x', tags: ['a'], address: { city: 'Oslo', zip: 1 } };
  const copy = JSON.parse(JSON.stringify(input));
  expect(v.validate(input)).toEqual({
    ok: true,
    value: { name: 'Ada', age: 30, role: 'user', tags: ['a'], address: { city: 'Oslo' } },
    errors: [],
  });
  expect(input).toEqual(copy);

  expect(v.validate({ age: 30 }).errors).toEqual([{ path: 'name', message: 'is required' }]);
  expect(v.validate({ name: 'Ada', age: 30 }).ok).toBe(true);

  expect(v.validate({ name: 'Ad', age: 18 }).ok).toBe(true);
  expect(v.validate({ name: 'Adaaa', age: 65 }).ok).toBe(true);
  expect(v.validate({ name: 'A', age: 30 }).errors).toEqual([{ path: 'name', message: 'must be at least 2' }]);
  expect(v.validate({ name: 'Adaaaa', age: 30 }).errors).toEqual([{ path: 'name', message: 'must be at most 5' }]);

  expect(v.validate({ name: 1, age: 'abc' }).errors).toEqual([
    { path: 'name', message: 'must be a string' },
    { path: 'age', message: 'must be a number' },
  ]);

  expect(v.validate({ name: 'Ada', age: 30, role: 'root' }).errors).toEqual([{ path: 'role', message: 'must be one of: user, admin' }]);
  expect(v.validate({ name: 'Ada', age: 30, nick: 'ABC' }).errors).toEqual([{ path: 'nick', message: 'is invalid' }]);
  expect(v.validate({ name: 'Ada', age: 30, address: { city: 5 } }).errors).toEqual([{ path: 'address.city', message: 'must be a string' }]);
  expect(v.validate({ name: 'Ada', age: 30, tags: ['ok', ''] }).errors).toEqual([{ path: 'tags[1]', message: 'must be at least 1' }]);
  expect(v.validate({ name: 'Ada', age: 30, active: 'true' }).errors).toEqual([{ path: 'active', message: 'must be a boolean' }]);

  const strict = createValidator(schema, { forbidUnknown: true });
  expect(strict.validate({ name: 'Ada', age: 30, hack: 1 }).errors).toEqual([{ path: 'hack', message: 'is not allowed' }]);
  expect(v.validate(null).ok).toBe(false);
}
```
