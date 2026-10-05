---
id: rd-assets-critical-path
track: rd
title: Images, fonts and the critical rendering path
summary: Why the largest image and the web font decide how fast a page feels, how browsers pick responsive image candidates, how request chains (waterfalls) delay rendering, and how preconnect, preload and prefetch hints are planned without overdoing it.
---

## The idea in one sentence

A page is fast when the browser can start the **right requests as early as possible**: the work is finding the **chain of dependent requests** that delays the first meaningful paint and **shortening or removing it**.

> **Analogy** A relay race. Each runner can only start when the previous one hands over the baton, so the race takes as long as the **longest relay team**, no matter how many runners are on other teams. To win, shorten the longest team: start a runner early, or cut a leg.

*(In Next.js: `next/image` (responsive sizes, lazy loading, no layout shift), `next/font` (self-hosted, preloaded, `size-adjust`), `next/script` strategies. You will build the underlying calculations.)*

## Images: the usual LCP

The **largest contentful paint** element is most often an image, so image handling is where most of the time is won or lost.

![Responsive images](fig:rd-images "The browser multiplies slot width by pixel ratio and takes the smallest file that is wide enough.")

- **Right format**: AVIF, then WebP, then JPEG as the fallback (`<picture>` or content negotiation).
- **Right size**: `srcset` lists candidate widths; `sizes` says how wide the slot will be. The browser picks the smallest candidate that covers `slot width × device pixel ratio`.
- **Reserve space**: `width` and `height` (or `aspect-ratio`) so nothing shifts when the image loads.
- **Right priority**: lazy-load images **below the fold** (`loading="lazy"`), but **never** the LCP image; give that one `fetchpriority="high"` and preload it if the HTML does not reveal it early.

```js try predict
const widths = [320, 640, 1280];
const pick = (cssWidth, dpr) => widths.find((w) => w >= cssWidth * dpr) ?? widths[widths.length - 1];

console.log(pick(300, 1), pick(300, 2), pick(500, 3), pick(2000, 1));
```

## Fonts

Web fonts block text. Three habits help: **`font-display: swap`** (show fallback text first), **subset and compress** (WOFF2, only the characters you need, a variable font instead of five weights), and **preload** the one or two fonts used above the fold, with **`crossorigin`** (fonts are always fetched in CORS mode, so without it the preloaded copy is **not reused** and the file downloads twice). Match the fallback's metrics (`size-adjust`) so the swap does not shift the layout.

## The critical path

![Waterfall](fig:rd-critical "Chains are expensive; parallel requests are free.")

Many resources are only **discovered after another one arrives**: the HTML reveals the stylesheet, the stylesheet reveals the font, a script reveals an API call. Each link is a full round trip. The **critical path** is the longest such chain; it, not the number of requests, decides when content can appear.

```stepper Why the text is late
code:
  GET /            → html          (parser finds <link rel=stylesheet>)
  GET /app.css     → css           (css contains @font-face)
  GET /inter.woff2 → font          (only now discovered)
  paint text       → visible
---
line: 1
say: The HTML arrives. The browser starts the stylesheet request as soon as the parser finds the `<link>`.
phase: html
---
line: 2
say: The CSS arrives and the browser **now** learns that text needs `inter.woff2`. Until the CSS is parsed, the font is **invisible to the browser**.
phase: css
---
line: 3
say: Only now does the font request start. The chain is **three round trips** deep before styled text can show.
phase: font
---
line: 4
say: A `<link rel="preload" as="font" crossorigin>` in the HTML starts the font **in parallel with the CSS**, cutting a whole link out of the chain.
phase: preload fix
```

Other chain-breakers: **inline the critical CSS** (a few KB for the first screen), load the rest later; **`defer`** scripts so they do not block parsing; **avoid `@import`** in CSS (it creates chains); load **third-party scripts** with `async` or after interaction, behind a **facade** (a static placeholder for a chat widget or video).

## Resource hints

![Hints](fig:rd-hints "A budget, not a spray.")

| Hint | Use it for | Cost if overused |
| --- | --- | --- |
| `preconnect` | a **third-party origin** you will definitely call (CDN, fonts, API) | each open connection costs CPU and battery |
| `preload` | a **critical** resource the parser finds late (hero image, key font) | competes with other critical requests |
| `prefetch` | something the **next page** will need, fetched when idle | wasted bandwidth if the guess is wrong |

## Quick check

```check
Q: A 400 CSS px wide image slot on a 2x display. Candidates: 400w, 800w, 1600w. Which is chosen?
A) 400w
B) 800w *
C) 1600w
D) All of them
Why: 400 × 2 = 800 device pixels needed; the smallest candidate that covers it is 800w.
---
Q: Why must a preloaded font have the crossorigin attribute?
A) Fonts are always fetched with CORS, so without it the preload is not reused and the file downloads twice *
B) It makes the font smaller
C) It enables caching
D) Browsers require it for images
Why: A non-CORS preload does not match the later CORS font request.
---
Q: Which image should NOT get loading="lazy"?
A) Images below the fold
B) The LCP image *
C) Thumbnails in a gallery
D) Avatars in a comment list
Why: Lazy-loading delays the very element the metric measures.
---
Q: What decides how soon the first content can render?
A) The number of requests
B) The longest chain of dependent requests (the critical path) *
C) The size of the favicon
D) The server's CPU
Why: Parallel requests overlap; dependent ones add up.
```

## Recap

- **Images**: AVIF/WebP, `srcset` + `sizes`, explicit dimensions, **lazy below the fold only**, `fetchpriority="high"` for the LCP image.
- **Fonts**: `font-display: swap`, subset WOFF2, preload with `crossorigin`, match fallback metrics.
- The **critical path** is the longest dependent chain: break links (preload, inline critical CSS, `defer`, no `@import`).
- **Hints** are a budget: `preconnect` third parties you will use, `preload` the few critical late-discovered files, `prefetch` the next page.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: best image format | Reading an `Accept` header |
| Responsive images | Sorting, `find`, string building for `srcset` and `sizes` |
| Plan the hints | Grouping by origin, priority ordering, a cap |
| Find the critical path | Memoised longest path in a dependency graph |
| Tests for a hint planner | One page that exercises every rule |

%% exercise rdl-guided-format | Guided: best image format | 1 | js | js | bestFormat | 8 | guided
Implement `bestFormat(accept)` for a request's `Accept` header string: return `'avif'` if it contains `image/avif`, else `'webp'` if it contains `image/webp`, else `'jpeg'`.

```js
bestFormat('image/avif,image/webp,*/*'); // 'avif'
bestFormat('image/png,*/*');             // 'jpeg'
```

%% worked
**A similar problem, solved: `bestCodec(accept)`** — pick the first supported option from a preference list.

```js
function bestCodec(accept) {
  const prefer = [['audio/opus', 'opus'], ['audio/aac', 'aac']];      // ① preference order, best first
  for (const [mime, name] of prefer) {
    if (accept.includes(mime)) return name;                           // ② the first one the client accepts wins
  }
  return 'mp3';                                                       // ③ a safe fallback everyone supports
}
```

The same shape handles any "best supported option" decision.

%% explain
- **Preference order**: AVIF, WebP, then JPEG.
- **`includes`** on the header string.

%% nudge
- What is returned when neither modern format is listed?

%% starter
```js
export function bestFormat(accept) {
  return 'jpeg';
}
```

%% tests
```js
describe('bestFormat', () => {
  it('prefers AVIF', () => {
    expect(bestFormat('image/avif,image/webp,image/apng,*/*;q=0.8')).toBe('avif');
  });
  it('uses WebP when AVIF is missing', () => {
    expect(bestFormat('image/webp,image/png,*/*')).toBe('webp');
  });
  it('falls back to JPEG', () => {
    expect(bestFormat('image/png,*/*')).toBe('jpeg');
    expect(bestFormat('')).toBe('jpeg');
  });
});
```

%% hints
- `if (accept.includes('image/avif')) return 'avif';`

%% solution
```js
export function bestFormat(accept) {
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return 'jpeg';
}
```

%% exercise rdl-srcset | Responsive image helpers | 3 | js | js | buildSrcset, buildSizes, pickCandidate | 28
Three helpers for responsive images.

`buildSrcset(urlFor, widths)` returns the `srcset` attribute: the **distinct** widths sorted **ascending**, each as `${urlFor(width)} ${width}w`, joined by `', '`.

`buildSizes(rules, fallback)` returns the `sizes` attribute: the rules `{ maxWidth, size }` sorted by `maxWidth` ascending, each as `(max-width: ${maxWidth}px) ${size}`, followed by the `fallback`, joined by `', '`. With no rules it is just the fallback.

`pickCandidate(widths, cssWidth, dpr)` simulates the browser: it needs `cssWidth * dpr` device pixels and chooses the **smallest** width that is **at least** that; if none is large enough it takes the **largest**; no widths gives `null`.

```js
buildSrcset((w) => `/img-${w}.jpg`, [640, 320]); // '/img-320.jpg 320w, /img-640.jpg 640w'
pickCandidate([320, 640, 1280], 300, 2);          // 640
```

%% worked
**A similar problem, solved: `buildMediaList(queries, fallback)`** — sort, format each entry, add a default last.

```js
function buildMediaList(queries, fallback) {
  const parts = [...queries]                                   // ① copy before sorting: never reorder the caller's array
    .sort((a, b) => a.max - b.max)
    .map((q) => `(max-width: ${q.max}px) ${q.value}`);
  return [...parts, fallback].join(', ');                      // ② the default always goes last
}
```

For `pickCandidate`, `sort` a **copy** of the widths numerically (`(a, b) => a - b`, because the default sort is alphabetical!) and use `find`.

%% explain
- **Copy then sort** numerically.
- **Dedupe** widths with a `Set`.
- **`find`** the first candidate that is large enough, else the last.

%% nudge
- Why must `sort` get a comparison function for numbers?
- What does `pickCandidate([])` return?

%% starter
```js
export function buildSrcset(urlFor, widths) {
  return '';
}

export function buildSizes(rules, fallback) {
  return fallback;
}

export function pickCandidate(widths, cssWidth, dpr) {
  return null;
}
```

%% tests
```js
describe('buildSrcset', () => {
  it('lists distinct widths ascending', () => {
    expect(buildSrcset((w) => `/img-${w}.jpg`, [640, 320, 640, 1280])).toBe('/img-320.jpg 320w, /img-640.jpg 640w, /img-1280.jpg 1280w');
  });
  it('sorts numerically, not alphabetically', () => {
    expect(buildSrcset((w) => 'u' + w, [100, 20, 3]).split(', ').map((s) => s.split(' ')[1])).toEqual(['3w', '20w', '100w']);
  });
  it('does not change the input', () => {
    const widths = [640, 320];
    buildSrcset((w) => 'u', widths);
    expect(widths).toEqual([640, 320]);
  });
  it('handles an empty list', () => {
    expect(buildSrcset((w) => 'u', [])).toBe('');
  });
});

describe('buildSizes', () => {
  it('sorts rules by max width and appends the fallback', () => {
    expect(buildSizes([{ maxWidth: 1000, size: '50vw' }, { maxWidth: 600, size: '100vw' }], '33vw')).toBe(
      '(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw',
    );
  });
  it('is just the fallback without rules', () => {
    expect(buildSizes([], '100vw')).toBe('100vw');
  });
  it('does not change the input', () => {
    const rules = [{ maxWidth: 9, size: 'a' }, { maxWidth: 1, size: 'b' }];
    buildSizes(rules, 'c');
    expect(rules[0].maxWidth).toBe(9);
  });
});

describe('pickCandidate', () => {
  const widths = [320, 640, 1280];
  it('picks the smallest candidate that covers the need', () => {
    expect(pickCandidate(widths, 300, 1)).toBe(320);
    expect(pickCandidate(widths, 300, 2)).toBe(640);
    expect(pickCandidate(widths, 320, 1)).toBe(320);
    expect(pickCandidate(widths, 321, 1)).toBe(640);
  });
  it('takes the largest when nothing is big enough', () => {
    expect(pickCandidate(widths, 500, 3)).toBe(1280);
    expect(pickCandidate(widths, 2000, 1)).toBe(1280);
  });
  it('works with unsorted widths', () => {
    expect(pickCandidate([1280, 320, 640], 400, 1)).toBe(640);
  });
  it('sorts numerically', () => {
    expect(pickCandidate([100, 20, 3], 10, 1)).toBe(20);
  });
  it('returns null without candidates', () => {
    expect(pickCandidate([], 300, 1)).toBeNull();
  });
});
```

%% hints
- `[...new Set(widths)].sort((a, b) => a - b)`
- `sorted.find((w) => w >= need) ?? sorted[sorted.length - 1]`; empty → `null`.

%% solution
```js
export function buildSrcset(urlFor, widths) {
  return [...new Set(widths)]
    .sort((a, b) => a - b)
    .map((w) => `${urlFor(w)} ${w}w`)
    .join(', ');
}

export function buildSizes(rules, fallback) {
  const parts = [...rules]
    .sort((a, b) => a.maxWidth - b.maxWidth)
    .map((r) => `(max-width: ${r.maxWidth}px) ${r.size}`);
  return [...parts, fallback].join(', ');
}

export function pickCandidate(widths, cssWidth, dpr) {
  if (widths.length === 0) return null;
  const sorted = [...widths].sort((a, b) => a - b);
  const need = cssWidth * dpr;
  return sorted.find((w) => w >= need) ?? sorted[sorted.length - 1];
}
```

%% exercise rdl-plan-hints | Plan the resource hints | 4 | js | js | planPreloads | 40
`planPreloads({ origin, resources, maxPreloads = 3 })` returns the list of `<link>` hints for a page. `origin` is the page's origin (like `'https://shop.example'`). Each resource is `{ url, type, critical, lcp, nextRoute }` (`url` absolute; `type` is `'script'`, `'style'`, `'font'`, `'image'` or `'fetch'`).

The result lists, **in this order**:

1. **Preconnects**: one `{ rel: 'preconnect', href: <origin>, crossorigin: true }` per **third-party** origin (different from the page origin, taken with `new URL(url).origin`) that has at least one **critical** resource that is **not** `nextRoute`, in order of first appearance. Leave `crossorigin` out when none of that origin's critical resources is a font.
2. **Preloads**: for every critical, non-`nextRoute` resource, `{ rel: 'preload', href: url, as: type }`. Fonts add `crossorigin: 'anonymous'`; an `lcp` **image** adds `fetchpriority: 'high'`. At most `maxPreloads`, chosen by priority: **LCP image first, then fonts, then everything else**, each group in input order. The output keeps that priority order.
3. **Prefetches**: for every `nextRoute` resource, `{ rel: 'prefetch', href: url, as: type }`, in input order (not capped).

Resources that are neither critical nor `nextRoute` produce nothing.

```js
planPreloads({ origin: 'https://shop.example', resources: [{ url: 'https://shop.example/hero.avif', type: 'image', critical: true, lcp: true }] });
// [{ rel: 'preload', href: 'https://shop.example/hero.avif', as: 'image', fetchpriority: 'high' }]
```

%% worked
**A similar problem, solved: `planWarmups(items, cap)`** — rank by priority group, then **cap**.

```js
function planWarmups(items, cap) {
  const rank = (item) => (item.kind === 'primary' ? 0 : item.kind === 'secondary' ? 1 : 2);   // ① lower number = more important
  return items
    .map((item, index) => ({ item, index }))                         // ② remember the input position for ties
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)  // ③ group first, input order within a group
    .slice(0, cap)                                                   // ④ the cap drops the LEAST important
    .map((x) => x.item);
}
```

`sort` is stable in modern engines, but carrying the **index** makes the tie-break explicit and safe. For the preconnect list use a `Set` (or `Map`) of origins to keep **one per origin** in first-seen order.

%% explain
- **Filter** the three kinds first.
- **Preconnect**: group critical, third-party resources by origin.
- **Preload**: rank, cap, then build the hint objects.

%% nudge
- Does a critical resource that is also `nextRoute` get a preload?
- When does a preconnect need `crossorigin`?

%% starter
```js
export function planPreloads({ origin, resources, maxPreloads = 3 }) {
  return [];
}
```

%% tests
```js
describe('planPreloads', () => {
  const origin = 'https://shop.example';
  const r = (url, type, extra = {}) => ({ url, type, ...extra });

  it('preloads a critical resource', () => {
    expect(planPreloads({ origin, resources: [r(origin + '/app.css', 'style', { critical: true })] })).toEqual([
      { rel: 'preload', href: origin + '/app.css', as: 'style' },
    ]);
  });
  it('gives the LCP image a high fetch priority', () => {
    expect(planPreloads({ origin, resources: [r(origin + '/hero.avif', 'image', { critical: true, lcp: true })] })).toEqual([
      { rel: 'preload', href: origin + '/hero.avif', as: 'image', fetchpriority: 'high' },
    ]);
  });
  it('adds crossorigin to font preloads, even on the same origin', () => {
    expect(planPreloads({ origin, resources: [r(origin + '/inter.woff2', 'font', { critical: true })] })).toEqual([
      { rel: 'preload', href: origin + '/inter.woff2', as: 'font', crossorigin: 'anonymous' },
    ]);
  });
  it('ignores resources that are not critical and not next-route', () => {
    expect(planPreloads({ origin, resources: [r(origin + '/footer.js', 'script', { critical: false }), r(origin + '/x.png', 'image', {})] })).toEqual([]);
  });
  it('preconnects once per third-party origin with a critical resource', () => {
    const hints = planPreloads({
      origin,
      resources: [
        r('https://cdn.example/a.js', 'script', { critical: true }),
        r('https://cdn.example/b.css', 'style', { critical: true }),
        r('https://api.example/data', 'fetch', { critical: true }),
        r('https://ads.example/ad.js', 'script', { critical: false }),
        r(origin + '/own.js', 'script', { critical: true }),
      ],
      maxPreloads: 10,
    });
    expect(hints.filter((h) => h.rel === 'preconnect')).toEqual([
      { rel: 'preconnect', href: 'https://cdn.example' },
      { rel: 'preconnect', href: 'https://api.example' },
    ]);
  });
  it('marks a preconnect crossorigin when a critical font comes from that origin', () => {
    const hints = planPreloads({
      origin,
      resources: [r('https://fonts.example/a.woff2', 'font', { critical: true }), r('https://fonts.example/s.css', 'style', { critical: true })],
    });
    expect(hints[0]).toEqual({ rel: 'preconnect', href: 'https://fonts.example', crossorigin: true });
  });
  it('does not preconnect for next-route resources', () => {
    const hints = planPreloads({ origin, resources: [r('https://cdn.example/next.js', 'script', { nextRoute: true })] });
    expect(hints).toEqual([{ rel: 'prefetch', href: 'https://cdn.example/next.js', as: 'script' }]);
  });
  it('orders preloads by priority: LCP image, then fonts, then the rest', () => {
    const hints = planPreloads({
      origin,
      resources: [
        r(origin + '/a.js', 'script', { critical: true }),
        r(origin + '/f1.woff2', 'font', { critical: true }),
        r(origin + '/hero.avif', 'image', { critical: true, lcp: true }),
        r(origin + '/f2.woff2', 'font', { critical: true }),
        r(origin + '/b.css', 'style', { critical: true }),
      ],
      maxPreloads: 10,
    });
    expect(hints.map((h) => h.href.replace(origin, ''))).toEqual(['/hero.avif', '/f1.woff2', '/f2.woff2', '/a.js', '/b.css']);
  });
  it('caps the preloads, dropping the least important', () => {
    const hints = planPreloads({
      origin,
      resources: [
        r(origin + '/a.js', 'script', { critical: true }),
        r(origin + '/f.woff2', 'font', { critical: true }),
        r(origin + '/hero.avif', 'image', { critical: true, lcp: true }),
        r(origin + '/b.css', 'style', { critical: true }),
      ],
      maxPreloads: 2,
    });
    expect(hints.map((h) => h.href.replace(origin, ''))).toEqual(['/hero.avif', '/f.woff2']);
    expect(planPreloads({ origin, resources: [r(origin + '/a.js', 'script', { critical: true })], maxPreloads: 0 })).toEqual([]);
  });
  it('defaults to three preloads', () => {
    const resources = ['a', 'b', 'c', 'd', 'e'].map((n) => r(origin + '/' + n + '.js', 'script', { critical: true }));
    expect(planPreloads({ origin, resources })).toHaveLength(3);
  });
  it('lists prefetches last, uncapped, in input order', () => {
    const hints = planPreloads({
      origin,
      resources: [
        r(origin + '/n1.js', 'script', { nextRoute: true }),
        r(origin + '/hero.avif', 'image', { critical: true, lcp: true }),
        r(origin + '/n2.json', 'fetch', { nextRoute: true }),
      ],
      maxPreloads: 1,
    });
    expect(hints.map((h) => h.rel)).toEqual(['preload', 'prefetch', 'prefetch']);
    expect(hints[1].href).toBe(origin + '/n1.js');
  });
  it('puts preconnects first, then preloads, then prefetches', () => {
    const hints = planPreloads({
      origin,
      resources: [
        r(origin + '/n.js', 'script', { nextRoute: true }),
        r('https://cdn.example/x.js', 'script', { critical: true }),
      ],
    });
    expect(hints.map((h) => h.rel)).toEqual(['preconnect', 'preload', 'prefetch']);
  });
  it('does not preload a critical next-route resource', () => {
    const hints = planPreloads({ origin, resources: [r(origin + '/n.js', 'script', { critical: true, nextRoute: true })] });
    expect(hints.map((h) => h.rel)).toEqual(['prefetch']);
  });
});
```

%% hints
- `const third = (u) => new URL(u).origin !== origin;`
- `const now = resources.filter((x) => x.critical && !x.nextRoute);` for preconnects and preloads.
- Rank: LCP image 0, font 1, other 2; sort with the input index as a tie-break; `slice(0, maxPreloads)`.
- Preconnect `crossorigin` only when some critical font of that origin exists.

%% solution
```js
export function planPreloads({ origin, resources, maxPreloads = 3 }) {
  const originOf = (url) => new URL(url).origin;
  const now = resources.filter((r) => r.critical && !r.nextRoute);

  const byOrigin = new Map();
  for (const r of now) {
    const o = originOf(r.url);
    if (o === origin) continue;
    if (!byOrigin.has(o)) byOrigin.set(o, false);
    if (r.type === 'font') byOrigin.set(o, true);
  }
  const hints = [];
  for (const [href, hasFont] of byOrigin) {
    hints.push(hasFont ? { rel: 'preconnect', href, crossorigin: true } : { rel: 'preconnect', href });
  }

  const rank = (r) => (r.lcp && r.type === 'image' ? 0 : r.type === 'font' ? 1 : 2);
  now
    .map((resource, index) => ({ resource, index }))
    .sort((a, b) => rank(a.resource) - rank(b.resource) || a.index - b.index)
    .slice(0, Math.max(0, maxPreloads))
    .forEach(({ resource: r }) => {
      const hint = { rel: 'preload', href: r.url, as: r.type };
      if (r.type === 'font') hint.crossorigin = 'anonymous';
      if (r.lcp && r.type === 'image') hint.fetchpriority = 'high';
      hints.push(hint);
    });

  for (const r of resources) {
    if (r.nextRoute) hints.push({ rel: 'prefetch', href: r.url, as: r.type });
  }
  return hints;
}
```

%% exercise rdl-critical-path | Find the critical path | 3 | js | js | criticalPath | 30
`criticalPath(resources)` finds the longest chain in a request waterfall. Each resource is `{ id, ms, dependsOn }` (`dependsOn` optional: ids that must **finish before this one starts**; `ms` is its own download time).

- A resource finishes at `ms + max(finish times of its dependencies)` (just `ms` with none).
- Return `{ total, path }`: `total` is the **largest finish time** and `path` the chain of ids (start to end) that produced it. If several chains tie, take the **first in input order** for the end resource, and the **first listed dependency** among tied dependencies.
- An unknown dependency throws `Error('unknown dependency: ' + id)`; a cycle throws `Error('cycle at ' + id)`. No resources gives `{ total: 0, path: [] }`.

```js
criticalPath([
  { id: 'html', ms: 100 },
  { id: 'css', ms: 80, dependsOn: ['html'] },
  { id: 'font', ms: 120, dependsOn: ['css'] },
  { id: 'js', ms: 150, dependsOn: ['html'] },
]); // { total: 300, path: ['html', 'css', 'font'] }
```

%% worked
**A similar problem, solved: `longestChain(tasks)`** — memoised recursion over a dependency graph, tracking the winning predecessor.

```js
function longestChain(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map();
  const finish = (id) => {
    if (memo.has(id)) return memo.get(id);
    const task = byId.get(id);
    let best = 0, via = null;
    for (const dep of task.after ?? []) {
      const f = finish(dep).time;
      if (f > best) { best = f; via = dep; }                 // ① strictly greater: the FIRST of equal deps wins
    }
    const result = { time: best + task.cost, via };           // ② remember which dependency set the time
    memo.set(id, result);
    return result;
  };
  // ... pick the task with the largest time, then follow `via` links backwards to build the path
}
```

Follow the `via` links **back** from the end and `reverse()` for start-to-end order. A **visiting** set catches cycles (seeing an id twice on the current stack).

%% explain
- **Memoised finish times** with the winning predecessor.
- **Cycle** and **unknown dependency** checks.
- **Walk `via` back** from the best end.

%% nudge
- How do you detect a cycle while recursing?
- Why `>` and not `>=` when comparing dependency finish times?

%% starter
```js
export function criticalPath(resources) {
  return { total: 0, path: [] };
}
```

%% tests
```js
describe('criticalPath', () => {
  it('returns the longest chain', () => {
    const result = criticalPath([
      { id: 'html', ms: 100 },
      { id: 'css', ms: 80, dependsOn: ['html'] },
      { id: 'font', ms: 120, dependsOn: ['css'] },
      { id: 'js', ms: 150, dependsOn: ['html'] },
    ]);
    expect(result).toEqual({ total: 300, path: ['html', 'css', 'font'] });
  });
  it('treats parallel requests as free', () => {
    expect(criticalPath([{ id: 'a', ms: 50 }, { id: 'b', ms: 70 }, { id: 'c', ms: 60 }])).toEqual({ total: 70, path: ['b'] });
  });
  it('waits for the slowest of several dependencies', () => {
    const result = criticalPath([
      { id: 'a', ms: 10 },
      { id: 'b', ms: 100 },
      { id: 'c', ms: 5, dependsOn: ['a', 'b'] },
    ]);
    expect(result).toEqual({ total: 105, path: ['b', 'c'] });
  });
  it('shows what a preload fixes', () => {
    const chain = [
      { id: 'html', ms: 100 },
      { id: 'css', ms: 80, dependsOn: ['html'] },
      { id: 'font', ms: 120, dependsOn: ['css'] },
    ];
    const preloaded = [
      { id: 'html', ms: 100 },
      { id: 'css', ms: 80, dependsOn: ['html'] },
      { id: 'font', ms: 120, dependsOn: ['html'] },
    ];
    expect(criticalPath(chain).total).toBe(300);
    expect(criticalPath(preloaded).total).toBe(220);
  });
  it('breaks ties toward the first resource and the first dependency', () => {
    expect(criticalPath([{ id: 'a', ms: 10 }, { id: 'b', ms: 10 }]).path).toEqual(['a']);
    const result = criticalPath([
      { id: 'a', ms: 10 },
      { id: 'b', ms: 10 },
      { id: 'c', ms: 1, dependsOn: ['b', 'a'] },
    ]);
    expect(result.path).toEqual(['b', 'c']);
  });
  it('handles a diamond', () => {
    const result = criticalPath([
      { id: 'root', ms: 10 },
      { id: 'left', ms: 20, dependsOn: ['root'] },
      { id: 'right', ms: 50, dependsOn: ['root'] },
      { id: 'join', ms: 5, dependsOn: ['left', 'right'] },
    ]);
    expect(result).toEqual({ total: 65, path: ['root', 'right', 'join'] });
  });
  it('allows dependencies listed after their dependents', () => {
    expect(criticalPath([{ id: 'b', ms: 5, dependsOn: ['a'] }, { id: 'a', ms: 5 }])).toEqual({ total: 10, path: ['a', 'b'] });
  });
  it('handles no resources', () => {
    expect(criticalPath([])).toEqual({ total: 0, path: [] });
  });
  it('rejects unknown dependencies and cycles', () => {
    expect(() => criticalPath([{ id: 'a', ms: 1, dependsOn: ['ghost'] }])).toThrow('unknown dependency: ghost');
    expect(() => criticalPath([{ id: 'a', ms: 1, dependsOn: ['b'] }, { id: 'b', ms: 1, dependsOn: ['a'] }])).toThrow(/cycle at/);
    expect(() => criticalPath([{ id: 'a', ms: 1, dependsOn: ['a'] }])).toThrow('cycle at a');
  });
});
```

%% hints
- `finish(id)` returns `{ time, via }`; keep a `visiting` set for cycles and a `memo` map.
- Pick the end: loop resources in input order, replace only when strictly greater.
- Build the path with `while (id !== null) { path.push(id); id = finish(id).via; }` then `reverse()`.

%% solution
```js
export function criticalPath(resources) {
  const byId = new Map(resources.map((r) => [r.id, r]));
  const memo = new Map();
  const visiting = new Set();

  const finish = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) throw new Error('cycle at ' + id);
    visiting.add(id);
    const resource = byId.get(id);
    let best = 0;
    let via = null;
    for (const dep of resource.dependsOn ?? []) {
      if (!byId.has(dep)) throw new Error('unknown dependency: ' + dep);
      const t = finish(dep).time;
      if (via === null || t > best) {
        best = t;
        via = dep;
      }
    }
    visiting.delete(id);
    const result = { time: best + resource.ms, via };
    memo.set(id, result);
    return result;
  };

  let endId = null;
  let total = 0;
  for (const r of resources) {
    const t = finish(r.id).time;
    if (endId === null || t > total) {
      endId = r.id;
      total = t;
    }
  }
  if (endId === null) return { total: 0, path: [] };

  const path = [];
  for (let id = endId; id !== null; id = memo.get(id).via) path.push(id);
  return { total, path: path.reverse() };
}
```

%% exercise rdl-check-hints | Tests for a hint planner | 4 | js | js | checkPlanPreloads | 40
`planPreloads({ origin, resources, maxPreloads })` returns `<link>` hints in this order: **preconnects** (one per third-party origin with a critical, non-next-route resource), **preloads** (critical resources; fonts get `crossorigin: 'anonymous'`; the LCP image gets `fetchpriority: 'high'`; capped at `maxPreloads` by priority LCP image, fonts, rest), then **prefetches** for next-route resources. You are given `checkPlanPreloads(planPreloads)`. Write a check that passes for a correct planner and **fails** for one that: **preconnects once per resource instead of once per origin**, **preconnects to the page's own origin**, **preloads fonts without crossorigin**, **forgets the LCP fetch priority**, **ignores the preload cap**, **preloads resources that are not critical**, **orders preloads by input order instead of priority**.

```js
const hints = planPreloads({ origin: 'https://shop.example', resources: [{ url: 'https://shop.example/hero.avif', type: 'image', critical: true, lcp: true }] });
expect(hints[0].fetchpriority).toBe('high');
```

%% worked
**A similar problem, solved: `checkWarmups(planWarmups)`** — one input where **every rule changes the output**, asserted as a whole.

```js
export function checkWarmups(planWarmups) {
  const items = [
    { name: 'c', kind: 'other' },
    { name: 'b', kind: 'secondary' },
    { name: 'a', kind: 'primary' },
    { name: 'x', kind: 'other' },
  ];
  expect(planWarmups(items, 3).map((i) => i.name)).toEqual(['a', 'b', 'c']);    // ① priority order AND the cap drops 'x'
  expect(planWarmups(items, 0)).toEqual([]);                                     // ② the boundary of the cap
}
```

Make the **input order different from the priority order** (otherwise an ordering bug is invisible), include **two resources from one third-party origin** (otherwise "once per origin" is invisible), and include a **non-critical** resource that must be ignored.

%% explain
- **One rich page**: own-origin and third-party resources, a font, an LCP image, a non-critical script, a next-route file.
- **Compare the whole hint list** with `toEqual`.
- **A second call** with a small cap.

%% nudge
- What input makes "once per origin" different from "once per resource"?
- Which input order exposes a planner that forgets to prioritise?

%% starter
```js
export function checkPlanPreloads(planPreloads) {
  const origin = 'https://shop.example';
  const hints = planPreloads({ origin, resources: [{ url: origin + '/a.js', type: 'script', critical: true }] });
  expect(hints).toEqual([{ rel: 'preload', href: origin + '/a.js', as: 'script' }]);
  // your assertions: preconnect rules, priority order, cap, font and LCP attributes
}
```

%% tests
```js
const make = (f = {}) => ({ origin, resources, maxPreloads = 3 }) => {
  const originOf = (u) => new URL(u).origin;
  const now = resources.filter((r) => (f.preloadAll ? !r.nextRoute : r.critical && !r.nextRoute));
  const hints = [];
  const seen = new Set();
  for (const r of now) {
    const o = originOf(r.url);
    if (o === origin && !f.ownOrigin) continue;
    if (!f.perResource) {
      if (seen.has(o)) continue;
      seen.add(o);
    }
    hints.push(r.type === 'font' || (resources.some((x) => x.type === 'font' && originOf(x.url) === o && x.critical && !x.nextRoute)) ? { rel: 'preconnect', href: o, crossorigin: true } : { rel: 'preconnect', href: o });
  }
  const rank = (r) => (f.inputOrder ? 0 : r.lcp && r.type === 'image' ? 0 : r.type === 'font' ? 1 : 2);
  now
    .map((resource, index) => ({ resource, index }))
    .sort((a, b) => rank(a.resource) - rank(b.resource) || a.index - b.index)
    .slice(0, f.noCap ? Infinity : maxPreloads)
    .forEach(({ resource: r }) => {
      const hint = { rel: 'preload', href: r.url, as: r.type };
      if (r.type === 'font' && !f.noCrossorigin) hint.crossorigin = 'anonymous';
      if (r.lcp && r.type === 'image' && !f.noPriority) hint.fetchpriority = 'high';
      hints.push(hint);
    });
  for (const r of resources) if (r.nextRoute) hints.push({ rel: 'prefetch', href: r.url, as: r.type });
  return hints;
};

const correct = make();
const mutants = {
  'preconnects once per resource instead of once per origin': make({ perResource: true }),
  'preconnects to the page own origin': make({ ownOrigin: true }),
  'preloads fonts without crossorigin': make({ noCrossorigin: true }),
  'forgets the LCP fetch priority': make({ noPriority: true }),
  'ignores the preload cap': make({ noCap: true }),
  'preloads resources that are not critical': make({ preloadAll: true }),
  'orders preloads by input order instead of priority': make({ inputOrder: true }),
};

describe('your checkPlanPreloads', () => {
  it('passes on a correct planner', () => {
    checkPlanPreloads(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a planner that ${name}`, () => {
      let caught = false;
      try { checkPlanPreloads(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- One page with: a critical script, a critical font and a critical style on the **same** CDN origin, a critical own-origin script, the LCP image **last** in input order, a non-critical resource, and a next-route file.
- Expected output: the preconnect, preloads in priority order, then the prefetch.
- Call it once with `maxPreloads: 2` to see the cap.

%% solution
```js
export function checkPlanPreloads(planPreloads) {
  const origin = 'https://shop.example';
  const cdn = 'https://cdn.example';
  const resources = [
    { url: cdn + '/app.js', type: 'script', critical: true },
    { url: cdn + '/inter.woff2', type: 'font', critical: true },
    { url: origin + '/main.css', type: 'style', critical: true },
    { url: origin + '/ads.js', type: 'script', critical: false },
    { url: origin + '/next.json', type: 'fetch', nextRoute: true },
    { url: origin + '/hero.avif', type: 'image', critical: true, lcp: true },
  ];

  expect(planPreloads({ origin, resources, maxPreloads: 10 })).toEqual([
    { rel: 'preconnect', href: cdn, crossorigin: true },
    { rel: 'preload', href: origin + '/hero.avif', as: 'image', fetchpriority: 'high' },
    { rel: 'preload', href: cdn + '/inter.woff2', as: 'font', crossorigin: 'anonymous' },
    { rel: 'preload', href: cdn + '/app.js', as: 'script' },
    { rel: 'preload', href: origin + '/main.css', as: 'style' },
    { rel: 'prefetch', href: origin + '/next.json', as: 'fetch' },
  ]);

  const capped = planPreloads({ origin, resources, maxPreloads: 2 });
  expect(capped.filter((h) => h.rel === 'preload').map((h) => h.href)).toEqual([origin + '/hero.avif', cdn + '/inter.woff2']);
}
```
