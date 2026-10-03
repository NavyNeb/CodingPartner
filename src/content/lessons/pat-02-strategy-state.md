---
id: pat-strategy-state
track: pat
title: Strategy & state
summary: Replacing if/else chains with swappable functions (strategy) and with an explicit table of states and allowed transitions (state), including pluggable validation rules, a small state machine and backoff policies.
---

## The idea in one sentence

**Strategy** makes *how something is done* a swappable value; **state** makes *what an object is allowed to do right now* an explicit table. Both replace tangled `if/else` chains with data.

> **Analogy** A navigation app. *Strategy*: "fastest", "shortest" and "avoid tolls" are interchangeable ways to compute a route; the app around them doesn't change. *State*: a ride-share trip is "requested", "driver assigned", "in progress" or "completed", and only some actions make sense in each (you can't "complete" a trip that was never started).

## Strategy: pass the algorithm in

Whenever you write `if (type === 'a') … else if (type === 'b') …` and the list keeps growing, the varying part wants to be a **function you pass in**.

![A strategy slot](fig:pat-strategy "The surrounding algorithm stays put; the interchangeable part is a function.")

```js try predict
const strategies = {
  none: (price) => price,
  tenPercent: (price) => price * 0.9,
  fiveOff: (price) => Math.max(0, price - 5),
};

function checkout(items, discount = strategies.none) {
  const subtotal = items.reduce((sum, i) => sum + i.price, 0);
  return discount(subtotal);
}

console.log(checkout([{ price: 40 }, { price: 60 }], strategies.tenPercent));
console.log(checkout([{ price: 3 }], strategies.fiveOff));
```

JavaScript already uses strategy everywhere: `array.sort(compareFn)`, `array.map(fn)`, `replace(regex, fn)`. In class-based languages strategy needs an interface and several classes; here it's **just a function**.

Benefits: adding a new discount **doesn't touch** `checkout`, each strategy is **tested alone**, and you can choose one at runtime from a lookup table instead of a `switch`.

## State: make the situation explicit

Many objects behave differently depending on **what stage they're in**. The tempting model is a handful of booleans (`isPaid`, `isShipped`, `isCancelled`). It lets nonsense exist.

![Flags versus a single state](fig:pat-flags-vs-state "Three booleans give eight combinations, most meaningless. One status gives exactly the meaningful ones.")

Instead, hold **one** state and a **table** of which events move it where.

![Order lifecycle](fig:pat-state-diagram "Only the drawn arrows are allowed: that is the specification, and also the code.")

```stepper A tiny state machine
code:
  const machine = {
    initial: 'idle',
    states: {
      idle:    { on: { START: 'running' } },
      running: { on: { PAUSE: 'paused', STOP: 'idle' } },
      paused:  { on: { RESUME: 'running', STOP: 'idle' } },
    },
  };
---
line: 2
say: The machine **starts** in `idle`. At any moment it is in exactly **one** state.
current: idle
---
line: 4
say: In `idle`, the only event that does anything is `START`, which moves to `running`. Sending `PAUSE` now is **not allowed**: there is no such arrow.
current: idle
allowed: START
---
line: 5
say: In `running` two events are possible: `PAUSE` goes to `paused`, `STOP` goes back to `idle`.
current: running
allowed: PAUSE, STOP
---
line: 6
say: In `paused`, `RESUME` returns to `running`. Notice you can't `START` a paused machine: the table makes that impossible, with no `if` anywhere.
current: paused
allowed: RESUME, STOP
```

```js try
function createMachine({ initial, states }) {
  let state = initial;
  return {
    current: () => state,
    send(event) {
      const next = states[state].on[event];
      if (next) state = next;
      return state;
    },
  };
}
const m = createMachine({
  initial: 'idle',
  states: { idle: { on: { START: 'running' } }, running: { on: { STOP: 'idle' } } },
});
console.log(m.send('START'), m.send('START'), m.send('STOP'));
```

A state machine gives you a **spec you can read**, **hooks** (run code when entering or leaving a state), **notification** of changes, and a single place to enforce the rules. The same idea powers UI wizards, request lifecycles (`idle → loading → success | error`) and game logic.

## Which one when?

- **Strategy**: *the same job, done different ways*, chosen by the caller.
- **State**: *the same object, behaving differently over its life*, chosen by what has happened so far.

They are often combined: each state may carry its own strategy.

## Quick check

```check
Q: What is a strategy in JavaScript, usually?
A) A subclass
B) A function passed in or looked up, standing for one way of doing a step *
C) A global variable
D) A design document
Why: Functions are values, so a strategy needs no class hierarchy.
---
Q: Which problem suggests the strategy pattern?
A) A growing if/else chain choosing between several algorithms *
B) A missing semicolon
C) A slow network
D) A very large array
Why: The branches differ only in the algorithm, so make that part a swappable function.
---
Q: Why prefer one `status` field over several booleans?
A) Booleans are slow
B) Booleans allow meaningless combinations; one status only allows real ones *
C) Strings are shorter
D) Booleans can't be stored
Why: Make illegal states unrepresentable, so there is less to check.
---
Q: In a state machine, what happens if you send an event with no arrow from the current state?
A) The program crashes always
B) By design it's ignored or rejected: the table is the rule *
C) A random state is chosen
D) The first state is restored
Why: Only listed transitions are allowed; whether you ignore or throw is a choice you make.
---
Q: Which describes "state" rather than "strategy"?
A) Choosing a sorting comparator
B) An order that can be shipped only after it is paid *
C) Passing a discount function
D) Selecting a logging format
Why: Behaviour depends on where the object is in its life.
```

## Recap

- **Strategy**: pass the varying algorithm as a **function**; look strategies up in a table.
- **State**: one **status** plus a **transition table**; illegal combinations can't exist.
- A **state machine** adds hooks and subscriptions around the table.
- Both turn `if/else` chains into **data** you can read, test and extend.
- Unknown input (a strategy name, an event) should **fail clearly** or be ignored **on purpose**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a discounter | An object of functions as a lookup table |
| Pluggable validation rules | Rule makers returning functions that give an error string or `null` |
| A state machine | A `states` table, `current`, `send`, `can`, hooks and subscribers |
| An order lifecycle | One status plus the allowed actions in each state |
| Backoff strategies | Small functions from attempt number to delay |

%% exercise pat-guided-discounter | Guided: a discounter | 1 | js | js | createDiscounter | 8 | guided
Implement `createDiscounter(strategies)`. `strategies` maps names to functions `(amount) => newAmount`. It returns an object with `price(amount, code = 'none')` that **looks up** the strategy named `code` and returns `strategy(amount)`. An unknown code throws `Error('unknown strategy: CODE')`.

```js
const d = createDiscounter({ none: (a) => a, half: (a) => a / 2 });
d.price(100, 'half'); // 50
d.price(100);         // 100 (the default code is 'none')
```

%% worked
**A similar problem, solved: `createFormatter(formats)`** — pick the function by name.

```js
function createFormatter(formats) {
  return {
    format(value, name = 'plain') {
      const fn = formats[name];                                   // ① look the strategy up
      if (!fn) throw new Error('unknown format: ' + name);        // ② fail clearly
      return fn(value);                                           // ③ run it
    },
  };
}
```

No `if (name === 'plain') … else if (name === 'upper')`: adding a format is adding a key.

%% explain
- **Lookup** by `code` in the given table; default `'none'`.
- **Returns** whatever the strategy returns.
- **Unknown code** throws the exact message.

%% nudge
- How do you get a function out of an object by a variable name?
- How do you tell that nothing was found?

%% starter
```js
export function createDiscounter(strategies) {
  return {
    price(amount, code = 'none') {
      // your code
      return amount;
    },
  };
}
```

%% tests
```js
describe('createDiscounter', () => {
  const strategies = { none: (a) => a, half: (a) => a / 2, fiveOff: (a) => Math.max(0, a - 5) };
  it('applies the named strategy', () => {
    const d = createDiscounter(strategies);
    expect(d.price(100, 'half')).toBe(50);
    expect(d.price(3, 'fiveOff')).toBe(0);
  });
  it('defaults to none', () => {
    expect(createDiscounter(strategies).price(80)).toBe(80);
  });
  it('throws for an unknown code', () => {
    expect(() => createDiscounter(strategies).price(10, 'free')).toThrow('unknown strategy: free');
  });
  it('uses exactly the strategies it is given', () => {
    const d = createDiscounter({ none: (a) => a, double: (a) => a * 2 });
    expect(d.price(7, 'double')).toBe(14);
    expect(() => d.price(7, 'half')).toThrow('unknown strategy: half');
  });
  it('passes the amount through to the strategy', () => {
    const spy = jest.fn(() => 1);
    createDiscounter({ none: (a) => a, spy }).price(42, 'spy');
    expect(spy).toHaveBeenCalledWith(42);
  });
});
```

%% hints
- `const strategy = strategies[code];`
- `if (!strategy) throw new Error('unknown strategy: ' + code); return strategy(amount);`

%% solution
```js
export function createDiscounter(strategies) {
  return {
    price(amount, code = 'none') {
      const strategy = strategies[code];
      if (!strategy) throw new Error('unknown strategy: ' + code);
      return strategy(amount);
    },
  };
}
```

%% exercise pat-validator | Pluggable validation rules | 2 | js | js | createValidator, required, minLength, range | 18
A **rule** is a function `(obj) => string | null` (an error message, or `null` when fine). Implement:

- `required(field)`: error `FIELD is required` when the value is `undefined`, `null`, or a string that is empty after trimming.
- `minLength(field, n)`: error `FIELD must be at least N characters` when the value is a string shorter than `n`. It **skips** missing values (`undefined`, `null`, `''`), so you can combine it with `required`.
- `range(field, min, max)`: error `FIELD must be between MIN and MAX` when the value is not a number in `[min, max]` (inclusive). It **skips** `undefined` and `null`.
- `createValidator(rules)` returns `{ validate(obj), isValid(obj) }`: `validate` returns the **array of error messages** in rule order (empty when valid).

```js
const v = createValidator([required('name'), minLength('name', 3), range('age', 18, 120)]);
v.validate({ name: 'Al', age: 10 }); // ['name must be at least 3 characters', 'age must be between 18 and 120']
```

%% worked
**A similar problem, solved: `maxLength(field, n)` and a runner** — rules are small functions you combine.

```js
export const maxLength = (field, n) => (obj) =>
  typeof obj[field] === 'string' && obj[field].length > n ? `${field} must be at most ${n} characters` : null;   // ① a rule maker returns a rule

export function createChecker(rules) {
  return { check: (obj) => rules.map((rule) => rule(obj)).filter(Boolean) };   // ② run all, drop the nulls
}
```

Adding a rule never changes `createChecker`; the runner just applies whatever functions it is given. That is the strategy pattern with **many strategies at once**.

%% explain
- **Rule makers** return rules; a rule returns a **message or `null`**.
- **`required`** treats blank strings as missing.
- **`minLength` / `range`** skip missing values; they only judge present ones.
- **`validate`** keeps the **order** of the rules and collects all errors.

%% nudge
- What does `[rule1, rule2].map(...)` followed by `filter(Boolean)` give you?
- Which rules should say nothing when the field is missing?

%% starter
```js
export const required = (field) => (obj) => null;
export const minLength = (field, n) => (obj) => null;
export const range = (field, min, max) => (obj) => null;

export function createValidator(rules) {
  return {
    validate(obj) { return []; },
    isValid(obj) { return false; },
  };
}
```

%% tests
```js
describe('rules', () => {
  it('required', () => {
    const r = required('name');
    expect(r({})).toBe('name is required');
    expect(r({ name: null })).toBe('name is required');
    expect(r({ name: '   ' })).toBe('name is required');
    expect(r({ name: 'Ada' })).toBeNull();
    expect(r({ name: 0 })).toBeNull();
  });
  it('minLength', () => {
    const r = minLength('name', 3);
    expect(r({ name: 'Al' })).toBe('name must be at least 3 characters');
    expect(r({ name: 'Ada' })).toBeNull();
    expect(r({})).toBeNull();
    expect(r({ name: '' })).toBeNull();
  });
  it('range is inclusive and skips missing values', () => {
    const r = range('age', 18, 120);
    expect(r({ age: 17 })).toBe('age must be between 18 and 120');
    expect(r({ age: 121 })).toBe('age must be between 18 and 120');
    expect(r({ age: 18 })).toBeNull();
    expect(r({ age: 120 })).toBeNull();
    expect(r({ age: 'x' })).toBe('age must be between 18 and 120');
    expect(r({})).toBeNull();
    expect(r({ age: null })).toBeNull();
  });
});

describe('createValidator', () => {
  const v = createValidator([required('name'), minLength('name', 3), range('age', 18, 120)]);
  it('returns all errors in rule order', () => {
    expect(v.validate({ name: 'Al', age: 10 })).toEqual([
      'name must be at least 3 characters',
      'age must be between 18 and 120',
    ]);
    expect(v.validate({})).toEqual(['name is required']);
  });
  it('returns an empty array when valid', () => {
    expect(v.validate({ name: 'Ada', age: 30 })).toEqual([]);
    expect(v.isValid({ name: 'Ada', age: 30 })).toBe(true);
    expect(v.isValid({ name: 'Ada', age: 3 })).toBe(false);
  });
  it('accepts custom rules', () => {
    const custom = createValidator([(o) => (o.a === o.b ? null : 'a and b must match')]);
    expect(custom.validate({ a: 1, b: 2 })).toEqual(['a and b must match']);
    expect(custom.isValid({ a: 1, b: 1 })).toBe(true);
  });
  it('with no rules everything is valid', () => {
    expect(createValidator([]).validate({})).toEqual([]);
  });
});
```

%% hints
- `required`: `const v = obj[field]; return v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? `${field} is required` : null;`
- `range`: skip when `v == null`; error when `typeof v !== 'number' || v < min || v > max`.
- `validate`: `rules.map((r) => r(obj)).filter((m) => m !== null)`.

%% solution
```js
export const required = (field) => (obj) => {
  const v = obj[field];
  const missing = v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  return missing ? `${field} is required` : null;
};

export const minLength = (field, n) => (obj) => {
  const v = obj[field];
  if (v === undefined || v === null || v === '') return null;
  return typeof v === 'string' && v.length < n ? `${field} must be at least ${n} characters` : null;
};

export const range = (field, min, max) => (obj) => {
  const v = obj[field];
  if (v === undefined || v === null) return null;
  return typeof v !== 'number' || v < min || v > max ? `${field} must be between ${min} and ${max}` : null;
};

export function createValidator(rules) {
  const validate = (obj) => rules.map((rule) => rule(obj)).filter((message) => message !== null);
  return {
    validate,
    isValid: (obj) => validate(obj).length === 0,
  };
}
```

%% exercise pat-state-machine | A state machine | 3 | js | js | createMachine | 24
Implement `createMachine({ initial, states })` where `states` looks like `{ idle: { on: { START: 'running' }, enter, exit }, … }` (`enter` and `exit` are optional functions).

- `current()` returns the current state name.
- `can(event)` is `true` if the current state has a transition for `event`.
- `send(event)`: if there is a transition, run the old state's `exit()`, change state, run the new state's `enter()`, notify subscribers with `{ from, to, event }`, and return the new state. If there is **no** transition, nothing happens and it returns the current state.
- `subscribe(listener)` returns an **unsubscribe** function.
- At creation, an `initial` state or any transition target that is **not in `states`** throws `Error('unknown state: NAME')`.
- A transition to the **same** state (`on: { TICK: 'idle' }` inside `idle`) counts as a transition and runs the hooks.

```js
const m = createMachine({ initial: 'idle', states: { idle: { on: { START: 'running' } }, running: { on: {} } } });
m.send('START'); // 'running'
```

%% worked
**A similar problem, solved: `createToggle(states)`** — a lookup, a hook and a listener.

```js
function createToggle(states) {
  let state = 'off';
  const listeners = [];
  return {
    flip() {
      const next = states[state].on.FLIP;                // ① the table decides
      if (!next) return state;                           // ② no arrow: nothing happens
      const from = state;
      states[from].exit?.();                             // ③ leave, move, arrive
      state = next;
      states[state].enter?.();
      listeners.forEach((l) => l({ from, to: state }));  // ④ tell everyone
      return state;
    },
  };
}
```

The `on` object is the whole specification. Your machine generalises this to any events, plus `can`, `subscribe` and validation at creation.

%% explain
- **Table lookup**: `states[current].on[event]`.
- **Order of effects**: exit old → change → enter new → notify.
- **No transition**: no hooks, no notification, state unchanged.
- **Validation** at creation for the initial state and every target.
- **Unsubscribe** removes only that listener.

%% nudge
- When should hooks and listeners **not** run?
- Where do you check that every target exists, and when?

%% starter
```js
export function createMachine({ initial, states }) {
  const listeners = new Set();
  let state = initial;
  return {
    current: () => state,
    can(event) { return false; },
    send(event) { return state; },
    subscribe(listener) { return () => {}; },
  };
}
```

%% tests
```js
const build = (extra = {}) => ({
  initial: 'idle',
  states: {
    idle: { on: { START: 'running' }, ...(extra.idle || {}) },
    running: { on: { PAUSE: 'paused', STOP: 'idle' }, ...(extra.running || {}) },
    paused: { on: { RESUME: 'running', STOP: 'idle' } },
  },
});

describe('createMachine', () => {
  it('starts in the initial state and transitions', () => {
    const m = createMachine(build());
    expect(m.current()).toBe('idle');
    expect(m.send('START')).toBe('running');
    expect(m.send('PAUSE')).toBe('paused');
    expect(m.send('RESUME')).toBe('running');
    expect(m.send('STOP')).toBe('idle');
    expect(m.current()).toBe('idle');
  });
  it('ignores events without a transition', () => {
    const m = createMachine(build());
    expect(m.send('PAUSE')).toBe('idle');
    expect(m.current()).toBe('idle');
  });
  it('can() reflects the current state', () => {
    const m = createMachine(build());
    expect(m.can('START')).toBe(true);
    expect(m.can('PAUSE')).toBe(false);
    m.send('START');
    expect(m.can('PAUSE')).toBe(true);
    expect(m.can('START')).toBe(false);
  });
  it('runs exit then enter hooks in order', () => {
    const calls = [];
    const m = createMachine(build({ idle: { exit: () => calls.push('exit idle') }, running: { enter: () => calls.push('enter running') } }));
    m.send('START');
    expect(calls).toEqual(['exit idle', 'enter running']);
  });
  it('does not run hooks for ignored events', () => {
    const exit = jest.fn();
    const m = createMachine(build({ idle: { exit } }));
    m.send('NOPE');
    expect(exit).not.toHaveBeenCalled();
  });
  it('notifies subscribers and supports unsubscribe', () => {
    const m = createMachine(build());
    const a = jest.fn(), b = jest.fn();
    const offA = m.subscribe(a);
    m.subscribe(b);
    m.send('START');
    expect(a).toHaveBeenCalledWith({ from: 'idle', to: 'running', event: 'START' });
    offA();
    m.send('PAUSE');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });
  it('treats a self transition as a transition', () => {
    const enter = jest.fn();
    const listener = jest.fn();
    const m = createMachine({ initial: 'idle', states: { idle: { on: { TICK: 'idle' }, enter } } });
    m.subscribe(listener);
    m.send('TICK');
    expect(enter).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ from: 'idle', to: 'idle', event: 'TICK' });
  });
  it('validates states at creation', () => {
    expect(() => createMachine({ initial: 'nope', states: { idle: { on: {} } } })).toThrow('unknown state: nope');
    expect(() => createMachine({ initial: 'idle', states: { idle: { on: { GO: 'ghost' } } } })).toThrow('unknown state: ghost');
  });
});
```

%% hints
- Validate: `if (!(initial in states)) throw ...; for each state, for each target in Object.values(on): if (!(target in states)) throw ...`.
- `send`: `const next = states[state].on[event]; if (next === undefined) return state; const from = state; states[from].exit?.(); state = next; states[state].enter?.(); listeners.forEach((l) => l({ from, to: state, event }));`

%% solution
```js
export function createMachine({ initial, states }) {
  const listeners = new Set();
  if (!(initial in states)) throw new Error('unknown state: ' + initial);
  for (const def of Object.values(states)) {
    for (const target of Object.values(def.on || {})) {
      if (!(target in states)) throw new Error('unknown state: ' + target);
    }
  }
  let state = initial;
  const next = (event) => (states[state].on || {})[event];
  return {
    current: () => state,
    can: (event) => next(event) !== undefined,
    send(event) {
      const to = next(event);
      if (to === undefined) return state;
      const from = state;
      states[from].exit?.();
      state = to;
      states[state].enter?.();
      for (const listener of [...listeners]) listener({ from, to, event });
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

%% exercise pat-order-state | An order lifecycle | 3 | js | js | createOrder | 20
Implement `createOrder()` using the **state pattern**. Its status starts as `'pending'`.

- `pay()`: `pending → paid`. `ship()`: `paid → shipped`. `deliver()`: `shipped → delivered`.
- `cancel()`: allowed from `pending` or `paid`, moves to `cancelled`, and **returns `true` if a refund is needed** (it was paid), else `false`.
- Any other action throws `Error('cannot ACTION an order that is STATUS')`, e.g. `cannot ship an order that is pending`.
- `status()` returns the current status; `history()` returns the list of statuses visited so far, starting with `'pending'`.

```js
const o = createOrder();
o.pay(); o.ship();
o.status();  // 'shipped'
o.history(); // ['pending', 'paid', 'shipped']
```

%% worked
**A similar problem, solved: `createDoor()`** — each state lists only the actions it allows.

```js
export function createDoor() {
  const states = {
    closed: { open: 'opened', lock: 'locked' },          // ① per state: action → next state
    opened: { close: 'closed' },
    locked: { unlock: 'closed' },
  };
  let status = 'closed';
  const act = (action) => {
    const next = states[status][action];
    if (!next) throw new Error(`cannot ${action} a door that is ${status}`);   // ② anything not listed is illegal
    status = next;
  };
  return { open: () => act('open'), close: () => act('close'), lock: () => act('lock'), unlock: () => act('unlock'), status: () => status };
}
```

No `if (status === 'closed' && …)` ladders: the table holds the rules, one helper applies them. For `cancel`, the return value depends on the *old* state, so read it before you change.

%% explain
- **Table** of allowed actions per status.
- **Illegal** actions throw the exact message with action and status.
- **`cancel`** returns whether a refund is needed (`true` only from `paid`).
- **`history`** records every status visited, in order, as a copy.

%% nudge
- How can one helper serve all five actions?
- What does `cancel()` need to look at before it moves?

%% starter
```js
export function createOrder() {
  let status = 'pending';
  const history = ['pending'];
  return {
    pay() {},
    ship() {},
    deliver() {},
    cancel() { return false; },
    status: () => status,
    history: () => [...history],
  };
}
```

%% tests
```js
describe('createOrder', () => {
  it('walks the happy path and records history', () => {
    const o = createOrder();
    expect(o.status()).toBe('pending');
    o.pay(); o.ship(); o.deliver();
    expect(o.status()).toBe('delivered');
    expect(o.history()).toEqual(['pending', 'paid', 'shipped', 'delivered']);
  });
  it('cancels a pending order without a refund', () => {
    const o = createOrder();
    expect(o.cancel()).toBe(false);
    expect(o.status()).toBe('cancelled');
  });
  it('cancels a paid order with a refund', () => {
    const o = createOrder();
    o.pay();
    expect(o.cancel()).toBe(true);
    expect(o.history()).toEqual(['pending', 'paid', 'cancelled']);
  });
  it('rejects illegal actions with a clear message', () => {
    const o = createOrder();
    expect(() => o.ship()).toThrow('cannot ship an order that is pending');
    expect(() => o.deliver()).toThrow('cannot deliver an order that is pending');
    o.pay();
    expect(() => o.pay()).toThrow('cannot pay an order that is paid');
  });
  it('cannot cancel once shipped or after cancelling', () => {
    const o = createOrder();
    o.pay(); o.ship();
    expect(() => o.cancel()).toThrow('cannot cancel an order that is shipped');
    const c = createOrder();
    c.cancel();
    expect(() => c.pay()).toThrow('cannot pay an order that is cancelled');
    expect(() => c.cancel()).toThrow('cannot cancel an order that is cancelled');
  });
  it('a failed action changes nothing', () => {
    const o = createOrder();
    try { o.deliver(); } catch (e) { /* expected */ }
    expect(o.status()).toBe('pending');
    expect(o.history()).toEqual(['pending']);
  });
  it('history returns a copy and orders are independent', () => {
    const a = createOrder(), b = createOrder();
    a.pay();
    a.history().push('hacked');
    expect(a.history()).toEqual(['pending', 'paid']);
    expect(b.status()).toBe('pending');
  });
});
```

%% hints
- `const table = { pending: { pay: 'paid', cancel: 'cancelled' }, paid: { ship: 'shipped', cancel: 'cancelled' }, shipped: { deliver: 'delivered' }, delivered: {}, cancelled: {} };`
- `act(action)`: look up `table[status][action]`, throw if missing, otherwise update `status` and push to `history`.
- `cancel`: `const refund = status === 'paid'; act('cancel'); return refund;`

%% solution
```js
export function createOrder() {
  const table = {
    pending: { pay: 'paid', cancel: 'cancelled' },
    paid: { ship: 'shipped', cancel: 'cancelled' },
    shipped: { deliver: 'delivered' },
    delivered: {},
    cancelled: {},
  };
  let status = 'pending';
  const history = ['pending'];
  const act = (action) => {
    const next = table[status][action];
    if (!next) throw new Error(`cannot ${action} an order that is ${status}`);
    status = next;
    history.push(status);
  };
  return {
    pay: () => act('pay'),
    ship: () => act('ship'),
    deliver: () => act('deliver'),
    cancel() {
      const refund = status === 'paid';
      act('cancel');
      return refund;
    },
    status: () => status,
    history: () => [...history],
  };
}
```

%% exercise pat-backoff | Backoff strategies | 2 | js | js | fixed, linear, exponential, withJitter, delays | 16
A **backoff strategy** is a function `(attempt) => delayMs`, with `attempt` starting at `0`. Implement:

- `fixed(ms)`: always `ms`.
- `linear(stepMs)`: `stepMs * (attempt + 1)`.
- `exponential(baseMs, capMs = Infinity)`: `baseMs * 2 ** attempt`, never more than `capMs`.
- `withJitter(strategy, random)`: a new strategy returning `Math.floor(strategy(attempt) * random())` (so the delay is randomly reduced).
- `delays(strategy, n)`: the array of delays for attempts `0` to `n - 1`.

```js
delays(exponential(100, 500), 5); // [100, 200, 400, 500, 500]
```

%% worked
**A similar problem, solved: `capped(strategy, max)`** — a strategy that wraps another strategy.

```js
export const capped = (strategy, max) => (attempt) => Math.min(max, strategy(attempt));
export const doubled = (strategy) => (attempt) => strategy(attempt) * 2;
```

Strategies are plain functions, so they **compose**: a wrapper takes a strategy and returns a new one with the same shape. `withJitter` is exactly that.

%% explain
- **All strategies** are `(attempt) => ms`.
- **`exponential`** doubles each attempt up to the cap.
- **`withJitter`** wraps another strategy and scales it by `random()` (floor).
- **`delays`** just calls the strategy for each attempt.

%% nudge
- What does a wrapper strategy look like from the outside?
- What is the first attempt number?

%% starter
```js
export const fixed = (ms) => (attempt) => 0;
export const linear = (stepMs) => (attempt) => 0;
export const exponential = (baseMs, capMs = Infinity) => (attempt) => 0;
export const withJitter = (strategy, random) => (attempt) => 0;
export function delays(strategy, n) { return []; }
```

%% tests
```js
describe('backoff', () => {
  it('fixed', () => {
    expect(delays(fixed(250), 3)).toEqual([250, 250, 250]);
  });
  it('linear', () => {
    expect(delays(linear(100), 4)).toEqual([100, 200, 300, 400]);
  });
  it('exponential doubles from attempt 0', () => {
    expect(delays(exponential(100), 4)).toEqual([100, 200, 400, 800]);
  });
  it('exponential respects the cap', () => {
    expect(delays(exponential(100, 500), 5)).toEqual([100, 200, 400, 500, 500]);
  });
  it('withJitter scales and floors', () => {
    const s = withJitter(exponential(100), () => 0.5);
    expect(delays(s, 3)).toEqual([50, 100, 200]);
    expect(withJitter(fixed(10), () => 0.99)(0)).toBe(9);
  });
  it('withJitter calls random once per delay and wraps any strategy', () => {
    const random = jest.fn(() => 1);
    const s = withJitter(linear(10), random);
    delays(s, 3);
    expect(random).toHaveBeenCalledTimes(3);
    expect(delays(s, 2)).toEqual([10, 20]);
  });
  it('delays handles n = 0', () => {
    expect(delays(fixed(5), 0)).toEqual([]);
  });
  it('passes the attempt number to the strategy', () => {
    const spy = jest.fn(() => 1);
    delays(spy, 3);
    expect(spy.mock.calls).toEqual([[0], [1], [2]]);
  });
});
```

%% hints
- `exponential`: `(a) => Math.min(capMs, baseMs * 2 ** a)`.
- `withJitter`: `(a) => Math.floor(strategy(a) * random())`.
- `delays`: `Array.from({ length: n }, (_, i) => strategy(i))`.

%% solution
```js
export const fixed = (ms) => () => ms;
export const linear = (stepMs) => (attempt) => stepMs * (attempt + 1);
export const exponential = (baseMs, capMs = Infinity) => (attempt) => Math.min(capMs, baseMs * 2 ** attempt);
export const withJitter = (strategy, random) => (attempt) => Math.floor(strategy(attempt) * random());
export function delays(strategy, n) {
  return Array.from({ length: n }, (_, i) => strategy(i));
}
```
