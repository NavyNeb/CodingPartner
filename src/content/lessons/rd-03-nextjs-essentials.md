---
id: rd-nextjs-essentials
track: rd
title: Next.js essentials: routing, rendering mode and caching
summary: File-system routing with nested layouts and boundaries, how a route ends up static, ISR or dynamic, and the layered caches (request memoization, the data cache with tags, the full route cache, the router cache) that explain most stale-data bugs.
---

## The idea in one sentence

Next.js is a **convention layer**: the **folders** you create decide the **URLs**, the **APIs you call** decide whether a page is **static or dynamic**, and a stack of **caches** decides how fresh the result is.

> **Analogy** A mail-sorting office. The **address on the envelope** (folder path) decides which route it takes, the **contents** (cookies, headers, no-store fetches) decide whether it can go in the pre-sorted bag or needs hand delivery, and **several shelves** along the way each keep a copy.

*(This lesson is framework-neutral: you build the routing table, the rendering-mode inference and a tagged data cache. Each exercise says what Next.js calls it.)*

## File-system routing

![App Router conventions](fig:rd-approuter "Folders are URL segments; special files wrap the pages below them.")

| Convention | Meaning |
| --- | --- |
| `app/blog/page.js` | the page for `/blog` |
| `app/blog/[slug]/page.js` | a **dynamic segment**: `/blog/:slug` |
| `app/docs/[...path]/page.js` | a **catch-all**: `/docs/*` |
| `app/(shop)/cart/page.js` | a **route group**: folder organises files, URL is `/cart` |
| `layout.js` | wraps everything below, **nested outside in**, and **persists** between navigations |
| `loading.js` | the Suspense fallback for the segment below it |
| `error.js` | the error boundary for the segment below it |
| `not-found.js` | the 404 UI for the segment below it |

Two things interviewers like: **layouts do not re-render** when you navigate between their children (state survives), and **boundaries are inherited from the nearest ancestor** that defines one.

## What makes a route static, ISR or dynamic

![Dynamic or static](fig:rd-dynamic "One dynamic API anywhere makes the whole route dynamic.")

Next.js does not ask you to declare a strategy; it **infers** it from what the route uses:

- reading **cookies**, **headers** or **search params** makes it **dynamic** (the answer depends on the request);
- a `fetch` with **no caching** (`no-store`, `revalidate: 0`) makes it dynamic;
- a **positive `revalidate`** (on a fetch or the segment) makes it **ISR**: static, refreshed on that interval (the **smallest** one wins);
- none of these: **fully static**, built once.

`force-static` and `force-dynamic` override the inference.

```js try predict
const mode = ({ cookies, revalidate }) =>
  cookies ? 'dynamic' : revalidate ? 'ISR every ' + revalidate + 's' : 'static';

console.log(mode({}), '|', mode({ revalidate: 60 }), '|', mode({ cookies: true, revalidate: 60 }));
```

## The caches

![Cache layers](fig:rd-caches "Stale data is usually a 'which cache?' question.")

```stepper One request through four caches
code:
  render:  getUser() called in Header AND Page   → one network call
  render:  fetch('/api/posts', { revalidate: 60 })  → stored for 60 s
  build:   whole route rendered once              → HTML kept on the CDN
  browser: <Link> to a visited page               → instant, from memory
---
line: 1
say: **Request memoization**: two components asking for the same data in **one render** share a single fetch, so you can fetch where you need the data instead of drilling props.
phase: per render
---
line: 2
say: The **data cache** keeps the response **across requests**. It expires after `revalidate` seconds, or immediately when you call `revalidateTag('posts')` after an edit.
phase: across requests
---
line: 3
say: The **full route cache** stores the **rendered output** of a static route, so serving it costs no rendering at all. It is rebuilt when its data is revalidated.
phase: static output
---
line: 4
say: The **router cache** lives in the browser: pages you already visited appear instantly when you navigate back, until they expire or you call `router.refresh()`.
phase: in the browser
```

Cache keys and invalidation are where the bugs live. Three questions to ask when data looks stale: **which layer** is serving it, **what expires it** (time or tag), and **who invalidates it** when the source changes?

## Quick check

```check
Q: A page calls cookies() inside a deeply nested component. What happens to the route?
A) Nothing; cookies are read in the browser
B) The whole route becomes dynamic *
C) Only that component re-renders
D) The route becomes ISR
Why: Reading request data makes the output depend on the request, so it cannot be prebuilt.
---
Q: Two fetches in one route set revalidate: 60 and revalidate: 300. How often does the page refresh?
A) Every 300 s
B) Every 60 s *
C) Every 360 s
D) Never
Why: The smallest revalidate time wins, or the page would serve data older than a source allows.
---
Q: What does revalidateTag('posts') do?
A) Reloads the browser
B) Removes cached fetch results tagged 'posts' so they are fetched again *
C) Rebuilds the whole site
D) Clears cookies
Why: Tags let an edit invalidate exactly the data it affected.
---
Q: A page in app/(shop)/cart/page.js has which URL?
A) /(shop)/cart
B) /cart *
C) /shop/cart
D) /app/cart
Why: Parenthesised folders are groups; they never appear in the URL.
```

## Recap

- **Folders are routes**: `[slug]` dynamic, `[...path]` catch-all, `(group)` invisible; `layout`, `loading`, `error`, `not-found` wrap what is **below** them.
- A route is **dynamic** (cookies, headers, search params, no-store, `revalidate = 0`), **ISR** (smallest positive `revalidate`) or **static**; `force-*` overrides.
- Four caches: **request memoization**, **data cache** (time and tags), **full route cache**, **router cache**.
- Stale data: ask **which layer**, **what expires it**, **who invalidates it**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: file to route | Splitting a path, filtering and mapping segments |
| A route table | Prefix matching, nearest-ancestor lookup, conflict detection |
| Infer the rendering mode | A short chain of rules and a `min` over several sources |
| A data cache with tags | TTL entries, in-flight sharing, tag invalidation |
| Tests for a data cache | A fake clock, a fetch spy, boundaries and tag scenarios |

%% exercise rdl-guided-route | Guided: file to route | 2 | js | js | fileToRoute | 10 | guided
Implement `fileToRoute(file)` for App Router file paths:

- It returns `null` unless the file starts with `app/` and ends with `/page.js`, `/page.jsx`, `/page.ts` or `/page.tsx`.
- Take the folders between `app` and the page file as segments. **Drop** group folders written `(name)`. Turn `[name]` into `:name` and `[...name]` into `*`.
- Join with `/` and start with `/`; no segments gives `'/'`.

```js
fileToRoute('app/blog/[slug]/page.js');   // '/blog/:slug'
fileToRoute('app/(shop)/cart/page.tsx');  // '/cart'
fileToRoute('app/page.js');               // '/'
```

%% worked
**A similar problem, solved: `fileToCommand(file)`** — filter a path, then map each segment by its shape.

```js
function fileToCommand(file) {
  if (!file.startsWith('cmds/') || !file.endsWith('/run.js')) return null;     // ① only files that match the convention
  const parts = file.slice('cmds/'.length, -'/run.js'.length).split('/').filter(Boolean);
  return parts
    .filter((p) => !/^_/.test(p))                                              // ② drop "private" segments
    .map((p) => (/^<.+>$/.test(p) ? '{' + p.slice(1, -1) + '}' : p))           // ③ rewrite parameter-looking segments
    .join(' ');
}
```

Same three moves for routes: **recognise** the convention, **drop** the invisible segments, **rewrite** the special ones. Check `[...name]` **before** `[name]` since both start with `[`.

%% explain
- **Match** the convention first; return `null` otherwise.
- **Filter** groups, **map** dynamic and catch-all segments.
- **Join** and prepend `/`.

%% nudge
- Which of `[...x]` and `[x]` do you test first?
- What is the route for a page directly in `app`?

%% starter
```js
export function fileToRoute(file) {
  return null;
}
```

%% tests
```js
describe('fileToRoute', () => {
  it('maps the root page', () => {
    expect(fileToRoute('app/page.js')).toBe('/');
  });
  it('maps nested static folders', () => {
    expect(fileToRoute('app/blog/page.js')).toBe('/blog');
    expect(fileToRoute('app/a/b/c/page.tsx')).toBe('/a/b/c');
  });
  it('maps dynamic and catch-all segments', () => {
    expect(fileToRoute('app/blog/[slug]/page.js')).toBe('/blog/:slug');
    expect(fileToRoute('app/docs/[...path]/page.jsx')).toBe('/docs/*');
    expect(fileToRoute('app/u/[id]/posts/[postId]/page.ts')).toBe('/u/:id/posts/:postId');
  });
  it('drops route groups', () => {
    expect(fileToRoute('app/(shop)/cart/page.js')).toBe('/cart');
    expect(fileToRoute('app/(a)/(b)/page.js')).toBe('/');
  });
  it('returns null for other files', () => {
    expect(fileToRoute('app/blog/layout.js')).toBeNull();
    expect(fileToRoute('app/blog/page.css')).toBeNull();
    expect(fileToRoute('pages/index.js')).toBeNull();
    expect(fileToRoute('app/blog/mypage.js')).toBeNull();
  });
});
```

%% hints
- `/^app\/(?:(.*)\/)?page\.(js|jsx|ts|tsx)$/` captures the folder part.
- `seg.startsWith('[...')` before `seg.startsWith('[')`.

%% solution
```js
export function fileToRoute(file) {
  const match = /^app\/(?:(.*)\/)?page\.(?:js|jsx|ts|tsx)$/.exec(file);
  if (!match) return null;
  const segments = (match[1] ?? '')
    .split('/')
    .filter(Boolean)
    .filter((seg) => !/^\(.*\)$/.test(seg))
    .map((seg) => {
      if (/^\[\.\.\..+\]$/.test(seg)) return '*';
      if (/^\[.+\]$/.test(seg)) return ':' + seg.slice(1, -1);
      return seg;
    });
  return '/' + segments.join('/');
}
```

%% exercise rdl-route-table | A route table with layouts and boundaries | 4 | js | js | buildRouteTable | 40
`buildRouteTable(files)` takes a list of file paths under `app/` and returns one entry per page, sorted by `route` (plain string order):

```js
{ route, page, layouts, loading, error, notFound }
```

- A **page** is `page.<ext>` (`js`, `jsx`, `ts`, `tsx`); its `route` is built as in the guided exercise (groups dropped, `[x]` → `:x`, `[...x]` → `*`).
- `layouts` lists the `layout.<ext>` files in the page's folder and **every ancestor folder** (including the root `app` and group folders), ordered **outermost first**.
- `loading`, `error` and `notFound` are the **nearest** `loading.*`, `error.*` and `not-found.*` file in the page's own folder or the closest ancestor, or `null`.
- Two pages that produce the **same route** throw `Error('conflicting routes: ' + route)`.
- Files that are none of these (stylesheets, components) are ignored.

```js
buildRouteTable(['app/layout.js', 'app/blog/layout.js', 'app/blog/[slug]/page.js']);
// [{ route: '/blog/:slug', page: 'app/blog/[slug]/page.js', layouts: ['app/layout.js', 'app/blog/layout.js'], loading: null, error: null, notFound: null }]
```

%% worked
**A similar problem, solved: `inheritSettings(files)`** — for each file, walk its **ancestor folders** and take the **nearest** match.

```js
function nearestConfig(file, configs) {                      // configs: { 'app': {...}, 'app/blog': {...} }
  const parts = file.split('/').slice(0, -1);                // ① the folders above the file
  for (let n = parts.length; n >= 1; n--) {                  // ② from the deepest folder up to the root
    const dir = parts.slice(0, n).join('/');
    if (dir in configs) return configs[dir];                 // ③ the first hit is the nearest
  }
  return null;
}
```

Collect **special files by folder** once (`dir → file`), then for every page ask "which special file is nearest?" and "which layouts are on the path?". The layout list is the **same walk**, but it keeps **every** hit, outer first.

%% explain
- **Index** special files by `dir` and `kind`.
- **For each page**: walk ancestors for layouts (all) and boundaries (nearest).
- **Detect conflicts** with a `Set` of routes.

%% nudge
- How do you get the ancestor folders of a page, from the root down?
- Which direction do you walk to find the *nearest* boundary?

%% starter
```js
export function buildRouteTable(files) {
  return [];
}
```

%% tests
```js
describe('buildRouteTable', () => {
  it('builds an entry per page, sorted by route', () => {
    const table = buildRouteTable(['app/page.js', 'app/blog/page.js', 'app/about/page.js']);
    expect(table.map((t) => t.route)).toEqual(['/', '/about', '/blog']);
    expect(table[0].page).toBe('app/page.js');
  });
  it('collects layouts outermost first, including the root and ancestors only', () => {
    const table = buildRouteTable([
      'app/layout.js', 'app/blog/layout.tsx', 'app/blog/[slug]/page.js', 'app/blog/[slug]/layout.js', 'app/shop/layout.js',
    ]);
    expect(table).toHaveLength(1);
    expect(table[0].route).toBe('/blog/:slug');
    expect(table[0].layouts).toEqual(['app/layout.js', 'app/blog/layout.tsx', 'app/blog/[slug]/layout.js']);
  });
  it('includes layouts of route groups', () => {
    const table = buildRouteTable(['app/(shop)/layout.js', 'app/(shop)/cart/page.js', 'app/layout.js']);
    expect(table[0].route).toBe('/cart');
    expect(table[0].layouts).toEqual(['app/layout.js', 'app/(shop)/layout.js']);
  });
  it('finds the nearest loading, error and not-found files', () => {
    const table = buildRouteTable([
      'app/loading.js', 'app/error.js', 'app/not-found.js',
      'app/blog/loading.js', 'app/blog/[slug]/error.js',
      'app/blog/[slug]/page.js', 'app/page.js',
    ]);
    const post = table.find((t) => t.route === '/blog/:slug');
    expect(post.loading).toBe('app/blog/loading.js');
    expect(post.error).toBe('app/blog/[slug]/error.js');
    expect(post.notFound).toBe('app/not-found.js');
    const home = table.find((t) => t.route === '/');
    expect(home).toMatchObject({ loading: 'app/loading.js', error: 'app/error.js', notFound: 'app/not-found.js' });
  });
  it('returns null for boundaries that do not exist', () => {
    const table = buildRouteTable(['app/page.js']);
    expect(table[0]).toEqual({ route: '/', page: 'app/page.js', layouts: [], loading: null, error: null, notFound: null });
  });
  it('ignores files that are not special', () => {
    const table = buildRouteTable(['app/page.js', 'app/globals.css', 'app/components/Button.js', 'app/blog/route.js']);
    expect(table).toHaveLength(1);
  });
  it('does not treat a deeper layout as an ancestor of a shallower page', () => {
    const table = buildRouteTable(['app/page.js', 'app/blog/layout.js']);
    expect(table[0].layouts).toEqual([]);
  });
  it('turns dynamic and catch-all folders into route params', () => {
    const table = buildRouteTable(['app/docs/[...path]/page.js', 'app/u/[id]/page.js']);
    expect(table.map((t) => t.route)).toEqual(['/docs/*', '/u/:id']);
  });
  it('rejects two pages with the same route', () => {
    expect(() => buildRouteTable(['app/(a)/about/page.js', 'app/(b)/about/page.js'])).toThrow('conflicting routes: /about');
  });
});
```

%% hints
- Parse each file into `{ dirParts, name }` where `name` is the basename without extension.
- `special[kind]` map: `dirKey → file`, with `dirKey = dirParts.join('/')`.
- Walk `n` from `dirParts.length` down to `1` for the nearest; from `1` up for layouts.
- `routes.has(route)` before adding.

%% solution
```js
export function buildRouteTable(files) {
  const KINDS = new Set(['page', 'layout', 'loading', 'error', 'not-found']);
  const special = { page: new Map(), layout: new Map(), loading: new Map(), error: new Map(), 'not-found': new Map() };

  for (const file of files) {
    if (!file.startsWith('app/')) continue;
    const parts = file.split('/');
    const base = parts[parts.length - 1];
    const match = /^(page|layout|loading|error|not-found)\.(?:js|jsx|ts|tsx)$/.exec(base);
    if (!match || !KINDS.has(match[1])) continue;
    special[match[1]].set(parts.slice(0, -1).join('/'), file);
  }

  const toSegment = (seg) => {
    if (/^\(.*\)$/.test(seg)) return null;
    if (/^\[\.\.\..+\]$/.test(seg)) return '*';
    if (/^\[.+\]$/.test(seg)) return ':' + seg.slice(1, -1);
    return seg;
  };

  const seen = new Set();
  const table = [];
  for (const [dir, page] of special.page) {
    const parts = dir.split('/');
    const route = '/' + parts.slice(1).map(toSegment).filter((s) => s !== null).join('/');
    if (seen.has(route)) throw new Error('conflicting routes: ' + route);
    seen.add(route);

    const layouts = [];
    for (let n = 1; n <= parts.length; n++) {
      const layout = special.layout.get(parts.slice(0, n).join('/'));
      if (layout) layouts.push(layout);
    }
    const nearest = (kind) => {
      for (let n = parts.length; n >= 1; n--) {
        const found = special[kind].get(parts.slice(0, n).join('/'));
        if (found) return found;
      }
      return null;
    };
    table.push({ route, page, layouts, loading: nearest('loading'), error: nearest('error'), notFound: nearest('not-found') });
  }
  return table.sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
}
```

%% exercise rdl-render-mode | Infer the rendering mode | 3 | js | js | inferRenderMode | 28
`inferRenderMode(route)` takes `{ dynamic, usesCookies, usesHeaders, usesSearchParams, revalidate, fetches }` (everything optional; `fetches` is a list of `{ revalidate }`, default `[]`) and returns `{ mode, reason }` (plus `revalidate` for ISR):

1. `dynamic === 'force-dynamic'` → `{ mode: 'dynamic', reason: 'force-dynamic' }`.
2. Unless `dynamic === 'force-static'`, check these **in order** and return `{ mode: 'dynamic', reason }` for the first that applies: `usesCookies` → `'cookies'`; `usesHeaders` → `'headers'`; `usesSearchParams` → `'searchParams'`; any fetch with `revalidate === 0` → `'no-store fetch'`; the segment `revalidate === 0` → `'revalidate = 0'`.
3. Collect every **positive** number among the segment `revalidate` and the fetches' `revalidate`. If there is any: `{ mode: 'isr', revalidate: <the smallest>, reason: 'revalidate' }`.
4. Otherwise `{ mode: 'static', reason: 'no dynamic APIs' }`.

```js
inferRenderMode({ fetches: [{ revalidate: 300 }, { revalidate: 60 }] });
// { mode: 'isr', revalidate: 60, reason: 'revalidate' }
```

%% worked
**A similar problem, solved: `inferCaching(req)`** — an ordered list of **reasons**, first match wins, then a computed value.

```js
function inferCaching({ cookie, noStore, maxAges = [] }) {
  if (cookie) return { cacheable: false, reason: 'cookie' };            // ① specific reasons first, in a fixed order
  if (noStore) return { cacheable: false, reason: 'no-store' };
  const positive = maxAges.filter((n) => n > 0);                        // ② then a value derived from several sources
  if (positive.length) return { cacheable: true, ttl: Math.min(...positive) };   // ③ the strictest (smallest) wins
  return { cacheable: true, ttl: Infinity };
}
```

`Math.min(...[])` is `Infinity`, so **check the list is non-empty** before using it. The ordering is the spec: `force-dynamic` is checked before everything, and `force-static` only switches off the **dynamic triggers**, not the revalidate calculation.

%% explain
- **Early returns** for each dynamic reason, in the stated order.
- **`force-static`** skips step 2 only.
- **Smallest positive revalidate** across segment and fetches.

%% nudge
- What does `force-static` skip, and what does it not skip?
- Why must a `revalidate` of `0` not count as "positive"?

%% starter
```js
export function inferRenderMode(route) {
  return { mode: 'static', reason: 'no dynamic APIs' };
}
```

%% tests
```js
describe('inferRenderMode', () => {
  it('is static with nothing special', () => {
    expect(inferRenderMode({})).toEqual({ mode: 'static', reason: 'no dynamic APIs' });
    expect(inferRenderMode({ fetches: [{}, { revalidate: false }] })).toEqual({ mode: 'static', reason: 'no dynamic APIs' });
  });
  it('is dynamic when request data is read', () => {
    expect(inferRenderMode({ usesCookies: true })).toEqual({ mode: 'dynamic', reason: 'cookies' });
    expect(inferRenderMode({ usesHeaders: true })).toEqual({ mode: 'dynamic', reason: 'headers' });
    expect(inferRenderMode({ usesSearchParams: true })).toEqual({ mode: 'dynamic', reason: 'searchParams' });
  });
  it('reports the first reason in the documented order', () => {
    expect(inferRenderMode({ usesSearchParams: true, usesHeaders: true, usesCookies: true }).reason).toBe('cookies');
    expect(inferRenderMode({ usesSearchParams: true, usesHeaders: true }).reason).toBe('headers');
    expect(inferRenderMode({ usesSearchParams: true, fetches: [{ revalidate: 0 }] }).reason).toBe('searchParams');
  });
  it('is dynamic for a no-store fetch or revalidate 0', () => {
    expect(inferRenderMode({ fetches: [{ revalidate: 60 }, { revalidate: 0 }] })).toEqual({ mode: 'dynamic', reason: 'no-store fetch' });
    expect(inferRenderMode({ revalidate: 0 })).toEqual({ mode: 'dynamic', reason: 'revalidate = 0' });
    expect(inferRenderMode({ revalidate: 0, fetches: [{ revalidate: 0 }] }).reason).toBe('no-store fetch');
  });
  it('is ISR with the smallest positive revalidate', () => {
    expect(inferRenderMode({ fetches: [{ revalidate: 300 }, { revalidate: 60 }] })).toEqual({ mode: 'isr', revalidate: 60, reason: 'revalidate' });
    expect(inferRenderMode({ revalidate: 3600, fetches: [{ revalidate: 600 }, {}] })).toEqual({ mode: 'isr', revalidate: 600, reason: 'revalidate' });
    expect(inferRenderMode({ revalidate: 30 }).revalidate).toBe(30);
  });
  it('lets a dynamic reason beat a revalidate time', () => {
    expect(inferRenderMode({ usesCookies: true, revalidate: 60 }).mode).toBe('dynamic');
  });
  it('honours force-dynamic first', () => {
    expect(inferRenderMode({ dynamic: 'force-dynamic', revalidate: 60 })).toEqual({ mode: 'dynamic', reason: 'force-dynamic' });
    expect(inferRenderMode({ dynamic: 'force-dynamic' }).mode).toBe('dynamic');
  });
  it('lets force-static switch off the dynamic triggers but keep revalidate', () => {
    expect(inferRenderMode({ dynamic: 'force-static', usesCookies: true, usesHeaders: true })).toEqual({ mode: 'static', reason: 'no dynamic APIs' });
    expect(inferRenderMode({ dynamic: 'force-static', usesCookies: true, revalidate: 120 })).toEqual({ mode: 'isr', revalidate: 120, reason: 'revalidate' });
    expect(inferRenderMode({ dynamic: 'force-static', fetches: [{ revalidate: 0 }] }).mode).toBe('static');
  });
  it('ignores negative and non-numeric revalidate values', () => {
    expect(inferRenderMode({ revalidate: -5, fetches: [{ revalidate: false }, { revalidate: undefined }] }).mode).toBe('static');
  });
});
```

%% hints
- `if (route.dynamic === 'force-dynamic') return ...;`
- `if (route.dynamic !== 'force-static') { ... the ordered checks ... }`
- `const candidates = [route.revalidate, ...fetches.map((f) => f.revalidate)].filter((n) => typeof n === 'number' && n > 0);`

%% solution
```js
export function inferRenderMode(route) {
  const { dynamic, usesCookies, usesHeaders, usesSearchParams, revalidate, fetches = [] } = route;
  if (dynamic === 'force-dynamic') return { mode: 'dynamic', reason: 'force-dynamic' };

  if (dynamic !== 'force-static') {
    if (usesCookies) return { mode: 'dynamic', reason: 'cookies' };
    if (usesHeaders) return { mode: 'dynamic', reason: 'headers' };
    if (usesSearchParams) return { mode: 'dynamic', reason: 'searchParams' };
    if (fetches.some((f) => f.revalidate === 0)) return { mode: 'dynamic', reason: 'no-store fetch' };
    if (revalidate === 0) return { mode: 'dynamic', reason: 'revalidate = 0' };
  }

  const positive = [revalidate, ...fetches.map((f) => f.revalidate)].filter((n) => typeof n === 'number' && n > 0);
  if (positive.length > 0) return { mode: 'isr', revalidate: Math.min(...positive), reason: 'revalidate' };
  return { mode: 'static', reason: 'no dynamic APIs' };
}
```

%% exercise rdl-data-cache | A data cache with tags | 4 | js | js | createDataCache | 42
`createDataCache({ fetcher, now })` returns `{ get(url, options), revalidateTag(tag) }`, the data cache behind `fetch`.

`get(url, { revalidate = false, tags = [] } = {})` (async) resolves the data for `url`:

- A cached entry for the url is **fresh** while `now() - storedAt < ttl`. `revalidate: false` (the default) means **cache until invalidated** (`ttl = Infinity`); a positive number means `ttl = revalidate * 1000` ms; `0` means **do not cache**. The entry keeps the **options it was stored with**.
- A fresh entry is returned without calling `fetcher`. An expired entry is removed and fetched again (blocking).
- **Request memoization**: concurrent `get`s for the same url share **one** `fetcher(url)` call (even for `revalidate: 0`), and the in-flight call is forgotten when it settles.
- A successful fetch is stored unless `revalidate === 0`. A failed fetch rejects and stores nothing.
- `revalidateTag(tag)` removes every cached entry whose `tags` include `tag` (other entries stay).

```js
const cache = createDataCache({ fetcher: (url) => fetch(url).then((r) => r.json()), now: () => Date.now() });
await cache.get('/api/posts', { revalidate: 60, tags: ['posts'] });
cache.revalidateTag('posts'); // the next get refetches
```

%% worked
**A similar problem, solved: `createMemoStore({ compute, now })`** — entries with an expiry, plus a **single-flight** map for concurrent callers.

```js
function createMemoStore({ compute, now }) {
  const stored = new Map();                                   // key -> { value, expires }
  const inflight = new Map();                                 // key -> promise
  return {
    async get(key, ttlMs) {
      const hit = stored.get(key);
      if (hit && now() < hit.expires) return hit.value;       // ① fresh: no work
      stored.delete(key);                                     // ② expired entries go away
      if (inflight.has(key)) return inflight.get(key);        // ③ someone is already computing: join them
      const p = new Promise((r) => r(compute(key)))
        .then((value) => { stored.set(key, { value, expires: now() + ttlMs }); return value; })
        .finally(() => inflight.delete(key));                 // ④ always clear the in-flight marker
      inflight.set(key, p);
      return p;
    },
  };
}
```

Your cache adds **per-entry options** (infinite or per-url TTL, none for `0`) and a **tag index** for `revalidateTag`.

%% explain
- **`entries`** (url → `{ data, storedAt, ttl, tags }`) and **`inflight`**.
- **Store** only when `revalidate !== 0`.
- **`revalidateTag`** loops entries and deletes those with the tag.

%% nudge
- Why does `revalidate: 0` still share an in-flight request?
- What `ttl` represents "never expires"?

%% starter
```js
export function createDataCache({ fetcher, now }) {
  return {
    async get(url, options = {}) {
      return fetcher(url);
    },
    revalidateTag(tag) {},
  };
}
```

%% tests
```js
describe('createDataCache', () => {
  const setup = () => {
    let t = 0;
    let n = 0;
    const fetcher = jest.fn(async (url) => url + '#' + ++n);
    const cache = createDataCache({ fetcher, now: () => t });
    return { cache, fetcher, at: (x) => { t = x; } };
  };
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };

  it('caches forever by default', async () => {
    const { cache, fetcher, at } = setup();
    expect(await cache.get('/a')).toBe('/a#1');
    at(10 ** 9);
    expect(await cache.get('/a')).toBe('/a#1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('expires after revalidate seconds, exactly', async () => {
    const { cache, fetcher, at } = setup();
    await cache.get('/a', { revalidate: 10 });
    at(9999);
    expect(await cache.get('/a', { revalidate: 10 })).toBe('/a#1');
    at(10000);
    expect(await cache.get('/a', { revalidate: 10 })).toBe('/a#2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('starts a new window when an expired entry is refetched', async () => {
    const { cache, fetcher, at } = setup();
    await cache.get('/a', { revalidate: 10 });
    at(10000);
    await cache.get('/a', { revalidate: 10 });
    at(19999);
    await cache.get('/a', { revalidate: 10 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not cache revalidate 0', async () => {
    const { cache, fetcher } = setup();
    await cache.get('/a', { revalidate: 0 });
    await cache.get('/a', { revalidate: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('shares one fetch between concurrent calls, even for revalidate 0', async () => {
    const d = deferred();
    const fetcher = jest.fn(() => d.promise);
    const cache = createDataCache({ fetcher, now: () => 0 });
    const a = cache.get('/a', { revalidate: 0 });
    const b = cache.get('/a', { revalidate: 0 });
    d.resolve('x');
    expect(await a).toBe('x');
    expect(await b).toBe('x');
    expect(fetcher).toHaveBeenCalledTimes(1);
    await cache.get('/a', { revalidate: 0 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects a failed fetch, caches nothing and clears the in-flight call', async () => {
    let fail = true;
    const fetcher = jest.fn(async () => { if (fail) throw new Error('down'); return 'ok'; });
    const cache = createDataCache({ fetcher, now: () => 0 });
    await expect(cache.get('/a')).rejects.toThrow('down');
    fail = false;
    expect(await cache.get('/a')).toBe('ok');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('keeps urls independent', async () => {
    const { cache, fetcher } = setup();
    await cache.get('/a');
    await cache.get('/b');
    await cache.get('/a');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('revalidates entries by tag and leaves the others', async () => {
    const { cache, fetcher } = setup();
    await cache.get('/a', { tags: ['posts'] });
    await cache.get('/b', { tags: ['posts', 'home'] });
    await cache.get('/c', { tags: ['other'] });
    await cache.get('/d');
    cache.revalidateTag('posts');
    await cache.get('/a');
    await cache.get('/b');
    await cache.get('/c');
    await cache.get('/d');
    expect(fetcher.mock.calls.map((c) => c[0])).toEqual(['/a', '/b', '/c', '/d', '/a', '/b']);
  });
  it('ignores an unknown tag', async () => {
    const { cache, fetcher } = setup();
    await cache.get('/a', { tags: ['x'] });
    cache.revalidateTag('nope');
    await cache.get('/a');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('keeps the options an entry was stored with', async () => {
    const { cache, fetcher, at } = setup();
    await cache.get('/a', { revalidate: 10, tags: ['t'] });
    at(5000);
    expect(await cache.get('/a')).toBe('/a#1');
    cache.revalidateTag('t');
    await cache.get('/a');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
```

%% hints
- `ttl = revalidate === false ? Infinity : revalidate * 1000`.
- Check `entry && now() - entry.storedAt < entry.ttl` before anything else.
- Share in-flight with a `Map` of promises; remove in `.finally`.
- `revalidateTag`: `for (const [url, e] of [...entries]) if (e.tags.includes(tag)) entries.delete(url);`

%% solution
```js
export function createDataCache({ fetcher, now }) {
  const entries = new Map();
  const inflight = new Map();

  return {
    async get(url, { revalidate = false, tags = [] } = {}) {
      const entry = entries.get(url);
      if (entry && now() - entry.storedAt < entry.ttl) return entry.data;
      if (entry) entries.delete(url);
      if (inflight.has(url)) return inflight.get(url);

      const promise = new Promise((resolve) => resolve(fetcher(url)))
        .then((data) => {
          if (revalidate !== 0) {
            const ttl = revalidate === false ? Infinity : revalidate * 1000;
            entries.set(url, { data, storedAt: now(), ttl, tags });
          }
          return data;
        })
        .finally(() => {
          if (inflight.get(url) === promise) inflight.delete(url);
        });
      inflight.set(url, promise);
      return promise;
    },
    revalidateTag(tag) {
      for (const [url, entry] of [...entries]) {
        if (entry.tags.includes(tag)) entries.delete(url);
      }
    },
  };
}
```

%% exercise rdl-check-data-cache | Tests for a data cache | 4 | js | js | checkDataCache | 38
`createDataCache({ fetcher, now })` returns `{ get(url, { revalidate, tags }), revalidateTag(tag) }` as in the data cache exercise: default `revalidate: false` caches until invalidated; a positive `revalidate` expires after that many seconds (exactly at the boundary); `0` is never stored; concurrent calls for a url share one fetch; `revalidateTag` removes only the entries carrying that tag. You are given `checkDataCache(createDataCache)` (async). Write a check that passes for a correct cache and **fails** for one that: **fetches every time**, **caches no-store results**, **ignores the revalidate time**, **expires one tick late**, **does not share concurrent fetches**, **revalidateTag does nothing**, **revalidateTag clears everything**.

```js
let t = 0;
const fetcher = jest.fn(async (url) => url);
const cache = createDataCache({ fetcher, now: () => t });
await cache.get('/a');
await cache.get('/a');
expect(fetcher).toHaveBeenCalledTimes(1);
```

%% worked
**A similar problem, solved: `checkMemoStore(createMemoStore)`** — a **spy** plus a **fake clock**, one scenario per rule, always asserting on the **fetch count**.

```js
export async function checkMemoStore(createMemoStore) {          // createMemoStore({ compute, now })
  let t = 0;
  const compute = jest.fn(async (k) => k);
  const store = createMemoStore({ compute, now: () => t });
  await store.get('a', 1000);
  await store.get('a', 1000);
  expect(compute).toHaveBeenCalledTimes(1);                      // ① caching works
  t = 999;
  await store.get('a', 1000);
  expect(compute).toHaveBeenCalledTimes(1);                      // ② one tick before expiry
  t = 1000;
  await store.get('a', 1000);
  expect(compute).toHaveBeenCalledTimes(2);                      // ③ exactly at expiry
}
```

For tags add two entries with the **same** tag and one with a **different** or **no** tag; after invalidating, the first two must be **refetched** and the rest **not**. That separates "does nothing" from "clears everything".

%% explain
- **One scenario per rule**, each ending in a call count.
- **Boundary times** around the revalidate window.
- **Concurrent calls** with `Promise.all`.
- **Tag scenario** with tagged and untagged entries.

%% nudge
- Which two timestamps separate "expires at the boundary" from "one tick late"?
- How do you prove untagged entries survive `revalidateTag`?

%% starter
```js
export async function checkDataCache(createDataCache) {
  let t = 0;
  const fetcher = jest.fn(async (url) => url);
  const cache = createDataCache({ fetcher, now: () => t });
  await cache.get('/a');
  expect(fetcher).toHaveBeenCalledTimes(1);
  // your assertions: caching, boundary, no-store, concurrency, tags
}
```

%% tests
```js
const make = (f = {}) => ({ fetcher, now }) => {
  const entries = new Map();
  const inflight = new Map();
  return {
    async get(url, { revalidate = false, tags = [] } = {}) {
      const entry = f.noCache ? undefined : entries.get(url);
      const ttl = entry ? (f.ignoreTtl ? Infinity : entry.ttl) : 0;
      const age = entry ? now() - entry.storedAt : 0;
      if (entry && (f.late ? age <= ttl : age < ttl)) return entry.data;
      if (entry) entries.delete(url);
      if (!f.noShare && inflight.has(url)) return inflight.get(url);
      const promise = new Promise((resolve) => resolve(fetcher(url)))
        .then((data) => {
          if (revalidate !== 0 || f.cacheNoStore) {
            entries.set(url, { data, storedAt: now(), ttl: revalidate === false || revalidate === 0 && f.cacheNoStore ? Infinity : revalidate * 1000, tags });
          }
          return data;
        })
        .finally(() => { if (inflight.get(url) === promise) inflight.delete(url); });
      inflight.set(url, promise);
      return promise;
    },
    revalidateTag(tag) {
      if (f.tagNoop) return;
      for (const [url, entry] of [...entries]) {
        if (f.tagAll || entry.tags.includes(tag)) entries.delete(url);
      }
    },
  };
};

const correct = make();
const mutants = {
  'fetches every time': make({ noCache: true }),
  'caches no-store results': make({ cacheNoStore: true }),
  'ignores the revalidate time': make({ ignoreTtl: true }),
  'expires one tick late': make({ late: true }),
  'does not share concurrent fetches': make({ noShare: true }),
  'revalidateTag does nothing': make({ tagNoop: true }),
  'revalidateTag clears everything': make({ tagAll: true }),
};

describe('your checkDataCache', () => {
  it('passes on a correct cache', async () => {
    await checkDataCache(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a cache that ${name}`, async () => {
      let caught = false;
      try { await checkDataCache(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Count calls per url: `fetcher.mock.calls.filter((c) => c[0] === '/a').length`.
- Boundary: `revalidate: 10` stays cached at `9999` and refetches at `10000`.
- `revalidate: 0` twice in a row means two fetches; `Promise.all` of two `get`s means one.
- Tags: `/a` and `/b` tagged `posts`, `/c` tagged `other`, `/d` untagged.

%% solution
```js
export async function checkDataCache(createDataCache) {
  let t = 0;
  const fetcher = jest.fn(async (url) => url);
  const cache = createDataCache({ fetcher, now: () => t });
  const count = (url) => fetcher.mock.calls.filter((c) => c[0] === url).length;

  await cache.get('/default');
  await cache.get('/default');
  t = 10 ** 9;
  await cache.get('/default');
  expect(count('/default')).toBe(1);

  t = 0;
  await cache.get('/timed', { revalidate: 10 });
  t = 9999;
  await cache.get('/timed', { revalidate: 10 });
  expect(count('/timed')).toBe(1);
  t = 10000;
  await cache.get('/timed', { revalidate: 10 });
  expect(count('/timed')).toBe(2);

  await cache.get('/nostore', { revalidate: 0 });
  await cache.get('/nostore', { revalidate: 0 });
  expect(count('/nostore')).toBe(2);

  await Promise.all([cache.get('/shared'), cache.get('/shared')]);
  expect(count('/shared')).toBe(1);
  await Promise.all([cache.get('/shared-ns', { revalidate: 0 }), cache.get('/shared-ns', { revalidate: 0 })]);
  expect(count('/shared-ns')).toBe(1);

  await cache.get('/a', { tags: ['posts'] });
  await cache.get('/b', { tags: ['posts'] });
  await cache.get('/c', { tags: ['other'] });
  await cache.get('/d');
  cache.revalidateTag('posts');
  await cache.get('/a');
  await cache.get('/b');
  await cache.get('/c');
  await cache.get('/d');
  expect([count('/a'), count('/b'), count('/c'), count('/d')]).toEqual([2, 2, 1, 1]);
}
```
