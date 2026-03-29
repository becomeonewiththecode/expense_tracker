import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api, { setSessionInvalidHandler } from "./api.js";
import SessionExpiredModal from "./components/SessionExpiredModal.jsx";
import { TOKEN_KEY, USER_KEY } from "./authStorage.js";

const AuthCtx = createContext(null);

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(readStoredUser);
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  const sessionPromptShownRef = useRef(false);

  const setToken = (t, u) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
    setTokenState(t);
    setUser(u ?? null);
  };

  const logout = () => setToken(null, null);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (!t) return;
    try {
      const { data } = await api.get("/auth/me");
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (token) refreshUser();
  }, [token, refreshUser]);

  const closeSessionExpiredModal = useCallback(() => {
    sessionPromptShownRef.current = false;
    setSessionExpiredOpen(false);
  }, []);

  useEffect(() => {
    setSessionInvalidHandler(() => {
      if (sessionPromptShownRef.current) return;
      sessionPromptShownRef.current = true;
      setSessionExpiredOpen(true);
    });
    return () => setSessionInvalidHandler(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthed: Boolean(token),
      setSession: setToken,
      logout,
      refreshUser,
    }),
    [token, user, refreshUser]
  );

  return (
    <AuthCtx.Provider value={value}>
      {children}
      <SessionExpiredModal open={sessionExpiredOpen} onClose={closeSessionExpiredModal} />
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
