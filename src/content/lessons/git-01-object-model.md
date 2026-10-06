---
id: git-object-model
track: git
title: How Git stores history
summary: Commits, trees and blobs named by the hash of their content, the commit graph with parents, refs and HEAD as movable labels, merge bases, and what becomes garbage when history is rewritten.
---

## The idea in one sentence

Git is a **database of snapshots named by their content**: every commit points to a complete snapshot and to its **parents**, and branches are just **labels** on commits, which is why most Git operations are cheap and why history is never edited, only **added to**.

> **Analogy** A photo album where each photo is filed under a **fingerprint of the picture itself**. Two identical photos get the same fingerprint, so only one is kept. A **sticky note** (a branch) marks the latest photo of each storyline; moving the note never changes a photo.

*(In real Git you can look at all of this with `git cat-file -p <hash>`, `git log --graph`, `git reflog`. Here you build a tiny version to see why it behaves the way it does.)*

## Three kinds of object

![Git objects](fig:gt-objects "Commit, tree, blob: each named by the hash of its content.")

| Object | Contains | Points to |
| --- | --- | --- |
| **blob** | the bytes of one file (no name!) | nothing |
| **tree** | a directory: names with the blobs or trees they hold | blobs, subtrees |
| **commit** | message, author, time | **one tree** and **0+ parent commits** |

Because the name is a **hash of the content**: the same file content is stored **once** across the whole history; any change anywhere produces a **new hash for everything above it** (blob → tree → commit); and history is **tamper-evident**: you cannot alter an old commit without changing every descendant's hash.

```js try predict
const hash = (text) => {
  let h = 0x811c9dc5;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
};

console.log(hash('blob hello') === hash('blob hello'), hash('blob hello') === hash('blob hellp'));
```

## The commit graph

![Commit graph](fig:gt-dag "Arrows point to parents. A merge commit has two.")

Commits form a **directed acyclic graph**: each one points to its parent(s), never forward. A normal commit has one parent; a **merge commit** has two or more; the first commit has none. Two questions you can answer purely from the graph:

- Is commit **X an ancestor of Y**? (Can I walk from Y back to X?) This is what "is this branch already merged into main?" means.
- What is the **merge base** of X and Y: the **nearest common ancestor**? It is the starting point of a three-way merge (next lesson). Careful: a common ancestor that is itself an ancestor of another common ancestor is **not** the nearest.

## Refs and HEAD

![Refs](fig:gt-refs "Branches are labels; commits are immutable; rewriting leaves orphans behind.")

A **branch** is a tiny file holding one commit hash. **HEAD** says which branch you are on (or, when **detached**, which commit directly). `git commit` writes new objects and then **moves the current branch label**. Nothing existing is modified.

That explains the scary-sounding operations: **`rebase`**, **`commit --amend`** and **`reset`** do not edit commits; they create **new commits** and move a label. The old ones become **unreachable** (no label leads to them). `git gc` eventually deletes unreachable objects, but the **reflog**, a private log of where each label used to point, lets you recover them for a while.

```stepper Making one commit
code:
  git add app.js
  git commit -m "fix login"
---
line: 1
say: `add` copies the file's content into the object store as a **blob** (named by its hash) and records the name-to-blob link in the **staging area** (index).
phase: stage
---
line: 2
say: `commit` writes a **tree** from the staging area. Files you did not change point to **blobs that already exist**: nothing is copied twice.
phase: tree
---
line: 2
say: It then writes a **commit** object: that tree, the **current branch tip as parent**, and your message.
phase: commit object
---
line: 2
say: Finally the **branch label moves** to the new commit. HEAD still points to the branch, so it follows along.
phase: move label
```

## Quick check

```check
Q: Why does Git store a file that did not change only once across many commits?
A) Git compresses everything
B) Objects are named by the hash of their content, so identical content is the same object *
C) Only the latest commit keeps files
D) Git deletes old versions
Why: Same content, same hash, same object; trees just point to it again.
---
Q: What is a branch?
A) A copy of the whole repository
B) A movable label holding one commit hash *
C) A folder of commits
D) A list of changed files
Why: That is why creating a branch is instant.
---
Q: After "git rebase", what happened to the old commits?
A) They were edited in place
B) They were deleted at once
C) New commits were created and the branch moved; the old ones are unreachable but recoverable via the reflog *
D) They were merged
Why: Commits are immutable; rebase makes copies.
---
Q: What is the merge base of two branches?
A) The first commit of the repository
B) The nearest commit that both branches can reach *
C) The newest commit on main
D) The commit with the most changes
Why: It is the common starting point for combining the two sets of changes.
```

## Recap

- Objects (**blob, tree, commit**) are named by the **hash of their content**: dedupe, tamper-evidence, cheap snapshots.
- History is a **DAG** of commits pointing to **parents**; a merge commit has several.
- **Ancestor** and **merge base** are graph questions; the merge base is the **nearest** common ancestor.
- **Branches and HEAD are labels**; commits never change. Rewriting creates new commits and leaves old ones **unreachable** until `gc`; the **reflog** helps recovery.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: shortest unique prefix | Prefix comparison against a list |
| A tiny repository | Hashing with a `Map` store, trees, parents, a moving branch label |
| Ancestors and merge bases | Graph traversal with a visited set |
| Garbage collection | Reachability from labels |
| Tests for merge bases | Graphs where the obvious answer is wrong |

%% exercise gx-guided-prefix | Guided: shortest unique prefix | 2 | js | js | shortestUnique | 10 | guided
Git shows abbreviated hashes. Implement `shortestUnique(hash, all, min = 4)`: the **shortest prefix of `hash`**, at least `min` characters long, that **no other hash in `all`** starts with (ignore `hash` itself in `all`). If even the full hash is not unique, return the full hash.

```js
shortestUnique('abcd1234', ['abcd1234', 'abce9999', 'abcd5678'], 4); // 'abcd1'
```

%% worked
**A similar problem, solved: `shortestDistinctName(name, others)`** — grow a prefix until nobody else shares it.

```js
function shortestDistinctName(name, others) {
  for (let len = 1; len <= name.length; len++) {
    const prefix = name.slice(0, len);                                     // ① try ever longer prefixes
    if (!others.some((o) => o !== name && o.startsWith(prefix))) return prefix;   // ② unique as soon as no OTHER name shares it
  }
  return name;                                                              // ③ nothing shorter works
}
```

Yours starts the loop at `min` instead of `1`, and must never compare the hash with itself (it is usually in `all`).

%% explain
- **Loop** the prefix length from `min` to the full length.
- **Skip the hash itself** when checking others.
- Fall back to the full hash.

%% nudge
- What if `min` is longer than the hash?
- Why must the hash itself be ignored?

%% starter
```js
export function shortestUnique(hash, all, min = 4) {
  return hash;
}
```

%% tests
```js
describe('shortestUnique', () => {
  it('finds the shortest unique prefix, at least min characters', () => {
    expect(shortestUnique('abcd1234', ['abcd1234', 'abce9999', 'abcd5678'], 4)).toBe('abcd1');
    expect(shortestUnique('ffff0000', ['ffff0000', '1234abcd'], 4)).toBe('ffff');
  });
  it('respects a custom minimum', () => {
    expect(shortestUnique('abcdef', ['abcdef'], 2)).toBe('ab');
    expect(shortestUnique('abcdef', ['abcdef'], 7)).toBe('abcdef');
  });
  it('ignores the hash itself, whether or not it is listed', () => {
    expect(shortestUnique('abcd1234', [], 4)).toBe('abcd');
    expect(shortestUnique('abcd1234', ['abcd1234', 'abcd1234'], 4)).toBe('abcd');
  });
  it('returns the full hash when no prefix is unique', () => {
    expect(shortestUnique('abcd', ['abcd', 'abcde'], 4)).toBe('abcd');
  });
  it('defaults the minimum to four', () => {
    expect(shortestUnique('1234567890', ['9999'])).toBe('1234');
  });
});
```

%% hints
- `for (let len = Math.min(min, hash.length); len <= hash.length; len++)`
- `all.some((h) => h !== hash && h.startsWith(prefix))`

%% solution
```js
export function shortestUnique(hash, all, min = 4) {
  for (let len = Math.min(min, hash.length); len <= hash.length; len++) {
    const prefix = hash.slice(0, len);
    if (!all.some((other) => other !== hash && other.startsWith(prefix))) return prefix;
  }
  return hash;
}
```

%% exercise gx-repo | A tiny repository | 4 | js | js | createRepo | 50
`createRepo()` models the object store. It returns `{ commit, branch, checkout, head, log, read, objectCount }` and starts on a branch named `main` with no commits.

**Objects** are stored by hash. Define the hash of an object as 16 hex characters computed from the text `type + ' ' + content` (use two FNV-1a 32-bit passes with different offset bases, or any deterministic 64-bit style hash you like): **same type and content must give the same hash, anything else a different one**. Storing an object that already exists adds nothing.

- `commit({ files, message })` stores one **blob** per file (content = the file text), one **tree** (its content lists `path` and blob hash for every file, sorted by path), and one **commit** (its content lists the tree hash, the parent commit hash if the branch has a tip, and the message). It moves the **current branch** to the new commit and returns the commit hash. No timestamps: committing the same things the same way in two fresh repositories must give **identical hashes**.
- `branch(name)` creates a branch at the current commit. It throws `Error('no commits yet')` before any commit and `Error('branch exists: ' + name)` if the name is taken.
- `checkout(name)` makes `name` the current branch, or throws `Error('unknown branch: ' + name)`.
- `head()` returns `{ branch, commit }` (`commit` is `null` before the first commit).
- `log()` returns `[{ hash, message }]` from the current commit back through **first parents**, newest first (empty before the first commit).
- `read(hash)` returns the `files` map of that commit (path → content), or throws `Error('unknown commit: ' + hash)`.
- `objectCount()` returns the number of **distinct** stored objects.

```js
const repo = createRepo();
const c1 = repo.commit({ files: { 'a.txt': 'hi' }, message: 'first' });
repo.objectCount(); // 3: one blob, one tree, one commit
```

%% worked
**A similar problem, solved: `createSnapshots()`** — content-addressed storage that **dedupes**, with a label that moves.

```js
function createSnapshots() {
  const store = new Map();                                       // hash -> content
  let latest = null;
  const hashOf = (text) => { let h = 0x811c9dc5; for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  const put = (text) => { const id = hashOf(text); if (!store.has(id)) store.set(id, text); return id; };   // ① storing twice adds nothing
  return {
    save(data) {
      const id = put(JSON.stringify({ data, parent: latest }));    // ② the parent is PART of the content, so history is part of identity
      latest = id;                                                 // ③ only the label moves
      return id;
    },
    count: () => store.size,
  };
}
```

Your repository stores **three kinds** of object through the same `put`, and keeps **one label per branch**. Because a commit's content includes its parent's hash, two commits with the same files and message but different parents get **different hashes**.

%% explain
- **`put(type, content)`** hashes `type + ' ' + content` and stores once.
- **`commit`**: blobs, then tree, then commit (with the parent), then move the branch.
- **`log`** walks first parents using a parsed copy of each commit.

%% nudge
- Why must the parent hash be part of the commit's content?
- Why does a second commit with one changed file add exactly three objects?

%% starter
```js
export function createRepo() {
  const objects = new Map();
  const branches = new Map([['main', null]]);
  let current = 'main';
  return {
    commit({ files, message }) {},
    branch(name) {},
    checkout(name) {},
    head() {
      return { branch: current, commit: null };
    },
    log() {
      return [];
    },
    read(hash) {},
    objectCount() {
      return objects.size;
    },
  };
}
```

%% tests
```js
describe('createRepo', () => {
  const first = () => ({ 'a.txt': 'hello', 'b.txt': 'world' });

  it('starts empty on main', () => {
    const repo = createRepo();
    expect(repo.head()).toEqual({ branch: 'main', commit: null });
    expect(repo.log()).toEqual([]);
    expect(repo.objectCount()).toBe(0);
  });
  it('stores blobs, a tree and a commit', () => {
    const repo = createRepo();
    const hash = repo.commit({ files: first(), message: 'first' });
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(repo.objectCount()).toBe(4);
    expect(repo.head()).toEqual({ branch: 'main', commit: hash });
    expect(repo.read(hash)).toEqual(first());
  });
  it('is deterministic: the same history gives the same hashes', () => {
    const a = createRepo();
    const b = createRepo();
    const ha = [a.commit({ files: first(), message: 'one' }), a.commit({ files: { ...first(), 'c.txt': 'x' }, message: 'two' })];
    const hb = [b.commit({ files: first(), message: 'one' }), b.commit({ files: { ...first(), 'c.txt': 'x' }, message: 'two' })];
    expect(ha).toEqual(hb);
  });
  it('depends on content, message and parent', () => {
    const repo = createRepo();
    const c1 = repo.commit({ files: first(), message: 'one' });
    const other = createRepo().commit({ files: { ...first(), 'a.txt': 'changed' }, message: 'one' });
    const msg = createRepo().commit({ files: first(), message: 'different' });
    expect(new Set([c1, other, msg]).size).toBe(3);
    const c2 = repo.commit({ files: first(), message: 'one' });
    expect(c2).not.toBe(c1);
  });
  it('reuses unchanged blobs: one changed file adds a blob, a tree and a commit', () => {
    const repo = createRepo();
    repo.commit({ files: first(), message: 'one' });
    repo.commit({ files: { ...first(), 'b.txt': 'changed' }, message: 'two' });
    expect(repo.objectCount()).toBe(7);
  });
  it('stores identical content once, even in different files', () => {
    const repo = createRepo();
    repo.commit({ files: { 'a.txt': 'same', 'b.txt': 'same' }, message: 'dup' });
    expect(repo.objectCount()).toBe(3);
  });
  it('chains commits and logs first parents newest first', () => {
    const repo = createRepo();
    const c1 = repo.commit({ files: first(), message: 'one' });
    const c2 = repo.commit({ files: { 'a.txt': 'v2' }, message: 'two' });
    expect(repo.log()).toEqual([{ hash: c2, message: 'two' }, { hash: c1, message: 'one' }]);
    expect(repo.read(c1)).toEqual(first());
    expect(repo.read(c2)).toEqual({ 'a.txt': 'v2' });
  });
  it('creates and switches branches; commits move only the current branch', () => {
    const repo = createRepo();
    const c1 = repo.commit({ files: first(), message: 'base' });
    repo.branch('feature');
    repo.checkout('feature');
    expect(repo.head()).toEqual({ branch: 'feature', commit: c1 });
    const c2 = repo.commit({ files: { 'a.txt': 'feature work' }, message: 'feature' });
    expect(repo.head().commit).toBe(c2);
    repo.checkout('main');
    expect(repo.head().commit).toBe(c1);
    expect(repo.log().map((l) => l.message)).toEqual(['base']);
    const c3 = repo.commit({ files: { 'a.txt': 'main work' }, message: 'main' });
    expect(repo.log().map((l) => l.hash)).toEqual([c3, c1]);
    repo.checkout('feature');
    expect(repo.log().map((l) => l.hash)).toEqual([c2, c1]);
  });
  it('rejects bad branch operations', () => {
    const repo = createRepo();
    expect(() => repo.branch('x')).toThrow('no commits yet');
    repo.commit({ files: first(), message: 'base' });
    repo.branch('x');
    expect(() => repo.branch('x')).toThrow('branch exists: x');
    expect(() => repo.checkout('nope')).toThrow('unknown branch: nope');
    expect(() => repo.read('deadbeef')).toThrow('unknown commit: deadbeef');
  });
  it('does not keep a reference to the caller files object', () => {
    const repo = createRepo();
    const files = { 'a.txt': 'one' };
    const hash = repo.commit({ files, message: 'm' });
    files['a.txt'] = 'mutated';
    expect(repo.read(hash)).toEqual({ 'a.txt': 'one' });
  });
});
```

%% hints
- `put(type, content)`: `const id = fnv(type + ' ' + content)`; `objects.set(id, ...)` only if missing.
- Tree text: `Object.keys(files).sort().map((p) => p + ' ' + blobHash).join('\n')`.
- Commit text: `'tree ' + tree + '\n' + (parent ? 'parent ' + parent + '\n' : '') + '\n' + message`.
- Keep a parsed `commits` Map (`hash → { parent, message, files }`) for `log` and `read`; copy `files` when storing.
- For 16 hex characters, join two 8-character FNV hashes made with different seeds.

%% solution
```js
export function createRepo() {
  const objects = new Map();
  const commits = new Map();
  const branches = new Map([['main', null]]);
  let current = 'main';

  const fnv = (text, seed) => {
    let h = seed;
    for (const ch of text) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  const hashOf = (text) => fnv(text, 0x811c9dc5) + fnv(text, 0x01234567);
  const put = (type, content) => {
    const id = hashOf(type + ' ' + content);
    if (!objects.has(id)) objects.set(id, { type, content });
    return id;
  };

  return {
    commit({ files, message }) {
      const lines = Object.keys(files)
        .sort()
        .map((path) => path + ' ' + put('blob', files[path]));
      const tree = put('tree', lines.join('\n'));
      const parent = branches.get(current);
      const hash = put('commit', 'tree ' + tree + '\n' + (parent ? 'parent ' + parent + '\n' : '') + '\n' + message);
      commits.set(hash, { parent, message, files: { ...files } });
      branches.set(current, hash);
      return hash;
    },
    branch(name) {
      const tip = branches.get(current);
      if (!tip) throw new Error('no commits yet');
      if (branches.has(name)) throw new Error('branch exists: ' + name);
      branches.set(name, tip);
    },
    checkout(name) {
      if (!branches.has(name)) throw new Error('unknown branch: ' + name);
      current = name;
    },
    head() {
      return { branch: current, commit: branches.get(current) };
    },
    log() {
      const out = [];
      for (let hash = branches.get(current); hash; hash = commits.get(hash).parent) {
        out.push({ hash, message: commits.get(hash).message });
      }
      return out;
    },
    read(hash) {
      if (!commits.has(hash)) throw new Error('unknown commit: ' + hash);
      return { ...commits.get(hash).files };
    },
    objectCount() {
      return objects.size;
    },
  };
}
```

%% exercise gx-merge-bases | Ancestors and merge bases | 4 | js | js | isAncestor, mergeBases | 40
A history is a graph `{ [commitId]: { parents: [ids] } }` (`parents` may be missing for a root).

- `isAncestor(graph, a, b)` is `true` if `a` can be reached from `b` by following parent links, **including `a === b`**.
- `mergeBases(graph, a, b)` returns the **best common ancestors** of `a` and `b` as a **sorted array** of ids: the common ancestors (each commit counts as its own ancestor) that are **not an ancestor of another common ancestor**. No common ancestor gives `[]`. (In a criss-cross merge there can be two.)
- Any id that is not in the graph (the arguments, or a parent that is missing) throws `Error('unknown commit: ' + id)`.
- Parents must be followed through **merge commits' every parent** (not just the first), and shared history must not be visited twice.

```js
const g = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] }, D: { parents: ['B'] } };
mergeBases(g, 'C', 'D'); // ['B']
```

%% worked
**A similar problem, solved: `reachableFrom(graph, start)`** — a traversal with a visited set, returning everything you can reach.

```js
function reachableFrom(graph, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;                         // ① shared history is visited once; this also stops cycles
    if (!(id in graph)) throw new Error('unknown: ' + id);
    seen.add(id);
    for (const parent of graph[id].parents ?? []) stack.push(parent);   // ② ALL parents, not just the first
  }
  return seen;                                           // ③ includes `start` itself
}
```

Merge bases are then **set arithmetic**: intersect the two sets, then drop every member that is reachable from another member (it is not the "nearest").

%% explain
- **`ancestors(graph, id)`**: visited-set traversal, including the id itself.
- **Common** = intersection of both sets.
- **Best** = common ancestors not reachable from another common ancestor.

%% nudge
- Why is the first common ancestor you find not always the merge base?
- What makes a common ancestor "not the nearest"?

%% starter
```js
export function isAncestor(graph, a, b) {
  return false;
}

export function mergeBases(graph, a, b) {
  return [];
}
```

%% tests
```js
describe('isAncestor', () => {
  const g = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] }, D: { parents: ['B'] }, M: { parents: ['C', 'D'] }, Z: {} };
  it('follows parents transitively, including a commit being its own ancestor', () => {
    expect(isAncestor(g, 'A', 'C')).toBe(true);
    expect(isAncestor(g, 'B', 'B')).toBe(true);
    expect(isAncestor(g, 'C', 'A')).toBe(false);
    expect(isAncestor(g, 'Z', 'M')).toBe(false);
  });
  it('follows every parent of a merge commit', () => {
    expect(isAncestor(g, 'C', 'M')).toBe(true);
    expect(isAncestor(g, 'D', 'M')).toBe(true);
    expect(isAncestor(g, 'D', 'C')).toBe(false);
  });
  it('rejects unknown ids', () => {
    expect(() => isAncestor(g, 'nope', 'C')).toThrow('unknown commit: nope');
    expect(() => isAncestor(g, 'A', 'nope')).toThrow('unknown commit: nope');
    expect(() => isAncestor({ X: { parents: ['gone'] } }, 'gone', 'X')).toThrow('unknown commit: gone');
  });
});

describe('mergeBases', () => {
  it('finds the fork point of two branches', () => {
    const g = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] }, D: { parents: ['B'] } };
    expect(mergeBases(g, 'C', 'D')).toEqual(['B']);
  });
  it('is the older commit when one side is an ancestor of the other', () => {
    const g = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] } };
    expect(mergeBases(g, 'B', 'C')).toEqual(['B']);
    expect(mergeBases(g, 'C', 'B')).toEqual(['B']);
    expect(mergeBases(g, 'C', 'C')).toEqual(['C']);
  });
  it('picks the nearest common ancestor, not any common ancestor', () => {
    const g = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] }, D: { parents: ['B'] }, E: { parents: ['C'] } };
    expect(mergeBases(g, 'E', 'D')).toEqual(['B']);
  });
  it('follows merge commits when looking for common history', () => {
    const g = {
      A: {}, B: { parents: ['A'] }, C: { parents: ['A'] },
      M: { parents: ['B', 'C'] }, X: { parents: ['M'] }, Y: { parents: ['C'] },
    };
    expect(mergeBases(g, 'X', 'Y')).toEqual(['C']);
  });
  it('can return two bases for a criss-cross merge, sorted', () => {
    const g = {
      R: {}, A: { parents: ['R'] }, B: { parents: ['R'] },
      M1: { parents: ['A', 'B'] }, M2: { parents: ['B', 'A'] },
    };
    expect(mergeBases(g, 'M1', 'M2')).toEqual(['A', 'B']);
  });
  it('returns nothing for unrelated histories', () => {
    const g = { A: {}, B: {} };
    expect(mergeBases(g, 'A', 'B')).toEqual([]);
  });
  it('rejects unknown commits', () => {
    expect(() => mergeBases({ A: {} }, 'A', 'B')).toThrow('unknown commit: B');
  });
  it('copes with long shared history', () => {
    const g = { c0: {} };
    for (let i = 1; i < 2000; i++) g['c' + i] = { parents: ['c' + (i - 1)] };
    g.left = { parents: ['c1999'] };
    g.right = { parents: ['c1999'] };
    expect(mergeBases(g, 'left', 'right')).toEqual(['c1999']);
  });
});
```

%% hints
- Write `ancestors(graph, id)` returning a `Set` that includes `id`, using an explicit stack (no recursion) and a `seen` set.
- `common = [...A].filter((x) => B.has(x))`.
- Keep a common ancestor `c` only if `!common.some((o) => o !== c && ancestors(graph, o).has(c))`.
- Sort the result.

%% solution
```js
function ancestors(graph, id) {
  const seen = new Set();
  const stack = [id];
  while (stack.length > 0) {
    const next = stack.pop();
    if (seen.has(next)) continue;
    if (!Object.prototype.hasOwnProperty.call(graph, next)) throw new Error('unknown commit: ' + next);
    seen.add(next);
    for (const parent of graph[next].parents ?? []) stack.push(parent);
  }
  return seen;
}

export function isAncestor(graph, a, b) {
  ancestors(graph, a);
  return ancestors(graph, b).has(a);
}

export function mergeBases(graph, a, b) {
  const fromA = ancestors(graph, a);
  const fromB = ancestors(graph, b);
  const common = [...fromA].filter((id) => fromB.has(id));
  return common
    .filter((c) => !common.some((other) => other !== c && ancestors(graph, other).has(c)))
    .sort();
}
```

%% exercise gx-gc | Garbage collection | 3 | js | js | collectGarbage | 28
`collectGarbage({ objects, refs, keep = [] })` finds what Git's `gc` could delete.

- `objects` maps an object hash to `{ links }`, the hashes it points to (a commit links to its tree and parents, a tree to its blobs and subtrees, a blob to nothing).
- `refs` maps label names (branches, tags) to the hash they point to; `keep` lists extra root hashes (think reflog entries).
- **Reachable** means reachable from any ref target or `keep` hash by following `links`.
- Return `{ reachable, unreachable }`, both **sorted** arrays of hashes (`unreachable` = every object that is not reachable).
- A ref (or `keep` hash) pointing at a hash that is not in `objects` throws `Error('dangling ref: ' + nameOrHash)` (use the ref name for refs, the hash for `keep`). A link to a missing object throws `Error('missing object: ' + hash)`.

```js
collectGarbage({ objects: { c1: { links: [] }, c2: { links: ['c1'] } }, refs: { main: 'c1' } });
// { reachable: ['c1'], unreachable: ['c2'] }
```

%% worked
**A similar problem, solved: `markAndSweep(heap, roots)`** — the same idea a garbage-collected language uses: **mark** what is reachable, **sweep** the rest.

```js
function markAndSweep(heap, roots) {
  const marked = new Set();
  const stack = [...roots];
  while (stack.length > 0) {
    const id = stack.pop();
    if (marked.has(id)) continue;                              // ① a visited set makes shared objects and cycles safe
    marked.add(id);
    for (const next of heap[id].links) stack.push(next);       // ② everything an object points to is also alive
  }
  const garbage = Object.keys(heap).filter((id) => !marked.has(id));   // ③ sweep: whatever was never marked
  return { live: [...marked].sort(), garbage: garbage.sort() };
}
```

Here the **roots are labels** (branches, tags, and the reflog entries you chose to keep), which is exactly why an old commit disappears only when **no label and no reflog entry** can reach it.

%% explain
- **Roots** = ref targets + `keep`.
- **Mark** with a stack and a visited set.
- **Validate** refs and links as you go.

%% nudge
- Which objects does a branch keep alive besides the commit it points to?
- What should happen to a commit that only the reflog remembers?

%% starter
```js
export function collectGarbage({ objects, refs, keep = [] }) {
  return { reachable: [], unreachable: Object.keys(objects).sort() };
}
```

%% tests
```js
describe('collectGarbage', () => {
  const objects = () => ({
    c1: { links: ['t1'] }, t1: { links: ['b1'] }, b1: { links: [] },
    c2: { links: ['t2', 'c1'] }, t2: { links: ['b1', 'b2'] }, b2: { links: [] },
    old: { links: ['t1', 'c1'] },
  });
  it('keeps everything a ref can reach and reports the rest', () => {
    const result = collectGarbage({ objects: objects(), refs: { main: 'c2' } });
    expect(result.reachable).toEqual(['b1', 'b2', 'c1', 'c2', 't1', 't2']);
    expect(result.unreachable).toEqual(['old']);
  });
  it('uses several refs as roots', () => {
    const result = collectGarbage({ objects: objects(), refs: { main: 'c1', feature: 'old' } });
    expect(result.unreachable).toEqual(['b2', 'c2', 't2']);
  });
  it('treats keep entries (the reflog) as roots', () => {
    const result = collectGarbage({ objects: objects(), refs: { main: 'c1' }, keep: ['c2'] });
    expect(result.unreachable).toEqual(['old']);
  });
  it('returns everything as unreachable without roots', () => {
    const result = collectGarbage({ objects: objects(), refs: {} });
    expect(result.reachable).toEqual([]);
    expect(result.unreachable).toHaveLength(7);
  });
  it('handles shared objects and cycles', () => {
    const cyc = { a: { links: ['b'] }, b: { links: ['a', 'c'] }, c: { links: [] }, d: { links: ['c'] } };
    const result = collectGarbage({ objects: cyc, refs: { x: 'a' } });
    expect(result.reachable).toEqual(['a', 'b', 'c']);
    expect(result.unreachable).toEqual(['d']);
  });
  it('rejects dangling refs and missing objects', () => {
    expect(() => collectGarbage({ objects: objects(), refs: { main: 'nope' } })).toThrow('dangling ref: main');
    expect(() => collectGarbage({ objects: objects(), refs: {}, keep: ['zzz'] })).toThrow('dangling ref: zzz');
    expect(() => collectGarbage({ objects: { a: { links: ['gone'] } }, refs: { x: 'a' } })).toThrow('missing object: gone');
  });
  it('does not change its input', () => {
    const o = objects();
    const copy = JSON.parse(JSON.stringify(o));
    collectGarbage({ objects: o, refs: { main: 'c2' } });
    expect(o).toEqual(copy);
  });
});
```

%% hints
- Roots: `Object.entries(refs).map(([name, hash]) => ({ name, hash }))` plus `keep.map((hash) => ({ name: hash, hash }))`.
- Throw `dangling ref` for a root not in `objects`; inside the traversal throw `missing object` for a link not in `objects`.
- `unreachable = Object.keys(objects).filter((h) => !reachable.has(h)).sort()`

%% solution
```js
export function collectGarbage({ objects, refs, keep = [] }) {
  const has = (hash) => Object.prototype.hasOwnProperty.call(objects, hash);
  const roots = [
    ...Object.entries(refs).map(([name, hash]) => ({ name, hash })),
    ...keep.map((hash) => ({ name: hash, hash })),
  ];
  const reachable = new Set();
  const stack = [];
  for (const root of roots) {
    if (!has(root.hash)) throw new Error('dangling ref: ' + root.name);
    stack.push(root.hash);
  }
  while (stack.length > 0) {
    const hash = stack.pop();
    if (reachable.has(hash)) continue;
    reachable.add(hash);
    for (const link of objects[hash].links ?? []) {
      if (!has(link)) throw new Error('missing object: ' + link);
      stack.push(link);
    }
  }
  return {
    reachable: [...reachable].sort(),
    unreachable: Object.keys(objects).filter((h) => !reachable.has(h)).sort(),
  };
}
```

%% exercise gx-check-bases | Tests for merge bases | 4 | js | js | checkMergeBases | 40
`mergeBases(graph, a, b)` takes a history `{ [id]: { parents } }` and returns the **sorted** list of best common ancestors of `a` and `b`: common ancestors (a commit is its own ancestor) that are **not an ancestor of another common ancestor**; `[]` when unrelated; every parent of a merge commit counts. You are given `checkMergeBases(mergeBases)`. Write a check that passes for a correct implementation and **fails** for one that: **returns the first common ancestor it finds instead of the nearest**, **returns every common ancestor**, **only follows the first parent of a merge commit**, **does not count a commit as its own ancestor**, **returns just one base for a criss-cross merge**.

```js
const g = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] }, D: { parents: ['B'] } };
expect(mergeBases(g, 'C', 'D')).toEqual(['B']);
```

%% worked
**A similar problem, solved: `checkLowestCommonAncestor(lca)`** — design **one graph per trap**, and make the correct answer **differ** from what each wrong approach would return.

```js
export function checkLowestCommonAncestor(lca) {                  // lca(parentOf, a, b) on a TREE
  const parentOf = { root: null, x: 'root', y: 'x', z: 'x', w: 'y' };
  expect(lca(parentOf, 'y', 'z')).toBe('x');                      // ① a plain fork
  expect(lca(parentOf, 'w', 'z')).toBe('x');                      // ② "any common ancestor" would also allow 'root'
  expect(lca(parentOf, 'y', 'w')).toBe('y');                      // ③ one node is the ancestor of the other
}
```

For Git, each wrong implementation needs a graph where it **gives a different answer**: a chain that makes "any common ancestor" return too many, a **merge commit whose second parent** carries the common history, a case where **a is an ancestor of b**, and a **criss-cross** with two true bases.

%% explain
- **Chain + fork**: the nearest base is not the only common ancestor.
- **Merge commit**: the shared history is only through the second parent.
- **One side is the ancestor of the other.**
- **Criss-cross**: two bases.

%% nudge
- Which graph separates "nearest" from "any common ancestor"?
- Which graph breaks an implementation that only follows `parents[0]`?

%% starter
```js
export function checkMergeBases(mergeBases) {
  const g = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] }, D: { parents: ['B'] } };
  expect(mergeBases(g, 'C', 'D')).toEqual(['B']);
  // your assertions: nearest, merge commits, ancestor cases, criss-cross, unrelated
}
```

%% tests
```js
const make = (f = {}) => (graph, a, b) => {
  const ancestors = (id) => {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const next = stack.pop();
      if (seen.has(next)) continue;
      if (!Object.prototype.hasOwnProperty.call(graph, next)) throw new Error('unknown commit: ' + next);
      seen.add(next);
      const parents = graph[next].parents ?? [];
      for (const p of f.firstParentOnly ? parents.slice(0, 1) : parents) stack.push(p);
    }
    if (f.notSelf) seen.delete(id);
    return seen;
  };
  const fromA = ancestors(a);
  const fromB = ancestors(b);
  const common = [...fromA].filter((x) => fromB.has(x));
  if (f.everyCommon) return common.sort();
  const best = common.filter((c) => !common.some((o) => o !== c && ancestors(o).has(c))).sort();
  if (f.firstFound) return best.slice(0, 1);
  if (f.oneOnly) return best.slice(0, 1);
  return best;
};

const correct = make();
const mutants = {
  'returns the first common ancestor it finds instead of the nearest': (graph, a, b) => {
    const seenB = new Set();
    const stack = [b];
    while (stack.length) { const n = stack.pop(); if (seenB.has(n)) continue; seenB.add(n); for (const p of graph[n].parents ?? []) stack.push(p); }
    const order = [];
    const queue = [a];
    const seen = new Set();
    while (queue.length) { const n = queue.shift(); if (seen.has(n)) continue; seen.add(n); order.push(n); for (const p of graph[n].parents ?? []) queue.push(p); }
    const farthest = [...order].reverse().find((x) => seenB.has(x));
    return farthest ? [farthest] : [];
  },
  'returns every common ancestor': make({ everyCommon: true }),
  'only follows the first parent of a merge commit': make({ firstParentOnly: true }),
  'does not count a commit as its own ancestor': make({ notSelf: true }),
  'returns just one base for a criss-cross merge': make({ oneOnly: true }),
};

describe('your checkMergeBases', () => {
  it('passes on a correct implementation', () => {
    checkMergeBases(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an implementation that ${name}`, () => {
      let caught = false;
      try { checkMergeBases(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Chain graph: `A ← B ← C`, `B ← D`, `C ← E`. `mergeBases(E, D)` is `['B']` only, not `['A', 'B']`.
- Merge graph: `A`, `B(A)`, `C(A)`, `M(B, C)`, `X(M)`, `Y(C)`: bases of `X`, `Y` is `['C']` and needs the second parent of `M`.
- Ancestor: `mergeBases(B, C)` where `C` descends from `B` is `['B']` (self counts).
- Criss-cross: `M1(A, B)` and `M2(B, A)` give `['A', 'B']`.

%% solution
```js
export function checkMergeBases(mergeBases) {
  const chain = { A: {}, B: { parents: ['A'] }, C: { parents: ['B'] }, D: { parents: ['B'] }, E: { parents: ['C'] } };
  expect(mergeBases(chain, 'C', 'D')).toEqual(['B']);
  expect(mergeBases(chain, 'E', 'D')).toEqual(['B']);

  expect(mergeBases(chain, 'B', 'C')).toEqual(['B']);
  expect(mergeBases(chain, 'C', 'B')).toEqual(['B']);
  expect(mergeBases(chain, 'C', 'C')).toEqual(['C']);

  const merged = {
    A: {}, B: { parents: ['A'] }, C: { parents: ['A'] },
    M: { parents: ['B', 'C'] }, X: { parents: ['M'] }, Y: { parents: ['C'] },
  };
  expect(mergeBases(merged, 'X', 'Y')).toEqual(['C']);

  const crisscross = {
    R: {}, A: { parents: ['R'] }, B: { parents: ['R'] },
    M1: { parents: ['A', 'B'] }, M2: { parents: ['B', 'A'] },
  };
  expect(mergeBases(crisscross, 'M1', 'M2')).toEqual(['A', 'B']);

  expect(mergeBases({ P: {}, Q: {} }, 'P', 'Q')).toEqual([]);
}
```
