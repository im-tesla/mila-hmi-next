const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  lngLat: [number, number];
  category: string;
}

function mapFeature(f: any): SearchResult {
  const center = (f?.center ?? [0, 0]) as [number, number];
  return {
    id: f?.id ?? String(Array.isArray(center) ? center.join(',') : ''),
    name: f?.text ?? f?.place_name ?? '',
    address: f?.place_name ?? '',
    lngLat: center,
    category: f?.properties?.category ?? '',
  };
}

interface GeocodingOptions {
  signal?: AbortSignal;
}

export async function fetchSuggestions(
  query: string,
  proximity: [number, number],
  options?: GeocodingOptions,
): Promise<SearchResult[]> {
  if (!query) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('country', 'PL');
  url.searchParams.set('proximity', `${proximity[0]},${proximity[1]}`);
  url.searchParams.set('types', 'place,address,poi');
  url.searchParams.set('limit', '5');
  url.searchParams.set('language', 'pl');

  const res = await fetch(url.toString(), { signal: options?.signal });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
  const data = await res.json();

  return (data?.features ?? []).map(mapFeature);
}

export async function fetchPOIs(
  query: string,
  proximity: [number, number],
  options?: GeocodingOptions,
): Promise<SearchResult[]> {
  if (!query) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('access_token', TOKEN);
  url.searchParams.set('country', 'PL');
  url.searchParams.set('proximity', `${proximity[0]},${proximity[1]}`);
  url.searchParams.set('types', 'poi');
  url.searchParams.set('limit', '10');
  url.searchParams.set('language', 'pl');

  const res = await fetch(url.toString(), { signal: options?.signal });
  if (!res.ok) throw new Error(`POI search failed: ${res.status}`);
  const data = await res.json();

  return (data?.features ?? []).map(mapFeature);
}
