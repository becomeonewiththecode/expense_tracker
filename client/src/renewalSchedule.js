/**
 * Next renewal / anniversary dates from expense frequency, payment_day, payment_month, and spent_at.
 * Uses the browser's local calendar (start-of-day boundaries).
 */

/** @typedef {{ id?: number, frequency?: string, spent_at?: string, payment_day?: number | null, payment_month?: number | null, category?: string, description?: string }} ExpenseLike */

function normalizeFrequency(frequency) {
  const f = String(frequency ?? "monthly")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  return f === "bi-monthly" || f === "bi_monthly" ? "bimonthly" : f;
}

function parseLocalDate(iso) {
  const s = String(iso ?? "").slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo, d);
}

export function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDayInMonth(year, monthIndex, day) {
  const dim = daysInMonth(year, monthIndex);
  const n = Number(day);
  if (!Number.isFinite(n)) return dim;
  return Math.min(Math.max(1, Math.floor(n)), dim);
}

/** Move calendar by `delta` months, keeping day clamped (e.g. Jan 31 + 1 → Feb 28). */
function addMonthsClamped(date, delta) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const first = new Date(y, m, 1);
  first.setMonth(first.getMonth() + delta);
  const dim = daysInMonth(first.getFullYear(), first.getMonth());
  first.setDate(Math.min(d, dim));
  return startOfLocalDay(first);
}

/**
 * Next renewal date on or after `from` (local start of day). Null for one-time or bad data.
 * @param {ExpenseLike} expense
 * @param {Date} [from]
 * @returns {Date | null}
 */
export function nextRenewalDate(expense, from = new Date()) {
  const freq = normalizeFrequency(expense.frequency);
  if (freq === "once") return null;

  const spent = parseLocalDate(expense.spent_at);
  if (!spent) return null;

  const fromS = startOfLocalDay(from);
  const rawDay =
    expense.payment_day != null && expense.payment_day !== ""
      ? Number(expense.payment_day)
      : spent.getDate();
  const day =
    Number.isFinite(rawDay) && rawDay >= 1 ? Math.min(30, Math.max(1, Math.floor(rawDay))) : spent.getDate();

  if (freq === "weekly") {
    let cur = startOfLocalDay(spent);
    while (cur < fromS) {
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
    }
    return cur;
  }

  if (freq === "monthly") {
    let y = fromS.getFullYear();
    let m = fromS.getMonth();
    let cand = new Date(y, m, clampDayInMonth(y, m, day));
    if (cand < fromS) {
      const next = addMonthsClamped(cand, 1);
      return next;
    }
    return cand;
  }

  if (freq === "bimonthly") {
    let cur = startOfLocalDay(spent);
    cur = new Date(
      cur.getFullYear(),
      cur.getMonth(),
      clampDayInMonth(cur.getFullYear(), cur.getMonth(), day)
    );
    let guard = 0;
    while (cur < fromS && guard++ < 5000) {
      cur = addMonthsClamped(cur, 2);
    }
    return cur;
  }

  if (freq === "yearly") {
    const rawM =
      expense.payment_month != null && expense.payment_month !== ""
        ? Number(expense.payment_month)
        : spent.getMonth() + 1;
    const monthIndex =
      Number.isFinite(rawM) && rawM >= 1 && rawM <= 12 ? rawM - 1 : spent.getMonth();
    let y = fromS.getFullYear();
    let cand = new Date(y, monthIndex, clampDayInMonth(y, monthIndex, day));
    if (cand < fromS) {
      y += 1;
      cand = new Date(y, monthIndex, clampDayInMonth(y, monthIndex, day));
    }
    return cand;
  }

  return null;
}

/**
 * Whole calendar days from start of `now` to start of next renewal.
 * @param {ExpenseLike} expense
 * @param {Date} [now]
 * @returns {number | null}
 */
export function daysUntilRenewal(expense, now = new Date()) {
  const next = nextRenewalDate(expense, now);
  if (!next) return null;
  const fromS = startOfLocalDay(now);
  const nextS = startOfLocalDay(next);
  return Math.round((nextS - fromS) / 86400000);
}

/**
 * Reminder tier: 30 / 15 / 5 days before renewal (with small windows so occasional visits still see them).
 * @param {number | null} daysUntil
 * @returns {30 | 15 | 5 | null}
 */
export function renewalReminderTier(daysUntil) {
  if (daysUntil == null || daysUntil < 0) return null;
  if (daysUntil <= 6) return 5;
  if (daysUntil >= 13 && daysUntil <= 17) return 15;
  if (daysUntil >= 28 && daysUntil <= 31) return 30;
  return null;
}
