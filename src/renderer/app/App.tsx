import { useEffect, useMemo, useRef, useState } from "react";
import { buildPortfolio } from "../features/portfolio/calculations";
import { visibleHoldings } from "../features/portfolio/selectors";
import { initialStocks, type WatchStock, ALL_INDUSTRIES } from "./seed-data";
import { EMPTY_METRICS } from "../../shared/models";
import { loadStocks, saveStocks, normalizeStocks, loadIndustries, saveIndustries } from "./local-store";
import { downloadWorkbook } from "../features/export/xlsx-exporter";
import { rankDividendStocks } from "../features/ranking/dividend-ranking";

const sidebarBag = new URL("../../../assets/plates/sidebar-bag.png", import.meta.url).href;
const goalBag = new URL("../../../assets/plates/goal-bag.png", import.meta.url).href;
const appIcon = new URL("../../../assets/icons/app-icon.png", import.meta.url).href;

export const appTitle = "攒股收息小工具";
/** 所有可从行情接口刷新的指标字段（与 WatchStock 属性同名） */
const metricFields = [
  "price", "currentPrice", "high52w", "low52w", "high52wPct", "low52wPct", "roe", "dividendYield", "pe", "pb",
  "pePercentile", "pbPercentile", "dividendYieldPercentile8y",
  "payoutRatio", "payoutRatioPercentile15y", "peg", "ps",
  "forecastG", "forecastSampleN", "forecastRevenue",
  "revenue", "grossMargin", "operatingMargin", "cfo", "fcf",
  "cfoToDeductProfit", "roic", "netDebt", "debtRatio",
  "top10HoldersPct", "pledgeRatio", "accountsPayable", "prepayment",
] as const;
const money = (value: number) =>
  `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
export const formatPercent = (value: number | null) =>
  value === null ? "暂无数据" : `${(value * 100).toFixed(2)}%`;
/** 金额(元) → 亿/万 */
export const formatYuan = (value: number | null) => {
  if (value === null) return "暂无数据";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `¥${(value / 1e8).toFixed(2)} 亿`;
  if (abs >= 1e4) return `¥${(value / 1e4).toFixed(1)} 万`;
  return `¥${value.toLocaleString("zh-CN")}`;
};
/** 亿格式：无 ¥ 符号，用于主营收入（最新财报值 + 机构预期值） */
const formatYi = (value: number | null) =>
  value === null ? "暂无数据" : `${(value / 1e8).toFixed(2)}亿`;
/** 倍数(PE/PB/PS/PEG/比率) */
export const formatMulti = (value: number | null, digits = 2) =>
  value === null ? "暂无数据" : value.toFixed(digits);
/** 百分位(0-100) */
export const formatPercentile = (value: number | null) =>
  value === null ? "暂无数据" : `${value.toFixed(1)}%`;
export const normalizeSharesToLots = (value: number) =>
  Math.max(0, Math.floor(value / 100) * 100);
const percent = formatPercent;
const formatPrice = (value: number | null) => value === null ? "暂无数据" : "¥" + value.toFixed(2);
const formatPriceWithDev = (price: number | null, dev: number | null) => {
  if (price === null) return "暂无数据";
  const base = "¥" + price.toFixed(2);
  if (dev === null) return base;
  const sign = dev >= 0 ? "+" : "";
  return base + "（" + sign + (dev * 100).toFixed(2) + "%）";
};
type Page = "holdings" | "research" | "ranking";

export function App() {
  const [page, setPage] = useState<Page>("holdings");
  const [holdingNotice, setHoldingNotice] = useState<{ message: string } | null>(null);
  useEffect(() => {
    if (!holdingNotice) return;
    const timer = window.setTimeout(() => setHoldingNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [holdingNotice]);
  const [stocks, setStocks] = useState(loadStocks);
  const saveRef = useRef<number | null>(null);
  const [industryList, setIndustryList] = useState(loadIndustries);
  const [manageOpen, setManageOpen] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState("");
  const [industryMsg, setIndustryMsg] = useState("");
  const [selectedId, setSelectedId] = useState(1);
  const [selectedIndustry, setSelectedIndustry] = useState("总览");
  const [exporting, setExporting] = useState(false);
  const [exportIds, setExportIds] = useState<number[]>([]);
  const [exportQuery, setExportQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [searchKw, setSearchKw] = useState("");
  const [candidates, setCandidates] = useState<{ code: string; name: string; market: 'SH' | 'SZ' }[]>([]);
  const [rankingIndustry, setRankingIndustry] = useState("总览");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const selected =
    stocks.find((stock) => stock.stockId === selectedId) ?? stocks[0];
  const holdings = visibleHoldings(stocks);
  const summary = useMemo(() => buildPortfolio(holdings, 0.92), [holdings]);
  const MONTHLY_GOAL = 5000; // 每月现金分红目标(元)
  const monthlyCash = summary.estimatedMonthlyCashCny;
  const goalPct =
    monthlyCash === null ? 0 : Math.min(Math.max(monthlyCash / MONTHLY_GOAL, 0), 1) * 100;
  const industries = [
    "总览",
    ...Array.from(new Set([...industryList, ...stocks.map((stock) => stock.industry)])),
  ];
  const visible =
    page === "holdings"
      ? holdings.filter(
          (stock) =>
            selectedIndustry === "总览" || stock.industry === selectedIndustry,
        )
      : stocks.filter(
          (stock) =>
            selectedIndustry === "总览" || stock.industry === selectedIndustry,
        );
  const rankedStocks = rankDividendStocks(stocks, {
    industry: rankingIndustry,
    minPrice: minPrice === "" ? null : Number(minPrice),
    maxPrice: maxPrice === "" ? null : Number(maxPrice),
  });
  const update = (id: number, change: Partial<WatchStock>) =>
    setStocks((items) =>
      items.map((stock) =>
        stock.stockId === id ? { ...stock, ...change } : stock,
      ),
    );
  const addWatchStock = async () => {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    const industry = newIndustry.trim();
    if (!code || !name || !industry || stocks.some((stock) => stock.code === code)) return;
    const stock: WatchStock = {
      stockId: Math.max(0, ...stocks.map((item) => item.stockId)) + 1,
      code, name, industry, shares: 0, price: null,
      currency: code.length === 5 ? "HKD" : "CNY", dividendYield: null,
      roe: null, pe: null, pb: null, note: "", ...EMPTY_METRICS,
    };
    setStocks((items) => [...items, stock]);
    setSelectedId(stock.stockId);
    setNewCode(""); setNewName(""); setNewIndustry("");
    // 新添加的 A 股自动刷新，立即填充指标数据（避免显示不全的占位）
    const api = window.stockIncome;
    if (api && stock.currency === "CNY") {
      setRefreshing(true);
      // 稍作延迟，避开添加动作瞬间的多接口并发高峰（降低被东财限流的概率）
      await new Promise((r) => setTimeout(r, 600));
      try {
        const quote = await api.getQuote(stock.code);
        if (quote?.fields) {
          const patch: Partial<WatchStock> = {};
          for (const fname of metricFields) {
            const v = quote.fields[fname as keyof typeof quote.fields]?.value;
            if (typeof v === "number") (patch as Record<string, number>)[fname] = v;
          }
          if (Object.keys(patch).length > 0) {
            setStocks((items) =>
              items.map((s) => (s.stockId === stock.stockId ? { ...s, ...patch } : s)),
            );
            setUpdatedAt(new Date().toLocaleString("zh-CN"));
          }
        }
      } catch { /* 单只失败不阻塞添加 */ }
      setRefreshing(false);
    }
  };
  const deleteSelected = () => {
    if (!selected || stocks.length < 2) return;
    const next = stocks.find((stock) => stock.stockId !== selected.stockId);
    setStocks((items) => items.filter((stock) => stock.stockId !== selected.stockId));
    if (next) setSelectedId(next.stockId);
  };
  const refresh = async () => {
    setRefreshing(true);
    const api = window.stockIncome;
    if (api) {
      // 只刷新 A 股（港股不入场接口）
      const list = stocks.filter((stock) => stock.currency === "CNY");
      setProgress({ done: 0, total: list.length });
      setRefreshResult(null);
      // 分批并发：每批 BATCH 只，避免瞬时并发过大触发东财/同花顺限流、卡在最慢一只
      const BATCH = 3;
      const byId = new Map<string, Partial<WatchStock>>();
      const failed: { name: string; reason: string }[] = [];
      for (let i = 0; i < list.length; i += BATCH) {
        const batch = list.slice(i, i + BATCH);
        const settled = await Promise.allSettled(
          batch.map(async (stock) => {
            try {
              const quote = await api.getQuote(stock.code);
              if (!quote || !quote.fields) {
                return { id: stock.stockId, name: stock.name, patch: null as Partial<WatchStock> | null };
              }
              const patch: Partial<WatchStock> = {};
              for (const name of metricFields) {
                const v = quote.fields[name as keyof typeof quote.fields]?.value;
                if (typeof v === "number") (patch as Record<string, number>)[name] = v;
              }
              return { id: stock.stockId, name: stock.name, patch };
            } catch (e) {
              return { id: stock.stockId, name: stock.name, patch: null as Partial<WatchStock> | null };
            }
          }),
        );
        for (const r of settled) {
          if (r.status === "fulfilled" && r.value.patch && Object.keys(r.value.patch).length > 0) {
            byId.set(String(r.value.id), r.value.patch);
          } else {
            const name = r.status === "fulfilled" ? r.value.name : "未知股票";
            failed.push({ name, reason: r.status === "rejected" ? "接口异常" : "无可用数据" });
          }
        }
        setProgress({ done: Math.min(i + BATCH, list.length), total: list.length });
      }
      setStocks((items) =>
        items.map((stock) =>
          byId.has(String(stock.stockId)) ? { ...stock, ...byId.get(String(stock.stockId)) } : stock,
        ),
      );
      if (failed.length > 0) {
        setRefreshResult(
          `本次 ${failed.length} 只未成功刷新（${failed.map((x) => x.name).join("、")}），其余已更新。可稍后重试。`,
        );
      }
    }
    setUpdatedAt(new Date().toLocaleString("zh-CN"));
    setRefreshing(false);
  };
  useEffect(() => {
    const api = window.stockIncome;
    if (api) {
      void api.loadStocks().then((fileData) => {
        if (Array.isArray(fileData) && fileData.length > 0) {
          const norm = normalizeStocks(fileData);
          setStocks(norm);
          saveStocks(norm);
        } else {
          const local = loadStocks();
          if (local.length > 0) void api.saveStocks(local);
        }
      });
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    const kw = searchKw.trim();
    const api = window.stockIncome;
    if (!kw || !api) { setCandidates([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.searchStock(kw);
        setCandidates(res);
      } catch { setCandidates([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [searchKw]);
  const pickCandidate = (c: { code: string; name: string }) => {
    setNewCode(c.code);
    setNewName(c.name);
    setSearchKw("");
    setCandidates([]);
  };
  const addIndustry = () => {
    const name = newIndustryName.trim();
    if (!name) return;
    if (industryList.includes(name)) {
      setIndustryMsg("行业「" + name + "」已存在");
    } else {
      setIndustryList((prev) => [...prev, name]);
      setIndustryMsg("已添加行业「" + name + "」");
    }
    setNewIndustryName("");
  };
  const deleteIndustry = (name: string) => {
    const count = stocks.filter((s) => s.industry === name).length;
    const msg = count > 0
      ? `行业「${name}」下有 ${count} 只股票，删除该行业将同时删除这些股票。确定删除？`
      : `确定删除行业「${name}」？`;
    if (!window.confirm(msg)) return;
    setIndustryList((prev) => prev.filter((x) => x !== name));
    setStocks((prev) => prev.filter((s) => s.industry !== name));
    if (selectedIndustry === name) setSelectedIndustry("总览");
  };
  useEffect(() => {
    const api = window.stockIncome;
    const doSave = () => {
      saveStocks(stocks);
      if (api) void api.saveStocks(stocks);
    };
    if (saveRef.current) window.clearTimeout(saveRef.current);
    saveRef.current = window.setTimeout(doSave, 400);
  }, [stocks]);
  useEffect(() => {
    saveIndustries(industryList);
  }, [industryList]);

  return (
    <main className="app-shell" aria-label={appTitle}>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><img src={appIcon} alt="" /></span><div><strong>{appTitle}</strong><small>v4.4.0</small></div></div>
      <nav aria-label="主要页面">
        <button
          className={page === "holdings" ? "active" : ""}
          aria-current={page === "holdings" ? "page" : undefined}
          onClick={() => setPage("holdings")}
        >
          <UiIcon kind="pie" />当前持仓
        </button>
        <button
          className={page === "research" ? "active" : ""}
          aria-current={page === "research" ? "page" : undefined}
          onClick={() => setPage("research")}
        >
          <UiIcon kind="search" />股票观察 / 股票研究
        </button>
        <button
          className={page === "ranking" ? "active" : ""}
          aria-current={page === "ranking" ? "page" : undefined}
          onClick={() => setPage("ranking")}
        >
          <UiIcon kind="bars" />股息率排行
        </button>
      </nav>
        <img className="sidebar-bag" src={sidebarBag} alt="" aria-hidden="true" />
      </aside>
      <div className="workspace">
      <header className="page-header">
        <div>
          <h1>{page === "holdings" ? "当前持仓" : page === "research" ? "股票观察 / 股票研究" : "股息率排行"}</h1>
          <span className="subtitle">
            长期研究 · 资产配置 · 现金流
            {updatedAt ? ` · 最近更新 ${updatedAt}` : " · 数据可能过期"}
          </span>
        </div>
        <div className="header-actions">
          <button onClick={() => setExporting(true)}><UiIcon kind="export" />导出 Excel</button>
          <button className="refresh" onClick={refresh} disabled={refreshing}>
            {refreshing
              ? progress && progress.total > 0
                ? `全部刷新 ${progress.done}/${progress.total}`
                : "正在刷新…"
              : "全部刷新"}
          </button>
        </div>
      </header>
      {refreshing && progress && progress.total > 0 && (
        <div className="refresh-track">
          <div
            style={{
              height: "100%",
              width: "100%",
              transform: `scaleX(${progress.done / progress.total})`,
              transformOrigin: "left",
              background: "var(--blue)",
              transition: "transform 0.2s ease-out",
            }}
          />
        </div>
      )}
      {refreshResult && (
        <div className="refresh-message" role="status">
          {refreshResult}
        </div>
      )}
      {page === "research" && (<div className="industry-tabs">
        {industries.map((item) => (
          <button
            key={item}
            className={selectedIndustry === item ? "selected" : ""}
            aria-pressed={selectedIndustry === item}
            onClick={() => setSelectedIndustry(item)}
          >
            {item}
          </button>
        ))}
      </div>)}
      {page === "holdings" ? (
        <section className="holdings-layout">
          <section className="cash-overview" aria-label="分红现金流与目标进度">
            <div className="cash-summary">
              <span className="cash-label">估计每月现金</span>
              <strong className={monthlyCash === null ? "cash-amount no-cash" : "cash-amount"}>{monthlyCash === null ? "暂无数据" : money(monthlyCash)}</strong>
              <div className="cash-facts">
                <Metric label="估计每年现金分红" value={summary.estimatedAnnualCashCny === null ? "暂无数据" : money(summary.estimatedAnnualCashCny)} />
                <Metric label="总市值" value={money(summary.totalMarketValueCny)} />
                <Metric label="估计股息率" value={percent(summary.weightedDividendYield)} />
              </div>
              <p className="hint">估计每月现金 = 总市值 × 估计股息率 ÷ 12（税前）</p>
            </div>
            <div className="cash-goal">
              <img className="goal-bag" src={goalBag} alt="" aria-hidden="true" />
              <strong className="cash-label">每月现金分红目标</strong>
              <div className="goal-amount">{money(MONTHLY_GOAL)} <small>/ 月</small></div>
              <div className="cash-goal-track" role="progressbar" aria-label="每月分红目标进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={monthlyCash === null ? undefined : goalPct}>
                <div style={{ transform: `scaleX(${monthlyCash === null ? 0 : goalPct / 100})` }} />
              </div>
              {monthlyCash === null ? <p className="hint">暂无分红数据，请先在“股票观察”页刷新并填写持仓股数。</p> :
                <div className="goal-status">
                  <div><span>已达成</span><b>{goalPct.toFixed(0)}%</b></div>
                  <div><span>{monthlyCash >= MONTHLY_GOAL ? "超额" : "还差"}</span><b>{money(Math.abs(MONTHLY_GOAL - monthlyCash))}</b></div>
                </div>}
            </div>
          </section>
          <div className="allocation-charts">
            <Chart title="板块市值占比" items={holdings} />
            <Chart
              title={
                selectedIndustry === "总览"
                  ? "所选板块内部占比"
                  : `所选板块内部占比（${selectedIndustry}）`
              }
              items={
                selectedIndustry === "总览"
                  ? holdings
                  : holdings.filter(
                      (item) => item.industry === selectedIndustry,
                    )
              }
            />
          </div>
          <section className="table-panel">
            <div className="holdings-heading"><h2>持仓明细</h2>      <div className="industry-tabs">
        {industries.map((item) => (
          <button
            key={item}
            className={selectedIndustry === item ? "selected" : ""}
            aria-pressed={selectedIndustry === item}
            onClick={() => setSelectedIndustry(item)}
          >
            {item}
          </button>
        ))}
      </div>
            </div>
            {visible.length === 0 ? (
              <div className="empty">
                当前没有持仓。请前往“股票观察”页，选择股票并输入持有股数。
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>代码 / 名称</th>
                    <th>持有股数</th>
                    <th>当前股价</th>
                    <th>市值</th>
                    <th>预估股息率</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((stock) => (
                    <tr key={stock.stockId}>
                      <td>
                        <b>{stock.code}</b>
                        <br />
                        {stock.name}
                      </td>
                      <td>
                        <input
                          aria-label={`${stock.name}持有股数`}
                          type="number"
                          min="0"
                          step="100"
                          value={stock.shares}
                          onChange={(e) =>
                            update(stock.stockId, {
                              shares: normalizeSharesToLots(
                                Number(e.target.value) || 0,
                              ),
                            })
                          }
                        />
                        股
                      </td>
                      <td>
                        {stock.currency === "HKD" ? "HK$" : "¥"}
                        {stock.price}
                      </td>
                      <td>
                        {stock.price === null
                          ? "暂无数据"
                          : money(
                              stock.price *
                                stock.shares *
                                (stock.currency === "HKD" ? 0.92 : 1),
                            )}
                      </td>
                      <td>{percent(stock.dividendYield)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <footer>
              市值合计 <b>{money(summary.totalMarketValueCny)}</b>
            </footer>
          </section>
        </section>
      ) : page === "research" ? (
        <section className="research-layout">
          <aside className="watch-list">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>股票列表</h2>
              <button className="refresh" onClick={() => setManageOpen(true)}>管理行业</button>
            </div>
            <div className="watch-actions">
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  aria-label="搜索股票"
                  value={searchKw}
                  onChange={(e) => setSearchKw(e.target.value)}
                  placeholder="输入代码或名称搜索，自动填入代码/名称"
                />
                {candidates.length > 0 && (
                  <ul
                    style={{
                      position: "absolute",
                      zIndex: 30,
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #dfe3e8",
                      borderRadius: 6,
                      boxShadow: "0 4px 14px rgba(0,0,0,.12)",
                      maxHeight: 200,
                      overflow: "auto",
                      margin: "4px 0 0",
                      padding: "4px 0",
                      listStyle: "none",
                    }}
                  >
                    {candidates.map((c) => (
                      <li
                        key={c.code}
                        onClick={() => pickCandidate(c)}
                        style={{
                          padding: "6px 10px",
                          cursor: "pointer",
                          fontSize: 13,
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{c.code} {c.name}</span>
                        <span style={{ color: "#999" }}>{c.market === "SH" ? "沪A" : "深A"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <input aria-label="新增股票代码" value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="代码" />
              <input aria-label="新增股票名称" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="名称" />
              <select
                aria-label="新增股票行业"
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                style={{ padding: "6px 10px", border: "1px solid #dfe3e8", borderRadius: 6 }}
              >
                <option value="">选择行业</option>
                {industryList.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
              <button className="refresh" onClick={addWatchStock}>添加观察股票</button>
            </div>
            {visible.map((stock) => (
              <button
                key={stock.stockId}
                className={
                  selectedId === stock.stockId ? "stock active-stock" : "stock"
                }
                onClick={() => setSelectedId(stock.stockId)}
              >
                <b>{stock.code}</b>
                <span>{stock.name}</span>
              </button>
            ))}
          </aside>
          <section className="details">
            <div className="stock-title">
              <div>
                <h1>
                  {selected.code} / {selected.name}
                </h1>
                <span>
                  {selected.industry} ·{" "}
                  {selected.currency === "HKD" ? "港股" : "A 股"}
                </span>
              </div>
              <button
                onClick={() => {
                  update(selected.stockId, { shares: selected.shares || 100 });
                  setHoldingNotice({ message: `${selected.name}已加入持仓` });
                }}
              >
                加入持仓
              </button>
              <button className="danger" onClick={deleteSelected} disabled={stocks.length < 2}>
                删除观察股票
              </button>
            </div>
            <section className="metric-groups">
              <div className="metric-group">
                <h3>股价与分红</h3>
                <h4 className="metric-row-title">股价区间</h4>
                <div className="metric-row metric-row-three">
                  <Metric label="当前股价(不复权)" value={formatPrice(selected.currentPrice ?? selected.price)} />
                  <Metric label="52周最高(不复权)" value={formatPriceWithDev(selected.high52w, selected.high52wPct)} />
                  <Metric label="52周最低(不复权)" value={formatPriceWithDev(selected.low52w, selected.low52wPct)} />
                </div>
                <h4 className="metric-row-title">分红水平与历史位置</h4>
                <div className="metric-row metric-row-four">
                  <Metric label="股息率" value={formatPercent(selected.dividendYield)} />
                  <Metric label="股息率历史百分位(8年)" value={formatPercentile(selected.dividendYieldPercentile8y)} />
                  <Metric label="股利支付率" value={formatPercent(selected.payoutRatio)} />
                  <Metric label="股利支付率历史百分位(15年)" value={formatPercentile(selected.payoutRatioPercentile15y)} />
                </div>
                <h4 className="metric-row-title">估值水平与历史位置</h4>
                <div className="metric-row metric-row-four">
                  <Metric label="PE(TTM)" value={formatMulti(selected.pe)} />
                  <Metric label="PE历史百分位" value={formatPercentile(selected.pePercentile)} />
                  <Metric label="PB" value={formatMulti(selected.pb)} />
                  <Metric label="PB历史百分位" value={formatPercentile(selected.pbPercentile)} />
                </div>
                <h4 className="metric-row-title">成长与其他估值</h4>
                <div className="metric-row metric-row-three">
                  <Metric
                    label="PEG"
                    value={
                      selected.peg !== null && selected.forecastG !== null
                        ? formatMulti(selected.peg)
                        : formatMulti(selected.peg)
                    }
                  />
                  {selected.forecastSampleN !== null && selected.forecastG !== null && (
                    <Metric
                      label="机构样本与预测G(复合)"
                      value={`${selected.forecastSampleN}家 / ${formatPercent(selected.forecastG)}`}
                    />
                  )}
                  <Metric label="PS(TTM)" value={formatMulti(selected.ps)} />
                </div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <a
                    href={`https://quote.eastmoney.com/${selected.code.startsWith("6") ? "sh" : "sz"}${selected.code}.html`}
                    target="_blank"
                    rel="noreferrer"
                    className="source-link"
                  >
                    查看该股行情（东方财富）↗
                  </a>
                </div>
              </div>
              <div className="metric-group">
                <h3>财报信息 <span className="hint-inline">最新报告期口径</span></h3>
                <h4 className="metric-row-title">营收与利润率</h4>
                <div className="metric-row metric-row-three">
                  <Metric
                    label="主营收入"
                    value={
                      selected.forecastRevenue == null
                        ? formatYuan(selected.revenue)
                        : `${formatYi(selected.revenue)}（${formatYi(selected.forecastRevenue)}）`
                    }
                  />
                  <Metric label="毛利率" value={formatPercent(selected.grossMargin)} />
                  <Metric label="营业利润率" value={formatPercent(selected.operatingMargin)} />
                </div>
                <h4 className="metric-row-title">现金流</h4>
                <div className="metric-row metric-row-three">
                  <Metric label="CFO 经营现金流" value={formatYuan(selected.cfo)} />
                  <Metric label="FCF 自由现金流" value={formatYuan(selected.fcf)} />
                  <Metric label="CFO/扣非净利" value={formatMulti(selected.cfoToDeductProfit)} />
                </div>
                <h4 className="metric-row-title">资本回报</h4>
                <div className="metric-row metric-row-two">
                  <Metric label="ROE" value={formatPercent(selected.roe)} />
                  <Metric label="ROIC" value={formatPercent(selected.roic)} />
                </div>
                <h4 className="metric-row-title">负债水平</h4>
                <div className="metric-row metric-row-two">
                  <Metric label="净负债" value={formatYuan(selected.netDebt)} />
                  <Metric label="资产负债率" value={formatPercent(selected.debtRatio)} />
                </div>
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <a
                    href={`https://emweb.securities.eastmoney.com/PC_HSF10/NewFinanceAnalysis/Index?type=web&code=${
                      selected.code.startsWith("6") || selected.code.startsWith("9") ? "SH" : "SZ"
                    }${selected.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="source-link"
                  >
                    查看该股财报（东方财富 F10）↗
                  </a>
                </div>
              </div>
              <div className="metric-group">
                <h3>股东与营运资金</h3>
                <h4 className="metric-row-title">股东结构与质押</h4>
                <div className="metric-row metric-row-two">
                  <Metric label="前十大股东占比" value={formatPercent(selected.top10HoldersPct)} />
                  <Metric label="股权质押率" value={formatPercent(selected.pledgeRatio)} />
                </div>
                <h4 className="metric-row-title">营运资金往来</h4>
                <div className="metric-row metric-row-two">
                  <Metric label="应付账款" value={formatYuan(selected.accountsPayable)} />
                  <Metric label="预付账款" value={formatYuan(selected.prepayment)} />
                </div>
              </div>
              <Metric label="更新时间" value="刷新后更新" />
            </section>
            <label className="note">
              记录信息 <span>自动保存</span>
              <textarea
                value={selected.note}
                onChange={(e) =>
                  update(selected.stockId, { note: e.target.value })
                }
                placeholder="记录公司资料、研究想法、风险、买入逻辑等…"
              />
            </label>
          </section>
        </section>
      ) : (
        <section className="ranking-panel">
          <div className="ranking-heading">
            <div><h1>股息率排行</h1><p>按东方财富股息率口径排序，最多展示前十只股票。</p></div>
            <span>共 {rankedStocks.length} 只符合条件</span>
          </div>
          <div className="ranking-filters">
            <label>所属板块<select value={rankingIndustry} onChange={(e) => setRankingIndustry(e.target.value)}>{industries.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>最低价格<input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="不限" /></label>
            <label>最高价格<input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="不限" /></label>
          </div>
          {rankedStocks.length === 0 ? <div className="empty">暂无符合条件且已刷新股息率的数据。</div> : <table className="ranking-table"><thead><tr><th>排名</th><th>代码</th><th>名称</th><th>板块</th><th>当前股价</th><th>股息率</th></tr></thead><tbody>{rankedStocks.map((stock, index) => <tr key={stock.stockId}><td><b>{index + 1}</b></td><td>{stock.code}</td><td>{stock.name}</td><td>{stock.industry}</td><td>{stock.currency === "HKD" ? "HK$" : "¥"}{stock.price}</td><td><b>{percent(stock.dividendYield)}</b></td></tr>)}</tbody></table>}
        </section>
      )}
      {holdingNotice && (
        <div className="holding-notice" role="status" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg>
          <span>{holdingNotice.message}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setHoldingNotice(null)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
        </div>
      )}
      {exporting && (
        <div className="modal">
          <section role="dialog" aria-label="导出数据快照">
            <h2>导出数据快照</h2>
            <input
              aria-label="查询股票"
              value={exportQuery}
              onChange={(e) => setExportQuery(e.target.value)}
              placeholder="查询代码或名称"
            />
            <div className="export-actions">
              <button
                onClick={() =>
                  setExportIds(stocks.map((stock) => stock.stockId))
                }
              >
                全选
              </button>
              <button onClick={() => setExportIds([])}>取消全选</button>
            </div>
            {stocks
              .filter((stock) =>
                `${stock.code}${stock.name}`.includes(exportQuery.trim()),
              )
              .map((stock) => (
                <label className="check" key={stock.stockId}>
                  <input
                    type="checkbox"
                    checked={exportIds.includes(stock.stockId)}
                    onChange={() =>
                      setExportIds((ids) =>
                        ids.includes(stock.stockId)
                          ? ids.filter((id) => id !== stock.stockId)
                          : [...ids, stock.stockId],
                      )
                    }
                  />
                  {stock.code}　{stock.name}
                </label>
              ))}
            <div className="dialog-buttons">
              <button onClick={() => setExporting(false)}>取消</button>
              <button
                className="refresh"
                disabled={exportIds.length === 0}
                onClick={() => {
                  downloadWorkbook(
                    stocks.filter((stock) => exportIds.includes(stock.stockId)),
                  );
                  setExporting(false);
                }}
              >
                导出
              </button>
            </div>
          </section>
        </div>
      )}
      {manageOpen && (
        <div
          className="modal"
          onClick={() => setManageOpen(false)}
        >
          <div
            className="industry-dialog" role="dialog" aria-label="管理行业"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>管理行业</h3>
            <div>
              {industries.filter((x) => x !== "总览").map((name) => (
                <div
                  key={name}
                  className="industry-row"
                >
                  <span>{name}（{stocks.filter((s) => s.industry === name).length} 只）</span>
                  <button
                    onClick={() => deleteIndustry(name)}
                  >
                    删除
                  </button>
                </div>
              ))}
              {industries.length <= 1 && <div style={{ color: "#999", padding: "8px 0" }}>暂无行业</div>}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); addIndustry(); }}
              className="industry-form"
            >
              <input
                autoFocus
                aria-label="新行业名称"
                value={newIndustryName}
                onChange={(e) => setNewIndustryName(e.target.value)}
                placeholder="输入新行业名称（回车或点添加）"
              />
              <button className="refresh" type="submit">添加行业</button>
            </form>
            {industryMsg && (
              <div style={{ color: industryMsg.indexOf("已添加") === 0 ? "#2f8f4e" : "#c0392b", marginTop: 6, fontSize: 13 }}>
                {industryMsg}
              </div>
            )}
            <div className="industry-footer">
              <button onClick={() => setManageOpen(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <b className={value === "暂无数据" || value === "刷新后更新" ? "missing-value" : undefined}>{value}</b>
    </div>
  );
}
const pieColors = [
  "#2563eb",
  "#14b8a6",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#0ea5e9",
  "#84cc16",
  "#ec4899",
];
function Chart({ title, items }: { title: string; items: WatchStock[] }) {
  const byIndustry = title === "板块市值占比";
  const map = new Map<string, number>();
  items.forEach((item) => {
    const name = byIndustry ? item.industry : item.name;
    const value =
      (item.price ?? 0) * item.shares * (item.currency === "HKD" ? 0.92 : 1);
    map.set(name, (map.get(name) ?? 0) + value);
  });
  let data = [...map.entries()]
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
  const waitingPrice = data.length === 0 && items.length > 0;
  if (waitingPrice) {
    const fallback = new Map<string, number>();
    items.forEach((item) => {
      const name = byIndustry ? item.industry : item.name;
      fallback.set(name, (fallback.get(name) ?? 0) + item.shares);
    });
    data = [...fallback.entries()]
      .filter(([, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = data
    .map((item, index) => {
      const start = (cursor / total) * 100;
      cursor += item.value;
      const end = (cursor / total) * 100;
      return `${pieColors[index % pieColors.length]} ${start}% ${end}%`;
    })
    .join(", ");
  return (
    <section className="chart">
      <h3>{title}</h3>
      {data.length === 0 ? (
        <p>暂无持仓数据</p>
      ) : (
        <>
          <div className="chart-body">
          <div
            className="native-donut"
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <span>{waitingPrice ? "等待股价" : money(total)}</span>
          </div>
          <div className="pie-legend">
            {data.map((item, index) => (
              <span key={item.name}>
                <i
                  style={{ background: pieColors[index % pieColors.length] }}
                />
                {item.name} {((item.value / total) * 100).toFixed(1)}%
              </span>
            ))}
          </div>
          </div>
          {waitingPrice && (
            <p className="hint">
              行情价格暂缺，图形暂按持有股数展示；刷新后自动改为市值占比。
            </p>
          )}
        </>
      )}
    </section>
  );
}

function UiIcon({ kind }: { kind: "pie" | "search" | "bars" | "export" | "refresh" }) {
  return <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "pie" ? <><path d="M11 3a9 9 0 1 0 10 10H11Z" /><path d="M15 2v7h7a8 8 0 0 0-7-7Z" /></> : kind === "search" ? <><circle cx="10.5" cy="10.5" r="7" /><path d="m16 16 5 5" /></> : kind === "bars" ? <><path d="M4 21v-7h3v7M10.5 21V8h3v13M17 21V3h3v18" /></> : kind === "export" ? <><path d="M14 3H5v18h14V8Z M14 3v5h5 M8 12h8 M8 16h6" /></> : <><path d="M20 7V3l-3 3a8 8 0 1 0 3 10 M20 7h-5" /></>}
  </svg>;
}
