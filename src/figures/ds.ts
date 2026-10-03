import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 1 · Complexity & arrays ───────────────────────── */

const arrayMemory: FigureBuilder = () => {
  const f = new Fig(W, 210, 'An array is a row of equal-sized slots in one block of memory. The slot for index i is found by arithmetic: start address plus i times the slot size, so reading arr[i] takes the same time for any i.');
  const x0 = 40, w = 86;
  const vals = ['7', '3', '9', '4', '1', '8'];
  f.text(x0, 28, 'one contiguous block of memory', { size: 12.5, tone: 'muted', bold: true });
  vals.forEach((v, i) => {
    f.box(x0 + i * w, 44, w - 6, 52, { tone: i === 3 ? 'accent' : 'info', label: v, mono: true, size: 16, solid: i === 3 });
    f.text(x0 + i * w + (w - 6) / 2, 116, String(i), { anchor: 'middle', size: 12.5, mono: true, tone: i === 3 ? 'accent' : 'muted', bold: i === 3 });
  });
  f.text(x0 - 4, 134, 'index', { size: 11.5, tone: 'muted' });
  f.path(`M${x0 + 3 * w + 37} 180 V150`, { arrow: true, tone: 'accent', width: 2 });
  f.text(W / 2, 170, 'arr[3]  =  start + 3 × slot size', { anchor: 'middle', size: 13.5, mono: true, bold: true, tone: 'accent' });
  f.text(W / 2, 198, 'One multiplication, no searching: reading arr[i] costs the same for every i  →  O(1)', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const arrayGrowth: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A dynamic array doubles its capacity when it is full. Pushing a third item into a full array of capacity 2 allocates a new block of capacity 4, copies the two old items over, then adds the new one. Doubling keeps the total copying small, so push is amortised O(1).');
  const cell = (x: number, y: number, label: string, tone: Tone, solid = false) => f.box(x, y, 64, 44, { tone, label, mono: true, size: 14, solid, dashed: label === '' });
  f.text(20, 30, 'capacity 2, length 2  (full)', { size: 12.5, tone: 'muted', bold: true });
  cell(20, 42, 'a', 'info'); cell(88, 42, 'b', 'info');
  f.text(250, 70, 'push("c")  →  no room!', { size: 13, bold: true, tone: 'fail' });
  f.path('M84 96 V132', { arrow: true, tone: 'accent', width: 2 });
  f.text(100, 120, 'allocate 4, copy 2', { size: 12, tone: 'accent', bold: true });
  f.text(20, 160, 'capacity 4, length 3', { size: 12.5, tone: 'muted', bold: true });
  cell(20, 172, 'a', 'muted'); cell(88, 172, 'b', 'muted'); cell(156, 172, 'c', 'pass', true); cell(224, 172, '', 'muted');
  f.text(20, 236, 'copied (cost 2)', { size: 11.5, tone: 'muted' });
  f.text(156, 236, 'new', { size: 11.5, tone: 'pass', bold: true });
  f.text(224, 236, 'room for more', { size: 11.5, tone: 'muted' });
  f.lines(330, 190, ['Resizes happen at 2, 4, 8, 16…', 'Copies total < 2n over n pushes,', 'so the average push is O(1).'], { size: 12.5, tone: 'ink', gap: 20 });
  f.text(W / 2, 266, 'Amortised O(1): a rare O(n) copy, paid for by many cheap pushes.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const arrayCosts: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Costs of common array operations in JavaScript: reading by index and push or pop at the end are constant time; shift, unshift, inserting or removing in the middle, includes and indexOf are linear; binary search on a sorted array is logarithmic.');
  const rows: [string, string, string, Tone][] = [
    ['arr[i]', 'O(1)', 'arithmetic on the address', 'pass'],
    ['push / pop', 'O(1)*', 'at the end; * amortised', 'pass'],
    ['shift / unshift', 'O(n)', 'every item moves one slot', 'fail'],
    ['splice in the middle', 'O(n)', 'items after it shift', 'fail'],
    ['includes / indexOf', 'O(n)', 'may scan everything', 'fail'],
    ['binary search (sorted)', 'O(log n)', 'halve the range each step', 'info'],
  ];
  rows.forEach(([op, cost, why, tone], i) => {
    const y = 18 + i * 44;
    f.box(20, y, 200, 34, { tone: 'ink', label: op, mono: true, size: 12.5 });
    f.box(232, y, 96, 34, { tone, solid: true, label: cost, mono: true, size: 13 });
    f.text(344, y + 22, why, { size: 12.5, tone: 'muted' });
  });
  f.text(W / 2, 282, 'Hidden O(n) inside a loop is the classic accidental O(n²).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const binarySearchHalving: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Binary search for 23 in a sorted array of eight numbers. The first middle is 12, which is too small, so the left half is discarded. The second middle is 23, found. Each step halves the remaining range.');
  const vals = [2, 5, 8, 12, 16, 23, 38, 56];
  const x0 = 40, w = 70;
  const row = (y: number, lo: number, hi: number, mid: number, note: string, noteTone: Tone) => {
    vals.forEach((v, i) => {
      const inRange = i >= lo && i <= hi;
      f.box(x0 + i * w, y, w - 6, 40, { tone: i === mid ? 'accent' : inRange ? 'info' : 'muted', dashed: !inRange, solid: i === mid, label: String(v), mono: true, size: 14 });
    });
    f.text(x0, y + 62, `lo = ${lo}   hi = ${hi}   mid = ${mid}`, { size: 12, mono: true, tone: 'muted' });
    f.text(x0 + 300, y + 62, note, { size: 12.5, bold: true, tone: noteTone });
  };
  f.text(x0, 20, 'target = 23', { size: 13, mono: true, bold: true });
  row(32, 0, 7, 3, '12 < 23 → search the right half', 'fail');
  row(130, 4, 7, 5, '23 = 23 → found at index 5', 'pass');
  f.text(W / 2, 236, 'Each step halves the range: a million items need only about 20 steps  →  O(log n)', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

export const dsFigures: Record<string, FigureBuilder> = {
  'ds-array-memory': arrayMemory,
  'ds-array-growth': arrayGrowth,
  'ds-array-costs': arrayCosts,
  'ds-binary-search': binarySearchHalving,
};
