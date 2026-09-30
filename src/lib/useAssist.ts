import { useEffect, useState } from 'react';

const KEY = 'whetstone:assist';

/** Editor autocomplete preference, persisted. Off in interview mode regardless of this value. */
export function useAssist() {
  const [assist, setAssist] = useState(() => {
    try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, assist ? 'on' : 'off'); } catch { /* ignore */ }
  }, [assist]);
  return [assist, setAssist] as const;
}
