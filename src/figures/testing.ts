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
    ['2 · Act', 'do the one thing', ['const t = cart.total();'], 'accent'],
    ['3 · Assert', 'check the outcome', ['expect(t).toBe(3);'], 'pass'],
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
  f.text(520, 50, '✗ every test', { size: 12, tone: 'fail', bold: true });
  f.text(520, 68, 'sends email', { size: 12, tone: 'fail', bold: true });
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

/* ───────────────────────── 4 · Async and time ───────────────────────── */

const asyncForgotAwait: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A test that forgets to await. Without await, the test function finishes immediately and passes before the promise has settled, so a rejected promise is never noticed. With await, the test waits for the promise and fails when it rejects.');
  const col = (x: number, title: string, code: string[], verdict: string, tone: Tone) => {
    f.box(x, 20, 296, 170, { tone });
    f.text(x + 148, 46, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.lines(x + 16, 76, code, { size: 11.5, mono: true, gap: 20 });
    f.text(x + 148, 168, verdict, { anchor: 'middle', size: 12, bold: true, tone });
  };
  col(16, 'forgot await', ["it('loads', () => {", '  expect(load()).resolves.toBe(1);', '});'], 'passes even if load() rejects', 'fail');
  col(328, 'awaited', ["it('loads', async () => {", '  await expect(load()).resolves.toBe(1);', '});'], 'fails when it should', 'pass');
  f.text(W / 2, 224, 'A promise you do not await is a promise you did not test.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const fakeClock: FigureBuilder = () => {
  const f = new Fig(W, 240, 'Fake timers. With the real clock a test waits one real second. With fake timers the test controls a pretend clock: calling advanceTimersByTime(1000) jumps forward at once and fires the timer, so the test takes a few milliseconds.');
  f.text(16, 24, 'real clock', { size: 13, bold: true, tone: 'fail' });
  f.path('M16 56 H624', { tone: 'muted', width: 2 });
  f.box(16, 40, 40, 32, { tone: 'ink', label: 'start', size: 11 });
  f.box(560, 40, 64, 32, { tone: 'fail', dashed: true, label: '1000 ms', size: 11 });
  f.text(300, 100, 'the test sits and waits for a whole second', { anchor: 'middle', size: 12, tone: 'fail' });
  f.text(16, 148, 'fake clock', { size: 13, bold: true, tone: 'pass' });
  f.path('M16 180 H624', { tone: 'muted', width: 2 });
  f.box(16, 164, 40, 32, { tone: 'ink', label: 'start', size: 11 });
  f.path('M60 180 C200 140 360 140 556 176', { arrow: true, tone: 'accent', width: 2 });
  f.box(560, 164, 64, 32, { tone: 'pass', solid: true, label: 'fired', size: 11 });
  f.text(300, 140, 'jest.advanceTimersByTime(1000)', { anchor: 'middle', size: 12, mono: true, tone: 'accent' });
  f.text(W / 2, 226, 'You decide when time passes, so the test is instant and the same every run.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const debounceTimeline: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A debounce timeline with a wait of 100 milliseconds. Calls at 0 and 60 milliseconds each restart the timer, so nothing runs until 100 milliseconds after the last call, at 160, and the function runs once with the last arguments. Without the reset it would run at 100.');
  f.path('M20 120 H620', { tone: 'muted', width: 2 });
  const tick = (x: number, label: string) => { f.path(`M${x} 112 V128`, { tone: 'muted', width: 2 }); f.text(x, 146, label, { anchor: 'middle', size: 11, tone: 'muted' }); };
  tick(40, '0'); tick(160, '60'); tick(340, '100'); tick(400, '160');
  f.box(20, 60, 40, 30, { tone: 'accent', solid: true, label: 'd(b)', mono: true, size: 11 });
  f.box(140, 60, 40, 30, { tone: 'accent', solid: true, label: 'd(c)', mono: true, size: 11 });
  f.path('M40 56 C40 30 330 30 340 54', { arrow: true, tone: 'fail', dashed: true, width: 1.5 });
  f.text(190, 28, 'timer restarted, so no call at 100', { anchor: 'middle', size: 11.5, tone: 'fail' });
  f.path('M160 56 C160 36 390 36 400 90', { arrow: true, tone: 'pass', width: 2 });
  f.box(364, 164, 72, 30, { tone: 'pass', solid: true, label: 'fn(c) once', mono: true, size: 11 });
  f.text(W / 2, 226, 'Debounce waits for quiet: only the last call of a burst gets through.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const retryBackoff: FigureBuilder = () => {
  const f = new Fig(W, 230, 'Retry with exponential backoff and three attempts. Attempt one fails, wait 100 milliseconds, attempt two fails, wait 200 milliseconds, attempt three fails and the last error is thrown. There is no wait after the last attempt.');
  const items: [number, string, Tone][] = [[16, 'try 1 ✗', 'fail'], [200, 'try 2 ✗', 'fail'], [384, 'try 3 ✗', 'fail']];
  items.forEach(([x, label, tone]) => f.box(x, 60, 100, 40, { tone, label, mono: true, size: 12 }));
  f.path('M118 80 H196', { arrow: true, tone: 'accent', width: 2 });
  f.path('M302 80 H380', { arrow: true, tone: 'accent', width: 2 });
  f.text(157, 70, 'sleep(100)', { anchor: 'middle', size: 11, mono: true, tone: 'accent' });
  f.text(341, 70, 'sleep(200)', { anchor: 'middle', size: 11, mono: true, tone: 'accent' });
  f.path('M486 80 H540', { arrow: true, tone: 'fail', width: 2 });
  f.box(544, 60, 80, 40, { tone: 'fail', solid: true, label: 'throw last', size: 11 });
  f.text(W / 2, 150, 'wait time doubles: 100 × 2^attempt', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 176, 'the sleep is injected, so a test passes a spy and never really waits', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 210, 'No sleep after the last failure: there is nothing left to wait for.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 5 · React Testing Library ───────────────────────── */

const queryLadder: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The Testing Library query priority. Prefer getByRole with a name, then getByLabelText for form fields, then getByText for plain content, and use getByTestId only as a last resort. The higher queries match what users and screen readers actually perceive, so the test also checks accessibility.');
  const rows: [string, string, Tone][] = [
    ['getByRole("button", { name: "Save" })', 'best: what assistive tech sees', 'pass'],
    ['getByLabelText("Email")', 'form fields, via their label', 'pass'],
    ['getByText("Saved!")', 'plain content', 'info'],
    ['getByTestId("save-btn")', 'last resort: invisible to users', 'fail'],
  ];
  rows.forEach(([code, why, tone], i) => {
    const y = 20 + i * 54;
    f.box(16, y, 330, 42, { tone, label: code, mono: true, size: 11.5 });
    f.text(362, y + 26, why, { size: 12, tone: tone === 'fail' ? 'fail' : 'muted' });
  });
  f.text(W / 2, 252, 'Query like a user, and your test survives refactors and checks accessibility for free.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const queryKinds: FigureBuilder = () => {
  const f = new Fig(W, 250, 'The three query families. getBy throws if the element is missing and is used for things that must be there. queryBy returns null if missing and is used to assert that something is absent. findBy returns a promise that waits for the element to appear and is used for things that show up later.');
  const col = (x: number, name: string, how: string[], use: string, tone: Tone) => {
    f.box(x, 20, 196, 180, { tone });
    f.text(x + 98, 46, name, { anchor: 'middle', size: 14, bold: true, mono: true, tone });
    f.lines(x + 12, 76, how, { size: 11.5, gap: 20 });
    f.text(x + 98, 176, use, { anchor: 'middle', size: 11.5, bold: true, tone });
  };
  col(16, 'getBy…', ['sync', 'throws if missing', 'throws if several'], 'must be there now', 'pass');
  col(222, 'queryBy…', ['sync', 'null if missing', 'throws if several'], 'assert it is gone', 'info');
  col(428, 'findBy…', ['async: await it', 'waits up to a moment', 'rejects on timeout'], 'appears later', 'accent');
  f.text(W / 2, 232, 'Pick by the question: must it exist, must it be absent, or will it arrive?', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const rtlFlow: FigureBuilder = () => {
  const f = new Fig(W, 230, 'The flow of a component test. Render the component, find elements the way a user would, interact with userEvent, then assert on what the screen shows. The test never touches state or internals.');
  const steps: [string, string, Tone][] = [
    ['render', 'render(<Counter />)', 'info'],
    ['find', 'screen.getByRole(…)', 'accent'],
    ['act', 'await userEvent.click(…)', 'accent'],
    ['assert', 'expect(…).toBeInTheDocument()', 'pass'],
  ];
  steps.forEach(([title, code, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 30, 146, 110, { tone });
    f.text(x + 73, 56, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.text(x + 73, 92, code.slice(0, 18), { anchor: 'middle', size: 10.5, mono: true });
    f.text(x + 73, 110, code.slice(18), { anchor: 'middle', size: 10.5, mono: true });
    if (i < 3) f.path(`M${x + 148} 85 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(W / 2, 176, 'Test what the user can see and do, not how the component is built inside.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 204, 'Rename a state variable and every test still passes. Break the button and one fails.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

/* ───────────────────────── 6 · TDD and testability ───────────────────────── */

const redGreenRefactor: FigureBuilder = () => {
  const f = new Fig(W, 260, 'The red, green, refactor cycle of test-driven development. Red: write a small failing test. Green: write the simplest code that makes it pass. Refactor: clean up while the tests stay green. Then repeat with the next small behaviour.');
  const node = (x: number, y: number, title: string, sub: string, tone: Tone) => {
    f.box(x, y, 160, 64, { tone, solid: true });
    f.text(x + 80, y + 28, title, { anchor: 'middle', size: 15, bold: true });
    f.text(x + 80, y + 48, sub, { anchor: 'middle', size: 11.5 });
  };
  node(240, 16, 'RED', 'a failing test', 'fail');
  node(430, 120, 'GREEN', 'simplest code', 'pass');
  node(50, 120, 'REFACTOR', 'tidy up', 'info');
  f.path('M400 52 C470 52 500 80 510 116', { arrow: true, tone: 'muted', width: 2 });
  f.path('M430 168 C360 220 280 220 210 176', { arrow: true, tone: 'muted', width: 2 });
  f.path('M130 116 C140 80 170 52 236 52', { arrow: true, tone: 'muted', width: 2 });
  f.text(320, 120, 'small steps,', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(320, 138, 'minutes each', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 250, 'The failing test proves the test can fail; the green proves the code works.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const coreShell: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Functional core, imperative shell. The shell is a thin outer layer that talks to the clock, network and database. Inside it sits a pure core of functions that only compute from their inputs. Test the core with plain inputs and outputs, and the shell with a few fake collaborators.');
  f.box(16, 16, 608, 200, { tone: 'accent', dashed: true });
  f.text(36, 40, 'imperative shell: clock, network, database, logging', { size: 12.5, bold: true, tone: 'accent' });
  f.box(150, 62, 340, 120, { tone: 'pass', solid: true });
  f.text(320, 92, 'pure core', { anchor: 'middle', size: 15, bold: true });
  f.text(320, 118, 'summarize(orders) → { count, total }', { anchor: 'middle', size: 11.5, mono: true });
  f.text(320, 144, 'no clock, no network, no surprises', { anchor: 'middle', size: 12 });
  f.text(320, 166, 'tested with plain inputs and outputs', { anchor: 'middle', size: 12, bold: true });
  f.text(70, 130, 'fakes', { anchor: 'middle', size: 12, tone: 'accent', bold: true });
  f.text(70, 148, 'for a few', { anchor: 'middle', size: 11, tone: 'muted' });
  f.text(70, 164, 'tests', { anchor: 'middle', size: 11, tone: 'muted' });
  f.text(W / 2, 246, 'Most logic lives in the core, so most tests are fast and need no doubles.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const nondeterminism: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Sources of non-determinism and how to tame them. Time: inject a clock. Randomness: inject a random function. Network: inject a fetcher. Environment and files: pass them in as arguments. Each one becomes a parameter the test can control.');
  const rows: [string, string][] = [
    ['new Date()', 'clock.now()'],
    ['Math.random()', 'random()'],
    ['fetch(url)', 'fetcher(url)'],
    ['process.env.X', 'config.x'],
  ];
  f.text(150, 20, 'hidden in the code', { anchor: 'middle', size: 12, bold: true, tone: 'fail' });
  f.text(500, 20, 'passed in', { anchor: 'middle', size: 12, bold: true, tone: 'pass' });
  rows.forEach(([bad, good], i) => {
    const y = 32 + i * 46;
    f.box(30, y, 240, 34, { tone: 'fail', dashed: true, label: bad, mono: true, size: 12 });
    f.path(`M274 ${y + 17} H356`, { arrow: true, tone: 'accent', width: 2 });
    f.box(360, y, 240, 34, { tone: 'pass', solid: true, label: good, mono: true, size: 12 });
  });
  f.text(W / 2, 236, 'Wherever the world leaks in, add a parameter. Production passes the real thing.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 7 · Test quality ───────────────────────── */

const flakyCauses: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Common causes of flaky tests and their fixes. Real time: use fake timers or an injected clock. Randomness: inject a seeded or fixed random function. Shared state between tests: reset or create fresh state in each test. Order dependence: make every test set up its own world. Unawaited async work: await it, or wait for a visible result.');
  const rows: [string, string][] = [
    ['real time and sleeps', 'fake timers / injected clock'],
    ['randomness', 'injected, fixed random()'],
    ['state shared between tests', 'fresh state in every test'],
    ['tests that need a run order', 'each test builds its own world'],
    ['async work not awaited', 'await it, or findBy / waitFor'],
  ];
  f.text(170, 18, 'cause', { anchor: 'middle', size: 12, bold: true, tone: 'fail' });
  f.text(480, 18, 'fix', { anchor: 'middle', size: 12, bold: true, tone: 'pass' });
  rows.forEach(([cause, fix], i) => {
    const y = 28 + i * 44;
    f.box(16, y, 290, 34, { tone: 'fail', dashed: true, label: cause, size: 12 });
    f.path(`M310 ${y + 17} H336`, { arrow: true, tone: 'accent', width: 2 });
    f.box(340, y, 284, 34, { tone: 'pass', solid: true, label: fix, size: 12 });
  });
  f.text(W / 2, 252, 'A flaky test is worse than no test: people stop trusting the red.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const coverageLie: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Coverage versus mutation score. A test that merely runs the code gives one hundred percent line coverage but kills no mutants, because it asserts nothing. A test with real assertions at the boundary kills the mutants, so the mutation score is what measures whether tests would notice bugs.');
  const col = (x: number, title: string, code: string, a: string, b: string, tone: Tone) => {
    f.box(x, 20, 296, 170, { tone });
    f.text(x + 148, 46, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.text(x + 148, 76, code, { anchor: 'middle', size: 11, mono: true });
    f.text(x + 148, 118, a, { anchor: 'middle', size: 12.5, bold: true });
    f.text(x + 148, 146, b, { anchor: 'middle', size: 12.5, bold: true, tone });
  };
  col(16, 'runs the code', 'isAdult(30);', 'line coverage: 100%', 'mutants killed: 0 / 3', 'fail');
  col(328, 'asserts at the edge', 'expect(isAdult(18)).toBe(true)', 'line coverage: 100%', 'mutants killed: 3 / 3', 'pass');
  f.text(W / 2, 224, 'Coverage says the code ran. Only assertions say it was checked.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const brittleVsRobust: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Brittle versus robust tests when the implementation is refactored. A brittle test checks internals such as a private field or the exact order of internal calls and breaks on a harmless refactor. A robust test checks the observable behaviour and keeps passing, and still fails when behaviour really changes.');
  const col = (x: number, title: string, lines: string[], verdict: string, tone: Tone) => {
    f.box(x, 20, 296, 190, { tone });
    f.text(x + 148, 46, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.lines(x + 14, 78, lines, { size: 11.5, mono: true, gap: 20 });
    f.text(x + 148, 188, verdict, { anchor: 'middle', size: 12, bold: true, tone });
  };
  col(16, 'brittle', ['expect(cart._items.length)', '  .toBe(2);', 'expect(db.save)', '  .toHaveBeenCalledBefore(log)'], 'breaks on a harmless refactor', 'fail');
  col(328, 'robust', ['cart.add(apple);', 'cart.add(pear);', 'expect(cart.total())', '  .toBe(3);'], 'only breaks when behaviour breaks', 'pass');
  f.text(W / 2, 240, 'Assert on what callers can observe; leave the inside free to change.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 8 · Capstone ───────────────────────── */

const suiteRecipe: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A recipe for building a test suite from a specification. First list every rule in the spec. Then write at least one test per rule. Then add the boundary on both sides of every limit. Then cover empty, one and many, and the error cases. Last, check that inputs are not mutated and that state carries over between calls. After that, ask which broken version would still pass.');
  const steps: [string, string][] = [
    ['1 · list the rules', 'every sentence in the spec is a rule'],
    ['2 · one test per rule', 'the happy path of each'],
    ['3 · both sides of limits', '49.99 and 50, 999 and 1000'],
    ['4 · empty, one, many, errors', 'the shapes of input'],
    ['5 · state and side effects', 'input untouched, state carried over'],
    ['6 · ask: what still passes?', 'invent a mutant, then kill it'],
  ];
  steps.forEach(([title, sub], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 16 + col * 312, y = 16 + row * 80;
    f.box(x, y, 296, 66, { tone: i === 5 ? 'accent' : 'info', solid: i === 5 });
    f.text(x + 148, y + 28, title, { anchor: 'middle', size: 13, bold: true });
    f.text(x + 148, y + 48, sub, { anchor: 'middle', size: 11.5, tone: 'muted' });
  });
  f.text(W / 2, 262, 'Spec in, suite out: a checklist beats inspiration.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const riskMap: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Choosing what to test first. A grid of how likely something is to break against how bad it is when it does. Test first the code that is likely to break and costly when it does, such as money and permissions. Test lightly the code that is unlikely to break and harmless, such as a label.');
  f.box(60, 16, 260, 100, { tone: 'info' });
  f.box(324, 16, 260, 100, { tone: 'fail', solid: true });
  f.box(60, 120, 260, 100, { tone: 'muted' });
  f.box(324, 120, 260, 100, { tone: 'info' });
  f.text(190, 60, 'costly, unlikely', { anchor: 'middle', size: 13, bold: true });
  f.text(190, 82, 'cover the key cases', { anchor: 'middle', size: 11.5 });
  f.text(454, 60, 'costly AND likely', { anchor: 'middle', size: 13, bold: true });
  f.text(454, 82, 'test first, test hard', { anchor: 'middle', size: 11.5 });
  f.text(190, 164, 'cheap, unlikely', { anchor: 'middle', size: 13, bold: true });
  f.text(190, 186, 'little or nothing', { anchor: 'middle', size: 11.5 });
  f.text(454, 164, 'cheap, likely', { anchor: 'middle', size: 13, bold: true });
  f.text(454, 186, 'quick tests', { anchor: 'middle', size: 11.5 });
  f.text(322, 240, 'cost when it breaks →', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.text(W / 2, 260, 'Money, permissions and data loss come before labels and colours.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const debugLoop: FigureBuilder = () => {
  const f = new Fig(W, 230, 'Debugging with tests. Reproduce the bug as a small failing test, change the code until the test passes, run all the tests to make sure nothing else broke, and keep the test so the bug cannot return.');
  const steps: [string, string, Tone][] = [
    ['reproduce', 'smallest failing input', 'fail'],
    ['fix', 'change the code', 'accent'],
    ['all green', 'run every test', 'pass'],
    ['keep it', 'the test stays', 'info'],
  ];
  steps.forEach(([title, sub, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 30, 146, 90, { tone, solid: i === 2 });
    f.text(x + 73, 66, title, { anchor: 'middle', size: 14, bold: true });
    f.text(x + 73, 90, sub, { anchor: 'middle', size: 11.5 });
    if (i < 3) f.path(`M${x + 148} 75 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(W / 2, 166, 'The failing test is the bug report that never goes out of date.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 194, 'Shrink the input until the failure is obvious, then you usually see the cause.', { anchor: 'middle', size: 12, tone: 'muted' });
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
  'tst-forgot-await': asyncForgotAwait,
  'tst-fake-clock': fakeClock,
  'tst-debounce': debounceTimeline,
  'tst-retry': retryBackoff,
  'tst-query-ladder': queryLadder,
  'tst-query-kinds': queryKinds,
  'tst-rtl-flow': rtlFlow,
  'tst-red-green': redGreenRefactor,
  'tst-core-shell': coreShell,
  'tst-nondeterminism': nondeterminism,
  'tst-flaky-causes': flakyCauses,
  'tst-coverage-lie': coverageLie,
  'tst-brittle': brittleVsRobust,
  'tst-suite-recipe': suiteRecipe,
  'tst-risk-map': riskMap,
  'tst-debug-loop': debugLoop,
};
