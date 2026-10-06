---
id: git-branching-merging
track: git
title: Branches, merging and rebasing
summary: Fast-forward, merge commits, squash and rebase compared, how a three-way merge decides between base, ours and theirs, what a conflict really is, and the rule that keeps rebase safe.
---

## The idea in one sentence

Integrating work means **combining two lines of history**: Git does it by finding their **merge base**, looking at what **each side changed since then**, and **combining the changes**, asking a human only when both sides changed the **same place differently**.

> **Analogy** Two editors revise copies of the same document. To combine their work you need the **original** (the merge base): where only one editor changed a paragraph, take that edit; where both made the identical edit, keep one; where both rewrote the same paragraph differently, someone has to decide.

*(Everything here maps to `git merge`, `git rebase`, `git merge --squash`, `git pull --rebase` and `git cherry-pick`. You will build the merge logic itself.)*

## Ways to integrate

![Integration kinds](fig:gt-merge-kinds "Fast-forward, merge commit, squash.")

| Strategy | Result | Keeps branch history? | History shape | Watch out |
| --- | --- | --- | --- | --- |
| **Fast-forward** | the label just moves | yes (it is the same commits) | linear | only possible if the target has **not moved** |
| **Merge commit** (`--no-ff`) | a new commit with **two parents** | yes | has branches | noisy graph if overused |
| **Squash** | all the branch's changes as **one new commit** | no | linear | loses individual commits and authorship detail |
| **Rebase** then fast-forward | the branch's commits **replayed** on the target | as copies | linear | **rewrites** commits |

## Rebase and the golden rule

![Rebase](fig:gt-rebase "Rebase replays commits as new commits on a new base.")

`git rebase main` takes your commits, **replays** them on top of `main`'s latest commit and moves your branch to the result. The replayed commits are **new commits** (same change, new parent, new hash). Therefore:

- It is **safe on a branch only you use**: nobody holds the old commits.
- **Never rebase commits others already pulled**: their copies and yours now disagree, and they have to untangle it.
- After rebasing a branch you had pushed you must **force-push**, and `--force-with-lease` is the polite version: it **refuses if someone else pushed** since you last fetched.
- Replay **skips a commit whose change is already present** on the new base (for example a cherry-picked fix).

## How a three-way merge decides

![Conflict](fig:gt-conflict "Base, ours, theirs: who changed it?")

Git lines up the **base**, **ours** and **theirs**, and finds the lines that **all three still share** (the **anchors**). The text between two anchors is a **region**. For each region:

1. If **ours is unchanged** from the base, take **theirs**.
2. Else if **theirs is unchanged**, take **ours**.
3. Else if **both made the same change**, take it once.
4. Otherwise it is a **conflict**: write both versions between **markers** and let a person decide.

Because regions are bounded by shared lines, edits to **adjacent lines** fall in the **same region** and conflict even though a human would call them independent. A **delete vs an edit** of the same line is also a conflict.

```js try predict
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pick = (base, ours, theirs) =>
  same(ours, base) ? 'theirs' : same(theirs, base) || same(ours, theirs) ? 'ours' : 'CONFLICT';

console.log(pick(['b'], ['b'], ['B']), pick(['b'], ['B'], ['b']), pick(['b'], ['X'], ['X']), pick(['b'], ['X'], ['Y']));
```

```stepper How a conflict happens
code:
  base:    a b c d e
  ours:    a B c d e      (changed b)
  theirs:  a X c d e      (changed b differently)
  merge →  a  <<<<<<< ours / B / ======= / X / >>>>>>> theirs  c d e
---
line: 1
say: **Base** is the common ancestor's version. Both branches started from it.
phase: base
---
line: 2
say: **Ours** changed `b` to `B`. Lines `a`, `c`, `d`, `e` still match the base.
phase: our change
---
line: 3
say: **Theirs** changed the **same line** to `X`. Lines `a`, `c`, `d`, `e` still match too.
phase: their change
---
line: 4
say: The lines all three agree on are the **anchors**. The region between `a` and `c` was changed on **both sides, differently**: that is a conflict. Everything else merges silently.
phase: conflict
```

## Resolving well

- Read the **three** versions (`git checkout --conflict=diff3`) not just the two: seeing the base shows the *intent*.
- Run the **tests** after resolving; a clean textual merge can still be a **semantic** conflict (two compatible edits that break together).
- **`git rerere`** remembers how you resolved a conflict and reapplies it, useful while rebasing the same branch repeatedly.
- To undo a bad merge on a shared branch use **`git revert -m 1 <merge>`** (a new commit) instead of rewriting history.

## Quick check

```check
Q: When is a fast-forward merge possible?
A) Always
B) When the target branch has no commits that the other branch lacks *
C) Only with --squash
D) Only for tags
Why: The target tip is an ancestor of the branch tip, so the label can simply move.
---
Q: Why must you not rebase a branch other people have pulled?
A) Rebase deletes the remote
B) It replaces commits with new ones, so everyone else's copies now disagree with yours *
C) Rebase needs a clean working tree
D) It is slower
Why: Rewritten commits have new hashes; others still have the old ones.
---
Q: Base line is "b". Ours changed it to "B". Theirs left it unchanged. What does the merge produce?
A) A conflict
B) "B" *
C) "b"
D) Both lines
Why: Only one side changed it, so that change wins.
---
Q: Why do edits to neighbouring lines often conflict?
A) Git is buggy
B) No shared line sits between them, so they fall in one region changed differently on both sides *
C) Conflicts depend on file size
D) Git cannot read whitespace
Why: Regions are bounded by lines both sides still share.
```

## Recap

- **Fast-forward** (label moves), **merge commit** (two parents), **squash** (one new commit), **rebase** (replay as new commits).
- **Rebase rewrites**: fine on private branches, never on shared history; push with **`--force-with-lease`**.
- A **three-way merge** uses the **merge base**: take the side that changed; equal changes once; different changes conflict.
- **Anchors** (lines all three share) split the text into regions; neighbouring edits share a region.
- Resolve with the base in view, **run the tests**, and **revert** rather than rewrite on shared branches.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: can we fast-forward? | Checking whether a commit appears in a list |
| A three-way merge | Longest common subsequence, anchors, region comparison |
| Replay a rebase | Walking parent chains, finding the base, skipping duplicates |
| Choose an integration strategy | An ordered list of rules |
| Tests for a three-way merge | Inputs that expose each wrong rule |

%% exercise gx-guided-ff | Guided: can we fast-forward? | 1 | js | js | canFastForward | 8 | guided
Implement `canFastForward(targetLog, branchLog)`. Each log is an array of commit ids, **newest first**. A fast-forward is possible when the **target's tip** (its first entry) appears **somewhere in the branch's log**, meaning the branch already contains everything on the target. A target with **no commits** can always be fast-forwarded to; a branch with no commits cannot be fast-forwarded to unless the target is empty too.

```js
canFastForward(['b', 'a'], ['d', 'c', 'b', 'a']); // true
canFastForward(['x', 'b', 'a'], ['d', 'c', 'b', 'a']); // false
```

%% worked
**A similar problem, solved: `isUpToDate(localLog, remoteLog)`** — "is my tip contained in their history?"

```js
function isUpToDate(localLog, remoteLog) {
  if (localLog.length === 0) return true;              // ① nothing local: nothing to lose
  return remoteLog.includes(localLog[0]);              // ② my newest commit must already be in theirs
}
```

Only the **tip** needs checking: if the tip is in the other history, so is everything before it.

%% explain
- **Empty target** is trivially fine.
- Otherwise **`includes`** the target tip in the branch log.

%% nudge
- Why is checking only the first entry enough?

%% starter
```js
export function canFastForward(targetLog, branchLog) {
  return false;
}
```

%% tests
```js
describe('canFastForward', () => {
  it('is true when the branch contains the target tip', () => {
    expect(canFastForward(['b', 'a'], ['d', 'c', 'b', 'a'])).toBe(true);
    expect(canFastForward(['a'], ['a'])).toBe(true);
  });
  it('is false when the target has commits the branch lacks', () => {
    expect(canFastForward(['x', 'b', 'a'], ['d', 'c', 'b', 'a'])).toBe(false);
  });
  it('is false for unrelated histories', () => {
    expect(canFastForward(['z'], ['d', 'c'])).toBe(false);
  });
  it('handles empty logs', () => {
    expect(canFastForward([], ['a'])).toBe(true);
    expect(canFastForward([], [])).toBe(true);
    expect(canFastForward(['a'], [])).toBe(false);
  });
});
```

%% hints
- `if (targetLog.length === 0) return true;`
- `return branchLog.includes(targetLog[0]);`

%% solution
```js
export function canFastForward(targetLog, branchLog) {
  if (targetLog.length === 0) return true;
  return branchLog.includes(targetLog[0]);
}
```

%% exercise gx-merge3 | A three-way merge | 4 | js | js | merge3 | 50
`merge3(base, ours, theirs)` merges three arrays of lines and returns `{ lines, conflicts }`.

1. Find the lines of `base` that are kept, in order, by **both** sides: compute a **longest common subsequence** of `base` with `ours` and of `base` with `theirs`; a base line that is in **both** matchings is an **anchor**.
2. The anchors split the three inputs into **regions** (the lines before the first anchor, between anchors, and after the last). For each region take its `base` lines, `ours` lines and `theirs` lines and decide: if `ours` equals `base` → take `theirs`; else if `theirs` equals `base` → take `ours`; else if `ours` equals `theirs` → take `ours`; else it is a **conflict**.
3. A conflict writes `'<<<<<<< ours'`, the ours lines, `'======='`, the theirs lines, `'>>>>>>> theirs'` and adds 1 to `conflicts`.
4. Anchor lines are written once, between the regions. The inputs are not changed.

(The tests use files whose lines are all different, so which LCS you pick does not matter.)

```js
merge3(['a', 'b', 'c'], ['a', 'B', 'c'], ['a', 'b', 'c']); // { lines: ['a', 'B', 'c'], conflicts: 0 }
```

%% worked
**A similar problem, solved: `lcsPairs(a, b)`** — a longest-common-subsequence table and a walk that reports which indices match.

```js
function lcsPairs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);   // ① length of the LCS of the TAILS
    }
  }
  const pairs = new Map();                                    // index in a -> index in b
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { pairs.set(i, j); i++; j++; }        // ② equal lines are a match, move both
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;              // ③ otherwise skip the line that costs less
    else j++;
  }
  return pairs;
}
```

Run it for `(base, ours)` and `(base, theirs)`; the base indices present in **both** maps are the anchors. Walk them in order, keeping a **start index per input**, and compare the slices **between** anchors.

%% explain
- **`lcsPairs`** for each side.
- **Anchors** = base indices in both maps.
- **Region rule** applied between anchors; markers on conflict.

%% nudge
- Why do the three start indices advance together after every anchor?
- What happens at the very end of the file?

%% starter
```js
export function merge3(base, ours, theirs) {
  return { lines: [...ours], conflicts: 0 };
}
```

%% tests
```js
describe('merge3', () => {
  const base = ['a', 'b', 'c', 'd', 'e'];
  const M = (o, t, b = base) => merge3(b, o, t);

  it('merges changes in different places', () => {
    expect(M(['a', 'B', 'c', 'd', 'e'], ['a', 'b', 'c', 'D', 'e'])).toEqual({ lines: ['a', 'B', 'c', 'D', 'e'], conflicts: 0 });
  });
  it('takes the side that changed when the other did not', () => {
    expect(M(['a', 'B', 'c', 'd', 'e'], base).lines).toEqual(['a', 'B', 'c', 'd', 'e']);
    expect(M(base, ['a', 'b', 'c', 'D', 'e']).lines).toEqual(['a', 'b', 'c', 'D', 'e']);
  });
  it('takes an identical change once', () => {
    expect(M(['a', 'X', 'c', 'd', 'e'], ['a', 'X', 'c', 'd', 'e'])).toEqual({ lines: ['a', 'X', 'c', 'd', 'e'], conflicts: 0 });
  });
  it('writes conflict markers for different changes to the same line', () => {
    expect(M(['a', 'B', 'c', 'd', 'e'], ['a', 'X', 'c', 'd', 'e'])).toEqual({
      lines: ['a', '<<<<<<< ours', 'B', '=======', 'X', '>>>>>>> theirs', 'c', 'd', 'e'],
      conflicts: 1,
    });
  });
  it('treats edits to adjacent lines as one conflicting region', () => {
    const r = M(['a', 'B', 'c', 'd', 'e'], ['a', 'b', 'C', 'd', 'e']);
    expect(r.conflicts).toBe(1);
    expect(r.lines).toEqual(['a', '<<<<<<< ours', 'B', 'c', '=======', 'b', 'C', '>>>>>>> theirs', 'd', 'e']);
  });
  it('merges insertions in different places, including both ends', () => {
    expect(M(['a', 'x', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e', 'y'])).toEqual({
      lines: ['a', 'x', 'b', 'c', 'd', 'e', 'y'],
      conflicts: 0,
    });
    expect(M(['top', ...base], [...base]).lines[0]).toBe('top');
  });
  it('conflicts when both insert different lines at the same place', () => {
    const r = M(['a', 'x', 'b', 'c', 'd', 'e'], ['a', 'y', 'b', 'c', 'd', 'e']);
    expect(r.conflicts).toBe(1);
    expect(r.lines).toEqual(['a', '<<<<<<< ours', 'x', '=======', 'y', '>>>>>>> theirs', 'b', 'c', 'd', 'e']);
  });
  it('lets a deletion win over an unchanged side, and conflicts with an edit', () => {
    expect(M(['a', 'b', 'd', 'e'], base).lines).toEqual(['a', 'b', 'd', 'e']);
    expect(M(['a', 'b', 'd', 'e'], ['a', 'b', 'd', 'e']).lines).toEqual(['a', 'b', 'd', 'e']);
    const r = M(['a', 'b', 'd', 'e'], ['a', 'b', 'C', 'd', 'e']);
    expect(r.conflicts).toBe(1);
    expect(r.lines).toEqual(['a', 'b', '<<<<<<< ours', '=======', 'C', '>>>>>>> theirs', 'd', 'e']);
  });
  it('counts several conflicts', () => {
    const r = merge3(
      ['a', 'b', 'c', 'd', 'e'],
      ['a', 'B1', 'c', 'D1', 'e'],
      ['a', 'B2', 'c', 'D2', 'e'],
    );
    expect(r.conflicts).toBe(2);
    expect(r.lines.filter((l) => l === '<<<<<<< ours')).toHaveLength(2);
  });
  it('handles an empty base', () => {
    expect(merge3([], ['x'], []).lines).toEqual(['x']);
    expect(merge3([], ['x'], ['x']).lines).toEqual(['x']);
    expect(merge3([], ['x'], ['y']).conflicts).toBe(1);
  });
  it('returns the base for three identical inputs and does not mutate', () => {
    const o = ['a', 'B', 'c', 'd', 'e'];
    const t = ['a', 'b', 'c', 'D', 'e'];
    const copies = [[...base], [...o], [...t]];
    merge3(base, o, t);
    expect([base, o, t]).toEqual(copies);
    expect(merge3(base, base, base)).toEqual({ lines: base, conflicts: 0 });
  });
});
```

%% hints
- `lcsPairs(a, b)` returns a `Map` from index in `a` to index in `b` (see the worked example).
- `anchors = [...mo.keys()].filter((i) => mt.has(i))` is already in increasing order.
- Keep `pb`, `po`, `pt` (region starts). At each anchor `i`: `flush(i, mo.get(i), mt.get(i))`, push `base[i]`, then set `pb = i + 1`, `po = mo.get(i) + 1`, `pt = mt.get(i) + 1`. After the loop flush to the ends.
- Compare slices with a small `same(x, y)` helper.

%% solution
```js
function lcsPairs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = new Map();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pairs.set(i, j);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

export function merge3(base, ours, theirs) {
  const mo = lcsPairs(base, ours);
  const mt = lcsPairs(base, theirs);
  const anchors = [...mo.keys()].filter((i) => mt.has(i));
  const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);

  const lines = [];
  let conflicts = 0;
  let pb = 0;
  let po = 0;
  let pt = 0;

  const flush = (eb, eo, et) => {
    const b = base.slice(pb, eb);
    const o = ours.slice(po, eo);
    const t = theirs.slice(pt, et);
    if (same(o, b)) lines.push(...t);
    else if (same(t, b) || same(o, t)) lines.push(...o);
    else {
      conflicts++;
      lines.push('<<<<<<< ours', ...o, '=======', ...t, '>>>>>>> theirs');
    }
  };

  for (const i of anchors) {
    flush(i, mo.get(i), mt.get(i));
    lines.push(base[i]);
    pb = i + 1;
    po = mo.get(i) + 1;
    pt = mt.get(i) + 1;
  }
  flush(base.length, ours.length, theirs.length);
  return { lines, conflicts };
}
```

%% exercise gx-rebase | Replay a rebase | 4 | js | js | rebase | 40
`rebase({ commits, branch, onto })` plans a rebase. `commits` maps an id to `{ parent, patch }` (`parent` is the parent id or `null`; `patch` is a string naming the change). Following `parent` links gives each commit's **chain** down to the root.

- The **base** is the **nearest commit that is in both chains** (start from `branch` and go down). If the chains share none, throw `Error('no common ancestor')`.
- If `base === onto` (the branch already sits on top of `onto`), nothing needs replaying: return `{ tip: branch, created: [], skipped: [] }`. If `base === branch` (the branch is behind `onto`), return `{ tip: onto, created: [], skipped: [] }`.
- Otherwise the commits to replay are the chain from just above `base` up to `branch`, **oldest first**. Commits on the `onto` side since the base are those between `base` and `onto`.
- A replayed commit whose `patch` equals the `patch` of a commit on the **`onto` side** is **skipped** (that change is already there); its id goes to `skipped`.
- Every other commit is recreated: id `from + "'"`, with its `parent` being the previous new commit (the first one's parent is `onto`). Return `created` as `[{ id, from, parent }]` in order, and `tip` as the id of the last created commit (or `onto` if every commit was skipped).
- An unknown commit id throws `Error('unknown commit: ' + id)`. Do not change `commits`.

```js
// main: A <- B <- C      feature: B <- D <- E
rebase({ commits, branch: 'E', onto: 'C' });
// { tip: "E'", created: [{ id: "D'", from: 'D', parent: 'C' }, { id: "E'", from: 'E', parent: "D'" }], skipped: [] }
```

%% worked
**A similar problem, solved: `replayOnto(commits, branch, newBase)`** — find the fork point by walking one chain into a set, then collect what lies above it.

```js
function chainOf(commits, id) {
  const out = [];
  for (let cur = id; cur !== null; cur = commits[cur].parent) {
    if (!(cur in commits)) throw new Error('unknown commit: ' + cur);   // ① validate while walking
    out.push(cur);                                                       // ② newest first, root last
  }
  return out;
}

function replayOnto(commits, branch, newBase) {
  const other = new Set(chainOf(commits, newBase));
  const mine = chainOf(commits, branch);
  const base = mine.find((id) => other.has(id));                         // ③ the nearest shared commit, from the branch side
  const toReplay = mine.slice(0, mine.indexOf(base)).reverse();           // ④ everything ABOVE the base, oldest first
  return { base, toReplay };
}
```

Then recreate each commit with the **previous new id as parent**; remember to skip commits whose **patch already exists** on the other side (collect those patches from `chainOf(onto)` above the base).

%% explain
- **`chainOf`** with validation.
- **Base** from one chain against a set of the other.
- **Skip** by patch, **recreate** with primed ids.

%% nudge
- Which commits count as "already on the onto side"?
- What is the parent of the first replayed commit?

%% starter
```js
export function rebase({ commits, branch, onto }) {
  return { tip: branch, created: [], skipped: [] };
}
```

%% tests
```js
describe('rebase', () => {
  const commits = () => ({
    A: { parent: null, patch: 'init' },
    B: { parent: 'A', patch: 'p-b' },
    C: { parent: 'B', patch: 'p-c' },
    D: { parent: 'B', patch: 'p-d' },
    E: { parent: 'D', patch: 'p-e' },
  });

  it('replays the branch commits on top of onto, oldest first', () => {
    expect(rebase({ commits: commits(), branch: 'E', onto: 'C' })).toEqual({
      tip: "E'",
      created: [{ id: "D'", from: 'D', parent: 'C' }, { id: "E'", from: 'E', parent: "D'" }],
      skipped: [],
    });
  });
  it('replays a single commit', () => {
    expect(rebase({ commits: commits(), branch: 'D', onto: 'C' })).toEqual({
      tip: "D'",
      created: [{ id: "D'", from: 'D', parent: 'C' }],
      skipped: [],
    });
  });
  it('does nothing when the branch is already on top of onto', () => {
    expect(rebase({ commits: commits(), branch: 'E', onto: 'B' })).toEqual({ tip: 'E', created: [], skipped: [] });
    expect(rebase({ commits: commits(), branch: 'E', onto: 'D' })).toEqual({ tip: 'E', created: [], skipped: [] });
  });
  it('moves the branch to onto when the branch is behind it', () => {
    expect(rebase({ commits: commits(), branch: 'B', onto: 'C' })).toEqual({ tip: 'C', created: [], skipped: [] });
  });
  it('skips commits whose change is already on the onto side', () => {
    const c = commits();
    c.C.patch = 'p-d';
    expect(rebase({ commits: c, branch: 'E', onto: 'C' })).toEqual({
      tip: "E'",
      created: [{ id: "E'", from: 'E', parent: 'C' }],
      skipped: ['D'],
    });
  });
  it('returns onto as the tip when every commit is skipped', () => {
    const c = commits();
    c.C.patch = 'p-d';
    c.D2 = { parent: 'C', patch: 'p-e' };
    c.C2 = { parent: 'C', patch: 'p-e' };
    const r = rebase({ commits: c, branch: 'E', onto: 'C2' });
    expect(r.created).toEqual([]);
    expect(r.tip).toBe('C2');
    expect(r.skipped).toEqual(['D', 'E']);
  });
  it('does not skip a patch that only exists above the base on the branch itself', () => {
    const c = commits();
    c.E.patch = 'p-d';
    const r = rebase({ commits: c, branch: 'E', onto: 'C' });
    expect(r.skipped).toEqual([]);
    expect(r.created).toHaveLength(2);
  });
  it('rejects unrelated histories and unknown commits', () => {
    const c = { ...commits(), Z: { parent: null, patch: 'z' } };
    expect(() => rebase({ commits: c, branch: 'Z', onto: 'C' })).toThrow('no common ancestor');
    expect(() => rebase({ commits: commits(), branch: 'nope', onto: 'C' })).toThrow('unknown commit: nope');
    expect(() => rebase({ commits: commits(), branch: 'E', onto: 'nope' })).toThrow('unknown commit: nope');
  });
  it('does not change the commits map', () => {
    const c = commits();
    const copy = JSON.parse(JSON.stringify(c));
    rebase({ commits: c, branch: 'E', onto: 'C' });
    expect(c).toEqual(copy);
  });
});
```

%% hints
- `chainOf(id)` returns ids newest-first (throw for unknown ids as you walk).
- `base = chainOf(branch).find((id) => ontoSet.has(id))`; none → `no common ancestor`.
- `branchSide = chainOf(branch).slice(0, indexOf(base)).reverse()`; `ontoSide = chainOf(onto).slice(0, indexOf(base in onto chain))`.
- Keep a `Set` of the `patch` values on the onto side for skipping.

%% solution
```js
export function rebase({ commits, branch, onto }) {
  const chainOf = (id) => {
    const out = [];
    for (let cur = id; cur !== null; cur = commits[cur].parent) {
      if (!Object.prototype.hasOwnProperty.call(commits, cur)) throw new Error('unknown commit: ' + cur);
      out.push(cur);
    }
    return out;
  };

  const mine = chainOf(branch);
  const theirs = chainOf(onto);
  const theirSet = new Set(theirs);
  const base = mine.find((id) => theirSet.has(id));
  if (base === undefined) throw new Error('no common ancestor');

  if (base === onto) return { tip: branch, created: [], skipped: [] };
  if (base === branch) return { tip: onto, created: [], skipped: [] };

  const toReplay = mine.slice(0, mine.indexOf(base)).reverse();
  const ontoPatches = new Set(theirs.slice(0, theirs.indexOf(base)).map((id) => commits[id].patch));

  const created = [];
  const skipped = [];
  let tip = onto;
  for (const id of toReplay) {
    if (ontoPatches.has(commits[id].patch)) {
      skipped.push(id);
      continue;
    }
    const newId = id + "'";
    created.push({ id: newId, from: id, parent: tip });
    tip = newId;
  }
  return { tip, created, skipped };
}
```

%% exercise gx-strategy | Choose how to integrate | 2 | js | js | chooseIntegration | 14
`chooseIntegration({ commits, messy, linearRequired, shared })` picks `'merge'`, `'squash'` or `'rebase'` for a pull request. Apply these rules **in order**:

1. `shared` (other people have based work on this branch): `'merge'` (never rewrite shared history).
2. `commits === 1`: `'rebase'` (one commit replays cleanly, no extra merge commit).
3. `messy` (wip, fixup and "oops" commits): `'squash'`.
4. `linearRequired` (the repository wants a straight history): `'rebase'`.
5. Otherwise `'merge'`.

```js
chooseIntegration({ commits: 5, messy: true });                        // 'squash'
chooseIntegration({ commits: 5, messy: false, linearRequired: true }); // 'rebase'
```

%% worked
**A similar problem, solved: `chooseDeploy({ risky, urgent, users })`** — an **ordered rule list** where an earlier rule can override a later one.

```js
function chooseDeploy({ risky, urgent, users }) {
  if (urgent && !risky) return 'direct';          // ① the most specific shortcut first
  if (risky) return 'canary';                      // ② safety next
  if (users > 1000) return 'rolling';
  return 'direct';                                 // ③ the default
}
```

Rule order **is** the policy. Check that `shared` comes first: it must override everything else, including a messy branch.

%% explain
- **Five rules, in order**; first match returns.

%% nudge
- Which rule must win when a messy branch is also shared?

%% starter
```js
export function chooseIntegration(pr) {
  return 'merge';
}
```

%% tests
```js
describe('chooseIntegration', () => {
  it('never rewrites a shared branch', () => {
    expect(chooseIntegration({ commits: 5, messy: true, linearRequired: true, shared: true })).toBe('merge');
    expect(chooseIntegration({ commits: 1, shared: true })).toBe('merge');
  });
  it('rebases a single commit', () => {
    expect(chooseIntegration({ commits: 1, messy: true })).toBe('rebase');
    expect(chooseIntegration({ commits: 1 })).toBe('rebase');
  });
  it('squashes a messy branch', () => {
    expect(chooseIntegration({ commits: 4, messy: true })).toBe('squash');
    expect(chooseIntegration({ commits: 4, messy: true, linearRequired: true })).toBe('squash');
  });
  it('rebases when a linear history is required', () => {
    expect(chooseIntegration({ commits: 4, messy: false, linearRequired: true })).toBe('rebase');
  });
  it('otherwise merges', () => {
    expect(chooseIntegration({ commits: 4 })).toBe('merge');
    expect(chooseIntegration({ commits: 4, messy: false, linearRequired: false, shared: false })).toBe('merge');
  });
});
```

%% hints
- Five `if`s, in the stated order.

%% solution
```js
export function chooseIntegration({ commits, messy, linearRequired, shared }) {
  if (shared) return 'merge';
  if (commits === 1) return 'rebase';
  if (messy) return 'squash';
  if (linearRequired) return 'rebase';
  return 'merge';
}
```

%% exercise gx-check-merge3 | Tests for a three-way merge | 4 | js | js | checkMerge3 | 42
`merge3(base, ours, theirs)` merges arrays of lines and returns `{ lines, conflicts }`: regions between lines all three share are compared; **only one side changed** → that side; **both made the same change** → once; **otherwise** a conflict block `'<<<<<<< ours'`, ours, `'======='`, theirs, `'>>>>>>> theirs'`. You are given `checkMerge3(merge3)`. Write a check that passes for a correct merge and **fails** for one that: **drops changes made only by theirs**, **drops changes made only by ours**, **reports a conflict when both sides made the same change**, **silently picks ours on a conflict**, **puts theirs before ours in conflict markers**, **counts conflicts wrongly when there are several**.

```js
expect(merge3(['a', 'b'], ['a', 'B'], ['a', 'b'])).toEqual({ lines: ['a', 'B'], conflicts: 0 });
```

%% worked
**A similar problem, solved: `checkPick(pick)`** — one **row per rule** of a decision table, asserting the **exact output**.

```js
export function checkPick(pick) {                      // pick(base, ours, theirs) -> 'ours' | 'theirs' | 'conflict'
  expect(pick('b', 'b', 'B')).toBe('theirs');          // ① only THEIRS changed
  expect(pick('b', 'B', 'b')).toBe('ours');            // ② only OURS changed
  expect(pick('b', 'X', 'X')).toBe('ours');            // ③ both made the SAME change: not a conflict
  expect(pick('b', 'X', 'Y')).toBe('conflict');        // ④ different changes
}
```

Use **distinct, unmistakable lines** so a wrong choice is visible, and include **two separate conflict regions** (a counter that returns `1` or the number of lines instead of the number of **blocks** is only caught when there are two).

%% explain
- **One input per rule**, whole-output `toEqual`.
- **Two conflict regions** for the count.
- **Marker order** in the exact expected lines.

%% nudge
- Why does a check with a single conflict not catch a bad counter?
- Which assertion catches "silently picks ours"?

%% starter
```js
export function checkMerge3(merge3) {
  expect(merge3(['a', 'b'], ['a', 'B'], ['a', 'b'])).toEqual({ lines: ['a', 'B'], conflicts: 0 });
  // your assertions: theirs-only, same change, conflicts and markers, several conflicts
}
```

%% tests
```js
const make = (f = {}) => (base, ours, theirs) => {
  const lcs = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const m = new Map();
    let i = 0, j = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { m.set(i, j); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++; }
    return m;
  };
  const mo = lcs(base, ours);
  const mt = lcs(base, theirs);
  const anchors = [...mo.keys()].filter((i) => mt.has(i));
  const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  const lines = [];
  let conflicts = 0;
  let pb = 0, po = 0, pt = 0;
  const flush = (eb, eo, et) => {
    const b = base.slice(pb, eb), o = ours.slice(po, eo), t = theirs.slice(pt, et);
    if (same(o, b)) lines.push(...(f.dropTheirs ? o : t));
    else if (same(t, b)) lines.push(...(f.dropOurs ? t : o));
    else if (!f.sameConflict && same(o, t)) lines.push(...o);
    else {
      if (f.pickOurs) { lines.push(...o); return; }
      conflicts = f.badCount ? 1 : conflicts + 1;
      if (f.swap) lines.push('<<<<<<< ours', ...t, '=======', ...o, '>>>>>>> theirs');
      else lines.push('<<<<<<< ours', ...o, '=======', ...t, '>>>>>>> theirs');
    }
  };
  for (const i of anchors) { flush(i, mo.get(i), mt.get(i)); lines.push(base[i]); pb = i + 1; po = mo.get(i) + 1; pt = mt.get(i) + 1; }
  flush(base.length, ours.length, theirs.length);
  return { lines, conflicts };
};

const correct = make();
const mutants = {
  'drops changes made only by theirs': make({ dropTheirs: true }),
  'drops changes made only by ours': make({ dropOurs: true }),
  'reports a conflict when both sides made the same change': make({ sameConflict: true }),
  'silently picks ours on a conflict': make({ pickOurs: true }),
  'puts theirs before ours in conflict markers': make({ swap: true }),
  'counts conflicts wrongly when there are several': make({ badCount: true }),
};

describe('your checkMerge3', () => {
  it('passes on a correct merge', () => {
    checkMerge3(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a merge that ${name}`, () => {
      let caught = false;
      try { checkMerge3(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Base `['a','b','c','d','e']`.
- Only theirs changes `b`: result has the new `b`; only ours changes `d`: result has the new `d`.
- Same change on both: `X` once, `conflicts: 0`.
- Two different edits of one line: exact marker lines.
- Two separate conflicting lines (`b` and `d`): `conflicts` is `2`.

%% solution
```js
export function checkMerge3(merge3) {
  const base = ['a', 'b', 'c', 'd', 'e'];

  expect(merge3(base, base, ['a', 'T', 'c', 'd', 'e'])).toEqual({ lines: ['a', 'T', 'c', 'd', 'e'], conflicts: 0 });
  expect(merge3(base, ['a', 'b', 'c', 'O', 'e'], base)).toEqual({ lines: ['a', 'b', 'c', 'O', 'e'], conflicts: 0 });
  expect(merge3(base, ['a', 'O', 'c', 'd', 'e'], ['a', 'b', 'c', 'T', 'e'])).toEqual({ lines: ['a', 'O', 'c', 'T', 'e'], conflicts: 0 });

  expect(merge3(base, ['a', 'X', 'c', 'd', 'e'], ['a', 'X', 'c', 'd', 'e'])).toEqual({ lines: ['a', 'X', 'c', 'd', 'e'], conflicts: 0 });

  expect(merge3(base, ['a', 'O', 'c', 'd', 'e'], ['a', 'T', 'c', 'd', 'e'])).toEqual({
    lines: ['a', '<<<<<<< ours', 'O', '=======', 'T', '>>>>>>> theirs', 'c', 'd', 'e'],
    conflicts: 1,
  });

  const two = merge3(base, ['a', 'O1', 'c', 'O2', 'e'], ['a', 'T1', 'c', 'T2', 'e']);
  expect(two.conflicts).toBe(2);
  expect(two.lines).toEqual([
    'a', '<<<<<<< ours', 'O1', '=======', 'T1', '>>>>>>> theirs',
    'c', '<<<<<<< ours', 'O2', '=======', 'T2', '>>>>>>> theirs', 'e',
  ]);
}
```
