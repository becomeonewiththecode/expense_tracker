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
import { formatPaymentPlanSchedule } from "../paymentPlanOptions.js";
import { formatRenewalPeriod } from "../prescriptionOptions.js";
import {
  filterItemsForProjectionSlice,
  filterPaymentPlanItemsForProjectionSlice,
  filterPrescriptionItemsForProjectionSlice,
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
  /** `"expense"` (default), `"prescription"`, or `"payment_plan"` — copy and slice list differ. */
  projectionKind = "expense",
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
      : projectionKind === "prescription"
        ? filterPrescriptionItemsForProjectionSlice(projectionItems, selectedSlice)
        : projectionKind === "payment_plan"
          ? filterPaymentPlanItemsForProjectionSlice(projectionItems, selectedSlice)
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
      <div className="w-full max-w-lg rounded-xl border border-th-border-bright bg-th-surface shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="projection-title" className="text-lg font-semibold text-white">
              Projection
            </h2>
            {contextLabel ? (
              <p className="text-xs text-th-muted mt-1 truncate" title={contextLabel}>
                {contextLabel}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-th-subtle hover:text-white hover:bg-th-surface-alt text-sm shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-th-muted leading-relaxed">
          {projectionKind === "prescription" ? (
            singleItem ? (
              <>
                This row&apos;s <strong className="text-th-subtle">amount</strong> (per renewal) and{" "}
                <strong className="text-th-subtle">renewal period</strong> are annualized: N-month cycles use{" "}
                <strong className="text-th-subtle">12 ÷ N</strong> charges per year; multi-year cycles divide the charge
                across years. <strong className="text-th-subtle">Cancel</strong> rows do not contribute to run rate.
              </>
            ) : (
              <>
                Estimates use each item&apos;s <strong className="text-th-subtle">amount</strong> (per renewal) and{" "}
                <strong className="text-th-subtle">renewal period</strong> the same way.{" "}
                <strong className="text-th-subtle">Cancel</strong> rows are excluded from combined totals and the pie.
              </>
            )
          ) : projectionKind === "payment_plan" ? (
            singleItem ? (
              <>
                This row&apos;s <strong className="text-th-subtle">amount</strong> and{" "}
                <strong className="text-th-subtle">frequency</strong> are used first: when frequency is{" "}
                <strong className="text-th-subtle">1–6</strong>, projection uses that as the planned payment count
                (<strong className="text-th-subtle">amount × count</strong>). Otherwise, it falls back to payment
                schedule cadence (weekly × 52, bi-weekly × 26, monthly × 12, quarterly × 4, semi-annual × 2, annual ×
                1). <strong className="text-th-subtle">One-time</strong> appears as one-time total only.
                Non-active statuses are excluded from run rate.
              </>
            ) : (
              <>
                Estimates use each plan&apos;s <strong className="text-th-subtle">amount</strong> and{" "}
                <strong className="text-th-subtle">frequency</strong> first (1–6 = payment count), then payment schedule
                cadence when frequency is not numeric.{" "}
                <strong className="text-th-subtle">One-time</strong> appears below and non-active statuses are excluded
                from combined totals and pie slices.
              </>
            )
          ) : singleItem ? (
            <>
              This row&apos;s <strong className="text-th-subtle">amount</strong> and{" "}
              <strong className="text-th-subtle">frequency</strong> are annualized: weekly × 52, monthly × 12,
              bi-monthly × 6, yearly × 1 per year. <strong className="text-th-subtle">Once</strong> is not included in the
              daily / monthly / yearly run rate; it appears as a one-time total below.
            </>
          ) : (
            <>
              Estimates use each expense&apos;s <strong className="text-th-subtle">amount</strong> and{" "}
              <strong className="text-th-subtle">frequency</strong>: weekly × 52, monthly × 12, bi-monthly × 6,
              yearly × 1 per year. <strong className="text-th-subtle">Once</strong> is not included in the daily / monthly /
              yearly run rate; it appears as a one-time total below.
            </>
          )}
        </p>
        <div className="rounded-lg border border-th-border bg-th-base/50 divide-y divide-th-border">
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-sm text-th-subtle">Daily (run rate)</span>
            <span className="text-sm font-medium text-white tabular-nums">
              {hasRecurring ? formatProjectionCurrency(recurring.daily) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-sm text-th-subtle">Monthly (run rate)</span>
            <span className="text-sm font-medium text-white tabular-nums">
              {hasRecurring ? formatProjectionCurrency(recurring.monthly) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-4 px-4 py-3">
            <span className="text-sm text-th-subtle">Yearly (run rate)</span>
            <span className="text-sm font-medium text-white tabular-nums">
              {hasRecurring ? formatProjectionCurrency(recurring.yearly) : "—"}
            </span>
          </div>
          {oneTimeTotal > 0 && (
            <div className="flex justify-between gap-4 px-4 py-3">
              <span className="text-sm text-th-subtle">{oneTimeLabel}</span>
              <span className="text-sm font-medium text-amber-200/90 tabular-nums">
                {formatProjectionCurrency(oneTimeTotal)}
              </span>
            </div>
          )}
        </div>
        {Array.isArray(pieData) && pieData.length > 0 && (
          <div className="rounded-lg border border-th-border bg-th-base/50 p-3">
            <p className="text-xs text-th-muted mb-1">
              {projectionKind === "prescription" ? (
                <>
                  Annualized share by category (same scale as yearly run rate). Click a slice to list prescriptions in
                  that segment; click again to clear.
                </>
              ) : projectionKind === "payment_plan" ? (
                <>
                  Annualized share by payment-plan category (same scale as yearly run rate). One-time plans are grouped
                  as <strong className="text-th-subtle">One-time</strong>. Click a slice to list plans in that segment;
                  click again to clear.
                </>
              ) : (
                <>
                  Annualized share — recurring by category; one-time amounts grouped as{" "}
                  <strong className="text-th-subtle">One-time</strong> (same scale as yearly run rate). Click a slice
                  to list expenses in that segment; click again to clear.
                </>
              )}
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
                    formatter={(value) => <span className="text-th-tertiary">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {selectedSlice != null && (
              <div className="mt-3 rounded-lg border border-th-border-bright bg-th-surface/80 p-3">
                <p className="text-xs font-medium text-th-tertiary mb-2">
                  <span className="text-violet-300">{selectedSlice}</span>
                  <span className="text-th-muted"> · </span>
                  {sliceItems.length}{" "}
                  {projectionKind === "prescription"
                    ? sliceItems.length !== 1
                      ? "items"
                      : "item"
                    : projectionKind === "payment_plan"
                      ? `plan${sliceItems.length !== 1 ? "s" : ""}`
                    : `expense${sliceItems.length !== 1 ? "s" : ""}`}
                </p>
                {sliceItems.length === 0 ? (
                  <p className="text-xs text-th-muted">No line items match this slice.</p>
                ) : (
                  <ul className="space-y-2 max-h-52 overflow-y-auto text-xs">
                    {sliceItems.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-col gap-0.5 border-b border-th-border/80 pb-2 last:border-0 last:pb-0"
                      >
                        <span className="text-white font-medium tabular-nums">
                          {formatProjectionCurrency(row.amount)}
                        </span>
                        <span className="text-th-subtle">
                          {projectionKind === "prescription" ? (
                            <>
                              {formatRenewalPeriod(row.renewal_period)}
                              {row.name ? ` · ${row.name}` : ""}
                            </>
                          ) : projectionKind === "payment_plan" ? (
                            <>
                              {formatPaymentPlanSchedule(row.payment_schedule)}
                              {row.name ? ` · ${row.name}` : ""}
                            </>
                          ) : (
                            <>
                              {formatFrequency(row.frequency)}
                              {row.description ? ` · ${row.description}` : ""}
                            </>
                          )}
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
          <p className="text-sm text-th-muted">
            {projectionKind === "prescription"
              ? singleItem
                ? "No recurring run rate for this row (check amount, renewal period, or State Cancel)."
                : "No amounts to project from your current list."
              : projectionKind === "payment_plan"
                ? singleItem
                  ? "No recurring run rate for this row (check amount, schedule, or status)."
                  : "No active recurring plan amounts to project from your current list."
              : singleItem
                ? "No amount to project for this row."
                : "No amounts to project from your current list."}
          </p>
        )}
        {!hasRecurring && oneTimeTotal > 0 && projectionKind !== "prescription" && (
          <p className="text-xs text-th-muted">
            {singleItem
              ? "This expense is one-time only, so there is no recurring daily, monthly, or yearly run rate."
              : "Run rate is empty because all listed expenses are one-time. Add recurring items (weekly / monthly / etc.) to see daily, monthly, and yearly projections."}
          </p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-th-surface-alt hover:bg-th-border-bright text-white text-sm font-medium py-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}
