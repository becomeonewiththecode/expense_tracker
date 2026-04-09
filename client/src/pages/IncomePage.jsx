import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { FREQUENCY_OPTIONS } from "../expenseOptions.js";

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return `$${x.toFixed(2)}`;
}

function emptyIncomeDraft() {
  return {
    amount: "",
    frequency: "monthly",
    description: "",
    receivedAt: todayISODate(),
    paymentDay: "",
    paymentDay2: "",
  };
}

function normalizeIncomeDraft(row) {
  return {
    amount: String(row.amount ?? ""),
    frequency: row.frequency || "monthly",
    description: row.description || "",
    receivedAt: String(row.received_at || todayISODate()).slice(0, 10),
    paymentDay: row.payment_day != null ? String(row.payment_day) : "",
    paymentDay2: row.payment_day_2 != null ? String(row.payment_day_2) : "",
  };
}

function IncomeFormFields({ draft, setDraft }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div>
        <label className="text-xs text-th-muted block mb-1">Amount ($)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.amount}
          onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
          className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
          required
        />
      </div>
      <div>
        <label className="text-xs text-th-muted block mb-1">Frequency</label>
        <select
          value={draft.frequency}
          onChange={(e) => setDraft((d) => ({ ...d, frequency: e.target.value }))}
          className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs text-th-muted block mb-1">Description</label>
        <input
          type="text"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="e.g. Paycheck"
          className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
        />
      </div>
      {draft.frequency === "bimonthly" ? (
        <>
          <div>
            <label className="text-xs text-th-muted block mb-1">1st pay day of month</label>
            <input
              type="number"
              min="1"
              max="30"
              value={draft.paymentDay}
              onChange={(e) => setDraft((d) => ({ ...d, paymentDay: e.target.value }))}
              placeholder="1-30"
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="text-xs text-th-muted block mb-1">2nd pay day of month</label>
            <input
              type="number"
              min="1"
              max="30"
              value={draft.paymentDay2}
              onChange={(e) => setDraft((d) => ({ ...d, paymentDay2: e.target.value }))}
              placeholder="1-30"
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-th-muted block mb-1">Reference date</label>
            <input
              type="date"
              value={draft.receivedAt}
              onChange={(e) => setDraft((d) => ({ ...d, receivedAt: e.target.value }))}
              className="w-full max-w-xs rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
              required
            />
            <p className="text-[10px] text-th-muted mt-1">
              Used to sort this row in the list; pay days above define your twice-monthly schedule for projections.
            </p>
          </div>
        </>
      ) : (
        <div>
          <label className="text-xs text-th-muted block mb-1">Received date</label>
          <input
            type="date"
            value={draft.receivedAt}
            onChange={(e) => setDraft((d) => ({ ...d, receivedAt: e.target.value }))}
            className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white"
            required
          />
        </div>
      )}
    </div>
  );
}

/** @param {{ embedded?: boolean }} props When true, hide the page title (used under Budget hub). */
export default function IncomePage({ embedded = false }) {
  const [items, setItems] = useState([]);
  const [runRate, setRunRate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(emptyIncomeDraft);
  const [editId, setEditId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [incRes, rrRes] = await Promise.all([
        api.get("/income", { params: { limit: 200 } }),
        api.get("/reports/run-rate-vs-income"),
      ]);
      setItems(Array.isArray(incRes.data) ? incRes.data : []);
      setRunRate(rrRes.data && typeof rrRes.data === "object" ? rrRes.data : null);
    } catch (e) {
      setError(e.response?.data?.error || "Failed to load income");
      setRunRate(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (draft.frequency !== "bimonthly") {
      setDraft((d) => ({ ...d, paymentDay: "", paymentDay2: "" }));
    }
  }, [draft.frequency]);

  useEffect(() => {
    if (!editDraft || editDraft.frequency === "bimonthly") return;
    if (editDraft.paymentDay === "" && editDraft.paymentDay2 === "") return;
    setEditDraft((d) => ({ ...d, paymentDay: "", paymentDay2: "" }));
  }, [editDraft]);

  async function handleAdd(e) {
    e.preventDefault();
    const amt = Number(draft.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (draft.frequency === "bimonthly") {
      const d1 = Number(draft.paymentDay);
      const d2 = Number(draft.paymentDay2);
      if (!Number.isInteger(d1) || d1 < 1 || d1 > 30 || !Number.isInteger(d2) || d2 < 1 || d2 > 30) {
        setError("Enter both pay days as whole numbers from 1 to 30.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        amount: amt,
        frequency: draft.frequency,
        description: draft.description.trim(),
        received_at: draft.receivedAt,
      };
      if (draft.frequency === "bimonthly") {
        body.payment_day = Number(draft.paymentDay);
        body.payment_day_2 = Number(draft.paymentDay2);
      }
      await api.post("/income", body);
      setDraft(emptyIncomeDraft());
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Could not save income");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id) {
    if (!window.confirm("Delete this income entry?")) return;
    setError("");
    try {
      await api.delete(`/income/${id}`);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Could not delete");
    }
  }

  function startEdit(row) {
    setError("");
    setEditId(row.id);
    setEditDraft(normalizeIncomeDraft(row));
  }

  function cancelEdit() {
    setEditId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editId || !editDraft) return;
    const amt = Number(editDraft.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setError("Enter a valid amount");
      return;
    }
    if (editDraft.frequency === "bimonthly") {
      const d1 = Number(editDraft.paymentDay);
      const d2 = Number(editDraft.paymentDay2);
      if (!Number.isInteger(d1) || d1 < 1 || d1 > 30 || !Number.isInteger(d2) || d2 < 1 || d2 > 30) {
        setError("Enter both pay days as whole numbers from 1 to 30.");
        return;
      }
    }
    setEditSaving(true);
    setError("");
    try {
      const body = {
        amount: amt,
        frequency: editDraft.frequency,
        description: editDraft.description.trim(),
        received_at: editDraft.receivedAt,
      };
      if (editDraft.frequency === "bimonthly") {
        body.payment_day = Number(editDraft.paymentDay);
        body.payment_day_2 = Number(editDraft.paymentDay2);
      }
      await api.patch(`/income/${editId}`, body);
      cancelEdit();
      await load();
    } catch (e) {
      setError(e.response?.data?.error || "Could not update income");
    } finally {
      setEditSaving(false);
    }
  }

  function formatDateCell(row) {
    if (row.frequency === "bimonthly" && row.payment_day != null && row.payment_day_2 != null) {
      return `Pay days ${row.payment_day} & ${row.payment_day_2} (ref ${row.received_at})`;
    }
    return row.received_at;
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-xl font-semibold text-white">Income</h1>
          <p className="text-sm text-th-subtle mt-1">
            Log paychecks, transfers in, and other income. Amounts count toward monthly cash flow on Reports and toward
            projection net when you open the projection view from Reports. For bi-monthly income, enter the two calendar
            days of the month you are paid (same idea as expenses).
          </p>
        </div>
      )}

      {runRate && !loading && (
        <div className="space-y-3">
          {!runRate.hasIncomeEntries ? (
            <p className="text-sm text-th-muted rounded-xl border border-th-border bg-th-surface/20 px-4 py-3">
              Add at least one income entry to compare your <strong className="text-th-tertiary">recurring</strong>{" "}
              income run rate against active expenses (including renewals), prescriptions, and payment plans.
            </p>
          ) : !runRate.hasRecurringIncome ? (
            <div className="text-sm rounded-xl border border-amber-900/50 bg-amber-950/25 px-4 py-3 text-amber-100/90">
              <p className="font-medium text-amber-200">No recurring income run rate yet</p>
              <p className="text-xs text-th-muted mt-1 leading-relaxed">
                Your saved income is one-time only. Add a paycheck with frequency <strong>monthly</strong>,{" "}
                <strong>bi-monthly</strong>, etc. so we can compare steady income to steady obligations.
              </p>
            </div>
          ) : runRate.overspending ? (
            <div className="text-sm rounded-xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-rose-100/95">
              <p className="font-semibold text-rose-200">Recurring obligations exceed recurring income</p>
              <p className="text-xs text-th-muted mt-2 leading-relaxed">
                Estimated <strong className="text-rose-200/90">{money(runRate.obligations.totalMonthly)}/mo</strong>{" "}
                in run-rate costs vs <strong className="text-emerald-200/90">{money(runRate.income.recurringMonthly)}/mo</strong>{" "}
                income — short by about <strong className="text-rose-200">{money(runRate.gapMonthly)}/mo</strong>{" "}
                (annualized from active expenses except synced payment-plan duplicates, prescriptions, and payment plans;
                renewals count as expenses).
              </p>
              <ul className="text-xs text-th-tertiary mt-2 space-y-0.5 list-disc list-inside">
                <li>Other expenses: {money(runRate.obligations.otherExpensesMonthly)}/mo</li>
                <li>Renewals (in expenses): {money(runRate.obligations.renewalsMonthly)}/mo</li>
                <li>Prescriptions: {money(runRate.obligations.prescriptionsMonthly)}/mo</li>
                <li>Payment plans: {money(runRate.obligations.paymentPlansMonthly)}/mo</li>
              </ul>
            </div>
          ) : (
            <div className="text-sm rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 text-emerald-100/90">
              <p className="font-medium text-emerald-200">Recurring income covers recurring obligations</p>
              <p className="text-xs text-th-muted mt-1 leading-relaxed">
                About <strong className="text-emerald-200/90">{money(runRate.income.recurringMonthly)}/mo</strong> income
                run rate vs <strong className="text-th-tertiary">{money(runRate.obligations.totalMonthly)}/mo</strong> in
                combined obligations — roughly <strong className="text-emerald-200">{money(runRate.netMonthly)}/mo</strong>{" "}
                left before one-time costs.
              </p>
            </div>
          )}
          {runRate.disclaimer && (
            <p className="text-[10px] text-th-muted leading-relaxed px-1">{runRate.disclaimer}</p>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => void handleAdd(e)}
        className="rounded-xl border border-th-border bg-th-surface/30 p-4 space-y-3 max-w-xl"
      >
        <p className="text-sm font-medium text-white">Add entry</p>
        <IncomeFormFields draft={draft} setDraft={setDraft} />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add income"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-th-border bg-th-surface/20 overflow-hidden">
        <p className="text-sm font-medium text-white px-4 py-3 border-b border-th-border">Recent entries</p>
        {loading ? (
          <p className="p-4 text-sm text-th-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-th-muted">No income logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-th-muted border-b border-th-border">
                <tr>
                  <th className="px-4 py-2 font-medium">Date / schedule</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Frequency</th>
                  <th className="px-4 py-2 font-medium">Note</th>
                  <th className="px-4 py-2 w-36" />
                </tr>
              </thead>
              <tbody className="divide-y divide-th-border text-th-tertiary">
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-xs sm:text-sm max-w-[14rem]">{formatDateCell(row)}</td>
                    <td className="px-4 py-2 tabular-nums text-white">${Number(row.amount).toFixed(2)}</td>
                    <td className="px-4 py-2">{row.frequency}</td>
                    <td className="px-4 py-2 max-w-[12rem] truncate" title={row.description}>
                      {row.description || "—"}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="text-xs text-sky-400 hover:text-sky-300 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeRow(row.id)}
                        className="text-xs text-rose-400 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editId != null && editDraft != null ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm px-4 py-8 sm:py-12"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cancelEdit();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="income-edit-title"
            className="w-full max-w-3xl rounded-xl border border-th-border bg-th-surface/95 shadow-xl p-4 sm:p-6 my-auto"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 id="income-edit-title" className="text-lg font-semibold text-white">
                  Edit income entry
                </h2>
                <p className="text-xs text-th-muted mt-1">Update any field, then save. Click outside to cancel.</p>
              </div>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-th-muted text-sm hover:text-th-tertiary shrink-0"
              >
                Close
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void saveEdit();
              }}
              className="space-y-4"
            >
              <IncomeFormFields draft={editDraft} setDraft={setEditDraft} />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded-lg bg-cyan-700/90 hover:bg-cyan-600 text-white text-sm font-medium px-4 py-2 disabled:opacity-50"
                >
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={cancelEdit}
                  className="rounded-lg border border-th-border-bright text-th-secondary text-sm font-medium px-4 py-2 hover:bg-th-surface disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
