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

/* ───────────────────────── 3 · Next.js essentials ───────────────────────── */

const appRouterFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'File system routing. Folders become URL segments. A folder in square brackets is a dynamic segment, a folder in parentheses is a group that does not appear in the URL, and special files such as layout, loading and error wrap the pages beneath them. A page inside blog and slug folders gets the layout of the root and of blog, nested outside in.');
  const rows: [string, string][] = [
    ['app/page.js', '/'],
    ['app/blog/page.js', '/blog'],
    ['app/blog/[slug]/page.js', '/blog/:slug'],
    ['app/(shop)/cart/page.js', '/cart'],
    ['app/docs/[...path]/page.js', '/docs/*'],
  ];
  rows.forEach(([file, url], i) => {
    const y = 16 + i * 38;
    f.box(8, y, 330, 30, { tone: 'muted', label: file, size: 11, mono: true });
    f.path(`M340 ${y + 15} H366`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(368, y, 264, 30, { tone: 'pass', label: url, size: 11.5, mono: true });
  });
  f.text(W / 2, 226, 'layouts nest outside in: root layout → blog layout → page', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 252, 'loading.js, error.js and not-found.js apply to the nearest folder and everything below it.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 276, '(group) folders organise files without changing the URL.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const cacheLayersFigure: FigureBuilder = () => {
  const f = new Fig(W, 300, 'Four caches in a Next.js app. Request memoization removes duplicate fetches inside a single render. The data cache stores fetch results across requests until they expire or are revalidated by tag. The full route cache stores the rendered HTML and server component payload of static routes. The router cache holds already visited pages in the browser for instant navigation.');
  const layers: [string, string, string, Tone][] = [
    ['request memoization', 'one render', 'same fetch called twice = one request', 'muted'],
    ['data cache', 'across requests', 'fetch results; revalidate by time or tag', 'info'],
    ['full route cache', 'build / revalidate', 'rendered HTML + payload of static routes', 'accent'],
    ['router cache', 'in the browser', 'visited pages: instant back and forward', 'pass'],
  ];
  layers.forEach(([name, scope, what, tone], i) => {
    const y = 16 + i * 56;
    f.box(8, y, 616, 46, { tone });
    f.text(22, y + 20, name, { size: 12.5, bold: true, mono: true });
    f.text(22, y + 37, what, { size: 11 });
    f.text(612, y + 28, scope, { anchor: 'end', size: 11, tone: 'muted' });
  });
  f.text(W / 2, 252, 'Stale data bugs are usually "which cache?" bugs.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 278, 'Know the knob for each: revalidate, tags, dynamic APIs, router refresh.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const dynamicFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'What makes a route dynamic. Reading cookies or headers, reading search parameters, fetching with no store, or forcing dynamic all make a route render on every request. Otherwise, if any fetch or the segment sets a positive revalidate time, the route is statically generated and refreshed on that interval. With none of these it is fully static.');
  const qs: [string, string, Tone][] = [
    ['cookies / headers / searchParams?', 'dynamic', 'fail'],
    ['fetch with no-store, or revalidate = 0?', 'dynamic', 'fail'],
    ['a positive revalidate anywhere?', 'static + refresh (ISR)', 'accent'],
    ['none of the above', 'fully static', 'pass'],
  ];
  qs.forEach(([q, out, tone], i) => {
    const y = 16 + i * 52;
    f.box(8, y, 372, 42, { tone: 'muted', label: q, size: 11.5 });
    f.path(`M382 ${y + 21} H416`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(418, y, 214, 42, { tone, solid: i === 3, label: out, size: 11.5 });
  });
  f.text(W / 2, 244, 'One cookies() call anywhere in the tree makes the whole route dynamic.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 268, 'force-static and force-dynamic override the inference.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 4 · Bundles ───────────────────────── */

const splitFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Code splitting. One monolithic bundle makes every page download all the code. Splitting by route gives each page only its own chunk plus a common chunk shared by every page, and a shared chunk for code used by only some pages. The browser downloads the common chunk once and caches it.');
  f.text(16, 24, 'one bundle', { size: 12, bold: true, mono: true });
  f.box(16, 34, 608, 36, { tone: 'fail', solid: true, label: 'app.js: home + shop + admin + chart lib + everything', size: 11.5 });
  f.text(16, 106, 'split', { size: 12, bold: true, mono: true });
  f.box(16, 116, 150, 40, { tone: 'pass', solid: true, label: 'common', size: 12, mono: true });
  f.box(176, 116, 100, 40, { tone: 'info', label: 'route:/home', size: 10.5, mono: true });
  f.box(286, 116, 100, 40, { tone: 'info', label: 'route:/shop', size: 10.5, mono: true });
  f.box(396, 116, 110, 40, { tone: 'info', label: 'route:/admin', size: 10.5, mono: true });
  f.box(516, 116, 108, 40, { tone: 'accent', label: 'shared:chart', size: 10.5, mono: true });
  f.text(W / 2, 198, '/home loads: common + route:/home. Nothing else.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 226, 'Code used by several pages goes in a shared chunk, cached once, never duplicated.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 254, 'Chunk file names carry a content hash so they can be cached forever.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const shakeFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Tree shaking. A library module exports three functions. The app imports and uses only one. The bundler follows what is used and drops the other two, unless the module is marked as having side effects, in which case all of it must stay because importing it runs code.');
  f.box(8, 22, 190, 120, { tone: 'muted' });
  f.text(103, 44, 'utils.js', { anchor: 'middle', size: 12.5, bold: true, mono: true });
  f.box(24, 56, 158, 24, { tone: 'pass', solid: true, label: 'formatDate (used)', size: 10.5, mono: true });
  f.box(24, 86, 158, 24, { tone: 'fail', label: 'parseCsv (unused)', size: 10.5, mono: true });
  f.box(24, 114, 158, 24, { tone: 'fail', label: 'debounce (unused)', size: 10.5, mono: true });
  f.path('M200 82 H236', { arrow: true, tone: 'muted', width: 1.8 });
  f.box(238, 52, 110, 60, { tone: 'accent', solid: true, label: 'bundler', size: 12 });
  f.path('M350 82 H386', { arrow: true, tone: 'muted', width: 1.8 });
  f.box(388, 56, 160, 52, { tone: 'pass', label: 'bundle: formatDate', size: 11, mono: true });
  f.text(W / 2, 178, 'Works on ES modules (import / export). CommonJS require() cannot be shaken reliably.', { anchor: 'middle', size: 12, bold: true });
  f.text(W / 2, 206, '"sideEffects": false in package.json tells the bundler unused imports are safe to drop.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 234, 'A barrel file (index.js re-exporting everything) can drag in the lot.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const lazyFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Lazy loading. Code that is not needed for the first view is loaded later: a route when it is visited, a heavy component when it scrolls into view or is first opened, and a library only when the user triggers the feature. Loading can start early, on hover or when the browser is idle, so the user rarely waits.');
  const rows: [string, string, Tone][] = [
    ['route', 'load when the page is visited', 'info'],
    ['component', 'load when opened or scrolled into view', 'accent'],
    ['library', 'load when the feature is used (import())', 'pass'],
  ];
  rows.forEach(([t, d, tone], i) => {
    const y = 18 + i * 52;
    f.box(8, y, 130, 42, { tone, solid: true, label: t, size: 12, mono: true });
    f.path(`M140 ${y + 21} H164`, { arrow: true, tone: 'muted', width: 1.6 });
    f.box(166, y, 466, 42, { tone: 'muted', label: d, size: 11.5 });
  });
  f.text(W / 2, 198, 'Prefetch on hover, on idle, or when a link enters the viewport: load before the click.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 226, 'A failed chunk load (a deploy replaced the file) needs a retry or a page reload.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 5 · Assets and the critical path ───────────────────────── */

const imagesFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Responsive images. A page offers the browser several widths of the same image. The browser multiplies the displayed CSS width by the device pixel ratio and picks the smallest candidate that is at least that wide. A 300 pixel wide slot on a normal screen picks the 320 pixel file, and on a 2x phone screen it needs 600 pixels so it picks the 640 pixel file.');
  const widths = [320, 640, 1280];
  widths.forEach((w, i) => {
    const bw = 60 + i * 50;
    f.box(8, 24 + i * 52, bw + 40, 42, { tone: i === 0 ? 'pass' : i === 1 ? 'accent' : 'muted', solid: i < 2, label: w + 'w', size: 12, mono: true });
  });
  f.box(250, 24, 380, 42, { tone: 'pass', label: '300 CSS px × 1x  = 300 → picks 320w', size: 11.5, mono: true });
  f.box(250, 76, 380, 42, { tone: 'accent', label: '300 CSS px × 2x  = 600 → picks 640w', size: 11.5, mono: true });
  f.box(250, 128, 380, 42, { tone: 'muted', label: '2000 CSS px × 1x = 2000 → picks 1280w (largest)', size: 10.5, mono: true });
  f.text(W / 2, 208, 'srcset lists the files; sizes tells the browser how wide the slot is BEFORE layout.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 234, 'Also set width and height (no layout shift), AVIF or WebP first, JPEG as the fallback.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 260, 'lazy-load below the fold; never lazy-load the LCP image.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const criticalPathFigure: FigureBuilder = () => {
  const f = new Fig(W, 290, 'A request waterfall. The HTML must arrive first. It references a stylesheet, which must download before the font it references is even discovered, which means text is delayed by a chain of three requests. A script discovered in the HTML starts another chain that ends with an API call. The longest chain is the critical path and sets how early the page can render. Preloading the font removes it from the chain.');
  const bar = (y: number, label: string, x: number, w: number, tone: Tone) => {
    f.text(8, y + 20, label, { size: 11, mono: true });
    f.box(x, y, w, 28, { tone, solid: true });
  };
  bar(16, 'html', 70, 80, 'info');
  bar(52, 'css', 150, 90, 'accent');
  bar(88, 'font', 240, 120, 'fail');
  bar(124, 'js', 150, 150, 'accent');
  bar(160, 'api', 300, 110, 'fail');
  f.text(W / 2, 222, 'Each bar can only start when what references it has arrived: that is the critical path.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 248, 'Shorten it: preload the font, inline critical CSS, defer the script, fetch early.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 274, 'Parallel requests are free; chains are expensive.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const hintsFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Resource hints. Preconnect opens the connection to a third party origin early, which saves the DNS lookup, TCP connection and TLS handshake. Preload fetches a critical resource the parser would discover late, such as a font or the largest image, at high priority. Prefetch fetches something the next page will need, at low priority, while the browser is idle.');
  const hints: [string, string, string, Tone][] = [
    ['preconnect', 'third-party origin', 'saves DNS + TCP + TLS', 'info'],
    ['preload', 'critical, found late', 'font, LCP image · high priority', 'accent'],
    ['prefetch', 'next page needs it', 'idle · low priority', 'pass'],
  ];
  hints.forEach(([name, when, what, tone], i) => {
    const y = 16 + i * 56;
    f.box(8, y, 150, 46, { tone, solid: true, label: name, size: 13, mono: true });
    f.box(166, y, 190, 46, { tone: 'muted', label: when, size: 11.5 });
    f.box(364, y, 264, 46, { tone: 'muted', label: what, size: 11.5 });
  });
  f.text(W / 2, 208, 'Hints are a budget, not a spray: too many preloads fight each other for bandwidth.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 234, 'A preloaded font needs crossorigin even on your own domain, or it is fetched twice.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 260, 'The LCP image gets fetchpriority="high"; never loading="lazy".', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

export const renderingFigures: Record<string, FigureBuilder> = {
  'rd-strategies': strategiesFigure,
  'rd-timeline': timelineFigure,
  'rd-isr': isrFigure,
  'rd-hydration': hydrationFigure,
  'rd-streaming': streamingFigure,
  'rd-rsc': rscFigure,
  'rd-approuter': appRouterFigure,
  'rd-caches': cacheLayersFigure,
  'rd-dynamic': dynamicFigure,
  'rd-split': splitFigure,
  'rd-shake': shakeFigure,
  'rd-lazy': lazyFigure,
  'rd-images': imagesFigure,
  'rd-critical': criticalPathFigure,
  'rd-hints': hintsFigure,
};
