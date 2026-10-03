import { Fig, type FigureBuilder, type Tone } from './kit';

const W = 640;

/* ───────────────────────── 1 · Cross-site scripting ───────────────────────── */

const xssFlow: FigureBuilder = () => {
  const f = new Fig(W, 270, 'How stored cross-site scripting works. An attacker submits text containing a script tag as a comment. Your server stores it, a page template later inserts it into the page without escaping, and the victim browser runs it as if it came from your site, with access to the victim session. Escaping on output turns the text into harmless characters.');
  const steps: [string, string, Tone][] = [
    ['attacker', 'posts a comment with <script>…</script>', 'fail'],
    ['your database', 'stores it as plain text', 'muted'],
    ['page template', 'inserts it into the HTML', 'accent'],
    ['victim browser', 'runs it as YOUR code', 'fail'],
  ];
  steps.forEach(([title, sub, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 30, 146, 96, { tone, solid: i === 3 });
    f.text(x + 73, 58, title, { anchor: 'middle', size: 13, bold: true });
    f.text(x + 73, 82, sub.slice(0, 22), { anchor: 'middle', size: 10.5 });
    f.text(x + 73, 98, sub.slice(22), { anchor: 'middle', size: 10.5 });
    if (i < 3) f.path(`M${x + 148} 78 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.box(328, 150, 296, 44, { tone: 'pass', solid: true, label: 'escape on output: &lt;script&gt; is just text', size: 11.5 });
  f.path('M401 128 V148', { arrow: true, tone: 'pass', width: 2 });
  f.text(W / 2, 226, 'The browser cannot tell your markup from the attacker\'s: you must.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 252, 'Stolen sessions, forged actions, defaced pages: all run with the victim\'s rights.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const outputContexts: FigureBuilder = () => {
  const f = new Fig(W, 290, 'Output contexts need different treatment. Inside HTML text, escape the angle brackets and ampersand. Inside a quoted attribute, also escape the quotes. In a URL attribute, allow only safe schemes. Inside script, do not build code from data at all, pass data as JSON or data attributes. In CSS avoid user data or allowlist exact values.');
  const rows: [string, string, string, Tone][] = [
    ['HTML text', '<p>HERE</p>', 'escape & < >', 'pass'],
    ['attribute', '<a title="HERE">', 'escape + quotes', 'pass'],
    ['URL', '<a href="HERE">', 'allowlist the scheme', 'accent'],
    ['JavaScript', '<script>HERE</script>', 'never build code from data', 'fail'],
    ['CSS', 'style="HERE"', 'avoid, or exact allowlist', 'accent'],
  ];
  f.text(70, 18, 'context', { anchor: 'middle', size: 11.5, bold: true, tone: 'muted' });
  f.text(255, 18, 'where the data lands', { anchor: 'middle', size: 11.5, bold: true, tone: 'muted' });
  f.text(500, 18, 'what it needs', { anchor: 'middle', size: 11.5, bold: true, tone: 'muted' });
  rows.forEach(([ctx, ex, need, tone], i) => {
    const y = 28 + i * 50;
    f.box(16, y, 108, 40, { tone: 'info', label: ctx, size: 12 });
    f.box(132, y, 244, 40, { tone: 'muted', label: ex, mono: true, size: 11.5 });
    f.box(384, y, 240, 40, { tone, solid: true, label: need, size: 12 });
  });
  f.text(W / 2, 282, 'One escape function is not enough: the destination decides the rule.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const trustBoundary: FigureBuilder = () => {
  const f = new Fig(W, 250, 'The trust boundary. Untrusted data from forms, query strings, headers, files and third-party APIs enters at the left. Validate its shape early, use it in your logic, and encode it for the specific destination at the moment it leaves your code: HTML, SQL, shell or URL.');
  f.box(12, 60, 130, 110, { tone: 'fail', dashed: true });
  f.text(77, 84, 'untrusted', { anchor: 'middle', size: 13, bold: true, tone: 'fail' });
  f.lines(24, 108, ['forms · query', 'headers · cookies', 'files · APIs'], { size: 11, gap: 18 });
  f.box(164, 80, 100, 70, { tone: 'accent', solid: true, label: 'validate shape', size: 11.5 });
  f.box(284, 80, 100, 70, { tone: 'info', label: 'your logic', size: 12 });
  f.box(404, 80, 100, 70, { tone: 'accent', solid: true, label: 'encode for the sink', size: 11.5 });
  f.box(524, 60, 104, 110, { tone: 'pass' });
  f.text(576, 84, 'sinks', { anchor: 'middle', size: 13, bold: true, tone: 'pass' });
  f.lines(536, 108, ['HTML', 'SQL', 'shell · URL'], { size: 11, gap: 18 });
  [[144, 162], [266, 282], [386, 402], [506, 522]].forEach(([a, b]) => f.path(`M${a} 115 H${b}`, { arrow: true, tone: 'muted', width: 1.8 }));
  f.text(W / 2, 206, 'Validate when data comes in. Encode when data goes out.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 232, 'Both, because each stops a different kind of mistake.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

export const securityFigures: Record<string, FigureBuilder> = {
  'sec-xss-flow': xssFlow,
  'sec-contexts': outputContexts,
  'sec-trust-boundary': trustBoundary,
};
