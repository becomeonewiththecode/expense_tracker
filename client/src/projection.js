import { formatCategory } from "./expenseOptions.js";

/** Average days per year for daily rate from annual totals. */
const DAYS_PER_YEAR = 365.25;

function normalizeFrequency(frequency) {
  const f = String(frequency ?? "monthly")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  return f === "bi-monthly" || f === "bi_monthly" ? "bimonthly" : f;
}

/**
 * @returns {{ recurringAnnual: number, oneTime: number }}
 */
export function rowAnnualParts(row) {
  const amt = Number(row.amount);
  if (!Number.isFinite(amt) || amt < 0) return { recurringAnnual: 0, oneTime: 0 };

  const norm = normalizeFrequency(row.frequency);
  if (norm === "once") return { recurringAnnual: 0, oneTime: amt };
  if (norm === "weekly") return { recurringAnnual: amt * 52, oneTime: 0 };
  if (norm === "bimonthly") return { recurringAnnual: amt * 6, oneTime: 0 };
  if (norm === "yearly") return { recurringAnnual: amt, oneTime: 0 };
  return { recurringAnnual: amt * 12, oneTime: 0 };
}

/**
 * Annualized recurring spend from each row’s amount × frequency.
 * `once` counts toward one-time total only (not run rate).
 */
export function computeSpendingProjection(items) {
  let recurringYearly = 0;
  let oneTimeTotal = 0;

  for (const row of items) {
    const { recurringAnnual, oneTime } = rowAnnualParts(row);
    recurringYearly += recurringAnnual;
    oneTimeTotal += oneTime;
  }

  return {
    recurring: {
      daily: recurringYearly / DAYS_PER_YEAR,
      monthly: recurringYearly / 12,
      yearly: recurringYearly,
    },
    oneTimeTotal,
  };
}

/**
 * Pie slices: recurring annual $ by category, plus optional "One-time" slice.
 * Values are comparable (annual $) for combined view.
 */
export function computeProjectionPieData(items) {
  const byCategory = new Map();
  let oneTimeTotal = 0;

  for (const row of items) {
    const { recurringAnnual, oneTime } = rowAnnualParts(row);
    oneTimeTotal += oneTime;
    if (recurringAnnual > 0) {
      const label = formatCategory(row.category);
      byCategory.set(label, (byCategory.get(label) || 0) + recurringAnnual);
    }
  }

  const data = [];
  for (const [name, value] of byCategory) {
    if (value > 0) data.push({ name, value });
  }
  if (oneTimeTotal > 0) {
    data.push({ name: "One-time", value: oneTimeTotal });
  }

  data.sort((a, b) => b.value - a.value);
  return data;
}

/** Expenses that contribute to a pie slice (category label or `"One-time"`). */
export function filterItemsForProjectionSlice(items, sliceName) {
  if (sliceName == null || sliceName === "" || !Array.isArray(items)) return [];
  if (sliceName === "One-time") {
    return items.filter((row) => rowAnnualParts(row).oneTime > 0);
  }
  return items.filter((row) => {
    const { recurringAnnual } = rowAnnualParts(row);
    return recurringAnnual > 0 && formatCategory(row.category) === sliceName;
  });
}

export function formatProjectionCurrency(n) {
  if (n == null || !Number.isFinite(n)) return "$0.00";
  return `$${Number(n).toFixed(2)}`;
}
