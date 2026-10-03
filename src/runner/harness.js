/* Whetstone test harness.
 * Plain JS on purpose: it is inlined as text into a Web Worker, a sandboxed iframe, and a Node vm/jsdom context
 * (scripts/verify.ts), so it must not depend on any module system.
 * Entry point: globalThis.__whetstone.run({ userCode, testCode, exports, mode, ... })
 */
(function (g) {
  'use strict';

  var toStr = Object.prototype.toString;
  var realSetTimeout = g.setTimeout.bind(g);
  var realClearTimeout = g.clearTimeout.bind(g);
  var realSetInterval = g.setInterval.bind(g);
  var realClearInterval = g.clearInterval.bind(g);
  var RealDate = g.Date;
  var realDateNow = RealDate.now.bind(RealDate);
  var realPerfNow = g.performance && g.performance.now ? g.performance.now.bind(g.performance) : null;
  var sleep = function (ms) { return new Promise(function (r) { realSetTimeout(r, ms); }); };

  /* ───────────── formatting ───────────── */

  function fmt(v, depth, seen) {
    depth = depth === undefined ? 0 : depth;
    seen = seen || [];
    var t = typeof v;
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (t === 'string') return depth === 0 ? JSON.stringify(v) : JSON.stringify(v);
    if (t === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (t === 'bigint') return v + 'n';
    if (t === 'boolean') return String(v);
    if (t === 'symbol') return v.toString();
    if (t === 'function') {
      if (v.__isMock) return '[MockFunction' + (v.getMockName ? '' : '') + ']';
      return '[Function' + (v.name ? ' ' + v.name : ' (anonymous)') + ']';
    }
    if (seen.indexOf(v) !== -1) return '[Circular]';
    if (v instanceof Asym) return v.label;
    if (typeof v.nodeType === 'number' && v.nodeName) {
      if (v.nodeType === 1) {
        var attrs = '';
        for (var i = 0; i < v.attributes.length && i < 4; i++) attrs += ' ' + v.attributes[i].name + '="' + v.attributes[i].value + '"';
        return '<' + v.nodeName.toLowerCase() + attrs + '>';
      }
      return '[' + v.nodeName + ']';
    }
    var tag = toStr.call(v);
    if (tag === '[object Date]') return isNaN(v) ? 'Invalid Date' : v.toISOString();
    if (tag === '[object RegExp]') return String(v);
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (tag === '[object Promise]') return 'Promise {…}';
    if (depth >= 4) return Array.isArray(v) ? '[Array]' : '[Object]';
    seen = seen.concat([v]);
    var out;
    if (Array.isArray(v)) {
      if (!v.length) return '[]';
      var items = v.slice(0, 12).map(function (x) { return fmt(x, depth + 1, seen); });
      if (v.length > 12) items.push('… ' + (v.length - 12) + ' more');
      out = '[' + items.join(', ') + ']';
    } else if (v instanceof Map) {
      var m = [];
      v.forEach(function (val, key) { m.push(fmt(key, depth + 1, seen) + ' => ' + fmt(val, depth + 1, seen)); });
      out = 'Map(' + v.size + ') {' + m.slice(0, 10).join(', ') + '}';
    } else if (v instanceof Set) {
      var s = [];
      v.forEach(function (val) { s.push(fmt(val, depth + 1, seen)); });
      out = 'Set(' + v.size + ') {' + s.slice(0, 10).join(', ') + '}';
    } else {
      var keys = Object.keys(v).concat(Object.getOwnPropertySymbols(v));
      var ctor = Object.getPrototypeOf(v);
      var name = ctor && ctor.constructor && ctor.constructor.name && ctor.constructor.name !== 'Object' ? ctor.constructor.name + ' ' : '';
      if (!ctor) name = '[Object: null prototype] ';
      var body = keys.slice(0, 12).map(function (k) {
        var label = typeof k === 'symbol' ? '[' + k.toString() + ']' : /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k);
        return label + ': ' + fmt(v[k], depth + 1, seen);
      });
      if (keys.length > 12) body.push('… ' + (keys.length - 12) + ' more');
      out = name + '{' + (body.length ? ' ' + body.join(', ') + ' ' : '') + '}';
    }
    return out.length > 400 ? out.slice(0, 400) + '…' : out;
  }

  function logFmt(args) {
    return args.map(function (a) { return typeof a === 'string' ? a : fmt(a, 0); }).join(' ');
  }

  /* ───────────── equality ───────────── */

  function Asym(label, test) { this.label = label; this.asymmetricMatch = test; }

  function isObj(v) { return v !== null && typeof v === 'object'; }

  function equals(a, b, strict, seen) {
    if (a instanceof Asym) return a.asymmetricMatch(b);
    if (b instanceof Asym) return b.asymmetricMatch(a);
    if (Object.is(a, b)) return true;
    if (!isObj(a) || !isObj(b)) return false;
    var ta = toStr.call(a);
    if (ta !== toStr.call(b)) return false;
    if (typeof a.nodeType === 'number' && a.isEqualNode) return a.isEqualNode(b);
    if (ta === '[object Date]') return a.getTime() === b.getTime();
    if (ta === '[object RegExp]') return String(a) === String(b);
    if (a instanceof Error) return a.message === b.message && a.name === b.name;
    seen = seen || [];
    for (var i = 0; i < seen.length; i++) if (seen[i][0] === a && seen[i][1] === b) return true;
    seen.push([a, b]);
    var ok = true;
    if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) ok = false;
    else if (Array.isArray(a)) {
      ok = a.length === b.length;
      for (var j = 0; ok && j < a.length; j++) ok = equals(a[j], b[j], strict, seen);
    } else if (a instanceof Map) {
      ok = a.size === b.size;
      if (ok) a.forEach(function (v, k) {
        if (!ok) return;
        if (b.has(k)) { ok = equals(v, b.get(k), strict, seen); return; }
        var found = false;
        b.forEach(function (v2, k2) { if (!found && equals(k, k2, strict, seen) && equals(v, v2, strict, seen)) found = true; });
        ok = found;
      });
    } else if (a instanceof Set) {
      ok = a.size === b.size;
      if (ok) a.forEach(function (v) {
        if (!ok || b.has(v)) return;
        var found = false;
        b.forEach(function (v2) { if (!found && equals(v, v2, strict, seen)) found = true; });
        ok = found;
      });
    } else {
      var ka = ownKeys(a, strict), kb = ownKeys(b, strict);
      ok = ka.length === kb.length;
      for (var k = 0; ok && k < ka.length; k++) {
        var key = ka[k];
        ok = Object.prototype.hasOwnProperty.call(b, key) && equals(a[key], b[key], strict, seen);
      }
    }
    seen.pop();
    return ok;
  }

  function ownKeys(o, strict) {
    return Object.keys(o).concat(Object.getOwnPropertySymbols(o)).filter(function (k) { return strict || o[k] !== undefined; });
  }

  function subsetMatch(actual, expected) {
    if (expected instanceof Asym) return expected.asymmetricMatch(actual);
    if (Array.isArray(expected)) {
      return Array.isArray(actual) && actual.length === expected.length && expected.every(function (e, i) { return subsetMatch(actual[i], e); });
    }
    if (isObj(expected) && isObj(actual) && !(expected instanceof Date) && !(expected instanceof RegExp)) {
      return Object.keys(expected).every(function (k) { return k in actual && subsetMatch(actual[k], expected[k]); });
    }
    return equals(actual, expected);
  }

  /* ───────────── mocks ───────────── */

  var activeSpies = [];

  function makeMock(impl) {
    var onceQueue = [];
    var defaultImpl = impl;
    var mock = function () {
      var args = Array.prototype.slice.call(arguments);
      mock.mock.calls.push(args);
      mock.mock.instances.push(this);
      var fn = onceQueue.length ? onceQueue.shift() : defaultImpl;
      var res;
      try {
        var value = fn ? fn.apply(this, args) : undefined;
        res = { type: 'return', value: value };
        mock.mock.results.push(res);
        return value;
      } catch (e) {
        mock.mock.results.push({ type: 'throw', value: e });
        throw e;
      }
    };
    Object.defineProperty(mock, 'name', { value: 'mockConstructor', configurable: true });
    mock.__isMock = true;
    mock.mock = { calls: [], results: [], instances: [] };
    Object.defineProperty(mock.mock, 'lastCall', { get: function () { return mock.mock.calls[mock.mock.calls.length - 1]; } });
    mock.mockImplementation = function (f) { defaultImpl = f; return mock; };
    mock.mockImplementationOnce = function (f) { onceQueue.push(f); return mock; };
    mock.mockReturnValue = function (v) { defaultImpl = function () { return v; }; return mock; };
    mock.mockReturnValueOnce = function (v) { onceQueue.push(function () { return v; }); return mock; };
    mock.mockResolvedValue = function (v) { defaultImpl = function () { return Promise.resolve(v); }; return mock; };
    mock.mockResolvedValueOnce = function (v) { onceQueue.push(function () { return Promise.resolve(v); }); return mock; };
    mock.mockRejectedValue = function (v) { defaultImpl = function () { return Promise.reject(v); }; return mock; };
    mock.mockRejectedValueOnce = function (v) { onceQueue.push(function () { return Promise.reject(v); }); return mock; };
    mock.mockClear = function () { mock.mock.calls.length = 0; mock.mock.results.length = 0; mock.mock.instances.length = 0; return mock; };
    mock.mockReset = function () { mock.mockClear(); defaultImpl = undefined; onceQueue.length = 0; return mock; };
    return mock;
  }

  function spyOn(obj, method) {
    var original = obj[method];
    if (typeof original !== 'function') throw new Error('jest.spyOn: ' + String(method) + ' is not a function');
    var spy = makeMock(function () { return original.apply(this, arguments); });
    spy.mockRestore = function () { obj[method] = original; };
    obj[method] = spy;
    activeSpies.push(spy);
    return spy;
  }

  /* ───────────── fake timers ───────────── */

  var fake = { active: false, now: 0, perf: 0, seq: 1, timers: [] };
  var FakeDate;

  function schedule(fn, ms, args, repeat) {
    ms = Math.max(Number(ms) || 0, 0);
    var id = fake.seq++;
    fake.timers.push({ id: id, time: fake.now + ms, fn: fn, args: args, repeat: repeat ? Math.max(ms, 1) : 0 });
    return id;
  }
  function unschedule(id) {
    fake.timers = fake.timers.filter(function (t) { return t.id !== id; });
  }
  function nextTimer() {
    var best = null;
    fake.timers.forEach(function (t) { if (!best || t.time < best.time || (t.time === best.time && t.id < best.id)) best = t; });
    return best;
  }
  function fireTimer(t) {
    if (t.repeat) t.time += t.repeat; else unschedule(t.id);
    t.fn.apply(g, t.args);
  }
  function advanceSync(ms) {
    var target = fake.now + ms, guard = 0;
    for (;;) {
      var t = nextTimer();
      if (!t || t.time > target) break;
      if (++guard > 100000) throw new Error('Fake timers: too many timers fired (infinite setInterval?)');
      fake.perf += t.time - fake.now;
      fake.now = t.time;
      fireTimer(t);
    }
    fake.perf += target - fake.now;
    fake.now = target;
  }
  async function flushMicrotasks() { for (var i = 0; i < 12; i++) await Promise.resolve(); }
  async function advanceAsync(ms) {
    var target = fake.now + ms, guard = 0;
    await flushMicrotasks();
    for (;;) {
      var t = nextTimer();
      if (!t || t.time > target) break;
      if (++guard > 100000) throw new Error('Fake timers: too many timers fired (infinite setInterval?)');
      fake.perf += t.time - fake.now;
      fake.now = t.time;
      fireTimer(t);
      await flushMicrotasks();
    }
    fake.perf += target - fake.now;
    fake.now = target;
    await flushMicrotasks();
  }

  function useFakeTimers() {
    if (fake.active) return;
    fake.active = true;
    fake.now = realDateNow();
    fake.perf = 0;
    fake.timers = [];
    g.setTimeout = function (fn, ms) { return schedule(fn, ms, Array.prototype.slice.call(arguments, 2), false); };
    g.setInterval = function (fn, ms) { return schedule(fn, ms, Array.prototype.slice.call(arguments, 2), true); };
    g.clearTimeout = g.clearInterval = function (id) { unschedule(id); };
    FakeDate = class extends RealDate {
      constructor() {
        if (arguments.length === 0) super(fake.now); else super(...arguments);
      }
      static now() { return fake.now; }
    };
    g.Date = FakeDate;
    if (g.performance && realPerfNow) {
      try { g.performance.now = function () { return fake.perf; }; } catch (e) { /* read-only in some envs */ }
    }
  }
  function useRealTimers() {
    if (!fake.active) return;
    fake.active = false;
    fake.timers = [];
    g.setTimeout = realSetTimeout;
    g.setInterval = realSetInterval;
    g.clearTimeout = realClearTimeout;
    g.clearInterval = realClearInterval;
    g.Date = RealDate;
    if (g.performance && realPerfNow) { try { g.performance.now = realPerfNow; } catch (e) { /* noop */ } }
  }

  function needFake(name) {
    if (!fake.active) throw new Error('jest.' + name + '() needs fake timers. Call jest.useFakeTimers() first.');
  }

  var jest = {
    fn: function (impl) { return makeMock(impl); },
    spyOn: spyOn,
    useFakeTimers: useFakeTimers,
    useRealTimers: useRealTimers,
    advanceTimersByTime: function (ms) { needFake('advanceTimersByTime'); advanceSync(ms); },
    advanceTimersByTimeAsync: function (ms) { needFake('advanceTimersByTimeAsync'); return advanceAsync(ms); },
    runAllTimers: function () {
      needFake('runAllTimers');
      var guard = 0, t;
      while ((t = nextTimer())) {
        if (++guard > 100000) throw new Error('jest.runAllTimers(): ran 100000 timers, assuming an infinite loop');
        fake.perf += Math.max(t.time - fake.now, 0);
        fake.now = Math.max(t.time, fake.now);
        fireTimer(t);
      }
    },
    runOnlyPendingTimers: function () {
      needFake('runOnlyPendingTimers');
      var pending = fake.timers.slice().sort(function (a, b) { return a.time - b.time || a.id - b.id; });
      pending.forEach(function (t) {
        if (fake.timers.indexOf(t) === -1) return;
        fake.perf += Math.max(t.time - fake.now, 0);
        fake.now = Math.max(t.time, fake.now);
        fireTimer(t);
      });
    },
    getTimerCount: function () { return fake.timers.length; },
    clearAllTimers: function () { fake.timers = []; },
    restoreAllMocks: function () { activeSpies.splice(0).forEach(function (s) { s.mockRestore && s.mockRestore(); }); },
    setTimeout: function (ms) { state.testTimeout = ms; },
  };

  /* ───────────── expect ───────────── */

  function AssertionError(message) {
    var e = new Error(message);
    e.name = 'AssertionError';
    return e;
  }

  function mk(ctx, name, pass, received, expectedArgs, extra) {
    var head = 'expect(received).' + (ctx.isNot ? 'not.' : '') + name + '(' + (expectedArgs === undefined ? '' : expectedArgs) + ')';
    var lines = [head, ''];
    if (extra) lines.push(extra);
    return { pass: pass, message: lines.join('\n') };
  }
  function expLine(ctx, exp, rec) {
    return 'Expected: ' + (ctx.isNot ? 'not ' : '') + fmt(exp) + '\nReceived: ' + fmt(rec);
  }

  function callCount(spy) { return spy.mock.calls.length; }
  function assertSpy(v, name) {
    if (typeof v !== 'function' || !v.__isMock) throw AssertionError('expect(received).' + name + '() — received value must be a jest.fn() mock, got ' + fmt(v));
  }
  function callsSummary(spy) {
    if (!spy.mock.calls.length) return 'Calls: none';
    return 'Calls:\n' + spy.mock.calls.slice(0, 6).map(function (c, i) { return '  ' + (i + 1) + '. ' + fmt(c); }).join('\n');
  }
  function toStringMsg(x) { return x && x.message !== undefined ? String(x.message) : String(x); }

  var matchers = {
    toBe: function (a, e) {
      return mk(this, 'toBe', Object.is(a, e), a, fmt(e), expLine(this, e, a) +
        (!Object.is(a, e) && isObj(a) && isObj(e) && typeof a.nodeType === 'number' ? '\n\n(these are different DOM nodes — React re-created the element instead of reusing it)' : !Object.is(a, e) && equals(a, e) ? '\n\n(values look equal but are different references — use toEqual for deep equality)' : ''));
    },
    toEqual: function (a, e) { return mk(this, 'toEqual', equals(a, e), a, fmt(e), expLine(this, e, a)); },
    toStrictEqual: function (a, e) { return mk(this, 'toStrictEqual', equals(a, e, true), a, fmt(e), expLine(this, e, a)); },
    toBeTruthy: function (a) { return mk(this, 'toBeTruthy', !!a, a, '', 'Received: ' + fmt(a)); },
    toBeFalsy: function (a) { return mk(this, 'toBeFalsy', !a, a, '', 'Received: ' + fmt(a)); },
    toBeNull: function (a) { return mk(this, 'toBeNull', a === null, a, '', 'Received: ' + fmt(a)); },
    toBeUndefined: function (a) { return mk(this, 'toBeUndefined', a === undefined, a, '', 'Received: ' + fmt(a)); },
    toBeDefined: function (a) { return mk(this, 'toBeDefined', a !== undefined, a, '', 'Received: ' + fmt(a)); },
    toBeNaN: function (a) { return mk(this, 'toBeNaN', Number.isNaN(a), a, '', 'Received: ' + fmt(a)); },
    toBeGreaterThan: function (a, e) { return mk(this, 'toBeGreaterThan', a > e, a, fmt(e), 'Expected: > ' + fmt(e) + '\nReceived: ' + fmt(a)); },
    toBeGreaterThanOrEqual: function (a, e) { return mk(this, 'toBeGreaterThanOrEqual', a >= e, a, fmt(e), 'Expected: >= ' + fmt(e) + '\nReceived: ' + fmt(a)); },
    toBeLessThan: function (a, e) { return mk(this, 'toBeLessThan', a < e, a, fmt(e), 'Expected: < ' + fmt(e) + '\nReceived: ' + fmt(a)); },
    toBeLessThanOrEqual: function (a, e) { return mk(this, 'toBeLessThanOrEqual', a <= e, a, fmt(e), 'Expected: <= ' + fmt(e) + '\nReceived: ' + fmt(a)); },
    toBeCloseTo: function (a, e, digits) {
      digits = digits === undefined ? 2 : digits;
      return mk(this, 'toBeCloseTo', Math.abs(a - e) < Math.pow(10, -digits) / 2, a, fmt(e), expLine(this, e, a));
    },
    toBeInstanceOf: function (a, C) {
      return mk(this, 'toBeInstanceOf', a instanceof C, a, C && C.name, 'Expected instance of: ' + (C && C.name) + '\nReceived: ' + fmt(a));
    },
    toContain: function (a, e) {
      var pass = typeof a === 'string' ? a.indexOf(e) !== -1 : a != null && typeof a.indexOf === 'function' ? Array.prototype.indexOf.call(a, e) !== -1 : Array.from(a).indexOf(e) !== -1;
      return mk(this, 'toContain', pass, a, fmt(e), 'Expected item: ' + fmt(e) + '\nIn: ' + fmt(a));
    },
    toContainEqual: function (a, e) {
      return mk(this, 'toContainEqual', Array.from(a).some(function (x) { return equals(x, e); }), a, fmt(e), 'Expected item: ' + fmt(e) + '\nIn: ' + fmt(a));
    },
    toHaveLength: function (a, n) {
      var len = a == null ? undefined : a.length;
      return mk(this, 'toHaveLength', len === n, a, n, 'Expected length: ' + (this.isNot ? 'not ' : '') + n + '\nReceived length: ' + len + '\nReceived: ' + fmt(a));
    },
    toHaveProperty: function (a, path, value) {
      var parts = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
      var cur = a, has = a != null;
      for (var i = 0; has && i < parts.length; i++) {
        if (cur != null && (typeof cur === 'object' || typeof cur === 'function') && parts[i] in cur) cur = cur[parts[i]]; else has = false;
      }
      var pass = has && (arguments.length < 3 || equals(cur, value));
      return mk(this, 'toHaveProperty', pass, a, fmt(path) + (arguments.length > 2 ? ', ' + fmt(value) : ''),
        'Property: ' + parts.join('.') + (has ? '\nReceived value: ' + fmt(cur) : '\n(property not found)') + '\nIn: ' + fmt(a));
    },
    toMatch: function (a, e) {
      var pass = typeof a === 'string' && (typeof e === 'string' ? a.indexOf(e) !== -1 : e.test(a));
      return mk(this, 'toMatch', pass, a, fmt(e), expLine(this, e, a));
    },
    toMatchObject: function (a, e) { return mk(this, 'toMatchObject', subsetMatch(a, e), a, fmt(e), expLine(this, e, a)); },
    toThrow: function (a, exp, opts) {
      var threw = false, err;
      if (opts && opts.fromPromise) { threw = true; err = a; }
      else {
        if (typeof a !== 'function') throw AssertionError('expect(received).toThrow() — received value must be a function, got ' + fmt(a));
        try { a(); } catch (e) { threw = true; err = e; }
      }
      var pass = threw;
      if (threw && exp !== undefined) {
        if (typeof exp === 'string') pass = toStringMsg(err).indexOf(exp) !== -1;
        else if (exp instanceof RegExp) pass = exp.test(toStringMsg(err));
        else if (typeof exp === 'function') pass = err instanceof exp;
        else if (exp && exp.message !== undefined) pass = toStringMsg(err) === exp.message;
      }
      return mk(this, 'toThrow', pass, a, exp === undefined ? '' : fmt(exp),
        'Expected: ' + (this.isNot ? 'not ' : '') + (exp === undefined ? 'to throw' : 'to throw ' + fmt(exp)) + '\n' + (threw ? 'Thrown: ' + fmt(err) : 'Function did not throw'));
    },
    toHaveBeenCalled: function (a) {
      assertSpy(a, 'toHaveBeenCalled');
      return mk(this, 'toHaveBeenCalled', callCount(a) > 0, a, '', 'Expected: ' + (this.isNot ? 'no calls' : 'at least one call') + '\nReceived: ' + callCount(a) + ' call(s)');
    },
    toHaveBeenCalledTimes: function (a, n) {
      assertSpy(a, 'toHaveBeenCalledTimes');
      return mk(this, 'toHaveBeenCalledTimes', callCount(a) === n, a, n, 'Expected: ' + (this.isNot ? 'not ' : '') + n + ' call(s)\nReceived: ' + callCount(a) + ' call(s)\n' + callsSummary(a));
    },
    toHaveBeenCalledWith: function (a) {
      assertSpy(a, 'toHaveBeenCalledWith');
      var exp = Array.prototype.slice.call(arguments, 1);
      return mk(this, 'toHaveBeenCalledWith', a.mock.calls.some(function (c) { return equals(c, exp); }), a, fmt(exp).slice(1, -1), 'Expected call: ' + fmt(exp) + '\n' + callsSummary(a));
    },
    toHaveBeenLastCalledWith: function (a) {
      assertSpy(a, 'toHaveBeenLastCalledWith');
      var exp = Array.prototype.slice.call(arguments, 1);
      var last = a.mock.calls[a.mock.calls.length - 1];
      return mk(this, 'toHaveBeenLastCalledWith', !!last && equals(last, exp), a, fmt(exp).slice(1, -1), 'Expected last call: ' + fmt(exp) + '\n' + callsSummary(a));
    },
    toHaveBeenNthCalledWith: function (a, n) {
      assertSpy(a, 'toHaveBeenNthCalledWith');
      var exp = Array.prototype.slice.call(arguments, 2);
      var c = a.mock.calls[n - 1];
      return mk(this, 'toHaveBeenNthCalledWith', !!c && equals(c, exp), a, n + ', ' + fmt(exp).slice(1, -1), 'Expected call #' + n + ': ' + fmt(exp) + '\n' + callsSummary(a));
    },
  };

  /* DOM matchers (React mode) */
  function assertEl(v, name) {
    if (!v || v.nodeType !== 1) throw AssertionError('expect(received).' + name + '() — received value must be a DOM element, got ' + fmt(v));
  }
  function normText(s) { return String(s).replace(/\s+/g, ' ').trim(); }
  function isHidden(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return true;
      var st = el.ownerDocument.defaultView.getComputedStyle(n);
      if (st.display === 'none' || st.visibility === 'hidden') return true;
    }
    return false;
  }
  function isDisabled(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.disabled && /^(BUTTON|INPUT|SELECT|TEXTAREA|OPTION|FIELDSET)$/.test(n.tagName)) return true;
    }
    return false;
  }
  var domMatchers = {
    toBeInTheDocument: function (a) {
      if (a !== null) assertEl(a, 'toBeInTheDocument');
      return mk(this, 'toBeInTheDocument', !!a && a.ownerDocument.contains(a), a, '', 'Received: ' + fmt(a));
    },
    toBeVisible: function (a) { assertEl(a, 'toBeVisible'); return mk(this, 'toBeVisible', a.ownerDocument.contains(a) && !isHidden(a), a, '', 'Received: ' + fmt(a)); },
    toBeDisabled: function (a) { assertEl(a, 'toBeDisabled'); return mk(this, 'toBeDisabled', isDisabled(a), a, '', 'Received: ' + fmt(a)); },
    toBeEnabled: function (a) { assertEl(a, 'toBeEnabled'); return mk(this, 'toBeEnabled', !isDisabled(a), a, '', 'Received: ' + fmt(a)); },
    toBeChecked: function (a) { assertEl(a, 'toBeChecked'); return mk(this, 'toBeChecked', !!a.checked || a.getAttribute('aria-checked') === 'true', a, '', 'Received: ' + fmt(a)); },
    toHaveFocus: function (a) { assertEl(a, 'toHaveFocus'); return mk(this, 'toHaveFocus', a.ownerDocument.activeElement === a, a, '', 'Active element: ' + fmt(a.ownerDocument.activeElement)); },
    toBeEmptyDOMElement: function (a) { assertEl(a, 'toBeEmptyDOMElement'); return mk(this, 'toBeEmptyDOMElement', a.innerHTML === '', a, '', 'Received HTML: ' + JSON.stringify(a.innerHTML)); },
    toContainElement: function (a, b) { assertEl(a, 'toContainElement'); return mk(this, 'toContainElement', !!b && a.contains(b), a, fmt(b), 'Container: ' + fmt(a)); },
    toHaveTextContent: function (a, e) {
      assertEl(a, 'toHaveTextContent');
      var text = normText(a.textContent);
      var pass = e instanceof RegExp ? e.test(text) : text.indexOf(normText(e)) !== -1;
      return mk(this, 'toHaveTextContent', pass, a, fmt(e), 'Expected text: ' + fmt(e) + '\nReceived text: ' + fmt(text));
    },
    toHaveValue: function (a, e) {
      assertEl(a, 'toHaveValue');
      var v = a.type === 'checkbox' || a.type === 'radio' ? a.value : a.type === 'number' ? (a.value === '' ? null : Number(a.value)) : a.value;
      return mk(this, 'toHaveValue', equals(v, e), a, fmt(e), expLine(this, e, v));
    },
    toHaveAttribute: function (a, name, value) {
      assertEl(a, 'toHaveAttribute');
      var has = a.hasAttribute(name);
      var pass = has && (arguments.length < 3 || (value instanceof Asym ? value.asymmetricMatch(a.getAttribute(name)) : a.getAttribute(name) === value));
      return mk(this, 'toHaveAttribute', pass, a, fmt(name) + (arguments.length > 2 ? ', ' + fmt(value) : ''), has ? 'Received: ' + name + '=' + fmt(a.getAttribute(name)) : 'Attribute "' + name + '" not found on ' + fmt(a));
    },
    toHaveClass: function (a) {
      assertEl(a, 'toHaveClass');
      var want = Array.prototype.slice.call(arguments, 1).join(' ').split(/\s+/).filter(Boolean);
      var have = (a.getAttribute('class') || '').split(/\s+/).filter(Boolean);
      return mk(this, 'toHaveClass', want.every(function (c) { return have.indexOf(c) !== -1; }), a, want.map(fmt).join(', '), 'Expected class: ' + want.join(' ') + '\nReceived class: ' + have.join(' '));
    },
    toHaveStyle: function (a, css) {
      assertEl(a, 'toHaveStyle');
      var cs = a.ownerDocument.defaultView.getComputedStyle(a);
      var probe = a.ownerDocument.createElement('div');
      var entries = typeof css === 'string' ? css.split(';').filter(Boolean).map(function (d) { var i = d.indexOf(':'); return [d.slice(0, i).trim(), d.slice(i + 1).trim()]; }) : Object.keys(css).map(function (k) { return [k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }), String(css[k])]; });
      var bad = entries.filter(function (kv) { probe.style.setProperty(kv[0], kv[1]); return cs.getPropertyValue(kv[0]) !== probe.style.getPropertyValue(kv[0]); });
      return mk(this, 'toHaveStyle', bad.length === 0, a, fmt(css), 'Mismatched: ' + bad.map(function (kv) { return kv[0] + ' (got ' + cs.getPropertyValue(kv[0]) + ')'; }).join(', '));
    },
  };

  function makeExpect(mode) {
    var all = Object.assign({}, matchers, mode === 'react' ? domMatchers : {});
    function expect(actual) {
      function build(negate, kind) {
        var api = {};
        Object.keys(all).forEach(function (name) {
          api[name] = function () {
            var args = Array.prototype.slice.call(arguments);
            var ctx = { isNot: negate };
            function finish(value, fromPromise) {
              var res;
              if (name === 'toThrow' && kind === 'rejects') res = all[name].apply(ctx, [value, args[0], { fromPromise: true }]);
              else res = all[name].apply(ctx, [value].concat(args));
              if (res.pass === negate) throw AssertionError(res.message);
            }
            if (kind === 'value') return void finish(actual);
            return (async function () {
              if (kind === 'resolves') {
                var v;
                try { v = await actual; } catch (e) { throw AssertionError('expect(promise).resolves.' + name + '() — promise rejected with ' + fmt(e)); }
                finish(v);
              } else {
                var settled = false, val;
                try { val = await actual; settled = true; } catch (e) { val = e; }
                if (settled) throw AssertionError('expect(promise).rejects.' + name + '() — promise resolved with ' + fmt(val) + ' instead of rejecting');
                finish(val);
              }
            })();
          };
        });
        return api;
      }
      var api = build(false, 'value');
      api.not = build(true, 'value');
      api.resolves = build(false, 'resolves');
      api.resolves.not = build(true, 'resolves');
      api.rejects = build(false, 'rejects');
      api.rejects.not = build(true, 'rejects');
      return api;
    }
    expect.any = function (C) {
      return new Asym('Any<' + (C && C.name) + '>', function (v) {
        if (C === String) return typeof v === 'string' || v instanceof String;
        if (C === Number) return typeof v === 'number' || v instanceof Number;
        if (C === Boolean) return typeof v === 'boolean' || v instanceof Boolean;
        if (C === Function) return typeof v === 'function';
        if (C === Object) return typeof v === 'object' && v !== null;
        if (C === Symbol) return typeof v === 'symbol';
        return v instanceof C;
      });
    };
    expect.anything = function () { return new Asym('Anything', function (v) { return v !== null && v !== undefined; }); };
    expect.objectContaining = function (o) {
      return new Asym('ObjectContaining ' + fmt(o), function (v) {
        return isObj(v) && Object.keys(o).every(function (k) { return k in v && equals(v[k], o[k]); });
      });
    };
    expect.arrayContaining = function (arr) {
      return new Asym('ArrayContaining ' + fmt(arr), function (v) {
        return Array.isArray(v) && arr.every(function (x) { return v.some(function (y) { return equals(y, x); }); });
      });
    };
    expect.stringContaining = function (s) { return new Asym('StringContaining ' + fmt(s), function (v) { return typeof v === 'string' && v.indexOf(s) !== -1; }); };
    expect.stringMatching = function (r) { return new Asym('StringMatching ' + String(r), function (v) { return typeof v === 'string' && new RegExp(r).test(v); }); };
    return expect;
  }

  /* ───────────── test registry ───────────── */

  var state;

  function freshState() {
    return {
      root: { name: '', parent: null, children: [], beforeEach: [], afterEach: [] },
      testTimeout: 2000,
      only: false,
    };
  }

  function makeRegistry() {
    var current = state.root;
    function describe(name, fn) {
      var suite = { name: name, parent: current, children: [], beforeEach: [], afterEach: [] };
      current.children.push(suite);
      var prev = current;
      current = suite;
      try { fn(); } finally { current = prev; }
    }
    function it(name, fn) { current.children.push({ name: name, fn: fn, parent: current, test: true }); }
    it.skip = function (name) { current.children.push({ name: name, parent: current, test: true, skip: true }); };
    it.todo = it.skip;
    function fill(tpl, row) {
      var i = 0;
      var arr = Array.isArray(row) ? row : [row];
      return tpl.replace(/%[spdjio]/g, function () { return fmt(arr[i++]).replace(/^"|"$/g, ''); });
    }
    it.each = function (rows) { return function (name, fn) { rows.forEach(function (row) { it(fill(name, row), function () { return fn.apply(null, Array.isArray(row) ? row : [row]); }); }); }; };
    describe.each = function (rows) { return function (name, fn) { rows.forEach(function (row) { describe(fill(name, row), function () { return fn.apply(null, Array.isArray(row) ? row : [row]); }); }); }; };
    describe.skip = function () {};
    return {
      describe: describe, it: it, test: it,
      beforeEach: function (fn) { current.beforeEach.push(fn); },
      afterEach: function (fn) { current.afterEach.push(fn); },
    };
  }

  function collect(suite, path, out) {
    suite.children.forEach(function (c) {
      if (c.test) out.push({ node: c, suite: path.slice(), name: c.name });
      else collect(c, path.concat([c.name]), out);
    });
    return out;
  }

  function chain(node) {
    var list = [];
    for (var s = node.parent; s; s = s.parent) list.unshift(s);
    return list;
  }

  async function withTimeout(fn, ms, label) {
    var timer;
    var timeout = new Promise(function (_, reject) {
      timer = realSetTimeout(function () { reject(new Error('Test timed out after ' + ms + 'ms' + (label ? ' (' + label + ')' : '') + ' — did a promise never resolve?')); }, ms);
    });
    try { return await Promise.race([Promise.resolve().then(fn), timeout]); }
    finally { realClearTimeout(timer); }
  }

  /* ───────────── React kit ───────────── */

  var reactCleanups = [];

  function createReactKit() {
    var React = g.React, ReactDOM = g.ReactDOM;
    if (!React || !ReactDOM) throw new Error('React runtime is missing in the sandbox');
    g.IS_REACT_ACT_ENVIRONMENT = true;
    var doc = g.document;

    /* Mirrors Testing Library: the act-environment flag is true only while inside act(), and false while an async
       helper (userEvent, waitFor) is waiting — so updates that land after an `await` don't spam act() warnings. */
    function act(cb) {
      var prev = g.IS_REACT_ACT_ENVIRONMENT;
      g.IS_REACT_ACT_ENVIRONMENT = true;
      var isAsync = false;
      var wrapped = function () {
        var out = cb();
        if (out && typeof out.then === 'function') isAsync = true;
        return out;
      };
      var result;
      try { result = React.act(wrapped); }
      catch (e) { g.IS_REACT_ACT_ENVIRONMENT = prev; throw e; }
      if (!isAsync) { g.IS_REACT_ACT_ENVIRONMENT = prev; return undefined; }
      // React's act() thenable does not return a promise from .then, so wrap it in a real one.
      return new Promise(function (resolve, reject) {
        result.then(
          function (v) { g.IS_REACT_ACT_ENVIRONMENT = prev; resolve(v); },
          function (e) { g.IS_REACT_ACT_ENVIRONMENT = prev; reject(e); }
        );
      });
    }
    function untilIdle(fn) {
      return async function () {
        var prev = g.IS_REACT_ACT_ENVIRONMENT;
        g.IS_REACT_ACT_ENVIRONMENT = false;
        try {
          var r = await fn.apply(this, arguments);
          await sleep(0);
          return r;
        } finally { g.IS_REACT_ACT_ENVIRONMENT = prev; }
      };
    }

    var ROLE_BY_TAG = { button: 'button', a: 'link', h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading', ul: 'list', ol: 'list', li: 'listitem', nav: 'navigation', main: 'main', img: 'img', select: 'combobox', textarea: 'textbox', table: 'table', tr: 'row', td: 'cell', th: 'columnheader', option: 'option', dialog: 'dialog', article: 'article', aside: 'complementary', form: 'form', progress: 'progressbar', header: 'banner', footer: 'contentinfo', section: 'region', p: 'paragraph', label: null };
    var ROLE_BY_INPUT = { text: 'textbox', email: 'textbox', search: 'searchbox', tel: 'textbox', url: 'textbox', number: 'spinbutton', checkbox: 'checkbox', radio: 'radio', range: 'slider', submit: 'button', button: 'button', reset: 'button', image: 'button', '': 'textbox' };

    function roleOf(el) {
      var explicit = el.getAttribute('role');
      if (explicit) return explicit.split(' ')[0];
      var tag = el.tagName.toLowerCase();
      if (tag === 'a') return el.hasAttribute('href') ? 'link' : null;
      if (tag === 'img') return el.getAttribute('alt') === '' ? 'presentation' : 'img';
      if (tag === 'input') return ROLE_BY_INPUT[(el.getAttribute('type') || 'text').toLowerCase()] || null;
      if (tag === 'select') return el.multiple || Number(el.getAttribute('size')) > 1 ? 'listbox' : 'combobox';
      return ROLE_BY_TAG[tag] || null;
    }

    function labelsText(el) {
      var texts = [];
      var id = el.getAttribute('id');
      if (id) Array.prototype.forEach.call(doc.querySelectorAll('label'), function (l) { if (l.getAttribute('for') === id) texts.push(labelOwnText(l, el)); });
      var wrap = el.closest && el.closest('label');
      if (wrap) texts.push(labelOwnText(wrap, el));
      return texts;
    }
    function labelOwnText(label, control) {
      var clone = label.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll('input,select,textarea'), function (c) { c.parentNode.removeChild(c); });
      return normText(clone.textContent);
    }
    function accessibleName(el) {
      var by = el.getAttribute('aria-labelledby');
      if (by) return normText(by.split(/\s+/).map(function (id) { var n = doc.getElementById(id); return n ? n.textContent : ''; }).join(' '));
      var al = el.getAttribute('aria-label');
      if (al) return normText(al);
      var tag = el.tagName.toLowerCase();
      if (/^(input|select|textarea)$/.test(tag)) {
        var ls = labelsText(el);
        if (ls.length) return ls.join(' ');
        if (tag === 'input' && /^(submit|button|reset)$/.test(el.type)) return el.value;
        return el.getAttribute('title') || '';
      }
      if (tag === 'img') return el.getAttribute('alt') || el.getAttribute('title') || '';
      return normText(el.textContent) || el.getAttribute('title') || '';
    }

    function matches(matcher, text, el, exact) {
      if (matcher instanceof RegExp) { matcher.lastIndex = 0; return matcher.test(text); }
      if (typeof matcher === 'function') return !!matcher(text, el);
      return exact === false ? text.toLowerCase().indexOf(String(matcher).toLowerCase()) !== -1 : text === normText(matcher);
    }
    function describeMatcher(m) { return m instanceof RegExp ? String(m) : typeof m === 'function' ? '[function]' : JSON.stringify(m); }

    function allEls(container) { return Array.prototype.slice.call(container.querySelectorAll('*')); }

    var finders = {
      Text: function (c, m, o) {
        return allEls(c).filter(function (el) {
          if (/^(SCRIPT|STYLE)$/.test(el.tagName)) return false;
          var own = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join('');
          return matches(m, normText(own), el, o.exact);
        });
      },
      Role: function (c, m, o) {
        return allEls(c).filter(function (el) {
          var r = roleOf(el);
          if (r !== m) return false;
          if (o.hidden !== true && isHidden(el)) return false;
          if (o.name !== undefined && !matches(o.name, accessibleName(el), el, true)) return false;
          if (o.level !== undefined && el.tagName !== 'H' + o.level && el.getAttribute('aria-level') !== String(o.level)) return false;
          if (o.checked !== undefined && (!!el.checked || el.getAttribute('aria-checked') === 'true') !== o.checked) return false;
          if (o.pressed !== undefined && (el.getAttribute('aria-pressed') === 'true') !== o.pressed) return false;
          if (o.expanded !== undefined && (el.getAttribute('aria-expanded') === 'true') !== o.expanded) return false;
          if (o.selected !== undefined && (!!el.selected || el.getAttribute('aria-selected') === 'true') !== o.selected) return false;
          return true;
        });
      },
      LabelText: function (c, m, o) {
        var found = [];
        allEls(c).forEach(function (el) {
          var texts = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) ? labelsText(el) : [];
          var al = el.getAttribute('aria-label');
          if (al) texts.push(normText(al));
          var by = el.getAttribute('aria-labelledby');
          if (by) texts.push(accessibleName(el));
          if (texts.some(function (t) { return matches(m, t, el, o.exact); }) && found.indexOf(el) === -1) found.push(el);
        });
        return found;
      },
      PlaceholderText: function (c, m, o) { return allEls(c).filter(function (el) { return el.hasAttribute('placeholder') && matches(m, el.getAttribute('placeholder'), el, o.exact); }); },
      TestId: function (c, m) { return allEls(c).filter(function (el) { return matches(m, el.getAttribute('data-testid') || '\u0000', el, true); }); },
      DisplayValue: function (c, m, o) { return allEls(c).filter(function (el) { return /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && matches(m, String(el.value), el, o.exact); }); },
      AltText: function (c, m, o) { return allEls(c).filter(function (el) { return el.hasAttribute('alt') && matches(m, el.getAttribute('alt'), el, o.exact); }); },
      Title: function (c, m, o) { return allEls(c).filter(function (el) { return el.hasAttribute('title') && matches(m, el.getAttribute('title'), el, o.exact); }); },
    };
    var FINDER_LABEL = { Text: 'text', Role: 'role', LabelText: 'label text', PlaceholderText: 'placeholder text', TestId: 'test id', DisplayValue: 'display value', AltText: 'alt text', Title: 'title' };

    function domDump(container) {
      var html = container === doc.body ? doc.body.innerHTML : container.outerHTML;
      html = html.replace(/></g, '>\n<');
      var lines = html.split('\n');
      return lines.length > 40 ? lines.slice(0, 40).join('\n') + '\n…' : html;
    }

    function bindQueries(container) {
      var q = {};
      Object.keys(finders).forEach(function (kind) {
        function all(m, o) { return finders[kind](container, m, o || {}); }
        function label(m, o) { return FINDER_LABEL[kind] + ': ' + describeMatcher(m) + (o && o.name !== undefined ? ' with name ' + describeMatcher(o.name) : ''); }
        q['queryAllBy' + kind] = all;
        q['getAllBy' + kind] = function (m, o) {
          var r = all(m, o);
          if (!r.length) throw new Error('Unable to find an element by ' + label(m, o) + '\n\nCurrent DOM:\n' + domDump(container));
          return r;
        };
        q['queryBy' + kind] = function (m, o) {
          var r = all(m, o);
          if (r.length > 1) throw new Error('Found multiple elements by ' + label(m, o) + ' — use queryAllBy' + kind + ' instead.');
          return r[0] || null;
        };
        q['getBy' + kind] = function (m, o) {
          var r = all(m, o);
          if (!r.length) throw new Error('Unable to find an element by ' + label(m, o) + '\n\nCurrent DOM:\n' + domDump(container));
          if (r.length > 1) throw new Error('Found multiple elements by ' + label(m, o) + ' (' + r.length + ' matches). Be more specific, or use getAllBy' + kind + '.\n\nMatches:\n' + r.slice(0, 5).map(fmt).join('\n'));
          return r[0];
        };
        q['findBy' + kind] = function (m, o, w) { return waitFor(function () { return q['getBy' + kind](m, o); }, w); };
        q['findAllBy' + kind] = function (m, o, w) { return waitFor(function () { return q['getAllBy' + kind](m, o); }, w); };
      });
      return q;
    }

    async function waitFor(cb, opts) {
      opts = opts || {};
      var timeout = opts.timeout === undefined ? 1000 : opts.timeout;
      var interval = opts.interval === undefined ? 25 : opts.interval;
      var start = realDateNow(), elapsedFake = 0, lastErr;
      var prevEnv = g.IS_REACT_ACT_ENVIRONMENT;
      g.IS_REACT_ACT_ENVIRONMENT = false;
      try {
        for (;;) {
          try { return await cb(); } catch (e) { lastErr = e; }
          var over = fake.active ? elapsedFake >= timeout : realDateNow() - start >= timeout;
          if (over) break;
          if (fake.active) { await act(async function () { await advanceAsync(interval); }); elapsedFake += interval; }
          else await sleep(interval);
        }
      } finally { g.IS_REACT_ACT_ENVIRONMENT = prevEnv; }
      var msg = lastErr && lastErr.message ? lastErr.message : String(lastErr);
      throw new Error('waitFor timed out after ' + timeout + 'ms.\n' + msg);
    }

    /* events */
    function setNativeValue(el, value) {
      var proto = Object.getPrototypeOf(el);
      var desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    }
    function dispatch(el, event) {
      var res;
      act(function () { res = el.dispatchEvent(event); });
      return res;
    }
    var win = doc.defaultView;
    function make(type, Ctor, init, defaults) {
      var C = win[Ctor] || win.Event;
      return new C(type, Object.assign({ bubbles: true, cancelable: true }, defaults, init));
    }
    var fireEvent = function (el, event) { return dispatch(el, event); };
    var EVENTS = {
      click: ['MouseEvent', { button: 0 }], dblClick: ['MouseEvent', { detail: 2 }, 'dblclick'], contextMenu: ['MouseEvent', {}, 'contextmenu'],
      mouseDown: ['MouseEvent', {}, 'mousedown'], mouseUp: ['MouseEvent', {}, 'mouseup'], mouseMove: ['MouseEvent', {}, 'mousemove'],
      mouseOver: ['MouseEvent', {}, 'mouseover'], mouseOut: ['MouseEvent', {}, 'mouseout'],
      pointerDown: ['PointerEvent', {}, 'pointerdown'], pointerUp: ['PointerEvent', {}, 'pointerup'],
      keyDown: ['KeyboardEvent', {}, 'keydown'], keyUp: ['KeyboardEvent', {}, 'keyup'], keyPress: ['KeyboardEvent', {}, 'keypress'],
      submit: ['Event', {}], reset: ['Event', {}], scroll: ['UIEvent', { bubbles: false }], input: ['Event', {}],
      drop: ['DragEvent', {}], dragStart: ['DragEvent', {}, 'dragstart'], dragOver: ['DragEvent', {}, 'dragover'],
      copy: ['Event', {}], paste: ['Event', {}], cut: ['Event', {}],
    };
    Object.keys(EVENTS).forEach(function (name) {
      var spec = EVENTS[name];
      fireEvent[name] = function (el, init) {
        if (name === 'click' && !(init && init.__dispatchOnly) && el.tagName && isDisabled(el)) return true;
        var ev = make(spec[2] || name.toLowerCase(), spec[0], init, spec[1]);
        if (init && init.target) Object.assign(el, init.target);
        return dispatch(el, ev);
      };
    });
    fireEvent.mouseEnter = function (el, init) { fireEvent.mouseOver(el, init); return dispatch(el, make('mouseenter', 'MouseEvent', init, { bubbles: false })); };
    fireEvent.mouseLeave = function (el, init) { fireEvent.mouseOut(el, init); return dispatch(el, make('mouseleave', 'MouseEvent', init, { bubbles: false })); };
    fireEvent.focus = function (el) { act(function () { el.focus(); }); };
    fireEvent.blur = function (el) { act(function () { el.blur(); }); };
    fireEvent.change = function (el, init) {
      var t = (init && init.target) || {};
      if (el.type === 'checkbox' || el.type === 'radio') {
        if ('checked' in t && t.checked !== el.checked) fireEvent.click(el);
        return;
      }
      if ('value' in t) setNativeValue(el, t.value);
      dispatch(el, make(el.tagName === 'SELECT' ? 'change' : 'input', 'Event', {}, {}));
      if (el.tagName !== 'SELECT') dispatch(el, make('change', 'Event', {}, {}));
    };

    /* userEvent */
    var focusable = 'a[href],button,input,select,textarea,[tabindex]';
    function focusEl(el) {
      var target = el.closest && el.closest(focusable);
      if (target && !isDisabled(target)) act(function () { target.focus(); });
      else if (doc.activeElement && doc.activeElement !== doc.body) act(function () { doc.activeElement.blur(); });
    }
    var userEvent = {
      async click(el) {
        if (isDisabled(el)) return;
        fireEvent.pointerDown(el);
        var focusAllowed = fireEvent.mouseDown(el) !== false; // preventDefault() on mousedown keeps focus where it is
        if (focusAllowed) focusEl(el);
        fireEvent.pointerUp(el); fireEvent.mouseUp(el);
        act(function () { el.click(); });
      },
      async dblClick(el) { await userEvent.click(el); await userEvent.click(el); fireEvent.dblClick(el); },
      async hover(el) { fireEvent.mouseEnter(el); fireEvent.mouseMove(el); },
      async unhover(el) { fireEvent.mouseLeave(el); },
      async clear(el) {
        focusEl(el);
        try { el.select(); } catch (e) { /* not selectable */ }
        setNativeValue(el, '');
        dispatch(el, make('input', 'Event', {}, {}));
      },
      async type(el, text, opts) {
        if (!(opts && opts.skipClick)) await userEvent.click(el);
        var tokens = String(text).match(/\{[^}]+\}|[^{]|\{/g) || [];
        for (var i = 0; i < tokens.length; i++) await typeToken(el, tokens[i]);
      },
      async keyboard(text) {
        var el = doc.activeElement || doc.body;
        var tokens = String(text).match(/\{[^}]+\}|[^{]|\{/g) || [];
        for (var i = 0; i < tokens.length; i++) await typeToken(el, tokens[i]);
      },
      async tab(opts) {
        var back = opts && opts.shift;
        var list = Array.prototype.filter.call(doc.querySelectorAll(focusable), function (e) { return !isDisabled(e) && e.tabIndex >= 0; });
        if (!list.length) return;
        var i = list.indexOf(doc.activeElement);
        var next = list[back ? (i <= 0 ? list.length - 1 : i - 1) : (i + 1) % list.length];
        fireEvent.keyDown(doc.activeElement || doc.body, { key: 'Tab', code: 'Tab', shiftKey: !!back });
        act(function () { next.focus(); });
      },
      async selectOptions(el, values) {
        values = Array.isArray(values) ? values : [values];
        await userEvent.click(el);
        var opts = Array.prototype.slice.call(el.querySelectorAll('option'));
        values.forEach(function (v) {
          var opt = opts.filter(function (o) { return o.value === String(v) || normText(o.textContent) === String(v); })[0];
          if (!opt) throw new Error('userEvent.selectOptions: no option matching ' + fmt(v));
          if (el.multiple) { opt.selected = true; dispatch(el, make('change', 'Event', {}, {})); }
          else { setNativeValue(el, opt.value); dispatch(el, make('change', 'Event', {}, {})); }
        });
      },
    };
    Object.keys(userEvent).forEach(function (k) { userEvent[k] = untilIdle(userEvent[k]); });
    async function typeToken(el, token) {
      var special = /^\{(.+)\}$/.exec(token);
      var active = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : el;
      var key = special ? special[1] : token;
      var name = { Enter: 'Enter', Backspace: 'Backspace', Escape: 'Escape', Tab: 'Tab', ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Delete: 'Delete', Home: 'Home', End: 'End', ' ': ' ' }[key];
      if (special && !name) key = special[1];
      var proceed = fireEvent.keyDown(active, { key: key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key });
      if (proceed !== false) {
        var isText = /^(INPUT|TEXTAREA)$/.test(active.tagName) && !/^(checkbox|radio|submit|button)$/.test(active.type);
        if (key === 'Enter') {
          if (active.tagName === 'INPUT' && active.form) {
            var submit = active.form.querySelector('button[type=submit],button:not([type]),input[type=submit]');
            if (submit) act(function () { submit.click(); });
            else act(function () { active.form.requestSubmit ? active.form.requestSubmit() : active.form.dispatchEvent(make('submit', 'Event', {}, {})); });
          } else if (active.tagName === 'BUTTON' || (active.tagName === 'A' && active.href)) act(function () { active.click(); });
          else if (active.tagName === 'TEXTAREA' && isText) insertText(active, '\n');
        } else if (key === ' ' && (active.tagName === 'BUTTON' || /^(checkbox|radio)$/.test(active.type))) {
          act(function () { active.click(); });
        } else if (isText && key === 'Backspace') {
          var s = safeSel(active);
          var v = String(active.value);
          if (s[0] !== s[1]) commit(active, v.slice(0, s[0]) + v.slice(s[1]), s[0]);
          else if (s[0] > 0) commit(active, v.slice(0, s[0] - 1) + v.slice(s[0]), s[0] - 1);
        } else if (isText && key === 'Delete') {
          var s2 = safeSel(active), v2 = String(active.value);
          if (s2[0] !== s2[1]) commit(active, v2.slice(0, s2[0]) + v2.slice(s2[1]), s2[0]);
          else commit(active, v2.slice(0, s2[0]) + v2.slice(s2[0] + 1), s2[0]);
        } else if (isText && key.length === 1) insertText(active, key);
      }
      fireEvent.keyUp(active, { key: key });
    }
    function safeSel(el) {
      try { if (el.selectionStart != null) return [el.selectionStart, el.selectionEnd]; } catch (e) { /* email/number inputs */ }
      var n = String(el.value).length;
      return [n, n];
    }
    function commit(el, value, caret) {
      setNativeValue(el, value);
      try { el.setSelectionRange(caret, caret); } catch (e) { /* unsupported input type */ }
      dispatch(el, make('input', 'Event', {}, {}));
    }
    function insertText(el, text) {
      var s = safeSel(el), v = String(el.value);
      if (el.maxLength > 0 && v.length - (s[1] - s[0]) + text.length > el.maxLength) return;
      commit(el, v.slice(0, s[0]) + text + v.slice(s[1]), s[0] + text.length);
    }

    /* render */
    var mounted = [];
    function render(ui, opts) {
      opts = opts || {};
      var container = opts.container || doc.body.appendChild(doc.createElement('div'));
      var root = ReactDOM.createRoot(container);
      var Wrapper = opts.wrapper;
      function wrap(el) { return Wrapper ? React.createElement(Wrapper, null, el) : el; }
      act(function () { root.render(wrap(ui)); });
      var entry = { container: container, root: root };
      mounted.push(entry);
      return Object.assign({
        container: container,
        baseElement: doc.body,
        rerender: function (next) { act(function () { root.render(wrap(next)); }); },
        unmount: function () { act(function () { root.unmount(); }); },
        asFragment: function () { return doc.createRange().createContextualFragment(container.innerHTML); },
        debug: function () { console.log(domDump(container)); },
      }, bindQueries(doc.body));
    }
    function cleanup() {
      mounted.splice(0).forEach(function (m) {
        try { act(function () { m.root.unmount(); }); } catch (e) { /* already gone */ }
        if (m.container.parentNode) m.container.parentNode.removeChild(m.container);
      });
      doc.body.innerHTML = '';
    }
    function renderHook(cb, opts) {
      opts = opts || {};
      var result = { current: undefined, error: undefined };
      function Probe(p) { result.current = cb(p.hookProps); return null; }
      var props = opts.initialProps;
      var r = render(React.createElement(Probe, { hookProps: props }), { wrapper: opts.wrapper });
      return {
        result: result,
        rerender: function (next) { props = next === undefined ? props : next; r.rerender(React.createElement(Probe, { hookProps: props })); },
        unmount: r.unmount,
      };
    }

    /* Sandboxed iframes have an opaque origin, so real localStorage throws there. Fall back to an in-memory Storage. */
    function memoryStorage() {
      var data = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
        setItem: function (k, v) { data[String(k)] = String(v); },
        removeItem: function (k) { delete data[k]; },
        clear: function () { data = {}; },
        key: function (i) { return Object.keys(data)[i] || null; },
        get length() { return Object.keys(data).length; },
      };
    }
    ['localStorage', 'sessionStorage'].forEach(function (name) {
      var usable = true;
      try { g[name].getItem('__probe'); } catch (e) { usable = false; }
      if (!usable) Object.defineProperty(g, name, { value: memoryStorage(), configurable: true });
    });

    reactCleanups.push(cleanup);
    var screen = bindQueries(doc.body);
    return Object.assign({}, {
      render: render, renderHook: renderHook, screen: screen, fireEvent: fireEvent, userEvent: userEvent, waitFor: waitFor, act: act,
      within: function (el) { return bindQueries(el); }, cleanup: cleanup, React: React,
    });
  }

  /* jsx-runtime shim: UMD React has no automatic runtime, but sucrase's automatic transform expects one. */
  function jsxRuntime(React) {
    function split(props, key, spread) {
      var rest = {};
      var children = props.children;
      for (var k in props) if (k !== 'children' && Object.prototype.hasOwnProperty.call(props, k)) rest[k] = props[k];
      if (key !== undefined) rest.key = key;
      if (children === undefined) return [rest];
      return spread && Array.isArray(children) ? [rest].concat(children) : [rest, children];
    }
    function make(spread) {
      return function (type, props, key) {
        var parts = split(props || {}, key, spread);
        return React.createElement.apply(React, [type].concat(parts));
      };
    }
    return { jsx: make(false), jsxs: make(true), jsxDEV: make(false), Fragment: React.Fragment };
  }

  function makeReq(mode) {
    if (mode === 'react') {
      var runtime = jsxRuntime(g.React);
      return function (name) {
        if (name === 'react') return g.React;
        if (name === 'react-dom' || name === 'react-dom/client') return g.ReactDOM;
        if (name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') return runtime;
        throw new Error("Cannot import '" + name + "' — only react, react-dom and react-dom/client are available in this sandbox.");
      };
    }
    return function (name) { throw new Error("Cannot import '" + name + "' — this exercise runs without external modules."); };
  }

  /* Playground: render the default export of user code into `el` (no test harness). */
  function mount(userCode, el, emit) {
    g.IS_REACT_ACT_ENVIRONMENT = false;
    var realConsole = g.console;
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
      var orig = realConsole[level] && realConsole[level].bind(realConsole);
      realConsole[level] = function () {
        emit({ type: 'log', level: level, text: logFmt(Array.prototype.slice.call(arguments)) });
        if (orig) orig.apply(null, arguments);
      };
    });
    var exp = evalModule(userCode, makeReq('react'), 'playground.js');
    var Component = exp.default || exp.App;
    if (!Component) throw new Error('Export a component: `export default function App() { … }`');
    var React = g.React;
    var Boundary = class extends React.Component {
      constructor(p) { super(p); this.state = { error: null }; }
      static getDerivedStateFromError(error) { return { error: error }; }
      componentDidCatch(error) { emit({ type: 'log', level: 'error', text: errorText(error) }); }
      render() { return this.state.error ? React.createElement('pre', { style: { color: '#c0392b', whiteSpace: 'pre-wrap' } }, errorText(this.state.error)) : this.props.children; }
    };
    g.ReactDOM.createRoot(el).render(React.createElement(Boundary, null, React.createElement(Component)));
  }


  /* ───────────── production-scenario test helpers ───────────── */

  /** A controllable WebSocket look-alike. Code under test sees the normal API; tests drive it with open()/receive()/drop(). */
  function createFakeSocket(url) {
    var handlers = { open: [], message: [], close: [], error: [] };
    var s = { url: url, readyState: 0, sent: [], onopen: null, onmessage: null, onclose: null, onerror: null };
    function emit(type, ev) {
      ev.type = type; ev.target = s;
      var on = s['on' + type];
      if (typeof on === 'function') on.call(s, ev);
      handlers[type].slice().forEach(function (f) { f.call(s, ev); });
    }
    s.addEventListener = function (t, f) { if (handlers[t]) handlers[t].push(f); };
    s.removeEventListener = function (t, f) { if (handlers[t]) handlers[t] = handlers[t].filter(function (x) { return x !== f; }); };
    s.send = function (d) {
      if (s.readyState === 0) throw new Error('InvalidStateError: socket is still CONNECTING');
      if (s.readyState === 1) s.sent.push(d);
    };
    s.close = function (code) {
      if (s.readyState === 3) return;
      s.readyState = 3;
      emit('close', { code: code || 1000, wasClean: true });
    };
    /* test controls */
    s.open = function () { s.readyState = 1; emit('open', {}); };
    s.receive = function (data) { emit('message', { data: typeof data === 'string' ? data : JSON.stringify(data) }); };
    s.drop = function (code) { s.readyState = 3; emit('close', { code: code || 1006, wasClean: false }); };
    s.fail = function () { emit('error', {}); };
    s.listenerCount = function () {
      var n = 0;
      Object.keys(handlers).forEach(function (k) { n += handlers[k].length + (typeof s['on' + k] === 'function' ? 1 : 0); });
      return n;
    };
    return s;
  }

  /** BroadcastChannel look-alike: messages reach every OTHER channel with the same name (async, like the real one). */
  function createFakeChannelHub() {
    var channels = [];
    return {
      channel: function (name) {
        var listeners = [];
        var ch = { name: name, closed: false, onmessage: null };
        ch.postMessage = function (data) {
          if (ch.closed) throw new Error('InvalidStateError: channel is closed');
          var copy = typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data));
          channels.forEach(function (other) {
            if (other === ch || other.closed || other.name !== name) return;
            queueMicrotask(function () { if (!other.closed) other._deliver({ data: copy }); });
          });
        };
        ch._deliver = function (ev) {
          if (typeof ch.onmessage === 'function') ch.onmessage(ev);
          listeners.slice().forEach(function (f) { f(ev); });
        };
        ch.addEventListener = function (t, f) { if (t === 'message') listeners.push(f); };
        ch.removeEventListener = function (t, f) { listeners = listeners.filter(function (x) { return x !== f; }); };
        ch.close = function () { ch.closed = true; };
        channels.push(ch);
        return ch;
      },
      open: function () { return channels.filter(function (c) { return !c.closed; }).length; },
    };
  }

  /** Two entangled MessagePort look-alikes (like `new MessageChannel()`), e.g. to wire a worker client to a worker server. */
  function createFakePorts() {
    function port() {
      var p = { onmessage: null, other: null, closed: false, posted: [] };
      p.postMessage = function (data) {
        if (p.closed) return;
        p.posted.push(data);
        var copy = typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data));
        queueMicrotask(function () {
          if (p.other && !p.other.closed && typeof p.other.onmessage === 'function') p.other.onmessage({ data: copy });
        });
      };
      p.close = function () { p.closed = true; };
      return p;
    }
    var a = port(), b = port();
    a.other = b; b.other = a;
    return [a, b];
  }

  async function flushPromises() { for (var i = 0; i < 12; i++) await Promise.resolve(); }

  /* ───────────── run ───────────── */

  function evalModule(code, requireFn, label) {
    var module = { exports: {} };
    var fn = new Function('module', 'exports', 'require', code + '\n//# sourceURL=' + label);
    fn(module, module.exports, requireFn);
    return module.exports;
  }

  function errorText(e) {
    if (e && e.name === 'AssertionError') return e.message;
    if (e instanceof Error) return (e.name && e.name !== 'Error' ? e.name + ': ' : '') + e.message;
    return 'Threw ' + fmt(e);
  }

  async function run(opts) {
    var mode = opts.mode || 'js';
    var emit = opts.emit || function () {};
    var results = [];
    var realConsole = g.console;
    var logCount = 0;
    var patched = {};
    ['log', 'info', 'warn', 'error', 'debug'].forEach(function (level) {
      patched[level] = function () {
        if (logCount++ > 400) return;
        emit({ type: 'log', level: level, text: logFmt(Array.prototype.slice.call(arguments)) });
      };
    });
    g.console = Object.assign(Object.create(realConsole), patched);

    state = freshState();
    state.testTimeout = opts.testTimeout || 2000;
    var registry = makeRegistry();
    var expect = makeExpect(mode);
    var kit = null;
    var savedGlobals = {};
    var report = function (extra) { return Object.assign({ tests: results }, extra || {}); };

    try {
      var req = makeReq(mode);
      if (mode === 'react') kit = createReactKit();

      // The test helpers are also put on globalThis while the run lasts, so a learner can write real
      // test code (expect, jest, render, screen...) inside functions that the hidden tests call.
      var base = Object.assign({
        describe: registry.describe, it: registry.it, test: registry.test, expect: expect, jest: jest,
        beforeEach: registry.beforeEach, afterEach: registry.afterEach,
        createFakeSocket: createFakeSocket, createFakeChannelHub: createFakeChannelHub, createFakePorts: createFakePorts,
        flushPromises: flushPromises,
      }, kit || {});
      Object.keys(base).forEach(function (n) {
        savedGlobals[n] = Object.getOwnPropertyDescriptor(g, n);
        try { Object.defineProperty(g, n, { value: base[n], configurable: true, writable: true }); } catch (e) { /* a read-only global stays as it is */ }
      });

      var userExports;
      try { userExports = evalModule(opts.userCode, req, 'solution.js'); }
      catch (e) { return report({ fatal: 'Your code threw while loading:\n' + errorText(e) }); }

      var missing = (opts.exports || []).filter(function (n) { return !(n in userExports); });
      if (missing.length) {
        return report({ fatal: 'Missing export' + (missing.length > 1 ? 's' : '') + ': ' + missing.map(function (m) { return '`' + m + '`'; }).join(', ') + '\nThe tests import these names from your code, so keep the `export` keyword.' });
      }

      var scope = Object.assign({}, base, userExports);
      delete scope.default;
      delete scope.__esModule;
      var names = Object.keys(scope).filter(function (n) { return /^[A-Za-z_$][\w$]*$/.test(n); });
      try {
        var testFn = new Function(names.concat(['require']).join(','), opts.testCode + '\n//# sourceURL=tests.js');
        testFn.apply(null, names.map(function (n) { return scope[n]; }).concat([req]));
      } catch (e) { return report({ fatal: 'The test file failed to load (this is a bug in the exercise):\n' + errorText(e) }); }

      var tests = collect(state.root, [], []);
      for (var i = 0; i < tests.length; i++) {
        var t = tests[i];
        var res = { name: t.name, suite: t.suite, status: 'pass' };
        emit({ type: 'start', name: t.suite.concat([t.name]).join(' › ') });
        var t0 = realDateNow();
        if (t.node.skip) { res.status = 'skip'; }
        else {
          var hooks = chain(t.node);
          try {
            for (var h = 0; h < hooks.length; h++) for (var b = 0; b < hooks[h].beforeEach.length; b++) await withTimeout(hooks[h].beforeEach[b], state.testTimeout, 'beforeEach');
            await withTimeout(t.node.fn, state.testTimeout);
          } catch (e) {
            res.status = 'fail';
            res.error = errorText(e);
          }
          try {
            for (var h2 = hooks.length - 1; h2 >= 0; h2--) for (var a = 0; a < hooks[h2].afterEach.length; a++) await withTimeout(hooks[h2].afterEach[a], state.testTimeout, 'afterEach');
          } catch (e2) {
            if (res.status === 'pass') { res.status = 'fail'; res.error = errorText(e2); }
          }
          try {
            useRealTimers();
            jest.restoreAllMocks();
            reactCleanups.forEach(function (c) { c(); });
          } catch (e3) { /* cleanup is best effort */ }
        }
        res.ms = realDateNow() - t0;
        results.push(res);
        emit({ type: 'test', result: res });
      }
      if (!tests.length) return report({ fatal: 'The exercise has no tests (this is a bug in the exercise).' });
      return report();
    } finally {
      useRealTimers();
      reactCleanups.length = 0;
      Object.keys(savedGlobals).forEach(function (n) {
        try {
          if (savedGlobals[n]) Object.defineProperty(g, n, savedGlobals[n]);
          else delete g[n];
        } catch (e) { /* best effort */ }
      });
      g.console = realConsole;
    }
  }

  g.__whetstone = { run: run, fmt: fmt, mount: mount };
})(globalThis);
