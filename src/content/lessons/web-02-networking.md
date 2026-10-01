---
id: web-network
track: web
title: Networking & caching
summary: What the browser caches for free, how to ask "has this changed?" cheaply, why fetch doesn't fail on a 404, and how to build timeouts, retries and stale-while-revalidate yourself.
---

## The idea in one sentence

The fastest request is the one you **never send**, the next fastest is the one that gets a tiny **"nothing changed"** answer, and every request you do send must be ready to be **late, wrong, repeated or cancelled**.

> **Analogy** A librarian keeps a copy of the day's newspaper at the front desk. For the first hour she hands it out without checking anything (**fresh**). After that she phones the printer: "I have edition 42, is there a newer one?" — if not, a one-word answer ("unchanged!") saves carrying a new paper over (**conditional request**). And during a busy morning she'll hand you yesterday's paper *right now* while sending someone to fetch today's (**stale-while-revalidate**).

## Part 1 · The HTTP cache

The server controls caching with response headers. The most important one is **`Cache-Control`**:

| Directive | Meaning |
| --- | --- |
| `max-age=600` | The response is **fresh** for 600 seconds. During that time the browser reuses it with **no request at all**. |
| `no-cache` | Despite the name, it *can* be stored. It just must be **revalidated** with the server before every use. |
| `no-store` | Don't keep it at all (bank statements, personal data). |
| `private` / `public` | `private`: only the user's browser may keep it. `public`: shared caches (CDNs) may too. |
| `s-maxage=60` | Like `max-age`, but for shared caches (CDNs) only. |
| `immutable` | It will never change while fresh, so don't even revalidate on reload. |
| `stale-while-revalidate=30` | After it expires, you may serve the stale copy for 30 more seconds **while** refreshing it in the background. |

![The cache decision: fresh response is served with no network; stale ones are revalidated with a conditional request](fig:http-cache-flow "Fresh → no network. Stale → ask 'did it change?' → 304 keeps the body, 200 replaces it.")

### Validators: asking "did it change?"

When a response goes stale, the browser doesn't throw it away. If it carries a **validator**, the browser can ask cheaply:

- **`ETag: "v42"`** — a fingerprint of the content. The next request sends `If-None-Match: "v42"`.
- **`Last-Modified: …`** — a timestamp. The next request sends `If-Modified-Since: …`.

If nothing changed, the server answers **`304 Not Modified`** with **no body**, and the browser reuses what it has.

```stepper Revalidating a stale response
code:
  GET /prices.json
  If-None-Match: "v42"
  
  HTTP/1.1 304 Not Modified
  ETag: "v42"
  Cache-Control: max-age=60
---
line: 1
say: The browser has `/prices.json` in its cache, but it is **past its `max-age`**. It can't serve it blindly, and it doesn't want to download it again if it hasn't changed.
Cache entry: ETag "v42", age 75s (max-age 60s)
Decision: stale
---
line: 2
say: It repeats the request and adds **`If-None-Match: "v42"`** — "only send the body if your current version is different from this one."
Request: GET /prices.json + If-None-Match
---
line: 4-6
say: The server compares fingerprints. They match, so it answers **`304 Not Modified`** with **no body**: a few hundred bytes instead of the whole file. The fresh headers (a new `max-age`) come along.
Response: 304 (empty body)
---
line: 4-6
say: The browser **keeps the stored body**, resets the entry's age to 0 and serves it. If the server had answered `200` with a new body and `ETag: "v43"`, the entry would have been **replaced** instead.
Cache entry: ETag "v42", age 0s
Result: served from cache after a tiny round trip
```

### What to cache how

| Kind of file | Typical header | Why |
| --- | --- | --- |
| `app.4f9c2e.js` (filename contains a content hash) | `public, max-age=31536000, immutable` | A new build gets a **new name**, so the old one can be cached for a year. |
| `index.html` | `no-cache` | Must be revalidated each time so users pick up new hashed filenames. |
| API response for the logged-in user | `private, max-age=0, must-revalidate` or short `max-age` | Personal data, and it changes. |
| Rarely changing shared data (countries list) | `public, max-age=3600, stale-while-revalidate=86400` | Instant for users, quietly refreshed. |

Try the parsing yourself. `Cache-Control` is a comma-separated list of `name` or `name=value`:

```js try
function parseCacheControl(header) {
  const out = {};
  for (const part of header.split(',')) {
    const [name, value] = part.trim().toLowerCase().split('=');
    if (name) out[name] = value === undefined ? true : value;
  }
  return out;
}

console.log(parseCacheControl('public, max-age=600, immutable'));
console.log(parseCacheControl('no-cache, no-store'));
```

## Part 2 · `fetch` and its traps

```js try predict
// A tiny fake of fetch so this runs anywhere. Real fetch behaves the same way for HTTP errors.
const fakeFetch = async (url) => ({ ok: url !== '/missing', status: url === '/missing' ? 404 : 200, json: async () => ({ url }) });

async function load(url) {
  try {
    const response = await fakeFetch(url);
    return `got a response: status ${response.status}, ok=${response.ok}`;
  } catch (error) {
    return 'caught an error';
  }
}

load('/data').then(console.log);
load('/missing').then(console.log);
```

**`fetch` only rejects on a *network* failure** (offline, DNS, CORS blocked, aborted). A `404` or `500` is a **successful fetch** with `response.ok === false`. Always check `response.ok` (or `status`) and turn bad statuses into errors yourself. Other traps:

- `response.json()` can **throw** (bad JSON) and the body can be read **only once**.
- There is **no timeout by default**. A request can hang for minutes.
- To cancel, pass `{ signal }` from an **`AbortController`**; `controller.abort()` makes the promise reject with an `AbortError`. `AbortSignal.timeout(ms)` makes a signal that aborts by itself.
- Cookies aren't sent cross-origin unless you ask (`credentials: 'include'`) **and** the server allows it.

### Timeouts, retries and backoff

A robust wrapper decides, per failure, **should I try again?**

| Failure | Retry? |
| --- | --- |
| Network error, timeout | Yes: probably temporary |
| `502`, `503`, `504`, other `5xx` | Yes |
| `429 Too Many Requests` | Yes, after waiting (`Retry-After`) |
| `400`, `401`, `403`, `404`, `422` | **No**: the same request will fail the same way |
| The **caller** aborted | **No**, and stop immediately |

Wait **longer after each failure** (exponential backoff, with jitter so clients don't all return at once, which you met in the reconnect case study). And only retry requests that are safe to repeat: **GET** is, a payment **POST** is not unless it carries an **idempotency key**.

## Part 3 · CORS in a minute

Browsers block page scripts from reading responses from **another origin** (scheme + host + port) unless that server opts in. This is **CORS**, and the **browser** enforces it, not the server (curl ignores it).

![A page makes a preflight OPTIONS request; the server allows origin, method and headers; then the real request is sent](fig:cors-preflight "A 'simple' request (GET, plain headers) skips the preflight. A PUT or a custom header triggers it.")

- The server must send **`Access-Control-Allow-Origin`** (the exact origin, or `*` for public data without cookies).
- Anything beyond a "simple" request (methods like `PUT`/`DELETE`, `Content-Type: application/json`, custom headers like `Authorization`) first triggers a **preflight**: an `OPTIONS` request asking permission. `Access-Control-Max-Age` lets the browser remember the answer.
- With cookies: `credentials: 'include'` on the request **and** `Access-Control-Allow-Credentials: true` with a **specific** origin (not `*`).
- "CORS error" in the console almost always means the **server's headers**, not your JavaScript.

## Part 4 · Stale-while-revalidate in your own code

Libraries like SWR and React Query are built on one idea, and it is the same as the HTTP directive: **show what you have right now, and refresh in the background.**

![A timeline: fresh window, stale window, too old. In the stale window, return the old value instantly and refresh once in the background](fig:swr-timeline "Three zones: serve, serve + refresh, wait.")

Three rules make it work:

1. **Fresh** (age < `ttl`): return the cached value, no request.
2. **Stale but usable** (`ttl` ≤ age < `staleTtl`): return the cached value **immediately** and start **one** background refresh.
3. **Too old or missing:** wait for the network.

And two things that keep it correct:

- **Dedupe in-flight requests.** If ten components ask for the same key at once, share **one** request (store the promise).
- **A failed background refresh must not erase good data.** Keep the stale value.
- **Invalidation must beat slow requests.** If you invalidate a key while a request is running, that request's answer is **out of date** and must not be stored when it lands.

```js try
// Sharing one in-flight request per key
const inflight = new Map();
let calls = 0;
const fetcher = async (key) => { calls++; return `value of ${key}`; };

function load(key) {
  if (!inflight.has(key)) {
    inflight.set(key, fetcher(key).finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

Promise.all([load('a'), load('a'), load('a'), load('b')]).then((results) => {
  console.log(results, '· fetcher calls:', calls);
});
```

## Quick check

```check
Q: A response has `Cache-Control: no-cache`. What does the browser do?
A) Never stores it
B) Stores it, but revalidates with the server before each reuse *
C) Serves it for a year
D) Stores it only in memory
Why: `no-cache` means "revalidate before reuse". `no-store` is the one that forbids storing.
---
Q: A `fetch` to `/api/user` returns HTTP 404. What happens to the promise?
A) It rejects
B) It resolves with `response.ok === false` *
C) It retries automatically
D) It resolves with `null`
Why: `fetch` rejects only on network-level failures. HTTP error statuses resolve normally.
---
Q: Which failure should a retry wrapper NOT retry?
A) A network error
B) A timeout
C) `503 Service Unavailable`
D) `404 Not Found` *
Why: A 404 will give the same answer next time. Retries are for temporary failures.
---
Q: Why does a hashed filename like `app.4f9c2e.js` allow `max-age=31536000, immutable`?
A) Hashes are secret
B) Browsers prefer long names
C) A new build produces a new filename, so cached copies of the old name are never stale *
D) `immutable` disables CORS
Why: Content-addressed names change when the content changes, so the old URL never needs to be refreshed.
---
Q: A user opens a page whose cached data is past `ttl` but within `staleTtl`. What does stale-while-revalidate do?
A) Waits for the network, then shows the data
B) Shows an error
C) Shows the old data immediately and refreshes it once in the background *
D) Deletes the cache entry
Why: The user gets instant content, and the next view is fresh.
```

## Recap

- **Fresh = no request.** `max-age`, `immutable` for hashed assets, `no-cache` for HTML (revalidate), `no-store` for private data.
- **Validators** (`ETag`, `Last-Modified`) turn "download again" into **`304 Not Modified`**.
- **`fetch` doesn't reject on 404/500.** Check `response.ok`. Add timeouts and cancellation with `AbortController`.
- **Retry** network errors, timeouts, 5xx and 429 with **backoff + jitter**; never 4xx; stop at once if the caller aborts; beware non-idempotent POSTs.
- **CORS** is browser-enforced: `Allow-Origin`, preflight `OPTIONS`, credentials need a specific origin.
- **SWR**: serve stale, refresh once in the background, dedupe in-flight requests, don't let a failed refresh or a stale response corrupt the cache.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: read `max-age` | The `parseCacheControl` snippet |
| `fetchJson` with timeout and retries | The retry table, `AbortController`, and "caller abort stops everything" |
| Stale-while-revalidate cache | The three zones, in-flight sharing, and the invalidation rule |

%% exercise web-guided-maxage | Guided: read max-age | 1 | js | js | maxAgeOf | 8 | guided
Write `maxAgeOf(header)` that returns the `max-age` of a `Cache-Control` header **in seconds**, or `null` if there is none.

- The header is a comma-separated list: `"public, max-age=600, immutable"`.
- Directive names are **case-insensitive** (`MAX-AGE=5` counts).
- Only a plain `max-age` counts: **`s-maxage` does not**, and a value that isn't a whole number (`max-age=abc`) gives `null`.

```js
maxAgeOf('public, max-age=600');   // 600
maxAgeOf('no-store');              // null
maxAgeOf('s-maxage=30');           // null
```

%% worked
**A similar problem, solved: `getParam(query, name)`** — read one value from `"a=1&b=two"` without any library.

```js
function getParam(query, name) {
  for (const part of query.split('&')) {            // ① split into pieces
    const [key, value] = part.split('=');            // ② split each piece into name and value
    if (key === name) return value ?? null;          // ③ return the first match
  }
  return null;                                       // ④ nothing found
}
```

The same **split → split → compare** routine works for headers: split on `,`, trim the spaces, split each piece on `=`, compare the (lower-cased) name. Validate the value (digits only) before returning it.

%% explain
- **Found:** `max-age=600` anywhere in the list returns `600` as a number.
- **Case and spaces:** `Max-Age = 5` style spacing around commas is trimmed; names are case-insensitive.
- **Not counted:** `s-maxage`, a missing directive, or a non-numeric value all give `null`.

%% nudge
- After splitting on commas, what do you do to each piece before comparing it?
- How could you check that a value is only digits?

%% starter
```js
export function maxAgeOf(header) {
  // Step 1 — split the header on ','
  // Step 2 — for each piece: trim it, lower-case it, split it on '='
  // Step 3 — if the name is exactly 'max-age' and the value is only digits, return Number(value)
  return null;
}
```

%% tests
```js
describe('maxAgeOf', () => {
  it('reads max-age from a list', () => {
    expect(maxAgeOf('public, max-age=600, immutable')).toBe(600);
  });
  it('reads a lone max-age', () => {
    expect(maxAgeOf('max-age=0')).toBe(0);
  });
  it('is case-insensitive and tolerates spacing', () => {
    expect(maxAgeOf('Public ,MAX-AGE=5')).toBe(5);
  });
  it('returns null when there is none', () => {
    expect(maxAgeOf('no-store')).toBe(null);
    expect(maxAgeOf('')).toBe(null);
  });
  it('does not treat s-maxage as max-age', () => {
    expect(maxAgeOf('s-maxage=30')).toBe(null);
    expect(maxAgeOf('s-maxage=30, max-age=10')).toBe(10);
  });
  it('rejects values that are not whole numbers', () => {
    expect(maxAgeOf('max-age=abc')).toBe(null);
    expect(maxAgeOf('max-age=')).toBe(null);
    expect(maxAgeOf('max-age=1.5')).toBe(null);
  });
});
```

%% hints
- `for (const part of header.split(',')) { const [name, value] = part.trim().toLowerCase().split('='); ... }`
- `if (name === 'max-age' && /^\d+$/.test(value ?? '')) return Number(value);`

%% solution
```js
export function maxAgeOf(header) {
  for (const part of header.split(',')) {
    const [name, value] = part.trim().toLowerCase().split('=');
    if (name === 'max-age' && /^\d+$/.test(value ?? '')) return Number(value);
  }
  return null;
}
```

%% exercise web-fetch-json | fetchJson with timeout and retries | 3 | js | js | fetchJson | 40
Write `async fetchJson(url, options)`, a `fetch` wrapper you'd trust in production.

Options (all optional): `fetch` (the fetch function to use, default `globalThis.fetch`), `timeoutMs` (per attempt, default `5000`), `retries` (extra attempts after the first, default `2`), `backoff(n)` (milliseconds to wait before retry number `n`, where the first retry is `n = 0`; default `100 * 2 ** n`), `sleep(ms, signal)` (a function returning a promise; default is a `setTimeout`-based one), and `signal` (an `AbortSignal` from the caller).

- Call `fetch(url, { signal })` with a **per-attempt signal** that aborts on timeout **or** when the caller's `signal` aborts.
- If `response.ok`, return `await response.json()`. A JSON parse error is thrown as is (**not** retried).
- **Retry** on: network errors (fetch rejects), **timeouts**, status **5xx** and **429**. Before retry `n` call `await sleep(backoff(n), signal)`.
- **Don't retry** other statuses (e.g. 404): throw an `Error` with a `status` property at once.
- When retries run out, throw the **last** error (an HTTP error keeps its `status`).
- A **timeout** error has `name === 'TimeoutError'`.
- If the **caller's signal** aborts (before, during a request, or while waiting to retry), reject with an error whose `name` is `'AbortError'` and make **no further requests**. If it's already aborted, don't call `fetch` at all.

%% worked
**A similar problem, solved: `withTimeout(fn, ms)`** — run an abortable async function and give up after `ms`.

```js
async function withTimeout(fn, ms) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);   // ① abort when time is up…
  try {
    return await fn(controller.signal);                                            // ② …the function must listen to the signal
  } catch (error) {
    if (timedOut) throw Object.assign(new Error(`Timed out after ${ms}ms`), { name: 'TimeoutError' });   // ③ say WHY it failed
    throw error;
  } finally {
    clearTimeout(timer);                                                           // ④ always clean the timer up
  }
}
```

Three habits: **one controller per attempt**, a **flag** to tell a timeout from other failures, and **`finally`** to clear timers and remove listeners. For retries, wrap this in a `for` loop that only continues for *retryable* failures.

%% explain
- **Success:** returns the parsed JSON; `fetch` receives a signal.
- **Retried failures:** network errors, timeouts, 5xx and 429 retry up to `retries` times, waiting `backoff(n)` before each retry through `sleep`.
- **Not retried:** other 4xx errors throw immediately with `status`; JSON parse errors throw as is.
- **Giving up:** after the last attempt you get the last error; a timeout is named `TimeoutError`.
- **Caller abort:** an `AbortError` and no more requests, even while waiting to retry.

%% nudge
- Which two events should abort the per-attempt controller?
- If the caller's signal is aborted, how does that differ from a timeout in what you throw?

%% starter
```js
const defaultSleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

export async function fetchJson(url, options = {}) {
  const {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = 5000,
    retries = 2,
    backoff = (n) => 100 * 2 ** n,
    sleep = defaultSleep,
    signal,
  } = options;

  const aborted = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
  // Step 1 — if signal?.aborted, throw aborted()
  // Step 2 — loop attempt = 0..retries. Before a retry: await sleep(backoff(attempt - 1), signal), then check abort again.
  // Step 3 — per attempt: new AbortController, abort it on timeout (set a flag) or when the caller aborts.
  // Step 4 — await doFetch(url, { signal: controller.signal }). On failure: caller aborted? throw aborted().
  //          Otherwise remember lastError (a TimeoutError if the flag is set) and try again.
  // Step 5 — response.ok → return response.json(). 4xx (except 429) → throw an Error with .status. Others: remember and retry.
  // Always clear the timer and remove the abort listener in a finally block.
  throw new Error('not implemented');
}
```

%% tests
```js
function res(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

// Build a fake fetch from a script of steps: a status number, an Error, or 'hang' (never answers, but respects abort).
function scripted(steps) {
  const calls = [];
  const fn = (url, init) => {
    calls.push({ url, signal: init && init.signal });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)];
    if (step === 'hang') {
      return new Promise((resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    }
    if (step instanceof Error) return Promise.reject(step);
    if (typeof step === 'object') return Promise.resolve(step);
    return Promise.resolve(res(step, { n: calls.length }));
  };
  fn.calls = calls;
  return fn;
}

const instant = () => { const delays = []; const fn = async (ms) => { delays.push(ms); }; fn.delays = delays; return fn; };

async function catchError(promise) {
  try { await promise; } catch (e) { return e; }
  throw new Error('expected the promise to reject');
}

describe('fetchJson', () => {
  it('returns the parsed body and passes a signal', async () => {
    const f = scripted([200]);
    expect(await fetchJson('/a', { fetch: f })).toEqual({ n: 1 });
    expect(f.calls[0].url).toBe('/a');
    expect(typeof f.calls[0].signal.aborted).toBe('boolean');
  });

  it('retries 5xx, waiting backoff(n) before each retry', async () => {
    const f = scripted([503, 500, 200]);
    const sleep = instant();
    expect(await fetchJson('/a', { fetch: f, sleep })).toEqual({ n: 3 });
    expect(f.calls.length).toBe(3);
    expect(sleep.delays).toEqual([100, 200]);
  });

  it('uses a custom backoff', async () => {
    const f = scripted([500, 500, 200]);
    const sleep = instant();
    await fetchJson('/a', { fetch: f, sleep, backoff: (n) => (n + 1) * 1000 });
    expect(sleep.delays).toEqual([1000, 2000]);
  });

  it('retries network errors and 429', async () => {
    const f = scripted([new TypeError('Failed to fetch'), 429, 200]);
    expect(await fetchJson('/a', { fetch: f, sleep: instant() })).toEqual({ n: 3 });
  });

  it('does not retry a 404 and exposes the status', async () => {
    const f = scripted([404, 200]);
    const err = await catchError(fetchJson('/a', { fetch: f, sleep: instant() }));
    expect(err.status).toBe(404);
    expect(f.calls.length).toBe(1);
  });

  it('gives up after `retries` extra attempts and throws the last error', async () => {
    const f = scripted([503]);
    const err = await catchError(fetchJson('/a', { fetch: f, sleep: instant(), retries: 2 }));
    expect(f.calls.length).toBe(3);
    expect(err.status).toBe(503);
  });

  it('retries: 0 means a single attempt', async () => {
    const f = scripted([500]);
    await catchError(fetchJson('/a', { fetch: f, sleep: instant(), retries: 0 }));
    expect(f.calls.length).toBe(1);
  });

  it('does not retry invalid JSON', async () => {
    const bad = { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
    const f = scripted([bad]);
    const err = await catchError(fetchJson('/a', { fetch: f, sleep: instant() }));
    expect(err.name).toBe('SyntaxError');
    expect(f.calls.length).toBe(1);
  });

  it('times out a hanging request, aborting its signal, and then retries', async () => {
    jest.useFakeTimers();
    const f = scripted(['hang', 200]);
    const p = fetchJson('/a', { fetch: f, sleep: instant(), timeoutMs: 1000 });
    await jest.advanceTimersByTimeAsync(1000);
    expect(f.calls[0].signal.aborted).toBe(true);
    expect(await p).toEqual({ n: 2 });
    jest.useRealTimers();
  });

  it('throws a TimeoutError when every attempt times out', async () => {
    jest.useFakeTimers();
    const f = scripted(['hang']);
    const p = catchError(fetchJson('/a', { fetch: f, sleep: instant(), timeoutMs: 500, retries: 1 }));
    await jest.advanceTimersByTimeAsync(500);
    await jest.advanceTimersByTimeAsync(500);
    const err = await p;
    expect(err.name).toBe('TimeoutError');
    expect(f.calls.length).toBe(2);
    jest.useRealTimers();
  });

  it('clears its timers after a successful request', async () => {
    jest.useFakeTimers();
    const f = scripted([200]);
    await fetchJson('/a', { fetch: f, sleep: instant(), timeoutMs: 1000 });
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });

  it('rejects with AbortError and never calls fetch when the signal is already aborted', async () => {
    const f = scripted([200]);
    const controller = new AbortController();
    controller.abort();
    const err = await catchError(fetchJson('/a', { fetch: f, signal: controller.signal }));
    expect(err.name).toBe('AbortError');
    expect(f.calls.length).toBe(0);
  });

  it('aborts mid-request without retrying', async () => {
    const f = scripted(['hang']);
    const controller = new AbortController();
    const p = catchError(fetchJson('/a', { fetch: f, sleep: instant(), signal: controller.signal, timeoutMs: 60000 }));
    await Promise.resolve();
    controller.abort();
    const err = await p;
    expect(err.name).toBe('AbortError');
    expect(f.calls.length).toBe(1);
  });

  it('stops while waiting to retry when the caller aborts', async () => {
    const f = scripted([500, 200]);
    const controller = new AbortController();
    const sleep = async () => { controller.abort(); };
    const err = await catchError(fetchJson('/a', { fetch: f, sleep, signal: controller.signal }));
    expect(err.name).toBe('AbortError');
    expect(f.calls.length).toBe(1);
  });
});
```

%% hints
- Inside the loop, create `const controller = new AbortController(); let timedOut = false;` and `const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);`
- Forward the caller's abort: `const onAbort = () => controller.abort(); signal?.addEventListener('abort', onAbort);` and remove it in `finally`.
- After a failed `await doFetch(...)`: `if (signal?.aborted) throw aborted(); lastError = timedOut ? Object.assign(new Error('Timed out'), { name: 'TimeoutError' }) : error; continue;`
- Retry check: `response.status === 429 || response.status >= 500`.

%% solution
```js
const defaultSleep = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

export async function fetchJson(url, options = {}) {
  const {
    fetch: doFetch = globalThis.fetch,
    timeoutMs = 5000,
    retries = 2,
    backoff = (n) => 100 * 2 ** n,
    sleep = defaultSleep,
    signal,
  } = options;

  const aborted = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
  if (signal?.aborted) throw aborted();

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(backoff(attempt - 1), signal);
      if (signal?.aborted) throw aborted();
    }

    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

    let response;
    try {
      response = await doFetch(url, { signal: controller.signal });
    } catch (error) {
      if (signal?.aborted) throw aborted();
      lastError = timedOut
        ? Object.assign(new Error(`Timed out after ${timeoutMs}ms`), { name: 'TimeoutError' })
        : error;
      continue;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }

    if (response.ok) return response.json();
    const error = Object.assign(new Error(`HTTP ${response.status}`), { status: response.status });
    if (response.status !== 429 && response.status < 500) throw error;
    lastError = error;
  }
  throw lastError;
}
```

%% exercise web-swr-cache | Stale-while-revalidate cache | 4 | js | js | createSwrCache | 45
Build `createSwrCache({ fetcher, ttl, staleTtl, now = () => Date.now() })`, a cache that returns data instantly when it can and keeps it fresh in the background.

`fetcher(key)` returns a promise of the value. Times are in milliseconds, measured with `now()`. Returns `{ get, peek, subscribe, invalidate }`.

- **`get(key)`** returns a promise:
  - no entry → call `fetcher` and wait. Store the result with the time it arrived.
  - **fresh** (`age < ttl`) → resolve with the cached value, no fetch.
  - **stale but usable** (`ttl <= age < staleTtl`) → resolve **immediately** with the cached value, and start a **background refresh** (only one at a time).
  - **too old** (`age >= staleTtl`) → fetch and wait.
- **Share in-flight requests:** concurrent requests for the same key use **one** `fetcher` call.
- A **failed foreground fetch** rejects and caches nothing (the next `get` tries again). A **failed background refresh** is silent and keeps the stale value.
- **`peek(key)`** returns `{ value, stale }` (`stale` is `age >= ttl`) or `undefined` without fetching.
- **`subscribe(key, listener)`** calls `listener(value)` whenever a fetch for that key **stores** a new value (including background refreshes). Returns an unsubscribe function.
- **`invalidate(key)`** removes the entry. A fetch that **started before** the invalidation must **not** store its result, and the next `get` starts a fresh request.

%% worked
**A similar problem, solved: `createOnce(fn)`** — call an async function once, share the same promise with everyone, and let it be retried if it failed.

```js
function createOnce(fn) {
  let promise = null;
  return function get() {
    if (!promise) {
      promise = fn().catch((error) => {   // ① remember the promise itself, so callers share it
        promise = null;                   // ② on failure, forget it so the next call can try again
        throw error;
      });
    }
    return promise;
  };
}
```

Two techniques carry over: **store the promise, not the result** (so a second caller during the request joins the first), and **clear the stored promise in a `finally`/`catch`**, because otherwise one failure would be cached forever. A cache adds a **key** (a `Map`) and a **generation number** so an old request can tell that it has been invalidated.

%% explain
- **Fresh:** no `fetcher` call; the value is returned.
- **Stale:** returns the old value at once and triggers exactly one refresh, even for repeated `get`s during it.
- **Missing or too old:** waits for `fetcher`; concurrent callers share one call.
- **Failures:** foreground failures reject and are not cached; background failures leave the stale value alone.
- **Subscribers:** are told about every stored value, not about failures.
- **Invalidation:** drops the entry, and a request that began earlier cannot store its (outdated) answer.

%% nudge
- What do you store in a `Map` to let two callers share one request?
- How can a request that started *before* `invalidate` know it should not store its result?

%% starter
```js
export function createSwrCache({ fetcher, ttl, staleTtl, now = () => Date.now() }) {
  const entries = new Map();    // key → { value, at }
  const inflight = new Map();   // key → promise
  const listeners = new Map();  // key → Set of listener functions
  const generations = new Map(); // key → number, bumped by invalidate

  function load(key) {
    // Step 1 — if there's an in-flight promise for this key, return it.
    // Step 2 — otherwise remember the current generation, call fetcher(key), and when it resolves:
    //          store { value, at: now() } and notify listeners — but only if the generation is unchanged.
    // Step 3 — remove the in-flight promise when it settles (success OR failure), without removing a newer one.
    return fetcher(key);
  }

  return {
    get(key) {
      // fresh → value · stale → value + background refresh (swallow its errors) · otherwise → load(key)
      return load(key);
    },
    peek(key) { return undefined; },
    subscribe(key, listener) { return () => {}; },
    invalidate(key) {},
  };
}
```

%% tests
```js
function setup(over = {}) {
  let t = 0;
  const calls = [];
  const pending = [];
  const fetcher = jest.fn((key) => new Promise((resolve, reject) => {
    const call = { key, resolve, reject };
    calls.push(call);
    pending.push(call);
  }));
  const cache = createSwrCache({ fetcher, ttl: 1000, staleTtl: 5000, now: () => t, ...over });
  const advance = (ms) => { t += ms; };
  const settle = async (value, i = 0) => { pending.splice(i, 1)[0].resolve(value); await flushPromises(); };
  return { cache, fetcher, advance, settle, calls, pending };
}

async function primed(key = 'a', value = 'v1') {
  const s = setup();
  const p = s.cache.get(key);
  await s.settle(value);
  await p;
  return s;
}

describe('createSwrCache', () => {
  it('fetches a missing key and resolves with the value', async () => {
    const { cache, settle, fetcher } = setup();
    const p = cache.get('a');
    expect(fetcher).toHaveBeenCalledWith('a');
    await settle('v1');
    expect(await p).toBe('v1');
  });

  it('serves a fresh entry without fetching', async () => {
    const s = await primed();
    s.advance(999);
    expect(await s.cache.get('a')).toBe('v1');
    expect(s.fetcher).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight request between concurrent callers', async () => {
    const { cache, settle, fetcher } = setup();
    const ps = [cache.get('a'), cache.get('a'), cache.get('a')];
    expect(fetcher).toHaveBeenCalledTimes(1);
    await settle('v1');
    expect(await Promise.all(ps)).toEqual(['v1', 'v1', 'v1']);
  });

  it('keeps keys independent', async () => {
    const { cache, fetcher } = setup();
    cache.get('a'); cache.get('b');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('returns a stale value immediately and refreshes once in the background', async () => {
    const s = await primed();
    s.advance(2000);
    const seen = [];
    s.cache.subscribe('a', (v) => seen.push(v));
    expect(await s.cache.get('a')).toBe('v1');
    expect(await s.cache.get('a')).toBe('v1');
    expect(s.fetcher).toHaveBeenCalledTimes(2);
    expect(s.pending.length).toBe(1);
    await s.settle('v2');
    expect(seen).toEqual(['v2']);
    expect(await s.cache.get('a')).toBe('v2');
    expect(s.fetcher).toHaveBeenCalledTimes(2);
  });

  it('waits for the network when the entry is too old', async () => {
    const s = await primed();
    s.advance(5000);
    let value;
    const p = s.cache.get('a').then((v) => { value = v; });
    await flushPromises();
    expect(value).toBe(undefined);
    await s.settle('v2');
    await p;
    expect(value).toBe('v2');
  });

  it('rejects a failed foreground fetch and does not cache the failure', async () => {
    const { cache, pending, fetcher, settle } = setup();
    const p = cache.get('a');
    const assertion = p.then(() => 'resolved', (e) => e.message);
    pending[0].reject(new Error('down'));
    expect(await assertion).toBe('down');
    pending.length = 0;
    const again = cache.get('a');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await settle('v1');
    expect(await again).toBe('v1');
  });

  it('keeps the stale value when a background refresh fails', async () => {
    const s = await primed();
    s.advance(2000);
    expect(await s.cache.get('a')).toBe('v1');
    s.pending[0].reject(new Error('down'));
    await flushPromises();
    expect(s.cache.peek('a')).toEqual({ value: 'v1', stale: true });
    expect(await s.cache.get('a')).toBe('v1');
    expect(s.fetcher).toHaveBeenCalledTimes(3);
  });

  it('peek reports value and staleness without fetching', async () => {
    const s = await primed();
    expect(s.cache.peek('a')).toEqual({ value: 'v1', stale: false });
    s.advance(1000);
    expect(s.cache.peek('a')).toEqual({ value: 'v1', stale: true });
    expect(s.cache.peek('zzz')).toBe(undefined);
    expect(s.fetcher).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', async () => {
    const s = await primed();
    const fn = jest.fn();
    const off = s.cache.subscribe('a', fn);
    off();
    s.advance(2000);
    await s.cache.get('a');
    await s.settle('v2');
    expect(fn).not.toHaveBeenCalled();
  });

  it('invalidate removes the entry so the next get fetches', async () => {
    const s = await primed();
    s.cache.invalidate('a');
    expect(s.cache.peek('a')).toBe(undefined);
    const p = s.cache.get('a');
    expect(s.fetcher).toHaveBeenCalledTimes(2);
    await s.settle('v2');
    expect(await p).toBe('v2');
  });

  it('does not store a result from a request that began before invalidate', async () => {
    const { cache, settle, fetcher, pending } = setup();
    const old = cache.get('a');
    cache.invalidate('a');
    const fresh = cache.get('a');
    expect(fetcher).toHaveBeenCalledTimes(2);
    await settle('old-answer', 0);
    expect(cache.peek('a')).toBe(undefined);
    await settle('new-answer', 0);
    expect(await fresh).toBe('new-answer');
    expect(cache.peek('a').value).toBe('new-answer');
    await old;
  });
});
```

%% hints
- `const existing = inflight.get(key); if (existing) return existing;`
- `const started = generations.get(key) ?? 0; const promise = (async () => fetcher(key))().then((value) => { if ((generations.get(key) ?? 0) === started) { entries.set(key, { value, at: now() }); listeners.get(key)?.forEach((l) => l(value)); } return value; }).finally(() => { if (inflight.get(key) === promise) inflight.delete(key); });`
- `get`: `const entry = entries.get(key); if (entry) { const age = now() - entry.at; if (age < ttl) return Promise.resolve(entry.value); if (age < staleTtl) { load(key).catch(() => {}); return Promise.resolve(entry.value); } } return load(key);`
- `invalidate`: delete the entry, bump the generation, and delete the in-flight promise so a new `get` starts fresh.

%% solution
```js
export function createSwrCache({ fetcher, ttl, staleTtl, now = () => Date.now() }) {
  const entries = new Map();
  const inflight = new Map();
  const listeners = new Map();
  const generations = new Map();
  const generation = (key) => generations.get(key) ?? 0;

  function load(key) {
    const existing = inflight.get(key);
    if (existing) return existing;
    const started = generation(key);
    const promise = (async () => fetcher(key))()
      .then((value) => {
        if (generation(key) === started) {
          entries.set(key, { value, at: now() });
          listeners.get(key)?.forEach((listener) => listener(value));
        }
        return value;
      })
      .finally(() => {
        if (inflight.get(key) === promise) inflight.delete(key);
      });
    inflight.set(key, promise);
    return promise;
  }

  return {
    get(key) {
      const entry = entries.get(key);
      if (entry) {
        const age = now() - entry.at;
        if (age < ttl) return Promise.resolve(entry.value);
        if (age < staleTtl) {
          load(key).catch(() => {});
          return Promise.resolve(entry.value);
        }
      }
      return load(key);
    },
    peek(key) {
      const entry = entries.get(key);
      return entry ? { value: entry.value, stale: now() - entry.at >= ttl } : undefined;
    },
    subscribe(key, listener) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(listener);
      return () => listeners.get(key)?.delete(listener);
    },
    invalidate(key) {
      entries.delete(key);
      generations.set(key, generation(key) + 1);
      inflight.delete(key);
    },
  };
}
```
