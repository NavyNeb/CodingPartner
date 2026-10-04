---
id: node-capstone
track: node
title: Capstone: config, logging, health and resilience
summary: The production plumbing around a backend: validated configuration, structured logs with context and redaction, health checks that tell the platform the truth, a circuit breaker, and wiring it all together at one composition root.
---

## The idea in one sentence

A backend that works on your laptop is half the job; the other half is that it **starts correctly**, **explains itself** when something goes wrong, **tells the platform its real health**, and **degrades gracefully** when a dependency fails.

> **Analogy** A restaurant kitchen. It checks the delivery before opening (**config**), keeps a ticket log of every order (**logs**), has a manager who says "we're open / limited menu / closed" (**health**), and stops sending orders to a broken oven instead of burning every dish (**circuit breaker**).

*(In NestJS this is `ConfigModule` with validation, `Logger` and `pino`, `@nestjs/terminus` health checks, resilience libraries, and the root `AppModule` that composes everything.)*

## Config: fail fast

![Configuration](fig:nd-config "Parse once at the edge, fail with every problem listed, then freeze.")

Environment variables are **all strings**, and they are where deployments go wrong. Read them **once at startup**, validate against a **spec** (required, type, allowed values, defaults), and **crash immediately** if anything is wrong, listing **every** problem, not just the first. The result is a **frozen, typed object** that you pass around; no other code touches `process.env`.

## Logs that help

A log line should be **structured** (an object, so tools can filter it), carry **context** (which request, which user), respect a **level**, and **never contain secrets**. A **child logger** adds context once (`requestId`) so every line inside a request has it. Errors are logged as `{ name, message }`, not as an opaque object. Sensitive keys (`password`, `token`, `authorization`) are **redacted** at any depth.

## Health: tell the truth

![Health checks](fig:nd-health "Liveness restarts; readiness gates traffic; critical versus optional dependencies.")

- **Liveness**: "is the process alive?" A failure means **restart me**.
- **Readiness**: "can I serve traffic now?" A failure means **stop sending me requests** (but do not restart).

Readiness runs **every dependency probe in parallel** with a **timeout**, because a hung database must not hang the probe. A **critical** dependency down means `down`; an **optional** one (a cache) down means `degraded`: still serving, with less.

## Circuit breaker

![Circuit breaker](fig:nd-breaker "Closed, open, half-open: stop hammering something that is already failing.")

When a downstream service is failing, calling it for every request wastes time and makes things worse. A **circuit breaker** counts **consecutive failures**; past a threshold it **opens** and **fails fast** without calling the service. After a **reset time** it goes **half-open** and lets **one trial** through: success closes it, failure opens it again with a fresh timer.

## The composition root

All the wiring (config, logger, database, services, health checks) lives in **one place** near the entry point, the **composition root**. Everything else receives its dependencies; nothing reaches out for globals. That one place is what lets tests build the same app with fakes.

```js try predict
const buildApp = ({ config, logger, db }) => {
  const users = { find: async (id) => db.get(id) };
  const handler = async (id) => {
    const user = await users.find(id);
    logger.info('lookup', { id, found: Boolean(user) });
    return user ?? null;
  };
  return { handler };
};

const lines = [];
const app = buildApp({
  config: { env: 'test' },
  logger: { info: (msg, fields) => lines.push(msg + ' ' + JSON.stringify(fields)) },
  db: new Map([[1, 'Ada']]),
});

app.handler(1).then((user) => console.log(user, lines));
```

```stepper One service boots
code:
  config   = loadConfig(process.env, spec)
  logger   = createLogger({ level: config.LOG_LEVEL })
  db       = connect(config.DATABASE_URL)
  health   = createHealth({ timeoutMs: 2000 })
  health.register('db', () => db.ping())
  app      = buildApp({ config, logger, db })
  listen(config.PORT)
---
line: 1
say: **Config first.** If anything is missing or malformed, the process dies **here**, with every problem listed.
phase: validate
---
line: 2
say: The logger gets its level from config. From now on everything logs through it, never `console.log`.
phase: observe
---
line: 3
say: The database connection is created once, from validated config.
phase: connect
---
line: 4
say: A health aggregator with a timeout, so a hung dependency cannot hang the probe.
phase: health
---
line: 5
say: Each dependency registers a probe; critical by default, optional if you say so.
phase: probes
---
line: 6
say: The app is **assembled from its parts**. In tests you pass fakes here and nothing else changes.
phase: compose
---
line: 7
say: Only after everything is wired does the server start listening: a failure earlier means the platform never routes traffic to a broken process.
phase: serve
```

## Quick check

```check
Q: Why validate configuration at startup instead of when first used?
A) It is faster
B) A bad deployment fails immediately, with all problems listed, not on the first unlucky request *
C) Environment variables change at run time
D) JSON requires it
Why: Fail fast turns a 3 a.m. surprise into a failed deploy.
---
Q: A cache is down but the database is up. What should readiness report?
A) down
B) degraded: still serving with less *
C) up, silently
D) restart
Why: Optional dependencies degrade the service; critical ones take it down.
---
Q: What does an open circuit breaker do with a call?
A) Queues it
B) Rejects it immediately without calling the failing service *
C) Calls the service twice
D) Closes the circuit
Why: Failing fast protects both the caller and the struggling service.
---
Q: Where should a logger get its requestId from?
A) A global variable
B) A child logger created per request, so every line carries it *
C) The message string
D) The database
Why: Context added once is on every line, with no repetition and no globals.
```

## Recap

- **Config**: parse once, validate everything, fail fast with all problems, freeze.
- **Logs**: structured, levelled, **context** via child loggers, errors as `{ name, message }`, **redact secrets**.
- **Health**: liveness vs readiness; probes in **parallel** with a **timeout**; critical vs optional gives **down / degraded / up**.
- **Circuit breaker**: closed, open, half-open; fail fast; one trial; fresh timer on failure.
- **Composition root**: one place wires everything, so tests can swap parts.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: overall status | `some` over a list of results |
| Config loader | A spec table, parsing strings, collecting all errors, `Object.freeze` |
| Structured logger | Levels, merging context, redaction, `child` |
| Health checks | `Promise` plus `setTimeout` race, running probes in parallel |
| Circuit breaker | A tiny state machine with an injected clock |
| Tests for a circuit breaker | A fake clock, spies, and one scenario per transition |

%% exercise nod-guided-status | Guided: overall status | 1 | js | js | overallStatus | 8 | guided
Implement `overallStatus(checks)` for an array of `{ status: 'up' | 'down', critical }` (where `critical` is `true` unless it is exactly `false`):

- any **critical** check that is `down` → `'down'`;
- otherwise any non-critical check that is `down` → `'degraded'`;
- otherwise (including an empty list) → `'up'`.

```js
overallStatus([{ status: 'up' }, { status: 'down', critical: false }]); // 'degraded'
```

%% worked
**A similar problem, solved: `worstLevel(items)`** — pick the most severe outcome with a short chain of `some`.

```js
function worstLevel(items) {
  if (items.some((i) => i.level === 'fatal')) return 'fatal';   // ① check the worst case first
  if (items.some((i) => i.level === 'error')) return 'error';   // ② then the next
  return 'ok';                                                  // ③ nothing bad: the default
}
```

Order matters: the **most severe** check goes first, so a list containing both outcomes reports the worse one. Here the extra twist is that `critical` defaults to **true** (`critical !== false`).

%% explain
- **Critical down** wins over everything.
- **Non-critical down** gives `degraded`.
- **`critical` defaults to true.**

%% nudge
- What does a check with no `critical` property count as?
- Which condition must be tested first?

%% starter
```js
export function overallStatus(checks) {
  return 'up';
}
```

%% tests
```js
describe('overallStatus', () => {
  it('is up for no checks or all up', () => {
    expect(overallStatus([])).toBe('up');
    expect(overallStatus([{ status: 'up' }, { status: 'up', critical: false }])).toBe('up');
  });
  it('is down when a critical check is down', () => {
    expect(overallStatus([{ status: 'down', critical: true }])).toBe('down');
  });
  it('treats a missing critical flag as critical', () => {
    expect(overallStatus([{ status: 'up' }, { status: 'down' }])).toBe('down');
  });
  it('is degraded when only optional checks are down', () => {
    expect(overallStatus([{ status: 'up' }, { status: 'down', critical: false }])).toBe('degraded');
  });
  it('lets a critical failure win over an optional one', () => {
    expect(overallStatus([{ status: 'down', critical: false }, { status: 'down' }])).toBe('down');
  });
  it('ignores the flag on up checks', () => {
    expect(overallStatus([{ status: 'up', critical: true }, { status: 'up', critical: false }])).toBe('up');
  });
});
```

%% hints
- `const isCritical = (c) => c.critical !== false;`
- `if (checks.some((c) => c.status === 'down' && isCritical(c))) return 'down';`
- `if (checks.some((c) => c.status === 'down')) return 'degraded';`

%% solution
```js
export function overallStatus(checks) {
  const isCritical = (c) => c.critical !== false;
  if (checks.some((c) => c.status === 'down' && isCritical(c))) return 'down';
  if (checks.some((c) => c.status === 'down')) return 'degraded';
  return 'up';
}
```

%% exercise nod-config | A validated config loader | 3 | js | js | loadConfig | 28
`loadConfig(env, spec)` reads strings from the `env` object according to `spec`, a map of `KEY → { type, required, default, oneOf }` with `type` one of `'string'`, `'number'`, `'boolean'`, `'url'`.

- A value that is **missing or an empty string** uses `default` if the spec has one (used **as is**, not parsed); otherwise if `required === false` the key is **omitted**; otherwise the error `KEY is required`.
- `number`: the trimmed text must be non-empty and `Number(...)` finite, else `KEY must be a number`. `boolean`: `'true'`/`'1'` → `true`, `'false'`/`'0'` → `false` (case-insensitive), else `KEY must be a boolean`. `url`: must parse with `new URL(...)`, else `KEY must be a valid URL` (the string is kept). `string` is kept as is.
- After parsing, if `oneOf` is present and the value is not in it: `KEY must be one of: a, b`.
- **All** problems are collected in spec order and thrown together as `Error('invalid config: ' + problems.join('; '))`.
- Otherwise return a **frozen** object with only the spec's keys (never the rest of `env`).

```js
loadConfig({ PORT: '8080', DEBUG: '1' }, {
  PORT: { type: 'number', default: 3000 },
  DEBUG: { type: 'boolean', default: false },
}); // { PORT: 8080, DEBUG: true }
```

%% worked
**A similar problem, solved: `readFlags(raw, names)`** — parse a string, **collect** errors instead of throwing at the first, and throw once at the end.

```js
function readFlags(raw, names) {
  const out = {};
  const problems = [];
  for (const name of names) {
    const value = raw[name];
    if (value === 'on') out[name] = true;
    else if (value === 'off') out[name] = false;
    else problems.push(name + ' must be on or off');   // ① remember the problem, keep going
  }
  if (problems.length) throw new Error('invalid flags: ' + problems.join('; '));   // ② ONE error with everything
  return Object.freeze(out);                                                       // ③ freeze what you hand out
}
```

Reporting **all** problems at once saves a redeploy per typo. `Object.freeze` makes sure no part of the app can quietly change a setting at run time.

%% explain
- **Loop the spec**, never `env`, so extra variables never leak in.
- **Per-key**: default/required first, then parse by type, then `oneOf`.
- **Collect then throw**; return a frozen result.

%% nudge
- Is an empty string present or missing?
- Why loop over the spec instead of the environment?

%% starter
```js
export function loadConfig(env, spec) {
  return Object.freeze({});
}
```

%% tests
```js
describe('loadConfig', () => {
  const spec = {
    PORT: { type: 'number', default: 3000 },
    DATABASE_URL: { type: 'url' },
    DEBUG: { type: 'boolean', default: false },
    NODE_ENV: { type: 'string', oneOf: ['development', 'production', 'test'], default: 'development' },
    SENTRY_DSN: { type: 'string', required: false },
  };
  const good = { DATABASE_URL: 'postgres://user@localhost:5432/app' };

  it('parses types and applies defaults', () => {
    expect(loadConfig({ ...good, PORT: '8080', DEBUG: 'true', NODE_ENV: 'production' }, spec)).toEqual({
      PORT: 8080,
      DATABASE_URL: 'postgres://user@localhost:5432/app',
      DEBUG: true,
      NODE_ENV: 'production',
    });
    expect(loadConfig(good, spec)).toEqual({ PORT: 3000, DATABASE_URL: good.DATABASE_URL, DEBUG: false, NODE_ENV: 'development' });
  });
  it('returns a frozen object with only the spec keys', () => {
    const config = loadConfig({ ...good, SECRET: 'x', PATH: '/bin' }, spec);
    expect(Object.isFrozen(config)).toBe(true);
    expect('SECRET' in config).toBe(false);
    expect('SENTRY_DSN' in config).toBe(false);
  });
  it('keeps optional values that are present', () => {
    expect(loadConfig({ ...good, SENTRY_DSN: 'abc' }, spec).SENTRY_DSN).toBe('abc');
  });
  it('treats an empty string as missing', () => {
    expect(loadConfig({ ...good, PORT: '', SENTRY_DSN: '' }, spec).PORT).toBe(3000);
    expect(() => loadConfig({ DATABASE_URL: '' }, spec)).toThrow('DATABASE_URL is required');
  });
  it('parses booleans in several spellings', () => {
    const boolSpec = { A: { type: 'boolean' } };
    for (const [text, value] of [['true', true], ['TRUE', true], ['1', true], ['false', false], ['False', false], ['0', false]]) {
      expect(loadConfig({ A: text }, boolSpec).A).toBe(value);
    }
  });
  it('rejects bad numbers, booleans and urls', () => {
    expect(() => loadConfig({ ...good, PORT: 'abc' }, spec)).toThrow('PORT must be a number');
    expect(() => loadConfig({ ...good, PORT: ' ' }, spec)).toThrow('PORT must be a number');
    expect(() => loadConfig({ ...good, PORT: 'Infinity' }, spec)).toThrow('PORT must be a number');
    expect(() => loadConfig({ ...good, DEBUG: 'maybe' }, spec)).toThrow('DEBUG must be a boolean');
    expect(() => loadConfig({ DATABASE_URL: 'not a url' }, spec)).toThrow('DATABASE_URL must be a valid URL');
  });
  it('accepts a number with surrounding spaces', () => {
    expect(loadConfig({ ...good, PORT: ' 80 ' }, spec).PORT).toBe(80);
  });
  it('checks oneOf', () => {
    expect(() => loadConfig({ ...good, NODE_ENV: 'staging' }, spec)).toThrow('NODE_ENV must be one of: development, production, test');
  });
  it('reports every problem at once, in spec order', () => {
    expect(() => loadConfig({ PORT: 'x', DEBUG: 'y' }, spec)).toThrow(
      'invalid config: PORT must be a number; DATABASE_URL is required; DEBUG must be a boolean',
    );
  });
  it('uses defaults as they are, without parsing them', () => {
    const s = { LIST: { type: 'string', default: ['a', 'b'] } };
    expect(loadConfig({}, s).LIST).toEqual(['a', 'b']);
  });
});
```

%% hints
- For each `[key, rule]` of `Object.entries(spec)`: `const raw = env[key]; const missing = raw === undefined || raw === '';`
- Missing: default → set; `required === false` → skip; else problem `key + ' is required'`.
- Number: `raw.trim() !== '' && Number.isFinite(Number(raw))`.
- Note `Number(' ')` is `0`, so check `raw.trim() !== ''` as well as finiteness.
- Push problems, `throw new Error('invalid config: ' + problems.join('; '))` after the loop; `return Object.freeze(out)`.

%% solution
```js
export function loadConfig(env, spec) {
  const out = {};
  const problems = [];

  for (const [key, rule] of Object.entries(spec)) {
    const raw = env[key];
    const missing = raw === undefined || raw === '';
    if (missing) {
      if (rule.default !== undefined) out[key] = rule.default;
      else if (rule.required !== false) problems.push(key + ' is required');
      continue;
    }

    let value = raw;
    if (rule.type === 'number') {
      const n = Number(raw);
      if (String(raw).trim() === '' || !Number.isFinite(n)) { problems.push(key + ' must be a number'); continue; }
      value = n;
    } else if (rule.type === 'boolean') {
      const text = String(raw).toLowerCase();
      if (text === 'true' || text === '1') value = true;
      else if (text === 'false' || text === '0') value = false;
      else { problems.push(key + ' must be a boolean'); continue; }
    } else if (rule.type === 'url') {
      try { new URL(raw); } catch { problems.push(key + ' must be a valid URL'); continue; }
    }

    if (rule.oneOf && !rule.oneOf.includes(value)) {
      problems.push(key + ' must be one of: ' + rule.oneOf.join(', '));
      continue;
    }
    out[key] = value;
  }

  if (problems.length > 0) throw new Error('invalid config: ' + problems.join('; '));
  return Object.freeze(out);
}
```

%% exercise nod-logger | A structured logger | 4 | js | js | createLogger | 38
`createLogger({ write, level = 'info', context = {}, now = () => Date.now(), redact = [] })` returns `{ debug, info, warn, error, child }`.

- `logger.info(message, fields = {})` (and the other levels) calls `write(entry)` with `{ ...context, ...fields, level, time: now(), msg: message }` (so **fields can never overwrite** `level`, `time` or `msg`).
- Levels rank `debug < info < warn < error`; a call below the configured `level` writes **nothing**.
- If `fields` is itself an `Error`, treat it as `{ err: fields }`.
- Every `Error` value (at any depth, including in arrays) becomes `{ name, message }` (no stack).
- Keys listed in `redact` (**case-insensitive**) are replaced with `'[redacted]'` at **any depth** of plain objects and arrays, in both `context` and `fields`.
- Only **plain objects and arrays** are copied while cleaning; other values (numbers, `Date`s, `null`) pass through. The inputs are never mutated.
- `child(extra)` returns a logger with `context` merged with `extra` (the child's values win), sharing `write`, `level`, `now` and `redact`.

```js
const log = createLogger({ write: (e) => lines.push(e), now: () => 1, context: { service: 'api' } });
log.child({ requestId: 'r1' }).info('hi', { user: 7 });
// { service: 'api', requestId: 'r1', user: 7, level: 'info', time: 1, msg: 'hi' }
```

%% worked
**A similar problem, solved: `maskSecrets(value, secretKeys)`** — a recursive copy that rewrites some keys, whatever the depth.

```js
function maskSecrets(value, secretKeys) {
  const secret = new Set(secretKeys.map((k) => k.toLowerCase()));       // ① normalise once
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);                            // ② arrays: recurse per element
    if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
      const out = {};
      for (const [k, inner] of Object.entries(v)) {
        out[k] = secret.has(k.toLowerCase()) ? '[redacted]' : walk(inner);   // ③ mask the key, or keep walking
      }
      return out;
    }
    return v;                                                            // ④ everything else is returned as is
  };
  return walk(value);
}
```

Your `clean` adds one case (an `Error` becomes `{ name, message }`) and is applied to the **context** and the **fields** separately before they are merged.

%% explain
- **`clean`** copies plain objects/arrays, redacts keys, converts `Error`s.
- **Merge order** protects `level`, `time`, `msg`.
- **`child`** builds a new logger with merged context.

%% nudge
- Why put `level`, `time` and `msg` last when merging?
- What should happen to a nested object under a redacted key?

%% starter
```js
export function createLogger({ write, level = 'info', context = {}, now = () => Date.now(), redact = [] }) {
  const make = (ctx) => ({
    debug() {},
    info() {},
    warn() {},
    error() {},
    child(extra) {
      return make({ ...ctx, ...extra });
    },
  });
  return make(context);
}
```

%% tests
```js
describe('createLogger', () => {
  const setup = (opts = {}) => {
    const lines = [];
    const logger = createLogger({ write: (e) => lines.push(e), now: () => 1000, ...opts });
    return { lines, logger };
  };

  it('writes a structured entry', () => {
    const { lines, logger } = setup();
    logger.info('hello', { user: 7 });
    expect(lines).toEqual([{ user: 7, level: 'info', time: 1000, msg: 'hello' }]);
  });
  it('works without fields', () => {
    const { lines, logger } = setup();
    logger.warn('careful');
    expect(lines).toEqual([{ level: 'warn', time: 1000, msg: 'careful' }]);
  });
  it('filters below the configured level', () => {
    const { lines, logger } = setup({ level: 'warn' });
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');
    expect(lines.map((l) => l.msg)).toEqual(['c', 'd']);
    const verbose = setup({ level: 'debug' });
    verbose.logger.debug('x');
    expect(verbose.lines).toHaveLength(1);
  });
  it('includes context, with fields overriding context', () => {
    const { lines, logger } = setup({ context: { service: 'api', user: 1 } });
    logger.info('x', { user: 2 });
    expect(lines[0]).toMatchObject({ service: 'api', user: 2 });
  });
  it('never lets fields overwrite level, time or msg', () => {
    const { lines, logger } = setup();
    logger.info('real', { level: 'error', time: 0, msg: 'fake' });
    expect(lines[0]).toEqual({ level: 'info', time: 1000, msg: 'real' });
  });
  it('creates child loggers with merged context', () => {
    const { lines, logger } = setup({ context: { service: 'api' } });
    const child = logger.child({ requestId: 'r1' });
    child.info('a');
    child.child({ requestId: 'r2', step: 2 }).info('b');
    logger.info('c');
    expect(lines[0]).toMatchObject({ service: 'api', requestId: 'r1' });
    expect(lines[1]).toMatchObject({ requestId: 'r2', step: 2, service: 'api' });
    expect('requestId' in lines[2]).toBe(false);
  });
  it('lets children share level, redaction and the clock', () => {
    const { lines, logger } = setup({ level: 'warn', redact: ['token'] });
    const child = logger.child({ a: 1 });
    child.info('hidden');
    child.warn('shown', { token: 'abc' });
    expect(lines).toHaveLength(1);
    expect(lines[0].token).toBe('[redacted]');
    expect(lines[0].time).toBe(1000);
  });
  it('serializes errors as name and message', () => {
    const { lines, logger } = setup();
    logger.error('failed', { err: new TypeError('bad input'), list: [new Error('inner')] });
    expect(lines[0].err).toEqual({ name: 'TypeError', message: 'bad input' });
    expect(lines[0].list).toEqual([{ name: 'Error', message: 'inner' }]);
    logger.error('direct', new Error('boom'));
    expect(lines[1].err).toEqual({ name: 'Error', message: 'boom' });
  });
  it('redacts keys at any depth, case-insensitively', () => {
    const { lines, logger } = setup({ redact: ['password', 'Authorization'], context: { PASSWORD: 'ctx' } });
    logger.info('login', { user: 'ada', password: 'hunter2', headers: { authorization: 'Bearer x', accept: '*/*' }, items: [{ Password: 'p' }] });
    expect(lines[0].user).toBe('ada');
    expect(lines[0].password).toBe('[redacted]');
    expect(lines[0].PASSWORD).toBe('[redacted]');
    expect(lines[0].headers).toEqual({ authorization: '[redacted]', accept: '*/*' });
    expect(lines[0].items).toEqual([{ Password: '[redacted]' }]);
  });
  it('redacts a whole nested object under a redacted key', () => {
    const { lines, logger } = setup({ redact: ['credentials'] });
    logger.info('x', { credentials: { user: 'a', pass: 'b' } });
    expect(lines[0].credentials).toBe('[redacted]');
  });
  it('passes other values through and does not mutate the inputs', () => {
    const { lines, logger } = setup({ redact: ['secret'] });
    const when = new Date(0);
    const fields = { n: 1, ok: true, nothing: null, when, nested: { secret: 's', keep: 1 } };
    logger.info('x', fields);
    expect(lines[0].when).toBe(when);
    expect(lines[0].nothing).toBeNull();
    expect(fields.nested.secret).toBe('s');
    expect(lines[0].nested).toEqual({ secret: '[redacted]', keep: 1 });
  });
  it('reads the clock on each call', () => {
    const lines = [];
    let t = 0;
    const logger = createLogger({ write: (e) => lines.push(e), now: () => ++t });
    logger.info('a');
    logger.info('b');
    expect(lines.map((l) => l.time)).toEqual([1, 2]);
  });
});
```

%% hints
- `const ORDER = { debug: 10, info: 20, warn: 30, error: 40 };` and skip when `ORDER[lvl] < ORDER[level]`.
- `clean(value)`: `Error` → `{ name, message }`; array → map; plain object → copy with redaction; else the value.
- Entry: `{ ...clean(ctx), ...clean(fields), level: lvl, time: now(), msg: message }`.
- `fields instanceof Error ? { err: fields } : fields`.

%% solution
```js
export function createLogger({ write, level = 'info', context = {}, now = () => Date.now(), redact = [] }) {
  const ORDER = { debug: 10, info: 20, warn: 30, error: 40 };
  const hidden = new Set(redact.map((k) => k.toLowerCase()));

  const clean = (value) => {
    if (value instanceof Error) return { name: value.name, message: value.message };
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object') {
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        const out = {};
        for (const [key, inner] of Object.entries(value)) {
          out[key] = hidden.has(key.toLowerCase()) ? '[redacted]' : clean(inner);
        }
        return out;
      }
    }
    return value;
  };

  const make = (ctx) => {
    const log = (lvl) => (message, fields = {}) => {
      if (ORDER[lvl] < ORDER[level]) return;
      const extra = fields instanceof Error ? { err: fields } : fields;
      write({ ...clean(ctx), ...clean(extra), level: lvl, time: now(), msg: message });
    };
    return {
      debug: log('debug'),
      info: log('info'),
      warn: log('warn'),
      error: log('error'),
      child(extra) {
        return make({ ...ctx, ...extra });
      },
    };
  };
  return make(context);
}
```

%% exercise nod-health | Health checks with timeouts | 4 | js | js | createHealth | 38
`createHealth({ timeoutMs })` returns `{ register(name, probe, { critical = true } = {}), check() }`.

- `register` stores a probe (a sync or async function) and returns the health object (so calls chain).
- `check()` (async) runs **all probes in parallel**. A probe that resolves (any value) is `{ status: 'up' }`. A probe that throws or rejects is `{ status: 'down', error: message }` (`message` is `error.message`, or `String(error)` if there is none). A probe that has not finished after `timeoutMs` is `{ status: 'down', error: 'timeout' }`.
- The result is `{ status, checks }` where `checks` maps each name to its result and `status` is `'down'` if a **critical** probe is down, else `'degraded'` if an **optional** one is down, else `'up'` (also for no probes).
- Timers of probes that finished in time must be **cleared**.

```js
const health = createHealth({ timeoutMs: 2000 });
health.register('db', () => db.ping());
health.register('cache', () => cache.ping(), { critical: false });
await health.check(); // { status: 'degraded', checks: { db: { status: 'up' }, cache: { status: 'down', error: '…' } } }
```

%% worked
**A similar problem, solved: `withTimeout(fn, ms)`** — turn a task and a timer into one promise, whichever settles first, and clean up.

```js
function withTimeout(fn, ms) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (result) => {
      if (finished) return;                                    // ① only the FIRST outcome counts
      finished = true;
      clearTimeout(timer);                                     // ② never leave the timer running
      resolve(result);
    };
    const timer = setTimeout(() => finish({ status: 'down', error: 'timeout' }), ms);
    Promise.resolve()
      .then(fn)                                                // ③ a sync throw becomes a rejection
      .then(() => finish({ status: 'up' }), (e) => finish({ status: 'down', error: e.message }));
  });
}
```

Run that for every probe with `Promise.all` and the checks happen **in parallel**: total time is the slowest probe, not the sum.

%% explain
- **One promise per probe**, racing the probe against a timer.
- **`Promise.all`** over all probes, then build the map and the overall status.
- **Clear timers** and ignore late results.

%% nudge
- What does a probe that never settles produce?
- Why `Promise.resolve().then(fn)` rather than `fn()`?

%% starter
```js
export function createHealth({ timeoutMs }) {
  const probes = [];
  const health = {
    register(name, probe, { critical = true } = {}) {
      probes.push({ name, probe, critical });
      return health;
    },
    async check() {
      return { status: 'up', checks: {} };
    },
  };
  return health;
}
```

%% tests
```js
describe('createHealth', () => {
  it('is up with no probes', async () => {
    jest.useFakeTimers();
    expect(await createHealth({ timeoutMs: 100 }).check()).toEqual({ status: 'up', checks: {} });
  });
  it('reports passing probes as up, sync or async', async () => {
    jest.useFakeTimers();
    const h = createHealth({ timeoutMs: 100 }).register('a', () => 1).register('b', async () => 'ok');
    expect(await h.check()).toEqual({ status: 'up', checks: { a: { status: 'up' }, b: { status: 'up' } } });
  });
  it('reports failing probes as down with the message', async () => {
    jest.useFakeTimers();
    const h = createHealth({ timeoutMs: 100 })
      .register('db', async () => { throw new Error('refused'); })
      .register('sync', () => { throw new Error('sync boom'); })
      .register('odd', () => Promise.reject('plain text'));
    const result = await h.check();
    expect(result.status).toBe('down');
    expect(result.checks.db).toEqual({ status: 'down', error: 'refused' });
    expect(result.checks.sync).toEqual({ status: 'down', error: 'sync boom' });
    expect(result.checks.odd).toEqual({ status: 'down', error: 'plain text' });
  });
  it('is degraded when only an optional probe fails', async () => {
    jest.useFakeTimers();
    const h = createHealth({ timeoutMs: 100 })
      .register('db', async () => {})
      .register('cache', async () => { throw new Error('cold'); }, { critical: false });
    const result = await h.check();
    expect(result.status).toBe('degraded');
    expect(result.checks.cache.status).toBe('down');
    expect(result.checks.db.status).toBe('up');
  });
  it('is down when a critical probe fails even if an optional one also fails', async () => {
    jest.useFakeTimers();
    const h = createHealth({ timeoutMs: 100 })
      .register('db', async () => { throw new Error('x'); })
      .register('cache', async () => { throw new Error('y'); }, { critical: false });
    expect((await h.check()).status).toBe('down');
  });
  it('marks a hanging probe as a timeout', async () => {
    jest.useFakeTimers();
    const h = createHealth({ timeoutMs: 500 }).register('hung', () => new Promise(() => {}));
    const pending = h.check();
    await jest.advanceTimersByTimeAsync(499);
    let done = false;
    pending.then(() => { done = true; });
    await Promise.resolve();
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ status: 'down', checks: { hung: { status: 'down', error: 'timeout' } } });
  });
  it('runs probes in parallel', async () => {
    jest.useFakeTimers();
    const wait = (ms) => () => new Promise((resolve) => setTimeout(resolve, ms));
    const h = createHealth({ timeoutMs: 1000 }).register('a', wait(300)).register('b', wait(300)).register('c', wait(300));
    const pending = h.check();
    await jest.advanceTimersByTimeAsync(300);
    expect((await pending).status).toBe('up');
  });
  it('lets a slow probe finish within the timeout', async () => {
    jest.useFakeTimers();
    const h = createHealth({ timeoutMs: 500 }).register('slow', () => new Promise((resolve) => setTimeout(resolve, 400)));
    const pending = h.check();
    await jest.advanceTimersByTimeAsync(400);
    expect((await pending).checks.slow).toEqual({ status: 'up' });
    await jest.advanceTimersByTimeAsync(1000);
  });
  it('ignores a probe that finishes after its timeout', async () => {
    jest.useFakeTimers();
    const h = createHealth({ timeoutMs: 100 }).register('late', () => new Promise((resolve) => setTimeout(resolve, 300)));
    const pending = h.check();
    await jest.advanceTimersByTimeAsync(100);
    const result = await pending;
    await jest.advanceTimersByTimeAsync(500);
    expect(result.checks.late).toEqual({ status: 'down', error: 'timeout' });
  });
  it('can be checked repeatedly', async () => {
    jest.useFakeTimers();
    let fail = true;
    const h = createHealth({ timeoutMs: 100 }).register('flaky', async () => { if (fail) throw new Error('x'); });
    expect((await h.check()).status).toBe('down');
    fail = false;
    expect((await h.check()).status).toBe('up');
  });
});
```

%% hints
- `const run = ({ probe }) => new Promise((resolve) => { ... })` with a `finished` flag and `clearTimeout(timer)` in `finish`.
- `const results = await Promise.all(probes.map(run));`
- Build `checks` from names and results, then compute the status: critical down → `'down'`, any down → `'degraded'`, else `'up'`.
- Error text: `error && error.message ? error.message : String(error)`.

%% solution
```js
export function createHealth({ timeoutMs }) {
  const probes = [];

  const run = ({ probe }) =>
    new Promise((resolve) => {
      let finished = false;
      let timer;
      const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(result);
      };
      timer = setTimeout(() => finish({ status: 'down', error: 'timeout' }), timeoutMs);
      Promise.resolve()
        .then(probe)
        .then(
          () => finish({ status: 'up' }),
          (error) => finish({ status: 'down', error: error && error.message ? error.message : String(error) }),
        );
    });

  const health = {
    register(name, probe, { critical = true } = {}) {
      probes.push({ name, probe, critical });
      return health;
    },
    async check() {
      const results = await Promise.all(probes.map(run));
      const checks = {};
      probes.forEach((p, i) => { checks[p.name] = results[i]; });
      let status = 'up';
      probes.forEach((p, i) => {
        if (results[i].status === 'down') {
          if (p.critical) status = 'down';
          else if (status === 'up') status = 'degraded';
        }
      });
      return { status, checks };
    },
  };
  return health;
}
```

%% exercise nod-breaker | A circuit breaker | 4 | js | js | CircuitOpenError, createCircuitBreaker | 40
`CircuitOpenError` is an `Error` subclass with message `'circuit open'`.

`createCircuitBreaker({ failureThreshold = 3, resetMs = 1000, now })` returns `{ exec(fn), state() }`:

- `exec(fn)` (async) returns the result of `await fn()` and rethrows its errors. `fn` is called **synchronously** inside `exec` when the call is allowed.
- **Closed**: calls pass through. A failure counts; **consecutive** failures reaching `failureThreshold` **open** the circuit (recording `openedAt = now()`). A success resets the count to `0`.
- **Open** (`now() - openedAt < resetMs`): `exec` rejects with `CircuitOpenError` **without calling `fn`**.
- **Half-open** (`now() - openedAt >= resetMs`): exactly **one trial** call is allowed at a time; any other `exec` made while the trial is running rejects with `CircuitOpenError`. If the trial **succeeds** the circuit **closes** (count reset). If it **fails** the circuit **opens again** with a **fresh** `openedAt`, and the error is rethrown.
- `state()` returns `'closed'`, `'open'` or `'half-open'` (computed from the clock, so it flips to `'half-open'` exactly when `resetMs` has elapsed).

```js
const breaker = createCircuitBreaker({ failureThreshold: 2, resetMs: 1000, now: () => t });
await breaker.exec(failing).catch(() => {});
await breaker.exec(failing).catch(() => {});
breaker.state(); // 'open'
```

%% worked
**A similar problem, solved: `createCooldownGate({ cooldownMs, now })`** — a gate whose state is **computed from a timestamp**, not stored.

```js
function createCooldownGate({ cooldownMs, now }) {
  let blockedAt = null;
  const state = () => {
    if (blockedAt === null) return 'open';
    return now() - blockedAt >= cooldownMs ? 'open' : 'blocked';   // ① derive the state from the clock
  };
  return {
    state,
    block() { blockedAt = now(); },
    allow() { return state() === 'open'; },
  };
}
```

Deriving the state from `openedAt` and the clock means there is **no timer to manage** and tests just move a fake clock. Your breaker adds a **failure count** and a **`trial` flag** that is `true` while the single half-open call is in flight.

%% explain
- **State** = `failures`, `openedAt`, `trial`; `state()` derives the label.
- **Before the call**: refuse when open, or half-open with a trial running; mark the trial.
- **After the call**: success resets; failure counts and may (re)open.

%% nudge
- How does the breaker know it is half-open without a timer?
- What must happen to the `trial` flag whether the trial succeeds or fails?

%% starter
```js
export class CircuitOpenError extends Error {
  constructor() {
    super('circuit open');
    this.name = 'CircuitOpenError';
  }
}

export function createCircuitBreaker({ failureThreshold = 3, resetMs = 1000, now }) {
  return {
    state() {
      return 'closed';
    },
    async exec(fn) {
      return fn();
    },
  };
}
```

%% tests
```js
describe('createCircuitBreaker', () => {
  const setup = (opts = {}) => {
    let t = 0;
    const breaker = createCircuitBreaker({ failureThreshold: 3, resetMs: 1000, now: () => t, ...opts });
    const fail = jest.fn(async () => { throw new Error('boom'); });
    const ok = jest.fn(async () => 'ok');
    const trip = async () => { for (let i = 0; i < 3; i++) await breaker.exec(fail).catch(() => {}); };
    return { breaker, fail, ok, trip, at: (x) => { t = x; } };
  };

  it('passes results and errors through while closed', async () => {
    const { breaker, ok, fail } = setup();
    expect(await breaker.exec(ok)).toBe('ok');
    await expect(breaker.exec(fail)).rejects.toThrow('boom');
    expect(breaker.state()).toBe('closed');
  });
  it('calls fn synchronously', () => {
    const { breaker, ok } = setup();
    breaker.exec(ok);
    expect(ok).toHaveBeenCalledTimes(1);
  });
  it('opens after the threshold of consecutive failures', async () => {
    const { breaker, fail } = setup();
    await breaker.exec(fail).catch(() => {});
    await breaker.exec(fail).catch(() => {});
    expect(breaker.state()).toBe('closed');
    await breaker.exec(fail).catch(() => {});
    expect(breaker.state()).toBe('open');
  });
  it('resets the failure count after a success', async () => {
    const { breaker, fail, ok } = setup();
    await breaker.exec(fail).catch(() => {});
    await breaker.exec(fail).catch(() => {});
    await breaker.exec(ok);
    await breaker.exec(fail).catch(() => {});
    await breaker.exec(fail).catch(() => {});
    expect(breaker.state()).toBe('closed');
  });
  it('rejects fast without calling fn while open', async () => {
    const { breaker, fail, ok, trip } = setup();
    await trip();
    fail.mockClear();
    await expect(breaker.exec(ok)).rejects.toBeInstanceOf(CircuitOpenError);
    await expect(breaker.exec(fail)).rejects.toThrow('circuit open');
    expect(ok).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
  });
  it('becomes half-open exactly when resetMs has elapsed', async () => {
    const { breaker, trip, at } = setup();
    at(500);
    await trip();
    at(1499);
    expect(breaker.state()).toBe('open');
    at(1500);
    expect(breaker.state()).toBe('half-open');
  });
  it('closes after a successful trial', async () => {
    const { breaker, ok, fail, trip, at } = setup();
    await trip();
    at(1000);
    expect(await breaker.exec(ok)).toBe('ok');
    expect(breaker.state()).toBe('closed');
    await breaker.exec(fail).catch(() => {});
    await breaker.exec(fail).catch(() => {});
    expect(breaker.state()).toBe('closed');
  });
  it('re-opens with a fresh timer after a failed trial', async () => {
    const { breaker, fail, trip, at } = setup();
    await trip();
    at(1000);
    await expect(breaker.exec(fail)).rejects.toThrow('boom');
    expect(breaker.state()).toBe('open');
    at(1999);
    expect(breaker.state()).toBe('open');
    at(2000);
    expect(breaker.state()).toBe('half-open');
  });
  it('allows only one trial at a time', async () => {
    const { breaker, ok, trip, at } = setup();
    await trip();
    at(1000);
    let release;
    const slow = jest.fn(() => new Promise((resolve) => { release = resolve; }));
    const trial = breaker.exec(slow);
    await expect(breaker.exec(ok)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(ok).not.toHaveBeenCalled();
    release('done');
    expect(await trial).toBe('done');
    expect(breaker.state()).toBe('closed');
    expect(await breaker.exec(ok)).toBe('ok');
  });
  it('allows a new trial after a failed one', async () => {
    const { breaker, ok, fail, trip, at } = setup();
    await trip();
    at(1000);
    await breaker.exec(fail).catch(() => {});
    at(2000);
    expect(await breaker.exec(ok)).toBe('ok');
    expect(breaker.state()).toBe('closed');
  });
  it('honours custom thresholds', async () => {
    const { breaker, fail } = setup({ failureThreshold: 1 });
    await breaker.exec(fail).catch(() => {});
    expect(breaker.state()).toBe('open');
  });
});
```

%% hints
- `const state = () => openedAt === null ? 'closed' : now() - openedAt >= resetMs ? 'half-open' : 'open';`
- Before: `const s = state(); if (s === 'open' || (s === 'half-open' && trial)) throw new CircuitOpenError(); if (s === 'half-open') trial = true;`
- Success: `failures = 0; openedAt = null; trial = false;`
- Failure: `trial = false; failures++; if (s === 'half-open' || failures >= failureThreshold) openedAt = now();` then rethrow.

%% solution
```js
export class CircuitOpenError extends Error {
  constructor() {
    super('circuit open');
    this.name = 'CircuitOpenError';
  }
}

export function createCircuitBreaker({ failureThreshold = 3, resetMs = 1000, now }) {
  let failures = 0;
  let openedAt = null;
  let trial = false;

  const state = () => {
    if (openedAt === null) return 'closed';
    return now() - openedAt >= resetMs ? 'half-open' : 'open';
  };

  return {
    state,
    async exec(fn) {
      const current = state();
      if (current === 'open' || (current === 'half-open' && trial)) throw new CircuitOpenError();
      if (current === 'half-open') trial = true;
      try {
        const result = await fn();
        failures = 0;
        openedAt = null;
        trial = false;
        return result;
      } catch (error) {
        trial = false;
        failures++;
        if (current === 'half-open' || failures >= failureThreshold) openedAt = now();
        throw error;
      }
    },
  };
}
```

%% exercise nod-check-breaker | Tests for a circuit breaker | 4 | js | js | checkCircuitBreaker | 42
`createCircuitBreaker({ failureThreshold, resetMs, now })` returns `{ exec(fn), state() }` as in the circuit breaker exercise (closed, open, half-open; one trial at a time; success closes; failure re-opens with a fresh timer; a success resets the failure count). You are given `checkCircuitBreaker(createCircuitBreaker, { CircuitOpenError })` (async). Write a check that passes for a correct breaker and **fails** for one that: **opens one failure too late**, **opens one failure too early**, **never resets the failure count after a success**, **runs the function while open**, **never becomes half-open**, **allows several trial calls at once**, **never closes after a successful trial**, **does not restart the timer after a failed trial**.

```js
let t = 0;
const breaker = createCircuitBreaker({ failureThreshold: 3, resetMs: 1000, now: () => t });
expect(breaker.state()).toBe('closed');
```

%% worked
**A similar problem, solved: `checkGate(createGate, { GateClosedError })`** — walk **every transition** of a state machine with a fake clock, asserting the state label at each step.

```js
export async function checkGate(createGate, { GateClosedError }) {  // createGate({ limit, now })
  let t = 0;
  const gate = createGate({ limit: 2, now: () => t });
  await gate.run(() => 1);
  expect(gate.state()).toBe('open');                       // ① after one use: still open
  await gate.run(() => 2);
  expect(gate.state()).toBe('closed');                     // ② at the limit: closed
  const spy = jest.fn();
  await expect(gate.run(spy)).rejects.toBeInstanceOf(GateClosedError);
  expect(spy).not.toHaveBeenCalled();                      // ③ closed means the function is NOT run
}
```

For a breaker the traps are all **boundaries**: the Nth failure (not N−1, not N+1), the tick when `resetMs` elapses, and the **second** concurrent call during a trial. A **spy** proves the function was not run, and the **state label** after each step proves the transition happened.

%% explain
- **Threshold**: after 2 failures still closed, after 3 open.
- **Success resets**: fail, fail, succeed, fail, fail is still closed.
- **Open**: rejects with `CircuitOpenError`, spy not called; `state()` flips at exactly `resetMs`.
- **Trial**: one at a time; success closes; failure restarts the timer.

%% nudge
- Which two checks tell "opens too early" from "opens too late"?
- How do you start a trial that does not finish, so you can try a second call?

%% starter
```js
export async function checkCircuitBreaker(createCircuitBreaker, { CircuitOpenError }) {
  let t = 0;
  const breaker = createCircuitBreaker({ failureThreshold: 3, resetMs: 1000, now: () => t });
  expect(breaker.state()).toBe('closed');
  // your assertions: threshold, reset, open, half-open, trial, close
}
```

%% tests
```js
const make = (f = {}) => ({ failureThreshold = 3, resetMs = 1000, now }) => {
  let failures = 0;
  let openedAt = null;
  let trial = false;
  const threshold = f.late ? failureThreshold + 1 : f.early ? failureThreshold - 1 : failureThreshold;
  const state = () => {
    if (openedAt === null) return 'closed';
    if (now() - openedAt >= resetMs) return f.noHalfOpen ? 'open' : 'half-open';
    return 'open';
  };
  return {
    state,
    async exec(fn) {
      const s = state();
      if (s === 'open') {
        if (f.callWhenOpen) { try { await fn(); } catch {} }
        throw new CircuitOpenError();
      }
      if (s === 'half-open' && trial && !f.manyTrials) throw new CircuitOpenError();
      if (s === 'half-open') trial = true;
      try {
        const result = await fn();
        if (!f.keepCount) failures = 0;
        if (!f.neverClose) openedAt = null;
        trial = false;
        return result;
      } catch (error) {
        trial = false;
        failures++;
        if (s === 'half-open') { if (!f.noRestart) openedAt = now(); }
        else if (failures >= threshold) openedAt = now();
        throw error;
      }
    },
  };
};

class CircuitOpenError extends Error {
  constructor() { super('circuit open'); this.name = 'CircuitOpenError'; }
}

const correct = make();
const mutants = {
  'opens one failure too late': make({ late: true }),
  'opens one failure too early': make({ early: true }),
  'never resets the failure count after a success': make({ keepCount: true }),
  'runs the function while open': make({ callWhenOpen: true }),
  'never becomes half-open': make({ noHalfOpen: true }),
  'allows several trial calls at once': make({ manyTrials: true }),
  'never closes after a successful trial': make({ neverClose: true }),
  'does not restart the timer after a failed trial': make({ noRestart: true }),
};

describe('your checkCircuitBreaker', () => {
  it('passes on a correct breaker', async () => {
    await checkCircuitBreaker(correct, { CircuitOpenError });
  });
  for (const [name, impl] of Object.entries(mutants)) {
    it(`catches a breaker that ${name}`, async () => {
      let caught = false;
      try { await checkCircuitBreaker(impl, { CircuitOpenError }); } catch { caught = true; }
      expect(caught).toBe(true);
    });
  }
});
```

%% hints
- `fail = jest.fn(async () => { throw new Error('boom'); })`, `ok = jest.fn(async () => 'ok')`, and a `t` variable for the clock.
- fail, fail, ok, fail, fail: still `'closed'` (kills "keeps the count" and "too early"); one more failure: `'open'` (kills "too late").
- While open: `await expect(breaker.exec(fail)).rejects.toBeInstanceOf(CircuitOpenError)` and the spy count does not grow.
- `t = 999` is `'open'`, `t = 1000` is `'half-open'`.
- A trial that hangs: `slow = jest.fn(() => new Promise((r) => { release = r; }))`; while it hangs, `exec(ok)` must reject.

%% solution
```js
export async function checkCircuitBreaker(createCircuitBreaker, { CircuitOpenError }) {
  let t = 0;
  const breaker = createCircuitBreaker({ failureThreshold: 3, resetMs: 1000, now: () => t });
  const fail = jest.fn(async () => { throw new Error('boom'); });
  const ok = jest.fn(async () => 'ok');
  const failOnce = () => breaker.exec(fail).catch(() => {});

  expect(breaker.state()).toBe('closed');
  expect(await breaker.exec(ok)).toBe('ok');

  await failOnce();
  await failOnce();
  expect(await breaker.exec(ok)).toBe('ok');
  await failOnce();
  await failOnce();
  expect(breaker.state()).toBe('closed');
  await failOnce();
  expect(breaker.state()).toBe('open');

  const callsBefore = fail.mock.calls.length;
  await expect(breaker.exec(fail)).rejects.toBeInstanceOf(CircuitOpenError);
  expect(fail.mock.calls.length).toBe(callsBefore);

  t = 999;
  expect(breaker.state()).toBe('open');
  t = 1000;
  expect(breaker.state()).toBe('half-open');

  let release;
  const slow = jest.fn(() => new Promise((resolve) => { release = resolve; }));
  const trial = breaker.exec(slow);
  await expect(breaker.exec(ok)).rejects.toBeInstanceOf(CircuitOpenError);
  release('done');
  expect(await trial).toBe('done');
  expect(breaker.state()).toBe('closed');

  await failOnce();
  await failOnce();
  await failOnce();
  expect(breaker.state()).toBe('open');
  t = 2000;
  expect(breaker.state()).toBe('half-open');
  await failOnce();
  expect(breaker.state()).toBe('open');
  t = 2999;
  expect(breaker.state()).toBe('open');
  t = 3000;
  expect(breaker.state()).toBe('half-open');
}
```
