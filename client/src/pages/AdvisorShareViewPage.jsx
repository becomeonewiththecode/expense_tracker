import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import publicApi from "../publicApi";
import { getApiErrorMessage } from "../apiError.js";

function padMonth(m) {
  return String(m).padStart(2, "0");
}

function daysInCalendarMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function buildDailyBars(year, month, series) {
  const byLabel = new Map((series || []).map((p) => [p.label, p.total]));
  const dim = daysInCalendarMonth(year, month);
  const out = [];
  for (let d = 1; d <= dim; d++) {
    const label = `${year}-${padMonth(month)}-${String(d).padStart(2, "0")}`;
    out.push({
      name: String(d),
      full: label,
      total: byLabel.get(label) ?? 0,
    });
  }
  return out;
}

export default function AdvisorShareViewPage() {
  const { token } = useParams();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data: payload } = await publicApi.get(`/public/share/${encodeURIComponent(token)}/reports/monthly`, {
          params: { year, month },
        });
        if (!cancelled) setData(payload);
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e, "Could not load shared report"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, year, month]);

  const chartData = useMemo(
    () => (data ? buildDailyBars(data.year, data.month, data.series) : []),
    [data]
  );

  const monthOptions = useMemo(() => {
    const y = year;
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: new Date(Date.UTC(y, i, 1)).toLocaleString(undefined, { month: "long" }),
    }));
  }, [year]);

  return (
    <div className="min-h-screen bg-th-base text-th-secondary px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Shared monthly report</h1>
          <p className="text-sm text-th-muted mt-1">Read-only view. Spending totals only.</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-th-subtle mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28 rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-th-subtle mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm min-w-[10rem]"
            >
              {monthOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading && <p className="text-th-subtle text-sm">Loading…</p>}
        {error && (
          <p className="text-sm text-rose-400 border border-rose-900/50 rounded-lg px-3 py-2">{error}</p>
        )}

        {data && !loading && !error && (
          <>
            <div className="rounded-xl border border-th-border bg-th-surface p-6 shadow-xl">
              <p className="text-xs uppercase tracking-wide text-th-muted">Total spending</p>
              <p className="text-3xl font-semibold text-white tabular-nums mt-1">
                {data.total.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </p>
              <p className="text-xs text-th-muted mt-2">
                {data.start} — {data.end}
              </p>
            </div>

            <div className="rounded-xl border border-th-border bg-th-surface p-6 shadow-xl h-72">
              <p className="text-sm font-medium text-th-tertiary mb-3">By day</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
                    labelFormatter={(_, p) => (p?.[0]?.payload?.full ? String(p[0].payload.full) : "")}
                    formatter={(value) => [Number(value).toFixed(2), "Spent"]}
                  />
                  <Bar dataKey="total" fill="#34d399" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl border border-th-border bg-th-surface p-6 shadow-xl">
              <p className="text-sm font-medium text-th-tertiary mb-3">By category</p>
              <ul className="space-y-2">
                {(data.byCategory || []).map((row) => (
                  <li key={row.category} className="flex justify-between text-sm gap-4">
                    <span className="text-th-secondary capitalize">{row.category.replace(/_/g, " ")}</span>
                    <span className="text-white tabular-nums">
                      {row.total.toLocaleString(undefined, { style: "currency", currency: "USD" })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
