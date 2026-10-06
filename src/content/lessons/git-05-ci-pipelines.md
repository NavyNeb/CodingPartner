---
id: git-ci-pipelines
track: git
title: CI pipelines: jobs, graphs, matrices and caches
summary: What continuous integration is for, how a pipeline is a graph of jobs with dependencies and limited runners, how matrices, path filters and caches keep it fast and focused, and how to reason about a pipeline's total time.
---

## The idea in one sentence

**Continuous integration** means every change is **automatically built and tested** as soon as it is pushed, on a **clean, repeatable machine**, so problems show up in **minutes**, next to the change that caused them, instead of weeks later during a release.

> **Analogy** A factory inspection line. Each product (a commit) goes through the same stations (jobs) in the same order; some stations can work in parallel, some must wait for an earlier one; a defect stops the line before the product ships; and the line is only useful if it is **fast** enough that nobody is tempted to skip it.

*(In GitHub Actions this is a workflow with `jobs`, `needs`, `strategy.matrix`, `on.push.paths`, `actions/cache` and `actions/upload-artifact`. You will build the logic those features rely on.)*

## Anatomy of a pipeline

| Piece | What it is |
| --- | --- |
| **Trigger** | the event that starts a run: push, pull request, schedule, manual |
| **Job** | a unit that runs on **one runner** (a fresh VM or container) |
| **Step** | one command or action inside a job; steps share the job's disk |
| **Runner** | the machine; there are **limited** numbers of them |
| **Artifact** | a file produced by a job and **kept** or handed to a later job |
| **Cache** | files you want to **reuse** between runs to save time (dependencies); safe to lose |
| **Secret** | a value injected at run time, never stored in the repository |

Jobs on different runners **do not share a disk**: pass results between them with **artifacts**, and reuse downloads with a **cache**.

## Jobs form a graph

![Pipeline graph](fig:gt-pipeline "Jobs wait for their needs; the critical path sets the time.")

A job lists the jobs it **`needs`**. Jobs with no unmet needs start **in parallel**, limited by how many **runners** are free. The run's total time is the **critical path** (the longest chain of dependent jobs), plus any waiting caused by too few runners. Rules every pipeline engine follows:

- A job starts only when **all** its needs **succeeded**.
- If a need **failed or was skipped**, the job is **skipped**, unless it is marked **`always`** (cleanup, notifications).
- **Fail-fast** cancels work that has not started yet once something fails.
- A **cycle** (A needs B needs A) is a configuration error and must be rejected up front, not discovered by a hung run.

```js try predict
const axes = { os: ['ubuntu', 'windows'], node: [18, 20, 22] };
const combos = Object.entries(axes).reduce(
  (acc, [name, values]) => acc.flatMap((combo) => values.map((v) => ({ ...combo, [name]: v }))),
  [{}],
);

console.log(combos.length, combos[0], combos[5]);
```

## Matrices

![Matrix](fig:gt-matrix "Axes multiply; exclude then include adjust the grid.")

A **matrix** runs the same job for **every combination** of a few axes (OS, language version). It grows **multiplicatively**: 3 × 4 × 2 = 24 jobs, so add axes with care. **`exclude`** removes combinations that make no sense (applied first); **`include`** either **adds extra properties** to the combinations it matches (for example `experimental: true`) or, if it matches none, **creates a new combination**.

## Triggers and path filters

Running everything on every push wastes runners, especially in a **monorepo**. **Path filters** (`paths`, `paths-ignore`) start a workflow only when a **relevant file** changed, and **branch filters** limit which branches trigger it. Mind the traps: a **required check** that is skipped by a path filter can block merging, so use a "gate" job that always runs, or filter inside the workflow.

## Caches and artifacts

![Cache](fig:gt-cache "Key by lockfile hash; fall back to a prefix.")

The **cache key** includes a **hash of the lockfile**, so it changes exactly when the dependencies do. An **exact** match restores it and nothing is saved; otherwise **restore keys** (prefixes) pick the **most recent** older cache as a warm start, and the job saves a new one at the end. Caches may be **evicted at any time**, so a build must still work from scratch.

```stepper One pipeline run
code:
  lint(2)      test(5)
  build(3) needs lint
  deploy(1) needs test, build
  notify always needs deploy
---
line: 1
say: `lint` and `test` have **no needs**, so with two free runners they start together at time 0.
phase: t = 0
---
line: 2
say: `build` waits for `lint` (2 min), then runs 2 to 5 while `test` is still running.
phase: t = 2
---
line: 3
say: `deploy` needs **both** `test` and `build`: it starts when the **slower** one finishes, at 5, and ends at 6.
phase: t = 5
---
line: 4
say: `notify` runs after `deploy`. If `test` had failed, `deploy` would be **skipped**, but `notify` is `always` and still runs, to tell the team.
phase: t = 6
```

## Keeping CI useful

- **Fast**: aim for **under ~10 minutes**; shard slow test suites; cache dependencies; run the cheap checks (format, lint) first.
- **Deterministic**: pin versions (lockfiles, container images); a flaky test is a bug in the test or code, not "CI being CI".
- **Required** checks block the merge button; **optional** ones inform.
- **Run the same commands locally** as CI does, so a failure can be reproduced.

## Quick check

```check
Q: Jobs A (2 min) and B (5 min) have no dependencies. Job C (1 min) needs both. With two runners, how long does the run take?
A) 8 minutes
B) 6 minutes *
C) 5 minutes
D) 1 minute
Why: A and B run in parallel; C starts when the slower one ends (5) and takes 1.
---
Q: A job needs a job that failed. What happens to it by default?
A) It runs anyway
B) It is skipped *
C) It retries
D) It is cancelled and rerun
Why: Unless it is marked always, it does not run when a need did not succeed.
---
Q: A matrix has 3 operating systems and 4 versions. How many jobs?
A) 7
B) 12 *
C) 3
D) 4
Why: Matrices multiply: 3 × 4.
---
Q: Why include a hash of the lockfile in the cache key?
A) To encrypt the cache
B) The key then changes exactly when the dependencies change *
C) GitHub requires it
D) It makes the cache smaller
Why: Same lockfile, same dependencies, safe to reuse; different lockfile needs a fresh cache.
```

## Recap

- **CI** = build and test every change automatically on a clean machine, fast.
- A pipeline is a **DAG of jobs**: `needs`, parallel starts, **limited runners**, total time = critical path (plus waiting).
- Failed need → **skip**, unless **always**; **fail-fast**; reject **cycles** up front.
- **Matrix** = product of axes; **exclude** first, then **include** (adds properties or creates a combination).
- **Path and branch filters** save runners; beware skipped required checks.
- **Cache** (speed, key from lockfile hash, restore keys, may vanish) vs **artifact** (output you keep or pass on).

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: matrix size | Multiplying the lengths of arrays |
| Expand a matrix | Cartesian products, partial matching, include semantics |
| Schedule a pipeline | A small discrete-event simulation |
| Trigger filters | Glob-to-regex, `branches` and `paths` rules |
| Cache keys | Hashing and prefix lookup |
| Tests for a scheduler | A graph where each wrong rule changes the timing or statuses |

%% exercise gx-guided-matrix | Guided: matrix size | 1 | js | js | matrixSize | 8 | guided
Implement `matrixSize(axes)` for an object that maps axis names to arrays of values: the number of combinations, the **product of the lengths**. An empty object has `0` combinations (no axes means no matrix).

```js
matrixSize({ os: ['ubuntu', 'windows'], node: [18, 20, 22] }); // 6
```

%% worked
**A similar problem, solved: `countOutfits(options)`** — multiply the choices on each axis, with a special case for "nothing to choose".

```js
function countOutfits(options) {
  const lists = Object.values(options);
  if (lists.length === 0) return 0;                           // ① no categories: no outfits at all, not one empty outfit
  return lists.reduce((total, list) => total * list.length, 1);   // ② start at 1, multiply by each axis
}
```

An axis with **zero** values makes the whole product `0`, which is correct: no valid combination exists.

%% explain
- **`Object.values`**, multiply lengths.
- **Empty object** is a special case.

%% nudge
- Why must the starting value of the product be `1`, not `0`?

%% starter
```js
export function matrixSize(axes) {
  return 0;
}
```

%% tests
```js
describe('matrixSize', () => {
  it('multiplies the axis lengths', () => {
    expect(matrixSize({ os: ['a', 'b'], node: [1, 2, 3] })).toBe(6);
    expect(matrixSize({ x: [1, 2, 3, 4] })).toBe(4);
    expect(matrixSize({ a: [1, 2], b: [1, 2], c: [1, 2] })).toBe(8);
  });
  it('is zero without axes or with an empty axis', () => {
    expect(matrixSize({})).toBe(0);
    expect(matrixSize({ a: [1, 2], b: [] })).toBe(0);
  });
});
```

%% hints
- `Object.values(axes).reduce((n, list) => n * list.length, 1)` after the empty check.

%% solution
```js
export function matrixSize(axes) {
  const lists = Object.values(axes);
  if (lists.length === 0) return 0;
  return lists.reduce((total, list) => total * list.length, 1);
}
```

%% exercise gx-matrix | Expand a build matrix | 4 | js | js | expandMatrix | 40
`expandMatrix({ matrix, include = [], exclude = [] })` returns the list of job combinations (plain objects).

1. **Product**: one combination for every choice of one value per axis in `matrix` (an object of arrays). The **first axis varies slowest**, in the objects' key order. No axes gives no combinations (`[]`).
2. **Exclude**: remove every combination that **matches** an `exclude` entry; an entry matches when **all** of its keys equal the combination's values (partial entries are fine).
3. **Include**, applied after exclude and **in order**: an include entry **matches** a combination when every key of the entry that is **also an axis name** has the same value in the combination. Every matching combination gets the entry's other (non-axis) keys added. If the entry matches **no** combination, it becomes a **new combination** appended at the end (a copy of the entry).
4. If `matrix` has **no axes**, each `include` entry is simply its own combination (in order).
5. Return new objects; do not change the inputs.

```js
expandMatrix({ matrix: { os: ['ubuntu', 'windows'], node: [16, 18] }, include: [{ os: 'ubuntu', experimental: true }] });
// ubuntu/16 and ubuntu/18 get experimental: true
```

%% worked
**A similar problem, solved: `product(axes)`** — grow the list axis by axis, so the **first axis varies slowest**.

```js
function product(axes) {
  const entries = Object.entries(axes);
  if (entries.length === 0) return [];                              // ① no axes: nothing to combine
  return entries.reduce(
    (combos, [name, values]) => combos.flatMap((combo) => values.map((v) => ({ ...combo, [name]: v }))),   // ② for every existing combo, one new combo per value
    [{}],                                                           // ③ start from a single empty combination
  );
}
```

`flatMap` over **existing combos outermost** and **new values innermost** is what makes earlier axes change more slowly. For include, compare only on the keys that are **axis names**; everything else is data to attach.

%% explain
- **`product`**, then `filter` out excluded.
- **Include** loop: matches on axis keys, add extras, else push a new combination.
- **Copy** objects so nothing is shared.

%% nudge
- What does an include entry with no axis keys at all match?
- Why is exclude applied before include?

%% starter
```js
export function expandMatrix({ matrix, include = [], exclude = [] }) {
  return [];
}
```

%% tests
```js
describe('expandMatrix', () => {
  const matrix = { os: ['ubuntu', 'windows'], node: [16, 18] };

  it('builds the product, first axis slowest', () => {
    expect(expandMatrix({ matrix })).toEqual([
      { os: 'ubuntu', node: 16 }, { os: 'ubuntu', node: 18 },
      { os: 'windows', node: 16 }, { os: 'windows', node: 18 },
    ]);
  });
  it('returns nothing without axes', () => {
    expect(expandMatrix({ matrix: {} })).toEqual([]);
  });
  it('excludes combinations matching a (possibly partial) entry', () => {
    expect(expandMatrix({ matrix, exclude: [{ os: 'windows', node: 16 }] })).toHaveLength(3);
    const noWindows = expandMatrix({ matrix, exclude: [{ os: 'windows' }] });
    expect(noWindows).toEqual([{ os: 'ubuntu', node: 16 }, { os: 'ubuntu', node: 18 }]);
  });
  it('adds include properties to every matching combination', () => {
    const r = expandMatrix({ matrix, include: [{ os: 'ubuntu', experimental: true }] });
    expect(r).toHaveLength(4);
    expect(r.filter((c) => c.experimental)).toEqual([
      { os: 'ubuntu', node: 16, experimental: true },
      { os: 'ubuntu', node: 18, experimental: true },
    ]);
  });
  it('adds an include with no axis keys to every combination', () => {
    const r = expandMatrix({ matrix, include: [{ coverage: true }] });
    expect(r.every((c) => c.coverage === true)).toBe(true);
    expect(r).toHaveLength(4);
  });
  it('creates a new combination when nothing matches', () => {
    const r = expandMatrix({ matrix, include: [{ os: 'macos', node: 20 }] });
    expect(r).toHaveLength(5);
    expect(r[4]).toEqual({ os: 'macos', node: 20 });
  });
  it('does not overwrite an axis value: a conflicting include becomes new', () => {
    const r = expandMatrix({ matrix, include: [{ os: 'ubuntu', node: 14, legacy: true }] });
    expect(r).toHaveLength(5);
    expect(r[4]).toEqual({ os: 'ubuntu', node: 14, legacy: true });
    expect(r.slice(0, 4).some((c) => 'legacy' in c)).toBe(false);
  });
  it('applies exclude before include', () => {
    const r = expandMatrix({
      matrix,
      exclude: [{ os: 'windows', node: 16 }],
      include: [{ os: 'windows', node: 16, special: true }],
    });
    expect(r).toHaveLength(4);
    expect(r[3]).toEqual({ os: 'windows', node: 16, special: true });
  });
  it('applies includes in order and builds on earlier ones', () => {
    const r = expandMatrix({ matrix: { n: [1] }, include: [{ n: 2 }, { n: 2, extra: 'x' }] });
    expect(r).toEqual([{ n: 1 }, { n: 2, extra: 'x' }]);
  });
  it('with only include and no axes, each entry is its own combination', () => {
    expect(expandMatrix({ matrix: {}, include: [{ a: 1 }, { b: 2 }] })).toEqual([{ a: 1 }, { b: 2 }]);
  });
  it('does not change its inputs', () => {
    const inc = [{ os: 'ubuntu', tag: 't' }];
    const copy = JSON.parse(JSON.stringify({ matrix, inc }));
    expandMatrix({ matrix, include: inc });
    expect({ matrix, inc }).toEqual(copy);
  });
});
```

%% hints
- `product` as in the worked example; `[]` when there are no axes.
- `matches = (combo, entry) => Object.keys(entry).every((k) => !(k in matrix) || combo[k] === entry[k])`.
- For includes: `const hits = combos.filter((c) => matches(c, entry))`; if none push `{ ...entry }`, else assign the non-axis keys to each hit.

%% solution
```js
export function expandMatrix({ matrix, include = [], exclude = [] }) {
  const entries = Object.entries(matrix);
  let combos = entries.length === 0
    ? []
    : entries.reduce(
        (acc, [name, values]) => acc.flatMap((combo) => values.map((v) => ({ ...combo, [name]: v }))),
        [{}],
      );

  if (entries.length === 0) return include.map((entry) => ({ ...entry }));

  combos = combos.filter((combo) => !exclude.some((rule) => Object.keys(rule).every((k) => combo[k] === rule[k])));

  for (const entry of include) {
    const hits = combos.filter((combo) => Object.keys(entry).every((k) => !(k in matrix) || combo[k] === entry[k]));
    if (hits.length === 0) {
      combos.push({ ...entry });
      continue;
    }
    for (const combo of hits) {
      for (const k of Object.keys(entry)) {
        if (!(k in matrix)) combo[k] = entry[k];
      }
    }
  }
  return combos;
}
```

%% exercise gx-scheduler | Schedule a pipeline | 4 | js | js | schedule | 55
`schedule({ jobs, maxParallel = Infinity, failFast = false })` simulates a run. `jobs` maps an id to `{ needs, duration, fails, always }` (`needs` default `[]`, `duration` a number, `fails` makes the job end as a failure, `always` means "run even when a need did not succeed"). Declaration order is the object's key order.

**Validate first**: an unknown need throws `Error('unknown job: X (needed by Y)')`; a dependency cycle throws `Error('cycle detected')`.

**Simulate** with time `t = 0`, repeating until every job is settled:

1. A pending job is **settled-ready** when all its needs have settled (success, failure or skipped). If all needs **succeeded** it is **ready**. If some need did not succeed and the job is **not** `always`, it becomes `skipped` (start and end `null`) at once; repeat this check until nothing changes (skips cascade). An `always` job is ready as soon as its needs have settled, whatever their outcome.
2. With `failFast`, once any job has **failed**, every pending job that is not `always` is skipped too (jobs already running finish normally).
3. Start ready jobs **in declaration order** while fewer than `maxParallel` are running: `start = t`, `end = t + duration`.
4. If nothing is running, stop. Otherwise jump `t` to the earliest running `end` and finish every running job ending then, in declaration order: `'failure'` if `fails`, else `'success'`.

Return `{ total, jobs }`: `total` is the largest `end` of any job that ran (`0` if none) and `jobs[id]` is `{ status, start, end }`.

```js
schedule({ jobs: { lint: { duration: 2 }, test: { duration: 5 }, deploy: { duration: 1, needs: ['lint', 'test'] } } }).total; // 6
```

%% worked
**A similar problem, solved: `runTasks(tasks, slots)`** — advance a clock to the **next completion**, start whatever is allowed, repeat.

```js
function runTasks(tasks, slots) {                       // tasks: { id: { after: [...], ms } }
  const done = new Set(), running = [], finished = {};
  let t = 0;
  while (done.size < Object.keys(tasks).length) {
    for (const id of Object.keys(tasks)) {              // ① declaration order decides who gets a free slot
      if (running.length >= slots) break;
      const ready = !done.has(id) && !running.some((r) => r.id === id) && (tasks[id].after ?? []).every((d) => done.has(d));
      if (ready) running.push({ id, end: t + tasks[id].ms });
    }
    const next = Math.min(...running.map((r) => r.end));    // ② jump straight to the next event; no ticking
    t = next;
    for (const r of running.filter((x) => x.end === t)) { done.add(r.id); finished[r.id] = { start: r.end - tasks[r.id].ms, end: t }; }
    running.splice(0, running.length, ...running.filter((x) => x.end !== t));
  }
  return finished;
}
```

A **discrete-event** simulation never counts seconds: it jumps from event to event. Your version adds **statuses** (skip cascades, `always`, `failFast`) and **validation**.

%% explain
- **Validate** needs and cycles first.
- **Loop**: settle/skip, fail-fast, start, advance, complete.
- **Result** per job with status, start and end.

%% nudge
- What makes a skipped job count as "settled" for the jobs that need it?
- When does an `always` job become ready?

%% starter
```js
export function schedule({ jobs, maxParallel = Infinity, failFast = false }) {
  return { total: 0, jobs: {} };
}
```

%% tests
```js
describe('schedule', () => {
  const pipeline = () => ({
    lint: { duration: 2 },
    test: { duration: 5 },
    build: { duration: 3, needs: ['lint'] },
    deploy: { duration: 1, needs: ['test', 'build'] },
  });

  it('runs independent jobs in parallel and waits for needs', () => {
    const r = schedule({ jobs: pipeline() });
    expect(r.total).toBe(6);
    expect(r.jobs.lint).toEqual({ status: 'success', start: 0, end: 2 });
    expect(r.jobs.test).toEqual({ status: 'success', start: 0, end: 5 });
    expect(r.jobs.build).toEqual({ status: 'success', start: 2, end: 5 });
    expect(r.jobs.deploy).toEqual({ status: 'success', start: 5, end: 6 });
  });
  it('limits parallelism and starts in declaration order', () => {
    const r = schedule({ jobs: pipeline(), maxParallel: 1 });
    expect(r.total).toBe(11);
    expect(r.jobs.lint).toMatchObject({ start: 0, end: 2 });
    expect(r.jobs.test).toMatchObject({ start: 2, end: 7 });
    expect(r.jobs.build).toMatchObject({ start: 7, end: 10 });
    expect(r.jobs.deploy).toMatchObject({ start: 10, end: 11 });
    expect(schedule({ jobs: pipeline(), maxParallel: 2 }).total).toBe(6);
  });
  it('skips jobs whose needs failed, and cascades', () => {
    const jobs = pipeline();
    jobs.test.fails = true;
    jobs.notify = { duration: 1, needs: ['deploy'] };
    const r = schedule({ jobs });
    expect(r.jobs.test.status).toBe('failure');
    expect(r.jobs.build.status).toBe('success');
    expect(r.jobs.deploy).toEqual({ status: 'skipped', start: null, end: null });
    expect(r.jobs.notify).toEqual({ status: 'skipped', start: null, end: null });
    expect(r.total).toBe(5);
  });
  it('runs always jobs even when their needs failed or were skipped', () => {
    const jobs = pipeline();
    jobs.test.fails = true;
    jobs.notify = { duration: 1, needs: ['deploy'], always: true };
    const r = schedule({ jobs });
    expect(r.jobs.deploy.status).toBe('skipped');
    expect(r.jobs.notify.status).toBe('success');
    expect(r.jobs.notify.start).toBe(5);
    expect(r.total).toBe(6);
  });
  it('lets an always job wait for its needs to settle first', () => {
    const jobs = { slow: { duration: 4 }, cleanup: { duration: 1, needs: ['slow'], always: true } };
    expect(schedule({ jobs }).jobs.cleanup).toMatchObject({ start: 4, end: 5 });
  });
  it('fail-fast skips jobs that have not started, but lets running jobs finish', () => {
    const jobs = { a: { duration: 2, fails: true }, b: { duration: 5 }, c: { duration: 1, needs: ['b'] }, d: { duration: 1 } };
    const r = schedule({ jobs, failFast: true, maxParallel: 2 });
    expect(r.jobs.a.status).toBe('failure');
    expect(r.jobs.b.status).toBe('success');
    expect(r.jobs.c.status).toBe('skipped');
    expect(r.jobs.d.status).toBe('skipped');
    expect(r.total).toBe(5);
    const without = schedule({ jobs, maxParallel: 2 });
    expect(without.jobs.c.status).toBe('success');
    expect(without.jobs.d.status).toBe('success');
  });
  it('fail-fast still runs always jobs', () => {
    const jobs = { a: { duration: 1, fails: true }, b: { duration: 1, needs: ['a'] }, report: { duration: 1, needs: ['b'], always: true } };
    const r = schedule({ jobs, failFast: true });
    expect(r.jobs.report.status).toBe('success');
  });
  it('handles zero-length jobs and an empty pipeline', () => {
    const r = schedule({ jobs: { a: { duration: 0 }, b: { duration: 3, needs: ['a'] } } });
    expect(r.jobs.b).toMatchObject({ start: 0, end: 3 });
    expect(schedule({ jobs: {} })).toEqual({ total: 0, jobs: {} });
  });
  it('rejects unknown needs and cycles', () => {
    expect(() => schedule({ jobs: { a: { duration: 1, needs: ['ghost'] } } })).toThrow('unknown job: ghost (needed by a)');
    expect(() => schedule({ jobs: { a: { duration: 1, needs: ['b'] }, b: { duration: 1, needs: ['a'] } } })).toThrow('cycle detected');
    expect(() => schedule({ jobs: { a: { duration: 1, needs: ['a'] } } })).toThrow('cycle detected');
  });
  it('does not change its input', () => {
    const jobs = pipeline();
    const copy = JSON.parse(JSON.stringify(jobs));
    schedule({ jobs, maxParallel: 1 });
    expect(jobs).toEqual(copy);
  });
});
```

%% hints
- Statuses: `'pending'`, `'running'`, `'success'`, `'failure'`, `'skipped'`.
- A job is settled when its status is `success`, `failure` or `skipped`.
- Skip loop: repeat until no change; then fail-fast skipping; then start jobs; then advance the clock.
- Cycle detection: DFS with "visiting" and "done" marks.

%% solution
```js
export function schedule({ jobs, maxParallel = Infinity, failFast = false }) {
  const ids = Object.keys(jobs);
  const needsOf = (id) => jobs[id].needs ?? [];
  for (const id of ids) {
    for (const need of needsOf(id)) {
      if (!Object.prototype.hasOwnProperty.call(jobs, need)) throw new Error(`unknown job: ${need} (needed by ${id})`);
    }
  }
  const mark = {};
  const visit = (id) => {
    if (mark[id] === 2) return;
    if (mark[id] === 1) throw new Error('cycle detected');
    mark[id] = 1;
    for (const need of needsOf(id)) visit(need);
    mark[id] = 2;
  };
  ids.forEach(visit);

  const result = {};
  for (const id of ids) result[id] = { status: 'pending', start: null, end: null };
  const settled = (id) => ['success', 'failure', 'skipped'].includes(result[id].status);
  let t = 0;
  let failed = false;

  while (ids.some((id) => result[id].status === 'pending' || result[id].status === 'running')) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of ids) {
        if (result[id].status !== 'pending' || jobs[id].always) continue;
        const needs = needsOf(id);
        const bad = needs.some((n) => settled(n) && result[n].status !== 'success');
        if ((needs.every(settled) && bad) || (failFast && failed)) {
          result[id].status = 'skipped';
          changed = true;
        }
      }
    }

    for (const id of ids) {
      if (result[id].status !== 'pending') continue;
      const running = ids.filter((x) => result[x].status === 'running').length;
      if (running >= maxParallel) break;
      const needs = needsOf(id);
      if (!needs.every(settled)) continue;
      if (!jobs[id].always && !needs.every((n) => result[n].status === 'success')) continue;
      result[id] = { status: 'running', start: t, end: t + jobs[id].duration };
    }

    const running = ids.filter((id) => result[id].status === 'running');
    if (running.length === 0) break;
    t = Math.min(...running.map((id) => result[id].end));
    for (const id of running) {
      if (result[id].end === t) {
        result[id].status = jobs[id].fails ? 'failure' : 'success';
        if (jobs[id].fails) failed = true;
      }
    }
  }

  const ends = ids.filter((id) => result[id].end !== null).map((id) => result[id].end);
  return { total: ends.length ? Math.max(...ends) : 0, jobs: result };
}
```

%% exercise gx-triggers | Trigger and path filters | 3 | js | js | shouldRun | 36
`shouldRun(on, event)` decides whether a workflow starts. The event is `{ type, branch, files }` (`files` is the list of changed paths). `on` is one of: a string (`'push'`), an array of event names, or an object mapping event names to **filters** (`null` or `{}` means no filters).

- The event `type` must be named in `on` (as the string, an array member, or a key of the object).
- For an object, apply the filters of `on[type]`; **all** must pass:
  - `branches`: the event branch matches **at least one** pattern; `branches-ignore`: it matches **none**.
  - `paths`: **at least one** changed file matches a pattern (an empty file list fails); `paths-ignore`: at least one changed file does **not** match any pattern, or there are **no files** at all.
- Patterns are globs matching the **whole** string: `*` matches any characters except `/`, `**` matches anything including `/`, `?` one character except `/`. So `feature/*` matches `feature/a` but not `feature/a/b`, while `feature/**` matches both.

```js
shouldRun({ push: { branches: ['main'], paths: ['src/**'] } }, { type: 'push', branch: 'main', files: ['src/a.js'] }); // true
```

%% worked
**A similar problem, solved: `matchesAny(patterns, text)`** — a small glob converter and an "any pattern" helper.

```js
function matchesAny(patterns, text) {
  const toRegExp = (g) => new RegExp('^' + g
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')       // ① escape characters that are special in a regex
    .replace(/\*\*/g, '\u0000')                   // ② protect '**' while handling '*'
    .replace(/\*/g, '[^/]*')                      // ③ '*' stays inside one path segment
    .replace(/\u0000/g, '.*')                     // ④ '**' crosses directories
    .replace(/\?/g, '[^/]') + '$');
  return patterns.some((p) => toRegExp(p).test(text));
}
```

The **order of replacements** matters: handle `**` before `*`, or `**` becomes two single stars. Then each filter is a few lines of `some` / `every` over the files.

%% explain
- **Normalise** `on` to "is this event listed, and what filters apply".
- **Glob helper** for branches and paths.
- **Four filters**, all must pass.

%% nudge
- What does `paths-ignore` do when every changed file matches?
- Does `docs/*` match `docs/a/b.md`?

%% starter
```js
export function shouldRun(on, event) {
  return true;
}
```

%% tests
```js
describe('shouldRun', () => {
  const push = (branch, files = []) => ({ type: 'push', branch, files });

  it('matches by event name for strings and arrays', () => {
    expect(shouldRun('push', push('main'))).toBe(true);
    expect(shouldRun('pull_request', push('main'))).toBe(false);
    expect(shouldRun(['push', 'schedule'], push('main'))).toBe(true);
    expect(shouldRun(['schedule'], push('main'))).toBe(false);
  });
  it('treats an object key with no filters as always', () => {
    expect(shouldRun({ push: null }, push('x'))).toBe(true);
    expect(shouldRun({ push: {} }, push('x'))).toBe(true);
    expect(shouldRun({ pull_request: {} }, push('x'))).toBe(false);
  });
  it('filters by branch patterns', () => {
    const on = { push: { branches: ['main', 'release/**', 'feature/*'] } };
    expect(shouldRun(on, push('main'))).toBe(true);
    expect(shouldRun(on, push('release/1.x/hotfix'))).toBe(true);
    expect(shouldRun(on, push('feature/login'))).toBe(true);
    expect(shouldRun(on, push('feature/login/deep'))).toBe(false);
    expect(shouldRun(on, push('other'))).toBe(false);
  });
  it('ignores branches', () => {
    const on = { push: { 'branches-ignore': ['docs/**', 'wip'] } };
    expect(shouldRun(on, push('docs/a/b'))).toBe(false);
    expect(shouldRun(on, push('wip'))).toBe(false);
    expect(shouldRun(on, push('main'))).toBe(true);
  });
  it('requires a changed file to match paths', () => {
    const on = { push: { paths: ['src/**', '*.md'] } };
    expect(shouldRun(on, push('main', ['src/a/b.js']))).toBe(true);
    expect(shouldRun(on, push('main', ['README.md']))).toBe(true);
    expect(shouldRun(on, push('main', ['docs/README.md']))).toBe(false);
    expect(shouldRun(on, push('main', ['lib/x.js', 'src/y.js']))).toBe(true);
    expect(shouldRun(on, push('main', ['lib/x.js']))).toBe(false);
    expect(shouldRun(on, push('main', []))).toBe(false);
  });
  it('skips when every changed file is in paths-ignore', () => {
    const on = { push: { 'paths-ignore': ['docs/**', '*.md'] } };
    expect(shouldRun(on, push('main', ['docs/a.md', 'README.md']))).toBe(false);
    expect(shouldRun(on, push('main', ['docs/a.md', 'src/a.js']))).toBe(true);
    expect(shouldRun(on, push('main', []))).toBe(true);
  });
  it('needs both branch and path filters to pass', () => {
    const on = { push: { branches: ['main'], paths: ['src/**'] } };
    expect(shouldRun(on, push('main', ['src/a.js']))).toBe(true);
    expect(shouldRun(on, push('dev', ['src/a.js']))).toBe(false);
    expect(shouldRun(on, push('main', ['lib/a.js']))).toBe(false);
  });
  it('uses the filters of the matching event only', () => {
    const on = { push: { branches: ['main'] }, pull_request: { branches: ['dev'] } };
    expect(shouldRun(on, { type: 'pull_request', branch: 'dev', files: [] })).toBe(true);
    expect(shouldRun(on, { type: 'pull_request', branch: 'main', files: [] })).toBe(false);
  });
  it('escapes dots and supports ?', () => {
    expect(shouldRun({ push: { paths: ['a.b'] } }, push('m', ['aXb']))).toBe(false);
    expect(shouldRun({ push: { paths: ['file?.js'] } }, push('m', ['file1.js']))).toBe(true);
    expect(shouldRun({ push: { paths: ['file?.js'] } }, push('m', ['file/.js']))).toBe(false);
  });
});
```

%% hints
- `globToRegExp` as in the worked example; test the **whole** string with `^...$`.
- Event listed: string equality, `Array.includes`, or `type in on`.
- `paths-ignore`: `files.length === 0 || files.some((f) => !ignore.some((p) => match(p, f)))`.

%% solution
```js
const globToRegExp = (glob) =>
  new RegExp(
    '^' +
      glob
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\u0000/g, '.*')
        .replace(/\?/g, '[^/]') +
      '$',
  );
const matches = (patterns, text) => patterns.some((p) => globToRegExp(p).test(text));

export function shouldRun(on, event) {
  const { type, branch, files = [] } = event;
  let filters = {};
  if (typeof on === 'string') {
    if (on !== type) return false;
  } else if (Array.isArray(on)) {
    if (!on.includes(type)) return false;
  } else {
    if (!Object.prototype.hasOwnProperty.call(on, type)) return false;
    filters = on[type] ?? {};
  }

  if (filters.branches && !matches(filters.branches, branch)) return false;
  if (filters['branches-ignore'] && matches(filters['branches-ignore'], branch)) return false;
  if (filters.paths && !files.some((f) => matches(filters.paths, f))) return false;
  if (filters['paths-ignore'] && files.length > 0 && !files.some((f) => !matches(filters['paths-ignore'], f))) return false;
  return true;
}
```

%% exercise gx-cache | Cache keys and restore keys | 3 | js | js | hashFiles, resolveCache | 30
Two helpers for dependency caching.

`hashFiles(contents)` takes a list of file contents (strings) and returns a **16-character hex** hash of them: the **same list gives the same hash**, any change to any content, their order or their number gives a different one (join the contents with a separator that is unlikely to appear, then use two 32-bit FNV-1a passes with different seeds, or any similar deterministic hash).

`resolveCache(entries, { key, restoreKeys = [] })` looks in the stored caches (`entries` is a list of `{ key, createdAt }`) and returns `{ hit, key, shouldSave }`:

- An entry whose `key` **equals** the requested key: `hit: 'exact'`, `key` is that key.
- Otherwise, for each restore key **in order**: if any entry's key **starts with** it, take the entry with the **greatest `createdAt`** (a later entry wins a tie) and return `hit: 'restore'` with that entry's key. The first restore key that has any match decides.
- Otherwise `hit: 'miss'` and `key: null`.
- `shouldSave` is `true` unless the hit was exact.

```js
resolveCache([{ key: 'npm-v1', createdAt: 1 }], { key: 'npm-v2', restoreKeys: ['npm-'] }); // { hit: 'restore', key: 'npm-v1', shouldSave: true }
```

%% worked
**A similar problem, solved: `latestWithPrefix(items, prefix)`** — the **newest** item among those that match a prefix.

```js
function latestWithPrefix(items, prefix) {
  let best = null;
  for (const item of items) {
    if (!item.key.startsWith(prefix)) continue;                   // ① only candidates
    if (best === null || item.createdAt >= best.createdAt) best = item;   // ② `>=` so a later entry wins a tie
  }
  return best;
}
```

Restore keys are tried **in order of specificity** (most specific first), and the **first** one that matches anything decides, even if a later, broader key would match a **newer** entry.

%% explain
- **`hashFiles`**: join, hash twice, 16 hex.
- **Exact** first, then prefixes in order, newest wins.
- **`shouldSave`** false only for exact.

%% nudge
- Why try restore keys in the given order instead of picking the newest overall?

%% starter
```js
export function hashFiles(contents) {
  return '0000000000000000';
}

export function resolveCache(entries, { key, restoreKeys = [] }) {
  return { hit: 'miss', key: null, shouldSave: true };
}
```

%% tests
```js
describe('hashFiles', () => {
  it('returns 16 hex characters', () => {
    expect(hashFiles(['a'])).toMatch(/^[0-9a-f]{16}$/);
    expect(hashFiles([])).toMatch(/^[0-9a-f]{16}$/);
  });
  it('is deterministic', () => {
    expect(hashFiles(['lock v1', 'other'])).toBe(hashFiles(['lock v1', 'other']));
  });
  it('changes with content, order and count', () => {
    const base = hashFiles(['one', 'two']);
    expect(hashFiles(['one', 'twp'])).not.toBe(base);
    expect(hashFiles(['two', 'one'])).not.toBe(base);
    expect(hashFiles(['one'])).not.toBe(base);
    expect(hashFiles(['onetwo'])).not.toBe(base);
    expect(hashFiles(['one', 'two', ''])).not.toBe(base);
  });
});

describe('resolveCache', () => {
  const entries = [
    { key: 'linux-npm-aaa', createdAt: 10 },
    { key: 'linux-npm-bbb', createdAt: 30 },
    { key: 'linux-pip-ccc', createdAt: 50 },
    { key: 'mac-npm-aaa', createdAt: 5 },
  ];
  it('finds an exact match and does not need saving', () => {
    expect(resolveCache(entries, { key: 'linux-npm-aaa' })).toEqual({ hit: 'exact', key: 'linux-npm-aaa', shouldSave: false });
  });
  it('prefers an exact match over restore keys', () => {
    expect(resolveCache(entries, { key: 'linux-npm-aaa', restoreKeys: ['linux-npm-'] }).hit).toBe('exact');
  });
  it('restores the newest entry matching a restore key, and saves a new cache', () => {
    expect(resolveCache(entries, { key: 'linux-npm-zzz', restoreKeys: ['linux-npm-'] })).toEqual({
      hit: 'restore', key: 'linux-npm-bbb', shouldSave: true,
    });
  });
  it('tries restore keys in order: the first with any match wins', () => {
    const r = resolveCache(entries, { key: 'x', restoreKeys: ['linux-npm-aaa', 'linux-'] });
    expect(r).toMatchObject({ hit: 'restore', key: 'linux-npm-aaa' });
    const r2 = resolveCache(entries, { key: 'x', restoreKeys: ['nothing-', 'linux-'] });
    expect(r2.key).toBe('linux-pip-ccc');
  });
  it('lets a later entry win a createdAt tie', () => {
    const tie = [{ key: 'a-1', createdAt: 5 }, { key: 'a-2', createdAt: 5 }];
    expect(resolveCache(tie, { key: 'x', restoreKeys: ['a-'] }).key).toBe('a-2');
  });
  it('misses when nothing matches', () => {
    expect(resolveCache(entries, { key: 'windows-npm-aaa', restoreKeys: ['windows-'] })).toEqual({ hit: 'miss', key: null, shouldSave: true });
    expect(resolveCache([], { key: 'k' })).toEqual({ hit: 'miss', key: null, shouldSave: true });
  });
});
```

%% hints
- FNV-1a: `h ^= code; h = Math.imul(h, 0x01000193) >>> 0;` with two seeds, `toString(16).padStart(8, '0')`.
- Join with `'\u0000'` so `['onetwo']` differs from `['one','two']`.
- Track the best match with `>=` on `createdAt`.

%% solution
```js
export function hashFiles(contents) {
  const text = contents.length + '\u0001' + contents.join('\u0000');
  const fnv = (seed) => {
    let h = seed;
    for (const ch of text) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return fnv(0x811c9dc5) + fnv(0x01234567);
}

export function resolveCache(entries, { key, restoreKeys = [] }) {
  const exact = entries.find((e) => e.key === key);
  if (exact) return { hit: 'exact', key: exact.key, shouldSave: false };
  for (const prefix of restoreKeys) {
    let best = null;
    for (const e of entries) {
      if (!e.key.startsWith(prefix)) continue;
      if (best === null || e.createdAt >= best.createdAt) best = e;
    }
    if (best) return { hit: 'restore', key: best.key, shouldSave: true };
  }
  return { hit: 'miss', key: null, shouldSave: true };
}
```

%% exercise gx-check-scheduler | Tests for a pipeline scheduler | 4 | js | js | checkScheduler | 45
`schedule({ jobs, maxParallel, failFast })` simulates a pipeline: a job starts when all its `needs` **succeeded** and a runner is free (declaration order breaks ties); a job whose need failed or was skipped is **skipped** unless it is `always`; `total` is the **latest end time** (not the sum of durations); cycles throw `Error('cycle detected')`. It returns `{ total, jobs: { id: { status, start, end } } }`. You are given `checkScheduler(schedule)`. Write a check that passes for a correct scheduler and **fails** for one that: **starts a job before its needs have finished**, **ignores maxParallel**, **runs jobs whose needs failed**, **skips always jobs when a need failed**, **reports the sum of durations as the total**, **does not detect cycles**.

```js
const r = schedule({ jobs: { a: { duration: 2 }, b: { duration: 3, needs: ['a'] } } });
expect(r.jobs.b.start).toBe(2);
```

%% worked
**A similar problem, solved: `checkRunTasks(runTasks)`** — a **small graph** designed so that each wrong rule gives a **different number**.

```js
export function checkRunTasks(runTasks) {                       // runTasks({ id: { after, ms } }, slots) -> { id: { start, end } }
  const tasks = { a: { ms: 2 }, b: { ms: 5 }, c: { ms: 3, after: ['a'] }, d: { ms: 1, after: ['b', 'c'] } };
  const wide = runTasks(tasks, 4);
  expect(wide.c.start).toBe(2);                                  // ① waits for its dependency (starting at 0 means it ignored `after`)
  expect(wide.d.start).toBe(5);                                  // ② waits for the SLOWER of two dependencies
  const narrow = runTasks(tasks, 1);
  expect(narrow.d.end).toBe(11);                                 // ③ one slot: the durations add up, parallel limit respected
}
```

Choose durations so **no two wrong rules agree**: the critical path (6) differs from the sum (11) and from the longest single job (5). Use one run for **failure** (a skipped downstream, an `always` job still running) and one for **cycles**.

%% explain
- **A diamond graph** with different durations.
- **Wide vs one runner** to see `maxParallel`.
- **Failure scenario** with `always` and a skipped job.
- **Cycle** must throw.

%% nudge
- Why must the critical path differ from the sum of durations in your example?
- How do you tell "ran after a failure" from "was skipped"?

%% starter
```js
export function checkScheduler(schedule) {
  const r = schedule({ jobs: { a: { duration: 2 }, b: { duration: 3, needs: ['a'] } } });
  expect(r.jobs.b.start).toBe(2);
  // your assertions: parallel, limited runners, failure, always, total, cycle
}
```

%% tests
```js
const make = (f = {}) => ({ jobs, maxParallel = Infinity, failFast = false }) => {
  const ids = Object.keys(jobs);
  const needsOf = (id) => jobs[id].needs ?? [];
  if (!f.noCycle) {
    const mark = {};
    const visit = (id) => { if (mark[id] === 2) return; if (mark[id] === 1) throw new Error('cycle detected'); mark[id] = 1; for (const n of needsOf(id)) visit(n); mark[id] = 2; };
    ids.forEach(visit);
  }
  const result = Object.fromEntries(ids.map((id) => [id, { status: 'pending', start: null, end: null }]));
  const settled = (id) => ['success', 'failure', 'skipped'].includes(result[id].status);
  let t = 0;
  let failed = false;
  let guard = 0;
  while (ids.some((id) => result[id].status === 'pending' || result[id].status === 'running') && guard++ < 1000) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of ids) {
        if (result[id].status !== 'pending') continue;
        const always = f.noAlways ? false : jobs[id].always;
        if (always) continue;
        const needs = needsOf(id);
        const bad = needs.some((n) => settled(n) && result[n].status !== 'success');
        if (!f.runAfterFailure && ((needs.every(settled) && bad) || (failFast && failed))) { result[id].status = 'skipped'; changed = true; }
      }
    }
    for (const id of ids) {
      if (result[id].status !== 'pending') continue;
      const running = ids.filter((x) => result[x].status === 'running').length;
      if (!f.noLimit && running >= maxParallel) break;
      const needs = needsOf(id);
      if (!f.noWait && !needs.every(settled)) continue;
      if (!f.noWait && !f.runAfterFailure && !jobs[id].always && !needs.every((n) => result[n].status === 'success')) continue;
      result[id] = { status: 'running', start: t, end: t + jobs[id].duration };
    }
    const running = ids.filter((id) => result[id].status === 'running');
    if (running.length === 0) break;
    t = Math.min(...running.map((id) => result[id].end));
    for (const id of running) if (result[id].end === t) { result[id].status = jobs[id].fails ? 'failure' : 'success'; if (jobs[id].fails) failed = true; }
  }
  const ran = ids.filter((id) => result[id].end !== null);
  const total = f.sumTotal ? ran.reduce((s, id) => s + (result[id].end - result[id].start), 0) : (ran.length ? Math.max(...ran.map((id) => result[id].end)) : 0);
  return { total, jobs: result };
};

const correct = make();
const mutants = {
  'starts a job before its needs have finished': make({ noWait: true }),
  'ignores maxParallel': make({ noLimit: true }),
  'runs jobs whose needs failed': make({ runAfterFailure: true }),
  'skips always jobs when a need failed': make({ noAlways: true }),
  'reports the sum of durations as the total': make({ sumTotal: true }),
  'does not detect cycles': make({ noCycle: true }),
};

describe('your checkScheduler', () => {
  it('passes on a correct scheduler', () => {
    checkScheduler(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a scheduler that ${name}`, () => {
      let caught = false;
      try { checkScheduler(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Diamond: `lint(2)`, `test(5)`, `build(3, needs lint)`, `deploy(1, needs test and build)`; critical path 6, sum 11, longest single job 5.
- `maxParallel: 1` makes deploy end at 11.
- Failure: make `test` fail with `notify` (`always`) needing `deploy`: `deploy` skipped, `notify` success.
- Cycle: `a` needs `b`, `b` needs `a`: expect a throw.

%% solution
```js
export function checkScheduler(schedule) {
  const pipeline = () => ({
    lint: { duration: 2 },
    test: { duration: 5 },
    build: { duration: 3, needs: ['lint'] },
    deploy: { duration: 1, needs: ['test', 'build'] },
  });

  const wide = schedule({ jobs: pipeline() });
  expect(wide.jobs.build.start).toBe(2);
  expect(wide.jobs.deploy.start).toBe(5);
  expect(wide.total).toBe(6);

  const narrow = schedule({ jobs: pipeline(), maxParallel: 1 });
  expect(narrow.total).toBe(11);
  expect(narrow.jobs.test.start).toBe(2);

  const jobs = pipeline();
  jobs.test.fails = true;
  jobs.notify = { duration: 1, needs: ['deploy'], always: true };
  const broken = schedule({ jobs });
  expect(broken.jobs.test.status).toBe('failure');
  expect(broken.jobs.build.status).toBe('success');
  expect(broken.jobs.deploy.status).toBe('skipped');
  expect(broken.jobs.deploy.start).toBeNull();
  expect(broken.jobs.notify.status).toBe('success');

  expect(() => schedule({ jobs: { a: { duration: 1, needs: ['b'] }, b: { duration: 1, needs: ['a'] } } })).toThrow('cycle detected');
}
```
