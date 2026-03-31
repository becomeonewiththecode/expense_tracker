const PAYMENT_PLAN_CATEGORIES = [
  "monthly_subscription",
  "peloton_bike",
  "peloton_gym_activity",
  "peloton_tread",
  "peloton_row",
  "peloton_guide",
  "accessories_apparel",
  "rrsp",
  "tfsa",
  "non_registered_investment_account",
  "online_certification",
  "professional_development",
  "books_courses",
  "emergency_fund",
  "high_interest_savings",
  "home_maintenance_repairs",
  "travel_vacation_fund",
  "healthcare_dental",
  "insurance_premiums",
  "charitable_donations",
  "gift_fund",
  "car_maintenance_repairs",
  "vehicle_registration_insurance",
  "electronics_technology",
  "subscriptions_memberships",
  "loans_debt_repayment",
  "misc",
];

const PAYMENT_SCHEDULES = [
  "weekly",
  "bi_weekly",
  "monthly",
  "quarterly",
  "annual",
  "one_time",
  "semi_annual",
];

const PRIORITY_LEVELS = ["essential", "important", "optional"];
const PAYMENT_PLAN_STATUSES = ["active", "pending", "paused", "completed"];
const ACCOUNT_TYPES = ["checking", "savings", "credit_card", "investment", "cash"];
const PAYMENT_METHODS = ["auto_pay", "manual", "direct_debit", "pre_authorized_payment"];
const INSTITUTIONS = [
  "visa",
  "american_express",
  "mastercard",
  "td_bank",
  "rbc",
  "scotiabank",
  "bmo",
  "cibc",
  "tangerine",
  "simplii_financial",
  "eq_bank",
  "wealthsimple",
  "questrade",
  "other",
];
const PAYMENT_PLAN_TAGS = [
  "fixed_expense",
  "variable_expense",
  "discretionary",
  "investment",
  "debt",
  "savings_goal",
  "tax_deductible",
  "recurring",
  "seasonal",
];
const PAYMENT_PLAN_FREQUENCIES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "ongoing",
  "six_months",
  "one_year",
  "two_years",
  "three_years",
  "five_years",
  "until_paid_off",
  "custom_end_date",
];

function norm(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function parseFrom(allowList, value) {
  const x = norm(value);
  return allowList.includes(x) ? x : null;
}

export function parsePaymentPlanCategory(value) {
  return parseFrom(PAYMENT_PLAN_CATEGORIES, value);
}
export function parsePaymentSchedule(value) {
  return parseFrom(PAYMENT_SCHEDULES, value);
}
export function parsePriorityLevel(value) {
  return parseFrom(PRIORITY_LEVELS, value);
}
export function parsePaymentPlanStatus(value) {
  return parseFrom(PAYMENT_PLAN_STATUSES, value);
}
export function parseAccountType(value) {
  return parseFrom(ACCOUNT_TYPES, value);
}
export function parsePaymentMethod(value) {
  return parseFrom(PAYMENT_METHODS, value);
}
export function parseInstitution(value) {
  return parseFrom(INSTITUTIONS, value);
}
export function parsePaymentPlanTag(value) {
  return parseFrom(PAYMENT_PLAN_TAGS, value);
}
export function parsePaymentPlanFrequency(value) {
  return parseFrom(PAYMENT_PLAN_FREQUENCIES, value);
}

export const PAYMENT_PLAN_CATEGORY_ERROR = `Invalid category (use ${PAYMENT_PLAN_CATEGORIES.join(", ")})`;
export const PAYMENT_SCHEDULE_ERROR = `Invalid payment_schedule (use ${PAYMENT_SCHEDULES.join(", ")})`;
export const PRIORITY_LEVEL_ERROR = `Invalid priority_level (use ${PRIORITY_LEVELS.join(", ")})`;
export const PAYMENT_PLAN_STATUS_ERROR = `Invalid status (use ${PAYMENT_PLAN_STATUSES.join(", ")})`;
export const ACCOUNT_TYPE_ERROR = `Invalid account_type (use ${ACCOUNT_TYPES.join(", ")})`;
export const PAYMENT_METHOD_ERROR = `Invalid payment_method (use ${PAYMENT_METHODS.join(", ")})`;
export const INSTITUTION_ERROR = `Invalid institution (use ${INSTITUTIONS.join(", ")})`;
export const PAYMENT_PLAN_TAG_ERROR = `Invalid tag (use ${PAYMENT_PLAN_TAGS.join(", ")})`;
export const PAYMENT_PLAN_FREQUENCY_ERROR = `Invalid frequency (use ${PAYMENT_PLAN_FREQUENCIES.join(", ")})`;
