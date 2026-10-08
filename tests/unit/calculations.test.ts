import { describe, expect, it } from 'vitest';
import { buildPortfolio, type Position } from '../../src/renderer/features/portfolio/calculations';

const position = (overrides: Partial<Position>): Position => ({
  stockId: 1, industry: '金融', name: '中国平安', shares: 0, price: null,
  currency: 'CNY', dividendYield: null, ...overrides,
});

describe('portfolio calculations', () => {
  it('weights dividend yield by CNY market value', () => {
    const summary = buildPortfolio([
      position({ stockId: 1, price: 10, shares: 100, dividendYield: 0.04 }),
      position({ stockId: 2, price: 20, shares: 100, dividendYield: 0.06 }),
    ], 1);

    expect(summary.totalMarketValueCny).toBe(3000);
    expect(summary.weightedDividendYield).toBeCloseTo(0.053333, 5);
    expect(summary.estimatedMonthlyCashCny).toBeCloseTo(13.333, 3);
  });

  it('converts HKD positions and ignores zero-share positions', () => {
    const summary = buildPortfolio([
      position({ price: 50, shares: 10, currency: 'HKD', dividendYield: 0.05 }),
      position({ price: 30, shares: 0, currency: 'CNY', dividendYield: 0.1 }),
    ], 0.92);

    expect(summary.totalMarketValueCny).toBe(460);
    expect(summary.positions).toHaveLength(1);
  });
});
