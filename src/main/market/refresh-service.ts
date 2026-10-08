import type { Stock } from '../../shared/models';

export type MetricName =
  | 'price' | 'roe' | 'dividendYield' | 'pe' | 'pb'
  // 基本信息
  | 'dividendYieldPercentile8y' | 'payoutRatio' | 'payoutRatioPercentile15y'
  | 'pePercentile' | 'pbPercentile' | 'peg' | 'ps' | 'forecastG' | 'forecastSampleN' | 'forecastRevenue'
  // 财报信息
  | 'revenue' | 'grossMargin' | 'operatingMargin' | 'cfo' | 'fcf' | 'cfoToDeductProfit'
  | 'roic' | 'netDebt' | 'debtRatio'
  // 其他视角
  | 'top10HoldersPct' | 'pledgeRatio' | 'accountsPayable' | 'prepayment';
export type FieldStatus = 'fresh' | 'stale' | 'unavailable';

export interface MetricField {
  value?: number | null;
  status?: FieldStatus;
  updatedAt?: string;
  error?: string;
}

export interface Snapshot {
  source: string;
  updatedAt: string;
  fields: Partial<Record<MetricName, MetricField>>;
}

export interface FetchResult {
  source: string;
  updatedAt: string;
  fields: Partial<Record<MetricName, { value?: number | null; error?: string }>>;
}

export interface MarketSource {
  fetchSnapshot(stock: Stock): Promise<FetchResult>;
}

export class RefreshService {
  constructor(private readonly source: MarketSource) {}

  async refreshOne(stock: Stock, previous: Snapshot | null): Promise<Snapshot> {
    const fetched = await this.source.fetchSnapshot(stock);
    const fields: Snapshot['fields'] = {};
    const names = new Set<MetricName>([
      ...Object.keys(previous?.fields ?? {}),
      ...Object.keys(fetched.fields),
    ] as MetricName[]);

    for (const name of names) {
      const received = fetched.fields[name];
      const old = previous?.fields[name];
      if (received && received.error === undefined && received.value !== undefined && received.value !== null) {
        fields[name] = { value: received.value, status: 'fresh', updatedAt: fetched.updatedAt };
      } else if (old?.value !== undefined && old.value !== null) {
        fields[name] = { value: old.value, status: 'stale', updatedAt: old.updatedAt ?? previous?.updatedAt, error: received?.error ?? '本次刷新未返回数据' };
      } else {
        fields[name] = { value: null, status: 'unavailable', updatedAt: fetched.updatedAt, error: received?.error ?? '暂无数据' };
      }
    }
    return { source: fetched.source, updatedAt: fetched.updatedAt, fields };
  }
}
