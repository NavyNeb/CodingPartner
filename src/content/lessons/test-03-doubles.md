---
id: test-doubles
track: test
title: Test doubles & dependency injection
summary: Replacing slow, random or side-effecting collaborators with stubs, spies, mocks and fakes; making code testable by passing its dependencies in; and knowing when to assert on state and when on calls.
---

## The idea in one sentence

To test a piece of code on its own, you **swap the things it depends on** — the network, the clock, the database, the email service — for **stand-ins you control**.

> **Analogy** A flight simulator. Pilots practise landing without a real plane or a real storm: the cockpit is real, the world around it is faked, and the instructor can make it rain or break an engine on demand. A **test double** is that fake world for your code.

Without doubles, tests are **slow** (real network), **flaky** (real time, real randomness), **dangerous** (real emails, real payments) or **impossible** (how do you trigger "the server is down" on purpose?).

## The kinds of double

![Dummy, stub, spy, mock and fake](fig:tst-doubles "Different jobs for stand-ins. In Jest, jest.fn() can play several of them.")

- A **dummy** fills a parameter that must exist but is never used.
- A **stub** returns **canned answers** so the code under test gets the situation you want ("the user exists", "the server is down").
- A **spy** records **how it was called**, so you can check afterwards.
- A **mock** is a spy with expectations about those calls.
- A **fake** is a **simplified but working** implementation, such as an in-memory repository built on a `Map`.

```js try predict
function spy(impl = () => undefined) {
  const fn = (...args) => { fn.calls.push(args); return impl(...args); };
  fn.calls = [];
  return fn;
}
const send = spy();
send('ada@example.com', 'Hi');
send('bo@example.com', 'Hi');
console.log(send.calls.length, send.calls[1][0]);
```

That is all `jest.fn()` is at heart: a function that remembers its calls (and lets you choose what it returns or throws).

```js
const send = jest.fn();                       // a spy
const find = jest.fn(() => ({ id: 1 }));      // a stub: always returns this
const boom = jest.fn(() => { throw new Error('down'); });   // a stub that fails on purpose
expect(send).toHaveBeenCalledTimes(1);
expect(send).toHaveBeenCalledWith('ada@example.com', 'Welcome!');
```

## Making code testable: dependency injection

You can only swap a dependency if the code **lets you**. If a function calls `emailApi.send` directly, every test sends a real email. If it **receives** the api as a parameter, the test can hand in a fake. That parameter is a **seam**.

![Hard-coded versus injected dependency](fig:tst-di-seam "Production passes the real thing; a test passes something it can control and inspect.")

```js try
// Hard to test: the clock is buried inside
const greetNow = (name) => (new Date().getHours() < 12 ? 'Good morning' : 'Good afternoon') + ', ' + name + '!';

// Easy to test: the clock is injected
function createGreeter({ clock }) {
  return {
    greet(name) {
      const hour = clock.now().getHours();
      return `${hour < 12 ? 'Good morning' : 'Good afternoon'}, ${name}!`;
    },
  };
}
const morning = createGreeter({ clock: { now: () => new Date(2024, 0, 1, 9) } });
const afternoon = createGreeter({ clock: { now: () => new Date(2024, 0, 1, 15) } });
console.log(morning.greet('Ada'), afternoon.greet('Ada'));
```

The same trick works for anything unpredictable: `fetch`, `Math.random`, `Date.now`, `localStorage`, loggers. Production code passes the real thing (often as a **default parameter**), tests pass a controllable one.

## Spying on a call

```stepper Checking an email was sent
code:
  function checkNotifier(createNotifier) {
    const api = { send: jest.fn() };
    const notifier = createNotifier({ api });
    notifier.welcome({ name: 'Ada', email: 'ada@example.com' });
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(api.send).toHaveBeenCalledWith('ada@example.com', 'Welcome, Ada!');
  }
---
line: 2
say: Create a **spy**: `jest.fn()` is a function that does nothing but **record** how it is called. It is the stand-in for the real email api.
api.send.mock.calls: (no calls yet)
---
line: 3-4
say: **Inject** it: the notifier receives `{ api }` instead of the real service. Then perform the **action** under test. The notifier calls `api.send(...)`, and the spy writes down the arguments.
api.send.mock.calls: ['ada@example.com', 'Welcome, Ada!']
---
line: 5
say: First assertion: it was called **exactly once**. A version that sends the email twice fails here.
api.send called: 1 time
result: pass
---
line: 6
say: Second assertion: the **arguments** are right: the address and the message. A version that sent to the user's name instead of the email, or used the wrong wording, fails here.
args match: yes
result: pass
```

## State or interactions?

![State-based versus interaction-based assertions](fig:tst-state-vs-interaction "Prefer to assert on results. Assert on calls when the call itself is the outcome.")

- **State-based:** run the code, then look at the **result** or the **new state**. This survives refactoring, so prefer it.
- **Interaction-based:** check the **calls** made to a collaborator. Right when the call *is* the outcome (an email sent, an event published).

Over-mocking is the classic trap: tests that mirror the implementation line by line break on harmless refactors and prove only that the code calls what you told it to call. A **fake** (like an in-memory repository) lets you assert on **state** even with a collaborator in the picture: save a user, then read it back.

```js try
function createFakeRepo(initial = []) {
  const users = new Map(initial.map((u) => [u.id, u]));
  return {
    find: (id) => users.get(id),
    save: (user) => { users.set(user.id, user); },
    all: () => [...users.values()],
  };
}
const repo = createFakeRepo([{ id: 1, name: 'Ada' }]);
repo.save({ id: 1, name: 'Grace' });
console.log(repo.all());        // assert on the resulting STATE
```

## Quick check

```check
Q: What does a spy do?
A) Returns canned answers
B) Records how it was called so a test can check the calls afterwards *
C) Replaces the whole database
D) Makes tests run faster
Why: A spy remembers calls and arguments. A stub returns canned values; a fake is a working simplified version.
---
Q: Why does `sendWelcome(user)` calling `emailApi.send` directly make testing hard?
A) It's too long
B) There is no seam: the test can't swap the real api for a fake, so it sends a real email *
C) Functions can't call objects
D) It uses `user`
Why: Dependencies buried inside a function can't be replaced. Passing them in creates the seam.
---
Q: What is a fake?
A) A test that always passes
B) A simplified but working implementation, such as an in-memory repository *
C) A function that throws
D) A copy of production data
Why: Fakes have real behaviour (you can save then read back), just without the real infrastructure.
---
Q: Which situation justifies an interaction-based assertion (`toHaveBeenCalledWith`)?
A) The function returns a value
B) The outcome is a call to the outside world, such as sending an email *
C) The function is slow
D) The function has a loop
Why: When nothing else observable changes, the call itself is the behaviour.
---
Q: What is the main risk of mocking everything?
A) Tests run too fast
B) Tests mirror the implementation, so harmless refactors break them and bugs can slip through *
C) Mocks cost money
D) Tests become shorter
Why: A test that only checks "A called B" proves little about whether the real behaviour is right.
```

## Recap

- **Doubles** replace slow, random or side-effecting collaborators: **dummy**, **stub**, **spy**, **mock**, **fake**. `jest.fn()` covers stub, spy and mock.
- Make code testable with **dependency injection**: pass the clock, the api, the repository **in**.
- Choose assertions deliberately: **state** when you can, **interactions** when the call is the outcome.
- **Fakes** let you check state even with a collaborator; avoid **over-mocking**.
- In "write the tests" exercises you build the doubles yourself, then check the **calls** and the **results**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a greeter with an injected clock | `clock.now()` instead of `new Date()` |
| Build a notifier | An injected `api`; skip users without email; survive a failing api |
| Tests for a notifier | `jest.fn()` spies, a throwing stub, `toHaveBeenCalledWith` |
| Build a user service | An injected repository; never mutate the stored user |
| Tests for a user service | A fake repository you write yourself, and state assertions |
| Build a cache with a TTL | An injected `clock` and `fetcher` |
| Tests for a cache | A controllable clock and a spy fetcher; the boundary tick |

%% exercise tst-guided-greeter | Guided: a greeter with an injected clock | 1 | js | js | createGreeter | 8 | guided
Implement `createGreeter({ clock })`. The `clock` is an object with `now()` returning a `Date`. The returned object has `greet(name)`, which returns:

- `'Good morning, NAME!'` before 12:00 (hours `0`–`11`),
- `'Good afternoon, NAME!'` from 12:00 to 17:59,
- `'Good evening, NAME!'` from 18:00.

Read the hour with `clock.now().getHours()`: **don't** create your own `new Date()`.

```js
const greeter = createGreeter({ clock: { now: () => new Date(2024, 0, 1, 9) } });
greeter.greet('Ada'); // 'Good morning, Ada!'
```

%% worked
**A similar problem, solved: `createLabeler({ clock })`** — says whether a date is in the past, using an injected clock.

```js
function createLabeler({ clock }) {
  return {
    label(date) {
      return date.getTime() < clock.now().getTime() ? 'past' : 'upcoming';   // ① "now" comes from the clock, not from new Date()
    },
  };
}
```

Because `now` is a **parameter**, a test can pass `{ now: () => new Date(2024, 5, 1) }` and get the same answer on every machine, every day. The shape is always: **take the collaborator in an argument object, call it, never reach for the global**.

%% explain
- **Hours 0–11** morning, **12–17** afternoon, **18–23** evening.
- **Reads the hour from the injected clock** each time `greet` is called.
- **Returns a string** with the name.

%% nudge
- Where does the current time come from?
- Which comparison separates morning from afternoon?

%% starter
```js
export function createGreeter({ clock }) {
  return {
    greet(name) {
      // Step 1 — const hour = clock.now().getHours();
      // Step 2 — choose 'Good morning' (< 12), 'Good afternoon' (< 18) or 'Good evening'.
      return '';
    },
  };
}
```

%% tests
```js
const at = (hour) => createGreeter({ clock: { now: () => new Date(2024, 0, 1, hour) } });

describe('createGreeter', () => {
  it.each([
    [0, 'Good morning, Ada!'],
    [6, 'Good morning, Ada!'],
    [11, 'Good morning, Ada!'],
    [12, 'Good afternoon, Ada!'],
    [17, 'Good afternoon, Ada!'],
    [18, 'Good evening, Ada!'],
    [23, 'Good evening, Ada!'],
  ])('at hour %i it says %j', (hour, expected) => {
    expect(at(hour).greet('Ada')).toBe(expected);
  });

  it('uses the given name', () => {
    expect(at(9).greet('Grace')).toBe('Good morning, Grace!');
  });

  it('reads the clock on every call', () => {
    let hour = 9;
    const greeter = createGreeter({ clock: { now: () => new Date(2024, 0, 1, hour) } });
    expect(greeter.greet('Ada')).toBe('Good morning, Ada!');
    hour = 20;
    expect(greeter.greet('Ada')).toBe('Good evening, Ada!');
  });
});
```

%% hints
- `const hour = clock.now().getHours();`
- `const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'; return `${part}, ${name}!`;`

%% solution
```js
export function createGreeter({ clock }) {
  return {
    greet(name) {
      const hour = clock.now().getHours();
      const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      return `${part}, ${name}!`;
    },
  };
}
```

%% exercise tst-notifier | Build a notifier | 2 | js | js | createNotifier | 16
Implement `createNotifier({ api })`. The `api` has `send(address, message)`. The notifier has:

- `welcome(user)` sends `'Welcome, NAME!'` to `user.email` and returns `true`.
- `goodbye(user)` sends `'Goodbye, NAME.'` to `user.email` and returns `true`.

In both: a user **without an email** is skipped: `api.send` is **not** called and the method returns `false`. If `api.send` **throws**, the method must **not** throw: it returns `false`. Each call sends **exactly one** message.

```js
const notifier = createNotifier({ api });
notifier.welcome({ name: 'Ada', email: 'ada@example.com' }); // true, api.send('ada@example.com', 'Welcome, Ada!')
```

%% worked
**A similar problem, solved: `createLogger({ sink })`** — a function that must call an injected collaborator, and survive its failure.

```js
function createLogger({ sink }) {
  return {
    info(text) {
      try {
        sink.write(`INFO ${text}`);       // ① the call to the collaborator
        return true;
      } catch {
        return false;                      // ② a failing sink must not break the caller
      }
    },
  };
}
```

The hidden tests use **spies** (`jest.fn()`) to check the call count and arguments, and a **throwing stub** (`jest.fn(() => { throw … })`) to check that you survive a broken collaborator. Share the logic between `welcome` and `goodbye` with a small helper so the rules (skip without email, catch errors) live in one place.

%% explain
- **Exactly one `api.send(email, message)`** per successful call.
- **Messages**: `'Welcome, NAME!'` and `'Goodbye, NAME.'` (note the full stop).
- **No email** → no call, returns `false`.
- **`send` throws** → returns `false`, no exception escapes.

%% nudge
- Where would you put the "no email" and "try/catch" logic so it isn't duplicated?
- What should the method return if `send` succeeded?

%% starter
```js
export function createNotifier({ api }) {
  return {
    welcome(user) {
      // your code
      return false;
    },
    goodbye(user) {
      // your code
      return false;
    },
  };
}
```

%% tests
```js
const ada = { name: 'Ada', email: 'ada@example.com' };

describe('createNotifier', () => {
  it('sends a welcome message and returns true', () => {
    const api = { send: jest.fn() };
    expect(createNotifier({ api }).welcome(ada)).toBe(true);
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(api.send).toHaveBeenCalledWith('ada@example.com', 'Welcome, Ada!');
  });

  it('sends a goodbye message and returns true', () => {
    const api = { send: jest.fn() };
    expect(createNotifier({ api }).goodbye(ada)).toBe(true);
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(api.send).toHaveBeenCalledWith('ada@example.com', 'Goodbye, Ada.');
  });

  it('skips users without an email', () => {
    const api = { send: jest.fn() };
    const notifier = createNotifier({ api });
    expect(notifier.welcome({ name: 'Bo' })).toBe(false);
    expect(notifier.goodbye({ name: 'Bo', email: '' })).toBe(false);
    expect(api.send).not.toHaveBeenCalled();
  });

  it('does not throw when the api fails', () => {
    const api = { send: jest.fn(() => { throw new Error('smtp down'); }) };
    const notifier = createNotifier({ api });
    expect(notifier.welcome(ada)).toBe(false);
    expect(notifier.goodbye(ada)).toBe(false);
  });

  it('sends one message per call', () => {
    const api = { send: jest.fn() };
    const notifier = createNotifier({ api });
    notifier.welcome(ada);
    notifier.welcome({ name: 'Bo', email: 'bo@example.com' });
    expect(api.send).toHaveBeenCalledTimes(2);
    expect(api.send).toHaveBeenLastCalledWith('bo@example.com', 'Welcome, Bo!');
  });
});
```

%% hints
- A helper `deliver(user, message)`: `if (!user.email) return false; try { api.send(user.email, message); return true; } catch { return false; }`.
- `welcome: (user) => deliver(user, `Welcome, ${user.name}!`)` and `goodbye` with a full stop.

%% solution
```js
export function createNotifier({ api }) {
  function deliver(user, message) {
    if (!user.email) return false;
    try {
      api.send(user.email, message);
      return true;
    } catch {
      return false;
    }
  }
  return {
    welcome: (user) => deliver(user, `Welcome, ${user.name}!`),
    goodbye: (user) => deliver(user, `Goodbye, ${user.name}.`),
  };
}
```

%% exercise tst-check-notifier | Tests for a notifier | 3 | js | js | checkNotifier | 26
The notifier from the previous exercise: `createNotifier({ api })` with `welcome(user)`, which calls `api.send(user.email, 'Welcome, NAME!')` once and returns `true`; a user **without an email** is skipped (no call, returns `false`); if `api.send` **throws**, `welcome` returns `false` instead of throwing. Write `checkNotifier(createNotifier)` using **spies and stubs** so it passes for a correct notifier and **fails** for: **sends the message twice**, **uses the wrong wording**, **sends to the name instead of the email**, **sends even without an email**, **lets an api error escape**, **returns nothing on success**.

```js
const api = { send: jest.fn() };
createNotifier({ api }).welcome({ name: 'Ada', email: 'ada@example.com' });
```

%% worked
**A similar problem, solved: `checkLogger(createLogger)`** — spy on the sink, then stub a failing sink.

```js
export function checkLogger(createLogger) {
  const sink = { write: jest.fn() };                         // ① a spy
  expect(createLogger({ sink }).info('hi')).toBe(true);      // ② the return value
  expect(sink.write).toHaveBeenCalledTimes(1);               // ③ one call (not zero, not two)
  expect(sink.write).toHaveBeenCalledWith('INFO hi');        // ④ the exact arguments
  const broken = { write: jest.fn(() => { throw new Error('disk full'); }) };   // ⑤ a stub that fails on purpose
  expect(createLogger({ sink: broken }).info('hi')).toBe(false);                // ⑥ the error must not escape
}
```

Each assertion targets a **kind of mistake**: wrong count, wrong arguments, wrong return value, no error handling. Use a **fresh spy per scenario** so earlier calls don't pollute later counts.

%% explain
- **Fresh `jest.fn()` per scenario**.
- **Count and arguments**: `toHaveBeenCalledTimes(1)`, `toHaveBeenCalledWith(email, message)`.
- **Return value**: `true` on success, `false` when skipped or failing.
- **No email**: assert `not.toHaveBeenCalled()`.
- **Throwing stub**: `jest.fn(() => { throw … })`.

%% nudge
- Which assertion catches a double send? A wrong message? Sending to the name?
- How do you make `api.send` fail on purpose?

%% starter
```js
export function checkNotifier(createNotifier) {
  const api = { send: jest.fn() };
  const notifier = createNotifier({ api });
  expect(notifier.welcome({ name: 'Ada', email: 'ada@example.com' })).toBe(true);
  // your assertions: call count, arguments, no email, a failing api
}
```

%% tests
```js
const make = ({ twice = false, text = (n) => `Welcome, ${n}!`, to = (u) => u.email, needsEmail = true, catches = true, returns = true } = {}) => ({ api }) => ({
  welcome(user) {
    if (needsEmail && !user.email) return false;
    try {
      api.send(to(user), text(user.name));
      if (twice) api.send(to(user), text(user.name));
    } catch (e) {
      if (catches) return false;
      throw e;
    }
    return returns ? true : undefined;
  },
});
const correct = make();
const mutants = {
  'sends the message twice': make({ twice: true }),
  'uses the wrong wording': make({ text: (n) => `Hello, ${n}!` }),
  'sends to the name instead of the email': make({ to: (u) => u.name }),
  'sends even without an email': make({ needsEmail: false }),
  'lets an api error escape': make({ catches: false }),
  'returns nothing on success': make({ returns: false }),
};

describe('your checkNotifier', () => {
  it('passes on a correct notifier', () => {
    expect(() => checkNotifier(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a notifier that ${name}`, () => {
      expect(() => checkNotifier(impl)).toThrow();
    });
  }
});
```

%% hints
- Success: `const api = { send: jest.fn() }; expect(notifier.welcome(ada)).toBe(true); expect(api.send).toHaveBeenCalledTimes(1); expect(api.send).toHaveBeenCalledWith('ada@example.com', 'Welcome, Ada!');`
- No email: a fresh spy, `welcome({ name: 'Bo' })` is `false` and `expect(api.send).not.toHaveBeenCalled()`.
- Failing api: `const api = { send: jest.fn(() => { throw new Error('down'); }) }` and `expect(notifier.welcome(ada)).toBe(false)`.

%% solution
```js
export function checkNotifier(createNotifier) {
  const ada = { name: 'Ada', email: 'ada@example.com' };

  const api = { send: jest.fn() };
  expect(createNotifier({ api }).welcome(ada)).toBe(true);
  expect(api.send).toHaveBeenCalledTimes(1);
  expect(api.send).toHaveBeenCalledWith('ada@example.com', 'Welcome, Ada!');

  const quiet = { send: jest.fn() };
  expect(createNotifier({ api: quiet }).welcome({ name: 'Bo' })).toBe(false);
  expect(quiet.send).not.toHaveBeenCalled();

  const broken = { send: jest.fn(() => { throw new Error('smtp down'); }) };
  expect(createNotifier({ api: broken }).welcome(ada)).toBe(false);
}
```

%% exercise tst-user-service | Build a user service | 3 | js | js | createUserService | 22
Implement `createUserService({ repo })`. The `repo` has `find(id)` (returns the user object or `undefined`) and `save(user)`. The service has `rename(id, newName)`:

- finds the user with `repo.find(id)`; if there is none, **throws** an `Error` whose message contains `'not found'`,
- builds an **updated copy** `{ ...user, name: newName }` (it must **not modify** the object the repo returned),
- calls `repo.save(updatedCopy)` **once**,
- returns the updated copy.

The hidden tests use a **fake repository** backed by a `Map`.

```js
const service = createUserService({ repo });
service.rename(1, 'Grace'); // { id: 1, name: 'Grace', … }
```

%% worked
**A similar problem, solved: `createCounterService({ store })`** — read from a collaborator, compute a new value, write it back, without touching the old object.

```js
function createCounterService({ store }) {
  return {
    increment(key) {
      const current = store.get(key) ?? { count: 0 };      // ① read from the injected collaborator
      const next = { ...current, count: current.count + 1 };   // ② build a COPY: never mutate what you were handed
      store.set(key, next);                                 // ③ write it back once
      return next;
    },
  };
}
```

Copying (`{ ...user, name }`) keeps the original untouched, which matters when other code still holds a reference to it. Check for the missing user **before** doing anything else.

%% explain
- **`find` then `save`**, each exactly once.
- **Missing user**: throw an error containing `'not found'`, and don't call `save`.
- **No mutation** of the user object returned by `find`.
- **Returns** the updated copy.

%% nudge
- What must you do before saving if the user isn't there?
- Why build a new object instead of assigning `user.name = newName`?

%% starter
```js
export function createUserService({ repo }) {
  return {
    rename(id, newName) {
      // your code
    },
  };
}
```

%% tests
```js
const makeRepo = (initial) => {
  const data = new Map(initial.map((u) => [u.id, u]));
  return { find: jest.fn((id) => data.get(id)), save: jest.fn((u) => { data.set(u.id, u); }), data };
};

describe('createUserService', () => {
  it('renames a user and returns the updated copy', () => {
    const repo = makeRepo([{ id: 1, name: 'Ada', role: 'admin' }]);
    const result = createUserService({ repo }).rename(1, 'Grace');
    expect(result).toEqual({ id: 1, name: 'Grace', role: 'admin' });
  });

  it('saves the updated user exactly once', () => {
    const repo = makeRepo([{ id: 1, name: 'Ada' }]);
    createUserService({ repo }).rename(1, 'Grace');
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(repo.data.get(1)).toEqual({ id: 1, name: 'Grace' });
  });

  it('does not modify the original user object', () => {
    const original = { id: 1, name: 'Ada' };
    const repo = makeRepo([original]);
    createUserService({ repo }).rename(1, 'Grace');
    expect(original).toEqual({ id: 1, name: 'Ada' });
  });

  it('throws when the user does not exist, and saves nothing', () => {
    const repo = makeRepo([{ id: 1, name: 'Ada' }]);
    expect(() => createUserService({ repo }).rename(99, 'X')).toThrow('not found');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('looks the user up by id', () => {
    const repo = makeRepo([{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }]);
    createUserService({ repo }).rename(2, 'Bea');
    expect(repo.find).toHaveBeenCalledWith(2);
    expect(repo.data.get(1).name).toBe('Ada');
    expect(repo.data.get(2).name).toBe('Bea');
  });
});
```

%% hints
- `const user = repo.find(id); if (!user) throw new Error('user not found');`
- `const updated = { ...user, name: newName }; repo.save(updated); return updated;`

%% solution
```js
export function createUserService({ repo }) {
  return {
    rename(id, newName) {
      const user = repo.find(id);
      if (!user) throw new Error('user not found');
      const updated = { ...user, name: newName };
      repo.save(updated);
      return updated;
    },
  };
}
```

%% exercise tst-check-user-service | Tests for a user service | 3 | js | js | checkUserService | 28
The service from the previous exercise: `createUserService({ repo })` with `rename(id, newName)`; it reads the user with `repo.find(id)`, throws an error containing `'not found'` if there is none, saves an **updated copy** `{ ...user, name: newName }` with `repo.save` **once**, **doesn't modify** the original object, and returns the updated copy. Write `checkUserService(createUserService)`. **You build the fake repository yourself** (a `Map` plus `jest.fn` spies). Your tests must pass for a correct service and **fail** for: **forgets to save**, **saves the old user**, **doesn't throw for a missing user**, **returns the old user**, **mutates the original object**, **saves twice**.

```js
const repo = { find: jest.fn((id) => data.get(id)), save: jest.fn((u) => data.set(u.id, u)) };
```

%% worked
**A similar problem, solved: `checkCounterService(createCounterService)`** — a fake store lets you assert on **state**, spies on **calls**.

```js
export function checkCounterService(createCounterService) {
  const data = new Map([['hits', { count: 1 }]]);
  const store = { get: jest.fn((k) => data.get(k)), set: jest.fn((k, v) => { data.set(k, v); }) };   // ① a FAKE store with spies
  const result = createCounterService({ store }).increment('hits');
  expect(result).toEqual({ count: 2 });                    // ② the result
  expect(data.get('hits')).toEqual({ count: 2 });          // ③ the STATE in the fake store
  expect(store.set).toHaveBeenCalledTimes(1);              // ④ one write
}
```

The fake (`data`) lets you check **what was stored**, which catches "forgot to save" and "saved the wrong thing". Keep a **reference to the original object** so you can check it wasn't mutated, and keep spies for the **call counts**.

%% explain
- **A fake repo**: a `Map`, `find`/`save` as `jest.fn`s, and the `Map` visible to the test.
- **State**: after `rename`, the repo holds the new name.
- **Calls**: `save` exactly once; `find` with the right id.
- **Originals untouched**: keep a reference to the user object and check it afterwards.
- **Missing user** throws `'not found'`.

%% nudge
- How do you check that the service really saved something?
- How do you check the object returned by `find` wasn't modified?

%% starter
```js
export function checkUserService(createUserService) {
  const data = new Map([[1, { id: 1, name: 'Ada' }]]);
  const repo = {
    find: jest.fn((id) => data.get(id)),
    save: jest.fn((user) => { data.set(user.id, user); }),
  };
  const result = createUserService({ repo }).rename(1, 'Grace');
  expect(result).toEqual({ id: 1, name: 'Grace' });
  // your assertions: stored state, one save, the original untouched, a missing user
}
```

%% tests
```js
const make = ({ save = true, saveOld = false, throws = true, returnOld = false, mutate = false, twice = false } = {}) => ({ repo }) => ({
  rename(id, name) {
    const user = repo.find(id);
    if (!user) { if (throws) throw new Error('user not found'); return null; }
    let updated;
    if (mutate) { user.name = name; updated = user; } else { updated = { ...user, name }; }
    if (save) {
      repo.save(saveOld ? user : updated);
      if (twice) repo.save(saveOld ? user : updated);
    }
    return returnOld ? user : updated;
  },
});
const correct = make();
const mutants = {
  'forgets to save': make({ save: false }),
  'saves the old user': make({ saveOld: true }),
  'does not throw for a missing user': make({ throws: false }),
  'returns the old user': make({ returnOld: true }),
  'mutates the original object': make({ mutate: true }),
  'saves twice': make({ twice: true }),
};

describe('your checkUserService', () => {
  it('passes on a correct service', () => {
    expect(() => checkUserService(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a service that ${name}`, () => {
      expect(() => checkUserService(impl)).toThrow();
    });
  }
});
```

%% hints
- Keep `const original = { id: 1, name: 'Ada' }` in the fake `Map`; after the call `expect(original).toEqual({ id: 1, name: 'Ada' })`.
- After the call, `expect(data.get(1)).toEqual({ id: 1, name: 'Grace' })` proves the new user was saved.
- `expect(repo.save).toHaveBeenCalledTimes(1)` and `expect(() => service.rename(99, 'X')).toThrow('not found')`.

%% solution
```js
export function checkUserService(createUserService) {
  const original = { id: 1, name: 'Ada' };
  const data = new Map([[1, original]]);
  const repo = {
    find: jest.fn((id) => data.get(id)),
    save: jest.fn((user) => { data.set(user.id, user); }),
  };
  const service = createUserService({ repo });
  const result = service.rename(1, 'Grace');
  expect(result).toEqual({ id: 1, name: 'Grace' });
  expect(data.get(1)).toEqual({ id: 1, name: 'Grace' });
  expect(repo.save).toHaveBeenCalledTimes(1);
  expect(original).toEqual({ id: 1, name: 'Ada' });
  expect(() => service.rename(99, 'X')).toThrow('not found');
  expect(repo.save).toHaveBeenCalledTimes(1);
}
```

%% exercise tst-cache | Build a cache with a TTL | 3 | js | js | createCache | 26
Implement `createCache({ fetcher, clock, ttlMs })`. `fetcher(key)` produces a value, `clock.now()` returns the current time in milliseconds. The cache has `get(key)`:

- if the key was fetched **less than `ttlMs` milliseconds ago**, return the **stored** value without calling `fetcher`,
- otherwise call `fetcher(key)`, **remember** the value and the time, and return it.

Each key is cached **independently**. An entry that is **exactly `ttlMs` old has expired**. Reading a cached value does **not** extend its life.

```js
const cache = createCache({ fetcher, clock, ttlMs: 100 });
cache.get('a'); // calls fetcher('a')
cache.get('a'); // within 100 ms: no call
```

%% worked
**A similar problem, solved: `createOnce({ producer })`** — compute a value on first use and remember it.

```js
function createOnce({ producer }) {
  let ready = false, value;
  return {
    get() {
      if (!ready) { value = producer(); ready = true; }   // ① the expensive call happens at most once
      return value;
    },
  };
}
```

A TTL cache is that per key, plus **time**: store `{ value, at }` in a `Map`, and treat an entry as fresh when `clock.now() - entry.at < ttlMs`. Because `now` comes from the injected clock, tests can move time forward instantly.

%% explain
- **Per-key entries** `{ value, at }` in a `Map`.
- **Fresh** when `now − at < ttlMs`; **age = ttl** is already expired.
- **A hit doesn't refresh** `at`.
- **Miss or expired** → call `fetcher(key)` and store with the current time.

%% nudge
- Which operator decides if the entry is still fresh: `<` or `<=`?
- What do you store with each value?

%% starter
```js
export function createCache({ fetcher, clock, ttlMs }) {
  return {
    get(key) {
      // your code
    },
  };
}
```

%% tests
```js
const setup = (ttlMs = 100) => {
  let t = 0;
  let n = 0;
  const fetcher = jest.fn((key) => `${key}:${++n}`);
  const cache = createCache({ fetcher, clock: { now: () => t }, ttlMs });
  return { cache, fetcher, at: (time) => { t = time; } };
};

describe('createCache', () => {
  it('fetches on the first get and returns the value', () => {
    const { cache, fetcher } = setup();
    expect(cache.get('a')).toBe('a:1');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('a');
  });

  it('serves repeated gets from the cache within the ttl', () => {
    const { cache, fetcher, at } = setup();
    cache.get('a');
    at(50);
    expect(cache.get('a')).toBe('a:1');
    at(99);
    expect(cache.get('a')).toBe('a:1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('expires an entry exactly ttl milliseconds old', () => {
    const { cache, fetcher, at } = setup();
    cache.get('a');
    at(100);
    expect(cache.get('a')).toBe('a:2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('caches each key independently', () => {
    const { cache, fetcher, at } = setup();
    expect(cache.get('a')).toBe('a:1');
    at(10);
    expect(cache.get('b')).toBe('b:2');
    expect(cache.get('a')).toBe('a:1');
    expect(cache.get('b')).toBe('b:2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not extend an entry when it is read', () => {
    const { cache, fetcher, at } = setup();
    cache.get('a');
    at(60);
    cache.get('a');
    at(120);
    expect(cache.get('a')).toBe('a:2');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('measures the age from the moment of the last fetch', () => {
    const { cache, at } = setup();
    cache.get('a');
    at(100);
    cache.get('a');
    at(199);
    expect(cache.get('a')).toBe('a:2');
    at(200);
    expect(cache.get('a')).toBe('a:3');
  });
});
```

%% hints
- `const entries = new Map();` In `get`: `const e = entries.get(key); const now = clock.now();`
- If `e && now - e.at < ttlMs` return `e.value`; otherwise `const value = fetcher(key); entries.set(key, { value, at: now }); return value;`.

%% solution
```js
export function createCache({ fetcher, clock, ttlMs }) {
  const entries = new Map();
  return {
    get(key) {
      const now = clock.now();
      const entry = entries.get(key);
      if (entry && now - entry.at < ttlMs) return entry.value;
      const value = fetcher(key);
      entries.set(key, { value, at: now });
      return value;
    },
  };
}
```

%% exercise tst-check-cache | Tests for a cache | 4 | js | js | checkCache | 38
The cache from the previous exercise: `createCache({ fetcher, clock, ttlMs })` with `get(key)`: fetches on a miss, serves the stored value while the entry is **younger than `ttlMs`**, treats an entry **exactly `ttlMs` old as expired**, caches each key independently, and **doesn't extend** an entry's life when it is read. Write `checkCache(createCache)`: use a **controllable clock** (an object whose `now()` returns a variable you change) and a **spy fetcher**. Your tests must pass for a correct cache and **fail** for: **never caches**, **never expires**, **expires one tick late**, **expires one tick early**, **shares one entry between all keys**, **refreshes the entry on every read**.

```js
let t = 0;
const clock = { now: () => t };
const fetcher = jest.fn((key) => key + ':' + ++version);
```

%% worked
**A similar problem, solved: `checkOnce(createOnce)`** — testing "at most one call" with a spy.

```js
export function checkOnce(createOnce) {
  const producer = jest.fn(() => 'value');
  const once = createOnce({ producer });
  expect(producer).not.toHaveBeenCalled();         // ① lazy: nothing happens until get()
  expect(once.get()).toBe('value');
  expect(once.get()).toBe('value');
  expect(producer).toHaveBeenCalledTimes(1);       // ② two gets, one call
}
```

For time-dependent code, the trick is a **controllable clock**: `let t = 0; const clock = { now: () => t };` — then **assign `t`** to move time. Make the fetcher return a **different value on each call** (`key + ':' + ++n`) so a stale value and a fresh one are distinguishable, and assert on **both** the value and the **call count**. Probe the **exact boundary**: one tick before expiry, and the tick of expiry.

%% explain
- **A mutable `t`** behind `clock.now()`.
- **A spy fetcher** returning a new value per call, so you can tell cached from fresh.
- **The boundary**: `ttl − 1` still cached, `ttl` expired.
- **A re-read** at `t` must not extend the entry.
- **Two keys** to check they don't share an entry.

%% nudge
- Which time value distinguishes `<` from `<=` in the expiry check?
- How could you notice that reading an entry extended its life?

%% starter
```js
export function checkCache(createCache) {
  let t = 0;
  let version = 0;
  const fetcher = jest.fn((key) => `${key}:${++version}`);
  const cache = createCache({ fetcher, clock: { now: () => t }, ttlMs: 100 });
  expect(cache.get('a')).toBe('a:1');
  expect(fetcher).toHaveBeenCalledTimes(1);
  // your assertions: a hit, another key, one tick before expiry, exactly at expiry, no extension on read
}
```

%% tests
```js
const make = ({ perKey = true, caches = true, fresh = (age, ttl) => age < ttl, slide = false } = {}) => ({ fetcher, clock, ttlMs }) => {
  const entries = new Map();
  return {
    get(key) {
      const id = perKey ? key : '*';
      const entry = entries.get(id);
      const now = clock.now();
      if (caches && entry && fresh(now - entry.at, ttlMs)) {
        if (slide) entry.at = now;
        return entry.value;
      }
      const value = fetcher(key);
      entries.set(id, { value, at: now });
      return value;
    },
  };
};
const correct = make();
const mutants = {
  'never caches': make({ caches: false }),
  'never expires': make({ fresh: () => true }),
  'expires one tick late': make({ fresh: (age, ttl) => age <= ttl }),
  'expires one tick early': make({ fresh: (age, ttl) => age < ttl - 1 }),
  'shares one entry between all keys': make({ perKey: false }),
  'refreshes the entry on every read': make({ slide: true }),
};

describe('your checkCache', () => {
  it('passes on a correct cache', () => {
    expect(() => checkCache(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a cache that ${name}`, () => {
      expect(() => checkCache(impl)).toThrow();
    });
  }
});
```

%% hints
- Hit: `t = 50; expect(cache.get('a')).toBe('a:1'); expect(fetcher).toHaveBeenCalledTimes(1)`. Another key: `expect(cache.get('b')).toBe('b:2')`.
- Boundary: `t = 99` still `'a:1'`; `t = 100` is a refetch (`'a:3'` once `b` used version 2).
- No extension: read `a` at `t = 60`, and check that at `t = 100` it has still expired (the original fetch was at `0`).

%% solution
```js
export function checkCache(createCache) {
  let t = 0;
  let version = 0;
  const fetcher = jest.fn((key) => `${key}:${++version}`);
  const cache = createCache({ fetcher, clock: { now: () => t }, ttlMs: 100 });

  expect(cache.get('a')).toBe('a:1');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher).toHaveBeenCalledWith('a');

  t = 50;
  expect(cache.get('a')).toBe('a:1');
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(cache.get('b')).toBe('b:2');
  expect(fetcher).toHaveBeenCalledTimes(2);

  t = 60;
  expect(cache.get('a')).toBe('a:1');

  t = 99;
  expect(cache.get('a')).toBe('a:1');
  expect(fetcher).toHaveBeenCalledTimes(2);

  t = 100;
  expect(cache.get('a')).toBe('a:3');
  expect(fetcher).toHaveBeenCalledTimes(3);
}
```
