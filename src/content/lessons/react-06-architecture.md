---
id: react-architecture
track: react
title: State architecture
summary: Sharing state without prop drilling, modelling complex updates, controlled vs uncontrolled APIs, and failing gracefully.
---

## Choosing where state lives

Work down this list and stop at the first that fits:

1. **Local `useState`** — only this component cares.
2. **Lift to the closest common parent** — two siblings need it.
3. **`useReducer`** — many related fields, or transitions with rules ("you can't check out an empty cart").
4. **Context** — many distant consumers, changes infrequently (theme, locale, current user, feature flags).
5. **An external store** (Zustand, Redux, Jotai, TanStack Query for server state) — frequent updates, many subscribers, or state that must live outside the tree. Consumers subscribe to *slices* so only affected components re-render.

## Context, precisely

```tsx
const ThemeContext = createContext<ThemeValue | null>(null);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const value = useMemo(() => ({ theme, setTheme }), [theme]);   // ← stable identity
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

Key facts:

- Every component that calls `useContext(X)` re-renders **whenever the provider's `value` changes** (by `Object.is`) — even if it uses one field. A fresh `{...}` literal each render means every consumer re-renders on every provider render. `useMemo` the value.
- `memo` doesn't shield a context consumer; it only shields from *prop* changes.
- **Split** state and dispatch into two contexts, or split unrelated concerns, so a frequently-changing value doesn't drag stable consumers along.
- Wrap the context in a **custom hook** that throws outside the provider — a clear error beats a mysterious `undefined`.
- Don't use context for fast-changing values (mouse position, typing) — that's what stores/`useSyncExternalStore` are for.

## `useReducer`

```tsx
type Action = { type: 'add'; item: Item } | { type: 'remove'; id: string };

function reducer(state: Item[], action: Action): Item[] {
  switch (action.type) {
    case 'add':    return [...state, action.item];
    case 'remove': return state.filter((i) => i.id !== action.id);
    default:       return state;
  }
}
const [items, dispatch] = useReducer(reducer, []);
```

A reducer is a **pure function** `(state, action) → state`. That makes the update logic **unit-testable without React**, centralises the rules, and gives you a serialisable log of "what happened". `dispatch` is **stable** for the component's life — safe to pass down or list as a dependency. Return the **same state object** when nothing changed, so React skips the render.

## Controlled vs. uncontrolled components

A form control is **controlled** when its owner passes `value` and handles `onChange`; **uncontrolled** when it manages its own state (`defaultValue`). Well-designed reusable components support **both** — that's how libraries like Radix and MUI work. The pattern is a `useControllableState` hook: use the prop if provided, otherwise internal state, and call `onChange` either way.

Rules of thumb: a component must not *switch* between the two modes during its life; treat `value === undefined` as "uncontrolled".

## Error boundaries

Rendering errors (a thrown exception in a component or hook) unmount the whole tree unless an **error boundary** catches them. Boundaries must be **class components** (`getDerivedStateFromError` + `componentDidCatch`) — libraries like `react-error-boundary` wrap that.

```tsx
<ErrorBoundary fallback={({ error, reset }) => <Oops error={error} onRetry={reset} />}>
  <Dashboard />
</ErrorBoundary>
```

They catch errors during **rendering, lifecycle methods and constructors** of their children. They do **not** catch: event handlers (use try/catch), async code (promises, timers), server rendering, and errors in the boundary itself. Place several boundaries at meaningful granularity (a route, a widget) so one broken panel doesn't take down the page. Provide a **reset** path — usually "retry", or auto-reset when a key (route, id) changes.

%% exercise arch-theme-context | Theme context | 2 | tsx | react | ThemeProvider, useTheme | 15
Build a theme context.

- `<ThemeProvider defaultTheme?>` (default `'light'`) provides `{ theme, setTheme, toggleTheme }` to descendants.
- `useTheme()` returns that value, and **throws** `useTheme must be used within a ThemeProvider` when used outside a provider.
- The context **value must be memoised**: a parent re-render that doesn't change the theme must not re-render `memo`ised consumers. `setTheme` and `toggleTheme` are stable functions.

%% starter
```tsx
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export function ThemeProvider({ children, defaultTheme = 'light' }: { children: ReactNode; defaultTheme?: Theme }) {
  return <>{children}</>;
}

export function useTheme(): ThemeValue {
  throw new Error('not implemented');
}
```

%% tests
```tsx
import { memo, useState } from 'react';

function Label() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>theme: {theme}</button>;
}

describe('ThemeProvider / useTheme', () => {
  it('provides the default theme', () => {
    render(<ThemeProvider><Label /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme: light');
  });

  it('honours defaultTheme', () => {
    render(<ThemeProvider defaultTheme="dark"><Label /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('theme: dark');
  });

  it('toggles for every consumer', async () => {
    function Other() { return <p>other: {useTheme().theme}</p>; }
    render(<ThemeProvider><Label /><Other /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('theme: dark');
    expect(screen.getByText('other: dark')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('other: light')).toBeInTheDocument();
  });

  it('exposes setTheme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    act(() => result.current.setTheme('dark'));
    expect(result.current.theme).toBe('dark');
  });

  it('throws a helpful error outside a provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const suppress = (e: Event) => e.preventDefault();
    window.addEventListener('error', suppress);
    expect(() => render(<Label />)).toThrow('useTheme must be used within a ThemeProvider');
    window.removeEventListener('error', suppress);
    spy.mockRestore();
  });

  it('gives setTheme and toggleTheme stable identities', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });
    const { setTheme, toggleTheme } = result.current;
    act(() => result.current.toggleTheme());
    expect(result.current.setTheme).toBe(setTheme);
    expect(result.current.toggleTheme).toBe(toggleTheme);
  });

  it('does not re-render consumers when only the provider’s parent re-renders', async () => {
    const renders = jest.fn();
    const Consumer = memo(function Consumer() {
      renders();
      return <p>{useTheme().theme}</p>;
    });
    function App() {
      const [n, setN] = useState(0);
      return (
        <ThemeProvider>
          <button onClick={() => setN(n + 1)}>rerender {n}</button>
          <Consumer />
        </ThemeProvider>
      );
    }
    render(<App />);
    expect(renders).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button'));
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('rerender 2');
    expect(renders).toHaveBeenCalledTimes(1);
  });
});
```

%% hints
- `createContext<ThemeValue | null>(null)` — `null` as the "no provider" sentinel.
- Provider: `useState` for the theme, `useCallback` for `toggleTheme` (functional update), and `useMemo` for the value with deps `[theme, toggleTheme]` (`setState` setters are already stable).
- `useTheme`: `const ctx = useContext(ThemeContext); if (!ctx) throw new Error(...)`.

%% solution
```tsx
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export interface ThemeValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children, defaultTheme = 'light' }: { children: ReactNode; defaultTheme?: Theme }) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);
  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

%% exercise arch-cart-reducer | Shopping cart reducer | 3 | tsx | react | cartReducer, cartTotal, Cart | 35
Model a shopping cart with a **pure reducer**, then use it in a component.

```ts
interface CartItem { id: string; name: string; price: number; qty: number }
type CartAction =
  | { type: 'add'; item: { id: string; name: string; price: number } }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'clear' };
```

**`cartReducer(state, action)`**
- `add`: append with `qty: 1`, or `qty + 1` if the id already exists (keep its position).
- `remove`: drop the item. `setQty`: set the quantity; `qty <= 0` removes the item.
- `clear`: empty list.
- **Never mutate.** If an action changes nothing (unknown id, same qty, clearing an empty cart, unknown action type), return the **same** state reference.

**`cartTotal(items)`** — sum of `price × qty`, computed in **cents** to avoid float error (`0.1 + 0.2`).

**`<Cart catalog />`** uses `useReducer`. It renders, per catalog product, an `Add <name>` button; a list of cart lines each with its name, quantity, `Increase <name>`, `Decrease <name>` and `Remove <name>` buttons; `Total: $12.34`; a `Clear cart` button; and `Your cart is empty` when there are no lines. Decreasing to 0 removes the line.

%% starter
```tsx
import { useReducer } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'qty'> }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'clear' };

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  return state;
}

export function cartTotal(items: CartItem[]): number {
  return 0;
}

export function Cart({ catalog }: { catalog: Omit<CartItem, 'qty'>[] }) {
  return null;
}
```

%% tests
```tsx
const apple = { id: 'a', name: 'Apple', price: 0.5 };
const pear = { id: 'p', name: 'Pear', price: 1.25 };
const freeze = (items: any[]) => Object.freeze(items.map((i) => Object.freeze({ ...i })));

describe('cartReducer', () => {
  it('adds a new item with qty 1', () => {
    expect(cartReducer([], { type: 'add', item: apple })).toEqual([{ ...apple, qty: 1 }]);
  });

  it('increments qty for an existing item, keeping its position', () => {
    const state = freeze([{ ...apple, qty: 1 }, { ...pear, qty: 1 }]) as any;
    const next = cartReducer(state, { type: 'add', item: apple });
    expect(next.map((i) => [i.id, i.qty])).toEqual([['a', 2], ['p', 1]]);
  });

  it('never mutates the previous state', () => {
    const state = freeze([{ ...apple, qty: 1 }]) as any;
    expect(() => {
      cartReducer(state, { type: 'add', item: apple });
      cartReducer(state, { type: 'setQty', id: 'a', qty: 5 });
      cartReducer(state, { type: 'remove', id: 'a' });
    }).not.toThrow();
    expect(state[0].qty).toBe(1);
  });

  it('removes an item', () => {
    const state = freeze([{ ...apple, qty: 2 }, { ...pear, qty: 1 }]) as any;
    expect(cartReducer(state, { type: 'remove', id: 'a' })).toEqual([{ ...pear, qty: 1 }]);
  });

  it('sets a quantity, removing the item at zero or below', () => {
    const state = freeze([{ ...apple, qty: 2 }]) as any;
    expect(cartReducer(state, { type: 'setQty', id: 'a', qty: 7 })[0].qty).toBe(7);
    expect(cartReducer(state, { type: 'setQty', id: 'a', qty: 0 })).toEqual([]);
    expect(cartReducer(state, { type: 'setQty', id: 'a', qty: -3 })).toEqual([]);
  });

  it('clears the cart', () => {
    expect(cartReducer(freeze([{ ...apple, qty: 2 }]) as any, { type: 'clear' })).toEqual([]);
  });

  it('returns the same reference when nothing changes', () => {
    const state = freeze([{ ...apple, qty: 2 }]) as any;
    expect(cartReducer(state, { type: 'remove', id: 'zzz' })).toBe(state);
    expect(cartReducer(state, { type: 'setQty', id: 'a', qty: 2 })).toBe(state);
    expect(cartReducer(state, { type: 'setQty', id: 'zzz', qty: 3 })).toBe(state);
    const empty: any[] = [];
    expect(cartReducer(empty, { type: 'clear' })).toBe(empty);
    expect(cartReducer(state, { type: 'bogus' } as any)).toBe(state);
  });

  it('keeps untouched items by reference', () => {
    const state = freeze([{ ...apple, qty: 1 }, { ...pear, qty: 1 }]) as any;
    const next = cartReducer(state, { type: 'setQty', id: 'a', qty: 3 });
    expect(next[1]).toBe(state[1]);
  });
});

describe('cartTotal', () => {
  it('sums price × qty', () => {
    expect(cartTotal([{ ...apple, qty: 3 }, { ...pear, qty: 2 }])).toBe(4);
  });
  it('avoids floating point error', () => {
    expect(cartTotal([{ id: 'x', name: 'x', price: 0.1, qty: 1 }, { id: 'y', name: 'y', price: 0.2, qty: 1 }])).toBe(0.3);
  });
  it('is 0 for an empty cart', () => expect(cartTotal([])).toBe(0));
});

describe('<Cart />', () => {
  const catalog = [apple, pear];

  it('starts empty', () => {
    render(<Cart catalog={catalog} />);
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByText('Total: $0.00')).toBeInTheDocument();
  });

  it('adds products and shows the total', async () => {
    render(<Cart catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Apple' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Apple' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Pear' }));
    expect(screen.getByText('Total: $2.25')).toBeInTheDocument();
    expect(screen.queryByText('Your cart is empty')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('increases and decreases quantities', async () => {
    render(<Cart catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Apple' }));
    await userEvent.click(screen.getByRole('button', { name: 'Increase Apple' }));
    expect(screen.getByText('Total: $1.00')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Apple' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Apple' }));
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('removes a line and clears the cart', async () => {
    render(<Cart catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Apple' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add Pear' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Apple' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Total: $1.25')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear cart' }));
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
  });

  it('shows the quantity of each line', async () => {
    render(<Cart catalog={catalog} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add Pear' }));
    await userEvent.click(screen.getByRole('button', { name: 'Increase Pear' }));
    expect(screen.getByRole('listitem')).toHaveTextContent('Pear');
    expect(screen.getByRole('listitem')).toHaveTextContent('2');
  });
});
```

%% hints
- Reducer skeleton: `switch (action.type)`; `default: return state`.
- `add`: `const i = state.findIndex((x) => x.id === id)`; if found, `state.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x))`, else `[...state, { ...item, qty: 1 }]`.
- "No change → same reference": check before creating a new array (`i === -1` → `return state`, `x.qty === qty` → `return state`, `state.length === 0` → `return state`).
- Total: `Math.round(price * 100) * qty` summed, then `/ 100`.
- Component: `const [items, dispatch] = useReducer(cartReducer, [])`, `total.toFixed(2)`.

%% solution
```tsx
import { useReducer } from 'react';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export type CartAction =
  | { type: 'add'; item: Omit<CartItem, 'qty'> }
  | { type: 'remove'; id: string }
  | { type: 'setQty'; id: string; qty: number }
  | { type: 'clear' };

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const i = state.findIndex((x) => x.id === action.item.id);
      if (i === -1) return [...state, { ...action.item, qty: 1 }];
      return state.map((x, j) => (j === i ? { ...x, qty: x.qty + 1 } : x));
    }
    case 'remove': {
      if (!state.some((x) => x.id === action.id)) return state;
      return state.filter((x) => x.id !== action.id);
    }
    case 'setQty': {
      const item = state.find((x) => x.id === action.id);
      if (!item || item.qty === action.qty) return state;
      if (action.qty <= 0) return state.filter((x) => x.id !== action.id);
      return state.map((x) => (x.id === action.id ? { ...x, qty: action.qty } : x));
    }
    case 'clear':
      return state.length === 0 ? state : [];
    default:
      return state;
  }
}

export function cartTotal(items: CartItem[]): number {
  return items.reduce((cents, i) => cents + Math.round(i.price * 100) * i.qty, 0) / 100;
}

export function Cart({ catalog }: { catalog: Omit<CartItem, 'qty'>[] }) {
  const [items, dispatch] = useReducer(cartReducer, []);
  return (
    <div>
      <div>
        {catalog.map((p) => (
          <button key={p.id} onClick={() => dispatch({ type: 'add', item: p })}>
            Add {p.name}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <p>Your cart is empty</p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.id}>
              <span>{i.name}</span> <span>{i.qty}</span>
              <button aria-label={`Increase ${i.name}`} onClick={() => dispatch({ type: 'setQty', id: i.id, qty: i.qty + 1 })}>+</button>
              <button aria-label={`Decrease ${i.name}`} onClick={() => dispatch({ type: 'setQty', id: i.id, qty: i.qty - 1 })}>−</button>
              <button aria-label={`Remove ${i.name}`} onClick={() => dispatch({ type: 'remove', id: i.id })}>×</button>
            </li>
          ))}
        </ul>
      )}
      <p>Total: ${cartTotal(items).toFixed(2)}</p>
      <button onClick={() => dispatch({ type: 'clear' })}>Clear cart</button>
    </div>
  );
}
```

%% exercise arch-controllable | Controlled or uncontrolled | 4 | tsx | react | useControllableState, Switch | 35
Library-quality components work **both** controlled and uncontrolled. Build the hook behind that, then a component on top of it.

**`useControllableState({ value, defaultValue, onChange })`** returns `[state, setState]`:
- **Controlled** when `value !== undefined`: `state` is always `value`; `setState(next)` does *not* store anything — it only calls `onChange(next)`.
- **Uncontrolled** otherwise: internal state starts at `defaultValue`; `setState` updates it **and** calls `onChange`.
- `setState` accepts a value or an updater `(prev) => next` (resolved against the *current* state). Two updaters in one tick chain correctly in uncontrolled mode.
- `onChange` is only called when the value **actually changes** (`Object.is`).
- `setState` is a **stable** function.

**`<Switch checked? defaultChecked? onCheckedChange? label />`** — a `<button role="switch">` with `aria-checked` and accessible name `label`; clicking toggles via the hook.

%% starter
```tsx
import { useCallback, useRef, useState } from 'react';

interface Options<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({ value, defaultValue, onChange }: Options<T>) {
  const state = defaultValue;
  const setState = (_next: T | ((prev: T) => T)) => {};
  return [state, setState] as const;
}

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, defaultChecked = false, onCheckedChange, label }: SwitchProps) {
  return null;
}
```

%% tests
```tsx
import { useState } from 'react';

describe('useControllableState', () => {
  it('uncontrolled: uses defaultValue, updates, and reports changes', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 1, onChange }));
    expect(result.current[0]).toBe(1);
    act(() => result.current[1](2));
    expect(result.current[0]).toBe(2);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('uncontrolled: supports updater functions, chained in one tick', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));
    act(() => {
      result.current[1]((n) => n + 1);
      result.current[1]((n) => n + 1);
    });
    expect(result.current[0]).toBe(2);
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([1, 2]);
  });

  it('controlled: always reflects value and never stores internally', () => {
    const onChange = jest.fn();
    const { result, rerender } = renderHook(({ value }) => useControllableState({ value, defaultValue: 0, onChange }), {
      initialProps: { value: 5 },
    });
    expect(result.current[0]).toBe(5);
    act(() => result.current[1](9));
    expect(onChange).toHaveBeenCalledWith(9);
    expect(result.current[0]).toBe(5);
    rerender({ value: 9 });
    expect(result.current[0]).toBe(9);
  });

  it('controlled: updater functions receive the controlled value', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useControllableState({ value: 10, defaultValue: 0, onChange }));
    act(() => result.current[1]((n) => n + 1));
    expect(onChange).toHaveBeenCalledWith(11);
  });

  it('treats an explicit falsy controlled value as controlled', () => {
    const { result } = renderHook(() => useControllableState({ value: 0, defaultValue: 99 }));
    expect(result.current[0]).toBe(0);
    const r2 = renderHook(() => useControllableState({ value: false, defaultValue: true }));
    expect(r2.result.current[0]).toBe(false);
  });

  it('does not call onChange when nothing changes', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 'a', onChange }));
    act(() => result.current[1]('a'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('works without onChange', () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: 1 }));
    expect(() => act(() => result.current[1](2))).not.toThrow();
    expect(result.current[0]).toBe(2);
  });

  it('returns a stable setter', () => {
    const { result, rerender } = renderHook(({ value }: { value?: number }) => useControllableState({ value, defaultValue: 0 }), {
      initialProps: { value: 1 as number | undefined },
    });
    const first = result.current[1];
    rerender({ value: 2 });
    expect(result.current[1]).toBe(first);
  });
});

describe('Switch', () => {
  const sw = () => screen.getByRole('switch', { name: 'Wi-Fi' });

  it('is uncontrolled by default and toggles', async () => {
    render(<Switch label="Wi-Fi" />);
    expect(sw()).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw());
    expect(sw()).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw());
    expect(sw()).toHaveAttribute('aria-checked', 'false');
  });

  it('respects defaultChecked and reports changes', async () => {
    const onCheckedChange = jest.fn();
    render(<Switch label="Wi-Fi" defaultChecked onCheckedChange={onCheckedChange} />);
    expect(sw()).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw());
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it('controlled: follows the prop, and stays put if the parent refuses', async () => {
    const onCheckedChange = jest.fn();
    render(<Switch label="Wi-Fi" checked={false} onCheckedChange={onCheckedChange} />);
    await userEvent.click(sw());
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(sw()).toHaveAttribute('aria-checked', 'false');
  });

  it('controlled by a parent that updates', async () => {
    function Parent() {
      const [on, setOn] = useState(false);
      return <><Switch label="Wi-Fi" checked={on} onCheckedChange={setOn} /><p>{on ? 'connected' : 'offline'}</p></>;
    }
    render(<Parent />);
    await userEvent.click(sw());
    expect(sw()).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('connected')).toBeInTheDocument();
  });
});
```

%% hints
- Refs give a stable setter that still sees fresh data: `currentRef`, `controlledRef`, `onChangeRef`, all reassigned during render.
- `const isControlled = value !== undefined;` `const current = isControlled ? value : internal;`
- In the setter: resolve `next` (function or value) against `currentRef.current`; if `Object.is(resolved, currentRef.current)` return; if uncontrolled, `setInternal(resolved)` **and** eagerly update `currentRef.current` so chained updaters see it; finally call `onChangeRef.current?.(resolved)`.
- `Switch`: `const [on, setOn] = useControllableState({ value: checked, defaultValue: defaultChecked, onChange: onCheckedChange })`, then `<button role="switch" aria-checked={on} aria-label={label} onClick={() => setOn((v) => !v)} />`.

%% solution
```tsx
import { useCallback, useRef, useState } from 'react';

interface Options<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>({ value, defaultValue, onChange }: Options<T>) {
  const [internal, setInternal] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? (value as T) : internal;

  const currentRef = useRef(current);
  currentRef.current = current;
  const controlledRef = useRef(isControlled);
  controlledRef.current = isControlled;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setState = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = next instanceof Function ? next(currentRef.current) : next;
    if (Object.is(resolved, currentRef.current)) return;
    if (!controlledRef.current) {
      currentRef.current = resolved;
      setInternal(resolved);
    }
    onChangeRef.current?.(resolved);
  }, []);

  return [current, setState] as const;
}

interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, defaultChecked = false, onCheckedChange, label }: SwitchProps) {
  const [on, setOn] = useControllableState({ value: checked, defaultValue: defaultChecked, onChange: onCheckedChange });
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => setOn((v) => !v)}>
      {on ? 'On' : 'Off'}
    </button>
  );
}
```

%% exercise arch-error-boundary | Error boundary | 3 | tsx | react | ErrorBoundary | 25
Build a reusable `<ErrorBoundary>` class component.

Props: `fallback` — a node **or** a function `({ error, reset }) => node`; `onError?(error, info)`; `resetKeys?: unknown[]`; `children`.

- Renders `children` normally. If a descendant throws while rendering, render the `fallback` instead.
- `onError` is called once per caught error with the error and React's `info` (`componentStack`).
- `reset()` (given to a function fallback) clears the error and tries rendering the children again.
- **Auto-reset:** while showing the fallback, if any value in `resetKeys` changes (compare by `Object.is`, element-wise), reset automatically.
- Errors thrown in **event handlers** are *not* caught by boundaries (that's React's rule; nothing to implement).

%% starter
```tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface FallbackArgs {
  error: Error;
  reset: () => void;
}

interface Props {
  fallback: ReactNode | ((args: FallbackArgs) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKeys?: unknown[];
  children?: ReactNode;
}

export class ErrorBoundary extends Component<Props> {
  render() {
    return this.props.children;
  }
}
```

%% tests
```tsx
import { useState } from 'react';

function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error('kaboom');
  return <p>all good</p>;
}

let restore: () => void;
beforeEach(() => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const suppress = (e: Event) => e.preventDefault();
  window.addEventListener('error', suppress);
  restore = () => { window.removeEventListener('error', suppress); spy.mockRestore(); };
});
afterEach(() => restore());

describe('ErrorBoundary', () => {
  it('renders children when nothing throws', () => {
    render(<ErrorBoundary fallback={<p>fallback</p>}><Bomb explode={false} /></ErrorBoundary>);
    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(screen.queryByText('fallback')).not.toBeInTheDocument();
  });

  it('renders a static fallback when a child throws', () => {
    render(<ErrorBoundary fallback={<p>fallback</p>}><Bomb explode /></ErrorBoundary>);
    expect(screen.getByText('fallback')).toBeInTheDocument();
    expect(screen.queryByText('all good')).not.toBeInTheDocument();
  });

  it('passes the error to a function fallback', () => {
    render(<ErrorBoundary fallback={({ error }) => <p>failed: {error.message}</p>}><Bomb explode /></ErrorBoundary>);
    expect(screen.getByText('failed: kaboom')).toBeInTheDocument();
  });

  it('calls onError once with the error and component stack', () => {
    const onError = jest.fn();
    render(<ErrorBoundary fallback="x" onError={onError}><Bomb explode /></ErrorBoundary>);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('kaboom');
    expect(typeof onError.mock.calls[0][1].componentStack).toBe('string');
  });

  it('only catches inside its subtree (siblings survive)', () => {
    render(
      <>
        <ErrorBoundary fallback={<p>widget broke</p>}><Bomb explode /></ErrorBoundary>
        <p>rest of page</p>
      </>,
    );
    expect(screen.getByText('widget broke')).toBeInTheDocument();
    expect(screen.getByText('rest of page')).toBeInTheDocument();
  });

  it('reset() retries rendering the children', async () => {
    function App() {
      const [explode, setExplode] = useState(true);
      return (
        <>
          <button onClick={() => setExplode(false)}>fix it</button>
          <ErrorBoundary fallback={({ reset }) => <button onClick={reset}>Retry</button>}>
            <Bomb explode={explode} />
          </ErrorBoundary>
        </>
      );
    }
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument(); // still broken → fallback again
    await userEvent.click(screen.getByRole('button', { name: 'fix it' }));
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('auto-resets when a resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary fallback={<p>fallback</p>} resetKeys={['/a']}><Bomb explode /></ErrorBoundary>,
    );
    expect(screen.getByText('fallback')).toBeInTheDocument();
    rerender(<ErrorBoundary fallback={<p>fallback</p>} resetKeys={['/a']}><Bomb explode={false} /></ErrorBoundary>);
    expect(screen.getByText('fallback')).toBeInTheDocument(); // same key → stays in error state
    rerender(<ErrorBoundary fallback={<p>fallback</p>} resetKeys={['/b']}><Bomb explode={false} /></ErrorBoundary>);
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('a new error after a reset is caught again', () => {
    const onError = jest.fn();
    const { rerender } = render(
      <ErrorBoundary fallback={<p>fallback</p>} onError={onError} resetKeys={[1]}><Bomb explode /></ErrorBoundary>,
    );
    rerender(<ErrorBoundary fallback={<p>fallback</p>} onError={onError} resetKeys={[2]}><Bomb explode /></ErrorBoundary>);
    expect(screen.getByText('fallback')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
```

%% hints
- Error boundaries need `static getDerivedStateFromError(error)` (return `{ error }`) and optionally `componentDidCatch(error, info)`.
- State: `{ error: Error | null }`. `render()`: if there's an error, render the fallback (call it if it's a function); otherwise `this.props.children`.
- `reset = () => this.setState({ error: null })` — define it as an arrow property so it keeps `this`.
- Auto-reset: in `componentDidUpdate(prevProps)`, if `this.state.error` is set and the `resetKeys` arrays differ element-wise, call `this.reset()`.

%% solution
```tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface FallbackArgs {
  error: Error;
  reset: () => void;
}

interface Props {
  fallback: ReactNode | ((args: FallbackArgs) => ReactNode);
  onError?: (error: Error, info: ErrorInfo) => void;
  resetKeys?: unknown[];
  children?: ReactNode;
}

interface State {
  error: Error | null;
}

const changed = (a: unknown[] = [], b: unknown[] = []) => a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && changed(prev.resetKeys, this.props.resetKeys)) this.reset();
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (error) {
      const { fallback } = this.props;
      return typeof fallback === 'function' ? fallback({ error, reset: this.reset }) : fallback;
    }
    return this.props.children;
  }
}
```
