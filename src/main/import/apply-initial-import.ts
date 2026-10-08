import type { Repository } from '../db/repositories';
import type { Candidate } from './code-matcher';
import { matchCompany } from './code-matcher';
import type { ImportedIndustry } from './initial-watchlist';

export function applyInitialImport(repo: Repository, industries: ImportedIndustry[], catalog: Candidate[]) {
  let imported = 0;
  const pending: string[] = [];
  for (const industryData of industries) {
    const industry = repo.createIndustry({ name: industryData.name });
    for (const company of industryData.companies) {
      const match = matchCompany(company, catalog);
      if (match.kind === 'matched') {
        const stock = repo.createStock({ code: match.code, name: company.replace('（港股）', ''), market: match.market, industryId: industry.id });
        repo.setHolding(stock.id, 0);
        imported++;
      } else pending.push(company);
    }
  }
  return { imported, pending };
}
