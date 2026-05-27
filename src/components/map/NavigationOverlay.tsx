'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type mapboxgl from 'mapbox-gl';
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
  const centerRef = useRef<[number, number]>(WARSAW);
  const { show: showToast } = useToast();

  const isRouting = route !== null;

  // GPS speed tracking from geolocation
  useEffect(() => {
    if (!isRouting || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.speed !== null && pos.coords.speed !== undefined) {
          setGpsSpeed(pos.coords.speed * 3.6);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isRouting]);

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
      try {
        const pos = getProximity();
        const r = await fetchRoute(pos, result.lngLat);
        setRoute(r);
      } catch {
        showToast("Couldn't find a route there.");
      } finally {
        setRouteLoading(false);
      }
    },
    [getProximity, showToast],
  );

  const handleEndRoute = useCallback(() => {
    setRoute(null);
    setSelectedPoi(null);
    setGpsSpeed(null);
  }, []);

  const handleClear = useCallback(() => {
    // Search was cleared — stay idle
  }, []);

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
      {/* Search bar — always visible unless routing */}
      {!isRouting && (
        <div style={{ pointerEvents: 'auto' }}>
          <SearchBar
            getProximity={getProximity}
            onSelectResult={handleSelectResult}
            onClear={handleClear}
          />
        </div>
      )}

      {/* Navigation panel — only during routing */}
      {isRouting && route && (
        <NavigationPanel route={route} gpsSpeed={gpsSpeed} />
      )}

      {/* Map controls — always visible */}
      <MapControls map={map} />

      {/* Route layer — handles polylines + POI markers */}
      <RouteLayer map={map} route={route} pois={pois} onPoiTap={handleSelectResult} />

      {/* Loading indicator */}
      {routeLoading && (
        <div
          className="absolute bottom-8 left-0 right-0 text-center z-10"
          style={{ pointerEvents: 'auto' }}
        >
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Finding route…
          </span>
        </div>
      )}

      {/* End route button — top right during routing */}
      {isRouting && (
        <div className="absolute top-5 right-4 z-10" style={{ pointerEvents: 'auto' }}>
          <button
            type="button"
            onClick={handleEndRoute}
            className="px-4 py-3 rounded-2xl text-[14px] font-medium border-0 cursor-pointer transition-transform duration-[0.25s] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              background: 'rgba(20,20,20,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: '#FF453A',
              border: '1px solid rgba(255,255,255,0.1)',
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
