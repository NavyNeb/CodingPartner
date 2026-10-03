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

export const testingFigures: Record<string, FigureBuilder> = {
  'tst-pyramid': testPyramid,
  'tst-aaa': arrangeActAssert,
  'tst-mutants': mutantGrading,
};
