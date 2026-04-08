import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import QRCode from "qrcode";
import { getApiErrorMessage } from "../apiError.js";

const ADMIN_TOKEN_KEY = "expense_tracker_admin_token";

const adminApi = axios.create({
  baseURL: "/api/admin",
  headers: { "Content-Type": "application/json" },
  timeout: 120_000,
});

adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const TABS = [
  { id: "session", label: "Session" },
  { id: "health", label: "System health" },
  { id: "backup", label: "Backup & restore" },
  { id: "users", label: "User accounts" },
  { id: "swagger", label: "Swagger" },
];

function formatBytes(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function saveJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function StatusCard({ title, ok, subtitle, detail, loading }) {
  const tone =
    loading ? "border-th-border-bright/50 text-th-muted" : ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-950/20";
  const label = loading ? "Checking…" : ok ? "Healthy" : "Issue";
  const labelClass = loading ? "text-th-muted" : ok ? "text-emerald-400" : "text-rose-400";

  return (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <span className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>{label}</span>
      </div>
      {subtitle && <p className="mt-2 text-xs text-th-subtle">{subtitle}</p>}
      {detail && <p className="mt-1 text-[11px] text-th-muted font-mono break-all">{detail}</p>}
    </div>
  );
}

export default function AdminPage() {
  const [challengeId, setChallengeId] = useState("");
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem(ADMIN_TOKEN_KEY) || "");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [needs2faSetup, setNeeds2faSetup] = useState(false);
  const [setupManualKey, setSetupManualKey] = useState("");
  const [setupOtpAuthUrl, setSetupOtpAuthUrl] = useState("");
  const [setupQrDataUrl, setSetupQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [reauthToken, setReauthToken] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  const [activeTab, setActiveTab] = useState("health");
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [userIdForBackup, setUserIdForBackup] = useState("");
  const [users, setUsers] = useState([]);
  const [targetUserId, setTargetUserId] = useState("");
  const [targetPassword, setTargetPassword] = useState("");
  const [targetRole, setTargetRole] = useState("user");
  const [dbBackupPreview, setDbBackupPreview] = useState(null);

  const [loadingReauth, setLoadingReauth] = useState(false);
  const [loadingChangePwd, setLoadingChangePwd] = useState(false);
  const [loadingBackupUser, setLoadingBackupUser] = useState(false);
  const [loadingBackupDb, setLoadingBackupDb] = useState(false);
  const [loadingRestorePreview, setLoadingRestorePreview] = useState(false);
  const [loadingRestoreApply, setLoadingRestoreApply] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingResetPwd, setLoadingResetPwd] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  const [sessionFeedback, setSessionFeedback] = useState(null);
  const [healthFeedback, setHealthFeedback] = useState(null);
  const [backupFeedback, setBackupFeedback] = useState(null);
  const [usersFeedback, setUsersFeedback] = useState(null);

  const isAuthed = Boolean(adminToken);

  const reauthHeaders = useMemo(
    () => (reauthToken ? { "x-admin-reauth": reauthToken } : {}),
    [reauthToken]
  );

  function clearTabFeedback() {
    setSessionFeedback(null);
    setHealthFeedback(null);
    setBackupFeedback(null);
    setUsersFeedback(null);
  }

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

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthFeedback(null);
    try {
      const { data } = await adminApi.get("/health");
      setHealth(data);
      setHealthFeedback({ type: "success", message: `Updated ${new Date(data.checkedAt || Date.now()).toLocaleString()}` });
    } catch (err) {
      setHealth(null);
      setHealthFeedback({ type: "error", message: getApiErrorMessage(err, "Health check failed") });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed || activeTab !== "health") return undefined;
    void refreshHealth();
    const id = setInterval(() => void refreshHealth(), 60_000);
    return () => clearInterval(id);
  }, [isAuthed, activeTab, refreshHealth]);

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
      setMustChangePassword(Boolean(data.mustChangePassword));
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
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setAdminToken(data.token);
      setMustChangePassword(Boolean(data.mustChangePassword));
      setOk("2FA verified.");
      setPassword("");
      setOtp("");
      setChallengeId("");
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
      sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setAdminToken(data.token);
      setMustChangePassword(Boolean(data.mustChangePassword));
      setNeeds2faSetup(false);
      setSetupManualKey("");
      setSetupOtpAuthUrl("");
      setPassword("");
      setOtp("");
      setChallengeId("");
      setOk("2FA setup complete.");
    } catch (err) {
      setError(getApiErrorMessage(err, "2FA setup failed"));
    }
  }

  async function changeAdminPassword(e) {
    e.preventDefault();
    setSessionFeedback(null);
    setLoadingChangePwd(true);
    try {
      await adminApi.post("/auth/change-password", { currentPassword: password, newPassword: newAdminPassword });
      setMustChangePassword(false);
      setNewAdminPassword("");
      setPassword("");
      setSessionFeedback({ type: "success", message: "Admin password updated." });
    } catch (err) {
      setSessionFeedback({ type: "error", message: getApiErrorMessage(err, "Could not change password") });
    } finally {
      setLoadingChangePwd(false);
    }
  }

  async function reauthenticate() {
    setSessionFeedback(null);
    setLoadingReauth(true);
    try {
      const { data } = await adminApi.post("/auth/reauth", { password, code: otp });
      setReauthToken(data.reauthToken);
      setSessionFeedback({
        type: "success",
        message: `Re-authentication confirmed. Sensitive actions are unlocked for about ${data.expiresInSec ?? 120} seconds.`,
      });
    } catch (err) {
      setSessionFeedback({ type: "error", message: getApiErrorMessage(err, "Re-authentication failed") });
    } finally {
      setLoadingReauth(false);
    }
  }

  async function backupUser() {
    setBackupFeedback(null);
    setLoadingBackupUser(true);
    try {
      const { data } = await adminApi.get(`/backup/user/${encodeURIComponent(userIdForBackup)}`);
      const picked = users.find((u) => String(u.id) === String(userIdForBackup));
      const slug = picked?.email
        ? String(picked.email).replace(/[^a-zA-Z0-9._+-]+/g, "-").slice(0, 60) || `user-${userIdForBackup}`
        : String(userIdForBackup).replace(/[^\w-]+/g, "-") || "user";
      saveJson(data, `user-${slug}-backup-${new Date().toISOString().slice(0, 10)}.json`);
      setBackupFeedback({
        type: "success",
        message: `User backup downloaded (${data?.counts ? `${data.counts.expenses ?? 0} expenses` : "JSON saved"}).`,
      });
    } catch (err) {
      setBackupFeedback({ type: "error", message: getApiErrorMessage(err, "Could not backup user") });
    } finally {
      setLoadingBackupUser(false);
    }
  }

  async function backupDatabase() {
    setBackupFeedback(null);
    if (!reauthToken) {
      setBackupFeedback({
        type: "error",
        message:
          "Full database backup requires re-authentication. Open the Session tab, enter your admin password and 2FA code, then click “Re-authenticate for sensitive actions”.",
      });
      return;
    }
    setLoadingBackupDb(true);
    try {
      const { data } = await adminApi.get("/backup/database", {
        headers: reauthHeaders,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      const day = new Date().toISOString().slice(0, 10);
      saveJson(data, `database-backup-${day}.json`);
      const nUsers = Array.isArray(data?.users) ? data.users.length : 0;
      setBackupFeedback({
        type: "success",
        message: `Database backup downloaded (${nUsers} user row(s) in snapshot).`,
      });
    } catch (err) {
      const status = err.response?.status;
      const msg = getApiErrorMessage(err, "Could not backup database");
      if (status === 401 && String(err.response?.data?.error || "").toLowerCase().includes("re-auth")) {
        setBackupFeedback({
          type: "error",
          message:
            "Re-authentication required or expired. Use the Session tab to re-authenticate, then try again.",
        });
      } else {
        setBackupFeedback({ type: "error", message: msg });
      }
    } finally {
      setLoadingBackupDb(false);
    }
  }

  async function previewRestore(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackupFeedback(null);
    setLoadingRestorePreview(true);
    try {
      const parsed = JSON.parse(await file.text());
      const { data } = await adminApi.post("/restore/preview", parsed);
      setDbBackupPreview({ payload: parsed, result: data });
      setBackupFeedback({
        type: data?.ok ? "success" : "error",
        message: data?.ok
          ? "Backup file validated. Review the summary below before restoring."
          : `Integrity check found issues: ${(data?.integrityErrors || []).slice(0, 3).join("; ") || "see details below"}`,
      });
    } catch (err) {
      setDbBackupPreview(null);
      setBackupFeedback({ type: "error", message: getApiErrorMessage(err, "Could not preview restore") });
    } finally {
      setLoadingRestorePreview(false);
      e.target.value = "";
    }
  }

  async function applyRestore() {
    if (!dbBackupPreview?.payload) return;
    if (!reauthToken) {
      setBackupFeedback({
        type: "error",
        message: "Restore requires re-authentication. Use the Session tab first.",
      });
      return;
    }
    if (!window.confirm("Apply database restore? This will overwrite current data.")) return;
    setBackupFeedback(null);
    setLoadingRestoreApply(true);
    try {
      await adminApi.post(
        "/restore/database",
        { ...dbBackupPreview.payload, mode: "replace" },
        { headers: reauthHeaders }
      );
      setBackupFeedback({ type: "success", message: "Database restore completed. Affected users were recorded in notifications." });
      setDbBackupPreview(null);
    } catch (err) {
      setBackupFeedback({ type: "error", message: getApiErrorMessage(err, "Restore failed") });
    } finally {
      setLoadingRestoreApply(false);
    }
  }

  const loadUsers = useCallback(async (options = {}) => {
    const { quiet = false, errorScope = "users" } = options;
    if (!quiet && errorScope === "users") setUsersFeedback(null);
    setLoadingUsers(true);
    try {
      const { data } = await adminApi.get("/users");
      setUsers(data.users || []);
      if (!quiet && errorScope === "users") {
        setUsersFeedback({
          type: "success",
          message: `Loaded ${(data.users || []).length} user(s).`,
        });
      }
    } catch (err) {
      const msg = getApiErrorMessage(err, "Could not load users");
      if (errorScope === "backup") {
        setBackupFeedback({ type: "error", message: msg });
      } else {
        setUsersFeedback({ type: "error", message: msg });
      }
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthed || activeTab !== "backup") return;
    void loadUsers({ quiet: true, errorScope: "backup" });
  }, [isAuthed, activeTab, loadUsers]);

  async function resetUserPassword() {
    setUsersFeedback(null);
    if (!reauthToken) {
      setUsersFeedback({ type: "error", message: "Re-authenticate on the Session tab first." });
      return;
    }
    setLoadingResetPwd(true);
    try {
      await adminApi.post(
        `/users/${encodeURIComponent(targetUserId)}/reset-password`,
        { newPassword: targetPassword },
        { headers: reauthHeaders }
      );
      setTargetPassword("");
      setUsersFeedback({ type: "success", message: `Password reset for user ID ${targetUserId}.` });
    } catch (err) {
      setUsersFeedback({ type: "error", message: getApiErrorMessage(err, "Could not reset password") });
    } finally {
      setLoadingResetPwd(false);
    }
  }

  async function updatePermissions() {
    setUsersFeedback(null);
    if (!reauthToken) {
      setUsersFeedback({ type: "error", message: "Re-authenticate on the Session tab first." });
      return;
    }
    setLoadingPermissions(true);
    try {
      await adminApi.patch(
        `/users/${encodeURIComponent(targetUserId)}/permissions`,
        { role: targetRole },
        { headers: reauthHeaders }
      );
      setUsersFeedback({ type: "success", message: `User ${targetUserId} role set to ${targetRole}.` });
      await loadUsers({ quiet: true });
    } catch (err) {
      setUsersFeedback({ type: "error", message: getApiErrorMessage(err, "Could not update role") });
    } finally {
      setLoadingPermissions(false);
    }
  }

  function logoutAdmin() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setAdminToken("");
    setReauthToken("");
    setHealth(null);
    setUsers([]);
    setChallengeId("");
    setNeeds2faSetup(false);
    setSetupManualKey("");
    setSetupOtpAuthUrl("");
    setOtp("");
    clearTabFeedback();
    setActiveTab("session");
  }

  const tabBtn = (id) =>
    [
      "rounded-lg px-3 py-2 text-sm font-medium transition-colors border",
      activeTab === id
        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
        : "border-transparent text-th-subtle hover:bg-th-surface-alt hover:text-th-secondary",
    ].join(" ");

  const dc = health?.databaseConnectivity;
  const dh = health?.databaseHealth;
  const web = health?.web;
  const app = health?.application;
  const disk = app?.disk;

  return (
    <div className="min-h-screen bg-th-base text-th-secondary">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Admin site</h1>
          <p className="text-sm text-th-muted mt-1">
            Sensitive operations require re-authentication. Admin sessions end after 15 minutes of inactivity.
          </p>
        </div>

        {error && <p className="text-sm text-rose-400 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2">{error}</p>}
        {!isAuthed && ok && <p className="text-sm text-emerald-400">{ok}</p>}

        {!isAuthed ? (
          <div className="bg-th-surface border border-th-border rounded-xl p-4 space-y-3">
            <h2 className="font-medium text-white">Sign in</h2>
            <form onSubmit={loginAdmin} className="grid sm:grid-cols-2 gap-3">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Admin username"
                className="rounded bg-th-input border border-th-border-bright px-3 py-2"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="Admin password"
                className="rounded bg-th-input border border-th-border-bright px-3 py-2"
              />
              <button type="submit" className="rounded bg-emerald-600 text-white px-3 py-2">
                Continue
              </button>
            </form>
            {challengeId && needs2faSetup ? (
              <form onSubmit={complete2faSetup} className="space-y-4 pt-2 border-t border-th-border">
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
                        <label htmlFor="admin-setup-otp" className="block text-xs font-medium text-th-subtle mb-1">
                          Authenticator code
                        </label>
                        <input
                          id="admin-setup-otp"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="6-digit code"
                          className="w-full max-w-xs rounded bg-th-input border border-th-border-bright px-3 py-2 font-mono tracking-widest"
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
                              className="mt-1 block w-full rounded bg-th-input border border-th-border-bright px-2 py-1.5 font-mono text-[11px] text-th-secondary"
                            />
                          </p>
                        </div>
                      </details>
                      <button
                        type="submit"
                        className="rounded border border-th-border-bright px-4 py-2 text-sm font-medium text-th-secondary hover:bg-th-surface-alt"
                      >
                        Activate 2FA
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : challengeId ? (
              <form onSubmit={verify2fa} className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-th-border">
                <div className="sm:col-span-2">
                  <label htmlFor="admin-verify-otp" className="block text-xs font-medium text-th-subtle mb-1">
                    2FA code
                  </label>
                  <input
                    id="admin-verify-otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6-digit code"
                    className="w-full max-w-xs rounded bg-th-input border border-th-border-bright px-3 py-2 font-mono tracking-widest"
                  />
                </div>
                <button type="submit" className="rounded border border-th-border-bright px-3 py-2 sm:w-fit">
                  Verify 2FA
                </button>
              </form>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-th-surface border border-th-border">
              {TABS.map((t) => (
                <button key={t.id} type="button" className={tabBtn(t.id)} onClick={() => setActiveTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="bg-th-surface border border-th-border rounded-xl p-5 shadow-xl min-h-[320px]">
              {activeTab === "session" && (
                <div className="space-y-5">
                  <h2 className="text-lg font-medium text-white">Session & security</h2>
                  {sessionFeedback && (
                    <p
                      className={
                        sessionFeedback.type === "success"
                          ? "text-sm text-emerald-400 border border-emerald-900/40 rounded-lg px-3 py-2 bg-emerald-950/20"
                          : "text-sm text-rose-400 border border-rose-900/40 rounded-lg px-3 py-2 bg-rose-950/20"
                      }
                    >
                      {sessionFeedback.message}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={logoutAdmin}
                      className="rounded-lg border border-th-border-bright px-4 py-2 text-sm hover:bg-th-surface-alt"
                    >
                      Sign out admin
                    </button>
                  </div>
                  <div className="border-t border-th-border pt-4 space-y-3">
                    <h3 className="text-sm font-medium text-th-tertiary">Re-authenticate for sensitive actions</h3>
                    <p className="text-xs text-th-muted max-w-prose">
                      Full database backup, restore, and user password resets require a fresh password + 2FA check. Your unlock lasts about two minutes.
                    </p>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        placeholder="Admin password"
                        className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm w-48"
                      />
                      <input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="2FA code"
                        className="rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm w-32 font-mono"
                      />
                      <button
                        type="button"
                        disabled={loadingReauth}
                        onClick={() => void reauthenticate()}
                        className="rounded-lg bg-th-border-bright hover:bg-th-muted disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
                      >
                        {loadingReauth ? "Checking…" : "Re-authenticate"}
                      </button>
                    </div>
                    {reauthToken ? (
                      <p className="text-xs text-emerald-400/90">Sensitive actions are currently unlocked (re-auth token active).</p>
                    ) : (
                      <p className="text-xs text-amber-200/80">No active re-auth — backup/restore/reset will ask you to unlock first.</p>
                    )}
                  </div>
                  {mustChangePassword && (
                    <form onSubmit={changeAdminPassword} className="border-t border-th-border pt-4 space-y-3">
                      <h3 className="text-sm font-medium text-amber-200/90">Change default password</h3>
                      <input
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        type="password"
                        placeholder="New admin password (12+ characters)"
                        className="w-full max-w-md rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={loadingChangePwd}
                        className="rounded-lg bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
                      >
                        {loadingChangePwd ? "Saving…" : "Save new password"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {activeTab === "health" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-medium text-white">System health</h2>
                    <button
                      type="button"
                      disabled={healthLoading}
                      onClick={() => void refreshHealth()}
                      className="rounded-lg border border-th-border-bright px-3 py-1.5 text-sm hover:bg-th-surface-alt disabled:opacity-50"
                    >
                      {healthLoading ? "Refreshing…" : "Refresh now"}
                    </button>
                  </div>
                  {healthFeedback && (
                    <p
                      className={
                        healthFeedback.type === "success"
                          ? "text-xs text-emerald-400"
                          : "text-xs text-rose-400"
                      }
                    >
                      {healthFeedback.message}
                    </p>
                  )}
                  <p className="text-xs text-th-muted">Checks run automatically when you open this tab and every 60 seconds while you stay here.</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <StatusCard
                      title="API health"
                      ok={health?.api?.ok}
                      loading={healthLoading && !health}
                      subtitle={health?.api?.message || "Admin API endpoint"}
                      detail={health != null ? `Round-trip ${health.responseMs ?? "—"} ms` : null}
                    />
                    <StatusCard
                      title="Web (UI)"
                      ok={web?.ok}
                      loading={healthLoading && !health}
                      subtitle="Can the API reach the web server (nginx/static UI)?"
                      detail={
                        web?.ok
                          ? `Latency ${web.latencyMs ?? "—"} ms · HTTP ${web.status ?? "—"}`
                          : web?.error
                            ? `${web.error}${web?.url ? ` · ${web.url}` : ""}`
                            : undefined
                      }
                    />
                    <StatusCard
                      title="Database connectivity"
                      ok={dc?.ok}
                      loading={healthLoading && !health}
                      subtitle="Can the API open a connection and run a simple query?"
                      detail={
                        dc?.ok
                          ? `Latency ${dc.latencyMs ?? "—"} ms`
                          : dc?.error || (healthLoading ? null : "No data yet")
                      }
                    />
                    <StatusCard
                      title="Database health"
                      ok={dh?.ok}
                      loading={healthLoading && !health}
                      subtitle="Core tables readable (user & expense counts)"
                      detail={
                        dh?.ok
                          ? `Users: ${dh.userCount ?? "—"} · Expenses: ${dh.expenseCount ?? "—"}`
                          : dh?.error || undefined
                      }
                    />
                    <StatusCard
                      title="Application health"
                      ok={app?.ok}
                      loading={healthLoading && !health}
                      subtitle="Process, disk, and optional Redis"
                      detail={
                        app
                          ? `Uptime ${app.uptimeSeconds ?? "—"}s · RSS ${app.memoryRssMb ?? "—"} MB · Disk ${disk?.ok ? `${disk.usedPct ?? "?"}% used (${formatBytes(disk.usedBytes)} / ${formatBytes(disk.totalBytes)})` : disk?.error || "disk unknown"} · Redis ${
                              !app.redis?.configured
                                ? "not configured"
                                : app.redis.ok
                                  ? "OK"
                                  : `issue: ${app.redis.error || "?"}`
                            }`
                          : undefined
                      }
                    />
                  </div>
                  {health?.errorLogs?.length > 0 && (
                    <div className="rounded-lg border border-th-border bg-th-base/80 p-3 text-xs text-th-muted">
                      <span className="text-th-subtle font-medium">Logs</span>
                      <ul className="mt-1 list-disc pl-4 space-y-1">
                        {health.errorLogs.map((log, i) => (
                          <li key={i}>
                            [{log.level}] {log.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "backup" && (
                <div className="space-y-5">
                  <h2 className="text-lg font-medium text-white">Backup & restore</h2>
                  {backupFeedback && (
                    <p
                      className={
                        backupFeedback.type === "success"
                          ? "text-sm text-emerald-400 border border-emerald-900/40 rounded-lg px-3 py-2 bg-emerald-950/20"
                          : "text-sm text-rose-400 border border-rose-900/40 rounded-lg px-3 py-2 bg-rose-950/20"
                      }
                    >
                      {backupFeedback.message}
                    </p>
                  )}
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-th-tertiary mb-2">Per-user backup</h3>
                      <p className="text-xs text-th-muted mb-2 max-w-prose">
                        Choose a registered user. The list refreshes when you open this tab.
                      </p>
                      <div className="flex flex-wrap gap-2 items-center">
                        <label htmlFor="admin-backup-user-select" className="sr-only">
                          User to back up
                        </label>
                        <select
                          id="admin-backup-user-select"
                          value={userIdForBackup}
                          onChange={(e) => setUserIdForBackup(e.target.value)}
                          disabled={loadingUsers && users.length === 0}
                          className="min-w-[14rem] max-w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm"
                        >
                          {users.length === 0 ? (
                            <option value="">{loadingUsers ? "Loading users…" : "No users found"}</option>
                          ) : (
                            <>
                              <option value="">Select user…</option>
                              {users.map((u) => (
                                <option key={u.id} value={String(u.id)}>
                                  #{u.id} — {u.email}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                        <button
                          type="button"
                          disabled={loadingBackupUser || !userIdForBackup.trim() || users.length === 0}
                          onClick={() => void backupUser()}
                          className="rounded-lg border border-th-border-bright px-4 py-2 text-sm hover:bg-th-surface-alt disabled:opacity-50"
                        >
                          {loadingBackupUser ? "Downloading…" : "Download user backup"}
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-th-border pt-4">
                      <h3 className="text-sm font-medium text-th-tertiary mb-2">Whole database</h3>
                      <p className="text-xs text-th-muted mb-2 max-w-prose">
                        Requires re-authentication on the Session tab. Your browser will download a JSON snapshot.
                      </p>
                      <button
                        type="button"
                        disabled={loadingBackupDb}
                        onClick={() => void backupDatabase()}
                        className="rounded-lg border border-th-border-bright px-4 py-2 text-sm hover:bg-th-surface-alt disabled:opacity-50"
                      >
                        {loadingBackupDb ? "Preparing download…" : "Backup whole database"}
                      </button>
                    </div>
                    <div className="border-t border-th-border pt-4 space-y-3">
                      <h3 className="text-sm font-medium text-th-tertiary">Restore</h3>
                      <div className="flex flex-wrap gap-2 items-center">
                        <label className="text-sm text-th-subtle">
                          <span className="sr-only">Backup JSON file</span>
                          <input
                            type="file"
                            accept="application/json,.json"
                            disabled={loadingRestorePreview}
                            onChange={(e) => void previewRestore(e)}
                            className="text-sm file:mr-2 file:rounded-lg file:border-0 file:py-1.5 file:px-3 file:text-sm file:bg-th-input file:text-th-secondary"
                          />
                        </label>
                        {loadingRestorePreview && <span className="text-xs text-th-muted">Reading file…</span>}
                      </div>
                      {dbBackupPreview?.result && (
                        <pre className="text-xs bg-th-base p-3 rounded-lg border border-th-border overflow-auto max-h-48">
                          {JSON.stringify(dbBackupPreview.result, null, 2)}
                        </pre>
                      )}
                      <button
                        type="button"
                        disabled={loadingRestoreApply || !dbBackupPreview?.payload || !dbBackupPreview?.result?.ok}
                        onClick={() => void applyRestore()}
                        className="rounded-lg border border-amber-600/80 bg-amber-950/30 hover:bg-amber-950/50 px-4 py-2 text-sm text-amber-100 disabled:opacity-50"
                      >
                        {loadingRestoreApply ? "Restoring…" : "Apply restore from selected file"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "users" && (
                <div className="space-y-5">
                  <h2 className="text-lg font-medium text-white">User accounts</h2>
                  {usersFeedback && (
                    <p
                      className={
                        usersFeedback.type === "success"
                          ? "text-sm text-emerald-400 border border-emerald-900/40 rounded-lg px-3 py-2 bg-emerald-950/20"
                          : "text-sm text-rose-400 border border-rose-900/40 rounded-lg px-3 py-2 bg-rose-950/20"
                      }
                    >
                      {usersFeedback.message}
                    </p>
                  )}
                  <p className="text-xs text-th-muted">Password reset and role changes require re-authentication (Session tab).</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={loadingUsers}
                      onClick={() => void loadUsers()}
                      className="rounded-lg border border-th-border-bright px-4 py-2 text-sm hover:bg-th-surface-alt disabled:opacity-50"
                    >
                      {loadingUsers ? "Loading…" : "Refresh user list"}
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
                    <div>
                      <label className="block text-xs text-th-subtle mb-1">User ID</label>
                      <input
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-th-subtle mb-1">New password (reset)</label>
                      <input
                        value={targetPassword}
                        onChange={(e) => setTargetPassword(e.target.value)}
                        type="password"
                        className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={loadingResetPwd}
                      onClick={() => void resetUserPassword()}
                      className="rounded-lg border border-th-border-bright px-3 py-2 text-sm hover:bg-th-surface-alt disabled:opacity-50"
                    >
                      {loadingResetPwd ? "Saving…" : "Reset password"}
                    </button>
                    <div>
                      <label className="block text-xs text-th-subtle mb-1">Role</label>
                      <select
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                        className="w-full rounded-lg bg-th-input border border-th-border-bright px-3 py-2 text-sm"
                      >
                        <option value="user">user</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={loadingPermissions}
                      onClick={() => void updatePermissions()}
                      className="rounded-lg border border-th-border-bright px-3 py-2 text-sm hover:bg-th-surface-alt disabled:opacity-50 sm:col-span-2"
                    >
                      {loadingPermissions ? "Saving…" : "Update role"}
                    </button>
                  </div>
                  {users.length > 0 && (
                    <div className="rounded-lg border border-th-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-th-base text-th-subtle">
                          <tr>
                            <th className="px-3 py-2 font-medium">ID</th>
                            <th className="px-3 py-2 font-medium">Email</th>
                            <th className="px-3 py-2 font-medium">Role</th>
                            <th className="px-3 py-2 font-medium">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id} className="border-t border-th-border">
                              <td className="px-3 py-2 font-mono">{u.id}</td>
                              <td className="px-3 py-2">{u.email}</td>
                              <td className="px-3 py-2">{u.role}</td>
                              <td className="px-3 py-2 text-th-muted">{u.created_at ? String(u.created_at).slice(0, 10) : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "swagger" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-medium text-white">Swagger API docs</h2>
                    <a
                      href="/api/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-300 hover:underline"
                    >
                      Open in new tab
                    </a>
                  </div>
                  <p className="text-xs text-th-muted">
                    Docs are served by the API at <span className="font-mono">/api/docs</span>. The OpenAPI JSON is at{" "}
                    <span className="font-mono">/api/openapi.json</span>.
                  </p>
                  <div className="rounded-xl border border-th-border overflow-hidden bg-th-base">
                    <iframe
                      title="Swagger UI"
                      src="/api/docs"
                      className="w-full"
                      style={{ height: "70vh" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
