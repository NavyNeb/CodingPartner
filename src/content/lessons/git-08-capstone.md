---
id: git-capstone
track: git
title: Capstone: designing a pipeline for a real repo
summary: Putting the track together for a monorepo: pick only the jobs a change can affect, find and quarantine flaky tests, measure delivery with the four DORA metrics, and review a pipeline against a checklist.
---

## The idea in one sentence

A good pipeline is a **product**: it must be **fast, trustworthy and cheap to run**, because a slow or flaky pipeline teaches people to ignore it, and an ignored pipeline protects nothing.

> **Analogy** A smoke detector. It only works if it goes off for real fires, stays quiet otherwise, and is cheap enough that nobody pulls out the battery. Too many false alarms (flaky tests) or too slow a response (a 40-minute pipeline) and people disable it.

*(In Actions: `on.push.paths`, a "changes" job with `dorny/paths-filter`, `needs`, required checks, test retries and quarantine labels. The logic below is what those features implement.)*

## A reference pipeline

| Stage | Purpose | Notes |
| --- | --- | --- |
| **Cheap checks** | format, lint, types | seconds; fail fast before spending runners |
| **Tests** | unit, then integration | shard slow suites; cache dependencies |
| **Build** | one artifact per commit | build **once**, deploy the **same** artifact everywhere |
| **Preview / staging** | deploy and smoke-test | environment gate for production |
| **Release** | canary or flag-guarded rollout | metrics decide, rollback ready |

Put the **fastest, most likely to fail** checks first, run independent ones in **parallel**, and keep the **required** checks few and reliable.

## Monorepos: run only what a change can affect

![Affected jobs](fig:gt-affected "Path filters pick jobs; needs pulls in dependents and prerequisites.")

In a monorepo most pushes touch one package. Running every job wastes runners and time. The planner works in three steps:

1. **Direct**: jobs whose **path filters** match a changed file (a job with **no filter** always runs, such as a dependency audit).
2. **Downstream**: jobs that **need** a selected job must run too, because their input changed.
3. **Upstream**: the **needs** of any selected job must run too, or the job would be **skipped** for lack of its prerequisite.

The filter language is a **glob**: `*` matches within one folder, `**` matches across folders.

```js try predict
const toRegex = (glob) => {
  const src = glob
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '(?:.*/)?');
  return new RegExp(`^${src}$`);
};

console.log(
  toRegex('src/**/*.ts').test('src/x.ts'),
  toRegex('src/**/*.ts').test('src/a/b/x.ts'),
  toRegex('docs/*.md').test('docs/a/b.md'),
);
```

```stepper Planning a monorepo run
code:
  changed: web/a.ts
  direct: lintWeb, buildWeb, audit
  downstream: e2e, deployWeb
  upstream: nothing new
  run in declaration order
---
line: 1
say: One file changed, under `web/`.
phase: input
---
line: 2
say: Path filters select `lintWeb` and `buildWeb`; `audit` has **no filter**, so it always runs.
phase: direct
---
line: 3
say: `e2e` needs `buildWeb`, and `deployWeb` needs `e2e`, so both are pulled in **downstream**.
phase: downstream
---
line: 4
say: Every `needs` of a selected job is already selected, so nothing is added **upstream**. Had `deployWeb` also needed `buildApi`, that job would run too, or `deployWeb` would be skipped.
phase: upstream
---
line: 5
say: The plan is returned in the **order the jobs were declared**, so output is stable and easy to compare.
phase: result
```

## Flaky tests

![Flaky tests](fig:gt-flaky "Same commit, different result: the test is at fault.")

A **flaky** test sometimes passes and sometimes fails **with no code change**. Causes: shared state, real clocks, network, ordering, race conditions. The evidence is simple: **the same commit** produced **both outcomes**. A test that fails on every run is **broken**, not flaky; a test that fails on one commit and passes on the next was an ordinary regression.

Never "just rerun it" as a habit: **quarantine** the flaky test (it still runs and is reported, but does not block merges), give it an **owner and a deadline**, and fix the cause (fake timers, isolated state, awaited promises). Retries hide the problem; use them sparingly and **report** retried passes.

## Measuring delivery: the four DORA metrics

![DORA metrics](fig:gt-dora "Two measure speed, two measure stability.")

| Metric | Question it answers |
| --- | --- |
| **Deployment frequency** | how often do we ship to production? |
| **Lead time for changes** | how long from commit to running in production? |
| **Change failure rate** | what share of deploys cause a failure that needs a fix or rollback? |
| **Time to restore** | how long from the failure to a healthy service? |

Speed and stability **move together** in good teams: small, frequent, automated releases are easier to test and to undo. Report **medians** (one slow outlier should not hide the typical case), and treat the numbers as **feedback for the team**, never as a ranking of people.

## A pipeline review checklist

- Required checks are **few, fast and reliable**; everything else is advisory.
- **Cheap checks first**, independent jobs in parallel, slow suites sharded.
- Same artifact promoted through environments; **no rebuilds** per environment.
- **Least-privilege** permissions, pinned actions, OIDC instead of stored keys.
- **Concurrency** groups: cancel stale checks, queue deployments.
- A **rollback path** that is tested, and release metrics that can trigger it.
- Flaky tests tracked, owned and quarantined; DORA numbers reviewed regularly.

## Quick check

```check
Q: A monorepo job has no `paths` filter at all. For a change that touches only docs, what happens to it?
A) It is skipped
B) It always runs *
C) It runs only if its needs ran
D) It runs only on main
Why: No filter means it is not restricted by changed files, so it always runs (a dependency audit, for example).
---
Q: Job `deploy` needs `build`, and `build` is selected by a path filter. What about `deploy`?
A) Skipped, since its own paths did not match
B) It runs too, because it needs an affected job *
C) It runs only on release
D) Undefined
Why: Anything downstream of an affected job has changed input and must run.
---
Q: The same test passes and fails on commit abc123. What is it?
A) Broken
B) Flaky *
C) Fixed
D) Slow
Why: The code did not change between the runs, so the difference comes from the test or its environment.
---
Q: Why report the median lead time instead of the average?
A) It is easier to compute
B) One extreme outlier does not distort it *
C) It is always smaller
D) DORA forbids averages
Why: A single week-long change would drag an average up and hide the typical experience.
```

## Recap

- A pipeline must be **fast, trustworthy and cheap**: cheap checks first, parallel jobs, build once, promote the artifact.
- **Monorepo planning**: path filters pick jobs, **downstream** dependents and **upstream** prerequisites join, **no-filter** jobs always run; globs use `*` and `**`.
- **Flaky** = both outcomes on the **same commit**; **broken** = always fails; **quarantine** with an owner, fix the cause.
- **DORA**: deployment frequency, lead time, change failure rate, time to restore; use **medians**, treat as team feedback.
- Review the whole system against a **checklist**: permissions, pins, concurrency, rollback, flaky debt.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: deployment frequency | Dividing a count by a time window |
| Affected jobs | Glob matching and a fixpoint over the `needs` graph |
| Flaky tests | Grouping runs by test and commit |
| DORA metrics | Medians and guarded divisions |
| Tests for the affected-jobs planner | Small graphs where each missing rule changes the result |

%% exercise gx-guided-frequency | Guided: deployment frequency | 1 | js | js | deploymentFrequency | 8 | guided
Implement `deploymentFrequency(deploys, days)`: the **number of deploys per day** over a window of `days` days. A window of `0` days or less gives `0` (never divide by zero).

```js
deploymentFrequency([{}, {}, {}, {}], 10); // 0.4
```

%% worked
**A similar problem, solved: `messagesPerHour(messages, hours)`** — a count over a window, with the empty window handled first.

```js
function messagesPerHour(messages, hours) {
  if (hours <= 0) return 0;              // ① a window of zero (or negative) length has no rate
  return messages.length / hours;        // ② count divided by the window
}
```

A rate is only meaningful over a **positive window**.

%% explain
- **Count / days.**
- **Guard** the non-positive window.

%% nudge
- What would `4 / 0` return, and why is that a poor answer here?

%% starter
```js
export function deploymentFrequency(deploys, days) {
  return 0;
}
```

%% tests
```js
describe('deploymentFrequency', () => {
  it('divides the count by the window', () => {
    expect(deploymentFrequency([{}, {}, {}, {}], 10)).toBe(0.4);
    expect(deploymentFrequency(new Array(21).fill({}), 7)).toBe(3);
  });
  it('is zero with no deploys', () => {
    expect(deploymentFrequency([], 30)).toBe(0);
  });
  it('is zero for a window that is not positive', () => {
    expect(deploymentFrequency([{}, {}], 0)).toBe(0);
    expect(deploymentFrequency([{}, {}], -3)).toBe(0);
  });
});
```

%% hints
- `if (days <= 0) return 0;` then `deploys.length / days`.

%% solution
```js
export function deploymentFrequency(deploys, days) {
  if (days <= 0) return 0;
  return deploys.length / days;
}
```

%% exercise gx-affected | Affected jobs planner | 4 | js | js | affectedJobs | 45
`affectedJobs({ jobs, changed })` returns the ids of the jobs that must run for a change. `jobs` maps an id to `{ paths?, needs? }` and `changed` is a list of changed file paths.

1. **Direct**: a job with **no `paths`** always runs; a job with `paths` runs when **any** pattern matches **any** changed file (an empty `paths` list never matches).
2. **Downstream**: add every job that **needs** a selected job, repeatedly, until nothing new is added.
3. **Upstream**: then add every job that a selected job **needs**, repeatedly (unknown ids are ignored).

Return the ids **in the order they appear in `jobs`**.

Patterns are globs matched against the whole path: `*` matches any characters **except `/`**, `**/` matches **zero or more folders**, a bare `**` matches anything, everything else is literal.

```js
affectedJobs({ jobs: { lint: { paths: ['web/**'] }, e2e: { needs: ['lint'], paths: ['e2e/**'] } }, changed: ['web/a.ts'] });
// ['lint', 'e2e']
```

%% worked
**A similar problem, solved: `rebuildSet(files, changed)`** — grow a set until it stops changing.

```js
function rebuildSet(files, changed) {            // files: { name: { imports: [...] } }
  const set = new Set(changed);                  // ① start with what changed directly
  let grew = true;
  while (grew) {                                  // ② repeat until nothing new is added (a fixpoint)
    grew = false;
    for (const [name, file] of Object.entries(files)) {
      if (!set.has(name) && (file.imports ?? []).some((i) => set.has(i))) {
        set.add(name);                            // ③ a file importing a changed file is itself affected
        grew = true;
      }
    }
  }
  return Object.keys(files).filter((n) => set.has(n));   // ④ report in declaration order
}
```

Do the downstream growth and the upstream growth as **two separate loops**.

%% explain
- **Glob to regex** with `**/` handled before `*`.
- **Fixpoint loops**, one downstream and one upstream.
- **Declaration order** for the result.

%% nudge
- Why must the downstream step finish before the upstream step starts?
- How do you make `src/**/*.ts` match `src/x.ts` as well as `src/a/b/x.ts`?

%% starter
```js
export function affectedJobs({ jobs, changed }) {
  return Object.keys(jobs);
}
```

%% tests
```js
const jobs = {
  lintWeb: { paths: ['web/**'] },
  lintApi: { paths: ['api/**'] },
  buildWeb: { paths: ['web/**'], needs: ['lintWeb'] },
  buildApi: { paths: ['api/**', 'shared/**'], needs: ['lintApi'] },
  e2e: { paths: ['e2e/**'], needs: ['buildWeb'] },
  deployWeb: { paths: ['infra/web/**'], needs: ['buildWeb', 'e2e'] },
  audit: {},
};
const plan = (changed, j = jobs) => affectedJobs({ jobs: j, changed });

describe('affectedJobs', () => {
  it('selects by path and pulls in downstream jobs', () => {
    expect(plan(['web/a.ts'])).toEqual(['lintWeb', 'buildWeb', 'e2e', 'deployWeb', 'audit']);
  });
  it('does not drag in unrelated packages', () => {
    expect(plan(['api/x.ts'])).toEqual(['lintApi', 'buildApi', 'audit']);
    expect(plan(['shared/util/x.ts'])).toEqual(['lintApi', 'buildApi', 'audit']);
  });
  it('adds the prerequisites of a selected job', () => {
    expect(plan(['infra/web/main.tf'])).toEqual(['lintWeb', 'buildWeb', 'e2e', 'deployWeb', 'audit']);
    expect(plan(['e2e/t.ts'])).toEqual(['lintWeb', 'buildWeb', 'e2e', 'deployWeb', 'audit']);
  });
  it('always runs jobs without paths', () => {
    expect(plan(['README.md'])).toEqual(['audit']);
    expect(plan([])).toEqual(['audit']);
  });
  it('treats an empty paths list as never matching', () => {
    expect(plan(['a.txt'], { a: { paths: [] }, b: {} })).toEqual(['b']);
  });
  it('follows chains in both directions', () => {
    const chain = { a: { paths: ['a/**'] }, b: { needs: ['a'], paths: [] }, c: { needs: ['b'], paths: [] }, d: { paths: ['d/**'], needs: ['c'] }, x: { paths: ['x/**'] } };
    expect(plan(['x/1'], chain)).toEqual(['x']);
    expect(plan(['a/x'], chain)).toEqual(['a', 'b', 'c', 'd']);
    expect(plan(['d/x'], chain)).toEqual(['a', 'b', 'c', 'd']);
  });
  it('ignores unknown needs', () => {
    expect(plan(['a/x'], { a: { paths: ['a/**'], needs: ['ghost'] } })).toEqual(['a']);
  });
  it('matches globs strictly', () => {
    const g = { docs: { paths: ['docs/*.md'] }, src: { paths: ['src/**/*.ts'] }, all: { paths: ['lib/**'] }, dot: { paths: ['a.b'] } };
    expect(plan(['docs/x.md'], g)).toEqual(['docs']);
    expect(plan(['docs/guide/x.md'], g)).toEqual([]);
    expect(plan(['src/x.ts'], g)).toEqual(['src']);
    expect(plan(['src/a/b/x.ts'], g)).toEqual(['src']);
    expect(plan(['src/x.js'], g)).toEqual([]);
    expect(plan(['lib/a/b/c.txt'], g)).toEqual(['all']);
    expect(plan(['axb'], g)).toEqual([]);
    expect(plan(['a.b'], g)).toEqual(['dot']);
  });
});
```

%% hints
- Escape regex characters, then replace `**/`, then `**`, then `*` (use placeholders so later replacements do not touch earlier ones).
- Two `while (grew)` loops over `Object.entries(jobs)`.
- `Object.keys(jobs).filter((id) => set.has(id))`.

%% solution
```js
export function affectedJobs({ jobs, changed }) {
  const toRegex = (glob) => {
    const src = glob
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*\//g, '\u0001')
      .replace(/\*\*/g, '\u0002')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0001/g, '(?:.*/)?')
      .replace(/\u0002/g, '.*');
    return new RegExp(`^${src}$`);
  };
  const ids = Object.keys(jobs);
  const selected = new Set(
    ids.filter((id) => {
      const paths = jobs[id].paths;
      if (!paths) return true;
      return paths.some((p) => changed.some((file) => toRegex(p).test(file)));
    }),
  );
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of ids) {
      if (!selected.has(id) && (jobs[id].needs ?? []).some((n) => selected.has(n))) {
        selected.add(id);
        grew = true;
      }
    }
  }
  grew = true;
  while (grew) {
    grew = false;
    for (const id of [...selected]) {
      for (const n of jobs[id].needs ?? []) {
        if (jobs[n] && !selected.has(n)) {
          selected.add(n);
          grew = true;
        }
      }
    }
  }
  return ids.filter((id) => selected.has(id));
}
```

%% exercise gx-flaky | Find flaky tests | 3 | js | js | classifyTests | 30
`classifyTests(runs, { minRuns = 3 } = {})` takes a list of runs `{ test, commit, passed }` and returns `{ flaky, broken }`, both **sorted alphabetically**.

- A test is **flaky** when some **single commit** has **both** a passing and a failing run for it.
- A test that is not flaky is **broken** when it has **at least `minRuns`** runs and **every** run failed.
- Everything else (always passing, too few runs, or a failure that was fixed on a later commit) is in neither list.

```js
classifyTests([{ test: 'a', commit: 'c1', passed: true }, { test: 'a', commit: 'c1', passed: false }]);
// { flaky: ['a'], broken: [] }
```

%% worked
**A similar problem, solved: `inconsistentUsers(logins)`** — group by two keys and look for disagreement inside a group.

```js
function inconsistentUsers(logins) {              // logins: [{ user, device, ok }]
  const outcomes = new Map();                      // ① key = user + device, value = set of results seen
  for (const { user, device, ok } of logins) {
    const key = `${user}|${device}`;
    if (!outcomes.has(key)) outcomes.set(key, new Set());
    outcomes.get(key).add(ok);                     // ② a Set of booleans: size 2 means both outcomes happened
  }
  const users = new Set();
  for (const [key, set] of outcomes) if (set.size === 2) users.add(key.split('|')[0]);
  return [...users].sort();                        // ③ sorted for stable output
}
```

%% explain
- **Group by test, then by commit**; a set of outcomes per pair.
- **Broken** needs all-fail and a minimum count.
- **Sort** the output.

%% nudge
- Why is "failed once, then passed on the next commit" not flaky?
- Why do you need a minimum number of runs before calling a test broken?

%% starter
```js
export function classifyTests(runs, { minRuns = 3 } = {}) {
  return { flaky: [], broken: [] };
}
```

%% tests
```js
const r = (test, commit, passed) => ({ test, commit, passed });

describe('classifyTests', () => {
  it('returns empty lists without runs', () => {
    expect(classifyTests([])).toEqual({ flaky: [], broken: [] });
  });
  it('flags a test with both outcomes on one commit', () => {
    expect(classifyTests([r('cart', 'c1', true), r('cart', 'c1', false), r('cart', 'c2', true)])).toEqual({ flaky: ['cart'], broken: [] });
  });
  it('does not call a fixed regression flaky', () => {
    expect(classifyTests([r('search', 'c1', false), r('search', 'c2', true), r('search', 'c3', true)])).toEqual({ flaky: [], broken: [] });
  });
  it('flags a test that always fails, given enough runs', () => {
    expect(classifyTests([r('login', 'c1', false), r('login', 'c2', false), r('login', 'c3', false)])).toEqual({ flaky: [], broken: ['login'] });
    expect(classifyTests([r('login', 'c1', false), r('login', 'c2', false)])).toEqual({ flaky: [], broken: [] });
  });
  it('respects a custom minRuns', () => {
    expect(classifyTests([r('x', 'c1', false), r('x', 'c2', false)], { minRuns: 2 })).toEqual({ flaky: [], broken: ['x'] });
  });
  it('never lists a test as both', () => {
    const runs = [r('t', 'c1', false), r('t', 'c1', true), r('t', 'c2', false), r('t', 'c3', false)];
    expect(classifyTests(runs)).toEqual({ flaky: ['t'], broken: [] });
  });
  it('ignores tests that always pass and sorts the output', () => {
    const runs = [
      r('zeta', 'c1', true), r('zeta', 'c1', false),
      r('alpha', 'c1', true), r('alpha', 'c1', false),
      r('ok', 'c1', true), r('ok', 'c2', true), r('ok', 'c3', true),
      r('b2', 'c1', false), r('b2', 'c2', false), r('b2', 'c3', false),
      r('b1', 'c1', false), r('b1', 'c2', false), r('b1', 'c3', false),
    ];
    expect(classifyTests(runs)).toEqual({ flaky: ['alpha', 'zeta'], broken: ['b1', 'b2'] });
  });
  it('keeps tests separate when commits repeat', () => {
    expect(classifyTests([r('a', 'c1', true), r('b', 'c1', false)])).toEqual({ flaky: [], broken: [] });
  });
});
```

%% hints
- `Map` from test to `{ byCommit: Map(commit -> Set(passed)), total, failed }`.
- Flaky: some commit's set has size 2.

%% solution
```js
export function classifyTests(runs, { minRuns = 3 } = {}) {
  const tests = new Map();
  for (const { test, commit, passed } of runs) {
    if (!tests.has(test)) tests.set(test, { commits: new Map(), total: 0, failed: 0 });
    const t = tests.get(test);
    if (!t.commits.has(commit)) t.commits.set(commit, new Set());
    t.commits.get(commit).add(passed);
    t.total += 1;
    if (!passed) t.failed += 1;
  }
  const flaky = [];
  const broken = [];
  for (const [name, t] of tests) {
    if ([...t.commits.values()].some((outcomes) => outcomes.size === 2)) flaky.push(name);
    else if (t.total >= minRuns && t.failed === t.total) broken.push(name);
  }
  return { flaky: flaky.sort(), broken: broken.sort() };
}
```

%% exercise gx-dora | DORA metrics | 3 | js | js | doraMetrics | 35
`doraMetrics({ deploys, windowDays })` summarises delivery. Each deploy is `{ commitAt, deployedAt, failed, restoredAt }` (milliseconds; `restoredAt` only for some failures). Return:

- `deploymentFrequency`: deploys per day (`0` for a window that is not positive);
- `leadTimeMs`: the **median** of `deployedAt - commitAt` (`null` with no deploys);
- `changeFailureRate`: failed deploys divided by all deploys (`0` with none);
- `mttrMs`: the **median** of `restoredAt - deployedAt` over failed deploys **that have `restoredAt`** (`null` if there are none).

The median of an even number of values is the **average of the two middle ones**.

```js
doraMetrics({ deploys: [], windowDays: 7 });
// { deploymentFrequency: 0, leadTimeMs: null, changeFailureRate: 0, mttrMs: null }
```

%% worked
**A similar problem, solved: `responseStats(requests)`** — a median helper and guarded summaries.

```js
function responseStats(requests) {                        // requests: [{ ms, error }]
  const median = (nums) => {
    if (nums.length === 0) return null;                   // ① nothing to summarise: null, not 0 or NaN
    const s = [...nums].sort((a, b) => a - b);            // ② copy before sorting; numeric comparator
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;   // ③ odd: middle; even: average of the two middle
  };
  return {
    medianMs: median(requests.map((r) => r.ms)),
    errorRate: requests.length ? requests.filter((r) => r.error).length / requests.length : 0,
  };
}
```

%% explain
- **A median helper** used twice.
- **Filter** failed deploys that have a restore time.
- **Guards** for the empty cases.

%% nudge
- Why is `[3, 10, 2].sort()` without a comparator a trap?
- Why `null` rather than `0` for the lead time of no deploys?

%% starter
```js
export function doraMetrics({ deploys, windowDays }) {
  return { deploymentFrequency: 0, leadTimeMs: null, changeFailureRate: 0, mttrMs: null };
}
```

%% tests
```js
const H = 3600000;
const dep = (lead, failed = false, restoreAfter) => ({
  commitAt: 1000,
  deployedAt: 1000 + lead * H,
  failed,
  ...(restoreAfter === undefined ? {} : { restoredAt: 1000 + lead * H + restoreAfter * H }),
});

describe('doraMetrics', () => {
  it('handles no deploys', () => {
    expect(doraMetrics({ deploys: [], windowDays: 7 })).toEqual({ deploymentFrequency: 0, leadTimeMs: null, changeFailureRate: 0, mttrMs: null });
  });
  it('summarises a normal window', () => {
    const deploys = [dep(2), dep(4, true, 1), dep(6), dep(8, true, 3)];
    expect(doraMetrics({ deploys, windowDays: 10 })).toEqual({
      deploymentFrequency: 0.4,
      leadTimeMs: 5 * H,
      changeFailureRate: 0.5,
      mttrMs: 2 * H,
    });
  });
  it('uses the middle value for an odd count and does not mutate the input', () => {
    const deploys = [dep(9), dep(1), dep(2)];
    const copy = JSON.stringify(deploys);
    expect(doraMetrics({ deploys, windowDays: 3 }).leadTimeMs).toBe(2 * H);
    expect(JSON.stringify(deploys)).toBe(copy);
  });
  it('is not fooled by an outlier or by string sorting', () => {
    const deploys = [dep(1), dep(2), dep(3), dep(100)];
    expect(doraMetrics({ deploys, windowDays: 4 }).leadTimeMs).toBe(2.5 * H);
    expect(doraMetrics({ deploys: [dep(10), dep(9), dep(2)], windowDays: 3 }).leadTimeMs).toBe(9 * H);
  });
  it('only counts restored failures towards time to restore', () => {
    const deploys = [dep(1, true), dep(2, true, 4), dep(3, false, 99)];
    const r = doraMetrics({ deploys, windowDays: 3 });
    expect(r.mttrMs).toBe(4 * H);
    expect(r.changeFailureRate).toBeCloseTo(2 / 3, 10);
  });
  it('has no time to restore when nothing was restored', () => {
    expect(doraMetrics({ deploys: [dep(1, true), dep(2)], windowDays: 2 }).mttrMs).toBe(null);
  });
  it('is zero frequency for a window that is not positive', () => {
    expect(doraMetrics({ deploys: [dep(1)], windowDays: 0 }).deploymentFrequency).toBe(0);
  });
});
```

%% hints
- `const median = (nums) => ...` with `[...nums].sort((a, b) => a - b)`.
- `deploys.filter((d) => d.failed && d.restoredAt != null)`.

%% solution
```js
export function doraMetrics({ deploys, windowDays }) {
  const median = (nums) => {
    if (nums.length === 0) return null;
    const s = [...nums].sort((a, b) => a - b);
    const mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const failed = deploys.filter((d) => d.failed);
  return {
    deploymentFrequency: windowDays > 0 ? deploys.length / windowDays : 0,
    leadTimeMs: median(deploys.map((d) => d.deployedAt - d.commitAt)),
    changeFailureRate: deploys.length ? failed.length / deploys.length : 0,
    mttrMs: median(failed.filter((d) => d.restoredAt != null).map((d) => d.restoredAt - d.deployedAt)),
  };
}
```

%% exercise gx-check-affected | Tests for an affected-jobs planner | 4 | js | js | checkAffected | 40
`affectedJobs({ jobs, changed })` selects jobs whose `paths` globs match a changed file (a job without `paths` always runs), adds **downstream** jobs (those that `needs` a selected job), then **upstream** jobs (the `needs` of any selected job), and returns ids **in declaration order**. `*` does not cross `/`; `**/` matches zero or more folders. You are given `checkAffected(affectedJobs)`. Write a check that passes for a correct planner and **fails** for one that: **ignores downstream jobs**, **ignores upstream needs**, **drops jobs without paths**, **lets `*` cross folders**, **treats `**/` as one folder**, **returns jobs in discovery order instead of declaration order**.

```js
affectedJobs({ jobs: { a: { paths: ['a/**'] }, b: { needs: ['a'], paths: [] } }, changed: ['a/x'] }); // ['a', 'b']
```

%% worked
**A similar problem, solved: `checkRebuildSet(rebuildSet)`** — a **tiny graph** where each missing rule leaves out a different file.

```js
export function checkRebuildSet(rebuildSet) {                     // rebuildSet(files, changed) -> names in declaration order
  const files = { a: {}, b: { imports: ['a'] }, c: { imports: ['b'] }, d: {} };
  expect(rebuildSet(files, ['a'])).toEqual(['a', 'b', 'c']);       // ① a chain: a one-step-only mutant stops at b
  expect(rebuildSet(files, ['d'])).toEqual(['d']);                 // ② unrelated files stay out: an "everything" mutant fails
  expect(rebuildSet(files, ['c'])).toEqual(['c']);                 // ③ the direction matters: importers rebuild, imports do not
}
```

Design inputs so **only one wrong rule** produces a different list in each assertion.

%% explain
- **A small pipeline graph** with a chain, a branch and an always-run job.
- **Globs**: one pattern each for `*` and `**/`.
- **Order**: make discovery order differ from declaration order.

%% nudge
- Which change forces the planner to add a job *only* through `needs` of a selected job?
- How do you make discovery order differ from declaration order?

%% starter
```js
export function checkAffected(affectedJobs) {
  const jobs = { a: { paths: ['a/**'] }, b: { needs: ['a'], paths: [] } };
  expect(affectedJobs({ jobs, changed: ['a/x'] })).toEqual(['a', 'b']);
  // your assertions: downstream, upstream, always-run, globs, order
}
```

%% tests
```js
const make = (f = {}) => ({ jobs, changed }) => {
  const toRegex = (glob) => {
    let src = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002');
    src = src.replace(/\*/g, f.starCrosses ? '.*' : '[^/]*');
    src = src.replace(/\u0001/g, f.oneFolder ? '[^/]+/' : '(?:.*/)?').replace(/\u0002/g, '.*');
    return new RegExp(`^${src}$`);
  };
  const ids = Object.keys(jobs);
  const set = new Set(ids.filter((id) => {
    const paths = jobs[id].paths;
    if (!paths) return !f.noAlways;
    return paths.some((p) => changed.some((file) => toRegex(p).test(file)));
  }));
  let grew = !f.noDown;
  while (grew) {
    grew = false;
    for (const id of ids) {
      if (!set.has(id) && (jobs[id].needs ?? []).some((n) => set.has(n))) { set.add(id); grew = true; }
    }
  }
  grew = !f.noUp;
  while (grew) {
    grew = false;
    for (const id of [...set]) {
      for (const n of jobs[id].needs ?? []) if (jobs[n] && !set.has(n)) { set.add(n); grew = true; }
    }
  }
  return f.unordered ? [...set] : ids.filter((id) => set.has(id));
};

const correct = make();
const mutants = {
  'ignores downstream jobs': make({ noDown: true }),
  'ignores upstream needs': make({ noUp: true }),
  'drops jobs without paths': make({ noAlways: true }),
  'lets * cross folders': make({ starCrosses: true }),
  'treats **/ as exactly one folder': make({ oneFolder: true }),
  'returns jobs in discovery order': make({ unordered: true }),
};

describe('your checkAffected', () => {
  it('passes on a correct planner', () => {
    checkAffected(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a planner that ${name}`, () => {
      let caught = false;
      try { checkAffected(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Graph: `lint(paths web/**)`, `build(needs lint, paths [])`, `deploy(needs build, paths infra/**)`, `audit` with no paths.
- A change under `web/` must select `lint`, `build` (downstream), `deploy` (downstream of build), `audit` (always).
- A change under `infra/` must also pull in `build` and `lint` (upstream).
- Discovery order differs when an always-run job is declared before the path-matched ones.
- Globs: `docs/*.md` must not match `docs/a/b.md`; `src/**/*.ts` must match both `src/x.ts` and `src/a/b/x.ts`.

%% solution
```js
export function checkAffected(affectedJobs) {
  const jobs = {
    audit: {},
    lint: { paths: ['web/**'] },
    build: { needs: ['lint'], paths: [] },
    deploy: { needs: ['build'], paths: ['infra/**'] },
    other: { paths: ['api/**'] },
  };
  // downstream, always-run and declaration order (audit is declared first, discovered first too, so use a second check below)
  expect(affectedJobs({ jobs, changed: ['web/a.ts'] })).toEqual(['audit', 'lint', 'build', 'deploy']);
  // upstream: infra change selects deploy directly, build and lint only through needs
  expect(affectedJobs({ jobs, changed: ['infra/main.tf'] })).toEqual(['audit', 'lint', 'build', 'deploy']);
  // unrelated change: only the always-run job
  expect(affectedJobs({ jobs, changed: ['README.md'] })).toEqual(['audit']);
  expect(affectedJobs({ jobs, changed: ['api/x.ts'] })).toEqual(['audit', 'other']);

  // declaration order differs from discovery order when a late job is matched first
  const ordered = {
    late: { needs: ['early'], paths: [] },
    early: { paths: ['x/**'] },
    always: {},
  };
  expect(affectedJobs({ jobs: ordered, changed: ['x/a'] })).toEqual(['late', 'early', 'always']);

  // globs
  const globs = { docs: { paths: ['docs/*.md'] }, src: { paths: ['src/**/*.ts'] } };
  expect(affectedJobs({ jobs: globs, changed: ['docs/x.md'] })).toEqual(['docs']);
  expect(affectedJobs({ jobs: globs, changed: ['docs/guide/x.md'] })).toEqual([]);
  expect(affectedJobs({ jobs: globs, changed: ['src/x.ts'] })).toEqual(['src']);
  expect(affectedJobs({ jobs: globs, changed: ['src/a/b/x.ts'] })).toEqual(['src']);
}
```
