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
  { value: "renewal", label: "Renewal" },
  { value: "payment_plan", label: "Payment Plan" },
];

/** Shown when category is Renewal (import, expenses, renewals page). */
export const RENEWAL_KIND_OPTIONS = [
  { value: "appliances", label: "Appliances" },
  { value: "washer", label: "Washer" },
  { value: "dryer", label: "Dryer" },
  { value: "domain_names", label: "Domain names" },
  { value: "car_insurance", label: "Car insurance" },
  { value: "software_subscriptions", label: "Software subscriptions" },
  { value: "gym_membership", label: "Gym membership" },
  { value: "professional_certifications", label: "Professional certifications" },
  { value: "magazine_subscriptions", label: "Magazine subscriptions" },
  { value: "online_education", label: "Online education" },
  { value: "web_hosting_services", label: "Web hosting services" },
  { value: "home_warranty_plans", label: "Home warranty plans" },
  { value: "security_system_monitoring", label: "Security system monitoring" },
  { value: "vpn_subscriptions", label: "VPN subscriptions" },
  { value: "cloud_storage_services", label: "Cloud storage services" },
  { value: "business_licenses", label: "Business licenses" },
  { value: "pet_insurance", label: "Pet insurance" },
  { value: "parking_permits", label: "Parking permits" },
  { value: "streaming_services", label: "Streaming services" },
  { value: "credit_card_annual_fees", label: "Credit card annual fees" },
  { value: "roadside_assistance_plans", label: "Roadside assistance plans" },
  { value: "home_security_cameras", label: "Home security cameras" },
  { value: "equipment_maintenance_contracts", label: "Equipment maintenance contracts" },
  { value: "tax_preparation_software", label: "Tax preparation software" },
  { value: "legal_service_plans", label: "Legal service plans" },
  { value: "medical_alert_systems", label: "Medical alert systems" },
  { value: "lawn_care_services", label: "Lawn care services" },
  { value: "pest_control_contracts", label: "Pest control contracts" },
  { value: "identity_theft_protection", label: "Identity theft protection" },
  { value: "extended_warranties", label: "Extended warranties" },
  { value: "timeshare_fees", label: "Timeshare fees" },
  { value: "professional_association_dues", label: "Professional association dues" },
  { value: "safe_deposit_box_rental", label: "Safe deposit box rental" },
  { value: "backup_power_generator_service", label: "Backup power generator service" },
  { value: "water_softener_salt_delivery", label: "Water softener salt delivery" },
  { value: "propane_tank_refills", label: "Propane tank refills" },
  { value: "air_filter_subscription_services", label: "Air filter subscription services" },
  { value: "ring_doorbell", label: "Ring Doorbell" },
  { value: "hoa_fees", label: "HOA fees" },
  { value: "pool_maintenance_contracts", label: "Pool maintenance contracts" },
  { value: "septic_tank_pumping_service", label: "Septic tank pumping service" },
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
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
];

const catLabels = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));
const renewalKindLabels = Object.fromEntries(RENEWAL_KIND_OPTIONS.map((o) => [o.value, o.label]));
const finLabels = Object.fromEntries(FINANCIAL_INSTITUTION_OPTIONS.map((o) => [o.value, o.label]));
const freqLabels = Object.fromEntries(FREQUENCY_OPTIONS.map((o) => [o.value, o.label]));
const stateLabels = Object.fromEntries(EXPENSE_STATE_OPTIONS.map((o) => [o.value, o.label]));

export function formatCategory(value) {
  if (value == null) return "—";
  return catLabels[value] || value;
}

export function formatRenewalKind(value) {
  if (value == null || value === "") return "—";
  return renewalKindLabels[value] || value;
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
  const key = value === "cancel" ? "cancelled" : value;
  return stateLabels[key] || "Active";
}
