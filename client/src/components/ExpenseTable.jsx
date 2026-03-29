import {
  CATEGORY_OPTIONS,
  EXPENSE_STATE_OPTIONS,
  FREQUENCY_OPTIONS,
  FINANCIAL_INSTITUTION_OPTIONS,
  formatCategory,
  formatExpenseState,
  formatFinancialInstitution,
  formatFrequency,
} from "../expenseOptions.js";

/** Normalize API spent_at to YYYY-MM-DD for date inputs. */
function toDateInputValue(spentAt) {
  if (spentAt == null) return "";
  const s = String(spentAt);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

/** Merge saved row with in-progress edit for projection preview. */
function rowSnapshotForProjection(row, draft) {
  if (draft) {
    const amt = Number(draft.amount);
    return {
      ...row,
      amount: Number.isFinite(amt) ? amt : row.amount,
      category: draft.category,
      frequency: draft.frequency,
      financial_institution: draft.financial_institution,
      state: draft.state,
      description: draft.description,
      spent_at: draft.spent_at,
    };
  }
  return row;
}

export default function ExpenseTable({
  items,
  expensesModifyMode,
  setExpensesModifyMode,
  expenseEditId,
  expenseEditDraft,
  setExpenseEditDraft,
  expenseSaving,
  openExpenseEdit,
  cancelExpenseEdit,
  saveExpenseEdit,
  remove,
  onProjection,
  onRowProjection,
}) {
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        <h2 className="text-sm font-medium text-slate-200">Expenses</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onProjection}
            className="rounded-lg border border-violet-500/40 bg-violet-950/40 hover:bg-violet-900/35 text-violet-200 text-xs font-medium px-3 py-1.5"
          >
            Projection
          </button>
          {expensesModifyMode ? (
            <button
              type="button"
              onClick={() => {
                cancelExpenseEdit();
                setExpensesModifyMode(false);
              }}
              className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5"
            >
              Exit modification mode
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setExpensesModifyMode(true)}
              className="rounded-lg bg-sky-700/80 hover:bg-sky-600 text-white text-xs font-medium px-3 py-1.5"
            >
              Enter modification mode
            </button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[70rem] text-sm text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 w-[9.5rem]">Transaction</th>
              <th className="px-4 py-3 w-[5.5rem]">Amount</th>
              <th className="px-4 py-3 w-[7.5rem]">Category</th>
              <th className="px-4 py-3 hidden lg:table-cell w-[6.5rem]">Frequency</th>
              <th className="px-4 py-3 hidden md:table-cell w-[7rem]">Institution</th>
              <th className="px-4 py-3 hidden md:table-cell w-[5.5rem]">State</th>
              <th className="px-4 py-3 hidden sm:table-cell min-w-[8rem]">Note</th>
              <th className="px-4 py-3 text-right min-w-[15rem]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {items.map((row) => {
              const editing = expensesModifyMode && expenseEditId === row.id;
              const d = expenseEditDraft;
              const snapshot = rowSnapshotForProjection(row, editing ? d : null);
              return (
                <tr key={row.id} className={editing ? "bg-slate-900/80" : "hover:bg-slate-900/60"}>
                  <td className="px-4 py-3 text-slate-300 whitespace-nowrap align-middle">
                    {editing && d ? (
                      <input
                        type="date"
                        value={d.spent_at}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, spent_at: e.target.value } : prev
                          )
                        }
                        className="w-full min-w-[9.5rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      />
                    ) : (
                      toDateInputValue(row.spent_at) || "—"
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    {editing && d ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={d.amount}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, amount: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[7rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs tabular-nums"
                      />
                    ) : (
                      <span className="font-medium text-white tabular-nums">
                        ${Number(row.amount).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-300 align-middle">
                    {editing && d ? (
                      <select
                        value={d.category}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, category: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[11rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatCategory(row.category)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-slate-300 align-middle ${editing ? "" : "hidden lg:table-cell"}`}
                  >
                    {editing && d ? (
                      <select
                        value={d.frequency}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, frequency: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[8rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {FREQUENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatFrequency(row.frequency)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-slate-300 align-middle ${editing ? "" : "hidden md:table-cell"}`}
                  >
                    {editing && d ? (
                      <select
                        value={d.financial_institution}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, financial_institution: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[10rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {FINANCIAL_INSTITUTION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatFinancialInstitution(row.financial_institution)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-slate-300 align-middle ${editing ? "" : "hidden md:table-cell"}`}
                  >
                    {editing && d ? (
                      <select
                        value={d.state}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, state: e.target.value } : prev
                          )
                        }
                        className="w-full max-w-[8rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {EXPENSE_STATE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatExpenseState(row.state)
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 align-middle ${editing ? "" : "hidden sm:table-cell"}`}
                  >
                    {editing && d ? (
                      <input
                        value={d.description}
                        onChange={(e) =>
                          setExpenseEditDraft((prev) =>
                            prev ? { ...prev, description: e.target.value } : prev
                          )
                        }
                        className="w-full min-w-[8rem] max-w-xs rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-slate-300 text-xs"
                        placeholder="Note"
                      />
                    ) : (
                      <span className="text-slate-500 max-w-xs truncate block">{row.description}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-middle min-w-[15rem]">
                    {editing ? (
                      <div className="flex flex-row flex-wrap gap-x-3 gap-y-1 justify-end items-center">
                        <button
                          type="button"
                          onClick={() => onRowProjection(snapshot)}
                          className="shrink-0 text-violet-400 hover:text-violet-300 text-xs"
                        >
                          Projection
                        </button>
                        <button
                          type="button"
                          disabled={expenseSaving}
                          onClick={() => saveExpenseEdit()}
                          className="shrink-0 text-emerald-400 hover:text-emerald-300 text-xs disabled:opacity-50"
                        >
                          {expenseSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          disabled={expenseSaving}
                          onClick={cancelExpenseEdit}
                          className="shrink-0 text-slate-400 hover:text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-row flex-wrap gap-x-3 gap-y-1 justify-end items-center">
                        <button
                          type="button"
                          onClick={() => onRowProjection(snapshot)}
                          className="shrink-0 text-violet-400 hover:text-violet-300 text-xs"
                        >
                          Projection
                        </button>
                        {expensesModifyMode && (
                          <button
                            type="button"
                            onClick={() => openExpenseEdit(row)}
                            className="shrink-0 text-sky-400 hover:text-sky-300 text-xs"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(row.id)}
                          className="shrink-0 text-rose-400 hover:text-rose-300 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
