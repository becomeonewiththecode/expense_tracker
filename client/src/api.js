import axios from "axios";
import { TOKEN_KEY } from "./authStorage.js";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

/** Called when a protected request returns 401 Invalid token (e.g. expired JWT). */
let sessionInvalidHandler = null;

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
    const errMsg = error.response?.data?.error;
    const reqUrl = String(error.config?.url || "");
    if (
      status === 401 &&
      errMsg === "Invalid token" &&
      !reqUrl.includes("/auth/refresh") &&
      !reqUrl.includes("/auth/login") &&
      !reqUrl.includes("/auth/register") &&
      !reqUrl.includes("/auth/recover-password")
    ) {
      sessionInvalidHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
