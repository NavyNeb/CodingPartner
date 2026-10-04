---
id: sec-auth
track: sec
title: Passwords, sessions & tokens
summary: How to prove who someone is and keep them proven: storing passwords safely, comparing secrets in constant time, session identifiers with idle and absolute timeouts, rotation against fixation, and verifying signed tokens without falling for the algorithm trick.
---

## The idea in one sentence

**Authentication** asks "who are you?" once, then hands out a **short-lived, unguessable proof** (a session id or token) that you can **check, expire and revoke**, while **never keeping the original secret** in a usable form.

> **Analogy** A concert wristband. At the door you show your ticket once (the password). They give you a wristband: hard to forge, valid only tonight, and cuttable at any time if you misbehave. Staff look at the wristband, not your ticket, and they never keep a copy of your ticket number where thieves could find it.

## Passwords: store a slow hash, never the password

![Password storage](fig:sec-password-storage "The salt makes identical passwords different; the slow hash makes guessing expensive.")

- **Never store passwords** (or anything reversible). If the database leaks, every account leaks.
- A **fast hash** (SHA-256) is the wrong tool: attackers try billions of guesses per second. Use a **deliberately slow, salted** password hash: **Argon2**, **scrypt**, **bcrypt** or **PBKDF2**, from a vetted library.
- A **salt** is random, per-user, stored beside the hash. It makes identical passwords hash differently and kills precomputed tables.
- **Length beats complexity.** Modern guidance (NIST) says: require a decent **minimum length**, **block common and breached** passwords, don't force silly composition rules, and don't make users rotate passwords for no reason. Rate-limit and monitor login attempts.

```js try predict
// Entropy estimate: length x log2(size of the character pool)
function entropyBits(pw) {
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  return pw.length * Math.log2(pool || 1);
}
console.log(entropyBits('P@ssw0rd!').toFixed(1), 'bits   (but it is a famous password!)');
console.log(entropyBits('correct horse battery staple').toFixed(1), 'bits');
```

Entropy estimates assume random choice, so they **overestimate human-chosen** passwords: a blocklist of common ones matters more than a formula.

### Compare secrets in constant time

`a === b` stops at the **first different character**, so how long it takes leaks **how many characters matched**. For secrets (tokens, MACs, API keys) compare in a way that always looks at **everything**:

```js
function timingSafeEqual(a, b) {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);   // accumulate, never exit early
  return diff === 0;
}
```

In Node use `crypto.timingSafeEqual`; this shows the idea.

## Sessions: a random id that points at server-side state

![The session lifecycle](fig:sec-session "Two clocks, rotation at login, and real logout means destroying the server-side record.")

- The cookie holds **only a long random id** (128+ bits from a secure random source). The data lives on the **server**.
- **Rotate the id at login** (and on privilege changes) so an id an attacker planted beforehand is useless: that attack is **session fixation**.
- **Two timeouts**: an **idle** timeout (slides on activity) and an **absolute** lifetime (never extended, even by activity or rotation).
- **Logout destroys the server-side record.** Deleting the cookie only hides it. Changing a password should destroy the user's **other** sessions.

## Tokens: signed, readable, and easy to verify wrongly

A signed token (like a **JWT**) carries claims and a signature, so a server can verify it **without a lookup**. The cost: **you can't revoke it** before it expires (keep lifetimes short, or keep a denylist).

![The anatomy of a signed token](fig:sec-jwt "Header and payload are only encoded. The signature is what makes them trustworthy.")

```stepper Verifying a token the right way
code:
  function verify(token, { secret, now, issuer, audience }) {
    const { header, payload, signature, signingInput } = parse(token);
    if (header.alg !== 'HS256') throw new Error('unsupported algorithm');
    if (!timingSafeEqual(signature, hmac(secret, signingInput))) throw new Error('bad signature');
    if (payload.exp === undefined) throw new Error('missing exp');
    if (now >= payload.exp) throw new Error('token expired');
    if (payload.iss !== issuer) throw new Error('wrong issuer');
    if (![].concat(payload.aud).includes(audience)) throw new Error('wrong audience');
    return payload;
  }
---
line: 3
say: **Pin the algorithm.** The header is attacker-controlled. If you let it choose, `"alg": "none"` means "no signature needed", and an `HS256`/`RS256` mix-up can make a public key act as a secret. **Your server decides the allowed algorithm**, never the token.
header.alg: "HS256" (expected)
---
line: 4
say: **Check the signature** by recomputing it with **your** secret over the exact signed text and comparing in **constant time**. Anything altered in the payload makes this fail.
signature: matches
---
line: 5
say: **Expiry must exist** and be enforced. A token without `exp` that you treat as valid is valid forever.
payload.exp: 2000
---
line: 6
say: Compare with the clock using `>=`: at the **exact** expiry second the token is over. (Allow a few seconds of leeway for clock drift if you must, but deliberately.)
now: 1000 → ok
---
line: 7
say: **Issuer and audience** stop a token minted for another service or another API from working here. Audience can be a string or a list, and must match **exactly**, not as a substring (`"api-admin"` is not `"api"`).
iss/aud: match
```

## Quick check

```check
Q: Why is SHA-256 alone a bad way to store passwords?
A) It is too slow
B) It is far too fast: attackers can test billions of guesses per second *
C) It is reversible
D) It needs a key
Why: Password hashes must be deliberately slow and salted (Argon2, bcrypt, scrypt, PBKDF2).
---
Q: What does a per-user salt achieve?
A) Encrypts the hash
B) Makes identical passwords hash differently and defeats precomputed tables *
C) Makes the hash reversible
D) Speeds up login
Why: Each user's hash must be attacked separately.
---
Q: Why rotate the session id at login?
A) Memory
B) An id planted by an attacker before login (fixation) becomes useless *
C) To log users out
D) To shorten the cookie
Why: The pre-login id is replaced by a fresh, unknown one.
---
Q: Which is the real logout?
A) Deleting the cookie in the browser
B) Destroying the session record on the server *
C) Redirecting to /login
D) Clearing localStorage
Why: A copied cookie keeps working until the server forgets the session.
---
Q: What is the danger of trusting the `alg` field in a token header?
A) None
B) The attacker chooses it: `none` (no signature) or a confused algorithm can bypass verification *
C) It is slow
D) Headers are encrypted
Why: The server must decide which algorithm to accept.
```

## Recap

- **Passwords**: salted, slow hash from a vetted library; length and blocklists beat composition rules; never store or log them.
- **Constant-time comparison** for every secret.
- **Sessions**: random id, server-side state, **rotate** at login, **idle + absolute** timeouts, real logout.
- **Tokens**: pin the algorithm, verify the signature, **require and check** `exp`, `nbf`, `iss`, `aud` exactly.
- Payloads are **readable**: never put secrets in them.

## Before you start the exercises

| Exercise | You'll need |
| --- | --- |
| Guided: constant-time compare | A loop with an accumulator, no early return |
| A password policy | Rules that return problems; a blocklist; entropy maths |
| Token parsing and verification | Manual base64url, `JSON.parse` with checks, an injected `hmac` |
| A session store | Injected clock and random; two timeouts; rotation |
| Tests for token verification | Tokens you forge on purpose, one per flaw |

%% exercise sec-guided-compare | Guided: constant-time compare | 1 | js | js | timingSafeEqual | 8 | guided
Implement `timingSafeEqual(a, b)` for comparing **secret strings**. It returns `true` only if both are strings with identical content. It must **not stop early**: it examines every position up to the longer length, accumulating differences, and decides at the end. Anything that isn't a pair of strings gives `false`.

```js
timingSafeEqual('s3cret', 's3cret'); // true
timingSafeEqual('s3cret', 's3cree'); // false (but it looked at every character)
```

%% worked
**A similar problem, solved: `sameBytes(a, b)`** — compare two arrays of numbers without an early exit.

```js
export function sameBytes(a, b) {
  let diff = a.length ^ b.length;                    // ① different lengths already count as a difference
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);               // ② XOR is 0 when equal; OR accumulates any difference
  }
  return diff === 0;                                 // ③ decide only at the end
}
```

The loop never `return`s or `break`s on a mismatch, so the time depends on the **length**, not on **where** the first difference is. (Unit tests can only check the **answers**; the timing property comes from how you wrote the loop.)

%% explain
- **Both must be strings**, otherwise `false`.
- **Loop over the longer length**; use `charCodeAt(i) || 0` for missing characters.
- **Accumulate** with XOR and OR; return `diff === 0` at the end.

%% nudge
- Why must the length difference be folded into the result instead of returned immediately?
- What does `'abc'.charCodeAt(10)` return?

%% starter
```js
export function timingSafeEqual(a, b) {
  // Step 1 — return false unless both are strings
  // Step 2 — let diff = a.length ^ b.length; loop to the longer length, diff |= (code a) ^ (code b)
  // Step 3 — return diff === 0
  return false;
}
```

%% tests
```js
describe('timingSafeEqual', () => {
  it('is true for equal strings', () => {
    expect(timingSafeEqual('s3cret', 's3cret')).toBe(true);
    expect(timingSafeEqual('', '')).toBe(true);
    expect(timingSafeEqual('héllo ✓', 'héllo ✓')).toBe(true);
  });
  it('is false when content differs in any position', () => {
    expect(timingSafeEqual('s3cret', 'x3cret')).toBe(false);
    expect(timingSafeEqual('s3cret', 's3cree')).toBe(false);
    expect(timingSafeEqual('s3cret', 's3xret')).toBe(false);
  });
  it('is false when lengths differ, even if one is a prefix', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false);
    expect(timingSafeEqual('abcd', 'abc')).toBe(false);
    expect(timingSafeEqual('', 'a')).toBe(false);
    expect(timingSafeEqual('a', '')).toBe(false);
  });
  it('treats a trailing NUL character as different from nothing', () => {
    expect(timingSafeEqual('abc', 'abc\0')).toBe(false);
    expect(timingSafeEqual('abc\0', 'abc')).toBe(false);
  });
  it('is false for non-strings', () => {
    expect(timingSafeEqual(1, 1)).toBe(false);
    expect(timingSafeEqual(null, null)).toBe(false);
    expect(timingSafeEqual(undefined, 'a')).toBe(false);
    expect(timingSafeEqual('a', {})).toBe(false);
  });
});
```

%% hints
- `let diff = a.length ^ b.length;`
- `diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);` inside a loop to `Math.max(a.length, b.length)`.
- Careful: a trailing `'\0'` has code 0, the same as "missing": the length XOR is what tells them apart.

%% solution
```js
export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}
```

%% exercise sec-password-policy | A password policy | 3 | js | js | checkPassword, estimateEntropy | 22
Implement two functions.

`checkPassword(password, { minLength = 12, user = {} } = {})` returns `{ ok, problems }`, where `problems` lists, **in this order**, each that applies:

1. `'too short'`: fewer than `minLength` characters.
2. `'too common'`: the lower-cased password is in the blocklist `password, 123456, 12345678, qwerty, letmein, iloveyou, admin, welcome, monkey, dragon`, **or** becomes one of them after removing **trailing** non-letters (so `Password123!` is common).
3. `'contains your name or email'`: the lower-cased password contains any word of `user.name` (split on whitespace) or the part of `user.email` before the `@`, ignoring parts shorter than 3 characters.
4. `'too repetitive'`: a **non-empty** password with fewer than **5 distinct characters**.

`ok` is true when there are no problems. A non-string password counts as empty.

`estimateEntropy(password)` returns `length × log2(pool)` rounded to **one decimal**, where the pool is `26` if it has a lowercase letter, `+26` for an uppercase letter, `+10` for a digit, `+33` for anything else; `0` for an empty password.

```js
checkPassword('Password123!'); // { ok: false, problems: ['too common'] }
```

%% worked
**A similar problem, solved: `checkUsername(name)`** — collect every problem, in a fixed order.

```js
export function checkUsername(name) {
  const problems = [];                                     // ① gather ALL the problems, don't stop at the first
  const s = String(name ?? '');
  if (s.length < 3) problems.push('too short');
  if (!/^[a-z0-9_]*$/i.test(s)) problems.push('invalid characters');
  if (['admin', 'root'].includes(s.toLowerCase())) problems.push('reserved');
  return { ok: problems.length === 0, problems };          // ② ok only when none were found
}
```

Reporting **all** problems at once is kinder than one-at-a-time. For the blocklist, test both the exact word **and** the word with trailing digits/symbols removed: users love `Password1!`.

%% explain
- **Four checks in a fixed order**; each pushes a message.
- **Common**: exact match or after stripping trailing non-letters.
- **Name/email**: words of 3+ characters, case-insensitive.
- **Entropy**: pool size from the character classes present.

%% nudge
- What regular expression removes trailing non-letters?
- Why ignore name parts shorter than 3 characters?

%% starter
```js
export function checkPassword(password, { minLength = 12, user = {} } = {}) {
  return { ok: false, problems: [] };
}

export function estimateEntropy(password) {
  return 0;
}
```

%% tests
```js
describe('checkPassword', () => {
  it('accepts a long, uncommon passphrase', () => {
    expect(checkPassword('correct horse battery staple')).toEqual({ ok: true, problems: [] });
  });
  it('flags short passwords', () => {
    expect(checkPassword('short1!')).toEqual({ ok: false, problems: ['too short'] });
    expect(checkPassword('abcde12345', { minLength: 8 }).ok).toBe(true);
    expect(checkPassword('abcde1234', { minLength: 10 }).problems).toEqual(['too short']);
  });
  it('flags common passwords, including decorated ones', () => {
    expect(checkPassword('password').problems).toEqual(['too short', 'too common']);
    expect(checkPassword('Password123!')).toEqual({ ok: false, problems: ['too common'] });
    expect(checkPassword('iloveyou2024!!').problems).toEqual(['too common']);
    expect(checkPassword('123456').problems).toEqual(['too short', 'too common']);
  });
  it('does not flag a common word inside a longer passphrase', () => {
    expect(checkPassword('my password is purple elephants').ok).toBe(true);
  });
  it('flags names and emails', () => {
    const user = { name: 'Ada Lovelace', email: 'ada.l@example.com' };
    expect(checkPassword('purple-LOVELACE-tractor', { user }).problems).toEqual(['contains your name or email']);
    expect(checkPassword('xxada.lxxyyzzqq1', { user }).problems).toEqual(['contains your name or email']);
    expect(checkPassword('purple-tractor-seven', { user }).ok).toBe(true);
  });
  it('ignores very short name parts', () => {
    expect(checkPassword('albo-tractor-purple-9', { user: { name: 'Al Bo' } }).ok).toBe(true);
  });
  it('flags repetitive passwords', () => {
    expect(checkPassword('aaaaaaaaaaaaaaaa')).toEqual({ ok: false, problems: ['too repetitive'] });
    expect(checkPassword('abababababab').problems).toEqual(['too repetitive']);
    expect(checkPassword('abcdeabcdeabcde').ok).toBe(true);
  });
  it('lists problems in a fixed order', () => {
    expect(checkPassword('admin', { user: { name: 'Admin Smith' } }).problems).toEqual(['too short', 'too common', 'contains your name or email']);
  });
  it('treats missing or non-string passwords as empty', () => {
    expect(checkPassword(undefined)).toEqual({ ok: false, problems: ['too short'] });
    expect(checkPassword(12345678901234).problems).toEqual([]);
    expect(checkPassword('').problems).toEqual(['too short']);
  });
});

describe('estimateEntropy', () => {
  it('is 0 for an empty password', () => {
    expect(estimateEntropy('')).toBe(0);
  });
  it('uses the character pool', () => {
    expect(estimateEntropy('abcdefgh')).toBe(37.6);
    expect(estimateEntropy('ABCD')).toBe(18.8);
    expect(estimateEntropy('1234')).toBe(13.3);
    expect(estimateEntropy('!!!!')).toBe(20.2);
    expect(estimateEntropy('aA')).toBe(11.4);
    expect(estimateEntropy('Abcdefg1!')).toBe(59.1);
  });
});
```

%% hints
- Common: `COMMON.includes(lower) || COMMON.includes(lower.replace(/[^a-z]+$/, ''))`.
- Name words: `[...name.toLowerCase().split(/\s+/), email.toLowerCase().split('@')[0]].filter((w) => w.length >= 3)`.
- Distinct characters: `new Set(pw).size`.
- Entropy: `Math.round(pw.length * Math.log2(pool) * 10) / 10`.

%% solution
```js
const COMMON = ['password', '123456', '12345678', 'qwerty', 'letmein', 'iloveyou', 'admin', 'welcome', 'monkey', 'dragon'];

export function checkPassword(password, { minLength = 12, user = {} } = {}) {
  const pw = typeof password === 'string' ? password : password == null ? '' : String(password);
  const problems = [];
  if (pw.length < minLength) problems.push('too short');
  const lower = pw.toLowerCase();
  if (COMMON.includes(lower) || COMMON.includes(lower.replace(/[^a-z]+$/, ''))) problems.push('too common');
  const words = [...String(user.name ?? '').toLowerCase().split(/\s+/), String(user.email ?? '').toLowerCase().split('@')[0]].filter((w) => w.length >= 3);
  if (words.some((w) => lower.includes(w))) problems.push('contains your name or email');
  if (pw.length > 0 && new Set(pw).size < 5) problems.push('too repetitive');
  return { ok: problems.length === 0, problems };
}

export function estimateEntropy(password) {
  const pw = String(password ?? '');
  if (pw === '') return 0;
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33;
  return Math.round(pw.length * Math.log2(pool) * 10) / 10;
}
```

%% exercise sec-jwt | Token parsing and verification | 4 | js | js | base64urlEncode, base64urlDecode, parseJwt, verifyToken | 40
Build the pieces of a **safe signed-token verifier**. (Signing itself is provided by an injected `hmac`, so no crypto library is needed.)

- `base64urlEncode(text)`: UTF-8 encode the text, then base64url (alphabet `A–Z a–z 0–9 - _`, **no padding**).
- `base64urlDecode(text)`: the reverse, returning the string. Characters outside the alphabet, or a length of `1 mod 4`, throw `Error('invalid base64url')`.
- `parseJwt(token)`: split on `.` into exactly three parts; header and payload must decode to **JSON objects**; otherwise throw `Error('malformed token')`. Returns `{ header, payload, signature, signingInput }` where `signingInput` is `header.payload` exactly as written in the token.
- `verifyToken(token, { secret, hmac, now, issuer, audience, leewaySec = 0 })`: check, **in this order**, throwing an `Error` with these messages: parse (`malformed token`); `header.alg` must be exactly `'HS256'` (`unsupported algorithm`); the signature must equal `hmac(secret, signingInput)` compared in **constant time** (`bad signature`); `payload.exp` must be a number (`missing exp`); `now >= exp + leewaySec` (`token expired`); if `nbf` is present, `now < nbf - leewaySec` (`token not yet valid`); if `issuer` was given it must equal `iss` (`wrong issuer`); if `audience` was given, `aud` (a string or an array) must contain it **exactly** (`wrong audience`). On success return the payload. `now` is in **seconds**.

```js
const hmac = (secret, data) => base64urlEncode('mac:' + secret + ':' + data);   // a stand-in for a real HMAC
```

%% worked
**A similar problem, solved: `decodeHex(text)` with strict validation** — reject anything outside the alphabet before decoding.

```js
export function decodeHex(text) {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(text)) throw new Error('invalid hex');      // ① validate FIRST: strict alphabet, even length
  const bytes = [];
  for (let i = 0; i < text.length; i += 2) bytes.push(parseInt(text.slice(i, i + 2), 16));
  return bytes;
}
```

For base64url, process the text **four characters at a time**: each character is 6 bits, so four give 24 bits = three bytes; a final group of 2 or 3 characters gives 1 or 2 bytes. Encoding is the same dance backwards. In `verifyToken`, do the checks **in the stated order** and **fail closed**: anything unexpected is an error.

%% explain
- **base64url** by hand: 6-bit groups, URL-safe alphabet, no padding.
- **`parseJwt`** is strict about structure and JSON shape.
- **`verifyToken`**: algorithm pinned → signature → claims, with constant-time comparison.
- **`exp` is mandatory**; `>=` at the boundary; `aud` matched exactly.

%% nudge
- Why is the algorithm checked **before** the signature?
- Why must `aud` not be matched with `includes` on a string?

%% starter
```js
export function base64urlEncode(text) {
  return '';
}

export function base64urlDecode(text) {
  return '';
}

export function parseJwt(token) {
  return { header: {}, payload: {}, signature: '', signingInput: '' };
}

export function verifyToken(token, { secret, hmac, now, issuer, audience, leewaySec = 0 }) {
  return {};
}
```

%% tests
```js
const hmac = (secret, data) => base64urlEncode('mac:' + secret + ':' + data);
const make = (header, payload, secret = 's3cret', signature) => {
  const h = base64urlEncode(JSON.stringify(header));
  const p = base64urlEncode(JSON.stringify(payload));
  return `${h}.${p}.${signature !== undefined ? signature : hmac(secret, `${h}.${p}`)}`;
};
const HS = { alg: 'HS256', typ: 'JWT' };
const claims = { sub: '7', exp: 2000, iss: 'auth.example', aud: 'api' };
const opts = { secret: 's3cret', hmac, now: 1000, issuer: 'auth.example', audience: 'api' };

describe('base64url', () => {
  it('encodes known values', () => {
    expect(base64urlEncode('')).toBe('');
    expect(base64urlEncode('a')).toBe('YQ');
    expect(base64urlEncode('ab')).toBe('YWI');
    expect(base64urlEncode('abc')).toBe('YWJj');
    expect(base64urlEncode('hello')).toBe('aGVsbG8');
    expect(base64urlEncode('{"alg":"HS256","typ":"JWT"}')).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });
  it('uses the URL-safe alphabet and UTF-8', () => {
    expect(base64urlEncode('>>>???')).toBe('Pj4-Pz8_');
    expect(base64urlEncode('é')).toBe('w6k');
  });
  it('decodes known values', () => {
    expect(base64urlDecode('')).toBe('');
    expect(base64urlDecode('YQ')).toBe('a');
    expect(base64urlDecode('YWI')).toBe('ab');
    expect(base64urlDecode('aGVsbG8')).toBe('hello');
    expect(base64urlDecode('Pj4-Pz8_')).toBe('>>>???');
    expect(base64urlDecode('w6k')).toBe('é');
  });
  it('round-trips', () => {
    for (const text of ['', 'x', 'xy', 'xyz', 'héllo wörld ✓', '{"a":[1,2,3]}', 'a'.repeat(100)]) {
      expect(base64urlDecode(base64urlEncode(text))).toBe(text);
    }
  });
  it('rejects invalid input', () => {
    for (const bad of ['a', 'abcde', 'ab+c', 'ab/c', 'ab=c', 'ab c', 'ab.c']) {
      expect(() => base64urlDecode(bad)).toThrow('invalid base64url');
    }
  });
});

describe('parseJwt', () => {
  it('splits a token into parts', () => {
    const token = make(HS, claims);
    const parsed = parseJwt(token);
    expect(parsed.header).toEqual(HS);
    expect(parsed.payload).toEqual(claims);
    expect(parsed.signingInput).toBe(token.split('.').slice(0, 2).join('.'));
    expect(parsed.signature).toBe(token.split('.')[2]);
  });
  it('allows an empty signature', () => {
    expect(parseJwt(make({ alg: 'none' }, claims, 'x', '')).signature).toBe('');
  });
  it('rejects malformed tokens', () => {
    const good = make(HS, claims);
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', '..', good + '.extra', 'e30.!!!.sig', base64urlEncode('[]') + '.' + base64urlEncode('{}') + '.s', base64urlEncode('{}') + '.' + base64urlEncode('"str"') + '.s', base64urlEncode('not json') + '.' + base64urlEncode('{}') + '.s']) {
      expect(() => parseJwt(bad)).toThrow('malformed token');
    }
  });
});

describe('verifyToken', () => {
  it('returns the payload for a valid token', () => {
    expect(verifyToken(make(HS, claims), opts)).toEqual(claims);
  });
  it('rejects unsupported algorithms, including none', () => {
    expect(() => verifyToken(make({ alg: 'none' }, claims, 'x', ''), opts)).toThrow('unsupported algorithm');
    expect(() => verifyToken(make({ alg: 'HS512' }, claims), opts)).toThrow('unsupported algorithm');
    expect(() => verifyToken(make({ alg: 'hs256' }, claims), opts)).toThrow('unsupported algorithm');
    expect(() => verifyToken(make({}, claims), opts)).toThrow('unsupported algorithm');
  });
  it('rejects bad signatures', () => {
    expect(() => verifyToken(make(HS, claims, 'other-secret'), opts)).toThrow('bad signature');
    const valid = make(HS, claims);
    const forged = make(HS, { ...claims, sub: 'admin' }, 's3cret', valid.split('.')[2]);
    expect(() => verifyToken(forged, opts)).toThrow('bad signature');
    expect(() => verifyToken(make(HS, claims, 's3cret', ''), opts)).toThrow('bad signature');
  });
  it('rejects malformed tokens', () => {
    expect(() => verifyToken('nonsense', opts)).toThrow('malformed token');
  });
  it('requires exp and enforces it with >=', () => {
    const { exp, ...noExp } = claims;
    expect(() => verifyToken(make(HS, noExp), opts)).toThrow('missing exp');
    expect(() => verifyToken(make(HS, { ...claims, exp: '2000' }), opts)).toThrow('missing exp');
    expect(verifyToken(make(HS, claims), { ...opts, now: 1999 })).toEqual(claims);
    expect(() => verifyToken(make(HS, claims), { ...opts, now: 2000 })).toThrow('token expired');
    expect(() => verifyToken(make(HS, claims), { ...opts, now: 5000 })).toThrow('token expired');
  });
  it('applies leeway to exp and nbf', () => {
    expect(verifyToken(make(HS, claims), { ...opts, now: 2005, leewaySec: 10 })).toEqual(claims);
    expect(() => verifyToken(make(HS, claims), { ...opts, now: 2010, leewaySec: 10 })).toThrow('token expired');
    const early = { ...claims, nbf: 1500 };
    expect(() => verifyToken(make(HS, early), opts)).toThrow('token not yet valid');
    expect(verifyToken(make(HS, early), { ...opts, now: 1495, leewaySec: 10 })).toEqual(early);
    expect(verifyToken(make(HS, early), { ...opts, now: 1500 })).toEqual(early);
  });
  it('checks the issuer when asked', () => {
    expect(() => verifyToken(make(HS, { ...claims, iss: 'evil.example' }), opts)).toThrow('wrong issuer');
    expect(() => verifyToken(make(HS, { ...claims, iss: undefined }), opts)).toThrow('wrong issuer');
    const { issuer, ...noIssuerCheck } = opts;
    expect(verifyToken(make(HS, { ...claims, iss: 'anyone' }), noIssuerCheck).iss).toBe('anyone');
  });
  it('checks the audience exactly, as a string or a list', () => {
    expect(() => verifyToken(make(HS, { ...claims, aud: 'other' }), opts)).toThrow('wrong audience');
    expect(() => verifyToken(make(HS, { ...claims, aud: 'api-admin' }), opts)).toThrow('wrong audience');
    expect(() => verifyToken(make(HS, { ...claims, aud: undefined }), opts)).toThrow('wrong audience');
    expect(verifyToken(make(HS, { ...claims, aud: ['web', 'api'] }), opts).aud).toEqual(['web', 'api']);
    expect(() => verifyToken(make(HS, { ...claims, aud: ['web', 'api-admin'] }), opts)).toThrow('wrong audience');
    const { audience, ...noAudCheck } = opts;
    expect(verifyToken(make(HS, { ...claims, aud: 'whatever' }), noAudCheck).aud).toBe('whatever');
  });
  it('checks in order: alg, then signature, then claims', () => {
    const expiredAndForged = make({ alg: 'none' }, { ...claims, exp: 1 }, 'x', '');
    expect(() => verifyToken(expiredAndForged, opts)).toThrow('unsupported algorithm');
    const expiredBadSig = make(HS, { ...claims, exp: 1 }, 'wrong');
    expect(() => verifyToken(expiredBadSig, opts)).toThrow('bad signature');
  });
});
```

%% hints
- Encode: for each 3 bytes build `n = (b0 << 16) | (b1 << 8) | b2`; emit 4 characters `(n >> 18) & 63`, … but only `bytes + 1` characters for a partial group.
- Decode: validate `/^[A-Za-z0-9_-]*$/` and `length % 4 !== 1`; per group accumulate `n = (n << 6) | index`; shift left for missing characters; emit bytes; decode with `new TextDecoder()`.
- `verifyToken`: `parseJwt`, then the checks in order; `aud`: `[].concat(payload.aud).includes(audience)`.
- Reuse your constant-time comparison idea for the signature.

%% solution
```js
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function base64urlEncode(text) {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += CHARS[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += CHARS[n & 63];
  }
  return out;
}

export function base64urlDecode(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) {
    throw new Error('invalid base64url');
  }
  const bytes = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (const ch of chunk) n = (n << 6) | CHARS.indexOf(ch);
    n <<= 6 * (4 - chunk.length);
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function parseJwt(token) {
  if (typeof token !== 'string') throw new Error('malformed token');
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] === '' || parts[1] === '') throw new Error('malformed token');
  let header, payload;
  try {
    header = JSON.parse(base64urlDecode(parts[0]));
    payload = JSON.parse(base64urlDecode(parts[1]));
  } catch {
    throw new Error('malformed token');
  }
  if (!isObject(header) || !isObject(payload)) throw new Error('malformed token');
  return { header, payload, signature: parts[2], signingInput: parts[0] + '.' + parts[1] };
}

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function verifyToken(token, { secret, hmac, now, issuer, audience, leewaySec = 0 }) {
  const { header, payload, signature, signingInput } = parseJwt(token);
  if (header.alg !== 'HS256') throw new Error('unsupported algorithm');
  if (!sameSecret(signature, hmac(secret, signingInput))) throw new Error('bad signature');
  if (typeof payload.exp !== 'number') throw new Error('missing exp');
  if (now >= payload.exp + leewaySec) throw new Error('token expired');
  if (payload.nbf !== undefined && now < payload.nbf - leewaySec) throw new Error('token not yet valid');
  if (issuer !== undefined && payload.iss !== issuer) throw new Error('wrong issuer');
  if (audience !== undefined && !(payload.aud !== undefined && [].concat(payload.aud).includes(audience))) {
    throw new Error('wrong audience');
  }
  return payload;
}
```

%% exercise sec-session-store | A session store | 3 | js | js | createSessionStore | 28
Implement `createSessionStore({ clock, random, ttlMs, idleMs })`. `clock.now()` returns milliseconds; `random()` returns a number in `[0, 1)`.

- `create(userId, data = {})` returns a new session id: `sess_` followed by **32 hexadecimal characters**, each `Math.floor(random() * 16).toString(16)`. If the id is already in use, try again; after **5** failed attempts throw `Error('could not generate a unique session id')`.
- `get(id)` returns `{ id, userId, data, createdAt, lastSeen }` (**copies**: changing them doesn't change the store) or `null`. A session is **expired** when `now - createdAt >= ttlMs` (absolute) **or** `now - lastSeen >= idleMs` (idle); expired sessions are deleted and give `null`. A successful `get` sets `lastSeen` to now.
- `rotate(id)` gives the live session a **new id** (same user, data and `createdAt`; `lastSeen` now), invalidates the old id, and returns the new id. For a missing or expired session it returns `null`.
- `destroy(id)` returns whether something was removed. `destroyAllFor(userId)` returns the number removed.
- `size()` is the number of **live** sessions (expired ones are purged first).

```js
const id = store.create(7, { role: 'user' });
store.get(id).userId; // 7
```

%% worked
**A similar problem, solved: a one-time-code store with expiry.**

```js
export function createCodeStore({ clock, random, ttlMs }) {
  const codes = new Map();
  const live = (code) => {
    const entry = codes.get(code);
    if (!entry) return null;
    if (clock.now() - entry.createdAt >= ttlMs) { codes.delete(code); return null; }   // ① expiry uses >=: at the boundary it is over
    return entry;
  };
  return {
    issue(userId) {
      const code = String(Math.floor(random() * 1e6)).padStart(6, '0');
      codes.set(code, { userId, createdAt: clock.now() });
      return code;
    },
    redeem(code) {
      const entry = live(code);
      if (!entry) return null;
      codes.delete(code);                                  // ② one use only
      return entry.userId;
    },
  };
}
```

Funnel every lookup through one `live(id)` helper so **expiry is enforced everywhere**. Inject the clock and the randomness so tests control both. Return **copies** so callers can't edit stored data.

%% explain
- **Two clocks**: absolute (`createdAt`) and idle (`lastSeen`), both with `>=`.
- **Random id** with retry on collision.
- **Rotation** keeps `createdAt`: the absolute lifetime is never extended.
- **Copies** out; **live** check before every operation.

%% nudge
- Why must `rotate` keep the original `createdAt`?
- Why return copies from `get`?

%% starter
```js
export function createSessionStore({ clock, random, ttlMs, idleMs }) {
  const sessions = new Map();
  return {
    create(userId, data = {}) { return ''; },
    get(id) { return null; },
    rotate(id) { return null; },
    destroy(id) { return false; },
    destroyAllFor(userId) { return 0; },
    size() { return 0; },
  };
}
```

%% tests
```js
const setup = (extra = {}) => {
  let t = 0;
  let seed = 12345;
  const clock = { now: () => t, set: (v) => { t = v; }, advance: (d) => { t += d; } };
  const random = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const store = createSessionStore({ clock, random, ttlMs: 10000, idleMs: 3000, ...extra });
  return { store, clock };
};

describe('createSessionStore', () => {
  it('creates ids with the required format', () => {
    const { store } = setup();
    const id = store.create(7);
    expect(id).toMatch(/^sess_[0-9a-f]{32}$/);
    expect(store.create(7)).not.toBe(id);
  });
  it('looks sessions up and returns copies', () => {
    const { store, clock } = setup();
    clock.set(100);
    const id = store.create(7, { role: 'user' });
    const s = store.get(id);
    expect(s).toEqual({ id, userId: 7, data: { role: 'user' }, createdAt: 100, lastSeen: 100 });
    s.data.role = 'admin';
    s.userId = 99;
    expect(store.get(id).userId).toBe(7);
    expect(store.get(id).data.role).toBe('user');
    expect(store.get('sess_unknown')).toBeNull();
  });
  it('copies the data it is given', () => {
    const { store } = setup();
    const data = { role: 'user' };
    const id = store.create(1, data);
    data.role = 'admin';
    expect(store.get(id).data.role).toBe('user');
  });
  it('expires after the idle timeout, and activity slides it', () => {
    const { store, clock } = setup();
    const id = store.create(7);
    clock.advance(2999);
    expect(store.get(id)).not.toBeNull();
    clock.advance(2999);
    expect(store.get(id)).not.toBeNull();
    clock.advance(3000);
    expect(store.get(id)).toBeNull();
    expect(store.get(id)).toBeNull();
  });
  it('expires at the absolute lifetime regardless of activity', () => {
    const { store, clock } = setup();
    const id = store.create(7);
    for (let n = 0; n < 4; n++) {
      clock.advance(2000);
      expect(store.get(id)).not.toBeNull();
    }
    clock.advance(1999);
    expect(store.get(id)).not.toBeNull();
    clock.advance(1);
    expect(clock.now()).toBe(10000);
    expect(store.get(id)).toBeNull();
  });
  it('rotates ids and keeps the data and absolute lifetime', () => {
    const { store, clock } = setup();
    const old = store.create(7, { cart: 3 });
    clock.advance(1000);
    const fresh = store.rotate(old);
    expect(fresh).toMatch(/^sess_[0-9a-f]{32}$/);
    expect(fresh).not.toBe(old);
    expect(store.get(old)).toBeNull();
    const s = store.get(fresh);
    expect(s.userId).toBe(7);
    expect(s.data).toEqual({ cart: 3 });
    expect(s.createdAt).toBe(0);
    clock.advance(2000);
    store.get(fresh);
    clock.advance(2000);
    store.get(fresh);
    clock.advance(2000);
    store.get(fresh);
    clock.advance(2000);
    expect(store.get(fresh)).not.toBeNull();
    clock.advance(1000);
    expect(clock.now()).toBe(10000);
    expect(store.get(fresh)).toBeNull();
  });
  it('rotate returns null for missing or expired sessions', () => {
    const { store, clock } = setup();
    expect(store.rotate('sess_nope')).toBeNull();
    const id = store.create(1);
    clock.advance(3000);
    expect(store.rotate(id)).toBeNull();
  });
  it('destroys sessions', () => {
    const { store } = setup();
    const a = store.create(1), b = store.create(1), c = store.create(2);
    expect(store.destroy(a)).toBe(true);
    expect(store.destroy(a)).toBe(false);
    expect(store.destroyAllFor(1)).toBe(1);
    expect(store.get(b)).toBeNull();
    expect(store.get(c)).not.toBeNull();
    expect(store.destroyAllFor(99)).toBe(0);
  });
  it('counts only live sessions', () => {
    const { store, clock } = setup();
    store.create(1);
    clock.advance(2000);
    store.create(2);
    expect(store.size()).toBe(2);
    clock.advance(1000);
    expect(store.size()).toBe(1);
    clock.advance(3000);
    expect(store.size()).toBe(0);
  });
  it('gives up after repeated collisions', () => {
    const store = createSessionStore({ clock: { now: () => 0 }, random: () => 0, ttlMs: 1000, idleMs: 1000 });
    store.create(1);
    expect(() => store.create(2)).toThrow('could not generate a unique session id');
  });
});
```

%% hints
- `const live = (id) => { const s = sessions.get(id); if (!s) return null; if (now - s.createdAt >= ttlMs || now - s.lastSeen >= idleMs) { sessions.delete(id); return null; } return s; };`
- New id: loop up to 5 times generating 32 hex digits until `!sessions.has(id)`.
- `rotate`: delete the old key, set the same record under a new id with `lastSeen = now`.

%% solution
```js
export function createSessionStore({ clock, random, ttlMs, idleMs }) {
  const sessions = new Map();

  const newId = () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      let id = 'sess_';
      for (let i = 0; i < 32; i++) id += Math.floor(random() * 16).toString(16);
      if (!sessions.has(id)) return id;
    }
    throw new Error('could not generate a unique session id');
  };

  const live = (id) => {
    const s = sessions.get(id);
    if (!s) return null;
    const now = clock.now();
    if (now - s.createdAt >= ttlMs || now - s.lastSeen >= idleMs) {
      sessions.delete(id);
      return null;
    }
    return s;
  };

  const view = (s) => ({ id: s.id, userId: s.userId, data: { ...s.data }, createdAt: s.createdAt, lastSeen: s.lastSeen });

  return {
    create(userId, data = {}) {
      const id = newId();
      const now = clock.now();
      sessions.set(id, { id, userId, data: { ...data }, createdAt: now, lastSeen: now });
      return id;
    },
    get(id) {
      const s = live(id);
      if (!s) return null;
      s.lastSeen = clock.now();
      return view(s);
    },
    rotate(id) {
      const s = live(id);
      if (!s) return null;
      sessions.delete(id);
      const fresh = newId();
      sessions.set(fresh, { ...s, id: fresh, lastSeen: clock.now() });
      return fresh;
    },
    destroy: (id) => sessions.delete(id),
    destroyAllFor(userId) {
      let count = 0;
      for (const [id, s] of [...sessions]) {
        if (s.userId === userId) {
          sessions.delete(id);
          count++;
        }
      }
      return count;
    },
    size() {
      for (const id of [...sessions.keys()]) live(id);
      return sessions.size;
    },
  };
}
```

%% exercise sec-check-verify-token | Tests for token verification | 4 | js | js | checkVerifyToken | 40
`verifyToken(token, { secret, hmac, now, issuer, audience })` must accept **only** correctly signed `HS256` tokens whose claims are valid: `exp` required and enforced with `>=` (at the exact expiry second the token is over), `nbf` honoured, `issuer` and `audience` matched **exactly** (`aud` may be a string or a list). Anything wrong throws. The hidden harness gives you tools: `checkVerifyToken(verifyToken, { makeToken, hmac })` where `makeToken(header, payload, secret, signature?)` builds a token (signed with `hmac` unless you pass a `signature` to force one). Write a check that passes for a correct verifier and **fails** for: **accepts alg none**, **accepts any algorithm name**, **doesn't check the signature**, **ignores expiry**, **accepts a token at the exact expiry second**, **treats a missing exp as valid**, **ignores not-before**, **ignores the issuer**, **ignores the audience**, **matches the audience by substring**.

```js
const token = makeToken({ alg: 'HS256' }, { exp: 2000, iss: 'a', aud: 'api' }, 's3cret');
expect(() => verifyToken(token, { secret: 's3cret', hmac, now: 1000, issuer: 'a', audience: 'api' })).not.toThrow();
```

%% worked
**A similar problem, solved: `checkVerifyCode(verifyCode, { makeCode })`** — one **forged** input for every rule.

```js
export function checkVerifyCode(verifyCode, { makeCode }) {        // codes are 'userId.expiry.mac'
  const opts = { secret: 'k', now: 100 };
  expect(verifyCode(makeCode(7, 200, 'k'), opts)).toBe(7);                      // ① the happy path first
  expect(() => verifyCode(makeCode(7, 200, 'other'), opts)).toThrow();          // ② signed with the wrong key
  expect(() => verifyCode(makeCode(7, 99, 'k'), opts)).toThrow();               // ③ expired
  expect(() => verifyCode(makeCode(7, 100, 'k'), opts)).toThrow();              // ④ expiry boundary: exactly now is expired
  expect(() => verifyCode(makeCode(7, 200, 'k', { mac: 'AAAA' }), opts)).toThrow();   // ⑤ right shape, forged signature
}
```

For each rule the verifier enforces, build **one input that violates only that rule** (everything else valid). Then a mutant that skips that rule is accepted, and your `toThrow()` fails. Your tools make the otherwise-valid token easy to build.

%% explain
- **Valid token** accepted (and returns the payload).
- **Header attacks**: `alg: 'none'` with an empty signature; `HS512` signed correctly.
- **Signature attacks**: wrong secret; a payload swapped in with the old signature.
- **Claims**: expired, boundary, missing `exp`, not yet valid, wrong issuer, wrong audience, audience that merely **contains** the expected one.

%% nudge
- How do you build a token whose **only** problem is its algorithm?
- Which audience value defeats `includes` on a string?

%% starter
```js
export function checkVerifyToken(verifyToken, { makeToken, hmac }) {
  const claims = { exp: 2000, iss: 'auth.example', aud: 'api' };
  const opts = { secret: 's3cret', hmac, now: 1000, issuer: 'auth.example', audience: 'api' };
  const good = makeToken({ alg: 'HS256' }, claims, 's3cret');
  expect(() => verifyToken(good, opts)).not.toThrow();
  // your forged tokens: algorithm, signature, expiry, nbf, issuer, audience
}
```

%% tests
```js
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const enc = (text) => {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += CHARS[(n >> 18) & 63] + CHARS[(n >> 12) & 63];
    if (i + 1 < bytes.length) out += CHARS[(n >> 6) & 63];
    if (i + 2 < bytes.length) out += CHARS[n & 63];
  }
  return out;
};
const dec = (text) => {
  const bytes = [];
  for (let i = 0; i < text.length; i += 4) {
    const chunk = text.slice(i, i + 4);
    let n = 0;
    for (const ch of chunk) n = (n << 6) | CHARS.indexOf(ch);
    n <<= 6 * (4 - chunk.length);
    bytes.push((n >> 16) & 255);
    if (chunk.length > 2) bytes.push((n >> 8) & 255);
    if (chunk.length > 3) bytes.push(n & 255);
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
};
const hmac = (secret, data) => enc('mac:' + secret + ':' + data);
const makeToken = (header, payload, secret, signature) => {
  const h = enc(JSON.stringify(header));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.${signature !== undefined ? signature : hmac(secret, `${h}.${p}`)}`;
};
const parts = (token) => {
  const [h, p, s] = token.split('.');
  return { header: JSON.parse(dec(h)), payload: JSON.parse(dec(p)), signature: s, signingInput: h + '.' + p };
};

const impl = (flaws = {}) => (token, { secret, hmac: sign, now, issuer, audience }) => {
  const { header, payload, signature, signingInput } = parts(token);
  const none = flaws.none && header.alg === 'none';
  if (!none && !flaws.anyAlg && header.alg !== 'HS256') throw new Error('alg');
  if (!none && !flaws.noSig && signature !== sign(secret, signingInput)) throw new Error('sig');
  if (typeof payload.exp !== 'number') {
    if (!flaws.missingExp) throw new Error('exp');
  } else if (!flaws.noExpiry && (flaws.expBoundary ? now > payload.exp : now >= payload.exp)) {
    throw new Error('expired');
  }
  if (!flaws.noNbf && payload.nbf !== undefined && now < payload.nbf) throw new Error('nbf');
  if (!flaws.noIssuer && issuer !== undefined && payload.iss !== issuer) throw new Error('iss');
  if (!flaws.noAudience && audience !== undefined) {
    const aud = payload.aud;
    const ok = flaws.substringAud && typeof aud === 'string' ? aud.includes(audience) : [].concat(aud).includes(audience);
    if (!ok) throw new Error('aud');
  }
  return payload;
};
const correct = impl();
const mutants = {
  'accepts alg none': impl({ none: true }),
  'accepts any algorithm name': impl({ anyAlg: true }),
  'does not check the signature': impl({ noSig: true }),
  'ignores expiry': impl({ noExpiry: true }),
  'accepts a token at the exact expiry second': impl({ expBoundary: true }),
  'treats a missing exp as valid': impl({ missingExp: true }),
  'ignores not-before': impl({ noNbf: true }),
  'ignores the issuer': impl({ noIssuer: true }),
  'ignores the audience': impl({ noAudience: true }),
  'matches the audience by substring': impl({ substringAud: true }),
};

describe('your checkVerifyToken', () => {
  it('passes on a correct verifier', () => {
    expect(() => checkVerifyToken(correct, { makeToken, hmac })).not.toThrow();
  });
  for (const [name, verifier] of Object.entries(mutants)) {
    it(`catches a verifier that ${name}`, () => {
      expect(() => checkVerifyToken(verifier, { makeToken, hmac })).toThrow();
    });
  }
});
```

%% hints
- Valid token: `makeToken({ alg: 'HS256' }, { exp: 2000, iss, aud }, 's3cret')` with `now: 1000`.
- None: `makeToken({ alg: 'none' }, claims, 's3cret', '')`. Other algorithm: `makeToken({ alg: 'HS512' }, claims, 's3cret')`.
- Forged signature: `makeToken({ alg: 'HS256' }, claims, 's3cret', 'AAAA')`.
- Expiry: `now: 2000` must throw (boundary); a payload without `exp`; `nbf: 1500` with `now: 1000`.
- Audience trick: `aud: 'api-admin'` when `audience: 'api'`.

%% solution
```js
export function checkVerifyToken(verifyToken, { makeToken, hmac }) {
  const claims = { sub: '7', exp: 2000, iss: 'auth.example', aud: 'api' };
  const opts = { secret: 's3cret', hmac, now: 1000, issuer: 'auth.example', audience: 'api' };
  const HS = { alg: 'HS256', typ: 'JWT' };
  const good = makeToken(HS, claims, 's3cret');

  expect(() => verifyToken(good, opts)).not.toThrow();
  expect(verifyToken(good, opts)).toEqual(claims);
  expect(() => verifyToken(makeToken(HS, { ...claims, aud: ['web', 'api'] }, 's3cret'), opts)).not.toThrow();

  expect(() => verifyToken(makeToken({ alg: 'none' }, claims, 's3cret', ''), opts)).toThrow();
  expect(() => verifyToken(makeToken({ alg: 'HS512' }, claims, 's3cret'), opts)).toThrow();

  expect(() => verifyToken(makeToken(HS, claims, 'other-secret'), opts)).toThrow();
  expect(() => verifyToken(makeToken(HS, claims, 's3cret', 'AAAA'), opts)).toThrow();
  const swapped = makeToken(HS, { ...claims, sub: 'admin' }, 's3cret', good.split('.')[2]);
  expect(() => verifyToken(swapped, opts)).toThrow();

  expect(() => verifyToken(good, { ...opts, now: 5000 })).toThrow();
  expect(() => verifyToken(good, { ...opts, now: 2000 })).toThrow();
  expect(() => verifyToken(good, { ...opts, now: 1999 })).not.toThrow();
  const { exp, ...noExp } = claims;
  expect(() => verifyToken(makeToken(HS, noExp, 's3cret'), opts)).toThrow();
  expect(() => verifyToken(makeToken(HS, { ...claims, nbf: 1500 }, 's3cret'), opts)).toThrow();

  expect(() => verifyToken(makeToken(HS, { ...claims, iss: 'evil.example' }, 's3cret'), opts)).toThrow();
  expect(() => verifyToken(makeToken(HS, { ...claims, aud: 'other' }, 's3cret'), opts)).toThrow();
  expect(() => verifyToken(makeToken(HS, { ...claims, aud: 'api-admin' }, 's3cret'), opts)).toThrow();
}
```
