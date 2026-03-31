import { useCallback, useEffect, useId, useMemo, useState } from "react";
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
import {
  SORTABLE_TH_BUTTON,
  SORTABLE_TH_ICON_ACTIVE,
  SORTABLE_TH_ICON_IDLE,
  TABLE,
  TABLE_BODY,
  TABLE_CARD,
  TABLE_HEAD,
  TABLE_ROW,
  TABLE_SCROLL,
  TABLE_TD,
  TABLE_TD_STICKY_ACTIONS_DEFAULT,
  TABLE_TH_STICKY_ACTIONS,
} from "../tableStyles.js";

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

/** Filled info-in-circle (24×24 Material-style path — reliable across browsers). */
function InfoIcon({ className }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
    </svg>
  );
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

const RENEWAL_SORT_KEYS = ["title", "spent_at", "amount", "state", "renews"];

function transactionSortValue(spentAt) {
  const iso = spentAtToIsoDateString(spentAt);
  return iso || "";
}

function compareRenewalRows(a, b, key, dir) {
  const mul = dir === "asc" ? 1 : -1;
  const tie = String(a.key).localeCompare(String(b.key));
  let cmp = 0;
  switch (key) {
    case "title":
      cmp = a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });
      break;
    case "spent_at":
      cmp = transactionSortValue(a.spentAt).localeCompare(transactionSortValue(b.spentAt));
      break;
    case "amount":
      cmp = a.amountNum - b.amountNum;
      break;
    case "state":
      cmp = formatExpenseState(a.state).localeCompare(formatExpenseState(b.state), undefined, {
        sensitivity: "base",
      });
      break;
    case "renews":
      cmp = startOfLocalDay(a.next).getTime() - startOfLocalDay(b.next).getTime();
      break;
    default:
      return tie;
  }
  if (cmp !== 0) return cmp * mul;
  return tie;
}

function sortRenewalRows(rows, key, dir) {
  if (!key || !RENEWAL_SORT_KEYS.includes(key)) return rows;
  return [...rows].sort((a, b) => compareRenewalRows(a, b, key, dir));
}

function RenewalSortableTh({ colKey, label, sort, onSort, className = "", align = "left" }) {
  const active = sort.key === colKey;
  const dir = sort.dir;
  const justify = align === "right" ? "justify-end text-right" : "text-left";
  return (
    <th
      scope="col"
      className={`px-4 py-3 ${className}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className={`${SORTABLE_TH_BUTTON} ${justify} whitespace-nowrap`}
        title={`Sort by ${label}`}
      >
        <span className="truncate">{label}</span>
        <span
          className={`shrink-0 text-[10px] leading-none w-3.5 text-center ${
            active ? SORTABLE_TH_ICON_ACTIVE : SORTABLE_TH_ICON_IDLE
          }`}
          aria-hidden
        >
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

export default function RenewalReminders({
  onRenewalChipChange,
  tablesExpanded,
  onTablesExpandedChange,
}) {
  const location = useLocation();
  const renewalHelpTriggerId = useId();
  const renewalHelpPanelId = useId();
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [loadError, setLoadError] = useState(false);
  const [renewalHelpOpen, setRenewalHelpOpen] = useState(false);
  const [renewalSort, setRenewalSort] = useState({ key: null, dir: "asc" });

  function handleRenewalSort(colKey) {
    setRenewalSort((prev) => {
      if (prev.key === colKey) {
        return { key: colKey, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key: colKey, dir: "asc" };
    });
  }

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
    onTablesExpandedChange(true);
  }, [onTablesExpandedChange]);

  useEffect(() => {
    if (!renewalHelpOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setRenewalHelpOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [renewalHelpOpen]);

  useEffect(() => {
    if (!onRenewalChipChange) return undefined;
    if (loadError) {
      onRenewalChipChange(null);
      return undefined;
    }
    const eligible = eligibleRenewals.length;
    const visible = reminders.length;
    if (eligible > 0) {
      onRenewalChipChange({
        count: eligible,
        allDismissed: visible === 0,
        tablesExpanded,
        onExpand: expandPanel,
        onShowTables: () => onTablesExpandedChange(true),
        onToggleTables: () => onTablesExpandedChange((v) => !v),
      });
    } else {
      onRenewalChipChange(null);
    }
    return () => onRenewalChipChange(null);
  }, [
    loadError,
    eligibleRenewals.length,
    reminders.length,
    tablesExpanded,
    expandPanel,
    onTablesExpandedChange,
    onRenewalChipChange,
  ]);

  if (loadError || reminders.length === 0) return null;

  return (
    <div
      className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm"
      role="region"
      aria-label="Subscription renewal reminders"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 gap-y-2">
        <div
          className="flex flex-wrap items-center gap-2 min-w-0 flex-1"
          onDoubleClick={() => onTablesExpandedChange((v) => !v)}
          title="Double-click to show or hide renewal tables"
        >
          <p className="font-medium text-amber-100 select-none">Upcoming expenses</p>
          <button
            type="button"
            id={renewalHelpTriggerId}
            onClick={() => setRenewalHelpOpen((o) => !o)}
            onDoubleClick={(e) => e.stopPropagation()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-amber-400/70 bg-amber-950/90 text-amber-100 shadow-sm hover:bg-amber-900 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/80 focus:ring-offset-2 focus:ring-offset-amber-950"
            aria-expanded={renewalHelpOpen}
            aria-controls={renewalHelpPanelId}
            title="How this table works"
          >
            <span className="sr-only">How upcoming expenses work</span>
            <InfoIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onTablesExpandedChange((v) => !v)}
            className="text-xs text-amber-200/90 hover:text-amber-100 rounded-full border border-amber-700/60 px-2 py-0.5"
            aria-expanded={tablesExpanded}
          >
            {tablesExpanded ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={dismissAll}
            className="text-xs text-amber-200/80 hover:text-amber-100 underline-offset-2 hover:underline"
          >
            Dismiss all
          </button>
        </div>
      </div>
      {renewalHelpOpen ? (
        <div
          id={renewalHelpPanelId}
          role="region"
          aria-labelledby={renewalHelpTriggerId}
          className="mt-2 mb-3 rounded-lg border border-amber-800/50 bg-slate-950/70 px-3 py-2.5 text-xs text-amber-200/80 leading-relaxed"
        >
          Based on each expense&apos;s <strong className="text-amber-200/90">frequency</strong> and{" "}
          <strong className="text-amber-200/90">transaction date</strong>. We surface renewals roughly a month out, a
          couple of weeks out, and during the final two weeks (with short windows so you still see a reminder if you skip
          a day). Amounts are each line&apos;s stored charge. <strong className="text-amber-200/90">Renews</strong> is
          computed from the <strong className="text-amber-200/90">Transaction</strong> date and frequency (for yearly,
          the same month and day next time it falls on or after today). After a renewal date passes, a line stays off the
          list for a short while until the next charge is closer (the far &quot;month out&quot; band does not resume for
          about two weeks after that date). If Renews looks wrong, fix the transaction date under{" "}
          <strong className="text-amber-200/90">Expenses</strong> → Edit. Rows with{" "}
          <strong className="text-amber-200/90">State</strong> set to{" "}
          <strong className="text-amber-200/90">Cancel</strong> use a{" "}
          <strong className="text-emerald-300/90">green</strong> highlight (subscription ended or you do not expect
          another charge). <strong className="text-amber-200/90">Subtotals</strong> and{" "}
          <strong className="text-amber-200/90">Total (all institutions)</strong> include only{" "}
          <strong className="text-amber-200/90">Active</strong> rows—
          <strong className="text-emerald-300/90">Cancel</strong> amounts are excluded.
        </div>
      ) : null}
      {tablesExpanded ? (
      <div className="space-y-4">
        {remindersByInstitution.map(([institution, rows]) => {
          const sortedRows = sortRenewalRows(rows, renewalSort.key, renewalSort.dir);
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
              <div className={`${TABLE_SCROLL} ${TABLE_CARD}`}>
                <table className={`${TABLE} min-w-[56rem]`}>
                  <thead className={TABLE_HEAD}>
                    <tr>
                      <RenewalSortableTh
                        colKey="title"
                        label="Expense"
                        sort={renewalSort}
                        onSort={handleRenewalSort}
                        className="max-w-[14rem]"
                      />
                      <RenewalSortableTh
                        colKey="spent_at"
                        label="Transaction"
                        sort={renewalSort}
                        onSort={handleRenewalSort}
                      />
                      <RenewalSortableTh
                        colKey="amount"
                        label="Amount"
                        sort={renewalSort}
                        onSort={handleRenewalSort}
                        align="right"
                        className="text-right whitespace-nowrap"
                      />
                      <RenewalSortableTh
                        colKey="state"
                        label="State"
                        sort={renewalSort}
                        onSort={handleRenewalSort}
                      />
                      <RenewalSortableTh
                        colKey="renews"
                        label="Renews"
                        sort={renewalSort}
                        onSort={handleRenewalSort}
                        className="min-w-[12rem]"
                      />
                      <th scope="col" className={TABLE_TH_STICKY_ACTIONS}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className={TABLE_BODY}>
                    {sortedRows.map((r) => {
                      const cancelled = r.state === "cancel";
                      return (
                        <tr
                          key={r.key}
                          className={
                            cancelled
                              ? "bg-emerald-950/75 hover:bg-emerald-900/55 border-l-[3px] border-emerald-500 group"
                              : TABLE_ROW
                          }
                        >
                          <td
                            className={`${TABLE_TD} max-w-[14rem] ${cancelled ? "text-emerald-50" : "text-slate-200"}`}
                          >
                            <span className="font-medium line-clamp-2" title={r.title}>
                              {r.title}
                            </span>
                          </td>
                          <td
                            className={`${TABLE_TD} whitespace-nowrap text-xs ${cancelled ? "text-emerald-200/90" : "text-slate-400"}`}
                          >
                            {formatTransactionAnchor(r.spentAt)}
                          </td>
                          <td
                            className={`${TABLE_TD} text-right tabular-nums font-medium whitespace-nowrap ${cancelled ? "text-emerald-50" : "text-white"}`}
                          >
                            {formatProjectionCurrency(r.amountNum)}
                          </td>
                          <td
                            className={`${TABLE_TD} whitespace-nowrap text-xs font-medium ${cancelled ? "text-emerald-200" : "text-slate-300"}`}
                          >
                            {formatExpenseState(r.state)}
                          </td>
                          <td
                            className={`${TABLE_TD} text-xs ${cancelled ? "text-emerald-200/85" : "text-slate-400"}`}
                          >
                            <span className={cancelled ? "text-emerald-100" : "text-slate-200"}>
                              {formatRenewalDate(r.next)}
                            </span>
                            <span className={cancelled ? "text-emerald-300/80" : "text-slate-500"}>
                              {" "}
                              ({leadTimePhrase(r.tier, r.days)})
                            </span>
                          </td>
                          <td
                            className={`${
                              cancelled
                                ? "sticky right-0 z-10 px-4 py-3 text-right align-middle min-w-[10rem] border-l border-emerald-800/60 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.35)] bg-emerald-950/90 group-hover:bg-emerald-900/70"
                                : TABLE_TD_STICKY_ACTIONS_DEFAULT
                            } whitespace-nowrap`}
                          >
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
                    <tr className="border-t border-slate-800 bg-slate-900/50">
                      <th scope="row" className={`${TABLE_TD} text-left font-semibold text-slate-200`}>
                        Subtotal
                      </th>
                      <td className={`${TABLE_TD} text-slate-500 text-xs`}>—</td>
                      <td className={`${TABLE_TD} text-right tabular-nums font-semibold text-white whitespace-nowrap`}>
                        {formatProjectionCurrency(sectionTotal)}
                      </td>
                      <td className={`${TABLE_TD} text-slate-500 text-xs`} colSpan={3}>
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
      ) : null}
    </div>
  );
}
