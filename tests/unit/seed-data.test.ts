import { describe, expect, it } from 'vitest';
import { initialStocks } from '../../src/renderer/app/seed-data';

describe('initial screen data', () => {
  it('starts with zero holdings while retaining the watchlist', () => {
    expect(initialStocks.length).toBeGreaterThan(0);
    expect(initialStocks.every((stock) => stock.shares === 0)).toBe(true);
  });
});
