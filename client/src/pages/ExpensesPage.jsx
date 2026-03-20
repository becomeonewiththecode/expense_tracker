import { useEffect, useState, useCallback } from "react";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import {
  CATEGORY_OPTIONS,
  FREQUENCY_OPTIONS,
  FINANCIAL_INSTITUTION_OPTIONS,
  PAYMENT_DAY_OPTIONS,
  IMPORT_PAYMENT_DAY_OPTIONS,
  formatCategory,
  formatFinancialInstitution,
  formatFrequency,
  formatPaymentDay,
} from "../expenseOptions.js";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

/** Normalize API spent_at to YYYY-MM-DD for date inputs. */
function toDateInputValue(spentAt) {
  if (spentAt == null) return "";
  const s = String(spentAt);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

export default function ExpensesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    amount: "",
    category: "personal",
    financial_institution: "bank",
    frequency: "monthly",
    payment_day: "",
    description: "",
    spent_at: todayISODate(),
  });
  const [importFile, setImportFile] = useState(null);
  const [importDefaults, setImportDefaults] = useState({
    financial_institution: "visa",
    frequency: "once",
    payment_day: "",
  });
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [staging, setStaging] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [expenseEditId, setExpenseEditId] = useState(null);
  const [expenseEditDraft, setExpenseEditDraft] = useState(null);
  const [expenseSaving, setExpenseSaving] = useState(false);

  const loadStaging = useCallback(async () => {
    try {
      const { data } = await api.get("/imports/latest");
      setStaging(data);
    } catch {
      setStaging(null);
    }
  }, []);

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
    loadStaging();
  }, [loadStaging]);

  async function addExpense(e) {
    e.preventDefault();
    setError("");
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount");
      return;
    }
    try {
      await api.post("/expenses", {
        amount,
        category: form.category,
        financial_institution: form.financial_institution,
        frequency: form.frequency,
        ...(form.payment_day !== "" && { payment_day: Number(form.payment_day) }),
        description: form.description,
        spent_at: form.spent_at,
      });
      setForm({
        amount: "",
        category: "personal",
        financial_institution: "bank",
        frequency: "monthly",
        payment_day: "",
        description: "",
        spent_at: todayISODate(),
      });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save");
    }
  }

  function openExpenseEdit(row) {
    setError("");
    setExpenseEditId(row.id);
    setExpenseEditDraft({
      spent_at: toDateInputValue(row.spent_at),
      amount: String(row.amount),
      category: row.category,
      frequency: row.frequency,
      payment_day: row.payment_day != null ? String(row.payment_day) : "",
      financial_institution: row.financial_institution,
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
    setExpenseSaving(true);
    setError("");
    try {
      await api.patch(`/expenses/${expenseEditId}`, {
        spent_at: expenseEditDraft.spent_at,
        amount,
        category: expenseEditDraft.category,
        frequency: expenseEditDraft.frequency,
        financial_institution: expenseEditDraft.financial_institution,
        description: expenseEditDraft.description,
        payment_day:
          expenseEditDraft.payment_day === ""
            ? null
            : Number(expenseEditDraft.payment_day),
      });
      cancelExpenseEdit();
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

  async function runImportUpload(e) {
    e.preventDefault();
    setError("");
    setImportNotice("");
    if (!importFile) {
      setError("Choose a CSV or PDF statement file.");
      return;
    }
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("financial_institution", importDefaults.financial_institution);
      fd.append("frequency", importDefaults.frequency);
      fd.append("payment_day", importDefaults.payment_day);
      const { data } = await api.post("/imports", fd);
      setStaging({
        batch: data.batch,
        rows: data.rows || [],
      });
      const w = data.warnings?.filter(Boolean).join(" ") || "";
      setImportNotice(
        `${data.rows?.length ?? 0} row(s) loaded for review. Assign a category to each row you want to keep; adjust frequency or payment day if needed, then click “Add categorized rows to expenses”.${w ? ` ${w}` : ""}`
      );
      setImportFile(null);
      const input = document.getElementById("statement-file-input");
      if (input) input.value = "";
    } catch (err) {
      const d = err.response?.data;
      setError(
        d?.error ||
          (err.response?.status === 422
            ? d?.message || "No rows could be parsed from this file."
            : getApiErrorMessage(err, "Import failed"))
      );
      if (d?.warnings?.length) {
        setImportNotice(d.warnings.join(" "));
      }
    } finally {
      setImporting(false);
    }
  }

  async function patchImportStagingRow(rowId, body) {
    setError("");
    try {
      const { data } = await api.patch(`/imports/rows/${rowId}`, body);
      setStaging((prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((r) => (r.id === rowId ? data : r)),
            }
          : null
      );
    } catch (err) {
      setError(err.response?.data?.error || "Could not update row");
    }
  }

  async function commitStaging() {
    if (!staging?.batch?.id) return;
    const categorized = staging.rows.filter((r) => r.category);
    if (!categorized.length) {
      setError("Select at least one category to import anything.");
      return;
    }
    setError("");
    setCommitting(true);
    try {
      const { data } = await api.post(`/imports/batches/${staging.batch.id}/commit`);
      setImportNotice(
        `Added ${data.added} expense(s).${data.skipped ? ` ${data.skipped} row(s) had no category and were skipped.` : ""}`
      );
      setStaging(null);
      await loadStaging();
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Could not commit import");
    } finally {
      setCommitting(false);
    }
  }

  async function discardStaging() {
    if (!staging?.batch?.id) return;
    if (!confirm("Discard this import and all staged rows?")) return;
    setError("");
    try {
      await api.delete(`/imports/batches/${staging.batch.id}`);
      setStaging(null);
      setImportNotice("Import discarded.");
      loadStaging();
    } catch (err) {
      setError(err.response?.data?.error || "Could not discard import");
    }
  }

  const uncategorizedCount = staging ? staging.rows.filter((r) => !r.category).length : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Expenses</h1>
        <p className="text-sm text-slate-400 mt-1">Add and review your spending.</p>
      </div>

      <form
        onSubmit={addExpense}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-8 items-end bg-slate-900/50 border border-slate-800 rounded-xl p-4"
      >
        <div>
          <label className="text-xs text-slate-500 block mb-1">Amount</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
            placeholder="0.00"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Frequency</label>
          <select
            value={form.frequency}
            onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">
            Date{" "}
            <span className="text-slate-600 font-normal normal-case">(1–30)</span>
          </label>
          <select
            value={form.payment_day}
            onChange={(e) => setForm((f) => ({ ...f, payment_day: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
            title="Day of the month the payment is typically made"
            aria-label="Date as day of month, 1 to 30"
          >
            {PAYMENT_DAY_OPTIONS.map((o) => (
              <option key={o.value === "" ? "unset" : o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Financial institution</label>
          <select
            value={form.financial_institution}
            onChange={(e) =>
              setForm((f) => ({ ...f, financial_institution: e.target.value }))
            }
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
          >
            {FINANCIAL_INSTITUTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-1">Transaction date</label>
          <input
            type="date"
            value={form.spent_at}
            onChange={(e) => setForm((f) => ({ ...f, spent_at: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
            required
          />
        </div>
        <div className="sm:col-span-2 xl:col-span-2">
          <label className="text-xs text-slate-500 block mb-1">Note</label>
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:ring-2 focus:ring-emerald-500/40 outline-none"
            placeholder="Optional"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 px-4 justify-self-start sm:col-span-2 xl:col-span-8"
        >
          Add expense
        </button>
      </form>

      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Import from statement</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Upload a <strong className="text-slate-400">CSV</strong> or <strong className="text-slate-400">PDF</strong>. Parsed rows appear in the <strong className="text-slate-400">review table</strong> below.
            Set defaults for <strong className="text-slate-400">institution</strong>, <strong className="text-slate-400">frequency</strong>, and optionally <strong className="text-slate-400">Date (1–30)</strong> before upload (or choose <strong className="text-slate-400">From statement</strong> to take the day from each line). In <strong className="text-slate-400">Review import</strong>, set <strong className="text-slate-400">category</strong> (required), and adjust per-row <strong className="text-slate-400">frequency</strong> / <strong className="text-slate-400">Date</strong> if needed. Only rows with a category are saved when you commit. Credits / payments are skipped during parsing.
          </p>
        </div>
        <form onSubmit={runImportUpload} className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="w-full sm:w-auto">
            <label htmlFor="statement-file-input" className="text-xs text-slate-500 block mb-1">
              Statement file (.csv / .pdf)
            </label>
            <input
              id="statement-file-input"
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-white file:text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Institution (for import)</label>
            <select
              value={importDefaults.financial_institution}
              onChange={(e) =>
                setImportDefaults((d) => ({ ...d, financial_institution: e.target.value }))
              }
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
            >
              {FINANCIAL_INSTITUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Frequency (for import)</label>
            <select
              value={importDefaults.frequency}
              onChange={(e) =>
                setImportDefaults((d) => ({ ...d, frequency: e.target.value }))
              }
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
            >
              {FREQUENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">
              Date (for import){" "}
              <span className="text-slate-600 font-normal normal-case">(1–30)</span>
            </label>
            <select
              value={importDefaults.payment_day}
              onChange={(e) =>
                setImportDefaults((d) => ({ ...d, payment_day: e.target.value }))
              }
              className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm"
              title="Apply this day of month to every imported row, or use each line’s posting date"
              aria-label="Import default payment day, 1 to 30, or from statement"
            >
              {IMPORT_PAYMENT_DAY_OPTIONS.map((o) => (
                <option key={o.value === "" ? "from-statement" : o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={importing}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
          >
            {importing ? "Uploading…" : "Upload & parse"}
          </button>
        </form>
      </section>

      {staging && staging.rows?.length > 0 && (
        <section className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-100">Review import</h2>
              <p className="text-xs text-amber-200/60 mt-0.5">
                {staging.batch?.source_filename || "Statement"} · {staging.rows.length} row(s)
                {uncategorizedCount > 0
                  ? ` · ${uncategorizedCount} without category (will not be imported)`
                  : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={discardStaging}
                className="rounded-lg border border-slate-600 bg-transparent text-slate-300 text-sm px-3 py-1.5 hover:bg-slate-800"
              >
                Discard import
              </button>
              <button
                type="button"
                disabled={committing}
                onClick={commitStaging}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5"
              >
                {committing ? "Saving…" : "Add categorized rows to expenses"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2">Posted</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2 min-w-[10rem]">Category</th>
                  <th className="px-3 py-2 min-w-[7rem]">Frequency</th>
                  <th className="px-3 py-2 min-w-[4.5rem]">
                    Date <span className="normal-case font-normal text-slate-500">(1–30)</span>
                  </th>
                  <th className="px-3 py-2">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/40">
                {staging.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-slate-300 whitespace-nowrap">{row.spent_at}</td>
                    <td className="px-3 py-2 text-white tabular-nums">
                      ${Number(row.amount).toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={row.category || ""}
                        onChange={(e) =>
                          patchImportStagingRow(row.id, { category: e.target.value })
                        }
                        className="w-full max-w-[12rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        <option value="">— Select category —</option>
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={
                          row.frequency ||
                          staging.batch?.default_frequency ||
                          "once"
                        }
                        onChange={(e) =>
                          patchImportStagingRow(row.id, { frequency: e.target.value })
                        }
                        className="w-full max-w-[9rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                      >
                        {FREQUENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={
                          row.payment_day != null && row.payment_day !== ""
                            ? String(row.payment_day)
                            : ""
                        }
                        onChange={(e) =>
                          patchImportStagingRow(row.id, {
                            payment_day:
                              e.target.value === "" ? null : Number(e.target.value),
                          })
                        }
                        className="w-full max-w-[5rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                        title="Day of month (1–30)"
                        aria-label="Payment day, 1 to 30"
                      >
                        {PAYMENT_DAY_OPTIONS.map((o) => (
                          <option key={o.value === "" ? "unset" : o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-md truncate">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {importNotice && (
        <p className="text-sm text-emerald-400/90 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-3 py-2">
          {importNotice}
        </p>
      )}

      {error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">Transaction</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 hidden lg:table-cell">Frequency</th>
              <th className="px-4 py-3 hidden lg:table-cell">
                Date <span className="normal-case font-normal text-slate-500">(1–30)</span>
              </th>
              <th className="px-4 py-3 hidden md:table-cell">Institution</th>
              <th className="px-4 py-3 hidden sm:table-cell">Note</th>
              <th className="px-4 py-3 text-right min-w-[6.5rem]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  No expenses yet. Add one above.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const editing = expenseEditId === row.id;
                const d = expenseEditDraft;
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
                      className={`px-4 py-3 text-slate-300 align-middle tabular-nums ${editing ? "" : "hidden lg:table-cell"}`}
                    >
                      {editing && d ? (
                        <select
                          value={d.payment_day}
                          onChange={(e) =>
                            setExpenseEditDraft((prev) =>
                              prev ? { ...prev, payment_day: e.target.value } : prev
                            )
                          }
                          className="w-full max-w-[4.5rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                          title="Day of month (1–30)"
                        >
                          {PAYMENT_DAY_OPTIONS.map((o) => (
                            <option key={o.value === "" ? "unset" : o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        formatPaymentDay(row.payment_day)
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
                              prev
                                ? { ...prev, financial_institution: e.target.value }
                                : prev
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
                    <td className="px-4 py-3 text-right align-middle whitespace-nowrap">
                      {editing ? (
                        <div className="flex flex-col gap-1 items-end sm:flex-row sm:justify-end sm:gap-2">
                          <button
                            type="button"
                            disabled={expenseSaving}
                            onClick={() => saveExpenseEdit()}
                            className="text-emerald-400 hover:text-emerald-300 text-xs disabled:opacity-50"
                          >
                            {expenseSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={expenseSaving}
                            onClick={cancelExpenseEdit}
                            className="text-slate-400 hover:text-slate-300 text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-end sm:flex-row sm:justify-end sm:gap-2">
                          <button
                            type="button"
                            onClick={() => openExpenseEdit(row)}
                            className="text-sky-400 hover:text-sky-300 text-xs"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(row.id)}
                            className="text-rose-400 hover:text-rose-300 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
