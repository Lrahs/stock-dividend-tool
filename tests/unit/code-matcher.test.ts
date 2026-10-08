import { describe, expect, it } from 'vitest';
import { matchCompany } from '../../src/main/import/code-matcher';

describe('company code matching', () => {
  it('returns a unique A-share match when the local catalog has one result', () => {
    expect(matchCompany('中国平安', [
      { name: '中国平安', code: '601318', market: 'CN' },
    ])).toEqual({ kind: 'matched', code: '601318', market: 'CN' });
  });

  it('requires confirmation for an ambiguous name', () => {
    expect(matchCompany('测试公司', [
      { name: '测试公司', code: '000001', market: 'CN' },
      { name: '测试公司', code: '00001', market: 'HK' },
    ])).toMatchObject({ kind: 'ambiguous' });
  });
});
