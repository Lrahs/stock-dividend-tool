import type { Position } from './calculations';

export function visibleHoldings<T extends Position>(stocks: T[]): T[] {
  return stocks.filter((stock) => stock.shares > 0);
}
