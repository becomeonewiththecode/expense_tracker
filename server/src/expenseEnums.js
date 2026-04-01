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
  "renewal",
  "payment_plan",
]);

/** Sub-types for `category === "renewal"` (odd-interval renewals). */
export const RENEWAL_KINDS = new Set([
  "appliances",
  "washer",
  "dryer",
  "domain_names",
  "car_insurance",
  "software_subscriptions",
  "gym_membership",
  "professional_certifications",
  "magazine_subscriptions",
  "online_education",
  "web_hosting_services",
  "home_warranty_plans",
  "security_system_monitoring",
  "vpn_subscriptions",
  "cloud_storage_services",
  "business_licenses",
  "pet_insurance",
  "parking_permits",
  "streaming_services",
  "credit_card_annual_fees",
  "roadside_assistance_plans",
  "home_security_cameras",
  "equipment_maintenance_contracts",
  "tax_preparation_software",
  "legal_service_plans",
  "medical_alert_systems",
  "lawn_care_services",
  "pest_control_contracts",
  "identity_theft_protection",
  "extended_warranties",
  "timeshare_fees",
  "professional_association_dues",
  "safe_deposit_box_rental",
  "backup_power_generator_service",
  "water_softener_salt_delivery",
  "propane_tank_refills",
  "air_filter_subscription_services",
  "ring_doorbell",
  "hoa_fees",
  "pool_maintenance_contracts",
  "septic_tank_pumping_service",
]);

export const FINANCIAL_INSTITUTIONS = new Set([
  "bank",
  "visa",
  "mastercard",
  "american_express",
]);

export const FREQUENCIES = new Set(["once", "weekly", "monthly", "bimonthly", "yearly"]);

export const EXPENSE_STATES = new Set(["active", "paused", "cancelled"]);

export const STATE_ERROR = "Invalid state (use active, paused, cancelled)";

/** Normalize DB or ISO string to `YYYY-MM-DD` for metadata derivation. */
export function spentAtToIsoDate(v) {
  if (v == null) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}

/**
 * `payment_day` (1–30, cap 30) and `payment_month` (1–12) derived from transaction date.
 * Stored denormalized for exports and renewal logic; do not accept separate client values.
 */
export function paymentMetaFromSpentAt(spentAt) {
  const iso = spentAtToIsoDate(spentAt);
  if (!iso) return { payment_day: null, payment_month: null };
  const day = Number.parseInt(iso.slice(8, 10), 10);
  const month = Number.parseInt(iso.slice(5, 7), 10);
  const payment_day = Number.isFinite(day) ? Math.min(30, Math.max(1, day)) : null;
  const payment_month =
    Number.isFinite(month) && month >= 1 && month <= 12 ? month : null;
  return { payment_day, payment_month };
}

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
  "Invalid category (use home, entertainment, personal, business, education, rent, mortgage, insurance, subscription, renewal, payment_plan)";

export const RENEWAL_KIND_ERROR = "Invalid renewal_kind (unknown renewal type)";

export const RENEWAL_KIND_REQUIRED =
  "Renewal category requires renewal_kind (choose a renewal type such as appliances or domain_names)";

export function parseCategory(value) {
  const s = String(value ?? "personal")
    .toLowerCase()
    .trim();
  return CATEGORIES.has(s) ? s : null;
}

/** @param {unknown} value */
export function parseRenewalKind(value) {
  const s = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");
  return RENEWAL_KINDS.has(s) ? s : null;
}

/** @param {unknown} value */
export function parseWebsite(value) {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, 500);
}

/**
 * @param {string} category
 * @param {unknown} renewalKindRaw
 * @returns {{ renewal_kind: string | null, error: string | null }}
 */
export function resolveRenewalFieldsForCategory(category, renewalKindRaw) {
  if (category !== "renewal") {
    return { renewal_kind: null, error: null };
  }
  const k = parseRenewalKind(renewalKindRaw);
  if (!k) {
    return { renewal_kind: null, error: RENEWAL_KIND_REQUIRED };
  }
  return { renewal_kind: k, error: null };
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

/** @param {unknown} value */
/** Parses expense state; DB and API use `cancelled`. `cancel` is still accepted as a legacy request alias. */
export function parseExpenseState(value) {
  const s = String(value ?? "")
    .toLowerCase()
    .trim();
  if (!s) return null;
  const normalized = s === "cancel" ? "cancelled" : s;
  return EXPENSE_STATES.has(normalized) ? normalized : null;
}

/**
 * Value for `expenses[].state` in backup JSON. Must match PostgreSQL (`active` | `paused` | `cancelled`)
 * and what GET /api/expenses returns. Older export code incorrectly defaulted `cancelled` to `active`;
 * always re-download backup after server updates if states looked wrong in the file.
 */
export function normalizeExpenseStateForBackup(value) {
  return parseExpenseState(value) ?? "active";
}
