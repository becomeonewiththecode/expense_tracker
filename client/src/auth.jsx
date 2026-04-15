import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api, { setSessionInvalidHandler } from "./api.js";
import SessionExpiredModal from "./components/SessionExpiredModal.jsx";
import { USER_KEY } from "./authStorage.js";

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
  const [user, setUser] = useState(readStoredUser);
  const [isReady, setIsReady] = useState(false);
  const [sessionExpiredOpen, setSessionExpiredOpen] = useState(false);
  const sessionPromptShownRef = useRef(false);

  const setSession = (u) => {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
    setUser(u ?? null);
  };

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout API errors and still clear local state.
    }
    setSession(null);
  }, []);

  const fetchCurrentUser = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await api.get("/auth/me", {
        _skipSessionInvalidHandler: Boolean(silent),
      });
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } catch {
      localStorage.removeItem(USER_KEY);
      setUser(null);
      return null;
    }
  }, []);

  const refreshUser = useCallback(async () => fetchCurrentUser(), [fetchCurrentUser]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await fetchCurrentUser({ silent: true });
      if (mounted) setIsReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [fetchCurrentUser]);

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
      user,
      isAuthed: Boolean(user),
      isReady,
      setSession,
      logout,
      refreshUser,
    }),
    [user, isReady, logout, refreshUser]
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
