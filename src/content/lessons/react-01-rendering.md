---
id: react-rendering
track: react
title: Components, props & rendering lists
summary: What JSX really is, how components take props and compose, and why list keys are about identity — not performance.
---

## The idea in one sentence

A React **component** is a **function that takes some data (props) and returns a description of what the screen should look like**.

> **Analogy** A component is a **cookie cutter**. The cutter (the function) stays the same; give it different dough (props) and you get different cookies (screen output). React's job is to take the cookies you hand it and make the real page match them — changing as little as possible.

```tsx try
function Welcome({ name, role }: { name: string; role?: string }) {
  return (
    <p style={{ fontFamily: 'system-ui' }}>
      Hello, <b>{name}</b>{role && <> — {role}</>}
    </p>
  );
}

export default function App() {
  return (
    <div>
      <Welcome name="Ada" role="engineer" />
      <Welcome name="Grace" />
    </div>
  );
}
```

One function, used twice with different **props**. Change a prop in the editor and press Run.

## JSX is just function calls

```tsx
const el = <h1 className="title">Hello, {name}</h1>;
// compiles to (roughly):
const el2 = jsx('h1', { className: 'title', children: ['Hello, ', name] });
```

That call returns a plain object — a **React element**, like `{ type: 'h1', props: { … } }`. It is **not** a DOM node; it's a cheap *description*. React compares the elements from this render with the previous ones and updates only the real DOM that differs.

![JSX compiles to an element object; React diffs it and updates only what changed in the DOM](fig:jsx-pipeline "An element is a description of the UI, not the UI itself.")

What follows from that:

- Components are functions from **props → elements**. Same props, same output, so keep them **pure**: no changing outside variables, no network calls while rendering.
- **Props are read-only.** Writing to `props.x` fights the model — if something changes over time, it's **state** (previous lesson).
- Inside `{ }` you can put any **expression** (a variable, a ternary, `.map(...)`), but not a *statement* (`if`, `for`). Compute with a ternary, `&&`, or before the `return`.
- `null`, `undefined`, `true` and `false` render **nothing**. But `0` renders a **`0`**:

```tsx try
export default function App() {
  const count = 0;
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <p>Buggy: [{count && <b>unread</b>}]</p>
      <p>Fixed: [{count > 0 && <b>unread</b>}]</p>
    </div>
  );
}
```

`{count && <b>…</b>}` shows the stray `0`. Write `count > 0 && …` (or a ternary) so the left side is a real `true`/`false`.

## Render vs commit

Every update has phases:

![Render, diff, commit and effects: render is pure; effects run after the DOM is updated](fig:render-commit "Calling your component is the **render** phase: it must be pure, and React may run it more than once or throw the result away. Only **commit** touches the DOM.")

That's why you must not put side effects (fetching, timers, changing the DOM) in the component body. They belong in **event handlers** and **effects** (next lessons).

## Children and composition

`children` is just another prop — whatever you put between the tags. Prefer **composition** ("slots") over a pile of configuration props:

```tsx try
function Card({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #aaa', borderRadius: 8, padding: 12, fontFamily: 'system-ui' }}>
      <h2 style={{ margin: 0 }}>{title}</h2>
      {children}
      {footer && <footer style={{ color: '#666', marginTop: 8 }}>{footer}</footer>}
    </section>
  );
}

export default function App() {
  return (
    <Card title="Order #12" footer={<button>Reorder</button>}>
      <p>2 items · shipped</p>
    </Card>
  );
}
```

A prop can be *any* value — a string, a number, an element (`footer`), or a function. "Slots", "render props" and even hooks all come from that one fact.

## Lists and keys

Turn an array into elements with `.map`, and give each element a **`key`**:

```tsx
<ul>
  {users.map((u) => (
    <li key={u.id}>{u.name}</li>
  ))}
</ul>
```

`key` is how React answers **"is this the same item as last time?"** Same key (and same type) → keep the existing DOM node *and its state*, just update the props. A new key → create a new one. A missing key → remove it.

- Use a **stable, unique id from your data**.
- **Index keys are a bug** as soon as the list can be reordered, filtered or inserted into: React ties the state (typed text, checkboxes, focus) to the *position*, not the item.
- Keys must be unique only among **siblings**.
- Changing a component's `key` also **resets** it: React throws the old one away and mounts a fresh one.

![With index keys the typed text stays at the position after a deletion; with id keys it follows the item](fig:keys-identity "Type into each box, delete the first item, and compare. The state belongs to whichever item React thinks is 'the same'.")

Try it — type something different into each box, then press **Remove first** in each list. Watch which text ends up next to which label:

```tsx try
import { useState } from 'react';

const initial = [{ id: 'a', label: 'Item A' }, { id: 'b', label: 'Item B' }, { id: 'c', label: 'Item C' }];

function List({ useIndexKey }: { useIndexKey: boolean }) {
  const [items, setItems] = useState(initial);
  return (
    <div style={{ fontFamily: 'system-ui', marginBottom: 12 }}>
      <b>{useIndexKey ? 'key = index (buggy)' : 'key = id (correct)'}</b>{' '}
      <button onClick={() => setItems(items.slice(1))}>Remove first</button>
      {items.map((it, i) => (
        <div key={useIndexKey ? i : it.id}>
          {it.label}: <input placeholder="type here" />
        </div>
      ))}
    </div>
  );
}

export default function App() {
  return (<><List useIndexKey /><List useIndexKey={false} /></>);
}
```

## Accessibility is part of the contract

The exercise tests find things the way a user does — by **role and accessible name** (`getByRole('button', { name: 'Save' })`), not by CSS class. If a test can't find your element that way, a screen reader can't either. Use real `<button>`, `<ul>`, `<label>`, headings — not clickable `<div>`s.

## Common mistakes

1. **`{count && <X />}`** when `count` can be `0`. Use `count > 0 &&`.
2. **Index as key** in a list that changes.
3. **Changing props** (`props.items.push(...)`) instead of making a new value.
4. **Doing work in render** (fetching, timers, random numbers) — it runs whenever React decides to render.
5. **Forgetting `key` on the outermost element returned from `.map`** (the `key` belongs on the element directly inside `map`, not on something nested inside it).
6. **Clickable divs** instead of buttons — no keyboard or screen-reader support.

## Quick check

```check
Q: What does a JSX expression like `<h1>Hi</h1>` produce?
A) A real DOM node
B) A plain JavaScript object (a React element) that describes the UI *
C) A string of HTML
D) A promise
Why: JSX compiles to function calls that return lightweight objects. React later turns them into real DOM.
---
Q: `const count = 0;` — what does `{count && <Badge />}` render?
A) Nothing
B) The text `false`
C) An empty `<Badge />`
D) The number `0` *
Why: `0 && x` evaluates to `0`, and React renders numbers. Use `count > 0 && <Badge />`.
---
Q: Why are array indexes bad keys in a list that can be reordered?
A) React state and DOM stay attached to the *position*, so they end up on the wrong item *
B) Indexes are not unique
C) Indexes are slower to compare
D) React refuses to render them
Why: With index keys, deleting the first item makes every other item "move up" an index, so React reuses the wrong nodes (and their state).
---
Q: Where should a network request be started?
A) In the body of the component function
B) In an event handler or an effect, not during render *
C) Inside the JSX
D) In the `key` prop
Why: Rendering must be pure; it can run many times. Side effects belong in event handlers and effects.
---
Q: What happens when you change a component's `key`?
A) Nothing; it's only a hint
B) React warns but keeps the state
C) React throws away the old instance and mounts a fresh one, resetting its state *
D) Only the props are reset
Why: A different key means "a different thing" to React, so the old instance is unmounted and a new one is created.
```

## Recap

- A **component** is a function **props → elements**; elements are plain objects describing the UI.
- Keep render **pure**; side effects go in handlers and effects. Props are **read-only**.
- `null/undefined/true/false` render nothing; **`0` renders `0`** — use `count > 0 &&`.
- **`children`** and other props (even elements and functions) make **composition** easy.
- **Keys** give list items an identity: use stable ids, never the index for changing lists. Changing a `key` resets state.
- Use real semantic elements so role-based queries (and screen readers) work.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: badge | Props, `&&` and the `0` gotcha |
| Greeting | Props with a default, and putting an expression in `{ }` |
| User list | `.map` with `key`, conditional rendering, an empty state |
| Card with slots | `children`, an optional element prop, `aria-labelledby`, forwarding extra props |
| Generic data table | `.map` for rows and columns, keys, and a prop that is either a key or a function |

%% exercise react-guided-badge | Guided: badge | 1 | tsx | react | Badge | 6 | guided
Build `<Badge label count? />`.

- It renders a `<span role="status">` whose text is the `label`.
- When `count` is **greater than 0**, the count is shown after the label: `Inbox 3`.
- When `count` is `0` or missing, **only the label** is shown (no stray `0`!).

%% worked
**A similar problem, solved: `<Tag text important? />`** — a label with an optional flag.

```tsx
export function Tag({ text, important }: { text: string; important?: boolean }) {
  //                   ① props arrive as ONE object; we pull out the ones we need (destructuring)
  return (
    <span role="note">
      {text}                                   {/* ② any expression goes inside { } */}
      {important && <strong> !</strong>}       {/* ③ && renders the right side only when the left is true */}
    </span>
  );
}
```

`important && <strong>…</strong>` is safe because `important` is a boolean (or `undefined`): `false` and `undefined` render nothing. With a **number** on the left, `0` would show up — so compare first: `count > 0 && …`.

%% explain
- **`label` is always shown**, inside an element with `role="status"`.
- **`count > 0`** appends the number (`Inbox 3`).
- **`count` of `0`** shows no `0` — the classic gotcha the test looks for.
- **`count` missing** behaves like no count.

%% nudge
- What does `{0 && <b>x</b>}` render? How can you make the left side a real boolean?
- Do you need state for this? (Nothing changes over time here.)

%% starter
```tsx
export function Badge({ label, count }: { label: string; count?: number }) {
  // Step 1 — return a <span role="status"> that contains the label.
  // Step 2 — after the label, show the count ONLY when count is bigger than 0:
  //          {count !== undefined && count > 0 && <b> {count}</b>}
  return null;
}
```

%% tests
```tsx
describe('Badge', () => {
  it('shows the label', () => {
    render(<Badge label="Inbox" />);
    expect(screen.getByRole('status')).toHaveTextContent('Inbox');
  });

  it('shows the count when it is positive', () => {
    render(<Badge label="Inbox" count={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('Inbox 3');
  });

  it('does not render a stray 0', () => {
    render(<Badge label="Inbox" count={0} />);
    const text = screen.getByRole('status').textContent ?? '';
    expect(text.trim()).toBe('Inbox');
  });

  it('works without a count', () => {
    render(<Badge label="Drafts" />);
    expect(screen.getByRole('status').textContent?.trim()).toBe('Drafts');
  });
});
```

%% hints
- `<span role="status">{label}{…}</span>`
- `count !== undefined && count > 0 && <b> {count}</b>`

%% solution
```tsx
export function Badge({ label, count }: { label: string; count?: number }) {
  return (
    <span role="status">
      {label}
      {count !== undefined && count > 0 && <b> {count}</b>}
    </span>
  );
}
```

%% exercise react-greeting | Greeting | 1 | tsx | react | Greeting | 5
Build `<Greeting name? />`.

- Renders an `<h1>` with the text `Hello, {name}!`.
- When `name` is omitted, it says `Hello, stranger!`.

%% starter
```tsx
export function Greeting({ name }: { name?: string }) {
  return null;
}
```

%% tests
```tsx
describe('Greeting', () => {
  it('greets by name', () => {
    render(<Greeting name="Ada" />);
    expect(screen.getByRole('heading', { name: 'Hello, Ada!' })).toBeInTheDocument();
  });

  it('falls back to "stranger"', () => {
    render(<Greeting />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, stranger!');
  });

  it('updates when props change', () => {
    const { rerender } = render(<Greeting name="Ada" />);
    rerender(<Greeting name="Grace" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello, Grace!');
  });

  it('treats an empty string as a real (empty) name, not as missing', () => {
    render(<Greeting name="" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello, !');
  });
});
```

%% worked
**A similar problem, solved: `<Price amount currency? />`** — one prop with a default, rendered inside text.

```tsx
export function Price({ amount, currency = 'USD' }: { amount: number; currency?: string }) {
  //                                ① a default value, used when the prop is missing (undefined)
  return <p>Total: {amount} {currency}</p>;
  //                ② { } drops values into the text
}

// <Price amount={5} />              → "Total: 5 USD"
// <Price amount={5} currency="EUR" /> → "Total: 5 EUR"
```

For `Greeting`: the default goes on `name` (`'stranger'`) and the text is `Hello, {name}!`. Watch the exact characters — the test compares text, so a missing comma or `!` fails.

%% explain
- **An `<h1>`** with the text `Hello, <name>!`.
- **No `name`** → `Hello, stranger!`.

%% nudge
- Where can you put a default value for a prop?
- Is the heading's text one string or several pieces? (The test joins them.)

%% hints
- Default parameters only kick in for `undefined`: `{ name = 'stranger' }`.
- Template literal inside JSX: `{`Hello, ${name}!`}`, or `Hello, {name}!`.

%% solution
```tsx
export function Greeting({ name = 'stranger' }: { name?: string }) {
  return <h1>Hello, {name}!</h1>;
}
```

%% exercise react-user-list | User list | 1 | tsx | react | UserList | 8
Build `<UserList users />`.

- Renders a `<ul>` with one `<li>` per user, showing the user's `name`.
- If a user has `isAdmin: true`, append the text ` (admin)` after the name.
- With no users, render a `<p>` saying `No users yet.` **instead of** an empty list.
- Use proper `key`s — React must not log any warnings.

%% starter
```tsx
interface User {
  id: number;
  name: string;
  isAdmin?: boolean;
}

export function UserList({ users }: { users: User[] }) {
  return null;
}
```

%% tests
```tsx
const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Linus', isAdmin: true },
  { id: 3, name: 'Grace' },
];

describe('UserList', () => {
  it('renders one list item per user', () => {
    render(<UserList users={users} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('marks admins', () => {
    render(<UserList users={users} />);
    const items = screen.getAllByRole('listitem');
    expect(items[1]).toHaveTextContent('Linus (admin)');
    expect(items[0]).not.toHaveTextContent('admin');
  });

  it('shows an empty state instead of an empty list', () => {
    render(<UserList users={[]} />);
    expect(screen.getByText('No users yet.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('does not trigger React key warnings', () => {
    const spy = jest.spyOn(console, 'error');
    render(<UserList users={users} />);
    const keyWarnings = spy.mock.calls.filter((c) => String(c[0]).includes('key'));
    expect(keyWarnings).toHaveLength(0);
  });

  it('keeps DOM nodes when the list is reordered (keys track identity)', () => {
    const { rerender } = render(<UserList users={users} />);
    const adaNode = screen.getByText('Ada').closest('li');
    rerender(<UserList users={[users[2], users[1], users[0]]} />);
    expect(screen.getByText('Ada').closest('li')).toBe(adaNode);
  });
});
```

%% worked
**A similar problem, solved: `<TodoList items />`** — a list with an empty state and an optional suffix.

```tsx
interface Item { id: number; text: string; done?: boolean }

export function TodoList({ items }: { items: Item[] }) {
  if (items.length === 0) return <p>Nothing to do.</p>;      // ① early return for the empty state
  return (
    <ul>
      {items.map((it) => (
        <li key={it.id}>                                     {/* ② key: a stable id from the data, not the index */}
          {it.text}
          {it.done && ' (done)'}                             {/* ③ && is fine: `done` is boolean/undefined */}
        </li>
      ))}
    </ul>
  );
}
```

The test also checks that React logged **no warnings**, which is how it catches a missing or duplicated `key`.

%% explain
- **A `<ul>` with one `<li>` per user** showing the name.
- **Admins** get ` (admin)` after the name.
- **No users** → a `<p>` saying `No users yet.` *instead of* an empty list.
- **Proper keys**: React must not log warnings.

%% nudge
- What should you use as the `key` — the name or something that can never repeat?
- Can you return early for the empty case, before building the list?

%% hints
- `users.length === 0 ? <p>…</p> : <ul>…</ul>` — or an early `return`.
- Use `user.id` as the key. `index` would fail the last test: try it and see why.
- `{user.name}{user.isAdmin && ' (admin)'}` — `false` renders nothing.

%% solution
```tsx
interface User {
  id: number;
  name: string;
  isAdmin?: boolean;
}

export function UserList({ users }: { users: User[] }) {
  if (users.length === 0) return <p>No users yet.</p>;
  return (
    <ul>
      {users.map((u) => (
        <li key={u.id}>
          {u.name}
          {u.isAdmin && ' (admin)'}
        </li>
      ))}
    </ul>
  );
}
```

%% exercise react-card-slots | Card with slots | 2 | tsx | react | Card | 10
Build `<Card title footer? children />`, a composition primitive.

- A `<section>` labelled by its title: the title is an `<h2>` and the section's accessible name is that title (`aria-labelledby`).
- `children` render in the body.
- The `footer` prop is optional. When present, it's rendered inside a `<footer>`; when absent, **no** `<footer>` element exists.
- `footer` may be any React node, not just a string.
- Extra props (`className`, `data-*`, …) should be forwarded onto the `<section>`.

%% starter
```tsx
import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Card({ title, footer, children, ...rest }: CardProps) {
  return null;
}
```

%% tests
```tsx
describe('Card', () => {
  it('is a region named by its title', () => {
    render(<Card title="Billing">body</Card>);
    expect(screen.getByRole('region', { name: 'Billing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Billing' })).toBeInTheDocument();
  });

  it('renders children in the body', () => {
    render(<Card title="T"><p>hello</p><button>go</button></Card>);
    expect(screen.getByText('hello')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'go' })).toBeInTheDocument();
  });

  it('omits the footer element when there is no footer prop', () => {
    render(<Card title="T">x</Card>);
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(document.querySelector('footer')).toBeNull();
  });

  it('renders footer content, including elements', () => {
    render(<Card title="T" footer={<a href="/more">More</a>}>x</Card>);
    const footer = document.querySelector('footer')!;
    expect(footer).toContainElement(screen.getByRole('link', { name: 'More' }));
  });

  it('forwards extra props to the section', () => {
    render(<Card title="T" className="big" data-testid="card">x</Card>);
    expect(screen.getByTestId('card')).toHaveClass('big');
    expect(screen.getByTestId('card').tagName).toBe('SECTION');
  });

  it('gives each card its own heading id', () => {
    render(<><Card title="One">a</Card><Card title="Two">b</Card></>);
    expect(screen.getByRole('region', { name: 'One' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Two' })).toBeInTheDocument();
  });
});
```

%% worked
**A similar problem, solved: `<Panel heading actions? children />`** — a labelled region with an optional slot.

```tsx
import { useId, type ReactNode, type HTMLAttributes } from 'react';

interface PanelProps extends HTMLAttributes<HTMLElement> {
  heading: string;
  actions?: ReactNode;                   // ① any React node: string, element, fragment…
}

export function Panel({ heading, actions, children, ...rest }: PanelProps) {
  const id = useId();                    // ② a unique id for the aria link (works even with many panels)
  return (
    <section aria-labelledby={id} {...rest}>          {/* ③ `...rest` forwards className, data-*, … */}
      <h2 id={id}>{heading}</h2>                      {/* ④ the heading gives the section its accessible NAME */}
      {children}
      {actions && <div>{actions}</div>}               {/* ⑤ absent prop → no element at all */}
    </section>
  );
}
```

`aria-labelledby` means "my accessible name is the text of *that* element" — so tests can find the region with `getByRole('region', { name: 'Order #12' })`.

%% explain
- **A `<section>` named by its `<h2>`** title (`aria-labelledby`).
- **`children`** render in the body.
- **`footer` is optional**: present → inside a `<footer>`; absent → **no** `<footer>` element.
- **`footer` can be any node**, not only a string.
- **Extra props** (`className`, `data-*`) are forwarded onto the `<section>`.

%% nudge
- How can the heading and the section be linked so the section has an accessible name?
- How do you pass "all the other props" along without listing them?

%% hints
- `useId()` from React gives an id that's unique per component instance and stable across renders.
- `<section aria-labelledby={id} {...rest}>` and `<h2 id={id}>`.
- `{footer && <footer>{footer}</footer>}` — but what if `footer` is `0`? Fine for this exercise; think about it after.

%% solution
```tsx
import { useId } from 'react';
import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: string;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Card({ title, footer, children, ...rest }: CardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} {...rest}>
      <h2 id={id}>{title}</h2>
      {children}
      {footer != null && footer !== false && <footer>{footer}</footer>}
    </section>
  );
}
```

%% exercise react-data-table | Generic data table | 3 | tsx | react | DataTable | 20
Build `<DataTable columns rows getRowKey />`, a typed, generic table.

```tsx
interface Column<T> {
  header: string;
  /** Property to read, or a custom cell renderer. */
  accessor: keyof T | ((row: T) => ReactNode);
}
```

- Render a real `<table>` with a `<thead>` of `<th>` headers and one `<tr>` per row in `<tbody>`.
- A column's cell shows `row[accessor]` when `accessor` is a key, or the return value of the function.
- `getRowKey(row)` supplies each row's `key`.
- With zero rows, render one full-width cell (`colSpan` = number of columns) reading `Nothing to show`.
- Missing values (`null`/`undefined`) render an empty cell, but `0` and `false`-y numbers must still show `0`.

%% starter
```tsx
import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
}

export function DataTable<T>({ columns, rows, getRowKey }: DataTableProps<T>) {
  return null;
}
```

%% tests
```tsx
const rows = [
  { id: 1, name: 'Ada', score: 98, tags: ['math'] },
  { id: 2, name: 'Linus', score: 0, tags: [] },
  { id: 3, name: 'Grace', score: 87, tags: ['navy', 'cobol'] },
];
const columns: Column<(typeof rows)[number]>[] = [
  { header: 'Name', accessor: 'name' },
  { header: 'Score', accessor: 'score' },
  { header: 'Tags', accessor: (r) => r.tags.join(', ') },
];

describe('DataTable', () => {
  it('renders a header cell per column', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(['Name', 'Score', 'Tags']);
  });

  it('renders a row per item (plus the header row)', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });

  it('reads keyed accessors and function accessors', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    expect(screen.getByText('Grace')).toBeInTheDocument();
    expect(screen.getByText('navy, cobol')).toBeInTheDocument();
  });

  it('shows 0 as "0" rather than hiding it', () => {
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const linus = screen.getByText('Linus').closest('tr')!;
    expect(linus).toHaveTextContent('Linus0');
  });

  it('renders null / undefined as an empty cell', () => {
    const cols: Column<{ id: number; v: string | null }>[] = [{ header: 'V', accessor: 'v' }];
    render(<DataTable columns={cols} rows={[{ id: 1, v: null }]} getRowKey={(r) => r.id} />);
    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(1);
    expect(cells[0]).toBeEmptyDOMElement();
  });

  it('spans the empty state across all columns', () => {
    render(<DataTable columns={columns} rows={[]} getRowKey={(r: any) => r.id} />);
    const cell = screen.getByText('Nothing to show');
    expect(cell.tagName).toBe('TD');
    expect(cell).toHaveAttribute('colspan', '3');
  });

  it('uses getRowKey so React keeps row identity across reorders', () => {
    const { rerender } = render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const before = screen.getByText('Ada').closest('tr');
    rerender(<DataTable columns={columns} rows={[...rows].reverse()} getRowKey={(r) => r.id} />);
    expect(screen.getByText('Ada').closest('tr')).toBe(before);
  });

  it('does not log React warnings', () => {
    const spy = jest.spyOn(console, 'error');
    render(<DataTable columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: `<KeyValueList rows />`** — rows of `{ label, value }`, where `value` may be `0`.

```tsx
interface Row { id: string; label: string; value?: number | null }

export function KeyValueList({ rows }: { rows: Row[] }) {
  return (
    <table>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={2}>Nothing to show</td></tr>        // ① one cell spanning all columns
        )}
        {rows.map((r) => (
          <tr key={r.id}>
            <th scope="row">{r.label}</th>
            <td>{r.value ?? ''}</td>                          {/* ② `??` keeps 0 but turns null/undefined into '' */}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

For the generic table: `accessor` is either a key of `T` or a function. Decide **once per cell**: `typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]`. Because `T` is a *type parameter*, write the component as `function DataTable<T>(props: DataTableProps<T>)` so the rows and columns agree with each other.

%% explain
- **A real `<table>`**: `<thead>` with `<th>` headers, one `<tr>` per row in `<tbody>`.
- **Cell content**: `row[accessor]` for a key, or the function's return value.
- **`getRowKey(row)`** supplies each row's key.
- **No rows** → one cell with `colSpan` = number of columns reading `Nothing to show`.
- **`null`/`undefined`** render empty, but **`0` still shows `0`**.

%% nudge
- Which operator turns `null` into an empty cell without touching `0`: `||` or `??`?
- How do you decide, for each column, whether `accessor` is a key or a function?

%% hints
- `typeof col.accessor === 'function' ? col.accessor(row) : (row[col.accessor] as ReactNode)`.
- React already renders `null`/`undefined` as nothing and `0` as `0` — don't "helpfully" use `||`.
- Header cells need a key too: `key={col.header}` is fine here.
- Wrap the empty state in a `<tr><td colSpan={columns.length}>…</td></tr>`.

%% solution
```tsx
import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
}

export function DataTable<T>({ columns, rows, getRowKey }: DataTableProps<T>) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.header}>{c.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length}>Nothing to show</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((c) => (
                <td key={c.header}>
                  {typeof c.accessor === 'function' ? c.accessor(row) : (row[c.accessor] as ReactNode)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
```
