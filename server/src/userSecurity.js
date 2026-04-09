import crypto from "crypto";
import jwt from "jsonwebtoken";
import { generateTotpSecret, verifyTotpCode } from "./adminSecurity.js";

const USER_SESSION_TTL_MS = 15 * 60 * 1000;
const activeUserSessions = new Map();
const pendingUserChallenges = new Map();

export { generateTotpSecret, verifyTotpCode };

export function createUserChallenge(userId) {
  const id = crypto.randomBytes(18).toString("base64url");
  pendingUserChallenges.set(id, { userId, createdAt: Date.now(), setupSecret: null });
  return id;
}

export function setUserChallengeSetupSecret(challengeId, setupSecret) {
  const entry = pendingUserChallenges.get(challengeId);
  if (!entry) return false;
  entry.setupSecret = setupSecret;
  return true;
}

export function getUserChallenge(challengeId) {
  const entry = pendingUserChallenges.get(challengeId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    pendingUserChallenges.delete(challengeId);
    return null;
  }
  return entry;
}

export function consumeUserChallenge(challengeId) {
  const entry = getUserChallenge(challengeId);
  if (!entry) return null;
  pendingUserChallenges.delete(challengeId);
  return entry;
}

export function issueUserSession(user) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: user.id, email: user.email, jti }, process.env.JWT_SECRET, { expiresIn: "7d" });
  activeUserSessions.set(jti, { userId: Number(user.id), lastActivityAt: Date.now() });
  return token;
}

export function verifyUserSessionToken(token, { ignoreExpiration = false } = {}) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration });
  } catch {
    return { ok: false, error: "Invalid token" };
  }
  const rawSub = payload?.sub;
  const userId = typeof rawSub === "string" ? parseInt(rawSub, 10) : Number(rawSub);
  const jti = String(payload?.jti || "");
  if (!Number.isInteger(userId) || userId < 1 || !jti) {
    return { ok: false, error: "Invalid token" };
  }
  const session = activeUserSessions.get(jti);
  if (!session || session.userId !== userId) {
    return { ok: false, error: "Session expired" };
  }
  if (Date.now() - session.lastActivityAt > USER_SESSION_TTL_MS) {
    activeUserSessions.delete(jti);
    return { ok: false, error: "Session timed out due to inactivity" };
  }
  session.lastActivityAt = Date.now();
  return { ok: true, payload, userId, jti };
}

export function revokeUserSession(jti) {
  if (!jti) return;
  activeUserSessions.delete(jti);
}
