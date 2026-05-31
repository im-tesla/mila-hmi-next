# Navigation Panel Redesign — Design Spec

**Date:** 2026-05-31
**Component:** In-navigation (active routing) HMI
**Target hardware:** 1920×1080 (16:9) 14" touchscreen, dash-mounted, left-hand-drive car

## Problem

The current active-navigation UI stacks every element into floating cards in the
top-left corner of a wide screen: lane guidance card, instruction card (hero
distance + instruction + "then" preview), a separate floating speed-limit circle,
a bottom-left trip capsule with an expandable turn list, and a top-right "End"
button. On a 1920px screen this reads as cluttered, lopsided, small for touch,
and visually dated. The wide horizontal space is wasted.

## Goals

- Replace scattered floating cards with one intentional, organized **left panel**.
- Exploit the wide screen; keep the map large and unobstructed on the right.
- Big, glanceable typography with a real type scale and tabular numbers.
- Respect the app's existing theme system (Dark / Light / Cute / Custom), UI scale,
  and animation settings — no hardcoded colors.
- Keep the right edge and top-right corner clear for the existing right-side
  slide-out (Spotify / settings).

## Non-Goals

- No changes to route fetching, the search/preview flow, or route-selection UI.
- No changes to map camera / GPS-follow behavior.
- No new turn-by-turn step progression logic beyond what exists.

---

## Layout

A solid **left panel** hugging the left edge (driver-glance side for LHD), with
the map filling the remaining width.

- Panel width: **~400px**, expressed in `rem` so it honors the `uiScale` setting
  (Small/Normal/Large). Map fills the rest (~1500px at Normal scale).
- Panel is full-height, anchored top/bottom/left.
- Panel background `--mila-surface`, text `--mila-text` / `--mila-textSecondary`,
  hairline dividers `--mila-border`, maneuver accent `--mila-accent`.
- The panel is independent of the right-side slide-out; the existing `rightPadding`
  shifting in `NavigationOverlay` does not move the left panel.

### Panel contents (top → bottom)

1. **Header row** (single line, no wrap):
   - Accent square **maneuver arrow tile** (~46px, `--mila-accent` fill, white
     arrow) reflecting the current turn type.
   - **Hero distance**: `400` at large weight 800, tabular numerals, tight
     tracking. The unit (`m` / `km`) is a smaller inline suffix in
     `--mila-textSecondary` (muted grey), `white-space: nowrap` so it never wraps.
2. **Street line** (own full-width row): e.g. "Turn left onto Main Street",
   weight 600. Having its own row prevents collision with the speed circle.
3. **Then-preview**: "then Oak Ave · 1.2 km" in muted text, followed by a hairline
   divider.
4. **Lane guidance** (only when lane data exists): a row of lane cells; active
   lanes tinted with `--mila-accent`. Reuses existing `LaneArrow` / `getLaneLabel`.
5. **"UPCOMING" label** (small, uppercase, tracked, muted) + **steps list**: the
   next few maneuvers, each row = turn icon + street name + distance, separated by
   subtle hairlines. Airy spacing — this list fills the lower panel area with
   useful content rather than dense clutter. Scrolls if it overflows.
6. **Footer** (pinned to bottom, hairline divider above):
   - Left: **arrival time** (e.g. `14:32`, weight 800) with sub-line
     "12 min · 8.4 km".
   - Right: **End** button, red-tinted (`#FF3B30` on translucent red). Moved into
     the panel so the top-right corner / right edge stay clear.

---

## Speed indicator (floats on map, outside panel)

An EU-style speed sign that floats **on the map just outside the panel's right
edge**, vertically aligned with the maneuver header row.

- White circle, **red ring** (always red, like a real speed-limit sign), drop
  shadow for separation from the map.
- **Inside the circle**: the driver's **live speed** (from GPS, `gpsSpeed`),
  tabular numerals.
- **Below the circle**: caption **"MAX 50"** showing the posted limit
  (`currentStep.maxspeedKmh`), white with a text-shadow for legibility on the map.
- **Over-limit state**: when live speed > limit, the speed number **and** the
  "MAX 50" caption turn **red** (`#FF3B30`).
- **No speed-limit data**: hide the "MAX 50" caption; show the circle with live
  speed and a neutral grey ring. (If neither speed nor limit is available, the
  badge is hidden.)

Because the badge needs `gpsSpeed` (currently held in `NavigationOverlay` state)
and `maxspeedKmh` (from the current step), it is rendered as a sibling of the
panel and receives both as props.

---

## Typography

- Add **Inter** via `next/font` (self-hosted, no layout shift), set as the app
  font in `layout.tsx`.
- Enable tabular numerals (`font-feature-settings: 'tnum' 1`) on all numeric
  fields (distance, speed, ETA, step distances) so digits don't jitter.
- Type scale (at Normal UI scale; all driven by `rem` so `uiScale` scales them):
  - Hero distance: ~34px / 800 / -0.02em
  - Street name: ~15px / 600
  - Then-preview & step rows: ~12–13px / 500
  - Section label ("UPCOMING"): ~9px / 700 / uppercase / 0.13em tracking / muted
  - Speed number: ~22px / 800; MAX caption ~10px / 700
  - Arrival time: ~22px / 800

---

## Theming behavior

Colors come entirely from the existing CSS variables set by `applyTheme()`:
`--mila-bg`, `--mila-surface`, `--mila-text`, `--mila-textSecondary`,
`--mila-accent`, `--mila-border`. The panel therefore adapts automatically:

- **Dark**: charcoal panel, indigo maneuver tile.
- **Light**: light grey panel, dark text, teal maneuver tile.
- **Cute**: pink panel, dark-pink text, magenta maneuver tile.
- **Custom**: user's chosen palette.

Fixed exceptions (intentionally not themed): the speed sign's white fill / red
ring and the red over-limit / End-button red, which are safety-signal colors and
should read consistently across themes.

Animations respect the `animations` setting via the existing `--anim-duration`
variable and the Motion library (Full / Reduced / Off).

---

## Affected code

- **`src/components/map/NavigationPanel.tsx`** — rewritten to the new left-panel
  layout. Now also receives `gpsSpeed` (number | null).
- **`src/components/map/NavigationOverlay.tsx`** — remove the separate top-right
  "End" button (folded into the panel footer); pass `gpsSpeed` to the panel;
  wire the End action to the panel.
- **New `src/components/map/SpeedLimitBadge.tsx`** (or co-located) — the floating
  speed circle, positioned just outside the panel edge, props: `speedKmh`,
  `limitKmh`.
- **`src/app/layout.tsx`** — load Inter via `next/font` and apply it.
- Reuse existing `turnArrows.tsx` (`LaneArrow`, `getLaneLabel`) for maneuver/lane
  icons.

## Testing

- Panel renders correct distance/street/then/ETA from `RouteData` (unit never
  wraps; tabular numerals).
- Lane guidance row shows only when lane data is present.
- Steps list renders upcoming maneuvers and scrolls on overflow.
- Speed badge: shows live speed; "MAX 50" only when limit known; number + caption
  turn red when over limit; badge hidden when no speed and no limit.
- Theme switch (Dark/Light/Cute/Custom) restyles the panel via variables; safety
  colors stay fixed.
- "End" folds the route and resets the map (existing `handleEndRoute`).
- UI scale (Small/Normal/Large) scales panel + type via `rem`.
