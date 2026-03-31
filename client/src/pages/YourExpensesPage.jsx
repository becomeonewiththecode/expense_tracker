import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import ManualExpenseForm, { createEmptyManualExpenseForm } from "../components/ManualExpenseForm.jsx";
import ExpenseTable from "../components/ExpenseTable.jsx";
import ProjectionModal from "../components/ProjectionModal.jsx";
import { computeProjectionPieData, computeSpendingProjection } from "../projection.js";
import { formatCategory } from "../expenseOptions.js";

/** Normalize API spent_at to YYYY-MM-DD for date inputs. */
function toDateInputValue(spentAt) {
  if (spentAt == null) return "";
  const s = String(spentAt);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

function projectionContextLabel(row) {
  const cat = formatCategory(row.category);
  const note = (row.description || "").trim();
  const short = note.length > 48 ? `${note.slice(0, 46)}…` : note;
  return short ? `${cat} · ${short}` : cat;
}

export default function YourExpensesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenseEditId, setExpenseEditId] = useState(null);
  const [expenseEditDraft, setExpenseEditDraft] = useState(null);
  const [expenseSaving, setExpenseSaving] = useState(false);
  /** `all` = combined projection for every saved expense; `row` = single expense snapshot. */
  const [projectionTarget, setProjectionTarget] = useState(null);
  const [addForm, setAddForm] = useState(() => createEmptyManualExpenseForm());
  const [addSaving, setAddSaving] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [noteSearch, setNoteSearch] = useState("");

  /** Renewal and Payment Plan rows live on their own tabs, not this list. */
  const expenseListItems = useMemo(
    () => items.filter((r) => r.category !== "renewal" && r.category !== "payment_plan"),
    [items]
  );
  const filteredExpenseListItems = useMemo(() => {
    const q = noteSearch.trim().toLowerCase();
    if (!q) return expenseListItems;
    return expenseListItems.filter((r) => String(r.description ?? "").toLowerCase().includes(q));
  }, [expenseListItems, noteSearch]);

  async function load() {
    setError("");
    try {
      const { data } = await api.get("/expenses");
      setItems(data);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (filteredExpenseListItems.length === 0) {
      setExpenseEditId(null);
      setExpenseEditDraft(null);
      setProjectionTarget(null);
    }
  }, [filteredExpenseListItems.length]);

  useEffect(() => {
    if (projectionTarget?.kind !== "row") return;
    const row = items.find((r) => r.id === projectionTarget.row.id);
    if (!row || row.category === "renewal" || row.category === "payment_plan") {
      setProjectionTarget(null);
    }
  }, [items, projectionTarget]);

  function openExpenseEdit(row) {
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
      setError("Choose a renewal type for Renewal category.");
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
          expenseEditDraft.category === "renewal"
            ? expenseEditDraft.renewal_kind
            : undefined,
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
    if (!confirm("Delete this expense?")) return;
    if (expenseEditId === id) cancelExpenseEdit();
    try {
      await api.delete(`/expenses/${id}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Delete failed");
    }
  }

  async function addExpense(e) {
    e.preventDefault();
    const amount = Number(addForm.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (addForm.category === "renewal" && !addForm.renewal_kind?.trim()) {
      setError("Choose a renewal type for Renewal category.");
      return;
    }
    setAddSaving(true);
    setError("");
    try {
      await api.post("/expenses", {
        amount,
        category: addForm.category,
        renewal_kind: addForm.category === "renewal" ? addForm.renewal_kind : undefined,
        website: addForm.website || undefined,
        financial_institution: addForm.financial_institution,
        frequency: addForm.frequency,
        state: addForm.state,
        description: addForm.description,
        spent_at: addForm.spent_at,
      });
      setAddForm(createEmptyManualExpenseForm());
      setProjectionTarget(null);
      if (expenseEditId) cancelExpenseEdit();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save expense");
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Expenses</h1>
        <p className="text-sm text-slate-400 mt-1">
          {loading
            ? "Loading…"
            : "Add expenses here or on Import; review, edit, or delete. Items with category Renewal appear under Renewals, and Payment Plan items appear under Payment Plan. Default order is newest first—click a column heading to sort."}
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
            submitLabel={addSaving ? "Saving…" : "Add expense"}
            disabled={addSaving}
          />
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center space-y-3">
            <p className="text-slate-400 text-sm">
              No saved expenses yet. Use the form above or import a statement.
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
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <button
            type="button"
            onClick={() => setAddFormOpen((v) => !v)}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-slate-800/70 text-slate-200"
            aria-expanded={addFormOpen}
          >
            <span className="font-medium text-sm">Add expense manually</span>
            <span className="text-slate-500 text-xs">{addFormOpen ? "Hide" : "Show"}</span>
          </button>
          {addFormOpen ? (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <ManualExpenseForm
                form={addForm}
                setForm={setAddForm}
                onSubmit={addExpense}
                submitLabel={addSaving ? "Saving…" : "Add expense"}
                disabled={addSaving}
              />
            </div>
          ) : null}
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          {filteredExpenseListItems.length === 0 && (
            <p className="text-sm text-slate-400 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
              You only have renewal or payment plan items right now—they are listed under{" "}
              <Link to="/renewals" className="text-sky-400 hover:text-sky-300">
                Renewals
              </Link>
              {" "}and{" "}
              <Link to="/payment-plans" className="text-sky-400 hover:text-sky-300">
                Payment Plan
              </Link>
              .
            </p>
          )}
          <ExpenseTable
            items={filteredExpenseListItems}
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
            showRenewalColumns={expenseEditDraft?.category === "renewal"}
            searchValue={noteSearch}
            onSearchChange={setNoteSearch}
            searchPlaceholder="Search notes"
          />
        </>
      )}

      <ProjectionModal
        open={projectionTarget != null}
        onClose={() => setProjectionTarget(null)}
        projection={
          projectionTarget
            ? projectionTarget.kind === "all"
              ? computeSpendingProjection(filteredExpenseListItems)
              : computeSpendingProjection([projectionTarget.row])
            : null
        }
        contextLabel={
          projectionTarget?.kind === "row"
            ? projectionContextLabel(projectionTarget.row)
            : projectionTarget?.kind === "all"
              ? "All expenses (combined)"
              : undefined
        }
        singleItem={projectionTarget?.kind === "row"}
        pieData={computeProjectionPieData(
          projectionTarget?.kind === "all"
            ? filteredExpenseListItems
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        )}
        projectionItems={
          projectionTarget?.kind === "all"
            ? filteredExpenseListItems
            : projectionTarget?.kind === "row"
              ? [projectionTarget.row]
              : []
        }
        projectionScopeKey={
          projectionTarget == null
            ? ""
            : projectionTarget.kind === "all"
              ? "all"
              : String(projectionTarget.row.id)
        }
      />
    </div>
  );
}
