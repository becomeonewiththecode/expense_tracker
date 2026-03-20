import React, { createContext, useContext, useMemo, useState } from "react";
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

  const setToken = (t, u) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
    setTokenState(t);
    setUser(u ?? null);
  };

  const logout = () => setToken(null, null);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthed: Boolean(token),
      setSession: setToken,
      logout,
    }),
    [token, user]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
