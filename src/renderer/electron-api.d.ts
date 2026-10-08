interface Window {
  stockIncome?: {
    getQuote(code: string): Promise<{ fields?: Record<string, { value?: number }> ; updatedAt?: string } | null>;
    searchStock(keyword: string): Promise<{ code: string; name: string; market: 'SH' | 'SZ' }[]>;
    loadStocks(): Promise<unknown[] | null>;
    saveStocks(data: unknown): Promise<boolean>;
  };
}
