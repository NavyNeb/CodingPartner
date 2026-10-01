---
id: web-perf
track: web
title: Performance metrics that matter
summary: LCP, INP and CLS in plain English, why you report the 75th percentile and not the average, how to measure them in real users' browsers, and how to keep a bundle on budget.
---

## The idea in one sentence

"Fast" is not a feeling: it is **three numbers measured on real people's devices** — *how soon the main thing appears* (**LCP**), *how quickly the page answers when you touch it* (**INP**), and *how much it jumps around while you read* (**CLS**) — judged at the **75th percentile**, so the slow quarter of your users isn't ignored.

> **Analogy** A restaurant doesn't judge its service by the *average* wait. If most tables wait 5 minutes but one in four waits 40, the average looks fine and a quarter of the customers leave angry. Using the **75th percentile** says: "three out of four customers waited *this long or less*," which exposes the slow end. And the three numbers are the three moments diners notice: **the food arriving** (LCP), **the waiter answering when you wave** (INP), and **the table not being moved while you eat** (CLS).

## The three Core Web Vitals

![The three Core Web Vitals with their good, needs-improvement and poor thresholds](fig:vitals-gauges "Thresholds are judged at p75 of real page loads.")

| Metric | Question it answers | Good at p75 |
| --- | --- | --- |
| **LCP** — Largest Contentful Paint | When did the biggest thing in the viewport (hero image, headline) finish rendering? | ≤ 2.5 s |
| **INP** — Interaction to Next Paint | After a tap, click or key press, how long until the screen visibly responded? | ≤ 200 ms |
| **CLS** — Cumulative Layout Shift | How much did visible content move unexpectedly? (unitless score) | ≤ 0.1 |

Other numbers you'll hear: **TTFB** (time to first byte: the server and network), **FCP** (first contentful paint: *anything* shows), **TBT** (total blocking time: a lab proxy for responsiveness). They help you *diagnose*; the three above are what's *reported*.

### Lab vs field

- **Lab data** (Lighthouse, DevTools): one machine, one network, repeatable. Great for debugging a change. Can't see your users.
- **Field data / RUM** (*real user monitoring*: the Chrome UX Report, or your own beacons): thousands of real devices. Messy, but it's the truth. **You need both.**

## Reading INP: what happens during a tap

![One interaction split into input delay, processing time and presentation delay](fig:inp-anatomy "Each part has a different cause and a different fix.")

An interaction can feel slow for three different reasons:

1. **Input delay** — the main thread was **busy** (a long task) when the user tapped. *Fix:* break up long tasks; yield to the browser.
2. **Processing time** — your **event handler** runs too long. *Fix:* do the minimum, defer the rest (`setTimeout`, `requestIdleCallback`, `scheduler.yield()`, React `startTransition`).
3. **Presentation delay** — **rendering** the result is expensive (huge DOM update, heavy layout). *Fix:* update less, virtualise long lists, avoid layout thrash.

A **long task** is any task over **50 ms** on the main thread. Anything the user does during one has to wait for it.

**How INP is picked:** every interaction (a click, tap or key press, identified by an `interactionId`) gets a duration. INP is the **longest** one. On pages with lots of interactions, the single worst outlier is ignored for every 50 interactions, so one freak isn't the whole score.

## Reading CLS: shifts and session windows

A **layout shift** happens when a visible element moves between two frames without the user causing it. Each shift gets a score (how much of the screen moved × how far). Real pages shift a few times, so CLS groups shifts into **session windows**:

![Shifts grouped into session windows; CLS is the largest window total](fig:cls-windows "A new window starts after a gap of 1 second, or when the window reaches 5 seconds.")

```stepper Scoring CLS from five shifts
code:
  shifts = [
    { startTime:  100, value: 0.05 },
    { startTime:  450, value: 0.08 },
    { startTime:  800, value: 0.04 },
    { startTime: 2400, value: 0.12 },
    { startTime: 2500, value: 0.10, hadRecentInput: true },
  ]
---
line: 2
say: First shift at 100 ms scores **0.05**. There is no window yet, so we **start window 1** with total 0.05.
Window 1: 0.05
Windows so far: 1
---
line: 3-4
say: The next shifts come 350 ms and 350 ms after the previous one, both **under 1 second**, and the window is still younger than 5 seconds. They join window 1: 0.05 + 0.08 + 0.04.
Window 1: 0.17
Windows so far: 1
---
line: 5
say: The shift at 2400 ms comes **1600 ms after the last one**. A gap over 1 second ends the window, so this starts **window 2** with total 0.12.
Window 1: 0.17 (closed)
Window 2: 0.12
---
line: 6
say: The last shift happened right after a tap (`hadRecentInput: true`). Shifts the user caused **don't count**, so it's ignored.
Window 2: 0.12 (unchanged)
---
say: CLS is the **largest window**, not the sum: `max(0.17, 0.12)`. The page scores **0.17**, in "needs improvement".
CLS: 0.17
```

**Typical CLS causes and fixes:** images without `width`/`height` (reserve space with attributes or `aspect-ratio`), ads and embeds injected late (reserve a slot), web fonts swapping and changing text size (`font-display: optional` or size-matched fallbacks), banners inserted **above** existing content.

**Typical LCP causes and fixes:** a slow server (TTFB), the hero image discovered late (`<link rel="preload">`, `fetchpriority="high"`; never `loading="lazy"` on the LCP image), render-blocking CSS/JS, huge unoptimised images (use AVIF/WebP and `srcset`).

## Why the 75th percentile, and how to compute it

The **p-th percentile** is the value that p% of the samples are **at or below**. The simplest definition is the **nearest-rank** method: sort ascending, take the item at rank `ceil(p/100 × n)` (counting from 1).

```js try
function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);     // copy: don't mutate the caller's array
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

const loads = [1200, 1300, 1250, 1400, 1350, 1280, 1500, 9000];   // one terrible load
const average = loads.reduce((a, b) => a + b, 0) / loads.length;
console.log('average:', Math.round(average), '· median:', percentile(loads, 50), '· p75:', percentile(loads, 75));
```

The **average** is dragged around by one outlier, the **median** hides the slow quarter, the **p75** shows a number that three out of four users met or beat.

## Measuring in real browsers

Browsers expose measurements through **`PerformanceObserver`**: you ask for an entry type, and it calls you back with a list of entries, like the other observers you've met.

```js
// LCP: the last entry before the user interacts is the answer.
new PerformanceObserver((list) => {
  const entries = list.getEntries();
  const lcp = entries[entries.length - 1];          // the latest candidate
  report({ name: 'LCP', value: lcp.startTime });
}).observe({ type: 'largest-contentful-paint', buffered: true });   // buffered: also give me entries from before I started

// Layout shifts: add up value, skipping hadRecentInput.
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) if (!e.hadRecentInput) addShift(e);
}).observe({ type: 'layout-shift', buffered: true });
```

In practice you use Google's tiny **`web-vitals`** library, which handles the edge cases (back/forward cache, hidden tabs, iframes). Then **send** the numbers when the page is going away, using `navigator.sendBeacon`, because a normal `fetch` can be cancelled during unload:

```js
addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') navigator.sendBeacon('/rum', JSON.stringify(samples));
});
```

On the server (or in a tool) you then **group by metric, take the p75, and compare to the thresholds**. That's an exercise.

## Performance budgets

A **budget** turns "keep it small" into a check that fails the build. Typical budgets: JavaScript ≤ 170 KB (compressed), CSS ≤ 50 KB, total images per page, number of third-party requests. Common wins: **code-split by route**, **tree-shake**, drop heavy dependencies, lazy-load below-the-fold images and widgets, subset and preload fonts, defer third-party scripts. A budget checker is also an exercise.

## Quick check

```check
Q: Why report the 75th percentile instead of the average?
A) It is easier to compute
B) Outliers distort the average, and p75 shows what three out of four users experienced *
C) Browsers only provide p75
D) The average is always lower
Why: The slow quarter of users is invisible in an average dominated by typical loads, and one huge outlier can distort it.
---
Q: A user taps a button and the screen updates 400 ms later because the main thread was running a 350 ms task. Which part of the interaction is slow?
A) Input delay *
B) Processing time
C) Presentation delay
D) TTFB
Why: The tap had to wait for the busy main thread. Break up long tasks to fix it.
---
Q: A banner is inserted at the top 3 seconds after load, pushing the article down. Which metric suffers?
A) LCP
B) CLS *
C) INP
D) TTFB
Why: Visible content moved without the user causing it: a layout shift.
---
Q: How is CLS computed from many shifts?
A) The sum of all shifts
B) The largest single shift
C) The average shift
D) The largest total among session windows *
Why: Shifts are grouped into windows (gap under 1s, max 5s). The worst window is the score.
---
Q: Why send field metrics with `navigator.sendBeacon` on `visibilitychange`?
A) It is encrypted
B) It survives page unload, where a normal `fetch` may be cancelled *
C) It is faster than fetch
D) It bypasses CORS
Why: The page can disappear at any moment; `sendBeacon` is queued by the browser and delivered anyway.
```

## Recap

- **LCP** (loading), **INP** (responsiveness), **CLS** (visual stability), judged at **p75** of real users: ≤ 2.5 s / ≤ 200 ms / ≤ 0.1.
- **INP = input delay + processing + presentation**; long tasks (> 50 ms) cause delay. **CLS** groups shifts into session windows and ignores shifts caused by input.
- **Percentile (nearest-rank):** sort, take rank `ceil(p/100 × n)`. Don't trust averages.
- Measure with **`PerformanceObserver`** (or `web-vitals`), report with **`sendBeacon`**; combine **lab** and **field** data.
- Enforce a **budget** so regressions fail the build.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: percentile | The `percentile` snippet |
| CLS from layout shifts | The stepper: ignore input-caused shifts, session windows, take the largest |
| INP from interactions | One duration per interaction id, then pick the worst (skipping outliers on busy pages) |
| Summarise real-user metrics | p75 per metric, plus the thresholds table |
| Performance budget checker | Totals by type, compare with limits, name the heaviest file |

%% exercise web-guided-percentile | Guided: percentile | 1 | js | js | percentile | 8 | guided
Write `percentile(values, p)` using the **nearest-rank** method.

- Sort a **copy** of `values` ascending (don't change the caller's array).
- The rank is `Math.ceil((p / 100) * n)`, counting from 1, but never less than 1. The answer is the value at that rank.
- An empty array gives `null`.

```js
percentile([15, 20, 35, 40, 50], 40);   // 20   (rank ceil(0.4 × 5) = 2 → second smallest)
percentile([1, 2, 3, 4], 75);           // 3
percentile([], 50);                     // null
```

%% worked
**A similar problem, solved: `median(values)`** — the middle value of a list.

```js
function median(values) {
  if (values.length === 0) return null;                  // ① decide what an empty list means
  const sorted = [...values].sort((a, b) => a - b);      // ② copy, then sort NUMERICALLY (the default sort compares text!)
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;   // ③ odd: the middle; even: average the two middles
}
```

Two traps to remember: `[10, 9, 8].sort()` sorts as **text** and gives `[10, 8, 9]` (always pass `(a, b) => a - b`), and `sort` **mutates**, so copy first. Nearest-rank percentile is the same routine with a different index formula.

%% explain
- **Sorted copy:** the input array is left untouched, and unsorted input works.
- **Rank:** `ceil(p/100 × n)` from 1; `p = 0` still returns the smallest value, `p = 100` the largest.
- **Empty input:** returns `null`.

%% nudge
- What must you pass to `sort` so numbers sort numerically?
- Ranks start at 1 but arrays start at 0. What do you subtract?

%% starter
```js
export function percentile(values, p) {
  // Step 1 — empty array → null
  // Step 2 — copy and sort numerically:  [...values].sort((a, b) => a - b)
  // Step 3 — rank = Math.max(1, Math.ceil((p / 100) * sorted.length))
  // Step 4 — return sorted[rank - 1]
  return null;
}
```

%% tests
```js
describe('percentile', () => {
  it('uses nearest-rank', () => {
    expect(percentile([15, 20, 35, 40, 50], 40)).toBe(20);
    expect(percentile([15, 20, 35, 40, 50], 50)).toBe(35);
    expect(percentile([1, 2, 3, 4], 75)).toBe(3);
  });
  it('handles the extremes', () => {
    expect(percentile([5, 1, 9], 0)).toBe(1);
    expect(percentile([5, 1, 9], 100)).toBe(9);
  });
  it('sorts numerically, not as text', () => {
    expect(percentile([10, 9, 8, 100], 100)).toBe(100);
    expect(percentile([10, 9, 2], 50)).toBe(9);
  });
  it('does not mutate its input', () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    expect(input).toEqual([3, 1, 2]);
  });
  it('returns null for no data', () => {
    expect(percentile([], 75)).toBe(null);
  });
  it('works with a single value', () => {
    expect(percentile([42], 75)).toBe(42);
  });
});
```

%% hints
- `if (values.length === 0) return null;`
- `const sorted = [...values].sort((a, b) => a - b);`
- `const rank = Math.max(1, Math.ceil((p / 100) * sorted.length)); return sorted[rank - 1];`

%% solution
```js
export function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}
```

%% exercise web-cls | CLS from layout shifts | 3 | js | js | computeCls | 30
Write `computeCls(entries)`. Each entry is a `layout-shift` record: `{ value, startTime, hadRecentInput }` (`startTime` in ms).

- **Ignore** entries with `hadRecentInput: true` (the user caused them).
- Sort the rest by `startTime` (the input may be unordered).
- Group them into **session windows**. A shift **starts a new window** if it is **more than 1000 ms** after the previous shift in the window, **or more than 5000 ms** after the **first** shift in the window. Otherwise it joins the current window.
- **CLS is the largest window total.** No shifts at all gives `0`.

```js
computeCls([
  { value: 0.05, startTime: 100 }, { value: 0.08, startTime: 450 }, { value: 0.04, startTime: 800 },
  { value: 0.12, startTime: 2400 },
]); // 0.17  (window 1 = 0.05 + 0.08 + 0.04, window 2 = 0.12)
```

%% worked
**A similar problem, solved: `busiestBurst(times, gapMs)`** — find the most events in any burst, where a burst continues while events are less than `gapMs` apart.

```js
function busiestBurst(times, gapMs) {
  const sorted = [...times].sort((a, b) => a - b);     // ① order matters, so sort first
  let best = 0;
  let count = 0;
  let previous = -Infinity;
  for (const t of sorted) {
    if (t - previous > gapMs) count = 0;               // ② a big gap → start a new burst
    count++;
    previous = t;
    best = Math.max(best, count);                      // ③ remember the biggest so far
  }
  return best;
}
```

Grouping a sorted stream: keep a **running group**, decide for each item whether it **joins or starts a new group**, and update a **running maximum** as you go. For CLS the group also tracks its **first** time (for the 5-second cap) and a **sum** instead of a count.

%% explain
- **Input shifts:** entries with `hadRecentInput` never count.
- **Windows:** a gap greater than 1000 ms from the previous shift, or a span greater than 5000 ms from the window's first shift, starts a new window; exactly 1000 / 5000 still belongs to the current window.
- **Result:** the largest sum among windows (`0` with no valid shifts), regardless of input order.

%% nudge
- Which two timestamps do you need to remember about the current window?
- When do you compare the current window's total to the best total so far?

%% starter
```js
export function computeCls(entries) {
  // Step 1 — keep only entries where hadRecentInput is not true, sorted by startTime
  // Step 2 — walk through them tracking: windowStart, previousTime, windowSum
  // Step 3 — if (start - previousTime > 1000 || start - windowStart > 5000) → begin a new window (sum = 0, windowStart = start)
  // Step 4 — add the entry's value to the sum, update the best (largest) sum
  return 0;
}
```

%% tests
```js
const s = (value, startTime, hadRecentInput = false) => ({ value, startTime, hadRecentInput });

describe('computeCls', () => {
  it('is 0 without shifts', () => {
    expect(computeCls([])).toBe(0);
  });

  it('sums shifts in one window', () => {
    expect(computeCls([s(0.05, 100), s(0.08, 450), s(0.04, 800)])).toBeCloseTo(0.17, 5);
  });

  it('returns the largest window, not the total', () => {
    const entries = [s(0.05, 100), s(0.08, 450), s(0.04, 800), s(0.12, 2400)];
    expect(computeCls(entries)).toBeCloseTo(0.17, 5);
  });

  it('picks a later window when it is bigger', () => {
    expect(computeCls([s(0.02, 0), s(0.3, 3000)])).toBeCloseTo(0.3, 5);
  });

  it('ignores shifts that follow user input', () => {
    expect(computeCls([s(0.05, 100), s(0.5, 200, true)])).toBeCloseTo(0.05, 5);
    expect(computeCls([s(0.5, 100, true)])).toBe(0);
  });

  it('keeps shifts exactly 1000 ms apart in the same window', () => {
    expect(computeCls([s(0.1, 0), s(0.1, 1000)])).toBeCloseTo(0.2, 5);
    expect(computeCls([s(0.1, 0), s(0.1, 1001)])).toBeCloseTo(0.1, 5);
  });

  it('caps a window at 5 seconds from its first shift', () => {
    const chain = [0, 900, 1800, 2700, 3600, 4500, 5400].map((t) => s(0.01, t));
    expect(computeCls(chain)).toBeCloseTo(0.06, 5);
  });

  it('accepts unsorted input and does not mutate it', () => {
    const entries = [s(0.04, 800), s(0.05, 100), s(0.08, 450)];
    expect(computeCls(entries)).toBeCloseTo(0.17, 5);
    expect(entries[0].startTime).toBe(800);
  });
});
```

%% hints
- `const valid = entries.filter((e) => !e.hadRecentInput).sort((a, b) => a.startTime - b.startTime);`
- Track `let best = 0, sum = 0, windowStart = -Infinity, previous = -Infinity;`
- New window when `e.startTime - previous > 1000 || e.startTime - windowStart > 5000`.

%% solution
```js
export function computeCls(entries) {
  const valid = entries
    .filter((e) => !e.hadRecentInput)
    .sort((a, b) => a.startTime - b.startTime);

  let best = 0;
  let sum = 0;
  let windowStart = -Infinity;
  let previous = -Infinity;

  for (const e of valid) {
    if (e.startTime - previous > 1000 || e.startTime - windowStart > 5000) {
      sum = 0;
      windowStart = e.startTime;
    }
    sum += e.value;
    previous = e.startTime;
    best = Math.max(best, sum);
  }
  return best;
}
```

%% exercise web-inp | INP from interactions | 3 | js | js | computeInp | 30
Write `computeInp(entries)`. Each entry is an `event` timing record: `{ interactionId, duration }` (ms). One physical interaction produces **several** entries (for example `pointerdown`, `pointerup` and `click` share an `interactionId`).

- Entries whose `interactionId` is **missing or `0`** aren't interactions: ignore them.
- For each `interactionId`, the interaction's duration is its **longest** entry.
- With **no interactions**, return `null`.
- Otherwise sort the interaction durations from **slowest to fastest** and return the one at index `min(n - 1, floor(n / 50))`. So up to 49 interactions the answer is the **worst**; with 50 to 99 it is the **second worst**, and so on (one outlier is forgiven per 50 interactions).

%% worked
**A similar problem, solved: `slowestPerPage(visits)`** — each visit is `{ page, ms }`; many visits per page. Return the slowest time for each page.

```js
function slowestPerPage(visits) {
  const worst = new Map();                                          // ① group: key → best-so-far
  for (const { page, ms } of visits) {
    worst.set(page, Math.max(ms, worst.get(page) ?? -Infinity));    // ② keep the maximum per key
  }
  return Object.fromEntries(worst);                                 // ③ convert the Map to a plain object
}
```

For INP the *key* is `interactionId`, you keep the **max** duration per key, then you sort the group maxima and pick an index. Always **filter out the junk first** (no interaction id) so it can't pollute the groups.

%% explain
- **Grouping:** entries with the same non-zero `interactionId` collapse to their longest duration.
- **Ignored entries:** `interactionId` missing or `0`.
- **Under 50 interactions:** the result is the slowest interaction.
- **50 or more:** the worst `floor(n/50)` outliers are skipped, so the result is the next-slowest.
- **No interactions:** `null`.

%% nudge
- What data structure helps you keep "the longest duration so far" per id?
- After grouping, how do you sort descending, and which index do you read?

%% starter
```js
export function computeInp(entries) {
  // Step 1 — group by interactionId (skip falsy ids), keeping the max duration of each
  // Step 2 — if there are none, return null
  // Step 3 — durations sorted from slowest to fastest
  // Step 4 — return durations[Math.min(durations.length - 1, Math.floor(durations.length / 50))]
  return null;
}
```

%% tests
```js
const e = (interactionId, duration) => ({ interactionId, duration });

describe('computeInp', () => {
  it('returns null without interactions', () => {
    expect(computeInp([])).toBe(null);
    expect(computeInp([e(0, 500), { duration: 300 }])).toBe(null);
  });

  it('returns the slowest interaction', () => {
    expect(computeInp([e(1, 80), e(2, 240), e(3, 120)])).toBe(240);
  });

  it('uses the longest entry of each interaction', () => {
    expect(computeInp([e(1, 16), e(1, 90), e(1, 40), e(2, 60)])).toBe(90);
  });

  it('ignores entries without an interaction id', () => {
    expect(computeInp([e(0, 900), e(undefined, 800), e(1, 100)])).toBe(100);
  });

  it('is the worst of up to 49 interactions', () => {
    const many = Array.from({ length: 48 }, (_, i) => e(i + 1, 50 + i));
    many.push(e(100, 700));
    expect(computeInp(many)).toBe(700);
  });

  it('skips one outlier per 50 interactions', () => {
    const fifty = Array.from({ length: 50 }, (_, i) => e(i + 1, 100));
    fifty.push(e(51, 900));
    expect(computeInp(fifty)).toBe(100);
  });

  it('skips two outliers with 100 or more interactions', () => {
    const base = Array.from({ length: 100 }, (_, i) => e(i + 1, 100));
    base.push(e(500, 900), e(501, 800));
    expect(computeInp(base)).toBe(100);
  });
});
```

%% hints
- `const longest = new Map(); for (const { interactionId, duration } of entries) { if (!interactionId) continue; longest.set(interactionId, Math.max(duration, longest.get(interactionId) ?? 0)); }`
- `const durations = [...longest.values()].sort((a, b) => b - a);`
- `return durations[Math.min(durations.length - 1, Math.floor(durations.length / 50))];`

%% solution
```js
export function computeInp(entries) {
  const longest = new Map();
  for (const { interactionId, duration } of entries) {
    if (!interactionId) continue;
    longest.set(interactionId, Math.max(duration, longest.get(interactionId) ?? 0));
  }
  if (longest.size === 0) return null;
  const durations = [...longest.values()].sort((a, b) => b - a);
  return durations[Math.min(durations.length - 1, Math.floor(durations.length / 50))];
}
```

%% exercise web-vitals-summary | Summarise real-user metrics | 2 | js | js | summarizeVitals | 25
Real users send you samples like `{ name: 'LCP', value: 2300 }`. Write `summarizeVitals(samples)` that returns one summary per metric.

- Group by `name`. Only `LCP`, `INP` and `CLS` are known; **ignore other names**.
- For each metric that has samples, return `{ p75, rating, count }`:
  - `p75` is the **nearest-rank 75th percentile** (sort ascending, take rank `ceil(0.75 × n)` counting from 1).
  - `rating` is `'good'` if `p75 <=` the good limit, `'needs-improvement'` if `p75 <=` the poor limit, otherwise `'poor'`.
  - `count` is the number of samples.
- Limits (good / poor): **LCP** 2500 / 4000 ms, **INP** 200 / 500 ms, **CLS** 0.1 / 0.25.
- Metrics with no samples are **left out** of the result. Don't change the input.

```js
summarizeVitals([{ name: 'LCP', value: 2000 }, { name: 'LCP', value: 5000 }, { name: 'FID', value: 10 }]);
// { LCP: { p75: 5000, rating: 'poor', count: 2 } }
```

%% worked
**A similar problem, solved: `gradeScores(scores)`** — group scores by subject, report the average and a letter.

```js
const LIMITS = { math: 50, art: 40 };                          // ① a table beats a pile of if/else

function gradeScores(scores) {
  const groups = {};
  for (const { subject, value } of scores) {
    if (!(subject in LIMITS)) continue;                         // ② skip unknown subjects
    (groups[subject] ??= []).push(value);                       // ③ group: create the list on first use
  }
  const out = {};
  for (const [subject, values] of Object.entries(groups)) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    out[subject] = { avg, pass: avg >= LIMITS[subject], count: values.length };
  }
  return out;                                                   // ④ subjects without scores never appear
}
```

The pattern is **table of rules → group → compute per group**. Keep the thresholds in one data table so the logic stays short and adding a metric is one line.

%% explain
- **Known metrics only:** `LCP`, `INP` and `CLS`; other names are skipped.
- **p75:** nearest-rank on the sorted values (`[1000, 2000, 3000, 4000]` → `3000`).
- **Rating:** boundaries are inclusive: exactly the good limit is `good`, exactly the poor limit is `needs-improvement`.
- **Shape:** keys exist only for metrics that have at least one sample.

%% nudge
- Where would you keep each metric's two limits so the rating code is the same for all three?
- What goes wrong if you sort the values without a numeric comparator?

%% starter
```js
const LIMITS = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
};

export function summarizeVitals(samples) {
  // Step 1 — group sample values by name, skipping names not in LIMITS
  // Step 2 — for each group: sort ascending, p75 = sorted[Math.ceil(0.75 * n) - 1]
  // Step 3 — rating from LIMITS[name]: good if p75 <= first, needs-improvement if <= second, else poor
  return {};
}
```

%% tests
```js
const s = (name, value) => ({ name, value });

describe('summarizeVitals', () => {
  it('returns an empty object without samples', () => {
    expect(summarizeVitals([])).toEqual({});
  });

  it('computes p75, rating and count per metric', () => {
    const out = summarizeVitals([s('LCP', 1000), s('LCP', 2000), s('LCP', 3000), s('LCP', 4000)]);
    expect(out).toEqual({ LCP: { p75: 3000, rating: 'needs-improvement', count: 4 } });
  });

  it('handles several metrics at once', () => {
    const out = summarizeVitals([s('INP', 150), s('CLS', 0.3), s('CLS', 0.05), s('INP', 120), s('INP', 600), s('INP', 100)]);
    expect(out.INP).toEqual({ p75: 150, rating: 'good', count: 4 });
    expect(out.CLS).toEqual({ p75: 0.3, rating: 'poor', count: 2 });
    expect(out.LCP).toBe(undefined);
  });

  it('uses inclusive boundaries', () => {
    expect(summarizeVitals([s('LCP', 2500)]).LCP.rating).toBe('good');
    expect(summarizeVitals([s('LCP', 2501)]).LCP.rating).toBe('needs-improvement');
    expect(summarizeVitals([s('LCP', 4000)]).LCP.rating).toBe('needs-improvement');
    expect(summarizeVitals([s('LCP', 4001)]).LCP.rating).toBe('poor');
    expect(summarizeVitals([s('CLS', 0.1)]).CLS.rating).toBe('good');
  });

  it('ignores unknown metrics', () => {
    expect(summarizeVitals([s('FID', 5), s('TTFB', 100)])).toEqual({});
  });

  it('sorts numerically (not as text)', () => {
    const out = summarizeVitals([s('INP', 90), s('INP', 1000), s('INP', 250), s('INP', 80)]);
    expect(out.INP.p75).toBe(250);
  });

  it('does not mutate the input', () => {
    const input = [s('LCP', 3000), s('LCP', 1000)];
    summarizeVitals(input);
    expect(input[0].value).toBe(3000);
  });
});
```

%% hints
- `const groups = {}; for (const { name, value } of samples) { if (!(name in LIMITS)) continue; (groups[name] ??= []).push(value); }`
- `const sorted = [...values].sort((a, b) => a - b); const p75 = sorted[Math.ceil(0.75 * sorted.length) - 1];`
- `const [good, poor] = LIMITS[name]; const rating = p75 <= good ? 'good' : p75 <= poor ? 'needs-improvement' : 'poor';`

%% solution
```js
const LIMITS = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
};

export function summarizeVitals(samples) {
  const groups = {};
  for (const { name, value } of samples) {
    if (!(name in LIMITS)) continue;
    (groups[name] ??= []).push(value);
  }
  const out = {};
  for (const [name, values] of Object.entries(groups)) {
    const sorted = [...values].sort((a, b) => a - b);
    const p75 = sorted[Math.ceil(0.75 * sorted.length) - 1];
    const [good, poor] = LIMITS[name];
    out[name] = { p75, rating: p75 <= good ? 'good' : p75 <= poor ? 'needs-improvement' : 'poor', count: values.length };
  }
  return out;
}
```

%% exercise web-budget | Performance budget checker | 2 | js | js | checkBudget | 25
Write `checkBudget(resources, budget)` for a CI step that fails when a page gets too heavy.

- `resources` is a list of `{ url, type, bytes }` where `type` is `'js'`, `'css'`, `'img'`, `'font'` or `'other'`.
- `budget` maps a type **or `'total'`** to a byte limit, e.g. `{ js: 170000, total: 500000 }`. Types missing from the budget have no limit.
- Return `{ ok, totals, violations }`:
  - `totals`: bytes per type that appears in `resources`, plus `total` for everything.
  - `violations`: one entry for each budget key whose actual bytes are **greater than** (not equal to) its limit: `{ key, actual, limit, over, heaviest }`, where `over = actual - limit` and `heaviest` is the **url of the largest single resource** of that type (for `'total'`, the largest resource overall).
  - Sort violations by `over`, largest first. `ok` is `true` when there are none.

%% worked
**A similar problem, solved: `checkQuota(files, quotas)`** — report which folders are over their size quota.

```js
function checkQuota(files, quotas) {
  const used = {};
  for (const { folder, size } of files) used[folder] = (used[folder] ?? 0) + size;   // ① totals per group

  const over = [];
  for (const [folder, limit] of Object.entries(quotas)) {
    const actual = used[folder] ?? 0;                                                 // ② a missing group counts as 0
    if (actual > limit) over.push({ folder, actual, limit, over: actual - limit });   // ③ strictly greater
  }
  return over.sort((a, b) => b.over - a.over);                                        // ④ worst first
}
```

Same recipe: **sum per group**, **loop over the rules** (not over the data), **compare with `>`**, **sort** the report. For the "heaviest file" you need one more pass: filter the files of that group and pick the maximum with `reduce`.

%% explain
- **Totals:** per-type sums for types that appear, plus `total`.
- **Violations:** only when strictly over the limit; keys without a limit are ignored, including types that never appear (0 bytes).
- **Details:** `over` is the excess and `heaviest` the biggest file of that type (or overall for `total`).
- **Order and flag:** most-over first; `ok` is `violations.length === 0`.

%% nudge
- Which loop is cleaner for violations: over the resources or over the budget entries?
- For `total`, what plays the role of "the files of that type"?

%% starter
```js
export function checkBudget(resources, budget) {
  // Step 1 — totals: sum bytes per type and overall (total)
  // Step 2 — for each [key, limit] in budget: actual = totals[key] ?? 0; violation if actual > limit
  // Step 3 — heaviest: the url of the largest resource of that type (all resources for 'total')
  // Step 4 — sort violations by over, descending; ok = no violations
  return { ok: true, totals: {}, violations: [] };
}
```

%% tests
```js
const r = (url, type, bytes) => ({ url, type, bytes });
const files = [
  r('/app.js', 'js', 120000),
  r('/vendor.js', 'js', 90000),
  r('/main.css', 'css', 20000),
  r('/hero.jpg', 'img', 300000),
  r('/logo.png', 'img', 10000),
];

describe('checkBudget', () => {
  it('passes when everything is within budget', () => {
    const out = checkBudget(files, { js: 300000, css: 50000, total: 1000000 });
    expect(out.ok).toBe(true);
    expect(out.violations).toEqual([]);
  });

  it('reports totals per type and overall', () => {
    const out = checkBudget(files, {});
    expect(out.totals).toEqual({ js: 210000, css: 20000, img: 310000, total: 540000 });
  });

  it('flags a type over its limit with the heaviest file', () => {
    const out = checkBudget(files, { js: 170000 });
    expect(out.ok).toBe(false);
    expect(out.violations).toEqual([{ key: 'js', actual: 210000, limit: 170000, over: 40000, heaviest: '/app.js' }]);
  });

  it('treats a total budget as covering every resource', () => {
    const out = checkBudget(files, { total: 500000 });
    expect(out.violations).toEqual([{ key: 'total', actual: 540000, limit: 500000, over: 40000, heaviest: '/hero.jpg' }]);
  });

  it('sorts violations by how far over they are', () => {
    const out = checkBudget(files, { js: 100000, img: 100000, css: 10000 });
    expect(out.violations.map((v) => v.key)).toEqual(['img', 'js', 'css']);
  });

  it('does not flag usage exactly at the limit', () => {
    expect(checkBudget(files, { css: 20000 }).ok).toBe(true);
  });

  it('ignores types without a limit and treats missing types as 0 bytes', () => {
    const out = checkBudget(files, { font: 1000 });
    expect(out.ok).toBe(true);
    expect(out.totals.font).toBe(undefined);
  });

  it('handles no resources', () => {
    expect(checkBudget([], { js: 10 })).toEqual({ ok: true, totals: { total: 0 }, violations: [] });
  });
});
```

%% hints
- `const totals = { total: 0 }; for (const { type, bytes } of resources) { totals[type] = (totals[type] ?? 0) + bytes; totals.total += bytes; }`
- `const pool = key === 'total' ? resources : resources.filter((x) => x.type === key);`
- `const heaviest = pool.reduce((a, b) => (b.bytes > a.bytes ? b : a)).url;` (only reached when actual > limit ≥ 0, so the pool is not empty)

%% solution
```js
export function checkBudget(resources, budget) {
  const totals = { total: 0 };
  for (const { type, bytes } of resources) {
    totals[type] = (totals[type] ?? 0) + bytes;
    totals.total += bytes;
  }

  const violations = [];
  for (const [key, limit] of Object.entries(budget)) {
    const actual = totals[key] ?? 0;
    if (actual <= limit) continue;
    const pool = key === 'total' ? resources : resources.filter((x) => x.type === key);
    const heaviest = pool.reduce((a, b) => (b.bytes > a.bytes ? b : a)).url;
    violations.push({ key, actual, limit, over: actual - limit, heaviest });
  }
  violations.sort((a, b) => b.over - a.over);
  return { ok: violations.length === 0, totals, violations };
}
```
