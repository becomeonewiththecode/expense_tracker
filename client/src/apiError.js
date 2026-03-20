/** User-visible message from an Axios/fetch-style error. */
export function getApiErrorMessage(err, fallback = "Something went wrong") {
  const data = err?.response?.data;
  const serverMsg =
    typeof data?.error === "string" && data.error.length
      ? data.error
      : typeof data?.message === "string" && data.message.length
        ? data.message
        : null;
  if (serverMsg) return serverMsg;

  const code = err?.code;
  if (code === "ERR_NETWORK" || err?.message === "Network Error") {
    return "Cannot reach the API. In a terminal run: cd server && npm run dev (port 4000), and keep Postgres running (docker compose up -d).";
  }
  if (!err?.response) {
    return "No response from the server. Start the API with: cd server && npm run dev";
  }

  const status = err.response.status;
  if (status === 502 || status === 503 || status === 504) {
    return `API or proxy error (${status}). Is the server running on the port in client/.env (API_PROXY_TARGET, default http://127.0.0.1:4000)? For PM2: npx pm2 logs expense-api`;
  }
  if (typeof data === "string" && data.length && /<html/i.test(data)) {
    return `Server returned HTML (${status}) instead of JSON — often a proxy or crash page. Check API logs: npx pm2 logs expense-api`;
  }

  if (fallback && status) {
    return `${fallback} (HTTP ${status})`;
  }
  return fallback;
}
