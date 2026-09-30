---
id: react-state
track: react
title: State, events & forms
summary: How a React component remembers things, reacts to clicks and typing, and shares data — explained step by step, then used to build real widgets.
---

## The idea in one sentence

In React you don't change the screen directly. You **change a piece of remembered data called *state***, and React **redraws the screen** to match it.

> **Analogy** Think of a restaurant menu board with a chalkboard behind the counter. You (the component) never run out and repaint the sign yourself. You just update the stock list on the back wall — "Soup: 3 left" — and a helper (React) repaints the sign to match. **State is the stock list. The screen is the sign.**

![The React loop: state becomes a screen, the user triggers an event, the event changes state, React redraws](fig:react-loop "① State holds the data. ② React turns state into the screen (this step is called a render). ③ When the user clicks or types, an event handler changes the state, and the loop repeats.")

Everything in this lesson is a detail of that loop:

1. **State** — what the component remembers (`useState`).
2. **Render** — your component function runs and returns what the screen should look like *for the current state*.
3. **Events** — clicks and typing run your handler functions, which call a *setter* to change the state.

## `useState`, line by line

```tsx
import { useState } from 'react';

function LikeButton() {
  const [likes, setLikes] = useState(0);

  return <button onClick={() => setLikes(likes + 1)}>👍 {likes}</button>;
}
```

- `useState(0)` says: *"remember a value; the first time, start it at `0`."*
- It gives back **two things** in an array: the current value (`likes`) and a **setter** function (`setLikes`). We grab both using array destructuring.
- `setLikes(likes + 1)` says: *"please remember a new value, and redraw."*
- `onClick={() => …}` passes React a function to call later. (Pass the function — don't call it yourself.)

Try it. Click the button, then edit the code (change the start value, add a second button, …) and run again:

```tsx try
import { useState } from 'react';

export default function App() {
  const [likes, setLikes] = useState(0);

  return (
    <div style={{ fontFamily: 'system-ui', padding: 12 }}>
      <button onClick={() => setLikes(likes + 1)}>👍 {likes}</button>
      <p>{likes === 0 ? 'No likes yet' : `${likes} people like this`}</p>
    </div>
  );
}
```

The text under the button isn't stored anywhere — it's **calculated from `likes`** every time the component redraws. Remember that: *UI = a function of state*.

## Big gotcha: state is a snapshot

This is the concept most juniors get wrong, so we'll go slowly.

Every time React redraws, it **calls your component function again from the top**. Each call gets its own fixed value of `count`. That value doesn't change *during* that call — even after you call `setCount`. It is a **snapshot** of the state taken at the start of that render.

```tsx try
import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  function handleClick() {
    setCount(count + 1);
    console.log('count right after setCount is', count);
  }

  return (
    <div style={{ fontFamily: 'system-ui', padding: 12 }}>
      <button onClick={handleClick}>Add one</button>
      <p>On screen: {count}</p>
    </div>
  );
}
```

Click once and read the console below the preview: it says `0`, even though the screen will show `1`. `setCount` doesn't change the `count` variable you're holding; it **asks for a new render**, and *that* render has `count = 1`.

Now the classic puzzle. What do you expect when this handler runs?

```tsx
function addThree() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}
```

Three additions means `+3`, right? Step through it and see what really happens:

```stepper Why three setCount calls add only 1
code:
  function addThree() {
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
  }
---
line: 1
say: The user clicks. React runs the handler **from Render #1**, where `count` is frozen at `0`.
count in this render: 0
React's to-do list:
Next render: (not yet)
---
line: 2
say: `count + 1` is `0 + 1 = 1`. React does **not** change anything yet. It just adds a note to its to-do list: "set count to 1".
React's to-do list: set count to 1
---
line: 3
say: `count` is **still 0** in this render, so this is `0 + 1 = 1` again. Another note: "set count to 1".
React's to-do list: set count to 1 | set count to 1
---
line: 4
say: Same story a third time. Three notes, all saying "set count to **1**".
React's to-do list: set count to 1 | set count to 1 | set count to 1
---
line: 5
say: The handler ends. React reads its to-do list — every note says 1, so the result is `1`. React redraws **once** (this is called *batching*).
Next render: count = 1
```

![Three calls to setCount(count + 1) all use the same old value 0, so the next render has count 1](fig:state-snapshot "① All three lines read the same frozen `count` of 0. ② The next render therefore shows 1, not 3.")

**The fix: pass a function.** Instead of a value, give `setCount` an **updater function** — "take whatever the latest value is and return the new one":

```tsx
function addThree() {
  setCount((c) => c + 1);
  setCount((c) => c + 1);
  setCount((c) => c + 1);
}
```

```stepper The updater function fixes it
code:
  function addThree() {
    setCount((c) => c + 1);
    setCount((c) => c + 1);
    setCount((c) => c + 1);
  }
---
line: 2
say: Now React's to-do list stores a **recipe** — "take the current number and add 1" — not a fixed answer.
React's to-do list: c => c + 1
Running value: 0
---
line: 3
say: A second recipe is added to the list.
React's to-do list: c => c + 1 | c => c + 1
---
line: 4
say: And a third.
React's to-do list: c => c + 1 | c => c + 1 | c => c + 1
---
line: 5
say: When the handler ends, React runs the recipes **in order**, feeding each one the result of the previous: 0 → 1 → 2 → 3.
Running value: 1 → 2 → 3
Next render: count = 3
```

> **Remember** Whenever the new state depends on the old state — counters, toggles, "add to a list" — use the updater form: `setX((prev) => …)`. It is always correct, and it saves you from stale values inside timeouts and effects.

## Never change state directly ("immutability")

For objects and arrays there's a second trap. React decides whether something changed by comparing **identity** (`===`): "is this the *same object* as before?" If you change an array in place and hand the *same* array back, React sees nothing new and skips the redraw.

```tsx
// ❌ same array, changed in place → React does not notice
todos.push(newTodo);
setTodos(todos);

// ✅ a NEW array → React notices
setTodos([...todos, newTodo]);
```

![Mutating keeps the same array reference so React sees no change; copying creates a new reference so React redraws](fig:immutable-update "React compares references, not contents. Always hand `setState` a new array or object.")

`[...todos, newTodo]` means "a new array with everything from `todos`, then `newTodo`". The three recipes you'll use all the time:

```tsx
// add
setTodos([...todos, newTodo]);

// remove — filter keeps everything that is NOT the one to remove
setTodos(todos.filter((t) => t.id !== id));

// change one item — map builds a new array, swapping just the matching item for a modified copy
setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
```

(`{ ...t, done: !t.done }` means "a copy of `t`, but with `done` flipped".)

Run this and read the code. Add a couple of items, then tick a box:

```tsx try
import { useState } from 'react';

export default function App() {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Learn state', done: true },
    { id: 2, text: 'Learn events', done: false },
  ]);

  function toggle(id: number) {
    setTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  return (
    <ul style={{ fontFamily: 'system-ui' }}>
      {todos.map((t) => (
        <li key={t.id}>
          <label>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} />{' '}
            {t.text}
          </label>
        </li>
      ))}
    </ul>
  );
}
```

## What should be state, and what shouldn't?

Put something in state only if it **changes over time** *and* you **can't work it out** from other state or props. Everything else is calculated while rendering:

```tsx
const [todos, setTodos] = useState<Todo[]>([]);
const remaining = todos.filter((t) => !t.done).length; // calculated — no second state needed
```

If you stored `remaining` in its own state you'd have to remember to update it everywhere `todos` changes — and sooner or later you'd forget. **Two copies of the same truth drift apart.** Most "my UI is out of sync" bugs are this.

## Forms: controlled inputs

A **controlled input** is an `<input>` whose text lives in React state. React always decides what it shows:

```tsx
const [text, setText] = useState('');

<input value={text} onChange={(e) => setText(e.target.value)} />
```

![A controlled input: user types, onChange fires, the handler saves the text in state, React redraws with the value from state](fig:controlled-input "①–④ Typing doesn't change the input directly. It goes through state and comes back as the new `value`.")

Step through a keystroke:

```stepper What happens when you type a letter
code:
  const [text, setText] = useState('');

  <input
    value={text}
    onChange={(e) => setText(e.target.value)}
  />
---
line: 3
say: The input shows `value={text}`. Right now `text` is `""`, so the box is empty.
Box shows: (empty)
state text: (empty)
---
line: 4
say: You type **a**. The browser fires a change event, and React calls your `onChange` with it. `e.target.value` is what's in the box right now: `"a"`.
Event says: e.target.value = "a"
---
line: 4
say: `setText("a")` asks React to remember `"a"` and redraw.
state text: a
---
line: 3
say: React redraws. `value={text}` is now `"a"`, so the box shows **a**. The text went *through state* and came back.
Box shows: a
```

Because the state is the single source of truth, you can validate it, transform it, disable a button when it's empty, or clear it from anywhere (`setText('')`). Try making the box force uppercase:

```tsx try
import { useState } from 'react';

export default function App() {
  const [text, setText] = useState('');

  return (
    <div style={{ fontFamily: 'system-ui', padding: 12 }}>
      <input value={text} onChange={(e) => setText(e.target.value.toUpperCase())} placeholder="Type here" />
      <p>{text.length} characters</p>
    </div>
  );
}
```

> **Watch out** If you write `value={text}` but forget `onChange`, the box becomes frozen — React keeps putting the old value back. (It will also warn you in the console.)

**Submitting a form.** Handle `onSubmit` on the `<form>` — not `onClick` on the button — so pressing Enter works too, and call `e.preventDefault()` to stop the browser reloading the page:

```tsx
function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  addTodo(text.trim());
  setText('');
}

<form onSubmit={handleSubmit}>
  <input value={text} onChange={(e) => setText(e.target.value)} />
  <button type="submit">Add</button>
</form>
```

## Events: pass the function, don't call it

```tsx
<button onClick={remove}>      {/* ✅ React calls remove when clicked */}
<button onClick={remove()}>    {/* ❌ calls remove RIGHT NOW, while rendering */}
<button onClick={() => remove(id)}>   {/* ✅ need an argument? wrap it in an arrow function */}
```

## Sharing state: lift it up

What if two components need the same data? Say a list on the left and a detail panel on the right, both needing "which item is selected".

Siblings can't see each other's state. The fix: **move the state up to their closest common parent.** The parent passes the value **down** as a prop, and gives the children a **function** to report changes back **up**.

![Before: two siblings each have their own copy. After: the parent owns the state and passes it down; children call functions to change it](fig:lift-state-up "Data flows down (props ↓). Events flow up (callbacks ↑). ① The parent owns the state. ② Children just display it and report clicks.")

```tsx try
import { useState } from 'react';

function List({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (s: string) => void }) {
  return (
    <ul>
      {items.map((it) => (
        <li key={it}>
          <button onClick={() => onSelect(it)} style={{ fontWeight: it === selected ? 700 : 400 }}>{it}</button>
        </li>
      ))}
    </ul>
  );
}

function Detail({ selected }: { selected: string }) {
  return <p>You picked: <b>{selected || 'nothing yet'}</b></p>;
}

export default function App() {
  const [selected, setSelected] = useState('');
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <List items={['Apples', 'Pears', 'Plums']} selected={selected} onSelect={setSelected} />
      <Detail selected={selected} />
    </div>
  );
}
```

`App` owns `selected`. `List` and `Detail` are both just functions of the props they're given.

## Resetting state with `key`

State belongs to a component **at a particular place in the tree**. If you give a component a different `key`, React treats it as a brand-new component and throws its state away. `<Profile key={userId} />` is the standard way to say "start fresh when the user changes".

## How the exercises test you

The tests behave like a user: `userEvent.click`, `userEvent.type`, and they find things by **role, label and text** — the same way a screen reader does (`getByRole('button', { name: 'Add' })`). So read each exercise's wording carefully: the labels and button names you must use are part of the spec.

## Quick check

```check
Q: A component has `const [n, setN] = useState(0)`. A button handler runs `setN(n + 1); setN(n + 1);`. What will `n` be on the next render?
A) 2
B) 1 *
C) 0
D) It depends on the browser
Why: Both calls use the same snapshot `n = 0`, so both queue "set to 1". The last one wins, giving 1. `setN((c) => c + 1)` twice would give 2.
---
Q: Which line correctly adds an item to a todo array held in state?
A) `todos.push(item); setTodos(todos);`
B) `todos[todos.length] = item;`
C) `setTodos([...todos, item]);` *
D) `setTodos(todos.concat);`
Why: React compares by identity. Only a **new** array tells it something changed. `push` changes the old array in place, so `setTodos(todos)` hands back the same reference.
---
Q: You render `<input value={text} />` without an `onChange`. What happens when the user types?
A) The box looks frozen — React keeps restoring the old value *
B) The text appears normally
C) The page reloads
D) `text` updates automatically
Why: A controlled input shows whatever `value` says. With nothing updating the state, it never changes.
---
Q: Two sibling components both need to know which item is selected. Where should `selected` live?
A) In each sibling, kept in sync manually
B) In a global variable
C) In `localStorage`
D) In their closest common parent, passed down as props *
Why: Lifting state up keeps one source of truth. The parent passes the value down and a setter function down for the children to call.
---
Q: Which of these is **best** kept as state, rather than calculated?
A) The number of unchecked todos
B) `todos.length === 0`
C) The text currently typed in a search box *
D) The full name, made from first and last name
Why: The typed text changes over time and can't be worked out from anything else. The other three can all be computed from existing state, so storing them would create a second copy that could drift out of sync.
```

## Recap

- **State** = what a component remembers. Changing it makes React **redraw**; the screen is always a function of state.
- **State is a snapshot**: inside one render, the value never changes, even right after `setX`.
- If the new value depends on the old one, use the **updater form**: `setX((prev) => …)`.
- **Never mutate** arrays/objects in state — build **new** ones (`[...arr, x]`, `filter`, `map`, `{ ...obj, key: v }`).
- **Controlled input**: `value={state}` + `onChange` that sets the state. Submit with `onSubmit` + `preventDefault()`.
- **Derive** what you can during render; only store what truly changes over time.
- Share data by **lifting state up** to the closest common parent: props down, callbacks up.
- Change a component's **`key`** to reset its state.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: like button | "`useState`, line by line" |
| Counter (and the batching trap) | "State is a snapshot" + the updater function |
| Accordion | State holding *which section is open*; `aria-expanded` from state; "what should be state" |
| Star rating | Two pieces of state (selected + hover); events that pass arguments |
| Todo list | "Never change state directly" recipes; controlled input; `onSubmit`; derived "items left" |
| Signup form | Controlled inputs, `onSubmit`, and async state (a `submitting` flag) |

Each exercise has a **worked example**, a plain-English list of **what the tests check**, and gentle **nudges** before the hints.

%% exercise react-guided-like | Guided: like button | 1 | tsx | react | LikeButton | 6 | guided
Build `<LikeButton />`.

- It shows one button whose text is `Like (0)`. Each click adds one: `Like (1)`, `Like (2)`, …
- Once there is at least one like, a paragraph `Thanks for the like!` appears under the button. Before that, it is not on the page at all.

The skeleton is started for you — follow the numbered steps in the comments, running the tests after each one.

%% worked
**A similar problem, solved: `<Toggle />`** — a button that flips between `Off` and `On`, and shows a message only while it is on.

```tsx
import { useState } from 'react';

export function Toggle() {
  const [on, setOn] = useState(false);            // ① remember one value, start at false

  return (
    <div>
      <button onClick={() => setOn((v) => !v)}>   {/* ② the updater form flips the old value */}
        {on ? 'On' : 'Off'}                       {/* ③ what's on screen is calculated from state */}
      </button>
      {on && <p>The light is on</p>}              {/* ④ && renders the <p> only when on is true */}
    </div>
  );
}
```

① `useState(false)` gives you the current value and its setter. ② Clicking *asks* React to remember the opposite value and redraw. ③ The button text isn't stored — it's worked out from `on` each render. ④ `cond && <jsx>` renders the element only when `cond` is true (when it's `false`, React renders nothing).

Your exercise has the same four parts: a number instead of a boolean, `likes + 1` instead of `!v`, and `likes > 0` instead of `on`.

%% explain
- **Starts at `Like (0)`** and each click goes up by exactly one.
- **The message is hidden at first** — the test checks it is *not in the document* (hidden with CSS would fail).
- **The message appears after the first click** and stays.
- **Each button keeps its own count** — two `<LikeButton />`s on the page must not affect each other.

%% nudge
- What is the one piece of data this component has to remember?
- Is "should the thank-you show?" something you need to *store*, or can you work it out from the number?

%% starter
```tsx
import { useState } from 'react';

export function LikeButton() {
  // Step 1 — remember the number of likes, starting at 0:
  //          const [likes, setLikes] = useState(0);

  // Step 2 — return a <button> whose text is  Like (<likes>)
  //          and whose onClick adds one, using the updater form:  setLikes((n) => n + 1)

  // Step 3 — under the button, show  <p>Thanks for the like!</p>  only when likes > 0.
  //          Hint: {likes > 0 && <p>…</p>}
  //          (Step 2 and 3 live inside the same returned <div>.)

  return null;
}
```

%% tests
```tsx
describe('LikeButton', () => {
  it('starts at zero', () => {
    render(<LikeButton />);
    expect(screen.getByRole('button', { name: 'Like (0)' })).toBeInTheDocument();
  });

  it('adds one per click', async () => {
    render(<LikeButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Like (0)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Like (1)' }));
    expect(screen.getByRole('button', { name: 'Like (2)' })).toBeInTheDocument();
  });

  it('only thanks you after the first like', async () => {
    render(<LikeButton />);
    expect(screen.queryByText('Thanks for the like!')).toBeNull();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Thanks for the like!')).toBeInTheDocument();
  });

  it('keeps separate counts per button', async () => {
    render(<><LikeButton /><LikeButton /></>);
    await userEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Like (1)');
    expect(screen.getAllByRole('button')[1]).toHaveTextContent('Like (0)');
  });
});
```

%% hints
- `const [likes, setLikes] = useState(0);` goes at the top of the function.
- The button text `Like ({likes})` — JSX lets you drop a value in with curly braces.
- Wrap the button and the paragraph in one `<div>` so you return a single element.

%% solution
```tsx
import { useState } from 'react';

export function LikeButton() {
  const [likes, setLikes] = useState(0);
  return (
    <div>
      <button onClick={() => setLikes((n) => n + 1)}>Like ({likes})</button>
      {likes > 0 && <p>Thanks for the like!</p>}
    </div>
  );
}
```

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

%% worked
**A similar problem, solved: `<Stepper />`** — a number with **+2** and **+4** buttons, where **+4** is built from *two* `setN` calls in one handler.

```tsx
import { useState } from 'react';

export function Stepper() {
  const [n, setN] = useState(0);

  function plusFour() {
    setN((v) => v + 2);      // ① updater form: "take the latest value and add 2"
    setN((v) => v + 2);      //    runs on the result of the line above → +4 in total
  }

  return (
    <div>
      <p>Value: {n}</p>
      <button onClick={() => setN((v) => v + 2)}>+2</button>
      <button onClick={plusFour}>+4</button>
    </div>
  );
}
```

If you had written `setN(n + 2)` twice, both lines would use the same frozen `n` and you'd only get `+2` (see the "state is a snapshot" stepper in the lesson).

The **Reset** button is a plain `setN(initial)`: no old value needed, so a normal value is fine.

%% explain
- **Shows `Count: <initial>`** at the start (default 0).
- **Increment / Decrement** move by `step` (default 1) — including going negative.
- **"Add 3" really adds 3** even though it calls the setter three times — that's the updater-function test. If you see `Count: 1` after clicking it, you used `setCount(count + 1)`.
- **Reset** goes back to `initial`, not always to 0.
- **Independent instances** — two counters on the page don't share anything.

%% nudge
- After `setCount(count + 1)` three times, what does `count` equal on each line?
- Which form of the setter always sees the *latest* value?

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

%% worked
**A similar problem, solved: `<Tabs />`** — only one of several panels is visible, chosen by clicking its button. Same core idea as the accordion: **the only state is "which one is open"**; everything else is calculated from it.

```tsx
import { useState } from 'react';

const tabs = [
  { id: 'a', title: 'Overview', body: 'Hello' },
  { id: 'b', title: 'Details', body: 'More info' },
];

export function Tabs() {
  const [openId, setOpenId] = useState('a');             // ① state = the id of the open tab

  return (
    <div>
      {tabs.map((t) => (
        <button
          key={t.id}                                      // ② key: a stable id per item
          aria-selected={t.id === openId}                 // ③ attributes calculated from state
          onClick={() => setOpenId(t.id)}
        >
          {t.title}
        </button>
      ))}
      {tabs.map((t) => (
        <div key={t.id} hidden={t.id !== openId}>{t.body}</div>  // ④ hidden keeps it in the DOM
      ))}
    </div>
  );
}
```

For the accordion: with `multiple`, "which are open" is a **list** of ids (an array, or a `Set` you copy each time) and clicking toggles one id in or out. Without `multiple`, it's the same list but holding at most one id. **Don't store `isOpen` inside each section** — derive it with `openIds.includes(section.id)`.

%% explain
- **Structure/accessibility**: each title is a `<button>` inside an `<h3>`, with `aria-expanded` (true/false) and `aria-controls` pointing at the panel's `id`. The panel has `role="region"`, `aria-labelledby` the button, and `hidden` while closed.
- **Toggling**: click opens, click again closes.
- **Single-open mode (default)**: opening one closes the others.
- **`multiple`**: sections open and close independently.
- **`defaultOpen`**: those sections start open (only the first one if not `multiple`).
- **Closed panels stay in the DOM** (just `hidden`), so `aria-controls` always points at something real.

%% nudge
- What is the *smallest* thing you need to remember to know which sections are open?
- Could you work out each `aria-expanded` from that, instead of storing it?
- For a toggle that adds/removes an id from a list: `filter` to remove, `[...ids, id]` to add.

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

%% worked
**A similar problem, solved: `<ThumbsRating />`** — two buttons (👍 / 👎); hovering previews your choice before you click. The shape is the same as star rating: **one state for the real value, one for the hover preview**, and the screen shows `hover ?? value`.

```tsx
import { useState } from 'react';

export function ThumbsRating({ onChange }: { onChange?: (v: 'up' | 'down' | null) => void }) {
  const [value, setValue] = useState<'up' | 'down' | null>(null);      // ① the committed choice
  const [hover, setHover] = useState<'up' | 'down' | null>(null);      // ② the temporary preview
  const shown = hover ?? value;                                        // ③ what to DISPLAY (derived!)

  function choose(v: 'up' | 'down') {
    const next = v === value ? null : v;                               // ④ clicking again clears it
    setValue(next);
    onChange?.(next);                                                  // ⑤ tell the parent too
  }

  return (
    <div onMouseLeave={() => setHover(null)}>
      {(['up', 'down'] as const).map((v) => (
        <button key={v} aria-pressed={shown === v} onMouseEnter={() => setHover(v)} onClick={() => choose(v)}>
          {v === 'up' ? '👍' : '👎'}
        </button>
      ))}
    </div>
  );
}
```

For stars, "filled" is `star <= shown` (every star up to the shown value), and keyboard arrows call the same `choose`-style function with `value ± 1`.

%% explain
- **Structure**: a `radiogroup` named "Rating" with `max` radio buttons named `"1 star"`, `"2 stars"`, … and `aria-checked` on the selected one.
- **Filled stars**: star *n* has `data-filled="true"` when *n* ≤ the displayed value.
- **Clicking** sets the rating and calls `onChange(n)`; clicking the selected star again clears it to `0`.
- **Hovering** previews the fill without changing the real value; leaving restores it.
- **Keyboard**: arrows change the value by one, clamped between `0` and `max`, each calling `onChange`.
- **`readOnly`** switches off all three ways of changing it.

%% nudge
- You need two separate pieces of state. What's the difference between "what is selected" and "what is shown right now"?
- Write one `setRating(n)` function and call it from both the click handler and the key handler.

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

%% worked
**A similar problem, solved: `<ShoppingList />`** — add items with a form and remove them. It uses the exact recipes the exercise needs.

```tsx
import { useState } from 'react';

export function ShoppingList() {
  const [items, setItems] = useState<{ id: number; name: string }[]>([]);
  const [text, setText] = useState('');                       // ① controlled input state
  const [nextId, setNextId] = useState(1);                    // ② a simple way to get unique ids

  function add(e: React.FormEvent) {
    e.preventDefault();                                       // ③ don't reload the page
    const name = text.trim();
    if (!name) return;                                        // ④ ignore blank input
    setItems([...items, { id: nextId, name }]);               // ⑤ NEW array (never push)
    setNextId(nextId + 1);
    setText('');                                              // ⑥ clear the box
  }

  const remove = (id: number) => setItems(items.filter((i) => i.id !== id));   // ⑦ filter to delete

  return (
    <form onSubmit={add}>
      <label>Item <input value={text} onChange={(e) => setText(e.target.value)} /></label>
      <button type="submit">Add</button>
      <ul>
        {items.map((i) => (
          <li key={i.id}>                                      {/* ⑧ key = id, never the index or the text */}
            {i.name} <button type="button" onClick={() => remove(i.id)}>Delete {i.name}</button>
          </li>
        ))}
      </ul>
      <p role="status">{items.length} {items.length === 1 ? 'item' : 'items'}</p>   {/* ⑨ derived, not stored */}
    </form>
  );
}
```

For toggling "done" use the `map` recipe from the lesson: `items.map((i) => i.id === id ? { ...i, done: !i.done } : i)`.

%% explain
- **Adding**: submitting (button *or* Enter) adds the **trimmed** text; blank input is ignored; the box clears after.
- **Each todo** is an `<li>` with a checkbox whose accessible name is the todo text, and a button named `Delete <text>`.
- **Checking** a todo sets `data-done="true"` on its `<li>`.
- **"N items left"** counts *unchecked* todos, with correct singular ("1 item left") — derived, not stored.
- **Duplicates allowed**: two todos with the same text must be independent, so use a unique **id** as the `key` and as the thing you toggle/delete by.
- **`initialTodos`** seeds the list.

%% nudge
- Is "items left" something you need to store? (What would happen if you forgot to update it?)
- Two todos are both called "Buy milk". If you delete by *text*, what goes wrong? What could you use instead?

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

%% worked
**A similar problem, solved: `<NameForm onSubmit />`** — one required field, validation only after the first submit attempt, and a "saving…" state. It shows the three ideas the signup form combines.

```tsx
import { useState } from 'react';

export function NameForm({ onSubmit }: { onSubmit: (name: string) => Promise<void> | void }) {
  const [name, setName] = useState('');
  const [attempted, setAttempted] = useState(false);        // ① has the user tried to submit yet?
  const [saving, setSaving] = useState(false);              // ② async state: are we waiting?

  const error = name.trim() ? '' : 'Name is required';      // ③ the error is DERIVED from the input
  const showError = attempted && error;                      //    ...and only SHOWN after an attempt

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    if (error || saving) return;                              // ④ invalid or already sending → stop
    setSaving(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setSaving(false);                                       // ⑤ always re-enable, success or failure
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <label>Name <input value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!showError} /></label>
      {showError && <p role="alert">{error}</p>}
      <button disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </form>
  );
}
```

Extras the exercise adds: two fields (so two derived errors), **focus the first invalid field** using a `ref` (`emailRef.current?.focus()`), and catching a rejection to show "Something went wrong" (put a `submitError` state in the `catch`).

%% explain
- **No errors before the first submit attempt**, then they update live as the user types.
- **Messages & accessibility**: `Enter a valid email` / `Password must be at least 8 characters`, each in a `role="alert"` element, with `aria-invalid="true"` on the bad input.
- **Invalid submit**: `onSubmit` is *not* called, and focus moves to the first invalid field.
- **Valid submit**: `onSubmit({ email, password })` with the **trimmed** email.
- **While waiting**: the button is disabled and says `Creating…`; pressing Enter again does nothing.
- **On failure** (promise rejects): show `Something went wrong. Please try again.` and re-enable the button.

%% nudge
- Which of these are *state* and which can be *calculated*: the error messages, `attempted`, `submitting`?
- What must always happen after `await onSubmit(...)`, whether it succeeds or throws? (Think `try` / `finally`.)

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
