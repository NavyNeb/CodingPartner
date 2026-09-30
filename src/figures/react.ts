import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── Components, props & rendering lists ───────────────────────── */

const jsxPipeline: FigureBuilder = () => {
  const f = new Fig(W, 230, 'JSX is turned into a plain JavaScript object called a React element. React compares the new elements with the previous ones and only changes the parts of the real page that differ.');
  f.box(16, 30, 180, 70, { tone: 'info', label: 'JSX you write', sub: '<h1>Hi</h1>', mono: true, size: 12 });
  f.box(230, 30, 180, 70, { tone: 'accent', label: 'React element', sub: '{ type: "h1", props }', mono: true, size: 12 });
  f.box(444, 30, 180, 70, { tone: 'pass', label: 'Real DOM', sub: 'only what changed' });
  f.path('M198 65 H228', { arrow: true, width: 2 }); f.path('M412 65 H442', { arrow: true, width: 2 });
  f.text(213, 55, 'compiles', { anchor: 'middle', size: 10.5, tone: 'muted' });
  f.text(427, 55, 'diff', { anchor: 'middle', size: 10.5, tone: 'muted' });
  f.text(320, 138, 'An element is just a cheap description — not a DOM node.', { anchor: 'middle', size: 13, bold: true });
  f.text(320, 162, 'Components are functions:  props  →  elements.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(320, 184, 'Same props in, same elements out — so keep render pure.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const renderCommit: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A React update has phases. Render calls your component functions and must be pure. React diffs the result. Commit applies changes to the DOM. Effects run after the commit, which is where side effects belong.');
  const phases: [string, string, Tone][] = [['1 · Render', 'call components', 'info'], ['2 · Diff', 'compare to last', 'muted'], ['3 · Commit', 'update the DOM', 'accent'], ['4 · Effects', 'useEffect runs', 'pass']];
  phases.forEach(([n, sub, tone], i) => {
    const x = 16 + i * 158;
    f.box(x, 40, 140, 56, { tone, label: n, sub });
    if (i < 3) f.path(`M${x + 142} 68 H${x + 156}`, { arrow: true, width: 2 });
  });
  f.text(86, 120, 'pure · may run twice', { anchor: 'middle', size: 11.5, tone: 'info', bold: true });
  f.text(86, 136, 'or be thrown away', { anchor: 'middle', size: 11.5, tone: 'info' });
  f.text(560, 120, 'side effects live here', { anchor: 'middle', size: 11.5, tone: 'pass', bold: true });
  f.box(16, 168, 290, 62, { tone: 'fail', label: '✗ in render: fetch, timers, DOM, mutation', size: 12 });
  f.box(334, 168, 290, 62, { tone: 'pass', label: '✓ in effects / event handlers', size: 12 });
  return f;
};

const keysIdentity: FigureBuilder = () => {
  const f = new Fig(W, 330, 'Two lists of three inputs where the user typed a different word into each. After deleting the first item, index keys make React reuse the wrong inputs so the typed text stays in place while the labels shift. Keys from ids keep each text attached to its own item.');
  const col = (x: number, title: string, tone: Tone, keyFor: (i: number, id: string) => string, after: [string, string][], note: string, ok: boolean) => {
    f.text(x + 140, 22, title, { anchor: 'middle', bold: true, tone, mono: true, size: 12.5 });
    f.text(x, 46, 'before', { size: 11.5, tone: 'muted' });
    ['A', 'B', 'C'].forEach((id, i) => {
      const y = 54 + i * 34;
      f.box(x, y, 50, 28, { tone: 'muted', label: `key ${keyFor(i, id)}`, size: 10.5, r: 5 });
      f.box(x + 56, y, 84, 28, { tone: 'ink', label: `item ${id}`, size: 11, r: 5 });
      f.box(x + 146, y, 110, 28, { tone: 'info', label: `typed "${id.toLowerCase()}${id.toLowerCase()}"`, size: 11, r: 5 });
    });
    f.text(x, 176, 'after deleting item A', { size: 11.5, tone: 'muted' });
    after.forEach(([label, typed], i) => {
      const y = 184 + i * 34;
      f.box(x, y, 50, 28, { tone: 'muted', label: `key ${ok ? ['B', 'C'][i] : i}`, size: 10.5, r: 5 });
      f.box(x + 56, y, 84, 28, { tone: 'ink', label, size: 11, r: 5 });
      f.box(x + 146, y, 110, 28, { tone: ok ? 'pass' : 'fail', label: typed, size: 11, r: 5 });
    });
    f.text(x + 128, 272, note, { anchor: 'middle', size: 12, tone: ok ? 'pass' : 'fail', bold: true });
  };
  col(16, 'key={index}', 'fail', (i) => String(i), [['item B', 'typed "aa" ✗'], ['item C', 'typed "bb" ✗']], 'text stays at the POSITION', false);
  f.line(320, 14, 320, 300, { tone: 'muted', dashed: true });
  col(352, 'key={item.id}', 'pass', (_i, id) => id, [['item B', 'typed "bb" ✓'], ['item C', 'typed "cc" ✓']], 'text follows the ITEM', true);
  f.text(W / 2, 312, 'A key answers: "is this the same item as last render?"', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── Effects ───────────────────────── */

const effectTimeline: FigureBuilder = () => {
  const f = new Fig(W, 290, 'The order of effect and cleanup. On mount: render, commit, then the effect runs. When a dependency changes: render, commit, then the previous cleanup runs, then the new effect. On unmount: the cleanup runs.');
  const rows: [string, [string, Tone][]][] = [
    ['mount (id = 1)', [['render', 'info'], ['commit', 'accent'], ['effect(1)', 'pass']]],
    ['id changes to 2', [['render', 'info'], ['commit', 'accent'], ['cleanup(1)', 'fail'], ['effect(2)', 'pass']]],
    ['unmount', [['cleanup(2)', 'fail']]],
  ];
  rows.forEach(([label, steps], r) => {
    const y = 30 + r * 80;
    f.text(16, y - 6, label, { bold: true, size: 13 });
    steps.forEach(([s, tone], i) => {
      const x = 16 + i * 150;
      f.box(x, y, 130, 40, { tone, label: s, mono: true, size: 12.5 });
      if (i < steps.length - 1) f.path(`M${x + 132} ${y + 20} H${x + 148}`, { arrow: true, width: 2 });
    });
  });
  f.text(W / 2, 274, 'Cleanup of the OLD effect always runs before the NEW effect. That is how you avoid leaking listeners and timers.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const depsArray: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Three dependency array shapes. No array: the effect runs after every render. Empty array: only after the first render. Array with values: after the first render and whenever one of those values changes.');
  const rows: [string, string, string, Tone][] = [
    ['useEffect(fn)', 'after EVERY render', 'r1 r2 r3 r4', 'fail'],
    ['useEffect(fn, [])', 'once, after mount', 'r1', 'info'],
    ['useEffect(fn, [a])', 'mount + whenever a changes', 'r1 . r3 .', 'pass'],
  ];
  f.text(16, 24, 'renders:', { size: 12, tone: 'muted' });
  ['1', '2', '3', '4'].forEach((n, i) => f.text(250 + i * 70, 24, `render ${n}`, { anchor: 'middle', size: 11.5, tone: 'muted' }));
  rows.forEach(([code, desc, pattern, tone], i) => {
    const y = 44 + i * 64;
    f.text(16, y + 16, code, { mono: true, bold: true, size: 12.5, tone });
    f.text(16, y + 36, desc, { size: 12, tone: 'muted' });
    const hits = pattern === 'r1 r2 r3 r4' ? [1, 1, 1, 1] : pattern === 'r1' ? [1, 0, 0, 0] : [1, 0, 1, 0];
    hits.forEach((h, k) => {
      const cx = 250 + k * 70;
      if (h) f.raw(`<circle class="f-dot t-${tone}" cx="${cx}" cy="${y + 20}" r="11"/>`);
      else f.raw(`<circle class="f-box t-muted dashed" cx="${cx}" cy="${y + 20}" r="11"/>`);
    });
  });
  f.text(W / 2, 236, 'Filled dot = the effect runs. In the third row, a changed on render 3 only.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const effectRace: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The user clicks user 1 and then quickly user 2. The request for user 1 is slow and arrives last. The cleanup of the first effect set ignore to true, so its late answer is discarded and the screen keeps user 2.');
  const x0 = 130, k = 1.2;
  f.text(16, 26, 'time →', { size: 12, tone: 'muted' });
  f.text(16, 66, 'fetch user 1', { mono: true, size: 12 });
  f.box(x0, 46, 300 * k, 28, { tone: 'fail', solid: true, r: 14 });
  f.text(x0 + 300 * k + 8, 65, 'arrives last', { size: 12, tone: 'fail', bold: true });
  f.text(16, 116, 'fetch user 2', { mono: true, size: 12 });
  f.box(x0 + 100 * k, 96, 100 * k, 28, { tone: 'pass', solid: true, r: 14 });
  f.text(x0 + 200 * k + 8, 115, 'arrives first', { size: 12, tone: 'pass', bold: true });
  f.line(x0 + 100 * k, 40, x0 + 100 * k, 130, { tone: 'accent', dashed: true });
  f.text(x0 + 100 * k + 6, 36, 'click user 2 → cleanup sets ignore = true for request 1', { size: 11.5, tone: 'accent', bold: true });
  f.box(40, 160, 270, 76, { tone: 'fail', label: 'Without the flag', sub: 'late user-1 data overwrites user 2 ✗' });
  f.box(340, 160, 270, 76, { tone: 'pass', label: 'With  if (!ignore)', sub: 'the stale answer is dropped ✓' });
  f.text(W / 2, 258, 'Cleanup is how an effect says: "whatever I started is no longer wanted."', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};


/* ───────────────────────── Custom hooks ───────────────────────── */

const hookOrder: FigureBuilder = () => {
  const f = new Fig(W, 290, 'React remembers hooks by the order they are called. On every render the first useState gets slot 1, the second slot 2. If a hook is called conditionally, the order shifts on some renders and state is handed to the wrong hook.');
  f.text(156, 24, 'Always the same order ✓', { anchor: 'middle', bold: true, tone: 'pass' });
  ['Render 1', 'Render 2'].forEach((r, col) => {
    const x = 20 + col * 146;
    f.text(x + 62, 48, r, { anchor: 'middle', size: 12, tone: 'muted' });
    ['useState  (slot 1)', 'useState  (slot 2)', 'useEffect (slot 3)'].forEach((h, i) => f.box(x, 58 + i * 46, 126, 38, { tone: 'pass', label: h, size: 10.5, mono: true, r: 6 }));
  });
  f.text(156, 214, 'Slots line up between renders,', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(156, 232, 'so each hook finds its own state.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.line(320, 14, 320, 260, { tone: 'muted', dashed: true });
  f.text(480, 24, 'if (x) useState() ✗', { anchor: 'middle', bold: true, tone: 'fail', mono: true, size: 12.5 });
  f.text(372, 48, 'Render 1 (x true)', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(568, 48, 'Render 2 (x false)', { anchor: 'middle', size: 12, tone: 'muted' });
  ['useState  (slot 1)', 'useState  (slot 2)', 'useEffect (slot 3)'].forEach((h, i) => f.box(330, 58 + i * 46, 126, 38, { tone: 'info', label: h, size: 10.5, mono: true, r: 6 }));
  ['useState  (slot 1)', 'useEffect (slot 2)'].forEach((h, i) => f.box(506, 58 + i * 46, 126, 38, { tone: 'fail', label: h, size: 10.5, mono: true, r: 6 }));
  f.text(568, 168, '← the effect now reads', { anchor: 'middle', size: 11.5, tone: 'fail', bold: true });
  f.text(568, 184, "slot 2's saved state!", { anchor: 'middle', size: 11.5, tone: 'fail', bold: true });
  f.text(480, 232, 'One missing call shifts every hook after it.', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  return f;
};

const hookSharing: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Two components each call the same custom hook useToggle. The hook shares the logic, but each component gets its own independent state.');
  f.box(200, 14, 240, 50, { tone: 'accent', label: 'useToggle()', sub: 'shared LOGIC (one function)', mono: true, size: 12.5 });
  f.path('M270 64 L150 112', { arrow: true, width: 2 }); f.path('M370 64 L490 112', { arrow: true, width: 2 });
  f.box(40, 112, 220, 70, { tone: 'info', label: '<Sidebar />', sub: 'its own state: on = true' });
  f.box(380, 112, 220, 70, { tone: 'info', label: '<Modal />', sub: 'its own state: on = false' });
  f.text(W / 2, 214, 'Hooks share behaviour, not data.', { anchor: 'middle', size: 13, bold: true });
  f.text(W / 2, 236, 'To share the actual value, lift state up or use context / a store.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

const latestRef: FigureBuilder = () => {
  const f = new Fig(W, 260, 'The latest-ref pattern. Every render stores the newest handler in a ref. The effect subscribes the event listener only once; when the event fires, the listener calls ref.current, which is always the newest handler.');
  f.box(16, 30, 190, 60, { tone: 'info', label: 'every render', sub: 'ref.current = handler', mono: true, size: 12 });
  f.box(225, 30, 190, 60, { tone: 'accent', dashed: true, label: 'ref  { current }', sub: 'survives renders', mono: true, size: 12 });
  f.box(434, 30, 190, 60, { tone: 'pass', label: 'listener (added ONCE)', sub: 'calls ref.current(e)', mono: true, size: 11.5 });
  f.path('M208 60 H223', { arrow: true, width: 2 }); f.path('M432 60 H417', { arrow: true, width: 2, tone: 'pass' });
  f.box(16, 130, 608, 50, { tone: 'ink', label: 'useEffect(() => { add listener; return remove }, [target, type])   ← no `handler` here', mono: true, size: 11.5 });
  f.text(W / 2, 212, 'New handler each render → no re-subscribing, yet the newest one always runs.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 234, 'Writing a ref does not cause a re-render.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

/* ───────────────────────── Performance ───────────────────────── */

const whatRenders: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Three things make a component render: its own state changing, its parent rendering, or a context it reads changing. A render cascades to the whole subtree below it, unless a child is memoised with unchanged props.');
  f.box(240, 14, 160, 44, { tone: 'accent', label: '<App />', sub: 'setCount() called' });
  f.text(420, 38, '① state changed', { size: 12, tone: 'accent', bold: true });
  ['<Header />', '<Counter />', '<List />'].forEach((n, i) => {
    const x = 40 + i * 200;
    f.box(x, 100, 160, 44, { tone: i === 2 ? 'muted' : 'info', label: n, sub: i === 2 ? 'memo: props same' : '② parent rendered', size: 12, dashed: i === 2 });
    f.path(`M320 58 L${x + 80} 100`, { arrow: true, tone: i === 2 ? 'muted' : 'info', dashed: i === 2 });
  });
  ['<Row />', '<Row />', '<Row />'].forEach((n, i) => { const x = 40 + 200 * 2 + (i - 1) * 50 - 10; f.box(Math.max(430, x), 190, 44, 30, { tone: 'muted', label: 'row', size: 10.5, dashed: true, r: 5 }); });
  ['<Avatar />', '<Menu />'].forEach((n, i) => f.box(40 + i * 92, 190, 84, 30, { tone: 'info', label: n.replace(/[<>/ ]/g, ''), size: 10.5, r: 5 }));
  f.path('M120 144 V190', { arrow: true, tone: 'info' });
  f.text(W / 2, 250, 'A render is a function call, not a DOM update. The cost is the whole subtree — so measure first.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const memoIdentity: FigureBuilder = () => {
  const f = new Fig(W, 270, 'React.memo compares props with Object.is. A fresh object or function every render is never equal, so a memo child with inline object props still re-renders. Stable props let memo skip the render.');
  f.text(156, 24, 'Fresh props each render ✗', { anchor: 'middle', bold: true, tone: 'fail' });
  f.box(20, 40, 272, 44, { tone: 'ink', label: '<Row style={{…}} onPick={() => …} />', size: 10, mono: true });
  f.box(20, 100, 120, 44, { tone: 'muted', label: 'render 1', sub: 'style #1', mono: true, size: 11 });
  f.box(172, 100, 120, 44, { tone: 'fail', label: 'render 2', sub: 'style #2 ≠ #1', mono: true, size: 11 });
  f.path('M142 122 H170', { arrow: true });
  f.text(156, 180, 'new identity → "props changed"', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.box(56, 196, 200, 40, { tone: 'fail', label: 'memo wasted: re-renders', size: 12 });
  f.line(320, 14, 320, 250, { tone: 'muted', dashed: true });
  f.text(480, 24, 'Stable props ✓', { anchor: 'middle', bold: true, tone: 'pass' });
  f.box(344, 40, 272, 44, { tone: 'ink', label: 'style = useMemo · onPick = useCallback', size: 10, mono: true });
  f.box(344, 100, 120, 44, { tone: 'muted', label: 'render 1', sub: 'style #1', mono: true, size: 11 });
  f.box(496, 100, 120, 44, { tone: 'pass', label: 'render 2', sub: 'style #1 = #1', mono: true, size: 11 });
  f.path('M466 122 H494', { arrow: true });
  f.text(480, 180, 'same identity → "props equal"', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.box(380, 196, 200, 40, { tone: 'pass', label: 'memo works: skipped', size: 12 });
  f.text(W / 2, 262, 'Memoise the child AND stabilise what you pass it.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const virtualWindow: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Virtualisation: a tall spacer represents 10000 rows, but only the rows inside the visible window, plus a few extra called overscan, exist in the DOM. Scrolling recomputes which rows those are.');
  f.box(40, 20, 250, 260, { tone: 'muted', dashed: true });
  f.text(165, 40, 'spacer: items × itemHeight tall', { anchor: 'middle', size: 11.5, tone: 'muted' });
  for (let i = 0; i < 12; i++) {
    const inView = i >= 4 && i <= 7, over = i === 3 || i === 8;
    f.box(54, 50 + i * 19, 222, 16, { tone: inView ? 'pass' : over ? 'info' : 'muted', solid: inView || over, dashed: !inView && !over, label: inView || over ? `row ${i * 10 + 1000}` : '· · ·', size: 10, mono: true, r: 3 });
  }
  f.box(46, 122, 238, 88, { tone: 'accent', dashed: true });
  f.text(330, 130, 'viewport (scrollTop …', { size: 12, tone: 'accent', bold: true });
  f.text(330, 146, '… scrollTop + height)', { size: 12, tone: 'accent', bold: true });
  f.box(340, 170, 280, 46, { tone: 'pass', label: 'rendered rows', sub: 'visible', size: 11.5 });
  f.box(340, 222, 280, 44, { tone: 'info', label: 'overscan rows', sub: 'a few extra above & below', size: 11.5 });
  f.text(480, 50, 'start = max(0, ⌊scrollTop ÷ h⌋ − overscan)', { anchor: 'middle', size: 11.5, mono: true });
  f.text(480, 72, 'end   = min(n, ⌈(scrollTop + H) ÷ h⌉ + overscan)', { anchor: 'middle', size: 11.5, mono: true });
  f.text(480, 98, 'Only rows in [start, end) are mounted.', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  return f;
};


/* ───────────────────────── State architecture ───────────────────────── */

const stateLadder: FigureBuilder = () => {
  const f = new Fig(W, 300, 'A ladder for choosing where state lives. Start with local useState; lift to a common parent if siblings need it; use useReducer for complex transitions; use context for rarely changing values with distant consumers; use an external store for frequent updates or server data.');
  const rungs: [string, string, Tone][] = [
    ['1 · local useState', 'only this component cares', 'pass'],
    ['2 · lift to common parent', 'two siblings need it', 'info'],
    ['3 · useReducer', 'many fields or rules for transitions', 'info'],
    ['4 · context', 'distant consumers, changes rarely (theme, user)', 'accent'],
    ['5 · external store', 'frequent updates, many subscribers, server state', 'accent'],
  ];
  rungs.forEach(([t, sub, tone], i) => {
    const y = 14 + i * 54;
    f.box(16 + i * 18, y, 420 - i * 18 + 160, 44, { tone, label: t, sub, size: 12.5 });
  });
  f.path('M12 30 V270', { arrow: true, tone: 'muted', width: 1.6 });
  f.text(W - 12, 288, 'stop at the FIRST rung that fits ↓', { anchor: 'end', size: 12, tone: 'muted', italic: true });
  return f;
};

const contextRerender: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Every component that reads a context re-renders when the provider value changes by identity. A new object literal each render makes all consumers re-render each time; memoising the value, or splitting the context, avoids that.');
  f.text(156, 22, 'New value object every render ✗', { anchor: 'middle', bold: true, tone: 'fail', size: 12.5 });
  f.box(56, 34, 200, 40, { tone: 'fail', label: '<Provider value={{ … }}>', mono: true, size: 11 });
  [0, 1, 2].forEach((i) => { f.path(`M156 74 L${60 + i * 96} 122`, { arrow: true, tone: 'fail' }); f.box(16 + i * 96, 122, 88, 36, { tone: 'fail', label: `consumer ${i + 1}`, size: 10.5 }); });
  f.text(156, 184, 'parent re-renders → ALL consumers', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  f.text(156, 202, 'render, even if nothing changed', { anchor: 'middle', size: 12, tone: 'fail' });
  f.line(320, 14, 320, 226, { tone: 'muted', dashed: true });
  f.text(480, 22, 'useMemo + split contexts ✓', { anchor: 'middle', bold: true, tone: 'pass', size: 12.5 });
  f.box(360, 34, 240, 40, { tone: 'pass', label: '<Provider value={memoised}>', mono: true, size: 11 });
  [0, 1, 2].forEach((i) => { f.path(`M480 74 L${384 + i * 96} 122`, { arrow: true, tone: 'pass', dashed: i > 0 }); f.box(340 + i * 96, 122, 88, 36, { tone: i === 0 ? 'pass' : 'muted', dashed: i > 0, label: i === 0 ? 'renders' : 'skipped', size: 10.5 }); });
  f.text(480, 184, 'only consumers of the changed', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(480, 202, 'slice re-render', { anchor: 'middle', size: 12, tone: 'pass' });
  f.text(W / 2, 252, 'Not for fast-changing values (typing, mouse position) — use a store for those.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const reducerFlow: FigureBuilder = () => {
  const f = new Fig(W, 250, 'The reducer cycle. A component dispatches an action describing what happened. The pure reducer function takes the current state and the action and returns the next state. React renders with the new state.');
  f.box(16, 30, 140, 64, { tone: 'info', label: 'UI event', sub: 'click "Add"' });
  f.box(186, 30, 150, 64, { tone: 'accent', label: 'dispatch(action)', sub: '{ type, item }', size: 12, mono: true });
  f.box(366, 30, 258, 64, { tone: 'pass', label: 'reducer(state, action)', sub: 'pure → returns the NEXT state', size: 12.5, mono: true });
  f.path('M158 62 H184', { arrow: true, width: 2 }); f.path('M338 62 H364', { arrow: true, width: 2 });
  f.path('M495 94 V140 H86 V96', { arrow: true, tone: 'accent', width: 2 });
  f.text(290, 158, 'React re-renders with the new state', { anchor: 'middle', size: 12.5, tone: 'accent', bold: true });
  f.text(W / 2, 196, 'Pure function → testable without React, all rules in ONE place.', { anchor: 'middle', size: 13, bold: true });
  f.text(W / 2, 218, 'dispatch is stable for the component’s life. Return the same state if nothing changed.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const errorBoundaryTree: FigureBuilder = () => {
  const f = new Fig(W, 270, 'An error boundary wraps part of the tree. When a child throws while rendering, the boundary shows its fallback instead of that subtree, and the rest of the page stays alive. Without a boundary the whole app unmounts.');
  f.box(200, 14, 240, 36, { tone: 'ink', label: '<App />', size: 12 });
  f.path('M270 50 L150 84', { arrow: true }); f.path('M370 50 L490 84', { arrow: true });
  f.box(40, 84, 220, 100, { tone: 'fail', dashed: true });
  f.text(150, 104, '<ErrorBoundary>', { anchor: 'middle', size: 12, bold: true, tone: 'fail', mono: true });
  f.box(64, 116, 172, 34, { tone: 'fail', solid: true, label: '<Chart /> 💥 throws', size: 11.5 });
  f.text(150, 172, 'fallback shown instead', { anchor: 'middle', size: 11.5, tone: 'fail', bold: true });
  f.box(380, 84, 220, 100, { tone: 'pass' });
  f.text(490, 120, '<Sidebar />', { anchor: 'middle', size: 13, bold: true, tone: 'pass', mono: true });
  f.text(490, 144, 'still works ✓', { anchor: 'middle', size: 12.5, tone: 'pass' });
  f.text(W / 2, 214, 'Catches: errors while rendering, in lifecycles and constructors of its children.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 234, 'Does NOT catch: event handlers, async code (promises/timers), or itself.', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  f.text(W / 2, 256, 'Offer a reset: “Try again”, or auto-reset when a key (route, id) changes.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── Composition & accessibility ───────────────────────── */

const compoundParts: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A compound component. The Tabs root holds the selected value in state and shares it by context. The List, Trigger and Panel parts read and update that context, so the caller controls the markup and order.');
  f.box(180, 14, 280, 50, { tone: 'accent', label: '<Tabs>  state + context', sub: 'value = "account"', mono: true, size: 12 });
  f.box(24, 104, 180, 44, { tone: 'info', label: '<Tabs.List>', mono: true, size: 12 });
  f.box(24, 164, 84, 40, { tone: 'info', label: 'Trigger', sub: 'account', size: 11 });
  f.box(118, 164, 86, 40, { tone: 'info', label: 'Trigger', sub: 'billing', size: 11 });
  f.box(380, 104, 236, 44, { tone: 'pass', label: '<Tabs.Panel value="account">', mono: true, size: 11 });
  f.box(380, 164, 236, 40, { tone: 'muted', dashed: true, label: '<Tabs.Panel value="billing"> (hidden)', mono: true, size: 10.5 });
  f.path('M260 64 L130 104', { arrow: true, tone: 'accent', dashed: true }); f.path('M380 64 L480 104', { arrow: true, tone: 'accent', dashed: true });
  f.text(320, 92, 'context', { anchor: 'middle', size: 11.5, tone: 'accent', bold: true });
  f.text(W / 2, 236, 'Parts coordinate through context — no prop drilling, and the caller owns the layout.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const rovingTabindex: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Roving tabindex in a tab list. Only the active tab has tabindex 0 and is reachable with the Tab key; the others have tabindex minus 1. The arrow keys move focus and the tabindex 0 to the next tab.');
  ['Account', 'Billing', 'Team'].forEach((t, i) => {
    const x = 40 + i * 190;
    f.box(x, 40, 160, 54, { tone: i === 0 ? 'accent' : 'muted', solid: i === 0, label: t, sub: i === 0 ? 'tabindex = 0  ← focus' : 'tabindex = -1', size: 13 });
  });
  f.path('M200 120 H222', { arrow: true, tone: 'accent' });
  f.text(320, 138, '→ ArrowRight moves focus and the 0 to the next tab', { anchor: 'middle', size: 12.5, tone: 'accent', bold: true });
  ['Account', 'Billing', 'Team'].forEach((t, i) => {
    const x = 40 + i * 190;
    f.box(x, 158, 160, 54, { tone: i === 1 ? 'accent' : 'muted', solid: i === 1, label: t, sub: i === 1 ? 'tabindex = 0  ← focus' : 'tabindex = -1', size: 13 });
  });
  f.text(W / 2, 236, 'The whole widget is ONE Tab stop; arrows move inside it. Home/End jump to the ends.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const modalFocus: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Modal focus management in three steps: when the dialog opens, move focus into it and remember the trigger; while it is open, trap Tab so focus wraps inside; when it closes, return focus to the element that opened it.');
  const steps: [string, string, Tone][] = [['① Open', 'focus moves IN', 'info'], ['② While open', 'Tab wraps inside', 'accent'], ['③ Close', 'focus returns to trigger', 'pass']];
  steps.forEach(([t, sub, tone], i) => {
    const x = 16 + i * 210;
    f.box(x, 24, 196, 76, { tone, label: t, sub, size: 12.5 });
    if (i < 2) f.path(`M${x + 198} 62 H${x + 208}`, { arrow: true, width: 2 });
  });
  f.box(150, 130, 340, 100, { tone: 'ink' });
  f.text(320, 152, 'role="dialog"  aria-modal="true"', { anchor: 'middle', size: 12, mono: true, bold: true });
  f.text(320, 172, 'aria-labelledby → the <h2> title', { anchor: 'middle', size: 12, mono: true, tone: 'muted' });
  f.box(176, 186, 128, 30, { tone: 'info', label: 'first focusable', size: 11 });
  f.box(336, 186, 128, 30, { tone: 'info', label: 'Close', size: 11 });
  f.path('M464 210 C500 232 130 232 176 214', { arrow: true, tone: 'accent', dashed: true });
  f.text(320, 250, 'Also: Escape closes · backdrop click closes · lock background scroll', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const comboboxAnatomy: FigureBuilder = () => {
  const f = new Fig(W, 280, 'The combobox pattern. DOM focus stays in the input. The input points to the highlighted option with aria-activedescendant, and to the popup list with aria-controls. The list has role listbox and each item role option; the highlighted one has aria-selected true.');
  f.box(16, 20, 290, 44, { tone: 'ink', label: 'input role="combobox"', sub: 'focus NEVER leaves here', size: 12.5, mono: true });
  f.text(16, 92, 'aria-expanded="true"', { mono: true, size: 11.5, tone: 'muted' });
  f.text(16, 112, 'aria-controls="list-1"', { mono: true, size: 11.5, tone: 'muted' });
  f.text(16, 132, 'aria-activedescendant="opt-2"', { mono: true, size: 11.5, tone: 'accent', bold: true });
  f.box(344, 20, 280, 170, { tone: 'info', dashed: true });
  f.text(484, 40, 'ul role="listbox"  id="list-1"', { anchor: 'middle', size: 11.5, mono: true, bold: true, tone: 'info' });
  ['apple', 'apricot', 'avocado'].forEach((o, i) => f.box(360, 52 + i * 42, 248, 34, { tone: i === 1 ? 'accent' : 'muted', solid: i === 1, label: `option  id="opt-${i + 1}"  ${o}`, sub: undefined, size: 10.5, mono: true, r: 6 }));
  f.text(484, 184, '', { size: 10 });
  f.path('M170 136 C260 160 300 110 356 120', { arrow: true, tone: 'accent', dashed: true });
  f.text(W / 2, 218, 'ArrowDown/Up move the highlight (wrapping) · Enter selects · Escape closes.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 240, 'Gotcha: clicking an option blurs the input first — prevent that with', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  f.text(W / 2, 260, 'onMouseDown={(e) => e.preventDefault()} on the list.', { anchor: 'middle', size: 12, tone: 'fail', mono: true });
  return f;
};

export const reactFigures: Record<string, FigureBuilder> = {
  'jsx-pipeline': jsxPipeline,
  'render-commit': renderCommit,
  'keys-identity': keysIdentity,
  'effect-timeline': effectTimeline,
  'deps-array': depsArray,
  'effect-race': effectRace,
  'hook-order': hookOrder,
  'hook-sharing': hookSharing,
  'latest-ref': latestRef,
  'what-renders': whatRenders,
  'memo-identity': memoIdentity,
  'virtual-window': virtualWindow,
  'state-ladder': stateLadder,
  'context-rerender': contextRerender,
  'reducer-flow': reducerFlow,
  'error-boundary-tree': errorBoundaryTree,
  'compound-parts': compoundParts,
  'roving-tabindex': rovingTabindex,
  'modal-focus': modalFocus,
  'combobox-anatomy': comboboxAnatomy,
};
