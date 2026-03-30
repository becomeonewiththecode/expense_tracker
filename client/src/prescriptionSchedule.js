/** Local start-of-day for date math (no UTC shift for YYYY-MM-DD). */
export function startOfLocalDay(d) {
  const x = d instanceof Date ? d : new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
}

/** Parse YYYY-MM-DD to local Date at midnight. */
export function parseLocalISODate(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1], 10);
  const mo = Number(m[2], 10) - 1;
  const d = Number(m[3], 10);
  return new Date(y, mo, d);
}

/**
 * Whole calendar days from start of today to start of nextRenewalDate.
 * Negative if next renewal is in the past.
 */
export function daysUntilPrescriptionRenewal(nextRenewalIso) {
  const target = parseLocalISODate(nextRenewalIso);
  if (!target) return null;
  const today = startOfLocalDay(new Date());
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

/** Show in 30-day reminder band: active items due within 30 days or recently overdue (≤14 days past). */
export function prescriptionNeedsReminder(row) {
  if (row.state === "cancel") return false;
  const days = daysUntilPrescriptionRenewal(row.next_renewal_date);
  if (days == null) return false;
  return days <= 30 && days >= -14;
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Months to add for each `*_months` renewal_period value (server allow-list). */
const RENEWAL_PERIOD_MONTH_DELTA = {
  one_month: 1,
  two_months: 2,
  three_months: 3,
  four_months: 4,
  five_months: 5,
  six_months: 6,
  seven_months: 7,
  eight_months: 8,
  nine_months: 9,
  ten_months: 10,
  eleven_months: 11,
};

/** Advance `next_renewal_date` by one renewal cycle (after refill or appointment). */
export function advanceNextRenewalDate(currentIso, renewalPeriod) {
  const d = parseLocalISODate(currentIso);
  if (!d) return null;
  const monthDelta = RENEWAL_PERIOD_MONTH_DELTA[renewalPeriod];
  if (monthDelta != null) {
    d.setMonth(d.getMonth() + monthDelta);
    return toIsoDate(d);
  }
  switch (renewalPeriod) {
    case "one_year":
      d.setFullYear(d.getFullYear() + 1);
      break;
    case "two_years":
      d.setFullYear(d.getFullYear() + 2);
      break;
    case "three_years":
      d.setFullYear(d.getFullYear() + 3);
      break;
    case "four_years":
      d.setFullYear(d.getFullYear() + 4);
      break;
    case "five_years":
      d.setFullYear(d.getFullYear() + 5);
      break;
    default:
      return null;
  }
  return toIsoDate(d);
}
