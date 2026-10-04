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

export const nodeFigures: Record<string, FigureBuilder> = {
  'nd-di': diFigure,
  'nd-modules': modulesFigure,
  'nd-scopes': scopesFigure,
};
