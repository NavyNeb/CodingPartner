import { createServer, type IncomingMessage, type RequestListener, type ServerResponse } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize as pnormalize, resolve, sep } from 'node:path';
import type { Db } from './db.ts';
import {
  SECURITY_HEADERS, createLimiter, newId, newRecoveryCode, newToken, normalizeCode, sha256,
} from './security.ts';
import { merge, normalize, sameState, validate, type SyncState } from '../src/lib/syncMerge.ts';

export interface AppOptions {
  db: Db;
  /** Directory holding the built site (vite build output). Omit to serve the API only. */
  distDir?: string;
  /** Read the client IP from X-Forwarded-For (only behind a proxy you trust). */
  trustProxy?: boolean;
  now?: () => number;
  /** Disable rate limits (tests that hammer the API on purpose turn them on explicitly). */
  limits?: { create: number; recover: number; api: number };
}

const SYNC_MAX_BYTES = 256 * 1024;
const SHARE_MAX_BYTES = 64 * 1024;
const MAX_SHARES_PER_PROFILE = 25;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function createApp(opts: AppOptions): RequestListener {
  const { db } = opts;
  const now = opts.now ?? Date.now;
  const lim = opts.limits ?? { create: 10, recover: 10, api: 240 };
  const createLimit = createLimiter(lim.create, 60 * 60_000, now);
  const recoverLimit = createLimiter(lim.recover, 15 * 60_000, now);
  const apiLimit = createLimiter(lim.api, 60_000, now);

  const q = {
    insertProfile: db.prepare('INSERT INTO profiles (id, recovery_hash, created_at, updated_at) VALUES (?, ?, ?, ?)'),
    insertToken: db.prepare('INSERT INTO tokens (hash, profile_id, created_at, last_used) VALUES (?, ?, ?, ?)'),
    profileByToken: db.prepare('SELECT p.id, p.version, p.state, p.created_at FROM tokens t JOIN profiles p ON p.id = t.profile_id WHERE t.hash = ?'),
    touchToken: db.prepare('UPDATE tokens SET last_used = ? WHERE hash = ?'),
    profileByRecovery: db.prepare('SELECT id FROM profiles WHERE recovery_hash = ?'),
    setState: db.prepare('UPDATE profiles SET state = ?, version = ?, updated_at = ? WHERE id = ?'),
    deleteToken: db.prepare('DELETE FROM tokens WHERE hash = ?'),
    deleteOtherTokens: db.prepare('DELETE FROM tokens WHERE profile_id = ? AND hash != ?'),
    deleteProfile: db.prepare('DELETE FROM profiles WHERE id = ?'),
    countTokens: db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE profile_id = ?'),
    insertShare: db.prepare('INSERT INTO shares (id, profile_id, kind, created_at, payload) VALUES (?, ?, ?, ?, ?)'),
    getShare: db.prepare('SELECT id, kind, created_at, payload FROM shares WHERE id = ?'),
    listShares: db.prepare('SELECT id, kind, created_at FROM shares WHERE profile_id = ? ORDER BY created_at DESC'),
    deleteShare: db.prepare('DELETE FROM shares WHERE id = ? AND profile_id = ?'),
    countShares: db.prepare('SELECT COUNT(*) AS n FROM shares WHERE profile_id = ?'),
  };

  function send(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...SECURITY_HEADERS,
      ...extra,
    });
    res.end(text);
  }

  function readBody(req: IncomingMessage, max: number): Promise<unknown> {
    return new Promise((resolveBody, reject) => {
      const declared = Number(req.headers['content-length'] ?? 0);
      if (declared > max) { reject(new HttpError(413, 'Request body too large')); req.resume(); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > max) { reject(new HttpError(413, 'Request body too large')); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (size === 0) return resolveBody({});
        try { resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new HttpError(400, 'Body must be valid JSON')); }
      });
      req.on('error', reject);
    });
  }

  const ipOf = (req: IncomingMessage) => {
    if (opts.trustProxy) {
      const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
      if (fwd) return fwd;
    }
    return req.socket.remoteAddress ?? 'unknown';
  };

  interface Auth { profileId: string; tokenHash: string; version: number; state: SyncState; createdAt: number }
  function authenticate(req: IncomingMessage): Auth {
    const header = String(req.headers.authorization ?? '');
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(header);
    if (!m) throw new HttpError(401, 'Missing or malformed token');
    const tokenHash = sha256(m[1]);
    const row = q.profileByToken.get(tokenHash) as { id: string; version: number; state: string; created_at: number } | undefined;
    if (!row) throw new HttpError(401, 'Unknown token');
    q.touchToken.run(now(), tokenHash);
    return { profileId: row.id, tokenHash, version: row.version, state: normalize(JSON.parse(row.state)), createdAt: row.created_at };
  }

  function issueToken(profileId: string): string {
    const token = newToken();
    q.insertToken.run(sha256(token), profileId, now(), now());
    return token;
  }

  async function api(req: IncomingMessage, res: ServerResponse, path: string) {
    const method = req.method ?? 'GET';
    const ip = ipOf(req);

    if (path === '/api/health' && method === 'GET') return send(res, 200, { ok: true, service: 'whetstone', sync: true });

    if (!apiLimit(ip)) throw new HttpError(429, 'Too many requests, slow down');

    if (path === '/api/profile' && method === 'POST') {
      if (!createLimit(ip)) throw new HttpError(429, 'Too many profiles created from this address');
      const code = newRecoveryCode();
      const id = newId(16);
      q.insertProfile.run(id, sha256(normalizeCode(code)), now(), now());
      return send(res, 201, { token: issueToken(id), recoveryCode: code });
    }

    if (path === '/api/recover' && method === 'POST') {
      if (!recoverLimit(ip)) throw new HttpError(429, 'Too many attempts, try again later');
      const body = (await readBody(req, 2048)) as { code?: unknown; revokeOthers?: unknown };
      if (typeof body.code !== 'string') throw new HttpError(400, 'code is required');
      const normalized = normalizeCode(body.code);
      const row = normalized.length === 24 ? q.profileByRecovery.get(sha256(normalized)) as { id: string } | undefined : undefined;
      if (!row) throw new HttpError(404, 'That recovery code does not match any profile');
      const token = issueToken(row.id);
      if (body.revokeOthers === true) q.deleteOtherTokens.run(row.id, sha256(token));
      return send(res, 200, { token });
    }

    const publicShare = /^\/api\/share\/([a-z0-9]{6,32})$/.exec(path);
    if (publicShare && method === 'GET') {
      const row = q.getShare.get(publicShare[1]) as { id: string; kind: string; created_at: number; payload: string } | undefined;
      if (!row) throw new HttpError(404, 'This share link does not exist (it may have been deleted)');
      return send(res, 200, { id: row.id, kind: row.kind, createdAt: row.created_at, payload: JSON.parse(row.payload) },
        { 'Cache-Control': 'public, max-age=60' });
    }

    // Everything below needs a valid token.
    const auth = authenticate(req);

    if (path === '/api/me' && method === 'GET') {
      const tokens = (q.countTokens.get(auth.profileId) as { n: number }).n;
      return send(res, 200, { createdAt: auth.createdAt, version: auth.version, devices: tokens });
    }
    if (path === '/api/me' && method === 'DELETE') {
      q.deleteProfile.run(auth.profileId);
      return send(res, 200, { deleted: true });
    }
    if (path === '/api/logout' && method === 'POST') {
      q.deleteToken.run(auth.tokenHash);
      return send(res, 200, { ok: true });
    }

    if (path === '/api/sync' && method === 'GET') return send(res, 200, { version: auth.version, state: auth.state });
    if (path === '/api/sync' && method === 'PUT') {
      const body = (await readBody(req, SYNC_MAX_BYTES)) as { state?: unknown };
      const problem = validate(body.state);
      if (problem) throw new HttpError(400, problem);
      // Merging on the server makes concurrent writers safe: the merge is commutative and idempotent,
      // so two devices pushing at once both end up in the stored state, whichever lands first.
      const merged = merge(auth.state, body.state as SyncState);
      if (sameState(merged, auth.state)) return send(res, 200, { version: auth.version, state: merged });
      const text = JSON.stringify(merged);
      if (Buffer.byteLength(text) > SYNC_MAX_BYTES * 2) throw new HttpError(413, 'Stored progress would be too large');
      const version = auth.version + 1;
      q.setState.run(text, version, now(), auth.profileId);
      return send(res, 200, { version, state: merged });
    }

    if (path === '/api/export' && method === 'GET') {
      const shares = q.listShares.all(auth.profileId);
      return send(res, 200, { exportedAt: now(), state: auth.state, shares },
        { 'Content-Disposition': 'attachment; filename="whetstone-export.json"' });
    }

    if (path === '/api/share' && method === 'GET') {
      const rows = q.listShares.all(auth.profileId) as { id: string; kind: string; created_at: number }[];
      return send(res, 200, { shares: rows.map((r) => ({ id: r.id, kind: r.kind, createdAt: r.created_at })) });
    }
    if (path === '/api/share' && method === 'POST') {
      const body = (await readBody(req, SHARE_MAX_BYTES)) as { kind?: unknown; payload?: unknown };
      if (body.kind !== 'progress' && body.kind !== 'mock') throw new HttpError(400, 'kind must be "progress" or "mock"');
      if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) throw new HttpError(400, 'payload must be an object');
      if ((q.countShares.get(auth.profileId) as { n: number }).n >= MAX_SHARES_PER_PROFILE) {
        throw new HttpError(409, `You can keep at most ${MAX_SHARES_PER_PROFILE} share links; delete an old one first`);
      }
      const id = newId(10);
      q.insertShare.run(id, auth.profileId, body.kind, now(), JSON.stringify(body.payload));
      return send(res, 201, { id });
    }
    const del = /^\/api\/share\/([a-z0-9]{6,32})$/.exec(path);
    if (del && method === 'DELETE') {
      const r = q.deleteShare.run(del[1], auth.profileId);
      if (!r.changes) throw new HttpError(404, 'No such share link');
      return send(res, 200, { deleted: true });
    }

    throw new HttpError(404, 'Not found');
  }

  const dist = opts.distDir ? resolve(opts.distDir) : undefined;

  function serveStatic(req: IncomingMessage, res: ServerResponse, path: string) {
    if (!dist || (req.method !== 'GET' && req.method !== 'HEAD')) return send(res, 404, { error: 'Not found' });
    let rel: string;
    try { rel = decodeURIComponent(path); } catch { return send(res, 400, { error: 'Bad path' }); }
    let file = pnormalize(join(dist, rel));
    if (file !== dist && !file.startsWith(dist + sep)) return send(res, 403, { error: 'Forbidden' });
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
    if (!existsSync(file)) return send(res, 404, { error: 'Site not built. Run `npm run build` first.' });
    const ext = extname(file);
    const immutable = file.includes(`${sep}assets${sep}`);
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      ...SECURITY_HEADERS,
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  }

  return async (req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;
    try {
      if (path.startsWith('/api/')) return await api(req, res, path);
      return serveStatic(req, res, path);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message });
      console.error('Unhandled error:', (err as Error).message); // never log request bodies or tokens
      return send(res, 500, { error: 'Something went wrong on the server' });
    }
  };
}

export function listen(opts: AppOptions, port: number, host = '0.0.0.0') {
  const server = createServer(createApp(opts));
  server.headersTimeout = 15_000;
  server.requestTimeout = 20_000;
  return new Promise<typeof server>((ok) => server.listen(port, host, () => ok(server)));
}
