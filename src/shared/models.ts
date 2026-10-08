export type Market = 'CN' | 'HK';

export interface Industry {
  id: number;
  name: string;
  createdAt: string;
}

export interface Stock {
  id: number;
  code: string;
  name: string;
  market: Market;
  industryId: number;
  createdAt: string;
}

export interface Holding {
  stockId: number;
  shares: number;
}

export interface Note {
  stockId: number;
  content: string;
  updatedAt: string;
}

/**
 * A股完整财务/估值/股东指标。
 * 金额字段统一用「元」；比率字段用小数（0.15 = 15%）；PE/PB/PS/PEG 用倍数。
 * 仅用于 A 股；港股这些字段恒为 null。
 */
export interface ExpandedMetrics {
  // —— 基本信息 ——
  /** 当前股价（不复权，元） */
  currentPrice: number | null;
  /** 52周内最高价（不复权，元） */
  high52w: number | null;
  /** 52周内最低价（不复权，元） */
  low52w: number | null;
  /** 52周最高价相对当前价的偏差（小数，正=高于当前价） */
  high52wPct: number | null;
  /** 52周最低价相对当前价的偏差（小数，负=低于当前价） */
  low52wPct: number | null;
  /** 近1年股价涨跌幅（不复权，小数） */
  change1yPct: number | null;
  /** 历史股息率百分位（8年，0-100） */
  dividendYieldPercentile8y: number | null;
  /** 股利支付率（最新年报，小数） */
  payoutRatio: number | null;
  /** 历史股利支付率百分位（15年，0-100） */
  payoutRatioPercentile15y: number | null;
  /** PE 历史百分位（0-100） */
  pePercentile: number | null;
  /** PB 历史百分位（0-100） */
  pbPercentile: number | null;
  /** PEG = PE / G（G 用百分数） */
  peg: number | null;
  /** PS（市销率，TTM） */
  ps: number | null;
  /** 点估计的 G：15 家机构预测复合增长率的点估计值（小数） */
  forecastG: number | null;
  /** PEG 点估计所用机构样本家数 */
  forecastSampleN: number | null;
  /** 机构预期营业收入（2026预测平均值，元；来自机构研报预测） */
  forecastRevenue: number | null;

  // —— 财报信息 ——
  /** 主营收入（最新年报，元） */
  revenue: number | null;
  /** 毛利率（最新年报，小数） */
  grossMargin: number | null;
  /** 营业利润率（最新年报，小数） */
  operatingMargin: number | null;
  /** 经营现金流净额 CFO（最新年报，元） */
  cfo: number | null;
  /** 自由现金流 FCF = CFO - 资本开支（元） */
  fcf: number | null;
  /** CFO / 扣非净利润 */
  cfoToDeductProfit: number | null;
  /** ROIC（小数） */
  roic: number | null;
  /** 净负债（有息负债 - 货币资金，元） */
  netDebt: number | null;
  /** 资产负债率（小数） */
  debtRatio: number | null;

  // —— 其他视角 ——
  /** 前十大股东持有占比（小数） */
  top10HoldersPct: number | null;
  /** 股权质押率（小数） */
  pledgeRatio: number | null;
  /** 应付账款（元） */
  accountsPayable: number | null;
  /** 预付账款（元） */
  prepayment: number | null;
}

export const EMPTY_METRICS: ExpandedMetrics = {
  currentPrice: null,
  high52w: null,
  low52w: null,
  high52wPct: null,
  low52wPct: null,
  change1yPct: null,
  dividendYieldPercentile8y: null,
  payoutRatio: null,
  payoutRatioPercentile15y: null,
  pePercentile: null,
  pbPercentile: null,
  peg: null,
  ps: null,
  forecastG: null,
  forecastSampleN: null,
  forecastRevenue: null,
  revenue: null,
  grossMargin: null,
  operatingMargin: null,
  cfo: null,
  fcf: null,
  cfoToDeductProfit: null,
  roic: null,
  netDebt: null,
  debtRatio: null,
  top10HoldersPct: null,
  pledgeRatio: null,
  accountsPayable: null,
  prepayment: null,
};
