---
id: git-github-actions
track: git
title: GitHub Actions in depth
summary: The anatomy of a workflow, step and job conditions with status functions, concurrency groups, least-privilege permissions, and the security mistakes (unpinned actions, script injection, untrusted code with secrets) that a workflow linter should catch.
---

## The idea in one sentence

A GitHub Actions workflow is a **YAML file that says "when this happens, run these jobs"**, and because it executes code with access to your repository and secrets, **how you write it matters as much as what it does**.

> **Analogy** A set of standing orders for a contractor who holds the keys to your building. The orders say **when** to start (events), **what** to do (jobs and steps), **what they may touch** (permissions), and **what to do if something goes wrong** (conditions). Careless orders ("do whatever the visitor's note says") are how buildings get robbed.

*(Everything below maps to the real `on`, `jobs.<id>.steps`, `if:`, `concurrency`, `permissions` and `uses` keys. You will build the evaluator, the concurrency controller, the step runner and a security linter.)*

## Anatomy of a workflow

![Workflow file](fig:gt-workflow "Events, permissions, jobs, steps.")

| Key | Meaning |
| --- | --- |
| `on` | the **events** (push, pull_request, schedule, workflow_dispatch, workflow_call) with optional filters |
| `jobs.<id>` | a job; runs on `runs-on`; `needs` orders jobs; `timeout-minutes` bounds it |
| `steps` | run in order on one runner; `run:` (shell) or `uses:` (an action) |
| `permissions` | what the automatic **`GITHUB_TOKEN`** may do; default to **read-only** |
| `env`, `secrets`, `vars` | configuration; **secrets** are masked in logs and absent from fork PRs |
| `environment` | links a job to deployment rules (reviewers, secrets, wait timers) |
| `concurrency` | at most one run per **group** (optionally cancel the older) |

A **reusable workflow** (`workflow_call`) or a **composite action** packages steps for reuse; a **matrix** and **path filters** (previous lesson) shape what runs.

## Conditions and status functions

![Conditions](fig:gt-expr "success(), failure(), always(), cancelled().")

An `if:` is an **expression** over **contexts** (`github`, `env`, `needs`, `job`, `secrets`, `vars`). Rules that catch people out:

- A step **without** `if:` is really `if: success()`: it is **skipped once an earlier step failed**.
- Use **`failure()`** for "upload logs only when something broke", **`always()`** for cleanup and reports, **`cancelled()`** for cancellation handlers.
- An expression with **no status function** gets an **implicit `success() &&`** in front.
- **`==` ignores case** for strings; **`&&` binds tighter than `||`**; a **missing** context value is `null`, not an error.
- `contains()`, `startsWith()`, `endsWith()` are **case-insensitive**.

```js try predict
const status = 'failure';
const fns = {
  success: () => status === 'success',
  failure: () => status === 'failure',
  always: () => true,
};

console.log(fns.success(), fns.failure(), fns.always());
```

```stepper A step list after a failure
code:
  - checkout                              # default: success()
  - npm test              (fails)
  - upload logs           if: failure()
  - deploy                # default: success()
  - cleanup               if: always()
---
line: 1
say: `checkout` runs: nothing has failed yet, and the default condition is `success()`. The job status is **success**.
phase: success
---
line: 2
say: The tests **fail**. The step's outcome is `failure` and the **job status becomes `failure`**.
phase: failure
---
line: 3
say: `upload logs` has `if: failure()`: the job is failing, so it **runs**. That is how you get the logs of a failed run.
phase: failure() runs
---
line: 4
say: `deploy` has **no** `if`, so it means `success()`. The job is failing, so it is **skipped**. A failed test never deploys.
phase: skipped
---
line: 5
say: `cleanup` has `always()`: it runs **whatever happened**, even after a failure or a cancellation.
phase: always() runs
```

`continue-on-error: true` lets a step fail **without failing the job** (its **outcome** is `failure` but its **conclusion** is `success`).

## Concurrency

![Concurrency](fig:gt-concurrency "Cancel older runs for checks; queue deploys.")

A **concurrency group** allows **one active run** (and one **pending**). With **`cancel-in-progress: true`** a new run **cancels** the active one: ideal for pull-request checks where only the newest commit matters. Without it, the new run **waits** and **replaces** any older pending run: right for **deployments**, which must never be killed halfway.

## Permissions and the dangerous patterns

- **Least privilege**: set `permissions: contents: read` at the top and grant `write` per job only when needed. `write-all` is almost never right.
- **Pin third-party actions to a full commit SHA**, not a tag or branch: a tag can be **moved** to malicious code (supply chain attack).
- **`pull_request_target`** runs in the **base repository's context with secrets**. Never **check out and run the pull request's code** in it: that hands your secrets to the author.
- **Script injection**: `run: echo "${{ github.event.pull_request.title }}"` pastes **attacker-controlled text into a shell script**. Pass untrusted values through an **environment variable** instead.
- Never **echo secrets**; logs are masked, but transformations (base64, splitting) can leak them.
- Set **`timeout-minutes`**: a hung job otherwise burns six hours of runner time.

## Quick check

```check
Q: A step has no "if". An earlier step in the job failed. What happens to it?
A) It runs anyway
B) It is skipped, because the default condition is success() *
C) It runs but its result is ignored
D) The whole workflow restarts
Why: Without an if, a step only runs while the job is still succeeding.
---
Q: When should a "upload logs" step run?
A) always()
B) failure() *
C) success()
D) cancelled()
Why: failure() runs only after something failed, which is when you need the logs.
---
Q: Why is "uses: some/action@v2" riskier than pinning a commit SHA?
A) Tags are slower to download
B) The tag can be moved to different, possibly malicious, code *
C) SHAs are encrypted
D) Tags are not allowed
Why: Only a full commit hash is immutable.
---
Q: A workflow on pull_request_target checks out the PR's head and runs its tests. What is the danger?
A) It is too slow
B) Untrusted code runs with the base repository's secrets and token *
C) The PR cannot be merged
D) Nothing; secrets are not available
Why: pull_request_target is privileged; combining it with untrusted code is the classic exploit.
```

## Recap

- A workflow is **events + jobs + steps**; `permissions` set the token's power; `concurrency` limits parallel runs per group.
- **No `if` means `success()`**; use `failure()` and `always()` deliberately; **`continue-on-error`** changes conclusion, not outcome.
- Expressions: **case-insensitive `==` and `contains`**, **`&&` before `||`**, **null** for missing values, implicit `success()`.
- **Cancel** old runs for checks; **queue** deploys.
- **Least privilege, pin by SHA, no untrusted code under `pull_request_target`, no untrusted text in `run:`, set timeouts.**

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: is it pinned? | A regular expression for a full commit hash |
| Evaluate an `if:` | Tokenizer plus precedence-climbing parser |
| Concurrency groups | Maps of running and pending runs |
| Run steps | Job status, conditions, `continue-on-error` |
| Lint a workflow | Walking an object tree, several rules, paths |
| Tests for the evaluator | Expressions where each wrong rule changes the answer |

%% exercise gx-guided-pinned | Guided: is it pinned? | 1 | js | js | isPinned | 8 | guided
Implement `isPinned(uses)` for a step's `uses` string: `true` only if it is a **remote action pinned to a full commit SHA**, meaning there is an `@` and the text after the **last** `@` is exactly **40 hexadecimal characters** (any case). Local actions (`./...`), Docker references (`docker://...`), tags, branches and a missing `@` are `false`.

```js
isPinned('actions/checkout@8e5e7e5ab8b370d6c329ec480221332ada57f0ab'); // true
isPinned('actions/checkout@v4');                                        // false
```

%% worked
**A similar problem, solved: `isFullHash(ref)`** — a regex that must cover the **whole** string.

```js
function isFullHash(ref) {
  return /^[0-9a-f]{40}$/i.test(ref);        // ① anchors at both ends: a 41-character string or one with a dash must NOT match
}
```

Take the part after `lastIndexOf('@')`, then apply the anchored regex. Without `^` and `$` a longer string that merely **contains** 40 hex characters would pass.

%% explain
- **Reject** local and Docker references first.
- **`lastIndexOf('@')`** then the anchored regex.

%% nudge
- Why must the regex be anchored?

%% starter
```js
export function isPinned(uses) {
  return false;
}
```

%% tests
```js
describe('isPinned', () => {
  const sha = '8e5e7e5ab8b370d6c329ec480221332ada57f0ab';
  it('accepts a full commit sha', () => {
    expect(isPinned('actions/checkout@' + sha)).toBe(true);
    expect(isPinned('owner/repo/path/to/action@' + sha.toUpperCase())).toBe(true);
  });
  it('rejects tags, branches and a missing ref', () => {
    expect(isPinned('actions/checkout@v4')).toBe(false);
    expect(isPinned('actions/checkout@main')).toBe(false);
    expect(isPinned('actions/checkout')).toBe(false);
  });
  it('rejects short or long hashes', () => {
    expect(isPinned('a/b@' + sha.slice(0, 39))).toBe(false);
    expect(isPinned('a/b@' + sha + '0')).toBe(false);
    expect(isPinned('a/b@' + sha.slice(0, 39) + 'g')).toBe(false);
  });
  it('rejects local and docker references', () => {
    expect(isPinned('./.github/actions/setup')).toBe(false);
    expect(isPinned('docker://alpine:3.19')).toBe(false);
  });
});
```

%% hints
- `const at = uses.lastIndexOf('@'); if (at === -1) return false;`
- `/^[0-9a-f]{40}$/i.test(uses.slice(at + 1))`

%% solution
```js
export function isPinned(uses) {
  if (uses.startsWith('./') || uses.startsWith('docker://')) return false;
  const at = uses.lastIndexOf('@');
  if (at === -1) return false;
  return /^[0-9a-f]{40}$/i.test(uses.slice(at + 1));
}
```

%% exercise gx-expr | Evaluate an if: expression | 4 | js | js | evaluateIf | 55
`evaluateIf(expression, context = {})` returns `true` or `false`. An optional wrapper `${{ ... }}` is removed first.

**Syntax**: strings in single quotes (`''` is an escaped quote), numbers, `true`, `false`, `null`, context paths like `github.ref` or `needs.build.result` (letters, digits, `_`, `-` and `.`), function calls, `!`, `==`, `!=`, `&&`, `||` and parentheses. Precedence from loosest: `||`, `&&`, `==`/`!=`, `!`.

**Values**: a missing path is `null`. Falsy values are `false`, `0`, `''`, `null`, `undefined` and `NaN`. `a && b` yields `a` if `a` is falsy, else `b`; `a || b` yields `a` if truthy, else `b`.

**Equality**: two strings compare **case-insensitively**; otherwise compare as numbers (`null` is `0`, `true` is `1`, `false` is `0`, a string converts with `Number`, which gives `NaN` if it is not numeric; `NaN` equals nothing).

**Functions** (names case-insensitive): `success()`, `failure()`, `cancelled()` compare `context.job.status` (default `'success'`) with `'success'`, `'failure'`, `'cancelled'`; `always()` is true; `contains(search, item)` is, for an array `search`, true if any element equals `item` by the equality rule, else a **case-insensitive substring** test on the strings; `startsWith` and `endsWith` are case-insensitive. Any other function throws `Error('unknown function: name')`.

**Result**: the truthiness of the value, **but** if the expression never called `success`, `failure`, `always` or `cancelled`, it is `job status is 'success' AND truthy(value)`. A syntax error throws `Error('invalid expression: ...')`.

```js
evaluateIf("github.ref == 'refs/heads/main' && !contains(github.event.head_commit.message, '[skip ci]')", ctx);
```

%% worked
**A similar problem, solved: `calc(text)`** — precedence with **one function per level**, each calling the next-tighter one.

```js
function calc(text) {
  const tokens = text.match(/\d+|[+*()]/g);
  let p = 0;
  const sum = () => { let v = product(); while (tokens[p] === '+') { p++; v += product(); } return v; };      // ① loosest level: + calls the NEXT level for its operands
  const product = () => { let v = atom(); while (tokens[p] === '*') { p++; v *= atom(); } return v; };       // ② tighter level: * binds first
  const atom = () => {
    if (tokens[p] === '(') { p++; const v = sum(); p++; return v; }                                          // ③ parentheses restart at the loosest level
    return Number(tokens[p++]);
  };
  return sum();
}
// calc('2 + 3 * 4') === 14
```

Your grammar has `parseOr` → `parseAnd` → `parseEq` → `parseUnary` → `parsePrimary`. Add a tiny **tokenizer** first, track whether a **status function** was used, and apply the **implicit `success()`** at the very end.

%% explain
- **Tokenize** strings, numbers, operators, identifiers.
- **Parse** with five functions, one per precedence level.
- **Finish**: leftover tokens are an error; apply the implicit `success()`.

%% nudge
- How do you know whether the implicit `success()` applies?
- Which function handles `!`, and what does it call?

%% starter
```js
export function evaluateIf(expression, context = {}) {
  return true;
}
```

%% tests
```js
describe('evaluateIf', () => {
  const ctx = (extra = {}) => ({
    github: { ref: 'refs/heads/main', event_name: 'push', run_attempt: 2, event: { head_commit: { message: 'Fix bug' }, labels: ['bug', 'Docs'] } },
    env: { MODE: 'prod' },
    needs: { build: { result: 'success' } },
    job: { status: 'success' },
    ...extra,
  });
  const ev = (e, c = ctx()) => evaluateIf(e, c);

  it('compares context values', () => {
    expect(ev("github.ref == 'refs/heads/main'")).toBe(true);
    expect(ev("github.ref != 'refs/heads/main'")).toBe(false);
    expect(ev("needs.build.result == 'success'")).toBe(true);
  });
  it('ignores case when comparing strings', () => {
    expect(ev("github.event_name == 'PUSH'")).toBe(true);
    expect(ev("env.MODE == 'Prod'")).toBe(true);
  });
  it('compares numbers, including numeric strings', () => {
    expect(ev('github.run_attempt == 2')).toBe(true);
    expect(ev("github.run_attempt == '2'")).toBe(true);
    expect(ev('github.run_attempt == 3')).toBe(false);
  });
  it('supports && || ! and parentheses with the right precedence', () => {
    expect(ev('true || false && false')).toBe(true);
    expect(ev('(true || false) && false')).toBe(false);
    expect(ev('!(1 == 2)')).toBe(true);
    expect(ev("true && github.event_name == 'push'")).toBe(true);
    expect(ev('false || false')).toBe(false);
    expect(ev('!!true')).toBe(true);
  });
  it('treats missing values as null and falsy', () => {
    expect(ev('env.MISSING')).toBe(false);
    expect(ev("env.MISSING == ''")).toBe(true);
    expect(ev("env.MISSING == 'undefined'")).toBe(false);
    expect(ev('env.MISSING == null')).toBe(true);
    expect(ev('a.b.c.d')).toBe(false);
  });
  it('treats common falsy values as false', () => {
    expect(ev("''")).toBe(false);
    expect(ev('0')).toBe(false);
    expect(ev("'0'")).toBe(true);
    expect(ev('null')).toBe(false);
  });
  it('returns the operand semantics of && and ||', () => {
    expect(ev("env.MISSING || 'x' == 'X'")).toBe(true);
    expect(ev("'' || env.MODE")).toBe(true);
  });
  it('supports contains, startsWith and endsWith, case-insensitively', () => {
    expect(ev("contains(github.event.head_commit.message, 'FIX')")).toBe(true);
    expect(ev("contains('Hello World', 'WORLD')")).toBe(true);
    expect(ev("contains(github.event.labels, 'docs')")).toBe(true);
    expect(ev("contains(github.event.labels, 'nope')")).toBe(false);
    expect(ev("startsWith(github.ref, 'REFS/heads')")).toBe(true);
    expect(ev("endsWith(github.ref, '/MAIN')")).toBe(true);
    expect(ev("!contains(github.event.head_commit.message, '[skip ci]')")).toBe(true);
  });
  it('knows the status functions', () => {
    const failing = ctx({ job: { status: 'failure' } });
    expect(ev('success()')).toBe(true);
    expect(ev('failure()')).toBe(false);
    expect(ev('failure()', failing)).toBe(true);
    expect(ev('success()', failing)).toBe(false);
    expect(ev('always()', failing)).toBe(true);
    expect(ev('cancelled()', ctx({ job: { status: 'cancelled' } }))).toBe(true);
    expect(ev('FAILURE()', failing)).toBe(true);
  });
  it('adds an implicit success() when no status function is used', () => {
    const failing = ctx({ job: { status: 'failure' } });
    expect(ev('true', failing)).toBe(false);
    expect(ev("github.ref == 'refs/heads/main'", failing)).toBe(false);
    expect(ev('always() && true', failing)).toBe(true);
    expect(ev('failure() || true', failing)).toBe(true);
    expect(evaluateIf('true', {})).toBe(true);
  });
  it('accepts the ${{ }} wrapper and escaped quotes', () => {
    expect(ev("${{ github.event_name == 'push' }}")).toBe(true);
    expect(ev("'it''s' == 'IT''S'")).toBe(true);
  });
  it('rejects bad syntax and unknown functions', () => {
    expect(() => ev("'unterminated")).toThrow('invalid expression');
    expect(() => ev('(true')).toThrow('invalid expression');
    expect(() => ev('true &&')).toThrow('invalid expression');
    expect(() => ev('1 === 2')).toThrow('invalid expression');
    expect(() => ev('true false')).toThrow('invalid expression');
    expect(() => ev('')).toThrow('invalid expression');
    expect(() => ev('format(1)')).toThrow('unknown function: format');
  });
});
```

%% hints
- Tokenizer: loop over characters; `'...'` strings (with `''`), the two-character operators first, then single characters, numbers, identifiers (`/^[A-Za-z_][\w.-]*/`).
- `parseOr`, `parseAnd`, `parseEq`, `parseUnary`, `parsePrimary`; `||` and `&&` return operands.
- `usedStatus = true` inside the four status functions.
- Final: `usedStatus ? truthy(v) : status === 'success' && truthy(v)`.

%% solution
```js
export function evaluateIf(expression, context = {}) {
  let src = expression.trim();
  const wrapped = /^\$\{\{([\s\S]*)\}\}$/.exec(src);
  if (wrapped) src = wrapped[1].trim();
  const fail = () => {
    throw new Error('invalid expression: ' + expression);
  };

  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      let text = '';
      for (;;) {
        if (j >= src.length) fail();
        if (src[j] === "'") {
          if (src[j + 1] === "'") {
            text += "'";
            j += 2;
            continue;
          }
          break;
        }
        text += src[j++];
      }
      tokens.push({ t: 'str', v: text });
      i = j + 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '&&' || two === '||' || two === '==' || two === '!=') {
      tokens.push({ t: 'op', v: two });
      i += 2;
      continue;
    }
    if ('()!,'.includes(ch)) {
      tokens.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    const num = /^-?\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) {
      tokens.push({ t: 'num', v: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_][\w.-]*/.exec(src.slice(i));
    if (id) {
      tokens.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    fail();
  }

  const status = (context.job && context.job.status) || 'success';
  let usedStatus = false;
  const truthy = (v) => !(v === false || v === 0 || v === '' || v === null || v === undefined || Number.isNaN(v));
  const toNumber = (v) => (v === null || v === undefined ? 0 : v === true ? 1 : v === false ? 0 : typeof v === 'number' ? v : Number(v));
  const looseEq = (a, b) => {
    if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
    return toNumber(a) === toNumber(b);
  };
  const text = (v) => String(v === null || v === undefined ? '' : v).toLowerCase();

  let p = 0;
  const isOp = (v) => p < tokens.length && tokens[p].t === 'op' && tokens[p].v === v;

  const call = (name, args) => {
    switch (name.toLowerCase()) {
      case 'success': usedStatus = true; return status === 'success';
      case 'failure': usedStatus = true; return status === 'failure';
      case 'cancelled': usedStatus = true; return status === 'cancelled';
      case 'always': usedStatus = true; return true;
      case 'contains': return Array.isArray(args[0]) ? args[0].some((x) => looseEq(x, args[1])) : text(args[0]).includes(text(args[1]));
      case 'startswith': return text(args[0]).startsWith(text(args[1]));
      case 'endswith': return text(args[0]).endsWith(text(args[1]));
      default: throw new Error('unknown function: ' + name);
    }
  };

  const parseOr = () => {
    let left = parseAnd();
    while (isOp('||')) {
      p++;
      const right = parseAnd();
      left = truthy(left) ? left : right;
    }
    return left;
  };
  const parseAnd = () => {
    let left = parseEq();
    while (isOp('&&')) {
      p++;
      const right = parseEq();
      left = truthy(left) ? right : left;
    }
    return left;
  };
  const parseEq = () => {
    let left = parseUnary();
    while (isOp('==') || isOp('!=')) {
      const op = tokens[p++].v;
      const right = parseUnary();
      const same = looseEq(left, right);
      left = op === '==' ? same : !same;
    }
    return left;
  };
  const parseUnary = () => {
    if (isOp('!')) {
      p++;
      return !truthy(parseUnary());
    }
    return parsePrimary();
  };
  const parsePrimary = () => {
    const tok = tokens[p++];
    if (!tok) fail();
    if (tok.t === 'str' || tok.t === 'num') return tok.v;
    if (tok.t === 'op') {
      if (tok.v !== '(') fail();
      const v = parseOr();
      if (!isOp(')')) fail();
      p++;
      return v;
    }
    if (isOp('(')) {
      p++;
      const args = [];
      if (!isOp(')')) {
        args.push(parseOr());
        while (isOp(',')) {
          p++;
          args.push(parseOr());
        }
      }
      if (!isOp(')')) fail();
      p++;
      return call(tok.v, args);
    }
    if (tok.v === 'true') return true;
    if (tok.v === 'false') return false;
    if (tok.v === 'null') return null;
    let value = context;
    for (const key of tok.v.split('.')) {
      if (value === null || value === undefined) return null;
      value = value[key];
    }
    return value === undefined ? null : value;
  };

  if (tokens.length === 0) fail();
  const value = parseOr();
  if (p < tokens.length) fail();
  return usedStatus ? truthy(value) : status === 'success' && truthy(value);
}
```

%% exercise gx-concurrency | Concurrency groups | 3 | js | js | createConcurrency | 36
`createConcurrency()` controls runs per concurrency group and returns `{ request, finish, cancel, status, snapshot }`.

- `request(id, group, { cancelInProgress = false } = {})` registers a run. A duplicate id throws `Error('duplicate run: ' + id)`.
  - No `group` (`undefined` or `null`): the run is `'running'` at once and is not tracked by any group.
  - No run is `running` in the group: the new run is `'running'`.
  - Otherwise, with `cancelInProgress`: the running run **and** any pending run in the group become `'cancelled'` and the new run is `'running'`.
  - Otherwise: any existing pending run becomes `'cancelled'` and the new run is `'pending'`.
- `finish(id)` marks a **running** run `'completed'` (anything else throws `Error('not running: ' + id)`), then **promotes** the group's pending run, if any, to `'running'`.
- `cancel(id)` marks a running or pending run `'cancelled'` (anything else throws `Error('cannot cancel: ' + id)`); cancelling a running run also promotes the pending one.
- `status(id)` returns `'running'`, `'pending'`, `'cancelled'` or `'completed'`; an unknown id throws `Error('unknown run: ' + id)` (also for `finish` and `cancel`).
- `snapshot()` returns `{ [group]: { running, pending } }` with run ids or `null`, for every group that has been used.

```js
const c = createConcurrency();
c.request('r1', 'ci/main');
c.request('r2', 'ci/main', { cancelInProgress: true });
c.status('r1'); // 'cancelled'
```

%% worked
**A similar problem, solved: `createSlot()`** — **one active, one waiting**, newest waiter replaces the older.

```js
function createSlot() {
  let active = null, waiting = null;
  const status = {};
  return {
    submit(id) {
      status[id] = 'new';
      if (active === null) { active = id; status[id] = 'running'; return; }   // ① free: start at once
      if (waiting !== null) status[waiting] = 'cancelled';                     // ② a newer waiter replaces the older one
      waiting = id; status[id] = 'pending';
    },
    done() {
      status[active] = 'completed';
      active = waiting; waiting = null;                                        // ③ promote the waiter, if any
      if (active !== null) status[active] = 'running';
    },
    status: (id) => status[id],
  };
}
```

You need that **per group** (a `Map` of `{ running, pending }`), with an extra `cancelInProgress` branch and a few error cases.

%% explain
- **Per-group state**: `running` and `pending` ids.
- **`request`**: the four cases.
- **`finish` and `cancel`** promote the pending run.

%% nudge
- What happens to a pending run when a `cancelInProgress` run arrives?
- Which run is promoted when the running one finishes?

%% starter
```js
export function createConcurrency() {
  return {
    request(id, group, options = {}) {},
    finish(id) {},
    cancel(id) {},
    status(id) {},
    snapshot() {
      return {};
    },
  };
}
```

%% tests
```js
describe('createConcurrency', () => {
  it('starts a run when its group is free', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    expect(c.status('r1')).toBe('running');
  });
  it('queues a second run as pending', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    c.request('r2', 'g');
    expect(c.status('r2')).toBe('pending');
    expect(c.status('r1')).toBe('running');
  });
  it('keeps only the newest pending run', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    c.request('r2', 'g');
    c.request('r3', 'g');
    expect(c.status('r2')).toBe('cancelled');
    expect(c.status('r3')).toBe('pending');
  });
  it('promotes the pending run when the running one finishes', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    c.request('r2', 'g');
    c.finish('r1');
    expect(c.status('r1')).toBe('completed');
    expect(c.status('r2')).toBe('running');
    c.finish('r2');
    expect(c.snapshot()).toEqual({ g: { running: null, pending: null } });
  });
  it('cancels the running and pending runs with cancelInProgress', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    c.request('r2', 'g');
    c.request('r3', 'g', { cancelInProgress: true });
    expect(c.status('r1')).toBe('cancelled');
    expect(c.status('r2')).toBe('cancelled');
    expect(c.status('r3')).toBe('running');
    expect(c.snapshot()).toEqual({ g: { running: 'r3', pending: null } });
  });
  it('treats cancelInProgress on a free group as a normal start', () => {
    const c = createConcurrency();
    c.request('r1', 'g', { cancelInProgress: true });
    expect(c.status('r1')).toBe('running');
  });
  it('keeps groups independent', () => {
    const c = createConcurrency();
    c.request('a1', 'ga');
    c.request('b1', 'gb');
    expect(c.status('a1')).toBe('running');
    expect(c.status('b1')).toBe('running');
    c.request('a2', 'ga', { cancelInProgress: true });
    expect(c.status('b1')).toBe('running');
  });
  it('runs ungrouped runs immediately and untracked', () => {
    const c = createConcurrency();
    c.request('x1');
    c.request('x2', null);
    expect(c.status('x1')).toBe('running');
    expect(c.status('x2')).toBe('running');
    expect(c.snapshot()).toEqual({});
    c.finish('x1');
    expect(c.status('x1')).toBe('completed');
  });
  it('cancels a pending run without disturbing the running one', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    c.request('r2', 'g');
    c.cancel('r2');
    expect(c.status('r2')).toBe('cancelled');
    expect(c.snapshot().g).toEqual({ running: 'r1', pending: null });
  });
  it('promotes the pending run when the running one is cancelled', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    c.request('r2', 'g');
    c.cancel('r1');
    expect(c.status('r1')).toBe('cancelled');
    expect(c.status('r2')).toBe('running');
  });
  it('rejects bad operations', () => {
    const c = createConcurrency();
    c.request('r1', 'g');
    expect(() => c.request('r1', 'g')).toThrow('duplicate run: r1');
    expect(() => c.status('nope')).toThrow('unknown run: nope');
    expect(() => c.finish('nope')).toThrow('unknown run: nope');
    expect(() => c.cancel('nope')).toThrow('unknown run: nope');
    c.request('r2', 'g');
    expect(() => c.finish('r2')).toThrow('not running: r2');
    c.finish('r1');
    expect(() => c.finish('r1')).toThrow('not running: r1');
    expect(() => c.cancel('r1')).toThrow('cannot cancel: r1');
  });
});
```

%% hints
- `runs: Map(id → { group, status })`, `groups: Map(group → { running, pending })`.
- A helper `promote(group)` that moves `pending` to `running` and marks its status.
- `request` with `cancelInProgress` and a running run: cancel both ids, then set the new one running.

%% solution
```js
export function createConcurrency() {
  const runs = new Map();
  const groups = new Map();

  const need = (id) => {
    if (!runs.has(id)) throw new Error('unknown run: ' + id);
    return runs.get(id);
  };
  const slot = (group) => {
    if (!groups.has(group)) groups.set(group, { running: null, pending: null });
    return groups.get(group);
  };
  const cancelRun = (id) => {
    if (id !== null) runs.get(id).status = 'cancelled';
  };
  const promote = (group) => {
    const s = slot(group);
    s.running = s.pending;
    s.pending = null;
    if (s.running !== null) runs.get(s.running).status = 'running';
  };

  return {
    request(id, group, { cancelInProgress = false } = {}) {
      if (runs.has(id)) throw new Error('duplicate run: ' + id);
      if (group === undefined || group === null) {
        runs.set(id, { group: null, status: 'running' });
        return;
      }
      const s = slot(group);
      runs.set(id, { group, status: 'running' });
      if (s.running === null) {
        s.running = id;
      } else if (cancelInProgress) {
        cancelRun(s.running);
        cancelRun(s.pending);
        s.running = id;
        s.pending = null;
      } else {
        cancelRun(s.pending);
        s.pending = id;
        runs.get(id).status = 'pending';
      }
    },
    finish(id) {
      const run = need(id);
      if (run.status !== 'running') throw new Error('not running: ' + id);
      run.status = 'completed';
      if (run.group !== null) promote(run.group);
    },
    cancel(id) {
      const run = need(id);
      if (run.status !== 'running' && run.status !== 'pending') throw new Error('cannot cancel: ' + id);
      const wasRunning = run.status === 'running';
      run.status = 'cancelled';
      if (run.group === null) return;
      const s = slot(run.group);
      if (wasRunning) promote(run.group);
      else s.pending = null;
    },
    status(id) {
      return need(id).status;
    },
    snapshot() {
      const out = {};
      for (const [group, s] of groups) out[group] = { running: s.running, pending: s.pending };
      return out;
    },
  };
}
```

%% exercise gx-steps | Run the steps of a job | 3 | js | js | runSteps | 32
`runSteps(steps)` simulates one job. Each step is `{ name, run, if, continueOnError }`: `run` is a function that may throw; `if` is `undefined`, `'success()'`, `'failure()'`, `'always()'` or `'cancelled()'`; anything else throws `Error('unsupported condition: ' + value)` (checked when the step is reached).

The job status starts as `'success'`. For each step in order:

- **Run it** when its condition holds: no `if` or `'success()'` → the job status is `'success'`; `'failure()'` → the status is `'failure'`; `'always()'` → always; `'cancelled()'` → never (nothing cancels here). Otherwise the step is `{ name, outcome: 'skipped', conclusion: 'skipped' }`.
- A running step that returns normally has `outcome: 'success'` and `conclusion: 'success'`. If it throws, `outcome` is `'failure'` and `error` is the error's message; its `conclusion` is `'success'` when `continueOnError` is true (the job stays as it was), otherwise `'failure'` and the **job status becomes `'failure'`**.

Return `{ status, steps }` with one result per step, in order (`error` only on a thrown step).

```js
runSteps([{ name: 'test', run: () => { throw new Error('boom'); } }, { name: 'logs', run: () => {}, if: 'failure()' }]).status; // 'failure'
```

%% worked
**A similar problem, solved: `runPhases(phases)`** — a running **status** that later steps consult.

```js
function runPhases(phases) {
  let health = 'ok';
  const results = phases.map((p) => {
    const cond = p.when ?? 'healthy';
    const shouldRun = cond === 'always' || (cond === 'healthy' && health === 'ok') || (cond === 'broken' && health === 'bad');   // ① the condition reads the CURRENT status
    if (!shouldRun) return { name: p.name, result: 'skipped' };
    try { p.fn(); return { name: p.name, result: 'ok' }; }
    catch (e) { health = 'bad'; return { name: p.name, result: 'error', error: e.message }; }       // ② a throw changes the status for every later step
  });
  return { health, results };
}
```

`continueOnError` keeps the **status untouched** while still recording that the step failed (its **outcome**).

%% explain
- **Status** variable, `shouldRun` from the condition.
- **try/catch** records outcome, conclusion and error.
- **continueOnError** leaves the job status alone.

%% nudge
- What is the difference between `outcome` and `conclusion`?
- When does a step with no `if` get skipped?

%% starter
```js
export function runSteps(steps) {
  return { status: 'success', steps: [] };
}
```

%% tests
```js
describe('runSteps', () => {
  const ok = () => {};
  const boom = (msg = 'boom') => () => { throw new Error(msg); };

  it('runs steps in order while everything succeeds', () => {
    const order = [];
    const r = runSteps([
      { name: 'a', run: () => order.push('a') },
      { name: 'b', run: () => order.push('b'), if: 'success()' },
    ]);
    expect(order).toEqual(['a', 'b']);
    expect(r).toEqual({
      status: 'success',
      steps: [
        { name: 'a', outcome: 'success', conclusion: 'success' },
        { name: 'b', outcome: 'success', conclusion: 'success' },
      ],
    });
  });
  it('fails the job when a step throws and skips default steps afterwards', () => {
    const later = jest.fn();
    const r = runSteps([{ name: 'test', run: boom() }, { name: 'deploy', run: later }]);
    expect(later).not.toHaveBeenCalled();
    expect(r.status).toBe('failure');
    expect(r.steps).toEqual([
      { name: 'test', outcome: 'failure', conclusion: 'failure', error: 'boom' },
      { name: 'deploy', outcome: 'skipped', conclusion: 'skipped' },
    ]);
  });
  it('runs failure() steps only after a failure', () => {
    const logs = jest.fn();
    runSteps([{ name: 'a', run: ok }, { name: 'logs', run: logs, if: 'failure()' }]);
    expect(logs).not.toHaveBeenCalled();
    runSteps([{ name: 'a', run: boom() }, { name: 'logs', run: logs, if: 'failure()' }]);
    expect(logs).toHaveBeenCalledTimes(1);
  });
  it('runs always() steps in every case', () => {
    const cleanup = jest.fn();
    runSteps([{ name: 'a', run: ok }, { name: 'c', run: cleanup, if: 'always()' }]);
    runSteps([{ name: 'a', run: boom() }, { name: 'c', run: cleanup, if: 'always()' }]);
    expect(cleanup).toHaveBeenCalledTimes(2);
  });
  it('never runs cancelled() steps here', () => {
    const r = runSteps([{ name: 'x', run: boom(), if: 'cancelled()' }]);
    expect(r.steps[0].outcome).toBe('skipped');
    expect(r.status).toBe('success');
  });
  it('lets continueOnError keep the job going but records the outcome', () => {
    const next = jest.fn();
    const r = runSteps([{ name: 'flaky', run: boom('meh'), continueOnError: true }, { name: 'next', run: next }]);
    expect(next).toHaveBeenCalledTimes(1);
    expect(r.status).toBe('success');
    expect(r.steps[0]).toEqual({ name: 'flaky', outcome: 'failure', conclusion: 'success', error: 'meh' });
  });
  it('lets a failing always() step still fail the job', () => {
    const r = runSteps([{ name: 'c', run: boom('cleanup failed'), if: 'always()' }]);
    expect(r.status).toBe('failure');
  });
  it('keeps the job failed once it has failed', () => {
    const r = runSteps([{ name: 'a', run: boom() }, { name: 'b', run: ok, if: 'always()' }, { name: 'c', run: ok }]);
    expect(r.status).toBe('failure');
    expect(r.steps.map((s) => s.outcome)).toEqual(['failure', 'success', 'skipped']);
  });
  it('rejects unsupported conditions', () => {
    expect(() => runSteps([{ name: 'x', run: ok, if: "github.ref == 'main'" }])).toThrow("unsupported condition: github.ref == 'main'");
  });
  it('handles no steps', () => {
    expect(runSteps([])).toEqual({ status: 'success', steps: [] });
  });
});
```

%% hints
- `let status = 'success';` and a `decide(cond)` helper.
- `try { step.run(); ... } catch (e) { ... }`.
- On a throw without `continueOnError`: `status = 'failure'`.

%% solution
```js
export function runSteps(steps) {
  let status = 'success';
  const results = [];
  for (const step of steps) {
    const cond = step.if;
    let shouldRun;
    if (cond === undefined || cond === 'success()') shouldRun = status === 'success';
    else if (cond === 'failure()') shouldRun = status === 'failure';
    else if (cond === 'always()') shouldRun = true;
    else if (cond === 'cancelled()') shouldRun = false;
    else throw new Error('unsupported condition: ' + cond);

    if (!shouldRun) {
      results.push({ name: step.name, outcome: 'skipped', conclusion: 'skipped' });
      continue;
    }
    try {
      step.run();
      results.push({ name: step.name, outcome: 'success', conclusion: 'success' });
    } catch (error) {
      const conclusion = step.continueOnError ? 'success' : 'failure';
      if (conclusion === 'failure') status = 'failure';
      results.push({ name: step.name, outcome: 'failure', conclusion, error: error.message });
    }
  }
  return { status, steps: results };
}
```

%% exercise gx-lint | Lint a workflow | 4 | js | js | lintWorkflow | 45
`lintWorkflow(workflow)` returns a list of findings `{ rule, severity, path, message }` (`message` any non-empty string) in this order: workflow-level findings first, then for every job in key order its job findings followed by each step's findings in step order.

The workflow is `{ on, permissions, jobs }`; a job is `{ permissions, 'timeout-minutes', steps }`; a step is `{ uses, run, with }`. `path` is `'workflow'`, `'jobs.<id>'` or `'jobs.<id>.steps[<i>]'`.

**Workflow level**: `write-all` (error, path `'workflow'`) when `permissions === 'write-all'`.

**Per job**, in this order: `missing-permissions` (warning) when neither the job nor the workflow sets `permissions`; `write-all` (error) when the job's `permissions === 'write-all'`; `no-timeout` (warning) when `timeout-minutes` is missing.

**Per step**, in this order:
- `unpinned-action` (warning): `uses` is a remote action (not starting with `./` or `docker://`) whose ref is missing or not a full 40-character hex commit SHA.
- `pull-request-target-checkout` (error): the workflow's `on` includes `pull_request_target` (as the string, an array member or an object key), and the step `uses` something starting with `actions/checkout` whose `with.ref` text contains `github.event.pull_request.head` or `github.head_ref`.
- `script-injection` (error): `run` contains `${{ ... }}` with an expression mentioning `github.head_ref` or `github.event.` followed by `issue`, `pull_request`, `comment`, `review` or `head_commit` (attacker-controlled text pasted into a shell script).
- `secret-echo` (error): `run` contains `echo` followed on the same line by `${{ secrets.`.

```js
lintWorkflow({ on: 'push', permissions: {}, jobs: { t: { 'timeout-minutes': 5, steps: [{ uses: 'actions/checkout@v4' }] } } });
// [{ rule: 'unpinned-action', severity: 'warning', path: 'jobs.t.steps[0]', message: '...' }]
```

%% worked
**A similar problem, solved: `lintConfig(config)`** — a **list of independent rules**, each pushing findings with a precise **path**.

```js
function lintConfig(config) {
  const findings = [];
  const add = (rule, severity, path, message) => findings.push({ rule, severity, path, message });   // ① one helper keeps each rule to a single line
  if (config.debug === true) add('debug-on', 'error', 'config', 'Debug mode must be off');
  Object.keys(config.services ?? {}).forEach((name) => {                                            // ② key order is the order findings appear in
    const svc = config.services[name];
    if (!svc.image) add('no-image', 'error', `services.${name}`, 'Missing image');
    (svc.ports ?? []).forEach((port, i) => {
      if (port === 22) add('ssh-exposed', 'error', `services.${name}.ports[${i}]`, 'Do not expose SSH');   // ③ paths include the index
    });
  });
  return findings;
}
```

Write the linter as **one pass in the specified order** with an `add` helper, and put the tricky tests (`isPinned`, the `on` check, the injection regex) in **small named helpers**.

%% explain
- **`add`** helper; **workflow, job and step** levels in order.
- **`triggersPrTarget(on)`** helper for the three shapes of `on`.
- **Regexes** for injection and secret echo.

%% nudge
- Which `permissions` values count as "set"?
- Why does `${{ github.sha }}` in a run step not trigger `script-injection`?

%% starter
```js
export function lintWorkflow(workflow) {
  return [];
}
```

%% tests
```js
describe('lintWorkflow', () => {
  const sha = '8e5e7e5ab8b370d6c329ec480221332ada57f0ab';
  const clean = () => ({
    on: 'push',
    permissions: { contents: 'read' },
    jobs: { test: { 'timeout-minutes': 10, steps: [{ uses: 'actions/checkout@' + sha }, { run: 'npm test' }] } },
  });
  const summary = (list) => list.map(({ rule, severity, path }) => ({ rule, severity, path }));

  it('has no findings for a tidy workflow', () => {
    expect(lintWorkflow(clean())).toEqual([]);
  });
  it('flags a missing timeout and missing permissions, with messages', () => {
    const wf = clean();
    delete wf.permissions;
    delete wf.jobs.test['timeout-minutes'];
    const findings = lintWorkflow(wf);
    expect(summary(findings)).toEqual([
      { rule: 'missing-permissions', severity: 'warning', path: 'jobs.test' },
      { rule: 'no-timeout', severity: 'warning', path: 'jobs.test' },
    ]);
    expect(findings.every((f) => typeof f.message === 'string' && f.message.length > 0)).toBe(true);
  });
  it('accepts job-level permissions instead of workflow-level ones', () => {
    const wf = clean();
    delete wf.permissions;
    wf.jobs.test.permissions = { contents: 'read' };
    expect(lintWorkflow(wf)).toEqual([]);
  });
  it('flags write-all at both levels', () => {
    const wf = clean();
    wf.permissions = 'write-all';
    wf.jobs.test.permissions = 'write-all';
    expect(summary(lintWorkflow(wf))).toEqual([
      { rule: 'write-all', severity: 'error', path: 'workflow' },
      { rule: 'write-all', severity: 'error', path: 'jobs.test' },
    ]);
  });
  it('flags unpinned actions but not pinned, local or docker ones', () => {
    const wf = clean();
    wf.jobs.test.steps = [
      { uses: 'actions/setup-node@v4' },
      { uses: 'actions/cache' },
      { uses: './.github/actions/setup' },
      { uses: 'docker://alpine:3.19' },
      { uses: 'a/b@' + sha },
    ];
    expect(summary(lintWorkflow(wf))).toEqual([
      { rule: 'unpinned-action', severity: 'warning', path: 'jobs.test.steps[0]' },
      { rule: 'unpinned-action', severity: 'warning', path: 'jobs.test.steps[1]' },
    ]);
  });
  it('flags checking out untrusted code under pull_request_target, in every shape of on', () => {
    const step = { uses: 'actions/checkout@' + sha, with: { ref: '${{ github.event.pull_request.head.sha }}' } };
    for (const on of ['pull_request_target', ['push', 'pull_request_target'], { pull_request_target: { types: ['opened'] } }]) {
      const wf = clean();
      wf.on = on;
      wf.jobs.test.steps = [step];
      expect(summary(lintWorkflow(wf))).toEqual([
        { rule: 'pull-request-target-checkout', severity: 'error', path: 'jobs.test.steps[0]' },
      ]);
    }
    const safe = clean();
    safe.on = 'pull_request';
    safe.jobs.test.steps = [step];
    expect(lintWorkflow(safe)).toEqual([]);
    const defaultRef = clean();
    defaultRef.on = 'pull_request_target';
    defaultRef.jobs.test.steps = [{ uses: 'actions/checkout@' + sha }];
    expect(lintWorkflow(defaultRef)).toEqual([]);
  });
  it('flags script injection from attacker-controlled contexts only', () => {
    const wf = clean();
    wf.jobs.test.steps = [
      { run: 'echo "${{ github.event.pull_request.title }}"' },
      { run: 'git checkout ${{ github.head_ref }}' },
      { run: 'echo ${{ github.event.issue.title }} ${{ github.event.comment.body }}' },
      { run: 'echo ${{ github.sha }} ${{ github.event.repository.name }}' },
      { run: 'echo "$TITLE"' },
    ];
    expect(summary(lintWorkflow(wf)).map((f) => f.path)).toEqual([
      'jobs.test.steps[0]', 'jobs.test.steps[1]', 'jobs.test.steps[2]',
    ]);
    expect(lintWorkflow(wf).every((f) => f.rule === 'script-injection' && f.severity === 'error')).toBe(true);
  });
  it('flags echoing a secret', () => {
    const wf = clean();
    wf.jobs.test.steps = [{ run: 'echo ${{ secrets.TOKEN }}' }, { run: 'curl -H "Authorization: ${{ secrets.TOKEN }}" api' }];
    expect(summary(lintWorkflow(wf))).toEqual([{ rule: 'secret-echo', severity: 'error', path: 'jobs.test.steps[0]' }]);
  });
  it('reports several findings per step in the documented order', () => {
    const wf = clean();
    wf.on = 'pull_request_target';
    wf.jobs.test.steps = [
      { uses: 'actions/checkout@v4', with: { ref: '${{ github.head_ref }}' }, run: 'echo ${{ github.head_ref }}' },
    ];
    expect(summary(lintWorkflow(wf)).map((f) => f.rule)).toEqual(['unpinned-action', 'pull-request-target-checkout', 'script-injection']);
  });
  it('walks jobs in order and handles missing steps', () => {
    const wf = { on: 'push', permissions: {}, jobs: { b: {}, a: { 'timeout-minutes': 1, steps: [{ uses: 'x/y@v1' }] } } };
    expect(summary(lintWorkflow(wf))).toEqual([
      { rule: 'no-timeout', severity: 'warning', path: 'jobs.b' },
      { rule: 'unpinned-action', severity: 'warning', path: 'jobs.a.steps[0]' },
    ]);
  });
});
```

%% hints
- `const add = (rule, severity, path, message) => findings.push({ rule, severity, path, message });`
- `triggersPrTarget`: string equality, `Array.includes`, or `'pull_request_target' in on`.
- Injection regex: `/\$\{\{[^}]*github\.(?:head_ref|event\.(?:issue|pull_request|comment|review|head_commit))[^}]*\}\}/`.
- Echo regex: `/echo[^\n]*\$\{\{\s*secrets\./`.

%% solution
```js
export function lintWorkflow(workflow) {
  const findings = [];
  const add = (rule, severity, path, message) => findings.push({ rule, severity, path, message });

  const isPinned = (uses) => {
    const at = uses.lastIndexOf('@');
    return at !== -1 && /^[0-9a-f]{40}$/i.test(uses.slice(at + 1));
  };
  const on = workflow.on;
  const prTarget =
    on === 'pull_request_target' ||
    (Array.isArray(on) && on.includes('pull_request_target')) ||
    (on !== null && typeof on === 'object' && !Array.isArray(on) && 'pull_request_target' in on);
  const injection = /\$\{\{[^}]*github\.(?:head_ref|event\.(?:issue|pull_request|comment|review|head_commit))[^}]*\}\}/;
  const secretEcho = /echo[^\n]*\$\{\{\s*secrets\./;

  if (workflow.permissions === 'write-all') add('write-all', 'error', 'workflow', 'Do not grant write-all permissions.');

  for (const id of Object.keys(workflow.jobs ?? {})) {
    const job = workflow.jobs[id];
    const jobPath = 'jobs.' + id;
    if (job.permissions === undefined && workflow.permissions === undefined) {
      add('missing-permissions', 'warning', jobPath, 'Set explicit least-privilege permissions.');
    }
    if (job.permissions === 'write-all') add('write-all', 'error', jobPath, 'Do not grant write-all permissions.');
    if (job['timeout-minutes'] === undefined) add('no-timeout', 'warning', jobPath, 'Set timeout-minutes.');

    (job.steps ?? []).forEach((step, i) => {
      const path = `${jobPath}.steps[${i}]`;
      const uses = step.uses;
      if (typeof uses === 'string' && !uses.startsWith('./') && !uses.startsWith('docker://') && !isPinned(uses)) {
        add('unpinned-action', 'warning', path, 'Pin the action to a full commit SHA.');
      }
      if (
        prTarget &&
        typeof uses === 'string' &&
        uses.startsWith('actions/checkout') &&
        /github\.event\.pull_request\.head|github\.head_ref/.test(String(step.with && step.with.ref !== undefined ? step.with.ref : ''))
      ) {
        add('pull-request-target-checkout', 'error', path, 'Do not check out untrusted pull request code in pull_request_target.');
      }
      if (typeof step.run === 'string' && injection.test(step.run)) {
        add('script-injection', 'error', path, 'Pass untrusted values through an environment variable.');
      }
      if (typeof step.run === 'string' && secretEcho.test(step.run)) {
        add('secret-echo', 'error', path, 'Do not echo secrets.');
      }
    });
  }
  return findings;
}
```

%% exercise gx-check-expr | Tests for an expression evaluator | 4 | js | js | checkEvaluateIf | 42
`evaluateIf(expression, context)` evaluates a GitHub-style `if:`: string equality and `contains`/`startsWith`/`endsWith` ignore case; `&&` binds tighter than `||`; a missing context value is `null` (so `env.MISSING == 'undefined'` is false); and an expression that uses **no** status function gets an **implicit `success()`**, so it is false when `context.job.status` is `'failure'`. You are given `checkEvaluateIf(evaluateIf)`. Write a check that passes for a correct evaluator and **fails** for one that: **compares strings case-sensitively**, **gives `||` and `&&` the same precedence**, **forgets the implicit success()**, **turns a missing value into the string "undefined"**, **makes `contains` case-sensitive**.

```js
expect(evaluateIf("github.event_name == 'PUSH'", { github: { event_name: 'push' } })).toBe(true);
```

%% worked
**A similar problem, solved: `checkCalc(calc)`** — one input per **rule**, where the **wrong rule gives a different number**.

```js
export function checkCalc(calc) {                // calc('2 + 3 * 4')
  expect(calc('2 + 3 * 4')).toBe(14);            // ① precedence: left-to-right would give 20
  expect(calc('(2 + 3) * 4')).toBe(20);          // ② parentheses override it
  expect(calc('2 * 3 + 4')).toBe(10);            // ③ and the other order, so a "right-to-left" bug cannot hide
}
```

For the evaluator choose inputs where **the wrong answer is the opposite boolean**: `true || false && false` is `true` with the right precedence and `false` with equal precedence; a failing job with the expression `true` is `false` with an implicit `success()` and `true` without it.

%% explain
- **One expression per rule**, chosen so the buggy version flips the result.
- **Context** that makes the difference visible (a lower-case value compared with upper-case text, a failing job).
- Use a context that **lacks** the value for the null-versus-"undefined" case.

%% nudge
- Which two inputs separate case-sensitive from case-insensitive comparison?
- How do you check the implicit `success()` without a status function in the expression?

%% starter
```js
export function checkEvaluateIf(evaluateIf) {
  const ctx = { github: { event_name: 'push' }, job: { status: 'success' } };
  expect(evaluateIf("github.event_name == 'push'", ctx)).toBe(true);
  // your assertions: case, precedence, implicit success, missing values, contains
}
```

%% tests
```js
const make = (f = {}) => (expression, context = {}) => {
  let src = expression.trim();
  const wrapped = /^\$\{\{([\s\S]*)\}\}$/.exec(src);
  if (wrapped) src = wrapped[1].trim();
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "'") {
      let j = i + 1, text = '';
      for (;;) {
        if (j >= src.length) throw new Error('invalid expression');
        if (src[j] === "'") { if (src[j + 1] === "'") { text += "'"; j += 2; continue; } break; }
        text += src[j++];
      }
      tokens.push({ t: 'str', v: text }); i = j + 1; continue;
    }
    const two = src.slice(i, i + 2);
    if (['&&', '||', '==', '!='].includes(two)) { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if ('()!,'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    const num = /^-?\d+(?:\.\d+)?/.exec(src.slice(i));
    if (num) { tokens.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][\w.-]*/.exec(src.slice(i));
    if (id) { tokens.push({ t: 'id', v: id[0] }); i += id[0].length; continue; }
    throw new Error('invalid expression');
  }
  const status = (context.job && context.job.status) || 'success';
  let usedStatus = false;
  const truthy = (v) => !(v === false || v === 0 || v === '' || v === null || v === undefined || Number.isNaN(v));
  const toNumber = (v) => (v === null || v === undefined ? 0 : v === true ? 1 : v === false ? 0 : typeof v === 'number' ? v : Number(v));
  const looseEq = (a, b) => {
    if (typeof a === 'string' && typeof b === 'string') return f.caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();
    return toNumber(a) === toNumber(b);
  };
  const text = (v, keep) => { const s = String(v === null || v === undefined ? '' : v); return keep ? s : s.toLowerCase(); };
  let p = 0;
  const isOp = (v) => p < tokens.length && tokens[p].t === 'op' && tokens[p].v === v;
  const call = (name, args) => {
    switch (name.toLowerCase()) {
      case 'success': usedStatus = true; return status === 'success';
      case 'failure': usedStatus = true; return status === 'failure';
      case 'cancelled': usedStatus = true; return status === 'cancelled';
      case 'always': usedStatus = true; return true;
      case 'contains': return Array.isArray(args[0]) ? args[0].some((x) => looseEq(x, args[1])) : text(args[0], f.caseSensitiveContains).includes(text(args[1], f.caseSensitiveContains));
      case 'startswith': return text(args[0]).startsWith(text(args[1]));
      case 'endswith': return text(args[0]).endsWith(text(args[1]));
      default: throw new Error('unknown function: ' + name);
    }
  };
  const parseOr = () => {
    let left = f.flatPrecedence ? parseEq() : parseAnd();
    while (isOp('||') || (f.flatPrecedence && isOp('&&'))) {
      const op = tokens[p++].v;
      const right = f.flatPrecedence ? parseEq() : parseAnd();
      left = op === '||' ? (truthy(left) ? left : right) : (truthy(left) ? right : left);
    }
    return left;
  };
  const parseAnd = () => {
    let left = parseEq();
    while (isOp('&&')) { p++; const right = parseEq(); left = truthy(left) ? right : left; }
    return left;
  };
  const parseEq = () => {
    let left = parseUnary();
    while (isOp('==') || isOp('!=')) { const op = tokens[p++].v; const right = parseUnary(); const same = looseEq(left, right); left = op === '==' ? same : !same; }
    return left;
  };
  const parseUnary = () => { if (isOp('!')) { p++; return !truthy(parseUnary()); } return parsePrimary(); };
  const parsePrimary = () => {
    const tok = tokens[p++];
    if (!tok) throw new Error('invalid expression');
    if (tok.t === 'str' || tok.t === 'num') return tok.v;
    if (tok.t === 'op') { if (tok.v !== '(') throw new Error('invalid expression'); const v = parseOr(); if (!isOp(')')) throw new Error('invalid expression'); p++; return v; }
    if (isOp('(')) {
      p++;
      const args = [];
      if (!isOp(')')) { args.push(parseOr()); while (isOp(',')) { p++; args.push(parseOr()); } }
      if (!isOp(')')) throw new Error('invalid expression');
      p++;
      return call(tok.v, args);
    }
    if (tok.v === 'true') return true;
    if (tok.v === 'false') return false;
    if (tok.v === 'null') return null;
    let value = context;
    for (const key of tok.v.split('.')) { if (value === null || value === undefined) return f.undefinedString ? 'undefined' : null; value = value[key]; }
    return value === undefined ? (f.undefinedString ? 'undefined' : null) : value;
  };
  if (tokens.length === 0) throw new Error('invalid expression');
  const value = parseOr();
  if (p < tokens.length) throw new Error('invalid expression');
  return usedStatus || f.noImplicit ? truthy(value) : status === 'success' && truthy(value);
};

const correct = make();
const mutants = {
  'compares strings case-sensitively': make({ caseSensitive: true }),
  'gives || and && the same precedence': make({ flatPrecedence: true }),
  'forgets the implicit success()': make({ noImplicit: true }),
  'turns a missing value into the string "undefined"': make({ undefinedString: true }),
  'makes contains case-sensitive': make({ caseSensitiveContains: true }),
};

describe('your checkEvaluateIf', () => {
  it('passes on a correct evaluator', () => {
    checkEvaluateIf(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an evaluator that ${name}`, () => {
      let caught = false;
      try { checkEvaluateIf(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Case: `github.event_name == 'PUSH'` with `'push'` in the context must be `true`.
- Precedence: `true || false && false` must be `true`.
- Implicit success: `true` with `{ job: { status: 'failure' } }` must be `false`; `always()` there must be `true`.
- Missing: `env.MISSING == 'undefined'` must be `false`, `env.MISSING == null` `true`.
- Contains: `contains('Hello World', 'WORLD')` must be `true`.

%% solution
```js
export function checkEvaluateIf(evaluateIf) {
  const ctx = { github: { event_name: 'push', ref: 'refs/heads/main' }, env: { MODE: 'prod' }, job: { status: 'success' } };
  const failing = { ...ctx, job: { status: 'failure' } };

  expect(evaluateIf("github.event_name == 'push'", ctx)).toBe(true);
  expect(evaluateIf("github.event_name == 'PUSH'", ctx)).toBe(true);
  expect(evaluateIf("github.event_name == 'pull_request'", ctx)).toBe(false);
  expect(evaluateIf("github.event_name != 'PUSH'", ctx)).toBe(false);

  expect(evaluateIf('true || false && false', ctx)).toBe(true);
  expect(evaluateIf('(true || false) && false', ctx)).toBe(false);
  expect(evaluateIf('false && false || true', ctx)).toBe(true);

  expect(evaluateIf('true', failing)).toBe(false);
  expect(evaluateIf("github.event_name == 'push'", failing)).toBe(false);
  expect(evaluateIf('always()', failing)).toBe(true);
  expect(evaluateIf('failure()', failing)).toBe(true);

  expect(evaluateIf('env.MISSING', ctx)).toBe(false);
  expect(evaluateIf("env.MISSING == 'undefined'", ctx)).toBe(false);
  expect(evaluateIf('env.MISSING == null', ctx)).toBe(true);

  expect(evaluateIf("contains('Hello World', 'WORLD')", ctx)).toBe(true);
  expect(evaluateIf("contains(github.ref, 'MAIN')", ctx)).toBe(true);
  expect(evaluateIf("contains(github.ref, 'release')", ctx)).toBe(false);
}
```
