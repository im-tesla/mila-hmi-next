'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
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
}

export default function NavigationOverlay({ map, rightPadding = 0 }: NavigationOverlayProps) {
  const [selectedPoi, setSelectedPoi] = useState<SearchResult | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [gpsSpeed, setGpsSpeed] = useState<number | null>(null);
  const [navigating, setNavigating] = useState(false);
  const centerRef = useRef<[number, number]>(WARSAW);
  const headingWatchRef = useRef<number | null>(null);
  const { show: showToast } = useToast();

  const isRouting = navigating && route !== null;
  const isPreview = route !== null && !navigating;

  // GPS heading tracking during navigation
  useEffect(() => {
    if (!navigating || !map) return;
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos.coords.speed !== null && pos.coords.speed !== undefined) {
            setGpsSpeed(pos.coords.speed * 3.6);
          }
          if (pos.coords.heading !== null && pos.coords.heading !== undefined) {
            headingWatchRef.current = pos.coords.heading;
            map.easeTo({ bearing: pos.coords.heading, duration: 500 });
          }
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
      );
      headingWatchRef.current = watchId;
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [navigating, map]);

  const getProximity = useCallback((): [number, number] => {
    if (!map) return centerRef.current;
    const c = map.getCenter();
    centerRef.current = [c.lng, c.lat];
    return centerRef.current;
  }, [map]);

  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
      setSelectedPoi(result);
      setRouteLoading(true);
      setNavigating(false);
      try {
        const pos = getProximity();
        const r = await fetchRoute(pos, result.lngLat);
        setRoute(r);
        // Fly to show the route overview
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
    // Recenter to current GPS position + set heading
    if (!map) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const center: [number, number] = [pos.coords.longitude, pos.coords.latitude];
          const heading = pos.coords.heading ?? 0;
          map.easeTo({
            center,
            zoom: 17,
            bearing: heading,
            pitch: 45,
            duration: 1000,
          });
        },
        () => {
          // Fallback: just zoom to route start
          if (route?.geometry.coordinates.length) {
            const coords = route.geometry.coordinates as [number, number][];
            map.easeTo({ center: coords[0], zoom: 15, duration: 1000 });
          }
        },
        { enableHighAccuracy: true, timeout: 5000 },
      );
    }
  }, [map, route]);

  const handleEndRoute = useCallback(() => {
    setRoute(null);
    setSelectedPoi(null);
    setGpsSpeed(null);
    setNavigating(false);
    // Reset map bearing
    if (map) map.easeTo({ bearing: 0, pitch: 0, duration: 500 });
  }, [map]);

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
      {/* Search bar — visible when idle or preview */}
      {!isRouting && (
        <div style={{ pointerEvents: 'auto' }}>
          <SearchBar
            getProximity={getProximity}
            onSelectResult={handleSelectResult}
            onClear={handleClear}
          />
        </div>
      )}

      {/* Navigation panel — during active routing */}
      {isRouting && route && (
        <NavigationPanel route={route} gpsSpeed={gpsSpeed} />
      )}

      {/* Map controls */}
      <div style={{ pointerEvents: 'auto' }}>
        <MapControls map={map} />
      </div>

      {/* Route layer */}
      <RouteLayer map={map} route={route} pois={pois} onPoiTap={handleSelectResult} />

      {/* Loading */}
      {routeLoading && (
        <div className="absolute bottom-8 left-0 right-0 text-center z-10" style={{ pointerEvents: 'auto' }}>
          <span className="text-sm" style={{ color: 'var(--mila-textSecondary, #999)' }}>
            Finding route…
          </span>
        </div>
      )}

      {/* Preview: route shown, "Go" button to start navigation */}
      {isPreview && (
        <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={handleStartNavigation}
            className="px-8 py-3.5 rounded-2xl text-[15px] font-semibold border-0 cursor-pointer"
            style={{
              background: 'var(--mila-accent, #818cf8)',
              color: '#fff',
              boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            Go
          </button>
        </div>
      )}

      {/* End button — during routing */}
      {isRouting && (
        <div className="absolute top-5 right-4 z-10" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={handleEndRoute}
            className="px-4 py-3 rounded-2xl text-[14px] font-medium border-0 cursor-pointer"
            style={{
              background: 'var(--mila-surface, #2a2a2a)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              color: '#FF453A',
              border: '1px solid var(--mila-border, #333)',
              transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
            }}
          >
            End
          </button>
        </div>
      )}
    </div>
  );
}
