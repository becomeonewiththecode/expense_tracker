import axios from "axios";

export const ADMIN_TOKEN_KEY = "expense_tracker_admin_token";

/** Error messages from `adminRequired` when the admin session must end (re-login). */
function isAdminSessionFatal401(error) {
  const msg = String(error?.response?.data?.error || "").toLowerCase();
  return (
    msg === "missing admin token" ||
    msg === "invalid admin token" ||
    msg === "admin session expired" ||
    msg.includes("timed out due to inactivity")
  );
}

export const adminApi = axios.create({
  baseURL: "/api/admin",
  headers: { "Content-Type": "application/json" },
  timeout: 120_000,
});

adminApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && isAdminSessionFatal401(error)) {
      const hadBearer = Boolean(error.config?.headers?.Authorization);
      if (hadBearer) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        const next = `/admin/login?expired=1`;
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin/login")) {
          window.location.replace(next);
        }
      }
    }
    return Promise.reject(error);
  }
);

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token) {
  if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}
