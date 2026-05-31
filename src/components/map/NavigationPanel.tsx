'use client';

import { motion } from 'motion/react';
import type { RouteData } from '@/lib/mapbox-directions';
import { LaneArrow } from './turnArrows';
import SpeedLimitBadge from './SpeedLimitBadge';
import {
  formatDistance,
  formatArrival,
  formatRemaining,
  modifierToIndications,
} from '@/lib/navFormat';

interface NavigationPanelProps {
  route: RouteData;
  gpsSpeed: number | null;
  onEnd: () => void;
}

// ~400px at Normal UI scale; rem so the panel scales with the uiScale setting.
const PANEL_WIDTH = '25rem';

export default function NavigationPanel({ route, gpsSpeed, onEnd }: NavigationPanelProps) {
  const step = route.steps[0];
  const next = route.steps[1];
  const upcoming = route.steps.slice(2, 6);

  const dist = formatDistance(step?.distance ?? 0);
  const instruction = step?.instruction || 'Starting route…';
  const lanes = step?.lanes?.filter((l) => l.valid) ?? [];
  const arrival = formatArrival(route.duration);
  const { min, km } = formatRemaining(route.duration, route.distance);

  const text = 'var(--mila-text, #f5f5f7)';
  const muted = 'var(--mila-textSecondary, #999)';
  const border = 'var(--mila-border, #333)';
  const surface = 'var(--mila-surface, #2a2a2a)';
  const accent = 'var(--mila-accent, #818cf8)';
  const bg = 'var(--mila-bg, #1a1a1a)';

  let thenText: string;
  if (next?.name) {
    const nextDist = formatDistance(next.distance);
    thenText = `then ${next.name} · ${nextDist.value} ${nextDist.unit}`;
  } else if (next?.instruction) {
    thenText = `then ${next.instruction.charAt(0).toLowerCase()}${next.instruction.slice(1)}`;
  } else {
    thenText = 'Continue on current road';
  }

  return (
    <motion.aside
      className="absolute top-0 bottom-0 left-0 z-10"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: PANEL_WIDTH,
        background: surface,
        color: text,
        pointerEvents: 'auto',
        overflow: 'visible',
        display: 'flex',
        flexDirection: 'column',
        gap: 11,
        padding: '14px 13px',
        boxSizing: 'border-box',
        fontFeatureSettings: "'tnum' 1",
      }}
    >
      {/* Header: maneuver tile + hero distance */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div
          style={{
            background: accent,
            color: '#fff',
            width: 46,
            height: 46,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <LaneArrow indications={modifierToIndications(step?.maneuverModifier ?? null)} color="#fff" size={26} />
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, whiteSpace: 'nowrap' }}>
          <span>{dist.value}</span>
          <span style={{ fontSize: 17, fontWeight: 600, marginLeft: 3, color: muted }}>{dist.unit}</span>
        </div>
      </div>

      {/* Street (own full-width line) */}
      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{instruction}</div>

      {/* Then-preview + divider */}
      <div style={{ fontSize: 12, fontWeight: 500, color: muted, paddingBottom: 10, borderBottom: `1px solid ${border}` }}>
        {thenText}
      </div>

      {/* Lane guidance (only when present) */}
      {lanes.length > 0 && (
        <div style={{ display: 'flex', gap: 3 }}>
          {lanes.map((lane, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '5px 0',
                borderRadius: 6,
                background: lane.active ? `color-mix(in srgb, ${accent} 22%, transparent)` : bg,
              }}
            >
              <LaneArrow indications={lane.indications} color={lane.active ? text : muted} size={18} />
            </div>
          ))}
        </div>
      )}

      {/* Upcoming steps */}
      {upcoming.length > 0 && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: muted }}>
            Upcoming
          </div>
          <div style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}>
            {upcoming.map((s, i) => {
              const d = formatDistance(s.distance);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 0',
                    borderBottom: i < upcoming.length - 1 ? `1px solid ${border}` : 'none',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    <LaneArrow indications={modifierToIndications(s.maneuverModifier)} color={muted} size={18} />
                  </span>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.name || s.instruction}
                  </span>
                  <span style={{ fontSize: 12, color: muted, whiteSpace: 'nowrap' }}>
                    {d.value} {d.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Footer: ETA + End */}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingTop: 11,
          borderTop: `1px solid ${border}`,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{arrival}</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: muted }}>
            {min} min · {km} km
          </div>
        </div>
        <button
          type="button"
          onClick={onEnd}
          className="border-0 cursor-pointer"
          style={{
            background: 'rgba(255,59,48,0.16)',
            color: '#FF3B30',
            fontSize: 13,
            fontWeight: 700,
            borderRadius: 10,
            padding: '9px 16px',
          }}
        >
          End
        </button>
      </div>

      {/* Floating speed sign, just outside the panel's right edge */}
      <SpeedLimitBadge speedKmh={gpsSpeed} limitKmh={step?.maxspeedKmh ?? null} />
    </motion.aside>
  );
}
