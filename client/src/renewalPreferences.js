export const RENEWAL_REMINDER_WINDOW_DAYS_KEY = "expenseTracker.renewalReminderWindowDays.v1";

export const RENEWAL_REMINDER_WINDOW_DAYS_DEFAULT = 7;
export const RENEWAL_REMINDER_WINDOW_DAYS_OPTIONS = [3, 5, 7, 10, 14, 21, 30, 40];

function coerceRenewalReminderWindowDays(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return RENEWAL_REMINDER_WINDOW_DAYS_DEFAULT;
  return RENEWAL_REMINDER_WINDOW_DAYS_OPTIONS.includes(n)
    ? n
    : RENEWAL_REMINDER_WINDOW_DAYS_DEFAULT;
}

export function getRenewalReminderWindowDays() {
  try {
    const raw = localStorage.getItem(RENEWAL_REMINDER_WINDOW_DAYS_KEY);
    return coerceRenewalReminderWindowDays(raw);
  } catch {
    return RENEWAL_REMINDER_WINDOW_DAYS_DEFAULT;
  }
}

export function setRenewalReminderWindowDays(days) {
  const next = coerceRenewalReminderWindowDays(days);
  try {
    localStorage.setItem(RENEWAL_REMINDER_WINDOW_DAYS_KEY, String(next));
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("renewalReminderWindowDays-changed"));
}
