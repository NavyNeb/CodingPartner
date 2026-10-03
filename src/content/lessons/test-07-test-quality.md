---
id: test-quality
track: test
title: Test quality: flaky, brittle and weak tests
summary: What makes a test suite trustworthy: removing flakiness, avoiding brittle implementation-coupled checks, why coverage can lie, and how mutation thinking finds the bugs your tests would miss.
---

## The idea in one sentence

A good test suite is **trustworthy**: red means a real bug, green means the behaviour is **actually checked**, and it survives refactors that don't change behaviour.

> **Analogy** A smoke alarm. One that goes off when you make toast gets its battery removed (flaky). One that never rings in a real fire is worse than none (weak). One that rings if you move the sofa (brittle) is just annoying. You want one that rings **exactly when there's fire**.

## Flaky tests

A **flaky** test sometimes passes and sometimes fails with no code change. Almost always the cause is something the test doesn't control.

![Causes of flakiness](fig:tst-flaky-causes "Each cause has the same cure: take control of the thing that varies.")

Flaky tests are corrosive: people re-run until green and stop reading failures, so real bugs slip through. **Never fix flakiness with a longer sleep.** Remove the cause.

## Brittle tests

A **brittle** test fails when you refactor without changing behaviour, because it checks **how** the code works rather than **what** it does.

![Brittle versus robust](fig:tst-brittle "Assert on what callers can observe, and the inside stays free to change.")

Typical culprits: reading private fields, asserting the exact order of internal calls, snapshotting huge outputs, and mocking every collaborator so the test just restates the implementation.

## Coverage can lie

**Line coverage** says which lines **ran**. It does not say anything was **checked**.

![Coverage versus mutation score](fig:tst-coverage-lie "A test with no assertions gives 100% coverage and catches nothing.")

```stepper Coverage versus checking
code:
  const isAdult = (age) => age >= 18;
  it('runs', () => { isAdult(30); });
  it('checks the edge', () => { expect(isAdult(18)).toBe(true); expect(isAdult(17)).toBe(false); });
---
line: 1
say: A tiny function with a **boundary**: `>=` versus `>` and `18` versus `17` are exactly the kinds of bug tests must catch.
mutants: age > 18, age >= 17, age >= 19
---
line: 2
say: This test **executes** `isAdult`, so line coverage is **100%**. But it asserts nothing, so every mutant above still passes. It would never notice a bug.
coverage: 100%
mutants killed: 0 of 3
---
line: 3
say: Now the boundary is checked from **both sides**: `18` must be adult, `17` must not. `age > 18` fails the first assertion, and `age >= 17` fails the second.
coverage: 100%
mutants killed: 3 of 3
```

**Mutation testing** automates exactly the question this lesson's exercises ask: change the code a little (a *mutant*), and see whether any test fails. A mutant that **survives** is a bug your tests would miss.

```js try predict
const isAdult = (age) => age >= 18;
const mutants = {
  'age > 18': (age) => age > 18,
  'age >= 17': (age) => age >= 17,
  'age >= 19': (age) => age >= 19,
};
const weakTest = (fn) => { fn(30); };                                   // runs it, asserts nothing
const goodTest = (fn) => { if (fn(18) !== true || fn(17) !== false) throw new Error('fail'); };

for (const [label, test] of [['weak', weakTest], ['good', goodTest]]) {
  const survivors = Object.entries(mutants).filter(([, m]) => { try { test(m); return true; } catch { return false; } });
  console.log(label, 'test: survivors =', survivors.map(([n]) => n));
}
```

## Common test smells

- **No assertions**, or assertions that can't fail (`expect(true).toBe(true)`).
- **Logic in tests** (loops and `if`s that recompute the answer): the test can have the same bug as the code.
- **Several behaviours in one test**: a failure doesn't tell you what broke.
- **Shared mutable state** between tests, so order matters.
- **Typical values only**: no boundaries, no empty case, no error case.

## Quick check

```check
Q: A test passes on Monday and fails on Tuesday with no code change. What is it?
A) A brittle test
B) A flaky test, probably depending on the real date *
C) A coverage problem
D) A snapshot test
Why: Anything not controlled by the test, like the real clock, can make results vary.
---
Q: Your refactor didn't change behaviour but 12 tests broke. What does this suggest?
A) The refactor is wrong
B) The tests are brittle: they check internals instead of behaviour *
C) You need more coverage
D) Jest is broken
Why: Tests should fail when behaviour changes, not when the implementation is rearranged.
---
Q: A suite has 100% line coverage. What can you conclude?
A) Every behaviour is checked
B) Every line ran at least once; nothing about whether it was checked *
C) No bugs exist
D) The tests are fast
Why: Coverage measures execution, not verification.
---
Q: What does a surviving mutant tell you?
A) The code is perfect
B) A change in behaviour went unnoticed: a missing or weak test *
C) The mutant is wrong
D) The tests are too many
Why: If altering the code doesn't fail any test, nothing was checking that behaviour.
---
Q: What is the right fix for a test that fails now and then because of timing?
A) Add a longer sleep
B) Control time with fake timers or an injected clock *
C) Retry until it passes
D) Delete it
Why: Remove the source of variation instead of hiding it.
```

## Recap

- **Flaky** = uncontrolled time, randomness, shared state, order, or un-awaited async. Cure the cause.
- **Brittle** = tests tied to internals. Assert on observable behaviour.
- **Coverage ≠ checking.** Ask "would a bug here fail a test?"
- **Mutation thinking**: change the code slightly and see whether your tests notice.
- Test **both sides of every boundary**, plus empty, one and error cases.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a testable stopwatch | An injected `clock`, `getTime()` |
| Make a token factory deterministic | Injected `clock` and `random`; base-36 formatting |
| Tests for shipping | The boundaries at 50 (free) and 10 kg (surcharge) from both sides |
| Tests for paginate | Last-page, exact-division, empty and invalid cases; do not mutate input |
| Tests for getUserName | An async check with a spy api: missing, failing and normal users |

%% exercise tst-guided-stopwatch | Guided: a testable stopwatch | 1 | js | js | createStopwatch | 8 | guided
Implement `createStopwatch({ clock })`. `clock.now()` returns a `Date`. The stopwatch has:

- `start()` remembers the current time,
- `elapsed()` returns the **milliseconds** since `start()`,
- `elapsed()` before `start()` throws an `Error('not started')`.

```js
const sw = createStopwatch({ clock });
sw.start();
// ...later
sw.elapsed(); // 1500
```

%% worked
**A similar problem, solved: `createAge({ clock })`** — measures how old something is using an injected clock.

```js
function createAge({ clock }) {
  const born = clock.now().getTime();                 // ① read the injected clock once, at creation
  return { years: () => (clock.now().getTime() - born) / 31557600000 };   // ② and again on demand
}
```

Never call `new Date()` directly in the code: the test supplies a clock that returns whatever time it wants, so the result is the same on every machine and every run.

%% explain
- **`start`** stores `clock.now().getTime()`.
- **`elapsed`** subtracts it from the current time.
- **Before start** it throws `Error('not started')`.

%% nudge
- What number do you get from a `Date`?
- What should `elapsed()` do when `start()` was never called?

%% starter
```js
export function createStopwatch({ clock }) {
  return {
    start() {
      // remember the time
    },
    elapsed() {
      return -1;
    },
  };
}
```

%% tests
```js
const makeClock = (ms = 0) => {
  const state = { ms };
  return { now: () => new Date(state.ms), set: (v) => { state.ms = v; }, tick: (d) => { state.ms += d; } };
};

describe('createStopwatch', () => {
  it('measures elapsed milliseconds', () => {
    const clock = makeClock(1000);
    const sw = createStopwatch({ clock });
    sw.start();
    clock.tick(1500);
    expect(sw.elapsed()).toBe(1500);
  });
  it('is zero straight after start', () => {
    const sw = createStopwatch({ clock: makeClock(5) });
    sw.start();
    expect(sw.elapsed()).toBe(0);
  });
  it('keeps measuring from the start', () => {
    const clock = makeClock(0);
    const sw = createStopwatch({ clock });
    sw.start();
    clock.tick(10);
    expect(sw.elapsed()).toBe(10);
    clock.tick(5);
    expect(sw.elapsed()).toBe(15);
  });
  it('restarts when started again', () => {
    const clock = makeClock(0);
    const sw = createStopwatch({ clock });
    sw.start();
    clock.tick(100);
    sw.start();
    clock.tick(7);
    expect(sw.elapsed()).toBe(7);
  });
  it('throws before start', () => {
    expect(() => createStopwatch({ clock: makeClock() }).elapsed()).toThrow('not started');
  });
});
```

%% hints
- `let startedAt = null;`
- `start() { startedAt = clock.now().getTime(); }`
- `elapsed() { if (startedAt === null) throw new Error('not started'); return clock.now().getTime() - startedAt; }`

%% solution
```js
export function createStopwatch({ clock }) {
  let startedAt = null;
  return {
    start() {
      startedAt = clock.now().getTime();
    },
    elapsed() {
      if (startedAt === null) throw new Error('not started');
      return clock.now().getTime() - startedAt;
    },
  };
}
```

%% exercise tst-token-factory | Make a token factory deterministic | 3 | js | js | createTokenFactory | 20
Implement `createTokenFactory({ clock, random })`, where `clock.now()` returns a `Date` and `random()` returns a number in `[0, 1)`.

- `create()` returns `TIME-RAND` where `TIME` is `clock.now().getTime().toString(36)` and `RAND` is `Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0')`.
- `isFresh(token, ttlMs)` is `true` when the token's age (current time minus the time encoded in the token) is `>= 0` and **less than** `ttlMs`. A token that is malformed (no `-`, or an unreadable time) is **not** fresh.

```js
createTokenFactory({ clock, random }).create(); // 'lte78740-i000' when random() is 0.5
```

%% worked
**A similar problem, solved: `createStamp({ clock, random })`** — a stamp built from time and randomness, all injected.

```js
function createStamp({ clock, random }) {
  return {
    make() {
      const t = clock.now().getTime().toString(36);              // ① time comes from the clock
      const r = Math.floor(random() * 1296).toString(36);        // ② randomness comes from random()
      return t + '.' + r;
    },
  };
}
```

With a fixed clock and a fixed `random`, the output is a known constant that a test can compare against, and `isFresh` can be tested by moving the fake clock forward.

%% explain
- **Format**: base-36 time, a dash, four base-36 random characters padded with zeros.
- **Freshness**: `0 <= age < ttlMs`.
- **Malformed tokens** are never fresh.

%% nudge
- Which two values make `create()` non-deterministic, and how do you take them in?
- What does `parseInt(text, 36)` give for an unreadable string?

%% starter
```js
export function createTokenFactory({ clock, random }) {
  return {
    create() {
      return '';
    },
    isFresh(token, ttlMs) {
      return false;
    },
  };
}
```

%% tests
```js
const makeClock = (iso) => {
  const state = { ms: new Date(iso).getTime() };
  return { now: () => new Date(state.ms), tick: (d) => { state.ms += d; } };
};

describe('createTokenFactory', () => {
  it('builds time-random tokens', () => {
    const clock = makeClock('2024-03-05T10:00:00Z');
    expect(createTokenFactory({ clock, random: () => 0.5 }).create()).toBe('lte78740-i000');
    expect(createTokenFactory({ clock, random: () => 0 }).create()).toBe('lte78740-0000');
    expect(createTokenFactory({ clock, random: () => 0.999999 }).create()).toBe('lte78740-zzzy');
  });
  it('uses the current clock time on every call', () => {
    const clock = makeClock('2024-03-05T10:00:00Z');
    const factory = createTokenFactory({ clock, random: () => 0 });
    clock.tick(5000);
    expect(factory.create()).toBe('lte78ayw-0000');
  });
  it('is fresh within the ttl and stale at it', () => {
    const clock = makeClock('2024-03-05T10:00:00Z');
    const factory = createTokenFactory({ clock, random: () => 0 });
    const token = factory.create();
    expect(factory.isFresh(token, 1000)).toBe(true);
    clock.tick(999);
    expect(factory.isFresh(token, 1000)).toBe(true);
    clock.tick(1);
    expect(factory.isFresh(token, 1000)).toBe(false);
  });
  it('rejects tokens from the future', () => {
    const clock = makeClock('2024-03-05T10:00:00Z');
    const factory = createTokenFactory({ clock, random: () => 0 });
    clock.tick(5000);
    const future = factory.create();
    const early = makeClock('2024-03-05T10:00:00Z');
    expect(createTokenFactory({ clock: early, random: () => 0 }).isFresh(future, 100000)).toBe(false);
  });
  it('rejects malformed tokens', () => {
    const factory = createTokenFactory({ clock: makeClock('2024-03-05T10:00:00Z'), random: () => 0 });
    expect(factory.isFresh('nonsense', 1000)).toBe(false);
    expect(factory.isFresh('', 1000)).toBe(false);
    expect(factory.isFresh('!!!-0000', 1000)).toBe(false);
  });
});
```

%% hints
- `const time = clock.now().getTime().toString(36); const rand = Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0'); return `${time}-${rand}`;`
- `isFresh`: `const [t] = token.split('-'); if (!token.includes('-')) return false; const created = parseInt(t, 36); if (Number.isNaN(created)) return false;`
- `const age = clock.now().getTime() - created; return age >= 0 && age < ttlMs;`

%% solution
```js
export function createTokenFactory({ clock, random }) {
  return {
    create() {
      const time = clock.now().getTime().toString(36);
      const rand = Math.floor(random() * 36 ** 4).toString(36).padStart(4, '0');
      return `${time}-${rand}`;
    },
    isFresh(token, ttlMs) {
      if (typeof token !== 'string' || !token.includes('-')) return false;
      const created = parseInt(token.split('-')[0], 36);
      if (Number.isNaN(created)) return false;
      const age = clock.now().getTime() - created;
      return age >= 0 && age < ttlMs;
    },
  };
}
```

%% exercise tst-check-shipping | Tests for shipping | 4 | js | js | checkShipping | 28
`shipping(subtotal, weightKg)` returns a price rounded to 2 decimals: the **base** is `5.99`, but it is **free from a subtotal of 50** (50 itself is free); **above 10 kg** each started extra kilo costs `2` (`Math.ceil(weightKg - 10) * 2`). Weight surcharges apply **even when the base is free**. Write `checkShipping(shipping)` that passes for a correct one and **fails** for: **free only above 50**, **free from 49**, **rounds extra kilos down**, **rounds extra kilos to nearest**, **charges 3 per extra kilo**, **base is 4.99**, **no surcharge on free orders**, **no base when heavy**.

```js
expect(shipping(20, 5)).toBe(5.99);
```

%% worked
**A similar problem, solved: `checkDelivery(delivery)`** — pairs of values on **both sides** of each rule.

```js
export function checkDelivery(delivery) {     // free over 30, 4 extra per started kilo above 5
  expect(delivery(29.99, 1)).toBe(3);         // ① just below the free threshold
  expect(delivery(30, 1)).toBe(0);            // ② exactly at it
  expect(delivery(10, 5)).toBe(3);            // ③ weight exactly at the limit: no surcharge
  expect(delivery(10, 5.2)).toBe(7);          // ④ a small excess still costs a whole step (ceil)
  expect(delivery(40, 7)).toBe(8);            // ⑤ the surcharge applies even when the base is free
}
```

Each assertion is chosen to **kill a particular mutant**. Ask of every line: *which wrong version fails here?* If you can't name one, the line adds nothing.

%% explain
- **Subtotal**: `49.99` pays, `50` is free.
- **Weight**: `10` has no surcharge; `10.01` pays for one kilo; `10.5` for one; `12` for two.
- **Free order, heavy parcel**: surcharge only.
- **Paying order, heavy parcel**: base plus surcharge.

%% nudge
- Which inputs separate `ceil` from `floor` and from `round`?
- Which input shows that the base is dropped for heavy parcels (or the surcharge for free ones)?

%% starter
```js
export function checkShipping(shipping) {
  expect(shipping(20, 5)).toBe(5.99);
  // your assertions: both sides of 50, weight steps above 10 kg, combinations
}
```

%% tests
```js
const round2 = (x) => Math.round(x * 100) / 100;
const make = ({ freeFrom = 50, inclusive = true, round = 'ceil', rate = 2, base = 5.99, surchargeOnFree = true, baseWhenHeavy = true } = {}) => (subtotal, kg) => {
  const free = inclusive ? subtotal >= freeFrom : subtotal > freeFrom;
  const over = Math.max(0, kg - 10);
  const kilos = round === 'ceil' ? Math.ceil(over) : round === 'floor' ? Math.floor(over) : Math.round(over);
  const extra = kilos * rate;
  const b = free || (!baseWhenHeavy && over > 0) ? 0 : base;
  return round2(b + (free && !surchargeOnFree ? 0 : extra));
};
const correct = make();
const mutants = {
  'is free only above 50': make({ inclusive: false }),
  'is free from 49': make({ freeFrom: 49 }),
  'rounds extra kilos down': make({ round: 'floor' }),
  'rounds extra kilos to the nearest': make({ round: 'round' }),
  'charges 3 per extra kilo': make({ rate: 3 }),
  'has a base of 4.99': make({ base: 4.99 }),
  'skips the surcharge on free orders': make({ surchargeOnFree: false }),
  'drops the base when heavy': make({ baseWhenHeavy: false }),
};

describe('your checkShipping', () => {
  it('passes on a correct shipping function', () => {
    expect(() => checkShipping(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a shipping function that ${name}`, () => {
      expect(() => checkShipping(impl)).toThrow();
    });
  }
});
```

%% hints
- Free threshold: `shipping(49.99, 5)` is `5.99`, `shipping(50, 5)` is `0`.
- Weight: `shipping(20, 10)` is `5.99`, `shipping(20, 10.01)` is `7.99`, `shipping(20, 10.5)` is `7.99`, `shipping(20, 12)` is `9.99`.
- Heavy and free: `shipping(60, 12)` is `4`.

%% solution
```js
export function checkShipping(shipping) {
  expect(shipping(20, 5)).toBe(5.99);
  expect(shipping(49.99, 5)).toBe(5.99);
  expect(shipping(50, 5)).toBe(0);
  expect(shipping(20, 10)).toBe(5.99);
  expect(shipping(20, 10.01)).toBe(7.99);
  expect(shipping(20, 10.4)).toBe(7.99);
  expect(shipping(20, 12)).toBe(9.99);
  expect(shipping(60, 12)).toBe(4);
  expect(shipping(60, 10)).toBe(0);
}
```

%% exercise tst-check-paginate | Tests for paginate | 4 | js | js | checkPaginate | 30
`paginate(items, page, size)` (pages start at **1**) returns `{ items, page, pages, hasNext }`: `items` is that page's slice, `pages = Math.ceil(items.length / size)`, `hasNext = page < pages`. A page **past the end** returns no items. `page` or `size` that is not an integer ≥ 1 throws a `RangeError`. The input array must **not be modified**. Write `checkPaginate(paginate)` that passes for a correct one and **fails** for: **starts one item late**, **rounds the page count down**, **hasNext true on the last page**, **hasNext false before the last page**, **drops the last item of each page**, **accepts page 0**, **accepts size 0**, **consumes the input array**.

```js
expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual({ items: [3, 4], page: 2, pages: 3, hasNext: true });
```

%% worked
**A similar problem, solved: `checkChunk(chunk)`** — a **partial last piece**, an **exact division**, an **empty** input and an **invalid** size.

```js
export function checkChunk(chunk) {           // chunk(items, size) → array of arrays
  expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);      // ① divides exactly
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);   // ② partial last chunk
  expect(chunk([], 3)).toEqual([]);                              // ③ empty input
  expect(() => chunk([1], 0)).toThrow(RangeError);               // ④ invalid size
  const input = [1, 2, 3];
  chunk(input, 2);
  expect(input).toEqual([1, 2, 3]);                              // ⑤ the input was not modified
}
```

Beyond the happy path, list the **shapes of input**: *exact multiple*, *remainder*, *empty*, *one page*, *past the end*, *invalid*, *input untouched*.

%% explain
- **Pages**: the first, a middle one and the **partial last** one.
- **`pages`** for an exact multiple **and** a remainder (to catch `floor`).
- **`hasNext`** on a middle page and on the last.
- **Past the end**, **empty list**, **invalid page/size**.
- **Input unchanged** after calls.

%% nudge
- Which list lengths tell `ceil` from `floor`?
- How do you check that the input array wasn't changed?

%% starter
```js
export function checkPaginate(paginate) {
  expect(paginate([1, 2, 3, 4, 5], 1, 2)).toEqual({ items: [1, 2], page: 1, pages: 3, hasNext: true });
  // your assertions: middle, last (partial), past the end, empty, invalid, input untouched
}
```

%% tests
```js
const make = ({ startLate = false, floor = false, nextOnLast = false, nextEarly = false, dropLast = false, allowPage0 = false, allowSize0 = false, consume = false } = {}) => (items, page, size) => {
  if (!Number.isInteger(page) || (allowPage0 ? page < 0 : page < 1)) throw new RangeError('bad page');
  if (!Number.isInteger(size) || (allowSize0 ? size < 0 : size < 1)) throw new RangeError('bad size');
  const pages = size === 0 ? 0 : floor ? Math.floor(items.length / size) : Math.ceil(items.length / size);
  const start = (page - 1) * size + (startLate ? 1 : 0);
  const out = items.slice(Math.max(0, start), Math.max(0, start + size - (dropLast ? 1 : 0)));
  const hasNext = nextOnLast ? page <= pages : nextEarly ? page < pages - 1 : page < pages;
  if (consume) items.shift();
  return { items: out, page, pages, hasNext };
};
const correct = make();
const mutants = {
  'starts one item late': make({ startLate: true }),
  'rounds the page count down': make({ floor: true }),
  'says hasNext on the last page': make({ nextOnLast: true }),
  'says no hasNext before the last page': make({ nextEarly: true }),
  'drops the last item of each page': make({ dropLast: true }),
  'accepts page 0': make({ allowPage0: true }),
  'accepts size 0': make({ allowSize0: true }),
  'consumes the input array': make({ consume: true }),
};

describe('your checkPaginate', () => {
  it('passes on a correct paginate', () => {
    expect(() => checkPaginate(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a paginate that ${name}`, () => {
      expect(() => checkPaginate(impl)).toThrow();
    });
  }
});
```

%% hints
- Five items, size 2: page 1 `[1,2]` hasNext true; page 2 `[3,4]` hasNext true; page 3 `[5]` hasNext false, pages 3.
- Six items, size 3: `pages` is `2` (exact). Page 3 of 5 items/size 2 is `[5]`; page 4 is `[]`.
- `const before = [...items]; paginate(items, 1, 2); expect(items).toEqual(before);`

%% solution
```js
export function checkPaginate(paginate) {
  const five = [1, 2, 3, 4, 5];
  expect(paginate(five, 1, 2)).toEqual({ items: [1, 2], page: 1, pages: 3, hasNext: true });
  expect(paginate(five, 2, 2)).toEqual({ items: [3, 4], page: 2, pages: 3, hasNext: true });
  expect(paginate(five, 3, 2)).toEqual({ items: [5], page: 3, pages: 3, hasNext: false });
  expect(paginate(five, 4, 2)).toEqual({ items: [], page: 4, pages: 3, hasNext: false });
  expect(paginate([1, 2, 3, 4, 5, 6], 2, 3)).toEqual({ items: [4, 5, 6], page: 2, pages: 2, hasNext: false });
  expect(paginate([], 1, 3)).toEqual({ items: [], page: 1, pages: 0, hasNext: false });
  for (const [page, size] of [[0, 2], [1, 0], [-1, 2], [1, 1.5]]) {
    expect(() => paginate(five, page, size)).toThrow(RangeError);
  }
  const input = [1, 2, 3, 4, 5];
  paginate(input, 1, 2);
  paginate(input, 2, 2);
  expect(input).toEqual([1, 2, 3, 4, 5]);
}
```

%% exercise tst-check-get-user-name | Tests for getUserName | 4 | js | js | checkGetUserName | 26
`async getUserName(api, id)` calls `api.getUser(id)` **once** and returns the user's `name`. If the api returns `null` (no such user) or **rejects**, it returns `'Unknown user'` instead of throwing. Write an **async** `checkGetUserName(getUserName)` that passes for a correct one and **fails** for: **forgets to await**, **lets errors escape**, **returns undefined for a missing user**, **calls the api twice**, **passes the wrong id**, **returns the whole user object**.

```js
const api = { getUser: jest.fn(async (id) => ({ id, name: 'Ada' })) };
expect(await getUserName(api, 7)).toBe('Ada');
```

%% worked
**A similar problem, solved: `checkGetTitle(getTitle)`** — an async function, a spy collaborator, a failure path.

```js
export async function checkGetTitle(getTitle) {          // getTitle(api, id) → title, or 'Untitled' on any problem
  const api = { getPost: jest.fn(async (id) => ({ id, title: 'Hello' })) };
  expect(await getTitle(api, 3)).toBe('Hello');          // ① AWAIT the result, then compare
  expect(api.getPost).toHaveBeenCalledTimes(1);          // ② one call...
  expect(api.getPost).toHaveBeenCalledWith(3);           // ③ ...with the right argument
  const gone = { getPost: jest.fn(async () => null) };
  expect(await getTitle(gone, 3)).toBe('Untitled');      // ④ missing data
  const down = { getPost: jest.fn(async () => { throw new Error('down'); }) };
  expect(await getTitle(down, 3)).toBe('Untitled');      // ⑤ a rejected promise: the error must not escape
}
```

Notice every check **awaits** the call: an un-awaited promise compared to a string fails in a confusing way, or worse, passes. Test the **happy path, the empty result and the failure** of every collaborator.

%% explain
- **Normal user**: returns the **name**, `api.getUser` called **once** with the **id**.
- **`null` user**: `'Unknown user'`.
- **Rejecting api**: `'Unknown user'`, no exception.

%% nudge
- Which assertion catches a forgotten `await`?
- How do you make `api.getUser` reject on purpose?

%% starter
```js
export async function checkGetUserName(getUserName) {
  const api = { getUser: jest.fn(async (id) => ({ id, name: 'Ada' })) };
  expect(await getUserName(api, 7)).toBe('Ada');
  // your assertions: call count and argument, a missing user, a failing api
}
```

%% tests
```js
const make = ({ awaits = true, catches = true, nullMsg = 'Unknown user', twice = false, wrongId = false, whole = false } = {}) => async (api, id) => {
  try {
    const arg = wrongId ? id + 1 : id;
    const user = awaits ? await api.getUser(arg) : api.getUser(arg);
    if (twice) await api.getUser(arg);
    if (user == null) return nullMsg;
    return whole ? user : user.name;
  } catch (e) {
    if (catches) return 'Unknown user';
    throw e;
  }
};
const correct = make();
const mutants = {
  'forgets to await': make({ awaits: false }),
  'lets errors escape': make({ catches: false }),
  'returns undefined for a missing user': make({ nullMsg: null }),
  'calls the api twice': make({ twice: true }),
  'passes the wrong id': make({ wrongId: true }),
  'returns the whole user object': make({ whole: true }),
};

describe('your checkGetUserName', () => {
  it('passes on a correct getUserName', async () => {
    await checkGetUserName(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a getUserName that ${name}`, async () => {
      let caught = false;
      try { await checkGetUserName(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Normal: `expect(await getUserName(api, 7)).toBe('Ada')`, then `toHaveBeenCalledTimes(1)` and `toHaveBeenCalledWith(7)`.
- Missing: `{ getUser: jest.fn(async () => null) }` → `'Unknown user'`.
- Failing: `{ getUser: jest.fn(async () => { throw new Error('down'); }) }` → `'Unknown user'`.

%% solution
```js
export async function checkGetUserName(getUserName) {
  const api = { getUser: jest.fn(async (id) => ({ id, name: 'Ada' })) };
  expect(await getUserName(api, 7)).toBe('Ada');
  expect(api.getUser).toHaveBeenCalledTimes(1);
  expect(api.getUser).toHaveBeenCalledWith(7);

  const missing = { getUser: jest.fn(async () => null) };
  expect(await getUserName(missing, 1)).toBe('Unknown user');

  const broken = { getUser: jest.fn(async () => { throw new Error('down'); }) };
  expect(await getUserName(broken, 1)).toBe('Unknown user');
}
```
