import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import { useAuth } from "../auth.jsx";
import PostLoginRedirect from "../components/PostLoginRedirect.jsx";
import SsoButtons from "../components/SsoButtons.jsx";
import { getPostLoginPath } from "../postLoginLanding.js";

export default function LoginPage() {
  const { isAuthed, setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthed) return <PostLoginRedirect />;

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setSession(data.token, data.user);
      navigate(await getPostLoginPath(), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Sign in</h1>
          <p className="text-slate-400 text-sm mt-1">
            Track spending by day, week, month, or custom range.
          </p>
          <p className="text-slate-500 text-xs mt-3 leading-relaxed">
            Five ways to sign in: <span className="text-slate-400">email and password</span>,{" "}
            <span className="text-slate-400">Google (Gmail)</span>,{" "}
            <span className="text-slate-400">GitHub</span>, <span className="text-slate-400">GitLab</span>, and{" "}
            <span className="text-slate-400">Microsoft 365</span>. If you only use Google or another provider, set a
            password under Profile after signing in to enable email login too.
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <SsoButtons className="pt-2 border-t border-slate-800" />
        </div>
        <p className="text-center text-sm text-slate-500">
          No account?{" "}
          <Link to="/register" className="text-emerald-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
