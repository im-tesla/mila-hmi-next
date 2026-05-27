# Navigation System Redesign

## Overview

Complete reimplementation of the navigation UI layer: search bar, quick-route chips, route panel, lane guidance, and map controls. The mapbox-gl map canvas is untouched.

### What goes away
- `useReducer` state machine — replaced with simpler `useState` + callbacks
- `QuickRoutes.tsx` standalone component — chips are now inline in SearchBar dropdown
- `RoutePanel.tsx` bottom panel — replaced with top-left Apple Maps-style cluster
- `LaneGuidance.tsx` bottom strip — integrated into top-left cluster
- `MapOverlay.tsx` — rearchitected entirely
- v6 geocoding for POIs — back to v5 `types=poi`
- `mapbox/driving` — replaced with `driving-traffic`
- All `console.log` debug spam
- Settings → Navigation tab (dead toggles, nothing wired)

### What stays
- `Map.tsx` — mapbox-gl initialization, geolocation, style switching
- `MapClient.tsx` — dynamic import wrapper
- `RouteLayer.tsx` — route polyline + POI markers on the map (with bugfixes)
- `mapbox-directions.ts` — with `driving-traffic` and `language=en` fixes
- `mapbox-geocoding.ts` — with v5 POI endpoint restored

## Component Architecture

```
page.tsx
  └─ MapClient (ssr:false)
       └─ Map.tsx (mapbox-gl, geolocation)
            └─ NavigationOverlay (replaces MapOverlay)
                 ├─ SearchBar (top pill, expands to dropdown with chips + results)
                 ├─ NavigationPanel (top-left: speed, lanes, next turn — only during routing)
                 ├─ MapControls (mid-right: zoom +/-, recenter)
                 └─ RouteLayer (map sources/layers — polylines, markers)
```

### NavigationOverlay
Replaces `MapOverlay.tsx`. Simpler state:
```ts
phase: 'idle' | 'searching' | 'routing'
selectedPoi: SearchResult | null
route: RouteData | null
routeLoading: boolean
```

No more `PREVIEW` phase. Selecting a search result goes straight to routing (no intermediate "Start navigation" button). Tapping a search result immediately fetches the route.

The overlay container respects `rightPadding` for panel animations (unchanged from current).

### SearchBar
Top-positioned glass pill. Three visual states:
1. **Collapsed** — `width: 360px`, shows search icon + "Where to?" placeholder
2. **Expanded (empty query)** — `width: 400px`, shows search input + 3 quick chips (Gas, Fast Food, Shops) + recent searches if any
3. **Expanded (with query)** — chips and recents gone, shows autocomplete results only

Animations: `transform: scale()` and `clip-path` for the pill expansion. Backdrop blur on the map during search.

Quick chips use `lucide-react` icons: `Fuel` (Gas), `UtensilsCrossed` (Fast Food), `ShoppingBag` (Shops). Polish query strings for local results:
- Gas → `stacja paliw`
- Fast Food → `fast food`
- Shops → `sklep`

Search uses request abortion (`AbortController`) instead of debounce. Stale requests are cancelled, new results appear instantly.

All icons throughout use lucide-react — no emojis, no custom SVGs. Installed via `npm install lucide-react`.

### NavigationPanel (top-left, routing only)
Apple Maps-style cluster of 3 cards stacked vertically:
1. **Speed card** — EU speed limit sign (red circle, white bg, black number) + current GPS speed ("47 km/h")
2. **Lane guidance card** — Road surface style (Apple CarPlay pattern): dark asphalt background, dashed white lane divider lines between lanes, directional arrow inside each lane. Active/recommended lane arrow = stark white. Inactive lane arrows = dimmed grey. Lane data comes from Mapbox Directions `StepInfo.lanes`.
3. **Next turn card** — Direction icon (SVG arrow) + "Turn right onto Marszałkowska" + "350 m · then continue 1.8 km"

GPS speed comes from `map.on('geolocate')` events or browser Geolocation API. Speed limit data requires external source (Mapbox Navigation SDK or OSM tiles) — implemented as optional with graceful degradation (shows "--" when unavailable).

### MapControls (mid-right, always visible)
Stack of 3 glass buttons, 40×40px, rounded 12px. Lucide icons: `Plus`, `Minus`, `Crosshair`.

Calls `map.zoomIn()`, `map.zoomOut()`, and recenters to user GPS position via `map.flyTo()`.

## API Fixes

### Geocoding
- `fetchSuggestions()` — stays v5 forward geocode, `types=place,address,poi`
- `fetchPOIs()` — switch back to v5 with `types=poi&limit=10` (removes the broken v6 `feature_type=poi` filter)
- All functions accept `AbortSignal` for request cancellation

### Directions
- Profile: `mapbox/driving-traffic` (was `mapbox/driving`)
- Query params: `language=en`, `voice_units=metric`, `geometries=geojson`, `steps=true`
- `RouteData` interface: `distanceKm` (number), `durationMinutes` (number), `polyline` (GeoJSON LineString)

## Error Handling

Three toasts replace the silent error swallowing:
- **Network error**: "Connection lost. Check your network." — auto-dismiss 4s
- **No route found**: "Couldn't find a route there." — auto-dismiss 4s
- **Search unavailable**: "Search is unavailable right now." — auto-dismiss 4s

Toast component: fixed bottom-center, glass pill, slides up via `transform: translateY()`, auto-dismisses with `cubic-bezier(0.16, 1, 0.3, 1)`.

## Animations

All transitions use `cubic-bezier(0.16, 1, 0.3, 1)`.
- Search pill expand: `width` + `border-radius` animated (constrained, small distance)
- Dropdown appear: `opacity` + `transform: translateY(-4px)` (GPU-composited)
- Quick chips appear/disappear: `opacity` + `transform: scale(0.95)`
- Navigation panel: `opacity` + `transform: translateX(-8px)` on enter
- Toast: `transform: translateY(0)` slide-up
- Map dim overlay: `opacity` on backdrop element

No `width`/`height` animations on the map container — map canvas stays untouched.

## RouteLayer Bugfixes
- POI click handler properly removed via `map.off('click', POI_DOTS, handler)` in cleanup
- Remove `cancelled` flag pattern — use proper effect cleanup instead
- `poiTapRef` updated via `useEffect` with proper dependency on `onPoiTap`

## Files Changed

| File | Action |
|------|--------|
| `src/components/map/NavigationOverlay.tsx` | NEW — replaces MapOverlay |
| `src/components/map/SearchBar.tsx` | REWRITE |
| `src/components/map/QuickRoutes.tsx` | DELETE — inlined into SearchBar |
| `src/components/map/NavigationPanel.tsx` | NEW — speed + lanes + next turn cluster |
| `src/components/map/MapControls.tsx` | NEW — zoom +/-, recenter |
| `src/components/map/RoutePanel.tsx` | DELETE — replaced by NavigationPanel |
| `src/components/map/LaneGuidance.tsx` | DELETE — integrated into NavigationPanel |
| `src/components/map/MapOverlay.tsx` | DELETE — replaced by NavigationOverlay |
| `src/components/map/RouteLayer.tsx` | FIX — memory leak |
| `src/lib/mapbox-geocoding.ts` | FIX — v6→v5 for POIs, AbortSignal |
| `src/lib/mapbox-directions.ts` | FIX — driving-traffic, language=en |
| `src/components/MapClient.tsx` | UPDATE — wire NavigationOverlay |
| `src/components/Map.tsx` | MINIMAL — export geolocation events |
| `src/components/Toast.tsx` | NEW — error toast component |
| `src/app/page.tsx` | MINIMAL — import path update |
| `src/lib/mapbox-geocoding.test.ts` | FIX — match v5 API expectations |
| `src/lib/mapbox-directions.test.ts` | FIX — match driving-traffic expectations |
