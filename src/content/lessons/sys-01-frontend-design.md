---
id: sys-design
track: system
title: Frontend system design: a method and three classic designs
summary: A five-step way to answer open-ended design questions out loud, then three worked designs — a news feed, typeahead search and a chat — with the building blocks you will code and test.
---

## The idea in one sentence

A design round isn't asking you to *draw the perfect system*; it's asking you to **think out loud in a clear order** — clarify what's wanted, sketch the pieces, decide where the data lives, define the contracts, then **find what will hurt** and fix it.

> **Analogy** Imagine being asked to build a house. A bad builder starts laying bricks. A good one first asks **who will live here and what do they need** (requirements), **draws a floor plan** (architecture), decides **where the plumbing runs** (data), agrees **where the doors are and what size** (interfaces), and finally **checks what happens in a storm** (optimisations and failure). Interviewers watch that order more than any single answer.

## The five steps (RADIO)

![RADIO: Requirements, Architecture, Data model, Interface, Optimizations](fig:radio-method "Say what step you're on; it keeps both of you oriented.")

| Step | What you do | Example sentence |
| --- | --- | --- |
| **R**equirements | Ask questions, **write down** in/out of scope, agree numbers | "Is it mobile too? How many items per page? Do we need offline?" |
| **A**rchitecture | Boxes and arrows: components, services, who talks to whom | "A list component, a store, a pager, and the API." |
| **D**ata model | The state you hold, its shape, where it lives, how it's cached | "Posts by id in a normalised store; the feed is an ordered list of ids." |
| **I**nterface | API endpoints and **component props/events** | "`GET /feed?cursor=…&limit=20` returns `{ items, nextCursor }`." |
| **O**ptimizations | Performance, accessibility, errors, offline, security, analytics | "Virtualise the list; roll back a failed like; announce new posts to screen readers." |

**Spend your time like this:** ~10% requirements, ~20% architecture, ~20% data, ~15% interface, ~35% deep-dives. Most candidates run out of time *before* the interesting part, so keep the early steps brisk.

### Questions that earn points in Requirements

- **Users and devices:** mobile, desktop, low-end phones, slow networks?
- **Scale:** how many items, how big, how often do they change? (A 20-item list and a 20 000-row table are different designs.)
- **Core features vs. nice-to-haves:** agree a **minimum** you'll design fully.
- **Non-functional:** latency target (Core Web Vitals), accessibility, internationalisation, offline, security, analytics.
- **Freshness:** can data be a few seconds stale? Who else edits it? (This decides polling vs. push, optimistic UI, conflict handling.)

## Design 1 · A news feed

**Requirements (agreed):** infinite vertical scroll, text + image posts, like button, "new posts" banner, mobile first.

![A feed: API to pager to normalised store to virtual list, with an optimistic like and an end-of-list trigger](fig:feed-arch "The pager, the store and the list each have exactly one job.")

| Decision | Choice | Why |
| --- | --- | --- |
| **Pagination** | **Cursor** (`nextCursor`), not page numbers | New posts arriving at the top shift offsets and cause duplicates or gaps (you saw this in the large-data case study). |
| **Loading more** | An **`IntersectionObserver`** on a sentinel near the end | No scroll listeners; fires only when needed. |
| **Guarding** | One request at a time; **dedupe by id** | Fast scrolling and retries must not double-load or show repeats. |
| **Store** | **Normalised**: `byId` + `ids[]` | A like updates one object; every view of it updates. |
| **Rendering** | **Virtualised list** (only visible rows) | Hundreds of posts × images would otherwise blow memory and layout time. |
| **Likes** | **Optimistic** update, roll back on failure | The heart should fill instantly. |
| **New posts** | Poll or push, show a **banner**; don't shift the list under the user's finger | Avoids layout shift (CLS) and lost scroll position. |
| **Images** | Reserve space (aspect-ratio), lazy-load, responsive sizes | LCP and CLS. |
| **A11y** | `role="feed"`/articles, keyboard navigation, focus kept on "load more" | Infinite scroll is notoriously hostile to keyboard users. |

Watch the pager's key method protect itself:

```stepper A pager that cannot double-load
code:
  async function loadMore() {
    if (loading || !hasMore) return;
    loading = true;
    const page = await fetchPage(cursor, 20);
    items.push(...dedupe(items, page.items));
    cursor = page.nextCursor;
    hasMore = cursor !== null;
    loading = false;
  }
---
line: 2-3
say: The user scrolls fast and the sentinel becomes visible **twice** in a row. The first call passes the guard and sets `loading = true`.
Call: loadMore() #1
loading: true
Items: 0
---
line: 2
say: The second call arrives while the first is still waiting for the network. The guard `if (loading …) return` makes it a **no-op**: one request, not two.
Call: loadMore() #2 → ignored
loading: true
---
line: 4-5
say: The page arrives with `nextCursor = "p2"`. We **dedupe by id** (a post may already be in the list if one was added at the top meanwhile), then append the rest.
Items: 20
cursor: "p2"
---
line: 6-8
say: `hasMore` stays true because the server gave a cursor; `loading` goes back to false, so the next scroll can load page 2. When the server returns no cursor, `hasMore` becomes false and the observer stops asking.
loading: false
hasMore: true
```

Dedupe by id is one small function. Run it:

```js try
function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map((item) => item.id));
  const fresh = [];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);                       // also catches duplicates inside the same page
    fresh.push(item);
  }
  return [...existing, ...fresh];
}

const page1 = [{ id: 1 }, { id: 2 }, { id: 3 }];
const page2 = [{ id: 3 }, { id: 4 }, { id: 4 }];     // 3 repeated from page 1, 4 repeated inside the page
console.log(mergeUnique(page1, page2).map((p) => p.id));
```

## Design 2 · Typeahead search

**Requirements (agreed):** a search box that suggests results as you type, keyboard friendly, mobile networks.

![Keystrokes pass through a debounce and a cache. A miss aborts the previous request and starts a new one; stale responses are ignored](fig:typeahead-flow "Four defences: debounce, cache, abort, and an 'is this still the latest?' check.")

- **Debounce** (~150 ms): wait for a pause in typing so you send 1 request, not 5.
- **Minimum length** (2 characters): single letters match half the database.
- **Cache** by normalised query (trim + lower-case): backspacing to a previous query is **instant**. Bound it (LRU) so it can't grow forever.
- **Cancel the previous request** with `AbortController` when a new one starts: saves bandwidth and server work.
- **Ignore out-of-order answers.** Requests can finish in a different order than they started. Remember the id of the **latest** request and drop answers from older ones, even if the abort didn't stop them.
- **Keyboard and screen readers:** the ARIA *combobox* pattern: arrow keys move through options, Enter selects, Escape closes, `aria-activedescendant` announces the active option.

The most important defence is cheap to demonstrate. Without the "latest" check, a slow early response overwrites a fast later one:

```js try
function makeSearch(latencies) {
  return (query) => new Promise((resolve) => setTimeout(() => resolve(`results for "${query}"`), latencies[query]));
}
const search = makeSearch({ re: 80, rea: 10 });     // the OLDER query is the SLOWER one

let latest = 0;
let shown = '';
async function type(query) {
  const id = ++latest;                               // remember which request is the newest
  const results = await search(query);
  if (id !== latest) return;                         // an older answer arriving late: ignore it
  shown = results;
}

type('re');
type('rea');
setTimeout(() => console.log('screen shows:', shown), 120);
```

## Design 3 · A chat

**Requirements (agreed):** 1:1 and group chats, messages appear instantly when you send, they survive a flaky connection, history scrolls back.

![An outbox message moves from pending to sending to sent, with retrying and failed states](fig:outbox-states "The UI shows a message the instant you press send; the network catches up.")

- **Transport:** WebSocket for live messages; HTTP for history. Reconnect with backoff, detect gaps with **sequence numbers** (the resilience case study).
- **Optimistic sending:** give each message a **client-generated id** and show it immediately as *pending*. When the server acknowledges, attach its id and mark it *sent*.
- **Outbox queue:** send messages **one at a time** so they arrive in the order the user typed them. On failure **retry with backoff**; after a few attempts mark *failed* and let the user tap to retry.
- **Idempotency:** retrying the same client id lets the server **deduplicate**, so a timeout-then-retry doesn't create two messages.
- **History:** cursor pagination upward, **scroll anchoring** so the viewport doesn't jump when older messages load above, and a virtualised list.
- **Details people forget:** unread counts per tab (multi-tab leader), typing indicators (throttled), read receipts (batched), message grouping, time zones and RTL languages, accessibility of new-message announcements (`aria-live="polite"`).

## A short note on collaborative editing

Questions like "design Google Docs" are really about **conflict resolution**: two people edit the same sentence at once. The two families are **Operational Transformation** (a server orders operations and transforms them against each other) and **CRDTs** (data structures designed so any order of merges gives the same result, like the last-writer-wins registers you built for tabs, but for text). In a frontend round, say that, then focus on what *you* own: the **local-first editor state**, **presence cursors**, an **offline queue**, and **optimistic apply with reconciliation**.

## How to sound senior

- **Say trade-offs, not facts:** "Cursor pagination costs us random page access, but we never need it in a feed and we avoid duplicates."
- **Quantify:** "20 rows × 3 KB is 60 KB: fine to keep in memory; 20 000 rows is not, so we virtualise."
- **Name failure modes before you're asked:** offline, slow, partial, duplicate, out of order, stale.
- **Protect the user's place:** never move content under their finger; keep focus and scroll position through updates.
- **Pick a lane and go deep:** two areas explained well beat ten mentioned.
- **Don't** jump into code or libraries first; don't draw only the happy path; don't ignore accessibility and performance until the last minute.

## Quick check

```check
Q: What is the first thing to do in a frontend design question?
A) Pick a framework
B) Draw components
C) Ask clarifying questions and agree the scope and numbers *
D) Write the API
Why: Without agreed requirements you can't judge any design decision. Requirements also reveal what the interviewer cares about.
---
Q: Why does a feed use cursor pagination instead of page numbers?
A) Cursors are shorter
B) New items arriving at the top shift offsets, causing duplicates and gaps; a cursor continues after a specific item *
C) Page numbers are not supported by HTTP
D) Cursors are encrypted
Why: Offsets are positions; positions move when the data changes. A cursor points at an item.
---
Q: A typeahead sends request A ("re") then request B ("rea"). A's response arrives last. What prevents showing A's results?
A) Debouncing
B) Caching
C) Checking that the response belongs to the latest request before using it *
D) Lowering the minimum length
Why: Responses can arrive in any order. Only the newest request's answer should update the screen.
---
Q: Why does a chat client keep a client-generated id for each message?
A) To sort messages alphabetically
B) To show it instantly as pending and to let the server deduplicate retries *
C) Because WebSockets require it
D) To hide the server id
Why: The id exists before the server's does. Retrying the same id means "this message again", not a new one.
---
Q: Which is a good way to handle a "new posts available" update in a feed?
A) Insert them at the top immediately
B) Reload the page
C) Show a banner and let the user choose, so content doesn't jump under them *
D) Ignore new posts
Why: Moving content under the user's finger causes layout shift and loses their place.
```

## Recap

- **RADIO:** Requirements → Architecture → Data model → Interface → Optimizations. Say which step you're on, and keep the early steps short.
- **Feed:** cursor pagination, a loading guard, dedupe by id, normalised store, virtual list, optimistic likes, a banner for new posts.
- **Typeahead:** debounce, minimum length, bounded cache, abort the previous request, ignore stale responses, combobox accessibility.
- **Chat:** optimistic messages with client ids, a one-at-a-time outbox with retry and backoff, idempotent resends, scroll anchoring, reconnect with sequence numbers.
- **Sound senior:** trade-offs, numbers, failure modes, protecting the user's place.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: merge unique | The `mergeUnique` snippet |
| Infinite-feed pager | The stepper: guard, cursor, dedupe, `hasMore`; plus ignoring responses after a reset |
| Typeahead controller | The four defences; the "latest request" snippet |
| Optimistic message outbox | The outbox figure: one at a time, retry with backoff, failed after the limit, retry by hand |

%% exercise sys-guided-merge | Guided: merge unique | 1 | js | js | mergeUnique | 8 | guided
Write `mergeUnique(existing, incoming)` for a feed: append the items from `incoming` whose `id` isn't already present.

- Return a **new array**: all of `existing` (in order), then the **new** items from `incoming` (in order).
- An item is "already present" if its `id` is in `existing` **or** appeared earlier in `incoming`.
- Don't change either input array.

```js
mergeUnique([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }, { id: 3 }]);   // [{ id: 1 }, { id: 2 }, { id: 3 }]
```

%% worked
**A similar problem, solved: `addTags(known, newTags)`** — add tags that aren't known yet, ignoring case, keeping the first spelling.

```js
function addTags(known, newTags) {
  const seen = new Set(known.map((t) => t.toLowerCase()));   // ① a Set remembers what we've seen (fast lookup)
  const added = [];
  for (const tag of newTags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;                              // ② skip repeats…
    seen.add(key);                                            // ③ …including repeats inside newTags itself
    added.push(tag);
  }
  return [...known, ...added];                                // ④ build a NEW array
}
```

The recipe for any "dedupe while merging": build a `Set` of keys from what exists, loop over the newcomers, **skip if seen, otherwise add to the set and keep**. Adding to the set inside the loop is what catches duplicates *within* the incoming list.

%% explain
- **Order:** existing items first, then new items in their incoming order.
- **Skipping:** items whose id is already in `existing` are dropped; so are repeats within `incoming`.
- **Purity:** neither input array is modified; the result is a new array.

%% nudge
- What structure gives you a fast "have I seen this id?"
- When do you add an id to it?

%% starter
```js
export function mergeUnique(existing, incoming) {
  // Step 1 — const seen = new Set(existing.map((item) => item.id))
  // Step 2 — loop over incoming: skip if seen.has(item.id), otherwise seen.add(item.id) and remember the item
  // Step 3 — return [...existing, ...theNewItems]
  return existing;
}
```

%% tests
```js
describe('mergeUnique', () => {
  it('appends new items after the existing ones', () => {
    expect(mergeUnique([{ id: 1 }], [{ id: 2 }, { id: 3 }])).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
  it('skips ids that already exist', () => {
    expect(mergeUnique([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }])).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
  it('skips repeats inside incoming', () => {
    expect(mergeUnique([], [{ id: 5 }, { id: 5 }, { id: 6 }])).toEqual([{ id: 5 }, { id: 6 }]);
  });
  it('keeps the existing copy rather than the incoming one', () => {
    expect(mergeUnique([{ id: 1, v: 'old' }], [{ id: 1, v: 'new' }])).toEqual([{ id: 1, v: 'old' }]);
  });
  it('returns a new array and leaves the inputs alone', () => {
    const existing = [{ id: 1 }];
    const incoming = [{ id: 2 }];
    const out = mergeUnique(existing, incoming);
    expect(out).not.toBe(existing);
    expect(existing.length).toBe(1);
    expect(incoming.length).toBe(1);
  });
  it('handles empty inputs', () => {
    expect(mergeUnique([], [])).toEqual([]);
    expect(mergeUnique([{ id: 1 }], [])).toEqual([{ id: 1 }]);
  });
});
```

%% hints
- `const seen = new Set(existing.map((item) => item.id));`
- `const fresh = []; for (const item of incoming) { if (seen.has(item.id)) continue; seen.add(item.id); fresh.push(item); }`
- `return [...existing, ...fresh];`

%% solution
```js
export function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map((item) => item.id));
  const fresh = [];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    fresh.push(item);
  }
  return [...existing, ...fresh];
}
```

%% exercise sys-feed-pager | Infinite-feed pager | 3 | js | js | createFeedPager | 35
Build `createFeedPager({ fetchPage, pageSize = 20 })`, the logic behind an infinite-scroll feed.

`fetchPage(cursor, limit)` returns a promise of `{ items, nextCursor }`. The first call uses `cursor = null`. A `nextCursor` of `null` (or `undefined`) means there are no more pages. Items have an `id`.

Returns `{ getState, subscribe, loadMore, reset, prepend }`:

- **`getState()`** → `{ items, loading, error, hasMore }`. Initially `{ items: [], loading: false, error: null, hasMore: true }`.
- **`subscribe(listener)`** calls `listener(state)` after every state change and returns an unsubscribe function.
- **`loadMore()`** returns a promise that **never rejects**.
  - Ignored (no fetch) while a request is in flight or when `hasMore` is `false`.
  - Sets `loading: true, error: null`, calls `fetchPage(cursor, pageSize)`.
  - On success: **append** the items whose `id` isn't already in the list (also drop repeats inside the page), remember `nextCursor`, set `hasMore` to whether there is a next cursor, `loading: false`.
  - On failure: `loading: false`, `error` set to the error, **cursor and items unchanged**, so calling `loadMore()` again **retries** the same page.
- **`reset()`** clears everything back to the initial state. A response that was **in flight** before the reset must be **ignored** when it arrives.
- **`prepend(items)`** adds new items (deduped by `id`) at the **top**, keeping their given order, without touching the cursor.

%% worked
**A similar problem, solved: `createLoader(fetchOne)`** — a loader that ignores overlapping calls and results that arrive after a `cancel()`.

```js
function createLoader(fetchOne) {
  let busy = false;
  let generation = 0;                       // ① a counter that changes when results should be thrown away
  const state = { value: null, error: null };
  return {
    state,
    async load() {
      if (busy) return;                     // ② the guard: one request at a time
      busy = true;
      const mine = generation;              // ③ remember which "generation" this request belongs to
      try {
        const value = await fetchOne();
        if (mine === generation) state.value = value;   // ④ only apply if nothing cancelled us meanwhile
      } catch (error) {
        if (mine === generation) state.error = error;
      } finally {
        if (mine === generation) busy = false;
      }
    },
    cancel() { generation++; busy = false; state.value = null; },
  };
}
```

The two ideas to take: a **guard flag** so overlapping calls do nothing, and a **generation counter** so a slow response from before a reset can't write into the new world.

%% explain
- **Guard:** a second `loadMore()` during a request, or after the end, makes no extra request.
- **Success:** items append without repeats; the cursor advances; `hasMore` follows `nextCursor`.
- **Failure:** the error is kept in state, the same page is retried next time, and the promise doesn't reject.
- **Reset:** back to the initial state, and a late response from before the reset is dropped.
- **Prepend:** new items go on top, deduped; the cursor is untouched.
- **Subscriptions:** listeners see each change and can unsubscribe.

%% nudge
- What do you do with a response that arrives after `reset()` was called?
- Where do you keep the cursor so a failed load can retry the same page?

%% starter
```js
export function createFeedPager({ fetchPage, pageSize = 20 }) {
  let state = { items: [], loading: false, error: null, hasMore: true };
  let cursor = null;
  let generation = 0;
  const listeners = new Set();

  const setState = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };

  async function loadMore() {
    // Step 1 — return early if loading or !state.hasMore
    // Step 2 — remember the generation, setState({ loading: true, error: null })
    // Step 3 — try: page = await fetchPage(cursor, pageSize); if the generation changed, return.
    //          Otherwise cursor = page.nextCursor ?? null and append the NEW items (by id).
    // Step 4 — catch: if the generation is unchanged, setState({ loading: false, error })
  }

  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    loadMore,
    reset() {},
    prepend(items) {},
  };
}
```

%% tests
```js
function setup(pageSize = 2) {
  const calls = [];
  const fetchPage = jest.fn((cursor, limit) => new Promise((resolve, reject) => { calls.push({ cursor, limit, resolve, reject }); }));
  const pager = createFeedPager({ fetchPage, pageSize });
  return { pager, fetchPage, calls };
}
const items = (...ids) => ids.map((id) => ({ id }));
const ids = (pager) => pager.getState().items.map((i) => i.id);

describe('createFeedPager', () => {
  it('starts empty and ready to load', () => {
    const { pager } = setup();
    expect(pager.getState()).toEqual({ items: [], loading: false, error: null, hasMore: true });
  });

  it('loads the first page with a null cursor and the page size', async () => {
    const { pager, fetchPage, calls } = setup(2);
    const p = pager.loadMore();
    expect(fetchPage).toHaveBeenCalledWith(null, 2);
    expect(pager.getState().loading).toBe(true);
    calls[0].resolve({ items: items(1, 2), nextCursor: 'c2' });
    await p;
    expect(ids(pager)).toEqual([1, 2]);
    expect(pager.getState().loading).toBe(false);
    expect(pager.getState().hasMore).toBe(true);
  });

  it('ignores loadMore while a request is in flight', async () => {
    const { pager, fetchPage, calls } = setup();
    pager.loadMore();
    pager.loadMore();
    pager.loadMore();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    calls[0].resolve({ items: items(1), nextCursor: 'c' });
    await flushPromises();
  });

  it('uses the returned cursor for the next page', async () => {
    const { pager, fetchPage, calls } = setup();
    const a = pager.loadMore();
    calls[0].resolve({ items: items(1, 2), nextCursor: 'c2' });
    await a;
    const b = pager.loadMore();
    expect(fetchPage).toHaveBeenLastCalledWith('c2', 2);
    calls[1].resolve({ items: items(3, 4), nextCursor: 'c3' });
    await b;
    expect(ids(pager)).toEqual([1, 2, 3, 4]);
  });

  it('drops duplicate ids, within a page and across pages', async () => {
    const { pager, calls } = setup();
    const a = pager.loadMore();
    calls[0].resolve({ items: items(1, 2), nextCursor: 'c2' });
    await a;
    const b = pager.loadMore();
    calls[1].resolve({ items: items(2, 3, 3), nextCursor: 'c3' });
    await b;
    expect(ids(pager)).toEqual([1, 2, 3]);
  });

  it('stops when there is no next cursor', async () => {
    const { pager, fetchPage, calls } = setup();
    const a = pager.loadMore();
    calls[0].resolve({ items: items(1), nextCursor: null });
    await a;
    expect(pager.getState().hasMore).toBe(false);
    await pager.loadMore();
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('keeps the error and retries the same page after a failure', async () => {
    const { pager, fetchPage, calls } = setup();
    const a = pager.loadMore();
    calls[0].reject(new Error('offline'));
    await a;
    expect(pager.getState().error.message).toBe('offline');
    expect(pager.getState().loading).toBe(false);
    expect(ids(pager)).toEqual([]);
    const b = pager.loadMore();
    expect(fetchPage).toHaveBeenLastCalledWith(null, 2);
    expect(pager.getState().error).toBe(null);
    calls[1].resolve({ items: items(1), nextCursor: 'c' });
    await b;
    expect(ids(pager)).toEqual([1]);
  });

  it('loadMore never rejects', async () => {
    const { pager, calls } = setup();
    const p = pager.loadMore();
    calls[0].reject(new Error('boom'));
    await expect(p).resolves.toBe(undefined);
  });

  it('reset clears state and ignores a response that was in flight', async () => {
    const { pager, fetchPage, calls } = setup();
    const stale = pager.loadMore();
    pager.reset();
    expect(pager.getState()).toEqual({ items: [], loading: false, error: null, hasMore: true });
    const fresh = pager.loadMore();
    expect(fetchPage).toHaveBeenCalledTimes(2);
    expect(fetchPage).toHaveBeenLastCalledWith(null, 2);
    calls[0].resolve({ items: items(99), nextCursor: 'old' });
    await stale;
    expect(ids(pager)).toEqual([]);
    expect(pager.getState().loading).toBe(true);
    calls[1].resolve({ items: items(1), nextCursor: 'c' });
    await fresh;
    expect(ids(pager)).toEqual([1]);
  });

  it('prepend adds new items on top without duplicates', async () => {
    const { pager, calls } = setup();
    const a = pager.loadMore();
    calls[0].resolve({ items: items(3, 4), nextCursor: 'c' });
    await a;
    pager.prepend(items(1, 2, 3));
    expect(ids(pager)).toEqual([1, 2, 3, 4]);
  });

  it('notifies subscribers on every change and supports unsubscribe', async () => {
    const { pager, calls } = setup();
    const seen = [];
    const off = pager.subscribe((s) => seen.push({ loading: s.loading, n: s.items.length }));
    const a = pager.loadMore();
    calls[0].resolve({ items: items(1), nextCursor: 'c' });
    await a;
    expect(seen).toEqual([{ loading: true, n: 0 }, { loading: false, n: 1 }]);
    off();
    pager.reset();
    expect(seen.length).toBe(2);
  });
});
```

%% hints
- `if (state.loading || !state.hasMore) return;` at the top of `loadMore`.
- `const mine = generation;` before the `await`; after it `if (mine !== generation) return;`.
- Dedupe with a `Set` of existing ids, like the guided exercise.
- `reset()`: `generation++; cursor = null; setState({ items: [], loading: false, error: null, hasMore: true });`

%% solution
```js
export function createFeedPager({ fetchPage, pageSize = 20 }) {
  let state = { items: [], loading: false, error: null, hasMore: true };
  let cursor = null;
  let generation = 0;
  const listeners = new Set();

  const setState = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };

  const unique = (existing, incoming) => {
    const seen = new Set(existing.map((item) => item.id));
    const fresh = [];
    for (const item of incoming) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      fresh.push(item);
    }
    return fresh;
  };

  async function loadMore() {
    if (state.loading || !state.hasMore) return;
    const mine = generation;
    setState({ loading: true, error: null });
    try {
      const page = await fetchPage(cursor, pageSize);
      if (mine !== generation) return;
      cursor = page.nextCursor ?? null;
      setState({
        items: [...state.items, ...unique(state.items, page.items)],
        loading: false,
        hasMore: cursor !== null,
      });
    } catch (error) {
      if (mine !== generation) return;
      setState({ loading: false, error });
    }
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadMore,
    reset() {
      generation++;
      cursor = null;
      setState({ items: [], loading: false, error: null, hasMore: true });
    },
    prepend(items) {
      setState({ items: [...unique(state.items, items), ...state.items] });
    },
  };
}
```

%% exercise sys-typeahead | Typeahead controller | 4 | js | js | createTypeahead | 45
Build `createTypeahead({ search, debounceMs = 150, minLength = 2, cacheSize = 20 })`, the engine behind a search-as-you-type box.

`search(query, signal)` returns a promise of a results array. Returns `{ input, getState, subscribe, destroy }`. State is `{ query, results, loading, error }`, initially `{ query: '', results: [], loading: false, error: null }`.

- **`input(text)`** normalises the query (`trim()` + lower-case) and then:
  - Every call first **cancels** the pending debounce timer and **aborts** any in-flight request, and makes sure its answer will be ignored.
  - **Shorter than `minLength`:** state becomes `{ query, results: [], loading: false, error: null }`; no search.
  - **Cache hit:** state becomes `{ query, results: cached, loading: false, error: null }` immediately; no search.
  - **Otherwise:** state becomes `{ query, loading: true, error: null }` (**keep the previous results on screen**), and after `debounceMs` call `search(query, signal)` with a fresh `AbortSignal`.
- When the search **resolves** (and is still the latest request): cache the results by query, set `results` and `loading: false`.
- When it **rejects** and is still the latest request (not an abort): set `error` and `loading: false`.
- **Cache** is an **LRU** with at most `cacheSize` queries: a cache hit counts as a use; adding beyond the limit evicts the least recently used.
- `subscribe(listener)` calls `listener(state)` after every change; returns an unsubscribe function. `destroy()` cancels the timer and any in-flight request and removes listeners; after it, `input` does nothing.

%% worked
**A similar problem, solved: `createSearchLatch(search)`** — run only the newest search; older answers are ignored.

```js
function createLatestSearch(search, onResult) {
  let latest = 0;
  let controller = null;
  return function run(query) {
    controller?.abort();                         // ① stop the previous request if it is still running
    controller = new AbortController();
    const id = ++latest;                         // ② number this request
    const { signal } = controller;
    search(query, signal).then(
      (results) => { if (id === latest) onResult(results); },        // ③ only the newest request may report
      (error) => { if (id === latest && !signal.aborted) onResult([]); },
    );
  };
}
```

Three tools: **abort** to save work, a **request id** to guard against answers that arrive out of order (an abort can't stop a response that already left the server), and `signal.aborted` to tell "I cancelled it" apart from a real failure. Add a **debounce timer** (`setTimeout` you clear on each keystroke) and a `Map` cache for the full controller.

%% explain
- **Debounce:** several `input` calls within `debounceMs` make only one `search`, for the last query.
- **Normalising:** `"  ReAct "` searches `"react"`, and the state's `query` is `"react"`.
- **Short input:** below `minLength`, results clear at once and nothing is searched.
- **Stale answers:** an older request's answer never overwrites a newer one; each new input aborts the old request.
- **Cache:** repeating a query shows results immediately and skips the search; least-recently-used queries are evicted.
- **Errors and cleanup:** real failures show up as `error`; `destroy()` stops everything, and later `input` calls are ignored.

%% nudge
- What changes every time `input` is called that lets you recognise an answer as stale?
- How can you implement an LRU with only a `Map`?

%% starter
```js
export function createTypeahead({ search, debounceMs = 150, minLength = 2, cacheSize = 20 }) {
  let state = { query: '', results: [], loading: false, error: null };
  const listeners = new Set();
  const cache = new Map();   // query → results; keep it in least-recently-used order
  let timer = null;
  let controller = null;
  let latest = 0;
  let destroyed = false;

  const setState = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };

  function cancel() {
    // clearTimeout(timer), controller?.abort(), and make older answers stale (latest++)
  }

  function input(text) {
    // Step 1 — if destroyed, return. Normalise, cancel()
    // Step 2 — too short → setState({ query, results: [], loading: false, error: null }) and stop
    // Step 3 — cache hit → refresh its position, setState with the cached results, and stop
    // Step 4 — setState({ query, loading: true, error: null }); timer = setTimeout(…, debounceMs)
    //          inside: controller = new AbortController(); await search(query, signal);
    //          ignore if stale; otherwise remember in the cache (evict the oldest beyond cacheSize) and setState
  }

  return {
    input,
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    destroy() { destroyed = true; cancel(); listeners.clear(); },
  };
}
```

%% tests
```js
function setup(options = {}) {
  const calls = [];
  const searchFn = jest.fn((query, signal) => new Promise((resolve, reject) => {
    const call = { query, signal, resolve, reject };
    calls.push(call);
    signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }));
  const ta = createTypeahead({ search: searchFn, debounceMs: 100, ...options });
  return { ta, searchFn, calls };
}

describe('createTypeahead', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('starts idle', () => {
    expect(setup().ta.getState()).toEqual({ query: '', results: [], loading: false, error: null });
  });

  it('does not search for queries shorter than minLength', async () => {
    const { ta, searchFn } = setup();
    ta.input('r');
    await jest.advanceTimersByTimeAsync(500);
    expect(searchFn).not.toHaveBeenCalled();
    expect(ta.getState()).toEqual({ query: 'r', results: [], loading: false, error: null });
  });

  it('debounces: only the last query is searched', async () => {
    const { ta, searchFn } = setup();
    ta.input('re');
    await jest.advanceTimersByTimeAsync(50);
    ta.input('rea');
    await jest.advanceTimersByTimeAsync(50);
    ta.input('reac');
    expect(searchFn).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(100);
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(searchFn.mock.calls[0][0]).toBe('reac');
  });

  it('normalises the query and passes an AbortSignal', async () => {
    const { ta, calls } = setup();
    ta.input('  ReAct ');
    await jest.advanceTimersByTimeAsync(100);
    expect(calls[0].query).toBe('react');
    expect(calls[0].signal.aborted).toBe(false);
    expect(ta.getState().query).toBe('react');
  });

  it('shows loading, then the results', async () => {
    const { ta, calls } = setup();
    ta.input('react');
    expect(ta.getState().loading).toBe(true);
    await jest.advanceTimersByTimeAsync(100);
    calls[0].resolve(['React', 'React Native']);
    await flushPromises();
    expect(ta.getState()).toEqual({ query: 'react', results: ['React', 'React Native'], loading: false, error: null });
  });

  it('keeps previous results visible while the next search loads', async () => {
    const { ta, calls } = setup();
    ta.input('re');
    await jest.advanceTimersByTimeAsync(100);
    calls[0].resolve(['Redux']);
    await flushPromises();
    ta.input('rea');
    expect(ta.getState().results).toEqual(['Redux']);
    expect(ta.getState().loading).toBe(true);
  });

  it('aborts the previous request and ignores its late answer', async () => {
    const { ta, calls } = setup();
    ta.input('re');
    await jest.advanceTimersByTimeAsync(100);
    ta.input('rea');
    expect(calls[0].signal.aborted).toBe(true);
    await jest.advanceTimersByTimeAsync(100);
    calls[0].resolve(['STALE']);
    calls[1].resolve(['Fresh']);
    await flushPromises();
    expect(ta.getState().results).toEqual(['Fresh']);
    expect(ta.getState().error).toBe(null);
  });

  it('ignores an old answer even if it was not aborted in time', async () => {
    const { ta, calls } = setup();
    ta.input('re');
    await jest.advanceTimersByTimeAsync(100);
    const firstQuery = calls[0];
    ta.input('rea');
    await jest.advanceTimersByTimeAsync(100);
    calls[1].resolve(['rea results']);
    await flushPromises();
    firstQuery.resolve(['late re results']);
    await flushPromises();
    expect(ta.getState().results).toEqual(['rea results']);
  });

  it('serves repeated queries from the cache', async () => {
    const { ta, searchFn, calls } = setup();
    ta.input('react');
    await jest.advanceTimersByTimeAsync(100);
    calls[0].resolve(['React']);
    await flushPromises();
    ta.input('reac');
    await jest.advanceTimersByTimeAsync(100);
    calls[1].resolve(['Reactor']);
    await flushPromises();
    ta.input('react');
    expect(ta.getState()).toEqual({ query: 'react', results: ['React'], loading: false, error: null });
    await jest.advanceTimersByTimeAsync(500);
    expect(searchFn).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used query when the cache is full', async () => {
    const { ta, searchFn, calls } = setup({ cacheSize: 2 });
    const ask = async (q, result) => { ta.input(q); await jest.advanceTimersByTimeAsync(100); calls[calls.length - 1].resolve([result]); await flushPromises(); };
    await ask('aa', 'A');
    await ask('bb', 'B');
    ta.input('aa');                    // touch: aa becomes most recently used
    await ask('cc', 'C');              // evicts bb, not aa
    expect(searchFn).toHaveBeenCalledTimes(3);
    ta.input('aa');
    expect(ta.getState().results).toEqual(['A']);
    ta.input('bb');
    expect(ta.getState().loading).toBe(true);
  });

  it('reports real errors and clears them on the next input', async () => {
    const { ta, calls } = setup();
    ta.input('boom');
    await jest.advanceTimersByTimeAsync(100);
    calls[0].reject(new Error('server down'));
    await flushPromises();
    expect(ta.getState().error.message).toBe('server down');
    expect(ta.getState().loading).toBe(false);
    ta.input('boom2');
    expect(ta.getState().error).toBe(null);
  });

  it('a cache hit cancels a pending search', async () => {
    const { ta, searchFn, calls } = setup();
    ta.input('react');
    await jest.advanceTimersByTimeAsync(100);
    calls[0].resolve(['React']);
    await flushPromises();
    ta.input('reactive');
    ta.input('react');
    await jest.advanceTimersByTimeAsync(500);
    expect(searchFn).toHaveBeenCalledTimes(1);
    expect(ta.getState().loading).toBe(false);
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { ta } = setup();
    const fn = jest.fn();
    const off = ta.subscribe(fn);
    ta.input('re');
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    ta.input('rea');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('destroy stops timers and aborts in-flight work', async () => {
    const { ta, searchFn, calls } = setup();
    ta.input('re');
    await jest.advanceTimersByTimeAsync(100);
    ta.destroy();
    expect(calls[0].signal.aborted).toBe(true);
    ta.input('later');
    await jest.advanceTimersByTimeAsync(500);
    expect(jest.getTimerCount()).toBe(0);
    expect(searchFn).toHaveBeenCalledTimes(1);
  });
});
```

%% hints
- `const query = text.trim().toLowerCase(); cancel();`
- In `cancel`: `clearTimeout(timer); timer = null; controller?.abort(); controller = null; latest++;` then `const id = latest;` in `input` after calling it.
- LRU on a `Map`: to mark use, `cache.delete(q); cache.set(q, value);` and evict with `cache.delete(cache.keys().next().value)`.
- After `await search(...)`: `if (id !== latest) return;`. In the catch: `if (id !== latest || signal.aborted) return;`

%% solution
```js
export function createTypeahead({ search, debounceMs = 150, minLength = 2, cacheSize = 20 }) {
  let state = { query: '', results: [], loading: false, error: null };
  const listeners = new Set();
  const cache = new Map();
  let timer = null;
  let controller = null;
  let latest = 0;
  let destroyed = false;

  const setState = (patch) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener(state));
  };

  function cancel() {
    clearTimeout(timer);
    timer = null;
    controller?.abort();
    controller = null;
    latest++;
  }

  function remember(query, results) {
    cache.delete(query);
    cache.set(query, results);
    if (cache.size > cacheSize) cache.delete(cache.keys().next().value);
  }

  function input(text) {
    if (destroyed) return;
    const query = text.trim().toLowerCase();
    cancel();
    if (query.length < minLength) {
      setState({ query, results: [], loading: false, error: null });
      return;
    }
    if (cache.has(query)) {
      const hit = cache.get(query);
      remember(query, hit);
      setState({ query, results: hit, loading: false, error: null });
      return;
    }
    setState({ query, loading: true, error: null });
    const id = latest;
    timer = setTimeout(async () => {
      timer = null;
      controller = new AbortController();
      const { signal } = controller;
      try {
        const results = await search(query, signal);
        if (id !== latest) return;
        remember(query, results);
        setState({ results, loading: false });
      } catch (error) {
        if (id !== latest || signal.aborted) return;
        setState({ loading: false, error });
      }
    }, debounceMs);
  }

  return {
    input,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      destroyed = true;
      cancel();
      listeners.clear();
    },
  };
}
```

%% exercise sys-outbox | Optimistic message outbox | 4 | js | js | createOutbox | 50
Build `createOutbox({ send, maxRetries = 3, backoff = (n) => 500 * 2 ** n, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) })`, the sending side of a chat.

`send({ id, text })` returns a promise of `{ serverId }` (or rejects). Returns `{ enqueue, retry, getMessages, subscribe }`.

- **`enqueue(text)`** creates a message `{ id, text, status: 'pending', attempts: 0 }`, where `id` is `"m1"`, `"m2"`, … (a counter). It appears in `getMessages()` **at once** and `enqueue` returns a copy of it as it was created.
- Messages are sent **one at a time, in the order they were queued**: the next message isn't sent until the current one is `sent` or `failed`.
- While a message is being sent its status is `'sending'` and `attempts` goes up by one for each call of `send`. On success: `status: 'sent'` and `serverId` is set.
- On a **failure** (the `send` promise rejects): if `attempts` is **less than** `maxRetries + 1`, set `status: 'retrying'`, `await sleep(backoff(attempts - 1))` and send **again** (same `id` each time: that's the idempotency key). Otherwise set `status: 'failed'` and **move on to the next message**.
- **`retry(id)`** puts a `failed` message back to `status: 'pending'`, `attempts: 0` and queues it again. It does nothing for messages that aren't failed.
- **`getMessages()`** returns **copies**, in creation order. `subscribe(listener)` calls `listener(messages)` after every change and returns an unsubscribe function.

%% worked
**A similar problem, solved: `createSerialQueue(task)`** — run async jobs strictly one after another, retrying each a limited number of times.

```js
function createSerialQueue(task, maxTries = 3) {
  const waiting = [];
  let running = false;

  async function pump() {
    if (running) return;                 // ① only one worker loop at a time
    running = true;
    while (waiting.length) {             // ② take the jobs in order
      const job = waiting.shift();
      for (let attempt = 1; attempt <= maxTries; attempt++) {
        try { await task(job); break; }  // ③ success: leave the retry loop
        catch { /* try again */ }
      }
    }
    running = false;                     // ④ nothing left: allow the next pump to start
  }

  return { add(job) { waiting.push(job); void pump(); } };
}
```

Key points: a `running` flag plus a `while` loop gives **one at a time, in order**; the `for` loop is the **retry**; and there is no `await` between the final `while` check and `running = false`, so a job added at that moment can't be missed. The outbox adds **status updates** after each step.

%% explain
- **Creation:** a new message is visible immediately as `pending` with a local id.
- **Ordering:** only one `send` runs at a time; later messages wait.
- **Success:** `sent` with the `serverId`.
- **Failure:** `retrying` with backoff, re-sending with the same `id`, until the attempts run out, then `failed`; a failed message doesn't block later ones.
- **Manual retry:** only for failed messages; it starts again from zero attempts.
- **Observability:** `getMessages()` returns copies, and subscribers hear about each change.

%% nudge
- What stops two pumps from running at the same time?
- How many total `send` calls should one failing message cause when `maxRetries` is 3?

%% starter
```js
export function createOutbox({
  send,
  maxRetries = 3,
  backoff = (n) => 500 * 2 ** n,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  let messages = [];
  const queue = [];       // ids waiting to be sent, in order
  let running = false;
  let counter = 0;
  const listeners = new Set();

  function update(id, patch) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    listeners.forEach((listener) => listener(messages.map((m) => ({ ...m }))));
  }
  const find = (id) => messages.find((m) => m.id === id);

  async function deliver(id) {
    // loop: update to 'sending' (attempts + 1) → await send({ id, text })
    //   success → 'sent' with serverId, stop
    //   failure → too many attempts? 'failed', stop · else 'retrying', await sleep(backoff(attempts - 1)), loop
  }

  async function pump() {
    // one worker loop: while queue.length, await deliver(queue.shift()); guard with `running`
  }

  return {
    enqueue(text) {
      // create the message, add it, notify, queue its id, start pump(), return a copy of the new message
    },
    retry(id) {},
    getMessages: () => messages.map((m) => ({ ...m })),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
```

%% tests
```js
function setup(options = {}) {
  const sends = [];
  const sendFn = jest.fn(({ id, text }) => new Promise((resolve, reject) => { sends.push({ id, text, resolve, reject }); }));
  const delays = [];
  const sleep = jest.fn(async (ms) => { delays.push(ms); });
  const outbox = createOutbox({ send: sendFn, sleep, ...options });
  const statuses = () => outbox.getMessages().map((m) => m.status);
  return { outbox, sendFn, sends, delays, sleep, statuses };
}

describe('createOutbox', () => {
  it('shows a new message immediately as pending with a local id', () => {
    const { outbox } = setup();
    const m = outbox.enqueue('hello');
    expect(m).toMatchObject({ id: 'm1', text: 'hello', status: 'pending', attempts: 0 });
    expect(outbox.getMessages().length).toBe(1);
    expect(outbox.enqueue('again').id).toBe('m2');
  });

  it('sends one message at a time, in order', async () => {
    const { outbox, sendFn, sends, statuses } = setup();
    outbox.enqueue('one');
    outbox.enqueue('two');
    outbox.enqueue('three');
    await flushPromises();
    expect(sendFn).toHaveBeenCalledTimes(1);
    expect(statuses()).toEqual(['sending', 'pending', 'pending']);
    sends[0].resolve({ serverId: 's1' });
    await flushPromises();
    expect(sendFn).toHaveBeenCalledTimes(2);
    expect(sends[1].text).toBe('two');
    sends[1].resolve({ serverId: 's2' });
    await flushPromises();
    expect(sends[2].text).toBe('three');
  });

  it('marks a message sent and stores the server id', async () => {
    const { outbox, sends } = setup();
    outbox.enqueue('hi');
    await flushPromises();
    sends[0].resolve({ serverId: 'srv-9' });
    await flushPromises();
    expect(outbox.getMessages()[0]).toMatchObject({ status: 'sent', serverId: 'srv-9', attempts: 1 });
  });

  it('retries a failure with backoff, re-sending the same id', async () => {
    const { outbox, sends, delays, statuses } = setup();
    outbox.enqueue('flaky');
    await flushPromises();
    sends[0].reject(new Error('net'));
    await flushPromises();
    expect(delays).toEqual([500]);
    expect(sends.length).toBe(2);
    expect(sends[1].id).toBe(sends[0].id);
    expect(statuses()).toEqual(['sending']);
    sends[1].resolve({ serverId: 'x' });
    await flushPromises();
    expect(outbox.getMessages()[0]).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('shows retrying while it waits to try again', async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const { outbox, sends, statuses } = setup({ sleep: () => gate });
    outbox.enqueue('x');
    await flushPromises();
    sends[0].reject(new Error('net'));
    await flushPromises();
    expect(statuses()).toEqual(['retrying']);
    release();
    await flushPromises();
    expect(statuses()).toEqual(['sending']);
  });

  it('uses exponential backoff by default and honours a custom one', async () => {
    const a = setup({ maxRetries: 3 });
    a.outbox.enqueue('x');
    for (let i = 0; i < 4; i++) { await flushPromises(); a.sends[i].reject(new Error('no')); }
    await flushPromises();
    expect(a.delays).toEqual([500, 1000, 2000]);
    const b = setup({ maxRetries: 2, backoff: (n) => (n + 1) * 10 });
    b.outbox.enqueue('x');
    for (let i = 0; i < 3; i++) { await flushPromises(); b.sends[i].reject(new Error('no')); }
    await flushPromises();
    expect(b.delays).toEqual([10, 20]);
  });

  it('fails after maxRetries retries and then moves on to the next message', async () => {
    const { outbox, sends, sendFn, statuses } = setup({ maxRetries: 2 });
    outbox.enqueue('doomed');
    outbox.enqueue('fine');
    for (let i = 0; i < 3; i++) { await flushPromises(); sends[i].reject(new Error('no')); }
    await flushPromises();
    expect(statuses()[0]).toBe('failed');
    expect(outbox.getMessages()[0].attempts).toBe(3);
    expect(sendFn).toHaveBeenCalledTimes(4);
    expect(sends[3].text).toBe('fine');
    sends[3].resolve({ serverId: 'ok' });
    await flushPromises();
    expect(statuses()).toEqual(['failed', 'sent']);
  });

  it('retry(id) resends a failed message from zero attempts', async () => {
    const { outbox, sends, statuses } = setup({ maxRetries: 0 });
    outbox.enqueue('x');
    await flushPromises();
    sends[0].reject(new Error('no'));
    await flushPromises();
    expect(statuses()).toEqual(['failed']);
    outbox.retry('m1');
    await flushPromises();
    expect(statuses()).toEqual(['sending']);
    expect(outbox.getMessages()[0].attempts).toBe(1);
    sends[1].resolve({ serverId: 'again' });
    await flushPromises();
    expect(statuses()).toEqual(['sent']);
  });

  it('retry ignores messages that are not failed', async () => {
    const { outbox, sendFn } = setup();
    outbox.enqueue('x');
    await flushPromises();
    outbox.retry('m1');
    outbox.retry('nope');
    await flushPromises();
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('returns copies from getMessages and enqueue', () => {
    const { outbox } = setup();
    const m = outbox.enqueue('x');
    m.text = 'tampered';
    outbox.getMessages()[0].status = 'sent';
    expect(outbox.getMessages()[0]).toMatchObject({ text: 'x', status: expect.any(String) });
    expect(outbox.getMessages()[0].status).not.toBe('sent');
  });

  it('notifies subscribers and stops after unsubscribe', async () => {
    const { outbox, sends } = setup();
    const seen = [];
    const off = outbox.subscribe((msgs) => seen.push(msgs.map((m) => m.status).join(',')));
    outbox.enqueue('x');
    await flushPromises();
    sends[0].resolve({ serverId: 's' });
    await flushPromises();
    expect(seen).toEqual(['pending', 'sending', 'sent']);
    off();
    outbox.enqueue('y');
    expect(seen.length).toBe(3);
  });
});
```

%% hints
- Keep `attempts` on the message: when starting a send do `update(id, { status: 'sending', attempts: find(id).attempts + 1 })`.
- After a failure: `if (find(id).attempts >= maxRetries + 1) { update(id, { status: 'failed' }); return; }` else `update(id, { status: 'retrying' }); await sleep(backoff(find(id).attempts - 1));`
- `pump`: `if (running) return; running = true; while (queue.length) await deliver(queue.shift()); running = false;`
- `enqueue`: create `{ id: 'm' + ++counter, text, status: 'pending', attempts: 0 }`, push it, notify listeners, `queue.push(id)`, `void pump()`, then return a copy of the **original** object.

%% solution
```js
export function createOutbox({
  send,
  maxRetries = 3,
  backoff = (n) => 500 * 2 ** n,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  let messages = [];
  const queue = [];
  let running = false;
  let counter = 0;
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener(messages.map((m) => ({ ...m }))));
  function update(id, patch) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
    notify();
  }
  const find = (id) => messages.find((m) => m.id === id);

  async function deliver(id) {
    for (;;) {
      update(id, { status: 'sending', attempts: find(id).attempts + 1 });
      try {
        const { serverId } = await send({ id, text: find(id).text });
        update(id, { status: 'sent', serverId });
        return;
      } catch {
        if (find(id).attempts >= maxRetries + 1) {
          update(id, { status: 'failed' });
          return;
        }
        update(id, { status: 'retrying' });
        await sleep(backoff(find(id).attempts - 1));
      }
    }
  }

  async function pump() {
    if (running) return;
    running = true;
    while (queue.length) await deliver(queue.shift());
    running = false;
  }

  return {
    enqueue(text) {
      const message = { id: `m${++counter}`, text, status: 'pending', attempts: 0 };
      messages = [...messages, message];
      notify();
      queue.push(message.id);
      void pump();
      return { ...message };
    },
    retry(id) {
      const message = find(id);
      if (!message || message.status !== 'failed') return;
      update(id, { status: 'pending', attempts: 0 });
      queue.push(id);
      void pump();
    },
    getMessages: () => messages.map((m) => ({ ...m })),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```
