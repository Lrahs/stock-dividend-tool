import { percentile } from './percentile';
import { fetchAllPages, num, ok, err, type FieldMap } from './fetch-utils';

type Exchange = 'SH' | 'SZ';

/** 从利润分配方案解析每股派息(元/股)。如「10派7.90元(含税...)」→0.79；「10转5派3.7元」→0.37 */
function parsePayoutPerShare(plan: string | null | undefined): number {
  if (!plan) return 0;
  const m = /派\s*([\d.]+)/.exec(plan);
  if (!m) return 0;
  const cash = Number(m[1]);
  return Number.isFinite(cash) ? cash / 10 : 0;
}

interface BonusRow {
  REPORT_DATE?: string;
  IMPL_PLAN_PROFILE?: string | null;
  BASIC_EPS?: number;
}

/**
 * 股利支付率：按年度汇总每股派息 / 该年 EPS。当前取最新年度，历史百分位取最近 15 个有分配年度。
 */
export async function fetchPayoutRatio(code: string, exchange: Exchange): Promise<FieldMap> {
  try {
    const url =
      'https://datacenter-web.eastmoney.com/api/data/v1/get' +
      `?reportName=RPT_SHAREBONUS_DET&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)` +
      '&sortTypes=-1&sortColumns=REPORT_DATE&source=WEB&client=WEB';
    const rows = await fetchAllPages<BonusRow>(url, { pageSize: 50, maxPages: 2 });
    if (rows.length === 0) return { payoutRatio: err('暂无分红数据'), payoutRatioPercentile15y: err('暂无分红数据') };

    // 按年度汇总：每股派息合计 + 年报 EPS
    const byYear = new Map<string, { payout: number; eps: number | null }>();
    for (const row of rows) {
      const year = row.REPORT_DATE?.slice(0, 4);
      if (!year) continue;
      const isAnnual = row.REPORT_DATE !== undefined && row.REPORT_DATE.includes('12-31');
      const entry = byYear.get(year) ?? { payout: 0, eps: null };
      entry.payout += parsePayoutPerShare(row.IMPL_PLAN_PROFILE);
      if (isAnnual) entry.eps = num(row.BASIC_EPS);
      byYear.set(year, entry);
    }

    // 各年度支付率(有分配且EPS>0)
    const years = [...byYear.keys()].sort((a, b) => Number(a) - Number(b));
    const payoutByYear = new Map<string, number>();
    for (const y of years) {
      const e = byYear.get(y)!;
      if (e.eps !== null && e.eps > 0 && e.payout > 0) payoutByYear.set(y, e.payout / e.eps);
    }

    const sortedYears = [...payoutByYear.keys()].sort((a, b) => Number(a) - Number(b));
    if (sortedYears.length === 0) {
      return { payoutRatio: err('暂无支付率数据'), payoutRatioPercentile15y: err('暂无支付率数据') };
    }

    const currentYear = sortedYears[sortedYears.length - 1];
    const current = payoutByYear.get(currentYear)!;

    // 最近 15 个年度
    const last15 = sortedYears.slice(-15);
    const hist = last15.map((y) => payoutByYear.get(y)!);

    const fields: FieldMap = { payoutRatio: ok(current) };
    const pct = percentile(hist, current, { positiveOnly: true });
    fields.payoutRatioPercentile15y = pct === null ? err('暂无支付率百分位') : ok(pct);
    return fields;
  } catch {
    return { payoutRatio: err('分红接口异常'), payoutRatioPercentile15y: err('分红接口异常') };
  }
}
