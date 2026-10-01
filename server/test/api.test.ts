import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.ts';
import { openDb } from '../db.ts';
import { merge, emptySync, type SyncState } from '../../src/lib/syncMerge.ts';

let server: Server;
let base: string;
const db = openDb(':memory:');

before(async () => {
  server = createServer(createApp({ db, limits: { create: 1000, recover: 1000, api: 100000 } }));
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); db.close(); });

async function call(method: string, path: string, opts: { token?: string; body?: unknown; raw?: string } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}), ...(opts.body || opts.raw ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
  });
  const text = await res.text();
  let json: any; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}
const newProfile = async () => (await call('POST', '/api/profile')).json as { token: string; recoveryCode: string };
const state = (over: Partial<SyncState>): SyncState => ({ ...emptySync(), ...over });

describe('profiles', () => {
  it('health is open and security headers are set', async () => {
    const r = await call('GET', '/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.json.ok, true);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.match(r.headers.get('content-security-policy')!, /frame-ancestors 'none'/);
  });

  it('creates a profile with a 24-char recovery code and stores only hashes', async () => {
    const p = await newProfile();
    assert.match(p.recoveryCode, /^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/);
    const rows = db.prepare('SELECT recovery_hash FROM profiles').all() as { recovery_hash: string }[];
    assert.ok(rows.every((r) => r.recovery_hash.length === 64));
    const tokens = db.prepare('SELECT hash FROM tokens').all() as { hash: string }[];
    assert.ok(!tokens.some((t) => t.hash === p.token));
    assert.ok(!JSON.stringify(rows).includes(p.recoveryCode));
  });

  it('recovers with a sloppy code (lowercase, spaces, O/0) and rejects a wrong one', async () => {
    const p = await newProfile();
    const sloppy = p.recoveryCode.toLowerCase().replaceAll('-', ' ').replaceAll('0', 'o');
    const ok = await call('POST', '/api/recover', { body: { code: sloppy } });
    assert.equal(ok.status, 200);
    assert.notEqual(ok.json.token, p.token);
    const bad = await call('POST', '/api/recover', { body: { code: '0000-0000-0000-0000-0000-0000' } });
    assert.equal(bad.status, 404);
    const junk = await call('POST', '/api/recover', { body: { code: 42 } });
    assert.equal(junk.status, 400);
  });

  it('revokeOthers invalidates earlier tokens', async () => {
    const p = await newProfile();
    const r = await call('POST', '/api/recover', { body: { code: p.recoveryCode, revokeOthers: true } });
    assert.equal((await call('GET', '/api/me', { token: p.token })).status, 401);
    assert.equal((await call('GET', '/api/me', { token: r.json.token })).status, 200);
  });

  it('rejects missing, malformed and unknown tokens', async () => {
    assert.equal((await call('GET', '/api/sync')).status, 401);
    assert.equal((await call('GET', '/api/sync', { token: 'short' })).status, 401);
    assert.equal((await call('GET', '/api/sync', { token: 'x'.repeat(43) })).status, 401);
  });

  it('logout removes just that device; delete removes everything', async () => {
    const p = await newProfile();
    const other = (await call('POST', '/api/recover', { body: { code: p.recoveryCode } })).json.token;
    assert.equal((await call('POST', '/api/logout', { token: p.token })).status, 200);
    assert.equal((await call('GET', '/api/me', { token: p.token })).status, 401);
    assert.equal((await call('DELETE', '/api/me', { token: other })).status, 200);
    assert.equal((await call('POST', '/api/recover', { body: { code: p.recoveryCode } })).status, 404);
  });
});

describe('sync', () => {
  it('starts empty, stores a push and bumps the version only on change', async () => {
    const p = await newProfile();
    const first = (await call('GET', '/api/sync', { token: p.token })).json;
    assert.equal(first.version, 0);
    const s = state({ solved: { a: { at: 10, assisted: false } } });
    const put = await call('PUT', '/api/sync', { token: p.token, body: { state: s } });
    assert.equal(put.json.version, 1);
    const again = await call('PUT', '/api/sync', { token: p.token, body: { state: s } });
    assert.equal(again.json.version, 1, 'an identical push must not bump the version');
  });

  it('two devices pushing different things both survive (server-side merge)', async () => {
    const a = await newProfile();
    const bToken = (await call('POST', '/api/recover', { body: { code: a.recoveryCode } })).json.token;
    const sa = state({ solved: { x: { at: 5, assisted: true } }, hints: { x: 1 } });
    const sb = state({ solved: { y: { at: 6, assisted: false }, x: { at: 9, assisted: false } }, hints: { x: 3 }, checks: { c1: true } });
    await call('PUT', '/api/sync', { token: a.token, body: { state: sa } });
    const r = await call('PUT', '/api/sync', { token: bToken, body: { state: sb } });
    const got = r.json.state as SyncState;
    assert.deepEqual(Object.keys(got.solved).sort(), ['x', 'y']);
    assert.equal(got.solved.x.at, 5, 'earliest solve wins');
    assert.equal(got.solved.x.assisted, false, 'assisted only if both were assisted');
    assert.equal(got.hints.x, 3);
    assert.ok(got.checks.c1);
    const pulled = (await call('GET', '/api/sync', { token: a.token })).json.state;
    assert.deepEqual(pulled, got);
  });

  it('validates bodies and enforces the size cap', async () => {
    const p = await newProfile();
    assert.equal((await call('PUT', '/api/sync', { token: p.token, body: { state: 5 } })).status, 400);
    assert.equal((await call('PUT', '/api/sync', { token: p.token, body: { state: { drafts: { a: 1 } } } })).status, 400);
    assert.equal((await call('PUT', '/api/sync', { token: p.token, raw: '{oops' })).status, 400);
    const big = { state: state({ drafts: { a: 'x'.repeat(300 * 1024) } }) };
    assert.equal((await call('PUT', '/api/sync', { token: p.token, body: big })).status, 413);
  });

  it('a reset (higher epoch) replaces old progress everywhere', async () => {
    const p = await newProfile();
    await call('PUT', '/api/sync', { token: p.token, body: { state: state({ solved: { a: { at: 1, assisted: false } } }) } });
    const r = await call('PUT', '/api/sync', { token: p.token, body: { state: state({ epoch: 1 }) } });
    assert.deepEqual(r.json.state.solved, {});
    // a stale device still on epoch 0 cannot bring the old data back
    const stale = await call('PUT', '/api/sync', { token: p.token, body: { state: state({ solved: { a: { at: 1, assisted: false } } }) } });
    assert.deepEqual(stale.json.state.solved, {});
    assert.equal(stale.json.state.epoch, 1);
  });

  it('export returns the stored state', async () => {
    const p = await newProfile();
    await call('PUT', '/api/sync', { token: p.token, body: { state: state({ checks: { z: true } }) } });
    const r = await call('GET', '/api/export', { token: p.token });
    assert.ok(r.json.state.checks.z);
    assert.match(r.headers.get('content-disposition')!, /attachment/);
  });
});

describe('merge properties', () => {
  const samples: SyncState[] = [
    state({ solved: { a: { at: 3, assisted: true } }, drafts: { a: 'one' }, draftAt: { a: 5 }, hints: { a: 1 } }),
    state({ solved: { a: { at: 2, assisted: false }, b: { at: 9, assisted: true } }, drafts: { a: 'two' }, draftAt: { a: 7 }, hints: { a: 2 }, checks: { k: true } }),
    state({ draftAt: { a: 7 }, drafts: {}, attempts: [{ id: '1', ex: 'a', at: 1, passed: 1, total: 2, assisted: false, ms: 10 }] }),
    state({ drafts: { a: 'tie-b' }, draftAt: { a: 7 }, attempts: [{ id: '1', ex: 'a', at: 1, passed: 1, total: 2, assisted: false, ms: 10 }, { id: '2', ex: 'b', at: 4, passed: 2, total: 2, assisted: false, ms: 20 }] }),
  ];
  it('is commutative, associative and idempotent', () => {
    for (const a of samples) for (const b of samples) {
      assert.deepEqual(merge(a, b), merge(b, a));
      assert.deepEqual(merge(merge(a, b), b), merge(a, b));
      for (const c of samples) assert.deepEqual(merge(merge(a, b), c), merge(a, merge(b, c)));
    }
  });
  it('a newer removal of a draft beats an older draft', () => {
    const m = merge(samples[0], samples[2]);
    assert.equal('a' in m.drafts, false);
  });
});

describe('shares', () => {
  it('creates a public snapshot, lists it for the owner, and deletes it', async () => {
    const p = await newProfile();
    const other = await newProfile();
    const c = await call('POST', '/api/share', { token: p.token, body: { kind: 'mock', payload: { score: 80, note: '<script>alert(1)</script>' } } });
    assert.equal(c.status, 201);
    const pub = await call('GET', `/api/share/${c.json.id}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.json.payload.score, 80);
    assert.ok(!JSON.stringify(pub.json).includes(p.token));
    assert.equal((await call('GET', '/api/share', { token: p.token })).json.shares.length, 1);
    assert.equal((await call('DELETE', `/api/share/${c.json.id}`, { token: other.token })).status, 404, 'others cannot delete it');
    assert.equal((await call('DELETE', `/api/share/${c.json.id}`, { token: p.token })).status, 200);
    assert.equal((await call('GET', `/api/share/${c.json.id}`)).status, 404);
  });
  it('validates kind and payload, and caps size and count', async () => {
    const p = await newProfile();
    assert.equal((await call('POST', '/api/share', { token: p.token, body: { kind: 'x', payload: {} } })).status, 400);
    assert.equal((await call('POST', '/api/share', { token: p.token, body: { kind: 'mock', payload: [] } })).status, 400);
    assert.equal((await call('POST', '/api/share', { token: p.token, body: { kind: 'mock', payload: { t: 'x'.repeat(70000) } } })).status, 413);
    for (let i = 0; i < 25; i++) assert.equal((await call('POST', '/api/share', { token: p.token, body: { kind: 'progress', payload: { i } } })).status, 201);
    assert.equal((await call('POST', '/api/share', { token: p.token, body: { kind: 'progress', payload: {} } })).status, 409);
  });
  it('requires auth to create', async () => {
    assert.equal((await call('POST', '/api/share', { body: { kind: 'mock', payload: {} } })).status, 401);
  });
});

describe('rate limits and static files', () => {
  it('limits profile creation per address', async () => {
    const db2 = openDb(':memory:');
    const s = createServer(createApp({ db: db2, limits: { create: 3, recover: 3, api: 1000 } }));
    await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(url + '/api/profile', { method: 'POST' })).status);
    assert.deepEqual(codes, [201, 201, 201, 429, 429]);
    const rec: number[] = [];
    for (let i = 0; i < 5; i++) rec.push((await fetch(url + '/api/recover', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'nope' }) })).status);
    assert.deepEqual(rec.slice(3), [429, 429]);
    s.close(); db2.close();
  });
  it('does not serve files outside dist and falls back to index.html', async () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'ws-'));
    mkdirSync(join(root, 'dist', 'assets'), { recursive: true });
    writeFileSync(join(root, 'dist', 'index.html'), '<h1>home</h1>');
    writeFileSync(join(root, 'secret.txt'), 'nope');
    const db3 = openDb(':memory:');
    const s = createServer(createApp({ db: db3, distDir: join(root, 'dist') }));
    await new Promise<void>((ok) => s.listen(0, '127.0.0.1', ok));
    const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
    assert.equal(await (await fetch(url + '/some/route')).text(), '<h1>home</h1>');
    const esc = await fetch(url + '/..%2Fsecret.txt');
    assert.notEqual(await esc.text(), 'nope');
    s.close(); db3.close();
  });
});
