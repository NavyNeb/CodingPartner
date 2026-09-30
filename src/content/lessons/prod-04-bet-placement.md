---
id: prod-bet-placement
track: prod
title: Case study: the bet that moved
summary: The price changes between the tap and the submit, the network flakes, and a nervous user double-clicks. Model the slip as a state machine, make submits idempotent, and build the UI that tells the truth.
---

> **INCIDENT — a Tuesday, three complaints in one hour.**
>
> **Complaint A:** "I bet £50 at 2.10 and got 1.95." The client sent only *selection id + stake*; the server filled in whatever the price was **at that moment**.
>
> **Complaint B:** "I was charged twice." On a bad connection the first `POST /bets` timed out client-side but had succeeded server-side; the app's retry created a second bet.
>
> **Complaint C:** "The button did nothing." The UI waited for the response before showing any feedback, so users tapped again — and again.

When money is involved, every one of those is a correctness bug, not a UX nit.

## Principles

**1 · Send what the user agreed to.** The request must carry the **price the user saw** (and their stake). The server validates: if the current price is *worse* than the agreed one it rejects with a structured error (`409 PRICE_CHANGED { newPrice }`) instead of silently filling in a new price. Some products auto-accept *better* prices; that's a product rule the server enforces, not something the client guesses.

**2 · Make price changes an explicit state.** The slip is a small **state machine**: `idle → placing → placed | failed`, plus per-selection flags (`priceChanged`, `suspended`). Placing is only allowed from states where it's valid; the "Place bet" button is derived from that state, never from ad-hoc booleans. Put the rules in a **pure reducer** so they're unit-testable and reusable.

**3 · Money is integers.** Store cents (`stakeCents`), never floats: `0.1 + 0.2 !== 0.3`. Round once, at a defined boundary (`Math.round(stake × odds)`), and display with `toFixed(2)`.

**4 · Idempotency keys.** Generate a unique key **per logical action** (this bet, not this HTTP request) and send it as a header. The server stores the outcome by key; a repeat with the same key returns the **original result** instead of doing it again. So it's safe to retry on timeouts and network errors — *as long as every retry reuses the same key*. A **new** user action gets a **new** key.

**5 · Double-click protection is layered.** Disable the button and show progress **immediately** (optimistic UI: `Placing…` before the server answers) — *and* dedupe in code (in-flight guard, ref not state, because state updates are async) — *and* have the server enforce idempotency. Any one layer alone leaks.

**6 · Respect the unknown.** A timeout means *you don't know* whether the bet was placed. Never treat it as failure. Retry with the same key, or query the bet's status by key, before letting the user try again.

## Optimistic vs. pessimistic UI

- **Optimistic** (assume success, roll back on failure): great for likes, drafts, reordering. For money, use it only for the *feedback* (spinner, disabled button) — not for showing "Bet placed!".
- **Pessimistic** (wait for confirmation): correct for irreversible actions. Keep the wait short and honest.

## What to be able to say in an interview

- How would you prevent double submission? *(disable + in-flight guard + idempotency key)*
- What if the response is lost? *(idempotent retry / status lookup)*
- What if the price changes mid-flow? *(send agreed price; structured rejection; explicit re-accept)*
- Why not floats for money? *(binary FP error; integer minor units)*
- Where does validation live? *(server is authoritative; the client mirrors rules for UX)*

%% exercise prod-betslip-reducer | Bet slip state machine | 3 | js | js | createInitialState, betSlipReducer, canPlace, potentialReturn, totals | 35
Model the bet slip as a **pure reducer**.

```js
state     = { selections: [], status: 'idle' | 'placing' | 'placed' | 'failed', error: null }
selection = { id, name, price, acceptedPrice, stake /* integer cents */, priceChange: null | { from, to }, suspended }
```

**Actions** (`{ type, … }`):
- `add {id, name, price}` — appends a selection (`stake: 0`, `acceptedPrice = price`, no change, not suspended). A duplicate id is ignored. Adding after a bet was `placed` returns the status to `idle`.
- `remove {id}`.
- `setStake {id, stake}` — integer cents ≥ 0: floor fractions, clamp negatives and non-finite values to `0`.
- `priceUpdate {id, price}` — the live feed moved. Store the new `price`. If it differs from the user's `acceptedPrice`, set `priceChange = { from: acceptedPrice, to: price }`; if it moved **back** to the accepted price, clear `priceChange`. Ignore non-positive prices.
- `suspend {id, suspended}`.
- `acceptChanges` — for every selection with a `priceChange`: `acceptedPrice = price`, clear the change.
- `placeStart` — only if `canPlace(state)`, then `status: 'placing'`, `error: null`.
- `placeSuccess` — only while `placing`: `status: 'placed'`, clear the selections.
- `placeFailure {error}` — only while `placing`: `status: 'failed'`, store `error`.

**Rules:** an action that changes nothing (unknown id, same value, invalid transition, unknown action type) must return the **same state reference**.

**Selectors:** `canPlace(state)` — not already placing, at least one selection with `stake > 0`, and **every staked selection** is not suspended and has no unaccepted price change. `potentialReturn(selection)` = `Math.round(stake × acceptedPrice)` cents. `totals(state)` = `{ stake, return }` summed over staked selections.

%% starter
```js
export function createInitialState() {
  return { selections: [], status: 'idle', error: null };
}

export function betSlipReducer(state, action) {
  return state;
}

export function canPlace(state) {
  return false;
}

export function potentialReturn(selection) {
  return 0;
}

export function totals(state) {
  return { stake: 0, return: 0 };
}
```

%% tests
```js
const run = (actions, state = createInitialState()) => actions.reduce(betSlipReducer, state);
const withOne = (extra = []) => run([{ type: 'add', id: 's1', name: 'Arsenal', price: 2.0 }, ...extra]);
const sel = (state, id = 's1') => state.selections.find((s) => s.id === id);

describe('add / remove / setStake', () => {
  it('adds selections with defaults', () => {
    const s = withOne();
    expect(s.selections).toEqual([{ id: 's1', name: 'Arsenal', price: 2.0, acceptedPrice: 2.0, stake: 0, priceChange: null, suspended: false }]);
    expect(s.status).toBe('idle');
  });

  it('ignores duplicate ids (same reference)', () => {
    const s = withOne();
    expect(betSlipReducer(s, { type: 'add', id: 's1', name: 'X', price: 9 })).toBe(s);
  });

  it('removes selections, and removing an unknown id is a no-op', () => {
    const s = withOne();
    expect(betSlipReducer(s, { type: 'remove', id: 'zzz' })).toBe(s);
    expect(betSlipReducer(s, { type: 'remove', id: 's1' }).selections).toEqual([]);
  });

  it('sets stakes as clamped integer cents', () => {
    const s = withOne();
    expect(sel(run([{ type: 'setStake', id: 's1', stake: 1050 }], s)).stake).toBe(1050);
    expect(sel(run([{ type: 'setStake', id: 's1', stake: 10.9 }], s)).stake).toBe(10);
    expect(sel(run([{ type: 'setStake', id: 's1', stake: -5 }], s)).stake).toBe(0);
    expect(sel(run([{ type: 'setStake', id: 's1', stake: NaN }], s)).stake).toBe(0);
    expect(sel(run([{ type: 'setStake', id: 's1', stake: Infinity }], s)).stake).toBe(0);
  });

  it('returns the same reference for an unchanged stake or unknown id', () => {
    const s = run([{ type: 'add', id: 's1', name: 'A', price: 2 }, { type: 'setStake', id: 's1', stake: 500 }]);
    expect(betSlipReducer(s, { type: 'setStake', id: 's1', stake: 500 })).toBe(s);
    expect(betSlipReducer(s, { type: 'setStake', id: 'nope', stake: 500 })).toBe(s);
  });

  it('never mutates the previous state', () => {
    const s = Object.freeze({ ...withOne(), selections: Object.freeze([Object.freeze({ ...withOne().selections[0] })]) });
    expect(() => betSlipReducer(s, { type: 'setStake', id: 's1', stake: 100 })).not.toThrow();
    expect(() => betSlipReducer(s, { type: 'priceUpdate', id: 's1', price: 3 })).not.toThrow();
  });

  it('ignores unknown actions', () => {
    const s = withOne();
    expect(betSlipReducer(s, { type: 'nonsense' })).toBe(s);
  });
});

describe('price changes', () => {
  it('records a price change relative to the accepted price', () => {
    const s = withOne([{ type: 'priceUpdate', id: 's1', price: 1.8 }]);
    expect(sel(s)).toMatchObject({ price: 1.8, acceptedPrice: 2.0, priceChange: { from: 2.0, to: 1.8 } });
  });

  it('keeps "from" as the accepted price across several updates', () => {
    const s = withOne([{ type: 'priceUpdate', id: 's1', price: 1.8 }, { type: 'priceUpdate', id: 's1', price: 1.6 }]);
    expect(sel(s).priceChange).toEqual({ from: 2.0, to: 1.6 });
  });

  it('clears the change when the price returns to the accepted one', () => {
    const s = withOne([{ type: 'priceUpdate', id: 's1', price: 1.8 }, { type: 'priceUpdate', id: 's1', price: 2.0 }]);
    expect(sel(s).priceChange).toBeNull();
    expect(sel(s).price).toBe(2.0);
  });

  it('ignores identical or invalid prices', () => {
    const s = withOne();
    expect(betSlipReducer(s, { type: 'priceUpdate', id: 's1', price: 2.0 })).toBe(s);
    expect(betSlipReducer(s, { type: 'priceUpdate', id: 's1', price: 0 })).toBe(s);
    expect(betSlipReducer(s, { type: 'priceUpdate', id: 's1', price: -1 })).toBe(s);
    expect(betSlipReducer(s, { type: 'priceUpdate', id: 'nope', price: 3 })).toBe(s);
  });

  it('acceptChanges adopts the live price and clears the flag', () => {
    const s = withOne([{ type: 'priceUpdate', id: 's1', price: 1.8 }, { type: 'acceptChanges' }]);
    expect(sel(s)).toMatchObject({ price: 1.8, acceptedPrice: 1.8, priceChange: null });
  });

  it('acceptChanges with nothing to accept is a no-op', () => {
    const s = withOne();
    expect(betSlipReducer(s, { type: 'acceptChanges' })).toBe(s);
  });
});

describe('canPlace / totals / potentialReturn', () => {
  const staked = (extra = []) => withOne([{ type: 'setStake', id: 's1', stake: 1000 }, ...extra]);

  it('needs a positive stake', () => {
    expect(canPlace(withOne())).toBe(false);
    expect(canPlace(staked())).toBe(true);
  });

  it('is blocked by a pending price change until accepted', () => {
    const s = staked([{ type: 'priceUpdate', id: 's1', price: 1.9 }]);
    expect(canPlace(s)).toBe(false);
    expect(canPlace(betSlipReducer(s, { type: 'acceptChanges' }))).toBe(true);
  });

  it('is blocked by a suspended staked selection, but not by an unstaked one', () => {
    expect(canPlace(staked([{ type: 'suspend', id: 's1', suspended: true }]))).toBe(false);
    const two = staked([{ type: 'add', id: 's2', name: 'B', price: 3 }, { type: 'suspend', id: 's2', suspended: true }]);
    expect(canPlace(two)).toBe(true);
  });

  it('is blocked while placing', () => {
    const s = betSlipReducer(staked(), { type: 'placeStart' });
    expect(canPlace(s)).toBe(false);
  });

  it('computes returns in integer cents from the accepted price', () => {
    const s = staked();
    expect(potentialReturn(sel(s))).toBe(2000);
    const moved = run([{ type: 'priceUpdate', id: 's1', price: 1.5 }], s);
    expect(potentialReturn(sel(moved))).toBe(2000);
    expect(potentialReturn({ stake: 333, acceptedPrice: 1.15 })).toBe(383);
    expect(potentialReturn({ stake: 0, acceptedPrice: 5 })).toBe(0);
  });

  it('totals only staked selections', () => {
    const s = run([
      { type: 'add', id: 's1', name: 'A', price: 2 },
      { type: 'add', id: 's2', name: 'B', price: 1.5 },
      { type: 'add', id: 's3', name: 'C', price: 9 },
      { type: 'setStake', id: 's1', stake: 1000 },
      { type: 'setStake', id: 's2', stake: 200 },
    ]);
    expect(totals(s)).toEqual({ stake: 1200, return: 2000 + 300 });
  });
});

describe('placing', () => {
  const staked = () => withOne([{ type: 'setStake', id: 's1', stake: 1000 }]);

  it('placeStart moves to placing only when allowed', () => {
    const idle = withOne();
    expect(betSlipReducer(idle, { type: 'placeStart' })).toBe(idle);
    const s = betSlipReducer(staked(), { type: 'placeStart' });
    expect(s.status).toBe('placing');
    expect(betSlipReducer(s, { type: 'placeStart' })).toBe(s);
  });

  it('placeSuccess clears the slip', () => {
    const s = run([{ type: 'placeStart' }, { type: 'placeSuccess' }], staked());
    expect(s.status).toBe('placed');
    expect(s.selections).toEqual([]);
  });

  it('placeFailure keeps the slip so the user can retry', () => {
    const s = run([{ type: 'placeStart' }, { type: 'placeFailure', error: 'PRICE_CHANGED' }], staked());
    expect(s.status).toBe('failed');
    expect(s.error).toBe('PRICE_CHANGED');
    expect(s.selections).toHaveLength(1);
    expect(canPlace(s)).toBe(true);
  });

  it('results only apply while placing', () => {
    const s = staked();
    expect(betSlipReducer(s, { type: 'placeSuccess' })).toBe(s);
    expect(betSlipReducer(s, { type: 'placeFailure', error: 'x' })).toBe(s);
  });

  it('placeStart clears a previous error', () => {
    const s = run([{ type: 'placeStart' }, { type: 'placeFailure', error: 'boom' }, { type: 'placeStart' }], staked());
    expect(s.error).toBeNull();
    expect(s.status).toBe('placing');
  });

  it('adding a selection after success resets the status', () => {
    const s = run([{ type: 'placeStart' }, { type: 'placeSuccess' }, { type: 'add', id: 's9', name: 'N', price: 2 }], staked());
    expect(s.status).toBe('idle');
    expect(s.selections).toHaveLength(1);
  });
});
```

%% hints
- A small helper `updateSelection(state, id, fn)` that returns `state` unchanged if the id is missing **or** `fn` returns the same object keeps the "same reference" rule easy to satisfy.
- `canPlace`: `const staked = state.selections.filter((s) => s.stake > 0)`; then `state.status !== 'placing' && staked.length > 0 && staked.every((s) => !s.suspended && !s.priceChange)`.
- `priceUpdate`: compute `priceChange = price === sel.acceptedPrice ? null : { from: sel.acceptedPrice, to: price }`.
- `placeStart` can reuse `canPlace` directly.

%% solution
```js
export function createInitialState() {
  return { selections: [], status: 'idle', error: null };
}

function updateSelection(state, id, fn) {
  const i = state.selections.findIndex((s) => s.id === id);
  if (i === -1) return state;
  const next = fn(state.selections[i]);
  if (next === state.selections[i]) return state;
  const selections = state.selections.slice();
  selections[i] = next;
  return { ...state, selections };
}

export function betSlipReducer(state, action) {
  switch (action.type) {
    case 'add': {
      if (state.selections.some((s) => s.id === action.id)) return state;
      const selection = {
        id: action.id,
        name: action.name,
        price: action.price,
        acceptedPrice: action.price,
        stake: 0,
        priceChange: null,
        suspended: false,
      };
      return { ...state, status: state.status === 'placed' ? 'idle' : state.status, selections: [...state.selections, selection] };
    }
    case 'remove': {
      if (!state.selections.some((s) => s.id === action.id)) return state;
      return { ...state, selections: state.selections.filter((s) => s.id !== action.id) };
    }
    case 'setStake': {
      const stake = Number.isFinite(action.stake) ? Math.max(0, Math.floor(action.stake)) : 0;
      return updateSelection(state, action.id, (s) => (s.stake === stake ? s : { ...s, stake }));
    }
    case 'priceUpdate': {
      if (!(action.price > 0)) return state;
      return updateSelection(state, action.id, (s) => {
        if (s.price === action.price) return s;
        const priceChange = action.price === s.acceptedPrice ? null : { from: s.acceptedPrice, to: action.price };
        return { ...s, price: action.price, priceChange };
      });
    }
    case 'suspend':
      return updateSelection(state, action.id, (s) => (s.suspended === action.suspended ? s : { ...s, suspended: action.suspended }));
    case 'acceptChanges': {
      if (!state.selections.some((s) => s.priceChange)) return state;
      return {
        ...state,
        selections: state.selections.map((s) => (s.priceChange ? { ...s, acceptedPrice: s.price, priceChange: null } : s)),
      };
    }
    case 'placeStart':
      return canPlace(state) ? { ...state, status: 'placing', error: null } : state;
    case 'placeSuccess':
      return state.status === 'placing' ? { ...state, status: 'placed', selections: [], error: null } : state;
    case 'placeFailure':
      return state.status === 'placing' ? { ...state, status: 'failed', error: action.error } : state;
    default:
      return state;
  }
}

export function canPlace(state) {
  const staked = state.selections.filter((s) => s.stake > 0);
  return state.status !== 'placing' && staked.length > 0 && staked.every((s) => !s.suspended && !s.priceChange);
}

export function potentialReturn(selection) {
  return Math.round(selection.stake * selection.acceptedPrice);
}

export function totals(state) {
  return state.selections
    .filter((s) => s.stake > 0)
    .reduce((acc, s) => ({ stake: acc.stake + s.stake, return: acc.return + potentialReturn(s) }), { stake: 0, return: 0 });
}
```

%% exercise prod-idempotent-submit | Idempotent, double-click-proof submit | 3 | js | js | createSubmitter | 30
Write `createSubmitter(send, options)` returning `submit(payload)`.

`send(payload, { idempotencyKey })` returns a promise. Options: `generateKey()`, `retries = 2`, `retryDelayMs = 200`, `isRetryable(err) = (err) => err?.retryable === true`.

- Each **logical submission** gets one idempotency key from `generateKey()`.
- **Double-click protection:** if `submit` is called with an *equal payload* (compare `JSON.stringify`) while the earlier submission is still in flight, return the **same promise** and do **not** call `send` again.
- **Retries:** if `send` rejects with a retryable error, wait `retryDelayMs` and call `send` again with the **same key**, up to `retries` extra attempts. A non-retryable error rejects immediately; when retries are exhausted, reject with the last error.
- When a submission settles (success or failure), it is forgotten: the next `submit` of the same payload is a **new** submission with a **new** key.
- Submissions with *different* payloads are independent.

%% starter
```js
export function createSubmitter(send, { generateKey, retries = 2, retryDelayMs = 200, isRetryable = (err) => err?.retryable === true } = {}) {
  return function submit(payload) {
    // your code
  };
}
```

%% tests
```js
function setup(sendImpl, options = {}) {
  jest.useFakeTimers();
  let n = 0;
  const send = jest.fn(sendImpl);
  const submit = createSubmitter(send, { generateKey: () => `key-${++n}`, ...options });
  return { send, submit };
}
const retryable = (msg = 'network') => Object.assign(new Error(msg), { retryable: true });

describe('createSubmitter', () => {
  it('sends the payload with an idempotency key and resolves with the result', async () => {
    const { send, submit } = setup(async () => ({ betId: 7 }));
    await expect(submit({ stake: 10 })).resolves.toEqual({ betId: 7 });
    expect(send).toHaveBeenCalledWith({ stake: 10 }, { idempotencyKey: 'key-1' });
  });

  it('returns the same promise for an equal payload while in flight (double click)', async () => {
    let resolve;
    const { send, submit } = setup(() => new Promise((r) => { resolve = r; }));
    const a = submit({ stake: 10, sel: 's1' });
    const b = submit({ stake: 10, sel: 's1' });
    expect(a).toBe(b);
    expect(send).toHaveBeenCalledTimes(1);
    resolve({ ok: true });
    await expect(a).resolves.toEqual({ ok: true });
  });

  it('treats different payloads as independent submissions with different keys', async () => {
    const { send, submit } = setup(async (p) => p);
    await Promise.all([submit({ n: 1 }), submit({ n: 2 })]);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map((c) => c[1].idempotencyKey)).toEqual(['key-1', 'key-2']);
  });

  it('generates a NEW key for a new submission after the previous one settled', async () => {
    const { send, submit } = setup(async () => 'ok');
    await submit({ a: 1 });
    await submit({ a: 1 });
    expect(send.mock.calls.map((c) => c[1].idempotencyKey)).toEqual(['key-1', 'key-2']);
  });

  it('retries retryable errors with the SAME key', async () => {
    let calls = 0;
    const { send, submit } = setup(async () => { if (++calls < 3) throw retryable(); return 'done'; });
    const p = submit({ a: 1 });
    await jest.advanceTimersByTimeAsync(200);
    await jest.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toBe('done');
    expect(send).toHaveBeenCalledTimes(3);
    expect(new Set(send.mock.calls.map((c) => c[1].idempotencyKey)).size).toBe(1);
  });

  it('waits retryDelayMs between attempts', async () => {
    let calls = 0;
    const { send, submit } = setup(async () => { if (++calls < 2) throw retryable(); return 'ok'; }, { retryDelayMs: 1000 });
    const p = submit({});
    await jest.advanceTimersByTimeAsync(999);
    expect(send).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(send).toHaveBeenCalledTimes(2);
    await p;
  });

  it('gives up after retries and rejects with the last error', async () => {
    let n = 0;
    const { send, submit } = setup(async () => { throw retryable(`fail ${++n}`); }, { retries: 2 });
    const p = submit({});
    const assertion = expect(p).rejects.toThrow('fail 3');
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('rejects immediately for non-retryable errors', async () => {
    const { send, submit } = setup(async () => { throw Object.assign(new Error('rejected'), { code: 'PRICE_CHANGED' }); });
    await expect(submit({})).rejects.toThrow('rejected');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('forgets a failed submission so the user can try again with a new key', async () => {
    let calls = 0;
    const { send, submit } = setup(async () => { if (++calls === 1) throw new Error('nope'); return 'ok'; });
    await expect(submit({ a: 1 })).rejects.toThrow('nope');
    await expect(submit({ a: 1 })).resolves.toBe('ok');
    expect(send.mock.calls.map((c) => c[1].idempotencyKey)).toEqual(['key-1', 'key-2']);
  });

  it('a retrying submission still dedupes double clicks', async () => {
    let calls = 0;
    const { send, submit } = setup(async () => { if (++calls === 1) throw retryable(); return 'ok'; });
    const a = submit({ a: 1 });
    await jest.advanceTimersByTimeAsync(10);
    const b = submit({ a: 1 });
    expect(b).toBe(a);
    await jest.advanceTimersByTimeAsync(200);
    await a;
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('supports a custom isRetryable', async () => {
    let calls = 0;
    const { send, submit } = setup(async () => { if (++calls === 1) throw Object.assign(new Error('x'), { status: 503 }); return 'ok'; }, { isRetryable: (e) => e.status >= 500 });
    const p = submit({});
    await jest.advanceTimersByTimeAsync(200);
    await expect(p).resolves.toBe('ok');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not leave timers behind after settling', async () => {
    const { submit } = setup(async () => 'ok');
    await submit({});
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

%% hints
- Keep a `Map<fingerprint, promise>` of in-flight submissions; the fingerprint is `JSON.stringify(payload)`.
- The retry loop is a plain `for (let attempt = 0; ; attempt++)` inside an async function, generating the key **once, before the loop**.
- Remove the map entry in `.finally(...)` — and store *that* promise in the map so callers who join late receive the same promise.
- Make sure the promise you store and return is the same object every caller sees (`expect(a).toBe(b)`).

%% solution
```js
const fallbackKey = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function createSubmitter(
  send,
  { generateKey = fallbackKey, retries = 2, retryDelayMs = 200, isRetryable = (err) => err?.retryable === true } = {},
) {
  const inFlight = new Map();

  return function submit(payload) {
    const fingerprint = JSON.stringify(payload);
    const existing = inFlight.get(fingerprint);
    if (existing) return existing;

    const idempotencyKey = generateKey();
    const run = async () => {
      for (let attempt = 0; ; attempt++) {
        try {
          return await send(payload, { idempotencyKey });
        } catch (err) {
          if (attempt >= retries || !isRetryable(err)) throw err;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    };

    const promise = run().finally(() => {
      inFlight.delete(fingerprint);
    });
    inFlight.set(fingerprint, promise);
    return promise;
  };
}
```

%% exercise prod-bet-slip-ui | Bet slip UI that tells the truth | 4 | tsx | react | BetSlip | 45
Build `<BetSlip selection placeBet />` for a single selection. `selection = { id, name, price }` (decimal odds; `price` can change over time as the parent feeds new values). `placeBet({ selectionId, price, stakeCents })` returns a promise for `{ betId }`, or rejects.

**Display:** the name, the **accepted** price (`2.00`), an input labelled **Stake** (dollars, e.g. `10.50`), and `Return: $25.00` = stake × accepted price (compute in integer cents, `Math.round`). A **Place bet** button, disabled unless the stake is > 0.

**Behaviour:**
- Clicking places the bet with the **accepted price** and the stake in **cents**. The button **immediately** becomes disabled and reads **Placing…**. Double clicks must not call `placeBet` twice.
- Success → `role="status"` reading `Bet placed (#<betId>)`; the stake input and button are disabled.
- **Price moved:** if the live `selection.price` differs from the accepted price — *or* `placeBet` rejects with `{ code: 'PRICE_CHANGED', newPrice }` — show a `role="alert"` reading `Price changed from 2.00 to 1.80` and an **Accept new price** button. While that is showing, the displayed price/return stay at the old accepted price and **Place bet is disabled**. Accepting adopts the new price (the user must then click Place bet again).
- Any other rejection → `role="alert"` `Could not place bet: <error.message>`; the button becomes enabled again so they can retry.
- No state updates after unmount.

%% starter
```tsx
import { useRef, useState } from 'react';

export interface Selection {
  id: string;
  name: string;
  price: number;
}

export interface PlaceBetRequest {
  selectionId: string;
  price: number;
  stakeCents: number;
}

interface Props {
  selection: Selection;
  placeBet: (req: PlaceBetRequest) => Promise<{ betId: string }>;
}

export function BetSlip({ selection, placeBet }: Props) {
  return null;
}
```

%% tests
```tsx
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const sel = { id: 's1', name: 'Arsenal to win', price: 2 };
const stake = () => screen.getByLabelText('Stake');
const placeBtn = () => screen.getByRole('button', { name: /Place bet|Placing…/ });
const type = (v: string) => userEvent.type(stake(), v);

describe('BetSlip', () => {
  it('shows the selection, accepted price and return', async () => {
    render(<BetSlip selection={sel} placeBet={jest.fn()} />);
    expect(screen.getByText('Arsenal to win')).toBeInTheDocument();
    expect(screen.getByText(/2\.00/)).toBeInTheDocument();
    expect(placeBtn()).toBeDisabled();
    await type('10.50');
    expect(screen.getByText('Return: $21.00')).toBeInTheDocument();
    expect(placeBtn()).toBeEnabled();
  });

  it('rounds the return in integer cents', async () => {
    render(<BetSlip selection={{ ...sel, price: 1.15 }} placeBet={jest.fn()} />);
    await type('3.33');
    expect(screen.getByText('Return: $3.83')).toBeInTheDocument();
  });

  it('keeps the button disabled for invalid or zero stakes', async () => {
    render(<BetSlip selection={sel} placeBet={jest.fn()} />);
    await type('abc');
    expect(placeBtn()).toBeDisabled();
    await userEvent.clear(stake());
    await type('0');
    expect(placeBtn()).toBeDisabled();
  });

  it('places the bet with the accepted price and stake in cents, showing Placing… immediately', async () => {
    const d = deferred<{ betId: string }>();
    const placeBet = jest.fn(() => d.promise);
    render(<BetSlip selection={sel} placeBet={placeBet} />);
    await type('10');
    await userEvent.click(placeBtn());
    expect(placeBet).toHaveBeenCalledWith({ selectionId: 's1', price: 2, stakeCents: 1000 });
    expect(placeBtn()).toHaveTextContent('Placing…');
    expect(placeBtn()).toBeDisabled();
    await act(async () => { d.resolve({ betId: 'B-42' }); });
  });

  it('ignores double clicks', async () => {
    const d = deferred<{ betId: string }>();
    const placeBet = jest.fn(() => d.promise);
    render(<BetSlip selection={sel} placeBet={placeBet} />);
    await type('10');
    const btn = placeBtn();
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(placeBet).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve({ betId: 'B-1' }); });
  });

  it('shows a confirmation and locks the form on success', async () => {
    const placeBet = jest.fn().mockResolvedValue({ betId: 'B-42' });
    render(<BetSlip selection={sel} placeBet={placeBet} />);
    await type('10');
    await userEvent.click(placeBtn());
    expect(await screen.findByRole('status')).toHaveTextContent('Bet placed (#B-42)');
    expect(stake()).toBeDisabled();
    expect(placeBtn()).toBeDisabled();
  });

  it('shows a price-change alert when the server rejects with PRICE_CHANGED, without silently switching price', async () => {
    const placeBet = jest.fn().mockRejectedValue({ code: 'PRICE_CHANGED', newPrice: 1.8 });
    render(<BetSlip selection={sel} placeBet={placeBet} />);
    await type('10');
    await userEvent.click(placeBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Price changed from 2.00 to 1.80');
    expect(screen.getByText('Return: $20.00')).toBeInTheDocument();
    expect(placeBtn()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Accept new price' })).toBeInTheDocument();
  });

  it('accepting the new price adopts it; the user must confirm again', async () => {
    const placeBet = jest.fn()
      .mockRejectedValueOnce({ code: 'PRICE_CHANGED', newPrice: 1.8 })
      .mockResolvedValueOnce({ betId: 'B-9' });
    render(<BetSlip selection={sel} placeBet={placeBet} />);
    await type('10');
    await userEvent.click(placeBtn());
    await userEvent.click(await screen.findByRole('button', { name: 'Accept new price' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Return: $18.00')).toBeInTheDocument();
    expect(placeBet).toHaveBeenCalledTimes(1);
    expect(placeBtn()).toBeEnabled();
    await userEvent.click(placeBtn());
    expect(placeBet).toHaveBeenLastCalledWith({ selectionId: 's1', price: 1.8, stakeCents: 1000 });
    expect(await screen.findByRole('status')).toHaveTextContent('Bet placed (#B-9)');
  });

  it('flags a live price change from the parent and blocks placing until accepted', async () => {
    const placeBet = jest.fn().mockResolvedValue({ betId: 'B-1' });
    const { rerender } = render(<BetSlip selection={sel} placeBet={placeBet} />);
    await type('10');
    rerender(<BetSlip selection={{ ...sel, price: 2.2 }} placeBet={placeBet} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Price changed from 2.00 to 2.20');
    expect(placeBtn()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Accept new price' }));
    expect(screen.getByText('Return: $22.00')).toBeInTheDocument();
    await userEvent.click(placeBtn());
    expect(placeBet).toHaveBeenCalledWith({ selectionId: 's1', price: 2.2, stakeCents: 1000 });
  });

  it('a live change that reverts to the accepted price clears the alert', async () => {
    const { rerender } = render(<BetSlip selection={sel} placeBet={jest.fn()} />);
    rerender(<BetSlip selection={{ ...sel, price: 2.5 }} placeBet={jest.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<BetSlip selection={sel} placeBet={jest.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows other errors and lets the user retry', async () => {
    const placeBet = jest.fn()
      .mockRejectedValueOnce(new Error('Selection suspended'))
      .mockResolvedValueOnce({ betId: 'B-3' });
    render(<BetSlip selection={sel} placeBet={placeBet} />);
    await type('5');
    await userEvent.click(placeBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not place bet: Selection suspended');
    expect(placeBtn()).toBeEnabled();
    await userEvent.click(placeBtn());
    expect(await screen.findByRole('status')).toHaveTextContent('Bet placed (#B-3)');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not update state after unmount', async () => {
    const errors = jest.spyOn(console, 'error');
    const d = deferred<{ betId: string }>();
    const { unmount } = render(<BetSlip selection={sel} placeBet={() => d.promise} />);
    await type('10');
    await userEvent.click(placeBtn());
    unmount();
    await act(async () => { d.resolve({ betId: 'B-1' }); });
    expect(errors).not.toHaveBeenCalled();
  });
});
```

%% hints
- Hold `acceptedPrice` in state (initially `selection.price`). A *pending* price can come from two places: a `PRICE_CHANGED` rejection (`serverPrice` state) or the **live prop changing**. React to the prop *changing*, not to a permanent mismatch: remember the last seen prop in state and, when it differs during render, `setLivePending(...)` (set-state-during-render is allowed for the same component). Otherwise accepting a server price while the parent hasn't caught up would re-trigger the alert forever.
- `pending = serverPrice ?? livePending`; `priceChanged = pending !== null && pending !== acceptedPrice` drives the alert, the disabled button, and the Accept button.
- In-flight guard: a `useRef(false)` — a `disabled` button alone can't stop two synchronous clicks, because the state update hasn't rendered yet.
- Stake: `Math.round(parseFloat(text) * 100)`; treat `NaN` as `0`.
- Track `alive` in a ref set to `false` in an effect cleanup and check it after `await`.

%% solution
```tsx
import { useEffect, useRef, useState } from 'react';

export interface Selection {
  id: string;
  name: string;
  price: number;
}

export interface PlaceBetRequest {
  selectionId: string;
  price: number;
  stakeCents: number;
}

interface Props {
  selection: Selection;
  placeBet: (req: PlaceBetRequest) => Promise<{ betId: string }>;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function BetSlip({ selection, placeBet }: Props) {
  const [stakeText, setStakeText] = useState('');
  const [acceptedPrice, setAcceptedPrice] = useState(selection.price);
  const [serverPrice, setServerPrice] = useState<number | null>(null);
  const [seenPropPrice, setSeenPropPrice] = useState(selection.price);
  const [livePending, setLivePending] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'placing' | 'placed' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [betId, setBetId] = useState('');
  const submitting = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const parsed = Math.round(parseFloat(stakeText) * 100);
  const stakeCents = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  // React to the live price *changing* (adjusting state while rendering is allowed for this component).
  if (selection.price !== seenPropPrice) {
    setSeenPropPrice(selection.price);
    setLivePending(selection.price === acceptedPrice ? null : selection.price);
  }

  const pending = serverPrice ?? livePending;
  const priceChanged = pending !== null && pending !== acceptedPrice;
  const locked = status === 'placing' || status === 'placed';
  const canPlace = !locked && !priceChanged && stakeCents > 0;

  const place = async () => {
    if (submitting.current || !canPlace) return;
    submitting.current = true;
    setStatus('placing');
    setMessage('');
    try {
      const res = await placeBet({ selectionId: selection.id, price: acceptedPrice, stakeCents });
      if (!alive.current) return;
      setBetId(res.betId);
      setStatus('placed');
    } catch (err) {
      if (!alive.current) return;
      const e = err as { code?: string; newPrice?: number; message?: string };
      if (e?.code === 'PRICE_CHANGED' && typeof e.newPrice === 'number') {
        setServerPrice(e.newPrice);
        setStatus('idle');
      } else {
        setMessage(e?.message ?? e?.code ?? 'Unknown error');
        setStatus('failed');
      }
    } finally {
      submitting.current = false;
    }
  };

  const accept = () => {
    if (pending === null) return;
    setAcceptedPrice(pending);
    setServerPrice(null);
    setLivePending(null);
  };

  return (
    <div>
      <h3>{selection.name}</h3>
      <p>Price: {acceptedPrice.toFixed(2)}</p>
      <label>
        Stake
        <input value={stakeText} onChange={(e) => setStakeText(e.target.value)} disabled={locked} />
      </label>
      <p>Return: {dollars(Math.round(stakeCents * acceptedPrice))}</p>

      {priceChanged && (
        <div role="alert">
          Price changed from {acceptedPrice.toFixed(2)} to {pending!.toFixed(2)}
          <button onClick={accept}>Accept new price</button>
        </div>
      )}
      {status === 'failed' && <p role="alert">Could not place bet: {message}</p>}
      {status === 'placed' && <p role="status">Bet placed (#{betId})</p>}

      <button onClick={place} disabled={!canPlace}>
        {status === 'placing' ? 'Placing…' : 'Place bet'}
      </button>
    </div>
  );
}
```
