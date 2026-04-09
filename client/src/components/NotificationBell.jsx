import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

function formatWhen(iso) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications");
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
    } catch {
      load();
    }
  }

  async function markAllRead() {
    try {
      await api.post("/notifications/read-all");
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    } catch {
      load();
    }
  }

  return (
    <details
      className="relative group"
      open={open}
      onToggle={(e) => setOpen(e.target.open)}
    >
      <summary
        className="list-none cursor-pointer rounded-lg px-2 py-1.5 text-sm text-th-subtle hover:bg-th-surface-alt hover:text-th-secondary flex items-center gap-1 [&::-webkit-details-marker]:hidden"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      >
        <span className="relative inline-block w-5 h-5 text-center" aria-hidden>
          🔔
        </span>
        {unread > 0 ? (
          <span className="min-w-[1.125rem] h-4 px-1 rounded-full bg-rose-600 text-white text-[10px] font-semibold leading-4 tabular-nums text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </summary>
      <div
        className="absolute right-0 top-full mt-1 w-[min(22rem,calc(100vw-2rem))] max-h-[min(70vh,24rem)] overflow-y-auto rounded-lg border border-th-border-bright bg-th-surface shadow-xl z-50 py-2"
        role="menu"
      >
        <div className="px-3 pb-2 flex items-center justify-between gap-2 border-b border-th-border">
          <span className="text-xs font-medium text-th-tertiary">Notifications</span>
          <div className="flex gap-2">
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[10px] text-emerald-400 hover:text-emerald-300"
              >
                Mark all read
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="text-[10px] text-th-muted hover:text-th-secondary disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-th-muted">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-th-border">
            {items.map((n) => (
              <li key={n.id} className="px-3 py-2">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    if (!n.read_at) void markRead(n.id);
                  }}
                >
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    {n.title}
                    {!n.read_at ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" title="Unread" />
                    ) : null}
                  </p>
                  <p className="text-xs text-th-tertiary mt-0.5 whitespace-pre-wrap">{n.body}</p>
                  <p className="text-[10px] text-th-muted mt-1">{formatWhen(n.created_at)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="px-3 pt-2 border-t border-th-border">
          <Link
            to="/reports"
            className="text-xs text-emerald-400 hover:text-emerald-300"
            onClick={() => setOpen(false)}
          >
            Open Reports (budgets)
          </Link>
        </div>
      </div>
    </details>
  );
}
