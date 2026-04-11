/**
 * Shared list-table chrome so Expenses, Prescriptions, import review, and renewal
 * reminder tables use the same structure, spacing, and sticky Actions column.
 */

export const TABLE_CARD = "rounded-xl border border-th-border";
export const TABLE_HEADER_BAR =
  "flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-th-surface/80 border-b border-th-border";
/** `min-w-0` lets wide tables scroll inside flex layouts instead of forcing overflow/clipping on phones. */
export const TABLE_SCROLL = "min-w-0 overflow-x-auto";

/** Base classes; add `min-w-[…rem]` when the table needs horizontal scroll. */
export const TABLE = "w-full text-sm text-left";

export const TABLE_HEAD =
  "bg-th-surface text-th-primary uppercase text-xs [&>tr>th]:border-b [&>tr>th]:border-th-border";

/** Plain (non-sort-button) column header. */
export const TABLE_TH = "px-4 py-3 font-medium uppercase tracking-wide text-th-primary";

export const TABLE_TH_STICKY_ACTIONS =
  "sticky right-0 z-20 px-4 py-3 text-right min-w-[10rem] font-medium uppercase tracking-wide text-th-primary bg-th-surface border-l border-th-border-bright shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.45)]";

/**
 * Explicit cell bottom borders — `divide-y` on tbody is unreliable with
 * `border-collapse: collapse` and sticky columns; this matches Expenses / Renewals.
 */
/** `text-th-primary` tracks the active theme (near-white on dark themes, near-black in daylight). */
export const TABLE_BODY =
  "bg-th-surface/50 text-th-primary [&>tr>td]:border-b [&>tr>td]:border-th-border";

export const TABLE_ROW = "hover:bg-th-surface/55 group";
export const TABLE_ROW_EDITING = "bg-th-surface/80";

export const TABLE_TD = "px-4 py-3 align-middle";

export const TABLE_TD_STICKY_ACTIONS_EDITING =
  "sticky right-0 z-10 px-4 py-3 text-right align-middle min-w-[10rem] border-l border-th-border-bright/80 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.35)] bg-th-surface/95";

export const TABLE_TD_STICKY_ACTIONS_DEFAULT =
  "sticky right-0 z-10 px-4 py-3 text-right align-middle min-w-[10rem] border-l border-th-border-bright/80 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.35)] bg-th-surface/90 group-hover:bg-th-surface";

/** Sortable header control (matches ExpenseTable `SortableTh` button). */
/** Add `text-left` or `justify-end text-right` for column alignment. */
export const SORTABLE_TH_BUTTON =
  "group inline-flex items-center gap-1 w-full min-w-0 font-medium uppercase tracking-wide text-th-primary hover:text-th-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 rounded px-0.5 -mx-0.5 -my-1";

export const SORTABLE_TH_ICON_ACTIVE = "text-sky-400";
export const SORTABLE_TH_ICON_IDLE = "text-th-muted opacity-0 group-hover:opacity-100";

/** Inline edit controls inside table cells (matches ExpenseTable). */
export const TABLE_FIELD_INPUT =
  "rounded-lg bg-th-input border border-th-border-bright px-2 py-1 text-white text-xs";
export const TABLE_FIELD_INPUT_NUM = `${TABLE_FIELD_INPUT} tabular-nums`;
