---
id: sec-xss
track: sec
title: Cross-site scripting & output encoding
summary: How attacker-controlled text becomes attacker-controlled code, and the habits that stop it: escaping for the right context, auto-escaping templates, safe URLs, allowlist sanitizing, and writing tests that prove your escaping works.
---

## The idea in one sentence

The browser treats text in your page as **markup or code** unless you make it **inert**, so any data you didn't write must be **encoded for where it lands**.

> **Analogy** A mail room that opens every envelope and reads it aloud over the loudspeaker. If someone mails a note saying "Everyone evacuate!", the building empties. The fix isn't to read fewer notes; it's to read them in a way that can never be mistaken for an announcement: quote them ("The note says: …").

This lesson is **defensive**: how XSS happens (so you recognise it) and the techniques that reliably prevent it.

## What cross-site scripting is

**XSS** means an attacker gets **their JavaScript to run in your page**, so it runs with your site's powers: the victim's logged-in session, their data, their clicks.

![How stored XSS works](fig:sec-xss-flow "The text was only data until a template inserted it as HTML.")

Three flavours, one cause:

- **Stored**: the payload is saved (a comment, a profile name) and shown to others later.
- **Reflected**: the payload is in the request (a search query) and echoed straight back.
- **DOM-based**: client code reads something (`location.hash`) and writes it into the page with `innerHTML`.

The cause is always the same: **untrusted data crossed into a markup/code context without encoding**.

![Validate on the way in, encode on the way out](fig:sec-trust-boundary "Validate shape when data enters, then encode for the specific destination when it leaves.")

## Encode for the destination

![Output contexts](fig:sec-contexts "The place the data lands decides which escaping rule applies.")

Minimum for HTML text and quoted attributes: turn `& < > " '` into their **entities**. Order matters: replace `&` **first** (or in one pass), or you will double-escape your own entities.

```js try predict
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const comment = '<img src=x onerror="steal()">';
console.log(escapeHtml(comment));
console.log('<p>' + escapeHtml(comment) + '</p>');
```

The browser will now **show** the characters instead of **executing** them.

## Make the safe way the easy way

Hand-escaping is a chore, and forgetting once is a vulnerability. Good systems **escape by default**: React does it for JSX `{value}`, and a **tagged template** can do it for plain strings, with an explicit, greppable **opt-out** (`raw`) for markup you wrote yourself.

```stepper An auto-escaping template
code:
  const name = '<b>Ada</b>';
  html`<p>Hello, ${name}!</p>`
  html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`
  html`<div>${raw('<hr>')}</div>`
---
line: 2
say: The **literal parts** (`<p>Hello, ` and `!</p>`) are written by you, so they stay as markup. The **value** `name` is data, so it gets **escaped**: `&lt;b&gt;Ada&lt;/b&gt;`.
output: <p>Hello, &lt;b&gt;Ada&lt;/b&gt;!</p>
---
line: 3
say: Nested templates: the inner `html` returns a **safe** result, so the outer one doesn't escape it again. Each item inside is still escaped on its own.
output: <ul><li>…escaped…</li></ul>
---
line: 4
say: `raw(...)` is the **deliberate opt-out** for markup you control. Every use is a place a reviewer should look at.
output: <div><hr></div>
```

## URLs are their own context

An `href` or `src` can carry **code** in the scheme: `javascript:…`. Escaping quotes doesn't help; you need an **allowlist of schemes** (`http`, `https`, `mailto`, plus relative paths). Browsers are lenient: they ignore leading spaces and control characters, **tabs and newlines inside the scheme**, and compare schemes **case-insensitively**, so a good check normalises the same way before judging.

```js try
function safeUrl(input) {
  const s = String(input).replace(/[\t\r\n]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);
  if (m) return ['http', 'https', 'mailto'].includes(m[1].toLowerCase()) ? s : null;
  return /^[\/\\]{2}/.test(s) ? null : s;
}
console.log(safeUrl('https://example.com/a'), safeUrl('JaVaScRiPt:alert(1)'), safeUrl('java\tscript:alert(1)'));
```

Prefer **allowlists to blocklists**: you can't list every bad scheme, but you can list the few good ones.

## Rich text: sanitize with an allowlist

Sometimes users must submit **some** HTML (bold, links). Then **sanitize**: keep a small **allowlist** of tags and attributes, drop everything else, and escape all remaining text. Don't write this casually in production (use a vetted library such as DOMPurify), but building one teaches exactly which rules matter.

## Defence in depth

Escaping is the primary defence. Layers behind it: a **Content Security Policy** (a later lesson), **HttpOnly cookies** (script can't read them), avoiding `innerHTML` / `dangerouslySetInnerHTML` / `eval`, and using `textContent`.

## Quick check

```check
Q: What is the root cause of every XSS bug?
A) Using JavaScript
B) Untrusted data placed in a markup or code context without being encoded for it *
C) Weak passwords
D) Slow servers
Why: Data that should have been inert was interpreted by the browser as HTML or script.
---
Q: Why replace `&` first when escaping HTML?
A) It is alphabetical
B) Otherwise you would escape the `&` in the entities you just produced, giving `&amp;lt;` *
C) `&` is the most dangerous character
D) It is faster
Why: Escaping `&` last turns `&lt;` into `&amp;lt;`.
---
Q: Why is escaping quotes not enough for `<a href="${url}">`?
A) It is
B) The danger is the URL scheme (`javascript:`), so you need a scheme allowlist *
C) Quotes are not special in attributes
D) URLs can't contain code
Why: The scheme itself can execute code when clicked.
---
Q: Which is the better policy for URL schemes?
A) Block `javascript:`
B) Allow only a short list such as http, https, mailto *
C) Block everything with a colon
D) Lower-case it and hope
Why: Blocklists miss variants; allowlists don't.
---
Q: What is the purpose of a `raw()` escape hatch in an auto-escaping template?
A) To make templates faster
B) A visible, searchable marker where trusted markup is deliberately inserted *
C) To disable security
D) To format numbers
Why: Escaping by default plus an explicit opt-out keeps risky spots easy to review.
```

## Recap

- XSS = untrusted data interpreted as markup or code. **Encode for the destination**.
- HTML and attributes: escape `& < > " '`, **`&` first**.
- **Auto-escaping templates** make the safe path the default; `raw` is the reviewed exception.
- URLs need a **scheme allowlist**, applied after normalising like a browser would.
- Rich text needs an **allowlist sanitizer** (use a vetted library in production).
- Layer defences: CSP, HttpOnly cookies, avoid `innerHTML`.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: escapeHtml | Five replacements, ampersand first |
| An auto-escaping `html` template | A tagged template, a "safe" wrapper type, recursion over arrays |
| A safe URL filter | Normalising like a browser, a scheme allowlist, relative-URL rules |
| An allowlist sanitizer | A tag tokenizer, an allowlist, attribute dropping |
| Tests for escapeHtml | Inputs that expose each missing replacement |
| Tests for safeUrl | Bypass attempts: case, whitespace, control characters, `//` |

%% exercise sec-guided-escape | Guided: escapeHtml | 1 | js | js | escapeHtml | 8 | guided
Implement `escapeHtml(value)`. Convert the value to a string and replace `&`, `<`, `>`, `"` and `'` with `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&#39;`. `null` and `undefined` become the empty string.

```js
escapeHtml('<b>"Tom" & Jerry</b>'); // '&lt;b&gt;&quot;Tom&quot; &amp; Jerry&lt;/b&gt;'
```

%% worked
**A similar problem, solved: `escapeXmlText(value)`** — the same idea with fewer characters.

```js
function escapeXmlText(value) {
  if (value == null) return '';                 // ① "no value" is empty, not the word "null"
  return String(value)
    .replace(/&/g, '&amp;')                     // ② ampersand FIRST
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

If `&` were replaced **last**, the `&lt;` produced for `<` would be turned into `&amp;lt;`, which would display as the literal text `&lt;`.

%% explain
- **Five replacements**, with `&` first.
- **Strings only on the way out**: numbers and other values are converted.
- **`null` / `undefined`** give `''`.

%% nudge
- What goes wrong if the `&` replacement runs after the `<` one?
- How do you apply a replacement to every occurrence, not just the first?

%% starter
```js
export function escapeHtml(value) {
  // Step 1 — if (value == null) return '';
  // Step 2 — String(value).replace(/&/g, '&amp;') then the other four
  return '';
}
```

%% tests
```js
describe('escapeHtml', () => {
  it('escapes the five special characters', () => {
    expect(escapeHtml('&')).toBe('&amp;');
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('>')).toBe('&gt;');
    expect(escapeHtml('"')).toBe('&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });
  it('escapes a script tag', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });
  it('does not double escape its own output', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
  it('escapes every occurrence', () => {
    expect(escapeHtml('<<>>""&&')).toBe('&lt;&lt;&gt;&gt;&quot;&quot;&amp;&amp;');
  });
  it('leaves safe text alone and converts other values', () => {
    expect(escapeHtml('plain text 123')).toBe('plain text 123');
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(true)).toBe('true');
  });
  it('treats null and undefined as empty', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
```

%% hints
- `String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')`

%% solution
```js
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

%% exercise sec-html-template | An auto-escaping html template | 3 | js | js | html, raw | 20
Implement a **tagged template** `html` and a helper `raw`.

- `html` escapes every interpolated value (`& < > " '`), but leaves the template's **own literal text** untouched.
- `null` and `undefined` become `''`; numbers and booleans become their text.
- An **array** is rendered item by item and joined with no separator, each item treated by the same rules.
- `raw(text)` marks text as **already safe**: inserted verbatim.
- The result of `html` is itself **safe**: put inside another `html` it is **not escaped again**. `String(result)` gives the text.

```js
html`<p>${'<b>'}</p>`.toString(); // '<p>&lt;b&gt;</p>'
```

%% worked
**A similar problem, solved: `sqlish` — a tag that wraps values in quotes safely.**

```js
class Safe { constructor(text) { this.text = text; } toString() { return this.text; } }
export const trusted = (t) => new Safe(String(t));            // ① a wrapper type means "already safe"

const encode = (v) =>
  v instanceof Safe ? v.text                                  // ② safe values pass through
  : Array.isArray(v) ? v.map(encode).join('')                 // ③ arrays: encode each item
  : v == null ? '' : String(v).replace(/'/g, "''");           // ④ everything else is encoded

export function quoted(strings, ...values) {
  return new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? encode(values[i]) : ''), ''));
}
```

The key idea is a **distinct type** for safe text: a plain string can never be mistaken for it, so only your own helper (`quoted`, `raw`) can produce "already safe" output.

%% explain
- **A `Safe` wrapper** class for trusted output.
- **Literal parts** are copied as-is; **values** are encoded.
- **Arrays** and **nested templates** work through the same function.
- **`raw`** is the only way to skip escaping.

%% nudge
- Why must a nested `html` result not be escaped again?
- How do you tell "already safe" apart from a normal string?

%% starter
```js
export function raw(text) {
  return text;
}

export function html(strings, ...values) {
  return strings.join('');
}
```

%% tests
```js
describe('html', () => {
  it('escapes interpolated values only', () => {
    expect(String(html`<p>Hello, ${'<b>Ada</b>'}!</p>`)).toBe('<p>Hello, &lt;b&gt;Ada&lt;/b&gt;!</p>');
  });
  it('escapes quotes so attributes stay intact', () => {
    expect(String(html`<input value="${'" onfocus="x'}">`)).toBe('<input value="&quot; onfocus=&quot;x">');
  });
  it('handles null, undefined, numbers and booleans', () => {
    expect(String(html`[${null}][${undefined}][${0}][${42}][${false}][${true}]`)).toBe('[][][0][42][false][true]');
  });
  it('renders arrays item by item', () => {
    expect(String(html`<ul>${['<a>', 'b']}</ul>`)).toBe('<ul>&lt;a&gt;b</ul>');
    expect(String(html`${[]}`)).toBe('');
  });
  it('does not escape nested html results', () => {
    const items = ['x', '<y>'];
    const list = html`<ul>${items.map((i) => html`<li>${i}</li>`)}</ul>`;
    expect(String(list)).toBe('<ul><li>x</li><li>&lt;y&gt;</li></ul>');
    expect(String(html`<div>${list}</div>`)).toBe('<div><ul><li>x</li><li>&lt;y&gt;</li></ul></div>');
  });
  it('raw inserts markup verbatim', () => {
    expect(String(html`<div>${raw('<hr>')}</div>`)).toBe('<div><hr></div>');
    expect(String(html`${[raw('<b>'), '<i>']}`)).toBe('<b>&lt;i&gt;');
  });
  it('does not treat a plain string that looks like html as safe', () => {
    expect(String(html`${'<hr>'}`)).toBe('&lt;hr&gt;');
  });
  it('keeps literal text untouched, including ampersands', () => {
    expect(String(html`a & b ${'c'}`)).toBe('a & b c');
  });
  it('works with no values', () => {
    expect(String(html`<br>`)).toBe('<br>');
  });
});
```

%% hints
- `class Safe { constructor(t) { this.text = t; } toString() { return this.text; } }`
- `encode(v)`: `Safe` → `v.text`; array → `v.map(encode).join('')`; `null`/`undefined` → `''`; else `escape(String(v))`.
- `html`: `new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? encode(values[i]) : ''), ''))`.

%% solution
```js
class Safe {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}

const escape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const encode = (v) => {
  if (v instanceof Safe) return v.text;
  if (Array.isArray(v)) return v.map(encode).join('');
  if (v == null) return '';
  return escape(String(v));
};

export const raw = (text) => new Safe(String(text));

export function html(strings, ...values) {
  return new Safe(strings.reduce((out, s, i) => out + s + (i < values.length ? encode(values[i]) : ''), ''));
}
```

%% exercise sec-safe-url | A safe URL filter | 3 | js | js | safeUrl | 22
Implement `safeUrl(input, { allowed = ['http:', 'https:', 'mailto:'] } = {})`. It returns a **URL string that is safe to put in an `href`**, or `null`.

1. A non-string, or a string that is empty after cleaning, gives `null`.
2. **Clean it like a browser does**: remove **leading and trailing** characters in `\u0000`–` `, and remove **tab, carriage return and newline** characters **anywhere**.
3. If the cleaned text starts with a **scheme** (`letters/digits/+/-/.` starting with a letter, then `:`), it must be in `allowed` (compared **case-insensitively**, e.g. `JaVaScRiPt:` is `javascript:`), otherwise `null`.
4. With no scheme it is **relative**: allowed (`/path`, `./x`, `?q`, `#top`, `page.html`), **except** anything starting with two slash-like characters (`//`, `/\`, `\\`, `\/`), which would mean another host: `null`.
5. Return the **cleaned** string.

```js
safeUrl(' JaVaScRiPt:alert(1)'); // null
safeUrl('/docs/a?b=1');          // '/docs/a?b=1'
```

%% worked
**A similar problem, solved: `safeImageSrc(input)`** — normalise first, then allowlist.

```js
export function safeImageSrc(input) {
  if (typeof input !== 'string') return null;
  const s = input.replace(/[\t\r\n]/g, '').trim();                  // ① normalise the way a browser would
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);                   // ② is there a scheme?
  if (m) return m[1].toLowerCase() === 'https' ? s : null;           // ③ allowlist, case-insensitively
  return s.startsWith('//') ? null : s;                              // ④ no scheme: relative, but not "another host"
}
```

Normalise **before** you judge: `"java\tscript:"` contains a tab, so the scheme regex wouldn't match it as written, yet the browser would run it. That is how blocklists get bypassed.

%% explain
- **Cleaning** matches browser behaviour (control chars at the ends, tab/CR/LF anywhere).
- **Scheme** found → case-insensitive allowlist; none → relative.
- **Host-relative** forms (`//`, `/\`) are refused.
- **Returns** the cleaned string or `null`.

%% nudge
- Why must the scheme check happen after removing tabs and newlines?
- Which characters make a "relative" URL point to a different host?

%% starter
```js
export function safeUrl(input, { allowed = ['http:', 'https:', 'mailto:'] } = {}) {
  // Step 1 — return null unless input is a string
  // Step 2 — clean it, find a scheme, apply the rules
  return null;
}
```

%% tests
```js
describe('safeUrl', () => {
  it('returns allowed absolute URLs', () => {
    expect(safeUrl('https://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c');
    expect(safeUrl('HTTP://Example.com')).toBe('HTTP://Example.com');
    expect(safeUrl('mailto:ada@example.com')).toBe('mailto:ada@example.com');
  });
  it('returns relative URLs', () => {
    for (const u of ['/docs/a', './x', '../y', '?q=1', '#top', 'page.html', 'a/b:c']) expect(safeUrl(u)).toBe(u);
  });
  it('rejects dangerous schemes in any case', () => {
    for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,hi', 'vbscript:x', 'file:///etc/passwd', 'ftp://x.com']) {
      expect(safeUrl(u)).toBeNull();
    }
  });
  it('cleans like a browser before judging', () => {
    expect(safeUrl('  https://example.com  ')).toBe('https://example.com');
    expect(safeUrl(' javascript:alert(1)')).toBeNull();
    expect(safeUrl('\u0001javascript:alert(1)')).toBeNull();
    expect(safeUrl('java\tscript:alert(1)')).toBeNull();
    expect(safeUrl('java\nscript:alert(1)')).toBeNull();
    expect(safeUrl('jav\r\nascript:alert(1)')).toBeNull();
    expect(safeUrl('ht\ttps://example.com')).toBe('https://example.com');
  });
  it('rejects host-relative URLs', () => {
    for (const u of ['//evil.example/x', '/\\evil.example', '\\\\evil.example', '\\/evil.example']) expect(safeUrl(u)).toBeNull();
  });
  it('rejects empty and non-string input', () => {
    for (const u of ['', '   ', '\t\n', null, undefined, 42, {}]) expect(safeUrl(u)).toBeNull();
  });
  it('supports a custom allowlist', () => {
    expect(safeUrl('ftp://files.example/x', { allowed: ['ftp:'] })).toBe('ftp://files.example/x');
    expect(safeUrl('https://example.com', { allowed: ['ftp:'] })).toBeNull();
    expect(safeUrl('/relative', { allowed: [] })).toBe('/relative');
  });
});
```

%% hints
- `const s = input.replace(/[\t\r\n]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');`
- `const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);` then `allowed.includes(m[1].toLowerCase() + ':')`.
- Host-relative: `/^[\/\\]{2}/.test(s)`.

%% solution
```js
export function safeUrl(input, { allowed = ['http:', 'https:', 'mailto:'] } = {}) {
  if (typeof input !== 'string') return null;
  const s = input.replace(/[\t\r\n]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (s === '') return null;
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);
  if (m) return allowed.includes(m[1].toLowerCase() + ':') ? s : null;
  if (/^[\/\\]{2}/.test(s)) return null;
  return s;
}
```

%% exercise sec-sanitize-html | An allowlist HTML sanitizer | 4 | js | js | sanitizeHtml | 34
Implement `sanitizeHtml(input)` for user-submitted rich text. It returns safe HTML using an **allowlist**.

- Allowed tags: `b i em strong p br ul ol li a code`. Tag names are matched **case-insensitively** and output in lower case. Any other tag is **removed** but its text content stays.
- `<script>…</script>` and `<style>…</style>` are removed **with their contents**. HTML comments are removed.
- **All attributes are dropped**, except `href` on `a`. An `href` is kept only if it is `http:`, `https:`, `mailto:` or a path starting with a single `/` (after removing whitespace and control characters, compared case-insensitively); otherwise the `<a>` stays without `href`. Every `<a>` gets `rel="noopener noreferrer"`. A kept `href` value is escaped (`& < > "`).
- `<br>`, `<br/>` and `</br>`-style forms: output `<br>` once for an opening one and nothing for a closing one.
- **Text** is escaped: `<` and `>` become `&lt;` `&gt;`, and `&` becomes `&amp;` unless it already starts a valid entity (`&amp;`, `&#39;`, `&copy;`).
- `null` and `undefined` give `''`.

```js
sanitizeHtml('<b onclick="evil()">hi</b><script>x()</script>'); // '<b>hi</b>'
```

%% worked
**A similar problem, solved: `stripTags(input, allowed)`** — walk the tags with one regex.

```js
export function stripTags(input, allowed) {
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;   // ① a tag; quoted attribute values may contain ">"
  let out = '', last = 0, m;
  while ((m = tag.exec(input))) {
    out += input.slice(last, m.index);          // ② the text before this tag
    last = tag.lastIndex;
    const name = m[2].toLowerCase();
    if (allowed.includes(name)) out += `<${m[1]}${name}>`;   // ③ rebuild allowed tags WITHOUT their attributes
  }
  return out + input.slice(last);               // ④ the tail
}
```

Rebuilding tags from scratch (rather than editing the original) is the safety trick: nothing from the attacker's tag survives except the name you allowed. Remove `script`/`style` blocks **first**, then comments; escape the text pieces between tags.

%% explain
- **Pre-pass**: drop `script`/`style` blocks and comments.
- **Tokenise** tags with a regex that respects quotes.
- **Rebuild** allowed tags without attributes (except the checked `href`).
- **Escape** the text between tags.

%% nudge
- Why rebuild a tag instead of removing bad attributes from it?
- What does an unmatched `<` in plain text (like `a < b`) turn into?

%% starter
```js
export function sanitizeHtml(input) {
  return '';
}
```

%% tests
```js
describe('sanitizeHtml', () => {
  it('keeps allowed formatting', () => {
    expect(sanitizeHtml('<b>bold</b> and <i>it</i> <em>e</em> <strong>s</strong> <code>c</code>')).toBe('<b>bold</b> and <i>it</i> <em>e</em> <strong>s</strong> <code>c</code>');
    expect(sanitizeHtml('<ul><li>one</li><li>two</li></ul><p>p</p>')).toBe('<ul><li>one</li><li>two</li></ul><p>p</p>');
  });
  it('lower-cases tag names', () => {
    expect(sanitizeHtml('<B>Shout</B>')).toBe('<b>Shout</b>');
  });
  it('removes scripts and styles with their contents, and comments', () => {
    expect(sanitizeHtml('<script>alert(1)</script>hello')).toBe('hello');
    expect(sanitizeHtml('a<SCRIPT type="x">bad()</SCRIPT>b')).toBe('ab');
    expect(sanitizeHtml('<style>p{color:red}</style>ok')).toBe('ok');
    expect(sanitizeHtml('<!-- hidden -->visible')).toBe('visible');
  });
  it('drops disallowed tags but keeps their text', () => {
    expect(sanitizeHtml('<div><p>Hi</p></div>')).toBe('<p>Hi</p>');
    expect(sanitizeHtml('<img src=x onerror=alert(1)>text')).toBe('text');
    expect(sanitizeHtml('<iframe src="//evil.example"></iframe>x')).toBe('x');
  });
  it('drops all attributes except a checked href', () => {
    expect(sanitizeHtml('<b onclick="evil()" style="x:y">x</b>')).toBe('<b>x</b>');
    expect(sanitizeHtml('<p class="a" id=b>x</p>')).toBe('<p>x</p>');
  });
  it('keeps safe hrefs and adds rel', () => {
    expect(sanitizeHtml('<a href="https://ex.com/p?a=1&b=2" onclick="x">l</a>')).toBe('<a href="https://ex.com/p?a=1&amp;b=2" rel="noopener noreferrer">l</a>');
    expect(sanitizeHtml("<a href='/docs'>d</a>")).toBe('<a href="/docs" rel="noopener noreferrer">d</a>');
    expect(sanitizeHtml('<a href=mailto:a@b.co>m</a>')).toBe('<a href="mailto:a@b.co" rel="noopener noreferrer">m</a>');
  });
  it('drops unsafe hrefs but keeps the link text', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe('<a rel="noopener noreferrer">x</a>');
    expect(sanitizeHtml('<a href=" JaVaScRiPt:alert(1)">x</a>')).toBe('<a rel="noopener noreferrer">x</a>');
    expect(sanitizeHtml('<a href="java&#10;script:x">x</a>')).toBe('<a rel="noopener noreferrer">x</a>');
    expect(sanitizeHtml('<a href="//evil.example">x</a>')).toBe('<a rel="noopener noreferrer">x</a>');
    expect(sanitizeHtml('<a href="data:text/html,x">x</a>')).toBe('<a rel="noopener noreferrer">x</a>');
  });
  it('handles quotes containing >', () => {
    expect(sanitizeHtml('<a href="x>y" title="a>b">t</a>')).toBe('<a rel="noopener noreferrer">t</a>');
    expect(sanitizeHtml('<b title="1>2">t</b>')).toBe('<b>t</b>');
  });
  it('handles br forms', () => {
    expect(sanitizeHtml('a<br>b<br/>c<BR />d')).toBe('a<br>b<br>c<br>d');
  });
  it('escapes stray angle brackets and ampersands in text', () => {
    expect(sanitizeHtml('a < b && c > d')).toBe('a &lt; b &amp;&amp; c &gt; d');
    expect(sanitizeHtml('Tom &amp; Jerry &#39;s &copy;')).toBe('Tom &amp; Jerry &#39;s &copy;');
  });
  it('resists nested-tag tricks', () => {
    const out = sanitizeHtml('<scr<script>ipt>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<scr<');
    expect(sanitizeHtml('<<b>b>x')).not.toMatch(/<[^bpiae/]/);
  });
  it('handles null, undefined and plain text', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
    expect(sanitizeHtml('just text')).toBe('just text');
  });
});
```

%% hints
- First remove blocks: `s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')`, then `<!--...-->`.
- Tag regex: `/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g`.
- Text escape: `t.replace(/&(?!#?[A-Za-z0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')`.
- For `a`: find `href` in the attribute text, clean it, check `/^(https?:|mailto:)/i` or `/^\/(?![\/\\])/`.
- Decode nothing: `java&#10;script:` has no scheme match but is not an allowed form, so it is dropped.

%% solution
```js
const ALLOWED = new Set(['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a', 'code']);

const escapeText = (t) => t.replace(/&(?!#?[A-Za-z0-9]+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function okHref(value) {
  const s = value.replace(/[\t\r\n]/g, '').replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (/^(https?:|mailto:)/i.test(s)) return s;
  if (/^\/(?![\/\\])/.test(s)) return s;
  return null;
}

export function sanitizeHtml(input) {
  let s = String(input ?? '');
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tag.exec(s))) {
    out += escapeText(s.slice(last, m.index));
    last = tag.lastIndex;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (!ALLOWED.has(name)) continue;
    if (name === 'br') {
      if (!closing) out += '<br>';
      continue;
    }
    if (closing) {
      out += `</${name}>`;
    } else if (name === 'a') {
      const found = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(m[3]);
      const href = found ? okHref(found[1] ?? found[2] ?? found[3]) : null;
      out += href ? `<a href="${escapeAttr(href)}" rel="noopener noreferrer">` : '<a rel="noopener noreferrer">';
    } else {
      out += `<${name}>`;
    }
  }
  return out + escapeText(s.slice(last));
}
```

%% exercise sec-check-escape | Tests for escapeHtml | 3 | js | js | checkEscapeHtml | 20
`escapeHtml(value)` converts `&` `<` `>` `"` `'` to `&amp;` `&lt;` `&gt;` `&quot;` `&#39;`, turns `null` and `undefined` into `''`, and converts other values with `String`. Write `checkEscapeHtml(escapeHtml)` that passes for a correct one and **fails** for: **forgets ampersands**, **forgets <**, **forgets >**, **forgets double quotes**, **forgets single quotes**, **escapes ampersands last (double escaping)**, **throws on numbers**, **turns null into the word "null"**.

```js
expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
```

%% worked
**A similar problem, solved: `checkEscapeXml(escapeXml)`** — one assertion per rule, plus the **interaction** between rules.

```js
export function checkEscapeXml(escapeXml) {           // & < > only
  expect(escapeXml('&')).toBe('&amp;');               // ① each character alone: a missing rule fails exactly one line
  expect(escapeXml('<')).toBe('&lt;');
  expect(escapeXml('>')).toBe('&gt;');
  expect(escapeXml('<')).not.toBe('&amp;lt;');        // ② the interaction: escaping & after < would double escape
  expect(escapeXml('a & b')).toBe('a &amp; b');       // ③ inside normal text
  expect(escapeXml(null)).toBe('');                   // ④ non-string inputs
  expect(escapeXml(42)).toBe('42');
}
```

Rules that **interact** (here: the order of replacements) need an input that exercises the interaction: a lone `<` is enough to expose "ampersand last".

%% explain
- **Each of the five characters** alone.
- **`<` alone** exposes double escaping (ampersand last).
- **Non-strings**: `42`, `null`, `undefined`.

%% nudge
- Which single input reveals that `&` was replaced last?
- What does `String(null)` give, and why is that a bug here?

%% starter
```js
export function checkEscapeHtml(escapeHtml) {
  expect(escapeHtml('<b>')).toBe('&lt;b&gt;');
  // your assertions: every character alone, the order bug, null/undefined/numbers
}
```

%% tests
```js
const make = ({ amp = true, lt = true, gt = true, dq = true, sq = true, ampLast = false, strictString = false, nullWord = false } = {}) => (v) => {
  if (v == null) return nullWord ? 'null' : '';
  if (strictString && typeof v !== 'string') throw new TypeError('not a string');
  let s = String(v);
  if (amp && !ampLast) s = s.replace(/&/g, '&amp;');
  if (lt) s = s.replace(/</g, '&lt;');
  if (gt) s = s.replace(/>/g, '&gt;');
  if (dq) s = s.replace(/"/g, '&quot;');
  if (sq) s = s.replace(/'/g, '&#39;');
  if (amp && ampLast) s = s.replace(/&/g, '&amp;');
  return s;
};
const correct = make();
const mutants = {
  'forgets ampersands': make({ amp: false }),
  'forgets <': make({ lt: false }),
  'forgets >': make({ gt: false }),
  'forgets double quotes': make({ dq: false }),
  'forgets single quotes': make({ sq: false }),
  'escapes ampersands last': make({ ampLast: true }),
  'throws on numbers': make({ strictString: true }),
  'turns null into "null"': make({ nullWord: true }),
};

describe('your checkEscapeHtml', () => {
  it('passes on a correct escapeHtml', () => {
    expect(() => checkEscapeHtml(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an escapeHtml that ${name}`, () => {
      expect(() => checkEscapeHtml(impl)).toThrow();
    });
  }
});
```

%% hints
- One assertion per character: `&`, `<`, `>`, `"`, `'`.
- `expect(escapeHtml('<')).toBe('&lt;')` (not `&amp;lt;`) catches the order bug.
- `expect(escapeHtml(42)).toBe('42')`, `expect(escapeHtml(null)).toBe('')`, `expect(escapeHtml(undefined)).toBe('')`.

%% solution
```js
export function checkEscapeHtml(escapeHtml) {
  expect(escapeHtml('&')).toBe('&amp;');
  expect(escapeHtml('<')).toBe('&lt;');
  expect(escapeHtml('>')).toBe('&gt;');
  expect(escapeHtml('"')).toBe('&quot;');
  expect(escapeHtml("'")).toBe('&#39;');
  expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  expect(escapeHtml('a & b')).toBe('a &amp; b');
  expect(escapeHtml('plain')).toBe('plain');
  expect(escapeHtml(42)).toBe('42');
  expect(escapeHtml(null)).toBe('');
  expect(escapeHtml(undefined)).toBe('');
}
```

%% exercise sec-check-safe-url | Tests for safeUrl | 4 | js | js | checkSafeUrl | 30
`safeUrl(input)` returns a cleaned, safe-to-use URL string or `null`. It cleans like a browser (strips leading/trailing control and space characters, and tabs/newlines anywhere), allows only `http:`, `https:` and `mailto:` schemes (case-insensitive) plus **relative** URLs, and refuses host-relative forms (`//host`, `/\host`) and empty or non-string input. Write `checkSafeUrl(safeUrl)` that passes for a correct one and **fails** for: **allows javascript:**, **allows data:**, **allows vbscript:**, **allows file:**, **blocks only the lowercase "javascript:" (a blocklist)**, **doesn't remove tabs and newlines**, **doesn't trim leading spaces or control characters**, **allows protocol-relative //host URLs**, **allows /\\host URLs**, **rejects relative URLs**.

```js
expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull();
```

%% worked
**A similar problem, solved: `checkSafeRedirect(safeRedirect)`** — pair every "must refuse" bypass with a "must still accept" legitimate case.

```js
export function checkSafeRedirect(safeRedirect) {          // allows only relative paths starting with a single /
  expect(safeRedirect('/dashboard')).toBe('/dashboard');   // ① the legitimate case: a mutant that blocks everything fails here
  expect(safeRedirect('//evil.example')).toBeNull();       // ② the obvious bypass
  expect(safeRedirect('/\\evil.example')).toBeNull();      // ③ browsers treat \\ like /
  expect(safeRedirect('https://evil.example')).toBeNull(); // ④ an absolute URL
  expect(safeRedirect('\t//evil.example')).toBeNull();     // ⑤ hidden by whitespace
}
```

A security test needs **both directions**: bad input is refused (blocks attackers) **and** good input is accepted (a function that returns `null` for everything is "secure" but useless). For each bypass family (case, whitespace, control characters, alternative separators) write one case.

%% explain
- **Accepts**: `https:`, `http:`, `mailto:`, and relative URLs.
- **Refuses**: `javascript:`, `data:`, `vbscript:`, `file:`, in any case.
- **Browser normalisation**: tabs/newlines inside the scheme, leading control characters and spaces.
- **Host-relative** forms: `//` and `/\`.

%% nudge
- Which input defeats a case-sensitive blocklist? Which defeats one that doesn't strip whitespace?
- Which assertion fails for an implementation that rejects relative URLs?

%% starter
```js
export function checkSafeUrl(safeUrl) {
  expect(safeUrl('https://example.com')).toBe('https://example.com');
  expect(safeUrl('javascript:alert(1)')).toBeNull();
  // your assertions: other schemes, case, whitespace/control characters, //, relative URLs
}
```

%% tests
```js
const make = ({ allow = [], blocklist = false, stripInner = true, trim = true, protoRel = false, backslash = false, relative = true } = {}) => (input) => {
  if (typeof input !== 'string') return null;
  let s = stripInner ? input.replace(/[\t\r\n]/g, '') : input;
  if (trim) s = s.replace(/^[\u0000- ]+|[\u0000- ]+$/g, '');
  if (s === '') return null;
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(s);
  if (m) {
    if (blocklist) return ['javascript', 'data', 'vbscript', 'file'].includes(m[1]) ? null : s;
    const ok = ['http:', 'https:', 'mailto:', ...allow];
    return ok.includes(m[1].toLowerCase() + ':') ? s : null;
  }
  if (!protoRel && /^\/\//.test(s)) return null;
  if (!backslash && /^[\/\\]{2}/.test(s)) return null;
  if (!relative) return null;
  return s;
};
const correct = make();
const mutants = {
  'allows javascript:': make({ allow: ['javascript:'] }),
  'allows data:': make({ allow: ['data:'] }),
  'allows vbscript:': make({ allow: ['vbscript:'] }),
  'allows file:': make({ allow: ['file:'] }),
  'blocks only lowercase javascript:': make({ blocklist: true }),
  'does not remove tabs and newlines': make({ stripInner: false }),
  'does not trim leading spaces and control characters': make({ trim: false }),
  'allows protocol-relative URLs': make({ protoRel: true, backslash: true }),
  'allows slash-backslash hosts': make({ backslash: true }),
  'rejects relative URLs': make({ relative: false }),
};

describe('your checkSafeUrl', () => {
  it('passes on a correct safeUrl', () => {
    expect(() => checkSafeUrl(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a safeUrl that ${name}`, () => {
      expect(() => checkSafeUrl(impl)).toThrow();
    });
  }
});
```

%% hints
- Accepted: `https://example.com`, `mailto:a@b.co`, `/docs/a`, `page.html`.
- Refused: `javascript:alert(1)`, `JAVASCRIPT:alert(1)`, `data:text/html,x`, `vbscript:x`, `file:///etc/passwd`.
- Bypasses: `' javascript:alert(1)'`, `'java\tscript:alert(1)'`, `'//evil.example'`, `'/\\evil.example'`.

%% solution
```js
export function checkSafeUrl(safeUrl) {
  expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
  expect(safeUrl('http://example.com')).toBe('http://example.com');
  expect(safeUrl('mailto:ada@example.com')).toBe('mailto:ada@example.com');
  expect(safeUrl('/docs/a')).toBe('/docs/a');
  expect(safeUrl('page.html')).toBe('page.html');
  expect(safeUrl('#top')).toBe('#top');

  expect(safeUrl('javascript:alert(1)')).toBeNull();
  expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull();
  expect(safeUrl('JAVASCRIPT:alert(1)')).toBeNull();
  expect(safeUrl('data:text/html,hi')).toBeNull();
  expect(safeUrl('vbscript:x')).toBeNull();
  expect(safeUrl('file:///etc/passwd')).toBeNull();

  expect(safeUrl(' javascript:alert(1)')).toBeNull();
  expect(safeUrl('\u0001javascript:alert(1)')).toBeNull();
  expect(safeUrl('java\tscript:alert(1)')).toBeNull();
  expect(safeUrl('java\nscript:alert(1)')).toBeNull();

  expect(safeUrl('//evil.example/x')).toBeNull();
  expect(safeUrl('/\\evil.example')).toBeNull();

  expect(safeUrl('')).toBeNull();
  expect(safeUrl(null)).toBeNull();
}
```
