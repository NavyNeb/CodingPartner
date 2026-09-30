---
id: react-effects
track: react
title: Effects, cleanup & data fetching
summary: How to sync a component with the outside world (timers, events, network), how the dependency array and cleanup work, and when you don't need an effect at all.
---

## The idea in one sentence

An **effect** is where a component does something that **isn't rendering** — talking to the world outside React — **after** the screen has been updated.

> **Analogy** Rendering is **drawing a poster**: it should only depend on the information you were given. An effect is the **errand you run after the poster is hung**: change the shop's window sign, start a timer, subscribe to a newsletter. And good errands have an **undo**: when the poster is replaced or taken down, you cancel what you set up. That undo is called **cleanup**.

Rendering must stay **pure** (same props and state in → same JSX out). Anything else — a subscription, a timer, the document title, a WebSocket, a network request — goes in an effect:

```tsx
useEffect(() => {
  // runs AFTER the DOM is updated
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);    // cleanup: undo what we set up
}, [tick]);                          // re-run when `tick` changes
```

## A live example: the lifecycle in order

Press the buttons and **read the console panel** under the preview. It logs when the effect starts and when its cleanup runs:

```tsx try
import { useEffect, useState } from 'react';

function Watcher({ id }: { id: number }) {
  useEffect(() => {
    console.log('effect: start watching', id);
    return () => console.log('cleanup: stop watching', id);
  }, [id]);
  return <p style={{ fontFamily: 'system-ui' }}>Watching #{id}</p>;
}

export default function App() {
  const [id, setId] = useState(1);
  const [shown, setShown] = useState(true);
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <button onClick={() => setId((n) => n + 1)}>Change id</button>{' '}
      <button onClick={() => setShown((s) => !s)}>{shown ? 'Unmount' : 'Mount'}</button>
      {shown && <Watcher id={id} />}
    </div>
  );
}
```

Step through the same story:

```stepper Effect and cleanup, in order
code:
  function Watcher({ id }) {
    useEffect(() => {
      console.log('start', id);
      return () => console.log('stop', id);
    }, [id]);
    return <p>Watching #{id}</p>;
  }
---
line: 6
say: **Mount** with `id = 1`. React renders the component first. The effect has not run yet.
What React does: render (id = 1)
Console:
---
line: 2-3
say: The DOM is updated on screen. **Now** the effect runs and logs `start 1`.
What React does: commit → run effect
Console: start 1
---
line: 6
say: The parent changes `id` to `2`. React renders again with the new value, and updates the DOM. The old effect is **still in place**.
What React does: render (id = 2) → commit
---
line: 4
say: Before running the new effect, React runs the **cleanup of the previous one**: `stop 1`. (The cleanup still remembers `id = 1` — it's a closure from that render.)
What React does: cleanup of the effect from id = 1
Console: start 1 | stop 1
---
line: 3
say: Then the new effect runs: `start 2`.
What React does: run effect (id = 2)
Console: start 1 | stop 1 | start 2
---
line: 4
say: **Unmount:** the component disappears, and its last cleanup runs: `stop 2`. Nothing is left running.
What React does: unmount → cleanup
Console: start 1 | stop 1 | start 2 | stop 2
```

![The order of render, commit, cleanup and effect on mount, update and unmount](fig:effect-timeline "Cleanup of the OLD effect runs before the NEW effect. That's how you avoid leaking listeners and timers.")

> **Good to know** In development, `<StrictMode>` deliberately **mounts → unmounts → mounts again** a component to test that your effect and cleanup are a matched pair. If you see "start, stop, start" on first load, that's a *preview of what happens when users navigate away and back*, not a bug.

## The dependency array

The array lists every **reactive value** (props, state, and any function or object defined in the component) that the effect **reads**. React re-runs the effect when one of them changed (compared with `Object.is`).

![No array runs every render; empty runs once; with values runs on mount and when they change](fig:deps-array "Filled dot = the effect runs.")

| Deps | The effect runs |
| --- | --- |
| omitted | after **every** render |
| `[]` | once, after mount (cleanup on unmount) |
| `[a, b]` | after mount, and whenever `a` or `b` changed |

**Don't lie to the array.** If the effect uses a value but you leave it out, the effect keeps using the value from the render it was created in — a **stale closure**. The lint rule `react-hooks/exhaustive-deps` is right far more often than you are.

```tsx try
import { useEffect, useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      console.log('interval sees count =', count);   // `count` is captured from the render that created this effect
    }, 1000);
    return () => clearInterval(id);
  }, []);                                             // ← lying: we read `count` but didn't list it

  return <button onClick={() => setCount((c) => c + 1)}>count: {count}</button>;
}
```

Click a few times and watch the console: it keeps printing `0`. Change `[]` to `[count]` and run again: now the effect restarts whenever `count` changes (and the cleanup clears the old interval), so it prints the current value.

## Fetching data — and the race condition

Two requests can finish **out of order**. If the user clicks user 1 and then quickly user 2, the slow response for user 1 might arrive *after* user 2's and overwrite it. Try it: click **user 1** then immediately **user 2**. Watch what's displayed at the end — then tick the checkbox and repeat:

```tsx try
import { useEffect, useState } from 'react';

// Pretend network: user 1 is slow (800ms), user 2 is fast (100ms).
const fakeFetch = (id: number) =>
  new Promise<string>((resolve) => setTimeout(() => resolve(`User ${id}`), id === 1 ? 800 : 100));

function Profile({ id, guard }: { id: number; guard: boolean }) {
  const [text, setText] = useState('…');

  useEffect(() => {
    let ignore = false;                       // set to true by the cleanup
    fakeFetch(id).then((t) => {
      if (!guard || !ignore) setText(t);      // with the guard: drop answers nobody wants any more
    });
    return () => { ignore = true; };
  }, [id, guard]);

  return <p>Showing: <b>{text}</b></p>;
}

export default function App() {
  const [id, setId] = useState(2);
  const [guard, setGuard] = useState(false);
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <button onClick={() => setId(1)}>user 1 (slow)</button>{' '}
      <button onClick={() => setId(2)}>user 2 (fast)</button>{' '}
      <label><input type="checkbox" checked={guard} onChange={(e) => setGuard(e.target.checked)} /> ignore stale answers</label>
      <Profile id={id} guard={guard} />
    </div>
  );
}
```

![Two fetches finish out of order; the cleanup sets ignore so the late one is discarded](fig:effect-race "Cleanup says: whatever I started is no longer wanted.")

The pattern:

```tsx
useEffect(() => {
  let ignore = false;
  setState({ status: 'loading' });
  fetchUser(id)
    .then((user) => { if (!ignore) setState({ status: 'ok', user }); })
    .catch((error) => { if (!ignore) setState({ status: 'error', error }); });
  return () => { ignore = true; };
}, [id]);
```

Model async state as **one object with a status** (`idle | loading | ok | error`) — a *discriminated union* — rather than three booleans (`isLoading`, `isError`, `data`) that can disagree. In real apps reach for a data library (TanStack Query, SWR) — but you need to understand this to debug them.

## You might not need an effect

Effects are an escape hatch. Before writing one, ask:

- Can I **calculate it during render**? (`const fullName = first + ' ' + last` — no state, no effect.)
- Is it a **reaction to a user action**? Do it in the event handler.
- Am I **copying props into state** and syncing with an effect? Use the prop directly, or reset with a `key`.
- Do I need to **tell the parent** something changed? Call its callback in the same event handler.

```tsx
// ❌ an effect to "keep two states in sync": extra render + flicker
useEffect(() => { setFullName(first + ' ' + last); }, [first, last]);

// ✅ just calculate it
const fullName = first + ' ' + last;
```

**`useLayoutEffect`** runs after the DOM changes but **before the browser paints** — use it only to measure layout and adjust before the user sees a frame (tooltips, scroll restoration). Otherwise use `useEffect`.

## Testing effects

Wrap time travel and async work in `act` so React flushes effects and state: `act(() => jest.advanceTimersByTime(1000))`, `await act(async () => { … })`, or `await screen.findBy…` / `waitFor`. Test *observable outcomes* — the text on screen, the listener registered, timers left running — not "the effect ran".

## Common mistakes

1. **Lying in the dependency array** → stale values.
2. **Forgetting cleanup** → duplicate timers/listeners and memory leaks.
3. **No race protection** in fetch effects.
4. **An effect to derive state** (should be computed during render).
5. **Putting an object/function created each render in the deps** → the effect re-runs every time (memoise it or move it inside the effect).
6. **Making the effect callback itself `async`** — it must return either nothing or a cleanup function, not a promise. Define an async function *inside* and call it.

## Quick check

```check
Q: When does `useEffect(fn, [])` run `fn`?
A) After every render
B) Once after the first render (and its cleanup on unmount) *
C) Before the first render
D) Only when a prop changes
Why: An empty dependency array means "no reactive values to watch", so the effect runs once after mount.
---
Q: A dependency changes from A to B. In what order do things happen?
A) effect(B), then cleanup(A)
B) cleanup(A), then render
C) render(B), then effect(B) only — cleanup is for unmount
D) render(B), then cleanup(A), then effect(B) *
Why: React renders with the new value, commits, runs the old effect's cleanup, then runs the new effect.
---
Q: An effect reads `count` but the dependency array is `[]`. What happens?
A) The effect always sees the `count` from the render where it was created (a stale closure) *
B) React throws an error
C) `count` becomes global
D) The effect runs on every render
Why: The effect is only recreated when a dependency changes; with `[]` it keeps using its first render's values.
---
Q: You keep `fullName` in state and update it in an effect whenever `first` or `last` changes. What is the better approach?
A) Use `useLayoutEffect`
B) Add a third effect
C) Compute `fullName` during render; it doesn't need state or an effect *
D) Store it in `localStorage`
Why: Values that can be derived from props or state should be calculated while rendering. Effects for "syncing state" cause extra renders.
---
Q: Why is an `ignore` flag set in the cleanup of a fetch effect?
A) To make the request faster
B) To stop an old request's late response from overwriting newer data *
C) To cancel the network request itself
D) Because `fetch` requires it
Why: The flag doesn't cancel the request; it makes the stale response harmless. (`AbortController` can cancel the request too.)
```

## Recap

- **Effects** sync a component with the outside world **after** render; rendering stays pure.
- The effect can return a **cleanup**. Order on change: render → **cleanup(old)** → effect(new); on unmount: cleanup.
- **Dependencies**: omitted = every render, `[]` = once, `[a, b]` = when they change. **Never lie** — stale closures.
- **Fetching**: guard against races with an `ignore` flag or `AbortController`; model state as `idle | loading | ok | error`.
- **You might not need an effect**: derive during render, use event handlers, reset with `key`.
- Test outcomes with `act` / `waitFor`, not implementation.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: mount & unmount messages | The lifecycle example: an effect with `[]` and a cleanup |
| Document title | Effect + cleanup that restores the previous value; dependencies |
| Window width listener | Subscribing once, removing the listener in cleanup, reading initial state lazily |
| Stopwatch | `setInterval` with cleanup, and updater functions (so you don't need `count` in deps) |
| User profile with race-safe fetching | The race example, status as a union, retry |
| Debounced search box | Debounce as an effect (timer + cleanup) + race protection |

%% exercise react-guided-lifecycle | Guided: mount & unmount messages | 1 | tsx | react | Lifecycle | 6 | guided
Build `<Lifecycle onMount onUnmount />`. It renders nothing visible (`null`), but:

- calls `onMount()` **once**, after the component has mounted;
- calls `onUnmount()` **once**, when the component is removed;
- does **not** call them again when the parent re-renders.

%% worked
**A similar problem, solved: `<LogWhileMounted message />`** — logs a message when it appears and another when it disappears.

```tsx
import { useEffect } from 'react';

export function LogWhileMounted({ message }: { message: string }) {
  useEffect(() => {
    console.log('appeared:', message);                 // ① runs after the component is on screen
    return () => console.log('disappeared:', message); // ② the cleanup: runs on unmount
  }, []);                                              // ③ [] = "run once" (the effect watches nothing)
  return null;                                         // ④ nothing to draw
}
```

The effect function is the "**do this**"; the function it returns is the "**undo this**". With `[]`, React runs "do" once after mount and "undo" once on unmount — exactly the two calls you need here. (The linter will remind you that `message` is used inside but not listed; in this exercise the callbacks are expected to be called once, so `[]` is what the tests want.)

%% explain
- **`onMount`** is called once after the first render.
- **`onUnmount`** is called once when the component is removed.
- **Re-rendering** with the same props calls neither again.

%% nudge
- Which part of `useEffect` runs on unmount?
- What do you put in the dependency array to say "only once"?

%% starter
```tsx
import { useEffect } from 'react';

export function Lifecycle({ onMount, onUnmount }: { onMount: () => void; onUnmount: () => void }) {
  // Step 1 — call useEffect with an empty dependency array [].
  // Step 2 — inside it, call onMount().
  // Step 3 — return a cleanup function that calls onUnmount().
  return null;
}
```

%% tests
```tsx
describe('Lifecycle', () => {
  it('calls onMount once after mounting', () => {
    const onMount = jest.fn();
    render(<Lifecycle onMount={onMount} onUnmount={() => {}} />);
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it('does not call onUnmount while mounted', () => {
    const onUnmount = jest.fn();
    render(<Lifecycle onMount={() => {}} onUnmount={onUnmount} />);
    expect(onUnmount).not.toHaveBeenCalled();
  });

  it('calls onUnmount once when removed', () => {
    const onUnmount = jest.fn();
    const { unmount } = render(<Lifecycle onMount={() => {}} onUnmount={onUnmount} />);
    unmount();
    expect(onUnmount).toHaveBeenCalledTimes(1);
  });

  it('does not run again on re-render', () => {
    const onMount = jest.fn();
    const onUnmount = jest.fn();
    const { rerender } = render(<Lifecycle onMount={onMount} onUnmount={onUnmount} />);
    rerender(<Lifecycle onMount={onMount} onUnmount={onUnmount} />);
    expect(onMount).toHaveBeenCalledTimes(1);
    expect(onUnmount).not.toHaveBeenCalled();
  });
});
```

%% hints
- `useEffect(() => { onMount(); return () => onUnmount(); }, []);`

%% solution
```tsx
import { useEffect } from 'react';

export function Lifecycle({ onMount, onUnmount }: { onMount: () => void; onUnmount: () => void }) {
  useEffect(() => {
    onMount();
    return () => onUnmount();
  }, []);
  return null;
}
```

%% exercise react-page-title | Document title | 1 | tsx | react | PageTitle | 8
Build `<PageTitle title />` — it renders nothing but keeps `document.title` in sync.

- While mounted, `document.title` is `"<title> | App"`.
- It updates when `title` changes.
- On unmount the **previous** title is restored.

%% starter
```tsx
import { useEffect } from 'react';

export function PageTitle({ title }: { title: string }) {
  return null;
}
```

%% tests
```tsx
describe('PageTitle', () => {
  beforeEach(() => { document.title = 'Original'; });

  it('sets the document title', () => {
    render(<PageTitle title="Inbox" />);
    expect(document.title).toBe('Inbox | App');
  });

  it('renders no DOM of its own', () => {
    const { container } = render(<PageTitle title="Inbox" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('updates when the title prop changes', () => {
    const { rerender } = render(<PageTitle title="Inbox" />);
    rerender(<PageTitle title="Sent" />);
    expect(document.title).toBe('Sent | App');
  });

  it('restores the previous title on unmount', () => {
    const { unmount } = render(<PageTitle title="Inbox" />);
    unmount();
    expect(document.title).toBe('Original');
  });

  it('restores the right title after several changes', () => {
    const { rerender, unmount } = render(<PageTitle title="A" />);
    rerender(<PageTitle title="B" />);
    rerender(<PageTitle title="C" />);
    unmount();
    expect(document.title).toBe('Original');
  });
});
```

%% worked
**A similar problem, solved: `<BodyClass name />`** — adds a CSS class to `<body>` while mounted, and removes it afterwards.

```tsx
import { useEffect } from 'react';

export function BodyClass({ name }: { name: string }) {
  useEffect(() => {
    document.body.classList.add(name);             // ① set up: change something OUTSIDE React
    return () => document.body.classList.remove(name);   // ② undo it exactly
  }, [name]);                                      // ③ re-run (undo old, apply new) when `name` changes
  return null;
}
```

For the title, the "undo" is **restore the previous value**: save it before you overwrite it (`const previous = document.title;`), and in the cleanup put `document.title = previous` back. Saving inside the effect means each run remembers what *it* replaced.

%% explain
- **While mounted**, `document.title` is `"<title> | App"`.
- **It updates** when the `title` prop changes.
- **On unmount** the previous title is restored.

%% nudge
- Where should you save the old title so the cleanup can put it back?
- Which value belongs in the dependency array?

%% hints
- Effect with `[title]` as its dependency.
- Read `document.title` **inside** the effect (before overwriting) and restore it in the cleanup.

%% solution
```tsx
import { useEffect } from 'react';

export function PageTitle({ title }: { title: string }) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | App`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return null;
}
```

%% exercise react-window-size | Window width listener | 2 | tsx | react | WindowSize | 12
Build `<WindowSize />` that renders `<p>Width: {n}</p>` where `n` is `window.innerWidth`, updating live on the window's `resize` event.

- Read the initial width without a flash (i.e. the first render already shows it).
- Subscribe **once** (not on every render) and **remove the listener on unmount**.

%% starter
```tsx
import { useEffect, useState } from 'react';

export function WindowSize() {
  return null;
}
```

%% tests
```tsx
const setWidth = (w: number) => { (window as any).innerWidth = w; };
const resize = () => act(() => { window.dispatchEvent(new Event('resize')); });

describe('WindowSize', () => {
  beforeEach(() => setWidth(1024));

  it('shows the initial width on the first render', () => {
    setWidth(777);
    render(<WindowSize />);
    expect(screen.getByText('Width: 777')).toBeInTheDocument();
  });

  it('updates on resize', () => {
    render(<WindowSize />);
    setWidth(500);
    resize();
    expect(screen.getByText('Width: 500')).toBeInTheDocument();
    setWidth(320);
    resize();
    expect(screen.getByText('Width: 320')).toBeInTheDocument();
  });

  it('adds exactly one resize listener and keeps it across re-renders', () => {
    const add = jest.spyOn(window, 'addEventListener');
    const { rerender } = render(<WindowSize />);
    rerender(<WindowSize />);
    setWidth(400);
    resize();
    rerender(<WindowSize />);
    const resizeAdds = add.mock.calls.filter((c) => c[0] === 'resize');
    expect(resizeAdds).toHaveLength(1);
  });

  it('removes the same listener on unmount', () => {
    const add = jest.spyOn(window, 'addEventListener');
    const remove = jest.spyOn(window, 'removeEventListener');
    const { unmount } = render(<WindowSize />);
    const handler = add.mock.calls.find((c) => c[0] === 'resize')![1];
    unmount();
    expect(remove).toHaveBeenCalledWith('resize', handler);
  });

  it('does not react to resizes after unmount', () => {
    const errors = jest.spyOn(console, 'error');
    const { unmount } = render(<WindowSize />);
    unmount();
    setWidth(200);
    resize();
    expect(errors).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: `<OnlineStatus />`** — shows whether the browser is online, updating live.

```tsx
import { useEffect, useState } from 'react';

export function OnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);   // ① lazy initial state: read the real value on the FIRST render (no flash)

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);            // ② subscribe once…
    window.addEventListener('offline', off);
    return () => {                                    // ③ …and unsubscribe in cleanup
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);                                             // ④ [] — nothing reactive is read inside

  return <p>{online ? 'Online' : 'Offline'}</p>;
}
```

For the window width the same three ideas apply: `useState(() => window.innerWidth)` for the first render, one `resize` listener added in an effect, removed in the cleanup.

%% explain
- **Renders `Width: <n>`** with the real `window.innerWidth` already in the first render.
- **Updates live** on `resize` events.
- **Subscribes once** (not on every render).
- **Removes the listener on unmount.**

%% nudge
- How can the very first render already show the real width (no flash of `0`)?
- What must the cleanup remove, and is it *the same function* you added?

%% hints
- Lazy initial state: `useState(() => window.innerWidth)` — no effect needed for the first value.
- Effect with `[]`: `addEventListener('resize', handler)` and return a cleanup that removes **the same function**.
- `handler` should be defined inside the effect (so the cleanup closes over it).

%% solution
```tsx
import { useEffect, useState } from 'react';

export function WindowSize() {
  const [width, setWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return <p>Width: {width}</p>;
}
```

%% exercise react-stopwatch | Stopwatch | 2 | tsx | react | Stopwatch | 15
Build `<Stopwatch />`.

- Shows `Elapsed: <n>s` (starts at 0).
- One button toggles between **Start** and **Stop**. While running, the value increments every second.
- Stopping **pauses** (keeps the value); starting again **resumes** from it.
- **Reset** sets the value back to 0 and stops.
- There must never be more than one interval running, and none once stopped or unmounted.

%% starter
```tsx
import { useEffect, useState } from 'react';

export function Stopwatch() {
  return null;
}
```

%% tests
```tsx
const tick = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

describe('Stopwatch', () => {
  beforeEach(() => jest.useFakeTimers());

  it('starts at 0 and stopped', () => {
    render(<Stopwatch />);
    expect(screen.getByText('Elapsed: 0s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    tick(5000);
    expect(screen.getByText('Elapsed: 0s')).toBeInTheDocument();
  });

  it('counts seconds while running', async () => {
    render(<Stopwatch />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    tick(3000);
    expect(screen.getByText('Elapsed: 3s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
  });

  it('pauses on Stop and resumes from the same value', async () => {
    render(<Stopwatch />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    tick(3000);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    tick(10000);
    expect(screen.getByText('Elapsed: 3s')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    tick(2000);
    expect(screen.getByText('Elapsed: 5s')).toBeInTheDocument();
  });

  it('Reset zeroes the value and stops', async () => {
    render(<Stopwatch />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    tick(4000);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('Elapsed: 0s')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    tick(3000);
    expect(screen.getByText('Elapsed: 0s')).toBeInTheDocument();
  });

  it('never runs more than one interval', async () => {
    render(<Stopwatch />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    tick(1000);
    expect(screen.getByText('Elapsed: 1s')).toBeInTheDocument();
    expect(jest.getTimerCount()).toBe(1);
  });

  it('leaves no timers behind when stopped or unmounted', async () => {
    const { unmount } = render(<Stopwatch />);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(jest.getTimerCount()).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(jest.getTimerCount()).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

%% worked
**A similar problem, solved: `<Countdown from />`** — counts down once per second while running, and stops at 0.

```tsx
import { useEffect, useState } from 'react';

export function Countdown({ from }: { from: number }) {
  const [left, setLeft] = useState(from);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;                                // ① not running → no interval (and no cleanup needed)
    const id = setInterval(() => setLeft((n) => n - 1), 1000);   // ② updater form: no need to list `left` in deps
    return () => clearInterval(id);                      // ③ stopping or unmounting clears it
  }, [running]);                                         // ④ re-run exactly when running flips

  return (
    <div>
      <p>Left: {left}s</p>
      <button onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Start'}</button>
    </div>
  );
}
```

Why `setLeft((n) => n - 1)` and not `setLeft(left - 1)`? The second would read `left` from the render that created the interval (stale), *and* force `left` into the dependency array, restarting the interval every second. The updater form removes both problems. For the stopwatch, count **up**, and add **Reset** (`setValue(0); setRunning(false)`).

%% explain
- **Shows `Elapsed: <n>s`**, starting at 0.
- **One button** toggles **Start** / **Stop**; while running, it adds 1 each second.
- **Stopping pauses** (keeps the value); **starting again resumes**.
- **Reset** sets the value to 0 and stops.
- **Never more than one interval**, and none when stopped or unmounted (the tests check for leftover timers).

%% nudge
- Which state decides whether an interval should exist?
- Why is `setValue((v) => v + 1)` better than `setValue(value + 1)` inside the interval?

%% hints
- State: `seconds` and `running`.
- Effect depends on `[running]`: `if (!running) return;` else start `setInterval` and return a cleanup that clears it.
- Inside the interval use the **updater form** `setSeconds((s) => s + 1)` so the callback never goes stale — and the effect doesn't need `seconds` in its deps.

%% solution
```tsx
import { useEffect, useState } from 'react';

export function Stopwatch() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div>
      <p>Elapsed: {seconds}s</p>
      <button onClick={() => setRunning((r) => !r)}>{running ? 'Stop' : 'Start'}</button>
      <button
        onClick={() => {
          setRunning(false);
          setSeconds(0);
        }}
      >
        Reset
      </button>
    </div>
  );
}
```

%% exercise react-user-profile | User profile with race-safe fetching | 3 | tsx | react | UserProfile | 30
Build `<UserProfile userId fetchUser />` where `fetchUser(id)` returns `Promise<{ id: number; name: string; email: string }>`.

- While loading, show `Loading…` (`role="status"`).
- On success, show the name in a heading and the email in a paragraph.
- On failure, show an alert `Could not load user` and a **Retry** button that fetches again (showing `Loading…` in between).
- When `userId` changes, fetch the new user and show `Loading…` again.
- **Race safety:** if responses arrive out of order, only the response for the **current** `userId` may be displayed. A response that arrives after unmount must not cause updates.
- `fetchUser` is called once per `userId` (and once more per retry).

%% starter
```tsx
import { useEffect, useState } from 'react';

export interface User {
  id: number;
  name: string;
  email: string;
}

interface Props {
  userId: number;
  fetchUser: (id: number) => Promise<User>;
}

export function UserProfile({ userId, fetchUser }: Props) {
  return null;
}
```

%% tests
```tsx
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const ada = { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' };
const grace = { id: 2, name: 'Grace Hopper', email: 'grace@example.com' };

describe('UserProfile', () => {
  it('shows a loading state, then the user', async () => {
    const d = deferred<typeof ada>();
    render(<UserProfile userId={1} fetchUser={() => d.promise} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    await act(async () => { d.resolve(ada); });
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('calls fetchUser with the id, once', async () => {
    const fetchUser = jest.fn(() => Promise.resolve(ada));
    render(<UserProfile userId={1} fetchUser={fetchUser} />);
    await screen.findByRole('heading');
    expect(fetchUser).toHaveBeenCalledTimes(1);
    expect(fetchUser).toHaveBeenCalledWith(1);
  });

  it('shows an alert on failure, and Retry fetches again', async () => {
    const first = deferred<typeof ada>();
    const second = deferred<typeof ada>();
    const fetchUser = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<UserProfile userId={1} fetchUser={fetchUser} />);
    await act(async () => { first.reject(new Error('boom')); });
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load user');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => { second.resolve(ada); });
    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(fetchUser).toHaveBeenCalledTimes(2);
  });

  it('refetches and shows loading when userId changes', async () => {
    const d1 = deferred<typeof ada>(), d2 = deferred<typeof grace>();
    const fetchUser = jest.fn((id: number) => (id === 1 ? d1.promise : d2.promise)) as any;
    const { rerender } = render(<UserProfile userId={1} fetchUser={fetchUser} />);
    await act(async () => { d1.resolve(ada); });
    rerender(<UserProfile userId={2} fetchUser={fetchUser} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    await act(async () => { d2.resolve(grace); });
    expect(screen.getByRole('heading', { name: 'Grace Hopper' })).toBeInTheDocument();
  });

  it('ignores a slow response for a previous id (race condition)', async () => {
    const slow = deferred<typeof ada>(), fast = deferred<typeof grace>();
    const fetchUser = jest.fn((id: number) => (id === 1 ? slow.promise : fast.promise)) as any;
    const { rerender } = render(<UserProfile userId={1} fetchUser={fetchUser} />);
    rerender(<UserProfile userId={2} fetchUser={fetchUser} />);
    await act(async () => { fast.resolve(grace); });
    await act(async () => { slow.resolve(ada); });
    expect(screen.getByRole('heading', { name: 'Grace Hopper' })).toBeInTheDocument();
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });

  it('ignores a stale failure too', async () => {
    const slow = deferred<typeof ada>(), fast = deferred<typeof grace>();
    const fetchUser = jest.fn((id: number) => (id === 1 ? slow.promise : fast.promise)) as any;
    const { rerender } = render(<UserProfile userId={1} fetchUser={fetchUser} />);
    rerender(<UserProfile userId={2} fetchUser={fetchUser} />);
    await act(async () => { fast.resolve(grace); });
    await act(async () => { slow.reject(new Error('late failure')); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Grace Hopper' })).toBeInTheDocument();
  });

  it('does not touch state after unmount', async () => {
    const errors = jest.spyOn(console, 'error');
    const d = deferred<typeof ada>();
    const { unmount } = render(<UserProfile userId={1} fetchUser={() => d.promise} />);
    unmount();
    await act(async () => { d.resolve(ada); });
    expect(errors).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: `<Joke fetchJoke />`** — loading / success / error with a retry, using a status union.

```tsx
import { useEffect, useState } from 'react';

type State =
  | { status: 'loading' }
  | { status: 'ok'; text: string }
  | { status: 'error' };

export function Joke({ fetchJoke }: { fetchJoke: () => Promise<string> }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);              // ① bumping this re-runs the effect: that's our "Retry"

  useEffect(() => {
    let ignore = false;                                   // ② race/unmount guard
    setState({ status: 'loading' });
    fetchJoke()
      .then((text) => { if (!ignore) setState({ status: 'ok', text }); })
      .catch(() => { if (!ignore) setState({ status: 'error' }); });
    return () => { ignore = true; };                      // ③ the cleanup marks this request as unwanted
  }, [fetchJoke, attempt]);

  if (state.status === 'loading') return <p role="status">Loading…</p>;
  if (state.status === 'error') return <div><p role="alert">Could not load</p><button onClick={() => setAttempt((a) => a + 1)}>Retry</button></div>;
  return <p>{state.text}</p>;
}
```

For `UserProfile`, replace the dependency `fetchJoke` with `[userId, fetchUser, attempt]` so a new `userId` refetches (and shows `Loading…` again), and render the name in a heading and the email in a paragraph.

%% explain
- **Loading**: `Loading…` with `role="status"`.
- **Success**: the name in a heading and the email in a paragraph.
- **Failure**: an alert `Could not load user` and a **Retry** button that fetches again (showing `Loading…` between).
- **New `userId`** fetches the new user and shows `Loading…` again.
- **Race safety**: only the current `userId`'s response is displayed; nothing updates after unmount.
- **`fetchUser` is called once per `userId`** (and once more per retry).

%% nudge
- What state must change when `userId` changes, *before* the new data arrives?
- How does the cleanup make an old response harmless?

%% hints
- Model the state as one object: `{ status: 'loading' } | { status: 'ok', user } | { status: 'error' }`.
- Effect depends on `[userId, fetchUser, attempt]`. Retry = bump an `attempt` counter (state).
- Inside the effect: `let ignore = false;` set state to loading, start the request, guard each `.then/.catch` with `if (!ignore)`, and `return () => { ignore = true; }`.
- The `fetchUser` prop is a dependency, but the tests pass a stable function — in real code you'd `useCallback` it in the parent.

%% solution
```tsx
import { useEffect, useState } from 'react';

export interface User {
  id: number;
  name: string;
  email: string;
}

interface Props {
  userId: number;
  fetchUser: (id: number) => Promise<User>;
}

type State = { status: 'loading' } | { status: 'ok'; user: User } | { status: 'error' };

export function UserProfile({ userId, fetchUser }: Props) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    setState({ status: 'loading' });
    fetchUser(userId).then(
      (user) => { if (!ignore) setState({ status: 'ok', user }); },
      () => { if (!ignore) setState({ status: 'error' }); },
    );
    return () => {
      ignore = true;
    };
  }, [userId, fetchUser, attempt]);

  if (state.status === 'loading') return <p role="status">Loading…</p>;
  if (state.status === 'error') {
    return (
      <div>
        <p role="alert">Could not load user</p>
        <button onClick={() => setAttempt((a) => a + 1)}>Retry</button>
      </div>
    );
  }
  return (
    <div>
      <h2>{state.user.name}</h2>
      <p>{state.user.email}</p>
    </div>
  );
}
```

%% exercise react-search-box | Debounced search box | 3 | tsx | react | SearchBox | 35
Build `<SearchBox search delay? />` where `search(query)` returns `Promise<string[]>`.

- An input labelled **Search**.
- After the user **stops typing for `delay` ms** (default 300), call `search` with the trimmed query. Every keystroke restarts the wait.
- An empty/blank query never calls `search` and clears the results.
- While a request is in flight show `Searching…` (`role="status"`).
- Show results as a `<ul>` of `<li>`. If a search returns nothing, show `No results`.
- If `search` rejects, show an alert `Search failed`.
- Only the **latest** query's response may be shown (out-of-order responses are ignored).
- No timers or updates may outlive the component.

%% starter
```tsx
import { useEffect, useState } from 'react';

interface SearchBoxProps {
  search: (query: string) => Promise<string[]>;
  delay?: number;
}

export function SearchBox({ search, delay = 300 }: SearchBoxProps) {
  return null;
}
```

%% tests
```tsx
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const type = (text: string) => userEvent.type(screen.getByLabelText('Search'), text);
const wait = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

describe('SearchBox', () => {
  beforeEach(() => jest.useFakeTimers());

  it('does not search until the user pauses', async () => {
    const search = jest.fn(async () => ['x']);
    render(<SearchBox search={search} />);
    await type('re');
    await wait(299);
    expect(search).not.toHaveBeenCalled();
    await wait(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('re');
  });

  it('restarts the wait on every keystroke and searches once', async () => {
    const search = jest.fn(async () => []);
    render(<SearchBox search={search} />);
    await type('r'); await wait(200);
    await type('e'); await wait(200);
    await type('a'); await wait(200);
    expect(search).not.toHaveBeenCalled();
    await wait(100);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('rea');
  });

  it('honours a custom delay', async () => {
    const search = jest.fn(async () => []);
    render(<SearchBox search={search} delay={50} />);
    await type('a');
    await wait(50);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('shows Searching… then the results', async () => {
    const d = deferred<string[]>();
    render(<SearchBox search={() => d.promise} />);
    await type('r');
    await wait(300);
    expect(screen.getByRole('status')).toHaveTextContent('Searching…');
    await act(async () => { d.resolve(['react', 'redux']); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['react', 'redux']);
  });

  it('shows "No results" for an empty response', async () => {
    render(<SearchBox search={async () => []} />);
    await type('zzz');
    await wait(300);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('trims the query and never searches for blank input', async () => {
    const search = jest.fn(async () => ['a']);
    render(<SearchBox search={search} />);
    await type('   ');
    await wait(1000);
    expect(search).not.toHaveBeenCalled();
    await type(' ab ');
    await wait(300);
    expect(search).toHaveBeenCalledWith('ab');
  });

  it('clears results when the input is emptied', async () => {
    render(<SearchBox search={async () => ['hit']} />);
    await type('h');
    await wait(300);
    expect(screen.getByText('hit')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Search'));
    await wait(0);
    expect(screen.queryByText('hit')).not.toBeInTheDocument();
    expect(screen.queryByText('No results')).not.toBeInTheDocument();
  });

  it('shows an alert on failure', async () => {
    render(<SearchBox search={() => Promise.reject(new Error('down'))} />);
    await type('a');
    await wait(300);
    expect(screen.getByRole('alert')).toHaveTextContent('Search failed');
  });

  it('ignores stale responses that arrive out of order', async () => {
    const slow = deferred<string[]>(), fast = deferred<string[]>();
    const search = jest.fn((q: string) => (q === 'a' ? slow.promise : fast.promise));
    render(<SearchBox search={search} />);
    await type('a'); await wait(300);
    await type('b'); await wait(300);
    await act(async () => { fast.resolve(['ab-result']); });
    await act(async () => { slow.resolve(['a-result']); });
    expect(screen.getByText('ab-result')).toBeInTheDocument();
    expect(screen.queryByText('a-result')).not.toBeInTheDocument();
  });

  it('cancels a pending debounce on unmount', async () => {
    const search = jest.fn(async () => []);
    const { unmount } = render(<SearchBox search={search} />);
    await type('a');
    unmount();
    await wait(1000);
    expect(search).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
```

%% worked
**A similar problem, solved: `useDebounced(value, ms)`** — the debounce as an effect: a timer that restarts whenever the value changes.

```tsx
import { useEffect, useState } from 'react';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);   // ① start a countdown
    return () => clearTimeout(id);                          // ② a new value → cleanup cancels the old countdown
  }, [value, ms]);
  return debounced;
}
```

That's the whole trick: **cleanup = "cancel the previous timer"**, so only a value that stays unchanged for `ms` gets through. `SearchBox` then has a *second* effect that reacts to the debounced query: if it's blank → clear results and don't call `search`; otherwise set `Searching…`, call `search(query)`, and use the `ignore`-flag pattern from the lesson so only the **latest** query's answer is shown (and nothing updates after unmount).

%% explain
- **An input labelled `Search`.**
- **Calls `search` only after `delay` ms without typing** (default 300), with the trimmed query; every keystroke restarts the wait.
- **Blank query** never calls `search` and clears results.
- **`Searching…`** (`role="status"`) while a request is in flight.
- **Results** as a `<ul>`; none → `No results`; rejection → alert `Search failed`.
- **Latest wins**: out-of-order responses are ignored. **No timers or updates outlive the component.**

%% nudge
- Which part of an effect cancels the previous countdown when a new keystroke arrives?
- When the query changes while a request is in flight, how do you make the old answer harmless?

%% hints
- State: `query`, `results`, and a `status` (`'idle' | 'searching' | 'done' | 'error'`).
- Effect keyed on `[query, delay, search]`. If the trimmed query is empty: reset state and return. Otherwise `setTimeout(async () => {...}, delay)`.
- The cleanup must both `clearTimeout(timer)` **and** set `cancelled = true` so a request that's already in flight can't overwrite newer results.
- Don't set the status to `searching` until the debounce actually fires.

%% solution
```tsx
import { useEffect, useState } from 'react';

interface SearchBoxProps {
  search: (query: string) => Promise<string[]>;
  delay?: number;
}

export function SearchBox({ search, delay = 300 }: SearchBoxProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'done' | 'error'>('idle');

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setStatus('idle');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setStatus('searching');
      try {
        const found = await search(q);
        if (cancelled) return;
        setResults(found);
        setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, delay, search]);

  return (
    <div>
      <label>
        Search
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {status === 'searching' && <p role="status">Searching…</p>}
      {status === 'error' && <p role="alert">Search failed</p>}
      {status === 'done' && results.length === 0 && <p>No results</p>}
      {results.length > 0 && (
        <ul>
          {results.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
