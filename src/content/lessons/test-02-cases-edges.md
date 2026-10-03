---
id: test-cases-edges
track: test
title: Choosing test cases: classes, edges & tables
summary: How to pick the few inputs that matter: split the input space into classes, test both sides of every boundary, run through the edge-case checklist, and keep many cases tidy with table-driven tests.
---

## The idea in one sentence

You can't test every input, so you test the **ones most likely to expose a bug**: one from each group of inputs that behave alike, and every value right at the **edges** between groups.

> **Analogy** A building inspector doesn't open every door. They check each *kind* of door once — fire exit, lift, cellar — and then pay special attention to the places things go wrong: hinges, thresholds, the join between two rooms. Test-case design is the same: representative samples, then the joins.

## Equivalence classes: group the inputs

Most functions treat whole ranges of inputs identically. A ticket price by age might look like this:

- age below `0` → an error
- `0` to `12` → free
- `13` to `64` → 10
- `65` and over → 6

If `ticketPrice(5)` works, `ticketPrice(7)` almost certainly does too: they're in the same **equivalence class**. So you need **one typical value per class**, not a hundred ages.

![Input classes for a ticket price, and the values to test](fig:tst-equivalence "One typical value per class, plus both sides of every boundary.")

## Boundaries: where bugs live

The **edges between classes** are where the classic mistakes hide: `<` instead of `<=`, `64` instead of `65`. For each boundary test the value **just below** and **right at** it: `-1`/`0`, `12`/`13`, `64`/`65`.

```js try predict
function ticketPrice(age) {
  if (age < 0) throw new RangeError('age must not be negative');
  if (age < 13) return 0;
  if (age < 65) return 10;
  return 6;
}
// the values on either side of each boundary
for (const age of [0, 12, 13, 64, 65]) console.log(age, '→', ticketPrice(age));
```

Watch how a boundary bug slips past "typical value" tests:

```stepper Typical values miss a boundary bug
code:
  function checkTicketPrice(ticketPrice) {
    expect(ticketPrice(30)).toBe(10);
    expect(ticketPrice(5)).toBe(0);
    expect(ticketPrice(80)).toBe(6);
    expect(ticketPrice(65)).toBe(6);
  }
  // mutant: seniors start at age > 65 instead of age >= 65
---
line: 2-4
say: Three **typical** values: an adult (30), a child (5) and a senior (80). Against the **mutant** (which charges the senior price only when `age > 65`), each one still gives the right answer.
ticketPrice(30): 10
ticketPrice(5): 0
ticketPrice(80): 6
result: all pass: the bug survives
---
line: 5
say: Now the **boundary**: `ticketPrice(65)` should be `6`. The mutant treats 65 as an adult and returns `10`. **`expect` throws**: the mutant is caught.
ticketPrice(65) on the mutant: 10 (expected 6)
result: fails: bug caught
```

## The edge-case checklist

Whatever the function, run through the same list. Each line has caught countless real bugs:

![A checklist of edge inputs](fig:tst-edge-checklist "Empty, one, many, duplicates, zero and negatives, boundaries, unusual values, ordering, big.")

- **Empty** (`[]`, `''`, `{}`): does it crash, or return something sensible?
- **One item**: loops with off-by-one errors fail here first.
- **Duplicates, zero, negatives**: sorting, de-duplicating and arithmetic hide bugs in them.
- **Unusual values**: `NaN`, `null`, `undefined`, strings of spaces.
- **Order**: sorted, reversed and shuffled input can behave differently.
- **Size**: one big case to catch accidental O(n²) slowness.

## Table-driven tests

When you have many cases for one function, write the **data** once and loop over it. Every row becomes its own named test:

![A table of cases turned into one test per row](fig:tst-table-driven "Adding a case is adding a row, and a failure names the exact row.")

```js try
const rows = [
  { a: 2, b: 3, expected: 5 },
  { a: -2, b: -3, expected: -5 },
  { a: 0, b: 0, expected: 0 },
  { a: 1.5, b: 2.25, expected: 3.75 },
];
const add = (a, b) => a + b;
for (const { a, b, expected } of rows) {
  const actual = add(a, b);
  console.log(actual === expected ? 'PASS' : 'FAIL', `add(${a}, ${b}) → ${actual}`);
}
```

In the test runner you write this with `it.each`:

```js
it.each([
  [2, 3, 5],
  [-2, -3, -5],
  [0, 0, 0],
])('add(%i, %i) is %i', (a, b, expected) => {
  expect(add(a, b)).toBe(expected);
});
```

Table-driven tests keep the **test logic** in one place and make the **cases** easy to scan and extend. They also turn a requirements table straight into tests.

## What *not* to test

- **Implementation details** (private helpers, which internal function was called). If you can rewrite the inside without changing behaviour, the tests should survive.
- **Trivial code** (a getter that returns a field).
- **Other people's code** (trust that `Array#sort` works; test *your use* of it).
- **The same thing twice.** Ten cases from one class add noise, not safety.

## Quick check

```check
Q: What is an equivalence class?
A) A group of identical tests
B) A set of inputs the code treats the same way, so one representative is enough *
C) A class that extends another
D) A group of failing tests
Why: If `ticketPrice(5)` works, `ticketPrice(7)` almost certainly does too, so testing both adds little.
---
Q: A function treats `age < 65` as an adult. Which test would catch a mistake like writing `age <= 65`?
A) `ticketPrice(30)`
B) `ticketPrice(80)`
C) `ticketPrice(65)` *
D) `ticketPrice(5)`
Why: Off-by-one bugs only show at the exact boundary value; typical values from the middle of a class miss them.
---
Q: Why prefer table-driven tests for many similar cases?
A) They run faster
B) The test logic is written once, cases are easy to read and add, and a failure names the row *
C) They don't need assertions
D) They replace unit tests
Why: A table separates what varies (the data) from what doesn't (the check).
---
Q: Which input is part of the standard edge-case checklist?
A) Only typical positive numbers
B) The empty input, a single item, duplicates, zero and negatives *
C) A random number
D) The longest possible string
Why: Empty/one/duplicates/zero/negatives are where loops and arithmetic most often break.
---
Q: Which is a good reason NOT to write a test?
A) The code has a bug
B) It would pin down a private helper's internals that you may want to rewrite *
C) The function has several branches
D) The function is new
Why: Tests that depend on internals break on harmless refactors and give no extra safety.
```

## Recap

- **Classes + boundaries**: one typical value per equivalence class, plus both sides of every edge.
- Run the **edge checklist**: empty, one, many, duplicates, zero/negatives, unusual values, order, size.
- **Table-driven tests** (`it.each`) keep many cases tidy and extensible.
- Test **behaviour**, not internals; skip trivial code and third-party code.
- Boundary bugs (`<` vs `<=`) are caught **only** by boundary values.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: tests for `ticketPrice` | Both sides of the boundaries (12/13, 64/65) and the error case |
| Tests for `parseDuration` | Multi-digit numbers, each unit, combinations, spaces, and invalid input |
| Tests for `binarySearch` | First and last element, single element, empty, absent values |
| Build `validatePassword` | A rules table; the hidden tests are table-driven |
| Tests for `formatCurrency` | Thousands, rounding, negatives, trailing zeros |
| Tests for `groupBy` | Order, falsy keys, the input untouched, how often the key function is called |
| Tests for `mergeIntervals` | Unsorted, touching, nested, single, empty, no mutation |

%% exercise tst-guided-ticket-price | Guided: tests for ticketPrice | 1 | js | js | checkTicketPrice | 10 | guided
`ticketPrice(age)` returns the ticket price: ages `0`–`12` are **free** (`0`), ages `13`–`64` pay `10`, ages `65` and over pay `6`. A negative age **throws a `RangeError`**. Write `checkTicketPrice(ticketPrice)` so it passes for a correct version and **fails** for: **child limit off by one (age 12 charged)**, **child limit off by one the other way (age 13 free)**, **seniors start at 66**, **seniors start at 64**, **age 0 is charged**, **negative ages are not rejected**.

```js
ticketPrice(12);  // 0
ticketPrice(13);  // 10
ticketPrice(65);  // 6
ticketPrice(-1);  // throws RangeError
```

%% worked
**A similar problem, solved: `checkShipping(shipping)`** — orders under 50 pay 5, orders from 50 up are free; negative totals throw.

```js
export function checkShipping(shipping) {
  expect(shipping(20)).toBe(5);        // ① a typical value from the first class
  expect(shipping(100)).toBe(0);       // ② and from the second
  expect(shipping(49.99)).toBe(5);     // ③ just BELOW the boundary
  expect(shipping(50)).toBe(0);        // ④ exactly ON the boundary
  expect(() => shipping(-1)).toThrow();   // ⑤ the error class
}
```

Notice the pattern: one typical value per class, then **both sides of each boundary**. To assert that code throws, **wrap the call in a function** (`() => shipping(-1)`) and use `toThrow`: otherwise the exception happens before `expect` can catch it.

%% explain
- **Boundaries**: 12/13 and 64/65, plus 0.
- **Typical values**: one per class.
- **Errors**: a negative age throws a `RangeError`; use `() => …` with `toThrow(RangeError)`.
- **Never throw** for a correct implementation.

%% nudge
- Which two ages sit on either side of each boundary?
- How do you assert that a call throws?

%% starter
```js
export function checkTicketPrice(ticketPrice) {
  // Step 1 — a typical value per class: 5, 30, 80.
  // Step 2 — the boundaries: 0, 12, 13, 64, 65.
  // Step 3 — a negative age throws: expect(() => ticketPrice(-1)).toThrow(RangeError)
  expect(ticketPrice(30)).toBe(10);
}
```

%% tests
```js
const correct = (age) => { if (age < 0) throw new RangeError('age'); if (age < 13) return 0; if (age < 65) return 10; return 6; };
const mutants = {
  'charges age 12': (age) => { if (age < 0) throw new RangeError('age'); if (age < 12) return 0; if (age < 65) return 10; return 6; },
  'lets age 13 in free': (age) => { if (age < 0) throw new RangeError('age'); if (age < 14) return 0; if (age < 65) return 10; return 6; },
  'starts seniors at 66': (age) => { if (age < 0) throw new RangeError('age'); if (age < 13) return 0; if (age < 66) return 10; return 6; },
  'starts seniors at 64': (age) => { if (age < 0) throw new RangeError('age'); if (age < 13) return 0; if (age < 64) return 10; return 6; },
  'charges age 0': (age) => { if (age < 0) throw new RangeError('age'); if (age > 0 && age < 13) return 0; if (age < 65) return 10; return 6; },
  'accepts negative ages': (age) => { if (age < 13) return 0; if (age < 65) return 10; return 6; },
};

describe('your checkTicketPrice', () => {
  it('passes on a correct ticketPrice', () => {
    expect(() => checkTicketPrice(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a ticketPrice that ${name}`, () => {
      expect(() => checkTicketPrice(impl)).toThrow();
    });
  }
});
```

%% hints
- `expect(ticketPrice(12)).toBe(0)` and `expect(ticketPrice(13)).toBe(10)` catch both child-limit bugs.
- `expect(ticketPrice(64)).toBe(10)` and `expect(ticketPrice(65)).toBe(6)` catch both senior-limit bugs.
- `expect(ticketPrice(0)).toBe(0)` and `expect(() => ticketPrice(-1)).toThrow(RangeError)`.

%% solution
```js
export function checkTicketPrice(ticketPrice) {
  expect(ticketPrice(5)).toBe(0);
  expect(ticketPrice(30)).toBe(10);
  expect(ticketPrice(80)).toBe(6);
  expect(ticketPrice(0)).toBe(0);
  expect(ticketPrice(12)).toBe(0);
  expect(ticketPrice(13)).toBe(10);
  expect(ticketPrice(64)).toBe(10);
  expect(ticketPrice(65)).toBe(6);
  expect(() => ticketPrice(-1)).toThrow(RangeError);
}
```

%% exercise tst-check-parse-duration | Tests for parseDuration | 3 | js | js | checkParseDuration | 24
`parseDuration(text)` converts text like `'1h30m'` to a number of **seconds**. It understands `h` (3600 s), `m` (60 s) and `s` (1 s); parts can be written one after another, optionally separated by spaces (`'1h 30m 15s'`); numbers can have several digits. Text that isn't made of such parts (including the empty string) **throws an `Error`**. Write `checkParseDuration(parseDuration)` so it passes for a correct version and **fails** for: **an hour is 3000 seconds**, **seconds are ignored**, **only the first part is read**, **garbage is accepted**, **only one digit is read**, **spaces between parts are rejected**.

```js
parseDuration('90s');         // 90
parseDuration('1h30m');       // 5400
parseDuration('1h 30m 15s');  // 5415
parseDuration('abc');         // throws
```

%% worked
**A similar problem, solved: `checkParsePrice(parsePrice)`** — `parsePrice('$12.50')` returns `12.5`.

```js
export function checkParsePrice(parsePrice) {
  expect(parsePrice('$12.50')).toBe(12.5);        // ① the normal case
  expect(parsePrice('$7')).toBe(7);               // ② no decimals
  expect(parsePrice('$1250.75')).toBe(1250.75);   // ③ MULTI-digit amounts (a one-digit bug hides in tiny examples)
  expect(() => parsePrice('12.50')).toThrow();    // ④ missing symbol: invalid input should fail loudly
  expect(() => parsePrice('')).toThrow();         // ⑤ empty
}
```

Parsers fail in predictable ways: they **mis-handle larger numbers**, **stop after the first match**, **accept junk** and **choke on optional whitespace**. Give each unit its own input with a **multi-digit** value, combine units, add spaces, and feed it several kinds of invalid text.

%% explain
- **Each unit separately** (`'2h'`, `'45m'`, `'30s'`) with multi-digit numbers.
- **Combinations**: `'1h30m'`, and with spaces: `'1h 30m 15s'`.
- **Invalid text throws**: `'abc'`, `''`, `'5'` (no unit), `'5x'`.
- **Use real numbers**: 45 minutes is 2700 seconds, not 300.

%% nudge
- Which input reveals that seconds are ignored? That only the first part is read?
- Why must at least one test use a two-digit number?

%% starter
```js
export function checkParseDuration(parseDuration) {
  // each unit alone, with a multi-digit number
  expect(parseDuration('30s')).toBe(30);
  // your assertions: hours, minutes, combinations, spaces, invalid input
}
```

%% tests
```js
const valid = /^\s*(\d+[hms]\s*)+$/;
const unit = { h: 3600, m: 60, s: 1 };
const make = ({ check = valid, re = /(\d+)([hms])/g, units = unit, first = false } = {}) => (text) => {
  if (!check.test(text)) throw new Error('invalid duration');
  let total = 0;
  for (const m of text.matchAll(re)) { total += Number(m[1]) * units[m[2]]; if (first) break; }
  return total;
};
const correct = make();
const mutants = {
  'counts an hour as 3000 seconds': make({ units: { h: 3000, m: 60, s: 1 } }),
  'ignores seconds': make({ units: { h: 3600, m: 60, s: 0 } }),
  'only reads the first part': make({ first: true }),
  'accepts garbage': make({ check: /^[\s\S]*$/ }),
  'reads only one digit': make({ re: /(\d)([hms])/g }),
  'rejects spaces between parts': make({ check: /^(\d+[hms])+$/ }),
};

describe('your checkParseDuration', () => {
  it('passes on a correct parseDuration', () => {
    expect(() => checkParseDuration(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a parseDuration that ${name}`, () => {
      expect(() => checkParseDuration(impl)).toThrow();
    });
  }
});
```

%% hints
- `'45m'` → `2700` (a one-digit reader gives `300`). `'2h'` → `7200`. `'30s'` → `30`.
- `'1h30m'` → `5400` (reading only the first part gives `3600`). `'1h 30m 15s'` → `5415`.
- Invalid: `expect(() => parseDuration('abc')).toThrow()`, and the same for `''` and `'5'`.

%% solution
```js
export function checkParseDuration(parseDuration) {
  expect(parseDuration('30s')).toBe(30);
  expect(parseDuration('45m')).toBe(2700);
  expect(parseDuration('2h')).toBe(7200);
  expect(parseDuration('90s')).toBe(90);
  expect(parseDuration('1h30m')).toBe(5400);
  expect(parseDuration('1h30m15s')).toBe(5415);
  expect(parseDuration('1h 30m 15s')).toBe(5415);
  expect(() => parseDuration('abc')).toThrow();
  expect(() => parseDuration('')).toThrow();
  expect(() => parseDuration('5')).toThrow();
  expect(() => parseDuration('5x')).toThrow();
}
```

%% exercise tst-check-binary-search | Tests for binarySearch | 3 | js | js | checkBinarySearch | 24
`binarySearch(sortedArray, target)` returns the **index** of `target` in an ascending array, or `-1` if it's absent. Write `checkBinarySearch(binarySearch)` so it passes for a correct version and **fails** for: **loop stops too early (misses single elements)**, **never checks the first element**, **never checks the last element**, **returns 0 instead of -1 when absent**, **returns the index plus one**, **searches the wrong half**.

```js
binarySearch([1, 3, 5, 7, 9], 7); // 3
binarySearch([1, 3, 5, 7, 9], 4); // -1
```

%% worked
**A similar problem, solved: `checkIndexOf(indexOf)`** — tests that try **every position** of a small array.

```js
export function checkIndexOf(indexOf) {
  const arr = ['a', 'b', 'c', 'd'];
  arr.forEach((item, i) => expect(indexOf(arr, item)).toBe(i));   // ① every element: first, middle AND last
  expect(indexOf(arr, 'z')).toBe(-1);                              // ② absent
  expect(indexOf([], 'a')).toBe(-1);                               // ③ empty
  expect(indexOf(['a'], 'a')).toBe(0);                             // ④ a single element
}
```

For search functions, **loop over every element** of a small array (it covers the first, last and every middle position at once), and add **absent** values on **each side** (below all, between, above all), plus the **empty** and **single-element** arrays — which is where `lo < hi` versus `lo <= hi` bugs live.

%% explain
- **Every element** found at its own index (first, last, middle).
- **Absent values**: smaller than all, in a gap, larger than all → `-1`.
- **Empty** and **one-item** arrays.
- **Even and odd lengths**.

%% nudge
- Which loop in your test would catch both "never checks the first" and "never checks the last"?
- Which tiny arrays expose a `lo < hi` loop bug?

%% starter
```js
export function checkBinarySearch(binarySearch) {
  expect(binarySearch([1, 3, 5, 7, 9], 7)).toBe(3);
  // your assertions: every element, absent values, empty, single, even length
}
```

%% tests
```js
const correct = (arr, t) => {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] === t) return mid; if (arr[mid] < t) lo = mid + 1; else hi = mid - 1; }
  return -1;
};
const mutants = {
  'stops too early (lo < hi)': (arr, t) => { let lo = 0, hi = arr.length - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid] === t) return mid; if (arr[mid] < t) lo = mid + 1; else hi = mid - 1; } return -1; },
  'never checks the first element': (arr, t) => { let lo = 1, hi = arr.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] === t) return mid; if (arr[mid] < t) lo = mid + 1; else hi = mid - 1; } return -1; },
  'never checks the last element': (arr, t) => { let lo = 0, hi = arr.length - 2; while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] === t) return mid; if (arr[mid] < t) lo = mid + 1; else hi = mid - 1; } return -1; },
  'returns 0 when the target is missing': (arr, t) => { const r = correct(arr, t); return r === -1 ? 0 : r; },
  'returns the index plus one': (arr, t) => { const r = correct(arr, t); return r === -1 ? -1 : r + 1; },
  'searches the wrong half': (arr, t) => { let lo = 0, hi = arr.length - 1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (arr[mid] === t) return mid; if (arr[mid] < t) hi = mid - 1; else lo = mid + 1; } return -1; },
};

describe('your checkBinarySearch', () => {
  it('passes on a correct binarySearch', () => {
    expect(() => checkBinarySearch(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a binarySearch that ${name}`, () => {
      expect(() => checkBinarySearch(impl)).toThrow();
    });
  }
});
```

%% hints
- `const arr = [1, 3, 5, 7, 9, 11]; arr.forEach((x, i) => expect(binarySearch(arr, x)).toBe(i));`
- Absent: `0` (below all), `4` (in a gap), `100` (above all): each is `-1`.
- Tiny arrays: `[]`, `[5]` with `5` and with `4`, and `[1, 2]`.

%% solution
```js
export function checkBinarySearch(binarySearch) {
  const odd = [1, 3, 5, 7, 9];
  const even = [1, 3, 5, 7, 9, 11];
  odd.forEach((x, i) => expect(binarySearch(odd, x)).toBe(i));
  even.forEach((x, i) => expect(binarySearch(even, x)).toBe(i));
  for (const missing of [0, 4, 8, 100]) {
    expect(binarySearch(odd, missing)).toBe(-1);
    expect(binarySearch(even, missing)).toBe(-1);
  }
  expect(binarySearch([], 1)).toBe(-1);
  expect(binarySearch([5], 5)).toBe(0);
  expect(binarySearch([5], 4)).toBe(-1);
  expect(binarySearch([1, 2], 1)).toBe(0);
  expect(binarySearch([1, 2], 2)).toBe(1);
}
```

%% exercise tst-validate-password | Build validatePassword from a table | 2 | js | js | validatePassword | 16
Implement `validatePassword(password)` from this requirements table. It returns an **array of the names of the rules the password breaks**, in this order (an empty array means valid):

| Rule name | The password fails it when… |
| --- | --- |
| `'length'` | it has **fewer than 8** characters |
| `'digit'` | it has **no** digit `0`–`9` |
| `'upper'` | it has **no** uppercase letter `A`–`Z` |
| `'symbol'` | it has **none** of `! @ # $ % ^ & *` |
| `'space'` | it **contains** a space |

```js
validatePassword('Abcdef1!');  // []
validatePassword('abc');       // ['length', 'digit', 'upper', 'symbol']
```

The hidden tests are **table-driven**: each row is a password and the exact expected list.

%% worked
**A similar problem, solved: `describeUsername(name)`** — a requirements table turned into code, one rule per line.

```js
function describeUsername(name) {
  const problems = [];
  if (name.length < 3) problems.push('short');            // ① one `if` per rule keeps the table and the code in step
  if (name.length > 12) problems.push('long');
  if (/[^a-z0-9_]/i.test(name)) problems.push('chars');
  return problems;                                         // ② the order of the `if`s is the order of the answer
}
```

When the spec is a **table of rules**, give each rule its own `if` in the **order the table lists them**, collect the failures in an array and return it. Regular expressions answer "does it contain …?": `/\d/`, `/[A-Z]/`, `/[!@#$%^&*]/`, `/\s/`.

%% explain
- **All rules are checked**, not just the first failure.
- **Order** of the result follows the table.
- **Empty array** means valid.
- **Space rule**: any whitespace counts as a space.

%% nudge
- Should the function stop at the first broken rule?
- Which regular expression asks "is there a digit anywhere?"

%% starter
```js
export function validatePassword(password) {
  const failed = [];
  // one check per rule, in the order of the table
  return failed;
}
```

%% tests
```js
describe('validatePassword', () => {
  it.each([
    ['Abcdef1!', []],
    ['abc', ['length', 'digit', 'upper', 'symbol']],
    ['Abcdefgh1', ['symbol']],
    ['abcdefgh1!', ['upper']],
    ['Abcdefg!', ['digit']],
    ['Abc def1!', ['space']],
    ['', ['length', 'digit', 'upper', 'symbol']],
    ['A1!a b', ['length', 'space']],
    ['ABCDEFGH1!', []],
    ['Abcdefg1', ['symbol']],
    ['Abcd1!', ['length']],
  ])('validatePassword(%j) is %j', (password, expected) => {
    expect(validatePassword(password)).toEqual(expected);
  });
});
```

%% hints
- `if (password.length < 8) failed.push('length');`
- `if (!/\d/.test(password)) failed.push('digit');` and similar for `/[A-Z]/` and `/[!@#$%^&*]/`.
- `if (/\s/.test(password)) failed.push('space');` last.

%% solution
```js
export function validatePassword(password) {
  const failed = [];
  if (password.length < 8) failed.push('length');
  if (!/\d/.test(password)) failed.push('digit');
  if (!/[A-Z]/.test(password)) failed.push('upper');
  if (!/[!@#$%^&*]/.test(password)) failed.push('symbol');
  if (/\s/.test(password)) failed.push('space');
  return failed;
}
```

%% exercise tst-check-format-currency | Tests for formatCurrency | 3 | js | js | checkFormatCurrency | 24
`formatCurrency(amount)` formats a number as US dollars: a `$`, thousands separated by commas, **exactly two decimals**, **rounded** to the nearest cent, and a **leading minus before the `$`** for negatives. Write `checkFormatCurrency(formatCurrency)` so it passes for a correct version and **fails** for: **no thousands separators**, **rounds down instead of to nearest**, **drops the minus sign**, **no trailing zeros**, **puts the minus after the `$`**.

```js
formatCurrency(1234.5);   // '$1,234.50'
formatCurrency(-5);       // '-$5.00'
formatCurrency(9.999);    // '$10.00'
```

%% worked
**A similar problem, solved: `checkFormatPercent(formatPercent)`** — `formatPercent(0.256)` is `'25.6%'`, one decimal.

```js
export function checkFormatPercent(formatPercent) {
  expect(formatPercent(0.5)).toBe('50.0%');       // ① a "round" value: checks the padding to one decimal
  expect(formatPercent(0.256)).toBe('25.6%');     // ② a typical value
  expect(formatPercent(0.9999)).toBe('100.0%');   // ③ ROUNDING that carries over (floor would give 99.9%)
  expect(formatPercent(0)).toBe('0.0%');          // ④ zero
  expect(formatPercent(-0.1)).toBe('-10.0%');     // ⑤ negatives
}
```

Formatting functions fail on **presentation details**, each of which needs a value that **exposes** it: a "round" number (padding), a value with extra digits (rounding vs flooring, ideally one that *carries*, like `9.999`), a big number (separators), zero, and a negative.

%% explain
- **Padding**: whole numbers still show `.00`.
- **Rounding**: nearest cent; pick values where `floor` and `round` differ.
- **Separators**: only appear from 1 000 up; test 999 and 1000, plus millions.
- **Negatives**: `-$5.00`, sign **before** the `$`.

%% nudge
- Which input differs between "round" and "floor"?
- Why test both 999 and 1000?

%% starter
```js
export function checkFormatCurrency(formatCurrency) {
  expect(formatCurrency(1234.5)).toBe('$1,234.50');
  // your assertions: zero, whole numbers, rounding, millions, negatives
}
```

%% tests
```js
const withCommas = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const fmt = ({ commas = true, round = Math.round, sign = (n) => (n < 0 ? '-' : ''), pad = true, signAfter = false } = {}) => (n) => {
  const abs = Math.abs(n);
  const cents = round(abs * 100) / 100;
  const text = pad ? cents.toFixed(2) : String(cents);
  const [i, d] = text.split('.');
  const body = (commas ? withCommas(i) : i) + (d ? '.' + d : '');
  return signAfter ? `$${sign(n)}${body}` : `${sign(n)}$${body}`;
};
const correct = fmt();
const mutants = {
  'has no thousands separators': fmt({ commas: false }),
  'rounds down instead of to the nearest cent': fmt({ round: Math.floor }),
  'drops the minus sign': fmt({ sign: () => '' }),
  'leaves out trailing zeros': fmt({ pad: false }),
  'puts the minus after the dollar sign': fmt({ signAfter: true }),
};

describe('your checkFormatCurrency', () => {
  it('passes on a correct formatCurrency', () => {
    expect(() => checkFormatCurrency(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a formatCurrency that ${name}`, () => {
      expect(() => checkFormatCurrency(impl)).toThrow();
    });
  }
});
```

%% hints
- `0` → `'$0.00'`, `5` → `'$5.00'`, `1234.5` → `'$1,234.50'` (padding and commas).
- `999` → `'$999.00'` and `1000` → `'$1,000.00'`; `1234567.891` → `'$1,234,567.89'`.
- `9.999` → `'$10.00'` and `0.256` → `'$0.26'` expose flooring. `-5` → `'-$5.00'`.

%% solution
```js
export function checkFormatCurrency(formatCurrency) {
  expect(formatCurrency(0)).toBe('$0.00');
  expect(formatCurrency(5)).toBe('$5.00');
  expect(formatCurrency(1234.5)).toBe('$1,234.50');
  expect(formatCurrency(999)).toBe('$999.00');
  expect(formatCurrency(1000)).toBe('$1,000.00');
  expect(formatCurrency(1234567.891)).toBe('$1,234,567.89');
  expect(formatCurrency(9.999)).toBe('$10.00');
  expect(formatCurrency(0.256)).toBe('$0.26');
  expect(formatCurrency(-5)).toBe('-$5.00');
  expect(formatCurrency(-1234.5)).toBe('-$1,234.50');
}
```

%% exercise tst-check-group-by | Tests for groupBy | 3 | js | js | checkGroupBy | 26
`groupBy(items, keyFn)` returns an object that maps each key (`keyFn(item)`) to an **array of the items with that key, in their original order**. `keyFn` is called **exactly once per item**, and the input array is **not modified**. Write `checkGroupBy(groupBy)` so it passes for a correct version and **fails** for: **keeps only the last item of each group**, **reverses the order inside groups**, **sorts the input array in place**, **drops items whose key is falsy**, **calls the key function twice per item**.

```js
groupBy(['apple', 'avocado', 'banana'], (w) => w[0]);
// { a: ['apple', 'avocado'], b: ['banana'] }
```

%% worked
**A similar problem, solved: `checkMap(map)`** — `map(items, fn)` must call `fn` once per item with the item; this uses a **spy** (`jest.fn`).

```js
export function checkMap(map) {
  const fn = jest.fn((x) => x * 2);                 // ① a function that records how it is called
  expect(map([1, 2, 3], fn)).toEqual([2, 4, 6]);    // ② the result
  expect(fn).toHaveBeenCalledTimes(3);              // ③ once per item (catches double calls)
  expect(fn.mock.calls[0][0]).toBe(1);              // ④ the first call received the first item
}
```

A **spy** (`jest.fn(impl)`) wraps a function and **records its calls**: `toHaveBeenCalledTimes(n)`, `toHaveBeenCalledWith(...)`, `mock.calls`. Use it when the behaviour you must check is **how something is called**, not just what it returns. For `groupBy`, also verify the **input is unchanged** (compare with a copy), and use **falsy keys** like `0` and `''`.

%% explain
- **Order inside groups** matters: assert the whole arrays.
- **Falsy keys** (`0`) must survive.
- **Key function** called once per item: use `jest.fn`.
- **Input unchanged**: compare with a copy after the call; pick data where sorting would reorder it.

%% nudge
- Which input makes "keeps the first" and "keeps the last" differ?
- What data would be reordered by an in-place sort?

%% starter
```js
export function checkGroupBy(groupBy) {
  expect(groupBy(['apple', 'avocado', 'banana'], (w) => w[0])).toEqual({ a: ['apple', 'avocado'], b: ['banana'] });
  // your assertions: order, falsy keys, input unchanged, number of keyFn calls
}
```

%% tests
```js
const correct = (items, keyFn) => { const out = {}; for (const item of items) { const k = keyFn(item); (out[k] ??= []).push(item); } return out; };
const mutants = {
  'keeps only the last item of each group': (items, keyFn) => { const out = {}; for (const item of items) out[keyFn(item)] = [item]; return out; },
  'reverses the order inside groups': (items, keyFn) => { const out = {}; for (const item of items) (out[keyFn(item)] ??= []).unshift(item); return out; },
  'sorts the input array in place': (items, keyFn) => { items.sort(); return correct(items, keyFn); },
  'drops items whose key is falsy': (items, keyFn) => { const out = {}; for (const item of items) { const k = keyFn(item); if (!k) continue; (out[k] ??= []).push(item); } return out; },
  'calls the key function twice per item': (items, keyFn) => { const out = {}; for (const item of items) { keyFn(item); (out[keyFn(item)] ??= []).push(item); } return out; },
};

describe('your checkGroupBy', () => {
  it('passes on a correct groupBy', () => {
    expect(() => checkGroupBy(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a groupBy that ${name}`, () => {
      expect(() => checkGroupBy(impl)).toThrow();
    });
  }
});
```

%% hints
- `groupBy(['apple','avocado','banana','blueberry'], (w) => w[0])` with `toEqual({ a: ['apple','avocado'], b: ['banana','blueberry'] })` checks order and keeping all items.
- `groupBy([0, 1, 2, 3], (n) => n % 2)` → `{ 0: [0, 2], 1: [1, 3] }` has the falsy key `0`.
- `const keyFn = jest.fn((w) => w[0]); … expect(keyFn).toHaveBeenCalledTimes(items.length)`. And `const input = ['pear', 'apple']; groupBy(input, …); expect(input).toEqual(['pear', 'apple'])`.

%% solution
```js
export function checkGroupBy(groupBy) {
  expect(groupBy([], (x) => x)).toEqual({});
  expect(groupBy(['apple', 'avocado', 'banana', 'blueberry', 'cherry'], (w) => w[0]))
    .toEqual({ a: ['apple', 'avocado'], b: ['banana', 'blueberry'], c: ['cherry'] });
  expect(groupBy([0, 1, 2, 3], (n) => n % 2)).toEqual({ 0: [0, 2], 1: [1, 3] });
  const input = ['pear', 'apple', 'plum'];
  groupBy(input, (w) => w[0]);
  expect(input).toEqual(['pear', 'apple', 'plum']);
  const keyFn = jest.fn((w) => w[0]);
  groupBy(['kiwi', 'lime', 'kale'], keyFn);
  expect(keyFn).toHaveBeenCalledTimes(3);
}
```

%% exercise tst-check-merge-intervals | Tests for mergeIntervals | 4 | js | js | checkMergeIntervals | 36
`mergeIntervals(intervals)` takes `[start, end]` pairs and returns the **merged** list sorted by start: intervals that **overlap or touch** (`next.start <= current.end`) are combined into one. The input (and the arrays inside it) must **not be modified**. Write `checkMergeIntervals(mergeIntervals)` so it passes for a correct version and **fails** for: **doesn't sort first**, **doesn't merge touching intervals**, **shrinks the end when an interval is nested**, **sorts the input in place**, **loses the last group**, **modifies the arrays inside the input**.

```js
mergeIntervals([[1, 3], [2, 6], [8, 10]]); // [[1, 6], [8, 10]]
mergeIntervals([[1, 4], [4, 5]]);          // [[1, 5]]
```

%% worked
**A similar problem, solved: `checkSortNumbers(sortNumbers)`** — a suite that hits ordering, duplicates, **and** immutability.

```js
export function checkSortNumbers(sortNumbers) {
  expect(sortNumbers([3, 1, 2])).toEqual([1, 2, 3]);       // ① unsorted input
  expect(sortNumbers([10, 9, 1])).toEqual([1, 9, 10]);     // ② numeric, not alphabetical order
  expect(sortNumbers([2, 1, 2])).toEqual([1, 2, 2]);       // ③ duplicates stay
  const input = [3, 1, 2];
  sortNumbers(input);
  expect(input).toEqual([3, 1, 2]);                        // ④ the caller's array is untouched
}
```

Merging has **many independent behaviours**, each needing its own input: **already sorted** (so the sort mutant survives unless you give it **unsorted** input), **touching** versus **overlapping**, **nested** (`[1,10]` containing `[2,3]`), a **single** interval, the **empty** list, and **immutability** of both the outer array and the inner pairs. Make a **deep copy** of your input (`JSON.parse(JSON.stringify(…))`) to compare after the call.

%% explain
- **Unsorted input** exposes a missing sort.
- **Touching** (`[1,4]`,`[4,5]`) merges; **gaps** don't.
- **Nested** intervals keep the larger end.
- **Single and empty** inputs.
- **No mutation**: compare against a deep copy, including inner arrays.

%% nudge
- Which input would show that a nested interval shrinks the end?
- How do you detect that the inner `[start, end]` arrays were changed?

%% starter
```js
export function checkMergeIntervals(mergeIntervals) {
  expect(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]])).toEqual([[1, 6], [8, 10], [15, 18]]);
  // your assertions: unsorted, touching, nested, single, empty, input unchanged
}
```

%% tests
```js
const merge = ({ sort = true, touching = true, shrink = false, mutateInput = false, dropLast = false, mutateInner = false } = {}) => (intervals) => {
  const list = sort ? (mutateInput ? intervals : intervals.slice()).sort((a, b) => a[0] - b[0]) : intervals.slice();
  const out = [];
  for (const iv of list) {
    const last = out[out.length - 1];
    const joins = last && (touching ? iv[0] <= last[1] : iv[0] < last[1]);
    if (joins) last[1] = shrink ? iv[1] : Math.max(last[1], iv[1]);
    else out.push(mutateInner ? iv : [iv[0], iv[1]]);
  }
  return dropLast ? out.slice(0, -1) : out;
};
const correct = merge();
const mutants = {
  'does not sort first': merge({ sort: false }),
  'does not merge touching intervals': merge({ touching: false }),
  'shrinks the end when an interval is nested': merge({ shrink: true }),
  'sorts the input in place': merge({ mutateInput: true }),
  'loses the last group': merge({ dropLast: true }),
  'modifies the arrays inside the input': merge({ mutateInner: true }),
};

describe('your checkMergeIntervals', () => {
  it('passes on a correct mergeIntervals', () => {
    expect(() => checkMergeIntervals(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a mergeIntervals that ${name}`, () => {
      expect(() => checkMergeIntervals(impl)).toThrow();
    });
  }
});
```

%% hints
- Unsorted: `[[8, 10], [1, 3], [2, 6]]` → `[[1, 6], [8, 10]]`. Touching: `[[1, 4], [4, 5]]` → `[[1, 5]]`.
- Nested: `[[1, 10], [2, 3]]` → `[[1, 10]]`. Single: `[[1, 2]]` → `[[1, 2]]`. Empty: `[]` → `[]`.
- Immutability: `const input = [[8, 10], [1, 3], [2, 6]]; const copy = JSON.parse(JSON.stringify(input));` call the function, then `expect(input).toEqual(copy)`.

%% solution
```js
export function checkMergeIntervals(mergeIntervals) {
  expect(mergeIntervals([])).toEqual([]);
  expect(mergeIntervals([[1, 2]])).toEqual([[1, 2]]);
  expect(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]])).toEqual([[1, 6], [8, 10], [15, 18]]);
  expect(mergeIntervals([[1, 4], [4, 5]])).toEqual([[1, 5]]);
  expect(mergeIntervals([[8, 10], [1, 3], [2, 6]])).toEqual([[1, 6], [8, 10]]);
  expect(mergeIntervals([[1, 10], [2, 3]])).toEqual([[1, 10]]);
  expect(mergeIntervals([[1, 2], [3, 4]])).toEqual([[1, 2], [3, 4]]);
  const input = [[8, 10], [1, 3], [2, 6]];
  const copy = JSON.parse(JSON.stringify(input));
  mergeIntervals(input);
  expect(input).toEqual(copy);
}
```
