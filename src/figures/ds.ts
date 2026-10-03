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
  const f = new Fig(W, 306, 'Costs of common array operations in JavaScript: reading by index and push or pop at the end are constant time; shift, unshift, inserting or removing in the middle, includes and indexOf are linear; binary search on a sorted array is logarithmic.');
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
  f.text(W / 2, 298, 'Hidden O(n) inside a loop is the classic accidental O(n²).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
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

/* ───────────────────────── 2 · Hash tables ───────────────────────── */

const hashPipeline: FigureBuilder = () => {
  const f = new Fig(W, 170, 'A hash table turns a key into a bucket number in two steps: a hash function turns the key into a big number, then modulo the number of buckets picks a bucket. The key "ant" has character codes summing to 323, and 323 mod 4 is 3, so it goes in bucket 3.');
  const steps: [string, string, Tone][] = [['"ant"', 'the key', 'ink'], ['hash(key)', 'chars add up to 323', 'info'], ['323 mod 4', '= 3', 'accent'], ['bucket 3', 'store it here', 'pass']];
  steps.forEach(([label, sub, tone], i) => {
    const x = 20 + i * 150;
    f.box(x, 24, 126, 62, { tone, label, sub, mono: true, size: 14 });
    if (i < 3) f.path(`M${x + 128} 55 H${x + 148}`, { arrow: true, width: 2 });
  });
  f.text(W / 2, 120, 'The same key always lands in the same bucket, so a lookup repeats the same two steps.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(W / 2, 144, 'Different keys can land in the same bucket: that is a collision.', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  return f;
};

const hashChain: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A hash table with four buckets using chaining. Bucket 0 holds bee, bucket 1 holds cow, bucket 2 holds eel, and bucket 3 holds a chain of two entries, ant then tan, because both hash to 3. A lookup hashes the key, goes to its bucket and walks the short chain comparing keys.');
  const rows: [string[], Tone][] = [[['bee'], 'info'], [['cow'], 'info'], [['eel'], 'info'], [['ant', 'tan'], 'fail']];
  f.text(20, 18, 'buckets', { size: 12, tone: 'muted', bold: true });
  rows.forEach(([chain, tone], i) => {
    const y = 28 + i * 48;
    f.box(20, y, 56, 38, { tone: 'ink', label: String(i), mono: true, size: 14 });
    chain.forEach((k, j) => {
      const x = 112 + j * 120;
      f.path(`M${x - (j === 0 ? 34 : 30)} ${y + 19} H${x - 2}`, { arrow: true, tone: 'muted' });
      f.box(x, y, 90, 38, { tone, solid: true, label: k, mono: true, size: 13 });
    });
  });
  f.text(360, 186, 'collision: "ant" and "tan" both hash to 3', { size: 12.5, tone: 'fail', bold: true });
  f.lines(360, 70, ['Lookup of "tan":', '1. hash → bucket 3', '2. walk the chain: ant? no, tan? yes'], { size: 12.5, tone: 'muted', gap: 20 });
  f.text(W / 2, 238, 'With good hashing and room to spare, chains stay about 1 long, so lookups are O(1) on average.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const hashResize: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Resizing a hash table. Four buckets holding four entries have a load factor of 1.0 and one bucket has a chain of two. Doubling to eight buckets and rehashing every key spreads the entries out so each bucket holds at most one.');
  const row = (y: number, counts: number[], title: string) => {
    f.text(20, y - 8, title, { size: 12.5, tone: 'muted', bold: true });
    const w = Math.min(70, 560 / counts.length);
    counts.forEach((c, i) => f.box(20 + i * (w + 6), y, w, 44, { tone: c > 1 ? 'fail' : c === 1 ? 'info' : 'muted', dashed: c === 0, solid: c > 0, label: c ? String(c) : '', mono: true, size: 15 }));
  };
  row(34, [1, 0, 1, 2], 'before: 4 buckets, 4 entries  →  load factor 4 / 4 = 1.0');
  f.path('M60 94 V138', { arrow: true, tone: 'accent', width: 2 });
  f.text(76, 122, 'double the buckets, then hash every key again (index = hash mod 8)', { size: 12.5, tone: 'accent', bold: true });
  row(166, [1, 0, 0, 1, 0, 1, 0, 1], 'after: 8 buckets, 4 entries  →  load factor 0.5');
  f.text(W / 2, 252, 'Rule of thumb: when size / buckets goes above about 0.75, double and rehash.', { anchor: 'middle', size: 12.5, tone: 'ink' });
  f.text(W / 2, 274, 'One resize is O(n), but they are rare, so insert stays amortised O(1) (like a dynamic array).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const mapVsObject: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Map versus plain object as a dictionary. Map keys can be any value and it keeps insertion order, has a size property and no inherited keys. A plain object only has string and symbol keys, orders integer-like keys first, has no size, and inherits keys like toString and __proto__.');
  const rows: [string, string, string][] = [
    ['keys', 'any value (objects too)', 'strings and symbols only'],
    ['order', 'insertion order', 'integer-like keys first'],
    ['size', 'map.size', 'Object.keys(o).length'],
    ['inherited keys', 'none', '"toString", "__proto__"…'],
    ['frequent add / delete', 'built for it', 'works, but not the goal'],
  ];
  f.text(176 + 140, 26, 'Map', { anchor: 'middle', size: 14, bold: true, tone: 'pass' });
  f.text(404 + 110, 26, 'plain object', { anchor: 'middle', size: 14, bold: true, tone: 'fail' });
  rows.forEach(([label, a, b], i) => {
    const y = 38 + i * 44;
    f.box(16, y, 150, 36, { tone: 'ink', label, size: 12.5 });
    f.box(176, y, 220, 36, { tone: 'pass', label: a, size: 12.5 });
    f.box(404, y, 220, 36, { tone: 'fail', label: b, size: 12.5 });
  });
  f.text(W / 2, 262, 'Use a Map for lookups by arbitrary keys; keep objects for fixed, known fields.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const dsFigures: Record<string, FigureBuilder> = {
  'ds-array-memory': arrayMemory,
  'ds-array-growth': arrayGrowth,
  'ds-array-costs': arrayCosts,
  'ds-binary-search': binarySearchHalving,
  'ds-hash-pipeline': hashPipeline,
  'ds-hash-chain': hashChain,
  'ds-hash-resize': hashResize,
  'ds-map-vs-object': mapVsObject,
};
