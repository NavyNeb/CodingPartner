---
id: react-rendering
track: react
title: Components, props & rendering lists
summary: What JSX really is, how React decides what to update, and why keys are about identity — not performance.
---

## JSX is just function calls

```tsx
const el = <h1 className="title">Hello, {name}</h1>;
// compiles to (roughly):
const el2 = jsx('h1', { className: 'title', children: ['Hello, ', name] });
```

That call returns a plain object — a **React element** — describing what you want on screen: `{ type: 'h1', props: {...} }`. It's not a DOM node and it's cheap to create. React later compares the element tree from this render against the previous one and applies the *difference* to the real DOM.

Consequences you should be able to recite:

- Components are functions from **props → element tree**. Same props, same output (keep them pure — no mutation, no I/O during render).
- **Props are read-only.** If you write to `props.x`, you're fighting the model.
- Any expression works inside `{ }`, but statements (`if`, `for`) don't. Use ternaries, `&&`, or compute values before the `return`.
- `undefined`, `null`, `true` and `false` render *nothing*. `0` renders **`0`** — so `{count && <Badge />}` shows a stray zero when `count` is `0`. Write `count > 0 && …`.

## Render vs. commit

Calling your component function is the **render** phase: pure, may run more than once, may be thrown away. Only after React has diffed does it **commit** to the DOM. Effects (`useEffect`) run after commit. Don't put side effects in the render body.

## Children and composition

`children` is just another prop. Prefer composition ("slots") over configuration:

```tsx
function Card({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
      {footer && <footer>{footer}</footer>}
    </section>
  );
}
```

A prop can be any value — including elements and functions. "Render props", "slots", and even hooks all fall out of that.

## Lists and keys

```tsx
<ul>
  {users.map((u) => (
    <li key={u.id}>{u.name}</li>
  ))}
</ul>
```

`key` is how React answers **"is this the same item as last render?"** Same key + same type → keep the DOM node and its state, just update props. New key → mount a new one. Missing from the new list → unmount.

- Use a **stable, unique id from your data**.
- **Array index is a bug** the moment the list can be reordered, filtered or inserted into: item state (an input's text, a checkbox, a focus ring) sticks to the *position*, not the item.
- Keys only need to be unique among *siblings*.
- A `key` on any element also works as a reset button: changing it remounts the subtree and wipes its state.

## Accessibility is part of the contract

We test these components the way a user finds things: by **role and accessible name** (`getByRole('button', { name: 'Save' })`), not by CSS class. If a test can't find your element that way, a screen reader can't either. Use real `<button>`, `<ul>`, `<label>`.

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
