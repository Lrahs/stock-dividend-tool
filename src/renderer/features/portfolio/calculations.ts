export interface Position {
  stockId: number;
  industry: string;
  name: string;
  shares: number;
  price: number | null;
  currency: 'CNY' | 'HKD';
  dividendYield: number | null;
}

export interface ValuedPosition extends Position {
  marketValueCny: number | null;
}

export interface PortfolioSummary {
  positions: ValuedPosition[];
  totalMarketValueCny: number;
  weightedDividendYield: number | null;
  estimatedMonthlyCashCny: number | null;
  estimatedAnnualCashCny: number | null;
}

export function buildPortfolio(positions: Position[], hkdCnyRate: number | null): PortfolioSummary {
  const valued = positions
    .filter((position) => position.shares > 0)
    .map((position): ValuedPosition => {
      const conversion = position.currency === 'HKD' ? hkdCnyRate : 1;
      const marketValueCny = position.price === null || conversion === null ? null : position.price * position.shares * conversion;
      return { ...position, marketValueCny };
    });

  const totalMarketValueCny = valued.reduce((total, position) => total + (position.marketValueCny ?? 0), 0);
  const eligible = valued.filter((position) => position.marketValueCny !== null && position.dividendYield !== null);
  const dividendBase = eligible.reduce((total, position) => total + position.marketValueCny!, 0);
  const weightedDividendYield = dividendBase === 0
    ? null
    : eligible.reduce((total, position) => total + position.marketValueCny! * position.dividendYield!, 0) / dividendBase;

  return {
    positions: valued,
    totalMarketValueCny,
    weightedDividendYield,
    estimatedMonthlyCashCny: weightedDividendYield === null ? null : totalMarketValueCny * weightedDividendYield / 12,
    estimatedAnnualCashCny: weightedDividendYield === null ? null : totalMarketValueCny * weightedDividendYield,
  };
}
