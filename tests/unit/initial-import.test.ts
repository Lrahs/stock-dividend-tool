import { describe, expect, it } from 'vitest';
import { applyInitialImport } from '../../src/main/import/apply-initial-import';
import { createTestRepository } from '../../src/main/db/repositories';

describe('initial import', () => {
  it('creates zero-share matched stocks and records unmatched companies for confirmation', () => {
    const repo = createTestRepository();
    const result = applyInitialImport(repo, [{ name: '金融', companies: ['中国平安', '未知公司'] }], [{ name: '中国平安', code: '601318', market: 'CN' }]);
    expect(result).toEqual({ imported: 1, pending: ['未知公司'] });
  });
});
