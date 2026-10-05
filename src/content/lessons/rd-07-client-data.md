---
id: rd-client-data
track: rd
title: Client data layers: query caching, optimistic updates and prefetching
summary: How a client-side query cache works (keys, stale time, shared requests, invalidation), how to update optimistically and roll back safely, how to retry with backoff, and how to decide when prefetching is worth it.
---

## The idea in one sentence

Data from your API is **server state**: a **cache of someone else's data** that goes stale and can be fetched by many components at once, so it deserves a **dedicated cache** (keys, freshness, sharing, invalidation) instead of `useState` plus `useEffect` in every component.

> **Analogy** A newsstand. Customers ask for "today's *Sports* section" (the **key**). If a copy arrived recently it is handed over at once (**fresh**); if it is a day old it is still handed over but a new one is ordered (**stale, refetched in the background**); and if ten customers ask while the delivery truck is on its way, there is **one truck**, not ten.

*(In practice: TanStack Query, SWR, RTK Query, Apollo, or Next.js's fetch cache on the server. You will build the core.)*

## The query cache

![Query cache](fig:rd-querycache "Keys, freshness, shared requests, invalidation.")

- **Key**: the identity of the data, usually an array: `['todos', { page: 1 }]`. Objects inside keys must hash the same **whatever their property order**.
- **`staleTime`**: how long data counts as **fresh**. Fresh data is returned with **no request**. `0` means "always refetch".
- **Dedupe**: components asking for the same key at the same moment **share one request**.
- **Invalidation**: after a mutation, mark every query whose key **starts with** a prefix (`['todos']`) as stale, without throwing the data away, so the UI keeps showing it while it refreshes.
- **Subscribers**: components listen to a key and re-render when its data changes.

```js try predict
const hash = (key) =>
  JSON.stringify(key, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

console.log(
  hash(['todos', { page: 1, done: false }]) === hash(['todos', { done: false, page: 1 }]),
  hash(['todos']) === hash('todos'),
);
```

```stepper One key through its life
code:
  query(['todos'], fetch, { staleTime: 60_000 })   // t = 0
  query(['todos'], fetch, { staleTime: 60_000 })   // t = 30 s
  query(['todos'], fetch, { staleTime: 60_000 })   // t = 90 s
  invalidate(['todos'])                            // after a mutation
---
line: 1
say: Nothing cached: the request goes out, the data is stored with the **time it arrived**, and subscribers are told.
phase: first fetch
---
line: 2
say: 30 seconds old is **younger than `staleTime`**, so the cached data is returned and **no request is made**.
phase: fresh
---
line: 3
say: 90 seconds old is **stale**. The query fetches again and replaces the data; two components asking at that moment share **one** request.
phase: stale
---
line: 4
say: A mutation says "todos changed". Every entry whose key **starts with** `['todos']` is marked stale; **the data stays** so the UI does not flash empty.
phase: invalidated
```

## Retries and backoff

Requests fail for transient reasons. A good client **retries network errors, 408, 429 and 5xx**, but **never 4xx** (the request itself is wrong). It waits **exponentially longer** each time, with **jitter** (a random fraction of the delay) so thousands of clients do not retry in lockstep, and it **honours `Retry-After`** when the server sends it. Cap both the attempts and the delay.

## Optimistic updates

![Optimistic update](fig:rd-optimistic "Change the UI first, reconcile with the server after.")

For actions that almost always succeed (a like, a checkbox, a reorder) update the cache **before** the server answers, and reconcile after: success means **refetch** to confirm the truth; failure means **roll back** to the value you saved first. One subtle bug: if the user did **another** change while the request was in flight, rolling back to your old snapshot **erases it**. Roll back only if the data is still the value you wrote; otherwise just refetch.

## Prefetching

![Prefetch decision](fig:rd-prefetch "Prefetch on intent, never on a hunch, never on a slow connection.")

Fetching data (or code) **before** the click makes navigation feel instant, but every wrong guess costs the user bandwidth. Trigger on **intent** (hover for ~100 ms, the link visible in the viewport), skip what is **already cached**, **limit** how many prefetches are in flight, and **never** prefetch when the user enabled **Save-Data** or is on a **2G-class** connection.

## Quick check

```check
Q: Two components request the same query key in the same tick. How many network requests?
A) Two
B) One, shared *
C) Zero
D) It depends on the server
Why: In-flight requests for a key are deduplicated.
---
Q: What does invalidating ['todos'] do?
A) Deletes every cached query
B) Marks queries whose key starts with ['todos'] stale, keeping their data until refetched *
C) Refetches only ['todos'] exactly
D) Clears the browser cache
Why: Prefix matching, and the data stays on screen while it refreshes.
---
Q: An optimistic update fails, but the user made a newer change meanwhile. What should the rollback do?
A) Restore the old snapshot anyway
B) Not overwrite the newer change; refetch instead *
C) Delete the cache
D) Retry forever
Why: Blindly restoring a snapshot would destroy the newer change.
---
Q: Which responses should a client retry?
A) All 4xx
B) Network errors, 408, 429 and 5xx *
C) Only 200
D) Nothing
Why: Those are transient; other 4xx mean the request is wrong and retrying cannot help.
```

## Recap

- **Server state** lives in a query cache: **key**, **staleTime**, **dedupe**, **prefix invalidation**, **subscribers**.
- Keys must hash **independent of property order**.
- **Retry** transient errors with **capped exponential backoff + jitter**, honour `Retry-After`.
- **Optimistic updates**: save, apply, reconcile; roll back **only if nothing newer** changed the data.
- **Prefetch** on intent; skip when cached, busy, Save-Data or slow.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: hash a query key | Recursive serialisation with sorted object keys |
| A query client | Maps, freshness maths, in-flight sharing, prefix matching, subscribers |
| Backoff and retry | Exponential delay, jitter with an injected `random`, error classification |
| Optimistic update | Snapshot, apply, rollback guard, invalidate |
| Should we prefetch? | An ordered list of reasons |
| Tests for a query client | A fake clock, fetch spies, a deferred promise |

%% exercise rdl-guided-hash | Guided: hash a query key | 2 | js | js | hashKey | 10 | guided
Implement `hashKey(key)` that turns a query key into a **string**, such that two keys that are equal as data hash identically **regardless of object property order**.

- Arrays keep their element order; nested objects and arrays are handled at any depth.
- Plain objects are serialised with their keys **sorted**.
- Use JSON for everything else.

```js
hashKey(['todos', { page: 1, done: false }]) === hashKey(['todos', { done: false, page: 1 }]); // true
hashKey(['a', 'b']) === hashKey(['b', 'a']);                                                    // false
```

%% worked
**A similar problem, solved: `canonical(value)`** — normalise before serialising, so equal data gives equal text.

```js
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);                  // ① arrays: normalise each element, keep the order
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);   // ② objects: rebuild with sorted keys
    return out;
  }
  return value;                                                            // ③ primitives pass through
}
const hash = (v) => JSON.stringify(canonical(v));
```

`JSON.stringify` writes keys in **insertion order**, so rebuilding the object with sorted keys is what makes the output stable.

%% explain
- **Recursive normaliser** that sorts object keys.
- **`JSON.stringify`** of the result.

%% nudge
- Why must arrays keep their order while objects do not?

%% starter
```js
export function hashKey(key) {
  return JSON.stringify(key);
}
```

%% tests
```js
describe('hashKey', () => {
  it('ignores object property order, at any depth', () => {
    expect(hashKey(['todos', { page: 1, done: false }])).toBe(hashKey(['todos', { done: false, page: 1 }]));
    expect(hashKey({ a: { x: 1, y: 2 }, b: 1 })).toBe(hashKey({ b: 1, a: { y: 2, x: 1 } }));
    expect(hashKey([{ b: 1, a: [{ d: 1, c: 2 }] }])).toBe(hashKey([{ a: [{ c: 2, d: 1 }], b: 1 }]));
  });
  it('keeps array order significant', () => {
    expect(hashKey(['a', 'b'])).not.toBe(hashKey(['b', 'a']));
  });
  it('tells different values apart', () => {
    expect(hashKey(['todos', { page: 1 }])).not.toBe(hashKey(['todos', { page: 2 }]));
    expect(hashKey(['todos'])).not.toBe(hashKey('todos'));
    expect(hashKey(['1'])).not.toBe(hashKey([1]));
  });
  it('returns a string for primitives too', () => {
    expect(typeof hashKey('x')).toBe('string');
    expect(typeof hashKey(5)).toBe('string');
    expect(typeof hashKey(null)).toBe('string');
  });
  it('does not change its input', () => {
    const key = ['a', { z: 1, a: 2 }];
    hashKey(key);
    expect(Object.keys(key[1])).toEqual(['z', 'a']);
  });
});
```

%% hints
- `canonical(value)`: arrays → `map(canonical)`; objects → rebuild with `Object.keys(value).sort()`.
- `return JSON.stringify(canonical(key));`

%% solution
```js
export function hashKey(key) {
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
      return out;
    }
    return value;
  };
  return JSON.stringify(canonical(key));
}
```

%% exercise rdl-query-client | A query client | 4 | js | js | createQueryClient | 50
`createQueryClient({ now })` returns `{ query, getData, setData, invalidate, subscribe, isStale }`. A **key** is an array (a non-array key `k` means `[k]`). Two keys are the same entry when their **elements hash equal**, independent of object property order (sort object keys when serialising).

- `query(key, fn, { staleTime = 0 } = {})` (async): if there is an entry that is **not invalidated** and `now() - updatedAt < staleTime`, return its data without calling `fn`. Otherwise call `fn()` (synchronously) and store the result as `{ data, updatedAt: now() }` (clearing the invalidated flag), notify subscribers, and return it. Concurrent `query` calls for the same key share **one** `fn` call. If `fn` fails, `query` rejects and the entry is left as it was.
- `getData(key)` returns the stored data or `undefined`.
- `setData(key, updater)` stores `updater` (or `updater(oldData)` when it is a function) with `updatedAt: now()`, clears the invalidated flag, notifies subscribers, and returns the new data.
- `invalidate(prefix)` marks every entry whose key **starts with** `prefix` (element by element) as invalidated, **keeping its data**, and returns how many entries it marked.
- `isStale(key, staleTime = 0)` is `true` when there is no entry, it is invalidated, or `now() - updatedAt >= staleTime`.
- `subscribe(key, listener)` calls `listener(data)` for every later data change of **that exact key** (`query` success or `setData`; **not** invalidation) and returns an unsubscribe function.

```js
const client = createQueryClient({ now: () => Date.now() });
await client.query(['todos', { page: 1 }], () => api.todos(1), { staleTime: 60000 });
client.invalidate(['todos']);
```

%% worked
**A similar problem, solved: `createKeyedStore({ now })`** — entries by canonical key, freshness from a timestamp, a **prefix** match.

```js
function createKeyedStore({ now }) {
  const entries = new Map();                                  // hashed key -> { key, data, updatedAt }
  const norm = (key) => (Array.isArray(key) ? key : [key]);
  const hash = (v) => JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x);
  const startsWith = (key, prefix) =>
    key.length >= prefix.length && prefix.every((part, i) => hash(part) === hash(key[i]));   // ① compare element by element
  return {
    set(key, data) { entries.set(hash(norm(key)), { key: norm(key), data, updatedAt: now() }); },
    isFresh(key, ttl) {
      const e = entries.get(hash(norm(key)));
      return Boolean(e) && now() - e.updatedAt < ttl;           // ② strictly younger than the TTL
    },
    matching(prefix) { return [...entries.values()].filter((e) => startsWith(e.key, norm(prefix))); },
  };
}
```

Your client adds the **in-flight map**, the **invalidated flag** (so data stays but counts as stale) and **listeners per entry**. Hash the **normalised key array**, so `'todos'` and `['todos']` are the same entry.

%% explain
- **`entries`** (hash → `{ key, data, updatedAt, invalidated }`), **`inflight`**, **`listeners`**.
- **Fresh** = exists, not invalidated, younger than `staleTime`.
- **Prefix** match element by element; mark, don't delete.

%% nudge
- Why must the key be normalised to an array before hashing?
- What should `isStale` say for an invalidated entry that is younger than `staleTime`?

%% starter
```js
export function createQueryClient({ now }) {
  return {
    async query(key, fn, options = {}) {
      return fn();
    },
    getData(key) {},
    setData(key, updater) {},
    invalidate(prefix) {
      return 0;
    },
    subscribe(key, listener) {
      return () => {};
    },
    isStale(key, staleTime = 0) {
      return true;
    },
  };
}
```

%% tests
```js
describe('createQueryClient', () => {
  const setup = () => {
    let t = 0;
    let n = 0;
    const client = createQueryClient({ now: () => t });
    const fn = jest.fn(async () => 'data' + ++n);
    return { client, fn, at: (x) => { t = x; } };
  };
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };

  it('fetches, stores and returns the data', async () => {
    const { client, fn } = setup();
    expect(await client.query(['todos'], fn)).toBe('data1');
    expect(client.getData(['todos'])).toBe('data1');
    expect(client.getData(['other'])).toBeUndefined();
  });
  it('calls fn synchronously on a fetch', () => {
    const { client, fn } = setup();
    client.query(['a'], fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('returns fresh data without fetching, until exactly staleTime', async () => {
    const { client, fn, at } = setup();
    await client.query(['a'], fn, { staleTime: 1000 });
    at(999);
    expect(await client.query(['a'], fn, { staleTime: 1000 })).toBe('data1');
    expect(fn).toHaveBeenCalledTimes(1);
    at(1000);
    expect(await client.query(['a'], fn, { staleTime: 1000 })).toBe('data2');
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('treats the default staleTime of 0 as always stale', async () => {
    const { client, fn } = setup();
    await client.query(['a'], fn);
    await client.query(['a'], fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('shares one fetch between concurrent queries', async () => {
    const d = deferred();
    const fn = jest.fn(() => d.promise);
    const client = createQueryClient({ now: () => 0 });
    const a = client.query(['a'], fn);
    const b = client.query(['a'], fn);
    d.resolve('x');
    expect(await a).toBe('x');
    expect(await b).toBe('x');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('rejects a failed fetch, keeps the old data and allows a retry', async () => {
    const { client, fn } = setup();
    await client.query(['a'], fn);
    const bad = jest.fn(async () => { throw new Error('down'); });
    await expect(client.query(['a'], bad)).rejects.toThrow('down');
    expect(client.getData(['a'])).toBe('data1');
    expect(await client.query(['a'], fn)).toBe('data2');
  });
  it('treats key objects the same whatever their property order, and strings as one-element arrays', async () => {
    const { client, fn } = setup();
    await client.query(['todos', { page: 1, done: false }], fn, { staleTime: 1000 });
    await client.query(['todos', { done: false, page: 1 }], fn, { staleTime: 1000 });
    expect(fn).toHaveBeenCalledTimes(1);
    client.setData('single', 5);
    expect(client.getData(['single'])).toBe(5);
    expect(client.getData(['todos', { page: 2, done: false }])).toBeUndefined();
  });
  it('sets data directly, with a value or an updater', () => {
    const { client } = setup();
    expect(client.setData(['n'], 1)).toBe(1);
    expect(client.setData(['n'], (old) => old + 1)).toBe(2);
    expect(client.getData(['n'])).toBe(2);
  });
  it('setData counts as a fresh fetch', async () => {
    const { client, fn, at } = setup();
    client.setData(['a'], 'manual');
    at(500);
    expect(await client.query(['a'], fn, { staleTime: 1000 })).toBe('manual');
    expect(fn).not.toHaveBeenCalled();
  });
  it('invalidates by prefix, keeps the data, and counts what it marked', async () => {
    const { client, fn } = setup();
    await client.query(['todos', 1], fn, { staleTime: 10 ** 6 });
    await client.query(['todos', 2], fn, { staleTime: 10 ** 6 });
    await client.query(['users'], fn, { staleTime: 10 ** 6 });
    expect(client.invalidate(['todos'])).toBe(2);
    expect(client.getData(['todos', 1])).toBe('data1');
    expect(client.isStale(['todos', 1], 10 ** 6)).toBe(true);
    expect(client.isStale(['users'], 10 ** 6)).toBe(false);
    await client.query(['todos', 1], fn, { staleTime: 10 ** 6 });
    expect(fn).toHaveBeenCalledTimes(4);
    expect(client.isStale(['todos', 1], 10 ** 6)).toBe(false);
  });
  it('invalidates an exact key, and nothing for an unknown prefix', async () => {
    const { client, fn } = setup();
    await client.query(['a', { x: 1 }], fn);
    expect(client.invalidate(['a', { x: 1 }])).toBe(1);
    expect(client.invalidate(['zzz'])).toBe(0);
    expect(client.invalidate(['a', { x: 1 }, 'longer'])).toBe(0);
  });
  it('reports staleness', async () => {
    const { client, fn, at } = setup();
    expect(client.isStale(['a'])).toBe(true);
    await client.query(['a'], fn);
    expect(client.isStale(['a'], 100)).toBe(false);
    at(100);
    expect(client.isStale(['a'], 100)).toBe(true);
  });
  it('notifies subscribers of that exact key, until they unsubscribe', async () => {
    const { client, fn } = setup();
    const listener = jest.fn();
    const other = jest.fn();
    const off = client.subscribe(['a'], listener);
    client.subscribe(['b'], other);
    await client.query(['a'], fn);
    client.setData(['a'], 'manual');
    expect(listener.mock.calls).toEqual([['data1'], ['manual']]);
    expect(other).not.toHaveBeenCalled();
    client.invalidate(['a']);
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    client.setData(['a'], 'later');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
```

%% hints
- `const norm = (key) => (Array.isArray(key) ? key : [key]);` and `hash = (v) => JSON.stringify(canonical(v))`.
- `entries: Map(hash → { key, data, updatedAt, invalidated })`.
- Prefix: `prefix.every((part, i) => hash(part) === hash(entry.key[i]))` and `entry.key.length >= prefix.length`.
- Notify with `[...(listeners.get(h) ?? [])].forEach((l) => l(data))`.

%% solution
```js
export function createQueryClient({ now }) {
  const entries = new Map();
  const inflight = new Map();
  const listeners = new Map();

  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value).sort()) out[k] = canonical(value[k]);
      return out;
    }
    return value;
  };
  const hash = (value) => JSON.stringify(canonical(value));
  const norm = (key) => (Array.isArray(key) ? key : [key]);
  const idOf = (key) => hash(norm(key));

  const store = (key, data) => {
    entries.set(idOf(key), { key: norm(key), data, updatedAt: now(), invalidated: false });
    for (const listener of [...(listeners.get(idOf(key)) ?? [])]) listener(data);
  };
  const isFresh = (entry, staleTime) => Boolean(entry) && !entry.invalidated && now() - entry.updatedAt < staleTime;

  return {
    async query(key, fn, { staleTime = 0 } = {}) {
      const id = idOf(key);
      const entry = entries.get(id);
      if (isFresh(entry, staleTime)) return entry.data;
      if (inflight.has(id)) return inflight.get(id);
      const promise = new Promise((resolve) => resolve(fn()))
        .then((data) => {
          store(key, data);
          return data;
        })
        .finally(() => {
          if (inflight.get(id) === promise) inflight.delete(id);
        });
      inflight.set(id, promise);
      return promise;
    },
    getData(key) {
      return entries.get(idOf(key))?.data;
    },
    setData(key, updater) {
      const old = entries.get(idOf(key))?.data;
      const data = typeof updater === 'function' ? updater(old) : updater;
      store(key, data);
      return data;
    },
    invalidate(prefix) {
      const p = norm(prefix);
      let count = 0;
      for (const entry of entries.values()) {
        if (entry.key.length >= p.length && p.every((part, i) => hash(part) === hash(entry.key[i]))) {
          entry.invalidated = true;
          count++;
        }
      }
      return count;
    },
    subscribe(key, listener) {
      const id = idOf(key);
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(listener);
      return () => listeners.get(id).delete(listener);
    },
    isStale(key, staleTime = 0) {
      return !isFresh(entries.get(idOf(key)), staleTime);
    },
  };
}
```

%% exercise rdl-retry | Retry with backoff and jitter | 3 | js | js | nextRetry | 26
`nextRetry(error, attempt, options)` decides what to do after a failed request. `attempt` is how many attempts have been made so far (`1` after the first failure). `options` is `{ maxAttempts = 3, base = 1000, max = 30000, random = Math.random }`. It returns `{ retry, delayMs }`.

- If `attempt >= maxAttempts`, or the error is **not retryable**: `{ retry: false, delayMs: 0 }`.
- **Retryable** means: the error has **no `status`** (a network error), or the status is `408`, `429` or `500` and above. Other statuses (for example `400`, `401`, `404`) are not.
- If the error has a numeric **`retryAfter`** (seconds), the delay is `min(max, retryAfter * 1000)` with **no jitter**.
- Otherwise the delay uses **full jitter**: `Math.floor(random() * min(max, base * 2 ** (attempt - 1)))`.

```js
nextRetry({ status: 503 }, 1, { random: () => 0.5 }); // { retry: true, delayMs: 500 }
nextRetry({ status: 404 }, 1);                        // { retry: false, delayMs: 0 }
```

%% worked
**A similar problem, solved: `nextPoll(result, tries, opts)`** — decide **whether** and **when**, with a cap and jitter.

```js
function nextPoll(result, tries, { maxTries = 5, base = 500, cap = 8000, random = Math.random } = {}) {
  if (tries >= maxTries || result.done) return { again: false, waitMs: 0 };      // ① stop conditions first
  const ceiling = Math.min(cap, base * 2 ** (tries - 1));                          // ② the exponential ceiling, capped
  return { again: true, waitMs: Math.floor(random() * ceiling) };                  // ③ jitter: a random point in [0, ceiling)
}
```

Full jitter spreads retries evenly between `0` and the ceiling, which is better than adding a small random amount to a fixed delay: it breaks up **synchronised retry storms**.

%% explain
- **Stop conditions**: attempts used up or not retryable.
- **`retryAfter`** wins over the computed delay.
- **Full jitter** below a capped exponential ceiling.

%% nudge
- Which check comes before the delay maths?
- Does `Retry-After` get jitter?

%% starter
```js
export function nextRetry(error, attempt, options = {}) {
  return { retry: false, delayMs: 0 };
}
```

%% tests
```js
describe('nextRetry', () => {
  it('retries network errors and transient statuses', () => {
    for (const error of [{}, { status: 408 }, { status: 429 }, { status: 500 }, { status: 503 }]) {
      expect(nextRetry(error, 1, { random: () => 0.5 }).retry).toBe(true);
    }
  });
  it('does not retry other client errors', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(nextRetry({ status }, 1)).toEqual({ retry: false, delayMs: 0 });
    }
  });
  it('stops when the attempts are used up', () => {
    expect(nextRetry({ status: 503 }, 3)).toEqual({ retry: false, delayMs: 0 });
    expect(nextRetry({ status: 503 }, 2, { random: () => 0 }).retry).toBe(true);
    expect(nextRetry({ status: 503 }, 5, { maxAttempts: 6, random: () => 0 }).retry).toBe(true);
  });
  it('uses full jitter below an exponential ceiling', () => {
    expect(nextRetry({ status: 503 }, 1, { random: () => 0.5 }).delayMs).toBe(500);
    expect(nextRetry({ status: 503 }, 2, { random: () => 0.5 }).delayMs).toBe(1000);
    expect(nextRetry({ status: 503 }, 1, { random: () => 0 }).delayMs).toBe(0);
    expect(nextRetry({ status: 503 }, 1, { random: () => 0.999 }).delayMs).toBe(999);
  });
  it('honours base and max', () => {
    expect(nextRetry({ status: 503 }, 2, { base: 200, random: () => 0.5, maxAttempts: 9 }).delayMs).toBe(200);
    expect(nextRetry({ status: 503 }, 8, { base: 1000, max: 5000, random: () => 0.5, maxAttempts: 9 }).delayMs).toBe(2500);
  });
  it('lets Retry-After override, capped, without jitter', () => {
    expect(nextRetry({ status: 429, retryAfter: 7 }, 1, { random: () => 0.1 })).toEqual({ retry: true, delayMs: 7000 });
    expect(nextRetry({ status: 429, retryAfter: 600 }, 1, { max: 30000 })).toEqual({ retry: true, delayMs: 30000 });
  });
  it('ignores a non-numeric retryAfter', () => {
    expect(nextRetry({ status: 503, retryAfter: 'soon' }, 1, { random: () => 0.5 }).delayMs).toBe(500);
  });
  it('does not honour Retry-After for errors that are not retryable', () => {
    expect(nextRetry({ status: 400, retryAfter: 5 }, 1)).toEqual({ retry: false, delayMs: 0 });
  });
});
```

%% hints
- `const retryable = error.status === undefined || error.status === 408 || error.status === 429 || error.status >= 500;`
- `typeof error.retryAfter === 'number'` for the override.
- `Math.floor(random() * Math.min(max, base * 2 ** (attempt - 1)))`

%% solution
```js
export function nextRetry(error, attempt, { maxAttempts = 3, base = 1000, max = 30000, random = Math.random } = {}) {
  const status = error && error.status;
  const retryable = status === undefined || status === 408 || status === 429 || status >= 500;
  if (attempt >= maxAttempts || !retryable) return { retry: false, delayMs: 0 };
  if (typeof error.retryAfter === 'number') return { retry: true, delayMs: Math.min(max, error.retryAfter * 1000) };
  const ceiling = Math.min(max, base * 2 ** (attempt - 1));
  return { retry: true, delayMs: Math.floor(random() * ceiling) };
}
```

%% exercise rdl-optimistic-update | An optimistic update with safe rollback | 4 | js | js | optimisticUpdate | 36
`optimisticUpdate({ client, key, apply, request })` (async) updates a cache optimistically. `client` has `getData(key)`, `setData(key, valueOrUpdater)` (which **returns** the stored value) and `invalidate(key)`.

1. Save `previous = client.getData(key)`.
2. Apply the change immediately: `optimistic = client.setData(key, apply(previous))` (if `apply` throws, propagate without touching the cache).
3. `await request()`.
   - On **success**: call `client.invalidate(key)` (so the next read refetches the truth) and **return the request's result**.
   - On **failure**: if the cache still holds the **same value** you wrote (`client.getData(key) === optimistic`), restore it with `client.setData(key, previous)`; if something **else** changed it meanwhile, do **not** restore, call `client.invalidate(key)` instead. Then rethrow the error.
- A synchronous throw from `request` counts as a failure.

```js
await optimisticUpdate({ client, key: ['likes', 1], apply: (n) => n + 1, request: () => api.like(1) });
```

%% worked
**A similar problem, solved: `withUndo(store, key, change, save)`** — snapshot, apply, and undo **only if nobody changed it since**.

```js
async function withUndo(store, key, change, save) {
  const before = store.get(key);                      // ① snapshot BEFORE changing anything
  const mine = change(before);
  store.set(key, mine);                               // ② apply immediately
  try {
    return await save(mine);
  } catch (error) {
    if (store.get(key) === mine) store.set(key, before);   // ③ undo only if my value is still the current one
    throw error;                                           // ④ the caller still sees the failure
  }
}
```

The `===` check on the **value you wrote** is how you detect a concurrent change without any locks. Compare by **reference**: `setData` must return exactly what it stored.

%% explain
- **Snapshot**, **apply**, **await** the request.
- **Success** invalidates; **failure** rolls back only if unchanged, else invalidates.
- **Always rethrow**.

%% nudge
- What is compared to decide whether a rollback is safe?
- What does the function return on success?

%% starter
```js
export async function optimisticUpdate({ client, key, apply, request }) {
  return request();
}
```

%% tests
```js
describe('optimisticUpdate', () => {
  const makeClient = (initial) => {
    const data = new Map(initial ? [['k', initial.value]] : []);
    const log = [];
    return {
      log,
      data,
      getData: (key) => data.get(key),
      setData: (key, v) => {
        const next = typeof v === 'function' ? v(data.get(key)) : v;
        data.set(key, next);
        log.push(['set', next]);
        return next;
      },
      invalidate: (key) => { log.push(['invalidate', key]); return 1; },
    };
  };
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };

  it('updates the cache before the request finishes', async () => {
    const client = makeClient({ value: { likes: 10 } });
    const d = deferred();
    const p = optimisticUpdate({ client, key: 'k', apply: (old) => ({ likes: old.likes + 1 }), request: () => d.promise });
    expect(client.data.get('k')).toEqual({ likes: 11 });
    d.resolve('ok');
    await p;
  });
  it('invalidates on success and returns the request result', async () => {
    const client = makeClient({ value: 1 });
    const result = await optimisticUpdate({ client, key: 'k', apply: (n) => n + 1, request: async () => 'saved' });
    expect(result).toBe('saved');
    expect(client.data.get('k')).toBe(2);
    expect(client.log).toEqual([['set', 2], ['invalidate', 'k']]);
  });
  it('rolls back to the snapshot on failure and rethrows', async () => {
    const client = makeClient({ value: { likes: 10 } });
    const before = client.data.get('k');
    await expect(optimisticUpdate({ client, key: 'k', apply: (o) => ({ likes: o.likes + 1 }), request: async () => { throw new Error('500'); } })).rejects.toThrow('500');
    expect(client.data.get('k')).toBe(before);
    expect(client.log.some(([kind]) => kind === 'invalidate')).toBe(false);
  });
  it('does not overwrite a newer change: it invalidates instead', async () => {
    const client = makeClient({ value: [] });
    const d = deferred();
    const p = optimisticUpdate({ client, key: 'k', apply: (old) => [...old, 'a'], request: () => d.promise });
    client.setData('k', (old) => [...old, 'b']);
    d.reject(new Error('fail'));
    await expect(p).rejects.toThrow('fail');
    expect(client.data.get('k')).toEqual(['a', 'b']);
    expect(client.log[client.log.length - 1]).toEqual(['invalidate', 'k']);
  });
  it('restores undefined when there was nothing cached', async () => {
    const client = makeClient();
    await expect(optimisticUpdate({ client, key: 'k', apply: () => 'new', request: async () => { throw new Error('x'); } })).rejects.toThrow('x');
    expect(client.data.get('k')).toBeUndefined();
  });
  it('treats a synchronous throw from request as a failure', async () => {
    const client = makeClient({ value: 1 });
    await expect(optimisticUpdate({ client, key: 'k', apply: (n) => n + 1, request: () => { throw new Error('sync'); } })).rejects.toThrow('sync');
    expect(client.data.get('k')).toBe(1);
  });
  it('leaves the cache untouched when apply throws', async () => {
    const client = makeClient({ value: 1 });
    const request = jest.fn();
    await expect(optimisticUpdate({ client, key: 'k', apply: () => { throw new Error('bad apply'); }, request })).rejects.toThrow('bad apply');
    expect(client.log).toEqual([]);
    expect(request).not.toHaveBeenCalled();
  });
});
```

%% hints
- `const previous = client.getData(key); const optimistic = client.setData(key, apply(previous));`
- Wrap `await request()` in `try/catch`.
- In the catch: `client.getData(key) === optimistic ? client.setData(key, previous) : client.invalidate(key)`, then `throw error`.

%% solution
```js
export async function optimisticUpdate({ client, key, apply, request }) {
  const previous = client.getData(key);
  const optimistic = client.setData(key, apply(previous));
  try {
    const result = await request();
    client.invalidate(key);
    return result;
  } catch (error) {
    if (client.getData(key) === optimistic) client.setData(key, previous);
    else client.invalidate(key);
    throw error;
  }
}
```

%% exercise rdl-should-prefetch | Should we prefetch? | 2 | js | js | shouldPrefetch | 16
`shouldPrefetch({ saveData, effectiveType, cached, inflight = 0, maxInflight = 2, hoverMs = 0, inViewport = false })` returns `{ prefetch, reason }`. Check these **in order** and answer with the first that applies (`prefetch: false` for all but the last):

1. `saveData` is true → `'save-data'`.
2. `effectiveType` is `'slow-2g'` or `'2g'` → `'slow-network'`.
3. `cached` is true → `'cached'`.
4. `inflight >= maxInflight` → `'busy'`.
5. no sign of intent (`hoverMs < 100` and not `inViewport`) → `'no-intent'`.
6. otherwise `{ prefetch: true, reason: 'ok' }`.

```js
shouldPrefetch({ hoverMs: 150 });            // { prefetch: true, reason: 'ok' }
shouldPrefetch({ saveData: true, hoverMs: 500 }); // { prefetch: false, reason: 'save-data' }
```

%% worked
**A similar problem, solved: `canAutoplay(ctx)`** — an **ordered list of vetoes**, then a positive default.

```js
function canAutoplay({ dataSaver, battery, visible }) {
  if (dataSaver) return { play: false, reason: 'data-saver' };          // ① each veto is checked in a fixed order
  if (battery < 0.2) return { play: false, reason: 'low-battery' };
  if (!visible) return { play: false, reason: 'hidden' };
  return { play: true, reason: 'ok' };                                   // ② only if nothing vetoed
}
```

The order **is** the behaviour: when two reasons apply, the earlier one is reported, and the user-controlled one (`saveData`) comes first.

%% explain
- **Vetoes in a fixed order**, then `ok`.
- **Defaults** for the optional fields.

%% nudge
- Which reason wins when the user has Save-Data on and the link is also cached?

%% starter
```js
export function shouldPrefetch(ctx) {
  return { prefetch: true, reason: 'ok' };
}
```

%% tests
```js
describe('shouldPrefetch', () => {
  it('prefetches on hover intent', () => {
    expect(shouldPrefetch({ hoverMs: 150 })).toEqual({ prefetch: true, reason: 'ok' });
    expect(shouldPrefetch({ hoverMs: 100 })).toEqual({ prefetch: true, reason: 'ok' });
  });
  it('prefetches a visible link', () => {
    expect(shouldPrefetch({ inViewport: true })).toEqual({ prefetch: true, reason: 'ok' });
  });
  it('waits for intent', () => {
    expect(shouldPrefetch({ hoverMs: 99 })).toEqual({ prefetch: false, reason: 'no-intent' });
    expect(shouldPrefetch({})).toEqual({ prefetch: false, reason: 'no-intent' });
  });
  it('never prefetches with save-data', () => {
    expect(shouldPrefetch({ saveData: true, hoverMs: 500, inViewport: true })).toEqual({ prefetch: false, reason: 'save-data' });
  });
  it('never prefetches on slow networks', () => {
    expect(shouldPrefetch({ effectiveType: '2g', hoverMs: 500 })).toEqual({ prefetch: false, reason: 'slow-network' });
    expect(shouldPrefetch({ effectiveType: 'slow-2g', hoverMs: 500 }).reason).toBe('slow-network');
    expect(shouldPrefetch({ effectiveType: '3g', hoverMs: 500 }).prefetch).toBe(true);
    expect(shouldPrefetch({ effectiveType: '4g', hoverMs: 500 }).prefetch).toBe(true);
  });
  it('skips cached targets and respects the in-flight limit', () => {
    expect(shouldPrefetch({ cached: true, hoverMs: 500 })).toEqual({ prefetch: false, reason: 'cached' });
    expect(shouldPrefetch({ inflight: 2, hoverMs: 500 })).toEqual({ prefetch: false, reason: 'busy' });
    expect(shouldPrefetch({ inflight: 1, hoverMs: 500 }).prefetch).toBe(true);
    expect(shouldPrefetch({ inflight: 3, maxInflight: 5, hoverMs: 500 }).prefetch).toBe(true);
  });
  it('reports the first reason in the documented order', () => {
    expect(shouldPrefetch({ saveData: true, effectiveType: '2g', cached: true, inflight: 9 }).reason).toBe('save-data');
    expect(shouldPrefetch({ effectiveType: '2g', cached: true, inflight: 9 }).reason).toBe('slow-network');
    expect(shouldPrefetch({ cached: true, inflight: 9 }).reason).toBe('cached');
    expect(shouldPrefetch({ inflight: 9 }).reason).toBe('busy');
  });
});
```

%% hints
- Destructure with defaults: `{ saveData, effectiveType, cached, inflight = 0, maxInflight = 2, hoverMs = 0, inViewport = false }`.
- One `if` per veto, in order.

%% solution
```js
export function shouldPrefetch({ saveData, effectiveType, cached, inflight = 0, maxInflight = 2, hoverMs = 0, inViewport = false }) {
  if (saveData) return { prefetch: false, reason: 'save-data' };
  if (effectiveType === 'slow-2g' || effectiveType === '2g') return { prefetch: false, reason: 'slow-network' };
  if (cached) return { prefetch: false, reason: 'cached' };
  if (inflight >= maxInflight) return { prefetch: false, reason: 'busy' };
  if (hoverMs < 100 && !inViewport) return { prefetch: false, reason: 'no-intent' };
  return { prefetch: true, reason: 'ok' };
}
```

%% exercise rdl-check-query | Tests for a query client | 4 | js | js | checkQueryClient | 45
`createQueryClient({ now })` returns `{ query, getData, setData, invalidate, subscribe, isStale }` as in the query client exercise: fresh data (younger than `staleTime`) is returned without calling `fn`; concurrent queries for a key share one call; object property order in keys does not matter; `invalidate(prefix)` marks every entry whose key **starts with** the prefix as stale **but keeps its data**; subscribers hear about data changes until they unsubscribe. You are given `checkQueryClient(createQueryClient)` (async). Write a check that passes for a correct client and **fails** for one that: **does not share concurrent fetches**, **ignores staleTime and caches forever**, **refetches fresh data**, **invalidates only exact keys**, **deletes data when invalidating**, **treats key objects with different property order as different**, **keeps notifying after unsubscribe**.

```js
let t = 0;
const client = createQueryClient({ now: () => t });
const fn = jest.fn(async () => 'x');
await client.query(['a'], fn, { staleTime: 1000 });
await client.query(['a'], fn, { staleTime: 1000 });
expect(fn).toHaveBeenCalledTimes(1);
```

%% worked
**A similar problem, solved: `checkKeyedStore(createKeyedStore)`** — scenario per rule, and **observe state with spies and getters**, not just return values.

```js
export function checkKeyedStore(createKeyedStore) {          // createKeyedStore({ now }) → set, isFresh, matching
  let t = 0;
  const store = createKeyedStore({ now: () => t });
  store.set(['a', 1], 'x');
  store.set(['a', 2], 'y');
  store.set(['b'], 'z');
  expect(store.matching(['a']).length).toBe(2);              // ① a prefix matches several entries
  expect(store.matching(['a', 1]).length).toBe(1);           // ② an exact key matches one
  t = 999;
  expect(store.isFresh(['b'], 1000)).toBe(true);
  t = 1000;
  expect(store.isFresh(['b'], 1000)).toBe(false);            // ③ exactly at the TTL it is no longer fresh
}
```

For a query client: **count `fn` calls** for every caching rule, **keep the data visible** after invalidation (`getData` still returns it), and **call the listener spy** before and after `unsubscribe`.

%% explain
- **`fn` call counts** around the staleTime boundary.
- **A deferred `fn`** to prove concurrent sharing.
- **Prefix versus exact** invalidation, and `getData` after it.
- **Property-order keys** and a **listener** that is unsubscribed.

%% nudge
- Which assertion distinguishes "invalidate marks stale" from "invalidate deletes"?
- How do you make two keys that differ only in property order?

%% starter
```js
export async function checkQueryClient(createQueryClient) {
  let t = 0;
  const client = createQueryClient({ now: () => t });
  const fn = jest.fn(async () => 'x');
  await client.query(['a'], fn, { staleTime: 1000 });
  expect(fn).toHaveBeenCalledTimes(1);
  // your assertions: freshness boundary, sharing, key order, invalidation, subscribers
}
```

%% tests
```js
const make = (f = {}) => ({ now }) => {
  const entries = new Map();
  const inflight = new Map();
  const listeners = new Map();
  const canonical = (v) => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object') { const o = {}; for (const k of (f.unsortedKeys ? Object.keys(v) : Object.keys(v).sort())) o[k] = canonical(v[k]); return o; }
    return v;
  };
  const hash = (v) => JSON.stringify(canonical(v));
  const norm = (k) => (Array.isArray(k) ? k : [k]);
  const idOf = (k) => hash(norm(k));
  const store = (key, data) => {
    entries.set(idOf(key), { key: norm(key), data, updatedAt: now(), invalidated: false });
    const set = listeners.get(idOf(key));
    for (const l of [...(set ?? [])]) l(data);
  };
  const isFresh = (e, st) => {
    if (!e || e.invalidated) return false;
    if (f.alwaysRefetch) return false;
    if (f.foreverCache) return true;
    return now() - e.updatedAt < st;
  };
  return {
    async query(key, fn, { staleTime = 0 } = {}) {
      const id = idOf(key);
      const entry = entries.get(id);
      if (isFresh(entry, staleTime)) return entry.data;
      if (!f.noShare && inflight.has(id)) return inflight.get(id);
      const promise = new Promise((r) => r(fn())).then((data) => { store(key, data); return data; }).finally(() => { if (inflight.get(id) === promise) inflight.delete(id); });
      inflight.set(id, promise);
      return promise;
    },
    getData: (key) => entries.get(idOf(key))?.data,
    setData(key, updater) {
      const old = entries.get(idOf(key))?.data;
      const data = typeof updater === 'function' ? updater(old) : updater;
      store(key, data);
      return data;
    },
    invalidate(prefix) {
      const p = norm(prefix);
      let count = 0;
      for (const [id, entry] of [...entries]) {
        const match = f.exactOnly ? (entry.key.length === p.length && p.every((x, i) => hash(x) === hash(entry.key[i]))) : (entry.key.length >= p.length && p.every((x, i) => hash(x) === hash(entry.key[i])));
        if (match) {
          if (f.deleteOnInvalidate) entries.delete(id);
          else entry.invalidated = true;
          count++;
        }
      }
      return count;
    },
    subscribe(key, listener) {
      const id = idOf(key);
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(listener);
      return () => { if (!f.stickyListener) listeners.get(id).delete(listener); };
    },
    isStale: (key, st = 0) => !isFresh(entries.get(idOf(key)), st),
  };
};

const correct = make();
const mutants = {
  'does not share concurrent fetches': make({ noShare: true }),
  'ignores staleTime and caches forever': make({ foreverCache: true }),
  'refetches fresh data': make({ alwaysRefetch: true }),
  'invalidates only exact keys': make({ exactOnly: true }),
  'deletes data when invalidating': make({ deleteOnInvalidate: true }),
  'treats key objects with different property order as different': make({ unsortedKeys: true }),
  'keeps notifying after unsubscribe': make({ stickyListener: true }),
};

describe('your checkQueryClient', () => {
  it('passes on a correct client', async () => {
    await checkQueryClient(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a client that ${name}`, async () => {
      let caught = false;
      try { await checkQueryClient(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Freshness: `staleTime: 1000`, check at `999` (no new fetch) and `1000` (new fetch).
- Concurrency: a `fn` returning a promise you resolve by hand; two `query` calls; count calls **before** resolving.
- Keys: `['todos', { page: 1, done: false }]` and `['todos', { done: false, page: 1 }]` must share an entry.
- Invalidation: `['todos', 1]` and `['todos', 2]` entries; `invalidate(['todos'])` returns `2`; `getData` still returns the data; the next `query` refetches.
- Subscriber: spy called once, then `unsubscribe()`, then `setData` must not call it again.

%% solution
```js
export async function checkQueryClient(createQueryClient) {
  let t = 0;
  const client = createQueryClient({ now: () => t });
  let n = 0;
  const fn = jest.fn(async () => 'data' + ++n);

  await client.query(['fresh'], fn, { staleTime: 1000 });
  t = 999;
  await client.query(['fresh'], fn, { staleTime: 1000 });
  expect(fn).toHaveBeenCalledTimes(1);
  t = 1000;
  await client.query(['fresh'], fn, { staleTime: 1000 });
  expect(fn).toHaveBeenCalledTimes(2);

  let resolve;
  const slow = jest.fn(() => new Promise((r) => { resolve = r; }));
  const a = client.query(['slow'], slow);
  const b = client.query(['slow'], slow);
  expect(slow).toHaveBeenCalledTimes(1);
  resolve('done');
  expect(await a).toBe('done');
  expect(await b).toBe('done');

  const before = fn.mock.calls.length;
  await client.query(['todos', { page: 1, done: false }], fn, { staleTime: 10 ** 6 });
  await client.query(['todos', { done: false, page: 1 }], fn, { staleTime: 10 ** 6 });
  expect(fn.mock.calls.length).toBe(before + 1);

  await client.query(['todos', 2], fn, { staleTime: 10 ** 6 });
  await client.query(['users'], fn, { staleTime: 10 ** 6 });
  expect(client.invalidate(['todos'])).toBe(2);
  expect(client.getData(['todos', 2])).toBeDefined();
  expect(client.isStale(['todos', 2], 10 ** 6)).toBe(true);
  expect(client.isStale(['users'], 10 ** 6)).toBe(false);
  const afterInvalidate = fn.mock.calls.length;
  await client.query(['todos', 2], fn, { staleTime: 10 ** 6 });
  expect(fn.mock.calls.length).toBe(afterInvalidate + 1);

  const listener = jest.fn();
  const off = client.subscribe(['live'], listener);
  client.setData(['live'], 1);
  expect(listener).toHaveBeenCalledTimes(1);
  off();
  client.setData(['live'], 2);
  expect(listener).toHaveBeenCalledTimes(1);
}
```
