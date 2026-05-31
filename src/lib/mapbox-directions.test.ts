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
  return await import('./mapbox-directions');
}

describe('mapbox-directions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  });

  it('parses a valid Directions API response into RouteData', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          routes: [
            {
              geometry: {
                type: 'LineString',
                coordinates: [
                  [21.0122, 52.2297],
                  [21.0200, 52.2350],
                  [21.0300, 52.2400],
                ],
              },
              duration: 1420.5,
              distance: 12500.3,
              legs: [
                {
                  steps: [
                    {
                      maneuver: {
                        instruction: 'Head east on Marszałkowska',
                      },
                      distance: 450.2,
                      intersections: [
                        {
                          lanes: [
                            { indications: ['left'], valid: true, active: false },
                            { indications: ['straight', 'right'], valid: true, active: true },
                          ],
                        },
                      ],
                    },
                    {
                      maneuver: {
                        instruction: 'Turn right onto Aleje Jerozolimskie',
                      },
                      distance: 1200.8,
                      intersections: [
                        {
                          lanes: [
                            { indications: ['straight'], valid: true, active: false },
                            { indications: ['straight'], valid: true, active: true },
                            { indications: ['right'], valid: true, active: false },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { fetchRoute } = await loadModule('token-dir-123');
    const result = await fetchRoute([21.0122, 52.2297], [21.0300, 52.2400]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(getCalledUrl(fetchMock.mock.calls[0]?.[0]));
    expect(url.searchParams.get('access_token')).toBe('token-dir-123');
    expect(url.searchParams.get('geometries')).toBe('geojson');
    expect(url.searchParams.get('steps')).toBe('true');
    expect(url.searchParams.get('overview')).toBe('full');

    expect(result.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [21.0122, 52.2297],
        [21.0200, 52.2350],
        [21.0300, 52.2400],
      ],
    });
    expect(result.duration).toBe(1420.5);
    expect(result.distance).toBe(12500.3);

    expect(result.steps).toHaveLength(2);

    expect(result.steps[0]).toEqual({
      instruction: 'Head east on Marszałkowska',
      name: '',
      distance: 450.2,
      maxspeedKmh: null,
      maneuverModifier: null,
      lanes: [
        { indications: ['left'], valid: true, active: false },
        { indications: ['straight', 'right'], valid: true, active: true },
      ],
    });

    expect(result.steps[1]).toEqual({
      instruction: 'Turn right onto Aleje Jerozolimskie',
      name: '',
      distance: 1200.8,
      maxspeedKmh: null,
      maneuverModifier: null,
      lanes: [
        { indications: ['straight'], valid: true, active: false },
        { indications: ['straight'], valid: true, active: true },
        { indications: ['right'], valid: true, active: false },
      ],
    });
  });

  it('throws on non-ok API response', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: false,
        status: 404,
        json: async () => ({ message: 'Not Found' }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const { fetchRoute } = await loadModule('token-dir-err');

    await expect(fetchRoute([21.0, 52.0], [22.0, 53.0])).rejects.toThrow(
      'Directions request failed: 404',
    );
  });
});
