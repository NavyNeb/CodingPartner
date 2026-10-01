import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

const interviewRoutine: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A repeatable six-step routine for live coding: restate and clarify, work a small example by hand, propose brute force then improve, code it while narrating, test with edge cases, and state time and space complexity.');
  const steps: [string, string, Tone][] = [['1 Restate', 'ask about inputs', 'info'], ['2 Example', 'work one by hand', 'info'], ['3 Brute force', 'say its cost, improve', 'accent'], ['4 Code', 'narrate invariants', 'accent'], ['5 Test', 'empty · one · nasty', 'pass'], ['6 Complexity', 'time and space', 'pass']];
  steps.forEach(([t, sub, tone], i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 16 + col * 210, y = 24 + row * 100;
    f.box(x, y, 190, 64, { tone, label: t, sub, size: 13 });
    if (col < 2) f.path(`M${x + 192} ${y + 32} H${x + 208}`, { arrow: true, width: 2 });
  });
  f.path('M606 88 V116 H110 V124', { arrow: true, tone: 'muted', dashed: true });
  f.text(W / 2, 238, 'Interviewers grade HOW you reason. Name the shape in the first two minutes.', { anchor: 'middle', size: 13, bold: true });
  f.text(W / 2, 258, '“If memory mattered more than speed, I’d sort in place and use two pointers.”', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const trieShape: FigureBuilder = () => {
  const f = new Fig(W, 280, 'A trie stores words one character per node, so shared prefixes share nodes. The words car, cat and dog form two branches from the root: c, then a, then r or t; and d, o, g. Nodes that end a word are marked.');
  const node = (x: number, y: number, ch: string, end = false) => { f.raw(`<circle class="f-box t-${end ? 'pass' : 'info'} solid" cx="${x}" cy="${y}" r="17"/>`); f.text(x, y + 5, ch, { anchor: 'middle', bold: true, mono: true, tone: end ? 'pass' : 'info' }); };
  f.raw('<circle class="f-box t-ink solid" cx="320" cy="34" r="15"/>'); f.text(320, 39, '·', { anchor: 'middle', size: 18, bold: true });
  const edge = (x1: number, y1: number, x2: number, y2: number) => f.line(x1, y1 + 15, x2, y2 - 17, { tone: 'muted', width: 1.6 });
  edge(320, 34, 210, 100); edge(320, 34, 430, 100);
  node(210, 100, 'c'); node(430, 100, 'd');
  edge(210, 100, 210, 166); edge(430, 100, 430, 166);
  node(210, 166, 'a'); node(430, 166, 'o');
  edge(210, 166, 150, 232); edge(210, 166, 270, 232); edge(430, 166, 430, 232);
  node(150, 232, 'r', true); node(270, 232, 't', true); node(430, 232, 'g', true);
  f.text(150, 262, 'car', { anchor: 'middle', size: 12, mono: true, tone: 'pass' }); f.text(270, 262, 'cat', { anchor: 'middle', size: 12, mono: true, tone: 'pass' }); f.text(430, 262, 'dog', { anchor: 'middle', size: 12, mono: true, tone: 'pass' });
  f.text(560, 120, 'shared prefix "ca"', { anchor: 'middle', size: 12, tone: 'info', bold: true }); f.text(110, 130, 'shared prefix', { anchor: 'middle', size: 11.5, tone: 'info' });
  f.text(560, 170, 'green = end of a word', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(560, 192, 'startsWith("ca") walks', { anchor: 'middle', size: 11.5, tone: 'muted' }); f.text(560, 208, 'c → a: cost O(prefix)', { anchor: 'middle', size: 11.5, tone: 'muted' });
  return f;
};

const intervalSweep: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Merge intervals by sorting by start, then sweeping once. Intervals 1 to 3, 2 to 6, 8 to 10 and 9 to 12 become 1 to 6 and 8 to 12, because overlapping or touching intervals are joined.');
  const x0 = 40, k = 40;
  const bar = (a: number, b: number, y: number, tone: Tone, label: string) => { f.box(x0 + a * k, y, (b - a) * k, 22, { tone, solid: true, r: 11, label, size: 11 }); };
  f.text(16, 26, 'sorted by start:', { size: 12, tone: 'muted', bold: true });
  bar(1, 3, 36, 'info', '[1,3]'); bar(2, 6, 64, 'info', '[2,6]'); bar(8, 10, 92, 'accent', '[8,10]'); bar(9, 12, 120, 'accent', '[9,12]');
  [0, 2, 4, 6, 8, 10, 12].forEach((t) => { f.line(x0 + t * k, 150, x0 + t * k, 156, { tone: 'muted' }); f.text(x0 + t * k, 170, `${t}`, { anchor: 'middle', size: 10.5, tone: 'muted', mono: true }); });
  f.line(x0, 150, x0 + 12 * k, 150, { tone: 'muted' });
  f.text(16, 200, 'merged:', { size: 12, tone: 'pass', bold: true });
  f.box(x0 + 1 * k, 184, 5 * k, 24, { tone: 'pass', solid: true, r: 12, label: '[1,6]', size: 11.5 });
  f.box(x0 + 8 * k, 184, 4 * k, 24, { tone: 'pass', solid: true, r: 12, label: '[8,12]', size: 11.5 });
  f.text(W / 2, 236, 'if next.start <= current.end → current.end = max(current.end, next.end)', { anchor: 'middle', size: 11.5, tone: 'muted', mono: true });
  return f;
};

const escapeBoundaries: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Whenever text crosses a boundary it must be encoded for that boundary. HTML text needs entity escaping, URLs need encodeURIComponent, and raw concatenation with user data is how injection bugs happen.');
  f.box(16, 100, 130, 60, { tone: 'fail', label: 'user input', sub: '<script> & "a=b"', size: 11.5, mono: true });
  const rows: [string, string, string, Tone][] = [['HTML text / attribute', 'escape  & < > " \'', '&lt;script&gt; &amp; &quot;…', 'info'], ['URL query value', 'encodeURIComponent', '%3Cscript%3E%20%26…', 'accent'], ['raw string concat', 'no encoding  ✗', 'breaks out → injection', 'fail']];
  rows.forEach(([t, how, out, tone], i) => {
    const y = 20 + i * 76;
    f.path(`M148 130 L220 ${y + 26}`, { arrow: true, tone, width: 1.8 });
    f.box(222, y, 190, 52, { tone, label: t, sub: how, size: 12 });
    f.path(`M414 ${y + 26} H448`, { arrow: true, tone, width: 1.8 });
    f.text(452, y + 31, out, { size: 10.5, mono: true, tone });
  });
  f.text(W / 2, 258, 'Order matters: escape & FIRST (or use one regex with a lookup map). encodeURI ≠ encodeURIComponent.', { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

const vdomToHtml: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A virtual DOM node is a plain object with type, props and children. Rendering to a string walks the tree: each element becomes a tag with escaped attributes and children; text is escaped; void elements like br have no children and no closing tag.');
  f.box(16, 24, 290, 140, { tone: 'info' });
  f.text(30, 46, '{ type: "div",', { mono: true, size: 11.5 });
  f.text(44, 66, 'props: { className: "card" },', { mono: true, size: 11.5 });
  f.text(44, 86, 'children: [', { mono: true, size: 11.5 });
  f.text(58, 106, '"Hi ", { type: "b", …["<you>"] },', { mono: true, size: 11.5 });
  f.text(58, 126, '{ type: "br" }', { mono: true, size: 11.5 });
  f.text(44, 146, '] }', { mono: true, size: 11.5 });
  f.path('M310 94 H344', { arrow: true, tone: 'accent', width: 2 });
  f.text(327, 84, 'walk', { anchor: 'middle', size: 11, tone: 'accent' });
  f.box(348, 24, 276, 140, { tone: 'pass' });
  f.text(362, 50, '<div class="card">', { mono: true, size: 11.5, tone: 'pass' });
  f.text(376, 76, 'Hi <b>&lt;you&gt;</b>', { mono: true, size: 11.5, tone: 'pass' });
  f.text(376, 102, '<br />', { mono: true, size: 11.5, tone: 'pass' });
  f.text(362, 128, '</div>', { mono: true, size: 11.5, tone: 'pass' });
  f.text(W / 2, 192, 'className → class · htmlFor → for · true → bare attribute · false/null/functions → omitted', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.text(W / 2, 214, 'style objects → "font-size:12px" (camelCase → kebab-case, px unless unitless)', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.text(W / 2, 240, 'Function components: call type(props) and render what it returns.', { anchor: 'middle', size: 12, bold: true });
  return f;
};

const rankLadder: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Ranking suggestions with a score ladder. An exact match scores 1000, a prefix match 800, a word-start match 600, a substring match 400, and a subsequence match 200. No match is excluded. Ties break by shorter item, then alphabetical.');
  const rungs: [number, string, string, Tone][] = [[1000, 'equals the query', '“git” → git', 'pass'], [800, 'starts with the query', '“git” → github', 'pass'], [600, 'a WORD starts with it', '“git” → open-git-log', 'info'], [400, 'contains it', '“git” → digit', 'info'], [200, 'subsequence of it', '“git” → gravity-it', 'accent']];
  rungs.forEach(([score, rule, ex, tone], i) => {
    const y = 16 + i * 40, w = 90 + (score / 1000) * 420;
    f.box(16, y, w, 32, { tone, solid: true, r: 8 });
    f.text(28, y + 21, `${score}`, { mono: true, bold: true, size: 13, tone });
    f.text(84, y + 21, rule, { size: 12.5, tone: 'ink' });
    f.text(w + 28, y + 21, ex, { size: 11.5, tone: 'muted', mono: true });
  });
  f.text(W / 2, 232, 'Tie-breakers: higher score → shorter item → alphabetical → original order.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 254, 'Empty query: everything, alphabetically (case-insensitive).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const interviewFigures: Record<string, FigureBuilder> = {
  'interview-routine': interviewRoutine, 'trie-shape': trieShape, 'interval-sweep': intervalSweep,
  'escape-boundaries': escapeBoundaries, 'vdom-to-html': vdomToHtml, 'rank-ladder': rankLadder,
};
