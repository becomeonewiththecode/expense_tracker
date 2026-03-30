export const PRESCRIPTION_CATEGORY_OPTIONS = [
  { value: "medical", label: "Medical" },
  { value: "dental", label: "Dental" },
  { value: "vision", label: "Vision" },
  { value: "supplements", label: "Supplements" },
  { value: "equipment", label: "Equipment" },
];

/** Monthly increments first (1–11 months), then years. Order matches server `PRESCRIPTION_RENEWAL_PERIODS`. */
export const PRESCRIPTION_RENEWAL_PERIOD_OPTIONS = [
  { value: "one_month", label: "1 month" },
  { value: "two_months", label: "2 months" },
  { value: "three_months", label: "3 months" },
  { value: "four_months", label: "4 months" },
  { value: "five_months", label: "5 months" },
  { value: "six_months", label: "6 months" },
  { value: "seven_months", label: "7 months" },
  { value: "eight_months", label: "8 months" },
  { value: "nine_months", label: "9 months" },
  { value: "ten_months", label: "10 months" },
  { value: "eleven_months", label: "11 months" },
  { value: "one_year", label: "1 year" },
  { value: "two_years", label: "2 years" },
  { value: "three_years", label: "3 years" },
  { value: "four_years", label: "4 years" },
  { value: "five_years", label: "5 years" },
];

const categoryLabels = Object.fromEntries(
  PRESCRIPTION_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
);
const periodLabels = Object.fromEntries(
  PRESCRIPTION_RENEWAL_PERIOD_OPTIONS.map((o) => [o.value, o.label])
);

export function formatPrescriptionCategory(value) {
  return categoryLabels[value] || value || "—";
}

export function formatRenewalPeriod(value) {
  return periodLabels[value] || value || "—";
}
