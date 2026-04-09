import { useCallback, useEffect, useState } from "react";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import PlaidLinkLauncher from "./PlaidLinkLauncher.jsx";

export default function BankSyncSection() {
  const [collapsed, setCollapsed] = useState(true);
  const [status, setStatus] = useState(null);
  const [connections, setConnections] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkToken, setLinkToken] = useState(null);
  const [syncingId, setSyncingId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [st, conn] = await Promise.all([
        api.get("/bank/plaid/status"),
        api.get("/bank/plaid/connections"),
      ]);
      setStatus(st.data);
      setConnections(conn.data || []);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not load bank settings"));
    }
  }, []);

  useEffect(() => {
    if (!collapsed) void load();
  }, [collapsed, load]);

  async function startLink() {
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/bank/plaid/link-token");
      setLinkToken(data.link_token);
    } catch (e) {
      setError(getApiErrorMessage(e, "Could not start Plaid Link"));
    } finally {
      setBusy(false);
    }
  }

  async function syncConnection(id) {
    setError("");
    setSyncingId(id);
    try {
      const { data } = await api.post(`/bank/plaid/connections/${id}/sync`);
      await load();
      if (data?.inserted != null) {
        setError("");
        // brief success via non-error line — use ok state
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "Sync failed"));
    } finally {
      setSyncingId(null);
    }
  }

  async function removeConnection(id) {
    if (!window.confirm("Disconnect this bank and stop syncing?")) return;
    setError("");
    setBusy(true);
    try {
      await api.delete(`/bank/plaid/connections/${id}`);
      await load();
    } catch (e) {
      setError(getApiErrorMessage(e, "Disconnect failed"));
    } finally {
      setBusy(false);
    }
  }

  const configured = status?.configured === true;

  return (
    <div className="bg-th-surface border border-th-border rounded-xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-th-tertiary">Bank sync (Plaid)</h2>
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
            Connect a bank or card via Plaid. New posted spending (positive amounts) is imported as one-time expenses in the{" "}
            <span className="text-th-subtle">personal</span> category with institution{" "}
            <span className="text-th-subtle">bank</span>. Set <span className="font-mono text-[11px]">PLAID_CLIENT_ID</span>{" "}
            and <span className="font-mono text-[11px]">PLAID_SECRET</span> on the server (sandbox or production).
          </p>

          {status && !configured && (
            <p className="text-sm text-amber-200/90 border border-amber-900/40 rounded-lg px-3 py-2">
              Plaid is not configured on this server, so linking is unavailable.
            </p>
          )}

          {error && <p className="text-sm text-rose-400">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !configured}
              onClick={() => void startLink()}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
            >
              {busy ? "Starting…" : "Connect bank"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void load()}
              className="rounded-lg border border-th-border-bright text-th-tertiary text-sm py-2 px-4 hover:bg-th-surface-alt"
            >
              Refresh
            </button>
          </div>

          {linkToken && (
            <PlaidLinkLauncher
              linkToken={linkToken}
              onSuccess={async (public_token) => {
                setLinkToken(null);
                setBusy(true);
                setError("");
                try {
                  await api.post("/bank/plaid/exchange", { public_token });
                  await load();
                } catch (e) {
                  setError(getApiErrorMessage(e, "Could not save bank connection"));
                } finally {
                  setBusy(false);
                }
              }}
              onExit={() => setLinkToken(null)}
            />
          )}

          {connections.length === 0 ? (
            <p className="text-xs text-th-muted">No linked accounts yet.</p>
          ) : (
            <ul className="divide-y divide-th-border rounded-lg border border-th-border-bright overflow-hidden">
              {connections.map((c) => (
                <li key={c.id} className="px-3 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm text-white font-medium">{c.institution_name || "Linked account"}</p>
                    <p className="text-[11px] text-th-muted">Item ···{String(c.plaid_item_id || "").slice(-6)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={syncingId === c.id || !configured}
                      onClick={() => void syncConnection(c.id)}
                      className="rounded-lg bg-th-border-bright hover:bg-th-muted disabled:opacity-50 text-white text-xs font-medium py-1.5 px-3"
                    >
                      {syncingId === c.id ? "Syncing…" : "Sync now"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeConnection(c.id)}
                      className="rounded-lg border border-th-border-bright text-th-tertiary text-xs py-1.5 px-3 hover:bg-th-surface-alt"
                    >
                      Disconnect
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
