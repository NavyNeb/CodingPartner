---
id: sec-capstone
track: sec
title: Capstone: threat modelling & defence in depth
summary: Putting security together: asking what can go wrong (STRIDE), authorisation that denies by default and checks ownership, a request pipeline that applies every defence in the right order, and ranking risks so you fix the right thing first.
---

## The idea in one sentence

Security is not one feature but **layers of cheap checks**, ordered so that **each request has to earn its way** to the code that does the work, chosen by asking **what could go wrong here**.

> **Analogy** A bank vault, not a bank door. Cameras, a guard, an ID check, a locked cage, a time-locked safe and an alarm: no single layer is perfect, but an attacker has to beat all of them, and the most valuable things have the most layers. You decide where to spend by asking what's inside and who wants it.

## Start with threats: STRIDE

Before writing defences, **list what could go wrong** for each part of your system. A simple checklist is **STRIDE**:

![STRIDE threats and defences](fig:sec-stride "Each letter is a question to ask of every component and data flow, with the defences you have already met.")

Draw the system (browser, API, database, third parties), mark where **data crosses a boundary**, and walk the six questions at each crossing. The result is a short list of **realistic threats**, which you then **rank** (below) rather than trying to fix everything.

## Authorisation: the most common serious bug

**Authentication** says who you are. **Authorisation** says what you may do. Most real-world breaches of web apps are not exotic: they are **missing authorisation checks**, especially **insecure direct object references (IDOR)**: `GET /invoices/42` returns invoice 42 to *anyone logged in*, so changing the number reads other people's data.

![Authentication versus authorisation](fig:sec-authz "Check the role and the owner, on the server, for every request, denying by default.")

Rules of thumb:

- **Deny by default.** A new action or role has **no** access until you grant it.
- Check **on the server, every time.** Hidden buttons and client checks are for usability.
- Check the **object**, not only the role: *editors may delete **their own** posts*.
- **Fail closed** on anything unexpected: missing user, unknown role, malformed action.
- Prefer a **central policy** to `if (user.role === 'admin')` scattered through handlers.

```js try predict
// A tiny policy: role -> permissions. ':own' means "only objects you own".
const policy = {
  admin: ['*'],
  editor: ['post:read', 'post:update', 'post:delete:own'],
  viewer: ['post:read'],
};
function can(user, action, resource) {
  for (const role of user?.roles ?? []) {
    for (const perm of policy[role] ?? []) {
      if (perm === '*' || perm === action) return true;
      if (perm === action + ':own' && user.id !== undefined && resource?.ownerId === user.id) return true;
    }
  }
  return false;
}
const editor = { id: 5, roles: ['editor'] };
console.log(can(editor, 'post:delete', { ownerId: 5 }), can(editor, 'post:delete', { ownerId: 9 }), can(editor, 'user:delete'));
```

## The pipeline: defences in order

![A secure request pipeline](fig:sec-pipeline "Cheap checks first; the handler runs only when the request has earned it.")

```stepper One request through the pipeline
code:
  1  rateLimit(ip)               → 429
  2  find the route              → 404 / 405
  3  session from the cookie     → 401
  4  CSRF token (unsafe methods) → 403
  5  authorize(user, action)     → 403
  6  validate(schema, body)      → 400
  7  handler(user, validatedBody)
  8  security headers on EVERY response; log once
---
line: 1
say: **Rate limit first**: it's the cheapest check, and it stops floods before you spend a database lookup on them.
cost: very low
---
line: 2
say: **Find the route.** An unknown path is `404`; a known path with the wrong method is `405` (with an `Allow` header). Nothing else has happened yet.
cost: low
---
line: 3
say: **Authenticate** (unless the route is public): read the session cookie and look it up. No valid session means `401`, and no later step runs.
cost: a lookup
---
line: 4
say: **CSRF**: for state-changing methods, the request must carry the session's secret token. (Safe methods like `GET` don't change anything, so they are exempt, which is exactly why `GET` must never change state.)
cost: low
---
line: 5
say: **Authorise**: *may this user perform this action?* A `403` here, **before** you parse the body, means attackers learn nothing about what input would be accepted.
cost: low
---
line: 6
say: **Validate** the body against the route's schema. Only the **validated** value, with unknown fields removed, ever reaches the handler: never the raw body.
cost: low
---
line: 7
say: The **handler** finally runs. If it throws, the client gets a generic `500` (never the error text, which may contain secrets or SQL) and the error is logged.
cost: the real work
---
line: 8
say: **Every** response, including errors, carries the security headers. Log one line per request: method, path, status, IP, and **never** headers, cookies or bodies.
cost: always
```

## Rank the risks

You can't fix everything at once. Score each threat by **likelihood × impact** (say 1–5 each), subtract what your **mitigations** already cover, and work down the list. A threat with high impact and high likelihood that has **no mitigation** is next on the board; a low-impact one can wait. Revisit the list when the system changes.

## Quick check

```check
Q: What is an insecure direct object reference (IDOR)?
A) A slow database query
B) Accepting an id from the request without checking that this user may access that object *
C) A broken link
D) A type error
Why: Changing `/invoices/42` to `/invoices/43` reveals someone else's data when ownership isn't checked.
---
Q: Why check authorisation on the server even if the UI hides the button?
A) Browsers are slow
B) Anyone can send requests directly, bypassing the UI entirely *
C) Buttons are insecure
D) It is required by HTTP
Why: The UI is under the client's control, so it can't enforce anything.
---
Q: Why does the pipeline authorise before validating the body?
A) Validation is expensive
B) Unauthorised callers should learn nothing about what input would be accepted, and cost you less *
C) The order does not matter
D) Bodies are optional
Why: Cheap, decisive checks first; the handler is reached only by requests that earned it.
---
Q: A handler throws an error whose message contains a database password. What should the client see?
A) The message, for debugging
B) A generic 500 message; log the details server-side *
C) A stack trace
D) Nothing, the connection closes
Why: Error text can leak secrets and internals.
---
Q: In STRIDE, what does "E" ask?
A) Can data be encrypted?
B) Can someone gain privileges they should not have (elevation of privilege)? *
C) Is the code efficient?
D) Are errors handled?
Why: Authorisation bugs and privilege escalation are the "E" threats.
```

## Recap

- **Threat-model first** (STRIDE), then **rank** risks by likelihood × impact minus mitigations.
- **Authorise** every request on the server: **deny by default**, check role **and owner**, fail closed.
- Order a pipeline **cheap to expensive**: rate limit, route, authenticate, CSRF, authorise, validate, handler.
- Hand the handler only **validated** data; return **generic errors**; add **security headers** everywhere; **log without secrets**.
- Layers beat perfection: an attacker has to defeat all of them.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: deny by default | A role-to-permissions map; `some` |
| An authorizer | Wildcards, the `:own` suffix, role union, failing closed |
| A secure request pipeline | The ordered steps, status codes, headers and logging |
| A risk register | Scores, mitigation halving, levels, a sorted report |
| Tests for an authorizer | Ownership and prefix bugs, default-allow mistakes |

%% exercise sec-guided-can | Guided: deny by default | 1 | js | js | can | 8 | guided
Implement `can(user, action, permissions)`. `user` is `{ roles: [...] }`; `permissions` maps a role name to an array of allowed action strings. Return `true` only if **some role of the user** lists **exactly** that action. Everything else is `false`: a missing user, no `roles` array, unknown roles, or an action nobody lists.

```js
const permissions = { editor: ['post:update'], viewer: ['post:read'] };
can({ roles: ['viewer'] }, 'post:read', permissions); // true
can({ roles: ['viewer'] }, 'post:update', permissions); // false
```

%% worked
**A similar problem, solved: `isAllowedIp(ip, lists)`** — the answer is `false` unless something says yes.

```js
export function isAllowedIp(ip, allowlist) {
  if (!Array.isArray(allowlist)) return false;      // ① bad configuration: deny
  return allowlist.includes(ip);                    // ② only an explicit match allows
}
```

The structure to copy is "**start from deny**, and let only an explicit rule open the door". Compare `can` written the other way round (`return !blocked.includes(action)`): every action you forgot to list would be allowed.

%% explain
- **Default is `false`.**
- **Any** of the user's roles may grant the action (exact string match).
- **Malformed input** (no user, no roles array, unknown role) is `false`.

%% nudge
- Which array method says "does any element satisfy this"?
- What should an unknown role mean?

%% starter
```js
export function can(user, action, permissions) {
  // deny unless some role of the user lists exactly this action
  return true;
}
```

%% tests
```js
describe('can', () => {
  const permissions = { editor: ['post:update', 'post:read'], viewer: ['post:read'], admin: ['post:update', 'post:read', 'user:delete'] };
  it('allows actions a role lists', () => {
    expect(can({ roles: ['viewer'] }, 'post:read', permissions)).toBe(true);
    expect(can({ roles: ['admin'] }, 'user:delete', permissions)).toBe(true);
  });
  it('denies actions no role lists', () => {
    expect(can({ roles: ['viewer'] }, 'post:update', permissions)).toBe(false);
    expect(can({ roles: ['editor'] }, 'user:delete', permissions)).toBe(false);
    expect(can({ roles: ['viewer'] }, 'post', permissions)).toBe(false);
  });
  it('uses the union of the user roles', () => {
    expect(can({ roles: ['viewer', 'editor'] }, 'post:update', permissions)).toBe(true);
  });
  it('matches the action exactly', () => {
    expect(can({ roles: ['viewer'] }, 'post:readall', permissions)).toBe(false);
    expect(can({ roles: ['viewer'] }, 'POST:READ', permissions)).toBe(false);
    expect(can({ roles: ['viewer'] }, 'post:rea', permissions)).toBe(false);
  });
  it('denies unknown roles and role names that only look similar', () => {
    expect(can({ roles: ['hacker'] }, 'post:read', permissions)).toBe(false);
    expect(can({ roles: ['Admin'] }, 'user:delete', permissions)).toBe(false);
    expect(can({ roles: ['constructor'] }, 'post:read', permissions)).toBe(false);
    expect(can({ roles: ['__proto__'] }, 'post:read', permissions)).toBe(false);
  });
  it('denies when the user or the roles are missing or malformed', () => {
    expect(can(null, 'post:read', permissions)).toBe(false);
    expect(can(undefined, 'post:read', permissions)).toBe(false);
    expect(can({}, 'post:read', permissions)).toBe(false);
    expect(can({ roles: [] }, 'post:read', permissions)).toBe(false);
    expect(can({ roles: 'admin' }, 'user:delete', permissions)).toBe(false);
  });
});
```

%% hints
- `Array.isArray(user?.roles)` first.
- Look up `permissions` with `Object.prototype.hasOwnProperty.call(permissions, role)` so inherited names like `constructor` don't count.
- `user.roles.some((role) => ... && permissions[role].includes(action))`

%% solution
```js
export function can(user, action, permissions) {
  if (!user || !Array.isArray(user.roles)) return false;
  return user.roles.some(
    (role) => Object.prototype.hasOwnProperty.call(permissions, role) && permissions[role].includes(action),
  );
}
```

%% exercise sec-authz | An authorizer | 3 | js | js | createAuthorizer | 30
Implement `createAuthorizer(policy)`, where `policy` maps a role name to a list of **permission strings**. It returns `{ can(user, action, resource) }`.

- An **action** looks like `type:verb` (exactly two parts), for example `post:update`. Anything else is `false`.
- A permission is one of: `*` (everything), `type:*` (any verb of that **exact** type), `type:verb` (that action), or `type:verb:own` (that action, **only** on a resource whose `ownerId` equals the user's `id`).
- The user may act if **any** of their roles grants it (**union**). Role names are matched **exactly** and only as **own** keys of `policy`.
- `:own` requires the user to **have an id** (not `undefined`/`null`), a resource, and `resource.ownerId === user.id`. A missing owner never matches a missing id.
- A missing user, a `roles` value that isn't an array, unknown roles, or no match all give `false`.

```js
const authz = createAuthorizer({ editor: ['post:read', 'post:delete:own'] });
authz.can({ id: 5, roles: ['editor'] }, 'post:delete', { ownerId: 5 }); // true
authz.can({ id: 5, roles: ['editor'] }, 'post:delete', { ownerId: 9 }); // false
```

%% worked
**A similar problem, solved: `createDocAccess(rules)`** — a grant can be unconditional or conditional on the object.

```js
export function createDocAccess(rules) {
  return {
    canEdit(user, doc) {
      for (const rule of rules[user?.role] ?? []) {                               // ① rules per role; an unknown role has none
        if (rule === 'edit:any') return true;                                       // ② unconditional
        if (rule === 'edit:own' && user.id != null && doc?.ownerId === user.id) return true;   // ③ conditional: id must exist AND match
      }
      return false;                                                                 // ④ otherwise: deny
    },
  };
}
```

The trap in ③ is `undefined === undefined`: a user with no id and a document with no owner would "own" each other. Always require the id to be **present**. For wildcards, match **whole parts** (`post:*` means type is exactly `post`), never `startsWith`, or `post:*` would also grant `postcard:read`.

%% explain
- **Split** permissions and actions into parts; compare whole parts.
- **`*`**, **`type:*`**, **`type:verb`** and **`type:verb:own`**.
- **Union** over roles; own-keys only.
- **Ownership** needs a real id, a resource and an equal owner.

%% nudge
- Why must `post:*` not match `postcard:read`?
- What goes wrong if both `user.id` and `resource.ownerId` are `undefined`?

%% starter
```js
export function createAuthorizer(policy) {
  return {
    can(user, action, resource) {
      return false;
    },
  };
}
```

%% tests
```js
const policy = {
  admin: ['*'],
  editor: ['post:read', 'post:update', 'post:delete:own', 'comment:*'],
  viewer: ['post:read'],
};
const authz = createAuthorizer(policy);
const u = (id, ...roles) => ({ id, roles });

describe('createAuthorizer', () => {
  it('lets admins do anything', () => {
    expect(authz.can(u(1, 'admin'), 'user:delete')).toBe(true);
    expect(authz.can(u(1, 'admin'), 'post:publish', { ownerId: 99 })).toBe(true);
  });
  it('grants exact permissions only', () => {
    expect(authz.can(u(2, 'viewer'), 'post:read')).toBe(true);
    expect(authz.can(u(2, 'viewer'), 'post:update')).toBe(false);
    expect(authz.can(u(2, 'viewer'), 'post:readall')).toBe(false);
    expect(authz.can(u(2, 'viewer'), 'comment:read')).toBe(false);
  });
  it('supports type wildcards on whole types only', () => {
    expect(authz.can(u(3, 'editor'), 'comment:delete')).toBe(true);
    expect(authz.can(u(3, 'editor'), 'comment:anything')).toBe(true);
    expect(authz.can(u(3, 'editor'), 'commentary:read')).toBe(false);
    expect(authz.can(u(3, 'editor'), 'post:publish')).toBe(false);
  });
  it('enforces ownership for :own permissions', () => {
    const editor = u(5, 'editor');
    expect(authz.can(editor, 'post:delete', { ownerId: 5 })).toBe(true);
    expect(authz.can(editor, 'post:delete', { ownerId: 9 })).toBe(false);
    expect(authz.can(editor, 'post:delete')).toBe(false);
    expect(authz.can(editor, 'post:delete', {})).toBe(false);
  });
  it('does not let a missing id own a missing owner', () => {
    expect(authz.can({ roles: ['editor'] }, 'post:delete', {})).toBe(false);
    expect(authz.can({ id: null, roles: ['editor'] }, 'post:delete', { ownerId: null })).toBe(false);
    expect(authz.can({ id: undefined, roles: ['editor'] }, 'post:delete', { ownerId: undefined })).toBe(false);
  });
  it('treats id 0 as a real id', () => {
    expect(authz.can(u(0, 'editor'), 'post:delete', { ownerId: 0 })).toBe(true);
  });
  it('unconditional permissions beat :own and ignore the resource', () => {
    const both = createAuthorizer({ a: ['post:delete:own'], b: ['post:delete'] });
    expect(both.can({ id: 1, roles: ['a', 'b'] }, 'post:delete', { ownerId: 2 })).toBe(true);
    expect(both.can({ id: 1, roles: ['a'] }, 'post:delete', { ownerId: 2 })).toBe(false);
  });
  it('uses the union of roles', () => {
    expect(authz.can(u(2, 'viewer', 'editor'), 'post:update')).toBe(true);
    expect(authz.can(u(2, 'viewer', 'hacker'), 'post:read')).toBe(true);
  });
  it('matches role names exactly and only own keys of the policy', () => {
    for (const role of ['Admin', 'ADMIN', 'admin ', 'hacker', 'constructor', '__proto__', 'toString']) {
      expect(authz.can(u(1, role), 'user:delete')).toBe(false);
    }
  });
  it('fails closed on malformed input', () => {
    expect(authz.can(null, 'post:read')).toBe(false);
    expect(authz.can(undefined, 'post:read')).toBe(false);
    expect(authz.can({ id: 1 }, 'post:read')).toBe(false);
    expect(authz.can({ id: 1, roles: 'admin' }, 'post:read')).toBe(false);
    expect(authz.can({ id: 1, roles: [] }, 'post:read')).toBe(false);
    for (const action of ['', 'post', 'a:b:c', ':', 'post:', ':read', undefined, null, 5]) {
      expect(authz.can(u(1, 'admin'), action)).toBe(false);
    }
  });
});
```

%% hints
- Split the action: `const parts = action.split(':')`; require `parts.length === 2` and both parts non-empty.
- A permission may end with `:own`; strip it, remember the flag, then compare `type` and `verb` (or `*`).
- Own check: `user.id !== undefined && user.id !== null && resource && resource.ownerId === user.id`.

%% solution
```js
export function createAuthorizer(policy) {
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  function grants(permission, type, verb) {
    if (permission === '*') return { ok: true, own: false };
    const parts = permission.split(':');
    let own = false;
    if (parts.length === 3 && parts[2] === 'own') {
      own = true;
      parts.pop();
    }
    if (parts.length !== 2) return { ok: false };
    const [pType, pVerb] = parts;
    if (pType !== type) return { ok: false };
    return pVerb === '*' || pVerb === verb ? { ok: true, own } : { ok: false };
  }

  return {
    can(user, action, resource) {
      if (!user || !Array.isArray(user.roles) || typeof action !== 'string') return false;
      const parts = action.split(':');
      if (parts.length !== 2 || parts[0] === '' || parts[1] === '') return false;
      const [type, verb] = parts;
      const isOwner = user.id !== undefined && user.id !== null && resource != null && resource.ownerId === user.id;
      for (const role of user.roles) {
        if (typeof role !== 'string' || !has(policy, role)) continue;
        for (const permission of policy[role]) {
          const g = grants(permission, type, verb);
          if (g.ok && (!g.own || isOwner)) return true;
        }
      }
      return false;
    },
  };
}
```

%% exercise sec-secure-handler | A secure request pipeline | 4 | js | js | handleRequest | 44
Implement `handleRequest(req, deps)` returning `{ status, headers, body }`. `req` is `{ method, path, ip, headers, body }` (header names lower-case). `deps` is `{ routes, rateLimit, sessions, csrf, authorize, validate, log }`. `routes` maps `'METHOD /path'` to `{ public, action, schema, handler }`.

Run these steps **in order**, stopping at the first that answers:

1. `rateLimit(req.ip)` is false → `429` `{ error: 'too many requests' }`.
2. Find the route with the **upper-cased** method. Unknown: if the path exists for **other methods**, `405` `{ error: 'method not allowed' }` with an `allow` header (those methods, sorted, joined with `', '`); otherwise `404` `{ error: 'not found' }`.
3. If the route is **not public**: take the `sid` from the `cookie` header (first duplicate wins), `sessions.get(sid)` gives `{ id, user }`; none → `401` `{ error: 'authentication required' }`.
4. Non-public and the method is not `GET`/`HEAD`/`OPTIONS`: `csrf.verify(session.id, headers['x-csrf-token'])` must be true, else `403` `{ error: 'invalid csrf token' }`.
5. Non-public with an `action`: `authorize(session.user, action)` must be true, else `403` `{ error: 'forbidden' }`.
6. If the route has a `schema`: `validate(schema, req.body)`; not ok → `400` `{ error: 'invalid input', details: errors }`; otherwise the handler gets the **validated value** as `body`. With no schema the handler's `body` is `undefined` (**never** the raw body).
7. Call `handler({ user, session, body, req })` (`user` is `session.user`, or `undefined` for public routes); it returns `{ status, body }`. If it **throws**, respond `500` `{ error: 'internal error' }` and call `log({ level: 'error', route: 'METHOD /path', error: error.message })`.
8. **Every** response has the headers `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: no-referrer`, `content-security-policy: default-src 'none'`, plus `cache-control: no-store` for non-public routes. Call `log({ level: 'info', method, path, status, ip })` **exactly once** per request with those five fields only.

```js
handleRequest({ method: 'GET', path: '/health', ip: '1.2.3.4', headers: {} }, deps);
```

%% worked
**A similar problem, solved: `guard(steps, ctx)`** — run checks in order; the first failure answers, later ones never run.

```js
export function guard(steps, ctx) {
  for (const step of steps) {
    const failure = step(ctx);                         // ① each step returns a response to STOP, or undefined to continue
    if (failure) return failure;                       // ② later steps never run
  }
  return { status: 200 };
}

const steps = [
  (c) => (c.rateLimited ? { status: 429 } : undefined),
  (c) => (!c.user ? { status: 401 } : undefined),
  (c) => (!c.user.isAdmin ? { status: 403 } : undefined),
];
```

Write `handleRequest` the same way: a **local `finish(status, body, extraHeaders, route)`** helper that adds the standard headers and writes the **one** log line, and an **early `return finish(...)`** for each failing step. Because each return happens before the next step's dependency is called, the order of checks is guaranteed (and tests can prove it with spies).

%% explain
- **Ordered steps** with early returns and the exact status codes and bodies.
- **`finish`** adds headers and logs once.
- **Validated body only** reaches the handler.
- **Exceptions** become a generic 500 plus an error log.

%% nudge
- Where do you build the headers so that no response can forget them?
- Why must a rejected request never reach `sessions.get` or the handler?

%% starter
```js
export function handleRequest(req, deps) {
  return { status: 500, headers: {}, body: { error: 'internal error' } };
}
```

%% tests
```js
const HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'",
};

function setup(over = {}) {
  const calls = [];
  const handler = jest.fn(({ user, body }) => { calls.push('handler'); return { status: 201, body: { by: user && user.id, body } }; });
  const deps = {
    routes: {
      'GET /health': { public: true, handler: () => ({ status: 200, body: { ok: true } }) },
      'POST /login': { public: true, handler: () => ({ status: 200, body: { loggedIn: true } }) },
      'GET /me': { handler: ({ user }) => ({ status: 200, body: { id: user.id } }) },
      'POST /posts': { action: 'post:create', schema: { title: { type: 'string' } }, handler },
      'POST /raw': { handler },
      'POST /boom': { handler: () => { throw new Error('db password is hunter2'); } },
    },
    rateLimit: jest.fn((ip) => { calls.push('rateLimit'); return true; }),
    sessions: { get: jest.fn((id) => { calls.push('sessions'); return id === 'good' ? { id: 'good', user: { id: 7, roles: ['editor'] } } : null; }) },
    csrf: { verify: jest.fn((sid, token) => { calls.push('csrf'); return token === 'tok'; }) },
    authorize: jest.fn(() => { calls.push('authorize'); return true; }),
    validate: jest.fn((schema, body) => {
      calls.push('validate');
      return body && typeof body.title === 'string' ? { ok: true, value: { title: body.title } } : { ok: false, value: undefined, errors: [{ path: 'title', message: 'is required' }] };
    }),
    log: jest.fn(),
    ...over,
  };
  return { deps, calls, handler };
}
const request = (method, path, extra = {}) => ({ method, path, ip: '1.2.3.4', headers: {}, body: undefined, ...extra });
const authed = { headers: { cookie: 'theme=dark; sid=good', 'x-csrf-token': 'tok' } };
const infoEntries = (deps) => deps.log.mock.calls.map((c) => c[0]).filter((e) => e.level === 'info');

describe('handleRequest', () => {
  it('serves a public route without a session and sets security headers', () => {
    const { deps } = setup();
    const res = handleRequest(request('GET', '/health'), deps);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers).toEqual(HEADERS);
    expect(deps.sessions.get).not.toHaveBeenCalled();
    expect(deps.csrf.verify).not.toHaveBeenCalled();
  });
  it('rate limits first, before anything else runs', () => {
    const { deps } = setup({ rateLimit: jest.fn(() => false) });
    const res = handleRequest(request('GET', '/me', authed), deps);
    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: 'too many requests' });
    expect(deps.rateLimit).toHaveBeenCalledWith('1.2.3.4');
    expect(deps.sessions.get).not.toHaveBeenCalled();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
  it('answers 404 and 405', () => {
    const { deps } = setup();
    const missing = handleRequest(request('GET', '/nope'), deps);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ error: 'not found' });
    const wrong = handleRequest(request('DELETE', '/posts'), deps);
    expect(wrong.status).toBe(405);
    expect(wrong.body).toEqual({ error: 'method not allowed' });
    expect(wrong.headers.allow).toBe('POST');
    expect(handleRequest(request('GET', '/login'), deps).headers.allow).toBe('POST');
    expect(deps.sessions.get).not.toHaveBeenCalled();
  });
  it('treats the method case-insensitively', () => {
    const { deps } = setup();
    expect(handleRequest(request('get', '/health'), deps).status).toBe(200);
  });
  it('requires authentication for non-public routes', () => {
    const { deps, handler } = setup();
    for (const headers of [{}, { cookie: '' }, { cookie: 'sid=bad' }, { cookie: 'theme=dark' }]) {
      const res = handleRequest(request('POST', '/posts', { headers, body: { title: 'x' } }), deps);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'authentication required' });
    }
    expect(deps.authorize).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it('uses the first sid cookie when there are duplicates', () => {
    const { deps } = setup();
    const res = handleRequest(request('GET', '/me', { headers: { cookie: 'sid=good; sid=bad' } }), deps);
    expect(res.status).toBe(200);
    expect(deps.sessions.get).toHaveBeenCalledWith('good');
  });
  it('serves authenticated GETs with no-store and the session user', () => {
    const { deps } = setup();
    const res = handleRequest(request('GET', '/me', { headers: { cookie: 'sid=good' } }), deps);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 7 });
    expect(res.headers).toEqual({ ...HEADERS, 'cache-control': 'no-store' });
    expect(deps.csrf.verify).not.toHaveBeenCalled();
  });
  it('requires a CSRF token for unsafe methods on non-public routes', () => {
    const { deps, handler } = setup();
    const res = handleRequest(request('POST', '/posts', { headers: { cookie: 'sid=good', 'x-csrf-token': 'wrong' }, body: { title: 'x' } }), deps);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'invalid csrf token' });
    expect(deps.csrf.verify).toHaveBeenCalledWith('good', 'wrong');
    expect(deps.authorize).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(handleRequest(request('POST', '/posts', { headers: { cookie: 'sid=good' }, body: { title: 'x' } }), deps).status).toBe(403);
  });
  it('does not require CSRF for public POST routes', () => {
    const { deps } = setup();
    expect(handleRequest(request('POST', '/login', { body: {} }), deps).status).toBe(200);
    expect(deps.csrf.verify).not.toHaveBeenCalled();
  });
  it('authorises with the session user and the route action', () => {
    const { deps, handler } = setup({ authorize: jest.fn(() => false) });
    const res = handleRequest(request('POST', '/posts', { ...authed, body: { title: 'x' } }), deps);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'forbidden' });
    expect(deps.authorize).toHaveBeenCalledWith({ id: 7, roles: ['editor'] }, 'post:create');
    expect(deps.validate).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });
  it('skips authorisation for routes without an action', () => {
    const { deps } = setup();
    handleRequest(request('POST', '/raw', { ...authed, body: { a: 1 } }), deps);
    expect(deps.authorize).not.toHaveBeenCalled();
  });
  it('validates the body and rejects bad input with details', () => {
    const { deps, handler } = setup();
    const res = handleRequest(request('POST', '/posts', { ...authed, body: { nope: 1 } }), deps);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid input', details: [{ path: 'title', message: 'is required' }] });
    expect(deps.validate).toHaveBeenCalledWith({ title: { type: 'string' } }, { nope: 1 });
    expect(handler).not.toHaveBeenCalled();
  });
  it('gives the handler only the validated body', () => {
    const { deps, handler } = setup();
    const res = handleRequest(request('POST', '/posts', { ...authed, body: { title: 'hi', isAdmin: true } }), deps);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ by: 7, body: { title: 'hi' } });
    expect(handler.mock.calls[0][0].body).toEqual({ title: 'hi' });
    expect(handler.mock.calls[0][0].session).toEqual({ id: 'good', user: { id: 7, roles: ['editor'] } });
  });
  it('never passes the raw body when a route has no schema', () => {
    const { deps, handler } = setup();
    handleRequest(request('POST', '/raw', { ...authed, body: { isAdmin: true } }), deps);
    expect(handler.mock.calls[0][0].body).toBeUndefined();
    expect(handler.mock.calls[0][0].req.body).toEqual({ isAdmin: true });
  });
  it('turns handler errors into a generic 500 and logs them', () => {
    const { deps } = setup();
    const res = handleRequest(request('POST', '/boom', authed), deps);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal error' });
    expect(JSON.stringify(res)).not.toContain('hunter2');
    expect(res.headers['x-frame-options']).toBe('DENY');
    const errors = deps.log.mock.calls.map((c) => c[0]).filter((e) => e.level === 'error');
    expect(errors).toEqual([{ level: 'error', route: 'POST /boom', error: 'db password is hunter2' }]);
  });
  it('logs exactly one info line per request with only the allowed fields', () => {
    const { deps } = setup();
    handleRequest(request('POST', '/posts', { ...authed, body: { title: 'secret title' } }), deps);
    expect(infoEntries(deps)).toEqual([{ level: 'info', method: 'POST', path: '/posts', status: 201, ip: '1.2.3.4' }]);
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain('sid=good');
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain('secret title');
    expect(JSON.stringify(deps.log.mock.calls)).not.toContain('tok');
    const failing = setup({ rateLimit: () => false });
    handleRequest(request('GET', '/me'), failing.deps);
    expect(infoEntries(failing.deps)).toEqual([{ level: 'info', method: 'GET', path: '/me', status: 429, ip: '1.2.3.4' }]);
  });
  it('runs the steps in the specified order', () => {
    const { deps, calls } = setup();
    handleRequest(request('POST', '/posts', { ...authed, body: { title: 'x' } }), deps);
    expect(calls).toEqual(['rateLimit', 'sessions', 'csrf', 'authorize', 'validate', 'handler']);
  });
  it('puts the security headers on every kind of response', () => {
    const { deps } = setup();
    const responses = [
      handleRequest(request('GET', '/nope'), deps),
      handleRequest(request('GET', '/me'), deps),
      handleRequest(request('POST', '/posts', { ...authed, body: {} }), deps),
      handleRequest(request('GET', '/health'), deps),
    ];
    for (const res of responses) {
      for (const [name, value] of Object.entries(HEADERS)) expect(res.headers[name]).toBe(value);
    }
    expect(responses[3].headers['cache-control']).toBeUndefined();
    expect(responses[1].headers['cache-control']).toBe('no-store');
  });
});
```

%% hints
- Define `finish(status, body, extra, route)` first: it builds the headers (adding `cache-control: no-store` for non-public routes), logs the info line, and returns `{ status, headers, body }`.
- Look up routes with `Object.prototype.hasOwnProperty.call(routes, key)`; for 405 compute the other methods for the same path.
- Wrap only the handler call in `try/catch`; the catch logs the error entry and returns a generic 500 through `finish`.

%% solution
```js
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'",
};

function sessionId(cookieHeader) {
  if (typeof cookieHeader !== 'string') return undefined;
  for (const pair of cookieHeader.split(';')) {
    const i = pair.indexOf('=');
    if (i < 0) continue;
    if (pair.slice(0, i).trim() === 'sid') return pair.slice(i + 1).trim();
  }
  return undefined;
}

export function handleRequest(req, deps) {
  const { routes, rateLimit, sessions, csrf, authorize, validate, log } = deps;
  const method = String(req.method).toUpperCase();
  const key = `${method} ${req.path}`;
  const headers = req.headers || {};

  const finish = (status, body, extra = {}, route) => {
    const responseHeaders = { ...SECURITY_HEADERS, ...extra };
    if (route && !route.public) responseHeaders['cache-control'] = 'no-store';
    log({ level: 'info', method, path: req.path, status, ip: req.ip });
    return { status, headers: responseHeaders, body };
  };

  if (!rateLimit(req.ip)) return finish(429, { error: 'too many requests' });

  const route = Object.prototype.hasOwnProperty.call(routes, key) ? routes[key] : undefined;
  if (!route) {
    const methods = Object.keys(routes)
      .filter((k) => k.slice(k.indexOf(' ') + 1) === req.path)
      .map((k) => k.slice(0, k.indexOf(' ')))
      .sort();
    if (methods.length) return finish(405, { error: 'method not allowed' }, { allow: methods.join(', ') });
    return finish(404, { error: 'not found' });
  }

  let session;
  if (!route.public) {
    const sid = sessionId(headers.cookie);
    session = sid ? sessions.get(sid) : null;
    if (!session) return finish(401, { error: 'authentication required' }, {}, route);
    if (!SAFE.has(method) && !csrf.verify(session.id, headers['x-csrf-token'])) {
      return finish(403, { error: 'invalid csrf token' }, {}, route);
    }
    if (route.action && !authorize(session.user, route.action)) {
      return finish(403, { error: 'forbidden' }, {}, route);
    }
  }

  let body;
  if (route.schema) {
    const result = validate(route.schema, req.body);
    if (!result.ok) return finish(400, { error: 'invalid input', details: result.errors }, {}, route);
    body = result.value;
  }

  try {
    const out = route.handler({ user: session ? session.user : undefined, session, body, req });
    return finish(out.status, out.body, {}, route);
  } catch (error) {
    log({ level: 'error', route: key, error: error.message });
    return finish(500, { error: 'internal error' }, {}, route);
  }
}
```

%% exercise sec-risk-register | A risk register | 2 | js | js | createRiskRegister | 18
Implement `createRiskRegister()`.

- `add({ id, title, likelihood, impact })`: `likelihood` and `impact` must be integers from 1 to 5, else `RangeError('likelihood and impact must be integers from 1 to 5')`; a repeated `id` throws `Error('duplicate risk: ID')`. Returns the register.
- `mitigate(id, name)` records a mitigation (**each name counts once** per risk); an unknown `id` throws `Error('unknown risk: ID')`. Returns the register.
- `score(id)` is the **residual** score: `Math.max(1, Math.round(likelihood × impact / 2 ** mitigationCount))`. An unknown id throws like above.
- `level(score)` is `'low'` below 5, `'medium'` below 12, `'high'` below 20, else `'critical'`.
- `top(n)` returns the first `n` risks as `{ id, title, inherent, residual, level, mitigations }` (`inherent` = likelihood × impact, `level` of the **residual**, `mitigations` a copy of the names), sorted by `residual` (highest first), then `inherent` (highest first), then `id`.

```js
const register = createRiskRegister().add({ id: 'R1', title: 'IDOR on invoices', likelihood: 4, impact: 5 });
register.score('R1'); // 20
register.mitigate('R1', 'ownership checks');
register.score('R1'); // 10
```

%% worked
**A similar problem, solved: `createBacklog()`** — items with a computed priority, listed in a deterministic order.

```js
export function createBacklog() {
  const items = new Map();
  const priority = (i) => Math.max(1, Math.round((i.value * i.urgency) / 2 ** i.done.size));   // ① a computed score, never stored
  return {
    add(item) { items.set(item.id, { ...item, done: new Set() }); return this; },
    complete(id, step) { items.get(id).done.add(step); return this; },                        // ② a Set: the same step twice counts once
    top(n) {
      return [...items.values()]
        .sort((a, b) => priority(b) - priority(a) || a.id.localeCompare(b.id))                // ③ ties broken by id: a stable report
        .slice(0, n);
    },
  };
}
```

Compute scores **on demand** from the facts (likelihood, impact, mitigations) so they can never get out of date. Break ties with extra sort keys so the **same input always gives the same report**.

%% explain
- **Validation** of the 1–5 range and duplicates.
- **Mitigations** as a set of names; each halves the score.
- **Level** thresholds at 5, 12, 20.
- **`top(n)`** sorted by residual, inherent, then id.

%% nudge
- Why use a `Set` for mitigation names?
- Which tie-breakers make the order deterministic?

%% starter
```js
export function createRiskRegister() {
  const risks = new Map();
  return {
    add(risk) { return this; },
    mitigate(id, name) { return this; },
    score(id) { return 0; },
    level(score) { return 'low'; },
    top(n) { return []; },
  };
}
```

%% tests
```js
describe('createRiskRegister', () => {
  const make = () => createRiskRegister()
    .add({ id: 'R1', title: 'IDOR on invoices', likelihood: 4, impact: 5 })
    .add({ id: 'R2', title: 'Weak passwords', likelihood: 3, impact: 4 })
    .add({ id: 'R3', title: 'Verbose errors', likelihood: 2, impact: 1 });
  it('scores risks as likelihood times impact', () => {
    const r = make();
    expect(r.score('R1')).toBe(20);
    expect(r.score('R2')).toBe(12);
    expect(r.score('R3')).toBe(2);
  });
  it('halves the score for each mitigation, rounding, never below 1', () => {
    const r = make();
    r.mitigate('R1', 'ownership checks');
    expect(r.score('R1')).toBe(10);
    r.mitigate('R1', 'integration tests');
    expect(r.score('R1')).toBe(5);
    r.mitigate('R1', 'audit logging');
    expect(r.score('R1')).toBe(3);
    for (let i = 0; i < 10; i++) r.mitigate('R1', 'm' + i);
    expect(r.score('R1')).toBe(1);
  });
  it('counts each mitigation name once', () => {
    const r = make();
    r.mitigate('R1', 'same');
    r.mitigate('R1', 'same');
    expect(r.score('R1')).toBe(10);
  });
  it('maps scores to levels at the thresholds', () => {
    const r = make();
    const levels = [[1, 'low'], [4, 'low'], [5, 'medium'], [11, 'medium'], [12, 'high'], [19, 'high'], [20, 'critical'], [25, 'critical']];
    for (const [score, level] of levels) expect(r.level(score)).toBe(level);
  });
  it('lists the top risks with residual, inherent and level', () => {
    const r = make();
    r.mitigate('R1', 'a');
    r.mitigate('R1', 'b');
    r.mitigate('R1', 'a');
    const top = r.top(2);
    expect(top).toEqual([
      { id: 'R2', title: 'Weak passwords', inherent: 12, residual: 12, level: 'high', mitigations: [] },
      { id: 'R1', title: 'IDOR on invoices', inherent: 20, residual: 5, level: 'medium', mitigations: ['a', 'b'] },
    ]);
    expect(r.top(10).map((x) => x.id)).toEqual(['R2', 'R1', 'R3']);
    expect(r.top(0)).toEqual([]);
  });
  it('breaks ties by inherent score, then id', () => {
    const r = createRiskRegister()
      .add({ id: 'B', title: 'b', likelihood: 3, impact: 2 })
      .add({ id: 'A', title: 'a', likelihood: 2, impact: 3 })
      .add({ id: 'C', title: 'c', likelihood: 4, impact: 3 });
    r.mitigate('C', 'm');
    expect(r.top(3).map((x) => x.id)).toEqual(['C', 'A', 'B']);
    const d = createRiskRegister().add({ id: 'X', title: 'x', likelihood: 4, impact: 2 }).add({ id: 'Y', title: 'y', likelihood: 2, impact: 4 });
    d.mitigate('X', 'm');
    expect(d.top(2).map((x) => x.id)).toEqual(['Y', 'X']);
  });
  it('returns copies of the mitigation list', () => {
    const r = make();
    r.mitigate('R1', 'a');
    r.top(3)[0].mitigations.push('hacked');
    expect(r.top(3).find((x) => x.id === 'R1').mitigations).toEqual(['a']);
  });
  it('validates input', () => {
    const r = make();
    for (const [likelihood, impact] of [[0, 3], [6, 3], [3, 0], [3, 6], [1.5, 3], ['3', 3], [3, undefined]]) {
      expect(() => r.add({ id: 'Z', title: 'z', likelihood, impact })).toThrow(RangeError);
    }
    expect(() => r.add({ id: 'R1', title: 'dup', likelihood: 1, impact: 1 })).toThrow('duplicate risk: R1');
    expect(() => r.mitigate('nope', 'x')).toThrow('unknown risk: nope');
    expect(() => r.score('nope')).toThrow('unknown risk: nope');
  });
  it('is chainable', () => {
    const r = createRiskRegister();
    expect(r.add({ id: 'a', title: 'a', likelihood: 1, impact: 1 })).toBe(r);
    expect(r.mitigate('a', 'm')).toBe(r);
  });
});
```

%% hints
- Store `{ ...risk, mitigations: new Set() }` per id.
- `residual = Math.max(1, Math.round((likelihood * impact) / 2 ** mitigations.size))`.
- Sort with `b.residual - a.residual || b.inherent - a.inherent || (a.id < b.id ? -1 : 1)`.

%% solution
```js
export function createRiskRegister() {
  const risks = new Map();
  const get = (id) => {
    if (!risks.has(id)) throw new Error('unknown risk: ' + id);
    return risks.get(id);
  };
  const residual = (r) => Math.max(1, Math.round((r.likelihood * r.impact) / 2 ** r.mitigations.size));
  const register = {
    add({ id, title, likelihood, impact }) {
      const ok = (n) => Number.isInteger(n) && n >= 1 && n <= 5;
      if (!ok(likelihood) || !ok(impact)) throw new RangeError('likelihood and impact must be integers from 1 to 5');
      if (risks.has(id)) throw new Error('duplicate risk: ' + id);
      risks.set(id, { id, title, likelihood, impact, mitigations: new Set() });
      return register;
    },
    mitigate(id, name) {
      get(id).mitigations.add(name);
      return register;
    },
    score: (id) => residual(get(id)),
    level(score) {
      if (score < 5) return 'low';
      if (score < 12) return 'medium';
      if (score < 20) return 'high';
      return 'critical';
    },
    top(n) {
      return [...risks.values()]
        .map((r) => ({
          id: r.id,
          title: r.title,
          inherent: r.likelihood * r.impact,
          residual: residual(r),
          level: register.level(residual(r)),
          mitigations: [...r.mitigations],
        }))
        .sort((a, b) => b.residual - a.residual || b.inherent - a.inherent || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .slice(0, n);
    },
  };
  return register;
}
```

%% exercise sec-check-authz | Tests for an authorizer | 4 | js | js | checkAuthorizer | 36
`createAuthorizer(policy)` returns `{ can(user, action, resource) }`. `policy` maps role names to permission strings: `*` (everything), `type:*` (any verb of that exact type), `type:verb`, and `type:verb:own` (only when `resource.ownerId` equals the user's `id`, and the user **has** an id). Roles are matched **exactly**, a user may use the **union** of their roles, actions must be exactly `type:verb`, and anything unexpected (no user, no roles array, unknown role) is **denied**. Write `checkAuthorizer(createAuthorizer)` that passes for a correct implementation and **fails** for: **ignores the :own restriction**, **never grants `*`**, **type wildcards match by prefix**, **matches role names case-insensitively**, **allows everything when the user has no roles**, **uses the intersection of roles instead of the union**, **lets a missing id own a missing owner**, **matches actions by prefix**, **allows a missing user**.

```js
const authz = createAuthorizer({ editor: ['post:read', 'post:delete:own'] });
expect(authz.can({ id: 5, roles: ['editor'] }, 'post:delete', { ownerId: 9 })).toBe(false);
```

%% worked
**A similar problem, solved: `checkDocAccess(createDocAccess)`** — for each access rule, test the **allowed**, the **denied** and the **sneaky edge**.

```js
export function checkDocAccess(createDocAccess) {            // roles: admin may edit any doc, author may edit own docs
  const access = createDocAccess({ admin: ['edit:any'], author: ['edit:own'] });
  expect(access.canEdit({ id: 1, role: 'admin' }, { ownerId: 9 })).toBe(true);            // ① the unconditional grant
  expect(access.canEdit({ id: 1, role: 'author' }, { ownerId: 1 })).toBe(true);           // ② the conditional grant, satisfied
  expect(access.canEdit({ id: 1, role: 'author' }, { ownerId: 2 })).toBe(false);          // ③ ...and not satisfied
  expect(access.canEdit({ role: 'author' }, {})).toBe(false);                             // ④ the sneaky edge: undefined === undefined
  expect(access.canEdit({ id: 1, role: 'Admin' }, { ownerId: 1 })).toBe(false);           // ⑤ a look-alike role name
  expect(access.canEdit(null, { ownerId: 1 })).toBe(false);                               // ⑥ no user at all
}
```

A permission system has two failure directions: **too strict** (a legitimate user is refused: caught by an *allowed* case) and **too lax** (an attacker gets in: caught by a *denied* case). Cover **both** for each rule, and add the **look-alike** inputs (prefixes, case changes, missing values) that lazy implementations mishandle.

%% explain
- **Allowed**: `*`, exact, type wildcard, own with matching owner, union of roles.
- **Denied**: other verbs, other types, non-owner, no owner info.
- **Look-alikes**: `commentary:read` vs `comment:*`, `post:readall` vs `post:read`, `Admin` vs `admin`.
- **Missing values**: no user, no roles, no id.

%% nudge
- Which assertion fails for an implementation that grants `comment:*` by checking `startsWith('comment')`?
- How do you show that a missing id must not match a missing owner?

%% starter
```js
export function checkAuthorizer(createAuthorizer) {
  const authz = createAuthorizer({ admin: ['*'], viewer: ['post:read'] });
  expect(authz.can({ id: 1, roles: ['viewer'] }, 'post:read')).toBe(true);
  expect(authz.can({ id: 1, roles: ['viewer'] }, 'post:update')).toBe(false);
  // your assertions: *, wildcards, ownership, role names, union, missing values, prefixes
}
```

%% tests
```js
const make = ({ ignoreOwn = false, noStar = false, prefixWildcard = false, caseInsensitive = false, noRolesAllowed = false, intersection = false, undefinedOwner = false, prefixAction = false, nullUserAllowed = false } = {}) => (policy) => ({
  can(user, action, resource) {
    if (!user) return nullUserAllowed;
    if (!Array.isArray(user.roles)) return false;
    if (user.roles.length === 0) return noRolesAllowed;
    const [type, verb] = String(action).split(':');
    if (!type || !verb || String(action).split(':').length !== 2) return false;
    const roleKeys = Object.keys(policy);
    const resolve = (role) => (caseInsensitive ? roleKeys.find((k) => k.toLowerCase() === String(role).toLowerCase()) : roleKeys.includes(role) ? role : undefined);
    const owner = ignoreOwn || (undefinedOwner
      ? resource != null && resource.ownerId === user.id
      : user.id != null && resource != null && resource.ownerId === user.id);
    const grantedBy = (role) => {
      const key = resolve(role);
      if (key === undefined) return false;
      return policy[key].some((perm) => {
        if (perm === '*') return !noStar;
        const parts = perm.split(':');
        const own = parts.length === 3 && parts[2] === 'own';
        if (own) parts.pop();
        const [pt, pv] = parts;
        const typeOk = prefixWildcard && pv === '*' ? type.startsWith(pt) : pt === type;
        const verbOk = pv === '*' || (prefixAction ? verb.startsWith(pv) : pv === verb);
        return typeOk && verbOk && (!own || owner);
      });
    };
    return intersection ? user.roles.every(grantedBy) : user.roles.some(grantedBy);
  },
});
const correct = make();
const mutants = {
  'ignores the :own restriction': make({ ignoreOwn: true }),
  'never grants *': make({ noStar: true }),
  'matches type wildcards by prefix': make({ prefixWildcard: true }),
  'matches role names case-insensitively': make({ caseInsensitive: true }),
  'allows everything when the user has no roles': make({ noRolesAllowed: true }),
  'uses the intersection of roles': make({ intersection: true }),
  'lets a missing id own a missing owner': make({ undefinedOwner: true }),
  'matches actions by prefix': make({ prefixAction: true }),
  'allows a missing user': make({ nullUserAllowed: true }),
};

describe('your checkAuthorizer', () => {
  it('passes on a correct authorizer', () => {
    expect(() => checkAuthorizer(correct)).not.toThrow();
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches an authorizer that ${name}`, () => {
      expect(() => checkAuthorizer(impl)).toThrow();
    });
  }
});
```

%% hints
- Policy: `{ admin: ['*'], editor: ['post:read', 'post:delete:own', 'comment:*'], viewer: ['post:read'] }`.
- Own: allowed with `{ id: 5 }` and `{ ownerId: 5 }`; denied with `{ ownerId: 9 }`; denied with a user that has **no id** and a resource with **no owner**.
- Look-alikes: `'commentary:read'` for `comment:*`, `'post:readall'` for `post:read`, role `'Admin'`.
- Union: a user with roles `['viewer', 'editor']` may `post:delete` their own post; intersection would refuse.

%% solution
```js
export function checkAuthorizer(createAuthorizer) {
  const authz = createAuthorizer({
    admin: ['*'],
    editor: ['post:read', 'post:update', 'post:delete:own', 'comment:*'],
    viewer: ['post:read'],
  });
  const user = (id, ...roles) => ({ id, roles });

  expect(authz.can(user(1, 'admin'), 'user:delete')).toBe(true);
  expect(authz.can(user(2, 'viewer'), 'post:read')).toBe(true);
  expect(authz.can(user(2, 'viewer'), 'post:update')).toBe(false);
  expect(authz.can(user(2, 'viewer'), 'comment:read')).toBe(false);

  expect(authz.can(user(3, 'editor'), 'comment:delete')).toBe(true);
  expect(authz.can(user(3, 'editor'), 'commentary:read')).toBe(false);
  expect(authz.can(user(2, 'viewer'), 'post:readall')).toBe(false);

  expect(authz.can(user(5, 'editor'), 'post:delete', { ownerId: 5 })).toBe(true);
  expect(authz.can(user(5, 'editor'), 'post:delete', { ownerId: 9 })).toBe(false);
  expect(authz.can(user(5, 'editor'), 'post:delete')).toBe(false);
  expect(authz.can({ roles: ['editor'] }, 'post:delete', {})).toBe(false);

  expect(authz.can(user(1, 'Admin'), 'user:delete')).toBe(false);
  expect(authz.can(user(1, 'hacker'), 'post:read')).toBe(false);

  expect(authz.can(user(5, 'viewer', 'editor'), 'post:delete', { ownerId: 5 })).toBe(true);
  expect(authz.can(user(5, 'viewer', 'editor'), 'post:update')).toBe(true);

  expect(authz.can(null, 'post:read')).toBe(false);
  expect(authz.can({ id: 1, roles: [] }, 'post:read')).toBe(false);
  expect(authz.can({ id: 1 }, 'post:read')).toBe(false);
}
```
