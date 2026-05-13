'use client';

import { useRef, useCallback, useEffect } from 'react';

export default function Slider({
  value,
  onChange,
  vertical = true,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  vertical?: boolean;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pctRef = useRef(value);
  const rafRef = useRef(0);
  const pendingPctRef = useRef<number | null>(null);

  const apply = useCallback((pct: number) => {
    const fill = fillRef.current;
    if (!fill) return;
    fill.style[vertical ? 'height' : 'width'] = `${pct}%`;
  }, [vertical]);

  const getPercent = useCallback((coord: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const raw = vertical
      ? (1 - (coord - rect.top) / rect.height) * 100
      : ((coord - rect.left) / rect.width) * 100;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [vertical]);

  const flushPending = useCallback(() => {
    rafRef.current = 0;
    const pct = pendingPctRef.current;
    if (pct === null) return;
    pendingPctRef.current = null;
    pctRef.current = pct;
    apply(pct);
  }, [apply]);

  useEffect(() => {
    const prop = vertical ? 'clientY' : 'clientX';
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      pendingPctRef.current = getPercent(e[prop]);
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flushPending);
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      if (pendingPctRef.current !== null) {
        pctRef.current = pendingPctRef.current;
        apply(pendingPctRef.current);
        pendingPctRef.current = null;
      }
      onChange(pctRef.current);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [getPercent, apply, onChange, vertical, flushPending]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pct = getPercent(vertical ? e.clientY : e.clientX);
    pctRef.current = pct;
    apply(pct);
  }, [getPercent, apply, vertical]);

  useEffect(() => {
    if (draggingRef.current) return;
    pctRef.current = value;
    apply(value);
  }, [value, apply]);

  return (
    <div
      ref={trackRef}
      className={`relative rounded-full cursor-pointer touch-none select-none overflow-hidden ${
        className ?? (vertical ? 'w-full h-36' : 'w-full h-5')
      }`}
      style={{ background: 'var(--mila-border, #e5e5e5)' }}
      onPointerDown={onPointerDown}
    >
      <div
        ref={fillRef}
        className={`absolute ${vertical ? 'bottom-0 left-0 right-0' : 'top-0 left-0 bottom-0'}`}
        style={{
          [vertical ? 'height' : 'width']: `${value}%`,
          background: 'var(--mila-accent, #0d9488)',
          borderRadius: 'inherit',
        }}
      />
    </div>
  );
}
