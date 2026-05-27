# Alternative Routes

## Summary

Display and select alternative routes in the preview card. Mapbox Directions API already requests `alternatives=true` — we just discard all but the first route. Parse them, render them on the map, and show them as tappable rows in the preview card.

## API (`src/lib/mapbox-directions.ts`)

- `fetchRoute` returns `RouteData[]` instead of `RouteData`
- Iterate `data.routes` (up to 3), parse each leg's steps/geometry/duration/distance
- First route is always the fastest (Mapbox default ordering)

## State (`src/components/map/NavigationOverlay.tsx`)

- `route` → `routes: RouteData[]`
- Add `routeIndex: number` (0-based, default 0 = fastest)
- `handleSelectAlternative(i)` switches `routeIndex`
- `selectedRoute = routes[routeIndex]`
- All UI uses `selectedRoute` for ETA/distance/road name
- "Go" navigates with `selectedRoute`

## Route layer (`src/components/map/RouteLayer.tsx`)

- Props: `routes` instead of `route`
- Render all routes on the map:
  - Selected route: full blue (#3B82F6), 3px width + 5px casing
  - Alternatives: muted gray (#9CA3AF), 1.5px width, 0.4 opacity, no casing
- Tapping an alternative line on the map calls `onSelectAlternative(i)`

## Preview card

- Below the route summary line, list up to 2 alternatives as compact tappable rows
- Each row: `○ 16 min · 3.8 km · via S7` (radio circle, time, distance, road)
- Selected alternative shows filled circle
- Tapping an alternative row calls `handleSelectAlternative(i)`
- If fewer than 2 routes total, don't show alternatives section

## Not in scope
- Tapping alternative route lines on the map (can add later)
- "Fastest route" / "Shortest route" labels
