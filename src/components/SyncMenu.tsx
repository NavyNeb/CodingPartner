import { useEffect, useRef, useState } from 'react';
import { createProfile, deleteAccount, recoverProfile, signOut, syncNow, useSync } from '../lib/sync';

const LABEL = {
  checking: 'Checking…', unavailable: '', 'signed-out': 'Sync off', syncing: 'Syncing…', synced: 'Synced', offline: 'Offline', error: 'Sync error',
} as const;

function ago(ts?: number) {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  return `${Math.round(s / 60)} min ago`;
}

export default function SyncMenu() {
  const sync = useSync();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e: MouseEvent) => { if (panel.current && !panel.current.contains(e.target as Node) && !(e.target as HTMLElement).closest('.sync-btn')) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  if (sync.status === 'unavailable' || sync.status === 'checking') return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="sync">
      <button className="sync-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog" title="Sync this progress across devices">
        <span className={`sync-dot s-${sync.status}`} aria-hidden="true" />
        <span className="sync-label">{LABEL[sync.status]}</span>
      </button>
      {open && (
        <div className="sync-panel" role="dialog" aria-label="Sync settings" ref={panel}>
          {shown ? (
            <>
              <h3>Your recovery code</h3>
              <p className="muted">This is the <b>only</b> way to get your progress on another device or after clearing this browser. We store just a hash, so we cannot show it again or reset it.</p>
              <code className="recovery" data-testid="recovery-code">{shown}</code>
              <div className="sync-row">
                <button className="btn" onClick={() => { void navigator.clipboard?.writeText(shown); }}>Copy</button>
                <label className="check-line"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I saved it somewhere safe</label>
              </div>
              <button className="btn primary" disabled={!saved} onClick={() => { setShown(null); setSaved(false); }}>Done</button>
            </>
          ) : sync.hasProfile ? (
            <>
              <h3>Sync is on</h3>
              <p className="muted">{LABEL[sync.status]}{sync.lastSyncedAt ? ` · ${ago(sync.lastSyncedAt)}` : ''}. Your progress is saved here first, then merged with your other devices.</p>
              {sync.message && <p className="sync-msg">{sync.message}</p>}
              <div className="sync-row">
                <button className="btn" onClick={() => run(syncNow)} disabled={busy}>Sync now</button>
                <button className="btn ghost" onClick={() => run(signOut)} disabled={busy}>Sign out this device</button>
              </div>
              <details className="sync-danger">
                <summary>Delete my synced data</summary>
                <p className="muted">Removes your profile and share links from the server. Progress stays in this browser.</p>
                <button className="btn ghost danger" disabled={busy} onClick={() => { if (confirm('Delete your server profile and all share links? This cannot be undone.')) void run(deleteAccount); }}>Delete from server</button>
              </details>
            </>
          ) : (
            <>
              <h3>Keep your progress across devices</h3>
              <p className="muted">No email, no password. You get a recovery code; enter it on any other device to continue where you left off.</p>
              {sync.message && <p className="sync-msg">{sync.message}</p>}
              <button className="btn primary" disabled={busy} onClick={() => run(async () => { setShown(await createProfile()); })}>Create a sync profile</button>
              <div className="sync-or">or use a code you already have</div>
              <form className="sync-row" onSubmit={(e) => { e.preventDefault(); void run(async () => { await recoverProfile(code); setCode(''); }); }}>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX-…" aria-label="Recovery code" autoComplete="off" spellCheck={false} />
                <button className="btn" type="submit" disabled={busy || code.trim().length < 10}>Connect</button>
              </form>
            </>
          )}
          {err && <p className="sync-err" role="alert">{err}</p>}
        </div>
      )}
    </div>
  );
}
