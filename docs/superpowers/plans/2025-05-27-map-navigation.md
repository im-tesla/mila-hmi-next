# Map Navigation Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add search, routing, quick POI routes, lane guidance, and turn-by-turn navigation to the existing Mapbox GL v3 map.

**Architecture:** Two API wrappers in `src/lib/` (geocoding + directions), six new components in `src/components/map/` (SearchBar, QuickRoutes, RouteLayer, RoutePanel, LaneGuidance, MapOverlay). MapOverlay orchestrates all via `useReducer` with states IDLE/SEARCHING/PREVIEW/ROUTING. Map.tsx passes the map instance down as a prop.

**Tech Stack:** mapbox-gl v3.23.1, React 19, TypeScript, Tailwind CSS v4, Mapbox Directions API v5, Mapbox Geocoding API v5

---

## File Structure

```
src/
├── lib/
│   ├── mapbox-geocoding.ts     (CREATE) — forward search + POI search wrappers
│   └── mapbox-directions.ts    (CREATE) — route fetch + lane parsing wrapper
├── components/
│   └── map/
│       ├── SearchBar.tsx       (CREATE) — floating search pill with autocomplete
│       ├── QuickRoutes.tsx     (CREATE) — horizontal POI category chips
│       ├── RouteLayer.tsx      (CREATE) — route polyline + markers on GL map
│       ├── RoutePanel.tsx      (CREATE) — ETA/distance + expandable turn-by-turn
│       ├── LaneGuidance.tsx    (CREATE) — lane indicator strip at intersections
│       └── MapOverlay.tsx      (CREATE) — orchestrator with useReducer state machine
├── components/
│   ├── Map.tsx                 (MODIFY) — expose map instance via prop, mount MapOverlay
│   └── MapClient.tsx           (MODIFY) — no changes needed (passes props through)
```

---

### Task 1: Geocoding API wrapper

**Files:**
- Create: `src/lib/mapbox-geocoding.ts`

- [ ] **Step 1: Write the geocoding API wrapper**

```typescript
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  lngLat: [number, number];
  category: string;
}

export async function fetchSuggestions(
  query: string,
  proximity: [number, number],
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

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();

  return (data.features ?? []).map((f: any) => ({
    id: f.id ?? String(f.center?.join(',') ?? ''),
    name: f.text ?? f.place_name ?? '',
    address: f.place_name ?? '',
    lngLat: f.center ?? [0, 0],
    category: f.properties?.category ?? '',
  }));
}

export async function fetchPOIs(
  query: string,
  proximity: [number, number],
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

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`POI search failed: ${res.status}`);
  const data = await res.json();

  return (data.features ?? []).map((f: any) => ({
    id: f.id ?? String(f.center?.join(',') ?? ''),
    name: f.text ?? f.place_name ?? '',
    address: f.place_name ?? '',
    lngLat: f.center ?? [0, 0],
    category: f.properties?.category ?? '',
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mapbox-geocoding.ts
git commit -m "feat: add Mapbox Geocoding API wrapper"
```

---

### Task 2: Directions API wrapper

**Files:**
- Create: `src/lib/mapbox-directions.ts`

- [ ] **Step 1: Write the directions API wrapper**

```typescript
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface LaneInfo {
  valid: boolean;
  active: boolean;
  validIndication:
    | 'straight'
    | 'left'
    | 'right'
    | 'slight left'
    | 'slight right'
    | 'sharp left'
    | 'sharp right'
    | 'uturn';
  indications: string[];
}

export interface StepInfo {
  instruction: string;
  distanceMeters: number;
  lanes?: LaneInfo[];
}

export interface RouteData {
  distanceKm: number;
  durationMinutes: number;
  polyline: GeoJSON.LineString;
  steps: StepInfo[];
}

function parseLanes(intersection: any): LaneInfo[] | undefined {
  if (!intersection?.lanes?.length) return undefined;
  return intersection.lanes.map((lane: any) => ({
    valid: lane.valid ?? false,
    active: lane.active ?? false,
    validIndication: lane.valid_indication ?? 'straight',
    indications: lane.indications ?? [],
  }));
}

export async function fetchRoute(
  origin: [number, number],
  dest: [number, number],
): Promise<RouteData> {
  const coords = `${origin[0]},${origin[1]};${dest[0]},${dest[1]}`;
  const url = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('steps', 'true');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('language', 'en');
  url.searchParams.set('voice_units', 'metric');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('banner_instructions', 'true');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Directions failed: ${res.status}`);
  const data = await res.json();

  const route = data.routes?.[0];
  if (!route) throw new Error('No route found');

  const leg = route.legs?.[0];
  if (!leg) throw new Error('No leg in route');

  const steps: StepInfo[] = (leg.steps ?? []).map((step: any) => ({
    instruction: step.maneuver?.instruction ?? '',
    distanceMeters: step.distance ?? 0,
    lanes: parseLanes(step.intersections?.[0]),
  }));

  return {
    distanceKm: Math.round((route.distance ?? 0) / 10) / 100,
    durationMinutes: Math.round((route.duration ?? 0) / 60),
    polyline: route.geometry as GeoJSON.LineString,
    steps,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mapbox-directions.ts
git commit -m "feat: add Mapbox Directions API wrapper with lane parsing"
```

---

### Task 3: SearchBar component

**Files:**
- Create: `src/components/map/SearchBar.tsx`

- [ ] **Step 1: Write the SearchBar component**

```tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchSuggestions, type SearchResult } from '@/lib/mapbox-geocoding';

interface SearchBarProps {
  proximity: [number, number];
  onSelect: (result: SearchResult) => void;
  onClear: () => void;
  onFocus: () => void;
  onBlur: () => void;
  isActive: boolean;
}

export default function SearchBar({
  proximity,
  onSelect,
  onClear,
  onFocus,
  onBlur,
  isActive,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchSuggestions(query, proximity);
        setResults(data);
      } catch {
        setError('Search unavailable');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, proximity]);

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError('');
    onClear();
  }, [onClear]);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div
        className="relative rounded-xl backdrop-blur-xl transition-all duration-300"
        style={{
          background: 'rgba(28,28,30,0.85)',
          width: isActive ? 360 : 320,
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div className="flex items-center h-12 px-4 gap-2">
          <svg
            className="w-4 h-4 shrink-0 opacity-50"
            fill="none"
            stroke="white"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={onFocus}
            onBlur={(e) => {
              if (!e.relatedTarget || !(e.relatedTarget as HTMLElement).closest('[data-search-dropdown]')) {
                setTimeout(() => onBlur(), 150);
              }
            }}
            placeholder="Search"
            className="flex-1 bg-transparent text-white placeholder-white/40 outline-none text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
            >
              <svg className="w-3 h-3" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isActive && results.length > 0 && (
          <div
            data-search-dropdown
            className="border-t border-white/10"
            style={{
              transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              willChange: 'opacity',
            }}
          >
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(r);
                  setQuery('');
                  setResults([]);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
              >
                <svg className="w-4 h-4 shrink-0 opacity-50" fill="none" stroke="white" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate">{r.name}</div>
                  <div className="text-xs text-white/40 truncate">{r.address}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {isActive && loading && query.length >= 2 && (
          <div className="px-4 py-3 text-sm text-white/40">Searching…</div>
        )}

        {isActive && error && (
          <div className="px-4 py-3 text-sm text-red-400">{error}</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/SearchBar.tsx
git commit -m "feat: add SearchBar component with autocomplete"
```

---

### Task 4: QuickRoutes component

**Files:**
- Create: `src/components/map/QuickRoutes.tsx`

- [ ] **Step 1: Write the QuickRoutes component**

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';

const QUICK_CATEGORIES = [
  { id: 'gas', label: 'Gas', query: 'stacja+paliw', icon: '⛽' },
  { id: 'food', label: 'Food', query: 'restauracja', icon: '🍔' },
  { id: 'parking', label: 'Parking', query: 'parking', icon: '🅿' },
  { id: 'rest', label: 'Rest', query: 'hotel', icon: '🛏' },
  { id: 'ev', label: 'EV', query: 'stacja+ładowania', icon: '⚡' },
  { id: 'grocery', label: 'Grocery', query: 'sklep+spożywczy', icon: '🛒' },
] as const;

interface QuickRoutesProps {
  onSelect: (query: string, id: string) => void;
  activeId: string | null;
  disabled: boolean;
}

export default function QuickRoutes({ onSelect, activeId, disabled }: QuickRoutesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(0);
  const scrollStart = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!scrollRef.current) return;
      setIsDragging(true);
      dragStart.current = e.clientX;
      scrollStart.current = scrollRef.current.scrollLeft;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !scrollRef.current) return;
      const dx = dragStart.current - e.clientX;
      scrollRef.current.scrollLeft = scrollStart.current + dx;
    },
    [isDragging],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="absolute bottom-4 left-0 right-0 z-10 px-4">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-hidden touch-pan-x select-none"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {QUICK_CATEGORIES.map((cat) => {
          const isActive = activeId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                if (isDragging) return;
                if (disabled) return;
                onSelect(cat.query, isActive ? '' : cat.id);
              }}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl backdrop-blur-xl text-sm whitespace-nowrap"
              style={{
                background: isActive
                  ? 'rgba(255,255,255,0.25)'
                  : 'rgba(28,28,30,0.75)',
                color: 'white',
                transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isActive ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <span className="text-base">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/QuickRoutes.tsx
git commit -m "feat: add QuickRoutes component with POI category chips"
```

---

### Task 5: RouteLayer component

**Files:**
- Create: `src/components/map/RouteLayer.tsx`

- [ ] **Step 1: Write the RouteLayer component**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { RouteData } from '@/lib/mapbox-directions';
import type { SearchResult } from '@/lib/mapbox-geocoding';

const ROUTE_SOURCE = 'mila-route-src';
const ROUTE_LAYER = 'mila-route-line';
const DEST_SOURCE = 'mila-dest-src';
const DEST_LAYER = 'mila-dest-dot';
const POI_SOURCE = 'mila-poi-src';
const POI_LAYER = 'mila-poi-dots';

interface RouteLayerProps {
  map: mapboxgl.Map | null;
  route: RouteData | null;
  pois: SearchResult[];
  onPoiTap: (poi: SearchResult) => void;
}

function getBbox(coords: [number, number][]): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

export default function RouteLayer({ map, route, pois, onPoiTap }: RouteLayerProps) {
  const poiClickRef = useRef<((e: any) => void) | null>(null);
  const onPoiTapRef = useRef(onPoiTap);
  onPoiTapRef.current = onPoiTap;

  useEffect(() => {
    if (!map || !map.loaded()) return;

    const removeSource = (id: string) => {
      try {
        if (map.getLayer(id + '-layer')) map.removeLayer(id + '-layer');
        if (map.getSource(id)) map.removeSource(id);
      } catch {}
    };

    // Route line
    if (route) {
      const coords = route.polyline.coordinates as [number, number][];
      removeSource(ROUTE_SOURCE);
      map.addSource(ROUTE_SOURCE, {
        type: 'geojson',
        data: { type: 'Feature', geometry: route.polyline, properties: {} },
      });
      map.addLayer({
        id: ROUTE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        paint: {
          'line-width': 6,
          'line-color': '#3b82f6',
          'line-opacity': 0.85,
          'line-cap': 'round',
          'line-join': 'round',
        },
      });

      // Fit bounds unless very long
      const totalDist = route.distanceKm;
      if (totalDist <= 500) {
        const bbox = getBbox(coords);
        try {
          map.fitBounds(bbox, { padding: 120, duration: 800 });
        } catch {}
      } else {
        map.flyTo({ center: coords[0], zoom: 8, duration: 800 });
      }

      // Destination marker
      const dest = coords[coords.length - 1];
      if (map.getLayer(DEST_LAYER)) map.removeLayer(DEST_LAYER);
      if (map.getSource(DEST_SOURCE)) map.removeSource(DEST_SOURCE);
      map.addSource(DEST_SOURCE, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: dest }, properties: {} },
      });
      map.addLayer({
        id: DEST_LAYER,
        type: 'circle',
        source: DEST_SOURCE,
        paint: {
          'circle-radius': 10,
          'circle-color': '#ef4444',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
    } else {
      removeSource(ROUTE_SOURCE);
      removeSource(DEST_SOURCE);
    }

    // POI markers
    removeSource(POI_SOURCE);
    if (pois.length > 0) {
      map.addSource(POI_SOURCE, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pois.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: p.lngLat },
            properties: { id: p.id, name: p.name },
          })),
        },
      });
      map.addLayer({
        id: POI_LAYER,
        type: 'circle',
        source: POI_SOURCE,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#6366f1',
          'circle-stroke-width': 2.5,
        },
      });

      if (poiClickRef.current) map.off('click', POI_LAYER, poiClickRef.current);
      poiClickRef.current = (e: any) => {
        const id = e.features?.[0]?.properties?.id;
        if (!id) return;
        const poi = pois.find((p) => p.id === id);
        if (poi) onPoiTapRef.current(poi);
      };
      map.on('click', POI_LAYER, poiClickRef.current);
    }
  }, [map, route, pois]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/RouteLayer.tsx
git commit -m "feat: add RouteLayer component for route polyline and markers"
```

---

### Task 6: RoutePanel component

**Files:**
- Create: `src/components/map/RoutePanel.tsx`

- [ ] **Step 1: Write the RoutePanel component**

```tsx
'use client';

import { useState, useMemo } from 'react';
import type { RouteData, StepInfo } from '@/lib/mapbox-directions';

interface RoutePanelProps {
  route: RouteData | null;
  onEnd: () => void;
  onStepClick?: (index: number) => void;
}

function formatDist(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatTime(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rm = min % 60;
  return rm > 0 ? `${h} h ${rm} min` : `${h} h`;
}

const ARROW_MAP: Record<string, string> = {
  'turn-left': '←',
  'turn-right': '→',
  'turn-sharp-left': '↰',
  'turn-sharp-right': '↱',
  'turn-slight-left': '↖',
  'turn-slight-right': '↗',
  'continue': '↑',
  'merge': '↗',
  'depart': '●',
  'arrive': '●',
  'roundabout': '⟳',
  'fork': '↗',
};

function arrowForInstruction(instruction: string): string {
  for (const [key, arrow] of Object.entries(ARROW_MAP)) {
    if (instruction.toLowerCase().includes(key.replace(/-/g, ' '))) return arrow;
  }
  return '↑';
}

export default function RoutePanel({ route, onEnd, onStepClick }: RoutePanelProps) {
  const [expanded, setExpanded] = useState(false);

  const currentStepIndex = useMemo(() => {
    if (!route) return 0;
    const total = route.steps.reduce((s, st) => s + st.distanceMeters, 0);
    let acc = 0;
    for (let i = 0; i < route.steps.length; i++) {
      const half = route.steps[i].distanceMeters / 2;
      if (acc + half >= total * 0.05) return i;
      acc += route.steps[i].distanceMeters;
    }
    return 0;
  }, [route]);

  if (!route) return null;

  const nextStep: StepInfo | undefined = route.steps[currentStepIndex];
  const arrow = nextStep ? arrowForInstruction(nextStep.instruction) : '●';

  return (
    <div
      className="absolute bottom-16 left-0 right-0 z-10"
      style={{
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
      }}
    >
      <div
        className="mx-4 rounded-2xl backdrop-blur-xl overflow-hidden"
        style={{ background: 'rgba(28,28,30,0.9)' }}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-4 px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-xl shrink-0">
              {arrow}
            </div>
            <div className="min-w-0">
              <div className="text-white font-semibold text-lg leading-tight">
                {formatTime(route.durationMinutes)}
              </div>
              <div className="text-white/60 text-sm">
                {route.distanceKm} km
              </div>
            </div>
          </div>
          <div className="text-white/80 text-sm truncate max-w-[160px]">
            {nextStep?.instruction ?? ''}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEnd();
            }}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 hover:bg-white/20 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="white" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </button>

        {expanded && (
          <div
            className="border-t border-white/10 px-1 pb-2"
            style={{
              animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            {route.steps.map((step, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onStepClick?.(i)}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                style={i === currentStepIndex ? { background: 'rgba(59,130,246,0.15)' } : undefined}
              >
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white text-xs shrink-0">
                  {arrowForInstruction(step.instruction)}
                </div>
                <div className="min-w-0 flex-1 text-sm text-white/80 truncate">
                  {step.instruction}
                </div>
                <div className="text-xs text-white/40 shrink-0">
                  {formatDist(step.distanceMeters)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/RoutePanel.tsx
git commit -m "feat: add RoutePanel component with ETA and turn-by-turn"
```

---

### Task 7: LaneGuidance component

**Files:**
- Create: `src/components/map/LaneGuidance.tsx`

- [ ] **Step 1: Write the LaneGuidance component**

```tsx
'use client';

import { useMemo } from 'react';
import type { LaneInfo } from '@/lib/mapbox-directions';

interface LaneGuidanceProps {
  lanes: LaneInfo[] | undefined;
}

const INDICATION_ARROW: Record<string, string> = {
  straight: '↑',
  left: '←',
  right: '→',
  'slight left': '↖',
  'slight right': '↗',
  'sharp left': '↰',
  'sharp right': '↱',
  uturn: '↶',
};

export default function LaneGuidance({ lanes }: LaneGuidanceProps) {
  const show = useMemo(() => {
    if (!lanes?.length) return false;
    const allStraight = lanes.every((l) => l.validIndication === 'straight');
    return !allStraight;
  }, [lanes]);

  if (!show) return null;

  return (
    <div
      className="absolute bottom-32 left-0 right-0 z-10 flex justify-center pointer-events-none"
      style={{
        transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity',
      }}
    >
      <div className="flex gap-2 px-4 py-2 rounded-2xl backdrop-blur-xl" style={{ background: 'rgba(28,28,30,0.85)' }}>
        {lanes.map((lane, i) => {
          const arrow = INDICATION_ARROW[lane.validIndication] ?? '↑';
          const isActive = lane.active;
          const isValid = lane.valid;

          return (
            <div
              key={i}
              className="flex items-center justify-center rounded-lg text-lg"
              style={{
                width: isActive || isValid ? 48 : 36,
                height: 64,
                background: isActive
                  ? 'white'
                  : isValid
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(255,255,255,0.05)',
                color: isActive ? '#1c1c1e' : isValid ? 'white' : 'rgba(255,255,255,0.25)',
                transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {arrow}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/LaneGuidance.tsx
git commit -m "feat: add LaneGuidance component"
```

---

### Task 8: MapOverlay orchestrator

**Files:**
- Create: `src/components/map/MapOverlay.tsx`

- [ ] **Step 1: Write the MapOverlay component with useReducer state machine**

```tsx
'use client';

import { useReducer, useCallback, useRef, useState, useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { SearchResult } from '@/lib/mapbox-geocoding';
import type { RouteData } from '@/lib/mapbox-directions';
import { fetchPOIs } from '@/lib/mapbox-geocoding';
import { fetchRoute } from '@/lib/mapbox-directions';
import SearchBar from './SearchBar';
import QuickRoutes from './QuickRoutes';
import RouteLayer from './RouteLayer';
import RoutePanel from './RoutePanel';
import LaneGuidance from './LaneGuidance';

type State =
  | { phase: 'IDLE' }
  | { phase: 'SEARCHING'; query?: string }
  | { phase: 'PREVIEW'; pois: SearchResult[]; activeCategory: string | null }
  | { phase: 'ROUTING'; route: RouteData; pois: SearchResult[]; activeCategory: string | null };

type Action =
  | { type: 'START_SEARCH' }
  | { type: 'CLEAR_SEARCH' }
  | { type: 'SELECT_RESULT'; result: SearchResult }
  | { type: 'LOAD_POIS'; pois: SearchResult[]; category: string }
  | { type: 'CLEAR_POIS' }
  | { type: 'START_ROUTE'; result: SearchResult }
  | { type: 'ROUTE_LOADED'; route: RouteData }
  | { type: 'END_ROUTE' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_SEARCH':
      return { phase: 'SEARCHING' };
    case 'CLEAR_SEARCH':
      return { phase: 'IDLE' };
    case 'SELECT_RESULT':
      return { phase: 'PREVIEW', pois: [action.result], activeCategory: null };
    case 'LOAD_POIS':
      return { phase: 'PREVIEW', pois: action.pois, activeCategory: action.category };
    case 'CLEAR_POIS':
      return { phase: 'IDLE' };
    case 'START_ROUTE': {
      const routeDraft = { phase: 'ROUTING' as const, route: null as unknown as RouteData, pois: state.phase === 'PREVIEW' ? state.pois : [], activeCategory: state.phase === 'PREVIEW' ? state.activeCategory : null };
      return routeDraft;
    }
    case 'ROUTE_LOADED':
      return {
        phase: 'ROUTING',
        route: action.route,
        pois: (state as any).pois ?? [],
        activeCategory: (state as any).activeCategory ?? null,
      };
    case 'END_ROUTE':
      return { phase: 'IDLE' };
    default:
      return state;
  }
}

const WARSAW_CENTER: [number, number] = [21.01, 52.23];

interface MapOverlayProps {
  map: mapboxgl.Map | null;
}

export default function MapOverlay({ map }: MapOverlayProps) {
  const [state, dispatch] = useReducer(reducer, { phase: 'IDLE' });
  const [userPos, setUserPos] = useState<[number, number]>(WARSAW_CENTER);
  const [routeLoading, setRouteLoading] = useState(false);
  const activeCategory = (state as any).activeCategory ?? null;

  useEffect(() => {
    if (!map) return;
    const onMove = () => {
      const c = map.getCenter();
      setUserPos([c.lng, c.lat]);
    };
    map.on('move', onMove);
    return () => { map.off('move', onMove); };
  }, [map]);

  const handleSearchFocus = useCallback(() => {
    dispatch({ type: 'START_SEARCH' });
  }, []);

  const handleSearchBlur = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' });
  }, []);

  const handleSearchSelect = useCallback((result: SearchResult) => {
    dispatch({ type: 'SELECT_RESULT', result });
  }, []);

  const handleSearchClear = useCallback(() => {
    dispatch({ type: 'CLEAR_SEARCH' });
  }, []);

  const handleQuickRoute = useCallback(async (query: string, id: string) => {
    if (!id) {
      dispatch({ type: 'CLEAR_POIS' });
      return;
    }
    try {
      const pois = await fetchPOIs(query, userPos);
      dispatch({ type: 'LOAD_POIS', pois, category: id });
    } catch {
      // silently fail — POI chips don't show errors
    }
  }, [userPos]);

  const handlePoiTap = useCallback(async (poi: SearchResult) => {
    dispatch({ type: 'START_ROUTE', result: poi });
    setRouteLoading(true);
    try {
      const route = await fetchRoute(userPos, poi.lngLat);
      dispatch({ type: 'ROUTE_LOADED', route });
    } catch {
      dispatch({ type: 'END_ROUTE' });
    } finally {
      setRouteLoading(false);
    }
  }, [userPos]);

  const handleEndRoute = useCallback(() => {
    dispatch({ type: 'END_ROUTE' });
  }, []);

  const route: RouteData | null = state.phase === 'ROUTING' ? state.route : null;
  const pois: SearchResult[] = state.phase === 'PREVIEW' || state.phase === 'ROUTING' ? (state as any).pois : [];
  const nextLanes = route?.steps[0]?.lanes;

  return (
    <>
      <SearchBar
        proximity={userPos}
        onSelect={handleSearchSelect}
        onClear={handleSearchClear}
        onFocus={handleSearchFocus}
        onBlur={handleSearchBlur}
        isActive={state.phase === 'SEARCHING'}
      />
      {state.phase !== 'ROUTING' && (
        <QuickRoutes
          onSelect={handleQuickRoute}
          activeId={activeCategory}
          disabled={false}
        />
      )}
      {state.phase === 'PREVIEW' && pois.length === 1 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <button
            type="button"
            onClick={() => handlePoiTap(pois[0])}
            className="px-5 py-2.5 rounded-xl backdrop-blur-xl text-white text-sm font-medium"
            style={{ background: 'rgba(28,28,30,0.85)' }}
          >
            Start navigation
          </button>
        </div>
      )}
      <RouteLayer map={map} route={route} pois={pois} onPoiTap={handlePoiTap} />
      {state.phase === 'ROUTING' && (
        <>
          {nextLanes && <LaneGuidance lanes={nextLanes} />}
          <RoutePanel route={route} onEnd={handleEndRoute} />
        </>
      )}
      {routeLoading && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-20 text-white/60 text-sm">
          Finding route…
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/map/MapOverlay.tsx
git commit -m "feat: add MapOverlay orchestrator with useReducer state machine"
```

---

### Task 9: Integrate MapOverlay into Map.tsx

**Files:**
- Modify: `src/components/Map.tsx`

- [ ] **Step 1: Add mapRef forwarding and mount MapOverlay**

Change the return JSX at the end of `src/components/Map.tsx` (lines 183-187) from:

```tsx
  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
```

To:

```tsx
  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {mapRef.current && <MapOverlay map={mapRef.current} />}
    </div>
  );
```

Also add the import at the top of the file (after line 6):

```typescript
import MapOverlay from '@/components/map/MapOverlay';
```

The full change in context:

```typescript
// ─── Line 6 area — add import
import { getSetting, subscribeSetting } from '@/lib/settings';
import MapOverlay from '@/components/map/MapOverlay';

// ... rest of file stays the same ...

// ─── Lines 183-187 — change return
  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {mapRef.current && <MapOverlay map={mapRef.current} />}
    </div>
  );
```

The issue with `mapRef.current` in render: since `useState` would trigger a re-render, but `useRef` won't, we need to force a render after map init. Add a state variable:

```typescript
const [mapReady, setMapReady] = useState(false);
```

Then inside the `map.once('style.load', ...)` callback (after the existing setup), add:

```typescript
      setMapReady(true);
```

And change the return to:

```tsx
      {mapReady && <MapOverlay map={mapRef.current!} />}
```

**Complete change to Map.tsx:**

At line 1-6, add the imports:

```typescript
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getSetting, subscribeSetting } from '@/lib/settings';
import MapOverlay from '@/components/map/MapOverlay';
```

At line 35 (after `const paddingRef = useRef(0);`), add:

```typescript
  const [mapReady, setMapReady] = useState(false);
```

Inside the `style.load` callback, after `map.once('style.load', () => {` and after existing code, add `setMapReady(true);`. The modified callback (around lines 119-138):

```typescript
    map.once('style.load', () => {
      onStyleReady();
      // Apply initial padding if panel is already open
      if (paddingRef.current > 0) {
        map.setPadding({ right: paddingRef.current });
      }
      setMapReady(true);
      if (!('geolocation' in navigator)) return;
      // ... rest unchanged
```

Change the return JSX at lines 183-187:

```tsx
  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {mapReady && <MapOverlay map={mapRef.current!} />}
    </div>
  );
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Map.tsx
git commit -m "feat: integrate MapOverlay into Map component"
```

---

### Task 10: Build verification

- [ ] **Step 1: Run the TypeScript compiler check**

```bash
npx tsc --noEmit
```

Expected: No errors. If any type errors appear, fix them inline.

- [ ] **Step 2: Run the Next.js build**

```bash
npm run build
```

Expected: Successful build with no errors.

- [ ] **Step 3: Manual testing checklist**

- Start dev server: `npm run dev`
- Open `http://localhost:3000` in Chrome
- Click search bar → type "Marszałkowska" → verify autocomplete results appear
- Select a result → verify marker appears on map, "Start navigation" button shows
- Click "Start navigation" → verify blue route line, ETA panel at bottom
- Tap quick route "Gas" → verify POI markers appear
- Tap a POI marker → verify routing starts
- Test lane guidance: route through Warsaw center (multi-lane intersection areas)
- Verify clear/search dismiss returns map to clean state
- Open side panel (spotify/any service) → verify map overlays don't overlap with panel

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: build verification and final fixes"
```
