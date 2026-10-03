---
id: test-react-rtl
track: test
title: Testing React components
summary: React Testing Library's idea, query like a user, then using getBy, queryBy and findBy, userEvent, forms and hooks, and writing component tests that catch real UI bugs.
---

## The idea in one sentence

Test a component the way a **person uses it**: find things by what they **are** (a button called "Save"), do what a user does (click, type), and check what the screen **shows**.

> **Analogy** A restaurant inspector doesn't open the kitchen's wiring. They order a meal, taste it, and check the bill. If you rewire the kitchen but the meal is the same, they notice nothing. A good component test is that inspector.

![Render, find, act, assert](fig:tst-rtl-flow "The test never reads state or props of the component: only the screen.")

## Find things like a user

Testing Library offers many queries. Prefer the ones that match what **users and screen readers** perceive.

![Query priority](fig:tst-query-ladder "getByRole first. getByTestId only when nothing else can identify the element.")

A role plus an accessible name is the strongest query, and it also **proves your markup is accessible**: if `getByRole('button', { name: 'Save' })` works, a screen reader can find it too.

```js try predict
// A tiny pretend accessibility tree, to see why roles + names work
const tree = [
  { role: 'heading', name: 'Sign in' },
  { role: 'textbox', name: 'Email' },
  { role: 'button', name: 'Log in' },
];
const getByRole = (role, { name }) => {
  const hits = tree.filter((n) => n.role === role && n.name === name);
  if (hits.length !== 1) throw new Error(`expected 1 ${role} named ${name}, found ${hits.length}`);
  return hits[0];
};
console.log(getByRole('button', { name: 'Log in' }));
try { getByRole('button', { name: 'Sign up' }); } catch (e) { console.log(e.message); }
```

## getBy, queryBy, findBy

![The three query families](fig:tst-query-kinds "Which one you pick says what you expect: present now, absent, or arriving later.")

```tsx
expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();        // must exist now
expect(screen.queryByRole('alert')).not.toBeInTheDocument();                // must be absent
expect(await screen.findByText('Saved!')).toBeInTheDocument();             // will appear
```

A common slip: `getBy` to assert **absence** throws before your assertion runs. Use `queryBy` for "not there".

## Acting like a user

`userEvent` simulates real interaction: it focuses, types key by key, clicks. Always **await** it.

```tsx
render(<LoginForm onSubmit={onSubmit} />);
await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
await userEvent.type(screen.getByLabelText('Password'), 'correct-horse');
await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct-horse' });
```

Notice there is **no** reference to state, props of the component, or class names. Rename the state variables and this test still passes.

## Following one test step by step

```stepper A counter test
code:
  render(<Counter initial={5} />);
  expect(screen.getByText('Count: 5')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
  expect(screen.getByText('Count: 6')).toBeInTheDocument();
---
line: 1
say: **Render** the component with an initial value. This puts it into a fake page, ready to use.
screen shows: Count: 5, [Increment]
---
line: 2
say: **Assert the starting state** from the user's point of view: the text on screen, not a variable.
result: pass
---
line: 3
say: **Act**: find the button by role and name, then click it. `await` lets React finish updating.
screen shows: Count: 6, [Increment]
---
line: 4
say: **Assert the new screen.** A counter that adds 2, ignores the click, or forgot the initial value fails right here.
result: pass
```

## Testing hooks

A custom hook can't be called outside a component, so use `renderHook`. Wrap changes in `act` so React applies them before you look.

```tsx
const { result } = renderHook(() => useToggle());
expect(result.current.value).toBe(false);
act(() => result.current.toggle());
expect(result.current.value).toBe(true);
```

`result.current` is always the **latest** return value. Check what callers rely on, including **stable identities** (`toggle` should be the same function across renders if it is memoised).

## Quick check

```check
Q: Which query is best for a "Save" button?
A) getByTestId('save')
B) getByRole('button', { name: 'Save' }) *
C) container.querySelector('.btn')
D) getByText('S')
Why: Role and name match what users and assistive technology see, and prove the button is accessible.
---
Q: How do you assert that an error message is NOT on screen?
A) expect(screen.getByRole('alert')).toBeNull()
B) expect(screen.queryByRole('alert')).not.toBeInTheDocument() *
C) await screen.findByRole('alert')
D) You can't
Why: getBy throws when nothing matches; queryBy returns null, which is what you want to assert on.
---
Q: When should you use findBy?
A) When the element is there immediately
B) When the element appears later, for example after a request *
C) To count elements
D) Never
Why: findBy returns a promise that retries until the element appears or a timeout passes.
---
Q: Why `await userEvent.click(...)`?
A) It's required syntax
B) userEvent is async: it simulates focus, events and React updates before you assert *
C) To slow the test
D) To log
Why: Without await your assertion may run before the interaction has finished.
---
Q: A test reads `component.state.count`. What is wrong with it?
A) Nothing
B) It tests an implementation detail: renaming state breaks the test while the UI is still correct *
C) It runs too fast
D) State can't be read
Why: Test the output users see; internals change without changing behaviour.
```

## Recap

- **Query like a user**: `getByRole` with a name first, then labels, then text, test ids last.
- **`getBy`** must exist, **`queryBy`** can be absent (use for "not there"), **`findBy`** will arrive.
- **Await `userEvent`**; assert on the **screen**, not on state.
- Test hooks with **`renderHook`** and **`act`**.
- In "write the tests" exercises your check function renders mutant components and must fail on every one.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: an accessible switch | `role="switch"`, `aria-checked`, a click handler |
| Tests for a counter | `render`, `getByRole`, `userEvent.click`; render once per scenario and `unmount()` |
| Build a login form | Labels, `onSubmit` with `preventDefault`, an `alert` message |
| Tests for a login form | `userEvent.type`, `queryByRole('alert')`, a `jest.fn()` |
| Tests for a toggle hook | `renderHook`, `act`, comparing `toggle` between renders |

%% exercise tst-guided-switch | Guided: an accessible switch | 1 | tsx | react | Switch | 8 | guided
Build `<Switch label onChange? />`: a **button** with `role="switch"` and the visible text from `label`. It starts **off** (`aria-checked="false"`). Each click toggles it and sets `aria-checked` to `"true"` or `"false"`. If `onChange` is given, call it with the **new** boolean value.

```tsx
<Switch label="Notifications" onChange={(on) => console.log(on)} />
```

%% worked
**A similar problem, solved: `<Disclosure title>`** — a button whose `aria-expanded` mirrors state.

```tsx
import { useState } from 'react';

export function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button aria-expanded={open} onClick={() => setOpen((o) => !o)}>{title}</button>   {/* ① state shown through an ARIA attribute */}
      {open && <p>{children}</p>}
    </div>
  );
}
```

Exposing the state through an accessible attribute is what lets tests (and screen readers) read it: `expect(button).toHaveAttribute('aria-expanded', 'true')`.

%% explain
- **A `<button role="switch">`** labelled with `label`.
- **`aria-checked`** is `"false"` at first and flips on every click.
- **`onChange(newValue)`** is called with the new boolean when provided.

%% nudge
- Which attribute tells assistive technology that the switch is on?
- Should `onChange` receive the old or the new value?

%% starter
```tsx
import { useState } from 'react';

interface SwitchProps {
  label: string;
  onChange?: (on: boolean) => void;
}

export function Switch({ label, onChange }: SwitchProps) {
  // Step 1 — const [on, setOn] = useState(false);
  // Step 2 — a button with role="switch" and aria-checked={on}
  return null;
}
```

%% tests
```tsx
describe('Switch', () => {
  it('is a switch with an accessible name, off at first', () => {
    render(<Switch label="Notifications" />);
    const sw = screen.getByRole('switch', { name: 'Notifications' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles on each click', async () => {
    render(<Switch label="Notifications" />);
    const sw = screen.getByRole('switch', { name: 'Notifications' });
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onChange with the new value', async () => {
    const onChange = jest.fn();
    render(<Switch label="Dark mode" onChange={onChange} />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    await userEvent.click(sw);
    await userEvent.click(sw);
    expect(onChange.mock.calls).toEqual([[true], [false]]);
  });

  it('works without onChange', async () => {
    render(<Switch label="Quiet" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Quiet' }));
    expect(screen.getByRole('switch', { name: 'Quiet' })).toHaveAttribute('aria-checked', 'true');
  });
});
```

%% hints
- `const [on, setOn] = useState(false);`
- `function toggle() { const next = !on; setOn(next); onChange?.(next); }`
- `<button role="switch" aria-checked={on} onClick={toggle}>{label}</button>`

%% solution
```tsx
import { useState } from 'react';

interface SwitchProps {
  label: string;
  onChange?: (on: boolean) => void;
}

export function Switch({ label, onChange }: SwitchProps) {
  const [on, setOn] = useState(false);
  function toggle() {
    const next = !on;
    setOn(next);
    onChange?.(next);
  }
  return (
    <button role="switch" aria-checked={on} onClick={toggle}>
      {label}
    </button>
  );
}
```

%% exercise tst-check-counter | Tests for a counter | 3 | tsx | react | checkCounter | 24
A `<Counter initial? />` shows `Count: N` (starting at `initial`, default 0) and has three buttons: **Increment** (+1), **Decrement** (−1, but **never below 0**) and **Reset** (back to `initial`). Write an **async** `checkCounter(Counter)` that renders the component it is given and passes for a correct counter but **fails** for: **increments by 2**, **decrements by 2**, **ignores the initial value**, **reset goes to zero**, **goes below zero**, **decrement adds instead of subtracting**.

```tsx
render(<Counter initial={5} />);
await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
```

%% worked
**A similar problem, solved: `checkBadge(Badge)`** — a component that shows `Unread: N` and a **Clear** button.

```tsx
export async function checkBadge(Badge) {
  const { unmount } = render(<Badge count={3} />);                 // ① render the component you were given
  expect(screen.getByText('Unread: 3')).toBeInTheDocument();       // ② starting state, as the user sees it
  await userEvent.click(screen.getByRole('button', { name: 'Clear' }));   // ③ act like a user
  expect(screen.getByText('Unread: 0')).toBeInTheDocument();       // ④ the new screen
  unmount();                                                       // ⑤ clean up before the next scenario
  render(<Badge count={0} />);
  expect(screen.getByText('Unread: 0')).toBeInTheDocument();       // ⑥ an edge: nothing to clear
}
```

Render **once per scenario** and `unmount()` in between, otherwise two components share the page and queries find duplicates. Use values that **distinguish** bugs: an initial of `5` shows an ignored initial value, two decrements tell "−1" from "−2".

%% explain
- **Initial value shown**: `initial={5}` → `Count: 5`.
- **Each button** moves by exactly one step; check after **several** clicks.
- **Reset** returns to **5**, not 0.
- **The floor**: a counter at 0 stays at 0 after Decrement.

%% nudge
- Which starting value shows both "ignores initial" and "reset goes to zero"?
- What do you do at 0 to catch a counter that goes negative?

%% starter
```tsx
export async function checkCounter(Counter: any) {
  render(<Counter initial={5} />);
  expect(screen.getByText('Count: 5')).toBeInTheDocument();
  // your assertions: Increment, Decrement, Reset, and the floor at zero
}
```

%% tests
```tsx
const make = ({ inc = 1, dec = 1, init = true, resetTo = 'initial', floor = true, decAdds = false } = {}) =>
  function C({ initial = 0 }: { initial?: number }) {
    const start = init ? initial : 0;
    const [n, setN] = React.useState(start);
    return (
      <div>
        <p>Count: {n}</p>
        <button onClick={() => setN((v) => v + inc)}>Increment</button>
        <button onClick={() => setN((v) => (decAdds ? v + dec : floor ? Math.max(0, v - dec) : v - dec))}>Decrement</button>
        <button onClick={() => setN(resetTo === 'initial' ? start : 0)}>Reset</button>
      </div>
    );
  };
const correct = make();
const mutants = {
  'increments by 2': make({ inc: 2 }),
  'decrements by 2': make({ dec: 2 }),
  'ignores the initial value': make({ init: false }),
  'resets to zero': make({ resetTo: 'zero' }),
  'goes below zero': make({ floor: false }),
  'adds when you press decrement': make({ decAdds: true }),
};

describe('your checkCounter', () => {
  it('passes on a correct counter', async () => {
    await checkCounter(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a counter that ${name}`, async () => {
      let caught = false;
      try { await checkCounter(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Start at 5: `Count: 5`, one Increment → `Count: 6`, two Decrement → `Count: 4`, Reset → `Count: 5`.
- `unmount()` then `render(<Counter />)`: `Count: 0`, click Decrement, still `Count: 0`.

%% solution
```tsx
export async function checkCounter(Counter: any) {
  const first = render(<Counter initial={5} />);
  expect(screen.getByText('Count: 5')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
  expect(screen.getByText('Count: 6')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Decrement' }));
  await userEvent.click(screen.getByRole('button', { name: 'Decrement' }));
  expect(screen.getByText('Count: 4')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByText('Count: 5')).toBeInTheDocument();
  first.unmount();

  render(<Counter />);
  expect(screen.getByText('Count: 0')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Decrement' }));
  expect(screen.getByText('Count: 0')).toBeInTheDocument();
}
```

%% exercise tst-login-form | Build a login form | 3 | tsx | react | LoginForm | 22
Build `<LoginForm onSubmit />`.

- Two fields with **labels** `Email` and `Password`, and a **Log in** button; submitting is a real `<form>` submit.
- If the email is **empty** (blank after trimming), show an element with `role="alert"` and the text `Email is required`, and do **not** call `onSubmit`.
- Otherwise, if the password has **fewer than 8** characters, show `Password must be at least 8 characters` and do **not** call `onSubmit`.
- Otherwise clear any error and call `onSubmit({ email, password })` **once**.

%% worked
**A similar problem, solved: `<NameForm onSave />`** — a labelled field with a required check.

```tsx
import { useState } from 'react';

export function NameForm({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();                                   // ① stop the browser reloading the page
    if (!name.trim()) { setError('Name is required'); return; }
    setError('');
    onSave(name);
  }

  return (
    <form onSubmit={submit}>
      <label>Name <input value={name} onChange={(e) => setName(e.target.value)} /></label>   {/* ② label gives the input its accessible name */}
      <button type="submit">Save</button>
      {error && <p role="alert">{error}</p>}              {/* ③ role="alert" so it is announced and testable */}
    </form>
  );
}
```

Hidden tests find the fields with `getByLabelText`, the button with `getByRole`, and the message with `getByRole('alert')`.

%% explain
- **Labelled inputs** (`Email`, `Password`) and a submit button.
- **Validation order**: email first, then password length.
- **Errors** appear in `role="alert"`; **no `onSubmit`** when invalid.
- **A valid submit** clears the error and calls `onSubmit` once with both values.

%% nudge
- What do you call on the form event so the page does not reload?
- Where do you clear the error?

%% starter
```tsx
import { useState } from 'react';

interface LoginFormProps {
  onSubmit: (data: { email: string; password: string }) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  // your state, handler and markup
  return null;
}
```

%% tests
```tsx
describe('LoginForm', () => {
  it('has labelled fields and a button', () => {
    render(<LoginForm onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('requires an email', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('treats a blank email as empty', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Email'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
  });

  it('requires at least 8 characters of password', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'abcdefg');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits once with the data and clears the error', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'abcdefg');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    await userEvent.type(screen.getByLabelText('Password'), 'h');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'abcdefgh' });
  });
});
```

%% hints
- State: `email`, `password`, `error`.
- `function handle(e: React.FormEvent) { e.preventDefault(); if (!email.trim()) { setError('Email is required'); return; } if (password.length < 8) { setError('Password must be at least 8 characters'); return; } setError(''); onSubmit({ email, password }); }`
- `<label>Email <input value={email} onChange={...} /></label>`, same for password with `type="password"`.

%% solution
```tsx
import { useState } from 'react';

interface LoginFormProps {
  onSubmit: (data: { email: string; password: string }) => void;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setError('');
    onSubmit({ email, password });
  }

  return (
    <form onSubmit={handle}>
      <label>
        Email <input value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <button type="submit">Log in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

%% exercise tst-check-login-form | Tests for a login form | 4 | tsx | react | checkLoginForm | 32
The `<LoginForm onSubmit />` from the previous exercise: an empty email shows the alert `Email is required`; a password shorter than 8 characters shows `Password must be at least 8 characters`; a valid form calls `onSubmit({ email, password })` **once** and shows no alert. Write an **async** `checkLoginForm(LoginForm)` that passes for a correct form and **fails** for: **submits without an email**, **accepts a 7-character password**, **rejects an 8-character password**, **calls onSubmit twice**, **sends the fields swapped**, **never shows an error message**, **keeps the error after a valid submit**.

```tsx
const onSubmit = jest.fn();
render(<LoginForm onSubmit={onSubmit} />);
```

%% worked
**A similar problem, solved: `checkNameForm(NameForm)`** — an error case, then a valid case in the same render.

```tsx
export async function checkNameForm(NameForm) {
  const onSave = jest.fn();
  render(<NameForm onSave={onSave} />);
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));       // ① submit empty
  expect(screen.getByRole('alert')).toHaveTextContent('Name is required');   // ② the message
  expect(onSave).not.toHaveBeenCalled();                                     // ③ and nothing was saved
  await userEvent.type(screen.getByLabelText('Name'), 'Ada');                // ④ fix it in the SAME form
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();               // ⑤ the error is gone
  expect(onSave).toHaveBeenCalledTimes(1);                                   // ⑥ exactly one call
  expect(onSave).toHaveBeenCalledWith('Ada');                                // ⑦ with the right data
}
```

Going from the failing case to the passing case **in one render** is how you catch "the error never clears". Test **both sides of each boundary**: a password of 7 must fail and one of 8 must pass.

%% explain
- **Empty submit**: the email message and **no call**.
- **7 characters**: the password message and no call; **8 characters**: accepted.
- **Valid submit**: **one** call with `{ email, password }` in the right fields; no alert afterwards.

%% nudge
- Which scenario catches an error that stays on screen after success?
- What distinguishes "swapped fields" from correct data?

%% starter
```tsx
export async function checkLoginForm(LoginForm: any) {
  const onSubmit = jest.fn();
  render(<LoginForm onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
  expect(onSubmit).not.toHaveBeenCalled();
  // your assertions: the messages, the 7/8 boundary, and the data sent
}
```

%% tests
```tsx
const make = ({ needsEmail = true, minLen = 8, extraCall = false, swap = false, showError = true, clears = true } = {}) =>
  function F({ onSubmit }: { onSubmit: (d: { email: string; password: string }) => void }) {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [error, setError] = React.useState('');
    function handle(e: React.FormEvent) {
      e.preventDefault();
      if (needsEmail && !email.trim()) { if (showError) setError('Email is required'); return; }
      if (password.length < minLen) { if (showError) setError('Password must be at least 8 characters'); return; }
      if (clears) setError('');
      const data = swap ? { email: password, password: email } : { email, password };
      onSubmit(data);
      if (extraCall) onSubmit(data);
    }
    return (
      <form onSubmit={handle}>
        <label>Email <input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>Password <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button type="submit">Log in</button>
        {error && <p role="alert">{error}</p>}
      </form>
    );
  };
const correct = make();
const mutants = {
  'submits without an email': make({ needsEmail: false }),
  'accepts a 7-character password': make({ minLen: 7 }),
  'rejects an 8-character password': make({ minLen: 9 }),
  'calls onSubmit twice': make({ extraCall: true }),
  'sends the fields swapped': make({ swap: true }),
  'never shows an error message': make({ showError: false }),
  'keeps the error after a valid submit': make({ clears: false }),
};

describe('your checkLoginForm', () => {
  it('passes on a correct form', async () => {
    await checkLoginForm(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a form that ${name}`, async () => {
      let caught = false;
      try { await checkLoginForm(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Step 1: click Log in with nothing typed: `getByRole('alert')` has `Email is required`, `onSubmit` not called.
- Step 2: type an email and `'abcdefg'` (7): the password message appears, no call.
- Step 3: type `'h'` into the password (now 8) and submit: `queryByRole('alert')` is absent, one call with `{ email: 'ada@example.com', password: 'abcdefgh' }`.

%% solution
```tsx
export async function checkLoginForm(LoginForm: any) {
  const onSubmit = jest.fn();
  render(<LoginForm onSubmit={onSubmit} />);
  const submit = () => userEvent.click(screen.getByRole('button', { name: 'Log in' }));

  await submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Email is required');
  expect(onSubmit).not.toHaveBeenCalled();

  await userEvent.type(screen.getByLabelText('Email'), 'ada@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'abcdefg');
  await submit();
  expect(screen.getByRole('alert')).toHaveTextContent('Password must be at least 8 characters');
  expect(onSubmit).not.toHaveBeenCalled();

  await userEvent.type(screen.getByLabelText('Password'), 'h');
  await submit();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'abcdefgh' });
}
```

%% exercise tst-check-use-toggle | Tests for a toggle hook | 4 | tsx | react | checkUseToggle | 28
`useToggle(initial = false)` returns `{ value, toggle, setTrue, setFalse }`. `toggle` flips the value (and must work when called **twice in a row** inside one `act`), `setTrue` and `setFalse` set it, and `toggle` must keep the **same function identity** between renders. Write `checkUseToggle(useToggle)` with `renderHook` and `act` that passes for a correct hook and **fails** for: **toggle does nothing**, **setTrue sets false**, **ignores the initial value**, **setFalse does nothing**, **toggles from a stale value**, **creates a new toggle every render**.

```tsx
const { result } = renderHook(() => useToggle());
act(() => result.current.toggle());
```

%% worked
**A similar problem, solved: `checkUseCounter(useCounter)`** — drive a hook through `renderHook` and `act`.

```tsx
export function checkUseCounter(useCounter) {
  const { result, rerender } = renderHook(() => useCounter(10));
  expect(result.current.count).toBe(10);                          // ① the initial value
  act(() => result.current.inc());                                // ② changes go through act
  act(() => result.current.inc());
  expect(result.current.count).toBe(12);                          // ③ read the LATEST value from result.current
  const before = result.current.inc;
  rerender();
  expect(result.current.inc).toBe(before);                        // ④ same function after a rerender
}
```

Two calls **inside one `act`** (`act(() => { toggle(); toggle(); })`) reveal code that reads a stale value instead of using the updater form.

%% explain
- **Initial value**: `useToggle()` is `false`, `useToggle(true)` is `true`.
- **`toggle`** flips; **twice in one `act`** returns to the start.
- **`setTrue` / `setFalse`** set the value even if repeated.
- **Identity**: `toggle` is `===` before and after `rerender()`.

%% nudge
- What does a stale `set(!value)` do when called twice before React re-renders?
- How do you compare a function between two renders?

%% starter
```tsx
export function checkUseToggle(useToggle: any) {
  const { result } = renderHook(() => useToggle());
  expect(result.current.value).toBe(false);
  // your assertions: toggle, setTrue, setFalse, initial true, double toggle, identity
}
```

%% tests
```tsx
const make = ({ flip = true, trueTo = true, init = true, falseWorks = true, updater = true, stable = true } = {}) =>
  (initial = false) => {
    const [value, set] = React.useState(init ? initial : false);
    const run = () => { if (!flip) return; if (updater) set((v: boolean) => !v); else set(!value); };
    const memo = React.useCallback(run, []);
    return {
      value,
      toggle: stable ? memo : run,
      setTrue: () => set(trueTo),
      setFalse: () => { if (falseWorks) set(false); },
    };
  };
const correct = make();
const mutants = {
  'toggle does nothing': make({ flip: false }),
  'setTrue sets false': make({ trueTo: false }),
  'ignores the initial value': make({ init: false }),
  'setFalse does nothing': make({ falseWorks: false }),
  'toggles from a stale value': make({ updater: false }),
  'creates a new toggle every render': make({ stable: false }),
};

describe('your checkUseToggle', () => {
  it('passes on a correct hook', () => {
    expect(() => checkUseToggle(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a hook where ${name}`, () => {
      expect(() => checkUseToggle(impl)).toThrow();
    });
  }
});
```

%% hints
- `act(() => result.current.toggle())` then `expect(result.current.value).toBe(true)`, and again for `false`.
- `act(() => { result.current.toggle(); result.current.toggle(); })` must leave the value unchanged.
- `const before = result.current.toggle; rerender(); expect(result.current.toggle).toBe(before);`
- `renderHook(() => useToggle(true))` for the initial value; set `setFalse` after `setTrue`.

%% solution
```tsx
export function checkUseToggle(useToggle: any) {
  const { result, rerender } = renderHook(() => useToggle());
  expect(result.current.value).toBe(false);

  act(() => result.current.toggle());
  expect(result.current.value).toBe(true);
  act(() => result.current.toggle());
  expect(result.current.value).toBe(false);

  act(() => { result.current.toggle(); result.current.toggle(); });
  expect(result.current.value).toBe(false);

  act(() => result.current.setTrue());
  expect(result.current.value).toBe(true);
  act(() => result.current.setTrue());
  expect(result.current.value).toBe(true);
  act(() => result.current.setFalse());
  expect(result.current.value).toBe(false);

  const before = result.current.toggle;
  rerender();
  expect(result.current.toggle).toBe(before);

  const on = renderHook(() => useToggle(true));
  expect(on.result.current.value).toBe(true);
}
```
