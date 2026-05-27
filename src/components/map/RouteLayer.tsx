'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { RouteData } from '@/lib/mapbox-directions';
import type { SearchResult } from '@/lib/mapbox-geocoding';

interface RouteLayerProps {
  map: mapboxgl.Map | null;
  route: RouteData | null;
  pois: SearchResult[];
  onPoiTap: (result: SearchResult) => void;
}

const ROUTE_SRC = 'mila-route-src';
const ROUTE_CASING = 'mila-route-casing';
const ROUTE_LINE = 'mila-route-line';
const POI_SRC = 'mila-poi-src';
const POI_DOTS = 'mila-poi-dots';

function ensurePingKeyframes() {
  if (document.getElementById('mila-pin-styles')) return;
  const style = document.createElement('style');
  style.id = 'mila-pin-styles';
  style.textContent =
    '@keyframes mila-ping{0%{transform:translate(-50%,-50%) scale(0.4);opacity:0.9}100%{transform:translate(-50%,-50%) scale(2.2);opacity:0}}';
  document.head.appendChild(style);
}

function makeDestMarkerEl(): HTMLElement {
  ensurePingKeyframes();
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center';

  const pulse = document.createElement('div');
  pulse.style.cssText =
    'position:absolute;width:38px;height:38px;border-radius:50%;' +
    'background:rgba(239,68,68,0.18);top:50%;left:50%;' +
    'animation:mila-user-ping 2.8s ease-out infinite;pointer-events:none';

  const dot = document.createElement('div');
  dot.style.cssText =
    'width:16px;height:16px;border-radius:50%;background:#ef4444;' +
    'border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.3);' +
    'position:relative;z-index:1';

  wrapper.appendChild(pulse);
  wrapper.appendChild(dot);
  return wrapper;
}

export default function RouteLayer({ map, route, pois, onPoiTap }: RouteLayerProps) {
  const poiTapRef = useRef(onPoiTap);
  poiTapRef.current = onPoiTap;
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Route line + destination marker
  useEffect(() => {
    const m = map;
    if (!m) return;

    function add() {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      cleanupRoute(m!);
      if (!route) return;

      const coords = route.geometry.coordinates as [number, number][];
      if (coords.length === 0) return;

      m!.addSource(ROUTE_SRC, {
        type: 'geojson',
        data: { type: 'Feature', geometry: route.geometry, properties: {} },
      });
      addBelowBuildings(m!, {
        id: ROUTE_CASING,
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 5, 'line-color': '#1E40AF', 'line-opacity': 0.35 },
      });
      addBelowBuildings(m!, {
        id: ROUTE_LINE,
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 3, 'line-color': '#3B82F6', 'line-opacity': 1 },
      });

      // Animated destination pin (HTML Marker — survives style changes, GPU-rendered by browser)
      const lastCoord = coords[coords.length - 1];
      destMarkerRef.current = new mapboxgl.Marker({ element: makeDestMarkerEl(), anchor: 'center' })
        .setLngLat(lastCoord as [number, number])
        .addTo(m!);
    }

    // isStyleLoaded() is the correct guard — loaded() returns false while tiles
    // are fetching (e.g. after fitBounds), which would silently skip add().
    if (m.isStyleLoaded()) add();
    m.on('style.load', add);

    return () => {
      m.off('style.load', add);
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      cleanupRoute(m!);
    };
  }, [map, route]);

  // POI search-result dots
  useEffect(() => {
    const m = map;
    if (!m) return;

    function add() {
      cleanupPois(m!);
      // When a route is showing, the destination marker is more prominent — skip POI dot
      if (pois.length === 0 || route) return;

      const poiMap = new Map(pois.map((p) => [p.id, p]));

      m!.addSource(POI_SRC, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pois.map((p) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: p.lngLat },
            properties: { id: p.id },
          })),
        },
      });
      m!.addLayer({
        id: POI_DOTS,
        type: 'circle',
        source: POI_SRC,
        paint: { 'circle-radius': 9, 'circle-color': '#ffffff', 'circle-stroke-color': '#6366f1', 'circle-stroke-width': 3 },
      });

      const clickHandler = (e: mapboxgl.MapMouseEvent) => {
        if (!e.features?.[0]) return;
        const id = e.features[0].properties?.id as string | undefined;
        if (!id) return;
        const result = poiMap.get(id);
        if (result) poiTapRef.current(result);
      };
      m!.on('click', POI_DOTS, clickHandler);
      (m! as any)._milaPoiClickHandler = clickHandler;
    }

    if (m.isStyleLoaded()) add();
    m.on('style.load', add);

    return () => {
      m.off('style.load', add);
      cleanupPois(m!);
    };
  }, [map, pois, route]);

  return null;
}

function addBelowBuildings(map: mapboxgl.Map, layer: mapboxgl.AnyLayer) {
  const styleSpec = map.getStyle() as any;
  // Standard style returns a spec with an imports[] array instead of a flat layers list.
  // Legacy styles have no imports. This is more reliable than checking the name string.
  const isStandard = Array.isArray(styleSpec?.imports) && styleSpec.imports.length > 0;

  if (isStandard) {
    // slot: 'middle' = above roads, below 3D buildings and labels (Standard style spec)
    map.addLayer({ ...layer, slot: 'middle' } as mapboxgl.AnyLayer);
  } else {
    // Legacy styles: insert before the 3D buildings fill-extrusion layer
    const beforeId = map.getLayer('building-3d') ? 'building-3d' : undefined;
    map.addLayer(layer, beforeId);
  }
}

function cleanupRoute(map: mapboxgl.Map) {
  try { if (map.getLayer(ROUTE_LINE)) map.removeLayer(ROUTE_LINE); } catch {}
  try { if (map.getLayer(ROUTE_CASING)) map.removeLayer(ROUTE_CASING); } catch {}
  try { if (map.getSource(ROUTE_SRC)) map.removeSource(ROUTE_SRC); } catch {}
}

function cleanupPois(map: mapboxgl.Map) {
  const handler = (map as any)._milaPoiClickHandler;
  if (handler) {
    map.off('click', POI_DOTS, handler);
    delete (map as any)._milaPoiClickHandler;
  }
  try { if (map.getLayer(POI_DOTS)) map.removeLayer(POI_DOTS); } catch {}
  try { if (map.getSource(POI_SRC)) map.removeSource(POI_SRC); } catch {}
}
