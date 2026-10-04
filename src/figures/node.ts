import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 1 · Modules, providers and dependency injection ───────────────────────── */

const diFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Dependency injection. A controller needs a service, the service needs a repository, and the repository needs a database pool. Instead of each class creating what it needs, a container builds the chain from the bottom up: the pool first, then the repository, then the service, then the controller, handing each one its dependencies.');
  const chain: [string, string][] = [['UserController', 'needs UserService'], ['UserService', 'needs UserRepo'], ['UserRepo', 'needs DbPool'], ['DbPool', 'needs config']];
  chain.forEach(([t, sub], i) => {
    const x = 12 + i * 158;
    f.box(x, 26, 146, 66, { tone: i === 0 ? 'info' : 'muted' });
    f.text(x + 73, 52, t, { anchor: 'middle', size: 12, bold: true, mono: true });
    f.text(x + 73, 74, sub, { anchor: 'middle', size: 10.5 });
    if (i < 3) f.path(`M${x + 148} 59 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(x + 53, 112, 40, 30, { tone: 'accent', solid: true, label: String(4 - i), size: 14 });
  });
  f.text(W / 2, 168, 'the container builds the chain from the bottom up (4, 3, 2, 1)', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 196, 'Each class only declares WHAT it needs, never HOW to create it.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 232, 'Tests swap a real provider for a fake with one line, and nothing else changes.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const modulesFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Modules and visibility. Config module provides a config service and exports it. Database module imports the config module, so it can use the config service, and exports its own database service. Users module imports the database module, so it can use the database service, but it cannot use the config service because the database module did not re-export it. Providers that are not exported stay private to their module.');
  const mod = (x: number, y: number, name: string, provides: string, exp: string, tone: Tone) => {
    f.box(x, y, 190, 110, { tone });
    f.text(x + 95, y + 24, name, { anchor: 'middle', size: 13, bold: true, mono: true });
    f.text(x + 95, y + 52, 'provides ' + provides, { anchor: 'middle', size: 11 });
    f.box(x + 30, y + 70, 130, 28, { tone: 'pass', solid: true, label: exp, size: 11 });
  };
  mod(12, 24, 'ConfigModule', 'Config', 'exports Config', 'info');
  mod(225, 24, 'DbModule', 'Db', 'exports Db', 'info');
  mod(438, 24, 'UsersModule', 'Users', 'exports Users', 'info');
  f.path('M225 79 H204', { arrow: true, tone: 'accent', width: 2 });
  f.path('M438 79 H417', { arrow: true, tone: 'accent', width: 2 });
  f.text(W / 2, 156, '← arrows show imports', { anchor: 'middle', size: 11, tone: 'accent' });
  f.text(W / 2, 176, 'Db can inject Config. Users can inject Db.', { anchor: 'middle', size: 12.5, bold: true, tone: 'pass' });
  f.text(W / 2, 202, 'Users cannot inject Config: Db did not re-export it. That is the point of modules.', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  f.text(W / 2, 236, 'Not exported means private: other modules cannot reach it, even by accident.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 262, 'A module may re-export something it imports.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const scopesFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Provider scopes over three requests. A singleton provider is created once and shared by every request. A transient provider is created fresh each time it is injected. A request scoped provider is created once per request and shared inside that request only.');
  const lanes: [string, string[], Tone][] = [
    ['singleton', ['A', 'A', 'A'], 'pass'],
    ['request', ['B1', 'B2', 'B3'], 'info'],
    ['transient', ['C1 C2', 'C3 C4', 'C5 C6'], 'accent'],
  ];
  f.text(190, 22, 'request 1', { anchor: 'middle', size: 11, tone: 'muted' });
  f.text(370, 22, 'request 2', { anchor: 'middle', size: 11, tone: 'muted' });
  f.text(550, 22, 'request 3', { anchor: 'middle', size: 11, tone: 'muted' });
  lanes.forEach(([name, items, tone], row) => {
    const y = 34 + row * 62;
    f.text(16, y + 24, name, { size: 12, bold: true, mono: true });
    items.forEach((it, i) => f.box(190 + i * 180 - 48, y + 4, 96, 40, { tone, solid: true, label: it, mono: true, size: 12 }));
  });
  f.text(W / 2, 238, 'Singleton: cheap and shared, so it must hold no per-request data.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 260, 'Request scope costs a new instance per request, and everything that depends on it too.', { anchor: 'middle', size: 11.5, tone: 'muted' });
  return f;
};

/* ───────────────────────── 2 · The request lifecycle ───────────────────────── */

const lifecycleFigure: FigureBuilder = () => {
  const f = new Fig(W, 300, 'The request lifecycle. A request passes through middleware, then guards, then the before part of interceptors, then pipes, and reaches the handler. The response travels back through the after part of the interceptors and then the middleware. If anything throws, exception filters turn the error into a response.');
  const steps: [string, string, Tone][] = [
    ['1 middleware', 'logging, parsing, ids', 'info'],
    ['2 guards', 'may this request continue?', 'accent'],
    ['3 interceptors', 'before: timing, cache', 'info'],
    ['4 pipes', 'transform + validate input', 'accent'],
    ['5 handler', 'the actual work', 'pass'],
  ];
  steps.forEach(([t, sub, tone], i) => {
    const x = 8 + i * 126;
    f.box(x, 30, 118, 86, { tone, solid: i === 4 });
    f.text(x + 59, 58, t, { anchor: 'middle', size: 11.5, bold: true });
    f.text(x + 59, 84, sub.slice(0, 18), { anchor: 'middle', size: 9.5 });
    f.text(x + 59, 98, sub.slice(18), { anchor: 'middle', size: 9.5 });
    if (i < 4) f.path(`M${x + 119} 73 H${x + 125}`, { arrow: true, tone: 'muted', width: 1.4 });
  });
  f.path('M570 118 V150 H60 V120', { arrow: true, tone: 'pass', width: 1.8 });
  f.text(315, 142, 'response: interceptors (after), then middleware', { anchor: 'middle', size: 11.5, tone: 'pass' });
  f.box(130, 176, 380, 44, { tone: 'fail', solid: true, label: 'any error → exception filter → { status, body }', size: 12 });
  f.text(W / 2, 252, 'Remember it as: M G I P H  (middleware, guards, interceptors, pipes, handler).', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 278, 'Guards say yes or no. Pipes reshape data. Interceptors wrap the whole call.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const interceptorOnion: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Interceptors wrap the handler like layers of an onion. Each interceptor runs code before calling next, which runs the inner layers and the handler, and then runs code after next returns, in the reverse order. An interceptor can change the result, time the call, return a cached value without calling next at all, or catch the error.');
  f.box(16, 16, 608, 190, { tone: 'info' });
  f.text(32, 38, 'timing interceptor', { size: 12.5, bold: true, tone: 'info' });
  f.box(96, 50, 448, 140, { tone: 'accent' });
  f.text(112, 72, 'cache interceptor', { size: 12.5, bold: true, tone: 'accent' });
  f.box(176, 84, 288, 90, { tone: 'pass', solid: true });
  f.text(320, 118, 'pipes → handler', { anchor: 'middle', size: 14, bold: true });
  f.text(320, 142, 'produces the result', { anchor: 'middle', size: 11.5 });
  f.text(560, 38, 'before →', { anchor: 'end', size: 11, mono: true, tone: 'info' });
  f.text(528, 72, 'before →', { anchor: 'end', size: 11, mono: true, tone: 'accent' });
  f.text(452, 166, '← after', { anchor: 'end', size: 11, mono: true, tone: 'accent' });
  f.text(600, 194, '← after', { anchor: 'end', size: 11, mono: true, tone: 'info' });
  f.text(W / 2, 234, 'Before runs in registration order; after runs in reverse. Not calling next skips the rest.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const errorFlowFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'How errors become responses. A guard denial, a pipe validation failure, a handler error or a middleware error is thrown as an exception. Exception filters pick the first one that matches the error type and build the response. Known HTTP errors keep their status and message. Unknown errors become a generic five hundred response, and the real message is logged, never sent to the client.');
  const thrown: [string, Tone][] = [['guard denies', 'fail'], ['pipe rejects input', 'fail'], ['handler throws', 'fail'], ['middleware throws', 'fail']];
  thrown.forEach(([t, tone], i) => {
    f.box(12, 20 + i * 52, 150, 40, { tone, label: t, size: 11.5 });
    f.path(`M164 ${40 + i * 52} L230 120`, { arrow: true, tone: 'muted', width: 1.4 });
  });
  f.box(232, 80, 170, 80, { tone: 'accent', solid: true });
  f.text(317, 108, 'exception filters', { anchor: 'middle', size: 13, bold: true });
  f.text(317, 132, 'first match wins', { anchor: 'middle', size: 11.5 });
  f.path('M404 120 L470 80', { arrow: true, tone: 'pass', width: 1.6 });
  f.path('M404 120 L470 160', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(472, 56, 156, 48, { tone: 'pass', label: 'HttpError → its status', size: 11 });
  f.box(472, 136, 156, 48, { tone: 'muted', label: 'unknown → 500 generic', size: 11 });
  f.text(W / 2, 226, 'Log the details, send a generic message.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 252, 'One place maps errors to responses, so handlers can simply throw.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 3 · DTOs, validation and serialization ───────────────────────── */

const dtoFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Input becomes a trusted object in four steps. Raw request data from the client goes through whitelisting, which drops unknown fields, then coercion, which turns strings into numbers or booleans where allowed, then validation of every rule. If any rule fails the request is rejected with a four hundred error listing every problem. Otherwise the handler receives a clean, typed data transfer object.');
  f.box(12, 20, 120, 52, { tone: 'fail', label: 'raw JSON', size: 12, mono: true });
  const steps: [string, string][] = [['1 whitelist', 'drop extras'], ['2 coerce', '"5" → 5'], ['3 validate', 'every rule']];
  steps.forEach(([t, sub], i) => {
    const x = 160 + i * 150;
    f.box(x, 20, 126, 52, { tone: 'accent' });
    f.text(x + 63, 42, t, { anchor: 'middle', size: 12, bold: true });
    f.text(x + 63, 60, sub, { anchor: 'middle', size: 10.5 });
    f.path(`M${x - 26} 46 H${x - 2}`, { arrow: true, tone: 'muted', width: 1.6 });
  });
  f.box(540, 108, 88, 52, { tone: 'pass', solid: true, label: 'DTO', size: 13, mono: true });
  f.path('M541 72 L580 106', { arrow: true, tone: 'pass', width: 1.6 });
  f.box(260, 108, 150, 52, { tone: 'fail', label: '400 + every error', size: 11.5 });
  f.path('M370 74 L340 106', { arrow: true, tone: 'fail', width: 1.6 });
  f.text(W / 2, 200, 'The handler only ever sees the DTO: known fields, right types, valid values.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 228, 'Whitelisting also stops mass assignment: { "role": "admin" } is dropped.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 254, 'Report all errors at once so the client fixes the form in one go.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const serializeFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Serialization controls what leaves the server. A user entity from the database has an id, a name, an email, a password hash and a role. The serializer removes the password hash always, and shows the email only to the admin or the user themselves. A public viewer gets only id and name. An admin gets id, name, email and role.');
  f.box(12, 24, 170, 132, { tone: 'muted' });
  f.text(97, 46, 'User entity', { anchor: 'middle', size: 12.5, bold: true });
  ['id', 'name', 'email', 'passwordHash', 'role'].forEach((k, i) => f.text(32, 68 + i * 17, k, { size: 11.5, mono: true, tone: k === 'passwordHash' ? 'fail' : undefined }));
  f.path('M184 90 H236', { arrow: true, tone: 'muted', width: 1.8 });
  f.box(238, 62, 130, 56, { tone: 'accent', solid: true });
  f.text(303, 86, 'serializer', { anchor: 'middle', size: 13, bold: true });
  f.text(303, 104, 'exclude · groups', { anchor: 'middle', size: 10.5 });
  f.path('M370 80 L424 56', { arrow: true, tone: 'pass', width: 1.6 });
  f.path('M370 100 L424 126', { arrow: true, tone: 'info', width: 1.6 });
  f.box(426, 30, 200, 48, { tone: 'pass', label: 'public: id, name', size: 11.5 });
  f.box(426, 104, 200, 48, { tone: 'info', label: 'admin: id, name, email, role', size: 11 });
  f.text(W / 2, 190, 'passwordHash never leaves, for any audience.', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  f.text(W / 2, 218, 'Decide what to SHOW per audience, not what to hide by hand in each handler.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 246, 'Apply it at one choke point (an interceptor) so a new field is private by default.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const paginationFigure: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Offset pagination. Twelve rows are split into pages of four. With page three and limit four, the offset is eight, so the query skips eight rows and returns rows nine to twelve. The page number is clamped to at least one and the limit is clamped between one and a maximum.');
  for (let i = 0; i < 12; i++) {
    const pg = Math.floor(i / 4);
    f.box(16 + i * 51, 54, 46, 40, { tone: pg === 2 ? 'pass' : 'muted', solid: pg === 2, label: String(i + 1), size: 12, mono: true });
  }
  ['page 1', 'page 2', 'page 3'].forEach((t, i) => f.text(16 + i * 204 + 98, 38, t, { anchor: 'middle', size: 11.5, bold: true, tone: i === 2 ? 'pass' : 'muted' }));
  f.text(W / 2, 134, '?page=3&limit=4   →   offset = (page − 1) × limit = 8', { anchor: 'middle', size: 13, bold: true, mono: true });
  f.text(W / 2, 166, 'Never trust the numbers: page ≥ 1, 1 ≤ limit ≤ max, junk falls back to defaults.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 194, 'Return the metadata too: total, totalPages, hasNext, hasPrev.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 222, 'Only sort by fields on an allow-list; never put raw input in an ORDER BY.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 4 · Auth, guards and throttling ───────────────────────── */

const rotationFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Refresh token rotation with reuse detection. Login returns an access token A1 and a refresh token R1. Refreshing with R1 returns A2 and R2 and marks R1 as used. If an attacker later replays the used R1, the server knows the token family is compromised and revokes the whole family, so A2 and R2 stop working too and the user must log in again.');
  const steps: [string, string, Tone][] = [
    ['1 login', 'A1 · R1', 'pass'],
    ['2 refresh with R1', 'A2 · R2, R1 used', 'info'],
    ['3 replay of R1', 'already used!', 'fail'],
    ['4 family revoked', 'A2, R2 die too', 'fail'],
  ];
  steps.forEach(([t, sub, tone], i) => {
    const x = 8 + i * 158;
    f.box(x, 30, 142, 70, { tone, solid: i === 3 });
    f.text(x + 71, 58, t, { anchor: 'middle', size: 11.5, bold: true });
    f.text(x + 71, 82, sub, { anchor: 'middle', size: 10.5 });
    if (i < 3) f.path(`M${x + 144} 65 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.6 });
  });
  f.text(W / 2, 148, 'A refresh token works exactly ONCE. Each use hands out a new pair.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 178, 'Two clients holding the same refresh token means one of them stole it.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 206, 'Revoke the whole family: the honest user logs in again, the thief is out.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 236, 'Access tokens stay short-lived (minutes); refresh tokens live longer (days).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const guardDecisionFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A metadata driven guard. The handler is tagged with metadata such as public, allowed roles or an owner parameter. The guard reads that metadata and decides. Public routes are allowed. With no user the answer is not authenticated. Otherwise a matching role allows the request, or the owner of the resource is allowed, or any signed in user if no restriction is set, and everything else is forbidden.');
  const steps: [string, string, string][] = [
    ['public?', 'yes → allow', 'pass'],
    ['signed in?', 'no → 401', 'fail'],
    ['role match?', 'yes → allow', 'pass'],
    ['owner?', 'yes → allow', 'pass'],
  ];
  steps.forEach(([t, sub, tone], i) => {
    const x = 8 + i * 158;
    f.box(x, 30, 142, 56, { tone: 'accent', label: t, size: 12.5 });
    f.text(x + 71, 114, sub, { anchor: 'middle', size: 11.5, bold: true, tone: tone as Tone });
    if (i < 3) f.path(`M${x + 144} 58 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.6 });
  });
  f.box(246, 138, 148, 44, { tone: 'fail', solid: true, label: 'otherwise 403', size: 12 });
  f.text(W / 2, 214, '401 = who are you?   403 = I know you, and the answer is no.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 242, 'Routes carry their own rules as metadata; the guard stays generic.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const windowFigure: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A sliding window rate limiter with a limit of three requests per window. Timestamps of recent requests are remembered. Old ones fall out of the window as time passes. Three requests are inside the current window, so the fourth is denied until the oldest one leaves the window.');
  f.path('M24 116 H616', { tone: 'muted', width: 1.6, arrow: true });
  f.box(220, 56, 340, 108, { tone: 'info' });
  f.text(390, 80, 'window = the last 1000 ms', { anchor: 'middle', size: 12, bold: true, tone: 'info' });
  f.box(112, 108, 16, 16, { tone: 'muted', solid: true });
  f.text(120, 146, 'expired', { anchor: 'middle', size: 10.5, tone: 'muted' });
  [260, 350, 440].forEach((x) => f.box(x - 8, 108, 16, 16, { tone: 'pass', solid: true }));
  f.box(512, 108, 16, 16, { tone: 'fail', solid: true });
  f.text(520, 148, 'denied', { anchor: 'middle', size: 10.5, tone: 'fail' });
  f.text(W / 2, 198, 'limit 3: the 4th request in the window is refused.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 226, 'Retry after = oldest timestamp + window − now.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

/* ───────────────────────── 5 · HTTP and REST ───────────────────────── */

const statusFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'HTTP status code families. Two hundred codes mean success: 200 OK, 201 Created, 204 No Content. Three hundred codes mean redirect or not modified, such as 301 and 304. Four hundred codes mean the client made a mistake: 400 bad request, 401 not authenticated, 403 forbidden, 404 not found, 409 conflict, 422 unprocessable, 429 too many requests. Five hundred codes mean the server failed: 500, 502, 503.');
  const cols: [string, string, string[], Tone][] = [
    ['2xx', 'it worked', ['200 OK', '201 Created', '204 No Content'], 'pass'],
    ['3xx', 'look elsewhere', ['301 Moved', '304 Not Modified'], 'info'],
    ['4xx', 'you got it wrong', ['400 · 401 · 403', '404 · 409 · 422', '429 Too Many'], 'accent'],
    ['5xx', 'we got it wrong', ['500 Server Error', '502 Bad Gateway', '503 Unavailable'], 'fail'],
  ];
  cols.forEach(([code, sub, items, tone], i) => {
    const x = 8 + i * 158;
    f.box(x, 20, 142, 150, { tone });
    f.text(x + 71, 50, code, { anchor: 'middle', size: 20, bold: true, mono: true });
    f.text(x + 71, 72, sub, { anchor: 'middle', size: 11, tone: 'muted' });
    items.forEach((t, j) => f.text(x + 71, 100 + j * 22, t, { anchor: 'middle', size: 11, mono: true }));
  });
  f.text(W / 2, 204, 'Pick the code that tells the client what to DO next: retry, fix input, log in, or give up.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 232, '401 vs 403, 400 vs 422, 404 vs 410: the details are the interview.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const conditionalFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Conditional requests. A first GET returns the resource with an ETag header that identifies this version. A later GET with If-None-Match set to that ETag returns 304 Not Modified with no body, saving bandwidth. A PUT with If-Match set to the ETag is only applied if the resource has not changed meanwhile; otherwise the server answers 412 Precondition Failed, which prevents lost updates.');
  const rows: [string, string, Tone][] = [
    ['GET /post/1', '200 + ETag: "v1"', 'pass'],
    ['GET /post/1  If-None-Match: "v1"', '304 Not Modified, no body', 'info'],
    ['PUT /post/1  If-Match: "v1"', '412 if it changed meanwhile', 'fail'],
  ];
  rows.forEach(([req, res, tone], i) => {
    const y = 20 + i * 70;
    f.box(8, y, 296, 50, { tone: 'muted', label: req, size: 11, mono: true });
    f.path(`M306 ${y + 25} H330`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(332, y, 296, 50, { tone, label: res, size: 11, mono: true });
  });
  f.text(W / 2, 244, 'ETag = a fingerprint of the current version. Same fingerprint, nothing to send.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 266, 'If-Match turns "last write wins" into "write only if nobody else did".', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const cursorFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Offset versus cursor pagination. With offset pagination, page two is the items at positions four to six. If a new item is inserted at the top between requests, everything shifts and item three appears again on page two. With cursor pagination the client asks for items after id three, so the answer is items four, five and six no matter what was inserted before.');
  const row = (y: number, label: string, items: string[], hi: number[], tone: Tone) => {
    f.text(16, y + 25, label, { size: 11.5, bold: true });
    items.forEach((t, i) => f.box(176 + i * 56, y, 48, 38, { tone: hi.includes(i) ? tone : 'muted', solid: hi.includes(i), label: t, size: 12, mono: true }));
  };
  row(20, 'before', ['1', '2', '3', '4', '5', '6', '7'], [3, 4, 5], 'info');
  row(88, 'after insert', ['N', '1', '2', '3', '4', '5', '6'], [3, 4, 5], 'fail');
  f.text(W / 2, 154, 'offset page 2 (skip 3): after the insert it shows 3 again, a duplicate.', { anchor: 'middle', size: 12, bold: true, tone: 'fail' });
  row(176, 'after id=3', ['3', '4', '5', '6', '7'], [1, 2, 3], 'pass');
  f.text(W / 2, 244, 'cursor "after id 3": always 4, 5, 6, however much was inserted before.', { anchor: 'middle', size: 12, bold: true, tone: 'pass' });
  f.text(W / 2, 270, 'Cursors are stable and fast on big tables; offsets are simple but drift.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 6 · Async, streams and shutdown ───────────────────────── */

const eventLoopFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The Node event loop. Each turn of the loop runs phases in order: timers, pending callbacks, poll for input and output, check for setImmediate callbacks, and close callbacks. Between every callback, the microtask queue is emptied completely: process.nextTick callbacks first, then promise callbacks. That is why a promise callback always runs before the next timer.');
  const phases: [string, string][] = [['timers', 'setTimeout'], ['pending', 'system errors'], ['poll', 'I/O callbacks'], ['check', 'setImmediate'], ['close', 'socket close']];
  phases.forEach(([t, sub], i) => {
    const x = 8 + i * 126;
    f.box(x, 24, 118, 66, { tone: i === 2 ? 'accent' : 'info', solid: i === 2 });
    f.text(x + 59, 50, t, { anchor: 'middle', size: 13, bold: true, mono: true });
    f.text(x + 59, 72, sub, { anchor: 'middle', size: 10.5 });
    if (i < 4) f.path(`M${x + 120} 57 H${x + 124}`, { arrow: true, tone: 'muted', width: 1.4 });
  });
  f.box(8, 112, 624, 44, { tone: 'pass', solid: true, label: 'between EVERY callback: nextTick queue, then promise microtasks, until empty', size: 12 });
  f.text(W / 2, 192, 'Promise callbacks (.then, await) beat timers: they run before the loop moves on.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 220, 'One long synchronous task blocks every phase: no timers, no I/O, no requests.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 246, 'Node is fast at waiting, slow at heavy CPU work on the main thread.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const backpressureFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Backpressure. A fast producer writes into a bounded queue that feeds a slow consumer. When the queue is full at its high water mark, the push call does not finish, so the producer waits. When the consumer takes an item, a slot opens and the producer continues. Memory use stays bounded.');
  f.box(8, 40, 110, 64, { tone: 'info', label: 'producer', size: 13, mono: true });
  f.path('M120 72 H142', { arrow: true, tone: 'muted', width: 1.8 });
  f.box(146, 24, 296, 96, { tone: 'accent' });
  f.text(294, 44, 'bounded queue (high water mark 4)', { anchor: 'middle', size: 11.5, bold: true });
  [0, 1, 2, 3].forEach((i) => f.box(162 + i * 68, 60, 56, 40, { tone: 'fail', solid: true, label: String(i + 1), size: 13, mono: true }));
  f.path('M444 72 H466', { arrow: true, tone: 'muted', width: 1.8 });
  f.box(470, 40, 110, 64, { tone: 'pass', label: 'consumer', size: 13, mono: true });
  f.text(W / 2, 158, 'Full queue: push() stays pending, so the producer is paused.', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  f.text(W / 2, 186, 'The consumer takes one: a slot opens, the producer resumes.', { anchor: 'middle', size: 12.5, bold: true, tone: 'pass' });
  f.text(W / 2, 220, 'Without a limit, a slow consumer makes memory grow until the process dies.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 246, 'Node streams call this the high water mark; async iterables get it for free.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const shutdownFigure: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Graceful shutdown. On a termination signal the process stops accepting new work, lets in flight requests finish, closes resources in reverse order of creation, and then exits. If it takes too long, a timeout forces the exit so the orchestrator is not left waiting.');
  const steps: [string, string][] = [['1 signal', 'SIGTERM'], ['2 stop', 'no new work'], ['3 drain', 'finish in-flight'], ['4 close', 'reverse order'], ['5 exit', 'code 0']];
  steps.forEach(([t, sub], i) => {
    const x = 8 + i * 126;
    f.box(x, 24, 118, 66, { tone: i === 4 ? 'pass' : 'info', solid: i === 4 });
    f.text(x + 59, 50, t, { anchor: 'middle', size: 12.5, bold: true });
    f.text(x + 59, 72, sub, { anchor: 'middle', size: 10.5 });
    if (i < 4) f.path(`M${x + 120} 57 H${x + 124}`, { arrow: true, tone: 'muted', width: 1.4 });
  });
  f.box(130, 118, 380, 40, { tone: 'fail', label: 'too slow? timeout → force exit', size: 12 });
  f.text(W / 2, 192, 'Close in REVERSE order: the HTTP server before the database it uses.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 220, 'One failing closer must not stop the others from running.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 7 · Data access ───────────────────────── */

const nPlusOneFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'The N plus one problem. Loading ten posts and then fetching each author with its own query makes eleven queries: one for the posts and ten for authors. A batch loader collects the ten author ids requested in the same tick and fetches them with a single query, so the total is two queries.');
  f.text(160, 24, 'naive: 1 + N queries', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  f.box(16, 38, 288, 34, { tone: 'info', label: 'SELECT posts  (1 query)', size: 11.5, mono: true });
  for (let i = 0; i < 5; i++) f.box(16 + i * 58, 86, 52, 30, { tone: 'fail', label: 'user ' + (i + 1), size: 9.5, mono: true });
  f.text(160, 142, '… and 5 more: 11 round trips', { anchor: 'middle', size: 11.5, tone: 'fail' });
  f.text(480, 24, 'batched: 2 queries', { anchor: 'middle', size: 12.5, bold: true, tone: 'pass' });
  f.box(336, 38, 288, 34, { tone: 'info', label: 'SELECT posts  (1 query)', size: 11.5, mono: true });
  f.box(336, 86, 288, 30, { tone: 'pass', solid: true, label: 'WHERE id IN (1,2,3…)  (1 query)', size: 11, mono: true });
  f.text(480, 142, 'same data, 2 round trips', { anchor: 'middle', size: 11.5, tone: 'pass' });
  f.text(W / 2, 196, 'Collect the keys asked for in one tick, dedupe them, fetch once, hand each caller its own value.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 224, 'Each query costs a network round trip, so the count matters more than the SQL.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 252, 'This is what DataLoader does, and why GraphQL resolvers need it.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const transactionFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Transactions and savepoints. A transaction begins, runs several statements, and either commits them all or rolls them all back. A nested step inside it uses a savepoint, so if only the inner step fails the work can roll back to the savepoint and the outer transaction can still commit the rest.');
  f.box(8, 30, 90, 50, { tone: 'info', label: 'begin', size: 12, mono: true });
  f.path('M100 55 H116', { arrow: true, tone: 'muted', width: 1.6 });
  f.box(118, 20, 330, 150, { tone: 'accent' });
  f.text(283, 42, 'one atomic unit of work', { anchor: 'middle', size: 11.5, bold: true });
  f.box(134, 56, 120, 34, { tone: 'muted', label: 'debit A', size: 11, mono: true });
  f.box(270, 56, 120, 34, { tone: 'muted', label: 'credit B', size: 11, mono: true });
  f.box(134, 108, 256, 44, { tone: 'info', label: 'savepoint sp1: send email log', size: 11, mono: true });
  f.path('M450 70 L476 52', { arrow: true, tone: 'pass', width: 1.6 });
  f.path('M450 120 L476 140', { arrow: true, tone: 'fail', width: 1.6 });
  f.box(478, 30, 148, 44, { tone: 'pass', solid: true, label: 'commit: all or nothing', size: 10.5 });
  f.box(478, 118, 148, 44, { tone: 'fail', solid: true, label: 'rollback: undo all', size: 10.5 });
  f.text(W / 2, 206, 'Money moves in pairs: either both writes happen or neither does.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 234, 'A failed inner step rolls back to its savepoint; the outer work can carry on.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 260, 'Never let a rollback error hide the real error that caused it.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const optimisticFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Optimistic locking. Two users read a row at version one. The first saves, which succeeds and moves the row to version two. The second saves with the stale version one, so the update matches zero rows and is rejected as a conflict. The second user must reload the row, reapply the change, and try again.');
  const rows: [string, string, Tone][] = [
    ['A reads v1', 'B reads v1', 'muted'],
    ['A saves (expects v1)', 'ok, row is now v2', 'pass'],
    ['B saves (expects v1)', 'conflict: row is v2', 'fail'],
    ['B reloads v2, retries', 'ok, row is now v3', 'pass'],
  ];
  rows.forEach(([l, r, tone], i) => {
    const y = 16 + i * 52;
    f.box(8, y, 286, 40, { tone: 'muted', label: l, size: 11.5, mono: true });
    f.path(`M296 ${y + 20} H320`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(322, y, 306, 40, { tone, label: r, size: 11.5, mono: true });
  });
  f.text(W / 2, 244, 'UPDATE … SET …, version = version + 1 WHERE id = ? AND version = ?', { anchor: 'middle', size: 11.5, bold: true, mono: true });
  f.text(W / 2, 266, 'No locks held while the user thinks; conflicts are detected, not prevented.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 8 · Config, logging, health and resilience ───────────────────────── */

const configFigure: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Configuration flows one way. Environment variables, which are all strings, are read once at startup and validated against a spec: required keys, types, allowed values. If anything is wrong the process fails immediately and lists every problem. Otherwise the result is a frozen, typed config object that is passed to the parts that need it.');
  const steps: [string, string, Tone][] = [['env', 'strings only', 'muted'], ['validate', 'types, required', 'accent'], ['config', 'frozen + typed', 'pass'], ['services', 'receive it', 'info']];
  steps.forEach(([t, sub, tone], i) => {
    const x = 8 + i * 158;
    f.box(x, 24, 142, 62, { tone, solid: i === 2 });
    f.text(x + 71, 50, t, { anchor: 'middle', size: 13, bold: true, mono: true });
    f.text(x + 71, 70, sub, { anchor: 'middle', size: 10.5 });
    if (i < 3) f.path(`M${x + 144} 55 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.6 });
  });
  f.box(166, 106, 142, 44, { tone: 'fail', label: 'crash at boot', size: 12 });
  f.path('M237 88 V104', { arrow: true, tone: 'fail', width: 1.6 });
  f.text(W / 2, 186, 'Fail fast, list every problem at once, never at 3 a.m. on the first request.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 214, 'Parse once at the edge; the rest of the code never touches process.env.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const healthFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Liveness and readiness. A liveness probe says the process is alive and should not be restarted. A readiness probe runs every dependency check in parallel, for example the database as critical and the cache as optional, and reports up, degraded when only an optional dependency is down, or down when a critical one is down, which tells the load balancer to stop sending traffic.');
  f.box(8, 20, 200, 60, { tone: 'info' });
  f.text(108, 44, 'liveness', { anchor: 'middle', size: 13, bold: true, mono: true });
  f.text(108, 64, 'is the process alive?', { anchor: 'middle', size: 10.5 });
  f.box(232, 20, 396, 60, { tone: 'accent' });
  f.text(430, 44, 'readiness', { anchor: 'middle', size: 13, bold: true, mono: true });
  f.text(430, 64, 'can it serve traffic right now?', { anchor: 'middle', size: 10.5 });
  const probes: [string, string, Tone][] = [['db (critical)', 'up', 'pass'], ['cache (optional)', 'down', 'fail'], ['queue (critical)', 'up', 'pass']];
  probes.forEach(([name, st, tone], i) => {
    const x = 232 + i * 134;
    f.box(x, 100, 126, 44, { tone, label: name + ': ' + st, size: 9.5, mono: true });
  });
  f.box(280, 168, 300, 38, { tone: 'accent', solid: true, label: 'overall: degraded', size: 13 });
  f.text(108, 120, 'restart if it fails', { anchor: 'middle', size: 11, tone: 'muted' });
  f.text(W / 2, 238, 'Probes run in parallel with a timeout: a hung dependency must not hang the probe.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 262, 'critical down → down · only optional down → degraded · all up → up', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const breakerFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'A circuit breaker has three states. Closed lets calls through and counts consecutive failures. After the threshold it opens and rejects calls immediately without calling the failing service. After a reset time it becomes half open and lets one trial call through. If the trial succeeds the breaker closes; if it fails the breaker opens again and the timer restarts.');
  const st: [string, string, number, Tone][] = [['closed', 'calls pass through', 20, 'pass'], ['open', 'calls rejected fast', 245, 'fail'], ['half-open', 'one trial call', 470, 'accent']];
  st.forEach(([t, sub, x, tone]) => {
    f.box(x, 24, 150, 64, { tone, solid: true });
    f.text(x + 75, 50, t, { anchor: 'middle', size: 13, bold: true, mono: true });
    f.text(x + 75, 72, sub, { anchor: 'middle', size: 10.5 });
  });
  f.path('M172 46 H243', { arrow: true, tone: 'muted', width: 1.8 });
  f.path('M397 46 H468', { arrow: true, tone: 'muted', width: 1.8 });
  f.path('M468 68 H399', { arrow: true, tone: 'muted', width: 1.8 });
  f.path('M545 90 V120 H95 V92', { arrow: true, tone: 'pass', width: 1.8 });
  f.text(W / 2, 156, 'closed → open: N failures in a row   ·   open → half-open: after resetMs', { anchor: 'middle', size: 11.5, bold: true });
  f.text(W / 2, 180, 'half-open → closed: the trial succeeds   ·   half-open → open: the trial fails', { anchor: 'middle', size: 11.5, bold: true });
  f.text(W / 2, 218, 'Stop hammering a service that is already down; give it room to recover.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 246, 'Callers fail fast instead of waiting on a timeout for every request.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const nodeFigures: Record<string, FigureBuilder> = {
  'nd-di': diFigure,
  'nd-modules': modulesFigure,
  'nd-scopes': scopesFigure,
  'nd-lifecycle': lifecycleFigure,
  'nd-interceptors': interceptorOnion,
  'nd-errors': errorFlowFigure,
  'nd-dto': dtoFigure,
  'nd-serialize': serializeFigure,
  'nd-pagination': paginationFigure,
  'nd-rotation': rotationFigure,
  'nd-guard': guardDecisionFigure,
  'nd-window': windowFigure,
  'nd-status': statusFigure,
  'nd-conditional': conditionalFigure,
  'nd-cursor': cursorFigure,
  'nd-loop': eventLoopFigure,
  'nd-backpressure': backpressureFigure,
  'nd-shutdown': shutdownFigure,
  'nd-nplus1': nPlusOneFigure,
  'nd-transaction': transactionFigure,
  'nd-optimistic': optimisticFigure,
  'nd-config': configFigure,
  'nd-health': healthFigure,
  'nd-breaker': breakerFigure,
};
