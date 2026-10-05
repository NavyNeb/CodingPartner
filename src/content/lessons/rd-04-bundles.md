---
id: rd-bundles
track: rd
title: Bundles: code splitting, tree shaking and lazy loading
summary: How JavaScript reaches the browser, how to split it by route and by shared use, why unused exports sometimes stay in the bundle, how to load code on demand without flicker or stale-deploy failures, and how to catch size regressions in CI.
---

## The idea in one sentence

JavaScript is the most expensive byte on the web (it must be **downloaded, parsed and run**), so the goal is to **ship only the code the current screen needs**, and **everything else later**.

> **Analogy** Moving house. You don't carry every box to the new place on day one: the **kitchen box** (route code) comes first, the **seasonal decorations** (rarely used features) arrive when needed, and the **identical mugs** (shared libraries) travel together once instead of being packed in every box.

*(In practice: webpack, Vite/Rollup or Turbopack, `import()`, `React.lazy`, `next/dynamic`. You will build the planning logic framework-free.)*

## Code splitting

![Code splitting](fig:rd-split "Per-route chunks plus shared chunks beat one monolith.")

A bundler walks the **import graph** from each entry and writes **chunks**. Three kinds matter:

- **Route chunks**: code only one page needs.
- **Shared chunks**: code **several** pages need, extracted so it is **downloaded once and cached**, never duplicated into each page.
- **Common chunk**: code **every** page needs (often the framework).

Where to split: **routes** first (biggest win, almost free), then **heavy components** behind interactions (a rich-text editor, a chart), then **big libraries** used by one feature. Content-hashed file names let chunks be cached **forever** while a new deploy only invalidates what changed.

## Tree shaking

![Tree shaking](fig:rd-shake "Unused exports are dropped, unless importing the module has side effects.")

**Tree shaking** removes exports nobody uses. It only works when:

- the code is **ES modules** (`import`/`export`), which are statically analysable; `require()` is not;
- the bundler can prove **dropping is safe**: modules that run code when imported (**side effects**) must be kept whole unless the package declares `"sideEffects": false`;
- you don't import through a **barrel file** that re-exports everything with side effects.

Typical culprits: importing a whole utility library for one function (`import _ from 'lodash'` instead of `lodash/debounce`), a CSS-in-JS or icon barrel, and a polyfill pulled in globally.

```js try predict
let loads = 0;
const load = () => { loads++; return Promise.resolve({ default: 'Chart' }); };

const cache = {};
const lazy = () => (cache.promise ??= load());

Promise.all([lazy(), lazy()]).then(([a, b]) => console.log(a === b, loads));
```

## Lazy loading

![Lazy loading](fig:rd-lazy "Load later what the first view does not need; start early when you can.")

`import('./Chart.js')` returns a **promise** for a module and makes the bundler create a separate chunk. Around it you need four things:

- **share** one load between concurrent callers (the snippet above);
- **cache** a successful load; **don't cache** a failure, so a retry can work;
- **prefetch** early (on hover, idle, or when a link scrolls into view) so the click feels instant;
- **handle failure**: after a deploy, the old chunk file may be gone, so a load error means **retry, then reload the page**.

```stepper A lazy chart, step by step
code:
  button click → import('./Chart.js')   // start loading
  loading...   → show a skeleton        // never a blank gap
  success      → render <Chart/>        // cached for next time
  failure      → retry, then offer "reload"
---
line: 1
say: Nothing about the chart is in the first bundle. The **click** (or a hover prefetch) starts the load.
phase: start
---
line: 2
say: While the chunk downloads, show a **placeholder of the right size** so the layout does not jump.
phase: loading
---
line: 3
say: When it arrives the module is **cached**: the second open is instant, and concurrent callers share the same load.
phase: loaded
---
line: 4
say: If it **fails** (offline, or a deploy removed the file) the failed load must **not** be cached. Retry, and if that fails too, tell the user to reload.
phase: failure
```

## Measure, then budget

Guessing is the common mistake. Open a **bundle analyzer** (treemap) and look for: one huge dependency, the same library **twice** at different versions, moment-style locale bundles, dev-only code in production, and polyfills for browsers you do not support. Then add a **size budget** and a **CI diff** that flags regressions on every pull request, because bundles grow one innocent import at a time.

## Quick check

```check
Q: Three routes all use a charting library. What should the bundler do with it?
A) Copy it into each route chunk
B) Extract it into a shared chunk used by all three *
C) Put it in the first route only
D) Load it from node_modules at runtime
Why: A shared chunk is downloaded once and cached; copying it wastes bytes and cache.
---
Q: Why might an unused export stay in the bundle?
A) The bundler is broken
B) The module has side effects, or is CommonJS, so the bundler cannot prove removal is safe *
C) Unused code is always kept
D) Exports can't be removed
Why: Tree shaking is only done where it is provably safe.
---
Q: A lazy chunk fails to load right after a deploy. Why, and what do you do?
A) The user's disk is full; ignore it
B) The old hashed file no longer exists; retry, then reload the page to get the new build *
C) Imports are cached forever
D) CORS blocks it
Why: Hashed file names change per build, so a long-open tab asks for files that are gone.
---
Q: What belongs in a "common" chunk?
A) Code used by exactly one route
B) Code used by every route *
C) Only CSS
D) Images
Why: Code every page needs is best downloaded once and cached.
```

## Recap

- **Split** by route first, then heavy components and libraries; **extract shared code** once.
- **Hashed file names** make chunks cacheable forever.
- **Tree shaking** needs ES modules and provable safety; watch **side effects** and **barrel files**.
- **Lazy loading**: share in-flight loads, cache successes, **never cache failures**, prefetch, handle stale deploys.
- **Measure** with an analyzer, **budget** in CI, and **diff** sizes per pull request.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: initial JS size | Filtering and summing |
| Plan the chunks | Graph traversal, grouping by "which routes use it" |
| Shake a module graph | Reachability to a fixpoint, and the side-effects rule |
| A lazy module loader | Promise caching, shared in-flight loads, not caching failures |
| Diff two bundles | Comparing two maps, percentages, a threshold |
| Tests for a chunk planner | One small graph that exercises every rule |

%% exercise rdl-guided-initial | Guided: initial JavaScript | 1 | js | js | initialJsKb | 8 | guided
Implement `initialJsKb(chunks)` for a list of `{ name, kb, initial }`: the **total size in KB of the chunks marked `initial: true`** (the ones needed for the first view).

```js
initialJsKb([{ name: 'main', kb: 120, initial: true }, { name: 'chart', kb: 80 }]); // 120
```

%% worked
**A similar problem, solved: `totalOf(items, flag)`** — sum a property over only the items that have a flag.

```js
function totalOf(items, flag) {
  return items.filter((item) => item[flag]).reduce((sum, item) => sum + item.size, 0);   // ① filter first, then add up; the 0 handles an empty list
}
```

The `0` initial value makes the result `0` for an empty list instead of throwing.

%% explain
- **Filter** to `initial` chunks, **sum** `kb`.
- Empty input gives `0`.

%% nudge
- What does `reduce` return for an empty array without an initial value?

%% starter
```js
export function initialJsKb(chunks) {
  return 0;
}
```

%% tests
```js
describe('initialJsKb', () => {
  it('sums only the initial chunks', () => {
    expect(initialJsKb([{ name: 'main', kb: 120, initial: true }, { name: 'chart', kb: 80 }, { name: 'vendor', kb: 30.5, initial: true }])).toBe(150.5);
  });
  it('is 0 when nothing is initial or the list is empty', () => {
    expect(initialJsKb([{ name: 'a', kb: 10, initial: false }])).toBe(0);
    expect(initialJsKb([])).toBe(0);
  });
});
```

%% hints
- `chunks.filter((c) => c.initial).reduce((s, c) => s + c.kb, 0)`

%% solution
```js
export function initialJsKb(chunks) {
  return chunks.filter((c) => c.initial).reduce((sum, c) => sum + c.kb, 0);
}
```

%% exercise rdl-split-chunks | Plan the chunks | 4 | js | js | splitChunks | 42
`splitChunks({ modules, routes })` plans the chunks. `modules` maps a module name to `{ size, imports }` (`imports` optional list of module names); `routes` maps a route to its **entry module names**.

- For each route, find every module **reachable** from its entries through `imports` (a module may be imported in a cycle). An unknown module name anywhere throws `Error('unknown module: ' + name)`.
- Group the reachable modules by **which routes need them**:
  - needed by exactly **one** route → chunk `route:<route>`;
  - needed by **every** route (and there are at least two routes) → chunk `common`;
  - otherwise → chunk `shared:` + the sorted routes joined with `+` (for example `shared:/a+/b`).
- Return `{ chunks, routes }`. `chunks` is a list of `{ name, modules, size }` sorted by `name`, with `modules` sorted by name and `size` the sum of the sizes. Modules no route reaches are left out.
- In the result's `routes`, each route (in the input's order) lists the **names of the chunks it needs**, sorted by name.

```js
splitChunks({
  modules: { home: { size: 1, imports: ['lib'] }, shop: { size: 2, imports: ['lib'] }, lib: { size: 10 } },
  routes: { '/home': ['home'], '/shop': ['shop'] },
});
// chunks: common [lib] (10), route:/home [home] (1), route:/shop [shop] (2)
```

%% worked
**A similar problem, solved: `groupByUsers(uses)`** — turn "who uses what" into "what is used by exactly this set of users".

```js
function groupByUsers(usedBy) {                                // usedBy: Map item -> Set of users
  const groups = new Map();
  for (const [item, users] of usedBy) {
    const key = [...users].sort().join('+');                    // ① a stable key for the SET of users
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);                                  // ② items with the same user set land together
  }
  return groups;
}
```

Build `usedBy` by running a **visited-set traversal** from every route's entries (the `Set` also protects against import cycles). Then the chunk name is just a function of how many routes are in the set.

%% explain
- **Traverse** each route with a `seen` set; throw on unknown modules.
- **`usedBy`**: module → set of routes.
- **Group by route set**, name by the rule, sort everything.

%% nudge
- Why must the traversal remember visited modules?
- What is the chunk name for a module used by every route when there is only one route?

%% starter
```js
export function splitChunks({ modules, routes }) {
  return { chunks: [], routes: {} };
}
```

%% tests
```js
describe('splitChunks', () => {
  const modules = {
    a: { size: 1, imports: ['lib', 'util'] },
    b: { size: 2, imports: ['lib', 'util', 'chart'] },
    c: { size: 3, imports: ['util', 'chart'] },
    lib: { size: 20, imports: ['helper'] },
    helper: { size: 5 },
    util: { size: 10 },
    chart: { size: 40 },
    orphan: { size: 99 },
  };
  const routes = { '/a': ['a'], '/b': ['b'], '/c': ['c'] };

  it('groups modules by the set of routes that need them', () => {
    const { chunks } = splitChunks({ modules, routes });
    expect(chunks).toEqual([
      { name: 'common', modules: ['util'], size: 10 },
      { name: 'route:/a', modules: ['a'], size: 1 },
      { name: 'route:/b', modules: ['b'], size: 2 },
      { name: 'route:/c', modules: ['c'], size: 3 },
      { name: 'shared:/a+/b', modules: ['helper', 'lib'], size: 25 },
      { name: 'shared:/b+/c', modules: ['chart'], size: 40 },
    ]);
  });
  it('lists the chunks each route needs, sorted', () => {
    const result = splitChunks({ modules, routes });
    expect(result.routes).toEqual({
      '/a': ['common', 'route:/a', 'shared:/a+/b'],
      '/b': ['common', 'route:/b', 'shared:/a+/b', 'shared:/b+/c'],
      '/c': ['common', 'route:/c', 'shared:/b+/c'],
    });
    expect(Object.keys(result.routes)).toEqual(['/a', '/b', '/c']);
  });
  it('follows imports transitively and leaves unreachable modules out', () => {
    const { chunks } = splitChunks({ modules, routes });
    const names = chunks.flatMap((c) => c.modules);
    expect(names).toContain('helper');
    expect(names).not.toContain('orphan');
  });
  it('treats a single route as route-only code', () => {
    const { chunks, routes: r } = splitChunks({ modules: { a: { size: 1, imports: ['b'] }, b: { size: 2 } }, routes: { '/a': ['a'] } });
    expect(chunks).toEqual([{ name: 'route:/a', modules: ['a', 'b'], size: 3 }]);
    expect(r).toEqual({ '/a': ['route:/a'] });
  });
  it('handles two routes sharing everything', () => {
    const { chunks } = splitChunks({ modules: { x: { size: 4 } }, routes: { '/a': ['x'], '/b': ['x'] } });
    expect(chunks).toEqual([{ name: 'common', modules: ['x'], size: 4 }]);
  });
  it('supports several entries per route and cycles', () => {
    const mods = { a: { size: 1, imports: ['b'] }, b: { size: 1, imports: ['a'] }, e: { size: 5 } };
    const { chunks } = splitChunks({ modules: mods, routes: { '/r': ['a', 'e'], '/s': ['e'] } });
    expect(chunks).toEqual([
      { name: 'common', modules: ['e'], size: 5 },
      { name: 'route:/r', modules: ['a', 'b'], size: 2 },
    ]);
  });
  it('sorts the routes inside a shared chunk name', () => {
    const { chunks } = splitChunks({
      modules: { z: { size: 1 }, y: { size: 1 }, w: { size: 1 } },
      routes: { '/z': ['z', 'y'], '/y': ['y'], '/x': ['w'] },
    });
    expect(chunks.map((c) => c.name)).toEqual(['route:/x', 'route:/z', 'shared:/y+/z']);
  });
  it('throws for an unknown module', () => {
    expect(() => splitChunks({ modules: { a: { size: 1, imports: ['ghost'] } }, routes: { '/a': ['a'] } })).toThrow('unknown module: ghost');
    expect(() => splitChunks({ modules: {}, routes: { '/a': ['nope'] } })).toThrow('unknown module: nope');
  });
  it('handles no routes', () => {
    expect(splitChunks({ modules: { a: { size: 1 } }, routes: {} })).toEqual({ chunks: [], routes: {} });
  });
});
```

%% hints
- `visit(name)`: throw if `!Object.prototype.hasOwnProperty.call(modules, name)`, skip if `seen`, add, recurse into `imports ?? []`.
- `usedBy` is a `Map` module → `Set` of routes; the chunk key is the sorted routes.
- Name: one route → `'route:' + r`; all routes (and more than one) → `'common'`; else `'shared:' + list.join('+')`.
- A chunk's routes are kept so you can build the `routes` result at the end.

%% solution
```js
export function splitChunks({ modules, routes }) {
  const routeNames = Object.keys(routes);
  const usedBy = new Map();

  for (const route of routeNames) {
    const seen = new Set();
    const visit = (name) => {
      if (!Object.prototype.hasOwnProperty.call(modules, name)) throw new Error('unknown module: ' + name);
      if (seen.has(name)) return;
      seen.add(name);
      for (const dep of modules[name].imports ?? []) visit(dep);
    };
    for (const entry of routes[route]) visit(entry);
    for (const name of seen) {
      if (!usedBy.has(name)) usedBy.set(name, new Set());
      usedBy.get(name).add(route);
    }
  }

  const groups = new Map();
  for (const [name, set] of usedBy) {
    const list = [...set].sort();
    const chunkName =
      list.length === 1 ? 'route:' + list[0] : list.length === routeNames.length ? 'common' : 'shared:' + list.join('+');
    if (!groups.has(chunkName)) groups.set(chunkName, { routes: list, modules: [] });
    groups.get(chunkName).modules.push(name);
  }

  const chunks = [...groups]
    .map(([name, g]) => {
      const mods = g.modules.sort();
      return { name, modules: mods, size: mods.reduce((sum, m) => sum + modules[m].size, 0), routes: g.routes };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  const perRoute = {};
  for (const route of routeNames) {
    perRoute[route] = chunks.filter((c) => c.routes.includes(route)).map((c) => c.name);
  }
  return { chunks: chunks.map(({ name, modules: m, size }) => ({ name, modules: m, size })), routes: perRoute };
}
```

%% exercise rdl-tree-shake | Shake a module graph | 4 | js | js | shake | 38
`shake({ modules, used })` decides which exports survive tree shaking.

`modules` maps a module name to `{ sideEffects, exports }`; `exports` maps an export name to `{ size, uses }`, where `uses` is a list of other export ids this export needs, written `'module.export'`. `used` is the list of export ids the app imports.

- Start with the ids in `used` and everything they **reach** through `uses`.
- **Side effects rule**: if a module has `sideEffects: true` and at least one of its exports is kept, then **all** of that module's exports are kept (its top-level code runs, so it cannot be cut), and what those exports `use` is kept too. Repeat until nothing changes.
- An id that does not exist (unknown module or export) throws `Error('unknown export: ' + id)`.
- Return `{ kept, removed, bytes }`: `kept` and `removed` are sorted lists of ids, `bytes` is the total size of the kept exports.

```js
shake({
  modules: { util: { exports: { fmt: { size: 5 }, csv: { size: 20 } } } },
  used: ['util.fmt'],
}); // { kept: ['util.fmt'], removed: ['util.csv'], bytes: 5 }
```

%% worked
**A similar problem, solved: `reachable(graph, starts)`** — grow a set until nothing new is added.

```js
function reachable(graph, starts) {
  const kept = new Set();
  const queue = [...starts];
  while (queue.length > 0) {
    const id = queue.pop();
    if (kept.has(id)) continue;                         // ① already handled: also what stops cycles
    kept.add(id);
    for (const next of graph[id] ?? []) queue.push(next);
  }
  return kept;
}
```

Your rule adds a second way to grow the set: **a kept export of a side-effect module keeps all its siblings**. Wrap the traversal in an outer loop that repeats **until the set stops growing** (a **fixpoint**).

%% explain
- **Ids** are `module.export`; validate them.
- **Worklist** traversal along `uses`.
- **Outer loop** adds all exports of side-effect modules that have a kept export, until stable.

%% nudge
- Why is one pass over the side-effect modules not enough?
- What counts as "a module has a kept export"?

%% starter
```js
export function shake({ modules, used }) {
  return { kept: [], removed: [], bytes: 0 };
}
```

%% tests
```js
describe('shake', () => {
  const mk = () => ({
    util: { exports: { fmt: { size: 5, uses: ['util.pad'] }, pad: { size: 2 }, csv: { size: 20 } } },
    chart: { sideEffects: true, exports: { draw: { size: 50, uses: ['util.csv'] }, axis: { size: 10 } } },
    icons: { exports: { a: { size: 1 }, b: { size: 1 } } },
  });
  it('keeps used exports and what they use, drops the rest', () => {
    expect(shake({ modules: mk(), used: ['util.fmt'] })).toEqual({
      kept: ['util.fmt', 'util.pad'],
      removed: ['chart.axis', 'chart.draw', 'icons.a', 'icons.b', 'util.csv'],
      bytes: 7,
    });
  });
  it('keeps a whole side-effect module when one export is used', () => {
    const result = shake({ modules: mk(), used: ['chart.axis'] });
    expect(result.kept).toEqual(['chart.axis', 'chart.draw', 'util.csv']);
    expect(result.bytes).toBe(80);
  });
  it('follows chains created by the side-effect rule to a fixpoint', () => {
    const modules = {
      a: { sideEffects: true, exports: { x: { size: 1, uses: ['b.y'] }, z: { size: 1 } } },
      b: { sideEffects: true, exports: { y: { size: 1 }, w: { size: 1, uses: ['c.v'] } } },
      c: { exports: { v: { size: 1 }, u: { size: 1 } } },
    };
    const result = shake({ modules, used: ['a.z'] });
    expect(result.kept).toEqual(['a.x', 'a.z', 'b.w', 'b.y', 'c.v']);
    expect(result.removed).toEqual(['c.u']);
  });
  it('handles cycles', () => {
    const modules = { m: { exports: { a: { size: 1, uses: ['m.b'] }, b: { size: 1, uses: ['m.a'] }, c: { size: 1 } } } };
    expect(shake({ modules, used: ['m.a'] }).kept).toEqual(['m.a', 'm.b']);
  });
  it('keeps nothing when nothing is used', () => {
    expect(shake({ modules: mk(), used: [] })).toMatchObject({ kept: [], bytes: 0 });
  });
  it('ignores duplicates in used', () => {
    expect(shake({ modules: mk(), used: ['util.pad', 'util.pad'] }).kept).toEqual(['util.pad']);
  });
  it('throws for an unknown export or module', () => {
    expect(() => shake({ modules: mk(), used: ['util.nope'] })).toThrow('unknown export: util.nope');
    expect(() => shake({ modules: mk(), used: ['ghost.x'] })).toThrow('unknown export: ghost.x');
    const bad = { m: { exports: { a: { size: 1, uses: ['m.zzz'] } } } };
    expect(() => shake({ modules: bad, used: ['m.a'] })).toThrow('unknown export: m.zzz');
  });
});
```

%% hints
- `const get = (id) => { const [mod, name] = split at the FIRST '.'; ... }` and throw when missing.
- Worklist from `used`; for each kept id push its `uses`.
- Outer `do { changed = false; ... } while (changed)`: for each side-effect module with a kept export, add every export id not yet kept.

%% solution
```js
export function shake({ modules, used }) {
  const lookup = (id) => {
    const dot = id.indexOf('.');
    const mod = dot === -1 ? undefined : modules[id.slice(0, dot)];
    const exp = mod && Object.prototype.hasOwnProperty.call(mod.exports, id.slice(dot + 1)) ? mod.exports[id.slice(dot + 1)] : undefined;
    if (!exp) throw new Error('unknown export: ' + id);
    return exp;
  };

  const kept = new Set();
  const queue = [...used];
  const drain = () => {
    while (queue.length > 0) {
      const id = queue.pop();
      if (kept.has(id)) continue;
      const exp = lookup(id);
      kept.add(id);
      for (const next of exp.uses ?? []) queue.push(next);
    }
  };

  drain();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [modName, mod] of Object.entries(modules)) {
      if (!mod.sideEffects) continue;
      const ids = Object.keys(mod.exports).map((name) => modName + '.' + name);
      if (!ids.some((id) => kept.has(id))) continue;
      for (const id of ids) {
        if (!kept.has(id)) {
          queue.push(id);
          changed = true;
        }
      }
    }
    drain();
  }

  const all = [];
  for (const [modName, mod] of Object.entries(modules)) {
    for (const name of Object.keys(mod.exports)) all.push(modName + '.' + name);
  }
  const keptList = [...kept].sort();
  const removed = all.filter((id) => !kept.has(id)).sort();
  const bytes = keptList.reduce((sum, id) => sum + lookup(id).size, 0);
  return { kept: keptList, removed, bytes };
}
```

%% exercise rdl-lazy-modules | A lazy module loader | 3 | js | js | createLazyModules | 30
`createLazyModules({ load })` wraps a function `load(name)` (async; think `import()`) and returns `{ get(name), preload(name), status(name) }`:

- `get(name)` returns a promise for the module. Concurrent calls for a name **share one** `load(name)`. A **successful** result is **cached forever**: later calls resolve to it without loading.
- A **failed** load rejects, is **not cached**, and leaves the name loadable again (the next `get` calls `load` again).
- `preload(name)` starts loading like `get` but returns `undefined` and **swallows** errors (no unhandled rejection).
- `status(name)` is `'idle'` (never loaded, or its last attempt failed and was retried-able... see below), `'loading'` while a load is in flight, `'loaded'` after success, and `'error'` after a failure **until the next `get` starts a new load**.
- `load` is called synchronously inside `get`/`preload`.

```js
const modules = createLazyModules({ load: (name) => import('./' + name + '.js') });
modules.preload('Chart');          // start early
const Chart = await modules.get('Chart');
```

%% worked
**A similar problem, solved: `createOnceLoader(load)`** — the single-flight pattern again, with a four-state status.

```js
function createOnceLoader(load) {
  let state = 'idle';
  let promise = null;
  return {
    status: () => state,
    get() {
      if (state === 'loaded' || state === 'loading') return promise;       // ① loaded or in flight: reuse
      state = 'loading';
      promise = new Promise((resolve) => resolve(load()))
        .then((value) => { state = 'loaded'; return value; },
              (error) => { state = 'error'; promise = null; throw error; });   // ② failure: forget the promise, remember the state
      return promise;
    },
  };
}
```

Yours does this **per name** (use a `Map`). `status` for a name that failed stays `'error'` until a new `get` flips it back to `'loading'`.

%% explain
- **Per-name records**: `{ state, promise }`.
- **`get`**: reuse when loaded or loading; else start.
- **`preload`** is `get` with the rejection swallowed.

%% nudge
- Which states make `get` return the existing promise?
- Why must `preload` attach a catch?

%% starter
```js
export function createLazyModules({ load }) {
  return {
    get(name) {
      return load(name);
    },
    preload(name) {},
    status(name) {
      return 'idle';
    },
  };
}
```

%% tests
```js
describe('createLazyModules', () => {
  const deferred = () => {
    let resolve, reject;
    const promise = new Promise((a, b) => { resolve = a; reject = b; });
    return { promise, resolve, reject };
  };

  it('loads a module and caches it', async () => {
    const load = jest.fn(async (name) => ({ name }));
    const m = createLazyModules({ load });
    expect(m.status('a')).toBe('idle');
    const first = await m.get('a');
    expect(first).toEqual({ name: 'a' });
    expect(await m.get('a')).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    expect(m.status('a')).toBe('loaded');
  });
  it('calls load synchronously and reports loading', async () => {
    const d = deferred();
    const load = jest.fn(() => d.promise);
    const m = createLazyModules({ load });
    const p = m.get('a');
    expect(load).toHaveBeenCalledTimes(1);
    expect(m.status('a')).toBe('loading');
    d.resolve('mod');
    await p;
    expect(m.status('a')).toBe('loaded');
  });
  it('shares one load between concurrent callers', async () => {
    const d = deferred();
    const load = jest.fn(() => d.promise);
    const m = createLazyModules({ load });
    const a = m.get('x');
    const b = m.get('x');
    d.resolve('mod');
    expect(await a).toBe('mod');
    expect(await b).toBe('mod');
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('keeps names independent', async () => {
    const load = jest.fn(async (n) => n);
    const m = createLazyModules({ load });
    await m.get('a');
    await m.get('b');
    expect(load).toHaveBeenCalledTimes(2);
    expect(m.status('c')).toBe('idle');
  });
  it('does not cache failures and retries on the next get', async () => {
    let fail = true;
    const load = jest.fn(async () => { if (fail) throw new Error('chunk 404'); return 'ok'; });
    const m = createLazyModules({ load });
    await expect(m.get('a')).rejects.toThrow('chunk 404');
    expect(m.status('a')).toBe('error');
    fail = false;
    expect(await m.get('a')).toBe('ok');
    expect(m.status('a')).toBe('loaded');
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('lets every concurrent caller see a failure', async () => {
    const d = deferred();
    const m = createLazyModules({ load: () => d.promise });
    const a = m.get('a');
    const b = m.get('a');
    d.reject(new Error('boom'));
    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
  });
  it('treats a synchronous throw as a failure', async () => {
    const m = createLazyModules({ load: () => { throw new Error('sync'); } });
    await expect(m.get('a')).rejects.toThrow('sync');
    expect(m.status('a')).toBe('error');
  });
  it('preloads without returning anything and swallows errors', async () => {
    const load = jest.fn(async () => { throw new Error('nope'); });
    const m = createLazyModules({ load });
    expect(m.preload('a')).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(m.status('a')).toBe('error');
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('lets get reuse a preload in flight', async () => {
    const d = deferred();
    const load = jest.fn(() => d.promise);
    const m = createLazyModules({ load });
    m.preload('a');
    const p = m.get('a');
    d.resolve('mod');
    expect(await p).toBe('mod');
    expect(load).toHaveBeenCalledTimes(1);
  });
});
```

%% hints
- `records: Map(name → { state, promise })`.
- In `get`: `if (rec && (rec.state === 'loaded' || rec.state === 'loading')) return rec.promise;`
- Start: `new Promise((r) => r(load(name)))`, set `state` in both handlers, rethrow in the rejection handler.
- `preload`: `this.get(name).catch(() => {})` (return nothing).

%% solution
```js
export function createLazyModules({ load }) {
  const records = new Map();

  function get(name) {
    const existing = records.get(name);
    if (existing && (existing.state === 'loaded' || existing.state === 'loading')) return existing.promise;
    const record = { state: 'loading', promise: null };
    record.promise = new Promise((resolve) => resolve(load(name))).then(
      (value) => {
        record.state = 'loaded';
        return value;
      },
      (error) => {
        record.state = 'error';
        throw error;
      },
    );
    records.set(name, record);
    return record.promise;
  }

  return {
    get,
    preload(name) {
      get(name).catch(() => {});
    },
    status(name) {
      return records.has(name) ? records.get(name).state : 'idle';
    },
  };
}
```

%% exercise rdl-diff-bundles | Diff two bundles | 3 | js | js | diffBundles | 26
`diffBundles(before, after, { threshold = 5 } = {})` compares two builds, each a map `chunkName → bytes`, the way a CI bot would comment on a pull request. It returns:

- `total: { before, after, delta }` — sums over all chunks.
- `added`: `[{ name, bytes }]` for chunks only in `after`; `removed`: `[{ name, bytes }]` for chunks only in `before`.
- `changed`: `[{ name, before, after, delta, pct }]` for chunks in both whose size differs, where `delta = after - before` and `pct = Math.round(delta / before * 1000) / 10` (so `1234 → 1300` is `5.3`); if `before` is `0`, `pct` is `Infinity`.
- `regressions`: the names of `changed` chunks whose `pct` is **greater than** `threshold`.
- Every list is sorted by chunk name.

```js
diffBundles({ main: 1000 }, { main: 1100, chart: 300 });
// added: [{ name: 'chart', bytes: 300 }], changed: [{ name: 'main', before: 1000, after: 1100, delta: 100, pct: 10 }], regressions: ['main']
```

%% worked
**A similar problem, solved: `diffCounts(a, b)`** — compare two maps by the union of their keys.

```js
function diffCounts(a, b) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();   // ① every key from either side, in a stable order
  const out = { added: [], removed: [], changed: [] };
  for (const name of names) {
    if (!(name in a)) out.added.push(name);
    else if (!(name in b)) out.removed.push(name);
    else if (a[name] !== b[name]) out.changed.push(name);                       // ② only real differences
  }
  return out;
}
```

Use `in` (or `hasOwnProperty`), not truthiness: a chunk of `0` bytes still exists.

%% explain
- **Union of names**, sorted.
- **Classify** each as added, removed, changed.
- **Percent** rounded to one decimal; `Infinity` for a zero base.

%% nudge
- Why use `in` instead of `if (a[name])`?
- Is a chunk that grows by exactly `threshold` percent a regression?

%% starter
```js
export function diffBundles(before, after, { threshold = 5 } = {}) {
  return { total: { before: 0, after: 0, delta: 0 }, added: [], removed: [], changed: [], regressions: [] };
}
```

%% tests
```js
describe('diffBundles', () => {
  it('reports totals', () => {
    const r = diffBundles({ main: 1000, vendor: 500 }, { main: 1100, vendor: 500 });
    expect(r.total).toEqual({ before: 1500, after: 1600, delta: 100 });
  });
  it('lists added and removed chunks sorted by name', () => {
    const r = diffBundles({ b: 10, a: 5, gone: 7 }, { b: 10, z: 3, y: 4 });
    expect(r.added).toEqual([{ name: 'y', bytes: 4 }, { name: 'z', bytes: 3 }]);
    expect(r.removed).toEqual([{ name: 'a', bytes: 5 }, { name: 'gone', bytes: 7 }]);
    expect(r.changed).toEqual([]);
  });
  it('lists changed chunks with delta and a one-decimal percentage', () => {
    const r = diffBundles({ main: 1234, other: 100 }, { main: 1300, other: 90 });
    expect(r.changed).toEqual([
      { name: 'main', before: 1234, after: 1300, delta: 66, pct: 5.3 },
      { name: 'other', before: 100, after: 90, delta: -10, pct: -10 },
    ]);
  });
  it('leaves unchanged chunks out', () => {
    expect(diffBundles({ a: 5 }, { a: 5 }).changed).toEqual([]);
  });
  it('flags regressions above the threshold, strictly', () => {
    const before = { a: 100, b: 100, c: 100, d: 100 };
    const after = { a: 105, b: 106, c: 90, d: 100 };
    expect(diffBundles(before, after).regressions).toEqual(['b']);
    expect(diffBundles(before, after, { threshold: 5.9 }).regressions).toEqual(['b']);
    expect(diffBundles(before, after, { threshold: 4 }).regressions).toEqual(['a', 'b']);
    expect(diffBundles(before, after, { threshold: 10 }).regressions).toEqual([]);
  });
  it('treats a zero base as infinitely larger', () => {
    const r = diffBundles({ a: 0 }, { a: 10 });
    expect(r.changed[0].pct).toBe(Infinity);
    expect(r.regressions).toEqual(['a']);
  });
  it('knows a zero-byte chunk exists', () => {
    const r = diffBundles({ a: 0 }, {});
    expect(r.removed).toEqual([{ name: 'a', bytes: 0 }]);
  });
  it('handles empty builds', () => {
    expect(diffBundles({}, {})).toEqual({ total: { before: 0, after: 0, delta: 0 }, added: [], removed: [], changed: [], regressions: [] });
  });
});
```

%% hints
- `const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();`
- `pct = b === 0 ? Infinity : Math.round((delta / b) * 1000) / 10;`
- Regression: `pct > threshold`.

%% solution
```js
export function diffBundles(before, after, { threshold = 5 } = {}) {
  const sum = (o) => Object.values(o).reduce((s, n) => s + n, 0);
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const added = [];
  const removed = [];
  const changed = [];
  for (const name of names) {
    const inBefore = Object.prototype.hasOwnProperty.call(before, name);
    const inAfter = Object.prototype.hasOwnProperty.call(after, name);
    if (!inBefore) added.push({ name, bytes: after[name] });
    else if (!inAfter) removed.push({ name, bytes: before[name] });
    else if (before[name] !== after[name]) {
      const delta = after[name] - before[name];
      const pct = before[name] === 0 ? Infinity : Math.round((delta / before[name]) * 1000) / 10;
      changed.push({ name, before: before[name], after: after[name], delta, pct });
    }
  }
  return {
    total: { before: sum(before), after: sum(after), delta: sum(after) - sum(before) },
    added,
    removed,
    changed,
    regressions: changed.filter((c) => c.pct > threshold).map((c) => c.name),
  };
}
```

%% exercise rdl-check-split | Tests for a chunk planner | 4 | js | js | checkSplitChunks | 40
`splitChunks({ modules, routes })` plans chunks as in the chunk planner exercise: modules reachable from each route's entries are grouped by the **set of routes that need them** into `route:<route>`, `common` (every route, with at least two) and `shared:/a+/b` chunks, sorted, with summed sizes, plus a per-route list of needed chunk names. You are given `checkSplitChunks(splitChunks)`. Write a check that passes for a correct planner and **fails** for one that: **ignores transitive imports**, **copies shared modules into every route chunk**, **merges all shared modules into one chunk**, **never makes a common chunk**, **reports only the first module's size**.

```js
const result = splitChunks({ modules: { a: { size: 1, imports: ['lib'] }, lib: { size: 9 } }, routes: { '/a': ['a'] } });
expect(result.chunks[0].size).toBe(10);
```

%% worked
**A similar problem, solved: `checkGrouper(groupByUsers)`** — build **one input that exercises every rule**, then assert the **whole output** with `toEqual`.

```js
export function checkGrouper(groupByUsers) {
  const result = groupByUsers({
    x: ['u1'],               // only one user
    y: ['u1', 'u2'],         // two of three users
    z: ['u1', 'u2', 'u3'],   // every user
  });
  expect(result).toEqual({
    'only:u1': ['x'],        // ① each rule appears at least once...
    'some:u1+u2': ['y'],
    all: ['z'],              // ② ...so a planner that merges or skips a rule produces a different object
  });
}
```

The trick is a graph where **two different shared sets** exist (a planner that merges them is caught), where something is only reachable **through an import** (transitive), and where **sizes differ per module** (so adding only one is caught).

%% explain
- **One graph, every rule**: single-route, all-routes, two different shared sets, a transitive import.
- **Distinct sizes** so sums are checked.
- **Assert whole outputs** with `toEqual`, for `chunks` and `routes`.

%% nudge
- Why do you need two different shared route sets?
- How do you make a transitive import observable?

%% starter
```js
export function checkSplitChunks(splitChunks) {
  const result = splitChunks({ modules: { a: { size: 1 } }, routes: { '/a': ['a'] } });
  expect(result.chunks).toEqual([{ name: 'route:/a', modules: ['a'], size: 1 }]);
  // your assertions: common, shared sets, transitive imports, sizes, per-route lists
}
```

%% tests
```js
const make = (f = {}) => ({ modules, routes }) => {
  const routeNames = Object.keys(routes);
  const usedBy = new Map();
  for (const route of routeNames) {
    const seen = new Set();
    const visit = (name) => {
      if (!Object.prototype.hasOwnProperty.call(modules, name)) throw new Error('unknown module: ' + name);
      if (seen.has(name)) return;
      seen.add(name);
      if (!f.noTransitive) for (const dep of modules[name].imports ?? []) visit(dep);
    };
    for (const entry of routes[route]) visit(entry);
    for (const name of seen) {
      if (!usedBy.has(name)) usedBy.set(name, new Set());
      usedBy.get(name).add(route);
    }
  }
  const groups = new Map();
  const add = (chunkName, list, name) => {
    if (!groups.has(chunkName)) groups.set(chunkName, { routes: list, modules: [] });
    const g = groups.get(chunkName);
    for (const r of list) if (!g.routes.includes(r)) g.routes.push(r);
    g.modules.push(name);
  };
  for (const [name, set] of usedBy) {
    const list = [...set].sort();
    if (f.duplicate) {
      for (const r of list) add('route:' + r, [r], name);
      continue;
    }
    let chunkName;
    if (list.length === 1) chunkName = 'route:' + list[0];
    else if (list.length === routeNames.length && !f.noCommon) chunkName = 'common';
    else chunkName = f.lumpShared ? 'shared' : 'shared:' + list.join('+');
    add(chunkName, list, name);
  }
  const chunks = [...groups]
    .map(([name, g]) => {
      const mods = [...new Set(g.modules)].sort();
      return { name, modules: mods, size: f.firstSize ? modules[mods[0]].size : mods.reduce((s, m) => s + modules[m].size, 0), routes: [...g.routes].sort() };
    })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const perRoute = {};
  for (const route of routeNames) perRoute[route] = chunks.filter((c) => c.routes.includes(route)).map((c) => c.name);
  return { chunks: chunks.map(({ name, modules: m, size }) => ({ name, modules: m, size })), routes: perRoute };
};

const correct = make();
const mutants = {
  'ignores transitive imports': make({ noTransitive: true }),
  'copies shared modules into every route chunk': make({ duplicate: true }),
  'merges all shared modules into one chunk': make({ lumpShared: true }),
  'never makes a common chunk': make({ noCommon: true }),
  'reports only the first module size': make({ firstSize: true }),
};

describe('your checkSplitChunks', () => {
  it('passes on a correct planner', () => {
    checkSplitChunks(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a planner that ${name}`, () => {
      let caught = false;
      try { checkSplitChunks(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Three routes `/a`, `/b`, `/c` with entries `a`, `b`, `c`.
- `util` imported by all three; `lib` (which imports `helper`) by `/a` and `/b`; `chart` by `/b` and `/c`.
- Give every module a different size.
- Expect six chunks: `common`, three `route:`, and two `shared:` with different route sets.

%% solution
```js
export function checkSplitChunks(splitChunks) {
  const modules = {
    a: { size: 1, imports: ['lib', 'util'] },
    b: { size: 2, imports: ['lib', 'util', 'chart'] },
    c: { size: 3, imports: ['util', 'chart'] },
    lib: { size: 20, imports: ['helper'] },
    helper: { size: 5 },
    util: { size: 10 },
    chart: { size: 40 },
    orphan: { size: 99 },
  };
  const result = splitChunks({ modules, routes: { '/a': ['a'], '/b': ['b'], '/c': ['c'] } });
  expect(result.chunks).toEqual([
    { name: 'common', modules: ['util'], size: 10 },
    { name: 'route:/a', modules: ['a'], size: 1 },
    { name: 'route:/b', modules: ['b'], size: 2 },
    { name: 'route:/c', modules: ['c'], size: 3 },
    { name: 'shared:/a+/b', modules: ['helper', 'lib'], size: 25 },
    { name: 'shared:/b+/c', modules: ['chart'], size: 40 },
  ]);
  expect(result.routes).toEqual({
    '/a': ['common', 'route:/a', 'shared:/a+/b'],
    '/b': ['common', 'route:/b', 'shared:/a+/b', 'shared:/b+/c'],
    '/c': ['common', 'route:/c', 'shared:/b+/c'],
  });
}
```
