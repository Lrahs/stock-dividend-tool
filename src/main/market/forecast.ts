import { ok, err, type FieldMap } from './fetch-utils';

/* ===== 抽样分布点估计 ===== */
export interface GrowthSample { g0: number; g1: number }

/**
 * 抽样分布点估计：用各机构预测增长率的样本估计总体增长率 G。
 * 每家机构 growth_i = (g1 - g0) / g0；G 取样本均值（总体期望的无偏一致估计量）。
 * 有几家就用几家（含极值，不剔除最大/最小），样本量 n>=1 即可估计；
 * 同时给出样本标准差（n>1 时）与家数。
 */
export function pointEstimateG(samples: GrowthSample[]): {
  g: number; n: number; sd: number;
} | null {
  const growth = samples.map((s) => (s.g1 - s.g0) / s.g0).filter((v) => Number.isFinite(v));
  if (growth.length < 1) return null;
  const mean = growth.reduce((a, b) => a + b, 0) / growth.length;
  const sd = growth.length > 1
    ? Math.sqrt(growth.reduce((a, b) => a + (b - mean) ** 2, 0) / (growth.length - 1))
    : 0;
  return { g: mean, n: growth.length, sd };
}

/* ===== 数据源一：同花顺盈利预测（主，约10-20家机构） ===== */
interface ThsRow {
  org: string;
  /** 2026/2027/2028 预测净利润(亿元) */
  net: number[];
}

/** 每家机构的复合增长率：优先 (2028/2026)^(1/2)-1（两年复合），否则 2027/2026-1 */
function thsCagr(net: number[]): number {
  if (net.length >= 3 && net[2] > 0 && net[0] > 0) return Math.pow(net[2] / net[0], 1 / 2) - 1;
  if (net.length >= 2 && net[1] > 0 && net[0] > 0) return (net[1] - net[0]) / net[0];
  return Number.NaN;
}

/** 解析同花顺盈利预测页：返回各机构净利润预测 + 机构预期营业收入(2026预测平均, 亿元) */
async function fetchThsForecasts(code: string): Promise<{ rows: ThsRow[]; forecastRevenue: number | null }> {
  const res = await fetch(`http://basic.10jqka.com.cn/${code}/worth.html`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`同花顺请求失败：${res.status}`);
  const html = new TextDecoder('gbk').decode(Buffer.from(await res.arrayBuffer()));

  // 业绩预测详表：各机构 2026/2027/2028 预测净利润
  const start = html.indexOf('业绩预测详表');
  const end = html.indexOf('详细指标预测', start);
  const region = start >= 0 ? html.slice(start, end > start ? end : start + 80000) : html;

  const rows: ThsRow[] = [];
  for (const row of region.split(/<tr>/).slice(1)) {
    const org = /<th class="tl">([^<]+)<\/th>\s*<td class="tl">/.exec(row)?.[1]?.trim();
    if (!org) continue;
    const net = [...row.matchAll(/([\d.]+)亿/g)].map((x) => Number(x[1]));
    if (net.length >= 2 && net[0] > 0) rows.push({ org, net });
  }

  // 机构预期营业收入：「营业收入(元)」后第4个值 = 2026 预测平均值（支持亿/万亿，转成元）
  let forecastRevenue: number | null = null;
  const revIdx = html.indexOf('营业收入(元)');
  if (revIdx >= 0) {
    const toYuan = (text: string): number | null => {
      const m = /([\d.]+)\s*(万亿|亿)/.exec(text);
      if (!m) return null;
      const v = Number(m[1]);
      if (!Number.isFinite(v)) return null;
      return m[2] === '万亿' ? v * 1e12 : v * 1e8;
    };
    const values = [...html.slice(revIdx, revIdx + 2500).matchAll(/([\d.]+)\s*(万亿|亿)/g)]
      .map((m) => toYuan(m[0]))
      .filter((v): v is number => v !== null);
    if (values.length >= 4 && values[3] > 0) forecastRevenue = values[3];
  }

  return { rows, forecastRevenue };
}

/* ===== 数据源二：东方财富研报（兜底，机构较少但口径为EPS） ===== */
interface ReportRow { orgSName?: string; publishDate?: string; predictThisYearEps?: string | null; predictNextYearEps?: string | null }

const toNum = (s: string | null | undefined): number | null => {
  if (s === null || s === undefined || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

async function fetchEastmoneyReportSamples(code: string): Promise<GrowthSample[]> {
  const end = new Date(); const begin = new Date(); begin.setMonth(begin.getMonth() - 18);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const base = `https://reportapi.eastmoney.com/report/list?industryCode=*&qType=0&code=${code}&beginTime=${fmt(begin)}&endTime=${fmt(end)}&pageSize=100`;
  const all: ReportRow[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const res = await fetch(`${base}&pageNo=${page}`, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`研报接口请求失败：${res.status}`);
    const json = (await res.json()) as { data?: ReportRow[] };
    const rows = json.data;
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    if (rows.length < 100) break;
  }
  const byOrg = new Map<string, ReportRow>();
  for (const row of all) {
    const org = row.orgSName;
    if (!org) continue;
    const existing = byOrg.get(org);
    if (!existing || (row.publishDate ?? '') > (existing.publishDate ?? '')) byOrg.set(org, row);
  }
  const out: GrowthSample[] = [];
  for (const row of byOrg.values()) {
    const e0 = toNum(row.predictThisYearEps);
    const e1 = toNum(row.predictNextYearEps);
    if (e0 !== null && e1 !== null && e0 > 0) out.push({ g0: e0, g1: e1 });
  }
  return out;
}

/**
 * 机构预测：返回 forecastG(复合增长率点估计，小数)、forecastSampleN(样本家数)、
 * forecastRevenue(机构预期营业收入，亿元，同花顺2026预测平均；无则 null)。
 */
export async function fetchInstitutionalForecast(code: string): Promise<FieldMap> {
  // 主：同花顺（净利润口径，复合增长率）；兜底：东财研报（EPS口径）
  let samples: GrowthSample[] = [];
  let forecastRevenue: number | null = null;
  let fallback = false;
  try {
    const { rows, forecastRevenue: rev } = await fetchThsForecasts(code);
    forecastRevenue = rev;
    samples = rows
      .map((r) => ({ g0: 1, g1: 1 + thsCagr(r.net) }))
      .filter((s) => Number.isFinite(s.g1 - s.g0));
    if (samples.length >= 1) return buildField(samples, forecastRevenue);
    fallback = true;
  } catch {
    fallback = true;
  }
  if (fallback) {
    try {
      samples = await fetchEastmoneyReportSamples(code);
      if (samples.length >= 1) return buildField(samples, null);
    } catch { /* ignore */ }
  }
  return {
    forecastG: err('机构预测样本不足(0家)'),
    forecastSampleN: err('暂无机构预测'),
    forecastRevenue: err('暂无机构预期收入'),
  };
}

function buildField(samples: GrowthSample[], forecastRevenue: number | null): FieldMap {
  const est = pointEstimateG(samples);
  const fields: FieldMap = {};
  if (!est) {
    fields.forecastG = err('机构预测样本不足(0家)');
    fields.forecastSampleN = err('暂无机构预测');
  } else {
    fields.forecastG = ok(est.g);
    fields.forecastSampleN = ok(est.n);
  }
  fields.forecastRevenue = forecastRevenue === null ? err('暂无机构预期收入') : ok(forecastRevenue);
  return fields;
}
