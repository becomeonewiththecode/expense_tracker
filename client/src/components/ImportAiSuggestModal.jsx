import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import { CATEGORY_OPTIONS, RENEWAL_KIND_OPTIONS } from "../expenseOptions.js";

/**
 * @param {{ open: boolean, batchId: number | null, rows: Array<{ id: number, description: string }>, onClose: () => void, onApplied: () => void }} props
 */
export default function ImportAiSuggestModal({ open, batchId, rows, onClose, onApplied }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  /** row_id -> { category, renewal_kind, apply } */
  const [draft, setDraft] = useState({});
  const [applying, setApplying] = useState(false);

  const uncategorizedRows = useMemo(() => rows.filter((r) => !r.category), [rows]);
  const uncategorizedKey = useMemo(
    () => uncategorizedRows.map((r) => r.id).sort((a, b) => a - b).join(","),
    [uncategorizedRows]
  );

  useEffect(() => {
    if (!open || !batchId || !uncategorizedKey) {
      setSuggestions([]);
      setDraft({});
      setError("");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      setSuggestions([]);
      setDraft({});
      try {
        const { data } = await api.post(`/imports/batches/${batchId}/suggest-categories`, {});
        if (cancelled) return;
        const list = data?.suggestions || [];
        setSuggestions(list);
        const next = {};
        for (const s of list) {
          next[s.row_id] = {
            category: s.category,
            renewal_kind: s.renewal_kind || "",
            apply: true,
          };
        }
        setDraft(next);
      } catch (e) {
        if (!cancelled) setError(getApiErrorMessage(e, "Could not get suggestions"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, batchId, uncategorizedKey]);

  if (!open) return null;

  function updateDraft(rowId, patch) {
    setDraft((d) => ({
      ...d,
      [rowId]: { ...d[rowId], ...patch },
    }));
  }

  async function applySelected() {
    const tasks = [];
    for (const s of suggestions) {
      const d = draft[s.row_id];
      if (!d?.apply) continue;
      const cat = d.category;
      if (cat === "renewal" && !String(d.renewal_kind || "").trim()) continue;
      const body = { category: cat };
      if (cat === "renewal") {
        body.renewal_kind = d.renewal_kind;
      }
      tasks.push(api.patch(`/imports/rows/${s.row_id}`, body));
    }
    if (!tasks.length) {
      onClose();
      return;
    }
    setApplying(true);
    setError("");
    try {
      await Promise.all(tasks);
      onApplied();
      onClose();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not apply some rows"));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-xl border border-th-border bg-th-surface shadow-2xl">
        <div className="px-4 py-3 border-b border-th-border flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white">AI category suggestions</h2>
            <p className="text-[11px] text-th-muted mt-0.5">
              Review and edit before applying. Requires <span className="font-mono">OPENAI_API_KEY</span> on the server.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-th-muted hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-th-surface-alt"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && <p className="text-sm text-th-subtle">Calling model…</p>}
          {error && <p className="text-sm text-rose-400">{error}</p>}
          {!loading && !error && suggestions.length === 0 && (
            <p className="text-sm text-th-muted">No suggestions returned. Try again or categorize manually.</p>
          )}
          {!loading &&
            suggestions.map((s) => {
              const row = uncategorizedRows.find((r) => r.id === s.row_id);
              const d = draft[s.row_id] || { category: s.category, renewal_kind: s.renewal_kind || "", apply: true };
              return (
                <div
                  key={s.row_id}
                  className="rounded-lg border border-th-border-bright/50 bg-th-base/50 p-3 flex flex-col sm:flex-row sm:items-end gap-3"
                >
                  <label className="flex items-center gap-2 shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(d.apply)}
                      onChange={(e) => updateDraft(s.row_id, { apply: e.target.checked })}
                      className="rounded border-th-border-bright"
                    />
                    <span className="text-xs text-th-muted">Apply</span>
                  </label>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-th-subtle truncate" title={row?.description}>
                      {row?.description || `Row #${s.row_id}`}
                    </p>
                  </div>
                  <select
                    value={d.category}
                    onChange={(e) => updateDraft(s.row_id, { category: e.target.value })}
                    className="rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-xs text-white max-w-[11rem]"
                  >
                    {CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {d.category === "renewal" ? (
                    <select
                      value={d.renewal_kind || ""}
                      onChange={(e) => updateDraft(s.row_id, { renewal_kind: e.target.value })}
                      className="rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 text-xs text-white max-w-[12rem]"
                    >
                      <option value="">— Type —</option>
                      {RENEWAL_KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              );
            })}
        </div>

        <div className="px-4 py-3 border-t border-th-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-th-border-bright text-th-tertiary text-sm px-3 py-1.5 hover:bg-th-surface-alt"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={applying || loading || suggestions.length === 0}
            onClick={() => void applySelected()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5"
          >
            {applying ? "Applying…" : "Apply selected"}
          </button>
        </div>
      </div>
    </div>
  );
}
