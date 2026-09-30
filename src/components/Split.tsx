import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

interface Props {
  dir: 'row' | 'col';
  storageKey: string;
  initial: number;
  min?: number;
  max?: number;
  first: ReactNode;
  second: ReactNode;
  label: string;
}

function readRatio(key: string, fallback: number) {
  try {
    const v = parseFloat(localStorage.getItem(key) ?? '');
    if (v > 0 && v < 1) return v;
  } catch { /* ignore */ }
  return fallback;
}

/** Two panes with a draggable, keyboard-operable divider. Size is remembered per `storageKey`. */
export function Split({ dir, storageKey, initial, min = 0.2, max = 0.8, first, second, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => readRatio(storageKey, initial));
  const [dragging, setDragging] = useState(false);
  const clamp = useCallback((r: number) => Math.min(max, Math.max(min, r)), [min, max]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, String(ratio)); } catch { /* ignore */ }
  }, [ratio, storageKey]);

  const move = (e: PointerEvent) => {
    if (!dragging || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setRatio(clamp(dir === 'row' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height));
  };
  const key = (e: KeyboardEvent) => {
    const dec = dir === 'row' ? 'ArrowLeft' : 'ArrowUp';
    const inc = dir === 'row' ? 'ArrowRight' : 'ArrowDown';
    if (e.key === dec) { e.preventDefault(); setRatio((r) => clamp(r - 0.03)); }
    if (e.key === inc) { e.preventDefault(); setRatio((r) => clamp(r + 0.03)); }
  };

  return (
    <div ref={box} className={`split split-${dir}${dragging ? ' is-dragging' : ''}`} style={{ ['--ratio' as string]: ratio }}>
      <div className="split-pane split-first">{first}</div>
      <div
        className="split-handle"
        role="separator"
        aria-orientation={dir === 'row' ? 'vertical' : 'horizontal'}
        aria-label={label}
        aria-valuemin={Math.round(min * 100)}
        aria-valuemax={Math.round(max * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); setDragging(true); }}
        onPointerMove={move}
        onPointerUp={() => setDragging(false)}
        onKeyDown={key}
        onDoubleClick={() => setRatio(initial)}
      />
      <div className="split-pane split-second">{second}</div>
    </div>
  );
}
