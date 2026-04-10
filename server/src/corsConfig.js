/**
 * Never use `origin: true` with credentials — that reflects any Origin.
 * When CLIENT_ORIGIN is unset: dev defaults to common Vite origins; production uses an empty allowlist until configured.
 */

function parseAllowedOrigins() {
  const raw = process.env.CLIENT_ORIGIN;
  if (raw && String(raw).trim()) {
    return String(raw)
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  return ["http://localhost:5173", "http://127.0.0.1:5173"];
}

const allowedList = parseAllowedOrigins();

/** @type {import("cors").CorsOptions["origin"]} */
export function corsOriginCallback(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }
  if (!allowedList.length) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "CORS: set CLIENT_ORIGIN to your web UI origin (e.g. https://app.example.com). Cross-origin requests are blocked until then."
      );
    }
    return callback(null, false);
  }
  if (allowedList.includes(origin)) {
    return callback(null, origin);
  }
  return callback(null, false);
}
