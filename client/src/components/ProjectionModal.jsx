import { useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatFrequency } from "../expenseOptions.js";
import {
  filterItemsForProjectionSlice,
  formatProjectionCurrency,
} from "../projection.js";

const PIE_COLORS = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#22d3ee",
  "#c084fc",
  "#2dd4bf",
  "#fb923c",
  "#a3e635",
  "#fb7185",
];

export default function ProjectionModal({
  open,
  onClose,
  projection,
  contextLabel,
  singleItem,
  pieData,
  projectionItems,
  projectionScopeKey,
}) {
  const [selectedSlice, setSelectedSlice] = useState(null);

  useEffect(() => {
    if (!open) setSelectedSlice(null);
  }, [open]);

  useEffect(() => {
    setSelectedSlice(null);
  }, [projectionScopeKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sliceItems =
    selectedSlice === null || !Array.isArray(projectionItems)
      ? []
      : filterItemsForProjectionSlice(projectionItems, selectedSlice);

  const activePieIndex =
    selectedSlice != null && Array.isArray(pieData)
      ? pieData.findIndex((d) => d.name === selectedSlice)
      : -1;

  if (!open || !projection) return null;

  const { recurring, oneTimeTotal } = projection;
  const hasRecurring = recurring.yearly > 0;
  const oneTimeLabel = singleItem ? "One-time amount" : "One-time expenses (total)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="projection-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="projection-title" className="text-lg font-semibold text-white">
              Projection
            </h2>
            {contextLabel ? (
              <p className="text-xs text-slate-500 mt-1 truncate" title={contextLabel}>
                {contextLabel}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 text-sm shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          {singleItem ? (
            <>
              This row&apos;s <strong className="text-slate-400">amount</strong> and{" "}
              <strong className="text-slate-400">frequency</strong> are annualized: weekly × 52, monthly × 12,
              bi-monthly × 6 per year. <strong className="text-slate-400">Once</strong> is not included in the
              daily / monthly / yearly run rate; it appears as a one-time total below.
            </>
          ) : (
            <>
              Estimates use each expense&apos;s <strong className="text-slate-400">amount</strong> and{" "}
              <strong className="text-slate-400">frequency</strong>: weekly × 52, monthly × 12, bi-monthly × 6
              per year. <strong className="text-slate-400">Once</strong> is not included in the daily / monthly /
              yearly run rate; it appears as a one-time total below.
            </>
          )}
        </p>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 divide-y divide-slate-800">
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-sm text-slate-400">Daily (run rate)</span>
            <span className="text-sm font-medium text-white tabular-nums">
              {hasRecurring ? formatProjectionCurrency(recurring.daily) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-sm text-slate-400">Monthly (run rate)</span>
            <span className="text-sm font-medium text-white tabular-nums">
              {hasRecurring ? formatProjectionCurrency(recurring.monthly) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-sm text-slate-400">Yearly (run rate)</span>
            <span className="text-sm font-medium text-white tabular-nums">
              {hasRecurring ? formatProjectionCurrency(recurring.yearly) : "—"}
            </span>
          </div>
          {oneTimeTotal > 0 && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <span className="text-sm text-slate-400">{oneTimeLabel}</span>
              <span className="text-sm font-medium text-amber-200/90 tabular-nums">
                {formatProjectionCurrency(oneTimeTotal)}
              </span>
            </div>
          )}
        </div>
        {Array.isArray(pieData) && pieData.length > 0 && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs text-slate-500 mb-1">
              Annualized share — recurring by category; one-time amounts grouped as{" "}
              <strong className="text-slate-400">One-time</strong> (same scale as yearly run rate). Click a slice
              to list expenses in that segment; click again to clear.
            </p>
            <div className="h-56 w-full min-h-[14rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={76}
                    paddingAngle={1}
                    cursor="pointer"
                    activeIndex={activePieIndex >= 0 ? activePieIndex : undefined}
                    onClick={(data, index) => {
                      const name =
                        data?.name ??
                        data?.payload?.name ??
                        (typeof index === "number" && pieData[index] ? pieData[index].name : null);
                      if (name == null) return;
                      setSelectedSlice((prev) => (prev === name ? null : name));
                    }}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="#0f172a" strokeWidth={1} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [formatProjectionCurrency(value), "Annual"]}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    formatter={(value) => <span className="text-slate-300">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {selectedSlice != null && (
              <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/80 p-3">
                <p className="text-xs font-medium text-slate-300 mb-2">
                  <span className="text-violet-300">{selectedSlice}</span>
                  <span className="text-slate-500"> · </span>
                  {sliceItems.length} expense{sliceItems.length !== 1 ? "s" : ""}
                </p>
                {sliceItems.length === 0 ? (
                  <p className="text-xs text-slate-500">No line items match this slice.</p>
                ) : (
                  <ul className="space-y-2 max-h-52 overflow-y-auto text-xs">
                    {sliceItems.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-col gap-0.5 border-b border-slate-800/80 pb-2 last:border-0 last:pb-0"
                      >
                        <span className="text-white font-medium tabular-nums">
                          {formatProjectionCurrency(row.amount)}
                        </span>
                        <span className="text-slate-400">
                          {formatFrequency(row.frequency)}
                          {row.description ? ` · ${row.description}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {!hasRecurring && oneTimeTotal === 0 && (
          <p className="text-sm text-slate-500">
            {singleItem ? "No amount to project for this row." : "No amounts to project from your current list."}
          </p>
        )}
        {!hasRecurring && oneTimeTotal > 0 && (
          <p className="text-xs text-slate-500">
            {singleItem
              ? "This expense is one-time only, so there is no recurring daily, monthly, or yearly run rate."
              : "Run rate is empty because all listed expenses are one-time. Add recurring items (weekly / monthly / etc.) to see daily, monthly, and yearly projections."}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}
