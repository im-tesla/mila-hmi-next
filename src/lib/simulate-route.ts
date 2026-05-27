import { useRef, useEffect, useState, useCallback } from 'react';
import type mapboxgl from 'mapbox-gl';
import type { RouteData, StepInfo } from './mapbox-directions';

export interface SimState {
  position: [number, number];
  speedKmh: number;
  bearing: number;
  currentStep: StepInfo | null;
  nextStep: StepInfo | null;
  distanceToNext: number;
  remainingSteps: StepInfo[];
  remainingDistance: number;
  remainingDuration: number;
}

function isHighway(name: string): boolean {
  return /^(S\d|A\d|DK\d|E\d|M\d|D\d)/i.test(name);
}

function targetSpeed(name: string, maxspeedKmh: number | null): number {
  if (maxspeedKmh) return maxspeedKmh * 0.95;
  if (isHighway(name)) return 90 + Math.random() * 20;
  return 40 + Math.random() * 25;
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

function haversine(a: [number, number], b: [number, number]): number {
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

export function useSimulatedDrive(
  map: mapboxgl.Map | null,
  route: RouteData | null,
  enabled: boolean,
  userPosRef: React.RefObject<[number, number] | null>,
) {
  const [state, setState] = useState<SimState | null>(null);
  const speedRef = useRef(50);
  const targetSpeedRef = useRef(60);
  const stepIdxRef = useRef(0);
  const distIntoStepRef = useRef(0);
  const totalTraveledRef = useRef(0);
  const rafRef = useRef(0);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setState(null);
  }, []);

  useEffect(() => {
    if (!enabled || !map || !route || route.steps.length === 0 || route.geometry.coordinates.length < 2) {
      reset();
      return;
    }

    const coords = route.geometry.coordinates as [number, number][];
    const steps = route.steps;
    const totalDist = route.distance;

    stepIdxRef.current = 0;
    distIntoStepRef.current = 0;
    totalTraveledRef.current = 0;
    speedRef.current = 30;
    targetSpeedRef.current = targetSpeed(steps[0]?.name ?? '', steps[0]?.maxspeedKmh ?? null);

    // Map each step's cumulative distance to geometry coordinate indices
    const stepCoordStart: number[] = [0];
    let cumDist = 0;
    let coordI = 0;
    for (let si = 0; si < steps.length; si++) {
      let stepDist = 0;
      const target = steps[si].distance;
      while (stepDist < target - 1 && coordI < coords.length - 1) {
        stepDist += haversine(coords[coordI], coords[coordI + 1]);
        coordI++;
      }
      cumDist += stepDist;
      stepCoordStart.push(Math.min(coordI, coords.length - 1));
    }

    function tick() {
      // Speed fluctuation
      const cur = speedRef.current;
      const target = targetSpeedRef.current;
      speedRef.current = lerp(cur, target + (Math.random() - 0.5) * 15, 0.015);

      const mps = speedRef.current / 3.6;
      const advance = mps / 60; // per frame
      totalTraveledRef.current += advance;

      if (totalTraveledRef.current >= totalDist) {
        speedRef.current = 0;
        const lastCoord = coords[coords.length - 1] as [number, number];
        const lastStep = steps[steps.length - 1];
        setState({
          position: lastCoord,
          speedKmh: 0,
          bearing: 0,
          currentStep: lastStep,
          nextStep: null,
          distanceToNext: 0,
          remainingSteps: [],
          remainingDistance: 0,
          remainingDuration: 0,
        });
        return;
      }

      // Advance through steps
      distIntoStepRef.current += advance;
      let si = stepIdxRef.current;
      while (si < steps.length && distIntoStepRef.current >= steps[si].distance) {
        distIntoStepRef.current -= steps[si].distance;
        si++;
        if (si < steps.length) {
          targetSpeedRef.current = targetSpeed(steps[si]?.name ?? '', steps[si]?.maxspeedKmh ?? null);
        }
      }
      stepIdxRef.current = Math.min(si, steps.length - 1);

      // Find position along geometry
      const startI = stepCoordStart[stepIdxRef.current];
      const endI = Math.min(
        stepCoordStart[stepIdxRef.current + 1] ?? coords.length - 1,
        coords.length - 1,
      );
      const stepFrac = steps[stepIdxRef.current].distance > 0
        ? distIntoStepRef.current / steps[stepIdxRef.current].distance
        : 0;
      const geomI = Math.min(
        Math.round(startI + (endI - startI) * stepFrac),
        coords.length - 1,
      );

      const from = coords[geomI];
      const to = coords[Math.min(geomI + 1, coords.length - 1)];
      const pos: [number, number] = [from[0], from[1]];
      const bearing = bearingBetween(from, to);

      const curStep = steps[stepIdxRef.current];
      const nextStep = stepIdxRef.current + 1 < steps.length ? steps[stepIdxRef.current + 1] : null;
      const distToNext = Math.round(curStep.distance - distIntoStepRef.current);
      const remaining = totalDist - totalTraveledRef.current;
      const remainingDur = speedRef.current > 0 ? (remaining / 1000) / speedRef.current * 3600 : 0;

      const s: SimState = {
        position: pos,
        speedKmh: Math.round(speedRef.current),
        bearing: Math.round(bearing),
        currentStep: curStep,
        nextStep,
        distanceToNext: Math.max(0, distToNext),
        remainingSteps: steps.slice(stepIdxRef.current),
        remainingDistance: Math.max(0, Math.round(remaining)),
        remainingDuration: Math.max(0, Math.round(remainingDur)),
      };
      setState(s);

      // Update user position marker for GPS dot
      if (userPosRef) {
        userPosRef.current = pos;
      }

      // Follow behind (GPS-style, not cinematic)
      if (speedRef.current > 0 && map) {
        map.jumpTo({
          center: pos,
          bearing,
          zoom: 18,
        });
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [enabled, map, route, reset]);

  return state;
}
