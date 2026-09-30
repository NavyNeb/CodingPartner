---
id: prod-bet-placement
track: prod
title: Case study: the bet that moved
summary: The price changes between the tap and the submit, the network flakes, and a nervous user double-clicks. Model the slip as a state machine, make submits idempotent, and build a UI that tells the truth.
---

> **INCIDENT — a Tuesday, three complaints in one hour.**
>
> **Complaint A:** "I bet £50 at 2.10 and got 1.95." The client sent only *selection id + stake*; the server filled in whatever the price was **at that moment**.
>
> **Complaint B:** "I was charged twice." On a bad connection the first `POST /bets` timed out client-side but had succeeded server-side; the app's retry created a second bet.
>
> **Complaint C:** "The button did nothing." The UI waited for the response before showing any feedback, so users tapped again — and again.

When money is involved, each of those is a **correctness bug**, not a UX nit.

## The idea in one sentence

For anything involving money: **send exactly what the user agreed to, make every action safe to repeat, and never pretend to know something you don't.**

> **Analogy** Ordering at a counter. You say "one coffee **at this price**" (agreed price). The cashier gives you a **numbered ticket** for your order (idempotency key) — if you come back and show the same ticket, they hand over the *same* coffee rather than making a second. And while the barista works, they say "**making it now**" (progress) so you don't keep re-ordering.

## Principle 1 — Send what the user agreed to

The request must carry the **price the user saw** and their stake. The server **validates**: if the current price is *worse* than the agreed one, it rejects with a structured error (`409 PRICE_CHANGED { newPrice }`) instead of silently using a new price. (Whether *better* prices are auto-accepted is a product rule the **server** enforces — the client doesn't guess.)

## Principle 2 — Make the slip a state machine

The slip isn't "a few booleans" — it's a small **state machine** with explicit states and allowed moves:

![idle to placing to placed or failed, with flags that block placing](fig:bet-state-machine "The Place bet button is DERIVED from the state (canPlace), never from ad-hoc booleans.")

`idle → placing → placed | failed`, plus per-selection flags (`priceChanged`, `suspended`). Put the rules in a **pure reducer** so they're unit-testable (you met reducers in the React track):

```js try
function slipReducer(state, action) {
  switch (action.type) {
    case 'priceUpdate': {
      const changed = action.price !== state.acceptedPrice;
      return { ...state, price: action.price, priceChange: changed ? { from: state.acceptedPrice, to: action.price } : null };
    }
    case 'acceptChanges':
      return { ...state, acceptedPrice: state.price, priceChange: null };
    case 'placeStart':
      return canPlace(state) ? { ...state, status: 'placing' } : state;   // ← illegal moves are ignored
    default:
      return state;
  }
}
const canPlace = (s) => s.status === 'idle' && s.stake > 0 && !s.priceChange;

let s = { status: 'idle', stake: 1000, price: 2.1, acceptedPrice: 2.1, priceChange: null };
s = slipReducer(s, { type: 'priceUpdate', price: 1.95 });
console.log('can place after price move?', canPlace(s), s.priceChange);
s = slipReducer(s, { type: 'placeStart' });
console.log('status after trying to place:', s.status);        // still idle!
s = slipReducer(s, { type: 'acceptChanges' });
s = slipReducer(s, { type: 'placeStart' });
console.log('status after accepting:', s.status);
```

## Principle 3 — Money is integers

`0.1 + 0.2 !== 0.3` in floating point. Store **cents** (`stakeCents`), round **once** at a defined place, and format at the edge.

```js try
console.log(0.1 + 0.2);                            // 0.30000000000000004 — never do money maths like this
console.log(Math.round(0.1 * 100) + Math.round(0.2 * 100));   // 30  (cents)

const stakeCents = Math.round(10.5 * 100);         // $10.50 → 1050
const returnCents = Math.round(stakeCents * 2.35);  // ONE rounding step, at the boundary
console.log('return: $' + (returnCents / 100).toFixed(2));
```

## Principle 4 — Idempotency keys

Generate **one unique key per logical action** (*this bet*, not *this HTTP request*) and send it as a header. The server stores the outcome by key. A repeat with the same key returns the **original result** instead of acting again. So it's safe to retry after timeouts — **as long as every retry reuses the same key**. A *new* user action gets a *new* key.

![Client times out, retries with the same key, and the server returns the original bet](fig:idempotency-flow "One bet, even after a retry.")

```stepper A retry that reuses the key
code:
  async function submit(payload) {
    const key = generateKey();                          // ONE key per logical submission
    for (let attempt = 0; attempt <= retries; attempt++) {
      try { return await send(payload, { idempotencyKey: key }); }
      catch (err) { if (!retryable(err) || attempt === retries) throw err; await wait(200); }
    }
  }
---
line: 2
say: The user taps Place bet. We create **one** key for this action: `K1`.
Attempt: —
Key sent: K1 (created)
Server did:
---
line: 4
say: Attempt 0 sends the bet with `K1`. The server **places bet #42**, but the response is lost and our request times out.
Attempt: 0
Key sent: K1
Server did: placed bet #42 (response lost)
---
line: 5
say: A timeout is **not** a failure — we don't know. The error is retryable, so wait a moment and try again.
Attempt: 0 → waiting
---
line: 4
say: Attempt 1 sends the same bet with the **same key** `K1`. The server recognises it and returns bet **#42** again — it does **not** place a second one.
Attempt: 1
Key sent: K1 (same!)
Server did: seen K1 → returned bet #42
---
line: 4
say: The promise resolves with the original result. One bet placed. If each attempt had generated a *new* key, the customer would have been charged twice.
Attempt: done
Server did: bet #42 (exactly once)
```

## Principle 5 — Layer the double-click protection

![UI, code and server layers of duplicate-submit protection](fig:double-click-layers "Any one layer alone leaks.")

1. **UI:** disable the button and show `Placing…` **immediately** (optimistic *feedback* — not optimistic "Bet placed!").
2. **Code:** an **in-flight guard**. Use a **ref**, not state — a state update is asynchronous, so a fast second click can still see the old value.
3. **Server:** idempotency keys, so even a retry or a second tab can't double-place.

```js try
let sends = 0;
const send = () => new Promise((resolve) => { sends++; setTimeout(() => resolve({ betId: 42 }), 50); });

const inFlight = new Map();                      // payload → promise
function submit(payload) {
  const id = JSON.stringify(payload);
  if (inFlight.has(id)) return inFlight.get(id);          // a second click returns the SAME promise
  const p = send(payload).finally(() => inFlight.delete(id));
  inFlight.set(id, p);
  return p;
}

Promise.all([submit({ stake: 1000 }), submit({ stake: 1000 }), submit({ stake: 1000 })])
  .then(() => console.log('three clicks → send called', sends, 'time(s)'));
```

## Principle 6 — Respect the unknown

A timeout means *you don't know* whether the bet was placed. Never treat it as a failure and let the user start over. Retry with the **same key**, or query the bet's status by key, before offering another attempt.

## Optimistic vs pessimistic UI

- **Optimistic** (assume success, roll back on failure): great for likes, drafts, reordering. For money, use it only for the *feedback* (spinner, disabled button) — not for claiming "Bet placed!".
- **Pessimistic** (wait for confirmation): right for irreversible actions. Keep the wait short and honest.

## What to be able to say in an interview

- *How do you prevent double submission?* → disable + in-flight guard + idempotency key.
- *What if the response is lost?* → idempotent retry / status lookup.
- *What if the price changes mid-flow?* → send the agreed price; structured rejection; explicit re-accept.
- *Why not floats for money?* → binary floating-point error; use integer minor units.
- *Where does validation live?* → the server is authoritative; the client mirrors rules for UX.

## Quick check

```check
Q: Why should the bet request include the price the user saw?
A) To make the request larger
B) To cache the response
C) So the server can reject it if the price got worse, instead of silently using a new one *
D) Because HTTP requires it
Why: The user agreed to a price. The server compares it with the current one and rejects a worse price with a structured error.
---
Q: Why is the in-flight guard a ref rather than state?
A) Refs render faster
B) A ref updates instantly, while a state update may not be visible to the very next click yet *
C) State can't hold booleans
D) React forbids state in handlers
Why: State updates are batched and applied later; a fast second click could still read the old value. A ref changes immediately.
---
Q: A request times out. What should the client assume?
A) It failed
B) It succeeded
C) It can't know, so retry with the same idempotency key or check the status *
D) The user is offline
Why: The server may have processed it. Unknown ≠ failed.
---
Q: What should the client do when it retries after a timeout?
A) Generate a fresh idempotency key
B) Reuse the same key so the server can recognise the repeat *
C) Drop the key
D) Change the payload
Why: The key identifies the logical action. A new key would look like a brand-new bet.
---
Q: Why store stakes as integer cents?
A) Floating-point numbers can't represent values like 0.1 exactly, so errors creep in *
B) Integers are faster
C) JSON doesn't support decimals
D) Banks require it
Why: `0.1 + 0.2 !== 0.3`. Integer minor units avoid accumulating error; round once at a defined boundary.
```

## Recap

- **Send what the user agreed to**; let the **server** validate and reject worse prices.
- Model the slip as a **state machine** with a **pure reducer**; derive buttons from state (`canPlace`).
- **Money = integer cents**, rounded once.
- **Idempotency keys**: one per logical action, reused across retries.
- **Layered duplicate protection**: UI, in-flight guard (ref), server key.
- A **timeout means unknown** — retry safely or look up the status.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: money in cents | Principle 3 |
| Bet slip state machine | Principle 2: the reducer and `canPlace` snippet |
| Idempotent, double-click-proof submit | Principles 4 and 5: the stepper and the in-flight `Map` snippet |
| Bet slip UI that tells the truth | All of it: cents, agreed price, `Placing…`, price-changed alert, in-flight guard |

%% exercise prod-guided-cents | Guided: money in cents | 1 | js | js | toCents, returnCents, formatCents | 6 | guided
Three tiny helpers that keep money **out of floating point**.

- `toCents(dollars)` — convert dollars (a number like `10.5`, or a string like `'10.50'`) to **integer cents**, rounded: `10.5 → 1050`. Bad input (`NaN`, negative) → `0`.
- `returnCents(stakeCents, odds)` — the return on a bet, in cents, rounded **once**: `Math.round(stakeCents × odds)`.
- `formatCents(cents)` — `2505 → '$25.05'`.

%% worked
**A similar problem, solved: tax in cents.**

```js
function addTaxCents(amountCents, ratePercent) {
  const tax = Math.round((amountCents * ratePercent) / 100);   // ① multiply first, then ROUND ONCE at the end
  return amountCents + tax;                                     // ② integer + integer = integer (no float drift)
}

addTaxCents(1999, 7.5); // 1999 + 150 = 2149

function formatDollars(cents) {
  return '$' + (cents / 100).toFixed(2);                        // ③ only convert to dollars at the very edge, for display
}
```

Rules of thumb: keep money as **integer minor units** everywhere inside your code, **round once** at a clearly defined boundary, and convert to a display string only when you show it. `Math.round(10.5 * 100)` gives `1050`; a plain `10.1 * 100` gives `1009.9999999999999`, which is why you round.

%% explain
- **`toCents`** handles numbers and numeric strings, rounds to whole cents, and returns `0` for invalid or negative input.
- **`returnCents`** rounds exactly once.
- **`formatCents`** always shows two decimals with a `$`.

%% nudge
- Why does `10.1 * 100` need `Math.round`?
- At which point should you convert back to dollars?

%% starter
```js
export function toCents(dollars) {
  // Step 1 — turn the input into a number:   const n = Number(dollars);
  // Step 2 — invalid or negative → 0:         if (!Number.isFinite(n) || n < 0) return 0;
  // Step 3 — Math.round(n * 100)
  return 0;
}

export function returnCents(stakeCents, odds) {
  // Math.round(stakeCents * odds)
  return 0;
}

export function formatCents(cents) {
  // '$' + (cents / 100).toFixed(2)
  return '';
}
```

%% tests
```js
describe('money helpers', () => {
  it('converts dollars to cents', () => {
    expect(toCents(10.5)).toBe(1050);
    expect(toCents('10.50')).toBe(1050);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(10.1)).toBe(1010);
  });

  it('rejects bad input', () => {
    expect(toCents('abc')).toBe(0);
    expect(toCents(-5)).toBe(0);
    expect(toCents(NaN)).toBe(0);
  });

  it('computes the return, rounded once', () => {
    expect(returnCents(1000, 2.5)).toBe(2500);
    expect(returnCents(1050, 2.35)).toBe(2468);
  });

  it('formats cents as dollars', () => {
    expect(formatCents(2505)).toBe('$25.05');
    expect(formatCents(5)).toBe('$0.05');
    expect(formatCents(0)).toBe('$0.00');
  });
});
```

%% hints
- `Math.round(n * 100)` for `toCents`.
- `'$' + (cents / 100).toFixed(2)` for `formatCents`.

%% solution
```js
export function toCents(dollars) {
  const n = Number(dollars);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function returnCents(stakeCents, odds) {
  return Math.round(stakeCents * odds);
}

export function formatCents(cents) {
  return '$' + (cents / 100).toFixed(2);
}
```

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

%% worked
**A similar problem, solved: a reducer for a single input with validation and a state machine.**

```js
function uploadReducer(state, action) {
  switch (action.type) {
    case 'pick':
      return { ...state, file: action.file, error: null, status: 'idle' };
    case 'start':
      if (!state.file || state.status === 'uploading') return state;     // ① illegal move → return the SAME state
      return { ...state, status: 'uploading' };
    case 'done':
      if (state.status !== 'uploading') return state;                    // ② only valid from the right state
      return { ...state, status: 'done', file: null };
    default:
      return state;
  }
}
const canStart = (s) => !!s.file && s.status === 'idle';                 // ③ the BUTTON is derived from the state
```

The pattern for every action: **(1)** check the action is legal *in the current state*, otherwise return the same state; **(2)** return a **new** object with only what changed; **(3)** put derived decisions (`canPlace`) in a separate pure function.

For the slip: `priceUpdate` compares the new price to `acceptedPrice` (set `priceChange` when different, clear it when it moves **back**); `acceptChanges` maps over selections; `setStake` cleans the number (floor fractions, clamp negatives and non-finite values to 0); `placeStart` is guarded by `canPlace(state)`; `placeSuccess` only applies while `placing`. `totals` and `potentialReturn` use integer cents and round once.

%% explain
- **Actions**: `add` (ignore duplicates; returns to `idle` after `placed`), `remove`, `setStake` (integer cents ≥ 0), `priceUpdate`, `suspend`, `acceptChanges`, `placeStart` (only if `canPlace`), `placeSuccess`/failure transitions.
- **`priceUpdate`** sets `priceChange` when the price differs from `acceptedPrice` and clears it when it moves back; non-positive prices are ignored.
- **`canPlace`** is false while stakes are zero, a price change is pending, a selection is suspended, or already placing.
- **Money** stays in integer cents; `potentialReturn` rounds once.
- **Pure**: no mutation; illegal actions return the same state.

%% nudge
- For each action, in which states is it legal? What do you return when it isn't?
- How do you clean up `setStake` input (fractions, negatives, `NaN`)?

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

%% worked
**A similar problem, solved: `once(fn)` per argument** — the in-flight dedupe idea in its smallest form.

```js
function dedupeInFlight(fn) {
  const running = new Map();                            // argument-string → promise
  return function (arg) {
    const id = JSON.stringify(arg);
    if (running.has(id)) return running.get(id);        // ① a second call returns the SAME promise — fn is NOT called again
    const p = Promise.resolve(fn(arg)).finally(() => running.delete(id));   // ② forget it when it settles (success OR failure)
    running.set(id, p);
    return p;
  };
}
```

`createSubmitter` layers **retries** on top: inside the tracked promise, loop `attempt = 0 … retries`: `await send(payload, { idempotencyKey: key })` where `key` was generated **once, before the loop**; on an error, if `isRetryable(err)` and attempts remain, `await` a `retryDelayMs` delay and go again with the **same key**; otherwise rethrow. Because the forgetting happens in `finally`, the next submit of the same payload is a **new submission with a new key**.

%% explain
- **One key per logical submission** (`generateKey()` called once).
- **Equal payload while in flight** (`JSON.stringify`) → the **same promise**, `send` not called again.
- **Retryable errors** wait `retryDelayMs` and retry with the **same key**, up to `retries` extra attempts; non-retryable errors reject immediately; exhausted retries reject with the last error.
- **Settled submissions are forgotten**: the next identical payload is new, with a new key.
- **Different payloads** are independent.

%% nudge
- Where must `generateKey()` be called so all retries share it?
- When exactly is the in-flight entry removed?

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

%% worked
**A similar problem, solved: a "Send" button with an in-flight guard and honest states.**

```tsx
import { useRef, useState } from 'react';

export function SendButton({ send }: { send: () => Promise<{ id: string }> }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const busy = useRef(false);                                  // ① in-flight guard: a REF, updated instantly
  const mounted = useRef(true);                                //   (and remember to clear it on unmount)

  async function click() {
    if (busy.current) return;                                  // ② a fast second click does nothing
    busy.current = true;
    setState('sending');                                       // ③ immediate feedback: "Sending…" + disabled
    try {
      await send();
      if (mounted.current) setState('sent');
    } catch {
      if (mounted.current) setState('failed');                 // ④ allow a retry after a generic error
    } finally {
      busy.current = false;
    }
  }

  return <button disabled={state === 'sending' || state === 'sent'} onClick={click}>{state === 'sending' ? 'Sending…' : 'Send'}</button>;
}
```

For the slip add: **accepted price** in state (initially `selection.price`); a **price-changed** condition when `selection.price !== acceptedPrice` *or* `placeBet` rejects with `{ code: 'PRICE_CHANGED', newPrice }` — show the alert `Price changed from 2.00 to 1.80` plus **Accept new price** (which sets `acceptedPrice` to the new price); return in cents via `Math.round(stakeCents * acceptedPrice)` and format with `/ 100` and `toFixed(2)`; parse the stake input with `Math.round(Number(text) * 100)`. Send the **accepted** price and **cents** to `placeBet`.

%% explain
- **Display**: name, the **accepted** price (`2.00`), an input labelled `Stake` (dollars), and `Return: $25.00` (integer cents, `Math.round`). **Place bet** is disabled unless the stake is > 0.
- **Clicking** calls `placeBet({ selectionId, price: acceptedPrice, stakeCents })`; the button becomes `Placing…` and disabled **immediately**; double clicks don't call it twice.
- **Success**: `role="status"` `Bet placed (#<betId>)`; input and button disabled.
- **Price moved** (live price differs, or `PRICE_CHANGED`): `role="alert"` `Price changed from 2.00 to 1.80`, **Accept new price**; while showing, price/return stay old and **Place bet is disabled**.
- **Other errors**: `role="alert"` `Could not place bet: <message>`; button re-enabled.
- **No state updates after unmount.**

%% nudge
- Which value do you send to `placeBet` — the live price or the accepted one?
- What must be reset/kept when the user accepts the new price?

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
