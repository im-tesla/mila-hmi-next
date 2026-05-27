'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getSetting, subscribeSetting } from '@/lib/settings';
import { makeLocationMarker } from '@/lib/map-marker';
import NavigationOverlay from '@/components/map/NavigationOverlay';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

type ConfigurableMap = mapboxgl.Map & {
  setConfigProperty(importId: string, configName: string, value: unknown): void;
};

const CONFIG_KEYS = ['mbRoadLabels', 'mbPoiLabels', 'mbTransitLabels', 'mb3dBuildings'] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

const STANDARD_CONFIG_NAME: Record<ConfigKey, string> = {
  mbRoadLabels: 'showRoadLabels',
  mbPoiLabels: 'showPointOfInterestLabels',
  mbTransitLabels: 'showTransitLabels',
  mb3dBuildings: 'show3dObjects',
};

const LEGACY_LAYERS: Record<ConfigKey, string[]> = {
  mbRoadLabels: ['road-label', 'road-number-shield'],
  mbPoiLabels: ['poi-label', 'airport-label'],
  mbTransitLabels: ['transit-label'],
  mb3dBuildings: ['building-3d'],
};

export default function Map({ rightPadding = 0 }: { rightPadding?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const paddingRef = useRef(0);
  const userPosRef = useRef<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // ─── Init / destroy ───────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!TOKEN) { console.error('NEXT_PUBLIC_MAPBOX_TOKEN is not set'); return; }
    mapboxgl.accessToken = TOKEN;

    let currentStyle = getSetting('mapStyle');
    const map = new mapboxgl.Map({
      container,
      style: currentStyle + '?optimize=true',
      fadeDuration: 200,
      trackResize: true,
    });
    mapRef.current = map;

    // ─── User position ──────────────────────────────────────────
    let userLngLat: [number, number] | null = null;
    let geoWatchId: number | null = null;
    let didFitOnce = false;
    let userMarker: mapboxgl.Marker | null = null;

    const applyUserPosition = () => {
      if (!userLngLat) return;
      if (userMarker) { userMarker.setLngLat(userLngLat); return; }

      // Inject heading-dot keyframes once
      if (!document.getElementById('mila-user-styles')) {
        const s = document.createElement('style');
        s.id = 'mila-user-styles';
        s.textContent =
          '@keyframes mila-user-ping{0%{transform:translate(-50%,-50%) scale(0.5);opacity:0.7}100%{transform:translate(-50%,-50%) scale(2);opacity:0}}';
        document.head.appendChild(s);
      }

      const el = makeLocationMarker('teal');

      userMarker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(userLngLat)
        .addTo(map);
    };

    // ─── Map config ─────────────────────────────────────────────
    type ConfigSnapshot = Record<ConfigKey, boolean>;
    let lastConfig: ConfigSnapshot | null = null;

    const snapshotConfig = (): ConfigSnapshot => ({
      mbRoadLabels: getSetting('mbRoadLabels'),
      mbPoiLabels: getSetting('mbPoiLabels'),
      mbTransitLabels: getSetting('mbTransitLabels'),
      mb3dBuildings: getSetting('mb3dBuildings'),
    });

    const applyConfig = () => {
      const next = snapshotConfig();
      const isStandard = currentStyle.includes('standard');
      const cm = map as ConfigurableMap;
      for (const key of CONFIG_KEYS) {
        if (lastConfig?.[key] === next[key]) continue;
        if (isStandard) {
          try { cm.setConfigProperty('basemap', STANDARD_CONFIG_NAME[key], next[key]); } catch {}
        } else {
          const visibility = next[key] ? 'visible' : 'none';
          for (const id of LEGACY_LAYERS[key]) {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
          }
        }
      }
      lastConfig = next;
    };

    const onStyleReady = () => {
      lastConfig = null;
      applyConfig();
      // DOM Markers survive style changes — no need to re-add
    };

    map.once('style.load', () => {
      onStyleReady();
      // Apply initial padding if panel is already open
      if (paddingRef.current > 0) {
        map.setPadding({ right: paddingRef.current });
      }
      setMapReady(true);
      if (!('geolocation' in navigator)) return;
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          userLngLat = [pos.coords.longitude, pos.coords.latitude];
          userPosRef.current = userLngLat;
          applyUserPosition();
          if (!didFitOnce) {
            didFitOnce = true;
            map.flyTo({ center: userLngLat, zoom: 14, duration: 2000 });
          }
        },
        (err) => { console.warn('geolocation error', err.code, err.message); },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 10_000 },
      );
    });

    // ─── Style switching ─────────────────────────────────────────
    const unsubStyle = subscribeSetting('mapStyle', () => {
      const next = getSetting('mapStyle');
      if (next === currentStyle) return;
      currentStyle = next;
      map.setStyle(next + '?optimize=true');
      map.once('style.load', onStyleReady);
    });

    const unsubs = CONFIG_KEYS.map((k) => subscribeSetting(k, applyConfig));

    return () => {
      unsubStyle();
      for (const u of unsubs) u();
      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
      userMarker?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Smooth padding transition ────────────────────────────────
  const prevPadding = useRef(rightPadding);
  useEffect(() => {
    paddingRef.current = rightPadding;
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    const prev = prevPadding.current;
    prevPadding.current = rightPadding;
    if (prev === rightPadding) return;

    const duration = rightPadding === 0 || prev === 0 ? 300 : 0;
    if (duration > 0) {
      map.easeTo({
        padding: { right: rightPadding, top: 0, bottom: 0, left: 0 },
        duration,
        easing: (t: number) => 1 - Math.pow(1 - t, 3),
      });
    } else {
      map.setPadding({ right: rightPadding });
    }
  }, [rightPadding]);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
      {mapReady && <NavigationOverlay map={mapRef.current!} rightPadding={rightPadding} userPosRef={userPosRef} />}
    </div>
  );
}
