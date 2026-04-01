import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import ProjectionModal from "../components/ProjectionModal.jsx";
import RowActionsMenu from "../components/RowActionsMenu.jsx";
import PaginationControls from "../components/PaginationControls.jsx";
import TableUpdateFlash from "../components/TableUpdateFlash.jsx";
import useTableRowsPerPage from "../hooks/useTableRowsPerPage.js";
import { setRowsPerPage, TABLE_ROWS_PER_PAGE_OPTIONS } from "../tablePreferences.js";
import {
  PAYMENT_PLAN_ACCOUNT_TYPE_OPTIONS,
  PAYMENT_PLAN_CATEGORY_OPTIONS,
  PAYMENT_PLAN_FREQUENCY_OPTIONS,
  PAYMENT_PLAN_INSTITUTION_OPTIONS,
  PAYMENT_PLAN_METHOD_OPTIONS,
  PAYMENT_PLAN_PRIORITY_OPTIONS,
  PAYMENT_PLAN_SCHEDULE_OPTIONS,
  PAYMENT_PLAN_STATUS_OPTIONS,
  PAYMENT_PLAN_TAG_OPTIONS,
  formatPaymentPlanAccountType,
  formatPaymentPlanCategory,
  formatPaymentPlanFrequency,
  formatPaymentPlanInstitution,
  formatPaymentPlanMethod,
  formatPaymentPlanPriority,
  formatPaymentPlanSchedule,
  formatPaymentPlanStatus,
  formatPaymentPlanTag,
} from "../paymentPlanOptions.js";
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
  TABLE_TD_STICKY_ACTIONS_DEFAULT,
  TABLE_TD_STICKY_ACTIONS_EDITING,
  TABLE_TH,
  TABLE_TH_STICKY_ACTIONS,
} from "../tableStyles.js";
import {
  computePaymentPlanProjectionPieData,
  computePaymentPlanSpendingProjection,
} from "../projection.js";

const CREDIT_CARD_INSTITUTION_VALUES = new Set(["visa", "american_express", "mastercard"]);
const CREDIT_CARD_INSTITUTION_OPTIONS = PAYMENT_PLAN_INSTITUTION_OPTIONS.filter((o) =>
  CREDIT_CARD_INSTITUTION_VALUES.has(o.value)
);
const NON_CARD_INSTITUTION_OPTIONS = PAYMENT_PLAN_INSTITUTION_OPTIONS.filter(
  (o) => !CREDIT_CARD_INSTITUTION_VALUES.has(o.value)
);

function institutionOptionsForAccountType(accountType) {
  return accountType === "credit_card"
    ? CREDIT_CARD_INSTITUTION_OPTIONS
    : NON_CARD_INSTITUTION_OPTIONS;
}

function normalizeInstitutionForAccountType(accountType, institution) {
  const options = institutionOptionsForAccountType(accountType);
  if (options.some((o) => o.value === institution)) return institution;
  return options[0]?.value ?? "other";
}

function createEmptyForm() {
  return {
    name: "",
    amount: "",
    category: PAYMENT_PLAN_CATEGORY_OPTIONS[0].value,
    payment_schedule: PAYMENT_PLAN_SCHEDULE_OPTIONS[0].value,
    priority_level: PAYMENT_PLAN_PRIORITY_OPTIONS[0].value,
    status: PAYMENT_PLAN_STATUS_OPTIONS[0].value,
    account_type: PAYMENT_PLAN_ACCOUNT_TYPE_OPTIONS[0].value,
    payment_method: PAYMENT_PLAN_METHOD_OPTIONS[0].value,
    institution: NON_CARD_INSTITUTION_OPTIONS[0]?.value ?? "other",
    tag: PAYMENT_PLAN_TAG_OPTIONS[0].value,
    frequency: PAYMENT_PLAN_FREQUENCY_OPTIONS[0].value,
    notes: "",
  };
}

function normalizeDraft(row) {
  return {
    name: row.name ?? "",
    amount: String(row.amount ?? ""),
    category: row.category ?? PAYMENT_PLAN_CATEGORY_OPTIONS[0].value,
    payment_schedule: row.payment_schedule ?? PAYMENT_PLAN_SCHEDULE_OPTIONS[0].value,
    priority_level: row.priority_level ?? PAYMENT_PLAN_PRIORITY_OPTIONS[0].value,
    status: row.status ?? PAYMENT_PLAN_STATUS_OPTIONS[0].value,
    account_type: row.account_type ?? PAYMENT_PLAN_ACCOUNT_TYPE_OPTIONS[0].value,
    payment_method: row.payment_method ?? PAYMENT_PLAN_METHOD_OPTIONS[0].value,
    institution: row.institution ?? PAYMENT_PLAN_INSTITUTION_OPTIONS[0].value,
    tag: row.tag ?? PAYMENT_PLAN_TAG_OPTIONS[0].value,
    frequency: row.frequency ?? PAYMENT_PLAN_FREQUENCY_OPTIONS[0].value,
    notes: row.notes ?? "",
  };
}

export default function PaymentPlansPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [addForm, setAddForm] = useState(() => createEmptyForm());
  const [addSaving, setAddSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(true);
  const [noteSearch, setNoteSearch] = useState("");

  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [projectionTarget, setProjectionTarget] = useState(null);
  const hadItemsRef = useRef(false);

  const rowsPerPage = useTableRowsPerPage();
  const [page, setPage] = useState(1);
  const [tableUpdateFlashToken, setTableUpdateFlashToken] = useState(0);

  async function load() {
    setError("");
    try {
      const { data } = await api.get("/payment-plans", { params: { limit: 500 } });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load payment plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage]);

  const filteredItems = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((r) => String(r.notes ?? "").toLowerCase().includes(q));
  }, [items, noteSearch]);

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, rowsPerPage)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = useMemo(
    () => filteredItems.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage),
    [filteredItems, rowsPerPage, safePage]
  );

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  useEffect(() => {
    const hasItems = items.length > 0;
    if (hasItems && !hadItemsRef.current) {
      setAddOpen(false);
    }
    hadItemsRef.current = hasItems;
  }, [items.length]);

  useEffect(() => {
    if (items.length === 0) setProjectionTarget(null);
  }, [items.length]);

  async function onAdd(e) {
    e.preventDefault();
    const amount = Number(addForm.amount);
    if (!addForm.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    setError("");
    setNotice("");
    setAddSaving(true);
    try {
      await api.post("/payment-plans", { ...addForm, amount });
      setAddForm(createEmptyForm());
      setNotice("Payment plan added.");
      await load();
      setTableUpdateFlashToken((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Could not save payment plan");
    } finally {
      setAddSaving(false);
    }
  }

  function startEdit(row) {
    setError("");
    setNotice("");
    setEditId(row.id);
    setEditDraft(normalizeDraft(row));
  }

  function cancelEdit() {
    setEditId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editId || !editDraft) return;
    const amount = Number(editDraft.amount);
    if (!editDraft.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    setError("");
    setNotice("");
    setEditSaving(true);
    try {
      await api.patch(`/payment-plans/${editId}`, { ...editDraft, amount });
      cancelEdit();
      setNotice("Payment plan updated.");
      await load();
      setTableUpdateFlashToken((n) => n + 1);
    } catch (err) {
      setError(err.response?.data?.error || "Could not update payment plan");
    } finally {
      setEditSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Delete this payment plan?")) return;
    try {
      await api.delete(`/payment-plans/${id}`);
      if (editId === id) cancelEdit();
      setNotice("Payment plan removed.");
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Delete failed");
    }
  }

  function updateDraft(key, value) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      if (key !== "account_type") return { ...prev, [key]: value };
      return {
        ...prev,
        account_type: value,
        institution: normalizeInstitutionForAccountType(value, prev.institution),
      };
    });
  }

  function projectionContextLabel(row) {
    const n = String(row?.name ?? "").trim();
    return n ? `Payment plan — ${n}` : "Payment plan";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Payment Plan</h1>
        <p className="text-sm text-th-subtle mt-1">
          Track planned payments with schedule, priority, account, method, institution, tags, and frequency.
        </p>
      </div>

      {!loading && error ? (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{error}</p>
      ) : null}
      {!loading && notice ? (
        <p className="text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-3 py-2">{notice}</p>
      ) : null}

      <div className="rounded-xl border border-th-border bg-th-surface/40 p-4">
        <div className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-th-secondary">
          <span className="font-medium text-sm">Add payment plan</span>
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="text-th-muted text-xs hover:text-th-tertiary"
            aria-expanded={addOpen}
          >
            {addOpen ? "Hide" : "Show"}
          </button>
        </div>
        {addOpen ? (
          <form onSubmit={onAdd} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-th-muted block">
              Name
              <input
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                className={`mt-1 w-full ${TABLE_FIELD_INPUT}`}
                placeholder="Plan name"
              />
            </label>
            <label className="text-xs text-th-muted block">
              Amount
              <input
                type="number"
                step="0.01"
                min="0"
                value={addForm.amount}
                onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                className={`mt-1 w-full ${TABLE_FIELD_INPUT_NUM}`}
                placeholder="0.00"
              />
            </label>
            <SelectField label="Category" value={addForm.category} options={PAYMENT_PLAN_CATEGORY_OPTIONS} onChange={(v) => setAddForm((f) => ({ ...f, category: v }))} />
            <SelectField label="Payment schedule" value={addForm.payment_schedule} options={PAYMENT_PLAN_SCHEDULE_OPTIONS} onChange={(v) => setAddForm((f) => ({ ...f, payment_schedule: v }))} />
            <SelectField label="Priority level" value={addForm.priority_level} options={PAYMENT_PLAN_PRIORITY_OPTIONS} onChange={(v) => setAddForm((f) => ({ ...f, priority_level: v }))} />
            <SelectField label="Status" value={addForm.status} options={PAYMENT_PLAN_STATUS_OPTIONS} onChange={(v) => setAddForm((f) => ({ ...f, status: v }))} />
            <SelectField
              label="Account type"
              value={addForm.account_type}
              options={PAYMENT_PLAN_ACCOUNT_TYPE_OPTIONS}
              onChange={(v) =>
                setAddForm((f) => ({
                  ...f,
                  account_type: v,
                  institution: normalizeInstitutionForAccountType(v, f.institution),
                }))
              }
            />
            <SelectField label="Payment method" value={addForm.payment_method} options={PAYMENT_PLAN_METHOD_OPTIONS} onChange={(v) => setAddForm((f) => ({ ...f, payment_method: v }))} />
            <SelectField
              label={addForm.account_type === "credit_card" ? "Credit card type" : "Institution"}
              value={addForm.institution}
              options={institutionOptionsForAccountType(addForm.account_type)}
              onChange={(v) => setAddForm((f) => ({ ...f, institution: v }))}
            />
            <SelectField label="Tag" value={addForm.tag} options={PAYMENT_PLAN_TAG_OPTIONS} onChange={(v) => setAddForm((f) => ({ ...f, tag: v }))} />
            <SelectField label="Frequency" value={addForm.frequency} options={PAYMENT_PLAN_FREQUENCY_OPTIONS} onChange={(v) => setAddForm((f) => ({ ...f, frequency: v }))} />
            <label className="text-xs text-th-muted block sm:col-span-2 lg:col-span-3">
              Notes
              <textarea
                value={addForm.notes}
                onChange={(e) => setAddForm((f) => ({ ...f, notes: e.target.value }))}
                className={`mt-1 w-full ${TABLE_FIELD_INPUT} text-th-tertiary min-h-[5rem]`}
                placeholder="Optional notes"
              />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={addSaving}
                className="rounded-lg bg-cyan-700/90 hover:bg-cyan-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
              >
                {addSaving ? "Saving…" : "Add payment plan"}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {!loading && items.length === 0 ? (
        <p className="text-sm text-th-muted text-center py-8 border border-dashed border-th-border-bright rounded-xl">
          No payment plans yet. Add one above.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className={TABLE_CARD}>
          <div className={TABLE_HEADER_BAR}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-th-secondary">Your payment plans</h2>
              <TableUpdateFlash token={tableUpdateFlashToken} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                placeholder="Search notes"
                className="w-48 rounded-lg bg-th-input border border-th-border-bright px-3 py-1.5 text-th-secondary text-xs"
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
            <table className={`${TABLE} min-w-[78rem]`}>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={`${TABLE_TH} min-w-[10rem]`}>Name</th>
                  <th className={`${TABLE_TH} w-[6rem]`}>Amount</th>
                  <th className={`${TABLE_TH} min-w-[9rem]`}>Category</th>
                  <th className={`${TABLE_TH} min-w-[7rem]`}>Schedule</th>
                  <th className={`${TABLE_TH} min-w-[7rem]`}>Priority</th>
                  <th className={`${TABLE_TH} min-w-[6rem]`}>Status</th>
                  <th className={`${TABLE_TH} hidden lg:table-cell min-w-[8rem]`}>Account</th>
                  <th className={`${TABLE_TH} hidden lg:table-cell min-w-[9rem]`}>Method</th>
                  <th className={`${TABLE_TH} hidden xl:table-cell min-w-[8rem]`}>Institution</th>
                  <th className={`${TABLE_TH} hidden xl:table-cell min-w-[7rem]`}>Tag</th>
                  <th className={`${TABLE_TH} hidden xl:table-cell min-w-[8rem]`}>Frequency</th>
                  <th className={`${TABLE_TH} hidden md:table-cell min-w-[10rem]`}>Notes</th>
                  <th className={TABLE_TH_STICKY_ACTIONS}>Actions</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {pageItems.map((row) => {
                  const editing = editId === row.id;
                  const d = editing ? editDraft : null;
                  return (
                    <tr key={row.id} className={editing ? TABLE_ROW_EDITING : TABLE_ROW}>
                      <td className="px-4 py-3">
                        {editing && d ? (
                          <input value={d.name} onChange={(e) => updateDraft("name", e.target.value)} className={`w-full min-w-[9rem] ${TABLE_FIELD_INPUT}`} />
                        ) : (
                          <span className="text-th-secondary">{row.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editing && d ? (
                          <input type="number" step="0.01" min="0" value={d.amount} onChange={(e) => updateDraft("amount", e.target.value)} className={`w-24 ${TABLE_FIELD_INPUT_NUM}`} />
                        ) : (
                          <span className="font-medium text-white tabular-nums">${Number(row.amount).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-th-tertiary">{editing && d ? <InlineSelect value={d.category} options={PAYMENT_PLAN_CATEGORY_OPTIONS} onChange={(v) => updateDraft("category", v)} /> : formatPaymentPlanCategory(row.category)}</td>
                      <td className="px-4 py-3 text-th-tertiary">{editing && d ? <InlineSelect value={d.payment_schedule} options={PAYMENT_PLAN_SCHEDULE_OPTIONS} onChange={(v) => updateDraft("payment_schedule", v)} /> : formatPaymentPlanSchedule(row.payment_schedule)}</td>
                      <td className="px-4 py-3 text-th-tertiary">{editing && d ? <InlineSelect value={d.priority_level} options={PAYMENT_PLAN_PRIORITY_OPTIONS} onChange={(v) => updateDraft("priority_level", v)} /> : formatPaymentPlanPriority(row.priority_level)}</td>
                      <td className="px-4 py-3 text-th-tertiary">{editing && d ? <InlineSelect value={d.status} options={PAYMENT_PLAN_STATUS_OPTIONS} onChange={(v) => updateDraft("status", v)} /> : formatPaymentPlanStatus(row.status)}</td>
                      <td className="px-4 py-3 text-th-tertiary hidden lg:table-cell">
                        {editing && d ? (
                          <InlineSelect value={d.account_type} options={PAYMENT_PLAN_ACCOUNT_TYPE_OPTIONS} onChange={(v) => updateDraft("account_type", v)} />
                        ) : (
                          formatPaymentPlanAccountType(row.account_type)
                        )}
                      </td>
                      <td className="px-4 py-3 text-th-tertiary hidden lg:table-cell">{editing && d ? <InlineSelect value={d.payment_method} options={PAYMENT_PLAN_METHOD_OPTIONS} onChange={(v) => updateDraft("payment_method", v)} /> : formatPaymentPlanMethod(row.payment_method)}</td>
                      <td className="px-4 py-3 text-th-tertiary hidden xl:table-cell">
                        {editing && d ? (
                          <InlineSelect value={d.institution} options={institutionOptionsForAccountType(d.account_type)} onChange={(v) => updateDraft("institution", v)} />
                        ) : (
                          formatPaymentPlanInstitution(row.institution)
                        )}
                      </td>
                      <td className="px-4 py-3 text-th-tertiary hidden xl:table-cell">{editing && d ? <InlineSelect value={d.tag} options={PAYMENT_PLAN_TAG_OPTIONS} onChange={(v) => updateDraft("tag", v)} /> : formatPaymentPlanTag(row.tag)}</td>
                      <td className="px-4 py-3 text-th-tertiary hidden xl:table-cell">{editing && d ? <InlineSelect value={d.frequency} options={PAYMENT_PLAN_FREQUENCY_OPTIONS} onChange={(v) => updateDraft("frequency", v)} /> : formatPaymentPlanFrequency(row.frequency)}</td>
                      <td className="px-4 py-3 text-th-subtle hidden md:table-cell">
                        {editing && d ? (
                          <input value={d.notes} onChange={(e) => updateDraft("notes", e.target.value)} className={`w-full max-w-[16rem] ${TABLE_FIELD_INPUT} text-th-tertiary`} />
                        ) : (
                          <span className="block max-w-[16rem] truncate">{row.notes || "—"}</span>
                        )}
                      </td>
                      <td className={editing ? TABLE_TD_STICKY_ACTIONS_EDITING : TABLE_TD_STICKY_ACTIONS_DEFAULT}>
                        <div className="flex justify-end">
                          <RowActionsMenu
                            direction="up"
                            items={
                              editing
                                ? [
                                    { key: "save", label: editSaving ? "Saving…" : "Save", className: "text-emerald-400", disabled: editSaving, onClick: saveEdit },
                                    { key: "cancel", label: "Cancel", className: "text-th-tertiary", disabled: editSaving, onClick: cancelEdit },
                                  ]
                                : [
                                    {
                                      key: "projection",
                                      label: "Projection",
                                      className: "text-violet-400",
                                      onClick: () => setProjectionTarget({ kind: "row", row }),
                                    },
                                    { key: "edit", label: "Edit", className: "text-sky-400", onClick: () => startEdit(row) },
                                    { key: "delete", label: "Delete", className: "text-rose-400", onClick: () => remove(row.id) },
                                  ]
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationControls
              currentPage={safePage}
              totalItems={totalItems}
              pageSize={rowsPerPage}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setRowsPerPage(n);
                setPage(1);
              }}
              pageSizeOptions={TABLE_ROWS_PER_PAGE_OPTIONS}
            />
          </div>
        </div>
      ) : null}
      <ProjectionModal
        open={projectionTarget != null}
        onClose={() => setProjectionTarget(null)}
        projectionKind="payment_plan"
        projection={
          projectionTarget
            ? projectionTarget.kind === "all"
              ? computePaymentPlanSpendingProjection(filteredItems)
              : computePaymentPlanSpendingProjection([projectionTarget.row])
            : null
        }
        contextLabel={
          projectionTarget?.kind === "row"
            ? projectionContextLabel(projectionTarget.row)
            : projectionTarget?.kind === "all"
              ? "Active payment plans (combined)"
              : undefined
        }
        singleItem={projectionTarget?.kind === "row"}
        pieData={computePaymentPlanProjectionPieData(
          projectionTarget?.kind === "all"
            ? filteredItems
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        )}
        projectionItems={
          projectionTarget?.kind === "all"
            ? filteredItems
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        }
        projectionScopeKey={
          projectionTarget == null
            ? ""
            : projectionTarget.kind === "all"
              ? "payment-plans-all"
              : `payment-plan-${projectionTarget.row.id}`
        }
      />
    </div>
  );
}

function InlineSelect({ value, options, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full max-w-[13rem] ${TABLE_FIELD_INPUT}`}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="text-xs text-th-muted block">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1 w-full ${TABLE_FIELD_INPUT}`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
