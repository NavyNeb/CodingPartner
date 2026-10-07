---
id: git-diff-history
track: git
title: Diff, patch, bisect and undo
summary: How a line diff is computed, what a patch is and when it fails to apply, how bisect finds a bad commit in logarithmic time, and which undo tool (revert, reset, restore, reflog) is safe in which situation.
---

## The idea in one sentence

Git stores **snapshots**, but you reason about **changes**: a **diff** is the smallest set of edits between two snapshots, a **patch** is a diff you can replay, and tools like **bisect** and the **reflog** turn that history into a way to **find** and **undo** problems.

> **Analogy** Track changes in a document. The **diff** is the list of insertions and deletions; a **patch** is that list handed to someone else who applies it to their copy (and it only works if their copy still looks like the one you edited); and **bisect** is finding the exact edit that broke the formatting by checking the document at the halfway point of its history, then halving again.

*(Real commands: `git diff`, `git format-patch` / `git apply`, `git bisect start | good | bad | run`, `git revert`, `git reset`, `git restore`, `git reflog`.)*

## What a diff is

![Line diff](fig:gt-diff "Longest common subsequence; the rest is minus and plus.")

A line diff finds the **longest common subsequence** of the old and new lines. Everything in it is unchanged **context**; old lines outside it are **removed** (`-`); new lines outside it are **added** (`+`). An edited line shows up as a removal followed by an addition. Git can use different algorithms (Myers by default, `--patience`, `--histogram`) that all find a valid minimal-ish script but choose differently when several are equally short.

In **unified format** the changes are grouped into **hunks** that start with `@@ -oldStart,oldCount +newStart,newCount @@` and carry a few lines of context around each change.

## Patches and why they fail

A patch is a list of hunks. To **apply** one, the tool checks that the **context lines and the lines to remove** match the target at the expected place; only then does it make the edit. If the file has drifted (somebody else changed those lines), the hunk **fails**, which is the same situation as a merge conflict. Applying hunks **in order** means each hunk's position in the file shifts by the net lines earlier hunks added or removed.

**Inverting** a patch (swap `+` and `-`) gives the patch that **undoes** it, which is how `git revert` works conceptually.

```js try predict
let lo = 0;
let hi = 1023;
let tests = 0;
while (hi - lo > 1) {
  const mid = (lo + hi) >> 1;
  if (mid >= 700) hi = mid;      // "bad" from commit 700 onwards
  else lo = mid;
  tests++;
}
console.log(hi, tests);
```

## Bisect

![Bisect](fig:gt-bisect "Halve the range each time.")

When a bug appears and you do not know which commit caused it, you give Git a **known good** commit and a **known bad** one. It checks out the **middle**, you say good or bad, and the range **halves**. 1000 commits take about **10 tests**. With `git bisect run ./test.sh` the whole search is automatic. A commit that cannot be tested (it does not build) is **skipped**: Git tests a neighbour instead, and if too many are skipped it can only say "the first bad commit is one of these".

## Undoing things

![Undo toolbox](fig:gt-undo "Safe on shared branches vs only on private ones.")

The key distinction: **does the command rewrite history?** `revert` adds a **new commit** that cancels an old one, so it is safe on a shared branch. `reset` **moves the branch label** (and `--hard` also throws away working-tree changes), so it is for **private** history only. The **reflog** records every position a label has had, so a mistaken reset is recoverable with `git reset --hard HEAD@{1}`.

```stepper Recovering from a bad reset
code:
  git reset --hard HEAD~3      # oops
  git reflog
  git reset --hard HEAD@{1}
---
line: 1
say: `reset --hard` moves `main` back three commits and **discards** the work tree. The three commits are now **unreachable** (nothing points to them) but still exist.
phase: the mistake
---
line: 2
say: The **reflog** lists every place `HEAD` has been: `HEAD@{0}` is where you are now, `HEAD@{1}` is where you were **before** the reset.
phase: find it
---
line: 3
say: Resetting to `HEAD@{1}` moves the label back to the old tip: the three commits are reachable again. (Uncommitted changes discarded by `--hard` are the only thing the reflog cannot bring back.)
phase: recover
```

## Quick check

```check
Q: In a unified diff, what does a line starting with "-" mean?
A) The line was added
B) The line exists in the old version and not in the new one *
C) The line is a comment
D) The line moved
Why: Minus is removal; plus is addition; a space is unchanged context.
---
Q: Why can a patch fail to apply?
A) Patches only work once
B) The context or removed lines no longer match the target file *
C) The hunk header is wrong
D) Git does not allow patches
Why: Apply checks the surrounding lines before it edits.
---
Q: Roughly how many tests does git bisect need for 1000 commits?
A) 1000
B) 500
C) About 10 *
D) 100
Why: Each test halves the range: log2(1000) is about 10.
---
Q: A teammate already pulled a commit that turned out to be wrong. How do you undo it on main?
A) git reset --hard and force-push
B) git revert, which adds a cancelling commit *
C) Delete the repository
D) git gc
Why: Revert does not rewrite history that others already have.
```

## Recap

- A **diff** = LCS of lines: context, `-` removals, `+` additions; an edit is a removal plus an addition.
- A **patch** applies only if its **context and removed lines match**; hunk positions shift by earlier hunks' net change; **invert** to undo.
- **Bisect** halves the range: **log2(n)** tests; **skip** untestable commits; may end with a **candidate set**.
- **Revert** is safe on shared history; **reset** and **amend** are for private history; the **reflog** is the safety net.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: diff statistics | Counting by operation |
| A line diff | An LCS table and a walk that emits operations |
| Apply and invert patches | Index arithmetic, context checks, cumulative offsets |
| Bisect | Binary search with a log and "skip" handling |
| A reflog | Per-ref histories and `name@{n}` lookups |
| Tests for bisect | Counting calls and a scripted test function |

%% exercise gx-guided-diffstat | Guided: diff statistics | 1 | js | js | diffStat | 8 | guided
Implement `diffStat(ops)` for a list of diff operations `{ op, line }` where `op` is `'+'`, `'-'` or `' '` (context). Return `{ added, removed, unchanged }`: how many operations of each kind.

```js
diffStat([{ op: ' ', line: 'a' }, { op: '-', line: 'b' }, { op: '+', line: 'c' }]); // { added: 1, removed: 1, unchanged: 1 }
```

%% worked
**A similar problem, solved: `tally(events)`** — count by category in one pass.

```js
function tally(events) {
  const out = { ok: 0, warn: 0, fail: 0 };
  for (const e of events) {
    if (e.level in out) out[e.level]++;      // ① one counter per known category
  }
  return out;
}
```

Start with all counters at `0` so an empty list returns zeros instead of `undefined`.

%% explain
- **Three counters**, one loop.

%% nudge
- What should an empty list return?

%% starter
```js
export function diffStat(ops) {
  return { added: 0, removed: 0, unchanged: 0 };
}
```

%% tests
```js
describe('diffStat', () => {
  it('counts each kind of operation', () => {
    const ops = [{ op: ' ', line: 'a' }, { op: '-', line: 'b' }, { op: '+', line: 'c' }, { op: '+', line: 'd' }];
    expect(diffStat(ops)).toEqual({ added: 2, removed: 1, unchanged: 1 });
  });
  it('returns zeros for no operations', () => {
    expect(diffStat([])).toEqual({ added: 0, removed: 0, unchanged: 0 });
  });
});
```

%% hints
- `for (const { op } of ops) { if (op === '+') added++; ... }`

%% solution
```js
export function diffStat(ops) {
  const stat = { added: 0, removed: 0, unchanged: 0 };
  for (const { op } of ops) {
    if (op === '+') stat.added++;
    else if (op === '-') stat.removed++;
    else stat.unchanged++;
  }
  return stat;
}
```

%% exercise gx-diff | A line diff | 4 | js | js | diffLines | 36
`diffLines(oldLines, newLines)` returns the list of operations `{ op, line }` that turns `oldLines` into `newLines`, where `op` is `' '` (unchanged), `'-'` (only in old) or `'+'` (only in new).

- Build the **longest common subsequence** table of the two arrays.
- Walk from the start: equal lines give `' '` and advance both; otherwise, when the table says skipping the **old** line is **at least as good** (`dp[i+1][j] >= dp[i][j+1]`), emit `'-'` and advance `i`; else emit `'+'` and advance `j`. When one array runs out, emit the rest of the other as `'-'` or `'+'`.
- So when a line is **replaced**, the removal comes **before** the addition.
- The input arrays are not changed.

```js
diffLines(['a', 'b', 'c'], ['a', 'X', 'c']);
// [{ op: ' ', line: 'a' }, { op: '-', line: 'b' }, { op: '+', line: 'X' }, { op: ' ', line: 'c' }]
```

%% worked
**A similar problem, solved: `editScript(a, b)`** — the same walk over a length table, for characters.

```js
function editScript(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);   // ① LCS length of the two TAILS
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push('= ' + a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push('- ' + a[i++]);   // ② dropping a[i] loses nothing: delete it
    else out.push('+ ' + b[j++]);
  }
  while (i < a.length) out.push('- ' + a[i++]);                        // ③ leftovers
  while (j < b.length) out.push('+ ' + b[j++]);
  return out;
}
```

Fill the table **from the end** so `dp[i][j]` describes the **remaining** lines: then the forward walk can follow it without backtracking.

%% explain
- **Table** of LCS lengths of suffixes.
- **Walk** forward, preferring a deletion on ties.
- **Leftovers** at the end.

%% nudge
- Why does the table describe suffixes instead of prefixes?
- Which one comes first on a tie: the deletion or the addition?

%% starter
```js
export function diffLines(oldLines, newLines) {
  return [];
}
```

%% tests
```js
describe('diffLines', () => {
  const show = (ops) => ops.map((o) => o.op + o.line);

  it('marks identical files as all context', () => {
    expect(show(diffLines(['a', 'b'], ['a', 'b']))).toEqual([' a', ' b']);
  });
  it('shows a replaced line as a removal then an addition', () => {
    expect(show(diffLines(['a', 'b', 'c'], ['a', 'X', 'c']))).toEqual([' a', '-b', '+X', ' c']);
  });
  it('shows insertions', () => {
    expect(show(diffLines(['a', 'c'], ['a', 'b', 'c']))).toEqual([' a', '+b', ' c']);
    expect(show(diffLines(['a'], ['a', 'z']))).toEqual([' a', '+z']);
    expect(show(diffLines(['a'], ['z', 'a']))).toEqual(['+z', ' a']);
  });
  it('shows deletions', () => {
    expect(show(diffLines(['a', 'b', 'c'], ['a', 'c']))).toEqual([' a', '-b', ' c']);
    expect(show(diffLines(['a', 'b'], ['b']))).toEqual(['-a', ' b']);
  });
  it('handles empty inputs', () => {
    expect(diffLines([], [])).toEqual([]);
    expect(show(diffLines([], ['a', 'b']))).toEqual(['+a', '+b']);
    expect(show(diffLines(['a', 'b'], []))).toEqual(['-a', '-b']);
  });
  it('handles completely different files', () => {
    expect(show(diffLines(['a', 'b'], ['c', 'd']))).toEqual(['-a', '-b', '+c', '+d']);
  });
  it('keeps the longest common subsequence as context', () => {
    const ops = diffLines(['a', 'b', 'c', 'd', 'e'], ['b', 'x', 'd', 'e', 'f']);
    expect(ops.filter((o) => o.op === ' ').map((o) => o.line)).toEqual(['b', 'd', 'e']);
  });
  it('reconstructs both files from the operations', () => {
    const a = ['one', 'two', 'three', 'four', 'five'];
    const b = ['one', 'three', 'four', 'FOUR AND A HALF', 'five', 'six'];
    const ops = diffLines(a, b);
    expect(ops.filter((o) => o.op !== '+').map((o) => o.line)).toEqual(a);
    expect(ops.filter((o) => o.op !== '-').map((o) => o.line)).toEqual(b);
  });
  it('does not change its inputs', () => {
    const a = ['a', 'b'];
    const b = ['b', 'c'];
    diffLines(a, b);
    expect([a, b]).toEqual([['a', 'b'], ['b', 'c']]);
  });
});
```

%% hints
- `dp[i][j]` = LCS length of `old.slice(i)` and `new.slice(j)`.
- Walk with `i`, `j`; equal → `' '`; else `dp[i + 1][j] >= dp[i][j + 1]` → `'-'`, else `'+'`.
- Flush whatever remains.

%% solution
```js
export function diffLines(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      ops.push({ op: ' ', line: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: '-', line: oldLines[i++] });
    } else {
      ops.push({ op: '+', line: newLines[j++] });
    }
  }
  while (i < n) ops.push({ op: '-', line: oldLines[i++] });
  while (j < m) ops.push({ op: '+', line: newLines[j++] });
  return ops;
}
```

%% exercise gx-patch | Apply and invert patches | 4 | js | js | applyPatch, invertPatch | 42
A patch is an ordered list of hunks `{ oldStart, lines }` where each entry of `lines` starts with `' '` (context), `'-'` (remove) or `'+'` (add) followed by the line text. `oldStart` is a **1-based line number in the original file** for the first context/removed line; for a hunk with **only `+` lines** it is the **number of original lines before the insertion point**.

`applyPatch(lines, hunks)` returns the new array of lines:

- Copy the original lines up to each hunk, then process the hunk: for a `' '` or `'-'` entry the original line at the current position must **equal** the text, otherwise throw `Error('hunk failed at line N')` with `N` the 1-based original line number. `' '` copies it, `'-'` drops it, `'+'` adds its text.
- Hunks must be in increasing order and must not overlap; otherwise throw `Error('hunks out of order')`.
- Copy the rest after the last hunk. The input is not changed.

`invertPatch(hunks)` returns the hunks that **undo** the patch: every `'+'` becomes `'-'` and vice versa (context stays), and `oldStart` is recomputed for the **new** file: add the net lines (additions minus removals) of all **earlier** hunks to the hunk's original position. Use the same conventions: for an inverted hunk with only `+` lines `oldStart` is the number of lines before the insertion point; otherwise it is the 1-based first line.

```js
applyPatch(['a', 'b', 'c'], [{ oldStart: 2, lines: ['-b', '+B'] }]); // ['a', 'B', 'c']
```

%% worked
**A similar problem, solved: `applyEdits(lines, edits)`** — a **cursor** over the original while building the output, with a **net shift** you can reason about.

```js
function applyEdits(lines, edits) {                     // edits: [{ at, remove: n, insert: [..] }] in increasing order
  const out = [];
  let pos = 0;                                           // ① cursor into the ORIGINAL array
  for (const e of edits) {
    if (e.at < pos) throw new Error('out of order');     // ② each edit must start after the previous one ended
    out.push(...lines.slice(pos, e.at));                 // ③ copy the untouched stretch
    out.push(...e.insert);
    pos = e.at + e.remove;                               // ④ skip what was removed
  }
  out.push(...lines.slice(pos));
  return out;
}
```

Work in **original** coordinates when applying (no shifting needed) and add the **running net change** only when you compute positions for the **new** file, as `invertPatch` must.

%% explain
- **`applyPatch`**: a cursor over the original; verify then consume.
- **`invertPatch`**: flip signs, then recompute starts with a running delta.
- Pure-insertion hunks have their own start convention.

%% nudge
- What is `oldStart` for a hunk that only adds lines?
- Why must the inverse's starts include earlier hunks' net change?

%% starter
```js
export function applyPatch(lines, hunks) {
  return [...lines];
}

export function invertPatch(hunks) {
  return hunks;
}
```

%% tests
```js
describe('applyPatch', () => {
  const file = ['a', 'b', 'c', 'd', 'e'];
  it('replaces a line', () => {
    expect(applyPatch(['a', 'b', 'c'], [{ oldStart: 2, lines: ['-b', '+B'] }])).toEqual(['a', 'B', 'c']);
  });
  it('keeps context lines and checks them', () => {
    expect(applyPatch(file, [{ oldStart: 2, lines: [' b', '-c', '+C', ' d'] }])).toEqual(['a', 'b', 'C', 'd', 'e']);
  });
  it('adds lines with a pure insertion hunk', () => {
    expect(applyPatch(file, [{ oldStart: 2, lines: ['+x', '+y'] }])).toEqual(['a', 'b', 'x', 'y', 'c', 'd', 'e']);
    expect(applyPatch(file, [{ oldStart: 0, lines: ['+top'] }])[0]).toBe('top');
    expect(applyPatch(file, [{ oldStart: 5, lines: ['+end'] }]).slice(-2)).toEqual(['e', 'end']);
  });
  it('removes lines', () => {
    expect(applyPatch(file, [{ oldStart: 2, lines: ['-b', '-c'] }])).toEqual(['a', 'd', 'e']);
  });
  it('applies several hunks against original positions', () => {
    const hunks = [{ oldStart: 1, lines: ['-a', '+A', '+A2'] }, { oldStart: 4, lines: ['-d'] }];
    expect(applyPatch(file, hunks)).toEqual(['A', 'A2', 'b', 'c', 'e']);
  });
  it('fails when a context or removed line does not match', () => {
    expect(() => applyPatch(file, [{ oldStart: 2, lines: ['-WRONG'] }])).toThrow('hunk failed at line 2');
    expect(() => applyPatch(file, [{ oldStart: 2, lines: [' b', ' WRONG'] }])).toThrow('hunk failed at line 3');
    expect(() => applyPatch(file, [{ oldStart: 5, lines: [' e', ' f'] }])).toThrow('hunk failed at line 6');
  });
  it('rejects hunks out of order or overlapping', () => {
    expect(() => applyPatch(file, [{ oldStart: 4, lines: ['-d'] }, { oldStart: 2, lines: ['-b'] }])).toThrow('hunks out of order');
    expect(() => applyPatch(file, [{ oldStart: 2, lines: ['-b', '-c'] }, { oldStart: 3, lines: ['-c'] }])).toThrow('hunks out of order');
  });
  it('does not change the input', () => {
    const copy = [...file];
    applyPatch(file, [{ oldStart: 2, lines: ['-b'] }]);
    expect(file).toEqual(copy);
  });
});

describe('invertPatch', () => {
  const file = ['a', 'b', 'c', 'd', 'e', 'f'];
  const patch = [
    { oldStart: 1, lines: ['-a', '+A1', '+A2'] },
    { oldStart: 3, lines: ['+inserted'] },
    { oldStart: 5, lines: [' e', '-f'] },
  ];
  it('swaps additions and removals', () => {
    const inv = invertPatch([{ oldStart: 2, lines: [' b', '-c', '+C'] }]);
    expect(inv[0].lines).toEqual([' b', '+c', '-C']);
  });
  it('undoes the patch: applying the inverse restores the original', () => {
    const patched = applyPatch(file, patch);
    expect(patched).toEqual(['A1', 'A2', 'b', 'c', 'inserted', 'd', 'e']);
    expect(applyPatch(patched, invertPatch(patch))).toEqual(file);
  });
  it('recomputes starts for the new file', () => {
    const inv = invertPatch(patch);
    expect(inv.map((h) => h.oldStart)).toEqual([1, 5, 7]);
  });
  it('handles a pure removal, which becomes a pure insertion', () => {
    const p = [{ oldStart: 2, lines: ['-b', '-c'] }];
    const inv = invertPatch(p);
    expect(inv).toEqual([{ oldStart: 1, lines: ['+b', '+c'] }]);
    expect(applyPatch(applyPatch(file, p), inv)).toEqual(file);
  });
  it('does not change its input', () => {
    const copy = JSON.parse(JSON.stringify(patch));
    invertPatch(patch);
    expect(patch).toEqual(copy);
  });
});
```

%% hints
- Define `hasOld = (h) => h.lines.some((l) => l[0] !== '+')`; start index `= hasOld ? oldStart - 1 : oldStart`.
- `applyPatch`: `pos` cursor; for each hunk copy `lines.slice(pos, startIdx)`, process entries advancing `pos`, throw if `startIdx < pos`.
- `invertPatch`: `delta` running total; `newIdx = startIdx + delta`; inverted `hasOld = lines.some((l) => l[0] !== '-')`; `oldStart = hasOld ? newIdx + 1 : newIdx`; then `delta += adds - removes`.

%% solution
```js
const startIndex = (h) => (h.lines.some((l) => l[0] !== '+') ? h.oldStart - 1 : h.oldStart);

export function applyPatch(lines, hunks) {
  const out = [];
  let pos = 0;
  for (const hunk of hunks) {
    const start = startIndex(hunk);
    if (start < pos) throw new Error('hunks out of order');
    out.push(...lines.slice(pos, start));
    pos = start;
    for (const entry of hunk.lines) {
      const op = entry[0];
      const text = entry.slice(1);
      if (op === '+') {
        out.push(text);
      } else {
        if (lines[pos] !== text) throw new Error('hunk failed at line ' + (pos + 1));
        if (op === ' ') out.push(text);
        pos++;
      }
    }
  }
  out.push(...lines.slice(pos));
  return out;
}

export function invertPatch(hunks) {
  let delta = 0;
  return hunks.map((hunk) => {
    const newIdx = startIndex(hunk) + delta;
    const inverted = hunk.lines.map((l) => (l[0] === '+' ? '-' + l.slice(1) : l[0] === '-' ? '+' + l.slice(1) : l));
    const hasOld = inverted.some((l) => l[0] !== '+');
    const adds = hunk.lines.filter((l) => l[0] === '+').length;
    const removes = hunk.lines.filter((l) => l[0] === '-').length;
    delta += adds - removes;
    return { oldStart: hasOld ? newIdx + 1 : newIdx, lines: inverted };
  });
}
```

%% exercise gx-bisect | Bisect a history | 4 | js | js | bisect | 40
`bisect(commits, test)` finds the **first bad commit**. `commits` is an array of ids **oldest first**; `commits[0]` is known **good** and the **last** is known **bad** (they are never tested). `test(id)` returns `true` (bad), `false` (good) or `'skip'` (cannot be tested). If there are fewer than two commits throw `Error('need at least two commits')`.

Keep `lo` (a good index) and `hi` (a bad index), starting at the ends. While `hi - lo > 1`:

- Take `mid = (lo + hi) >> 1`. Choose the commit to test: `mid` itself if not skipped, otherwise the **nearest** index strictly between `lo` and `hi` that has not been skipped, checking `mid - d` before `mid + d` for each distance `d`. If there is none, stop and return `{ firstBad: null, candidates: commits.slice(lo + 1, hi + 1), tested }`.
- Test it (append its id to `tested`). `true` → `hi = index`; `false` → `lo = index`; `'skip'` → remember it as skipped and loop again.

Finally return `{ firstBad: commits[hi], tested }`.

```js
bisect(['c0', 'c1', 'c2', 'c3', 'c4'], (id) => id >= 'c3'); // { firstBad: 'c3', tested: ['c2', 'c3'] }
```

%% worked
**A similar problem, solved: `firstFailingBuild(builds, fails)`** — the plain binary search on a monotone predicate.

```js
function firstFailingBuild(builds, fails) {          // builds[0] passes, builds[n-1] fails, once failing always failing
  let lo = 0, hi = builds.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;                      // ① the midpoint is strictly between lo and hi
    if (fails(builds[mid])) hi = mid; else lo = mid; // ② keep the invariant: lo passes, hi fails
  }
  return builds[hi];                                 // ③ they are neighbours: hi is the first failure
}
```

`skip` changes only the **choice of the index** you test (a nearby one instead of `mid`) and adds one more way to finish: **no testable commit left** in the range.

%% explain
- **Invariant**: `lo` good, `hi` bad.
- **Pick** the nearest unskipped index to `mid` (lower first).
- **No pick** means the answer is a set of candidates.

%% nudge
- Which index do you test when the midpoint was skipped?
- What does the function return when nothing between `lo` and `hi` can be tested?

%% starter
```js
export function bisect(commits, test) {
  return { firstBad: commits[commits.length - 1], tested: [] };
}
```

%% tests
```js
describe('bisect', () => {
  const ids = (n) => Array.from({ length: n }, (_, i) => 'c' + i);
  const run = (n, badFrom, skips = []) => {
    const calls = [];
    const result = bisect(ids(n), (id) => {
      calls.push(id);
      const i = Number(id.slice(1));
      if (skips.includes(i)) return 'skip';
      return i >= badFrom;
    });
    return { result, calls };
  };

  it('finds the first bad commit', () => {
    for (const badFrom of [1, 2, 5, 9]) {
      expect(run(10, badFrom).result.firstBad).toBe('c' + badFrom);
    }
  });
  it('tests the midpoints in order and reports them', () => {
    const { result } = run(10, 6);
    expect(result.tested).toEqual(['c4', 'c6', 'c5']);
    expect(result.firstBad).toBe('c6');
  });
  it('never tests the endpoints or the same commit twice', () => {
    const { calls } = run(16, 11);
    expect(calls).not.toContain('c0');
    expect(calls).not.toContain('c15');
    expect(new Set(calls).size).toBe(calls.length);
  });
  it('needs only about log2(n) tests', () => {
    expect(run(16, 15).calls.length).toBeLessThanOrEqual(4);
    expect(run(1000, 700).calls.length).toBeLessThanOrEqual(10);
    expect(run(1000, 700).result.firstBad).toBe('c700');
  });
  it('handles two commits without testing anything', () => {
    const { result, calls } = run(2, 1);
    expect(result).toEqual({ firstBad: 'c1', tested: [] });
    expect(calls).toEqual([]);
  });
  it('rejects a history that is too short', () => {
    expect(() => bisect(['c0'], () => true)).toThrow('need at least two commits');
    expect(() => bisect([], () => true)).toThrow('need at least two commits');
  });
  it('tests a neighbour when the midpoint is skipped', () => {
    const { result } = run(8, 5, [3]);
    expect(result.tested).toEqual(['c3', 'c2', 'c4', 'c5']);
    expect(result.firstBad).toBe('c5');
  });
  it('reports candidates when too many commits are skipped', () => {
    const { result } = run(5, 3, [1, 2]);
    expect(result.firstBad).toBeNull();
    expect(result.candidates).toEqual(['c1', 'c2', 'c3']);
  });
  it('still finds the answer when skips are outside the final range', () => {
    const { result } = run(16, 12, [4, 5, 6]);
    expect(result.firstBad).toBe('c12');
  });
});
```

%% hints
- `let lo = 0, hi = commits.length - 1; const skipped = new Set();`
- To pick: loop `d` from `0` to `hi - lo`; candidates `d === 0 ? [mid] : [mid - d, mid + d]`; a candidate is valid if `> lo`, `< hi` and not skipped.
- `const r = test(commits[pick]); tested.push(commits[pick]);`
- `'skip'` → `skipped.add(pick)` and `continue`.

%% solution
```js
export function bisect(commits, test) {
  if (commits.length < 2) throw new Error('need at least two commits');
  let lo = 0;
  let hi = commits.length - 1;
  const tested = [];
  const skipped = new Set();

  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    let pick = null;
    for (let d = 0; d <= hi - lo && pick === null; d++) {
      for (const c of d === 0 ? [mid] : [mid - d, mid + d]) {
        if (c > lo && c < hi && !skipped.has(c)) {
          pick = c;
          break;
        }
      }
    }
    if (pick === null) return { firstBad: null, candidates: commits.slice(lo + 1, hi + 1), tested };

    const result = test(commits[pick]);
    tested.push(commits[pick]);
    if (result === 'skip') skipped.add(pick);
    else if (result) hi = pick;
    else lo = pick;
  }
  return { firstBad: commits[hi], tested };
}
```

%% exercise gx-reflog | A reflog | 3 | js | js | createRefs | 28
`createRefs()` models labels and their reflogs and returns `{ move, get, reflog, resolve }`.

- `move(ref, hash, reason = 'move')` points `ref` at `hash` and records an entry (every move is recorded, even to the same hash).
- `get(ref)` returns the current hash, or `undefined` for a ref that was never moved.
- `reflog(ref)` returns the entries **newest first** as `{ spec, hash, reason }` where `spec` is `ref@{n}` (`n` = 0 for the newest). A ref with no moves gives `[]`.
- `resolve(spec)` returns a hash: `name` is the current hash (throws `Error('unknown ref: name')` if there is none), and `name@{n}` is the hash that entry points to (throws `Error('reflog entry out of range: ' + spec)` when there is no entry `n`; an unknown ref is `unknown ref`).

```js
const refs = createRefs();
refs.move('main', 'c3'); refs.move('main', 'c1', 'reset');
refs.resolve('main@{1}'); // 'c3'
```

%% worked
**A similar problem, solved: `createHistoryLog()`** — append-only entries, read **newest first**, address by "n steps back".

```js
function createHistoryLog() {
  const entries = [];
  return {
    push(value) { entries.push(value); },
    back(n) {
      if (n >= entries.length) throw new Error('out of range');
      return entries[entries.length - 1 - n];             // ① n = 0 is the NEWEST: count from the end
    },
  };
}
```

Keep **one array per ref** and parse `name@{n}` with a regular expression.

%% explain
- **Per-ref arrays**, appended on every move.
- **Index from the end** for `@{n}`.
- **Regex** `/^(.+)@\{(\d+)\}$/`.

%% nudge
- Which entry is `@{0}`?

%% starter
```js
export function createRefs() {
  return {
    move(ref, hash, reason = 'move') {},
    get(ref) {},
    reflog(ref) {
      return [];
    },
    resolve(spec) {},
  };
}
```

%% tests
```js
describe('createRefs', () => {
  const setup = () => {
    const refs = createRefs();
    refs.move('main', 'c1', 'commit');
    refs.move('main', 'c2', 'commit');
    refs.move('main', 'c3', 'commit');
    refs.move('main', 'c1', 'reset');
    return refs;
  };

  it('tracks the current hash', () => {
    const refs = setup();
    expect(refs.get('main')).toBe('c1');
    expect(refs.get('other')).toBeUndefined();
  });
  it('lists the reflog newest first with specs and reasons', () => {
    expect(setup().reflog('main')).toEqual([
      { spec: 'main@{0}', hash: 'c1', reason: 'reset' },
      { spec: 'main@{1}', hash: 'c3', reason: 'commit' },
      { spec: 'main@{2}', hash: 'c2', reason: 'commit' },
      { spec: 'main@{3}', hash: 'c1', reason: 'commit' },
    ]);
    expect(setup().reflog('nothing')).toEqual([]);
  });
  it('defaults the reason', () => {
    const refs = createRefs();
    refs.move('x', 'h');
    expect(refs.reflog('x')[0].reason).toBe('move');
  });
  it('recovers the pre-reset commit with name@{1}', () => {
    expect(setup().resolve('main@{1}')).toBe('c3');
    expect(setup().resolve('main@{0}')).toBe('c1');
  });
  it('resolves a plain name to the current hash', () => {
    expect(setup().resolve('main')).toBe('c1');
  });
  it('records moves to the same hash', () => {
    const refs = createRefs();
    refs.move('a', 'h1');
    refs.move('a', 'h1');
    expect(refs.reflog('a')).toHaveLength(2);
  });
  it('keeps refs independent', () => {
    const refs = setup();
    refs.move('feature', 'f1');
    expect(refs.reflog('feature')).toHaveLength(1);
    expect(refs.reflog('main')).toHaveLength(4);
  });
  it('rejects unknown refs and out-of-range entries', () => {
    const refs = setup();
    expect(() => refs.resolve('nope')).toThrow('unknown ref: nope');
    expect(() => refs.resolve('nope@{0}')).toThrow('unknown ref: nope');
    expect(() => refs.resolve('main@{4}')).toThrow('reflog entry out of range: main@{4}');
  });
});
```

%% hints
- `logs: Map(ref → array of { hash, reason })`, pushing on each move.
- `reflog`: `[...log].reverse().map((e, i) => ({ spec: ref + '@{' + i + '}', ...e }))`.
- `const m = /^(.+)@\{(\d+)\}$/.exec(spec)`.

%% solution
```js
export function createRefs() {
  const logs = new Map();
  const list = (ref) => logs.get(ref) ?? [];
  const reflog = (ref) =>
    [...list(ref)].reverse().map((entry, i) => ({ spec: ref + '@{' + i + '}', hash: entry.hash, reason: entry.reason }));
  return {
    move(ref, hash, reason = 'move') {
      if (!logs.has(ref)) logs.set(ref, []);
      logs.get(ref).push({ hash, reason });
    },
    get(ref) {
      const log = list(ref);
      return log.length ? log[log.length - 1].hash : undefined;
    },
    reflog,
    resolve(spec) {
      const m = /^(.+)@\{(\d+)\}$/.exec(spec);
      const ref = m ? m[1] : spec;
      const log = list(ref);
      if (log.length === 0) throw new Error('unknown ref: ' + ref);
      if (!m) return log[log.length - 1].hash;
      const entry = reflog(ref)[Number(m[2])];
      if (!entry) throw new Error('reflog entry out of range: ' + spec);
      return entry.hash;
    },
  };
}
```

%% exercise gx-check-bisect | Tests for bisect | 4 | js | js | checkBisect | 42
`bisect(commits, test)` takes ids oldest first (first known good, last known bad, neither is tested) and a `test` returning `true` (bad), `false` (good) or `'skip'`. It halves the range, tests a neighbour of the midpoint when that is skipped, and returns `{ firstBad, tested }`, or `{ firstBad: null, candidates, tested }` when skipped commits make the answer ambiguous. You are given `checkBisect(bisect)`. Write a check that passes for a correct bisect and **fails** for one that: **scans commits one by one**, **returns the last good commit instead of the first bad one**, **treats a skipped commit as good**, **tests the two end commits**, **guesses instead of reporting candidates when the answer is ambiguous**.

```js
const ids = ['c0', 'c1', 'c2', 'c3', 'c4'];
const result = bisect(ids, (id) => id >= 'c3');
expect(result.firstBad).toBe('c3');
```

%% worked
**A similar problem, solved: `checkBinarySearch(search)`** — assert the **answer** and the **cost**, using a spy on the probe function.

```js
export function checkBinarySearch(search) {                  // search(sorted, probe) -> index of first true
  const sorted = Array.from({ length: 1024 }, (_, i) => i);
  const probes = [];
  const index = search(sorted, (i) => { probes.push(i); return i >= 700; });
  expect(index).toBe(700);                                   // ① the right answer...
  expect(probes.length).toBeLessThanOrEqual(10);             // ② ...found with logarithmic work, not a scan
}
```

A linear scan **also returns the right answer**, so only the **call count** exposes it. Check the **boundaries** too (first possible bad, last possible bad), and add **skip** scenarios: one where skipping is survivable and one where it makes the answer ambiguous.

%% explain
- **Answer and cost**: `firstBad` and `tested.length` / call count.
- **Boundaries**: first-bad at `1` and at `n-1`.
- **Never test the endpoints**, **never repeat**.
- **Skip scenarios**.

%% nudge
- Which assertion catches a linear scan?
- How do you build an ambiguous skip scenario?

%% starter
```js
export function checkBisect(bisect) {
  const ids = ['c0', 'c1', 'c2', 'c3', 'c4'];
  expect(bisect(ids, (id) => id >= 'c3').firstBad).toBe('c3');
  // your assertions: boundaries, call counts, endpoints, skip, ambiguity
}
```

%% tests
```js
const make = (f = {}) => (commits, test) => {
  let lo = 0;
  let hi = commits.length - 1;
  const tested = [];
  const skipped = new Set();
  if (f.testEnds) { tested.push(commits[0]); test(commits[0]); tested.push(commits[hi]); test(commits[hi]); }
  if (f.linear) {
    for (let i = 1; i < commits.length; i++) {
      tested.push(commits[i]);
      const r = test(commits[i]);
      if (r === true) return { firstBad: commits[i], tested };
    }
    return { firstBad: commits[hi], tested };
  }
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    let pick = null;
    for (let d = 0; d <= hi - lo && pick === null; d++) {
      for (const c of d === 0 ? [mid] : [mid - d, mid + d]) {
        if (c > lo && c < hi && !skipped.has(c)) { pick = c; break; }
      }
    }
    if (pick === null) {
      if (f.guess) return { firstBad: commits[hi], tested };
      return { firstBad: null, candidates: commits.slice(lo + 1, hi + 1), tested };
    }
    const result = test(commits[pick]);
    tested.push(commits[pick]);
    if (result === 'skip') { if (f.skipAsGood) lo = pick; else skipped.add(pick); }
    else if (result) hi = pick;
    else lo = pick;
  }
  return { firstBad: f.lastGood ? commits[lo] : commits[hi], tested };
};

const correct = make();
const mutants = {
  'scans commits one by one': make({ linear: true }),
  'returns the last good commit instead of the first bad one': make({ lastGood: true }),
  'treats a skipped commit as good': make({ skipAsGood: true }),
  'tests the two end commits': make({ testEnds: true }),
  'guesses instead of reporting candidates when the answer is ambiguous': make({ guess: true }),
};

describe('your checkBisect', () => {
  it('passes on a correct bisect', () => {
    checkBisect(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a bisect that ${name}`, () => {
      let caught = false;
      try { checkBisect(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- 16 ids `c0..c15`; a helper that records every call and returns `i >= badFrom`.
- First-bad values `1`, `2`, `7`, `8`, `14`, `15`; each needs at most 4 calls and never `c0`/`c15`.
- Skip: first bad `11`, skipping index `7` (the first midpoint): the answer must still be `c11`.
- Ambiguity: `['c0'..'c4']` with `c1`, `c2` skipped and `c3` bad: `firstBad: null`, `candidates: ['c1','c2','c3']`.

%% solution
```js
export function checkBisect(bisect) {
  const ids = Array.from({ length: 16 }, (_, i) => 'c' + i);
  const run = (badFrom, skips = []) => {
    const calls = [];
    const result = bisect(ids, (id) => {
      calls.push(id);
      const i = Number(id.slice(1));
      if (skips.includes(i)) return 'skip';
      return i >= badFrom;
    });
    return { result, calls };
  };

  for (const badFrom of [1, 2, 7, 8, 14, 15]) {
    const { result, calls } = run(badFrom);
    expect(result.firstBad).toBe('c' + badFrom);
    expect(calls.length).toBeLessThanOrEqual(4);
    expect(calls).not.toContain('c0');
    expect(calls).not.toContain('c15');
    expect(new Set(calls).size).toBe(calls.length);
  }

  expect(run(11, [7]).result.firstBad).toBe('c11');
  expect(run(5, [7, 6, 8]).result.firstBad).toBe('c5');

  const small = bisect(['c0', 'c1', 'c2', 'c3', 'c4'], (id) => (id === 'c1' || id === 'c2' ? 'skip' : id === 'c3'));
  expect(small.firstBad).toBeNull();
  expect(small.candidates).toEqual(['c1', 'c2', 'c3']);
}
```
