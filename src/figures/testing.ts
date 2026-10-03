import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 1 · First tests ───────────────────────── */

const testPyramid: FigureBuilder = () => {
  const f = new Fig(W, 250, 'The test pyramid. A wide base of many fast unit tests, a middle layer of fewer integration tests that combine several parts, and a narrow top of a few slow end-to-end tests that drive the whole app. Lower layers are faster and point at bugs precisely; higher layers are more realistic but slower and more fragile.');
  const layer = (pts: string, tone: Tone, label: string, x: number, y: number) => {
    f.raw(`<polygon class="f-box t-${tone} solid" points="${pts}"/>`);
    f.text(x, y, label, { anchor: 'middle', size: 13, bold: true, tone });
  };
  layer('200,20 240,80 160,80', 'fail', 'E2E', 200, 66);
  layer('156,88 244,88 276,150 124,150', 'accent', 'integration', 200, 124);
  layer('120,158 280,158 322,222 78,222', 'pass', 'unit tests', 200, 196);
  f.lines(356, 44, ['End-to-end: the whole app in a browser.', 'A few: slow, realistic, can be flaky.'], { size: 12, gap: 18 });
  f.lines(356, 112, ['Integration: several parts working together.', 'Some: moderate speed and realism.'], { size: 12, gap: 18 });
  f.lines(356, 182, ['Unit: one function or component.', 'Many: milliseconds each, pinpoint the bug.'], { size: 12, gap: 18 });
  f.text(W / 2, 244, 'Most of your tests should be at the bottom: cheap to run, precise when they fail.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const arrangeActAssert: FigureBuilder = () => {
  const f = new Fig(W, 260, 'The Arrange, Act, Assert structure of a test. Arrange: set up the inputs and objects, for example create a cart and add two apples. Act: do the one thing being tested, for example read the total. Assert: check the result with expect.');
  const parts: [string, string, string[], Tone][] = [
    ['1 · Arrange', 'set the scene', ['const cart = new Cart();', "cart.add('apple', 2);"], 'info'],
    ['2 · Act', 'do the one thing', ['const total = cart.total();'], 'accent'],
    ['3 · Assert', 'check the outcome', ['expect(total).toBe(3);'], 'pass'],
  ];
  parts.forEach(([title, sub, code, tone], i) => {
    const x = 16 + i * 208;
    f.box(x, 24, 196, 118, { tone });
    f.text(x + 98, 50, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.text(x + 98, 68, sub, { anchor: 'middle', size: 12, tone: 'muted' });
    f.lines(x + 12, 96, code, { size: 11.5, mono: true, gap: 18 });
    if (i < 2) f.path(`M${x + 198} 83 H${x + 206}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(W / 2, 176, 'it("total is 0 for an empty cart", …)    name = the behaviour + the situation', { anchor: 'middle', size: 12.5, mono: true, bold: true });
  f.text(W / 2, 206, 'One behaviour per test, so a failure tells you exactly what broke.', { anchor: 'middle', size: 12.5 });
  f.text(W / 2, 232, 'If you need "and" in the name, you probably have two tests.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const mutantGrading: FigureBuilder = () => {
  const f = new Fig(W, 290, 'How exercises that ask you to write tests are graded. Your test function runs against the correct implementation, where every assertion must pass, and against several deliberately broken copies called mutants, where at least one assertion must fail for each. A good suite is green on the real code and red on every broken copy.');
  f.box(16, 98, 170, 88, { tone: 'accent', solid: true, label: 'your tests', sub: 'checkClamp(clamp)', mono: true, size: 14 });
  const rows: [string, string, Tone][] = [
    ['the real clamp', 'every assertion passes  ✓', 'pass'],
    ['mutant: no upper bound', 'an assertion throws  ✗', 'fail'],
    ['mutant: off by one at the top', 'an assertion throws  ✗', 'fail'],
    ['mutant: rounds decimals', 'an assertion throws  ✗', 'fail'],
  ];
  rows.forEach(([name, result, tone], i) => {
    const y = 20 + i * 62;
    f.path(`M190 142 L262 ${y + 24}`, { arrow: true, tone: tone === 'pass' ? 'pass' : 'fail', width: 1.6 });
    f.box(266, y, 358, 48, { tone, solid: true, label: name, sub: result, size: 12.5 });
  });
  f.text(W / 2, 282, 'Green on the real code, red on every broken copy: that is a suite that can catch bugs.', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

/* ───────────────────────── 2 · Cases & edges ───────────────────────── */

const equivalenceClasses: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Equivalence classes and boundaries for a ticket price by age. Ages below 0 are an error, 0 to 12 are free, 13 to 64 pay 10 and 65 and over pay 6. Test one typical value in each class, and both sides of each boundary: minus 1 and 0, 12 and 13, 64 and 65.');
  const classes: [string, string, Tone][] = [['age < 0', 'throws RangeError', 'fail'], ['0 … 12', 'free', 'info'], ['13 … 64', 'pays 10', 'accent'], ['65 and over', 'pays 6', 'pass']];
  classes.forEach(([a, b, tone], i) => f.box(16 + i * 156, 30, 140, 56, { tone, solid: true, label: a, sub: b, mono: true, size: 13 }));
  f.text(16, 24, 'the input space splits into classes that behave the same', { size: 12, bold: true, tone: 'muted' });
  f.text(16, 118, 'one typical value per class:', { size: 12, bold: true, tone: 'muted' });
  [['-5', 0], ['5', 1], ['30', 2], ['80', 3]].forEach(([v, i]) => f.pill(16 + (i as number) * 156 + 50, 128, v as string, 'ink'));
  f.text(16, 182, 'both sides of every boundary (bugs hide here):', { size: 12, bold: true, tone: 'muted' });
  [['-1 | 0', 0], ['12 | 13', 1], ['64 | 65', 2]].forEach(([v, i]) => {
    const x = 16 + ((i as number) + 1) * 156 - 8;
    f.path(`M${x} 90 V196`, { tone: 'accent', dashed: true, width: 1.5 });
    f.pill(x - 40, 202, v as string, 'accent');
  });
  f.text(W / 2, 258, 'Off-by-one mistakes (< versus <=) only show up when you test exactly at the edge.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const edgeChecklist: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A checklist of edge inputs to try: empty, a single item, many items, duplicates, zero and negatives, boundaries, unusual values like NaN, null and undefined, different orderings such as sorted and reversed, and very large inputs.');
  const cards: [string, string][] = [
    ['empty', '[]   ""   {}'], ['one item', '[x]   "a"'], ['many items', 'a long list'],
    ['duplicates', '[1, 1, 1]'], ['zero & negatives', '0   -1   -0.5'], ['boundaries', 'min · max · min−1 · max+1'],
    ['unusual values', 'NaN · null · undefined · " "'], ['order', 'sorted · reversed · shuffled'], ['big', '10⁶ items · huge numbers'],
  ];
  cards.forEach(([title, ex], i) => {
    const x = 16 + (i % 3) * 208, y = 20 + Math.floor(i / 3) * 76;
    f.box(x, y, 196, 64, { tone: i % 2 ? 'info' : 'accent', label: title, sub: ex, size: 13 });
  });
  f.text(W / 2, 258, 'Run through this list for every function you test: each line has caught real bugs.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const tableDriven: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A table-driven test. A table of cases, each with inputs and the expected result, is looped over to produce one named test per row. Adding a case means adding one row.');
  const rows: [string, string, string][] = [['2', '3', '5'], ['-2', '-3', '-5'], ['0', '0', '0'], ['1.5', '2.25', '3.75']];
  f.text(16, 24, 'the table', { size: 12.5, bold: true, tone: 'muted' });
  ['a', 'b', 'expected'].forEach((h, i) => f.text(48 + i * 84, 46, h, { anchor: 'middle', size: 12, mono: true, bold: true, tone: 'accent' }));
  rows.forEach((r, i) => r.forEach((v, j) => f.box(16 + j * 84, 54 + i * 40, 66, 32, { tone: j === 2 ? 'pass' : 'info', label: v, mono: true, size: 13 })));
  f.path('M278 120 H334', { arrow: true, tone: 'accent', width: 2 });
  f.text(306, 108, 'it.each', { anchor: 'middle', size: 12, mono: true, bold: true, tone: 'accent' });
  f.text(350, 24, 'one test per row', { size: 12.5, bold: true, tone: 'muted' });
  rows.forEach(([a, b, e], i) => f.box(350, 54 + i * 40, 274, 32, { tone: 'pass', solid: true, label: `✓ add(${a}, ${b}) → ${e}`, mono: true, size: 12 }));
  f.text(W / 2, 236, 'Adding a case = adding one row. Failures name the exact row that broke.', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

/* ───────────────────────── 3 · Test doubles ───────────────────────── */

const doublesKinds: FigureBuilder = () => {
  const f = new Fig(W, 290, 'The five kinds of test double. A dummy is passed in but never used. A stub returns canned answers. A spy records how it was called. A mock is set up with expectations about its calls. A fake is a simplified but working implementation such as an in-memory repository.');
  const rows: [string, string, string, Tone][] = [
    ['dummy', 'passed in, never actually used', 'createNotifier({ api: {} })', 'muted'],
    ['stub', 'returns canned answers', 'jest.fn(() => 42)', 'info'],
    ['spy', 'records how it was called', 'jest.fn()   →   fn.mock.calls', 'accent'],
    ['mock', 'a spy with expectations about the calls', 'expect(fn).toHaveBeenCalledTimes(1)', 'fail'],
    ['fake', 'a simplified but WORKING implementation', 'an in-memory repository built on a Map', 'pass'],
  ];
  rows.forEach(([name, desc, example, tone], i) => {
    const y = 14 + i * 52;
    f.box(16, y, 96, 44, { tone, solid: true, label: name, mono: true, size: 14 });
    f.text(126, y + 19, desc, { size: 12.5, bold: true });
    f.text(126, y + 37, example, { size: 11.5, mono: true, tone: 'muted' });
  });
  f.text(W / 2, 282, 'In Jest, jest.fn() can play stub, spy and mock, depending on how you use it.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const diSeam: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Dependency injection creates a seam for tests. When sendWelcome calls the real emailApi directly, every test would send a real email. When createNotifier receives the api as an argument, production passes the real emailApi and a test passes a fake object whose send is a jest.fn.');
  f.text(16, 20, 'hard-coded dependency', { size: 12.5, bold: true, tone: 'fail' });
  f.box(16, 30, 190, 46, { tone: 'ink', label: 'sendWelcome(user)', mono: true, size: 12.5 });
  f.path('M208 53 H266', { arrow: true, tone: 'fail', width: 2 });
  f.box(270, 30, 240, 46, { tone: 'fail', dashed: true, label: 'emailApi.send(…)', sub: 'a real network call', mono: true, size: 12.5 });
  f.text(520, 58, '✗ every test sends email', { size: 12, tone: 'fail', bold: true });
  f.text(16, 118, 'injected dependency: the "seam"', { size: 12.5, bold: true, tone: 'pass' });
  f.box(16, 150, 190, 46, { tone: 'ink', label: 'createNotifier({ api })', mono: true, size: 12.5 });
  f.path('M208 166 L266 146', { arrow: true, tone: 'pass', width: 2 });
  f.path('M208 180 L266 204', { arrow: true, tone: 'accent', width: 2 });
  f.box(270, 124, 240, 46, { tone: 'pass', solid: true, label: 'production: real emailApi', mono: true, size: 12 });
  f.box(270, 184, 240, 46, { tone: 'accent', solid: true, label: 'test: { send: jest.fn() }', mono: true, size: 12 });
  f.text(W / 2, 258, 'Pass collaborators in (clock, api, random) and a test can swap them for something controllable.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const stateVsInteraction: FigureBuilder = () => {
  const f = new Fig(W, 250, 'State-based versus interaction-based assertions. State-based tests check the result or the state afterwards, for example the cart total. Interaction-based tests check the calls that were made, for example that the email api was called once with the right address and message. Prefer state, and use interactions for side effects that leave no other trace.');
  const col = (x: number, title: string, code: string, bullets: string[], tone: Tone) => {
    f.box(x, 20, 296, 150, { tone });
    f.text(x + 148, 46, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.text(x + 148, 74, code, { anchor: 'middle', size: 11.5, mono: true });
    f.lines(x + 16, 104, bullets, { size: 12, gap: 20 });
  };
  col(16, 'state-based', 'expect(cart.total()).toBe(3)', ['look at the RESULT or the new state', 'survives refactors of the inside', 'prefer this whenever you can'], 'pass');
  col(328, 'interaction-based', 'expect(api.send).toHaveBeenCalledWith(…)', ['look at the CALLS that were made', 'right when the call IS the outcome', '(an email sent, an event fired)'], 'accent');
  f.text(W / 2, 204, 'Too many interaction assertions glue a test to the implementation:', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 226, 'reorder two internal calls and the test fails even though behaviour is unchanged.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

export const testingFigures: Record<string, FigureBuilder> = {
  'tst-pyramid': testPyramid,
  'tst-aaa': arrangeActAssert,
  'tst-mutants': mutantGrading,
  'tst-equivalence': equivalenceClasses,
  'tst-edge-checklist': edgeChecklist,
  'tst-table-driven': tableDriven,
  'tst-doubles': doublesKinds,
  'tst-di-seam': diSeam,
  'tst-state-vs-interaction': stateVsInteraction,
};
