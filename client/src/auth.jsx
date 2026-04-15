import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api, { setSessionInvalidHandler, setActivityHandler } from "./api.js";
import SessionExpiredModal from "./components/SessionExpiredModal.jsx";
import SessionExpiringBanner from "./components/SessionExpiringBanner.jsx";
import { USER_KEY } from "./authStorage.js";

/** Must match USER_SESSION_TTL_MS in server/src/userSecurity.js (15 min). */
const SESSION_INACTIVITY_TTL_MS = 15 * 60 * 1000;
const WARN_BEFORE_MS = 2 * 60 * 1000;

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
  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const sessionPromptShownRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  const setSession = useCallback((u) => {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
    setUser(u ?? null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Ignore logout API errors and still clear local state.
    }
    setSession(null);
  }, [setSession]);

  const fetchCurrentUser = useCallback(async ({ silent = false } = {}) => {
    try {
      const { data } = await api.get("/auth/me", {
        _skipSessionInvalidHandler: Boolean(silent),
      });
      setSession(data.user);
      return data.user;
    } catch {
      setSession(null);
      return null;
    }
  }, [setSession]);

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
      setSessionWarningOpen(false);
      setSessionExpiredOpen(true);
    });
    return () => setSessionInvalidHandler(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    lastActivityRef.current = Date.now();

    setActivityHandler(() => {
      lastActivityRef.current = Date.now();
      setSessionWarningOpen(false);
    });

    const interval = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      const warnThreshold = SESSION_INACTIVITY_TTL_MS - WARN_BEFORE_MS;
      if (idle >= warnThreshold && !sessionPromptShownRef.current) {
        setSessionWarningOpen(true);
      }
    }, 30_000);

    return () => {
      clearInterval(interval);
      setActivityHandler(null);
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      isAuthed: Boolean(user),
      isReady,
      setSession,
      logout,
      refreshUser,
    }),
    [user, isReady, setSession, logout, refreshUser]
  );

  return (
    <AuthCtx.Provider value={value}>
      {children}
      <SessionExpiringBanner
        open={sessionWarningOpen}
        onDismiss={() => setSessionWarningOpen(false)}
      />
      <SessionExpiredModal open={sessionExpiredOpen} onClose={closeSessionExpiredModal} />
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
