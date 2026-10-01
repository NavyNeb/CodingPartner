import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U

/** 24 characters x 5 bits = 120 bits of entropy, shown as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX. */
export function newRecoveryCode(): string {
  const bytes = randomBytes(24);
  let out = '';
  for (let i = 0; i < 24; i++) out += ALPHABET[bytes[i] & 31];
  return out.match(/.{4}/g)!.join('-');
}

/** Accept what people actually type: lower case, spaces, dashes, O for 0, I/L for 1. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
}

export const newToken = () => randomBytes(32).toString('base64url');
export const newId = (len = 10) => {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] & 31].toLowerCase();
  return out;
};

/** Sliding-window limiter, in memory (fine for one process, which is what SQLite implies). */
export function createLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let sweep = now();
  return (key: string): boolean => {
    const t = now();
    if (t - sweep > windowMs) {
      for (const [k, v] of hits) if (v[v.length - 1] <= t - windowMs) hits.delete(k);
      sweep = t;
    }
    const recent = (hits.get(key) ?? []).filter((x) => x > t - windowMs);
    if (recent.length >= max) { hits.set(key, recent); return false; }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  // The runner executes user code in blob/srcdoc iframes and workers, so those must stay allowed.
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "frame-src 'self' blob: about:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; '),
};
