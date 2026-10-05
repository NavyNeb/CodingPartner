---
id: rd-cdn-http-caching
track: rd
title: CDNs, HTTP caching and traffic reduction
summary: Cache-Control policy per kind of response, how an edge cache decides hit, miss or bypass (TTL, Vary, request coalescing), compression negotiation, and how to read edge logs to see whether traffic is really being absorbed.
---

## The idea in one sentence

The fastest and cheapest request is the one that **never reaches your origin server**: a **CDN** answers it from a copy **near the user**, and **HTTP caching headers** are how you tell it (and the browser) what is safe to keep and for how long.

> **Analogy** A chain of convenience stores (edges) stocked from one factory (origin). Most customers are served from the shelf; the factory only ships when a shelf runs empty. The **label on each box** (`Cache-Control`) says how long it can sit on the shelf, and whether it may be sold to anyone or only to one named customer (`private`).

*(Frameworks set many of these headers for you (Next.js marks `_next/static` as immutable), but you must know what they mean, because the interview question is always "why is this stale?" or "why is the origin on fire?")* The caching basics (`max-age`, `no-cache`, validators) are in **The web platform**; this lesson is about the **shared cache** in the middle.

## Cache-Control for a CDN

![A CDN](fig:rd-cdn "Hits end at the edge; only misses reach the origin.")

| Directive | Meaning |
| --- | --- |
| `max-age=N` | any cache may reuse the response for N seconds |
| `s-maxage=N` | the same, for **shared** caches (CDNs) only; **wins over `max-age`** there |
| `no-cache` | may store, but **revalidate** before reuse |
| `no-store` | do **not** store at all |
| `private` | only the **browser** may store it, **not** a CDN (per-user data) |
| `immutable` | will never change while fresh: skip revalidation |
| `stale-while-revalidate=N` | after expiry, serve the old copy for N more seconds **while refreshing in the background** |

![Policy by response type](fig:rd-policy "Hashed assets forever; HTML short or revalidated; anything personal private.")

The big idea is **cache busting by name**: put a content hash in the file name (`app.3f9a1c.js`), cache it for a year, and ship a new HTML page that points at the new name. The **HTML** is the only thing that must stay fresh.

```js try predict
const ttl = (cacheControl) => {
  const m = /s-maxage=(\d+)/.exec(cacheControl) ?? /max-age=(\d+)/.exec(cacheControl);
  return m ? Number(m[1]) : 0;
};

console.log(ttl('public, max-age=60, s-maxage=600'), ttl('max-age=60'), ttl('no-store'));
```

## Vary, the hit-ratio killer

A cache stores **one response per URL**, unless the response says **`Vary: Accept-Encoding`**: "my answer depends on this request header", so the cache keeps **one copy per distinct value** (a gzip copy, a Brotli copy). Powerful and dangerous: **`Vary: Cookie`** or `Vary: User-Agent` gives almost every user their own copy, so the **hit ratio collapses** and you are effectively uncached. `Vary: *` means "never reuse".

## The thundering herd

![Request coalescing](fig:rd-herd "One request to the origin, the rest wait for it.")

When a hot item expires, a thousand requests can arrive in the same instant. Without protection they all miss and **all hit the origin at once**. **Request coalescing** lets the first request go to the origin and makes the rest **wait for its answer**. Two safety rules: share the result **only if it is cacheable** (a private response must never reach another user), and **do not cache failures** (a `5xx` answered once must not be served for an hour). `stale-while-revalidate` and an **origin shield** (one regional cache in front of the origin) attack the same problem.

```stepper One URL, three requests
code:
  GET /a  (cold)       → MISS, origin called, stored 60 s
  GET /a  (10 s later) → HIT
  GET /a  (70 s later) → expired → MISS, origin called again
  GET /a  ×3 at once   → one origin call, three answers
---
line: 1
say: Nothing is cached, so the edge fetches from the origin, **stores** the response for its TTL, and answers. This is a **MISS**.
phase: cold
---
line: 2
say: Within the TTL the edge answers from its copy. The origin never hears about it: a **HIT**.
phase: warm
---
line: 3
say: After the TTL the copy is **expired**. The next request is a MISS again and refreshes the copy.
phase: expired
---
line: 4
say: If three requests arrive together at an expired item, **coalescing** sends one request to the origin and gives all three the same answer.
phase: herd
```

## Compression and protocols

Text assets (HTML, CSS, JS, JSON, SVG) should be **compressed**: **Brotli** (`br`) beats **gzip**, and static files can be **pre-compressed** at build time at the highest level. The browser says what it accepts in **`Accept-Encoding`** with optional **quality values** (`br;q=1.0, gzip;q=0.8, *;q=0.1`); the server picks the best it supports. Images and video are already compressed: do not gzip them. **HTTP/2** multiplexes many requests on one connection (so bundling everything into one file matters less than it used to) and **HTTP/3** (QUIC) removes head-of-line blocking over lossy mobile networks.

## Measure it

A CDN you cannot measure is a hope. From **edge logs** read the **hit ratio** (requests and **bytes**), the **origin request count**, and the **top missed URLs**: the fix for a bad ratio is almost always a header, a `Vary`, or a query string that changes on every request.

## Quick check

```check
Q: A response has "Cache-Control: max-age=60, s-maxage=600". How long does a CDN keep it?
A) 60 seconds
B) 600 seconds *
C) 660 seconds
D) Not at all
Why: s-maxage applies to shared caches and overrides max-age there.
---
Q: Why is "Vary: Cookie" on a public page a problem?
A) Cookies are insecure
B) Each distinct cookie value gets its own cached copy, so the hit ratio collapses *
C) It disables compression
D) It forces HTTP/1.1
Why: The cache keeps one copy per Vary value, and cookies differ for nearly every user.
---
Q: What does request coalescing protect against?
A) Slow clients
B) Many simultaneous misses all hitting the origin at once *
C) Large images
D) Expired certificates
Why: Only one request goes to the origin; the rest wait for its response.
---
Q: Why can fingerprinted assets be cached for a year?
A) Browsers ignore max-age for them
B) Changing the content changes the file name, so a stale copy is never requested *
C) CDNs purge them nightly
D) They are tiny
Why: The URL is the version; new content means a new URL.
```

## Recap

- **`s-maxage`** for the CDN, **`private`/`no-store`** for personal data, **`immutable`** + hashed names for static files, **short or revalidated** HTML.
- An edge decides **HIT / MISS / BYPASS**; it stores only cacheable successes, **never errors or private responses**.
- **`Vary`** creates one copy per header value: use `Accept-Encoding`, avoid `Cookie`.
- **Coalesce** concurrent misses (only cacheable results), use stale-while-revalidate, consider an origin shield.
- **Negotiate compression** with `Accept-Encoding` and its q-values; **measure** hit ratio and top misses from edge logs.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: pick a Cache-Control | A path test and three header strings |
| Negotiate the encoding | Parsing comma-separated q-values, defaults for unlisted names |
| Summarize edge logs | Counting, grouping and sorting |
| An edge cache | TTLs, `Vary` keys, in-flight sharing, `purge` |
| Tests for an edge cache | A fake clock, an origin spy, concurrent requests |

%% exercise rdl-guided-cc | Guided: pick a Cache-Control | 1 | js | js | cacheControlFor | 8 | guided
Implement `cacheControlFor(path)`:

- A **fingerprinted asset**, whose file name has a dot, then **6 or more hex characters**, then a dot and an extension (`app.3f9a1c.js`, `font.0a1b2c3d.woff2`): `'public, max-age=31536000, immutable'`.
- An **HTML page**, meaning the path ends with `.html` or `/`: `'no-cache'`.
- Anything else: `'public, max-age=3600'`.

```js
cacheControlFor('/assets/app.3f9a1c.js'); // 'public, max-age=31536000, immutable'
cacheControlFor('/about/');               // 'no-cache'
```

%% worked
**A similar problem, solved: `retentionFor(path)`** — a few ordered rules, most specific first.

```js
function retentionFor(path) {
  if (/\.[0-9a-f]{8}\.log$/.test(path)) return 'forever';    // ① the most specific shape first
  if (path.endsWith('.tmp')) return 'delete';                 // ② then the simple suffix rules
  return 'default';                                           // ③ a safe fallback
}
```

Test the **fingerprint** rule before the HTML rule, since a path could in theory match both; and anchor the regex with `$` so `app.3f9a1c.js.map` does not match by accident.

%% explain
- **Regex** for the fingerprint: dot, 6+ hex, dot, extension.
- **HTML** by suffix.
- **Fallback** one hour.

%% nudge
- Which rule must be tested first?
- Why anchor the regex with `$`?

%% starter
```js
export function cacheControlFor(path) {
  return 'public, max-age=3600';
}
```

%% tests
```js
describe('cacheControlFor', () => {
  it('caches fingerprinted assets for a year', () => {
    expect(cacheControlFor('/assets/app.3f9a1c.js')).toBe('public, max-age=31536000, immutable');
    expect(cacheControlFor('/static/font.0a1b2c3d.woff2')).toBe('public, max-age=31536000, immutable');
  });
  it('revalidates HTML', () => {
    expect(cacheControlFor('/index.html')).toBe('no-cache');
    expect(cacheControlFor('/about/')).toBe('no-cache');
    expect(cacheControlFor('/')).toBe('no-cache');
  });
  it('gives other files an hour', () => {
    expect(cacheControlFor('/logo.png')).toBe('public, max-age=3600');
    expect(cacheControlFor('/app.js')).toBe('public, max-age=3600');
  });
  it('needs at least six hex characters', () => {
    expect(cacheControlFor('/app.3f9a1.js')).toBe('public, max-age=3600');
    expect(cacheControlFor('/app.xyzxyzxyz.js')).toBe('public, max-age=3600');
  });
});
```

%% hints
- `/\.[0-9a-f]{6,}\.[a-z0-9]+$/i`
- `path.endsWith('.html') || path.endsWith('/')`

%% solution
```js
export function cacheControlFor(path) {
  if (/\.[0-9a-f]{6,}\.[a-z0-9]+$/i.test(path)) return 'public, max-age=31536000, immutable';
  if (path.endsWith('.html') || path.endsWith('/')) return 'no-cache';
  return 'public, max-age=3600';
}
```

%% exercise rdl-negotiate | Negotiate the encoding | 3 | js | js | negotiateEncoding | 28
`negotiateEncoding(header, available = ['br', 'gzip', 'identity'])` picks the content encoding for an `Accept-Encoding` header.

- A missing or blank header gives `'identity'`.
- The header is a comma-separated list of `name` or `name;q=value` (names are case-insensitive; a missing `q` is `1`; an unparsable `q` counts as `1`). `*` stands for every encoding **not listed**.
- For each encoding in `available`, its quality is its own `q` if listed, else the `*` quality if there is one, else `0`; the exception is `identity`, which counts as a **tiny positive** quality (`0.001`) when it is unlisted and there is no `*`, so it only wins when nothing better is acceptable.
- Choose the **highest quality above 0**; ties go to the one **earlier in `available`**. If nothing qualifies, return `null` (the server should answer 406).

```js
negotiateEncoding('gzip;q=0.5, br;q=0.8'); // 'br'
negotiateEncoding('deflate');              // 'identity'
```

%% worked
**A similar problem, solved: `pickLanguage(header, available)`** — the same weighted negotiation for `Accept-Language`.

```js
function pickLanguage(header, available) {
  const weights = new Map();
  for (const part of header.split(',')) {
    const [name, ...params] = part.trim().split(';');
    let q = 1;
    for (const p of params) {
      const m = /q=([\d.]+)/.exec(p);
      if (m) q = parseFloat(m[1]);                          // ① parse the weight, default 1
    }
    weights.set(name.trim().toLowerCase(), q);
  }
  let best = null, bestQ = 0;
  for (const lang of available) {
    const q = weights.get(lang) ?? 0;                       // ② unlisted means 0
    if (q > bestQ) { best = lang; bestQ = q; }              // ③ STRICTLY greater: earlier options win ties
  }
  return best;
}
```

Your version adds the `*` fallback and the special case for `identity`. Keep the **strict `>`**: that is what makes the server's own order the tie-breaker.

%% explain
- **Parse** into a map plus an optional `*` weight.
- **Quality per available encoding**, with the identity exception.
- **Strictly greater** wins; `null` if none above 0.

%% nudge
- Why must unlisted `identity` rank below any real compression the client accepts?
- What does `*;q=0` do to `identity`?

%% starter
```js
export function negotiateEncoding(header, available = ['br', 'gzip', 'identity']) {
  return 'identity';
}
```

%% tests
```js
describe('negotiateEncoding', () => {
  it('uses identity without a header', () => {
    expect(negotiateEncoding(undefined)).toBe('identity');
    expect(negotiateEncoding('')).toBe('identity');
    expect(negotiateEncoding('   ')).toBe('identity');
  });
  it('picks the highest quality', () => {
    expect(negotiateEncoding('gzip;q=0.5, br;q=0.8')).toBe('br');
    expect(negotiateEncoding('br;q=0.2, gzip;q=0.9')).toBe('gzip');
  });
  it('breaks ties with the server order', () => {
    expect(negotiateEncoding('gzip, br')).toBe('br');
    expect(negotiateEncoding('gzip, br', ['gzip', 'br', 'identity'])).toBe('gzip');
  });
  it('treats q=0 as unacceptable', () => {
    expect(negotiateEncoding('gzip, br;q=0')).toBe('gzip');
  });
  it('is case-insensitive and tolerates spaces', () => {
    expect(negotiateEncoding(' GZIP ; q=0.7 , BR;Q=0.9 ')).toBe('br');
  });
  it('applies the wildcard to unlisted encodings', () => {
    expect(negotiateEncoding('*;q=0.1, gzip')).toBe('gzip');
    expect(negotiateEncoding('*')).toBe('br');
    expect(negotiateEncoding('gzip;q=0.5, *;q=0.9')).toBe('br');
  });
  it('falls back to identity when nothing listed is available', () => {
    expect(negotiateEncoding('deflate')).toBe('identity');
    expect(negotiateEncoding('br', ['gzip', 'identity'])).toBe('identity');
  });
  it('returns null when everything is excluded', () => {
    expect(negotiateEncoding('identity;q=0, deflate')).toBeNull();
    expect(negotiateEncoding('*;q=0')).toBeNull();
    expect(negotiateEncoding('br;q=0, gzip;q=0, identity;q=0')).toBeNull();
  });
  it('lets a listed encoding beat the wildcard', () => {
    expect(negotiateEncoding('*;q=0, gzip')).toBe('gzip');
  });
  it('treats an unparsable quality as 1', () => {
    expect(negotiateEncoding('gzip;q=abc, br;q=0.5')).toBe('gzip');
  });
});
```

%% hints
- Split on `,`, then on `;`; `/^\s*q\s*=\s*([\d.]+)/i` for the weight.
- `quality = listed.has(enc) ? listed.get(enc) : star !== null ? star : enc === 'identity' ? 0.001 : 0`.
- `if (q > bestQ)` keeps the first of equal qualities.

%% solution
```js
export function negotiateEncoding(header, available = ['br', 'gzip', 'identity']) {
  if (!header || !header.trim()) return 'identity';
  const listed = new Map();
  let star = null;
  for (const part of header.split(',')) {
    const [rawName, ...params] = part.trim().split(';');
    const name = rawName.trim().toLowerCase();
    if (!name) continue;
    let q = 1;
    for (const p of params) {
      const m = /^\s*q\s*=\s*([\d.]+)/i.exec(p);
      if (m) {
        const n = parseFloat(m[1]);
        q = Number.isNaN(n) ? 1 : n;
      }
    }
    if (name === '*') star = q;
    else listed.set(name, q);
  }

  let best = null;
  let bestQ = 0;
  for (const enc of available) {
    let q;
    if (listed.has(enc)) q = listed.get(enc);
    else if (star !== null) q = star;
    else q = enc === 'identity' ? 0.001 : 0;
    if (q > bestQ) {
      best = enc;
      bestQ = q;
    }
  }
  return best;
}
```

%% exercise rdl-edge-logs | Summarize edge logs | 3 | js | js | summarizeEdgeLogs | 26
`summarizeEdgeLogs(entries)` turns a CDN access log into numbers. Each entry is `{ url, cache, bytes }` where `cache` is `'HIT'`, `'MISS'` or `'BYPASS'`.

It returns:

- `requests`: how many entries.
- `hitRatio`: hits ÷ requests, rounded to **3 decimals** (`0` for no requests).
- `byteHitRatio`: bytes served as hits ÷ total bytes, rounded to **3 decimals** (`0` when there are no bytes).
- `originRequests` and `originBytes`: the count and total bytes of every entry that is **not** a `HIT`.
- `topMisses`: the **three** URLs that cost the origin the most. Group the non-hit entries by `url` into `{ url, count, bytes }` and sort by `bytes` descending, then by `url` ascending.

```js
summarizeEdgeLogs([{ url: '/a', cache: 'HIT', bytes: 100 }, { url: '/b', cache: 'MISS', bytes: 300 }]);
// hitRatio 0.5, byteHitRatio 0.25, originRequests 1, originBytes 300, topMisses [{ url: '/b', count: 1, bytes: 300 }]
```

%% worked
**A similar problem, solved: `summarizeErrors(entries)`** — count, ratio, then group and rank.

```js
function summarizeErrors(entries) {
  const failed = entries.filter((e) => e.status >= 500);
  const byRoute = new Map();
  for (const e of failed) {
    const g = byRoute.get(e.route) ?? { route: e.route, count: 0 };   // ① group: one record per route
    g.count++;
    byRoute.set(e.route, g);
  }
  const top = [...byRoute.values()].sort((a, b) => b.count - a.count || (a.route < b.route ? -1 : 1));   // ② rank, with a tie-break
  return {
    rate: entries.length ? Math.round((failed.length / entries.length) * 1000) / 1000 : 0,   // ③ guard the division by zero
    top: top.slice(0, 3),
  };
}
```

Same four steps: **filter**, **group**, **sort with a tie-break**, **round**. Always guard the empty case before dividing.

%% explain
- **Ratios** rounded with `Math.round(x * 1000) / 1000`.
- **Group non-hits** by url.
- **Sort** by bytes desc then url asc; keep three.

%% nudge
- What does a ratio return when there are no entries?
- Does a `BYPASS` count as a hit?

%% starter
```js
export function summarizeEdgeLogs(entries) {
  return { requests: 0, hitRatio: 0, byteHitRatio: 0, originRequests: 0, originBytes: 0, topMisses: [] };
}
```

%% tests
```js
describe('summarizeEdgeLogs', () => {
  it('computes the ratios and origin load', () => {
    const r = summarizeEdgeLogs([
      { url: '/a', cache: 'HIT', bytes: 100 },
      { url: '/b', cache: 'MISS', bytes: 300 },
    ]);
    expect(r).toMatchObject({ requests: 2, hitRatio: 0.5, byteHitRatio: 0.25, originRequests: 1, originBytes: 300 });
    expect(r.topMisses).toEqual([{ url: '/b', count: 1, bytes: 300 }]);
  });
  it('rounds to three decimals', () => {
    const entries = [{ url: '/a', cache: 'HIT', bytes: 1 }, { url: '/a', cache: 'HIT', bytes: 1 }, { url: '/b', cache: 'MISS', bytes: 1 }];
    expect(summarizeEdgeLogs(entries).hitRatio).toBe(0.667);
    expect(summarizeEdgeLogs(entries).byteHitRatio).toBe(0.667);
  });
  it('counts BYPASS as origin traffic and not as a hit', () => {
    const r = summarizeEdgeLogs([{ url: '/me', cache: 'BYPASS', bytes: 50 }, { url: '/a', cache: 'HIT', bytes: 50 }]);
    expect(r.hitRatio).toBe(0.5);
    expect(r.originRequests).toBe(1);
    expect(r.originBytes).toBe(50);
  });
  it('groups misses by url and ranks by bytes, then url', () => {
    const r = summarizeEdgeLogs([
      { url: '/b', cache: 'MISS', bytes: 100 },
      { url: '/a', cache: 'MISS', bytes: 100 },
      { url: '/c', cache: 'MISS', bytes: 50 },
      { url: '/c', cache: 'BYPASS', bytes: 70 },
      { url: '/d', cache: 'MISS', bytes: 10 },
      { url: '/a', cache: 'HIT', bytes: 999 },
    ]);
    expect(r.topMisses).toEqual([
      { url: '/c', count: 2, bytes: 120 },
      { url: '/a', count: 1, bytes: 100 },
      { url: '/b', count: 1, bytes: 100 },
    ]);
  });
  it('handles an empty log', () => {
    expect(summarizeEdgeLogs([])).toEqual({ requests: 0, hitRatio: 0, byteHitRatio: 0, originRequests: 0, originBytes: 0, topMisses: [] });
  });
  it('handles a log of zero-byte entries', () => {
    expect(summarizeEdgeLogs([{ url: '/a', cache: 'HIT', bytes: 0 }]).byteHitRatio).toBe(0);
  });
});
```

%% hints
- `const round = (n) => Math.round(n * 1000) / 1000;`
- Group with a `Map` of `{ url, count, bytes }`.
- `sort((a, b) => b.bytes - a.bytes || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))`

%% solution
```js
export function summarizeEdgeLogs(entries) {
  const round = (n) => Math.round(n * 1000) / 1000;
  const requests = entries.length;
  const hits = entries.filter((e) => e.cache === 'HIT');
  const origin = entries.filter((e) => e.cache !== 'HIT');
  const totalBytes = entries.reduce((s, e) => s + e.bytes, 0);
  const hitBytes = hits.reduce((s, e) => s + e.bytes, 0);

  const byUrl = new Map();
  for (const e of origin) {
    const g = byUrl.get(e.url) ?? { url: e.url, count: 0, bytes: 0 };
    g.count++;
    g.bytes += e.bytes;
    byUrl.set(e.url, g);
  }
  const topMisses = [...byUrl.values()]
    .sort((a, b) => b.bytes - a.bytes || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))
    .slice(0, 3);

  return {
    requests,
    hitRatio: requests ? round(hits.length / requests) : 0,
    byteHitRatio: totalBytes ? round(hitBytes / totalBytes) : 0,
    originRequests: origin.length,
    originBytes: origin.reduce((s, e) => s + e.bytes, 0),
    topMisses,
  };
}
```

%% exercise rdl-edge-cache | An edge cache | 4 | js | js | createEdgeCache | 50
`createEdgeCache({ origin, now })` returns `{ handle(request), purge(url) }`. `origin(request)` is async and returns `{ status, headers, body }`; `now()` is milliseconds.

`handle({ url, method = 'GET', headers = {} })` (async) returns `{ status, headers, body, cache }` where `cache` is `'HIT'`, `'MISS'` or `'BYPASS'`. Header names are case-insensitive (lower-case them when reading).

- A method other than `GET` goes straight to the origin and is `'BYPASS'`.
- **Key**: the url plus, for each header name in the **`Vary`** list learned from the url's last cacheable response, that request header's value. (Before any response is seen, the list is empty.)
- A stored entry that is **not yet expired** (`now() < expires`) is a `'HIT'`.
- Otherwise call the origin. The response is **cacheable** only if: `status === 200`; its `Cache-Control` has neither `no-store` nor `private`; its TTL is positive, where TTL is `s-maxage` if present, else `max-age`, else `0` (seconds); and `Vary` is not `*`. A cacheable response is stored with `expires = now() + ttl * 1000`, the url's Vary list is learned from its `Vary` header (comma-separated, lower-cased), and the result is `'MISS'`. Anything else is returned as `'BYPASS'` and not stored.
- **Request coalescing**: concurrent requests with the **same key** share one origin call. If that response is cacheable, every waiter gets it as `'MISS'`; if it is **not** cacheable, each waiter makes **its own** origin request (a private response must never be shared) and gets `'BYPASS'`.
- A rejected origin call rejects the waiting requests, stores nothing and forgets the in-flight call.
- `purge(url)` removes every stored variant of that url and forgets its Vary list.

```js
const cache = createEdgeCache({ origin: async () => ({ status: 200, headers: { 'cache-control': 'public, s-maxage=60' }, body: 'hi' }), now: () => Date.now() });
(await cache.handle({ url: '/a' })).cache; // 'MISS'
(await cache.handle({ url: '/a' })).cache; // 'HIT'
```

%% worked
**A similar problem, solved: `createSharedStore({ source, now })`** — a keyed TTL store where **in-flight loads are shared only when the result may be shared**.

```js
function createSharedStore({ source, now }) {
  const stored = new Map();
  const inflight = new Map();
  return {
    async get(key) {
      const hit = stored.get(key);
      if (hit && now() < hit.expires) return { value: hit.value, from: 'HIT' };
      if (inflight.has(key)) {
        const outcome = await inflight.get(key);                    // ① wait for the leader
        if (outcome.shareable) return { value: outcome.value, from: 'MISS' };
        return { value: await source(key), from: 'BYPASS' };         // ② not shareable: do your OWN fetch
      }
      const promise = source(key).then((res) => {
        const shareable = res.ttl > 0 && !res.private;
        if (shareable) stored.set(key, { value: res.value, expires: now() + res.ttl * 1000 });
        return { shareable, value: res.value };
      }).finally(() => inflight.delete(key));                       // ③ always clear the in-flight marker
      inflight.set(key, promise);
      const outcome = await promise;
      return { value: outcome.value, from: outcome.shareable ? 'MISS' : 'BYPASS' };
    },
  };
}
```

Add to this: parsing `Cache-Control` and `Vary`, a **key that includes the varied headers**, and `purge`. Compute the **key before** the origin call (using the Vary list learned so far) and store under the key built from the **new** Vary list.

%% explain
- **`parseCacheControl`**: directives, `s-maxage` over `max-age`.
- **`keyFor(url, vary, headers)`**.
- **Leader / follower** with an in-flight map; followers re-fetch when the result is not cacheable.
- **`purge`** walks entries by url.

%% nudge
- Why must the follower of an uncacheable response fetch for itself?
- Which Vary list builds the key used for the lookup, and which one for the store?

%% starter
```js
export function createEdgeCache({ origin, now }) {
  return {
    async handle(request) {
      return { ...(await origin(request)), cache: 'BYPASS' };
    },
    purge(url) {},
  };
}
```

%% tests
```js
describe('createEdgeCache', () => {
  const resp = (cc, extra = {}, status = 200) => ({ status, headers: { 'cache-control': cc, ...extra }, body: 'body' });
  const setup = (respond = () => resp('public, max-age=60')) => {
    let t = 0;
    const origin = jest.fn(async (req) => respond(req));
    const cache = createEdgeCache({ origin, now: () => t });
    return { cache, origin, at: (x) => { t = x; } };
  };
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };

  it('misses, then hits', async () => {
    const { cache, origin } = setup();
    const first = await cache.handle({ url: '/a' });
    expect(first).toEqual({ status: 200, headers: { 'cache-control': 'public, max-age=60' }, body: 'body', cache: 'MISS' });
    expect((await cache.handle({ url: '/a' })).cache).toBe('HIT');
    expect(origin).toHaveBeenCalledTimes(1);
  });
  it('expires exactly at the TTL', async () => {
    const { cache, origin, at } = setup();
    await cache.handle({ url: '/a' });
    at(59999);
    expect((await cache.handle({ url: '/a' })).cache).toBe('HIT');
    at(60000);
    expect((await cache.handle({ url: '/a' })).cache).toBe('MISS');
    expect(origin).toHaveBeenCalledTimes(2);
  });
  it('prefers s-maxage over max-age', async () => {
    const { cache, at } = setup(() => resp('public, max-age=10, s-maxage=100'));
    await cache.handle({ url: '/a' });
    at(50000);
    expect((await cache.handle({ url: '/a' })).cache).toBe('HIT');
    at(100000);
    expect((await cache.handle({ url: '/a' })).cache).toBe('MISS');
  });
  it('does not store private, no-store, zero-ttl or header-less responses', async () => {
    for (const cc of ['private, max-age=60', 'no-store', 'public, max-age=0', 'public', '']) {
      const { cache, origin } = setup(() => resp(cc));
      expect((await cache.handle({ url: '/a' })).cache).toBe('BYPASS');
      expect((await cache.handle({ url: '/a' })).cache).toBe('BYPASS');
      expect(origin).toHaveBeenCalledTimes(2);
    }
    const none = setup(() => ({ status: 200, headers: {}, body: 'x' }));
    expect((await none.cache.handle({ url: '/a' })).cache).toBe('BYPASS');
  });
  it('never stores errors or non-200 responses', async () => {
    for (const status of [500, 503, 404, 301]) {
      const { cache, origin } = setup(() => resp('public, max-age=60', {}, status));
      expect((await cache.handle({ url: '/a' })).cache).toBe('BYPASS');
      await cache.handle({ url: '/a' });
      expect(origin).toHaveBeenCalledTimes(2);
    }
  });
  it('keeps urls independent', async () => {
    const { cache, origin } = setup();
    await cache.handle({ url: '/a' });
    await cache.handle({ url: '/b' });
    expect((await cache.handle({ url: '/a' })).cache).toBe('HIT');
    expect(origin).toHaveBeenCalledTimes(2);
  });
  it('bypasses non-GET requests', async () => {
    const { cache, origin } = setup();
    expect((await cache.handle({ url: '/a', method: 'POST' })).cache).toBe('BYPASS');
    expect((await cache.handle({ url: '/a', method: 'post' })).cache).toBe('BYPASS');
    expect((await cache.handle({ url: '/a' })).cache).toBe('MISS');
    expect(origin).toHaveBeenCalledTimes(3);
  });
  it('keeps one copy per Vary value', async () => {
    const { cache, origin } = setup((req) => resp('public, max-age=60', { vary: 'Accept-Encoding' }));
    const gzip = { url: '/a', headers: { 'Accept-Encoding': 'gzip' } };
    const br = { url: '/a', headers: { 'accept-encoding': 'br' } };
    expect((await cache.handle(gzip)).cache).toBe('MISS');
    expect((await cache.handle(gzip)).cache).toBe('HIT');
    expect((await cache.handle(br)).cache).toBe('MISS');
    expect((await cache.handle(br)).cache).toBe('HIT');
    expect((await cache.handle(gzip)).cache).toBe('HIT');
    expect(origin).toHaveBeenCalledTimes(2);
  });
  it('does not store a response that varies on *', async () => {
    const { cache, origin } = setup(() => resp('public, max-age=60', { vary: '*' }));
    await cache.handle({ url: '/a' });
    expect((await cache.handle({ url: '/a' })).cache).toBe('BYPASS');
    expect(origin).toHaveBeenCalledTimes(2);
  });
  it('accepts capitalised response headers', async () => {
    const { cache } = setup(() => ({ status: 200, headers: { 'Cache-Control': 'public, S-MaxAge=60', Vary: 'X-Lang' }, body: 'b' }));
    await cache.handle({ url: '/a', headers: { 'x-lang': 'en' } });
    expect((await cache.handle({ url: '/a', headers: { 'X-Lang': 'en' } })).cache).toBe('HIT');
    expect((await cache.handle({ url: '/a', headers: { 'x-lang': 'fr' } })).cache).toBe('MISS');
  });
  it('coalesces concurrent misses into one origin call', async () => {
    const d = deferred();
    const origin = jest.fn(() => d.promise);
    const cache = createEdgeCache({ origin, now: () => 0 });
    const calls = [cache.handle({ url: '/a' }), cache.handle({ url: '/a' }), cache.handle({ url: '/a' })];
    d.resolve(resp('public, max-age=60'));
    const results = await Promise.all(calls);
    expect(results.map((r) => r.cache)).toEqual(['MISS', 'MISS', 'MISS']);
    expect(origin).toHaveBeenCalledTimes(1);
    expect((await cache.handle({ url: '/a' })).cache).toBe('HIT');
  });
  it('does not share an uncacheable response between concurrent requests', async () => {
    const bodies = ['for-alice', 'for-bob'];
    let n = 0;
    const origin = jest.fn(async () => ({ status: 200, headers: { 'cache-control': 'private' }, body: bodies[n++] }));
    const cache = createEdgeCache({ origin, now: () => 0 });
    const [a, b] = await Promise.all([cache.handle({ url: '/me' }), cache.handle({ url: '/me' })]);
    expect([a.cache, b.cache]).toEqual(['BYPASS', 'BYPASS']);
    expect([a.body, b.body].sort()).toEqual(['for-alice', 'for-bob']);
    expect(origin).toHaveBeenCalledTimes(2);
  });
  it('rejects waiters when the origin fails, stores nothing, and recovers', async () => {
    let fail = true;
    const origin = jest.fn(async () => { if (fail) throw new Error('down'); return resp('public, max-age=60'); });
    const cache = createEdgeCache({ origin, now: () => 0 });
    const results = await Promise.allSettled([cache.handle({ url: '/a' }), cache.handle({ url: '/a' })]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    fail = false;
    expect((await cache.handle({ url: '/a' })).cache).toBe('MISS');
  });
  it('purges every variant of a url', async () => {
    const { cache, origin } = setup(() => resp('public, max-age=60', { vary: 'accept-encoding' }));
    const gzip = { url: '/a', headers: { 'accept-encoding': 'gzip' } };
    const br = { url: '/a', headers: { 'accept-encoding': 'br' } };
    await cache.handle(gzip);
    await cache.handle(br);
    await cache.handle({ url: '/b' });
    cache.purge('/a');
    expect((await cache.handle(gzip)).cache).toBe('MISS');
    expect((await cache.handle(br)).cache).toBe('MISS');
    expect((await cache.handle({ url: '/b' })).cache).toBe('HIT');
    expect(origin).toHaveBeenCalledTimes(5);
  });
});
```

%% hints
- `parse(cc)`: lower-case, split on `,`; `no-store` / `private` flags; `s-maxage` regex before `max-age`.
- `lower(headers)` helper that lower-cases keys of a plain object.
- Key: `url + '\n' + vary.map((h) => h + '=' + (reqHeaders[h] ?? '')).join('\n')`.
- Leader promise resolves to `{ cacheable, response }`; followers use it only when `cacheable`.
- `purge`: loop `entries` and delete those whose stored `url` matches; delete the vary entry.

%% solution
```js
export function createEdgeCache({ origin, now }) {
  const entries = new Map();
  const varyByUrl = new Map();
  const inflight = new Map();

  const lower = (headers = {}) => {
    const out = {};
    for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = v;
    return out;
  };
  const keyFor = (url, vary, headers) => url + '\n' + vary.map((h) => h + '=' + (headers[h] ?? '')).join('\n');

  const analyse = (response) => {
    const h = lower(response.headers);
    const directives = String(h['cache-control'] ?? '').toLowerCase().split(',').map((d) => d.trim()).filter(Boolean);
    const num = (name) => {
      const found = directives.find((d) => d.startsWith(name + '='));
      return found ? Number(found.slice(name.length + 1)) : null;
    };
    const ttl = num('s-maxage') ?? num('max-age') ?? 0;
    const vary = String(h.vary ?? '').toLowerCase().split(',').map((v) => v.trim()).filter(Boolean);
    const cacheable =
      response.status === 200 &&
      !directives.includes('no-store') &&
      !directives.includes('private') &&
      ttl > 0 &&
      !vary.includes('*');
    return { cacheable, ttl, vary };
  };

  async function fromOrigin(request, url, reqHeaders) {
    const response = await origin(request);
    const info = analyse(response);
    if (info.cacheable) {
      varyByUrl.set(url, info.vary);
      entries.set(keyFor(url, info.vary, reqHeaders), { url, response, expires: now() + info.ttl * 1000 });
    }
    return { cacheable: info.cacheable, response };
  }

  return {
    async handle(request) {
      const method = (request.method ?? 'GET').toUpperCase();
      if (method !== 'GET') return { ...(await origin(request)), cache: 'BYPASS' };

      const url = request.url;
      const reqHeaders = lower(request.headers);
      const key = keyFor(url, varyByUrl.get(url) ?? [], reqHeaders);

      const entry = entries.get(key);
      if (entry && now() < entry.expires) return { ...entry.response, cache: 'HIT' };
      if (entry) entries.delete(key);

      if (inflight.has(key)) {
        const outcome = await inflight.get(key);
        if (outcome.cacheable) return { ...outcome.response, cache: 'MISS' };
        return { ...(await origin(request)), cache: 'BYPASS' };
      }

      const promise = fromOrigin(request, url, reqHeaders).finally(() => {
        if (inflight.get(key) === promise) inflight.delete(key);
      });
      inflight.set(key, promise);
      const outcome = await promise;
      return { ...outcome.response, cache: outcome.cacheable ? 'MISS' : 'BYPASS' };
    },
    purge(url) {
      for (const [key, entry] of [...entries]) {
        if (entry.url === url) entries.delete(key);
      }
      varyByUrl.delete(url);
    },
  };
}
```

%% exercise rdl-check-edge | Tests for an edge cache | 4 | js | js | checkEdgeCache | 45
`createEdgeCache({ origin, now })` returns `{ handle(request), purge(url) }` as in the edge cache exercise: a cacheable `200` response (no `private` or `no-store`, positive `s-maxage`/`max-age`, not `Vary: *`) is stored until it expires and answered as `'HIT'`; others are `'BYPASS'` and never stored; `Vary` keeps one copy per header value; concurrent requests for one key share one origin call when the result is cacheable; `purge(url)` removes every variant. You are given `checkEdgeCache(createEdgeCache)` (async). Write a check that passes for a correct cache and **fails** for one that: **stores private responses**, **ignores s-maxage**, **serves one variant to every Vary value**, **sends every concurrent request to the origin**, **stores error responses**, **never expires entries**, **leaves other variants after a purge**.

```js
let t = 0;
const origin = jest.fn(async () => ({ status: 200, headers: { 'cache-control': 'public, max-age=60' }, body: 'x' }));
const cache = createEdgeCache({ origin, now: () => t });
expect((await cache.handle({ url: '/a' })).cache).toBe('MISS');
```

%% worked
**A similar problem, solved: `checkSharedStore(createSharedStore)`** — a **scripted origin** whose behaviour you switch per scenario, with the **origin call count** as the evidence.

```js
export async function checkSharedStore(createSharedStore) {      // createSharedStore({ source, now })
  let t = 0;
  let next = { value: 'v', ttl: 60, private: false };
  const source = jest.fn(async () => next);                      // ① the origin returns whatever `next` says right now
  const store = createSharedStore({ source, now: () => t });

  await store.get('a');
  expect((await store.get('a')).from).toBe('HIT');               // ② cacheable: second call is a hit
  next = { value: 'secret', ttl: 60, private: true };
  await store.get('b');
  const before = source.mock.calls.length;
  expect((await store.get('b')).from).toBe('BYPASS');            // ③ private: never stored
  expect(source.mock.calls.length).toBe(before + 1);             // ④ ...so the origin was called again
}
```

Switch the **response headers per URL** (private on `/me`, error on `/boom`, varying on `/v`) so each rule has its own URL, and always assert the **origin call count**. For the herd, make the origin return a **promise you resolve by hand**.

%% explain
- **A scripted origin** keyed by url.
- **Origin call counts** for each rule.
- **Deferred origin** for concurrent requests.
- **Boundary times** for the TTL.

%% nudge
- Which two timestamps separate "expires at the TTL" from "never expires"?
- How do you prove that variants are purged but another url is not?

%% starter
```js
export async function checkEdgeCache(createEdgeCache) {
  let t = 0;
  const origin = jest.fn(async () => ({ status: 200, headers: { 'cache-control': 'public, max-age=60' }, body: 'x' }));
  const cache = createEdgeCache({ origin, now: () => t });
  expect((await cache.handle({ url: '/a' })).cache).toBe('MISS');
  // your assertions: hit, expiry, s-maxage, private, errors, vary, coalescing, purge
}
```

%% tests
```js
const make = (f = {}) => ({ origin, now }) => {
  const entries = new Map();
  const varyByUrl = new Map();
  const inflight = new Map();
  const lower = (h = {}) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), v]));
  const keyFor = (url, vary, headers) => url + '\n' + (f.noVary ? '' : vary.map((h) => h + '=' + (headers[h] ?? '')).join('\n'));
  const analyse = (response) => {
    const h = lower(response.headers);
    const d = String(h['cache-control'] ?? '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean);
    const num = (n) => { const found = d.find((x) => x.startsWith(n + '=')); return found ? Number(found.slice(n.length + 1)) : null; };
    const ttl = f.ignoreSMaxAge ? (num('max-age') ?? 0) : (num('s-maxage') ?? num('max-age') ?? 0);
    const vary = String(h.vary ?? '').toLowerCase().split(',').map((v) => v.trim()).filter(Boolean);
    const cacheable = (f.cacheErrors ? true : response.status === 200) && (f.cachePrivate || (!d.includes('no-store') && !d.includes('private'))) && ttl > 0 && !vary.includes('*');
    return { cacheable, ttl, vary };
  };
  async function fromOrigin(request, url, reqHeaders) {
    const response = await origin(request);
    const info = analyse(response);
    if (info.cacheable) {
      varyByUrl.set(url, info.vary);
      entries.set(keyFor(url, info.vary, reqHeaders), { url, response, expires: now() + info.ttl * 1000 });
    }
    return { cacheable: info.cacheable, response };
  }
  return {
    async handle(request) {
      if ((request.method ?? 'GET').toUpperCase() !== 'GET') return { ...(await origin(request)), cache: 'BYPASS' };
      const url = request.url;
      const reqHeaders = lower(request.headers);
      const key = keyFor(url, varyByUrl.get(url) ?? [], reqHeaders);
      const entry = entries.get(key);
      if (entry && (f.neverExpire || now() < entry.expires)) return { ...entry.response, cache: 'HIT' };
      if (entry) entries.delete(key);
      if (!f.noCoalesce && inflight.has(key)) {
        const outcome = await inflight.get(key);
        if (outcome.cacheable) return { ...outcome.response, cache: 'MISS' };
        return { ...(await origin(request)), cache: 'BYPASS' };
      }
      const promise = fromOrigin(request, url, reqHeaders).finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });
      inflight.set(key, promise);
      const outcome = await promise;
      return { ...outcome.response, cache: outcome.cacheable ? 'MISS' : 'BYPASS' };
    },
    purge(url) {
      let removed = false;
      for (const [key, entry] of [...entries]) {
        if (entry.url === url && !(f.purgeOne && removed)) { entries.delete(key); removed = true; }
      }
      varyByUrl.delete(url);
    },
  };
};

const correct = make();
const mutants = {
  'stores private responses': make({ cachePrivate: true }),
  'ignores s-maxage': make({ ignoreSMaxAge: true }),
  'serves one variant to every Vary value': make({ noVary: true }),
  'sends every concurrent request to the origin': make({ noCoalesce: true }),
  'stores error responses': make({ cacheErrors: true }),
  'never expires entries': make({ neverExpire: true }),
  'leaves other variants after a purge': make({ purgeOne: true }),
};

describe('your checkEdgeCache', () => {
  it('passes on a correct cache', async () => {
    await checkEdgeCache(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a cache that ${name}`, async () => {
      let caught = false;
      try { await checkEdgeCache(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- An origin function that looks at `req.url` and returns a different response per path (`/ok`, `/me`, `/boom`, `/vary`, `/ttl`).
- Count calls per url: `origin.mock.calls.filter(([r]) => r.url === '/ok').length`.
- `s-maxage=100, max-age=10`: still a hit at 50 s.
- Concurrent: a deferred origin for `/herd`, three `handle` calls, and check the origin count **before** resolving it (a cache that does not coalesce would otherwise leave calls hanging).
- Purge: warm two variants of `/vary`, purge, both must miss again.

%% solution
```js
export async function checkEdgeCache(createEdgeCache) {
  let t = 0;
  let release = null;
  const origin = jest.fn(async (req) => {
    const ok = (cc, extra = {}, status = 200) => ({ status, headers: { 'cache-control': cc, ...extra }, body: req.url });
    if (req.url === '/ok') return ok('public, max-age=60');
    if (req.url === '/ttl') return ok('public, max-age=10, s-maxage=100');
    if (req.url === '/me') return ok('private, max-age=60');
    if (req.url === '/boom') return ok('public, max-age=60', {}, 503);
    if (req.url === '/vary') return ok('public, max-age=60', { vary: 'Accept-Encoding' });
    if (req.url === '/herd') return new Promise((resolve) => { release = () => resolve(ok('public, max-age=60')); });
    return ok('no-store');
  });
  const cache = createEdgeCache({ origin, now: () => t });
  const count = (url) => origin.mock.calls.filter(([r]) => r.url === url).length;

  expect((await cache.handle({ url: '/ok' })).cache).toBe('MISS');
  expect((await cache.handle({ url: '/ok' })).cache).toBe('HIT');
  t = 59999;
  expect((await cache.handle({ url: '/ok' })).cache).toBe('HIT');
  t = 60000;
  expect((await cache.handle({ url: '/ok' })).cache).toBe('MISS');
  expect(count('/ok')).toBe(2);

  t = 0;
  await cache.handle({ url: '/ttl' });
  t = 50000;
  expect((await cache.handle({ url: '/ttl' })).cache).toBe('HIT');

  await cache.handle({ url: '/me' });
  expect((await cache.handle({ url: '/me' })).cache).toBe('BYPASS');
  expect(count('/me')).toBe(2);

  await cache.handle({ url: '/boom' });
  await cache.handle({ url: '/boom' });
  expect(count('/boom')).toBe(2);

  const gzip = { url: '/vary', headers: { 'accept-encoding': 'gzip' } };
  const br = { url: '/vary', headers: { 'accept-encoding': 'br' } };
  await cache.handle(gzip);
  expect((await cache.handle(br)).cache).toBe('MISS');
  expect((await cache.handle(gzip)).cache).toBe('HIT');
  cache.purge('/vary');
  expect((await cache.handle(gzip)).cache).toBe('MISS');
  expect((await cache.handle(br)).cache).toBe('MISS');

  const herd = [cache.handle({ url: '/herd' }), cache.handle({ url: '/herd' }), cache.handle({ url: '/herd' })];
  await Promise.resolve();
  expect(count('/herd')).toBe(1);
  release();
  await Promise.all(herd);
  expect(count('/herd')).toBe(1);
}
```
