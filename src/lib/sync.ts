import { useSyncExternalStore } from 'react';
import { progress, type ProgressState } from '../store/progress';
import { normalize, sameState, type SyncState } from './syncMerge';

export type SyncStatus = 'checking' | 'unavailable' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error';

interface SyncInfo { status: SyncStatus; lastSyncedAt?: number; message?: string; hasProfile: boolean }

const KEY = 'whetstone:sync:v1';
let token: string | undefined;
try { token = JSON.parse(localStorage.getItem(KEY) ?? 'null')?.token; } catch { /* no storage */ }

let info: SyncInfo = { status: 'checking', hasProfile: !!token };
const listeners = new Set<() => void>();
const set = (patch: Partial<SyncInfo>) => { info = { ...info, ...patch, hasProfile: !!token }; listeners.forEach((l) => l()); };

export const useSync = (): SyncInfo => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => info);

const api = (path: string) => new URL(`api/${path}`, document.baseURI).toString();

async function request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
  const res = await fetch(api(path), {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(auth && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not JSON (e.g. a static host answering with index.html) */ }
  if (!res.ok || json === null) {
    const err = new Error((json as { error?: string } | null)?.error ?? `Request failed (${res.status})`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return json as T;
}

export function synced(p: ProgressState): SyncState {
  return normalize({
    epoch: p.epoch, solved: p.solved, drafts: p.drafts, draftAt: p.draftAt, hints: p.hints,
    solutionSeen: p.solutionSeen, checks: p.checks, attempts: p.attempts, mocks: p.mocks,
  });
}

let running = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastPushed = '';

export async function syncNow(): Promise<void> {
  if (!token || info.status === 'unavailable') return;
  if (running) { again = true; return; }
  running = true;
  set({ status: 'syncing', message: undefined });
  try {
    const out = await request<{ version: number; state: SyncState }>('PUT', 'sync', { state: synced(progress.get()) });
    const merged = normalize(out.state);
    if (!sameState(merged, synced(progress.get()))) progress.applySynced(merged);
    lastPushed = JSON.stringify(synced(progress.get()));
    set({ status: 'synced', lastSyncedAt: Date.now() });
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 401) { token = undefined; persist(); set({ status: 'signed-out', message: 'This device was signed out. Enter your recovery code to reconnect.' }); }
    else if (err.status === undefined) set({ status: 'offline', message: 'Offline: progress is safe on this device and will sync when you are back online.' });
    else set({ status: 'error', message: err.message });
  } finally {
    running = false;
    if (again) { again = false; schedule(500); }
  }
}

function schedule(ms = 2500) {
  if (!token) return;
  clearTimeout(timer);
  timer = setTimeout(() => { void syncNow(); }, ms);
}

function persist() {
  try { if (token) localStorage.setItem(KEY, JSON.stringify({ token })); else localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export async function createProfile(): Promise<string> {
  const out = await request<{ token: string; recoveryCode: string }>('POST', 'profile', {}, false);
  token = out.token; persist();
  await syncNow();
  return out.recoveryCode;
}

export async function recoverProfile(code: string, revokeOthers = false): Promise<void> {
  const out = await request<{ token: string }>('POST', 'recover', { code, revokeOthers }, false);
  token = out.token; persist();
  await syncNow();
}

export async function signOut(): Promise<void> {
  try { await request('POST', 'logout'); } catch { /* the token is dropped locally either way */ }
  token = undefined; persist(); set({ status: 'signed-out', lastSyncedAt: undefined, message: undefined });
}

export async function deleteAccount(): Promise<void> {
  await request('DELETE', 'me');
  token = undefined; persist(); set({ status: 'signed-out', lastSyncedAt: undefined, message: undefined });
}

export const getToken = () => token;

export async function createShare(kind: 'progress' | 'mock', payload: unknown): Promise<string> {
  return (await request<{ id: string }>('POST', 'share', { kind, payload })).id;
}
export const listShares = () => request<{ shares: { id: string; kind: string; createdAt: number }[] }>('GET', 'share');
export const deleteShare = (id: string) => request('DELETE', `share/${id}`);
export const fetchShare = (id: string) => request<{ id: string; kind: 'progress' | 'mock'; createdAt: number; payload: any }>('GET', `share/${id}`, undefined, false);

export async function startSync() {
  try {
    const h = await request<{ ok?: boolean; sync?: boolean }>('GET', 'health', undefined, false);
    if (!h.ok || !h.sync) throw new Error('no sync service');
  } catch {
    set({ status: 'unavailable' });
    return;
  }
  set({ status: token ? 'syncing' : 'signed-out' });
  progress.subscribe(() => {
    if (!token) return;
    const now = JSON.stringify(synced(progress.get()));
    if (now !== lastPushed) schedule();
  });
  const wake = () => { if (token && document.visibilityState !== 'hidden') schedule(200); };
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', wake);
  if (token) void syncNow();
}
