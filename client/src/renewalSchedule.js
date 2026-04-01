/**
 * Next renewal / anniversary dates from expense frequency and transaction date (`spent_at`).
 * Day-of-month and calendar month for recurring math follow the posted date (same rules as the API).
 */

/** @typedef {{ id?: number, frequency?: string, spent_at?: string, category?: string, description?: string }} ExpenseLike */

/**
 * Calendar `YYYY-MM-DD` from API `spent_at` (matches server `spentAtToIsoDate`).
 * Used so renewal math does not depend on how dates were serialized.
 */
export function spentAtToIsoDateString(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

function normalizeFrequency(frequency) {
  const f = String(frequency ?? "monthly")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  return f === "bi-monthly" || f === "bi_monthly" ? "bimonthly" : f;
}

function parseLocalDate(raw) {
  const iso = spentAtToIsoDateString(raw);
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7), 10) - 1;
  const d = Number(iso.slice(8, 10), 10);
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
  const day = Math.min(30, Math.max(1, spent.getDate()));

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
    const day2 = expense.payment_day_2 != null ? Math.min(30, Math.max(1, Number(expense.payment_day_2))) : null;
    const days = [day];
    if (day2 != null && day2 !== day) days.push(day2);
    days.sort((a, b) => a - b);

    let y = fromS.getFullYear();
    let m = fromS.getMonth();
    for (let guard = 0; guard < 60; guard++) {
      for (const d of days) {
        const cand = new Date(y, m, clampDayInMonth(y, m, d));
        if (cand >= fromS) return cand;
      }
      m++;
      if (m > 11) { m = 0; y++; }
    }
    return null;
  }

  if (freq === "yearly") {
    const monthIndex = spent.getMonth();
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
 * Reminder tier: three bands before renewal (with windows so occasional visits still see them).
 * - Final two weeks (tier 5): exact day count in the UI
 * - ~2–3 weeks out (tier 15): “about 15 days” or similar
 * - ~1 month out (tier 30): “about 30 days”
 * Bands are contiguous so values like 12 days are not dropped between narrow slices.
 * @param {number | null} daysUntil
 * @returns {30 | 15 | 5 | null}
 */
export function renewalReminderTier(daysUntil) {
  if (daysUntil == null || daysUntil < 0) return null;
  if (daysUntil <= 14) return 5;
  if (daysUntil <= 24) return 15;
  if (daysUntil <= 40) return 30;
  return null;
}

/** Tier 30 starts at this many days until renewal (see `renewalReminderTier`). */
const EARLY_REMINDER_TIER_MIN_DAYS = 25;

/**
 * After a renewal calendar day, the next computed `nextRenewalDate` can land in the 25–40 day "month out"
 * band immediately. Hide that band until this many days after the *previous* occurrence so the row stays
 * off the list until the next renewal is closer (tiers 15 and 5 still apply when nearer).
 */
const DAYS_AFTER_RENEWAL_TO_SUPPRESS_EARLY_TIER = 14;

function stepRenewalBackOnePeriod(expense, anchorStartOfDay) {
  const freq = normalizeFrequency(expense.frequency);
  const s = startOfLocalDay(anchorStartOfDay);
  if (freq === "weekly") {
    return startOfLocalDay(new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7));
  }
  if (freq === "monthly") return addMonthsClamped(s, -1);
  if (freq === "bimonthly") {
    const day1 = expense.payment_day != null ? Math.min(30, Math.max(1, Number(expense.payment_day))) : s.getDate();
    const day2 = expense.payment_day_2 != null ? Math.min(30, Math.max(1, Number(expense.payment_day_2))) : null;
    const days = [day1];
    if (day2 != null && day2 !== day1) days.push(day2);
    days.sort((a, b) => b - a);
    let y = s.getFullYear();
    let m = s.getMonth();
    for (let guard = 0; guard < 60; guard++) {
      for (const d of days) {
        const cand = new Date(y, m, clampDayInMonth(y, m, d));
        if (cand < s) return cand;
      }
      m--;
      if (m < 0) { m = 11; y--; }
    }
    return addMonthsClamped(s, -1);
  }
  if (freq === "yearly") return addMonthsClamped(s, -12);
  return null;
}

/**
 * The renewal occurrence immediately before `nextRenewalDate(expense, now)` (same cycle rules).
 * @param {ExpenseLike} expense
 * @param {Date} [now]
 * @returns {Date | null}
 */
export function previousRenewalBeforeDisplayedNext(expense, now = new Date()) {
  const next = nextRenewalDate(expense, now);
  if (!next) return null;
  return stepRenewalBackOnePeriod(expense, next);
}

/**
 * True when the ~25–40 day reminder band should not show yet because a renewal just passed
 * (row stays hidden until closer to the next charge).
 * @param {ExpenseLike} expense
 * @param {Date} now
 * @param {number} daysUntil from `daysUntilRenewal`
 */
export function isEarlyRenewalTierSuppressedAfterRecentOccurrence(expense, now, daysUntil) {
  if (daysUntil == null || daysUntil < EARLY_REMINDER_TIER_MIN_DAYS) return false;
  const prior = previousRenewalBeforeDisplayedNext(expense, now);
  if (!prior) return false;
  const fromS = startOfLocalDay(now);
  const priorS = startOfLocalDay(prior);
  const daysSincePrior = Math.round((fromS.getTime() - priorS.getTime()) / 86400000);
  return (
    daysSincePrior >= 1 &&
    daysSincePrior <= DAYS_AFTER_RENEWAL_TO_SUPPRESS_EARLY_TIER
  );
}
