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
const DEST_SRC = 'mila-dest-src';
const DEST_DOT = 'mila-dest-dot';
const DEST_RING = 'mila-dest-ring';
const POI_SRC = 'mila-poi-src';
const POI_DOTS = 'mila-poi-dots';

export default function RouteLayer({ map, route, pois, onPoiTap }: RouteLayerProps) {
  const poiTapRef = useRef(onPoiTap);
  poiTapRef.current = onPoiTap;

  // Route line + destination marker
  useEffect(() => {
    const m = map;
    if (!m) return;

    function add() {
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

      // Destination marker — GL circle layers (no HTML Marker drift during zoom)
      const lastCoord = coords[coords.length - 1] as [number, number];
      m!.addSource(DEST_SRC, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: lastCoord }, properties: {} },
      });
      addBelowBuildings(m!, {
        id: DEST_RING,
        type: 'circle',
        source: DEST_SRC,
        paint: { 'circle-radius': 16, 'circle-color': 'rgba(239,68,68,0.18)', 'circle-opacity': 1 },
      });
      addBelowBuildings(m!, {
        id: DEST_DOT,
        type: 'circle',
        source: DEST_SRC,
        paint: {
          'circle-radius': 8,
          'circle-color': '#ef4444',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      });
    }

    // isStyleLoaded() is the correct guard — loaded() returns false while tiles
    // are fetching (e.g. after fitBounds), which would silently skip add().
    if (m.isStyleLoaded()) add();
    m.on('style.load', add);

    return () => {
      m.off('style.load', add);
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
  try { if (map.getLayer(DEST_DOT)) map.removeLayer(DEST_DOT); } catch {}
  try { if (map.getLayer(DEST_RING)) map.removeLayer(DEST_RING); } catch {}
  try { if (map.getSource(DEST_SRC)) map.removeSource(DEST_SRC); } catch {}
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
