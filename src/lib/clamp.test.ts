import { clamp } from '@/lib/clamp';
import { describe, expect, it } from 'vitest';

describe('clamp', () => {
  it('clamps values to [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});
