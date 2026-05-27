import { useRef, useEffect, useState, useCallback } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { RouteData } from './mapbox-directions';

interface SimState {
  position: [number, number];
  speedKmh: number;
  bearing: number;
  remainingDistance: number;
  remainingDuration: number;
}

function isHighway(name: string): boolean {
  return /^(S\d|A\d|DK\d|E\d|M\d|D\d)/i.test(name);
}

function targetSpeed(name: string, maxspeedKmh: number | null): number {
  if (maxspeedKmh) return maxspeedKmh * 0.95; // slightly under limit
  if (isHighway(name)) return 90 + Math.random() * 20; // 90-110
  return 40 + Math.random() * 20; // 40-60
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bearingBetween(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function useSimulatedDrive(
  map: mapboxgl.Map | null,
  route: RouteData | null,
  enabled: boolean,
) {
  const [state, setState] = useState<SimState | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const speedRef = useRef(50);
  const targetRef = useRef(60);
  const stepIdxRef = useRef(0);
  const distInStepRef = useRef(0);
  const rafRef = useRef(0);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setState(null);
    stateRef.current = null;
    stepIdxRef.current = 0;
    distInStepRef.current = 0;
    speedRef.current = 50;
  }, []);

  useEffect(() => {
    if (!enabled || !map || !route || route.geometry.coordinates.length < 2) {
      reset();
      return;
    }

    const coords = route.geometry.coordinates as [number, number][];
    const steps = route.steps;

    // Find start index in geometry for each step
    let coordIdx = 0;
    stepIdxRef.current = 0;
    distInStepRef.current = 0;
    speedRef.current = 40;
    targetRef.current = targetSpeed(steps[0]?.name ?? '', steps[0]?.maxspeedKmh ?? null);

    const totalDist = route.distance;
    let traveledDist = 0;

    function tick() {
      // Smooth speed fluctuation
      const currentSpeed = speedRef.current;
      const target = targetRef.current;
      speedRef.current = lerp(currentSpeed, target + (Math.random() - 0.5) * 10, 0.02);

      const mps = speedRef.current / 3.6;
      const advance = mps / 60; // meters per frame at ~60fps
      traveledDist += advance;

      // Advance along coordinates
      let remaining = advance;
      while (remaining > 0 && coordIdx < coords.length - 1) {
        const segStart = coords[coordIdx];
        const segEnd = coords[coordIdx + 1];
        const segDist = distance(segStart, segEnd);

        if (distInStepRef.current + remaining < segDist) {
          distInStepRef.current += remaining;
          remaining = 0;
        } else {
          remaining -= (segDist - distInStepRef.current);
          distInStepRef.current = 0;
          coordIdx++;
        }
      }

      if (coordIdx >= coords.length - 1) {
        // Arrived
        coordIdx = coords.length - 1;
        speedRef.current = 0;
      }

      // Get current position + bearing
      const from = coords[coordIdx];
      const to = coords[Math.min(coordIdx + 1, coords.length - 1)];
      const t = segDist(from, to) > 0 ? distInStepRef.current / segDist(from, to) : 1;
      const pos: [number, number] = [
        lerp(from[0], to[0], t),
        lerp(from[1], to[1], t),
      ];
      const bearing = bearingBetween(from, to);

      // Check step transition
      if (stepIdxRef.current < steps.length - 1) {
        const stepDist = steps[stepIdxRef.current].distance;
        if (distInStepRef.current > stepDist) {
          stepIdxRef.current++;
          distInStepRef.current -= stepDist;
          const next = steps[stepIdxRef.current];
          targetRef.current = targetSpeed(next?.name ?? '', next?.maxspeedKmh ?? null);
        }
      }

      const remainingDist = totalDist - traveledDist;
      const remainingDur = speedRef.current > 0 ? (remainingDist / 1000) / speedRef.current * 3600 : 0;

      const s: SimState = {
        position: pos,
        speedKmh: Math.round(speedRef.current),
        bearing: Math.round(bearing),
        remainingDistance: Math.max(0, Math.round(remainingDist)),
        remainingDuration: Math.max(0, Math.round(remainingDur)),
      };
      stateRef.current = s;
      setState(s);

      // Update map
      if (speedRef.current > 0 && map) {
        map.easeTo({
          center: pos,
          bearing,
          pitch: 55,
          zoom: 18,
          duration: 1000,
          easing: (t: number) => t,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, map, route, reset]);

  return state;
}

function distance(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aHav = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(aHav), Math.sqrt(1 - aHav));
}

function segDist(a: [number, number], b: [number, number]): number {
  return distance(a, b);
}
