export const CATEGORY_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "entertainment", label: "Entertainment" },
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
  { value: "education", label: "Education" },
  { value: "rent", label: "Rent" },
  { value: "mortgage", label: "Mortgage" },
  { value: "insurance", label: "Insurance" },
  { value: "subscription", label: "Subscription" },
];

export const FREQUENCY_OPTIONS = [
  { value: "once", label: "Once" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "bimonthly", label: "Bi-monthly" },
  { value: "yearly", label: "Yearly" },
];

export const FINANCIAL_INSTITUTION_OPTIONS = [
  { value: "bank", label: "Bank" },
  { value: "visa", label: "VISA" },
  { value: "mastercard", label: "Mastercard" },
  { value: "american_express", label: "American Express" },
];

export const EXPENSE_STATE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "cancel", label: "Cancel" },
];

const catLabels = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const finLabels = Object.fromEntries(FINANCIAL_INSTITUTION_OPTIONS.map((o) => [o.value, o.label]));
const freqLabels = Object.fromEntries(FREQUENCY_OPTIONS.map((o) => [o.value, o.label]));
const stateLabels = Object.fromEntries(EXPENSE_STATE_OPTIONS.map((o) => [o.value, o.label]));

export function formatCategory(value) {
  if (value == null) return "—";
  return catLabels[value] || value;
}

export function formatFinancialInstitution(value) {
  if (value == null) return "—";
  return finLabels[value] || value;
}

export function formatFrequency(value) {
  if (value == null) return "—";
  return freqLabels[value] || value;
}

export function formatExpenseState(value) {
  if (value == null || value === "") return "Active";
  return stateLabels[value] || (value === "cancel" ? "Cancel" : "Active");
}
