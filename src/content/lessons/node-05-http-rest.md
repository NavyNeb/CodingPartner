---
id: node-http-rest
track: node
title: HTTP and REST semantics
summary: Routing with params and the right 404 versus 405, status codes that tell clients what to do, cursor pagination that does not drift, ETags and conditional requests, and idempotency keys for safe retries.
---

## The idea in one sentence

HTTP already defines **what each method, status code and header means**; a good API **uses those meanings** so clients, caches and proxies can behave correctly without reading your docs.

> **Analogy** The postal service. The envelope format (method, address, headers) is fixed, so any post office can handle it. If every shop invented its own envelope, nothing would be deliverable.

*(In NestJS this is the controller layer: `@Get(':id')`, `@Post()`, `@HttpCode()`, headers and interceptors for ETags. You will build the underlying router and rules.)*

## Methods and status codes

![Status code families](fig:nd-status "Pick the code that tells the client what to do next.")

| Method | Meaning | Safe | Idempotent |
| --- | --- | --- | --- |
| **GET** | Read | yes | yes |
| **POST** | Create / do something | no | **no** |
| **PUT** | Replace | no | yes |
| **PATCH** | Partially update | no | not guaranteed |
| **DELETE** | Remove | no | yes |

**Safe** means "does not change anything"; **idempotent** means "doing it twice has the same effect as once". That second word matters, because networks **retry**: a client that times out cannot know whether the server saw its `POST`.

Answers worth knowing cold: `201 Created` (+ `Location`) after a `POST`, `204 No Content` for success with nothing to say, `400` malformed, `401` not authenticated, `403` forbidden, `404` not found, **`405` right path but wrong method (with an `Allow` header)**, `409` conflict, `422` well-formed but invalid, `429` too many requests, `5xx` our fault.

```js try predict
const etag = (value) => {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;                                     // FNV-1a: a tiny, fast, non-cryptographic hash
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return '"' + h.toString(16) + '"';
};

const a = etag({ title: 'Hi', likes: 1 });
const b = etag({ title: 'Hi', likes: 1 });
const c = etag({ title: 'Hi', likes: 2 });
console.log(a === b, a === c);
```

Same content gives the same fingerprint, different content a different one. That is all an **ETag** is: a short name for "this exact version of the resource".

## Routing

A **router** matches a method and path to a handler. Three details separate a toy from a real one:

- **Params**: `/users/:id/posts/:postId` captures `{ id, postId }` (percent-decoded).
- **Specificity**: `/users/me` must beat `/users/:id`, **whatever order they were registered in**. Literal segments beat params, params beat wildcards.
- **404 vs 405**: if the path matches **some** route but not for this method, answer `405` with an `Allow` header; only a path that matches nothing is `404`.

## Conditional requests

![Conditional requests](fig:nd-conditional "ETag, If-None-Match for cheap reads, If-Match for safe writes.")

```stepper A conditional GET, then a safe PUT
code:
  GET /post/1                          → 200 body, ETag "v1"
  GET /post/1  If-None-Match: "v1"     → 304 (no body)
  (someone else edits the post)        → ETag "v2"
  GET /post/1  If-None-Match: "v1"     → 200 body, ETag "v2"
  PUT /post/1  If-Match: "v1"          → 412 Precondition Failed
  PUT /post/1  If-Match: "v2"          → 200 updated
---
line: 1
say: The first read returns the body and an `ETag` header: the fingerprint of this version.
phase: first read
---
line: 2
say: The client sends the ETag back as `If-None-Match`. Nothing changed, so the server answers `304` **with no body**: bandwidth saved.
phase: cheap re-read
---
line: 3
say: Meanwhile somebody else edits the post, so the server's current fingerprint becomes `"v2"`.
phase: change
---
line: 4
say: The same conditional GET no longer matches, so the server sends the new body and the new ETag.
phase: refreshed
---
line: 5
say: The client still holds `"v1"` and tries to save with `If-Match`. The server sees the resource has moved on and answers `412`: **a lost update prevented**.
phase: stale write
---
line: 6
say: With the current tag the write is accepted. `If-Match` turned "last write wins" into "write only if nobody else did".
phase: safe write
```

## Pagination that does not drift

![Offset versus cursor](fig:nd-cursor "A cursor names where you stopped; an offset only counts how far you walked.")

An **offset** (`page=2`) counts positions, so inserts and deletes between requests cause **duplicates and gaps**. A **cursor** names the last item you saw (`after=c3`) and asks for "everything after that", which stays correct however the list changes. Cursors are also **fast** on large tables (a seek, not a skip), which is why feeds use them.

## Idempotency keys

A client retries a `POST /payments` after a timeout. Without protection you charge twice. The fix: the client sends a unique **`Idempotency-Key`**, and the server **remembers the result** by key:

- same key and **same request** → return the **stored result**, run nothing again;
- same key but a **different request** → reject (it is a bug on the client);
- two requests at once with the same key → they **share one execution**;
- **failures are not cached**, so a retry can succeed;
- keys **expire** after a while.

## Quick check

```check
Q: A path matches a route, but only for GET, and the client sent DELETE. What do you return?
A) 404
B) 405 with an Allow header *
C) 400
D) 500
Why: The resource exists; the method is the problem.
---
Q: Why is POST not safe to retry blindly?
A) It is slower
B) It is not idempotent: a retry may create a second effect *
C) It has no body
D) Proxies block it
Why: Repeating a POST can repeat the side effect, so use an idempotency key.
---
Q: A client sends If-None-Match with the current ETag. What comes back?
A) 200 with the body
B) 304 Not Modified with no body *
C) 412
D) 204
Why: Same version, so the client's cached copy is still good.
---
Q: Why prefer cursor pagination for a busy feed?
A) It looks nicer
B) Inserts and deletes between requests cannot cause duplicates or gaps *
C) It needs no database
D) It disables caching
Why: The cursor names a position in the data, not a count of items to skip.
```

## Recap

- Use methods and codes for what they **mean**: **safe**, **idempotent**, `201` + `Location`, `204`, `401` vs `403`, **`405` + `Allow`** vs `404`.
- A router: **params**, **specificity** (literal > param > wildcard), decoding, **404 vs 405**.
- **ETag** + **If-None-Match** = cheap reads (`304`); **If-Match** = safe writes (`412`, or `428` if missing).
- **Cursor** pagination does not drift; clamp the limit and reject malformed cursors.
- **Idempotency keys** make retries safe: replay stored results, share in-flight work, don't cache failures, expire.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: match a route | Splitting paths and capturing `:params` |
| A router | Specificity ranking, 404 vs 405, wildcards, query parsing |
| Cursor pagination | Filtering by id, a "has more" check, rejecting bad cursors |
| Conditional requests | Hashing to an ETag, parsing header lists, weak vs strong matching |
| Idempotency store | Promises shared between callers, expiry, not caching failures |

%% exercise nod-guided-route | Guided: match a route | 1 | js | js | matchRoute | 8 | guided
Implement `matchRoute(pattern, path)`:

- Both are split on `/`, ignoring empty segments (so a trailing slash does not matter) and ignoring everything after `?` in the path.
- They must have the **same number** of segments.
- A pattern segment starting with `:` captures the path segment under that name, **percent-decoded** (`decodeURIComponent`). Any other pattern segment must be **equal** to the path segment.
- Return the params object (`{}` if there are none) or `null` when it does not match.

```js
matchRoute('/users/:id', '/users/7');        // { id: '7' }
matchRoute('/users/:id', '/posts/7');        // null
```

%% worked
**A similar problem, solved: `matchPrefix(prefix, path)`** — compare segment by segment and bail out at the first mismatch.

```js
function matchPrefix(prefix, path) {
  const want = prefix.split('/').filter(Boolean);        // ① drop empty segments: '/a/b/' and 'a/b' agree
  const got = path.split('/').filter(Boolean);
  if (got.length < want.length) return false;
  for (let i = 0; i < want.length; i++) {
    if (want[i] !== got[i]) return false;                 // ② the first difference decides
  }
  return true;
}
```

Yours demands the **same length** and, for `:name` segments, **captures** instead of comparing.

%% explain
- **Split and filter** empty segments.
- **Same length** or no match.
- **`:name`** captures (decoded); everything else compares.

%% nudge
- How do you ignore the query string?
- What do you do for a `:param` segment instead of comparing?

%% starter
```js
export function matchRoute(pattern, path) {
  return null;
}
```

%% tests
```js
describe('matchRoute', () => {
  it('matches a literal route', () => {
    expect(matchRoute('/users', '/users')).toEqual({});
    expect(matchRoute('/', '/')).toEqual({});
  });
  it('captures params', () => {
    expect(matchRoute('/users/:id', '/users/7')).toEqual({ id: '7' });
    expect(matchRoute('/users/:id/posts/:postId', '/users/7/posts/42')).toEqual({ id: '7', postId: '42' });
  });
  it('decodes percent-encoding in params', () => {
    expect(matchRoute('/tags/:name', '/tags/hello%20world')).toEqual({ name: 'hello world' });
  });
  it('does not match different lengths', () => {
    expect(matchRoute('/users/:id', '/users')).toBeNull();
    expect(matchRoute('/users/:id', '/users/7/posts')).toBeNull();
  });
  it('does not match different literals', () => {
    expect(matchRoute('/users/:id', '/posts/7')).toBeNull();
    expect(matchRoute('/a/b', '/a/c')).toBeNull();
  });
  it('ignores trailing slashes and the query string', () => {
    expect(matchRoute('/users/:id', '/users/7/')).toEqual({ id: '7' });
    expect(matchRoute('/users/:id', '/users/7?x=1&y=2')).toEqual({ id: '7' });
  });
});
```

%% hints
- `const clean = (s) => s.split('?')[0].split('/').filter(Boolean);`
- `if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);`
- `else if (p[i] !== s[i]) return null;`

%% solution
```js
export function matchRoute(pattern, path) {
  const clean = (s) => s.split('?')[0].split('/').filter(Boolean);
  const p = clean(pattern);
  const s = clean(path);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
```

%% exercise nod-router | A router with params and 405 | 4 | js | js | createRouter, reply | 45
Build a small router.

`reply(status, body, headers = {})` returns a `Reply` object (an instance of a class you define) holding those three values.

`createRouter()` returns `{ add(method, pattern, handler), handle(method, rawPath) }`:

- `add` stores the route (methods are **case-insensitive**; store upper-case) and returns the router.
- `handle` is **async** and returns `{ status, body, headers }`. `rawPath` may include a query string; parse it with `new URL(rawPath, 'http://localhost')`.
- The handler is called with `{ params, query, method }` (`query` is a plain object of the first value for each key; `params` are percent-decoded). If it returns a `Reply`, use its status, body and headers; if it returns `undefined`, the response is `{ status: 204, body: undefined, headers: {} }`; any other value is `{ status: 200, body: value, headers: {} }`. Handlers may be async.
- Patterns are split on `/` ignoring empty segments. `:name` captures one segment; a final `*` captures **one or more** remaining segments joined with `/` as `params['*']`.
- **Specificity**: among routes that match the path **and** method, the best wins regardless of registration order. Compare segment by segment: a literal beats a param, which beats `*`. Ties go to the first registered.
- **No route matches the path for any method** → `{ status: 404, body: { error: 'Not Found' }, headers: {} }`.
- **The path matches some route, but none for this method** → `{ status: 405, body: { error: 'Method Not Allowed' }, headers: { Allow } }` where `Allow` lists the distinct methods of **all** routes matching the path, sorted, joined with `', '`.

```js
const router = createRouter()
  .add('GET', '/users/:id', ({ params }) => ({ id: params.id }))
  .add('GET', '/users/me', () => ({ me: true }));
await router.handle('GET', '/users/me'); // { status: 200, body: { me: true }, headers: {} }
```

%% worked
**A similar problem, solved: `pickBest(candidates)`** — rank by a **score array** and compare it lexicographically, so registration order never matters.

```js
function pickBest(candidates) {                       // each: { rank: [3, 2, 3], value }
  let best = null;
  for (const c of candidates) {
    if (!best || compareRank(c.rank, best.rank) > 0) best = c;   // ① strictly better replaces; ties keep the first
  }
  return best;
}
function compareRank(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;                      // ② the first segment that differs decides
  }
  return 0;
}
```

For routes, a segment's rank is **3** for a literal, **2** for `:param`, **1** for `*`. `/users/me` is `[3, 3]` and `/users/:id` is `[3, 2]`, so the literal route wins.

%% explain
- **Compile** each route into segments and a rank array.
- **Match** a route against the path (with wildcard rules) and produce params.
- **Choose**: candidates for the path → filter by method → best rank, else 405 or 404.

%% nudge
- How do you know whether to answer 404 or 405?
- Why compute ranks per segment instead of one number?

%% starter
```js
export class Reply {
  constructor(status, body, headers) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

export function reply(status, body, headers = {}) {
  return new Reply(status, body, headers);
}

export function createRouter() {
  const routes = [];
  const router = {
    add(method, pattern, handler) {
      return router;
    },
    async handle(method, rawPath) {
      return { status: 404, body: { error: 'Not Found' }, headers: {} };
    },
  };
  return router;
}
```

%% tests
```js
describe('reply', () => {
  it('builds a reply object', () => {
    const r = reply(201, { id: 1 }, { Location: '/x/1' });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ id: 1 });
    expect(r.headers).toEqual({ Location: '/x/1' });
    expect(reply(204).headers).toEqual({});
  });
});

describe('createRouter', () => {
  it('routes by method and path and passes params and query', async () => {
    const router = createRouter().add('GET', '/users/:id', ({ params, query, method }) => ({ params, query, method }));
    expect(await router.handle('GET', '/users/7?x=1&x=2&y=a%20b')).toEqual({
      status: 200,
      body: { params: { id: '7' }, query: { x: '1', y: 'a b' }, method: 'GET' },
      headers: {},
    });
  });
  it('is case-insensitive about methods and chainable', async () => {
    const router = createRouter().add('get', '/a', () => 'a').add('Post', '/a', () => 'b');
    expect((await router.handle('GET', '/a')).body).toBe('a');
    expect((await router.handle('post', '/a')).body).toBe('b');
  });
  it('decodes params and ignores trailing slashes', async () => {
    const router = createRouter().add('GET', '/tags/:name', ({ params }) => params.name);
    expect((await router.handle('GET', '/tags/hello%20world/')).body).toBe('hello world');
  });
  it('answers 204 for undefined and honours replies', async () => {
    const router = createRouter()
      .add('DELETE', '/x/:id', () => undefined)
      .add('POST', '/x', () => reply(201, { id: 1 }, { Location: '/x/1' }));
    expect(await router.handle('DELETE', '/x/1')).toEqual({ status: 204, body: undefined, headers: {} });
    expect(await router.handle('POST', '/x')).toEqual({ status: 201, body: { id: 1 }, headers: { Location: '/x/1' } });
  });
  it('supports async handlers', async () => {
    const router = createRouter().add('GET', '/slow', async () => { await null; return 'done'; });
    expect((await router.handle('GET', '/slow')).body).toBe('done');
  });
  it('prefers literals over params whatever the registration order', async () => {
    const a = createRouter().add('GET', '/users/:id', () => 'param').add('GET', '/users/me', () => 'literal');
    const b = createRouter().add('GET', '/users/me', () => 'literal').add('GET', '/users/:id', () => 'param');
    for (const r of [a, b]) {
      expect((await r.handle('GET', '/users/me')).body).toBe('literal');
      expect((await r.handle('GET', '/users/7')).body).toBe('param');
    }
  });
  it('compares segment by segment', async () => {
    const router = createRouter()
      .add('GET', '/:a/settings', () => 'param-first')
      .add('GET', '/users/:b', () => 'literal-first');
    expect((await router.handle('GET', '/users/settings')).body).toBe('literal-first');
  });
  it('gives ties to the first registered route', async () => {
    const router = createRouter().add('GET', '/p/:a', () => 'first').add('GET', '/p/:b', () => 'second');
    expect((await router.handle('GET', '/p/1')).body).toBe('first');
  });
  it('captures wildcards, needing at least one segment', async () => {
    const router = createRouter().add('GET', '/files/*', ({ params }) => params['*']);
    expect((await router.handle('GET', '/files/a/b/c.txt')).body).toBe('a/b/c.txt');
    expect((await router.handle('GET', '/files/a')).body).toBe('a');
    expect((await router.handle('GET', '/files')).status).toBe(404);
  });
  it('ranks a wildcard below a param', async () => {
    const router = createRouter().add('GET', '/f/*', () => 'wild').add('GET', '/f/:x', () => 'param');
    expect((await router.handle('GET', '/f/one')).body).toBe('param');
    expect((await router.handle('GET', '/f/one/two')).body).toBe('wild');
  });
  it('answers 404 when no route matches the path', async () => {
    const router = createRouter().add('GET', '/a', () => 'a');
    expect(await router.handle('GET', '/b')).toEqual({ status: 404, body: { error: 'Not Found' }, headers: {} });
  });
  it('answers 405 with a sorted Allow list when only the method is wrong', async () => {
    const router = createRouter()
      .add('POST', '/items', () => 1)
      .add('GET', '/items', () => 2)
      .add('GET', '/items/:id', () => 3);
    expect(await router.handle('DELETE', '/items')).toEqual({
      status: 405,
      body: { error: 'Method Not Allowed' },
      headers: { Allow: 'GET, POST' },
    });
    expect((await router.handle('PUT', '/items/9')).headers.Allow).toBe('GET');
  });
  it('lets a param route serve a method the literal route lacks', async () => {
    const router = createRouter().add('GET', '/users/me', () => 'me').add('DELETE', '/users/:id', () => 'deleted');
    expect((await router.handle('DELETE', '/users/me')).body).toBe('deleted');
    expect((await router.handle('POST', '/users/me')).status).toBe(405);
  });
});
```

%% hints
- Compile: `const segs = pattern.split('/').filter(Boolean); const rank = segs.map((s) => (s === '*' ? 1 : s[0] === ':' ? 2 : 3));`
- Matching: loop segments; `*` must have at least one path segment left and swallows the rest; otherwise lengths must be equal.
- `handle`: collect **path matches**; none → 404. Filter by method; none → 405 with `Allow`.
- Compare ranks lexicographically; strictly greater replaces the current best.
- Result: `r instanceof Reply ? ... : r === undefined ? 204 : 200`.

%% solution
```js
export class Reply {
  constructor(status, body, headers) {
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

export function reply(status, body, headers = {}) {
  return new Reply(status, body, headers);
}

export function createRouter() {
  const routes = [];

  const split = (s) => s.split('/').filter(Boolean);
  const rankOf = (segs) => segs.map((s) => (s === '*' ? 1 : s[0] === ':' ? 2 : 3));
  const compare = (a, b) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const diff = (a[i] ?? 0) - (b[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };

  function matchSegments(segs, path) {
    const params = {};
    for (let i = 0; i < segs.length; i++) {
      if (i >= path.length) return null;
      const seg = segs[i];
      if (seg === '*') {
        params['*'] = path.slice(i).map(decodeURIComponent).join('/');
        return params;
      }
      if (seg[0] === ':') params[seg.slice(1)] = decodeURIComponent(path[i]);
      else if (seg !== path[i]) return null;
    }
    return segs.length === path.length ? params : null;
  }

  const router = {
    add(method, pattern, handler) {
      const segs = split(pattern);
      routes.push({ method: method.toUpperCase(), segs, rank: rankOf(segs), handler });
      return router;
    },
    async handle(method, rawPath) {
      const url = new URL(rawPath, 'http://localhost');
      const path = split(url.pathname);
      const wanted = method.toUpperCase();

      const matches = [];
      for (const route of routes) {
        const params = matchSegments(route.segs, path);
        if (params) matches.push({ route, params });
      }
      if (matches.length === 0) return { status: 404, body: { error: 'Not Found' }, headers: {} };

      let best = null;
      for (const m of matches) {
        if (m.route.method !== wanted) continue;
        if (!best || compare(m.route.rank, best.route.rank) > 0) best = m;
      }
      if (!best) {
        const allow = [...new Set(matches.map((m) => m.route.method))].sort().join(', ');
        return { status: 405, body: { error: 'Method Not Allowed' }, headers: { Allow: allow } };
      }

      const query = {};
      for (const [key, value] of url.searchParams) if (!(key in query)) query[key] = value;
      const result = await best.route.handler({ params: best.params, query, method: wanted });
      if (result instanceof Reply) return { status: result.status, body: result.body, headers: result.headers };
      if (result === undefined) return { status: 204, body: undefined, headers: {} };
      return { status: 200, body: result, headers: {} };
    },
  };
  return router;
}
```

%% exercise nod-cursor | Cursor pagination | 3 | js | js | encodeCursor, decodeCursor, paginateByCursor | 26
Items are objects with a numeric, unique, **ascending** `id`.

- `encodeCursor(id)` returns `'c' + id`. `decodeCursor(cursor)` returns the numeric id, and throws `Error('invalid cursor')` unless the cursor is a **string** matching `c` followed by digits only (`'abc'`, `'c'`, `'c-1'`, `5` and `'c1.5'` are all invalid).
- `paginateByCursor(items, { after, limit = 10 } = {})` returns `{ items, nextCursor }`: the next `limit` items whose `id` is **greater than** the decoded `after` (all items when `after` is `undefined` or `null`). `limit` is clamped to `1..100`; a non-integer `limit` means `10`.
- `nextCursor` is the encoded id of the **last returned item** when more items remain, otherwise `null` (including when the last page is **exactly full**).

```js
const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
paginateByCursor(items, { limit: 2 });                    // { items: [{id:1},{id:2}], nextCursor: 'c2' }
paginateByCursor(items, { after: 'c2', limit: 2 });       // { items: [{id:3}], nextCursor: null }
```

%% worked
**A similar problem, solved: `takeAfter(list, marker, size)`** — filter by "after the marker", then look **one past** the page to learn whether there is more.

```js
function takeAfter(list, marker, size) {
  const rest = list.filter((x) => x > marker);          // ① everything strictly after the marker
  const page = rest.slice(0, size);
  const hasMore = rest.length > size;                    // ② compare against the size, not the page length
  return { page, last: hasMore ? page[page.length - 1] : null };
}
```

`rest.length > size` is the trick: it is `false` when the final page is **exactly full**, so you never hand out a cursor that leads to an empty page.

%% explain
- **Decode strictly**, throw on anything odd.
- **Filter by id**, slice the page, **compare the rest to the size**.
- **Clamp** the limit.

%% nudge
- Why compare the remaining count to the limit instead of the page length?
- What if a deleted item's id is the cursor?

%% starter
```js
export function encodeCursor(id) {
  return 'c' + id;
}

export function decodeCursor(cursor) {
  return 0;
}

export function paginateByCursor(items, { after, limit = 10 } = {}) {
  return { items, nextCursor: null };
}
```

%% tests
```js
describe('cursors', () => {
  it('round-trips', () => {
    expect(encodeCursor(42)).toBe('c42');
    expect(decodeCursor('c42')).toBe(42);
    expect(decodeCursor(encodeCursor(7))).toBe(7);
  });
  it('rejects malformed cursors', () => {
    for (const bad of ['abc', 'c', 'c-1', 'c1.5', 'c1x', '', 5, null, undefined, {}]) {
      expect(() => decodeCursor(bad)).toThrow('invalid cursor');
    }
  });
});

describe('paginateByCursor', () => {
  const list = (ids) => ids.map((id) => ({ id }));
  const ids = (page) => page.items.map((i) => i.id);

  it('returns the first page and a cursor', () => {
    const page = paginateByCursor(list([1, 2, 3, 4, 5]), { limit: 2 });
    expect(ids(page)).toEqual([1, 2]);
    expect(page.nextCursor).toBe('c2');
  });
  it('follows the cursor to the end', () => {
    const all = list([1, 2, 3, 4, 5]);
    const second = paginateByCursor(all, { after: 'c2', limit: 2 });
    expect(ids(second)).toEqual([3, 4]);
    expect(second.nextCursor).toBe('c4');
    const third = paginateByCursor(all, { after: second.nextCursor, limit: 2 });
    expect(ids(third)).toEqual([5]);
    expect(third.nextCursor).toBeNull();
  });
  it('has no cursor when the last page is exactly full', () => {
    const page = paginateByCursor(list([1, 2, 3, 4]), { after: 'c2', limit: 2 });
    expect(ids(page)).toEqual([3, 4]);
    expect(page.nextCursor).toBeNull();
    expect(paginateByCursor(list([1, 2]), { limit: 2 }).nextCursor).toBeNull();
  });
  it('treats null and undefined after as the start', () => {
    const all = list([1, 2, 3]);
    expect(ids(paginateByCursor(all, { after: null }))).toEqual([1, 2, 3]);
    expect(ids(paginateByCursor(all))).toEqual([1, 2, 3]);
  });
  it('returns an empty page past the end', () => {
    expect(paginateByCursor(list([1, 2]), { after: 'c9' })).toEqual({ items: [], nextCursor: null });
    expect(paginateByCursor([], {})).toEqual({ items: [], nextCursor: null });
  });
  it('is stable when items are deleted between requests', () => {
    const before = list([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const first = paginateByCursor(before, { limit: 3 });
    const after = before.filter((i) => i.id !== 4);
    const second = paginateByCursor(after, { after: first.nextCursor, limit: 3 });
    expect(ids(second)).toEqual([5, 6, 7]);
  });
  it('works when the cursor id itself was deleted', () => {
    const page = paginateByCursor(list([1, 2, 4, 5]), { after: 'c3' });
    expect(ids(page)).toEqual([4, 5]);
  });
  it('clamps the limit', () => {
    const many = list(Array.from({ length: 150 }, (_, i) => i + 1));
    expect(paginateByCursor(many, { limit: 1000 }).items).toHaveLength(100);
    expect(paginateByCursor(many, { limit: 0 }).items).toHaveLength(1);
    expect(paginateByCursor(many, { limit: -5 }).items).toHaveLength(1);
    expect(paginateByCursor(many, { limit: 'abc' }).items).toHaveLength(10);
    expect(paginateByCursor(many, { limit: 2.5 }).items).toHaveLength(10);
  });
  it('rejects a bad cursor', () => {
    expect(() => paginateByCursor(list([1]), { after: 'nope' })).toThrow('invalid cursor');
  });
});
```

%% hints
- `const m = /^c(\d+)$/.exec(typeof cursor === 'string' ? cursor : ''); if (!m) throw new Error('invalid cursor');`
- `const size = Number.isInteger(limit) ? Math.min(100, Math.max(1, limit)) : 10;`
- `const rest = items.filter((item) => item.id > start);`
- `nextCursor = rest.length > size ? encodeCursor(page[page.length - 1].id) : null`

%% solution
```js
export function encodeCursor(id) {
  return 'c' + id;
}

export function decodeCursor(cursor) {
  const match = /^c(\d+)$/.exec(typeof cursor === 'string' ? cursor : '');
  if (!match) throw new Error('invalid cursor');
  return Number(match[1]);
}

export function paginateByCursor(items, { after, limit = 10 } = {}) {
  const size = Number.isInteger(limit) ? Math.min(100, Math.max(1, limit)) : 10;
  const start = after === undefined || after === null ? -Infinity : decodeCursor(after);
  const rest = items.filter((item) => item.id > start);
  const page = rest.slice(0, size);
  return {
    items: page,
    nextCursor: rest.length > size ? encodeCursor(page[page.length - 1].id) : null,
  };
}
```

%% exercise nod-conditional | ETags and conditional requests | 4 | js | js | etagOf, conditionalGet, checkIfMatch | 38
Three helpers.

`etagOf(value)` returns a quoted hex fingerprint such as `"1a2b3c"` of `JSON.stringify(value)`. It must be **deterministic** and different for different values (use a real hash such as FNV-1a; a simple sum of characters collides on `"ab"` and `"ba"`).

`conditionalGet(body, headers = {})` returns `{ status: 200, headers: { ETag }, body }`, or `{ status: 304, headers: { ETag } }` (no `body` key) when the request's `If-None-Match` matches. Header names are **case-insensitive**. `If-None-Match` is a comma-separated list of tags; `*` matches anything; the comparison is **weak**, so a leading `W/` on either side is ignored.

`checkIfMatch(currentEtag, headers = {})` guards writes and returns `{ ok: true }` or `{ ok: false, status }`:

1. No `If-Match` header → `428` (precondition required).
2. `currentEtag` is `null`/`undefined` (the resource does not exist) → `412`.
3. `*` → ok. A listed tag that **equals** `currentEtag` exactly → ok (**strong** comparison: a `W/"..."` tag never matches).
4. Otherwise `412`.

```js
const tag = etagOf({ likes: 1 });
conditionalGet({ likes: 1 }, { 'If-None-Match': tag }); // { status: 304, headers: { ETag: tag } }
checkIfMatch(tag, { 'if-match': '"stale"' });           // { ok: false, status: 412 }
```

%% worked
**A similar problem, solved: `checksum(text)`** — a tiny deterministic hash, and a header parser that tolerates spaces.

```js
function checksum(text) {
  let h = 5381;                                              // ① djb2: start value, then mix every character in
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) + text.charCodeAt(i)) >>> 0;
  return h.toString(16);                                     // ② >>> 0 keeps it an unsigned 32-bit number
}

const parseList = (header) => header.split(',').map((s) => s.trim()).filter(Boolean);   // ③ '"a" , "b"' -> ['"a"', '"b"']
```

Remember to **quote** your ETag (`'"' + hex + '"'`): the quotes are part of the header value.

%% explain
- **Hash** the JSON text; quote the hex.
- **Header helper**: find a header ignoring case; split lists on commas.
- **Weak vs strong**: `If-None-Match` strips `W/`; `If-Match` does not.

%% nudge
- Why must a `304` response have no body?
- Why does `If-Match` use strong comparison?

%% starter
```js
export function etagOf(value) {
  return '"0"';
}

export function conditionalGet(body, headers = {}) {
  return { status: 200, headers: { ETag: etagOf(body) }, body };
}

export function checkIfMatch(currentEtag, headers = {}) {
  return { ok: true };
}
```

%% tests
```js
describe('etagOf', () => {
  it('is a quoted hex string', () => {
    expect(etagOf({ a: 1 })).toMatch(/^"[0-9a-f]+"$/);
  });
  it('is deterministic', () => {
    expect(etagOf({ a: 1, b: [1, 2] })).toBe(etagOf({ a: 1, b: [1, 2] }));
  });
  it('differs for different values', () => {
    const tags = [etagOf({ a: 1 }), etagOf({ a: 2 }), etagOf(['ab']), etagOf(['ba']), etagOf('x'), etagOf(null)];
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe('conditionalGet', () => {
  const body = { title: 'Hi', likes: 1 };
  const tag = etagOf(body);
  it('returns the body and ETag without a condition', () => {
    expect(conditionalGet(body)).toEqual({ status: 200, headers: { ETag: tag }, body });
    expect(conditionalGet(body, {}).status).toBe(200);
  });
  it('answers 304 without a body when the tag matches', () => {
    const res = conditionalGet(body, { 'If-None-Match': tag });
    expect(res).toEqual({ status: 304, headers: { ETag: tag } });
    expect('body' in res).toBe(false);
  });
  it('treats header names as case-insensitive', () => {
    expect(conditionalGet(body, { 'if-none-match': tag }).status).toBe(304);
    expect(conditionalGet(body, { 'IF-NONE-MATCH': tag }).status).toBe(304);
  });
  it('returns the new body when the tag is stale', () => {
    expect(conditionalGet(body, { 'If-None-Match': '"stale"' })).toEqual({ status: 200, headers: { ETag: tag }, body });
  });
  it('understands lists, wildcards and weak tags', () => {
    expect(conditionalGet(body, { 'If-None-Match': `"a", ${tag} , "b"` }).status).toBe(304);
    expect(conditionalGet(body, { 'If-None-Match': '*' }).status).toBe(304);
    expect(conditionalGet(body, { 'If-None-Match': 'W/' + tag }).status).toBe(304);
    expect(conditionalGet(body, { 'If-None-Match': '"a", "b"' }).status).toBe(200);
  });
});

describe('checkIfMatch', () => {
  const tag = etagOf({ v: 1 });
  it('requires the header', () => {
    expect(checkIfMatch(tag, {})).toEqual({ ok: false, status: 428 });
    expect(checkIfMatch(tag)).toEqual({ ok: false, status: 428 });
  });
  it('accepts the current tag, case-insensitive header name', () => {
    expect(checkIfMatch(tag, { 'If-Match': tag })).toEqual({ ok: true });
    expect(checkIfMatch(tag, { 'if-match': tag })).toEqual({ ok: true });
  });
  it('refuses a stale tag with 412', () => {
    expect(checkIfMatch(tag, { 'If-Match': '"stale"' })).toEqual({ ok: false, status: 412 });
  });
  it('accepts a list containing the tag and the wildcard', () => {
    expect(checkIfMatch(tag, { 'If-Match': `"a", ${tag}` })).toEqual({ ok: true });
    expect(checkIfMatch(tag, { 'If-Match': '*' })).toEqual({ ok: true });
  });
  it('uses strong comparison: weak tags never match', () => {
    expect(checkIfMatch(tag, { 'If-Match': 'W/' + tag })).toEqual({ ok: false, status: 412 });
  });
  it('answers 412 when the resource does not exist', () => {
    expect(checkIfMatch(null, { 'If-Match': '*' })).toEqual({ ok: false, status: 412 });
    expect(checkIfMatch(undefined, { 'If-Match': tag })).toEqual({ ok: false, status: 412 });
  });
});
```

%% hints
- FNV-1a: `h ^= code; h = Math.imul(h, 0x01000193) >>> 0;` starting from `0x811c9dc5`.
- `const header = (headers, name) => { for (const k of Object.keys(headers)) if (k.toLowerCase() === name) return headers[k]; };`
- Weak compare: `const strip = (t) => t.replace(/^W\//, '');`
- `checkIfMatch` order: missing header (428) → missing resource (412) → `*` → exact match → 412.

%% solution
```js
export function etagOf(value) {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return '"' + h.toString(16) + '"';
}

const header = (headers, name) => {
  for (const key of Object.keys(headers)) if (key.toLowerCase() === name) return headers[key];
  return undefined;
};
const parseList = (value) => value.split(',').map((s) => s.trim()).filter(Boolean);
const strip = (tag) => tag.replace(/^W\//, '');

export function conditionalGet(body, headers = {}) {
  const etag = etagOf(body);
  const raw = header(headers, 'if-none-match');
  if (raw !== undefined) {
    const tags = parseList(raw);
    if (tags.includes('*') || tags.some((tag) => strip(tag) === etag)) {
      return { status: 304, headers: { ETag: etag } };
    }
  }
  return { status: 200, headers: { ETag: etag }, body };
}

export function checkIfMatch(currentEtag, headers = {}) {
  const raw = header(headers, 'if-match');
  if (raw === undefined) return { ok: false, status: 428 };
  if (currentEtag === null || currentEtag === undefined) return { ok: false, status: 412 };
  const tags = parseList(raw);
  if (tags.includes('*') || tags.includes(currentEtag)) return { ok: true };
  return { ok: false, status: 412 };
}
```

%% exercise nod-idempotency | Idempotency keys | 4 | js | js | createIdempotencyStore | 40
`createIdempotencyStore({ now, ttlMs })` returns `{ run(key, fingerprint, fn) }` (async):

- First call for a key: run `fn` **immediately (synchronously inside `run`)** and remember `{ fingerprint, promise, storedAt }`.
- Same key and **same** fingerprint while the entry is live: return the **stored promise's result** and do **not** call `fn` again. This includes a second call made **while the first is still running**: both share one execution.
- Same key, **different** fingerprint: reject with `Error('idempotency key reused with different request')`.
- If `fn` **rejects**, forget the entry so a retry can run again (callers still see the rejection). A synchronous throw counts as a rejection.
- An entry is **expired** when `now() - storedAt >= ttlMs`; an expired entry is treated as absent (even with a different fingerprint).
- Different keys never affect each other.

```js
const store = createIdempotencyStore({ now: () => 0, ttlMs: 60000 });
const charge = jest.fn(async () => ({ id: 'ch_1' }));
await store.run('k1', 'POST /pay 500', charge);
await store.run('k1', 'POST /pay 500', charge);   // same result, charge called once
```

%% worked
**A similar problem, solved: `createOnce()`** — share one in-flight promise between concurrent callers, and forget it on failure.

```js
function createOnce() {
  const inflight = new Map();                                // key -> promise
  return function once(key, fn) {
    if (inflight.has(key)) return inflight.get(key);         // ① a second caller joins the first
    const promise = new Promise((resolve) => resolve(fn())); // ② runs fn right now; a sync throw becomes a rejection
    inflight.set(key, promise);
    promise.then(() => inflight.delete(key), () => inflight.delete(key));   // ③ clear when done, success or not
    return promise;
  };
}
```

Yours **keeps** successful results (until the ttl) and checks a **fingerprint** too. Keep the promise itself: storing the promise (not the value) is what lets concurrent callers share.

%% explain
- **Store the promise**, with fingerprint and start time.
- **Look up first**, expiring old entries; compare fingerprints.
- **Delete on rejection** so retries are possible.

%% nudge
- Why store the promise rather than the resolved value?
- What should happen to the entry when `fn` rejects?

%% starter
```js
export function createIdempotencyStore({ now, ttlMs }) {
  const entries = new Map();
  return {
    async run(key, fingerprint, fn) {
      return fn();
    },
  };
}
```

%% tests
```js
describe('createIdempotencyStore', () => {
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };
  const setup = (ttlMs = 1000) => {
    let t = 0;
    return { store: createIdempotencyStore({ now: () => t, ttlMs }), at: (x) => { t = x; } };
  };

  it('runs fn once and replays the stored result', async () => {
    const { store } = setup();
    const fn = jest.fn(async () => ({ id: 'ch_1' }));
    const a = await store.run('k', 'f', fn);
    const b = await store.run('k', 'f', fn);
    expect(a).toEqual({ id: 'ch_1' });
    expect(b).toBe(a);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('runs fn synchronously on the first call', () => {
    const { store } = setup();
    const fn = jest.fn(async () => 1);
    store.run('k', 'f', fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('shares one execution between concurrent callers', async () => {
    const { store } = setup();
    const d = deferred();
    const fn = jest.fn(() => d.promise);
    const first = store.run('k', 'f', fn);
    const second = store.run('k', 'f', fn);
    d.resolve('done');
    expect(await first).toBe('done');
    expect(await second).toBe('done');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('rejects a reused key with a different fingerprint', async () => {
    const { store } = setup();
    await store.run('k', 'POST /pay 500', async () => 1);
    await expect(store.run('k', 'POST /pay 900', async () => 2)).rejects.toThrow('idempotency key reused with different request');
  });
  it('does not cache failures, and callers still see them', async () => {
    const { store } = setup();
    const boom = jest.fn(async () => { throw new Error('boom'); });
    await expect(store.run('k', 'f', boom)).rejects.toThrow('boom');
    const ok = jest.fn(async () => 'fine');
    expect(await store.run('k', 'f', ok)).toBe('fine');
    expect(boom).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);
  });
  it('treats a synchronous throw as a failure', async () => {
    const { store } = setup();
    await expect(store.run('k', 'f', () => { throw new Error('sync'); })).rejects.toThrow('sync');
    expect(await store.run('k', 'f', async () => 'later')).toBe('later');
  });
  it('lets concurrent callers all see a failure, then allows a retry', async () => {
    const { store } = setup();
    const d = deferred();
    const first = store.run('k', 'f', () => d.promise);
    const second = store.run('k', 'f', () => 'never');
    d.reject(new Error('down'));
    await expect(first).rejects.toThrow('down');
    await expect(second).rejects.toThrow('down');
    expect(await store.run('k', 'f', async () => 'back')).toBe('back');
  });
  it('expires entries at exactly the ttl', async () => {
    const { store, at } = setup(1000);
    const fn = jest.fn(async () => 'v');
    await store.run('k', 'f', fn);
    at(999);
    await store.run('k', 'f', fn);
    expect(fn).toHaveBeenCalledTimes(1);
    at(1000);
    await store.run('k', 'f', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('lets an expired key be reused with a different fingerprint', async () => {
    const { store, at } = setup(1000);
    await store.run('k', 'first', async () => 1);
    at(1000);
    expect(await store.run('k', 'second', async () => 2)).toBe(2);
  });
  it('keeps keys independent', async () => {
    const { store } = setup();
    const a = jest.fn(async () => 'a');
    const b = jest.fn(async () => 'b');
    expect(await store.run('k1', 'f', a)).toBe('a');
    expect(await store.run('k2', 'f', b)).toBe('b');
    expect(await store.run('k1', 'f', b)).toBe('a');
    expect(b).toHaveBeenCalledTimes(1);
  });
});
```

%% hints
- `entries: Map(key → { fingerprint, promise, storedAt })`.
- Look up first; if `existing && now() - existing.storedAt >= ttlMs`, delete it and treat as absent.
- `const promise = new Promise((resolve) => resolve(fn()));` calls `fn` immediately and turns a sync throw into a rejection.
- On rejection: `promise.catch(() => { if (entries.get(key) === entry) entries.delete(key); });` attach this **before** returning.

%% solution
```js
export function createIdempotencyStore({ now, ttlMs }) {
  const entries = new Map();
  return {
    async run(key, fingerprint, fn) {
      let existing = entries.get(key);
      if (existing && now() - existing.storedAt >= ttlMs) {
        entries.delete(key);
        existing = undefined;
      }
      if (existing) {
        if (existing.fingerprint !== fingerprint) {
          throw new Error('idempotency key reused with different request');
        }
        return existing.promise;
      }
      const promise = new Promise((resolve) => resolve(fn()));
      const entry = { fingerprint, promise, storedAt: now() };
      entries.set(key, entry);
      promise.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return promise;
    },
  };
}
```
