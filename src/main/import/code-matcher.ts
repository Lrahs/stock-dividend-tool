import type { Market } from '../../shared/models';

export interface Candidate {
  name: string;
  code: string;
  market: Market;
}

export type MatchResult =
  | { kind: 'matched'; code: string; market: Market }
  | { kind: 'unmatched'; candidates: Candidate[] }
  | { kind: 'ambiguous'; candidates: Candidate[] };

const normalizedName = (name: string) => name.replace(/（港股）/g, '').replace(/\s+/g, '').trim();

export function matchCompany(name: string, catalog: Candidate[]): MatchResult {
  const candidates = catalog.filter((candidate) => normalizedName(candidate.name) === normalizedName(name));
  if (candidates.length === 0) return { kind: 'unmatched', candidates: [] };
  if (candidates.length > 1) return { kind: 'ambiguous', candidates };
  return { kind: 'matched', code: candidates[0].code, market: candidates[0].market };
}
