---
id: prod-multi-tab
track: prod
title: Case study: five tabs, one customer
summary: A bet slip diverges between tabs and five open tabs mean five sockets. Sync state across tabs with last-writer-wins, elect a leader, and share one connection.
---

> **INCIDENT — two problems with one root cause.**
>
> **(1)** A customer places a bet in tab A. Tab B still shows the old balance and the same slip, so they place it again. Support: "double bet".
>
> **(2)** Power users keep 4–6 tabs open. Each tab opens its own WebSocket → the server sees 6× the connections and rate-limits them; feeds start dropping *for everyone on that account*.

## The idea in one sentence

Browser tabs are **separate little computers that can only send each other messages** — so treat them like a **tiny distributed system**: agree on who's in charge, and agree on how to settle disagreements.

> **Analogy** Five colleagues in separate rooms with one shared walkie-talkie channel. They can't see each other's desks. To avoid five people phoning the same supplier, they agree: **the one with the lowest badge number still in the building makes the call** and shouts the news on the walkie-talkie (leader + relay). And when two of them edit the same note at the same time, they agree the **latest timestamp wins** (ties broken by badge number), so everyone ends up with the same note.

Tabs of one origin are separate JavaScript worlds. They share **storage** and can **message** each other — nothing else. There's no shared memory, timing is unreliable, and any tab can vanish without warning.

![Four tabs with four sockets versus one leader tab with one socket relaying to the rest](fig:tab-topology "One connection per user, not per tab.")

## Ways for tabs to talk

| Mechanism | Notes |
| --- | --- |
| **`BroadcastChannel(name)`** | The best default. Messages go to *other* contexts of the same origin, asynchronously. Structured-clone payloads. **Not delivered to the sender.** |
| **`storage` event** | Fires in *other* tabs when `localStorage` changes. Works everywhere, string-only, quirky. A good fallback. |
| **`SharedWorker`** | One worker shared by all tabs — a natural home for a single socket or shared state. Historically less supported (not in some mobile browsers). |
| **Service Worker** | A network proxy that can `postMessage` to clients. A different job. |
| **Web Locks API** (`navigator.locks`) | Mutual exclusion across tabs — the modern way to elect a leader. |

## Sharing state: last-writer-wins

For UI state (theme, slip contents, filters), a **last-writer-wins (LWW) register per key** is often enough:

- Tag each write with a **version** `(timestamp, tabId)`. The **greater** version wins; the tab id breaks ties so **every tab converges on the same answer**.
- Use a **logical clock** — `ts = max(now, highestSeen + 1)` — so a tab with a slow clock can still overwrite what it just read.
- **Deletes need tombstones**: remember "deleted at version *v*", or an old delayed `set` will bring the key back from the dead.
- A **new tab** must catch up: broadcast `hello`; others reply with their whole state; merge with the same rule.

![Two tabs write the same key at once; the higher version wins everywhere; deletes leave tombstones](fig:lww-versions "No coordinator needed: all tabs apply the same rule, so they converge.")

```js try
const compare = (a, b) => a.ts - b.ts || (a.tabId < b.tabId ? -1 : a.tabId > b.tabId ? 1 : 0);

function createStore() {
  const entries = new Map();                               // key → { value, version, deleted }
  return {
    apply(key, value, version, deleted = false) {
      const old = entries.get(key);
      if (old && compare(old.version, version) >= 0) return false;   // not newer → ignore (duplicates, late writes)
      entries.set(key, { value, version, deleted });                 // tombstones are stored too
      return true;
    },
    get: (key) => { const e = entries.get(key); return e && !e.deleted ? e.value : undefined; },
  };
}

// Tab A and tab B each see the two writes in a DIFFERENT order, yet end up equal:
const one = createStore(), two = createStore();
const write1 = ['theme', 'dark', { ts: 100, tabId: 'a' }];
const write2 = ['theme', 'light', { ts: 100, tabId: 'b' }];
one.apply(...write1); one.apply(...write2);
two.apply(...write2); two.apply(...write1);
console.log(one.get('theme'), two.get('theme'));

// A delete is a tombstone, so a late, older write can't resurrect the key:
one.apply('theme', undefined, { ts: 101, tabId: 'a' }, true);
one.apply(...write2);
console.log('after delete + late write:', one.get('theme'));
```

Watch the rule decide, step by step:

```stepper Last-writer-wins, four arrivals
code:
  apply(change) {
    const old = entries.get(change.key);
    if (old && compare(old.version, change.version) >= 0) return;   // not newer → ignore
    entries.set(change.key, change);
  }
---
line: 1-4
say: Tab A writes `theme = "dark"` with version **(100, a)**. Nothing stored yet, so it is applied.
Incoming: theme = dark  v(100, a)
Stored: dark  v(100, a)
Result: applied
---
line: 2-3
say: Tab B wrote at almost the same time: `theme = "light"`, version **(100, b)**. The timestamps tie, so the **tab id** decides: `"b" > "a"`. The new version is greater, so it **replaces** the old one.
Incoming: theme = light  v(100, b)
Stored: light  v(100, b)
Result: applied (b beats a)
---
line: 3
say: A late, duplicate copy of A's write arrives. Its version (100, a) is **not greater** than the stored (100, b), so it's ignored. Every tab makes the same decision, so they all agree.
Incoming: theme = dark  v(100, a)  (late)
Stored: light  v(100, b)
Result: ignored
---
line: 4
say: Tab A **deletes** the key at version (101, a). That's a newer version, so the **tombstone** is stored. It remembers "deleted at 101", so an old write like (100, b) arriving later can never resurrect the key.
Incoming: delete theme  v(101, a)
Stored: (tombstone)  v(101, a)
Result: applied — key is deleted
```

> **Money is different.** LWW is fine for *showing* a slip; it is **not** how you decide whether a bet was placed. The **server** is the source of truth (and idempotency keys stop double placement). Tabs should *display* and *hint*, never adjudicate.

## One connection for all tabs

Elect a **leader** tab. Only the leader opens the socket and **relays** messages to the others through the channel. If the leader closes, another tab takes over and reconnects.

**Heartbeat election** (portable): every tab broadcasts a heartbeat; each tab remembers `lastSeen` for its peers. The leader is the **alive tab with the lowest id**. Send a `bye` on `pagehide`/close for instant handover, and rely on the **timeout** when a tab crashes.

![Three tabs, leader is the lowest alive id; when it closes the next lowest takes over](fig:heartbeat-election "No coordinator: every tab runs the same rule on the same information.")

```js try
function pickLeader(myId, lastSeen, now, timeoutMs) {
  const alive = Object.keys(lastSeen).filter((id) => now - lastSeen[id] < timeoutMs);
  return [myId, ...alive].sort()[0];                      // lowest id among the alive tabs (and me)
}

const lastSeen = { a: 1000, c: 1000 };
console.log('leader at t=1500:', pickLeader('b', lastSeen, 1500, 3500));   // a is alive and lowest
console.log('leader at t=5000:', pickLeader('b', { a: 1000, c: 4800 }, 5000, 3500)); // a timed out → b is the lowest alive
```

**Web Locks** is simpler and more robust where available:

```js
navigator.locks.request('feed-leader', async () => {
  openSocket();                       // I'm the leader as long as this promise is pending
  await new Promise(() => {});        // hold the lock until the tab goes away
});
```

The browser releases the lock automatically when the holding tab closes or crashes, and grants it to the next waiter.

## Background-tab gotchas

- Hidden tabs get **throttled timers** (≥ 1 s), and after ~5 minutes Chrome applies **intensive throttling** (about once a minute). A heartbeat every second can look dead. Use timeouts well above the throttled interval — or Web Locks, which don't depend on timers.
- Tabs can be **frozen** or **discarded** to save memory, and the back/forward cache can restore a page with stale state. Re-sync on `visibilitychange` / `pageshow`.

## Testing

`createFakeChannelHub()` gives you `BroadcastChannel`-like objects that deliver to *other* channels of the same name, asynchronously (`await flushPromises()` to let messages arrive). Combine it with fake timers for heartbeats.

## Quick check

```check
Q: Why is the tab id included in an LWW version?
A) To identify the user
B) To encrypt the data
C) To compress the message
D) To break timestamp ties so all tabs pick the same winner *
Why: If two writes share a timestamp, every tab must still choose identically. A deterministic tie-break (the tab id) guarantees convergence.
---
Q: Why do deletes need tombstones?
A) So a delayed older `set` can't resurrect the deleted key *
B) To save memory
C) Because `Map` can't delete
D) To notify the server
Why: Without a recorded delete-version, an old write arriving late would look "new" to a tab that had forgotten the key.
---
Q: Who adjudicates whether a bet was placed?
A) The leader tab
B) The newest tab
C) The server, which is the source of truth *
D) `localStorage`
Why: Tabs display and hint. Money decisions belong to the server, protected by idempotency keys.
---
Q: A leader tab crashes without saying goodbye. How do the others notice?
A) They can't
B) Its heartbeats stop and time out *
C) The server tells them
D) The channel closes
Why: Crashes send no `bye`, so peers rely on a heartbeat timeout (or Web Locks, which the browser releases automatically).
---
Q: Why is a 1-second heartbeat risky in background tabs?
A) Browsers throttle timers in hidden tabs, so it can look dead *
B) Heartbeats are slow
C) Channels don't work in the background
D) It costs money
Why: Hidden tabs have timers limited to 1 s or much less often. Set the timeout well above the throttled interval.
```

## Recap

- Tabs are a **tiny distributed system**: no shared memory, unreliable timing, any node can vanish.
- **`BroadcastChannel`** is the default messenger; **Web Locks** are the modern leader-election tool.
- **LWW** with `(timestamp, tabId)` versions, a **logical clock**, **tombstones** and a **hello/state** catch-up converges without a coordinator.
- **One socket per user**: leader opens it and relays; elect by heartbeat (lowest alive id) or Web Locks.
- **Money stays on the server**; beware throttled timers in background tabs.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: pick the leader | The `pickLeader` snippet |
| Cross-tab key-value sync | The LWW snippet and stepper: version compare, tombstones, hello/state catch-up |
| Heartbeat leader election | The election figure, heartbeat/timeout logic, `bye`, `onChange` only on changes |
| One socket for all tabs | The leader/follower split: open on gain, close on loss, relay and deliver |

%% exercise prod-guided-leader | Guided: pick the leader | 1 | js | js | pickLeader | 6 | guided
Write `pickLeader(myId, lastSeen, now, timeoutMs)`.

- `lastSeen` is an object mapping **other** tab ids to the time (ms) their last heartbeat arrived, e.g. `{ a: 1000, c: 1200 }`.
- A peer is **alive** while `now - lastSeen[id] < timeoutMs`.
- Return the **lowest id** (plain string order) among the alive peers **and yourself** (`myId` is always alive).

```js
pickLeader('b', { a: 1000, c: 1000 }, 1500, 3500); // 'a'   (a is alive and lowest)
pickLeader('b', { a: 1000, c: 4800 }, 5000, 3500); // 'b'   (a timed out → b is the lowest alive)
```

%% worked
**A similar problem, solved: `oldestAlive(nowMs, sessions, maxAgeMs)`** — the session that started earliest among those still active.

```js
function oldestAlive(nowMs, sessions, maxAgeMs) {
  // sessions: { id: lastActiveAt, ... }
  const alive = Object.keys(sessions).filter((id) => nowMs - sessions[id] < maxAgeMs);   // ① filter by "recently seen"
  return alive.sort()[0];                                                                  // ② sort (strings sort alphabetically) and take the first
}
```

Two habits: decide **alive** with a single rule (`now - lastSeen < timeout`), and get "the lowest id" by **sorting** strings and taking index `0`. For the leader, add yourself to the candidates before sorting: `[myId, ...alive].sort()[0]`. Sorting is deterministic, so every tab running the same function on the same information elects the **same** leader — no coordinator needed.

%% explain
- **Alive** means heard within `timeoutMs` (`now - lastSeen < timeoutMs`); exactly at the timeout counts as dead.
- **Yourself** is always a candidate.
- **The lowest id** (string order) among the candidates wins.
- **With no alive peers**, you are the leader.

%% nudge
- How do you build the list of candidates: alive peers plus what else?
- Which array method sorts strings alphabetically?

%% starter
```js
export function pickLeader(myId, lastSeen, now, timeoutMs) {
  // Step 1 — find the alive peers:   Object.keys(lastSeen).filter((id) => now - lastSeen[id] < timeoutMs)
  // Step 2 — add yourself:           [myId, ...alive]
  // Step 3 — sort and take the first (the lowest id).
  return myId;
}
```

%% tests
```js
describe('pickLeader', () => {
  it('picks the lowest alive id', () => {
    expect(pickLeader('b', { a: 1000, c: 1000 }, 1500, 3500)).toBe('a');
  });

  it('ignores peers that timed out', () => {
    expect(pickLeader('b', { a: 1000, c: 4800 }, 5000, 3500)).toBe('b');
  });

  it('counts exactly-timed-out peers as dead', () => {
    expect(pickLeader('b', { a: 0 }, 3500, 3500)).toBe('b');
  });

  it('is the leader when alone', () => {
    expect(pickLeader('z', {}, 100, 3500)).toBe('z');
  });

  it('considers yourself even if you have the lowest id', () => {
    expect(pickLeader('a', { b: 100 }, 200, 3500)).toBe('a');
  });
});
```

%% hints
- `const alive = Object.keys(lastSeen).filter((id) => now - lastSeen[id] < timeoutMs);`
- `return [myId, ...alive].sort()[0];`

%% solution
```js
export function pickLeader(myId, lastSeen, now, timeoutMs) {
  const alive = Object.keys(lastSeen).filter((id) => now - lastSeen[id] < timeoutMs);
  return [myId, ...alive].sort()[0];
}
```

%% exercise prod-tab-sync | Cross-tab key-value sync | 3 | js | js | createTabSync | 35
Build `createTabSync({ channel, tabId, now = () => Date.now() })`: a small key-value store that stays consistent across tabs.

Returns `{ get(key), set(key, value), delete(key), getAll(), subscribe(listener), close() }`.

- `set`/`delete` update locally and **broadcast** the change. Every entry carries a **version** `{ ts, tabId }`.
- **Last writer wins:** a change is applied only if its version is greater than the stored one (`ts` first, then `tabId` string comparison as the tie-break). Every tab must end with the same value regardless of delivery order.
- Use a logical clock: a write's `ts` is `max(now(), highestTsSeen + 1)`, so a local write always beats what this tab has already seen.
- **Deletes are tombstones** (kept with their version), so a delayed older `set` can't resurrect the key. `get` of a deleted key is `undefined`; `getAll()` excludes deleted keys.
- `subscribe(listener)` → unsubscribe fn. Listeners get `(key, value, { remote })` for every applied change (`value` is `undefined` after a delete).
- **Catch-up:** on creation broadcast `{ type: 'hello', from: tabId }`. When a tab receives a `hello` from another tab it broadcasts its full state `{ type: 'state', from, entries }`. Receiving `state` merges every entry with the same LWW rule.
- Messages from your own `tabId` are ignored. `close()` closes the channel and stops handling messages.

Channel API: `channel.postMessage(data)`, `channel.addEventListener('message', fn)` (event has `.data`), `channel.removeEventListener`, `channel.close()`.

%% starter
```js
export function createTabSync({ channel, tabId, now = () => Date.now() }) {
  // your code
}
```

%% tests
```js
function tabs(names, options = {}) {
  const hub = createFakeChannelHub();
  const clock = { t: 1000 };
  const out = {};
  for (const name of names) out[name] = createTabSync({ channel: hub.channel('slip'), tabId: name, now: () => clock.t, ...options });
  return { ...out, clock, hub };
}
const settle = () => flushPromises();

describe('createTabSync', () => {
  it('stores values locally', () => {
    const { a } = tabs(['a']);
    a.set('theme', 'dark');
    expect(a.get('theme')).toBe('dark');
    expect(a.getAll()).toEqual({ theme: 'dark' });
    expect(a.get('nope')).toBeUndefined();
  });

  it('propagates writes to other tabs', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    a.set('stake', 1000);
    await settle();
    expect(b.get('stake')).toBe(1000);
  });

  it('does not echo a tab’s own messages back into itself', async () => {
    const { a } = tabs(['a', 'b']);
    const listener = jest.fn();
    a.subscribe(listener);
    a.set('k', 1);
    await settle();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('k', 1, { remote: false });
  });

  it('notifies subscribers of remote changes', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    const listener = jest.fn();
    b.subscribe(listener);
    a.set('k', 'v');
    await settle();
    expect(listener).toHaveBeenCalledWith('k', 'v', { remote: true });
  });

  it('unsubscribe stops notifications', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    const listener = jest.fn();
    const off = b.subscribe(listener);
    off();
    a.set('k', 1);
    await settle();
    expect(listener).not.toHaveBeenCalled();
  });

  it('last writer wins, by timestamp', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 1000; a.set('k', 'from a');
    clock.t = 2000; b.set('k', 'from b');
    await settle();
    expect(a.get('k')).toBe('from b');
    expect(b.get('k')).toBe('from b');
  });

  it('breaks timestamp ties with the tab id so all tabs converge', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 5000;
    a.set('k', 'A'); b.set('k', 'B'); // truly concurrent
    await settle();
    expect(a.get('k')).toBe(b.get('k'));
    expect(a.get('k')).toBe('B');
  });

  it('a local write always beats what the tab has already seen, even with a slow clock', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 9000; a.set('k', 'from a');
    await settle();
    clock.t = 1000; // b's clock is far behind
    b.set('k', 'from b');
    await settle();
    expect(a.get('k')).toBe('from b');
    expect(b.get('k')).toBe('from b');
  });

  it('propagates deletes and keeps tombstones so old sets cannot resurrect a key', async () => {
    const { a, b, clock } = tabs(['a', 'b']);
    await settle();
    clock.t = 1000; a.set('k', 1);
    await settle();
    clock.t = 2000; a.delete('k');
    await settle();
    expect(b.get('k')).toBeUndefined();
    expect(b.getAll()).toEqual({});
    const late = jest.fn();
    b.subscribe(late);
    // a late, older write arriving at b is ignored
    const hub2 = tabs(['x']); // separate hub, just to prove no cross-talk
    expect(hub2.x.getAll()).toEqual({});
    expect(late).not.toHaveBeenCalled();
  });

  it('a delete notifies subscribers with an undefined value', async () => {
    const { a, b } = tabs(['a', 'b']);
    await settle();
    a.set('k', 1);
    await settle();
    const listener = jest.fn();
    b.subscribe(listener);
    a.delete('k');
    await settle();
    expect(listener).toHaveBeenCalledWith('k', undefined, { remote: true });
  });

  it('a newly opened tab catches up with existing state', async () => {
    const hub = createFakeChannelHub();
    const clock = { t: 1000 };
    const a = createTabSync({ channel: hub.channel('slip'), tabId: 'a', now: () => clock.t });
    a.set('one', 1); a.set('two', 2);
    a.delete('two');
    await settle();
    const late = createTabSync({ channel: hub.channel('slip'), tabId: 'late', now: () => clock.t });
    await settle();
    await settle();
    expect(late.getAll()).toEqual({ one: 1 });
  });

  it('merging state does not overwrite newer local entries', async () => {
    const hub = createFakeChannelHub();
    const clock = { t: 1000 };
    const a = createTabSync({ channel: hub.channel('slip'), tabId: 'a', now: () => clock.t });
    a.set('k', 'old');
    clock.t = 5000;
    const b = createTabSync({ channel: hub.channel('slip'), tabId: 'b', now: () => clock.t });
    b.set('k', 'newer');
    await settle(); await settle();
    expect(a.get('k')).toBe('newer');
    expect(b.get('k')).toBe('newer');
  });

  it('three tabs converge', async () => {
    const { a, b, c, clock } = tabs(['a', 'b', 'c']);
    await settle();
    clock.t = 100; a.set('x', 'a1');
    clock.t = 200; b.set('x', 'b1'); c.set('y', 'c1');
    clock.t = 300; c.delete('x');
    await settle(); await settle();
    for (const t of [a, b, c]) expect(t.getAll()).toEqual({ y: 'c1' });
  });

  it('close() closes the channel and stops handling messages', async () => {
    const { a, b, hub } = tabs(['a', 'b']);
    await settle();
    const before = hub.open();
    b.close();
    expect(hub.open()).toBe(before - 1);
    a.set('k', 1);
    await settle();
    expect(b.get('k')).toBeUndefined();
  });
});
```

%% worked
**The heart of it is one pure function: "is this change newer than what I have?"** Start with that, then wrap messaging around it.

```js
const compare = (a, b) => a.ts - b.ts || (a.tabId < b.tabId ? -1 : a.tabId > b.tabId ? 1 : 0);   // ① ts first, then tabId as the tie-break

function createRegister() {
  const entries = new Map();                                   // key → { value, version, deleted }
  let highestTs = 0;                                           // ② the logical clock

  return {
    nextVersion(tabId, now) {
      highestTs = Math.max(now, highestTs + 1);                // ③ a local write ALWAYS beats everything this tab has seen
      return { ts: highestTs, tabId };
    },
    merge(key, change) {                                       // change = { value, version, deleted }
      highestTs = Math.max(highestTs, change.version.ts);      // ④ keep the clock up to date with what we observe
      const old = entries.get(key);
      if (old && compare(old.version, change.version) >= 0) return false;   // ⑤ not newer → ignore
      entries.set(key, change);                                // ⑥ tombstones (deleted: true) are stored too
      return true;                                             //    → the caller notifies listeners only when this is true
    },
  };
}
```

Then the tab sync adds: `set`/`delete` call `nextVersion`, `merge` locally, `subscribe` listeners (with `{ remote: false }`), and **broadcast** `{ type: 'change', from: tabId, key, … }`; the channel handler ignores messages from your own `tabId`, merges remote changes (`{ remote: true }`), answers `hello` with a `state` message of all entries, and merges each entry of a received `state`. `get` hides tombstones; `getAll` excludes them.

%% explain
- **`set`/`delete`** update locally and broadcast; each entry has a version `{ ts, tabId }`.
- **Last writer wins**: apply a change only if its version is greater (`ts`, then `tabId`); all tabs end with the same value whatever the delivery order.
- **Logical clock**: a write's `ts` is `max(now(), highestTsSeen + 1)`.
- **Deletes are tombstones**; `get` of a deleted key is `undefined`; `getAll()` excludes deleted keys.
- **`subscribe`** listeners get `(key, value, { remote })` for every *applied* change.
- **Catch-up**: on creation broadcast `hello`; on receiving a `hello` from another tab, broadcast full `state`; merge received `state` entries.
- **Own messages are ignored**; `close()` closes the channel and stops handling.

%% nudge
- How do you make a local write always win against what this tab has already seen?
- Which tabs should ignore a message — and what identifies "my own"?

%% hints
- `entries = new Map<key, { value, ts, tabId, deleted }>()` and a `maxTs` you update whenever you see any version.
- `isNewer(a, b)`: `!b || a.ts > b.ts || (a.ts === b.ts && a.tabId > b.tabId)`.
- One `apply(key, entry, remote)` does the comparison, stores, bumps `maxTs`, and notifies. Local `set`, remote `set` messages and `state` merges all go through it.
- Local write: `ts = Math.max(now(), maxTs + 1)`.
- Message shapes: `{ type: 'set', from, key, entry }`, `{ type: 'hello', from }`, `{ type: 'state', from, entries: [[key, entry], …] }`. Ignore messages whose `from === tabId`.

%% solution
```js
export function createTabSync({ channel, tabId, now = () => Date.now() }) {
  const entries = new Map();
  const listeners = new Set();
  let maxTs = 0;
  let closed = false;

  const isNewer = (a, b) => !b || a.ts > b.ts || (a.ts === b.ts && a.tabId > b.tabId);

  function apply(key, entry, remote) {
    maxTs = Math.max(maxTs, entry.ts);
    if (!isNewer(entry, entries.get(key))) return;
    entries.set(key, entry);
    const value = entry.deleted ? undefined : entry.value;
    listeners.forEach((l) => l(key, value, { remote }));
  }

  function write(key, value, deleted) {
    const entry = { value, ts: Math.max(now(), maxTs + 1), tabId, deleted };
    apply(key, entry, false);
    channel.postMessage({ type: 'set', from: tabId, key, entry });
  }

  const onMessage = (event) => {
    if (closed) return;
    const msg = event.data;
    if (!msg || msg.from === tabId) return;
    if (msg.type === 'set') apply(msg.key, msg.entry, true);
    else if (msg.type === 'hello') channel.postMessage({ type: 'state', from: tabId, entries: [...entries] });
    else if (msg.type === 'state') for (const [key, entry] of msg.entries) apply(key, entry, true);
  };

  channel.addEventListener('message', onMessage);
  channel.postMessage({ type: 'hello', from: tabId });

  return {
    get: (key) => {
      const entry = entries.get(key);
      return entry && !entry.deleted ? entry.value : undefined;
    },
    set: (key, value) => write(key, value, false),
    delete: (key) => write(key, undefined, true),
    getAll() {
      const out = {};
      for (const [key, entry] of entries) if (!entry.deleted) out[key] = entry.value;
      return out;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      closed = true;
      channel.removeEventListener('message', onMessage);
      channel.close();
    },
  };
}
```

%% exercise prod-leader-election | Heartbeat leader election | 4 | js | js | createLeaderElection | 40
Build `createLeaderElection({ channel, tabId, heartbeatMs = 1000, timeoutMs = 3500, now = () => Date.now(), onChange })`.

Returns `{ get isLeader, get peers, close() }`.

- Broadcast `{ type: 'heartbeat', from: tabId }` immediately on creation and then every `heartbeatMs`.
- Track each peer's `lastSeen` (using `now()` when its heartbeat arrives). A peer is **alive** while `now() - lastSeen < timeoutMs`. Ignore your own messages.
- The **leader is the alive tab with the lowest id** (string comparison), counting yourself.
- Start as **not** the leader. Evaluate on every **tick** (each `heartbeatMs`), whenever a **heartbeat** arrives, and when a **bye** arrives. A newly created tab therefore gets one heartbeat interval to hear about peers before it can claim leadership.
- `onChange(isLeader)` fires **only when leadership changes**.
- `peers` → sorted ids of alive **other** tabs.
- `close()` broadcasts `{ type: 'bye', from: tabId }`, stops the timer, removes the listener and closes the channel. Receiving a `bye` removes that peer immediately.

%% starter
```js
export function createLeaderElection({ channel, tabId, heartbeatMs = 1000, timeoutMs = 3500, now = () => Date.now(), onChange = () => {} }) {
  // your code
}
```

%% tests
```js
function makeTab(hub, id, options = {}, clock) {
  const changes = [];
  const raw = hub.channel('leader');
  let crashed = false;
  const channel = {
    postMessage: (m) => { if (!crashed) raw.postMessage(m); },
    addEventListener: (t, f) => raw.addEventListener(t, f),
    removeEventListener: (t, f) => raw.removeEventListener(t, f),
    close: () => raw.close(),
  };
  const election = createLeaderElection({ channel, tabId: id, now: () => clock.t, onChange: (v) => changes.push(v), ...options });
  return { election, changes, crash: () => { crashed = true; } };
}
async function advance(clock, ms) {
  clock.t += ms;
  await jest.advanceTimersByTimeAsync(ms);
  await flushPromises();
}

describe('createLeaderElection', () => {
  let hub, clock;
  beforeEach(() => { jest.useFakeTimers(); hub = createFakeChannelHub(); clock = { t: 0 }; });

  it('starts as a non-leader, then a lone tab becomes leader after the first tick', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    expect(a.election.isLeader).toBe(false);
    await advance(clock, 1000);
    expect(a.election.isLeader).toBe(true);
    expect(a.changes).toEqual([true]);
  });

  it('broadcasts a heartbeat immediately and on each tick', async () => {
    const seen = [];
    const spy = hub.channel('leader');
    spy.onmessage = (e) => seen.push(e.data);
    makeTab(hub, 'a', {}, clock);
    await flushPromises();
    expect(seen).toEqual([{ type: 'heartbeat', from: 'a' }]);
    await advance(clock, 1000);
    await advance(clock, 1000);
    expect(seen).toHaveLength(3);
  });

  it('the lowest id wins among several tabs', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    const c = makeTab(hub, 'c', {}, clock);
    await advance(clock, 1000);
    expect(a.election.isLeader).toBe(true);
    expect(b.election.isLeader).toBe(false);
    expect(c.election.isLeader).toBe(false);
    expect(a.election.peers).toEqual(['b', 'c']);
    expect(c.election.peers).toEqual(['a', 'b']);
  });

  it('a tab with a lower id joining later takes over, and the old leader steps down', async () => {
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(true);
    const a = makeTab(hub, 'a', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false);
    expect(b.changes).toEqual([true, false]);
    expect(a.election.isLeader).toBe(true);
  });

  it('hands over immediately when the leader says bye', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false);
    a.election.close();
    await flushPromises();
    expect(b.election.isLeader).toBe(true);
    expect(b.election.peers).toEqual([]);
  });

  it('detects a crashed leader via the heartbeat timeout', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    a.crash();
    await advance(clock, 1000);
    await advance(clock, 1000);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false); // 3000ms since a's last heartbeat: still within 3500
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(true);
    expect(b.election.peers).toEqual([]);
  });

  it('a recovered peer is alive again once its heartbeats resume', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const b = makeTab(hub, 'b', {}, clock);
    await advance(clock, 1000);
    a.crash();
    for (let i = 0; i < 5; i++) await advance(clock, 1000);
    expect(b.election.isLeader).toBe(true);
    const a2 = makeTab(hub, 'a', {}, clock);
    await advance(clock, 1000);
    expect(b.election.isLeader).toBe(false);
    expect(a2.election.isLeader).toBe(true);
  });

  it('honours custom heartbeat and timeout values', async () => {
    const a = makeTab(hub, 'a', { heartbeatMs: 100, timeoutMs: 250 }, clock);
    const b = makeTab(hub, 'b', { heartbeatMs: 100, timeoutMs: 250 }, clock);
    await advance(clock, 100);
    expect(a.election.isLeader).toBe(true);
    a.crash();
    await advance(clock, 100);
    await advance(clock, 100);
    expect(b.election.isLeader).toBe(false);
    await advance(clock, 100);
    expect(b.election.isLeader).toBe(true);
  });

  it('onChange fires only on changes', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    for (let i = 0; i < 5; i++) await advance(clock, 1000);
    expect(a.changes).toEqual([true]);
  });

  it('close() stops the timer and detaches', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    a.election.close();
    expect(jest.getTimerCount()).toBe(0);
    expect(hub.open()).toBe(0);
  });

  it('ignores its own messages and malformed ones', async () => {
    const a = makeTab(hub, 'a', {}, clock);
    const noise = hub.channel('leader');
    noise.postMessage({ type: 'unknown', from: 'zzz' });
    noise.postMessage(null);
    await advance(clock, 1000);
    expect(a.election.isLeader).toBe(true);
    expect(a.election.peers).toEqual([]);
  });
});
```

%% worked
**Build on the guided `pickLeader`: the election is that function plus timers and messages.**

```js
function createElection({ channel, tabId, heartbeatMs, timeoutMs, now, onChange }) {
  const lastSeen = new Map();                                  // peer id → time of its last heartbeat
  let leader = false;                                          // ① start as NOT the leader

  function evaluate() {
    const t = now();
    const alive = [...lastSeen].filter(([, seenAt]) => t - seenAt < timeoutMs).map(([id]) => id);
    const isLeader = [tabId, ...alive].sort()[0] === tabId;     // ② the lowest alive id, counting myself
    if (isLeader !== leader) { leader = isLeader; onChange?.(leader); }   // ③ tell the app ONLY when leadership CHANGES
  }

  channel.onmessage = ({ data }) => {
    if (data.from === tabId) return;                            // ④ ignore my own messages
    if (data.type === 'heartbeat') lastSeen.set(data.from, now());
    if (data.type === 'bye') lastSeen.delete(data.from);        // ⑤ instant handover
    evaluate();                                                 // re-evaluate on EVERY heartbeat and bye
  };

  const beat = () => { channel.postMessage({ type: 'heartbeat', from: tabId }); evaluate(); };
  beat();                                                       // ⑥ announce immediately…
  const timer = setInterval(beat, heartbeatMs);                 //    …then every heartbeatMs (each tick also re-evaluates)

  return { get isLeader() { return leader; }, close() { /* send bye, clearInterval(timer), remove listener, close channel */ } };
}
```

Two subtleties from the exercise: a new tab starts **not** leader and evaluates on its first tick — giving it one interval to hear about existing peers before it can claim leadership — and `peers` must list only the alive **other** tabs, **sorted**.

%% explain
- **Heartbeats**: broadcast immediately, then every `heartbeatMs`; track each peer's `lastSeen`.
- **Alive** = heard within `timeoutMs`; own messages ignored.
- **Leader** = the alive tab with the lowest id (counting yourself); starts as **not** leader.
- **Evaluate** on every tick, every heartbeat, and every `bye`; **`onChange(isLeader)`** fires only on changes.
- **`peers`** = sorted ids of alive *other* tabs.
- **`close()`** broadcasts `bye`, stops the timer, removes the listener, closes the channel; receiving `bye` removes that peer immediately.

%% nudge
- When should `evaluate()` run, and why might the leader change even with no new message?
- Why does a new tab start as "not leader"?

%% hints
- `peers = new Map<id, lastSeen>()`. `evaluate()` drops peers whose `now() - lastSeen >= timeoutMs`, computes `leader = [tabId, ...peers.keys()].sort()[0]`, and calls `onChange` if `leader === tabId` differs from the previous value.
- The interval callback = `postMessage(heartbeat)` then `evaluate()`.
- On a `heartbeat` message: `peers.set(from, now())`, `evaluate()`. On `bye`: `peers.delete(from)`, `evaluate()`.
- Track `isLeader` in a variable that starts `false`.
- `close()`: `postMessage({ type: 'bye', from })`, `clearInterval`, `removeEventListener`, `channel.close()`.

%% solution
```js
export function createLeaderElection({ channel, tabId, heartbeatMs = 1000, timeoutMs = 3500, now = () => Date.now(), onChange = () => {} }) {
  const peers = new Map();
  let isLeader = false;
  let closed = false;

  function evaluate() {
    if (closed) return;
    const t = now();
    for (const [id, lastSeen] of peers) if (t - lastSeen >= timeoutMs) peers.delete(id);
    const leader = [tabId, ...peers.keys()].sort()[0];
    const next = leader === tabId;
    if (next !== isLeader) {
      isLeader = next;
      onChange(isLeader);
    }
  }

  const onMessage = (event) => {
    if (closed) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || msg.from === tabId) return;
    if (msg.type === 'heartbeat') {
      peers.set(msg.from, now());
      evaluate();
    } else if (msg.type === 'bye') {
      peers.delete(msg.from);
      evaluate();
    }
  };

  const beat = () => channel.postMessage({ type: 'heartbeat', from: tabId });

  channel.addEventListener('message', onMessage);
  beat();
  const timer = setInterval(() => {
    beat();
    evaluate();
  }, heartbeatMs);

  return {
    get isLeader() {
      return isLeader;
    },
    get peers() {
      return [...peers.keys()].sort();
    },
    close() {
      if (closed) return;
      channel.postMessage({ type: 'bye', from: tabId });
      closed = true;
      clearInterval(timer);
      channel.removeEventListener('message', onMessage);
      channel.close();
    },
  };
}
```

%% exercise prod-shared-feed | One socket for all tabs | 3 | js | js | createSharedFeed | 30
Put the election to work. Build `createSharedFeed({ channel, election, createSocket, onMessage })`.

`election` exposes `isLeader` (getter) and `subscribe(fn)` (returns unsubscribe; `fn(isLeader)` is called on changes). `createSocket()` returns a socket with `addEventListener('message', fn)` and `close()`.

- **Leader:** owns the socket. It opens it (`createSocket()`) when it becomes leader, delivers each frame to its own `onMessage(data)`, and **relays** it to other tabs with `channel.postMessage({ type: 'feed', data })`.
- **Follower:** never opens a socket. It calls `onMessage(data)` for each `feed` message that arrives on the channel.
- When leadership is **lost**, close the socket (and remove its listener). When it's **gained**, open one. Never hold more than one socket.
- If the tab is already leader at creation, open the socket immediately.
- `close()` unsubscribes from the election, closes the socket if any, removes the channel listener and stops delivering.

%% starter
```js
export function createSharedFeed({ channel, election, createSocket, onMessage }) {
  // your code
}
```

%% tests
```js
function fakeElection(initial = false) {
  const listeners = new Set();
  return {
    isLeader: initial,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(value) { this.isLeader = value; listeners.forEach((l) => l(value)); },
    listenerCount: () => listeners.size,
  };
}
function makeFeed(hub, election, received) {
  const sockets = [];
  const feed = createSharedFeed({
    channel: hub.channel('feed'),
    election,
    createSocket: () => { const s = createFakeSocket('wss://odds'); s.open(); sockets.push(s); return s; },
    onMessage: (d) => received.push(d),
  });
  return { feed, sockets };
}

describe('createSharedFeed', () => {
  it('a follower opens no socket', () => {
    const hub = createFakeChannelHub();
    const { sockets } = makeFeed(hub, fakeElection(false), []);
    expect(sockets).toHaveLength(0);
  });

  it('a leader at creation opens the socket immediately', () => {
    const hub = createFakeChannelHub();
    const { sockets } = makeFeed(hub, fakeElection(true), []);
    expect(sockets).toHaveLength(1);
  });

  it('the leader delivers frames locally and relays them to followers', async () => {
    const hub = createFakeChannelHub();
    const leaderGot = [], followerGot = [];
    const leader = makeFeed(hub, fakeElection(true), leaderGot);
    makeFeed(hub, fakeElection(false), followerGot);
    leader.sockets[0].receive({ market: 'm1', odds: 2 });
    await flushPromises();
    expect(leaderGot).toEqual(['{"market":"m1","odds":2}']);
    expect(followerGot).toEqual(['{"market":"m1","odds":2}']);
  });

  it('followers do not receive their own relays twice and leaders do not double-deliver', async () => {
    const hub = createFakeChannelHub();
    const leaderGot = [];
    const leader = makeFeed(hub, fakeElection(true), leaderGot);
    leader.sockets[0].receive('x');
    await flushPromises();
    expect(leaderGot).toEqual(['x']);
  });

  it('opens a socket when leadership is gained', () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(false);
    const { sockets } = makeFeed(hub, election, []);
    election.set(true);
    expect(sockets).toHaveLength(1);
  });

  it('closes the socket when leadership is lost', () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(true);
    const { sockets } = makeFeed(hub, election, []);
    election.set(false);
    expect(sockets[0].readyState).toBe(3);
    expect(sockets[0].listenerCount()).toBe(0);
  });

  it('never holds more than one socket across leadership flips', () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(false);
    const { sockets } = makeFeed(hub, election, []);
    election.set(true); election.set(true); election.set(false); election.set(true);
    const open = sockets.filter((s) => s.readyState !== 3);
    expect(open).toHaveLength(1);
    expect(sockets).toHaveLength(2);
  });

  it('a former leader keeps receiving via the channel as a follower', async () => {
    const hub = createFakeChannelHub();
    const oldGot = [], newGot = [];
    const oldElection = fakeElection(true), newElection = fakeElection(false);
    const oldLeader = makeFeed(hub, oldElection, oldGot);
    const newLeader = makeFeed(hub, newElection, newGot);
    oldElection.set(false);
    newElection.set(true);
    newLeader.sockets[0].receive('after-handover');
    await flushPromises();
    expect(oldGot).toEqual(['after-handover']);
    expect(newGot).toEqual(['after-handover']);
    expect(oldLeader.sockets[0].readyState).toBe(3);
  });

  it('close() releases the election subscription, socket and channel listener', async () => {
    const hub = createFakeChannelHub();
    const election = fakeElection(true);
    const got = [];
    const { feed, sockets } = makeFeed(hub, election, got);
    feed.close();
    expect(election.listenerCount()).toBe(0);
    expect(sockets[0].readyState).toBe(3);
    expect(hub.open()).toBe(0);
  });

  it('ignores channel messages of other types and malformed data', async () => {
    const hub = createFakeChannelHub();
    const got = [];
    makeFeed(hub, fakeElection(false), got);
    const other = hub.channel('feed');
    other.postMessage({ type: 'something-else', data: 'no' });
    other.postMessage(null);
    other.postMessage({ type: 'feed', data: 'yes' });
    await flushPromises();
    expect(got).toEqual(['yes']);
  });
});
```

%% worked
**A similar problem, solved: "one worker does the job, everyone else listens".**

```js
function createSharedSubscription({ channel, election, startJob, onData }) {
  let job = null;                                             // the thing only the LEADER runs

  function become(isLeader) {
    if (isLeader && !job) {
      job = startJob((data) => {                              // ① leader: produce data…
        onData(data);                                         //    …use it myself…
        channel.postMessage({ type: 'feed', data });          //    …and RELAY it to the other tabs
      });
    } else if (!isLeader && job) {
      job.stop();                                             // ② lost leadership → release the resource
      job = null;
    }
  }

  const onMessage = ({ data }) => { if (data?.type === 'feed') onData(data.data); };   // ③ followers just listen
  channel.addEventListener('message', onMessage);

  const unsubscribe = election.subscribe(become);
  become(election.isLeader);                                  // ④ already leader at creation? start right away

  return { close() { unsubscribe(); job?.stop(); job = null; channel.removeEventListener('message', onMessage); } };
}
```

For the real exercise the "job" is a socket: `createSocket()`, `socket.addEventListener('message', handler)` (the handler delivers to `onMessage` and relays), and `socket.close()` plus removing the listener on loss. Never hold **more than one** socket, and after `close()` stop delivering anything (a flag checked in both handlers).

%% explain
- **Leader**: owns the socket; opens it when it becomes leader (or at creation if already leader); delivers each frame to its own `onMessage(data)` and relays with `channel.postMessage({ type: 'feed', data })`.
- **Follower**: never opens a socket; calls `onMessage(data)` for each `feed` message on the channel.
- **Leadership lost** → close the socket and remove its listener; **gained** → open one. Never more than one socket.
- **`close()`** unsubscribes from the election, closes the socket, removes the channel listener and stops delivering.

%% nudge
- What must happen to the socket, and its listener, when leadership is lost?
- How can you avoid opening a second socket if `become(true)` is called twice?

%% hints
- Two small functions: `openSocket()` (no-op if one exists) and `closeSocket()` (remove listener, `close()`, set to `null`).
- React to election changes: `isLeader ? openSocket() : closeSocket()`.
- The socket's message handler does both: `onMessage(e.data)` **and** `channel.postMessage({ type: 'feed', data: e.data })`.
- The channel listener only handles `type === 'feed'`; BroadcastChannel never delivers to the sender, so a leader doesn't double-deliver.

%% solution
```js
export function createSharedFeed({ channel, election, createSocket, onMessage }) {
  let socket = null;
  let closed = false;

  const onSocketMessage = (event) => {
    onMessage(event.data);
    channel.postMessage({ type: 'feed', data: event.data });
  };

  function openSocket() {
    if (socket || closed) return;
    socket = createSocket();
    socket.addEventListener('message', onSocketMessage);
  }

  function closeSocket() {
    if (!socket) return;
    socket.removeEventListener('message', onSocketMessage);
    socket.close();
    socket = null;
  }

  const onChannelMessage = (event) => {
    if (closed) return;
    const msg = event.data;
    if (msg && msg.type === 'feed') onMessage(msg.data);
  };

  channel.addEventListener('message', onChannelMessage);
  const unsubscribe = election.subscribe((isLeader) => (isLeader ? openSocket() : closeSocket()));
  if (election.isLeader) openSocket();

  return {
    close() {
      if (closed) return;
      closed = true;
      unsubscribe();
      closeSocket();
      channel.removeEventListener('message', onChannelMessage);
      channel.close();
    },
  };
}
```
