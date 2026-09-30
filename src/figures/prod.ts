import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 01 · The odds firehose ───────────────────────── */

const firehoseFlow: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Top: a naive client renders once per message, so 500 renders a second. Bottom: a coalescing buffer keeps only the latest value per market and flushes once per frame, so about 60 renders a second at most.');
  f.text(16, 22, 'Naive: one setState per message', { bold: true, tone: 'fail', size: 13 });
  for (let i = 0; i < 18; i++) f.raw(`<circle class="f-dot t-fail" cx="${26 + i * 14}" cy="44" r="4"/>`);
  f.path('M290 44 H330', { arrow: true, tone: 'fail', width: 2 });
  for (let i = 0; i < 18; i++) f.box(340 + i * 16, 34, 12, 20, { tone: 'fail', solid: true, r: 2 });
  f.text(480, 78, '500 renders / second ✗', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.line(16, 98, 624, 98, { tone: 'muted', dashed: true });
  f.text(16, 122, 'Coalesce + flush per frame', { bold: true, tone: 'pass', size: 13 });
  for (let i = 0; i < 18; i++) f.raw(`<circle class="f-dot t-info" cx="${26 + i * 14}" cy="144" r="4"/>`);
  f.box(282, 122, 120, 54, { tone: 'accent', label: 'buffer', sub: 'Map: key → latest' });
  f.path('M268 144 H280', { arrow: true, width: 2 }); f.path('M404 150 H436', { arrow: true, tone: 'pass', width: 2 });
  f.text(420, 126, '1× / frame', { anchor: 'middle', size: 10.5, tone: 'pass', bold: true });
  [0, 1, 2].forEach((i) => f.box(442 + i * 60, 132, 48, 36, { tone: 'pass', solid: true, label: 'render', size: 10.5, r: 4 }));
  f.text(480, 200, '≤ 60 renders / second ✓', { anchor: 'middle', size: 12.5, tone: 'pass', bold: true });
  f.text(W / 2, 244, 'The user can only see the LATEST price, so older ones can be dropped.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 266, 'Dropping is right for state (prices). It is a BUG for events (a goal, a settled bet).', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const coalesceWindow: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Messages for two markets arrive during a 16 millisecond window. The first message opens the window. Later messages for the same key replace earlier ones. When the window ends, one flush delivers the latest value of each key.');
  const x0 = 110, k = 27;
  f.box(x0, 34, 16 * k - 10, 14, { tone: 'accent', dashed: true, r: 7 });
  f.text(x0 + 8 * k, 28, 'window opens at the FIRST push (not restarted — not a debounce)', { anchor: 'middle', size: 11.5, tone: 'accent', bold: true });
  const msgs: [number, string, Tone, number][] = [[0.5, 'm7: 2.0', 'info', 0], [3, 'm9: 1.5', 'pass', 1], [6, 'm7: 2.1', 'info', 0], [10, 'm7: 2.3', 'info', 0], [13, 'm9: 1.6', 'pass', 1]];
  msgs.forEach(([t, l, tone, up]) => { f.raw(`<circle class="f-dot t-${tone}" cx="${x0 + t * 25}" cy="92" r="6"/>`); f.text(x0 + t * 25, up ? 70 : 118, l, { anchor: 'middle', size: 10.5, mono: true, tone }); });
  f.line(x0, 136, x0 + 16 * 25, 136, { tone: 'muted' });
  [0, 4, 8, 12, 16].forEach((t) => { f.line(x0 + t * 25, 132, x0 + t * 25, 140, { tone: 'muted' }); f.text(x0 + t * 25, 156, `${t}ms`, { anchor: 'middle', size: 10.5, tone: 'muted', mono: true }); });
  f.path(`M${x0 + 16 * 25} 140 V176`, { arrow: true, tone: 'pass', width: 2 });
  f.box(x0 + 16 * 25 - 240, 178, 260, 50, { tone: 'pass', label: 'flush once', sub: 'm7: 2.3 · m9: 1.6  (received: 5)', size: 12, mono: true });
  f.text(16, 258, 'Five messages in → one update out, with the latest value per market.', { size: 12.5, tone: 'muted', italic: true });
  return f;
};

const sliceSubscribe: FigureBuilder = () => {
  const f = new Fig(W, 250, 'Slice subscriptions. One external store holds all odds. Each row subscribes only to its own value with useSyncExternalStore and a selector. When market 3 changes, only row 3 re-renders; the parent list and the other rows do not.');
  f.box(200, 14, 240, 50, { tone: 'info', label: 'store', sub: 'odds = { m1, m2, m3, m4 }', mono: true, size: 12 });
  f.text(452, 40, 'setOdds("m3", 2.5)', { size: 12, tone: 'accent', bold: true, mono: true });
  [1, 2, 3, 4].forEach((n, i) => {
    const x = 28 + i * 152, hit = n === 3;
    f.path(`M320 64 L${x + 60} 108`, { arrow: true, tone: hit ? 'accent' : 'muted', dashed: !hit, width: hit ? 2 : 1.2 });
    f.box(x, 108, 120, 50, { tone: hit ? 'accent' : 'muted', dashed: !hit, label: `<Row m${n} />`, sub: hit ? 're-renders' : 'untouched', size: 12, mono: true });
  });
  f.text(W / 2, 192, 'useSyncExternalStore(subscribe, () => select(getState()))', { anchor: 'middle', size: 12, mono: true });
  f.text(W / 2, 214, 'React compares the SELECTED value with Object.is — same value → no render.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  f.text(W / 2, 236, 'memo on the row stops the parent list from cascading renders.', { anchor: 'middle', size: 12.5, tone: 'muted' });
  return f;
};

/* ───────────────────────── 02 · Large data ───────────────────────── */

const offsetVsCursor: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Offset pagination: while you read page 1, a new event is inserted at the top, so page 2 repeats the last row of page 1. Cursor pagination continues after a specific item, so nothing repeats.');
  f.text(156, 22, 'Offset  (?page=2)  ✗', { anchor: 'middle', bold: true, tone: 'fail', size: 13 });
  ['E5', 'E4', 'E3'].forEach((e, i) => f.box(24 + i * 92, 38, 84, 34, { tone: 'info', label: e, size: 12 }));
  f.text(156, 92, 'you loaded page 1: E5 E4 E3', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.box(24, 106, 84, 34, { tone: 'accent', solid: true, label: 'E6 NEW', size: 11.5 });
  f.text(156, 160, 'list is now  E6 E5 E4 | E3 E2 E1', { anchor: 'middle', size: 11.5, tone: 'muted', mono: true });
  f.box(24, 174, 264, 40, { tone: 'fail', label: 'page 2 = E3 E2 E1', sub: 'E3 appears TWICE ✗', size: 12 });
  f.line(320, 14, 320, 228, { tone: 'muted', dashed: true });
  f.text(480, 22, 'Cursor  (?after=E3)  ✓', { anchor: 'middle', bold: true, tone: 'pass', size: 13 });
  ['E5', 'E4', 'E3'].forEach((e, i) => f.box(344 + i * 92, 38, 84, 34, { tone: 'info', label: e, size: 12 }));
  f.text(480, 92, 'you remember the last id: E3', { anchor: 'middle', size: 11.5, tone: 'muted' });
  f.box(344, 106, 84, 34, { tone: 'accent', solid: true, label: 'E6 NEW', size: 11.5 });
  f.text(480, 160, '"give me items after E3"', { anchor: 'middle', size: 11.5, tone: 'muted', mono: true });
  f.box(344, 174, 264, 40, { tone: 'pass', label: 'page 2 = E2 E1', sub: 'stable under inserts ✓', size: 12 });
  f.text(W / 2, 250, 'Whichever you use, dedupe by id on the client.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const normalisedStore: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A normalised store keeps each entity once in a byId map, plus separate index structures: an ordered list of ids for display and an idsByLeague index for fast filtering.');
  f.box(16, 20, 190, 110, { tone: 'info' });
  f.text(111, 40, 'byId  (entities once)', { anchor: 'middle', size: 12, bold: true, tone: 'info' });
  ['evt1: {…}', 'evt2: {…}', 'evt3: {…}'].forEach((t, i) => f.text(32, 66 + i * 22, t, { mono: true, size: 12 }));
  f.box(226, 20, 190, 110, { tone: 'accent' });
  f.text(321, 40, 'ids  (display order)', { anchor: 'middle', size: 12, bold: true, tone: 'accent' });
  ['evt2', 'evt1', 'evt3'].forEach((t, i) => f.text(242, 66 + i * 22, `${i}: ${t}`, { mono: true, size: 12 }));
  f.box(436, 20, 188, 110, { tone: 'pass' });
  f.text(530, 40, 'idsByLeague  (index)', { anchor: 'middle', size: 12, bold: true, tone: 'pass' });
  ['epl: [evt2, evt3]', 'laliga: [evt1]'].forEach((t, i) => f.text(450, 70 + i * 26, t, { mono: true, size: 11.5 }));
  f.text(W / 2, 192, 'Updating an event touches ONE entry. Filtering by league is an index read,', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 214, 'not a 20,000-item filter on every keystroke.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 240, 'Merge each new page into the order (O(n + m)) instead of re-sorting everything.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const timeSlice: FigureBuilder = () => {
  const f = new Fig(W, 250, 'One long task of 600 milliseconds blocks the page. The same work split into slices of about 8 milliseconds, each followed by a yield to the browser, lets it paint and handle taps in between.');
  f.text(16, 24, 'One 600ms task', { bold: true, tone: 'fail', size: 13 });
  f.box(16, 34, 608, 34, { tone: 'fail', solid: true, label: 'process 20,000 events — the page cannot paint or respond', size: 12.5 });
  f.line(16, 100, 624, 100, { tone: 'muted', dashed: true });
  f.text(16, 124, 'Time slices (budget 8ms)', { bold: true, tone: 'pass', size: 13 });
  for (let i = 0; i < 10; i++) {
    f.box(16 + i * 61, 136, 40, 34, { tone: 'pass', solid: true, r: 4 });
    if (i < 9) f.box(58 + i * 61, 146, 17, 14, { tone: 'info', solid: true, r: 3 });
  }
  f.text(16, 194, '■ work for ~8ms', { size: 12, tone: 'pass', bold: true });
  f.text(150, 194, '■ yield: browser can paint, handle taps', { size: 12, tone: 'info', bold: true });
  f.text(W / 2, 226, 'Always process at least ONE item per slice, and allow cancellation.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 03 · Resilience ───────────────────────── */

const backoffJitter: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Reconnect delays. Without jitter, 80 thousand clients retry at the same moments and knock the server over again. With exponential backoff the window doubles each attempt, and full jitter picks a random point inside the window, spreading clients out.');
  f.text(16, 22, 'No jitter: everyone retries together ✗', { bold: true, tone: 'fail', size: 12.5 });
  [1, 2, 4].forEach((d, i) => { const x = 60 + i * 150; for (let j = 0; j < 8; j++) f.raw(`<circle class="f-dot t-fail" cx="${x}" cy="${36 + j * 5}" r="3.5"/>`); f.text(x, 88, `t=${d}s`, { anchor: 'middle', size: 11, mono: true, tone: 'muted' }); });
  f.text(520, 56, 'huge spikes of load', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  f.line(16, 104, 624, 104, { tone: 'muted', dashed: true });
  f.text(16, 126, 'Full jitter: delay = random() × min(max, base × 2^attempt)', { bold: true, tone: 'pass', size: 12.5, mono: true });
  const wins: [number, number][] = [[0, 1], [1, 2], [3, 4]];
  ['attempt 0', 'attempt 1', 'attempt 2'].forEach((a, i) => {
    const y = 144 + i * 34, w = 80 * 2 ** i;
    f.text(16, y + 18, a, { size: 11.5, tone: 'muted', mono: true });
    f.box(110, y + 4, Math.min(w, 400), 20, { tone: 'info', dashed: true, r: 4 });
    for (let j = 0; j < 9; j++) f.raw(`<circle class="f-dot t-pass" cx="${110 + ((j * 37 + i * 13) % 100) / 100 * Math.min(w, 400)}" cy="${y + 14}" r="3.5"/>`);
    void wins;
  });
  f.text(520, 172, 'wider window each time,', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(520, 190, 'clients spread inside it ✓', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(W / 2, 266, 'Reset the attempt counter once a connection is actually established.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const halfOpen: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A half-open connection: the link silently dies, so no close event ever fires. The client sees nothing. A heartbeat timer notices that no message has arrived for too long, tears the socket down and reconnects.');
  f.box(16, 30, 130, 50, { tone: 'info', label: 'Client' });
  f.box(494, 30, 130, 50, { tone: 'info', label: 'Server' });
  f.path('M148 55 H492', { tone: 'pass', width: 2 }); f.text(320, 46, 'messages flowing ✓', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.path('M148 130 H300', { tone: 'pass', width: 2 }); f.path('M300 130 L330 116 M300 130 L330 144', { tone: 'fail', width: 2 });
  f.text(318, 168, '✗ link dies silently: NO close event', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  f.box(16, 108, 130, 44, { tone: 'info', label: 'Client', sub: 'waiting…' });
  f.box(494, 108, 130, 44, { tone: 'muted', dashed: true, label: 'Server', sub: '(gone)' });
  f.box(120, 192, 400, 50, { tone: 'accent', label: 'heartbeat timer: "nothing for 10s?"', sub: 'drop the socket yourself → reconnect with backoff', size: 12 });
  return f;
};

const seqGap: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Sequence numbers on a delta feed. Messages 11 and 12 are applied in order. Message 14 arrives next, but 13 is missing, so 14 is buffered and a gap is reported once. After a snapshot up to 13 arrives, buffered message 14 is applied.');
  const row = (y: number, label: string, items: [string, Tone][]) => { f.text(16, y + 20, label, { size: 12, tone: 'muted', bold: true }); items.forEach(([t, tone], i) => f.box(120 + i * 84, y, 76, 34, { tone, label: t, size: 12, mono: true, r: 6 })); };
  row(22, 'arrives:', [['seq 11', 'pass'], ['seq 12', 'pass'], ['seq 14', 'fail'], ['seq 15', 'fail'], ['seq 13', 'info']]);
  f.text(16, 84, 'lastSeq = 10 → 11 → 12', { size: 12, mono: true });
  f.text(16, 108, 'seq 14 > lastSeq + 1 → GAP: buffer it, call onGap({ from: 13, to: 13 }) once', { size: 12, mono: true, tone: 'fail' });
  f.box(16, 126, 300, 50, { tone: 'info', label: 'buffer', sub: '14, 15  (waiting for 13)' });
  f.path('M318 150 H362', { arrow: true, width: 2 });
  f.box(364, 126, 260, 50, { tone: 'pass', label: 'snapshot / 13 arrives', sub: 'apply 13, then 14, 15 in order' });
  f.text(W / 2, 214, 'seq ≤ last → drop   ·   seq = last + 1 → apply (then drain the buffer)   ·   seq > last + 1 → gap', { anchor: 'middle', size: 11.5, tone: 'muted', mono: true });
  f.text(W / 2, 240, 'Gives at-least-once delivery AND correct order.', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

/* ───────────────────────── 04 · Bet placement ───────────────────────── */

const betStateMachine: FigureBuilder = () => {
  const f = new Fig(W, 250, 'The bet slip is a state machine: idle, then placing, then placed or failed. Failed can return to idle or retry. Per-selection flags like priceChanged and suspended block the Place bet transition until the user accepts.');
  const st = (x: number, y: number, n: string, tone: Tone) => f.box(x, y, 110, 44, { tone, label: n, mono: true, size: 12.5 });
  st(16, 60, 'idle', 'info'); st(200, 60, 'placing', 'accent'); st(410, 14, 'placed', 'pass'); st(410, 106, 'failed', 'fail');
  f.path('M128 82 H198', { arrow: true, width: 2 }); f.text(163, 74, 'placeStart', { anchor: 'middle', size: 10.5, mono: true, tone: 'muted' });
  f.path('M312 72 L408 40', { arrow: true, tone: 'pass', width: 2 }); f.text(304, 50, 'success', { size: 10.5, mono: true, tone: 'pass' });
  f.path('M312 94 L408 124', { arrow: true, tone: 'fail', width: 2 }); f.text(304, 122, 'failure', { size: 10.5, mono: true, tone: 'fail' });
  f.path('M466 106 C466 190 70 190 72 106', { arrow: true, tone: 'muted', dashed: true });
  f.text(270, 186, 'edit slip / retry → idle', { anchor: 'middle', size: 11, tone: 'muted', mono: true });
  f.box(16, 196, 608, 40, { tone: 'fail', dashed: true, label: 'canPlace() is false while: stake = 0 · priceChange pending · suspended · already placing', size: 11 });
  return f;
};

const idempotencyFlow: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Idempotent retry. The client sends a bet with key K1. The server places it, but the response is lost and the client times out. The client retries with the same key K1. The server recognises K1 and returns the original result instead of placing a second bet.');
  f.box(16, 24, 120, 40, { tone: 'info', label: 'Client' }); f.box(504, 24, 120, 40, { tone: 'info', label: 'Server' });
  f.line(76, 64, 76, 252, { tone: 'muted', dashed: true }); f.line(564, 64, 564, 252, { tone: 'muted', dashed: true });
  f.path('M80 92 H560', { arrow: true, width: 2 }); f.text(320, 84, 'POST /bets   key: K1', { anchor: 'middle', size: 12, mono: true });
  f.text(564, 108, 'places bet #42', { anchor: 'end', size: 11.5, tone: 'pass', bold: true });
  f.path('M560 128 H380', { tone: 'fail', dashed: true, width: 2 }); f.text(330, 134, '✗ response lost', { anchor: 'middle', size: 12, tone: 'fail', bold: true });
  f.text(76, 158, '⏱ timeout — did it work? unknown!', { size: 11.5, tone: 'accent', bold: true });
  f.path('M80 182 H560', { arrow: true, tone: 'accent', width: 2 }); f.text(320, 174, 'retry  POST /bets   key: K1 (SAME key)', { anchor: 'middle', size: 12, mono: true, tone: 'accent' });
  f.text(564, 204, 'seen K1 → return bet #42', { anchor: 'end', size: 11.5, tone: 'pass', bold: true });
  f.path('M560 222 H80', { arrow: true, tone: 'pass', width: 2 }); f.text(320, 240, 'bet #42 (the ORIGINAL result)', { anchor: 'middle', size: 12, tone: 'pass', bold: true });
  f.text(W / 2, 270, 'One bet, even after a retry. A NEW user action gets a NEW key.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const doubleClickLayers: FigureBuilder = () => {
  const f = new Fig(W, 230, 'Three layers of double-submit protection. The button is disabled instantly with visible progress; the code has an in-flight guard; and the server enforces idempotency keys. Any single layer alone can leak.');
  const layers: [string, string, Tone][] = [['① UI', 'disable the button + show "Placing…" instantly', 'info'], ['② Code', 'in-flight guard (a ref, not state — state updates are async)', 'accent'], ['③ Server', 'idempotency key: a repeat returns the original result', 'pass']];
  layers.forEach(([t, sub, tone], i) => { f.box(16 + i * 12, 20 + i * 60, 608 - i * 24, 50, { tone, label: t, sub, size: 12.5 }); });
  f.text(W / 2, 214, 'Any one layer alone leaks. Money needs all three.', { anchor: 'middle', size: 12.5, bold: true });
  return f;
};

/* ───────────────────────── 05 · Memory leaks ───────────────────────── */

const leakRetention: FigureBuilder = () => {
  const f = new Fig(W, 260, 'A leak is memory that is still reachable but no longer useful. A global or a window holds a listener, which holds a closure, which holds a huge array. Even after the component unmounted, the garbage collector cannot free it.');
  const chain: [string, Tone][] = [['GC root (window…)', 'muted'], ['listener callback', 'accent'], ['closure scope', 'info'], ['huge array / DOM tree', 'fail']];
  chain.forEach(([t, tone], i) => { const x = 16 + i * 158; f.box(x, 40, 140, 54, { tone, label: t, size: 11.5 }); if (i < 3) f.path(`M${x + 142} 67 H${x + 156}`, { arrow: true, width: 2 }); });
  f.text(86, 30, 'a GC root', { anchor: 'middle', size: 11, tone: 'muted', bold: true });
  f.text(W / 2, 124, 'Reachable from a root → the garbage collector may NOT free it', { anchor: 'middle', size: 13, bold: true, tone: 'fail' });
  f.box(16, 150, 290, 80, { tone: 'fail', label: 'Leak: acquire without release', sub: 'listeners · timers · sockets · big arrays', size: 12 });
  f.box(334, 150, 290, 80, { tone: 'pass', label: 'Rule: every acquire has a release', sub: 'cleanups · dispose() · bounds', size: 12 });
  return f;
};

const lruTtl: FigureBuilder = () => {
  const f = new Fig(W, 250, 'An LRU plus TTL cache with capacity 3. Entries are ordered from least to most recently used. A get moves an entry to the most recent end. Adding a fourth entry evicts the least recently used. Entries past their time to live count as misses and are removed.');
  f.text(16, 24, 'least recently used', { size: 11.5, tone: 'fail', bold: true }); f.text(624, 24, 'most recently used', { anchor: 'end', size: 11.5, tone: 'pass', bold: true });
  ['A', 'B', 'C'].forEach((k, i) => f.box(40 + i * 130, 34, 110, 44, { tone: i === 0 ? 'fail' : 'info', label: `${k}`, sub: i === 0 ? 'next to evict' : 'fresh', size: 13 }));
  f.text(W / 2, 104, 'get(A) → A becomes most recent:', { anchor: 'middle', size: 12.5, bold: true });
  ['B', 'C', 'A'].forEach((k, i) => f.box(40 + i * 130, 116, 110, 44, { tone: i === 0 ? 'fail' : 'info', label: k, sub: i === 0 ? 'next to evict' : undefined, size: 13 }));
  f.text(W / 2, 184, 'set(D) when full → evict B (size) · a TTL-expired entry is a miss and is removed (expired)', { anchor: 'middle', size: 11.5, mono: true });
  f.text(W / 2, 214, 'Bound every cache by memory budget. Give it a size cap, a TTL, or both.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 06 · Workers ───────────────────────── */

const workerRpc: FigureBuilder = () => {
  const f = new Fig(W, 270, 'RPC over postMessage. The client posts a call message with an id, method and arguments. The worker replies with a message carrying the same id and either a result or an error. A cancel message with the id asks the worker to stop.');
  f.box(16, 20, 130, 40, { tone: 'info', label: 'Main thread' }); f.box(494, 20, 130, 40, { tone: 'accent', label: 'Worker' });
  f.line(81, 60, 81, 240, { tone: 'muted', dashed: true }); f.line(559, 60, 559, 240, { tone: 'muted', dashed: true });
  const msgs: [number, string, boolean, Tone][] = [[84, '{ id: 7, type: "call", method: "price", args }', true, 'ink'], [124, '{ id: 8, type: "call", … }', true, 'ink'], [164, '{ id: 8, type: "result", result }   (out of order is fine)', false, 'pass'], [204, '{ id: 7, type: "cancel" }', true, 'fail'], [236, '(no reply for cancelled 7)', false, 'muted']];
  msgs.forEach(([y, t, right, tone]) => { if (y < 230) f.path(right ? `M85 ${y} H555` : `M555 ${y} H85`, { arrow: true, tone, width: 1.8 }); f.text(320, y - 7, t, { anchor: 'middle', size: 11, mono: true, tone: tone === 'muted' ? 'muted' : tone }); });
  f.text(W / 2, 262, 'ids match answers to questions; cancel + timeout + terminate are part of the protocol.', { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

const cooperativeCancel: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A worker only reads its inbox between tasks. During one long synchronous loop it cannot see a cancel message. If the work is chunked with yields, the cancel message is noticed between chunks and the job stops.');
  f.text(16, 24, 'One 400ms loop: cancel is invisible ✗', { bold: true, tone: 'fail', size: 12.5 });
  f.box(16, 34, 500, 34, { tone: 'fail', solid: true, label: 'synchronous maths — cannot read messages', size: 12 });
  f.text(330, 92, '← "cancel" arrives here, waits in the inbox', { anchor: 'middle', size: 11.5, tone: 'fail' });
  f.line(16, 112, 624, 112, { tone: 'muted', dashed: true });
  f.text(16, 134, 'Chunked with yields: cancel is seen between chunks ✓', { bold: true, tone: 'pass', size: 12.5 });
  for (let i = 0; i < 5; i++) { f.box(16 + i * 62, 146, 50, 34, { tone: 'pass', solid: true, r: 4 }); if (i < 4) f.box(68 + i * 62, 154, 10, 18, { tone: 'info', solid: true, r: 2 }); }
  f.text(150, 204, '↑ inbox checked here: sees cancel → stops', { size: 11.5, tone: 'pass', bold: true });
  f.text(W / 2, 236, 'Long jobs must check a flag / AbortSignal between slices.', { anchor: 'middle', size: 12.5, tone: 'muted', italic: true });
  return f;
};

const poolQueue: FigureBuilder = () => {
  const f = new Fig(W, 250, 'A worker pool of size 2. Jobs wait in a FIFO queue. Each worker runs one job at a time and takes the next queued job when it finishes, so concurrency is bounded.');
  f.text(16, 24, 'queue (FIFO)', { size: 12, bold: true, tone: 'muted' });
  ['job 5', 'job 4', 'job 3'].forEach((j, i) => f.box(16 + i * 76, 34, 68, 34, { tone: 'muted', label: j, size: 11.5, r: 6 }));
  f.path('M248 52 H290', { arrow: true, width: 2 });
  f.box(294, 22, 150, 56, { tone: 'accent', label: 'worker 1', sub: 'running job 1' }); f.box(294, 92, 150, 56, { tone: 'accent', label: 'worker 2', sub: 'running job 2' });
  f.path('M248 52 L292 112', { arrow: true, tone: 'muted', dashed: true });
  f.path('M446 50 H500', { arrow: true, tone: 'pass' }); f.path('M446 120 H500', { arrow: true, tone: 'pass' });
  f.box(504, 38, 120, 44, { tone: 'pass', label: 'result 1', size: 12 }); f.box(504, 98, 120, 44, { tone: 'pass', label: 'result 2', size: 12 });
  f.text(W / 2, 182, 'Create workers lazily (never more than `size`). A failed job frees its worker too.', { anchor: 'middle', size: 12.5 });
  f.text(W / 2, 206, 'stats(): { workers, busy, idle, queued }', { anchor: 'middle', size: 12, mono: true, tone: 'muted' });
  f.text(W / 2, 230, 'terminate() → reject queued jobs with "Pool terminated".', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 07 · Multi-tab ───────────────────────── */

const tabTopology: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Left: four tabs each open their own WebSocket, so the server sees four connections. Right: one leader tab opens the only socket and relays messages to the other tabs over a BroadcastChannel.');
  f.text(156, 22, '4 tabs, 4 sockets ✗', { anchor: 'middle', bold: true, tone: 'fail', size: 13 });
  [0, 1, 2, 3].forEach((i) => { const x = 20 + i * 70; f.box(x, 44, 62, 34, { tone: 'info', label: `tab ${i + 1}`, size: 11, r: 6 }); f.path(`M${x + 31} 78 L156 150`, { arrow: true, tone: 'fail', width: 1.5 }); });
  f.box(96, 150, 120, 44, { tone: 'fail', label: 'Server', sub: '4× connections' });
  f.line(320, 14, 320, 250, { tone: 'muted', dashed: true });
  f.text(480, 22, 'leader + relay ✓', { anchor: 'middle', bold: true, tone: 'pass', size: 13 });
  f.box(420, 44, 120, 38, { tone: 'accent', solid: true, label: 'tab 1 (leader)', size: 11, r: 6 });
  f.path('M480 82 V150', { arrow: true, tone: 'pass', width: 2 }); f.box(420, 150, 120, 44, { tone: 'pass', label: 'Server', sub: '1 connection' });
  [0, 1, 2].forEach((i) => { const x = 346 + i * 92; f.box(x, 214, 84, 30, { tone: 'info', label: `tab ${i + 2}`, size: 11, r: 6 }); });
  f.path('M450 82 C380 120 390 190 388 212', { arrow: true, tone: 'info', dashed: true }); f.path('M510 82 C560 120 560 190 566 212', { arrow: true, tone: 'info', dashed: true });
  f.text(480, 264, 'BroadcastChannel relays feed messages', { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

const lwwVersions: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Last writer wins with versions. Two tabs set the same key at nearly the same time. Each write carries a version made of a timestamp and a tab id. The higher version wins everywhere, with the tab id breaking timestamp ties, so all tabs converge. A delete leaves a tombstone so an old write cannot bring the key back.');
  f.box(16, 20, 200, 60, { tone: 'info', label: 'Tab A  set(theme, "dark")', sub: 'v = { ts: 100, tab: "a" }', size: 11.5 });
  f.box(424, 20, 200, 60, { tone: 'accent', label: 'Tab B  set(theme, "light")', sub: 'v = { ts: 100, tab: "b" }', size: 11.5 });
  f.path('M218 50 H422', { arrow: true, tone: 'info' }); f.path('M422 66 H218', { arrow: true, tone: 'accent' });
  f.text(320, 44, 'broadcast', { anchor: 'middle', size: 11, tone: 'muted' });
  f.text(W / 2, 112, 'same ts → compare tab id: "b" > "a"  →  B’s write wins in EVERY tab', { anchor: 'middle', size: 12.5, bold: true, mono: true });
  f.box(16, 132, 290, 52, { tone: 'pass', label: 'both tabs end with "light"', sub: 'same answer regardless of delivery order' });
  f.box(334, 132, 290, 52, { tone: 'fail', label: 'delete = tombstone (kept + versioned)', sub: 'a late old set cannot resurrect it' });
  f.text(W / 2, 214, 'logical clock: ts = max(now, highestSeen + 1) so a local write always beats what you saw.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 238, 'Money is different: the SERVER decides. Tabs display and hint only.', { anchor: 'middle', size: 12.5, tone: 'fail', bold: true });
  return f;
};

const heartbeatElection: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Heartbeat leader election. Every tab broadcasts heartbeats. Each tab considers a peer alive if it was heard recently. The leader is the alive tab with the lowest id. When the leader tab closes, it sends bye, or its heartbeats time out, and the next lowest becomes leader.');
  const row = (y: number, label: string, tabs: [string, Tone, string][]) => { f.text(16, y + 22, label, { size: 12, tone: 'muted', bold: true }); tabs.forEach(([n, tone, sub], i) => f.box(150 + i * 160, y, 140, 44, { tone, label: n, sub, size: 12, dashed: tone === 'muted' })); };
  row(24, 'all alive', [['tab "a"', 'pass', '👑 leader (lowest id)'], ['tab "b"', 'info', 'follower'], ['tab "c"', 'info', 'follower']]);
  f.path('M240 96 V118', { arrow: true, tone: 'fail', width: 2 }); f.text(254, 112, '"a" closes → sends bye (or heartbeats stop → timeout)', { size: 11.5, tone: 'fail', bold: true });
  row(126, 'after', [['tab "a"', 'muted', 'gone'], ['tab "b"', 'pass', '👑 new leader'], ['tab "c"', 'info', 'follower']]);
  f.text(W / 2, 214, 'Hidden tabs have throttled timers (≥ 1s, ~1/min later): keep the timeout well above that,', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 234, 'or use Web Locks, which do not depend on timers.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};


const releasePairs: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Every acquisition needs a matching release: addEventListener with removeEventListener, setInterval with clearInterval, subscribe with unsubscribe, new WebSocket with close, observe with disconnect, fetch with abort, new Worker with terminate.');
  f.text(150, 20, 'ACQUIRE', { anchor: 'middle', bold: true, tone: 'fail', size: 12.5 });
  f.text(490, 20, 'RELEASE (in the cleanup)', { anchor: 'middle', bold: true, tone: 'pass', size: 12.5 });
  const pairs: [string, string][] = [['addEventListener', 'removeEventListener'], ['setInterval / setTimeout', 'clearInterval / clearTimeout'], ['store.subscribe(fn)', 'the returned unsubscribe()'], ['new WebSocket(url)', 'socket.close()'], ['observer.observe(el)', 'observer.disconnect()'], ['fetch(url, { signal })', 'controller.abort()'], ['new Worker(file)', 'worker.terminate()']];
  pairs.forEach(([a, r], i) => {
    const y = 30 + i * 36;
    f.box(16, y, 250, 28, { tone: 'fail', label: a, size: 11.5, mono: true, r: 6 });
    f.path(`M270 ${y + 14} H366`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(370, y, 254, 28, { tone: 'pass', label: r, size: 11.5, mono: true, r: 6 });
  });
  return f;
};

export const prodFigures: Record<string, FigureBuilder> = {
  'firehose-flow': firehoseFlow, 'coalesce-window': coalesceWindow, 'slice-subscribe': sliceSubscribe,
  'offset-vs-cursor': offsetVsCursor, 'normalised-store': normalisedStore, 'time-slice': timeSlice,
  'backoff-jitter': backoffJitter, 'half-open': halfOpen, 'seq-gap': seqGap,
  'bet-state-machine': betStateMachine, 'idempotency-flow': idempotencyFlow, 'double-click-layers': doubleClickLayers,
  'leak-retention': leakRetention, 'release-pairs': releasePairs, 'lru-ttl': lruTtl,
  'worker-rpc': workerRpc, 'cooperative-cancel': cooperativeCancel, 'pool-queue': poolQueue,
  'tab-topology': tabTopology, 'lww-versions': lwwVersions, 'heartbeat-election': heartbeatElection,
};
