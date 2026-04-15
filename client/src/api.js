import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

/** Called when a protected request returns a session-invalid 401. */
let sessionInvalidHandler = null;

/** Called when any API request completes successfully (to reset the inactivity timer). */
let activityHandler = null;

export function setActivityHandler(fn) {
  activityHandler = fn;
}

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
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    activityHandler?.();
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const reqUrl = String(error.config?.url || "");
    const skipSessionInvalidHandler = Boolean(error.config?._skipSessionInvalidHandler);
    if (
      status === 401 &&
      !skipSessionInvalidHandler &&
      isSessionFatal401(error) &&
      !reqUrl.includes("/auth/refresh") &&
      !reqUrl.includes("/auth/login") &&
      !reqUrl.includes("/auth/register") &&
      !reqUrl.includes("/auth/recover-password")
    ) {
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
        return Promise.reject(error);
      }
      sessionInvalidHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
