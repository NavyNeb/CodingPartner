---
id: react-performance
track: react
title: Rendering performance, memoization & refs
summary: What triggers a render, when memo/useMemo/useCallback actually help, and how to render 10 000 rows.
---

## What causes a render

A component re-renders when:

1. its **state** changes (`setState` with a different value by `Object.is`),
2. its **parent** re-renders (regardless of whether props changed!),
3. a **context** it reads changes.

Rendering = calling your function to get a new element tree. It's usually cheap; the cost is the **whole subtree** below, plus effects and DOM work. React then diffs and commits only real differences — so an "unnecessary render" often costs a function call, not a DOM update. Measure (React DevTools Profiler, `console.time`) before optimising.

## Reference equality is everything

`memo`, `useMemo`, `useCallback` and effect dependencies all compare with `Object.is`. A new object/array/function is created **every render**, so it's "different" every time:

```tsx
<Child style={{ color: 'red' }} onSelect={() => pick(id)} />   // new identities each render
```

- **`React.memo(Component)`** skips re-rendering when props are shallow-equal to last time.
- **`useMemo(() => compute(a, b), [a, b])`** caches a **value** between renders.
- **`useCallback(fn, deps)`** caches a **function** (= `useMemo(() => fn, deps)`).

Memoizing a child is *pointless* if you pass it a fresh object/function each render. Memo the child **and** stabilise the props. And memoizing something cheap costs more (comparison + memory) than recomputing it.

## When memoization is worth it

- A `memo` child that's expensive to render (a big list row, a chart) and re-rendered often by a busy parent.
- A `useMemo` around a genuinely expensive computation (sorting/filtering thousands of items).
- A `useCallback`/`useMemo` whose result is a **dependency** of an effect or another memo (to avoid re-running it).

Otherwise, first try the structural fixes below — they don't need any memo at all.

## Structural fixes beat memo

- **Colocate state.** Put state in the smallest component that needs it; typing in an input shouldn't re-render the whole page.
- **Children as props.** A component that holds fast-changing state but renders `{children}` passed from above doesn't re-render those children (their element identity is unchanged).
- **Split contexts** by update frequency, and memoise the context value.
- **Avoid deriving in effects.** Compute during render.
- **Keys:** stable keys preserve DOM/state; index keys cause remounts on reorder.

## The functional-update trick

To make a callback stable **without** listing state in its deps, use the updater form:

```tsx
const toggle = useCallback((id: number) => {
  setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
}, []);   // no `items` dependency → identity never changes
```

## Refs

`useRef` returns `{ current }`, stable for the component's life. Writing it **doesn't re-render**.

- **DOM access:** `<input ref={inputRef} />` then `inputRef.current?.focus()` — in an event handler or effect, not during render.
- **Instance values:** timer ids, previous values, "latest callback" (`useEvent` pattern), flags like `isMounted`.
- Ref callbacks (`ref={(el) => …}`) run on mount/unmount and when the function identity changes.

## Virtualisation

Rendering 10 000 DOM rows is slow no matter how well you memoise. **Windowing** renders only what's in view: compute the visible index range from `scrollTop`, render those rows (plus overscan) absolutely positioned inside a tall spacer. Libraries: `react-window`, `@tanstack/react-virtual` — but you'll write the core yourself below.

## Updates are batched, transitions are interruptible

`startTransition` / `useTransition` mark a state update as **non-urgent**: React keeps the UI responsive to typing and can abandon stale renders. `useDeferredValue(value)` gives you a lagging copy for expensive derived UI. Reach for them when a *single* slow render blocks input — not as a default.

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
