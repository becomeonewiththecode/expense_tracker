import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "$0.00";
  return `$${x.toFixed(2)}`;
}

/** @param {{ embedded?: boolean }} props When true, hide the page title (used under Budget hub). */
export default function SavingsGoalsPage({ embedded = false }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/savings-goals");
      setGoals(data || []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load goals"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addGoal(e) {
    e.preventDefault();
    setError("");
    const t = Number(target);
    if (!Number.isFinite(t) || t <= 0) {
      setError("Enter a positive target amount.");
      return;
    }
    const c = Number(current);
    if (!Number.isFinite(c) || c < 0) {
      setError("Current saved must be zero or more.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/savings-goals", {
        name: name.trim(),
        target_amount: t,
        current_amount: c,
        target_date: targetDate.trim() || undefined,
      });
      setName("");
      setTarget("");
      setCurrent("0");
      setTargetDate("");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create goal"));
    } finally {
      setSaving(false);
    }
  }

  async function updateProgress(id, nextCurrent) {
    setError("");
    try {
      await api.patch(`/savings-goals/${id}`, { current_amount: nextCurrent });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not update"));
    }
  }

  async function removeGoal(id) {
    if (!window.confirm("Delete this savings goal?")) return;
    setError("");
    try {
      await api.delete(`/savings-goals/${id}`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete"));
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {!embedded && (
        <div>
          <h1 className="text-xl font-semibold text-white">Savings goals</h1>
          <p className="text-sm text-th-subtle mt-1">
            Track targets and how much you have set aside. Update &quot;current&quot; as you save—separate from payment plans and expense categories.
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">{error}</p>
      )}

      <form
        onSubmit={addGoal}
        className="rounded-xl border border-th-border bg-th-surface/40 p-4 space-y-3"
      >
        <h2 className="text-sm font-medium text-th-tertiary">New goal</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-th-muted block mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Emergency fund"
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-th-muted block mb-1">Target ($)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-th-muted block mb-1">Current saved ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-th-muted block mb-1">Target date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full max-w-xs rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
        >
          {saving ? "Saving…" : "Add goal"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-th-muted">Loading…</p>
      ) : goals.length === 0 ? (
        <p className="text-sm text-th-muted">No goals yet. Add one above.</p>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => (
            <li
              key={g.id}
              className="rounded-xl border border-th-border bg-th-surface/50 p-4 space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-medium text-white">{g.name}</h3>
                  {g.target_date && (
                    <p className="text-xs text-th-muted">Target date {g.target_date}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void removeGoal(g.id)}
                  className="text-xs text-rose-400 hover:underline"
                >
                  Delete
                </button>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm gap-2">
                  <span className="text-th-subtle">Progress</span>
                  <span className="text-white tabular-nums">
                    {money(g.current_amount)} / {money(g.target_amount)} (
                    {Number(g.progress).toFixed(0)}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-th-base border border-th-border overflow-hidden">
                  <div
                    className="h-full bg-emerald-500/90 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Number(g.progress) || 0)}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-[10px] text-th-muted block mb-0.5">Set current saved ($)</label>
                  <QuickAdjust
                    goal={g}
                    onSave={(v) => void updateProgress(g.id, v)}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickAdjust({ goal, onSave }) {
  const [val, setVal] = useState(String(goal.current_amount ?? "0"));
  useEffect(() => {
    setVal(String(goal.current_amount ?? "0"));
  }, [goal.id, goal.current_amount]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="number"
        min="0"
        step="0.01"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-32 rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-sm text-white"
      />
      <button
        type="button"
        onClick={() => {
          const n = Number(val);
          if (!Number.isFinite(n) || n < 0) return;
          onSave(n);
        }}
        className="rounded-lg border border-th-border-bright text-th-tertiary text-xs px-2 py-1.5 hover:bg-th-surface-alt"
      >
        Update
      </button>
    </div>
  );
}
