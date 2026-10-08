import { fetchAllPages, num, ok, err, pctToDecimal, type FieldMap } from './fetch-utils';

type Exchange = 'SH' | 'SZ';

const F10 = 'https://datacenter.eastmoney.com/securities/api/data/v1/get';

/** 最新报告期（降序第一行；可能是年报/中报/一季报/三季报，即"当下"最新一期） */
function latest<T>(rows: T[]): T | undefined {
  return rows[0];
}

const fetchRows = <T = Record<string, unknown>>(
  reportName: string, code: string, exchange: Exchange, sortColumn = 'REPORT_DATE',
) =>
  fetchAllPages<T>(
    `${F10}?reportName=${reportName}&columns=ALL&filter=(SECUCODE%3D%22${code}.${exchange}%22)&sortTypes=-1&sortColumns=${sortColumn}&source=HSF10&client=PC`,
    { pageSize: 20, maxPages: 2 },
  );

interface CashRow { REPORT_DATE?: string; NETCASH_OPERATE?: number; CONSTRUCT_LONG_ASSET?: number }
interface BalanceRow {
  REPORT_DATE?: string; TOTAL_ASSETS?: number; TOTAL_LIABILITIES?: number;
  ACCOUNTS_PAYABLE?: number; PREPAYMENT?: number; MONETARYFUNDS?: number;
  SHORT_LOAN?: number; LONG_LOAN?: number; BOND_PAYABLE?: number;
  NONCURRENT_LIAB_1YEAR?: number; SHORT_BOND_PAYABLE?: number; LEASE_LIAB?: number;
  TOTAL_PARENT_EQUITY?: number;
}

/** 现金流量表：银行等金融股用专用接口 RPT_F10_FINANCE_BCASHFLOW，通用版为空时回退 */
async function fetchCash(code: string, exchange: Exchange) {
  const rows = await fetchRows<CashRow>('RPT_F10_FINANCE_GCASHFLOW', code, exchange);
  if (rows.length > 0) return { rows, isBank: false };
  return {
    rows: await fetchRows<CashRow>('RPT_F10_FINANCE_BCASHFLOW', code, exchange),
    isBank: true,
  };
}

/** 资产负债表：银行等金融股用专用接口 RPT_F10_FINANCE_BBALANCE，通用版为空时回退 */
async function fetchBalance(code: string, exchange: Exchange) {
  const rows = await fetchRows<BalanceRow>('RPT_F10_FINANCE_GBALANCE', code, exchange);
  if (rows.length > 0) return { rows, isBank: false };
  return {
    rows: await fetchRows<BalanceRow>('RPT_F10_FINANCE_BBALANCE', code, exchange),
    isBank: true,
  };
}

/**
 * 财报信息组：主营收入/毛利率/营业利润率/CFO/FCF/CFO扣非净利比/ROE/ROIC/净负债/资产负债率/应付/预付。
 * 全部取最新报告期（当下最新一期报表，含年报/中报/季报）。
 */
export async function fetchFinancials(code: string, exchange: Exchange): Promise<FieldMap> {
  try {
    const [incomeRows, cashRes, balanceRes, mainRows] = await Promise.all([
      fetchRows<{
        REPORT_DATE?: string; OPERATE_INCOME?: number; OPERATE_COST?: number;
        OPERATE_PROFIT?: number; DEDUCT_PARENT_NETPROFIT?: number;
      }>('RPT_F10_FINANCE_GINCOME', code, exchange),
      fetchCash(code, exchange),
      fetchBalance(code, exchange),
      fetchRows<{ REPORTDATE?: string; WEIGHTAVG_ROE?: number; XSMLL?: number }>('RPT_LICO_FN_CPD', code, exchange, 'REPORTDATE'),
    ]);

    const isBank = cashRes.isBank || balanceRes.isBank;
    const income = latest(incomeRows);
    const cash = latest(cashRes.rows);
    const balance = latest(balanceRes.rows);
    const main = mainRows[0];

    const fields: FieldMap = {};
    const f = (name: keyof FieldMap & string, value: number | null, errText: string) => {
      (fields as Record<string, { value: number | null; error?: string }>)[name] =
        value === null ? { value: null, error: errText } : { value };
      return value;
    };

    if (!income && !cash && !balance && !main) return { revenue: err('暂无财报数据') };

    // 主营收入
    const revenue = f('revenue', num(income?.OPERATE_INCOME), '暂无主营收入');
    // 毛利率：优先用东财现成「销售毛利率」(XSMLL)，缺失时回退自算 (收入-成本)/收入；银行无销售毛利概念
    const xsmll = main ? pctToDecimal(main.XSMLL) : null;
    const opIncome = num(income?.OPERATE_INCOME);
    const opCost = num(income?.OPERATE_COST);
    const grossMargin = isBank
      ? null
      : xsmll ?? (
          opIncome !== null && opIncome > 0 && opCost !== null
            ? (opIncome - opCost) / opIncome
            : null
        );
    f('grossMargin', grossMargin, isBank ? '不适用（银行）' : '暂无毛利率');
    // 营业利润率 = 营业利润/营业收入
    const opProfit = num(income?.OPERATE_PROFIT);
    const operatingMargin = opIncome !== null && opIncome > 0 && opProfit !== null
      ? opProfit / opIncome
      : null;
    f('operatingMargin', operatingMargin, '暂无营业利润率');
    // CFO
    const cfo = f('cfo', num(cash?.NETCASH_OPERATE), '暂无CFO');
    // FCF = CFO - 资本开支
    const capex = num(cash?.CONSTRUCT_LONG_ASSET);
    const fcf = cfo !== null && capex !== null ? cfo - capex : null;
    f('fcf', fcf, '暂无FCF');
    // CFO/扣非净利润
    const deductProfit = num(income?.DEDUCT_PARENT_NETPROFIT);
    const cfoToDeduct = cfo !== null && deductProfit !== null && deductProfit > 0
      ? cfo / deductProfit
      : null;
    f('cfoToDeductProfit', cfoToDeduct, '暂无CFO/扣非净利');
    // ROE（最新年报加权ROE）
    const roe = f('roe', main ? pctToDecimal(main.WEIGHTAVG_ROE) : null, '暂无ROE');
    void roe;

    // 资产负债表项
    const totalAssets = num(balance?.TOTAL_ASSETS);
    const totalLiab = num(balance?.TOTAL_LIABILITIES);
    const monetary = num(balance?.MONETARYFUNDS);
    const parentEquity = num(balance?.TOTAL_PARENT_EQUITY);
    const interestDebt =
      (num(balance?.SHORT_LOAN) ?? 0) +
      (num(balance?.NONCURRENT_LIAB_1YEAR) ?? 0) +
      (num(balance?.LONG_LOAN) ?? 0) +
      (num(balance?.BOND_PAYABLE) ?? 0) +
      (num(balance?.SHORT_BOND_PAYABLE) ?? 0) +
      (num(balance?.LEASE_LIAB) ?? 0);

    // 资产负债率
    const debtRatio = totalAssets !== null && totalAssets > 0 && totalLiab !== null
      ? totalLiab / totalAssets
      : null;
    f('debtRatio', debtRatio, '暂无资产负债率');
    // 净负债 = 有息负债 - 货币资金（银行无传统货币资金/有息负债口径，标注不适用）
    const netDebt = isBank ? null : (monetary !== null ? interestDebt - monetary : null);
    f('netDebt', netDebt, isBank ? '不适用（银行）' : '暂无净负债');
    // ROIC = NOPAT / 投入资本 = 营业利润*(1-25%) / (归母权益+有息负债-货币资金)（银行意义小，标注不适用）
    const investedCapital =
      parentEquity !== null && monetary !== null ? parentEquity + interestDebt - monetary : null;
    const nopat = opProfit !== null ? opProfit * (1 - 0.25) : null;
    const roic = isBank
      ? null
      : (nopat !== null && investedCapital !== null && investedCapital > 0
          ? nopat / investedCapital
          : null);
    f('roic', roic, isBank ? '不适用（银行）' : '暂无ROIC');
    // 应付账款 / 预付账款（银行无传统应付/预付科目，标注不适用；个别有值则显示）
    f('accountsPayable', num(balance?.ACCOUNTS_PAYABLE), isBank ? '不适用（银行）' : '暂无应付账款');
    f('prepayment', isBank ? null : num(balance?.PREPAYMENT), isBank ? '不适用（银行）' : '暂无预付账款');

    return fields;
  } catch {
    return { revenue: err('财报接口异常') };
  }
}
