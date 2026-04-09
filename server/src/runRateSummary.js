/**
 * Annualized recurring amounts (matches client projection.js) for server-side summaries.
 */

const DAYS_PER_YEAR = 365.25;

function normalizeFrequency(frequency) {
  const f = String(frequency ?? "monthly")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  return f === "bi-monthly" || f === "bi_monthly" ? "bimonthly" : f;
}

/** Active expenses only; excludes payment_plan category (those are counted via payment_plans table to avoid duplicates). */
export function expenseRowAnnualParts(row) {
  if (String(row.state ?? "active") !== "active") return { recurringAnnual: 0, oneTime: 0 };
  if (String(row.category) === "payment_plan") return { recurringAnnual: 0, oneTime: 0 };
  const amt = Number(row.amount);
  if (!Number.isFinite(amt) || amt < 0) return { recurringAnnual: 0, oneTime: 0 };

  const norm = normalizeFrequency(row.frequency);
  if (norm === "once") return { recurringAnnual: 0, oneTime: amt };
  if (norm === "weekly") return { recurringAnnual: amt * 52, oneTime: 0 };
  if (norm === "bimonthly") return { recurringAnnual: amt * 24, oneTime: 0 };
  if (norm === "yearly") return { recurringAnnual: amt, oneTime: 0 };
  return { recurringAnnual: amt * 12, oneTime: 0 };
}

const PRESCRIPTION_PERIOD_MONTHS = {
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

export function prescriptionRenewalsPerYear(renewalPeriod) {
  const m = PRESCRIPTION_PERIOD_MONTHS[renewalPeriod];
  if (m != null) return 12 / m;
  switch (renewalPeriod) {
    case "one_year":
      return 1;
    case "two_years":
      return 1 / 2;
    case "three_years":
      return 1 / 3;
    case "four_years":
      return 1 / 4;
    case "five_years":
      return 1 / 5;
    default:
      return 0;
  }
}

export function prescriptionRowAnnualParts(row) {
  if (String(row.state ?? "active") !== "active") return { recurringAnnual: 0, oneTime: 0 };
  const amt = Number(row.amount);
  if (!Number.isFinite(amt) || amt < 0) return { recurringAnnual: 0, oneTime: 0 };
  const perYear = amt * prescriptionRenewalsPerYear(row.renewal_period);
  return { recurringAnnual: perYear, oneTime: 0 };
}

export function paymentPlanRowAnnualParts(row) {
  if (String(row.status ?? "").toLowerCase() !== "active") return { recurringAnnual: 0, oneTime: 0 };
  const amt = Number(row.amount);
  if (!Number.isFinite(amt) || amt < 0) return { recurringAnnual: 0, oneTime: 0 };
  const count = Number.parseInt(String(row.frequency ?? ""), 10);
  if (Number.isInteger(count) && count > 0) {
    return { recurringAnnual: amt * count, oneTime: 0 };
  }
  switch (String(row.payment_schedule ?? "").toLowerCase()) {
    case "one_time":
      return { recurringAnnual: 0, oneTime: amt };
    case "weekly":
      return { recurringAnnual: amt * 52, oneTime: 0 };
    case "bi_weekly":
      return { recurringAnnual: amt * 26, oneTime: 0 };
    case "quarterly":
      return { recurringAnnual: amt * 4, oneTime: 0 };
    case "semi_annual":
      return { recurringAnnual: amt * 2, oneTime: 0 };
    case "annual":
      return { recurringAnnual: amt, oneTime: 0 };
    case "monthly":
    default:
      return { recurringAnnual: amt * 12, oneTime: 0 };
  }
}

export function incomeRowAnnualParts(row) {
  const amt = Number(row.amount);
  if (!Number.isFinite(amt) || amt < 0) return { recurringAnnual: 0, oneTime: 0 };
  const norm = normalizeFrequency(row.frequency);
  if (norm === "once") return { recurringAnnual: 0, oneTime: amt };
  if (norm === "weekly") return { recurringAnnual: amt * 52, oneTime: 0 };
  if (norm === "bimonthly") return { recurringAnnual: amt * 24, oneTime: 0 };
  if (norm === "yearly") return { recurringAnnual: amt, oneTime: 0 };
  return { recurringAnnual: amt * 12, oneTime: 0 };
}

function sumExpenseBuckets(expenseRows) {
  let recurringYearlyNonRenewal = 0;
  let recurringYearlyRenewals = 0;
  let oneTimeTotal = 0;
  for (const row of expenseRows) {
    if (String(row.category) === "payment_plan") continue;
    const { recurringAnnual, oneTime } = expenseRowAnnualParts(row);
    oneTimeTotal += oneTime;
    if (row.category === "renewal") recurringYearlyRenewals += recurringAnnual;
    else recurringYearlyNonRenewal += recurringAnnual;
  }
  return {
    recurringYearlyNonRenewal,
    recurringYearlyRenewals,
    recurringYearlyExpenses: recurringYearlyNonRenewal + recurringYearlyRenewals,
    oneTimeTotal,
  };
}

function sumPrescriptions(rows) {
  let recurringYearly = 0;
  for (const row of rows) {
    recurringYearly += prescriptionRowAnnualParts(row).recurringAnnual;
  }
  return recurringYearly;
}

function sumPaymentPlans(rows) {
  let recurringYearly = 0;
  let oneTimeTotal = 0;
  for (const row of rows) {
    const { recurringAnnual, oneTime } = paymentPlanRowAnnualParts(row);
    recurringYearly += recurringAnnual;
    oneTimeTotal += oneTime;
  }
  return { recurringYearly, oneTimeTotal };
}

function sumIncome(rows) {
  let recurringYearly = 0;
  let oneTimeTotal = 0;
  for (const row of rows) {
    const { recurringAnnual, oneTime } = incomeRowAnnualParts(row);
    recurringYearly += recurringAnnual;
    oneTimeTotal += oneTime;
  }
  return { recurringYearly, oneTimeTotal };
}

/**
 * @param {{
 *   expenseRows: object[],
 *   prescriptionRows: object[],
 *   paymentPlanRows: object[],
 *   incomeRows: object[],
 * }} p
 */
export function buildRunRateVsIncomeSummary(p) {
  const { expenseRows, prescriptionRows, paymentPlanRows, incomeRows } = p;

  const exp = sumExpenseBuckets(expenseRows);
  const rxYearly = sumPrescriptions(prescriptionRows);
  const plan = sumPaymentPlans(paymentPlanRows);
  const inc = sumIncome(incomeRows);

  const obligationsYearly =
    exp.recurringYearlyExpenses + rxYearly + plan.recurringYearly;
  const obligationsMonthly = obligationsYearly / 12;

  const incomeMonthly = inc.recurringYearly / 12;
  const hasIncomeEntries = incomeRows.length > 0;
  const hasRecurringIncome = incomeMonthly > 0;
  const netMonthly = incomeMonthly - obligationsMonthly;
  const overspending =
    hasRecurringIncome && obligationsMonthly > incomeMonthly + 0.005;

  return {
    hasIncomeEntries,
    hasRecurringIncome,
    income: {
      recurringMonthly: incomeMonthly,
      recurringYearly: inc.recurringYearly,
      oneTimeTotal: inc.oneTimeTotal,
    },
    obligations: {
      expensesMonthly: exp.recurringYearlyExpenses / 12,
      renewalsMonthly: exp.recurringYearlyRenewals / 12,
      otherExpensesMonthly: exp.recurringYearlyNonRenewal / 12,
      prescriptionsMonthly: rxYearly / 12,
      paymentPlansMonthly: plan.recurringYearly / 12,
      totalMonthly: obligationsMonthly,
      expensesOneTimeTotal: exp.oneTimeTotal,
      paymentPlansOneTimeTotal: plan.oneTimeTotal,
    },
    netMonthly,
    overspending,
    gapMonthly: overspending ? obligationsMonthly - incomeMonthly : null,
  };
}

export { DAYS_PER_YEAR };
