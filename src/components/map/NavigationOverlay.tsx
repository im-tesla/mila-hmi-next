'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { ArrowRight, X } from 'lucide-react';
import SearchBar from '@/components/map/SearchBar';
import NavigationPanel from '@/components/map/NavigationPanel';
import MapControls from '@/components/map/MapControls';
import RouteLayer from '@/components/map/RouteLayer';
import { fetchRoutes, type RouteData } from '@/lib/mapbox-directions';
import type { SearchResult } from '@/lib/mapbox-geocoding';
import { useToast } from '@/components/Toast';

const WARSAW: [number, number] = [21.01, 52.23];

interface NavigationOverlayProps {
  map: mapboxgl.Map | null;
  rightPadding?: number;
  userPosRef: React.RefObject<[number, number] | null>;
}

export default function NavigationOverlay({ map, rightPadding = 0, userPosRef }: NavigationOverlayProps) {
  const [selectedPoi, setSelectedPoi] = useState<SearchResult | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [navigating, setNavigating] = useState(false);
  const centerRef = useRef<[number, number]>(WARSAW);
  const headingRef = useRef<number>(0);
  const { show: showToast } = useToast();

  const hasRoutes = routes.length > 0;
  const selectedRoute = routes[routeIndex] ?? null;
  const isRouting = navigating && selectedRoute !== null;
  const isPreview = hasRoutes && !navigating;

  // Always track heading so it's ready the moment Go is tapped
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.heading !== null && pos.coords.heading !== undefined) {
          headingRef.current = pos.coords.heading;
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Update speed + map bearing continuously during navigation
  useEffect(() => {
    if (!navigating || !map) return;
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.speed !== null && pos.coords.speed !== undefined) {
            setGpsSpeed(pos.coords.speed * 3.6);
          }
          if (pos.coords.heading !== null && pos.coords.heading !== undefined) {
            headingRef.current = pos.coords.heading;
            map.easeTo({ bearing: pos.coords.heading, duration: 500 });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [navigating, map]);

  const getProximity = useCallback((): [number, number] => {
    if (userPosRef.current) return userPosRef.current;
    if (!map) return centerRef.current;
    const c = map.getCenter();
    centerRef.current = [c.lng, c.lat];
    return centerRef.current;
  }, [map, userPosRef]);

  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      setSelectedPoi(result);
      setRouteLoading(true);
      setNavigating(false);
      setRouteIndex(0);
      try {
        const pos = getProximity();
        const all = await fetchRoutes(pos, result.lngLat);
        setRoutes(all);
        if (map && all.length > 0 && all[0].geometry.coordinates.length > 0) {
          const coords = all[0].geometry.coordinates as [number, number][];
          const bounds = coords.reduce(
            (b, [lng, lat]) => b.extend([lng, lat]),
            new mapboxgl.LngLatBounds(coords[0], coords[0]),
          );
          map.fitBounds(bounds, { padding: 120, duration: 800 });
        }
      } catch {
        showToast("Couldn't find a route there.");
      } finally {
        setRouteLoading(false);
      }
    },
    [getProximity, map, showToast],
  );

  const handleSelectAlternative = useCallback((i: number) => {
    // i is the index in the full routes array (0 = fastest, 1 = first alt, 2 = second alt)
    setRouteIndex(i);
  }, []);

  const handleStartNavigation = useCallback(() => {
    setNavigating(true);
    if (!map || !selectedRoute) return;
    const center: [number, number] | undefined =
      userPosRef.current ??
      (selectedRoute.geometry.coordinates[0] as [number, number] | undefined);
    if (!center) return;
    map.easeTo({
      center,
      zoom: 19,
      pitch: 45,
      bearing: headingRef.current,
      duration: 700,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });
  }, [map, selectedRoute, userPosRef]);

  const handleEndRoute = useCallback(() => {
    setRoutes([]);
    setRouteIndex(0);
    setSelectedPoi(null);
    setGpsSpeed(null);
    setNavigating(false);
    if (map) map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }, [map]);

  const handleCancelPreview = useCallback(() => {
    setRoutes([]);
    setRouteIndex(0);
    setSelectedPoi(null);
  }, []);

  const handleClear = useCallback(() => {}, []);

  const pois: SearchResult[] = selectedPoi ? [selectedPoi] : [];

  return (
    <div
      className="absolute top-0 bottom-0 left-0"
      style={{
        right: rightPadding,
        pointerEvents: 'none',
        transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'right',
      }}
    >
      {/* Search bar — only when idle (nothing selected) */}
      {!hasRoutes && (
        <div style={{ pointerEvents: 'auto' }}>
          <SearchBar
            getProximity={getProximity}
            onSelectResult={handleSelectResult}
            onClear={handleClear}
          />
        </div>
      )}

      {/* Preview: route selection card */}
      {isPreview && selectedPoi && selectedRoute && (
        <div
          className="absolute bottom-8 left-1/2 z-10"
          style={{ transform: 'translateX(-50%)', pointerEvents: 'auto', width: 380 }}
        >
          <div
            style={{
              background: 'var(--mila-surface, #2a2a2a)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 22,
              boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between" style={{ padding: '16px 18px 8px' }}>
              <div className="text-[15px] font-semibold" style={{ color: 'var(--mila-text, #f5f5f7)' }}>
                {selectedPoi.name}
              </div>
              <button
                type="button"
                onClick={handleCancelPreview}
                className="border-0 bg-transparent cursor-pointer p-1 flex-shrink-0"
                style={{ color: 'var(--mila-textSecondary, #999)' }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Route options */}
            <div style={{ padding: '8px 14px' }}>
              {routes.map((r, i) => {
                const min = Math.round(r.duration / 60);
                const km = (r.distance / 1000).toFixed(1);
                const road = (() => {
                  const named = r.steps.filter((s) => s.name);
                  return named.length > 0
                    ? named.reduce((a, b) => (b.distance > a.distance ? b : a)).name
                    : '';
                })();
                const isSel = i === routeIndex;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectAlternative(i)}
                    className="flex items-center gap-3 w-full px-4 py-3 mb-2 bg-transparent cursor-pointer rounded-xl"
                    style={{
                      background: 'var(--mila-bg, #1a1a1a)',
                      border: isSel
                        ? '2px solid var(--mila-accent, #818cf8)'
                        : '2px solid transparent',
                      transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <span className="text-[16px] font-semibold" style={{ color: 'var(--mila-text, #f5f5f7)' }}>
                      {min} <span className="text-[11px] uppercase font-normal" style={{ color: 'var(--mila-textSecondary, #999)' }}>min</span>
                    </span>
                    <span className="text-[16px] font-semibold" style={{ color: 'var(--mila-text, #f5f5f7)' }}>
                      {km} <span className="text-[11px] uppercase font-normal" style={{ color: 'var(--mila-textSecondary, #999)' }}>km</span>
                    </span>
                    {road && (
                      <>
                        <span className="text-[14px]" style={{ color: 'var(--mila-border, #555)' }}>·</span>
                        <span className="text-[13px] truncate flex-1" style={{ color: 'var(--mila-textSecondary, #999)' }}>{road}</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Go button */}
            <div style={{ padding: '0 14px 14px' }}>
              <button
                type="button"
                onClick={handleStartNavigation}
                className="flex items-center justify-center gap-2 w-full py-3.5 text-[17px] font-semibold border-0 cursor-pointer"
                style={{
                  background: '#34c759',
                  color: '#fff',
                  borderRadius: 14,
                  transition: 'background 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
              >
                Go
                <ArrowRight size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation panel — during active routing */}
      {isRouting && selectedRoute && (
        <NavigationPanel route={selectedRoute} gpsSpeed={gpsSpeed} />
      )}

      {/* Map controls */}
      <div style={{ pointerEvents: 'auto' }}>
        <MapControls map={map} userPosRef={userPosRef} navigating={navigating} />
      </div>

      {/* Route layer */}
      <RouteLayer map={map} routes={routes} routeIndex={routeIndex} pois={pois} onPoiTap={handleSelectResult} onSelectAlternative={handleSelectAlternative} />

      {/* Loading */}
      {routeLoading && (
        <div className="absolute bottom-8 left-0 right-0 text-center z-10" style={{ pointerEvents: 'auto' }}>
          <span className="text-base" style={{ color: 'var(--mila-textSecondary, #999)' }}>
            Finding route…
          </span>
        </div>
      )}

      {/* End button — during routing */}
      {isRouting && (
        <div className="absolute top-5 right-4 z-10" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={handleEndRoute}
            className="px-5 py-3.5 rounded-2xl text-[15px] font-medium border-0 cursor-pointer"
            style={{
              background: 'var(--mila-surface, #2a2a2a)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              color: '#FF453A',
              border: '1px solid var(--mila-border, #333)',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            End
          </button>
        </div>
      )}
    </div>
  );
}
