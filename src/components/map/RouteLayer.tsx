'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { RouteData } from '@/lib/mapbox-directions';
import type { SearchResult } from '@/lib/mapbox-geocoding';
import { makeLocationMarker } from '@/lib/map-marker';

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

export default function RouteLayer({ map, route, pois, onPoiTap }: RouteLayerProps) {
  const poiTapRef = useRef(onPoiTap);
  poiTapRef.current = onPoiTap;
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);

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

      // Destination pin — same shared marker fn as user location marker
      const lastCoord = coords[coords.length - 1] as [number, number];

      if (destMarkerRef.current) {
        destMarkerRef.current.setLngLat(lastCoord);
      } else {
        const el = makeLocationMarker('red');
        destMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(lastCoord)
          .addTo(m!);
      }
    }

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
  const isStandard = Array.isArray(styleSpec?.imports) && styleSpec.imports.length > 0;

  if (isStandard) {
    map.addLayer({ ...layer, slot: 'middle' } as mapboxgl.AnyLayer);
  } else {
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
