---
id: pat-composite-visitor
track: pat
title: Composite, iterator & visitor
summary: Working with tree-shaped things: composites that treat one item and a whole group alike, composable specifications, lazy iterators and generators, and visitors that add new operations to a tree without editing its nodes.
---

## The idea in one sentence

When data is a **tree** (folders, menus, expressions, the DOM), give every node the **same interface**, then walk it with **iterators** or **visitors** instead of scattering `if (isFolder)` checks everywhere.

> **Analogy** A company org chart. "How many people work under you?" is one question to any employee. An individual contributor answers "just me". A manager asks each report the same question and adds the answers. The CEO uses the exact same method as the intern: nobody needs to know how deep the tree goes.

## Composite: one item or a group, same interface

![The composite pattern](fig:pat-composite "A file answers size() directly; a folder asks its children. Callers can't tell which they hold.")

```stepper Summing a tree
code:
  const root = folder('root', [
    file('a.txt', 10),
    folder('docs', [file('b.txt', 5), file('c.txt', 7)]),
  ]);
  root.size();
---
line: 5
say: The caller asks the **root** for its size, exactly as it would ask a single file.
call: root.size()
---
line: 2
say: The root is a **folder**, so its size is the sum of its children's sizes. First child: `a.txt` is a **leaf** and simply answers `10`.
call: root.size() = 10 + docs.size()
---
line: 3
say: The second child is **another folder**, so the same rule applies one level down: `b.txt` is `5`, `c.txt` is `7`.
call: docs.size() = 5 + 7 = 12
---
line: 5
say: Back at the root: `10 + 12 = 22`. The recursion followed the tree's shape, and no code ever asked "is this a file or a folder?".
result: 22
```

```js try predict
const file = (name, size) => ({ name, size: () => size });
const folder = (name, children = []) => ({
  name,
  add(child) { children.push(child); return this; },
  size: () => children.reduce((sum, c) => sum + c.size(), 0),
});
const root = folder('root').add(file('a', 10)).add(folder('docs').add(file('b', 5)).add(file('c', 7)));
console.log(root.size());
```

The same trick models menus with submenus, nested comments, UI component trees and arithmetic expressions.

### Composable conditions: the specification pattern

Predicates compose the same way. A **specification** wraps a test function and offers `and`, `or` and `not`, which return **new specifications**. A complex rule becomes a readable expression built from tiny, individually testable parts: `isAdult.and(hasLicense).and(isBanned.not())`.

## Iterators: walk without exposing the structure

An **iterator** hands out one item at a time (`next()` returns `{ value, done }`). In JavaScript, **generators** (`function*` with `yield`) are the easy way to write one, and `for…of` consumes it. Because values are produced **on demand**, a generator can even describe an **infinite** sequence.

![A lazy pipeline](fig:pat-iterator "Nothing runs until the consumer asks; take(3) ends the whole chain.")

```js try
function* naturals() { let n = 1; while (true) yield n++; }
function* map(it, fn) { for (const x of it) yield fn(x); }
function* filter(it, pred) { for (const x of it) if (pred(x)) yield x; }
function* take(it, n) { if (n <= 0) return; let i = 0; for (const x of it) { yield x; if (++i >= n) return; } }

console.log([...take(filter(map(naturals(), (x) => x * 2), (x) => x > 4), 3)]);
```

Walking a tree is a natural generator too: depth-first with recursion (`yield*`), breadth-first with a queue.

## Visitor: add operations without touching the nodes

Suppose you have an expression tree (`num`, `add`, `mul`, `neg`). You want to **evaluate** it, **print** it and **simplify** it, and next month **optimise** it. Putting every operation inside each node type means editing all node types for each new operation. A **visitor** flips that around: the node types stay put, and each operation is a **table of handlers**, one per node type.

![The visitor pattern](fig:pat-visitor "Each operation is a separate visitor over the same unchanged tree.")

```js try
const visit = (node, handlers) => {
  const handler = handlers[node.type];
  if (!handler) throw new Error('no handler for ' + node.type);
  return handler(node, (child) => visit(child, handlers));   // the handler decides how to recurse
};

const num = (value) => ({ type: 'num', value });
const add = (left, right) => ({ type: 'add', left, right });
const mul = (left, right) => ({ type: 'mul', left, right });

const evaluate = (n) => visit(n, {
  num: (node) => node.value,
  add: (node, go) => go(node.left) + go(node.right),
  mul: (node, go) => go(node.left) * go(node.right),
});
const show = (n) => visit(n, {
  num: (node) => String(node.value),
  add: (node, go) => `(${go(node.left)} + ${go(node.right)})`,
  mul: (node, go) => `(${go(node.left)} * ${go(node.right)})`,
});

const tree = add(num(1), mul(num(2), num(3)));
console.log(show(tree), '=', evaluate(tree));
```

The trade-off to know: visitors make **adding operations** easy and **adding node types** harder (every visitor needs a new handler). Choose by which axis changes more. Failing loudly on an unhandled type (as `visit` does) turns that into an obvious error instead of a silent gap.

## Quick check

```check
Q: What makes the composite pattern work?
A) Folders and files are the same class
B) Leaves and groups share one interface, so callers needn't know which they have *
C) Everything is a global
D) It uses inheritance only
Why: A shared interface lets a group delegate to its children recursively.
---
Q: What does `a.and(b.not())` return in the specification pattern?
A) A boolean
B) A new specification you can test values against *
C) Nothing
D) An error
Why: Combinators return new specifications, so rules compose.
---
Q: Why can a generator describe an infinite sequence?
A) Memory is infinite
B) Values are produced one at a time, only when the consumer asks *
C) It compresses data
D) It runs in the background
Why: Laziness: it computes the next value only on demand.
---
Q: What is the visitor pattern good for?
A) Adding new operations over a stable set of node types without editing the nodes *
B) Adding new node types easily
C) Speeding up loops
D) Hiding the tree
Why: Operations live in visitors; nodes stay unchanged. The cost is that new node types touch every visitor.
---
Q: Why should `visit` throw for an unknown node type?
A) To crash the app
B) A missing handler is a bug that should be loud, not a silent wrong answer *
C) Throwing is faster
D) It isn't needed
Why: Failing early makes incomplete visitors easy to find.
```

## Recap

- **Composite**: leaf and group share one interface; groups delegate to children recursively.
- **Specifications**: predicates with `and`, `or`, `not` that return new specifications.
- **Iterators and generators**: walk a structure lazily, one value at a time; infinite sequences are fine.
- **Visitor**: operations as handler tables over a stable tree; easy new operations, harder new node types.
- Fail **loudly** on unhandled node types.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: files and folders | The same `size()` on both; folders recurse |
| A file-tree composite | Recursion for `count`, `depth`, `paths`, `find`; duplicate-name checks |
| Specifications | Closures returning new objects with `test`, `and`, `or`, `not` |
| Lazy iterator helpers | `function*`, `yield`, `yield*`, early `return` |
| A visitor over expressions | A `visit` dispatcher, then `evaluate`, `stringify` and `simplify` |

%% exercise pat-guided-tree | Guided: files and folders | 1 | js | js | createFile, createFolder | 8 | guided
Implement a tiny composite.

- `createFile(name, size)` returns `{ name, size() }` where `size()` returns the file's size.
- `createFolder(name)` returns `{ name, add(child), size() }`. `add` appends a child (a file or another folder) and **returns the folder** so calls can chain. `size()` is the **sum of the children's sizes** (`0` when empty), and it must work for folders inside folders.

```js
const docs = createFolder('docs').add(createFile('a', 5)).add(createFile('b', 7));
createFolder('root').add(docs).add(createFile('c', 10)).size(); // 22
```

%% worked
**A similar problem, solved: `createGroup()` of prices** — a group sums its members, whatever they are.

```js
const item = (price) => ({ total: () => price });                    // ① a leaf answers directly

function createGroup() {
  const members = [];
  return {
    add(member) { members.push(member); return this; },              // ② return `this` so calls chain
    total: () => members.reduce((sum, m) => sum + m.total(), 0),     // ③ a group asks every member, leaf or group
  };
}
```

The group never checks what kind of member it holds: both kinds have `total()`. That is the whole pattern.

%% explain
- **Leaf**: `size()` returns its own number.
- **Folder**: `size()` sums `child.size()` over its children.
- **`add`** returns the folder.
- **Nesting** works because folders answer `size()` too.

%% nudge
- What does `reduce` give for an empty array if you pass `0` as the start?
- Why is there no `if (child is a folder)` anywhere?

%% starter
```js
export function createFile(name, size) {
  return { name, size: () => 0 };
}

export function createFolder(name) {
  const children = [];
  return {
    name,
    add(child) {
      return this;
    },
    size: () => 0,
  };
}
```

%% tests
```js
describe('createFile / createFolder', () => {
  it('a file reports its size', () => {
    expect(createFile('a.txt', 12).size()).toBe(12);
    expect(createFile('empty', 0).size()).toBe(0);
  });
  it('an empty folder has size 0', () => {
    expect(createFolder('x').size()).toBe(0);
  });
  it('a folder sums its children', () => {
    const f = createFolder('docs').add(createFile('a', 5)).add(createFile('b', 7));
    expect(f.size()).toBe(12);
  });
  it('folders nest', () => {
    const docs = createFolder('docs').add(createFile('a', 5)).add(createFile('b', 7));
    const root = createFolder('root').add(docs).add(createFile('c', 10));
    expect(root.size()).toBe(22);
  });
  it('sees later additions', () => {
    const docs = createFolder('docs');
    const root = createFolder('root').add(docs);
    expect(root.size()).toBe(0);
    docs.add(createFile('late', 4));
    expect(root.size()).toBe(4);
  });
  it('keeps the name and returns the folder from add', () => {
    const f = createFolder('docs');
    expect(f.name).toBe('docs');
    expect(f.add(createFile('a', 1))).toBe(f);
  });
});
```

%% hints
- `add(child) { children.push(child); return this; }`
- `size: () => children.reduce((sum, c) => sum + c.size(), 0)`

%% solution
```js
export function createFile(name, size) {
  return { name, size: () => size };
}

export function createFolder(name) {
  const children = [];
  return {
    name,
    add(child) {
      children.push(child);
      return this;
    },
    size: () => children.reduce((sum, c) => sum + c.size(), 0),
  };
}
```

%% exercise pat-file-tree | A file-tree composite | 3 | js | js | file, folder | 24
Implement `file(name, size)` and `folder(name, children = [])`. Every node has `type` (`'file'` or `'folder'`) and `name`.

- `size()`: a file's size; a folder's total of its descendants.
- `count()`: the number of **files** inside (a file counts as `1`).
- `depth()`: `0` for a file; for a folder `1 +` the deepest child (`1` for an empty folder).
- `paths()`: the path of every file, joined with `/` and starting with the root's name, in child order, e.g. `['root/a.txt', 'root/docs/b.txt']`. A file's own paths are `[name]`.
- `find(predicate)`: the paths (like `paths()`) of the files for which `predicate(fileNode)` is true.
- Folder only: `add(child)` (returns the folder; a **duplicate name** among its children throws `Error('duplicate name: NAME')`) and `remove(name)` (returns `true` if something was removed). Calling `add` on a file throws `Error('cannot add to a file')`.
- Names must be non-empty strings without `/` (else `Error('invalid name')`); a file size must be a number ≥ 0 (else `RangeError`).

```js
const root = folder('root', [file('a.txt', 10), folder('docs', [file('b.txt', 5)])]);
root.paths(); // ['root/a.txt', 'root/docs/b.txt']
```

%% worked
**A similar problem, solved: a menu tree** — every operation is "do my part, then ask the children".

```js
const item = (label) => ({ labels: () => [label], depth: () => 0 });
const menu = (label, children = []) => ({
  labels: () => [label, ...children.flatMap((c) => c.labels())],    // ① my part, then each child's answer
  depth: () => 1 + Math.max(0, ...children.map((c) => c.depth())),  // ② 1 + the deepest child
});
```

For `paths()`, a folder prefixes each child's path with its own name and `/`. For `find`, a **file** returns `[name]` if the predicate passes, else `[]`; a folder prefixes the results from its children. Validate names and sizes **when creating** a node, and duplicate names **when adding**.

%% explain
- **Same methods on both node kinds**; folders recurse.
- **`paths`/`find`** build paths by prefixing the folder name.
- **Initial `children`** are validated like added ones.
- **Rules**: duplicates, invalid names, adding to a file, negative sizes.

%% nudge
- What does `Math.max(0, ...[])` give, and why is it useful for `depth`?
- How does a folder turn a child's `['b.txt']` into `['docs/b.txt']`?

%% starter
```js
export function file(name, size) {
  return { type: 'file', name, size: () => 0, count: () => 0, depth: () => 0, paths: () => [], find: () => [], add() {} };
}

export function folder(name, children = []) {
  return {
    type: 'folder',
    name,
    size: () => 0,
    count: () => 0,
    depth: () => 0,
    paths: () => [],
    find: () => [],
    add(child) { return this; },
    remove(childName) { return false; },
  };
}
```

%% tests
```js
const sample = () => folder('root', [file('a.txt', 10), folder('docs', [file('b.txt', 5), file('c.txt', 7)]), folder('empty')]);

describe('file tree', () => {
  it('size, count and depth', () => {
    const root = sample();
    expect(root.size()).toBe(22);
    expect(root.count()).toBe(3);
    expect(root.depth()).toBe(2);
    expect(file('x', 1).depth()).toBe(0);
    expect(file('x', 1).count()).toBe(1);
    expect(folder('e').depth()).toBe(1);
    expect(folder('e').size()).toBe(0);
    expect(folder('e').count()).toBe(0);
  });
  it('lists paths in child order', () => {
    expect(sample().paths()).toEqual(['root/a.txt', 'root/docs/b.txt', 'root/docs/c.txt']);
    expect(file('solo', 3).paths()).toEqual(['solo']);
  });
  it('finds files by predicate', () => {
    expect(sample().find((f) => f.size() > 5)).toEqual(['root/a.txt', 'root/docs/c.txt']);
    expect(sample().find((f) => f.name === 'b.txt')).toEqual(['root/docs/b.txt']);
    expect(sample().find(() => false)).toEqual([]);
    expect(file('a', 9).find((f) => f.size() > 5)).toEqual(['a']);
  });
  it('has types and names', () => {
    expect(file('a', 1).type).toBe('file');
    expect(folder('d').type).toBe('folder');
    expect(folder('d').name).toBe('d');
  });
  it('adds and removes', () => {
    const f = folder('d');
    expect(f.add(file('a', 1))).toBe(f);
    f.add(file('b', 2));
    expect(f.size()).toBe(3);
    expect(f.remove('a')).toBe(true);
    expect(f.remove('a')).toBe(false);
    expect(f.size()).toBe(2);
    expect(f.paths()).toEqual(['d/b']);
  });
  it('rejects duplicates, also in the initial children', () => {
    const f = folder('d', [file('a', 1)]);
    expect(() => f.add(file('a', 2))).toThrow('duplicate name: a');
    expect(() => f.add(folder('a'))).toThrow('duplicate name: a');
    expect(() => folder('d', [file('x', 1), file('x', 2)])).toThrow('duplicate name: x');
  });
  it('cannot add to a file', () => {
    expect(() => file('a', 1).add(file('b', 1))).toThrow('cannot add to a file');
  });
  it('validates names and sizes', () => {
    expect(() => file('', 1)).toThrow('invalid name');
    expect(() => file('a/b', 1)).toThrow('invalid name');
    expect(() => folder('x/y')).toThrow('invalid name');
    expect(() => folder(5)).toThrow('invalid name');
    expect(() => file('a', -1)).toThrow(RangeError);
    expect(() => file('a', 'big')).toThrow(RangeError);
  });
  it('does not share the initial children array', () => {
    const kids = [file('a', 1)];
    const f = folder('d', kids);
    kids.push(file('b', 1));
    expect(f.count()).toBe(1);
  });
});
```

%% hints
- Validate first: `if (typeof name !== 'string' || name === '' || name.includes('/')) throw new Error('invalid name');`
- `paths` for folders: `children.flatMap((c) => c.paths().map((p) => `${name}/${p}`))`.
- `find` for files: `predicate(self) ? [name] : []`; for folders prefix like `paths`.
- Copy `children` and add each one through the same `add` logic so duplicates are checked.

%% solution
```js
const checkName = (name) => {
  if (typeof name !== 'string' || name === '' || name.includes('/')) throw new Error('invalid name');
};

export function file(name, size) {
  checkName(name);
  if (typeof size !== 'number' || Number.isNaN(size) || size < 0) throw new RangeError('size must be a number >= 0');
  const self = {
    type: 'file',
    name,
    size: () => size,
    count: () => 1,
    depth: () => 0,
    paths: () => [name],
    find: (predicate) => (predicate(self) ? [name] : []),
    add() {
      throw new Error('cannot add to a file');
    },
  };
  return self;
}

export function folder(name, children = []) {
  checkName(name);
  const list = [];
  const self = {
    type: 'folder',
    name,
    size: () => list.reduce((sum, c) => sum + c.size(), 0),
    count: () => list.reduce((sum, c) => sum + c.count(), 0),
    depth: () => 1 + Math.max(0, ...list.map((c) => c.depth())),
    paths: () => list.flatMap((c) => c.paths().map((p) => `${name}/${p}`)),
    find: (predicate) => list.flatMap((c) => c.find(predicate).map((p) => `${name}/${p}`)),
    add(child) {
      if (list.some((c) => c.name === child.name)) throw new Error('duplicate name: ' + child.name);
      list.push(child);
      return self;
    },
    remove(childName) {
      const i = list.findIndex((c) => c.name === childName);
      if (i < 0) return false;
      list.splice(i, 1);
      return true;
    },
  };
  for (const child of children) self.add(child);
  return self;
}
```

%% exercise pat-specs | Composable specifications | 2 | js | js | spec, all, any | 16
A **specification** wraps a predicate. `spec(fn)` returns an object with:

- `test(x)` returns `fn(x)` as a **boolean**.
- `and(other)`, `or(other)` return **new specifications** combining this one and `other` (another specification). They **short-circuit**: `and` doesn't evaluate `other` when this one is false; `or` doesn't when this one is true.
- `not()` returns the negated specification.

Also `all(...specs)` (true if every spec passes; **true** for none) and `any(...specs)` (true if at least one passes; **false** for none), both returning specifications.

```js
const adult = spec((p) => p.age >= 18);
const licensed = spec((p) => p.hasLicense);
adult.and(licensed.not()).test({ age: 30, hasLicense: false }); // true
```

%% worked
**A similar problem, solved: `rule(fn)` with `then`** — a wrapper whose methods return new wrappers.

```js
export function rule(fn) {
  return {
    test: (x) => Boolean(fn(x)),
    both: (other) => rule((x) => fn(x) && other.test(x)),     // ① a NEW rule built from two; && short-circuits for free
    flip: () => rule((x) => !fn(x)),
  };
}
```

Because every combinator returns another **spec**, you can chain them endlessly and the original specs never change. The built-in `&&` and `||` already short-circuit, so use them.

%% explain
- **`test`** returns a real boolean.
- **`and` / `or` / `not`** return new specifications; the originals are untouched.
- **Short-circuiting** is observable (spies on the second spec).
- **`all` / `any`** generalise to many; empty cases follow logic (`all` true, `any` false).

%% nudge
- Which JavaScript operators short-circuit already?
- What should `all()` with no specs return?

%% starter
```js
export function spec(fn) {
  return {
    test: (x) => false,
    and: (other) => spec(fn),
    or: (other) => spec(fn),
    not: () => spec(fn),
  };
}

export function all(...specs) {
  return spec(() => false);
}

export function any(...specs) {
  return spec(() => false);
}
```

%% tests
```js
const adult = spec((p) => p.age >= 18);
const licensed = spec((p) => p.hasLicense);

describe('spec', () => {
  it('tests and returns booleans', () => {
    expect(adult.test({ age: 30 })).toBe(true);
    expect(adult.test({ age: 3 })).toBe(false);
    expect(spec(() => 'truthy').test()).toBe(true);
    expect(spec(() => 0).test()).toBe(false);
  });
  it('combines with and / or / not', () => {
    const p = { age: 30, hasLicense: false };
    expect(adult.and(licensed).test(p)).toBe(false);
    expect(adult.or(licensed).test(p)).toBe(true);
    expect(licensed.not().test(p)).toBe(true);
    expect(adult.and(licensed.not()).test(p)).toBe(true);
  });
  it('short-circuits', () => {
    const never = jest.fn(() => true);
    const spy = spec(never);
    spec(() => false).and(spy).test(1);
    spec(() => true).or(spy).test(1);
    expect(never).not.toHaveBeenCalled();
    spec(() => true).and(spy).test(1);
    expect(never).toHaveBeenCalledTimes(1);
  });
  it('leaves the original specs unchanged', () => {
    const combined = adult.and(licensed);
    expect(combined).not.toBe(adult);
    expect(adult.test({ age: 30 })).toBe(true);
  });
  it('is chainable', () => {
    const big = spec((n) => n > 10), even = spec((n) => n % 2 === 0), small = spec((n) => n < 100);
    const s = big.and(even).and(small).or(spec((n) => n === 7));
    expect([7, 12, 13, 200, 4].map((n) => s.test(n))).toEqual([true, true, false, false, false]);
  });
});

describe('all / any', () => {
  const big = spec((n) => n > 10), even = spec((n) => n % 2 === 0);
  it('all requires every spec', () => {
    expect(all(big, even).test(12)).toBe(true);
    expect(all(big, even).test(13)).toBe(false);
    expect(all().test(1)).toBe(true);
  });
  it('any requires at least one', () => {
    expect(any(big, even).test(4)).toBe(true);
    expect(any(big, even).test(5)).toBe(false);
    expect(any().test(1)).toBe(false);
  });
  it('short-circuit as well', () => {
    const spy = jest.fn(() => true);
    all(spec(() => false), spec(spy)).test(1);
    any(spec(() => true), spec(spy)).test(1);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

%% hints
- `test: (x) => Boolean(fn(x))`; `and: (o) => spec((x) => fn(x) && o.test(x))`; `or: (o) => spec((x) => fn(x) || o.test(x))`; `not: () => spec((x) => !fn(x))`.
- `all`: `spec((x) => specs.every((s) => s.test(x)))`; `any`: `specs.some(...)`.

%% solution
```js
export function spec(fn) {
  return {
    test: (x) => Boolean(fn(x)),
    and: (other) => spec((x) => fn(x) && other.test(x)),
    or: (other) => spec((x) => fn(x) || other.test(x)),
    not: () => spec((x) => !fn(x)),
  };
}

export function all(...specs) {
  return spec((x) => specs.every((s) => s.test(x)));
}

export function any(...specs) {
  return spec((x) => specs.some((s) => s.test(x)));
}
```

%% exercise pat-iter-helpers | Lazy iterator helpers | 3 | js | js | dfs, bfs, map, filter, take, range | 26
Write **generator functions**.

- `range(start, end = Infinity, step = 1)` yields `start`, `start + step`, … while `< end` (an infinite sequence by default). A `step` of `0` throws `RangeError`.
- `map(iterable, fn)` yields `fn(item, index)`; `filter(iterable, predicate)` yields the items that pass (`predicate(item, index)`).
- `take(iterable, n)` yields at most `n` items and then **stops without pulling another** item from the source (`take(x, 0)` pulls nothing).
- `dfs(tree)` yields each node's `value` **pre-order** (parent, then each child's subtree in order); `bfs(tree)` yields **level by level**. A node is `{ value, children = [] }`.
- All are **lazy**: nothing happens until the result is iterated.

```js
[...take(filter(map(range(1), (x) => x * 2), (x) => x > 4), 3)]; // [6, 8, 10]
```

%% worked
**A similar problem, solved: `chunks(iterable, size)`** — a generator that groups items lazily.

```js
export function* chunks(iterable, size) {
  let batch = [];
  for (const item of iterable) {
    batch.push(item);
    if (batch.length === size) { yield batch; batch = []; }    // ① yield as soon as a group is ready
  }
  if (batch.length) yield batch;                               // ② the leftovers
}
```

`function*` makes a function that **pauses** at each `yield` and resumes when the consumer asks for the next value. For `dfs`, `yield*` delegates to a recursive call. For `bfs`, keep a queue and push each node's children behind the ones already waiting.

%% explain
- **Generators** (`function*`) produce values on demand.
- **`take` stops right after its `n`th item**, without asking for one more.
- **`dfs`** pre-order with `yield*`; **`bfs`** with a queue.
- **Infinite sources** work because of laziness.

%% nudge
- In `take`, where do you check the count so you never pull an extra item?
- Which data structure gives level-by-level order?

%% starter
```js
export function* range(start, end = Infinity, step = 1) {}
export function* map(iterable, fn) {}
export function* filter(iterable, predicate) {}
export function* take(iterable, n) {}
export function* dfs(tree) {}
export function* bfs(tree) {}
```

%% tests
```js
const tree = {
  value: 1,
  children: [
    { value: 2, children: [{ value: 4 }, { value: 5 }] },
    { value: 3, children: [{ value: 6 }] },
  ],
};

describe('range', () => {
  it('counts up', () => {
    expect([...range(1, 5)]).toEqual([1, 2, 3, 4]);
    expect([...range(0, 10, 3)]).toEqual([0, 3, 6, 9]);
    expect([...range(5, 5)]).toEqual([]);
  });
  it('is infinite by default and validates the step', () => {
    expect([...take(range(10), 3)]).toEqual([10, 11, 12]);
    expect(() => [...range(0, 5, 0)]).toThrow(RangeError);
  });
});

describe('map, filter, take', () => {
  it('map and filter pass the index', () => {
    expect([...map(['a', 'b'], (x, i) => x + i)]).toEqual(['a0', 'b1']);
    expect([...filter(['a', 'b', 'c'], (x, i) => i !== 1)]).toEqual(['a', 'c']);
  });
  it('take stops after n without pulling more', () => {
    let pulled = 0;
    function* source() { while (true) { pulled++; yield pulled; } }
    expect([...take(source(), 3)]).toEqual([1, 2, 3]);
    expect(pulled).toBe(3);
    pulled = 0;
    expect([...take(source(), 0)]).toEqual([]);
    expect(pulled).toBe(0);
  });
  it('take handles short sources', () => {
    expect([...take([1, 2], 5)]).toEqual([1, 2]);
  });
  it('is lazy: nothing runs until iterated', () => {
    const fn = jest.fn((x) => x);
    const it = map([1, 2, 3], fn);
    expect(fn).not.toHaveBeenCalled();
    it.next();
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('composes over an infinite source', () => {
    const result = [...take(filter(map(range(1), (x) => x * 2), (x) => x > 4), 3)];
    expect(result).toEqual([6, 8, 10]);
  });
  it('does only the needed work in a chain', () => {
    const seen = [];
    const result = [...take(map(range(1), (x) => { seen.push(x); return x; }), 2)];
    expect(result).toEqual([1, 2]);
    expect(seen).toEqual([1, 2]);
  });
});

describe('dfs and bfs', () => {
  it('dfs is pre-order', () => {
    expect([...dfs(tree)]).toEqual([1, 2, 4, 5, 3, 6]);
  });
  it('bfs goes level by level', () => {
    expect([...bfs(tree)]).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('handle a single node', () => {
    expect([...dfs({ value: 'x' })]).toEqual(['x']);
    expect([...bfs({ value: 'x' })]).toEqual(['x']);
  });
  it('can be stopped early', () => {
    expect([...take(dfs(tree), 2)]).toEqual([1, 2]);
    expect([...take(bfs(tree), 3)]).toEqual([1, 2, 3]);
  });
});
```

%% hints
- `range`: `if (step === 0) throw new RangeError(...)`, then `for (let x = start; step > 0 ? x < end : x > end; x += step) yield x;`
- `take`: `if (n <= 0) return; let i = 0; for (const x of iterable) { yield x; if (++i >= n) return; }`
- `dfs`: `yield tree.value; for (const c of tree.children ?? []) yield* dfs(c);`
- `bfs`: `const queue = [tree]; while (queue.length) { const n = queue.shift(); yield n.value; queue.push(...(n.children ?? [])); }`

%% solution
```js
export function* range(start, end = Infinity, step = 1) {
  if (step === 0) throw new RangeError('step must not be 0');
  for (let x = start; step > 0 ? x < end : x > end; x += step) yield x;
}

export function* map(iterable, fn) {
  let i = 0;
  for (const item of iterable) yield fn(item, i++);
}

export function* filter(iterable, predicate) {
  let i = 0;
  for (const item of iterable) {
    if (predicate(item, i++)) yield item;
  }
}

export function* take(iterable, n) {
  if (n <= 0) return;
  let i = 0;
  for (const item of iterable) {
    yield item;
    if (++i >= n) return;
  }
}

export function* dfs(tree) {
  yield tree.value;
  for (const child of tree.children ?? []) yield* dfs(child);
}

export function* bfs(tree) {
  const queue = [tree];
  while (queue.length) {
    const node = queue.shift();
    yield node.value;
    queue.push(...(node.children ?? []));
  }
}
```

%% exercise pat-visitor | A visitor over expressions | 4 | js | js | visit, evaluate, stringify, simplify | 32
Expressions are trees of nodes: `{ type: 'num', value }`, `{ type: 'var', name }`, `{ type: 'add', left, right }`, `{ type: 'mul', left, right }`, `{ type: 'neg', operand }`.

- `visit(node, handlers)` finds `handlers[node.type]`; if missing it throws `Error('no handler for TYPE')`. Otherwise it returns `handler(node, recurse)` where `recurse(child)` visits a child with the **same handlers**.
- `evaluate(node, env = {})` computes the value using `visit`. A `var` reads `env[name]`; an unknown name throws `Error('unbound variable: NAME')`.
- `stringify(node)` returns text: `num` as the number, `var` as its name, `add` as `(L + R)`, `mul` as `(L * R)`, `neg` as `-X`.
- `simplify(node)` returns a **new** tree (never mutating the input) with children simplified first, then: `add` of two nums → num; `x + 0` or `0 + x` → `x`; `mul` of two nums → num; `x * 0` or `0 * x` → `num 0`; `x * 1` or `1 * x` → `x`; `neg` of a num → num of the negated value (use `0 - v`, so `0` stays `0`); `neg(neg(x))` → `x`.

```js
const tree = { type: 'add', left: { type: 'num', value: 1 }, right: { type: 'mul', left: { type: 'num', value: 2 }, right: { type: 'num', value: 3 } } };
evaluate(tree);  // 7
stringify(tree); // '(1 + (2 * 3))'
```

%% worked
**A similar problem, solved: counting nodes with a visitor** — one handler per type, recursion through `go`.

```js
const countNodes = (node) => visit(node, {
  num: () => 1,
  var: () => 1,
  add: (n, go) => 1 + go(n.left) + go(n.right),    // ① the handler decides how to recurse
  mul: (n, go) => 1 + go(n.left) + go(n.right),
  neg: (n, go) => 1 + go(n.operand),
});
```

The handler for a node receives a ready-made `go` (your `recurse`) so it never needs to know the visitor's name. `simplify` is a visitor too: its handlers **return nodes**, rebuilding the tree bottom-up. Build `evaluate` with a small helper if you need the `env`: handlers can close over it.

%% explain
- **`visit`** dispatches on `node.type`, throws for unknown types, and passes `recurse`.
- **`evaluate`**, **`stringify`**, **`simplify`** are just handler tables.
- **`simplify`** simplifies children first, then applies the algebra rules, returning new nodes.
- **Unbound variables** are errors, not `NaN`.

%% nudge
- What does a `simplify` handler return, compared with an `evaluate` handler?
- Why simplify the children **before** looking at the node's own rules?

%% starter
```js
export function visit(node, handlers) {
  return undefined;
}

export function evaluate(node, env = {}) {
  return 0;
}

export function stringify(node) {
  return '';
}

export function simplify(node) {
  return node;
}
```

%% tests
```js
const num = (value) => ({ type: 'num', value });
const v = (name) => ({ type: 'var', name });
const add = (left, right) => ({ type: 'add', left, right });
const mul = (left, right) => ({ type: 'mul', left, right });
const neg = (operand) => ({ type: 'neg', operand });

describe('visit', () => {
  it('dispatches by type and passes a recurse function', () => {
    const count = (n) => visit(n, {
      num: () => 1,
      add: (node, go) => 1 + go(node.left) + go(node.right),
    });
    expect(count(add(num(1), add(num(2), num(3))))).toBe(5);
  });
  it('throws for a type with no handler', () => {
    expect(() => visit(mul(num(1), num(2)), { num: () => 0 })).toThrow('no handler for mul');
    expect(() => visit(num(1), {})).toThrow('no handler for num');
  });
});

describe('evaluate', () => {
  it('computes values', () => {
    expect(evaluate(num(5))).toBe(5);
    expect(evaluate(add(num(1), mul(num(2), num(3))))).toBe(7);
    expect(evaluate(neg(add(num(1), num(2))))).toBe(-3);
  });
  it('reads variables from env', () => {
    expect(evaluate(add(v('x'), mul(v('y'), num(2))), { x: 1, y: 10 })).toBe(21);
  });
  it('throws for unbound variables', () => {
    expect(() => evaluate(v('z'))).toThrow('unbound variable: z');
    expect(() => evaluate(v('toString'))).toThrow('unbound variable: toString');
  });
});

describe('stringify', () => {
  it('prints with parentheses', () => {
    expect(stringify(num(3))).toBe('3');
    expect(stringify(v('x'))).toBe('x');
    expect(stringify(add(num(1), mul(num(2), num(3))))).toBe('(1 + (2 * 3))');
    expect(stringify(neg(add(v('a'), num(1))))).toBe('-(a + 1)');
    expect(stringify(neg(neg(v('x'))))).toBe('--x');
  });
});

describe('simplify', () => {
  it('folds constants', () => {
    expect(simplify(add(num(1), num(2)))).toEqual(num(3));
    expect(simplify(mul(num(3), num(4)))).toEqual(num(12));
    expect(simplify(neg(num(5)))).toEqual(num(-5));
    expect(simplify(neg(num(0)))).toEqual(num(0));
  });
  it('removes identities', () => {
    expect(simplify(add(v('x'), num(0)))).toEqual(v('x'));
    expect(simplify(add(num(0), v('x')))).toEqual(v('x'));
    expect(simplify(mul(v('x'), num(1)))).toEqual(v('x'));
    expect(simplify(mul(num(1), v('x')))).toEqual(v('x'));
  });
  it('multiplication by zero is zero', () => {
    expect(simplify(mul(v('x'), num(0)))).toEqual(num(0));
    expect(simplify(mul(num(0), add(v('x'), v('y'))))).toEqual(num(0));
  });
  it('removes double negation', () => {
    expect(simplify(neg(neg(v('x'))))).toEqual(v('x'));
  });
  it('simplifies children first and repeatedly bottom-up', () => {
    const tree = add(mul(v('x'), num(1)), mul(num(2), add(num(1), num(2))));
    expect(simplify(tree)).toEqual(add(v('x'), num(6)));
    expect(simplify(add(mul(v('x'), num(0)), v('y')))).toEqual(v('y'));
  });
  it('leaves already simple trees alone and does not mutate the input', () => {
    const tree = add(v('x'), mul(v('y'), num(2)));
    const copy = JSON.parse(JSON.stringify(tree));
    expect(simplify(tree)).toEqual(copy);
    simplify(add(num(1), num(2)));
    expect(tree).toEqual(copy);
  });
});
```

%% hints
- `visit`: `const h = handlers[node.type]; if (!h) throw new Error('no handler for ' + node.type); return h(node, (child) => visit(child, handlers));`
- `evaluate`: close over `env`; `var: (n) => { if (!Object.prototype.hasOwnProperty.call(env, n.name)) throw ...; return env[n.name]; }`.
- `simplify`: handlers return nodes; after `go(left)`/`go(right)`, check `isNum(l) && isNum(r)`, then the identity rules.

%% solution
```js
export function visit(node, handlers) {
  const handler = handlers[node.type];
  if (!handler) throw new Error('no handler for ' + node.type);
  return handler(node, (child) => visit(child, handlers));
}

export function evaluate(node, env = {}) {
  return visit(node, {
    num: (n) => n.value,
    var: (n) => {
      if (!Object.prototype.hasOwnProperty.call(env, n.name)) throw new Error('unbound variable: ' + n.name);
      return env[n.name];
    },
    add: (n, go) => go(n.left) + go(n.right),
    mul: (n, go) => go(n.left) * go(n.right),
    neg: (n, go) => -go(n.operand),
  });
}

export function stringify(node) {
  return visit(node, {
    num: (n) => String(n.value),
    var: (n) => n.name,
    add: (n, go) => `(${go(n.left)} + ${go(n.right)})`,
    mul: (n, go) => `(${go(n.left)} * ${go(n.right)})`,
    neg: (n, go) => `-${go(n.operand)}`,
  });
}

export function simplify(node) {
  const isNum = (n, value) => n.type === 'num' && (value === undefined || n.value === value);
  return visit(node, {
    num: (n) => ({ type: 'num', value: n.value }),
    var: (n) => ({ type: 'var', name: n.name }),
    add: (n, go) => {
      const left = go(n.left);
      const right = go(n.right);
      if (isNum(left) && isNum(right)) return { type: 'num', value: left.value + right.value };
      if (isNum(left, 0)) return right;
      if (isNum(right, 0)) return left;
      return { type: 'add', left, right };
    },
    mul: (n, go) => {
      const left = go(n.left);
      const right = go(n.right);
      if (isNum(left) && isNum(right)) return { type: 'num', value: left.value * right.value };
      if (isNum(left, 0) || isNum(right, 0)) return { type: 'num', value: 0 };
      if (isNum(left, 1)) return right;
      if (isNum(right, 1)) return left;
      return { type: 'mul', left, right };
    },
    neg: (n, go) => {
      const operand = go(n.operand);
      if (isNum(operand)) return { type: 'num', value: 0 - operand.value };
      if (operand.type === 'neg') return operand.operand;
      return { type: 'neg', operand };
    },
  });
}
```
