---
id: sec-supply-chain-secrets
track: sec
title: Dependencies, secrets & the supply chain
summary: Most of the code you ship isn't yours: version ranges and lockfiles, auditing packages (vulnerabilities, hashes, sources, typosquats), finding secrets before they leak, and loading configuration without printing it.
---

## The idea in one sentence

You are responsible for **everything you run**, including code you didn't write and secrets you must not print, so **know what you depend on, pin it, check it, and keep credentials out of sight**.

> **Analogy** A restaurant kitchen. The chef's cooking is only part of the risk: the ingredients come from suppliers (dependencies), who get them from other suppliers (transitive dependencies). A careful kitchen knows its suppliers, checks deliveries against the order (lockfile and hashes), reads recall notices (advisories), and keeps the safe's combination off the whiteboard (secrets).

## The supply chain

![The software supply chain](fig:sec-supply-chain "Most of what you ship was written by people you never reviewed.")

A typical app has dozens of direct dependencies and **hundreds of transitive ones**. Attackers know it, so they target the chain: **compromised maintainer accounts**, **malicious install scripts**, **typosquatted names** (`lodahs`), **dependency confusion** (a public package with the same name as your private one), and **abandoned packages** taken over by new owners.

Habits that matter:

- **Fewer dependencies.** Every package is code with your permissions. Don't add one for ten lines.
- **Pin and verify.** Commit the **lockfile** and install with `npm ci`.
- **Audit and update.** Watch advisories (`npm audit`, Dependabot) and update **regularly in small steps**, so a critical patch isn't a big-bang upgrade.
- **Review changes**, especially lockfile diffs and new install scripts.

## Version ranges and lockfiles

`package.json` says which versions are **acceptable**; the lockfile records what was **actually installed**, with a **hash**.

![Ranges versus the lockfile](fig:sec-lockfile "The manifest allows a range; the lockfile pins one version and its integrity hash.")

Understanding **semver ranges** is practical security knowledge:

```stepper What the range operators allow
code:
  ^1.2.3   →  >=1.2.3 <2.0.0
  ^0.2.3   →  >=0.2.3 <0.3.0
  ^0.0.3   →  >=0.0.3 <0.0.4
  ~1.2.3   →  >=1.2.3 <1.3.0
---
line: 1
say: **Caret** allows changes that don't alter the **leftmost non-zero** number: any `1.x.y` from `1.2.3`, never `2.0.0`. This is the default when you `npm install` a package.
upper bound: 2.0.0 (excluded)
---
line: 2
say: For `0.x` versions the **minor** is the leftmost non-zero number, so `^0.2.3` stops before `0.3.0`: pre-1.0 packages treat minor bumps as potentially breaking.
upper bound: 0.3.0 (excluded)
---
line: 3
say: With `0.0.x` even a **patch** bump may break things, so `^0.0.3` allows nothing beyond `0.0.3` itself (the upper bound is `0.0.4`, excluded).
upper bound: 0.0.4 (excluded)
---
line: 4
say: **Tilde** is narrower: patch updates only, so `~1.2.3` allows `1.2.9` but not `1.3.0`.
upper bound: 1.3.0 (excluded)
```

```js try predict
// Why version numbers must be compared as numbers, not text
const asText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
console.log(asText('1.10.0', '1.9.0'));        // text order says 1.10.0 is OLDER

const asNumbers = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
};
console.log(asNumbers('1.10.0', '1.9.0'));     // numbers say it is NEWER, which is right
```

A version check that gets this wrong can decide that a **vulnerable old version is fine** (or that a fixed one isn't).

## Auditing what you install

A useful audit looks at several things per package: is the **version below a fixed release** for a known advisory, is there an **integrity hash** (and a strong one: `sha512`), does it come from your **trusted registry over HTTPS**, and is the **name suspiciously close to a popular package** (edit distance 1)?

## Secrets

![Handling secrets](fig:sec-secrets "Out of the code, into the runtime, out of the logs, and rotated if exposed.")

- **Never commit secrets**: not in code, not in committed `.env` files, not in test fixtures. Git history is **forever**: deleting a file later doesn't un-leak it.
- **Scan** commits and CI for known patterns (AWS key ids, private-key headers, provider tokens) and **high-entropy** strings next to words like `secret` or `token`. Placeholders such as `changeme` or `${API_KEY}` are fine.
- **Assume leaked means compromised**: **rotate first**, then clean up.
- **Load configuration deliberately**: validate it at startup, report **every** problem at once, and never include secret values in error messages or startup logs.

## Quick check

```check
Q: What does `^0.2.3` allow?
A) Any 0.x or 1.x
B) >=0.2.3 and <0.3.0 *
C) Exactly 0.2.3
D) >=0.2.3 and <1.0.0
Why: For 0.x versions caret treats the minor number as the breaking-change boundary.
---
Q: Why commit the lockfile and install with `npm ci`?
A) It is faster to type
B) You get the exact versions and hashes that were reviewed, on every machine *
C) It updates dependencies automatically
D) It removes the need for package.json
Why: The lockfile pins versions and verifies integrity, giving reproducible installs.
---
Q: What is typosquatting?
A) Typing too fast
B) Publishing a package whose name is a near-miss of a popular one, hoping for installs by mistake *
C) A syntax error
D) A kind of cache bug
Why: One wrong letter in an install command can install an attacker's code.
---
Q: You committed an API key and then deleted it in the next commit. What now?
A) It is safe
B) Assume it is compromised: rotate it, since history still contains it *
C) Rename the branch
D) Add it to .gitignore
Why: Anyone who cloned or scraped the repository still has it.
---
Q: Why must a config loader avoid putting secret values in its error messages?
A) Messages must be short
B) Errors reach logs and dashboards, which many people can read *
C) Secrets are numbers
D) Errors are encrypted
Why: Say "API_KEY must be at least 16 characters", not what it was.
```

## Recap

- Your app is mostly **other people's code**: fewer dependencies, **lockfile + `npm ci`**, review changes, update often.
- **Semver ranges**: caret and tilde bounds (and the `0.x` special cases); compare versions **numerically**.
- **Audit**: advisories, integrity hashes, trusted sources, typosquats.
- **Secrets**: never in git; scan; **rotate if exposed**; least privilege.
- **Config**: validate at startup, collect all errors, **never print secrets**.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: compare versions | Splitting on dots and comparing numbers |
| A semver range matcher | Parsing partial versions; caret, tilde, comparators, `||` |
| A lockfile audit | The `URL` class; edit distance; sorting findings |
| A secret scanner | Regular expressions, line numbers and Shannon entropy |
| A safe config loader | Per-type parsing, collecting all errors, masking secrets |
| Tests for a range matcher | Boundaries and the `0.x` special cases |

%% exercise sec-guided-semver | Guided: compare versions | 1 | js | js | compareVersions | 8 | guided
Implement `compareVersions(a, b)` for dotted numeric versions such as `1.10.0`. Return `-1` if `a` is older than `b`, `1` if newer, `0` if equal. Compare **numerically**, part by part; missing parts count as `0` (`'1.2'` equals `'1.2.0'`); a leading `v` is ignored.

```js
compareVersions('1.10.0', '1.9.0'); // 1   (not -1!)
```

%% worked
**A similar problem, solved: `maxVersion(list)`** — numeric comparison, part by part.

```js
function compare(a, b) {
  const x = a.replace(/^v/, '').split('.').map(Number);
  const y = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? 0, q = y[i] ?? 0;                  // ① a missing part is 0
    if (p !== q) return p < q ? -1 : 1;                  // ② the first difference decides
  }
  return 0;
}
export const maxVersion = (list) => list.reduce((best, v) => (compare(v, best) > 0 ? v : best));
```

Comparing the **strings** would put `'1.10.0'` before `'1.9.0'` (because `'1' < '9'` character by character). Version checks that do this wrongly trust old, vulnerable releases.

%% explain
- **Strip a leading `v`**, split on `.`, convert to numbers.
- **Compare part by part**; missing parts are `0`.
- **Return `-1`, `0` or `1`.**

%% nudge
- Why does `'1.10.0' < '1.9.0'` hold for strings?
- How many parts do you need to compare when the two versions have different lengths?

%% starter
```js
export function compareVersions(a, b) {
  // Step 1 — strip a leading v and split on dots, converting to numbers
  // Step 2 — compare part by part (missing parts are 0)
  return 0;
}
```

%% tests
```js
describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('10.0.0', '9.99.99')).toBe(1);
  });
  it('compares major, minor and patch in order', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
  });
  it('is 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });
  it('treats missing parts as zero', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0);
    expect(compareVersions('1', '1.0.0')).toBe(0);
    expect(compareVersions('1.2', '1.2.1')).toBe(-1);
    expect(compareVersions('1.2.1', '1.2')).toBe(1);
  });
  it('ignores a leading v', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('v2.0.0', 'v1.0.0')).toBe(1);
  });
});
```

%% hints
- `const parts = (v) => v.replace(/^v/, '').split('.').map(Number);`
- `for (let i = 0; i < Math.max(x.length, y.length); i++) { const p = x[i] ?? 0, q = y[i] ?? 0; if (p !== q) return p < q ? -1 : 1; }`

%% solution
```js
export function compareVersions(a, b) {
  const parts = (v) => v.replace(/^v/, '').split('.').map(Number);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}
```

%% exercise sec-semver-range | A semver range matcher | 4 | js | js | satisfies | 40
Implement `satisfies(version, range)`. A `version` is `MAJOR.MINOR.PATCH` (optional leading `v`, optional `-prerelease`, optional `+build`). An invalid version or range gives `false` (never throws).

- A `range` is **alternatives** separated by `||` (any may match); each alternative is **comparators** separated by whitespace (all must match). An empty alternative or `*`/`x` matches any version.
- Comparators: exact (`1.2.3`, `=1.2.3`), `>`, `>=`, `<`, `<=`, `^`, `~`, with optional whitespace after the operator (`>= 1.2.3`).
- **Partial versions** and x-ranges: `1`, `1.2`, `1.x`, `1.2.x`. With no operator they mean `>=1.0.0 <2.0.0` (for `1`) or `>=1.2.0 <1.3.0` (for `1.2`). With operators: `>=1.2` is `>=1.2.0`; `<1.2` is `<1.2.0`; `>1.2` is `>=1.3.0`; `<=1.2` is `<1.3.0`; `>1` is `>=2.0.0`; `<=1` is `<2.0.0`.
- `^`: `>=` the version and `<` the next change of the leftmost **non-zero** part: `^1.2.3` is `<2.0.0`, `^0.2.3` is `<0.3.0`, `^0.0.3` is `<0.0.4`; partials: `^1.2` is `<2.0.0`, `^0.2` is `<0.3.0`, `^0.0` is `<0.1.0`, `^0` is `<1.0.0`.
- `~`: `>=` the version and `<` the next minor (`~1.2.3` is `<1.3.0`); `~1` is `<2.0.0`.
- A version with a **prerelease** tag satisfies a range **only if** the range, after trimming and removing a leading `=` or `v`, is exactly that version. (This keeps unstable builds out of ordinary ranges.)

```js
satisfies('1.9.5', '^1.2.3');           // true
satisfies('2.0.0', '^1.2.3');           // false
satisfies('1.10.0', '>=1.9.0 <2.0.0');  // true
```

%% worked
**A similar problem, solved: `inRange(version, '>=A <B')`** — turn each comparator into bounds, then test both.

```js
function toTriple(text) { return text.split('.').map(Number); }
function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;   // ① numeric, left to right
  return 0;
}
export function inRange(version, range) {
  const v = toTriple(version);
  return range.split(/\s+/).every((token) => {                                   // ② all comparators must hold
    const m = /^(>=|<)(.+)$/.exec(token);
    const bound = toTriple(m[2]);
    return m[1] === '>=' ? cmp(v, bound) >= 0 : cmp(v, bound) < 0;               // ③ lower bounds inclusive, upper exclusive
  });
}
```

Every operator can be rewritten as a **lower bound (inclusive)** and/or an **upper bound (exclusive)**: `^1.2.3` is `lo = [1,2,3]`, `hi = [2,0,0]`. Compute those two triples per comparator and your matcher is just `cmp(v, lo) >= 0 && cmp(v, hi) < 0`. Compare **numbers**, never strings.

%% explain
- **Alternatives** with `some`, **comparators** with `every`.
- Each comparator becomes an optional **lower (inclusive)** and **upper (exclusive)** bound.
- **Partial versions** change the bounds as described.
- **Prereleases** only match themselves exactly.

%% nudge
- How do you express `>1.2` as a lower bound?
- Which part decides the upper bound of a caret range?

%% starter
```js
export function satisfies(version, range) {
  return false;
}
```

%% tests
```js
describe('satisfies', () => {
  it('matches exact versions', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.3', '=1.2.3')).toBe(true);
    expect(satisfies('v1.2.3', '1.2.3')).toBe(true);
    expect(satisfies('1.2.4', '1.2.3')).toBe(false);
  });
  it('compares numerically', () => {
    expect(satisfies('1.10.0', '>=1.9.0')).toBe(true);
    expect(satisfies('1.9.0', '<1.10.0')).toBe(true);
    expect(satisfies('1.10.0', '<1.9.0')).toBe(false);
    expect(satisfies('10.0.0', '>9.0.0')).toBe(true);
  });
  it('handles the basic comparators', () => {
    expect(satisfies('2.0.0', '>1.9.9')).toBe(true);
    expect(satisfies('2.0.0', '>2.0.0')).toBe(false);
    expect(satisfies('2.0.0', '>=2.0.0')).toBe(true);
    expect(satisfies('1.9.9', '<2.0.0')).toBe(true);
    expect(satisfies('2.0.0', '<2.0.0')).toBe(false);
    expect(satisfies('2.0.0', '<=2.0.0')).toBe(true);
    expect(satisfies('2.0.1', '<=2.0.0')).toBe(false);
    expect(satisfies('1.2.3', '>= 1.2.3')).toBe(true);
  });
  it('handles caret ranges, including 0.x', () => {
    expect(satisfies('1.2.3', '^1.2.3')).toBe(true);
    expect(satisfies('1.9.9', '^1.2.3')).toBe(true);
    expect(satisfies('1.2.2', '^1.2.3')).toBe(false);
    expect(satisfies('2.0.0', '^1.2.3')).toBe(false);
    expect(satisfies('0.2.9', '^0.2.3')).toBe(true);
    expect(satisfies('0.3.0', '^0.2.3')).toBe(false);
    expect(satisfies('0.2.2', '^0.2.3')).toBe(false);
    expect(satisfies('0.0.3', '^0.0.3')).toBe(true);
    expect(satisfies('0.0.4', '^0.0.3')).toBe(false);
  });
  it('handles caret ranges with partial versions', () => {
    expect(satisfies('1.9.0', '^1.2')).toBe(true);
    expect(satisfies('2.0.0', '^1.2')).toBe(false);
    expect(satisfies('0.2.9', '^0.2')).toBe(true);
    expect(satisfies('0.3.0', '^0.2')).toBe(false);
    expect(satisfies('0.0.9', '^0.0')).toBe(true);
    expect(satisfies('0.1.0', '^0.0')).toBe(false);
    expect(satisfies('0.9.0', '^0')).toBe(true);
    expect(satisfies('1.0.0', '^0')).toBe(false);
    expect(satisfies('1.5.0', '^1')).toBe(true);
  });
  it('handles tilde ranges', () => {
    expect(satisfies('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfies('1.2.2', '~1.2.3')).toBe(false);
    expect(satisfies('1.3.0', '~1.2.3')).toBe(false);
    expect(satisfies('1.9.0', '~1')).toBe(true);
    expect(satisfies('2.0.0', '~1')).toBe(false);
    expect(satisfies('1.2.9', '~1.2')).toBe(true);
    expect(satisfies('1.3.0', '~1.2')).toBe(false);
  });
  it('handles x-ranges and partial versions', () => {
    expect(satisfies('1.2.5', '1.2.x')).toBe(true);
    expect(satisfies('1.3.0', '1.2.x')).toBe(false);
    expect(satisfies('1.5.0', '1.x')).toBe(true);
    expect(satisfies('2.0.0', '1.x')).toBe(false);
    expect(satisfies('1.2.9', '1.2')).toBe(true);
    expect(satisfies('1.3.0', '1.2')).toBe(false);
    expect(satisfies('1.9.9', '1')).toBe(true);
    expect(satisfies('2.0.0', '1')).toBe(false);
    expect(satisfies('9.9.9', '*')).toBe(true);
    expect(satisfies('9.9.9', 'x')).toBe(true);
    expect(satisfies('9.9.9', '')).toBe(true);
  });
  it('handles partial versions with operators', () => {
    expect(satisfies('1.2.0', '>=1.2')).toBe(true);
    expect(satisfies('1.1.9', '>=1.2')).toBe(false);
    expect(satisfies('1.1.9', '<1.2')).toBe(true);
    expect(satisfies('1.2.0', '<1.2')).toBe(false);
    expect(satisfies('1.3.0', '>1.2')).toBe(true);
    expect(satisfies('1.2.9', '>1.2')).toBe(false);
    expect(satisfies('1.2.9', '<=1.2')).toBe(true);
    expect(satisfies('1.3.0', '<=1.2')).toBe(false);
    expect(satisfies('2.0.0', '>1')).toBe(true);
    expect(satisfies('1.9.9', '>1')).toBe(false);
    expect(satisfies('1.9.9', '<=1')).toBe(true);
    expect(satisfies('2.0.0', '<=1')).toBe(false);
  });
  it('combines comparators with AND and alternatives with OR', () => {
    expect(satisfies('1.3.0', '>=1.2.0 <1.4.0')).toBe(true);
    expect(satisfies('1.5.0', '>=1.2.0 <1.4.0')).toBe(false);
    expect(satisfies('1.1.0', '>=1.2.0 <1.4.0')).toBe(false);
    expect(satisfies('3.1.0', '^1.0.0 || ^3.0.0')).toBe(true);
    expect(satisfies('1.5.0', '^1.0.0 || ^3.0.0')).toBe(true);
    expect(satisfies('2.0.0', '^1.0.0 || ^3.0.0')).toBe(false);
    expect(satisfies('2.0.0', '<1.0.0 || >=2.0.0')).toBe(true);
  });
  it('keeps prereleases out of ordinary ranges', () => {
    expect(satisfies('1.2.3-beta.1', '^1.0.0')).toBe(false);
    expect(satisfies('1.2.3-beta.1', '*')).toBe(false);
    expect(satisfies('1.2.3-beta.1', '>=1.0.0')).toBe(false);
    expect(satisfies('1.2.3-beta.1', '1.2.3-beta.1')).toBe(true);
    expect(satisfies('v1.2.3-beta.1', '=1.2.3-beta.1')).toBe(true);
    expect(satisfies('1.2.3-beta.2', '1.2.3-beta.1')).toBe(false);
  });
  it('ignores build metadata', () => {
    expect(satisfies('1.2.3+build.5', '^1.2.0')).toBe(true);
  });
  it('returns false for invalid input instead of throwing', () => {
    for (const [v, r] of [['nonsense', '^1.0.0'], ['1.2', '^1.0.0'], ['1.2.3', 'banana'], ['1.2.3', '>=a.b.c'], [null, '*'], ['1.2.3', '^']]) {
      expect(satisfies(v, r)).toBe(false);
    }
  });
});
```

%% hints
- `parseVersion`: `/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/`.
- `parsePartial`: `/^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/`; once a part is a wildcard or missing, the following parts are too.
- Join operators to their versions first: `alt.replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1')`.
- A comparator is `{ lo, hi }`: check `cmp(v, lo) >= 0` and `cmp(v, hi) < 0`.

%% solution
```js
const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
};

function parseVersion(text) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(text).trim());
  return m ? { t: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] } : null;
}

function parsePartial(text) {
  const m = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/.exec(text);
  if (!m) return null;
  const part = (s) => (s === undefined || /^[xX*]$/.test(s) ? undefined : Number(s));
  let [M, mi, p] = [part(m[1]), part(m[2]), part(m[3])];
  if (M === undefined) {
    mi = undefined;
    p = undefined;
  } else if (mi === undefined) {
    p = undefined;
  }
  return { M, m: mi, p };
}

function bounds(token) {
  const m = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(token);
  const op = m[1] || '=';
  const v = parsePartial(m[2]);
  if (!v) return null;
  if (v.M === undefined) return {};
  const lower = [v.M, v.m ?? 0, v.p ?? 0];
  const nextOfSpecified = v.p !== undefined ? [v.M, v.m, v.p + 1] : v.m !== undefined ? [v.M, v.m + 1, 0] : [v.M + 1, 0, 0];
  switch (op) {
    case '=':
      return { lo: lower, hi: nextOfSpecified };
    case '>=':
      return { lo: lower };
    case '>':
      return { lo: nextOfSpecified };
    case '<':
      return { hi: lower };
    case '<=':
      return { hi: nextOfSpecified };
    case '~':
      return { lo: lower, hi: v.m === undefined ? [v.M + 1, 0, 0] : [v.M, v.m + 1, 0] };
    case '^': {
      let hi;
      if (v.M > 0) hi = [v.M + 1, 0, 0];
      else if (v.m === undefined) hi = [1, 0, 0];
      else if (v.m > 0) hi = [0, v.m + 1, 0];
      else if (v.p === undefined) hi = [0, 1, 0];
      else hi = [0, 0, v.p + 1];
      return { lo: lower, hi };
    }
    default:
      return null;
  }
}

export function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v) return false;
  const norm = (s) => String(s).trim().replace(/^[=v]+/, '');
  if (v.pre !== undefined) return norm(range) === norm(version);
  const alternatives = String(range).split('||');
  return alternatives.some((alt) => {
    const tokens = alt.trim().replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1').split(/\s+/).filter(Boolean);
    return tokens.every((token) => {
      const b = bounds(token);
      if (!b) return false;
      return (b.lo === undefined || cmp(v.t, b.lo) >= 0) && (b.hi === undefined || cmp(v.t, b.hi) < 0);
    });
  });
}
```

%% exercise sec-audit-lock | A lockfile audit | 4 | js | js | auditLock | 38
Implement `auditLock(lock, { advisories = [], registries = [], popular = [] } = {})`.

`lock` is an array of `{ name, version, resolved, integrity }`. Return findings `{ id, severity, package, message }` (`message` a non-empty string), sorted by severity (`critical`, `high`, `moderate`, `low`), then `package`, then `id`.

- **Vulnerable** version: for each advisory `{ id, name, below, severity }` whose `name` matches the package, if the package's version is **older than** `below` (compare numerically on `MAJOR.MINOR.PATCH`, ignoring any `-prerelease`/`+build` suffix), add a finding with the **advisory's id and severity**.
- **Missing integrity**: no `integrity` string gives `missing-integrity` (`moderate`). An integrity that doesn't start with `sha256-`, `sha384-` or `sha512-` (for example `sha1-…`) gives `weak-integrity` (`moderate`).
- **Untrusted source**: if `resolved` is given and, parsed with `URL`, its protocol isn't `https:` **or** its host isn't in `registries` (exact, case-insensitive), add `untrusted-source` (`high`). An unparseable `resolved` is also untrusted. If `resolved` is absent, add nothing.
- **Possible typosquat**: a package name whose **Levenshtein edit distance to a `popular` name is exactly 1** (names must be at least 4 characters long, and a name that is itself in `popular` is never flagged) gives `possible-typosquat` (`moderate`).
- Findings are produced per package; a clean lockfile gives `[]`.

```js
auditLock([{ name: 'lodash', version: '4.17.15', integrity: 'sha512-x', resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.15.tgz' }],
  { advisories: [{ id: 'ADV-1', name: 'lodash', below: '4.17.21', severity: 'high' }], registries: ['registry.npmjs.org'] });
```

%% worked
**A similar problem, solved: `checkLicenses(packages, allowed)`** — one list of independent per-package rules, sorted at the end.

```js
const RANK = { critical: 0, high: 1, moderate: 2, low: 3 };

export function checkLicenses(packages, allowed) {
  const findings = [];
  for (const p of packages) {                                              // ① every package is checked against every rule
    if (!p.license) findings.push({ id: 'no-license', severity: 'low', package: p.name, message: `${p.name} has no license` });
    else if (!allowed.includes(p.license)) findings.push({ id: 'license-not-allowed', severity: 'moderate', package: p.name, message: `${p.name} uses ${p.license}` });
  }
  return findings.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.package.localeCompare(b.package) || a.id.localeCompare(b.id));   // ② a predictable report
}
```

For **typosquats**, compute the edit distance with a small dynamic-programming table; you only need to know whether it is **exactly 1**. Use the `URL` class for sources (`new URL(resolved).host`), never string `includes`, or `https://registry.npmjs.org.evil.example/` would pass.

%% explain
- **Vulnerable**: compare the numeric version with `below`.
- **Integrity**: missing or weak.
- **Source**: HTTPS and an allowlisted registry host, via `URL`.
- **Typosquat**: edit distance exactly 1 to a popular name.
- **Sorted** by severity, package, id.

%% nudge
- Why must the host be compared exactly rather than with `includes`?
- How would you compute the distance between two strings?

%% starter
```js
export function auditLock(lock, { advisories = [], registries = [], popular = [] } = {}) {
  return [];
}
```

%% tests
```js
const pkg = (extra = {}) => ({
  name: 'left-pad', version: '1.3.0', integrity: 'sha512-abc', resolved: 'https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz', ...extra,
});
const registries = ['registry.npmjs.org'];
const ids = (findings) => findings.map((f) => f.id);

describe('auditLock', () => {
  it('returns no findings for a clean lockfile', () => {
    expect(auditLock([pkg()], { registries })).toEqual([]);
    expect(auditLock([])).toEqual([]);
  });
  it('flags vulnerable versions using the advisory id and severity', () => {
    const advisories = [{ id: 'ADV-1', name: 'left-pad', below: '1.3.1', severity: 'high' }];
    const f = auditLock([pkg()], { advisories, registries });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ id: 'ADV-1', severity: 'high', package: 'left-pad' });
    expect(typeof f[0].message).toBe('string');
    expect(f[0].message.length).toBeGreaterThan(0);
  });
  it('compares versions numerically and respects the boundary', () => {
    const advisories = [{ id: 'A', name: 'left-pad', below: '1.10.0', severity: 'low' }];
    expect(ids(auditLock([pkg({ version: '1.9.0' })], { advisories, registries }))).toEqual(['A']);
    expect(ids(auditLock([pkg({ version: '1.10.0' })], { advisories, registries }))).toEqual([]);
    expect(ids(auditLock([pkg({ version: '1.10.1' })], { advisories, registries }))).toEqual([]);
    expect(ids(auditLock([pkg({ version: '1.9.0-beta.1' })], { advisories, registries }))).toEqual(['A']);
  });
  it('only applies advisories to the matching package', () => {
    const advisories = [{ id: 'A', name: 'other', below: '9.0.0', severity: 'critical' }];
    expect(auditLock([pkg()], { advisories, registries })).toEqual([]);
  });
  it('flags missing and weak integrity', () => {
    expect(ids(auditLock([pkg({ integrity: undefined })], { registries }))).toEqual(['missing-integrity']);
    expect(ids(auditLock([pkg({ integrity: '' })], { registries }))).toEqual(['missing-integrity']);
    expect(ids(auditLock([pkg({ integrity: 'sha1-abc' })], { registries }))).toEqual(['weak-integrity']);
    expect(ids(auditLock([pkg({ integrity: 'sha256-abc' })], { registries }))).toEqual([]);
    expect(ids(auditLock([pkg({ integrity: 'sha384-abc' })], { registries }))).toEqual([]);
  });
  it('flags untrusted sources, using the parsed host', () => {
    const untrusted = (resolved) => ids(auditLock([pkg({ resolved })], { registries }));
    expect(untrusted('http://registry.npmjs.org/x.tgz')).toEqual(['untrusted-source']);
    expect(untrusted('https://evil.example/x.tgz')).toEqual(['untrusted-source']);
    expect(untrusted('https://registry.npmjs.org.evil.example/x.tgz')).toEqual(['untrusted-source']);
    expect(untrusted('https://evil.example/registry.npmjs.org/x.tgz')).toEqual(['untrusted-source']);
    expect(untrusted('not a url')).toEqual(['untrusted-source']);
    expect(untrusted('https://REGISTRY.npmjs.org/x.tgz')).toEqual([]);
    expect(untrusted(undefined)).toEqual([]);
  });
  it('flags names one edit away from a popular package', () => {
    const popular = ['lodash', 'react', 'express'];
    const flagged = (name) => ids(auditLock([pkg({ name, resolved: undefined })], { popular }));
    expect(flagged('lodahs')).toEqual([]);
    expect(flagged('lodas')).toEqual(['possible-typosquat']);
    expect(flagged('lodashh')).toEqual(['possible-typosquat']);
    expect(flagged('rect')).toEqual(['possible-typosquat']);
    expect(flagged('exprss')).toEqual(['possible-typosquat']);
    expect(flagged('lodash')).toEqual([]);
    expect(flagged('react')).toEqual([]);
    expect(flagged('left-pad')).toEqual([]);
    expect(flagged('rea')).toEqual([]);
  });
  it('sorts by severity, then package, then id', () => {
    const lock = [
      pkg({ name: 'zeta', version: '1.0.0', integrity: undefined }),
      pkg({ name: 'alpha', version: '1.0.0', resolved: 'https://evil.example/a.tgz' }),
      pkg({ name: 'beta', version: '1.0.0' }),
    ];
    const advisories = [
      { id: 'B-2', name: 'beta', below: '2.0.0', severity: 'critical' },
      { id: 'B-1', name: 'beta', below: '2.0.0', severity: 'critical' },
    ];
    const f = auditLock(lock, { advisories, registries });
    expect(f.map((x) => `${x.severity}:${x.package}:${x.id}`)).toEqual([
      'critical:beta:B-1', 'critical:beta:B-2',
      'high:alpha:untrusted-source',
      'moderate:zeta:missing-integrity',
    ]);
  });
});
```

%% hints
- Numeric compare helper from the guided exercise; strip a suffix with `version.split(/[-+]/)[0]`.
- Source: `try { const u = new URL(resolved); bad = u.protocol !== 'https:' || !registries.some((h) => h.toLowerCase() === u.host.toLowerCase()); } catch { bad = true; }`
- Edit distance: the classic two-row table; flag if the result is `1`.
- Sort with a rank map, then `package`, then `id`.

%% solution
```js
const RANK = { critical: 0, high: 1, moderate: 2, low: 3 };

const parts = (v) => String(v).split(/[-+]/)[0].replace(/^v/, '').split('.').map(Number);
function compare(a, b) {
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

export function auditLock(lock, { advisories = [], registries = [], popular = [] } = {}) {
  const findings = [];
  const add = (id, severity, pkgName, message) => findings.push({ id, severity, package: pkgName, message });
  const hosts = registries.map((h) => h.toLowerCase());

  for (const p of lock) {
    for (const adv of advisories) {
      if (adv.name === p.name && compare(p.version, adv.below) < 0) {
        add(adv.id, adv.severity, p.name, `${p.name}@${p.version} is vulnerable (fixed in ${adv.below})`);
      }
    }
    if (typeof p.integrity !== 'string' || p.integrity === '') {
      add('missing-integrity', 'moderate', p.name, `${p.name} has no integrity hash`);
    } else if (!/^sha(256|384|512)-/.test(p.integrity)) {
      add('weak-integrity', 'moderate', p.name, `${p.name} uses a weak integrity hash`);
    }
    if (p.resolved !== undefined) {
      let bad;
      try {
        const u = new URL(p.resolved);
        bad = u.protocol !== 'https:' || !hosts.includes(u.host.toLowerCase());
      } catch {
        bad = true;
      }
      if (bad) add('untrusted-source', 'high', p.name, `${p.name} is not downloaded from a trusted registry over HTTPS`);
    }
    if (p.name.length >= 4 && !popular.includes(p.name) && popular.some((n) => n.length >= 4 && distance(p.name, n) === 1)) {
      add('possible-typosquat', 'moderate', p.name, `${p.name} looks like a popular package name`);
    }
  }
  return findings.sort((a, b) => RANK[a.severity] - RANK[b.severity] || (a.package < b.package ? -1 : a.package > b.package ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
```

%% exercise sec-secret-scan | A secret scanner | 4 | js | js | findSecrets, shannonEntropy | 34
Implement a small scanner for secrets that were committed by mistake.

`shannonEntropy(text)` returns the entropy in **bits per character** (`-Σ p·log2(p)` over the characters' frequencies); `0` for an empty string.

`findSecrets(text)` returns findings `{ type, line, preview }` ordered by position. `line` is 1-based. `preview` is the first **4 characters** of the secret followed by `…` (never the whole secret). Detectors:

- `aws-access-key`: `AKIA` or `ASIA` followed by 16 uppercase letters or digits (as a whole word).
- `private-key`: a header like `-----BEGIN PRIVATE KEY-----` or with `RSA `, `EC `, `DSA `, `OPENSSH ` or `PGP ` before `PRIVATE KEY` (the preview is the first 4 characters of the header).
- `github-token`: `ghp_`, `gho_`, `ghu_`, `ghs_` or `ghr_` followed by exactly 36 letters/digits.
- `slack-token`: `xox` + one of `b a p r s` + `-` + at least 10 letters, digits or dashes.
- `generic-secret`: an assignment (`=` or `:`) to a name containing `password`, `passwd`, `secret`, `token`, `api_key`, `api-key` or `apikey` (case-insensitive) with a **quoted** value of at least 8 non-space, non-quote characters whose entropy is **at least 3.0** bits per character, and which is **not a placeholder** (starts with `changeme`, `change-me`, `password`, `example`, `your`, `xxx` or `<`, or contains `${`, `{{` or the word `example`/`placeholder`, case-insensitive). The preview uses the **value**.

```js
findSecrets('const key = "AKIA' + 'IOSFODNN7EXAMPLE";'); // one aws-access-key finding on line 1
```

%% worked
**A similar problem, solved: `findHexKeys(text)`** — match a pattern, compute the line from the match position.

```js
export function findHexKeys(text) {
  const found = [];
  const re = /\b[0-9a-f]{32}\b/g;                                       // ① one pattern per kind of secret
  let m;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split('\\n').length;             // ② the line number = newlines before the match + 1
    found.push({ type: 'hex-key', line, preview: m[0].slice(0, 4) + '…', index: m.index });
  }
  return found.sort((a, b) => a.index - b.index).map(({ index, ...rest }) => rest);   // ③ report in text order
}
```

Collect matches from **every** detector with their positions, then sort by position. For the generic detector the entropy check is what separates `"k9Zq3vX8pLm2"` from `"aaaaaaaa"` and `"password1"`: **real secrets look random**. It will miss low-entropy secrets and flag a few false positives: that trade-off is why teams combine scanning with rotation.

%% explain
- **One regular expression per detector**, with a global search.
- **Line number** from the match index; **preview** never shows more than 4 characters.
- **Generic detector**: quoted value, length, entropy, not a placeholder.
- **Sorted** by position.

%% nudge
- How do you turn a match position into a line number?
- Why is entropy a useful filter for "generic" secrets?

%% starter
```js
export function shannonEntropy(text) {
  return 0;
}

export function findSecrets(text) {
  return [];
}
```

%% tests
```js
const aws = 'AKIA' + 'IOSFODNN7EXAMPLE';
const gh = 'gh' + 'p_' + 'a1B2'.repeat(9);
const slack = 'xo' + 'xb-' + '1234567890-abcdefghij';
const pem = '-----BEGIN ' + 'RSA PRIVATE KEY-----';

describe('shannonEntropy', () => {
  it('measures bits per character', () => {
    expect(shannonEntropy('')).toBe(0);
    expect(shannonEntropy('aaaa')).toBe(0);
    expect(shannonEntropy('abab')).toBeCloseTo(1, 6);
    expect(shannonEntropy('abcd')).toBeCloseTo(2, 6);
    expect(shannonEntropy('abcdefgh')).toBeCloseTo(3, 6);
    expect(shannonEntropy('aab')).toBeCloseTo(0.9183, 3);
  });
});

describe('findSecrets', () => {
  it('finds nothing in ordinary text', () => {
    expect(findSecrets('const port = 3000;\nconsole.log("hello");')).toEqual([]);
    expect(findSecrets('')).toEqual([]);
  });
  it('finds AWS access key ids with a masked preview', () => {
    expect(findSecrets(`const key = "${aws}";`)).toEqual([{ type: 'aws-access-key', line: 1, preview: 'AKIA…' }]);
    expect(findSecrets('x ASIA' + 'ABCDEFGHIJKLMNOP y')).toEqual([{ type: 'aws-access-key', line: 1, preview: 'ASIA…' }]);
    expect(findSecrets('AKIA' + 'SHORT')).toEqual([]);
    expect(findSecrets('xAKIA' + 'IOSFODNN7EXAMPLE')).toEqual([]);
  });
  it('finds private key headers', () => {
    expect(findSecrets(`a\n${pem}\nMIIE...`)).toEqual([{ type: 'private-key', line: 2, preview: '----…' }]);
    expect(findSecrets('-----BEGIN ' + 'PRIVATE KEY-----')[0].type).toBe('private-key');
    expect(findSecrets('-----BEGIN ' + 'OPENSSH PRIVATE KEY-----')[0].type).toBe('private-key');
    expect(findSecrets('-----BEGIN ' + 'PUBLIC KEY-----')).toEqual([]);
    expect(findSecrets('-----BEGIN ' + 'CERTIFICATE-----')).toEqual([]);
  });
  it('finds GitHub and Slack tokens', () => {
    expect(findSecrets(`token ${gh}`)).toEqual([{ type: 'github-token', line: 1, preview: 'ghp_…' }]);
    expect(findSecrets('x gh' + 'p_tooshort')).toEqual([]);
    expect(findSecrets(`SLACK=${slack}`)).toEqual([{ type: 'slack-token', line: 1, preview: 'xoxb…' }]);
    expect(findSecrets('xo' + 'xz-1234567890-abcdefghij')).toEqual([]);
  });
  it('finds generic high-entropy secrets assigned to suspicious names', () => {
    expect(findSecrets('const apiKey = "k9Zq3vX8pLm2";')[0].type).toBe('generic-secret');
    expect(findSecrets('api_key = "k9Zq3vX8pLm2"')).toEqual([{ type: 'generic-secret', line: 1, preview: 'k9Zq…' }]);
    expect(findSecrets("DB_PASSWORD: 'Xr7!pQ2mZ9wL'")).toEqual([{ type: 'generic-secret', line: 1, preview: 'Xr7!…' }]);
    expect(findSecrets('client_secret="zT4nB8vK1qWx"')[0].type).toBe('generic-secret');
    expect(findSecrets('"auth-token": "Qw3rTy9uIo0p"')[0].type).toBe('generic-secret');
  });
  it('ignores low-entropy values, short values and placeholders', () => {
    for (const line of [
      'password = "aaaaaaaa"', 'secret = "short"', 'token = "changeme123456"', 'password = "password123"',
      'api_key = "your-api-key-here"', 'secret = "example-secret-value"', 'token = "${API_TOKEN_VALUE}"',
      'api_key = "{{ api_key_value }}"', 'password = "<enter password>"', 'token = "xxxxxxxxxxxx"',
      'secret = "my placeholder text"',
    ]) {
      expect(findSecrets(line)).toEqual([]);
    }
  });
  it('ignores assignments to names that are not suspicious', () => {
    expect(findSecrets('username = "k9Zq3vX8pLm2"')).toEqual([]);
  });
  it('requires a quoted value', () => {
    expect(findSecrets('password = process.env.DB_PASSWORD')).toEqual([]);
    expect(findSecrets('token = k9Zq3vX8pLm2')).toEqual([]);
  });
  it('reports line numbers and orders findings by position', () => {
    const text = `line1\nsecret = "zT4nB8vK1qWx"\n\nid = ${aws}\n${gh}`;
    expect(findSecrets(text).map((f) => [f.type, f.line])).toEqual([['generic-secret', 2], ['aws-access-key', 4], ['github-token', 5]]);
  });
  it('finds several secrets on one line in order', () => {
    const f = findSecrets(`${gh} and ${aws}`);
    expect(f.map((x) => x.type)).toEqual(['github-token', 'aws-access-key']);
  });
  it('never puts more than four characters of the secret in the preview', () => {
    for (const f of findSecrets(`${aws}\n${gh}\nsecret = "zT4nB8vK1qWx"`)) expect(f.preview.length).toBe(5);
  });
});
```

%% hints
- Entropy: count characters in a `Map`, then sum `-p * Math.log2(p)`.
- Use one global regex per kind with `exec` in a loop; keep `{ index, type, preview }` and sort by `index`.
- Line: `text.slice(0, index).split('\n').length`.
- Generic: `/\b([A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key)[A-Za-z0-9_.-]*)["']?\s*[:=]\s*(["'])([^"'\s]{8,})\2/gi`.

%% solution
```js
export function shannonEntropy(text) {
  const s = String(text);
  if (s.length === 0) return 0;
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  let bits = 0;
  const total = [...s].length;
  for (const n of counts.values()) {
    const p = n / total;
    bits -= p * Math.log2(p);
  }
  return bits;
}

const PLACEHOLDER = /^(changeme|change-me|password|example|your|xxx|<)|\$\{|\{\{|example|placeholder/i;

const DETECTORS = [
  { type: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { type: 'private-key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { type: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36}\b/g },
  { type: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
];

const GENERIC = /\b[A-Za-z0-9_.-]*(?:password|passwd|secret|token|api[_-]?key)[A-Za-z0-9_.-]*["']?\s*[:=]\s*(["'])([^"'\s]{8,})\1/gi;

export function findSecrets(text) {
  const found = [];
  const add = (type, index, secret) => found.push({ type, index, preview: secret.slice(0, 4) + '…' });
  for (const { type, re } of DETECTORS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) add(type, m.index, m[0]);
  }
  GENERIC.lastIndex = 0;
  let g;
  while ((g = GENERIC.exec(text))) {
    const value = g[2];
    if (shannonEntropy(value) >= 3.0 && !PLACEHOLDER.test(value)) add('generic-secret', g.index, value);
  }
  return found
    .sort((a, b) => a.index - b.index)
    .map(({ type, index, preview }) => ({ type, line: text.slice(0, index).split('\n').length, preview }));
}
```

%% exercise sec-env-config | A safe config loader | 3 | js | js | loadConfig, describeConfig | 28
Load configuration from environment variables without leaking secrets.

`loadConfig(env, schema)` returns `{ ok, config, errors }`. `schema` maps variable names to `{ type, required, default, secret, ... }`:

- A variable that is `undefined` or `''` is **missing**: use `default` if there is one (as the typed value, without parsing), else if `required` an error `NAME is required`, else leave it out.
- Types: `string` (optional `minLength`: `NAME must be at least N characters`); `int` (text matching `/^-?\d+$/`, converted to a number, optional `min`/`max`: `NAME must be an integer`, `NAME must be at least N`, `NAME must be at most N`); `bool` (case-insensitive `true`/`1`/`yes` or `false`/`0`/`no`; otherwise `NAME must be a boolean`); `url` (parses with `URL` and uses `http:` or `https:`; otherwise `NAME must be a valid URL`); `enum` with `values` (`NAME must be one of: a, b`).
- For **non-secret** variables, append ` (got "VALUE")` to the **type and range** messages (not to `is required`). For variables with `secret: true`, **never** include the value.
- **Every** problem is reported (one message per variable). `ok` is true when there are no errors; `config` is `undefined` when not ok.

`describeConfig(config, schema)` returns a copy that is **safe to print**: values of `secret: true` variables become `'********'` (always the same length), others are unchanged.

```js
loadConfig({ PORT: '8080', API_KEY: 'x'.repeat(16) }, { PORT: { type: 'int' }, API_KEY: { type: 'string', secret: true } }).config;
```

%% worked
**A similar problem, solved: `loadFlags(env, names)`** — parse, collect errors, never echo secrets.

```js
export function loadFlags(env, names) {
  const config = {}, errors = [];
  for (const name of names) {
    const raw = env[name];
    if (raw === undefined || raw === '') { errors.push(`${name} is required`); continue; }   // ① a missing value is an error, reported alongside the others
    if (!/^(true|false)$/i.test(raw)) { errors.push(`${name} must be a boolean (got "${raw}")`); continue; }
    config[name] = raw.toLowerCase() === 'true';                                              // ② store the typed value
  }
  return { ok: errors.length === 0, config: errors.length ? undefined : config, errors };
}
```

Process **every** variable and keep going after a problem: someone fixing a deployment wants the whole list, not one error per redeploy. The "got ..." part is useful for ordinary settings and dangerous for secrets, so make it **conditional on `secret`**.

%% explain
- **Missing values**: default, required error or omit.
- **Typed parsing** with clear messages.
- **No secret values** in any message.
- **`describeConfig`** masks secrets with a fixed string.

%% nudge
- Why show `got "abc"` for a port but not for an API key?
- Why mask with a fixed-length string instead of showing asterisks matching the length?

%% starter
```js
export function loadConfig(env, schema) {
  return { ok: false, config: undefined, errors: [] };
}

export function describeConfig(config, schema) {
  return {};
}
```

%% tests
```js
const schema = {
  PORT: { type: 'int', default: 3000, min: 1, max: 65535 },
  DEBUG: { type: 'bool', default: false },
  MODE: { type: 'enum', values: ['dev', 'prod'], required: true },
  DATABASE_URL: { type: 'url', required: true, secret: true },
  API_KEY: { type: 'string', required: true, secret: true, minLength: 16 },
  REGION: { type: 'string' },
};
const valid = { MODE: 'prod', DATABASE_URL: 'postgres://u:p@h/db'.replace('postgres', 'https'), API_KEY: 'k9Zq3vX8pLm2Rt5Y' };

describe('loadConfig', () => {
  it('parses a valid environment and applies defaults', () => {
    const r = loadConfig({ ...valid, PORT: '8080', DEBUG: 'Yes', REGION: 'eu' }, schema);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.config).toEqual({ PORT: 8080, DEBUG: true, MODE: 'prod', DATABASE_URL: valid.DATABASE_URL, API_KEY: valid.API_KEY, REGION: 'eu' });
    expect(loadConfig(valid, schema).config).toEqual({ PORT: 3000, DEBUG: false, MODE: 'prod', DATABASE_URL: valid.DATABASE_URL, API_KEY: valid.API_KEY });
  });
  it('treats empty strings as missing', () => {
    const r = loadConfig({ ...valid, PORT: '', REGION: '' }, schema);
    expect(r.config.PORT).toBe(3000);
    expect('REGION' in r.config).toBe(false);
  });
  it('reports every problem at once', () => {
    const r = loadConfig({ PORT: 'abc', DEBUG: 'maybe' }, schema);
    expect(r.ok).toBe(false);
    expect(r.config).toBeUndefined();
    expect(r.errors).toEqual([
      'PORT must be an integer (got "abc")',
      'DEBUG must be a boolean (got "maybe")',
      'MODE is required',
      'DATABASE_URL is required',
      'API_KEY is required',
    ]);
  });
  it('checks ranges, enums and lengths', () => {
    const r = loadConfig({ PORT: '70000', MODE: 'staging', DATABASE_URL: valid.DATABASE_URL, API_KEY: 'k9Zq3vX8pLm2Rt5Y' }, schema);
    expect(r.errors).toEqual(['PORT must be at most 65535 (got "70000")', 'MODE must be one of: dev, prod (got "staging")']);
    expect(loadConfig({ ...valid, PORT: '0' }, schema).errors).toEqual(['PORT must be at least 1 (got "0")']);
    expect(loadConfig({ ...valid, PORT: '1.5' }, schema).errors).toEqual(['PORT must be an integer (got "1.5")']);
  });
  it('understands booleans', () => {
    for (const t of ['true', 'TRUE', '1', 'yes', 'Yes']) expect(loadConfig({ ...valid, DEBUG: t }, schema).config.DEBUG).toBe(true);
    for (const f of ['false', 'False', '0', 'no', 'NO']) expect(loadConfig({ ...valid, DEBUG: f }, schema).config.DEBUG).toBe(false);
  });
  it('validates URLs', () => {
    expect(loadConfig({ ...valid, DATABASE_URL: 'not a url' }, schema).errors).toEqual(['DATABASE_URL must be a valid URL']);
    expect(loadConfig({ ...valid, DATABASE_URL: 'ftp://host/x' }, schema).errors).toEqual(['DATABASE_URL must be a valid URL']);
    expect(loadConfig({ ...valid, DATABASE_URL: 'http://localhost:5432/db' }, schema).ok).toBe(true);
  });
  it('never includes secret values in error messages', () => {
    const secretUrl = 'ftp://user:hunter2@host/db';
    const shortKey = 'tooshort-secret';
    const r = loadConfig({ MODE: 'dev', DATABASE_URL: secretUrl, API_KEY: shortKey }, schema);
    expect(r.errors).toEqual(['DATABASE_URL must be a valid URL', 'API_KEY must be at least 16 characters']);
    expect(r.errors.join(' ')).not.toContain('hunter2');
    expect(r.errors.join(' ')).not.toContain(shortKey);
  });
  it('does not parse defaults', () => {
    const r = loadConfig({}, { LEVEL: { type: 'int', default: 5 }, NAME: { type: 'string', default: '' } });
    expect(r.config).toEqual({ LEVEL: 5, NAME: '' });
  });
});

describe('describeConfig', () => {
  it('masks secrets and leaves other values alone', () => {
    const config = loadConfig({ ...valid, PORT: '8080' }, schema).config;
    const shown = describeConfig(config, schema);
    expect(shown).toEqual({ PORT: 8080, DEBUG: false, MODE: 'prod', DATABASE_URL: '********', API_KEY: '********' });
    expect(JSON.stringify(shown)).not.toContain('k9Zq3vX8pLm2Rt5Y');
  });
  it('does not modify the config and skips absent secrets', () => {
    const config = { PORT: 1 };
    const shown = describeConfig(config, schema);
    expect(shown).toEqual({ PORT: 1 });
    expect(shown).not.toBe(config);
    const withSecret = { API_KEY: 'abcdefghijklmnop' };
    describeConfig(withSecret, schema);
    expect(withSecret.API_KEY).toBe('abcdefghijklmnop');
  });
});
```

%% hints
- Loop over `Object.entries(schema)`; read `env[name]`; treat `undefined` and `''` as missing.
- Build the message once and add `` ` (got "${raw}")` `` only when `!rule.secret` (and not for `is required`).
- `describeConfig`: `Object.fromEntries(Object.entries(config).map(([k, v]) => [k, schema[k]?.secret ? '********' : v]))`.

%% solution
```js
const TRUE = /^(true|1|yes)$/i;
const FALSE = /^(false|0|no)$/i;

export function loadConfig(env, schema) {
  const errors = [];
  const entries = [];
  for (const [name, rule] of Object.entries(schema)) {
    const raw = env[name];
    if (raw === undefined || raw === '') {
      if (rule.default !== undefined) entries.push([name, rule.default]);
      else if (rule.required) errors.push(`${name} is required`);
      continue;
    }
    const fail = (message) => errors.push(rule.secret ? `${name} ${message}` : `${name} ${message} (got "${raw}")`);
    switch (rule.type) {
      case 'int': {
        if (!/^-?\d+$/.test(raw)) { fail('must be an integer'); break; }
        const n = Number(raw);
        if (rule.min !== undefined && n < rule.min) fail(`must be at least ${rule.min}`);
        else if (rule.max !== undefined && n > rule.max) fail(`must be at most ${rule.max}`);
        else entries.push([name, n]);
        break;
      }
      case 'bool':
        if (TRUE.test(raw)) entries.push([name, true]);
        else if (FALSE.test(raw)) entries.push([name, false]);
        else fail('must be a boolean');
        break;
      case 'url': {
        let ok = false;
        try {
          const u = new URL(raw);
          ok = u.protocol === 'http:' || u.protocol === 'https:';
        } catch {
          ok = false;
        }
        if (ok) entries.push([name, raw]);
        else errors.push(`${name} must be a valid URL`);
        break;
      }
      case 'enum':
        if (rule.values.includes(raw)) entries.push([name, raw]);
        else fail(`must be one of: ${rule.values.join(', ')}`);
        break;
      default:
        if (rule.minLength !== undefined && raw.length < rule.minLength) fail(`must be at least ${rule.minLength} characters`);
        else entries.push([name, raw]);
    }
  }
  const ok = errors.length === 0;
  return { ok, config: ok ? Object.fromEntries(entries) : undefined, errors };
}

export function describeConfig(config, schema) {
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, schema[key] && schema[key].secret ? '********' : value]));
}
```

%% exercise sec-check-satisfies | Tests for a range matcher | 4 | js | js | checkSatisfies | 36
`satisfies(version, range)` compares versions **numerically** and understands: exact versions, `>` `>=` `<` `<=` (upper bounds exclusive for `<`), caret (`^1.2.3` is `<2.0.0`, `^0.2.3` is `<0.3.0`, `^0.0.3` is `<0.0.4`), tilde (`~1.2.3` is `<1.3.0`), x-ranges (`1.2.x`), `||` for alternatives (any may match), spaces for **all-must-match**, and it **never** lets a prerelease version satisfy an ordinary range. Write `checkSatisfies(satisfies)` that passes for a correct matcher and **fails** for: **compares versions as text**, **treats `^0.x` like `^1.x`**, **lets `^0.0.3` allow `0.0.4`**, **lets `~1.2.3` allow the next minor**, **makes upper bounds inclusive**, **treats `||` as AND**, **treats a space as OR**, **lets prereleases satisfy ranges**, **ignores the minor in x-ranges**.

```js
expect(satisfies('1.10.0', '>=1.9.0')).toBe(true);
```

%% worked
**A similar problem, solved: `checkInRange(inRange)`** — straddle **every boundary** of a range with one value just inside and one just outside.

```js
export function checkInRange(inRange) {                      // inRange(version, '>=A <B') with numeric comparison
  expect(inRange('1.5.0', '>=1.2.0 <2.0.0')).toBe(true);     // ① comfortably inside
  expect(inRange('1.2.0', '>=1.2.0 <2.0.0')).toBe(true);     // ② exactly on an inclusive bound
  expect(inRange('1.1.9', '>=1.2.0 <2.0.0')).toBe(false);    // ③ just below it
  expect(inRange('1.9.9', '>=1.2.0 <2.0.0')).toBe(true);     // ④ just inside the exclusive bound
  expect(inRange('2.0.0', '>=1.2.0 <2.0.0')).toBe(false);    // ⑤ exactly on an exclusive bound
  expect(inRange('1.10.0', '>=1.9.0 <2.0.0')).toBe(true);    // ⑥ 10 > 9: a text comparison fails here
}
```

For a **range** feature the bugs live **on the boundaries**: test the value **exactly at** every bound and the values just **before and after** it. Include the numeric trap (`1.10.0` vs `1.9.0`) and the **special cases** (`0.x`, prereleases) that a simple implementation forgets.

%% explain
- **Numeric order**: `1.10.0` vs `1.9.0`.
- **Caret and tilde** on both sides of their upper bounds, including `0.x` and `0.0.x`.
- **Exclusive and inclusive** bounds exactly at the boundary.
- **`||` and spaces**, **x-ranges**, **prereleases**.

%% nudge
- Which two versions separate `^0.2.3` from `^1.2.3`?
- Which input shows that `<2.0.0` is exclusive?

%% starter
```js
export function checkSatisfies(satisfies) {
  expect(satisfies('1.2.3', '1.2.3')).toBe(true);
  expect(satisfies('1.2.4', '1.2.3')).toBe(false);
  // your assertions: numeric order, caret/tilde bounds, 0.x, exclusive bounds, OR/AND, x-ranges, prereleases
}
```

%% tests
```js
const cmpNum = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };
const cmpText = (a, b) => { for (let i = 0; i < 3; i++) { const x = String(a[i]), y = String(b[i]); if (x !== y) return x < y ? -1 : 1; } return 0; };
const parseV = (t) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(t).trim());
  return m ? { t: [+m[1], +m[2], +m[3]], pre: m[4] } : null;
};
const partial = (t, xMinor) => {
  const m = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?$/.exec(t);
  if (!m) return null;
  const part = (s) => (s === undefined || /^[xX*]$/.test(s) ? undefined : Number(s));
  let [M, mi, p] = [part(m[1]), part(m[2]), part(m[3])];
  if (M === undefined) { mi = undefined; p = undefined; } else if (mi === undefined) p = undefined;
  if (xMinor && p === undefined) mi = undefined;
  return { M, m: mi, p };
};
const make = ({ text = false, caretZero = false, caretPatch = false, tildeMinor = false, inclusive = false, orAsAnd = false, spaceAsOr = false, prePass = false, xMinor = false } = {}) => (version, range) => {
  const cmp = text ? cmpText : cmpNum;
  const v = parseV(version);
  if (!v) return false;
  const norm = (s) => String(s).trim().replace(/^[=v]+/, '');
  if (v.pre !== undefined && !prePass) return norm(range) === norm(version);
  const bounds = (token) => {
    const m = /^(\^|~|>=|<=|>|<|=)?(.*)$/.exec(token);
    const op = m[1] || '=';
    const x = partial(m[2], xMinor);
    if (!x) return null;
    if (x.M === undefined) return {};
    const lower = [x.M, x.m ?? 0, x.p ?? 0];
    const next = x.p !== undefined ? [x.M, x.m, x.p + 1] : x.m !== undefined ? [x.M, x.m + 1, 0] : [x.M + 1, 0, 0];
    if (op === '=') return { lo: lower, hi: next };
    if (op === '>=') return { lo: lower };
    if (op === '>') return { lo: next };
    if (op === '<') return { hi: lower };
    if (op === '<=') return { hi: next };
    if (op === '~') return { lo: lower, hi: tildeMinor || x.m === undefined ? [x.M + 1, 0, 0] : [x.M, x.m + 1, 0] };
    let hi;
    if (x.M > 0 || caretZero) hi = [x.M + 1, 0, 0];
    else if (x.m === undefined) hi = [1, 0, 0];
    else if (x.m > 0 || (caretPatch && x.p !== undefined)) hi = [0, x.m + 1, 0];
    else if (x.p === undefined) hi = [0, 1, 0];
    else hi = [0, 0, x.p + 1];
    return { lo: lower, hi };
  };
  const test = (token) => {
    const b = bounds(token);
    if (!b) return false;
    const hiOk = b.hi === undefined || (inclusive ? cmp(v.t, b.hi) <= 0 : cmp(v.t, b.hi) < 0);
    return (b.lo === undefined || cmp(v.t, b.lo) >= 0) && hiOk;
  };
  const alt = (a) => {
    const tokens = a.trim().replace(/(\^|~|>=|<=|>|<|=)\s+/g, '$1').split(/\s+/).filter(Boolean);
    return spaceAsOr ? tokens.some(test) : tokens.every(test);
  };
  const alts = String(range).split('||');
  return orAsAnd ? alts.every(alt) : alts.some(alt);
};
const correct = make();
const mutants = {
  'compares versions as text': make({ text: true }),
  'treats ^0.x like ^1.x': make({ caretZero: true }),
  'lets ^0.0.3 allow 0.0.4': make({ caretPatch: true }),
  'lets ~1.2.3 allow the next minor': make({ tildeMinor: true }),
  'makes upper bounds inclusive': make({ inclusive: true }),
  'treats || as AND': make({ orAsAnd: true }),
  'treats a space as OR': make({ spaceAsOr: true }),
  'lets prereleases satisfy ranges': make({ prePass: true }),
  'ignores the minor in x-ranges': make({ xMinor: true }),
};

describe('your checkSatisfies', () => {
  it('passes on a correct matcher', () => {
    expect(() => checkSatisfies(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a matcher that ${name}`, () => {
      expect(() => checkSatisfies(impl)).toThrow();
    });
  }
});
```

%% hints
- Numeric trap: `satisfies('1.10.0', '>=1.9.0')` is `true`.
- Caret: `^0.2.3` accepts `0.2.9` and rejects `0.3.0`; `^0.0.3` accepts `0.0.3` and rejects `0.0.4`; `^1.2.3` rejects `2.0.0`.
- Tilde: `~1.2.3` rejects `1.3.0`. Exclusive: `<2.0.0` rejects `2.0.0`.
- Logic: `'>=1.2.0 <1.4.0'` rejects `1.5.0` and `1.1.0`; `'^1.0.0 || ^3.0.0'` accepts `3.1.0` and rejects `2.0.0`.
- Prerelease: `'1.2.3-beta.1'` against `'^1.0.0'` is `false`. X-range: `'1.2.x'` rejects `1.3.0`.

%% solution
```js
export function checkSatisfies(satisfies) {
  expect(satisfies('1.2.3', '1.2.3')).toBe(true);
  expect(satisfies('1.2.4', '1.2.3')).toBe(false);

  expect(satisfies('1.10.0', '>=1.9.0')).toBe(true);
  expect(satisfies('1.9.0', '<1.10.0')).toBe(true);

  expect(satisfies('1.9.9', '^1.2.3')).toBe(true);
  expect(satisfies('1.2.2', '^1.2.3')).toBe(false);
  expect(satisfies('2.0.0', '^1.2.3')).toBe(false);
  expect(satisfies('0.2.9', '^0.2.3')).toBe(true);
  expect(satisfies('0.3.0', '^0.2.3')).toBe(false);
  expect(satisfies('0.0.3', '^0.0.3')).toBe(true);
  expect(satisfies('0.0.4', '^0.0.3')).toBe(false);

  expect(satisfies('1.2.9', '~1.2.3')).toBe(true);
  expect(satisfies('1.3.0', '~1.2.3')).toBe(false);

  expect(satisfies('1.9.9', '<2.0.0')).toBe(true);
  expect(satisfies('2.0.0', '<2.0.0')).toBe(false);
  expect(satisfies('2.0.0', '<=2.0.0')).toBe(true);

  expect(satisfies('3.1.0', '^1.0.0 || ^3.0.0')).toBe(true);
  expect(satisfies('2.0.0', '^1.0.0 || ^3.0.0')).toBe(false);
  expect(satisfies('1.3.0', '>=1.2.0 <1.4.0')).toBe(true);
  expect(satisfies('1.5.0', '>=1.2.0 <1.4.0')).toBe(false);
  expect(satisfies('1.1.0', '>=1.2.0 <1.4.0')).toBe(false);

  expect(satisfies('1.2.3-beta.1', '^1.0.0')).toBe(false);
  expect(satisfies('1.2.3-beta.1', '1.2.3-beta.1')).toBe(true);

  expect(satisfies('1.2.5', '1.2.x')).toBe(true);
  expect(satisfies('1.3.0', '1.2.x')).toBe(false);
  expect(satisfies('1.5.0', '1.x')).toBe(true);
  expect(satisfies('2.0.0', '1.x')).toBe(false);
}
```
