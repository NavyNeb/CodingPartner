---
id: test-capstone
track: test
title: Capstone: test a whole system
summary: Putting it together: turn a specification into a full suite, choose what to test first, debug by writing a failing test, and write compact suites that still catch subtle bugs.
---

## The idea in one sentence

Given a **specification**, you can systematically produce a suite that fails for **every plausible bug**, and when something is already broken, a **failing test** is the fastest way to find and fix it.

> **Analogy** A building inspector with a checklist. They don't wander and hope: they go through every rule (wiring, exits, railings), check each at its **limit**, and note what would happen if a rule were broken. The checklist is the skill.

## From spec to suite

![A recipe for building a suite](fig:tst-suite-recipe "Six steps. The last one, inventing a broken version, is how you find what you missed.")

Take a rate limiter: *"allow at most `limit` calls per key in each window of `windowMs`; a window starts at a key's first call and ends `windowMs` later."*

- Rules: the **limit**, **per key**, the **window**.
- Boundaries: the call **at** the limit and **one over**; time **just before** and **exactly at** the window's end.
- Shapes: a **second key**; a **new window** after expiry.
- State: do **denied** calls disturb the window?

```stepper A rate limiter suite
code:
  let t = 0;
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, clock: { now: () => t } });
  expect(rl.allow('a')).toBe(true);
  expect(rl.allow('a')).toBe(true);
  expect(rl.allow('a')).toBe(false);
  expect(rl.allow('b')).toBe(true);
  t = 999;  expect(rl.allow('a')).toBe(false);
  t = 1000; expect(rl.allow('a')).toBe(true);
---
line: 1-2
say: A **fake clock** the test can move. Time is injected, so there is nothing to wait for.
time: 0 ms
---
line: 3-5
say: The **limit from both sides**: two calls allowed, the third refused. A limiter that allows `limit + 1`, or only `limit - 1`, fails here.
a: 2 of 2 used
---
line: 6
say: A **different key** has its own allowance. A limiter with one shared counter fails here.
b: 1 of 2 used
---
line: 7
say: **One tick before** the window ends, `a` is still blocked. A limiter that resets early fails here.
time: 999 ms
---
line: 8
say: **Exactly at** the end the window is over, so `a` is allowed again. A limiter that resets only *after* `windowMs`, or never, fails here.
time: 1000 ms
```

```js try predict
function createRateLimiter({ limit, windowMs, clock }) {
  const buckets = new Map();
  return {
    allow(key) {
      const now = clock.now();
      let b = buckets.get(key);
      if (!b || now - b.start >= windowMs) { b = { start: now, count: 0 }; buckets.set(key, b); }
      if (b.count >= limit) return false;
      b.count++;
      return true;
    },
  };
}
let t = 0;
const rl = createRateLimiter({ limit: 2, windowMs: 1000, clock: { now: () => t } });
const out = [];
for (const at of [0, 100, 200, 999, 1000, 1001, 1002]) { t = at; out.push(at + ':' + rl.allow('a')); }
console.log(out.join('  '));
```

## What to test first

You can't test everything equally. Spend effort where a bug would **hurt most** and is **most likely**.

![Risk map](fig:tst-risk-map "Money, permissions and data loss are at the top right.")

## Debugging with a failing test

When something is broken, resist poking around. **Reproduce it as a failing test**, shrink the input until the failure is obvious, fix, and keep the test.

![Debug loop](fig:tst-debug-loop "The test is a permanent, executable bug report.")

## Quick check

```check
Q: What is the first step of turning a spec into a suite?
A) Write the implementation
B) List every rule the spec states *
C) Aim for 100% coverage
D) Mock everything
Why: Each rule needs at least one test; a list makes sure none is forgotten.
---
Q: Why test a rate limiter at 999 ms and at 1000 ms with a 1000 ms window?
A) To make tests slower
B) The boundary decides whether the window has expired: both sides must be checked *
C) 999 is a special number
D) Fake clocks need two values
Why: Off-by-one bugs live exactly at boundaries.
---
Q: What do you do first when you find a bug?
A) Fix it immediately
B) Reproduce it as a small failing test *
C) Rewrite the module
D) Add logging everywhere
Why: A failing test proves you understand the bug and proves the fix later.
---
Q: Where should you invest the most testing effort?
A) The easiest code
B) Code that is likely to break and costly when it does *
C) Labels and colours
D) Getters
Why: Risk-based thinking: impact times likelihood.
---
Q: After writing a suite, what question finds its gaps?
A) How many lines did it cover?
B) Which broken version of the code would still pass? *
C) How long did it take?
D) How many tests are there?
Why: Inventing a mutant and checking that a test fails for it exposes weak spots.
```

## Recap

- **Spec → rules → boundaries → shapes → state**, then **hunt for surviving mutants**.
- Use **fake clocks and spies** so nothing waits and nothing is random.
- Spend effort by **risk**: likely and costly first.
- **Debug with a failing test**: reproduce, shrink, fix, keep.
- Small suites can be strong if **every assertion has a purpose**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a shopping cart | A `Map` of lines; summing price × quantity |
| Tests for a cart | Merging, removal, rounding, coupons and quantity validation |
| Tests for a rate limiter | A fake clock, per-key limits, both sides of the window edge |
| Fix the stats | Reproduce each bug with a tiny input, then fix |
| Tests for slugify | Case, runs of separators, edges, digits and empty input |

%% exercise tst-guided-cart | Guided: a shopping cart | 1 | js | js | createCart | 10 | guided
Implement `createCart()` with:

- `add(name, price, qty = 1)`: adds a line; adding the **same name** again **adds to its quantity** (the original price stays),
- `count()`: the total number of **units** across all lines,
- `total()`: the sum of `price * qty`, **rounded to 2 decimals**.

```js
const cart = createCart();
cart.add('apple', 2, 3);
cart.add('pear', 1.5);
cart.total(); // 7.5   cart.count(); // 4
```

%% worked
**A similar problem, solved: `createTally()`** — a `Map` of named lines with merging.

```js
function createTally() {
  const lines = new Map();
  return {
    add(name, qty = 1) {
      lines.set(name, (lines.get(name) ?? 0) + qty);       // ① same name: add to the existing amount
    },
    units() {
      let n = 0;
      for (const q of lines.values()) n += q;               // ② sum the quantities, not the number of lines
      return n;
    },
  };
}
```

A `Map` keyed by name gives merging for free. Remember to round money at the end: `0.1 * 3` is `0.30000000000000004`.

%% explain
- **A `Map`** from name to `{ price, qty }`.
- **Merging**: the same name adds to the quantity.
- **`count`** sums quantities; **`total`** sums price × qty, rounded.

%% nudge
- What is the difference between the number of lines and the number of units?
- How do you round to two decimals?

%% starter
```js
export function createCart() {
  const lines = new Map();
  return {
    add(name, price, qty = 1) {
      // your code
    },
    count() {
      return -1;
    },
    total() {
      return -1;
    },
  };
}
```

%% tests
```js
describe('createCart', () => {
  it('starts empty', () => {
    const cart = createCart();
    expect(cart.count()).toBe(0);
    expect(cart.total()).toBe(0);
  });
  it('totals price times quantity', () => {
    const cart = createCart();
    cart.add('apple', 2, 3);
    cart.add('pear', 1.5);
    expect(cart.total()).toBe(7.5);
    expect(cart.count()).toBe(4);
  });
  it('merges lines with the same name', () => {
    const cart = createCart();
    cart.add('apple', 2, 3);
    cart.add('apple', 2, 1);
    expect(cart.count()).toBe(4);
    expect(cart.total()).toBe(8);
  });
  it('rounds to two decimals', () => {
    const cart = createCart();
    cart.add('x', 0.1, 3);
    expect(cart.total()).toBe(0.3);
    cart.add('y', 0.07, 1);
    expect(cart.total()).toBe(0.37);
  });
});
```

%% hints
- `const line = lines.get(name); if (line) line.qty += qty; else lines.set(name, { price, qty });`
- `count`: loop over `lines.values()` and add `qty`.
- `total`: sum `price * qty`, then `Math.round(sum * 100) / 100`.

%% solution
```js
export function createCart() {
  const lines = new Map();
  return {
    add(name, price, qty = 1) {
      const line = lines.get(name);
      if (line) line.qty += qty;
      else lines.set(name, { price, qty });
    },
    count() {
      let n = 0;
      for (const line of lines.values()) n += line.qty;
      return n;
    },
    total() {
      let sum = 0;
      for (const line of lines.values()) sum += line.price * line.qty;
      return Math.round(sum * 100) / 100;
    },
  };
}
```

%% exercise tst-check-cart | Tests for a whole cart | 4 | js | js | checkCart | 40
The full cart, created by `createCart()`:

- `add(name, price, qty = 1)`: same name **merges** quantities; `qty` must be an **integer ≥ 1** or a `RangeError` is thrown.
- `remove(name)`: removes the line and returns `true`, or returns `false` if there was no such line.
- `count()`: total **units**. `total()`: sum of `price * qty`, then the coupon, **rounded to 2 decimals**, never below `0`.
- `applyCoupon(code)`: `'SAVE10'` takes **10%** off the subtotal, `'FIVE'` takes **5** off. A **new coupon replaces** the old one. An unknown code throws `Error('invalid coupon')`.

Write `checkCart(createCart)` that passes for a correct cart and **fails** for: **lines aren't merged**, **count counts lines**, **total ignores quantity**, **SAVE10 gives 20%**, **FIVE can make the total negative**, **coupons stack**, **unknown coupons are accepted**, **quantity 0 is accepted**, **fractional quantity is accepted**, **remove says true when nothing was removed**, **totals aren't rounded**.

```js
const cart = createCart();
cart.add('apple', 2, 3);
expect(cart.total()).toBe(6);
```

%% worked
**A similar problem, solved: `checkWallet(createWallet)`** — a small stateful object: **sequence**, **limits**, **errors**, **state after errors**.

```js
export function checkWallet(createWallet) {     // deposit(n), withdraw(n) → boolean, balance()
  const w = createWallet();
  expect(w.balance()).toBe(0);                  // ① the initial state
  w.deposit(10);
  expect(w.withdraw(4)).toBe(true);
  expect(w.balance()).toBe(6);                  // ② state after a sequence
  expect(w.withdraw(7)).toBe(false);            // ③ one over the limit is refused...
  expect(w.balance()).toBe(6);                  // ④ ...and changes nothing
  expect(w.withdraw(6)).toBe(true);             // ⑤ exactly the limit is allowed
  expect(() => w.deposit(-1)).toThrow();        // ⑥ invalid input
}
```

For a stateful thing, test **a sequence**, check state **after refused or invalid** operations, and the **exact limit**. Use **fresh objects** for independent scenarios so one scenario's leftovers can't hide another's bug.

%% explain
- **Merging**: same name twice, then `remove` takes the whole line.
- **`count` vs lines**; **`total` with quantities**; **rounding** with `0.1 × 3`.
- **Coupons**: each one, replacement, the floor at `0`, the unknown code.
- **Validation**: `0`, `-1`, `1.5`; and `remove` returns `true`/`false`.

%% nudge
- Which sequence catches "lines aren't merged"? (Think about what `remove` does.)
- Which cart total makes `FIVE` go below zero?

%% starter
```js
export function checkCart(createCart) {
  const cart = createCart();
  expect(cart.total()).toBe(0);
  expect(cart.count()).toBe(0);
  // your assertions: totals, merging, remove, rounding, coupons, validation
}
```

%% tests
```js
const COUPONS = ['SAVE10', 'FIVE'];
const round2 = (x) => Math.round(x * 100) / 100;
const make = ({ merge = true, countLines = false, ignoreQty = false, pct = 0.1, negative = false, stack = false, unknownOk = false, zeroOk = false, fracOk = false, removeLies = false, round = true } = {}) => () => {
  const lines = [];
  let coupons = [];
  return {
    add(name, price, qty = 1) {
      const ok = fracOk ? qty > 0 : Number.isInteger(qty) && qty >= (zeroOk ? 0 : 1);
      if (!ok) throw new RangeError('bad quantity');
      const existing = merge && lines.find((l) => l.name === name);
      if (existing) existing.qty += qty;
      else lines.push({ name, price, qty });
    },
    remove(name) {
      const i = lines.findIndex((l) => l.name === name);
      if (i < 0) return removeLies;
      lines.splice(i, 1);
      return true;
    },
    count() {
      return countLines ? lines.length : lines.reduce((n, l) => n + l.qty, 0);
    },
    applyCoupon(code) {
      if (!COUPONS.includes(code)) {
        if (!unknownOk) throw new Error('invalid coupon');
        return;
      }
      if (stack) coupons.push(code); else coupons = [code];
    },
    total() {
      const sub = lines.reduce((s, l) => s + l.price * (ignoreQty ? 1 : l.qty), 0);
      let t = sub;
      for (const c of coupons) t -= c === 'SAVE10' ? sub * pct : 5;
      if (!negative) t = Math.max(0, t);
      return round ? round2(t) : t;
    },
  };
};
const correct = make();
const mutants = {
  'does not merge lines': make({ merge: false }),
  'counts lines instead of units': make({ countLines: true }),
  'ignores the quantity in the total': make({ ignoreQty: true }),
  'gives 20% for SAVE10': make({ pct: 0.2 }),
  'lets FIVE make the total negative': make({ negative: true }),
  'stacks coupons': make({ stack: true }),
  'accepts unknown coupons': make({ unknownOk: true }),
  'accepts quantity 0': make({ zeroOk: true }),
  'accepts fractional quantity': make({ fracOk: true }),
  'says true when remove removed nothing': make({ removeLies: true }),
  'does not round the total': make({ round: false }),
};

describe('your checkCart', () => {
  it('passes on a correct cart', () => {
    expect(() => checkCart(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a cart that ${name}`, () => {
      expect(() => checkCart(impl)).toThrow();
    });
  }
});
```

%% hints
- Sequence: `add('apple', 2, 3)`, `add('pear', 1.5)`, `add('apple', 2, 1)`: count `5`, total `9.5`. `remove('pear')` is `true`, then `false`; `remove('apple')` and the total is `0`.
- Rounding: a fresh cart, `add('x', 0.1, 3)`, total `0.3`.
- Coupons on a total of 20: `SAVE10` → `18`, then `FIVE` → `15` (replaces); on a total of 3, `FIVE` → `0`; `expect(() => cart.applyCoupon('NOPE')).toThrow()`.
- Validation: `add('a', 1, 0)`, `add('a', 1, -1)`, `add('a', 1, 1.5)` throw `RangeError`.

%% solution
```js
export function checkCart(createCart) {
  const cart = createCart();
  expect(cart.total()).toBe(0);
  expect(cart.count()).toBe(0);
  cart.add('apple', 2, 3);
  cart.add('pear', 1.5);
  expect(cart.total()).toBe(7.5);
  expect(cart.count()).toBe(4);
  cart.add('apple', 2, 1);
  expect(cart.count()).toBe(5);
  expect(cart.total()).toBe(9.5);
  expect(cart.remove('pear')).toBe(true);
  expect(cart.remove('pear')).toBe(false);
  expect(cart.total()).toBe(8);
  expect(cart.remove('apple')).toBe(true);
  expect(cart.total()).toBe(0);
  expect(cart.count()).toBe(0);

  const rounding = createCart();
  rounding.add('x', 0.1, 3);
  expect(rounding.total()).toBe(0.3);

  const coupons = createCart();
  coupons.add('a', 10, 2);
  coupons.applyCoupon('SAVE10');
  expect(coupons.total()).toBe(18);
  coupons.applyCoupon('FIVE');
  expect(coupons.total()).toBe(15);
  expect(() => coupons.applyCoupon('NOPE')).toThrow('invalid coupon');

  const small = createCart();
  small.add('b', 3);
  small.applyCoupon('FIVE');
  expect(small.total()).toBe(0);

  const bad = createCart();
  for (const qty of [0, -1, 1.5]) expect(() => bad.add('a', 1, qty)).toThrow(RangeError);
}
```

%% exercise tst-check-rate-limiter | Tests for a rate limiter | 4 | js | js | checkRateLimiter | 36
`createRateLimiter({ limit, windowMs, clock })`, with `clock.now()` returning **milliseconds**. `allow(key)` returns `true` if that key has made fewer than `limit` allowed calls in its current window, else `false`. A key's window starts at its **first** call and **ends `windowMs` later** (at exactly `start + windowMs` a new window begins). Each key has its **own** window. **Refused** calls change nothing. Write `checkRateLimiter(createRateLimiter)` with a fake clock that passes for a correct limiter and **fails** for: **allows one call too many**, **blocks one call too early**, **shares one counter between keys**, **never starts a new window**, **starts a new window one tick early**, **starts a new window one tick late**, **refused calls extend the window**, **a new window allows one call too few**.

```js
let t = 0;
const rl = createRateLimiter({ limit: 2, windowMs: 1000, clock: { now: () => t } });
```

%% worked
**A similar problem, solved: `checkCooldown(createCooldown)`** — a fake clock moved to **just before** and **exactly at** a boundary.

```js
export function checkCooldown(createCooldown) {      // ready() is false for 500 ms after use()
  let t = 0;
  const cd = createCooldown({ ms: 500, clock: { now: () => t } });
  expect(cd.ready()).toBe(true);                     // ① nothing used yet
  cd.use();
  t = 499; expect(cd.ready()).toBe(false);           // ② one tick before the end
  t = 500; expect(cd.ready()).toBe(true);            // ③ exactly at the end
}
```

Two points on a timeline are worth more than ten random ones: **just before** and **exactly at** the edge. Use a **fresh limiter** for a scenario that could be disturbed by earlier calls, such as "refused calls must not extend the window".

%% explain
- **Limit**: with `limit: 2`, calls 1 and 2 pass, 3 is refused.
- **Per key**: another key passes meanwhile.
- **Window edge**: refused at `windowMs - 1`, allowed at `windowMs`, and the **full limit** is available again.
- **Refused calls**: a fresh limiter, refused calls late in the window, and the window still ends on time.

%% nudge
- What times separate "starts a new window one tick early" from "one tick late"?
- How do you show a refused call didn't push the window back?

%% starter
```js
export function checkRateLimiter(createRateLimiter) {
  let t = 0;
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, clock: { now: () => t } });
  expect(rl.allow('a')).toBe(true);
  // your assertions: the limit, a second key, the window edge, refused calls
}
```

%% tests
```js
const make = ({ extra = 0, early = 0, shared = false, never = false, edge = 0, extend = false, startAt = 0 } = {}) =>
  ({ limit, windowMs, clock }) => {
    const buckets = new Map();
    return {
      allow(key) {
        const k = shared ? '*' : key;
        const now = clock.now();
        let b = buckets.get(k);
        const expired = b && now - b.start >= windowMs + edge;
        if (!b || (!never && expired)) { b = { start: now, count: startAt }; buckets.set(k, b); }
        if (b.count >= limit + extra - early) {
          if (extend) b.start = now;
          return false;
        }
        b.count++;
        return true;
      },
    };
  };
const correct = make();
const mutants = {
  'allows one call too many': make({ extra: 1 }),
  'blocks one call too early': make({ early: 1 }),
  'shares one counter between keys': make({ shared: true }),
  'never starts a new window': make({ never: true }),
  'starts a new window one tick early': make({ edge: -1 }),
  'starts a new window one tick late': make({ edge: 1 }),
  'lets refused calls extend the window': make({ extend: true }),
  'allows one call too few in a new window': make({ startAt: 1 }),
};

describe('your checkRateLimiter', () => {
  it('passes on a correct limiter', () => {
    expect(() => checkRateLimiter(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a limiter that ${name}`, () => {
      expect(() => checkRateLimiter(impl)).toThrow();
    });
  }
});
```

%% hints
- With `limit: 2, windowMs: 1000`: `allow('a')` true, true, false; `allow('b')` true.
- `t = 999`: `allow('a')` false. `t = 1000`: `allow('a')` true, true, false (a full new allowance).
- A fresh limiter: two calls at `t = 0`, refused at `t = 500` and `t = 900`, then at `t = 1000` allowed.

%% solution
```js
export function checkRateLimiter(createRateLimiter) {
  let t = 0;
  const rl = createRateLimiter({ limit: 2, windowMs: 1000, clock: { now: () => t } });
  expect(rl.allow('a')).toBe(true);
  expect(rl.allow('a')).toBe(true);
  expect(rl.allow('a')).toBe(false);
  expect(rl.allow('b')).toBe(true);
  t = 999;
  expect(rl.allow('a')).toBe(false);
  t = 1000;
  expect(rl.allow('a')).toBe(true);
  expect(rl.allow('a')).toBe(true);
  expect(rl.allow('a')).toBe(false);

  let u = 0;
  const fresh = createRateLimiter({ limit: 2, windowMs: 1000, clock: { now: () => u } });
  fresh.allow('k');
  fresh.allow('k');
  u = 500;
  expect(fresh.allow('k')).toBe(false);
  u = 900;
  expect(fresh.allow('k')).toBe(false);
  u = 1000;
  expect(fresh.allow('k')).toBe(true);
}
```

%% exercise tst-fix-stats | Fix the stats by testing | 3 | js | js | summaryStats | 18
`summaryStats(nums)` returns `{ min, max, mean, median }` for a **non-empty** array of numbers (it throws a `RangeError` for an empty one) and must **not modify** the array it is given. The starter contains **three bugs**. Find each by calling the function with a tiny input, spot what is wrong, and fix it.

```js
summaryStats([10, 9, 2]); // { min: 2, max: 10, mean: 7, median: 9 }
summaryStats([4, 1, 3, 2]); // { min: 1, max: 4, mean: 2.5, median: 2.5 }
```

%% worked
**A similar problem, solved: `range(nums)`** — reproduce, then fix.

```js
// BUGGY:  const sorted = nums.sort();   → [10, 9, 2].sort() is [10, 2, 9]: text order!
function range(nums) {
  const sorted = [...nums].sort((a, b) => a - b);    // ① copy first, and compare as numbers
  return sorted[sorted.length - 1] - sorted[0];
}
```

The method: try `[10, 9, 2]` and see the wrong answer, **shrink** the input until it is obvious, and fix the **cause**. Two lines of the starter share a hidden assumption. Look for **sorting**, **mutation** and the **middle of an even-length list**.

%% explain
- **Numeric sort** on a **copy**: `[...nums].sort((a, b) => a - b)`.
- **Median** of an even count is the **average of the two middle values**.
- **Empty** input throws `RangeError`.
- **The input is unchanged** afterwards.

%% nudge
- What does `[10, 9, 2].sort()` return?
- Which two elements make the median of `[1, 2, 3, 4]`?

%% starter
```js
export function summaryStats(nums) {
  if (nums.length === 0) throw new RangeError('empty');
  const sorted = nums.sort();
  const sum = sorted.reduce((a, n) => a + n, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted[mid];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median,
  };
}
```

%% tests
```js
describe('summaryStats', () => {
  it('sorts numerically', () => {
    expect(summaryStats([10, 9, 2])).toEqual({ min: 2, max: 10, mean: 7, median: 9 });
  });
  it('averages the middle pair for an even count', () => {
    expect(summaryStats([4, 1, 3, 2])).toEqual({ min: 1, max: 4, mean: 2.5, median: 2.5 });
  });
  it('handles one element', () => {
    expect(summaryStats([5])).toEqual({ min: 5, max: 5, mean: 5, median: 5 });
  });
  it('handles negatives and decimals', () => {
    expect(summaryStats([-1, 0.5, 3])).toEqual({ min: -1, max: 3, mean: 2.5 / 3, median: 0.5 });
  });
  it('does not modify its input', () => {
    const input = [3, 1, 2];
    summaryStats(input);
    expect(input).toEqual([3, 1, 2]);
    expect(() => summaryStats(Object.freeze([3, 1, 2]))).not.toThrow();
  });
  it('throws a RangeError for an empty array', () => {
    expect(() => summaryStats([])).toThrow(RangeError);
  });
});
```

%% hints
- Bug 1: `nums.sort()` sorts as text and **mutates**: use `[...nums].sort((a, b) => a - b)`.
- Bug 2: for an even length, `median = (sorted[mid - 1] + sorted[mid]) / 2`.

%% solution
```js
export function summaryStats(nums) {
  if (nums.length === 0) throw new RangeError('empty');
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = sorted.reduce((a, n) => a + n, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    median,
  };
}
```

%% exercise tst-check-slugify | Tests for slugify | 3 | js | js | checkSlugify | 24
`slugify(text)` makes URL-friendly text: it **lowercases**, replaces **each run** of characters other than `a–z` and `0–9` with a **single `-`**, and removes any `-` at the **start or end**. If nothing is left it returns `''`. Write a **compact** `checkSlugify(slugify)` that passes for a correct one and **fails** for: **doesn't lowercase**, **keeps leading and trailing dashes**, **doesn't collapse runs**, **removes digits**, **keeps underscores**, **uses underscores instead of dashes**, **replaces only the first separator**, **throws on an empty string**.

```js
expect(slugify('  Hello, World!  ')).toBe('hello-world');
```

%% worked
**A similar problem, solved: `checkSnake(toSnake)`** — a **table** where every row has a reason.

```js
export function checkSnake(toSnake) {                // 'Hello World' → 'hello_world'
  const rows = [
    ['Hello World', 'hello_world'],     // ① the basic case: case and separator
    ['a b c', 'a_b_c'],                 // ② more than one separator (catches "only the first")
    ['a   b', 'a_b'],                   // ③ a run collapses to one
    ['  a  ', 'a'],                     // ④ the edges are trimmed
    ['Route 66', 'route_66'],           // ⑤ digits survive
    ['', ''],                           // ⑥ empty in, empty out
  ];
  for (const [input, output] of rows) expect(toSnake(input)).toBe(output);
}
```

A table is a compact suite: one row per **reason**. Before adding a row, name the bug it catches.

%% explain
- **Lowercasing** and **digits** kept.
- **Runs collapse**; **every** separator is replaced, not just the first.
- **Edges** are trimmed; **empty** and **all-punctuation** inputs give `''`.
- **Underscores** are separators too.

%% nudge
- Which row has more than one separator, and which has a run of them?
- What input shows that `_` is a separator and not a kept character?

%% starter
```js
export function checkSlugify(slugify) {
  expect(slugify('Hello World')).toBe('hello-world');
  // your table: separators, runs, edges, digits, underscores, empty input
}
```

%% tests
```js
const make = ({ lower = true, trimEdges = true, collapse = true, digits = true, underscore = false, sep = '-', global = true, emptyThrows = false } = {}) => (text) => {
  if (emptyThrows && text === '') throw new Error('empty');
  const s = lower ? text.toLowerCase() : text;
  const allowed = (digits ? '0-9' : '') + 'a-z' + (lower ? '' : 'A-Z') + (underscore ? '_' : '');
  const re = new RegExp('[^' + allowed + ']' + (collapse ? '+' : ''), global ? 'g' : '');
  const out = s.replace(re, sep);
  return trimEdges ? out.replace(new RegExp('^' + sep + '+|' + sep + '+$', 'g'), '') : out;
};
const correct = make();
const mutants = {
  'does not lowercase': make({ lower: false }),
  'keeps leading and trailing dashes': make({ trimEdges: false }),
  'does not collapse runs': make({ collapse: false }),
  'removes digits': make({ digits: false }),
  'keeps underscores': make({ underscore: true }),
  'uses underscores instead of dashes': make({ sep: '_' }),
  'replaces only the first separator': make({ global: false }),
  'throws on an empty string': make({ emptyThrows: true }),
};

describe('your checkSlugify', () => {
  it('passes on a correct slugify', () => {
    expect(() => checkSlugify(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a slugify that ${name}`, () => {
      expect(() => checkSlugify(impl)).toThrow();
    });
  }
});
```

%% hints
- `['Hello World', 'hello-world']`, `['a b c', 'a-b-c']`, `['a   b', 'a-b']`, `['  padded  ', 'padded']`.
- `['Route 66', 'route-66']`, `['snake_case', 'snake-case']`, `['', '']`, `['!!!', '']`.

%% solution
```js
export function checkSlugify(slugify) {
  const rows = [
    ['Hello World', 'hello-world'],
    ['a b c', 'a-b-c'],
    ['a   b', 'a-b'],
    ['A--B', 'a-b'],
    ['  padded  ', 'padded'],
    ['Route 66', 'route-66'],
    ['snake_case', 'snake-case'],
    ['', ''],
    ['!!!', ''],
  ];
  for (const [input, output] of rows) expect(slugify(input)).toBe(output);
}
```
