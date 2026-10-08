import { describe, expect, it } from 'vitest';
import { loadStocks, saveStocks } from '../../src/renderer/app/local-store';
import { initialStocks } from '../../src/renderer/app/seed-data';

describe('local stock store', () => {
  it('restores saved stocks and falls back to the supplied seed', () => {
    localStorage.clear();
    expect(loadStocks()).toEqual(initialStocks);
    saveStocks([{ ...initialStocks[0], shares: 300, note: '已保存' }]);
    expect(loadStocks()[0]).toMatchObject({ shares: 300, note: '已保存' });
  });
});
