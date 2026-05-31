'use client';

import { isOverLimit } from '@/lib/navFormat';

interface SpeedLimitBadgeProps {
  speedKmh: number | null;
  limitKmh: number | null;
}

export default function SpeedLimitBadge({ speedKmh, limitKmh }: SpeedLimitBadgeProps) {
  const hasSpeed = speedKmh != null && Number.isFinite(speedKmh);
  if (!hasSpeed && limitKmh == null) return null;

  const over = isOverLimit(speedKmh, limitKmh);
  const ring = limitKmh == null ? '#888888' : '#FF3B30';
  const numColor = over ? '#FF3B30' : '#111111';

  return (
    <div
      data-testid="speed-badge"
      data-over={over}
      style={{
        position: 'absolute',
        top: 16,
        left: '100%',
        marginLeft: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#ffffff',
          border: `5px solid ${ring}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        }}
      >
        <span style={{ fontSize: 23, fontWeight: 800, lineHeight: 1, color: numColor, fontFeatureSettings: "'tnum' 1" }}>
          {hasSpeed ? Math.round(speedKmh as number) : '—'}
        </span>
      </div>
      {limitKmh != null && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: over ? '#FF6961' : '#ffffff',
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
          }}
        >
          MAX {limitKmh}
        </span>
      )}
    </div>
  );
}
