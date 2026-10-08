import * as XLSX from 'xlsx';

export interface ImportedIndustry {
  name: string;
  companies: string[];
}

type Cell = string | number | null | undefined;

function text(value: Cell): string {
  return String(value ?? '').trim();
}

function normalizeIndustry(name: string): string {
  return name === '金融3' ? '金融' : name;
}

export function parseRows(rows: Cell[][]): ImportedIndustry[] {
  const output: ImportedIndustry[] = [];
  const byIndustry = new Map<string, ImportedIndustry>();
  let currentIndustry = '';

  for (const row of rows.slice(1)) {
    const industryCell = text(row[0]);
    if (industryCell) currentIndustry = normalizeIndustry(industryCell);
    if (!currentIndustry) continue;

    let industry = byIndustry.get(currentIndustry);
    if (!industry) {
      industry = { name: currentIndustry, companies: [] };
      byIndustry.set(currentIndustry, industry);
      output.push(industry);
    }

    for (const value of row.slice(2)) {
      const company = text(value);
      if (company && !industry.companies.includes(company)) industry.companies.push(company);
    }
  }
  return output;
}

export function parseInitialWatchlist(path: string): ImportedIndustry[] {
  const workbook = XLSX.readFile(path, { cellDates: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('初始股票清单没有工作表');
  return parseRows(XLSX.utils.sheet_to_json<Cell[]>(firstSheet, { header: 1, defval: null }));
}
