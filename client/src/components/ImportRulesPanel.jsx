import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import { CATEGORY_OPTIONS, RENEWAL_KIND_OPTIONS } from "../expenseOptions.js";

const MATCH_OPTIONS = [
  { value: "contains", label: "Description contains" },
  { value: "starts_with", label: "Description starts with" },
  { value: "exact", label: "Description equals" },
];

export default function ImportRulesPanel() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [match_type, setMatchType] = useState("contains");
  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState("personal");
  const [renewal_kind, setRenewalKind] = useState("streaming_services");
  const [sort_order, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/import-rules");
      setRules(data || []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load rules"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRule(e) {
    e.preventDefault();
    setError("");
    const p = pattern.trim();
    if (!p) {
      setError("Enter text to match in the transaction description.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/import-rules", {
        match_type,
        pattern: p,
        category,
        renewal_kind: category === "renewal" ? renewal_kind : undefined,
        sort_order: Number(sort_order) || 0,
      });
      setPattern("");
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not save rule"));
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(id) {
    if (!window.confirm("Delete this rule?")) return;
    setError("");
    try {
      await api.delete(`/import-rules/${id}`);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete"));
    }
  }

  return (
    <div className="rounded-lg border border-th-border-bright/60 bg-th-base/40 p-4 space-y-3">
      <div>
        <h3 className="text-sm font-medium text-th-tertiary">Category rules</h3>
        <p className="text-[11px] text-th-muted mt-0.5 max-w-2xl">
          Rules run in order (lowest sort first) when you commit an import or click &quot;Run rules&quot; on a staged batch.
          Only rows still missing a category are matched.
        </p>
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <form onSubmit={addRule} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[10rem]">
          <label className="text-[10px] text-th-muted block mb-0.5">Match</label>
          <select
            value={match_type}
            onChange={(e) => setMatchType(e.target.value)}
            className="w-full rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-xs text-white"
          >
            {MATCH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[8rem]">
          <label className="text-[10px] text-th-muted block mb-0.5">Text / merchant snippet</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. netflix, whole fds"
            className="w-full rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-xs text-white"
          />
        </div>
        <div className="min-w-[8rem]">
          <label className="text-[10px] text-th-muted block mb-0.5">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-xs text-white"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        {category === "renewal" ? (
          <div className="min-w-[10rem]">
            <label className="text-[10px] text-th-muted block mb-0.5">Renewal type</label>
            <select
              value={renewal_kind}
              onChange={(e) => setRenewalKind(e.target.value)}
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-xs text-white"
            >
              {RENEWAL_KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="w-16">
          <label className="text-[10px] text-th-muted block mb-0.5">Order</label>
          <input
            type="number"
            value={sort_order}
            onChange={(e) => setSortOrder(e.target.value)}
            className="w-full rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-xs text-white"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-th-border-bright hover:bg-th-muted disabled:opacity-50 text-white text-xs font-medium py-1.5 px-3"
        >
          {saving ? "Adding…" : "Add rule"}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-th-muted">Loading rules…</p>
      ) : rules.length === 0 ? (
        <p className="text-xs text-th-muted">No rules yet.</p>
      ) : (
        <ul className="divide-y divide-th-border rounded-lg border border-th-border overflow-hidden text-xs">
          {rules.map((r) => (
            <li key={r.id} className="px-2 py-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-th-secondary min-w-0">
                <span className="text-th-muted">{r.sort_order}</span> ·{" "}
                <span className="text-th-tertiary">{r.match_type}</span> ·{" "}
                <span className="text-white font-medium">{r.pattern}</span>
                <span className="text-th-muted"> → </span>
                <span className="text-emerald-300/90">{r.category}</span>
                {r.renewal_kind ? (
                  <span className="text-th-muted"> ({r.renewal_kind})</span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void removeRule(r.id)}
                className="text-rose-400 hover:underline shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
