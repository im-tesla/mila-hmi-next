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
