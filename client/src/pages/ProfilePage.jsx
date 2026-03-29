import { useEffect, useState } from "react";
import api from "../api";
import { getApiErrorMessage } from "../apiError.js";
import { useAuth } from "../auth.jsx";

export default function ProfilePage() {
  const { user, setSession, token, refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileOk, setProfileOk] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [avatarError, setAvatarError] = useState("");
  const [avatarOk, setAvatarOk] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryOk, setRecoveryOk] = useState("");
  const [shownRecoveryCode, setShownRecoveryCode] = useState("");

  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState("");
  const [backupOk, setBackupOk] = useState("");
  const [restoreMode, setRestoreMode] = useState("append");

  const hasPassword = Boolean(user?.has_password);
  const hasRecoveryCode = Boolean(user?.has_recovery_code);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onSubmitProfile(e) {
    e.preventDefault();
    setProfileError("");
    setProfileOk("");
    if (newPassword && newPassword !== confirmPassword) {
      setProfileError("New password and confirmation do not match.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setProfileError("New password must be at least 6 characters.");
      return;
    }
    setProfileLoading(true);
    try {
      const body = {};
      if (email.trim().toLowerCase() !== user.email) {
        body.email = email.trim().toLowerCase();
      }
      if (newPassword) {
        body.newPassword = newPassword;
      }
      if (hasPassword && (body.email || body.newPassword)) {
        body.currentPassword = currentPassword;
      }
      const { data } = await api.patch("/auth/profile", body);
      setSession(data.token, data.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileOk("Profile updated.");
    } catch (err) {
      setProfileError(getApiErrorMessage(err, "Update failed"));
    } finally {
      setProfileLoading(false);
    }
  }

  function onPickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarError("");
    setAvatarOk("");
  }

  async function onUploadAvatar(e) {
    e.preventDefault();
    const input = document.getElementById("avatar-input");
    const file = input?.files?.[0];
    if (!file) {
      setAvatarError("Choose an image first.");
      return;
    }
    setAvatarError("");
    setAvatarOk("");
    setAvatarLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/auth/avatar", fd);
      setSession(token, data.user);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      input.value = "";
      setAvatarOk("Picture updated.");
      await refreshUser();
    } catch (err) {
      setAvatarError(getApiErrorMessage(err, "Upload failed"));
    } finally {
      setAvatarLoading(false);
    }
  }

  async function onGenerateRecoveryCode() {
    setRecoveryError("");
    setRecoveryOk("");
    setShownRecoveryCode("");
    setRecoveryLoading(true);
    try {
      const { data } = await api.post("/auth/recovery-code");
      setShownRecoveryCode(data.recoveryCode || "");
      setRecoveryOk("Copy this code and store it somewhere safe. It will not be shown again.");
      await refreshUser();
    } catch (err) {
      setRecoveryError(getApiErrorMessage(err, "Could not create code"));
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function onDownloadBackup() {
    setBackupError("");
    setBackupOk("");
    setBackupLoading(true);
    try {
      const { data } = await api.get("/backup/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const day = new Date().toISOString().slice(0, 10);
      a.download = `expense-tracker-backup-${day}.json`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setBackupOk(
        `Downloaded backup with ${typeof data.expenseCount === "number" ? data.expenseCount : data.expenses?.length ?? 0} expense(s).`
      );
    } catch (err) {
      setBackupError(getApiErrorMessage(err, "Download failed"));
    } finally {
      setBackupLoading(false);
    }
  }

  async function onRestoreBackup(e) {
    e.preventDefault();
    setBackupError("");
    setBackupOk("");
    const input = document.getElementById("backup-file-input");
    const file = input?.files?.[0];
    if (!file) {
      setBackupError("Choose a backup JSON file first.");
      return;
    }
    if (restoreMode === "replace") {
      const ok = window.confirm(
        "Replace mode deletes all current expenses, then imports the file. This cannot be undone. Continue?"
      );
      if (!ok) return;
    }
    setBackupLoading(true);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        setBackupError("File is not valid JSON.");
        setBackupLoading(false);
        return;
      }
      const { data } = await api.post("/backup/restore", {
        ...parsed,
        mode: restoreMode,
      });
      setBackupOk(`Restored ${data.restored} expense(s) (${data.mode}).`);
      if (input) input.value = "";
    } catch (err) {
      setBackupError(getApiErrorMessage(err, "Restore failed"));
    } finally {
      setBackupLoading(false);
    }
  }

  async function onRemoveRecoveryCode() {
    setRecoveryError("");
    setRecoveryOk("");
    setShownRecoveryCode("");
    setRecoveryLoading(true);
    try {
      const { data } = await api.delete("/auth/recovery-code");
      if (data.user) setSession(token, data.user);
      setRecoveryOk("Recovery code removed.");
      await refreshUser();
    } catch (err) {
      setRecoveryError(getApiErrorMessage(err, "Could not remove code"));
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function onRemoveAvatar() {
    setAvatarError("");
    setAvatarOk("");
    setAvatarLoading(true);
    try {
      const { data } = await api.delete("/auth/avatar");
      setSession(token, data.user);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      const input = document.getElementById("avatar-input");
      if (input) input.value = "";
      setAvatarOk("Picture removed.");
      await refreshUser();
    } catch (err) {
      setAvatarError(getApiErrorMessage(err, "Remove failed"));
    } finally {
      setAvatarLoading(false);
    }
  }

  const displaySrc = previewUrl || user?.avatar_url || null;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Profile</h1>
        <p className="text-slate-400 text-sm mt-1">Update your email, password, and profile picture.</p>
        <p className="text-slate-500 text-xs mt-2 max-w-prose">
          Imports and saved expenses belong to the account you are signed in as
          {user?.email ? (
            <>
              {" "}
              (<span className="text-slate-400">{user.email}</span>
              {user?.id != null ? (
                <>
                  , user #{user.id}
                </>
              ) : null}
              )
            </>
          ) : null}
          . If you sign in with a different email or provider, you will see a different (possibly empty) list.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-medium text-slate-300">Profile picture</h2>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {displaySrc ? (
              <img src={displaySrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-slate-500 text-xs text-center px-2">No picture</span>
            )}
          </div>
          <div className="flex-1 space-y-3 w-full">
            <input
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={onPickFile}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
            />
            <p className="text-xs text-slate-500">JPEG, PNG, GIF, or WebP. Maximum size 2 MB.</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={avatarLoading}
                onClick={onUploadAvatar}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
              >
                {avatarLoading ? "Saving…" : "Save picture"}
              </button>
              {(user?.avatar_url || previewUrl) && (
                <button
                  type="button"
                  disabled={avatarLoading}
                  onClick={onRemoveAvatar}
                  className="rounded-lg border border-slate-600 text-slate-300 text-sm py-2 px-4 hover:bg-slate-800"
                >
                  Remove picture
                </button>
              )}
            </div>
            {avatarError && (
              <p className="text-sm text-rose-400">{avatarError}</p>
            )}
            {avatarOk && <p className="text-sm text-emerald-400">{avatarOk}</p>}
          </div>
        </div>
      </div>

      <form onSubmit={onSubmitProfile} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-medium text-slate-300">Email and password</h2>
        {profileError && (
          <p className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-3 py-2">
            {profileError}
          </p>
        )}
        {profileOk && <p className="text-sm text-emerald-400">{profileOk}</p>}

        <div>
          <label htmlFor="profile-email" className="block text-xs font-medium text-slate-400 mb-1">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            required
          />
        </div>

        {hasPassword && (
          <div>
            <label htmlFor="current-password" className="block text-xs font-medium text-slate-400 mb-1">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Required when changing email or password"
            />
          </div>
        )}

        <>
          <div>
            <label htmlFor="new-password" className="block text-xs font-medium text-slate-400 mb-1">
              {hasPassword ? "New password" : "Set password (optional)"}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder={
                hasPassword ? "Leave blank to keep current password" : "Add a password for email sign-in"
              }
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-xs font-medium text-slate-400 mb-1">
              {hasPassword ? "Confirm new password" : "Confirm password"}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              placeholder="Repeat new password"
            />
          </div>
        </>

        {!hasPassword && (
          <p className="text-sm text-slate-500 border border-slate-800 rounded-lg px-3 py-2">
            You can still change your email without a password. To use email and password on the sign-in page, set a
            password above (or keep using Google, GitHub, GitLab, or Microsoft 365).
          </p>
        )}

        <button
          type="submit"
          disabled={profileLoading}
          className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 transition-colors"
        >
          {profileLoading ? "Saving…" : "Save email and password"}
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-medium text-slate-300">Password recovery (no email)</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Generate a one-time recovery code and keep it offline. If you forget your password, use{" "}
          <span className="text-slate-400">Forgot password</span> on the sign-in page with this code—nothing is sent by
          email. After a successful reset, the code stops working and you sign in with your email and new password.
        </p>
        {recoveryError && (
          <p className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-3 py-2">
            {recoveryError}
          </p>
        )}
        {recoveryOk && !shownRecoveryCode && (
          <p className="text-sm text-emerald-400">{recoveryOk}</p>
        )}
        {shownRecoveryCode && (
          <div className="space-y-2">
            <p className="text-sm text-amber-200/90">{recoveryOk}</p>
            <div className="rounded-lg bg-slate-950 border border-amber-900/50 p-3 font-mono text-xs text-amber-100 break-all select-all">
              {shownRecoveryCode}
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(shownRecoveryCode);
              }}
              className="text-xs text-emerald-400 hover:underline"
            >
              Copy to clipboard
            </button>
          </div>
        )}
        {hasRecoveryCode && !shownRecoveryCode && (
          <div
            className="min-w-0 max-w-full overflow-hidden rounded-lg bg-slate-950 border border-slate-700 px-3 py-2.5 space-y-1.5"
            role="status"
            aria-label="A recovery code is saved on this account"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Saved recovery code</p>
            <p
              className="w-full min-w-0 max-w-full font-mono text-sm text-slate-500 select-none break-all leading-normal tracking-normal"
              aria-hidden="true"
            >
              ••••••••••••••••••••
            </p>
            <p className="text-[11px] text-slate-500 leading-snug">
              The full code was shown only when you created or replaced it. Use{" "}
              <span className="text-slate-400">Replace recovery code</span> if you need a new one.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={recoveryLoading}
            onClick={onGenerateRecoveryCode}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
          >
            {recoveryLoading ? "Working…" : hasRecoveryCode ? "Replace recovery code" : "Generate recovery code"}
          </button>
          {hasRecoveryCode && (
            <button
              type="button"
              disabled={recoveryLoading}
              onClick={onRemoveRecoveryCode}
              className="rounded-lg border border-slate-600 text-slate-300 text-sm py-2 px-4 hover:bg-slate-800"
            >
              Remove recovery code
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-medium text-slate-300">Backup and restore</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Download a JSON file with all expenses. Restore from a file created by this app.{" "}
          <span className="text-slate-400">Append</span> adds rows to what you already have;{" "}
          <span className="text-slate-400">Replace</span> removes all expenses first, then imports the file.
          Keep backups private—they contain your spending data.
        </p>
        {backupError && (
          <p className="text-sm text-rose-400 bg-rose-950/50 border border-rose-900 rounded-lg px-3 py-2">
            {backupError}
          </p>
        )}
        {backupOk && <p className="text-sm text-emerald-400">{backupOk}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={backupLoading}
            onClick={onDownloadBackup}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium py-2 px-4"
          >
            {backupLoading ? "Working…" : "Download backup"}
          </button>
        </div>
        <form onSubmit={onRestoreBackup} className="space-y-3 pt-2 border-t border-slate-800">
          <div>
            <label htmlFor="restore-mode" className="block text-xs font-medium text-slate-400 mb-1">
              Restore mode
            </label>
            <select
              id="restore-mode"
              value={restoreMode}
              onChange={(e) => setRestoreMode(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="append">Append to current expenses</option>
              <option value="replace">Replace all expenses</option>
            </select>
          </div>
          <div>
            <label htmlFor="backup-file-input" className="block text-xs font-medium text-slate-400 mb-1">
              Backup file
            </label>
            <input
              id="backup-file-input"
              type="file"
              accept="application/json,.json"
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
            />
          </div>
          <button
            type="submit"
            disabled={backupLoading}
            className="rounded-lg border border-amber-700/80 bg-amber-950/30 hover:bg-amber-950/50 disabled:opacity-50 text-amber-100 text-sm font-medium py-2 px-4"
          >
            {backupLoading ? "Restoring…" : "Restore from file"}
          </button>
        </form>
      </div>
    </div>
  );
}
