import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── Generics, inference & narrowing ───────────────────────── */

const genericSlot: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A generic function has a type slot T. TypeScript fills the slot by looking at the argument: passing number[] makes T equal number, passing string[] makes T equal string, so the return type follows.');
  f.box(200, 20, 240, 50, { tone: 'accent', label: 'first<T>(items: T[]): T', mono: true, size: 12.5 });
  f.text(320, 88, 'T is an empty slot until TypeScript fills it', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  const rows: [string, string, string][] = [['first([1, 2, 3])', 'number[]', 'number'], ['first(["a", "b"])', 'string[]', 'string']];
  rows.forEach(([call, arg, res], i) => {
    const y = 116 + i * 66;
    f.box(16, y, 190, 44, { tone: 'ink', label: call, mono: true, size: 12 });
    f.path(`M208 ${y + 22} H246`, { arrow: true, width: 2 });
    f.box(248, y, 140, 44, { tone: 'info', label: `T[] = ${arg}`, sub: '', mono: true, size: 12 });
    f.path(`M390 ${y + 22} H428`, { arrow: true, width: 2 });
    f.box(430, y, 194, 44, { tone: 'pass', label: `T = ${res}`, mono: true, size: 13 });
  });
  f.text(W / 2, 250, 'You rarely write first<number>(…) — the compiler infers T for you.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const conditionalFlow: FigureBuilder = () => {
  const f = new Fig(W, 290, 'A conditional type is an if statement for types. T extends string ? yes : no. Given string it picks yes; given number it picks no. Given a union, it runs once per member and unions the results.');
  f.box(200, 16, 240, 48, { tone: 'accent', label: 'T extends string ? "yes" : "no"', mono: true, size: 12 });
  f.path('M270 64 L150 108', { arrow: true, tone: 'pass', width: 2 });
  f.path('M370 64 L490 108', { arrow: true, tone: 'fail', width: 2 });
  f.box(40, 108, 220, 44, { tone: 'pass', label: 'T = string  →  "yes"', mono: true, size: 12.5 });
  f.box(380, 108, 220, 44, { tone: 'fail', label: 'T = number  →  "no"', mono: true, size: 12.5 });
  f.line(16, 172, 624, 172, { tone: 'muted', dashed: true });
  f.text(W / 2, 196, 'Given a UNION it distributes — one answer per member:', { anchor: 'middle', size: 13, bold: true });
  f.box(16, 214, 190, 44, { tone: 'ink', label: 'string | number', mono: true });
  f.path('M208 236 H246', { arrow: true, width: 2 });
  f.box(248, 206, 150, 28, { tone: 'pass', label: 'string → "yes"', mono: true, size: 11.5 });
  f.box(248, 238, 150, 28, { tone: 'fail', label: 'number → "no"', mono: true, size: 11.5 });
  f.path('M400 236 H438', { arrow: true, width: 2 });
  f.box(440, 214, 184, 44, { tone: 'accent', label: '"yes" | "no"', mono: true });
  return f;
};

const narrowingFunnel: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Narrowing: a value of type string or number or null goes through checks. After typeof x equals string, x is string. After the null check fails, it is number. Each branch knows a smaller type.');
  f.box(220, 14, 200, 44, { tone: 'ink', label: 'x: string | number | null', mono: true, size: 12 });
  f.path('M320 58 V84', { arrow: true, width: 2 });
  f.box(200, 84, 240, 40, { tone: 'accent', label: 'if (x === null) return', mono: true, size: 12 });
  f.path('M320 124 V150', { arrow: true, width: 2 });
  f.text(336, 142, 'x: string | number', { size: 11.5, tone: 'muted', mono: true });
  f.box(200, 150, 240, 40, { tone: 'accent', label: 'if (typeof x === "string")', mono: true, size: 12 });
  f.path('M240 190 L130 226', { arrow: true, tone: 'pass', width: 2 });
  f.path('M400 190 L510 226', { arrow: true, tone: 'info', width: 2 });
  f.box(20, 226, 220, 40, { tone: 'pass', label: 'x: string  (true branch)', mono: true, size: 12 });
  f.box(400, 226, 220, 40, { tone: 'info', label: 'x: number  (else)', mono: true, size: 12 });
  return f;
};

/* ───────────────────────── Mapped, conditional & template-literal types ───────────────────────── */

const mappedTable: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A mapped type loops over the keys of a type and builds a new type. Getters of an object with name string and age number becomes getName returning string and getAge returning number: each key is renamed and each value type wrapped in a function.');
  f.text(16, 24, 'Getters<T>  =  { [K in keyof T as `get${Capitalize<K>}`]: () => T[K] }', { mono: true, size: 12, bold: true });
  f.box(16, 54, 230, 120, { tone: 'ink' });
  f.text(131, 78, 'T (input)', { anchor: 'middle', size: 12, tone: 'muted', bold: true });
  f.text(40, 108, 'name: string', { mono: true }); f.text(40, 140, 'age:  number', { mono: true });
  f.path('M250 108 H388', { arrow: true, tone: 'accent', width: 2 }); f.path('M250 140 H388', { arrow: true, tone: 'accent', width: 2 });
  f.text(319, 100, 'rename key', { anchor: 'middle', size: 11.5, tone: 'accent', bold: true });
  f.text(319, 158, 'wrap value', { anchor: 'middle', size: 11.5, tone: 'accent', bold: true });
  f.box(392, 54, 232, 120, { tone: 'pass' });
  f.text(508, 78, 'Getters<T> (output)', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(404, 108, 'getName: () => string', { mono: true, size: 12 }); f.text(404, 140, 'getAge: () => number', { mono: true, size: 12 });
  f.text(W / 2, 208, 'K takes each key in turn: "name", then "age". `as` renames it; T[K] looks up its value type.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(W / 2, 230, 'Remap a key to never and it disappears from the result.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const templateParse: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Template literal types can parse strings. The pattern dollar-brace infer H slash string matches the text /users/:id and splits it into pieces the compiler can name and reuse.');
  f.text(16, 24, 'S extends `${infer Head}_${infer Rest}` ? … : …', { mono: true, bold: true, size: 12.5 });
  f.box(16, 44, 608, 44, { tone: 'ink', label: '"hello_world_ts"', mono: true });
  f.path('M320 90 V116', { arrow: true, width: 2 });
  f.text(336, 108, 'match the pattern', { size: 11.5, tone: 'muted' });
  f.box(16, 116, 190, 44, { tone: 'info', label: 'Head = "hello"', mono: true, size: 12 });
  f.text(212, 144, '_', { size: 20, bold: true, tone: 'accent' });
  f.box(230, 116, 394, 44, { tone: 'info', label: 'Rest = "world_ts"', mono: true, size: 12 });
  f.path('M320 162 V188', { arrow: true, tone: 'accent', width: 2 });
  f.text(336, 180, 'recurse on Rest', { size: 11.5, tone: 'accent' });
  f.box(16, 188, 608, 44, { tone: 'pass', label: '"hello" + Capitalize<Camel<"world_ts">>  →  "helloWorldTs"', mono: true, size: 12 });
  return f;
};

const recursionUnroll: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A recursive type calls itself on a smaller input until it reaches a base case. Flatten of number array array unwraps one array layer per call until only number is left.');
  const steps = ['Flatten<number[][][]>', 'Flatten<number[][]>', 'Flatten<number[]>', 'Flatten<number>'];
  steps.forEach((s, i) => {
    const x = 16 + i * 158;
    f.box(x, 50, 148, 44, { tone: i === 3 ? 'pass' : 'info', label: s, mono: true, size: 10.5 });
    if (i < 3) f.path(`M${x + 150} 72 H${x + 156}`, { arrow: true, width: 2 });
  });
  f.text(W / 2, 30, 'each call peels one [] off (infer U)[]', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  f.text(16, 130, 'Recursive case:  T extends (infer U)[]  →  Flatten<U>', { mono: true, size: 12 });
  f.text(16, 158, 'Base case:       anything else         →  T', { mono: true, size: 12 });
  f.box(200, 184, 240, 44, { tone: 'pass', label: 'result: number', mono: true });
  f.path('M566 94 C566 140 440 190 442 204', { arrow: true, tone: 'pass', dashed: true });
  return f;
};

/* ───────────────────────── Typing real code ───────────────────────── */

const eventMap: FigureBuilder = () => {
  const f = new Fig(W, 260, 'An event map relates each event name to its payload types. Calling emit with the name login requires one string; calling it with message requires two strings. The compiler reads the tuple for that key.');
  f.box(16, 20, 340, 110, { tone: 'info' });
  f.text(30, 42, 'type Events = {', { mono: true, size: 12 });
  f.text(44, 66, 'login:   [user: string];', { mono: true, size: 12 });
  f.text(44, 88, 'logout:  [];', { mono: true, size: 12 });
  f.text(44, 110, 'message: [from: string, body: string];', { mono: true, size: 11.5 });
  f.text(30, 126, '}', { mono: true, size: 12 });
  f.box(390, 20, 234, 110, { tone: 'ink' });
  f.text(402, 42, 'emit<K extends keyof E>(', { mono: true, size: 12 });
  f.text(416, 64, 'event: K,', { mono: true, size: 12 });
  f.text(416, 86, '...args: E[K]', { mono: true, size: 12, tone: 'accent', bold: true });
  f.text(402, 108, ')', { mono: true, size: 12 });
  f.path('M358 70 H388', { arrow: true, tone: 'accent', width: 2 });
  const rows: [string, string, Tone][] = [['emit("login", "ada")', '✓ [user: string]', 'pass'], ['emit("message", "ada", "hi")', '✓ [from, body]', 'pass'], ['emit("login", 42)', '✗ 42 is not a string', 'fail'], ['emit("nope")', '✗ unknown event', 'fail']];
  rows.forEach(([c, r, tone], i) => {
    const y = 152 + i * 26;
    f.text(16, y + 14, c, { mono: true, size: 12 });
    f.text(300, y + 14, r, { size: 12.5, tone, bold: true });
  });
  return f;
};


const typeGuard: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A type guard is a function whose return type, x is string, promises the compiler that when it returns true, x is a string. Inside the if, x is narrowed; outside it is still unknown.');
  f.box(16, 20, 190, 44, { tone: 'ink', label: 'v: unknown', mono: true });
  f.path('M208 42 H246', { arrow: true, width: 2 });
  f.box(248, 14, 376, 56, { tone: 'accent', label: 'function isString(x): x is string', sub: 'the return type is a PROMISE to the compiler', mono: true, size: 12 });
  f.path('M350 70 L190 120', { arrow: true, tone: 'pass', width: 2 });
  f.path('M520 70 L520 120', { arrow: true, tone: 'fail', width: 2 });
  f.text(250, 100, 'true', { size: 12.5, tone: 'pass', bold: true }); f.text(534, 100, 'false', { size: 12.5, tone: 'fail', bold: true });
  f.box(40, 120, 300, 50, { tone: 'pass', label: 'v: string  (narrowed!)', sub: 'v.toUpperCase() is allowed', mono: true, size: 12.5 });
  f.box(400, 120, 224, 50, { tone: 'fail', label: 'v: unknown', sub: 'still must be checked', mono: true, size: 12.5 });
  f.text(W / 2, 206, 'The compiler TRUSTS the predicate. A wrong one is a silent bug,', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.text(W / 2, 228, 'so keep guards tiny and obviously correct.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const routeParams: FigureBuilder = () => {
  const f = new Fig(W, 250, 'The compiler reads a route pattern string. From /users/:id/posts/:postId it extracts the parameter names id and postId, so buildPath must be given exactly an object with those two string properties.');
  f.box(16, 20, 608, 44, { tone: 'ink', label: '"/users/:id/posts/:postId"', mono: true });
  f.path('M320 66 V92', { arrow: true, tone: 'accent', width: 2 });
  f.text(336, 84, 'template literal type + infer', { size: 11.5, tone: 'accent' });
  f.box(16, 94, 290, 44, { tone: 'info', label: 'Params = "id" | "postId"', mono: true, size: 12.5 });
  f.box(334, 94, 290, 44, { tone: 'info', label: '{ id: string; postId: string }', mono: true, size: 12.5 });
  f.path('M306 116 H332', { arrow: true, width: 2 });
  const rows: [string, string, import('./kit').Tone][] = [['buildPath(p, { id: "1", postId: "2" })', '✓ exact match', 'pass'], ['buildPath(p, { id: "1" })', '✗ postId is missing', 'fail'], ['buildPath(p, { id: "1", postId: "2", x: "3" })', '✗ x is not a param', 'fail']];
  rows.forEach(([c, r, tone], i) => {
    const y = 162 + i * 28;
    f.text(16, y + 14, c, { mono: true, size: 11.5 });
    f.text(440, y + 14, r, { size: 12.5, tone, bold: true });
  });
  return f;
};

export const tsFigures: Record<string, FigureBuilder> = {
  'generic-slot': genericSlot,
  'conditional-flow': conditionalFlow,
  'narrowing-funnel': narrowingFunnel,
  'mapped-table': mappedTable,
  'template-parse': templateParse,
  'recursion-unroll': recursionUnroll,
  'event-map': eventMap,
  'type-guard': typeGuard,
  'route-params': routeParams,
};
