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
];

export const FINANCIAL_INSTITUTION_OPTIONS = [
  { value: "bank", label: "Bank" },
  { value: "visa", label: "VISA" },
  { value: "mastercard", label: "Mastercard" },
  { value: "american_express", label: "American Express" },
];

/** Day of month (1–30) when the payment typically posts; optional. */
export const PAYMENT_DAY_OPTIONS = [
  { value: "", label: "—" },
  ...Array.from({ length: 30 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

/** Same values as {@link PAYMENT_DAY_OPTIONS}; first option fixes payment day from each statement line date. */
export const IMPORT_PAYMENT_DAY_OPTIONS = [
  { value: "", label: "From statement" },
  ...Array.from({ length: 30 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

const catLabels = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const finLabels = Object.fromEntries(FINANCIAL_INSTITUTION_OPTIONS.map((o) => [o.value, o.label]));
const freqLabels = Object.fromEntries(FREQUENCY_OPTIONS.map((o) => [o.value, o.label]));

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

export function formatPaymentDay(value) {
  if (value == null || value === "") return "—";
  return String(value);
}
