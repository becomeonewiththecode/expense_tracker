import crypto from "node:crypto";

const TTL_MS = 120_000;
/** @type {Map<string, { token: string; expiresAt: number }>} */
const pending = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pending) {
    if (now > v.expiresAt) pending.delete(k);
  }
}, 60_000);

/**
 * Store a freshly issued session JWT and return a one-time code for the SPA to exchange.
 * Avoids putting bearer tokens in the browser URL (Referer / logs / history).
 */
export function createOAuthLoginCode(sessionToken) {
  const code = crypto.randomBytes(32).toString("base64url");
  pending.set(code, { token: sessionToken, expiresAt: Date.now() + TTL_MS });
  return code;
}

/** @returns {string|null} JWT or null if invalid/expired */
export function consumeOAuthLoginCode(code) {
  if (!code || typeof code !== "string") return null;
  const entry = pending.get(code);
  pending.delete(code);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.token;
}
