import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api.js";
import { getApiErrorMessage } from "../apiError.js";
import { useAuth } from "../auth.jsx";

export default function SessionExpiredModal({ open, onClose }) {
  const { setSession, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function onContinue() {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/refresh");
      setSession(data.token, data.user);
      onClose();
      window.location.reload();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not refresh your session"));
    } finally {
      setLoading(false);
    }
  }

  function onSignOut() {
    logout();
    onClose();
    navigate("/login", { replace: true });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-xl p-6 space-y-4">
        <h2 id="session-expired-title" className="text-lg font-semibold text-white">
          Session expired
        </h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          Your sign-in session is no longer valid. Would you like to continue and stay signed in?
        </p>
        {error ? (
          <p className="text-sm text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded-lg px-3 py-2">
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onSignOut}
            className="rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium px-4 py-2"
          >
            Sign out
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onContinue}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            {loading ? "Continuing…" : "Continue session"}
          </button>
        </div>
      </div>
    </div>
  );
}
