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

/* ───────────────────────── 2 · Injection and trusting input ───────────────────────── */

const injectionFigure: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Injection and its cure. With string concatenation, the data the user typed becomes part of the query text, so the database cannot tell code from data. With a parameterized query, the query text with placeholders and the values travel separately, so the values can never be interpreted as code.');
  const col = (x: number, title: string, tone: Tone, code: string[], verdict: string) => {
    f.box(x, 16, 304, 200, { tone });
    f.text(x + 152, 42, title, { anchor: 'middle', size: 14, bold: true, tone });
    f.lines(x + 14, 72, code, { size: 11, mono: true, gap: 20 });
    f.text(x + 152, 200, verdict, { anchor: 'middle', size: 11.5, bold: true, tone });
  };
  col(12, 'string concatenation', 'fail', ['"… WHERE name = \'"', '  + input + "\'"', '', 'one channel:', 'code and data mixed'], 'input can rewrite the query');
  col(324, 'parameterized', 'pass', ['text:   "… WHERE name = $1"', 'values: [ input ]', '', 'two channels:', 'code | data'], 'input is only ever a value');
  f.text(W / 2, 248, 'Never build code by gluing strings. Hand the engine the data separately.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const traversalFigure: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Path traversal. A server serves files from a base folder. A request for a normal name resolves to a path inside the base. A request containing dot-dot segments climbs out of the base and reaches other files. The fix is to resolve the path first, then verify it is still inside the base, comparing whole path segments, not string prefixes.');
  f.box(16, 20, 330, 150, { tone: 'pass', dashed: true });
  f.text(181, 44, 'base: /var/www/uploads', { anchor: 'middle', size: 12.5, bold: true, tone: 'pass' });
  f.box(40, 62, 280, 30, { tone: 'pass', label: '/var/www/uploads/cat.png', mono: true, size: 11 });
  f.box(40, 106, 280, 30, { tone: 'muted', label: '/var/www/uploads/2024/a.txt', mono: true, size: 11 });
  f.box(384, 20, 240, 150, { tone: 'fail' });
  f.text(504, 44, 'outside the base', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  f.box(400, 62, 208, 30, { tone: 'fail', solid: true, label: '/etc/passwd', mono: true, size: 11 });
  f.box(400, 106, 208, 30, { tone: 'fail', dashed: true, label: '/var/www/uploads-old/x', mono: true, size: 10.5 });
  f.path('M322 77 H398', { arrow: true, tone: 'fail', width: 2 });
  f.text(360, 182, '../../.. climbs out', { anchor: 'middle', size: 10.5, mono: true, tone: 'fail' });
  f.text(W / 2, 198, 'resolve first, then check the result is inside the base, segment by segment', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 226, 'A string prefix check wrongly accepts /var/www/uploads-old.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const pollutionFigure: FigureBuilder = () => {
  const f = new Fig(W, 260, 'Prototype pollution. Every plain JavaScript object inherits from one shared Object.prototype. If a merge function copies a key named __proto__ from attacker-controlled JSON, it can add a property such as isAdmin to that shared prototype, and every object in the program suddenly appears to have it.');
  f.box(200, 16, 240, 60, { tone: 'fail', solid: true });
  f.text(320, 40, 'Object.prototype', { anchor: 'middle', size: 13, bold: true, mono: true });
  f.text(320, 62, 'isAdmin: true  (polluted)', { anchor: 'middle', size: 11.5, mono: true });
  ['user = {}', 'config = {}', 'session = {}'].forEach((n, i) => {
    const x = 40 + i * 200;
    f.box(x, 130, 160, 44, { tone: 'muted', label: n, mono: true, size: 11.5 });
    f.path(`M${x + 80} 128 L320 78`, { arrow: true, tone: 'fail', width: 1.6, dashed: true });
    f.text(x + 80, 192, 'user.isAdmin → true', { anchor: 'middle', size: 10.5, mono: true, tone: 'fail' });
  });
  f.text(W / 2, 226, 'Skip the keys __proto__, constructor and prototype when merging untrusted data.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 250, 'Or merge into objects with no prototype.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

/* ───────────────────────── 3 · Passwords, sessions and tokens ───────────────────────── */

const passwordStorage: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Storing and checking a password. At sign-up, combine the password with a random salt unique to that user, run a deliberately slow password hash, and store the salt and the hash, never the password. At login, repeat the same steps with the typed password and compare the result with the stored hash in constant time.');
  f.text(16, 18, 'sign up', { size: 12.5, bold: true, tone: 'info' });
  const up: [string, Tone][] = [['password', 'info'], ['+ random salt', 'accent'], ['slow hash', 'accent'], ['store salt + hash', 'pass']];
  up.forEach(([t, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 28, 146, 44, { tone, solid: i === 3, label: t, size: 12 });
    if (i < 3) f.path(`M${x + 148} 50 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(16, 108, 'log in', { size: 12.5, bold: true, tone: 'info' });
  const inn: [string, Tone][] = [['typed password', 'info'], ['+ stored salt', 'accent'], ['same slow hash', 'accent'], ['constant-time compare', 'pass']];
  inn.forEach(([t, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 118, 146, 44, { tone, solid: i === 3, label: t, size: 11.5 });
    if (i < 3) f.path(`M${x + 148} 140 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(W / 2, 200, 'Salt: identical passwords get different hashes. Slow hash: guessing is expensive.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 226, 'Use bcrypt, scrypt, Argon2 or PBKDF2 from a vetted library, not SHA-256 and not your own.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 252, 'Never store, log or email a password. Never send a "forgot password" that reveals it.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const jwtAnatomy: FigureBuilder = () => {
  const f = new Fig(W, 270, 'The anatomy of a signed token. Three base64url parts separated by dots: a header naming the algorithm, a payload of claims such as subject, expiry, issuer and audience, and a signature computed over the first two parts with a secret. The payload is readable by anyone, only tamper-proof because of the signature. The server must check the algorithm, the signature and the claims.');
  const parts: [string, string, Tone][] = [['header', '{ "alg": "HS256" }', 'info'], ['payload', '{ "sub": "7", "exp": 2000, "iss": …, "aud": … }', 'accent'], ['signature', 'HMAC(secret, header.payload)', 'pass']];
  const xs = [12, 170, 440];
  const ws = [150, 262, 188];
  parts.forEach(([t, sub, tone], i) => {
    f.box(xs[i], 28, ws[i], 76, { tone, solid: i === 2 });
    f.text(xs[i] + ws[i] / 2, 54, t, { anchor: 'middle', size: 13, bold: true });
    f.text(xs[i] + ws[i] / 2, 82, sub.length > 28 ? sub.slice(0, 28) + '…' : sub, { anchor: 'middle', size: 10.5, mono: true });
  });
  f.text(164, 70, '.', { anchor: 'middle', size: 22, bold: true });
  f.text(436, 70, '.', { anchor: 'middle', size: 22, bold: true });
  f.text(W / 2, 134, 'verify in this order', { anchor: 'middle', size: 12.5, bold: true });
  ['1 · alg is exactly what you expect', '2 · signature matches (constant time)', '3 · exp, nbf, iss, aud are right'].forEach((t, i) => f.box(16 + i * 208, 150, 200, 40, { tone: 'pass', label: t, size: 11 }));
  f.text(W / 2, 222, 'Never trust the header to choose the algorithm: "none" means "no signature".', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  f.text(W / 2, 248, 'The payload is encoded, not encrypted: do not put secrets in it.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

const sessionLifecycle: FigureBuilder = () => {
  const f = new Fig(W, 260, 'The life of a session. Logging in creates a server-side session with a random identifier and rotates any earlier identifier to prevent fixation. Each use refreshes the idle timer, but the absolute lifetime keeps counting. The session ends at logout, at idle timeout, at the absolute timeout, or when the user changes their password and all sessions are destroyed.');
  const nodes: [string, string, Tone][] = [['login', 'new random id', 'info'], ['active', 'idle timer resets', 'pass'], ['idle too long', 'expires', 'fail'], ['logout / password change', 'destroyed on server', 'fail']];
  nodes.forEach(([t, sub, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 30, 146, 70, { tone, solid: i === 1 });
    f.text(x + 73, 58, t, { anchor: 'middle', size: 11.5, bold: true });
    f.text(x + 73, 82, sub, { anchor: 'middle', size: 11 });
    if (i < 3) f.path(`M${x + 148} 65 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(W / 2, 140, 'Rotate the id at login and on privilege change (stops session fixation).', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 168, 'Two clocks: an idle timeout (slides) and an absolute lifetime (never extended).', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 196, 'The cookie holds only the random id; the data lives on the server.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 236, 'Destroying the server-side session is the only real logout.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

/* ───────────────────────── 4 · Cookies, CORS and CSRF ───────────────────────── */

const sameOrigin: FigureBuilder = () => {
  const f = new Fig(W, 280, 'The same-origin policy. An origin is the scheme, host and port together. Compared with https://app.example.com, the page https://app.example.com/other is the same origin, while http://app.example.com differs in scheme, https://api.example.com differs in host, https://app.example.com:8443 differs in port, and https://example.com differs in host.');
  f.text(16, 20, 'page origin:', { size: 12.5, bold: true });
  f.text(120, 20, 'https://app.example.com', { size: 12.5, mono: true, bold: true, tone: 'info' });
  const rows: [string, string, boolean][] = [
    ['https://app.example.com/other', 'same origin', true],
    ['http://app.example.com', 'different scheme', false],
    ['https://api.example.com', 'different host', false],
    ['https://app.example.com:8443', 'different port', false],
    ['https://example.com', 'different host', false],
  ];
  rows.forEach(([u, why, same], i) => {
    const y = 38 + i * 40;
    f.box(16, y, 360, 32, { tone: 'muted', label: u, mono: true, size: 11.5 });
    f.box(388, y, 236, 32, { tone: same ? 'pass' : 'fail', solid: true, label: (same ? '✓ ' : '✗ ') + why, size: 12 });
  });
  f.text(W / 2, 256, 'Scripts can freely read responses only from their own origin.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 276, 'Sites (eTLD+1) are coarser than origins: SameSite cookies use sites.', { anchor: 'middle', size: 11.5, tone: 'muted' });
  return f;
};

const corsFlow: FigureBuilder = () => {
  const f = new Fig(W, 270, 'How CORS works. A page on one origin wants to read a response from another origin. For non-simple requests the browser first sends a preflight OPTIONS request asking permission. The server answers with Access-Control headers. The browser, not the server, then decides whether the page may read the response. CORS relaxes the same-origin policy in the browser, it does not authenticate anyone, and the server still receives the requests.');
  const steps: [string, string, Tone][] = [
    ['page', 'fetch(api, { credentials })', 'info'],
    ['preflight', 'OPTIONS + Origin', 'accent'],
    ['server', 'Access-Control-* headers', 'accent'],
    ['browser', 'allows or blocks the page', 'pass'],
  ];
  steps.forEach(([t, sub, tone], i) => {
    const x = 12 + i * 158;
    f.box(x, 28, 146, 84, { tone, solid: i === 3 });
    f.text(x + 73, 58, t, { anchor: 'middle', size: 13, bold: true });
    f.text(x + 73, 84, sub.length > 22 ? sub.slice(0, 22) : sub, { anchor: 'middle', size: 10.5 });
    if (sub.length > 22) f.text(x + 73, 98, sub.slice(22), { anchor: 'middle', size: 10.5 });
    if (i < 3) f.path(`M${x + 148} 70 H${x + 156}`, { arrow: true, tone: 'muted', width: 1.8 });
  });
  f.text(W / 2, 148, 'CORS is a browser rule that protects users, not a lock on your server.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 176, 'curl, scripts and attackers ignore it: still authenticate and authorise every request.', { anchor: 'middle', size: 12, tone: 'muted' });
  f.text(W / 2, 214, 'Echo only allowlisted origins. Never reflect any Origin. Never "*" with credentials.', { anchor: 'middle', size: 12.5, bold: true, tone: 'fail' });
  f.text(W / 2, 244, 'Send Vary: Origin so caches do not serve one origin the answer for another.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const csrfFigure: FigureBuilder = () => {
  const f = new Fig(W, 280, 'Cross-site request forgery. A victim is logged in to a bank site. They visit an evil page that makes their browser send a request to the bank. The browser automatically attaches the bank session cookie, so the bank sees a legitimate looking request. Defences: SameSite cookies, a secret CSRF token that the evil page cannot read, and checking the Origin header.');
  f.box(16, 30, 150, 70, { tone: 'fail' });
  f.text(91, 58, 'evil.example', { anchor: 'middle', size: 13, bold: true, tone: 'fail' });
  f.text(91, 80, 'hidden form / request', { anchor: 'middle', size: 11 });
  f.box(246, 30, 150, 70, { tone: 'info' });
  f.text(321, 58, "victim's browser", { anchor: 'middle', size: 13, bold: true, tone: 'info' });
  f.text(321, 80, 'adds the bank cookie!', { anchor: 'middle', size: 11, bold: true });
  f.box(474, 30, 150, 70, { tone: 'pass' });
  f.text(549, 58, 'bank.example', { anchor: 'middle', size: 13, bold: true, tone: 'pass' });
  f.text(549, 80, 'sees a valid session', { anchor: 'middle', size: 11 });
  f.path('M168 65 H242', { arrow: true, tone: 'fail', width: 2 });
  f.path('M398 65 H470', { arrow: true, tone: 'fail', width: 2 });
  f.text(W / 2, 134, 'Defences (use several):', { anchor: 'middle', size: 12.5, bold: true });
  ['SameSite=Lax / Strict cookies', 'secret CSRF token in the request', 'check Origin / Referer'].forEach((t, i) => f.box(16 + i * 208, 148, 200, 44, { tone: 'pass', solid: true, label: t, size: 11 }));
  f.text(W / 2, 222, 'A token works because evil.example cannot READ your pages to copy it.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 250, 'Only state-changing requests need it; GET must never change anything.', { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

/* ───────────────────────── 5 · Headers, CSP and integrity ───────────────────────── */

const headersFigure: FigureBuilder = () => {
  const f = new Fig(W, 320, 'The security headers every site should consider. Strict-Transport-Security forces HTTPS. Content-Security-Policy limits what the page may load and run. X-Content-Type-Options nosniff stops the browser guessing file types. frame-ancestors or X-Frame-Options controls who may embed the page. Referrer-Policy limits what is leaked in the Referer header. Permissions-Policy turns off powerful browser features the page does not use.');
  const rows: [string, string, Tone][] = [
    ['Strict-Transport-Security', 'always use HTTPS for this site', 'pass'],
    ['Content-Security-Policy', 'what the page may load and run', 'pass'],
    ['X-Content-Type-Options: nosniff', 'do not guess the content type', 'accent'],
    ['frame-ancestors / X-Frame-Options', 'who may embed this page (clickjacking)', 'accent'],
    ['Referrer-Policy', 'how much URL to reveal when linking out', 'info'],
    ['Permissions-Policy', 'switch off camera, mic, geolocation…', 'info'],
  ];
  rows.forEach(([name, why, tone], i) => {
    const y = 14 + i * 48;
    f.box(16, y, 300, 38, { tone, solid: true, label: name, mono: true, size: 11 });
    f.text(332, y + 24, why, { size: 12 });
  });
  f.text(W / 2, 312, 'Headers are cheap, global, and enforced by the browser: set them once for every response.', { anchor: 'middle', size: 12, tone: 'muted', italic: true });
  return f;
};

const cspSources: FigureBuilder = () => {
  const f = new Fig(W, 312, 'How a Content Security Policy source list is matched. The policy script-src self plus https cdn.example.com lets scripts load from the page origin and from that one CDN host. A script from evil.example does not match any source, so the browser refuses to load it. Keywords like none allow nothing, and wildcard hosts such as star dot example dot com match subdomains but not the bare domain.');
  f.box(16, 14, 608, 44, { tone: 'accent', solid: true, label: "script-src 'self' https://cdn.example.com *.trusted.example", mono: true, size: 12 });
  const rows: [string, string, boolean][] = [
    ['https://app.example/app.js', "matches 'self' (same origin)", true],
    ['https://cdn.example.com/lib.js', 'matches the CDN host source', true],
    ['https://img.trusted.example/x.js', 'matches the *.trusted.example wildcard', true],
    ['https://trusted.example/x.js', 'bare domain: the wildcard does NOT match it', false],
    ['https://evil.example/x.js', 'matches no source: blocked', false],
  ];
  rows.forEach(([u, why, ok], i) => {
    const y = 72 + i * 42;
    f.box(16, y, 270, 34, { tone: 'muted', label: u, mono: true, size: 10.5 });
    f.box(296, y, 328, 34, { tone: ok ? 'pass' : 'fail', solid: true, label: (ok ? '✓ ' : '✗ ') + why, size: 11 });
  });
  f.text(W / 2, 304, "'self' = same scheme, host and port. A source with no port means the default port.", { anchor: 'middle', size: 11.5, tone: 'muted', italic: true });
  return f;
};

const cspNonce: FigureBuilder = () => {
  const f = new Fig(W, 270, 'Nonce based CSP. For every response the server creates a fresh random nonce, puts it in the CSP header as nonce-abc and on its own script tags as a nonce attribute. The browser runs only scripts whose nonce matches. A script injected by an attacker does not know the nonce, so it is blocked. Nonces must be unguessable and different on every response.');
  f.box(16, 20, 290, 100, { tone: 'info' });
  f.text(161, 44, 'server response', { anchor: 'middle', size: 13, bold: true, tone: 'info' });
  f.lines(30, 70, ["Content-Security-Policy:", "  script-src 'nonce-R4nd0m'", '<script nonce="R4nd0m">…</script>'], { size: 10.5, mono: true, gap: 16 });
  f.box(334, 20, 290, 100, { tone: 'fail' });
  f.text(479, 44, 'attacker injects', { anchor: 'middle', size: 13, bold: true, tone: 'fail' });
  f.lines(348, 70, ['<script>steal()</script>', '', 'no nonce, or a wrong guess'], { size: 11, mono: true, gap: 16 });
  f.box(16, 146, 290, 44, { tone: 'pass', solid: true, label: '✓ runs: nonce matches', size: 12 });
  f.box(334, 146, 290, 44, { tone: 'fail', solid: true, label: '✗ blocked by the browser', size: 12 });
  f.text(W / 2, 224, 'A new random nonce per response, never reused, never predictable.', { anchor: 'middle', size: 12.5, bold: true });
  f.text(W / 2, 250, "'unsafe-inline' is ignored when a nonce or hash is present.", { anchor: 'middle', size: 12, tone: 'muted' });
  return f;
};

export const securityFigures: Record<string, FigureBuilder> = {
  'sec-xss-flow': xssFlow,
  'sec-contexts': outputContexts,
  'sec-trust-boundary': trustBoundary,
  'sec-injection': injectionFigure,
  'sec-traversal': traversalFigure,
  'sec-pollution': pollutionFigure,
  'sec-password-storage': passwordStorage,
  'sec-jwt': jwtAnatomy,
  'sec-session': sessionLifecycle,
  'sec-same-origin': sameOrigin,
  'sec-cors': corsFlow,
  'sec-csrf': csrfFigure,
  'sec-headers': headersFigure,
  'sec-csp-sources': cspSources,
  'sec-csp-nonce': cspNonce,
};
