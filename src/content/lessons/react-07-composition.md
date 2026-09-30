---
id: react-composition
track: react
title: Composition & accessibility
summary: Design component APIs that snap together, handle keyboard and focus correctly, and build widgets (tabs, modals, autocomplete) that a screen reader can use.
---

## The idea in one sentence

A senior React developer isn't asked "what does `useState` do?" — they're asked to **build a widget** (tabs, modal, dropdown, autocomplete) and judged on **how the pieces fit together, whether the keyboard works, and whether a screen reader can use it**.

> **Analogy** A good widget is like a **well-designed set of Lego bricks**: small parts with consistent connectors that you can arrange however you like. Accessibility is the **braille on the bricks** — the same thing, built so that people who can't see the colours can still use it.

## Compound components

Instead of one component with a dozen props, expose **small parts that share state implicitly** through context:

```tsx
<Tabs defaultValue="account">
  <Tabs.List aria-label="Settings">
    <Tabs.Trigger value="account">Account</Tabs.Trigger>
    <Tabs.Trigger value="billing">Billing</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="account">…</Tabs.Panel>
  <Tabs.Panel value="billing">…</Tabs.Panel>
</Tabs>
```

The caller controls the markup and the order; the parts coordinate through context. Build it with `Object.assign(Root, { List, Trigger, Panel })`, and make each part **throw a clear error** when used outside the root. This is the shape of Radix, Headless UI, Reach and Ariakit.

![The Tabs root keeps state and shares it by context with List, Trigger and Panel parts](fig:compound-parts "No prop drilling: parts read and update the shared state through context.")

Here is a tiny version you can play with (no keyboard support yet — that comes next):

```tsx try
import { createContext, useContext, useState, type ReactNode } from 'react';

const TabsContext = createContext<{ value: string; setValue: (v: string) => void } | null>(null);
const useTabs = () => {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>');
  return ctx;
};

function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsContext.Provider value={{ value, setValue }}>{children}</TabsContext.Provider>;
}
function List({ children }: { children: ReactNode }) { return <div role="tablist" style={{ display: 'flex', gap: 4 }}>{children}</div>; }
function Trigger({ value, children }: { value: string; children: ReactNode }) {
  const tabs = useTabs();
  return <button role="tab" aria-selected={tabs.value === value} onClick={() => tabs.setValue(value)}>{children}</button>;
}
function Panel({ value, children }: { value: string; children: ReactNode }) {
  return useTabs().value === value ? <div role="tabpanel" style={{ padding: 8 }}>{children}</div> : null;
}
Tabs.List = List; Tabs.Trigger = Trigger; Tabs.Panel = Panel;

export default function App() {
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <Tabs defaultValue="a">
        <Tabs.List>
          <Tabs.Trigger value="a">Account</Tabs.Trigger>
          <Tabs.Trigger value="b">Billing</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Panel value="a">Account settings…</Tabs.Panel>
        <Tabs.Panel value="b">Billing details…</Tabs.Panel>
      </Tabs>
    </div>
  );
}
```

## ARIA in one page

**ARIA** adds *meaning* to elements for assistive technology (screen readers); it adds no *behaviour*. The first rule: **prefer native elements** (`<button>`, `<dialog>`, `<input type="checkbox">`) — they come with roles, focus and keyboard support for free. When you build a custom widget, **you** must supply three things:

1. **Roles, states and properties** — `role="tab"`, `aria-selected`, `aria-expanded`, `aria-controls`, `aria-labelledby`, `aria-activedescendant`.
2. **Keyboard interaction** — follow the [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/) pattern for that widget (arrows, Home/End, Enter/Space, Escape).
3. **Focus management** — where focus goes when something opens, closes or gets selected.

An element's accessible **name** comes from its content, `aria-label`, `aria-labelledby` or an associated `<label>` — and that is exactly how the tests in this course find your elements (`getByRole('tab', { name: 'Account' })`).

### Two ways to move "focus" inside a widget

Composite widgets (tabs, listbox, menu, radio group) are **one Tab stop**: Tab enters the widget, arrow keys move *inside* it.

- **Roving tabindex:** the active item has `tabIndex={0}`, the others `-1`. On an arrow key you move *real DOM focus* to the new item and swap the `0`. Used by tabs, radios, toolbars.
- **`aria-activedescendant`:** DOM focus **stays** on the container/input; you set its attribute to the `id` of the "virtually focused" option. Used by comboboxes, so the user can keep typing while arrowing through suggestions.

![Only the active tab has tabindex 0; ArrowRight moves focus and the 0 to the next tab](fig:roving-tabindex "One Tab stop for the whole widget; arrow keys move within it.")

## Portals

`createPortal(children, document.body)` renders into a **different DOM node** while staying **in the React tree**: events still bubble through React parents, and context still works. Use it for modals, tooltips, toasts and dropdowns — anywhere an ancestor's `overflow: hidden` or `z-index` would clip you.

## The modal dialog checklist

![Focus moves into the dialog on open, is trapped while open, and returns to the trigger on close](fig:modal-focus "A modal is mostly focus management.")

- `role="dialog"`, `aria-modal="true"`, labelled by its title.
- **Move focus in** when it opens; **restore it** to the trigger when it closes.
- **Trap focus:** Tab and Shift+Tab wrap around inside the dialog.
- **Escape** closes; clicking the backdrop closes (but not clicks *inside*).
- **Lock background scroll** and restore the previous value.
- Make the rest of the page inert (`inert`, or `aria-hidden` on siblings). The native `<dialog>` element's `showModal()` gives you most of this for free.

```tsx try
import { useEffect, useRef, useState } from 'react';

export default function App() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;   // remember who had focus
    closeRef.current?.focus();                                        // move focus IN
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };   // restore on close
  }, [open]);

  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <button ref={triggerRef} onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="t" style={{ border: '2px solid #333', padding: 12, marginTop: 8 }}>
          <h2 id="t" style={{ margin: 0 }}>Hello</h2>
          <p>Press Escape or Close; focus returns to “Open dialog”.</p>
          <button ref={closeRef} onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}
```

(This demo moves and restores focus and handles Escape; the exercise also asks for the **Tab trap**, a portal, the overlay click and scroll locking.)

## Combobox / autocomplete

The W3C "combobox with listbox popup" pattern: an `<input role="combobox">` with `aria-expanded` and `aria-controls` pointing at a `role="listbox"` of `role="option"` items. **DOM focus stays in the input**, and `aria-activedescendant` names the highlighted option.

![The input points to the highlighted option with aria-activedescendant and to the list with aria-controls](fig:combobox-anatomy "Arrow keys change the highlight, not the DOM focus.")

Step through a typical interaction:

```stepper Using a combobox with the keyboard
code:
  <input role="combobox" aria-expanded aria-controls="list"
         aria-activedescendant={activeId} />
  <ul role="listbox" id="list">
    <li role="option" id="o1">apple</li>
    <li role="option" id="o2">apricot</li>
  </ul>
---
line: 1-2
say: The user focuses the input. The list is closed, so `aria-expanded` is `false` and there is no active descendant.
Input value:
Listbox:
Highlighted (aria-activedescendant):
---
line: 1-2
say: The user types `ap`. Matches appear, so the list opens (`aria-expanded="true"`). Nothing is highlighted yet.
Input value: ap
Listbox: open — apple | apricot
---
line: 1-2
say: **ArrowDown** highlights the first option. DOM focus **stays in the input**; only the `aria-activedescendant` attribute changes (to `o1`), so the screen reader announces "apple".
Highlighted (aria-activedescendant): o1 (apple)
---
line: 5-6
say: ArrowDown again moves to `o2`. At the last option, one more ArrowDown **wraps** to the first.
Highlighted (aria-activedescendant): o2 (apricot)
---
line: 1-2
say: **Enter** selects the highlighted option: the input takes its text, the list closes, and the Enter must not submit a surrounding form (`preventDefault`).
Input value: apricot
Listbox: closed
Highlighted (aria-activedescendant): (none)
---
say: **Escape** would also close the list without selecting. And if the user *clicks* an option with the mouse, the click first **blurs** the input — so stop that with `onMouseDown={(e) => e.preventDefault()}` on the list, or the list closes before the click lands.
```

Subtle bugs worth remembering:

- A click on an option blurs the input first; if blur closes the list, the click never lands.
- Enter inside a `<form>` submits it — `preventDefault()` when you use the key.
- Reset the highlighted index when the query changes.

## Design principles for reusable components

- Prefer **composition** (children/slots) to a pile of boolean props.
- Support **controlled and uncontrolled** use.
- **Forward refs and extra props** (`...rest`) to the underlying element.
- Keep state at the lowest level that works, and expose **events** (`onValueChange`) rather than reaching into the parent.
- Make invalid states unrepresentable (for example with discriminated-union props).

## Common mistakes

1. **Clickable `<div>`s** instead of buttons/links.
2. **`aria-*` without the keyboard behaviour** — a role promises behaviour you must provide.
3. **No focus management** in dialogs (focus stays behind the overlay).
4. **Forgetting to restore focus** on close.
5. **Closing a popup on blur** and breaking mouse selection.
6. **Non-unique ids** when a component is used twice (use `useId`).

## Quick check

```check
Q: What is the "first rule of ARIA"?
A) Always add `role` to every element
B) Use `aria-label` on everything
C) ARIA replaces the need for keyboard support
D) Prefer native elements (button, dialog, input…) over custom ARIA widgets *
Why: Native elements already come with the right roles, focus behaviour and keyboard support. ARIA only *describes* behaviour; you'd have to implement it all yourself.
---
Q: In a tab list using roving tabindex, which tabs have `tabindex="0"`?
A) All of them
B) Only the active tab *
C) None
D) Only disabled tabs
Why: The list is a single Tab stop. The active tab is reachable with Tab; the others are `-1` and reached with arrow keys.
---
Q: A combobox keeps DOM focus in its input. How does the screen reader know which option is highlighted?
A) `aria-activedescendant` on the input points to the option's id *
B) The option gets `tabindex="0"`
C) Focus moves to each option
D) It doesn't
Why: That attribute creates "virtual focus", letting the user keep typing while arrowing.
---
Q: When a modal closes, where should focus go?
A) To the top of the page
B) Nowhere
C) To the `<body>`
D) Back to the element that opened it *
Why: Returning focus keeps keyboard users oriented. Move focus in on open, restore on close.
---
Q: Why render a modal with `createPortal(…, document.body)`?
A) It makes it faster
B) It avoids being clipped by an ancestor's `overflow`/`z-index`, while staying in the React tree for events and context *
C) It removes the need for ARIA
D) It stops re-renders
Why: A portal changes *where in the DOM* the content lives, not where it lives in the React tree.
```

## Recap

- **Compound components** share state through context; callers control the markup; parts throw outside the root.
- **ARIA** adds roles/states, not behaviour: prefer native elements, and provide **roles + keyboard + focus management** for custom widgets.
- **Roving tabindex** (one Tab stop, arrows move) vs **`aria-activedescendant`** (focus stays on the input).
- **Portals** escape clipping but stay in the React tree.
- **Modal**: labelled dialog, focus in/trap/restore, Escape, backdrop, scroll lock.
- **Combobox**: input + listbox, `aria-activedescendant`, wrapping arrows, Enter/Escape, `onMouseDown` preventDefault.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: accessible disclosure | `aria-expanded`, `aria-controls`, a real `<button>` |
| Compound Tabs | "Compound components", roving tabindex, `useId` for unique ids |
| Accessible modal | The modal checklist, the focus demo, a portal |
| Accessible autocomplete | The combobox section and its stepper |

%% exercise comp-guided-disclosure | Guided: accessible disclosure | 1 | tsx | react | Disclosure | 8 | guided
Build `<Disclosure title>{children}</Disclosure>` — a "show more" section done accessibly.

- A real `<button>` whose text is the `title`, with `aria-expanded` (`"false"` at first, `"true"` when open).
- The button has `aria-controls` pointing at the **id** of the panel.
- The panel is a `<div>` with that id, containing the `children`, and the **`hidden`** attribute while closed (it stays in the DOM).
- Clicking the button toggles it.

%% worked
**A similar problem, solved: `<Collapse label>`** — the same pattern with a different look.

```tsx
import { useId, useState, type ReactNode } from 'react';

export function Collapse({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();                              // ① a unique id per instance (two Collapses won't clash)

  return (
    <div>
      <button aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {label}                                        {/* ② a REAL button: keyboard + screen reader support for free */}
      </button>
      <div id={panelId} hidden={!open}>{children}</div>   {/* ③ `hidden` hides it but keeps the id valid for aria-controls */}
    </div>
  );
}
```

`aria-expanded` tells a screen reader whether the section is open; `aria-controls` says which element it controls. `aria-expanded={open}` with a boolean renders `"true"`/`"false"`.

%% explain
- **A real `<button>`** named by the `title`.
- **`aria-expanded`** is `"false"` initially and `"true"` after a click.
- **`aria-controls`** equals the id of the panel, and the panel exists in the DOM.
- **The panel has the `hidden` attribute while closed**, and not when open.

%% nudge
- How do you generate a unique id for each instance?
- Which attribute hides an element from everyone (including screen readers) while keeping it in the DOM?

%% starter
```tsx
import { useId, useState, type ReactNode } from 'react';

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  // Step 1 — state for open/closed, and a unique id:   const [open, setOpen] = useState(false);  const panelId = useId();
  // Step 2 — a <button aria-expanded={open} aria-controls={panelId}> that toggles open on click.
  // Step 3 — a <div id={panelId} hidden={!open}> holding the children.
  return null;
}
```

%% tests
```tsx
describe('Disclosure', () => {
  const panelOf = (button) => document.getElementById(button.getAttribute('aria-controls') ?? '');

  it('starts closed', () => {
    render(<Disclosure title="Details">Secret</Disclosure>);
    const button = screen.getByRole('button', { name: 'Details' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    const panel = panelOf(button);
    expect(panel).not.toBeNull();
    expect(panel.hidden).toBe(true);
  });

  it('opens and closes on click', async () => {
    render(<Disclosure title="Details">Secret</Disclosure>);
    const button = screen.getByRole('button', { name: 'Details' });
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(panelOf(button).hidden).toBe(false);
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(panelOf(button).hidden).toBe(true);
  });

  it('keeps the content in the DOM', () => {
    render(<Disclosure title="Details"><p>Secret text</p></Disclosure>);
    expect(panelOf(screen.getByRole('button', { name: 'Details' })).textContent).toContain('Secret text');
  });

  it('gives each instance its own panel id', () => {
    render(<><Disclosure title="One">a</Disclosure><Disclosure title="Two">b</Disclosure></>);
    const one = screen.getByRole('button', { name: 'One' }).getAttribute('aria-controls');
    const two = screen.getByRole('button', { name: 'Two' }).getAttribute('aria-controls');
    expect(one).not.toBe(two);
  });
});
```

%% hints
- `const panelId = useId();`
- `<button aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>{title}</button>`

%% solution
```tsx
import { useId, useState, type ReactNode } from 'react';

export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div>
      <button aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        {title}
      </button>
      <div id={panelId} hidden={!open}>{children}</div>
    </div>
  );
}
```

%% exercise comp-tabs | Compound Tabs | 3 | tsx | react | Tabs | 35
Build an accessible compound `Tabs` component: `Tabs`, `Tabs.List`, `Tabs.Trigger`, `Tabs.Panel`.

```tsx
<Tabs defaultValue="a" onValueChange={fn}>
  <Tabs.List aria-label="Sections">
    <Tabs.Trigger value="a">A</Tabs.Trigger>
    <Tabs.Trigger value="b" disabled>B</Tabs.Trigger>
    <Tabs.Trigger value="c">C</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="a">Panel A</Tabs.Panel>
  …
</Tabs>
```

- **List:** `role="tablist"`, forwards extra props (`aria-label`, …).
- **Trigger:** a `<button role="tab">` with `aria-selected`, `aria-controls` (its panel's id), an `id`, and **roving tabindex** (`0` when selected, else `-1`). Click selects it. `disabled` triggers can't be selected.
- **Panel:** only the **selected** panel is rendered: `role="tabpanel"`, `aria-labelledby` its trigger.
- **Keyboard** (on the list): `ArrowRight`/`ArrowLeft` move to the next/previous **enabled** tab (wrapping), *focusing and selecting* it; `Home`/`End` jump to the first/last enabled tab.
- `onValueChange(value)` fires when the selection changes. Ids must be unique per `Tabs` instance.
- Using a part outside `<Tabs>` throws `Tabs components must be used inside <Tabs>`.

%% starter
```tsx
import { createContext, useContext, useId, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

function TabsRoot({ defaultValue, onValueChange, children }: {
  defaultValue: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) {
  return <>{children}</>;
}

function List(props: HTMLAttributes<HTMLDivElement>) {
  return null;
}

function Trigger({ value, disabled, children }: { value: string; disabled?: boolean; children: ReactNode }) {
  return null;
}

function Panel({ value, children }: { value: string; children: ReactNode }) {
  return null;
}

export const Tabs = Object.assign(TabsRoot, { List, Trigger, Panel });
```

%% tests
```tsx
function Demo({ onValueChange }: { onValueChange?: (v: string) => void }) {
  return (
    <Tabs defaultValue="profile" onValueChange={onValueChange}>
      <Tabs.List aria-label="Settings">
        <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
        <Tabs.Trigger value="billing" disabled>Billing</Tabs.Trigger>
        <Tabs.Trigger value="team">Team</Tabs.Trigger>
        <Tabs.Trigger value="api">API</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Panel value="profile">Profile settings</Tabs.Panel>
      <Tabs.Panel value="billing">Billing settings</Tabs.Panel>
      <Tabs.Panel value="team">Team settings</Tabs.Panel>
      <Tabs.Panel value="api">API keys</Tabs.Panel>
    </Tabs>
  );
}
const tab = (name: string) => screen.getByRole('tab', { name });

describe('Tabs', () => {
  it('renders an accessible tablist with the default tab selected', () => {
    render(<Demo />);
    expect(screen.getByRole('tablist', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(tab('Profile')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Team')).toHaveAttribute('aria-selected', 'false');
  });

  it('renders only the selected panel, labelled by its tab', () => {
    render(<Demo />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Profile settings');
    expect(screen.queryByText('Team settings')).not.toBeInTheDocument();
    expect(panel).toHaveAttribute('aria-labelledby', tab('Profile').id);
    expect(tab('Profile')).toHaveAttribute('aria-controls', panel.id);
  });

  it('selects on click and reports changes', async () => {
    const onValueChange = jest.fn();
    render(<Demo onValueChange={onValueChange} />);
    await userEvent.click(tab('Team'));
    expect(tab('Team')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Team settings');
    expect(onValueChange).toHaveBeenCalledWith('team');
    await userEvent.click(tab('Team'));
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('uses a roving tabindex', async () => {
    render(<Demo />);
    expect(tab('Profile')).toHaveAttribute('tabindex', '0');
    expect(tab('Team')).toHaveAttribute('tabindex', '-1');
    await userEvent.click(tab('Team'));
    expect(tab('Team')).toHaveAttribute('tabindex', '0');
    expect(tab('Profile')).toHaveAttribute('tabindex', '-1');
  });

  it('ignores clicks on disabled tabs', async () => {
    render(<Demo />);
    await userEvent.click(tab('Billing'));
    expect(tab('Billing')).toHaveAttribute('aria-selected', 'false');
    expect(tab('Billing')).toBeDisabled();
  });

  it('ArrowRight moves focus and selection to the next enabled tab (skipping disabled)', () => {
    render(<Demo />);
    tab('Profile').focus();
    fireEvent.keyDown(tab('Profile'), { key: 'ArrowRight' });
    expect(tab('Team')).toHaveFocus();
    expect(tab('Team')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Team settings');
  });

  it('ArrowLeft goes backwards and both arrows wrap around', () => {
    render(<Demo />);
    tab('Profile').focus();
    fireEvent.keyDown(tab('Profile'), { key: 'ArrowLeft' });
    expect(tab('API')).toHaveFocus();
    expect(tab('API')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(tab('API'), { key: 'ArrowRight' });
    expect(tab('Profile')).toHaveFocus();
  });

  it('Home and End jump to the first and last enabled tabs', () => {
    render(<Demo />);
    tab('Profile').focus();
    fireEvent.keyDown(tab('Profile'), { key: 'End' });
    expect(tab('API')).toHaveFocus();
    fireEvent.keyDown(tab('API'), { key: 'Home' });
    expect(tab('Profile')).toHaveFocus();
    expect(tab('Profile')).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps ids unique across two Tabs instances', () => {
    render(<><Demo /><Demo /></>);
    const ids = screen.getAllByRole('tab').map((t) => t.id);
    expect(new Set(ids).size).toBe(8);
  });

  it('throws a helpful error when a part is used outside Tabs', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const suppress = (e: Event) => e.preventDefault();
    window.addEventListener('error', suppress);
    expect(() => render(<Tabs.Trigger value="x">x</Tabs.Trigger>)).toThrow('Tabs components must be used inside <Tabs>');
    window.removeEventListener('error', suppress);
    spy.mockRestore();
  });

  it('does not log React warnings', () => {
    const spy = jest.spyOn(console, 'error');
    render(<Demo />);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: the keyboard logic for a *radio group* (roving tabindex + arrows).** The decision "which item is next?" is the heart of the Tabs keyboard support.

```tsx
function nextEnabled(values: string[], disabled: Set<string>, from: number, step: 1 | -1) {
  for (let i = 1; i <= values.length; i++) {
    const idx = (from + step * i + values.length * 2) % values.length;   // ① wrap around both ends
    if (!disabled.has(values[idx])) return idx;                          // ② skip disabled items
  }
  return from;                                                           // ③ nothing else is enabled
}

function onKeyDown(e: React.KeyboardEvent) {
  const i = currentIndex;
  if (e.key === 'ArrowRight') select(nextEnabled(values, disabled, i, 1));
  if (e.key === 'ArrowLeft')  select(nextEnabled(values, disabled, i, -1));
  if (e.key === 'Home') select(nextEnabled(values, disabled, -1, 1));
  if (e.key === 'End')  select(nextEnabled(values, disabled, values.length, -1));
}
```

For the compound structure, follow the lesson's mini-Tabs: a **context** with `value`, `setValue`, and a `baseId` from `useId()`; each **Trigger** gets `id={`${baseId}-tab-${value}`}` and `aria-controls={`${baseId}-panel-${value}`}`; each **Panel** gets the matching ids with `aria-labelledby`. To know all trigger values (for arrow keys and `Home`/`End`), either read them from the DOM (`querySelectorAll('[role=tab]:not([disabled])')` inside the List's key handler) or let each Trigger register itself. When the selected trigger changes by keyboard, **focus the new tab** too (roving tabindex).

%% explain
- **List**: `role="tablist"`, forwards extra props (`aria-label`, …).
- **Trigger**: `<button role="tab">` with `aria-selected`, `aria-controls`, an `id`, and **roving tabindex** (`0` when selected, else `-1`); disabled triggers can't be selected.
- **Panel**: only the selected panel renders; `role="tabpanel"`, `aria-labelledby` its trigger.
- **Keyboard**: arrows move to the next/previous **enabled** tab (wrapping), focusing and selecting it; `Home`/`End` jump to the ends.
- **`onValueChange`** fires on change; ids are unique per instance; parts outside `<Tabs>` throw `Tabs components must be used inside <Tabs>`.

%% nudge
- How will the List's key handler learn which tabs exist and which are disabled?
- When the selection changes by keyboard, what else must move besides `aria-selected`?

%% hints
- Context value: `{ value, select, baseId }`. `const baseId = useId()`; trigger id `${baseId}-tab-${value}`, panel id `${baseId}-panel-${value}`.
- `select(v)`: only when `v !== value` → `setValue(v); onValueChange?.(v)`.
- Keyboard: on the list's `onKeyDown`, collect `ref.current.querySelectorAll('[role="tab"]:not([disabled])')`, find the current one via `(e.target as HTMLElement).closest('[role="tab"]')`, compute the target index, then `.focus()` **and** `.click()` it — clicking reuses your select logic.
- Put the "outside `<Tabs>`" check in one `useTabs()` helper.
- `Panel` returns `null` unless it's the selected one.

%% solution
```tsx
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, KeyboardEvent, ReactNode } from 'react';

interface TabsContextValue {
  value: string;
  select: (value: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>');
  return ctx;
}

function TabsRoot({ defaultValue, onValueChange, children }: {
  defaultValue: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}) {
  const [value, setValue] = useState(defaultValue);
  const baseId = useId();
  const select = useCallback(
    (next: string) => {
      if (next === value) return;
      setValue(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );
  const ctx = useMemo(() => ({ value, select, baseId }), [value, select, baseId]);
  return <TabsContext.Provider value={ctx}>{children}</TabsContext.Provider>;
}

function List({ children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])') ?? []);
    const current = (e.target as HTMLElement).closest('[role="tab"]') as HTMLElement | null;
    const i = current ? tabs.indexOf(current) : -1;
    if (i === -1) return;
    let next: number;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };

  return (
    <div role="tablist" ref={ref} onKeyDown={onKeyDown} {...rest}>
      {children}
    </div>
  );
}

function Trigger({ value, disabled, children }: { value: string; disabled?: boolean; children: ReactNode }) {
  const { value: selectedValue, select, baseId } = useTabs();
  const selected = selectedValue === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => select(value)}
    >
      {children}
    </button>
  );
}

function Panel({ value, children }: { value: string; children: ReactNode }) {
  const { value: selectedValue, baseId } = useTabs();
  if (selectedValue !== value) return null;
  return (
    <div role="tabpanel" id={`${baseId}-panel-${value}`} aria-labelledby={`${baseId}-tab-${value}`} tabIndex={0}>
      {children}
    </div>
  );
}

export const Tabs = Object.assign(TabsRoot, { List, Trigger, Panel });
```

%% exercise comp-modal | Accessible modal | 3 | tsx | react | Modal | 40
Build `<Modal open onClose title>{children}</Modal>`.

- When `open` is `false`, render nothing.
- Render into `document.body` with a **portal**: an overlay `<div data-testid="overlay">` containing the dialog.
- The dialog: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` its `<h2>` title, `tabIndex={-1}`, plus your children and a **Close** button.
- **Escape** calls `onClose`. Clicking the **overlay** (not inside the dialog) calls `onClose`.
- **Focus:** on open, focus moves into the dialog; on close (or unmount), focus **returns to the element that was focused before**.
- **Focus trap:** `Tab` on the last focusable element wraps to the first; `Shift+Tab` on the first (or the dialog itself) wraps to the last.
- **Scroll lock:** `document.body.style.overflow = 'hidden'` while open; the previous value is restored afterwards.

%% starter
```tsx
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  return null;
}
```

%% tests
```tsx
import { useState } from 'react';

function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Delete item">
        <p>Are you sure?</p>
        <button>Cancel</button>
        <button>Confirm</button>
      </Modal>
    </div>
  );
}
const overlay = () => screen.getByTestId('overlay');
const dialog = () => screen.getByRole('dialog', { name: 'Delete item' });

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Demo />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens an accessible dialog', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Delete item' })).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders through a portal into document.body', async () => {
    const { container } = render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(overlay().parentElement).toBe(document.body);
    expect(within(container).queryByRole('dialog')).toBeNull();
  });

  it('closes with Escape', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes when the overlay is clicked but not when the dialog is', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByText('Are you sure?'));
    expect(dialog()).toBeInTheDocument();
    await userEvent.click(overlay());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes with the Close button', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the dialog and restores it on close', async () => {
    render(<Demo />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    expect(dialog()).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('traps focus: Tab on the last element wraps to the first', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const close = screen.getByRole('button', { name: 'Close' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    const focusables = [...dialog().querySelectorAll('button')] as HTMLElement[];
    const first = focusables[0], last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
    expect(close && confirm).toBeTruthy();
  });

  it('traps focus: Shift+Tab on the first element (or the dialog) wraps to the last', async () => {
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const focusables = [...dialog().querySelectorAll('button')] as HTMLElement[];
    const first = focusables[0], last = focusables[focusables.length - 1];
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    dialog().focus();
    fireEvent.keyDown(dialog(), { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
  });

  it('locks body scroll while open and restores the previous value', async () => {
    document.body.style.overflow = 'auto';
    render(<Demo />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('cleans up listeners and scroll lock on unmount', () => {
    const onClose = jest.fn();
    const { unmount } = render(<Modal open onClose={onClose} title="x">body</Modal>);
    unmount();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('always calls the latest onClose', () => {
    const first = jest.fn(), second = jest.fn();
    const { rerender } = render(<Modal open onClose={first} title="x">body</Modal>);
    rerender(<Modal open onClose={second} title="x">body</Modal>);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
```

%% worked
**A similar problem, solved: a `<Popover>` that uses the same lifecycle tools** — a portal, Escape, and restoring focus.

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Popover({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;    // ① remember who had focus
    ref.current?.focus();                                              // ② move focus in (needs tabIndex={-1} on the element)

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);                       // ③ document-level listener, removed in cleanup

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';                           // ④ scroll lock — and remember the old value

    return () => {                                                     // ⑤ cleanup runs on close AND on unmount
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      previous?.focus();                                               //    restore focus
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(<div ref={ref} tabIndex={-1} role="dialog">{children}</div>, document.body);   // ⑥ render elsewhere in the DOM
}
```

What the modal adds: `aria-modal`, `aria-labelledby` (use `useId` for the title's id), an **overlay** whose `onClick` closes only when `e.target === e.currentTarget` (so clicks *inside* the dialog don't close it), and the **Tab trap**: on `keydown` for `Tab`, compute the focusable elements inside the dialog; if `Shift+Tab` on the first (or on the dialog itself) focus the last, and if `Tab` on the last focus the first (`preventDefault` both times).

%% explain
- **Closed** renders nothing; **open** renders via a **portal** into `document.body`: an overlay (`data-testid="overlay"`) containing the dialog.
- **Dialog**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` its `<h2>`, `tabIndex={-1}`, children and a **Close** button.
- **Escape** and an **overlay click** (not inside) call `onClose`.
- **Focus**: moves in on open; returns to the previously focused element on close/unmount.
- **Focus trap**: `Tab` on the last wraps to the first; `Shift+Tab` on the first (or the dialog) wraps to the last.
- **Scroll lock**: `body.style.overflow = 'hidden'` while open; previous value restored.

%% nudge
- What must the effect's cleanup undo: listeners, scroll lock, and what else?
- How can the overlay tell a click on itself from a click inside the dialog?

%% hints
- `if (!open) return null;` **after** your hooks. The effect handles everything that touches the outside world: read `document.activeElement` and `body.style.overflow`, set `overflow = 'hidden'`, `dialogRef.current?.focus()`, add a `document` `keydown` listener for Escape — and return one cleanup that undoes all of it (including `previouslyFocused?.focus()`).
- Effect deps: `[open]`. Store `onClose` in a ref so the effect doesn't re-run (and re-steal focus) when the parent passes a new function.
- Overlay click: `onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}`.
- Focus trap: `onKeyDown` on the dialog; on `Tab` compute the focusable elements (`button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`, not disabled) and wrap with `preventDefault()`.

%% solution
```tsx
import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, children }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const trapFocus = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const items = Array.from(dialogRef.current!.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      data-testid="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={trapFocus}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
}
```

%% exercise comp-autocomplete | Accessible autocomplete | 4 | tsx | react | Autocomplete | 50
Build `<Autocomplete options onSelect label? />` following the ARIA **combobox + listbox** pattern.

- `<label>` (default text `Search`) + `<input role="combobox" aria-autocomplete="list">`.
- Typing filters `options` (case-insensitive **substring**). Nothing shows for an empty/blank query.
- Matches appear in a `<ul role="listbox">` of `<li role="option">` items. The input has `aria-expanded` (`true` only while the listbox is shown) and `aria-controls` = listbox id.
- If the query has no matches, show `<p role="status">No matches</p>` (no listbox, `aria-expanded="false"`).
- **Keyboard** (DOM focus never leaves the input): `ArrowDown`/`ArrowUp` move the highlighted option, **wrapping**, and open the list; the highlighted option has `aria-selected="true"` and the input's `aria-activedescendant` points to its id. `Enter` selects the highlighted option — `onSelect(option)`, the input takes its text, the list closes, and the Enter key must not submit a parent form. `Escape` closes the list.
- **Mouse:** clicking an option selects it. (Careful: the click blurs the input — the list must not close before the click lands.)
- Blur closes the list. The highlight resets whenever the query changes. Ids are unique per instance.

%% starter
```tsx
import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface AutocompleteProps {
  options: string[];
  onSelect: (option: string) => void;
  label?: string;
}

export function Autocomplete({ options, onSelect, label = 'Search' }: AutocompleteProps) {
  return null;
}
```

%% tests
```tsx
const fruits = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry', 'Pineapple'];
const input = () => screen.getByRole('combobox', { name: 'Search' }) as HTMLInputElement;
const optionNames = () => screen.queryAllByRole('option').map((o) => o.textContent);

describe('Autocomplete', () => {
  it('starts collapsed', () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    expect(input()).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('filters case-insensitively by substring and expands', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'AP');
    expect(optionNames()).toEqual(['Apple', 'Apricot', 'Pineapple']);
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('links the input to the listbox via aria-controls', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'b');
    expect(input().getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
  });

  it('shows a status message when nothing matches', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'zzz');
    expect(screen.getByRole('status')).toHaveTextContent('No matches');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-expanded', 'false');
  });

  it('hides the list for a blank query', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'a');
    await userEvent.clear(input());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await userEvent.type(input(), '   ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ArrowDown highlights options, wraps, and keeps focus on the input', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'ap'); // Apple, Apricot, Pineapple
    await userEvent.keyboard('{ArrowDown}');
    const opts = screen.getAllByRole('option');
    expect(opts[0]).toHaveAttribute('aria-selected', 'true');
    expect(input().getAttribute('aria-activedescendant')).toBe(opts[0].id);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    expect(input()).toHaveFocus();
  });

  it('ArrowUp starts from the end and wraps', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'ap');
    await userEvent.keyboard('{ArrowUp}');
    const opts = screen.getAllByRole('option');
    expect(opts[opts.length - 1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getAllByRole('option')[opts.length - 2]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getAllByRole('option')[opts.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  it('has no active descendant until the user arrows', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'a');
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryAllByRole('option', { selected: true })).toHaveLength(0);
  });

  it('Enter selects the highlighted option and closes the list', async () => {
    const onSelect = jest.fn();
    render(<Autocomplete options={fruits} onSelect={onSelect} />);
    await userEvent.type(input(), 'ap');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith('Apricot');
    expect(input()).toHaveValue('Apricot');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-expanded', 'false');
  });

  it('Enter without a highlighted option selects nothing', async () => {
    const onSelect = jest.fn();
    render(<Autocomplete options={fruits} onSelect={onSelect} />);
    await userEvent.type(input(), 'ap{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
    expect(input()).toHaveValue('ap');
  });

  it('does not submit a surrounding form when Enter selects an option', async () => {
    const onSubmit = jest.fn((e) => e.preventDefault());
    render(<form onSubmit={onSubmit}><Autocomplete options={fruits} onSelect={() => {}} /></form>);
    await userEvent.type(input(), 'ch');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('Escape closes the list', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'a');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input()).toHaveValue('a');
  });

  it('typing again re-opens the list and resets the highlight', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'a');
    await userEvent.keyboard('{ArrowDown}{Escape}');
    await userEvent.type(input(), 'p');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.queryAllByRole('option', { selected: true })).toHaveLength(0);
  });

  it('selects with the mouse without the list closing on blur first', async () => {
    const onSelect = jest.fn();
    render(<Autocomplete options={fruits} onSelect={onSelect} />);
    await userEvent.type(input(), 'ch');
    await userEvent.click(screen.getByRole('option', { name: 'Cherry' }));
    expect(onSelect).toHaveBeenCalledWith('Cherry');
    expect(input()).toHaveValue('Cherry');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes when the input loses focus', async () => {
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'a');
    fireEvent.blur(input());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('uses a custom label and unique ids per instance', () => {
    render(<><Autocomplete options={fruits} onSelect={() => {}} label="Fruit" /><Autocomplete options={fruits} onSelect={() => {}} label="Other" /></>);
    expect(screen.getByRole('combobox', { name: 'Fruit' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Other' })).toBeInTheDocument();
  });

  it('does not log React warnings', async () => {
    const spy = jest.spyOn(console, 'error');
    render(<Autocomplete options={fruits} onSelect={() => {}} />);
    await userEvent.type(input(), 'a');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(spy).not.toHaveBeenCalled();
  });
});
```

%% worked
**A similar problem, solved: the highlight logic for a listbox** — wrapping arrow keys with an "active index".

```tsx
const [active, setActive] = useState(-1);        // -1 = nothing highlighted

function onKeyDown(e: React.KeyboardEvent, count: number) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();                                     // stop the cursor jumping to the end of the input
    setActive((i) => (i + 1) % count);                      // ① wraps from the last to the first
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    setActive((i) => (i <= 0 ? count - 1 : i - 1));         // ② wraps from the first (or none) to the last
  }
}

// In the JSX: the input never loses DOM focus; it POINTS at the active option:
// <input role="combobox" aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined} … />
// <li role="option" id={`${id}-opt-${i}`} aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
```

The rest of the exercise is bookkeeping from the lesson's stepper: derive `matches` from the query (case-insensitive `includes`; none for a blank query); `open` is a piece of state that arrow keys set to `true`, and Escape / blur / selecting set to `false`; `aria-expanded` is true only when the list is shown; reset `active` to `-1` whenever the query changes; use `useId()` so two autocompletes don't share ids; on **Enter** with a highlighted option call `e.preventDefault()`, then `onSelect(option)`, put its text in the input and close the list.

%% explain
- **`<label>`** (default `Search`) + `<input role="combobox" aria-autocomplete="list">`.
- **Filtering**: case-insensitive substring; nothing for a blank query.
- **Listbox** `<ul role="listbox">` with `<li role="option">`; `aria-expanded` true only while shown; `aria-controls` = the listbox id.
- **No matches** → `<p role="status">No matches</p>`, `aria-expanded="false"`.
- **Keyboard** (focus stays in the input): ArrowDown/Up move the highlight (wrapping) and open; `aria-selected` and `aria-activedescendant` follow; Enter selects (no form submit); Escape closes.
- **Mouse**: clicking an option selects it, even though it blurs the input. **Blur** closes; the highlight resets on query change; ids are unique per instance.

%% nudge
- Which mouse event fires *before* the input's blur, letting you cancel the blur?
- What state decides whether the list is shown — and which keys and events change it?

%% hints
- State: `query`, `open`, `active` (index, `-1` = none). Derive `matches` with `useMemo`, and derive `expanded = open && query.trim() !== '' && matches.length > 0`.
- `onChange`: `setQuery`, `setOpen(true)`, `setActive(-1)`.
- ArrowDown: `setOpen(true); setActive((i) => (i + 1) % matches.length)`. ArrowUp: `(i <= 0 ? matches.length - 1 : i - 1)`. Always `preventDefault()` so the caret doesn't jump.
- Enter: only if the list is showing and `active >= 0`; `preventDefault()` (this stops form submit), call your `choose(option)`.
- Option ids: `${listId}-opt-${index}`; input `aria-activedescendant` is the active one's id (or `undefined`).
- The blur/click race: `onMouseDown={(e) => e.preventDefault()}` on the `<ul>` (or each option) stops the input losing focus when an option is pressed.

%% solution
```tsx
import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';

interface AutocompleteProps {
  options: string[];
  onSelect: (option: string) => void;
  label?: string;
}

export function Autocomplete({ options, onSelect, label = 'Search' }: AutocompleteProps) {
  const uid = useId();
  const inputId = `${uid}-input`;
  const listId = `${uid}-list`;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(
    () => (trimmed ? options.filter((o) => o.toLowerCase().includes(trimmed)) : []),
    [options, trimmed],
  );
  const wantsList = open && trimmed !== '';
  const expanded = wantsList && matches.length > 0;

  const choose = (option: string) => {
    setQuery(option);
    setOpen(false);
    setActive(-1);
    onSelect(option);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
    } else if (e.key === 'Enter' && expanded && active >= 0) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === 'Escape' && expanded) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-opt-${active}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      />
      {expanded && (
        <ul id={listId} role="listbox" onMouseDown={(e) => e.preventDefault()}>
          {matches.map((option, i) => (
            <li key={option} id={`${listId}-opt-${i}`} role="option" aria-selected={i === active} onClick={() => choose(option)}>
              {option}
            </li>
          ))}
        </ul>
      )}
      {wantsList && matches.length === 0 && <p role="status">No matches</p>}
    </div>
  );
}
```
