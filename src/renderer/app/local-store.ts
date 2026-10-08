import { initialStocks, type WatchStock, ALL_INDUSTRIES } from './seed-data';
import { EMPTY_METRICS } from '../../shared/models';

const key = 'stock-dividend-tool:stocks:v4';
const industriesKey = 'stock-dividend-tool:industries:v1';

/** 行业归一化：合并「材料/资源材料」，新增「消费类」 */
const INDUSTRY_NORM: Record<string, string> = {
  '材料': '资源材料',
  '材料资源': '资源材料',
  '资源材料': '资源材料',
  '消费': '消费类',
  '大消费': '消费类',
  '消费类': '消费类',
};

export function normalizeIndustry(industry: string): string {
  return INDUSTRY_NORM[industry] ?? industry;
}

/** 补全缺失指标字段 + 归一化行业 */
export function normalizeStocks(raw: unknown[]): WatchStock[] {
  return raw.map((item) => {
    const w = { ...EMPTY_METRICS, ...(item as Partial<WatchStock>) } as WatchStock;
    w.industry = normalizeIndustry(w.industry ?? '');
    return w;
  });
}

/** 读取（localStorage 缓存） */
export function loadStocks(): WatchStock[] {
  try {
    const saved = localStorage.getItem(key);
    const raw: unknown = saved ? JSON.parse(saved) : null;
    if (Array.isArray(raw)) return normalizeStocks(raw);
    return initialStocks.map((s) => ({ ...s, industry: normalizeIndustry(s.industry) }));
  } catch {
    return initialStocks.map((s) => ({ ...s, industry: normalizeIndustry(s.industry) }));
  }
}

/** 写入（localStorage 缓存） */
export function saveStocks(stocks: WatchStock[]): void {
  localStorage.setItem(key, JSON.stringify(stocks));
}

/** 读取可管理的行业列表；无自定义时用 seed 预设行业 */
export function loadIndustries(): string[] {
  try {
    const saved = localStorage.getItem(industriesKey);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return arr as string[];
    }
  } catch { /* ignore */ }
  return [...ALL_INDUSTRIES];
}

/** 保存可管理的行业列表 */
export function saveIndustries(list: string[]): void {
  localStorage.setItem(industriesKey, JSON.stringify(list));
}
