import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api.js";
import { formatCategory } from "../expenseOptions.js";
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
  if (tier === 30) return "in about 30 days";
  if (tier === 15) return "in about 15 days";
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
      out.push({ id: row.id, key, tier, days, next, title });
    }
    out.sort((a, b) => a.days - b.days || a.tier - b.tier);
    return out;
  }, [items, dismissed]);

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
      <p className="text-xs text-amber-200/70 mt-1 mb-2">
        Based on each expense&apos;s frequency, month (yearly), and payment date. We remind you about 30, 15, and 5
        days before (with a short window around each so you still see it if you skip a day).
      </p>
      <ul className="space-y-2">
        {reminders.map((r) => (
          <li
            key={r.key}
            className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-slate-950/50 border border-amber-900/40 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-amber-50 font-medium truncate" title={r.title}>
                {r.title}
              </p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Renews {formatRenewalDate(r.next)} ({leadTimePhrase(r.tier, r.days)}).
              </p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(r.key)}
              className="text-xs text-slate-400 hover:text-white shrink-0 px-2 py-1 rounded-md hover:bg-slate-800"
              aria-label={`Dismiss reminder for ${r.title}`}
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
