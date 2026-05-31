# Navigation Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the scattered floating navigation cards with a single themed left-edge panel plus a speed sign that floats beside it, redesigned for a 1920×1080 in-car touchscreen.

**Architecture:** A solid left panel (`NavigationPanel`) holds maneuver, street, lane guidance, an upcoming-steps list, and a footer (ETA + End). A separate `SpeedLimitBadge` floats on the map just outside the panel's right edge showing live speed vs. limit. Pure formatting/logic lives in `src/lib/navFormat.ts` so it is unit-testable. All colors come from existing `--mila-*` theme variables; typography switches to Inter.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, motion/react, Vitest + @testing-library/react, next/font.

---

## Baseline note

Before starting, the suite has **two pre-existing failures** unrelated to most of this work:
- `src/lib/mapbox-directions.test.ts` — stale (doesn't expect `name`/`maxspeedKmh`). **Task 3 fixes this.**
- `src/lib/mapbox-geocoding.test.ts` — unrelated (`types=poi` assertion). **Out of scope; leave as-is.**

When a step says "run tests," scope it to the relevant file (shown in each step) so this unrelated failure doesn't create noise.

## File Structure

- **Create** `src/lib/navFormat.ts` — pure helpers: `formatDistance`, `formatArrival`, `formatRemaining`, `isOverLimit`, `modifierToIndications`.
- **Create** `src/lib/navFormat.test.ts` — unit tests for the helpers.
- **Create** `src/components/map/SpeedLimitBadge.tsx` — floating speed circle.
- **Create** `src/components/map/SpeedLimitBadge.test.tsx` — render tests.
- **Modify** `src/lib/mapbox-directions.ts` — add `maneuverModifier` to `StepInfo`.
- **Modify** `src/lib/mapbox-directions.test.ts` — update expected step shape (also clears the stale failure).
- **Rewrite** `src/components/map/NavigationPanel.tsx` — the new left panel.
- **Create** `src/components/map/NavigationPanel.test.tsx` — render tests.
- **Modify** `src/components/map/NavigationOverlay.tsx` — pass `gpsSpeed`/`onEnd` to the panel; remove the top-right End button.
- **Modify** `src/app/layout.tsx` — load Inter via `next/font` and apply it globally.

---

### Task 1: Add `maneuverModifier` to StepInfo

**Files:**
- Modify: `src/lib/mapbox-directions.ts`
- Modify (test): `src/lib/mapbox-directions.test.ts`

- [ ] **Step 1: Update the stale test to the current + new step shape**

In `src/lib/mapbox-directions.test.ts`, replace the two `expect(result.steps[...]).toEqual({...})` blocks (currently lines ~105–122) with:

```ts
    expect(result.steps[0]).toEqual({
      instruction: 'Head east on Marszałkowska',
      name: '',
      distance: 450.2,
      maxspeedKmh: null,
      maneuverModifier: null,
      lanes: [
        { indications: ['left'], valid: true, active: false },
        { indications: ['straight', 'right'], valid: true, active: true },
      ],
    });

    expect(result.steps[1]).toEqual({
      instruction: 'Turn right onto Aleje Jerozolimskie',
      name: '',
      distance: 1200.8,
      maxspeedKmh: null,
      maneuverModifier: null,
      lanes: [
        { indications: ['straight'], valid: true, active: false },
        { indications: ['straight'], valid: true, active: true },
        { indications: ['right'], valid: true, active: false },
      ],
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/mapbox-directions.test.ts`
Expected: FAIL — received object is missing `maneuverModifier`.

- [ ] **Step 3: Add the field to the type and parser**

In `src/lib/mapbox-directions.ts`, add to the `StepInfo` interface (after `maxspeedKmh`):

```ts
  maneuverModifier: string | null;
```

And in `parseRoute`, in the returned step object (after the `maxspeedKmh,` line), add:

```ts
      maneuverModifier: step?.maneuver?.modifier ?? null,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/mapbox-directions.test.ts`
Expected: PASS (both tests in the file green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mapbox-directions.ts src/lib/mapbox-directions.test.ts
git commit -m "feat: capture maneuver modifier in StepInfo"
```

---

### Task 2: Pure nav formatting helpers

**Files:**
- Create: `src/lib/navFormat.ts`
- Test: `src/lib/navFormat.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/navFormat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatArrival,
  formatRemaining,
  isOverLimit,
  modifierToIndications,
} from './navFormat';

describe('formatDistance', () => {
  it('uses metres under 1000', () => {
    expect(formatDistance(400)).toEqual({ value: '400', unit: 'm' });
  });
  it('rounds metres', () => {
    expect(formatDistance(449.6)).toEqual({ value: '450', unit: 'm' });
  });
  it('uses km at/above 1000 with one decimal', () => {
    expect(formatDistance(8400)).toEqual({ value: '8.4', unit: 'km' });
  });
  it('returns a dash for zero/invalid', () => {
    expect(formatDistance(0)).toEqual({ value: '—', unit: 'm' });
    expect(formatDistance(Number.NaN)).toEqual({ value: '—', unit: 'm' });
  });
});

describe('formatArrival', () => {
  it('returns placeholder for non-positive duration', () => {
    expect(formatArrival(0)).toBe('--:--');
  });
  it('returns a clock-like string for a positive duration', () => {
    expect(formatArrival(600, 0)).toMatch(/\d/);
  });
});

describe('formatRemaining', () => {
  it('formats minutes and km', () => {
    expect(formatRemaining(720, 8400)).toEqual({ min: '12', km: '8.4' });
  });
  it('uses dashes when empty', () => {
    expect(formatRemaining(0, 0)).toEqual({ min: '—', km: '—' });
  });
});

describe('isOverLimit', () => {
  it('true only when speed exceeds a known limit', () => {
    expect(isOverLimit(58, 50)).toBe(true);
    expect(isOverLimit(48, 50)).toBe(false);
    expect(isOverLimit(50, 50)).toBe(false);
  });
  it('false when either value is missing', () => {
    expect(isOverLimit(null, 50)).toBe(false);
    expect(isOverLimit(60, null)).toBe(false);
  });
});

describe('modifierToIndications', () => {
  it('maps turn modifiers to LaneArrow indications', () => {
    expect(modifierToIndications('left')).toEqual(['left']);
    expect(modifierToIndications('sharp left')).toEqual(['left']);
    expect(modifierToIndications('slight right')).toEqual(['slight right']);
    expect(modifierToIndications('uturn')).toEqual(['uturn']);
  });
  it('defaults to straight for null/unknown', () => {
    expect(modifierToIndications(null)).toEqual(['straight']);
    expect(modifierToIndications('roundabout')).toEqual(['straight']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/navFormat.test.ts`
Expected: FAIL — cannot find module `./navFormat`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/navFormat.ts`:

```ts
export function formatDistance(meters: number): { value: string; unit: 'm' | 'km' } {
  if (!Number.isFinite(meters) || meters <= 0) return { value: '—', unit: 'm' };
  if (meters >= 1000) return { value: (meters / 1000).toFixed(1), unit: 'km' };
  return { value: String(Math.round(meters)), unit: 'm' };
}

export function formatArrival(durationSec: number, now: number = Date.now()): string {
  if (!(durationSec > 0)) return '--:--';
  const d = new Date(now + durationSec * 1000);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatRemaining(
  durationSec: number,
  distanceM: number,
): { min: string; km: string } {
  const min = durationSec > 0 ? String(Math.round(durationSec / 60)) : '—';
  const km = distanceM > 0 ? (distanceM / 1000).toFixed(1) : '—';
  return { min, km };
}

export function isOverLimit(speedKmh: number | null, limitKmh: number | null): boolean {
  if (speedKmh == null || limitKmh == null) return false;
  return speedKmh > limitKmh;
}

export function modifierToIndications(modifier: string | null): string[] {
  switch (modifier) {
    case 'left':
    case 'sharp left':
      return ['left'];
    case 'slight left':
      return ['slight left'];
    case 'right':
    case 'sharp right':
      return ['right'];
    case 'slight right':
      return ['slight right'];
    case 'uturn':
      return ['uturn'];
    default:
      return ['straight'];
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/navFormat.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/navFormat.ts src/lib/navFormat.test.ts
git commit -m "feat: add pure nav formatting helpers"
```

---

### Task 3: SpeedLimitBadge component

**Files:**
- Create: `src/components/map/SpeedLimitBadge.tsx`
- Test: `src/components/map/SpeedLimitBadge.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/map/SpeedLimitBadge.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpeedLimitBadge from './SpeedLimitBadge';

describe('SpeedLimitBadge', () => {
  it('renders live speed and MAX caption under the limit', () => {
    render(<SpeedLimitBadge speedKmh={48} limitKmh={50} />);
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('MAX 50')).toBeInTheDocument();
    expect(screen.getByTestId('speed-badge').getAttribute('data-over')).toBe('false');
  });

  it('marks over-limit when speed exceeds the limit', () => {
    render(<SpeedLimitBadge speedKmh={58} limitKmh={50} />);
    expect(screen.getByTestId('speed-badge').getAttribute('data-over')).toBe('true');
  });

  it('omits the MAX caption when no limit is known', () => {
    render(<SpeedLimitBadge speedKmh={42} limitKmh={null} />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.queryByText(/MAX/)).toBeNull();
  });

  it('renders nothing when neither speed nor limit is available', () => {
    const { container } = render(<SpeedLimitBadge speedKmh={null} limitKmh={null} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/map/SpeedLimitBadge.test.tsx`
Expected: FAIL — cannot find module `./SpeedLimitBadge`.

- [ ] **Step 3: Implement the component**

Create `src/components/map/SpeedLimitBadge.tsx`:

```tsx
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/map/SpeedLimitBadge.test.tsx`
Expected: PASS (4 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/map/SpeedLimitBadge.tsx src/components/map/SpeedLimitBadge.test.tsx
git commit -m "feat: add floating SpeedLimitBadge"
```

---

### Task 4: Rewrite NavigationPanel as the left panel

**Files:**
- Rewrite: `src/components/map/NavigationPanel.tsx`
- Test: `src/components/map/NavigationPanel.test.tsx`

- [ ] **Step 1: Write the failing render test**

Create `src/components/map/NavigationPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NavigationPanel from './NavigationPanel';
import type { RouteData } from '@/lib/mapbox-directions';

const route: RouteData = {
  geometry: { type: 'LineString', coordinates: [] },
  duration: 720,
  distance: 8400,
  steps: [
    { instruction: 'Turn left onto Main Street', name: 'Main Street', distance: 400, maxspeedKmh: 50, maneuverModifier: 'left', lanes: [] },
    { instruction: 'Turn right onto Oak Ave', name: 'Oak Ave', distance: 1600, maxspeedKmh: 50, maneuverModifier: 'right', lanes: [] },
    { instruction: 'Merge onto Highway 7', name: 'Highway 7', distance: 4000, maxspeedKmh: 90, maneuverModifier: 'straight', lanes: [] },
  ],
};

describe('NavigationPanel', () => {
  it('shows the hero distance with a separate unit', () => {
    render(<NavigationPanel route={route} gpsSpeed={48} onEnd={() => {}} />);
    expect(screen.getByText('400')).toBeInTheDocument();
    expect(screen.getByText('m')).toBeInTheDocument();
  });

  it('shows the current instruction and an upcoming list', () => {
    render(<NavigationPanel route={route} gpsSpeed={48} onEnd={() => {}} />);
    expect(screen.getByText('Turn left onto Main Street')).toBeInTheDocument();
    expect(screen.getByText('Oak Ave')).toBeInTheDocument();
    expect(screen.getByText('Highway 7')).toBeInTheDocument();
  });

  it('calls onEnd when End is tapped', async () => {
    const onEnd = vi.fn();
    render(<NavigationPanel route={route} gpsSpeed={48} onEnd={onEnd} />);
    await userEvent.click(screen.getByRole('button', { name: 'End' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/map/NavigationPanel.test.tsx`
Expected: FAIL (current panel has no `gpsSpeed`/`onEnd` props and different markup; assertions miss).

- [ ] **Step 3: Replace the component implementation**

Replace the entire contents of `src/components/map/NavigationPanel.tsx` with:

```tsx
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
  const upcoming = route.steps.slice(1, 5);

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

  const thenText = next
    ? `then ${next.instruction.charAt(0).toLowerCase()}${next.instruction.slice(1)}`
    : 'Continue on current road';

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
          <div style={{ overflowY: 'auto', minHeight: 0 }}>
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/map/NavigationPanel.test.tsx`
Expected: PASS (3 tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/map/NavigationPanel.tsx src/components/map/NavigationPanel.test.tsx
git commit -m "feat: redesign NavigationPanel as left-edge panel"
```

---

### Task 5: Wire NavigationOverlay to the new panel

**Files:**
- Modify: `src/components/map/NavigationOverlay.tsx`

- [ ] **Step 1: Pass `gpsSpeed` and `onEnd` into the panel**

In `src/components/map/NavigationOverlay.tsx`, find the navigation-panel block (currently around lines 280–291):

```tsx
      {isRouting && selectedRoute && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <NavigationPanel route={selectedRoute} />
        </motion.div>
      )}
```

Replace it with (the panel now animates itself, so drop the wrapper `motion.div`):

```tsx
      {isRouting && selectedRoute && (
        <NavigationPanel route={selectedRoute} gpsSpeed={gpsSpeed} onEnd={handleEndRoute} />
      )}
```

- [ ] **Step 2: Remove the top-right End button**

In the same file, delete the entire "End button — during routing" block (currently around lines 319–344), i.e. the comment plus the `<AnimatePresence>…{isRouting && (<motion.button …>End</motion.button>)}…</AnimatePresence>` that renders the top-right End button. The End action now lives in the panel footer.

- [ ] **Step 3: Remove the now-unused `X` import if it is no longer referenced**

Check whether `X` (from `lucide-react`, line 6) is still used elsewhere in the file. It is still used by the preview card's cancel button (`handleCancelPreview`), so **keep** the `X` import. Confirm `ArrowRight` is still used by the Go button (it is). No import changes needed.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.
Run: `npm run lint`
Expected: no new errors in `NavigationOverlay.tsx` / `NavigationPanel.tsx` / `SpeedLimitBadge.tsx`.

- [ ] **Step 5: Run the full component test set**

Run: `npx vitest run src/components/map/NavigationPanel.test.tsx src/components/map/SpeedLimitBadge.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/map/NavigationOverlay.tsx
git commit -m "feat: wire NavigationOverlay to redesigned panel; drop top-right End"
```

---

### Task 6: Load Inter font globally

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Import and apply Inter via next/font**

Replace the contents of `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SettingsBootstrap from "./SettingsBootstrap";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "MILA HMI",
  description: "In-car head-unit interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body style={{ margin: 0, padding: 0 }}>
        <SettingsBootstrap />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify the production build compiles (downloads the font)**

Run: `npm run build`
Expected: build completes successfully (Next fetches and self-hosts Inter). If the build environment has no network for Google Fonts, fall back to a system stack: set the `<body>` `style` to include `fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'` and remove the `next/font` import. Note which path was taken in the commit message.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: use Inter as the HMI UI font"
```

---

### Task 7: Full verification in the running app

**Files:** none (manual verification)

- [ ] **Step 1: Run the relevant test suite**

Run: `npx vitest run src/lib/navFormat.test.ts src/lib/mapbox-directions.test.ts src/components/map/NavigationPanel.test.tsx src/components/map/SpeedLimitBadge.test.tsx`
Expected: ALL PASS. (The unrelated `mapbox-geocoding.test.ts` failure remains out of scope.)

- [ ] **Step 2: Launch the app and drive a route**

Run: `npm run dev`, open the app, search a destination, tap **Go**.
Verify:
- Left panel appears on the left edge; map fills the rest.
- Header shows the maneuver arrow + distance (unit does not wrap onto its own line).
- Street name on its own line; "then …" preview below a divider.
- Lane guidance row appears only when the route step has lane data.
- "UPCOMING" list shows the next turns and scrolls if long.
- Footer shows arrival time + "X min · Y km" and an **End** button that ends the route and resets the map (bearing/pitch back to 0).
- Speed sign floats just to the right of the panel; shows live speed; "MAX nn" caption when a limit is known; number + caption turn red when you exceed it (can be checked by temporarily forcing `gpsSpeed` above the limit).
- No End button in the top-right corner anymore.

- [ ] **Step 3: Check all themes**

In settings, switch Theme between Dark / Light / Cute (and Custom if configured). Verify the panel restyles (background, text, accent maneuver tile, dividers) and stays legible; the speed sign's white/red and the red End stay fixed.

- [ ] **Step 4: Final commit (if any tweaks were needed)**

```bash
git add -A
git commit -m "chore: navigation panel redesign verification tweaks"
```

---

## Notes for the implementer

- **Theme variables** are set on `:root` by `applyTheme()` in `src/lib/settings.ts`; never hardcode panel colors — use the `var(--mila-*)` fallback strings shown in the panel code.
- **`gpsSpeed`** already exists as state in `NavigationOverlay` (km/h, updated from the geolocation watch). `step.maxspeedKmh` comes from the route's first step.
- **Maneuver icons** reuse `LaneArrow` from `turnArrows.tsx` via `modifierToIndications`. `LaneArrow` only distinguishes left / slight-left / right / slight-right / uturn / straight, which is why sharp turns map to the plain left/right arrow.
- **`color-mix`** for the active-lane tint is supported by the app's Chromium-based head unit; it already appears in the current codebase.
