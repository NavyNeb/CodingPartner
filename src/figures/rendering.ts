import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 1 · Rendering strategies ───────────────────────── */

const strategiesFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Four rendering strategies. Client side rendering builds the HTML in the browser on every visit. Server side rendering builds it on the server for every request. Static site generation builds it once at build time. Incremental static regeneration builds it at build time and rebuilds it in the background every so often.');
  const cols: [string, string, string, string, Tone][] = [
    ['CSR', 'in the browser', 'every visit', 'empty shell + JS', 'muted'],
    ['SSR', 'on the server', 'every request', 'full HTML, fresh', 'info'],
    ['SSG', 'at build time', 'once', 'files on a CDN', 'pass'],
    ['ISR', 'build + refresh', 'every N seconds', 'CDN, kept fresh', 'accent'],
  ];
  cols.forEach(([t, where, when, out, tone], i) => {
    const x = 8 + i * 158;
    f.box(x, 20, 142, 170, { tone });
    f.text(x + 71, 52, t, { anchor: 'middle', size: 22, bold: true, mono: true });
    f.text(x + 71, 82, 'HTML is built', { anchor: 'middle', size: 10.5, tone: 'muted' });
    f.text(x + 71, 102, where, { anchor: 'middle', size: 12, bold: true });
    f.text(x + 71, 132, when, { anchor: 'middle', size: 12 });
    f.text(x + 71, 166, out, { anchor: 'middle', size: 10.5, tone: 'muted' });
  });
  f.text(W / 2, 224, 'Ask two questions: does it change per user, and how fast does the content change?', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 252, 'Faster first paint costs server work or staleness; there is no free option.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const timelineFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'A timeline comparing client side and server side rendering. With client side rendering the browser gets a tiny HTML shell, then downloads and runs JavaScript, then fetches data, then renders, so first content appears late but the page is interactive at once. With server side rendering the server renders first, so content appears early, but the page only becomes interactive after JavaScript downloads and hydrates.');
  const bar = (y: number, label: string, segs: [string, number, Tone][]) => {
    f.text(12, y + 24, label, { size: 12, bold: true, mono: true });
    let x = 70;
    for (const [t, w, tone] of segs) {
      f.box(x, y, w, 40, { tone, solid: true, label: t, size: 10.5 });
      x += w;
    }
    return x;
  };
  bar(34, 'CSR', [['', 18, 'muted'], ['JS download + run', 170, 'info'], ['data', 110, 'accent'], ['draw', 46, 'pass']]);
  bar(108, 'SSR', [['server + data', 150, 'accent'], ['JS download', 170, 'info'], ['hydrate', 58, 'fail']]);
  f.text(70 + 18 + 170 + 110 + 46, 96, '▲ first content (late)', { anchor: 'end', size: 11, bold: true, tone: 'fail' });
  f.text(70 + 150, 170, '▲ first content (early)', { anchor: 'start', size: 11, bold: true, tone: 'pass' });
  f.text(W / 2, 214, 'CSR: late first paint, interactive immediately. SSR: early paint, interactive after hydration.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 242, 'A page that looks ready but ignores clicks is the cost of SSR.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const isrFigure: FigureBuilder = () => {
  const f = new Fig(W, 260, 'The life of an incrementally regenerated page. A fresh cached page is served as a hit. Once it is older than the revalidate time, the next request still gets the old page at once, marked stale, and triggers one background re-render. When that finishes the new page replaces the old one and later requests are hits again.');
  const steps: [string, string, Tone][] = [
    ['HIT', 'fresh: serve cache', 'pass'],
    ['STALE', 'old page now,\nrebuild in background', 'accent'],
    ['HIT', 'new page replaces old', 'pass'],
  ];
  steps.forEach(([t, sub, tone], i) => {
    const x = 8 + i * 212;
    f.box(x, 24, 200, 86, { tone, solid: i === 1 });
    f.text(x + 100, 52, t, { anchor: 'middle', size: 17, bold: true, mono: true });
    sub.split('\n').forEach((line, j) => f.text(x + 100, 76 + j * 16, line, { anchor: 'middle', size: 11 }));
    if (i < 2) f.path(`M${x + 202} 67 H${x + 210}`, { arrow: true, tone: 'muted', width: 1.6 });
  });
  f.text(W / 2, 150, 'Nobody ever waits for the re-render, except the very first visitor of a new page.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 178, 'On-demand revalidation (a webhook after an edit) drops the page so the next request rebuilds it.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 206, 'Many requests, one rebuild: concurrent stale hits must not each start their own.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 2 · Hydration, streaming and Server Components ───────────────────────── */

const hydrationFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Hydration. The server sends finished HTML, so the page is visible at once, but buttons do nothing yet. The JavaScript bundle then downloads and runs, React walks the existing HTML and attaches event handlers to it, and only then is the page interactive. The span between visible and interactive is the dead zone where clicks are ignored. If the first client render differs from the server HTML, that is a hydration mismatch.');
  const steps: [string, string, Tone][] = [['HTML arrives', 'visible', 'pass'], ['JS downloads', 'still dead', 'fail'], ['JS runs', 'still dead', 'fail'], ['hydrated', 'interactive', 'pass']];
  steps.forEach(([t, sub, tone], i) => {
    const x = 8 + i * 158;
    f.box(x, 24, 142, 62, { tone, solid: i === 3 });
    f.text(x + 71, 50, t, { anchor: 'middle', size: 12.5, bold: true });
    f.text(x + 71, 70, sub, { anchor: 'middle', size: 11 });
    if (i < 3) f.path(`M${x + 144} 55 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.6 });
  });
  f.box(166, 104, 308, 36, { tone: 'fail', label: 'the dead zone: looks ready, ignores clicks', size: 11.5 });
  f.text(W / 2, 176, 'Hydration reuses the server HTML: the FIRST client render must produce the same markup.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 204, 'Dates, random ids, window checks and locale formatting are the usual mismatch sources.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 232, 'Fix: render the same thing first, then change it in an effect after mount.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const streamingFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Streaming server rendering. Instead of waiting for the slowest data before sending anything, the server sends the page shell at once with fallbacks in the slots, then streams each section as its data resolves, in completion order. The browser paints the shell immediately and fills the slots as the chunks arrive.');
  f.text(12, 40, 'server', { size: 11.5, bold: true, mono: true });
  f.box(70, 22, 90, 30, { tone: 'info', solid: true, label: 'shell', size: 11 });
  f.box(168, 22, 120, 30, { tone: 'pass', solid: true, label: 'fill: reviews', size: 10.5 });
  f.box(296, 22, 150, 30, { tone: 'accent', solid: true, label: 'fill: recommendations', size: 10.5 });
  f.text(12, 100, 'browser', { size: 11.5, bold: true, mono: true });
  f.box(70, 80, 90, 44, { tone: 'info', label: 'paints now', size: 10.5 });
  f.box(168, 80, 120, 44, { tone: 'pass', label: 'reviews appear', size: 10.5 });
  f.box(296, 80, 150, 44, { tone: 'accent', label: 'recs appear', size: 10.5 });
  f.path('M115 54 V78', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M228 54 V78', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M371 54 V78', { arrow: true, tone: 'muted', width: 1.4 });
  f.text(W / 2, 168, 'Time to first byte no longer waits for the slowest query.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 196, 'Each Suspense boundary is a slot: a fallback first, the real content when ready.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 224, 'One failing section shows its error state; it must not take down the page.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const rscFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Server and client components. A page and a product list run only on the server and ship no JavaScript. A like button marked as a client component, and everything it imports, is sent to the browser. A server component passed into the client component as children stays on the server.');
  f.box(8, 18, 624, 36, { tone: 'info', label: 'Page (server)  ·  0 KB of JS', size: 12 });
  f.path('M160 56 V74', { arrow: true, tone: 'muted', width: 1.4 });
  f.path('M470 56 V74', { arrow: true, tone: 'muted', width: 1.4 });
  f.box(8, 76, 300, 36, { tone: 'info', label: 'ProductList (server)  ·  0 KB', size: 11.5 });
  f.box(332, 76, 300, 36, { tone: 'accent', solid: true, label: 'LikeButton ("use client")  ·  8 KB', size: 11 });
  f.path('M482 114 V132', { arrow: true, tone: 'muted', width: 1.4 });
  f.box(332, 134, 300, 36, { tone: 'accent', label: 'Icon (imported by it)  ·  2 KB', size: 11 });
  f.box(8, 134, 300, 36, { tone: 'pass', label: 'Reviews (server, passed as children)', size: 10.5 });
  f.text(W / 2, 208, 'A "use client" file pulls its whole import subtree into the bundle.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 236, 'Push the boundary DOWN: make the small interactive leaf a client component, not the page.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 262, 'Server components can await data directly; they cannot use state, effects or browser APIs.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const renderingFigures: Record<string, FigureBuilder> = {
  'rd-strategies': strategiesFigure,
  'rd-timeline': timelineFigure,
  'rd-isr': isrFigure,
  'rd-hydration': hydrationFigure,
  'rd-streaming': streamingFigure,
  'rd-rsc': rscFigure,
};
