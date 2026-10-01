---
id: web-dom
track: web
title: The DOM, events & the rendering pipeline
summary: How a click travels through the page, why one listener beats a hundred, and how reading and writing the DOM in the wrong order makes the browser do the same work over and over.
---

## The idea in one sentence

The page you see is a **tree of objects** (the DOM) that the browser keeps **turning into pixels**; everything you do in JavaScript is either **listening to what happens to that tree** (events) or **changing it** (and paying for the redraw).

> **Analogy** Think of an office building with a mailroom on each floor. When someone presses a doorbell (a click), the building's security doesn't only tell that one door. The news is **announced from the lobby down to the door** (capture), the door reacts (target), and then the news **bubbles back up** floor by floor to the lobby. Any floor's mailroom can listen in. And every time you rearrange the furniture, a surveyor has to **re-measure the building** — so if you re-measure after every single chair you move, you spend the whole day measuring.

## Part 1 · Events

### The three phases

When something happens to an element (a click, a key press), the browser builds the **path** from the document down to that element and runs listeners along it **twice**: once on the way down (**capture**), once on the way back up (**bubble**).

![A click on a button travels down through capture, hits the target, then bubbles back up](fig:event-flow "Most listeners run on the way up. Pass { capture: true } to run on the way down instead.")

Try it. Click the button and read the order of the log. Then click the *outer* area and compare:

```tsx try
import { useState } from 'react';

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [...l, s]);
  return (
    <div style={{ fontFamily: 'system-ui', display: 'grid', gap: 10 }}>
      <div
        onClickCapture={() => add('outer · capture')}
        onClick={() => add('outer · bubble')}
        style={{ padding: 16, border: '2px solid #888', borderRadius: 8 }}
      >
        outer box
        <div
          onClickCapture={() => add('inner · capture')}
          onClick={() => add('inner · bubble')}
          style={{ padding: 16, margin: 8, border: '2px solid #c53', borderRadius: 8 }}
        >
          inner box
          <button onClick={() => add('button · target')}>Click me</button>
        </div>
      </div>
      <button onClick={() => setLog([])}>Clear log</button>
      <ol style={{ margin: 0 }}>{log.map((l, i) => <li key={i}>{l}</li>)}</ol>
    </div>
  );
}
```

The order is **outer capture → inner capture → button (target) → inner bubble → outer bubble**. (React's `onClick` is the bubble phase; `onClickCapture` is the capture phase.)

### What the event object gives you

| Property / method | Meaning |
| --- | --- |
| `event.target` | The **deepest** element that was actually clicked. Doesn't change while the event travels. |
| `event.currentTarget` | The element whose listener is running **right now**. |
| `event.stopPropagation()` | Stop the event from continuing to other elements. Use sparingly: it silently breaks analytics and menus that listen higher up. |
| `event.preventDefault()` | Cancel the browser's default action (following a link, submitting a form). Doesn't stop propagation. |
| `{ passive: true }` | Promise you won't call `preventDefault()`, so scrolling can start without waiting for your handler. |
| `{ once: true }` | Remove the listener after its first call. |
| `{ signal }` | Remove the listener when an `AbortController` aborts. One signal can clean up many listeners. |

Not every event bubbles: `focus`, `blur`, `mouseenter`, `mouseleave` and `load` do **not**. For focus, listen for `focusin` / `focusout` (they bubble), or use the **capture** phase.

### Event delegation: one listener for many elements

Instead of attaching a listener to every list item, attach **one to their common parent** and look at `event.target` to see which child was clicked.

![Per-item listeners versus one delegated listener on the list](fig:delegation-tree "Delegation uses fewer listeners and works for rows added later.")

Why it matters:

- **Memory and setup cost:** one listener instead of thousands.
- **Dynamic content:** rows added later just work, no re-wiring.
- **Cleanup:** one `removeEventListener`, nothing forgotten (leaks from forgotten listeners were the previous lesson's villain).

The key tool is `element.closest(selector)`: starting at the element, it looks **up** the tree and returns the first match (or `null`). A click on a `<span>` inside a `<button>` still finds the button.

```stepper One delegated listener, one click
code:
  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button || !list.contains(button)) return;
    remove(button.dataset.id);
  });
---
line: 1
say: We register **one** click listener on the `<ul>`. It will see every click that happens anywhere inside it, because clicks **bubble** up from the elements.
Listeners registered: 1 (on the list)
Click on: (nothing yet)
---
line: 2
say: The user clicks the little icon (a `<svg>`) *inside* the third row's delete button. `event.target` is the **icon**, the deepest element. That is not the element we care about.
Click on: <svg> inside <button data-id="3">
event.target: <svg>
---
line: 2
say: `closest('button[data-id]')` walks **up** from the icon: svg → button. The button matches, so we get it back. If the click had been on plain text between rows, `closest` would return `null`.
closest(...) returns: <button data-id="3">
---
line: 3
say: Guard: the match must be **inside the list** (`list.contains(button)`). Otherwise a matching element *above* the list, if there is one, could trigger our handler by mistake. `null` also stops here.
Inside the list?: yes
---
line: 4
say: Now we know which row: `button.dataset.id` is `"3"`. One listener handled a click on an element that could have been created a second ago, and we added no code per row.
Result: remove("3")
```

### Reading the DOM in the order the browser works

Events are the *input* side. Now the *output* side.

## Part 2 · The rendering pipeline

Every frame (about every 16 ms at 60 Hz) the browser can run these steps:

![JavaScript, style, layout, paint, composite — and which CSS properties start at which step](fig:render-pipeline "The later in the pipeline a change starts, the cheaper it is.")

1. **JavaScript** — your code changes the DOM or styles.
2. **Style** — work out which CSS rules apply to which elements.
3. **Layout** — compute every element's **size and position**. Changing one box can move many others.
4. **Paint** — fill in pixels: text, colours, borders, shadows.
5. **Composite** — stack the painted layers on the GPU. Layers can move or fade **without** repainting.

So the cheapest animations use **`transform`** and **`opacity`**; animating `width`, `top` or `margin` triggers layout every frame.

### Layout thrashing

The browser is lazy on purpose: if you change styles three times in a row, it **waits** and recalculates layout once. But when you **read** a layout-dependent value (`offsetHeight`, `getBoundingClientRect()`, `scrollTop`…) right after a **write**, it can't wait anymore. It must **recalculate layout immediately** to give you a correct answer. That is a *forced synchronous layout*.

Do that inside a loop — write, read, write, read — and you force layout **every iteration**. That's **layout thrashing**.

![Interleaved read/write forces layout on every read; batching reads then writes needs one layout](fig:layout-thrash "Group your reads together and your writes together.")

You can see the cost with a tiny model of the browser. The `layouts` counter goes up only when a read finds pending writes:

```js try
function makeBrowser() {
  const dom = { dirty: false, layouts: 0, heights: [10, 10, 10] };
  return {
    read: (i) => { if (dom.dirty) { dom.layouts++; dom.dirty = false; } return dom.heights[i]; },
    write: (i, h) => { dom.heights[i] = h; dom.dirty = true; },
    layouts: () => dom.layouts,
  };
}

// Interleaved: read, write, read, write, ...
const a = makeBrowser();
for (let i = 0; i < 3; i++) a.write(i, a.read(i) + 5);

// Batched: all reads first, then all writes.
const b = makeBrowser();
const heights = [0, 1, 2].map((i) => b.read(i));
heights.forEach((h, i) => b.write(i, h + 5));

console.log('interleaved layouts:', a.layouts(), '· batched layouts:', b.layouts());
```

The fix is a habit, and a small scheduler:

- **Read first, write after.** Collect measurements into variables, then apply all changes.
- **Use `requestAnimationFrame`** to make DOM writes happen once per frame, right before the browser paints.
- A tiny **frame batcher** lets any part of your code say "`read` this" or "`write` that" and guarantees *all reads of a frame run before all writes*. You'll build one.

### Other tools worth knowing

- **`IntersectionObserver`** tells you when an element enters or leaves the viewport (or a margin around it) **without scroll listeners**. Perfect for lazy-loading images, infinite scroll and "seen" analytics. You'll use it for lazy images.
- **`MutationObserver`** tells you when the DOM changes (children added, attributes edited), batched as a microtask.
- **`ResizeObserver`** tells you when an element's size changes.
- **`requestIdleCallback`** runs low-priority work when the browser is idle.
- **`DocumentFragment`** and `append(...many)` build a batch of nodes off-DOM and insert them in one go.

All three observers are **callbacks that fire later with a list of entries**, and all must be **disconnected** when you're done (another leak source).

## Testing without a real browser

The exercises run in a simulated DOM (jsdom). It has `document`, `querySelector`, events and `closest`, but **no layout and no `IntersectionObserver`**. For the observer exercise, the tests install a tiny **fake** with a `trigger(element, isIntersecting)` method, which is also how you'd unit-test this in a real project.

## Quick check

```check
Q: What does `event.target` refer to during a click that bubbles through several elements?
A) The element whose listener is running right now
B) The deepest element that was actually clicked *
C) The document
D) The first element with a click listener
Why: `target` stays the same for the whole trip. The element whose listener is running is `currentTarget`.
---
Q: Why does event delegation work for rows added after the listener was attached?
A) The browser re-attaches listeners automatically
B) Because the listener lives on the parent, and clicks on new children still bubble up to it *
C) Because `querySelectorAll` is live
D) It doesn't: you must re-attach
Why: Bubbling means the parent sees events from any descendant, whenever it was created.
---
Q: Which of these does NOT bubble?
A) click
B) keydown
C) focus *
D) input
Why: `focus` and `blur` don't bubble. Use `focusin` / `focusout`, or the capture phase.
---
Q: Which line forces the browser to recalculate layout immediately?
A) `el.style.width = '100px'`
B) `el.classList.add('open')`
C) `const h = el.offsetHeight` right after changing styles *
D) `el.remove()`
Why: Reading a layout value after a pending write needs up-to-date geometry, so layout runs synchronously.
---
Q: Which animation is the cheapest for the browser?
A) Animating `left`
B) Animating `width`
C) Animating `margin-top`
D) Animating `transform` *
Why: `transform` (and `opacity`) skip layout and paint; the compositor moves existing layers.
```

## Recap

- Events travel **capture → target → bubble**. `target` is the deepest element, `currentTarget` is where the listener lives.
- **Delegate**: one listener on a parent plus `closest(selector)` handles any number of children, including future ones. Always check the match is inside your root. Use `focusin`/capture for non-bubbling events.
- Clean up with `removeEventListener`, `{ once }` or an **`AbortSignal`**.
- A frame is **JS → style → layout → paint → composite**. Prefer `transform`/`opacity`.
- **Layout thrashing** = write/read/write/read. **Batch**: all reads, then all writes, once per frame.
- Observers (`Intersection`, `Mutation`, `Resize`) replace polling and scroll listeners, and must be disconnected.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: which action? | `closest(selector)` and the delegation stepper |
| Event delegation helper | The stepper, `closest`, `contains`, and why focus needs capture |
| Lazy-load images | The observer idea: observe, react on intersection, unobserve, disconnect |
| Frame batcher: reads before writes | The thrashing model: one queue per kind, flushed once per frame |

%% exercise web-guided-action | Guided: which action? | 1 | js | react | actionOf | 8 | guided
Write `actionOf(el, root)`. Buttons in a toolbar carry a `data-action` attribute, and clicks may land on something *inside* a button (an icon, a `<span>`).

- Starting at `el`, find the **nearest element (itself or an ancestor)** that has a `data-action` attribute.
- It must be **strictly inside `root`**. The `root` element itself doesn't count, and neither does anything above it.
- Return that element's action (`el.dataset.action`), or `null` if there is none.

```js
// <div id="bar"><button data-action="save"><span>Save</span></button></div>
actionOf(spanElement, barElement);   // 'save'
actionOf(barElement, barElement);    // null  (the root itself is excluded)
```

%% worked
**A similar problem, solved: `rowOf(el, table)`** — find the `<tr>` that contains a clicked cell, but only inside this table.

```js
function rowOf(el, table) {
  const row = el.closest('tr');                         // ① look UP from el for the nearest <tr>
  return row && table !== row && table.contains(row) ? row : null;   // ② make sure it is inside our table
}
```

Two habits: `closest()` gives you the **nearest match going upwards** (or `null`), and `root.contains(match)` makes sure it isn't a look-alike *outside* your area (a table nested inside another table is the classic way to get this wrong). Always handle `null` before using the result.

%% explain
- **Nearest match:** a click on a `<span>` inside a button returns the button's action, and a click on the button itself works too.
- **Inside root only:** matching ancestors at or above the `root` don't count, even if they have `data-action`.
- **No match:** returns `null`.

%% nudge
- Which DOM method looks *upward* for the first element matching a selector?
- What can you call on `root` to check whether another element is inside it?

%% starter
```js
export function actionOf(el, root) {
  // Step 1 — find the nearest element with a data-action:  el.closest('[data-action]')
  // Step 2 — if there is none, return null.
  // Step 3 — it must be inside root, and not be root itself: root.contains(hit) && hit !== root
  // Step 4 — return hit.dataset.action
  return null;
}
```

%% tests
```js
function build() {
  document.body.innerHTML = `
    <div id="outer" data-action="outer-action">
      <div id="bar">
        <button id="save" data-action="save"><span id="label">Save</span></button>
        <button id="plain">Plain</button>
        <p id="text">hello</p>
      </div>
    </div>`;
  const $ = (id) => document.getElementById(id);
  return { bar: $('bar'), save: $('save'), label: $('label'), plain: $('plain'), text: $('text'), outer: $('outer') };
}

describe('actionOf', () => {
  it('reads the action from the element itself', () => {
    const d = build();
    expect(actionOf(d.save, d.bar)).toBe('save');
  });

  it('finds the action when the click lands on a child', () => {
    const d = build();
    expect(actionOf(d.label, d.bar)).toBe('save');
  });

  it('returns null when nothing has an action', () => {
    const d = build();
    expect(actionOf(d.plain, d.bar)).toBe(null);
    expect(actionOf(d.text, d.bar)).toBe(null);
  });

  it('ignores a matching ancestor outside the root', () => {
    const d = build();
    expect(actionOf(d.bar, d.bar)).toBe(null);
    expect(actionOf(d.plain, d.bar)).toBe(null);
  });

  it('does not count the root itself', () => {
    const d = build();
    expect(actionOf(d.outer, d.outer)).toBe(null);
  });
});
```

%% hints
- `const hit = el.closest('[data-action]');`
- `if (!hit || hit === root || !root.contains(hit)) return null;`
- `return hit.dataset.action;`

%% solution
```js
export function actionOf(el, root) {
  const hit = el.closest('[data-action]');
  if (!hit || hit === root || !root.contains(hit)) return null;
  return hit.dataset.action;
}
```

%% exercise web-delegate | Event delegation helper | 2 | js | react | delegate | 25
Write `delegate(root, type, selector, handler)`: attach **one** listener to `root` that runs `handler` for events coming from elements that match `selector`.

- Use `event.target.closest(selector)`. The match must be **inside `root`** (not `root` itself, not anything above it). If there is no valid match, do nothing.
- Call `handler.call(match, event, match)`: `this` and the second argument are the **matched element**, not `event.target`.
- It must work for elements **added after** `delegate` was called.
- `focus`, `blur`, `mouseenter` and `mouseleave` **don't bubble**, so for those types listen in the **capture** phase. All other types use the normal bubble phase.
- Return an `off()` function that removes the listener.

```js
const off = delegate(list, 'click', 'button[data-id]', function (e, button) {
  remove(button.dataset.id);
});
```

%% worked
**A similar problem, solved: `onceOutside(root, handler)`** — call `handler` the first time the user clicks *outside* `root`, then stop listening.

```js
function onceOutside(root, handler) {
  const listener = (event) => {
    if (root.contains(event.target)) return;           // ① clicks inside are ignored
    document.removeEventListener('click', listener);   // ② stop after the first outside click
    handler(event);
  };
  document.addEventListener('click', listener);        // ③ one listener on a high ancestor
  return () => document.removeEventListener('click', listener);   // ④ always give back a way to clean up
}
```

The same shape as delegation: **one listener high up**, decide per event with `target`/`contains`, and **return the cleanup function** so callers (and React effects) can tidy up. For `delegate`, the decision is `target.closest(selector)` instead of `contains`.

%% explain
- **Matching:** clicks on a child of a matching element (a `<span>` in a `<button>`) match the button.
- **Scope:** an element above or equal to `root` never matches, even if it fits the selector.
- **Handler call:** `this` is the matched element and it's also the second argument; the first argument is the original event.
- **Dynamic content:** elements added later are handled with no extra work.
- **Non-bubbling events:** `focus`/`blur`/`mouseenter`/`mouseleave` work because the listener uses capture.
- **`off()`:** after calling it, nothing fires. Calling it twice is harmless.

%% nudge
- You only call `addEventListener` once, on `root`. What argument controls the capture phase?
- Which two checks stop a match from being above `root`?

%% starter
```js
export function delegate(root, type, selector, handler) {
  const capture = false; // Step 1 — which event types need capture: focus, blur, mouseenter, mouseleave?

  const listener = (event) => {
    // Step 2 — find the match:  event.target.closest(selector)
    // Step 3 — ignore it if it is missing, is root itself, or is not inside root
    // Step 4 — handler.call(match, event, match)
  };

  root.addEventListener(type, listener, capture);
  return () => root.removeEventListener(type, listener, capture);
}
```

%% tests
```js
function setup() {
  document.body.innerHTML = `
    <div id="box" class="item">
      <ul id="list">
        <li><button data-id="1" class="del"><span>one</span></button></li>
        <li><button data-id="2" class="del">two</button></li>
      </ul>
      <input id="field" />
    </div>`;
  return { box: document.getElementById('box'), list: document.getElementById('list'), field: document.getElementById('field') };
}
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('delegate', () => {
  it('calls the handler for matching elements', () => {
    const { list } = setup();
    const seen = [];
    delegate(list, 'click', 'button.del', (e, el) => seen.push(el.dataset.id));
    click(list.querySelector('[data-id="2"]'));
    expect(seen).toEqual(['2']);
  });

  it('matches through a nested child', () => {
    const { list } = setup();
    const seen = [];
    delegate(list, 'click', 'button.del', (e, el) => seen.push(el.dataset.id));
    click(list.querySelector('[data-id="1"] span'));
    expect(seen).toEqual(['1']);
  });

  it('ignores clicks that do not match', () => {
    const { list } = setup();
    const fn = jest.fn();
    delegate(list, 'click', 'button.del', fn);
    click(list.querySelector('li'));
    click(list);
    expect(fn).not.toHaveBeenCalled();
  });

  it('works for elements added later', () => {
    const { list } = setup();
    const seen = [];
    delegate(list, 'click', 'button.del', (e, el) => seen.push(el.dataset.id));
    const li = document.createElement('li');
    li.innerHTML = '<button data-id="3" class="del">three</button>';
    list.appendChild(li);
    click(li.querySelector('button'));
    expect(seen).toEqual(['3']);
  });

  it('passes the event, sets this and the second argument to the matched element', () => {
    const { list } = setup();
    let args;
    delegate(list, 'click', 'button.del', function (event, el) { args = { self: this, el, type: event.type, target: event.target }; });
    const span = list.querySelector('[data-id="1"] span');
    click(span);
    expect(args.self).toBe(list.querySelector('[data-id="1"]'));
    expect(args.el).toBe(args.self);
    expect(args.type).toBe('click');
    expect(args.target).toBe(span);
  });

  it('never matches the root or anything above it', () => {
    const { box, list } = setup();
    const fn = jest.fn();
    delegate(box, 'click', '.item', fn);
    click(list.querySelector('li'));
    click(box);
    expect(fn).not.toHaveBeenCalled();
  });

  it('works for focus, which does not bubble', () => {
    const { box, field } = setup();
    const seen = [];
    delegate(box, 'focus', 'input', (e, el) => seen.push(el.id));
    field.dispatchEvent(new Event('focus', { bubbles: false }));
    expect(seen).toEqual(['field']);
  });

  it('off() removes the listener', () => {
    const { list } = setup();
    const fn = jest.fn();
    const off = delegate(list, 'click', 'button', fn);
    click(list.querySelector('button'));
    off();
    off();
    click(list.querySelector('button'));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('registers exactly one listener on the root', () => {
    const { list } = setup();
    const add = jest.spyOn(list, 'addEventListener');
    delegate(list, 'click', 'button', () => {});
    expect(add).toHaveBeenCalledTimes(1);
  });
});
```

%% hints
- Non-bubbling types: `const capture = ['focus', 'blur', 'mouseenter', 'mouseleave'].includes(type);`
- `const match = event.target.closest?.(selector);` (a text node has no `closest`).
- `if (!match || match === root || !root.contains(match)) return;`
- `handler.call(match, event, match);`

%% solution
```js
const NON_BUBBLING = ['focus', 'blur', 'mouseenter', 'mouseleave'];

export function delegate(root, type, selector, handler) {
  const capture = NON_BUBBLING.includes(type);

  const listener = (event) => {
    const match = event.target.closest?.(selector);
    if (!match || match === root || !root.contains(match)) return;
    handler.call(match, event, match);
  };

  root.addEventListener(type, listener, capture);
  return () => root.removeEventListener(type, listener, capture);
}
```

%% exercise web-lazy | Lazy-load images | 3 | js | react | lazyLoad | 30
Write `lazyLoad(root, options?)`: images below the fold should only download when they are about to be seen.

Images are written as `<img data-src="photo.jpg">` (no `src`, so nothing downloads yet).

- Find every `img[data-src]` inside `root`.
- If `IntersectionObserver` **doesn't exist** (old browsers), load every image right away.
- Otherwise create **one** observer with `{ rootMargin: options.rootMargin ?? '200px' }` and observe each image.
- When an entry **is intersecting**: set `img.src` from `data-src`, **remove** the `data-src` attribute, and `unobserve` that image. Entries that are not intersecting are ignored.
- Return `{ disconnect() }` which disconnects the observer (and does nothing if there wasn't one).
- Load an image at most once.

%% worked
**A similar problem, solved: `onVisible(el, callback)`** — call `callback` the first time `el` scrolls into view, then stop watching.

```js
function onVisible(el, callback) {
  const observer = new IntersectionObserver((entries) => {   // ① the callback receives a LIST of entries
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;                    // ② entries also fire when an element LEAVES the view
      observer.unobserve(entry.target);                       // ③ one-shot: stop watching
      callback(entry.target);
    }
  });
  observer.observe(el);
  return () => observer.disconnect();                         // ④ give the caller a cleanup
}
```

The pattern: **create → observe → react when `isIntersecting` → unobserve → disconnect on cleanup**. For `lazyLoad` the "react" step is copying `data-src` into `src`, and you observe many elements with the same observer.

%% explain
- **Initial state:** nothing is loaded until an image intersects; images without `data-src` are ignored.
- **When intersecting:** `src` gets the value of `data-src`, the attribute is removed, and the image is unobserved.
- **One observer:** it is created with the `rootMargin` option (default `200px`).
- **Fallback:** without `IntersectionObserver`, all images load immediately.
- **`disconnect()`:** disconnects the observer.

%% nudge
- What property of an entry tells you the element is on screen?
- What do you call so the same image isn't processed again?

%% starter
```js
export function lazyLoad(root, options = {}) {
  const images = Array.from(root.querySelectorAll('img[data-src]'));

  // Step 1 — a small helper that loads one image: copy data-src to src, remove the data-src attribute.

  // Step 2 — no IntersectionObserver? Load them all now and return { disconnect() {} }.

  // Step 3 — create ONE observer with { rootMargin }. In its callback, for every entry that isIntersecting:
  //          load entry.target and observer.unobserve(entry.target).

  // Step 4 — observe every image and return { disconnect: () => observer.disconnect() }.
  return { disconnect() {} };
}
```

%% tests
```js
class FakeIO {
  static instances = [];
  constructor(callback, options) {
    this.callback = callback;
    this.options = options;
    this.observed = new Set();
    this.disconnected = false;
    FakeIO.instances.push(this);
  }
  observe(el) { this.observed.add(el); }
  unobserve(el) { this.observed.delete(el); }
  disconnect() { this.disconnected = true; this.observed.clear(); }
  trigger(el, isIntersecting) { this.callback([{ target: el, isIntersecting }], this); }
}

function setup() {
  document.body.innerHTML = `
    <div id="gallery">
      <img id="a" data-src="a.jpg">
      <img id="b" data-src="b.jpg">
      <img id="c" src="c.jpg">
    </div>`;
  return { root: document.getElementById('gallery'), a: document.getElementById('a'), b: document.getElementById('b'), c: document.getElementById('c') };
}

describe('lazyLoad', () => {
  beforeEach(() => { FakeIO.instances = []; globalThis.IntersectionObserver = FakeIO; });
  afterEach(() => { delete globalThis.IntersectionObserver; });

  it('creates one observer and observes only images with data-src', () => {
    const { root, a, b, c } = setup();
    lazyLoad(root);
    expect(FakeIO.instances.length).toBe(1);
    expect([...FakeIO.instances[0].observed]).toEqual([a, b]);
    expect(FakeIO.instances[0].observed.has(c)).toBe(false);
  });

  it('does not load anything until an image intersects', () => {
    const { root, a, b } = setup();
    lazyLoad(root);
    expect(a.getAttribute('src')).toBe(null);
    expect(b.getAttribute('src')).toBe(null);
  });

  it('uses rootMargin 200px by default and accepts an override', () => {
    const one = setup();
    lazyLoad(one.root);
    expect(FakeIO.instances[0].options.rootMargin).toBe('200px');
    const two = setup();
    lazyLoad(two.root, { rootMargin: '50px' });
    expect(FakeIO.instances[1].options.rootMargin).toBe('50px');
  });

  it('loads an image when it intersects, removes data-src and stops observing it', () => {
    const { root, a, b } = setup();
    lazyLoad(root);
    const io = FakeIO.instances[0];
    io.trigger(a, true);
    expect(a.getAttribute('src')).toBe('a.jpg');
    expect(a.hasAttribute('data-src')).toBe(false);
    expect(io.observed.has(a)).toBe(false);
    expect(io.observed.has(b)).toBe(true);
    expect(b.getAttribute('src')).toBe(null);
  });

  it('ignores entries that are not intersecting', () => {
    const { root, a } = setup();
    lazyLoad(root);
    FakeIO.instances[0].trigger(a, false);
    expect(a.getAttribute('src')).toBe(null);
    expect(FakeIO.instances[0].observed.has(a)).toBe(true);
  });

  it('handles several entries in one callback', () => {
    const { root, a, b } = setup();
    lazyLoad(root);
    const io = FakeIO.instances[0];
    io.callback([{ target: a, isIntersecting: true }, { target: b, isIntersecting: true }], io);
    expect(a.getAttribute('src')).toBe('a.jpg');
    expect(b.getAttribute('src')).toBe('b.jpg');
  });

  it('disconnect() disconnects the observer', () => {
    const { root } = setup();
    const handle = lazyLoad(root);
    handle.disconnect();
    expect(FakeIO.instances[0].disconnected).toBe(true);
  });

  it('loads everything immediately when IntersectionObserver is missing', () => {
    delete globalThis.IntersectionObserver;
    const { root, a, b, c } = setup();
    const handle = lazyLoad(root);
    expect(a.getAttribute('src')).toBe('a.jpg');
    expect(b.getAttribute('src')).toBe('b.jpg');
    expect(c.getAttribute('src')).toBe('c.jpg');
    expect(() => handle.disconnect()).not.toThrow();
  });
});
```

%% hints
- `const load = (img) => { img.src = img.dataset.src; img.removeAttribute('data-src'); };`
- `if (typeof IntersectionObserver === 'undefined') { images.forEach(load); return { disconnect() {} }; }`
- `const observer = new IntersectionObserver((entries) => { for (const entry of entries) { if (!entry.isIntersecting) continue; load(entry.target); observer.unobserve(entry.target); } }, { rootMargin: options.rootMargin ?? '200px' });`

%% solution
```js
export function lazyLoad(root, options = {}) {
  const images = Array.from(root.querySelectorAll('img[data-src]'));

  const load = (img) => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
  };

  if (typeof IntersectionObserver === 'undefined') {
    images.forEach(load);
    return { disconnect() {} };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        load(entry.target);
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: options.rootMargin ?? '200px' },
  );

  images.forEach((img) => observer.observe(img));
  return { disconnect: () => observer.disconnect() };
}
```

%% exercise web-batcher | Frame batcher: reads before writes | 3 | js | js | createFrameBatcher | 30
Build `createFrameBatcher({ raf })`, a scheduler that stops layout thrashing. It returns `{ read(fn), write(fn) }`.

- `read(fn)` and `write(fn)` **queue** `fn` and return a **promise** of its result (or its error).
- The first call in a frame schedules **one** `raf(flush)`. More calls in the same frame **don't** schedule more.
- When the frame runs, **all queued reads run first** (in the order they were queued), **then all queued writes**.
- If something is queued **while** the flush is running, it goes to the **next frame** (a new `raf` call), never into the current one.
- If a function throws, **only its own promise rejects**; all other functions still run.
- `raf` defaults to `(cb) => setTimeout(cb, 16)` when not given.

```js
const frames = [];
const batch = createFrameBatcher({ raf: (cb) => frames.push(cb) });
batch.write(() => (el.style.height = '10px'));
batch.read(() => el.offsetHeight);   // runs BEFORE the write, even though it was queued later
frames.shift()();                    // run the frame
```

%% worked
**A similar problem, solved: `createFlushQueue(schedule)`** — collect jobs and run them all once per tick, in order.

```js
function createFlushQueue(schedule = (cb) => queueMicrotask(cb)) {
  let jobs = [];
  let scheduled = false;
  function flush() {
    scheduled = false;
    const batch = jobs;                      // ① take a snapshot of the queue…
    jobs = [];                               //    …and start a fresh one for anything added during the flush
    for (const job of batch) job();
  }
  return function add(job) {
    jobs.push(job);
    if (!scheduled) { scheduled = true; schedule(flush); }   // ② schedule once, not once per job
  };
}
```

Three ideas to reuse: a `scheduled` flag so you ask for a frame only once, **swapping out the queue** at the start of a flush so late arrivals wait for the next one, and returning a promise by wrapping each job in `new Promise((resolve, reject) => …)` with a try/catch.

%% explain
- **Order:** within a frame, every read runs before every write, and each group keeps queue order.
- **One schedule per frame:** many calls make a single `raf` call until the frame has run.
- **Late additions:** functions queued during a flush wait for the next frame, which is scheduled automatically.
- **Results:** promises resolve with the function's return value (reads can return measurements).
- **Isolation:** a throwing function rejects its own promise and doesn't stop the others.

%% nudge
- You need two queues. When you start flushing, what do you do to them so new work doesn't join the running frame?
- How do you turn "run this later" into a promise that resolves with the result?

%% starter
```js
export function createFrameBatcher({ raf = (cb) => setTimeout(cb, 16) } = {}) {
  let reads = [];
  let writes = [];
  let scheduled = false;

  function flush() {
    // Step 3 — scheduled = false, take the current reads/writes and reset the queues,
    //          then run every read, then every write.
  }

  function enqueue(queue, fn) {
    // Step 1 — return a promise. Push a job into the right queue that runs fn and resolves/rejects.
    // Step 2 — if nothing is scheduled yet, scheduled = true and raf(flush).
  }

  return {
    read: (fn) => enqueue('reads', fn),
    write: (fn) => enqueue('writes', fn),
  };
}
```

%% tests
```js
function setup() {
  const frames = [];
  const batch = createFrameBatcher({ raf: (cb) => frames.push(cb) });
  const runFrame = () => { const f = frames.splice(0); f.forEach((cb) => cb()); };
  return { batch, frames, runFrame };
}

describe('createFrameBatcher', () => {
  it('runs all reads before all writes, each group in queue order', async () => {
    const { batch, runFrame } = setup();
    const log = [];
    batch.write(() => log.push('w1'));
    batch.read(() => log.push('r1'));
    batch.write(() => log.push('w2'));
    batch.read(() => log.push('r2'));
    runFrame();
    expect(log).toEqual(['r1', 'r2', 'w1', 'w2']);
  });

  it('schedules a single frame no matter how many calls', () => {
    const { batch, frames } = setup();
    batch.read(() => 1);
    batch.write(() => 2);
    batch.read(() => 3);
    expect(frames.length).toBe(1);
  });

  it('does nothing until the frame runs', () => {
    const { batch } = setup();
    const fn = jest.fn();
    batch.read(fn);
    expect(fn).not.toHaveBeenCalled();
  });

  it('resolves promises with the result', async () => {
    const { batch, runFrame } = setup();
    const a = batch.read(() => 42);
    const b = batch.write(() => 'done');
    runFrame();
    expect(await a).toBe(42);
    expect(await b).toBe('done');
  });

  it('lets reads feed writes in the same frame through promises', async () => {
    const { batch, runFrame } = setup();
    let height = 0;
    const measured = batch.read(() => 100);
    batch.write(() => { height = 5; });
    runFrame();
    expect(await measured).toBe(100);
    expect(height).toBe(5);
  });

  it('puts functions queued during a flush into the next frame', async () => {
    const { batch, frames, runFrame } = setup();
    const log = [];
    batch.read(() => {
      log.push('read');
      batch.read(() => log.push('late read'));
      batch.write(() => log.push('late write'));
    });
    batch.write(() => log.push('write'));
    runFrame();
    expect(log).toEqual(['read', 'write']);
    expect(frames.length).toBe(1);
    runFrame();
    expect(log).toEqual(['read', 'write', 'late read', 'late write']);
  });

  it('schedules a new frame after the previous one has run', () => {
    const { batch, frames, runFrame } = setup();
    batch.read(() => 1);
    runFrame();
    batch.read(() => 2);
    expect(frames.length).toBe(1);
  });

  it('rejects only the failing promise and still runs the rest', async () => {
    const { batch, runFrame } = setup();
    const log = [];
    const bad = batch.read(() => { throw new Error('boom'); });
    const good = batch.read(() => { log.push('ok'); return 'fine'; });
    batch.write(() => log.push('write'));
    runFrame();
    await expect(bad).rejects.toThrow('boom');
    expect(await good).toBe('fine');
    expect(log).toEqual(['ok', 'write']);
  });

  it('defaults to a timer when no raf is given', async () => {
    jest.useFakeTimers();
    const batch = createFrameBatcher();
    const p = batch.read(() => 'timed');
    await jest.advanceTimersByTimeAsync(20);
    expect(await p).toBe('timed');
    jest.useRealTimers();
  });
});
```

%% hints
- `return new Promise((resolve, reject) => { (queue === 'reads' ? reads : writes).push(() => { try { resolve(fn()); } catch (e) { reject(e); } }); ... })`
- In `flush`: `const r = reads, w = writes; reads = []; writes = []; scheduled = false; r.forEach((job) => job()); w.forEach((job) => job());`
- Set `scheduled = false` **before** running jobs so work queued by a job schedules the next frame.

%% solution
```js
export function createFrameBatcher({ raf = (cb) => setTimeout(cb, 16) } = {}) {
  let reads = [];
  let writes = [];
  let scheduled = false;

  function flush() {
    scheduled = false;
    const r = reads;
    const w = writes;
    reads = [];
    writes = [];
    r.forEach((job) => job());
    w.forEach((job) => job());
  }

  function enqueue(kind, fn) {
    return new Promise((resolve, reject) => {
      const job = () => {
        try { resolve(fn()); } catch (error) { reject(error); }
      };
      (kind === 'reads' ? reads : writes).push(job);
      if (!scheduled) {
        scheduled = true;
        raf(flush);
      }
    });
  }

  return {
    read: (fn) => enqueue('reads', fn),
    write: (fn) => enqueue('writes', fn),
  };
}
```
