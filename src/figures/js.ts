import { Fig, type FigureBuilder } from './kit';

const W = 640;

/* ───────────────────────── this, prototypes & classes ───────────────────────── */

const thisCallSite: FigureBuilder = () => {
  const f = new Fig(W, 300, 'A table of call shapes and what this becomes: obj.fn() gives obj, plain fn() gives undefined, fn.call(x) gives x, new Fn() gives a new object, and an arrow function keeps the this from where it was written.');
  const rows: [string, string, import('./kit').Tone][] = [
    ['obj.fn()', 'this = obj  (what is left of the dot)', 'pass'],
    ['fn()', 'this = undefined  (strict mode)', 'fail'],
    ['fn.call(x)', 'this = x  (you chose it)', 'info'],
    ['new Fn()', 'this = a brand-new object', 'accent'],
    ['() => { … }', 'this = from where it was written', 'muted'],
  ];
  f.text(16, 22, 'How the function is CALLED', { size: 12.5, tone: 'muted', bold: true });
  f.text(330, 22, 'What `this` is', { size: 12.5, tone: 'muted', bold: true });
  rows.forEach(([call, res, tone], i) => {
    const y = 34 + i * 52;
    f.box(16, y, 210, 40, { tone: 'ink', label: call, mono: true });
    f.path(`M230 ${y + 20} H326`, { arrow: true, tone, width: 2 });
    f.box(330, y, 294, 40, { tone, label: res });
  });
  return f;
};

const lostReceiver: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Left: calling user.hi() has a dot, so this is user. Right: copying the method into a variable and calling hi() has no dot, so this is undefined and the name is lost.');
  f.text(156, 24, 'With a dot', { anchor: 'middle', bold: true, tone: 'pass' });
  f.box(36, 38, 240, 40, { tone: 'ink', label: 'user.hi()', mono: true });
  f.path('M156 78 V112', { arrow: true, tone: 'pass', width: 2 });
  f.text(166, 100, 'receiver = user', { size: 12, tone: 'pass', bold: true });
  f.box(36, 112, 240, 56, { tone: 'info', label: 'hi()  runs with', sub: 'this = user' });
  f.path('M156 168 V198', { arrow: true, tone: 'pass', width: 2 });
  f.box(36, 198, 240, 40, { tone: 'pass', solid: true, label: '"hi Ada"', mono: true });
  f.line(320, 20, 320, 250, { tone: 'muted', dashed: true });
  f.text(480, 24, 'Copied out: no dot', { anchor: 'middle', bold: true, tone: 'fail' });
  f.box(360, 38, 240, 40, { tone: 'ink', label: 'const hi = user.hi; hi()', mono: true, r: 8 });
  f.path('M480 78 V112', { arrow: true, tone: 'fail', width: 2 });
  f.text(490, 100, 'no receiver!', { size: 12, tone: 'fail', bold: true });
  f.box(360, 112, 240, 56, { tone: 'info', label: 'hi()  runs with', sub: 'this = undefined' });
  f.path('M480 168 V198', { arrow: true, tone: 'fail', width: 2 });
  f.box(360, 198, 240, 40, { tone: 'fail', solid: true, label: 'TypeError / "hi undefined"' });
  f.text(W / 2, 262, 'The method did not change. Only the way it was called did.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const protoChain: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The prototype chain: the object rex links to Dog.prototype, which links to Animal.prototype, then Object.prototype, then null. Looking up a property walks this chain until it finds it.');
  const names: [string, string, import('./kit').Tone][] = [
    ['rex', 'name: "Rex"', 'accent'],
    ['Dog.prototype', 'bark()', 'info'],
    ['Animal.prototype', 'speak()', 'info'],
    ['Object.prototype', 'toString()', 'muted'],
  ];
  f.text(330, 22, 'each arrow = "if you can\'t find it here, ask the next one"', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  names.forEach(([n, sub, tone], i) => {
    const x = 8 + i * 140;
    f.num(x + 12, 46, i + 1);
    f.box(x, 58, 120, 66, { tone, label: n, sub, size: 12.5 });
    f.path(`M${x + 122} 91 H${x + 138}`, { arrow: true, tone: 'ink', width: 2 });
  });
  f.box(580, 72, 50, 38, { tone: 'muted', dashed: true, label: 'null' });
  f.path('M20 140 H560', { tone: 'accent', dashed: true, width: 1.4 });
  f.packet('M20 140 H560', 6, 'accent');
  f.text(16, 162, 'a lookup walks the chain:', { size: 12, tone: 'muted' });
  f.lines(16, 186, [
    'rex.name        →  rex ✓',
    'rex.bark()      →  rex ✗  →  Dog.prototype ✓',
    'rex.speak()     →  rex ✗  →  Dog.prototype ✗  →  Animal.prototype ✓',
    'rex.toString()  →  …keeps walking…  →  Object.prototype ✓',
  ], { size: 12.5, mono: true, gap: 21 });
  return f;
};

/* ───────────────────────── Arrays ───────────────────────── */

function cells(f: Fig, x: number, y: number, vals: string[], tone: import('./kit').Tone = 'ink', w = 40) {
  vals.forEach((v, i) => f.box(x + i * (w + 4), y, w, 34, { tone, label: v, mono: true, r: 6 }));
  return x + vals.length * (w + 4);
}

const arrayToolkit: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Three array tools. map turns [1,2,3] into [2,4,6] with the same length. filter keeps only the items that pass a test, so [1,2,3,4] becomes [3,4]. reduce folds a whole array into one value, so [1,2,3] becomes 6.');
  const rows: [string, string[], string, string[], import('./kit').Tone][] = [
    ['map', ['1', '2', '3'], 'x => x * 2', ['2', '4', '6'], 'info'],
    ['filter', ['1', '2', '3', '4'], 'x => x > 2', ['3', '4'], 'pass'],
    ['reduce', ['1', '2', '3'], '(sum, x) => sum + x', ['6'], 'accent'],
  ];
  rows.forEach(([name, from, fn, to, tone], i) => {
    const y = 28 + i * 86;
    f.text(16, y - 6, `.${name}()`, { mono: true, bold: true, tone });
    const end = cells(f, 16, y, from);
    f.path(`M${end + 6} ${y + 17} H${end + 150}`, { arrow: true, tone, width: 2 });
    f.text(end + 78, y + 8, fn, { anchor: 'middle', size: 11.5, mono: true, tone });
    cells(f, end + 158, y, to, tone, to.length === 1 ? 52 : 40);
  });
  f.text(330, 280, 'map: same length · filter: fewer · reduce: one value', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const shallowCopy: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Copying an array with spread creates a new array, but both arrays still point at the same objects inside. Changing an object through the copy also changes it in the original.');
  f.text(160, 24, 'items', { anchor: 'middle', bold: true, mono: true });
  f.text(480, 24, 'copy = [...items]', { anchor: 'middle', bold: true, mono: true, tone: 'accent' });
  f.box(100, 34, 120, 40, { tone: 'ink', dashed: true });
  f.box(108, 40, 50, 28, { tone: 'ink', label: '●', r: 5 }); f.box(162, 40, 50, 28, { tone: 'ink', label: '●', r: 5 });
  f.box(420, 34, 120, 40, { tone: 'accent', dashed: true });
  f.box(428, 40, 50, 28, { tone: 'accent', label: '●', r: 5 }); f.box(482, 40, 50, 28, { tone: 'accent', label: '●', r: 5 });
  f.box(120, 150, 130, 50, { tone: 'info', label: '{ id: 1 }', sub: 'todo A', mono: true });
  f.box(390, 150, 130, 50, { tone: 'info', label: '{ id: 2 }', sub: 'todo B', mono: true });
  f.path('M133 68 L170 150', { arrow: true, tone: 'ink' });
  f.path('M187 68 L430 150', { arrow: true, tone: 'ink' });
  f.path('M453 68 L200 150', { arrow: true, tone: 'accent', dashed: true });
  f.path('M507 68 L460 150', { arrow: true, tone: 'accent', dashed: true });
  f.text(320, 56, 'two different arrays…', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  f.text(320, 232, '…pointing at the SAME two objects. copy[0].done = true changes items[0] too.', { anchor: 'middle', size: 13, tone: 'fail', bold: true });
  f.text(320, 254, 'To change one item safely, replace it: copy.map(t => t.id === 1 ? { ...t, done: true } : t)', { anchor: 'middle', size: 11.5, tone: 'muted' });
  return f;
};

const sortDefault: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Calling sort with no comparator sorts numbers as text, so [10, 9, 1] becomes [1, 10, 9]. Passing (a, b) => a - b sorts them as numbers, giving [1, 9, 10].');
  f.text(16, 26, '[10, 9, 1].sort()', { mono: true, bold: true, tone: 'fail' });
  const e1 = cells(f, 16, 40, ['10', '9', '1']);
  f.path(`M${e1 + 6} 57 H300`, { arrow: true, tone: 'fail', width: 2 });
  f.text(230, 50, 'compared as TEXT', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  f.text(230, 76, '"1" < "10" < "9"', { anchor: 'middle', size: 12, mono: true, tone: 'muted' });
  cells(f, 310, 40, ['1', '10', '9'], 'fail');
  f.text(470, 62, '✗ surprise!', { size: 13, tone: 'fail', bold: true });
  f.text(16, 130, '[10, 9, 1].sort((a, b) => a - b)', { mono: true, bold: true, tone: 'pass' });
  const e2 = cells(f, 16, 144, ['10', '9', '1']);
  f.path(`M${e2 + 6} 161 H300`, { arrow: true, tone: 'pass', width: 2 });
  f.text(230, 154, 'compared as NUMBERS', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(230, 180, 'a - b < 0 → a first', { anchor: 'middle', size: 12, mono: true, tone: 'muted' });
  cells(f, 310, 144, ['1', '9', '10'], 'pass');
  f.text(470, 166, '✓ as expected', { size: 13, tone: 'pass', bold: true });
  f.text(W / 2, 226, 'Always pass a comparator for numbers. It must return a number, never true/false.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};


/* ───────────────────────── Objects & references ───────────────────────── */

const refVsValue: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Left: numbers are copied by value, so changing y does not change x. Right: objects are shared by reference, so a and b point at the same object and a change through b shows up in a.');
  f.text(156, 24, 'Primitives: copied', { anchor: 'middle', bold: true, tone: 'pass' });
  f.text(156, 46, 'let y = x;  y = 2;', { anchor: 'middle', mono: true, size: 12.5 });
  f.box(40, 66, 100, 50, { tone: 'info', label: 'x', sub: '1', mono: true });
  f.box(172, 66, 100, 50, { tone: 'info', label: 'y', sub: '2', mono: true });
  f.text(156, 148, 'two separate boxes', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(156, 172, 'changing y leaves x alone', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.line(320, 20, 320, 260, { tone: 'muted', dashed: true });
  f.text(480, 24, 'Objects: shared', { anchor: 'middle', bold: true, tone: 'fail' });
  f.text(480, 46, 'const b = a;  b.n = 2;', { anchor: 'middle', mono: true, size: 12.5 });
  f.box(370, 66, 70, 40, { tone: 'ink', label: 'a', mono: true });
  f.box(520, 66, 70, 40, { tone: 'ink', label: 'b', mono: true });
  f.box(430, 170, 100, 56, { tone: 'fail', label: '{ n: 2 }', sub: 'one object', mono: true });
  f.path('M405 106 L455 170', { arrow: true, tone: 'ink', width: 2 });
  f.path('M555 106 L505 170', { arrow: true, tone: 'ink', width: 2 });
  f.text(480, 248, 'a and b are two names for ONE object', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  return f;
};

const shallowDeep: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Left: a shallow copy has its own top-level properties but shares the nested address object with the original. Right: a deep copy duplicates the nested object too, so the two are fully independent.');
  f.text(156, 22, 'Shallow:  { ...user }', { anchor: 'middle', bold: true, mono: true, tone: 'fail', size: 13 });
  f.box(20, 40, 110, 60, { tone: 'ink', label: 'user', sub: 'name: "Ada"' });
  f.box(182, 40, 110, 60, { tone: 'accent', label: 'copy', sub: 'name: "Ada"' });
  f.box(96, 180, 120, 56, { tone: 'fail', label: 'address', sub: '{ city }', mono: false });
  f.path('M75 100 L130 180', { arrow: true, tone: 'ink', width: 2 });
  f.path('M237 100 L182 180', { arrow: true, tone: 'accent', width: 2 });
  f.text(156, 262, 'copy.address.city = "Paris"', { anchor: 'middle', size: 12, mono: true });
  f.text(156, 282, 'also changes user ✗', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.line(320, 20, 320, 290, { tone: 'muted', dashed: true });
  f.text(480, 22, 'Deep:  structuredClone(user)', { anchor: 'middle', bold: true, mono: true, tone: 'pass', size: 13 });
  f.box(344, 40, 110, 60, { tone: 'ink', label: 'user', sub: 'name: "Ada"' });
  f.box(506, 40, 110, 60, { tone: 'accent', label: 'copy', sub: 'name: "Ada"' });
  f.box(344, 180, 110, 56, { tone: 'info', label: 'address', sub: '{ city }' });
  f.box(506, 180, 110, 56, { tone: 'info', label: 'address', sub: '{ city }' });
  f.path('M399 100 V180', { arrow: true, tone: 'ink', width: 2 });
  f.path('M561 100 V180', { arrow: true, tone: 'accent', width: 2 });
  f.text(480, 262, 'copy.address.city = "Paris"', { anchor: 'middle', size: 12, mono: true });
  f.text(480, 282, 'user is unaffected ✓', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  return f;
};

const pathUpdate: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Updating state.user.address.city without mutating: new copies are made only for the objects along the path (root, user, address). Everything off the path, like settings, is shared between the old and new state.');
  f.text(120, 20, 'Old state', { anchor: 'middle', bold: true });
  f.text(500, 20, 'New state (after set city)', { anchor: 'middle', bold: true, tone: 'accent' });
  const old: [string, string, number][] = [['root', '', 30], ['user', '', 100], ['address', 'city: "London"', 170]];
  old.forEach(([n, sub, y]) => f.box(40, y, 160, 50, { tone: 'ink', label: n, sub: sub || undefined, mono: true }));
  f.path('M120 80 V100', { arrow: true }); f.path('M120 150 V170', { arrow: true });
  const nw: [string, string, number][] = [['root ′', 'copied', 30], ['user ′', 'copied', 100], ['address ′', 'city: "Paris"', 170]];
  nw.forEach(([n, sub, y]) => f.box(420, y, 160, 50, { tone: 'accent', label: n, sub, mono: true }));
  f.path('M500 80 V100', { arrow: true, tone: 'accent' }); f.path('M500 150 V170', { arrow: true, tone: 'accent' });
  f.box(250, 100, 120, 50, { tone: 'pass', label: 'settings', sub: 'shared!', mono: true });
  f.path('M200 55 L270 100', { arrow: true, tone: 'pass', dashed: true });
  f.path('M420 55 L350 100', { arrow: true, tone: 'pass', dashed: true });
  f.text(W / 2, 252, 'Only the path is copied. Off-path objects keep their identity,', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(W / 2, 272, 'so React.memo and selectors can skip them (old === new).', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};


/* ───────────────────────── async / await & concurrency ───────────────────────── */

const seqVsParallel: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Sequential awaits run one after another, so the total time is the sum: 100 plus 150 plus 80 is 330 milliseconds. Promise.all starts all three together, so the total is the longest one: 150 milliseconds.');
  const x0 = 100, k = 1.4;
  const bar = (y: number, from: number, len: number, name: string, tone: import('./kit').Tone) => {
    f.box(x0 + from * k, y, len * k, 26, { tone, solid: true, r: 13 });
    f.text(x0 + (from + len / 2) * k, y + 18, `${name} ${len}ms`, { anchor: 'middle', size: 12, bold: true, tone });
  };
  f.text(16, 26, 'await a; await b; await c', { mono: true, bold: true, tone: 'fail', size: 13 });
  bar(38, 0, 100, 'a', 'info'); bar(38, 100, 150, 'b', 'info'); bar(38, 250, 80, 'c', 'info');
  f.path(`M${x0} 82 H${x0 + 330 * k}`, { arrow: true, tone: 'fail', width: 2 });
  f.text(x0 + 165 * k, 100, 'total ≈ 330ms  (a + b + c)', { anchor: 'middle', size: 13, bold: true, tone: 'fail' });
  f.line(16, 122, 624, 122, { tone: 'muted', dashed: true });
  f.text(16, 148, 'await Promise.all([a(), b(), c()])', { mono: true, bold: true, tone: 'pass', size: 13 });
  bar(160, 0, 100, 'a', 'pass'); bar(192, 0, 150, 'b', 'pass'); bar(224, 0, 80, 'c', 'pass');
  f.path(`M${x0 + 150 * k} 156 V252`, { tone: 'pass', dashed: true });
  f.text(x0 + 150 * k + 10, 254, 'total ≈ 150ms  (the slowest one)', { size: 13, bold: true, tone: 'pass' });
  return f;
};

const poolLimit: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A pool with a limit of 2: two workers take tasks from a shared list. When one finishes it immediately starts the next, so never more than 2 tasks run at once, yet nothing sits idle.');
  const x0 = 110, u = 70;
  f.text(16, 24, 'limit = 2', { mono: true, bold: true });
  const lanes: [string, [string, number, number][]][] = [
    ['worker 1', [['task 1', 0, 3], ['task 4', 3, 1], ['task 5', 4, 3]]],
    ['worker 2', [['task 2', 0, 2], ['task 3', 2, 2]]],
  ];
  lanes.forEach(([name, tasks], i) => {
    const y = 44 + i * 56;
    f.text(16, y + 25, name, { size: 12.5, tone: 'muted' });
    tasks.forEach(([t, from, len], j) => {
      f.box(x0 + from * u + 1, y, len * u - 2, 38, { tone: j % 2 ? 'accent' : 'info', solid: true, label: t, r: 8 });
    });
  });
  f.line(x0, 158, x0 + 7 * u, 158, { tone: 'muted' });
  for (let t = 0; t <= 7; t++) { f.line(x0 + t * u, 154, x0 + t * u, 162, { tone: 'muted' }); f.text(x0 + t * u, 176, String(t), { anchor: 'middle', size: 11.5, tone: 'muted', mono: true }); }
  f.text(x0 + 3.5 * u, 198, 'time →', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 226, 'Promise.all(tasks.map(run)) would start all 5 at once.', { anchor: 'middle', size: 13, tone: 'fail', bold: true });
  f.text(W / 2, 248, 'A pool keeps at most 2 in flight and starts the next as soon as a slot frees up.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const latestWins: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Search as you type: the request for "ca" is slow and the request for "cat" is fast, so the answer for "ca" arrives last. Without protection it overwrites the newer result; with latest-wins it is ignored as stale.');
  const x0 = 130, k = 1.2;
  f.text(16, 28, 'time →', { size: 12.5, tone: 'muted' });
  f.text(16, 68, 'request "ca"', { mono: true, size: 12.5 });
  f.box(x0, 48, 300 * k, 28, { tone: 'fail', solid: true, r: 14 });
  f.text(x0 + 300 * k + 10, 67, 'answer arrives LAST', { size: 12.5, tone: 'fail', bold: true });
  f.text(16, 118, 'request "cat"', { mono: true, size: 12.5 });
  f.box(x0 + 100 * k, 98, 100 * k, 28, { tone: 'pass', solid: true, r: 14 });
  f.text(x0 + 200 * k + 10, 117, 'answer arrives first', { size: 12.5, tone: 'pass', bold: true });
  f.box(40, 160, 250, 76, { tone: 'fail', label: 'Without protection', sub: 'screen shows results for "ca" ✗', mono: false });
  f.box(350, 160, 250, 76, { tone: 'pass', label: 'Latest wins', sub: '"ca" is marked stale, ignored ✓' });
  f.path('M165 130 V160', { tone: 'fail', arrow: true });
  f.path('M475 130 V160', { tone: 'pass', arrow: true });
  f.text(W / 2, 258, 'Responses can arrive in any order. Only the newest call may update the screen.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};


/* ───────────────────────── Event loop & rate limiting ───────────────────────── */

const eventLoop: FigureBuilder = () => {
  const f = new Fig(W, 320, 'The event loop: the call stack runs code. Promise callbacks go to the microtask queue, which is emptied completely first. Timers, network and clicks are handled by the host and their callbacks go to the task queue, from which the loop takes one task at a time.');
  f.box(16, 30, 150, 270, { tone: 'ink' });
  f.text(91, 54, 'Call stack', { anchor: 'middle', bold: true });
  f.text(91, 74, 'runs ONE thing at a time', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.box(36, 210, 110, 34, { tone: 'muted', label: 'main()', mono: true, r: 6 });
  f.box(36, 246, 110, 34, { tone: 'accent', label: 'yourFn()', mono: true, r: 6 });
  f.box(440, 28, 184, 64, { tone: 'accent', label: 'Microtask queue', sub: 'promise .then · await' });
  f.box(440, 128, 184, 64, { tone: 'info', label: 'Task queue', sub: 'timers · clicks · I/O' });
  f.box(230, 230, 170, 70, { tone: 'muted', dashed: true, label: 'Host (browser/Node)', sub: 'timers · network · clicks' });
  f.path('M168 50 H438', { arrow: true, tone: 'accent' });
  f.text(303, 44, 'promise.then / await', { anchor: 'middle', size: 11.5, tone: 'accent', mono: true });
  f.path('M438 76 H168', { arrow: true, tone: 'accent', dashed: true, width: 2 });
  f.text(303, 94, '① run ALL microtasks first', { anchor: 'middle', size: 12, tone: 'accent', bold: true });
  f.path('M168 256 H228', { arrow: true, tone: 'muted' });
  f.text(198, 248, 'start', { anchor: 'middle', size: 11, tone: 'muted' });
  f.path('M400 252 L470 194', { arrow: true, tone: 'muted' });
  f.text(454, 228, 'when done', { size: 11, tone: 'muted' });
  f.path('M438 168 H168', { arrow: true, tone: 'info', dashed: true, width: 2 });
  f.text(303, 160, '② then take ONE task', { anchor: 'middle', size: 12, tone: 'info', bold: true });
  f.text(303, 136, 'setTimeout(fn, 0) waits here →', { anchor: 'middle', size: 11.5, tone: 'muted', mono: true });
  f.packet('M440 76 H168', 3, 'accent');
  return f;
};

const debounceThrottle: FigureBuilder = () => {
  const f = new Fig(W, 290, 'A timeline of events: a burst of five, then a pause, then a burst of two. Debounce runs once after each burst ends. Throttle runs at most once every 300 milliseconds while events keep coming.');
  const x0 = 120, k = 0.42;
  const at = (ms: number) => x0 + ms * k;
  f.line(x0, 232, at(1200), 232, { tone: 'muted' });
  [0, 300, 600, 900, 1200].forEach((t) => { f.line(at(t), 228, at(t), 236, { tone: 'muted' }); f.text(at(t), 252, `${t}`, { anchor: 'middle', size: 11, tone: 'muted', mono: true }); });
  f.text(at(600), 272, 'time (ms)', { anchor: 'middle', size: 11.5, tone: 'muted' });
  const events = [0, 80, 160, 240, 320, 800, 880];
  f.text(16, 54, 'events', { mono: true, bold: true, size: 13 });
  events.forEach((t) => f.raw(`<circle class="f-dot t-ink" cx="${at(t)}" cy="50" r="5"/>`));
  f.text(16, 124, 'debounce', { mono: true, bold: true, size: 13, tone: 'info' });
  f.text(16, 140, '(300ms quiet)', { size: 11, tone: 'muted' });
  f.box(at(0), 112, at(320) - at(0), 10, { tone: 'muted', dashed: true, r: 5 });
  [620, 1180].forEach((t) => f.raw(`<circle class="f-dot t-info" cx="${at(t)}" cy="118" r="8"/>`));
  f.text(at(620), 102, 'fires', { anchor: 'middle', size: 11.5, tone: 'info', bold: true });
  f.text(at(1180) - 6, 102, 'fires', { anchor: 'middle', size: 11.5, tone: 'info', bold: true });
  f.text(16, 194, 'throttle', { mono: true, bold: true, size: 13, tone: 'pass' });
  f.text(16, 210, '(every 300ms)', { size: 11, tone: 'muted' });
  [0, 300, 600, 900].forEach((t) => f.raw(`<circle class="f-dot t-pass" cx="${at(t)}" cy="188" r="8"/>`));
  f.text(W / 2 + 40, 78, 'debounce: "wait until they stop"     throttle: "at most once per window"', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const longTask: FigureBuilder = () => {
  const f = new Fig(W, 230, 'Normally the browser can paint a new frame about every 16 milliseconds. A long synchronous task blocks the single thread, so no frames are painted and clicks wait until it finishes.');
  const x0 = 20;
  f.text(x0, 26, 'the single thread, left to right in time', { size: 12.5, tone: 'muted' });
  for (let i = 0; i < 5; i++) f.box(x0 + i * 30, 50, 26, 40, { tone: 'pass', solid: true, r: 4 });
  f.box(x0 + 150, 50, 300, 40, { tone: 'fail', solid: true, label: 'long task: 300ms of JavaScript', r: 6 });
  for (let i = 0; i < 4; i++) f.box(x0 + 456 + i * 40, 50, 36, 40, { tone: 'pass', solid: true, r: 4 });
  f.text(x0 + 60, 112, 'smooth frames', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(x0 + 300, 112, 'NO frames painted · clicks and timers wait', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.text(x0 + 540, 112, 'recovers', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.box(40, 140, 250, 70, { tone: 'fail', label: 'One big loop', sub: 'page freezes for the whole loop' });
  f.box(350, 140, 250, 70, { tone: 'pass', label: 'Small chunks', sub: 'yield between pieces, or use a Worker' });
  return f;
};


/* ───────────────────────── Iterators & generators ───────────────────────── */

const iteratorProtocol: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The iteration protocol: an iterable has a Symbol.iterator method that returns an iterator. The consumer, such as for-of or spread, calls next() again and again; each call returns an object with value and done, until done is true.');
  f.box(16, 30, 170, 72, { tone: 'info', label: 'iterable', sub: 'array · Set · string' });
  f.box(236, 30, 170, 72, { tone: 'accent', label: 'iterator', sub: 'has a next() method' });
  f.box(456, 30, 168, 72, { tone: 'ink', label: 'consumer', sub: 'for…of · spread · [a, b]=' });
  f.path('M188 66 H234', { arrow: true, tone: 'info', width: 2 });
  f.text(211, 52, 'gives', { anchor: 'middle', size: 11.5, tone: 'info', bold: true });
  f.text(101, 118, '[Symbol.iterator]() returns the iterator', { size: 11.5, tone: 'info', mono: true });
  f.path('M454 56 H408', { arrow: true, tone: 'ink', width: 2 });
  f.text(431, 46, 'next()', { anchor: 'middle', size: 11.5, tone: 'ink', mono: true });
  f.path('M408 84 H454', { arrow: true, tone: 'accent', dashed: true });
  f.num(28, 42, 1); f.num(248, 42, 2); f.num(468, 42, 3);
  const res: [string, string, string, import('./kit').Tone][] = [
    ['1', 'done: false', '1st next()', 'pass'],
    ['2', 'done: false', '2nd next()', 'pass'],
    ['3', 'done: false', '3rd next()', 'pass'],
    ['undefined', 'done: true', '4th next() → stop!', 'fail'],
  ];
  f.text(16, 140, 'each next() returns { value, done }:', { size: 12, tone: 'muted', mono: true });
  res.forEach(([v, d, sub, tone], i) => {
    const x = 16 + i * 154;
    f.box(x, 150, 146, 54, { tone, label: `value: ${v}`, sub: d, mono: true, r: 6 });
    f.text(x + 73, 222, sub, { anchor: 'middle', size: 12, tone: 'muted' });
  });
  f.text(W / 2, 252, 'The loop keeps calling next() until it sees done: true.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const lazyVsEager: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Top: array methods are eager, each step builds a complete new array before the next step starts. Bottom: a lazy generator pipeline passes one item at a time through every step and stops as soon as enough results exist.');
  f.text(16, 24, 'Eager: arrays.map().filter().slice(0, 2)', { mono: true, bold: true, size: 12.5, tone: 'fail' });
  const st = ['map', 'filter', 'slice'];
  st.forEach((n, i) => {
    const x = 16 + i * 210;
    f.box(x, 40, 120, 40, { tone: 'fail', label: `.${n}()`, mono: true });
    if (i < 2) f.path(`M${x + 122} 60 H${x + 206}`, { arrow: true, tone: 'fail' });
    f.text(x + 60, 100, i === 0 ? 'new array of ALL' : i === 1 ? 'new array of ALL' : 'first 2', { anchor: 'middle', size: 11.5, tone: 'muted' });
  });
  f.line(16, 122, 624, 122, { tone: 'muted', dashed: true });
  f.text(16, 148, 'Lazy: generators, pulled one item at a time', { mono: true, bold: true, size: 12.5, tone: 'pass' });
  ['map', 'filter', 'take(2)'].forEach((n, i) => {
    const x = 16 + i * 210;
    f.box(x, 166, 120, 40, { tone: 'pass', label: n, mono: true });
    if (i < 2) f.path(`M${x + 122} 186 H${x + 206}`, { arrow: true, tone: 'pass' });
  });
  f.packet('M20 186 H600', 5, 'accent');
  f.text(W / 2, 236, 'Each item travels through the whole pipeline before the next one starts.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(W / 2, 258, 'take(2) stops pulling as soon as it has 2 → the rest of the source is never touched.', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.text(W / 2, 282, 'Works even for an infinite source. Eager arrays cannot.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const earlyExit: FigureBuilder = () => {
  const f = new Fig(W, 250, 'If the consumer stops early with break, return, an error or by destructuring fewer items, JavaScript calls the iterator return method so it can clean up. If the loop runs to the end, return is not called.');
  f.text(156, 24, 'Stops early', { anchor: 'middle', bold: true, tone: 'accent' });
  f.box(36, 38, 240, 44, { tone: 'ink', label: 'for (x of it) { break }', mono: true });
  f.path('M156 82 V112', { arrow: true, tone: 'accent', width: 2 });
  f.box(36, 112, 240, 44, { tone: 'accent', label: 'it.return() is called', mono: true });
  f.path('M156 156 V182', { arrow: true, tone: 'accent', width: 2 });
  f.box(36, 182, 240, 44, { tone: 'pass', label: 'cleanup: close file / unsubscribe' });
  f.line(320, 20, 320, 232, { tone: 'muted', dashed: true });
  f.text(480, 24, 'Runs to the end', { anchor: 'middle', bold: true, tone: 'muted' });
  f.box(364, 38, 232, 44, { tone: 'ink', label: 'for (x of it) { … }', mono: true });
  f.path('M480 82 V112', { arrow: true, tone: 'muted', width: 2 });
  f.box(364, 112, 232, 44, { tone: 'muted', label: 'next() → done: true', mono: true });
  f.path('M480 156 V182', { arrow: true, tone: 'muted', width: 2 });
  f.box(364, 182, 232, 44, { tone: 'muted', dashed: true, label: 'return() NOT called' });
  return f;
};


/* ───────────────────────── Functional patterns ───────────────────────── */

const pipeFlow: FigureBuilder = () => {
  const f = new Fig(W, 240, 'A pipe is an assembly line. The text "  Hello World  " goes through trim, then toLowerCase, then a replace step, and comes out as "hello-world". Each step takes one value and returns one value.');
  f.text(16, 24, 'slugify = pipe(trim, toLowerCase, spacesToDashes)', { mono: true, bold: true, size: 13 });
  const xs = [14, 176, 338, 500];
  const chips = ['start', 'after ①', 'after ②', 'result'];
  const vals = ['"  Hello World  "', '"Hello World"', '"hello world"', '"hello-world"'];
  const fns = ['① trim', '② toLowerCase', '③ spacesToDashes'];
  xs.forEach((x, i) => {
    f.box(x, 84, 126, 44, { tone: i === 3 ? 'pass' : 'info', label: chips[i] });
    f.text(x + 63, 152, vals[i], { anchor: 'middle', size: 11.5, mono: true, tone: i === 3 ? 'pass' : 'muted', bold: i === 3 });
    if (i < 3) {
      f.path(`M${x + 128} 106 H${xs[i + 1] - 2}`, { arrow: true, tone: 'accent', width: 2 });
      f.text((x + 128 + xs[i + 1]) / 2, 76, fns[i], { anchor: 'middle', size: 12, tone: 'accent', bold: true });
    }
  });
  f.text(W / 2, 196, 'Data flows left to right. Every step is small, named and testable on its own.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  f.text(W / 2, 218, 'compose() is the same line read right to left (maths order).', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const curryFlow: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Currying turns add(1, 2, 3) into add(1)(2)(3): each call gives back a new function that remembers the arguments so far, until the last argument arrives and the result is computed.');
  f.box(16, 30, 160, 50, { tone: 'info', label: 'add(1)', mono: true });
  f.box(236, 30, 160, 50, { tone: 'info', label: '(2)', mono: true });
  f.box(456, 30, 160, 50, { tone: 'pass', label: '(3)  →  6', mono: true });
  f.path('M178 55 H234', { arrow: true, width: 2 });
  f.path('M398 55 H454', { arrow: true, width: 2 });
  f.box(16, 110, 160, 70, { tone: 'info', dashed: true, label: 'a function', sub: 'remembers a = 1' });
  f.box(236, 110, 160, 70, { tone: 'info', dashed: true, label: 'a function', sub: 'remembers a = 1, b = 2' });
  f.box(456, 110, 160, 70, { tone: 'pass', dashed: true, label: 'enough arguments!', sub: 'computes a + b + c' });
  f.path('M96 80 V110', { arrow: true, tone: 'muted' });
  f.path('M316 80 V110', { arrow: true, tone: 'muted' });
  f.path('M536 80 V110', { arrow: true, tone: 'muted' });
  f.text(W / 2, 214, 'Each returned function is a closure: its backpack holds the arguments received so far.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  f.text(W / 2, 236, 'Partial application: fix SOME arguments now. Currying: always ONE at a time.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const marble: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A marble diagram over time. The source observable emits 1, 2, 3, 4, 5. After map multiplying by ten, the values are 10, 20, 30, 40, 50. After take(2) only 10 and 20 come out, then the stream completes and the source is unsubscribed so 3, 4 and 5 are never produced.');
  const x0 = 130, gap = 80;
  const row = (y: number, label: string, vals: string[], tone: import('./kit').Tone, faded = 0) => {
    f.text(16, y + 5, label, { mono: true, bold: true, size: 13 });
    f.line(x0 - 10, y, 620, y, { tone: 'muted', width: 1.4 });
    vals.forEach((v, i) => {
      const cx = x0 + i * gap + 20;
      const off = i >= vals.length - faded;
      f.raw(`<circle class="f-box t-${off ? 'muted' : tone} solid" cx="${cx}" cy="${y}" r="17" ${off ? 'opacity="0.35"' : ''}/>`);
      f.text(cx, y + 5, v, { anchor: 'middle', size: 13, mono: true, bold: true, tone: off ? 'muted' : tone });
    });
  };
  f.text(16, 24, 'time →', { size: 12, tone: 'muted' });
  row(60, 'source', ['1', '2', '3', '4', '5'], 'info');
  row(130, '.map(x*10)', ['10', '20', '30', '40', '50'], 'accent');
  row(200, '.take(2)', ['10', '20'], 'pass');
  f.line(x0 + 2 * gap - 18, 184, x0 + 2 * gap - 18, 216, { tone: 'pass', width: 3 });
  f.text(x0 + 2 * gap - 8, 222, 'complete', { size: 12, tone: 'pass', bold: true });
  f.text(x0 + 2 * gap + 10, 244, '→ take(2) unsubscribes from upstream, so 3, 4, 5 never happen', { size: 12, tone: 'muted', italic: true });
  f.text(W / 2, 262, 'Operators wrap the source and return a new observable — function composition again.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

export const jsFigures: Record<string, FigureBuilder> = {
  'this-call-site': thisCallSite,
  'lost-receiver': lostReceiver,
  'proto-chain': protoChain,
  'array-toolkit': arrayToolkit,
  'shallow-copy': shallowCopy,
  'sort-default': sortDefault,
  'ref-vs-value': refVsValue,
  'shallow-deep': shallowDeep,
  'path-update': pathUpdate,
  'seq-vs-parallel': seqVsParallel,
  'pool-limit': poolLimit,
  'latest-wins': latestWins,
  'event-loop': eventLoop,
  'debounce-throttle': debounceThrottle,
  'long-task': longTask,
  'iterator-protocol': iteratorProtocol,
  'lazy-vs-eager': lazyVsEager,
  'early-exit': earlyExit,
  'pipe-flow': pipeFlow,
  'curry-flow': curryFlow,
  'marble-diagram': marble,
};
