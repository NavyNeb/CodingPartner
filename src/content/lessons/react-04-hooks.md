---
id: react-hooks
track: react
title: Writing custom hooks
summary: Package stateful logic into reusable hooks, keep what they return stable, and test them on their own with renderHook.
---

## The idea in one sentence

A **custom hook** is a function whose name starts with `use` and that calls other hooks — a way to **reuse stateful logic** between components.

> **Analogy** Think of a hook as a **recipe card** you can hand to any cook (component). The recipe (the logic) is shared; but each cook works in their **own kitchen** with their own ingredients (state). Two cooks following the same card don't share a bowl.

```tsx try
import { useCallback, useState } from 'react';

function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const;
}

function Switch({ label }: { label: string }) {
  const [on, toggle] = useToggle();
  return <button onClick={toggle}>{label}: {on ? 'ON' : 'off'}</button>;
}

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui', display: 'flex', gap: 8 }}>
      <Switch label="Wi-Fi" />
      <Switch label="Bluetooth" />
    </div>
  );
}
```

Click one switch: the other doesn't move. Both use `useToggle`, but each has its **own copy** of the state.

![Two components call the same hook and each gets independent state](fig:hook-sharing "Hooks share behaviour, not data. To share the value itself, lift state up or use context/a store.")

## The rules of hooks (and why)

1. Call hooks **at the top level** of the component — never inside loops, conditions or nested functions.
2. Call hooks **only from components or other hooks**.

React doesn't know your hooks' names. It identifies each one by **the order in which they are called** during a render. That's why the order must be identical every time:

![Hooks are matched to their saved state by call order; a conditional hook shifts the order and breaks the matching](fig:hook-order "If one hook is skipped on some renders, every hook after it reads the wrong slot.")

The `use` prefix isn't decoration — it's what lets the linter check rule 2.

## Design for stable identities

Whatever you **return** from a hook ends up in the caller's dependency arrays. If you return a **new function or object on every render**, the caller's effects re-run on every render.

- Wrap returned callbacks in `useCallback`, and use the **updater form** of `setState` so they don't need the state in their deps (see `toggle` above).
- Return a **tuple** of primitives and stable functions, or wrap returned objects in `useMemo`.
- Accept callbacks from the caller, but keep them in a **ref** ("latest ref") when the hook shouldn't re-subscribe every time the callback changes.

## Refs as instance variables

`useRef` gives you a **mutable box** (`{ current }`) that **survives renders** and **doesn't cause a render when you write to it**. Use it for:

- DOM nodes (`ref={inputRef}`), timer ids, the previous value, "latest callback" holders,
- any value that shouldn't trigger a re-render.

Don't read or write `ref.current` **during render** for anything that affects what's drawn (except one-time initialisation) — refs aren't reactive.

Here's the classic use: remembering **last render's value**. Step through it:

```tsx
function usePrevious<T>(value: T) {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; });   // runs AFTER the render
  return ref.current;                          // so this still holds the OLD value
}
```

```stepper How usePrevious returns last render's value
code:
  function usePrevious(value) {
    const ref = useRef();
    useEffect(() => { ref.current = value; });
    return ref.current;
  }
---
line: 4
say: **Render 1**, `value = 1`. We `return ref.current` — nothing has been stored yet, so it's `undefined`.
value (this render): 1
ref.current: (empty)
Returns: undefined
---
line: 3
say: After the render is on screen, the effect runs and stores `1` in the ref. It does **not** trigger another render.
ref.current: 1
---
line: 4
say: **Render 2**, `value = 5`. The `return` happens *before* this render's effect, so `ref.current` is still `1` — the previous value.
value (this render): 5
ref.current: 1
Returns: 1
---
line: 3
say: Now the effect updates the ref to `5`, ready for the next render.
ref.current: 5
---
line: 4
say: **Render 3** with the same `value = 5` (maybe because the parent re-rendered). The hook returns `5`: it is "the previous *render's* value", not "the previous *different* value".
value (this render): 5
ref.current: 5
Returns: 5
```

### The "latest ref" pattern

A common problem: a hook subscribes to something (a listener, an interval) and calls a callback from the caller. If the callback is in the effect's dependencies, every new callback re-subscribes. If it's left out, you call a **stale** one. Store it in a ref instead:

![Every render saves the newest handler in a ref; the listener is added once and always calls ref.current](fig:latest-ref "The subscription stays put; the callback it calls is always fresh.")

```tsx
function useEventListener(target: EventTarget, type: string, handler: (e: Event) => void) {
  const saved = useRef(handler);
  useEffect(() => { saved.current = handler; });          // always the newest
  useEffect(() => {
    const listener = (e: Event) => saved.current(e);
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
  }, [target, type]);                                      // no `handler` here
}
```

Try a hook that uses it, where the handler reads fresh state but we subscribe only once:

```tsx try
import { useEffect, useRef, useState } from 'react';

function useKey(key: string, handler: () => void) {
  const saved = useRef(handler);
  useEffect(() => { saved.current = handler; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === key) saved.current(); };
    document.addEventListener('keydown', onKey);
    console.log('subscribed (should print once)');
    return () => document.removeEventListener('keydown', onKey);
  }, [key]);
}

export default function App() {
  const [presses, setPresses] = useState(0);
  useKey('a', () => setPresses(presses + 1));   // a NEW function every render — and it's fine!
  return <p style={{ fontFamily: 'system-ui' }} tabIndex={0}>Click here, then press “a”: {presses}</p>;
}
```

## Common hook shapes

- **State + persistence** (`useLocalStorage`): read lazily, write on change, guard `JSON.parse` and disabled storage, sync via the `storage` event.
- **Time** (`useDebounce`, `useInterval`): an effect with a timer and cleanup; use updater functions or a ref for the callback.
- **Data** (`useFetch`): loading / error / data as one state machine; abort on change or unmount.
- **DOM** (`useOnClickOutside`, `useMediaQuery`): subscribe once, keep a latest-callback ref, clean up.

## Testing hooks

`renderHook(() => useX(args))` returns `result.current` (the latest return value), plus `rerender(newProps)` and `unmount()`. Wrap updates that happen outside React's event system in **`act`**. For hooks that need the DOM (refs, event targets), test them through a tiny component.

## Common mistakes

1. **Conditional hooks** (`if (x) useState()`), or hooks after an early `return`.
2. **Returning a new object/function each render**, making callers' effects re-run.
3. **Sharing a hook and expecting shared state.**
4. **Reading `ref.current` during render** to decide what to draw.
5. **Stale callbacks** in subscriptions (missing deps) — or re-subscribing constantly (handler in deps). The latest-ref pattern fixes both.
6. **Forgetting cleanup** inside the hook.

## Quick check

```check
Q: Why must hooks be called in the same order on every render?
A) JavaScript requires it
B) Hooks run faster that way
C) React matches each hook to its saved state by call order *
D) Hooks are sorted alphabetically
Why: React has no names for your hooks; it uses their position in the call sequence. A conditional hook shifts the positions and mixes up the state.
---
Q: Two components both call `useToggle()`. What is shared between them?
A) Only the code — each gets its own state *
B) The state value
C) Nothing, it's a compile error
D) The `toggle` function identity
Why: A custom hook reuses logic. Each call to `useState` inside creates separate state for that component instance.
---
Q: A hook returns `{ open, close }` as a **new object each render**. What problem can this cause?
A) The hook stops working
B) Callers that put that object in an effect's dependencies re-run the effect on every render *
C) Hooks can only return arrays
D) Nothing; objects are compared by content
Why: Dependencies are compared by identity (`Object.is`). A fresh object is always "different".
---
Q: What does writing to `ref.current` do?
A) Triggers a re-render
B) Updates the DOM
C) Changes the value silently, without triggering a render *
D) Throws in strict mode
Why: Refs are plain mutable boxes that survive renders. They're for values that shouldn't cause updates.
---
Q: In `usePrevious`, why is `ref.current = value` inside an effect and not in the body?
A) Effects run before render
B) So the `return ref.current` in the body still sees the old value, and the ref is updated after the render *
C) Because refs can't be written during render
D) To make it asynchronous
Why: The body runs first and returns the previous value; the effect then stores the current one for next time.
```

## Recap

- A **custom hook** = a `use…` function calling other hooks; it **shares logic, not state**.
- **Rules**: top level only; only from components/hooks — because React matches hooks **by call order**.
- Keep **returned identities stable**: `useCallback`, updater-form `setState`, tuples, `useMemo`.
- **Refs** are mutable boxes that don't trigger renders: DOM nodes, timer ids, previous value, **latest callback**.
- Test with **`renderHook`**, `rerender`, `unmount`, and **`act`**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: `useCounter` | The `useToggle` example: `useState` + `useCallback` with updater functions |
| `useToggle` | Same, plus ignoring a non-boolean argument |
| `usePrevious` | The stepper: ref written in an effect |
| `useOnClickOutside` | The latest-ref pattern + a document listener with cleanup |
| `useDebounce` | An effect with a timer and cleanup (from the effects lesson) |
| `useLocalStorage` | Lazy initial state, updater functions, `try/catch`, the `storage` event |
| `useFetch` | Effect + `AbortController` + a status state machine |

%% exercise hooks-guided-counter | Guided: useCounter | 1 | tsx | react | useCounter | 6 | guided
Write the custom hook `useCounter(initial = 0)` returning `{ count, increment, decrement, reset }`.

- `increment()` adds 1, `decrement()` subtracts 1.
- `reset()` goes back to `initial`.
- The three functions keep **the same identity** between renders (so callers can safely use them in effect dependencies).

%% worked
**A similar problem, solved: `useToggle`.**

```tsx
import { useCallback, useState } from 'react';

export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);                       // ① ordinary state inside a hook
  const toggle = useCallback(() => setOn((v) => !v), []);      // ② updater form → no `on` in deps → stable identity
  const reset = useCallback(() => setOn(initial), [initial]);  // ③ uses `initial`, so it IS a dependency
  return { on, toggle, reset };                                // ④ return what callers need
}
```

A custom hook is just a function. It can call `useState`, `useCallback`, `useEffect` … as if it were a component. **Tip:** if a callback only needs the *previous* state, use `setX((prev) => …)` — then it doesn't depend on the state and never changes identity.

%% explain
- **`count`** starts at `initial` (default 0).
- **`increment` / `decrement`** change it by 1; **`reset`** restores `initial`.
- **Stable functions**: the test checks that `increment` is the *same function* after a state change.

%% nudge
- Which form of the setter lets a callback avoid listing the state in its dependencies?
- Which functions depend on `initial`?

%% starter
```tsx
import { useCallback, useState } from 'react';

export function useCounter(initial = 0) {
  // Step 1 — keep the count in state:   const [count, setCount] = useState(initial);
  // Step 2 — wrap each action in useCallback, using the UPDATER form for +1 / -1:
  //          const increment = useCallback(() => setCount((c) => c + 1), []);
  // Step 3 — reset sets the count back to `initial` (list it as a dependency).
  // Step 4 — return { count, increment, decrement, reset }.
  return { count: 0, increment() {}, decrement() {}, reset() {} };
}
```

%% tests
```tsx
describe('useCounter', () => {
  it('starts at the initial value', () => {
    expect(renderHook(() => useCounter()).result.current.count).toBe(0);
    expect(renderHook(() => useCounter(5)).result.current.count).toBe(5);
  });

  it('increments and decrements', () => {
    const { result } = renderHook(() => useCounter());
    act(() => result.current.increment());
    act(() => result.current.increment());
    act(() => result.current.decrement());
    expect(result.current.count).toBe(1);
  });

  it('resets to the initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    act(() => result.current.increment());
    act(() => result.current.reset());
    expect(result.current.count).toBe(10);
  });

  it('keeps stable function identities', () => {
    const { result } = renderHook(() => useCounter());
    const { increment, decrement, reset } = result.current;
    act(() => result.current.increment());
    expect(result.current.increment).toBe(increment);
    expect(result.current.decrement).toBe(decrement);
    expect(result.current.reset).toBe(reset);
  });
});
```

%% hints
- `const increment = useCallback(() => setCount((c) => c + 1), []);`
- `const reset = useCallback(() => setCount(initial), [initial]);`

%% solution
```tsx
import { useCallback, useState } from 'react';

export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  const decrement = useCallback(() => setCount((c) => c - 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);
  return { count, increment, decrement, reset };
}
```

%% exercise hooks-use-toggle | useToggle | 1 | tsx | react | useToggle | 8
Write `useToggle(initial = false)` returning `[value, toggle, setValue]`.

- `toggle()` flips the value.
- `toggle(true)` / `toggle(false)` sets it explicitly. Any **non-boolean** argument (like the click event when you write `onClick={toggle}`) is ignored and just flips.
- `setValue` is the raw state setter.
- `toggle` must be **referentially stable** across renders and state changes.

%% starter
```tsx
import { useCallback, useState } from 'react';

export function useToggle(initial = false) {
  // return [value, toggle, setValue]
}
```

%% tests
```tsx
describe('useToggle', () => {
  it('starts with the initial value (default false)', () => {
    expect(renderHook(() => useToggle()).result.current[0]).toBe(false);
    expect(renderHook(() => useToggle(true)).result.current[0]).toBe(true);
  });

  it('toggles', () => {
    const { result } = renderHook(() => useToggle());
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
  });

  it('accepts an explicit boolean', () => {
    const { result } = renderHook(() => useToggle());
    act(() => result.current[1](true));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    act(() => result.current[1](false));
    expect(result.current[0]).toBe(false);
  });

  it('treats non-boolean arguments (e.g. click events) as a plain flip', () => {
    const { result } = renderHook(() => useToggle());
    act(() => result.current[1]({ type: 'click' } as any));
    expect(result.current[0]).toBe(true);
  });

  it('exposes the raw setter as the third item', () => {
    const { result } = renderHook(() => useToggle());
    act(() => result.current[2](true));
    expect(result.current[0]).toBe(true);
  });

  it('returns a stable toggle function', () => {
    const { result, rerender } = renderHook(() => useToggle());
    const first = result.current[1];
    rerender();
    act(() => first());
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it('works when wired to a button', async () => {
    function Demo() {
      const [on, toggle] = useToggle();
      return <button onClick={toggle}>{on ? 'ON' : 'OFF'}</button>;
    }
    render(<Demo />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('ON');
  });
});
```

%% worked
**A similar problem, solved: `useBoolean` with explicit on/off.**

```tsx
export function useBoolean(initial = false) {
  const [value, setValue] = useState(initial);
  const on = useCallback(() => setValue(true), []);
  const off = useCallback(() => setValue(false), []);
  const toggle = useCallback(() => setValue((v) => !v), []);   // ① updater form: stable identity, never stale
  return { value, on, off, toggle, setValue };
}
```

`useToggle` differs in one detail: **a single function** that can either flip or set. Decide by looking at the argument: `typeof next === 'boolean' ? setValue(next) : setValue((v) => !v)`. That's what makes `onClick={toggle}` work — the click event object is *not* a boolean, so it just flips.

Return a **tuple** (`[value, toggle, setValue] as const`) so callers can name the pieces themselves.

%% explain
- **Returns `[value, toggle, setValue]`**; `initial` defaults to `false`.
- **`toggle()`** flips; **`toggle(true)` / `toggle(false)`** sets explicitly.
- **Non-boolean arguments** (e.g. a click event) are ignored and just flip.
- **`setValue`** is the raw state setter.
- **`toggle` is referentially stable** across renders and state changes.

%% nudge
- How can `toggle` tell "a click event" from "an explicit true/false"?
- Which setter form lets `toggle` avoid depending on the current value?

%% hints
- `const toggle = useCallback((next?: unknown) => setValue((v) => (typeof next === 'boolean' ? next : !v)), []);`
- Empty deps are fine because you only use the functional form of the setter.
- Return `[value, toggle, setValue] as const`.

%% solution
```tsx
import { useCallback, useState } from 'react';

export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback((next?: unknown) => {
    setValue((v) => (typeof next === 'boolean' ? next : !v));
  }, []);
  return [value, toggle, setValue] as const;
}
```

%% exercise hooks-use-previous | usePrevious | 2 | tsx | react | usePrevious | 10
Write `usePrevious<T>(value: T): T | undefined` — the value from the **previous render**.

- On the first render it returns `undefined`.
- After a re-render it returns whatever `value` was in the render before.
- A re-render with the same value returns that same value (it's "previous render", not "previous *different* value").

%% starter
```tsx
import { useEffect, useRef } from 'react';

export function usePrevious<T>(value: T): T | undefined {
  return undefined;
}
```

%% tests
```tsx
describe('usePrevious', () => {
  it('returns undefined on the first render', () => {
    const { result } = renderHook(({ v }) => usePrevious(v), { initialProps: { v: 1 } });
    expect(result.current).toBeUndefined();
  });

  it('returns the previous render’s value', () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    expect(result.current).toBe(1);
    rerender({ v: 3 });
    expect(result.current).toBe(2);
  });

  it('returns the same value again when re-rendered without change', () => {
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    rerender({ v: 'b' });
    expect(result.current).toBe('b');
  });

  it('works with objects by reference', () => {
    const a = { id: 1 }, b = { id: 2 };
    const { result, rerender } = renderHook(({ v }) => usePrevious(v), { initialProps: { v: a } });
    rerender({ v: b });
    expect(result.current).toBe(a);
  });

  it('can be used to detect increases in a component', async () => {
    function Score({ value }: { value: number }) {
      const prev = usePrevious(value);
      const dir = prev === undefined ? 'same' : value > prev ? 'up' : value < prev ? 'down' : 'same';
      return <p>{dir}</p>;
    }
    const { rerender } = render(<Score value={1} />);
    expect(screen.getByText('same')).toBeInTheDocument();
    rerender(<Score value={5} />);
    expect(screen.getByText('up')).toBeInTheDocument();
    rerender(<Score value={2} />);
    expect(screen.getByText('down')).toBeInTheDocument();
  });
});
```

%% worked
**A similar problem, solved: `useRenderCount()`** — a value that survives renders without causing them.

```tsx
import { useRef } from 'react';

export function useRenderCount() {
  const count = useRef(0);        // ① a box that persists between renders
  count.current += 1;             // ② writing doesn't trigger a re-render (fine for a debug counter)
  return count.current;
}
```

`usePrevious` also uses a ref, but with one important difference: **when** you write to it. If you updated the ref *during* render you'd overwrite the old value before returning it. Write it in an **effect** (runs after the render), and **return `ref.current` in the body** (which still holds the last render's value) — exactly what the stepper in the lesson shows.

%% explain
- **First render** returns `undefined`.
- **After a re-render** it returns the value from the render before.
- **Same value again** returns that same value ("previous render", not "previous different value").

%% nudge
- When does the effect run relative to `return ref.current`?
- Why must the ref be written in an effect and not during render?

%% hints
- A ref holds the value between renders without causing a render.
- Update the ref in an **effect** (it runs after the render committed), and **return** `ref.current` during render — at that point it still holds the old value.

%% solution
```tsx
import { useEffect, useRef } from 'react';

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
```

%% exercise hooks-click-outside | useOnClickOutside | 2 | tsx | react | useOnClickOutside | 15
Write `useOnClickOutside(ref, handler)`.

- Calls `handler(event)` when a `mousedown` or `touchstart` happens **outside** the element in `ref`.
- Events inside the element (including its descendants) are ignored.
- Adds its `document` listeners **once** — passing a new `handler` on each render must **not** re-subscribe, yet the **latest** handler must be the one that runs.
- Removes the listeners on unmount.

%% starter
```tsx
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useOnClickOutside(ref: RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
  // your code
}
```

%% tests
```tsx
import { useRef } from 'react';

function Demo({ onOutside }: { onOutside: (e: Event) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, onOutside);
  return (
    <div>
      <div ref={ref}><button>inside</button></div>
      <button>outside</button>
    </div>
  );
}

describe('useOnClickOutside', () => {
  it('fires for mousedown outside', () => {
    const fn = jest.fn();
    render(<Demo onOutside={fn} />);
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fires for mousedown on the document body', () => {
    const fn = jest.fn();
    render(<Demo onOutside={fn} />);
    fireEvent.mouseDown(document.body);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ignores mousedown inside, including descendants', () => {
    const fn = jest.fn();
    render(<Demo onOutside={fn} />);
    fireEvent.mouseDown(screen.getByText('inside'));
    expect(fn).not.toHaveBeenCalled();
  });

  it('also handles touchstart', () => {
    const fn = jest.fn();
    render(<Demo onOutside={fn} />);
    fireEvent(screen.getByText('outside'), new Event('touchstart', { bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes the event to the handler', () => {
    const fn = jest.fn();
    render(<Demo onOutside={fn} />);
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(fn.mock.calls[0][0]).toBeInstanceOf(Event);
  });

  it('always calls the latest handler without re-subscribing', () => {
    const add = jest.spyOn(document, 'addEventListener');
    const remove = jest.spyOn(document, 'removeEventListener');
    const first = jest.fn(), second = jest.fn();
    const { rerender } = render(<Demo onOutside={first} />);
    rerender(<Demo onOutside={second} />);
    rerender(<Demo onOutside={second} />);
    fireEvent.mouseDown(document.body);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(add.mock.calls.filter((c) => c[0] === 'mousedown')).toHaveLength(1);
    expect(remove.mock.calls.filter((c) => c[0] === 'mousedown')).toHaveLength(0);
  });

  it('removes listeners on unmount', () => {
    const fn = jest.fn();
    const { unmount } = render(<Demo onOutside={fn} />);
    unmount();
    fireEvent.mouseDown(document.body);
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not crash when the ref is empty', () => {
    const fn = jest.fn();
    function Empty() {
      useOnClickOutside({ current: null }, fn);
      return null;
    }
    render(<Empty />);
    expect(() => fireEvent.mouseDown(document.body)).not.toThrow();
  });
});
```

%% worked
**A similar problem, solved: `useKey(key, handler)`** — a document listener with the latest-ref pattern.

```tsx
import { useEffect, useRef } from 'react';

export function useKey(key: string, handler: () => void) {
  const saved = useRef(handler);                          // ① holds the newest handler
  useEffect(() => { saved.current = handler; });          // ② updated after every render (no deps)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === key) saved.current(); };   // ③ always calls the LATEST
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);                  // ④ cleanup
  }, [key]);                                              // ⑤ `handler` is NOT a dependency → subscribed once
}
```

For `useOnClickOutside(ref, handler)`: the same structure with two events (`mousedown`, `touchstart`) and a check inside the listener: `if (!ref.current || ref.current.contains(event.target as Node)) return;` (inside clicks, and a missing element, are ignored). Remember to remove **both** listeners in the cleanup.

%% explain
- **`handler(event)` is called** for a `mousedown` or `touchstart` **outside** the element in `ref`.
- **Inside events** (including descendants) are ignored.
- **Subscribes once** on `document`: a new `handler` each render must not re-subscribe — yet the **latest** handler runs.
- **Cleanup** removes the listeners on unmount.

%% nudge
- Which method tells you whether a click was inside an element?
- How can the listener call the newest handler without depending on it?

%% hints
- Save the handler in a ref and refresh it every render: `const saved = useRef(handler); saved.current = handler;` (assigning in an effect works too).
- The subscription effect depends only on `[ref]`; its listener calls `saved.current(event)`.
- `ref.current?.contains(event.target as Node)` tells you whether the click was inside. If there's no element, do nothing.

%% solution
```tsx
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useOnClickOutside(ref: RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
  const saved = useRef(handler);
  useEffect(() => {
    saved.current = handler;
  });

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      saved.current(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref]);
}
```

%% exercise hooks-use-debounce | useDebounce | 2 | tsx | react | useDebounce | 12
Write `useDebounce<T>(value: T, delay: number): T`. It returns the **latest value that has stayed unchanged for `delay` ms**.

- The first render returns `value` immediately.
- A change shows up only after `delay` ms without further changes; rapid changes collapse to the last one.
- Timers are cleaned up (none left after unmount).

%% starter
```tsx
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  return value;
}
```

%% tests
```tsx
describe('useDebounce', () => {
  beforeEach(() => jest.useFakeTimers());
  const advance = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(({ v }) => useDebounce(v, 100), { initialProps: { v: 'a' } });
    expect(result.current).toBe('a');
  });

  it('updates only after the delay', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
    advance(99);
    expect(result.current).toBe('a');
    advance(1);
    expect(result.current).toBe('b');
  });

  it('collapses rapid changes to the last one', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), { initialProps: { v: 0 } });
    for (let i = 1; i <= 5; i++) { rerender({ v: i }); advance(50); }
    expect(result.current).toBe(0);
    advance(50);
    expect(result.current).toBe(5);
  });

  it('restarts the wait on each change', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 100), { initialProps: { v: 'a' } });
    rerender({ v: 'b' }); advance(80);
    rerender({ v: 'c' }); advance(80);
    expect(result.current).toBe('a');
    advance(20);
    expect(result.current).toBe('c');
  });

  it('works with objects and arrays', () => {
    const a = [1], b = [2];
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 10), { initialProps: { v: a } });
    rerender({ v: b });
    advance(10);
    expect(result.current).toBe(b);
  });

  it('clears its timer on unmount', () => {
    const { rerender, unmount } = renderHook(({ v }) => useDebounce(v, 100), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not keep a timer when nothing changed', () => {
    renderHook(() => useDebounce('same', 100));
    advance(1000);
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

%% worked
**A similar problem, solved: `useDelayedFlag(flag, ms)`** — turns `true` only after it has stayed `true` for `ms`.

```tsx
import { useEffect, useState } from 'react';

export function useDelayedFlag(flag: boolean, ms: number) {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    if (!flag) { setDelayed(false); return; }     // ① turning off is immediate
    const id = setTimeout(() => setDelayed(true), ms);   // ② turning on waits
    return () => clearTimeout(id);                // ③ a change within `ms` cancels the pending timer
  }, [flag, ms]);
  return delayed;
}
```

`useDebounce` is the general version: start a timer that copies the value into state after `delay`; **clean up** by clearing it, so a new value before the timer fires cancels the old one. Start the state with the **initial value** so the first render returns it immediately.

%% explain
- **First render** returns `value` immediately.
- **A change appears after `delay` ms** with no further changes; rapid changes collapse into the last one.
- **No timers left** after unmount.

%% nudge
- What should the effect's cleanup do with the pending timer?
- What should the state start as, so the first render isn't `undefined`?

%% hints
- `const [debounced, setDebounced] = useState(value);`
- Effect on `[value, delay]`: `const id = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(id);`
- The cleanup runs before the next effect and on unmount, which gives you the "restart" and the cleanup for free.
- If nothing has changed there's a pending timer anyway after mount — that's fine, but make sure the test "no timer left" still passes after time advances.

%% solution
```tsx
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

%% exercise hooks-use-local-storage | useLocalStorage | 3 | tsx | react | useLocalStorage | 30
Write `useLocalStorage<T>(key, initial)` returning `[value, setValue, remove]`.

- **Initial value:** read `localStorage[key]` and `JSON.parse` it. If it's missing or invalid JSON, use `initial` (which may be a value or a lazy function `() => T`). Reading happens once, lazily.
- `setValue(next)` accepts a value or an updater `(prev) => next`, updates state **and** writes `JSON.stringify(next)` to storage. Two updater calls in the same tick must both apply.
- `remove()` deletes the key and resets the state to the initial value.
- **Never crash** if storage throws (private mode, quota): state still updates.
- **Cross-tab sync:** when a `storage` event for this `key` arrives, update state (`newValue === null` → back to the initial value).
- `setValue` and `remove` are stable functions.

%% starter
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

export function useLocalStorage<T>(key: string, initial: T | (() => T)) {
  // return [value, setValue, remove] as const
}
```

%% tests
```tsx
const useIt = <T,>(key: string, initial: T | (() => T)) => renderHook(() => useLocalStorage<T>(key, initial));

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  it('falls back to the initial value', () => {
    expect(useIt('k', 'init').result.current[0]).toBe('init');
  });

  it('supports a lazy initial value called once', () => {
    const init = jest.fn(() => 42);
    const { rerender } = renderHook(() => useLocalStorage('k', init));
    rerender(); rerender();
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('reads an existing JSON value', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }));
    expect(useIt('k', { a: 0 }).result.current[0]).toEqual({ a: 1 });
  });

  it('ignores invalid JSON', () => {
    localStorage.setItem('k', '{not json');
    expect(useIt('k', 'safe').result.current[0]).toBe('safe');
  });

  it('writes to storage on set and updates state', () => {
    const { result } = useIt('k', 1);
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(localStorage.getItem('k')).toBe('5');
  });

  it('supports updater functions, even twice in one tick', () => {
    const { result } = useIt('count', 0);
    act(() => {
      result.current[1]((c) => c + 1);
      result.current[1]((c) => c + 1);
    });
    expect(result.current[0]).toBe(2);
    expect(localStorage.getItem('count')).toBe('2');
  });

  it('persists across mounts', () => {
    const first = useIt('k', 'a');
    act(() => first.result.current[1]('b'));
    first.unmount();
    expect(useIt('k', 'a').result.current[0]).toBe('b');
  });

  it('remove() deletes the key and resets to the initial value', () => {
    const { result } = useIt('k', 'init');
    act(() => result.current[1]('changed'));
    act(() => result.current[2]());
    expect(result.current[0]).toBe('init');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('survives storage that throws', () => {
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const { result } = useIt('k', 'fallback');
    expect(result.current[0]).toBe('fallback');
    act(() => result.current[1]('still works'));
    expect(result.current[0]).toBe('still works');
    set.mockRestore(); get.mockRestore();
  });

  it('syncs from storage events for the same key', () => {
    const { result } = useIt('k', 'a');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'k', newValue: JSON.stringify('from another tab') }));
    });
    expect(result.current[0]).toBe('from another tab');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: JSON.stringify('nope') }));
    });
    expect(result.current[0]).toBe('from another tab');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'k', newValue: null }));
    });
    expect(result.current[0]).toBe('a');
  });

  it('returns stable setter and remove functions', () => {
    const { result, rerender } = useIt('k', 0);
    const [, set, remove] = result.current;
    act(() => set(1));
    rerender();
    expect(result.current[1]).toBe(set);
    expect(result.current[2]).toBe(remove);
  });

  it('stops listening after unmount', () => {
    const remove = jest.spyOn(window, 'removeEventListener');
    const { unmount } = useIt('k', 0);
    unmount();
    expect(remove.mock.calls.some((c) => c[0] === 'storage')).toBe(true);
  });
});
```

%% worked
**A similar problem, solved: `useSessionFlag(key)`** — state that is read lazily from storage and saved on change, without ever crashing.

```tsx
import { useCallback, useState } from 'react';

export function useSessionFlag(key: string) {
  const [flag, setFlagState] = useState<boolean>(() => {     // ① lazy initialiser: runs ONCE, on the first render
    try { return sessionStorage.getItem(key) === '1'; }
    catch { return false; }                                   // ② storage can throw (private mode): fall back
  });

  const setFlag = useCallback((next: boolean) => {
    setFlagState(next);                                       // ③ state ALWAYS updates…
    try { sessionStorage.setItem(key, next ? '1' : '0'); } catch { /* ignore */ }   // ④ …persisting is best-effort
  }, [key]);

  return [flag, setFlag] as const;
}
```

Extra pieces for `useLocalStorage`: parse with `JSON.parse` inside the `try` (invalid JSON → `initial`); support **updater functions** by keeping the latest value in a ref (so two updates in the same tick both apply); a **`storage` event** listener (added in an effect, removed in cleanup) that reads `event.newValue` when `event.key === key` (`null` → back to the initial value); and stable `setValue`/`remove` with `useCallback`.

%% explain
- **Initial value**: read and `JSON.parse` the stored value once; missing/invalid → `initial` (a value or a lazy `() => T`).
- **`setValue(next)`** takes a value or updater, updates state **and** writes JSON; two updater calls in one tick both apply.
- **`remove()`** deletes the key and resets to the initial value.
- **Never crashes** if storage throws; state still updates.
- **Cross-tab sync** via the `storage` event; `null` → back to initial.
- **`setValue` and `remove` are stable.**

%% nudge
- Which state-initialiser form runs only once?
- If two `setValue((p) => p + 1)` calls happen together, where do you read the "previous" value from?

%% hints
- Helper `read(key, initial)` wraps `getItem` + `JSON.parse` in `try/catch`, falling back to the (possibly lazy) initial value.
- `useState(() => read(key, initial))` — lazy init runs once.
- Keep `valueRef.current` in sync with state and write to it *eagerly inside `setValue`*, so two updaters in one tick chain correctly. Don't write to storage from inside a `setState` updater (updaters must be pure).
- `useCallback(..., [key])` for stable functions; keep `initial` in a ref so `remove` doesn't depend on it.
- `storage` events fire on **other** tabs' `window`; listen with `window.addEventListener('storage', …)` in an effect.

%% solution
```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

function read<T>(key: string, initial: T | (() => T)): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    /* unavailable or invalid JSON: fall through */
  }
  return initial instanceof Function ? initial() : initial;
}

export function useLocalStorage<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const valueRef = useRef(value);
  valueRef.current = value;
  const initialRef = useRef(initial);
  initialRef.current = initial;

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = next instanceof Function ? next(valueRef.current) : next;
      valueRef.current = resolved;
      setValue(resolved);
      try {
        localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        /* quota exceeded / disabled */
      }
    },
    [key],
  );

  const remove = useCallback(() => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    const fallback = initialRef.current instanceof Function ? (initialRef.current as () => T)() : initialRef.current;
    valueRef.current = fallback;
    setValue(fallback);
  }, [key]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      let next: T;
      try {
        next = e.newValue === null ? read(key, initialRef.current) : (JSON.parse(e.newValue) as T);
      } catch {
        return;
      }
      valueRef.current = next;
      setValue(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [value, set, remove] as const;
}
```

%% exercise hooks-use-fetch | useFetch | 3 | tsx | react | useFetch | 35
Write `useFetch<T>(url)` returning `{ data, error, loading, refetch }`.

- Starts with `loading: true`, `data: undefined`, `error: undefined`.
- Calls `fetch(url, { signal })` and parses JSON. A non-OK response (`!res.ok`) sets `error` to an `Error` with message `HTTP <status>`; network failures set `error` too.
- When `url` changes: abort the previous request, reset to loading, fetch the new one. Late responses from an aborted request must never overwrite newer state.
- On unmount: abort the in-flight request; no state updates afterwards.
- `refetch()` re-runs the request for the current url (and sets `loading` again).
- An `AbortError` is **not** treated as an error.

%% starter
```tsx
import { useCallback, useEffect, useState } from 'react';

export function useFetch<T = unknown>(url: string) {
  // return { data, error, loading, refetch }
}
```

%% tests
```tsx
type Call = { url: string; signal: AbortSignal; resolve: (body: unknown, ok?: boolean, status?: number) => void; reject: (e: unknown) => void };
let calls: Call[] = [];
const realFetch = (globalThis as any).fetch;

function installFetch() {
  calls = [];
  (globalThis as any).fetch = jest.fn((url: string, init?: { signal: AbortSignal }) => {
    return new Promise((res, rej) => {
      const signal = init!.signal;
      const call: Call = {
        url, signal,
        resolve: (body, ok = true, status = 200) => res({ ok, status, json: async () => body }),
        reject: rej,
      };
      signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
      calls.push(call);
    });
  });
}

describe('useFetch', () => {
  beforeEach(installFetch);
  afterEach(() => { (globalThis as any).fetch = realFetch; });

  it('starts loading and fetches with an abort signal', () => {
    const { result } = renderHook(() => useFetch('/a'));
    expect(result.current).toMatchObject({ loading: true, data: undefined, error: undefined });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/a');
    expect(calls[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('exposes parsed JSON data', async () => {
    const { result } = renderHook(() => useFetch<{ n: number }>('/a'));
    await act(async () => { calls[0].resolve({ n: 1 }); });
    expect(result.current).toMatchObject({ loading: false, data: { n: 1 }, error: undefined });
  });

  it('turns non-OK responses into errors', async () => {
    const { result } = renderHook(() => useFetch('/missing'));
    await act(async () => { calls[0].resolve({}, false, 404); });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error!.message).toBe('HTTP 404');
    expect(result.current.data).toBeUndefined();
  });

  it('turns network failures into errors', async () => {
    const { result } = renderHook(() => useFetch('/a'));
    await act(async () => { calls[0].reject(new TypeError('Failed to fetch')); });
    expect(result.current.error!.message).toBe('Failed to fetch');
    expect(result.current.loading).toBe(false);
  });

  it('aborts the old request and loads the new url when it changes', async () => {
    const { result, rerender } = renderHook(({ u }) => useFetch<string>(u), { initialProps: { u: '/one' } });
    rerender({ u: '/two' });
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls).toHaveLength(2);
    expect(result.current.loading).toBe(true);
    await act(async () => { calls[1].resolve('two'); });
    expect(result.current.data).toBe('two');
  });

  it('does not treat the abort of a stale request as an error', async () => {
    const { result, rerender } = renderHook(({ u }) => useFetch<string>(u), { initialProps: { u: '/one' } });
    rerender({ u: '/two' });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.error).toBeUndefined();
  });

  it('ignores a late response from an aborted request', async () => {
    const { result, rerender } = renderHook(({ u }) => useFetch<string>(u), { initialProps: { u: '/one' } });
    rerender({ u: '/two' });
    await act(async () => { calls[1].resolve('two'); });
    await act(async () => { calls[0].resolve('one (late)'); });
    expect(result.current.data).toBe('two');
  });

  it('clears old data while a new url loads', async () => {
    const { result, rerender } = renderHook(({ u }) => useFetch<string>(u), { initialProps: { u: '/one' } });
    await act(async () => { calls[0].resolve('one'); });
    rerender({ u: '/two' });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('aborts on unmount and never updates afterwards', async () => {
    const errors = jest.spyOn(console, 'error');
    const { unmount } = renderHook(() => useFetch('/a'));
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
    await act(async () => { calls[0].resolve({ late: true }); });
    expect(errors).not.toHaveBeenCalled();
  });

  it('refetch re-runs the request', async () => {
    const { result } = renderHook(() => useFetch<number>('/a'));
    await act(async () => { calls[0].resolve(1); });
    act(() => { result.current.refetch(); });
    expect(result.current.loading).toBe(true);
    expect(calls).toHaveLength(2);
    await act(async () => { calls[1].resolve(2); });
    expect(result.current.data).toBe(2);
  });

  it('clears a previous error when refetching', async () => {
    const { result } = renderHook(() => useFetch('/a'));
    await act(async () => { calls[0].resolve({}, false, 500); });
    expect(result.current.error).toBeDefined();
    act(() => { result.current.refetch(); });
    expect(result.current.error).toBeUndefined();
    expect(result.current.loading).toBe(true);
  });

  it('returns a stable refetch function while the url is unchanged', async () => {
    const { result, rerender } = renderHook(() => useFetch('/a'));
    const first = result.current.refetch;
    await act(async () => { calls[0].resolve(1); });
    rerender();
    expect(result.current.refetch).toBe(first);
  });
});
```

%% worked
**A similar problem, solved: `useJson(url)`** — a status-based fetch hook with abort-on-change.

```tsx
import { useEffect, useState } from 'react';

type State<T> = { loading: boolean; data?: T; error?: Error };

export function useJson<T>(url: string) {
  const [state, setState] = useState<State<T>>({ loading: true });

  useEffect(() => {
    const controller = new AbortController();                   // ① one controller per request
    setState({ loading: true });                                // ② new url → back to loading (clears old data/error)
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);     // ③ fetch does NOT reject on 404/500
        return res.json();
      })
      .then((data) => setState({ loading: false, data }))
      .catch((error) => {
        if (error.name === 'AbortError') return;                // ④ an abort is expected — not an error
        setState({ loading: false, error });
      });
    return () => controller.abort();                            // ⑤ url changed or unmounted: cancel the request
  }, [url]);

  return state;
}
```

Because an aborted request can never call `setState` with its result (it rejects with `AbortError`, which we ignore), late responses can't overwrite newer state. For `refetch`, keep a counter in state and include it in the dependency array (bumping it re-runs the effect).

%% explain
- **Initial state**: `loading: true`, no data, no error.
- **Calls `fetch(url, { signal })`** and parses JSON; a non-OK response sets `error` to `Error('HTTP <status>')`; network failures set `error` too.
- **When `url` changes**: abort the old request, go back to loading, fetch the new one; late responses never overwrite newer state.
- **On unmount**: abort; no state updates afterwards.
- **`refetch()`** re-runs the request and sets loading again.
- **`AbortError` is not an error.**

%% nudge
- What is the cleanup's job when `url` changes or the component unmounts?
- How can `refetch` make the same effect run again without changing `url`?

%% hints
- One state object `{ data, error, loading }` avoids three setters drifting apart.
- Add an `attempt` counter to the effect's deps; `refetch = useCallback(() => setAttempt((a) => a + 1), [])`.
- Effect body: `const controller = new AbortController(); setState({ loading: true }); fetch(url, { signal: controller.signal }).then(...).catch(...); return () => controller.abort();`
- In `catch`, if `controller.signal.aborted` (or `err.name === 'AbortError'`) **return without setting state**.
- Also check `controller.signal.aborted` before setting data, in case the response resolved just before the abort.

%% solution
```tsx
import { useCallback, useEffect, useState } from 'react';

interface State<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
}

export function useFetch<T = unknown>(url: string) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: undefined, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: undefined, error: undefined, loading: true });

    (async () => {
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        if (!controller.signal.aborted) setState({ data, error: undefined, loading: false });
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === 'AbortError') return;
        setState({ data: undefined, error: err as Error, loading: false });
      }
    })();

    return () => controller.abort();
  }, [url, attempt]);

  const refetch = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, refetch };
}
```
