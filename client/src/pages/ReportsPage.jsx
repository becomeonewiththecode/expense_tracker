import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import api from "../api";
import ProjectionModal from "../components/ProjectionModal.jsx";
import {
  computeIncomeProjection,
  computeProjectionPieData,
  computeSpendingProjection,
} from "../projection.js";
import { CATEGORY_OPTIONS } from "../expenseOptions.js";

const tabs = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "custom", label: "Custom range" },
];

/** Short copy for the Total card: how this number is defined for each report tab. */
const TOTAL_HELP = {
  daily:
    "This total is the sum of every saved expense whose transaction date is the day you selected. Each bar is that same day (one bar).",
  weekly:
    "This total is all spending in the current calendar week (Mon–Sun, UTC). Each bar is one day; the number is the sum of those days.",
  monthly:
    "This total is every saved expense in the calendar month you chose (first through last day of that month). Each bar is one day in that month.",
  yearly:
    "This total is every saved expense in the calendar year you chose. Each bar is one month’s total; the number is spending for the full year.",
  custom:
    "This total is every saved expense whose transaction date falls between your start and end dates, inclusive. Each bar is one day in that range.",
};

const TOTAL_HELP_FOOTNOTE =
  "It uses the amounts you actually recorded. Weekly/monthly frequency on an expense is not used here—that metadata is for labels and projection elsewhere.";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function padMonth(m) {
  return String(m).padStart(2, "0");
}

function daysInCalendarMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** One row per calendar day for cumulative vs budget pace overlays. */
function buildMonthlyChartSeries(year, month, series, budgetTotal, dim) {
  const byLabel = new Map((series || []).map((p) => [p.label, p.total]));
  let cum = 0;
  const out = [];
  for (let d = 1; d <= dim; d++) {
    const label = `${year}-${padMonth(month)}-${String(d).padStart(2, "0")}`;
    const dayTot = byLabel.get(label) ?? 0;
    cum += dayTot;
    const budgetPace =
      budgetTotal != null && dim > 0 ? (budgetTotal * d) / dim : null;
    out.push({
      name: String(d),
      full: label,
      total: dayTot,
      cumulative: cum,
      budgetPace,
    });
  }
  return out;
}

export default function ReportsPage() {
  const [tab, setTab] = useState("daily");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const now = new Date();
  const [dailyDate, setDailyDate] = useState(todayISODate());
  const [monthYear, setMonthYear] = useState(now.getFullYear());
  const [monthNum, setMonthNum] = useState(now.getMonth() + 1);
  const [yearNum, setYearNum] = useState(now.getFullYear());
  const [rangeStart, setRangeStart] = useState(
    `${now.getFullYear()}-${padMonth(now.getMonth() + 1)}-01`
  );
  const [rangeEnd, setRangeEnd] = useState(todayISODate());
  const [summaries, setSummaries] = useState([]);
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [projectionItems, setProjectionItems] = useState([]);
  const [incomeItems, setIncomeItems] = useState([]);

  const [budgetInfo, setBudgetInfo] = useState(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);
  /** @type {{ totalAmount: string, totalAlertThresholdPercent: string, lines: { category: string, amount: string, alertThresholdPercent: string }[] }} */
  const [budgetDraft, setBudgetDraft] = useState({
    totalAmount: "",
    totalAlertThresholdPercent: "",
    lines: [],
  });

  const [cashflow, setCashflow] = useState(null);

  const incomeProj = useMemo(() => computeIncomeProjection(incomeItems), [incomeItems]);

  useEffect(() => {
    api
      .get("/reports/summaries")
      .then((r) => setSummaries(r.data))
      .catch(() => setSummaries([]));
  }, []);

  useEffect(() => {
    if (tab !== "monthly") {
      setBudgetInfo(null);
      setBudgetError("");
      return;
    }
    let cancelled = false;
    setBudgetLoading(true);
    setBudgetError("");
    setBudgetDraft({ totalAmount: "", totalAlertThresholdPercent: "", lines: [] });
    api
      .get(`/budgets/${monthYear}/${monthNum}`)
      .then((r) => {
        if (cancelled) return;
        setBudgetInfo(r.data);
        const b = r.data.budget;
        if (b) {
          setBudgetDraft({
            totalAmount: String(b.totalAmount),
            totalAlertThresholdPercent:
              b.totalAlertThresholdPercent != null ? String(b.totalAlertThresholdPercent) : "",
            lines:
              b.lines?.length > 0
                ? b.lines.map((l) => ({
                    category: l.category,
                    amount: String(l.amount),
                    alertThresholdPercent:
                      l.alertThresholdPercent != null ? String(l.alertThresholdPercent) : "",
                  }))
                : [],
          });
        } else {
          setBudgetDraft({ totalAmount: "", totalAlertThresholdPercent: "", lines: [] });
        }
      })
      .catch((e) => {
        if (!cancelled) setBudgetError(e.response?.data?.error || "Could not load budget");
      })
      .finally(() => {
        if (!cancelled) setBudgetLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, monthYear, monthNum]);

  useEffect(() => {
    if (tab !== "monthly") {
      setCashflow(null);
      return;
    }
    let cancelled = false;
    api
      .get("/reports/cashflow/monthly", { params: { year: monthYear, month: monthNum } })
      .then((r) => {
        if (!cancelled) setCashflow(r.data);
      })
      .catch(() => {
        if (!cancelled) setCashflow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, monthYear, monthNum]);

  const openProjectionModal = useCallback(async () => {
    try {
      const [expR, incR] = await Promise.all([
        api.get("/expenses", { params: { limit: 500 } }),
        api.get("/income", { params: { limit: 500 } }),
      ]);
      setProjectionItems(expR.data || []);
      setIncomeItems(incR.data || []);
    } catch {
      setProjectionItems([]);
      setIncomeItems([]);
    }
    setProjectionOpen(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError("");
      try {
        let res;
        if (tab === "daily") {
          res = await api.get("/reports/daily", { params: { date: dailyDate } });
        } else if (tab === "weekly") {
          res = await api.get("/reports/weekly");
        } else if (tab === "monthly") {
          res = await api.get("/reports/monthly", {
            params: { year: monthYear, month: monthNum },
          });
        } else if (tab === "yearly") {
          res = await api.get("/reports/yearly", { params: { year: yearNum } });
        } else {
          res = await api.get("/reports/range", { params: { start: rangeStart, end: rangeEnd } });
        }
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || "Could not load report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [tab, dailyDate, monthYear, monthNum, yearNum, rangeStart, rangeEnd]);

  const isMonthlyReport = tab === "monthly" && data?.period === "monthly";

  const chartData = useMemo(() => {
    if (isMonthlyReport && data?.year != null && data?.month != null) {
      const dim =
        budgetInfo?.daysInMonth ?? daysInCalendarMonth(data.year, data.month);
      const budgetTotal = budgetInfo?.budget?.totalAmount ?? null;
      return buildMonthlyChartSeries(
        data.year,
        data.month,
        data.series,
        budgetTotal,
        dim
      );
    }
    return (
      data?.series?.map((p) => ({
        name: p.label?.slice(5) ?? p.label,
        full: p.label,
        total: p.total,
      })) ?? []
    );
  }, [isMonthlyReport, data, budgetInfo]);

  const saveBudget = useCallback(async () => {
    const total = Number(budgetDraft.totalAmount);
    if (!Number.isFinite(total) || total < 0) {
      setBudgetError("Enter a valid monthly budget total (0 or greater).");
      return;
    }
    const taRaw = String(budgetDraft.totalAlertThresholdPercent ?? "").trim();
    let totalAlertThresholdPercent = null;
    if (taRaw !== "") {
      const n = Number(taRaw);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        setBudgetError("Total budget alert must be empty or a whole percent from 1 to 100.");
        return;
      }
      totalAlertThresholdPercent = n;
    }
    const lines = [];
    for (const l of budgetDraft.lines) {
      if (!l.category || String(l.amount).trim() === "") continue;
      const amt = Number(l.amount);
      if (!Number.isFinite(amt) || amt < 0) {
        setBudgetError("Each category line needs a valid non-negative amount.");
        return;
      }
      const ar = String(l.alertThresholdPercent ?? "").trim();
      let alertThresholdPercent = null;
      if (ar !== "") {
        const n = Number(ar);
        if (!Number.isInteger(n) || n < 1 || n > 100) {
          setBudgetError(`Category alert for ${l.category} must be empty or 1–100.`);
          return;
        }
        alertThresholdPercent = n;
      }
      lines.push({ category: l.category, amount: amt, alertThresholdPercent });
    }
    setBudgetSaving(true);
    setBudgetError("");
    try {
      const r = await api.put(`/budgets/${monthYear}/${monthNum}`, {
        totalAmount: total,
        totalAlertThresholdPercent,
        lines,
      });
      setBudgetInfo(r.data);
      const b = r.data.budget;
      if (b) {
        setBudgetDraft({
          totalAmount: String(b.totalAmount),
          totalAlertThresholdPercent:
            b.totalAlertThresholdPercent != null ? String(b.totalAlertThresholdPercent) : "",
          lines:
            b.lines?.length > 0
              ? b.lines.map((x) => ({
                  category: x.category,
                  amount: String(x.amount),
                  alertThresholdPercent:
                    x.alertThresholdPercent != null ? String(x.alertThresholdPercent) : "",
                }))
              : [],
        });
      }
    } catch (e) {
      setBudgetError(e.response?.data?.error || "Could not save budget");
    } finally {
      setBudgetSaving(false);
    }
  }, [budgetDraft, monthYear, monthNum]);

  const clearBudget = useCallback(async () => {
    if (!window.confirm("Remove the budget for this month?")) return;
    setBudgetSaving(true);
    setBudgetError("");
    try {
      await api.delete(`/budgets/${monthYear}/${monthNum}`);
      const r = await api.get(`/budgets/${monthYear}/${monthNum}`);
      setBudgetInfo(r.data);
      setBudgetDraft({ totalAmount: "", totalAlertThresholdPercent: "", lines: [] });
    } catch (e) {
      setBudgetError(e.response?.data?.error || "Could not remove budget");
    } finally {
      setBudgetSaving(false);
    }
  }, [monthYear, monthNum]);

  const downloadMonthlyCsv = useCallback(async () => {
    try {
      const res = await api.get("/reports/export/monthly.csv", {
        params: { year: monthYear, month: monthNum },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spending-${monthYear}-${padMonth(monthNum)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBudgetError(e.response?.data?.error || "Could not download CSV");
    }
  }, [monthYear, monthNum]);

  const downloadMonthlyPdf = useCallback(async () => {
    try {
      const res = await api.get("/reports/export/monthly.pdf", {
        params: { year: monthYear, month: monthNum },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${monthYear}-${padMonth(monthNum)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBudgetError(e.response?.data?.error || "Could not download PDF");
    }
  }, [monthYear, monthNum]);

  const totalFmt = data?.total != null ? `$${Number(data.total).toFixed(2)}` : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <p className="text-sm text-th-subtle mt-1">Spending trends by period.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-emerald-600 text-white"
                : "bg-th-surface-alt text-th-tertiary hover:bg-th-border-bright",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-th-surface/40 border border-th-border rounded-xl p-4">
        {tab === "daily" && (
          <div>
            <label className="text-xs text-th-muted block mb-1">Date</label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
            />
          </div>
        )}
        {tab === "monthly" && (
          <>
            <div>
              <label className="text-xs text-th-muted block mb-1">Year</label>
              <input
                type="number"
                value={monthYear}
                onChange={(e) => setMonthYear(Number(e.target.value))}
                className="w-28 rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-th-muted block mb-1">Month</label>
              <input
                type="number"
                min="1"
                max="12"
                value={monthNum}
                onChange={(e) => setMonthNum(Number(e.target.value))}
                className="w-24 rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              />
            </div>
          </>
        )}
        {tab === "yearly" && (
          <div>
            <label className="text-xs text-th-muted block mb-1">Year</label>
            <input
              type="number"
              value={yearNum}
              onChange={(e) => setYearNum(Number(e.target.value))}
              className="w-28 rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
            />
          </div>
        )}
        {tab === "custom" && (
          <>
            <div>
              <label className="text-xs text-th-muted block mb-1">Start</label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-th-muted block mb-1">End</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              />
            </div>
          </>
        )}
      </div>

      {tab === "monthly" && cashflow && (
        <div className="rounded-xl border border-sky-900/40 bg-sky-950/15 p-4 space-y-2">
          <p className="text-sm font-medium text-white">Cash flow (this month)</p>
          <p className="text-xs text-th-muted">
            Totals for {cashflow.start} through {cashflow.end}. Log income on the{" "}
            <Link to="/income" className="text-sky-400 hover:underline">
              Income
            </Link>{" "}
            page.
          </p>
          <ul className="text-sm space-y-1.5 text-th-tertiary max-w-md pt-1">
            <li className="flex justify-between gap-4">
              <span>Spending (expenses)</span>
              <span className="tabular-nums text-white">${Number(cashflow.spending).toFixed(2)}</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Income (logged)</span>
              <span className="tabular-nums text-emerald-200/90">${Number(cashflow.income).toFixed(2)}</span>
            </li>
            <li className="flex justify-between gap-4 font-medium border-t border-th-border/60 pt-2 mt-1">
              <span className="text-white">Net</span>
              <span
                className={[
                  "tabular-nums",
                  Number(cashflow.net) >= 0 ? "text-emerald-300" : "text-rose-300",
                ].join(" ")}
              >
                ${Number(cashflow.net).toFixed(2)}
              </span>
            </li>
          </ul>
        </div>
      )}

      {tab === "monthly" && (
        <div className="rounded-xl border border-th-border bg-th-surface/25 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white">Monthly budget</p>
              <p className="text-xs text-th-muted mt-0.5">
                Set a cap for this calendar month and optional amounts per category. Optional alert percentages create
                in-app notifications (bell menu) when spending crosses them. The chart shows cumulative spending vs a
                linear &quot;budget pace&quot; line.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void downloadMonthlyCsv()}
                className="rounded-lg border border-th-border-bright px-3 py-1.5 text-sm text-th-secondary hover:bg-th-surface-alt"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={() => void downloadMonthlyPdf()}
                className="rounded-lg border border-th-border-bright px-3 py-1.5 text-sm text-th-secondary hover:bg-th-surface-alt"
              >
                Download PDF
              </button>
              {budgetInfo?.budget && (
                <button
                  type="button"
                  onClick={() => void clearBudget()}
                  disabled={budgetSaving}
                  className="rounded-lg border border-rose-900/60 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50"
                >
                  Clear budget
                </button>
              )}
            </div>
          </div>
          {budgetLoading && <p className="text-sm text-th-muted">Loading budget…</p>}
          {budgetError && (
            <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
              {budgetError}
            </p>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-th-muted block mb-1">Budget total ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={budgetDraft.totalAmount}
                onChange={(e) => setBudgetDraft((d) => ({ ...d, totalAmount: e.target.value }))}
                placeholder="e.g. 3500"
                className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-th-muted block mb-1">Alert at % of total (optional)</label>
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={budgetDraft.totalAlertThresholdPercent}
                onChange={(e) =>
                  setBudgetDraft((d) => ({ ...d, totalAlertThresholdPercent: e.target.value }))
                }
                placeholder="e.g. 80"
                className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              />
              <p className="text-[10px] text-th-muted mt-1">Notifies when month spending reaches this % of budget.</p>
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="button"
                onClick={() => void saveBudget()}
                disabled={budgetSaving}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {budgetSaving ? "Saving…" : "Save budget"}
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-th-muted">Category allocations (optional)</p>
              <button
                type="button"
                onClick={() =>
                  setBudgetDraft((d) => ({
                    ...d,
                    lines: [
                      ...d.lines,
                      { category: "personal", amount: "", alertThresholdPercent: "" },
                    ],
                  }))
                }
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                + Add line
              </button>
            </div>
            {budgetDraft.lines.length === 0 ? (
              <p className="text-xs text-th-muted">None — totals-only budget is fine.</p>
            ) : (
              <ul className="space-y-2">
                {budgetDraft.lines.map((line, idx) => (
                  <li key={idx} className="flex flex-wrap gap-2 items-end">
                    <select
                      value={line.category}
                      onChange={(e) => {
                        const v = e.target.value;
                        setBudgetDraft((d) => {
                          const lines = d.lines.map((x, i) =>
                            i === idx ? { ...x, category: v } : x
                          );
                          return { ...d, lines };
                        });
                      }}
                      className="rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-sm text-white min-w-[10rem]"
                    >
                      {CATEGORY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={line.amount}
                      onChange={(e) => {
                        const v = e.target.value;
                        setBudgetDraft((d) => {
                          const lines = d.lines.map((x, i) =>
                            i === idx ? { ...x, amount: v } : x
                          );
                          return { ...d, lines };
                        });
                      }}
                      className="w-28 rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-sm text-white"
                    />
                    <div>
                      <label className="text-[10px] text-th-muted block mb-0.5">Alert %</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="%"
                        value={line.alertThresholdPercent}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBudgetDraft((d) => {
                            const lines = d.lines.map((x, i) =>
                              i === idx ? { ...x, alertThresholdPercent: v } : x
                            );
                            return { ...d, lines };
                          });
                        }}
                        className="w-16 rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setBudgetDraft((d) => ({
                          ...d,
                          lines: d.lines.filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-xs text-th-muted hover:text-rose-400"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {budgetInfo?.insights?.length > 0 && (
            <div className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-3">
              <p className="text-xs font-medium text-amber-200/90 mb-2">Suggestions</p>
              <ul className="text-sm text-th-tertiary space-y-1 list-disc list-inside">
                {budgetInfo.insights.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-th-border bg-th-surface/30 p-4 min-h-[280px]">
          <p className="text-xs uppercase tracking-wide text-th-muted mb-2">Trend</p>
          <p className="text-xs text-th-muted mb-2">
            Click the chart to open the projection view (daily / monthly / yearly run rates and pie chart from your saved expenses).
          </p>
          {loading ? (
            <p className="text-th-muted py-12 text-center">Loading chart…</p>
          ) : chartData.length === 0 ? (
            <p className="text-th-muted py-12 text-center">No data for this period.</p>
          ) : (
            <div
              className="h-64 w-full cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              onClick={() => void openProjectionModal()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  void openProjectionModal();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Open spending projection and pie chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                {isMonthlyReport ? (
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      width={44}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={52}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: 8,
                      }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                      formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="total"
                      name="Daily spend"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative spend"
                      stroke="#38bdf8"
                      dot={false}
                      strokeWidth={2}
                    />
                    {budgetInfo?.budget ? (
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="budgetPace"
                        name="Budget pace"
                        stroke="#fbbf24"
                        dot={false}
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        connectNulls
                      />
                    ) : null}
                  </ComposedChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid #1e293b",
                        borderRadius: 8,
                      }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
                      formatter={(value) => [`$${Number(value).toFixed(2)}`, "Spent"]}
                    />
                    <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-th-border bg-th-surface/30 p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-th-muted">Total</p>
          <p className="text-3xl font-semibold text-white tabular-nums">{totalFmt}</p>
          <div className="text-xs text-th-muted leading-relaxed space-y-2 pt-1 border-t border-th-border/80">
            <p>{TOTAL_HELP[tab]}</p>
            <p className="text-th-muted">{TOTAL_HELP_FOOTNOTE}</p>
          </div>
          {tab === "monthly" && budgetInfo?.variance?.total && (
            <div className="pt-2 border-t border-th-border/80">
              <p className="text-xs text-th-muted mb-2">Budget vs actual</p>
              <ul className="text-sm space-y-1.5 text-th-tertiary">
                <li className="flex justify-between">
                  <span>Budget</span>
                  <span className="tabular-nums">
                    ${Number(budgetInfo.variance.total.budgeted).toFixed(2)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Spent</span>
                  <span className="tabular-nums">
                    ${Number(budgetInfo.variance.total.actual).toFixed(2)}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span>Remaining</span>
                  <span
                    className={[
                      "tabular-nums",
                      budgetInfo.variance.total.remaining < 0 ? "text-rose-400" : "text-emerald-300/90",
                    ].join(" ")}
                  >
                    ${Number(budgetInfo.variance.total.remaining).toFixed(2)}
                  </span>
                </li>
                <li className="flex justify-between text-xs text-th-muted">
                  <span>Status</span>
                  <span className="uppercase">{budgetInfo.variance.total.status}</span>
                </li>
              </ul>
              {budgetInfo.variance.byCategory?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-th-muted mb-1">By category (allocated)</p>
                  <ul className="text-xs space-y-1 max-h-36 overflow-y-auto">
                    {budgetInfo.variance.byCategory.map((c) => (
                      <li key={c.category} className="flex justify-between gap-2 text-th-tertiary">
                        <span className="truncate">{c.category}</span>
                        <span className="tabular-nums shrink-0">
                          ${Number(c.actual).toFixed(2)} / ${Number(c.budgeted).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {(tab === "daily" || tab === "monthly") && data?.byCategory?.length > 0 && (
            <div>
              <p className="text-xs text-th-muted mb-2">By category</p>
              <ul className="text-sm space-y-1">
                {data.byCategory.map((c) => (
                  <li key={c.category} className="flex justify-between text-th-tertiary">
                    <span>{c.category}</span>
                    <span className="tabular-nums">${Number(c.total).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-th-border bg-th-surface/20 p-4">
        <p className="text-sm font-medium text-white mb-2">Stored monthly summaries</p>
        <p className="text-xs text-th-muted mb-3">
          Generated automatically on the 1st of each month (previous month totals).
        </p>
        {summaries.length === 0 ? (
          <p className="text-sm text-th-muted">None yet — data appears after the scheduled job runs.</p>
        ) : (
          <ul className="text-sm divide-y divide-th-border max-h-48 overflow-y-auto">
            {summaries.map((s) => (
              <li key={`${s.year}-${s.month}`} className="py-2 flex justify-between text-th-tertiary">
                <span>
                  {s.year}-{padMonth(s.month)}
                </span>
                <span className="tabular-nums">${Number(s.total).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ProjectionModal
        open={projectionOpen}
        onClose={() => setProjectionOpen(false)}
        projection={computeSpendingProjection(projectionItems)}
        contextLabel="All expenses (combined) — from Reports"
        singleItem={false}
        pieData={computeProjectionPieData(projectionItems)}
        projectionItems={projectionItems}
        projectionScopeKey="reports"
        incomeProjection={incomeItems.length > 0 ? incomeProj : null}
      />
    </div>
  );
}
