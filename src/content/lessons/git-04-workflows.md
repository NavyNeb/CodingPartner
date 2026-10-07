---
id: git-workflows
track: git
title: Team workflows and conventions
summary: Trunk-based development vs Gitflow, what a good pull request and branch protection look like, CODEOWNERS routing, and how Conventional Commits and semantic versioning turn commit messages into version bumps and changelogs.
---

## The idea in one sentence

Git lets you do almost anything; a **workflow** is the **small set of agreements** that stops a team from doing everything at once: where work happens, how it gets reviewed, what must pass before it lands, and how a release number is chosen.

> **Analogy** Traffic rules. Nothing physical stops two cars entering a junction together; **rules** (lights, priority, speed limits) are what make busy roads safe and fast. Branch protection is the light, CODEOWNERS says who has priority, and commit conventions are the road signs everyone reads the same way.

*(On GitHub these are branch protection rules or rulesets, `CODEOWNERS`, required reviews and checks, merge queues, and tools such as release-please or semantic-release that read your commit messages.)*

## Branching models

![Workflows](fig:gt-workflows "Short-lived branches into main, or long-lived develop and release branches.")

| Model | Idea | Good for | Cost |
| --- | --- | --- | --- |
| **Trunk-based** | tiny branches merged to `main` **daily**; unfinished work behind **feature flags** | web apps, continuous delivery | needs good CI and flags |
| **GitHub flow** | one branch per change, a **pull request**, merge to `main`, deploy | most teams | `main` must always be deployable |
| **Gitflow** | `develop`, `release/*`, `hotfix/*` plus `main` | scheduled, versioned releases (mobile, on-prem) | long-lived branches, painful merges |

The deciding factor is **how often you can ship**. The less often you integrate, the **bigger and riskier** each merge becomes.

## A good pull request

- **Small**: one reason to change, reviewable in minutes. Large changes get skimmed, not reviewed.
- **A description that says why**, how it was tested, and what to look at; link the issue.
- **Draft** until the author is happy with it; **reviewers** respond fast, because slow review is the biggest cost of a PR workflow.
- **Automated checks first**: formatting and tests should never be a reviewer's job.

## Protecting the main branch

![Branch protection](fig:gt-protection "Every gate must be open for the merge button to work.")

Typical rules for `main`: **required approvals** (not from the author), a **code-owner** review for the files touched, **required status checks** must pass, the branch must be **up to date** with `main`, optionally a **linear history**, and **stale approvals dismissed** when new commits are pushed. A **merge queue** tests each PR **on top of the queue ahead of it**, so two PRs that pass alone cannot break `main` together.

**CODEOWNERS** maps paths to owners with gitignore-style patterns; the **last matching rule wins**, so put the general rule first and the specific ones after it.

## Conventional Commits and SemVer

![Conventional commits](fig:gt-conventional "Commit type decides the next version.")

A **Conventional Commit** has a header `type(scope)!: subject`, an optional body and **footers** (`BREAKING CHANGE: ...`, `Closes #12`). Because the shape is predictable, tools can compute the next **semantic version** `MAJOR.MINOR.PATCH` and write the **changelog**:

- a **breaking change** (the `!` or a `BREAKING CHANGE` footer) → **major**;
- **`feat`** → **minor**; **`fix`** and **`perf`** → **patch**;
- everything else (`docs`, `chore`, `refactor`, `test`, `ci`) → **no release**;
- the **highest** bump among the commits since the last release wins, and a bump **resets the lower numbers** (`1.4.7` + feature = `1.5.0`).

```js try predict
const bump = (types) =>
  types.includes('breaking') ? 'major'
  : types.includes('feat') ? 'minor'
  : types.some((t) => t === 'fix' || t === 'perf') ? 'patch'
  : 'none';

console.log(bump(['fix', 'feat']), bump(['docs', 'chore']), bump(['feat', 'breaking']));
```

```stepper A change from branch to release
code:
  git switch -c fix/login-timeout
  git commit -m "fix(auth): refresh token before it expires"
  open PR → checks pass → 1 approval + code owner
  merge → release tool reads commits since v1.4.7
---
line: 1
say: A **short-lived branch** off an up-to-date `main`. The name says what it is for.
phase: branch
---
line: 2
say: The commit message follows the convention: type `fix`, scope `auth`. That one word tells tooling this is a **patch** release.
phase: commit
---
line: 3
say: The PR runs the **required checks**; branch protection needs **an approval from someone other than the author**, and a **code owner** for `auth/`.
phase: review
---
line: 4
say: After merging, a release tool collects every commit since `v1.4.7`, takes the **highest bump** (patch here), tags `v1.4.8` and writes the **changelog** from the messages.
phase: release
```

## Quick check

```check
Q: Why are short-lived branches preferred for most teams?
A) Git cannot handle long branches
B) The longer a branch lives, the bigger and riskier its merge becomes *
C) Short branches run tests faster
D) It saves disk space
Why: Frequent integration keeps conflicts small and feedback fast.
---
Q: A release has these commits since 2.3.1: a fix, a feat, a docs change. What is the next version?
A) 2.3.2
B) 2.4.0 *
C) 3.0.0
D) 2.3.1
Why: The highest bump (feat → minor) wins and resets the patch number.
---
Q: In CODEOWNERS, two rules match the same file. Which applies?
A) The first
B) The last *
C) Both
D) The most specific by length
Why: Later rules override earlier ones, so list general rules first.
---
Q: What does a merge queue add over "require branch to be up to date"?
A) Nothing
B) It tests each PR on top of the PRs ahead of it, without everyone re-merging by hand *
C) It skips CI
D) It squashes commits
Why: It serialises integration so combined changes are tested together.
```

## Recap

- **Trunk-based** and **GitHub flow** (short branches, PRs) vs **Gitflow** (long-lived branches): choose by how often you can ship.
- A good PR is **small, explained, automated-checked, quickly reviewed**.
- **Branch protection**: approvals (not the author), code owner, required checks, up to date, optional linear history, dismiss stale approvals; **merge queue** for combined safety.
- **CODEOWNERS**: gitignore-style patterns, **last match wins**.
- **Conventional Commits** + **SemVer**: breaking → major, feat → minor, fix/perf → patch, others none; highest bump wins and resets lower numbers.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: commit type | A regular expression with a capture group |
| Parse a conventional commit | Header regex, paragraphs, footers |
| Next version and changelog | A max over bump levels, string building |
| Branch protection | Distinct counts, per-rule reasons |
| CODEOWNERS matching | Converting glob patterns to regular expressions |
| Tests for the version bump | Cases that separate each wrong bump |

%% exercise gx-guided-type | Guided: commit type | 1 | js | js | commitType | 8 | guided
Implement `commitType(message)`: return the **type** of a conventional commit header (the lowercase word before an optional `(scope)`, an optional `!`, then `: `) or `null` if the first line is not in that form.

```js
commitType('feat(api)!: remove v1'); // 'feat'
commitType('fixed the thing');       // null
```

%% worked
**A similar problem, solved: `ticketId(branch)`** — a regex with one capture group, applied to the first line.

```js
function ticketId(branch) {
  const m = /^(?:feature|bugfix)\/([A-Z]+-\d+)-/.exec(branch);     // ① the part you want is in parentheses
  return m ? m[1] : null;                                           // ② m[1] is the first capture group; no match gives null
}
```

Use `message.split('\n')[0]` for the header, and anchor the regex with `^` so a colon in the body is not mistaken for a header.

%% explain
- **First line only.**
- **Regex**: `^([a-z]+)(\([^)]+\))?!?: .+`.
- `null` when it does not match.

%% nudge
- Why must the regex be anchored at the start?

%% starter
```js
export function commitType(message) {
  return null;
}
```

%% tests
```js
describe('commitType', () => {
  it('reads the type', () => {
    expect(commitType('feat: add search')).toBe('feat');
    expect(commitType('fix(auth): refresh token')).toBe('fix');
    expect(commitType('feat(api)!: remove v1')).toBe('feat');
    expect(commitType('feat!: remove v1')).toBe('feat');
  });
  it('looks only at the first line', () => {
    expect(commitType('feat: a\n\nfix: b')).toBe('feat');
    expect(commitType('just a note\nfeat: not a header')).toBeNull();
  });
  it('returns null for anything else', () => {
    for (const bad of ['fixed the thing', 'Feat: capital', 'feat:nospace', 'feat: ', '', 'feat(): empty scope']) {
      expect(commitType(bad)).toBeNull();
    }
  });
});
```

%% hints
- `/^([a-z]+)(?:\([^)]+\))?!?: \S/.exec(message.split('\n')[0])`

%% solution
```js
export function commitType(message) {
  const m = /^([a-z]+)(?:\([^)]+\))?!?: \S/.exec(message.split('\n')[0]);
  return m ? m[1] : null;
}
```

%% exercise gx-parse-commit | Parse a conventional commit | 3 | js | js | parseCommit | 34
`parseCommit(message)` returns `{ type, scope, breaking, subject, body, footers }` or `null` when the header is not valid.

- **Header** (first line): `type(scope)!: subject` with a lowercase-letters `type`, an optional `(scope)` (non-empty, no `)` inside), an optional `!`, then `: ` and a non-empty `subject`. Anything else → `null`.
- `scope` is the text inside the parentheses or `null`.
- After the header, drop leading blank lines. Split the rest into **paragraphs** (separated by blank lines). The **last paragraph** is the **footers** if **every** line of it looks like `Token: value`, where `Token` is `BREAKING CHANGE`, `BREAKING-CHANGE`, or letters, digits and hyphens starting with a letter. Each footer is `{ token, value }`. Otherwise there are no footers.
- `body` is the remaining paragraphs joined with a blank line (`'\n\n'`), or `''`.
- `breaking` is true when the header has `!` **or** any footer token starts with `BREAKING`.

```js
parseCommit('feat(api)!: drop v1\n\nExplain why.\n\nBREAKING CHANGE: v1 is gone');
// { type: 'feat', scope: 'api', breaking: true, subject: 'drop v1', body: 'Explain why.', footers: [{ token: 'BREAKING CHANGE', value: 'v1 is gone' }] }
```

%% worked
**A similar problem, solved: `parseTicket(text)`** — a header line, then paragraphs where the **last one may be a block of key-value lines**.

```js
function parseTicket(text) {
  const [header, ...rest] = text.split('\n');
  const paragraphs = rest.join('\n').trim().split(/\n\s*\n/).filter(Boolean);     // ① blank-line separated blocks
  const last = paragraphs[paragraphs.length - 1] ?? '';
  const isMeta = last !== '' && last.split('\n').every((l) => /^[A-Za-z-]+: .+$/.test(l));   // ② EVERY line must look like a key-value
  const meta = isMeta ? paragraphs.pop().split('\n').map((l) => { const i = l.indexOf(': '); return { key: l.slice(0, i), value: l.slice(i + 2) }; }) : [];
  return { header, body: paragraphs.join('\n\n'), meta };                         // ③ whatever is left is the body
}
```

The "every line must match" check is what stops an ordinary last paragraph with a stray colon from being swallowed as footers.

%% explain
- **Header** regex with three optional parts.
- **Paragraphs** after the header; **last paragraph** is footers if all lines match.
- **breaking** from the bang or a footer.

%% nudge
- What if the whole message is just a header?
- Why must every line of the last paragraph match?

%% starter
```js
export function parseCommit(message) {
  return null;
}
```

%% tests
```js
describe('parseCommit', () => {
  it('parses a bare header', () => {
    expect(parseCommit('fix: handle empty input')).toEqual({
      type: 'fix', scope: null, breaking: false, subject: 'handle empty input', body: '', footers: [],
    });
  });
  it('parses a scope and the breaking bang', () => {
    expect(parseCommit('feat(api)!: drop v1')).toMatchObject({ type: 'feat', scope: 'api', breaking: true, subject: 'drop v1' });
    expect(parseCommit('feat!: drop v1')).toMatchObject({ scope: null, breaking: true });
    expect(parseCommit('feat(ui kit): new button').scope).toBe('ui kit');
  });
  it('parses a body', () => {
    const c = parseCommit('fix: x\n\nFirst paragraph.\n\nSecond paragraph.');
    expect(c.body).toBe('First paragraph.\n\nSecond paragraph.');
    expect(c.footers).toEqual([]);
  });
  it('parses footers and marks BREAKING CHANGE', () => {
    const c = parseCommit('feat: x\n\nWhy it matters.\n\nBREAKING CHANGE: old flag removed\nCloses: 12');
    expect(c.body).toBe('Why it matters.');
    expect(c.footers).toEqual([{ token: 'BREAKING CHANGE', value: 'old flag removed' }, { token: 'Closes', value: '12' }]);
    expect(c.breaking).toBe(true);
    expect(parseCommit('fix: x\n\nBREAKING-CHANGE: y').breaking).toBe(true);
  });
  it('treats a footer-only message as footers, not a body', () => {
    const c = parseCommit('fix: x\n\nReviewed-by: Ada');
    expect(c.body).toBe('');
    expect(c.footers).toEqual([{ token: 'Reviewed-by', value: 'Ada' }]);
  });
  it('does not mistake a normal last paragraph for footers', () => {
    const c = parseCommit('fix: x\n\nNote: this is wrong\nbut it continues without a footer shape');
    expect(c.footers).toEqual([]);
    expect(c.body).toBe('Note: this is wrong\nbut it continues without a footer shape');
  });
  it('is not breaking without a bang or a BREAKING footer', () => {
    expect(parseCommit('feat: x\n\nCloses: 3').breaking).toBe(false);
  });
  it('tolerates extra blank lines', () => {
    expect(parseCommit('fix: x\n\n\n\nbody\n\n').body).toBe('body');
  });
  it('rejects invalid headers', () => {
    for (const bad of ['Fix: x', 'fix:x', 'fix: ', 'fix', 'just text', '', 'fix(): x', 'fix (a): x']) {
      expect(parseCommit(bad)).toBeNull();
    }
  });
});
```

%% hints
- Header: `/^([a-z]+)(?:\(([^)]+)\))?(!)?: (\S.*)$/`.
- `rest = lines.slice(1).join('\n').trim()`; `rest.split(/\n\s*\n/)` for paragraphs.
- Footer line: `/^(BREAKING[ -]CHANGE|[A-Za-z][A-Za-z0-9-]*): (.+)$/`.

%% solution
```js
export function parseCommit(message) {
  const lines = message.split('\n');
  const m = /^([a-z]+)(?:\(([^)]+)\))?(!)?: (\S.*)$/.exec(lines[0]);
  if (!m) return null;

  const rest = lines.slice(1).join('\n').trim();
  const paragraphs = rest === '' ? [] : rest.split(/\n\s*\n/);
  const footerLine = /^(BREAKING[ -]CHANGE|[A-Za-z][A-Za-z0-9-]*): (.+)$/;
  let footers = [];
  const last = paragraphs[paragraphs.length - 1];
  if (last !== undefined && last.split('\n').every((l) => footerLine.test(l))) {
    footers = paragraphs.pop().split('\n').map((l) => {
      const [, token, value] = footerLine.exec(l);
      return { token, value };
    });
  }
  return {
    type: m[1],
    scope: m[2] ?? null,
    breaking: Boolean(m[3]) || footers.some((f) => f.token.startsWith('BREAKING')),
    subject: m[4],
    body: paragraphs.join('\n\n'),
    footers,
  };
}
```

%% exercise gx-semver | Next version and changelog | 4 | js | js | nextVersion, changelog | 38
Commits here are already parsed: `{ type, scope, breaking, subject }`.

`nextVersion(version, commits)`: `version` must be `MAJOR.MINOR.PATCH` (digits only), else throw `Error('invalid version: ' + version)`. The highest bump among the commits decides: any `breaking` → **major** (`X+1.0.0`); else any `feat` → **minor** (`X.Y+1.0`); else any `fix` or `perf` → **patch** (`X.Y.Z+1`); otherwise (no commits, or only other types) return `version` **unchanged**.

`changelog(version, commits)` returns Markdown: the line `## <version>`, then these sections **in this order**, each separated by a blank line and **omitted when empty**: `### BREAKING CHANGES` (every commit with `breaking`), `### Features` (type `feat`), `### Bug Fixes` (type `fix`), `### Performance` (type `perf`). Each entry is `- **scope:** subject` or `- subject` when there is no scope, in input order. A breaking `feat` appears in **both** sections. Commits of other types are left out. No trailing newline.

```js
nextVersion('1.4.7', [{ type: 'feat' }, { type: 'fix' }]); // '1.5.0'
```

%% worked
**A similar problem, solved: `nextBuild(version, changes)`** — pick the **highest** level among many inputs, then **reset** the lower parts.

```js
function nextBuild(version, changes) {
  const [major, minor, patch] = version.split('.').map(Number);
  const level = changes.some((c) => c.big) ? 3 : changes.some((c) => c.medium) ? 2 : changes.some((c) => c.small) ? 1 : 0;   // ① one number for the highest level present
  if (level === 3) return `${major + 1}.0.0`;                  // ② a bigger bump zeroes everything below it
  if (level === 2) return `${major}.${minor + 1}.0`;
  if (level === 1) return `${major}.${minor}.${patch + 1}`;
  return version;                                               // ③ no relevant change: no new version
}
```

Compute the bump from **all** commits (not the first or the last), or a later `fix` could "downgrade" an earlier `feat`.

%% explain
- **Validate** the version string.
- **Highest bump** over all commits; **reset** lower numbers.
- **Sections** in a fixed order, built from filtered commits.

%% nudge
- Which commit decides the bump when there are several types?
- Where does a breaking `fix` appear in the changelog?

%% starter
```js
export function nextVersion(version, commits) {
  return version;
}

export function changelog(version, commits) {
  return '## ' + version;
}
```

%% tests
```js
describe('nextVersion', () => {
  const c = (type, breaking = false) => ({ type, breaking, subject: 's' });
  it('bumps major for a breaking change and resets the rest', () => {
    expect(nextVersion('1.4.7', [c('feat', true)])).toBe('2.0.0');
    expect(nextVersion('1.4.7', [c('fix', true)])).toBe('2.0.0');
  });
  it('bumps minor for a feature and resets the patch', () => {
    expect(nextVersion('1.4.7', [c('feat')])).toBe('1.5.0');
  });
  it('bumps patch for a fix or perf change', () => {
    expect(nextVersion('1.4.7', [c('fix')])).toBe('1.4.8');
    expect(nextVersion('1.4.7', [c('perf')])).toBe('1.4.8');
  });
  it('does not release for other types or no commits', () => {
    expect(nextVersion('1.4.7', [c('chore'), c('docs'), c('refactor'), c('test'), c('ci')])).toBe('1.4.7');
    expect(nextVersion('1.4.7', [])).toBe('1.4.7');
  });
  it('lets the highest bump win whatever the order', () => {
    expect(nextVersion('1.4.7', [c('fix'), c('feat'), c('fix')])).toBe('1.5.0');
    expect(nextVersion('1.4.7', [c('feat'), c('fix', true), c('docs')])).toBe('2.0.0');
    expect(nextVersion('1.4.7', [c('docs'), c('fix')])).toBe('1.4.8');
  });
  it('handles multi-digit parts', () => {
    expect(nextVersion('9.99.109', [c('fix')])).toBe('9.99.110');
    expect(nextVersion('9.99.109', [c('feat')])).toBe('9.100.0');
    expect(nextVersion('9.99.109', [c('feat', true)])).toBe('10.0.0');
  });
  it('rejects invalid versions', () => {
    for (const bad of ['1.4', 'v1.4.7', '1.4.7-beta', '1.x.7', '']) {
      expect(() => nextVersion(bad, [])).toThrow('invalid version: ' + bad);
    }
  });
});

describe('changelog', () => {
  const c = (type, subject, scope = null, breaking = false) => ({ type, scope, breaking, subject });
  it('writes only the header for nothing to report', () => {
    expect(changelog('1.0.1', [])).toBe('## 1.0.1');
    expect(changelog('1.0.1', [c('chore', 'tidy')])).toBe('## 1.0.1');
  });
  it('groups entries into sections in a fixed order', () => {
    const text = changelog('1.5.0', [
      c('fix', 'stop crash', 'ui'),
      c('feat', 'add search'),
      c('perf', 'faster list'),
      c('feat', 'dark mode', 'ui'),
      c('docs', 'readme'),
    ]);
    expect(text).toBe(
      '## 1.5.0\n\n### Features\n- add search\n- **ui:** dark mode\n\n### Bug Fixes\n- **ui:** stop crash\n\n### Performance\n- faster list',
    );
  });
  it('lists breaking changes first, and also under their own type', () => {
    const text = changelog('2.0.0', [c('feat', 'new api', 'api', true), c('fix', 'typo')]);
    expect(text).toBe(
      '## 2.0.0\n\n### BREAKING CHANGES\n- **api:** new api\n\n### Features\n- **api:** new api\n\n### Bug Fixes\n- typo',
    );
  });
  it('lists a breaking commit of an unlisted type only as breaking', () => {
    expect(changelog('2.0.0', [c('refactor', 'rewrite core', null, true)])).toBe('## 2.0.0\n\n### BREAKING CHANGES\n- rewrite core');
  });
});
```

%% hints
- `const [major, minor, patch] = version.split('.').map(Number);` after `/^\d+\.\d+\.\d+$/`.
- `entry = (c) => (c.scope ? `- **${c.scope}:** ${c.subject}` : `- ${c.subject}`)`.
- Build `[['BREAKING CHANGES', breaking], ['Features', feats], ...]`, drop empty ones, and join blocks with `'\n\n'`.

%% solution
```js
export function nextVersion(version, commits) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('invalid version: ' + version);
  const [major, minor, patch] = version.split('.').map(Number);
  if (commits.some((c) => c.breaking)) return `${major + 1}.0.0`;
  if (commits.some((c) => c.type === 'feat')) return `${major}.${minor + 1}.0`;
  if (commits.some((c) => c.type === 'fix' || c.type === 'perf')) return `${major}.${minor}.${patch + 1}`;
  return version;
}

export function changelog(version, commits) {
  const entry = (c) => (c.scope ? `- **${c.scope}:** ${c.subject}` : `- ${c.subject}`);
  const sections = [
    ['BREAKING CHANGES', commits.filter((c) => c.breaking)],
    ['Features', commits.filter((c) => c.type === 'feat')],
    ['Bug Fixes', commits.filter((c) => c.type === 'fix')],
    ['Performance', commits.filter((c) => c.type === 'perf')],
  ];
  const blocks = sections
    .filter(([, list]) => list.length > 0)
    .map(([title, list]) => `### ${title}\n${list.map(entry).join('\n')}`);
  return ['## ' + version, ...blocks].join('\n\n');
}
```

%% exercise gx-protection | Evaluate branch protection | 3 | js | js | evaluateMerge | 32
`evaluateMerge(pr, rules)` says whether a pull request may be merged.

`rules` (all optional): `requiredApprovals` (default `0`), `requireCodeOwner` (`false`), `requiredChecks` (list of names, `[]`), `requireUpToDate` (`false`), `requireLinearHistory` (`false`), `dismissStale` (`false`).

`pr`: `{ author, headSha, approvals, checks, behindBase, hasMergeCommits }` where `approvals` is a list of `{ user, sha, codeOwner }` and `checks` maps a name to `'success'`, `'failure'` or `'pending'`.

- A **valid approval** comes from a user who is **not the author**, and, when `dismissStale` is true, was given on the **current `headSha`**. Count **distinct users**.
- Reasons, in this order (omit those that do not apply): `'approvals'` when the count is below `requiredApprovals`; `'code-owner'` when `requireCodeOwner` and no **valid** approval has `codeOwner` true; `'check:<name>'` for every required check, in rule order, whose state is not `'success'` (a missing check counts as failing); `'up-to-date'` when `requireUpToDate` and `behindBase`; `'linear-history'` when `requireLinearHistory` and `hasMergeCommits`.
- Return `{ allowed, reasons }`, `allowed` being true only with no reasons.

```js
evaluateMerge({ author: 'ada', approvals: [{ user: 'bob', sha: 's1' }], checks: {}, headSha: 's1' }, { requiredApprovals: 1 }); // { allowed: true, reasons: [] }
```

%% worked
**A similar problem, solved: `canDeploy(request, policy)`** — each rule independently adds a **reason**; the decision is "no reasons".

```js
function canDeploy(req, policy = {}) {
  const reasons = [];
  const voters = new Set(req.votes.filter((v) => v.user !== req.requester).map((v) => v.user));   // ① distinct, and not the requester
  if (voters.size < (policy.minVotes ?? 0)) reasons.push('votes');
  for (const name of policy.requiredGates ?? []) {
    if (req.gates[name] !== 'pass') reasons.push('gate:' + name);                                  // ② a missing gate is NOT a pass
  }
  return { allowed: reasons.length === 0, reasons };                                                // ③ report EVERY problem, not just the first
}
```

Collecting **all** reasons (instead of returning at the first) is what makes the message useful: "needs 1 approval **and** the lint check is failing".

%% explain
- **Valid approvals**: not the author, current sha if dismissing stale; count distinct users.
- **Reasons** appended in the stated order.
- **`allowed`** = no reasons.

%% nudge
- What counts as a missing required check?
- Does an approval by the author count towards the minimum?

%% starter
```js
export function evaluateMerge(pr, rules = {}) {
  return { allowed: true, reasons: [] };
}
```

%% tests
```js
describe('evaluateMerge', () => {
  const pr = (extra = {}) => ({
    author: 'ada',
    headSha: 's2',
    approvals: [],
    checks: {},
    behindBase: false,
    hasMergeCommits: false,
    ...extra,
  });

  it('allows anything with no rules', () => {
    expect(evaluateMerge(pr())).toEqual({ allowed: true, reasons: [] });
    expect(evaluateMerge(pr(), {})).toEqual({ allowed: true, reasons: [] });
  });
  it('requires enough approvals from distinct non-authors', () => {
    const rules = { requiredApprovals: 2 };
    const approvals = [{ user: 'bob', sha: 's2' }, { user: 'bob', sha: 's2' }, { user: 'ada', sha: 's2' }];
    expect(evaluateMerge(pr({ approvals }), rules).reasons).toEqual(['approvals']);
    expect(evaluateMerge(pr({ approvals: [...approvals, { user: 'cy', sha: 's2' }] }), rules).allowed).toBe(true);
  });
  it('can dismiss stale approvals', () => {
    const approvals = [{ user: 'bob', sha: 's1' }, { user: 'cy', sha: 's2' }];
    expect(evaluateMerge(pr({ approvals }), { requiredApprovals: 2 }).allowed).toBe(true);
    expect(evaluateMerge(pr({ approvals }), { requiredApprovals: 2, dismissStale: true }).reasons).toEqual(['approvals']);
  });
  it('requires a code owner approval when asked, from a valid approval', () => {
    const rules = { requireCodeOwner: true };
    expect(evaluateMerge(pr({ approvals: [{ user: 'bob', sha: 's2' }] }), rules).reasons).toEqual(['code-owner']);
    expect(evaluateMerge(pr({ approvals: [{ user: 'bob', sha: 's2', codeOwner: true }] }), rules).allowed).toBe(true);
    expect(evaluateMerge(pr({ approvals: [{ user: 'ada', sha: 's2', codeOwner: true }] }), rules).reasons).toEqual(['code-owner']);
    expect(evaluateMerge(pr({ approvals: [{ user: 'bob', sha: 's1', codeOwner: true }] }), { ...rules, dismissStale: true }).reasons).toEqual(['code-owner']);
  });
  it('requires every named check to succeed, missing ones failing', () => {
    const rules = { requiredChecks: ['build', 'test', 'lint'] };
    const r = evaluateMerge(pr({ checks: { build: 'success', test: 'pending', other: 'failure' } }), rules);
    expect(r.reasons).toEqual(['check:test', 'check:lint']);
    expect(evaluateMerge(pr({ checks: { build: 'success', test: 'success', lint: 'success' } }), rules).allowed).toBe(true);
  });
  it('can require an up-to-date branch and a linear history', () => {
    expect(evaluateMerge(pr({ behindBase: true }), { requireUpToDate: true }).reasons).toEqual(['up-to-date']);
    expect(evaluateMerge(pr({ behindBase: true }), {}).allowed).toBe(true);
    expect(evaluateMerge(pr({ hasMergeCommits: true }), { requireLinearHistory: true }).reasons).toEqual(['linear-history']);
  });
  it('reports every problem in the documented order', () => {
    const r = evaluateMerge(
      pr({ behindBase: true, hasMergeCommits: true, checks: { build: 'failure' } }),
      { requiredApprovals: 1, requireCodeOwner: true, requiredChecks: ['build'], requireUpToDate: true, requireLinearHistory: true },
    );
    expect(r.allowed).toBe(false);
    expect(r.reasons).toEqual(['approvals', 'code-owner', 'check:build', 'up-to-date', 'linear-history']);
  });
});
```

%% hints
- `valid = approvals.filter((a) => a.user !== pr.author && (!rules.dismissStale || a.sha === pr.headSha))`
- `new Set(valid.map((a) => a.user)).size`
- `valid.some((a) => a.codeOwner)` for the code-owner rule.

%% solution
```js
export function evaluateMerge(pr, rules = {}) {
  const { requiredApprovals = 0, requireCodeOwner = false, requiredChecks = [], requireUpToDate = false, requireLinearHistory = false, dismissStale = false } = rules;
  const valid = pr.approvals.filter((a) => a.user !== pr.author && (!dismissStale || a.sha === pr.headSha));
  const reasons = [];
  if (new Set(valid.map((a) => a.user)).size < requiredApprovals) reasons.push('approvals');
  if (requireCodeOwner && !valid.some((a) => a.codeOwner)) reasons.push('code-owner');
  for (const name of requiredChecks) {
    if (pr.checks[name] !== 'success') reasons.push('check:' + name);
  }
  if (requireUpToDate && pr.behindBase) reasons.push('up-to-date');
  if (requireLinearHistory && pr.hasMergeCommits) reasons.push('linear-history');
  return { allowed: reasons.length === 0, reasons };
}
```

%% exercise gx-codeowners | CODEOWNERS matching | 4 | js | js | ownersFor | 40
`ownersFor(rules, path)` returns the owners of a file. `rules` is a list of `{ pattern, owners }` **in file order**; the **last rule that matches wins**; no match gives `[]`. `path` has no leading slash (`'src/app/main.test.js'`). Patterns follow gitignore style:

- A trailing `/` means a **directory**: it matches everything **inside** it (not a file with that name).
- A pattern that **starts with `/`** or has a `/` **elsewhere** in it is **anchored** to the repository root. Otherwise it may match at **any depth**.
- `*` matches any characters except `/`; `?` one character except `/`; `**` matches anything including `/`: `a/**/b` matches `a/b` and `a/x/y/b`, and `a/**` matches everything below `a/`.
- A pattern that matches a **directory name** also matches everything beneath it.

```js
ownersFor([{ pattern: '*', owners: ['@all'] }, { pattern: '/docs/', owners: ['@writers'] }], 'docs/a.md'); // ['@writers']
```

%% worked
**A similar problem, solved: `globToRegExp(glob)`** — translate a small glob language into a regular expression, character by character.

```js
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') { re += '.*'; i++; }          // ① '**' crosses directories
    else if (ch === '*') re += '[^/]*';                                  // ② '*' stays inside one path segment
    else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');                  // ③ escape characters that are special in regexes
  }
  return new RegExp('^' + re + '$');
}
```

For CODEOWNERS add four wrinkles: handle **`**/`** (zero or more directories), **anchoring** (prefix `^` versus `^(?:.*/)?`), a **directory** pattern that must match something inside, and "matching a directory also matches what is under it" (suffix `(?:/.*)?`).

%% explain
- **Normalise** the pattern: dir-only, anchored, strip the leading `/`.
- **Convert** to a regex source with `**/`, `/**`, `**`, `*`, `?`.
- **Loop all rules**, keep the last match.

%% nudge
- Which patterns are anchored to the root?
- What is the difference between `docs/` and `docs`?

%% starter
```js
export function ownersFor(rules, path) {
  return [];
}
```

%% tests
```js
describe('ownersFor', () => {
  const rules = [
    { pattern: '*', owners: ['@everyone'] },
    { pattern: '*.js', owners: ['@js'] },
    { pattern: '/docs/', owners: ['@writers'] },
    { pattern: '/src/**/*.test.js', owners: ['@qa'] },
    { pattern: 'package.json', owners: ['@build'] },
  ];

  it('uses the catch-all for everything else', () => {
    expect(ownersFor(rules, 'README.md')).toEqual(['@everyone']);
    expect(ownersFor(rules, 'deep/er/file.txt')).toEqual(['@everyone']);
  });
  it('matches a file extension at any depth', () => {
    expect(ownersFor(rules, 'a.js')).toEqual(['@js']);
    expect(ownersFor(rules, 'lib/x/y/z.js')).toEqual(['@js']);
  });
  it('anchors a directory pattern to the root and matches its contents', () => {
    expect(ownersFor(rules, 'docs/guide.md')).toEqual(['@writers']);
    expect(ownersFor(rules, 'docs/a/b/c.md')).toEqual(['@writers']);
    expect(ownersFor(rules, 'src/docs/guide.md')).toEqual(['@everyone']);
  });
  it('lets the last matching rule win', () => {
    expect(ownersFor(rules, 'src/app/main.test.js')).toEqual(['@qa']);
    expect(ownersFor(rules, 'src/main.test.js')).toEqual(['@qa']);
    expect(ownersFor(rules, 'src/app/main.js')).toEqual(['@js']);
    expect(ownersFor(rules, 'lib/main.test.js')).toEqual(['@js']);
  });
  it('matches a bare file name at any depth', () => {
    expect(ownersFor(rules, 'package.json')).toEqual(['@build']);
    expect(ownersFor(rules, 'apps/web/package.json')).toEqual(['@build']);
    expect(ownersFor(rules, 'my-package.json')).toEqual(['@everyone']);
  });
  it('returns an empty list when nothing matches', () => {
    expect(ownersFor([{ pattern: '/docs/', owners: ['@w'] }], 'src/a.js')).toEqual([]);
    expect(ownersFor([], 'a')).toEqual([]);
  });
  it('supports a trailing ** and an unanchored directory pattern', () => {
    const r = [{ pattern: '/apps/web/**', owners: ['@web'] }, { pattern: 'assets/', owners: ['@design'] }];
    expect(ownersFor(r, 'apps/web/src/a.ts')).toEqual(['@web']);
    expect(ownersFor(r, 'apps/api/a.ts')).toEqual([]);
    expect(ownersFor(r, 'assets/logo.svg')).toEqual(['@design']);
    expect(ownersFor(r, 'apps/web/assets/logo.svg')).toEqual(['@design']);
  });
  it('treats a directory pattern as not matching a file of the same name', () => {
    expect(ownersFor([{ pattern: 'build/', owners: ['@ci'] }], 'build')).toEqual([]);
    expect(ownersFor([{ pattern: 'build/', owners: ['@ci'] }], 'build/out.js')).toEqual(['@ci']);
  });
  it('supports ? and escapes dots', () => {
    const r = [{ pattern: 'file?.txt', owners: ['@a'] }];
    expect(ownersFor(r, 'file1.txt')).toEqual(['@a']);
    expect(ownersFor(r, 'file12.txt')).toEqual([]);
    expect(ownersFor([{ pattern: 'a.b', owners: ['@x'] }], 'aXb')).toEqual([]);
  });
  it('returns a copy of the owners', () => {
    const r = [{ pattern: '*', owners: ['@a'] }];
    ownersFor(r, 'x').push('@evil');
    expect(r[0].owners).toEqual(['@a']);
  });
});
```

%% hints
- `dirOnly = p.endsWith('/')` (then strip it); `anchored = p.startsWith('/') || p.includes('/')` (after stripping the trailing slash); strip the leading `/`.
- Regex source pieces: `**/` → `(?:.*/)?`, `/**` at the end → `/.*`, `**` → `.*`, `*` → `[^/]*`, `?` → `[^/]`.
- Prefix `^` if anchored else `^(?:.*/)?`; suffix `/.*$` for directory patterns else `(?:/.*)?$`.

%% solution
```js
export function ownersFor(rules, path) {
  const toRegExp = (pattern) => {
    let p = pattern;
    const dirOnly = p.endsWith('/');
    if (dirOnly) p = p.slice(0, -1);
    const anchored = p.startsWith('/') || p.includes('/');
    p = p.replace(/^\//, '');

    let re = '';
    for (let i = 0; i < p.length; i++) {
      if (p.startsWith('**/', i)) {
        re += '(?:.*/)?';
        i += 2;
      } else if (p.startsWith('/**', i) && i + 3 === p.length) {
        re += '/.*';
        i += 2;
      } else if (p.startsWith('**', i)) {
        re += '.*';
        i += 1;
      } else if (p[i] === '*') re += '[^/]*';
      else if (p[i] === '?') re += '[^/]';
      else re += p[i].replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp((anchored ? '^' : '^(?:.*/)?') + re + (dirOnly ? '/.*$' : '(?:/.*)?$'));
  };

  let owners = [];
  for (const rule of rules) {
    if (toRegExp(rule.pattern).test(path)) owners = rule.owners;
  }
  return [...owners];
}
```

%% exercise gx-check-semver | Tests for the version bump | 4 | js | js | checkNextVersion | 36
`nextVersion(version, commits)` takes `MAJOR.MINOR.PATCH` and parsed commits `{ type, breaking }`. Any breaking commit gives `X+1.0.0`; else any `feat` gives `X.Y+1.0`; else any `fix` or `perf` gives `X.Y.Z+1`; otherwise the version is returned unchanged; the highest bump wins whatever the order; an invalid version throws. You are given `checkNextVersion(nextVersion)`. Write a check that passes for a correct implementation and **fails** for one that: **keeps the minor number after a major bump**, **keeps the patch number after a minor bump**, **lets the last commit decide instead of the highest bump**, **bumps for chore commits**, **treats a breaking change as a minor bump**, **accepts an invalid version**.

```js
expect(nextVersion('1.4.7', [{ type: 'feat', breaking: false }])).toBe('1.5.0');
```

%% worked
**A similar problem, solved: `checkNextBuild(nextBuild)`** — one assertion per rule, with a **starting number whose parts are all different**, so a forgotten reset shows.

```js
export function checkNextBuild(nextBuild) {                 // nextBuild('1.4.7', changes)
  expect(nextBuild('1.4.7', [{ big: true }])).toBe('2.0.0');           // ① 4 and 7 must RESET: with 1.0.0 you could not tell
  expect(nextBuild('1.4.7', [{ medium: true }])).toBe('1.5.0');        // ② 7 must reset
  expect(nextBuild('1.4.7', [{ small: true }])).toBe('1.4.8');
  expect(nextBuild('1.4.7', [{ small: true }, { medium: true }, { small: true }])).toBe('1.5.0');   // ③ the highest wins, not the last
  expect(nextBuild('1.4.7', [])).toBe('1.4.7');
}
```

Use a version like `1.4.7` (every part non-zero and different) so "forgot to reset" and "bumped the wrong part" both change the answer.

%% explain
- **Distinct non-zero parts** in the starting version.
- **One test per bump**, then **order** (highest, not last).
- **No-release types**, a **breaking fix**, and an **invalid version**.

%% nudge
- Why is `0.0.0` a poor starting version for these tests?
- Which input separates "highest bump" from "last commit"?

%% starter
```js
export function checkNextVersion(nextVersion) {
  expect(nextVersion('1.4.7', [{ type: 'feat', breaking: false }])).toBe('1.5.0');
  // your assertions: major, patch, order, no release, invalid version
}
```

%% tests
```js
const make = (f = {}) => (version, commits) => {
  if (!f.acceptInvalid && !/^\d+\.\d+\.\d+$/.test(version)) throw new Error('invalid version: ' + version);
  const [major, minor, patch] = version.split('.').map(Number);
  const level = (c) => (c.breaking ? (f.breakingMinor ? 2 : 3) : c.type === 'feat' ? 2 : c.type === 'fix' || c.type === 'perf' || (f.bumpChore && c.type === 'chore') ? 1 : 0);
  const pick = f.lastWins ? (commits.length ? level(commits[commits.length - 1]) : 0) : Math.max(0, ...commits.map(level));
  if (pick === 3) return f.keepMinor ? `${major + 1}.${minor}.${patch}` : `${major + 1}.0.0`;
  if (pick === 2) return f.keepPatch ? `${major}.${minor + 1}.${patch}` : `${major}.${minor + 1}.0`;
  if (pick === 1) return `${major}.${minor}.${patch + 1}`;
  return version;
};

const correct = make();
const mutants = {
  'keeps the minor number after a major bump': make({ keepMinor: true }),
  'keeps the patch number after a minor bump': make({ keepPatch: true }),
  'lets the last commit decide instead of the highest bump': make({ lastWins: true }),
  'bumps for chore commits': make({ bumpChore: true }),
  'treats a breaking change as a minor bump': make({ breakingMinor: true }),
  'accepts an invalid version': make({ acceptInvalid: true }),
};

describe('your checkNextVersion', () => {
  it('passes on a correct implementation', () => {
    checkNextVersion(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an implementation that ${name}`, () => {
      let caught = false;
      try { checkNextVersion(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Start from `1.4.7`.
- `[feat]` → `1.5.0`, `[fix]` → `1.4.8`, `[breaking fix]` → `2.0.0`.
- `[fix, feat, fix]` → `1.5.0`; `[feat, chore]` → `1.5.0`; `[chore]` alone → unchanged.
- `expect(() => nextVersion('1.4', [])).toThrow()`.

%% solution
```js
export function checkNextVersion(nextVersion) {
  const c = (type, breaking = false) => ({ type, breaking, subject: 's' });

  expect(nextVersion('1.4.7', [c('feat', true)])).toBe('2.0.0');
  expect(nextVersion('1.4.7', [c('fix', true)])).toBe('2.0.0');
  expect(nextVersion('1.4.7', [c('feat')])).toBe('1.5.0');
  expect(nextVersion('1.4.7', [c('fix')])).toBe('1.4.8');
  expect(nextVersion('1.4.7', [c('perf')])).toBe('1.4.8');

  expect(nextVersion('1.4.7', [c('chore')])).toBe('1.4.7');
  expect(nextVersion('1.4.7', [c('docs'), c('test')])).toBe('1.4.7');
  expect(nextVersion('1.4.7', [])).toBe('1.4.7');

  expect(nextVersion('1.4.7', [c('fix'), c('feat'), c('fix')])).toBe('1.5.0');
  expect(nextVersion('1.4.7', [c('feat'), c('chore')])).toBe('1.5.0');
  expect(nextVersion('1.4.7', [c('feat'), c('fix', true), c('docs')])).toBe('2.0.0');

  expect(() => nextVersion('1.4', [])).toThrow();
  expect(() => nextVersion('v1.4.7', [])).toThrow();
}
```
