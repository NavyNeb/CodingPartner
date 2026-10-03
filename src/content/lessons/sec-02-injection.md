---
id: sec-injection
track: sec
title: Injection, paths & untrusted input
summary: Keeping data from becoming code or commands: parameterized queries, path traversal and prefix-check mistakes, prototype pollution, and open redirects, with the principle behind them all.
---

## The idea in one sentence

**Injection** happens whenever you build a *command* (a query, a path, a shell line, an object merge) by **mixing untrusted data into the command's own text**. The cure is always to **keep the two channels separate**.

> **Analogy** A form that says "Pay to the order of ____". If you let someone write "Ada, and also give them my house", the bank can't tell where the payee ends and the instructions begin. A safe form has a **box for the name** that is only ever read as a name.

The family has many members (SQL, shell, LDAP, template, path, header, prototype), but the idea is one: **code and data must not share a channel**.

## SQL injection and parameterized queries

![String concatenation versus parameters](fig:sec-injection "In a parameterized query the value can never change the shape of the query.")

When the query text is **concatenated**, a value like `' OR '1'='1` changes what the query *means*. With **parameters** the database receives the query **text with placeholders** and the **values separately**: values are only ever data.

```js try predict
// A tagged template that turns interpolations into placeholders
function sql(strings, ...values) {
  let text = strings[0];
  values.forEach((_, i) => { text += '$' + (i + 1) + strings[i + 1]; });
  return { text, values };
}

const name = "x' OR '1'='1";
console.log(sql`SELECT * FROM users WHERE name = ${name} AND active = ${true}`);
```

The malicious text is just an **element of `values`**; it is never part of `text`. Two things you can't parameterize: **identifiers** (table and column names) and **keywords** like `ASC`/`DESC`. For those, **allowlist** exact known values or validate against a strict pattern.

## Path traversal

Serving a file named by the user? `../` segments climb out of your folder.

![Path traversal](fig:sec-traversal "Resolve first, then verify the result is still inside the base, comparing whole segments.")

Classic mistakes:

- **Checking for `..` in the raw string** (and missing `..\` on Windows, or encoded forms).
- **A string prefix check**: `/var/www/uploads-old/x` *starts with* `/var/www/uploads`, but it isn't inside it.
- **Absolute parts**: `path.join('/base', '/etc/passwd')` is fine, but `path.resolve` would return `/etc/passwd`.
- **Null bytes** truncating a path in lower layers.

The robust recipe is **normalise the path yourself** (process each segment, `..` pops one level, never above the base), treat **both slashes** as separators, and **reject** anything that tries to leave.

```js try
function safeJoin(base, ...parts) {
  const stack = [];
  for (const part of parts) {
    if (/^[\/\\]/.test(part)) throw new Error('path escapes base');
    for (const seg of part.split(/[\/\\]+/)) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') { if (!stack.length) throw new Error('path escapes base'); stack.pop(); }
      else stack.push(seg);
    }
  }
  return [base.replace(/\/+$/, ''), ...stack].join('/');
}
console.log(safeJoin('/var/www', 'img', 'a/../b.png'));
try { safeJoin('/var/www', '../etc/passwd'); } catch (e) { console.log(e.message); }
```

## Prototype pollution

JavaScript objects inherit from `Object.prototype`. A naive **deep merge** that copies keys from untrusted JSON can be tricked into writing through `__proto__` (or `constructor.prototype`), changing **every object in the program**.

![Prototype pollution](fig:sec-pollution "One shared prototype means one write affects everything.")

```stepper A naive merge goes wrong
code:
  function merge(target, source) {
    for (const key in source) {
      if (typeof source[key] === 'object') merge(target[key], source[key]);
      else target[key] = source[key];
    }
  }
  merge({}, JSON.parse('{"__proto__": {"isAdmin": true}}'));
---
line: 7
say: `JSON.parse` creates an **own property literally named `__proto__`** (it isn't the magic accessor here), holding `{ isAdmin: true }`.
source: { "__proto__": { isAdmin: true } }
---
line: 3
say: The merge recurses with `target['__proto__']`. On a normal object, reading `__proto__` returns **`Object.prototype`**, the shared parent of all objects.
target[key]: Object.prototype
---
line: 4
say: It then **assigns `isAdmin = true` onto `Object.prototype`**. Now `({}).isAdmin` is `true`, and so is `user.isAdmin` for every user object. A permission check like `if (user.isAdmin)` has just been bypassed.
({}).isAdmin: true
```

Defences: **skip** the dangerous keys (`__proto__`, `constructor`, `prototype`), merge into **`Object.create(null)`** objects, use **`Map`**, check `hasOwnProperty`, and validate untrusted JSON against a schema.

## Open redirects

`/login?next=https://evil.example` followed blindly turns your trusted domain into a phishing launcher. Only redirect to **same-site paths** (`/x`, **not** `//x` or `/\x`) or to hosts in an **allowlist**, parsed with `URL` (never with string checks: `https://good.com@evil.com` has host `evil.com`).

## Quick check

```check
Q: Why do parameterized queries prevent SQL injection?
A) They encrypt the query
B) The query text and the values are sent separately, so values can never be parsed as SQL *
C) They run faster
D) They escape quotes inside the database
Why: The database compiles the text with placeholders; values fill them in as pure data.
---
Q: What can't be a query parameter?
A) Strings
B) Table and column names (identifiers): allowlist those *
C) Numbers
D) Booleans
Why: Placeholders stand for values, not for parts of the SQL structure.
---
Q: Why is `resolved.startsWith(base)` a flawed containment check?
A) It is too slow
B) `/var/www/uploads-old` starts with `/var/www/uploads` but is outside it: compare whole path segments *
C) It ignores case
D) It is fine
Why: A string prefix isn't a directory boundary.
---
Q: What makes prototype pollution possible?
A) Using arrays
B) A merge that writes through `__proto__` into the shared `Object.prototype` *
C) Using classes
D) Large objects
Why: Everything inherits from that one object, so one write affects all.
---
Q: How should you parse a redirect target to check its host?
A) With `indexOf`
B) With `new URL(...)` and compare `host`, rejecting credentials and non-http(s) schemes *
C) With a regex for `.com`
D) You can't
Why: Parsers agree with the browser; string checks get fooled by `good.com@evil.com`.
```

## Recap

- **Injection** = untrusted data mixed into command text. **Separate the channels**.
- SQL: **parameters** for values, **allowlists** for identifiers and keywords.
- Paths: normalise, treat both slashes the same, reject escapes, compare **segments** not string prefixes.
- Prototype pollution: skip `__proto__`/`constructor`/`prototype`; use null-prototype objects or `Map`.
- Redirects: same-site paths or an **allowlisted host**, parsed with `URL`.
- You can **write tests that prove** these defences, which later exercises grade.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a `sql` tag | Joining template strings with `$1`, `$2`… |
| A safer SQL builder | Nested fragments, renumbering, identifier validation |
| A safe path join | Segment normalisation, both slashes, errors on escape |
| A safe deep merge | Key skipping, own-property checks, plain-object detection |
| A safe redirect | The `URL` class, host allowlists, credentials |
| Tests for safeJoin | Escapes, prefix confusion, backslashes, null bytes |

%% exercise sec-guided-sql | Guided: a sql tag | 1 | js | js | sql | 8 | guided
Implement a **tagged template** `sql`. It returns `{ text, values }`: `text` is the template with each interpolation replaced by a numbered placeholder `$1`, `$2`, …, and `values` is the array of interpolated values **in order**.

```js
const id = 7;
sql`SELECT * FROM users WHERE id = ${id}`; // { text: 'SELECT * FROM users WHERE id = $1', values: [7] }
```

%% worked
**A similar problem, solved: `sqliteQuery`** — the same tag with `?` placeholders.

```js
export function sqliteQuery(strings, ...values) {
  const text = strings.reduce((out, part, i) => out + part + (i < values.length ? '?' : ''), '');   // ① placeholders go where the values were
  return { text, values };                                                                           // ② the values travel separately
}
```

The tag function receives the literal pieces (`strings`) and the interpolated `values` **separately**: exactly the two channels you want to keep apart. Never join the values into the text.

%% explain
- **`strings`** are the fixed text pieces; **`values`** the interpolations.
- **Numbered placeholders** `$1`… replace each interpolation.
- **Values** are returned untouched, in order.

%% nudge
- How many placeholders does a template with three interpolations need?
- What must never end up inside `text`?

%% starter
```js
export function sql(strings, ...values) {
  // Step 1 — build text from strings, inserting '$' + (i + 1) between pieces
  // Step 2 — return { text, values }
  return { text: '', values: [] };
}
```

%% tests
```js
describe('sql', () => {
  it('numbers the placeholders and keeps values separate', () => {
    const q = sql`SELECT * FROM users WHERE id = ${7} AND name = ${'Ada'}`;
    expect(q.text).toBe('SELECT * FROM users WHERE id = $1 AND name = $2');
    expect(q.values).toEqual([7, 'Ada']);
  });
  it('never puts values in the text', () => {
    const evil = "x' OR '1'='1";
    const q = sql`SELECT * FROM t WHERE name = ${evil}`;
    expect(q.text).toBe('SELECT * FROM t WHERE name = $1');
    expect(q.text).not.toContain('OR');
    expect(q.values).toEqual([evil]);
  });
  it('works with no values', () => {
    const q = sql`SELECT 1`;
    expect(q).toEqual({ text: 'SELECT 1', values: [] });
  });
  it('keeps value types', () => {
    const q = sql`INSERT INTO t VALUES (${null}, ${true}, ${3.5})`;
    expect(q.values).toEqual([null, true, 3.5]);
    expect(q.text).toBe('INSERT INTO t VALUES ($1, $2, $3)');
  });
  it('handles an interpolation at the very start or end', () => {
    expect(sql`${1}`.text).toBe('$1');
    expect(sql`a ${1}`.text).toBe('a $1');
  });
});
```

%% hints
- `strings.reduce((out, part, i) => out + part + (i < values.length ? '$' + (i + 1) : ''), '')`

%% solution
```js
export function sql(strings, ...values) {
  const text = strings.reduce((out, part, i) => out + part + (i < values.length ? '$' + (i + 1) : ''), '');
  return { text, values };
}
```

%% exercise sec-sql-builder | A safer SQL builder | 4 | js | js | sql | 30
Extend `sql` so queries can be **composed** without ever putting values into the text. `sql` is a tagged template returning an object with `.text` and `.values`.

- Interpolating a **value** gives a numbered placeholder `$n`; `n` counts across the whole final query.
- Interpolating **another `sql` result** (a fragment) inlines its text and its values, **renumbering** the placeholders to fit.
- An interpolated `undefined` throws `Error('undefined is not a valid SQL parameter')`; an **array** throws `Error('use sql.list for arrays')`.
- `sql.join(fragments, separator = ', ')` joins fragments (the separator is **plain text**, not a parameter).
- `sql.list(values)` makes `$1, $2, …` for each value (for `IN (...)`); an empty array throws `Error('empty list')`.
- `sql.ident(name)` is a quoted identifier `"name"`; only `/^[A-Za-z_][A-Za-z0-9_]*$/` is accepted, anything else throws `Error('invalid identifier: NAME')`.

```js
const where = sql`status = ${'open'}`;
sql`SELECT * FROM ${sql.ident('tasks')} WHERE ${where} AND id IN (${sql.list([1, 2])})`;
// text: 'SELECT * FROM "tasks" WHERE status = $1 AND id IN ($2, $3)', values: ['open', 1, 2]
```

%% worked
**A similar problem, solved: a fragment type with deferred numbering.**

```js
class Frag {
  constructor(chunks) { this.chunks = chunks; }              // ① strings and { value } markers, NOT yet numbered
  get text() { let n = 0; return this.chunks.map((c) => (typeof c === 'string' ? c : '$' + ++n)).join(''); }   // ② number only at the end
  get values() { return this.chunks.filter((c) => typeof c !== 'string').map((c) => c.value); }
}
```

Numbering **at the end** is what makes composition easy: a fragment doesn't need to know where it will be placed. To inline a fragment into another, just copy its `chunks`. For `ident`, validate against a strict pattern and wrap in double quotes: identifiers can't be parameters, so you **restrict** them instead.

%% explain
- **A class** holding chunks (text pieces and value markers); `text` numbers them on demand.
- **Nesting** copies the inner chunks, so numbering stays consistent.
- **Guards** for `undefined` and arrays.
- **`join`, `list`, `ident`** build on the same chunks.

%% nudge
- Why is it easier to number placeholders at the end than as you go?
- Why is an identifier validated rather than parameterized?

%% starter
```js
export function sql(strings, ...values) {
  return { text: '', values: [] };
}
sql.join = (fragments, separator = ', ') => sql``;
sql.list = (values) => sql``;
sql.ident = (name) => sql``;
```

%% tests
```js
describe('sql builder', () => {
  it('numbers value placeholders', () => {
    const q = sql`SELECT * FROM t WHERE a = ${1} AND b = ${'x'}`;
    expect(q.text).toBe('SELECT * FROM t WHERE a = $1 AND b = $2');
    expect(q.values).toEqual([1, 'x']);
  });
  it('inlines fragments and renumbers across the whole query', () => {
    const where = sql`status = ${'open'} AND owner = ${7}`;
    const q = sql`SELECT * FROM t WHERE id > ${0} AND ${where} LIMIT ${10}`;
    expect(q.text).toBe('SELECT * FROM t WHERE id > $1 AND status = $2 AND owner = $3 LIMIT $4');
    expect(q.values).toEqual([0, 'open', 7, 10]);
  });
  it('supports deeply nested fragments', () => {
    const inner = sql`b = ${2}`;
    const middle = sql`a = ${1} AND ${inner}`;
    const q = sql`WHERE ${middle} AND c = ${3}`;
    expect(q.text).toBe('WHERE a = $1 AND b = $2 AND c = $3');
    expect(q.values).toEqual([1, 2, 3]);
  });
  it('does not mutate a fragment used twice', () => {
    const frag = sql`x = ${1}`;
    const a = sql`${frag} OR ${frag}`;
    expect(a.text).toBe('x = $1 OR x = $2');
    expect(a.values).toEqual([1, 1]);
    expect(frag.text).toBe('x = $1');
  });
  it('joins fragments with plain-text separators', () => {
    const parts = [sql`a = ${1}`, sql`b = ${2}`, sql`c = ${3}`];
    const q = sql`WHERE ${sql.join(parts, ' AND ')}`;
    expect(q.text).toBe('WHERE a = $1 AND b = $2 AND c = $3');
    expect(q.values).toEqual([1, 2, 3]);
    expect(sql.join([sql`x`, sql`y`]).text).toBe('x, y');
    expect(sql.join([]).text).toBe('');
  });
  it('builds IN lists', () => {
    const q = sql`SELECT * FROM t WHERE id IN (${sql.list([5, 6, 7])}) AND ok = ${true}`;
    expect(q.text).toBe('SELECT * FROM t WHERE id IN ($1, $2, $3) AND ok = $4');
    expect(q.values).toEqual([5, 6, 7, true]);
    expect(() => sql.list([])).toThrow('empty list');
  });
  it('quotes valid identifiers only', () => {
    expect(sql`SELECT * FROM ${sql.ident('users_2')}`.text).toBe('SELECT * FROM "users_2"');
    for (const bad of ['users; DROP TABLE x', 'a.b', 'a b', '1abc', '', 'x"y', "x'y"]) {
      expect(() => sql.ident(bad)).toThrow('invalid identifier: ' + bad);
    }
  });
  it('rejects undefined and arrays as parameters', () => {
    expect(() => sql`a = ${undefined}`).toThrow('undefined is not a valid SQL parameter');
    expect(() => sql`a IN (${[1, 2]})`).toThrow('use sql.list for arrays');
  });
  it('accepts null and other falsy values as parameters', () => {
    const q = sql`${null} ${0} ${''} ${false}`;
    expect(q.values).toEqual([null, 0, '', false]);
  });
  it('never puts values in the text', () => {
    const q = sql`SELECT * FROM t WHERE name = ${"x' OR '1'='1"}`;
    expect(q.text).toBe('SELECT * FROM t WHERE name = $1');
  });
});
```

%% hints
- `class Sql { constructor(chunks) { this.chunks = chunks; } get text() {...} get values() {...} }`
- In `sql`: push `strings[i]`, then for a value: another `Sql` → push its `chunks`; else push `{ value }`.
- `join`: interleave `sep` strings between the fragments' chunks. `list`: `join(values.map((v) => sql\`${v}\`))`.

%% solution
```js
class Sql {
  constructor(chunks) {
    this.chunks = chunks;
  }
  get text() {
    let n = 0;
    return this.chunks.map((c) => (typeof c === 'string' ? c : '$' + ++n)).join('');
  }
  get values() {
    return this.chunks.filter((c) => typeof c !== 'string').map((c) => c.value);
  }
}

export function sql(strings, ...values) {
  const chunks = [];
  strings.forEach((part, i) => {
    chunks.push(part);
    if (i >= values.length) return;
    const v = values[i];
    if (v instanceof Sql) chunks.push(...v.chunks);
    else if (v === undefined) throw new Error('undefined is not a valid SQL parameter');
    else if (Array.isArray(v)) throw new Error('use sql.list for arrays');
    else chunks.push({ value: v });
  });
  return new Sql(chunks);
}

sql.join = (fragments, separator = ', ') =>
  new Sql(fragments.flatMap((f, i) => (i === 0 ? [...f.chunks] : [separator, ...f.chunks])));

sql.list = (values) => {
  if (values.length === 0) throw new Error('empty list');
  return sql.join(values.map((v) => sql`${v}`));
};

sql.ident = (name) => {
  if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('invalid identifier: ' + name);
  return new Sql([`"${name}"`]);
};
```

%% exercise sec-safe-join | A safe path join | 3 | js | js | safeJoin | 22
Implement `safeJoin(base, ...parts)` for a **POSIX-style absolute `base`** such as `/var/www`. It returns the normalised path **inside** `base`, or throws.

- Both `/` and `\` separate segments. Empty and `.` segments are dropped; `..` removes the previous segment.
- A `..` that would climb **above `base`** throws `Error('path escapes base')`, even if it would land in a sibling like `/var/www-old`.
- A part that **starts with** `/` or `\` (absolute) throws `Error('path escapes base')`.
- A non-string part, or one containing a **null byte** (`\0`), throws `Error('invalid path')`.
- Percent-encoded text such as `%2e%2e` is **not decoded** (it is an ordinary segment).
- A trailing slash on `base` is ignored. With no parts it returns `base` without the trailing slash (and `/` for a root base).

```js
safeJoin('/var/www', 'img', 'a/../b.png'); // '/var/www/img/b.png'
safeJoin('/var/www', '../etc/passwd');     // throws 'path escapes base'
```

%% worked
**A similar problem, solved: `safeSubpath(parts)`** — a stack of segments that may never go below empty.

```js
export function safeSubpath(...parts) {
  const stack = [];
  for (const part of parts) {
    for (const seg of part.split(/[\/\\]+/)) {
      if (seg === '' || seg === '.') continue;                       // ① ignore no-ops
      if (seg === '..') {
        if (stack.length === 0) throw new Error('path escapes base'); // ② never climb above the start
        stack.pop();
      } else stack.push(seg);
    }
  }
  return stack.join('/');
}
```

A **stack** is the right model: pushing a segment goes deeper, `..` pops one level, and popping an empty stack means "above the base". That also avoids the string-prefix trap, because you never compare path strings at all.

%% explain
- **Segments** split on both slashes; `.` and empty ones are skipped.
- **A stack** tracks depth; popping an empty stack is an escape.
- **Absolute parts, null bytes, non-strings** are rejected up front.
- **Output** is `base` + the stack, joined with `/`.

%% nudge
- Why does a stack make a prefix check unnecessary?
- Which characters should count as separators?

%% starter
```js
export function safeJoin(base, ...parts) {
  // validate each part, then process its segments with a stack
  return base;
}
```

%% tests
```js
describe('safeJoin', () => {
  it('joins and normalises', () => {
    expect(safeJoin('/var/www', 'img', 'a.png')).toBe('/var/www/img/a.png');
    expect(safeJoin('/var/www/', 'a//b/./c')).toBe('/var/www/a/b/c');
    expect(safeJoin('/var/www', 'a/../b')).toBe('/var/www/b');
    expect(safeJoin('/var/www', 'a', '..', 'b')).toBe('/var/www/b');
  });
  it('returns the base when there is nothing to add', () => {
    expect(safeJoin('/var/www')).toBe('/var/www');
    expect(safeJoin('/var/www/')).toBe('/var/www');
    expect(safeJoin('/var/www', 'a/..')).toBe('/var/www');
    expect(safeJoin('/var/www', '', '.')).toBe('/var/www');
    expect(safeJoin('/')).toBe('/');
    expect(safeJoin('/', 'a')).toBe('/a');
  });
  it('treats backslashes as separators', () => {
    expect(safeJoin('/var/www', 'a\\b')).toBe('/var/www/a/b');
    expect(() => safeJoin('/var/www', '..\\..\\etc')).toThrow('path escapes base');
  });
  it('refuses to climb above the base', () => {
    for (const bad of ['..', '../etc/passwd', 'a/../../etc', 'a/b/../../..', './../x']) {
      expect(() => safeJoin('/var/www', bad)).toThrow('path escapes base');
    }
  });
  it('refuses a climb into a sibling that shares a prefix', () => {
    expect(() => safeJoin('/var/www', '../www-evil/x')).toThrow('path escapes base');
  });
  it('refuses absolute parts', () => {
    expect(() => safeJoin('/var/www', '/etc/passwd')).toThrow('path escapes base');
    expect(() => safeJoin('/var/www', 'a', '/etc')).toThrow('path escapes base');
    expect(() => safeJoin('/var/www', '\\windows')).toThrow('path escapes base');
  });
  it('rejects null bytes and non-strings', () => {
    expect(() => safeJoin('/var/www', 'a\0b')).toThrow('invalid path');
    expect(() => safeJoin('/var/www', 5)).toThrow('invalid path');
    expect(() => safeJoin('/var/www', null)).toThrow('invalid path');
  });
  it('does not decode percent-encoding', () => {
    expect(safeJoin('/var/www', '%2e%2e/x')).toBe('/var/www/%2e%2e/x');
  });
  it('allows going down and back up within the base', () => {
    expect(safeJoin('/var/www', 'a/b/../../c/d')).toBe('/var/www/c/d');
  });
});
```

%% hints
- `for (const part of parts) { if (typeof part !== 'string' || part.includes('\0')) throw new Error('invalid path'); if (/^[\/\\]/.test(part)) throw ... }`
- `part.split(/[\/\\]+/)` then handle `''`, `'.'`, `'..'`.
- Result: `[base.replace(/\/+$/, ''), ...stack].join('/') || '/'`.

%% solution
```js
export function safeJoin(base, ...parts) {
  const stack = [];
  for (const part of parts) {
    if (typeof part !== 'string' || part.includes('\0')) throw new Error('invalid path');
    if (/^[\/\\]/.test(part)) throw new Error('path escapes base');
    for (const seg of part.split(/[\/\\]+/)) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') {
        if (stack.length === 0) throw new Error('path escapes base');
        stack.pop();
      } else {
        stack.push(seg);
      }
    }
  }
  return [base.replace(/\/+$/, ''), ...stack].join('/') || '/';
}
```

%% exercise sec-safe-merge | A safe deep merge | 3 | js | js | safeMerge, safeSet | 22
Implement two functions that handle **untrusted** keys safely.

- `safeMerge(target, source)` deep-merges **plain objects** from `source` into `target` and returns `target`. Plain objects merge recursively; **arrays and other values replace** (arrays are copied). The keys `__proto__`, `constructor` and `prototype` are **skipped** at every depth. Nothing may ever change `Object.prototype`.
- `safeSet(obj, path, value)` sets a nested value using a path string like `'a.b.c'` (or an array of keys), creating missing plain objects on the way, and returns `obj`. If **any** key is `__proto__`, `constructor` or `prototype` it throws `Error('unsafe key: KEY')` **before changing anything**. Existing **inherited** properties are never traversed: only own properties are followed.

```js
safeMerge({ a: { x: 1 } }, JSON.parse('{"a":{"y":2},"__proto__":{"isAdmin":true}}'));
// { a: { x: 1, y: 2 } }, and ({}).isAdmin stays undefined
```

%% worked
**A similar problem, solved: `defaults(target, source)`** — fill in missing keys, skipping dangerous ones.

```js
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);       // ① one place that names the bad keys
const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);   // ② only merge real plain objects

export function defaults(target, source) {
  for (const key of Object.keys(source)) {            // ③ own enumerable keys only
    if (UNSAFE.has(key)) continue;                    // ④ never touch the dangerous ones
    if (!(key in target)) target[key] = source[key];
  }
  return target;
}
```

`JSON.parse` makes `__proto__` an **own** key, so `Object.keys` lists it: that's why the explicit skip is needed. When recursing, check the **target's own** property (`Object.prototype.hasOwnProperty.call`) before treating it as an object to merge into; otherwise you might merge into something inherited.

%% explain
- **Unsafe keys** skipped (merge) or rejected (set).
- **Plain objects** recurse; arrays and others replace.
- **Own properties only**: never walk the prototype chain.
- **`safeSet` validates the whole path first** so a failure changes nothing.

%% nudge
- Why does `Object.keys` on parsed JSON include `__proto__`?
- Why validate every path key before creating anything in `safeSet`?

%% starter
```js
export function safeMerge(target, source) {
  return target;
}

export function safeSet(obj, path, value) {
  return obj;
}
```

%% tests
```js
afterEach(() => {
  delete Object.prototype.polluted;
  delete Object.prototype.isAdmin;
});

describe('safeMerge', () => {
  it('merges nested plain objects', () => {
    const target = { a: { x: 1 }, keep: true };
    const result = safeMerge(target, { a: { y: 2 }, b: { z: 3 } });
    expect(result).toBe(target);
    expect(target).toEqual({ a: { x: 1, y: 2 }, keep: true, b: { z: 3 } });
  });
  it('replaces arrays and primitives', () => {
    const target = { list: [1, 2, 3], n: 1, o: { a: 1 } };
    safeMerge(target, { list: [9], n: 2, o: 'text' });
    expect(target).toEqual({ list: [9], n: 2, o: 'text' });
  });
  it('copies arrays rather than sharing them', () => {
    const source = { list: [1, 2] };
    const target = safeMerge({}, source);
    source.list.push(3);
    expect(target.list).toEqual([1, 2]);
  });
  it('does not share nested objects with the source', () => {
    const source = { a: { b: 1 } };
    const target = safeMerge({}, source);
    source.a.b = 2;
    expect(target.a.b).toBe(1);
  });
  it('ignores __proto__ and never pollutes Object.prototype', () => {
    const evil = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}');
    const target = safeMerge({}, evil);
    expect(({}).polluted).toBeUndefined();
    expect(target.polluted).toBeUndefined();
    expect(target.ok).toBe(1);
  });
  it('ignores nested __proto__ keys', () => {
    safeMerge({ a: {} }, JSON.parse('{"a": {"__proto__": {"polluted": true}}}'));
    expect(({}).polluted).toBeUndefined();
  });
  it('ignores constructor.prototype tricks', () => {
    safeMerge({}, JSON.parse('{"constructor": {"prototype": {"polluted": true}}}'));
    expect(({}).polluted).toBeUndefined();
    expect(Object.prototype.polluted).toBeUndefined();
  });
  it('does not merge into inherited properties', () => {
    const target = {};
    safeMerge(target, { toString: { x: 1 } });
    expect(Object.prototype.toString.x).toBeUndefined();
  });
  it('merges into objects without a prototype', () => {
    const target = Object.create(null);
    safeMerge(target, { a: { b: 1 } });
    expect(target.a.b).toBe(1);
  });
});

describe('safeSet', () => {
  it('sets nested paths, creating objects', () => {
    const obj = {};
    expect(safeSet(obj, 'a.b.c', 1)).toBe(obj);
    expect(obj).toEqual({ a: { b: { c: 1 } } });
    safeSet(obj, ['a', 'd'], 2);
    expect(obj.a).toEqual({ b: { c: 1 }, d: 2 });
  });
  it('overwrites non-object values on the way', () => {
    const obj = { a: 5 };
    safeSet(obj, 'a.b', 1);
    expect(obj).toEqual({ a: { b: 1 } });
  });
  it('rejects unsafe keys before changing anything', () => {
    for (const path of ['__proto__.polluted', 'a.__proto__.polluted', 'constructor.prototype.polluted', ['a', 'prototype', 'x']]) {
      const obj = {};
      expect(() => safeSet(obj, path, true)).toThrow(/^unsafe key: /);
      expect(obj).toEqual({});
    }
    expect(({}).polluted).toBeUndefined();
  });
  it('names the offending key', () => {
    expect(() => safeSet({}, 'a.__proto__.b', 1)).toThrow('unsafe key: __proto__');
  });
  it('does not follow inherited properties', () => {
    const obj = {};
    safeSet(obj, 'toString.x', 1);
    expect(Object.prototype.toString.x).toBeUndefined();
    expect(obj.toString.x).toBe(1);
  });
});
```

%% hints
- `const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);`
- Merge: for each own key not in `UNSAFE`: if `isPlain(source[key])`, ensure `target[key]` is an own plain object (else make `{}`) and recurse.
- `safeSet`: `const keys = Array.isArray(path) ? path : path.split('.')`; check all keys first; walk with `Object.prototype.hasOwnProperty.call(cur, k) && isObject(cur[k])`.

%% solution
```js
const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isPlain = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

export function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (UNSAFE.has(key)) continue;
    const value = source[key];
    if (isPlain(value)) {
      if (!has(target, key) || !isPlain(target[key])) target[key] = {};
      safeMerge(target[key], value);
    } else {
      target[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  return target;
}

export function safeSet(obj, path, value) {
  const keys = Array.isArray(path) ? path.map(String) : String(path).split('.');
  for (const key of keys) {
    if (UNSAFE.has(key)) throw new Error('unsafe key: ' + key);
  }
  let current = obj;
  keys.slice(0, -1).forEach((key) => {
    if (!has(current, key) || current[key] === null || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  });
  current[keys[keys.length - 1]] = value;
  return obj;
}
```

%% exercise sec-safe-redirect | A safe redirect | 3 | js | js | safeRedirect | 20
Implement `safeRedirect(target, { allowedHosts = [], fallback = '/' } = {})`. After a login, an app may redirect to a `next` address the user supplied. Return `target` **only if it is safe**, otherwise `fallback`.

1. A non-string, or an empty string after cleaning, gives `fallback`. Clean by removing leading/trailing characters `\u0000`–` ` and tab/CR/LF anywhere.
2. A **same-site path** is safe: it starts with a single `/` **not followed by** `/` or `\` (so `//host` and `/\host` are not).
3. Otherwise parse with `new URL(text)`; if that fails, `fallback`.
4. The protocol must be `http:` or `https:`; **credentials** in the URL (`user:pass@`) are refused; the **host** (including port, case-insensitive) must be in `allowedHosts`.
5. Return the cleaned text when safe.

```js
safeRedirect('https://good.example/x', { allowedHosts: ['good.example'] }); // 'https://good.example/x'
safeRedirect('https://good.example@evil.example/', { allowedHosts: ['good.example'] }); // '/'
```

%% worked
**A similar problem, solved: `isSameOrigin(url, origin)`** — let the URL parser decide.

```js
export function isSameOrigin(candidate, origin) {
  let url;
  try { url = new URL(candidate); } catch { return false; }       // ① "not parseable" means "not safe"
  return url.origin === new URL(origin).origin;                    // ② compare PARSED parts, never raw strings
}
```

Use the **same parser the browser would** (`URL`) instead of `indexOf('good.example')` checks. `https://good.example.evil.example` and `https://evil.example/?good.example` both fool string searches; neither fools `url.host`.

%% explain
- **Clean**, then accept **single-slash paths**.
- **Absolute URLs** must be http(s), have **no credentials**, and a **host in the allowlist**.
- **Anything else**: the fallback.

%% nudge
- Why is `https://good.example@evil.example/` dangerous, and which `URL` property reveals it?
- Why compare `url.host` and not a substring?

%% starter
```js
export function safeRedirect(target, { allowedHosts = [], fallback = '/' } = {}) {
  return fallback;
}
```

%% tests
```js
describe('safeRedirect', () => {
  const opts = { allowedHosts: ['good.example', 'app.good.example:8443'] };
  it('allows same-site paths', () => {
    for (const t of ['/dashboard', '/a/b?c=1#d', '/']) expect(safeRedirect(t, opts)).toBe(t);
  });
  it('rejects host-relative paths', () => {
    for (const t of ['//evil.example', '/\\evil.example', '\\\\evil.example', '\\/evil.example']) expect(safeRedirect(t, opts)).toBe('/');
  });
  it('allows absolute URLs on allowlisted hosts', () => {
    expect(safeRedirect('https://good.example/x?y=1', opts)).toBe('https://good.example/x?y=1');
    expect(safeRedirect('http://GOOD.example/x', opts)).toBe('http://GOOD.example/x');
    expect(safeRedirect('https://app.good.example:8443/p', opts)).toBe('https://app.good.example:8443/p');
  });
  it('rejects other hosts, look-alikes and wrong ports', () => {
    for (const t of ['https://evil.example', 'https://good.example.evil.example/', 'https://evil.example/?good.example', 'https://evil.example/good.example', 'https://app.good.example/p', 'https://notgood.example']) {
      expect(safeRedirect(t, opts)).toBe('/');
    }
  });
  it('rejects credentials tricks', () => {
    expect(safeRedirect('https://good.example@evil.example/', opts)).toBe('/');
    expect(safeRedirect('https://user:pw@good.example/', opts)).toBe('/');
  });
  it('rejects non-http schemes', () => {
    for (const t of ['javascript:alert(1)', 'data:text/html,x', 'ftp://good.example/x', 'file:///etc/passwd']) expect(safeRedirect(t, opts)).toBe('/');
  });
  it('cleans whitespace and control characters first', () => {
    expect(safeRedirect('  /dashboard  ', opts)).toBe('/dashboard');
    expect(safeRedirect('/\t/evil.example', opts)).toBe('/');
    expect(safeRedirect('\t//evil.example', opts)).toBe('/');
    expect(safeRedirect(' javascript:alert(1)', opts)).toBe('/');
  });
  it('rejects unparseable, empty and non-string targets', () => {
    for (const t of ['', '   ', 'good.example/x', 'not a url', null, undefined, 5, {}]) expect(safeRedirect(t, opts)).toBe('/');
  });
  it('uses a custom fallback and an empty allowlist', () => {
    expect(safeRedirect('https://evil.example', { fallback: '/home' })).toBe('/home');
    expect(safeRedirect('https://good.example', { allowedHosts: [] })).toBe('/');
    expect(safeRedirect('/ok')).toBe('/ok');
  });
});
```

%% hints
- Clean: `.replace(/[\t\r\n]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '')`.
- Same-site path: `/^\/(?![\/\\])/.test(s)`.
- `const url = new URL(s)` in `try/catch`; check `url.protocol`, `url.username || url.password`, and `url.host.toLowerCase()` against the lower-cased allowlist.

%% solution
```js
export function safeRedirect(target, { allowedHosts = [], fallback = '/' } = {}) {
  if (typeof target !== 'string') return fallback;
  const s = target.replace(/[\t\r\n]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (s === '') return fallback;
  if (/^\/(?![\/\\])/.test(s)) return s;
  let url;
  try {
    url = new URL(s);
  } catch {
    return fallback;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return fallback;
  if (url.username || url.password) return fallback;
  const host = url.host.toLowerCase();
  return allowedHosts.some((h) => h.toLowerCase() === host) ? s : fallback;
}
```

%% exercise sec-check-safe-join | Tests for safeJoin | 4 | js | js | checkSafeJoin | 30
`safeJoin(base, ...parts)` returns the normalised path inside the POSIX absolute `base`, or throws. Both `/` and `\` separate segments, `.` and empty segments disappear, `..` removes the previous segment, and anything that would **leave `base`** (a `..` above it, an **absolute** part, a **null byte**) throws. Write `checkSafeJoin(safeJoin)` that passes for a correct one and **fails** for: **lets .. climb out of the base**, **uses a string-prefix containment check**, **ignores backslashes**, **accepts absolute parts**, **accepts null bytes**, **doesn't normalise dot segments**.

```js
expect(() => safeJoin('/var/www', '../etc/passwd')).toThrow();
```

%% worked
**A similar problem, solved: `checkSafeSubdir(safeSubdir)`** — a table of "must work" and "must refuse", chosen to separate the bug families.

```js
export function checkSafeSubdir(safeSubdir) {            // safeSubdir('/data', 'x') → '/data/x'
  expect(safeSubdir('/data', 'a/b')).toBe('/data/a/b');          // ① normal use still works
  expect(safeSubdir('/data', 'a/./b')).toBe('/data/a/b');        // ② dot segments are normalised
  expect(() => safeSubdir('/data', '../x')).toThrow();           // ③ the obvious escape
  expect(() => safeSubdir('/data', '../data-old/x')).toThrow();  // ④ lands in a path that merely STARTS with /data
  expect(() => safeSubdir('/data', 'a\\..\\..\\x')).toThrow();   // ⑤ backslashes
  expect(() => safeSubdir('/data', '/etc/passwd')).toThrow();    // ⑥ absolute
}
```

Case ④ is the interesting one: a naive check "does the result start with `/data`?" **passes** it. Write an input that makes the wrong rule produce a *plausible-looking* but wrong answer.

%% explain
- **Normal joins** and **dot normalisation**.
- **Escapes**: `..` above the base, deep `a/../../x`.
- **Prefix confusion**: `../www-evil/x` lands next to the base.
- **Backslashes, absolute parts, null bytes**.

%% nudge
- Which input defeats `result.startsWith(base)`?
- Which assertion fails for an implementation that never resolves `.` segments?

%% starter
```js
export function checkSafeJoin(safeJoin) {
  expect(safeJoin('/var/www', 'img', 'a.png')).toBe('/var/www/img/a.png');
  expect(() => safeJoin('/var/www', '../etc/passwd')).toThrow();
  // your assertions: prefix confusion, backslashes, absolute parts, null bytes, dot segments
}
```

%% tests
```js
const make = ({ climb = false, prefix = false, backslash = true, absolute = false, nul = true, normalize = true } = {}) => (base, ...parts) => {
  if (nul && parts.some((p) => p.includes('\0'))) throw new Error('invalid path');
  const baseSegs = base.split('/').filter(Boolean);
  let segs = [...baseSegs];
  let skipCheck = climb;
  const split = backslash ? /[\/\\]+/ : /\/+/;
  for (const part of parts) {
    if (/^[\/\\]/.test(part)) {
      if (absolute) { segs = []; skipCheck = true; } else throw new Error('path escapes base');
    }
    for (const seg of part.split(split)) {
      if (seg === '') continue;
      if (seg === '.' && normalize) continue;
      if (seg === '..') { segs.pop(); continue; }
      segs.push(seg);
    }
  }
  const out = '/' + segs.join('/');
  if (!skipCheck) {
    const inside = prefix
      ? out.startsWith('/' + baseSegs.join('/'))
      : segs.length >= baseSegs.length && baseSegs.every((s, i) => segs[i] === s);
    if (!inside) throw new Error('path escapes base');
  }
  return out;
};
const correct = make();
const mutants = {
  'lets .. climb out of the base': make({ climb: true }),
  'uses a string-prefix containment check': make({ prefix: true }),
  'ignores backslashes': make({ backslash: false }),
  'accepts absolute parts': make({ absolute: true }),
  'accepts null bytes': make({ nul: false }),
  'does not normalise dot segments': make({ normalize: false }),
};

describe('your checkSafeJoin', () => {
  it('passes on a correct safeJoin', () => {
    expect(() => checkSafeJoin(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a safeJoin that ${name}`, () => {
      expect(() => checkSafeJoin(impl)).toThrow();
    });
  }
});
```

%% hints
- Normal: `safeJoin('/var/www', 'a/./b')` is `'/var/www/a/b'`.
- Prefix confusion: `'../www-evil/x'` must throw.
- Backslash: `'..\\..\\etc'` must throw. Absolute: `'/etc/passwd'`. Null byte: `'a\0b'`.

%% solution
```js
export function checkSafeJoin(safeJoin) {
  expect(safeJoin('/var/www', 'img', 'a.png')).toBe('/var/www/img/a.png');
  expect(safeJoin('/var/www', 'a/./b')).toBe('/var/www/a/b');
  expect(safeJoin('/var/www', 'a/../b')).toBe('/var/www/b');
  expect(safeJoin('/var/www')).toBe('/var/www');

  expect(() => safeJoin('/var/www', '../etc/passwd')).toThrow();
  expect(() => safeJoin('/var/www', 'a/../../etc')).toThrow();
  expect(() => safeJoin('/var/www', '../www-evil/x')).toThrow();
  expect(() => safeJoin('/var/www', '..\\..\\etc')).toThrow();
  expect(() => safeJoin('/var/www', '/etc/passwd')).toThrow();
  expect(() => safeJoin('/var/www', 'a\0b')).toThrow();
}
```
