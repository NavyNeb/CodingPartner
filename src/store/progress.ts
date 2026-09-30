import { useSyncExternalStore } from 'react';

export interface SolveRecord {
  at: number;
  /** True when the reference solution was opened before the tests first passed. */
  assisted: boolean;
}

export interface ProgressState {
  solved: Record<string, SolveRecord>;
  drafts: Record<string, string>;
  hints: Record<string, number>;
  solutionSeen: Record<string, true>;
  last?: { lessonId: string; exId: string };
  timed: boolean;
}

const KEY = 'whetstone:progress:v1';
const empty: ProgressState = { solved: {}, drafts: {}, hints: {}, solutionSeen: {}, timed: false };

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
    commit({ ...state, drafts: { ...state.drafts, [id]: code } });
  },
  clearDraft(id: string) {
    const drafts = { ...state.drafts };
    delete drafts[id];
    commit({ ...state, drafts });
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
  setLast(lessonId: string, exId: string) {
    if (state.last?.lessonId === lessonId && state.last.exId === exId) return;
    commit({ ...state, last: { lessonId, exId } });
  },
  setTimed(timed: boolean) {
    commit({ ...state, timed });
  },
  resetAll() {
    commit({ ...empty });
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
