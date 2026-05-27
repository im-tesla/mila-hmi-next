'use client';

import { useState } from 'react';
import type { RouteData } from '@/lib/mapbox-directions';
import { LaneArrow, getLaneLabel } from './turnArrows';
import { MapPin } from 'lucide-react';

interface NavigationPanelProps {
  route: RouteData;
  gpsSpeed: number | null;
}

export default function NavigationPanel({ route, gpsSpeed }: NavigationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const steps = route.steps;
  const currentStep = steps[0];
  const nextLanes = currentStep?.lanes?.filter((l) => l.valid) ?? [];

  const instruction = currentStep?.instruction ?? '';
  const distanceNow = currentStep?.distance ?? 0;
  const nextInstruction = steps.length > 1 ? steps[1].instruction : '';

  const textPrimary = 'var(--mila-text, #f5f5f7)';
  const textMuted = 'var(--mila-textSecondary, #999)';

  const cardStyle: React.CSSProperties = {
    background: 'var(--mila-surface, #2a2a2a)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--mila-border, #333)',
    borderRadius: 16,
    padding: '14px 16px',
  };

  return (
    <div className="absolute top-5 left-4 z-10 flex flex-col gap-2.5 max-w-[260px]">
      {/* Speed card */}
      <div style={cardStyle} className="flex items-center gap-3">
        <div>
          <span style={{ color: textPrimary, fontSize: 28, fontWeight: 600, lineHeight: 1 }}>
            {gpsSpeed !== null ? Math.round(gpsSpeed) : '--'}
          </span>
          <span style={{ color: textMuted, fontSize: 13 }}> km/h</span>
        </div>
        <div className="ml-auto">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: '#fff',
              border: '4px solid #FF3B30',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ color: '#1a1a1a', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>--</span>
          </div>
        </div>
      </div>

      {/* Lane guidance — road surface style (road stays dark like asphalt) */}
      {nextLanes.length > 0 && (
        <div style={cardStyle}>
          <div className="flex" style={{ gap: 0, background: '#1e1e1e', borderRadius: 10, overflow: 'hidden' }}>
            {nextLanes.map((lane, i) => {
              const isActive = lane.active;
              const arrowColor = isActive ? '#fff' : 'rgba(255,255,255,0.2)';
              return (
                <div key={i} className="flex">
                  {i > 0 && (
                    <div
                      style={{
                        width: 1,
                        background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 6px, transparent 6px, transparent 12px)',
                      }}
                    />
                  )}
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 48,
                      height: 64,
                      background: isActive ? 'rgba(74,158,255,0.15)' : 'transparent',
                      position: 'relative',
                    }}
                  >
                    <LaneArrow indications={lane.indications} color={arrowColor} size={22} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            {nextLanes.map((lane, i) => (
              <span
                key={i}
                style={{
                  color: lane.active ? textPrimary : textMuted,
                  fontSize: 10,
                  fontWeight: lane.active ? 500 : 400,
                  textAlign: 'center',
                  flex: 1,
                }}
              >
                {getLaneLabel(lane.indications)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next turn card */}
      <div style={cardStyle} className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(74,158,255,0.15)' }}
        >
          <MapPin size={18} stroke="rgba(74,158,255,0.8)" strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div style={{ color: textPrimary, fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {instruction}
          </div>
          <div style={{ color: textMuted, fontSize: 12 }}>
            {distanceNow >= 1000
              ? `${(distanceNow / 1000).toFixed(1)} km`
              : `${Math.round(distanceNow)} m`}
            {nextInstruction ? ` · then ${nextInstruction}` : ''}
          </div>
        </div>
      </div>

      {/* Expanded turn-by-turn list */}
      {expanded && (
        <div style={{ ...cardStyle, maxHeight: 256, overflowY: 'auto' }}>
          <div className="flex flex-col gap-3">
            {steps.map((step, i) => {
              const dist = step.distance >= 1000
                ? `${(step.distance / 1000).toFixed(1)} km`
                : `${Math.round(step.distance)} m`;
              const isCurrent = i === 0;
              return (
                <div key={i} className="flex items-center gap-3" style={{ opacity: isCurrent ? 1 : 0.45 }}>
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: isCurrent ? 'rgba(74,158,255,0.2)' : 'color-mix(in srgb, var(--mila-textSecondary, #999) 10%, transparent)',
                    }}
                  >
                    <LaneArrow
                      indications={step.lanes?.[0]?.indications ?? ['straight']}
                      color={isCurrent ? textPrimary : textMuted}
                      size={14}
                    />
                  </div>
                  <span style={{ color: isCurrent ? textPrimary : textMuted, fontSize: 13, flex: 1 }}>
                    {step.instruction}
                  </span>
                  <span style={{ color: textMuted, fontSize: 11 }}>{dist}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
