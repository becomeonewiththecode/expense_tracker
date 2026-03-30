import { useEffect, useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import {
  CATEGORY_OPTIONS,
  FINANCIAL_INSTITUTION_OPTIONS,
  FREQUENCY_OPTIONS,
  RENEWAL_KIND_OPTIONS,
} from "../expenseOptions.js";
import ManualExpenseForm, { createEmptyManualExpenseForm } from "../components/ManualExpenseForm.jsx";

export default function ExpensesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => createEmptyManualExpenseForm());
  const [importFile, setImportFile] = useState(null);
  const [importDefaults, setImportDefaults] = useState({
    financial_institution: "visa",
    frequency: "once",
  });
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const [staging, setStaging] = useState(null);
  const [committing, setCommitting] = useState(false);

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
    if (form.category === "renewal" && !form.renewal_kind?.trim()) {
      setError("Choose a renewal type when category is Renewal.");
      return;
    }
    const wasEmpty = items.length === 0;
    try {
      await api.post("/expenses", {
        amount,
        category: form.category,
        renewal_kind: form.category === "renewal" ? form.renewal_kind : undefined,
        website: form.website || undefined,
        financial_institution: form.financial_institution,
        frequency: form.frequency,
        state: form.state,
        description: form.description,
        spent_at: form.spent_at,
      });
      setForm(createEmptyManualExpenseForm());
      await load();
      if (wasEmpty) navigate("/expenses/list", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "Could not save");
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
      const { data } = await api.post("/imports", fd);
      setStaging({
        batch: data.batch,
        rows: data.rows || [],
      });
      const w = data.warnings?.filter(Boolean).join(" ") || "";
      setImportNotice(
        `${data.rows?.length ?? 0} row(s) loaded for review. Assign a category to each row you want to keep; adjust frequency if needed, then click “Add categorized rows to expenses”.${w ? ` ${w}` : ""}`
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
    const categorized = staging.rows.filter(
      (r) => r.category && (r.category !== "renewal" || r.renewal_kind)
    );
    const needsRenewalType = staging.rows.some((r) => r.category === "renewal" && !r.renewal_kind);
    if (!categorized.length) {
      setError(
        needsRenewalType
          ? "Rows marked Renewal need a renewal type before import."
          : "Select at least one category to import anything."
      );
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
      await load();
      if (data.added > 0) navigate("/expenses/list");
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

  const uncategorizedCount = staging
    ? staging.rows.filter((r) => !r.category || (r.category === "renewal" && !r.renewal_kind)).length
    : 0;

  const hasSavedExpenses = items.length > 0;
  const showOnboarding = !loading && !hasSavedExpenses;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Import</h1>
          <p className="text-sm text-slate-400 mt-1">
            {loading
              ? "Loading…"
              : showOnboarding
                ? "Add an expense manually, or import a statement to get started."
                : "Import from a statement, or open Expenses to review saved transactions."}
          </p>
        </div>
        {!loading && hasSavedExpenses && (
          <NavLink
            to="/expenses/list"
            className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-3 py-2"
          >
            Expenses
          </NavLink>
        )}
      </div>

      {showOnboarding && (
        <ManualExpenseForm form={form} setForm={setForm} onSubmit={addExpense} />
      )}

      {!loading && hasSavedExpenses && (
        <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 group">
          <summary className="cursor-pointer text-sm font-medium text-slate-200 list-none [&::-webkit-details-marker]:hidden flex items-center gap-2">
            <span className="text-slate-500 group-open:rotate-90 transition-transform inline-block">▸</span>
            Add expense manually
          </summary>
          <div className="mt-4 pt-4 border-t border-slate-800">
            <ManualExpenseForm form={form} setForm={setForm} onSubmit={addExpense} />
          </div>
        </details>
      )}

      {!loading && (
      <section className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Import from statement</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Upload a <strong className="text-slate-400">CSV</strong> or <strong className="text-slate-400">PDF</strong>. Parsed rows appear in the <strong className="text-slate-400">review table</strong> below.
            Set defaults for <strong className="text-slate-400">institution</strong> and <strong className="text-slate-400">frequency</strong> before upload. Each row’s <strong className="text-slate-400">posted date</strong> comes from the statement. In <strong className="text-slate-400">Review import</strong>, set <strong className="text-slate-400">category</strong> (required). For <strong className="text-slate-400">Renewal</strong>, also choose a <strong className="text-slate-400">renewal type</strong> and optionally a <strong className="text-slate-400">website</strong>; those rows appear under <strong className="text-slate-400">Renewals</strong>. Adjust per-row <strong className="text-slate-400">frequency</strong> if needed. Saved expenses derive recurring metadata from each line’s posted date. Only rows with a category (and a renewal type when category is Renewal) are saved when you commit. Credits / payments are skipped during parsing.
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
          <button
            type="submit"
            disabled={importing}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
          >
            {importing ? "Uploading…" : "Upload & parse"}
          </button>
        </form>
      </section>
      )}

      {!loading && staging && staging.rows?.length > 0 && (
        <section className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-amber-100">Review import</h2>
              <p className="text-xs text-amber-200/60 mt-0.5">
                {staging.batch?.source_filename || "Statement"} · {staging.rows.length} row(s)
                {uncategorizedCount > 0
                  ? ` · ${uncategorizedCount} not ready (no category, or Renewal without a type)`
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
                  <th className="px-3 py-2 min-w-[9rem]">Renewal type</th>
                  <th className="px-3 py-2 min-w-[8rem]">Website</th>
                  <th className="px-3 py-2 min-w-[7rem]">Frequency</th>
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
                          patchImportStagingRow(row.id, { category: e.target.value || null })
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
                      {row.category === "renewal" ? (
                        <select
                          value={row.renewal_kind || ""}
                          onChange={(e) =>
                            patchImportStagingRow(row.id, { renewal_kind: e.target.value || null })
                          }
                          className="w-full max-w-[13rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-white text-xs"
                        >
                          <option value="">— Type —</option>
                          {RENEWAL_KIND_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.category === "renewal" ? (
                        <input
                          type="text"
                          defaultValue={row.website || ""}
                          key={`${row.id}-${row.website || ""}`}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (row.website || "")) {
                              patchImportStagingRow(row.id, { website: v || null });
                            }
                          }}
                          className="w-full max-w-[14rem] rounded-lg bg-slate-950 border border-slate-600 px-2 py-1 text-slate-300 text-xs"
                          placeholder="Optional"
                        />
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
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
                    <td className="px-3 py-2 text-slate-400 max-w-md truncate">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && importNotice && (
        <p className="text-sm text-emerald-400/90 bg-emerald-950/30 border border-emerald-900/50 rounded-lg px-3 py-2">
          {importNotice}
        </p>
      )}

      {!loading && error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
