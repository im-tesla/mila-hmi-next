import { describe, expect, it } from 'vitest';
import {
  formatDistance,
  formatArrival,
  formatRemaining,
  isOverLimit,
  modifierToIndications,
} from './navFormat';

describe('formatDistance', () => {
  it('uses metres under 1000', () => {
    expect(formatDistance(400)).toEqual({ value: '400', unit: 'm' });
  });
  it('rounds metres', () => {
    expect(formatDistance(449.6)).toEqual({ value: '450', unit: 'm' });
  });
  it('uses km at/above 1000 with one decimal', () => {
    expect(formatDistance(8400)).toEqual({ value: '8.4', unit: 'km' });
  });
  it('returns a dash for zero/invalid', () => {
    expect(formatDistance(0)).toEqual({ value: '—', unit: 'm' });
    expect(formatDistance(Number.NaN)).toEqual({ value: '—', unit: 'm' });
  });
});

describe('formatArrival', () => {
  it('returns placeholder for non-positive duration', () => {
    expect(formatArrival(0)).toBe('--:--');
  });
  it('returns a clock-like string for a positive duration', () => {
    expect(formatArrival(600, 0)).toMatch(/\d/);
  });
});

describe('formatRemaining', () => {
  it('formats minutes and km', () => {
    expect(formatRemaining(720, 8400)).toEqual({ min: '12', km: '8.4' });
  });
  it('uses dashes when empty', () => {
    expect(formatRemaining(0, 0)).toEqual({ min: '—', km: '—' });
  });
});

describe('isOverLimit', () => {
  it('true only when speed exceeds a known limit', () => {
    expect(isOverLimit(58, 50)).toBe(true);
    expect(isOverLimit(48, 50)).toBe(false);
    expect(isOverLimit(50, 50)).toBe(false);
  });
  it('false when either value is missing', () => {
    expect(isOverLimit(null, 50)).toBe(false);
    expect(isOverLimit(60, null)).toBe(false);
  });
});

describe('modifierToIndications', () => {
  it('maps turn modifiers to LaneArrow indications', () => {
    expect(modifierToIndications('left')).toEqual(['left']);
    expect(modifierToIndications('sharp left')).toEqual(['left']);
    expect(modifierToIndications('slight right')).toEqual(['slight right']);
    expect(modifierToIndications('uturn')).toEqual(['uturn']);
  });
  it('defaults to straight for null/unknown', () => {
    expect(modifierToIndications(null)).toEqual(['straight']);
    expect(modifierToIndications('roundabout')).toEqual(['straight']);
  });
});
