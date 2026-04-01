/** Prescription categories (health / supplies). */
export const PRESCRIPTION_CATEGORIES = [
  "medical",
  "dental",
  "vision",
  "supplements",
  "equipment",
];

/** Irregular renewal cadence (display + validation). Monthly steps 1–11 months, then multi-year. */
export const PRESCRIPTION_RENEWAL_PERIODS = [
  "one_month",
  "two_months",
  "three_months",
  "four_months",
  "five_months",
  "six_months",
  "seven_months",
  "eight_months",
  "nine_months",
  "ten_months",
  "eleven_months",
  "one_year",
  "two_years",
  "three_years",
  "four_years",
  "five_years",
];

export const PRESCRIPTION_CATEGORY_ERROR = `Invalid category (use ${PRESCRIPTION_CATEGORIES.join(", ")})`;
export const PRESCRIPTION_RENEWAL_PERIOD_ERROR = `Invalid renewal_period (use ${PRESCRIPTION_RENEWAL_PERIODS.join(", ")})`;
export const PRESCRIPTION_STATE_ERROR = "Invalid state (use active, paused, cancelled)";

const PRESCRIPTION_STATES = ["active", "paused", "cancelled"];

export function parsePrescriptionCategory(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return PRESCRIPTION_CATEGORIES.includes(s) ? s : null;
}

export function parseRenewalPeriod(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return PRESCRIPTION_RENEWAL_PERIODS.includes(s) ? s : null;
}

/** DB uses `cancelled`; `cancel` is still accepted as a legacy request alias. */
export function parsePrescriptionState(value) {
  if (value == null || value === "") return "active";
  const s = String(value).trim().toLowerCase();
  const normalized = s === "cancel" ? "cancelled" : s;
  return PRESCRIPTION_STATES.includes(normalized) ? normalized : null;
}

/** Value for `prescriptions[].state` in backup JSON; aligns with DB and GET /api/prescriptions. */
export function normalizePrescriptionStateForBackup(value) {
  return parsePrescriptionState(value) ?? "active";
}

export function parseIsoDate(value) {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (m) return m[1];
  return null;
}
