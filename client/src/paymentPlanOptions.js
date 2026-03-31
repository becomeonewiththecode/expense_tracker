function labelize(v) {
  return String(v || "")
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

function makeOptions(entries) {
  return entries.map(([value, label]) => ({ value, label }));
}

const CATEGORY_ENTRIES = [
  ["monthly_subscription", "Monthly Subscription"],
  ["peloton_bike", "Peloton Bike"],
  ["peloton_gym_activity", "Peloton Gym activity"],
  ["peloton_tread", "Peloton Tread"],
  ["peloton_row", "Peloton Row"],
  ["peloton_guide", "Peloton Guide"],
  ["accessories_apparel", "Accessories & Apparel"],
  ["rrsp", "RRSP"],
  ["tfsa", "TFSA"],
  ["non_registered_investment_account", "Non-Registered Investment Account"],
  ["online_certification", "Online Certification"],
  ["professional_development", "Professional Development"],
  ["books_courses", "Books & Courses"],
  ["emergency_fund", "Emergency Fund"],
  ["high_interest_savings", "High-Interest Savings"],
  ["home_maintenance_repairs", "Home Maintenance & Repairs"],
  ["travel_vacation_fund", "Travel & Vacation Fund"],
  ["healthcare_dental", "Healthcare & Dental"],
  ["insurance_premiums", "Insurance Premiums"],
  ["charitable_donations", "Charitable Donations"],
  ["gift_fund", "Gift Fund"],
  ["car_maintenance_repairs", "Car Maintenance & Repairs"],
  ["vehicle_registration_insurance", "Vehicle Registration & Insurance"],
  ["electronics_technology", "Electronics & Technology"],
  ["subscriptions_memberships", "Subscriptions & Memberships"],
  ["loans_debt_repayment", "Loans & Debt Repayment"],
  ["misc", "Misc"],
];

const SCHEDULE_ENTRIES = [
  ["weekly", "Weekly"],
  ["bi_weekly", "Bi-weekly"],
  ["monthly", "Monthly"],
  ["quarterly", "Quarterly"],
  ["annual", "Annual"],
  ["one_time", "One-time"],
  ["semi_annual", "Semi-annual"],
];

const PRIORITY_ENTRIES = [
  ["essential", "Essential"],
  ["important", "Important"],
  ["optional", "Optional"],
];

const STATUS_ENTRIES = [
  ["active", "Active"],
  ["pending", "Pending"],
  ["paused", "Paused"],
  ["completed", "Completed"],
];

const ACCOUNT_TYPE_ENTRIES = [
  ["checking", "Checking"],
  ["savings", "Savings"],
  ["credit_card", "Credit Card"],
  ["investment", "Investment"],
  ["cash", "Cash"],
];

const PAYMENT_METHOD_ENTRIES = [
  ["auto_pay", "Auto-pay"],
  ["manual", "Manual"],
  ["direct_debit", "Direct Debit"],
  ["pre_authorized_payment", "Pre-authorized Payment"],
];

const INSTITUTION_ENTRIES = [
  ["visa", "VISA"],
  ["american_express", "American Express"],
  ["mastercard", "Mastercard"],
  ["td_bank", "TD Bank"],
  ["rbc", "RBC"],
  ["scotiabank", "Scotiabank"],
  ["bmo", "BMO"],
  ["cibc", "CIBC"],
  ["tangerine", "Tangerine"],
  ["simplii_financial", "Simplii Financial"],
  ["eq_bank", "EQ Bank"],
  ["wealthsimple", "Wealthsimple"],
  ["questrade", "Questrade"],
  ["other", "Other"],
];

const TAG_ENTRIES = [
  ["fixed_expense", "Fixed Expense"],
  ["variable_expense", "Variable Expense"],
  ["discretionary", "Discretionary"],
  ["investment", "Investment"],
  ["debt", "Debt"],
  ["savings_goal", "Savings Goal"],
  ["tax_deductible", "Tax-Deductible"],
  ["recurring", "Recurring"],
  ["seasonal", "Seasonal"],
];

const FREQUENCY_ENTRIES = [
  ["1", "1"],
  ["2", "2"],
  ["3", "3"],
  ["4", "4"],
  ["5", "5"],
  ["6", "6"],
  ["ongoing", "Ongoing"],
  ["six_months", "6 months"],
  ["one_year", "1 year"],
  ["two_years", "2 years"],
  ["three_years", "3 years"],
  ["five_years", "5 years"],
  ["until_paid_off", "Until paid off"],
  ["custom_end_date", "Custom end date"],
];

export const PAYMENT_PLAN_CATEGORY_OPTIONS = makeOptions(CATEGORY_ENTRIES);
export const PAYMENT_PLAN_SCHEDULE_OPTIONS = makeOptions(SCHEDULE_ENTRIES);
export const PAYMENT_PLAN_PRIORITY_OPTIONS = makeOptions(PRIORITY_ENTRIES);
export const PAYMENT_PLAN_STATUS_OPTIONS = makeOptions(STATUS_ENTRIES);
export const PAYMENT_PLAN_ACCOUNT_TYPE_OPTIONS = makeOptions(ACCOUNT_TYPE_ENTRIES);
export const PAYMENT_PLAN_METHOD_OPTIONS = makeOptions(PAYMENT_METHOD_ENTRIES);
export const PAYMENT_PLAN_INSTITUTION_OPTIONS = makeOptions(INSTITUTION_ENTRIES);
export const PAYMENT_PLAN_TAG_OPTIONS = makeOptions(TAG_ENTRIES);
export const PAYMENT_PLAN_FREQUENCY_OPTIONS = makeOptions(FREQUENCY_ENTRIES);

function lookup(options, value) {
  const found = options.find((o) => o.value === value);
  return found ? found.label : labelize(value);
}

export function formatPaymentPlanCategory(v) {
  return lookup(PAYMENT_PLAN_CATEGORY_OPTIONS, v);
}
export function formatPaymentPlanSchedule(v) {
  return lookup(PAYMENT_PLAN_SCHEDULE_OPTIONS, v);
}
export function formatPaymentPlanPriority(v) {
  return lookup(PAYMENT_PLAN_PRIORITY_OPTIONS, v);
}
export function formatPaymentPlanStatus(v) {
  return lookup(PAYMENT_PLAN_STATUS_OPTIONS, v);
}
export function formatPaymentPlanAccountType(v) {
  return lookup(PAYMENT_PLAN_ACCOUNT_TYPE_OPTIONS, v);
}
export function formatPaymentPlanMethod(v) {
  return lookup(PAYMENT_PLAN_METHOD_OPTIONS, v);
}
export function formatPaymentPlanInstitution(v) {
  return lookup(PAYMENT_PLAN_INSTITUTION_OPTIONS, v);
}
export function formatPaymentPlanTag(v) {
  return lookup(PAYMENT_PLAN_TAG_OPTIONS, v);
}
export function formatPaymentPlanFrequency(v) {
  return lookup(PAYMENT_PLAN_FREQUENCY_OPTIONS, v);
}
