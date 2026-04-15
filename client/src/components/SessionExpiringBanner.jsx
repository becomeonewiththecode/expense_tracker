import { useState } from "react";
import api from "../api.js";
import { getApiErrorMessage } from "../apiError.js";
import { useAuth } from "../auth.jsx";
import { useNavigate } from "react-router-dom";

export default function SessionExpiringBanner({ open, onDismiss }) {
  const { setSession, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function onStaySignedIn() {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/refresh");
      setSession(data.user);
      onDismiss();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not refresh your session"));
    } finally {
      setLoading(false);
    }
  }

  function onSignOut() {
    logout();
    onDismiss();
    navigate("/login", { replace: true });
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] w-full max-w-md px-4"
    >
      <div className="rounded-xl border border-amber-700/60 bg-amber-950/90 backdrop-blur-sm shadow-xl px-4 py-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-amber-200 leading-snug">
            <span className="font-semibold">Session expiring soon.</span>{" "}
            Your session will expire in about 2 minutes due to inactivity.
          </p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="shrink-0 text-amber-400 hover:text-amber-200 text-lg leading-none mt-0.5"
          >
            ×
          </button>
        </div>
        {error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : null}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onSignOut}
            className="text-xs text-amber-400 hover:text-amber-200 disabled:opacity-50 px-3 py-1.5 rounded-lg border border-amber-700/50 hover:border-amber-600"
          >
            Sign out
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onStaySignedIn}
            className="text-xs font-medium text-amber-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 px-3 py-1.5 rounded-lg"
          >
            {loading ? "Refreshing…" : "Stay signed in"}
          </button>
        </div>
      </div>
    </div>
  );
}
