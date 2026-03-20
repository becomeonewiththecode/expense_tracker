import crypto from "node:crypto";

const store = new Map();
const TTL_MS = 15 * 60 * 1000;

export function createOAuthState(provider) {
  const state = crypto.randomBytes(24).toString("hex");
  store.set(state, { provider, at: Date.now() });
  return state;
}

/** @returns {string|null} provider id */
export function consumeOAuthState(state) {
  if (!state || typeof state !== "string") return null;
  const data = store.get(state);
  if (!data || Date.now() - data.at > TTL_MS) {
    store.delete(state);
    return null;
  }
  store.delete(state);
  return data.provider;
}
