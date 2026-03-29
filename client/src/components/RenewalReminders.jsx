import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api.js";
import { formatCategory, formatExpenseState, formatFinancialInstitution } from "../expenseOptions.js";
import { formatProjectionCurrency } from "../projection.js";
import {
  daysUntilRenewal,
  isEarlyRenewalTierSuppressedAfterRecentOccurrence,
  nextRenewalDate,
  renewalReminderTier,
  spentAtToIsoDateString,
  startOfLocalDay,
} from "../renewalSchedule.js";

const STORAGE_KEY = "renewalReminderDismissed";

function readDismissed() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function writeDismissed(set) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

function formatRenewalDate(d) {
  return startOfLocalDay(d).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Same calendar date as renewal math (local, no timezone shift). */
function formatTransactionAnchor(spentAt) {
  const iso = spentAtToIsoDateString(spentAt);
  if (!iso) return "—";
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7), 10) - 1;
  const d = Number(iso.slice(8, 10), 10);
  return new Date(y, mo, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function leadTimePhrase(tier, days) {
  if (tier === 30) {
    if (days >= 27 && days <= 33) return "in about 30 days";
    return `in ${days} days`;
  }
  if (tier === 15) {
    if (days >= 13 && days <= 17) return "in about 15 days";
    return `in ${days} days`;
  }
  if (tier === 5) {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    return `in ${days} days`;
  }
  return "";
}

/** Cancelled subscriptions stay visible for reference but do not add to subtotals or the grand total. */
function countsInRenewalSubtotal(r) {
  return r.state !== "cancel";
}

export default function RenewalReminders({ onRenewalChipChange }) {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    (async () => {
      try {
        const { data } = await api.get("/expenses", { params: { limit: 500 } });
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) {
          setItems([]);
          setLoadError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  /** All tier-qualified rows (ignore dismiss) — for header count when the panel is empty. */
  const eligibleRenewals = useMemo(() => {
    const now = new Date();
    const out = [];
    for (const row of items) {
      if (row == null || row.id == null) continue;
      const days = daysUntilRenewal(row, now);
      if (days == null || days < 0) continue;
      if (isEarlyRenewalTierSuppressedAfterRecentOccurrence(row, now, days)) continue;
      const tier = renewalReminderTier(days);
      if (tier == null) continue;
      const next = nextRenewalDate(row, now);
      if (!next) continue;
      const key = `${row.id}-${tier}-${startOfLocalDay(next).getTime()}`;
      const cat = formatCategory(row.category);
      const note = String(row.description || "").trim();
      const title = note ? `${cat} · ${note.length > 40 ? `${note.slice(0, 38)}…` : note}` : cat;
      const amountNum = Number(row.amount);
      const amountSafe = Number.isFinite(amountNum) ? amountNum : 0;
      out.push({
        id: row.id,
        key,
        tier,
        days,
        next,
        title,
        amountNum: amountSafe,
        institution: formatFinancialInstitution(row.financial_institution),
        spentAt: row.spent_at,
        state: row.state === "cancel" ? "cancel" : "active",
      });
    }
    out.sort((a, b) => a.days - b.days || a.tier - b.tier);
    return out;
  }, [items]);

  const reminders = useMemo(
    () => eligibleRenewals.filter((r) => !dismissed.has(r.key)),
    [eligibleRenewals, dismissed]
  );

  const remindersTotal = useMemo(
    () => reminders.filter(countsInRenewalSubtotal).reduce((sum, r) => sum + r.amountNum, 0),
    [reminders]
  );

  /** [[institutionLabel, rows], ...] sorted by institution; rows sorted by renewal proximity. */
  const remindersByInstitution = useMemo(() => {
    const map = new Map();
    for (const r of reminders) {
      const label = r.institution || "—";
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(r);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => a.days - b.days || a.tier - b.tier);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }));
  }, [reminders]);

  const dismiss = useCallback((key) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      writeDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const r of reminders) next.add(r.key);
      writeDismissed(next);
      return next;
    });
  }, [reminders]);

  const expandPanel = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setDismissed(new Set());
  }, []);

  useEffect(() => {
    if (!onRenewalChipChange) return undefined;
    if (loadError) {
      onRenewalChipChange(null);
      return undefined;
    }
    const eligible = eligibleRenewals.length;
    const visible = reminders.length;
    if (eligible > 0 && visible === 0) {
      onRenewalChipChange({ count: eligible, onExpand: expandPanel });
    } else {
      onRenewalChipChange(null);
    }
    return () => onRenewalChipChange(null);
  }, [
    loadError,
    eligibleRenewals.length,
    reminders.length,
    expandPanel,
    onRenewalChipChange,
  ]);

  if (loadError || reminders.length === 0) return null;

  return (
    <div
      className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm"
      role="region"
      aria-label="Subscription renewal reminders"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
        <p className="font-medium text-amber-100">Upcoming renewals</p>
        <button
          type="button"
          onClick={dismissAll}
          className="text-xs text-amber-200/80 hover:text-amber-100 underline-offset-2 hover:underline shrink-0"
        >
          Dismiss all
        </button>
      </div>
      <p className="text-xs text-amber-200/70 mt-1 mb-3">
        Based on each expense&apos;s <strong className="text-amber-200/90">frequency</strong> and{" "}
        <strong className="text-amber-200/90">transaction date</strong>. We surface renewals roughly a month out, a couple
        of weeks out, and during the final two weeks (with short windows so you still see a reminder if you skip a day).
        Amounts are each line&apos;s stored charge. <strong className="text-amber-200/90">Renews</strong> is computed from
        the <strong className="text-amber-200/90">Transaction</strong> date and frequency (for yearly, the same month and
        day next time it falls on or after today). After a renewal date passes, a line stays off the list for a short
        while until the next charge is closer (the far &quot;month out&quot; band does not resume for about two weeks
        after that date). If Renews looks wrong, fix the transaction date under{" "}
        <strong className="text-amber-200/90">Your expenses</strong> → Edit. Rows with{" "}
        <strong className="text-amber-200/90">State</strong> set to <strong className="text-amber-200/90">Cancel</strong>{" "}
        use a <strong className="text-emerald-300/90">green</strong> highlight (subscription ended or you do not expect another charge).
        <strong className="text-amber-200/90"> Subtotals</strong> and{" "}
        <strong className="text-amber-200/90">Total (all institutions)</strong> include only{" "}
        <strong className="text-amber-200/90">Active</strong> rows—<strong className="text-emerald-300/90">Cancel</strong>{" "}
        amounts are excluded.
      </p>
      <div className="space-y-4">
        {remindersByInstitution.map(([institution, rows]) => {
          const sectionTotal = rows
            .filter(countsInRenewalSubtotal)
            .reduce((sum, r) => sum + r.amountNum, 0);
          const nActive = rows.filter(countsInRenewalSubtotal).length;
          const nCancel = rows.length - nActive;
          const subtotalFooterNote =
            nCancel === 0
              ? `${rows.length} ${rows.length === 1 ? "expense" : "expenses"}`
              : `${nActive} in subtotal · ${nCancel} Cancel (excluded)`;
          return (
            <section key={institution} aria-label={`Renewals for ${institution}`}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/90 mb-2">
                {institution}
              </h3>
              <div className="overflow-x-auto rounded-lg border border-amber-900/50 bg-slate-950/50">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-amber-900/40 text-xs uppercase tracking-wide text-amber-200/80">
                      <th scope="col" className="px-3 py-2 font-medium">
                        Expense
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                        Transaction
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap">
                        Amount
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                        State
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap min-w-[12rem]">
                        Renews
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium text-right w-[1%] whitespace-nowrap">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-950/60">
                    {rows.map((r) => {
                      const cancelled = r.state === "cancel";
                      return (
                        <tr
                          key={r.key}
                          className={
                            cancelled
                              ? "bg-emerald-950/75 hover:bg-emerald-900/55 border-l-[3px] border-emerald-500"
                              : "hover:bg-slate-900/50"
                          }
                        >
                          <td
                            className={`px-3 py-2 align-middle max-w-[14rem] ${cancelled ? "text-emerald-50" : "text-amber-50"}`}
                          >
                            <span className="font-medium line-clamp-2" title={r.title}>
                              {r.title}
                            </span>
                          </td>
                          <td
                            className={`px-3 py-2 align-middle whitespace-nowrap text-xs ${cancelled ? "text-emerald-200/90" : "text-amber-200/90"}`}
                          >
                            {formatTransactionAnchor(r.spentAt)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums font-medium align-middle whitespace-nowrap ${cancelled ? "text-emerald-50" : "text-amber-50"}`}
                          >
                            {formatProjectionCurrency(r.amountNum)}
                          </td>
                          <td
                            className={`px-3 py-2 whitespace-nowrap text-xs font-medium align-middle ${cancelled ? "text-emerald-200" : "text-amber-200/90"}`}
                          >
                            {formatExpenseState(r.state)}
                          </td>
                          <td
                            className={`px-3 py-2 text-xs align-middle ${cancelled ? "text-emerald-200/85" : "text-amber-200/80"}`}
                          >
                            <span className={cancelled ? "text-emerald-100" : "text-amber-100/90"}>
                              {formatRenewalDate(r.next)}
                            </span>
                            <span className={cancelled ? "text-emerald-300/80" : "text-amber-200/70"}>
                              {" "}
                              ({leadTimePhrase(r.tier, r.days)})
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right align-middle whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => dismiss(r.key)}
                              className={
                                cancelled
                                  ? "text-xs text-emerald-200/90 hover:text-white px-2 py-1 rounded-md hover:bg-emerald-950/80"
                                  : "text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800"
                              }
                              aria-label={`Dismiss reminder for ${r.title}`}
                            >
                              Dismiss
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-amber-800/60 bg-amber-950/30">
                      <th scope="row" className="px-3 py-2 text-left font-semibold text-amber-100">
                        Subtotal
                      </th>
                      <td className="px-3 py-2 text-amber-200/40 text-xs">—</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-50 whitespace-nowrap">
                        {formatProjectionCurrency(sectionTotal)}
                      </td>
                      <td className="px-3 py-2 text-amber-200/50 text-xs" colSpan={3}>
                        {subtotalFooterNote}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })}
        <div>
          <div className="rounded-lg border border-amber-800/60 bg-amber-950/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-amber-100">Total (all institutions)</span>
            <span className="tabular-nums font-semibold text-amber-50">
              {formatProjectionCurrency(remindersTotal)}
            </span>
          </div>
          <p className="text-xs text-amber-200/60 mt-1">
            Sum of Active rows in every section above (Cancel excluded).
          </p>
        </div>
      </div>
    </div>
  );
}
