import { describe, expect, it } from 'vitest';
import { percentile } from '../../src/main/market/percentile';

describe('valuation percentile', () => {
  it('returns the percentage of observations at or below the current value', () => {
    expect(percentile([1, 2, 3, 4], 2)).toBe(50);
  });

  it('excludes non-positive PE values when requested', () => {
    expect(percentile([-2, 1, 2], 2, { positiveOnly: true })).toBe(100);
  });

  it('returns null when no usable observation remains', () => {
    expect(percentile([-2, 0], 1, { positiveOnly: true })).toBeNull();
  });
});
