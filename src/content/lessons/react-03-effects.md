---
id: react-effects
track: react
title: Effects, cleanup & data fetching
summary: Synchronising with the outside world, dependency arrays, race conditions — and when not to use an effect at all.
---

## What an effect is for

Rendering must be pure: same props/state in → same JSX out. An **effect** is where you do things that *aren't* rendering, to **synchronise** your component with something outside React: a subscription, a timer, the document title, a WebSocket, a network request.

```tsx
useEffect(() => {
  // runs AFTER the DOM is committed
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);    // cleanup
}, [tick]);                          // re-run when `tick` changes
```

## The dependency array

The array lists every reactive value (props, state, functions/objects defined in the component) that the effect **reads**. React re-runs the effect when any of them changed (`Object.is`).

| Deps | Runs |
| --- | --- |
| omitted | after **every** render |
| `[]` | once after mount (cleanup on unmount) |
| `[a, b]` | after mount and whenever `a` or `b` changed |

**Don't lie to the array.** Leaving out a value you use creates a **stale closure**: the effect keeps using the value from the render it was created in. The lint rule `react-hooks/exhaustive-deps` is right far more often than you are.

## Cleanup runs before the next effect, and on unmount

Order for a change from A → B: render(B) → **cleanup(A)** → effect(B). That's how you avoid leaking listeners and timers, and it's how you cancel in-flight work:

```tsx
useEffect(() => {
  const onResize = () => setWidth(window.innerWidth);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
```

In development, **StrictMode mounts → unmounts → mounts again** on purpose. If your effect isn't idempotent with a proper cleanup, you'll see it immediately. That isn't a bug in React; it's a preview of what happens when users navigate away and back.

## Data fetching and race conditions

Two requests can resolve out of order. If the user clicks user 1 then user 2 quickly, response 1 may arrive **after** response 2 and overwrite it. Guard with a flag (or an `AbortController`) in the cleanup:

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

Model async state as a **discriminated union** (`idle | loading | ok | error`) rather than three booleans that can disagree. In real apps prefer a data library (TanStack Query, SWR, RSC/`use`) — but you need to understand this to debug them.

## You might not need an effect

Effects are an escape hatch. Before writing one, ask:

- Can I **calculate it during render**? (`const fullName = first + ' ' + last` — no state, no effect.)
- Is it a response to a **user event**? Do it in the event handler.
- Am I copying props into state and syncing with an effect? Use the prop directly, or reset with a `key`.
- Am I notifying a parent after state changes? Call the parent's callback in the same event handler.

`useEffect` after every state change to "keep two states in sync" produces extra renders and flicker, and is a classic interview red flag.

## `useLayoutEffect`

Runs synchronously after DOM mutation but **before paint** — use it to measure layout and adjust before the user sees a frame (tooltips, scroll restoration). Otherwise stick to `useEffect`.

## Testing effects

Wrap time-travel and async in `act` so React flushes effects and state: `act(() => jest.advanceTimersByTime(1000))`, `await act(async () => { … })`, or `await screen.findBy…`/`waitFor`. Tests check *observable* outcomes — DOM text, listener registration, timers left running — not "the effect ran".

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
