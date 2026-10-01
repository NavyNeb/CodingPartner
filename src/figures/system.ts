import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

const radioMethod: FigureBuilder = () => {
  const f = new Fig(W, 300, 'The RADIO method for frontend system design: Requirements, Architecture, Data model, Interface, Optimizations. Each step has a question to answer out loud and a typical output.');
  const steps: [string, string, string, string, Tone][] = [
    ['R', 'Requirements', 'What are we building, for whom, at what scale?', 'features in/out, devices, a11y', 'accent'],
    ['A', 'Architecture', 'What are the big pieces and who talks to whom?', 'component + data-flow diagram', 'info'],
    ['D', 'Data model', 'What state exists, where does it live?', 'entities, store shape, caching', 'info'],
    ['I', 'Interface', 'What does the API / component contract look like?', 'endpoints, props, events', 'info'],
    ['O', 'Optimizations', 'What breaks or feels slow, and how do we fix it?', 'perf, a11y, errors, offline', 'pass'],
  ];
  steps.forEach(([k, name, q, out, tone], i) => {
    const y = 14 + i * 56;
    f.box(16, y, 44, 44, { tone, solid: true, label: k, size: 20 });
    f.text(74, y + 18, name, { bold: true, size: 14 });
    f.text(74, y + 37, q, { size: 11.5, tone: 'muted' });
    f.text(624, y + 18, out, { anchor: 'end', size: 11.5, tone, mono: true });
  });
  return f;
};

const feedArch: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Infinite feed architecture. The API returns pages with a cursor. A pager fetches and de-duplicates them into a normalised store. A virtualised list renders only visible rows. A like button updates the store optimistically and rolls back if the request fails.');
  f.box(16, 20, 130, 54, { tone: 'muted', label: 'API', sub: 'GET /feed?cursor=' , size: 12.5, mono: true });
  f.path('M146 47 H196', { arrow: true, width: 2 });
  f.text(171, 38, 'page', { anchor: 'middle', size: 11, tone: 'muted' });
  f.box(200, 20, 150, 54, { tone: 'info', label: 'pager', sub: 'cursor · dedupe · guard', size: 12.5 });
  f.path('M350 47 H400', { arrow: true, width: 2 });
  f.box(404, 20, 220, 54, { tone: 'info', label: 'store', sub: 'byId + ordered ids', size: 12.5, mono: true });
  f.path('M514 74 V120', { arrow: true, width: 2 });
  f.box(404, 122, 220, 70, { tone: 'pass', label: 'virtual list', sub: 'renders ~10 visible rows', size: 12.5 });
  f.path('M404 157 H350', { arrow: true, tone: 'accent', width: 2 });
  f.box(200, 122, 150, 70, { tone: 'accent', label: 'near the end?', sub: 'IntersectionObserver', size: 12 });
  f.path('M275 122 V80', { arrow: true, tone: 'accent', width: 2 });
  f.text(285, 106, 'loadMore()', { size: 11, mono: true, tone: 'accent' });
  f.box(16, 122, 130, 70, { tone: 'fail', dashed: true, label: 'like button', sub: 'optimistic', size: 12.5 });
  f.path('M146 157 C170 230 480 230 514 74', { arrow: true, tone: 'fail', dashed: true, width: 1.6 });
  f.text(330, 236, 'update store first; roll back on error', { anchor: 'middle', size: 11.5, tone: 'fail' });
  f.text(W / 2, 282, 'Cursor + dedupe + a loading guard prevent gaps, repeats and double fetches.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const typeaheadFlow: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Typeahead. Keystrokes are debounced. A cache hit answers instantly. A miss starts a request that carries an abort signal. A newer keystroke aborts the older request, so late responses can never overwrite newer results.');
  ['r', 're', 'rea', 'reac'].forEach((t, i) => f.box(16 + i * 58, 20, 52, 28, { tone: 'ink', label: t, mono: true, size: 12, r: 6 }));
  f.text(16, 68, 'keystrokes', { size: 11.5, tone: 'muted' });
  f.path('M254 34 H290', { arrow: true, width: 2 });
  f.box(294, 14, 120, 40, { tone: 'info', label: 'debounce', sub: '150 ms', size: 12 });
  f.path('M414 34 H450', { arrow: true, width: 2 });
  f.box(454, 14, 170, 40, { tone: 'info', label: 'cache hit?', sub: 'LRU by query', size: 12 });
  f.path('M539 54 V96', { arrow: true, tone: 'pass', width: 2 });
  f.text(549, 80, 'yes', { size: 11.5, tone: 'pass', bold: true });
  f.box(454, 98, 170, 40, { tone: 'pass', solid: true, label: 'show results', size: 12.5 });
  f.path('M470 54 L330 150', { arrow: true, tone: 'accent', width: 2 });
  f.text(420, 112, 'no', { size: 11.5, tone: 'accent', bold: true });
  f.box(200, 152, 260, 52, { tone: 'accent', label: 'fetch(q, { signal })', sub: 'abort the previous request first', mono: true, size: 12 });
  f.path('M330 204 V232', { arrow: true, width: 2 });
  f.box(200, 234, 260, 40, { tone: 'info', label: 'still the latest query?', sub: 'yes → store + render', size: 12 });
  f.text(40, 190, 'late response', { size: 12, tone: 'fail', bold: true });
  f.text(40, 208, 'for "re"? ignored', { size: 12, tone: 'fail' });
  return f;
};

const outboxStates: FigureBuilder = () => {
  const f = new Fig(W, 300, 'An optimistic outbox. A new message appears immediately as pending. Messages are sent one at a time to keep order. Success marks it sent. Failure retries with backoff, then marks it failed, where the user can retry it manually.');
  const st = (x: number, y: number, n: string, tone: Tone, sub?: string) => f.box(x, y, 120, 54, { tone, label: n, sub, size: 12.5, mono: true });
  st(16, 40, 'pending', 'muted', 'shown at once');
  st(190, 40, 'sending', 'accent', 'one at a time');
  st(500, 14, 'sent', 'pass', 'has serverId');
  st(340, 140, 'retrying', 'info', 'backoff delay');
  st(500, 140, 'failed', 'fail', 'tap to retry');
  f.path('M136 67 H188', { arrow: true, width: 2 });
  f.path('M310 58 L498 40', { arrow: true, tone: 'pass', width: 2 });
  f.text(404, 40, 'ack', { size: 11.5, tone: 'pass', bold: true, mono: true });
  f.path('M270 94 L360 138', { arrow: true, tone: 'info', width: 2 });
  f.text(258, 124, 'error', { size: 11.5, tone: 'info', bold: true, mono: true });
  f.path('M340 160 C300 120 300 100 310 94', { arrow: true, tone: 'info', dashed: true });
  f.text(300, 180, 'try again', { anchor: 'middle', size: 11, tone: 'muted', mono: true });
  f.path('M460 167 H498', { arrow: true, tone: 'fail', width: 2 });
  f.text(480, 160, 'max', { anchor: 'middle', size: 10.5, tone: 'fail', mono: true });
  f.path('M560 140 C600 100 600 80 140 94 L76 94', { arrow: true, tone: 'muted', dashed: true, width: 1.2 });
  f.text(W / 2, 232, 'Order is kept by sending one message at a time per conversation.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 254, 'Each message gets a local id up front, so the UI never waits for the server.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 276, 'Retrying the SAME local id lets the server deduplicate (idempotency key).', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

export const systemFigures: Record<string, FigureBuilder> = {
  'radio-method': radioMethod, 'feed-arch': feedArch, 'typeahead-flow': typeaheadFlow, 'outbox-states': outboxStates,
};
