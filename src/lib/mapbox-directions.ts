const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface LaneInfo {
  indications: string[];
  valid: boolean;
  active: boolean;
}

export interface StepInfo {
  instruction: string;
  name: string;
  distance: number;
  maxspeedKmh: number | null;
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
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('language', 'en');
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('annotations', 'maxspeed');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Directions request failed: ${res.status}`);
  const data = await res.json();

  const route = data?.routes?.[0];
  const leg = route?.legs?.[0];

  type MaxspeedEntry = { speed: number; unit: string } | 'unknown' | 'none';
  const maxspeeds: MaxspeedEntry[] = leg?.annotation?.maxspeed ?? [];

  let annotIdx = 0;
  const steps: StepInfo[] = (leg?.steps ?? []).map((step: any) => {
    const stepCoordCount: number = step?.geometry?.coordinates?.length ?? 2;
    const stepAnnotCount = Math.max(0, stepCoordCount - 1);

    let maxspeedKmh: number | null = null;
    for (let i = annotIdx; i < annotIdx + stepAnnotCount && i < maxspeeds.length; i++) {
      const ms = maxspeeds[i];
      if (ms && typeof ms === 'object' && 'speed' in ms) {
        maxspeedKmh = ms.unit === 'mph' ? Math.round(ms.speed * 1.60934) : ms.speed;
        break;
      }
    }
    annotIdx += stepAnnotCount;

    return {
      instruction: step?.maneuver?.instruction ?? '',
      name: step?.name ?? '',
      distance: step?.distance ?? 0,
      maxspeedKmh,
      lanes: ((step?.intersections?.[0]?.lanes ?? []) as any[]).map((lane: any) => ({
        indications: lane?.indications ?? [],
        valid: lane?.valid ?? false,
        active: lane?.active ?? false,
      })),
    };
  });

  return {
    geometry: route?.geometry ?? { type: 'LineString', coordinates: [] },
    steps,
    duration: route?.duration ?? 0,
    distance: route?.distance ?? 0,
  };
}
