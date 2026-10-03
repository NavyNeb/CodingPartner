---
id: test-tdd-testability
track: test
title: TDD & designing for testability
summary: Red, green, refactor with small katas; why hard-to-test code is usually badly shaped code; and the habits that fix it: inject time and randomness, keep a pure core inside a thin shell.
---

## The idea in one sentence

**Write a failing test first, make it pass the simplest way, then tidy up**; and when something is hard to test, treat that as a **design smell** and reshape the code.

> **Analogy** Building a bookshelf with a spirit level on every shelf. You don't build the whole thing and then check if it's straight; you check as you go, so a crooked shelf is found while it's cheap to fix.

## Red, green, refactor

![The TDD cycle](fig:tst-red-green "Tiny steps: each loop adds one behaviour, and the tests never stay red for long.")

1. **Red**: write one small test for behaviour that doesn't exist yet, and watch it **fail** (that proves the test can fail).
2. **Green**: write the **simplest** code that passes. Ugly is fine.
3. **Refactor**: improve names and structure while the tests stay green.

```stepper One loop of TDD
code:
  // RED: a test for the next behaviour
  it('adds two numbers', () => expect(add('1,2')).toBe(3));
  // GREEN: the simplest code that passes
  const add = (s) => s === '' ? 0 : s.split(',').reduce((a, n) => a + Number(n), 0);
  // REFACTOR: same behaviour, clearer code
---
line: 1-2
say: **Red.** Write the test first. Run it: it fails because `add` doesn't exist. A test that has never failed might not test anything.
tests: 1 failing
---
line: 3-4
say: **Green.** Write just enough code to pass. Don't build features no test asks for yet: the next test will drive them.
tests: 1 passing
---
line: 5
say: **Refactor.** With a passing test as a safety net, rename, extract and simplify. If the test turns red, undo the last tidy-up.
tests: 1 passing
```

TDD is not about the tests; it is about **small steps with fast feedback**, and about the tests ending up as a **specification** of what the code does.

## Hard to test means badly shaped

When a test is painful, look at the **code**. Usually it mixes **deciding** with **doing**: logic tangled up with the clock, the network, randomness.

![Where the world leaks in](fig:tst-nondeterminism "Each hidden dependency becomes a parameter. Production passes the real one; a test passes a controllable one.")

```js try predict
// Hard to test: the randomness is buried inside
const rollHidden = (sides) => 1 + Math.floor(Math.random() * sides);

// Easy to test: the randomness is a parameter
const roll = (sides, random = Math.random) => 1 + Math.floor(random() * sides);

console.log(roll(6, () => 0));      // the lowest possible roll
console.log(roll(6, () => 0.999));  // the highest
console.log(roll(6, () => 0.5));    // something in the middle
```

## A pure core inside a thin shell

Push decisions into **pure functions** (same input, same output, no side effects) and keep the code that touches the world as thin as possible.

![Functional core, imperative shell](fig:tst-core-shell "Test the core with plain values; test the shell with a few fakes.")

A function that fetches orders, summarises them and sends an email is hard to test. Split it: `summarize(orders)` is **pure** (test it with arrays), and the thin `run()` just fetches, calls `summarize`, and sends. Now almost every test is a one-line input and output.

## Quick check

```check
Q: In TDD, why watch the test fail first?
A) To waste time
B) It proves the test can fail, so a later pass means something *
C) The compiler requires it
D) Failing tests run faster
Why: A test that never failed might be checking nothing.
---
Q: What should the "green" step aim for?
A) The perfect design
B) The simplest code that makes the test pass *
C) Maximum performance
D) Adding extra features
Why: Refactoring comes next; keep each step small.
---
Q: A function calls `Math.random()` inside. What is the best way to make it testable?
A) Run the test many times
B) Accept a `random` function as a parameter, defaulting to `Math.random` *
C) Mock `Math` globally
D) Remove the randomness
Why: A parameter is a seam: tests pass a predictable function.
---
Q: What is a "pure" function?
A) One that never fails
B) One whose result depends only on its arguments and which has no side effects *
C) One with no parameters
D) One that returns a promise
Why: Pure functions are trivial to test: give inputs, check outputs.
---
Q: Where should most logic live for easy testing?
A) In the shell that talks to the network
B) In a pure core, with a thin shell around it *
C) In global variables
D) In event handlers
Why: The core needs no doubles; the shell needs only a few simple tests.
```

## Recap

- **TDD**: red (failing test), green (simplest code), refactor. Small steps, fast feedback.
- **Katas** are tiny problems to practise the loop on.
- **Hard to test** usually means **tangled concerns**: fix the design, not the test.
- **Inject** time, randomness, network and configuration as parameters.
- Keep a **pure core** and a **thin shell**; test the core with plain values.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: the string calculator, part one | `split`, `reduce`, `Number` |
| String calculator | Delimiters, a custom delimiter line, errors that list all negatives |
| Roman numerals | A value table and a greedy loop; parsing back |
| A testable dice roller | An injected `random`; validation |
| A daily report | A pure `summarize`, plus a shell with injected `getOrders`, `send` and `clock` |
| Tests for toRoman | A table of known values, the subtractive forms and the range limits |

%% exercise tst-guided-calc | Guided: the string calculator, part one | 1 | js | js | add | 8 | guided
Implement `add(numbers)` for the classic kata, first steps:

- `''` returns `0`,
- `'5'` returns `5`,
- numbers separated by commas are **summed**: `'1,2,3'` returns `6`.

```js
add('');      // 0
add('1,2,3'); // 6
```

%% worked
**A similar problem, solved: `average(csv)`** — split, convert, combine.

```js
function average(csv) {
  if (csv === '') return 0;                             // ① the first test you would write: the empty case
  const nums = csv.split(',').map(Number);              // ② pieces → numbers
  return nums.reduce((a, n) => a + n, 0) / nums.length; // ③ combine
}
```

In TDD you would write the `''` test, make it pass with `return 0`, then add `'5'`, then `'1,2'`, letting each test pull the code one small step forward.

%% explain
- **Empty string** is `0`.
- **Split on commas**, convert with `Number`, and **sum**.

%% nudge
- What does `''.split(',')` give? Why is the empty case special?
- Which array method combines many numbers into one?

%% starter
```js
export function add(numbers) {
  // Step 1 — if (numbers === '') return 0;
  // Step 2 — split on ',' and sum
  return -1;
}
```

%% tests
```js
describe('add', () => {
  it('returns 0 for an empty string', () => { expect(add('')).toBe(0); });
  it('returns a single number', () => { expect(add('5')).toBe(5); });
  it('adds two numbers', () => { expect(add('1,2')).toBe(3); });
  it('adds many numbers', () => { expect(add('1,2,3,4')).toBe(10); });
  it('handles larger values', () => { expect(add('10,200')).toBe(210); });
});
```

%% hints
- `if (numbers === '') return 0;`
- `return numbers.split(',').reduce((sum, n) => sum + Number(n), 0);`

%% solution
```js
export function add(numbers) {
  if (numbers === '') return 0;
  return numbers.split(',').reduce((sum, n) => sum + Number(n), 0);
}
```

%% exercise tst-string-calculator | String calculator | 3 | js | js | add | 20
Extend the kata. `add(input)`:

- `''` → `0`; numbers are separated by **commas or newlines**: `'1\n2,3'` → `6`.
- A **custom delimiter** line: `'//;\n1;2'` → `3` (the text between `//` and the first newline is the **only** delimiter).
- **Negative numbers** throw an `Error` with the message `negatives not allowed: ` followed by **all** the negatives, comma separated: `'1,-2,-3'` → `negatives not allowed: -2,-3`.
- Numbers **greater than 1000** are ignored: `'2,1001'` → `2` (1000 itself counts).

%% worked
**A similar problem, solved: `sumPositive(csv)`** — collect problems first, report them all, then compute.

```js
function sumPositive(csv) {
  const nums = csv.split(',').map(Number);
  const bad = nums.filter((n) => n < 0);                          // ① gather every offender
  if (bad.length) throw new Error('negative: ' + bad.join(','));  // ② report them all at once
  return nums.reduce((a, n) => a + n, 0);                         // ③ only then compute
}
```

Check negatives **before** dropping big numbers, so `'-5,2000'` still throws. Handle the custom delimiter line first: slice it off, then split what is left.

%% explain
- **Default delimiters**: `,` and newline.
- **`//X\n`** replaces them with `X`.
- **Negatives** are reported **all together**; checked on every number.
- **Over 1000** is ignored, **1000** is kept.

%% nudge
- How do you split on two different delimiters?
- Where in the flow should the negative check happen relative to the "ignore > 1000" filter?

%% starter
```js
export function add(input) {
  if (input === '') return 0;
  // handle an optional '//X\n' header, then split, check negatives, drop > 1000, sum
  return 0;
}
```

%% tests
```js
describe('add', () => {
  it('handles empty, one and many', () => {
    expect(add('')).toBe(0);
    expect(add('7')).toBe(7);
    expect(add('1,2,3')).toBe(6);
  });
  it('accepts newlines as delimiters', () => {
    expect(add('1\n2,3')).toBe(6);
    expect(add('4\n5\n6')).toBe(15);
  });
  it('supports a custom delimiter', () => {
    expect(add('//;\n1;2')).toBe(3);
    expect(add('//|\n1|2|3')).toBe(6);
    expect(add('//***\n1***2***3')).toBe(6);
  });
  it('rejects negatives and lists all of them', () => {
    expect(() => add('1,-2,-3')).toThrow('negatives not allowed: -2,-3');
    expect(() => add('-1')).toThrow('negatives not allowed: -1');
  });
  it('checks negatives before ignoring big numbers', () => {
    expect(() => add('-5,2000')).toThrow('negatives not allowed: -5');
  });
  it('ignores numbers above 1000 but keeps 1000', () => {
    expect(add('2,1001')).toBe(2);
    expect(add('1000,1')).toBe(1001);
    expect(add('1001')).toBe(0);
  });
});
```

%% hints
- Header: `if (text.startsWith('//')) { const nl = text.indexOf('\n'); delimiters = [text.slice(2, nl)]; text = text.slice(nl + 1); }`
- Split on each delimiter in turn: `let parts = [text]; for (const d of delimiters) parts = parts.flatMap((p) => p.split(d));`
- Then `Number`, check negatives, `filter((n) => n <= 1000)`, `reduce`.

%% solution
```js
export function add(input) {
  if (input === '') return 0;
  let text = input;
  let delimiters = [',', '\n'];
  if (text.startsWith('//')) {
    const nl = text.indexOf('\n');
    delimiters = [text.slice(2, nl)];
    text = text.slice(nl + 1);
  }
  let parts = [text];
  for (const d of delimiters) parts = parts.flatMap((p) => p.split(d));
  const nums = parts.map(Number);
  const negatives = nums.filter((n) => n < 0);
  if (negatives.length) throw new Error('negatives not allowed: ' + negatives.join(','));
  return nums.filter((n) => n <= 1000).reduce((a, n) => a + n, 0);
}
```

%% exercise tst-roman | Roman numerals | 3 | js | js | toRoman, fromRoman | 22
Implement both directions.

- `toRoman(n)` for integers **1 to 3999**: `4` → `'IV'`, `1994` → `'MCMXCIV'`. Anything else (0, 4000, negatives, non-integers) throws a `RangeError`.
- `fromRoman(s)` converts back: `'MCMXCIV'` → `1994`. An **empty** string or any character outside `IVXLCDM` throws an `Error`.

For every `n` from 1 to 3999, `fromRoman(toRoman(n))` must equal `n`.

%% worked
**A similar problem, solved: `toBinaryWords(n)`** — a greedy table, largest first.

```js
const TABLE = [[8, 'eight '], [4, 'four '], [2, 'two '], [1, 'one ']];
function toBinaryWords(n) {
  let out = '', rest = n;
  for (const [value, word] of TABLE) {       // ① biggest value first
    while (rest >= value) { out += word; rest -= value; }   // ② take it as often as it fits
  }
  return out.trim();
}
```

Roman numerals use the same trick with a table that **includes the subtractive pairs** (`900 → CM`, `400 → CD`, `90 → XC`, `40 → XL`, `9 → IX`, `4 → IV`) so the greedy loop produces them naturally.

%% explain
- **A table** from 1000 down to 1, with the subtractive pairs in place.
- **Greedy**: take each symbol as many times as fits.
- **`fromRoman`**: add each value, but **subtract** it when a larger symbol follows.
- **Errors**: `RangeError` for numbers, `Error` for bad strings.

%% nudge
- Which entries make `4` come out as `IV` instead of `IIII`?
- In `fromRoman`, how do you recognise a subtractive pair like `IX`?

%% starter
```js
export function toRoman(n) {
  // validate, then build from a table
  return '';
}

export function fromRoman(s) {
  // validate, then add or subtract each symbol
  return 0;
}
```

%% tests
```js
describe('toRoman', () => {
  it.each([
    [1, 'I'], [3, 'III'], [4, 'IV'], [5, 'V'], [9, 'IX'], [10, 'X'], [14, 'XIV'],
    [40, 'XL'], [49, 'XLIX'], [90, 'XC'], [400, 'CD'], [900, 'CM'],
    [1994, 'MCMXCIV'], [2024, 'MMXXIV'], [3999, 'MMMCMXCIX'],
  ])('%i is %s', (n, roman) => {
    expect(toRoman(n)).toBe(roman);
  });
  it('rejects values outside 1..3999 and non-integers', () => {
    for (const bad of [0, -1, 4000, 1.5, NaN]) expect(() => toRoman(bad)).toThrow(RangeError);
  });
});

describe('fromRoman', () => {
  it.each([['I', 1], ['IV', 4], ['IX', 9], ['XLII', 42], ['MCMXCIV', 1994], ['MMMCMXCIX', 3999]])(
    '%s is %i',
    (roman, n) => { expect(fromRoman(roman)).toBe(n); },
  );
  it('rejects empty and invalid strings', () => {
    expect(() => fromRoman('')).toThrow();
    expect(() => fromRoman('ABC')).toThrow();
  });
  it('round-trips every value', () => {
    for (let n = 1; n <= 3999; n++) {
      if (fromRoman(toRoman(n)) !== n) throw new Error('round trip failed for ' + n);
    }
  });
});
```

%% hints
- `const TABLE = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];`
- `fromRoman`: map symbols to values; for each index, `if (value < next) total -= value; else total += value;`

%% solution
```js
const TABLE = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];
const VALUES = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

export function toRoman(n) {
  if (!Number.isInteger(n) || n < 1 || n > 3999) throw new RangeError('out of range: ' + n);
  let out = '';
  let rest = n;
  for (const [value, symbol] of TABLE) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export function fromRoman(s) {
  if (typeof s !== 'string' || s === '' || /[^IVXLCDM]/.test(s)) throw new Error('invalid roman numeral');
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const value = VALUES[s[i]];
    const next = VALUES[s[i + 1]] || 0;
    total += value < next ? -value : value;
  }
  return total;
}
```

%% exercise tst-dice | A testable dice roller | 2 | js | js | createDice | 16
Make randomness a seam. `createDice({ random = Math.random } = {})` returns:

- `roll(sides)` → `1 + Math.floor(random() * sides)`. `sides` must be an **integer ≥ 2**, otherwise throw a `RangeError`.
- `rollMany(count, sides)` → an **array** of `count` rolls, in order.
- `rollAdvantage(sides)` → rolls **twice** and returns the **higher** result.

```js
const dice = createDice({ random: () => 0.5 });
dice.roll(6); // 4
```

%% worked
**A similar problem, solved: `createPicker({ random })`** — pick an item, with the random source injected.

```js
function createPicker({ random = Math.random } = {}) {
  return {
    pick(items) {
      if (items.length === 0) throw new RangeError('nothing to pick');
      return items[Math.floor(random() * items.length)];     // ① the only place randomness enters
    },
  };
}
```

A test passes `() => 0` to always get the first item and `() => 0.999` to get the last, so there is nothing random left to test.

%% explain
- **`roll`** maps `[0, 1)` onto `1..sides`.
- **`sides`** validated as an integer ≥ 2.
- **`rollMany`** calls `roll` `count` times.
- **`rollAdvantage`** calls `random` **twice** and takes the maximum.

%% nudge
- What does the formula give for `random() === 0`? For `0.999`?
- How many times should `random` be called for an advantage roll?

%% starter
```js
export function createDice({ random = Math.random } = {}) {
  return {
    roll(sides) {
      return 0;
    },
    rollMany(count, sides) {
      return [];
    },
    rollAdvantage(sides) {
      return 0;
    },
  };
}
```

%% tests
```js
const seq = (...values) => { let i = 0; return jest.fn(() => values[i++]); };

describe('createDice', () => {
  it('maps the random range onto 1..sides', () => {
    expect(createDice({ random: () => 0 }).roll(6)).toBe(1);
    expect(createDice({ random: () => 0.5 }).roll(6)).toBe(4);
    expect(createDice({ random: () => 0.999 }).roll(6)).toBe(6);
    expect(createDice({ random: () => 0.999 }).roll(20)).toBe(20);
  });
  it('validates sides', () => {
    const dice = createDice({ random: () => 0.5 });
    for (const bad of [0, 1, -3, 2.5, NaN]) expect(() => dice.roll(bad)).toThrow(RangeError);
    expect(dice.roll(2)).toBe(2);
  });
  it('rolls many times in order', () => {
    const random = seq(0, 0.5, 0.999);
    expect(createDice({ random }).rollMany(3, 6)).toEqual([1, 4, 6]);
    expect(random).toHaveBeenCalledTimes(3);
    expect(createDice({ random: () => 0 }).rollMany(0, 6)).toEqual([]);
  });
  it('advantage takes the higher of two rolls', () => {
    const random = seq(0.1, 0.9);
    expect(createDice({ random }).rollAdvantage(6)).toBe(6);
    expect(random).toHaveBeenCalledTimes(2);
    expect(createDice({ random: seq(0.9, 0.1) }).rollAdvantage(6)).toBe(6);
  });
  it('uses Math.random by default and stays in range', () => {
    const dice = createDice();
    for (let i = 0; i < 300; i++) {
      const r = dice.roll(6);
      if (!Number.isInteger(r) || r < 1 || r > 6) throw new Error('out of range: ' + r);
    }
  });
});
```

%% hints
- `const roll = (sides) => { if (!Number.isInteger(sides) || sides < 2) throw new RangeError('bad sides'); return 1 + Math.floor(random() * sides); };`
- `rollMany`: `Array.from({ length: count }, () => roll(sides))`.
- `rollAdvantage`: `Math.max(roll(sides), roll(sides))`.

%% solution
```js
export function createDice({ random = Math.random } = {}) {
  function roll(sides) {
    if (!Number.isInteger(sides) || sides < 2) throw new RangeError('sides must be an integer >= 2');
    return 1 + Math.floor(random() * sides);
  }
  return {
    roll,
    rollMany(count, sides) {
      return Array.from({ length: count }, () => roll(sides));
    },
    rollAdvantage(sides) {
      const a = roll(sides);
      const b = roll(sides);
      return Math.max(a, b);
    },
  };
}
```

%% exercise tst-daily-report | A daily report: core and shell | 3 | js | js | summarize, createDailyReport | 24
Build it as a **pure core plus a thin shell**.

- `summarize(orders)` is **pure**: for `[{ id, amount }]` it returns `{ count, total, biggest }` (`biggest` is the largest `amount`, `0` for no orders). It must **not mutate** its input.
- `createDailyReport({ getOrders, send, clock })` returns `{ run() }`. `run` is async: it computes the date `YYYY-MM-DD` as `clock.now().toISOString().slice(0, 10)`, awaits `getOrders(date)`, summarises, **sends** one message and returns the summary. The message is `Report for DATE: N orders, total T` (use `1 order` for one), or `Report for DATE: no orders` when there are none.

```js
await createDailyReport({ getOrders, send, clock }).run();
// send('Report for 2024-03-05: 3 orders, total 60')
```

%% worked
**A similar problem, solved: `stats(nums)` + `createStatsJob({ load, publish })`** — the pure part and the thin part.

```js
export function stats(nums) {                       // ① pure: arrays in, object out
  const total = nums.reduce((a, n) => a + n, 0);
  return { count: nums.length, total };
}

export function createStatsJob({ load, publish }) {
  return {
    async run() {
      const nums = await load();                    // ② the shell fetches...
      const s = stats(nums);                        // ③ ...delegates the thinking...
      await publish(`n=${s.count} sum=${s.total}`); // ④ ...and sends the result
      return s;
    },
  };
}
```

Hidden tests check `summarize` with plain arrays (no doubles at all), and `run` with a fake `getOrders`, a spy `send`, and a clock that returns a fixed date.

%% explain
- **`summarize`** is pure: no mutation, no clock.
- **`run`** fetches with the **date**, summarises, sends **one** message, returns the summary.
- **Message wording**: plural vs `1 order`; `no orders` for none.

%% nudge
- Which function should contain the arithmetic?
- What does the clock give you, and in which format is the date?

%% starter
```js
export function summarize(orders) {
  return { count: 0, total: 0, biggest: 0 };
}

export function createDailyReport({ getOrders, send, clock }) {
  return {
    async run() {
      // fetch, summarize, send, return the summary
    },
  };
}
```

%% tests
```js
describe('summarize (pure)', () => {
  it('counts, totals and finds the biggest', () => {
    expect(summarize([{ id: 1, amount: 10 }, { id: 2, amount: 40 }, { id: 3, amount: 10 }]))
      .toEqual({ count: 3, total: 60, biggest: 40 });
  });
  it('handles no orders', () => {
    expect(summarize([])).toEqual({ count: 0, total: 0, biggest: 0 });
  });
  it('does not mutate its input', () => {
    const orders = Object.freeze([Object.freeze({ id: 1, amount: 5 })]);
    expect(() => summarize(orders)).not.toThrow();
  });
});

describe('createDailyReport (shell)', () => {
  const clock = { now: () => new Date('2024-03-05T10:00:00Z') };
  it('fetches by date, sends one message, returns the summary', async () => {
    const getOrders = jest.fn(async () => [{ id: 1, amount: 10 }, { id: 2, amount: 50 }]);
    const send = jest.fn(async () => {});
    const result = await createDailyReport({ getOrders, send, clock }).run();
    expect(getOrders).toHaveBeenCalledWith('2024-03-05');
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('Report for 2024-03-05: 2 orders, total 60');
    expect(result).toEqual({ count: 2, total: 60, biggest: 50 });
  });
  it('says "1 order" for a single order', async () => {
    const send = jest.fn(async () => {});
    await createDailyReport({ getOrders: async () => [{ id: 1, amount: 7 }], send, clock }).run();
    expect(send).toHaveBeenCalledWith('Report for 2024-03-05: 1 order, total 7');
  });
  it('says "no orders" when there are none', async () => {
    const send = jest.fn(async () => {});
    await createDailyReport({ getOrders: async () => [], send, clock }).run();
    expect(send).toHaveBeenCalledWith('Report for 2024-03-05: no orders');
  });
  it('uses the injected clock for the date', async () => {
    const getOrders = jest.fn(async () => []);
    const other = { now: () => new Date('2025-12-31T23:00:00Z') };
    await createDailyReport({ getOrders, send: async () => {}, clock: other }).run();
    expect(getOrders).toHaveBeenCalledWith('2025-12-31');
  });
});
```

%% hints
- `const { count, total, biggest } = ...` via `Math.max(0, ...orders.map((o) => o.amount))`.
- `const date = clock.now().toISOString().slice(0, 10);`
- Message: `count === 0 ? ... : `${count} ${count === 1 ? 'order' : 'orders'}, total ${total}``.

%% solution
```js
export function summarize(orders) {
  return {
    count: orders.length,
    total: orders.reduce((sum, o) => sum + o.amount, 0),
    biggest: orders.reduce((max, o) => Math.max(max, o.amount), 0),
  };
}

export function createDailyReport({ getOrders, send, clock }) {
  return {
    async run() {
      const date = clock.now().toISOString().slice(0, 10);
      const orders = await getOrders(date);
      const summary = summarize(orders);
      const text = summary.count === 0
        ? `Report for ${date}: no orders`
        : `Report for ${date}: ${summary.count} ${summary.count === 1 ? 'order' : 'orders'}, total ${summary.total}`;
      await send(text);
      return summary;
    },
  };
}
```

%% exercise tst-check-roman | Tests for toRoman | 4 | js | js | checkToRoman | 28
`toRoman(n)` converts integers **1 to 3999** to Roman numerals using the subtractive forms (`4` is `IV`, `9` is `IX`, `40` is `XL`, `90` is `XC`, `400` is `CD`, `900` is `CM`), and throws a `RangeError` for anything outside the range or non-integers. Write `checkToRoman(toRoman)` that passes for a correct one and **fails** for: **no subtractive 4**, **no subtractive 9**, **no subtractive 40**, **no subtractive 90**, **no subtractive 400**, **no subtractive 900**, **accepts 0**, **accepts 4000**, **rejects 3999**, **accepts non-integers**.

```js
expect(toRoman(1994)).toBe('MCMXCIV');
```

%% worked
**A similar problem, solved: `checkToWords(toWords)`** — a small table plus the boundaries.

```js
export function checkToWords(toWords) {
  const table = [[1, 'one'], [9, 'nine'], [10, 'ten'], [11, 'eleven'], [99, 'ninety-nine']];   // ① values near each rule
  for (const [n, words] of table) expect(toWords(n)).toBe(words);
  expect(() => toWords(0)).toThrow(RangeError);       // ② just outside the lower bound
  expect(() => toWords(100)).toThrow(RangeError);     // ③ just outside the upper bound
  expect(() => toWords(1.5)).toThrow(RangeError);     // ④ a non-integer
}
```

Every **rule** in the function needs **a value that exercises it**: one per subtractive form, plus **both edges** of the range (1 and 3999 accepted; 0 and 4000 refused).

%% explain
- **A table** with a value for **each** subtractive pair (4, 9, 40, 90, 400, 900).
- **Both ends**: `1` and `3999` accepted.
- **Just outside**: `0`, `4000`, and a non-integer such as `1.5` throw `RangeError`.

%% nudge
- Which input shows that 400 is `CD` and not `CCCC`?
- Which two inputs catch a wrong upper bound in either direction?

%% starter
```js
export function checkToRoman(toRoman) {
  expect(toRoman(1)).toBe('I');
  // your assertions: each subtractive form, the limits, and invalid input
}
```

%% tests
```js
const TABLE = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const make = ({ drop = null, min = 1, max = 3999, integer = true } = {}) => (n) => {
  if ((integer && !Number.isInteger(n)) || n < min || n > max) throw new RangeError('out of range: ' + n);
  let out = '', rest = n;
  for (const [v, s] of TABLE.filter(([v]) => v !== drop)) {
    while (rest >= v) { out += s; rest -= v; }
  }
  return out;
};
const correct = make();
const mutants = {
  'has no subtractive 4': make({ drop: 4 }),
  'has no subtractive 9': make({ drop: 9 }),
  'has no subtractive 40': make({ drop: 40 }),
  'has no subtractive 90': make({ drop: 90 }),
  'has no subtractive 400': make({ drop: 400 }),
  'has no subtractive 900': make({ drop: 900 }),
  'accepts 0': make({ min: 0 }),
  'accepts 4000': make({ max: 4000 }),
  'rejects 3999': make({ max: 3998 }),
  'accepts non-integers': make({ integer: false }),
};

describe('your checkToRoman', () => {
  it('passes on a correct toRoman', () => {
    expect(() => checkToRoman(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a toRoman that ${name}`, () => {
      expect(() => checkToRoman(impl)).toThrow();
    });
  }
});
```

%% hints
- A table with `[4, 'IV'], [9, 'IX'], [40, 'XL'], [90, 'XC'], [400, 'CD'], [900, 'CM']`, plus `[1, 'I'], [3999, 'MMMCMXCIX']`.
- `expect(() => toRoman(0)).toThrow(RangeError)`, same for `4000` and `1.5`.

%% solution
```js
export function checkToRoman(toRoman) {
  const table = [
    [1, 'I'], [3, 'III'], [4, 'IV'], [5, 'V'], [9, 'IX'], [10, 'X'], [14, 'XIV'],
    [40, 'XL'], [49, 'XLIX'], [90, 'XC'], [400, 'CD'], [900, 'CM'],
    [1994, 'MCMXCIV'], [3999, 'MMMCMXCIX'],
  ];
  for (const [n, roman] of table) expect(toRoman(n)).toBe(roman);
  for (const bad of [0, -1, 4000, 1.5]) expect(() => toRoman(bad)).toThrow(RangeError);
}
```
