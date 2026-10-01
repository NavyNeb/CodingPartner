/**
 * Pure merge of two progress snapshots. Used by the browser (pull → merge → push)
 * and by the server tests, so both sides agree on what "merged" means.
 *
 * The rules are chosen so merge(a, b) equals merge(b, a) and merging twice changes nothing,
 * which is what lets devices converge no matter the order they sync in.
 */

export interface SolveRecord { at: number; assisted: boolean }

export interface Attempt {
  id: string;
  ex: string;
  at: number;
  passed: number;
  total: number;
  assisted: boolean;
  ms: number;
}

export interface MockResult {
  id: string;
  at: number;
  minutes: number;
  score: number;
  items: { ex: string; passed: number; total: number; ms: number }[];
}

export interface SyncState {
  /** Bumped by "reset all"; the higher epoch replaces the lower one wholesale. */
  epoch: number;
  solved: Record<string, SolveRecord>;
  drafts: Record<string, string>;
  /** When each draft was last changed (a removed draft keeps its timestamp). */
  draftAt: Record<string, number>;
  hints: Record<string, number>;
  solutionSeen: Record<string, true>;
  checks: Record<string, true>;
  attempts: Attempt[];
  mocks: MockResult[];
}

export const MAX_ATTEMPTS = 600;
export const MAX_MOCKS = 50;

export const emptySync = (): SyncState => ({
  epoch: 0, solved: {}, drafts: {}, draftAt: {}, hints: {}, solutionSeen: {}, checks: {}, attempts: [], mocks: [],
});

const union = <T extends Record<string, unknown>>(a: T, b: T): T => ({ ...a, ...b });

function byId<T extends { id: string; at: number }>(a: T[], b: T[], cap: number): T[] {
  const m = new Map<string, T>();
  for (const x of [...a, ...b]) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()].sort((x, y) => x.at - y.at || (x.id < y.id ? -1 : 1)).slice(-cap);
}

/** Fill in fields older clients never wrote, so a stored snapshot is always complete. */
export function normalize(s: Partial<SyncState> | undefined | null): SyncState {
  return { ...emptySync(), ...(s ?? {}) };
}

export function merge(aIn: Partial<SyncState>, bIn: Partial<SyncState>): SyncState {
  const a = normalize(aIn);
  const b = normalize(bIn);
  if (a.epoch !== b.epoch) return a.epoch > b.epoch ? a : b;

  const solved: Record<string, SolveRecord> = { ...a.solved };
  for (const [id, r] of Object.entries(b.solved)) {
    const mine = solved[id];
    if (!mine) solved[id] = r;
    else solved[id] = { at: Math.min(mine.at, r.at), assisted: mine.assisted && r.assisted };
  }

  const drafts: Record<string, string> = {};
  const draftAt: Record<string, number> = {};
  for (const id of new Set([...Object.keys(a.draftAt), ...Object.keys(b.draftAt), ...Object.keys(a.drafts), ...Object.keys(b.drafts)])) {
    const ta = a.draftAt[id] ?? 0;
    const tb = b.draftAt[id] ?? 0;
    // Equal timestamps: keep the longer text so the choice is symmetric.
    const winner = ta > tb ? a : tb > ta ? b : (a.drafts[id] ?? '') >= (b.drafts[id] ?? '') ? a : b;
    draftAt[id] = Math.max(ta, tb);
    if (id in winner.drafts) drafts[id] = winner.drafts[id];
  }

  const hints: Record<string, number> = { ...a.hints };
  for (const [id, n] of Object.entries(b.hints)) hints[id] = Math.max(n, hints[id] ?? 0);

  return {
    epoch: a.epoch,
    solved,
    drafts,
    draftAt,
    hints,
    solutionSeen: union(a.solutionSeen, b.solutionSeen),
    checks: union(a.checks, b.checks),
    attempts: byId(a.attempts, b.attempts, MAX_ATTEMPTS),
    mocks: byId(a.mocks, b.mocks, MAX_MOCKS),
  };
}

export const sameState = (a: SyncState, b: SyncState) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

/** Cheap structural validation for data arriving at the server. Returns an error message or null. */
export function validate(s: unknown): string | null {
  if (!s || typeof s !== 'object') return 'state must be an object';
  const o = s as Record<string, unknown>;
  const rec = (k: string) => o[k] === undefined || (typeof o[k] === 'object' && o[k] !== null && !Array.isArray(o[k]));
  for (const k of ['solved', 'drafts', 'draftAt', 'hints', 'solutionSeen', 'checks']) if (!rec(k)) return `${k} must be an object`;
  for (const k of ['attempts', 'mocks']) if (o[k] !== undefined && !Array.isArray(o[k])) return `${k} must be an array`;
  if (o.epoch !== undefined && !Number.isInteger(o.epoch)) return 'epoch must be an integer';
  for (const v of Object.values((o.drafts ?? {}) as Record<string, unknown>)) if (typeof v !== 'string') return 'drafts must be strings';
  for (const v of Object.values((o.hints ?? {}) as Record<string, unknown>)) if (typeof v !== 'number') return 'hints must be numbers';
  return null;
}
