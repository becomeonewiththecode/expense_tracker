import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import ProjectionModal from "../components/ProjectionModal.jsx";
import PaginationControls from "../components/PaginationControls.jsx";
import RowActionsMenu from "../components/RowActionsMenu.jsx";
import TableUpdateFlash from "../components/TableUpdateFlash.jsx";
import useTableRowsPerPage from "../hooks/useTableRowsPerPage.js";
import { setRowsPerPage, TABLE_ROWS_PER_PAGE_OPTIONS } from "../tablePreferences.js";
import {
  TABLE,
  TABLE_BODY,
  TABLE_CARD,
  TABLE_FIELD_INPUT,
  TABLE_FIELD_INPUT_NUM,
  TABLE_HEAD,
  TABLE_HEADER_BAR,
  TABLE_ROW,
  TABLE_ROW_EDITING,
  TABLE_SCROLL,
  TABLE_TD,
  TABLE_TD_STICKY_ACTIONS_DEFAULT,
  TABLE_TD_STICKY_ACTIONS_EDITING,
  TABLE_TH,
  TABLE_TH_STICKY_ACTIONS,
} from "../tableStyles.js";
import {
  PRESCRIPTION_CATEGORY_OPTIONS,
  PRESCRIPTION_RENEWAL_PERIOD_OPTIONS,
  formatPrescriptionCategory,
  formatRenewalPeriod,
} from "../prescriptionOptions.js";
import {
  computePrescriptionProjectionPieData,
  computePrescriptionSpendingProjection,
} from "../projection.js";
import { advanceNextRenewalDate, daysUntilPrescriptionRenewal } from "../prescriptionSchedule.js";
import { EXPENSE_STATE_OPTIONS, formatExpenseState } from "../expenseOptions.js";

/** Cancel rows stay in the table but are excluded from combined Projection (same idea as Renewals). */
function prescriptionRowsForProjection(rows) {
  return rows.filter((r) => r.state !== "cancel");
}

function prescriptionRowSnapshotForProjection(row, draft) {
  if (!draft) return row;
  const amt = Number(draft.amount);
  return {
    ...row,
    name: draft.name.trim(),
    amount: Number.isFinite(amt) ? amt : row.amount,
    renewal_period: draft.renewal_period,
    category: draft.category,
    state: draft.state,
    next_renewal_date: draft.next_renewal_date,
    vendor: draft.vendor ?? "",
    notes: draft.notes ?? "",
  };
}

function projectionContextLabel(row) {
  const n = row.name?.trim();
  return n ? `Prescription — ${n}` : "Prescription";
}

function emptyForm() {
  return {
    name: "",
    amount: "",
    renewal_period: "one_year",
    next_renewal_date: new Date().toISOString().slice(0, 10),
    vendor: "",
    notes: "",
    category: "medical",
    state: "active",
  };
}

export default function PrescriptionsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addSaving, setAddSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [projectionTarget, setProjectionTarget] = useState(null);
  const [noteSearch, setNoteSearch] = useState("");
  const rowsPerPage = useTableRowsPerPage();
  const [page, setPage] = useState(1);
  const [tableUpdateFlashToken, setTableUpdateFlashToken] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/prescriptions", { params: { limit: 500 } });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load prescriptions");
    } finally {
      setLoading(false);
    }
    window.dispatchEvent(new Event("prescriptions-changed"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && items.length === 0) {
      setAddFormOpen(true);
    }
  }, [loading, items.length]);

  useEffect(() => {
    if (items.length === 0) setProjectionTarget(null);
  }, [items.length]);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage]);

  const filteredItems = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => String(r.notes ?? "").toLowerCase().includes(q));
  }, [items, noteSearch]);
  const projectionSourceItems = useMemo(() => prescriptionRowsForProjection(filteredItems), [filteredItems]);

  async function addPrescription(e) {
    e.preventDefault();
    const amount = Number(addForm.amount);
    if (!addForm.name.trim()) {
      setError("Enter a name");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    setAddSaving(true);
    setError("");
    try {
      await api.post("/prescriptions", {
        name: addForm.name.trim(),
        amount,
        renewal_period: addForm.renewal_period,
        next_renewal_date: addForm.next_renewal_date,
        vendor: addForm.vendor.trim(),
        notes: addForm.notes,
        category: addForm.category,
        state: addForm.state,
      });
      setAddForm(emptyForm());
      await load();
      setAddFormOpen(false);
      setTableUpdateFlashToken((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Could not save");
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(row) {
    setError("");
    setEditId(row.id);
    setEditDraft({
      name: row.name,
      amount: String(row.amount),
      renewal_period: row.renewal_period,
      next_renewal_date: String(row.next_renewal_date).slice(0, 10),
      vendor: row.vendor ?? "",
      notes: row.notes ?? "",
      category: row.category,
      state: row.state === "cancel" ? "cancel" : "active",
    });
  }

  function cancelEdit() {
    setEditId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editId || !editDraft) return;
    const amount = Number(editDraft.amount);
    if (!editDraft.name.trim()) {
      setError("Enter a name");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    setEditSaving(true);
    setError("");
    try {
      await api.patch(`/prescriptions/${editId}`, {
        name: editDraft.name.trim(),
        amount,
        renewal_period: editDraft.renewal_period,
        next_renewal_date: editDraft.next_renewal_date,
        vendor: editDraft.vendor.trim(),
        notes: editDraft.notes,
        category: editDraft.category,
        state: editDraft.state,
      });
      cancelEdit();
      await load();
      setTableUpdateFlashToken((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Could not save changes");
    } finally {
      setEditSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this prescription entry?")) return;
    if (editId === id) cancelEdit();
    try {
      await api.delete(`/prescriptions/${id}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Delete failed");
    }
  }

  async function markRenewed(row) {
    const next = advanceNextRenewalDate(row.next_renewal_date, row.renewal_period);
    if (!next) {
      setError("Could not compute next renewal date");
      return;
    }
    setError("");
    try {
      await api.patch(`/prescriptions/${row.id}`, { next_renewal_date: next });
      await load();
      setTableUpdateFlashToken((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Could not update date");
    }
  }

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const da = String(a.next_renewal_date);
      const db = String(b.next_renewal_date);
      return da.localeCompare(db);
    });
  }, [filteredItems]);

  const totalItems = sortedItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, rowsPerPage)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = sortedItems.slice(
    (safePage - 1) * rowsPerPage,
    safePage * rowsPerPage
  );

  function handlePageChange(nextPage) {
    cancelEdit();
    setPage(nextPage);
  }

  function handleRowsPerPageChange(nextSize) {
    cancelEdit();
    setRowsPerPage(nextSize);
    setPage(1);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Prescriptions</h1>
        <p className="text-sm text-slate-400 mt-1">
          {loading
            ? "Loading…"
            : "Track medical, dental, vision, supplements, and equipment on irregular renewal cycles (1–11 months in monthly steps, or 1–5 years). Reminders appear here and at the top of the app when the next renewal is within 30 days or up to 14 days overdue."}
        </p>
      </div>

      {!loading && error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{error}</p>
      )}

      {!loading && items.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <button
            type="button"
            onClick={() => setAddFormOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-800/70 text-slate-200"
            aria-expanded={addFormOpen}
            aria-controls="prescriptions-add-form"
          >
            <span className="text-sm font-medium">Add prescription</span>
            <span className="text-xs text-slate-400">{addFormOpen ? "Hide" : "Show"}</span>
          </button>
        </div>
      ) : null}

      {addFormOpen ? (
      <form
        id="prescriptions-add-form"
        onSubmit={addPrescription}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end bg-slate-900/50 border border-slate-800 rounded-xl p-4"
      >
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Name</label>
          <input
            type="text"
            value={addForm.name}
            onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
            placeholder="e.g. Contact lenses, maintenance medication"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={addForm.amount}
            onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Category</label>
          <select
            value={addForm.category}
            onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
          >
            {PRESCRIPTION_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Renewal period</label>
          <select
            value={addForm.renewal_period}
            onChange={(e) => setAddForm((f) => ({ ...f, renewal_period: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
          >
            {PRESCRIPTION_RENEWAL_PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Next renewal date</label>
          <input
            type="date"
            value={addForm.next_renewal_date}
            onChange={(e) => setAddForm((f) => ({ ...f, next_renewal_date: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Vendor</label>
          <input
            type="text"
            value={addForm.vendor}
            onChange={(e) => setAddForm((f) => ({ ...f, vendor: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
            placeholder="Pharmacy, clinic, supplier"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Notes</label>
          <input
            type="text"
            value={addForm.notes}
            onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">State</label>
          <select
            value={addForm.state}
            onChange={(e) => setAddForm((f) => ({ ...f, state: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
          >
            {EXPENSE_STATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={addSaving}
            className="rounded-lg bg-cyan-700/90 hover:bg-cyan-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
          >
            {addSaving ? "Saving…" : "Add prescription"}
          </button>
        </div>
      </form>
      ) : null}

      {!loading && items.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-700 rounded-xl">
          No entries yet. Add one above.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className={TABLE_CARD}>
          <div className={TABLE_HEADER_BAR}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-slate-200">Your items</h2>
              <TableUpdateFlash token={tableUpdateFlashToken} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes"
                className="w-48 rounded-lg bg-slate-950 border border-slate-700 px-3 py-1.5 text-slate-200 text-xs"
              />
              <button
                type="button"
                onClick={() => setProjectionTarget({ kind: "all" })}
                className="rounded-lg border border-violet-500/40 bg-violet-950/40 hover:bg-violet-900/35 text-violet-200 text-xs font-medium px-3 py-1.5"
              >
                Projection
              </button>
            </div>
          </div>
          <div className={TABLE_SCROLL}>
            <table className={`${TABLE} min-w-[56rem]`}>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={`${TABLE_TH} min-w-[8rem]`}>Name</th>
                  <th className={`${TABLE_TH} w-[6rem]`}>Amount</th>
                  <th className={`${TABLE_TH} min-w-[7rem]`}>Category</th>
                  <th className={`${TABLE_TH} min-w-[7rem]`}>Renewal</th>
                  <th className={`${TABLE_TH} min-w-[9rem]`}>Next date</th>
                  <th className={`${TABLE_TH} hidden md:table-cell min-w-[8rem]`}>Vendor</th>
                  <th className={`${TABLE_TH} hidden lg:table-cell min-w-[8rem]`}>Notes</th>
                  <th className={`${TABLE_TH} w-[5.5rem]`}>State</th>
                  <th className={TABLE_TH_STICKY_ACTIONS}>Actions</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {pageItems.map((row) => {
                  const editing = editId === row.id;
                  const d = editing ? editDraft : null;
                  const projectionRow = prescriptionRowSnapshotForProjection(row, d);
                  const days = daysUntilPrescriptionRenewal(row.next_renewal_date);
                  return (
                    <tr key={row.id} className={editing ? TABLE_ROW_EDITING : TABLE_ROW}>
                      <td className={`${TABLE_TD} text-slate-200`}>
                        {editing && d ? (
                          <input
                            value={d.name}
                            onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                            className={`w-full min-w-[8rem] ${TABLE_FIELD_INPUT}`}
                          />
                        ) : (
                          row.name
                        )}
                      </td>
                      <td className={`${TABLE_TD} text-slate-300`}>
                        {editing && d ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={d.amount}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, amount: e.target.value } : prev))
                            }
                            className={`w-24 ${TABLE_FIELD_INPUT_NUM}`}
                          />
                        ) : (
                          <span className="font-medium text-white tabular-nums">
                            ${Number(row.amount).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className={TABLE_TD}>
                        {editing && d ? (
                          <select
                            value={d.category}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, category: e.target.value } : prev))
                            }
                            className={`max-w-[9rem] ${TABLE_FIELD_INPUT}`}
                          >
                            {PRESCRIPTION_CATEGORY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-300">{formatPrescriptionCategory(row.category)}</span>
                        )}
                      </td>
                      <td className={TABLE_TD}>
                        {editing && d ? (
                          <select
                            value={d.renewal_period}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, renewal_period: e.target.value } : prev))
                            }
                            className={`max-w-[9rem] ${TABLE_FIELD_INPUT}`}
                          >
                            {PRESCRIPTION_RENEWAL_PERIOD_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-300">{formatRenewalPeriod(row.renewal_period)}</span>
                        )}
                      </td>
                      <td className={TABLE_TD}>
                        {editing && d ? (
                          <input
                            type="date"
                            value={d.next_renewal_date}
                            onChange={(e) =>
                              setEditDraft((prev) =>
                                prev ? { ...prev, next_renewal_date: e.target.value } : prev
                              )
                            }
                            className={TABLE_FIELD_INPUT}
                          />
                        ) : (
                          <span className="text-slate-300">
                            {String(row.next_renewal_date).slice(0, 10)}
                            {days != null && row.state !== "cancel" ? (
                              <span className="text-slate-500 text-xs ml-1">
                                (
                                {days < 0
                                  ? `${-days}d overdue`
                                  : days === 0
                                    ? "today"
                                    : `${days}d`}
                                )
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className={`${TABLE_TD} text-slate-400 hidden md:table-cell`}>
                        {editing && d ? (
                          <input
                            value={d.vendor}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, vendor: e.target.value } : prev))
                            }
                            className={`w-full max-w-xs ${TABLE_FIELD_INPUT}`}
                          />
                        ) : (
                          row.vendor || "—"
                        )}
                      </td>
                      <td className={`${TABLE_TD} text-slate-500 hidden lg:table-cell max-w-[12rem] truncate`}>
                        {editing && d ? (
                          <input
                            value={d.notes}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                            }
                            className={`w-full ${TABLE_FIELD_INPUT} text-slate-300`}
                          />
                        ) : (
                          row.notes || "—"
                        )}
                      </td>
                      <td className={TABLE_TD}>
                        {editing && d ? (
                          <select
                            value={d.state}
                            onChange={(e) =>
                              setEditDraft((prev) => (prev ? { ...prev, state: e.target.value } : prev))
                            }
                            className={TABLE_FIELD_INPUT}
                          >
                            {EXPENSE_STATE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={row.state === "cancel" ? "text-emerald-400/90" : "text-slate-300"}>
                            {formatExpenseState(row.state)}
                          </span>
                        )}
                      </td>
                      <td
                        className={`${
                          editing && d ? TABLE_TD_STICKY_ACTIONS_EDITING : TABLE_TD_STICKY_ACTIONS_DEFAULT
                        } whitespace-nowrap`}
                      >
                        {editing && d ? (
                          <div className="flex justify-end">
                            <RowActionsMenu
                              items={[
                                {
                                  key: "save",
                                  label: editSaving ? "Saving…" : "Save",
                                  disabled: editSaving,
                                  className: "text-emerald-400",
                                  onClick: saveEdit,
                                },
                                {
                                  key: "cancel",
                                  label: "Cancel",
                                  disabled: editSaving,
                                  className: "text-slate-400",
                                  onClick: cancelEdit,
                                },
                              ]}
                            />
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <RowActionsMenu
                              items={[
                                {
                                  key: "projection",
                                  label: "Projection",
                                  className: "text-violet-400",
                                  onClick: () =>
                                    setProjectionTarget({ kind: "row", row: projectionRow }),
                                },
                                {
                                  key: "edit",
                                  label: "Edit",
                                  className: "text-sky-400",
                                  onClick: () => startEdit(row),
                                },
                                {
                                  key: "delete",
                                  label: "Delete",
                                  className: "text-rose-400",
                                  onClick: () => remove(row.id),
                                },
                                {
                                  key: "renewed",
                                  label: "Renewed",
                                  title: "Advance next renewal by one cycle",
                                  className: "text-cyan-400",
                                  onClick: () => markRenewed(row),
                                },
                              ]}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalItems > 0 ? (
            <PaginationControls
              currentPage={safePage}
              totalItems={totalItems}
              pageSize={rowsPerPage}
              onPageChange={handlePageChange}
              onPageSizeChange={handleRowsPerPageChange}
              pageSizeOptions={TABLE_ROWS_PER_PAGE_OPTIONS}
            />
          ) : null}
        </div>
      )}

      <ProjectionModal
        open={projectionTarget != null}
        onClose={() => setProjectionTarget(null)}
        projectionKind="prescription"
        projection={
          projectionTarget
            ? projectionTarget.kind === "all"
              ? computePrescriptionSpendingProjection(projectionSourceItems)
              : computePrescriptionSpendingProjection([projectionTarget.row])
            : null
        }
        contextLabel={
          projectionTarget?.kind === "row"
            ? projectionContextLabel(projectionTarget.row)
            : projectionTarget?.kind === "all"
              ? "Active prescriptions (combined)"
              : undefined
        }
        singleItem={projectionTarget?.kind === "row"}
        pieData={computePrescriptionProjectionPieData(
          projectionTarget?.kind === "all"
            ? projectionSourceItems
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        )}
        projectionItems={
          projectionTarget?.kind === "all"
            ? projectionSourceItems
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        }
        projectionScopeKey={
          projectionTarget == null
            ? ""
            : projectionTarget.kind === "all"
              ? "prescriptions-all"
              : `prescription-${projectionTarget.row.id}`
        }
      />
    </div>
  );
}
