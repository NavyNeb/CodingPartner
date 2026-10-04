---
id: sec-cookies-cors-csrf
track: sec
title: Cookies, CORS & CSRF
summary: How browsers decide who may talk to whom: the same-origin policy, hardened cookies and their attributes, what CORS really protects, and defending against forged cross-site requests with SameSite, tokens and origin checks.
---

## The idea in one sentence

Browsers **automatically attach cookies** and **block cross-origin reads**; most web-boundary bugs come from misunderstanding **which side enforces what**.

> **Analogy** An office building with a badge reader. Your badge (cookie) opens doors **automatically**: you don't have to show it each time, which is convenient, but it also means someone who tricks you into walking through a door **uses your access**. The lobby guard (same-origin policy) stops visitors from **reading** other tenants' files, but doesn't stop them from **knocking**.

## Origins

An **origin** is **scheme + host + port**. The **same-origin policy** lets a page's scripts read responses only from **its own origin**.

![Same-origin comparisons](fig:sec-same-origin "Change any one of scheme, host or port and it is a different origin.")

Note what it does **not** do: it doesn't stop your page from **sending** requests elsewhere (images, forms, `fetch` without reading the reply). That is why forged requests (CSRF) exist.

## Cookies: attributes are your security settings

A cookie is `name=value` plus attributes sent in `Set-Cookie`. Browsers attach it to **every matching request**, including ones **triggered by other sites**.

```stepper A hardened session cookie
code:
  serializeCookie('__Host-sid', id, {
    path: '/', secure: true, httpOnly: true,
    sameSite: 'Lax', maxAge: 3600,
  });
---
line: 1
say: The **`__Host-` name prefix** makes the browser enforce rules for you: the cookie must be `Secure`, must have `Path=/` and **must not** have a `Domain` (so a sibling subdomain can't overwrite it).
Set-Cookie: __Host-sid=…
---
line: 2
say: **`Secure`**: only sent over HTTPS. **`HttpOnly`**: JavaScript can't read it via `document.cookie`, so an XSS bug can't simply steal the session.
flags: Secure; HttpOnly
---
line: 3
say: **`SameSite=Lax`**: the cookie is **not** sent on most cross-site sub-requests (forms posting from another site, `fetch`, images), only on top-level navigations such as clicking a link. `Strict` is stricter; `None` (allowed only with `Secure`) sends it everywhere.
flags: SameSite=Lax
---
line: 3
say: **`Max-Age`** bounds the lifetime in seconds (the cookie is deleted after an hour). Keep session cookies short-lived and pair them with a **server-side** expiry: the attribute is only a request to the browser.
flags: Max-Age=3600
```

```js try predict
function parseCookies(header) {
  const out = {};
  for (const pair of header.split(';')) {
    const i = pair.indexOf('=');
    if (i < 1) continue;
    const name = pair.slice(0, i).trim();
    if (!(name in out)) out[name] = decodeURIComponent(pair.slice(i + 1).trim());
  }
  return out;
}
console.log(parseCookies('sid=abc123; theme=dark%20mode; sid=evil'));
```

Two rules when **writing** cookies: **encode the value** (a value containing `;` could otherwise add new attributes), and **validate** names and attribute values.

## CORS: a browser rule, not a lock

**Cross-Origin Resource Sharing** lets a server **relax** the same-origin policy for specific origins. For "non-simple" requests (custom headers, `PUT`/`DELETE`, JSON bodies) the browser first sends a **preflight** `OPTIONS` request.

![How CORS works](fig:sec-cors "The browser enforces CORS. The server still receives the requests.")

Common mistakes:

- **Reflecting any `Origin`** back as `Access-Control-Allow-Origin` (equivalent to allowing everyone, **with credentials**).
- **`*` together with credentials** (browsers refuse it, and a server that works around it by reflecting is worse).
- **Substring or suffix checks** on the origin (`endsWith('example.com')` also matches `evilexample.com`): compare **exactly** against a list.
- **Forgetting `Vary: Origin`**, so a cache serves one origin's answer to another.
- **Thinking CORS is authentication.** `curl` ignores it. Always authenticate and authorise requests on the server.

## CSRF: forged requests with your cookies

![Cross-site request forgery](fig:sec-csrf "The browser attaches the victim's cookie to a request the victim never intended to make.")

Because cookies are sent **automatically**, a hidden form on another site can make your browser perform an action on a site you're logged in to. Defences (use more than one):

1. **`SameSite=Lax`/`Strict` cookies** (now the browser default is Lax, but be explicit).
2. A **CSRF token**: a random secret tied to the session that must be sent in a header or form field. A forged page **can't read** your pages (same-origin policy), so it can't copy the token.
3. **Check `Origin`** (or `Referer`) on state-changing requests against your own allowlist.
4. **Never change state on `GET`.** Browsers and crawlers prefetch links.

## Quick check

```check
Q: Which two URLs are the same origin?
A) https://a.com and http://a.com
B) https://a.com/x and https://a.com/y *
C) https://a.com and https://api.a.com
D) https://a.com and https://a.com:8443
Why: Scheme, host and port must all match; the path doesn't matter.
---
Q: What does `HttpOnly` protect against?
A) CSRF
B) Scripts reading the cookie (limiting what an XSS bug can steal) *
C) Network eavesdropping
D) Cookie expiry
Why: HttpOnly hides the cookie from `document.cookie`. `Secure` handles plain HTTP, `SameSite` handles cross-site sending.
---
Q: A server sends `Access-Control-Allow-Origin: <whatever Origin the request had>` together with `Allow-Credentials: true`. What is wrong?
A) Nothing
B) Every website can now make credentialed, readable requests to it *
C) It will not work in browsers
D) It breaks caching only
Why: Reflecting any origin with credentials removes the protection entirely: use an exact allowlist.
---
Q: Why can't an attacker's page just read your CSRF token?
A) It is encrypted
B) The same-origin policy stops it from reading your pages' content *
C) Tokens are hidden in cookies
D) Browsers delete them
Why: The attacker can cause a request but not read the response, so cannot learn the secret.
---
Q: Why is `Vary: Origin` needed with a per-origin CORS response?
A) For speed
B) So a cache doesn't reuse the response for a different origin *
C) It is a security header for cookies
D) It enables preflight
Why: The response depends on the request's Origin, and caches must know that.
```

## Recap

- **Origin** = scheme + host + port. The policy blocks reading cross-origin responses, **not sending** requests.
- **Cookies**: `Secure`, `HttpOnly`, `SameSite`, `Path`, `Max-Age`, and the `__Host-` prefix; **encode** values and **validate** attributes.
- **CORS** relaxes the browser rule for an **exact allowlist**; never reflect, never `*` with credentials, add `Vary: Origin`; it is **not** authentication.
- **CSRF**: SameSite, **tokens**, **Origin checks**, and **no state changes on GET**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: parse cookies | Splitting on `;` and the first `=`, safe decoding |
| Serialize a cookie | Validation, attribute order, the prefix rules |
| A CORS policy | An exact allowlist, preflight handling, `Vary` |
| CSRF tokens and origin checks | Constant-time comparison; the `URL` class |
| Tests for cookie serialization | Injection, prefix and `SameSite=None` cases |

%% exercise sec-guided-cookies | Guided: parse cookies | 1 | js | js | parseCookies | 8 | guided
Implement `parseCookies(header)` for a `Cookie` request header such as `sid=abc; theme=dark%20mode`.

- Pairs are separated by `;`; the name and value by the **first** `=`. Trim whitespace around both.
- Values are **percent-decoded** with `decodeURIComponent`; if the value isn't valid percent-encoding, keep it as it is.
- Pairs without `=` or with an empty name are ignored.
- If a name appears **more than once**, the **first** wins.
- A non-string header gives `{}`.

```js
parseCookies('sid=abc; theme=dark%20mode'); // { sid: 'abc', theme: 'dark mode' }
```

%% worked
**A similar problem, solved: `parseQuery(query)`** — the same shape of problem with `&`.

```js
export function parseQuery(query) {
  const out = {};
  for (const pair of String(query).split('&')) {
    const i = pair.indexOf('=');                       // ① split on the FIRST '=' only: values may contain '='
    if (i < 1) continue;                               // ② no '=' or empty name: skip it
    const name = pair.slice(0, i);
    if (name in out) continue;                         // ③ first one wins
    try { out[name] = decodeURIComponent(pair.slice(i + 1)); }
    catch { out[name] = pair.slice(i + 1); }           // ④ bad encoding: keep the raw text, don't crash
  }
  return out;
}
```

Parsers of untrusted input must **never throw** on garbage: a malformed header should not take your server down. (Use `Object.create(null)` or check `hasOwnProperty` if names like `__proto__` could appear; here `in` on a fresh object is enough for the exercise.)

%% explain
- **Split** on `;`, then the **first** `=`.
- **Trim**, **decode** safely, **first wins**.
- **Ignore** malformed pairs; non-strings give `{}`.

%% nudge
- Why split on the *first* `=` instead of using `split('=')`?
- What happens to `decodeURIComponent('%E0%A4%A')`?

%% starter
```js
export function parseCookies(header) {
  const out = {};
  // for each ';' separated pair: find the first '=', trim, decode safely, keep the first
  return out;
}
```

%% tests
```js
describe('parseCookies', () => {
  it('parses simple cookies', () => {
    expect(parseCookies('sid=abc; theme=dark')).toEqual({ sid: 'abc', theme: 'dark' });
    expect(parseCookies('a=1')).toEqual({ a: '1' });
  });
  it('trims whitespace', () => {
    expect(parseCookies('  a = 1 ;b=2  ;  c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });
  it('decodes percent-encoding', () => {
    expect(parseCookies('theme=dark%20mode; q=%E2%9C%93')).toEqual({ theme: 'dark mode', q: '✓' });
  });
  it('keeps values that are not valid percent-encoding', () => {
    expect(parseCookies('a=%E0%A4%A; b=100%')).toEqual({ a: '%E0%A4%A', b: '100%' });
  });
  it('splits on the first equals sign only', () => {
    expect(parseCookies('token=abc==; x=a=b=c')).toEqual({ token: 'abc==', x: 'a=b=c' });
  });
  it('the first duplicate wins', () => {
    expect(parseCookies('sid=good; sid=evil')).toEqual({ sid: 'good' });
  });
  it('ignores malformed pairs', () => {
    expect(parseCookies('novalue; =empty; ok=1; ;')).toEqual({ ok: '1' });
    expect(parseCookies('')).toEqual({});
  });
  it('keeps empty values', () => {
    expect(parseCookies('a=; b=2')).toEqual({ a: '', b: '2' });
  });
  it('returns an empty object for non-strings', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies(null)).toEqual({});
    expect(parseCookies(42)).toEqual({});
  });
});
```

%% hints
- `for (const pair of header.split(';')) { const i = pair.indexOf('='); if (i < 0) continue; ... }`
- `const name = pair.slice(0, i).trim(); if (!name) continue;`
- `try { value = decodeURIComponent(raw) } catch { value = raw }`

%% solution
```js
export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const pair of header.split(';')) {
    const i = pair.indexOf('=');
    if (i < 0) continue;
    const name = pair.slice(0, i).trim();
    if (!name || Object.prototype.hasOwnProperty.call(out, name)) continue;
    const raw = pair.slice(i + 1).trim();
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}
```

%% exercise sec-set-cookie | Serialize a cookie | 3 | js | js | serializeCookie | 26
Implement `serializeCookie(name, value, options = {})`, returning a `Set-Cookie` header value.

- `name` must match `/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/`, otherwise `Error('invalid cookie name')`.
- The value is `encodeURIComponent(String(value))`.
- Attributes, in this order, joined with `'; '`: `Max-Age=N` (`maxAge` must be an integer, else `Error('invalid maxAge')`; negative is allowed), `Expires=DATE` (`expires` is a `Date`, written with `toUTCString()`; an invalid date throws `Error('invalid expires')`), `Domain=…`, `Path=…`, `Secure`, `HttpOnly`, `SameSite=…`.
- `domain` and `path` may not contain `;`, whitespace or control characters: `Error('invalid domain')` / `Error('invalid path')`.
- `sameSite` is case-insensitive `strict`, `lax` or `none` and is written `Strict`, `Lax`, `None`; anything else throws `Error('invalid sameSite')`. `None` **requires** `secure`: `Error('SameSite=None requires Secure')`.
- A name starting with `__Host-` requires `secure`, `path: '/'` and **no** `domain`: `Error('__Host- cookies require Secure, Path=/ and no Domain')`. A name starting with `__Secure-` requires `secure`: `Error('__Secure- cookies require Secure')`.

```js
serializeCookie('sid', 'abc', { path: '/', secure: true, httpOnly: true, sameSite: 'lax', maxAge: 3600 });
// 'sid=abc; Max-Age=3600; Path=/; Secure; HttpOnly; SameSite=Lax'
```

%% worked
**A similar problem, solved: `serializeHeaderParams(name, params)`** — validate every piece, then join.

```js
export function serializeParams(name, params = {}) {
  if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(name)) throw new Error('invalid name');       // ① validate names: they go into the header unencoded
  const parts = [name];
  for (const [key, value] of Object.entries(params)) {
    if (/[;\r\n]/.test(String(value))) throw new Error('invalid ' + key);            // ② a ';' or newline would let the value add or split headers
    parts.push(`${key}=${value}`);
  }
  return parts.join('; ');
}
```

Anything written into a header is a **small injection target**: a `;` adds an attribute, a newline starts a new header. **Encode** the free-form value (that's what `encodeURIComponent` is for) and **reject** bad characters in the pieces you can't encode. Do all validation **before** building the string.

%% explain
- **Name and attribute validation** with exact error messages.
- **Value** is URL-encoded, so it can't carry `;` or newlines.
- **Fixed attribute order.**
- **Prefix rules** and the `SameSite=None` rule.

%% nudge
- Why must the value be encoded rather than checked for `;`?
- Which attributes does a `__Host-` cookie forbid or require?

%% starter
```js
export function serializeCookie(name, value, options = {}) {
  return '';
}
```

%% tests
```js
describe('serializeCookie', () => {
  it('serializes a simple cookie', () => {
    expect(serializeCookie('theme', 'dark')).toBe('theme=dark');
  });
  it('serializes every attribute in order', () => {
    const expires = new Date(0);
    const header = serializeCookie('sid', 'abc', { maxAge: 3600, expires, domain: 'example.com', path: '/app', secure: true, httpOnly: true, sameSite: 'strict' });
    expect(header).toBe('sid=abc; Max-Age=3600; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Domain=example.com; Path=/app; Secure; HttpOnly; SameSite=Strict');
  });
  it('encodes the value so it cannot add attributes', () => {
    expect(serializeCookie('x', 'a; Domain=evil.example')).toBe('x=a%3B%20Domain%3Devil.example');
    expect(serializeCookie('x', 'line\r\nSet-Cookie: y=1')).toBe('x=line%0D%0ASet-Cookie%3A%20y%3D1');
    expect(serializeCookie('x', 'é ✓')).toBe('x=%C3%A9%20%E2%9C%93');
    expect(serializeCookie('x', 42)).toBe('x=42');
  });
  it('accepts negative maxAge and rejects non-integers', () => {
    expect(serializeCookie('x', '', { maxAge: -1 })).toBe('x=; Max-Age=-1');
    expect(serializeCookie('x', '', { maxAge: 0 })).toBe('x=; Max-Age=0');
    expect(() => serializeCookie('x', 'v', { maxAge: 1.5 })).toThrow('invalid maxAge');
    expect(() => serializeCookie('x', 'v', { maxAge: '10' })).toThrow('invalid maxAge');
  });
  it('rejects an invalid expires date', () => {
    expect(() => serializeCookie('x', 'v', { expires: new Date('nonsense') })).toThrow('invalid expires');
  });
  it('rejects invalid names', () => {
    for (const bad of ['', 'a b', 'a=b', 'a;b', 'a\nb', 'né']) expect(() => serializeCookie(bad, 'v')).toThrow('invalid cookie name');
    expect(serializeCookie("a-b_c.d!#$%&'*+^`|~", 'v')).toBe("a-b_c.d!#$%&'*+^`|~=v");
  });
  it('rejects bad domain and path values', () => {
    expect(() => serializeCookie('x', 'v', { domain: 'a.com; Secure' })).toThrow('invalid domain');
    expect(() => serializeCookie('x', 'v', { domain: 'a b.com' })).toThrow('invalid domain');
    expect(() => serializeCookie('x', 'v', { path: '/a;HttpOnly' })).toThrow('invalid path');
    expect(() => serializeCookie('x', 'v', { path: '/a\r\nX: y' })).toThrow('invalid path');
  });
  it('normalises and validates sameSite', () => {
    expect(serializeCookie('x', 'v', { sameSite: 'LAX' })).toBe('x=v; SameSite=Lax');
    expect(serializeCookie('x', 'v', { sameSite: 'Strict' })).toBe('x=v; SameSite=Strict');
    expect(() => serializeCookie('x', 'v', { sameSite: 'sometimes' })).toThrow('invalid sameSite');
    expect(() => serializeCookie('x', 'v', { sameSite: true })).toThrow('invalid sameSite');
  });
  it('requires Secure for SameSite=None', () => {
    expect(() => serializeCookie('x', 'v', { sameSite: 'none' })).toThrow('SameSite=None requires Secure');
    expect(serializeCookie('x', 'v', { sameSite: 'None', secure: true })).toBe('x=v; Secure; SameSite=None');
  });
  it('enforces the __Host- prefix rules', () => {
    const message = '__Host- cookies require Secure, Path=/ and no Domain';
    expect(serializeCookie('__Host-sid', 'v', { secure: true, path: '/' })).toBe('__Host-sid=v; Path=/; Secure');
    expect(() => serializeCookie('__Host-sid', 'v', { path: '/' })).toThrow(message);
    expect(() => serializeCookie('__Host-sid', 'v', { secure: true })).toThrow(message);
    expect(() => serializeCookie('__Host-sid', 'v', { secure: true, path: '/app' })).toThrow(message);
    expect(() => serializeCookie('__Host-sid', 'v', { secure: true, path: '/', domain: 'example.com' })).toThrow(message);
  });
  it('enforces the __Secure- prefix rule', () => {
    expect(serializeCookie('__Secure-id', 'v', { secure: true })).toBe('__Secure-id=v; Secure');
    expect(() => serializeCookie('__Secure-id', 'v')).toThrow('__Secure- cookies require Secure');
  });
  it('omits flags that are not set', () => {
    expect(serializeCookie('x', 'v', { secure: false, httpOnly: false })).toBe('x=v');
  });
});
```

%% hints
- Validate in this order: name, maxAge, expires, domain, path, sameSite (and `None` + `secure`), then the prefixes.
- Build `parts` with the value first, then each attribute that is set, in the stated order.
- `/[;\s\u0000-\u001f]/.test(domain)` for domain, `/[;\u0000-\u001f]/` for path.

%% solution
```js
const NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export function serializeCookie(name, value, options = {}) {
  if (!NAME.test(name)) throw new Error('invalid cookie name');
  const { maxAge, expires, domain, path, secure, httpOnly, sameSite } = options;
  if (maxAge !== undefined && !Number.isInteger(maxAge)) throw new Error('invalid maxAge');
  if (expires !== undefined && (!(expires instanceof Date) || Number.isNaN(expires.getTime()))) throw new Error('invalid expires');
  if (domain !== undefined && /[;\s\u0000-\u001f]/.test(domain)) throw new Error('invalid domain');
  if (path !== undefined && /[;\u0000-\u001f]/.test(path)) throw new Error('invalid path');
  let site;
  if (sameSite !== undefined) {
    const lower = typeof sameSite === 'string' ? sameSite.toLowerCase() : '';
    if (!['strict', 'lax', 'none'].includes(lower)) throw new Error('invalid sameSite');
    if (lower === 'none' && !secure) throw new Error('SameSite=None requires Secure');
    site = lower[0].toUpperCase() + lower.slice(1);
  }
  if (name.startsWith('__Host-') && (!secure || path !== '/' || domain)) {
    throw new Error('__Host- cookies require Secure, Path=/ and no Domain');
  }
  if (name.startsWith('__Secure-') && !secure) throw new Error('__Secure- cookies require Secure');

  const parts = [`${name}=${encodeURIComponent(String(value))}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (expires !== undefined) parts.push(`Expires=${expires.toUTCString()}`);
  if (domain) parts.push(`Domain=${domain}`);
  if (path) parts.push(`Path=${path}`);
  if (secure) parts.push('Secure');
  if (httpOnly) parts.push('HttpOnly');
  if (site) parts.push(`SameSite=${site}`);
  return parts.join('; ');
}
```

%% exercise sec-cors | A CORS policy | 4 | js | js | createCors | 34
Implement `createCors({ allowedOrigins = [], allowCredentials = false, allowedMethods = ['GET', 'HEAD', 'POST'], allowedHeaders = [], exposedHeaders = [], maxAge })`. It returns `{ handle(request) }` where `request` is `{ method, headers }` with **lower-case header names**, and `handle` returns `{ status, headers }` (response header names in lower case).

- Creating it with `'*'` in `allowedOrigins` **and** `allowCredentials` throws `Error('wildcard origin cannot be used with credentials')`.
- Every response includes `vary: 'Origin'`, **except** when `allowedOrigins` is exactly `['*']`.
- No `origin` header: status `200`, just the `vary`.
- An origin is allowed if it **exactly equals** an entry (case-sensitive; `'null'` and look-alikes don't match) or the list has `'*'`. Allowed: `access-control-allow-origin` is the **request's origin** (or `'*'` for the wildcard), plus `access-control-allow-credentials: 'true'` if credentials are on, plus `access-control-expose-headers` (joined with `', '`) if any.
- A **preflight** is an `OPTIONS` request (any case) with an `access-control-request-method` header. For a preflight from a disallowed origin, or whose requested method (case-insensitive) is not in `allowedMethods`, or whose `access-control-request-headers` (comma-separated, trimmed, case-insensitive) are not all in `allowedHeaders`: status `403` and **only** the `vary` header. Otherwise status `204` with the headers above plus `access-control-allow-methods` (`allowedMethods` upper-cased and joined with `', '`), `access-control-allow-headers` (`allowedHeaders` joined with `', '`, only when not empty) and `access-control-max-age` (`String(maxAge)`, only when given).
- A non-preflight request from a disallowed origin: status `200` with only the `vary` (the browser will block the page from reading it).

```js
const cors = createCors({ allowedOrigins: ['https://app.example'], allowCredentials: true });
cors.handle({ method: 'GET', headers: { origin: 'https://app.example' } });
```

%% worked
**A similar problem, solved: `createFramePolicy({ allowedParents })`** — an exact allowlist deciding a header.

```js
export function createFramePolicy({ allowedParents }) {
  return {
    handle({ headers }) {
      const parent = headers.referer ? new URL(headers.referer).origin : undefined;
      const ok = parent !== undefined && allowedParents.includes(parent);   // ① exact match against a list: never endsWith/includes
      return ok
        ? { status: 200, headers: { 'content-security-policy': `frame-ancestors ${parent}` } }   // ② echo only what was allowlisted
        : { status: 200, headers: { 'content-security-policy': "frame-ancestors 'none'" } };      // ③ the safe default
    },
  };
}
```

Three habits shown here: compare **exactly** against a list, **echo** only values that passed the list, and make the **denied** path the default. For CORS, build the "denied" response first (just `vary`) and add the permissive headers only after every check passes.

%% explain
- **Config check** at creation for the wildcard + credentials combination.
- **Exact origin matching** against the allowlist.
- **Simple requests** get allow-origin (and credentials, expose); **preflights** also get methods, headers and max-age.
- **Denied preflights** are `403` with only `vary`.

%% nudge
- Why is `vary: 'Origin'` omitted only for the pure wildcard config?
- Which headers must be absent on a rejected preflight?

%% starter
```js
export function createCors({ allowedOrigins = [], allowCredentials = false, allowedMethods = ['GET', 'HEAD', 'POST'], allowedHeaders = [], exposedHeaders = [], maxAge } = {}) {
  return {
    handle({ method, headers = {} }) {
      return { status: 200, headers: {} };
    },
  };
}
```

%% tests
```js
const config = {
  allowedOrigins: ['https://app.example', 'https://admin.example'],
  allowCredentials: true,
  allowedMethods: ['GET', 'POST', 'put'],
  allowedHeaders: ['content-type', 'x-csrf-token'],
  exposedHeaders: ['x-request-id'],
  maxAge: 600,
};
const req = (method, headers) => ({ method, headers });

describe('createCors', () => {
  const cors = createCors(config);
  it('adds CORS headers for an allowed origin', () => {
    expect(cors.handle(req('GET', { origin: 'https://app.example' }))).toEqual({
      status: 200,
      headers: {
        vary: 'Origin',
        'access-control-allow-origin': 'https://app.example',
        'access-control-allow-credentials': 'true',
        'access-control-expose-headers': 'x-request-id',
      },
    });
    expect(cors.handle(req('POST', { origin: 'https://admin.example' })).headers['access-control-allow-origin']).toBe('https://admin.example');
  });
  it('only sends vary when there is no origin', () => {
    expect(cors.handle(req('GET', {}))).toEqual({ status: 200, headers: { vary: 'Origin' } });
  });
  it('denies other origins, look-alikes, case changes and null', () => {
    for (const origin of ['https://evil.example', 'https://app.example.evil.example', 'https://evilapp.example', 'https://APP.example', 'http://app.example', 'null', '']) {
      expect(cors.handle(req('GET', { origin }))).toEqual({ status: 200, headers: { vary: 'Origin' } });
    }
  });
  it('answers an allowed preflight', () => {
    const response = cors.handle(req('OPTIONS', {
      origin: 'https://app.example',
      'access-control-request-method': 'PUT',
      'access-control-request-headers': 'Content-Type, X-CSRF-Token',
    }));
    expect(response).toEqual({
      status: 204,
      headers: {
        vary: 'Origin',
        'access-control-allow-origin': 'https://app.example',
        'access-control-allow-credentials': 'true',
        'access-control-expose-headers': 'x-request-id',
        'access-control-allow-methods': 'GET, POST, PUT',
        'access-control-allow-headers': 'content-type, x-csrf-token',
        'access-control-max-age': '600',
      },
    });
  });
  it('treats a lower-case options method as a preflight, and a request without request headers is fine', () => {
    const response = cors.handle(req('options', { origin: 'https://app.example', 'access-control-request-method': 'get' }));
    expect(response.status).toBe(204);
  });
  it('rejects a preflight for a method, header or origin that is not allowed', () => {
    const base = { origin: 'https://app.example', 'access-control-request-method': 'PUT' };
    const denied = { status: 403, headers: { vary: 'Origin' } };
    expect(cors.handle(req('OPTIONS', { ...base, 'access-control-request-method': 'DELETE' }))).toEqual(denied);
    expect(cors.handle(req('OPTIONS', { ...base, 'access-control-request-headers': 'x-evil' }))).toEqual(denied);
    expect(cors.handle(req('OPTIONS', { ...base, 'access-control-request-headers': 'content-type, x-evil' }))).toEqual(denied);
    expect(cors.handle(req('OPTIONS', { ...base, origin: 'https://evil.example' }))).toEqual(denied);
  });
  it('treats OPTIONS without a requested method as an ordinary request', () => {
    expect(cors.handle(req('OPTIONS', { origin: 'https://app.example' })).status).toBe(200);
  });
  it('omits optional headers that are not configured', () => {
    const plain = createCors({ allowedOrigins: ['https://a.example'] });
    const response = plain.handle(req('OPTIONS', { origin: 'https://a.example', 'access-control-request-method': 'POST' }));
    expect(response).toEqual({
      status: 204,
      headers: { vary: 'Origin', 'access-control-allow-origin': 'https://a.example', 'access-control-allow-methods': 'GET, HEAD, POST' },
    });
  });
  it('supports a pure wildcard without credentials and without vary', () => {
    const open = createCors({ allowedOrigins: ['*'] });
    expect(open.handle(req('GET', { origin: 'https://anything.example' }))).toEqual({ status: 200, headers: { 'access-control-allow-origin': '*' } });
  });
  it('refuses a wildcard with credentials', () => {
    expect(() => createCors({ allowedOrigins: ['*'], allowCredentials: true })).toThrow('wildcard origin cannot be used with credentials');
    expect(() => createCors({ allowedOrigins: ['https://a.example', '*'], allowCredentials: true })).toThrow('wildcard origin cannot be used with credentials');
  });
});
```

%% hints
- Start each response with `const base = wildcardOnly ? {} : { vary: 'Origin' }`, and return `{ status, headers: { ...base } }` for denials.
- Allowed: `{ ...base, 'access-control-allow-origin': wildcard ? '*' : origin, ... }`.
- Preflight check: method upper-cased in `methods`; requested headers `split(',').map(trim/lower).filter(Boolean)` all in the allowed list.

%% solution
```js
export function createCors({ allowedOrigins = [], allowCredentials = false, allowedMethods = ['GET', 'HEAD', 'POST'], allowedHeaders = [], exposedHeaders = [], maxAge } = {}) {
  const wildcard = allowedOrigins.includes('*');
  if (allowCredentials && wildcard) throw new Error('wildcard origin cannot be used with credentials');
  const wildcardOnly = allowedOrigins.length === 1 && wildcard;
  const methods = allowedMethods.map((m) => m.toUpperCase());
  const allowedLower = allowedHeaders.map((h) => h.toLowerCase());

  return {
    handle({ method, headers = {} }) {
      const base = wildcardOnly ? {} : { vary: 'Origin' };
      const origin = headers.origin;
      if (origin === undefined) return { status: 200, headers: { ...base } };

      const preflight = String(method).toUpperCase() === 'OPTIONS' && headers['access-control-request-method'] !== undefined;
      const allowed = wildcard || allowedOrigins.includes(origin);
      if (!allowed) return { status: preflight ? 403 : 200, headers: { ...base } };

      const out = { ...base, 'access-control-allow-origin': wildcard ? '*' : origin };
      if (allowCredentials) out['access-control-allow-credentials'] = 'true';
      if (exposedHeaders.length) out['access-control-expose-headers'] = exposedHeaders.join(', ');
      if (!preflight) return { status: 200, headers: out };

      const requestedMethod = String(headers['access-control-request-method']).toUpperCase();
      const requestedHeaders = String(headers['access-control-request-headers'] ?? '')
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean);
      if (!methods.includes(requestedMethod) || !requestedHeaders.every((h) => allowedLower.includes(h))) {
        return { status: 403, headers: { ...base } };
      }
      out['access-control-allow-methods'] = methods.join(', ');
      if (allowedHeaders.length) out['access-control-allow-headers'] = allowedHeaders.join(', ');
      if (maxAge !== undefined) out['access-control-max-age'] = String(maxAge);
      return { status: 204, headers: out };
    },
  };
}
```

%% exercise sec-csrf | CSRF tokens and origin checks | 3 | js | js | createCsrf, checkOrigin | 26
Two pieces of CSRF defence.

`createCsrf({ random })` (`random()` returns `[0, 1)`) returns:

- `issue(sessionId)`: a token of **32 hex characters** (`Math.floor(random() * 16).toString(16)` each) tied to that session. Asking again for the **same session** returns the **same** token.
- `rotate(sessionId)`: always makes a **new** token for the session (the old one stops working) and returns it.
- `verify(sessionId, token)`: `true` only if the session has a token and `token` equals it, compared in **constant time**. Unknown sessions and non-string tokens give `false`.
- `revoke(sessionId)` forgets the session's token.

`checkOrigin(request, { allowedOrigins })` with `request = { method, headers }` (lower-case header names):

- `GET`, `HEAD` and `OPTIONS` (any case) are **always allowed** (they must not change state).
- Otherwise the request's `origin` header must be in `allowedOrigins`. If there is **no** `origin` header, use the **origin of the `referer`** header (parsed with `URL`). A missing or unparseable value, or the origin `'null'`, is **not allowed**.

```js
checkOrigin({ method: 'POST', headers: { origin: 'https://evil.example' } }, { allowedOrigins: ['https://app.example'] }); // false
```

%% worked
**A similar problem, solved: `createNonces({ random })`** — a single-use value tied to a key, compared safely.

```js
export function createNonces({ random }) {
  const store = new Map();
  const same = (a, b) => {                                  // ① no early exit
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
  };
  return {
    issue(key) {
      let n = '';
      for (let i = 0; i < 16; i++) n += Math.floor(random() * 16).toString(16);
      store.set(key, n);
      return n;
    },
    consume(key, candidate) {
      const ok = store.has(key) && same(store.get(key), candidate);
      if (ok) store.delete(key);                            // ② single use
      return ok;
    },
  };
}
```

For the origin check, **prefer the `Origin` header** (browsers set it on cross-origin and POST requests), fall back to `Referer`'s origin, and treat everything uncertain as **denied**.

%% explain
- **Tokens**: per-session, random hex; `issue` is idempotent; `rotate` replaces; `verify` is constant-time.
- **Origin check**: safe methods pass; unsafe ones need a trusted `Origin` (or `Referer` origin).
- **Fail closed** on missing, malformed or `null` values.

%% nudge
- Why is the `Referer` only a fallback?
- What should `verify` return for a session that never got a token?

%% starter
```js
export function createCsrf({ random }) {
  return {
    issue(sessionId) { return ''; },
    rotate(sessionId) { return ''; },
    verify(sessionId, token) { return false; },
    revoke(sessionId) {},
  };
}

export function checkOrigin(request, { allowedOrigins }) {
  return false;
}
```

%% tests
```js
const seeded = () => {
  let seed = 4242;
  return () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
};

describe('createCsrf', () => {
  it('issues 32-hex tokens, stable per session', () => {
    const csrf = createCsrf({ random: seeded() });
    const a = csrf.issue('s1');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(csrf.issue('s1')).toBe(a);
    expect(csrf.issue('s2')).not.toBe(a);
  });
  it('verifies the right token only', () => {
    const csrf = createCsrf({ random: seeded() });
    const a = csrf.issue('s1');
    const b = csrf.issue('s2');
    expect(csrf.verify('s1', a)).toBe(true);
    expect(csrf.verify('s1', b)).toBe(false);
    expect(csrf.verify('s1', a + 'x')).toBe(false);
    expect(csrf.verify('s1', a.slice(0, -1))).toBe(false);
    expect(csrf.verify('s1', '')).toBe(false);
    expect(csrf.verify('s1', undefined)).toBe(false);
    expect(csrf.verify('s1', 12345)).toBe(false);
  });
  it('rejects unknown sessions', () => {
    const csrf = createCsrf({ random: seeded() });
    expect(csrf.verify('nobody', 'abc')).toBe(false);
    expect(csrf.verify('nobody', '')).toBe(false);
    expect(csrf.verify('nobody', undefined)).toBe(false);
  });
  it('rotates tokens', () => {
    const csrf = createCsrf({ random: seeded() });
    const old = csrf.issue('s1');
    const fresh = csrf.rotate('s1');
    expect(fresh).toMatch(/^[0-9a-f]{32}$/);
    expect(fresh).not.toBe(old);
    expect(csrf.verify('s1', old)).toBe(false);
    expect(csrf.verify('s1', fresh)).toBe(true);
    expect(csrf.issue('s1')).toBe(fresh);
  });
  it('rotate works for a session that had no token', () => {
    const csrf = createCsrf({ random: seeded() });
    const t = csrf.rotate('new');
    expect(csrf.verify('new', t)).toBe(true);
  });
  it('revokes tokens', () => {
    const csrf = createCsrf({ random: seeded() });
    const t = csrf.issue('s1');
    csrf.revoke('s1');
    expect(csrf.verify('s1', t)).toBe(false);
  });
});

describe('checkOrigin', () => {
  const opts = { allowedOrigins: ['https://app.example'] };
  const req = (method, headers) => ({ method, headers });
  it('always allows safe methods', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get', 'head']) {
      expect(checkOrigin(req(method, {}), opts)).toBe(true);
      expect(checkOrigin(req(method, { origin: 'https://evil.example' }), opts)).toBe(true);
    }
  });
  it('allows unsafe methods from an allowed origin', () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
      expect(checkOrigin(req(method, { origin: 'https://app.example' }), opts)).toBe(true);
    }
  });
  it('rejects unsafe methods from other origins', () => {
    for (const origin of ['https://evil.example', 'https://app.example.evil.example', 'http://app.example', 'null', '']) {
      expect(checkOrigin(req('POST', { origin }), opts)).toBe(false);
    }
  });
  it('falls back to the referer origin', () => {
    expect(checkOrigin(req('POST', { referer: 'https://app.example/settings?x=1' }), opts)).toBe(true);
    expect(checkOrigin(req('POST', { referer: 'https://evil.example/https://app.example/' }), opts)).toBe(false);
    expect(checkOrigin(req('POST', { referer: 'https://app.example.evil.example/' }), opts)).toBe(false);
  });
  it('prefers the origin header over the referer', () => {
    expect(checkOrigin(req('POST', { origin: 'https://evil.example', referer: 'https://app.example/' }), opts)).toBe(false);
  });
  it('rejects when neither header is usable', () => {
    expect(checkOrigin(req('POST', {}), opts)).toBe(false);
    expect(checkOrigin(req('POST', { referer: 'not a url' }), opts)).toBe(false);
    expect(checkOrigin(req('POST', { referer: '' }), opts)).toBe(false);
    expect(checkOrigin(req('POST', { origin: 'https://app.example' }), { allowedOrigins: [] })).toBe(false);
  });
});
```

%% hints
- Token per session in a `Map`; generate with 32 hex digits.
- Constant-time compare: the accumulating XOR loop from the guided exercise.
- `checkOrigin`: `const origin = headers.origin ?? (headers.referer ? new URL(headers.referer).origin : undefined)` inside a `try`; `null` origin never matches your list.

%% solution
```js
export function createCsrf({ random }) {
  const tokens = new Map();
  const make = () => {
    let t = '';
    for (let i = 0; i < 32; i++) t += Math.floor(random() * 16).toString(16);
    return t;
  };
  const same = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    let diff = a.length ^ b.length;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
  };
  return {
    issue(sessionId) {
      if (!tokens.has(sessionId)) tokens.set(sessionId, make());
      return tokens.get(sessionId);
    },
    rotate(sessionId) {
      const t = make();
      tokens.set(sessionId, t);
      return t;
    },
    verify(sessionId, token) {
      return tokens.has(sessionId) && same(tokens.get(sessionId), token);
    },
    revoke(sessionId) {
      tokens.delete(sessionId);
    },
  };
}

export function checkOrigin(request, { allowedOrigins }) {
  const method = String(request.method).toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const headers = request.headers || {};
  let origin = headers.origin;
  if (origin === undefined && headers.referer) {
    try {
      origin = new URL(headers.referer).origin;
    } catch {
      return false;
    }
  }
  if (typeof origin !== 'string' || origin === '' || origin === 'null') return false;
  return allowedOrigins.includes(origin);
}
```

%% exercise sec-check-cookie | Tests for cookie serialization | 4 | js | js | checkSerializeCookie | 34
`serializeCookie(name, value, options)` builds a `Set-Cookie` value. It **URL-encodes the value**, rejects invalid cookie names, rejects `;`/whitespace/control characters in `domain` and `path`, validates `sameSite` (`strict`, `lax`, `none`, case-insensitive) and requires `Secure` for `SameSite=None`, enforces the `__Host-` prefix rules (`Secure`, `Path=/`, no `Domain`), and writes the attributes as `Max-Age`, `Expires`, `Domain`, `Path`, `Secure`, `HttpOnly`, `SameSite`. Write `checkSerializeCookie(serializeCookie)` that passes for a correct one and **fails** for: **doesn't encode the value**, **accepts invalid cookie names**, **doesn't validate the domain**, **doesn't validate the path**, **accepts SameSite=None without Secure**, **accepts unknown SameSite values**, **forgets the Secure flag**, **forgets the HttpOnly flag**, **allows a Domain on `__Host-` cookies**, **allows a non-root Path on `__Host-` cookies**, **doesn't require Secure for `__Host-` cookies**.

```js
expect(serializeCookie('sid', 'abc', { path: '/', secure: true })).toBe('sid=abc; Path=/; Secure');
```

%% worked
**A similar problem, solved: `checkSerializeHeader(serialize)`** — an **exact output** check, then **one injection attempt per field**.

```js
export function checkSerializeHeader(serialize) {         // serialize('Name', 'value', { note }) → 'Name=value; Note=..'
  expect(serialize('X-Id', 'abc', { note: 'hi' })).toBe('X-Id=abc; Note=hi');     // ① exact string: catches dropped or reordered pieces
  expect(serialize('X-Id', 'a; B=c')).toBe('X-Id=a%3B%20B%3Dc');                   // ② the value must not be able to add a field
  expect(serialize('X-Id', 'a\r\nEvil: 1')).toBe('X-Id=a%0D%0AEvil%3A%201');       // ③ ...or start a new header line
  expect(() => serialize('X Id', 'v')).toThrow();                                   // ④ names are validated
  expect(() => serialize('X-Id', 'v', { note: 'a; Evil=1' })).toThrow();            // ⑤ so are the other pieces
}
```

A serializer is the **last line of defence** before bytes hit a header. Cover each field with **one attack aimed at it**, and use **exact string comparisons** for the happy path so a dropped flag shows up.

%% explain
- **Exact output** for a fully loaded cookie (every flag and attribute).
- **Value encoding**: `;`, spaces, `=`, CR/LF.
- **Validation** of name, domain, path, sameSite.
- **Prefix and `None` rules**: each requirement missing, one at a time.

%% nudge
- Which input makes an un-encoded value visibly different?
- How do you test the `__Host-` rule for `Secure` separately from the rule for `Domain`?

%% starter
```js
export function checkSerializeCookie(serializeCookie) {
  expect(serializeCookie('sid', 'abc', { path: '/', secure: true, httpOnly: true })).toBe('sid=abc; Path=/; Secure; HttpOnly');
  // your assertions: encoding, names, domain/path validation, SameSite, __Host-
}
```

%% tests
```js
const NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const make = ({ encode = true, names = true, domain = true, path = true, noneSecure = true, sameSiteCheck = true, secureFlag = true, httpOnlyFlag = true, hostDomain = true, hostPath = true, hostSecure = true } = {}) => (name, value, o = {}) => {
  if (names && !NAME.test(name)) throw new Error('invalid cookie name');
  const parts = [`${name}=${encode ? encodeURIComponent(String(value)) : String(value)}`];
  if (o.maxAge !== undefined) parts.push(`Max-Age=${o.maxAge}`);
  if (o.domain) {
    if (domain && /[;\s\u0000-\u001f]/.test(o.domain)) throw new Error('invalid domain');
    parts.push(`Domain=${o.domain}`);
  }
  if (o.path) {
    if (path && /[;\u0000-\u001f]/.test(o.path)) throw new Error('invalid path');
    parts.push(`Path=${o.path}`);
  }
  if (o.secure && secureFlag) parts.push('Secure');
  if (o.httpOnly && httpOnlyFlag) parts.push('HttpOnly');
  if (o.sameSite !== undefined) {
    const lower = String(o.sameSite).toLowerCase();
    if (sameSiteCheck && !['strict', 'lax', 'none'].includes(lower)) throw new Error('invalid sameSite');
    if (noneSecure && lower === 'none' && !o.secure) throw new Error('none needs secure');
    parts.push(`SameSite=${lower[0].toUpperCase()}${lower.slice(1)}`);
  }
  if (name.startsWith('__Host-')) {
    if (hostSecure && !o.secure) throw new Error('host secure');
    if (hostPath && o.path !== '/') throw new Error('host path');
    if (hostDomain && o.domain) throw new Error('host domain');
  }
  return parts.join('; ');
};
const correct = make();
const mutants = {
  'does not encode the value': make({ encode: false }),
  'accepts invalid cookie names': make({ names: false }),
  'does not validate the domain': make({ domain: false }),
  'does not validate the path': make({ path: false }),
  'accepts SameSite=None without Secure': make({ noneSecure: false }),
  'accepts unknown SameSite values': make({ sameSiteCheck: false }),
  'forgets the Secure flag': make({ secureFlag: false }),
  'forgets the HttpOnly flag': make({ httpOnlyFlag: false }),
  'allows a Domain on __Host- cookies': make({ hostDomain: false }),
  'allows a non-root Path on __Host- cookies': make({ hostPath: false }),
  'does not require Secure for __Host- cookies': make({ hostSecure: false }),
};

describe('your checkSerializeCookie', () => {
  it('passes on a correct serializeCookie', () => {
    expect(() => checkSerializeCookie(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a serializeCookie that ${name}`, () => {
      expect(() => checkSerializeCookie(impl)).toThrow();
    });
  }
});
```

%% hints
- Exact output: `serializeCookie('sid', 'abc', { maxAge: 60, domain: 'example.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax' })`.
- Encoding: `serializeCookie('x', 'a; Domain=evil.example')` is `'x=a%3B%20Domain%3Devil.example'`.
- `__Host-` cases: one missing `Secure`, one with `path: '/app'`, one with a `domain`, each alone.
- `expect(() => serializeCookie('x', 'v', { sameSite: 'none' })).toThrow()` and `{ sameSite: 'sometimes' }`.

%% solution
```js
export function checkSerializeCookie(serializeCookie) {
  expect(serializeCookie('sid', 'abc', { maxAge: 60, domain: 'example.com', path: '/', secure: true, httpOnly: true, sameSite: 'lax' }))
    .toBe('sid=abc; Max-Age=60; Domain=example.com; Path=/; Secure; HttpOnly; SameSite=Lax');
  expect(serializeCookie('sid', 'abc', { secure: true })).toBe('sid=abc; Secure');
  expect(serializeCookie('sid', 'abc', { httpOnly: true })).toBe('sid=abc; HttpOnly');

  expect(serializeCookie('x', 'a; Domain=evil.example')).toBe('x=a%3B%20Domain%3Devil.example');
  expect(serializeCookie('x', 'a\r\nSet-Cookie: y=1')).toBe('x=a%0D%0ASet-Cookie%3A%20y%3D1');

  expect(() => serializeCookie('bad name', 'v')).toThrow();
  expect(() => serializeCookie('a=b', 'v')).toThrow();
  expect(() => serializeCookie('', 'v')).toThrow();

  expect(() => serializeCookie('x', 'v', { domain: 'a.com; Secure' })).toThrow();
  expect(() => serializeCookie('x', 'v', { path: '/a; HttpOnly' })).toThrow();

  expect(() => serializeCookie('x', 'v', { sameSite: 'none' })).toThrow();
  expect(serializeCookie('x', 'v', { sameSite: 'none', secure: true })).toBe('x=v; Secure; SameSite=None');
  expect(() => serializeCookie('x', 'v', { sameSite: 'sometimes' })).toThrow();

  expect(serializeCookie('__Host-sid', 'v', { secure: true, path: '/' })).toBe('__Host-sid=v; Path=/; Secure');
  expect(() => serializeCookie('__Host-sid', 'v', { path: '/' })).toThrow();
  expect(() => serializeCookie('__Host-sid', 'v', { secure: true, path: '/app' })).toThrow();
  expect(() => serializeCookie('__Host-sid', 'v', { secure: true, path: '/', domain: 'example.com' })).toThrow();
}
```
