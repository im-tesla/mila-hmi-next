import { afterEach, describe, expect, it, vi } from 'vitest';

function getCalledUrl(input: unknown): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input && typeof input === 'object' && 'url' in input) return String((input as Request).url);
  return String(input);
}

async function loadModule(token: string) {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = token;
  vi.resetModules();
  return await import('./mapbox-geocoding');
}

describe('mapbox-geocoding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  });

  it('builds suggestions URL with country=PL, proximity, types, limit', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'place.123',
              text: 'Warsaw',
              place_name: 'Warsaw, Poland',
              center: [21, 52],
              properties: { category: 'place' },
            },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { fetchSuggestions } = await loadModule('token-123');
    const results = await fetchSuggestions('warsaw', [21, 52]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(getCalledUrl(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('access_token')).toBe('token-123');
    expect(url.searchParams.get('country')).toBe('PL');
    expect(url.searchParams.get('proximity')).toBe('21,52');
    expect(url.searchParams.get('types')).toBe('place,address,poi');
    expect(url.searchParams.get('limit')).toBe('5');

    expect(results).toEqual([
      {
        id: 'place.123',
        name: 'Warsaw',
        address: 'Warsaw, Poland',
        lngLat: [21, 52],
        category: 'place',
      },
    ]);
  });

  it('builds POI URL with country=PL, proximity, types=poi, limit=10', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              id: 'poi.1',
              text: 'Station',
              place_name: 'Station, Warsaw',
              center: [21, 52],
              properties: { category: 'poi' },
            },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { fetchPOIs } = await loadModule('token-abc');
    await fetchPOIs('stacja+paliw', [21, 52]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(getCalledUrl(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('country')).toBe('PL');
    expect(url.searchParams.get('proximity')).toBe('21,52');
    expect(url.searchParams.get('types')).toBe('poi');
    expect(url.searchParams.get('limit')).toBe('10');
  });

  it('returns empty list for empty query without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { fetchSuggestions, fetchPOIs } = await loadModule('token-xyz');

    await expect(fetchSuggestions('', [21, 52])).resolves.toEqual([]);
    await expect(fetchPOIs('', [21, 52])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

