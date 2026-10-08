import { describe, expect, it } from 'vitest';
import { parseRows } from '../../src/main/import/initial-watchlist';

describe('initial watchlist parser', () => {
  it('ignores secondary industries and normalizes 金融3', () => {
    const rows = parseRows([
      ['一级行业', '二级行业', '公司', null],
      ['金融3', '保险', '中国平安', '中国太保'],
      [null, '银行', '工商银行', null],
    ]);

    expect(rows).toEqual([{ name: '金融', companies: ['中国平安', '中国太保', '工商银行'] }]);
  });

  it('preserves an empty primary industry and removes duplicate companies', () => {
    const rows = parseRows([
      ['一级行业', '二级行业', '公司'],
      ['消费', null, null],
      ['通信', '运营商', '中国移动'],
      [null, '运营商', '中国移动'],
    ]);

    expect(rows).toEqual([
      { name: '消费', companies: [] },
      { name: '通信', companies: ['中国移动'] },
    ]);
  });
});
