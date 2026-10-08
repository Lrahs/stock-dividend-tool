import { fetchAllPages, num, ok, err, pctToDecimal, type FieldMap } from './fetch-utils';

type Exchange = 'SH' | 'SZ';

/**
 * 前十大股东持有占比：取最新报告期前 10 名股东持股比例之和(小数)。
 * HOLD_NUM_RATIO 接口为百分数(如 5.57 表示 5.57%)。
 */
export async function fetchTopHolders(code: string, exchange: Exchange): Promise<FieldMap> {
  try {
    const url =
      'https://datacenter.eastmoney.com/securities/api/data/v1/get' +
      `?reportName=RPT_F10_EH_HOLDERS&columns=ALL&filter=(SECUCODE%3D%22${code}.${exchange}%22)` +
      '&sortTypes=-1&sortColumns=END_DATE&source=HSF10&client=PC';
    const rows = await fetchAllPages<{
      END_DATE?: string; HOLDER_RANK?: number; HOLD_NUM_RATIO?: number;
    }>(url, { pageSize: 50, maxPages: 2 });
    if (rows.length === 0) return { top10HoldersPct: err('暂无股东数据') };

    const latestEnd = rows[0].END_DATE;
    const top10 = rows
      .filter((r) => r.END_DATE === latestEnd)
      .filter((r) => typeof r.HOLDER_RANK === 'number' && r.HOLDER_RANK >= 1 && r.HOLDER_RANK <= 10);
    if (top10.length === 0) return { top10HoldersPct: err('暂无前十大股东') };

    const sum = top10.reduce((acc, r) => acc + (pctToDecimal(r.HOLD_NUM_RATIO) ?? 0), 0);
    return { top10HoldersPct: ok(sum > 0 ? sum : null) };
  } catch {
    return { top10HoldersPct: err('股东接口异常') };
  }
}

/**
 * 股权质押率：个股日历里事件类型「股权质押」(EVENT_TYPE_CODE=001) 的最新一条，
 * 解析「质押总比例 X%」。
 */
export async function fetchPledge(code: string): Promise<FieldMap> {
  try {
    const url =
      'https://datacenter.eastmoney.com/api/data/v1/get' +
      `?reportName=RPT_STOCKCALENDAR&columns=ALL&filter=(SECURITY_CODE%3D%22${code}%22)(EVENT_TYPE_CODE%3D%22001%22)` +
      '&sortTypes=-1&sortColumns=NOTICE_DATE&source=WEB&client=WEB';
    const rows = await fetchAllPages<{ LEVEL1_CONTENT?: string }>(url, { pageSize: 10, maxPages: 2 });
    const latest = rows.find((r) => typeof r.LEVEL1_CONTENT === 'string');
    if (!latest) return { pledgeRatio: err('暂无质押数据') };
    const match = /质押总比例\s*([\d.]+)\s*%/.exec(latest.LEVEL1_CONTENT!);
    if (!match) return { pledgeRatio: err('暂无质押数据') };
    const ratio = num(Number(match[1]));
    return { pledgeRatio: ratio === null ? err('暂无质押数据') : ok(ratio / 100) };
  } catch {
    return { pledgeRatio: err('质押接口异常') };
  }
}
