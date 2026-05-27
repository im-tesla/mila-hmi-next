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
const POI_SRC = 'mila-poi-src';
const POI_DOTS = 'mila-poi-dots';

export default function RouteLayer({ map, route, pois, onPoiTap }: RouteLayerProps) {
  const poiTapRef = useRef(onPoiTap);
  poiTapRef.current = onPoiTap;

  // Route + destination
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
      m!.addLayer({
        id: ROUTE_CASING,
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 8, 'line-color': '#4A9EFF', 'line-opacity': 0.25 },
      });
      m!.addLayer({
        id: ROUTE_LINE,
        type: 'line',
        source: ROUTE_SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 4, 'line-color': '#4A9EFF', 'line-opacity': 0.95 },
      });

      const lastCoord = coords[coords.length - 1];
      m!.addSource(DEST_SRC, {
        type: 'geojson',
        data: { type: 'Feature', geometry: { type: 'Point', coordinates: lastCoord }, properties: {} },
      });
      m!.addLayer({
        id: DEST_DOT,
        type: 'circle',
        source: DEST_SRC,
        paint: { 'circle-radius': 10, 'circle-color': '#ef4444', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
      });
    }

    // Add now if ready, and also on every future style load (theme switches)
    if (m.loaded()) add();
    m.on('style.load', add);

    return () => {
      m.off('style.load', add);
      cleanupRoute(m!);
    };
  }, [map, route]);

  // POI markers
  useEffect(() => {
    const m = map;
    if (!m) return;

    function add() {
      cleanupPois(m!);
      if (pois.length === 0) return;

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
        paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-stroke-color': '#6366f1', 'circle-stroke-width': 2.5 },
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

    if (m.loaded()) add();
    m.on('style.load', add);

    return () => {
      m.off('style.load', add);
      cleanupPois(m!);
    };
  }, [map, pois]);

  return null;
}

function cleanupRoute(map: mapboxgl.Map) {
  try { if (map.getLayer(ROUTE_LINE)) map.removeLayer(ROUTE_LINE); } catch {}
  try { if (map.getLayer(ROUTE_CASING)) map.removeLayer(ROUTE_CASING); } catch {}
  try { if (map.getSource(ROUTE_SRC)) map.removeSource(ROUTE_SRC); } catch {}
  try { if (map.getLayer(DEST_DOT)) map.removeLayer(DEST_DOT); } catch {}
  try { if (map.getSource(DEST_SRC)) map.removeSource(DEST_SRC); } catch {}
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
