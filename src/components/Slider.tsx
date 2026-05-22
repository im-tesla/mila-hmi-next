'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

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
  const grabRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const pctRef = useRef(value);
  const rafRef = useRef(0);
  const pendingPctRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const apply = useCallback((pct: number, instant?: boolean) => {
    const fill = fillRef.current;
    const grab = grabRef.current;
    if (!fill || !grab) return;

    fill.style.transition = instant ? 'none' : '';
    grab.style.transition = instant ? 'none' : '';

    if (vertical) {
      fill.style.height = `${pct}%`;
      grab.style.bottom = `${pct}%`;
    } else {
      fill.style.width = `${pct}%`;
      grab.style.left = `${pct}%`;
    }
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
    apply(pct, true);
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
      setActive(false);
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }
      if (pendingPctRef.current !== null) {
        pctRef.current = pendingPctRef.current;
        apply(pendingPctRef.current, true);
        pendingPctRef.current = null;
      }
      // Restore CSS transitions for the non-dragging state
      const fill = fillRef.current;
      const grab = grabRef.current;
      if (fill) fill.style.transition = '';
      if (grab) grab.style.transition = '';
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
  }, [getPercent, onChange, vertical, apply, flushPending]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    setActive(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pct = getPercent(vertical ? e.clientY : e.clientX);
    pctRef.current = pct;
    apply(pct, true);
    onChange(pct);
  }, [getPercent, onChange, vertical, apply]);

  // Sync fill/grab when value changes from outside (e.g. reset)
  useEffect(() => {
    if (draggingRef.current) return;
    pctRef.current = value;
    apply(value, true);
  }, [value, apply]);

  // Center the track and grab handle
  const trackCenter = vertical
    ? { left: '50%', transform: 'translateX(-50%)', width: 4 }
    : { top: '50%', transform: 'translateY(-50%)', height: 4 };
  const fillBase = vertical
    ? { left: '50%', transform: 'translateX(-50%)', width: 4, bottom: 0, height: `${value}%` }
    : { top: '50%', transform: 'translateY(-50%)', height: 4, left: 0, width: `${value}%` };
  const grabBase = vertical
    ? { left: '50%', transform: 'translate(-50%, 50%)', bottom: `${value}%` }
    : { top: '50%', transform: 'translate(-50%, -50%)', left: `${value}%` };

  return (
    <div
      ref={trackRef}
      className={`relative cursor-pointer touch-none select-none ${className ?? (vertical ? 'w-8 h-36' : 'w-full h-8')}`}
      onPointerDown={onPointerDown}
      role="slider"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {/* Track background */}
      <div
        className="absolute top-0 bottom-0 rounded-full"
        style={{
          background: 'var(--mila-border, #e5e5e5)',
          ...trackCenter,
        }}
      />

      {/* Active fill — positioned via ref during drag, CSS transition otherwise */}
      <div
        ref={fillRef}
        className="absolute rounded-full"
        style={{
          background: 'var(--mila-accent, #0d9488)',
          transition: 'width 0.15s ease-out, height 0.15s ease-out',
          ...fillBase,
        }}
      />

      {/* Circular grab — positioned via ref during drag, CSS transition otherwise */}
      <div
        ref={grabRef}
        className="absolute rounded-full"
        style={{
          width: active ? 24 : 20,
          height: active ? 24 : 20,
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.16), 0 0 0 0.5px rgba(0,0,0,0.06)',
          transition: 'width 0.15s cubic-bezier(0.16, 1, 0.3, 1), height 0.15s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
          ...grabBase,
        }}
      />
    </div>
  );
}
