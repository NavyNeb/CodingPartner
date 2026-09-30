---
id: interview-frontend
track: interview
title: Frontend interview classics
summary: The small utilities frontend interviews love — class names, query strings, templating, HTML rendering, windowing and fuzzy search — and the escaping and edge-case thinking behind them.
---

## The idea in one sentence

Frontend interviews mix algorithm questions with **"build a small piece of the platform"** questions, because they show whether you know **what the browser and your framework do for you** — and can write it carefully, with attention to **escaping, edge cases and API shape**.

> **Analogy** Think of a **customs officer**. Anything crossing a border — text going into HTML, into a URL, into CSS — must be **declared in that country's language** (encoded), or it might be mistaken for a command. Most frontend bugs in these questions are someone forgetting to "translate at the border".

## What interviewers watch for

- **API design first.** Say the signature and two example calls before typing. Ask whether inputs can be `null`, arrays, nested.
- **Escaping and encoding.** Whenever strings cross a boundary (HTML, URLs, CSS) you owe an answer to "what if the user types `<script>`?" or `a&b=c`. Reach for `encodeURIComponent` or an escape map — and know that `encodeURI` is a *different* function.
- **Immutability and purity.** Return new values; don't mutate arguments.
- **Performance awareness.** 100,000 rows means *windowing*; filtering on every keystroke means debouncing or a cheap ranking function.
- **Accessibility and semantics**, especially for UI questions: keyboard support, roles, focus.

## Recurring problems

| Problem | Core idea |
| --- | --- |
| `classnames` / `clsx` | recursive flatten + truthiness |
| Query-string parse/stringify | split, decode; repeated keys → arrays |
| Micro templating (`{{name}}`) | regex replace + path lookup + HTML escaping |
| Virtual DOM → HTML string | recursion, escaping, void elements, style objects |
| Virtualised list | pure arithmetic from `scrollTop` |
| Autocomplete ranking | a scoring function + stable tie-breakers |
| Relative time ("5 minutes ago") | thresholds + pluralisation |
| Debounce/throttle, memoize, EventEmitter, deep clone/equal | *(earlier lessons)* |

## Escaping: the border rules

![User input passes through HTML escaping, URL encoding, or raw concatenation](fig:escape-boundaries "Each boundary has its own encoder. Raw concatenation is how injection happens.")

- **HTML text and attributes:** replace `& < > " '` with entities. **Order matters**: `&` first — or do it in one pass with a lookup map, which avoids double-escaping altogether.
- **URLs:** `encodeURIComponent` for individual keys and values (it encodes everything except `A–Z a–z 0–9 - _ . ! ~ * ' ( )`). A `+` is a *form-encoding* space: decode it as a space when parsing `application/x-www-form-urlencoded` query strings.
- Never build HTML by concatenating user data unless you escape it. Frameworks escape for you *unless* you opt out (`dangerouslySetInnerHTML`, `v-html`).

```js try predict
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

console.log(escapeHtml('<b onclick="x">Tom & Jerry</b>'));
console.log(encodeURIComponent('a&b=c d'));
console.log(decodeURIComponent('hello+world%21'));        // careful: decodeURIComponent does NOT turn "+" into a space!
```

One regex pass with a lookup map can't double-escape, because each character is replaced exactly once.

## Class names (`clsx`)

```js try
function classNames(...args) {
  const out = [];
  for (const arg of args) {
    if (!arg) continue;                                   // null, undefined, false, 0, '' contribute nothing
    if (typeof arg === 'string' || typeof arg === 'number') out.push(String(arg));
    else if (Array.isArray(arg)) { const inner = classNames(...arg); if (inner) out.push(inner); }   // recursion
    else if (typeof arg === 'object') for (const key in arg) if (arg[key]) out.push(key);            // keys whose value is truthy
  }
  return out.join(' ');
}
console.log(classNames('btn', { active: true, disabled: false }, ['big', null, ['x']], 0, 3));
```

## Query strings: parse and stringify

```stepper Parsing "?a=1&a=2&flag&q=hello+world"
code:
  function parseQuery(search) {
    const out = {};
    for (const part of search.replace(/^\?/, '').split('&')) {
      if (!part) continue;
      const i = part.indexOf('=');
      const key = decode(i < 0 ? part : part.slice(0, i));
      const value = i < 0 ? '' : decode(part.slice(i + 1));
      if (key in out) out[key] = [].concat(out[key], value);
      else out[key] = value;
    }
    return out;
  }
---
line: 3-4
say: Strip the leading `?`, then split on `&`. We get the pieces `a=1`, `a=2`, `flag`, `q=hello+world`. Empty pieces (from `&&`) are skipped.
Piece: a=1
Key / value:
Result so far:
---
line: 5-7
say: Split at the **first** `=` only (values may contain `=`). `decode` URL-decodes and turns `+` into a space. Key `a`, value `"1"`.
Key / value: a / "1"
Result so far: { a: "1" }
---
line: 8-9
say: A second `a`: the key **already exists**, so the value becomes an **array** in order of appearance.
Piece: a=2
Key / value: a / "2"
Result so far: { a: ["1", "2"] }
---
line: 5-7
say: `flag` has **no `=`** (`i < 0`), so the key is the whole piece and the value is an empty string.
Piece: flag
Key / value: flag / ""
Result so far: { a: ["1", "2"], flag: "" }
---
line: 5-7
say: `q=hello+world`: the `+` means a **space** in query strings, so the value is `"hello world"`.
Piece: q=hello+world
Key / value: q / "hello world"
Result so far: { a: ["1", "2"], flag: "", q: "hello world" }
```

```js try
const stringifyQuery = (params) =>
  Object.entries(params)
    .flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).filter((v) => v != null).map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`))
    .join('&');

console.log(stringifyQuery({ q: 'hello world', tags: ['a', 'b'], skip: undefined, n: 0 }));
```

## Micro templating and virtual-DOM-to-HTML

Both are "walk the input, escape on the way out":

```js try
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const get = (data, path) => path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), data);

function render(template, data) {
  return template
    .replace(/\{\{\{\s*([\w.]+)\s*\}\}\}/g, (_, path) => String(get(data, path) ?? ''))            // {{{ raw }}}
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => escapeHtml(get(data, path) ?? ''));           // {{ escaped }}
}

console.log(render('Hi {{ user.name }}! {{{ html }}}', { user: { name: '<Ann>' }, html: '<b>bold</b>' }));
```

![A virtual DOM object walked into an HTML string with escaped text and a void br element](fig:vdom-to-html "Escape text and attributes; render void elements without children; call function components.")

## Windowing arithmetic

![A tall spacer with only the visible rows plus overscan mounted](fig:virtual-window "With fixed row height h, scrolled s and a viewport of v pixels, the first visible row is floor(s / h) and the last is ceil((s + v) / h).")

```js try
function getVisibleRange({ scrollTop, viewportHeight, itemHeight, itemCount, overscan = 3 }) {
  const top = Math.max(0, scrollTop);                              // elastic scrolling can go negative
  const start = Math.max(0, Math.floor(top / itemHeight) - overscan);
  const end = Math.min(itemCount, Math.ceil((top + viewportHeight) / itemHeight) + overscan);
  return { start, end: Math.max(start, end), offsetTop: start * itemHeight, totalHeight: itemCount * itemHeight };
}
console.log(getVisibleRange({ scrollTop: 400, viewportHeight: 200, itemHeight: 20, itemCount: 10000 }));
```

## Autocomplete ranking

Score each item by the **best rule** that applies, then sort:

![A ladder: exact 1000, prefix 800, word-start 600, substring 400, subsequence 200](fig:rank-ladder "Break ties by shorter item, then alphabetically.")

The odd one is the **subsequence** test ("`hlo` is a subsequence of `hello`": the query's letters appear in order, not necessarily together):

```js try
function isSubsequence(query, text) {
  let i = 0;
  for (const ch of text) if (ch === query[i]) i++;       // advance in the query whenever the next letter is found
  return i === query.length;
}
console.log(isSubsequence('hlo', 'hello'), isSubsequence('hol', 'hello'));
```

## Relative time

Thresholds and pluralisation — take the absolute difference, pick the largest unit that fits, `floor` the number, singular only for exactly `1`, then choose "… ago" or "in …":

```js try
function timeAgo(date, now = Date.now()) {
  const diff = new Date(date).getTime() - now;
  const abs = Math.abs(diff), sec = abs / 1000;
  if (sec < 60) return 'just now';
  const units = [['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800], ['month', 2592000], ['year', 31536000]];
  let label = 'minute', n = Math.floor(sec / 60);
  for (const [name, size] of units) if (sec >= size) { label = name; n = Math.floor(sec / size); }
  const text = `${n} ${label}${n === 1 ? '' : 's'}`;
  return diff < 0 ? `${text} ago` : `in ${text}`;
}
const now = 1_000_000_000_000;
console.log(timeAgo(now - 3 * 3600 * 1000, now), '|', timeAgo(now + 90 * 1000, now), '|', timeAgo(now - 10_000, now));
```

## Quick check

```check
Q: Why should `&` be escaped first (or everything done in one pass)?
A) Otherwise the `&` inside entities you just produced would be escaped again *
B) It is the most common character
C) `&` is not special
D) Browsers require it
Why: Escaping `<` into `&lt;` and then escaping `&` would give `&amp;lt;`. One pass with a lookup map avoids it.
---
Q: A query string contains `q=hello+world`. What should the parsed value be?
A) `hello+world`
B) `hello%20world`
C) `hello world` — `+` means a space in form-encoded query strings *
D) An array
Why: `decodeURIComponent` alone keeps `+`; you must replace `+` with a space first.
---
Q: What does `a=1&a=2` parse to in a typical `parseQuery`?
A) `{ a: '2' }`
B) `{ a: '1' }`
C) An error
D) `{ a: ['1', '2'] }` *
Why: Repeated keys become arrays in order of appearance.
---
Q: For a viewport of 200px, rows of 20px and `scrollTop = 400`, which rows are visible (before overscan)?
A) Rows 10–19
B) Rows 0–9
C) Rows 20–29 *
D) All rows
Why: The first visible row is floor(400 / 20) = 20 and the end (exclusive) is ceil(600 / 20) = 30, so rows 20 to 29.
---
Q: Why is `hlo` a match for `hello` in fuzzy search, but `hol` is not?
A) Because `hlo` is shorter
B) The letters must appear in order: `h…l…o` exists, `h…o…l` does not *
C) `hol` is misspelled
D) Only prefixes match
Why: A subsequence keeps the order of the characters but allows gaps.
```

## Recap

- **Say the API first**, ask about edge cases, return new values.
- **Escape at every border**: HTML entities (one pass), `encodeURIComponent` for URLs; `+` is a space in form-encoded queries.
- **Class names**: recursive flatten + truthiness. **Query strings**: split on the first `=`, decode, repeated keys → arrays.
- **Templates / vDOM → HTML**: walk the input and escape on output; void elements; style objects.
- **Windowing** is pure arithmetic from `scrollTop`; **ranking** is a score ladder plus stable tie-breakers.
- **Relative time**: thresholds, `floor`, singular for exactly 1.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: escape HTML | The escape snippet |
| `classNames()` | The recursive `classNames` snippet |
| Query strings | The stepper and the stringify snippet |
| Micro templating | The `render` snippet: paths, escaping, triple braces |
| Relative time | The `timeAgo` snippet and its thresholds |
| Virtual DOM → HTML string | The vDOM figure, escaping, void elements, style conversion |
| Virtual list window | The `getVisibleRange` snippet and its clamping rules |
| Autocomplete ranking | The score ladder and `isSubsequence` |

%% exercise fe-guided-escape | Guided: escape HTML | 1 | js | js | escapeHtml | 5 | guided
Write `escapeHtml(value)`. It converts the characters that are special in HTML into entities, so user text can be safely placed inside HTML.

| Character | Entity |
| --- | --- |
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

- Non-strings are converted with `String(value)`; `null` and `undefined` give `''`.
- Each character is replaced **once** — `&lt;` in the input becomes `&amp;lt;` (the `&` is escaped, nothing is escaped twice).

%% worked
**A similar problem, solved: `escapeRegex(text)`** — a different boundary (regular expressions) with the same technique: one pass, one lookup.

```js
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');   // ① a regex matching ANY special character; ② `$&` = "the matched text" → prefix it with a backslash
}

escapeRegex('1+1=2?');   // "1\+1=2\?"
```

For HTML the replacement isn't "add a backslash", it's "look the character up in a table". A **single pass with a function** replaces each character exactly once, so the `&` inside an entity you just produced is never touched again:

```js
const map = { '&': '&amp;' /* …the others… */ };
text.replace(/[&<>"']/g, (char) => map[char]);
```

%% explain
- **Five characters** are escaped: `& < > " '` (`'` becomes `&#39;`).
- **Other text** is untouched.
- **No double-escaping**: each character is converted once.
- **`null`/`undefined`** give an empty string; other values are converted with `String`.

%% nudge
- What goes wrong if you replace `<` first and `&` last?
- Which `replace` form lets you compute the replacement for each matched character?

%% starter
```js
export function escapeHtml(value) {
  // Step 1 — null / undefined → ''
  // Step 2 — a lookup table:   { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  // Step 3 — String(value).replace(/[&<>"']/g, (char) => table[char])
  return '';
}
```

%% tests
```js
describe('escapeHtml', () => {
  it('escapes the five special characters', () => {
    expect(escapeHtml('<a href="x">Tom & Jerry\'s</a>')).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  });

  it('does not double-escape', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves normal text alone', () => {
    expect(escapeHtml('hello world 123')).toBe('hello world 123');
  });

  it('handles null, undefined and numbers', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});
```

%% hints
- `const table = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };`
- `return String(value).replace(/[&<>"']/g, (c) => table[c]);`

%% solution
```js
const table = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => table[char]);
}
```

%% exercise fe-classnames | classNames() | 1 | js | js | classNames | 8
Write `classNames(...args)`, a tiny `clsx`.

- Strings are included as-is; empty strings are skipped.
- Numbers other than `0` are included (as strings).
- Objects include each **key** whose value is truthy.
- Arrays are processed recursively.
- `null`, `undefined`, `false`, `true` and `0` contribute nothing.
- The result is the parts joined by a single space (no leading/trailing spaces).

%% starter
```js
export function classNames(...args) {
  // your code
}
```

%% tests
```js
describe('classNames', () => {
  it('joins strings', () => expect(classNames('a', 'b', 'c')).toBe('a b c'));
  it('skips falsy values', () => {
    expect(classNames('a', null, undefined, false, 0, '', 'b')).toBe('a b');
  });
  it('includes keys of truthy object values', () => {
    expect(classNames({ active: true, disabled: false, big: 1, none: null })).toBe('active big');
  });
  it('flattens arrays recursively', () => {
    expect(classNames('a', ['b', ['c', { d: true }]], [[]])).toBe('a b c d');
  });
  it('mixes everything', () => {
    expect(classNames('btn', { 'btn-primary': true }, ['x', false && 'y'], 42)).toBe('btn btn-primary x 42');
  });
  it('returns an empty string for nothing', () => {
    expect(classNames()).toBe('');
    expect(classNames(null, false)).toBe('');
  });
  it('ignores boolean true', () => expect(classNames(true, 'a')).toBe('a'));
  it('does not trim inside strings or add extra spaces', () => {
    expect(classNames('a b', 'c')).toBe('a b c');
  });
});
```

%% worked
**A similar problem, solved: `flattenTruthy(...args)`** — flatten nested arrays and keep only truthy items. `classNames` is this plus special handling for strings and objects.

```js
function flattenTruthy(...args) {
  const out = [];
  for (const arg of args) {
    if (Array.isArray(arg)) out.push(...flattenTruthy(...arg));   // ① arrays → recurse, then add what came back
    else if (arg) out.push(arg);                                   // ② anything truthy is kept; falsy values vanish
  }
  return out;
}

flattenTruthy('a', [0, 'b', [null, 'c']], false);   // ['a', 'b', 'c']
```

For `classNames` the per-argument rules are: **string** → itself (skip `''`), **number** → `String(n)` unless `0`, **object** → each *key* whose value is truthy, **array** → recurse, and `null/undefined/false/true/0` → nothing. Join the parts with a single space (an empty result is `''`).

%% explain
- **Strings** included as-is; empty strings skipped.
- **Numbers** other than `0` included (as strings).
- **Objects** include each key whose value is truthy.
- **Arrays** are processed recursively.
- **`null`, `undefined`, `false`, `true`, `0`** contribute nothing; the result is joined by single spaces, no leading/trailing space.

%% nudge
- Which argument types need a recursive call?
- How do you avoid a stray space when a nested array produces nothing?

%% hints
- A recursive helper that pushes onto a shared `out` array is the cleanest.
- Branch on `typeof`: `string`/`number` push; `object` — `Array.isArray` recurse, else iterate `Object.keys`.
- Watch `0`: it's falsy, so `if (arg)` already skips it.

%% solution
```js
export function classNames(...args) {
  const out = [];
  const visit = (arg) => {
    if (!arg) return;
    if (typeof arg === 'string' || typeof arg === 'number') out.push(String(arg));
    else if (Array.isArray(arg)) arg.forEach(visit);
    else if (typeof arg === 'object') {
      for (const key of Object.keys(arg)) if (arg[key]) out.push(key);
    }
  };
  args.forEach(visit);
  return out.join(' ');
}
```

%% exercise fe-query-string | Query strings | 2 | js | js | parseQuery, stringifyQuery | 18
Implement both directions of URL query handling.

`parseQuery(search)`
- Accepts strings with or without a leading `?`. Empty input → `{}`.
- Splits on `&`, then the **first** `=`. Keys and values are URL-decoded, and `+` means a space.
- A key without `=` (`?flag`) has value `''`.
- **Repeated keys become arrays** in order of appearance (`a=1&a=2` → `{ a: ['1', '2'] }`); a single occurrence stays a string.
- Ignore empty segments (`a=1&&b=2`).

`stringifyQuery(params)`
- Encodes with `encodeURIComponent`. Array values repeat the key.
- `undefined` and `null` values are **omitted**; other values are converted with `String`.
- No leading `?`. Keys are emitted in object order.

%% starter
```js
export function parseQuery(search) {
  // your code
}

export function stringifyQuery(params) {
  // your code
}
```

%% tests
```js
describe('parseQuery', () => {
  it('parses simple pairs', () => expect(parseQuery('a=1&b=2')).toEqual({ a: '1', b: '2' }));
  it('accepts a leading ?', () => expect(parseQuery('?a=1')).toEqual({ a: '1' }));
  it('returns {} for empty input', () => {
    expect(parseQuery('')).toEqual({});
    expect(parseQuery('?')).toEqual({});
  });
  it('decodes keys and values, treating + as a space', () => {
    expect(parseQuery('q=hello+world&name=J%C3%BCrgen&%5Bk%5D=%26')).toEqual({ q: 'hello world', name: 'Jürgen', '[k]': '&' });
  });
  it('handles keys without a value', () => expect(parseQuery('flag&x=1')).toEqual({ flag: '', x: '1' }));
  it('splits on the first = only', () => expect(parseQuery('eq=a=b=c')).toEqual({ eq: 'a=b=c' }));
  it('turns repeated keys into arrays', () => {
    expect(parseQuery('tag=a&tag=b&x=1&tag=c')).toEqual({ tag: ['a', 'b', 'c'], x: '1' });
  });
  it('ignores empty segments', () => expect(parseQuery('a=1&&b=2&')).toEqual({ a: '1', b: '2' }));
  it('keeps an empty value', () => expect(parseQuery('a=&b=2')).toEqual({ a: '', b: '2' }));
  it('is safe with prototype-like keys', () => {
    const out = parseQuery('__proto__=x&constructor=y');
    expect(Object.keys(out).sort()).toEqual(['__proto__', 'constructor']);
    expect(({}).x).toBeUndefined();
  });
});

describe('stringifyQuery', () => {
  it('encodes pairs', () => expect(stringifyQuery({ a: 1, b: 'x y' })).toBe('a=1&b=x%20y'));
  it('repeats keys for arrays', () => expect(stringifyQuery({ tag: ['a', 'b'] })).toBe('tag=a&tag=b'));
  it('omits null and undefined', () => expect(stringifyQuery({ a: null, b: undefined, c: 0, d: false })).toBe('c=0&d=false'));
  it('encodes keys and reserved characters', () => {
    expect(stringifyQuery({ 'a&b': 'c=d', '[k]': 'é' })).toBe('a%26b=c%3Dd&%5Bk%5D=%C3%A9');
  });
  it('returns "" for an empty object', () => expect(stringifyQuery({})).toBe(''));
  it('skips null/undefined inside arrays', () => expect(stringifyQuery({ a: [1, null, 2] })).toBe('a=1&a=2'));
  it('round-trips', () => {
    const src = { q: 'a b&c', tags: ['x', 'y z'], n: '5' };
    expect(parseQuery(stringifyQuery(src))).toEqual(src);
  });
});
```

%% worked
**A similar problem, solved: `parseCookies(header)`** — `"a=1; b=two; flag"` → `{ a: '1', b: 'two', flag: '' }`. Same split-decode shape, different separators.

```js
function parseCookies(header) {
  const out = {};
  for (const part of header.split(';')) {
    const piece = part.trim();
    if (!piece) continue;                           // ① skip empty segments
    const i = piece.indexOf('=');                   // ② split at the FIRST "=" only (values may contain "=")
    const key = i < 0 ? piece : piece.slice(0, i);
    const value = i < 0 ? '' : piece.slice(i + 1);  // ③ no "=" → empty string
    out[decodeURIComponent(key)] = decodeURIComponent(value);
  }
  return out;
}
```

For query strings add: **strip a leading `?`**; turn **`+` into a space *before* decoding** (`s.replace(/\+/g, ' ')`); make **repeated keys arrays** (second occurrence → `[first, second]`, later ones append); and use a prototype-free object or `Object.hasOwn` when testing "key already exists" so keys like `constructor` work. `stringifyQuery` goes the other way with `encodeURIComponent`, repeats the key for arrays, **omits** `undefined`/`null`, and converts everything else with `String`.

%% explain
- **`parseQuery`**: with or without a leading `?`; empty → `{}`; split on `&`, then the **first** `=`; decode keys and values (`+` = space); a key without `=` has value `''`; **repeated keys become arrays**; empty segments ignored.
- **`stringifyQuery`**: `encodeURIComponent`; array values repeat the key; `undefined`/`null` omitted; others via `String`; no leading `?`; keys in object order.

%% nudge
- Which split do you need so a value like `a=b=c` keeps its second `=`?
- In which order: replace `+` with a space, or decode?

%% hints
- Decode with `decodeURIComponent(s.replace(/\+/g, ' '))` — replace `+` *before* decoding.
- `const i = seg.indexOf('=')` to split on the first `=`.
- Accumulate into `Object.create(null)` so `__proto__` is just another key; convert an existing string into an array when a key repeats.

%% solution
```js
const decode = (s) => decodeURIComponent(s.replace(/\+/g, ' '));

export function parseQuery(search) {
  const out = Object.create(null);
  const str = search.startsWith('?') ? search.slice(1) : search;
  for (const seg of str.split('&')) {
    if (!seg) continue;
    const i = seg.indexOf('=');
    const key = decode(i === -1 ? seg : seg.slice(0, i));
    const value = i === -1 ? '' : decode(seg.slice(i + 1));
    if (key in out) out[key] = [].concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

export function stringifyQuery(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (v === null || v === undefined) continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}
```

%% exercise fe-template | Micro templating | 2 | js | js | render | 15
Write `render(template, data)` for `{{ path }}` placeholders.

- `{{ user.name }}` — dotted paths into `data` (also array indexes: `items.0.title`). Whitespace inside the braces is optional.
- Values are **HTML-escaped** (`& < > " '`).
- `{{{ path }}}` (triple braces) inserts the value **raw**.
- Missing paths and `null`/`undefined` render as an empty string. Other values (numbers, booleans) are converted with `String`.
- Text outside placeholders is untouched. Unclosed braces are left as-is.

%% starter
```js
export function render(template, data) {
  // your code
}
```

%% tests
```js
describe('render', () => {
  it('replaces simple placeholders', () => {
    expect(render('Hello, {{name}}!', { name: 'Ada' })).toBe('Hello, Ada!');
  });
  it('allows whitespace inside braces', () => {
    expect(render('{{  name  }}', { name: 'x' })).toBe('x');
  });
  it('reads nested and indexed paths', () => {
    expect(render('{{ user.address.city }} / {{ items.1.title }}', { user: { address: { city: 'Oslo' } }, items: [{ title: 'a' }, { title: 'b' }] })).toBe('Oslo / b');
  });
  it('escapes HTML by default', () => {
    expect(render('<p>{{ bio }}</p>', { bio: `<script>alert("x") & 'y'</script>` }))
      .toBe('<p>&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;</p>');
  });
  it('inserts raw values with triple braces', () => {
    expect(render('{{{ html }}}', { html: '<b>bold</b>' })).toBe('<b>bold</b>');
  });
  it('renders missing paths and nullish values as empty', () => {
    expect(render('[{{ a.b.c }}][{{ n }}][{{ u }}]', { n: null, u: undefined })).toBe('[][][]');
  });
  it('stringifies numbers, booleans and zero', () => {
    expect(render('{{n}} {{z}} {{t}} {{f}}', { n: 5, z: 0, t: true, f: false })).toBe('5 0 true false');
  });
  it('handles repeated placeholders', () => {
    expect(render('{{x}}-{{x}}', { x: 'a' })).toBe('a-a');
  });
  it('leaves malformed placeholders alone', () => {
    expect(render('{{ open', { open: 1 })).toBe('{{ open');
    expect(render('}} {{', {})).toBe('}} {{');
  });
  it('does not double-escape or re-scan inserted values', () => {
    expect(render('{{a}}', { a: '{{b}}', b: 'nope' })).toBe('{{b}}');
    expect(render('{{a}}', { a: '&amp;' })).toBe('&amp;amp;');
  });
  it('does not expose prototype properties', () => {
    expect(render('{{constructor}}|{{__proto__}}', {})).toBe('|');
  });
});
```

%% worked
**A similar problem, solved: `fill(template, data)` for `${name}` placeholders** — lookup by path, with a safe fallback.

```js
const get = (data, path) =>
  path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), data);   // ① stops safely at null/undefined; also works for array indexes ("items.0.title")

function fill(template, data) {
  return template.replace(/\$\{\s*([\w.]+)\s*\}/g, (_, path) => {
    const value = get(data, path);
    return value == null ? '' : String(value);       // ② missing → empty string
  });
}
```

For `render`: two patterns. Handle the **triple-brace raw** form first — `/\{\{\{\s*([\w.]+)\s*\}\}\}/g` inserts `String(value)` unescaped — then the double-brace form with `escapeHtml(value)`. Doing triple first matters: otherwise the double-brace regex would match the inside of `{{{ x }}}`. Text outside placeholders and unclosed braces are left untouched because the regexes simply don't match them.

%% explain
- **`{{ path }}`** with dotted paths and array indexes (`items.0.title`); whitespace inside the braces optional.
- **Values are HTML-escaped**; **`{{{ path }}}`** inserts raw.
- **Missing paths and `null`/`undefined`** render as `''`; other values use `String`.
- **Text outside placeholders is untouched**; unclosed braces stay as they are.

%% nudge
- Which of the two patterns (`{{{ }}}` or `{{ }}`) should be replaced first, and why?
- How do you look up `user.name` or `items.0.title` safely when something in the path is missing?

%% hints
- One regex with two alternatives, **triple first**: `/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g`, and use a replacer function `(m, raw, esc) => …`.
- `string.replace` scans the *original* string only, so inserted values are never re-scanned.
- For lookup use `Object.hasOwn` at every step so `constructor` doesn't leak the `Object` function.
- Escape with a map `{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }` and one regex.

%% solution
```js
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

function lookup(data, path) {
  let cur = data;
  for (const key of path.split('.')) {
    if (cur === null || cur === undefined || !Object.hasOwn(Object(cur), key)) return undefined;
    cur = cur[key];
  }
  return cur;
}

export function render(template, data) {
  return template.replace(/\{\{\{\s*([\w.]+)\s*\}\}\}|\{\{\s*([\w.]+)\s*\}\}/g, (_, raw, esc) => {
    const value = lookup(data, raw ?? esc);
    if (value === null || value === undefined) return '';
    const str = String(value);
    return raw !== undefined ? str : escapeHtml(str);
  });
}
```

%% exercise fe-time-ago | Relative time | 2 | js | js | timeAgo | 12
Write `timeAgo(date, now = Date.now())` returning human text. Both arguments may be `Date` objects or millisecond timestamps.

Let `diff = |now − date|`:
- `< 60 s` → `"just now"` (past or future)
- `< 60 min` → minutes · `< 24 h` → hours · `< 7 days` → days · `< 30 days` → weeks (`floor(days / 7)`) · `< 365 days` → months (`floor(days / 30)`) · else years (`floor(days / 365)`)

Always `floor` the number, singular for exactly `1` (`"1 hour ago"`, `"3 hours ago"`). Past → `"… ago"`, future → `"in …"`.

%% starter
```js
export function timeAgo(date, now = Date.now()) {
  // your code
}
```

%% tests
```js
const NOW = Date.UTC(2024, 5, 15, 12, 0, 0);
const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;

describe('timeAgo', () => {
  it('says "just now" within a minute, either direction', () => {
    expect(timeAgo(NOW, NOW)).toBe('just now');
    expect(timeAgo(NOW - 59 * S, NOW)).toBe('just now');
    expect(timeAgo(NOW + 59 * S, NOW)).toBe('just now');
  });
  it('minutes', () => {
    expect(timeAgo(NOW - M, NOW)).toBe('1 minute ago');
    expect(timeAgo(NOW - 5 * M - 30 * S, NOW)).toBe('5 minutes ago');
    expect(timeAgo(NOW - 59 * M, NOW)).toBe('59 minutes ago');
  });
  it('hours', () => {
    expect(timeAgo(NOW - H, NOW)).toBe('1 hour ago');
    expect(timeAgo(NOW - 23 * H - 59 * M, NOW)).toBe('23 hours ago');
  });
  it('days', () => {
    expect(timeAgo(NOW - D, NOW)).toBe('1 day ago');
    expect(timeAgo(NOW - 6 * D, NOW)).toBe('6 days ago');
  });
  it('weeks', () => {
    expect(timeAgo(NOW - 7 * D, NOW)).toBe('1 week ago');
    expect(timeAgo(NOW - 29 * D, NOW)).toBe('4 weeks ago');
  });
  it('months and years', () => {
    expect(timeAgo(NOW - 30 * D, NOW)).toBe('1 month ago');
    expect(timeAgo(NOW - 364 * D, NOW)).toBe('12 months ago');
    expect(timeAgo(NOW - 365 * D, NOW)).toBe('1 year ago');
    expect(timeAgo(NOW - 800 * D, NOW)).toBe('2 years ago');
  });
  it('handles the future', () => {
    expect(timeAgo(NOW + 5 * M, NOW)).toBe('in 5 minutes');
    expect(timeAgo(NOW + H, NOW)).toBe('in 1 hour');
    expect(timeAgo(NOW + 3 * D, NOW)).toBe('in 3 days');
  });
  it('accepts Date objects', () => {
    expect(timeAgo(new Date(NOW - 2 * H), new Date(NOW))).toBe('2 hours ago');
  });
  it('defaults now to the current time', () => {
    expect(timeAgo(Date.now() - 2 * H)).toBe('2 hours ago');
  });
});
```

%% worked
**A similar problem, solved: `formatBytes(n)`** — pick the largest unit that fits, floor, pluralise.

```js
function formatBytes(n) {
  const units = [['GB', 1e9], ['MB', 1e6], ['KB', 1e3]];
  for (const [name, size] of units) {          // ① check from the LARGEST unit down
    if (n >= size) return `${Math.floor(n / size)} ${name}`;   // ② first unit that fits wins; floor the number
  }
  return `${n} B`;
}
```

`timeAgo` has the same shape: compute `diff = now - date`, take its **absolute value**, walk the thresholds (`60 s`, `60 min`, `24 h`, `7 days`, `30 days`, `365 days`) and `floor` the amount. Then finish the **text**: `n === 1 ? singular : plural` (`"1 hour ago"`, `"3 hours ago"`) and choose the direction from the **sign** of the difference (`ago` for the past, `in …` for the future). Under a minute (either direction) is `"just now"`. Accept `Date` objects or timestamps: `new Date(x).getTime()` handles both.

%% explain
- **Under 60 s** → `"just now"` (past or future).
- **Units**: minutes (< 60 min), hours (< 24 h), days (< 7 days), weeks (< 30 days, `floor(days / 7)`), months (< 365 days, `floor(days / 30)`), then years (`floor(days / 365)`).
- **Always floor**; singular for exactly `1`.
- **Past** → `"… ago"`, **future** → `"in …"`.
- **`date` and `now`** can each be a `Date` or a millisecond timestamp.

%% nudge
- How do you handle both past and future with one set of thresholds?
- Where does the pluralisation decision (`1` vs others) happen?

%% hints
- Table-driven: an array of `[unitName, msPerUnit, upperBoundMs]` checked in order.
- `Math.floor(diff / unitMs)`; `n === 1 ? '' : 's'`.
- Compute the direction from the sign of `now - date` before taking the absolute value.

%% solution
```js
const S = 1000, M = 60 * S, H = 60 * M, D = 24 * H;
const UNITS = [
  ['minute', M, H],
  ['hour', H, D],
  ['day', D, 7 * D],
  ['week', 7 * D, 30 * D],
  ['month', 30 * D, 365 * D],
  ['year', 365 * D, Infinity],
];

export function timeAgo(date, now = Date.now()) {
  const delta = +now - +date;
  const diff = Math.abs(delta);
  if (diff < M) return 'just now';
  const [name, size] = UNITS.find(([, , max]) => diff < max);
  const n = Math.floor(diff / size);
  const label = `${n} ${name}${n === 1 ? '' : 's'}`;
  return delta >= 0 ? `${label} ago` : `in ${label}`;
}
```

%% exercise fe-vdom-html | Virtual DOM → HTML string | 3 | js | js | renderToString | 30
Write `renderToString(node)` for a mini virtual DOM:

```js
{ type: 'div', props: { className: 'card', id: 'x' }, children: ['Hello ', { type: 'b', props: {}, children: ['world'] }] }
```

Rules:
- A node is a **string/number** (rendered as escaped text), `null`/`undefined`/booleans (nothing), an **array** (flattened), or an element object as above. `children` may be nested arrays.
- **Text and attribute values are HTML-escaped** (`& < > " '`).
- Prop renames: `className` → `class`, `htmlFor` → `for`.
- `true` renders a bare attribute (`disabled`); `false`, `null` and `undefined` omit the attribute. Function props (`onClick`) are omitted.
- `style` objects become `style="color:red;font-size:12px"` — camelCase → kebab-case, numbers get `px` unless the property is unitless (`opacity`, `zIndex`, `flex`, `flexGrow`, `lineHeight`, `fontWeight`, `order`).
- Void elements (`br`, `hr`, `img`, `input`, `meta`, `link`) render as `<br />` and never have children.
- **Function components:** if `type` is a function, call it with `{ ...props, children }` and render what it returns.
- Attributes appear in the order they're given.

%% starter
```js
export function renderToString(node) {
  // your code
}
```

%% tests
```js
const h = (type, props, ...children) => ({ type, props: props || {}, children });

describe('renderToString', () => {
  it('renders text and numbers, escaping text', () => {
    expect(renderToString('a < b & c')).toBe('a &lt; b &amp; c');
    expect(renderToString(42)).toBe('42');
  });
  it('renders nothing for empty values', () => {
    expect(renderToString(null)).toBe('');
    expect(renderToString(undefined)).toBe('');
    expect(renderToString(false)).toBe('');
    expect(renderToString(true)).toBe('');
  });
  it('renders elements with children', () => {
    expect(renderToString(h('p', null, 'Hello ', h('b', null, 'world')))).toBe('<p>Hello <b>world</b></p>');
  });
  it('renders attributes and renames className/htmlFor', () => {
    expect(renderToString(h('label', { className: 'big', htmlFor: 'name', id: 'l' }, 'Name')))
      .toBe('<label class="big" for="name" id="l">Name</label>');
  });
  it('escapes attribute values', () => {
    expect(renderToString(h('a', { title: 'say "hi" & <go>' }, 'x'))).toBe('<a title="say &quot;hi&quot; &amp; &lt;go&gt;">x</a>');
  });
  it('handles boolean attributes', () => {
    expect(renderToString(h('input', { disabled: true, checked: false, hidden: null, type: 'checkbox' })))
      .toBe('<input disabled type="checkbox" />');
  });
  it('omits function props', () => {
    expect(renderToString(h('button', { onClick: () => {}, type: 'button' }, 'go'))).toBe('<button type="button">go</button>');
  });
  it('renders style objects', () => {
    expect(renderToString(h('div', { style: { color: 'red', fontSize: 12, opacity: 0.5, zIndex: 3, marginTop: 0 } })))
      .toBe('<div style="color:red;font-size:12px;opacity:0.5;z-index:3;margin-top:0px"></div>');
  });
  it('renders void elements self-closed', () => {
    expect(renderToString(h('br'))).toBe('<br />');
    expect(renderToString(h('img', { src: 'a.png', alt: '' }))).toBe('<img src="a.png" alt="" />');
  });
  it('flattens nested arrays and skips empty children', () => {
    expect(renderToString(h('ul', null, [h('li', null, 'a'), [h('li', null, 'b'), null]], false, h('li', null, 'c'))))
      .toBe('<ul><li>a</li><li>b</li><li>c</li></ul>');
  });
  it('renders function components', () => {
    const Card = ({ title, children }) => h('section', { className: 'card' }, h('h2', null, title), children);
    expect(renderToString(h(Card, { title: 'Hi' }, h('p', null, 'body'))))
      .toBe('<section class="card"><h2>Hi</h2><p>body</p></section>');
  });
  it('supports components that return arrays or strings', () => {
    const List = () => [h('i', null, '1'), h('i', null, '2')];
    const Text = ({ children }) => children;
    expect(renderToString(h('div', null, h(List), h(Text, null, 'plain')))).toBe('<div><i>1</i><i>2</i>plain</div>');
  });
  it('renders numeric zero children', () => {
    expect(renderToString(h('span', null, 0))).toBe('<span>0</span>');
  });
  it('renders attribute value 0', () => {
    expect(renderToString(h('input', { tabIndex: 0 }))).toBe('<input tabIndex="0" />');
  });
});
```

%% worked
**A similar problem, solved: render a nested list (array of strings and arrays) to an HTML `<ul>`** — the recursion and escaping you need for the vDOM.

```js
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function renderList(items) {
  const lis = items.map((item) =>
    Array.isArray(item)
      ? `<li>${renderList(item)}</li>`        // ① an array → a NESTED list (recursion)
      : `<li>${escapeHtml(item)}</li>`        // ② text → escaped
  );
  return `<ul>${lis.join('')}</ul>`;
}
```

For `renderToString(node)`: handle **node kinds** in order — `null/undefined/boolean` → `''`; string/number → `escapeHtml(String(node))`; array → render each and join; **function component** (`typeof node.type === 'function'`) → call it with `{ ...props, children }` and render the result; otherwise an **element**: build the attribute string (skip `children`, functions, `false/null/undefined`; rename `className`/`htmlFor`; `true` → bare attribute; escape values; convert `style` objects to `kebab-case:value;` with `px` added to numbers except unitless properties), then either `<tag attrs />` for **void elements** (never render children) or `<tag attrs>children</tag>`.

%% explain
- **Text and attribute values are escaped**; `null/undefined/booleans` render nothing; arrays flatten; children may nest.
- **Renames**: `className` → `class`, `htmlFor` → `for`; `true` → bare attribute; `false/null/undefined` and function props omitted.
- **`style` objects**: camelCase → kebab-case, numbers get `px` unless unitless (`opacity`, `zIndex`, `flex`, `flexGrow`, `lineHeight`, `fontWeight`, `order`).
- **Void elements** (`br`, `hr`, `img`, `input`, `meta`, `link`) render as `<br />` with no children.
- **Function components** are called with `{ ...props, children }`.

%% nudge
- What are all the *kinds* of `node` you can receive, and in which order should you test for them?
- Which tags must never have children or a closing tag?

%% hints
- Start with a `switch` on the node kind: array → map+join; string/number → escape; nullish/boolean → `''`; object → element.
- Element: `typeof type === 'function'` → `renderToString(type({ ...props, children }))`. Note `children` is an array, so a component that just returns `children` still works.
- Build the attribute string from `Object.entries(props)`, skipping `children`, functions, `false`, `null`, `undefined`.
- Style: `key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())`, and append `px` when the value is a number and the key isn't in your unitless set (`0` still gets `px` per the tests).
- Keep `tabIndex` as-is (only `className` and `htmlFor` are renamed).

%% solution
```js
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);
const UNITLESS = new Set(['opacity', 'zIndex', 'flex', 'flexGrow', 'lineHeight', 'fontWeight', 'order']);
const RENAME = { className: 'class', htmlFor: 'for' };

function styleToString(style) {
  return Object.entries(style)
    .filter(([, v]) => v !== null && v !== undefined && v !== false)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
      return `${prop}:${typeof v === 'number' && !UNITLESS.has(k) ? `${v}px` : v}`;
    })
    .join(';');
}

function attrs(props) {
  let out = '';
  for (const [key, value] of Object.entries(props)) {
    if (key === 'children' || typeof value === 'function' || value === false || value === null || value === undefined) continue;
    const name = RENAME[key] ?? key;
    if (value === true) out += ` ${name}`;
    else if (key === 'style' && typeof value === 'object') out += ` style="${escape(styleToString(value))}"`;
    else out += ` ${name}="${escape(value)}"`;
  }
  return out;
}

export function renderToString(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(renderToString).join('');
  if (typeof node === 'string' || typeof node === 'number') return escape(node);

  const { type, props = {}, children = [] } = node;
  if (typeof type === 'function') return renderToString(type({ ...props, children }));
  if (VOID.has(type)) return `<${type}${attrs(props)} />`;
  return `<${type}${attrs(props)}>${renderToString(children)}</${type}>`;
}
```

%% exercise fe-virtual-window | Virtual list window | 3 | js | js | getVisibleRange | 15
Virtualised lists render only the rows near the viewport. Write the pure maths.

`getVisibleRange({ scrollTop, viewportHeight, itemHeight, itemCount, overscan = 3 })` returns:

```js
{ start, end, offsetTop, totalHeight }
```

- `start` — first row to render: `floor(scrollTop / itemHeight) - overscan`, at least `0`.
- `end` — **exclusive** end: `ceil((scrollTop + viewportHeight) / itemHeight) + overscan`, at most `itemCount`.
- `offsetTop` — pixel offset of the first rendered row (`start * itemHeight`).
- `totalHeight` — `itemCount * itemHeight`.
- Be defensive: negative or oversized `scrollTop` (elastic scrolling) is clamped; `itemCount = 0` gives an empty range; the range never has `end < start`.

%% starter
```js
export function getVisibleRange({ scrollTop, viewportHeight, itemHeight, itemCount, overscan = 3 }) {
  // your code
}
```

%% tests
```js
const base = { viewportHeight: 300, itemHeight: 50, itemCount: 1000 };

describe('getVisibleRange', () => {
  it('at the top shows the first rows plus overscan below', () => {
    expect(getVisibleRange({ ...base, scrollTop: 0 })).toEqual({ start: 0, end: 9, offsetTop: 0, totalHeight: 50000 });
  });
  it('in the middle applies overscan on both sides', () => {
    // rows 10..15 visible, overscan 3 → 7..18 (exclusive 19)
    expect(getVisibleRange({ ...base, scrollTop: 500 })).toEqual({ start: 7, end: 19, offsetTop: 350, totalHeight: 50000 });
  });
  it('handles partially scrolled rows', () => {
    // top row 10 partly hidden, bottom edge inside row 16 → end = ceil(825/50)=17 → 20
    const r = getVisibleRange({ ...base, scrollTop: 525 });
    expect(r.start).toBe(7);
    expect(r.end).toBe(20);
  });
  it('clamps at the bottom', () => {
    const r = getVisibleRange({ ...base, scrollTop: 50000 - 300 });
    expect(r.end).toBe(1000);
    expect(r.start).toBe(994 - 3);
  });
  it('clamps negative and excessive scrollTop', () => {
    expect(getVisibleRange({ ...base, scrollTop: -80 }).start).toBe(0);
    const r = getVisibleRange({ ...base, scrollTop: 999999 });
    expect(r.end).toBe(1000);
    expect(r.start).toBeLessThanOrEqual(r.end);
    expect(r.start).toBeGreaterThanOrEqual(0);
  });
  it('respects a custom overscan, including zero', () => {
    const r = getVisibleRange({ ...base, scrollTop: 500, overscan: 0 });
    expect(r).toMatchObject({ start: 10, end: 16, offsetTop: 500 });
  });
  it('handles fewer items than fit in the viewport', () => {
    expect(getVisibleRange({ viewportHeight: 300, itemHeight: 50, itemCount: 4, scrollTop: 0 })).toEqual({ start: 0, end: 4, offsetTop: 0, totalHeight: 200 });
  });
  it('handles an empty list', () => {
    expect(getVisibleRange({ viewportHeight: 300, itemHeight: 50, itemCount: 0, scrollTop: 0 })).toEqual({ start: 0, end: 0, offsetTop: 0, totalHeight: 0 });
  });
  it('never returns more rows than needed', () => {
    const r = getVisibleRange({ ...base, scrollTop: 12345 });
    expect(r.end - r.start).toBeLessThanOrEqual(6 + 1 + 6);
  });
});
```

%% worked
**A similar problem, solved: pagination maths** — `getPage({ page, pageSize, total })` returns the slice bounds, clamping bad input. The same arithmetic-and-clamp habits.

```js
function getPage({ page, pageSize, total }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));      // ① at least one page, even when empty
  const current = Math.min(Math.max(1, page), pages);          // ② clamp page into [1, pages]
  const start = (current - 1) * pageSize;
  const end = Math.min(total, start + pageSize);               // ③ never past the end
  return { start, end, pages, current };
}
```

For `getVisibleRange`: clamp `scrollTop` to `[0, ...]` first (elastic scrolling on iOS goes negative), compute `start = max(0, floor(top / h) - overscan)` and `end = min(itemCount, ceil((top + viewport) / h) + overscan)`, then make sure `end >= start` (for huge `scrollTop`, `start` can exceed `end` — clamp `end` up to `start`, or `start` down). `offsetTop = start * h`, `totalHeight = count * h`, and `itemCount = 0` gives `start = end = 0`.

%% explain
- **`start`**: `floor(scrollTop / itemHeight) - overscan`, at least `0`.
- **`end`** (exclusive): `ceil((scrollTop + viewportHeight) / itemHeight) + overscan`, at most `itemCount`.
- **`offsetTop = start * itemHeight`**; **`totalHeight = itemCount * itemHeight`**; `overscan` defaults to 3.
- **Defensive**: negative or oversized `scrollTop` is clamped; `itemCount = 0` → empty range; never `end < start`.

%% nudge
- What happens if `scrollTop` is larger than the whole list?
- Which two values must be compared at the end so the range is never inverted?

%% hints
- `first = floor(scrollTop / itemHeight)`, `last = ceil((scrollTop + viewportHeight) / itemHeight)` — then add/subtract `overscan`.
- Clamp with `Math.max(0, …)` and `Math.min(itemCount, …)`; clamp `start` to at most `end` too.
- Clamp `scrollTop` into `[0, max(0, totalHeight − viewportHeight)]` first — that makes the "excessive scroll" case fall out.

%% solution
```js
export function getVisibleRange({ scrollTop, viewportHeight, itemHeight, itemCount, overscan = 3 }) {
  const totalHeight = itemCount * itemHeight;
  const maxScroll = Math.max(0, totalHeight - viewportHeight);
  const top = Math.min(Math.max(scrollTop, 0), maxScroll);
  const first = Math.floor(top / itemHeight);
  const last = Math.ceil((top + viewportHeight) / itemHeight);
  const end = Math.min(itemCount, last + overscan);
  const start = Math.min(Math.max(0, first - overscan), end);
  return { start, end, offsetTop: start * itemHeight, totalHeight };
}
```

%% exercise fe-rank-suggestions | Autocomplete ranking | 3 | js | js | rankSuggestions | 25
Write `rankSuggestions(query, items)` — the brain of a command palette. It returns the matching items (strings) ranked best-first.

Matching is **case-insensitive**. Score each item by the best rule that applies:

| Rule | Score |
| --- | --- |
| item equals query | 1000 |
| item starts with query | 800 |
| a **word** in the item starts with query (words split on space, `-`, `_`, `/`, `.`) | 600 |
| item contains query as a substring | 400 |
| query is a **subsequence** of the item (`hlo` ⊂ `hello`) | 200 |
| otherwise | *excluded* |

Sort by score descending; break ties by **shorter** item first, then alphabetically (case-insensitive), then original order. An empty (or whitespace-only) query returns all items sorted **alphabetically** (case-insensitive) — no length rule. The input array isn't mutated; duplicates are kept.

%% starter
```js
export function rankSuggestions(query, items) {
  // your code
}
```

%% tests
```js
describe('rankSuggestions', () => {
  it('orders exact > prefix > word prefix > substring > subsequence', () => {
    const items = ['xhelloz', 'say hello', 'hello world', 'hello', 'h-e-l-l-o'];
    expect(rankSuggestions('hello', items)).toEqual(['hello', 'hello world', 'say hello', 'xhelloz', 'h-e-l-l-o']);
  });

  it('matches case-insensitively', () => {
    expect(rankSuggestions('REACT', ['react', 'Preact', 'ReactDOM'])).toEqual(['react', 'ReactDOM', 'Preact']);
  });

  it('matches word starts across separators', () => {
    expect(rankSuggestions('bar', ['foo bar', 'foobar', 'a-bar', 'bbb_bar', 'c/bar.js'])).toEqual(['a-bar', 'bbb_bar', 'foo bar', 'c/bar.js', 'foobar']);
  });

  it('supports fuzzy subsequences last', () => {
    expect(rankSuggestions('gtb', ['go to bottom', 'git branch', 'bag it'])).toEqual(['git branch', 'go to bottom']);
  });

  it('excludes non-matches', () => {
    expect(rankSuggestions('zzz', ['abc', 'def'])).toEqual([]);
  });

  it('breaks ties by shorter length, then alphabetically', () => {
    expect(rankSuggestions('a', ['ab', 'a', 'abc', 'aa', 'Ac'])).toEqual(['a', 'aa', 'ab', 'Ac', 'abc']);
  });

  it('returns everything alphabetically for an empty query', () => {
    expect(rankSuggestions('', ['pear', 'Apple', 'fig'])).toEqual(['Apple', 'fig', 'pear']);
    expect(rankSuggestions('   ', ['b', 'a'])).toEqual(['a', 'b']);
  });

  it('keeps duplicates and does not mutate the input', () => {
    const src = Object.freeze(['b', 'a', 'a']);
    expect(rankSuggestions('a', src)).toEqual(['a', 'a']);
  });

  it('is stable for equal candidates', () => {
    const items = ['A', 'a'];
    expect(rankSuggestions('a', items)).toEqual(['A', 'a']);
  });

  it('subsequence must keep order', () => {
    expect(rankSuggestions('olh', ['hello'])).toEqual([]);
  });

  it('handles regex-special characters literally', () => {
    expect(rankSuggestions('a.b', ['a.b', 'axb', 'a.bc'])).toEqual(['a.b', 'a.bc']);
    expect(rankSuggestions('(', ['f(x)', 'abc'])).toEqual(['f(x)']);
  });

  it('ranks 200 000 candidates quickly', () => {
    const items = Array.from({ length: 200000 }, (_, i) => `item-${i}`);
    const start = Date.now();
    const out = rankSuggestions('item-1999', items);
    expect(out[0]).toBe('item-1999');
    expect(Date.now() - start).toBeLessThan(1500);
  });
});
```

%% worked
**A similar problem, solved: rank files by how well they match a search** with a score function and a stable multi-key sort.

```js
function score(query, name) {
  const q = query.toLowerCase(), n = name.toLowerCase();
  if (n === q) return 100;              // ① rules from BEST to worst; the first that applies wins
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 40;
  return 0;                             // ② 0 = no match → excluded
}

function rankFiles(query, names) {
  return names
    .map((name, index) => ({ name, index, s: score(query, name) }))   // ③ carry the ORIGINAL index for the final tie-break
    .filter((x) => x.s > 0)
    .sort((a, b) =>
      b.s - a.s ||                                        // ④ higher score first, THEN…
      a.name.length - b.name.length ||                    //    shorter first, THEN…
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()) ||   //    alphabetical, THEN…
      a.index - b.index)                                  //    original order
    .map((x) => x.name);
}
```

The `||` chain works because a tie returns `0`, which is falsy, so the next rule takes over. In the exercise add the **word-start** rule (split on `[\s\-_/.]+` and test each word), the **subsequence** rule, the **empty-query** case (sorted alphabetically, *no* length rule), and don't mutate the input.

%% explain
- **Case-insensitive**; score by the best rule: equals `1000`, starts-with `800`, a **word** starts with it `600`, contains `400`, **subsequence** `200`, otherwise excluded.
- **Sorted by score descending**; ties → shorter item, then alphabetical (case-insensitive), then original order.
- **Empty/whitespace query** → all items sorted alphabetically (case-insensitive), no length rule.
- **Input isn't mutated**; duplicates are kept.

%% nudge
- How can the comparator apply "score, then length, then alphabet, then original index" in one function?
- How do you test "a word in the item starts with the query" (what are the word separators)?

%% hints
- Write `score(q, item)` first. Lower-case both once. Use `indexOf` for substring; split on `/[\s\-_/.]+/` for words.
- Subsequence: walk the item once with a pointer into the query.
- Decorate → sort → undecorate: `items.map((item, i) => ({ item, i, score })).filter(...)`, sort with a comparator that chains score, length, `localeCompare`, index.
- Avoid regexes built from user input — use string methods so `(` and `.` are literal.

%% solution
```js
const SEP = /[\s\-_/.]+/;

function score(q, item) {
  const s = item.toLowerCase();
  if (s === q) return 1000;
  if (s.startsWith(q)) return 800;
  if (s.split(SEP).some((w) => w.startsWith(q))) return 600;
  if (s.includes(q)) return 400;
  let qi = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) if (s[i] === q[qi]) qi++;
  return qi === q.length ? 200 : 0;
}

export function rankSuggestions(query, items) {
  const q = query.trim().toLowerCase();
  const byName = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());
  if (!q) return [...items].sort(byName);
  return items
    .map((item, i) => ({ item, i, score: score(q, item) }))
    .filter((e) => e.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.length - b.item.length ||
        byName(a.item, b.item) ||
        a.i - b.i,
    )
    .map((e) => e.item);
}
```
