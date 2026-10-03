import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* A box centred on (cx, y) — keeps tree/row layouts easy to reason about. */
const cbox = (f: Fig, cx: number, y: number, w: number, label: string, o: { tone?: Tone; h?: number; sub?: string; solid?: boolean; mono?: boolean; size?: number; dashed?: boolean } = {}) =>
  f.box(Math.round(cx - w / 2), y, w, o.h ?? 34, { tone: o.tone ?? 'info', label, sub: o.sub, solid: o.solid, mono: o.mono ?? true, size: o.size ?? 12.5, dashed: o.dashed });

/* ───────────────────────── 1 · Recursion & divide and conquer ───────────────────────── */

const callStack: FigureBuilder = () => {
  const f = new Fig(W, 300, 'The call stack while computing factorial(3). factorial(3) calls factorial(2), which calls factorial(1), which calls factorial(0). The base case factorial(0) returns 1. Then the answers come back up: factorial(1) returns 1 times 1, factorial(2) returns 2 times 1, and factorial(3) returns 3 times 2, which is 6.');
  const frames: [string, string, string][] = [
    ['factorial(0)', 'base case: stop', 'returns 1'],
    ['factorial(1)', 'waiting for 1 × ?', '1 × 1 = 1'],
    ['factorial(2)', 'waiting for 2 × ?', '2 × 1 = 2'],
    ['factorial(3)', 'waiting for 3 × ?', '3 × 2 = 6'],
  ];
  f.text(40, 26, 'calls go down: each one waits', { size: 12.5, bold: true, tone: 'muted' });
  f.text(330, 26, 'answers come back up', { size: 12.5, bold: true, tone: 'muted' });
  frames.forEach(([name, sub, ret], i) => {
    const y = 44 + i * 50;
    f.box(40, y, 230, 42, { tone: i === 0 ? 'pass' : 'info', solid: i === 0, label: name, sub, mono: true, size: 13 });
    f.path(`M274 ${y + 21} H322`, { arrow: true, tone: 'accent', width: 2 });
    f.text(334, y + 26, ret, { size: 14, mono: true, bold: true, tone: i === 3 ? 'pass' : 'ink' });
  });
  f.text(40, 262, 'top of the stack = the call running now', { size: 12, tone: 'muted' });
  f.text(W / 2, 288, 'Each call keeps its own n. The base case is what stops the descent.', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

const fibTree: FigureBuilder = () => {
  const f = new Fig(W, 300, 'The call tree of naive fib(4). fib(4) calls fib(3) and fib(2); fib(3) calls fib(2) and fib(1); each fib(2) calls fib(1) and fib(0). fib(2) is computed twice and fib(1) three times, so the work doubles at each level: exponential time.');
  type N = [number, number, string, Tone?];
  const nodes: Record<string, N> = {
    a: [330, 18, 'fib(4)'], b: [190, 76, 'fib(3)'], c: [470, 76, 'fib(2)', 'fail'],
    d: [110, 134, 'fib(2)', 'fail'], e: [270, 134, 'fib(1)', 'accent'], g: [420, 134, 'fib(1)', 'accent'], h: [520, 134, 'fib(0)'],
    i: [70, 192, 'fib(1)', 'accent'], j: [150, 192, 'fib(0)'],
  };
  const edges: [string, string][] = [['a', 'b'], ['a', 'c'], ['b', 'd'], ['b', 'e'], ['c', 'g'], ['c', 'h'], ['d', 'i'], ['d', 'j']];
  edges.forEach(([p, c]) => f.line(nodes[p][0], nodes[p][1] + 30, nodes[c][0], nodes[c][1], { tone: 'muted', width: 1.6 }));
  Object.values(nodes).forEach(([x, y, l, tone]) => cbox(f, x, y, 62, l, { tone: tone ?? 'info', h: 30, size: 12 }));
  f.text(30, 252, 'fib(2) is solved twice, fib(1) three times: the same subproblems again and again.', { size: 12.5, tone: 'fail', bold: true });
  f.text(30, 274, 'Remember each answer the first time (memoise) and the tree collapses to n calls.', { size: 12.5, tone: 'pass', bold: true });
  return f;
};

const mergeSplit: FigureBuilder = () => {
  const f = new Fig(W, 320, 'Merge sort on 5, 2, 4, 1. Divide: split into 5,2 and 4,1, then into single items. Combine: merge 5 and 2 into 2,5; merge 4 and 1 into 1,4; merge those two sorted halves into 1,2,4,5. Splitting takes log n levels and each level of merging touches every item once.');
  f.text(10, 38, 'divide', { size: 12.5, bold: true, tone: 'muted' });
  f.text(10, 240, 'combine', { size: 12.5, bold: true, tone: 'muted' });
  cbox(f, 330, 14, 150, '5 2 4 1', { tone: 'ink', size: 14 });
  cbox(f, 215, 70, 110, '5 2'); cbox(f, 445, 70, 110, '4 1');
  [[160, '5'], [270, '2'], [390, '4'], [500, '1']].forEach(([x, l]) => cbox(f, x as number, 126, 64, l as string, { tone: 'muted' }));
  [[330, 48, 215, 70], [330, 48, 445, 70], [215, 104, 160, 126], [215, 104, 270, 126], [445, 104, 390, 126], [445, 104, 500, 126]].forEach(([x1, y1, x2, y2]) => f.line(x1, y1, x2, y2, { tone: 'muted', width: 1.5 }));
  cbox(f, 215, 190, 110, '2 5', { tone: 'accent' }); cbox(f, 445, 190, 110, '1 4', { tone: 'accent' });
  [[160, 160, 215, 190], [270, 160, 215, 190], [390, 160, 445, 190], [500, 160, 445, 190]].forEach(([x1, y1, x2, y2]) => f.line(x1, y1, x2, y2, { tone: 'accent', width: 1.5 }));
  cbox(f, 330, 250, 150, '1 2 4 5', { tone: 'pass', solid: true, size: 14 });
  [[215, 224, 330, 250], [445, 224, 330, 250]].forEach(([x1, y1, x2, y2]) => f.line(x1, y1, x2, y2, { tone: 'pass', width: 1.8 }));
  f.text(W / 2, 308, 'log₂ n levels of splitting; every merge level touches all n items: O(n log n).', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const fastPow: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Fast exponentiation. pow(2,10) calls pow(2,5), which calls pow(2,2), then pow(2,1), then pow(2,0) which is 1. Halving the exponent each time needs only about log base 2 of n calls. Coming back up, the results are 1, 2, 4, 32 and 1024.');
  const calls: [string, string][] = [['pow(2, 10)', 'even: square the half'], ['pow(2, 5)', 'odd: 2 × square'], ['pow(2, 2)', 'even: square the half'], ['pow(2, 1)', 'odd: 2 × square'], ['pow(2, 0)', 'base case → 1']];
  calls.forEach(([l, sub], i) => {
    const x = 8 + i * 126;
    f.box(x, 28, 116, 52, { tone: i === 4 ? 'pass' : 'info', solid: i === 4, label: l, sub, mono: true, size: 12 });
    if (i < 4) f.path(`M${x + 118} 54 H${x + 124}`, { arrow: true, width: 2 });
  });
  const results = ['1024', '32', '4', '2', '1'];
  results.forEach((r, i) => {
    const x = 8 + i * 126;
    f.box(x + 28, 132, 60, 36, { tone: i === 0 ? 'pass' : 'accent', solid: true, label: r, mono: true, size: 14 });
    if (i < 4) f.path(`M${x + 126 + 26} 150 H${x + 90}`, { arrow: true, tone: 'accent', width: 1.8 });
  });
  f.text(W / 2, 112, 'calls halve n …', { anchor: 'middle', size: 12.5, tone: 'muted', bold: true });
  f.text(W / 2, 192, '… answers multiply back up (squares and an extra × 2 on odd steps)', { anchor: 'middle', size: 12.5, tone: 'accent', bold: true });
  f.text(W / 2, 228, '10 → 5 → 2 → 1 → 0: about log₂ n calls instead of n multiplications.', { anchor: 'middle', size: 12.5 });
  return f;
};

export const algoFigures: Record<string, FigureBuilder> = {
  'alg-call-stack': callStack,
  'alg-fib-tree': fibTree,
  'alg-merge-split': mergeSplit,
  'alg-fast-pow': fastPow,
};
