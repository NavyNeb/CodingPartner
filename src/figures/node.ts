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
};
