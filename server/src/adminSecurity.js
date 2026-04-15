import crypto from "crypto";
import jwt from "jsonwebtoken";

const ADMIN_SESSION_TTL_MS = 15 * 60 * 1000;
const REAUTH_TTL_SEC = 120;
const activeAdminSessions = new Map();
const pendingChallenges = new Map();

function b32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function b32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = String(input || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totpForStep(secret, step) {
  const key = b32Decode(secret);
  const buf = Buffer.alloc(8);
  let value = step;
  for (let i = 7; i >= 0; i--) {
    buf[i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  const digest = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(secret, code) {
  const normalized = String(code || "").trim();
  if (!/^\d{6}$/.test(normalized)) return false;
  const nowStep = Math.floor(Date.now() / 1000 / 30);
  // Allow modest client/server clock skew (about +/-60 seconds).
  for (let drift = -2; drift <= 2; drift++) {
    if (totpForStep(secret, nowStep + drift) === normalized) return true;
  }
  return false;
}

export function createAdminChallenge(adminId) {
  const id = crypto.randomBytes(18).toString("base64url");
  pendingChallenges.set(id, { adminId, createdAt: Date.now(), setupSecret: null });
  return id;
}

export function setChallengeSetupSecret(challengeId, setupSecret) {
  const entry = pendingChallenges.get(challengeId);
  if (!entry) return false;
  entry.setupSecret = setupSecret;
  return true;
}

export function getAdminChallenge(challengeId) {
  const entry = pendingChallenges.get(challengeId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    pendingChallenges.delete(challengeId);
    return null;
  }
  return entry;
}

export function consumeAdminChallenge(challengeId) {
  const entry = getAdminChallenge(challengeId);
  if (!entry) return null;
  pendingChallenges.delete(challengeId);
  return entry;
}

export function generateTotpSecret() {
  return b32Encode(crypto.randomBytes(20));
}

export function issueAdminSession(admin) {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { sub: admin.id, username: admin.username, admin: true, jti },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
  activeAdminSessions.set(jti, { adminId: admin.id, lastActivityAt: Date.now() });
  return token;
}

export function adminRequired(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing admin token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload?.admin || !payload?.jti) return res.status(401).json({ error: "Invalid admin token" });
    const session = activeAdminSessions.get(payload.jti);
    if (!session) return res.status(401).json({ error: "Admin session expired" });
    if (Date.now() - session.lastActivityAt > ADMIN_SESSION_TTL_MS) {
      activeAdminSessions.delete(payload.jti);
      return res.status(401).json({ error: "Admin session timed out due to inactivity" });
    }
    session.lastActivityAt = Date.now();
    req.adminId = Number(payload.sub);
    req.adminUsername = payload.username;
    req.adminSessionId = payload.jti;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid admin token" });
  }
}

export function issueReauthToken(adminId) {
  return jwt.sign({ sub: adminId, reauth: true }, process.env.JWT_SECRET, { expiresIn: REAUTH_TTL_SEC });
}

export function requireReauth(req, res, next) {
  const token = String(req.headers["x-admin-reauth"] || "");
  if (!token) return res.status(401).json({ error: "Re-authentication required" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const adminId = Number(payload?.sub);
    if (!payload?.reauth || !Number.isInteger(adminId) || adminId !== req.adminId) {
      return res.status(401).json({ error: "Invalid re-authentication token" });
    }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid re-authentication token" });
  }
}
