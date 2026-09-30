/* Type-challenge checker. Shared by the browser worker and scripts/verify.ts.
 * globalThis.__wsTypecheck.check(ts, readLib, userCode, testCode) → { diagnostics, cases } */
(function (g) {
  'use strict';

  var PRELUDE = [
    'type Expect<T extends true> = T;',
    'type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;',
    'type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;',
    'type Extends<A, B> = [A] extends [B] ? true : false;',
    'export {};',
  ].join('\n');
  var PRELUDE_LINES = PRELUDE.split('\n').length;

  function parseCases(testCode) {
    var cases = [], cur = null, preamble = [];
    testCode.split('\n').forEach(function (line) {
      var m = /^\/\/!\s*(.+)$/.exec(line);
      if (m) { cur = { name: m[1].trim(), lines: [] }; cases.push(cur); }
      else if (cur) cur.lines.push(line);
      else preamble.push(line);
    });
    return { cases: cases, preamble: preamble };
  }

  function flat(ts, d) { return ts.flattenDiagnosticMessageText(d.messageText, '\n'); }

  function check(ts, readLib, userCode, testCode) {
    var parsed = parseCases(testCode);
    var cases = parsed.cases;
    var userLines = userCode.split('\n').length;
    var out = [PRELUDE, userCode];
    var ranges = [];
    var line = PRELUDE_LINES + userLines; // number of lines emitted so far
    var preStart = line + 1;
    if (parsed.preamble.length) { out.push(parsed.preamble.join('\n')); line += parsed.preamble.length; }
    var preEnd = line;
    cases.forEach(function (c) {
      var start = line + 1;
      var body = c.lines.join('\n');
      out.push(body);
      line += c.lines.length;
      ranges.push([start, line]);
    });
    var source = out.join('\n');

    var libCache = check.libCache || (check.libCache = {});
    function base(f) { return f.replace(/^.*\//, ''); }
    function lib(f) {
      var name = base(f);
      if (!(name in libCache)) { var text = readLib(name); libCache[name] = text === undefined ? undefined : ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, false); }
      return libCache[name];
    }
    var options = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts'], types: [], skipLibCheck: true, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
    var main = ts.createSourceFile('main.ts', source, ts.ScriptTarget.ES2022, true);
    var host = {
      getSourceFile: function (f) { return f === 'main.ts' ? main : lib(f); },
      getDefaultLibFileName: function () { return '/lib/lib.es2022.d.ts'; },
      getDefaultLibLocation: function () { return '/lib'; },
      writeFile: function () {},
      getCurrentDirectory: function () { return '/'; },
      getDirectories: function () { return []; },
      fileExists: function (f) { return f === 'main.ts' || readLib(base(f)) !== undefined; },
      readFile: function (f) { return f === 'main.ts' ? source : readLib(base(f)); },
      getCanonicalFileName: function (f) { return f; },
      useCaseSensitiveFileNames: function () { return true; },
      getNewLine: function () { return '\n'; },
      directoryExists: function () { return true; },
    };
    var program = ts.createProgram(['main.ts'], options, host);
    var all = program.getSyntacticDiagnostics(main).concat(program.getSemanticDiagnostics(main));

    var diagnostics = [];
    var caseErrors = cases.map(function () { return []; });
    all.forEach(function (d) {
      if (d.start === undefined) return;
      var l = main.getLineAndCharacterOfPosition(d.start).line + 1;
      var msg = flat(ts, d);
      var srcLines = source.split('\n');
      var lineText = (srcLines[l - 1] || '').trim();
      // an unused @ts-expect-error is reported on the comment; the interesting code is the next line
      if (/^\/\/\s*@ts-expect-error/.test(lineText) && srcLines[l]) lineText = srcLines[l].trim();
      if (l <= PRELUDE_LINES) return;
      if (l <= PRELUDE_LINES + userLines) { diagnostics.push({ line: l - PRELUDE_LINES, message: msg }); return; }
      if (l >= preStart && l <= preEnd) { diagnostics.push({ line: 0, message: 'Exercise setup error (or your types do not fit the setup): ' + msg }); return; }
      for (var i = 0; i < ranges.length; i++) {
        if (l >= ranges[i][0] && l <= ranges[i][1]) { caseErrors[i].push(msg + (lineText ? '\n\n› ' + lineText : '')); break; }
      }
    });

    return {
      diagnostics: diagnostics,
      cases: cases.map(function (c, i) {
        return { name: c.name, pass: caseErrors[i].length === 0, error: caseErrors[i][0] };
      }),
    };
  }

  g.__wsTypecheck = { check: check };
})(globalThis);
