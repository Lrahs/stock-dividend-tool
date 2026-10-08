import * as XLSX from 'xlsx';
import type { WatchStock } from '../../app/seed-data';

const value = (number: number | null, suffix = '') => number === null ? '暂无数据' : `${number}${suffix}`;
const pct = (number: number | null) => value(number === null ? null : number * 100, '%');
const pctile = (number: number | null) => value(number === null ? null : number, '%');
const yi = (number: number | null) => number === null ? '暂无数据' : `¥${(number / 1e8).toFixed(2)}亿`;
const yib = (number: number | null) => number === null ? '暂无数据' : `${(number / 1e8).toFixed(2)}亿`;
const mult = (number: number | null) => value(number);

export function createWorkbook(stocks: WatchStock[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  for (const stock of stocks) {
    const rows = [
      ['股票代码', stock.code], ['股票名称', stock.name], ['市场', stock.currency === 'HKD' ? '港股' : 'A股'], ['一级行业', stock.industry],
      ['当前股价', value(stock.price, stock.currency === 'HKD' ? ' HKD' : ' CNY')],
      ['—— 基本信息 ——', ''],
      ['当前股价(不复权)', value(stock.currentPrice, ' CNY')],
      ['52周最高(不复权)', stock.high52w === null ? '暂无数据' : `¥${stock.high52w.toFixed(2)}${stock.high52wPct === null ? '' : ` (较当前+${(stock.high52wPct * 100).toFixed(2)}%)`}`],
      ['52周最低(不复权)', stock.low52w === null ? '暂无数据' : `¥${stock.low52w.toFixed(2)}${stock.low52wPct === null ? '' : ` (较当前${(stock.low52wPct * 100).toFixed(2)}%)`}`],
      ['股息率（东方财富口径）', pct(stock.dividendYield)],
      ['历史股息率百分位(8年)', pctile(stock.dividendYieldPercentile8y)],
      ['股利支付率', pct(stock.payoutRatio)],
      ['历史股利支付率百分位(15年)', pctile(stock.payoutRatioPercentile15y)],
      ['PE(TTM)', mult(stock.pe)],
      ['PE历史百分位', pctile(stock.pePercentile)],
      ['PB', mult(stock.pb)],
      ['PB历史百分位', pctile(stock.pbPercentile)],
      ['PEG', mult(stock.peg)],
      ['机构样本与预测G(复合)', stock.forecastSampleN === null || stock.forecastG === null ? '暂无数据' : `${stock.forecastSampleN}家 / ${(stock.forecastG * 100).toFixed(2)}%`],
      ['PS(TTM)', mult(stock.ps)],
      ['—— 财报信息（最新报告期） ——', ''],
      ['主营收入', stock.forecastRevenue == null ? yi(stock.revenue) : `${yib(stock.revenue)}（${yib(stock.forecastRevenue)}）`],
      ['毛利率', pct(stock.grossMargin)],
      ['营业利润率', pct(stock.operatingMargin)],
      ['CFO 经营现金流', yi(stock.cfo)],
      ['FCF 自由现金流', yi(stock.fcf)],
      ['CFO/扣非净利润', mult(stock.cfoToDeductProfit)],
      ['ROE', pct(stock.roe)],
      ['ROIC', pct(stock.roic)],
      ['净负债', yi(stock.netDebt)],
      ['资产负债率', pct(stock.debtRatio)],
      ['—— 其他视角 ——', ''],
      ['前十大股东持有占比', pct(stock.top10HoldersPct)],
      ['股权质押率', pct(stock.pledgeRatio)],
      ['应付账款', yi(stock.accountsPayable)],
      ['预付账款', yi(stock.prepayment)],
      ['数据来源', '东方财富 / 研报中心'],
      ['最新更新时间', new Date().toLocaleString('zh-CN')],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet['!cols'] = [{ wch: 26 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(workbook, sheet, `${stock.code}-${stock.name}`.slice(0, 31));
  }
  return workbook;
}

export function downloadWorkbook(stocks: WatchStock[]): void {
  XLSX.writeFile(createWorkbook(stocks), `攒股收息数据快照-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
