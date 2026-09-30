---
id: prod-large-data
track: prod
title: Case study: 20 000 events on one screen
summary: The events page takes nine seconds to show anything. Paginate with cursors, store data in an indexed form, slice long work into small chunks, and load pages without races.
---

> **INCIDENT — Monday morning, cold cache.** The "All events" screen shows a blank page for ~9 seconds on mid-range Android, and the tab occasionally crashes on older iPhones.
>
> **What the trace shows:** a single 14 MB JSON response (20 000 events, every field of every market). `JSON.parse` = 600 ms of main-thread time. Then a 400 ms `Array.sort`, then React mounting 20 000 rows (≈ 4 s scripting, ≈ 2 s layout). Memory peaks at 900 MB.

## The idea in one sentence

Don't load, parse, sort and draw **everything at once** — bring in **only what the user can see, in small steps, in a shape that's fast to use**.

> **Analogy** A library doesn't hand you every book on entering. You ask the librarian for **the next shelf** (pagination), they keep an **index card catalogue** so finding a book isn't a walk past every shelf (indexes), and they fetch things **between serving other readers** instead of making everyone wait (time slicing).

## Anatomy of the problem

Everything happened **at once**, **on the main thread**, for data the user **can't even see**. Each step has a standard remedy:

| Symptom | Remedy |
| --- | --- |
| 14 MB payload | **Paginate** (cursor), select only the fields the list needs, compress, cache |
| 20 000 rows mounted | **Virtualise** (from the React track): only ~30 rows exist |
| Sorting / grouping on every update | **Normalise + index once**, merge new pages incrementally |
| A 600 ms task blocks input | **Time-slice** long loops so the browser can paint and handle taps between chunks |
| Requests racing / duplicate rows | Idempotent, race-safe page loading |

## Cursor vs offset pagination

`?page=40&limit=100` (**offset**) is simple, but wrong for *live* data: while you read page 40, new events are inserted at the top, so page 41 repeats the last row of page 40 (or skips one). A **cursor** (`?after=evt_8123`) says "continue after *this* item", which is stable under inserts — and lets the database jump straight there with an index instead of scanning past `OFFSET 4000` rows.

![Offset pagination repeats an item when something is inserted; cursor pagination does not](fig:offset-vs-cursor "Whichever you use, the client must dedupe by id.")

```js try
let events = ['E5', 'E4', 'E3', 'E2', 'E1'];           // newest first

const pageByOffset = (page, size) => events.slice(page * size, page * size + size);
const pageAfter = (id, size) => { const i = events.indexOf(id); return events.slice(i + 1, i + 1 + size); };

const first = pageByOffset(0, 3);
console.log('page 1:', first);

events = ['E6', ...events];                             // a new event arrives while you are reading

console.log('offset page 2:', pageByOffset(1, 3));      // E3 appears again!
console.log('cursor after E3:', pageAfter('E3', 3));    // E2, E1 — no repeat
```

## Normalise, then index

Store each entity **once**, by id, and keep separate structures for *ordering* and *lookup*:

![byId, an ordered id list and an idsByLeague index](fig:normalised-store "Updates touch one entry; filtering is an index read.")

```ts
{ byId: { evt1: {...}, evt2: {...} },
  ids: ['evt2', 'evt1'],                              // display order
  idsByLeague: { epl: ['evt2'], laliga: ['evt1'] } }  // O(1) filter
```

- An update changes **one** entry instead of rewriting arrays.
- Filtering by league reads an index, not a 20 000-item `.filter` on every keystroke.
- **Merge** each new page into the sorted order: sort just the *page*, then merge two sorted lists in **O(n + m)**. Re-sorting everything each time costs O(n log n) per page.

Watch the merge step by step:

```stepper Merging two sorted lists
code:
  function merge(a, b) {
    const out = [];
    let i = 0, j = 0;
    while (i < a.length && j < b.length) {
      out.push(a[i] <= b[j] ? a[i++] : b[j++]);
    }
    return out.concat(a.slice(i), b.slice(j));
  }
  merge([1, 4, 9], [2, 3, 10]);
---
line: 4-6
say: Look at the **front** of each list: `a[0] = 1` and `b[0] = 2`. The smaller one goes to the output, and only that list moves forward.
Comparing: 1 vs 2
out: 1
---
line: 4-6
say: Now `a[1] = 4` vs `b[0] = 2`. `2` is smaller.
Comparing: 4 vs 2
out: 1 | 2
---
line: 4-6
say: `4` vs `3` → `3`.
Comparing: 4 vs 3
out: 1 | 2 | 3
---
line: 4-6
say: `4` vs `10` → `4`. `a` moves on to `9`.
Comparing: 4 vs 10
out: 1 | 2 | 3 | 4
---
line: 4-6
say: `9` vs `10` → `9`. Now list `a` is used up, so the loop stops.
Comparing: 9 vs 10
out: 1 | 2 | 3 | 4 | 9
---
line: 7
say: One of the lists still has items (`10`). Since both inputs were sorted, the leftovers are already in order — just append them. Every item was touched once: **O(n + m)**.
Comparing: (done)
out: 1 | 2 | 3 | 4 | 9 | 10
```

## Time slicing

You can't make a 600 ms job fast, but you can make it **not block**: work for a small **budget** (say 8 ms), then hand the thread back and continue in the next task.

![One long task versus many slices with yields between them](fig:time-slice "Between slices the browser can paint and respond to taps.")

Ways to yield: `scheduler.yield()` (Chromium), `MessageChannel` / `setTimeout(0)` as a fallback, `requestIdleCallback` for low priority. Two rules: always process **at least one item** per slice (or a tiny budget loops forever), and always allow **cancellation** (the user navigated away).

```js try
async function processInChunks(items, processItem, budgetMs = 8) {
  let index = 0;
  let chunks = 0;
  while (index < items.length) {
    const start = Date.now();
    do {
      processItem(items[index], index);
      index++;
    } while (index < items.length && Date.now() - start < budgetMs);   // do…while: at least ONE item per slice
    chunks++;
    if (index < items.length) await new Promise((resolve) => setTimeout(resolve, 0));  // yield to the browser
  }
  return { processed: index, chunks };
}

const items = Array.from({ length: 200000 }, (_, i) => i);
let sum = 0;
processInChunks(items, (n) => { sum += Math.sqrt(n); }).then((r) => console.log('processed', r.processed, 'in', r.chunks > 1 ? 'several chunks' : 'one chunk'));
```

## Paging in the UI

A `usePagedEvents` hook is the smallest correct piece of data-fetching infrastructure. The traps: **double-firing `loadMore`** from an intersection observer, a slow response from *before* a refresh overwriting fresh data, unmounted components updating state, and losing already-loaded rows when a later page fails.

## Also worth knowing

- **Stale-while-revalidate:** paint from the cache instantly, refresh in the background.
- **Streaming parse:** NDJSON + `fetch().body.getReader()` lets the first rows render before the last byte arrives.
- **`content-visibility: auto`** skips layout/paint for off-screen sections.
- **Web Workers** for parsing/normalising big payloads (a later lesson).
- Budget for **low-end devices**: throttle the CPU 4–6× in DevTools when you measure.

## Quick check

```check
Q: Why is offset pagination a problem for a live list?
A) It is slower on the client
B) It doesn't work with JSON
C) It requires cookies
D) New items shifting positions make pages repeat or skip items *
Why: The offset counts rows from the top, so an insert shifts everything down. A cursor anchors to a specific item.
---
Q: Why keep an `idsByLeague` index next to the entities?
A) To filter by league without scanning every event *
B) To save disk space
C) To sort events
D) It is required by React
Why: An index turns "all events in league X" into a direct lookup instead of a filter over 20,000 items.
---
Q: Merging a sorted page into an already sorted list is…
A) O(n²)
B) O(n log n) every time
C) O(n + m), because both inputs are already sorted *
D) Impossible without sorting
Why: Two sorted lists can be merged by walking both once. Re-sorting everything costs more.
---
Q: Why must a time-sliced loop process at least one item per slice?
A) To keep the code short
B) Otherwise a tiny (or zero) budget would never make progress *
C) Because `setTimeout` needs it
D) To avoid memory leaks
Why: If the budget is already used up before the first item, the loop would yield forever without doing work.
---
Q: A user pages to the end quickly and the intersection observer fires `loadMore` three times. What protects you?
A) Nothing; that's normal
B) A bigger page size
C) `loadMore` is a no-op while a request is in flight *
D) Disabling the observer
Why: An in-flight guard turns extra calls into no-ops, so you don't request the same page repeatedly.
```

## Recap

- Load **less**, **later**, in a **faster shape**: cursor pagination, virtualised rows, normalised + indexed data.
- **Cursor > offset** for live data; always **dedupe by id**.
- **Merge** sorted pages in O(n + m) instead of re-sorting.
- **Time-slice** long work (budget ~8 ms, at least one item, cancellable).
- Make paging hooks **race-safe**: in-flight guard, ignore stale responses, keep loaded rows on error.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: merge two sorted lists | The merge stepper |
| Normalised event store | `byId` + ordered ids + league index, and merge-on-insert |
| Time-sliced processing | The `processInChunks` snippet, plus abort and error handling |
| `usePagedEvents` | The paging traps list, an in-flight guard, a "generation" counter to ignore stale responses |

%% exercise prod-guided-merge | Guided: merge two sorted lists | 1 | js | js | mergeSorted | 6 | guided
Write `mergeSorted(a, b)`. `a` and `b` are arrays of numbers, each already sorted ascending. Return a **new** sorted array with every number from both, **without re-sorting**.

```js
mergeSorted([1, 4, 9], [2, 3, 10]); // [1, 2, 3, 4, 9, 10]
```

- When two numbers are equal, take the one from `a` first.
- Do not change `a` or `b`.

%% worked
**A similar problem, solved: `mergeByLength(a, b)`** — the same two-pointer walk, comparing *string lengths* instead of numbers.

```js
function mergeByLength(a, b) {
  const out = [];
  let i = 0;                                   // ① one pointer per list
  let j = 0;
  while (i < a.length && j < b.length) {       // ② keep going while BOTH lists have items
    if (a[i].length <= b[j].length) out.push(a[i++]);   // ③ take the smaller front item and advance THAT pointer
    else out.push(b[j++]);
  }
  while (i < a.length) out.push(a[i++]);       // ④ one list is used up: copy the rest of the other
  while (j < b.length) out.push(b[j++]);
  return out;
}
```

Because both inputs are already sorted, the smallest remaining item is always at the front of one of them — so you never need to sort again. Each item is touched once: **O(n + m)**.

%% explain
- **Output is sorted** and contains every item from both lists.
- **Ties**: equal numbers take the one from `a` first.
- **Inputs are not changed.**
- **Works when one list is empty.**

%% nudge
- Which two values do you compare on each step?
- When the loop stops, what might still be left over?

%% starter
```js
export function mergeSorted(a, b) {
  const out = [];
  // Step 1 — two pointers:   let i = 0, j = 0;
  // Step 2 — while BOTH lists have items, push the smaller front item and move THAT pointer
  //          (use <= so ties take from `a`).
  // Step 3 — push whatever is left in a, then whatever is left in b.
  return out;
}
```

%% tests
```js
describe('mergeSorted', () => {
  it('merges two sorted lists', () => {
    expect(mergeSorted([1, 4, 9], [2, 3, 10])).toEqual([1, 2, 3, 4, 9, 10]);
  });

  it('handles empty lists', () => {
    expect(mergeSorted([], [1, 2])).toEqual([1, 2]);
    expect(mergeSorted([1, 2], [])).toEqual([1, 2]);
    expect(mergeSorted([], [])).toEqual([]);
  });

  it('keeps duplicates', () => {
    expect(mergeSorted([1, 2, 2], [2, 3])).toEqual([1, 2, 2, 2, 3]);
  });

  it('does not change its inputs', () => {
    const a = [1, 3];
    const b = [2];
    mergeSorted(a, b);
    expect(a).toEqual([1, 3]);
    expect(b).toEqual([2]);
  });

  it('is linear, not a full sort', () => {
    const a = Array.from({ length: 50000 }, (_, i) => i * 2);
    const b = Array.from({ length: 50000 }, (_, i) => i * 2 + 1);
    const t = Date.now();
    const out = mergeSorted(a, b);
    expect(out.length).toBe(100000);
    expect(out[99999]).toBe(99999);
    expect(Date.now() - t).toBeLessThan(500);
  });
});
```

%% hints
- `while (i < a.length && j < b.length) { out.push(a[i] <= b[j] ? a[i++] : b[j++]); }`
- After the loop: `while (i < a.length) out.push(a[i++]);` and the same for `b`.

%% solution
```js
export function mergeSorted(a, b) {
  const out = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}
```

%% exercise prod-event-store | Normalised event store with indexes | 3 | js | js | createEventStore | 30
Build `createEventStore()`.

An event looks like `{ id, leagueId, startTime, updatedAt, name }` (`startTime`/`updatedAt` are millisecond timestamps).

- `addPage(events)` merges a page and returns `{ added, updated, ignored }` counts.
  - Unknown id → **added**.
  - Known id with a strictly **newer** `updatedAt` → **updated** (replace the stored event). An older or equal `updatedAt` → **ignored**.
  - The same id may appear twice in one page: treat it like two sequential arrivals.
- `get(id)`, `size`.
- `list()` → all events ordered by `startTime` ascending, ties broken by `id` (string order).
- `byLeague(leagueId)` → that league's events in the same order (`[]` if unknown). Updating an event's `startTime` or `leagueId` must keep both views correct.
- **Performance:** 60 000 events loaded in pages of 200 must take well under a second, so don't re-sort everything per page.

%% starter
```js
export function createEventStore() {
  // your code
}
```

%% tests
```js
const ev = (id, over = {}) => ({ id, leagueId: 'epl', startTime: 1000, updatedAt: 1, name: id, ...over });

describe('createEventStore', () => {
  it('adds events and reports counts', () => {
    const s = createEventStore();
    expect(s.addPage([ev('a'), ev('b')])).toEqual({ added: 2, updated: 0, ignored: 0 });
    expect(s.size).toBe(2);
    expect(s.get('a').name).toBe('a');
    expect(s.get('zzz')).toBeUndefined();
  });

  it('lists by startTime ascending, ties by id', () => {
    const s = createEventStore();
    s.addPage([ev('c', { startTime: 300 }), ev('b', { startTime: 100 }), ev('a', { startTime: 100 })]);
    expect(s.list().map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('merges pages into the existing order', () => {
    const s = createEventStore();
    s.addPage([ev('a', { startTime: 100 }), ev('c', { startTime: 300 })]);
    s.addPage([ev('b', { startTime: 200 }), ev('d', { startTime: 400 }), ev('z', { startTime: 50 })]);
    expect(s.list().map((e) => e.id)).toEqual(['z', 'a', 'b', 'c', 'd']);
  });

  it('replaces an event only when updatedAt is strictly newer', () => {
    const s = createEventStore();
    s.addPage([ev('a', { updatedAt: 10, name: 'v10' })]);
    expect(s.addPage([ev('a', { updatedAt: 5, name: 'older' })])).toEqual({ added: 0, updated: 0, ignored: 1 });
    expect(s.addPage([ev('a', { updatedAt: 10, name: 'same' })])).toEqual({ added: 0, updated: 0, ignored: 1 });
    expect(s.get('a').name).toBe('v10');
    expect(s.addPage([ev('a', { updatedAt: 11, name: 'v11' })])).toEqual({ added: 0, updated: 1, ignored: 0 });
    expect(s.get('a').name).toBe('v11');
    expect(s.size).toBe(1);
  });

  it('handles duplicates inside a single page as sequential arrivals', () => {
    const s = createEventStore();
    const res = s.addPage([ev('a', { updatedAt: 1, name: 'first' }), ev('a', { updatedAt: 2, name: 'second' }), ev('a', { updatedAt: 1, name: 'stale' })]);
    expect(res).toEqual({ added: 1, updated: 1, ignored: 1 });
    expect(s.get('a').name).toBe('second');
    expect(s.list()).toHaveLength(1);
  });

  it('indexes by league in the same order', () => {
    const s = createEventStore();
    s.addPage([
      ev('a', { leagueId: 'epl', startTime: 300 }),
      ev('b', { leagueId: 'liga', startTime: 100 }),
      ev('c', { leagueId: 'epl', startTime: 200 }),
    ]);
    expect(s.byLeague('epl').map((e) => e.id)).toEqual(['c', 'a']);
    expect(s.byLeague('liga').map((e) => e.id)).toEqual(['b']);
    expect(s.byLeague('nope')).toEqual([]);
  });

  it('repositions an event whose startTime changed', () => {
    const s = createEventStore();
    s.addPage([ev('a', { startTime: 100 }), ev('b', { startTime: 200 }), ev('c', { startTime: 300 })]);
    s.addPage([ev('a', { startTime: 250, updatedAt: 2 })]);
    expect(s.list().map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(s.byLeague('epl').map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('moves an event between leagues when leagueId changes', () => {
    const s = createEventStore();
    s.addPage([ev('a', { leagueId: 'epl' }), ev('b', { leagueId: 'epl', startTime: 2000 })]);
    s.addPage([ev('a', { leagueId: 'liga', updatedAt: 2 })]);
    expect(s.byLeague('epl').map((e) => e.id)).toEqual(['b']);
    expect(s.byLeague('liga').map((e) => e.id)).toEqual(['a']);
    expect(s.size).toBe(2);
  });

  it('returns the stored object identity for get()', () => {
    const s = createEventStore();
    s.addPage([ev('a')]);
    expect(s.get('a')).toBe(s.list()[0]);
  });

  it('loads 60 000 events in pages of 200 quickly (no full re-sort per page)', () => {
    const s = createEventStore();
    const total = 60000;
    let seed = 12345;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const all = Array.from({ length: total }, (_, i) => ev(`e${String(i).padStart(6, '0')}`, { startTime: Math.floor(rnd() * 1e9), leagueId: `l${i % 20}` }));
    const t0 = Date.now();
    for (let i = 0; i < total; i += 200) s.addPage(all.slice(i, i + 200));
    const elapsed = Date.now() - t0;
    expect(s.size).toBe(total);
    const ids = s.list();
    for (let i = 1; i < ids.length; i += 997) expect(ids[i - 1].startTime <= ids[i].startTime).toBe(true);
    expect(s.byLeague('l3')).toHaveLength(3000);
    expect(elapsed).toBeLessThan(1500);
  });
});
```

%% worked
**A similar problem, solved: a tiny indexed store for books.**

```js
function createBookStore() {
  const byId = new Map();                           // ① each entity stored ONCE
  const byAuthor = new Map();                       // ② an index: author → Set of ids

  function index(book) { (byAuthor.get(book.author) ?? byAuthor.set(book.author, new Set()).get(book.author)).add(book.id); }
  function unindex(book) { byAuthor.get(book.author)?.delete(book.id); }

  return {
    upsert(book) {
      const old = byId.get(book.id);
      if (old && old.updatedAt >= book.updatedAt) return 'ignored';   // ③ older or equal → ignore
      if (old) unindex(old);                                          // ④ an update may change the indexed field → fix the OLD index entry first
      byId.set(book.id, book);
      index(book);
      return old ? 'updated' : 'added';
    },
    byAuthor: (a) => [...(byAuthor.get(a) ?? [])].map((id) => byId.get(id)),
  };
}
```

For events the ordered views (`list()`, `byLeague`) must be **sorted by `startTime`, then `id`**. Don't re-sort everything for each page: sort the *incoming page*, then merge it into the existing order (see the guided exercise). If an event's `startTime` or `leagueId` changes, remove its old position/index entry before inserting the new one. The same id can appear twice in one page — treat them as two sequential arrivals, so process the page items in order.

%% explain
- **`addPage(events)`** returns `{ added, updated, ignored }`: unknown id → added; newer `updatedAt` → updated; older or equal → ignored. Duplicates within one page act like sequential arrivals.
- **`get(id)`, `size`**; **`list()`** ordered by `startTime` then `id`; **`byLeague(id)`** same order (`[]` if unknown).
- **Changing `startTime` or `leagueId`** keeps both views correct.
- **Fast**: 60,000 events in pages of 200 in well under a second — don't re-sort everything per page.

%% nudge
- When an event is updated, which index entries must you remove before adding the new ones?
- How can you keep the ordered list sorted without sorting all 60,000 items for each page?

%% hints
- Keep `byId` (a `Map`), `ids` (sorted array of ids) and `idsByLeague` (`Map<league, sorted array of ids>`).
- For each incoming event decide added/updated/ignored *first*; collect the ones that need (re)positioning.
- To merge a sorted batch into a sorted array in O(n + m): sort the batch, then walk both arrays with two pointers — never call `sort` on the big array.
- If an updated event's `startTime` or `leagueId` changed, remove its id from the old arrays (`filter` with a `Set` of moved ids, once per page) and re-insert it like a new one.
- Compare with `(a, b) => a.startTime - b.startTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)`.

%% solution
```js
export function createEventStore() {
  const byId = new Map();
  let entries = []; // { id, startTime, leagueId } kept sorted; comparisons never touch the Map
  const leagues = new Map(); // leagueId -> sorted entries

  const cmp = (a, b) => a.startTime - b.startTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  // Merge a sorted batch into a sorted list in O(n + m).
  function merge(list, batch) {
    if (batch.length === 0) return list;
    const out = new Array(list.length + batch.length);
    let i = 0, j = 0, k = 0;
    while (i < list.length && j < batch.length) out[k++] = cmp(list[i], batch[j]) <= 0 ? list[i++] : batch[j++];
    while (i < list.length) out[k++] = list[i++];
    while (j < batch.length) out[k++] = batch[j++];
    return out;
  }

  return {
    addPage(events) {
      const counts = { added: 0, updated: 0, ignored: 0 };
      const pending = new Map(); // id -> entry that must be (re)inserted this page
      const moved = new Set(); // ids whose old entry must be removed first

      for (const event of events) {
        const existing = byId.get(event.id);
        if (!existing) {
          counts.added++;
          byId.set(event.id, event);
          pending.set(event.id, { id: event.id, startTime: event.startTime, leagueId: event.leagueId });
        } else if (event.updatedAt > existing.updatedAt) {
          counts.updated++;
          byId.set(event.id, event);
          const entry = pending.get(event.id);
          if (entry) {
            entry.startTime = event.startTime;
            entry.leagueId = event.leagueId;
          } else if (existing.startTime !== event.startTime || existing.leagueId !== event.leagueId) {
            moved.add(event.id);
            pending.set(event.id, { id: event.id, startTime: event.startTime, leagueId: event.leagueId });
          }
        } else {
          counts.ignored++;
        }
      }

      if (moved.size) {
        entries = entries.filter((e) => !moved.has(e.id));
        for (const [league, list] of leagues) leagues.set(league, list.filter((e) => !moved.has(e.id)));
      }

      const batch = [...pending.values()].sort(cmp);
      entries = merge(entries, batch);
      const perLeague = new Map();
      for (const e of batch) {
        if (!perLeague.has(e.leagueId)) perLeague.set(e.leagueId, []);
        perLeague.get(e.leagueId).push(e);
      }
      for (const [league, items] of perLeague) leagues.set(league, merge(leagues.get(league) ?? [], items));
      return counts;
    },
    get: (id) => byId.get(id),
    get size() {
      return byId.size;
    },
    list: () => entries.map((e) => byId.get(e.id)),
    byLeague: (leagueId) => (leagues.get(leagueId) ?? []).map((e) => byId.get(e.id)),
  };
}
```

%% exercise prod-time-slice | Time-sliced processing | 3 | js | js | processInChunks | 25
Processing 20 000 events in one loop blocks the page. Write `processInChunks(items, processItem, options)` that works in **time slices**.

Options: `budgetMs = 8`, `now = () => performance.now()`, `yieldToMain = () => new Promise((r) => setTimeout(r, 0))`, `signal` (an `AbortSignal`), `onProgress(processed, total)`.

- Process items **in order**, synchronously, calling `processItem(item, index)`.
- A *slice* starts by reading `now()`; keep processing until `now() - sliceStart >= budgetMs`, then `await yieldToMain()` and begin a new slice.
- Every slice processes **at least one** item (so `budgetMs: 0` still terminates).
- Don't yield after the final item. Call `onProgress` at the end of each slice.
- If `signal` is aborted, stop **before starting the next item**.
- Resolve with `{ processed, chunks, aborted }`. If `processItem` throws, the promise rejects with that error and nothing further runs.

%% starter
```js
export async function processInChunks(items, processItem, options = {}) {
  // your code
}
```

%% tests
```js
function fakeClock() {
  let t = 0;
  return { now: () => t, tick: (ms) => { t += ms; } };
}

describe('processInChunks', () => {
  it('processes every item in order and reports the counts', async () => {
    const seen = [];
    const clock = fakeClock();
    const yieldToMain = jest.fn(async () => {});
    const res = await processInChunks([1, 2, 3, 4, 5], (x, i) => { seen.push([x, i]); clock.tick(1); }, { budgetMs: 2, now: clock.now, yieldToMain });
    expect(seen).toEqual([[1, 0], [2, 1], [3, 2], [4, 3], [5, 4]]);
    expect(res).toEqual({ processed: 5, chunks: 3, aborted: false });
  });

  it('yields between slices but not after the last one', async () => {
    const clock = fakeClock();
    const yieldToMain = jest.fn(async () => {});
    await processInChunks(Array.from({ length: 10 }), () => clock.tick(1), { budgetMs: 5, now: clock.now, yieldToMain });
    expect(yieldToMain).toHaveBeenCalledTimes(1);
  });

  it('never yields when everything fits in one slice', async () => {
    const clock = fakeClock();
    const yieldToMain = jest.fn(async () => {});
    const res = await processInChunks([1, 2, 3], () => {}, { budgetMs: 100, now: clock.now, yieldToMain });
    expect(yieldToMain).not.toHaveBeenCalled();
    expect(res.chunks).toBe(1);
  });

  it('20 000 items at 1 ms each with an 8 ms budget → 2 500 slices', async () => {
    const clock = fakeClock();
    const yieldToMain = jest.fn(async () => {});
    const res = await processInChunks(Array.from({ length: 20000 }), () => clock.tick(1), { now: clock.now, yieldToMain });
    expect(res).toEqual({ processed: 20000, chunks: 2500, aborted: false });
    expect(yieldToMain).toHaveBeenCalledTimes(2499);
  });

  it('always makes progress, even with a zero budget', async () => {
    const clock = fakeClock();
    const yieldToMain = jest.fn(async () => {});
    const res = await processInChunks([1, 2, 3], () => clock.tick(1), { budgetMs: 0, now: clock.now, yieldToMain });
    expect(res.processed).toBe(3);
    expect(res.chunks).toBe(3);
  });

  it('reports progress at the end of each slice', async () => {
    const clock = fakeClock();
    const onProgress = jest.fn();
    await processInChunks(Array.from({ length: 6 }), () => clock.tick(1), { budgetMs: 2, now: clock.now, yieldToMain: async () => {}, onProgress });
    expect(onProgress.mock.calls).toEqual([[2, 6], [4, 6], [6, 6]]);
  });

  it('handles an empty list', async () => {
    const yieldToMain = jest.fn(async () => {});
    const res = await processInChunks([], () => {}, { yieldToMain });
    expect(res).toEqual({ processed: 0, chunks: 0, aborted: false });
  });

  it('stops on abort, before the next item', async () => {
    const clock = fakeClock();
    const controller = new AbortController();
    const seen = [];
    const res = await processInChunks(Array.from({ length: 100 }, (_, i) => i), (x) => {
      seen.push(x);
      clock.tick(1);
      if (x === 4) controller.abort();
    }, { budgetMs: 1000, now: clock.now, yieldToMain: async () => {}, signal: controller.signal });
    expect(seen).toEqual([0, 1, 2, 3, 4]);
    expect(res).toEqual({ processed: 5, chunks: 1, aborted: true });
  });

  it('does not start if the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = jest.fn();
    const res = await processInChunks([1, 2], fn, { signal: controller.signal });
    expect(fn).not.toHaveBeenCalled();
    expect(res).toMatchObject({ processed: 0, aborted: true });
  });

  it('rejects with the error from processItem and stops', async () => {
    const seen = [];
    await expect(processInChunks([1, 2, 3], (x) => { seen.push(x); if (x === 2) throw new Error('bad event'); }, { yieldToMain: async () => {} })).rejects.toThrow('bad event');
    expect(seen).toEqual([1, 2]);
  });

  it('actually lets other tasks run between slices (real yield)', async () => {
    const order = [];
    setTimeout(() => order.push('timer'), 0);
    let t = 0;
    await processInChunks([1, 2, 3, 4], (x) => { order.push(x); t += 10; }, { budgetMs: 10, now: () => t });
    expect(order.indexOf('timer')).toBeGreaterThan(0);
    expect(order.indexOf('timer')).toBeLessThan(order.length - 1);
  });
});
```

%% worked
**A similar problem, solved: `forEachInSlices(items, fn, budgetMs)`** — the core loop, without abort or error handling.

```js
async function forEachInSlices(items, fn, budgetMs = 8, now = () => performance.now()) {
  let i = 0;
  while (i < items.length) {
    const sliceStart = now();                                     // ① a slice starts by reading the clock
    do {
      fn(items[i], i);
      i++;
    } while (i < items.length && now() - sliceStart < budgetMs);  // ② do…while → at least ONE item per slice, even with budget 0
    if (i < items.length) await new Promise((r) => setTimeout(r, 0));   // ③ yield — but NOT after the last item
  }
}
```

What `processInChunks` adds on top: count `chunks`; call `onProgress(processed, total)` at the **end of each slice**; check `signal?.aborted` **before starting each item** (stop and report `aborted: true`); let an error thrown by `processItem` reject the promise (simply don't catch it — `await`ing in an async function propagates it); and make `now` and `yieldToMain` injectable so tests can fake the clock.

%% explain
- **In order**, synchronously, `processItem(item, index)`.
- **A slice** reads `now()`, processes until `now() - sliceStart >= budgetMs`, then `await yieldToMain()`.
- **At least one item per slice** (so `budgetMs: 0` still finishes). **No yield after the last item.**
- **`onProgress(processed, total)`** at the end of each slice.
- **Abort**: stop before starting the next item when `signal` is aborted.
- **Result** `{ processed, chunks, aborted }`; a throwing `processItem` rejects and nothing further runs.

%% nudge
- What kind of loop guarantees "at least one"?
- Where exactly do you check the abort signal: before an item or after?

%% hints
- Outer loop over `index`; inner loop keeps going while `index < items.length` **and** the slice budget isn't exhausted **and** the signal isn't aborted.
- Read `sliceStart = now()` once per slice; check the budget *after* processing an item (that guarantees at least one).
- After a slice: `onProgress?.(index, items.length)`, then `if (index < items.length && !aborted) await yieldToMain()`.
- Count `chunks` when a slice processed at least one item.

%% solution
```js
export async function processInChunks(items, processItem, options = {}) {
  const {
    budgetMs = 8,
    now = () => performance.now(),
    yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0)),
    signal,
    onProgress,
  } = options;

  let index = 0;
  let chunks = 0;
  let aborted = false;

  while (index < items.length) {
    if (signal?.aborted) {
      aborted = true;
      break;
    }
    const sliceStart = now();
    let didWork = false;
    while (index < items.length) {
      if (signal?.aborted) {
        aborted = true;
        break;
      }
      processItem(items[index], index);
      index++;
      didWork = true;
      if (now() - sliceStart >= budgetMs) break;
    }
    if (didWork) {
      chunks++;
      onProgress?.(index, items.length);
    }
    if (aborted) break;
    if (index < items.length) await yieldToMain();
  }

  return { processed: index, chunks, aborted };
}
```

%% exercise prod-paged-events | usePagedEvents: race-safe paging | 3 | tsx | react | usePagedEvents | 40
Write `usePagedEvents(fetchPage)`; `fetchPage(cursor?: string)` returns `Promise<{ items: Item[]; nextCursor: string | null }>` where `Item = { id: string; … }`.

Return `{ items, loading, error, hasMore, loadMore, refresh }`.

- **First page** loads automatically on mount (`cursor` is `undefined`); `loading` is `true` until it settles.
- `loadMore()` fetches the next page with the last `nextCursor`. It is a **no-op** while a request is in flight, or when `hasMore` is `false` (`nextCursor === null`). Spamming it must not fire duplicate requests.
- New items are appended, **deduplicated by `id`**: a repeated id replaces the earlier item *in place*.
- On failure, `error` is set, **already loaded items are kept**, and calling `loadMore()` again **retries the same cursor**.
- `refresh()` clears the list and reloads from the beginning. Any response from a request started **before** the refresh must be ignored (no stale overwrites).
- No state updates after unmount.

%% starter
```tsx
import { useCallback, useEffect, useState } from 'react';

export interface Item {
  id: string;
  [key: string]: unknown;
}

export interface Page {
  items: Item[];
  nextCursor: string | null;
}

export function usePagedEvents(fetchPage: (cursor?: string) => Promise<Page>) {
  return {
    items: [] as Item[],
    loading: false,
    error: undefined as Error | undefined,
    hasMore: true,
    loadMore: () => {},
    refresh: () => {},
  };
}
```

%% tests
```tsx
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const page = (ids: string[], next: string | null) => ({ items: ids.map((id) => ({ id })), nextCursor: next });
const ids = (r: any) => r.current.items.map((i: any) => i.id);

describe('usePagedEvents', () => {
  it('loads the first page on mount', async () => {
    const d = deferred<any>();
    const fetchPage = jest.fn(() => d.promise);
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    expect(result.current.loading).toBe(true);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
    await act(async () => { d.resolve(page(['a', 'b'], 'c1')); });
    expect(ids(result)).toEqual(['a', 'b']);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasMore).toBe(true);
  });

  it('loadMore fetches the next cursor and appends', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(['a', 'b'], 'c1'))
      .mockResolvedValueOnce(page(['c'], null));
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.loadMore(); });
    expect(fetchPage).toHaveBeenLastCalledWith('c1');
    expect(ids(result)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore is a no-op while a request is in flight (no duplicate requests)', async () => {
    const first = deferred<any>(), second = deferred<any>();
    const fetchPage = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    act(() => { result.current.loadMore(); result.current.loadMore(); });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(page(['a'], 'c1')); });
    act(() => { result.current.loadMore(); result.current.loadMore(); result.current.loadMore(); });
    expect(fetchPage).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve(page(['b'], null)); });
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('loadMore does nothing once there are no more pages', async () => {
    const fetchPage = jest.fn().mockResolvedValue(page(['a'], null));
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.loadMore(); });
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.hasMore).toBe(false);
  });

  it('dedupes by id, replacing in place', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce({ items: [{ id: 'a', v: 1 }, { id: 'b', v: 1 }], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [{ id: 'b', v: 2 }, { id: 'c', v: 1 }], nextCursor: null });
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.loadMore(); });
    expect(result.current.items).toEqual([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'c', v: 1 }]);
  });

  it('keeps loaded items on error and retries the same cursor', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(['a'], 'c1'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(page(['b'], null));
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.loadMore(); });
    expect(result.current.error?.message).toBe('offline');
    expect(ids(result)).toEqual(['a']);
    expect(result.current.loading).toBe(false);
    await act(async () => { result.current.loadMore(); });
    expect(fetchPage).toHaveBeenLastCalledWith('c1');
    expect(result.current.error).toBeUndefined();
    expect(ids(result)).toEqual(['a', 'b']);
  });

  it('refresh clears the list and reloads from the start', async () => {
    const fetchPage = jest.fn()
      .mockResolvedValueOnce(page(['a', 'b'], 'c1'))
      .mockResolvedValueOnce(page(['x'], null));
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { result.current.refresh(); });
    expect(fetchPage).toHaveBeenLastCalledWith(undefined);
    expect(ids(result)).toEqual(['x']);
    expect(result.current.hasMore).toBe(false);
  });

  it('ignores a response that was requested before a refresh (race)', async () => {
    const slow = deferred<any>(), fresh = deferred<any>();
    const fetchPage = jest.fn().mockReturnValueOnce(slow.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(() => usePagedEvents(fetchPage));
    act(() => { result.current.refresh(); });
    await act(async () => { fresh.resolve(page(['new'], null)); });
    await act(async () => { slow.resolve(page(['old'], 'c9')); });
    expect(ids(result)).toEqual(['new']);
    expect(result.current.hasMore).toBe(false);
  });

  it('does not update state after unmount', async () => {
    const errors = jest.spyOn(console, 'error');
    const d = deferred<any>();
    const { unmount } = renderHook(() => usePagedEvents(() => d.promise));
    unmount();
    await act(async () => { d.resolve(page(['a'], null)); });
    expect(errors).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: a hook that loads "more" safely.**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

export function useMore(fetchMore: (cursor?: string) => Promise<{ items: string[]; next: string | null }>) {
  const [items, setItems] = useState<string[]>([]);
  const [next, setNext] = useState<string | null | undefined>(undefined);   // undefined = nothing loaded yet
  const inFlight = useRef(false);                          // ① a REF, not state: updated instantly, no stale reads
  const generation = useRef(0);                            // ② bumped on refresh so old responses can be recognised

  const load = useCallback(async (cursor?: string) => {
    if (inFlight.current) return;                          // ③ spam-proof: a second call while loading is a no-op
    inFlight.current = true;
    const mine = generation.current;
    try {
      const page = await fetchMore(cursor);
      if (mine !== generation.current) return;             // ④ a refresh happened meanwhile → this answer is STALE, drop it
      setItems((prev) => [...prev, ...page.items]);
      setNext(page.next);
    } finally {
      if (mine === generation.current) inFlight.current = false;   // ⑤ always release the guard (for the current generation)
    }
  }, [fetchMore]);

  useEffect(() => { void load(); }, [load]);
  return { items, hasMore: next !== null, loadMore: () => next && load(next) };
}
```

What `usePagedEvents` adds: `loading` and `error` state (keep loaded items on error; a retry reuses the **same cursor**), **dedupe by `id`** (a repeated id replaces the earlier item *in place*), `refresh()` (bump the generation, clear the list, release the in-flight guard, load from the start), an **unmounted** flag to avoid updates after unmount, and `hasMore` = `nextCursor !== null`.

%% explain
- **First page loads on mount** (`cursor` undefined); `loading` is true until it settles.
- **`loadMore()`** uses the last `nextCursor`; it's a **no-op** while a request is in flight or when `hasMore` is false.
- **Items append and dedupe by `id`** (a repeated id replaces the earlier item in place).
- **On failure**: `error` set, loaded items kept, `loadMore()` retries the **same cursor**.
- **`refresh()`** clears and reloads; any response from a request started **before** the refresh is ignored.
- **No state updates after unmount.**

%% nudge
- How can an old response recognise that it is stale when it finally arrives?
- Why is the "in flight" guard a ref and not state?

%% hints
- Keep a **request generation** in a ref (`const gen = useRef(0)`). `refresh` increments it; every response checks `gen === myGen` before touching state. Unmount also increments it.
- Keep the *in-flight flag* in a **ref** as well — state updates are async, so two synchronous `loadMore()` calls would both see `loading === false`.
- The cursor for the next page lives in a ref (`nextCursor`), set only when a page succeeds. `undefined` = first page, `null` = no more.
- Merge with a `Map` keyed by `id` — `Map.set` on an existing key keeps its original position.

%% solution
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Item {
  id: string;
  [key: string]: unknown;
}

export interface Page {
  items: Item[];
  nextCursor: string | null;
}

export function usePagedEvents(fetchPage: (cursor?: string) => Promise<Page>) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);

  const generation = useRef(0);
  const inFlight = useRef(false);
  const cursor = useRef<string | null | undefined>(undefined);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(() => {
    if (inFlight.current || cursor.current === null) return;
    inFlight.current = true;
    const myGen = generation.current;
    setLoading(true);
    setError(undefined);
    fetchRef.current(cursor.current ?? undefined).then(
      (page) => {
        if (myGen !== generation.current) return;
        inFlight.current = false;
        cursor.current = page.nextCursor;
        setItems((prev) => {
          const merged = new Map(prev.map((i) => [i.id, i]));
          page.items.forEach((i) => merged.set(i.id, i));
          return [...merged.values()];
        });
        setHasMore(page.nextCursor !== null);
        setLoading(false);
      },
      (err) => {
        if (myGen !== generation.current) return;
        inFlight.current = false;
        setError(err as Error);
        setLoading(false);
      },
    );
  }, []);

  const refresh = useCallback(() => {
    generation.current++;
    inFlight.current = false;
    cursor.current = undefined;
    setItems([]);
    setHasMore(true);
    load();
  }, [load]);

  useEffect(() => {
    load();
    return () => {
      generation.current++;
      inFlight.current = false;
    };
  }, [load]);

  return { items, loading, error, hasMore, loadMore: load, refresh };
}
```
