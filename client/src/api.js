import axios from "axios";
import { TOKEN_KEY, USER_KEY } from "./authStorage.js";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

/** Called when a protected request returns a session-invalid 401. */
let sessionInvalidHandler = null;

function isSessionFatal401(error) {
  const msg = String(error?.response?.data?.error || "").toLowerCase();
  return (
    msg === "missing token" ||
    msg === "invalid token" ||
    msg === "session expired" ||
    msg.includes("timed out due to inactivity")
  );
}

export function setSessionInvalidHandler(fn) {
  sessionInvalidHandler = fn;
}

api.interceptors.request.use((config) => {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const reqUrl = String(error.config?.url || "");
    if (
      status === 401 &&
      isSessionFatal401(error) &&
      !reqUrl.includes("/auth/refresh") &&
      !reqUrl.includes("/auth/login") &&
      !reqUrl.includes("/auth/register") &&
      !reqUrl.includes("/auth/recover-password")
    ) {
      const hadBearer = Boolean(error.config?.headers?.Authorization);
      if (hadBearer) {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
        }
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.replace("/login?expired=1");
        }
      } else {
        sessionInvalidHandler?.();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
