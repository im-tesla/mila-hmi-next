# Navigation System Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete reimplementation of the navigation UI layer with Apple CarPlay-style lane guidance, lucide-react icons, proper API endpoints, and bugfixes.

**Architecture:** Replace MapOverlay's `useReducer` state machine with simpler `useState` in a new `NavigationOverlay`. SearchBar becomes a top pill that expands with 3 quick chips (Gas, Fast Food, Shops). NavigationPanel provides Apple Maps-style top-left cluster (speed, road-style lanes, next turn). MapControls provides zoom/recenter. RouteLayer gets memory-leak fixes. Geocoding switches POIs back to v5 with `types=poi`. Directions uses `driving-traffic` + `language=en`.

**Tech Stack:** Next.js 16, React 19, mapbox-gl v3, lucide-react, Tailwind CSS 4, TypeScript

---

## File Structure Map

| File | Responsibility |
|------|---------------|
| `src/components/map/NavigationOverlay.tsx` | Top-level nav orchestrator — owns phase state, wires SearchBar + NavigationPanel + MapControls + RouteLayer |
| `src/components/map/SearchBar.tsx` | Top pill: collapsed "Where to?" → expanded dropdown with autocomplete + 3 quick chips |
| `src/components/map/NavigationPanel.tsx` | Top-left cluster: speed limit + GPS speed, road-style lane guidance, next turn |
| `src/components/map/MapControls.tsx` | Mid-right stack: zoom +, zoom −, recenter |
| `src/components/map/RouteLayer.tsx` | Map sources/layers: route polyline, destination marker, POI dots (with fixed cleanup) |
| `src/components/Toast.tsx` | Fixed bottom-center glass toast with slide-up animation |
| `src/lib/mapbox-geocoding.ts` | v5 geocoding: `fetchSuggestions` + `fetchPOIs` with AbortSignal support |
| `src/lib/mapbox-directions.ts` | `driving-traffic` profile, `language=en`, `voice_units=metric` |

Deleted: `MapOverlay.tsx`, `QuickRoutes.tsx`, `RoutePanel.tsx`, `LaneGuidance.tsx`

---

### Task 1: Install lucide-react dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install lucide-react**

```bash
npm install lucide-react
```

Expected: adds `lucide-react` to dependencies and `package-lock.json`

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lucide-react for navigation icons"
```

---

### Task 2: Fix mapbox-geocoding — v5 POI endpoint + AbortSignal

**Files:**
- Modify: `src/lib/mapbox-geocoding.ts`

- [ ] **Step 1: Rewrite geocoding with v5 POI endpoint and AbortSignal support**

Read the current file at `src/lib/mapbox-geocoding.ts`, then replace its contents with:

```typescript
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  lngLat: [number, number];
  category: string;
}

function mapFeature(f: any): SearchResult {
  const center = (f?.center ?? [0, 0]) as [number, number];
  return {
    id: f?.id ?? String(Array.isArray(center) ? center.join(',') : ''),
    name: f?.text ?? f?.place_name ?? '',
    address: f?.place_name ?? '',
    lngLat: center,
    category: f?.properties?.category ?? '',
  };
}

interface GeocodingOptions {
  signal?: AbortSignal;
}

export async function fetchSuggestions(
  query: string,
  proximity: [number, number],
  options?: GeocodingOptions,
): Promise<SearchResult[]> {
  if (!query) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('country', 'PL');
  url.searchParams.set('proximity', `${proximity[0]},${proximity[1]}`);
  url.searchParams.set('types', 'place,address,poi');
  url.searchParams.set('limit', '5');
  url.searchParams.set('language', 'pl');

  const res = await fetch(url.toString(), { signal: options?.signal });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();

  return (data?.features ?? []).map(mapFeature);
}

export async function fetchPOIs(
  query: string,
  proximity: [number, number],
  options?: GeocodingOptions,
): Promise<SearchResult[]> {
  if (!query) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('country', 'PL');
  url.searchParams.set('proximity', `${proximity[0]},${proximity[1]}`);
  url.searchParams.set('types', 'poi');
  url.searchParams.set('limit', '10');
  url.searchParams.set('language', 'pl');

  const res = await fetch(url.toString(), { signal: options?.signal });
  if (!res.ok) throw new Error(`POI search failed: ${res.status}`);
  const data = await res.json();

  return (data?.features ?? []).map(mapFeature);
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit src/lib/mapbox-geocoding.ts
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/mapbox-geocoding.ts
git commit -m "fix: switch POI geocoding to v5 API with AbortSignal support"
```

---

### Task 3: Fix mapbox-directions — driving-traffic + language=en

**Files:**
- Modify: `src/lib/mapbox-directions.ts`

- [ ] **Step 1: Rewrite directions with driving-traffic and language params**

Read the current file at `src/lib/mapbox-directions.ts`, then replace its contents with:

```typescript
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface LaneInfo {
  indications: string[];
  valid: boolean;
  active: boolean;
}

export interface StepInfo {
  instruction: string;
  distance: number;
  lanes: LaneInfo[];
}

export interface RouteData {
  geometry: GeoJSON.LineString;
  steps: StepInfo[];
  duration: number;
  distance: number;
}

export async function fetchRoute(
  origin: [number, number],
  destination: [number, number],
): Promise<RouteData> {
  const coords = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('language', 'en');
  url.searchParams.set('voice_units', 'metric');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Directions request failed: ${res.status}`);
  const data = await res.json();

  const route = data?.routes?.[0];
  const leg = route?.legs?.[0];

  return {
    geometry: route?.geometry ?? { type: 'LineString', coordinates: [] },
    steps: (leg?.steps ?? []).map((step: any) => ({
      instruction: step?.maneuver?.instruction ?? '',
      distance: step?.distance ?? 0,
      lanes: ((step?.intersections?.[0]?.lanes ?? []) as any[]).map((lane: any) => ({
        indications: lane?.indications ?? [],
        valid: lane?.valid ?? false,
        active: lane?.active ?? false,
      })),
    })),
    duration: route?.duration ?? 0,
    distance: route?.distance ?? 0,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mapbox-directions.ts
git commit -m "fix: use driving-traffic profile, add language=en and voice_units=metric"
```

---

### Task 4: Create Toast component

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Create Toast component**

Write `src/components/Toast.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback, createContext, useContext } from 'react';

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed bottom-8 left-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none"
        style={{ transform: 'translateX(-50%)' }}
      >
        {toasts.map((t) => (
          <ToastItemView key={t.id} message={t.message} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItemView({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      role="alert"
      onClick={onDismiss}
      className="pointer-events-auto cursor-pointer px-5 py-3 rounded-full text-sm font-medium"
      style={{
        background: 'rgba(28, 28, 30, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        color: '#fff',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add Toast component with glass-pill design"
```

---

### Task 5: Create MapControls component

**Files:**
- Create: `src/components/map/MapControls.tsx`

- [ ] **Step 1: Create MapControls component**

Write `src/components/map/MapControls.tsx`:

```typescript
'use client';

import type mapboxgl from 'mapbox-gl';
import { Plus, Minus, Crosshair } from 'lucide-react';

interface MapControlsProps {
  map: mapboxgl.Map | null;
}

export default function MapControls({ map }: MapControlsProps) {
  const handleZoomIn = () => map?.zoomIn({ duration: 300 });
  const handleZoomOut = () => map?.zoomOut({ duration: 300 });

  const handleRecenter = () => {
    if (!map) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 14,
            duration: 1200,
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 },
      );
    }
  };

  const btnClass =
    'w-10 h-10 rounded-xl flex items-center justify-center border-0 cursor-pointer transition-transform duration-[0.25s] ease-[cubic-bezier(0.16,1,0.3,1)]';
  const btnStyle: React.CSSProperties = {
    background: 'rgba(20,20,20,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  return (
    <div
      className="absolute flex flex-col gap-2 z-10"
      style={{ top: '50%', right: 16, transform: 'translateY(-50%)' }}
    >
      <button type="button" className={btnClass} style={btnStyle} onClick={handleZoomIn} aria-label="Zoom in">
        <Plus size={18} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
      </button>
      <button type="button" className={btnClass} style={btnStyle} onClick={handleZoomOut} aria-label="Zoom out">
        <Minus size={18} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
      </button>
      <button type="button" className={btnClass} style={btnStyle} onClick={handleRecenter} aria-label="Recenter">
        <Crosshair size={18} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/MapControls.tsx
git commit -m "feat: add MapControls with zoom and recenter buttons"
```

---

### Task 6: Create turn arrow helper for lane guidance

**Files:**
- Create: `src/components/map/turnArrows.tsx`

- [ ] **Step 1: Create turn arrow component**

Write `src/components/map/turnArrows.tsx`:

```typescript
import type { ReactNode } from 'react';

// Maps direction indications to SVG arrow paths
function getArrows(indications: string[]): { straight: boolean; slightRight: boolean; right: boolean; slightLeft: boolean; left: boolean; uturn: boolean } {
  const r = { straight: false, slightRight: false, right: false, slightLeft: false, left: false, uturn: false };
  for (const i of indications) {
    if (i === 'straight') r.straight = true;
    if (i === 'slight right') r.slightRight = true;
    if (i === 'right') r.right = true;
    if (i === 'slight left') r.slightLeft = true;
    if (i === 'left') r.left = true;
    if (i === 'uturn') r.uturn = true;
  }
  return r;
}

export function LaneArrow({ indications, color, size = 20 }: { indications: string[]; color: string; size?: number }) {
  const dirs = getArrows(indications);

  // Combine into the most specific single arrow
  if (dirs.uturn) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 22V10a4 4 0 00-8 0v2M4 10l3-3 3 3" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (dirs.left || dirs.slightLeft) {
    const d = dirs.left ? 'M16 19H8l-3-3 3-3' : 'M16 19H9l-2-2 2-2';
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {dirs.straight && <path d="M8 12V5" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.3} />}
      </svg>
    );
  }

  if (dirs.right || dirs.slightRight) {
    const d = dirs.right ? 'M8 19h8l3-3-3-3' : 'M8 19h7l2-2-2-2';
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={d} stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {dirs.straight && <path d="M16 12V5" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.3} />}
      </svg>
    );
  }

  // Straight only
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 19V5M8 9l4-4 4 4" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Returns a human-readable label for a lane
export function getLaneLabel(indications: string[]): string {
  if (indications.length === 0) return '';
  if (indications.includes('uturn')) return 'U-turn';
  if (indications.includes('left')) return 'Left';
  if (indications.includes('slight left')) return 'Slight left';
  if (indications.includes('right')) return 'Right';
  if (indications.includes('slight right')) return 'Slight right';
  if (indications.includes('straight')) return 'Straight';
  return '';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/turnArrows.tsx
git commit -m "feat: add turn arrow SVG helpers for lane guidance"
```

---

### Task 7: Create NavigationPanel component

**Files:**
- Create: `src/components/map/NavigationPanel.tsx`

- [ ] **Step 1: Create NavigationPanel with speed, lanes, and next turn cards**

Write `src/components/map/NavigationPanel.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef } from 'react';
import type { RouteData, LaneInfo } from '@/lib/mapbox-directions';
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

  // Find subsequent instruction
  const nextInstruction = steps.length > 1 ? steps[1].instruction : '';
  const nextDistance = steps.length > 1 ? steps[1].distance : 0;

  const durationMin = Math.round(route.duration / 60);
  const distanceKm = (route.distance / 1000).toFixed(1);

  const cardStyle: React.CSSProperties = {
    background: 'rgba(20,20,20,0.85)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: '14px 16px',
  };

  return (
    <div className="absolute top-5 left-4 z-10 flex flex-col gap-2.5 max-w-[260px]">
      {/* Speed card */}
      <div style={cardStyle} className="flex items-center gap-3">
        {/* Speed limit — EU red circle, shows "--" when unavailable */}
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
        <div>
          <span style={{ color: '#fff', fontSize: 28, fontWeight: 600, lineHeight: 1 }}>
            {gpsSpeed !== null ? Math.round(gpsSpeed) : '--'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}> km/h</span>
        </div>
      </div>

      {/* Lane guidance — road surface style */}
      {nextLanes.length > 0 && (
        <div style={cardStyle}>
          <div className="flex" style={{ gap: 0, background: '#2a2a2a', borderRadius: 10, overflow: 'hidden' }}>
            {nextLanes.map((lane, i) => {
              const isActive = lane.active;
              const arrowColor = isActive ? '#fff' : 'rgba(255,255,255,0.2)';
              return (
                <div key={i} className="flex">
                  {i > 0 && (
                    <div
                      style={{
                        width: 1,
                        background: 'repeating-linear-gradient(to bottom, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 6px, transparent 6px, transparent 12px)',
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
          {/* Lane labels */}
          <div className="flex justify-between mt-2">
            {nextLanes.map((lane, i) => (
              <span
                key={i}
                style={{
                  color: lane.active ? '#fff' : 'rgba(255,255,255,0.25)',
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
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {instruction}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
            {distanceNow >= 1000
              ? `${(distanceNow / 1000).toFixed(1)} km`
              : `${Math.round(distanceNow)} m`}
            {nextInstruction ? ` · then ${nextInstruction}` : ''}
          </div>
        </div>
      </div>

      {/* Expanded turn-by-turn list */}
      {expanded && (
        <div style={cardStyle} className="max-h-64 overflow-y-auto">
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
                      background: isCurrent ? 'rgba(74,158,255,0.2)' : 'rgba(255,255,255,0.05)',
                    }}
                  >
                    <LaneArrow
                      indications={step.lanes?.[0]?.indications ?? ['straight']}
                      color={isCurrent ? '#fff' : 'rgba(255,255,255,0.4)'}
                      size={14}
                    />
                  </div>
                  <span style={{ color: isCurrent ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 13, flex: 1 }}>
                    {step.instruction}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>{dist}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/NavigationPanel.tsx
git commit -m "feat: add NavigationPanel with speed, road-style lanes, and turn-by-turn"
```

---

### Task 8: Rewrite SearchBar component

**Files:**
- Modify: `src/components/map/SearchBar.tsx`

- [ ] **Step 1: Rewrite SearchBar with top pill + 3 quick chips + AbortController**

Read the current file at `src/components/map/SearchBar.tsx`, then replace its contents with:

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Fuel, UtensilsCrossed, ShoppingBag, X, MapPin } from 'lucide-react';
import { fetchSuggestions, fetchPOIs, type SearchResult } from '@/lib/mapbox-geocoding';
import { useToast } from '@/components/Toast';

const QUICK_CHIPS = [
  { id: 'gas', label: 'Gas', Icon: Fuel, query: 'stacja paliw' },
  { id: 'food', label: 'Fast Food', Icon: UtensilsCrossed, query: 'fast food' },
  { id: 'shops', label: 'Shops', Icon: ShoppingBag, query: 'sklep' },
] as const;

interface SearchBarProps {
  getProximity: () => [number, number];
  onSelectResult: (result: SearchResult) => void;
  onClear: () => void;
}

export default function SearchBar({ getProximity, onSelectResult, onClear }: SearchBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [quickResults, setQuickResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { show: showToast } = useToast();

  // Cancel in-flight request on unmount
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // Fetch autocomplete when user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    fetchSuggestions(query.trim(), getProximity(), { signal: controller.signal })
      .then((r) => {
        if (!controller.signal.aborted) setResults(r);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (!controller.signal.aborted) showToast('Search is unavailable right now.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, [query, getProximity, showToast]);

  const handleQuickChip = useCallback(
    (id: string, chipQuery: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setQuickResults([]);

      fetchPOIs(chipQuery, getProximity(), { signal: controller.signal })
        .then((r) => {
          if (!controller.signal.aborted) setQuickResults(r);
        })
        .catch((err) => {
          if (err.name === 'AbortError') return;
          if (!controller.signal.aborted) showToast('Search is unavailable right now.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    },
    [getProximity, showToast],
  );

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setExpanded(false);
      setQuery('');
      setResults([]);
      setQuickResults([]);
      onSelectResult(result);
    },
    [onSelectResult],
  );

  const handleClose = useCallback(() => {
    setExpanded(false);
    setQuery('');
    setResults([]);
    setQuickResults([]);
    onClear();
  }, [onClear]);

  const handleFocus = useCallback(() => {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const onDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [expanded, handleClose]);

  const showDropdown = expanded && (query.trim() || quickResults.length > 0 || loading);
  const hasQuickChips = !query.trim();

  return (
    <div ref={containerRef} className="absolute top-5 left-1/2 z-20" style={{ transform: 'translateX(-50%)' }}>
      {/* Backdrop */}
      {expanded && (
        <div
          className="fixed inset-0 z-[-1]"
          style={{
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
        />
      )}

      {/* Search card */}
      <div
        style={{
          width: expanded ? 400 : 360,
          background: expanded ? 'rgba(28,28,30,0.95)' : 'rgba(20,20,20,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 22,
          border: expanded ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-5 py-3.5">
          <Search size={18} stroke={expanded ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)'} strokeWidth={2} />
          {expanded ? (
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places..."
              className="flex-1 bg-transparent border-0 outline-none text-white text-[15px] placeholder:text-white/25"
              autoFocus
            />
          ) : (
            <span
              className="flex-1 text-[15px] cursor-pointer"
              style={{ color: 'rgba(255,255,255,0.35)' }}
              onClick={handleFocus}
            >
              Where to?
            </span>
          )}
          {expanded && (
            <button
              type="button"
              onClick={handleClose}
              className="border-0 bg-transparent cursor-pointer p-0.5"
            >
              <X size={16} stroke="rgba(255,255,255,0.2)" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Quick chips (only when no query) */}
        {expanded && hasQuickChips && (
          <div className="px-5 pb-2">
            <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Quick search
            </div>
            <div className="flex gap-2.5">
              {QUICK_CHIPS.map(({ id, label, Icon, query: chipQuery }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleQuickChip(id, chipQuery)}
                  className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl border-0 cursor-pointer transition-transform duration-[0.2s] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.03)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  <Icon size={20} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
                  <span className="text-white text-[13px] font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        {showDropdown && <div className="mx-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />}

        {/* Autocomplete results */}
        {showDropdown && !loading && query.trim() && results.length > 0 && (
          <div>
            {results.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-5 py-3.5 border-0 bg-transparent cursor-pointer text-left hover:bg-white/[0.04] transition-colors"
                style={{ borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <MapPin size={16} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
                <span className="text-white text-[14px] flex-1 truncate">{r.name}</span>
                <span className="text-white/25 text-[12px] flex-shrink-0">{r.address.split(',').slice(-2).join(',').trim()}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick route POI results */}
        {showDropdown && quickResults.length > 0 && (
          <div>
            {quickResults.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full flex items-center gap-3 px-5 py-3.5 border-0 bg-transparent cursor-pointer text-left hover:bg-white/[0.04] transition-colors"
                style={{ borderBottom: i < quickResults.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
              >
                <MapPin size={16} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[14px] truncate">{r.name}</div>
                  <div className="text-white/25 text-[12px] truncate">{r.address}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-5">
            <div
              className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{
                borderColor: 'rgba(255,255,255,0.1)',
                borderTopColor: 'rgba(255,255,255,0.4)',
              }}
            />
          </div>
        )}

        {/* Empty state for quick search */}
        {showDropdown && !loading && quickResults.length === 0 && !query.trim() && (
          <div className="text-center py-6 text-white/20 text-[13px]">
            Select a category to find nearby places
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/SearchBar.tsx
git commit -m "feat: rewrite SearchBar with top pill, 3 quick chips, and AbortController"
```

---

### Task 9: Fix RouteLayer memory leak

**Files:**
- Modify: `src/components/map/RouteLayer.tsx`

- [ ] **Step 1: Fix POI click handler cleanup**

Read the current file at `src/components/map/RouteLayer.tsx`, then replace its contents with:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { RouteData } from '@/lib/mapbox-directions';
import type { SearchResult } from '@/lib/mapbox-geocoding';

interface RouteLayerProps {
  map: mapboxgl.Map | null;
  route: RouteData | null;
  pois: SearchResult[];
  onPoiTap: (result: SearchResult) => void;
}

const ROUTE_SRC = 'mila-route-src';
const ROUTE_LINE = 'mila-route-line';
const DEST_SRC = 'mila-dest-src';
const DEST_DOT = 'mila-dest-dot';
const POI_SRC = 'mila-poi-src';
const POI_DOTS = 'mila-poi-dots';

export default function RouteLayer({ map, route, pois, onPoiTap }: RouteLayerProps) {
  const poiTapRef = useRef(onPoiTap);
  poiTapRef.current = onPoiTap;

  // Route + destination layer
  useEffect(() => {
    const m = map;
    if (!m) return;

    if (!m.loaded()) {
      const onLoad = () => setupRoute();
      m.once('style.load', onLoad);
      return () => { m.off('style.load', onLoad); cleanupRoute(); };
    }

    setupRoute();
    return cleanupRoute;

    function setupRoute() {
      if (!route) return;

      const coords = route.geometry.coordinates as [number, number][];

      if (!m.getSource(ROUTE_SRC)) {
        m.addSource(ROUTE_SRC, {
          type: 'geojson',
          data: { type: 'Feature', geometry: route.geometry, properties: {} },
        });
      }

      if (!m.getLayer(ROUTE_LINE)) {
        m.addLayer({
          id: ROUTE_LINE,
          type: 'line',
          source: ROUTE_SRC,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-width': 6, 'line-color': '#4A9EFF', 'line-opacity': 0.85 },
        });
      }

      if (coords.length > 0) {
        if (route.distance > 500000) {
          const [lng, lat] = coords[0];
          m.flyTo({ center: [lng, lat], zoom: 8, duration: 800 });
        } else {
          const bounds = coords.reduce(
            (b, [lng, lat]) => b.extend([lng, lat]),
            new mapboxgl.LngLatBounds(coords[0], coords[0]),
          );
          m.fitBounds(bounds, { padding: 120, duration: 800 });
        }
      }

      const lastCoord = coords[coords.length - 1];
      if (!m.getSource(DEST_SRC)) {
        m.addSource(DEST_SRC, {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Point', coordinates: lastCoord }, properties: {} },
        });
      }
      if (!m.getLayer(DEST_DOT)) {
        m.addLayer({
          id: DEST_DOT,
          type: 'circle',
          source: DEST_SRC,
          paint: { 'circle-radius': 8, 'circle-color': '#ef4444', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
        });
      }
    }

    function cleanupRoute() {
      try { if (m.getLayer(ROUTE_LINE)) m.removeLayer(ROUTE_LINE); } catch {}
      try { if (m.getSource(ROUTE_SRC)) m.removeSource(ROUTE_SRC); } catch {}
      try { if (m.getLayer(DEST_DOT)) m.removeLayer(DEST_DOT); } catch {}
      try { if (m.getSource(DEST_SRC)) m.removeSource(DEST_SRC); } catch {}
    }
  }, [map, route]);

  // POI markers layer
  useEffect(() => {
    const m = map;
    if (!m) return;

    let clickHandler: ((e: mapboxgl.MapMouseEvent) => void) | null = null;

    if (!m.loaded()) {
      const onLoad = () => setupPois();
      m.once('style.load', onLoad);
      return () => { m.off('style.load', onLoad); cleanupPois(); };
    }

    setupPois();
    return cleanupPois;

    function setupPois() {
      if (pois.length === 0) return;

      const poiMap = new Map(pois.map((p) => [p.id, p]));

      if (!m.getSource(POI_SRC)) {
        m.addSource(POI_SRC, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: pois.map((p) => ({
              type: 'Feature' as const,
              geometry: { type: 'Point' as const, coordinates: p.lngLat },
              properties: { id: p.id },
            })),
          },
        });
      } else {
        const src = m.getSource(POI_SRC) as mapboxgl.GeoJSONSource;
        src.setData({
          type: 'FeatureCollection',
          features: pois.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: p.lngLat },
            properties: { id: p.id },
          })),
        });
      }

      if (!m.getLayer(POI_DOTS)) {
        m.addLayer({
          id: POI_DOTS,
          type: 'circle',
          source: POI_SRC,
          paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-stroke-color': '#6366f1', 'circle-stroke-width': 2.5 },
        });
      }

      clickHandler = (e: mapboxgl.MapMouseEvent) => {
        if (!e.features?.[0]) return;
        const id = e.features[0].properties?.id as string | undefined;
        if (!id) return;
        const result = poiMap.get(id);
        if (result) poiTapRef.current(result);
      };

      m.on('click', POI_DOTS, clickHandler);
    }

    function cleanupPois() {
      if (clickHandler) m.off('click', POI_DOTS, clickHandler);
      try { if (m.getLayer(POI_DOTS)) m.removeLayer(POI_DOTS); } catch {}
      try { if (m.getSource(POI_SRC)) m.removeSource(POI_SRC); } catch {}
    }
  }, [map, pois]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/RouteLayer.tsx
git commit -m "fix: clean up POI click handler and remove cancelled flag pattern in RouteLayer"
```

---

### Task 10: Create NavigationOverlay (replaces MapOverlay)

**Files:**
- Create: `src/components/map/NavigationOverlay.tsx`
- Delete: `src/components/map/MapOverlay.tsx`
- Delete: `src/components/map/QuickRoutes.tsx`
- Delete: `src/components/map/RoutePanel.tsx`
- Delete: `src/components/map/LaneGuidance.tsx`

- [ ] **Step 1: Create NavigationOverlay with simplified state**

Write `src/components/map/NavigationOverlay.tsx`:

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import SearchBar from '@/components/map/SearchBar';
import NavigationPanel from '@/components/map/NavigationPanel';
import MapControls from '@/components/map/MapControls';
import RouteLayer from '@/components/map/RouteLayer';
import { fetchRoute, type RouteData } from '@/lib/mapbox-directions';
import type { SearchResult } from '@/lib/mapbox-geocoding';
import { useToast } from '@/components/Toast';

const WARSAW: [number, number] = [21.01, 52.23];

interface NavigationOverlayProps {
  map: mapboxgl.Map | null;
  rightPadding?: number;
}

export default function NavigationOverlay({ map, rightPadding = 0 }: NavigationOverlayProps) {
  const [selectedPoi, setSelectedPoi] = useState<SearchResult | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const centerRef = useRef<[number, number]>(WARSAW);
  const { show: showToast } = useToast();

  const isRouting = route !== null;

  // GPS speed tracking from geolocation
  useEffect(() => {
    if (!isRouting || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.speed !== null && pos.coords.speed !== undefined) {
          // speed is in m/s, convert to km/h
          setGpsSpeed(pos.coords.speed * 3.6);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isRouting]);

  const getProximity = useCallback((): [number, number] => {
    if (!map) return centerRef.current;
    const c = map.getCenter();
    centerRef.current = [c.lng, c.lat];
    return centerRef.current;
  }, [map]);

  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      setSelectedPoi(result);
      setRouteLoading(true);
      try {
        const pos = getProximity();
        const r = await fetchRoute(pos, result.lngLat);
        setRoute(r);
      } catch {
        showToast("Couldn't find a route there.");
      } finally {
        setRouteLoading(false);
      }
    },
    [getProximity, showToast],
  );

  const handleEndRoute = useCallback(() => {
    setRoute(null);
    setSelectedPoi(null);
    setGpsSpeed(null);
  }, []);

  const handleClear = useCallback(() => {
    // Search was cleared — stay idle
  }, []);

  const pois: SearchResult[] = selectedPoi ? [selectedPoi] : [];

  return (
    <div
      className="absolute top-0 bottom-0 left-0"
      style={{
        right: rightPadding,
        pointerEvents: 'none',
        transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'right',
      }}
    >
      {/* Search bar — always visible unless routing */}
      {!isRouting && (
        <div style={{ pointerEvents: 'auto' }}>
          <SearchBar
            getProximity={getProximity}
            onSelectResult={handleSelectResult}
            onClear={handleClear}
          />
        </div>
      )}

      {/* Navigation panel — only during routing */}
      {isRouting && route && (
        <NavigationPanel route={route} gpsSpeed={gpsSpeed} />
      )}

      {/* Map controls — always visible */}
      <MapControls map={map} />

      {/* Route layer — handles polylines + POI markers */}
      <RouteLayer map={map} route={route} pois={pois} onPoiTap={handleSelectResult} />

      {/* Loading indicator */}
      {routeLoading && (
        <div
          className="absolute bottom-8 left-0 right-0 text-center z-10"
          style={{ pointerEvents: 'auto' }}
        >
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Finding route…
          </span>
        </div>
      )}

      {/* End route button — top right during routing */}
      {isRouting && (
        <div className="absolute top-5 right-4 z-10" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={handleEndRoute}
            className="px-4 py-3 rounded-2xl text-[14px] font-medium border-0 cursor-pointer transition-transform duration-[0.25s] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              background: 'rgba(20,20,20,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#FF453A',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            End
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Delete old components**

```bash
git rm src/components/map/MapOverlay.tsx src/components/map/QuickRoutes.tsx src/components/map/RoutePanel.tsx src/components/map/LaneGuidance.tsx
```

- [ ] **Step 3: Commit**

```bash
git add src/components/map/NavigationOverlay.tsx
git commit -m "feat: add NavigationOverlay with simplified state, remove old nav components"
```

---

### Task 11: Wire NavigationOverlay into Map.tsx and add ToastProvider

**Files:**
- Modify: `src/components/Map.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update Map.tsx to import NavigationOverlay instead of MapOverlay**

In `src/components/Map.tsx`, change:
```typescript
import MapOverlay from '@/components/map/MapOverlay';
```
to:
```typescript
import NavigationOverlay from '@/components/map/NavigationOverlay';
```

And change:
```typescript
{mapReady && <MapOverlay map={mapRef.current!} rightPadding={rightPadding} />}
```
to:
```typescript
{mapReady && <NavigationOverlay map={mapRef.current!} rightPadding={rightPadding} />}
```

- [ ] **Step 2: Wrap page with ToastProvider**

In `src/app/page.tsx`, add the import:
```typescript
import { ToastProvider } from '@/components/Toast';
```

And wrap the HomeInner component. Change:
```typescript
function HomeInner() {
```
The `Home` component should wrap `HomeInner` with `ToastProvider`. Change the `Home` component to:

```typescript
export default function Home() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <HomeInner />
      </ToastProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Map.tsx src/app/page.tsx
git commit -m "feat: wire NavigationOverlay and ToastProvider into app"
```

---

### Task 12: Verify build compiles

**Files:** (none, verification only)

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors, fix them and re-run.

- [ ] **Step 2: Run the dev server and spot-check**

```bash
npm run dev
```

Open the app. Verify:
- Search bar pill is visible on the map
- Tapping it opens the dropdown with 3 quick chips (Gas, Fast Food, Shops)
- Typing hides the chips and shows autocomplete results
- Tapping a chip loads POI results
- Selecting a result draws a route on the map
- Navigation panel shows top-left with speed, lanes, and next turn
- Map controls (zoom +/-, recenter) work
- End button clears the route

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: resolve build issues from navigation refactor"
```

---

### Task 13: Cleanup — remove dead Settings Navigation tab references

**Files:**
- Modify: `src/components/SettingsPanel.tsx`

- [ ] **Step 1: Hide or remove the Navigation tab from SettingsPanel**

Find the Navigation tab in `SettingsPanel.tsx` (the one with local useState toggles for voice guidance, map orientation, avoid tolls, etc.) and either remove it entirely or comment it out with a `{/* Navigation tab — not yet wired */}` comment.

If removing, delete the entire Navigation tab section and its associated local state.

- [ ] **Step 2: Commit**

```bash
git add src/components/SettingsPanel.tsx
git commit -m "chore: remove dead Navigation tab from SettingsPanel"
```
