const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface LaneInfo {
  indications: string[];
  valid: boolean;
  active: boolean;
}

export interface StepInfo {
  instruction: string;
  distance: number;
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
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('overview', 'full');
  url.searchParams.set('language', 'en');
  url.searchParams.set('voice_units', 'metric');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Directions request failed: ${res.status}`);
  const data = await res.json();

  const route = data?.routes?.[0];
  const leg = route?.legs?.[0];

  return {
    geometry: route?.geometry ?? { type: 'LineString', coordinates: [] },
    steps: (leg?.steps ?? []).map((step: any) => ({
      instruction: step?.maneuver?.instruction ?? '',
      distance: step?.distance ?? 0,
      lanes: ((step?.intersections?.[0]?.lanes ?? []) as any[]).map((lane: any) => ({
        indications: lane?.indications ?? [],
        valid: lane?.valid ?? false,
        active: lane?.active ?? false,
      })),
    })),
    duration: route?.duration ?? 0,
    distance: route?.distance ?? 0,
  };
}
