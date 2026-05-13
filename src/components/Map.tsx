'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getSetting, subscribeSetting } from '@/lib/settings';

const USER_SOURCE = 'mila-user';
const USER_LAYER = 'mila-user-dot';
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Mapbox 3.x exposes setConfigProperty on the standard style. Types aren't
// in the public d.ts surface yet, so narrow it here instead of `as any`.
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

export default function Map() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!TOKEN) {
      // Surface a real error early instead of silently failing inside mapbox-gl.
      console.error('NEXT_PUBLIC_MAPBOX_TOKEN is not set');
      return;
    }
    mapboxgl.accessToken = TOKEN;

    let currentStyle = getSetting('mapStyle');
    const map = new mapboxgl.Map({
      container,
      style: currentStyle + '?optimize=true',
      fadeDuration: 200,
      // MapLibre's own ResizeObserver calls resize() without our canvas
      // overlay, causing an unprotected WebGL clear. We handle every
      // resize ourselves in the ResizeObserver below.
      trackResize: false,
    });

    // ─── User position (live) ───────────────────────────────────
    let userLngLat: [number, number] | null = null;
    let geoWatchId: number | null = null;
    let didFitOnce = false;

    const userGeoJSON = (): GeoJSON.Feature<GeoJSON.Point> => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: userLngLat ?? [0, 0] },
      properties: {},
    });

    const applyUserPosition = () => {
      if (!userLngLat) return;
      const src = map.getSource(USER_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (src) { src.setData(userGeoJSON()); return; }
      map.addSource(USER_SOURCE, { type: 'geojson', data: userGeoJSON() });
      map.addLayer({
        id: USER_LAYER,
        type: 'circle',
        source: USER_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': '#0d9488',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
          'circle-pitch-alignment': 'map',
        },
      });
    };

    // ─── Resize overlay ──────────────────────────────────────────
    // map.resize() clears the WebGL buffer; the overlay snaps the canvas
    // beforehand and covers the 1-frame gap. Used with CSS GPU layer
    // promotion (translateZ) on the canvas container to prevent the
    // container background from flashing during grid transitions.
    let overlay: HTMLCanvasElement | null = null;
    let overlayCtx: CanvasRenderingContext2D | null = null;

    const getCanvas = (): HTMLCanvasElement | null =>
      container.querySelector<HTMLCanvasElement>('canvas');

    const showOverlay = (source: HTMLCanvasElement) => {
      if (source.width === 0) return;
      if (!overlay) {
        overlay = document.createElement('canvas');
        overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1';
        overlayCtx = overlay.getContext('2d');
      }
      if (!overlayCtx) return;

      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(container.clientWidth * dpr);
      const h = Math.round(container.clientHeight * dpr);
      if (overlay.width !== w) overlay.width = w;
      if (overlay.height !== h) overlay.height = h;

      overlayCtx.drawImage(source, 0, 0, source.width, source.height, 0, 0, w, h);
      if (!overlay.parentNode) {
        const host = container.querySelector('.mapboxgl-canvas-container') ?? container;
        host.appendChild(overlay);
      }
    };

    let resizeRaf = 0;
    const ro = new ResizeObserver(() => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        const canvas = getCanvas();
        if (!canvas || canvas.width === 0) return;
        showOverlay(canvas);
        map.resize();
        map.once('render', () => overlay?.remove());
      });
    });
    ro.observe(container);

    // ─── Map config (label visibility, 3D buildings) ────────────
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
      applyUserPosition();
    };

    map.once('style.load', () => {
      onStyleReady();
      if (!('geolocation' in navigator)) return;
      // Live position for a car HMI — getCurrentPosition fires only once.
      geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          userLngLat = [pos.coords.longitude, pos.coords.latitude];
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
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
      ro.disconnect();
      overlay?.remove();
      map.remove();
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
