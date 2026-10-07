---
id: git-cd-releases
track: git
title: Continuous delivery: releasing safely
summary: How a green build becomes a running release without drama: environments and approvals, blue/green, rolling and canary rollouts, feature flags, rollbacks, preview deploys and why short-lived OIDC tokens beat stored cloud keys.
---

## The idea in one sentence

**Continuous delivery** means every change that passes CI is **always releasable**, and releasing is a **boring, repeatable button** (or fully automatic), made safe by **small steps, real metrics and a fast way back**.

> **Analogy** Opening a new bridge lane. You do not close the whole bridge and hope: you let a few cars across first (canary), watch the sensors, widen the lane gradually, and keep the old lane ready to reopen in a minute if anything looks wrong.

*(In GitHub Actions: `environment:` with required reviewers and deployment branch rules, `concurrency`, and the `id-token: write` permission for OIDC. Vercel, for example, gives every pull request a preview deploy for free.)*

## Delivery versus deployment

| Term | Meaning |
| --- | --- |
| **Continuous delivery** | every green change *can* be released; a **human decision** (approval) triggers it |
| **Continuous deployment** | every green change **is** released automatically, no human step |
| **Release** | making a version available to users (can be separate from deploying code, see flags) |
| **Rollback** | returning to the last known-good version |

Most teams sit in between: automatic to staging, approval for production.

## Rollout strategies

![Rollout strategies](fig:gt-strategies "Blue/green flips, rolling replaces, canary widens.")

- **Blue/green**: two full stacks. Deploy to the idle one, test it, **flip the router**. Rollback is flipping back. Costs double the capacity, and the **database** is shared, so schema changes must work for both versions.
- **Rolling**: replace instances a few at a time. No extra capacity, but **old and new run together**, so they must be compatible.
- **Canary**: send a **small share of real traffic** to the new version and **widen it only while metrics are healthy**. It limits the **blast radius** of a bad release.

## Canary decisions use rates, not counts

![Canary steps](fig:gt-canary "Promote, hold or roll back at each step.")

A canary serves less traffic than the baseline, so compare **error rates** (`errors / requests`), never raw counts. Three outcomes at each step: **promote** (clearly fine), **hold** (too few requests to say anything), **roll back** (clearly worse). Give the comparison a **floor**, because a baseline with zero errors would otherwise make a single canary error look like an infinite increase.

```js try predict
const rate = ({ errors, requests }) => errors / requests;
const baseline = { errors: 10, requests: 1000 };
const canary = { errors: 30, requests: 1000 };

console.log(rate(baseline), rate(canary), rate(canary) > rate(baseline) * 1.5);
```

```stepper A canary rollout
code:
  deploy v2 to 5%
  rate ok -> 25%
  rate ok -> 50%
  rate spikes
  rollback to 0%
---
line: 1
say: The new version receives **5%** of real traffic. Everyone else still gets v1, so a bug hurts few users.
phase: step 1
---
line: 2
say: After enough requests the canary's error rate is within the allowed margin of the baseline, so the controller **promotes** to 25%.
phase: step 2
---
line: 3
say: Still healthy at 50%. Each step collects fresh data before the next one.
phase: step 3
---
line: 4
say: At 50% a path nobody tested breaks and the **canary error rate jumps** well above the baseline.
phase: step 4
---
line: 5
say: The controller **rolls back at once**: all traffic returns to v1. Half the users saw errors for a short time, not all of them for hours.
phase: step 5
```

## Feature flags: deploy is not release

A **feature flag** is a runtime switch that decides **per user** whether code runs. Ship the code **dark**, then turn it on for staff, then 5% of users, then everyone, and turn it **off instantly** with no deploy if it misbehaves. Percentage rollouts must be **stable** (the same user always gets the same answer) and **independent per flag**, so hash `flagKey:userId` into a bucket from 0 to 99. Flags are **debt**: remove them when the rollout is done.

## Environments, approvals and secrets

![Short-lived tokens](fig:gt-oidc "Stored keys live forever; OIDC tokens live minutes.")

A protected **environment** (staging, production) can require **reviewers**, restrict **which branches** may deploy, and add a **wait timer**. Deploy credentials should be **short-lived**: with **OIDC** the job proves its identity (repository, branch, environment) and receives a token that expires in minutes, instead of a stored key that lives forever. Gate the environment, then give the token **least privilege**.

## Preview deploys and rollback

- A **preview deploy** per pull request lets reviewers click the real thing; destroy it when the PR closes.
- **Roll back** by redeploying the **last known-good artifact** (build once, deploy the same artifact everywhere), not by rebuilding. A **destructive migration** (dropping a column) cannot be undone by redeploying old code, so rollbacks stop there: prefer **expand then contract** (add new, migrate, remove old later).

## Quick check

```check
Q: The canary served 1,000 requests with 20 errors; the baseline served 100,000 with 500 errors. Which comparison is right?
A) 20 errors is far fewer than 500, so the canary is better
B) 2% against 0.5%: the canary is clearly worse *
C) The totals are incomparable
D) Only the baseline matters
Why: Compare rates (errors per request), because the two groups saw different amounts of traffic.
---
Q: A canary has handled only 12 requests so far. What should the controller do?
A) Promote, no errors yet
B) Roll back, too little data
C) Hold and wait for more data *
D) Restart it
Why: A decision on 12 requests is noise; wait for a meaningful sample.
---
Q: Why bucket users with a hash of flagKey:userId instead of random numbers?
A) It is faster
B) A user must get the same answer every time, and each flag needs its own independent split *
C) Random numbers are unavailable
D) Hashes are secret
Why: Stable, per-flag buckets mean a user does not flip in and out, and two flags do not share the same 5%.
---
Q: What is the main advantage of OIDC over a stored cloud key?
A) It is cheaper
B) The credential is short-lived and tied to repository, branch and environment *
C) It needs no permissions
D) It works offline
Why: There is no permanent secret to leak or rotate, and other branches or forks get no token.
```

## Recap

- **Delivery** (always releasable, human approves) vs **deployment** (automatic); roll out in **small, reversible steps**.
- **Blue/green** (flip), **rolling** (replace gradually, versions coexist), **canary** (small real slice, widen on healthy metrics).
- Decide on **rates with a floor and a minimum sample**: promote, hold or roll back.
- **Flags** separate deploy from release: **stable per-flag buckets**, kill switch, remove when done.
- **Environments** gate with reviewers, branch rules and timers; **OIDC** beats stored keys.
- **Roll back to the last good artifact**; destructive migrations cannot be rolled back, so expand then contract.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: health verdict | Dividing, comparing and a "no data" case |
| Canary decision | Rates, a floor, a minimum sample |
| Feature flags | A stable hash and rule precedence |
| Release gate | Several independent rules that collect reasons |
| Rollback target | Walking a history backwards with a stop condition |
| Tests for the canary decision | Boundary values where each wrong rule gives a different verdict |

%% exercise gx-guided-health | Guided: health verdict | 1 | js | js | healthVerdict | 8 | guided
Implement `healthVerdict({ errors, requests }, maxRate)`. With **no requests** the verdict is `'unknown'`. Otherwise the error rate is `errors / requests`: it is `'healthy'` when the rate is **at most** `maxRate`, else `'unhealthy'`.

```js
healthVerdict({ errors: 1, requests: 100 }, 0.02); // 'healthy'
```

%% worked
**A similar problem, solved: `stockLevel({ sold, capacity }, warnRatio)`** — guard the empty case first, then compare a ratio.

```js
function stockLevel({ sold, capacity }, warnRatio) {
  if (capacity === 0) return 'none';              // ① nothing to divide by: say so instead of returning NaN
  const used = sold / capacity;                   // ② a ratio, not a raw count
  return used >= warnRatio ? 'low' : 'ok';        // ③ pick the boundary deliberately (>= here)
}
```

Always decide whether the **boundary itself** counts: here exactly `warnRatio` is `'low'`.

%% explain
- **Guard** against zero requests (`0 / 0` is `NaN`).
- **Rate** = errors divided by requests.
- **Boundary** at exactly the limit is healthy.

%% nudge
- What does `0 / 0` give in JavaScript, and why must it be handled before comparing?

%% starter
```js
export function healthVerdict({ errors, requests }, maxRate) {
  return 'unknown';
}
```

%% tests
```js
describe('healthVerdict', () => {
  it('is unknown without traffic', () => {
    expect(healthVerdict({ errors: 0, requests: 0 }, 0.01)).toBe('unknown');
  });
  it('is healthy at or under the limit', () => {
    expect(healthVerdict({ errors: 1, requests: 100 }, 0.02)).toBe('healthy');
    expect(healthVerdict({ errors: 2, requests: 100 }, 0.02)).toBe('healthy');
    expect(healthVerdict({ errors: 0, requests: 5 }, 0)).toBe('healthy');
  });
  it('is unhealthy above the limit', () => {
    expect(healthVerdict({ errors: 3, requests: 100 }, 0.02)).toBe('unhealthy');
    expect(healthVerdict({ errors: 1, requests: 5 }, 0.1)).toBe('unhealthy');
  });
});
```

%% hints
- Return early when `requests === 0`.
- `errors / requests <= maxRate`.

%% solution
```js
export function healthVerdict({ errors, requests }, maxRate) {
  if (requests === 0) return 'unknown';
  return errors / requests <= maxRate ? 'healthy' : 'unhealthy';
}
```

%% exercise gx-canary | Canary decision | 3 | js | js | canaryDecision | 25
`canaryDecision({ baseline, canary, minRequests = 100, maxRatio = 1.5, minRate = 0.01 })`, where `baseline` and `canary` are `{ errors, requests }`, returns `'hold'`, `'promote'` or `'rollback'`.

1. If the canary has **fewer than `minRequests`** requests, return `'hold'` (exactly `minRequests` is enough data).
2. Compute both **error rates**. A baseline with no requests has rate `0`.
3. The allowed limit is `Math.max(baselineRate * maxRatio, minRate)`.
4. Return `'rollback'` when the canary rate is **strictly above** the limit, otherwise `'promote'`.

```js
canaryDecision({ baseline: { errors: 10, requests: 1000 }, canary: { errors: 30, requests: 1000 } }); // 'rollback'
```

%% worked
**A similar problem, solved: `trafficLight({ ok, total }, minTotal)`** — hold on thin data, then compare a rate.

```js
function trafficLight({ ok, total }, minTotal) {
  if (total < minTotal) return 'wait';             // ① too little data: no verdict yet
  const rate = ok / total;                         // ② a rate, so groups of different size compare fairly
  return rate >= 0.99 ? 'green' : 'red';           // ③ one deliberate boundary
}
```

%% explain
- **Hold first**: no verdict on thin data.
- **Rates**, never counts.
- **Floor** keeps a perfect baseline from making any error fatal.
- **Strict** comparison: reaching the limit is still acceptable.

%% nudge
- Why is a floor (`minRate`) needed when the baseline has zero errors?

%% starter
```js
export function canaryDecision({ baseline, canary, minRequests = 100, maxRatio = 1.5, minRate = 0.01 }) {
  return 'promote';
}
```

%% tests
```js
const b = (errors, requests) => ({ errors, requests });
describe('canaryDecision', () => {
  it('holds on a thin sample, even with errors', () => {
    expect(canaryDecision({ baseline: b(10, 1000), canary: b(5, 99) })).toBe('hold');
    expect(canaryDecision({ baseline: b(10, 1000), canary: b(0, 0) })).toBe('hold');
  });
  it('evaluates at exactly minRequests', () => {
    expect(canaryDecision({ baseline: b(0, 1000), canary: b(0, 100) })).toBe('promote');
    expect(canaryDecision({ baseline: b(0, 1000), canary: b(50, 100) })).toBe('rollback');
  });
  it('rolls back when the rate is clearly worse than the baseline', () => {
    expect(canaryDecision({ baseline: b(10, 1000), canary: b(30, 1000) })).toBe('rollback');
  });
  it('promotes when within the allowed ratio', () => {
    expect(canaryDecision({ baseline: b(10, 1000), canary: b(12, 1000) })).toBe('promote');
    expect(canaryDecision({ baseline: b(50, 1000), canary: b(70, 1000) })).toBe('promote');
  });
  it('compares rates, not counts', () => {
    expect(canaryDecision({ baseline: b(100, 10000), canary: b(20, 200) })).toBe('rollback');
    expect(canaryDecision({ baseline: b(100, 10000), canary: b(0, 5000) })).toBe('promote');
  });
  it('uses the floor when the baseline is perfect or empty', () => {
    expect(canaryDecision({ baseline: b(0, 1000), canary: b(5, 1000) })).toBe('promote');
    expect(canaryDecision({ baseline: b(0, 0), canary: b(5, 1000) })).toBe('promote');
    expect(canaryDecision({ baseline: b(0, 1000), canary: b(20, 1000) })).toBe('rollback');
  });
  it('treats exactly the limit as acceptable', () => {
    expect(canaryDecision({ baseline: b(0, 1000), canary: b(10, 1000) })).toBe('promote');
  });
  it('honours custom options', () => {
    expect(canaryDecision({ baseline: b(10, 1000), canary: b(30, 1000), maxRatio: 4 })).toBe('promote');
    expect(canaryDecision({ baseline: b(0, 1000), canary: b(5, 1000), minRate: 0.001 })).toBe('rollback');
    expect(canaryDecision({ baseline: b(0, 1000), canary: b(0, 20), minRequests: 10 })).toBe('promote');
  });
});
```

%% hints
- `if (canary.requests < minRequests) return 'hold'`.
- `const rate = (s) => (s.requests ? s.errors / s.requests : 0)`.
- `canaryRate > Math.max(baselineRate * maxRatio, minRate) ? 'rollback' : 'promote'`.

%% solution
```js
export function canaryDecision({ baseline, canary, minRequests = 100, maxRatio = 1.5, minRate = 0.01 }) {
  if (canary.requests < minRequests) return 'hold';
  const rate = (s) => (s.requests ? s.errors / s.requests : 0);
  const limit = Math.max(rate(baseline) * maxRatio, minRate);
  return rate(canary) > limit ? 'rollback' : 'promote';
}
```

%% exercise gx-flags | Feature flag evaluation | 3 | js | js | isEnabled | 30
`isEnabled(flag, userId)` decides whether a feature is on for one user. A flag is `{ key, enabled, percentage = 0, allow = [], deny = [] }`. Apply the rules **in this order**:

1. `enabled` is false: **off** for everyone (the kill switch beats everything).
2. `userId` is in `deny`: **off**.
3. `userId` is in `allow`: **on**.
4. Otherwise **on** when `bucket < percentage`, where `bucket` is the **FNV-1a** hash (32-bit) of the string `` `${key}:${userId}` `` over its UTF-16 code units, **modulo 100**.

FNV-1a: start with `h = 0x811c9dc5`; for each code `c`: `h ^= c; h = Math.imul(h, 0x01000193) >>> 0`.

```js
isEnabled({ key: 'new-nav', enabled: true, percentage: 100 }, 'u1'); // true
```

%% worked
**A similar problem, solved: `variantFor(experiment, userId)`** — a stable pick from a string hash, salted by the experiment name.

```js
function variantFor(experiment, userId) {
  let h = 0;
  for (const ch of `${experiment}:${userId}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;   // ① the experiment name is part of the hashed text
  return h % 2 === 0 ? 'A' : 'B';                                                    // ② same input, same variant, every time
}
```

No randomness anywhere: a **pure function** of the experiment and the user is what makes the split stable.

%% explain
- **Kill switch first**, then deny, allow, percentage.
- **Salt with the key** so two flags do not roll out to the same users.
- **Stable**: pure function of key and user.

%% nudge
- Why must the flag key be part of the hashed string?
- What would a deny entry and an allow entry for the same user mean? Which wins here?

%% starter
```js
export function isEnabled(flag, userId) {
  return false;
}
```

%% tests
```js
const bucketOf = (key, userId) => {
  let h = 0x811c9dc5;
  for (const ch of `${key}:${userId}`) {
    for (let i = 0; i < ch.length; i += 1) {
      h ^= ch.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h % 100;
};
const users = Array.from({ length: 1000 }, (_, i) => `user-${i}`);

describe('isEnabled', () => {
  it('is off when disabled, whatever else is set', () => {
    expect(isEnabled({ key: 'a', enabled: false, percentage: 100, allow: ['u1'] }, 'u1')).toBe(false);
  });
  it('deny beats allow', () => {
    expect(isEnabled({ key: 'a', enabled: true, percentage: 0, allow: ['u1'], deny: ['u1'] }, 'u1')).toBe(false);
    expect(isEnabled({ key: 'a', enabled: true, percentage: 100, deny: ['u1'] }, 'u1')).toBe(false);
  });
  it('allow turns it on regardless of percentage', () => {
    expect(isEnabled({ key: 'a', enabled: true, percentage: 0, allow: ['u1'] }, 'u1')).toBe(true);
    expect(isEnabled({ key: 'a', enabled: true, percentage: 0, allow: ['u1'] }, 'u2')).toBe(false);
  });
  it('percentage 0 is nobody and 100 is everybody', () => {
    expect(users.some((u) => isEnabled({ key: 'k', enabled: true, percentage: 0 }, u))).toBe(false);
    expect(users.every((u) => isEnabled({ key: 'k', enabled: true, percentage: 100 }, u))).toBe(true);
  });
  it('matches the bucket rule exactly', () => {
    for (const u of users.slice(0, 200)) {
      expect(isEnabled({ key: 'new-nav', enabled: true, percentage: 37 }, u)).toBe(bucketOf('new-nav', u) < 37);
    }
  });
  it('is stable and grows monotonically with the percentage', () => {
    const at = (p) => users.filter((u) => isEnabled({ key: 'k', enabled: true, percentage: p }, u));
    const small = at(20);
    const big = at(60);
    expect(at(20)).toEqual(small);
    expect(small.every((u) => big.includes(u))).toBe(true);
    expect(big.length).toBeGreaterThan(small.length);
  });
  it('splits roughly in proportion', () => {
    const n = users.filter((u) => isEnabled({ key: 'k', enabled: true, percentage: 25 }, u)).length;
    expect(n).toBeGreaterThan(180);
    expect(n).toBeLessThan(320);
  });
  it('rolls different flags out to different users', () => {
    const a = users.filter((u) => isEnabled({ key: 'flag-a', enabled: true, percentage: 50 }, u));
    const bFlag = users.filter((u) => isEnabled({ key: 'flag-b', enabled: true, percentage: 50 }, u));
    expect(a.join()).not.toBe(bFlag.join());
  });
});
```

%% hints
- Write a small `bucket(key, userId)` helper first.
- Check `enabled`, then `deny`, then `allow`, then the bucket.

%% solution
```js
export function isEnabled(flag, userId) {
  const { key, enabled, percentage = 0, allow = [], deny = [] } = flag;
  if (!enabled) return false;
  if (deny.includes(userId)) return false;
  if (allow.includes(userId)) return true;
  let h = 0x811c9dc5;
  const text = `${key}:${userId}`;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100 < percentage;
}
```

%% exercise gx-gate | Release gate | 3 | js | js | evaluateRelease | 35
`evaluateRelease({ env, request, approvals = [], now })` decides whether a deployment to a protected environment may start. It returns `{ allowed, reasons }`, where `reasons` lists **every** failed rule, in this order:

1. `'branch-not-allowed'`: `env.allowedBranches` (if present) is a list of patterns, where `*` matches any characters **except `/`** and everything else is literal; `request.branch` must match one.
2. `'needs-approvals'`: the number of **distinct** users in `approvals` (each `{ user }`) must be at least `env.requiredReviewers` (default 0). If `env.preventSelfReview` is true, approvals by `request.requestedBy` **do not count**.
3. `'waiting'`: if `env.waitMinutes` is set, `now - request.requestedAt` (milliseconds) must be at least that many minutes.
4. `'outside-window'`: if `env.window` is `{ startHour, endHour }`, the UTC hour of `now` must satisfy `startHour <= hour < endHour`.

`allowed` is true only when `reasons` is empty.

```js
evaluateRelease({ env: { requiredReviewers: 1 }, request: { branch: 'main', requestedBy: 'a' }, approvals: [], now: 0 });
// { allowed: false, reasons: ['needs-approvals'] }
```

%% worked
**A similar problem, solved: `checkDoor({ badge, hour }, rules)`** — evaluate each rule independently and collect every failure.

```js
function checkDoor({ badge, hour }, rules) {
  const reasons = [];
  if (!rules.badges.includes(badge)) reasons.push('unknown-badge');                   // ① each rule appends its own reason
  if (!(hour >= rules.open && hour < rules.close)) reasons.push('closed');            // ② half-open range: open inclusive, close exclusive
  return { allowed: reasons.length === 0, reasons };                                  // ③ allowed is derived, never stored separately
}
```

%% explain
- **Collect all reasons**, do not stop at the first, so the UI can show everything that blocks.
- **Distinct** approvers; self-review optionally excluded.
- **UTC hour** via `new Date(now).getUTCHours()`.

%% nudge
- Why return all reasons instead of the first one?
- How do you turn `release/*` into a regular expression safely?

%% starter
```js
export function evaluateRelease({ env, request, approvals = [], now }) {
  return { allowed: true, reasons: [] };
}
```

%% tests
```js
const at = (h, m = 0) => Date.UTC(2026, 0, 5, h, m);
const req = (extra = {}) => ({ branch: 'main', requestedBy: 'alice', requestedAt: at(9), ...extra });
const ok = (user) => ({ user });

describe('evaluateRelease', () => {
  it('allows when there are no rules', () => {
    expect(evaluateRelease({ env: {}, request: req(), now: at(10) })).toEqual({ allowed: true, reasons: [] });
  });
  it('checks branch patterns', () => {
    const env = { allowedBranches: ['main', 'release/*'] };
    expect(evaluateRelease({ env, request: req({ branch: 'release/1.2' }), now: at(10) }).allowed).toBe(true);
    expect(evaluateRelease({ env, request: req({ branch: 'release/1/2' }), now: at(10) }).reasons).toEqual(['branch-not-allowed']);
    expect(evaluateRelease({ env, request: req({ branch: 'feature/x' }), now: at(10) }).reasons).toEqual(['branch-not-allowed']);
    expect(evaluateRelease({ env: { allowedBranches: ['a.b'] }, request: req({ branch: 'axb' }), now: at(10) }).allowed).toBe(false);
  });
  it('counts distinct approvers', () => {
    const env = { requiredReviewers: 2 };
    expect(evaluateRelease({ env, request: req(), approvals: [ok('bob'), ok('bob')], now: at(10) }).reasons).toEqual(['needs-approvals']);
    expect(evaluateRelease({ env, request: req(), approvals: [ok('bob'), ok('carol')], now: at(10) }).allowed).toBe(true);
  });
  it('can ignore the requester as a reviewer', () => {
    const env = { requiredReviewers: 1, preventSelfReview: true };
    expect(evaluateRelease({ env, request: req(), approvals: [ok('alice')], now: at(10) }).reasons).toEqual(['needs-approvals']);
    expect(evaluateRelease({ env: { requiredReviewers: 1 }, request: req(), approvals: [ok('alice')], now: at(10) }).allowed).toBe(true);
    expect(evaluateRelease({ env, request: req(), approvals: [ok('alice'), ok('bob')], now: at(10) }).allowed).toBe(true);
  });
  it('enforces the wait timer', () => {
    const env = { waitMinutes: 30 };
    expect(evaluateRelease({ env, request: req(), now: at(9, 29) }).reasons).toEqual(['waiting']);
    expect(evaluateRelease({ env, request: req(), now: at(9, 30) }).allowed).toBe(true);
  });
  it('enforces the deployment window in UTC', () => {
    const env = { window: { startHour: 8, endHour: 17 } };
    expect(evaluateRelease({ env, request: req(), now: at(8) }).allowed).toBe(true);
    expect(evaluateRelease({ env, request: req(), now: at(16, 59) }).allowed).toBe(true);
    expect(evaluateRelease({ env, request: req(), now: at(17) }).reasons).toEqual(['outside-window']);
    expect(evaluateRelease({ env, request: req(), now: at(7, 59) }).reasons).toEqual(['outside-window']);
  });
  it('reports every failed rule in order', () => {
    const env = { allowedBranches: ['main'], requiredReviewers: 1, waitMinutes: 600, window: { startHour: 8, endHour: 12 } };
    const r = evaluateRelease({ env, request: req({ branch: 'dev' }), approvals: [], now: at(13) });
    expect(r).toEqual({ allowed: false, reasons: ['branch-not-allowed', 'needs-approvals', 'waiting', 'outside-window'] });
  });
});
```

%% hints
- `new RegExp('^' + pattern.split('*').map(escape).join('[^/]*') + '$')`.
- `new Set(approvals.map((a) => a.user).filter(...)).size`.

%% solution
```js
export function evaluateRelease({ env, request, approvals = [], now }) {
  const reasons = [];
  const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const matches = (pattern, name) => new RegExp('^' + pattern.split('*').map(escape).join('[^/]*') + '$').test(name);

  if (env.allowedBranches && !env.allowedBranches.some((p) => matches(p, request.branch))) {
    reasons.push('branch-not-allowed');
  }
  const approvers = new Set(
    approvals.map((a) => a.user).filter((u) => !(env.preventSelfReview && u === request.requestedBy)),
  );
  if (approvers.size < (env.requiredReviewers ?? 0)) reasons.push('needs-approvals');
  if (env.waitMinutes && now - request.requestedAt < env.waitMinutes * 60000) reasons.push('waiting');
  if (env.window) {
    const hour = new Date(now).getUTCHours();
    if (!(hour >= env.window.startHour && hour < env.window.endHour)) reasons.push('outside-window');
  }
  return { allowed: reasons.length === 0, reasons };
}
```

%% exercise gx-rollback | Choose a rollback target | 3 | js | js | chooseRollback | 25
`chooseRollback(deploys)` takes the deployment history **oldest first**; the **last** entry is the current (bad) release. Each deploy is `{ id, status, destructive }`, where `status` is `'success'`, `'failed'` or `'rolled-back'`, and `destructive` is true when its migration cannot be undone.

Return the **id of the newest earlier deploy whose status is `'success'`**, **unless** rolling back would have to cross a destructive migration: if the current deploy, or any deploy between the candidate and the current one, is `destructive`, return `null` (you must roll forward with a fix). Return `null` too when there is nothing to roll back to.

```js
chooseRollback([{ id: 'v1', status: 'success' }, { id: 'v2', status: 'success' }]); // 'v1'
```

%% worked
**A similar problem, solved: `lastGoodPage(history)`** — walk a list backwards, skipping bad entries.

```js
function lastGoodPage(history) {
  for (let i = history.length - 2; i >= 0; i -= 1) {   // ① start just before the current (last) entry
    if (history[i].ok) return history[i].url;           // ② first good one found going backwards is the newest
  }
  return null;                                          // ③ nothing good: say so explicitly
}
```

%% explain
- **Walk backwards** from the one before the current release.
- **Skip** failed and rolled-back deploys.
- **Destructive migrations** are a one-way door: check each deploy you step over, starting with the current one.

%% nudge
- Which deploys must you check for `destructive` when the candidate is three steps back?

%% starter
```js
export function chooseRollback(deploys) {
  return null;
}
```

%% tests
```js
const d = (id, status = 'success', destructive = false) => ({ id, status, destructive });

describe('chooseRollback', () => {
  it('returns the previous successful deploy', () => {
    expect(chooseRollback([d('v1'), d('v2')])).toBe('v1');
    expect(chooseRollback([d('v1'), d('v2'), d('v3')])).toBe('v2');
  });
  it('skips failed and rolled-back deploys', () => {
    expect(chooseRollback([d('v1'), d('v2', 'failed'), d('v3', 'rolled-back'), d('v4')])).toBe('v1');
  });
  it('returns null when nothing is available', () => {
    expect(chooseRollback([])).toBe(null);
    expect(chooseRollback([d('v1')])).toBe(null);
    expect(chooseRollback([d('v1', 'failed'), d('v2')])).toBe(null);
  });
  it('refuses to cross a destructive migration', () => {
    expect(chooseRollback([d('v1'), d('v2'), d('v3', 'success', true)])).toBe(null);
    expect(chooseRollback([d('v1'), d('v2', 'success', true), d('v3', 'success', true)])).toBe(null);
    expect(chooseRollback([d('v1'), d('v2', 'failed', true), d('v3')])).toBe(null);
  });
  it('allows a destructive migration at or before the target', () => {
    expect(chooseRollback([d('v1', 'success', true), d('v2'), d('v3')])).toBe('v2');
    expect(chooseRollback([d('v1'), d('v2', 'success', true), d('v3')])).toBe('v2');
    expect(chooseRollback([d('v1'), d('v2', 'success', true), d('v3', 'failed'), d('v4')])).toBe('v2');
    expect(chooseRollback([d('v1'), d('v2', 'success', true), d('v3', 'failed', true), d('v4')])).toBe(null);
  });
  it('does not mutate its input', () => {
    const list = [d('v1'), d('v2')];
    chooseRollback(list);
    expect(list).toEqual([d('v1'), d('v2')]);
  });
});
```

%% hints
- `for (let i = deploys.length - 2; i >= 0; i -= 1)`: before looking at `deploys[i]`, check `deploys[i + 1].destructive`.

%% solution
```js
export function chooseRollback(deploys) {
  for (let i = deploys.length - 2; i >= 0; i -= 1) {
    if (deploys[i + 1].destructive) return null;
    if (deploys[i].status === 'success') return deploys[i].id;
  }
  return null;
}
```

%% exercise gx-check-canary | Tests for the canary decision | 4 | js | js | checkCanary | 40
`canaryDecision({ baseline, canary, minRequests = 100, maxRatio = 1.5, minRate = 0.01 })` returns `'hold'` (canary has fewer than `minRequests` requests), otherwise compares **rates** against `Math.max(baselineRate * maxRatio, minRate)` and returns `'rollback'` when the canary rate is **strictly above** it, else `'promote'` (an empty baseline has rate 0). You are given `checkCanary(canaryDecision)`. Write a check that passes for a correct implementation and **fails** for one that: **never holds on thin data**, **holds when requests equal minRequests**, **compares error counts instead of rates**, **ignores the baseline**, **ignores maxRatio**, **has no floor**, **rolls back at exactly the limit**.

```js
canaryDecision({ baseline: { errors: 0, requests: 1000 }, canary: { errors: 10, requests: 1000 } }); // 'promote'
```

%% worked
**A similar problem, solved: `checkStockLevel(stockLevel)`** — one input per rule, placed **on the boundary** where a wrong rule flips the answer.

```js
export function checkStockLevel(stockLevel) {                    // stockLevel({ sold, capacity }, warnRatio) -> 'none' | 'low' | 'ok'
  expect(stockLevel({ sold: 0, capacity: 0 }, 0.8)).toBe('none');   // ① the empty case (a mutant returning NaN-based answers fails)
  expect(stockLevel({ sold: 80, capacity: 100 }, 0.8)).toBe('low'); // ② exactly on the boundary: catches > instead of >=
  expect(stockLevel({ sold: 79, capacity: 100 }, 0.8)).toBe('ok');  // ③ just under it: catches a rule that is too eager
}
```

Boundaries catch off-by-one operators; **unequal totals** catch "counts instead of rates"; a **perfect baseline** catches a missing floor.

%% explain
- One input per mutant, each placed so only that mutant changes the verdict.
- **Boundary cases**: exactly `minRequests`, exactly the limit.
- **Unequal traffic** exposes counts versus rates.
- **Zero-error baseline** exposes the floor.

%% nudge
- Which input gives a different answer for `>` versus `>=`?
- How can a canary have *fewer* errors than the baseline and still be worse?

%% starter
```js
export function checkCanary(canaryDecision) {
  const b = (errors, requests) => ({ errors, requests });
  expect(canaryDecision({ baseline: b(10, 1000), canary: b(30, 1000) })).toBe('rollback');
  // add the inputs that expose each mistake listed above
}
```

%% tests
```js
const make = (f = {}) => ({ baseline, canary, minRequests = 100, maxRatio = 1.5, minRate = 0.01 }) => {
  if (!f.noHold && (f.holdAtEqual ? canary.requests <= minRequests : canary.requests < minRequests)) return 'hold';
  const rate = (s) => (s.requests ? s.errors / s.requests : 0);
  if (f.counts) return canary.errors > Math.max(baseline.errors * maxRatio, minRate) ? 'rollback' : 'promote';
  const ratio = f.noRatio ? 1 : maxRatio;
  let limit = f.noBaseline ? minRate : Math.max(rate(baseline) * ratio, f.noFloor ? 0 : minRate);
  const c = rate(canary);
  return (f.atLimit ? c >= limit : c > limit) ? 'rollback' : 'promote';
};

const correct = make();
const mutants = {
  'never holds on thin data': make({ noHold: true }),
  'holds when requests equal minRequests': make({ holdAtEqual: true }),
  'compares error counts instead of rates': make({ counts: true }),
  'ignores the baseline': make({ noBaseline: true }),
  'ignores maxRatio': make({ noRatio: true }),
  'has no floor': make({ noFloor: true }),
  'rolls back at exactly the limit': make({ atLimit: true }),
};

describe('your checkCanary', () => {
  it('passes on a correct implementation', () => {
    checkCanary(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an implementation that ${name}`, () => {
      let caught = false;
      try { checkCanary(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Thin data: `canary` with 99 requests and many errors must be `'hold'`; with exactly 100 and a clean record, `'promote'`.
- Counts vs rates: `baseline 100/10000` against `canary 20/200`.
- Ignores baseline: a noisy baseline `50/1000` with canary `50/1000` must be `'promote'`.
- Ignores maxRatio: baseline `10/1000`, canary `12/1000` must be `'promote'`.
- No floor: baseline `0/1000`, canary `5/1000` must be `'promote'`; exactly at the limit is `0/1000` against `10/1000`.

%% solution
```js
export function checkCanary(canaryDecision) {
  const b = (errors, requests) => ({ errors, requests });
  // thin data holds, even when it looks terrible; exactly minRequests is evaluated
  expect(canaryDecision({ baseline: b(10, 1000), canary: b(50, 99) })).toBe('hold');
  expect(canaryDecision({ baseline: b(0, 1000), canary: b(0, 100) })).toBe('promote');
  // rates, not counts: fewer errors but a far higher rate is worse
  expect(canaryDecision({ baseline: b(100, 10000), canary: b(20, 200) })).toBe('rollback');
  // clearly worse than the baseline
  expect(canaryDecision({ baseline: b(10, 1000), canary: b(30, 1000) })).toBe('rollback');
  // the baseline matters: a noisy baseline allows a noisy canary
  expect(canaryDecision({ baseline: b(50, 1000), canary: b(50, 1000) })).toBe('promote');
  // the ratio matters: 1.2x the baseline is fine, 4x allowed when maxRatio says so
  expect(canaryDecision({ baseline: b(10, 1000), canary: b(12, 1000) })).toBe('promote');
  expect(canaryDecision({ baseline: b(10, 1000), canary: b(30, 1000), maxRatio: 4 })).toBe('promote');
  // the floor: a perfect baseline still tolerates a few errors, exactly at the limit is fine
  expect(canaryDecision({ baseline: b(0, 1000), canary: b(5, 1000) })).toBe('promote');
  expect(canaryDecision({ baseline: b(0, 1000), canary: b(10, 1000) })).toBe('promote');
  expect(canaryDecision({ baseline: b(0, 1000), canary: b(20, 1000) })).toBe('rollback');
}
```
