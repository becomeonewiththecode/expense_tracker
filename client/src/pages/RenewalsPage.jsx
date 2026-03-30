import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import ManualExpenseForm, { createEmptyManualExpenseForm } from "../components/ManualExpenseForm.jsx";
import ExpenseTable from "../components/ExpenseTable.jsx";
import ProjectionModal from "../components/ProjectionModal.jsx";
import { computeProjectionPieData, computeSpendingProjection } from "../projection.js";
import { formatRenewalKind } from "../expenseOptions.js";

function toDateInputValue(spentAt) {
  if (spentAt == null) return "";
  const s = String(spentAt);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

function projectionContextLabel(row) {
  const kind = formatRenewalKind(row.renewal_kind);
  const note = (row.description || "").trim();
  const short = note.length > 48 ? `${note.slice(0, 46)}…` : note;
  return short ? `${kind} · ${short}` : kind;
}

function createRenewalManualForm() {
  return {
    ...createEmptyManualExpenseForm(),
    category: "renewal",
    frequency: "yearly",
  };
}

export default function RenewalsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenseEditId, setExpenseEditId] = useState(null);
  const [expenseEditDraft, setExpenseEditDraft] = useState(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expensesModifyMode, setExpensesModifyMode] = useState(false);
  const [projectionTarget, setProjectionTarget] = useState(null);
  const [addForm, setAddForm] = useState(() => createRenewalManualForm());
  const [addSaving, setAddSaving] = useState(false);

  async function load() {
    setError("");
    try {
      const { data } = await api.get("/expenses", { params: { category: "renewal", limit: 500 } });
      setItems(data);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load renewals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setExpensesModifyMode(false);
      setExpenseEditId(null);
      setExpenseEditDraft(null);
      setProjectionTarget(null);
    }
  }, [items.length]);

  useEffect(() => {
    if (
      projectionTarget?.kind === "row" &&
      !items.some((r) => r.id === projectionTarget.row.id)
    ) {
      setProjectionTarget(null);
    }
  }, [items, projectionTarget]);

  function openExpenseEdit(row) {
    if (!expensesModifyMode) return;
    setError("");
    setExpenseEditId(row.id);
    setExpenseEditDraft({
      spent_at: toDateInputValue(row.spent_at),
      amount: String(row.amount),
      category: row.category,
      renewal_kind: row.renewal_kind ?? "",
      website: row.website ?? "",
      frequency: row.frequency,
      financial_institution: row.financial_institution,
      state: row.state === "cancel" ? "cancel" : "active",
      description: row.description ?? "",
    });
  }

  function cancelExpenseEdit() {
    setExpenseEditId(null);
    setExpenseEditDraft(null);
  }

  async function saveExpenseEdit() {
    if (!expenseEditId || !expenseEditDraft) return;
    const amount = Number(expenseEditDraft.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (expenseEditDraft.category === "renewal" && !expenseEditDraft.renewal_kind?.trim()) {
      setError("Choose a renewal type.");
      return;
    }
    setExpenseSaving(true);
    setError("");
    try {
      await api.patch(`/expenses/${expenseEditId}`, {
        spent_at: expenseEditDraft.spent_at,
        amount,
        category: expenseEditDraft.category,
        renewal_kind:
          expenseEditDraft.category === "renewal" ? expenseEditDraft.renewal_kind : undefined,
        website: expenseEditDraft.website,
        frequency: expenseEditDraft.frequency,
        financial_institution: expenseEditDraft.financial_institution,
        state: expenseEditDraft.state,
        description: expenseEditDraft.description,
      });
      cancelExpenseEdit();
      setProjectionTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save changes");
    } finally {
      setExpenseSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this renewal item?")) return;
    if (expenseEditId === id) cancelExpenseEdit();
    try {
      await api.delete(`/expenses/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Delete failed");
    }
  }

  function setModifyMode(v) {
    if (v) setError("");
    setExpensesModifyMode(v);
  }

  async function addExpense(e) {
    e.preventDefault();
    const amount = Number(addForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!addForm.renewal_kind?.trim()) {
      setError("Choose a renewal type.");
      return;
    }
    setAddSaving(true);
    setError("");
    try {
      await api.post("/expenses", {
        amount,
        category: "renewal",
        renewal_kind: addForm.renewal_kind,
        website: addForm.website || undefined,
        financial_institution: addForm.financial_institution,
        frequency: addForm.frequency,
        state: addForm.state,
        description: addForm.description,
        spent_at: addForm.spent_at,
      });
      setAddForm(createRenewalManualForm());
      setProjectionTarget(null);
      if (expenseEditId) cancelExpenseEdit();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save");
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Renewals</h1>
        <p className="text-sm text-slate-400 mt-1">
          {loading
            ? "Loading…"
            : "Track renewals on unusual schedules (annual, multi-year, and other frequencies). Each row is an expense with category Renewal, a renewal type, and an optional website. On Import, choose category Renewal and pick a type for each line you want listed here."}
        </p>
      </div>

      {!loading && error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="space-y-4">
          <ManualExpenseForm
            form={addForm}
            setForm={setAddForm}
            onSubmit={addExpense}
            submitLabel={addSaving ? "Saving…" : "Add renewal"}
            disabled={addSaving}
          />
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center space-y-3">
            <p className="text-slate-400 text-sm">
              No renewal items yet. Add one above, or import a statement and set category to{" "}
              <strong className="text-slate-300">Renewal</strong> plus a renewal type for each row.
            </p>
            <Link
              to="/expenses"
              className="inline-block rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium py-2 px-4"
            >
              Go to Import
            </Link>
          </div>
        </div>
      )}

      {!loading && items.length > 0 && (
        <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-200 list-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
            <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▸</span>
            Add renewal manually
          </summary>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <ManualExpenseForm
              form={addForm}
              setForm={setAddForm}
              onSubmit={addExpense}
              submitLabel={addSaving ? "Saving…" : "Add renewal"}
              disabled={addSaving}
            />
          </div>
        </details>
      )}

      {!loading && items.length > 0 && (
        <ExpenseTable
          items={items}
          expensesModifyMode={expensesModifyMode}
          setExpensesModifyMode={setModifyMode}
          expenseEditId={expenseEditId}
          expenseEditDraft={expenseEditDraft}
          setExpenseEditDraft={setExpenseEditDraft}
          expenseSaving={expenseSaving}
          openExpenseEdit={openExpenseEdit}
          cancelExpenseEdit={cancelExpenseEdit}
          saveExpenseEdit={saveExpenseEdit}
          remove={remove}
          onProjection={() => setProjectionTarget({ kind: "all" })}
          onRowProjection={(row) => setProjectionTarget({ kind: "row", row })}
          showRenewalColumns
          tableTitle="Renewal items"
        />
      )}

      <ProjectionModal
        open={projectionTarget != null}
        onClose={() => setProjectionTarget(null)}
        projection={
          projectionTarget
            ? projectionTarget.kind === "all"
              ? computeSpendingProjection(items)
              : computeSpendingProjection([projectionTarget.row])
            : null
        }
        contextLabel={
          projectionTarget?.kind === "row"
            ? projectionContextLabel(projectionTarget.row)
            : projectionTarget?.kind === "all"
              ? "All renewals (combined)"
              : undefined
        }
        singleItem={projectionTarget?.kind === "row"}
        pieData={computeProjectionPieData(
          projectionTarget?.kind === "all"
            ? items
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        )}
        projectionItems={
          projectionTarget?.kind === "all"
            ? items
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        }
        projectionScopeKey={
          projectionTarget == null
            ? ""
            : projectionTarget.kind === "all"
              ? "renewals-all"
              : String(projectionTarget.row.id)
        }
      />
    </div>
  );
}
