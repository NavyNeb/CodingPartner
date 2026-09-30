---
id: prod-large-data
track: prod
title: Case study: 20 000 events on one screen
summary: The events page takes nine seconds to show anything. Paginate by cursor, normalise and index the data, slice long work, and load pages without races.
---

> **INCIDENT — Monday morning, cold cache.** The "All events" screen shows a blank page for ~9 seconds on mid-range Android, and the tab occasionally crashes on older iPhones.
>
> **What the trace shows:** a single 14 MB JSON response (20 000 events, every field of every market). `JSON.parse` = 600 ms of main-thread time. Then a 400 ms `Array.sort`, then React mounting 20 000 rows (≈ 4 s scripting, ≈ 2 s layout). Memory peaks at 900 MB.

## Anatomy of the problem

Everything happened **at once**, **on the main thread**, **for data the user can't see**. Each step has a standard remedy:

| Symptom | Remedy |
| --- | --- |
| 14 MB payload | **Paginate** (cursor), select only the fields the list needs, compress, cache |
| 20 000 rows mounted | **Virtualise** (you built this in the React track) — only ~30 rows exist |
| Sorting / grouping on every update | **Normalise + index once**, then merge new pages incrementally |
| A 600 ms task blocks input | **Time-slice** long loops so the browser can paint and handle taps between chunks |
| Requests racing / duplicate rows | Idempotent, race-safe page loading |

## Cursor vs. offset pagination

`?page=40&limit=100` (offset) is simple but wrong for live data: while you read page 40, new events are inserted at the top, so page 41 repeats the last row of page 40 (or skips one). A **cursor** (`?after=evt_8123`) says "continue from *this* item", which is stable under inserts. It also lets the database seek via an index instead of scanning `OFFSET 4000`.

Whichever you use, the client must **dedupe by id** and be ready to see the same event twice.

## Normalise, then index

Store entities once, by id, and keep separate structures for *ordering* and *lookup*:

```ts
{ byId: { evt1: {...}, evt2: {...} },
  ids: ['evt2', 'evt1'],                       // display order
  idsByLeague: { epl: ['evt2'], laliga: ['evt1'] } }   // O(1) filter
```

- Updates touch one entry instead of rewriting arrays.
- Filtering by league is an index read, not a 20 000-item `filter` on every keystroke.
- **Merge new pages into the sorted order** (sort the *page*, then merge two sorted lists in O(n + m)) rather than re-sorting everything each time — the difference between O(pages × n log n) and O(pages × n).

## Time slicing

You can't make a 600 ms job fast, but you can make it **not block**: work for a small **budget** (say 8 ms), then hand the thread back and continue in the next task. Yield with `scheduler.yield()` (Chromium), `MessageChannel`/`setTimeout(0)` as a fallback, or `requestIdleCallback` for low-priority work. Always process **at least one item** per slice or a tiny budget will loop forever, and always allow **cancellation** (the user navigated away).

## Paging in the UI

A `usePagedEvents` hook is the smallest correct piece of data-fetching infrastructure. The traps: double-firing `loadMore` from an intersection observer, a slow response from *before* a refresh overwriting fresh data, unmounted components updating state, and losing already-loaded rows when a later page fails.

## Also worth knowing

- **Stale-while-revalidate:** paint from cache instantly, refresh in the background.
- **Streaming parse:** NDJSON + `fetch().body.getReader()` lets the first rows render before the last byte arrives.
- **`content-visibility: auto`** skips layout/paint work for off-screen sections.
- **Web Workers** for parsing/normalising big payloads (later lesson).
- Budget for **low-end devices**: throttle the CPU 4–6× in DevTools when you measure.

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
