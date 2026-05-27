'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { RouteData } from '@/lib/mapbox-directions';
import { LaneArrow, getLaneLabel } from './turnArrows';
import { ChevronUp } from 'lucide-react';

interface NavigationPanelProps {
  route: RouteData;
}

function formatTime(ms: number): string {
  const d = new Date(Date.now() + ms * 1000);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function NavigationPanel({ route }: NavigationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const steps = route.steps;
  const currentStep = steps[0];
  const nextLanes = currentStep?.lanes?.filter((l) => l.valid) ?? [];

  const instruction = currentStep?.instruction ?? '';
  const distanceNow = currentStep?.distance ?? 0;
  const nextInstruction = steps.length > 1 ? steps[1].instruction : '';

  const textPrimary = 'var(--mila-text, #f5f5f7)';
  const textMuted = 'var(--mila-textSecondary, #999)';

  const cardBg = {
    background: 'var(--mila-surface, #2a2a2a)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
  };

  const arrivalTime = route.duration > 0 ? formatTime(route.duration) : '--:--';
  const remainingMin = route.duration > 0 ? Math.round(route.duration / 60) : '—';
  const remainingKm = route.distance > 0 ? (route.distance / 1000).toFixed(1) : '—';

  return (
    <>
      {/* ─── Primary Instruction Block (top-left) ─── */}
      <motion.div
        className="absolute top-5 left-4 z-10 flex flex-col"
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -16 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxWidth: 280, pointerEvents: 'auto' }}
      >
        {/* Lane guidance */}
        <div
          style={{
            ...cardBg,
            borderRadius: 16,
            padding: '12px 14px',
            marginBottom: 8,
          }}
        >
          <div className="flex" style={{ gap: 0, background: '#1e1e1e', borderRadius: 10, overflow: 'hidden', minHeight: 64 }}>
            {nextLanes.length > 0 ? nextLanes.map((lane, i) => {
              const isActive = lane.active;
              const arrowColor = isActive ? '#fff' : 'rgba(255,255,255,0.2)';
              return (
                <div key={i} className="flex">
                  {i > 0 && (
                    <div style={{
                      width: 1,
                      background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.12) 0, rgba(255,255,255,0.12) 6px, transparent 6px, transparent 12px)',
                    }} />
                  )}
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 48, height: 64,
                      background: isActive ? 'rgba(74,158,255,0.15)' : 'transparent',
                      position: 'relative',
                    }}
                  >
                    <LaneArrow indications={lane.indications} color={arrowColor} size={22} />
                  </div>
                </div>
              );
            }) : (
              <div className="flex items-center justify-center w-full" style={{ color: textMuted, fontSize: 12 }}>
                Lane guidance unavailable
              </div>
            )}
          </div>
          <div className="flex justify-between mt-1.5">
            {nextLanes.length > 0 ? nextLanes.map((lane, i) => (
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
            )) : (
              <span style={{ color: textMuted, fontSize: 10, textAlign: 'center', flex: 1 }}>—</span>
            )}
          </div>
        </div>

        {/* Instruction card */}
        <div
          style={{ ...cardBg, borderRadius: 16, padding: '16px 18px' }}
        >
          {/* Distance — hero metric */}
          <div style={{ color: textPrimary, fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>
            {distanceNow > 0
              ? (distanceNow >= 1000
                ? `${(distanceNow / 1000).toFixed(1)} km`
                : `${Math.round(distanceNow)} m`)
              : '—'}
          </div>

          {/* Current instruction */}
          <div style={{
            color: instruction ? textPrimary : textMuted, fontSize: 16, fontWeight: 500,
            marginTop: 6,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {instruction || 'Starting route…'}
          </div>

          {/* Next instruction preview */}
          <div style={{ color: textMuted, fontSize: 13, marginTop: 4 }}>
            {nextInstruction
              ? `Then ${nextInstruction.charAt(0).toLowerCase() + nextInstruction.slice(1)}`
              : 'Continue on current road'}
          </div>
        </div>

        {/* Speed limit — EU circle */}
        <div style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#fff',
              border: currentStep?.maxspeedKmh != null ? '5px solid #FF3B30' : '5px solid var(--mila-border, #333)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ color: '#1a1a1a', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>
              {currentStep?.maxspeedKmh != null ? currentStep.maxspeedKmh : '—'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── Trip Progress Capsule (bottom-left) ─── */}
      <motion.div
        className="absolute bottom-8 left-4 z-10"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        style={{ pointerEvents: 'auto' }}
      >
        <div
          style={{
            ...cardBg,
            borderRadius: 22,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
          }}
        >
          {/* Arrival time */}
          <div className="text-center">
            <div style={{ color: textPrimary, fontSize: 18, fontWeight: 600 }}>{arrivalTime}</div>
            <div style={{ color: textMuted, fontSize: 11 }}>arrival</div>
          </div>

          {/* Duration */}
          <div className="text-center">
            <div style={{ color: textPrimary, fontSize: 18, fontWeight: 600 }}>{remainingMin}</div>
            <div style={{ color: textMuted, fontSize: 11 }}>min</div>
          </div>

          {/* Distance */}
          <div className="text-center">
            <div style={{ color: textPrimary, fontSize: 18, fontWeight: 600 }}>{remainingKm}</div>
            <div style={{ color: textMuted, fontSize: 11 }}>km</div>
          </div>

          {/* Expand button — switches back to route selection */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center border-0 cursor-pointer"
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--mila-bg, #1a1a1a)',
              color: textMuted,
              transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <ChevronUp size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Expanded: turn-by-turn list */}
        <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            style={{
              ...cardBg,
              borderRadius: 16,
              maxHeight: 256,
              overflowY: 'auto',
              marginTop: 8,
              padding: '12px 16px',
            }}
          >
            <div className="flex flex-col gap-2">
              {steps.map((step, i) => {
                const dist = step.distance >= 1000
                  ? `${(step.distance / 1000).toFixed(1)} km`
                  : `${Math.round(step.distance)} m`;
                const isCurrent = i === 0;
                return (
                  <div key={i} className="flex items-center gap-3" style={{ opacity: isCurrent ? 1 : 0.4 }}>
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: 26, height: 26, borderRadius: 8,
                        background: isCurrent ? 'rgba(74,158,255,0.2)' : 'color-mix(in srgb, var(--mila-textSecondary, #999) 10%, transparent)',
                      }}
                    >
                      <LaneArrow
                        indications={step.lanes?.[0]?.indications ?? ['straight']}
                        color={isCurrent ? textPrimary : textMuted}
                        size={13}
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
          </motion.div>
        )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
