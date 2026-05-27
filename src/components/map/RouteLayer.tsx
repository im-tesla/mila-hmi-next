'use client';

import { useEffect, useRef, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import type { RouteData } from '@/lib/mapbox-directions';
import type { SearchResult } from '@/lib/mapbox-geocoding';
import { makeLocationMarker } from '@/lib/map-marker';

interface RouteLayerProps {
  map: mapboxgl.Map | null;
  routes: RouteData[];
  routeIndex: number;
  pois: SearchResult[];
  onPoiTap: (result: SearchResult) => void;
  onSelectAlternative: (index: number) => void;
}

const ROUTE_SRC = (i: number) => `mila-route-src-${i}`;
const ROUTE_CASING = (i: number) => `mila-route-casing-${i}`;
const ROUTE_LINE = (i: number) => `mila-route-line-${i}`;
const POI_SRC = 'mila-poi-src';
const POI_DOTS = 'mila-poi-dots';

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

export default function RouteLayer({ map, routes, routeIndex, pois, onPoiTap, onSelectAlternative }: RouteLayerProps) {
  const poiTapRef = useRef(onPoiTap);
  poiTapRef.current = onPoiTap;
  const altTapRef = useRef(onSelectAlternative);
  altTapRef.current = onSelectAlternative;
  const destElRef = useRef<HTMLElement | null>(null);
  const destCoordRef = useRef<[number, number] | null>(null);

  const syncDestPosition = useCallback(() => {
    const m = map;
    const el = destElRef.current;
    const coord = destCoordRef.current;
    if (!m || !el || !coord) return;
    const pt = m.project(coord);
    el.style.transform = `translate(${pt.x}px, ${pt.y}px) translate(-50%, -50%)`;
  }, [map]);

  // Route lines + destination marker
  useEffect(() => {
    const m = map;
    if (!m) return;

    function add() {
      cleanupRoutes(m!);
      if (routes.length === 0) {
        if (destElRef.current) {
          destElRef.current.remove();
          destElRef.current = null;
          destCoordRef.current = null;
        }
        return;
      }

      const selected = routes[routeIndex];
      if (!selected) return;

      routes.forEach((r, i) => {
        const isSelected = i === routeIndex;
        const coords = r.geometry.coordinates as [number, number][];
        if (coords.length === 0) return;

        m!.addSource(ROUTE_SRC(i), {
          type: 'geojson',
          data: { type: 'Feature', geometry: r.geometry, properties: { index: i } },
        });

        if (isSelected) {
          addBelowBuildings(m!, {
            id: ROUTE_CASING(i),
            type: 'line',
            source: ROUTE_SRC(i),
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-width': 5, 'line-color': '#1E40AF', 'line-opacity': 0.35 },
          });
          addBelowBuildings(m!, {
            id: ROUTE_LINE(i),
            type: 'line',
            source: ROUTE_SRC(i),
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-width': 3, 'line-color': '#3B82F6', 'line-opacity': 1 },
          });
        } else {
          addBelowBuildings(m!, {
            id: ROUTE_LINE(i),
            type: 'line',
            source: ROUTE_SRC(i),
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-width': 2, 'line-color': '#3B82F6', 'line-opacity': 0.35 },
          });

          // Click handler for alternative routes
          const altHandler = (e: mapboxgl.MapMouseEvent) => {
            if (e.features?.[0]?.properties?.index === i) {
              altTapRef.current(i);
            }
          };
          m!.on('click', ROUTE_LINE(i), altHandler);
          (m! as any)[`_milaAltClick_${i}`] = altHandler;
        }
      });

      // Destination marker on selected route
      const selCoords = selected.geometry.coordinates as [number, number][];
      const lastCoord = selCoords[selCoords.length - 1] as [number, number];
      destCoordRef.current = lastCoord;

      if (!destElRef.current) {
        const el = makeLocationMarker('red');
        el.style.position = 'absolute';
        el.style.top = '0';
        el.style.left = '0';
        el.style.pointerEvents = 'none';
        m!.getCanvasContainer().appendChild(el);
        destElRef.current = el;
      }
      syncDestPosition();
    }

    if (m.isStyleLoaded()) add();
    m.on('style.load', add);
    m.on('move', syncDestPosition);

    return () => {
      m.off('style.load', add);
      m.off('move', syncDestPosition);
      if (destElRef.current) {
        destElRef.current.remove();
        destElRef.current = null;
        destCoordRef.current = null;
      }
      cleanupRoutes(m!);
    };
  }, [map, routes, routeIndex, syncDestPosition]);

  // POI search-result dots
  useEffect(() => {
    const m = map;
    if (!m) return;

    function add() {
      cleanupPois(m!);
      if (pois.length === 0 || routes.length > 0) return;

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
  }, [map, pois, routes]);

  return null;
}

function cleanupRoutes(map: mapboxgl.Map) {
  for (let i = 0; i < 3; i++) {
    const altHandler = (map as any)[`_milaAltClick_${i}`];
    if (altHandler) {
      map.off('click', ROUTE_LINE(i), altHandler);
      delete (map as any)[`_milaAltClick_${i}`];
    }
    try { if (map.getLayer(ROUTE_LINE(i))) map.removeLayer(ROUTE_LINE(i)); } catch {}
    try { if (map.getLayer(ROUTE_CASING(i))) map.removeLayer(ROUTE_CASING(i)); } catch {}
    try { if (map.getSource(ROUTE_SRC(i))) map.removeSource(ROUTE_SRC(i)); } catch {}
  }
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
