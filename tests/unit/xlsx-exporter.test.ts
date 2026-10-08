import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { createWorkbook } from '../../src/renderer/features/export/xlsx-exporter';
import { initialStocks } from '../../src/renderer/app/seed-data';

describe('stock snapshot workbook', () => {
  it('writes one worksheet per selected stock and excludes notes', () => {
    const workbook = createWorkbook(initialStocks.slice(0, 2).map((stock) => ({ ...stock, note: '不应导出' })));
    expect(workbook.SheetNames).toHaveLength(2);
    expect(workbook.Sheets[workbook.SheetNames[0]].A1.v).toBe('股票代码');
    expect(JSON.stringify(workbook.Sheets)).not.toContain('不应导出');
  });
});
