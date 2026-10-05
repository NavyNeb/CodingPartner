---
id: rd-capstone-performance-review
track: rd
title: Capstone: a performance review of a slow page
summary: A repeatable method for diagnosing a slow page (measure, locate the phase, match the fix, guard it), a rule engine that turns a lab report into prioritised findings, and a CI gate that compares medians against a baseline.
---

## The idea in one sentence

"The page is slow" is not a diagnosis: a **good performance review** names the **phase** that is slow, applies the fix that **matches** it, and installs a **guard** so the win stays.

> **Analogy** A doctor with a patient who "feels tired". They don't prescribe vitamins; they **measure** (bloodwork), **locate** the system at fault, **treat** that, then **schedule a follow-up**. Prescribing blindly is how teams spend a quarter minifying already-small JavaScript.

*(Everything here is framework-neutral. It ties together the earlier lessons: strategies, hydration, bundles, assets, caching and the client data layer.)*

## The loop

![The review loop](fig:rd-loop "Measure, locate, fix, guard, repeat.")

1. **Measure**: **field data** (real users, **p75** of LCP, INP, CLS) says **whether** there is a problem and for **whom**; a **lab run** (Lighthouse, a trace) says **why**. Take the **median of several runs**: one noisy run lies.
2. **Locate** the phase: server and network (TTFB), the critical path and the LCP element, JavaScript and main-thread work, layout stability, or origin load.
3. **Fix** with the technique that fits that phase, one change at a time.
4. **Guard**: a **budget** and a **CI gate** so the number cannot drift back unnoticed.

## From symptom to fix

![Symptom to fix](fig:rd-bottleneck "Name the phase first; the fix follows.")

| Symptom | Likely cause | Fix | Lesson |
| --- | --- | --- | --- |
| Slow **TTFB** | origin does work per request, no CDN, SSR cost | **cache** (CDN, ISR/SSG), stream, cheaper queries | rendering strategies, CDN |
| **LCP** late | LCP image lazy, huge or low priority; font discovered late | size and format, `fetchpriority`, preload | assets |
| Visible but **ignores clicks** | too much JS, long tasks, hydration | split, defer, Server Components, trim dependencies | hydration, bundles |
| **Layout shifts** | images without dimensions, late fonts, injected banners | reserve space, `size-adjust` | assets |
| **Origin on fire** | low hit ratio, `Vary: Cookie`, thundering herd | `Cache-Control`, coalescing, SWR | CDN |
| **Stale or redundant data** | no shared cache, refetch on every mount | query cache, stale time, prefetch | client data |

## A rule engine for a lab report

A lab report is just **numbers**; turning it into advice is a list of **rules** with thresholds, each producing a **finding** with an **estimated saving**, sorted so the **biggest win comes first**. That ordering is the real skill: fix what pays most, not what is easiest to describe.

```js try predict
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

console.log(median([2400, 1800, 9000]), median([1, 2, 3, 100]));
```

```stepper Reviewing a slow product page
code:
  field:  LCP p75 = 4.8 s (poor), INP fine
  lab:    TTFB 1.1 s, LCP element = hero <img loading="lazy">
  lab:    hero.jpg 480 KB, 3000 px wide, shown at 600 px
  lab:    initial JS 410 KB, 3 blocking third-party scripts
  fix:    cache HTML, un-lazy + resize + preload hero, split JS
  gate:   median of 5 runs must stay under the baseline + 10 %
---
line: 1
say: **Field data** says real users have a problem: the 75th-percentile LCP is poor. Interaction is fine, so the issue is **loading**, not responsiveness.
phase: measure
---
line: 2
say: In the lab the **first byte takes 1.1 s** and the LCP element is an image carrying **`loading="lazy"`**: the browser deliberately delays the one element the metric measures.
phase: locate
---
line: 3
say: The hero is **480 KB at 3000 px** but displayed at **600 px**: more than **5×** too big. Right-size it and serve AVIF or WebP.
phase: locate
---
line: 4
say: **410 KB of initial JavaScript** and **blocking** third parties delay interactivity and compete for bandwidth with the hero.
phase: locate
---
line: 5
say: Fixes in order of payoff: cache the HTML, remove the lazy attribute and add `fetchpriority="high"` plus a preload, right-size the image, split the bundle, load third parties after interaction.
phase: fix
---
line: 6
say: A **CI gate** takes the **median of five lab runs** and fails the build if a metric regresses beyond its allowance, so the page does not slowly get heavy again.
phase: guard
```

## The CI gate

![CI gate](fig:rd-gate "Medians of several runs against a baseline, with limits per metric.")

A useful gate has four properties: it uses the **median** of several runs (noise-proof), allows a **per-metric regression percentage** plus an **absolute ceiling**, treats a **missing metric as a failure** (a broken measurement must not look like a pass), and **never penalises improvements**.

## Interview framing

When asked "a page loads slowly, what do you do?" answer in this shape: **measure** (field p75 vs lab), **name the phase** (TTFB, LCP element, JS, shifts), give the **one or two highest-payoff fixes** with their trade-offs (cache staleness, hydration cost, complexity), say how you would **verify**, and how you would **prevent regression**.

## Quick check

```check
Q: Field data says LCP p75 is poor, but the lab run on your fast laptop is fine. What next?
A) Ignore the field data
B) Reproduce with throttled network and CPU, and slice the field data by device and region *
C) Only optimise for the lab
D) Increase the server size
Why: Real users are slower than your laptop; the lab must be made to resemble them.
---
Q: The LCP element is a hero image with loading="lazy". What is the first fix?
A) Compress the JPEG
B) Remove lazy loading and give it high fetch priority *
C) Use HTTP/3
D) Add more JavaScript
Why: Lazy-loading delays the very element the metric measures.
---
Q: Why gate CI on the median of several runs?
A) It is faster
B) A single run is noisy; the median ignores outliers *
C) Lighthouse requires it
D) Medians are always lower
Why: One slow or fast outlier should not decide whether a pull request passes.
---
Q: A required metric is absent from the CI runs. What should the gate do?
A) Pass, since nothing regressed
B) Fail, because a broken measurement must not look like success *
C) Skip it silently
D) Use zero
Why: Missing data is a problem to fix, not a pass.
```

## Recap

- **Measure** (field p75 + lab median), **locate** the phase, **fix** what matches, **guard** with a budget and a CI gate.
- Map **symptoms to causes**: TTFB to server and cache, late LCP to image or font priority, sluggish interaction to JavaScript, shifts to missing dimensions, origin load to headers and `Vary`.
- A diagnosis engine is **rules plus savings estimates, sorted by payoff**.
- A good gate: **median of runs**, **percentage + absolute limits**, **missing is a failure**, **improvements pass**, **exactly at the limit passes**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: the LCP fix | A short chain of conditions |
| Diagnose a report | A list of rules, per-item findings, severity buckets, a stable sort |
| A CI performance gate | Median of runs, percentage maths, boundary handling |
| Tests for the gate | Outliers, even-length medians and the exact limit |

%% exercise rdl-guided-lcp | Guided: the first LCP fix | 1 | js | js | firstLcpFix | 8 | guided
Implement `firstLcpFix(lcp)` for the LCP element `{ type, lazy, preloaded, fetchpriority }` and return the **first fix** to apply:

- an **image** with `lazy` true → `'remove-lazy'`;
- an **image** (not lazy) that is neither `preloaded` nor `fetchpriority === 'high'` → `'raise-priority'`;
- a **text** element that is not `preloaded` → `'preload-font'`;
- otherwise `'none'`.

```js
firstLcpFix({ type: 'image', lazy: true }); // 'remove-lazy'
firstLcpFix({ type: 'text', preloaded: true }); // 'none'
```

%% worked
**A similar problem, solved: `firstCheckoutBlocker(cart)`** — ordered checks that return the first problem.

```js
function firstCheckoutBlocker(cart) {
  if (cart.items.length === 0) return 'empty';           // ① the most basic problem first
  if (!cart.address) return 'no-address';                 // ② then the next
  if (cart.total > cart.limit) return 'over-limit';
  return 'none';                                          // ③ nothing blocks
}
```

When a lazy image is also not preloaded, `remove-lazy` must come first: lazy is the **bigger** problem, and fixing priority would change nothing while it is lazy.

%% explain
- **Image branch**: lazy first, then priority.
- **Text branch**: preload the font.
- Else `'none'`.

%% nudge
- Which fix comes first for a lazy, un-preloaded image?

%% starter
```js
export function firstLcpFix(lcp) {
  return 'none';
}
```

%% tests
```js
describe('firstLcpFix', () => {
  it('removes lazy loading first', () => {
    expect(firstLcpFix({ type: 'image', lazy: true })).toBe('remove-lazy');
    expect(firstLcpFix({ type: 'image', lazy: true, preloaded: false })).toBe('remove-lazy');
  });
  it('raises the priority of an image that is neither preloaded nor high priority', () => {
    expect(firstLcpFix({ type: 'image' })).toBe('raise-priority');
    expect(firstLcpFix({ type: 'image', fetchpriority: 'low' })).toBe('raise-priority');
  });
  it('leaves a preloaded or high-priority image alone', () => {
    expect(firstLcpFix({ type: 'image', preloaded: true })).toBe('none');
    expect(firstLcpFix({ type: 'image', fetchpriority: 'high' })).toBe('none');
  });
  it('preloads the font for a text element', () => {
    expect(firstLcpFix({ type: 'text' })).toBe('preload-font');
    expect(firstLcpFix({ type: 'text', preloaded: true })).toBe('none');
  });
  it('does nothing for unknown types', () => {
    expect(firstLcpFix({ type: 'video' })).toBe('none');
  });
});
```

%% hints
- `if (lcp.type === 'image') { if (lcp.lazy) ...; if (!lcp.preloaded && lcp.fetchpriority !== 'high') ...; }`

%% solution
```js
export function firstLcpFix(lcp) {
  if (lcp.type === 'image') {
    if (lcp.lazy) return 'remove-lazy';
    if (!lcp.preloaded && lcp.fetchpriority !== 'high') return 'raise-priority';
    return 'none';
  }
  if (lcp.type === 'text' && !lcp.preloaded) return 'preload-font';
  return 'none';
}
```

%% exercise rdl-diagnose | Diagnose a lab report | 4 | js | js | diagnose | 45
`diagnose(report)` turns a lab report into prioritised findings. Every field of `report` is optional: `{ ttfbMs, lcp, js, images, cache, thirdParties }`. A finding is `{ id, severity, savingsMs, message }` (`message` is any non-empty string). Rules (a rule that produces a saving of `0` or less produces **no finding**):

| id | when | savingsMs |
| --- | --- | --- |
| `slow-ttfb` | `ttfbMs > 800` | `ttfbMs - 800` |
| `lcp-lazy` | `lcp.type === 'image'` and `lcp.lazy` | `300` |
| `lcp-priority` | image, **not** lazy, not `preloaded`, `fetchpriority !== 'high'` | `200` |
| `lcp-font` | `lcp.type === 'text'` and not `preloaded` | `150` |
| `big-js` | `js.initialKb > 170` | `Math.round((initialKb - 170) * 5)` |
| `long-tasks` | `js.longTasksMs > 200` | `longTasksMs - 200` |
| `oversized-image:<url>` | an image with `widthPx > displayWidthPx * 2` | its `kb` |
| `legacy-format:<url>` | `format` is `'jpeg'` or `'png'` and `kb > 100` | `Math.round(kb * 0.3)` |
| `eager-offscreen:<url>` | `belowFold` and not `lazy` | its `kb` |
| `low-hit-ratio` | `cache.hitRatio < 0.8` (when present) | `Math.round((0.8 - hitRatio) * 1000)` |
| `third-party:<origin>` | a third party with `blocking` true | `kb * 3` |

`severity` is `'high'` for savings of `500` or more, `'medium'` for `150` or more, otherwise `'low'`. The result is sorted by `savingsMs` **descending**, then `id` **ascending**.

```js
diagnose({ ttfbMs: 1100, lcp: { type: 'image', lazy: true } });
// [{ id: 'lcp-lazy', severity: 'medium', savingsMs: 300, ... }, { id: 'slow-ttfb', severity: 'medium', savingsMs: 300, ... }]
```

%% worked
**A similar problem, solved: `lint(config)`** — a table of rules, each adding a finding with a **weight**, then **rank**.

```js
function lint(config) {
  const out = [];
  const add = (id, weight, message) => { if (weight > 0) out.push({ id, weight, message }); };   // ① one helper: a rule with no weight adds nothing
  add('big-bundle', (config.bundleKb ?? 0) - 200, 'bundle too large');
  for (const dep of config.deps ?? []) {
    if (dep.duplicated) add('duplicate:' + dep.name, dep.kb, 'duplicated dependency');           // ② per-item rules get a per-item id
  }
  return out.sort((a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));    // ③ most valuable first, stable tie-break
}
```

An **`add` helper** that drops non-positive savings keeps every rule to **one line**. Severity is a function of the saving, computed in the same helper.

%% explain
- **`add(id, savingsMs, message)`** drops `<= 0` and computes severity.
- **One-off rules** and **per-item rules** (images, third parties).
- **Sort** by savings desc, id asc.

%% nudge
- Why should a rule with a saving of exactly `0` produce nothing?
- What breaks ties between two findings with the same savings?

%% starter
```js
export function diagnose(report) {
  return [];
}
```

%% tests
```js
describe('diagnose', () => {
  const ids = (list) => list.map((f) => f.id);
  const by = (list, id) => list.find((f) => f.id === id);

  it('finds nothing wrong with an empty or healthy report', () => {
    expect(diagnose({})).toEqual([]);
    expect(diagnose({ ttfbMs: 800, js: { initialKb: 170, longTasksMs: 200 }, cache: { hitRatio: 0.8 }, lcp: { type: 'image', preloaded: true }, images: [], thirdParties: [] })).toEqual([]);
  });
  it('flags a slow first byte with the excess as the saving', () => {
    const f = by(diagnose({ ttfbMs: 1100 }), 'slow-ttfb');
    expect(f).toMatchObject({ id: 'slow-ttfb', savingsMs: 300, severity: 'medium' });
    expect(typeof f.message).toBe('string');
    expect(f.message.length).toBeGreaterThan(0);
  });
  it('flags LCP problems, lazy first', () => {
    expect(by(diagnose({ lcp: { type: 'image', lazy: true } }), 'lcp-lazy')).toMatchObject({ savingsMs: 300 });
    expect(ids(diagnose({ lcp: { type: 'image', lazy: true } }))).toEqual(['lcp-lazy']);
    expect(ids(diagnose({ lcp: { type: 'image' } }))).toEqual(['lcp-priority']);
    expect(diagnose({ lcp: { type: 'image', fetchpriority: 'high' } })).toEqual([]);
    expect(by(diagnose({ lcp: { type: 'text' } }), 'lcp-font')).toMatchObject({ savingsMs: 150, severity: 'medium' });
    expect(diagnose({ lcp: { type: 'text', preloaded: true } })).toEqual([]);
  });
  it('flags big JavaScript and long tasks', () => {
    expect(by(diagnose({ js: { initialKb: 410 } }), 'big-js')).toMatchObject({ savingsMs: 1200, severity: 'high' });
    expect(by(diagnose({ js: { longTasksMs: 450 } }), 'long-tasks')).toMatchObject({ savingsMs: 250, severity: 'medium' });
  });
  it('flags image problems per image', () => {
    const report = {
      images: [
        { url: '/hero.jpg', kb: 480, widthPx: 3000, displayWidthPx: 600, format: 'jpeg' },
        { url: '/ok.avif', kb: 50, widthPx: 600, displayWidthPx: 600, format: 'avif' },
        { url: '/foot.png', kb: 90, widthPx: 100, displayWidthPx: 100, format: 'png', belowFold: true },
      ],
    };
    const result = diagnose(report);
    expect(ids(result)).toEqual(['oversized-image:/hero.jpg', 'legacy-format:/hero.jpg', 'eager-offscreen:/foot.png']);
    expect(by(result, 'oversized-image:/hero.jpg').savingsMs).toBe(480);
    expect(by(result, 'legacy-format:/hero.jpg').savingsMs).toBe(144);
    expect(by(result, 'eager-offscreen:/foot.png').savingsMs).toBe(90);
  });
  it('respects the oversize boundary and lazy images', () => {
    expect(diagnose({ images: [{ url: '/a', kb: 50, widthPx: 1200, displayWidthPx: 600, format: 'webp' }] })).toEqual([]);
    expect(diagnose({ images: [{ url: '/a', kb: 50, widthPx: 1201, displayWidthPx: 600, format: 'webp' }] })).toHaveLength(1);
    expect(diagnose({ images: [{ url: '/a', kb: 90, widthPx: 100, displayWidthPx: 100, belowFold: true, lazy: true }] })).toEqual([]);
    expect(diagnose({ images: [{ url: '/a', kb: 100, widthPx: 100, displayWidthPx: 100, format: 'jpeg' }] })).toEqual([]);
  });
  it('flags a low hit ratio and blocking third parties', () => {
    expect(by(diagnose({ cache: { hitRatio: 0.5 } }), 'low-hit-ratio')).toMatchObject({ savingsMs: 300 });
    expect(diagnose({ cache: {} })).toEqual([]);
    const result = diagnose({ thirdParties: [{ origin: 'ads.example', kb: 100, blocking: true }, { origin: 'fonts.example', kb: 100, blocking: false }] });
    expect(ids(result)).toEqual(['third-party:ads.example']);
    expect(result[0]).toMatchObject({ savingsMs: 300, severity: 'medium' });
  });
  it('assigns severity by the saving', () => {
    expect(by(diagnose({ ttfbMs: 1300 }), 'slow-ttfb').severity).toBe('high');
    expect(by(diagnose({ ttfbMs: 1299 }), 'slow-ttfb').severity).toBe('medium');
    expect(by(diagnose({ ttfbMs: 950 }), 'slow-ttfb').severity).toBe('medium');
    expect(by(diagnose({ ttfbMs: 949 }), 'slow-ttfb').severity).toBe('low');
  });
  it('sorts by saving, largest first, with ids breaking ties', () => {
    const result = diagnose({
      ttfbMs: 1100,
      lcp: { type: 'image', lazy: true },
      js: { initialKb: 410 },
      cache: { hitRatio: 0.2 },
    });
    expect(ids(result)).toEqual(['big-js', 'low-hit-ratio', 'lcp-lazy', 'slow-ttfb']);
    expect(result.map((f) => f.savingsMs)).toEqual([1200, 600, 300, 300]);
  });
});
```

%% hints
- `const add = (id, savingsMs, message) => { if (savingsMs > 0) out.push({ id, savingsMs, severity: ..., message }); };`
- Defaults: `const { ttfbMs = 0, lcp, js = {}, images = [], cache = {}, thirdParties = [] } = report;`
- Final: `out.sort((a, b) => b.savingsMs - a.savingsMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))`.
- `cache.hitRatio !== undefined` guards the hit-ratio rule.

%% solution
```js
export function diagnose(report) {
  const { ttfbMs = 0, lcp, js = {}, images = [], cache = {}, thirdParties = [] } = report;
  const out = [];
  const add = (id, savingsMs, message) => {
    if (savingsMs > 0) {
      out.push({ id, severity: savingsMs >= 500 ? 'high' : savingsMs >= 150 ? 'medium' : 'low', savingsMs, message });
    }
  };

  add('slow-ttfb', ttfbMs - 800, 'The first byte is slow: cache the page, stream it, or speed up the server work.');
  if (lcp && lcp.type === 'image') {
    if (lcp.lazy) add('lcp-lazy', 300, 'The LCP image is lazy-loaded: remove loading="lazy".');
    else if (!lcp.preloaded && lcp.fetchpriority !== 'high') add('lcp-priority', 200, 'Give the LCP image fetchpriority="high" or preload it.');
  }
  if (lcp && lcp.type === 'text' && !lcp.preloaded) add('lcp-font', 150, 'Preload the font used by the LCP text.');
  add('big-js', Math.round(((js.initialKb ?? 0) - 170) * 5), 'Too much JavaScript up front: split and defer it.');
  add('long-tasks', (js.longTasksMs ?? 0) - 200, 'Long main-thread tasks block interaction: break them up.');

  for (const img of images) {
    if (img.widthPx > img.displayWidthPx * 2) add('oversized-image:' + img.url, img.kb, 'The image is much larger than it is displayed.');
    if ((img.format === 'jpeg' || img.format === 'png') && img.kb > 100) {
      add('legacy-format:' + img.url, Math.round(img.kb * 0.3), 'Serve AVIF or WebP instead.');
    }
    if (img.belowFold && !img.lazy) add('eager-offscreen:' + img.url, img.kb, 'Lazy-load images below the fold.');
  }
  if (cache.hitRatio !== undefined && cache.hitRatio < 0.8) {
    add('low-hit-ratio', Math.round((0.8 - cache.hitRatio) * 1000), 'The cache hit ratio is low: check Cache-Control and Vary.');
  }
  for (const tp of thirdParties) {
    if (tp.blocking) add('third-party:' + tp.origin, tp.kb * 3, 'A blocking third-party script: load it async or after interaction.');
  }

  return out.sort((a, b) => b.savingsMs - a.savingsMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
```

%% exercise rdl-perf-gate | A CI performance gate | 3 | js | js | gate | 36
`gate({ baseline, runs, limits })` decides whether a build's performance is acceptable.

- `baseline` maps metric names to numbers; `runs` is a list of metric maps (several lab runs); `limits` maps metric names to `{ maxRegressionPct, abs }` (either may be missing).
- For each metric **in `limits`**, taken in **alphabetical order**, collect that metric's numeric values across `runs` and take their **median** (the mean of the two middle values for an even count).
- No numeric values at all: `{ metric, baseline, median: null, deltaPct: null, status: 'fail', reason: 'missing' }`.
- Otherwise `deltaPct = Math.round((median - baseline) / baseline * 1000) / 10` (`0` when the median is `0` and the baseline is `0`; `Infinity` when only the baseline is `0`; `0` when there is no baseline).
- The metric **fails** with `reason: 'over-absolute-limit'` if `abs` is set and `median > abs`; else with `reason: 'regression'` if `maxRegressionPct` is set and `deltaPct > maxRegressionPct`. Equal to the limit **passes**; improvements pass.
- A result is `{ metric, baseline, median, deltaPct, status }` plus `reason` when it failed. Return `{ pass, results }` where `pass` is true only if every result passed.

```js
gate({ baseline: { lcp: 2000 }, runs: [{ lcp: 2100 }, { lcp: 2150 }, { lcp: 9000 }], limits: { lcp: { maxRegressionPct: 10 } } });
// median 2150, deltaPct 7.5 → pass
```

%% worked
**A similar problem, solved: `checkRelease(prev, runs, rules)`** — a median, a percentage and a **strict** comparison.

```js
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);                  // ① sort a COPY, numerically
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;       // ② odd: the middle; even: the mean of the two middle
}

function checkRelease(prev, runs, rules) {
  return Object.keys(rules).sort().map((name) => {
    const values = runs.map((r) => r[name]).filter((v) => typeof v === 'number');
    if (values.length === 0) return { name, ok: false, why: 'missing' };            // ③ no data is a failure, not a pass
    const pct = Math.round(((median(values) - prev[name]) / prev[name]) * 1000) / 10;
    return { name, ok: !(pct > rules[name].maxPct), pct };                            // ④ strictly greater fails; equal passes
  });
}
```

`Array.prototype.sort()` without a comparator sorts **as strings** (`[10, 9]` becomes `[10, 9]`, `[100, 20]` becomes `[100, 20]`), so always pass `(a, b) => a - b`.

%% explain
- **`median`** helper (copy, numeric sort, even and odd).
- **One result per limited metric**, alphabetical.
- **Check order**: missing, then absolute limit, then regression.

%% nudge
- What does a metric that is in `limits` but absent from every run produce?
- Is a regression exactly equal to `maxRegressionPct` a failure?

%% starter
```js
export function gate({ baseline, runs, limits }) {
  return { pass: true, results: [] };
}
```

%% tests
```js
describe('gate', () => {
  const run = (overrides = {}) => gate({
    baseline: { lcp: 2000, jsKb: 100 },
    runs: [{ lcp: 2000, jsKb: 100 }],
    limits: { lcp: { maxRegressionPct: 10 }, jsKb: { maxRegressionPct: 5 } },
    ...overrides,
  });

  it('passes an unchanged build and lists results alphabetically', () => {
    const r = run();
    expect(r.pass).toBe(true);
    expect(r.results.map((x) => x.metric)).toEqual(['jsKb', 'lcp']);
    expect(r.results[1]).toEqual({ metric: 'lcp', baseline: 2000, median: 2000, deltaPct: 0, status: 'pass' });
  });
  it('uses the median, not the mean, so an outlier does not decide', () => {
    const r = run({ runs: [{ lcp: 2100, jsKb: 100 }, { lcp: 2150, jsKb: 100 }, { lcp: 9000, jsKb: 100 }] });
    expect(r.pass).toBe(true);
    expect(r.results[1]).toMatchObject({ median: 2150, deltaPct: 7.5 });
  });
  it('takes the mean of the two middle values for an even number of runs', () => {
    const r = gate({ baseline: { lcp: 2000 }, runs: [{ lcp: 2000 }, { lcp: 2100 }], limits: { lcp: { maxRegressionPct: 3 } } });
    expect(r.results[0]).toMatchObject({ median: 2050, deltaPct: 2.5, status: 'pass' });
  });
  it('sorts values numerically', () => {
    const r = gate({ baseline: { x: 10 }, runs: [{ x: 100 }, { x: 9 }, { x: 20 }], limits: { x: { abs: 1000 } } });
    expect(r.results[0].median).toBe(20);
  });
  it('fails a regression beyond the allowed percentage', () => {
    const r = run({ runs: [{ lcp: 2300, jsKb: 100 }] });
    expect(r.pass).toBe(false);
    expect(r.results[1]).toMatchObject({ metric: 'lcp', deltaPct: 15, status: 'fail', reason: 'regression' });
    expect(r.results[0].status).toBe('pass');
  });
  it('lets a regression exactly at the limit pass', () => {
    expect(run({ runs: [{ lcp: 2200, jsKb: 105 }] }).pass).toBe(true);
    expect(run({ runs: [{ lcp: 2201, jsKb: 105 }] }).results[1].status).toBe('fail');
  });
  it('fails when the absolute limit is crossed even within the percentage', () => {
    const r = gate({
      baseline: { lcp: 2400 },
      runs: [{ lcp: 2600 }],
      limits: { lcp: { maxRegressionPct: 10, abs: 2500 } },
    });
    expect(r.results[0]).toMatchObject({ status: 'fail', reason: 'over-absolute-limit', deltaPct: 8.3 });
  });
  it('lets a value exactly at the absolute limit pass', () => {
    expect(gate({ baseline: { lcp: 2400 }, runs: [{ lcp: 2500 }], limits: { lcp: { abs: 2500 } } }).pass).toBe(true);
  });
  it('never penalises improvements', () => {
    const r = run({ runs: [{ lcp: 1500, jsKb: 60 }] });
    expect(r.pass).toBe(true);
    expect(r.results[1].deltaPct).toBe(-25);
  });
  it('fails a metric that is missing from every run', () => {
    const r = run({ runs: [{ lcp: 2000 }, { lcp: 2000 }] });
    expect(r.pass).toBe(false);
    expect(r.results[0]).toEqual({ metric: 'jsKb', baseline: 100, median: null, deltaPct: null, status: 'fail', reason: 'missing' });
  });
  it('ignores non-numeric values and metrics that have no limit', () => {
    const r = gate({
      baseline: { lcp: 2000, cls: 0.1 },
      runs: [{ lcp: 2000, cls: 5 }, { lcp: 'bad' }],
      limits: { lcp: { maxRegressionPct: 5 } },
    });
    expect(r.results).toHaveLength(1);
    expect(r.results[0].median).toBe(2000);
  });
  it('handles a zero baseline', () => {
    expect(gate({ baseline: { errors: 0 }, runs: [{ errors: 0 }], limits: { errors: { maxRegressionPct: 5 } } }).results[0].deltaPct).toBe(0);
    const r = gate({ baseline: { errors: 0 }, runs: [{ errors: 2 }], limits: { errors: { maxRegressionPct: 5 } } });
    expect(r.results[0]).toMatchObject({ deltaPct: Infinity, status: 'fail', reason: 'regression' });
  });
});
```

%% hints
- `median(values)` with a copied, numerically sorted array.
- `deltaPct`: `base === 0 ? (med === 0 ? 0 : Infinity) : Math.round(((med - base) / base) * 1000) / 10`; no baseline: `0`.
- Fail reason order: absolute limit first, then regression.
- `pass = results.every((r) => r.status === 'pass')`.

%% solution
```js
export function gate({ baseline, runs, limits }) {
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const results = Object.keys(limits).sort().map((metric) => {
    const values = runs.map((r) => r[metric]).filter((v) => typeof v === 'number');
    const base = baseline[metric];
    if (values.length === 0) {
      return { metric, baseline: base, median: null, deltaPct: null, status: 'fail', reason: 'missing' };
    }
    const med = median(values);
    let deltaPct;
    if (base === undefined) deltaPct = 0;
    else if (base === 0) deltaPct = med === 0 ? 0 : Infinity;
    else deltaPct = Math.round(((med - base) / base) * 1000) / 10;

    const limit = limits[metric];
    let reason;
    if (limit.abs !== undefined && med > limit.abs) reason = 'over-absolute-limit';
    else if (limit.maxRegressionPct !== undefined && deltaPct > limit.maxRegressionPct) reason = 'regression';
    const result = { metric, baseline: base, median: med, deltaPct, status: reason ? 'fail' : 'pass' };
    if (reason) result.reason = reason;
    return result;
  });
  return { pass: results.every((r) => r.status === 'pass'), results };
}
```

%% exercise rdl-check-gate | Tests for a performance gate | 4 | js | js | checkGate | 40
`gate({ baseline, runs, limits })` compares the **median** of each limited metric across lab runs with a baseline: it fails on a regression greater than `maxRegressionPct` (equal passes), on a value over the `abs` ceiling, or when the metric is missing from every run; improvements pass. It returns `{ pass, results }` with `{ metric, baseline, median, deltaPct, status, reason? }` per metric. You are given `checkGate(gate)`. Write a check that passes for a correct gate and **fails** for one that: **uses the mean instead of the median**, **fails when exactly at the limit**, **ignores the absolute limit**, **fails improvements**, **passes a missing metric**, **takes the upper middle value for an even number of runs**.

```js
const result = gate({ baseline: { lcp: 2000 }, runs: [{ lcp: 2100 }], limits: { lcp: { maxRegressionPct: 10 } } });
expect(result.pass).toBe(true);
```

%% worked
**A similar problem, solved: `checkRelease(checkRelease)`** — one scenario per **boundary**, built from data where the **wrong statistic gives a different verdict**.

```js
export function checkReleaseGate(releaseGate) {
  const limits = { lcp: { maxPct: 10 } };
  // ① outlier: the median is 2150 (pass) but the mean is 4416 (would fail)
  expect(releaseGate({ prev: { lcp: 2000 }, runs: [2100, 2150, 9000], limits }).pass).toBe(true);
  // ② exactly at the limit: must pass
  expect(releaseGate({ prev: { lcp: 2000 }, runs: [2200], limits }).pass).toBe(true);
  // ③ one over the limit: must fail
  expect(releaseGate({ prev: { lcp: 2000 }, runs: [2201], limits }).pass).toBe(false);
}
```

Choose numbers so each **wrong implementation flips a verdict**: an outlier separates median from mean; an **even** count with a tight limit separates the two ways of taking the middle; a value **exactly at** the limit separates `>` from `>=`; and a **big improvement** separates "regression" from "any change".

%% explain
- **Outlier run** to separate median from mean.
- **Even run count** with a tight limit.
- **Exactly at** and **one above** the limit.
- **Improvement**, **absolute limit** and **missing metric**.

%% nudge
- Which input makes the mean and the median give different verdicts?
- How do you make "upper middle" differ from "mean of the middle two"?

%% starter
```js
export function checkGate(gate) {
  const result = gate({ baseline: { lcp: 2000 }, runs: [{ lcp: 2100 }], limits: { lcp: { maxRegressionPct: 10 } } });
  expect(result.pass).toBe(true);
  // your assertions: outlier, even runs, boundary, absolute limit, improvement, missing
}
```

%% tests
```js
const make = (f = {}) => ({ baseline, runs, limits }) => {
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    if (f.mean) return s.reduce((a, b) => a + b, 0) / s.length;
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : f.upperMiddle ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const results = Object.keys(limits).sort().map((metric) => {
    const values = runs.map((r) => r[metric]).filter((v) => typeof v === 'number');
    const base = baseline[metric];
    if (values.length === 0) {
      return f.passMissing
        ? { metric, baseline: base, median: null, deltaPct: null, status: 'pass' }
        : { metric, baseline: base, median: null, deltaPct: null, status: 'fail', reason: 'missing' };
    }
    const med = median(values);
    const deltaPct = base === 0 ? (med === 0 ? 0 : Infinity) : Math.round(((med - base) / base) * 1000) / 10;
    const limit = limits[metric];
    let reason;
    if (!f.ignoreAbs && limit.abs !== undefined && med > limit.abs) reason = 'over-absolute-limit';
    else if (limit.maxRegressionPct !== undefined) {
      const over = f.failAtLimit ? deltaPct >= limit.maxRegressionPct : f.failImprovements ? Math.abs(deltaPct) > limit.maxRegressionPct : deltaPct > limit.maxRegressionPct;
      if (over) reason = 'regression';
    }
    const result = { metric, baseline: base, median: med, deltaPct, status: reason ? 'fail' : 'pass' };
    if (reason) result.reason = reason;
    return result;
  });
  return { pass: results.every((r) => r.status === 'pass'), results };
};

const correct = make();
const mutants = {
  'uses the mean instead of the median': make({ mean: true }),
  'fails when exactly at the limit': make({ failAtLimit: true }),
  'ignores the absolute limit': make({ ignoreAbs: true }),
  'fails improvements': make({ failImprovements: true }),
  'passes a missing metric': make({ passMissing: true }),
  'takes the upper middle value for an even number of runs': make({ upperMiddle: true }),
};

describe('your checkGate', () => {
  it('passes on a correct gate', () => {
    checkGate(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a gate that ${name}`, () => {
      let caught = false;
      try { checkGate(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Outlier: runs `2100, 2150, 9000` against a baseline of `2000` with a 10% limit.
- Even: runs `2000, 2100` with a 3% limit (median `2050` passes, `2100` fails).
- Exactly at the limit: median `2200` for baseline `2000` and 10%.
- Improvement: median `1500` must pass.
- Absolute: baseline `2400`, median `2600`, `abs: 2500`, `maxRegressionPct: 10`.
- Missing: a limited metric absent from every run must not pass.

%% solution
```js
export function checkGate(gate) {
  const lcp = (...values) => values.map((v) => ({ lcp: v }));
  const regression = { lcp: { maxRegressionPct: 10 } };

  expect(gate({ baseline: { lcp: 2000 }, runs: lcp(2100, 2150, 9000), limits: regression }).pass).toBe(true);
  expect(gate({ baseline: { lcp: 2000 }, runs: lcp(2000, 2100), limits: { lcp: { maxRegressionPct: 3 } } }).pass).toBe(true);

  expect(gate({ baseline: { lcp: 2000 }, runs: lcp(2200), limits: regression }).pass).toBe(true);
  const over = gate({ baseline: { lcp: 2000 }, runs: lcp(2201), limits: regression });
  expect(over.pass).toBe(false);
  expect(over.results[0].reason).toBe('regression');

  expect(gate({ baseline: { lcp: 2000 }, runs: lcp(1500), limits: regression }).pass).toBe(true);

  const absolute = gate({ baseline: { lcp: 2400 }, runs: lcp(2600), limits: { lcp: { maxRegressionPct: 10, abs: 2500 } } });
  expect(absolute.pass).toBe(false);
  expect(absolute.results[0].reason).toBe('over-absolute-limit');

  const missing = gate({ baseline: { lcp: 2000, jsKb: 100 }, runs: lcp(2000), limits: { lcp: { maxRegressionPct: 10 }, jsKb: { maxRegressionPct: 5 } } });
  expect(missing.pass).toBe(false);
  expect(missing.results[0].reason).toBe('missing');
}
```
