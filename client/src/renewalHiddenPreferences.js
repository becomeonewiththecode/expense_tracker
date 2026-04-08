const STORAGE_KEY = "expenseTracker.hiddenCancelledRenewals.v1";

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") return null;
  const expenseId = Number(record.expenseId);
  if (!Number.isFinite(expenseId) || expenseId <= 0) return null;
  return {
    expenseId,
    title: String(record.title || "").trim(),
    institution: String(record.institution || "").trim(),
    amount: Number.isFinite(Number(record.amount)) ? Number(record.amount) : 0,
    state: String(record.state || "cancelled").trim().toLowerCase(),
    hiddenAt: String(record.hiddenAt || "").trim(),
    lastRenewalDate: String(record.lastRenewalDate || "").trim(),
    reason: String(record.reason || "").trim(),
  };
}

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = safeParse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(new Event("renewalHiddenItems-changed"));
}

export function getHiddenCancelledRenewalsForUser(userId) {
  const uid = String(userId ?? "").trim();
  if (!uid) return [];
  const all = readAll();
  const rows = Array.isArray(all[uid]) ? all[uid] : [];
  return rows.map(normalizeRecord).filter(Boolean);
}

export function setHiddenCancelledRenewalsForUser(userId, records) {
  const uid = String(userId ?? "").trim();
  if (!uid) return;
  const all = readAll();
  const normalized = Array.isArray(records) ? records.map(normalizeRecord).filter(Boolean) : [];
  all[uid] = normalized;
  writeAll(all);
}
