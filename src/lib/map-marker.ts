export type MarkerColor = 'teal' | 'red';

const COLOR: Record<MarkerColor, { dot: string; pulse: string }> = {
  teal: { dot: '#0d9488', pulse: 'rgba(13,148,136,0.18)' },
  red:  { dot: '#ef4444', pulse: 'rgba(239,68,68,0.18)' },
};

export function makeLocationMarker(color: MarkerColor): HTMLElement {
  const c = COLOR[color];

  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center';

  const pulse = document.createElement('div');
  pulse.style.cssText =
    `position:absolute;width:38px;height:38px;border-radius:50%;background:${c.pulse};` +
    'top:50%;left:50%;animation:mila-user-ping 2.8s ease-out infinite;pointer-events:none';

  const dot = document.createElement('div');
  dot.style.cssText =
    `width:16px;height:16px;border-radius:50%;background:${c.dot};border:3px solid #fff;` +
    'box-shadow:0 2px 10px rgba(0,0,0,0.3);position:relative;z-index:1';

  el.appendChild(pulse);
  el.appendChild(dot);
  return el;
}
