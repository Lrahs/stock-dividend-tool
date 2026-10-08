import { describe, expect, it } from 'vitest';
import { createTestRepository } from '../../src/main/db/repositories';

describe('repository deletion rules', () => {
  it('removes a deleted industry and all related stock data', () => {
    const repo = createTestRepository();
    const industry = repo.createIndustry({ name: '金融' });
    const stock = repo.createStock({
      code: '601318',
      name: '中国平安',
      market: 'CN',
      industryId: industry.id,
    });

    repo.setHolding(stock.id, 100);
    repo.saveNote(stock.id, '长期观察');
    repo.deleteIndustry(industry.id);

    expect(repo.findStock(stock.id)).toBeNull();
    expect(repo.getHolding(stock.id)).toBeNull();
    expect(repo.getNote(stock.id)).toBeNull();
  });

  it('rejects a fractional or negative holding count', () => {
    const repo = createTestRepository();
    const industry = repo.createIndustry({ name: '金融' });
    const stock = repo.createStock({
      code: '601318',
      name: '中国平安',
      market: 'CN',
      industryId: industry.id,
    });

    expect(() => repo.setHolding(stock.id, 1.5)).toThrow('持有股数必须是非负整数');
    expect(() => repo.setHolding(stock.id, -1)).toThrow('持有股数必须是非负整数');
  });
});
