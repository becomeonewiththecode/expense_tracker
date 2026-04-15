import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import { useAuth } from "../auth.jsx";
import PostLoginRedirect from "../components/PostLoginRedirect.jsx";
import SsoButtons from "../components/SsoButtons.jsx";
import { getPostLoginPath } from "../postLoginLanding.js";

export default function LoginPage() {
  const { isAuthed, setSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [needs2faSetup, setNeeds2faSetup] = useState(false);
  const [setupManualKey, setSetupManualKey] = useState("");
  const [setupOtpAuthUrl, setSetupOtpAuthUrl] = useState("");
  const [setupQrDataUrl, setSetupQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!setupOtpAuthUrl) {
      setSetupQrDataUrl("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(setupOtpAuthUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setSetupQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setSetupQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [setupOtpAuthUrl]);

  function dismissExpiredNotice() {
    const next = new URLSearchParams(searchParams);
    next.delete("expired");
    setSearchParams(next, { replace: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setChallengeId(String(data.challengeId || ""));
      setNeeds2faSetup(Boolean(data.needs2faSetup));
      setSetupManualKey(String(data?.setup?.manualKey || ""));
      setSetupOtpAuthUrl(String(data?.setup?.otpauthUrl || ""));
      setOtp("");
      setOk(
        data.needs2faSetup
          ? "Password accepted. Set up authenticator app, then verify code."
          : "Password accepted. Enter your 2FA code."
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  async function verify2fa(e) {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/verify-2fa", { challengeId, code: otp });
      setSession(data.user);
      navigate(await getPostLoginPath(), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "2FA verification failed"));
    } finally {
      setLoading(false);
    }
  }

  async function complete2faSetup(e) {
    e.preventDefault();
    setError("");
    setOk("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/setup-2fa/verify", { challengeId, code: otp });
      setSession(data.user);
      navigate(await getPostLoginPath(), { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "2FA setup failed"));
    } finally {
      setLoading(false);
    }
  }

  if (isAuthed) return <PostLoginRedirect />;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Sign in</h1>
          <p className="text-th-subtle text-sm mt-1">
            Track spending by day, week, month, or custom range.
          </p>
          <p className="text-th-muted text-xs mt-3 leading-relaxed">
            Five ways to sign in: <span className="text-th-subtle">email and password</span>,{" "}
            <span className="text-th-subtle">Google (Gmail)</span>,{" "}
            <span className="text-th-subtle">GitHub</span>, <span className="text-th-subtle">GitLab</span>, and{" "}
            <span className="text-th-subtle">Microsoft 365</span>. If you only use Google or another provider, set a
            password under Profile after signing in to enable email login too.
          </p>
        </div>
        {expired && (
          <div
            role="alert"
            className="rounded-xl border border-amber-600/50 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <span>Your session timed out due to inactivity. Sign in again to continue.</span>
            <button
              type="button"
              onClick={dismissExpiredNotice}
              className="text-xs shrink-0 text-amber-200/90 hover:text-white underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <div className="bg-th-surface border border-th-border rounded-xl p-6 shadow-xl space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {ok ? <p className="text-sm text-emerald-400">{ok}</p> : null}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-th-subtle mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white placeholder:text-th-muted focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-th-subtle mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || Boolean(challengeId)}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p className="text-center text-xs text-th-muted">
              <Link to="/recover" className="text-emerald-400/90 hover:underline">
                Forgot password? Reset with a saved recovery code
              </Link>
              <span className="text-th-muted"> · </span>
              <span className="text-th-muted">No email is sent.</span>
            </p>
          </form>
          {challengeId && needs2faSetup ? (
            <form onSubmit={complete2faSetup} className="space-y-4 pt-4 border-t border-th-border">
              <div>
                <h3 className="text-sm font-medium text-white mb-2">Set up two-factor authentication</h3>
                <p className="text-xs text-th-muted mb-3">
                  Scan the QR code with an authenticator app, then enter the 6-digit code to activate.
                </p>
                <div className="flex flex-col gap-4 items-start">
                  <div className="rounded-lg bg-white p-3 shadow-inner border border-th-border-bright shrink-0">
                    {setupQrDataUrl ? (
                      <img src={setupQrDataUrl} alt="QR code for authenticator setup" width={220} height={220} className="block" />
                    ) : (
                      <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-neutral-500 text-center px-2">
                        Generating QR code...
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 w-full">
                    <div>
                      <label htmlFor="login-setup-otp" className="block text-xs font-medium text-th-subtle mb-1">
                        Authenticator code
                      </label>
                      <input
                        id="login-setup-otp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        className="w-full max-w-xs rounded-lg bg-th-input border border-th-border-bright px-3 py-2 font-mono tracking-widest text-sm"
                      />
                    </div>
                    <details className="text-xs text-th-muted">
                      <summary className="cursor-pointer text-th-subtle hover:text-th-secondary">Can't scan? Enter key manually</summary>
                      <div className="mt-2 space-y-2 pl-1 border-l border-th-border-bright">
                        <p>
                          <span className="text-th-subtle">Secret key</span>
                          <input
                            readOnly
                            value={setupManualKey}
                            className="mt-1 block w-full rounded-lg bg-th-input border border-th-border-bright px-2 py-1.5 font-mono text-[11px] text-th-secondary"
                          />
                        </p>
                      </div>
                    </details>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 px-4 disabled:opacity-50"
                    >
                      Activate 2FA
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : challengeId ? (
            <form onSubmit={verify2fa} className="space-y-3 pt-4 border-t border-th-border">
              <div>
                <label htmlFor="login-verify-otp" className="block text-xs font-medium text-th-subtle mb-1">
                  2FA code
                </label>
                <input
                  id="login-verify-otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  className="w-full max-w-xs rounded-lg bg-th-input border border-th-border-bright px-3 py-2 font-mono tracking-widest text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 px-4 disabled:opacity-50"
              >
                Verify and sign in
              </button>
            </form>
          ) : null}
          <SsoButtons className="pt-2 border-t border-th-border" />
        </div>
        <p className="text-center text-sm text-th-muted">
          No account?{" "}
          <Link to="/register" className="text-emerald-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
