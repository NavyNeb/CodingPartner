---
id: react-performance
track: react
title: Rendering performance, memoization & refs
summary: What makes React re-render, when memo / useMemo / useCallback genuinely help, and how to show 10,000 rows without freezing the page.
---

## The idea in one sentence

Before making React faster, learn **what makes it do work** — most "performance problems" are fixed by *moving state* or *passing stable props*, not by sprinkling `useMemo` everywhere.

> **Analogy** A component is a **restaurant order slip**. When one table changes its order, the kitchen re-reads the slip for that table — and, by default, for **every table under the same waiter**, even if nothing changed for them. `memo` is a sticky note saying "nothing changed here — skip it". But the note only works if the slip you hand over is the *same slip*, not a photocopy each time.

## What causes a render

A component re-renders when:

1. its own **state** changes (`setState` with a different value, compared by `Object.is`),
2. its **parent** re-renders — *regardless of whether its props changed!*,
3. a **context** it reads changes.

![A state change in App renders its children; a memo child with unchanged props is skipped](fig:what-renders "A render is a function call, not a DOM update. React then diffs and only commits real differences. The cost is the whole subtree below.")

Rendering (calling your function) is usually cheap. What's expensive is **big subtrees**, slow computations inside render, and lots of DOM. So: **measure first** (React DevTools Profiler, `console.time`).

Watch renders happen. Click the button and read the console panel:

```tsx try
import { memo, useState } from 'react';

function Plain({ label }: { label: string }) {
  console.log('render Plain');
  return <p>{label}</p>;
}

const Memoized = memo(function Memoized({ label }: { label: string }) {
  console.log('render Memoized');
  return <p>{label}</p>;
});

export default function App() {
  const [count, setCount] = useState(0);
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <button onClick={() => setCount(count + 1)}>clicked {count}</button>
      <Plain label="I re-render whenever my parent does" />
      <Memoized label="I only re-render if my props change" />
    </div>
  );
}
```

Each click re-renders `Plain` (its parent changed) but **not** `Memoized` (same props).

### Step through: who re-renders?

```stepper Why memo skips a child
code:
  function App() {
    const [count, setCount] = useState(0);
    return (<>
      <button onClick={() => setCount(count + 1)}>{count}</button>
      <Row label="Ada" />
    </>);
  }
---
line: 3-4
say: The user clicks the button. `setCount` runs, so `App`'s **state** changed.
Who re-renders:
Why:
---
line: 1-2
say: React calls `App` again. It returns new elements, including a new `<Row label="Ada" />` element.
Who re-renders: App
Why: its own state changed
---
line: 5
say: Without `memo`: `Row` is a child of a component that rendered, so React calls `Row` too — even though `label` is still `"Ada"`.
Who re-renders: App | Row (wasted)
Why: parent rendered → children render by default
---
line: 5
say: With `memo(Row)`: React first compares the **new props** with the **old props** using `Object.is`. `"Ada" === "Ada"`, so it **skips** `Row` and reuses the last result.
Who re-renders: App only
Why: memo: props are equal
```

## Reference equality is everything

`memo`, `useMemo`, `useCallback` and effect dependencies all compare with `Object.is`. But every render creates **new** objects, arrays and functions, so they're "different" each time:

```tsx
<Child style={{ color: 'red' }} onSelect={() => pick(id)} />   // new identities on every render
```

![Fresh props are never equal so memo is wasted; stable props let memo skip the render](fig:memo-identity "Memoise the child AND stabilise the props you pass it.")

- **`React.memo(Component)`** — skip re-rendering when props are shallow-equal to last time.
- **`useMemo(() => compute(a, b), [a, b])`** — cache a **value** between renders.
- **`useCallback(fn, deps)`** — cache a **function** (it's `useMemo(() => fn, deps)`).

Try it: the memo child gets a **new inline object** each render, so the memo does nothing. Then fix it with `useMemo`:

```tsx try
import { memo, useMemo, useState } from 'react';

const Box = memo(function Box({ style, name }: { style: { color: string }; name: string }) {
  console.log('render', name);
  return <p style={style}>{name}</p>;
});

export default function App() {
  const [n, setN] = useState(0);
  const stable = useMemo(() => ({ color: 'teal' }), []);   // created once
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <button onClick={() => setN(n + 1)}>re-render parent ({n})</button>
      <Box name="inline object (wasted memo)" style={{ color: 'crimson' }} />
      <Box name="stable object (memo works)" style={stable} />
    </div>
  );
}
```

Memoising something cheap costs more (the comparison and the memory) than just recomputing it. Use these tools where they pay off.

## When memoization is worth it

- A `memo` child that's **expensive to render** (a big row, a chart) and re-rendered often by a busy parent.
- A `useMemo` around a genuinely **expensive computation** (sorting/filtering thousands of items).
- A `useCallback`/`useMemo` whose result is a **dependency** of an effect or another memo.

## Structural fixes beat memo

1. **Colocate state.** Keep state in the smallest component that needs it. Typing in an input shouldn't re-render the whole page.
2. **Children as props.** A component with fast-changing state that renders `{children}` passed from above doesn't re-render them (their element identity didn't change).
3. **Split contexts** by how often they change, and memoise context values.
4. **Compute during render** instead of "syncing" with effects.
5. **Stable keys** keep DOM and state; index keys cause remounts on reorder.

### The functional-update trick

To make a callback **stable without listing state** in its deps, use the updater form:

```tsx
const toggle = useCallback((id: number) => {
  setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
}, []);   // no `items` dependency → the identity never changes
```

## Refs

`useRef` returns `{ current }`, the same object for the component's whole life. Writing it **doesn't re-render**.

- **DOM access**: `<input ref={inputRef} />`, then `inputRef.current?.focus()` — in an event handler or effect, *not* during render.
- **Instance values**: timer ids, the previous value, the latest callback, flags like `isMounted`.
- **Ref callbacks** (`ref={(el) => …}`) run on mount/unmount, and again if the function's identity changes.

```tsx try
import { useRef } from 'react';

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <input ref={inputRef} placeholder="type here…" />{' '}
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
      <button onClick={() => { if (inputRef.current) { inputRef.current.value = ''; inputRef.current.focus(); } }}>Clear</button>
    </div>
  );
}
```

## Virtualisation: render only what's visible

Rendering 10,000 DOM rows is slow **no matter how well you memoise**, because the browser has to lay out 10,000 elements. **Windowing** renders only the rows in view:

![A tall spacer with only the visible rows plus overscan mounted](fig:virtual-window "The spacer keeps the scrollbar honest; only rows in [start, end) exist in the DOM.")

1. A container with a fixed height and `overflow-y: auto`.
2. A **spacer** `items.length × itemHeight` tall, so the scrollbar looks right.
3. On scroll, read `scrollTop` and compute the visible index range (plus a little **overscan** above and below).
4. Render only those rows, positioned with `top = index × itemHeight`.

```tsx try
import { useState } from 'react';

const items = Array.from({ length: 10000 }, (_, i) => `Row ${i}`);
const H = 240, ROW = 28, OVERSCAN = 3;

export default function App() {
  const [top, setTop] = useState(0);
  const start = Math.max(0, Math.floor(top / ROW) - OVERSCAN);
  const end = Math.min(items.length, Math.ceil((top + H) / ROW) + OVERSCAN);
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <p>Rows in the DOM: <b>{end - start}</b> of {items.length}</p>
      <div style={{ height: H, overflowY: 'auto', border: '1px solid #aaa' }} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
        <div style={{ height: items.length * ROW, position: 'relative' }}>
          {items.slice(start, end).map((t, k) => (
            <div key={start + k} style={{ position: 'absolute', top: (start + k) * ROW, height: ROW }}>{t}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Libraries (`react-window`, `@tanstack/react-virtual`) add polish, but you'll write the core yourself.

## Transitions: keep typing responsive

`startTransition` / `useTransition` mark an update as **non-urgent**: React stays responsive to typing and can abandon an out-of-date render. `useDeferredValue(value)` gives you a *lagging copy* of a value for expensive derived UI. Use them when **one slow render** blocks input — not by default.

## Common mistakes

1. **Memoising everything** "just in case" (extra comparisons, more bugs).
2. **Memo child + inline object/function props** — the memo never hits.
3. **Missing or wrong dependencies** in `useMemo`/`useCallback` (stale values).
4. **State too high in the tree** — one keystroke re-renders the page.
5. **Index keys** with reorderable lists.
6. **Rendering huge lists without virtualisation.**

## Quick check

```check
Q: A parent re-renders. Does a child re-render if its props are unchanged, and it is NOT wrapped in `memo`?
A) No, React compares props automatically
B) Only if it uses state
C) Yes — children render whenever their parent renders, unless memoised *
D) Only in development mode
Why: React's default is to render the subtree. `memo` adds the props comparison.
---
Q: Why does `memo(Child)` not help here: `<Child options={{ dense: true }} />`?
A) `memo` only works with strings
B) `memo` needs `useCallback`
C) Children can't receive objects
D) The inline object is a new identity every render, so props are never "equal" *
Why: `memo` compares props with `Object.is`. A fresh `{}` is never `===` to the previous one. Memoise the object or define it outside the component.
---
Q: Which change usually gives the biggest win when typing in a search box re-renders a whole slow page?
A) Wrap everything in `useMemo`
B) Move the input's state down into a small component (colocate the state) *
C) Use `key={Math.random()}`
D) Switch to class components
Why: If the state lives in a small component, only that component (and its children) re-render when it changes.
---
Q: What is `useCallback(fn, [])` with a function that calls `setItems(prev => …)`?
A) A function whose identity never changes and never reads stale state *
B) A function that runs once
C) A memoised value
D) A compile error
Why: The updater form means the callback doesn't need `items`, so an empty dependency array is correct, and the identity is stable.
---
Q: Why does a virtual list help with 10,000 items?
A) It compresses the data
B) It caches network requests
C) It only mounts the rows in the visible window (plus overscan) instead of all of them *
D) It turns rows into canvas drawings
Why: Fewer DOM nodes means less layout and paint work. The spacer keeps the scrollbar the right size.
```

## Recap

- Renders come from **state**, a **parent render**, or **context**; the cost is the subtree — **measure first**.
- `memo` / `useMemo` / `useCallback` compare by **`Object.is`**: fresh objects and functions defeat them, so stabilise props.
- **Structural fixes first**: colocate state, pass `children`, split contexts, compute during render.
- The **updater form** keeps callbacks stable without state in deps.
- **Refs** hold mutable values and DOM nodes without re-rendering.
- **Virtualise** long lists; use **transitions** when one slow render blocks input.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: cache a calculation | `useMemo` and its dependency array |
| Focus with a ref | "Refs": `useRef`, `ref={…}`, `.current.focus()` |
| Cache the expensive filter | `useMemo` with the right dependencies |
| Stop the wasted row renders | `memo` + `useCallback` + the functional-update trick |
| `useEvent` | The latest-ref pattern (hooks lesson): stable function, fresh closure |
| Virtual list | The windowing demo and the start/end formulas |

%% exercise perf-guided-total | Guided: cache a calculation | 1 | tsx | react | Total | 6 | guided
Build `<Total items sum />`. `sum(items)` is an **expensive** function passed in as a prop.

- It renders `Total: <sum(items)>`.
- There is also a **Toggle note** button that shows/hides a `<p>Note</p>` — an unrelated state change.
- `sum` must be called **only when `items` changes** — not when the note is toggled.

%% worked
**A similar problem, solved: `<Doubled value expensive />`** — cache the result of a slow function between renders.

```tsx
import { useMemo, useState } from 'react';

export function Doubled({ value, expensive }: { value: number; expensive: (n: number) => number }) {
  const [open, setOpen] = useState(false);                     // unrelated state: changing it re-renders this component
  const result = useMemo(() => expensive(value), [value, expensive]);
  //             ① the function to run                ② re-run ONLY when one of these changes
  return (
    <div>
      <p>Result: {result}</p>
      <button onClick={() => setOpen((o) => !o)}>Toggle</button>
      {open && <p>Extra</p>}
    </div>
  );
}
```

Without `useMemo`, every click on the button re-renders the component, and `expensive(value)` would run again for nothing. `useMemo` remembers the last result and returns it as long as the dependencies are **identical** (`Object.is`).

%% explain
- **`Total: N`** where `N = sum(items)`.
- **`sum` runs once on the first render**, and again only when `items` changes.
- **Toggling the note** re-renders the component but does not call `sum` again.
- **Changing `items`** (a new array) calls it again.

%% nudge
- Which hook caches the result of a calculation between renders?
- What goes in its dependency array: what does the calculation depend on?

%% starter
```tsx
import { useState } from 'react';

export function Total({ items, sum }: { items: number[]; sum: (items: number[]) => number }) {
  const [showNote, setShowNote] = useState(false);

  // Step 1 — this line runs on EVERY render (even when only showNote changed). Wrap it in useMemo:
  //          const total = useMemo(() => sum(items), [items, sum]);
  const total = sum(items);

  return (
    <div>
      <p>Total: {total}</p>
      <button onClick={() => setShowNote((s) => !s)}>Toggle note</button>
      {showNote && <p>Note</p>}
    </div>
  );
}
```

%% tests
```tsx
describe('Total', () => {
  const add = (xs) => xs.reduce((a, b) => a + b, 0);

  it('shows the total', () => {
    render(<Total items={[1, 2, 3]} sum={add} />);
    expect(screen.getByText('Total: 6')).toBeInTheDocument();
  });

  it('does not recompute when an unrelated state changes', async () => {
    const sum = jest.fn(add);
    render(<Total items={[1, 2]} sum={sum} />);
    expect(sum).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Toggle note' }));
    expect(screen.getByText('Note')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Toggle note' }));
    expect(sum).toHaveBeenCalledTimes(1);
  });

  it('recomputes when items change', () => {
    const sum = jest.fn(add);
    const { rerender } = render(<Total items={[1, 2]} sum={sum} />);
    rerender(<Total items={[1, 2, 3]} sum={sum} />);
    expect(sum).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Total: 6')).toBeInTheDocument();
  });
});
```

%% hints
- `import { useMemo, useState } from 'react';`
- `const total = useMemo(() => sum(items), [items, sum]);`

%% solution
```tsx
import { useMemo, useState } from 'react';

export function Total({ items, sum }: { items: number[]; sum: (items: number[]) => number }) {
  const [showNote, setShowNote] = useState(false);
  const total = useMemo(() => sum(items), [items, sum]);

  return (
    <div>
      <p>Total: {total}</p>
      <button onClick={() => setShowNote((s) => !s)}>Toggle note</button>
      {showNote && <p>Note</p>}
    </div>
  );
}
```

%% exercise perf-focus-input | Focus with a ref | 1 | tsx | react | SearchField | 8
Build `<SearchField autoFocusOnMount? />` using a **ref** (no `autoFocus` attribute).

- An input labelled **Query** (controlled).
- **Focus** button: focuses the input.
- **Clear** button: empties the input and focuses it.
- With `autoFocusOnMount`, the input is focused right after the first render.

%% starter
```tsx
import { useEffect, useRef, useState } from 'react';

export function SearchField({ autoFocusOnMount = false }: { autoFocusOnMount?: boolean }) {
  return null;
}
```

%% tests
```tsx
describe('SearchField', () => {
  it('is not focused by default', () => {
    render(<SearchField />);
    expect(screen.getByLabelText('Query')).not.toHaveFocus();
  });

  it('focuses the input when the Focus button is clicked', async () => {
    render(<SearchField />);
    await userEvent.click(screen.getByRole('button', { name: 'Focus' }));
    expect(screen.getByLabelText('Query')).toHaveFocus();
  });

  it('is controlled', async () => {
    render(<SearchField />);
    await userEvent.type(screen.getByLabelText('Query'), 'hello');
    expect(screen.getByLabelText('Query')).toHaveValue('hello');
  });

  it('Clear empties the input and focuses it', async () => {
    render(<SearchField />);
    await userEvent.type(screen.getByLabelText('Query'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByLabelText('Query')).toHaveValue('');
    expect(screen.getByLabelText('Query')).toHaveFocus();
  });

  it('focuses on mount when asked to', () => {
    render(<SearchField autoFocusOnMount />);
    expect(screen.getByLabelText('Query')).toHaveFocus();
  });

  it('does not use the autofocus attribute', () => {
    render(<SearchField autoFocusOnMount />);
    expect(screen.getByLabelText('Query')).not.toHaveAttribute('autofocus');
  });
});
```

%% worked
**A similar problem, solved: `<CopyField value />`** — a read-only input with a button that selects its text.

```tsx
import { useRef } from 'react';

export function CopyField({ value }: { value: string }) {
  const inputRef = useRef<HTMLInputElement>(null);      // ① a box that will hold the real DOM node

  return (
    <div>
      <input ref={inputRef} value={value} readOnly aria-label="Link" />   {/* ② React puts the DOM node into inputRef.current */}
      <button onClick={() => inputRef.current?.select()}>Select</button> {/* ③ use it in an EVENT HANDLER (not during render) */}
    </div>
  );
}
```

For `SearchField`: the input is **controlled** (state for its value), the **Focus** button calls `inputRef.current?.focus()`, **Clear** sets the state to `''` and focuses. "Focus on mount" is an **effect**: `useEffect(() => { if (autoFocusOnMount) inputRef.current?.focus(); }, [])` — the DOM node exists only after the first render, so you can't do it while rendering.

%% explain
- **An input labelled `Query`** (controlled).
- **Focus** button focuses it; **Clear** empties it and focuses it.
- **`autoFocusOnMount`** focuses it right after the first render — with a ref, not the `autoFocus` attribute.

%% nudge
- When does `inputRef.current` get filled in with the DOM node?
- Which hook lets you run code right after the first render?

%% hints
- `const inputRef = useRef<HTMLInputElement>(null);` and `<input ref={inputRef} … />`.
- Focus inside handlers: `inputRef.current?.focus()`.
- On mount: `useEffect(() => { if (autoFocusOnMount) inputRef.current?.focus(); }, [])`.
- `<label>Query <input …/></label>` gives the accessible name.

%% solution
```tsx
import { useEffect, useRef, useState } from 'react';

export function SearchField({ autoFocusOnMount = false }: { autoFocusOnMount?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    if (autoFocusOnMount) inputRef.current?.focus();
  }, [autoFocusOnMount]);

  return (
    <div>
      <label>
        Query
        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
      <button
        onClick={() => {
          setValue('');
          inputRef.current?.focus();
        }}
      >
        Clear
      </button>
    </div>
  );
}
```

%% exercise perf-use-memo | Cache the expensive filter | 2 | tsx | react | ProductList | 15
`ProductList` filters a big product list with an **expensive** function passed as a prop, `filterProducts(products, query)`.

The starter calls it on every render — including renders caused by the unrelated **Dark mode** toggle. Fix it so `filterProducts` runs **only when `products` or the query change**.

- Input labelled **Filter** (controlled), a **Dark mode** button (toggles a `data-theme` attribute on the wrapper), and a `<ul>` of product names from `filterProducts`.

%% starter
```tsx
import { useMemo, useState } from 'react';

export interface Product {
  id: number;
  name: string;
}

interface Props {
  products: Product[];
  filterProducts: (products: Product[], query: string) => Product[];
}

export function ProductList({ products, filterProducts }: Props) {
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);

  const visible = filterProducts(products, query);

  return (
    <div data-theme={dark ? 'dark' : 'light'}>
      <label>
        Filter
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <button onClick={() => setDark((d) => !d)}>Dark mode</button>
      <ul>
        {visible.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

%% tests
```tsx
const products = [
  { id: 1, name: 'Apple' }, { id: 2, name: 'Apricot' }, { id: 3, name: 'Banana' },
];
const realFilter = (list: typeof products, q: string) => list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

describe('ProductList', () => {
  it('renders the filtered list', async () => {
    render(<ProductList products={products} filterProducts={realFilter} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    await userEvent.type(screen.getByLabelText('Filter'), 'ap');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Apple', 'Apricot']);
  });

  it('calls the filter once initially', () => {
    const filter = jest.fn(realFilter);
    render(<ProductList products={products} filterProducts={filter} />);
    expect(filter).toHaveBeenCalledTimes(1);
  });

  it('does NOT recompute when unrelated state changes', async () => {
    const filter = jest.fn(realFilter);
    render(<ProductList products={products} filterProducts={filter} />);
    filter.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(filter).not.toHaveBeenCalled();
  });

  it('recomputes once per query change', async () => {
    const filter = jest.fn(realFilter);
    render(<ProductList products={products} filterProducts={filter} />);
    filter.mockClear();
    await userEvent.type(screen.getByLabelText('Filter'), 'abc');
    expect(filter).toHaveBeenCalledTimes(3);
  });

  it('recomputes when the products array changes, not when it is re-passed unchanged', () => {
    const filter = jest.fn(realFilter);
    const { rerender } = render(<ProductList products={products} filterProducts={filter} />);
    filter.mockClear();
    rerender(<ProductList products={products} filterProducts={filter} />);
    expect(filter).not.toHaveBeenCalled();
    rerender(<ProductList products={[...products, { id: 4, name: 'Cherry' }]} filterProducts={filter} />);
    expect(filter).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });

  it('still toggles the theme', async () => {
    const { container } = render(<ProductList products={products} filterProducts={realFilter} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark mode' }));
    expect(container.firstElementChild).toHaveAttribute('data-theme', 'dark');
  });
});
```

%% worked
**A similar problem, solved: `<FilteredNames names />`** — keep an expensive derived list from being recomputed on unrelated renders.

```tsx
import { useMemo, useState } from 'react';

export function FilteredNames({ names, slowFilter }: { names: string[]; slowFilter: (n: string[], q: string) => string[] }) {
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);                 // unrelated state

  const visible = useMemo(() => slowFilter(names, query), [names, query, slowFilter]);
  //                         ① depends on names, query (and the function itself)

  return (
    <div data-theme={dark ? 'dark' : 'light'}>
      <input aria-label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
      <button onClick={() => setDark((d) => !d)}>Dark mode</button>
      <ul>{visible.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}
```

Toggling `dark` re-renders the component, but `names`, `query` and `slowFilter` are **the same**, so `useMemo` returns the cached list. Only typing (or new `names`) triggers the expensive call.

%% explain
- **Input `Filter`** (controlled), a **Dark mode** button (toggles `data-theme` on the wrapper), and a `<ul>` of names from `filterProducts`.
- **`filterProducts` runs only when `products` or the query change** — not on the Dark-mode toggle.

%% nudge
- What are *all* the inputs of the expensive call? Those are your dependencies.
- Does toggling dark mode change any of them?

%% hints
- `useMemo(() => filterProducts(products, query), [filterProducts, products, query])`.
- Every value the callback reads goes in the deps array — including the `filterProducts` prop itself.

%% solution
```tsx
import { useMemo, useState } from 'react';

export interface Product {
  id: number;
  name: string;
}

interface Props {
  products: Product[];
  filterProducts: (products: Product[], query: string) => Product[];
}

export function ProductList({ products, filterProducts }: Props) {
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);

  const visible = useMemo(() => filterProducts(products, query), [filterProducts, products, query]);

  return (
    <div data-theme={dark ? 'dark' : 'light'}>
      <label>
        Filter
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <button onClick={() => setDark((d) => !d)}>Dark mode</button>
      <ul>
        {visible.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

%% exercise perf-memo-rows | Stop the wasted row renders | 3 | tsx | react | TodoApp | 20
`TodoApp` renders a list of `Row`s and an unrelated click counter. Today **every** row re-renders on every click of the counter *and* on every toggle. The `onRowRender(id)` prop is called from inside `Row`'s render so we can count renders.

Make it so:
- Clicking the counter button re-renders **no** rows.
- Toggling a row re-renders **only that row**.
- Behaviour is unchanged (checkboxes still toggle).

You may edit anything in the file. (The tools: `memo`, `useCallback`, functional state updates.)

%% starter
```tsx
import { useState } from 'react';

export interface Item {
  id: number;
  label: string;
  done: boolean;
}

interface Props {
  initialItems: Item[];
  onRowRender: (id: number) => void;
}

export function TodoApp({ initialItems, onRowRender }: Props) {
  const [items, setItems] = useState(initialItems);
  const [clicks, setClicks] = useState(0);

  const toggle = (id: number) =>
    setItems(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));

  return (
    <div>
      <button onClick={() => setClicks((c) => c + 1)}>Clicked {clicks} times</button>
      <ul>
        {items.map((item) => (
          <Row key={item.id} item={item} onToggle={toggle} onRender={onRowRender} />
        ))}
      </ul>
    </div>
  );
}

interface RowProps {
  item: Item;
  onToggle: (id: number) => void;
  onRender: (id: number) => void;
}

function Row({ item, onToggle, onRender }: RowProps) {
  onRender(item.id);
  return (
    <li>
      <label>
        <input type="checkbox" checked={item.done} onChange={() => onToggle(item.id)} /> {item.label}
      </label>
    </li>
  );
}
```

%% tests
```tsx
const initialItems = [
  { id: 1, label: 'one', done: false },
  { id: 2, label: 'two', done: false },
  { id: 3, label: 'three', done: false },
];

describe('TodoApp', () => {
  it('renders every row once initially', () => {
    const onRowRender = jest.fn();
    render(<TodoApp initialItems={initialItems} onRowRender={onRowRender} />);
    expect(onRowRender.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
  });

  it('does not re-render rows when the unrelated counter changes', async () => {
    const onRowRender = jest.fn();
    render(<TodoApp initialItems={initialItems} onRowRender={onRowRender} />);
    onRowRender.mockClear();
    await userEvent.click(screen.getByRole('button', { name: /Clicked/ }));
    await userEvent.click(screen.getByRole('button', { name: /Clicked/ }));
    expect(screen.getByRole('button', { name: 'Clicked 2 times' })).toBeInTheDocument();
    expect(onRowRender).not.toHaveBeenCalled();
  });

  it('re-renders only the toggled row', async () => {
    const onRowRender = jest.fn();
    render(<TodoApp initialItems={initialItems} onRowRender={onRowRender} />);
    onRowRender.mockClear();
    await userEvent.click(screen.getByRole('checkbox', { name: 'two' }));
    expect(onRowRender.mock.calls.map((c) => c[0])).toEqual([2]);
    expect(screen.getByRole('checkbox', { name: 'two' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'one' })).not.toBeChecked();
  });

  it('keeps working across several toggles', async () => {
    const onRowRender = jest.fn();
    render(<TodoApp initialItems={initialItems} onRowRender={onRowRender} />);
    onRowRender.mockClear();
    await userEvent.click(screen.getByRole('checkbox', { name: 'one' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'three' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'one' }));
    expect(screen.getByRole('checkbox', { name: 'one' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'three' })).toBeChecked();
    expect(onRowRender.mock.calls.map((c) => c[0])).toEqual([1, 3, 1]);
  });
});
```

%% worked
**A similar problem, solved: a memoised `Item` with a stable `onSelect`.**

```tsx
import { memo, useCallback, useState } from 'react';

const Item = memo(function Item({ id, label, onSelect }: { id: number; label: string; onSelect: (id: number) => void }) {
  console.log('render item', id);               // ① memo: only runs when a prop changed
  return <li><button onClick={() => onSelect(id)}>{label}</button></li>;
});

export function Menu({ items }: { items: { id: number; label: string }[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [clicks, setClicks] = useState(0);                                  // unrelated counter

  const onSelect = useCallback((id: number) => setSelected(id), []);        // ② STABLE identity → memo can compare equal
  return (
    <>
      <button onClick={() => setClicks((c) => c + 1)}>Clicked {clicks}</button>
      <ul>{items.map((it) => <Item key={it.id} {...it} onSelect={onSelect} />)}</ul>
    </>
  );
}
```

Three pieces work together: **`memo`** on the row (skip when props are equal), a **`useCallback`** for the handler passed to it (so the prop *is* equal), and — for changing one row's data — the **functional update** (`setItems(prev => prev.map(...))`) so the handler doesn't need `items` in its dependencies. Missing any one of the three and every row re-renders again.

%% explain
- **Clicking the counter re-renders no rows.**
- **Toggling a row re-renders only that row.**
- **Behaviour is unchanged**: checkboxes still toggle.
- The test counts renders through the `onRowRender(id)` callback.

%% nudge
- Which props does `Row` receive, and which of them get a *new identity* on every `TodoApp` render?
- How can the toggle handler avoid depending on the `items` array?

%% hints
- Two things must hold for `memo(Row)` to skip a render: every prop keeps its identity. `item` does (untouched items are the same object) and `onRender` does (a stable prop) — but `toggle` is a brand-new function each render.
- Make `toggle` stable: `useCallback((id) => setItems((prev) => prev.map(...)), [])`. The **functional** update means it no longer closes over `items`.
- Wrap the row: `const Row = memo(function Row(...) {...})`. Because function declarations aren't hoisted for `const`, define `Row` **above** `TodoApp` (or use a `function` declaration and `export default memo(Row)` style).

%% solution
```tsx
import { memo, useCallback, useState } from 'react';

export interface Item {
  id: number;
  label: string;
  done: boolean;
}

interface RowProps {
  item: Item;
  onToggle: (id: number) => void;
  onRender: (id: number) => void;
}

const Row = memo(function Row({ item, onToggle, onRender }: RowProps) {
  onRender(item.id);
  return (
    <li>
      <label>
        <input type="checkbox" checked={item.done} onChange={() => onToggle(item.id)} /> {item.label}
      </label>
    </li>
  );
});

interface Props {
  initialItems: Item[];
  onRowRender: (id: number) => void;
}

export function TodoApp({ initialItems, onRowRender }: Props) {
  const [items, setItems] = useState(initialItems);
  const [clicks, setClicks] = useState(0);

  const toggle = useCallback((id: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  }, []);

  return (
    <div>
      <button onClick={() => setClicks((c) => c + 1)}>Clicked {clicks} times</button>
      <ul>
        {items.map((item) => (
          <Row key={item.id} item={item} onToggle={toggle} onRender={onRowRender} />
        ))}
      </ul>
    </div>
  );
}
```

%% exercise perf-use-event | useEvent (stable callback, fresh closure) | 3 | tsx | react | useEvent | 18
Write `useEvent(fn)` — it returns a function with a **permanently stable identity** that always calls the **latest** `fn` you passed in.

This solves the classic dilemma: an effect (say, an interval) needs to call a callback that closes over fresh state, but you don't want to tear down and recreate the interval every time the callback changes.

- The returned function is the same object on every render.
- Calling it forwards all arguments and returns the value from the latest `fn`.
- After a re-render with a new `fn`, the next call uses the new one.

%% starter
```tsx
import { useCallback, useLayoutEffect, useRef } from 'react';

export function useEvent<T extends (...args: any[]) => any>(fn: T): T {
  return fn;
}
```

%% tests
```tsx
import { useEffect, useState } from 'react';

describe('useEvent', () => {
  it('returns a stable function', () => {
    const { result, rerender } = renderHook(({ fn }) => useEvent(fn), { initialProps: { fn: () => 1 } });
    const first = result.current;
    rerender({ fn: () => 2 });
    rerender({ fn: () => 3 });
    expect(result.current).toBe(first);
  });

  it('calls the latest function with arguments and returns its result', () => {
    const { result, rerender } = renderHook(({ fn }) => useEvent(fn), {
      initialProps: { fn: (a: number, b: number) => a + b },
    });
    expect(result.current(1, 2)).toBe(3);
    rerender({ fn: (a: number, b: number) => a * b });
    expect(result.current(3, 4)).toBe(12);
  });

  it('sees the latest closure values', () => {
    let captured = 'old';
    const { result, rerender } = renderHook(({ label }) => useEvent(() => label), { initialProps: { label: 'old' } });
    rerender({ label: 'new' });
    captured = result.current();
    expect(captured).toBe('new');
  });

  it('lets an interval effect call fresh callbacks without being recreated', async () => {
    jest.useFakeTimers();
    const seen: number[] = [];
    const setIntervalSpy = jest.spyOn(globalThis, 'setInterval');

    function Ticker() {
      const [count, setCount] = useState(0);
      const onTick = useEvent(() => {
        seen.push(count);
        setCount((c) => c + 1);
      });
      useEffect(() => {
        const id = setInterval(onTick, 1000);
        return () => clearInterval(id);
      }, [onTick]);
      return <p>count {count}</p>;
    }

    render(<Ticker />);
    for (let i = 0; i < 3; i++) act(() => { jest.advanceTimersByTime(1000); });
    expect(seen).toEqual([0, 1, 2]);
    expect(screen.getByText('count 3')).toBeInTheDocument();
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
  });

  it('works as an event handler prop', async () => {
    function Demo({ label }: { label: string }) {
      const onClick = useEvent(() => (window as any).__clicked = label);
      return <button onClick={onClick}>go</button>;
    }
    const { rerender } = render(<Demo label="a" />);
    rerender(<Demo label="b" />);
    await userEvent.click(screen.getByRole('button'));
    expect((window as any).__clicked).toBe('b');
  });
});
```

%% worked
**A similar problem, solved: `useLatest(value)`** — always gives you the newest value, through a ref.

```tsx
import { useRef } from 'react';

export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;          // ① update on every render (cheap, and intended for this pattern)
  return ref;                   // ② the ref object itself is stable forever
}
```

`useEvent(fn)` wraps that idea into a **function**:

```tsx
const latest = useLatest(fn);                         // newest fn, always
return useCallback((...args) => latest.current(...args), []);   // stable wrapper that forwards to it
```

The wrapper function is created **once** (empty deps), so its identity never changes — but when called, it reads `latest.current`, which is the `fn` from the most recent render. That is "stable identity, fresh closure". (Write to the ref in an effect if you want to be strictly render-pure; both approaches pass the tests.)

%% explain
- **The returned function is the same object** on every render.
- **Calling it forwards all arguments** and returns the latest `fn`'s result.
- **After a re-render with a new `fn`**, the next call uses the new one.

%% nudge
- Where can you keep "the newest `fn`" so a never-changing wrapper can reach it?
- Why must the wrapper have an empty dependency list?

%% hints
- Hold `fn` in a ref: `const ref = useRef(fn);`.
- Update the ref **after** each render commits: `useLayoutEffect(() => { ref.current = fn; })` (layout effect so it's fresh before any event or passive effect can fire).
- Return a `useCallback((...args) => ref.current(...args), [])` — empty deps = stable identity.

%% solution
```tsx
import { useCallback, useLayoutEffect, useRef } from 'react';

export function useEvent<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}
```

%% exercise perf-virtual-list | Virtual list | 4 | tsx | react | VirtualList | 40
Build `<VirtualList items height itemHeight overscan? />` that renders **10 000+ strings smoothly** by only mounting the visible rows.

- The scroll container has `role="list"`, `aria-label="Items"` and `data-testid="viewport"`; its style is `height: <height>px; overflow-y: auto`.
- Inside it, a **spacer** div is `items.length * itemHeight` px tall (`position: relative`).
- Each rendered row is `role="listitem"`, absolutely positioned (`top = index * itemHeight`, `height = itemHeight`) and shows the item text.
- Track `scrollTop` from the container's `onScroll`. Render rows `[start, end)`:
  `start = max(0, floor(scrollTop / itemHeight) − overscan)` and `end = min(items.length, ceil((scrollTop + height) / itemHeight) + overscan)`. Default `overscan` is 3.
- Never render rows outside that range.

%% starter
```tsx
import { useState } from 'react';

interface VirtualListProps {
  items: string[];
  height: number;
  itemHeight: number;
  overscan?: number;
}

export function VirtualList({ items, height, itemHeight, overscan = 3 }: VirtualListProps) {
  return null;
}
```

%% tests
```tsx
const many = Array.from({ length: 10000 }, (_, i) => `Item ${i}`);
const viewport = () => screen.getByTestId('viewport');
const scrollTo = (top: number) => fireEvent.scroll(viewport(), { target: { scrollTop: top } });
const rows = () => screen.getAllByRole('listitem');

describe('VirtualList', () => {
  it('has the expected container semantics and size', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    expect(screen.getByRole('list', { name: 'Items' })).toBe(viewport());
    expect(viewport()).toHaveStyle({ height: '300px', overflowY: 'auto' });
  });

  it('renders only the visible rows plus overscan', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    // visible rows 0..9 (300/30) + overscan 3 → 13 rows
    expect(rows()).toHaveLength(13);
    expect(screen.getByText('Item 0')).toBeInTheDocument();
    expect(screen.getByText('Item 12')).toBeInTheDocument();
    expect(screen.queryByText('Item 13')).not.toBeInTheDocument();
  });

  it('sizes the spacer to the full list height', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    expect(viewport().firstElementChild).toHaveStyle({ height: '300000px' });
  });

  it('positions each row absolutely at index * itemHeight', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    const row = screen.getByText('Item 4');
    expect(row).toHaveStyle({ position: 'absolute', top: '120px', height: '30px' });
  });

  it('renders the right window after scrolling', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    scrollTo(3000); // first visible = 100, last = 110 → [97, 113)
    expect(screen.getByText('Item 97')).toBeInTheDocument();
    expect(screen.getByText('Item 100')).toBeInTheDocument();
    expect(screen.getByText('Item 112')).toBeInTheDocument();
    expect(screen.queryByText('Item 96')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 113')).not.toBeInTheDocument();
    expect(screen.queryByText('Item 0')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(16);
  });

  it('handles partially scrolled rows', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} overscan={0} />);
    scrollTo(45); // first = 1, last = ceil(345/30) = 12
    expect(rows()).toHaveLength(11);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 11')).toBeInTheDocument();
    expect(screen.queryByText('Item 12')).not.toBeInTheDocument();
  });

  it('clamps to the end of the list', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    scrollTo(300000 - 300);
    expect(screen.getByText('Item 9999')).toBeInTheDocument();
    expect(screen.queryByText('Item 10000')).not.toBeInTheDocument();
  });

  it('honours a custom overscan', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} overscan={10} />);
    expect(rows()).toHaveLength(20);
  });

  it('handles fewer items than the viewport', () => {
    render(<VirtualList items={['a', 'b']} height={300} itemHeight={30} />);
    expect(rows()).toHaveLength(2);
  });

  it('handles an empty list', () => {
    render(<VirtualList items={[]} height={300} itemHeight={30} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(viewport().firstElementChild).toHaveStyle({ height: '0px' });
  });

  it('keeps the DOM small no matter how long the list is', () => {
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    scrollTo(150000);
    expect(document.querySelectorAll('[role="listitem"]').length).toBeLessThan(30);
  });

  it('does not warn about keys', () => {
    const spy = jest.spyOn(console, 'error');
    render(<VirtualList items={many} height={300} itemHeight={30} />);
    scrollTo(900);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: the range calculation for a *horizontal* strip of columns.**

```ts
function visibleRange(scrollLeft: number, width: number, colWidth: number, count: number, overscan = 2) {
  const start = Math.max(0, Math.floor(scrollLeft / colWidth) - overscan);     // ① first column touching the window, minus a margin
  const end = Math.min(count, Math.ceil((scrollLeft + width) / colWidth) + overscan);   // ② one past the last column, plus a margin
  return [start, end] as const;
}
```

It's the same formula the exercise gives, just written once in a helper. Then the component is three pieces: a **container** with fixed height and `onScroll={(e) => setTop(e.currentTarget.scrollTop)}`, a **spacer** div with `height: items.length * itemHeight` and `position: 'relative'`, and **only** `items.slice(start, end).map(...)` rows, each positioned with `top: (start + k) * itemHeight`. Use the real index as the `key`. Follow the roles and test ids in the prompt exactly: the tests find the viewport by `data-testid`.

%% explain
- **Container**: `role="list"`, `aria-label="Items"`, `data-testid="viewport"`, `height` and `overflow-y: auto`.
- **Spacer**: `items.length * itemHeight` tall, `position: relative`.
- **Rows**: `role="listitem"`, absolutely positioned (`top = index * itemHeight`, `height = itemHeight`), showing the item text.
- **Range**: `start`/`end` from `scrollTop` with `overscan` (default 3); rows outside `[start, end)` are never rendered.

%% nudge
- What state changes when the user scrolls, and where do you read it from?
- Which rows should exist at `scrollTop = 0` if the viewport is 200px tall and each row 20px?

%% hints
- One piece of state: `scrollTop`, set from `e.currentTarget.scrollTop`.
- Derive `start`/`end` during render (no effect, no second state).
- `items.slice(start, end).map((text, i) => …)` — the real index is `start + i`; use it as the key and for `top`.
- Layout: outer div (fixed height, `overflowY: 'auto'`) → inner div (`height: total`, `position: 'relative'`) → absolutely positioned rows.

%% solution
```tsx
import { useState } from 'react';

interface VirtualListProps {
  items: string[];
  height: number;
  itemHeight: number;
  overscan?: number;
}

export function VirtualList({ items, height, itemHeight, overscan = 3 }: VirtualListProps) {
  const [scrollTop, setScrollTop] = useState(0);

  const first = Math.floor(scrollTop / itemHeight);
  const last = Math.ceil((scrollTop + height) / itemHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(items.length, last + overscan);

  return (
    <div
      role="list"
      aria-label="Items"
      data-testid="viewport"
      style={{ height, overflowY: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        {items.slice(start, end).map((text, i) => {
          const index = start + i;
          return (
            <div
              key={index}
              role="listitem"
              style={{ position: 'absolute', top: index * itemHeight, height: itemHeight, left: 0, right: 0 }}
            >
              {text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```
