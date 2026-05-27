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
const ROUTE_LINE = 'mila-route-line';
const DEST_SRC = 'mila-dest-src';
const DEST_DOT = 'mila-dest-dot';
const POI_SRC = 'mila-poi-src';
const POI_DOTS = 'mila-poi-dots';

export default function RouteLayer({ map, route, pois, onPoiTap }: RouteLayerProps) {
  const poiTapRef = useRef(onPoiTap);
  poiTapRef.current = onPoiTap;

  // Route + destination layer
  useEffect(() => {
    if (!map) return;

    if (!map.loaded()) {
      const onLoad = () => setupRoute(map, route);
      map.once('style.load', onLoad);
      return () => { map.off('style.load', onLoad); cleanupRoute(map); };
    }

    setupRoute(map, route);
    return () => cleanupRoute(map);
  }, [map, route]);

  // POI markers layer
  useEffect(() => {
    if (!map) return;

    let clickHandler: ((e: mapboxgl.MapMouseEvent) => void) | null = null;

    if (!map.loaded()) {
      const onLoad = () => { clickHandler = setupPois(map, pois, poiTapRef); };
      map.once('style.load', onLoad);
      return () => { map.off('style.load', onLoad); cleanupPois(map, clickHandler); };
    }

    clickHandler = setupPois(map, pois, poiTapRef);
    return () => cleanupPois(map, clickHandler);
  }, [map, pois]);

  return null;
}

function setupRoute(map: mapboxgl.Map, route: RouteData | null) {
  if (!route) return;

  const coords = route.geometry.coordinates as [number, number][];

  if (!map.getSource(ROUTE_SRC)) {
    map.addSource(ROUTE_SRC, {
      type: 'geojson',
      data: { type: 'Feature', geometry: route.geometry, properties: {} },
    });
  }

  if (!map.getLayer(ROUTE_LINE)) {
    map.addLayer({
      id: ROUTE_LINE,
      type: 'line',
      source: ROUTE_SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-width': 6, 'line-color': '#4A9EFF', 'line-opacity': 0.85 },
    });
  }

  if (coords.length > 0) {
    if (route.distance > 500000) {
      const [lng, lat] = coords[0];
      map.flyTo({ center: [lng, lat], zoom: 8, duration: 800 });
    } else {
      const bounds = coords.reduce(
        (b, [lng, lat]) => b.extend([lng, lat]),
        new mapboxgl.LngLatBounds(coords[0], coords[0]),
      );
      map.fitBounds(bounds, { padding: 120, duration: 800 });
    }
  }

  const lastCoord = coords[coords.length - 1];
  if (!map.getSource(DEST_SRC)) {
    map.addSource(DEST_SRC, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Point', coordinates: lastCoord }, properties: {} },
    });
  }
  if (!map.getLayer(DEST_DOT)) {
    map.addLayer({
      id: DEST_DOT,
      type: 'circle',
      source: DEST_SRC,
      paint: { 'circle-radius': 8, 'circle-color': '#ef4444', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
    });
  }
}

function cleanupRoute(map: mapboxgl.Map) {
  try { if (map.getLayer(ROUTE_LINE)) map.removeLayer(ROUTE_LINE); } catch {}
  try { if (map.getSource(ROUTE_SRC)) map.removeSource(ROUTE_SRC); } catch {}
  try { if (map.getLayer(DEST_DOT)) map.removeLayer(DEST_DOT); } catch {}
  try { if (map.getSource(DEST_SRC)) map.removeSource(DEST_SRC); } catch {}
}

function setupPois(
  map: mapboxgl.Map,
  pois: SearchResult[],
  poiTapRef: React.MutableRefObject<(result: SearchResult) => void>,
): ((e: mapboxgl.MapMouseEvent) => void) | null {
  if (pois.length === 0) return null;

  const poiMap = new Map(pois.map((p) => [p.id, p]));

  if (!map.getSource(POI_SRC)) {
    map.addSource(POI_SRC, {
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
  } else {
    const src = map.getSource(POI_SRC) as mapboxgl.GeoJSONSource;
    src.setData({
      type: 'FeatureCollection',
      features: pois.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: p.lngLat },
        properties: { id: p.id },
      })),
    });
  }

  if (!map.getLayer(POI_DOTS)) {
    map.addLayer({
      id: POI_DOTS,
      type: 'circle',
      source: POI_SRC,
      paint: { 'circle-radius': 8, 'circle-color': '#ffffff', 'circle-stroke-color': '#6366f1', 'circle-stroke-width': 2.5 },
    });
  }

  const clickHandler = (e: mapboxgl.MapMouseEvent) => {
    if (!e.features?.[0]) return;
    const id = e.features[0].properties?.id as string | undefined;
    if (!id) return;
    const result = poiMap.get(id);
    if (result) poiTapRef.current(result);
  };

  map.on('click', POI_DOTS, clickHandler);
  return clickHandler;
}

function cleanupPois(map: mapboxgl.Map, clickHandler: ((e: mapboxgl.MapMouseEvent) => void) | null) {
  if (clickHandler) map.off('click', POI_DOTS, clickHandler);
  try { if (map.getLayer(POI_DOTS)) map.removeLayer(POI_DOTS); } catch {}
  try { if (map.getSource(POI_SRC)) map.removeSource(POI_SRC); } catch {}
}
