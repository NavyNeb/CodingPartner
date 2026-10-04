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

export const nodeFigures: Record<string, FigureBuilder> = {
  'nd-di': diFigure,
  'nd-modules': modulesFigure,
  'nd-scopes': scopesFigure,
  'nd-lifecycle': lifecycleFigure,
  'nd-interceptors': interceptorOnion,
  'nd-errors': errorFlowFigure,
};
