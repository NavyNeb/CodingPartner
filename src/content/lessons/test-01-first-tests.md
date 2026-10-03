---
id: test-first-tests
track: test
title: Your first tests
summary: What a test really is, the Arrange-Act-Assert shape, how to read assertions and failures, and how this track checks that your tests can actually catch bugs.
---

## The idea in one sentence

A test is **a small program that runs your code and shouts if the answer is wrong** — and a good test suite is a safety net that lets you change code without being afraid of it.

> **Analogy** A smoke detector. It does nothing 99.9 % of the time, and you forget it's there — until the one moment it matters. Its value isn't that it *runs*, it's that it **goes off when something is wrong**. A test that can never fail is like a detector with no battery.

## A test is just a function that throws

Under the frameworks (Jest, Vitest, Mocha), the idea is tiny: run some code, compare the result with what you expected, and **throw an error if they differ**. A test runner just calls many such functions and reports which threw.

```js try predict
function test(name, fn) {
  try { fn(); console.log('PASS', name); }
  catch (e) { console.log('FAIL', name, '-', e.message); }
}
function assertEqual(actual, expected) {
  if (actual !== expected) throw new Error(`expected ${expected} but got ${actual}`);
}

const add = (a, b) => a + b;
test('adds two numbers', () => assertEqual(add(2, 3), 5));
test('adds negatives (a wrong expectation on purpose)', () => assertEqual(add(-2, -3), -4));
```

In this course, `expect(actual).toBe(expected)` plays the role of `assertEqual`, and `it('does something', () => { … })` plays the role of `test`.

## Why bother?

- **Confidence to change code.** Refactor, upgrade a library or fix a bug, then run the tests: they tell you in seconds if you broke something.
- **Documentation that can't go stale.** A test named `it('returns an empty list for an empty cart')` states a promise the code must keep.
- **Faster debugging.** A failing test points at the broken behaviour instead of "the page looks weird".

Not every test is equal. Tests come in layers:

![The test pyramid: many unit tests, some integration tests, a few end-to-end tests](fig:tst-pyramid "Cheap, fast, precise tests at the bottom; slower, more realistic ones above.")

This track focuses on the **bottom and middle** — unit and integration tests — which is where most of your daily testing happens.

## Anatomy of a test: Arrange, Act, Assert

![Arrange, Act, Assert](fig:tst-aaa "Set up, do one thing, check the result.")

```js
it('total is the sum of the line items', () => {
  // Arrange: set up what the test needs
  const cart = new Cart();
  cart.add('apple', 2);
  // Act: do the one thing under test
  const total = cart.total();
  // Assert: check the outcome
  expect(total).toBe(3);
});
```

Habits that make tests useful:

- **Name the behaviour, not the method**: `'returns 0 for an empty cart'` beats `'test total'`.
- **One reason to fail.** Test one behaviour per `it`. When it goes red you know exactly what broke.
- **Test what the code promises, not how it works inside.** If you rewrite the internals and the behaviour is unchanged, the tests should stay green.
- **Independent tests.** No test should depend on another having run first.

## Assertions: the vocabulary

`expect(value)` gives you a matcher to say what you expect. The ones you'll use constantly:

| Matcher | Use it for |
| --- | --- |
| `toBe(x)` | primitives and **identity** (`===`) |
| `toEqual(x)` | objects and arrays by **value** (deep equality) |
| `toBeCloseTo(x, digits)` | decimals (`0.1 + 0.2` is not exactly `0.3`) |
| `toBeTruthy()` / `toBeNull()` / `toBeUndefined()` | the specific "empty" values |
| `toContain(x)` / `toHaveLength(n)` | lists and strings |
| `toThrow(msg?)` | code that must **throw** (pass it a function) |
| `.not` | any of the above, inverted: `expect(x).not.toBe(y)` |

```js try predict
console.log([1] === [1]);                              // two different array objects
console.log(JSON.stringify([1]) === JSON.stringify([1]));   // same contents
console.log(0.1 + 0.2 === 0.3, Math.abs(0.1 + 0.2 - 0.3) < 1e-9);
```

`toBe` on two arrays fails even when they look identical — that's what `toEqual` is for.

## Can your tests catch a bug?

It's easy to write a test that *passes*. The real question is whether it would **fail if the code were wrong**. A **weak test** passes for the wrong reason:

```stepper A weak test lets a bug through
code:
  function checkAdd(add) {
    expect(add(2, 2)).toBe(4);
    expect(add(2, 3)).toBe(5);
  }
  // real:    (a, b) => a + b
  // mutant:  (a, b) => a * b
---
line: 2
say: With only the **first** assertion, run it against the **real** `add`: `2 + 2 = 4`. It passes. So far so good.
real add(2, 2): 4
result: pass
---
line: 2
say: Now run the same assertion against the **buggy** version (`a * b`): `2 * 2 = 4`. **It passes too!** The bug survives: 2 + 2 and 2 × 2 happen to be equal. This input can't tell right from wrong.
mutant add(2, 2): 4
result: pass (the bug survives!)
---
line: 3
say: The second assertion uses `add(2, 3)`. The real code gives `5`: pass.
real add(2, 3): 5
result: pass
---
line: 3
say: The buggy code gives `2 * 3 = 6`, not `5`: **`expect` throws**. The suite now fails on the mutant: the bug is **caught** ("killed"). Choosing inputs where right and wrong behaviour **differ** is the whole skill.
mutant add(2, 3): 6 (expected 5)
result: fail → bug caught
```

This idea — deliberately breaking the code to check that your tests notice — is called **mutation testing**, and in this track it is how your tests get graded.

![How your tests are graded: green on the real code, red on every broken copy](fig:tst-mutants "Exercises with a `check…` function run it against the real implementation and several broken ones.")

In the exercises, you'll write a function like `checkClamp(clamp)`. It receives an implementation, and it should call `expect(...)` to describe correct behaviour. The grader runs it against:

1. the **real** implementation: nothing may throw,
2. several **mutants** (plausible bugs): each one must make an assertion throw.

Write assertions that pin down the behaviour from different angles: ordinary values, **boundaries**, **negatives**, **empty** inputs and **unusual** ones.

## Quick check

```check
Q: What is a test, at its simplest?
A) A comment explaining the code
B) A function that runs your code and throws an error when the result is wrong *
C) A type annotation
D) A logging statement
Why: A test runner just calls many functions and reports which ones threw.
---
Q: Which test name is the most useful?
A) "test total"
B) "returns 0 for an empty cart" *
C) "cart works"
D) "test 1"
Why: A good name states the behaviour and the situation, so a failure message already tells you what broke.
---
Q: Why does `expect([1]).toBe([1])` fail?
A) Arrays can't be compared
B) `toBe` checks identity (`===`) and these are two different array objects; use `toEqual` for contents *
C) The array is empty
D) It is a bug in the matcher
Why: Two separately created arrays are never `===`. `toEqual` compares deeply.
---
Q: `add(2, 2) === 4` passes for both `a + b` and `a * b`. What does that tell you?
A) Both are correct
B) The test input can't distinguish the two, so the test is too weak to catch that bug *
C) JavaScript is broken
D) Multiplication is addition
Why: Pick inputs where a correct and a wrong implementation give different answers (like `add(2, 3)`).
---
Q: In "write the tests" exercises, a mutant is…
A) A faster implementation
B) A plausible buggy copy of the code that your tests must detect *
C) A type error
D) A test that fails on purpose
Why: If your suite still passes on a mutant, there is a bug it would miss.
```

## Recap

- A **test** is a function that **throws when the behaviour is wrong**; frameworks just run many of them.
- Shape every test as **Arrange, Act, Assert**: one behaviour, a descriptive name, independent of the others.
- Learn the core matchers: `toBe` (identity), `toEqual` (deep), `toBeCloseTo`, `toThrow`, `.not`.
- A passing test proves little. A **useful** test would **fail if the code were broken**.
- In this track, tests are graded against **mutants**: green on the real code, red on every broken copy.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: tests for `add` | The weak-test stepper: choose inputs where right and wrong differ |
| Tests for `clamp` | A value below, inside and above the range, **on the boundaries**, and a decimal |
| Tests for `isPalindrome` | Case, spaces, odd and even lengths, the empty string, a near-miss like `abca` |
| Tests for `fizzBuzz` | A whole list (length, start, the multiples of 15) |
| Tests for `unique` | Order, strict equality, falsy values, the input left untouched |
| Tests for a `Stack` class | Each method on its own, and the empty case |

%% exercise tst-guided-check-add | Guided: tests for add | 1 | js | js | checkAdd | 8 | guided
`add(a, b)` should return the sum of two numbers. Write `checkAdd(add)`: it receives an implementation of `add` and must call `expect(...)` so that:

- it **never throws** for a correct `add`,
- it **throws** for each of these broken versions: one that subtracts, one that multiplies, one that ignores `b`, one that adds one too many, and one that adds the absolute values.

```js
export function checkAdd(add) {
  expect(add(2, 3)).toBe(5);
}
```

(That one assertion catches *some* of the mutants. Which ones does it miss?)

%% worked
**A similar problem, solved: `checkDouble(double)`** — tests for a function that doubles a number.

```js
export function checkDouble(double) {
  expect(double(2)).toBe(4);       // ① a plain positive number
  expect(double(0)).toBe(0);       // ② zero is a classic edge
  expect(double(-3)).toBe(-6);     // ③ a negative: catches a version that uses Math.abs
  expect(double(1.5)).toBe(3);     // ④ a decimal: catches a version that rounds
}
```

Each assertion exists to catch a **kind of bug**: a wrong operator, a lost sign, a rounded result. When you design inputs, ask "what plausible mistake would this input expose?" For `add`, pick values where `+`, `-`, `*` and "ignore b" all disagree — and include a negative.

%% explain
- **`checkAdd(add)`** calls `expect` directly: the grader gives your code the real `expect`.
- **It must not throw** for the correct implementation.
- **It must throw** for each mutant: subtract, multiply, ignore `b`, off by one, absolute values.
- **Inputs matter**: `add(2, 2)` alone would let `a * b` through.

%% nudge
- Which inputs make `a + b` differ from `a * b`?
- Which input exposes a version that uses `Math.abs`?

%% starter
```js
export function checkAdd(add) {
  // Step 1 — one ordinary case, like add(2, 3) = 5.
  // Step 2 — a case with a negative number (catches the absolute-value mutant).
  // Step 3 — zero, and maybe a decimal.
  expect(add(2, 3)).toBe(5);
}
```

%% tests
```js
const correct = (a, b) => a + b;
const mutants = {
  'subtracts': (a, b) => a - b,
  'multiplies': (a, b) => a * b,
  'ignores b': (a) => a,
  'adds one too many': (a, b) => a + b + 1,
  'uses absolute values': (a, b) => Math.abs(a) + Math.abs(b),
};

describe('your checkAdd', () => {
  it('passes on a correct add', () => {
    expect(() => checkAdd(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a buggy add that ${name}`, () => {
      expect(() => checkAdd(impl)).toThrow();
    });
  }
});
```

%% hints
- `add(2, 3)` already rules out multiplying, ignoring `b` and adding one too many.
- A negative pair such as `add(-2, -3)` should be `-5`: the absolute-value version returns `5`.

%% solution
```js
export function checkAdd(add) {
  expect(add(2, 3)).toBe(5);
  expect(add(0, 0)).toBe(0);
  expect(add(-2, -3)).toBe(-5);
  expect(add(-2, 3)).toBe(1);
  expect(add(1.5, 2.25)).toBe(3.75);
}
```

%% exercise tst-check-clamp | Tests for clamp | 2 | js | js | checkClamp | 14
`clamp(n, lo, hi)` returns `n` limited to the range `lo … hi`: `lo` if `n` is below it, `hi` if above, otherwise `n` unchanged (decimals stay decimals). Write `checkClamp(clamp)` so that it passes on a correct `clamp` and **fails** on all of these bugs: **no upper bound**, **no lower bound**, **upper bound off by one**, **lower bound off by one**, **rounds decimals**.

```js
clamp(5, 0, 10);   // 5
clamp(-3, 0, 10);  // 0
clamp(42, 0, 10);  // 10
clamp(2.5, 0, 10); // 2.5
```

%% worked
**A similar problem, solved: `checkAbs(abs)`** — tests for absolute value, thinking about boundaries.

```js
export function checkAbs(abs) {
  expect(abs(5)).toBe(5);        // ① positive: stays
  expect(abs(-5)).toBe(5);       // ② negative: flips
  expect(abs(0)).toBe(0);        // ③ the boundary between the two behaviours
  expect(abs(-2.5)).toBe(2.5);   // ④ decimals
}
```

Functions with **ranges** have **boundaries**: the values right at the edge, where an off-by-one hides. For `clamp`, test a value **at** `lo`, at `hi`, **just outside** each, and clearly **inside** the range.

%% explain
- **Below, inside, above**: three regions of the input space.
- **On the boundaries** (`n = lo`, `n = hi`) catch off-by-one bugs.
- **A decimal** catches a version that rounds.
- **Never throw** on the real `clamp`.

%% nudge
- What is the smallest set of inputs that touches every region and both boundaries?
- Which input would expose rounding?

%% starter
```js
export function checkClamp(clamp) {
  // inside the range
  expect(clamp(5, 0, 10)).toBe(5);
  // your assertions: below, above, both boundaries, a decimal
}
```

%% tests
```js
const correct = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const mutants = {
  'has no upper bound': (n, lo) => Math.max(lo, n),
  'has no lower bound': (n, lo, hi) => Math.min(hi, n),
  'has an upper bound that is off by one': (n, lo, hi) => Math.min(hi - 1, Math.max(lo, n)),
  'has a lower bound that is off by one': (n, lo, hi) => Math.max(lo + 1, Math.min(hi, n)),
  'rounds decimals': (n, lo, hi) => Math.round(Math.min(hi, Math.max(lo, n))),
};

describe('your checkClamp', () => {
  it('passes on a correct clamp', () => {
    expect(() => checkClamp(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a clamp that ${name}`, () => {
      expect(() => checkClamp(impl)).toThrow();
    });
  }
});
```

%% hints
- Below: `clamp(-3, 0, 10)` is `0`. Above: `clamp(42, 0, 10)` is `10`.
- The boundaries: `clamp(0, 0, 10)` is `0` and `clamp(10, 0, 10)` is `10`.
- A decimal: `clamp(2.5, 0, 10)` is `2.5`.

%% solution
```js
export function checkClamp(clamp) {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-3, 0, 10)).toBe(0);
  expect(clamp(42, 0, 10)).toBe(10);
  expect(clamp(0, 0, 10)).toBe(0);
  expect(clamp(10, 0, 10)).toBe(10);
  expect(clamp(2.5, 0, 10)).toBe(2.5);
}
```

%% exercise tst-check-palindrome | Tests for isPalindrome | 2 | js | js | checkIsPalindrome | 16
`isPalindrome(text)` returns `true` when the text reads the same backwards, **ignoring upper/lower case and spaces**; the empty string counts as a palindrome. Write `checkIsPalindrome(isPalindrome)` so it passes for a correct one and **fails** for these bugs: **case-sensitive**, **spaces matter**, **compares only the first and last letter**, **the empty string is not a palindrome**, and **always true for odd-length strings**.

```js
isPalindrome('Racecar');    // true
isPalindrome('taco cat');   // true
isPalindrome('abca');       // false
```

%% worked
**A similar problem, solved: `checkIsEven(isEven)`** — a suite with both "yes" and "no" answers.

```js
export function checkIsEven(isEven) {
  expect(isEven(4)).toBe(true);      // ① a clear yes
  expect(isEven(7)).toBe(false);     // ② a clear no
  expect(isEven(0)).toBe(true);      // ③ the edge: zero
  expect(isEven(-2)).toBe(true);     // ④ negatives (a % 2 === 1 check would get -3 wrong, too)
  expect(isEven(-3)).toBe(false);
}
```

For yes/no functions, test **both answers**, including **near misses**: inputs that *almost* qualify (`'abca'` starts and ends with the same letter but isn't a palindrome). Bugs love the gap between "almost" and "yes".

%% explain
- **Both answers**: palindromes *and* non-palindromes.
- **Case and spaces** each need their own input.
- **A near-miss** (`'abca'`) rules out "first equals last".
- **Odd and even lengths** and **the empty string** are separate edges.

%% nudge
- Which input is a palindrome only if you ignore case? Only if you ignore spaces?
- Which input starts and ends with the same letter but isn't a palindrome?

%% starter
```js
export function checkIsPalindrome(isPalindrome) {
  expect(isPalindrome('racecar')).toBe(true);
  // your assertions: case, spaces, a near-miss, odd and even lengths, empty
}
```

%% tests
```js
const normalise = (s) => s.toLowerCase().replace(/ /g, '');
const same = (t) => t === [...t].reverse().join('');
const correct = (s) => same(normalise(s));
const mutants = {
  'is case-sensitive': (s) => same(s.replace(/ /g, '')),
  'lets spaces matter': (s) => same(s.toLowerCase()),
  'only compares the first and last letter': (s) => { const t = normalise(s); return t[0] === t[t.length - 1]; },
  'treats the empty string as not a palindrome': (s) => { const t = normalise(s); return t.length > 0 && same(t); },
  'is always true for odd lengths': (s) => { const t = normalise(s); return t.length % 2 === 1 || same(t); },
};

describe('your checkIsPalindrome', () => {
  it('passes on a correct isPalindrome', () => {
    expect(() => checkIsPalindrome(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an isPalindrome that ${name}`, () => {
      expect(() => checkIsPalindrome(impl)).toThrow();
    });
  }
});
```

%% hints
- Case: `'Racecar'` is `true`. Spaces: `'taco cat'` is `true`.
- Near-miss: `'abca'` is `false`. Odd length non-palindrome: `'abc'` is `false`.
- Empty string: `''` is `true`.

%% solution
```js
export function checkIsPalindrome(isPalindrome) {
  expect(isPalindrome('racecar')).toBe(true);
  expect(isPalindrome('Racecar')).toBe(true);
  expect(isPalindrome('taco cat')).toBe(true);
  expect(isPalindrome('abba')).toBe(true);
  expect(isPalindrome('abca')).toBe(false);
  expect(isPalindrome('abc')).toBe(false);
  expect(isPalindrome('ab')).toBe(false);
  expect(isPalindrome('')).toBe(true);
}
```

%% exercise tst-check-fizzbuzz | Tests for fizzBuzz | 2 | js | js | checkFizzBuzz | 16
`fizzBuzz(n)` returns an array for the numbers `1` to `n`: multiples of 3 become `'Fizz'`, multiples of 5 become `'Buzz'`, multiples of both become `'FizzBuzz'`, other numbers stay **numbers**. `fizzBuzz(0)` is `[]`. Write `checkFizzBuzz(fizzBuzz)` so it passes for a correct one and **fails** for: **checks 3 before 15**, **checks 5 before 15**, **starts at 0**, **returns numbers as strings**, **stops one short**.

```js
fizzBuzz(5); // [1, 2, 'Fizz', 4, 'Buzz']
```

%% worked
**A similar problem, solved: `checkRange(range)`** — tests for a list-returning function (`range(n)` returns `[1, …, n]`).

```js
export function checkRange(range) {
  expect(range(0)).toEqual([]);                  // ① the empty case
  expect(range(1)).toEqual([1]);                 // ② the smallest non-empty
  expect(range(5)).toEqual([1, 2, 3, 4, 5]);     // ③ the WHOLE list: catches off-by-one at either end and wrong types
}
```

For functions that return lists, **assert the whole list** with `toEqual` instead of spot-checking one element: it checks the **start, the end, the length and the types** all at once. And a bug that only appears at a special value (here: 15, a multiple of both 3 and 5) needs an `n` big enough to **reach** it.

%% explain
- **`toEqual` on the full result**.
- **`n` must reach 15** to expose the ordering bugs.
- **Numbers vs strings**: `1` is not `'1'`.
- **`fizzBuzz(0)`** is the empty list.

%% nudge
- Which value of `n` makes sure the multiple-of-15 case is in the output?
- Why is comparing the whole array better than checking a single index?

%% starter
```js
export function checkFizzBuzz(fizzBuzz) {
  expect(fizzBuzz(5)).toEqual([1, 2, 'Fizz', 4, 'Buzz']);
  // your assertions: the empty case, and a list long enough to include 15
}
```

%% tests
```js
const build = (rule, from = 1, to = (n) => n) => (n) => {
  const out = [];
  for (let i = from; i <= to(n); i++) out.push(rule(i));
  return out;
};
const correctRule = (i) => (i % 15 === 0 ? 'FizzBuzz' : i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : i);
const correct = build(correctRule);
const mutants = {
  'checks 3 before 15': build((i) => (i % 3 === 0 ? 'Fizz' : i % 5 === 0 ? 'Buzz' : i)),
  'checks 5 before 15': build((i) => (i % 5 === 0 ? 'Buzz' : i % 3 === 0 ? 'Fizz' : i)),
  'starts at 0': build(correctRule, 0, (n) => n - 1),
  'returns numbers as strings': build((i) => { const r = correctRule(i); return typeof r === 'number' ? String(r) : r; }),
  'stops one short': build(correctRule, 1, (n) => n - 1),
};

describe('your checkFizzBuzz', () => {
  it('passes on a correct fizzBuzz', () => {
    expect(() => checkFizzBuzz(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a fizzBuzz that ${name}`, () => {
      expect(() => checkFizzBuzz(impl)).toThrow();
    });
  }
});
```

%% hints
- `fizzBuzz(15)` should end with `'FizzBuzz'` — assert the whole array of 15 items.
- `expect(fizzBuzz(0)).toEqual([])` covers the empty case.

%% solution
```js
export function checkFizzBuzz(fizzBuzz) {
  expect(fizzBuzz(0)).toEqual([]);
  expect(fizzBuzz(1)).toEqual([1]);
  expect(fizzBuzz(15)).toEqual([1, 2, 'Fizz', 4, 'Buzz', 'Fizz', 7, 8, 'Fizz', 'Buzz', 11, 'Fizz', 13, 14, 'FizzBuzz']);
}
```

%% exercise tst-check-unique | Tests for unique | 3 | js | js | checkUnique | 24
`unique(array)` returns a **new** array with each value once, keeping the **first** occurrence and the **original order**. Values are compared with **strict equality** (`1` and `'1'` are different), falsy values like `0` and `''` are kept, `NaN` counts as equal to `NaN`, and the **input is not modified**. Write `checkUnique(unique)` so it passes for a correct one and **fails** for: **sorts the result**, **keeps the last occurrence**, **uses loose equality**, **drops falsy values**, **modifies its input**, **treats NaN as always different**.

```js
unique([3, 1, 2, 1, 3]); // [3, 1, 2]
```

%% worked
**A similar problem, solved: `checkReverse(reverse)`** — tests that include a **side-effect** check.

```js
export function checkReverse(reverse) {
  expect(reverse([1, 2, 3])).toEqual([3, 2, 1]);   // ① the main behaviour
  const input = [1, 2, 3];
  reverse(input);
  expect(input).toEqual([1, 2, 3]);                // ② the input must not change: catches an in-place reverse
  expect(reverse([])).toEqual([]);                 // ③ the empty list
}
```

Some bugs aren't about the **return value** at all: they're about **side effects**. To catch "modifies its input", keep a reference to the input and check it **after** the call. Other hidden bugs here depend on **special values**: loosely equal pairs (`1` and `'1'`), falsy values, `NaN`.

%% explain
- **Order of first occurrences**: `[3, 1, 2, 1, 3]` → `[3, 1, 2]` (not sorted, not last occurrences).
- **Strict equality** keeps `1` and `'1'` apart.
- **Falsy** values (`0`, `''`, `false`) stay.
- **Input unchanged**: check it after the call.
- **`NaN`** appears once.

%% nudge
- Which input makes "keep the first" and "keep the last" differ?
- How do you notice that the function changed the array you passed in?

%% starter
```js
export function checkUnique(unique) {
  expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
  // your assertions: loose vs strict equality, falsy values, NaN, input untouched
}
```

%% tests
```js
const correct = (a) => [...new Set(a)];
const mutants = {
  'sorts the result': (a) => [...new Set(a)].sort((x, y) => x - y),
  'keeps the last occurrence': (a) => a.filter((x, i) => a.lastIndexOf(x) === i),
  'uses loose equality': (a) => a.filter((x, i) => a.findIndex((y) => y == x) === i),
  'drops falsy values': (a) => [...new Set(a)].filter(Boolean),
  'modifies its input': (a) => { a.splice(0, a.length, ...new Set(a)); return a; },
  'treats NaN as always different': (a) => a.filter((x, i) => a.indexOf(x) === i),
};

describe('your checkUnique', () => {
  it('passes on a correct unique', () => {
    expect(() => checkUnique(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a unique that ${name}`, () => {
      expect(() => checkUnique(impl)).toThrow();
    });
  }
});
```

%% hints
- `[3, 1, 2, 1, 3]` → `[3, 1, 2]` rules out sorting and keeping the last occurrence.
- `[1, '1']` must stay `[1, '1']`. `[0, '', 0, false]` → `[0, '', false]`. `[NaN, NaN]` → `[NaN]`.
- Create `const input = [1, 1, 2]`, call `unique(input)`, then `expect(input).toEqual([1, 1, 2])`.

%% solution
```js
export function checkUnique(unique) {
  expect(unique([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
  expect(unique([])).toEqual([]);
  expect(unique([1, '1'])).toEqual([1, '1']);
  expect(unique([0, '', 0, false])).toEqual([0, '', false]);
  expect(unique([NaN, NaN])).toEqual([NaN]);
  const input = [1, 1, 2];
  unique(input);
  expect(input).toEqual([1, 1, 2]);
}
```

%% exercise tst-check-stack | Tests for a Stack | 3 | js | js | checkStack | 26
A `Stack` class has `push(x)` (adds on top and returns the **new size**), `pop()` (removes and returns the **top** item), `peek()` (returns the top item **without removing** it), and a `size` property. `pop()` and `peek()` on an **empty** stack return `undefined`. Write `checkStack(Stack)` — it receives the **class** — so it passes for a correct stack and **fails** for: **pops the oldest item (a queue)**, **peek removes the item**, **size is off by one**, **pop on empty throws**, **push returns nothing**, **pop doesn't remove**.

```js
const s = new Stack();
s.push('a'); s.push('b');
s.pop();  // 'b'
s.size;   // 1
```

%% worked
**A similar problem, solved: `checkCounter(Counter)`** — testing a class means testing **sequences of calls**, not just single methods.

```js
export function checkCounter(Counter) {
  const c = new Counter();
  expect(c.value).toBe(0);            // ① the starting state
  c.increment();
  c.increment();
  expect(c.value).toBe(2);            // ② state after a sequence
  c.reset();
  expect(c.value).toBe(0);            // ③ reset really resets
  expect(new Counter().value).toBe(0);   // ④ and each instance starts fresh
}
```

With objects, bugs hide in **state changes**: does a method really update what it should, and **only** what it should? Use a **fresh instance** per scenario so an earlier step can't mask a later bug. For the stack: push several items, pop them all, and also check the **size** and **empty** behaviour at each step.

%% explain
- **Fresh `new Stack()`** for each scenario.
- **Order**: last in, first out.
- **`peek` leaves the stack unchanged**; `pop` removes.
- **Empty**: `pop()` and `peek()` return `undefined` and don't throw.
- **`push` returns the new size**; `size` tracks it.

%% nudge
- Which sequence of calls shows the difference between a stack and a queue?
- How would you notice that `pop` returned the right value but forgot to remove it?

%% starter
```js
export function checkStack(Stack) {
  const s = new Stack();
  s.push('a');
  s.push('b');
  expect(s.pop()).toBe('b');
  // your assertions: size, peek, empty, push's return value, pop really removing
}
```

%% tests
```js
class Correct {
  constructor() { this.items = []; }
  push(x) { this.items.push(x); return this.items.length; }
  pop() { return this.items.pop(); }
  peek() { return this.items[this.items.length - 1]; }
  get size() { return this.items.length; }
}
const variant = (patch) => { class V extends Correct {} Object.defineProperties(V.prototype, Object.getOwnPropertyDescriptors(patch)); return V; };
const mutants = {
  'pops the oldest item': variant({ pop() { return this.items.shift(); } }),
  'lets peek remove the item': variant({ peek() { return this.items.pop(); } }),
  'reports a size that is off by one': variant({ get size() { return this.items.length + 1; } }),
  'throws when popping an empty stack': variant({ pop() { if (!this.items.length) throw new Error('empty'); return this.items.pop(); } }),
  'does not return the new size from push': variant({ push(x) { this.items.push(x); } }),
  'forgets to remove on pop': variant({ pop() { return this.items[this.items.length - 1]; } }),
};

describe('your checkStack', () => {
  it('passes on a correct Stack', () => {
    expect(() => checkStack(Correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a Stack that ${name}`, () => {
      expect(() => checkStack(impl)).toThrow();
    });
  }
});
```

%% hints
- Push `'a'` then `'b'`: `pop()` is `'b'`, then `'a'`. A queue would give `'a'` first.
- After one `pop`, check `s.size` is smaller by one, and that a second `pop` returns the next item.
- Empty stack: `expect(new Stack().pop()).toBeUndefined()` and the same for `peek()`.

%% solution
```js
export function checkStack(Stack) {
  const s = new Stack();
  expect(s.size).toBe(0);
  expect(s.pop()).toBeUndefined();
  expect(s.peek()).toBeUndefined();
  expect(s.push('a')).toBe(1);
  expect(s.push('b')).toBe(2);
  expect(s.size).toBe(2);
  expect(s.peek()).toBe('b');
  expect(s.size).toBe(2);
  expect(s.pop()).toBe('b');
  expect(s.size).toBe(1);
  expect(s.pop()).toBe('a');
  expect(s.size).toBe(0);
  expect(s.pop()).toBeUndefined();
}
```
