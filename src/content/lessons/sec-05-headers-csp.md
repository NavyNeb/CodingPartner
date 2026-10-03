---
id: sec-headers-csp
track: sec
title: Security headers, CSP & integrity
summary: Telling the browser how strictly to treat your page: the essential response headers, Content Security Policy (sources, nonces, hashes), auditing a header set, and verifying third-party files with Subresource Integrity.
---

## The idea in one sentence

Response headers let you **tell the browser to enforce rules on your behalf**, so even when a bug slips through (an XSS hole, a compromised CDN) the browser **limits the damage**.

> **Analogy** A building's fire doors and sprinklers. They don't prevent a fire from starting (that's your secure coding), but they make sure a small fire stays small. Headers are the fire doors of the web: set once for the whole building, working even when something else has failed.

## The essential headers

![Security headers at a glance](fig:sec-headers "Cheap, global, enforced by the browser: set them for every response.")

- **`Strict-Transport-Security`** (HSTS): "always use HTTPS for this host" for the next `max-age` seconds (`includeSubDomains` for subdomains).
- **`Content-Security-Policy`**: an allowlist of where scripts, styles, images and connections may come from (below).
- **`X-Content-Type-Options: nosniff`**: don't guess types; a text file won't be run as script.
- **`frame-ancestors`** (CSP) or `X-Frame-Options`: who may embed your page, which stops **clickjacking**.
- **`Referrer-Policy`**: how much of your URL to reveal to other sites (`strict-origin-when-cross-origin` is a good default).
- **`Permissions-Policy`**: switch off browser features you don't use (camera, microphone, geolocation).
- **Don't leak** your stack: version numbers in `Server` and `X-Powered-By` help attackers pick exploits.

## Content Security Policy

A CSP is a list of **directives**, each with a list of **sources**:

```
Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.example.com; img-src 'self' data:
```

- `default-src` is the **fallback** for any fetch directive that isn't listed.
- **Source kinds**: `'self'` (same scheme, host **and port**), `'none'` (nothing), a **host** (`cdn.example.com`, with optional scheme, port and path), a **wildcard host** (`*.example.com`: subdomains only, **not** the bare domain), a **scheme** (`https:`), plus keywords and **nonces/hashes**.

![How sources are matched](fig:sec-csp-sources "A source must match scheme, host, port and path rules; anything unmatched is blocked.")

```js try predict
function buildCsp(directives) {
  return Object.entries(directives)
    .filter(([, sources]) => sources !== false && sources !== undefined)
    .map(([name, sources]) => (sources === true ? name : [name, ...(sources.length ? sources : ["'none'"])].join(' ')))
    .join('; ');
}
console.log(buildCsp({
  'default-src': ["'self'"],
  'script-src': ["'self'", 'https://cdn.example.com'],
  'object-src': [],
  'upgrade-insecure-requests': true,
}));
```

### Inline scripts: nonces and hashes

The most valuable CSP rule is **no inline script** (because injected scripts are inline). If you need some, allow **specific** ones instead of `'unsafe-inline'`:

![Nonce-based CSP](fig:sec-csp-nonce "The nonce is a per-response secret that an attacker's injected script cannot know.")

- A **nonce**: a fresh random value per response, in the header (`'nonce-R4nd0m'`) and on your `<script nonce="R4nd0m">`.
- A **hash**: the digest of the exact script text (`'sha256-…'`).
- When a nonce or hash is present, **`'unsafe-inline'` is ignored**: that is how you stay compatible with old browsers while being strict in new ones.

```stepper Reading a policy
code:
  script-src 'self' https://cdn.example.com 'nonce-R4nd0m'
  img-src 'self' data:
  object-src 'none'
  frame-ancestors 'none'
---
line: 1
say: **Scripts** may come from the page's own origin, from that one CDN, or be inline **only** with the matching nonce. A script from `evil.example`, or an injected inline script, is blocked.
blocked: inline without nonce, other hosts
---
line: 2
say: **Images** may come from the origin and from `data:` URLs. Anything else (a tracking pixel on another host) is refused.
img: self + data:
---
line: 3
say: **Plugins** (`object`/`embed`) are switched off entirely with `'none'`: an old, risky feature you almost certainly don't use.
object: none
---
line: 4
say: **`frame-ancestors 'none'`**: no site (not even yours) may put this page in a frame. That stops clickjacking, and it replaces the older `X-Frame-Options`.
frames: none
```

Tips: start with **Report-Only** mode (`Content-Security-Policy-Report-Only`) to see what would break; avoid `'unsafe-eval'`; never use bare `*`, `https:` or `data:` as **script** sources.

## Subresource Integrity

If you load a script from a CDN, a **compromised CDN** runs code on your page. **SRI** pins the file's **hash**:

```html
<script src="https://cdn.example.com/lib.js" integrity="sha384-…" crossorigin="anonymous"></script>
```

The browser downloads the file, hashes it, and **refuses to run it** if the hash differs. The `integrity` value can list several algorithms; the browser uses the **strongest** it supports.

## Quick check

```check
Q: What does `default-src 'self'` do?
A) Allows everything
B) Sets the fallback source list for fetch directives you didn't list *
C) Only affects scripts
D) Disables CSP
Why: Directives that aren't specified fall back to default-src.
---
Q: Does the wildcard `*.example.com` match `https://example.com/x.js`?
A) Yes
B) No: it matches subdomains only, not the bare domain *
C) Only for images
D) Only over HTTP
Why: List the bare domain separately if you need both.
---
Q: Why must a CSP nonce differ on every response?
A) To save bandwidth
B) If it were predictable or reused, an attacker could put it on an injected script *
C) Browsers cache nonces
D) It is a format rule
Why: A nonce is a secret proof that the script came from your server for this response.
---
Q: What is the problem with `'unsafe-inline'` in `script-src`?
A) It is slow
B) Injected inline scripts are allowed to run, defeating most of CSP's XSS protection *
C) It blocks images
D) It only works with nonces
Why: With it, any inline script, including an attacker's, is permitted.
---
Q: What does Subresource Integrity protect against?
A) XSS in your own code
B) A third-party file (such as one on a CDN) being altered *
C) CSRF
D) Weak passwords
Why: The browser refuses to run a file whose hash doesn't match.
```

## Recap

- Set **HSTS, CSP, nosniff, framing and referrer** headers on every response; don't leak versions.
- **CSP**: allowlist sources per directive, `default-src` fallback, `'self'` includes **port and scheme**, wildcard hosts exclude the bare domain, `'none'` means nothing.
- Prefer **nonces/hashes** over `'unsafe-inline'`; avoid `'unsafe-eval'`; try **Report-Only** first.
- **SRI** pins third-party files by hash; the strongest listed algorithm wins.
- Your tests can **evaluate a policy** against URLs, exactly like the browser does.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: build a CSP header | `Object.entries`, joining sources with spaces |
| Parse and evaluate a policy | The `URL` class; matching hosts, wildcards, ports and paths |
| Audit a header set | Case-insensitive header lookup; findings with severities |
| Verify Subresource Integrity | Picking the strongest algorithm; an injected hash function |
| Tests for a CSP evaluator | Look-alike hosts, ports, schemes and fallbacks |

%% exercise sec-guided-csp | Guided: build a CSP header | 1 | js | js | buildCsp | 8 | guided
Implement `buildCsp(directives)`. `directives` maps a directive name to either an **array of sources**, `true` or `false`. The result is the header value: directives in order, separated by `'; '`; each is the name followed by its sources separated by spaces.

- An **empty array** means no source is allowed, written as `'none'` (with quotes).
- `true` is a directive with no sources (for example `upgrade-insecure-requests`): just the name.
- `false` and `undefined` are **omitted**.

```js
buildCsp({ 'default-src': ["'self'"], 'img-src': ["'self'", 'data:'] });
// "default-src 'self'; img-src 'self' data:"
```

%% worked
**A similar problem, solved: `buildQuery(params)`** — a map turned into a delimited string, skipping empty entries.

```js
export function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== false)       // ① drop entries that mean "not set"
    .map(([key, value]) => (value === true ? key : `${key}=${value}`))   // ② a flag has no value
    .join('&');                                                          // ③ the separator goes between pieces only
}
```

`Object.entries` keeps the insertion order, so the directives come out in the order you wrote them. The empty-array rule is **security relevant**: an empty list written as nothing (`script-src` with no sources) would be ambiguous or ignored; `'none'` says it explicitly.

%% explain
- **Entries in order**, with `false`/`undefined` skipped.
- **Arrays** join with spaces after the name; **empty arrays** become `'none'`.
- **`true`** is a bare directive name.

%% nudge
- Why is an empty list written as `'none'`?
- Which array method skips unwanted entries before mapping?

%% starter
```js
export function buildCsp(directives) {
  // Step 1 — Object.entries(directives)
  // Step 2 — skip false/undefined; map to strings; join with '; '
  return '';
}
```

%% tests
```js
describe('buildCsp', () => {
  it('builds directives with sources', () => {
    expect(buildCsp({ 'default-src': ["'self'"], 'img-src': ["'self'", 'data:'] })).toBe("default-src 'self'; img-src 'self' data:");
  });
  it('keeps the order of directives and sources', () => {
    expect(buildCsp({ 'script-src': ['https://b.example', "'self'", 'https://a.example'], 'default-src': ["'none'"] })).toBe("script-src https://b.example 'self' https://a.example; default-src 'none'");
  });
  it('writes an empty array as none', () => {
    expect(buildCsp({ 'object-src': [] })).toBe("object-src 'none'");
  });
  it('writes true as a bare directive', () => {
    expect(buildCsp({ 'default-src': ["'self'"], 'upgrade-insecure-requests': true })).toBe("default-src 'self'; upgrade-insecure-requests");
  });
  it('omits false and undefined', () => {
    expect(buildCsp({ 'default-src': ["'self'"], 'block-all-mixed-content': false, 'report-uri': undefined })).toBe("default-src 'self'");
  });
  it('returns an empty string for no directives', () => {
    expect(buildCsp({})).toBe('');
    expect(buildCsp({ a: false })).toBe('');
  });
});
```

%% hints
- `.filter(([, v]) => v !== false && v !== undefined)`
- `v === true ? name : [name, ...(v.length ? v : ["'none'"])].join(' ')`

%% solution
```js
export function buildCsp(directives) {
  return Object.entries(directives)
    .filter(([, sources]) => sources !== false && sources !== undefined)
    .map(([name, sources]) => (sources === true ? name : [name, ...(sources.length ? sources : ["'none'"])].join(' ')))
    .join('; ');
}
```

%% exercise sec-csp-eval | Parse and evaluate a policy | 4 | js | js | parseCsp, cspAllows, cspAllowsInline | 40
Implement a small CSP evaluator.

`parseCsp(header)` returns an object from directive name (lower-cased) to an **array of source tokens** (as written). Directives are separated by `;`, tokens by whitespace; empty parts are skipped; if a directive appears twice the **first** wins.

`cspAllows(policy, directive, url, { pageOrigin })` says whether a **URL** may be loaded under `directive`:

- The sources are `policy[directive]`, else `policy['default-src']`; if neither exists, **everything is allowed**. An unparseable `url` is not allowed.
- `'none'` entries are ignored; an empty source list therefore allows nothing.
- `'self'` matches the **same origin** as `pageOrigin` (scheme, host **and** port).
- A **scheme source** (`https:`) matches URLs with that protocol. `*` matches any `http:` or `https:` URL.
- A **host source** `[scheme://]host[:port][/path]`: the host matches **exactly** (case-insensitively), or for `*.example.com` any **subdomain** (not `example.com` itself). Without a scheme the URL's protocol must equal the page's (or be `https:` when the page is `http:`). Without a port the URL must use its scheme's **default port**; `:*` matches any port. A path ending in `/` is a **prefix**; otherwise it must match the pathname **exactly**.
- Nonce, hash and keyword tokens never match URLs.

`cspAllowsInline(policy, directive, { nonce, hash } = {})` says whether an **inline** script/style is allowed: sources as above (none → allowed); it is allowed if a `'nonce-…'` token equals `nonce`, or a `'sha256-…'`/`'sha384-…'`/`'sha512-…'` token (without quotes) equals `hash`; if any nonce or hash token exists but none matched, it is **not** allowed; otherwise it is allowed only with `'unsafe-inline'`.

```js
const policy = parseCsp("default-src 'self'; script-src 'self' https://cdn.example.com");
cspAllows(policy, 'script-src', 'https://cdn.example.com/a.js', { pageOrigin: 'https://app.example' }); // true
```

%% worked
**A similar problem, solved: `hostMatches(pattern, hostname)`** — exact or subdomain wildcard, never a suffix trick.

```js
export function hostMatches(pattern, hostname) {
  const p = pattern.toLowerCase();
  const h = hostname.toLowerCase();
  if (p.startsWith('*.')) return h.endsWith(p.slice(1));    // ① '.example.com': the leading dot means "a subdomain", and 'example.com' itself doesn't end with it
  return h === p;                                           // ② exact: 'evilexample.com' is NOT 'example.com'
}
```

The two classic bugs are `h.endsWith(p)` for plain hosts (`evilcdn.example.com` ends with `cdn.example.com`) and treating `*.example.com` as including the bare domain. Use the `URL` class to get `hostname`, `port`, `protocol` and `pathname` correctly instead of slicing strings.

%% explain
- **`parseCsp`**: split on `;` then whitespace; first duplicate wins.
- **`cspAllows`**: resolve sources (with fallback), then `some` source matches.
- **Source matching**: `'self'`, scheme, `*`, host with scheme/port/path rules.
- **`cspAllowsInline`**: nonce or hash, else `'unsafe-inline'` only when neither is present.

%% nudge
- Why does the leading dot in `.example.com` matter?
- What is the default port for `https:` and `http:` when the URL has none?

%% starter
```js
export function parseCsp(header) {
  return {};
}

export function cspAllows(policy, directive, url, { pageOrigin } = {}) {
  return false;
}

export function cspAllowsInline(policy, directive, { nonce, hash } = {}) {
  return false;
}
```

%% tests
```js
const page = { pageOrigin: 'https://app.example' };
const allows = (header, directive, url) => cspAllows(parseCsp(header), directive, url, page);

describe('parseCsp', () => {
  it('parses directives and sources', () => {
    expect(parseCsp("default-src 'self'; script-src 'self' https://cdn.example.com; object-src 'none'")).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://cdn.example.com'],
      'object-src': ["'none'"],
    });
  });
  it('lower-cases names, skips empty parts and keeps the first duplicate', () => {
    expect(parseCsp("Script-Src 'self' ;; ; script-src https://evil.example; upgrade-insecure-requests")).toEqual({
      'script-src': ["'self'"],
      'upgrade-insecure-requests': [],
    });
    expect(parseCsp('')).toEqual({});
    expect(parseCsp(undefined)).toEqual({});
  });
});

describe('cspAllows', () => {
  it("matches 'self' on scheme, host and port", () => {
    const h = "script-src 'self'";
    expect(allows(h, 'script-src', 'https://app.example/a.js')).toBe(true);
    expect(allows(h, 'script-src', 'http://app.example/a.js')).toBe(false);
    expect(allows(h, 'script-src', 'https://app.example:8443/a.js')).toBe(false);
    expect(allows(h, 'script-src', 'https://other.example/a.js')).toBe(false);
  });
  it('matches exact hosts, not look-alikes', () => {
    const h = 'script-src cdn.example.com';
    expect(allows(h, 'script-src', 'https://cdn.example.com/x.js')).toBe(true);
    expect(allows(h, 'script-src', 'https://CDN.example.com/x.js')).toBe(true);
    expect(allows(h, 'script-src', 'https://evilcdn.example.com/x.js')).toBe(false);
    expect(allows(h, 'script-src', 'https://cdn.example.com.evil.example/x.js')).toBe(false);
    expect(allows(h, 'script-src', 'https://x.cdn.example.com/x.js')).toBe(false);
  });
  it('wildcard hosts match subdomains only', () => {
    const h = 'script-src *.example.com';
    expect(allows(h, 'script-src', 'https://a.example.com/x')).toBe(true);
    expect(allows(h, 'script-src', 'https://a.b.example.com/x')).toBe(true);
    expect(allows(h, 'script-src', 'https://example.com/x')).toBe(false);
    expect(allows(h, 'script-src', 'https://evilexample.com/x')).toBe(false);
  });
  it('applies the scheme rules for sources without a scheme', () => {
    expect(allows('script-src cdn.example.com', 'script-src', 'http://cdn.example.com/x')).toBe(false);
    expect(cspAllows(parseCsp('script-src cdn.example.com'), 'script-src', 'https://cdn.example.com/x', { pageOrigin: 'http://app.example' })).toBe(true);
    expect(allows('script-src http://cdn.example.com', 'script-src', 'https://cdn.example.com/x')).toBe(false);
    expect(allows('script-src https://cdn.example.com', 'script-src', 'https://cdn.example.com/x')).toBe(true);
  });
  it('matches scheme sources and the star', () => {
    expect(allows('img-src https:', 'img-src', 'https://any.example/x.png')).toBe(true);
    expect(allows('img-src https:', 'img-src', 'http://any.example/x.png')).toBe(false);
    expect(allows('img-src data:', 'img-src', 'data:image/png;base64,AAAA')).toBe(true);
    expect(allows('img-src *', 'img-src', 'https://any.example/x.png')).toBe(true);
    expect(allows('img-src *', 'img-src', 'data:image/png;base64,AAAA')).toBe(false);
  });
  it('handles ports', () => {
    const h = 'script-src cdn.example.com:8443';
    expect(allows(h, 'script-src', 'https://cdn.example.com:8443/x')).toBe(true);
    expect(allows(h, 'script-src', 'https://cdn.example.com/x')).toBe(false);
    expect(allows(h, 'script-src', 'https://cdn.example.com:9000/x')).toBe(false);
    expect(allows('script-src cdn.example.com', 'script-src', 'https://cdn.example.com:8443/x')).toBe(false);
    expect(allows('script-src cdn.example.com:*', 'script-src', 'https://cdn.example.com:8443/x')).toBe(true);
    expect(allows('script-src cdn.example.com:443', 'script-src', 'https://cdn.example.com/x')).toBe(true);
  });
  it('handles paths', () => {
    expect(allows('script-src https://cdn.example.com/js/', 'script-src', 'https://cdn.example.com/js/a.js')).toBe(true);
    expect(allows('script-src https://cdn.example.com/js/', 'script-src', 'https://cdn.example.com/other.js')).toBe(false);
    expect(allows('script-src https://cdn.example.com/app.js', 'script-src', 'https://cdn.example.com/app.js')).toBe(true);
    expect(allows('script-src https://cdn.example.com/app.js', 'script-src', 'https://cdn.example.com/app.jsx')).toBe(false);
    expect(allows('script-src https://cdn.example.com/app.js', 'script-src', 'https://cdn.example.com/app.js/evil')).toBe(false);
  });
  it('falls back to default-src only when the directive is missing', () => {
    const h = "default-src 'self'; img-src https://img.example";
    expect(allows(h, 'script-src', 'https://app.example/a.js')).toBe(true);
    expect(allows(h, 'script-src', 'https://other.example/a.js')).toBe(false);
    expect(allows(h, 'img-src', 'https://img.example/a.png')).toBe(true);
    expect(allows(h, 'img-src', 'https://app.example/a.png')).toBe(false);
  });
  it('allows everything when there is no applicable policy', () => {
    expect(allows('img-src https:', 'script-src', 'https://anything.example/a.js')).toBe(true);
    expect(cspAllows({}, 'script-src', 'https://anything.example/a.js', page)).toBe(true);
  });
  it("treats 'none' and empty lists as allowing nothing", () => {
    expect(allows("script-src 'none'", 'script-src', 'https://app.example/a.js')).toBe(false);
    expect(allows('script-src', 'script-src', 'https://app.example/a.js')).toBe(false);
    expect(allows("script-src 'none' https://cdn.example.com", 'script-src', 'https://cdn.example.com/a.js')).toBe(true);
  });
  it('does not match nonce or keyword tokens against URLs and rejects bad URLs', () => {
    expect(allows("script-src 'nonce-abc' 'unsafe-inline'", 'script-src', 'https://app.example/a.js')).toBe(false);
    expect(allows("script-src 'self'", 'script-src', 'not a url')).toBe(false);
  });
});

describe('cspAllowsInline', () => {
  it('allows inline when there is no policy', () => {
    expect(cspAllowsInline({}, 'script-src')).toBe(true);
  });
  it('matches nonces exactly', () => {
    const p = parseCsp("script-src 'nonce-R4nd0m' 'self'");
    expect(cspAllowsInline(p, 'script-src', { nonce: 'R4nd0m' })).toBe(true);
    expect(cspAllowsInline(p, 'script-src', { nonce: 'r4nd0m' })).toBe(false);
    expect(cspAllowsInline(p, 'script-src', { nonce: 'R4nd0' })).toBe(false);
    expect(cspAllowsInline(p, 'script-src', {})).toBe(false);
  });
  it('matches hashes', () => {
    const p = parseCsp("script-src 'sha256-AbC123='");
    expect(cspAllowsInline(p, 'script-src', { hash: 'sha256-AbC123=' })).toBe(true);
    expect(cspAllowsInline(p, 'script-src', { hash: 'sha256-Other=' })).toBe(false);
  });
  it("ignores 'unsafe-inline' when a nonce or hash is present", () => {
    const p = parseCsp("script-src 'unsafe-inline' 'nonce-abc'");
    expect(cspAllowsInline(p, 'script-src', {})).toBe(false);
    expect(cspAllowsInline(p, 'script-src', { nonce: 'abc' })).toBe(true);
    expect(cspAllowsInline(parseCsp("script-src 'unsafe-inline' 'sha256-x='"), 'script-src', {})).toBe(false);
  });
  it("allows inline with 'unsafe-inline' alone, and falls back to default-src", () => {
    expect(cspAllowsInline(parseCsp("script-src 'unsafe-inline'"), 'script-src')).toBe(true);
    expect(cspAllowsInline(parseCsp("default-src 'self'"), 'script-src')).toBe(false);
    expect(cspAllowsInline(parseCsp("default-src 'unsafe-inline'"), 'style-src')).toBe(true);
    expect(cspAllowsInline(parseCsp("default-src 'unsafe-inline'; style-src 'self'"), 'style-src')).toBe(false);
  });
  it("blocks inline under 'none'", () => {
    expect(cspAllowsInline(parseCsp("script-src 'none'"), 'script-src', { nonce: 'x' })).toBe(false);
    expect(cspAllowsInline({ 'script-src': [] }, 'script-src')).toBe(false);
  });
});
```

%% hints
- `parseCsp`: `for (const part of header.split(';')) { const tokens = part.trim().split(/\s+/).filter(Boolean); ... }`.
- Host-source regex: `/^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.[^\/:*]+|[^\/:*]+)(?::(\d+|\*))?(\/.*)?$/i`.
- Default port: `url.port || (url.protocol === 'https:' ? '443' : '80')`; a source without a port wants the default for the URL's scheme.
- Inline: nonce token `'nonce-X'` → `token.slice(7, -1)`; hash token → `token.slice(1, -1)`.

%% solution
```js
export function parseCsp(header) {
  const policy = {};
  for (const part of String(header ?? '').split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const name = tokens[0].toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(policy, name)) policy[name] = tokens.slice(1);
  }
  return policy;
}

function matchSource(source, url, page) {
  const lower = source.toLowerCase();
  if (lower === "'self'") return url.origin === page.origin;
  if (lower.startsWith("'")) return false;
  if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return url.protocol === lower;
  if (source === '*') return url.protocol === 'http:' || url.protocol === 'https:';
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.[^\/:*]+|[^\/:*]+)(?::(\d+|\*))?(\/.*)?$/i.exec(source);
  if (!m) return false;
  const [, scheme, host, port, path] = m;
  if (scheme) {
    if (url.protocol !== scheme.toLowerCase() + ':') return false;
  } else if (!(url.protocol === page.protocol || (page.protocol === 'http:' && url.protocol === 'https:'))) {
    return false;
  }
  const h = host.toLowerCase();
  if (h.startsWith('*.')) {
    if (!url.hostname.endsWith(h.slice(1))) return false;
  } else if (url.hostname !== h) {
    return false;
  }
  if (port !== '*') {
    const defaultPort = url.protocol === 'https:' ? '443' : '80';
    if ((url.port || defaultPort) !== (port ?? defaultPort)) return false;
  }
  if (path) return path.endsWith('/') ? url.pathname.startsWith(path) : url.pathname === path;
  return true;
}

export function cspAllows(policy, directive, url, { pageOrigin } = {}) {
  const sources = policy[directive] ?? policy['default-src'];
  if (sources === undefined) return true;
  let target;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  const page = new URL(pageOrigin);
  return sources.filter((s) => s.toLowerCase() !== "'none'").some((s) => matchSource(s, target, page));
}

export function cspAllowsInline(policy, directive, { nonce, hash } = {}) {
  const sources = policy[directive] ?? policy['default-src'];
  if (sources === undefined) return true;
  const nonces = sources.filter((s) => /^'nonce-/i.test(s));
  const hashes = sources.filter((s) => /^'sha(256|384|512)-/i.test(s));
  if (nonce !== undefined && nonces.some((s) => s.slice(7, -1) === nonce)) return true;
  if (hash !== undefined && hashes.some((s) => s.slice(1, -1) === hash)) return true;
  if (nonces.length || hashes.length) return false;
  return sources.some((s) => s.toLowerCase() === "'unsafe-inline'");
}
```

%% exercise sec-audit-headers | Audit a header set | 3 | js | js | auditHeaders | 28
Implement `auditHeaders(headers)`. `headers` maps header names (any case) to string values. Return an array of findings `{ id, severity, message }` (`message` a non-empty string), sorted by severity (`high`, then `medium`, then `low`) and then by `id`. The rules:

- `hsts-missing` (high): no `Strict-Transport-Security`. If present: `hsts-weak` (medium) when `max-age` is missing or below **15552000**; `hsts-no-subdomains` (low) when `includeSubDomains` is absent.
- `csp-missing` (high): no `Content-Security-Policy`. If present, look at the effective script sources (`script-src`, else `default-src`): none of them → `csp-no-script-restriction` (medium); otherwise `csp-unsafe-inline` (high) if it has `'unsafe-inline'` **without** any `'nonce-…'` or `'sha…-…'` token; `csp-unsafe-eval` (medium) if it has `'unsafe-eval'`; `csp-wildcard-script` (high) if it has `*`, `http:`, `https:` or `data:`.
- `nosniff-missing` (medium): `X-Content-Type-Options` isn't `nosniff` (case-insensitive, trimmed).
- `framing-unprotected` (medium): no `X-Frame-Options` **and** no `frame-ancestors` in the CSP.
- `referrer-policy-missing` (low).
- `server-version-leak` (low): a `Server` value containing a digit. `x-powered-by-present` (low): an `X-Powered-By` header exists.

```js
auditHeaders({}).map((f) => f.id); // starts with the high severity findings
```

%% worked
**A similar problem, solved: `auditCookies(cookies)`** — a list of independent rules, each adding a finding.

```js
export function auditCookies(cookies) {                   // cookies: [{ name, secure, httpOnly, sameSite }]
  const findings = [];
  const add = (id, severity, message) => findings.push({ id, severity, message });
  for (const c of cookies) {
    if (!c.secure) add(`${c.name}-not-secure`, 'high', `${c.name} is sent over plain HTTP`);
    if (!c.httpOnly) add(`${c.name}-readable`, 'medium', `${c.name} can be read by scripts`);
  }
  const rank = { high: 0, medium: 1, low: 2 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id));   // ① severity first, then a stable tie-break
}
```

Normalise the header names **once** (lower-case keys) so every rule can read them simply. Keep rules **independent**; each one pushes zero or more findings. Sorting at the end gives a predictable report.

%% explain
- **Lower-case the header names** first.
- **Independent rules** for HSTS, CSP, nosniff, framing, referrer, leaks.
- **CSP rules** use script sources with the `default-src` fallback.
- **Sort** by severity, then id.

%% nudge
- How do you read a header without caring about its case?
- Why does a nonce make `'unsafe-inline'` harmless in a policy?

%% starter
```js
export function auditHeaders(headers) {
  const findings = [];
  return findings;
}
```

%% tests
```js
const good = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
const ids = (headers) => auditHeaders(headers).map((f) => f.id);

describe('auditHeaders', () => {
  it('has no findings for a good header set', () => {
    expect(auditHeaders(good)).toEqual([]);
  });
  it('reports everything missing, sorted by severity then id', () => {
    const findings = auditHeaders({});
    expect(findings.map((f) => f.id)).toEqual([
      'csp-missing', 'hsts-missing',
      'framing-unprotected', 'nosniff-missing',
      'referrer-policy-missing',
    ]);
    expect(findings.map((f) => f.severity)).toEqual(['high', 'high', 'medium', 'medium', 'low']);
    for (const f of findings) expect(typeof f.message).toBe('string');
    for (const f of findings) expect(f.message.length).toBeGreaterThan(0);
  });
  it('reads header names case-insensitively', () => {
    const lower = Object.fromEntries(Object.entries(good).map(([k, v]) => [k.toLowerCase(), v]));
    const upper = Object.fromEntries(Object.entries(good).map(([k, v]) => [k.toUpperCase(), v]));
    expect(auditHeaders(lower)).toEqual([]);
    expect(auditHeaders(upper)).toEqual([]);
  });
  it('checks HSTS strength and subdomains', () => {
    expect(ids({ ...good, 'Strict-Transport-Security': 'max-age=3600; includeSubDomains' })).toEqual(['hsts-weak']);
    expect(ids({ ...good, 'Strict-Transport-Security': 'includeSubDomains' })).toEqual(['hsts-weak']);
    expect(ids({ ...good, 'Strict-Transport-Security': 'max-age=15552000; includeSubDomains' })).toEqual([]);
    expect(ids({ ...good, 'Strict-Transport-Security': 'max-age=31536000' })).toEqual(['hsts-no-subdomains']);
    expect(ids({ ...good, 'Strict-Transport-Security': 'max-age=100' })).toEqual(['hsts-weak', 'hsts-no-subdomains']);
  });
  it('flags unsafe-inline unless a nonce or hash is present', () => {
    expect(ids({ ...good, 'Content-Security-Policy': "script-src 'self' 'unsafe-inline'; frame-ancestors 'none'" })).toEqual(['csp-unsafe-inline']);
    expect(ids({ ...good, 'Content-Security-Policy': "script-src 'self' 'unsafe-inline' 'nonce-abc'; frame-ancestors 'none'" })).toEqual([]);
    expect(ids({ ...good, 'Content-Security-Policy': "script-src 'unsafe-inline' 'sha256-x='; frame-ancestors 'none'" })).toEqual([]);
  });
  it('flags unsafe-eval and wildcard script sources', () => {
    expect(ids({ ...good, 'Content-Security-Policy': "script-src 'self' 'unsafe-eval'; frame-ancestors 'none'" })).toEqual(['csp-unsafe-eval']);
    for (const source of ['*', 'https:', 'http:', 'data:']) {
      expect(ids({ ...good, 'Content-Security-Policy': `script-src ${source}; frame-ancestors 'none'` })).toEqual(['csp-wildcard-script']);
    }
  });
  it('uses default-src when script-src is missing, and flags a policy that restricts nothing', () => {
    expect(ids({ ...good, 'Content-Security-Policy': "default-src 'unsafe-inline'; frame-ancestors 'none'" })).toEqual(['csp-unsafe-inline']);
    expect(ids({ ...good, 'Content-Security-Policy': "img-src 'self'; frame-ancestors 'none'" })).toEqual(['csp-no-script-restriction']);
    expect(ids({ ...good, 'Content-Security-Policy': "default-src 'self'; script-src 'self'; frame-ancestors 'none'" })).toEqual([]);
  });
  it('requires nosniff exactly', () => {
    expect(ids({ ...good, 'X-Content-Type-Options': ' NoSniff ' })).toEqual([]);
    expect(ids({ ...good, 'X-Content-Type-Options': 'sniff' })).toEqual(['nosniff-missing']);
  });
  it('accepts either X-Frame-Options or frame-ancestors', () => {
    expect(ids({ ...good, 'Content-Security-Policy': "default-src 'self'", 'X-Frame-Options': 'DENY' })).toEqual([]);
    expect(ids({ ...good, 'Content-Security-Policy': "default-src 'self'" })).toEqual(['framing-unprotected']);
  });
  it('flags version leaks', () => {
    expect(ids({ ...good, Server: 'nginx/1.18.0' })).toEqual(['server-version-leak']);
    expect(ids({ ...good, Server: 'nginx' })).toEqual([]);
    expect(ids({ ...good, 'X-Powered-By': 'Express' })).toEqual(['x-powered-by-present']);
    expect(ids({ ...good, Server: 'Apache/2.4', 'X-Powered-By': 'PHP/8.1' })).toEqual(['server-version-leak', 'x-powered-by-present']);
  });
  it('sorts high before medium before low', () => {
    const findings = auditHeaders({ 'X-Powered-By': 'x', 'Content-Security-Policy': "script-src 'unsafe-eval' *; frame-ancestors 'none'" });
    const rank = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < findings.length; i++) expect(rank[findings[i - 1].severity]).toBeLessThanOrEqual(rank[findings[i].severity]);
  });
});
```

%% hints
- Normalise: `const h = {}; for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = String(v);`
- Parse the CSP the same way as in the previous exercise: split on `;`, first token is the name.
- Sort: `rank[a.severity] - rank[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)`.

%% solution
```js
const RANK = { high: 0, medium: 1, low: 2 };

function parsePolicy(header) {
  const policy = {};
  for (const part of String(header).split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const name = tokens[0].toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(policy, name)) policy[name] = tokens.slice(1);
  }
  return policy;
}

export function auditHeaders(headers) {
  const h = {};
  for (const [k, v] of Object.entries(headers)) h[k.toLowerCase()] = String(v);
  const findings = [];
  const add = (id, severity, message) => findings.push({ id, severity, message });

  const hsts = h['strict-transport-security'];
  if (hsts === undefined) {
    add('hsts-missing', 'high', 'Strict-Transport-Security is missing: browsers may use plain HTTP.');
  } else {
    const m = /max-age\s*=\s*(\d+)/i.exec(hsts);
    if (!m || Number(m[1]) < 15552000) add('hsts-weak', 'medium', 'HSTS max-age is missing or shorter than 180 days.');
    if (!/includesubdomains/i.test(hsts)) add('hsts-no-subdomains', 'low', 'HSTS does not cover subdomains.');
  }

  const csp = h['content-security-policy'];
  let policy = {};
  if (csp === undefined) {
    add('csp-missing', 'high', 'No Content-Security-Policy: nothing limits injected scripts.');
  } else {
    policy = parsePolicy(csp);
    const script = policy['script-src'] ?? policy['default-src'];
    if (script === undefined) {
      add('csp-no-script-restriction', 'medium', 'The policy sets neither script-src nor default-src.');
    } else {
      const lower = script.map((s) => s.toLowerCase());
      const guarded = lower.some((s) => /^'(nonce-|sha(256|384|512)-)/.test(s));
      if (lower.includes("'unsafe-inline'") && !guarded) add('csp-unsafe-inline', 'high', "'unsafe-inline' lets injected inline scripts run.");
      if (lower.includes("'unsafe-eval'")) add('csp-unsafe-eval', 'medium', "'unsafe-eval' allows string-to-code evaluation.");
      if (lower.some((s) => s === '*' || s === 'http:' || s === 'https:' || s === 'data:')) {
        add('csp-wildcard-script', 'high', 'A broad script source allows scripts from almost anywhere.');
      }
    }
  }

  if ((h['x-content-type-options'] ?? '').trim().toLowerCase() !== 'nosniff') {
    add('nosniff-missing', 'medium', 'X-Content-Type-Options: nosniff is missing.');
  }
  if (h['x-frame-options'] === undefined && !('frame-ancestors' in policy)) {
    add('framing-unprotected', 'medium', 'The page can be framed by other sites (clickjacking).');
  }
  if (h['referrer-policy'] === undefined) add('referrer-policy-missing', 'low', 'No Referrer-Policy: full URLs may leak.');
  if (/\d/.test(h['server'] ?? '')) add('server-version-leak', 'low', 'The Server header reveals a version.');
  if (h['x-powered-by'] !== undefined) add('x-powered-by-present', 'low', 'X-Powered-By reveals the technology stack.');

  return findings.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
```

%% exercise sec-sri | Verify Subresource Integrity | 3 | js | js | verifySri, buildIntegrity | 20
Implement Subresource Integrity helpers. `hashFn(algorithm, content)` is **injected** and returns the **base64** digest string for `'sha256'`, `'sha384'` or `'sha512'`.

- `buildIntegrity(content, hashFn, algorithm = 'sha384')` returns `ALGORITHM-DIGEST` (for example `sha384-…`). An algorithm other than the three throws `Error('unsupported algorithm: NAME')`.
- `verifySri(content, integrity, hashFn)` returns whether the content matches the integrity metadata. `integrity` is a space-separated list of `algorithm-digest` tokens (a token may end with `?options`, which you ignore). Only `sha256`, `sha384` and `sha512` tokens count. The **strongest** algorithm present (`sha512` > `sha384` > `sha256`) is used: the content must match **at least one token of that algorithm** (exact comparison). If there are **no valid tokens** (or `integrity` isn't a non-empty string), return `false`.

```js
const hashFn = (algorithm, content) => algorithm + ':' + content.length;
verifySri('abc', 'sha256-sha256:3', hashFn); // true
```

%% worked
**A similar problem, solved: `strongestDigest(tokens)`** — pick by rank, then compare.

```js
const RANK = { sha256: 1, sha384: 2, sha512: 3 };

export function strongest(tokens) {
  const known = tokens.filter((t) => RANK[t.algo]);                       // ① drop what you don't understand
  if (!known.length) return [];
  const best = Math.max(...known.map((t) => RANK[t.algo]));               // ② the highest rank present
  return known.filter((t) => RANK[t.algo] === best);                      // ③ only those tokens count
}
```

Why only the **strongest**? An attacker who can forge a weak hash must not be able to **downgrade** the check: if a `sha512` token is present, a matching `sha256` token alone is irrelevant. Failing **closed** (no valid token means `false`) is the safe default for a security check.

%% explain
- **Parse tokens**, ignore `?options`, keep only the three known algorithms.
- **Strongest algorithm** decides; any token of that algorithm may match.
- **No valid tokens**: `false`.
- **`buildIntegrity`** formats `algo-digest` and validates the algorithm.

%% nudge
- Why shouldn't a weaker matching token be enough when a stronger one is present?
- What should happen when the integrity string has only unknown algorithms?

%% starter
```js
export function buildIntegrity(content, hashFn, algorithm = 'sha384') {
  return '';
}

export function verifySri(content, integrity, hashFn) {
  return false;
}
```

%% tests
```js
const hashFn = jest.fn((algorithm, content) => `${algorithm}:${content.length}:${content[0] ?? ''}`);
const digest = (algorithm, content) => hashFn(algorithm, content);

describe('buildIntegrity', () => {
  it('defaults to sha384', () => {
    expect(buildIntegrity('abc', hashFn)).toBe('sha384-sha384:3:a');
  });
  it('supports the three algorithms', () => {
    expect(buildIntegrity('abc', hashFn, 'sha256')).toBe('sha256-sha256:3:a');
    expect(buildIntegrity('abc', hashFn, 'sha512')).toBe('sha512-sha512:3:a');
  });
  it('rejects other algorithms', () => {
    expect(() => buildIntegrity('abc', hashFn, 'md5')).toThrow('unsupported algorithm: md5');
    expect(() => buildIntegrity('abc', hashFn, 'sha1')).toThrow('unsupported algorithm: sha1');
  });
});

describe('verifySri', () => {
  it('accepts matching content', () => {
    expect(verifySri('abc', buildIntegrity('abc', hashFn), hashFn)).toBe(true);
    expect(verifySri('abc', buildIntegrity('abc', hashFn, 'sha256'), hashFn)).toBe(true);
  });
  it('rejects altered content', () => {
    expect(verifySri('xbc', buildIntegrity('abc', hashFn), hashFn)).toBe(false);
    expect(verifySri('xyz', buildIntegrity('abc', hashFn), hashFn)).toBe(false);
  });
  it('accepts any token of the strongest algorithm', () => {
    const list = `sha384-wrong sha384-${digest('sha384', 'abc')}`;
    expect(verifySri('abc', list, hashFn)).toBe(true);
    expect(verifySri('abc', 'sha384-wrong sha384-alsowrong', hashFn)).toBe(false);
  });
  it('uses only the strongest algorithm present', () => {
    const list = `sha256-${digest('sha256', 'abc')} sha512-wrong`;
    expect(verifySri('abc', list, hashFn)).toBe(false);
    const both = `sha256-wrong sha512-${digest('sha512', 'abc')}`;
    expect(verifySri('abc', both, hashFn)).toBe(true);
    expect(verifySri('abc', `sha256-${digest('sha256', 'abc')} sha384-wrong`, hashFn)).toBe(false);
  });
  it('ignores options after the digest', () => {
    expect(verifySri('abc', `sha384-${digest('sha384', 'abc')}?ct=application/javascript`, hashFn)).toBe(true);
  });
  it('ignores unknown algorithms', () => {
    expect(verifySri('abc', `md5-whatever sha256-${digest('sha256', 'abc')}`, hashFn)).toBe(true);
    expect(verifySri('abc', 'md5-whatever sha1-whatever', hashFn)).toBe(false);
  });
  it('fails closed on empty or invalid metadata', () => {
    for (const value of ['', '   ', 'garbage', 'sha256', 'sha256-', undefined, null, 42]) {
      expect(verifySri('abc', value, hashFn)).toBe(false);
    }
  });
  it('handles extra whitespace', () => {
    expect(verifySri('abc', `  sha384-wrong    sha384-${digest('sha384', 'abc')}  `, hashFn)).toBe(true);
  });
});
```

%% hints
- Tokens: `integrity.trim().split(/\s+/)`, then `const [algo, ...rest] = token.split('-')`; the digest is `rest.join('-')` with `?…` removed.
- Skip tokens with an unknown algorithm or an empty digest.
- `Math.max` over ranks, then keep only the strongest tokens and compare each digest with `hashFn(algo, content)`.

%% solution
```js
const RANK = { sha256: 1, sha384: 2, sha512: 3 };

export function buildIntegrity(content, hashFn, algorithm = 'sha384') {
  if (!RANK[algorithm]) throw new Error('unsupported algorithm: ' + algorithm);
  return `${algorithm}-${hashFn(algorithm, content)}`;
}

export function verifySri(content, integrity, hashFn) {
  if (typeof integrity !== 'string' || integrity.trim() === '') return false;
  const tokens = integrity.trim().split(/\s+/).map((token) => {
    const dash = token.indexOf('-');
    if (dash < 1) return null;
    const algorithm = token.slice(0, dash);
    const digest = token.slice(dash + 1).split('?')[0];
    return RANK[algorithm] && digest ? { algorithm, digest } : null;
  }).filter(Boolean);
  if (tokens.length === 0) return false;
  const best = Math.max(...tokens.map((t) => RANK[t.algorithm]));
  const strongest = tokens.filter((t) => RANK[t.algorithm] === best);
  return strongest.some((t) => t.digest === hashFn(t.algorithm, content));
}
```

%% exercise sec-check-csp | Tests for a CSP evaluator | 4 | js | js | checkCspAllows | 36
`cspAllows(policy, directive, url, { pageOrigin })` decides whether `url` may load under a directive. `policy` maps directive names to arrays of sources. `'self'` means the **same scheme, host and port** as `pageOrigin`; a host source matches the host **exactly**; `*.example.com` matches **subdomains only**; a source without a port means the URL's **default port**, and a source port must match; a path ending in `/` is a prefix, any other path must match **exactly**; a scheme source (`https:`) matches that protocol only; a **missing** directive falls back to `default-src` (and everything is allowed if neither exists), but an **existing** directive does **not** fall back; `'none'` allows nothing. Write `checkCspAllows(cspAllows)` that passes for a correct evaluator and **fails** for: **wildcard hosts also match the bare domain**, **host sources match by suffix**, **'self' ignores the scheme**, **'self' ignores the port**, **doesn't fall back to default-src**, **uses default-src even when the directive exists**, **ignores 'none'**, **scheme source https: also matches http**, **path sources match by prefix**, **ignores the port in host sources**.

```js
const page = { pageOrigin: 'https://app.example' };
expect(cspAllows({ 'script-src': ["'self'"] }, 'script-src', 'https://app.example/a.js', page)).toBe(true);
```

%% worked
**A similar problem, solved: `checkAllowsHost(allowsHost)`** — a **match** and a **near-miss** for every matching rule.

```js
export function checkAllowsHost(allowsHost) {                       // allowsHost(patterns, hostname)
  expect(allowsHost(['example.com'], 'example.com')).toBe(true);           // ① the exact match
  expect(allowsHost(['example.com'], 'evilexample.com')).toBe(false);      // ② a SUFFIX look-alike
  expect(allowsHost(['example.com'], 'example.com.evil.example')).toBe(false);   // ③ a PREFIX look-alike
  expect(allowsHost(['*.example.com'], 'a.example.com')).toBe(true);       // ④ the wildcard's intended use
  expect(allowsHost(['*.example.com'], 'example.com')).toBe(false);        // ⑤ ...and its edge: the bare domain
}
```

For every rule the evaluator implements, write **one input the rule must accept** and **one near-miss it must reject**, differing in exactly one aspect (scheme, host, port, path). The near-miss is what catches the lazy implementation.

%% explain
- **`'self'`**: the same URL accepted; **scheme** changed, **port** changed, **host** changed.
- **Host sources**: exact, suffix look-alike, prefix look-alike, wildcard subdomain, bare domain.
- **Ports and paths**: matching, different port, prefix path vs exact path.
- **Fallbacks**: `default-src`, directive-overrides-default, `'none'`, scheme sources.

%% nudge
- Which URL is accepted by a suffix check but not by an exact host match?
- How do you show that an existing directive must not fall back to `default-src`?

%% starter
```js
export function checkCspAllows(cspAllows) {
  const page = { pageOrigin: 'https://app.example' };
  expect(cspAllows({ 'script-src': ["'self'"] }, 'script-src', 'https://app.example/a.js', page)).toBe(true);
  expect(cspAllows({ 'script-src': ["'self'"] }, 'script-src', 'https://other.example/a.js', page)).toBe(false);
  // your assertions: scheme and port of 'self', host look-alikes, wildcards, ports, paths, fallbacks, none
}
```

%% tests
```js
const make = ({ apexWild = false, suffix = false, selfScheme = false, selfPort = false, noFallback = false, alwaysDefault = false, noneIgnored = false, schemeLoose = false, pathPrefix = false, portIgnored = false } = {}) =>
  (policy, directive, url, { pageOrigin }) => {
    const sources = alwaysDefault ? (policy['default-src'] ?? policy[directive]) : (policy[directive] ?? (noFallback ? undefined : policy['default-src']));
    if (sources === undefined) return true;
    if (noneIgnored && sources.includes("'none'")) return true;
    let u;
    try { u = new URL(url); } catch { return false; }
    const page = new URL(pageOrigin);
    const match = (source) => {
      const lower = source.toLowerCase();
      if (lower === "'none'") return false;
      if (lower === "'self'") {
        if (selfScheme) return u.hostname === page.hostname;
        if (selfPort) return u.protocol === page.protocol && u.hostname === page.hostname;
        return u.origin === page.origin;
      }
      if (lower.startsWith("'")) return false;
      if (/^[a-z][a-z0-9+.-]*:$/i.test(source)) return schemeLoose ? u.protocol.startsWith(lower.slice(0, 4)) : u.protocol === lower;
      const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(\*\.[^\/:*]+|[^\/:*]+)(?::(\d+|\*))?(\/.*)?$/i.exec(source);
      if (!m) return false;
      const [, scheme, host, port, path] = m;
      if (scheme) { if (u.protocol !== scheme.toLowerCase() + ':') return false; }
      else if (!(u.protocol === page.protocol || (page.protocol === 'http:' && u.protocol === 'https:'))) return false;
      const h = host.toLowerCase();
      if (h.startsWith('*.')) {
        const ok = u.hostname.endsWith(h.slice(1)) || (apexWild && u.hostname === h.slice(2));
        if (!ok) return false;
      } else if (suffix ? !u.hostname.endsWith(h) : u.hostname !== h) return false;
      if (!portIgnored && port !== '*') {
        const def = u.protocol === 'https:' ? '443' : '80';
        if ((u.port || def) !== (port ?? def)) return false;
      }
      if (path) return path.endsWith('/') || pathPrefix ? u.pathname.startsWith(path) : u.pathname === path;
      return true;
    };
    return sources.some(match);
  };
const correct = make();
const mutants = {
  'lets wildcard hosts match the bare domain': make({ apexWild: true }),
  'matches host sources by suffix': make({ suffix: true }),
  "ignores the scheme for 'self'": make({ selfScheme: true }),
  "ignores the port for 'self'": make({ selfPort: true }),
  'does not fall back to default-src': make({ noFallback: true }),
  'uses default-src even when the directive exists': make({ alwaysDefault: true }),
  "ignores 'none'": make({ noneIgnored: true }),
  'lets https: match http too': make({ schemeLoose: true }),
  'matches path sources by prefix': make({ pathPrefix: true }),
  'ignores the port in host sources': make({ portIgnored: true }),
};

describe('your checkCspAllows', () => {
  it('passes on a correct evaluator', () => {
    expect(() => checkCspAllows(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an evaluator that ${name}`, () => {
      expect(() => checkCspAllows(impl)).toThrow();
    });
  }
});
```

%% hints
- `'self'` with page `https://app.example`: accept `https://app.example/a.js`; reject `http://app.example/a.js` and `https://app.example:8443/a.js`.
- Host: accept `cdn.example.com`; reject `https://evilcdn.example.com/x.js`. Wildcard `*.example.com`: accept `https://a.example.com/x`, reject `https://example.com/x`.
- Fallback: `{ 'default-src': ["'self'"] }` for `img-src` with a same-origin URL is `true`, with another origin `false`; `{ 'default-src': ["'self'"], 'img-src': ['https://img.example'] }` for a same-origin image is `false`.
- Path: `https://cdn.example.com/app.js` must reject `/app.jsx`.

%% solution
```js
export function checkCspAllows(cspAllows) {
  const page = { pageOrigin: 'https://app.example' };
  const ok = (policy, directive, url) => cspAllows(policy, directive, url, page);

  expect(ok({ 'script-src': ["'self'"] }, 'script-src', 'https://app.example/a.js')).toBe(true);
  expect(ok({ 'script-src': ["'self'"] }, 'script-src', 'http://app.example/a.js')).toBe(false);
  expect(ok({ 'script-src': ["'self'"] }, 'script-src', 'https://app.example:8443/a.js')).toBe(false);
  expect(ok({ 'script-src': ["'self'"] }, 'script-src', 'https://other.example/a.js')).toBe(false);

  expect(ok({ 'script-src': ['cdn.example.com'] }, 'script-src', 'https://cdn.example.com/x.js')).toBe(true);
  expect(ok({ 'script-src': ['cdn.example.com'] }, 'script-src', 'https://evilcdn.example.com/x.js')).toBe(false);
  expect(ok({ 'script-src': ['cdn.example.com'] }, 'script-src', 'https://cdn.example.com.evil.example/x.js')).toBe(false);

  expect(ok({ 'script-src': ['*.example.com'] }, 'script-src', 'https://a.example.com/x.js')).toBe(true);
  expect(ok({ 'script-src': ['*.example.com'] }, 'script-src', 'https://example.com/x.js')).toBe(false);

  expect(ok({ 'script-src': ['cdn.example.com:8443'] }, 'script-src', 'https://cdn.example.com:8443/x.js')).toBe(true);
  expect(ok({ 'script-src': ['cdn.example.com:8443'] }, 'script-src', 'https://cdn.example.com/x.js')).toBe(false);
  expect(ok({ 'script-src': ['cdn.example.com'] }, 'script-src', 'https://cdn.example.com:8443/x.js')).toBe(false);

  expect(ok({ 'script-src': ['https://cdn.example.com/js/'] }, 'script-src', 'https://cdn.example.com/js/a.js')).toBe(true);
  expect(ok({ 'script-src': ['https://cdn.example.com/js/'] }, 'script-src', 'https://cdn.example.com/other.js')).toBe(false);
  expect(ok({ 'script-src': ['https://cdn.example.com/app.js'] }, 'script-src', 'https://cdn.example.com/app.js')).toBe(true);
  expect(ok({ 'script-src': ['https://cdn.example.com/app.js'] }, 'script-src', 'https://cdn.example.com/app.jsx')).toBe(false);

  expect(ok({ 'img-src': ['https:'] }, 'img-src', 'https://any.example/x.png')).toBe(true);
  expect(ok({ 'img-src': ['https:'] }, 'img-src', 'http://any.example/x.png')).toBe(false);

  expect(ok({ 'default-src': ["'self'"] }, 'img-src', 'https://app.example/x.png')).toBe(true);
  expect(ok({ 'default-src': ["'self'"] }, 'img-src', 'https://other.example/x.png')).toBe(false);
  expect(ok({ 'default-src': ["'self'"], 'img-src': ['https://img.example'] }, 'img-src', 'https://app.example/x.png')).toBe(false);
  expect(ok({ 'default-src': ["'self'"], 'img-src': ['https://img.example'] }, 'img-src', 'https://img.example/x.png')).toBe(true);
  expect(ok({}, 'script-src', 'https://anything.example/a.js')).toBe(true);

  expect(ok({ 'script-src': ["'none'"] }, 'script-src', 'https://app.example/a.js')).toBe(false);
}
```
