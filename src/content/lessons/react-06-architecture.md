---
id: react-architecture
track: react
title: State architecture
summary: Decide where state should live, share it without passing props through every level, model complex updates with a reducer, and make components work controlled or uncontrolled — plus failing gracefully.
---

## The idea in one sentence

**Architecture** in React is mostly one question asked over and over: **"who owns this piece of state, and who needs to see it?"**

> **Analogy** Imagine a building. Some information is on a **sticky note on your own desk** (local state). Some is on a **whiteboard in the meeting room** two teams share (lifted state). Some is on the **company notice board** everyone can see but that rarely changes (context). And some lives in the **central database** with a proper front desk (an external store). You don't put the lunch order on the company notice board — and you don't keep the company holiday list on a sticky note.

## Choosing where state lives

Walk down this ladder and **stop at the first rung that fits**:

![Five rungs: local state, lift to a parent, useReducer, context, external store](fig:state-ladder "Most state belongs on rungs 1–2. Reach further down only when you feel a specific pain.")

1. **Local `useState`** — only this component cares.
2. **Lift to the closest common parent** — two siblings need it.
3. **`useReducer`** — many related fields, or transitions with rules ("can't check out an empty cart").
4. **Context** — many *distant* consumers, and it changes *infrequently* (theme, language, current user, feature flags).
5. **An external store** (Zustand, Redux, Jotai; TanStack Query for *server* data) — frequent updates, many subscribers, or state that must live outside the tree. Components subscribe to *slices* so only the ones affected re-render.

## Context, precisely

Context avoids **prop drilling** (passing a prop through five components that don't use it):

```tsx try
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const ThemeContext = createContext<{ theme: Theme; toggle: () => void } | null>(null);

function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const value = useMemo(
    () => ({ theme, toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')) }),
    [theme],                                   // ← the value only changes when `theme` does
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');   // a clear error beats a mysterious undefined
  return ctx;
}

function Badge() {
  const { theme, toggle } = useTheme();        // no props passed down through the layers!
  return <button onClick={toggle}>Theme: {theme}</button>;
}

function Layer({ children }: { children?: ReactNode }) { return <div style={{ paddingLeft: 12 }}>{children}</div>; }

export default function App() {
  return (
    <ThemeProvider>
      <Layer><Layer><Layer><Badge /></Layer></Layer></Layer>
    </ThemeProvider>
  );
}
```

Facts to remember:

- Every component that calls `useContext(X)` **re-renders whenever the provider's `value` changes** (by `Object.is`) — even if it only reads one field. A fresh `{…}` each render means every consumer re-renders on every provider render. So `useMemo` the value.
- `memo` does **not** protect a context consumer; it only guards against *prop* changes.
- **Split** contexts (state vs dispatch, or unrelated concerns) so something that changes often doesn't drag stable consumers along.
- Wrap the context in a **custom hook** that throws outside the provider (as above).
- Don't use context for **fast-changing** values (typing, mouse position) — stores and `useSyncExternalStore` are built for that.

![A fresh value object re-renders every consumer; a memoised value and split contexts only re-render those affected](fig:context-rerender "Context is a broadcast: anyone listening hears every change.")

## `useReducer`: rules in one place

When state has many fields or updates follow rules, put the rules into a **reducer**: a **pure function** `(state, action) → nextState`.

![The UI dispatches an action; the pure reducer computes the next state; React re-renders](fig:reducer-flow "An action describes WHAT happened; the reducer decides HOW the state changes.")

```stepper A cart reducer handling actions
code:
  function reducer(items, action) {
    switch (action.type) {
      case 'add':
        return [...items, { ...action.item, qty: 1 }];
      case 'remove':
        return items.filter((i) => i.id !== action.id);
      default:
        return items;
    }
  }
  dispatch({ type: 'add', item: { id: 'a', name: 'Tea' } });
  dispatch({ type: 'add', item: { id: 'b', name: 'Mug' } });
  dispatch({ type: 'remove', id: 'a' });
  dispatch({ type: 'refund' });
---
line: 11
say: The first `dispatch` sends an **action** — a plain object saying what happened. React calls `reducer(currentItems, action)`.
Action:
State after (items):
Same reference?:
---
line: 3-4
say: The `'add'` case returns a **new** array with the item appended (never `push`!).
Action: add Tea
State after (items): Tea
Same reference?: no — new array
---
line: 12
say: Another `add`. The reducer gets the *latest* state automatically.
Action: add Mug
State after (items): Tea | Mug
Same reference?: no — new array
---
line: 13
say: `remove` filters out the item with that id.
Action: remove a
State after (items): Mug
Same reference?: no — new array
---
line: 14
say: An action nobody handles hits the `default` branch, which returns the **same** `items`. React sees the identical reference, knows nothing changed, and **skips the re-render**.
Action: refund (unknown)
State after (items): Mug
Same reference?: yes — same array, no re-render
```

Why bother?

- The update rules are **unit-testable without React** (call `reducer(state, action)` and compare).
- All transitions live in **one place**, and actions are a readable log of "what happened".
- **`dispatch` has a stable identity** for the component's life, so it is safe to pass down or list in dependencies.
- Return the **same** state object when nothing changed.

## Controlled vs uncontrolled components

A form control is **controlled** when its owner passes `value` and handles `onChange`; **uncontrolled** when it keeps its own state (`defaultValue`). Good reusable components support **both**:

```tsx try
import { useState } from 'react';

function useControllableState<T>(value: T | undefined, defaultValue: T, onChange?: (v: T) => void) {
  const [inner, setInner] = useState(defaultValue);
  const isControlled = value !== undefined;         // the rule: value given → controlled
  const state = isControlled ? value : inner;
  const setState = (next: T) => {
    if (!isControlled) setInner(next);               // uncontrolled: we store it
    onChange?.(next);                                // both: tell the owner
  };
  return [state, setState] as const;
}

function Toggle({ checked, defaultChecked = false, onChange }: { checked?: boolean; defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  const [on, setOn] = useControllableState(checked, defaultChecked, onChange);
  return <button aria-pressed={on} onClick={() => setOn(!on)}>{on ? 'ON' : 'off'}</button>;
}

export default function App() {
  const [parent, setParent] = useState(false);
  return (
    <div style={{ fontFamily: 'system-ui', display: 'flex', gap: 8, alignItems: 'center' }}>
      <span>Uncontrolled:</span><Toggle />
      <span>Controlled by parent ({String(parent)}):</span><Toggle checked={parent} onChange={setParent} />
    </div>
  );
}
```

Rules of thumb: a component must not *switch* between the two modes during its life, and `value === undefined` means "uncontrolled". This is how Radix, MUI and friends work.

## Error boundaries: fail gracefully

If a component throws **while rendering**, the whole tree unmounts — unless an **error boundary** catches it.

![An error boundary shows a fallback for the broken part while the rest of the page keeps working](fig:error-boundary-tree "Put several boundaries at meaningful granularity (a route, a widget) so one broken panel doesn't take down the page.")

Boundaries must be **class components** (`getDerivedStateFromError` + `componentDidCatch`), or you use a library like `react-error-boundary` that wraps one:

```tsx
<ErrorBoundary fallback={({ error, reset }) => <Oops error={error} onRetry={reset} />}>
  <Dashboard />
</ErrorBoundary>
```

They catch errors during **rendering, lifecycle methods and constructors** of their children. They do **not** catch errors in **event handlers** (use `try/catch`), **async code** (promises, timers), server rendering, or in the boundary itself. Give users a **reset** path: a "Try again" button, or auto-reset when something changes (a route, an id).

## Common mistakes

1. **Putting everything in global state** "just in case" — start local, lift only when needed.
2. **A non-memoised context value** — every consumer re-renders on every provider render.
3. **One giant context** for unrelated things.
4. **Mutating state inside a reducer** (`state.push(...)`).
5. **Switching a component between controlled and uncontrolled.**
6. **Expecting an error boundary to catch errors in event handlers or promises.**

## Quick check

```check
Q: Two sibling components need the same piece of data. Which is the simplest correct place for the state?
A) A global store
B) localStorage
C) Context with a custom hook
D) Their closest common parent, passed down as props *
Why: Lifting state up is rung 2 of the ladder. Reach for context or a store only when props become painful or the data is needed far away.
---
Q: A context provider uses `value={{ user, theme }}` (a new object each render). What is the effect?
A) Nothing; objects are compared by content
B) Every consumer re-renders whenever the provider renders *
C) The context stops working
D) Only components that read `user` re-render
Why: Consumers re-render when the value's identity changes. A new object each render is always "different". Memoise it.
---
Q: What must a reducer be?
A) Async, so it can fetch data
B) A class
C) A pure function: same state and action in, same new state out, no mutation *
D) A component
Why: Purity makes reducers predictable and trivially unit-testable, and lets React skip renders when the same state is returned.
---
Q: A component is "controlled" when…
A) It has no state
B) The parent passes `value` and updates it through `onChange` *
C) It uses `useReducer`
D) It is wrapped in `memo`
Why: Controlled means the owner holds the truth. An uncontrolled component keeps its own state (`defaultValue`).
---
Q: An error is thrown inside an `onClick` handler. Does an error boundary catch it?
A) Yes, always
B) Only class component handlers
C) No — boundaries only catch render/lifecycle errors; use try/catch in handlers *
D) Only in development
Why: Event handlers run outside rendering. Wrap them in `try/catch` (and handle async errors explicitly).
```

## Recap

- **Choose state's home by the ladder**: local → lift → reducer → context → store. Stop at the first that fits.
- **Context** fixes prop drilling; **memoise its value**, split unrelated concerns, wrap it in a hook that throws when missing, and don't use it for fast-changing data.
- **`useReducer`** = pure `(state, action) → state`; testable, centralised, stable `dispatch`; return the same state when nothing changed.
- **Controlled vs uncontrolled**: support both; `value !== undefined` means controlled; call `onChange` either way.
- **Error boundaries** catch render/lifecycle errors, not handlers or async code; place several and provide a reset.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: a todo reducer | The cart reducer stepper: `switch` on `action.type`, return new arrays |
| Theme context | The context example: provider, `useMemo`, a hook that throws |
| Shopping cart reducer | The stepper + "return the same reference when nothing changes" |
| Controlled or uncontrolled | The `useControllableState` example |
| Error boundary | A class component with `getDerivedStateFromError` + `componentDidCatch`, and resetting |

%% exercise arch-guided-todos | Guided: a todo reducer | 1 | tsx | react | todoReducer | 8 | guided
Write a **pure reducer** `todoReducer(state, action)` for a todo list.

```ts
type Todo = { id: number; text: string; done: boolean };
type TodoAction =
  | { type: 'add'; id: number; text: string }
  | { type: 'toggle'; id: number };
```

- `add`: return a **new** array with the new todo appended (`done: false`).
- `toggle`: return a **new** array where the todo with that id has `done` flipped.
- Any other action: return the **same** `state` object.
- Never change the input.

%% worked
**A similar problem, solved: a counter reducer.**

```ts
type CounterAction = { type: 'inc' } | { type: 'dec' } | { type: 'set'; value: number };

function counterReducer(state: number, action: CounterAction): number {
  switch (action.type) {                 // ① decide by the action's `type`
    case 'inc': return state + 1;        // ② return the NEXT state — don't "change" anything
    case 'dec': return state - 1;
    case 'set': return action.value;     // ③ the action can carry data (the payload)
    default: return state;               // ④ unknown action: return the same state
  }
}

counterReducer(5, { type: 'inc' });      // 6
```

A reducer has one job: given the **current state** and an **action**, return the **next state**. No fetching, no mutation, no randomness. For lists, "next state" means a **new array** — `[...state, item]`, `state.map(...)`, `state.filter(...)` — never `push`.

%% explain
- **`add`** appends `{ id, text, done: false }` in a new array.
- **`toggle`** flips `done` on the matching todo only, without mutating the old one.
- **Unknown actions** return the exact same reference.
- **The input state is never changed** (the test checks it afterwards).

%% nudge
- Which array method returns a *new* array with one item replaced?
- What should the `default` branch return?

%% starter
```tsx
type Todo = { id: number; text: string; done: boolean };
type TodoAction = { type: 'add'; id: number; text: string } | { type: 'toggle'; id: number };

export function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  // Step 1 — switch on action.type
  // Step 2 — 'add':    return [...state, { id: action.id, text: action.text, done: false }]
  // Step 3 — 'toggle': return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t))
  // Step 4 — default:  return state
  return state;
}
```

%% tests
```tsx
describe('todoReducer', () => {
  const base = [{ id: 1, text: 'a', done: false }];

  it('adds a todo', () => {
    expect(todoReducer([], { type: 'add', id: 7, text: 'x' })).toEqual([{ id: 7, text: 'x', done: false }]);
  });

  it('toggles only the matching todo', () => {
    const state = [{ id: 1, text: 'a', done: false }, { id: 2, text: 'b', done: false }];
    const next = todoReducer(state, { type: 'toggle', id: 2 });
    expect(next).toEqual([{ id: 1, text: 'a', done: false }, { id: 2, text: 'b', done: true }]);
  });

  it('does not mutate the old state', () => {
    const snapshot = JSON.stringify(base);
    todoReducer(base, { type: 'add', id: 2, text: 'b' });
    todoReducer(base, { type: 'toggle', id: 1 });
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('returns the same reference for unknown actions', () => {
    expect(todoReducer(base, { type: 'nope' } as any)).toBe(base);
  });
});
```

%% hints
- Inside the `switch`, each `case` returns a value.
- For `toggle`: `state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t))`.

%% solution
```tsx
type Todo = { id: number; text: string; done: boolean };
type TodoAction = { type: 'add'; id: number; text: string } | { type: 'toggle'; id: number };

export function todoReducer(state: Todo[], action: TodoAction): Todo[] {
  switch (action.type) {
    case 'add':
      return [...state, { id: action.id, text: action.text, done: false }];
    case 'toggle':
      return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    default:
      return state;
  }
}
```

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

%% worked
**A similar problem, solved: a language context.**

```tsx
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Lang = 'en' | 'fr';
interface LangValue { lang: Lang; setLang: (l: Lang) => void }

const LangContext = createContext<LangValue | null>(null);          // ① `null` means "no provider above me"

export function LangProvider({ children, initial = 'en' }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const setLang = useCallback((l: Lang) => setLangState(l), []);    // ② stable function
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);   // ③ stable object: changes only when `lang` does
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within a LangProvider');   // ④ fail loudly and clearly
  return ctx;
}
```

The three stability rules (②, ③) are what the test checks: a parent re-render that doesn't change the language must not re-render **memoised consumers**. For the theme add `toggleTheme` (use the updater form so it's stable too).

%% explain
- **`<ThemeProvider defaultTheme?>`** (default `'light'`) provides `{ theme, setTheme, toggleTheme }`.
- **`useTheme()`** returns that value and **throws** `useTheme must be used within a ThemeProvider` outside a provider.
- **The value is memoised**; `setTheme` and `toggleTheme` are stable, so memoised consumers don't re-render when an unrelated parent re-renders.

%% nudge
- What should the context's default value be so you can detect "no provider"?
- Which hooks keep both the functions and the value object stable?

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

%% worked
**A similar problem, solved: a reducer for a tag list** — it shows the "return the same reference when nothing changes" rule.

```ts
type Action = { type: 'add'; tag: string } | { type: 'remove'; tag: string } | { type: 'clear' };

function tagsReducer(state: string[], action: Action): string[] {
  switch (action.type) {
    case 'add':
      if (state.includes(action.tag)) return state;                // ① nothing to change → SAME reference (React skips the render)
      return [...state, action.tag];
    case 'remove': {
      if (!state.includes(action.tag)) return state;               // ① again
      return state.filter((t) => t !== action.tag);
    }
    case 'clear':
      return state.length === 0 ? state : [];                      // ① clearing an empty list changes nothing
    default:
      return state;
  }
}
```

For the cart: `add` either bumps `qty` of an existing item **in place in the array order** (`map`) or appends `qty: 1`; `setQty` with `qty <= 0` removes; unchanged cases return `state`. **`cartTotal`**: add up `Math.round(price * 100) * qty` in **cents** and divide by 100 at the end — floating-point dollars (`0.1 + 0.2`) drift. The component just wires `useReducer(cartReducer, [])` to buttons and renders `Total: $${total.toFixed(2)}`.

%% explain
- **`add`**: append with `qty: 1`, or `qty + 1` if the id exists (same position).
- **`remove` / `setQty` / `clear`** as described; `qty <= 0` removes.
- **Never mutate**; if nothing changes (unknown id, same qty, clearing an empty cart, unknown action) return the **same** reference.
- **`cartTotal`** sums `price × qty` in cents (no float error).
- **`<Cart catalog />`** renders Add/Increase/Decrease/Remove buttons, `Total: $12.34`, `Clear cart`, and `Your cart is empty`.

%% nudge
- For each action, when is "nothing changed" — and what do you return then?
- Why is `0.1 + 0.2` a problem for money, and how does working in cents fix it?

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

%% worked
**A similar problem, solved: `useControlled(value, defaultValue)`** without `onChange` — the core decision.

```tsx
function useControlled<T>(value: T | undefined, defaultValue: T) {
  const [inner, setInner] = useState(defaultValue);
  const isControlled = value !== undefined;     // ① the ONE rule
  return [isControlled ? value : inner, setInner] as const;   // ② controlled: show the prop; uncontrolled: show our own state
}
```

What the exercise adds on top:

- **`setState` in controlled mode stores nothing** — it only calls `onChange(next)` (the owner decides).
- **Updater functions** `(prev) => next`: resolve them against the **current** state. In uncontrolled mode keep the latest value in a ref so two updaters in the same tick chain correctly.
- **Only call `onChange` when the value actually changes** (`Object.is(prev, next)` → do nothing).
- **Stable `setState`**: wrap it in `useCallback`, reading the latest value/onChange through refs.

`Switch` then is just a `<button role="switch" aria-checked={on} aria-label={label}>` whose `onClick` calls `setState(!on)`.

%% explain
- **Controlled** (`value !== undefined`): `state` is always `value`; `setState(next)` only calls `onChange(next)`.
- **Uncontrolled**: state starts at `defaultValue`; `setState` updates it **and** calls `onChange`.
- **Updaters** resolve against the current state; two in one tick chain (uncontrolled).
- **`onChange` fires only on real changes**; **`setState` is stable.**
- **`<Switch>`**: `<button role="switch">` with `aria-checked` and the accessible name `label`.

%% nudge
- Where do you read "the current value" when an updater function arrives: from the prop or from your own state?
- What makes `setState` keep the same identity even though `value` and `onChange` change?

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

%% worked
**A similar problem, solved: a minimal boundary with a fallback.**

```tsx
import { Component, type ReactNode } from 'react';

interface Props { fallback: ReactNode; children: ReactNode }
interface State { error: Error | null }

export class SimpleBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {     // ① React calls this when a child throws while rendering
    return { error };                                         //   → store the error in state, which triggers a re-render
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {   // ② a place for side effects: logging
    console.log('caught', error.message);
  }

  render() {
    return this.state.error ? this.props.fallback : this.props.children;   // ③ fallback if there is an error
  }
}
```

The exercise's extras: a **function fallback** (`fallback({ error, reset })`), `reset = () => this.setState({ error: null })`, calling `onError` **once per caught error**, and **auto-reset**: in `componentDidUpdate(prevProps)`, if an error is showing and any value in `resetKeys` differs from `prevProps.resetKeys` (compare `Object.is`, element by element), call `reset()`.

Why a class? Only class components can implement `getDerivedStateFromError` / `componentDidCatch` — there is no hook equivalent.

%% explain
- **Normal rendering** shows the children.
- **A child throws while rendering** → the `fallback` is shown (a node, or a function of `{ error, reset }`).
- **`onError(error, info)`** is called once per caught error.
- **`reset()`** clears the error and tries the children again.
- **`resetKeys`**: while the fallback is showing, changing any key (`Object.is`, element-wise) resets automatically.

%% nudge
- Which static method stores the error in state, and which lifecycle method is the right place to *log* it?
- When should you compare `resetKeys` — and only while what state is true?

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
