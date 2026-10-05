---
id: rd-hydration-streaming-rsc
track: rd
title: Hydration, streaming and Server Components
summary: Why a server-rendered page can look ready and ignore clicks, how hydration mismatches happen and are found, how streaming sends the shell first and fills slots as data arrives, and how the server/client component boundary decides what JavaScript ships.
---

## The idea in one sentence

Server rendering gets pixels on screen early, but **JavaScript still has to catch up**; hydration, streaming and Server Components are three ways of **shrinking or hiding that catch-up**.

> **Analogy** A flat-pack wardrobe delivered fully assembled (SSR) still needs its **doors hung** (hydration) before it works. Streaming delivers the frame first and the shelves as they come off the line. Server Components ship the parts that never move **already glued**, with no assembly instructions at all.

*(In Next.js and React: `hydrateRoot`, `<Suspense>` with streaming, `loading.js`, `"use client"`, and Server Components that `await` their data. You will build the logic framework-free.)*

## Hydration

![Hydration](fig:rd-hydration "The dead zone between 'visible' and 'interactive'.")

The server sends **finished HTML**. The browser paints it immediately. Then the JavaScript bundle downloads and runs, and React **walks the existing HTML**, attaches event handlers and takes over. This is **hydration**. Until it completes the page is in the **dead zone**: it looks ready but ignores clicks.

The rule that makes hydration possible: the **first client render must produce the same markup** as the server did. If it does not (a **hydration mismatch**), React warns and may have to throw the server HTML away and re-render everything on the client.

Common causes: `Date.now()` or `new Date()` output, `Math.random()` ids, `typeof window` checks that change the output, locale or time-zone differences between server and browser, and invalid HTML nesting the browser "fixes".

```js try predict
const view = ({ mounted, now }) => '<p>' + (mounted ? 'Time: ' + now : 'Loading time…') + '</p>';

const server = view({ mounted: false, now: 1000 });
const firstClient = view({ mounted: false, now: 1500 });   // same markup: hydrates cleanly
const afterEffect = view({ mounted: true, now: 1500 });    // changed AFTER mount, in an effect

console.log(server === firstClient, afterEffect);
```

The safe pattern: render something **deterministic** first (a placeholder), then update it in an **effect** once mounted.

```stepper Hydration, step by step
code:
  server:  <button>Like (0)</button>      → sent as HTML
  browser: paints the button               → visible
  browser: downloads + runs the bundle     → still inert
  react:   walks the HTML, attaches onClick → interactive
---
line: 1
say: The server renders the component to a **string** and sends it. It contains the markup but **no behavior**.
phase: server HTML
---
line: 2
say: The browser paints the button. The user sees it, and may try to **click it**.
phase: first paint
---
line: 3
say: The JavaScript is still downloading and executing. Clicks here are **lost**: this is the dead zone, which long bundles stretch out.
phase: dead zone
---
line: 4
say: React renders the component **again in the browser**, checks that it matches the HTML, and attaches `onClick` to the **existing** button instead of creating a new one.
phase: hydrate
---
line: 4
say: If the browser render had produced `Like (1)` instead of `Like (0)`, that is a **mismatch**: a warning, and a possible full re-render.
phase: mismatch
```

## Streaming

![Streaming](fig:rd-streaming "Shell first; each section as its data resolves.")

Plain SSR **waits for the slowest query** before sending a single byte. **Streaming** sends the **shell** immediately, with a **fallback** in each slot (a Suspense boundary), then streams each section **as its data resolves**, in **completion order**. A few details a real implementation must get right:

- start **every** data load **at once** (in parallel), not one after another;
- send the shell **before** any load finishes;
- a **failing** section sends an error marker for that slot; the rest of the page **keeps streaming**.

## Server Components

![Server and client components](fig:rd-rsc "A 'use client' file pulls its whole import subtree into the bundle.")

A **Server Component** runs only on the server: it can `await` a database call directly, and it ships **no JavaScript** to the browser. A **Client Component** (marked `"use client"`) is the one that can use state, effects and event handlers. Three rules decide what you pay:

- The **boundary** is the file marked `"use client"`: it and **everything it imports** go into the bundle.
- A server component can be **passed into** a client component as **`children`** and **stays on the server**.
- Props crossing the boundary must be **serializable** (no functions, no class instances).

So **push the boundary down**: make the small interactive leaf a client component, not the whole page.

## Quick check

```check
Q: What is a hydration mismatch?
A) The server is slow
B) The first client render produces different markup from the server HTML *
C) Two components share a key
D) A bundle that is too large
Why: Hydration reuses the server HTML, which only works if the first client render matches it.
---
Q: Which of these is a classic cause of a hydration mismatch?
A) Using CSS modules
B) Rendering new Date() or Math.random() output directly *
C) Using fetch
D) Using a key prop
Why: The server and the browser produce different values.
---
Q: What does streaming change about plain server rendering?
A) Nothing is cached any more
B) The shell is sent at once and slow sections fill in as they resolve *
C) JavaScript is no longer needed
D) The server renders on the client
Why: The first byte no longer waits for the slowest data.
---
Q: A client component imports a heavy charting library. What ships to the browser?
A) Only the component
B) The component and the library it imports *
C) Nothing; libraries stay on the server
D) Only the library
Why: A "use client" boundary pulls its whole import subtree into the bundle.
```

## Recap

- **Hydration** attaches behavior to server HTML; until then the page is in a **dead zone**.
- The first client render must **match** the server HTML; use effects for anything that differs.
- **Streaming**: shell first, **parallel** loads, fills in **completion order**, errors **isolated** per slot.
- **Server Components** ship no JS and can await data; **Client Components** are the interactive leaves.
- The `"use client"` boundary pulls in its **import subtree**, but **children passed from a server parent stay on the server**. Push the boundary down.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: client or server? | `some` over a few flags |
| Find hydration mismatches | Recursive tree comparison and path building |
| Stream a page | An async generator, parallel promises, racing to the first settled |
| What ships to the client | A tree walk that carries a "context" flag |
| Tests for a streamer | Deferred promises, a manual async iterator, and detecting "blocked" |

%% exercise rdl-guided-client | Guided: client or server? | 1 | js | js | isClientComponent | 8 | guided
Implement `isClientComponent(c)` for a component description `{ usesState, usesEffect, usesBrowserApi, hasHandlers }` (any field may be missing).

It must be a **client component** (return `true`) when **any** of the four is truthy; otherwise it can stay on the server (`false`).

```js
isClientComponent({ usesState: true });           // true
isClientComponent({});                            // false
```

%% worked
**A similar problem, solved: `needsPermission(feature)`** — "true if any of these needs are present".

```js
function needsPermission(f) {
  return Boolean(f.camera || f.microphone || f.location);   // ① any truthy flag; missing fields are just undefined
}
```

Wrapping in `Boolean(...)` makes the result a real `true`/`false` instead of whatever the last operand was.

%% explain
- **Any one flag** is enough.
- **Missing fields** count as false.
- Return an actual **boolean**.

%% nudge
- What does `undefined || undefined` evaluate to?

%% starter
```js
export function isClientComponent(c) {
  return false;
}
```

%% tests
```js
describe('isClientComponent', () => {
  it('is false for a plain component', () => {
    expect(isClientComponent({})).toBe(false);
    expect(isClientComponent({ usesState: false, hasHandlers: false })).toBe(false);
  });
  it('is true when any capability is used', () => {
    expect(isClientComponent({ usesState: true })).toBe(true);
    expect(isClientComponent({ usesEffect: true })).toBe(true);
    expect(isClientComponent({ usesBrowserApi: true })).toBe(true);
    expect(isClientComponent({ hasHandlers: true })).toBe(true);
  });
  it('returns real booleans', () => {
    expect(isClientComponent({ usesState: 1 })).toBe(true);
    expect(isClientComponent({ usesState: 0, usesEffect: '' })).toBe(false);
  });
});
```

%% hints
- `return Boolean(c.usesState || c.usesEffect || c.usesBrowserApi || c.hasHandlers);`

%% solution
```js
export function isClientComponent(c) {
  return Boolean(c.usesState || c.usesEffect || c.usesBrowserApi || c.hasHandlers);
}
```

%% exercise rdl-mismatches | Find hydration mismatches | 3 | js | js | findMismatches | 28
Compare the server's tree with the client's first render and report every difference.

A node is either a **string** (text) or `{ tag, attrs, children }` (`attrs` and `children` optional). `findMismatches(server, client)` returns a list of `{ path, kind, ... }` in this order and shape. Paths: the root is `'/'`, and the child at index `i` of a node at path `P` has path `P + '/' + i` (the root's children are `'/0'`, `'/1'`, then `'/0/2'`…).

- Both text and different: `{ path, kind: 'text', server, client }`.
- One text and one element: `{ path, kind: 'type', server, client }` where each side is the text, or the tag name for an element. Do not go deeper.
- Different tags: `{ path, kind: 'tag', server, client }`. Do not go deeper.
- Same tag: first every **attribute** that differs (names sorted alphabetically): `{ path, kind: 'attr', name, server, client }` (a missing attribute is `undefined`); then compare the children **pairwise** over the shorter list, recursing; finally, if the child counts differ, `{ path, kind: 'children', server: serverCount, client: clientCount }`.

```js
findMismatches({ tag: 'p', children: ['Time: 10:00'] }, { tag: 'p', children: ['Time: 10:01'] });
// [{ path: '/0', kind: 'text', server: 'Time: 10:00', client: 'Time: 10:01' }]
```

%% worked
**A similar problem, solved: `diffLists(a, b)`** — compare two lists pairwise, then report a length difference.

```js
function diffLists(a, b, path = '') {
  const out = [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) out.push({ path: path + '/' + i, a: a[i], b: b[i] });   // ① index becomes part of the path
  }
  if (a.length !== b.length) out.push({ path, kind: 'length', a: a.length, b: b.length });   // ② the extras are ONE finding
  return out;
}
```

For trees the same shape recurses: the child path is the parent path plus `'/' + i`, with the **root** as the special case `'/'` (so its children are `'/0'`, not `'//0'`).

%% explain
- **`walk(s, c, path)`** handles the four cases: both text, text vs element, different tags, same tag.
- **Attributes** over the sorted union of names.
- **Children** pairwise, then the count check.

%% nudge
- How do you build a child path from the root `'/'`?
- Why stop at a differing tag instead of comparing children?

%% starter
```js
export function findMismatches(server, client) {
  return [];
}
```

%% tests
```js
describe('findMismatches', () => {
  it('finds nothing for identical trees', () => {
    const tree = { tag: 'div', attrs: { id: 'a' }, children: ['hi', { tag: 'p', children: ['x'] }] };
    expect(findMismatches(tree, JSON.parse(JSON.stringify(tree)))).toEqual([]);
    expect(findMismatches('same', 'same')).toEqual([]);
  });
  it('reports text differences with the path of the child', () => {
    expect(findMismatches({ tag: 'p', children: ['Time: 10:00'] }, { tag: 'p', children: ['Time: 10:01'] })).toEqual([
      { path: '/0', kind: 'text', server: 'Time: 10:00', client: 'Time: 10:01' },
    ]);
  });
  it('reports a text difference at the root', () => {
    expect(findMismatches('a', 'b')).toEqual([{ path: '/', kind: 'text', server: 'a', client: 'b' }]);
  });
  it('reports a text-versus-element difference and does not descend', () => {
    expect(findMismatches({ tag: 'div', children: ['hello'] }, { tag: 'div', children: [{ tag: 'b', children: ['hello'] }] })).toEqual([
      { path: '/0', kind: 'type', server: 'hello', client: 'b' },
    ]);
    expect(findMismatches({ tag: 'i' }, 'text')).toEqual([{ path: '/', kind: 'type', server: 'i', client: 'text' }]);
  });
  it('reports different tags and does not descend', () => {
    expect(findMismatches({ tag: 'div', children: ['a'] }, { tag: 'span', children: ['b'] })).toEqual([
      { path: '/', kind: 'tag', server: 'div', client: 'span' },
    ]);
  });
  it('reports attribute differences, sorted by name, including missing ones', () => {
    const server = { tag: 'a', attrs: { href: '/x', class: 'big' } };
    const client = { tag: 'a', attrs: { href: '/y', 'data-js': '1' } };
    expect(findMismatches(server, client)).toEqual([
      { path: '/', kind: 'attr', name: 'class', server: 'big', client: undefined },
      { path: '/', kind: 'attr', name: 'data-js', server: undefined, client: '1' },
      { path: '/', kind: 'attr', name: 'href', server: '/x', client: '/y' },
    ]);
  });
  it('treats missing attrs and an empty attrs object the same', () => {
    expect(findMismatches({ tag: 'p' }, { tag: 'p', attrs: {} })).toEqual([]);
  });
  it('builds nested paths', () => {
    const server = { tag: 'ul', children: [{ tag: 'li', children: ['a'] }, { tag: 'li', children: ['b', { tag: 'em', children: ['c'] }] }] };
    const client = { tag: 'ul', children: [{ tag: 'li', children: ['a'] }, { tag: 'li', children: ['b', { tag: 'em', children: ['X'] }] }] };
    expect(findMismatches(server, client)).toEqual([{ path: '/1/1/0', kind: 'text', server: 'c', client: 'X' }]);
  });
  it('reports a child count difference after the pairwise findings', () => {
    const server = { tag: 'ul', children: ['a', 'b', 'c'] };
    const client = { tag: 'ul', children: ['a', 'X'] };
    expect(findMismatches(server, client)).toEqual([
      { path: '/1', kind: 'text', server: 'b', client: 'X' },
      { path: '/', kind: 'children', server: 3, client: 2 },
    ]);
  });
  it('reports attributes before children', () => {
    const server = { tag: 'p', attrs: { id: 'a' }, children: ['x'] };
    const client = { tag: 'p', attrs: { id: 'b' }, children: ['y'] };
    expect(findMismatches(server, client).map((m) => m.kind)).toEqual(['attr', 'text']);
  });
});
```

%% hints
- `const childPath = (path, i) => (path === '/' ? '/' + i : path + '/' + i);`
- Attribute names: `[...new Set([...Object.keys(sa), ...Object.keys(ca)])].sort()`.
- Missing arrays: `s.children ?? []`.

%% solution
```js
export function findMismatches(server, client) {
  const out = [];
  const childPath = (path, i) => (path === '/' ? '/' + i : path + '/' + i);

  const walk = (s, c, path) => {
    const sText = typeof s === 'string';
    const cText = typeof c === 'string';
    if (sText && cText) {
      if (s !== c) out.push({ path, kind: 'text', server: s, client: c });
      return;
    }
    if (sText || cText) {
      out.push({ path, kind: 'type', server: sText ? s : s.tag, client: cText ? c : c.tag });
      return;
    }
    if (s.tag !== c.tag) {
      out.push({ path, kind: 'tag', server: s.tag, client: c.tag });
      return;
    }
    const sa = s.attrs ?? {};
    const ca = c.attrs ?? {};
    for (const name of [...new Set([...Object.keys(sa), ...Object.keys(ca)])].sort()) {
      if (sa[name] !== ca[name]) out.push({ path, kind: 'attr', name, server: sa[name], client: ca[name] });
    }
    const sk = s.children ?? [];
    const ck = c.children ?? [];
    const n = Math.min(sk.length, ck.length);
    for (let i = 0; i < n; i++) walk(sk[i], ck[i], childPath(path, i));
    if (sk.length !== ck.length) out.push({ path, kind: 'children', server: sk.length, client: ck.length });
  };

  walk(server, client, '/');
  return out;
}
```

%% exercise rdl-stream-page | Stream a page with slots | 4 | js | js | streamPage | 40
`streamPage({ shell, boundaries })` is an **async generator** that yields HTML chunks (strings).

`shell` is a string that may contain slot markers `<!--slot:NAME-->`. Each boundary is `{ name, fallback, load }` where `load()` returns (or resolves to) the section's HTML, or fails.

- **Start every `load()` immediately** when iteration begins (all in parallel), **before** the first chunk is yielded.
- The **first chunk** is the shell with each marker replaced by `<div id="slot-NAME">FALLBACK</div>`. It is yielded **without waiting for any load**.
- Then, for each boundary **in completion order** (whichever settles first), yield `<template data-fill="NAME">HTML</template>`; if its load **fails**, yield `<template data-error="NAME"></template>` instead and keep going.
- After the last chunk, the generator finishes. A boundary whose marker is missing from the shell still produces its chunk.

```js
for await (const chunk of streamPage({
  shell: '<main><!--slot:reviews--></main>',
  boundaries: [{ name: 'reviews', fallback: 'Loading…', load: async () => '<ul></ul>' }],
})) console.log(chunk);
// <main><div id="slot-reviews">Loading…</div></main>
// <template data-fill="reviews"><ul></ul></template>
```

%% worked
**A similar problem, solved: `raceInOrder(tasks)`** — yield results in **completion order** by repeatedly racing what is still pending.

```js
export async function* raceInOrder(tasks) {
  const pending = new Map(tasks.map((t) => [t.name, new Promise((resolve) => resolve(t.run()))
    .then((value) => ({ name: t.name, value }))]));                      // ① start ALL of them now; tag each result with its name
  while (pending.size > 0) {
    const done = await Promise.race(pending.values());                   // ② whichever settles first
    pending.delete(done.name);                                           // ③ remove it so it is not raced again
    yield done;
  }
}
```

Your version adds the shell first, converts a **rejection into a value** (so one failure cannot reject the race and end the stream), and builds the template strings.

%% explain
- **Start loads** (map to promises) before the first `yield`.
- **Convert errors to results** inside each promise.
- **Race the pending set**, delete the winner, yield its chunk.

%% nudge
- Where must the `.catch`/rejection handler go so one failure does not end the stream?
- Why start the loads *before* yielding the shell?

%% starter
```js
export async function* streamPage({ shell, boundaries }) {
  yield shell;
}
```

%% tests
```js
describe('streamPage', () => {
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };
  const collect = async (gen) => {
    const out = [];
    for await (const chunk of gen) out.push(chunk);
    return out;
  };
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

  it('sends the shell with fallbacks, then the fills', async () => {
    const chunks = await collect(streamPage({
      shell: '<main><!--slot:a--></main>',
      boundaries: [{ name: 'a', fallback: 'Loading…', load: async () => '<p>A</p>' }],
    }));
    expect(chunks).toEqual([
      '<main><div id="slot-a">Loading…</div></main>',
      '<template data-fill="a"><p>A</p></template>',
    ]);
  });
  it('yields the shell before any load has finished', async () => {
    const a = deferred();
    const it = streamPage({ shell: '<!--slot:a-->', boundaries: [{ name: 'a', fallback: 'F', load: () => a.promise }] })[Symbol.asyncIterator]();
    const first = await Promise.race([it.next(), flush().then(() => 'blocked')]);
    expect(first).not.toBe('blocked');
    expect(first.value).toBe('<div id="slot-a">F</div>');
    a.resolve('done');
    expect((await it.next()).value).toBe('<template data-fill="a">done</template>');
    expect((await it.next()).done).toBe(true);
  });
  it('starts every load in parallel, immediately', async () => {
    const loads = [deferred(), deferred(), deferred()];
    const calls = [];
    const boundaries = loads.map((d, i) => ({ name: 'b' + i, fallback: '', load: () => { calls.push(i); return d.promise; } }));
    const it = streamPage({ shell: '', boundaries })[Symbol.asyncIterator]();
    await it.next();
    expect(calls).toEqual([0, 1, 2]);
    loads.forEach((d) => d.resolve('x'));
    await flush();
  });
  it('yields fills in completion order, not declaration order', async () => {
    const slow = deferred();
    const fast = deferred();
    const it = streamPage({
      shell: '<!--slot:slow--><!--slot:fast-->',
      boundaries: [
        { name: 'slow', fallback: 's', load: () => slow.promise },
        { name: 'fast', fallback: 'f', load: () => fast.promise },
      ],
    })[Symbol.asyncIterator]();
    await it.next();
    fast.resolve('<p>fast</p>');
    expect((await it.next()).value).toBe('<template data-fill="fast"><p>fast</p></template>');
    slow.resolve('<p>slow</p>');
    expect((await it.next()).value).toBe('<template data-fill="slow"><p>slow</p></template>');
    expect((await it.next()).done).toBe(true);
  });
  it('turns a failing load into an error chunk and keeps streaming', async () => {
    const chunks = await collect(streamPage({
      shell: '<!--slot:a--><!--slot:b-->',
      boundaries: [
        { name: 'a', fallback: 'A', load: async () => { throw new Error('db down'); } },
        { name: 'b', fallback: 'B', load: async () => 'ok' },
      ],
    }));
    expect(chunks[0]).toBe('<div id="slot-a">A</div><div id="slot-b">B</div>');
    expect(chunks.slice(1).sort()).toEqual(['<template data-error="a"></template>', '<template data-fill="b">ok</template>']);
    expect(JSON.stringify(chunks)).not.toContain('db down');
  });
  it('handles a synchronously throwing or non-promise load', async () => {
    const chunks = await collect(streamPage({
      shell: '<!--slot:a--><!--slot:b-->',
      boundaries: [
        { name: 'a', fallback: '', load: () => { throw new Error('sync'); } },
        { name: 'b', fallback: '', load: () => '<i>plain</i>' },
      ],
    }));
    expect(chunks.slice(1).sort()).toEqual(['<template data-error="a"></template>', '<template data-fill="b"><i>plain</i></template>']);
  });
  it('still streams a boundary whose marker is not in the shell', async () => {
    const chunks = await collect(streamPage({ shell: '<main></main>', boundaries: [{ name: 'x', fallback: 'F', load: async () => 'X' }] }));
    expect(chunks).toEqual(['<main></main>', '<template data-fill="x">X</template>']);
  });
  it('works with no boundaries', async () => {
    expect(await collect(streamPage({ shell: '<p>static</p>', boundaries: [] }))).toEqual(['<p>static</p>']);
  });
});
```

%% hints
- Build the first chunk with a loop of `replace('<!--slot:' + b.name + '-->', ...)`.
- Per boundary: `new Promise((r) => r(b.load())).then((html) => ({ name, chunk: ... }), () => ({ name, chunk: ... }))` (a sync throw becomes a rejection).
- Create the map of pending promises **before** `yield shell`.
- Race `pending.values()`, delete the winner's name, `yield done.chunk`.

%% solution
```js
export async function* streamPage({ shell, boundaries }) {
  let html = shell;
  for (const b of boundaries) {
    html = html.replace('<!--slot:' + b.name + '-->', `<div id="slot-${b.name}">${b.fallback}</div>`);
  }

  const pending = new Map(
    boundaries.map((b) => [
      b.name,
      new Promise((resolve) => resolve(b.load())).then(
        (content) => ({ name: b.name, chunk: `<template data-fill="${b.name}">${content}</template>` }),
        () => ({ name: b.name, chunk: `<template data-error="${b.name}"></template>` }),
      ),
    ]),
  );

  yield html;

  while (pending.size > 0) {
    const done = await Promise.race(pending.values());
    pending.delete(done.name);
    yield done.chunk;
  }
}
```

%% exercise rdl-client-bytes | What ships to the client | 4 | js | js | shippedToClient | 30
A component tree is `{ name, size, client, asChildren, children }` (`size` in bytes; `client` marks `"use client"`; `asChildren` marks a node that a **server** parent passed into a client component as `children`; `children` is optional).

`shippedToClient(root)` returns `{ names, bytes }`: the names (in pre-order) and total size of the components whose code must be sent to the browser.

- A node **ships** if it is marked `client`, **or** it sits **inside** a client component's import subtree and is **not** `asChildren`.
- A node that does not ship (a plain server node, or an `asChildren` node) starts a **server context**: its children are in the client subtree only if they are `client` themselves.
- A shipped node puts its children in the client subtree.

```js
const tree = { name: 'Page', size: 5, children: [
  { name: 'Like', size: 8, client: true, children: [{ name: 'Icon', size: 2 }, { name: 'Reviews', size: 30, asChildren: true }] },
] };
shippedToClient(tree); // { names: ['Like', 'Icon'], bytes: 10 }
```

%% worked
**A similar problem, solved: `lockedItems(tree)`** — walk a tree carrying a **flag from the parent** that children inherit unless something resets it.

```js
function lockedItems(node, inLocked = false, out = []) {
  const locked = node.locked || (inLocked && !node.unlocked);     // ① this node's state from its own flags AND its parent's
  if (locked) out.push(node.name);
  for (const child of node.children ?? []) lockedItems(child, locked, out);   // ② the child inherits THIS node's state
  return out;
}
```

The only twist here: an `asChildren` node **resets** the flag for everything below it, because the whole subtree was created on the server.

%% explain
- **Recursive walk** with an `inClient` parameter.
- **Ships** = `client || (inClient && !asChildren)`.
- **Children inherit** whether this node shipped.

%% nudge
- What does a server component passed as `children` do to the context of its own children?
- Does a client component inside a server subtree start a new client subtree?

%% starter
```js
export function shippedToClient(root) {
  return { names: [], bytes: 0 };
}
```

%% tests
```js
describe('shippedToClient', () => {
  it('ships nothing for an all-server tree', () => {
    const tree = { name: 'Page', size: 10, children: [{ name: 'List', size: 20 }] };
    expect(shippedToClient(tree)).toEqual({ names: [], bytes: 0 });
  });
  it('ships a client component and its imports', () => {
    const tree = { name: 'Page', size: 5, children: [
      { name: 'Like', size: 8, client: true, children: [{ name: 'Icon', size: 2 }, { name: 'Tooltip', size: 3, children: [{ name: 'Arrow', size: 1 }] }] },
      { name: 'Footer', size: 4 },
    ] };
    expect(shippedToClient(tree)).toEqual({ names: ['Like', 'Icon', 'Tooltip', 'Arrow'], bytes: 14 });
  });
  it('keeps server children passed as children on the server', () => {
    const tree = { name: 'Page', size: 5, children: [
      { name: 'Like', size: 8, client: true, children: [{ name: 'Icon', size: 2 }, { name: 'Reviews', size: 30, asChildren: true }] },
    ] };
    expect(shippedToClient(tree)).toEqual({ names: ['Like', 'Icon'], bytes: 10 });
  });
  it('lets the children of a passed server component stay on the server', () => {
    const tree = { name: 'Like', size: 8, client: true, children: [
      { name: 'Reviews', size: 30, asChildren: true, children: [{ name: 'Stars', size: 6 }] },
    ] };
    expect(shippedToClient(tree)).toEqual({ names: ['Like'], bytes: 8 });
  });
  it('starts a new client subtree for a client component under a passed server component', () => {
    const tree = { name: 'Modal', size: 9, client: true, children: [
      { name: 'Content', size: 30, asChildren: true, children: [{ name: 'Vote', size: 4, client: true, children: [{ name: 'Spark', size: 1 }] }] },
    ] };
    expect(shippedToClient(tree)).toEqual({ names: ['Modal', 'Vote', 'Spark'], bytes: 14 });
  });
  it('treats a client root as the start of a client subtree', () => {
    expect(shippedToClient({ name: 'App', size: 50, client: true, children: [{ name: 'X', size: 5 }] })).toEqual({ names: ['App', 'X'], bytes: 55 });
  });
  it('lists names in pre-order', () => {
    const tree = { name: 'A', size: 1, client: true, children: [{ name: 'B', size: 1, children: [{ name: 'C', size: 1 }] }, { name: 'D', size: 1 }] };
    expect(shippedToClient(tree).names).toEqual(['A', 'B', 'C', 'D']);
  });
  it('does not mutate the tree', () => {
    const tree = { name: 'A', size: 1, client: true, children: [{ name: 'B', size: 2 }] };
    const copy = JSON.parse(JSON.stringify(tree));
    shippedToClient(tree);
    expect(tree).toEqual(copy);
  });
});
```

%% hints
- `walk(node, inClient)`: `const ships = Boolean(node.client) || (inClient && !node.asChildren);`
- Push the name and add the size when it ships; recurse into children with `ships` as the new flag.
- Start with `walk(root, false)`.

%% solution
```js
export function shippedToClient(root) {
  const names = [];
  let bytes = 0;
  const walk = (node, inClient) => {
    const ships = Boolean(node.client) || (inClient && !node.asChildren);
    if (ships) {
      names.push(node.name);
      bytes += node.size;
    }
    for (const child of node.children ?? []) walk(child, ships);
  };
  walk(root, false);
  return { names, bytes };
}
```

%% exercise rdl-check-stream | Tests for a streaming renderer | 4 | js | js | checkStreamPage | 42
`streamPage({ shell, boundaries })` is an async generator as in the streaming exercise: all loads start at once, the first chunk is the shell with `<div id="slot-NAME">FALLBACK</div>` in each marker, then `<template data-fill="NAME">HTML</template>` chunks in **completion order**, and a failing load gives `<template data-error="NAME"></template>` without ending the stream. You are given `checkStreamPage(streamPage)` (async). Write a check that passes for a correct streamer and **fails** for one that: **waits for all data before sending the shell**, **sends fills in declaration order**, **runs the loads one after another**, **lets one failed section abort the page**, **forgets the fallback**, **sends the error text as content**.

```js
const it = streamPage({ shell: '<!--slot:a-->', boundaries: [{ name: 'a', fallback: 'F', load: () => promise }] })[Symbol.asyncIterator]();
const first = await it.next();
```

%% worked
**A similar problem, solved: `checkRaceInOrder(raceInOrder)`** — control timing with **deferred promises**, and use a **race against a flush** to detect "blocked" instead of hanging.

```js
export async function checkRaceInOrder(raceInOrder) {
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  let resolveSlow, resolveFast;
  const slow = new Promise((r) => { resolveSlow = r; });
  const fast = new Promise((r) => { resolveFast = r; });
  const it = raceInOrder([{ name: 'slow', run: () => slow }, { name: 'fast', run: () => fast }])[Symbol.asyncIterator]();
  resolveFast('f');
  const first = await Promise.race([it.next(), flush().then(() => 'blocked')]);   // ① a blocked implementation shows up as 'blocked', not a hang
  expect(first).not.toBe('blocked');
  expect(first.value.name).toBe('fast');                                          // ② the fast one is first, whatever the declaration order
  resolveSlow('s');
  expect((await it.next()).value.name).toBe('slow');
}
```

A test that simply `await`s something a broken implementation never produces **hangs** (and times out). Racing it against `flush()` turns "never" into a clear failed assertion.

%% explain
- **Deferred promises** for each boundary.
- **Race against `flush`** for every `next()` that must not block.
- **Call counts** prove "all loads started".
- **Exact chunk strings.**

%% nudge
- Which assertion shows that every load started before the first chunk?
- How do you make sure the error text never reaches the page?

%% starter
```js
export async function checkStreamPage(streamPage) {
  const it = streamPage({ shell: '<!--slot:a-->', boundaries: [{ name: 'a', fallback: 'Loading', load: async () => 'A' }] })[Symbol.asyncIterator]();
  expect((await it.next()).value).toBe('<div id="slot-a">Loading</div>');
  // your assertions: no blocking, parallel starts, completion order, errors
}
```

%% tests
```js
const make = (f = {}) => async function* ({ shell, boundaries }) {
  let html = shell;
  for (const b of boundaries) {
    html = html.replace('<!--slot:' + b.name + '-->', `<div id="slot-${b.name}">${f.noFallback ? '' : b.fallback}</div>`);
  }
  const settle = (b) => new Promise((resolve) => resolve(b.load())).then(
    (content) => ({ name: b.name, chunk: `<template data-fill="${b.name}">${content}</template>` }),
    (error) => {
      if (f.abort) throw error;
      return { name: b.name, chunk: f.errorAsContent ? `<template data-fill="${b.name}">${error.message}</template>` : `<template data-error="${b.name}"></template>` };
    },
  );
  if (f.waitAll) {
    const all = await Promise.all(boundaries.map(settle));
    yield html;
    for (const r of all) yield r.chunk;
    return;
  }
  if (f.sequential) {
    yield html;
    for (const b of boundaries) yield (await settle(b)).chunk;
    return;
  }
  const started = boundaries.map((b) => [b.name, settle(b)]);
  if (f.declOrder) {
    yield html;
    for (const [, p] of started) yield (await p).chunk;
    return;
  }
  const pending = new Map(started);
  yield html;
  while (pending.size > 0) {
    const done = await Promise.race(pending.values());
    pending.delete(done.name);
    yield done.chunk;
  }
};

const correct = make();
const mutants = {
  'waits for all data before sending the shell': make({ waitAll: true }),
  'sends fills in declaration order': make({ declOrder: true }),
  'runs the loads one after another': make({ sequential: true }),
  'lets one failed section abort the page': make({ abort: true }),
  'forgets the fallback': make({ noFallback: true }),
  'sends the error text as content': make({ errorAsContent: true }),
};

describe('your checkStreamPage', () => {
  it('passes on a correct streamer', async () => {
    await checkStreamPage(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a streamer that ${name}`, async () => {
      let caught = false;
      try { await checkStreamPage(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Three boundaries A, B, C with deferred loads and `jest.fn` wrappers; shell with all three markers.
- Helper `next = () => Promise.race([it.next(), flush().then(() => 'blocked')])`, and expect it not to be `'blocked'`.
- After the first chunk: every load spy called once.
- Resolve B first, reject C, resolve A last; expect that exact chunk order, then `done`.

%% solution
```js
export async function checkStreamPage(streamPage) {
  const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };
  const a = deferred();
  const b = deferred();
  const c = deferred();
  const loadA = jest.fn(() => a.promise);
  const loadB = jest.fn(() => b.promise);
  const loadC = jest.fn(() => c.promise);

  const it = streamPage({
    shell: '<main><!--slot:A--><!--slot:B--><!--slot:C--></main>',
    boundaries: [
      { name: 'A', fallback: 'Loading A', load: loadA },
      { name: 'B', fallback: 'Loading B', load: loadB },
      { name: 'C', fallback: 'Loading C', load: loadC },
    ],
  })[Symbol.asyncIterator]();
  const next = () => Promise.race([it.next(), flush().then(() => 'blocked')]);

  const first = await next();
  expect(first).not.toBe('blocked');
  expect(first.value).toBe('<main><div id="slot-A">Loading A</div><div id="slot-B">Loading B</div><div id="slot-C">Loading C</div></main>');
  expect(loadA).toHaveBeenCalledTimes(1);
  expect(loadB).toHaveBeenCalledTimes(1);
  expect(loadC).toHaveBeenCalledTimes(1);

  b.resolve('<p>B</p>');
  const second = await next();
  expect(second).not.toBe('blocked');
  expect(second.value).toBe('<template data-fill="B"><p>B</p></template>');

  c.reject(new Error('db down'));
  const third = await next();
  expect(third).not.toBe('blocked');
  expect(third.value).toBe('<template data-error="C"></template>');

  a.resolve('<p>A</p>');
  const fourth = await next();
  expect(fourth).not.toBe('blocked');
  expect(fourth.value).toBe('<template data-fill="A"><p>A</p></template>');
  expect((await next()).done).toBe(true);
}
```
