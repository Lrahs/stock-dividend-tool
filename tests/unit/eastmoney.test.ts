import { describe, expect, it } from 'vitest';
import { calculateEastmoneyDividendYield, normalizeEastmoneyDividendYield, normalizeQuote } from '../../src/main/market/eastmoney';

describe('Eastmoney quote normalization', () => {
  it('normalizes price units and source metadata', () => {
    expect(normalizeQuote({ data: { f43: 5824 } }, '2026-09-06T00:00:00Z')).toEqual({ source: '东方财富', updatedAt: '2026-09-06T00:00:00Z', fields: { price: { value: 58.24 } } });
  });

  it('includes annual, interim, and special distributions in the latest fiscal-year yield', () => {
    const yieldRate = calculateEastmoneyDividendYield(51.02, [
      { reportDate: '2025-12-31 00:00:00', pretaxBonusPerTenShares: 15.83 },
      { reportDate: '2025-12-31 00:00:00', pretaxBonusPerTenShares: 10.19 },
      { reportDate: '2024-12-31 00:00:00', pretaxBonusPerTenShares: 11.85 },
    ]);

    expect(yieldRate).toBeCloseTo(0.051, 3);
  });

  it('does not mistake a half-year report for an annual report', () => {
    const yieldRate = calculateEastmoneyDividendYield(4.88, [
      { reportDate: '2026半年报', pretaxBonusPerTenShares: 0.2 },
      { reportDate: '2025年报', pretaxBonusPerTenShares: 2.8 },
      { reportDate: '2025半年报', pretaxBonusPerTenShares: 0.5 },
    ]);

    expect(yieldRate).toBeCloseTo(0.0615, 3);
  });

  it('uses the Eastmoney F10 direct dividend-yield percentage', () => {
    expect(normalizeEastmoneyDividendYield(13.8800347725)).toBeCloseTo(0.138800347725, 10);
  });
});
