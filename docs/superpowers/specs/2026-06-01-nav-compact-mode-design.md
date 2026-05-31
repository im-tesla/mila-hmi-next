# Navigation Compact Mode Design Spec

**Date:** 2026-06-01
**Component:** In-navigation HMI — behavior when a service panel is open
**Target hardware:** 1920×1200 (16:10) dash touchscreen, left-hand-drive

## Problem

The redesigned navigation panel is a solid ~400px (`25rem`) left-edge column. The
right-side service slide-out (Spotify / YouTube / Netflix / custom apps / Settings)
opens at 810 / 980 / 1200px (`PANEL_WIDTHS` for Normal / Large / Wide), clipping the
map from the right. With both open, the map between the 400px nav panel and the
service panel is crushed (e.g. Normal leaves ~710px; Wide leaves ~320px). The driver
loses almost all map while a service is open.

## Goal

When a service panel is open during active navigation, shrink the nav UI from the
full left column to a **compact floating card** that keeps the glance-critical info
(maneuver, street, lane guidance, speed, ETA/distance) but frees the map to its full
remaining width. Restore the full panel when the service panel closes.

## Non-Goals

- No change to the full-panel design, the service-panel mechanics, route fetching,
  or map camera.
- No change to `PANEL_WIDTHS` or how the service panel clips the map.

---

## Behavior

`NavigationPanel` gains two presentation modes; the active mode is chosen by
`NavigationOverlay` from the space actually available:

1. **Full mode** (default — no service panel open): the existing left-edge panel,
   unchanged (maneuver, street, then-preview, lanes, UPCOMING list, footer, speed
   badge floating just outside the right edge).

2. **Compact mode** (a service panel is open): a **floating card** anchored
   top-left over the map, containing:
   - Maneuver tile (accent turn arrow) + hero distance (`400 m`, unit muted, no wrap)
   - Street line (current instruction)
   - **Lane guidance** row (only when lane data exists)
   - Footer: **arrival · `<min>` min · `<km>` km** on one compact line
   - The **speed sign** floats just outside the card's right edge (same
     `SpeedLimitBadge`, same `left:100%` positioning) — clearly separated, no overlap.
   - The long **UPCOMING list is dropped** (least glance-critical while a media/
     settings panel is open).
   The card is a rounded surface with a drop shadow; the map keeps its full remaining
   width behind/around it (the card overlays the map rather than reserving a column).

3. **Hidden** (a service panel is *fullscreen*, map fully covered): render no nav UI.

### Mode selection (in `NavigationOverlay`)

`NavigationOverlay` already receives `rightPadding` (= the service panel width; `0`
when no panel is open). To also distinguish *fullscreen* (where the map strip is
~zero) from a normal/large/wide panel, it measures its own container width
(`stripW`) with a `ResizeObserver` (the container is sized `left:0; right:rightPadding`,
so its width is the visible map strip).

```
if (stripW > 0 && stripW < NAV_HIDE_BELOW)   → render nothing      // fullscreen service
else if (rightPadding > 0)                    → NavigationPanel compact
else                                          → NavigationPanel full
```

`NAV_HIDE_BELOW` ≈ 300px (a little wider than the compact card; below this there is
no useful map to annotate). Using `rightPadding > 0` as the compact trigger means the
nav goes compact whenever *any* service panel is open, at every panel size — which is
the stated requirement (even Normal leaves the full panel too cramped).

### Transition

Cross-fade between full and compact when the mode flips, to match the app's existing
motion. Wrap the two variants in `AnimatePresence` (mode `"wait"`) keyed by the mode,
with a short opacity/scale fade (~0.25s, the project's standard easing). The
service-panel slide and the nav cross-fade run concurrently.

---

## Components & data flow

- **`NavigationOverlay.tsx`** — add a container ref + `ResizeObserver` for `stripW`;
  compute mode; pass `compact: boolean` to `NavigationPanel` (and render nothing when
  hidden). `gpsSpeed` and `onEnd` continue to be passed.
- **`NavigationPanel.tsx`** — accept `compact?: boolean`. Branch the render: full
  column (existing) vs. compact card. Shared leaf pieces (maneuver header, lane row,
  `SpeedLimitBadge`) are reused across both branches so there is one source of truth
  for each; only the container layout differs (full-height column vs. floating card,
  and the card omits the then-preview and UPCOMING list).
- **`SpeedLimitBadge.tsx`** — unchanged. As a child positioned `left:100%`, it sits
  just outside whichever container renders it (full panel or compact card).

The compact card's fixed width is ~`20rem` (rem so it honors `uiScale`), anchored with
a small top-left inset, rounded corners, and a drop shadow consistent with the app's
floating surfaces. Colors continue to come from `--mila-*` variables; safety colors
(speed red, End red) stay fixed. The card has `pointerEvents:'auto'`.

## Testing

- `NavigationPanel` in compact mode renders maneuver distance, street, lane row (when
  lanes present), and the ETA/min/km footer; it does **not** render the UPCOMING list.
- `NavigationPanel` in full mode is unchanged (existing tests still pass).
- `SpeedLimitBadge` still renders in compact mode (speed + MAX caption).
- `NavigationOverlay` mode selection: maps `rightPadding === 0` → full,
  `rightPadding > 0` (with a non-trivial strip) → compact, and a near-zero strip →
  hidden. (Test the pure mode-selection logic by extracting it into a small helper,
  e.g. `selectNavMode(stripW, rightPadding)`, so it is unit-testable without a DOM.)

## Notes for the implementer

- `gpsSpeed` and the current step's `maxspeedKmh` already feed `SpeedLimitBadge`; no
  new data is required for compact mode.
- The compact card overlays the map; it does not need its own `rightPadding`-style
  shifting (the map already eases content left via the existing `rightPadding` plumbing
  to keep the car centered in the visible strip).
- Keep the End button reachable in compact mode? It is omitted from the compact card
  (no footer button) to stay glance-only; ending a route while a service panel is open
  is rare, and the user can close the service to get the full panel back. (If this
  proves annoying we can revisit, but YAGNI for now.)
