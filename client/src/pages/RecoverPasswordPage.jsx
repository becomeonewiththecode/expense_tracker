import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import { useAuth } from "../auth.jsx";
import PostLoginRedirect from "../components/PostLoginRedirect.jsx";

export default function RecoverPasswordPage() {
  const { isAuthed } = useAuth();
  const navigate = useNavigate();
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthed) return <PostLoginRedirect />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/recover-password", {
        recoveryCode: recoveryCode.trim(),
        newPassword,
      });
      setOk("Password updated. You can sign in with your account email and the new password.");
      setRecoveryCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Reset failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Reset password</h1>
          <p className="text-slate-400 text-sm mt-1">
            Use the recovery code you saved from <strong className="text-slate-300">Profile</strong>. Nothing is sent by
            email.
          </p>
          <p className="text-slate-500 text-xs mt-2 leading-relaxed">
            After resetting, sign in with your usual <span className="text-slate-400">email address</span> and the new
            password. If you never generated a code while signed in, use single sign-on or contact your administrator.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {ok && (
              <p className="text-sm text-emerald-400 bg-emerald-950/30 border border-emerald-900 rounded-lg px-3 py-2">
                {ok}{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login", { replace: true })}
                  className="text-emerald-300 underline underline-offset-2"
                >
                  Sign in
                </button>
              </p>
            )}
            <div>
              <label htmlFor="recovery-code" className="block text-xs font-medium text-slate-400 mb-1">
                Recovery code
              </label>
              <textarea
                id="recovery-code"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                rows={3}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="Paste the full code"
                required
              />
            </div>
            <div>
              <label htmlFor="recover-new" className="block text-xs font-medium text-slate-400 mb-1">
                New password
              </label>
              <input
                id="recover-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                minLength={6}
                required
              />
            </div>
            <div>
              <label htmlFor="recover-confirm" className="block text-xs font-medium text-slate-400 mb-1">
                Confirm new password
              </label>
              <input
                id="recover-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
            >
              {loading ? "Updating…" : "Set new password"}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-slate-500">
          <Link to="/login" className="text-emerald-400 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
