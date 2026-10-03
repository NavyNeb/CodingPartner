---
id: sec-validation-uploads
track: sec
title: Validation, uploads, rate limits & logs
summary: Accepting only what you expect: schema validation with field allowlists, safe file uploads (names, magic bytes, limits), token-bucket rate limiting, and keeping secrets out of logs.
---

## The idea in one sentence

Everything that crosses into your system is a **claim**, not a fact, so **check it against what you expect**, accept only the fields and shapes you defined, and **don't leak** more than you must on the way out.

> **Analogy** Airport security. Every bag is checked against the same rules regardless of who carries it, passengers can only bring what's on the allowed list, there's a limit on how many people go through per minute, and the security log records that a bag was checked, not what was in the passenger's pockets.

## Validate on the server, with a schema

Browser-side checks help users; **server-side checks protect you**, because attackers don't use your form. Describe valid input once, as a **schema**, and check **everything**: type, length, range, allowed values.

![Validation in layers](fig:sec-validation "Shape first, then normalise, then business rules, then authorisation.")

Good habits:

- **Allowlist fields.** Pick only the fields you defined; **ignore the rest**. Copying a whole request body into a database record is **mass assignment**: a client sends `{ "role": "admin" }` and becomes one.
- **Reject, don't repair.** Silently "fixing" input leads to surprises (and to disagreement between components about what the input means).
- **Report all errors at once**, with a path (`tags[2]`) and message.
- **Normalise before checking** (trim, lower-case emails), and use the **normalised** value afterwards.
- **Don't trust types from JSON**: `"5"` is not `5`, `null` is not `undefined`, arrays can show up where strings were expected.

```js try predict
const schema = {
  name:  { type: 'string', min: 1, max: 20, trim: true },
  age:   { type: 'integer', min: 0, max: 150 },
};
function check(data) {
  const errors = [], value = {};
  for (const [field, rule] of Object.entries(schema)) {
    let v = data[field];
    if (rule.type === 'string' && typeof v === 'string' && rule.trim) v = v.trim();
    const okType = rule.type === 'string' ? typeof v === 'string' : Number.isInteger(v);
    if (!okType) errors.push({ path: field, message: 'invalid ' + rule.type });
    else value[field] = v;
  }
  return { ok: errors.length === 0, value, errors };
}
console.log(check({ name: '  Ada ', age: 36, role: 'admin' }));
console.log(check({ name: 5, age: '36' }));
```

Only the schema's fields reach `value`: that stops `role` getting in.

## File uploads

Uploads combine nearly every risk: oversized files, malicious names, scripts disguised as images, and content the browser may later **sniff** as HTML.

![Upload checks](fig:sec-upload "The name and Content-Type are claims. The first bytes are evidence.")

```stepper Checking an upload
code:
  size > maxBytes            → reject
  detectType(bytes) === null → reject
  !allowed.includes(type)    → reject
  extension ≠ detected type  → reject
  name = safeFilename(name)  → store under a random id
---
line: 1
say: **Limit the size** before doing anything else, and reject **empty** files. (Also limit it at the web server so you don't read a gigabyte into memory first.)
check: size
---
line: 2
say: **Detect the real type** from the first bytes (the "magic number"): a PNG starts with `89 50 4E 47`, a JPEG with `FF D8 FF`, a PDF with `%PDF-`. The `Content-Type` header and the filename come from the uploader and can say anything.
check: magic bytes
---
line: 3
say: **Allowlist** the types your feature needs. "Everything except `.exe`" always misses something.
check: allowlist
---
line: 4
say: The **extension must agree** with the content: `shell.php` containing PNG bytes, or `photo.png` containing HTML, is suspicious either way.
check: extension
---
line: 5
say: **Sanitise the name** (no paths, no leading dots, no control characters, no Windows device names) and, better, **store under a random id** outside the web root, never serving the original name as a path.
check: safe name
```

When you **serve** user files: `X-Content-Type-Options: nosniff`, a fixed `Content-Type`, `Content-Disposition: attachment` for anything that isn't an image you re-encoded, and ideally a **separate domain** so a bug can't touch your session cookies.

## Rate limiting

Login forms, password resets, search and expensive endpoints need a **limit**, or they become a brute-force and denial-of-service target. A **token bucket** allows short bursts but a steady long-run rate:

![A token bucket](fig:sec-bucket "Requests take tokens; tokens refill at a steady pace; an empty bucket means a 429 with a Retry-After.")

Key it by **user and IP** (a limit per IP alone is shared by a whole office, a limit per account alone lets one IP try thousands of accounts). Return **429** with `Retry-After`.

## Logs: record events, not secrets

Logs live **longer and are seen by more people** than the database. Never log passwords, tokens, session ids, full card numbers or whole request bodies. **Redact by key name** (`password`, `token`, `authorization`, `cookie`…) and **by pattern** (bearer tokens, card numbers that pass the Luhn check), and make sure redaction survives **nested objects**, arrays and **circular references**.

## Quick check

```check
Q: What is mass assignment?
A) Uploading many files at once
B) Copying a whole request body into a record, so a client can set fields like `role` *
C) Assigning many variables in one line
D) A database feature
Why: Only allowlisted fields should ever be taken from a request.
---
Q: Why check the first bytes of an uploaded file?
A) To make it load faster
B) The filename and Content-Type are chosen by the uploader; the bytes show what it really is *
C) Bytes are always correct
D) To compress it
Why: A script can be named `photo.png`. The magic number is harder to fake consistently.
---
Q: What does a token bucket allow that a strict "N per minute" counter may not?
A) Nothing
B) Short bursts up to the capacity, with a steady long-run rate *
C) Unlimited requests
D) Per-file limits
Why: Tokens accumulate while idle and drain in bursts.
---
Q: Why is a limit per IP address alone a weak login defence?
A) IPs are secret
B) An attacker can spread attempts over many IPs while hitting one account, and a shared IP punishes innocent users: combine account and IP limits *
C) It is too fast
D) It is illegal
Why: Combine keys so both patterns are covered.
---
Q: Which should appear in application logs?
A) The user's password for debugging
B) An event such as "login failed for user 7 from IP x", without secrets *
C) Full session cookies
D) Entire request bodies
Why: Logs are widely accessible and long-lived.
```

## Recap

- **Schema-validate on the server**; **allowlist fields**; reject with **all errors**; normalise first.
- **Uploads**: size limit, **magic bytes**, allowlist, extension agrees, **sanitised name**, random storage name, safe serving headers.
- **Rate limit** with a token bucket keyed by user **and** IP; return 429 + `Retry-After`.
- **Redact** secrets from logs by key and by pattern, deeply and safely.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: pick allowed fields | Own properties, an allowlist |
| A schema validator | Per-type rules, paths, collecting every error |
| Upload checks | A filename sanitiser, magic-byte detection, ordered reasons |
| A token bucket | Injected clock, fractional refill, retry-after maths |
| A log redactor | Deep copy, key matching, regexes, the Luhn check, cycles |
| Tests for safeFilename | Path, dots, control characters, reserved names, length |

%% exercise sec-guided-pick | Guided: pick allowed fields | 1 | js | js | pick | 8 | guided
Implement `pick(source, allowedKeys)`. It returns a **new plain object** containing only the **own** properties of `source` whose names are in `allowedKeys`, skipping values that are `undefined`. A `source` that isn't an object gives `{}`.

```js
pick({ name: 'Ada', role: 'admin' }, ['name', 'email']); // { name: 'Ada' }
```

%% worked
**A similar problem, solved: `omit(source, blockedKeys)`** — the opposite, but note why an allowlist is safer.

```js
export function omit(source, blocked) {
  const out = {};
  for (const key of Object.keys(source)) {          // ① own enumerable keys only
    if (!blocked.includes(key)) out[key] = source[key];
  }
  return out;
}
```

`omit` is a **blocklist**: any field you forgot to list (a new `isAdmin` column added next year) gets through. `pick` is an **allowlist**: a new field is excluded **until you decide to allow it**. Prefer allowlists for security. Use `Object.prototype.hasOwnProperty.call` (or `Object.keys`) so inherited properties are never copied.

%% explain
- **Allowlist** of names; everything else is ignored.
- **Own properties only**; `undefined` values are skipped.
- **A new object** is returned.

%% nudge
- Why is an allowlist safer than a blocklist?
- How do you avoid copying inherited properties?

%% starter
```js
export function pick(source, allowedKeys) {
  const out = {};
  // loop over allowedKeys; copy own, defined values
  return out;
}
```

%% tests
```js
describe('pick', () => {
  it('copies only allowed keys', () => {
    expect(pick({ name: 'Ada', role: 'admin', email: 'a@b.co' }, ['name', 'email'])).toEqual({ name: 'Ada', email: 'a@b.co' });
  });
  it('ignores allowed keys that are missing or undefined', () => {
    expect(pick({ a: 1, b: undefined }, ['a', 'b', 'c'])).toEqual({ a: 1 });
  });
  it('keeps falsy values', () => {
    expect(pick({ a: 0, b: '', c: false, d: null }, ['a', 'b', 'c', 'd'])).toEqual({ a: 0, b: '', c: false, d: null });
  });
  it('does not copy inherited properties', () => {
    const proto = { inherited: 1 };
    const source = Object.create(proto);
    source.own = 2;
    expect(pick(source, ['inherited', 'own'])).toEqual({ own: 2 });
  });
  it('returns a new object and does not modify the source', () => {
    const source = { a: 1 };
    const result = pick(source, ['a']);
    result.a = 2;
    expect(source.a).toBe(1);
    expect(pick(source, ['a'])).not.toBe(source);
  });
  it('returns {} for non-objects and for an empty allowlist', () => {
    expect(pick(null, ['a'])).toEqual({});
    expect(pick(undefined, ['a'])).toEqual({});
    expect(pick('text', ['length'])).toEqual({});
    expect(pick({ a: 1 }, [])).toEqual({});
  });
  it('is safe with __proto__ in the source', () => {
    const evil = JSON.parse('{"__proto__": {"admin": true}, "name": "x"}');
    const out = pick(evil, ['name']);
    expect(out).toEqual({ name: 'x' });
    expect(out.admin).toBeUndefined();
  });
});
```

%% hints
- `for (const key of allowedKeys) { if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) out[key] = source[key]; }`
- Guard first: `if (source === null || typeof source !== 'object') return {};`

%% solution
```js
export function pick(source, allowedKeys) {
  const out = {};
  if (source === null || typeof source !== 'object') return out;
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}
```

%% exercise sec-schema | A schema validator | 4 | js | js | validate | 40
Implement `validate(schema, data)` returning `{ ok, value, errors }`. `schema` maps field names to rules; `errors` is a list of `{ path, message }`; `value` is the cleaned object (only schema fields) when `ok`, otherwise `undefined`.

- `data` must be a non-null, non-array object, otherwise `errors = [{ path: '', message: 'must be an object' }]`.
- Only **own** properties of `data` are read; **unknown fields are dropped**.
- A field that is `undefined` or `null`: if the rule has `default` (for `undefined` only), use it; else if `optional: true`, omit it; else error `'is required'`.
- Rule types:
  - `string`: must be a string (`'must be a string'`); `trim: true` trims first (and the trimmed value is kept); `min` / `max` lengths (`'must be at least N characters'`, `'must be at most N characters'`); `pattern` (a RegExp) failing gives `'is invalid'`.
  - `integer`: a number that `Number.isInteger` (`'must be an integer'`); `number`: a finite number (`'must be a number'`); both support `min` / `max` (`'must be at least N'`, `'must be at most N'`). **No coercion**: `'5'` is an error.
  - `boolean`: `'must be true or false'`.
  - `email`: a string, trimmed and lower-cased, length ≤ 254 and matching `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, else `'must be a valid email'`; the cleaned value is kept.
  - `enum` with `values`: `'must be one of: a, b, c'`.
  - `array` with optional `items` (a rule), `minItems`, `maxItems` (`'must be an array'`, `'must have at least N items'`, `'must have at most N items'`); each item is validated with the path `field[i]`.
- **Collect every error**; the first failing check of a field is its only error.

```js
validate({ age: { type: 'integer', min: 0 } }, { age: -1, role: 'admin' });
// { ok: false, value: undefined, errors: [{ path: 'age', message: 'must be at least 0' }] }
```

%% worked
**A similar problem, solved: `validateOne(rule, value, path, errors)`** — one function that checks one value and records problems.

```js
function checkNumber(rule, value, path, errors) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ path, message: 'must be a number' });         // ① type first, and stop: later checks assume the type is right
    return undefined;
  }
  if (rule.min !== undefined && value < rule.min) { errors.push({ path, message: `must be at least ${rule.min}` }); return undefined; }
  return value;
}
```

Structure the validator as **one small function per type** that returns the **cleaned value** (or `undefined` after pushing an error). A shared `validateValue(rule, value, path, errors)` dispatches on `rule.type`, and `array` calls it again for each item with `field[i]` as the path. Passing the `errors` array down is how you **collect all errors** instead of stopping at the first.

%% explain
- **Required / optional / default** handling for missing values.
- **One checker per type**, each returning the cleaned value.
- **Arrays** recurse with indexed paths.
- **Unknown fields** never reach `value`.

%% nudge
- Why return early after a type error within a field?
- Where do you put the check that `data` itself is an object?

%% starter
```js
export function validate(schema, data) {
  return { ok: false, value: undefined, errors: [] };
}
```

%% tests
```js
describe('validate', () => {
  const schema = {
    name: { type: 'string', min: 1, max: 10, trim: true },
    age: { type: 'integer', min: 0, max: 150 },
  };
  it('accepts valid data and drops unknown fields', () => {
    expect(validate(schema, { name: '  Ada ', age: 36, role: 'admin', isAdmin: true })).toEqual({ ok: true, value: { name: 'Ada', age: 36 }, errors: [] });
  });
  it('requires non-optional fields', () => {
    const r = validate(schema, { name: 'Ada' });
    expect(r.ok).toBe(false);
    expect(r.value).toBeUndefined();
    expect(r.errors).toEqual([{ path: 'age', message: 'is required' }]);
    expect(validate(schema, { name: null, age: null }).errors.map((e) => e.message)).toEqual(['is required', 'is required']);
  });
  it('collects every error', () => {
    const r = validate(schema, { name: '', age: 200 });
    expect(r.errors).toEqual([
      { path: 'name', message: 'must be at least 1 characters' },
      { path: 'age', message: 'must be at most 150' },
    ]);
  });
  it('does not coerce types', () => {
    const r = validate(schema, { name: 5, age: '36' });
    expect(r.errors).toEqual([{ path: 'name', message: 'must be a string' }, { path: 'age', message: 'must be an integer' }]);
    expect(validate({ n: { type: 'integer' } }, { n: 1.5 }).errors[0].message).toBe('must be an integer');
  });
  it('trims before checking length', () => {
    expect(validate(schema, { name: '   ', age: 1 }).errors).toEqual([{ path: 'name', message: 'must be at least 1 characters' }]);
    expect(validate(schema, { name: '  abcdefghij  ', age: 1 }).ok).toBe(true);
    expect(validate(schema, { name: 'abcdefghijk', age: 1 }).errors[0].message).toBe('must be at most 10 characters');
  });
  it('supports pattern, optional and default', () => {
    const s = {
      code: { type: 'string', pattern: /^[A-Z]{3}$/ },
      note: { type: 'string', optional: true },
      role: { type: 'enum', values: ['user', 'admin'], default: 'user' },
    };
    expect(validate(s, { code: 'ABC' })).toEqual({ ok: true, value: { code: 'ABC', role: 'user' }, errors: [] });
    expect(validate(s, { code: 'abc' }).errors).toEqual([{ path: 'code', message: 'is invalid' }]);
    expect(validate(s, { code: 'ABC', role: 'admin', note: 'hi' }).value).toEqual({ code: 'ABC', note: 'hi', role: 'admin' });
  });
  it('validates numbers, booleans and enums', () => {
    const s = { n: { type: 'number', min: 0.5 }, ok: { type: 'boolean' }, level: { type: 'enum', values: ['low', 'high'] } };
    expect(validate(s, { n: 1.5, ok: false, level: 'low' }).ok).toBe(true);
    expect(validate(s, { n: NaN, ok: 'yes', level: 'mid' }).errors).toEqual([
      { path: 'n', message: 'must be a number' },
      { path: 'ok', message: 'must be true or false' },
      { path: 'level', message: 'must be one of: low, high' },
    ]);
    expect(validate(s, { n: 0.1, ok: true, level: 'low' }).errors[0].message).toBe('must be at least 0.5');
    expect(validate({ ok: { type: 'boolean' } }, { ok: false }).value).toEqual({ ok: false });
  });
  it('validates and normalises emails', () => {
    const s = { email: { type: 'email' } };
    expect(validate(s, { email: '  Ada@Example.COM ' }).value).toEqual({ email: 'ada@example.com' });
    for (const bad of ['nope', 'a@b', 'a b@c.de', '@x.com', 'a@@b.co', 42, 'a'.repeat(250) + '@x.co']) {
      expect(validate(s, { email: bad }).errors).toEqual([{ path: 'email', message: 'must be a valid email' }]);
    }
  });
  it('validates arrays with indexed paths', () => {
    const s = { tags: { type: 'array', items: { type: 'string', min: 1, trim: true }, minItems: 1, maxItems: 3 } };
    expect(validate(s, { tags: [' a ', 'b'] }).value).toEqual({ tags: ['a', 'b'] });
    expect(validate(s, { tags: [] }).errors).toEqual([{ path: 'tags', message: 'must have at least 1 items' }]);
    expect(validate(s, { tags: ['a', 'b', 'c', 'd'] }).errors).toEqual([{ path: 'tags', message: 'must have at most 3 items' }]);
    expect(validate(s, { tags: 'a' }).errors).toEqual([{ path: 'tags', message: 'must be an array' }]);
    expect(validate(s, { tags: ['ok', 5, ''] }).errors).toEqual([
      { path: 'tags[1]', message: 'must be a string' },
      { path: 'tags[2]', message: 'must be at least 1 characters' },
    ]);
  });
  it('requires an object and reads only own properties', () => {
    for (const bad of [null, undefined, 'x', 5, [], [1]]) {
      expect(validate(schema, bad)).toEqual({ ok: false, value: undefined, errors: [{ path: '', message: 'must be an object' }] });
    }
    const inherited = Object.create({ name: 'Ada', age: 3 });
    expect(validate(schema, inherited).errors.map((e) => e.message)).toEqual(['is required', 'is required']);
  });
  it('does not let __proto__ in data reach the value', () => {
    const evil = JSON.parse('{"name": "x", "age": 1, "__proto__": {"isAdmin": true}}');
    const r = validate(schema, evil);
    expect(r.ok).toBe(true);
    expect(r.value.isAdmin).toBeUndefined();
    expect(Object.keys(r.value)).toEqual(['name', 'age']);
  });
});
```

%% hints
- `hasOwn(data, field) ? data[field] : undefined` to read each field.
- A recursive `check(rule, value, path, errors)` returning the cleaned value or `undefined`.
- For arrays: loop with `check(rule.items, item, `${path}[${i}]`, errors)`.

%% solution
```js
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

function check(rule, input, path, errors) {
  const fail = (message) => {
    errors.push({ path, message });
    return undefined;
  };
  let value = input;
  switch (rule.type) {
    case 'string': {
      if (typeof value !== 'string') return fail('must be a string');
      if (rule.trim) value = value.trim();
      if (rule.min !== undefined && value.length < rule.min) return fail(`must be at least ${rule.min} characters`);
      if (rule.max !== undefined && value.length > rule.max) return fail(`must be at most ${rule.max} characters`);
      if (rule.pattern && !rule.pattern.test(value)) return fail('is invalid');
      return value;
    }
    case 'integer':
    case 'number': {
      const ok = rule.type === 'integer' ? Number.isInteger(value) : typeof value === 'number' && Number.isFinite(value);
      if (!ok) return fail(rule.type === 'integer' ? 'must be an integer' : 'must be a number');
      if (rule.min !== undefined && value < rule.min) return fail(`must be at least ${rule.min}`);
      if (rule.max !== undefined && value > rule.max) return fail(`must be at most ${rule.max}`);
      return value;
    }
    case 'boolean':
      return typeof value === 'boolean' ? value : fail('must be true or false');
    case 'email': {
      if (typeof value !== 'string') return fail('must be a valid email');
      value = value.trim().toLowerCase();
      return value.length <= 254 && EMAIL.test(value) ? value : fail('must be a valid email');
    }
    case 'enum':
      return rule.values.includes(value) ? value : fail('must be one of: ' + rule.values.join(', '));
    case 'array': {
      if (!Array.isArray(value)) return fail('must be an array');
      if (rule.minItems !== undefined && value.length < rule.minItems) return fail(`must have at least ${rule.minItems} items`);
      if (rule.maxItems !== undefined && value.length > rule.maxItems) return fail(`must have at most ${rule.maxItems} items`);
      if (!rule.items) return [...value];
      const before = errors.length;
      const cleaned = value.map((item, i) => check(rule.items, item, `${path}[${i}]`, errors));
      return errors.length === before ? cleaned : undefined;
    }
    default:
      return fail('unknown rule type');
  }
}

export function validate(schema, data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, value: undefined, errors: [{ path: '', message: 'must be an object' }] };
  }
  const errors = [];
  const entries = [];
  for (const [field, rule] of Object.entries(schema)) {
    let input = hasOwn(data, field) ? data[field] : undefined;
    if (input === undefined && rule.default !== undefined) input = rule.default;
    if (input === undefined || input === null) {
      if (rule.optional) continue;
      errors.push({ path: field, message: 'is required' });
      continue;
    }
    const cleaned = check(rule, input, field, errors);
    if (cleaned !== undefined) entries.push([field, cleaned]);
  }
  const ok = errors.length === 0;
  return { ok, value: ok ? Object.fromEntries(entries) : undefined, errors };
}
```

%% exercise sec-upload | Upload checks | 4 | js | js | safeFilename, detectType, validateUpload | 36
Implement three upload helpers.

`safeFilename(name, { maxLength = 100 } = {})`:

1. Convert to a string (`null`/`undefined` give `''`); keep only the part after the **last `/` or `\`**.
2. Remove control characters (`\u0000`–`\u001f`, `\u007f`); replace each of `< > : " | ? *` with `_`; replace each run of whitespace with a single `_`.
3. Remove **leading dots**; remove **trailing dots**.
4. If the part of the name before the **first dot** is a Windows device name (`CON PRN AUX NUL COM1–9 LPT1–9`, any case), prefix `_`.
5. An empty result becomes `'file'`.
6. If longer than `maxLength`, shorten it: when there is an extension of **at most 10 characters** (the text from the last dot, if that dot isn't the first character), cut the **base** so the whole is `maxLength` and **keep the extension**; otherwise cut at `maxLength`.

`detectType(bytes)` (a `Uint8Array` or array of numbers) returns `'image/png'` (`89 50 4E 47 0D 0A 1A 0A`), `'image/jpeg'` (`FF D8 FF`), `'image/gif'` (`GIF87a` or `GIF89a`), `'application/pdf'` (`%PDF-`), `'application/zip'` (`50 4B 03 04`) or `null`.

`validateUpload({ name, bytes, maxBytes, allowed })` returns `{ ok: false, reason }` for the **first** failing check, in this order: `'empty file'`, `'file too large'` (more than `maxBytes`), `'unknown file type'`, `'type not allowed'` (not in `allowed`), `'extension does not match content'`; otherwise `{ ok: true, name, type }` with the sanitised `name`. The extension (of the **sanitised** name, after its last dot, any case) must be one of: png → `png`; jpeg → `jpg`, `jpeg`; gif → `gif`; pdf → `pdf`; zip → `zip`. No extension is a mismatch.

```js
safeFilename('../../etc/passwd'); // 'passwd'
```

%% worked
**A similar problem, solved: `safeSlugFilename(name)`** — strip the path, then whitelist what remains.

```js
export function safeSlug(name) {
  let s = String(name ?? '');
  s = s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')) + 1);   // ① only the last path component
  s = s.replace(/[^A-Za-z0-9._-]/g, '_');                                // ② an allowlist: everything else becomes _
  s = s.replace(/^\.+/, '');                                             // ③ no hidden files, no '..'
  return s || 'file';                                                    // ④ never return an empty name
}
```

For `detectType`, compare **leading bytes** one by one (convert text signatures with `charCodeAt`). For validation, put the checks in a **fixed order** so the same bad file always gets the same reason. Judge the extension on the **sanitised** name: that's the name you'll actually store.

%% explain
- **Filename**: last path component, control and forbidden characters, dots, reserved names, empty, length with extension.
- **Magic numbers** for five types.
- **Validation order**: empty, size, unknown, not allowed, extension mismatch.

%% nudge
- Why strip leading dots from a filename?
- What should happen when a long name has no usable extension?

%% starter
```js
export function safeFilename(name, { maxLength = 100 } = {}) {
  return 'file';
}

export function detectType(bytes) {
  return null;
}

export function validateUpload({ name, bytes, maxBytes, allowed }) {
  return { ok: false, reason: 'unknown file type' };
}
```

%% tests
```js
const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
const jpeg = [0xff, 0xd8, 0xff, 0xe0, 1, 2];
const gif = [...'GIF89a'].map((c) => c.charCodeAt(0)).concat([1, 2]);
const pdf = [...'%PDF-1.7'].map((c) => c.charCodeAt(0));
const zip = [0x50, 0x4b, 0x03, 0x04, 9];

describe('safeFilename', () => {
  it('keeps ordinary names', () => {
    expect(safeFilename('report.pdf')).toBe('report.pdf');
    expect(safeFilename('archive.tar.gz')).toBe('archive.tar.gz');
  });
  it('strips path components with both separators', () => {
    expect(safeFilename('../../etc/passwd')).toBe('passwd');
    expect(safeFilename('/etc/passwd')).toBe('passwd');
    expect(safeFilename('C:\\Users\\a\\report.pdf')).toBe('report.pdf');
    expect(safeFilename('..\\..\\boot.ini')).toBe('boot.ini');
    expect(safeFilename('a/b\\c/d.txt')).toBe('d.txt');
  });
  it('removes control characters and replaces forbidden ones', () => {
    expect(safeFilename('a\0b.txt')).toBe('ab.txt');
    expect(safeFilename('a\u0007b\u007fc.txt')).toBe('abc.txt');
    expect(safeFilename('a<b>:c|d?e*f.txt')).toBe('a_b__c_d_e_f.txt');
    expect(safeFilename('say "hi".txt')).toBe('say__hi_.txt');
  });
  it('collapses whitespace runs into one underscore', () => {
    expect(safeFilename('my  file (1).png')).toBe('my_file_(1).png');
  });
  it('removes leading and trailing dots', () => {
    expect(safeFilename('.htaccess')).toBe('htaccess');
    expect(safeFilename('...hidden.txt')).toBe('hidden.txt');
    expect(safeFilename('name.')).toBe('name');
    expect(safeFilename('name...')).toBe('name');
  });
  it('prefixes Windows device names', () => {
    expect(safeFilename('CON.txt')).toBe('_CON.txt');
    expect(safeFilename('nul')).toBe('_nul');
    expect(safeFilename('com1.png')).toBe('_com1.png');
    expect(safeFilename('LPT9.log')).toBe('_LPT9.log');
    expect(safeFilename('console.txt')).toBe('console.txt');
    expect(safeFilename('com10.txt')).toBe('com10.txt');
  });
  it('never returns an empty name', () => {
    for (const input of ['', '...', '/', '\\', null, undefined, '\0\0']) expect(safeFilename(input)).toBe('file');
  });
  it('limits the length but keeps a short extension', () => {
    const long = 'a'.repeat(200) + '.png';
    const out = safeFilename(long, { maxLength: 20 });
    expect(out.length).toBe(20);
    expect(out.endsWith('.png')).toBe(true);
    expect(safeFilename('b'.repeat(200)).length).toBe(100);
    expect(safeFilename('c'.repeat(30) + '.' + 'x'.repeat(40), { maxLength: 20 })).toBe('c'.repeat(20));
    expect(safeFilename('d'.repeat(10) + '.txt', { maxLength: 100 })).toBe('d'.repeat(10) + '.txt');
  });
});

describe('detectType', () => {
  it('recognises the supported types', () => {
    expect(detectType(png)).toBe('image/png');
    expect(detectType(jpeg)).toBe('image/jpeg');
    expect(detectType(gif)).toBe('image/gif');
    expect(detectType([...'GIF87a'].map((c) => c.charCodeAt(0)))).toBe('image/gif');
    expect(detectType(pdf)).toBe('application/pdf');
    expect(detectType(zip)).toBe('application/zip');
  });
  it('accepts typed arrays', () => {
    expect(detectType(new Uint8Array(png))).toBe('image/png');
  });
  it('returns null for unknown or too-short data', () => {
    expect(detectType([])).toBeNull();
    expect(detectType([0x89, 0x50])).toBeNull();
    expect(detectType([...'<html>'].map((c) => c.charCodeAt(0)))).toBeNull();
    expect(detectType([...'GIF90a'].map((c) => c.charCodeAt(0)))).toBeNull();
    expect(detectType([0xff, 0xd8])).toBeNull();
  });
});

describe('validateUpload', () => {
  const opts = { maxBytes: 100, allowed: ['image/png', 'image/jpeg', 'application/pdf'] };
  it('accepts a good upload and returns the safe name and type', () => {
    expect(validateUpload({ name: '../my photo.PNG', bytes: png, ...opts })).toEqual({ ok: true, name: 'my_photo.PNG', type: 'image/png' });
    expect(validateUpload({ name: 'a.jpg', bytes: jpeg, ...opts }).ok).toBe(true);
    expect(validateUpload({ name: 'a.jpeg', bytes: jpeg, ...opts }).ok).toBe(true);
    expect(validateUpload({ name: 'doc.pdf', bytes: pdf, ...opts }).ok).toBe(true);
  });
  it('rejects empty and oversized files', () => {
    expect(validateUpload({ name: 'a.png', bytes: [], ...opts })).toEqual({ ok: false, reason: 'empty file' });
    expect(validateUpload({ name: 'a.png', bytes: png.concat(new Array(200).fill(0)), ...opts })).toEqual({ ok: false, reason: 'file too large' });
    expect(validateUpload({ name: 'a.png', bytes: new Array(100).fill(1).map((_, i) => png[i] ?? 0), ...opts }).ok).toBe(true);
  });
  it('rejects unknown content however it is named', () => {
    const html = [...'<script>alert(1)</script>'].map((c) => c.charCodeAt(0));
    expect(validateUpload({ name: 'photo.png', bytes: html, ...opts })).toEqual({ ok: false, reason: 'unknown file type' });
  });
  it('rejects types that are not allowed', () => {
    expect(validateUpload({ name: 'a.gif', bytes: gif, ...opts })).toEqual({ ok: false, reason: 'type not allowed' });
    expect(validateUpload({ name: 'a.zip', bytes: zip, ...opts })).toEqual({ ok: false, reason: 'type not allowed' });
  });
  it('rejects extension mismatches, including none', () => {
    expect(validateUpload({ name: 'shell.php', bytes: png, ...opts })).toEqual({ ok: false, reason: 'extension does not match content' });
    expect(validateUpload({ name: 'photo.jpg', bytes: png, ...opts }).reason).toBe('extension does not match content');
    expect(validateUpload({ name: 'noextension', bytes: png, ...opts }).reason).toBe('extension does not match content');
    expect(validateUpload({ name: '.png', bytes: png, ...opts }).reason).toBe('extension does not match content');
  });
  it('judges the extension of the sanitised name', () => {
    expect(validateUpload({ name: 'evil.php\0.png', bytes: png, ...opts }).ok).toBe(true);
    expect(validateUpload({ name: 'a.png.', bytes: png, ...opts }).ok).toBe(true);
  });
  it('reports the first failing check', () => {
    expect(validateUpload({ name: 'x.exe', bytes: [], ...opts }).reason).toBe('empty file');
    expect(validateUpload({ name: 'x.exe', bytes: new Array(500).fill(7), ...opts }).reason).toBe('file too large');
  });
});
```

%% hints
- `safeFilename`: slice after `Math.max(lastIndexOf('/'), lastIndexOf('\\'))`, then the replacements in the listed order.
- Reserved: `/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s.split('.')[0])`.
- Shortening: `const dot = s.lastIndexOf('.'); if (dot > 0 && s.length - dot <= 10) s = s.slice(0, maxLength - (s.length - dot)) + s.slice(dot); else s = s.slice(0, maxLength);`
- `detectType`: a helper `startsWith(bytes, [..])`.

%% solution
```js
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function safeFilename(name, { maxLength = 100 } = {}) {
  let s = String(name ?? '');
  s = s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')) + 1);
  s = s.replace(/[\u0000-\u001f\u007f]/g, '');
  s = s.replace(/[<>:"|?*]/g, '_');
  s = s.replace(/\s+/g, '_');
  s = s.replace(/^\.+/, '').replace(/\.+$/, '');
  if (RESERVED.test(s.split('.')[0])) s = '_' + s;
  if (s === '') s = 'file';
  if (s.length > maxLength) {
    const dot = s.lastIndexOf('.');
    if (dot > 0 && s.length - dot <= 10) s = s.slice(0, maxLength - (s.length - dot)) + s.slice(dot);
    else s = s.slice(0, maxLength);
  }
  return s;
}

const startsWith = (bytes, prefix) => bytes.length >= prefix.length && prefix.every((b, i) => bytes[i] === b);
const ascii = (text) => [...text].map((c) => c.charCodeAt(0));

export function detectType(bytes) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))) return 'image/gif';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return 'application/zip';
  return null;
}

const EXTENSIONS = {
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/gif': ['gif'],
  'application/pdf': ['pdf'],
  'application/zip': ['zip'],
};

export function validateUpload({ name, bytes, maxBytes, allowed }) {
  if (bytes.length === 0) return { ok: false, reason: 'empty file' };
  if (bytes.length > maxBytes) return { ok: false, reason: 'file too large' };
  const type = detectType(bytes);
  if (type === null) return { ok: false, reason: 'unknown file type' };
  if (!allowed.includes(type)) return { ok: false, reason: 'type not allowed' };
  const safe = safeFilename(name);
  const dot = safe.lastIndexOf('.');
  const extension = dot > 0 ? safe.slice(dot + 1).toLowerCase() : '';
  if (!EXTENSIONS[type].includes(extension)) return { ok: false, reason: 'extension does not match content' };
  return { ok: true, name: safe, type };
}
```

%% exercise sec-token-bucket | A token bucket | 3 | js | js | createTokenBucket | 24
Implement `createTokenBucket({ capacity, refillPerSec, clock })`; `clock.now()` returns milliseconds. It keeps a separate bucket **per key**.

- `take(key, cost = 1)` returns `{ allowed, remaining, retryAfterMs }`.
- A key's bucket **starts full** (`capacity` tokens). Tokens refill continuously at `refillPerSec` per second, never above `capacity`. Refill is computed from the time since that key was last touched, on **every** `take` (allowed or not).
- If the bucket has at least `cost` tokens: subtract them, `allowed: true`, `retryAfterMs: 0`. Otherwise `allowed: false` and nothing is subtracted, with `retryAfterMs = Math.ceil((cost - tokens) / refillPerSec * 1000)`.
- `remaining` is `Math.floor` of the tokens left after the call.
- A `cost` above `capacity` throws `RangeError('cost exceeds capacity')`.
- `reset(key)` forgets a key (it starts full again).

```js
const bucket = createTokenBucket({ capacity: 5, refillPerSec: 1, clock });
bucket.take('ip:1.2.3.4'); // { allowed: true, remaining: 4, retryAfterMs: 0 }
```

%% worked
**A similar problem, solved: `createCooldown({ cooldownMs, clock })`** — per-key state plus a time-based decision.

```js
export function createCooldown({ cooldownMs, clock }) {
  const last = new Map();
  return {
    try(key) {
      const now = clock.now();
      const readyAt = (last.get(key) ?? -Infinity) + cooldownMs;     // ① per-key state, with a safe "never used" default
      if (now < readyAt) return { allowed: false, retryAfterMs: readyAt - now };
      last.set(key, now);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
```

A bucket is the same shape with two numbers per key (`tokens`, `updatedAt`). On each call: **refill first** (`tokens = min(capacity, tokens + elapsedSeconds × refillPerSec)`), **then decide**. Always set `updatedAt = now` after refilling, even for refused calls, otherwise the same elapsed time would be credited twice.

%% explain
- **Per-key state**: tokens and last update time.
- **Refill, then decide**, capped at capacity.
- **Denied calls** subtract nothing but still move the clock forward.
- **`retryAfterMs`** is the time to refill the shortfall, rounded up.

%% nudge
- Why must the refill timestamp be updated on a denied call too?
- How do you compute the wait for a shortfall?

%% starter
```js
export function createTokenBucket({ capacity, refillPerSec, clock }) {
  return {
    take(key, cost = 1) {
      return { allowed: false, remaining: 0, retryAfterMs: 0 };
    },
    reset(key) {},
  };
}
```

%% tests
```js
const setup = (opts = {}) => {
  let t = 1000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  return { clock, bucket: createTokenBucket({ capacity: 5, refillPerSec: 2, clock, ...opts }) };
};

describe('createTokenBucket', () => {
  it('starts full and drains', () => {
    const { bucket } = setup();
    for (let i = 4; i >= 0; i--) {
      expect(bucket.take('a')).toEqual({ allowed: true, remaining: i, retryAfterMs: 0 });
    }
  });
  it('refuses when empty and says how long to wait', () => {
    const { bucket } = setup();
    for (let i = 0; i < 5; i++) bucket.take('a');
    expect(bucket.take('a')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 500 });
    expect(bucket.take('a', 2)).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1000 });
  });
  it('refills over time, capped at capacity', () => {
    const { bucket, clock } = setup();
    for (let i = 0; i < 5; i++) bucket.take('a');
    clock.advance(500);
    expect(bucket.take('a')).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
    expect(bucket.take('a').allowed).toBe(false);
    clock.advance(60000);
    expect(bucket.take('a')).toEqual({ allowed: true, remaining: 4, retryAfterMs: 0 });
  });
  it('credits partial refills and floors remaining', () => {
    const { bucket, clock } = setup();
    for (let i = 0; i < 5; i++) bucket.take('a');
    clock.advance(750);
    expect(bucket.take('a')).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
    clock.advance(250);
    expect(bucket.take('a').allowed).toBe(true);
  });
  it('does not double count elapsed time across refused calls', () => {
    const { bucket, clock } = setup();
    for (let i = 0; i < 5; i++) bucket.take('a');
    clock.advance(250);
    expect(bucket.take('a').allowed).toBe(false);
    clock.advance(250);
    expect(bucket.take('a')).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
  });
  it('keeps keys independent', () => {
    const { bucket } = setup();
    for (let i = 0; i < 5; i++) bucket.take('a');
    expect(bucket.take('a').allowed).toBe(false);
    expect(bucket.take('b')).toEqual({ allowed: true, remaining: 4, retryAfterMs: 0 });
  });
  it('supports costs', () => {
    const { bucket } = setup();
    expect(bucket.take('a', 3)).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    expect(bucket.take('a', 3)).toEqual({ allowed: false, remaining: 2, retryAfterMs: 500 });
    expect(bucket.take('a', 2).allowed).toBe(true);
    expect(() => bucket.take('a', 6)).toThrow(RangeError);
    expect(() => bucket.take('a', 6)).toThrow('cost exceeds capacity');
  });
  it('resets keys', () => {
    const { bucket } = setup();
    for (let i = 0; i < 5; i++) bucket.take('a');
    bucket.reset('a');
    expect(bucket.take('a')).toEqual({ allowed: true, remaining: 4, retryAfterMs: 0 });
  });
  it('works with slow refill rates', () => {
    const { bucket, clock } = setup({ capacity: 2, refillPerSec: 0.5 });
    bucket.take('a'); bucket.take('a');
    expect(bucket.take('a').retryAfterMs).toBe(2000);
    clock.advance(1999);
    expect(bucket.take('a').allowed).toBe(false);
    clock.advance(1);
    expect(bucket.take('a').allowed).toBe(true);
  });
});
```

%% hints
- State per key: `{ tokens, updatedAt }`, created full on first use.
- Refill: `tokens = Math.min(capacity, tokens + ((now - updatedAt) / 1000) * refillPerSec)`; then `updatedAt = now`.
- Wait: `Math.ceil(((cost - tokens) / refillPerSec) * 1000)`.

%% solution
```js
export function createTokenBucket({ capacity, refillPerSec, clock }) {
  const buckets = new Map();
  return {
    take(key, cost = 1) {
      if (cost > capacity) throw new RangeError('cost exceeds capacity');
      const now = clock.now();
      const b = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
      b.tokens = Math.min(capacity, b.tokens + ((now - b.updatedAt) / 1000) * refillPerSec);
      b.updatedAt = now;
      buckets.set(key, b);
      if (b.tokens >= cost) {
        b.tokens -= cost;
        return { allowed: true, remaining: Math.floor(b.tokens), retryAfterMs: 0 };
      }
      return {
        allowed: false,
        remaining: Math.floor(b.tokens),
        retryAfterMs: Math.ceil(((cost - b.tokens) / refillPerSec) * 1000),
      };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}
```

%% exercise sec-redact | A log redactor | 4 | js | js | redact | 32
Implement `redact(value, { keys } = {})`, returning a **deep copy** that is safe to log.

- Keys are compared after **normalising** (lower-case, remove everything except letters and digits). A property whose normalised name **contains** a sensitive key has its **whole value** replaced with `'[REDACTED]'` (any type). Default keys: `password`, `passwd`, `secret`, `token`, `apikey`, `authorization`, `cookie`, `creditcard`, `cardnumber`, `cvv`, `ssn`. Passing `keys` **replaces** the list.
- In all **strings** (at any depth, including array items): `Bearer <token>` becomes `Bearer [REDACTED]` (case-insensitive), and any run of **13 to 19 digits** (optionally separated by single spaces or dashes) that passes the **Luhn check** becomes `[REDACTED_CARD]`.
- Arrays and plain objects are copied recursively; other values (numbers, booleans, `null`, `Date` and other class instances) are returned **as they are**.
- A **circular reference** becomes `'[Circular]'`. The input is **never modified**, and a key named `__proto__` must not change the copy's prototype.

```js
redact({ user: 'ada', password: 'hunter2', note: 'card 4111 1111 1111 1111' });
// { user: 'ada', password: '[REDACTED]', note: 'card [REDACTED_CARD]' }
```

%% worked
**A similar problem, solved: `maskEmails(value)`** — a deep walk with a per-string transformation.

```js
export function maskEmails(value, seen = new Set()) {
  if (typeof value === 'string') return value.replace(/[^\s@]+@[^\s@]+/g, '[email]');   // ① transform strings wherever they are
  if (value === null || typeof value !== 'object') return value;                          // ② primitives pass through
  if (seen.has(value)) return '[Circular]';                                               // ③ we are already inside this object
  seen.add(value);
  const out = Array.isArray(value)
    ? value.map((v) => maskEmails(v, seen))
    : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskEmails(v, seen)]));   // ④ fromEntries: safe even for a "__proto__" key
  seen.delete(value);                                                                     // ⑤ leaving: shared (non-circular) references are fine
  return out;
}
```

The **Luhn check** doubles every second digit from the right (subtracting 9 from results over 9) and requires the digit sum to be a multiple of 10. It stops a random long number (an order id) being mistaken for a card.

%% explain
- **Key matching** is normalised and by containment, so `accessToken` and `Set-Cookie` are caught.
- **String patterns**: bearer tokens and Luhn-valid card numbers.
- **Deep, non-mutating copy**; cycles marked; `__proto__` safe.

%% nudge
- Why use `Object.fromEntries` rather than assigning `out[key] = ...`?
- Why track the current path (add, then delete) instead of every object ever seen?

%% starter
```js
export function redact(value, { keys } = {}) {
  return value;
}
```

%% tests
```js
describe('redact', () => {
  it('redacts sensitive keys', () => {
    expect(redact({ user: 'ada', password: 'hunter2', token: 'abc' })).toEqual({ user: 'ada', password: '[REDACTED]', token: '[REDACTED]' });
  });
  it('matches key names after normalising, by containment', () => {
    const input = { API_KEY: 'a', 'api-key': 'b', accessToken: 'c', Authorization: 'd', 'Set-Cookie': 'e', 'x-auth-token': 'f', userPassword: 'g', username: 'ada', author: 'bo' };
    expect(redact(input)).toEqual({
      API_KEY: '[REDACTED]', 'api-key': '[REDACTED]', accessToken: '[REDACTED]', Authorization: '[REDACTED]',
      'Set-Cookie': '[REDACTED]', 'x-auth-token': '[REDACTED]', userPassword: '[REDACTED]', username: 'ada', author: 'bo',
    });
  });
  it('replaces the whole value, whatever its type', () => {
    expect(redact({ secret: { a: 1, b: [2] }, token: 12345, password: null })).toEqual({ secret: '[REDACTED]', token: '[REDACTED]', password: '[REDACTED]' });
  });
  it('works through nested objects and arrays', () => {
    const out = redact({ users: [{ name: 'a', password: 'x' }, { name: 'b', nested: { cookie: 'c', ok: 1 } }] });
    expect(out).toEqual({ users: [{ name: 'a', password: '[REDACTED]' }, { name: 'b', nested: { cookie: '[REDACTED]', ok: 1 } }] });
  });
  it('redacts bearer tokens in strings', () => {
    expect(redact({ msg: 'request failed for Bearer abc.DEF-123_x~y+z/w= now' })).toEqual({ msg: 'request failed for Bearer [REDACTED] now' });
    expect(redact('bearer secrettoken')).toBe('Bearer [REDACTED]');
    expect(redact(['x BEARER t1 y'])).toEqual(['x Bearer [REDACTED] y']);
  });
  it('redacts Luhn-valid card numbers only', () => {
    expect(redact({ note: 'card 4111 1111 1111 1111 expires' })).toEqual({ note: 'card [REDACTED_CARD] expires' });
    expect(redact({ note: '4111-1111-1111-1111' })).toEqual({ note: '[REDACTED_CARD]' });
    expect(redact({ note: 'paid with 5500000000000004' })).toEqual({ note: 'paid with [REDACTED_CARD]' });
    expect(redact({ note: 'order 1234567812345678' })).toEqual({ note: 'order 1234567812345678' });
    expect(redact({ note: 'phone 555 1234' })).toEqual({ note: 'phone 555 1234' });
    expect(redact({ note: 'a 378282246310005 b' })).toEqual({ note: 'a [REDACTED_CARD] b' });
  });
  it('lets you supply your own keys', () => {
    expect(redact({ pin: '1234', password: 'visible' }, { keys: ['pin'] })).toEqual({ pin: '[REDACTED]', password: 'visible' });
  });
  it('never modifies the input', () => {
    const input = { password: 'x', list: [{ token: 't' }], note: 'Bearer abc' };
    const copy = JSON.parse(JSON.stringify(input));
    const out = redact(input);
    expect(input).toEqual(copy);
    expect(out).not.toBe(input);
    expect(out.list).not.toBe(input.list);
  });
  it('handles circular references', () => {
    const a = { name: 'a' };
    a.self = a;
    a.child = { parent: a };
    const out = redact(a);
    expect(out.self).toBe('[Circular]');
    expect(out.child.parent).toBe('[Circular]');
    expect(out.name).toBe('a');
  });
  it('allows the same object to appear twice without calling it circular', () => {
    const shared = { ok: 1 };
    expect(redact({ a: shared, b: shared })).toEqual({ a: { ok: 1 }, b: { ok: 1 } });
  });
  it('passes primitives and other objects through', () => {
    const date = new Date(0);
    expect(redact(5)).toBe(5);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(true)).toBe(true);
    expect(redact({ when: date }).when).toBe(date);
  });
  it('does not let a __proto__ key change the copy prototype', () => {
    const evil = JSON.parse('{"__proto__": {"isAdmin": true}, "ok": 1}');
    const out = redact(evil);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(out.isAdmin).toBeUndefined();
    expect(out.ok).toBe(1);
  });
});
```

%% hints
- `const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');`
- `sensitive.some((s) => s && norm(key).includes(norm(s)))`.
- Strings: first the bearer regex, then `/\b(?:\d[ -]?){12,18}\d\b/g` with a replacer that strips separators, checks length 13–19 and Luhn.
- Track the current path with a `Set`, deleting on the way out.

%% solution
```js
const DEFAULT_KEYS = ['password', 'passwd', 'secret', 'token', 'apikey', 'authorization', 'cookie', 'creditcard', 'cardnumber', 'cvv', 'ssn'];
const norm = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');

function luhn(digits) {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

function cleanString(text) {
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:\d[ -]?){12,18}\d\b/g, (match) => {
      const digits = match.replace(/[ -]/g, '');
      return digits.length >= 13 && digits.length <= 19 && luhn(digits) ? '[REDACTED_CARD]' : match;
    });
}

export function redact(value, { keys = DEFAULT_KEYS } = {}) {
  const sensitive = keys.map(norm).filter(Boolean);
  const path = new Set();
  const isPlain = (v) => Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null;

  function walk(v) {
    if (typeof v === 'string') return cleanString(v);
    if (v === null || typeof v !== 'object') return v;
    const array = Array.isArray(v);
    if (!array && !isPlain(v)) return v;
    if (path.has(v)) return '[Circular]';
    path.add(v);
    const out = array
      ? v.map(walk)
      : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sensitive.some((s) => norm(k).includes(s)) ? '[REDACTED]' : walk(x)]));
    path.delete(v);
    return out;
  }
  return walk(value);
}
```

%% exercise sec-check-filename | Tests for safeFilename | 4 | js | js | checkSafeFilename | 34
`safeFilename(name, { maxLength = 100 } = {})` turns an uploaded file name into a safe one: it keeps only the part after the last `/` or `\`, removes control characters (including the null byte), replaces each of `< > : " | ? *` with `_`, collapses whitespace runs to one `_`, strips leading and trailing dots, prefixes `_` to Windows device names (`CON`, `NUL`, `COM1`…, judged on the part before the first dot), returns `'file'` for an empty result, and shortens names longer than `maxLength` while **keeping a short extension**. Write `checkSafeFilename(safeFilename)` that passes for a correct one and **fails** for: **keeps path components**, **ignores backslashes**, **keeps leading dots**, **keeps Windows device names**, **keeps control characters**, **keeps forbidden characters**, **has no length limit**, **returns empty names**, **cuts off the extension when shortening**.

```js
expect(safeFilename('../../etc/passwd')).toBe('passwd');
```

%% worked
**A similar problem, solved: `checkSafeUsername(safeUsername)`** — each rule gets an input where **only that rule** matters.

```js
export function checkSafeUsername(safeUsername) {           // lower-case, only a-z0-9_, max 8 chars, never empty
  expect(safeUsername('ada_99')).toBe('ada_99');            // ① nothing to change: a "clean everything" mutant fails here
  expect(safeUsername('ADA')).toBe('ada');                  // ② case rule alone
  expect(safeUsername('a d-a')).toBe('a_d_a');              // ③ forbidden characters alone
  expect(safeUsername('abcdefghijkl')).toBe('abcdefgh');    // ④ length rule alone
  expect(safeUsername('')).toBe('user');                    // ⑤ empty rule alone
  expect(safeUsername('???')).toBe('___');                  // ⑥ "all characters forbidden" is not the same as "empty"
}
```

When a function applies **several rules in sequence**, test each rule with an input that **doesn't trigger the others**. Then a failure points at one rule, and a mutant missing one rule is caught by exactly one assertion. Add a **don't-over-clean** case (an already-clean input must come back unchanged).

%% explain
- **Clean input unchanged**, including a normal extension.
- **Paths**: `/`, `\`, `../`, absolute.
- **Characters**: null byte and other control characters, each forbidden character, whitespace.
- **Dots and devices**: leading dots, trailing dots, `CON`/`nul`/`com1`, but not `console`.
- **Empty and length**: `''`, `'...'`, long name with extension.

%% nudge
- Which assertion fails if the implementation leaves `\` alone but strips `/`?
- How do you check that the extension survives shortening?

%% starter
```js
export function checkSafeFilename(safeFilename) {
  expect(safeFilename('report.pdf')).toBe('report.pdf');
  expect(safeFilename('../../etc/passwd')).toBe('passwd');
  // your assertions: backslashes, dots, control characters, forbidden characters, device names, empty, length
}
```

%% tests
```js
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const make = ({ keepPath = false, backslash = true, keepDots = false, keepReserved = false, keepControl = false, keepForbidden = false, noLimit = false, keepEmpty = false, loseExt = false } = {}) => (name, { maxLength = 100 } = {}) => {
  let s = String(name ?? '');
  if (!keepPath) {
    s = s.slice(s.lastIndexOf('/') + 1);
    if (backslash) s = s.slice(s.lastIndexOf('\\') + 1);
  }
  if (!keepControl) s = s.replace(/[\u0000-\u001f\u007f]/g, '');
  if (!keepForbidden) s = s.replace(/[<>:"|?*\\\/]/g, '_');
  s = s.replace(/\s+/g, '_');
  if (!keepDots) s = s.replace(/^\.+/, '');
  s = s.replace(/\.+$/, '');
  if (!keepReserved && RESERVED.test(s.split('.')[0])) s = '_' + s;
  if (!keepEmpty && s === '') s = 'file';
  if (!noLimit && s.length > maxLength) {
    const dot = s.lastIndexOf('.');
    if (!loseExt && dot > 0 && s.length - dot <= 10) s = s.slice(0, maxLength - (s.length - dot)) + s.slice(dot);
    else s = s.slice(0, maxLength);
  }
  return s;
};
const correct = make();
const mutants = {
  'keeps path components': make({ keepPath: true }),
  'ignores backslashes': make({ backslash: false }),
  'keeps leading dots': make({ keepDots: true }),
  'keeps Windows device names': make({ keepReserved: true }),
  'keeps control characters': make({ keepControl: true }),
  'keeps forbidden characters': make({ keepForbidden: true }),
  'has no length limit': make({ noLimit: true }),
  'returns empty names': make({ keepEmpty: true }),
  'cuts off the extension when shortening': make({ loseExt: true }),
};

describe('your checkSafeFilename', () => {
  it('passes on a correct safeFilename', () => {
    expect(() => checkSafeFilename(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a safeFilename that ${name}`, () => {
      expect(() => checkSafeFilename(impl)).toThrow();
    });
  }
});
```

%% hints
- Clean: `'report.pdf'`, `'my file.png'` → `'my_file.png'`.
- Paths: `'../../etc/passwd'` → `'passwd'`, `'C:\\Users\\a\\x.txt'` → `'x.txt'`, `'..\\..\\boot.ini'` → `'boot.ini'`.
- Characters: `'a\0b.txt'` → `'ab.txt'`, `'a<b>.txt'` → `'a_b_.txt'`.
- Devices: `'CON.txt'` → `'_CON.txt'`, `'nul'` → `'_nul'`, but `'console.txt'` unchanged.
- Length: `'a'.repeat(200) + '.png'` with `{ maxLength: 20 }` has length 20 and ends with `.png`.

%% solution
```js
export function checkSafeFilename(safeFilename) {
  expect(safeFilename('report.pdf')).toBe('report.pdf');
  expect(safeFilename('archive.tar.gz')).toBe('archive.tar.gz');
  expect(safeFilename('my file.png')).toBe('my_file.png');

  expect(safeFilename('../../etc/passwd')).toBe('passwd');
  expect(safeFilename('/etc/passwd')).toBe('passwd');
  expect(safeFilename('C:\\Users\\a\\x.txt')).toBe('x.txt');
  expect(safeFilename('..\\..\\boot.ini')).toBe('boot.ini');

  expect(safeFilename('a\0b.txt')).toBe('ab.txt');
  expect(safeFilename('a<b>.txt')).toBe('a_b_.txt');
  expect(safeFilename('a:b|c?d*e.txt')).toBe('a_b_c_d_e.txt');

  expect(safeFilename('.htaccess')).toBe('htaccess');
  expect(safeFilename('...hidden.txt')).toBe('hidden.txt');

  expect(safeFilename('CON.txt')).toBe('_CON.txt');
  expect(safeFilename('nul')).toBe('_nul');
  expect(safeFilename('com1.png')).toBe('_com1.png');
  expect(safeFilename('console.txt')).toBe('console.txt');

  expect(safeFilename('')).toBe('file');
  expect(safeFilename('...')).toBe('file');

  const shortened = safeFilename('a'.repeat(200) + '.png', { maxLength: 20 });
  expect(shortened.length).toBe(20);
  expect(shortened.endsWith('.png')).toBe(true);
  expect(safeFilename('b'.repeat(200)).length).toBe(100);
}
```
