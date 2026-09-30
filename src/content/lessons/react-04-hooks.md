---
id: react-hooks
track: react
title: Writing custom hooks
summary: Extracting stateful logic, keeping identities stable, and testing hooks in isolation with renderHook.
---

## What a custom hook is

A custom hook is a function whose name starts with `use` and that calls other hooks. That's it. It lets you share **stateful logic** (not state — each caller gets its own copy) between components:

```tsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return [on, toggle] as const;
}
```

Two components calling `useToggle()` have **independent** state. Hooks are for reusing *logic*; to share *state*, lift it up or use context/a store.

## The rules (and why)

1. Call hooks **at the top level** — never in loops, conditions or nested functions.
2. Call them **only from components or other hooks**.

React identifies each hook by **call order** within a component. A conditional hook shifts the order between renders and the state gets attached to the wrong hook. The `use` prefix is what lets the linter check rule 2.

## Design for stable identities

Anything you return from a hook becomes a dependency in the caller's effects/memos. If you return a **new function or object every render**, callers' effects re-run every render.

- Wrap returned callbacks in `useCallback` (with functional `setState` so they don't need state in deps).
- Wrap returned objects in `useMemo` — or return a **tuple** of primitives/stable functions.
- Accept callbacks from callers, but store them in a **ref** ("latest ref") if the hook shouldn't re-subscribe whenever they change:

```tsx
function useEventListener(target, type, handler) {
  const saved = useRef(handler);
  useEffect(() => { saved.current = handler; });          // always the latest
  useEffect(() => {
    const listener = (e) => saved.current(e);
    target.addEventListener(type, listener);
    return () => target.removeEventListener(type, listener);
  }, [target, type]);                                      // no `handler` here
}
```

## Refs as instance variables

`useRef` gives you a mutable box that survives renders **without causing one** when written. Use it for: DOM nodes, timers/ids, the previous value, "latest" callbacks, and any value that shouldn't trigger a re-render. Don't read or write `ref.current` **during render** for anything that affects output (except lazy initialisation) — it isn't reactive.

```tsx
function usePrevious<T>(value: T) {
  const ref = useRef<T>();
  useEffect(() => { ref.current = value; });   // updated AFTER render
  return ref.current;                          // so this is last render's value
}
```

## Common hook shapes

- **State + persistence** (`useLocalStorage`): initialise lazily from storage, write on change, guard against `JSON.parse` errors and disabled storage, sync via the `storage` event.
- **Time** (`useDebounce`, `useInterval`): effect + cleanup; use functional updates or a ref for the callback.
- **Data** (`useFetch`): loading/error/data as one state machine, abort on change/unmount.
- **DOM** (`useOnClickOutside`, `useMediaQuery`): subscribe once, keep a latest-callback ref, clean up.

## Testing hooks

`renderHook(() => useX(args))` gives you `result.current` (the latest return value) and `rerender(newProps)` / `unmount()`. Wrap state changes that happen outside React's event system in `act`. For hooks that need DOM (refs, event targets), test them through a tiny component.

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
