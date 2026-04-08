import { useEffect } from "react";
import { ManualExpenseFormFields } from "./ManualExpenseForm.jsx";

/**
 * Full-screen-style dialog: same fields as manual add expense, for PATCH /expenses/:id.
 */
export default function ExpenseEditModal({
  open,
  title = "Edit expense",
  draft,
  setDraft,
  saving,
  onSave,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !draft) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm px-4 py-8 sm:py-12"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expense-edit-title"
        className="w-full max-w-5xl rounded-xl border border-th-border bg-th-surface/95 shadow-xl p-4 sm:p-6 my-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 id="expense-edit-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p className="text-xs text-th-muted mt-1">
              Update any field, then save. Press Escape, Close, or click outside to cancel.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-th-muted text-sm hover:text-th-tertiary shrink-0">
            Close
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <ManualExpenseFormFields form={draft} setForm={setDraft} autoFocusAmount />
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-th-border-bright text-th-secondary text-sm font-medium px-4 py-2 hover:bg-th-surface disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
