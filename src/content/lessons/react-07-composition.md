---
id: react-composition
track: react
title: Composition & accessibility: compound components, portals, comboboxes
summary: Designing component APIs that compose, managing focus and keyboard, and shipping widgets a screen reader can use.
---

Senior React interviews rarely ask "what does `useState` do?" — they ask you to **build a widget** (tabs, modal, dropdown, autocomplete) and watch how you structure the API, handle keyboard and focus, and think about accessibility. This lesson is that toolkit.

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

The caller controls markup and order; the parts coordinate via context. Build with `Object.assign(Root, { List, Trigger, Panel })`. Parts should **throw a clear error** when used outside the root. This is the shape of Radix, Headless UI, Reach and Ariakit.

## ARIA in one page

ARIA adds *semantics*, not behaviour. The first rule of ARIA: **prefer native elements** (`<button>`, `<dialog>`, `<input type="checkbox">`) — they come with roles, focus and keyboard for free. When you build a custom widget, you must supply all three yourself:

1. **Roles/states/properties** — `role="tab"`, `aria-selected`, `aria-expanded`, `aria-controls`, `aria-labelledby`, `aria-activedescendant`.
2. **Keyboard interaction** — follow the [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/) pattern for the widget (arrows, Home/End, Enter/Space, Escape).
3. **Focus management** — where focus goes on open, close and selection.

Accessible **names** come from content, `aria-label`, `aria-labelledby`, or an associated `<label>` — and that's exactly how testing-library-style queries find your elements.

### Roving tabindex vs. `aria-activedescendant`

Composite widgets (tabs, listbox, menu, radio group) are a *single tab stop*; arrows move within.

- **Roving tabindex:** the active item has `tabIndex=0`, the rest `-1`; on arrow keys you move DOM focus to the new item. Used by tabs, radios, toolbars.
- **`aria-activedescendant`:** DOM focus stays on the container/input; you set its attribute to the id of the "virtually focused" option. Used by comboboxes — it lets you keep typing while arrowing through suggestions.

## Portals

`createPortal(children, document.body)` renders into a different DOM node while staying in the **React tree** — events bubble through React parents, context still works. Use for modals, tooltips, toasts, dropdowns — anywhere `overflow: hidden` or `z-index` of an ancestor would clip you.

## Modal dialog checklist

- `role="dialog"`, `aria-modal="true"`, labelled by its title.
- **Move focus in** on open; **restore it** to the trigger on close.
- **Trap focus:** Tab/Shift+Tab wrap inside the dialog.
- **Escape** closes; clicking the backdrop closes (but not clicks inside).
- **Lock background scroll**, restoring the previous value.
- Make the rest of the page inert (`inert`, or `aria-hidden` on siblings) — the native `<dialog>` element's `showModal()` gives you most of this.

## Combobox / autocomplete

The W3C "combobox with listbox popup" pattern: an `<input role="combobox">` with `aria-expanded`, `aria-controls` → a `role="listbox"` of `role="option"` items; DOM focus stays in the input, and `aria-activedescendant` points to the highlighted option. ArrowDown/Up move (wrapping), Enter selects, Escape closes. Subtle bugs to know:

- Clicking an option **blurs** the input first — if blur closes the list, the click never lands. Fix: `onMouseDown={(e) => e.preventDefault()}` on the list.
- Enter inside a `<form>` would submit — `preventDefault()` when you consume it.
- Reset the highlighted index when the query changes.

## Design principles for reusable components

- Prefer **composition** (children/slots) to boolean prop explosions.
- Support **controlled and uncontrolled** usage.
- **Forward** refs and extra props (`...rest`) to the underlying element.
- Keep state **at the lowest level** that works; expose events (`onValueChange`) instead of reaching into the parent.
- Make invalid states unrepresentable (discriminated union props).

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
