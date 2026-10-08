import type { FetchResult, MetricField } from './refresh-service';
import { fetchValuationMetrics, fetchDividendYieldPercentile8y } from './history';
import { fetchFinancials } from './financials';
import { fetchPayoutRatio } from './dividend';
import { fetchInstitutionalForecast } from './forecast';
import { fetchTopHolders, fetchPledge } from './ownership';

export function normalizeQuote(payload: { data?: { f43?: number | null } }, updatedAt: string): FetchResult {
  const raw = payload.data?.f43;
  return { source: '东方财富', updatedAt, fields: { price: raw === null || raw === undefined ? { error: '暂无股价' } : { value: raw / 100 } } };
}

export function normalizeEastmoneyDividendYield(raw: number | null | undefined): number | null {
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw / 100 : null;
}

export type DividendDistribution = {
  reportDate: string;
  pretaxBonusPerTenShares: number;
};

function fiscalYear(reportDate: string): number | null {
  const match = reportDate.match(/^(\d{4})/);
  return match ? Number(match[1]) : null;
}

function isAnnualReport(reportDate: string): boolean {
  return /^\d{4}年报$/.test(reportDate) || /-12-31(?: 00:00:00)?$/.test(reportDate);
}

export function calculateEastmoneyDividendYield(currentPrice: number, distributions: DividendDistribution[]): number | null {
  const annualYears = distributions
    .filter((row) => isAnnualReport(row.reportDate))
    .map((row) => fiscalYear(row.reportDate))
    .filter((year): year is number => year !== null);
  const latestAnnualYear = Math.max(...annualYears);
  if (!Number.isFinite(latestAnnualYear) || !Number.isFinite(currentPrice) || currentPrice <= 0) return null;

  const cashPerShare = distributions
    .filter((row) => {
      const year = fiscalYear(row.reportDate);
      if (year === latestAnnualYear) return isAnnualReport(row.reportDate) || /特别分配/.test(row.reportDate);
      return year === latestAnnualYear + 1 && /(半年报|一季报|三季报)/.test(row.reportDate);
    })
    .reduce((sum, row) => sum + row.pretaxBonusPerTenShares / 10, 0);
  return cashPerShare > 0 ? cashPerShare / currentPrice : null;
}

function parseCashPerTenShares(plan: string | null | undefined): number | null {
  const match = plan?.match(/(\d+(?:\.\d+)?)\s*派\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const base = Number(match[1]);
  const cash = Number(match[2]);
  return base > 0 && Number.isFinite(cash) ? cash / base * 10 : null;
}

export async function fetchAQuote(code: string): Promise<FetchResult> {
  const exchange = code.startsWith(('6')) ? '1' : '0';
  try {
    const response = await fetch(`https://push2.eastmoney.com/api/qt/stock/get?secid=${exchange}.${code}&fields=f43`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`行情请求失败：${response.status}`);
    return normalizeQuote(await response.json() as { data?: { f43?: number | null } }, new Date().toISOString());
  } catch {
    const prefix = code.startsWith('6') ? 'sh' : 'sz';
    const response = await fetch(`https://qt.gtimg.cn/q=${prefix}${code}`, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`备用行情请求失败：${response.status}`);
    const body = await response.text();
    const fields = body.match(/"([\s\S]*)"/)?.[1].split('~') ?? [];
    const price = Number(fields[3]);
    return { source: '腾讯财经（备用）', updatedAt: new Date().toISOString(), fields: { price: Number.isFinite(price) && price > 0 ? { value: price } : { error: '暂无股价' } } };
  }
}

// 52 周行情：东方财富日K，fqt=0 即不复权价
async function fetch52WeekData(code: string, exchange: 'SH' | 'SZ'): Promise<{
  currentPrice: number; high52w: number; low52w: number; change1yPct: number | null;
} | null> {
  const secid = (exchange === 'SH' ? '1' : '0') + '.' + code;
  const tPref = exchange === 'SH' ? 'sh' : 'sz';

  // 1) 主来源：push2 实时行情接口直接提供 52 周最高(f174)/最低(f175)、现价(f43)
  let currentPrice: number | null = null;
  let high52w: number | null = null;
  let low52w: number | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(
        'https://push2.eastmoney.com/api/qt/stock/get?secid=' + secid + '&fields=f43,f44,f45,f174,f175',
        { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' }, signal: AbortSignal.timeout(10_000) },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          data?: { f43?: number; f44?: number; f45?: number; f174?: number; f175?: number };
        };
        const d = json.data;
        if (d) {
          if (typeof d.f43 === 'number') currentPrice = d.f43 / 100;
          if (typeof d.f174 === 'number') high52w = d.f174 / 100;
          if (typeof d.f175 === 'number') low52w = d.f175 / 100;
        }
        if (currentPrice !== null && high52w !== null && low52w !== null) break;
      }
    } catch {
      /* 重试 */
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 500));
  }

  // 2) 近1年涨跌幅：先试东财日K
  let change1yPct: number | null = null;
  try {
    const now = new Date();
    const begDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const mm = String(begDate.getMonth() + 1).padStart(2, '0');
    const dd = String(begDate.getDate()).padStart(2, '0');
    const beg = '' + begDate.getFullYear() + mm + dd;
    const kurl = 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secid +
      '&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55&klt=101&fqt=0&beg=' + beg +
      '&end=20500101&lmt=500';
    const kres = await fetch(kurl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' },
      signal: AbortSignal.timeout(8_000),
    });
    if (kres.ok) {
      const kjson = (await kres.json()) as { data?: { klines?: string[] } };
      const kl = kjson.data?.klines ?? [];
      if (kl.length) {
        const firstClose = Number(kl[0].split(',')[2]);
        if (Number.isFinite(firstClose) && firstClose > 0 && currentPrice !== null) {
          change1yPct = (currentPrice - firstClose) / firstClose;
        }
      }
    }
  } catch {
    /* 东财日K失败，走腾讯兜底 */
  }

  // 3) 兜底：腾讯日K(不复权)——算近1年涨跌幅；push2 失败时也用它补52周高低与现价
  if (change1yPct === null || currentPrice === null || high52w === null || low52w === null) {
    try {
      const now = new Date();
      const startDate =
        (now.getFullYear() - 1) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      const turl = 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + tPref + code +
        ',day,' + startDate + ',2050-01-01,500,';
      const tres = await fetch(turl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10_000),
      });
      if (tres.ok) {
        const tjson = (await tres.json()) as { data?: Record<string, { day?: string[][]; qfqday?: string[][] }> };
        const tdata = tjson.data?.[tPref + code];
        const rows = tdata?.day ?? tdata?.qfqday ?? [];
        if (rows.length) {
          const firstClose = Number(rows[0][2]);
          const lastClose = Number(rows[rows.length - 1][2]);
          let tHigh = -Infinity;
          let tLow = Infinity;
          for (const r of rows) {
            const hi = Number(r[3]);
            const lo = Number(r[4]);
            if (Number.isFinite(hi) && hi > tHigh) tHigh = hi;
            if (Number.isFinite(lo) && lo < tLow) tLow = lo;
          }
          if (currentPrice === null && Number.isFinite(lastClose)) currentPrice = lastClose;
          if (high52w === null && Number.isFinite(tHigh)) high52w = tHigh;
          if (low52w === null && Number.isFinite(tLow)) low52w = tLow;
          if (change1yPct === null && Number.isFinite(firstClose) && firstClose > 0 && currentPrice !== null) {
            change1yPct = (currentPrice - firstClose) / firstClose;
          }
        }
      }
    } catch {
      /* 腾讯日K也失败，保持空 */
    }
  }

  // 4) 最后兜底：新浪日K(不复权)——可同时算52周高低、现价、近1年涨跌幅
  if (change1yPct === null || currentPrice === null || high52w === null || low52w === null) {
    const sina = await fetchSinaKline(code, exchange);
    if (sina) {
      if (currentPrice === null) currentPrice = sina.currentPrice;
      if (high52w === null) high52w = sina.high52w;
      if (low52w === null) low52w = sina.low52w;
      if (change1yPct === null) change1yPct = sina.change1yPct;
    }
  }

  if (currentPrice === null || high52w === null || low52w === null) return null;
  return { currentPrice, high52w, low52w, change1yPct };
}

/** 新浪日K兜底：可算52周高低、现价与近1年涨跌幅 */
async function fetchSinaKline(code: string, exchange: 'SH' | 'SZ'): Promise<{
  currentPrice: number; high52w: number; low52w: number; change1yPct: number | null;
} | null> {
  try {
    const sym = (exchange === 'SH' ? 'sh' : 'sz') + code;
    const url =
      'https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_=/CN_MarketDataService.getKLineData?symbol=' +
      sym + '&scale=240&ma=no&datalen=260';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.sina.com.cn/' },
      signal: AbortSignal.timeout(10_000),
    });
    const txt = await res.text();
    const m = txt.match(/\((\[.*\])\)/s);
    if (!m) return null;
    const arr = JSON.parse(m[1]) as { high?: unknown; low?: unknown; close?: unknown }[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    let high = -Infinity;
    let low = Infinity;
    let firstClose: number | null = null;
    for (const r of arr) {
      const hi = Number(r.high);
      const lo = Number(r.low);
      const cl = Number(r.close);
      if (firstClose === null && Number.isFinite(cl)) firstClose = cl;
      if (Number.isFinite(hi) && hi > high) high = hi;
      if (Number.isFinite(lo) && lo < low) low = lo;
    }
    const last = Number(arr[arr.length - 1].close);
    if (!Number.isFinite(last) || !Number.isFinite(high) || !Number.isFinite(low)) return null;
    return {
      currentPrice: last,
      high52w: high,
      low52w: low,
      change1yPct: firstClose && firstClose > 0 ? (last - firstClose) / firstClose : null,
    };
  } catch {
    return null;
  }
}

export async function fetchAStockMetrics(code: string, attempt = 1): Promise<FetchResult> {
  const exchange = code.startsWith('6') ? 'SH' : 'SZ';
  const quote = await fetchAQuote(code).catch(() => null);
  const [valuation, dividendHist, financials, payout, forecast, holders, pledge, weekly] = await Promise.allSettled([
    fetchValuationMetrics(code),
    fetchDividendYieldPercentile8y(code, exchange),
    fetchFinancials(code, exchange),
    fetchPayoutRatio(code, exchange),
    fetchInstitutionalForecast(code),
    fetchTopHolders(code, exchange),
    fetchPledge(code),
    fetch52WeekData(code, exchange),
  ]);

  const fields: Partial<Record<string, MetricField>> = {};
  if (quote) Object.assign(fields, quote.fields);
  for (const r of [valuation, dividendHist, financials, payout, forecast, holders, pledge]) {
    if (r.status === 'fulfilled') Object.assign(fields, r.value);
  }
  if (weekly.status === 'fulfilled' && weekly.value) {
    const w = weekly.value;
    fields.currentPrice = { value: w.currentPrice };
    fields.high52w = { value: w.high52w };
    fields.low52w = { value: w.low52w };
    fields.high52wPct = w.currentPrice > 0 ? { value: (w.high52w - w.currentPrice) / w.currentPrice } : { value: null };
    fields.low52wPct = w.currentPrice > 0 ? { value: (w.low52w - w.currentPrice) / w.currentPrice } : { value: null };
    fields.change1yPct = typeof w.change1yPct === 'number' ? { value: w.change1yPct } : { value: null };
  }
  // 兜底：K线数据缺失时，用实时现价(不复权)作为当前股价，避免观察页股价显示为空
  if (fields.currentPrice?.value == null && typeof fields.price?.value === 'number') {
    fields.currentPrice = { value: fields.price.value };
  }

  // PEG = PE / (G×100)，G 为机构预测增长率的点估计(小数，如 0.15 → 15)
  const pe = fields.pe?.value;
  const g = fields.forecastG?.value;
  if (typeof pe === 'number' && pe > 0 && typeof g === 'number' && g > 0) {
    fields.peg = { value: pe / (g * 100) };
  } else {
    fields.peg = { value: null, error: 'PEG需有效PE与机构预测G' };
  }

  // 只有股价而其他关键指标全缺（疑似东财限流）时，整体重试，间隔递增
  const keyMetrics = ['pe', 'pb', 'ps', 'dividendYield', 'revenue', 'grossMargin'];
  const got = keyMetrics.filter((k) => fields[k]?.value != null).length;
  if (attempt < 3 && got === 0 && fields.price?.value != null) {
    await new Promise((r) => setTimeout(r, attempt === 1 ? 1200 : 2200));
    return fetchAStockMetrics(code, attempt + 1);
  }

  return { source: '东方财富 + 研报中心', updatedAt: new Date().toISOString(), fields };
}
