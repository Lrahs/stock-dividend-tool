import { describe, expect, it } from 'vitest';
import { visibleHoldings } from '../../src/renderer/features/portfolio/selectors';
import { initialStocks } from '../../src/renderer/app/seed-data';

describe('visible holdings', () => {
  it('only exposes positive-share stocks for Current Holdings', () => {
    expect(visibleHoldings(initialStocks)).toEqual([]);
    expect(visibleHoldings(initialStocks.map((stock, index) => index === 0 ? { ...stock, shares: 100 } : stock))).toHaveLength(1);
  });
});
