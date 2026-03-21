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

  const hasPassword = Boolean(user?.has_password);

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
    </div>
  );
}
