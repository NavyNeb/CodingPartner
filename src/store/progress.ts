import { useSyncExternalStore } from 'react';
import { MAX_ATTEMPTS, MAX_MOCKS, type Attempt, type MockResult, type SyncState } from '../lib/syncMerge';

export type { Attempt, MockResult, SolveRecord } from '../lib/syncMerge';

/** Everything in SyncState is synced across devices; `last` and `timed` stay per-device. */
export interface ProgressState extends SyncState {
  last?: { lessonId: string; exId: string };
  timed: boolean;
}

const KEY = 'whetstone:progress:v1';
const empty: ProgressState = { epoch: 0, solved: {}, drafts: {}, draftAt: {}, hints: {}, solutionSeen: {}, checks: {}, attempts: [], mocks: [], timed: false };

function load(): ProgressState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...empty, ...JSON.parse(raw) };
  } catch { /* storage unavailable or corrupt: start fresh */ }
  return empty;
}

let state = load();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function commit(next: ProgressState) {
  state = next;
  listeners.forEach((l) => l());
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota / private mode */ }
  }, 250);
}

export const progress = {
  get: () => state,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
  saveDraft(id: string, code: string) {
    if (state.drafts[id] === code) return;
    commit({ ...state, drafts: { ...state.drafts, [id]: code }, draftAt: { ...state.draftAt, [id]: Date.now() } });
  },
  clearDraft(id: string) {
    if (!(id in state.drafts)) return;
    const drafts = { ...state.drafts };
    delete drafts[id];
    commit({ ...state, drafts, draftAt: { ...state.draftAt, [id]: Date.now() } });
  },
  logAttempt(a: Omit<Attempt, 'id' | 'at'>) {
    const at = Date.now();
    const attempt: Attempt = { ...a, id: `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`, at };
    commit({ ...state, attempts: [...state.attempts, attempt].slice(-MAX_ATTEMPTS) });
  },
  addMock(m: Omit<MockResult, 'id' | 'at'>) {
    const at = Date.now();
    const mock: MockResult = { ...m, id: `${at.toString(36)}${Math.random().toString(36).slice(2, 6)}`, at };
    commit({ ...state, mocks: [...state.mocks, mock].slice(-MAX_MOCKS) });
    return mock;
  },
  /** Replace the synced part of the state (after a merge with the server). Keeps per-device fields. */
  applySynced(next: SyncState) {
    commit({ ...state, ...next });
  },
  markSolved(id: string) {
    if (state.solved[id]) return;
    commit({ ...state, solved: { ...state.solved, [id]: { at: Date.now(), assisted: !!state.solutionSeen[id] } } });
  },
  revealHint(id: string, count: number) {
    commit({ ...state, hints: { ...state.hints, [id]: Math.max(count, state.hints[id] ?? 0) } });
  },
  markSolutionSeen(id: string) {
    commit({ ...state, solutionSeen: { ...state.solutionSeen, [id]: true } });
  },
  markCheck(key: string) {
    if (state.checks[key]) return;
    commit({ ...state, checks: { ...state.checks, [key]: true } });
  },
  setLast(lessonId: string, exId: string) {
    if (state.last?.lessonId === lessonId && state.last.exId === exId) return;
    commit({ ...state, last: { lessonId, exId } });
  },
  setTimed(timed: boolean) {
    commit({ ...state, timed });
  },
  resetAll() {
    // A higher epoch tells every synced device to drop its old progress too.
    commit({ ...empty, epoch: state.epoch + 1 });
  },
};

export function useProgress(): ProgressState {
  return useSyncExternalStore(progress.subscribe, progress.get);
}

// Flush a pending debounce when the tab is hidden so a reload never loses the last edit.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    }
  });
}
