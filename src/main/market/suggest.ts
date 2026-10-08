export interface StockSearchResult { code: string; name: string; market: 'SH' | 'SZ' }

/**
 * 用东方财富建议搜索接口，按股票代码或名称模糊搜索 A 股。
 * 输入「工商银行」或「601398」均可命中；返回沪深 A 股（代码6位）。
 */
export async function searchStock(keyword: string): Promise<StockSearchResult[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(kw)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=12`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`搜索接口失败：${res.status}`);
  const json = (await res.json()) as { QuotationCodeTable?: { Data?: unknown[] } };
  const data = json.QuotationCodeTable?.Data;
  if (!Array.isArray(data)) return [];

  const out: StockSearchResult[] = [];
  for (const item of data) {
    const rec = item as { Code?: unknown; Name?: unknown; MarketType?: unknown };
    const code = String(rec.Code ?? '');
    const name = String(rec.Name ?? '');
    const mtype = Number(rec.MarketType);
    if (!/^\d{6}$/.test(code)) continue; // 只要 A 股 6 位代码
    if (mtype === 1) out.push({ code, name, market: 'SH' });
    else if (mtype === 2) out.push({ code, name, market: 'SZ' });
  }
  // 按代码去重
  const seen = new Set<string>();
  const deduped = out.filter((s) => (seen.has(s.code) ? false : (seen.add(s.code), true)));
  // 过滤退市/长期停牌股（通过新浪K线最近交易日判断）
  const delistedFlags = await Promise.all(deduped.map((s) => isDelisted(s.code, s.market)));
  return deduped.filter((_, i) => !delistedFlags[i]);
}

/** 判断是否退市/长期停牌：新浪K线最近交易日距今超过60天即视为退市 */
async function isDelisted(code: string, market: 'SH' | 'SZ'): Promise<boolean> {
  try {
    const sym = (market === 'SH' ? 'sh' : 'sz') + code;
    const url =
      'https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_=/CN_MarketDataService.getKLineData?symbol=' +
      sym + '&scale=240&ma=no&datalen=10';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.sina.com.cn/' },
      signal: AbortSignal.timeout(6_000),
    });
    const txt = await res.text();
    const m = txt.match(/\((\[.*\])\)/s);
    if (!m) return false;
    const arr = JSON.parse(m[1]);
    if (!Array.isArray(arr) || arr.length === 0) return false;
    const lastDay = String((arr[arr.length - 1] as { day?: unknown }).day ?? '');
    if (!lastDay) return false;
    const diffDays = (Date.now() - new Date(lastDay).getTime()) / 86400000;
    return diffDays > 60;
  } catch {
    return false; // 判断失败时不误删
  }
}
