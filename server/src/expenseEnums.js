export const CATEGORIES = new Set([
  "home",
  "entertainment",
  "personal",
  "business",
  "education",
  "rent",
  "mortgage",
  "insurance",
  "subscription",
]);

export const FINANCIAL_INSTITUTIONS = new Set([
  "bank",
  "visa",
  "mastercard",
  "american_express",
]);

export const FREQUENCIES = new Set(["once", "weekly", "monthly", "bimonthly", "yearly"]);

/** Day of month (1–30) when a recurring payment typically posts; optional metadata beside `spent_at`. */
export const PAYMENT_DAY_ERROR =
  "Payment day must be a whole number from 1 to 30, or empty for not set";

/** @param {unknown} raw */
export function tryParsePaymentDay(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (String(raw).trim() === "") {
    return { ok: true, value: null };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 30) {
    return { ok: false };
  }
  return { ok: true, value: n };
}

/** Calendar month (1–12) for recurring expenses; optional metadata beside `payment_day`. */
export const PAYMENT_MONTH_ERROR =
  "Payment month must be a whole number from 1 to 12, or empty for not set";

/** @param {unknown} raw */
export function tryParsePaymentMonth(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (String(raw).trim() === "") {
    return { ok: true, value: null };
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 12) {
    return { ok: false };
  }
  return { ok: true, value: n };
}

export const CATEGORY_ERROR =
  "Invalid category (use home, entertainment, personal, business, education, rent, mortgage, insurance, subscription)";

export function parseCategory(value) {
  const s = String(value ?? "personal")
    .toLowerCase()
    .trim();
  return CATEGORIES.has(s) ? s : null;
}

export function parseFinancialInstitution(value) {
  const s = String(value ?? "bank")
    .toLowerCase()
    .trim();
  return FINANCIAL_INSTITUTIONS.has(s) ? s : null;
}

export function parseFrequency(value) {
  const s = String(value ?? "monthly")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  const norm = s === "bi-monthly" || s === "bi_monthly" ? "bimonthly" : s;
  return FREQUENCIES.has(norm) ? norm : null;
}
