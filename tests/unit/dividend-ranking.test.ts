import { describe, expect, it } from 'vitest';
import { rankDividendStocks } from '../../src/renderer/features/ranking/dividend-ranking';
import type { WatchStock } from '../../src/renderer/app/seed-data';
import { EMPTY_METRICS } from '../../src/shared/models';

const stock = (overrides: Partial<WatchStock>): WatchStock => ({
  stockId: 1, code: '600000', name: '示例', industry: '金融', shares: 0,
  price: 10, currency: 'CNY', dividendYield: 0.04, roe: null, pe: null, pb: null,
  note: '', ...EMPTY_METRICS, ...overrides,
});

describe('dividend ranking', () => {
  it('filters by industry and price, then returns the top ten dividend yields', () => {
    const result = rankDividendStocks([
      stock({ stockId: 1, name: '甲', dividendYield: 0.04 }),
      stock({ stockId: 2, name: '乙', dividendYield: 0.07 }),
      stock({ stockId: 3, name: '丙', industry: '能源', dividendYield: 0.12 }),
      stock({ stockId: 4, name: '丁', price: 101, dividendYield: 0.09 }),
    ], { industry: '金融', minPrice: 1, maxPrice: 100 });

    expect(result.map((item) => item.name)).toEqual(['乙', '甲']);
  });
});
