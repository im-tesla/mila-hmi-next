'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { ArrowRight, X } from 'lucide-react';
import SearchBar from '@/components/map/SearchBar';
import NavigationPanel from '@/components/map/NavigationPanel';
import MapControls from '@/components/map/MapControls';
import RouteLayer from '@/components/map/RouteLayer';
import { fetchRoute, type RouteData } from '@/lib/mapbox-directions';
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
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [navigating, setNavigating] = useState(false);
  const centerRef = useRef<[number, number]>(WARSAW);
  const headingRef = useRef<number>(0);
  const { show: showToast } = useToast();

  const isRouting = navigating && route !== null;
  const isPreview = route !== null && !navigating;

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
      try {
        const pos = getProximity();
        const r = await fetchRoute(pos, result.lngLat);
        setRoute(r);
        if (map && r.geometry.coordinates.length > 0) {
          const coords = r.geometry.coordinates as [number, number][];
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

  const handleStartNavigation = useCallback(() => {
    setNavigating(true);
    if (!map) return;
    // userPosRef is tracked continuously by watchPosition — use it synchronously
    // so the camera snaps immediately on tap, no async delay.
    const center: [number, number] | undefined =
      userPosRef.current ??
      (route?.geometry.coordinates[0] as [number, number] | undefined);
    if (!center) return;
    map.easeTo({
      center,
      zoom: 19,
      pitch: 45,
      bearing: headingRef.current,
      duration: 700,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });
  }, [map, route, userPosRef]);

  const handleEndRoute = useCallback(() => {
    setRoute(null);
    setSelectedPoi(null);
    setGpsSpeed(null);
    setNavigating(false);
    if (map) map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }, [map]);

  const handleCancelPreview = useCallback(() => {
    setRoute(null);
    setSelectedPoi(null);
  }, []);

  const handleClear = useCallback(() => {}, []);

  const pois: SearchResult[] = selectedPoi ? [selectedPoi] : [];

  const etaMin = route ? Math.round(route.duration / 60) : 0;
  const distKm = route ? (route.distance / 1000).toFixed(1) : '0';
  const mainRoad = route?.steps[0]?.instruction ?? '';

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
      {!route && (
        <div style={{ pointerEvents: 'auto' }}>
          <SearchBar
            getProximity={getProximity}
            onSelectResult={handleSelectResult}
            onClear={handleClear}
          />
        </div>
      )}

      {/* Preview: destination card + Go button (bottom) */}
      {isPreview && selectedPoi && (
        <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-3 z-10" style={{ pointerEvents: 'auto' }}>
          {/* Info card */}
          <div
            style={{
              background: 'var(--mila-surface, #2a2a2a)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid var(--mila-border, #333)',
              borderRadius: 22,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '10px 14px 10px 18px',
              boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
            }}
          >
            <button
              type="button"
              onClick={handleCancelPreview}
              className="border-0 bg-transparent cursor-pointer p-1 flex-shrink-0"
              style={{ color: 'var(--mila-textSecondary, #999)' }}
            >
              <X size={18} strokeWidth={2} />
            </button>

            <div className="min-w-0" style={{ maxWidth: 260 }}>
              <div className="text-[15px] font-medium truncate" style={{ color: 'var(--mila-text, #f5f5f7)' }}>
                {selectedPoi.name}
              </div>
              <div className="text-[12px] truncate" style={{ color: 'var(--mila-textSecondary, #999)' }}>
                {selectedPoi.address}{mainRoad ? ` · via ${mainRoad.replace(/^Drive\s+/, '').replace(/^Head\s+/, '')}` : ''}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0" style={{ borderLeft: `1px solid var(--mila-border, #333)`, paddingLeft: 14 }}>
              <div className="text-center">
                <div className="text-[16px] font-semibold" style={{ color: 'var(--mila-text, #f5f5f7)' }}>{etaMin}</div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--mila-textSecondary, #999)' }}>min</div>
              </div>
              <div className="text-center">
                <div className="text-[16px] font-semibold" style={{ color: 'var(--mila-text, #f5f5f7)' }}>{distKm}</div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--mila-textSecondary, #999)' }}>km</div>
              </div>
            </div>
          </div>

          {/* Go button */}
          <button
            type="button"
            onClick={handleStartNavigation}
            className="flex items-center gap-2 px-10 py-3.5 text-[16px] font-semibold border-0 cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, var(--mila-accent, #818cf8), color-mix(in srgb, var(--mila-accent, #818cf8) 70%, #6366f1))',
              color: '#fff',
              borderRadius: 50,
              boxShadow: '0 4px 24px rgba(129,140,248,0.35)',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              const t = e.currentTarget as HTMLElement;
              t.style.transform = 'scale(1.04)';
              t.style.boxShadow = '0 6px 32px rgba(129,140,248,0.5)';
            }}
            onMouseLeave={(e) => {
              const t = e.currentTarget as HTMLElement;
              t.style.transform = 'scale(1)';
              t.style.boxShadow = '0 4px 24px rgba(129,140,248,0.35)';
            }}
          >
            Go
            <ArrowRight size={20} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Navigation panel — during active routing */}
      {isRouting && route && (
        <NavigationPanel route={route} gpsSpeed={gpsSpeed} />
      )}

      {/* Map controls */}
      <div style={{ pointerEvents: 'auto' }}>
        <MapControls map={map} userPosRef={userPosRef} navigating={navigating} />
      </div>

      {/* Route layer */}
      <RouteLayer map={map} route={route} pois={pois} onPoiTap={handleSelectResult} />

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
