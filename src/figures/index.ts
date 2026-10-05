import { Fig, type Figure, type FigureBuilder } from './kit';
import { jsFigures } from './js';
import { tsFigures } from './ts';
import { reactFigures } from './react';
import { prodFigures } from './prod';
import { interviewFigures } from './interview';
import { webFigures } from './web';
import { systemFigures } from './system';
import { dsFigures } from './ds';
import { algoFigures } from './algo';
import { testingFigures } from './testing';
import { patternFigures } from './patterns';
import { securityFigures } from './security';
import { nodeFigures } from './node';
import { renderingFigures } from './rendering';

/* Figure registry. Lesson Markdown references these ids: ![alt](fig:closure-backpack "Caption") */

const W = 640;

/* ───────────────────────── Closures & scope ───────────────────────── */

const closureBackpack: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A function called makeCounter finishes running, but the function it returned carries a backpack that still holds the variable count.');
  f.box(16, 30, 210, 150, { tone: 'muted', dashed: true });
  f.text(121, 54, 'makeCounter()', { anchor: 'middle', bold: true, mono: true });
  f.text(121, 74, 'runs once, then it is done', { anchor: 'middle', size: 12, tone: 'muted' });
  f.box(46, 98, 150, 40, { tone: 'info', label: 'let count = 0', mono: true });
  f.text(121, 162, 'its local variables would', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(121, 177, 'normally disappear…', { anchor: 'middle', size: 12, tone: 'muted' });
  f.num(28, 42, 1);

  f.path('M232 105 H322', { arrow: true, tone: 'accent', width: 2 });
  f.text(277, 95, 'returns', { anchor: 'middle', size: 12.5, tone: 'accent', bold: true });

  f.box(330, 24, 294, 170, { tone: 'accent' });
  f.text(477, 50, 'counter  (the returned function)', { anchor: 'middle', bold: true, mono: true, size: 13 });
  f.text(477, 70, '() => { count++; return count; }', { anchor: 'middle', size: 12.5, mono: true, tone: 'muted' });
  f.box(372, 92, 210, 84, { tone: 'info', dashed: true });
  f.text(477, 114, 'backpack (the closure)', { anchor: 'middle', size: 12.5, tone: 'info', bold: true });
  f.box(412, 126, 130, 36, { tone: 'info', solid: true, label: 'count = 0', mono: true });
  f.num(342, 38, 2);
  f.num(384, 104, 3);

  f.text(W / 2, 226, '…but the returned function packed a backpack with the variables it needs, and keeps it forever.', { anchor: 'middle', size: 13, tone: 'muted', italic: true });
  return f;
};

const closureAlive: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Animation: each call to counter reads the count in its backpack and increases it. The value goes 0, 1, 2, 3 and is remembered between calls.');
  const cycle = 8;
  f.box(24, 60, 200, 90, { tone: 'accent' });
  f.text(124, 92, 'counter()', { anchor: 'middle', bold: true, mono: true });
  f.text(124, 114, 'count++; return count', { anchor: 'middle', mono: true, size: 12, tone: 'muted' });
  f.box(404, 40, 212, 130, { tone: 'info', dashed: true });
  f.text(510, 64, 'backpack', { anchor: 'middle', size: 13, tone: 'info', bold: true });
  f.path('M226 90 C300 50 340 50 402 90', { tone: 'accent', arrow: true, dashed: true });
  f.path('M402 122 C340 160 300 160 226 122', { tone: 'pass', arrow: true, dashed: true });
  f.text(314, 44, 'read count', { anchor: 'middle', size: 12, tone: 'accent' });
  f.text(314, 176, 'save new count', { anchor: 'middle', size: 12, tone: 'pass' });
  const vals = [0, 1, 2, 3];
  vals.forEach((v, i) => {
    f.phase((i * cycle) / 4, ((i + 1) * cycle) / 4, cycle, (p) => {
      p.box(450, 92, 120, 44, { tone: 'info', solid: true, label: `count = ${v}`, mono: true });
      p.text(124, 196, i === 0 ? 'Not called yet.' : `Call #${i} just returned ${v}`, { anchor: 'middle', bold: true, tone: i === 0 ? 'muted' : 'pass' });
    });
  });
  f.packet('M226 90 C300 50 340 50 402 90', 2, 'accent', 0);
  f.text(W / 2, 246, 'The backpack survives between calls — that is the whole trick.', { anchor: 'middle', size: 13, tone: 'muted', italic: true });
  return f;
};

const scopeChain: FigureBuilder = () => {
  const f = new Fig(W, 330, 'Three nested scopes: inner inside outer inside global. When inner looks up a variable, JavaScript checks inner first, then outer, then global.');
  f.box(16, 16, 380, 298, { tone: 'muted', dashed: true });
  f.text(32, 40, 'Global scope', { bold: true });
  f.text(32, 62, 'const a = 1', { mono: true, tone: 'info' });
  f.box(40, 80, 330, 210, { tone: 'info', dashed: true });
  f.text(56, 104, 'outer()  scope', { bold: true });
  f.text(56, 126, 'const b = 2', { mono: true, tone: 'info' });
  f.box(72, 146, 262, 120, { tone: 'accent', dashed: true });
  f.text(88, 170, 'inner()  scope', { bold: true, tone: 'accent' });
  f.text(88, 192, 'const c = 3', { mono: true, tone: 'info' });
  f.text(88, 222, 'return a + b + c', { mono: true });
  f.text(88, 244, '  // needs a, b and c', { mono: true, size: 12, tone: 'muted' });
  f.num(398, 28, 1); f.num(372, 92, 2); f.num(338, 158, 3);

  f.text(420, 40, 'Looking up a name', { bold: true });
  f.box(420, 52, 204, 44, { tone: 'pass', label: 'c: found in inner' });
  f.box(420, 112, 204, 44, { tone: 'info', label: 'b: inner ✗ → outer ✓' });
  f.box(420, 172, 204, 44, { tone: 'muted', label: 'a: inner ✗ outer ✗ global ✓' });
  f.path('M520 96 V112', { arrow: true, tone: 'muted' });
  f.path('M520 156 V172', { arrow: true, tone: 'muted' });
  f.text(420, 244, 'Rule: look here first,', { size: 12.5, tone: 'muted' });
  f.text(420, 262, 'then step outward, one', { size: 12.5, tone: 'muted' });
  f.text(420, 280, 'level at a time.', { size: 12.5, tone: 'muted' });
  return f;
};

const varLoopTrap: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Left: with var, all three callbacks share one variable i, which ends at 3, so they print 3, 3, 3. Right: with let, each loop turn gets its own i, so they print 0, 1, 2.');
  f.text(156, 26, 'for (var i …)', { anchor: 'middle', bold: true, mono: true, tone: 'fail' });
  f.box(96, 40, 120, 44, { tone: 'fail', solid: true, label: 'i = 3', mono: true });
  f.text(222, 66, '← shared', { size: 12, tone: 'muted' });
  [0, 1, 2].forEach((k) => {
    const x = 26 + k * 100;
    f.box(x, 150, 86, 34, { tone: 'muted', label: `callback ${k + 1}` });
    f.path(`M${x + 43} 150 L156 ${88}`, { tone: 'fail', arrow: true, dashed: true });
    f.box(x + 5, 214, 76, 32, { tone: 'fail', solid: true, label: 'prints 3' });
    f.path(`M${x + 43} 184 V214`, { tone: 'muted', arrow: true });
  });
  f.text(156, 278, 'They all read the same box, after the loop ended.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });

  f.line(320, 20, 320, 280, { tone: 'muted', dashed: true });

  f.text(480, 26, 'for (let i …)', { anchor: 'middle', bold: true, mono: true, tone: 'pass' });
  [0, 1, 2].forEach((k) => {
    const x = 350 + k * 100;
    f.box(x, 40, 84, 44, { tone: 'pass', solid: true, label: `i = ${k}`, mono: true });
    f.box(x, 150, 84, 34, { tone: 'muted', label: `callback ${k + 1}` });
    f.path(`M${x + 42} 150 V84`, { tone: 'pass', arrow: true, dashed: true });
    f.box(x + 4, 214, 76, 32, { tone: 'pass', solid: true, label: `prints ${k}` });
    f.path(`M${x + 42} 184 V214`, { tone: 'muted', arrow: true });
  });
  f.text(480, 278, 'Each callback keeps its own copy.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── React: state, events, forms ───────────────────────── */

const reactLoop: FigureBuilder = () => {
  const f = new Fig(W, 240, 'The React loop: state is turned into UI by rendering, the user does something, an event handler calls setState, and React renders again.');
  f.box(20, 70, 130, 64, { tone: 'info', label: 'State', sub: 'count = 0' });
  f.box(255, 70, 130, 64, { tone: 'pass', label: 'Screen (UI)', sub: 'Count: 0' });
  f.box(490, 70, 130, 64, { tone: 'accent', label: 'Event', sub: 'onClick' });
  f.path('M150 102 H255', { arrow: true, tone: 'ink', width: 2 });
  f.path('M385 102 H490', { arrow: true, tone: 'ink', width: 2 });
  f.path('M555 136 V196 H85 V136', { arrow: true, tone: 'accent', width: 2 });
  f.text(202, 92, 'render', { anchor: 'middle', size: 12.5, bold: true });
  f.text(437, 92, 'user acts', { anchor: 'middle', size: 12.5, bold: true });
  f.text(320, 216, 'setCount(count + 1)  →  React renders again with the new state', { anchor: 'middle', size: 12.5, tone: 'accent', bold: true });
  f.num(28, 82, 1); f.num(263, 82, 2); f.num(498, 82, 3);
  f.packet('M20 102 H150 H255 H385 H490 H555 V196 H85 V102', 6, 'accent');
  f.text(W / 2, 34, 'UI is a function of state: change the state, never the screen.', { anchor: 'middle', size: 13.5, tone: 'muted', italic: true });
  return f;
};

const stateSnapshot: FigureBuilder = () => {
  const f = new Fig(W, 280, 'During one render, count is a fixed snapshot of 0. Three calls to setCount(count + 1) all compute 0 + 1, so the next render has count 1, not 3.');
  f.box(16, 30, 330, 200, { tone: 'info' });
  f.text(52, 56, 'Render #1 — count is 0 (frozen)', { bold: true, tone: 'info' });
  f.text(32, 92, 'setCount(count + 1)', { mono: true });
  f.text(236, 92, '// 0 + 1', { mono: true, tone: 'muted', size: 12.5 });
  f.text(32, 120, 'setCount(count + 1)', { mono: true });
  f.text(236, 120, '// 0 + 1', { mono: true, tone: 'muted', size: 12.5 });
  f.text(32, 148, 'setCount(count + 1)', { mono: true });
  f.text(236, 148, '// 0 + 1', { mono: true, tone: 'muted', size: 12.5 });
  f.text(32, 186, 'Every line reads the same old 0.', { size: 13, tone: 'fail', bold: true });
  f.text(32, 208, 'Last write wins: the state becomes 1.', { size: 13, tone: 'muted' });
  f.path('M350 130 H420', { arrow: true, tone: 'accent', width: 2 });
  f.box(426, 76, 198, 110, { tone: 'pass' });
  f.text(525, 106, 'Render #2', { anchor: 'middle', bold: true, tone: 'pass' });
  f.text(525, 138, 'count is 1', { anchor: 'middle', mono: true, size: 16 });
  f.text(525, 166, 'not 3!', { anchor: 'middle', tone: 'fail', bold: true });
  f.num(28, 44, 1); f.num(438, 88, 2);
  f.text(W / 2, 262, 'Fix: setCount(c => c + 1) — the function form always gets the latest value.', { anchor: 'middle', size: 13, tone: 'accent', bold: true });
  return f;
};

const controlledInput: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A controlled input: the user types, onChange fires, the handler saves the text in state, React renders and gives the input its value from state.');
  f.box(20, 30, 270, 70, { tone: 'ink', label: '① User types "a"', sub: '<input value={text} />', mono: true });
  f.box(350, 30, 270, 70, { tone: 'accent', label: '② onChange fires', sub: 'e.target.value = "a"', mono: true });
  f.box(350, 160, 270, 70, { tone: 'info', label: '③ setText("a")', sub: 'state: text = "a"', mono: true });
  f.box(20, 160, 270, 70, { tone: 'pass', label: '④ Render again', sub: 'value={text} → "a"', mono: true });
  f.path('M290 65 H350', { arrow: true, width: 2 });
  f.path('M485 100 V160', { arrow: true, width: 2 });
  f.path('M350 195 H290', { arrow: true, width: 2 });
  f.path('M155 160 V100', { arrow: true, width: 2, dashed: true });
  f.packet('M290 65 H350 M485 100 V160', 3, 'accent');
  f.text(W / 2, 132, 'the state is the single source of truth', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  f.text(W / 2, 256, 'If you never call setText, the input cannot change — React keeps putting the old value back.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const liftStateUp: FigureBuilder = () => {
  const f = new Fig(W, 320, 'Left: two sibling components each keep their own copy of a value and cannot share it. Right: the parent owns the state, passes it down as props, and children send changes up with callbacks.');
  f.text(150, 24, 'Before: two copies', { anchor: 'middle', bold: true, tone: 'fail' });
  f.box(20, 50, 120, 70, { tone: 'fail', label: 'List', sub: 'selected = 2' });
  f.box(170, 50, 120, 70, { tone: 'fail', label: 'Detail', sub: 'selected = ?' });
  f.path('M140 85 H170', { tone: 'fail', dashed: true });
  f.text(150, 150, '✗', { anchor: 'middle', size: 22, tone: 'fail', bold: true });
  f.text(150, 176, 'Siblings cannot see', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(150, 194, "each other's state.", { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.line(300, 20, 300, 300, { tone: 'muted', dashed: true });

  f.text(480, 24, 'After: the parent owns it', { anchor: 'middle', bold: true, tone: 'pass' });
  f.box(400, 44, 160, 58, { tone: 'info', label: 'App', sub: 'selected = 2' });
  f.box(340, 200, 120, 58, { tone: 'ink', label: 'List' });
  f.box(500, 200, 120, 58, { tone: 'ink', label: 'Detail' });
  f.path('M430 102 L400 200', { arrow: true, tone: 'pass', width: 2 });
  f.path('M530 102 L560 200', { arrow: true, tone: 'pass', width: 2 });
  f.text(436, 162, 'props ↓', { size: 12.5, tone: 'pass', bold: true });
  f.text(566, 150, 'props ↓', { size: 12.5, tone: 'pass', bold: true });
  f.path('M372 200 L402 102', { arrow: true, tone: 'accent', dashed: true });
  f.text(376, 128, 'onSelect ↑', { anchor: 'end', size: 12.5, tone: 'accent', bold: true });
  f.num(412, 54, 1); f.num(352, 212, 2);
  f.text(480, 292, 'Data flows down, events flow up.', { anchor: 'middle', size: 13, tone: 'muted', italic: true });
  return f;
};

const immutableUpdate: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Left: pushing into the same array and passing it back to setState gives React the same reference, so it sees no change. Right: building a new array gives a new reference, so React re-renders.');
  f.text(158, 26, 'Mutate (React shrugs)', { anchor: 'middle', bold: true, tone: 'fail' });
  f.text(158, 54, 'items.push(x); setItems(items)', { anchor: 'middle', mono: true, size: 12 });
  f.box(40, 76, 236, 50, { tone: 'fail', label: 'array #101  [a, b, x]', mono: true });
  f.text(158, 150, 'before: array #101', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(158, 170, 'after:  array #101', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.box(58, 192, 200, 44, { tone: 'fail', solid: true, label: 'same → no re-render', mono: true });
  f.line(320, 20, 320, 260, { tone: 'muted', dashed: true });
  f.text(480, 26, 'Copy (React notices)', { anchor: 'middle', bold: true, tone: 'pass' });
  f.text(480, 54, 'setItems([...items, x])', { anchor: 'middle', mono: true, size: 12 });
  f.box(362, 76, 236, 50, { tone: 'pass', label: 'array #202  [a, b, x]', mono: true });
  f.text(480, 150, 'before: array #101', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(480, 170, 'after:  array #202', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.box(380, 192, 200, 44, { tone: 'pass', solid: true, label: 'new → re-render', mono: true });
  f.text(W / 2, 266, 'React compares references (===), not contents.', { anchor: 'middle', size: 13, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── Promises ───────────────────────── */

const promiseStates: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A promise starts pending. It then settles exactly once: either fulfilled with a value or rejected with a reason. After that it never changes.');
  f.box(20, 80, 150, 70, { tone: 'muted', label: 'pending', sub: 'still waiting' });
  f.box(430, 26, 190, 70, { tone: 'pass', label: 'fulfilled', sub: 'has a value' });
  f.box(430, 138, 190, 70, { tone: 'fail', label: 'rejected', sub: 'has a reason (error)' });
  f.path('M170 100 L430 62', { arrow: true, tone: 'pass', width: 2 });
  f.path('M170 130 L430 172', { arrow: true, tone: 'fail', width: 2 });
  f.text(298, 70, 'resolve(value)', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true, mono: true });
  f.text(298, 188, 'reject(error)', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true, mono: true });
  f.box(20, 168, 150, 54, { tone: 'muted', dashed: true });
  f.text(95, 190, 'settled = done.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(95, 208, 'It never changes again.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(525, 114, '→ .then(cb) runs', { anchor: 'middle', size: 12.5, tone: 'pass', mono: true });
  f.text(525, 226, '→ .catch(cb) runs', { anchor: 'middle', size: 12.5, tone: 'fail', mono: true });
  f.num(28, 92, 1); f.num(438, 38, 2); f.num(438, 150, 3);
  f.packet('M170 100 L430 62', 2.4, 'pass');
  return f;
};

const promiseChain: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A promise chain: each then receives the previous result and returns a new promise. A rejection skips ahead to the nearest catch.');
  const xs = [14, 174, 334, 494];
  const labels: [string, string][] = [['fetchUser()', 'returns a promise'], ['.then', 'getPosts'], ['.then', 'render'], ['.catch', 'show the error']];
  const tones = ['info', 'ink', 'ink', 'fail'] as const;
  xs.forEach((x, i) => {
    f.box(x, 70, 124, 56, { tone: tones[i], label: labels[i][0], sub: labels[i][1], mono: true });
    f.num(x + 10, 82 - 6, i + 1);
  });
  [0, 1].forEach((i) => f.path(`M${xs[i] + 124} 98 H${xs[i + 1]}`, { arrow: true, tone: 'pass', width: 2 }));
  f.path(`M${xs[2] + 124} 98 H${xs[3]}`, { arrow: true, tone: 'muted', dashed: true });
  f.text(xs[0] + 142, 120, 'user', { anchor: 'middle', size: 10, tone: 'pass', mono: true });
  f.text(xs[1] + 142, 120, 'posts', { anchor: 'middle', size: 10, tone: 'pass', mono: true });
  f.path(`M${xs[0] + 62} 126 V176 H${xs[3] + 62} V126`, { arrow: true, tone: 'fail', dashed: true, width: 1.6 });
  f.text(320, 196, 'if ANY step throws or rejects, jump here', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.packet('M14 98 H138 H174 H298 H334 H458', 4, 'pass');
  f.text(320, 40, 'Each .then hands its result to the next one.', { anchor: 'middle', size: 13.5, tone: 'muted', italic: true });
  f.text(320, 236, 'The chain skips every .then between the error and the .catch.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const forgotReturn: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Left: a then callback that forgets to return the inner promise hands undefined to the next step, which runs too early. Right: returning the promise makes the chain wait for it.');
  f.text(156, 24, 'Forgot to return', { anchor: 'middle', bold: true, tone: 'fail' });
  f.text(156, 50, '.then(() => { fetchPosts() })', { anchor: 'middle', mono: true, size: 12 });
  f.box(40, 70, 232, 40, { tone: 'fail', label: 'callback returns undefined', mono: true });
  f.path('M156 110 V140', { arrow: true, tone: 'fail', width: 2 });
  f.box(40, 140, 232, 44, { tone: 'fail', solid: true, label: 'next .then runs NOW', mono: true });
  f.text(156, 210, 'gets undefined, not the posts', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.text(156, 230, '(fetchPosts is still running)', { anchor: 'middle', size: 12, tone: 'muted' });
  f.line(320, 20, 320, 280, { tone: 'muted', dashed: true });
  f.text(480, 24, 'Returned the promise', { anchor: 'middle', bold: true, tone: 'pass' });
  f.text(480, 50, '.then(() => fetchPosts())', { anchor: 'middle', mono: true, size: 12 });
  f.box(364, 70, 232, 40, { tone: 'pass', label: 'callback returns a promise', mono: true });
  f.path('M480 110 V140', { arrow: true, tone: 'pass', width: 2 });
  f.box(364, 140, 232, 44, { tone: 'pass', solid: true, label: 'next .then WAITS', mono: true });
  f.text(480, 210, 'gets the real posts', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.text(480, 230, 'once fetchPosts settles', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 270, 'Rule of thumb: inside .then, always return (or await) the next async thing.', { anchor: 'middle', size: 13, tone: 'muted', italic: true });
  return f;
};

const combinators: FigureBuilder = () => {
  const f = new Fig(W, 360, 'Three promises on a timeline: A succeeds at 100 milliseconds, C fails at 200, B succeeds at 300. Promise.all rejects at 200, allSettled finishes at 300 with everything, race takes the first to settle (A), any takes the first success (A).');
  const x0 = 120, per = 1.5; // px per ms
  const at = (ms: number) => x0 + ms * per;
  f.text(20, 26, 'time →', { size: 12.5, tone: 'muted' });
  [0, 100, 200, 300].forEach((ms) => {
    f.line(at(ms), 34, at(ms), 170, { tone: 'muted', dashed: true, width: 1 });
    f.text(at(ms), 186, `${ms}ms`, { anchor: 'middle', size: 11.5, tone: 'muted', mono: true });
  });
  const lanes: [string, number, 'pass' | 'fail'][] = [['A', 100, 'pass'], ['C', 200, 'fail'], ['B', 300, 'pass']];
  lanes.forEach(([name, ms, tone], i) => {
    const y = 44 + i * 40;
    f.text(28, y + 22, `promise ${name}`, { mono: true, size: 13 });
    f.box(x0, y + 6, ms * per, 24, { tone, solid: true, r: 12 });
    f.text(at(ms) + 10, y + 23, tone === 'pass' ? '✓ value' : '✗ error', { size: 12.5, tone, bold: true });
  });
  const rows: [string, string, string][] = [
    ['Promise.all', 'rejects at 200ms', 'first failure wins; results are lost'],
    ['Promise.allSettled', 'fulfils at 300ms', 'waits for all; reports each outcome'],
    ['Promise.race', 'fulfils at 100ms with A', 'first to settle, success or fail'],
    ['Promise.any', 'fulfils at 100ms with A', 'first SUCCESS, ignores failures'],
  ];
  rows.forEach(([n, r, why], i) => {
    const y = 210 + i * 34;
    f.text(20, y + 16, n, { mono: true, bold: true, size: 13 });
    f.text(190, y + 16, r, { size: 13, tone: r.includes('rejects') ? 'fail' : 'pass', bold: true });
    f.text(380, y + 16, why, { size: 12, tone: 'muted' });
  });
  return f;
};

export const figureBuilders: Record<string, FigureBuilder> = {
  ...jsFigures,
  ...tsFigures,
  ...reactFigures,
  ...prodFigures,
  ...interviewFigures,
  ...webFigures,
  ...systemFigures,
  ...dsFigures,
  ...algoFigures,
  ...testingFigures,
  ...patternFigures,
  ...securityFigures,
  ...nodeFigures,
  ...renderingFigures,
  'closure-backpack': closureBackpack,
  'closure-alive': closureAlive,
  'scope-chain': scopeChain,
  'var-loop-trap': varLoopTrap,
  'react-loop': reactLoop,
  'state-snapshot': stateSnapshot,
  'controlled-input': controlledInput,
  'lift-state-up': liftStateUp,
  'immutable-update': immutableUpdate,
  'promise-states': promiseStates,
  'promise-chain': promiseChain,
  'forgot-return': forgotReturn,
  'promise-combinators': combinators,
};

const built = new Map<string, Figure>();
export function getFigure(id: string): Figure | undefined {
  let fig = built.get(id);
  if (!fig) {
    const b = figureBuilders[id];
    if (!b) return undefined;
    const f = b();
    fig = { svg: f.svg(), animated: f.animated };
    built.set(id, fig);
  }
  return fig;
}
