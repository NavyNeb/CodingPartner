---
id: rd-rendering-strategies
track: rd
title: CSR, SSR, SSG and ISR
summary: Where and when a page's HTML is built, what each choice costs in first paint, interactivity, freshness and server load, and how to simulate an incremental static regeneration cache and a static site build.
---

## The idea in one sentence

Every web page is HTML at some point; the strategy question is **who builds it, and when**: in the **browser** on every visit, on the **server** for every request, **once at build time**, or **at build time and refreshed** every so often.

> **Analogy** A restaurant. *CSR* hands you a meal kit and a recipe (you cook it at the table). *SSR* cooks every order fresh. *SSG* sells meals prepared in the morning. *ISR* sells morning meals too, but a cook quietly replaces any that are getting old.

*(In Next.js: CSR is a client component fetching in `useEffect`; SSR is a dynamic route (`cache: 'no-store'` or `getServerSideProps`); SSG is a static route with `generateStaticParams`; ISR is `revalidate` plus `revalidatePath`. You will build the machinery, framework-free.)*

## The four strategies

![Rendering strategies](fig:rd-strategies "Ask where the HTML is built and how often.")

| Strategy | HTML built | First content | Interactive | Fresh? | Server cost | SEO |
| --- | --- | --- | --- | --- | --- | --- |
| **CSR** | in the browser, every visit | **late** (JS, then data) | as soon as it draws | always (fetches live) | lowest (static files + API) | weak without extra work |
| **SSR** | on the server, every request | **early** | after **hydration** | always | **high** (render per request) | strong |
| **SSG** | once, at build time | **earliest** (CDN file) | after hydration | only as fresh as the last build | none at request time | strong |
| **ISR** | at build, then refreshed | earliest on a hit | after hydration | fresh within the revalidate window | low | strong |

Pick with two questions: **does it differ per user** (a dashboard, a cart) and **how quickly does the content change** (a blog post: rarely; a product price: often; stock levels: constantly)?

- Per-user and private, no SEO: **CSR**. Per-user and needs SEO or fast first paint: **SSR**.
- Same for everyone, rarely changes: **SSG**. Same for everyone, changes sometimes: **ISR**.

## The cost of each choice

![Timelines](fig:rd-timeline "CSR paints late but is interactive at once; SSR paints early but waits for hydration.")

**Hydration** is the browser attaching JavaScript to HTML that already exists. Until it finishes, the page **looks** ready but **ignores clicks**. That gap (and the JavaScript that causes it) is the main cost of the server-rendered strategies, and it is why the next lesson is about shrinking it.

```js try predict
let version = 0;
const cache = { html: null, at: 0 };
const render = () => 'page v' + ++version;

function get(now) {
  if (cache.html === null) {
    cache.html = render();
    cache.at = now;
    return ['MISS', cache.html];
  }
  if (now - cache.at >= 1000) {
    const old = cache.html;            // serve the old page...
    cache.html = render();             // ...and rebuild (here, instantly)
    cache.at = now;
    return ['STALE', old];
  }
  return ['HIT', cache.html];
}

console.log([0, 500, 1000, 1200].map(get));
```

## Incremental static regeneration

![ISR lifecycle](fig:rd-isr "Serve the old page immediately; rebuild once in the background.")

ISR is **stale-while-revalidate for whole pages**. Three details separate a toy from a real one:

- **Nobody waits**: a stale request is answered with the old page **immediately**; the rebuild happens in the background.
- **One rebuild**: a hundred stale requests start **one** re-render, not a hundred.
- **Failure is safe**: if the rebuild throws, keep serving the old page and try again next time.

On top of that comes **on-demand revalidation**: after an editor saves, a webhook **invalidates** the page so the next request rebuilds it, instead of waiting for the timer.

```stepper One page's life
code:
  t=0     first request           → MISS  (render, store)
  t=500   second request          → HIT
  t=1000  request after window    → STALE (serve old, rebuild)
  t=1100  request while rebuilding → STALE (no second rebuild)
  t=1300  rebuild finished        → new page stored
  t=1400  request                 → HIT   (new page)
---
line: 1
say: Nothing is cached yet, so the **first visitor waits** while the page is rendered and stored. This is a **MISS**.
phase: miss
---
line: 2
say: Within the revalidate window (say 1000 ms) the cached page is served instantly: a **HIT**.
phase: hit
---
line: 3
say: The page is now older than the window. The visitor still gets the **old page at once**, and **one background rebuild** starts.
phase: stale
---
line: 4
say: Another request arrives while the rebuild is running. It also gets the old page, and **must not start a second rebuild**.
phase: deduplicated
---
line: 5
say: The rebuild finishes. The new page replaces the old one and its age starts again **from now**.
phase: swap
---
line: 6
say: Later requests are hits on the new page. Total waiting for visitors: **zero**, except the very first one.
phase: hit again
```

## Static site generation

An SSG build asks each route which pages exist (`generateStaticParams`: all the blog slugs), renders each one to a file, and uploads the files. Two details matter at scale: render with **limited concurrency** (a thousand pages must not open a thousand database connections) and **collect failures** instead of aborting the whole build on the first broken page.

## Quick check

```check
Q: A logged-in dashboard with private data, no SEO needs. Which strategy?
A) SSG
B) ISR
C) CSR *
D) None; it cannot be done
Why: Per-user data cannot be built in advance; with no SEO need, the browser can fetch and draw it.
---
Q: A blog post that is edited a few times a month and needs SEO. Best fit?
A) SSR on every request
B) SSG or ISR *
C) CSR
D) A WebSocket
Why: Everyone sees the same HTML and it rarely changes, so build it once and serve it from a CDN.
---
Q: What does an ISR cache return for a request after the page has expired?
A) It waits for the rebuild, then returns the new page
B) The old page immediately, while one rebuild starts in the background *
C) An error
D) A redirect
Why: Stale-while-revalidate: nobody waits for the rebuild.
---
Q: Why can an SSR page feel broken even though it paints early?
A) The server is slow
B) Until hydration finishes, the visible page ignores clicks *
C) HTML cannot contain buttons
D) CSS blocks rendering
Why: The HTML shows up first; the JavaScript that makes it interactive arrives later.
```

## Recap

- **CSR** builds in the browser (late paint, cheap hosting), **SSR** per request (early paint, server cost), **SSG** once at build time, **ISR** at build time and refreshed.
- Choose by **per-user or shared** and **how fast the content changes**; SEO and first paint push you toward the server.
- **Hydration** is the cost of server rendering: visible but not interactive yet.
- **ISR**: serve stale at once, **one** background rebuild, keep the old page if it fails, **invalidate** on demand.
- **SSG builds**: limit concurrency, collect errors, build each page once.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: choose a strategy | Two questions and a short `if` chain |
| Estimate timings | Adding up phases differently per strategy |
| Build a static site | Filling `:params` in a pattern, a worker pool with a concurrency limit |
| An ISR cache | A clock, in-flight promises, stale-while-revalidate, invalidation |
| Tests for an ISR cache | A fake clock, a controllable render, call counts |

%% exercise rdl-guided-strategy | Guided: choose a strategy | 1 | js | js | chooseStrategy | 8 | guided
Implement `chooseStrategy({ perUser, seo, updatesPerDay })`:

- If the page is **per user**: `'SSR'` when `seo` is true, else `'CSR'`.
- Otherwise (the same for everyone): `'SSG'` when `updatesPerDay` is `1` or less, else `'ISR'`.

```js
chooseStrategy({ perUser: false, seo: true, updatesPerDay: 0 }); // 'SSG'
chooseStrategy({ perUser: true, seo: false });                   // 'CSR'
```

%% worked
**A similar problem, solved: `chooseStorage({ secret, large })`** — a decision from two questions, answered most-specific first.

```js
function chooseStorage({ secret, large }) {
  if (secret) return large ? 'encrypted-blob' : 'secret-manager';   // ① the most important question first
  return large ? 'object-store' : 'database';                        // ② then the other question
}
```

Write the questions in the order that **changes the answer most**: here, whether the page is per user decides everything else.

%% explain
- **Per user** is the first question.
- **SEO** matters only for per-user pages in this simplified rule.
- **Update rate** splits SSG from ISR.

%% nudge
- Which question do you ask first?
- What counts as "changes rarely" in the rule?

%% starter
```js
export function chooseStrategy({ perUser, seo, updatesPerDay }) {
  return 'CSR';
}
```

%% tests
```js
describe('chooseStrategy', () => {
  it('uses SSR for per-user pages that need SEO', () => {
    expect(chooseStrategy({ perUser: true, seo: true, updatesPerDay: 100 })).toBe('SSR');
  });
  it('uses CSR for per-user pages without SEO', () => {
    expect(chooseStrategy({ perUser: true, seo: false })).toBe('CSR');
    expect(chooseStrategy({ perUser: true, updatesPerDay: 0 })).toBe('CSR');
  });
  it('uses SSG for shared pages that rarely change', () => {
    expect(chooseStrategy({ perUser: false, seo: true, updatesPerDay: 0 })).toBe('SSG');
    expect(chooseStrategy({ perUser: false, seo: false, updatesPerDay: 1 })).toBe('SSG');
  });
  it('uses ISR for shared pages that change more often', () => {
    expect(chooseStrategy({ perUser: false, seo: true, updatesPerDay: 2 })).toBe('ISR');
    expect(chooseStrategy({ perUser: false, seo: false, updatesPerDay: 500 })).toBe('ISR');
  });
  it('ignores updatesPerDay for per-user pages', () => {
    expect(chooseStrategy({ perUser: true, seo: true, updatesPerDay: 0 })).toBe('SSR');
  });
});
```

%% hints
- `if (perUser) return seo ? 'SSR' : 'CSR';`
- `return updatesPerDay <= 1 ? 'SSG' : 'ISR';`

%% solution
```js
export function chooseStrategy({ perUser, seo, updatesPerDay }) {
  if (perUser) return seo ? 'SSR' : 'CSR';
  return updatesPerDay <= 1 ? 'SSG' : 'ISR';
}
```

%% exercise rdl-timings | Estimate the timings | 2 | js | js | estimateTimings | 16
`estimateTimings(strategy, p)` models a cold page load. `p` has `cdnMs` (default `50`: time to get a static file), `serverMs`, `dataMs`, `jsMs` (download and run the bundle), `renderMs` (client render) and `hydrateMs`, all defaulting to `0` except `cdnMs`. It returns `{ ttfb, fcp, interactive }` (milliseconds):

- **CSR**: `ttfb = cdnMs`; `fcp = ttfb + jsMs + dataMs + renderMs`; `interactive = fcp`.
- **SSR**: `ttfb = cdnMs + serverMs + dataMs`; `fcp = ttfb`; `interactive = fcp + jsMs + hydrateMs`.
- **SSG** and **ISR** (a cache hit): `ttfb = cdnMs`; `fcp = ttfb`; `interactive = fcp + jsMs + hydrateMs`.
- Any other strategy throws `Error('unknown strategy: ' + strategy)`.

```js
estimateTimings('SSR', { serverMs: 200, dataMs: 100, jsMs: 300, hydrateMs: 100 });
// { ttfb: 350, fcp: 350, interactive: 750 }
```

%% worked
**A similar problem, solved: `estimateDelivery(mode, p)`** — one function, different formulas per mode, with defaults.

```js
function estimateDelivery(mode, { cdn = 50, build = 0, ship = 0 } = {}) {
  if (mode === 'pickup') return { ready: cdn + build, arrives: cdn + build };   // ① each mode adds up different phases
  if (mode === 'courier') return { ready: cdn + build, arrives: cdn + build + ship };
  throw new Error('unknown mode: ' + mode);                                      // ② unknown input is an error, not a guess
}
```

The **same inputs** appear in every formula; what changes is **which ones are added where**. That is exactly what separates the strategies: SSR moves the data fetch **before** the first byte, CSR moves it **after** the JavaScript.

%% explain
- **Defaults** with destructuring.
- **One branch per strategy**; ISR shares the SSG formula.
- **Throw** for unknown strategies.

%% nudge
- Which phases happen before the first byte in SSR but after it in CSR?
- What is `interactive` for CSR?

%% starter
```js
export function estimateTimings(strategy, p = {}) {
  return { ttfb: 0, fcp: 0, interactive: 0 };
}
```

%% tests
```js
describe('estimateTimings', () => {
  const p = { serverMs: 200, dataMs: 100, jsMs: 300, renderMs: 50, hydrateMs: 100 };
  it('models CSR', () => {
    expect(estimateTimings('CSR', p)).toEqual({ ttfb: 50, fcp: 500, interactive: 500 });
  });
  it('models SSR', () => {
    expect(estimateTimings('SSR', p)).toEqual({ ttfb: 350, fcp: 350, interactive: 750 });
  });
  it('models SSG and ISR the same way', () => {
    expect(estimateTimings('SSG', p)).toEqual({ ttfb: 50, fcp: 50, interactive: 450 });
    expect(estimateTimings('ISR', p)).toEqual({ ttfb: 50, fcp: 50, interactive: 450 });
  });
  it('defaults every field but the CDN time to zero', () => {
    expect(estimateTimings('CSR')).toEqual({ ttfb: 50, fcp: 50, interactive: 50 });
    expect(estimateTimings('SSR', {})).toEqual({ ttfb: 50, fcp: 50, interactive: 50 });
  });
  it('uses a custom CDN time', () => {
    expect(estimateTimings('SSG', { cdnMs: 20, jsMs: 100 })).toEqual({ ttfb: 20, fcp: 20, interactive: 120 });
  });
  it('shows the trade-offs', () => {
    expect(estimateTimings('SSR', p).fcp).toBeLessThan(estimateTimings('CSR', p).fcp);
    expect(estimateTimings('SSR', p).interactive).toBeGreaterThan(estimateTimings('SSR', p).fcp);
    expect(estimateTimings('SSG', p).fcp).toBeLessThan(estimateTimings('SSR', p).fcp);
  });
  it('rejects unknown strategies', () => {
    expect(() => estimateTimings('PPR', p)).toThrow('unknown strategy: PPR');
  });
});
```

%% hints
- `const { cdnMs = 50, serverMs = 0, dataMs = 0, jsMs = 0, renderMs = 0, hydrateMs = 0 } = p;`
- SSG and ISR can share a `case`.

%% solution
```js
export function estimateTimings(strategy, p = {}) {
  const { cdnMs = 50, serverMs = 0, dataMs = 0, jsMs = 0, renderMs = 0, hydrateMs = 0 } = p;
  if (strategy === 'CSR') {
    const fcp = cdnMs + jsMs + dataMs + renderMs;
    return { ttfb: cdnMs, fcp, interactive: fcp };
  }
  if (strategy === 'SSR') {
    const ttfb = cdnMs + serverMs + dataMs;
    return { ttfb, fcp: ttfb, interactive: ttfb + jsMs + hydrateMs };
  }
  if (strategy === 'SSG' || strategy === 'ISR') {
    return { ttfb: cdnMs, fcp: cdnMs, interactive: cdnMs + jsMs + hydrateMs };
  }
  throw new Error('unknown strategy: ' + strategy);
}
```

%% exercise rdl-build-site | Build a static site | 4 | js | js | buildSite | 40
`buildSite(routes, { concurrency = 2 } = {})` (async) renders every page of a static site.

A route is `{ pattern, params, render }`: `pattern` like `'/blog/:slug'`; `params` (optional, async or sync) returns an array of param objects (`[{ slug: 'a' }, { slug: 'b' }]`); `render(params)` returns the page HTML (sync or async).

- A route **without** `params` is one page, rendered with `{}`, at path `pattern`.
- A route **with** `params` has one page per param object. The path is the pattern with every `:name` replaced by `encodeURIComponent(String(params[name]))`. A missing param makes that page an error `Error('missing param: name')` (the path in the error is the **pattern**).
- All `params()` calls run first, **one after another in route order**. If one throws, that route is one error `{ path: pattern, error }` and renders nothing.
- Then every render runs with **at most `concurrency` in flight** at any moment.
- Return `{ pages, errors }`: `pages` maps path to HTML, with keys in **task order** (route order, then params order), whatever order the renders finished in. `errors` is a list of `{ path, error }` in the same task order. A failing render does **not** stop the others.

```js
const { pages } = await buildSite([
  { pattern: '/', render: () => '<h1>Home</h1>' },
  { pattern: '/blog/:slug', params: () => [{ slug: 'a' }, { slug: 'b' }], render: ({ slug }) => `<h1>${slug}</h1>` },
]);
// pages: { '/': '<h1>Home</h1>', '/blog/a': '<h1>a</h1>', '/blog/b': '<h1>b</h1>' }
```

%% worked
**A similar problem, solved: `runLimited(tasks, limit)`** — a **worker pool**: a few workers each pull the next task from a shared counter.

```js
async function runLimited(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;                                   // ① claim a task synchronously: no two workers get the same one
      try { results[i] = { value: await tasks[i]() }; }
      catch (error) { results[i] = { error }; }           // ② a failure is a result, not a crash
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));   // ③ `limit` workers, no more
  return results;                                         // ④ filled by INDEX, so order is stable
}
```

Writing results **by index** is what keeps the output order independent of which render finishes first.

%% explain
- **Task list** first (path plus a function), then a **pool**.
- **Results by index**, assembled at the end.
- **Errors** are collected, never thrown.

%% nudge
- Why must claiming the next task (`next++`) happen before any `await`?
- Where do you build the `pages` object so its key order is stable?

%% starter
```js
export async function buildSite(routes, { concurrency = 2 } = {}) {
  return { pages: {}, errors: [] };
}
```

%% tests
```js
describe('buildSite', () => {
  it('renders static and parameterised routes', async () => {
    const { pages, errors } = await buildSite([
      { pattern: '/', render: () => '<h1>Home</h1>' },
      { pattern: '/blog/:slug', params: () => [{ slug: 'a' }, { slug: 'b' }], render: ({ slug }) => `<h1>${slug}</h1>` },
    ]);
    expect(pages).toEqual({ '/': '<h1>Home</h1>', '/blog/a': '<h1>a</h1>', '/blog/b': '<h1>b</h1>' });
    expect(errors).toEqual([]);
  });
  it('passes params to render and supports async params and render', async () => {
    const render = jest.fn(async ({ id }) => 'p' + id);
    const { pages } = await buildSite([{ pattern: '/p/:id', params: async () => [{ id: 1 }, { id: 2 }], render }]);
    expect(render).toHaveBeenCalledWith({ id: 1 });
    expect(pages).toEqual({ '/p/1': 'p1', '/p/2': 'p2' });
  });
  it('renders a static route with an empty params object', async () => {
    const render = jest.fn(() => 'x');
    await buildSite([{ pattern: '/about', render }]);
    expect(render).toHaveBeenCalledWith({});
  });
  it('encodes param values and fills several params', async () => {
    const { pages } = await buildSite([
      { pattern: '/tags/:tag/page/:n', params: () => [{ tag: 'a b/c', n: 2 }], render: () => 'ok' },
    ]);
    expect(Object.keys(pages)).toEqual(['/tags/a%20b%2Fc/page/2']);
  });
  it('reports a missing param against the pattern', async () => {
    const { pages, errors } = await buildSite([
      { pattern: '/blog/:slug', params: () => [{ slug: 'a' }, {}], render: () => 'ok' },
    ]);
    expect(Object.keys(pages)).toEqual(['/blog/a']);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('/blog/:slug');
    expect(errors[0].error.message).toBe('missing param: slug');
  });
  it('collects render failures without stopping the build', async () => {
    const boom = new Error('boom');
    const { pages, errors } = await buildSite([
      { pattern: '/a', render: () => 'a' },
      { pattern: '/b', render: () => { throw boom; } },
      { pattern: '/c', render: async () => 'c' },
    ]);
    expect(pages).toEqual({ '/a': 'a', '/c': 'c' });
    expect(errors).toEqual([{ path: '/b', error: boom }]);
  });
  it('turns a failing params function into one error for the route', async () => {
    const boom = new Error('no db');
    const render = jest.fn(() => 'x');
    const { pages, errors } = await buildSite([
      { pattern: '/blog/:slug', params: async () => { throw boom; }, render },
      { pattern: '/', render: () => 'home' },
    ]);
    expect(errors).toEqual([{ path: '/blog/:slug', error: boom }]);
    expect(pages).toEqual({ '/': 'home' });
    expect(render).not.toHaveBeenCalled();
  });
  it('calls params one after another, in route order, before rendering', async () => {
    const log = [];
    const routes = [
      { pattern: '/a/:x', params: async () => { log.push('params a start'); await Promise.resolve(); log.push('params a end'); return [{ x: 1 }]; }, render: () => { log.push('render a'); return 'a'; } },
      { pattern: '/b/:x', params: async () => { log.push('params b'); return [{ x: 1 }]; }, render: () => { log.push('render b'); return 'b'; } },
    ];
    await buildSite(routes);
    expect(log.slice(0, 3)).toEqual(['params a start', 'params a end', 'params b']);
    expect(log.slice(3).sort()).toEqual(['render a', 'render b']);
  });
  it('never has more renders in flight than the concurrency limit', async () => {
    let inFlight = 0;
    let peak = 0;
    const render = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return 'x';
    };
    const params = () => Array.from({ length: 10 }, (_, i) => ({ id: i }));
    await buildSite([{ pattern: '/p/:id', params, render }], { concurrency: 3 });
    expect(peak).toBe(3);
  });
  it('defaults to a concurrency of two', async () => {
    let inFlight = 0;
    let peak = 0;
    const render = async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return 'x';
    };
    await buildSite([{ pattern: '/p/:id', params: () => [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], render }]);
    expect(peak).toBe(2);
  });
  it('keeps task order even when renders finish out of order', async () => {
    const delays = { a: 30, b: 1, c: 15 };
    const { pages } = await buildSite(
      [{ pattern: '/p/:id', params: () => [{ id: 'a' }, { id: 'b' }, { id: 'c' }], render: async ({ id }) => { await new Promise((r) => setTimeout(r, delays[id])); return id; } }],
      { concurrency: 3 },
    );
    expect(Object.keys(pages)).toEqual(['/p/a', '/p/b', '/p/c']);
  });
  it('handles no routes', async () => {
    expect(await buildSite([])).toEqual({ pages: {}, errors: [] });
  });
});
```

%% hints
- Build a `tasks` list of `{ path, run }` first (an invalid pattern fill becomes a task whose `run` throws).
- Use the worker-pool shape from the worked example and fill `results[i]`.
- At the end: loop `results`, put successes in `pages`, failures in `errors`.

%% solution
```js
export async function buildSite(routes, { concurrency = 2 } = {}) {
  const tasks = [];
  const errors = [];

  for (const route of routes) {
    if (!route.params) {
      tasks.push({ path: route.pattern, run: () => route.render({}) });
      continue;
    }
    let list;
    try {
      list = await route.params();
    } catch (error) {
      tasks.push({ path: route.pattern, run: () => { throw error; } });
      continue;
    }
    for (const params of list) {
      let path = route.pattern;
      let failure = null;
      try {
        path = route.pattern.replace(/:([A-Za-z_]\w*)/g, (_, name) => {
          if (!(name in params)) throw new Error('missing param: ' + name);
          return encodeURIComponent(String(params[name]));
        });
      } catch (error) {
        path = route.pattern;
        failure = error;
      }
      tasks.push({ path, run: failure ? () => { throw failure; } : () => route.render(params) });
    }
  }

  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { html: await tasks[i].run() };
      } catch (error) {
        results[i] = { error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));

  const pages = {};
  tasks.forEach((task, i) => {
    if ('error' in results[i]) errors.push({ path: task.path, error: results[i].error });
    else pages[task.path] = results[i].html;
  });
  return { pages, errors };
}
```

%% exercise rdl-isr-cache | An ISR cache | 4 | js | js | createIsrCache | 45
`createIsrCache({ render, revalidateMs, now })` returns `{ get(path), invalidate(path) }`. `render(path)` is async and returns HTML; `now()` returns milliseconds.

`get(path)` (async) resolves `{ html, status }`:

- **`'MISS'`**: nothing cached for the path. Render it (calling `render` **synchronously inside `get`**), store `{ html, generatedAt: now() }` when the render finishes, and return it. Concurrent misses for the same path **share one render** and all report `'MISS'`. If the render fails, `get` rejects, nothing is stored, and the next `get` renders again.
- **`'HIT'`**: cached and `now() - generatedAt < revalidateMs`: return the stored HTML without rendering.
- **`'STALE'`**: cached but `now() - generatedAt >= revalidateMs`: return the **old** HTML **immediately** (do not wait) and start **one** background render (none if one is already running for that path). When it finishes, store the new HTML with `generatedAt` = the time it **finished**. If it fails, keep the old page and swallow the error (the next stale `get` tries again).

`invalidate(path)` drops the cached page so the next `get` is a `'MISS'`, and **discards the result of any render already running** for that path (it must not be stored). Paths are independent.

```js
const cache = createIsrCache({ render: async (p) => '<h1>' + p + '</h1>', revalidateMs: 1000, now: () => Date.now() });
await cache.get('/a'); // { html: '<h1>/a</h1>', status: 'MISS' }
await cache.get('/a'); // { html: '<h1>/a</h1>', status: 'HIT' }
```

%% worked
**A similar problem, solved: `createLazyValue(load)`** — start one load, let everyone share it, forget it on failure.

```js
function createLazyValue(load) {
  let value;
  let loaded = false;
  let inflight = null;
  return {
    async get() {
      if (loaded) return value;
      if (!inflight) {
        inflight = new Promise((resolve) => resolve(load()))        // ① started once, synchronously
          .then((v) => { value = v; loaded = true; return v; })
          .finally(() => { inflight = null; });                      // ② cleared on success AND failure
      }
      return inflight;                                               // ③ every concurrent caller gets the same promise
    },
  };
}
```

The cache adds **time** (fresh, then stale), a **background** path that nobody awaits, and a **generation** idea for `invalidate`: remember which "version" a render started under and drop its result if the page was invalidated meanwhile.

%% explain
- **State per path**: `entries`, `inflight`, a `generation` counter.
- **Start a render** once, store only if the generation still matches.
- **STALE** returns the old entry and starts a swallowed background render.

%% nudge
- What stops a hundred stale requests from starting a hundred renders?
- How does an invalidated page avoid being overwritten by an old render?

%% starter
```js
export function createIsrCache({ render, revalidateMs, now }) {
  return {
    async get(path) {
      return { html: await render(path), status: 'MISS' };
    },
    invalidate(path) {},
  };
}
```

%% tests
```js
describe('createIsrCache', () => {
  const setup = (renderImpl) => {
    let t = 0;
    const calls = [];
    const render = jest.fn((path) => {
      calls.push(path);
      return renderImpl ? renderImpl(path, calls.length) : Promise.resolve('v' + calls.length + ' ' + path);
    });
    const cache = createIsrCache({ render, revalidateMs: 1000, now: () => t });
    return { cache, render, at: (x) => { t = x; } };
  };
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

  it('renders on a miss and serves a hit afterwards', async () => {
    const { cache, render } = setup();
    expect(await cache.get('/a')).toEqual({ html: 'v1 /a', status: 'MISS' });
    expect(await cache.get('/a')).toEqual({ html: 'v1 /a', status: 'HIT' });
    expect(render).toHaveBeenCalledTimes(1);
  });
  it('calls render synchronously on a miss', () => {
    const { cache, render } = setup();
    cache.get('/a');
    expect(render).toHaveBeenCalledTimes(1);
  });
  it('stays fresh until exactly revalidateMs', async () => {
    const { cache, at } = setup();
    await cache.get('/a');
    at(999);
    expect((await cache.get('/a')).status).toBe('HIT');
    at(1000);
    expect((await cache.get('/a')).status).toBe('STALE');
  });
  it('serves the old page immediately while one background render runs', async () => {
    const d = deferred();
    const { cache, render, at } = setup((path, n) => (n === 1 ? Promise.resolve('old') : d.promise));
    await cache.get('/a');
    at(1000);
    expect(await cache.get('/a')).toEqual({ html: 'old', status: 'STALE' });
    expect(await cache.get('/a')).toEqual({ html: 'old', status: 'STALE' });
    expect(render).toHaveBeenCalledTimes(2);
    d.resolve('new');
    await flush();
    expect(await cache.get('/a')).toEqual({ html: 'new', status: 'HIT' });
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('restarts the freshness window when the re-render finishes', async () => {
    const d = deferred();
    const { cache, at } = setup((path, n) => (n === 1 ? Promise.resolve('old') : d.promise));
    await cache.get('/a');
    at(1000);
    await cache.get('/a');
    at(1200);
    d.resolve('new');
    await flush();
    at(2199);
    expect((await cache.get('/a')).status).toBe('HIT');
    at(2200);
    expect((await cache.get('/a')).status).toBe('STALE');
  });
  it('shares one render between concurrent misses', async () => {
    const d = deferred();
    const { cache, render } = setup(() => d.promise);
    const first = cache.get('/a');
    const second = cache.get('/a');
    d.resolve('shared');
    expect(await first).toEqual({ html: 'shared', status: 'MISS' });
    expect(await second).toEqual({ html: 'shared', status: 'MISS' });
    expect(render).toHaveBeenCalledTimes(1);
  });
  it('rejects a failed first render, stores nothing and retries next time', async () => {
    let fail = true;
    const { cache, render } = setup(() => (fail ? Promise.reject(new Error('db down')) : Promise.resolve('ok')));
    await expect(cache.get('/a')).rejects.toThrow('db down');
    fail = false;
    expect(await cache.get('/a')).toEqual({ html: 'ok', status: 'MISS' });
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('keeps the old page when a background render fails, and retries', async () => {
    let fail = false;
    const { cache, render, at } = setup((path, n) => (n > 1 && fail ? Promise.reject(new Error('x')) : Promise.resolve('v' + n)));
    await cache.get('/a');
    at(1000);
    fail = true;
    expect(await cache.get('/a')).toEqual({ html: 'v1', status: 'STALE' });
    await flush();
    fail = false;
    expect(await cache.get('/a')).toEqual({ html: 'v1', status: 'STALE' });
    await flush();
    expect(render).toHaveBeenCalledTimes(3);
    expect(await cache.get('/a')).toEqual({ html: 'v3', status: 'HIT' });
  });
  it('keeps paths independent', async () => {
    const { cache, render } = setup();
    await cache.get('/a');
    await cache.get('/b');
    expect((await cache.get('/a')).status).toBe('HIT');
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('invalidates a page so the next request is a miss', async () => {
    const { cache } = setup();
    await cache.get('/a');
    cache.invalidate('/a');
    expect(await cache.get('/a')).toEqual({ html: 'v2 /a', status: 'MISS' });
    cache.invalidate('/never-seen');
  });
  it('discards a background render that started before the invalidation', async () => {
    const stale = deferred();
    const fresh = deferred();
    const { cache, at } = setup((path, n) => (n === 1 ? Promise.resolve('v1') : n === 2 ? stale.promise : fresh.promise));
    await cache.get('/a');
    at(1000);
    await cache.get('/a');
    cache.invalidate('/a');
    const next = cache.get('/a');
    stale.resolve('old-background-result');
    await flush();
    fresh.resolve('fresh');
    expect(await next).toEqual({ html: 'fresh', status: 'MISS' });
    expect(await cache.get('/a')).toEqual({ html: 'fresh', status: 'HIT' });
  });
});
```

%% hints
- Three maps: `entries` (path → `{ html, generatedAt }`), `inflight` (path → promise), `generation` (path → number).
- `start(path)`: read the generation, `new Promise((r) => r(render(path)))`, on success store only if the generation is unchanged, `.finally` removes it from `inflight`.
- `invalidate`: delete the entry and the in-flight promise, bump the generation.
- STALE: `if (!inflight.has(path)) start(path).catch(() => {});`

%% solution
```js
export function createIsrCache({ render, revalidateMs, now }) {
  const entries = new Map();
  const inflight = new Map();
  const generation = new Map();

  const start = (path) => {
    const gen = generation.get(path) ?? 0;
    const promise = new Promise((resolve) => resolve(render(path)))
      .then((html) => {
        if ((generation.get(path) ?? 0) === gen) entries.set(path, { html, generatedAt: now() });
        return html;
      })
      .finally(() => {
        if (inflight.get(path) === promise) inflight.delete(path);
      });
    inflight.set(path, promise);
    return promise;
  };

  return {
    async get(path) {
      const entry = entries.get(path);
      if (!entry) {
        const html = await (inflight.get(path) ?? start(path));
        return { html, status: 'MISS' };
      }
      if (now() - entry.generatedAt >= revalidateMs) {
        if (!inflight.has(path)) start(path).catch(() => {});
        return { html: entry.html, status: 'STALE' };
      }
      return { html: entry.html, status: 'HIT' };
    },
    invalidate(path) {
      entries.delete(path);
      inflight.delete(path);
      generation.set(path, (generation.get(path) ?? 0) + 1);
    },
  };
}
```

%% exercise rdl-check-isr | Tests for an ISR cache | 4 | js | js | checkIsrCache | 42
`createIsrCache({ render, revalidateMs, now })` returns `{ get(path), invalidate(path) }` resolving `{ html, status }` with `'MISS'`, `'HIT'` or `'STALE'` as in the ISR cache exercise: a stale request answers with the old page **immediately** and starts **one** background render; concurrent first requests share one render; a failed background render keeps the old page; `invalidate` makes the next request a miss. You are given `checkIsrCache(createIsrCache)` (async). Write a check that passes for a correct cache and **fails** for one that: **renders on every request**, **waits for the re-render before answering a stale request**, **starts a re-render for every stale request**, **never revalidates**, **drops the cached page when a re-render fails**, **renders once per concurrent first request**, **keeps serving an invalidated page**.

```js
let t = 0;
const render = jest.fn(async (p) => 'page ' + p);
const cache = createIsrCache({ render, revalidateMs: 1000, now: () => t });
expect((await cache.get('/a')).status).toBe('MISS');
```

%% worked
**A similar problem, solved: `checkMemo(createMemo)`** — count how often the **expensive function** runs, and probe the **boundary** of the expiry.

```js
export async function checkMemo(createMemo) {                // createMemo(fn, ttlMs, now)
  let t = 0;
  const fn = jest.fn(async (k) => k + '!');
  const memo = createMemo(fn, 1000, () => t);
  await memo('a');
  await memo('a');
  expect(fn).toHaveBeenCalledTimes(1);                       // ① cached: the function ran once
  t = 999;
  await memo('a');
  expect(fn).toHaveBeenCalledTimes(1);                       // ② one tick before expiry: still cached
  t = 1000;
  await memo('a');
  expect(fn).toHaveBeenCalledTimes(2);                       // ③ exactly at expiry: recomputed
}
```

For an ISR cache add a **deferred** render (a promise you resolve by hand): while it is unresolved, a stale `get` must **still answer**, and a second stale `get` must **not** call `render` again.

%% explain
- **Call counts** on a `jest.fn` render.
- **Deferred renders** to prove "does not wait" and "only one".
- **Boundary times** (`999`, `1000`) and a failing render.

%% nudge
- How do you prove a stale request did not wait for the re-render?
- Which assertion distinguishes "one background render" from "one per request"?

%% starter
```js
export async function checkIsrCache(createIsrCache) {
  let t = 0;
  const render = jest.fn(async (p) => 'page ' + p);
  const cache = createIsrCache({ render, revalidateMs: 1000, now: () => t });
  expect((await cache.get('/a')).status).toBe('MISS');
  // your assertions: hit, boundary, stale, one rebuild, failure, concurrency, invalidate
}
```

%% tests
```js
const make = (f = {}) => ({ render, revalidateMs, now }) => {
  const entries = new Map();
  const inflight = new Map();
  const generation = new Map();
  const start = (path) => {
    const gen = generation.get(path) ?? 0;
    const promise = new Promise((resolve) => resolve(render(path)))
      .then((html) => {
        if (f.keepInvalidated || (generation.get(path) ?? 0) === gen) entries.set(path, { html, generatedAt: now() });
        return html;
      }, (error) => {
        if (f.dropOnFailure) entries.delete(path);
        throw error;
      })
      .finally(() => { if (inflight.get(path) === promise) inflight.delete(path); });
    inflight.set(path, promise);
    return promise;
  };
  return {
    async get(path) {
      if (f.noCache) return { html: await render(path), status: 'MISS' };
      const entry = entries.get(path);
      if (!entry) {
        const html = await (f.noShare ? start(path) : (inflight.get(path) ?? start(path)));
        return { html, status: 'MISS' };
      }
      if (!f.neverRevalidate && now() - entry.generatedAt >= revalidateMs) {
        if (f.blockOnStale) {
          const html = await start(path).catch(() => entry.html);
          return { html, status: 'STALE' };
        }
        if (f.rebuildEveryTime || !inflight.has(path)) start(path).catch(() => {});
        return { html: entry.html, status: 'STALE' };
      }
      return { html: entry.html, status: 'HIT' };
    },
    invalidate(path) {
      if (f.keepInvalidated) return;
      entries.delete(path);
      inflight.delete(path);
      generation.set(path, (generation.get(path) ?? 0) + 1);
    },
  };
};

const correct = make();
const mutants = {
  'renders on every request': make({ noCache: true }),
  'waits for the re-render before answering a stale request': make({ blockOnStale: true }),
  'starts a re-render for every stale request': make({ rebuildEveryTime: true }),
  'never revalidates': make({ neverRevalidate: true }),
  'drops the cached page when a re-render fails': make({ dropOnFailure: true }),
  'renders once per concurrent first request': make({ noShare: true }),
  'keeps serving an invalidated page': make({ keepInvalidated: true }),
};

describe('your checkIsrCache', () => {
  it('passes on a correct cache', async () => {
    await checkIsrCache(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a cache that ${name}`, async () => {
      let caught = false;
      try { await checkIsrCache(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- A `deferred()` helper gives you a promise and its `resolve`; make `render` return it for the second call.
- Fresh at `999`, stale at `1000`.
- While the deferred render is pending, race the stale `get` against a short `flush()` so a cache that blocks shows up as `'blocked'` instead of hanging; a second stale `get` must leave `render` at 2 calls.
- A failing background render: make `render` reject, then expect the old HTML to still be served.
- `invalidate('/a')` then `get('/a')` must be a `'MISS'`.

%% solution
```js
export async function checkIsrCache(createIsrCache) {
  let t = 0;
  let mode = 'ok';
  let pending = null;
  let calls = 0;
  const render = jest.fn((path) => {
    calls++;
    if (mode === 'fail' && calls > 1) return Promise.reject(new Error('down'));
    if (mode === 'hang') return pending;
    return Promise.resolve('v' + calls);
  });
  const cache = createIsrCache({ render, revalidateMs: 1000, now: () => t });
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

  expect(await cache.get('/a')).toEqual({ html: 'v1', status: 'MISS' });
  expect(await cache.get('/a')).toEqual({ html: 'v1', status: 'HIT' });
  expect(render).toHaveBeenCalledTimes(1);

  t = 999;
  expect((await cache.get('/a')).status).toBe('HIT');
  t = 1000;
  let resolvePending;
  pending = new Promise((resolve) => { resolvePending = resolve; });
  mode = 'hang';
  const answered = await Promise.race([cache.get('/a'), flush().then(() => 'blocked')]);
  expect(answered).toEqual({ html: 'v1', status: 'STALE' });
  expect(await cache.get('/a')).toEqual({ html: 'v1', status: 'STALE' });
  expect(render).toHaveBeenCalledTimes(2);
  resolvePending('v2');
  await flush();
  expect(await cache.get('/a')).toEqual({ html: 'v2', status: 'HIT' });

  mode = 'fail';
  t = 5000;
  expect(await cache.get('/a')).toEqual({ html: 'v2', status: 'STALE' });
  await flush();
  expect(await cache.get('/a')).toEqual({ html: 'v2', status: 'STALE' });

  const before = render.mock.calls.length;
  mode = 'ok';
  const [x, y] = await Promise.all([cache.get('/b'), cache.get('/b')]);
  expect([x.status, y.status]).toEqual(['MISS', 'MISS']);
  expect(render.mock.calls.length).toBe(before + 1);

  cache.invalidate('/b');
  expect((await cache.get('/b')).status).toBe('MISS');
}
```
