import { describe, expect, it } from 'vitest';
import { RefreshService, type MarketSource, type Snapshot } from '../../src/main/market/refresh-service';
import type { Stock } from '../../src/shared/models';

const stock: Stock = { id: 1, code: '601318', name: '中国平安', market: 'CN', industryId: 1, createdAt: '2026-01-01T00:00:00Z' };

describe('refresh stale-data policy', () => {
  it('keeps the previous PE when the source fails only for PE', async () => {
    const source: MarketSource = {
      async fetchSnapshot() {
        return { source: '测试源', updatedAt: '2026-09-05T00:00:00Z', fields: { price: { value: 55 }, pe: { error: '暂时无法获取' } } };
      },
    };
    const previous: Snapshot = { source: '旧源', updatedAt: '2026-09-04T00:00:00Z', fields: { pe: { value: 8.2, status: 'fresh' } } };

    const result = await new RefreshService(source).refreshOne(stock, previous);

    expect(result.fields.pe).toEqual({ value: 8.2, status: 'stale', updatedAt: '2026-09-04T00:00:00Z', error: '暂时无法获取' });
    expect(result.fields.price).toMatchObject({ value: 55, status: 'fresh' });
  });

  it('marks a never-fetched failed field as unavailable', async () => {
    const source: MarketSource = { async fetchSnapshot() { return { source: '测试源', updatedAt: '2026-09-05T00:00:00Z', fields: { roe: { error: '暂无字段' } } }; } };
    const result = await new RefreshService(source).refreshOne(stock, null);

    expect(result.fields.roe).toEqual({ value: null, status: 'unavailable', updatedAt: '2026-09-05T00:00:00Z', error: '暂无字段' });
  });
});
