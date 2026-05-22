# MILA HMI

Car head-unit interface built with Next.js 16, React 19, mapbox-gl v3, and Tailwind CSS 4.

## Design philosophy

Premium automotive HMI — Tesla / Apple / iOS / macOS grade. Every interaction must feel polished and physical.

- **Motion:** `cubic-bezier(0.16, 1, 0.3, 1)` for all transitions. Fast start (responsive), long gentle deceleration (premium feel). No `ease-in-out`, no linear.
- **Sliders:** Thin track (4px), circular grab handle (20px, scales to 24px on interaction), white with subtle shadow. Apple Music / Tesla climate style.
- **Touch-first:** No scrollable content areas — no `overflow-y-auto`, no scrollbar-hiding CSS. Design content to fit the fixed-size touch screen. Keep `overflow: hidden` on page-level containers (html, body, main, panel wrappers) to contain the layout — these prevent unwanted viewport scroll, not content scroll.
- **GPU-composited animations:** `transform` and `clip-path` only for layout animations. Never animate `width`, `height`, or layout-affecting properties.
- **Dark map background:** `#1a1a1a` behind the map canvas to prevent any flash of white.

## Map resize during panel animations

**Never call `map.resize()` during CSS animations.** `resize()` sets `canvas.width/height` which clears the WebGL drawing buffer per spec. No snapshot overlay can reliably bridge this gap.

Instead, keep the GL canvas at full viewport size and use CSS to create the side-by-side illusion:

1. `clip-path: inset(0 Xpx 0 0)` on the map wrapper — smoothly clips the map from the right
2. `transform: translateX()` on the panel — slides the panel in/out (GPU-composited, no layout changes)
3. `map.easeTo({ padding: { right: X } })` — shifts viewport content to stay centered in the visible area

All three animate simultaneously. The canvas buffer is never touched — zero clears, zero blinks.

**Key files:** `src/app/page.tsx` (clip-path + transform layout), `src/components/Map.tsx` (rightPadding prop → easeTo), `src/components/MapClient.tsx` (dynamic import wrapper).
