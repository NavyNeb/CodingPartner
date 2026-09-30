---
id: react-state
track: react
title: State, events & forms
summary: State as a snapshot, updater functions, controlled inputs, lifting state up — and building real widgets.
---

## State is a snapshot

`useState` gives you the value **for this render**. Calling the setter doesn't change the variable you're holding; it schedules a re-render, and the *next* call to your component sees the new value.

```tsx
function Counter() {
  const [n, setN] = useState(0);
  function addThree() {
    setN(n + 1);
    setN(n + 1);
    setN(n + 1);   // n is 0 in ALL three → result is 1, not 3
  }
}
```

Fix: pass an **updater function**, which receives the latest queued state:

```tsx
setN((prev) => prev + 1); // ×3 → 3
```

Use the updater form whenever the new state depends on the old one — it also fixes stale-closure bugs inside timeouts and effects.

## Batching

React batches all updates in an event handler (and, since 18, in promises/timeouts too) into **one render**. Reading state right after `setX` still gives the old value — the update hasn't been applied yet.

## Never mutate state

React compares by identity (`Object.is`). Mutating an array/object and re-setting the same reference means "nothing changed": no re-render, or worse, a half-updated UI.

```tsx
setTodos([...todos, newTodo]);                       // add
setTodos(todos.filter((t) => t.id !== id));          // remove
setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t))); // update
```

## What should be state?

Put it in state only if it **changes over time** *and* **can't be computed** from other state/props. Derive the rest during render:

```tsx
const [todos, setTodos] = useState<Todo[]>([]);
const remaining = todos.filter((t) => !t.done).length; // ✅ derived — no second state to keep in sync
```

Duplicated/derived state is the source of most "why is my UI out of sync" bugs.

## Controlled inputs

A **controlled** input's value lives in React state and flows back through `onChange`:

```tsx
const [text, setText] = useState('');
<input value={text} onChange={(e) => setText(e.target.value)} />
```

Single source of truth ⇒ you can validate, transform, disable buttons, and reset it (`setText('')`) from anywhere. An **uncontrolled** input keeps its value in the DOM (read it via a ref or `FormData`) — fine for simple forms, awkward for live validation.

Forms: handle `onSubmit` on the `<form>` (not `onClick` on the button) so Enter works, and call `e.preventDefault()`.

## Events

Handlers are functions you pass, not call: `onClick={handle}` ✅, `onClick={handle()}` ❌ (runs during render). React's synthetic events bubble like DOM events; `stopPropagation`/`preventDefault` work as you'd expect. To pass arguments, wrap: `onClick={() => remove(id)}`.

## Lifting state up

When two components need the same data, move the state to their **closest common parent** and pass value + setter down. If that gets tedious across many levels, reach for context/reducers (later lesson) — not for duplicated state.

## Resetting state with `key`

State belongs to a component *at a position in the tree*. Change its `key` and React treats it as a new component — state resets. `<Profile key={userId} />` is the idiomatic "reset this form when the user changes."

## Testing what users do

In these exercises tests interact like a user: `userEvent.click`, `userEvent.type`, `fireEvent.submit`; and query by **role/label/text**, not by implementation details. Reading the tests tells you exactly which accessible names your UI must expose.

%% exercise react-counter | Counter (and the batching trap) | 1 | tsx | react | Counter | 8
Build `<Counter initial? step? />`.

- Shows `Count: <n>` (starts at `initial`, default 0).
- **Increment** adds `step` (default 1); **Decrement** subtracts `step`.
- **Add 3** adds `3` — implemented by calling the setter three times in one handler. It must really add 3.
- **Reset** returns to `initial`.

%% starter
```tsx
import { useState } from 'react';

interface CounterProps {
  initial?: number;
  step?: number;
}

export function Counter({ initial = 0, step = 1 }: CounterProps) {
  return null;
}
```

%% tests
```tsx
describe('Counter', () => {
  it('starts at the initial value', () => {
    render(<Counter initial={5} />);
    expect(screen.getByText('Count: 5')).toBeInTheDocument();
  });

  it('increments and decrements', async () => {
    render(<Counter />);
    await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrement' }));
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });

  it('honours step', async () => {
    render(<Counter step={5} />);
    await userEvent.click(screen.getByRole('button', { name: 'Increment' }));
    expect(screen.getByText('Count: 5')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Decrement' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrement' }));
    expect(screen.getByText('Count: -5')).toBeInTheDocument();
  });

  it('"Add 3" really adds three (updater functions!)', async () => {
    render(<Counter />);
    await userEvent.click(screen.getByRole('button', { name: 'Add 3' }));
    expect(screen.getByText('Count: 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add 3' }));
    expect(screen.getByText('Count: 6')).toBeInTheDocument();
  });

  it('resets to the initial value', async () => {
    render(<Counter initial={10} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add 3' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Count: 10')).toBeInTheDocument();
  });

  it('keeps separate instances independent', async () => {
    render(<><Counter /><Counter initial={100} /></>);
    await userEvent.click(screen.getAllByRole('button', { name: 'Increment' })[0]);
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
    expect(screen.getByText('Count: 100')).toBeInTheDocument();
  });
});
```

%% hints
- `const [count, setCount] = useState(initial);`
- "Add 3": `setCount((c) => c + 1)` three times — or once with `c + 3`, but the point is to feel why `setCount(count + 1)` ×3 gives 1.
- Reset uses `initial`, not `0`.

%% solution
```tsx
import { useState } from 'react';

interface CounterProps {
  initial?: number;
  step?: number;
}

export function Counter({ initial = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initial);
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + step)}>Increment</button>
      <button onClick={() => setCount((c) => c - step)}>Decrement</button>
      <button
        onClick={() => {
          setCount((c) => c + 1);
          setCount((c) => c + 1);
          setCount((c) => c + 1);
        }}
      >
        Add 3
      </button>
      <button onClick={() => setCount(initial)}>Reset</button>
    </div>
  );
}
```

%% exercise react-accordion | Accordion | 2 | tsx | react | Accordion | 15
Build an accessible `<Accordion sections multiple? defaultOpen? />`.

```tsx
interface Section { id: string; title: string; content: ReactNode }
```

- Each section: an `<h3>` containing a `<button>` (the title) with `aria-expanded` and `aria-controls` pointing at its panel.
- The panel has `role="region"`, `aria-labelledby` the button, and the `hidden` attribute while closed (it stays in the DOM).
- Clicking a title toggles its section.
- By default **only one** section is open at a time (opening one closes the others). With `multiple`, sections toggle independently.
- `defaultOpen` lists the ids open on first render (only the first is honoured when not `multiple`).

%% starter
```tsx
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

export interface Section {
  id: string;
  title: string;
  content: ReactNode;
}

interface AccordionProps {
  sections: Section[];
  multiple?: boolean;
  defaultOpen?: string[];
}

export function Accordion({ sections, multiple = false, defaultOpen = [] }: AccordionProps) {
  return null;
}
```

%% tests
```tsx
const sections = [
  { id: 'a', title: 'Shipping', content: <p>Ships in 2 days</p> },
  { id: 'b', title: 'Returns', content: <p>30-day returns</p> },
  { id: 'c', title: 'Warranty', content: <p>1 year</p> },
];
const btn = (name: string) => screen.getByRole('button', { name });
const panel = (name: string) => screen.getByRole('region', { name, hidden: true });

describe('Accordion', () => {
  it('renders a button per section, all closed by default', () => {
    render(<Accordion sections={sections} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    for (const s of sections) {
      expect(btn(s.title)).toHaveAttribute('aria-expanded', 'false');
      expect(panel(s.title)).not.toBeVisible();
    }
  });

  it('wraps titles in headings', () => {
    render(<Accordion sections={sections} />);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });

  it('opens a section on click', async () => {
    render(<Accordion sections={sections} />);
    await userEvent.click(btn('Returns'));
    expect(btn('Returns')).toHaveAttribute('aria-expanded', 'true');
    expect(panel('Returns')).toBeVisible();
    expect(screen.getByText('30-day returns')).toBeVisible();
  });

  it('closes when clicked again', async () => {
    render(<Accordion sections={sections} />);
    await userEvent.click(btn('Returns'));
    await userEvent.click(btn('Returns'));
    expect(panel('Returns')).not.toBeVisible();
  });

  it('single mode: opening one closes the others', async () => {
    render(<Accordion sections={sections} />);
    await userEvent.click(btn('Shipping'));
    await userEvent.click(btn('Warranty'));
    expect(btn('Shipping')).toHaveAttribute('aria-expanded', 'false');
    expect(btn('Warranty')).toHaveAttribute('aria-expanded', 'true');
  });

  it('multiple mode: sections toggle independently', async () => {
    render(<Accordion sections={sections} multiple />);
    await userEvent.click(btn('Shipping'));
    await userEvent.click(btn('Warranty'));
    expect(btn('Shipping')).toHaveAttribute('aria-expanded', 'true');
    expect(btn('Warranty')).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(btn('Shipping'));
    expect(btn('Shipping')).toHaveAttribute('aria-expanded', 'false');
    expect(btn('Warranty')).toHaveAttribute('aria-expanded', 'true');
  });

  it('honours defaultOpen', () => {
    render(<Accordion sections={sections} defaultOpen={['b']} />);
    expect(btn('Returns')).toHaveAttribute('aria-expanded', 'true');
    expect(panel('Returns')).toBeVisible();
  });

  it('defaultOpen honours only the first id in single mode', () => {
    render(<Accordion sections={sections} defaultOpen={['a', 'b']} />);
    expect(btn('Shipping')).toHaveAttribute('aria-expanded', 'true');
    expect(btn('Returns')).toHaveAttribute('aria-expanded', 'false');
  });

  it('defaultOpen can open several in multiple mode', () => {
    render(<Accordion sections={sections} multiple defaultOpen={['a', 'b']} />);
    expect(btn('Shipping')).toHaveAttribute('aria-expanded', 'true');
    expect(btn('Returns')).toHaveAttribute('aria-expanded', 'true');
  });

  it('connects each button to its panel with aria-controls', () => {
    render(<Accordion sections={sections} />);
    const b = btn('Shipping');
    const id = b.getAttribute('aria-controls')!;
    expect(id).toBeTruthy();
    expect(panel('Shipping').id).toBe(id);
  });

  it('keeps ids unique across two accordions', () => {
    render(<><Accordion sections={sections} /><Accordion sections={sections} /></>);
    const ids = screen.getAllByRole('button').map((b) => b.getAttribute('aria-controls'));
    expect(new Set(ids).size).toBe(6);
  });
});
```

%% hints
- State: the list of open ids: `useState<string[]>(...)`.
- Toggle: `cur.includes(id) ? cur.filter((x) => x !== id) : multiple ? [...cur, id] : [id]`.
- Ids: `const uid = useId();` then `${uid}-btn-${s.id}` / `${uid}-panel-${s.id}` — unique per accordion instance.
- The `hidden` attribute is a boolean prop: `hidden={!isOpen}`.

%% solution
```tsx
import { useId, useState } from 'react';
import type { ReactNode } from 'react';

export interface Section {
  id: string;
  title: string;
  content: ReactNode;
}

interface AccordionProps {
  sections: Section[];
  multiple?: boolean;
  defaultOpen?: string[];
}

export function Accordion({ sections, multiple = false, defaultOpen = [] }: AccordionProps) {
  const uid = useId();
  const [open, setOpen] = useState<string[]>(multiple ? defaultOpen : defaultOpen.slice(0, 1));

  const toggle = (id: string) =>
    setOpen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : multiple ? [...cur, id] : [id]));

  return (
    <div>
      {sections.map((s) => {
        const isOpen = open.includes(s.id);
        const buttonId = `${uid}-btn-${s.id}`;
        const panelId = `${uid}-panel-${s.id}`;
        return (
          <div key={s.id}>
            <h3>
              <button id={buttonId} aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(s.id)}>
                {s.title}
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
              {s.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

%% exercise react-star-rating | Star rating | 2 | tsx | react | StarRating | 20
Build `<StarRating max? defaultValue? onChange? readOnly? />`.

- A `role="radiogroup"` labelled `Rating`, containing `max` (default 5) `<button role="radio">` elements labelled `"1 star"`, `"2 stars"`, … with `aria-checked` on the selected one.
- Every star has `data-filled="true"` when it's at or below the **displayed** value, otherwise `"false"`.
- **Click** star *n* → value becomes *n* and `onChange(n)` fires. Clicking the *currently selected* star clears the rating (`0`).
- **Hover** previews: while the pointer is over star *n*, stars up to *n* are filled; leaving the group restores the real value.
- **Keyboard** (on the group): `ArrowRight`/`ArrowUp` +1 (max `max`), `ArrowLeft`/`ArrowDown` −1 (min `0`), each firing `onChange`.
- `readOnly`: no clicks, hover or keyboard changes.

%% starter
```tsx
import { useState } from 'react';

interface StarRatingProps {
  max?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}

export function StarRating({ max = 5, defaultValue = 0, onChange, readOnly = false }: StarRatingProps) {
  return null;
}
```

%% tests
```tsx
const star = (n: number) => screen.getByRole('radio', { name: n === 1 ? '1 star' : `${n} stars` });
const filled = () => screen.getAllByRole('radio').map((s) => s.getAttribute('data-filled') === 'true');

describe('StarRating', () => {
  it('renders a labelled radiogroup with max stars', () => {
    render(<StarRating />);
    expect(screen.getByRole('radiogroup', { name: 'Rating' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    render(<StarRating max={3} />);
    expect(screen.getAllByRole('radiogroup')).toHaveLength(2);
  });

  it('starts from defaultValue', () => {
    render(<StarRating defaultValue={3} />);
    expect(filled()).toEqual([true, true, true, false, false]);
    expect(star(3)).toHaveAttribute('aria-checked', 'true');
    expect(star(2)).toHaveAttribute('aria-checked', 'false');
  });

  it('sets the rating on click and reports it', async () => {
    const onChange = jest.fn();
    render(<StarRating onChange={onChange} />);
    await userEvent.click(star(4));
    expect(filled()).toEqual([true, true, true, true, false]);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('clears when the selected star is clicked again', async () => {
    const onChange = jest.fn();
    render(<StarRating defaultValue={2} onChange={onChange} />);
    await userEvent.click(star(2));
    expect(filled().some(Boolean)).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('previews on hover and restores on leave', async () => {
    render(<StarRating defaultValue={1} />);
    await userEvent.hover(star(4));
    expect(filled()).toEqual([true, true, true, true, false]);
    await userEvent.unhover(star(4));
    expect(filled()).toEqual([true, false, false, false, false]);
  });

  it('supports arrow keys', () => {
    const onChange = jest.fn();
    render(<StarRating defaultValue={2} onChange={onChange} />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(filled().filter(Boolean)).toHaveLength(3);
    fireEvent.keyDown(group, { key: 'ArrowUp' });
    expect(filled().filter(Boolean)).toHaveLength(4);
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowDown' });
    expect(filled().filter(Boolean)).toHaveLength(2);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([3, 4, 3, 2]);
  });

  it('keeps the value within 0..max on the keyboard', () => {
    const onChange = jest.fn();
    render(<StarRating max={3} defaultValue={3} onChange={onChange} />);
    const group = screen.getByRole('radiogroup');
    fireEvent.keyDown(group, { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    fireEvent.keyDown(group, { key: 'ArrowLeft' });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([2, 1, 0]);
  });

  it('ignores other keys', () => {
    const onChange = jest.fn();
    render(<StarRating defaultValue={2} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is inert when readOnly', async () => {
    const onChange = jest.fn();
    render(<StarRating defaultValue={2} readOnly onChange={onChange} />);
    await userEvent.click(star(5));
    await userEvent.hover(star(5));
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
    expect(filled()).toEqual([true, true, false, false, false]);
  });
});
```

%% hints
- Two pieces of state: `value` and `hover`. What you display is `hover || value`.
- Radio group semantics: `role="radiogroup"` on the container, `role="radio"` + `aria-checked` on each button.
- `data-filled={n <= shown}` — React renders booleans on `data-*` attributes as `"true"`/`"false"`.
- Clear the hover on the **group's** `onMouseLeave`, set it on each star's `onMouseEnter`.

%% solution
```tsx
import { useState } from 'react';
import type { KeyboardEvent } from 'react';

interface StarRatingProps {
  max?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}

export function StarRating({ max = 5, defaultValue = 0, onChange, readOnly = false }: StarRatingProps) {
  const [value, setValue] = useState(defaultValue);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const commit = (next: number) => {
    setValue(next);
    onChange?.(next);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (readOnly) return;
    let next = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, value + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(0, value - 1);
    else return;
    e.preventDefault();
    if (next !== value) commit(next);
  };

  return (
    <div role="radiogroup" aria-label="Rating" onKeyDown={onKeyDown} onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={n === value}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
          data-filled={n <= shown}
          disabled={readOnly}
          onClick={() => commit(n === value ? 0 : n)}
          onMouseEnter={() => setHover(n)}
        >
          {n <= shown ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
```

%% exercise react-todo | Todo list | 2 | tsx | react | TodoList | 25
Build `<TodoList initialTodos? />`.

- A form with a text input labelled **New todo** and an **Add** button. Submitting (button or Enter) adds the **trimmed** text; blank input is ignored; the input clears after adding.
- Todos render in a `<ul>`; each `<li>` has a checkbox whose accessible name is the todo text (wrap in a `<label>`), and a delete button labelled `Delete <text>`.
- Checking a todo marks it done. The `<li>` gets `data-done="true"/"false"`.
- A `role="status"` line reads `N items left` (`1 item left` when singular, counting **unchecked** todos).
- Duplicate texts are allowed, and toggling/deleting one must affect only that one (use ids as keys).
- `initialTodos` (strings) seeds the list.

%% starter
```tsx
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export function TodoList({ initialTodos = [] }: { initialTodos?: string[] }) {
  return null;
}
```

%% tests
```tsx
const add = async (text: string) => {
  await userEvent.type(screen.getByLabelText('New todo'), text + '{Enter}');
};
const items = () => screen.queryAllByRole('listitem');

describe('TodoList', () => {
  it('starts empty with a status line', () => {
    render(<TodoList />);
    expect(items()).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('0 items left');
  });

  it('adds a todo with Enter and clears the input', async () => {
    render(<TodoList />);
    await add('Buy milk');
    expect(items()).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'Buy milk' })).not.toBeChecked();
    expect(screen.getByLabelText('New todo')).toHaveValue('');
  });

  it('adds with the Add button too', async () => {
    render(<TodoList />);
    await userEvent.type(screen.getByLabelText('New todo'), 'Walk dog');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Walk dog')).toBeInTheDocument();
  });

  it('trims and ignores blank input', async () => {
    render(<TodoList />);
    await add('   ');
    expect(items()).toHaveLength(0);
    await add('  Read  ');
    expect(screen.getByRole('checkbox', { name: 'Read' })).toBeInTheDocument();
  });

  it('keeps insertion order', async () => {
    render(<TodoList />);
    await add('one'); await add('two'); await add('three');
    expect(items().map((li) => li.textContent?.replace('×', '').trim())).toEqual(['one', 'two', 'three']);
  });

  it('toggles done state and updates the count', async () => {
    render(<TodoList initialTodos={['a', 'b']} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 items left');
    await userEvent.click(screen.getByRole('checkbox', { name: 'a' }));
    expect(screen.getByRole('checkbox', { name: 'a' })).toBeChecked();
    expect(items()[0]).toHaveAttribute('data-done', 'true');
    expect(items()[1]).toHaveAttribute('data-done', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('1 item left');
  });

  it('un-toggles', async () => {
    render(<TodoList initialTodos={['a']} />);
    const box = screen.getByRole('checkbox', { name: 'a' });
    await userEvent.click(box);
    await userEvent.click(box);
    expect(box).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('1 item left');
  });

  it('deletes a todo', async () => {
    render(<TodoList initialTodos={['a', 'b', 'c']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete b' }));
    expect(items()).toHaveLength(2);
    expect(screen.queryByText('b')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 items left');
  });

  it('handles duplicates independently', async () => {
    render(<TodoList initialTodos={['same', 'same']} />);
    const boxes = screen.getAllByRole('checkbox', { name: 'same' });
    await userEvent.click(boxes[1]);
    expect(boxes[0]).not.toBeChecked();
    expect(screen.getAllByRole('checkbox', { name: 'same' })[1]).toBeChecked();
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete same' })[0]);
    expect(screen.getAllByRole('checkbox', { name: 'same' })).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'same' })).toBeChecked();
  });

  it('keeps checked state on the right item after deleting an earlier one', async () => {
    render(<TodoList initialTodos={['a', 'b', 'c']} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'c' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete a' }));
    expect(screen.getByRole('checkbox', { name: 'c' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'b' })).not.toBeChecked();
  });

  it('does not log React warnings', async () => {
    const spy = jest.spyOn(console, 'error');
    render(<TodoList initialTodos={['a']} />);
    await add('b');
    expect(spy).not.toHaveBeenCalled();
  });
});
```

%% hints
- State: `todos` (with stable numeric `id`s) and the `draft` text. Derive "items left" during render.
- Ids: a `useRef` counter incremented on each add — *not* the array index, or the last two tests fail.
- The form's `onSubmit` handles both Enter and the button; call `e.preventDefault()`.
- Use `<label><input type="checkbox" … /> {text}</label>` so the label text becomes the accessible name.
- Update immutably with `map` / `filter` and updater functions.

%% solution
```tsx
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export function TodoList({ initialTodos = [] }: { initialTodos?: string[] }) {
  const nextId = useRef(initialTodos.length + 1);
  const [todos, setTodos] = useState<Todo[]>(() => initialTodos.map((text, i) => ({ id: i + 1, text, done: false })));
  const [draft, setDraft] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setTodos((all) => [...all, { id: nextId.current++, text, done: false }]);
    setDraft('');
  };

  const toggle = (id: number) => setTodos((all) => all.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id: number) => setTodos((all) => all.filter((t) => t.id !== id));
  const left = todos.filter((t) => !t.done).length;

  return (
    <div>
      <form onSubmit={submit}>
        <input aria-label="New todo" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((t) => (
          <li key={t.id} data-done={t.done}>
            <label>
              <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} /> {t.text}
            </label>
            <button aria-label={`Delete ${t.text}`} onClick={() => remove(t.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <p role="status">
        {left} {left === 1 ? 'item' : 'items'} left
      </p>
    </div>
  );
}
```

%% exercise react-signup-form | Signup form with validation | 3 | tsx | react | SignupForm | 30
Build `<SignupForm onSubmit />`, where `onSubmit(values)` may return a promise.

**Fields:** inputs labelled **Email** and **Password**, and a submit button **Create account**. The form has `noValidate` (you do the validation).

**Rules**
1. No errors are shown until the first submit attempt.
2. Email is valid if it looks like `x@y`; password needs **8+ characters**. Messages: `Enter a valid email` and `Password must be at least 8 characters` (each in an element with `role="alert"`, and the input gets `aria-invalid="true"`).
3. An invalid submit doesn't call `onSubmit` and **focuses the first invalid field**.
4. After an attempt, errors update live as the user types.
5. A valid submit calls `onSubmit({ email, password })` with the **trimmed** email.
6. While awaiting `onSubmit`, the button is disabled and reads **Creating…**; repeat submits are ignored. It re-enables afterwards.
7. If `onSubmit` rejects, show an alert `Something went wrong. Please try again.` and re-enable the button.

%% starter
```tsx
import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

export interface SignupValues {
  email: string;
  password: string;
}

export function SignupForm({ onSubmit }: { onSubmit: (values: SignupValues) => void | Promise<void> }) {
  return null;
}
```

%% tests
```tsx
const email = () => screen.getByLabelText('Email') as HTMLInputElement;
const password = () => screen.getByLabelText('Password') as HTMLInputElement;
const submitBtn = () => screen.getByRole('button', { name: /Create account|Creating…/ });
const fill = async (e = 'ada@example.com', p = 'correct horse') => {
  await userEvent.type(email(), e);
  await userEvent.type(password(), p);
};

describe('SignupForm', () => {
  it('shows no errors initially', () => {
    render(<SignupForm onSubmit={() => {}} />);
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
    expect(email()).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('blocks an invalid submit, shows both errors and focuses the first invalid field', async () => {
    const onSubmit = jest.fn();
    render(<SignupForm onSubmit={onSubmit} />);
    await userEvent.click(submitBtn());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(email()).toHaveAttribute('aria-invalid', 'true');
    expect(email()).toHaveFocus();
  });

  it('focuses the password when only the password is invalid', async () => {
    render(<SignupForm onSubmit={() => {}} />);
    await userEvent.type(email(), 'a@b.co');
    await userEvent.type(password(), 'short');
    await userEvent.click(submitBtn());
    expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument();
    expect(password()).toHaveFocus();
  });

  it('re-validates live after the first attempt', async () => {
    render(<SignupForm onSubmit={() => {}} />);
    await userEvent.click(submitBtn());
    await userEvent.type(email(), 'ada@example.com');
    expect(screen.queryByText('Enter a valid email')).not.toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    await userEvent.type(password(), '12345678');
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('does not nag before the first attempt while typing', async () => {
    render(<SignupForm onSubmit={() => {}} />);
    await userEvent.type(email(), 'bad');
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('submits trimmed values when valid', async () => {
    const onSubmit = jest.fn();
    render(<SignupForm onSubmit={onSubmit} />);
    await fill('  ada@example.com  ', 'correct horse');
    await userEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'correct horse' });
  });

  it('submits with the Enter key', async () => {
    const onSubmit = jest.fn();
    render(<SignupForm onSubmit={onSubmit} />);
    await userEvent.type(email(), 'ada@example.com');
    await userEvent.type(password(), 'correct horse{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('disables the button and ignores repeat submits while pending', async () => {
    let resolve!: () => void;
    const onSubmit = jest.fn(() => new Promise<void>((r) => { resolve = r; }));
    render(<SignupForm onSubmit={onSubmit} />);
    await fill();
    await userEvent.click(submitBtn());
    expect(submitBtn()).toBeDisabled();
    expect(submitBtn()).toHaveTextContent('Creating…');
    fireEvent.submit(email().closest('form')!);
    await userEvent.click(submitBtn());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); });
    await waitFor(() => expect(submitBtn()).toBeEnabled());
    expect(submitBtn()).toHaveTextContent('Create account');
  });

  it('shows an alert and re-enables the button when onSubmit rejects', async () => {
    const onSubmit = jest.fn(() => Promise.reject(new Error('server down')));
    render(<SignupForm onSubmit={onSubmit} />);
    await fill();
    await userEvent.click(submitBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(submitBtn()).toBeEnabled();
  });

  it('associates errors with their inputs', async () => {
    render(<SignupForm onSubmit={() => {}} />);
    await userEvent.click(submitBtn());
    const describedBy = email().getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent('Enter a valid email');
  });
});
```

%% hints
- Derive `errors` from `values` on every render — don't store them. Show them only when `attempted` is `true`.
- `handleSubmit`: `e.preventDefault()`; return early if already submitting; `setAttempted(true)`; if invalid, `ref.current?.focus()` on the first bad field and return.
- `status: 'idle' | 'submitting' | 'failed'` is easier to reason about than three booleans.
- `try { await onSubmit(...) ; setStatus('idle') } catch { setStatus('failed') }`.
- For `aria-describedby` give each error `<p>` an id built from `useId()`.

%% solution
```tsx
import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';

export interface SignupValues {
  email: string;
  password: string;
}

export function SignupForm({ onSubmit }: { onSubmit: (values: SignupValues) => void | Promise<void> }) {
  const uid = useId();
  const [values, setValues] = useState<SignupValues>({ email: '', password: '' });
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'failed'>('idle');
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const errors = {
    email: /.+@.+/.test(values.email.trim()) ? '' : 'Enter a valid email',
    password: values.password.length >= 8 ? '' : 'Password must be at least 8 characters',
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setAttempted(true);
    if (errors.email || errors.password) {
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setStatus('submitting');
    try {
      await onSubmit({ email: values.email.trim(), password: values.password });
      setStatus('idle');
    } catch {
      setStatus('failed');
    }
  };

  const emailErr = attempted && errors.email;
  const passErr = attempted && errors.password;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor={`${uid}-email`}>Email</label>
        <input
          id={`${uid}-email`}
          ref={emailRef}
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          aria-invalid={!!emailErr}
          aria-describedby={emailErr ? `${uid}-email-err` : undefined}
        />
        {emailErr && <p id={`${uid}-email-err`} role="alert">{errors.email}</p>}
      </div>
      <div>
        <label htmlFor={`${uid}-password`}>Password</label>
        <input
          id={`${uid}-password`}
          type="password"
          ref={passwordRef}
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          aria-invalid={!!passErr}
          aria-describedby={passErr ? `${uid}-password-err` : undefined}
        />
        {passErr && <p id={`${uid}-password-err`} role="alert">{errors.password}</p>}
      </div>
      {status === 'failed' && <p role="alert">Something went wrong. Please try again.</p>}
      <button type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Creating…' : 'Create account'}
      </button>
    </form>
  );
}
```
