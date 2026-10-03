import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 1 · Factories and builders ───────────────────────── */

const factoryFigure: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A factory. The caller asks for a shape by name and arguments, for example createShape circle with radius 2. The factory looks up the right constructor in its registry and returns a circle, rectangle or square object that all share the same area and perimeter methods. The caller never uses new or knows the concrete types.');
  f.box(16, 90, 190, 56, { tone: 'info', label: "createShape('circle', 2)", mono: true, size: 11 });
  f.text(111, 78, 'caller', { anchor: 'middle', size: 12, bold: true, tone: 'info' });
  f.path('M208 118 H262', { arrow: true, tone: 'accent', width: 2 });
  f.box(266, 50, 140, 136, { tone: 'accent', solid: true });
  f.text(336, 76, 'factory', { anchor: 'middle', size: 14, bold: true });
  f.lines(280, 102, ['registry:', ' circle → …', ' rect → …', ' square → …'], { size: 11.5, mono: true, gap: 18 });
  const prods = ['circle', 'rect', 'square'];
  prods.forEach((p, i) => {
    const y = 30 + i * 62;
    f.path(`M408 ${118} L452 ${y + 22}`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(456, y, 168, 44, { tone: 'pass', label: `{ ${p}, area() }`, mono: true, size: 11 });
  });
  f.text(W / 2, 240, 'The caller depends on the shared shape, not on how each one is made.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const builderFigure: FigureBuilder = () => {
  const f = new Fig(W, 250, 'An immutable builder. Each call such as from or where returns a brand new builder holding the settings so far, and leaves the old one unchanged. The last call, build, turns the settings into a finished SQL string. Two queries can branch from the same earlier builder without affecting each other.');
  const steps: [string, string, Tone][] = [
    ['query()', 'v1: select *', 'info'],
    ['.from("users")', 'v2: + table', 'info'],
    ['.where("age > 18")', 'v3: + filter', 'info'],
    ['.build()', 'the finished SQL', 'pass'],
  ];
  steps.forEach(([call, sub, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 40, 146, 80, { tone, solid: i === 3 });
    f.text(x + 73, 70, call, { anchor: 'middle', size: 11, mono: true, bold: true });
    f.text(x + 73, 98, sub, { anchor: 'middle', size: 11.5 });
    if (i < 3) f.path(`M${x + 148} 80 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(W / 2, 154, 'SELECT * FROM users WHERE age > 18', { anchor: 'middle', size: 12.5, mono: true, bold: true, tone: 'pass' });
  f.text(W / 2, 190, 'Every step returns a NEW builder: v2 still works after v3 exists.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 218, 'So a shared base query can branch safely into many variations.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const singletonRisk: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A global singleton versus an injected shared instance. With a global singleton every module reaches for the same hidden object, so tests and modules affect each other. With injection the one instance is created once at the top and passed to the modules that need it, so tests can pass a different one.');
  const col = (x: number, title: string, tone: Tone, note: string[]) => {
    f.box(x, 16, 296, 200, { tone });
    f.text(x + 148, 40, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.lines(x + 16, 192, note, { size: 11.5, gap: 16 });
  };
  col(16, 'global singleton', 'fail', ['hidden coupling: any module', 'can reach it and change it']);
  col(328, 'created once, passed in', 'pass', ['same sharing, but visible:', 'a test passes its own']);
  ['A', 'B', 'C'].forEach((m, i) => {
    f.box(32 + i * 90, 62, 70, 30, { tone: 'muted', label: `module ${m}`, size: 10.5 });
    f.path(`M${67 + i * 90} 94 L160 138`, { arrow: true, tone: 'fail', width: 1.5 });
  });
  f.box(100, 140, 120, 36, { tone: 'fail', solid: true, label: 'config (global)', mono: true, size: 11 });
  ['A', 'B', 'C'].forEach((m, i) => {
    f.box(344 + i * 90, 62, 70, 30, { tone: 'muted', label: `module ${m}`, size: 10.5 });
    f.path(`M480 150 L${379 + i * 90} 94`, { arrow: true, tone: 'pass', width: 1.5 });
  });
  f.box(420, 140, 120, 36, { tone: 'pass', solid: true, label: 'config', mono: true, size: 11 });
  f.text(W / 2, 250, 'One instance is fine. A hidden, reachable-from-anywhere one is the problem.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 2 · Strategy and state ───────────────────────── */

const strategyFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The strategy pattern. A checkout has one slot for a pricing strategy. Any of several interchangeable functions, such as percent off, flat off or no discount, can be plugged into that slot, and the checkout code does not change. The percent off strategy is currently plugged in.');
  f.box(190, 16, 260, 56, { tone: 'info' });
  f.text(320, 40, 'checkout(items, discount)', { anchor: 'middle', size: 12.5, mono: true, bold: true });
  f.text(320, 60, 'the algorithm that stays the same', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.box(250, 100, 140, 40, { tone: 'accent', dashed: true, label: 'discount slot', size: 12 });
  f.path('M320 74 V98', { arrow: true, tone: 'muted', width: 1.8 });
  const opts: [string, boolean][] = [['percentOff(10)', true], ['flatOff(5)', false], ['noDiscount', false]];
  opts.forEach(([label, on], i) => {
    const x = 28 + i * 204;
    f.box(x, 190, 184, 44, { tone: on ? 'pass' : 'muted', solid: on, dashed: !on, label, mono: true, size: 11.5 });
    f.path(`M${x + 92} 188 L320 142`, { arrow: on, tone: on ? 'pass' : 'muted', dashed: !on, width: on ? 2.2 : 1.3 });
  });
  f.text(W / 2, 258, 'Swap the function, keep the code around it. No if/else chain to edit.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const stateDiagram: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A state diagram of an order. Pending goes to paid with pay, paid goes to shipped with ship, shipped goes to delivered with deliver. A pending or paid order can be cancelled with cancel. Delivered and cancelled are final: nothing leaves them.');
  const names = ['pending', 'paid', 'shipped', 'delivered'];
  names.forEach((n, i) => {
    const x = 16 + i * 160;
    f.box(x, 40, 120, 52, { tone: i === 3 ? 'pass' : 'info', solid: i === 3, label: n, mono: true, size: 12.5 });
  });
  ['pay()', 'ship()', 'deliver()'].forEach((a, i) => {
    const x = 16 + i * 160 + 122;
    f.path(`M${x} 66 H${x + 36}`, { arrow: true, tone: 'accent', width: 2 });
    f.text(x + 18, 112, a, { anchor: 'middle', size: 10.5, mono: true, tone: 'accent' });
  });
  f.box(96, 150, 150, 52, { tone: 'fail', solid: true, label: 'cancelled', mono: true, size: 12.5 });
  f.path('M76 94 L130 148', { arrow: true, tone: 'fail', width: 1.8 });
  f.path('M236 94 L210 148', { arrow: true, tone: 'fail', width: 1.8 });
  f.text(70, 138, 'cancel()', { anchor: 'middle', size: 10.5, mono: true, tone: 'fail' });
  f.text(262, 138, 'cancel()', { anchor: 'middle', size: 10.5, mono: true, tone: 'fail' });
  f.text(470, 160, 'delivered and cancelled are final', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 236, 'Only the arrows drawn are allowed. Everything else is an error by design.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const flagsVsState: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Boolean flags versus a single state. Three booleans, isPaid, isShipped and isCancelled, allow eight combinations, and many of them make no sense, such as shipped but not paid. A single status field with five values allows only meaningful situations.');
  f.box(16, 20, 296, 170, { tone: 'fail' });
  f.text(164, 46, 'three booleans', { anchor: 'middle', size: 14, bold: true, tone: 'fail' });
  f.lines(40, 76, ['isPaid, isShipped, isCancelled', '2 × 2 × 2 = 8 combinations', 'shipped but not paid?', 'cancelled and delivered?', '…you must guard every one'], { size: 12, gap: 20 });
  f.box(328, 20, 296, 170, { tone: 'pass' });
  f.text(476, 46, 'one status', { anchor: 'middle', size: 14, bold: true, tone: 'pass' });
  f.lines(352, 76, ['status = pending | paid |', '  shipped | delivered | cancelled', '5 states, all meaningful', 'illegal combos cannot exist', 'transitions are one table'], { size: 12, gap: 20 });
  f.text(W / 2, 226, 'Make illegal states unrepresentable.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

export const patternFigures: Record<string, FigureBuilder> = {
  'pat-factory': factoryFigure,
  'pat-builder': builderFigure,
  'pat-singleton': singletonRisk,
  'pat-strategy': strategyFigure,
  'pat-state-diagram': stateDiagram,
  'pat-flags-vs-state': flagsVsState,
};
