import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { adminApi, ADMIN_TOKEN_KEY, setAdminToken } from "../adminApi.js";
import { getApiErrorMessage } from "../apiError.js";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";

  const [challengeId, setChallengeId] = useState("");
  const [needs2faSetup, setNeeds2faSetup] = useState(false);
  const [setupManualKey, setSetupManualKey] = useState("");
  const [setupOtpAuthUrl, setSetupOtpAuthUrl] = useState("");
  const [setupQrDataUrl, setSetupQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");

  const existingToken = sessionStorage.getItem(ADMIN_TOKEN_KEY);

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

  async function loginAdmin(e) {
    e.preventDefault();
    setError("");
    setOk("");
    setChallengeId("");
    setNeeds2faSetup(false);
    setSetupManualKey("");
    setSetupOtpAuthUrl("");
    setOtp("");
    try {
      const { data } = await adminApi.post("/auth/login", { username, password });
      setChallengeId(data.challengeId);
      setNeeds2faSetup(Boolean(data.needs2faSetup));
      setSetupManualKey(String(data?.setup?.manualKey || ""));
      setSetupOtpAuthUrl(String(data?.setup?.otpauthUrl || ""));
      setOk(
        data.needs2faSetup
          ? "Password accepted. Set up authenticator app, then verify code."
          : "Password accepted. Enter your 2FA code."
      );
    } catch (err) {
      setError(getApiErrorMessage(err, "Admin login failed"));
    }
  }

  async function verify2fa(e) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const { data } = await adminApi.post("/auth/verify-2fa", { challengeId, code: otp });
      setAdminToken(data.token);
      navigate("/admin", {
        replace: true,
        state: { mustChangePassword: Boolean(data.mustChangePassword) },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "2FA verification failed"));
    }
  }

  async function complete2faSetup(e) {
    e.preventDefault();
    setError("");
    setOk("");
    try {
      const { data } = await adminApi.post("/auth/setup-2fa/verify", { challengeId, code: otp });
      setAdminToken(data.token);
      setNeeds2faSetup(false);
      setSetupManualKey("");
      setSetupOtpAuthUrl("");
      setOtp("");
      setChallengeId("");
      navigate("/admin", {
        replace: true,
        state: { mustChangePassword: Boolean(data.mustChangePassword) },
      });
    } catch (err) {
      setError(getApiErrorMessage(err, "2FA setup failed"));
    }
  }

  if (existingToken) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-th-base text-th-secondary flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold text-white">Admin sign in</h1>
          <p className="text-sm text-th-muted">Expense Tracker — operator console</p>
        </div>

        {expired && (
          <div
            role="alert"
            className="rounded-xl border border-amber-600/50 bg-amber-950/25 px-4 py-3 text-sm text-amber-100/95 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
          >
            <span>Your admin session has expired. Sign in again to continue.</span>
            <button
              type="button"
              onClick={dismissExpiredNotice}
              className="text-xs shrink-0 text-amber-200/90 hover:text-white underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-400 rounded-xl border border-rose-900/50 bg-rose-950/30 px-3 py-2">{error}</p>
        )}
        {ok && <p className="text-sm text-emerald-400 text-center">{ok}</p>}

        <div className="bg-th-surface border border-th-border rounded-xl p-6 space-y-4 shadow-xl">
          <h2 className="font-medium text-white">Credentials</h2>
          <form onSubmit={loginAdmin} className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Admin username"
              autoComplete="username"
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2.5 text-sm"
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Admin password"
              autoComplete="current-password"
              className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium py-2.5 px-4 transition-colors"
            >
              Continue
            </button>
          </form>

          {challengeId && needs2faSetup ? (
            <form onSubmit={complete2faSetup} className="space-y-4 pt-4 border-t border-th-border">
              <div>
                <h3 className="text-sm font-medium text-white mb-2">Set up two-factor authentication</h3>
                <p className="text-xs text-th-muted mb-3">
                  Scan the QR code with an authenticator app, then enter the 6-digit code to activate.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="rounded-lg bg-white p-3 shadow-inner border border-th-border-bright shrink-0">
                    {setupQrDataUrl ? (
                      <img src={setupQrDataUrl} alt="QR code for authenticator setup" width={220} height={220} className="block" />
                    ) : (
                      <div className="w-[220px] h-[220px] flex items-center justify-center text-xs text-neutral-500 text-center px-2">
                        Generating QR code…
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-3 w-full">
                    <div>
                      <label htmlFor="admin-login-setup-otp" className="block text-xs font-medium text-th-subtle mb-1">
                        Authenticator code
                      </label>
                      <input
                        id="admin-login-setup-otp"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="6-digit code"
                        className="w-full max-w-xs rounded-lg bg-th-input border border-th-border-bright px-3 py-2 font-mono tracking-widest text-sm"
                      />
                    </div>
                    <details className="text-xs text-th-muted">
                      <summary className="cursor-pointer text-th-subtle hover:text-th-secondary">Can’t scan? Enter key manually</summary>
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
                      className="rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium py-2 px-4"
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
                <label htmlFor="admin-login-verify-otp" className="block text-xs font-medium text-th-subtle mb-1">
                  2FA code
                </label>
                <input
                  id="admin-login-verify-otp"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  className="w-full max-w-xs rounded-lg bg-th-input border border-th-border-bright px-3 py-2 font-mono tracking-widest text-sm"
                />
              </div>
              <button type="submit" className="rounded-lg bg-amber-700 hover:bg-amber-600 text-white text-sm font-medium py-2 px-4">
                Verify and sign in
              </button>
            </form>
          ) : null}
        </div>

        <p className="text-center text-xs text-th-muted">Admin sessions end after 15 minutes of inactivity.</p>
      </div>
    </div>
  );
}
