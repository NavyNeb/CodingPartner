---
id: node-auth-guards
track: node
title: Backend auth, guards and throttling
summary: Logging users in without leaking who exists, issuing and rotating tokens safely, guards driven by route metadata (roles and ownership), and a sliding-window rate limiter.
---

## The idea in one sentence

Authentication asks **who are you?**, authorization asks **may you do this?**, and a **guard** is the one small function in front of every handler that answers the second question using the answer to the first.

> **Analogy** A conference. The registration desk checks your ID once and gives you a **badge** (authentication, a token). Each room has a sign saying who may enter (route **metadata**: staff, speakers, "owner of this booth"). The door guard (the **guard**) only compares your badge to the sign.

*(In NestJS these are `AuthGuard`, `RolesGuard` with `Reflector` metadata set by decorators, and `ThrottlerGuard`. You will build the logic as plain functions.)*

## Login without leaking

![Auth building blocks](fig:nd-guard "A guard reads route metadata and decides: public, signed in, role, owner.")

Four rules for a login service, each one a classic interview question:

- **Hash passwords** with a slow, salted algorithm. The service takes `hash` and `compare` **as dependencies**, so tests inject fast fakes and production injects bcrypt or argon2.
- **Same error for both failures**: "unknown email" and "wrong password" must both say `invalid credentials`, or attackers can list your users.
- **Equal work for both failures**: when the email is unknown, still run a comparison against a dummy hash, so the **response time** does not give the answer away either.
- **Never return the hash**, and never log the password.

```js try predict
const hits = [];
const limit = 3;
const windowMs = 1000;

function allow(now) {
  while (hits.length && hits[0] <= now - windowMs) hits.shift();   // forget old requests
  if (hits.length >= limit) return false;
  hits.push(now);
  return true;
}

console.log([0, 100, 200, 300, 1000, 1100].map(allow));
```

That is the whole **sliding window**: remember timestamps, drop the ones older than the window, refuse if there are already `limit` left. Notice the request at `1000`: the one made at `0` is exactly one window old, so it has **expired**.

## Tokens that can be rotated

![Refresh rotation](fig:nd-rotation "Each refresh token works once; replaying a used one revokes the whole family.")

Short-lived **access tokens** (minutes) go with every request. Long-lived **refresh tokens** (days) exist only to get new access tokens, and are **rotated**: using one returns a **new pair** and marks the old refresh token **used**. If a used token ever appears again, two parties hold it, so the whole **family** (everything issued from that login) is revoked.

```stepper Rotating a refresh token
code:
  issue("u1")        → A1, R1   (family F)
  refresh(R1)        → A2, R2   (R1 now used)
  refresh(R2)        → A3, R3   (R2 now used)
  refresh(R1)        → ✗ reuse detected, family F revoked
  verifyAccess(A3)   → ✗ invalid access token
  refresh(R3)        → ✗ invalid refresh token
---
line: 1
say: Login creates a **family** and the first pair. Everything derived from this login shares the family id.
phase: login
---
line: 2
say: Refreshing with `R1` marks it **used** and mints `A2` and `R2` in the **same family**.
phase: rotate
---
line: 3
say: The same again: the chain moves forward and each old refresh token is spent.
phase: rotate
---
line: 4
say: `R1` shows up again. It was already used, so **someone copied it**. The server cannot tell who is honest, so it revokes the whole family.
phase: reuse detected
---
line: 5
say: Even the newest access token `A3` is now rejected: the family is dead.
phase: family dead
---
line: 6
say: And the newest refresh token `R3` is useless too. The real user logs in again; the thief is locked out.
phase: family dead
```

## Guards read metadata

A guard shouldn't hard-code which routes need which roles. Routes are **tagged** with metadata (`public`, `roles`, `ownerParam`) and one generic guard reads the tags. That is the whole idea behind decorators like `@Roles('admin')`, minus the syntax.

- **public** routes skip every check.
- **No user** means `401` (not authenticated).
- A **role match** allows the request; an **owner match** (the user's id equals the route's `:id`) also allows it.
- A signed-in user on a route with **no restrictions** is allowed.
- Anything else is `403` (authenticated, but not allowed).

## Throttle by key

![Sliding window](fig:nd-window "Remember recent timestamps per key; refuse once the window already holds the limit.")

Rate limiting is a guard too. Count requests **per key** (an IP, a user id, an API key) inside a **sliding window**. Return `remaining` and a `Retry-After` so well-behaved clients back off.

## Quick check

```check
Q: Why should "unknown email" and "wrong password" return the same error?
A) It is shorter
B) Different errors let attackers discover which emails have accounts *
C) HTTP requires it
D) It makes tokens expire
Why: Account enumeration starts with distinguishable failures.
---
Q: A refresh token that was already used is presented again. What should the server do?
A) Issue a new pair anyway
B) Ignore it
C) Treat it as theft and revoke the whole token family *
D) Delay for a second
Why: Two holders of a one-time token means one of them is not the user.
---
Q: What is the difference between 401 and 403?
A) None
B) 401: not authenticated; 403: authenticated but not allowed *
C) 401: server error; 403: client error
D) 401: expired token only
Why: 401 means we do not know who you are, 403 means we do and the answer is no.
---
Q: In a sliding window limiter, a request made exactly one window ago:
A) Still counts
B) Has expired and no longer counts *
C) Counts double
D) Blocks the key
Why: The window is the last windowMs; the edge belongs to the past.
```

## Recap

- **Authenticate** (who) then **authorize** (may they); **401** vs **403**.
- Login: **injected** hash/compare, **same error** and **same work** for both failures, never return the hash.
- **Rotate** refresh tokens; **reuse revokes the family**; access tokens stay short-lived.
- **Metadata + one generic guard** beats hard-coded checks; owner and role are both allowed paths.
- **Sliding window** per key: drop expired timestamps, refuse at the limit, report `retryAfterMs`.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: can this user in? | `some`, and treating "no roles required" as public |
| Auth service | `async`/`await`, injected hashing, the same error on both paths |
| Token service | Maps for tokens, a family id, used flags, an injected clock |
| Metadata guard | A `WeakMap` per handler, the 401/403 decision order |
| Throttler | Per-key timestamp lists, dropping expired entries, retry time |
| Tests for a throttler | A fake clock and the exact window edge |

%% exercise nod-guided-access | Guided: may this user in? | 1 | js | js | canAccess | 8 | guided
Implement `canAccess(user, requiredRoles)`:

- If `requiredRoles` is missing or empty, the route has **no role restriction**: return `true`.
- Otherwise return `false` when there is no `user`.
- Otherwise return `true` if the user's `roles` array contains **at least one** of the required roles (a user without `roles` has none).

```js
canAccess({ roles: ['editor'] }, ['admin', 'editor']); // true
canAccess(null, ['admin']);                            // false
```

%% worked
**A similar problem, solved: `hasAllTags(item, wanted)`** — "all of these" instead of "any of these".

```js
function hasAllTags(item, wanted) {
  if (!wanted || wanted.length === 0) return true;      // ① nothing required, nothing to check
  const tags = item.tags ?? [];                          // ② a missing list means no tags
  return wanted.every((tag) => tags.includes(tag));      // ③ every required one must be present
}
```

Yours asks for **any** one match, so swap `every` for `some`, and handle the missing **user** first.

%% explain
- **Empty requirement** means allowed.
- **No user** means denied.
- **Any one role** is enough: `some`.

%% nudge
- What should happen when no roles are required at all?
- Which array method asks "at least one of these"?

%% starter
```js
export function canAccess(user, requiredRoles) {
  return false;
}
```

%% tests
```js
describe('canAccess', () => {
  it('allows when no roles are required', () => {
    expect(canAccess({ roles: [] }, undefined)).toBe(true);
    expect(canAccess({ roles: [] }, [])).toBe(true);
  });
  it('denies a missing user when roles are required', () => {
    expect(canAccess(null, ['admin'])).toBe(false);
    expect(canAccess(undefined, ['admin'])).toBe(false);
  });
  it('allows with one matching role', () => {
    expect(canAccess({ roles: ['editor'] }, ['admin', 'editor'])).toBe(true);
    expect(canAccess({ roles: ['a', 'b', 'admin'] }, ['admin'])).toBe(true);
  });
  it('denies without a matching role', () => {
    expect(canAccess({ roles: ['viewer'] }, ['admin'])).toBe(false);
    expect(canAccess({ roles: [] }, ['admin'])).toBe(false);
  });
  it('treats a user without roles as having none', () => {
    expect(canAccess({ id: 1 }, ['admin'])).toBe(false);
  });
});
```

%% hints
- `if (!requiredRoles || requiredRoles.length === 0) return true;`
- `if (!user) return false;`
- `return (user.roles ?? []).some((role) => requiredRoles.includes(role));`

%% solution
```js
export function canAccess(user, requiredRoles) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (!user) return false;
  return (user.roles ?? []).some((role) => requiredRoles.includes(role));
}
```

%% exercise nod-auth-service | A login service | 3 | js | js | createAuthService, InvalidCredentialsError | 32
`createAuthService({ hash, compare })` takes two **async** functions: `hash(password) → hashString` and `compare(password, hashString) → boolean`. It returns `{ register(email, password), login(email, password) }`, both async.

- Emails are **normalized**: trimmed and lower-cased, for both `register` and `login`.
- `register` rejects with `Error('email already registered')` for a taken email and `Error('password too short')` when the password has fewer than **8** characters (check the password **before** hashing). On success it stores the **hash** (never the password) and returns `{ id, email }` with ids `'u1'`, `'u2'`, …
- `login` returns `{ id, email }` on success and otherwise rejects with `InvalidCredentialsError` (message `'invalid credentials'`), **identical** for an unknown email and a wrong password.
- For an **unknown email**, `login` must still call `compare(password, someDummyHash)` exactly once, so both failures cost the same.
- Nothing returned ever contains the hash.

```js
const auth = createAuthService({ hash: async (p) => 'h:' + p, compare: async (p, h) => h === 'h:' + p });
await auth.register('Ada@X.io', 'correct horse');   // { id: 'u1', email: 'ada@x.io' }
await auth.login('ada@x.io', 'correct horse');      // { id: 'u1', email: 'ada@x.io' }
```

%% worked
**A similar problem, solved: `createPinLock({ compare })`** — one error for every failure, and work done either way.

```js
export function createPinLock({ compare }) {
  const pins = new Map();
  const DUMMY = 'dummy-hash';
  return {
    set(user, hash) { pins.set(user, hash); },
    async check(user, pin) {
      const stored = pins.get(user);
      const ok = await compare(pin, stored ?? DUMMY);   // ① always compare, even for an unknown user
      if (!stored || !ok) throw new Error('denied');     // ② ONE message for both failures
      return true;
    },
  };
}
```

Doing the comparison **before** deciding makes the two failure paths take the same time and say the same thing.

%% explain
- **Normalize** emails once, in a helper.
- **Always compare**, with a dummy hash when the user is unknown.
- **One error class** for both failures; **return only** `{ id, email }`.

%% nudge
- Where do you normalize the email so both methods agree?
- What do you pass to `compare` when there is no such user?

%% starter
```js
export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export function createAuthService({ hash, compare }) {
  const users = new Map();
  return {
    async register(email, password) {},
    async login(email, password) {},
  };
}
```

%% tests
```js
describe('createAuthService', () => {
  const rev = (p) => 'h:' + p.split('').reverse().join('');
  const setup = () => {
    const calls = { hash: [], compare: [] };
    const hash = async (p) => { calls.hash.push(p); return rev(p); };
    const compare = async (p, h) => { calls.compare.push([p, h]); return h === rev(p); };
    return { calls, auth: createAuthService({ hash, compare }) };
  };

  it('registers and returns only id and email, normalized', async () => {
    const { auth } = setup();
    expect(await auth.register('  Ada@X.io ', 'correct horse')).toEqual({ id: 'u1', email: 'ada@x.io' });
    expect(await auth.register('bob@x.io', 'another one!')).toEqual({ id: 'u2', email: 'bob@x.io' });
  });
  it('rejects a taken email, ignoring case', async () => {
    const { auth } = setup();
    await auth.register('ada@x.io', 'correct horse');
    await expect(auth.register('ADA@x.io', 'correct horse')).rejects.toThrow('email already registered');
  });
  it('rejects a short password before hashing', async () => {
    const { auth, calls } = setup();
    await expect(auth.register('a@x.io', 'short')).rejects.toThrow('password too short');
    expect(calls.hash).toEqual([]);
  });
  it('hashes the password and never stores or compares plaintext as the hash', async () => {
    const { auth, calls } = setup();
    await auth.register('ada@x.io', 'correct horse');
    expect(calls.hash).toEqual(['correct horse']);
    await auth.login('ada@x.io', 'correct horse');
    expect(calls.compare[0][0]).toBe('correct horse');
    expect(calls.compare[0][1]).toBe(rev('correct horse'));
  });
  it('logs in, ignoring email case and whitespace', async () => {
    const { auth } = setup();
    await auth.register('ada@x.io', 'correct horse');
    expect(await auth.login(' ADA@x.io ', 'correct horse')).toEqual({ id: 'u1', email: 'ada@x.io' });
  });
  it('gives the same error for a wrong password and an unknown email', async () => {
    const { auth } = setup();
    await auth.register('ada@x.io', 'correct horse');
    const wrong = await auth.login('ada@x.io', 'nope nope nope').catch((e) => e);
    const unknown = await auth.login('who@x.io', 'correct horse').catch((e) => e);
    expect(wrong).toBeInstanceOf(InvalidCredentialsError);
    expect(unknown).toBeInstanceOf(InvalidCredentialsError);
    expect(wrong.message).toBe('invalid credentials');
    expect(unknown.message).toBe(wrong.message);
  });
  it('still compares once for an unknown email', async () => {
    const { auth, calls } = setup();
    await auth.login('who@x.io', 'whatever pass').catch(() => {});
    expect(calls.compare).toHaveLength(1);
    expect(calls.compare[0][0]).toBe('whatever pass');
  });
  it('never exposes the hash', async () => {
    const { auth } = setup();
    const created = await auth.register('ada@x.io', 'correct horse');
    const session = await auth.login('ada@x.io', 'correct horse');
    expect(JSON.stringify([created, session])).not.toContain('h:');
    expect(Object.keys(session).sort()).toEqual(['email', 'id']);
  });
});
```

%% hints
- `const normalize = (email) => email.trim().toLowerCase();`
- In `login`: `const user = users.get(normalize(email)); const ok = await compare(password, user ? user.hash : DUMMY);`
- `if (!user || !ok) throw new InvalidCredentialsError();`

%% solution
```js
export class InvalidCredentialsError extends Error {
  constructor() {
    super('invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export function createAuthService({ hash, compare }) {
  const users = new Map();
  const DUMMY = 'dummy-hash-for-unknown-users';
  let next = 1;
  const normalize = (email) => email.trim().toLowerCase();
  return {
    async register(email, password) {
      const key = normalize(email);
      if (users.has(key)) throw new Error('email already registered');
      if (password.length < 8) throw new Error('password too short');
      const record = { id: 'u' + next++, email: key, hash: await hash(password) };
      users.set(key, record);
      return { id: record.id, email: record.email };
    },
    async login(email, password) {
      const user = users.get(normalize(email));
      const ok = await compare(password, user ? user.hash : DUMMY);
      if (!user || !ok) throw new InvalidCredentialsError();
      return { id: user.id, email: user.email };
    },
  };
}
```

%% exercise nod-tokens | Rotating refresh tokens | 4 | js | js | createTokenService | 45
`createTokenService({ now, random, accessTtl = 900000, refreshTtl = 604800000 })` where `now()` returns milliseconds and `random()` returns a fresh unique string each call. It returns:

- `issue(userId)` → `{ accessToken, refreshToken }` and starts a new **family** (call `random()` for the family id, then for each token; tokens must be unguessable-looking but only need to be distinct).
- `verifyAccess(token)` → the `userId`, or throws `Error('invalid access token')` (unknown, or its family was revoked) / `Error('access token expired')` (`now() >= expires`).
- `refresh(refreshToken)` → a **new pair in the same family**, and the used token can never be used again. Checks, in this order, with these errors: unknown → `'invalid refresh token'`; **already used** → revoke the **whole family** and throw `'refresh token reuse detected'`; family revoked → `'invalid refresh token'`; expired → `'refresh token expired'` (this does **not** revoke anything).

```js
const t = createTokenService({ now: () => 0, random: counter });
const first = t.issue('u1');
const second = t.refresh(first.refreshToken);
t.refresh(first.refreshToken);      // throws 'refresh token reuse detected'
t.verifyAccess(second.accessToken); // throws 'invalid access token' (family revoked)
```

%% worked
**A similar problem, solved: `createInviteCodes()`** — single-use codes that are marked used instead of deleted, so a replay is *detectable*.

```js
function createInviteCodes() {
  const codes = new Map();                                   // code -> { used }
  let n = 0;
  return {
    create() { const code = 'c' + ++n; codes.set(code, { used: false }); return code; },
    redeem(code) {
      const rec = codes.get(code);
      if (!rec) throw new Error('unknown code');
      if (rec.used) throw new Error('code already used');    // ① a second use is distinguishable from "never existed"
      rec.used = true;                                       // ② mark, don't delete
      return true;
    },
  };
}
```

If you deleted the record on first use, a replay would look like an unknown token and you could not detect theft. **Keep the used record.** Your service adds a **family**: reuse revokes everything in it.

%% explain
- **Maps** for access and refresh records, a **Set** of revoked families.
- **Mark used**, never delete, so replays are detectable.
- **Check order** matters: unknown → used → revoked → expired.

%% nudge
- What do you store for each refresh token so you can tell "used" from "unknown"?
- How does revoking a family also kill access tokens?

%% starter
```js
export function createTokenService({ now, random, accessTtl = 900000, refreshTtl = 604800000 }) {
  return {
    issue(userId) {},
    verifyAccess(token) {},
    refresh(refreshToken) {},
  };
}
```

%% tests
```js
describe('createTokenService', () => {
  const setup = (opts = {}) => {
    let time = 0;
    let n = 0;
    const service = createTokenService({ now: () => time, random: () => 'x' + ++n, ...opts });
    return { service, at: (t) => { time = t; } };
  };

  it('issues two different tokens and verifies the access token', () => {
    const { service } = setup();
    const pair = service.issue('u1');
    expect(pair.accessToken).not.toBe(pair.refreshToken);
    expect(service.verifyAccess(pair.accessToken)).toBe('u1');
  });
  it('gives each issue a distinct pair', () => {
    const { service } = setup();
    const a = service.issue('u1');
    const b = service.issue('u1');
    expect(a.accessToken).not.toBe(b.accessToken);
    expect(a.refreshToken).not.toBe(b.refreshToken);
  });
  it('rejects unknown access tokens', () => {
    const { service } = setup();
    expect(() => service.verifyAccess('nope')).toThrow('invalid access token');
  });
  it('expires access tokens at exactly the ttl', () => {
    const { service, at } = setup({ accessTtl: 1000 });
    const pair = service.issue('u1');
    at(999);
    expect(service.verifyAccess(pair.accessToken)).toBe('u1');
    at(1000);
    expect(() => service.verifyAccess(pair.accessToken)).toThrow('access token expired');
  });
  it('rotates: a refresh returns a new working pair', () => {
    const { service } = setup();
    const first = service.issue('u1');
    const second = service.refresh(first.refreshToken);
    expect(second.accessToken).not.toBe(first.accessToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(service.verifyAccess(second.accessToken)).toBe('u1');
    const third = service.refresh(second.refreshToken);
    expect(service.verifyAccess(third.accessToken)).toBe('u1');
  });
  it('keeps the old access token working after a normal refresh', () => {
    const { service } = setup();
    const first = service.issue('u1');
    service.refresh(first.refreshToken);
    expect(service.verifyAccess(first.accessToken)).toBe('u1');
  });
  it('rejects unknown refresh tokens', () => {
    const { service } = setup();
    expect(() => service.refresh('nope')).toThrow('invalid refresh token');
  });
  it('detects reuse and revokes the whole family', () => {
    const { service } = setup();
    const first = service.issue('u1');
    const second = service.refresh(first.refreshToken);
    const third = service.refresh(second.refreshToken);
    expect(() => service.refresh(first.refreshToken)).toThrow('refresh token reuse detected');
    expect(() => service.verifyAccess(third.accessToken)).toThrow('invalid access token');
    expect(() => service.verifyAccess(first.accessToken)).toThrow('invalid access token');
    expect(() => service.refresh(third.refreshToken)).toThrow('invalid refresh token');
  });
  it('keeps replays reported as reuse', () => {
    const { service } = setup();
    const first = service.issue('u1');
    service.refresh(first.refreshToken);
    expect(() => service.refresh(first.refreshToken)).toThrow('refresh token reuse detected');
    expect(() => service.refresh(first.refreshToken)).toThrow('refresh token reuse detected');
  });
  it('does not touch other families', () => {
    const { service } = setup();
    const mine = service.issue('u1');
    const other = service.issue('u2');
    service.refresh(mine.refreshToken);
    expect(() => service.refresh(mine.refreshToken)).toThrow('refresh token reuse detected');
    expect(service.verifyAccess(other.accessToken)).toBe('u2');
    expect(service.refresh(other.refreshToken).accessToken).toBeDefined();
  });
  it('expires refresh tokens without revoking anything', () => {
    const { service, at } = setup({ accessTtl: 5000, refreshTtl: 1000 });
    const pair = service.issue('u1');
    at(1000);
    expect(() => service.refresh(pair.refreshToken)).toThrow('refresh token expired');
    at(2000);
    expect(() => service.refresh(pair.refreshToken)).toThrow('refresh token expired');
    at(1500);
    expect(service.verifyAccess(pair.accessToken)).toBe('u1');
  });
  it('gives a rotated token a fresh lifetime', () => {
    const { service, at } = setup({ accessTtl: 1000, refreshTtl: 2000 });
    const first = service.issue('u1');
    at(1500);
    const second = service.refresh(first.refreshToken);
    at(2400);
    expect(service.verifyAccess(second.accessToken)).toBe('u1');
    expect(() => service.verifyAccess(first.accessToken)).toThrow('access token expired');
    expect(() => service.refresh(second.refreshToken)).not.toThrow();
  });
});
```

%% hints
- Three structures: `access: Map(token → { userId, family, expires })`, `refresh: Map(token → { userId, family, expires, used })`, `revoked: Set(family)`.
- A helper `mint(userId, family)` creates both tokens and stores them; `issue` calls it with a fresh family.
- In `refresh`, follow the order: unknown → `rec.used` (add family to `revoked`, throw) → family in `revoked` → expired → mark `used = true` and `mint`.
- `verifyAccess` checks `!rec || revoked.has(rec.family)` before the expiry.

%% solution
```js
export function createTokenService({ now, random, accessTtl = 900000, refreshTtl = 604800000 }) {
  const access = new Map();
  const refresh = new Map();
  const revoked = new Set();

  const mint = (userId, family) => {
    const accessToken = 'a_' + random();
    const refreshToken = 'r_' + random();
    const time = now();
    access.set(accessToken, { userId, family, expires: time + accessTtl });
    refresh.set(refreshToken, { userId, family, expires: time + refreshTtl, used: false });
    return { accessToken, refreshToken };
  };

  return {
    issue(userId) {
      return mint(userId, 'f_' + random());
    },
    verifyAccess(token) {
      const rec = access.get(token);
      if (!rec || revoked.has(rec.family)) throw new Error('invalid access token');
      if (now() >= rec.expires) throw new Error('access token expired');
      return rec.userId;
    },
    refresh(token) {
      const rec = refresh.get(token);
      if (!rec) throw new Error('invalid refresh token');
      if (rec.used) {
        revoked.add(rec.family);
        throw new Error('refresh token reuse detected');
      }
      if (revoked.has(rec.family)) throw new Error('invalid refresh token');
      if (now() >= rec.expires) throw new Error('refresh token expired');
      rec.used = true;
      return mint(rec.userId, rec.family);
    },
  };
}
```

%% exercise nod-auth-guard | A metadata-driven guard | 3 | js | js | createMetadata, createAuthGuard | 28
Two small pieces that together replace decorators.

`createMetadata()` returns `{ set(target, key, value), get(target, key) }`, storing values **per target object** (a handler function) without modifying it. `get` returns `undefined` for anything not set, and targets are independent.

`createAuthGuard(metadata)` returns `guard(ctx)` where `ctx = { handler, user, params }` and the result is one of `'allow'`, `'unauthenticated'` (401) or `'forbidden'` (403). The metadata keys are `public` (boolean), `roles` (array) and `ownerParam` (the name of a route param):

1. `public` → `'allow'`.
2. No `user` → `'unauthenticated'`.
3. Neither `roles` nor `ownerParam` set → `'allow'` (any signed-in user).
4. `roles` set and the user's `roles` array has **at least one** of them → `'allow'`.
5. `ownerParam` set, the param **exists**, and `String(user.id) === String(params[ownerParam])` → `'allow'`.
6. Otherwise `'forbidden'`.

```js
const meta = createMetadata();
const deleteUser = () => {};
meta.set(deleteUser, 'roles', ['admin']);
meta.set(deleteUser, 'ownerParam', 'id');
createAuthGuard(meta)({ handler: deleteUser, user: { id: 7, roles: [] }, params: { id: '7' } }); // 'allow'
```

%% worked
**A similar problem, solved: `createTags()`** — attach data to objects you don't own, with a `WeakMap`.

```js
function createTags() {
  const store = new WeakMap();                             // ① keyed by the object itself, and garbage-collected with it
  return {
    set(target, key, value) {
      store.set(target, { ...(store.get(target) ?? {}), [key]: value });   // ② merge into this target's record
    },
    get(target, key) {
      return store.get(target)?.[key];                     // ③ missing target or key gives undefined
    },
  };
}
```

A `WeakMap` keeps the tags **off the function** (no mutation) and lets them disappear when the function does. The guard is then just a list of ordered `if`s: **order is the logic** (public before user, user before roles).

%% explain
- **WeakMap** of per-target records.
- **Decision order** is part of the spec: public, user, no-restriction, role, owner, forbidden.
- **Owner check** compares as strings and requires the param to exist.

%% nudge
- Why does the 401 check come before the role check?
- What if `params[ownerParam]` is missing and the user id is `undefined`?

%% starter
```js
export function createMetadata() {
  return {
    set(target, key, value) {},
    get(target, key) {},
  };
}

export function createAuthGuard(metadata) {
  return (ctx) => 'allow';
}
```

%% tests
```js
describe('createMetadata', () => {
  it('stores values per target', () => {
    const m = createMetadata();
    const a = () => {};
    const b = () => {};
    m.set(a, 'roles', ['admin']);
    m.set(a, 'public', true);
    m.set(b, 'roles', ['user']);
    expect(m.get(a, 'roles')).toEqual(['admin']);
    expect(m.get(a, 'public')).toBe(true);
    expect(m.get(b, 'roles')).toEqual(['user']);
  });
  it('returns undefined for unknown targets and keys', () => {
    const m = createMetadata();
    const a = () => {};
    expect(m.get(a, 'x')).toBeUndefined();
    m.set(a, 'y', 1);
    expect(m.get(a, 'x')).toBeUndefined();
  });
  it('does not modify the target', () => {
    const m = createMetadata();
    const a = () => {};
    m.set(a, 'roles', ['admin']);
    expect(Object.keys(a)).toEqual([]);
  });
});

describe('createAuthGuard', () => {
  const setup = () => {
    const meta = createMetadata();
    return { meta, guard: createAuthGuard(meta), handler: () => {} };
  };
  it('lets public routes through, even without a user', () => {
    const { meta, guard, handler } = setup();
    meta.set(handler, 'public', true);
    meta.set(handler, 'roles', ['admin']);
    expect(guard({ handler, user: null, params: {} })).toBe('allow');
  });
  it('answers unauthenticated without a user', () => {
    const { guard, handler } = setup();
    expect(guard({ handler, user: null, params: {} })).toBe('unauthenticated');
    expect(guard({ handler, user: undefined })).toBe('unauthenticated');
  });
  it('allows any signed-in user when there is no restriction', () => {
    const { guard, handler } = setup();
    expect(guard({ handler, user: { id: 1 }, params: {} })).toBe('allow');
  });
  it('allows a matching role and forbids others', () => {
    const { meta, guard, handler } = setup();
    meta.set(handler, 'roles', ['admin', 'editor']);
    expect(guard({ handler, user: { id: 1, roles: ['editor'] }, params: {} })).toBe('allow');
    expect(guard({ handler, user: { id: 1, roles: ['viewer'] }, params: {} })).toBe('forbidden');
    expect(guard({ handler, user: { id: 1 }, params: {} })).toBe('forbidden');
  });
  it('allows the owner when ownerParam is set', () => {
    const { meta, guard, handler } = setup();
    meta.set(handler, 'ownerParam', 'id');
    expect(guard({ handler, user: { id: 7 }, params: { id: '7' } })).toBe('allow');
    expect(guard({ handler, user: { id: 7 }, params: { id: '8' } })).toBe('forbidden');
  });
  it('does not treat a missing param as ownership', () => {
    const { meta, guard, handler } = setup();
    meta.set(handler, 'ownerParam', 'id');
    expect(guard({ handler, user: { id: undefined }, params: {} })).toBe('forbidden');
    expect(guard({ handler, user: { id: 'undefined' }, params: {} })).toBe('forbidden');
  });
  it('lets a role OR ownership allow the request', () => {
    const { meta, guard, handler } = setup();
    meta.set(handler, 'roles', ['admin']);
    meta.set(handler, 'ownerParam', 'id');
    expect(guard({ handler, user: { id: 1, roles: ['admin'] }, params: { id: '9' } })).toBe('allow');
    expect(guard({ handler, user: { id: 9, roles: [] }, params: { id: '9' } })).toBe('allow');
    expect(guard({ handler, user: { id: 1, roles: [] }, params: { id: '9' } })).toBe('forbidden');
  });
  it('keeps handlers independent', () => {
    const { meta, guard, handler } = setup();
    const other = () => {};
    meta.set(handler, 'roles', ['admin']);
    expect(guard({ handler: other, user: { id: 1 }, params: {} })).toBe('allow');
  });
});
```

%% hints
- `const store = new WeakMap();` and merge into `store.get(target) ?? {}`.
- Read the three metadata values once at the top of the guard.
- Owner: `params && params[ownerParam] !== undefined && String(user.id) === String(params[ownerParam])`.

%% solution
```js
export function createMetadata() {
  const store = new WeakMap();
  return {
    set(target, key, value) {
      store.set(target, { ...(store.get(target) ?? {}), [key]: value });
    },
    get(target, key) {
      return store.get(target)?.[key];
    },
  };
}

export function createAuthGuard(metadata) {
  return ({ handler, user, params = {} }) => {
    if (metadata.get(handler, 'public')) return 'allow';
    if (!user) return 'unauthenticated';
    const roles = metadata.get(handler, 'roles');
    const ownerParam = metadata.get(handler, 'ownerParam');
    if (!roles && !ownerParam) return 'allow';
    if (roles && (user.roles ?? []).some((role) => roles.includes(role))) return 'allow';
    if (ownerParam && params[ownerParam] !== undefined && String(user.id) === String(params[ownerParam])) return 'allow';
    return 'forbidden';
  };
}
```

%% exercise nod-throttler | A sliding-window throttler | 3 | js | js | createThrottler | 28
`createThrottler({ limit, windowMs, now })` returns `{ check(key) }` giving `{ allowed, remaining, retryAfterMs }`:

- Each `key` has its **own** list of recent request times (`now()` is injected).
- A recorded time `t` is **expired** when `t <= now() - windowMs` (the edge counts as expired).
- If fewer than `limit` times remain, **record** this request and return `{ allowed: true, remaining: limit - count, retryAfterMs: 0 }` where `count` includes this request.
- Otherwise return `{ allowed: false, remaining: 0, retryAfterMs: oldest + windowMs - now() }` and **do not record** the denied request.

```js
// limit 3, windowMs 1000, requests at 0, 100, 200
// check at 300 → { allowed: false, remaining: 0, retryAfterMs: 700 }
```

%% worked
**A similar problem, solved: `createCooldown({ gapMs, now })`** — per-key timing with an injected clock, remembering only what matters.

```js
function createCooldown({ gapMs, now }) {
  const last = new Map();                                    // ① one record per key
  return {
    check(key) {
      const t = now();
      const prev = last.get(key);
      if (prev !== undefined && t - prev < gapMs) {
        return { allowed: false, retryAfterMs: prev + gapMs - t };   // ② denial reports WHEN to come back
      }
      last.set(key, t);                                      // ③ only allowed requests are recorded
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}
```

Yours keeps a **list** per key instead of one timestamp, and **drops expired entries before** counting.

%% explain
- **Per-key list** of timestamps.
- **Expire first**, then count, then record (only if allowed).
- **Retry** time comes from the oldest remaining timestamp.

%% nudge
- When exactly does an entry stop counting?
- Should a denied request be remembered?

%% starter
```js
export function createThrottler({ limit, windowMs, now }) {
  const hits = new Map();
  return {
    check(key) {
      return { allowed: true, remaining: limit, retryAfterMs: 0 };
    },
  };
}
```

%% tests
```js
describe('createThrottler', () => {
  const setup = (limit = 3, windowMs = 1000) => {
    let t = 0;
    return { throttler: createThrottler({ limit, windowMs, now: () => t }), at: (x) => { t = x; } };
  };
  it('allows up to the limit and counts down', () => {
    const { throttler, at } = setup();
    expect(throttler.check('a')).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
    at(100);
    expect(throttler.check('a').remaining).toBe(1);
    at(200);
    expect(throttler.check('a')).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
  });
  it('denies over the limit and says when to retry', () => {
    const { throttler, at } = setup();
    throttler.check('a');
    at(100);
    throttler.check('a');
    at(200);
    throttler.check('a');
    at(300);
    expect(throttler.check('a')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 700 });
    at(999);
    expect(throttler.check('a')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1 });
  });
  it('treats the exact window edge as expired', () => {
    const { throttler, at } = setup();
    throttler.check('a');
    at(100);
    throttler.check('a');
    at(200);
    throttler.check('a');
    at(1000);
    expect(throttler.check('a')).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
  });
  it('does not record denied requests', () => {
    const { throttler, at } = setup(2, 1000);
    throttler.check('a');
    at(10);
    throttler.check('a');
    at(500);
    expect(throttler.check('a').allowed).toBe(false);
    at(900);
    expect(throttler.check('a').allowed).toBe(false);
    at(1000);
    expect(throttler.check('a').allowed).toBe(true);
  });
  it('keeps keys independent', () => {
    const { throttler, at } = setup(1, 1000);
    expect(throttler.check('a').allowed).toBe(true);
    expect(throttler.check('a').allowed).toBe(false);
    expect(throttler.check('b').allowed).toBe(true);
    at(1000);
    expect(throttler.check('a').allowed).toBe(true);
  });
  it('slides rather than resetting in fixed blocks', () => {
    const { throttler, at } = setup(2, 1000);
    at(900);
    throttler.check('a');
    at(950);
    throttler.check('a');
    at(1000);
    expect(throttler.check('a').allowed).toBe(false);
    at(1900);
    expect(throttler.check('a').allowed).toBe(true);
    expect(throttler.check('a').allowed).toBe(false);
  });
});
```

%% hints
- `const list = hits.get(key) ?? []; hits.set(key, list);`
- Expire: `while (list.length && list[0] <= now() - windowMs) list.shift();`
- Denied: `retryAfterMs: list[0] + windowMs - now()`.
- Allowed: `list.push(now()); remaining = limit - list.length`.

%% solution
```js
export function createThrottler({ limit, windowMs, now }) {
  const hits = new Map();
  return {
    check(key) {
      const time = now();
      const list = hits.get(key) ?? [];
      hits.set(key, list);
      while (list.length && list[0] <= time - windowMs) list.shift();
      if (list.length >= limit) {
        return { allowed: false, remaining: 0, retryAfterMs: list[0] + windowMs - time };
      }
      list.push(time);
      return { allowed: true, remaining: limit - list.length, retryAfterMs: 0 };
    },
  };
}
```

%% exercise nod-check-throttler | Tests for a throttler | 4 | js | js | checkThrottler | 35
`createThrottler({ limit, windowMs, now })` returns `{ check(key) }` giving `{ allowed, remaining, retryAfterMs }` (an entry made at time `t` expires when `t <= now() - windowMs`; denied requests are not recorded; keys are independent). You are given `checkThrottler(createThrottler)`. Write a check that passes for a correct throttler and **fails** for one that: **counts denied requests**, **keeps requests that sit exactly on the window edge**, **shares one counter across all keys**, **miscounts the remaining requests**, **reports the wrong retry time**, **never forgets old requests**.

```js
let t = 0;
const throttler = createThrottler({ limit: 1, windowMs: 1000, now: () => t });
expect(throttler.check('a').allowed).toBe(true);
expect(throttler.check('a').allowed).toBe(false);
```

%% worked
**A similar problem, solved: `checkCooldown(createCooldown)`** — drive a **fake clock** and assert at the **edges** of the interval.

```js
export function checkCooldown(createCooldown) {         // createCooldown({ gapMs, now })
  let t = 0;
  const c = createCooldown({ gapMs: 100, now: () => t });
  expect(c.check('a').allowed).toBe(true);
  t = 99;
  expect(c.check('a')).toEqual({ allowed: false, retryAfterMs: 1 });   // ① one tick before: still blocked, exact wait
  t = 100;
  expect(c.check('a').allowed).toBe(true);                             // ② exactly on the edge: allowed again
  expect(c.check('b').allowed).toBe(true);                             // ③ another key is unaffected
}
```

With a throttler the extra traps are the **count** (`remaining`) and **recording denied requests**, which only show when you wait for the window to pass **after** being denied.

%% explain
- **Fake clock** with a `t` variable.
- **Edge probes**: one tick before expiry and exactly on it.
- **After a denial**, advance time and expect `allowed` again.
- **A second key** proves independence.

%% nudge
- At which exact time does the first request expire?
- What should you check *after* a few denials?

%% starter
```js
export function checkThrottler(createThrottler) {
  let t = 0;
  const throttler = createThrottler({ limit: 3, windowMs: 1000, now: () => t });
  expect(throttler.check('a').allowed).toBe(true);
  // your assertions: remaining, denial, retry time, edge, keys
}
```

%% tests
```js
const make = (f = {}) => ({ limit, windowMs, now }) => {
  const hits = new Map();
  return {
    check(key) {
      const k = f.sharedKey ? '*' : key;
      const list = hits.get(k) ?? [];
      hits.set(k, list);
      const time = now();
      const cutoff = time - windowMs;
      while (!f.neverExpire && list.length && (f.inclusiveEdge ? list[0] < cutoff : list[0] <= cutoff)) list.shift();
      if (list.length >= limit) {
        if (f.countDenied) list.push(time);
        return { allowed: false, remaining: 0, retryAfterMs: f.badRetry ? windowMs : list[0] + windowMs - time };
      }
      list.push(time);
      return { allowed: true, remaining: f.offByOne ? limit - list.length + 1 : limit - list.length, retryAfterMs: 0 };
    },
  };
};

const correct = make();
const mutants = {
  'counts denied requests': make({ countDenied: true }),
  'keeps requests that sit exactly on the window edge': make({ inclusiveEdge: true }),
  'shares one counter across all keys': make({ sharedKey: true }),
  'miscounts the remaining requests': make({ offByOne: true }),
  'reports the wrong retry time': make({ badRetry: true }),
  'never forgets old requests': make({ neverExpire: true }),
};

describe('your checkThrottler', () => {
  it('passes on a correct throttler', () => {
    checkThrottler(correct);
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a throttler that ${name}`, () => {
      let caught = false;
      try { checkThrottler(impl); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- Requests at `0`, `100`, `200` with limit 3 give remaining `2`, `1`, `0`.
- A fourth at `300` is denied with `retryAfterMs: 700`; at `999` it is `1`.
- At exactly `1000` the first entry is expired, so the next request is **allowed**.
- Another key at `300` should still be allowed with `remaining: 2`.

%% solution
```js
export function checkThrottler(createThrottler) {
  let t = 0;
  const throttler = createThrottler({ limit: 3, windowMs: 1000, now: () => t });

  expect(throttler.check('a')).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });
  t = 100;
  expect(throttler.check('a').remaining).toBe(1);
  t = 200;
  expect(throttler.check('a')).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });

  t = 300;
  expect(throttler.check('a')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 700 });
  expect(throttler.check('b')).toEqual({ allowed: true, remaining: 2, retryAfterMs: 0 });

  t = 999;
  expect(throttler.check('a')).toEqual({ allowed: false, remaining: 0, retryAfterMs: 1 });

  t = 1000;
  expect(throttler.check('a')).toEqual({ allowed: true, remaining: 0, retryAfterMs: 0 });
}
```
