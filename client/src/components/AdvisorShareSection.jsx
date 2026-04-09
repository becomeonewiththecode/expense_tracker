import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";

export default function AdvisorShareSection() {
  const [collapsed, setCollapsed] = useState(true);
  const [links, setLinks] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [newLink, setNewLink] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/advisor-shares");
      setLinks(data || []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load share links"));
    }
  }, []);

  useEffect(() => {
    if (!collapsed) void load();
  }, [collapsed, load]);

  async function createLink() {
    setError("");
    setBusy(true);
    setNewLink(null);
    try {
      const { data } = await api.post("/advisor-shares", { label: label.trim() });
      setNewLink(data);
      setLabel("");
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not create link"));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id) {
    if (!window.confirm("Revoke this link? Anyone with the URL will lose access.")) return;
    setError("");
    setBusy(true);
    try {
      await api.delete(`/advisor-shares/${id}`);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not revoke"));
    } finally {
      setBusy(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-th-tertiary">Advisor share (read-only)</h2>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-xs text-th-subtle hover:text-th-secondary rounded-full border border-th-border-bright/70 px-2 py-0.5"
          aria-expanded={!collapsed}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!collapsed && (
        <>
          <p className="text-xs text-th-muted leading-relaxed">
            Create a secret link that shows monthly spending totals and category breakdown only—no login, no line-item expenses.
            Treat the URL like a password; revoke it anytime.
          </p>

          {error && <p className="text-sm text-rose-400">{error}</p>}

          {newLink?.token && (
            <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/30 px-3 py-2 space-y-2">
              <p className="text-xs text-emerald-200/90">Copy this URL once. The raw token is not shown again.</p>
              <p className="font-mono text-[11px] text-emerald-100 break-all select-all">
                {origin}
                {newLink.share_path}
              </p>
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(`${origin}${newLink.share_path}`)
                }
                className="text-xs text-emerald-400 hover:underline"
              >
                Copy link
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional label (e.g. “Tax advisor”)"
              className="flex-1 rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void createLink()}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium py-2 px-4 shrink-0"
            >
              {busy ? "Creating…" : "Create link"}
            </button>
          </div>

          {links.length === 0 ? (
            <p className="text-xs text-th-muted">No active share links.</p>
          ) : (
            <ul className="divide-y divide-th-border rounded-lg border border-th-border-bright overflow-hidden">
              {links.map((row) => (
                <li key={row.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white">{row.label || "Share link"}</p>
                    <p className="text-[11px] text-th-muted">
                      Created {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revoke(row.id)}
                    className="text-xs text-rose-400 hover:underline shrink-0"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
