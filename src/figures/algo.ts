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

/* ───────────────────────── 2 · Two pointers & sliding windows ───────────────────────── */

const twoPointers: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Two pointers on the sorted array 1, 3, 4, 6, 8, 11 with target 10. lo starts at the left end and hi at the right end. The sum 1 plus 11 is 12, bigger than the target, so the right value is too big and hi moves left. If the sum were smaller than the target, lo would move right. Each step discards one value for good.');
  const vals = [1, 3, 4, 6, 8, 11];
  const x0 = 48, step = 92;
  f.text(W / 2, 26, 'target = 10        lo + hi = 1 + 11 = 12  >  10  →  too big: move hi left', { anchor: 'middle', size: 12.5, mono: true, bold: true });
  vals.forEach((v, i) => f.box(x0 + i * step, 46, 80, 44, { tone: i === 0 ? 'accent' : i === 5 ? 'fail' : 'info', solid: i === 0 || i === 5, label: String(v), mono: true, size: 16 }));
  f.path(`M${x0 + 40} 134 V96`, { arrow: true, tone: 'accent', width: 2 });
  f.text(x0 + 40, 152, 'lo', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'accent' });
  f.path(`M${x0 + 5 * step + 40} 134 V96`, { arrow: true, tone: 'fail', width: 2 });
  f.text(x0 + 5 * step + 40, 152, 'hi', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'fail' });
  f.lines(48, 188, ['sum > target → the right value is too big for any partner: hi--', 'sum < target → the left value is too small for any partner: lo++', 'sum = target → found'], { size: 12.5, gap: 20 });
  f.text(W / 2, 262, 'Each step discards one value for good, so the scan is O(n), not O(n²).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const windowShape: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A sliding window over the string abcabcbb. The window is the range between a left pointer and a right pointer. Expanding moves right forward and adds the new item. Shrinking moves left forward while the window breaks the rule. The best valid window seen is recorded.');
  const letters = 'abcabcbb'.split('');
  const x0 = 36, step = 74;
  letters.forEach((c, i) => f.box(x0 + i * step, 56, 66, 44, { tone: i >= 2 && i <= 4 ? 'accent' : 'ink', solid: i >= 2 && i <= 4, label: c, mono: true, size: 17 }));
  f.box(x0 + 2 * step - 6, 48, 3 * step - 2, 60, { tone: 'accent', dashed: true, r: 12 });
  f.path(`M${x0 + 2 * step + 33} 146 V112`, { arrow: true, tone: 'accent', width: 2 });
  f.text(x0 + 2 * step + 33, 164, 'left', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'accent' });
  f.path(`M${x0 + 4 * step + 33} 146 V112`, { arrow: true, tone: 'accent', width: 2 });
  f.text(x0 + 4 * step + 33, 164, 'right', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'accent' });
  f.text(W / 2, 32, 'the window = everything from left to right (here "cab")', { anchor: 'middle', size: 12.5, tone: 'muted', bold: true });
  f.lines(36, 196, ['1. expand: move right forward and add the new item', '2. shrink: while the window breaks the rule, move left forward', '3. record: the window is valid now: update the best answer'], { size: 12.5, gap: 20 });
  f.text(W / 2, 256, 'left and right only ever move forward: at most 2n moves, so O(n).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const fixedVariable: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Fixed and variable windows. Fixed size 3 over 2, 1, 5, 1, 3, 2: the first window sums to 8; sliding one step adds 1 and drops 2, giving 8 minus 2 plus 1 equals 7, with no re-adding. Variable size over 2, 3, 1, 2, 4, 3 with target 7: the shortest window reaching 7 is 4 plus 3.');
  const x0 = 40, step = 70;
  const row = (y: number, vals: number[], from: number, to: number, note: string, tone: Tone) => {
    vals.forEach((v, i) => f.box(x0 + i * step, y, 62, 40, { tone: i >= from && i <= to ? tone : 'ink', solid: i >= from && i <= to, label: String(v), mono: true, size: 15 }));
    f.box(x0 + from * step - 5, y - 5, (to - from) * step + 72, 50, { tone, dashed: true, r: 12 });
    f.text(x0 + vals.length * step + 8, y + 25, note, { size: 12.5, mono: true, bold: true, tone });
  };
  f.text(x0, 24, 'fixed size k = 3: slide by one: add the new item, subtract the one that left', { size: 12, bold: true, tone: 'muted' });
  row(42, [2, 1, 5, 1, 3, 2], 0, 2, 'sum = 8', 'info');
  row(108, [2, 1, 5, 1, 3, 2], 1, 3, '8 − 2 + 1 = 7', 'accent');
  f.text(x0, 192, 'variable size (positive numbers, target 7): the shortest window that reaches 7', { size: 12, bold: true, tone: 'muted' });
  row(208, [2, 3, 1, 2, 4, 3], 4, 5, '4 + 3 = 7', 'pass');
  f.text(W / 2, 286, 'Never re-add the whole window: update the running total as items enter and leave.', { anchor: 'middle', size: 12.5, tone: 'ink' });
  return f;
};

/* ───────────────────────── 3 · Sorting, selection & binary search on the answer ───────────────────────── */

const sortThenSolve: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Meetings 0 to 30, 5 to 10 and 15 to 20 sorted by start time and drawn as bars on a timeline. After sorting, any clash must appear between neighbours: the meeting 5 to 10 starts before the previous one, 0 to 30, ends, so you cannot attend both.');
  const x0 = 40, k = 17;
  const bars: [string, number, number, Tone][] = [['[0, 30]', 0, 30, 'info'], ['[5, 10]', 5, 10, 'fail'], ['[15, 20]', 15, 20, 'info']];
  bars.forEach(([l, a, b, tone], i) => f.box(x0 + a * k, 28 + i * 40, (b - a) * k, 30, { tone, solid: true, label: l, mono: true, size: 12 }));
  [0, 10, 20, 30].forEach((t) => { f.line(x0 + t * k, 150, x0 + t * k, 156, { tone: 'muted' }); f.text(x0 + t * k, 172, String(t), { anchor: 'middle', size: 11, mono: true, tone: 'muted' }); });
  f.line(x0, 150, x0 + 30 * k, 150, { tone: 'muted' });
  f.box(x0 + 5 * k - 4, 22, 5 * k + 8, 74, { tone: 'fail', dashed: true, r: 10 });
  f.text(x0 + 11 * k, 56, '← starts at 5, before the previous meeting ends at 30', { size: 12, tone: 'fail', bold: true });
  f.lines(24, 206, ['Sorted by start time, a clash can only show up between neighbours:', 'compare each start with the previous end. No need to test every pair.'], { size: 12.5, gap: 20 });
  f.text(W / 2, 252, 'Sorting costs O(n log n) once; the scan is O(n). Versus O(n²) for all pairs.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const partitionStep: FigureBuilder = () => {
  const f = new Fig(W, 270, 'One partition step of quickselect on 7, 2, 9, 4, 3, 8, 5 with pivot 5. After partitioning, smaller items 2, 4, 3 are left of the pivot, the pivot 5 sits at index 3, and larger items 9, 8, 7 are on its right. To find the 3rd smallest, the pivot is the 4th smallest, so only the left part needs searching.');
  const x0 = 40, step = 78;
  const before = [7, 2, 9, 4, 3, 8, 5];
  const after: [number, Tone][] = [[2, 'info'], [4, 'info'], [3, 'info'], [5, 'accent'], [9, 'muted'], [8, 'muted'], [7, 'muted']];
  f.text(x0, 24, 'before: pick a pivot (here the last item, 5)', { size: 12.5, bold: true, tone: 'muted' });
  before.forEach((v, i) => f.box(x0 + i * step, 34, 70, 40, { tone: i === 6 ? 'accent' : 'ink', solid: i === 6, label: String(v), mono: true, size: 15 }));
  f.path('M320 82 V114', { arrow: true, tone: 'accent', width: 2 });
  f.text(334, 104, 'partition: smaller left, larger right', { size: 12.5, tone: 'accent', bold: true });
  f.text(x0, 134, 'after: the pivot is in its final sorted position (index 3)', { size: 12.5, bold: true, tone: 'muted' });
  after.forEach(([v, tone], i) => f.box(x0 + i * step, 144, 70, 40, { tone, solid: tone === 'accent', dashed: tone === 'muted', label: String(v), mono: true, size: 15 }));
  f.text(x0 + 110, 204, 'smaller', { anchor: 'middle', size: 12, tone: 'info', bold: true });
  f.text(x0 + 3 * step + 35, 204, 'pivot', { anchor: 'middle', size: 12, tone: 'accent', bold: true });
  f.text(x0 + 5 * step + 35, 204, 'larger', { anchor: 'middle', size: 12, tone: 'muted', bold: true });
  f.text(W / 2, 238, 'k = 3: the pivot is the 4th smallest, so the 3rd smallest is on the LEFT: ignore the right.', { anchor: 'middle', size: 12.5 });
  f.text(W / 2, 258, 'Each round throws away a part: about n + n/2 + n/4 + … = O(n) on average.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const dutchFlag: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The Dutch national flag partition of an array of 0s, 1s and 2s using three pointers. Everything left of lo is 0, everything from lo up to mid is 1, the part from mid to hi is still unknown, and everything right of hi is 2. The mid pointer sweeps the unknown part.');
  const cells: [string, Tone, boolean][] = [['0', 'info', false], ['0', 'info', false], ['0', 'info', false], ['1', 'pass', false], ['1', 'pass', false], ['?', 'muted', true], ['?', 'muted', true], ['?', 'muted', true], ['2', 'fail', false], ['2', 'fail', false]];
  const x0 = 22, step = 60;
  f.text(W / 2, 26, 'invariant (always true while sweeping)', { anchor: 'middle', size: 12.5, bold: true, tone: 'muted' });
  cells.forEach(([l, tone, dashed], i) => f.box(x0 + i * step, 44, 54, 44, { tone, dashed, solid: !dashed, label: l, mono: true, size: 17 }));
  const pointer = (i: number, label: string, tone: Tone) => { f.path(`M${x0 + i * step + 27} 138 V94`, { arrow: true, tone, width: 2 }); f.text(x0 + i * step + 27, 156, label, { anchor: 'middle', size: 13, mono: true, bold: true, tone }); };
  pointer(3, 'lo', 'pass'); pointer(5, 'mid', 'accent'); pointer(7, 'hi', 'fail');
  f.text(x0 + 3 * 60 - 30, 188, '0s', { anchor: 'middle', size: 12, bold: true, tone: 'info' });
  f.text(x0 + 4 * 60, 188, '1s', { anchor: 'middle', size: 12, bold: true, tone: 'pass' });
  f.text(x0 + 6 * 60 + 27, 188, 'not looked at yet', { anchor: 'middle', size: 12, bold: true, tone: 'muted' });
  f.text(x0 + 9 * 60 - 3, 188, '2s', { anchor: 'middle', size: 12, bold: true, tone: 'fail' });
  f.lines(24, 218, ['look at nums[mid]:  0 → swap with lo, lo++, mid++    1 → mid++    2 → swap with hi, hi--'], { size: 12, mono: true });
  f.text(W / 2, 256, 'One pass, no extra memory: every swap puts one item in its final region.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const bsAnswer: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Binary search on the answer. For eating speeds 1 to 11 bananas per hour, the question "is this speed fast enough to finish within 8 hours?" is no for speeds 1 to 3 and yes for speeds 4 to 11. Because the answers switch from no to yes exactly once, binary search finds the smallest yes.');
  const x0 = 16, step = 57;
  f.text(W / 2, 22, 'is speed k fast enough?  (piles 3, 6, 7, 11 within 8 hours)', { anchor: 'middle', size: 12.5, bold: true, tone: 'muted' });
  for (let k = 1; k <= 11; k++) {
    const ok = k >= 4;
    f.box(x0 + (k - 1) * step, 38, 51, 38, { tone: ok ? 'pass' : 'fail', solid: true, label: ok ? 'yes' : 'no', mono: true, size: 13 });
    f.text(x0 + (k - 1) * step + 25, 96, String(k), { anchor: 'middle', size: 13, mono: true, bold: k === 4, tone: k === 4 ? 'accent' : 'muted' });
  }
  f.path(`M${x0 + 3 * step + 25} 142 V106`, { arrow: true, tone: 'accent', width: 2 });
  f.text(x0 + 3 * step + 25, 160, 'answer: the first "yes"', { anchor: 'middle', size: 12.5, bold: true, tone: 'accent' });
  f.lines(24, 196, ['The answers flip from no to yes exactly once (monotone), so you can', 'binary search the speed itself: check the middle, discard the half that cannot hold the boundary.'], { size: 12.5, gap: 20 });
  f.text(W / 2, 250, 'Each check costs O(n); about log₂(max speed) checks: O(n log max).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 4 · Backtracking ───────────────────────── */

const backtrackCycle: FigureBuilder = () => {
  const f = new Fig(W, 240, 'The backtracking loop in three steps. Choose: add an option to the current path. Explore: recurse to build the rest of the answer. Un-choose: remove the option again so the next option starts from a clean slate. A dead end simply returns, and that return is the backtrack.');
  const steps: [string, string, Tone][] = [['1 · choose', 'path.push(option)', 'info'], ['2 · explore', 'backtrack(next)', 'accent'], ['3 · un-choose', 'path.pop()', 'pass']];
  steps.forEach(([l, sub, tone], i) => {
    const x = 20 + i * 214;
    f.box(x, 30, 190, 64, { tone, label: l, sub, mono: true, size: 14 });
    if (i < 2) f.path(`M${x + 192} 62 H${x + 212}`, { arrow: true, width: 2 });
  });
  f.path('M515 98 V130 H115 V100', { arrow: true, tone: 'muted', dashed: true, width: 1.8 });
  f.text(W / 2, 150, 'repeat for the next option', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  f.lines(24, 184, ['Every choice is undone, so each branch starts from the same clean state.', 'A dead end (no valid option) just returns: that return IS the backtrack.'], { size: 12.5, gap: 20 });
  f.text(W / 2, 232, 'Backtracking = depth-first search over the tree of all partial answers.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const subsetsTree: FigureBuilder = () => {
  const f = new Fig(W, 310, 'The decision tree for the subsets of 1, 2, 3. For each element you either take it or skip it, so there are two branches at each of three levels and eight leaves: {1,2,3}, {1,2}, {1,3}, {1}, {2,3}, {2}, {3} and the empty set. Backtracking walks this tree depth first.');
  const link = (x1: number, y1: number, x2: number, y2: number) => f.line(x1, y1, x2, y2, { tone: 'muted', width: 1.5 });
  cbox(f, 320, 14, 70, 'start', { tone: 'ink', h: 30 });
  [[160, 'take 1', 'info'], [480, 'skip 1', 'muted']].forEach(([x, l, tone]) => { cbox(f, x as number, 80, 90, l as string, { tone: tone as Tone, h: 30 }); link(320, 44, x as number, 80); });
  [[80, 'take 2', 160], [240, 'skip 2', 160], [400, 'take 2', 480], [560, 'skip 2', 480]].forEach(([x, l, px]) => { cbox(f, x as number, 146, 82, l as string, { tone: (l as string).startsWith('take') ? 'info' : 'muted', h: 30 }); link(px as number, 110, x as number, 146); });
  const leaves = ['{1,2,3}', '{1,2}', '{1,3}', '{1}', '{2,3}', '{2}', '{3}', '{ }'];
  leaves.forEach((l, i) => {
    const x = 42 + i * 80;
    cbox(f, x, 214, 74, l, { tone: 'pass', solid: true, h: 32, size: 11.5 });
    link([80, 80, 240, 240, 400, 400, 560, 560][i], 176, x, 214);
  });
  f.text(W / 2, 276, 'take or skip each of n items → 2ⁿ leaves: backtracking visits every one.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 298, 'Pruning (cutting a branch early) is what makes backtracking practical.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const queensDeadEnd: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A four-queens partial placement with queens in row 0 column 0 and row 1 column 2. Every square in row 2 is attacked: column 0 and column 2 by column, columns 1 and 3 by the diagonal from the row 1 queen. This is a dead end, so the search undoes the row 1 queen and tries its next column.');
  const x0 = 36, y0 = 24, c = 52;
  for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) {
    const queen = (r === 0 && col === 0) || (r === 1 && col === 2);
    const blocked = r === 2;
    f.box(x0 + col * c, y0 + r * c, c - 4, c - 4, { tone: queen ? 'accent' : blocked ? 'fail' : 'ink', solid: queen, dashed: blocked, label: queen ? 'Q' : blocked ? '×' : '', mono: true, size: 16 });
  }
  f.text(x0 + 4 * c + 28, 54, 'queens placed in rows 0 and 1', { size: 12.5, bold: true });
  f.text(x0 + 4 * c + 28, 112, 'row 2: every square is attacked', { size: 12.5, tone: 'fail', bold: true });
  f.lines(x0 + 4 * c + 28, 138, ['(same column or same diagonal as a queen)'], { size: 11.5, tone: 'muted' });
  f.text(x0 + 4 * c + 28, 170, 'dead end → backtrack:', { size: 12.5, tone: 'pass', bold: true });
  f.lines(x0 + 4 * c + 28, 190, ['undo the row-1 queen, try its next column', 'and keep going from there'], { size: 12, gap: 18 });
  f.text(W / 2, 260, 'Rejecting a partial answer early prunes the whole subtree below it.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 5 · Dynamic programming I ───────────────────────── */

const dpRecipe: FigureBuilder = () => {
  const f = new Fig(W, 280, 'The four-step dynamic programming recipe, shown with the house robber problem. 1 State: dp[i] is the best loot using houses 0 to i. 2 Recurrence: dp[i] is the maximum of dp[i-1] and dp[i-2] plus nums[i]. 3 Base cases: dp[0] is nums[0] and dp[1] is the larger of the first two. 4 Order and answer: fill left to right, the answer is the last entry.');
  const rows: [string, string, string, Tone][] = [
    ['1 · state', 'what does dp[i] mean?', 'dp[i] = best loot from houses 0 … i', 'info'],
    ['2 · recurrence', 'how do smaller answers combine?', 'dp[i] = max(dp[i−1], dp[i−2] + nums[i])', 'accent'],
    ['3 · base cases', 'what is obvious?', 'dp[0] = nums[0];  dp[1] = max(nums[0], nums[1])', 'pass'],
    ['4 · order + answer', 'small → big; where is the result?', 'fill left to right; answer = dp[n − 1]', 'ink'],
  ];
  f.text(16, 18, 'the recipe', { size: 12, bold: true, tone: 'muted' });
  f.text(266, 18, 'example: house robber (no two neighbouring houses)', { size: 12, bold: true, tone: 'muted' });
  rows.forEach(([name, q, ex, tone], i) => {
    const y = 28 + i * 58;
    f.box(16, y, 236, 48, { tone, solid: true, label: name, sub: q, size: 13 });
    f.path(`M254 ${y + 24} H264`, { arrow: true, tone: 'muted' });
    f.box(266, y, 358, 48, { tone: 'ink', label: ex, mono: true, size: 12 });
  });
  f.text(W / 2, 270, 'Every DP problem fits these four questions.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const dpFibTable: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A bottom-up table for Fibonacci: entries 0, 1, 1, 2, 3, 5, 8, 13 for indexes 0 to 7. Each entry is the sum of the two entries before it, so dp[7] is dp[6] plus dp[5], 8 plus 5, equal to 13. Each value is computed once, from answers already in the table.');
  const vals = [0, 1, 1, 2, 3, 5, 8, 13];
  const x0 = 40, step = 74;
  f.text(x0, 26, 'table, filled left to right (bottom-up)', { size: 12.5, bold: true, tone: 'muted' });
  vals.forEach((v, i) => {
    const tone: Tone = i === 7 ? 'pass' : i === 6 || i === 5 ? 'accent' : i < 2 ? 'ink' : 'info';
    f.box(x0 + i * step, 40, 64, 44, { tone, solid: i >= 5, label: String(v), mono: true, size: 16 });
    f.text(x0 + i * step + 32, 104, String(i), { anchor: 'middle', size: 12, mono: true, tone: 'muted' });
  });
  f.text(x0 + 32, 122, 'base cases', { size: 11.5, tone: 'muted' });
  [[6, 'accent'], [5, 'accent']].forEach(([i, tone]) => {
    const cx = x0 + (i as number) * step + 32;
    f.path(`M${cx} 130 V${i === 6 ? 168 : 182} H${x0 + 7 * step + 32 + (i === 6 ? 10 : -10)} V138`, { arrow: true, tone: tone as Tone, width: 1.8 });
  });
  f.text(W / 2, 214, 'dp[7] = dp[6] + dp[5] = 8 + 5 = 13', { anchor: 'middle', size: 14, mono: true, bold: true });
  f.text(W / 2, 242, 'Every value is computed once, from smaller answers already in the table: O(n), not O(2ⁿ).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const dpCoinTable: FigureBuilder = () => {
  const f = new Fig(W, 260, 'The coin change table for coins 1, 2, 5 and amounts 0 to 11. dp holds the fewest coins for each amount: 0, 1, 1, 2, 2, 1, 2, 2, 3, 3, 2, 3. To get dp[11], try each coin: dp[10] plus 1 equals 3 with coin 1, dp[9] plus 1 equals 4 with coin 2, dp[6] plus 1 equals 3 with coin 5. The minimum is 3.');
  const vals = [0, 1, 1, 2, 2, 1, 2, 2, 3, 3, 2, 3];
  const x0 = 16, step = 50;
  f.text(x0, 26, 'dp[a] = fewest coins that make amount a   (coins 1, 2, 5)', { size: 12.5, bold: true, tone: 'muted' });
  vals.forEach((v, a) => {
    const tone: Tone = a === 11 ? 'pass' : a === 10 || a === 9 || a === 6 ? 'accent' : 'info';
    f.box(x0 + a * step, 40, 44, 42, { tone, solid: tone !== 'info', label: String(v), mono: true, size: 15 });
    f.text(x0 + a * step + 22, 100, String(a), { anchor: 'middle', size: 11.5, mono: true, tone: 'muted' });
  });
  f.lines(24, 140, ['dp[11] = 1 + min( dp[11 − 1], dp[11 − 2], dp[11 − 5] )', '       = 1 + min( dp[10],     dp[9],      dp[6]     )', '       = 1 + min(   2,          3,          2       ) = 3'], { size: 12.5, mono: true, gap: 22 });
  f.text(W / 2, 238, 'Try every coin as the LAST coin used; the rest is a smaller, already-solved amount.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const dpRobber: FigureBuilder = () => {
  const f = new Fig(W, 260, 'House robber on 2, 7, 9, 3, 1. dp holds the best loot so far: 2, 7, 11, 11, 12. For house 2, dp[2] is the maximum of skipping it, dp[1] which is 7, and robbing it, dp[0] plus 9 which is 11, so 11.');
  const nums = [2, 7, 9, 3, 1], dp = [2, 7, 11, 11, 12];
  const x0 = 70, step = 100;
  f.text(8, 66, 'loot', { size: 12, tone: 'muted', bold: true });
  f.text(8, 146, 'best', { size: 12, tone: 'muted', bold: true });
  nums.forEach((v, i) => f.box(x0 + i * step, 40, 84, 40, { tone: i === 2 ? 'accent' : 'ink', solid: i === 2, label: String(v), mono: true, size: 16 }));
  dp.forEach((v, i) => f.box(x0 + i * step, 120, 84, 40, { tone: i === 2 ? 'pass' : i === 4 ? 'pass' : 'info', solid: i === 2 || i === 4, label: String(v), mono: true, size: 16 }));
  f.path(`M${x0 + 1 * step + 42} 118 L${x0 + 2 * step + 30} 90`, { arrow: true, tone: 'muted', dashed: true });
  f.path(`M${x0 + 0 * step + 42} 118 L${x0 + 2 * step + 10} 90`, { arrow: true, tone: 'accent', dashed: true });
  f.lines(24, 196, ['dp[2] = max( skip house 2: dp[1] = 7 ,  rob it: dp[0] + 9 = 11 ) = 11', 'the answer is the last entry: dp[4] = 12  (rob houses 0, 2 and 4: 2 + 9 + 1)'], { size: 12, mono: true, gap: 22 });
  f.text(W / 2, 250, 'Each entry only looks back two steps: you can keep just two variables.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 6 · Dynamic programming II ───────────────────────── */

const dpGridPaths: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The number of paths from the top-left corner to each cell of a four by five grid when you may only move right or down. The first row and first column are all 1. Every other cell is the sum of the cell above and the cell to its left: for example the cell with 6 is 3 from above plus 3 from the left.');
  const grid = [[1, 1, 1, 1, 1], [1, 2, 3, 4, 5], [1, 3, 6, 10, 15], [1, 4, 10, 20, 35]];
  const x0 = 24, y0 = 30, sx = 74, sy = 54;
  grid.forEach((row, r) => row.forEach((v, c) => {
    const tone: Tone = r === 2 && c === 2 ? 'pass' : (r === 1 && c === 2) || (r === 2 && c === 1) ? 'accent' : 'info';
    f.box(x0 + c * sx, y0 + r * sy, 64, 44, { tone, solid: tone !== 'info', label: String(v), mono: true, size: 16 });
  }));
  f.text(x0 + 4, 20, 'dp[r][c] = number of paths to cell (r, c)', { size: 12, bold: true, tone: 'muted' });
  f.lines(412, 66, ['paths to a cell =', 'paths from above', '+ paths from the left', '', 'dp[2][2] = dp[1][2] + dp[2][1]', '         = 3 + 3 = 6'], { size: 12.5, mono: true, gap: 20 });
  f.text(W / 2, 258, 'Two indexes make a table; each cell reads its neighbours above and to the left.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const dpLcsTable: FigureBuilder = () => {
  const f = new Fig(W, 312, 'The longest common subsequence table for abcde and ace. Rows are prefixes of abcde, columns are prefixes of ace. A match adds 1 to the diagonal cell; otherwise a cell takes the larger of the cell above and the cell to the left. The bottom-right cell is 3: the subsequence ace.');
  const A = ['∅', 'a', 'b', 'c', 'd', 'e'], B = ['∅', 'a', 'c', 'e'];
  const table = [[0, 0, 0, 0], [0, 1, 1, 1], [0, 1, 1, 1], [0, 1, 2, 2], [0, 1, 2, 2], [0, 1, 2, 3]];
  const x0 = 80, y0 = 50, sx = 58, sy = 38;
  B.forEach((ch, j) => f.text(x0 + j * sx + 26, 40, ch, { anchor: 'middle', size: 14, mono: true, bold: true, tone: 'accent' }));
  A.forEach((ch, i) => f.text(x0 - 14, y0 + i * sy + 24, ch, { anchor: 'end', size: 14, mono: true, bold: true, tone: 'accent' }));
  const matches = new Set(['1,1', '3,2', '5,3']);
  table.forEach((row, i) => row.forEach((v, j) => {
    const match = matches.has(`${i},${j}`);
    f.box(x0 + j * sx, y0 + i * sy, 52, 32, { tone: match ? 'pass' : i === 0 || j === 0 ? 'ink' : 'info', solid: match, label: String(v), mono: true, size: 14 });
  }));
  f.lines(336, 70, ['green = the letters match:', 'dp[i][j] = dp[i−1][j−1] + 1', '', 'otherwise take the better of', 'dp[i−1][j]  (drop a letter of a)', 'dp[i][j−1]  (drop a letter of b)', '', 'dp[5][3] = 3  →  "ace"'], { size: 12, mono: true, gap: 21 });
  f.text(16, 24, 'rows: prefixes of "abcde"   columns: prefixes of "ace"', { size: 12, bold: true, tone: 'muted' });
  return f;
};

const dpEditCell: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Edit distance: a cell depends on three neighbours. From the diagonal cell, replace or match the letter. From the cell above, delete a letter of a. From the cell to the left, insert a letter of b. The cell is one more than the cheapest of these, unless the letters are equal, when the diagonal is free.');
  const bx = (x: number, y: number, l: string, tone: Tone) => f.box(x, y, 140, 52, { tone, label: l, mono: true, size: 12.5, solid: tone === 'pass' });
  bx(30, 36, 'dp[i−1][j−1]', 'info'); bx(200, 36, 'dp[i−1][j]', 'info'); bx(30, 130, 'dp[i][j−1]', 'info'); bx(200, 130, 'dp[i][j]', 'pass');
  f.path('M150 92 L214 134', { arrow: true, tone: 'accent', width: 2 });
  f.path('M270 90 V126', { arrow: true, tone: 'fail', width: 2 });
  f.path('M172 156 H196', { arrow: true, tone: 'pass', width: 2 });
  f.text(344, 66, '↘ replace (or free match): +1 / +0', { size: 12.5, tone: 'accent', bold: true });
  f.text(344, 110, '↓ delete a letter of a: +1', { size: 12.5, tone: 'fail', bold: true });
  f.text(344, 156, '→ insert a letter of b: +1', { size: 12.5, tone: 'pass', bold: true });
  f.lines(30, 224, ['dp[i][j] = fewest edits turning the first i letters of a into the first j letters of b'], { size: 12, mono: true });
  f.text(W / 2, 250, 'If the two letters are equal the diagonal is free; else 1 + the cheapest of the three.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const dpSubsetSum: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Subset sum for items 1, 5, 11, 5 with target 11, shown as the set of reachable sums after each item. Start: only 0. After 1: 0 and 1. After 5: 0, 1, 5, 6. After 11: 0, 1, 5, 6, 11. After the last 5: 0, 1, 5, 6, 10, 11. Sum 11 is reachable, so the items can be split into two equal halves.');
  const rows: [string, number[]][] = [['start', [0]], ['+ 1', [0, 1]], ['+ 5', [0, 1, 5, 6]], ['+ 11', [0, 1, 5, 6, 11]], ['+ 5', [0, 1, 5, 6, 10, 11]]];
  const x0 = 70, sx = 46;
  f.text(8, 26, 'sum:', { size: 12, tone: 'muted', bold: true });
  for (let c = 0; c <= 11; c++) f.text(x0 + c * sx + 20, 26, String(c), { anchor: 'middle', size: 12, mono: true, tone: 'muted' });
  rows.forEach(([label, reach], r) => {
    const y = 38 + r * 42;
    f.text(8, y + 22, label, { size: 12.5, mono: true, bold: true });
    for (let c = 0; c <= 11; c++) {
      const on = reach.includes(c);
      f.box(x0 + c * sx, y, 40, 32, { tone: on ? (c === 11 ? 'pass' : 'accent') : 'muted', solid: on, dashed: !on, label: on ? '✓' : '', mono: true, size: 13 });
    }
  });
  f.text(W / 2, 266, 'reachable[s] after an item x: it was reachable before, or s − x was (take x). Target 11 is reachable → true.', { anchor: 'middle', size: 11.5, tone: 'ink' });
  f.text(W / 2, 284, 'For 0/1 choices, update sums from high to low so each item is used at most once.', { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 7 · Greedy & intervals ───────────────────────── */

const greedyVsDp: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Coins 1, 3 and 4 making amount 6. Greedy takes the biggest coin each time: 4, then 1, then 1, which is 3 coins. The best answer is 3 plus 3, only 2 coins. A locally best choice can ruin the global best, so greedy needs an argument that it is safe.');
  f.text(24, 28, 'amount 6, coins 1, 3, 4', { size: 13, bold: true, tone: 'muted' });
  f.text(24, 64, 'greedy: always the biggest coin that fits', { size: 12.5, bold: true, tone: 'fail' });
  ['4', '1', '1'].forEach((c, i) => f.box(24 + i * 84, 76, 74, 44, { tone: 'fail', solid: true, label: c, mono: true, size: 18 }));
  f.text(290, 104, '3 coins', { size: 15, bold: true, tone: 'fail' });
  f.text(24, 158, 'best: looks at all options (dynamic programming)', { size: 12.5, bold: true, tone: 'pass' });
  ['3', '3'].forEach((c, i) => f.box(24 + i * 84, 170, 74, 44, { tone: 'pass', solid: true, label: c, mono: true, size: 18 }));
  f.text(206, 198, '2 coins', { size: 15, bold: true, tone: 'pass' });
  f.lines(380, 90, ['greedy took 4 and got', 'stuck with a remainder', 'of 2 that needs two 1s.'], { size: 12, tone: 'muted', gap: 18 });
  f.text(W / 2, 252, 'Greedy is only safe when you can argue that its choice never hurts (an exchange argument).', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 272, 'Look for a counterexample first: one is enough to rule greedy out.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const intervalScheduling: FigureBuilder = () => {
  const f = new Fig(W, 330, 'Interval scheduling. Six meetings sorted by end time: 0 to 3, 2 to 5, 4 to 7, 1 to 9, 6 to 10 and 9 to 12. The greedy rule takes the earliest-ending meeting that starts after the last chosen one finishes. It chooses 0 to 3, 4 to 7 and 9 to 12, three meetings, and skips the others because they overlap a chosen meeting.');
  const x0 = 44, k = 44;
  const items: [number, number, boolean][] = [[0, 3, true], [2, 5, false], [4, 7, true], [1, 9, false], [6, 10, false], [9, 12, true]];
  f.text(x0, 18, 'sorted by END time; take a meeting if it starts at or after the last chosen end', { size: 12, bold: true, tone: 'muted' });
  items.forEach(([a, b, take], i) => {
    const y = 30 + i * 36;
    f.box(x0 + a * k, y, (b - a) * k - 2, 28, { tone: take ? 'pass' : 'fail', solid: take, dashed: !take, label: `[${a}, ${b}]  ${take ? 'take' : 'skip'}`, mono: true, size: 11.5 });
  });
  [0, 2, 4, 6, 8, 10, 12].forEach((t) => { f.line(x0 + t * k, 252, x0 + t * k, 258, { tone: 'muted' }); f.text(x0 + t * k, 274, String(t), { anchor: 'middle', size: 11, mono: true, tone: 'muted' }); });
  f.line(x0, 252, x0 + 12 * k, 252, { tone: 'muted' });
  f.text(W / 2, 306, 'The earliest finish leaves the most room for what follows: 3 meetings, the maximum.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 324, 'Sorting by START time instead would let a long meeting block many short ones.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const jumpReach: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Jump game on 2, 3, 1, 1, 4 where each number is the maximum jump from that index. Tracking the farthest reachable index as you scan gives 2 after index 0, 4 after index 1, and stays 4. The last index is 4, so it is reachable. If you ever stand at an index beyond the farthest reach, you are stuck.');
  const nums = [2, 3, 1, 1, 4], reach = [2, 4, 4, 4, 8];
  const x0 = 80, step = 100;
  f.text(8, 70, 'jump', { size: 12, bold: true, tone: 'muted' });
  f.text(8, 150, 'reach', { size: 12, bold: true, tone: 'muted' });
  f.text(x0, 28, 'index 0 … 4 (the goal is the last index, 4)', { size: 12, bold: true, tone: 'muted' });
  nums.forEach((v, i) => f.box(x0 + i * step, 42, 84, 42, { tone: i === 4 ? 'pass' : 'ink', solid: i === 4, label: String(v), mono: true, size: 16 }));
  reach.forEach((v, i) => f.box(x0 + i * step, 122, 84, 42, { tone: v >= 4 ? 'pass' : 'info', solid: v >= 4, label: String(v), mono: true, size: 16 }));
  f.text(x0, 112, 'farthest index reachable after looking at index i:   max(reach, i + nums[i])', { size: 11.5, mono: true, tone: 'muted' });
  f.lines(24, 200, ['reach ≥ last index (4) from index 1 on → the goal is reachable.', 'if i > reach at any point, you cannot even stand at i: stuck → false.'], { size: 12.5, gap: 20 });
  f.text(W / 2, 250, 'One pass, one number to remember: O(n).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const sweepRooms: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Counting meeting rooms by sweeping events in time order. Meetings 0 to 30, 5 to 10 and 15 to 20 give events plus one at 0, plus one at 5, minus one at 10, plus one at 15, minus one at 20, minus one at 30. The running count is 1, 2, 1, 2, 1, 0, so at most 2 rooms are needed at once.');
  const events: [string, number, number][] = [['+1 @ 0', 0, 1], ['+1 @ 5', 5, 2], ['−1 @ 10', 10, 1], ['+1 @ 15', 15, 2], ['−1 @ 20', 20, 1], ['−1 @ 30', 30, 0]];
  f.text(16, 24, 'events in time order (a meeting starts: +1 room, ends: −1 room)', { size: 12, bold: true, tone: 'muted' });
  events.forEach(([label, , count], i) => {
    const x = 16 + i * 102;
    f.box(x, 38, 94, 40, { tone: label.startsWith('+') ? 'info' : 'ink', label, mono: true, size: 12 });
    f.box(x + 17, 108, 60, 40, { tone: count === 2 ? 'accent' : 'ink', solid: count === 2, label: String(count), mono: true, size: 17 });
    f.path(`M${x + 47} 82 V104`, { arrow: true, tone: 'muted', width: 1.5 });
  });
  f.text(16, 102, 'rooms in use after each event', { size: 12, bold: true, tone: 'muted' });
  f.text(W / 2, 192, 'maximum running count = 2 rooms', { anchor: 'middle', size: 15, bold: true, tone: 'accent' });
  f.text(W / 2, 224, 'Process an end before a start at the same time (a room is free the moment a meeting ends).', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 252, 'Sort the starts and ends separately, then walk both: O(n log n).', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

/* ───────────────────────── 8 · Spotting the pattern ───────────────────────── */

const patternSignals: FigureBuilder = () => {
  const f = new Fig(W, 372, 'A guide from signals in a problem statement to the pattern to try: sorted input with a pair or triple, two pointers or binary search; longest or shortest contiguous run, sliding window or prefix sums; all combinations or placements, backtracking; count ways, min or max with choices, dynamic programming; fewest steps in an unweighted graph or grid, BFS; k largest or next smallest, a heap; intervals and scheduling, sort and greedy or sweep; are these connected, union-find or DFS; prefix queries and key lookups, trie or hash map.');
  const rows: [string, string, Tone][] = [
    ['sorted input; a pair or triple with a target', 'Two pointers · binary search', 'info'],
    ['longest / shortest / best contiguous run', 'Sliding window · prefix sums', 'info'],
    ['"all" combinations, orders, placements', 'Backtracking', 'accent'],
    ['count ways / min / max with choices', 'Dynamic programming', 'accent'],
    ['fewest steps (unweighted graph or grid)', 'BFS', 'pass'],
    ['k largest · next smallest · merge sorted', 'Heap', 'pass'],
    ['intervals, scheduling, "at most"', 'Sort + greedy · sweep', 'fail'],
    ['are these connected? groups?', 'Union-find · DFS', 'fail'],
    ['prefix queries · lookups by key', 'Trie · hash map', 'ink'],
  ];
  f.text(16, 18, 'a signal in the problem …', { size: 12, bold: true, tone: 'muted' });
  f.text(376, 18, '… suggests', { size: 12, bold: true, tone: 'muted' });
  rows.forEach(([sig, pat, tone], i) => {
    const y = 28 + i * 36;
    f.box(16, y, 336, 30, { tone: 'ink', label: sig, size: 12 });
    f.path(`M356 ${y + 15} H372`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(376, y, 248, 30, { tone, solid: tone !== 'ink', label: pat, size: 12 });
  });
  f.text(W / 2, 362, 'Signals narrow the field; the brute force and the examples confirm the pick.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const constraintsGuide: FigureBuilder = () => {
  const f = new Fig(W, 310, 'How the input size hints at the intended complexity. n up to 20 allows exponential work such as backtracking. n up to 500 allows cubic loops. n up to 5 000 allows quadratic. n up to 100 000 needs n log n: sorting, heaps, binary search, windows. n up to a million needs linear: one pass, hash maps, two pointers. Larger inputs need logarithmic or constant solutions: binary search on the answer or maths.');
  const rows: [string, string, string, Tone][] = [
    ['n ≤ 20', 'O(2ⁿ) · O(n!)', 'backtracking, bitmasks', 'fail'],
    ['n ≤ 500', 'O(n³)', 'three loops, small DP tables', 'accent'],
    ['n ≤ 5 000', 'O(n²)', 'pairwise DP, nested scans', 'accent'],
    ['n ≤ 100 000', 'O(n log n)', 'sort, heap, binary search, windows', 'info'],
    ['n ≤ 1 000 000', 'O(n)', 'one pass, hash map, two pointers', 'pass'],
    ['n ≥ 10⁹', 'O(log n) · O(1)', 'binary search on the answer, maths', 'pass'],
  ];
  f.text(16, 20, 'input size', { size: 12, bold: true, tone: 'muted' });
  f.text(152, 20, 'work you can afford', { size: 12, bold: true, tone: 'muted' });
  f.text(318, 20, 'typical tools', { size: 12, bold: true, tone: 'muted' });
  rows.forEach(([n, cost, tools, tone], i) => {
    const y = 30 + i * 40;
    f.box(16, y, 122, 32, { tone: 'ink', label: n, mono: true, size: 12.5 });
    f.box(146, y, 156, 32, { tone, solid: true, label: cost, mono: true, size: 12.5 });
    f.text(314, y + 21, tools, { size: 12, tone: 'ink' });
  });
  f.text(W / 2, 288, 'Read the constraints first: they tell you which row (and so which patterns) you are in.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 306, 'Roughly 10⁸ simple steps per second.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const bruteToPattern: FigureBuilder = () => {
  const f = new Fig(W, 290, 'From brute force to a pattern, twice. Longest substring without repeats: checking all substrings costs cubic time, extending from each start until a repeat is quadratic, and a sliding window with a last-seen map is linear. Pair with a target sum: trying every pair is quadratic, sorting then two pointers is n log n, and a hash map of seen values is linear.');
  const rows: [string, [string, string, Tone][]][] = [
    ['longest substring without repeats', [['all substrings, check each', 'O(n³)', 'fail'], ['extend from each start', 'O(n²)', 'accent'], ['window + last-seen map', 'O(n)', 'pass']]],
    ['two numbers that sum to a target', [['try every pair', 'O(n²)', 'fail'], ['sort, then two pointers', 'O(n log n)', 'accent'], ['hash map of seen values', 'O(n)', 'pass']]],
  ];
  rows.forEach(([title, steps], r) => {
    const y = 30 + r * 110;
    f.text(16, y - 8, title, { size: 12.5, bold: true, tone: 'muted' });
    steps.forEach(([label, cost, tone], i) => {
      const x = 16 + i * 208;
      f.box(x, y, 188, 58, { tone, solid: true, label, sub: cost, mono: false, size: 12.5 });
      if (i < 2) f.path(`M${x + 190} ${y + 29} H${x + 206}`, { arrow: true, tone: 'muted', width: 1.8 });
    });
  });
  f.text(W / 2, 258, 'Say the brute force out loud, find what it repeats, and let a pattern remove the repetition.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 278, 'Each arrow is one idea: a hash map, a sort, a window, a table, a heap.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const algoFigures: Record<string, FigureBuilder> = {
  'alg-call-stack': callStack,
  'alg-fib-tree': fibTree,
  'alg-merge-split': mergeSplit,
  'alg-fast-pow': fastPow,
  'alg-two-pointers': twoPointers,
  'alg-window-shape': windowShape,
  'alg-fixed-variable': fixedVariable,
  'alg-sort-then-solve': sortThenSolve,
  'alg-partition': partitionStep,
  'alg-dutch-flag': dutchFlag,
  'alg-bs-answer': bsAnswer,
  'alg-backtrack-cycle': backtrackCycle,
  'alg-subsets-tree': subsetsTree,
  'alg-queens-deadend': queensDeadEnd,
  'alg-dp-recipe': dpRecipe,
  'alg-dp-fib-table': dpFibTable,
  'alg-dp-coin-table': dpCoinTable,
  'alg-dp-robber': dpRobber,
  'alg-dp-grid-paths': dpGridPaths,
  'alg-dp-lcs-table': dpLcsTable,
  'alg-dp-edit-cell': dpEditCell,
  'alg-dp-subset-sum': dpSubsetSum,
  'alg-greedy-vs-dp': greedyVsDp,
  'alg-interval-scheduling': intervalScheduling,
  'alg-jump-reach': jumpReach,
  'alg-sweep-rooms': sweepRooms,
  'alg-pattern-signals': patternSignals,
  'alg-constraints': constraintsGuide,
  'alg-brute-to-pattern': bruteToPattern,
};
