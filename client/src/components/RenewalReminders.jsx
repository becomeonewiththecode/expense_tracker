import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api.js";
import { formatCategory, formatFinancialInstitution } from "../expenseOptions.js";
import { formatProjectionCurrency } from "../projection.js";
import {
  daysUntilRenewal,
  nextRenewalDate,
  renewalReminderTier,
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

export default function RenewalReminders() {
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

  const reminders = useMemo(() => {
    const now = new Date();
    const out = [];
    for (const row of items) {
      if (row == null || row.id == null) continue;
      const days = daysUntilRenewal(row, now);
      const tier = renewalReminderTier(days);
      if (tier == null || days == null) continue;
      const next = nextRenewalDate(row, now);
      if (!next) continue;
      const key = `${row.id}-${tier}-${startOfLocalDay(next).getTime()}`;
      if (dismissed.has(key)) continue;
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
      });
    }
    out.sort((a, b) => a.days - b.days || a.tier - b.tier);
    return out;
  }, [items, dismissed]);

  const remindersTotal = useMemo(
    () => reminders.reduce((sum, r) => sum + r.amountNum, 0),
    [reminders]
  );

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
        Amounts are each line&apos;s stored charge (same as your expense list).
      </p>
      <div className="overflow-x-auto rounded-lg border border-amber-900/50 bg-slate-950/50">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-amber-900/40 text-xs uppercase tracking-wide text-amber-200/80">
              <th scope="col" className="px-3 py-2 font-medium">
                Expense
              </th>
              <th scope="col" className="px-3 py-2 font-medium text-right whitespace-nowrap">
                Amount
              </th>
              <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                Institution
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
            {reminders.map((r) => (
              <tr key={r.key} className="hover:bg-slate-900/50">
                <td className="px-3 py-2 text-amber-50 align-middle max-w-[14rem]">
                  <span className="font-medium line-clamp-2" title={r.title}>
                    {r.title}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-50 font-medium align-middle whitespace-nowrap">
                  {formatProjectionCurrency(r.amountNum)}
                </td>
                <td className="px-3 py-2 text-amber-200/90 align-middle whitespace-nowrap">{r.institution}</td>
                <td className="px-3 py-2 text-amber-200/80 text-xs align-middle">
                  <span className="text-amber-100/90">{formatRenewalDate(r.next)}</span>
                  <span className="text-amber-200/70"> ({leadTimePhrase(r.tier, r.days)})</span>
                </td>
                <td className="px-3 py-2 text-right align-middle whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => dismiss(r.key)}
                    className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800"
                    aria-label={`Dismiss reminder for ${r.title}`}
                  >
                    Dismiss
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-amber-800/60 bg-amber-950/30">
              <th scope="row" className="px-3 py-2 text-left font-semibold text-amber-100">
                Total
              </th>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-50 whitespace-nowrap">
                {formatProjectionCurrency(remindersTotal)}
              </td>
              <td className="px-3 py-2 text-amber-200/50 text-xs" colSpan={3}>
                Sum of amounts above
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
