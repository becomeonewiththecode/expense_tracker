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
import {
  TABLE,
  TABLE_BODY,
  TABLE_CARD,
  TABLE_FIELD_INPUT,
  TABLE_HEAD,
  TABLE_ROW,
  TABLE_SCROLL,
  TABLE_TD,
  TABLE_TH,
} from "../tableStyles.js";

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
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [importFormOpen, setImportFormOpen] = useState(true);

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
    if (form.frequency === "bimonthly") {
      const pd1 = Number(form.payment_day);
      const pd2 = Number(form.payment_day_2);
      if (!Number.isInteger(pd1) || pd1 < 1 || pd1 > 30 || !Number.isInteger(pd2) || pd2 < 1 || pd2 > 30) {
        setError("Bi-monthly requires two payment days (1–30).");
        return;
      }
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
        payment_day: form.frequency === "bimonthly" ? Number(form.payment_day) : undefined,
        payment_day_2: form.frequency === "bimonthly" ? Number(form.payment_day_2) : undefined,
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
  const hasLoadedImportRows = !loading && Boolean(staging?.rows?.length);
  const hideShowControlsVisible = !hasLoadedImportRows;

  useEffect(() => {
    if (!hasLoadedImportRows) return;
    setAddFormOpen(true);
    setImportFormOpen(true);
  }, [hasLoadedImportRows]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Import</h1>
          <p className="text-sm text-th-subtle mt-1">
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
            className="shrink-0 rounded-lg border border-th-border-bright bg-th-surface-alt hover:bg-th-border-bright text-th-secondary text-sm font-medium px-3 py-2"
          >
            Expenses
          </NavLink>
        )}
      </div>

      {showOnboarding && (
        <ManualExpenseForm form={form} setForm={setForm} onSubmit={addExpense} />
      )}

      {!loading && hasSavedExpenses && (
        <div className="rounded-xl border border-th-border bg-th-surface/40 p-4">
          <div className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-th-secondary">
            <span className="font-medium text-sm">Add expense manually</span>
            {hideShowControlsVisible ? (
              <button
                type="button"
                onClick={() => setAddFormOpen((v) => !v)}
                className="text-th-muted text-xs hover:text-th-tertiary"
                aria-expanded={addFormOpen}
              >
                {addFormOpen ? "Hide" : "Show"}
              </button>
            ) : null}
          </div>
          {addFormOpen ? (
            <div className="mt-4 pt-4 border-t border-th-border">
              <ManualExpenseForm form={form} setForm={setForm} onSubmit={addExpense} />
            </div>
          ) : null}
        </div>
      )}

      {!loading && (
      <section className="rounded-xl border border-th-border bg-th-surface/30 p-4 space-y-4">
        <div className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-th-secondary">
          <h2 className="text-sm font-semibold text-white">Import from statement</h2>
          {hideShowControlsVisible ? (
            <button
              type="button"
              onClick={() => setImportFormOpen((v) => !v)}
              className="text-th-muted text-xs hover:text-th-tertiary"
              aria-expanded={importFormOpen}
            >
              {importFormOpen ? "Hide" : "Show"}
            </button>
          ) : null}
        </div>
        {importFormOpen ? (
        <>
        <p className="text-xs text-th-muted mt-1 max-w-2xl">
          Upload a <strong className="text-th-subtle">CSV</strong> or <strong className="text-th-subtle">PDF</strong>. Parsed rows appear in the <strong className="text-th-subtle">review table</strong> below.
          Set defaults for <strong className="text-th-subtle">institution</strong> and <strong className="text-th-subtle">frequency</strong> before upload. Each row’s <strong className="text-th-subtle">posted date</strong> comes from the statement. In <strong className="text-th-subtle">Review import</strong>, set <strong className="text-th-subtle">category</strong> (required). For <strong className="text-th-subtle">Renewal</strong>, also choose a <strong className="text-th-subtle">renewal type</strong> and optionally a <strong className="text-th-subtle">website</strong>; those rows appear under <strong className="text-th-subtle">Renewals</strong>. Adjust per-row <strong className="text-th-subtle">frequency</strong> if needed. Saved expenses derive recurring metadata from each line’s posted date. Only rows with a category (and a renewal type when category is Renewal) are saved when you commit. Credits / payments are skipped during parsing.
        </p>
        <form onSubmit={runImportUpload} className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="w-full sm:w-auto">
            <label htmlFor="statement-file-input" className="text-xs text-th-muted block mb-1">
              Statement file (.csv / .pdf)
            </label>
            <input
              id="statement-file-input"
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-th-tertiary file:mr-3 file:rounded-lg file:border-0 file:bg-th-border-bright file:px-3 file:py-1.5 file:text-white file:text-xs"
            />
          </div>
          <div>
            <label className="text-xs text-th-muted block mb-1">Institution (for import)</label>
            <select
              value={importDefaults.financial_institution}
              onChange={(e) =>
                setImportDefaults((d) => ({ ...d, financial_institution: e.target.value }))
              }
              className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm"
            >
              {FINANCIAL_INSTITUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-th-muted block mb-1">Frequency (for import)</label>
            <select
              value={importDefaults.frequency}
              onChange={(e) =>
                setImportDefaults((d) => ({ ...d, frequency: e.target.value }))
              }
              className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm"
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
            className="rounded-lg bg-th-border-bright hover:bg-th-muted disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
          >
            {importing ? "Uploading…" : "Upload & parse"}
          </button>
        </form>
        </>
        ) : null}
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
                className="rounded-lg border border-th-border-bright bg-transparent text-th-tertiary text-sm px-3 py-1.5 hover:bg-th-surface-alt"
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
          <div className={`${TABLE_SCROLL} ${TABLE_CARD}`}>
            <table className={`${TABLE} min-w-[64rem]`}>
              <thead className={TABLE_HEAD}>
                <tr>
                  <th className={`${TABLE_TH} whitespace-nowrap w-[9.5rem]`}>Posted</th>
                  <th className={`${TABLE_TH} w-[5.5rem]`}>Amount</th>
                  <th className={`${TABLE_TH} min-w-[10rem]`}>Category</th>
                  <th className={`${TABLE_TH} min-w-[9rem]`}>Renewal type</th>
                  <th className={`${TABLE_TH} min-w-[8rem]`}>Website</th>
                  <th className={`${TABLE_TH} min-w-[7rem]`}>Frequency</th>
                  <th className={`${TABLE_TH} min-w-[8rem]`}>Description</th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY}>
                {staging.rows.map((row) => (
                  <tr key={row.id} className={TABLE_ROW}>
                    <td className={`${TABLE_TD} text-th-tertiary whitespace-nowrap`}>{row.spent_at}</td>
                    <td className={`${TABLE_TD} font-medium text-white tabular-nums`}>
                      ${Number(row.amount).toFixed(2)}
                    </td>
                    <td className={TABLE_TD}>
                      <select
                        value={row.category || ""}
                        onChange={(e) =>
                          patchImportStagingRow(row.id, { category: e.target.value || null })
                        }
                        className={`w-full max-w-[12rem] ${TABLE_FIELD_INPUT}`}
                      >
                        <option value="">— Select category —</option>
                        {CATEGORY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={TABLE_TD}>
                      {row.category === "renewal" ? (
                        <select
                          value={row.renewal_kind || ""}
                          onChange={(e) =>
                            patchImportStagingRow(row.id, { renewal_kind: e.target.value || null })
                          }
                          className={`w-full max-w-[13rem] ${TABLE_FIELD_INPUT}`}
                        >
                          <option value="">— Type —</option>
                          {RENEWAL_KIND_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-th-muted text-xs">—</span>
                      )}
                    </td>
                    <td className={TABLE_TD}>
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
                          className={`w-full max-w-[14rem] ${TABLE_FIELD_INPUT} text-th-tertiary`}
                          placeholder="Optional"
                        />
                      ) : (
                        <span className="text-th-muted text-xs">—</span>
                      )}
                    </td>
                    <td className={TABLE_TD}>
                      <select
                        value={
                          row.frequency ||
                          staging.batch?.default_frequency ||
                          "once"
                        }
                        onChange={(e) =>
                          patchImportStagingRow(row.id, { frequency: e.target.value })
                        }
                        className={`w-full max-w-[9rem] ${TABLE_FIELD_INPUT}`}
                      >
                        {FREQUENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={`${TABLE_TD} text-th-subtle max-w-md truncate`}>{row.description}</td>
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
