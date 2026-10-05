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

export const renderingFigures: Record<string, FigureBuilder> = {
  'rd-strategies': strategiesFigure,
  'rd-timeline': timelineFigure,
  'rd-isr': isrFigure,
};
