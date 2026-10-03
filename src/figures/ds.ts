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
  const steps: [string, string, Tone][] = [['"ant"', 'the key', 'ink'], ['hash(key)', 'sum = 323', 'info'], ['323 mod 4', '= 3', 'accent'], ['bucket 3', 'store it here', 'pass']];
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

/* ───────────────────────── 3 · Stacks & queues ───────────────────────── */

const stackLifo: FigureBuilder = () => {
  const f = new Fig(W, 240, 'A stack is last-in, first-out. Items A, B and C are stacked with C on top. push(D) places D on top; pop() removes and returns C, the most recent item. Only the top is touched, so both are constant time.');
  const items: [string, number][] = [['A', 160], ['B', 116], ['C', 72]];
  items.forEach(([l, y], i) => f.box(200, y, 140, 40, { tone: i === 2 ? 'accent' : 'info', solid: i === 2, label: l, mono: true, size: 15 }));
  f.text(270, 214, 'bottom', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.text(356, 98, '← top', { size: 12.5, tone: 'accent', bold: true });
  f.path('M270 14 V66', { arrow: true, tone: 'pass', width: 2 });
  f.text(284, 38, 'push("D")', { size: 12.5, mono: true, tone: 'pass', bold: true });
  f.path('M344 90 H470', { arrow: true, tone: 'fail', width: 2 });
  f.text(412, 82, 'pop() → "C"', { size: 12.5, mono: true, tone: 'fail', bold: true, anchor: 'middle' });
  f.lines(20, 40, ['Last in,', 'first out', '(LIFO)'], { size: 13, bold: true, gap: 20 });
  f.text(470, 150, 'only the top is touched:', { size: 12, tone: 'muted' });
  f.text(470, 168, 'push and pop are O(1)', { size: 12, tone: 'muted' });
  return f;
};

const queueFifo: FigureBuilder = () => {
  const f = new Fig(W, 200, 'A queue is first-in, first-out. Items A, B and C wait in line with A at the front. enqueue(D) adds D at the back; dequeue() removes and returns A from the front.');
  ['A', 'B', 'C'].forEach((l, i) => f.box(150 + i * 100, 70, 90, 44, { tone: i === 0 ? 'accent' : 'info', solid: i === 0, label: l, mono: true, size: 15 }));
  f.text(195, 136, 'front', { anchor: 'middle', size: 12, tone: 'accent', bold: true });
  f.text(395, 136, 'back', { anchor: 'middle', size: 12, tone: 'muted', bold: true });
  f.path('M146 92 H24', { arrow: true, tone: 'fail', width: 2 });
  f.text(20, 70, 'dequeue() → "A"', { size: 12.5, mono: true, tone: 'fail', bold: true });
  f.path('M620 92 H494', { arrow: true, tone: 'pass', width: 2 });
  f.text(520, 70, 'enqueue("D")', { size: 12.5, mono: true, tone: 'pass', bold: true });
  f.text(W / 2, 30, 'First in, first out (FIFO): like a line at a café', { anchor: 'middle', size: 13, bold: true });
  f.text(W / 2, 176, 'Both ends are touched, so a good queue makes both O(1).', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const ringBuffer: FigureBuilder = () => {
  const f = new Fig(W, 300, 'A ring buffer of capacity 8 stored in a plain array that wraps around. Items a to e occupy slots 5, 6, 7, 0 and 1. The head index 5 marks the oldest item and the tail index 2 marks the next slot to write. Both advance with modulo, so nothing ever shifts.');
  const cx = 190, cy = 150, r = 102;
  const filled: Record<number, string> = { 5: 'a', 6: 'b', 7: 'c', 0: 'd', 1: 'e' };
  for (let i = 0; i < 8; i++) {
    const ang = (-90 + i * 45) * Math.PI / 180;
    const x = cx + r * Math.cos(ang), y = cy + r * Math.sin(ang);
    const label = filled[i];
    f.box(Math.round(x - 26), Math.round(y - 22), 52, 44, { tone: i === 5 ? 'accent' : i === 2 ? 'pass' : label ? 'info' : 'muted', dashed: !label, solid: i === 5 || i === 2, label: label ?? '', sub: String(i), mono: true, size: 14 });
  }
  f.lines(360, 70, ['head = 5   (oldest: "a")', 'tail = 2   (next write)'], { size: 13, mono: true, bold: true, gap: 24 });
  f.lines(360, 140, ['write:  buffer[tail] = x', '        tail = (tail + 1) % 8', 'read:   head = (head + 1) % 8'], { size: 12, mono: true, tone: 'ink', gap: 20 });
  f.lines(360, 224, ['Nothing ever shifts, so', 'both ends are O(1). When it is', 'full, a write replaces the oldest.'], { size: 12.5, tone: 'muted', gap: 18 });
  return f;
};

const monotonicStack: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A monotonic stack for next greater element on 2, 1, 5, 3, 4. After index 0 the stack holds 2. After index 1 it holds 2 and 1. When 5 arrives it pops 1 and 2, because 5 is their next greater element, and the stack holds 5. Then 3 is pushed, and when 4 arrives it pops 3 and the stack holds 5 and 4.');
  const cols: { head: string; stack: number[]; note: string }[] = [
    { head: 'i=0  value 2', stack: [2], note: '' },
    { head: 'i=1  value 1', stack: [2, 1], note: '' },
    { head: 'i=2  value 5', stack: [5], note: 'pops 1, then 2' },
    { head: 'i=3  value 3', stack: [5, 3], note: '' },
    { head: 'i=4  value 4', stack: [5, 4], note: 'pops 3' },
  ];
  cols.forEach((c, i) => {
    const x = 14 + i * 124;
    f.text(x + 48, 24, c.head, { anchor: 'middle', size: 11.5, bold: true, mono: true });
    c.stack.forEach((v, k) => f.box(x, 150 - k * 40, 96, 34, { tone: k === c.stack.length - 1 ? 'accent' : 'info', solid: k === c.stack.length - 1, label: String(v), mono: true, size: 14 }));
    if (c.note) f.text(x + 48, 222, c.note, { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  });
  f.line(14, 196, 626, 196, { tone: 'muted' });
  f.text(W / 2, 254, 'The stack stays decreasing from bottom to top. A bigger value pops smaller ones:', { anchor: 'middle', size: 12.5 });
  f.text(W / 2, 272, 'it is their "next greater". Each index is pushed once and popped once → O(n).', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

/* ───────────────────────── 4 · Linked lists ───────────────────────── */

const listShape: FigureBuilder = () => {
  const f = new Fig(W, 190, 'A singly linked list: a head pointer refers to the first node, each node holds a value and a next pointer to the following node, and the last node points to null.');
  const vals = ['7', '3', '9'];
  vals.forEach((v, i) => {
    const x = 70 + i * 160;
    f.box(x, 70, 120, 54, { tone: 'info', label: v, sub: 'next →', mono: true, size: 16 });
    f.path(`M${x + 122} 97 H${x + 158}`, { arrow: true, width: 2 });
  });
  f.text(560, 102, 'null', { size: 14, mono: true, bold: true, tone: 'muted' });
  f.text(130, 34, 'head', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'accent' });
  f.path('M130 42 V66', { arrow: true, tone: 'accent', width: 2 });
  f.text(W / 2, 156, 'Nodes can live anywhere in memory; each one only knows the next.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(W / 2, 176, 'Reaching item k means walking k links: O(n). Rewiring links is O(1).', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

const listInsert: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Inserting a node X after A in a linked list takes two pointer changes: first set X.next to what A pointed at (B), then set A.next to X. Doing it in the other order loses the rest of the list.');
  const node = (x: number, y: number, l: string, tone: Tone = 'info') => f.box(x, y, 100, 42, { tone, label: l, mono: true, size: 15, solid: tone === 'accent' });
  const arrow = (x: number, y: number) => f.path(`M${x + 102} ${y + 21} H${x + 148}`, { arrow: true, width: 2 });
  f.text(20, 24, 'before', { size: 12.5, tone: 'muted', bold: true });
  ['A', 'B', 'C'].forEach((l, i) => { node(20 + i * 150, 34, l); if (i < 2) arrow(20 + i * 150, 34); });
  f.text(20, 128, 'insert X after A', { size: 12.5, tone: 'muted', bold: true });
  node(20, 144, 'A'); node(170, 144, 'X', 'accent'); node(320, 144, 'B'); node(470, 144, 'C');
  f.path('M122 165 H168', { arrow: true, tone: 'accent', width: 2 });
  f.path('M272 165 H318', { arrow: true, tone: 'accent', width: 2 });
  f.path('M422 165 H468', { arrow: true, width: 2 });
  f.num(145, 148, 2);
  f.num(295, 148, 1);
  f.text(20, 222, '① X.next = A.next     (X now points at B: nothing is lost yet)', { size: 12.5, mono: true });
  f.text(20, 244, '② A.next = X          (A now points at X)', { size: 12.5, mono: true });
  f.text(W / 2, 276, 'Swap the order and A.next = X overwrites the only link to B, losing B and C.', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  return f;
};

const floydCycle: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A linked list of six nodes whose last node points back to node 3, forming a cycle. A slow pointer moving one step and a fast pointer moving two steps both end up on node 5, so they meet, which proves there is a cycle.');
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 100;
    f.box(x, 72, 70, 40, { tone: i >= 2 ? 'info' : 'ink', label: String(i + 1), mono: true, size: 15, solid: i === 4 });
    if (i < 5) f.path(`M${x + 72} 92 H${x + 98}`, { arrow: true, width: 2 });
  }
  f.path('M555 114 V166 H255 V116', { arrow: true, tone: 'fail', width: 2 });
  f.text(405, 186, 'last node points back to node 3: a cycle', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.path('M455 42 V68', { arrow: true, tone: 'accent', width: 2 });
  f.text(455, 34, 'slow = fast: they met', { anchor: 'middle', size: 12.5, tone: 'accent', bold: true });
  f.lines(20, 208, ['slow moves 1 step, fast moves 2. With no cycle, fast reaches null. Inside a cycle, fast laps slow', 'and they must land on the same node. O(n) time, O(1) memory (no Set of visited nodes).'], { size: 12, tone: 'muted', gap: 18 });
  return f;
};

const doublyList: FigureBuilder = () => {
  const f = new Fig(W, 200, 'A doubly linked list with sentinel nodes: a dummy head, nodes A, B and C, and a dummy tail, each node linked to both its previous and next node. Removing any node needs no walking, because the node knows both neighbours.');
  const labels: [string, string, Tone][] = [['HEAD', 'sentinel', 'muted'], ['A', '', 'info'], ['B', '', 'info'], ['C', '', 'info'], ['TAIL', 'sentinel', 'muted']];
  labels.forEach(([l, sub, tone], i) => {
    const x = 14 + i * 124;
    f.box(x, 64, 96, 48, { tone, dashed: tone === 'muted', label: l, sub: sub || undefined, mono: true, size: 14 });
    if (i < 4) {
      f.path(`M${x + 98} 80 H${x + 122}`, { arrow: true, width: 2 });
      f.path(`M${x + 122} 98 H${x + 98}`, { arrow: true, width: 2, tone: 'accent' });
    }
  });
  f.text(W / 2, 28, '→ next pointers      ← prev pointers', { anchor: 'middle', size: 12.5, tone: 'muted', mono: true });
  f.text(W / 2, 148, 'Each node knows both neighbours, so remove(node) is O(1): no walking.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 170, 'The dummy ends mean every real node has a prev and a next: no special cases.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

/* ───────────────────────── 5 · Trees & BSTs ───────────────────────── */

type Pt = [number, number];
const R = 17;
const tnode = (f: Fig, [x, y]: Pt, label: string, tone: Tone = 'info') => {
  f.raw(`<circle class="f-box t-${tone} solid" cx="${x}" cy="${y}" r="${R}"/>`);
  f.text(x, y + 5, label, { anchor: 'middle', bold: true, mono: true, tone, size: 13.5 });
};
const tedge = (f: Fig, [x1, y1]: Pt, [x2, y2]: Pt, tone: Tone = 'muted', width = 1.8) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  f.line(+(x1 + ux * R).toFixed(1), +(y1 + uy * R).toFixed(1), +(x2 - ux * R).toFixed(1), +(y2 - uy * R).toFixed(1), { tone, width });
};

const treeAnatomy: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A binary tree with root 8. Node 8 has children 3 and 10. Node 3 has children 1 and 6. Node 10 has one child, 14. Nodes 1, 6 and 14 have no children and are called leaves. Depth counts steps down from the root and height is the depth of the deepest node.');
  const P: Record<string, Pt> = { r: [320, 40], a: [200, 108], b: [440, 108], c: [130, 176], d: [270, 176], e: [510, 176] };
  const edges: [string, string][] = [['r', 'a'], ['r', 'b'], ['a', 'c'], ['a', 'd'], ['b', 'e']];
  edges.forEach(([u, v]) => tedge(f, P[u], P[v]));
  tnode(f, P.r, '8', 'accent'); tnode(f, P.a, '3'); tnode(f, P.b, '10');
  tnode(f, P.c, '1', 'pass'); tnode(f, P.d, '6', 'pass'); tnode(f, P.e, '14', 'pass');
  f.text(284, 44, 'root', { anchor: 'end', size: 12.5, tone: 'accent', bold: true });
  f.text(130, 212, 'leaf', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(270, 212, 'leaf', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(510, 212, 'leaf', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(164, 90, 'parent of 1 and 6', { anchor: 'end', size: 12, tone: 'muted' });
  f.text(488, 90, 'child of 8', { size: 12, tone: 'muted' });
  f.text(W / 2, 244, 'depth of a node = steps down from the root (the root is 0). height = depth of the deepest node (here 2).', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 262, 'A node is { val, left, right }; a missing child is null.', { anchor: 'middle', size: 12, tone: 'muted', mono: true });
  return f;
};

const treeTraversals: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The same seven-node binary tree walked four ways. Pre-order visits 4 2 1 3 6 5 7. In-order visits 1 2 3 4 5 6 7, which is sorted when the tree is a binary search tree. Post-order visits 1 3 2 5 7 6 4. Level-order visits row by row: 4 2 6 1 3 5 7.');
  const P: Pt[] = [[170, 40], [90, 104], [250, 104], [50, 168], [130, 168], [210, 168], [290, 168]];
  const vals = ['4', '2', '6', '1', '3', '5', '7'];
  [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].forEach(([a, b]) => tedge(f, P[a], P[b]));
  P.forEach((p, i) => tnode(f, p, vals[i]));
  f.text(170, 218, 'DFS goes deep first (recursion / stack)', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(170, 238, 'BFS goes row by row (queue)', { anchor: 'middle', size: 12, tone: 'muted' });
  const rows: [string, string, Tone][] = [
    ['pre-order  (root, left, right)', '4 2 1 3 6 5 7', 'info'],
    ['in-order  (left, root, right)', '1 2 3 4 5 6 7   sorted for a BST', 'pass'],
    ['post-order  (left, right, root)', '1 3 2 5 7 6 4', 'info'],
    ['level-order  (row by row)', '4 2 6 1 3 5 7', 'accent'],
  ];
  rows.forEach(([name, seq, tone], i) => {
    f.text(350, 44 + i * 58, name, { size: 12.5, bold: true, tone });
    f.text(350, 64 + i * 58, seq, { size: 12.5, mono: true });
  });
  return f;
};

const bstSearch: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Searching for 6 in a binary search tree rooted at 8. Since 6 is less than 8, go left; since 6 is greater than 3, go right; found 6 after three comparisons, ignoring everything in the right half of the tree.');
  const P: Record<string, Pt> = { r: [320, 40], a: [200, 108], b: [440, 108], c: [130, 176], d: [270, 176], e: [510, 176] };
  tedge(f, P.r, P.b); tedge(f, P.a, P.c); tedge(f, P.b, P.e);
  tedge(f, P.r, P.a, 'accent', 3); tedge(f, P.a, P.d, 'accent', 3);
  tnode(f, P.b, '10', 'muted'); tnode(f, P.c, '1', 'muted'); tnode(f, P.e, '14', 'muted');
  tnode(f, P.r, '8', 'accent'); tnode(f, P.a, '3', 'accent'); tnode(f, P.d, '6', 'pass');
  f.text(350, 44, '6 < 8: go left, skip the whole right side', { size: 12, tone: 'accent', bold: true });
  f.text(164, 112, '6 > 3: go right', { anchor: 'end', size: 12, tone: 'accent', bold: true });
  f.text(270, 214, 'found!', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.text(W / 2, 246, 'Left subtree < node < right subtree, at every node. Each step discards a whole subtree.', { anchor: 'middle', size: 12.5, tone: 'ink' });
  f.text(W / 2, 264, 'Balanced: about log₂ n steps.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const bstBalance: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Two binary search trees holding the same seven values. Inserted in a good order, the tree is balanced and only three levels tall. Inserted already sorted, every node goes to the right and the tree becomes a chain of height seven, so searching degrades to a linear scan.');
  const L: Pt[] = [[150, 36], [80, 96], [220, 96], [40, 156], [120, 156], [180, 156], [260, 156]];
  [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].forEach(([a, b]) => tedge(f, L[a], L[b]));
  L.forEach((p, i) => tnode(f, p, String([4, 2, 6, 1, 3, 5, 7][i]), 'pass'));
  f.text(150, 206, 'balanced: height 3', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.text(150, 224, 'search ≈ log₂ n steps', { anchor: 'middle', size: 12, tone: 'muted' });
  const C: Pt[] = Array.from({ length: 7 }, (_, i) => [380 + i * 36, 30 + i * 30] as Pt);
  for (let i = 0; i < 6; i++) tedge(f, C[i], C[i + 1], 'muted');
  C.forEach((p, i) => tnode(f, p, String(i + 1), 'fail'));
  f.text(500, 252, 'inserted in sorted order: a chain, height 7', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.text(150, 252, 'Same values, different shape.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 6 · Heaps & priority queues ───────────────────────── */

const heapTreeArray: FigureBuilder = () => {
  const f = new Fig(W, 320, 'A min-heap drawn as a tree and stored as an array: 1, 3, 2, 7, 4, 5, 9. Every parent is less than or equal to its children, so the smallest value is at the root, index 0. In the array, the children of index i are at 2i+1 and 2i+2, and the parent of index i is at floor of (i-1)/2.');
  const vals = [1, 3, 2, 7, 4, 5, 9];
  const P: Pt[] = [[320, 40], [200, 98], [440, 98], [130, 156], [270, 156], [370, 156], [510, 156]];
  [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]].forEach(([a, b]) => tedge(f, P[a], P[b]));
  P.forEach((p, i) => tnode(f, p, String(vals[i]), i === 0 ? 'accent' : 'info'));
  f.text(20, 44, 'rule: every parent ≤ its children', { size: 12.5, bold: true });
  f.text(354, 44, 'smallest at the top: peek is O(1)', { size: 12.5, tone: 'accent', bold: true });
  vals.forEach((v, i) => {
    f.box(20 + i * 88, 214, 80, 40, { tone: i === 0 ? 'accent' : 'info', solid: i === 0, label: String(v), mono: true, size: 15 });
    f.text(60 + i * 88, 274, String(i), { anchor: 'middle', size: 12, mono: true, tone: 'muted' });
  });
  f.text(W / 2, 198, 'the same heap stored in a plain array (no pointers):', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 302, 'children of i: 2i + 1 and 2i + 2      parent of i: ⌊(i − 1) / 2⌋', { anchor: 'middle', size: 12.5, mono: true, bold: true });
  return f;
};

const heapRows = (f: Fig, rows: { vals: number[]; hot: number[]; note: string; sub: string; tone?: Tone }[]) => {
  rows.forEach((r, k) => {
    const y = 30 + k * 76;
    r.vals.forEach((v, i) => f.box(20 + i * 66, y, 60, 40, { tone: r.hot.includes(i) ? (r.tone ?? 'accent') : 'info', solid: r.hot.includes(i), label: String(v), mono: true, size: 15 }));
    f.text(300, y + 16, r.note, { size: 12.5, bold: true });
    f.text(300, y + 36, r.sub, { size: 12, tone: 'muted' });
  });
};

const heapSiftUp: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Pushing 1 into the min-heap stored as the array 2, 5, 3. Add it at the end, giving 2, 5, 3, 1. Its parent at index 1 is 5, which is larger, so swap, giving 2, 1, 3, 5. Its parent at index 0 is 2, which is larger, so swap again, giving 1, 2, 3, 5. It reached the root, so the heap property holds again.');
  heapRows(f, [
    { vals: [2, 5, 3, 1], hot: [3], note: 'push(1): add it at the END (index 3)', sub: 'parent of 3 = ⌊(3−1)/2⌋ = 1, which holds 5' },
    { vals: [2, 1, 3, 5], hot: [1, 3], note: '1 < 5: swap with the parent', sub: 'now at index 1; parent = index 0, which holds 2' },
    { vals: [1, 2, 3, 5], hot: [0, 1], note: '1 < 2: swap again. At the root: done', sub: 'at most one swap per level: O(log n)', tone: 'pass' },
  ]);
  f.text(W / 2, 252, 'This is "sift up" (also called bubble up).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const heapSiftDown: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Popping the minimum from the heap 1, 2, 3, 5. Take the root 1. Move the last item, 5, to the root, giving 5, 2, 3. Compare it with its children 2 and 3 and swap with the smaller one, 2, giving 2, 5, 3, which is a heap again.');
  heapRows(f, [
    { vals: [1, 2, 3, 5], hot: [0], note: 'pop(): the minimum is the root (1)', sub: 'removing it leaves a hole at the top' },
    { vals: [5, 2, 3], hot: [0], note: 'move the LAST item (5) to the root', sub: 'the array is shorter and the shape stays complete' },
    { vals: [2, 5, 3], hot: [0, 1], note: 'swap with the SMALLER child (2)', sub: 'repeat down the tree until neither child is smaller', tone: 'pass' },
  ]);
  f.text(W / 2, 252, 'This is "sift down". At most one swap per level: O(log n).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const heapCosts: FigureBuilder = () => {
  const f = new Fig(W, 272, 'Costs of a priority queue built three ways. Peek at the minimum: unsorted array O(n), sorted array O(1), heap O(1). Insert: unsorted O(1), sorted O(n), heap O(log n). Remove the minimum: unsorted O(n), sorted O(n), heap O(log n). Build from n items: sorted O(n log n), heap O(n).');
  const cols = ['unsorted array', 'sorted array', 'binary heap'];
  const rows: [string, string[], Tone[]][] = [
    ['peek min', ['O(n)', 'O(1)', 'O(1)'], ['fail', 'pass', 'pass']],
    ['insert', ['O(1)', 'O(n)', 'O(log n)'], ['pass', 'fail', 'info']],
    ['remove min', ['O(n)', 'O(n)*', 'O(log n)'], ['fail', 'fail', 'info']],
    ['build from n items', ['n × O(1)', 'O(n log n)', 'O(n)'], ['pass', 'info', 'pass']],
  ];
  cols.forEach((c, i) => f.text(170 + i * 148 + 70, 24, c, { anchor: 'middle', size: 12.5, bold: true, tone: i === 2 ? 'accent' : 'ink' }));
  rows.forEach(([name, vals, tones], r) => {
    const y = 38 + r * 46;
    f.box(16, y, 148, 36, { tone: 'ink', label: name, size: 12.5 });
    vals.forEach((v, i) => f.box(170 + i * 148, y, 140, 36, { tone: tones[i], solid: true, label: v, mono: true, size: 13 }));
  });
  f.text(W / 2, 248, '* shifting after the removal; O(1) only if you keep the array in descending order.', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.text(W / 2, 266, 'A heap is the balanced trade: both insert and remove-min are O(log n).', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

/* ───────────────────────── 7 · Graphs ───────────────────────── */

const darrow = (f: Fig, [x1, y1]: Pt, [x2, y2]: Pt, tone: Tone = 'muted', width = 1.8) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  f.path(`M${(x1 + ux * R).toFixed(1)} ${(y1 + uy * R).toFixed(1)} L${(x2 - ux * (R + 4)).toFixed(1)} ${(y2 - uy * (R + 4)).toFixed(1)}`, { arrow: true, tone, width });
};

const graphVocab: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Three small graphs. An undirected graph of three connected nodes, like friendships. A directed graph where edges are one-way arrows, like follows. A weighted graph where each edge carries a cost, like distances between cities.');
  const tri = (ox: number): Pt[] => [[ox + 36, 70], [ox + 136, 70], [ox + 86, 150]];
  const a = tri(10), b = tri(223), c = tri(436);
  tedge(f, a[0], a[1]); tedge(f, a[1], a[2]); tedge(f, a[0], a[2]);
  a.forEach((p, i) => tnode(f, p, 'ABC'[i]));
  darrow(f, b[0], b[1], 'ink'); darrow(f, b[1], b[2], 'ink'); darrow(f, b[0], b[2], 'ink');
  b.forEach((p, i) => tnode(f, p, 'ABC'[i]));
  tedge(f, c[0], c[1]); tedge(f, c[1], c[2]); tedge(f, c[0], c[2]);
  c.forEach((p, i) => tnode(f, p, 'ABC'[i]));
  f.text((c[0][0] + c[1][0]) / 2, 60, '4', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'accent' });
  f.text((c[1][0] + c[2][0]) / 2 + 14, 116, '2', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'accent' });
  f.text((c[0][0] + c[2][0]) / 2 - 14, 116, '7', { anchor: 'middle', size: 13, mono: true, bold: true, tone: 'accent' });
  [['undirected', 'edges go both ways (friends)'], ['directed', 'edges are one-way (follows)'], ['weighted', 'edges carry a cost (distance)']].forEach(([t, sub], i) => {
    f.text(96 + i * 213, 196, t, { anchor: 'middle', size: 13, bold: true });
    f.text(96 + i * 213, 214, sub, { anchor: 'middle', size: 11.5, tone: 'muted' });
  });
  f.text(W / 2, 252, 'A graph = vertices (nodes) + edges. A cycle is a path that returns to its start.', { anchor: 'middle', size: 12.5, tone: 'ink' });
  return f;
};

const graphRepresentations: FigureBuilder = () => {
  const f = new Fig(W, 300, 'One four-node graph stored two ways. As an adjacency list: A lists B and C, B lists A and C, C lists A, B and D, D lists C. As an adjacency matrix: a four by four grid with 1 where an edge exists. The list uses memory proportional to nodes plus edges; the matrix uses nodes squared.');
  const A: Pt = [50, 60], B: Pt = [160, 60], C: Pt = [50, 160], D: Pt = [160, 160];
  [[A, B], [A, C], [B, C], [C, D]].forEach(([u, v]) => tedge(f, u, v));
  [[A, 'A'], [B, 'B'], [C, 'C'], [D, 'D']].forEach(([p, l]) => tnode(f, p as Pt, l as string));
  f.text(106, 218, 'the graph', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  f.text(240, 24, 'adjacency list', { size: 13, bold: true, tone: 'accent' });
  const lists: [string, string][] = [['A', 'B, C'], ['B', 'A, C'], ['C', 'A, B, D'], ['D', 'C']];
  lists.forEach(([n, ns], i) => {
    const y = 38 + i * 40;
    f.box(240, y, 34, 32, { tone: 'info', solid: true, label: n, mono: true, size: 13 });
    f.text(286, y + 21, '→  ' + ns, { size: 13, mono: true });
  });
  f.text(430, 24, 'adjacency matrix', { size: 13, bold: true, tone: 'accent' });
  const M = [[0, 1, 1, 0], [1, 0, 1, 0], [1, 1, 0, 1], [0, 0, 1, 0]];
  'ABCD'.split('').forEach((l, i) => { f.text(471 + i * 36, 44, l, { anchor: 'middle', size: 12, mono: true, bold: true, tone: 'muted' }); f.text(446, 70 + i * 36, l, { anchor: 'middle', size: 12, mono: true, bold: true, tone: 'muted' }); });
  M.forEach((row, r) => row.forEach((v, c) => f.box(454 + c * 36, 52 + r * 36, 34, 32, { tone: v ? 'pass' : 'muted', solid: !!v, dashed: !v, label: String(v), mono: true, size: 13 })));
  f.lines(20, 244, ['list: memory O(V + E), fast to loop over neighbours  ·  matrix: memory O(V²), "is there an edge?" in O(1)', 'Most real graphs are sparse (E far below V²), so the adjacency list is the default.'], { size: 12, tone: 'muted', gap: 20 });
  return f;
};

const bfsLayers: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Breadth-first search from S on a five-node graph. S is at distance 0; A and B, its neighbours, are at distance 1; C, reached through A or B, is at distance 2; D is at distance 3. BFS explores in rings of increasing distance, so the first time it reaches a node is along a shortest path.');
  const S: Pt = [70, 130], A: Pt = [200, 74], B: Pt = [200, 186], C: Pt = [340, 130], D: Pt = [480, 130];
  [[S, A], [S, B], [A, C], [B, C], [C, D]].forEach(([u, v]) => tedge(f, u, v));
  tnode(f, S, 'S', 'accent'); tnode(f, A, 'A'); tnode(f, B, 'B'); tnode(f, C, 'C', 'info'); tnode(f, D, 'D', 'pass');
  [[70, 'dist 0'], [200, 'dist 1'], [340, 'dist 2'], [480, 'dist 3']].forEach(([x, t], i) => f.text(x as number, 232, t as string, { anchor: 'middle', size: 12.5, mono: true, bold: true, tone: (['accent', 'info', 'info', 'pass'] as Tone[])[i] }));
  f.text(W / 2, 24, 'queue: [S]  →  [A, B]  →  [B, C]  →  [C]  →  [D]', { anchor: 'middle', size: 12.5, mono: true });
  f.text(W / 2, 258, 'Rings of increasing distance: the first visit to a node is along a shortest path (unweighted).', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const gridIslands: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A grid of land and water cells treated as a graph where each cell is a node joined to its up, down, left and right neighbours. Connected land cells form islands; this grid has five islands. A flood fill from each unvisited land cell marks a whole island.');
  const grid = ['110001', '100111', '001000', '100011'];
  const ids: number[][] = [[1, 1, 0, 0, 0, 2], [1, 0, 0, 2, 2, 2], [0, 0, 3, 0, 0, 0], [4, 0, 0, 0, 5, 5]];
  const tones: Tone[] = ['accent', 'info', 'pass', 'fail', 'ink'];
  grid.forEach((row, r) => row.split('').forEach((cell, c) => {
    const id = ids[r][c];
    f.box(20 + c * 58, 28 + r * 48, 54, 42, { tone: id ? tones[id - 1] : 'muted', solid: !!id, dashed: !id, label: id ? String(id) : '', mono: true, size: 15 });
  }));
  f.text(20, 18, 'each cell is a node; its 4 neighbours (up, down, left, right) are its edges', { size: 11.5, tone: 'muted' });
  f.text(400, 70, '5 islands', { size: 20, bold: true, tone: 'accent' });
  f.lines(400, 100, ['Flood fill: from every', 'unvisited land cell, DFS or BFS', 'marks its whole island.', 'Count how many times you', 'have to start a new one.'], { size: 12.5, tone: 'ink', gap: 20 });
  f.text(W / 2, 238, 'Any grid problem (mazes, flood fill, shortest steps) is a graph problem in disguise.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const topoSort: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A course prerequisite graph: A, intro, comes before B, data structures, and C, discrete maths; both B and C come before D, algorithms; D comes before E, the capstone. A valid study order is A, C, B, D, E: every arrow points forward. This ordering is a topological sort, and it exists only if there is no cycle.');
  const A: Pt = [60, 100], B: Pt = [190, 50], C: Pt = [190, 150], D: Pt = [330, 100], E: Pt = [470, 100];
  [[A, B], [A, C], [B, D], [C, D], [D, E]].forEach(([u, v]) => darrow(f, u, v, 'ink'));
  tnode(f, A, 'A', 'accent'); tnode(f, B, 'B'); tnode(f, C, 'C'); tnode(f, D, 'D'); tnode(f, E, 'E', 'pass');
  f.text(490, 44, 'A intro   B data structures', { anchor: 'end', size: 11.5, tone: 'muted' });
  f.text(490, 62, 'C discrete maths   D algorithms', { anchor: 'end', size: 11.5, tone: 'muted' });
  f.text(20, 196, 'one valid order:', { size: 12.5, tone: 'muted', bold: true });
  ['A', 'C', 'B', 'D', 'E'].forEach((l, i) => f.box(20 + i * 56, 206, 48, 34, { tone: 'pass', solid: true, label: l, mono: true, size: 14 }));
  f.lines(310, 212, ['Kahn: repeatedly take a node with no unmet', 'prerequisites (in-degree 0), then free its successors.', 'A cycle means some nodes never reach in-degree 0.'], { size: 12, tone: 'ink', gap: 18 });
  return f;
};

/* ───────────────────────── 8 · Specialist structures ───────────────────────── */

const dsuForest: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Union-find stores each set as a tree where every node points to its parent and the root points to itself. Before union(1, 3) there are sets {0,1}, {2,3} and {4}. After it, the root of one tree is attached under the root of the other, giving sets {0,1,2,3} and {4}.');
  const up = (a: Pt, b: Pt) => darrow(f, a, b, 'ink');
  const b0: Pt = [60, 70], b1: Pt = [60, 150], b2: Pt = [150, 70], b3: Pt = [150, 150], b4: Pt = [236, 70];
  up(b1, b0); up(b3, b2);
  tnode(f, b0, '0', 'accent'); tnode(f, b1, '1'); tnode(f, b2, '2', 'accent'); tnode(f, b3, '3'); tnode(f, b4, '4', 'accent');
  f.text(150, 206, 'before: three sets', { anchor: 'middle', size: 12.5, tone: 'muted', bold: true });
  f.path('M286 110 H350', { arrow: true, tone: 'accent', width: 2 });
  f.text(318, 98, 'union(1, 3)', { anchor: 'middle', size: 12, mono: true, bold: true, tone: 'accent' });
  const a0: Pt = [450, 60], a1: Pt = [400, 130], a2: Pt = [500, 130], a3: Pt = [500, 200], a4: Pt = [585, 60];
  up(a1, a0); up(a2, a0); up(a3, a2);
  tnode(f, a0, '0', 'accent'); tnode(f, a1, '1'); tnode(f, a2, '2'); tnode(f, a3, '3'); tnode(f, a4, '4', 'accent');
  f.text(495, 246, 'after: sets {0,1,2,3} and {4}', { anchor: 'middle', size: 12.5, tone: 'muted', bold: true });
  f.text(W / 2, 276, 'find(x) climbs parents to the root (the node that is its own parent). Same root = same set.', { anchor: 'middle', size: 12, tone: 'ink' });
  return f;
};

const dsuCompress: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Path compression. On the left, a chain of five nodes where each points to the one before it, so find(4) walks four steps. On the right, after find(4) every node on that path points directly at the root, so later finds take one step.');
  const chain: Pt[] = Array.from({ length: 5 }, (_, i) => [90, 28 + i * 46] as Pt);
  for (let i = 1; i < 5; i++) darrow(f, chain[i], chain[i - 1], 'ink');
  chain.forEach((p, i) => tnode(f, p, String(i), i === 0 ? 'accent' : 'info'));
  f.text(90, 262, 'before: find(4) = 4 steps', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.path('M170 120 H260', { arrow: true, tone: 'accent', width: 2 });
  f.text(215, 108, 'find(4)', { anchor: 'middle', size: 12, mono: true, bold: true, tone: 'accent' });
  const root: Pt = [440, 40];
  const kids: Pt[] = [[340, 150], [410, 150], [480, 150], [550, 150]];
  tnode(f, root, '0', 'accent');
  kids.forEach((p, i) => { darrow(f, p, root, 'ink'); tnode(f, p, String(i + 1), 'info'); });
  f.text(445, 196, 'after: every node on the path now points', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.text(445, 214, 'straight at the root: later finds take 1 step', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.text(W / 2, 282, 'Path compression + union by size makes each operation almost O(1).', { anchor: 'middle', size: 12.5, tone: 'ink' });
  return f;
};

const trieCounts: FigureBuilder = () => {
  const f = new Fig(W, 300, 'A trie holding car, cat and dog, where each node keeps a count of how many inserted words pass through it. Node c and node a both have count 2 because car and cat share the prefix ca; r and t have count 1 and end words; d, o and g have count 1. So the number of words starting with ca is read from node a in one walk.');
  const P: Record<string, Pt> = { root: [320, 34], c: [190, 98], d: [450, 98], a: [190, 162], o: [450, 162], r: [130, 226], t: [250, 226], g: [450, 226] };
  [['root', 'c'], ['root', 'd'], ['c', 'a'], ['d', 'o'], ['a', 'r'], ['a', 't'], ['o', 'g']].forEach(([u, v]) => tedge(f, P[u], P[v]));
  const counts: Record<string, number> = { c: 2, a: 2, r: 1, t: 1, d: 1, o: 1, g: 1 };
  const ends = new Set(['r', 't', 'g']);
  tnode(f, P.root, '·', 'ink');
  Object.keys(counts).forEach((k) => { tnode(f, P[k], k, ends.has(k) ? 'pass' : 'info'); f.text(P[k][0] + 24, P[k][1] - 12, '×' + counts[k], { size: 11.5, mono: true, bold: true, tone: 'accent' }); });
  f.lines(500, 60, ['×n = how many', 'words pass through', 'this node'], { size: 11.5, tone: 'accent', gap: 16 });
  f.lines(500, 130, ['green = a word', 'ends here'], { size: 11.5, tone: 'pass', gap: 16 });
  f.text(20, 270, 'countPrefix("ca") = walk c → a, read the count: 2   (O(length of the prefix))', { size: 12, mono: true });
  f.text(20, 290, 'erase("cat"): walk down decrementing each count, so "ca" drops from 2 to 1.', { size: 12, mono: true, tone: 'muted' });
  return f;
};

const prefixSums: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Prefix sums. The array 3, 1, 4, 1, 5 has prefix array 0, 3, 4, 8, 9, 14, where prefix[k] is the sum of the first k items. The sum of items 1 to 3 is prefix[4] minus prefix[1], which is 9 minus 3, equal to 6, found in constant time.');
  const vals = [3, 1, 4, 1, 5];
  const pref = [0, 3, 4, 8, 9, 14];
  f.text(20, 22, 'array', { size: 12, tone: 'muted', bold: true });
  vals.forEach((v, i) => f.box(60 + i * 84, 30, 76, 40, { tone: i >= 1 && i <= 3 ? 'accent' : 'info', solid: i >= 1 && i <= 3, label: String(v), mono: true, size: 15 }));
  f.text(20, 104, 'prefix[k] = sum of the first k items', { size: 12, tone: 'muted', bold: true });
  pref.forEach((v, k) => f.box(18 + k * 84, 112, 76, 40, { tone: k === 1 || k === 4 ? 'accent' : 'ink', solid: k === 1 || k === 4, label: String(v), mono: true, size: 15 }));
  pref.forEach((_, k) => f.text(56 + k * 84, 168, 'k=' + k, { anchor: 'middle', size: 11, mono: true, tone: 'muted' }));
  f.text(W / 2, 206, 'sum(l..r) = prefix[r + 1] − prefix[l]', { anchor: 'middle', size: 14, mono: true, bold: true });
  f.text(W / 2, 230, 'sum(1..3) = prefix[4] − prefix[1] = 9 − 3 = 6   →   build once in O(n), every query is O(1)', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const fenwickTree: FigureBuilder = () => {
  const f = new Fig(W, 310, 'A Fenwick tree over eight positions. Entry i stores the sum of the i minus lowbit of i, up to i, range: entry 1 covers position 1; entry 2 covers 1 to 2; entry 3 covers 3; entry 4 covers 1 to 4; entry 5 covers 5; entry 6 covers 5 to 6; entry 7 covers 7; entry 8 covers 1 to 8. A prefix sum of the first seven positions adds entries 7, 6 and 4.');
  const x0 = 24, cw = 74;
  for (let i = 1; i <= 8; i++) f.box(x0 + (i - 1) * cw, 16, cw - 6, 28, { tone: 'ink', label: String(i), mono: true, size: 13 });
  const bar = (i: number, row: number, from: number, len: number, hot: boolean) => f.box(x0 + (from - 1) * cw, 58 + row * 36, len * cw - 6, 28, { tone: hot ? 'accent' : 'info', solid: hot, label: `T[${i}]`, mono: true, size: 12.5 });
  [1, 3, 5, 7].forEach((i) => bar(i, 0, i, 1, i === 7));
  bar(2, 1, 1, 2, false); bar(6, 1, 5, 2, true);
  bar(4, 2, 1, 4, true);
  bar(8, 3, 1, 8, false);
  f.text(20, 214, 'T[i] covers the positions (i − lowbit(i), i], where lowbit(i) is the lowest set bit of i.', { size: 12, tone: 'muted' });
  f.text(20, 238, 'prefix(7) = T[7] + T[6] + T[4]      (drop the lowest set bit each step: 7 → 6 → 4 → 0)', { size: 12, mono: true, bold: true, tone: 'accent' });
  f.text(20, 260, 'update(3)  touches  T[3], T[4], T[8]  (add the lowest set bit each step: 3 → 4 → 8)', { size: 12, mono: true, tone: 'ink' });
  f.text(W / 2, 292, 'Both walks take at most log₂ n steps: point update and prefix sum are O(log n).', { anchor: 'middle', size: 12.5, bold: true });
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
  'ds-stack-lifo': stackLifo,
  'ds-queue-fifo': queueFifo,
  'ds-ring-buffer': ringBuffer,
  'ds-monotonic-stack': monotonicStack,
  'ds-list-shape': listShape,
  'ds-list-insert': listInsert,
  'ds-floyd-cycle': floydCycle,
  'ds-doubly-list': doublyList,
  'ds-tree-anatomy': treeAnatomy,
  'ds-tree-traversals': treeTraversals,
  'ds-bst-search': bstSearch,
  'ds-bst-balance': bstBalance,
  'ds-heap-tree-array': heapTreeArray,
  'ds-heap-sift-up': heapSiftUp,
  'ds-heap-sift-down': heapSiftDown,
  'ds-heap-costs': heapCosts,
  'ds-graph-vocab': graphVocab,
  'ds-graph-reps': graphRepresentations,
  'ds-bfs-layers': bfsLayers,
  'ds-grid-islands': gridIslands,
  'ds-topo-sort': topoSort,
  'ds-dsu-forest': dsuForest,
  'ds-dsu-compress': dsuCompress,
  'ds-trie-counts': trieCounts,
  'ds-prefix-sums': prefixSums,
  'ds-fenwick': fenwickTree,
};
