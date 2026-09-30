---
id: closures
track: js
title: Closures & scope
summary: How a function can remember its surroundings — the idea behind callbacks, React hooks, private state and most "trick" interview questions.
---

## The idea in one sentence

A **closure** is a function that *remembers the variables from the place where it was created* — even after that place has finished running.

That's it. If you can picture a function carrying a little backpack of variables wherever it goes, you already understand closures. The rest of this lesson makes that picture precise, step by step.

> **Analogy** Imagine a waiter leaving for a shift with a backpack. Inside: the pen and the notepad they were handed at the start of the day. Hours later, in a different room, they still use *that* pen and *that* notepad. A closure is a function that was handed some variables when it was created and keeps using them wherever it is later called.

![Function makeCounter finishes, but the function it returns carries the variable count in a backpack](fig:closure-backpack "① makeCounter runs and creates `count`. ② It returns a function. ③ That function keeps `count` in its backpack.")

Read the picture from left to right: ① `makeCounter()` creates a variable, then finishes. ② It hands back a new function. ③ The function carries the variable it needs with it. That backpack is the closure.

## First, what is "scope"?

Before closures make sense, we need one earlier idea: **scope**. Scope answers a simple question — *"from this line of code, which variables can I see?"*

- A variable you create **inside a function** can be seen only **inside that function** (and inside functions nested in it).
- A variable created **outside everything** ("global") can be seen from everywhere.

Functions can be nested like boxes inside boxes. When your code uses a name, JavaScript looks for it in the **innermost box first**. If it isn't there, it steps **one box outward**, and keeps going until it finds it (or runs out of boxes and gives a `ReferenceError`). This chain of boxes is called the **scope chain**.

![Three nested boxes: global contains outer which contains inner; a lookup starts in inner and walks outward](fig:scope-chain "① Global, ② outer, ③ inner. `inner` finds `c` right away, but has to walk outward to find `b` and `a`.")

Try it. **Before you press Run**, guess what gets printed — then check.

```js try predict
const a = 'global';

function outer() {
  const b = 'outer';

  function inner() {
    const c = 'inner';
    console.log(a, b, c);
  }

  inner();
}

outer();
```

Notice that scope is decided by **where you wrote the code**, not by where it runs. That's called **lexical scope** ("lexical" just means "by position in the source text"). Closures are a direct consequence of it.

## Walking through a closure, one step at a time

Here is the smallest useful closure: a counter. Use **Next** to step through. Watch the two panels on the right — they show what JavaScript is holding in memory.

```stepper A counter that remembers
code:
  function makeCounter() {
    let count = 0;
    return function () {
      count = count + 1;
      return count;
    };
  }
  const a = makeCounter();
  a();
  a();
---
line: 1-7
say: JavaScript reads the definition of `makeCounter` and stores it. **Nothing inside it runs yet** — defining a function is not calling it.
makeCounter's variables:
a's backpack:
a() returned:
---
line: 8
say: We **call** `makeCounter()`. JavaScript opens a fresh, private set of variables just for this call.
makeCounter's variables: (nothing yet)
---
line: 2
say: `let count = 0` creates a variable inside that private set.
makeCounter's variables: count = 0
---
line: 3-6
say: A new function is created and returned. Because it was *created here*, it remembers where it came from and packs `count` into its backpack.
a's backpack: count = 0
---
line: 8
say: `makeCounter` has finished, and the returned function is stored in `a`. Normally the variables of a finished call are thrown away — but `a` still needs `count`, so it stays alive in the backpack.
makeCounter's variables: (finished)
a's backpack: count = 0
---
line: 9
say: First call: `a()`. The function body runs.
---
line: 4
say: `count` isn't declared inside the function body, so JavaScript looks **outward** — and finds it in the backpack. Its value is `0`, so `count + 1` is `1`, and the backpack is updated.
a's backpack: count = 1
---
line: 5
say: The function returns `1`.
a() returned: 1
---
line: 10
say: Second call: `a()`. The backpack still holds `1` from last time, so this call sets it to `2` and returns `2`. **The value survived between calls.** That's a closure.
a's backpack: count = 2
a() returned: 1 | 2
```

Now watch the same thing as an animation — each call reads the value from the backpack, adds one, and puts it back:

![Animation of a counter function reading and updating the count stored in its backpack](fig:closure-alive "Each call reads `count` from the backpack and saves the new value. The backpack outlives every individual call.")

Press **Run** and change things — call `counter()` more times, rename the variable, add a second counter:

```js try
function makeCounter() {
  let count = 0;
  return function () {
    count = count + 1;
    return count;
  };
}

const counter = makeCounter();
console.log(counter());
console.log(counter());
console.log(counter());
```

> **Remember** The backpack holds the **variable itself**, not a copy of its value at the time. That's why the number kept growing: every call changed the *same* `count`.

## Every call gets its own backpack

What happens if we call `makeCounter()` twice? Each call creates a **brand-new set of variables**, so each returned function gets its **own** backpack. They never interfere:

```js try predict
function makeCounter() {
  let count = 0;
  return () => ++count;
}

const a = makeCounter();
const b = makeCounter();

console.log(a());
console.log(a());
console.log(b());
```

(`++count` means "add one to `count`, then use the new value". `() => ++count` is just a shorter way to write the function from before.)

Two functions created **in the same place** *do* share a backpack, though. That's how you can build private state with a public "remote control":

```js try
function createWallet() {
  let balance = 0; // private: nobody outside can touch this directly

  return {
    deposit(amount) { balance += amount; },
    read() { return balance; },
  };
}

const wallet = createWallet();
wallet.deposit(50);
wallet.deposit(25);
console.log(wallet.read());
console.log(wallet.balance); // undefined — there is no way in
```

`deposit` and `read` were created inside the same call, so they look at the **same** `balance`. Outside code can only change it through them.

## Where you'll actually meet closures

You have used closures many times without naming them.

**1 · Function factories** — a function that builds customised functions:

```js try
function makePriceFormatter(currency) {
  return function (amount) {
    return currency + amount.toFixed(2);
  };
}

const usd = makePriceFormatter('$');
const eur = makePriceFormatter('€');
console.log(usd(4.5));
console.log(eur(12));
```

`usd` and `eur` are the same code with different backpacks (`'$'` vs `'€'`).

**2 · Callbacks** — every time you write `setTimeout(() => …)` or `button.addEventListener('click', () => …)`, the arrow function remembers the variables around it:

```js try
function remindLater(name, ms) {
  setTimeout(() => {
    console.log('Hey ' + name + ', it has been ' + ms + 'ms!');
  }, ms);
}

remindLater('Ada', 200);
remindLater('Grace', 100);
```

`remindLater` returned long before the messages appeared. The arrow functions kept `name` and `ms` in their backpacks until the timers fired.

**3 · React hooks** — every event handler you write inside a component closes over that render's props and state. You'll see the good *and* bad sides of that in the React track.

**4 · Wrappers around other functions** — `once`, `memoize`, `debounce`, `throttle`. All of them are "a function that holds a bit of state in its backpack and then calls your function". Exactly what the exercises below are about.

## Common mistakes

### Mistake 1 — the `var` loop trap

```js try predict
const fns = [];
for (var i = 0; i < 3; i++) {
  fns.push(() => console.log(i));
}
fns.forEach((f) => f());
```

You'd expect `0 1 2`. You get `3 3 3`. Why?

- `var` creates **one** variable `i` for the *whole loop*.
- The three arrow functions are created during the loop, but **not run** until after it.
- By the time they run, the loop has finished and `i` is `3`. All three look at that **same** variable.

![With var, three callbacks share one variable that ends at 3. With let, each loop turn gets its own variable.](fig:var-loop-trap "With `var` (left) there is one shared box. With `let` (right) every turn of the loop gets a fresh box, so each callback keeps its own number.")

**Fix:** use `let` instead. A `let` in a `for` loop creates a **new variable on every turn**, so each arrow function gets its own backpack:

```js try
const fns = [];
for (let i = 0; i < 3; i++) {
  fns.push(() => console.log(i));
}
fns.forEach((f) => f());
```

> **Good to know** Before `let` existed, people fixed this with an "IIFE" — a function that is created and called on the spot to make a fresh scope: `(function (j) { fns.push(() => j); })(i)`. Old code is full of it, and interviewers still ask about it.

### Mistake 2 — capturing a *value* that later goes stale

A closure keeps a reference to the **variable**. But if you copy the value out first, your copy won't update:

```js try predict
function makeLogger(user) {
  const name = user.name;            // copy of the value, taken now
  return () => console.log(name);
}

const user = { name: 'Ada' };
const log = makeLogger(user);
user.name = 'Grace';
log();
```

It prints `Ada`, not `Grace` — `name` is a snapshot. If you had written `console.log(user.name)` inside the returned function, you'd see the change, because then it reads `user` (the variable) each time.

This exact bug — "my callback is using old data" — is the most common React hooks bug. Remember it; we meet it again in the React track.

### Mistake 3 — forgetting that a backpack keeps things alive

A closure keeps everything it references from being cleaned up. If a long-lived callback captures a huge array you no longer need, that memory can't be freed. It's rarely a problem — but if you attach listeners that live forever, clean them up.

## Quick check

Answer these without running any code — then read the explanation for each.

```check
Q: What does a closure "remember"?
A) A copy of each variable's value from when the function was created
B) Only variables declared with `const`
C) The variables themselves, from the place where the function was created *
D) Everything that was printed to the console
Why: The backpack holds **references to the variables**, not frozen copies. That's why `count` could keep growing between calls.
---
Q: What do the three lines print?
Code:
  function makeCounter() {
    let n = 0;
    return () => ++n;
  }
  const a = makeCounter();
  const b = makeCounter();
  a(); a();
  console.log(a(), b());
A) 3 3
B) 3 1 *
C) 1 1
D) 2 1
Why: Each `makeCounter()` call creates its own `n`. `a` was called three times (→ 3), `b` only once (→ 1).
---
Q: After `makeCounter()` has returned, what happens to its variable `count`?
A) It stays alive as long as the returned function can still reach it *
B) It is deleted immediately, so the returned function breaks
C) It becomes a global variable
D) It resets to 0 on every call
Why: JavaScript only cleans up variables nothing can reach any more. The returned function still reaches `count`, so it is kept.
---
Q: With `var`, why do all callbacks in the loop see the same number?
A) `var` is slower than `let`
B) Arrow functions copy values
C) `setTimeout` changes the variable
D) `var` creates one variable for the whole loop, shared by all callbacks *
Why: `var` is function-scoped: one `i` for the entire loop. `let` makes a fresh `i` per turn.
```

## Recap

- **Scope** = which variables a line of code can see. Lookup goes from the innermost box **outward**.
- A **closure** is a function plus the variables from where it was *created* (its backpack). It works even after the outer function has finished.
- The backpack holds the **variable**, not a copy. Changes made by one call are seen by the next.
- Each call of the outer function makes a **new** backpack. Functions created in the *same* call share one.
- Use closures for **private state**, **factories** and **wrappers** (`once`, `memoize`, `debounce`).
- Traps: `var` in loops (use `let`) and copying a value out of an object (it goes stale).

## Before you start the exercises

The exercises go from a guided warm-up to real interview problems. Here is which part of this lesson each one needs:

| Exercise | You'll need |
| --- | --- |
| Guided: greeting maker | "Walking through a closure" and the factory example |
| Counter factory | "Every call gets its own backpack" |
| `once()` | Wrappers: a function that keeps a flag in its backpack, then calls yours |
| The loop trap | "Mistake 1 — the `var` loop trap" |
| A tiny store | Shared private state (`createWallet`) + holding a list of listeners in the backpack |
| `memoize()` | Wrappers again — a backpack that holds a cache (a `Map`) |

Stuck on any of them? Each exercise has a **worked example** with a solved, annotated problem of the same shape, a plain-English list of **what the tests check**, and gentle **nudges** before the hints.

%% exercise closures-guided-greeter | Guided: greeting maker | 1 | js | js | makeGreeter | 4 | guided
Build `makeGreeter(greeting)`. It returns a function that takes a `name` and gives back `"<greeting>, <name>!"`.

```js
const hello = makeGreeter('Hello');
const yo = makeGreeter('Yo');
hello('Ada'); // "Hello, Ada!"
yo('Grace');  // "Yo, Grace!"
```

The skeleton is already started for you — follow the numbered steps in the comments. This is the same shape as the counter you stepped through in the lesson: an outer function holds a variable, and the function it returns uses it.

%% worked
**A similar problem, solved: `makeAdder(n)`** — returns a function that adds `n` to whatever it is given.

```js
function makeAdder(n) {          // ① n is the outer variable (it goes in the backpack)
  return function (x) {          // ② the returned function takes its own input, x
    return x + n;                // ③ it uses BOTH: x (its own) and n (from the backpack)
  };
}

const add5 = makeAdder(5);
add5(10); // 15
```

① `n` arrives as a parameter of the outer function — parameters live in the outer scope just like `let` variables.
② The inner function is created *inside* `makeAdder`, so it can see `n`.
③ When `add5(10)` runs, `x` is `10` and `n` is `5` (from the backpack), so the result is `15`.

Your task has exactly the same structure; the only difference is that you build a string instead of adding numbers.

%% explain
- **Each greeter remembers its own greeting** — `hello` and `yo` must not affect each other (that's the "own backpack" rule).
- **The greeting is fixed when you create the greeter**, even if the variable you passed in changes later.
- **The output format is exact**: a comma and space after the greeting, and an exclamation mark at the end.

%% nudge
- Which variable does the *inner* function need that it doesn't get as a parameter?
- A template string `` `${a}, ${b}!` `` is the tidiest way to glue the pieces together.

%% starter
```js
export function makeGreeter(greeting) {
  // Step 1 — return a new function. It takes one parameter: name.
  return function (name) {
    // Step 2 — build the text "<greeting>, <name>!" using BOTH variables.
    //          (greeting comes from the backpack, name is this function's own parameter)
    // Step 3 — return that text.
  };
}
```

%% tests
```js
describe('makeGreeter', () => {
  it('returns a function', () => {
    expect(typeof makeGreeter('Hello')).toBe('function');
  });

  it('greets by name', () => {
    expect(makeGreeter('Hello')('Ada')).toBe('Hello, Ada!');
  });

  it('every greeter remembers its own greeting', () => {
    const hello = makeGreeter('Hello');
    const yo = makeGreeter('Yo');
    expect(yo('Grace')).toBe('Yo, Grace!');
    expect(hello('Linus')).toBe('Hello, Linus!');
  });

  it('keeps the greeting it was created with', () => {
    let word = 'Hi';
    const greet = makeGreeter(word);
    word = 'Bye';
    expect(greet('Sam')).toBe('Hi, Sam!');
  });
});
```

%% hints
- Inside the inner function you can use both `greeting` and `name`.
- Return a string: `` `${greeting}, ${name}!` ``.

%% solution
```js
export function makeGreeter(greeting) {
  return function (name) {
    return `${greeting}, ${name}!`;
  };
}
```

%% exercise closures-counter | Counter factory | 1 | js | js | makeCounter | 4
Write `makeCounter()`. Each call returns a **new, independent** function. Calling that function returns `1`, then `2`, then `3`, and so on.

```js
const a = makeCounter();
const b = makeCounter();
a(); // 1
a(); // 2
b(); // 1
```

%% starter
```js
export function makeCounter() {
  // your code
}
```

%% tests
```js
describe('makeCounter', () => {
  it('counts up from 1', () => {
    const next = makeCounter();
    expect([next(), next(), next()]).toEqual([1, 2, 3]);
  });

  it('gives every counter its own state', () => {
    const a = makeCounter();
    const b = makeCounter();
    a(); a();
    expect(b()).toBe(1);
    expect(a()).toBe(3);
  });

  it('does not leak state through a module-level variable', () => {
    const first = makeCounter();
    first(); first();
    const later = makeCounter();
    expect(later()).toBe(1);
  });
});
```

%% worked
**A similar problem, solved: `makeStepper(step)`** — returns a function that counts up by `step` each call, starting from 0.

```js
function makeStepper(step) {
  let total = 0;            // ① private state: lives in makeStepper, outside the returned function
  return () => {
    total += step;          // ② the returned function reads AND updates it
    return total;
  };
}

const byTwo = makeStepper(2);
byTwo(); // 2
byTwo(); // 4
const byTen = makeStepper(10);
byTen(); // 10   ← a separate backpack
```

The recipe: **(1)** declare the variable in the outer function, **(2)** return a function that changes it, **(3)** call the outer function once per independent counter.

%% explain
- **Counts 1, 2, 3** — the first call returns `1`, not `0`.
- **Independent counters** — calling `a()` must never change what `b()` returns. That proves the state is per-call, not shared.
- **No module-level variable** — if you stored `count` outside `makeCounter`, a new counter would continue from where the old one stopped. The third test catches that.

%% nudge
- Where should `count` be declared so each `makeCounter()` call gets a fresh one?
- What does `++count` return — the old value or the new one?

%% hints
- The state must live *inside* `makeCounter`, but outside the function you return.
- `let count = 0;` then return `() => ++count`.

%% solution
```js
export function makeCounter() {
  let count = 0;
  return () => ++count;
}
```

%% exercise closures-once | once() | 2 | js | js | once | 8
Write `once(fn)`. It returns a function that calls `fn` **the first time only** and then keeps returning that first result, ignoring later arguments.

```js
const init = once(() => { console.log('booting'); return 42; });
init(); // logs "booting", returns 42
init(); // returns 42, no log
```

The wrapper must forward its arguments and `this` to `fn` on that first call.

%% starter
```js
export function once(fn) {
  // your code
}
```

%% tests
```js
describe('once', () => {
  it('calls the function only once', () => {
    const fn = jest.fn(() => 'x');
    const wrapped = once(fn);
    wrapped(); wrapped(); wrapped();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns the first result every time', () => {
    let n = 0;
    const wrapped = once(() => ++n);
    expect([wrapped(), wrapped(), wrapped()]).toEqual([1, 1, 1]);
  });

  it('forwards arguments on the first call and ignores later ones', () => {
    const fn = jest.fn((a, b) => a + b);
    const wrapped = once(fn);
    expect(wrapped(2, 3)).toBe(5);
    expect(wrapped(10, 20)).toBe(5);
    expect(fn).toHaveBeenCalledWith(2, 3);
  });

  it('preserves `this`', () => {
    const obj = { v: 7, get: once(function () { return this.v; }) };
    expect(obj.get()).toBe(7);
  });

  it('remembers a first result of undefined (does not re-run)', () => {
    const fn = jest.fn(() => undefined);
    const wrapped = once(fn);
    wrapped(); wrapped();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('each once() has its own flag', () => {
    const a = once(() => 'a');
    const b = once(() => 'b');
    a();
    expect(b()).toBe('b');
  });
});
```

%% worked
**A similar problem, solved: `countCalls(fn)`** — wraps `fn` and keeps track of how many times it was called, while still behaving like `fn`.

```js
function countCalls(fn) {
  let calls = 0;                       // ① state in the backpack
  function wrapper(...args) {          // ② ...args collects every argument into an array
    calls += 1;
    return fn.apply(this, args);       // ③ forward the arguments AND `this` to the real function
  }
  wrapper.getCalls = () => calls;      // ④ functions are objects, so you can attach extras
  return wrapper;
}

const add = countCalls((a, b) => a + b);
add(1, 2);        // 3
add(3, 4);        // 7
add.getCalls();   // 2
```

For `once`, swap the counter for **two** variables: a flag `called` and the stored `result`. On the first call run `fn`, store its result, flip the flag. On later calls skip straight to returning the stored result.

%% explain
- **Only runs once** — `fn` is called on the first call and never again (tests count calls with a mock).
- **Returns the first result every time** — later calls return the *same* value even if you pass different arguments.
- **Forwards arguments and `this`** — on the first call `fn` must receive exactly what the wrapper received.
- **Remembers "falsy" results too** — if `fn` returned `0` or `undefined`, it still must not run again. (Hint: don't use `if (result)` as your check; use a separate flag.)

%% nudge
- What two things does the wrapper need to remember between calls?
- Why is `if (result)` a risky way to detect "already ran"?

%% hints
- You need two pieces of closed-over state: *has it run?* and *what did it return?*
- Checking `result === undefined` is a bug — a function may legitimately return `undefined`. Use a boolean flag.
- A regular `function` wrapper (not an arrow) lets you use `fn.apply(this, args)`.

%% solution
```js
export function once(fn) {
  let called = false;
  let result;
  return function (...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}
```

%% exercise closures-loop-trap | The loop trap | 2 | js | js | makeThunks | 6
`makeThunks(n)` should return an array of `n` functions, where the function at index `k` returns `k`. The version below returns `n` for all of them.

Fix it **without changing its shape** (still a loop pushing functions into an array).

%% starter
```js
export function makeThunks(n) {
  var fns = [];
  for (var i = 0; i < n; i++) {
    fns.push(function () {
      return i;
    });
  }
  return fns;
}
```

%% tests
```js
describe('makeThunks', () => {
  it('returns n functions', () => {
    expect(makeThunks(4)).toHaveLength(4);
    makeThunks(4).forEach((f) => expect(typeof f).toBe('function'));
  });

  it('each thunk returns its own index', () => {
    expect(makeThunks(3).map((f) => f())).toEqual([0, 1, 2]);
  });

  it('is stable when called after the loop is long finished', () => {
    const fns = makeThunks(5);
    expect(fns[4]()).toBe(4);
    expect(fns[0]()).toBe(0);
  });

  it('handles n = 0', () => {
    expect(makeThunks(0)).toEqual([]);
  });
});
```

%% worked
**A similar problem, solved: `makeLabels(names)`** — should return functions that each return their own name, but the loop below is broken.

```js
// Broken: every function returns the LAST name
var out = [];
for (var k = 0; k < names.length; k++) {
  out.push(() => names[k]);     // `k` is shared — it ends as names.length
}

// Fix 1 — the one-word fix: let gives every turn its own `k`
for (let k = 0; k < names.length; k++) {
  out.push(() => names[k]);
}

// Fix 2 — no loop variable at all: each callback gets its own copy
names.forEach((name) => out.push(() => name));
```

Both fixes give every function its own backpack. Your exercise: apply Fix 1 (or the older "IIFE" trick if you feel brave).

%% explain
- **Right length** — you must still return `n` functions.
- **Each function returns its own index** — `[0, 1, 2]`, not `[3, 3, 3]`.
- **Stable later** — calling the functions long after the loop has finished still gives the right number.
- **`n = 0`** — an empty array, no crash.

%% nudge
- How many `i` variables does the `var` loop create? How many would `let` create?
- You only need to change **one word** in the starter.

%% hints
- There is only one `i`, shared by every function. The value it holds when they finally run is `n`.
- Two fixes: switch to `let`, or copy `i` into a fresh scope with an IIFE.

%% solution
```js
export function makeThunks(n) {
  const fns = [];
  for (let i = 0; i < n; i++) {
    fns.push(() => i);
  }
  return fns;
}
```

%% exercise closures-store | A tiny store | 3 | js | js | createStore | 15
Build `createStore(initialState)` — the core of Redux/Zustand in ~15 lines. It returns an object with:

- `getState()` → the current state.
- `setState(patch)` → `patch` is either an object to **shallow-merge** into state, or a function `(state) => partialObject`.
- `subscribe(listener)` → registers `listener(state, prevState)`; returns an `unsubscribe` function.

Rules:
- State is **never mutated** — every `setState` produces a new object, and `prevState` must still be the old one.
- Listeners run after the state has changed, in subscription order.
- Unsubscribing twice is harmless.
- A listener that unsubscribes *itself* while being notified must not cause other listeners to be skipped.

%% starter
```js
export function createStore(initialState) {
  // your code
}
```

%% tests
```js
describe('createStore', () => {
  it('returns the initial state', () => {
    const s = createStore({ n: 1 });
    expect(s.getState()).toEqual({ n: 1 });
  });

  it('merges object patches', () => {
    const s = createStore({ a: 1, b: 2 });
    s.setState({ b: 3 });
    expect(s.getState()).toEqual({ a: 1, b: 3 });
  });

  it('accepts an updater function', () => {
    const s = createStore({ n: 1 });
    s.setState((st) => ({ n: st.n + 1 }));
    s.setState((st) => ({ n: st.n + 1 }));
    expect(s.getState().n).toBe(3);
  });

  it('never mutates the previous state object', () => {
    const initial = { n: 1 };
    const s = createStore(initial);
    const before = s.getState();
    s.setState({ n: 2 });
    expect(before).toEqual({ n: 1 });
    expect(initial).toEqual({ n: 1 });
    expect(s.getState()).not.toBe(before);
  });

  it('notifies subscribers with (state, prevState)', () => {
    const s = createStore({ n: 0 });
    const spy = jest.fn();
    s.subscribe(spy);
    s.setState({ n: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ n: 1 }, { n: 0 });
  });

  it('getState inside a listener already sees the new state', () => {
    const s = createStore({ n: 0 });
    let seen;
    s.subscribe(() => { seen = s.getState().n; });
    s.setState({ n: 9 });
    expect(seen).toBe(9);
  });

  it('calls listeners in subscription order', () => {
    const s = createStore({});
    const order = [];
    s.subscribe(() => order.push('a'));
    s.subscribe(() => order.push('b'));
    s.setState({ x: 1 });
    expect(order).toEqual(['a', 'b']);
  });

  it('unsubscribe stops notifications, and is idempotent', () => {
    const s = createStore({ n: 0 });
    const spy = jest.fn();
    const off = s.subscribe(spy);
    s.setState({ n: 1 });
    off();
    off();
    s.setState({ n: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('a listener unsubscribing itself does not skip the next listener', () => {
    const s = createStore({ n: 0 });
    const second = jest.fn();
    const off = s.subscribe(() => off());
    s.subscribe(second);
    s.setState({ n: 1 });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps separate stores independent', () => {
    const a = createStore({ n: 1 });
    const b = createStore({ n: 1 });
    a.setState({ n: 5 });
    expect(b.getState().n).toBe(1);
  });
});
```

%% worked
**A similar problem, solved: `createToggle()`** — a little on/off switch that tells listeners when it flips. It has the same three ingredients as the store: *private state*, *methods that change it*, and *a list of listeners*.

```js
function createToggle() {
  let on = false;                 // ① private state
  const listeners = [];           // ② a list of functions to notify

  return {
    get: () => on,
    flip() {
      on = !on;                   // ③ change the state first…
      listeners.forEach((l) => l(on));   // ④ …then tell everyone
    },
    subscribe(listener) {
      listeners.push(listener);
      return () => {              // ⑤ return an "unsubscribe" function (another closure!)
        const i = listeners.indexOf(listener);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
  };
}
```

What changes for the store: the state is an object that you **replace** (never edit in place), and the listener also receives the *previous* state. Watch out for ⑤: removing items from an array **while looping over it** can skip listeners — loop over a *copy* (`[...listeners]`).

%% explain
- **`getState`** returns the current state; **`setState`** merges a patch (object or function) into it.
- **Never mutate** — after `setState`, the old state object must be unchanged, and the new one must be a *different* object.
- **Listeners get `(state, prevState)`** and run after the change, in the order they subscribed.
- **Unsubscribe works and is safe to call twice.**
- **A listener may unsubscribe itself while being notified** without causing other listeners to be skipped.

%% nudge
- Keep `state` and `listeners` as variables in `createStore`'s scope — the returned methods close over them.
- To avoid mutation: `state = { ...state, ...patch }` creates a **new** object.
- If you loop over `listeners` directly and one removes itself mid-loop, what happens to the next index?

%% hints
- State and the listener set are the two closed-over variables. No classes needed.
- Store listeners in a `Set` (or array) and iterate over a **copy** when notifying: `[...listeners].forEach(...)`.
- `typeof patch === 'function' ? patch(state) : patch`, then `state = { ...state, ...partial }`.

%% solution
```js
export function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState(patch) {
      const prev = state;
      const partial = typeof patch === 'function' ? patch(prev) : patch;
      state = { ...prev, ...partial };
      [...listeners].forEach((l) => l(state, prev));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
```

%% exercise closures-memoize | memoize() | 3 | js | js | memoize | 15
Write `memoize(fn, resolver?)`.

- Cache results by arguments. By default the cache key is `JSON.stringify(args)`.
- If `resolver` is given, the key is `resolver(...args)` instead.
- A cached result of `undefined` (or `null`, `0`, `false`) is still a cache hit.
- If `fn` **throws**, nothing is cached and the error propagates.
- The returned function has a `.clear()` method that empties the cache.
- `this` is forwarded to `fn`.

%% starter
```js
export function memoize(fn, resolver) {
  // your code
}
```

%% tests
```js
describe('memoize', () => {
  it('computes once per distinct argument list', () => {
    const fn = jest.fn((a, b) => a + b);
    const m = memoize(fn);
    expect(m(1, 2)).toBe(3);
    expect(m(1, 2)).toBe(3);
    expect(m(2, 1)).toBe(3);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('treats different argument shapes as different keys', () => {
    const fn = jest.fn((...a) => a.length);
    const m = memoize(fn);
    m(1); m(1, undefined); m();
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('caches falsy results, including undefined', () => {
    const fn = jest.fn(() => undefined);
    const m = memoize(fn);
    m('k'); m('k');
    const zero = jest.fn(() => 0);
    const mz = memoize(zero);
    mz(); mz();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(zero).toHaveBeenCalledTimes(1);
  });

  it('supports a custom resolver', () => {
    const fn = jest.fn((user) => user.name.toUpperCase());
    const m = memoize(fn, (user) => user.id);
    expect(m({ id: 1, name: 'ada' })).toBe('ADA');
    expect(m({ id: 1, name: 'changed' })).toBe('ADA');
    expect(m({ id: 2, name: 'bob' })).toBe('BOB');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not cache thrown errors', () => {
    let attempts = 0;
    const m = memoize(() => {
      attempts++;
      if (attempts === 1) throw new Error('boom');
      return 'ok';
    });
    expect(() => m()).toThrow('boom');
    expect(m()).toBe('ok');
    expect(m()).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('exposes clear()', () => {
    const fn = jest.fn((x) => x * 2);
    const m = memoize(fn);
    m(2); m(2);
    m.clear();
    m(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('forwards this', () => {
    const obj = { k: 10, calc: memoize(function (x) { return this.k + x; }) };
    expect(obj.calc(5)).toBe(15);
  });

  it('keeps caches of separate memoized functions apart', () => {
    const a = memoize((x) => `a${x}`);
    const b = memoize((x) => `b${x}`);
    a(1);
    expect(b(1)).toBe('b1');
  });
});
```

%% worked
**A similar problem, solved: `cacheLast(fn)`** — remembers only the most recent call, so calling twice with the same argument skips the work.

```js
function cacheLast(fn) {
  let hasValue = false;     // ① did we store anything yet? (don't trust the value itself —
  let lastArg;              //    `undefined` could be a real result)
  let lastResult;
  return function (arg) {
    if (hasValue && arg === lastArg) return lastResult;   // ② cache hit
    lastResult = fn(arg);                                 // ③ cache miss: do the work…
    lastArg = arg;                                        //    …and remember it
    hasValue = true;
    return lastResult;
  };
}
```

`memoize` is the grown-up version: instead of three variables, keep a **`Map`** in the backpack (key → result), and ask `cache.has(key)` rather than checking the value — for the same reason as ①. Also notice the order in ③: we only store *after* `fn` succeeds, so an error caches nothing.

%% explain
- **Same arguments → same result, without calling `fn` again** (tests count calls).
- **Different arguments → `fn` runs again.**
- **A custom `resolver` decides the cache key** when given; otherwise the key is `JSON.stringify(args)`.
- **Falsy results are cached too** — `0`, `false`, `null`, `undefined` are valid results, so use `Map.has`, not truthiness.
- **Errors aren't cached** — if `fn` throws, the next call tries again.
- **`.clear()`** empties the cache. **`this`** is forwarded to `fn`.

%% nudge
- What data structure lets you ask "have I seen this key before?" — and how do you ask it without trusting the stored value?
- In what order must you call `fn` and store the result so a throw doesn't leave a bad entry?

%% hints
- A `Map` keyed by the computed key. Use `cache.has(key)` — *not* `cache.get(key) !== undefined`.
- Only call `cache.set` after `fn` returns, so a throw leaves the cache untouched.
- Functions are objects: `memoized.clear = () => cache.clear()`.

%% solution
```js
export function memoize(fn, resolver) {
  const cache = new Map();

  function memoized(...args) {
    const key = resolver ? resolver(...args) : JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  }

  memoized.clear = () => cache.clear();
  return memoized;
}
```
