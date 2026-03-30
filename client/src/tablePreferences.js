export const TABLE_ROWS_PER_PAGE_KEY = "expenseTracker.rowsPerPage.v1";

export const TABLE_ROWS_PER_PAGE_DEFAULT = 10;
export const TABLE_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

function coerceRowsPerPage(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return TABLE_ROWS_PER_PAGE_DEFAULT;
  // Only allow known options so UI stays predictable.
  return TABLE_ROWS_PER_PAGE_OPTIONS.includes(x) ? x : TABLE_ROWS_PER_PAGE_DEFAULT;
}

export function getRowsPerPage() {
  try {
    const raw = localStorage.getItem(TABLE_ROWS_PER_PAGE_KEY);
    return coerceRowsPerPage(raw);
  } catch {
    return TABLE_ROWS_PER_PAGE_DEFAULT;
  }
}

export function setRowsPerPage(rowsPerPage) {
  const v = coerceRowsPerPage(rowsPerPage);
  try {
    localStorage.setItem(TABLE_ROWS_PER_PAGE_KEY, String(v));
  } catch {
    // ignore
  }
  // Let mounted components update immediately within the same tab.
  window.dispatchEvent(new Event("tableRowsPerPage-changed"));
}

