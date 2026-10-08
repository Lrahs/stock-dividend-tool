import type { MetricName } from './refresh-service';

/** 采集器返回的字段片段：{ value: number|null; error?: string } */
export type FieldMap = Partial<Record<MetricName, { value: number | null; error?: string }>>;

const ok = (value: number | null): { value: number | null } => ({ value });
const err = (error: string): { value: null; error: string } => ({ value: null, error });

export { ok, err };

/** 东财数据中心分页抓取，自动翻页直到取完或达到 maxPages。 */
export async function fetchAllPages<T = Record<string, unknown>>(
  url: string,
  opts: { pageSize?: number; maxPages?: number; signal?: AbortSignal } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 2000;
  const maxPages = opts.maxPages ?? 4;
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${sep}pageNumber=${page}&pageSize=${pageSize}`, {
      signal: opts.signal ?? AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`数据接口请求失败：${res.status}`);
    const json = (await res.json()) as { result?: { data?: T[] } };
    const data = json.result?.data;
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

/** 安全取数值：仅接受有限数字 */
export function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** 安全取百分数→小数（接口里 3.5 表示 3.5%，转 0.035） */
export function pctToDecimal(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : n / 100;
}
