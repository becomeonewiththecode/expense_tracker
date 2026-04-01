export const THEME_KEY = "expenseTracker.theme.v1";

export const THEME_DEFAULT = "midnight";
export const THEME_OPTIONS = [
  { value: "midnight", label: "Midnight" },
  { value: "ember", label: "Ember" },
  { value: "daylight", label: "Daylight" },
];

const VALID_THEMES = new Set(THEME_OPTIONS.map((o) => o.value));

function coerceTheme(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  return VALID_THEMES.has(s) ? s : THEME_DEFAULT;
}

export function getTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return coerceTheme(raw);
  } catch {
    return THEME_DEFAULT;
  }
}

export function setTheme(theme) {
  const v = coerceTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, v);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event("theme-changed"));
}
