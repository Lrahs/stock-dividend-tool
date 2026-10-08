import type { WatchStock } from '../../app/seed-data';

export type DividendRankingFilter = {
  industry: string;
  minPrice: number | null;
  maxPrice: number | null;
};

export function rankDividendStocks(stocks: WatchStock[], filter: DividendRankingFilter): WatchStock[] {
  return stocks
    .filter((stock) => stock.dividendYield !== null && stock.price !== null)
    .filter((stock) => filter.industry === '总览' || stock.industry === filter.industry)
    .filter((stock) => filter.minPrice === null || stock.price! >= filter.minPrice)
    .filter((stock) => filter.maxPrice === null || stock.price! <= filter.maxPrice)
    .sort((left, right) => right.dividendYield! - left.dividendYield!)
    .slice(0, 10);
}
