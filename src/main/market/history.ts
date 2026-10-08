import { percentile } from './percentile';
import { fetchAllPages, num, ok, err, pctToDecimal, type FieldMap } from './fetch-utils';

type Exchange = 'SH' | 'SZ';

const yearsAgo = (years: number): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
};

/** 过滤出某个起始日期(含)之后的每日序列 */
function filterSince<T>(rows: T[], since: string, dateOf: (r: T) => string | null | undefined): T[] {
  return rows.filter((r) => {
    const d = dateOf(r);
    return d !== null && d !== undefined && d.slice(0, 10) >= since;
  });
}

/**
 * 历史估值：拉多年每日 PE_TTM/PB_MRQ/PS_TTM，算 PE/PB 历史百分位(默认8年)，并返回当前 PE/PB/PS。
 */
export async function fetchValuationMetrics(code: string): Promise<FieldMap> {
  try {
    const url =
      'https://datacenter-web.eastmoney.com/api/data/v1/get' +
      `?reportName=RPT_VALUEANALYSIS_DET&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)` +
      '&sortTypes=-1&sortColumns=TRADE_DATE&source=WEB&client=WEB';
    const rows = await fetchAllPages<{
      TRADE_DATE?: string; PE_TTM?: number; PB_MRQ?: number; PS_TTM?: number;
    }>(url, { pageSize: 2000, maxPages: 6 });
    if (rows.length === 0) return { pe: err('暂无历史估值'), pb: err('暂无历史估值'), ps: err('暂无PS') };

    const since = yearsAgo(8);
    const recent = filterSince(rows, since, (r) => r.TRADE_DATE);
    const latest = rows[0];

    const pe = num(latest.PE_TTM);
    const pb = num(latest.PB_MRQ);
    const ps = num(latest.PS_TTM);

    const peHist = recent.map((r) => num(r.PE_TTM)).filter((v): v is number => v !== null && v > 0);
    const pbHist = recent.map((r) => num(r.PB_MRQ)).filter((v): v is number => v !== null && v > 0);

    const fields: FieldMap = {
      pe: pe === null ? err('暂无PE') : ok(pe),
      pb: pb === null ? err('暂无PB') : ok(pb),
      ps: ps === null ? err('暂无PS') : ok(ps),
    };
    const pePct = pe === null ? null : percentile(peHist, pe, { positiveOnly: true });
    const pbPct = pb === null ? null : percentile(pbHist, pb, { positiveOnly: true });
    if (pePct !== null) fields.pePercentile = ok(pePct);
    if (pbPct !== null) fields.pbPercentile = ok(pbPct);
    return fields;
  } catch (e) {
    return { pe: err('估值接口异常'), pb: err('估值接口异常'), ps: err('估值接口异常') };
  }
}

/**
 * 历史股息率百分位(8年)：拉多年每日滚动股息率，当前值(最新)在8年序列中的百分位。
 * 也返回当前股息率(小数)。
 */
export async function fetchDividendYieldPercentile8y(code: string, exchange: Exchange): Promise<FieldMap> {
  try {
    const url =
      'https://datacenter.eastmoney.com/securities/api/data/v1/get' +
      `?reportName=RPT_F10_DIVIDEND_CURVE&columns=ALL&filter=(SECUCODE%3D%22${code}.${exchange}%22)` +
      '&sortTypes=-1&sortColumns=TRADE_DATE&source=HSF10&client=PC';
    const rows = await fetchAllPages<{ TRADE_DATE?: string; DIVIDEND_NEWRATIO_HYY?: number }>(
      url,
      { pageSize: 2000, maxPages: 6 },
    );
    if (rows.length === 0) return { dividendYieldPercentile8y: err('暂无历史股息率') };

    const since = yearsAgo(8);
    const recent = filterSince(rows, since, (r) => r.TRADE_DATE);
    const latestYield = pctToDecimal(rows[0].DIVIDEND_NEWRATIO_HYY);
    const hist = recent
      .map((r) => pctToDecimal(r.DIVIDEND_NEWRATIO_HYY))
      .filter((v): v is number => v !== null && v > 0);

    const fields: FieldMap = {};
    if (latestYield === null) {
      fields.dividendYieldPercentile8y = err('暂无历史股息率');
      fields.dividendYield = err('暂无股息率');
    } else {
      fields.dividendYield = ok(latestYield);
      const pct = percentile(hist, latestYield, { positiveOnly: true });
      // 数据成功取到但历史无正数股息（如不分红股）→ 显示 0%，仅真正获取失败才显示"暂无数据"
      fields.dividendYieldPercentile8y = pct === null ? ok(0) : ok(pct);
    }
    return fields;
  } catch {
    return { dividendYieldPercentile8y: err('股息率历史接口异常') };
  }
}
