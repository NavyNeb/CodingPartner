import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── web-01 · DOM, events, rendering ───────────────────────── */

const eventFlow: FigureBuilder = () => {
  const f = new Fig(W, 300, 'A click on a button inside a list item travels in three phases: capture goes down from the document to the target, then the target phase, then bubble goes back up. A listener on the list sees the click on the way up.');
  const rows: [string, string][] = [['document', ''], ['<ul id="list">', 'one listener here'], ['<li>', ''], ['<button>', 'target']];
  rows.forEach(([l, s], i) => {
    const x = 150 + i * 14, w = 300 - i * 28, y = 22 + i * 62;
    f.box(x, y, w, 50, { tone: i === 3 ? 'accent' : i === 1 ? 'info' : 'muted', solid: i === 3, label: l, sub: s || undefined, mono: true, size: 12.5 });
  });
  f.path('M92 44 V268', { arrow: true, tone: 'info', width: 2 });
  f.text(84, 150, '1 capture', { anchor: 'end', size: 12.5, tone: 'info', bold: true });
  f.text(84, 168, 'down', { anchor: 'end', size: 12, tone: 'muted' });
  f.path('M548 268 V44', { arrow: true, tone: 'pass', width: 2 });
  f.text(556, 150, '3 bubble', { size: 12.5, tone: 'pass', bold: true });
  f.text(556, 168, 'up', { size: 12, tone: 'muted' });
  f.text(W / 2, 288, '2 target: the button itself. Most listeners run in the bubble phase.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  f.packet('M92 30 V268', 3, 'info');
  f.packet('M548 268 V30', 3, 'pass', 1.5);
  return f;
};

const delegationTree: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Left: one listener per list item means four listeners, and a new item has none until you add one. Right: a single listener on the list handles clicks from every item, including ones added later.');
  f.text(150, 22, 'Per-item listeners', { anchor: 'middle', bold: true, tone: 'fail' });
  f.box(40, 36, 220, 28, { tone: 'muted', label: '<ul>', mono: true, size: 12 });
  [0, 1, 2, 3].forEach((i) => {
    const y = 80 + i * 40, fresh = i === 3;
    f.box(60, y, 130, 30, { tone: fresh ? 'fail' : 'muted', dashed: fresh, label: fresh ? '<li> new!' : `<li> ${i + 1}`, mono: true, size: 12 });
    f.box(200, y + 4, 56, 22, { tone: fresh ? 'fail' : 'info', dashed: fresh, label: fresh ? 'none' : 'on click', size: 10.5 });
  });
  f.text(150, 262, '4 listeners, and the new row is dead', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  f.line(320, 20, 320, 262, { tone: 'muted', dashed: true });
  f.text(480, 22, 'Delegation', { anchor: 'middle', bold: true, tone: 'pass' });
  f.box(380, 36, 200, 36, { tone: 'info', label: '<ul>  on click', mono: true, size: 12 });
  [0, 1, 2, 3].forEach((i) => {
    const y = 90 + i * 40;
    f.box(410, y, 140, 30, { tone: i === 3 ? 'pass' : 'muted', dashed: i === 3, label: i === 3 ? '<li> new!' : `<li> ${i + 1}`, mono: true, size: 12 });
    f.path(`M${396} ${y + 15} C380 ${y + 15} 372 ${y} 372 ${72}`, { arrow: true, tone: 'pass', dashed: true, width: 1.2 });
  });
  f.text(480, 262, '1 listener, works for every row', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  return f;
};

const renderPipeline: FigureBuilder = () => {
  const f = new Fig(W, 300, 'The browser pipeline for one frame: JavaScript, style, layout, paint, composite. Changing width forces layout, paint and composite. Changing color skips layout. Changing transform or opacity only needs composite.');
  const steps: [string, string, Tone][] = [['JavaScript', 'your code runs', 'accent'], ['Style', 'which rules apply?', 'info'], ['Layout', 'sizes + positions', 'info'], ['Paint', 'draw the pixels', 'info'], ['Composite', 'stack the layers', 'pass']];
  steps.forEach(([l, s, tone], i) => {
    const x = 12 + i * 126;
    f.box(x, 24, 112, 60, { tone, label: l, sub: s, size: 12.5 });
    if (i < 4) f.path(`M${x + 112} 54 H${x + 126}`, { arrow: true, width: 1.6 });
  });
  const rows: [string, string, number, Tone][] = [['width, height, margin, top', 'starts at Layout', 2, 'fail'], ['color, background, box-shadow', 'starts at Paint', 3, 'info'], ['transform, opacity', 'Composite only', 4, 'pass']];
  rows.forEach(([prop, note, from, tone], i) => {
    const y = 120 + i * 50;
    f.text(12, y + 16, prop, { mono: true, size: 12 });
    const bx = 12 + from * 126;
    f.box(bx, y, 628 - bx, 24, { tone, solid: true, r: 12, label: note, size: 11.5 });
  });
  f.text(W / 2, 282, 'Cheapest frame: animate transform / opacity. Costliest: anything that changes geometry.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const layoutThrash: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Left: alternating reads and writes forces the browser to recalculate layout on every read. Right: doing all the reads first and all the writes after needs only one layout.');
  f.text(150, 22, 'Interleaved', { anchor: 'middle', bold: true, tone: 'fail' });
  const seq = ['R', 'W', 'R', 'W', 'R', 'W'];
  seq.forEach((s, i) => {
    const x = 26 + i * 40;
    f.box(x, 44, 34, 34, { tone: s === 'R' ? 'info' : 'accent', solid: true, label: s, size: 13 });
    if (s === 'R' && i > 0) f.text(x + 17, 100, 'layout', { anchor: 'middle', size: 10, tone: 'fail', bold: true });
  });
  f.text(150, 130, 'R = read (offsetHeight)', { anchor: 'middle', size: 11.5, tone: 'info' });
  f.text(150, 148, 'W = write (style.height = …)', { anchor: 'middle', size: 11.5, tone: 'accent' });
  f.box(40, 172, 220, 56, { tone: 'fail', label: '3 forced layouts', sub: 'each read waits for the last write', size: 12.5 });
  f.line(320, 20, 320, 240, { tone: 'muted', dashed: true });
  f.text(480, 22, 'Batched', { anchor: 'middle', bold: true, tone: 'pass' });
  ['R', 'R', 'R', 'W', 'W', 'W'].forEach((s, i) => {
    f.box(360 + i * 40, 44, 34, 34, { tone: s === 'R' ? 'info' : 'accent', solid: true, label: s, size: 13 });
  });
  f.text(480, 100, 'one layout, at the end', { anchor: 'middle', size: 10.5, tone: 'pass', bold: true });
  f.text(480, 130, 'reads see consistent geometry', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.text(480, 148, 'writes are applied together', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.box(380, 172, 200, 56, { tone: 'pass', label: '1 layout', sub: 'read → read → read → write ×3', size: 12.5 });
  f.text(W / 2, 258, 'Schedule reads and writes in separate phases, ideally inside requestAnimationFrame.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── web-02 · networking & caching ───────────────────────── */

const httpCacheFlow: FigureBuilder = () => {
  const f = new Fig(W, 330, 'HTTP cache decision. If a stored response is still fresh, it is used with no network. If stale, the browser asks the server with a conditional request. A 304 means keep the stored body; a 200 replaces it.');
  f.box(20, 16, 170, 44, { tone: 'ink', label: 'GET /prices.json', mono: true, size: 12 });
  f.path('M190 38 H236', { arrow: true });
  f.box(240, 16, 160, 44, { tone: 'info', label: 'in the cache?', size: 12.5 });
  f.text(412, 30, 'no', { size: 11.5, tone: 'muted', bold: true });
  f.path('M400 38 H490', { arrow: true, tone: 'muted', dashed: true });
  f.box(494, 16, 130, 44, { tone: 'muted', dashed: true, label: 'full request', sub: 'then store it', size: 12 });
  f.path('M320 60 V92', { arrow: true });
  f.box(240, 94, 160, 44, { tone: 'info', label: 'age < max-age?', mono: true, size: 12 });
  f.path('M240 116 H150', { arrow: true, tone: 'pass', width: 2 });
  f.text(196, 108, 'fresh', { anchor: 'middle', size: 11.5, tone: 'pass', bold: true });
  f.box(20, 94, 130, 44, { tone: 'pass', solid: true, label: 'serve it', sub: 'no network at all', size: 12 });
  f.path('M320 138 V170', { arrow: true, tone: 'fail' });
  f.text(330, 160, 'stale', { size: 11.5, tone: 'fail', bold: true });
  f.box(200, 172, 240, 50, { tone: 'accent', label: 'conditional request', sub: 'If-None-Match: "v42"', mono: true, size: 12 });
  f.path('M240 222 L150 262', { arrow: true, tone: 'pass', width: 2 });
  f.path('M400 222 L490 262', { arrow: true, tone: 'info', width: 2 });
  f.box(20, 264, 190, 52, { tone: 'pass', label: '304 Not Modified', sub: 'keep body, reset age', size: 12, mono: true });
  f.box(430, 264, 190, 52, { tone: 'info', label: '200 + new body', sub: 'replace the entry', size: 12, mono: true });
  return f;
};

const corsPreflight: FigureBuilder = () => {
  const f = new Fig(W, 300, 'CORS. A page on one origin calls an API on another. For a non-simple request, the browser first sends an OPTIONS preflight. Only if the server allows the origin, method and headers does the real request go out.');
  f.box(20, 16, 200, 40, { tone: 'info', label: 'page  app.example.com', size: 12 });
  f.box(420, 16, 200, 40, { tone: 'muted', label: 'API  api.example.com', size: 12 });
  f.line(120, 56, 120, 280, { tone: 'muted', dashed: true });
  f.line(520, 56, 520, 280, { tone: 'muted', dashed: true });
  f.path('M120 96 H516', { arrow: true, tone: 'accent', width: 2 });
  f.num(130, 88, 1); f.text(318, 88, 'OPTIONS  Origin, Access-Control-Request-Method: PUT', { anchor: 'middle', size: 11, mono: true });
  f.path('M516 148 H124', { arrow: true, tone: 'pass', width: 2 });
  f.num(508, 140, 2); f.text(318, 140, 'Access-Control-Allow-Origin / -Methods / -Headers', { anchor: 'middle', size: 11, mono: true, tone: 'pass' });
  f.path('M120 200 H516', { arrow: true, tone: 'accent', width: 2 });
  f.num(130, 192, 3); f.text(318, 192, 'PUT /orders   (the real request)', { anchor: 'middle', size: 11, mono: true });
  f.path('M516 248 H124', { arrow: true, tone: 'pass', width: 2 });
  f.num(508, 240, 4); f.text(318, 240, 'response + Allow-Origin header', { anchor: 'middle', size: 11, mono: true, tone: 'pass' });
  f.text(W / 2, 288, 'CORS is enforced by the browser, not the server. Curl ignores it.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const swrTimeline: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Stale-while-revalidate. A request for an entry past its freshness window returns the stored value immediately and starts one background refresh. When it finishes, the cache is updated and listeners see the new value.');
  const x0 = 24;
  f.text(x0, 28, 'time →', { size: 12, tone: 'muted' });
  f.line(x0, 44, 616, 44, { tone: 'muted' });
  f.box(x0, 56, 190, 30, { tone: 'pass', solid: true, label: 'fresh (ttl)', size: 12, r: 6 });
  f.box(x0 + 190, 56, 200, 30, { tone: 'info', solid: true, label: 'stale but usable', size: 12, r: 6 });
  f.box(x0 + 390, 56, 202, 30, { tone: 'fail', solid: true, label: 'too old: wait for network', size: 12, r: 6 });
  f.text(x0 + 190, 106, 'ttl', { anchor: 'middle', size: 11, mono: true, tone: 'muted' });
  f.text(x0 + 390, 106, 'staleTtl', { anchor: 'middle', size: 11, mono: true, tone: 'muted' });
  f.path('M300 130 V158', { arrow: true, tone: 'accent', width: 2 });
  f.text(310, 126, 'get() at this moment', { size: 11.5, tone: 'accent', bold: true });
  f.box(24, 160, 270, 56, { tone: 'info', label: '① return stale value now', sub: 'the UI renders instantly', size: 12.5 });
  f.box(346, 160, 270, 56, { tone: 'accent', label: '② refresh in background', sub: 'only ONE request, even for 10 callers', size: 12 });
  f.path('M481 216 V246', { arrow: true, width: 2 });
  f.box(346, 248, 270, 40, { tone: 'pass', label: '③ update cache + notify', size: 12.5 });
  f.text(24, 246, 'If the refresh fails,', { size: 12, tone: 'muted' });
  f.text(24, 264, 'keep the stale value.', { size: 12, tone: 'muted' });
  return f;
};

/* ───────────────────────── web-03 · performance metrics ───────────────────────── */

const vitalsGauges: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The three Core Web Vitals and their thresholds. Largest Contentful Paint: good up to 2.5 seconds, poor above 4. Interaction to Next Paint: good up to 200 milliseconds, poor above 500. Cumulative Layout Shift: good up to 0.1, poor above 0.25. Each is judged at the 75th percentile.');
  const rows: [string, string, string, string, string][] = [['LCP', 'how fast the main content appears', '≤ 2.5 s', '2.5 – 4 s', '> 4 s'], ['INP', 'how fast the page reacts to input', '≤ 200 ms', '200 – 500 ms', '> 500 ms'], ['CLS', 'how much the layout jumps', '≤ 0.1', '0.1 – 0.25', '> 0.25']];
  rows.forEach(([n, d, g, m, p], i) => {
    const y = 20 + i * 76;
    f.text(16, y + 14, n, { bold: true, size: 17 });
    f.text(16, y + 34, d, { size: 11.5, tone: 'muted' });
    f.box(250, y, 120, 44, { tone: 'pass', solid: true, label: g, size: 12.5 });
    f.box(374, y, 120, 44, { tone: 'info', solid: true, label: m, size: 12.5 });
    f.box(498, y, 126, 44, { tone: 'fail', solid: true, label: p, size: 12.5 });
  });
  f.text(250, 252, 'good', { size: 11.5, tone: 'pass', bold: true });
  f.text(374, 252, 'needs improvement', { size: 11.5, tone: 'info', bold: true });
  f.text(498, 252, 'poor', { size: 11.5, tone: 'fail', bold: true });
  f.text(W - 14, 252, 'p75', { anchor: 'end', size: 11.5, mono: true, tone: 'muted' });
  return f;
};

const inpAnatomy: FigureBuilder = () => {
  const f = new Fig(W, 280, 'One interaction has three parts: input delay while the main thread is busy, processing time in your event handlers, and presentation delay until the next frame is painted. INP is the longest such interaction on the page.');
  const x0 = 20, k = 2.6;
  const parts: [string, number, Tone, string][] = [['input delay', 40, 'fail', 'main thread busy'], ['processing', 90, 'accent', 'your handlers'], ['presentation', 50, 'info', 'render + paint']];
  let x = x0;
  parts.forEach(([l, ms, tone]) => { f.box(x, 56, ms * k, 40, { tone, solid: true, label: l, size: 11.5 }); x += ms * k; });
  f.text(x0, 40, 'tap', { size: 12, bold: true, tone: 'ink' });
  f.path(`M${x0} 52 V44`, { tone: 'ink' });
  f.text(x, 40, 'next frame painted', { anchor: 'end', size: 12, bold: true, tone: 'pass' });
  f.text(x0, 122, '40 ms', { size: 11.5, mono: true, tone: 'fail' });
  f.text(x0 + 40 * k, 122, '90 ms', { size: 11.5, mono: true, tone: 'accent' });
  f.text(x0 + 130 * k, 122, '50 ms', { size: 11.5, mono: true, tone: 'info' });
  f.text(x0 + 180 * k + 12, 82, '= 180 ms', { size: 15, bold: true, tone: 'pass' });
  const fixes: [string, string, Tone][] = [['Input delay', 'break up long tasks; yield to the browser', 'fail'], ['Processing', 'do less in the handler; defer non-urgent work', 'accent'], ['Presentation', 'avoid huge DOM updates; keep style/layout cheap', 'info']];
  fixes.forEach(([a, b, tone], i) => { f.text(20, 170 + i * 28, a, { bold: true, size: 12.5, tone }); f.text(150, 170 + i * 28, b, { size: 12.5, tone: 'muted' }); });
  f.text(W / 2, 266, 'INP reports (roughly) the worst interaction, so one slow click can set the score.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const clsWindows: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Layout shifts on a timeline, grouped into session windows. A window continues while shifts arrive less than one second apart and lasts at most five seconds. Cumulative Layout Shift is the largest window total, not the sum of everything.');
  const x0 = 24, k = 0.2; // px per ms → 3000ms = 600px wide
  f.line(x0, 150, 616, 150, { tone: 'muted' });
  [0, 1000, 2000, 3000].forEach((ms) => { f.line(x0 + ms * k, 146, x0 + ms * k, 154, { tone: 'muted' }); f.text(x0 + ms * k, 170, `${ms / 1000}s`, { anchor: 'middle', size: 11, mono: true, tone: 'muted' }); });
  const shifts: [number, number, Tone][] = [[100, 0.05, 'info'], [450, 0.08, 'info'], [800, 0.04, 'info'], [2400, 0.12, 'accent']];
  shifts.forEach(([ms, v, tone]) => { const h = v * 700; f.box(x0 + ms * k - 8, 150 - h, 16, h, { tone, solid: true, r: 2 }); f.text(x0 + ms * k, 142 - h, String(v), { anchor: 'middle', size: 10.5, mono: true, tone }); });
  f.box(x0 + 100 * k - 14, 14, 700 * k + 28, 24, { tone: 'info', dashed: true, r: 12, label: 'window 1: 0.17', size: 11.5 });
  f.box(x0 + 2400 * k - 34, 14, 68, 24, { tone: 'accent', dashed: true, r: 12, label: 'window 2', size: 11 });
  f.text(x0 + 1500 * k, 32, 'gap > 1 s → new window', { anchor: 'middle', size: 11, tone: 'muted' });
  f.box(150, 196, 340, 54, { tone: 'pass', label: 'CLS = max(0.17, 0.12) = 0.17', sub: 'a "needs improvement" score', size: 13 });
  f.text(W / 2, 270, 'Shifts right after a tap or key press (hadRecentInput) do not count.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const webFigures: Record<string, FigureBuilder> = {
  'event-flow': eventFlow, 'delegation-tree': delegationTree, 'render-pipeline': renderPipeline, 'layout-thrash': layoutThrash,
  'http-cache-flow': httpCacheFlow, 'cors-preflight': corsPreflight, 'swr-timeline': swrTimeline,
  'vitals-gauges': vitalsGauges, 'inp-anatomy': inpAnatomy, 'cls-windows': clsWindows,
};
