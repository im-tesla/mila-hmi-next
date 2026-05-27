# Map Navigation Features — Design Spec

**Date:** 2025-05-27
**Status:** Approved

## Overview

Add search, routing, navigation, quick POI routes, and lane guidance to the existing Mapbox GL v3 map. The map is primarily used in Poland by an English-speaking user.

## Dependencies

- **mapbox-gl** v3.23.1 — already installed
- **Mapbox Directions API** (free tier: 100k requests/month)
- **Mapbox Geocoding API** (free tier: separate from Directions)
- **Browser Geolocation API** — already used for user position dot

## Architecture

### New files

```
src/
├── components/
│   └── map/
│       ├── SearchBar.tsx        Floating search pill with autocomplete
│       ├── QuickRoutes.tsx      Horizontal POI category chips
│       ├── RoutePanel.tsx       ETA/distance + expandable turn-by-turn
│       ├── LaneGuidance.tsx     Lane indicator strip at intersections
│       ├── MapOverlay.tsx       Orchestrator + state machine
│       └── RouteLayer.tsx       Route polyline + markers on GL map
└── lib/
    ├── mapbox-geocoding.ts      Geocoding API wrapper
    └── mapbox-directions.ts     Directions API wrapper (includes lane parsing)
```

### Integration with existing code

- `MapOverlay` mounts as a child inside `Map.tsx`'s container div, receiving the `map` instance via a prop or ref.
- All transient routing state is local to `MapOverlay` via `useReducer` — nothing added to `settings.ts`.
- The existing `page.tsx` clip-path + padding system is unaffected. Route panel slides in over the map, not from the side.

### State management

A `useReducer` inside `MapOverlay` with these states:

```
IDLE        — nothing shown (just the map)
SEARCHING   — user typing, autocomplete dropdown visible
PREVIEW     — POI markers on map (from quick route chip or search result)
ROUTING     — active route, polyline + route panel + lane guidance shown
```

Transitions:

```
IDLE → SEARCHING           focus search bar
SEARCHING → IDLE           tap away / blur / clear
SEARCHING → PREVIEW        select a search result
IDLE → PREVIEW             tap a quick-route chip
PREVIEW → ROUTING          tap a destination marker
ROUTING → IDLE             tap "End route" or clear search
ROUTING → ROUTING          change destination (re-route)
```

### Language & locale

| API | Setting |
|-----|---------|
| Geocoding forward search | `country=PL` bias, `proximity=<current_lng_lat>` |
| Directions turn-by-turn | `language=en` (English instructions) |
| Directions voice | `language=en`, `voice_units=metric` |
| Map default center (no GPS) | Warsaw: `[21.01, 52.23]` at zoom 14 |

---

## Component Specifications

### 1. `lib/mapbox-geocoding.ts` — Geocoding API wrapper

```typescript
interface SearchResult {
  id: string;
  name: string;
  address: string;
  lngLat: [number, number];
  category: string;         // e.g. "poi", "address", "locality"
}

function fetchSuggestions(
  query: string,
  proximity: [number, number]
): Promise<SearchResult[]>
// GET /geocoding/v5/mapbox.places/{query}.json
//   ?country=PL&proximity={proximity}&types=place,address,poi&limit=5

function fetchPOIs(
  query: string,              // e.g. "stacja+paliw", "restauracja"
  proximity: [number, number]
): Promise<SearchResult[]>
// GET /geocoding/v5/mapbox.places/{query}.json
//   ?country=PL&proximity={proximity}&types=poi&limit=10
```

### 2. `lib/mapbox-directions.ts` — Directions API wrapper

```typescript
interface LaneInfo {
  valid: boolean;
  active: boolean;
  validIndication: 'straight' | 'left' | 'right'
    | 'slight left' | 'slight right'
    | 'sharp left' | 'sharp right' | 'uturn';
  indications: string[];
}

interface StepInfo {
  instruction: string;
  distanceMeters: number;
  lanes?: LaneInfo[];     // from first intersection of this step
}

interface RouteData {
  distanceKm: number;
  durationMinutes: number;
  polyline: GeoJSON.LineString;
  steps: StepInfo[];
}

function fetchRoute(
  origin: [number, number],
  dest: [number, number]
): Promise<RouteData>
// GET /directions/v5/mapbox/driving-traffic/{origin};{dest}
//   ?steps=true&geometries=geojson&language=en&voice_units=metric
//   &overview=full&banner_instructions=true
```

Parsing notes:
- Route geometry comes from `routes[0].geometry` (GeoJSON LineString when `geometries=geojson`)
- Steps come from `routes[0].legs[0].steps[]`
- Lane data comes from `step.intersections[0].lanes[]` of each step
- Distance from `routes[0].distance` (meters → km), duration from `routes[0].duration` (seconds → minutes)

### 3. `SearchBar.tsx`

- **Position:** Top-center of map, 16px from top edge
- **Layout:** Rounded pill, frosted glass background (`rgba(28,28,30,0.85)`), ~48px height, 320px wide, centered
- **Icon:** Magnifying glass (search icon SVG) on the left
- **Input:** Text field, transparent background, white text, placeholder "Search"
- **Autocomplete dropdown:** Appears below the pill when focused and query ≥ 2 chars. 5 results max. Each row: icon (pin for address, location for POI), name, address subtitle. Frosted glass background. GPU-composited (`opacity` + `transform` for enter/exit).
- **Closed state:** Thin top-aligned pill. **Open state:** Pill shifts down slightly, dropdown slides in from opacity 0.
- **Clear button (×):** Appears when query is non-empty. Clears input, resets to IDLE.
- **Animation:** `cubic-bezier(0.16, 1, 0.3, 1)`, 300ms.
- **Edge cases:**
  - No results → full-screen tap to dismiss, search pill expands back
  - Network error → red flash on pill border + "No connection" text, auto-retry on next keystroke
  - API rate limit → "Try again" message, no crash
  - Empty query → no request sent
  - User taps outside → blur, dismiss dropdown

### 4. `QuickRoutes.tsx`

- **Position:** Bottom of map, above any route panel, 16px from bottom
- **Layout:** Horizontal row of capsule chips, horizontally scrollable (drag/swipe, no scrollbar)
- **Chips:** 6 categories:
  1. ⛽ Gas — `stacja+paliw`
  2. 🍔 Food — `restauracja`
  3. 🅿️ Parking — `parking`
  4. 🛏️ Rest — `hotel`
  5. ⚡ EV — `stacja+ładowania`
  6. 🛒 Grocery — `sklep+spożywczy`
- **Each chip:** Rounded pill, frosted glass, white icon + label. Scales to 1.05 on hover/touch. `transition: transform 0.15s cubic-bezier(0.16,1,0.3,1)`
- **On tap:** Calls `fetchPOIs()` with the Polish query, transitions state to PREVIEW, renders POI markers on map.
- **Edge cases:**
  - No POIs in area → chip shakes briefly, no state change
  - Tapping same chip again → clears preview (toggle behavior)
  - While routing → tapping a chip opens POI markers along the current route (re-center), doesn't cancel navigation

### 5. `RouteLayer.tsx`

- **Receives:** Map instance (via prop), route data, POI markers, user position
- **Route polyline:**
  - Source: `mila-route` (GeoJSON LineString)
  - Layer: `mila-route-line` — `type: 'line'`, 6px wide, blue gradient (`#3b82f6` to `#8b5cf6`), `line-cap: round`, `line-join: round`
  - Fits route bounds on first render with `map.fitBounds(bbox, { padding: 100, duration: 800 })`
- **Start marker:** Teal dot (reuse existing `mila-user-dot` style) or car icon at origin
- **Destination marker:** Red pin / flag at end of route
- **POI markers:** Small circular markers (white with category-colored dot) at each POI result. Slightly smaller than destination marker. Tappable → transitions to ROUTING with that POI as destination.
- **Cleanup:** Removes all added sources and layers when route is cleared.
- **Edge cases:**
  - Route crosses water / no roads → API returns error, show toast
  - Very long route (>500 km) → still render, but skip fitBounds (flyTo start instead)
  - Previous route still rendering → remove old layers before adding new

### 6. `RoutePanel.tsx`

- **Position:** Bottom of map, above quick routes, slides up from below
- **Animation:** `transform: translateY()` from 100% to 0, 300ms via `cubic-bezier(0.16,1,0.3,1)`
- **Default (collapsed):** Single row showing ETA (large), distance, next maneuver instruction with arrow icon
- **Expanded:** Swipe up or tap to expand. Shows full turn-by-turn step list.
- **Each step row:** Maneuver arrow icon (left) + instruction text + distance (right)
- **Current step:** Highlighted with accent color left border
- **Style:** Frosted glass background, rounded top corners (16px), white text. No `overflow-y-auto` — steps are limited to visible area, swipe to scroll.
- **Edge cases:**
  - 0 steps → hide panel entirely
  - Very short route (<100m) → show "Arrived" immediately
  - Long instruction text → truncate with ellipsis, don't wrap

### 7. `LaneGuidance.tsx`

- **Position:** Bottom of route panel, or between panel and quick routes
- **Shown:** When the upcoming maneuver is ≤300m away AND step has lane data
- **Layout:** Horizontal strip of lane indicators
- **Each lane:** Rounded rectangle (48px wide × 64px tall) with an arrow icon inside
  - **Active lane:** White filled background, black arrow
  - **Valid lanes:** Semi-transparent white background (40% opacity), white arrow
  - **Invalid lanes:** Dark gray (10% opacity), dim white arrow, slightly narrower (36px)
- **Arrow mapping from `valid_indication`:**
  - `straight` → ↑
  - `left` → ←
  - `right` → →
  - `slight left` → ↖
  - `slight right` → ↗
  - `sharp left` → ↰
  - `sharp right` → ↱
  - `uturn` → ↶
- **Transitions:** When lane data changes (between intersections), old lanes fade out (opacity 1→0, 200ms), new lanes fade in (opacity 0→1, 200ms). Use `cubic-bezier(0.16,1,0.3,1)`.
- **Edge cases:**
  - All lanes straight (highway, no lane choice needed) → don't show lane guidance
  - `active: true` not found in any lane → show all lanes as valid (graceful degradation)
  - Intersection with 6+ lanes → scrollable within lane strip
  - No lane data at all → hide component

### 8. `MapOverlay.tsx`

- **Mounts:** Inside `Map.tsx`'s container, receives map instance as prop
- **State:** `useReducer` managing the state machine (IDLE / SEARCHING / PREVIEW / ROUTING)
- **Renders:** SearchBar (always), QuickRoutes (when not fullscreen), POI markers (PREVIEW), RouteLayer + RoutePanel + LaneGuidance (ROUTING)
- **Exposed:** No props needed from page.tsx — self-contained
- **map instance prop:** Passed from Map.tsx via `forwardRef` or a prop like `mapInstance`

### Changes to existing files

#### `Map.tsx` (minor changes)
- Accept and forward a callback prop that `MapOverlay` uses, OR expose the map instance via ref.
- Mount `<MapOverlay mapInstance={map} />` inside the container div.

#### `globals.css` (additions)
- No new classes needed — all map UI uses Tailwind v4 utilities.
- Existing `.mapboxgl-ctrl-*` hide rules remain.

#### `page.tsx`
- No changes. MapOverlay is self-contained within the map div.

---

## Error handling

| Failure | Behavior |
|---------|----------|
| No network | All API calls catch and show a "No connection" toast at bottom of map. Auto-retry on next user action. |
| Directions API error | Toast: "Couldn't find a route". Return to IDLE. |
| Geocoding API error | Toast in autocomplete dropdown: "Search unavailable". |
| No GPS | Use Warsaw default center. Search still works. |
| Mapbox token missing | Log console.error (existing behavior). UI shows nothing. |
| Rate limited | Toast: "Too many requests, try again later". Back off for 60s. |

---

## Performance

- Geocoding requests are debounced at 300ms (no request sent while user is still typing)
- POI results are cached per category + proximity zone (rounded to ~500m grid) for 2 minutes
- Route polyline uses simplified geometry when zoomed out (mapbox handles this via `overview=full`)
- All overlay components use `will-change: transform, opacity` for GPU compositing
- Lane guidance only renders when within 300m of maneuver — avoids unnecessary DOM

---

## Testing considerations

- Manual testing: search for Polish addresses ("Marszałkowska 1 Warszawa"), test quick routes in Warsaw area
- Verify lane guidance renders on multi-lane roads (test route through central Warsaw)
- Verify autocomplete debouncing with network tab open
- Test with panel open (clip-path) to ensure overlay positions correctly

---

## Out of scope

- Voice guidance playback (UI scaffold only — voice data is fetched, but audio TTS is not implemented)
- EV routing with state-of-charge (regular driving profile only)
- Offline maps
- Traffic layer visualization (data is fetched but not rendered as a separate layer)
- Multi-stop routes
