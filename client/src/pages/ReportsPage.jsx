import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api";

const tabs = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "custom", label: "Custom range" },
];

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function padMonth(m) {
  return String(m).padStart(2, "0");
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

  useEffect(() => {
    api
      .get("/reports/summaries")
      .then((r) => setSummaries(r.data))
      .catch(() => setSummaries([]));
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

  const chartData =
    data?.series?.map((p) => ({
      name: p.label?.slice(5) ?? p.label,
      full: p.label,
      total: p.total,
    })) ?? [];

  const totalFmt = data?.total != null ? `$${Number(data.total).toFixed(2)}` : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Reports</h1>
        <p className="text-sm text-slate-400 mt-1">Spending trends by period.</p>
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
                : "bg-slate-800 text-slate-300 hover:bg-slate-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 items-end bg-slate-900/40 border border-slate-800 rounded-xl p-4">
        {tab === "daily" && (
          <div>
            <label className="text-xs text-slate-500 block mb-1">Date</label>
            <input
              type="date"
              value={dailyDate}
              onChange={(e) => setDailyDate(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
          </div>
        )}
        {tab === "monthly" && (
          <>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Year</label>
              <input
                type="number"
                value={monthYear}
                onChange={(e) => setMonthYear(Number(e.target.value))}
                className="w-28 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Month</label>
              <input
                type="number"
                min="1"
                max="12"
                value={monthNum}
                onChange={(e) => setMonthNum(Number(e.target.value))}
                className="w-24 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
          </>
        )}
        {tab === "yearly" && (
          <div>
            <label className="text-xs text-slate-500 block mb-1">Year</label>
            <input
              type="number"
              value={yearNum}
              onChange={(e) => setYearNum(Number(e.target.value))}
              className="w-28 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
            />
          </div>
        )}
        {tab === "custom" && (
          <>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Start</label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">End</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/30 p-4 min-h-[280px]">
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Trend</p>
          {loading ? (
            <p className="text-slate-500 py-12 text-center">Loading chart…</p>
          ) : chartData.length === 0 ? (
            <p className="text-slate-500 py-12 text-center">No data for this period.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
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
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-3xl font-semibold text-white tabular-nums">{totalFmt}</p>
          {tab === "daily" && data?.byCategory?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">By category</p>
              <ul className="text-sm space-y-1">
                {data.byCategory.map((c) => (
                  <li key={c.category} className="flex justify-between text-slate-300">
                    <span>{c.category}</span>
                    <span className="tabular-nums">${Number(c.total).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4">
        <p className="text-sm font-medium text-white mb-2">Stored monthly summaries</p>
        <p className="text-xs text-slate-500 mb-3">
          Generated automatically on the 1st of each month (previous month totals).
        </p>
        {summaries.length === 0 ? (
          <p className="text-sm text-slate-500">None yet — data appears after the scheduled job runs.</p>
        ) : (
          <ul className="text-sm divide-y divide-slate-800 max-h-48 overflow-y-auto">
            {summaries.map((s) => (
              <li key={`${s.year}-${s.month}`} className="py-2 flex justify-between text-slate-300">
                <span>
                  {s.year}-{padMonth(s.month)}
                </span>
                <span className="tabular-nums">${Number(s.total).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
