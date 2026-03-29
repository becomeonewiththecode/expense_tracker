import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { registerOAuthRoutes } from "../oauth/oauthRoutes.js";
import {
  recoveryLookupFromCode,
  persistRecoveryCodeForUser,
} from "../recoveryCodeStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const avatarsDir = path.join(__dirname, "..", "uploads", "avatars");

function ensureAvatarsDir() {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

function removeAvatarFiles(userId) {
  if (!fs.existsSync(avatarsDir)) return;
  const prefix = `${userId}.`;
  for (const name of fs.readdirSync(avatarsDir)) {
    if (name.startsWith(prefix)) {
      fs.unlinkSync(path.join(avatarsDir, name));
    }
  }
}

const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype);
    cb(ok ? null : new Error("Only JPEG, PNG, GIF, or WebP images are allowed"), ok);
  },
});

export const authRouter = Router();

const RECOVER_WINDOW_MS = 15 * 60 * 1000;
const RECOVER_MAX_PER_WINDOW = 10;
const recoverRateByIp = new Map();

function checkRecoverRateLimit(ip) {
  const key = ip || "unknown";
  const now = Date.now();
  let e = recoverRateByIp.get(key);
  if (!e || now > e.resetAt) {
    e = { count: 0, resetAt: now + RECOVER_WINDOW_MS };
    recoverRateByIp.set(key, e);
  }
  e.count += 1;
  if (e.count > RECOVER_MAX_PER_WINDOW) {
    return false;
  }
  return true;
}

function signUserToken(user) {
  const secret = process.env.JWT_SECRET;
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "7d" });
}

registerOAuthRoutes(authRouter);

/** One-time random code; store hash + derived lookup + ciphertext for backup export. User must save the code—no email is sent. */
authRouter.post("/recovery-code", authRequired, async (req, res) => {
  try {
    const plain = crypto.randomBytes(24).toString("base64url");
    await persistRecoveryCodeForUser(pool, req.userId, plain);
    res.status(201).json({ recoveryCode: plain });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "Could not generate a unique code. Try again." });
    }
    console.error("auth/recovery-code:", e);
    res.status(500).json({ error: "Failed to create recovery code" });
  }
});

authRouter.delete("/recovery-code", authRequired, async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET recovery_lookup = NULL, recovery_token_hash = NULL, recovery_code_ciphertext = NULL WHERE id = $1`,
      [req.userId]
    );
    const { rows } = await pool.query(
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password,
        (recovery_lookup IS NOT NULL) AS has_recovery_code
      FROM users WHERE id = $1`,
      [req.userId]
    );
    res.json({ user: rows[0] });
  } catch (e) {
    console.error("auth/recovery-code delete:", e);
    res.status(500).json({ error: "Failed to remove recovery code" });
  }
});

/**
 * Reset password using a recovery code saved from Profile. Does not send email.
 * After success, the code is invalidated; user signs in with email + new password.
 */
authRouter.post("/recover-password", async (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || "";
  if (!checkRecoverRateLimit(ip)) {
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  const recoveryCode = String(req.body?.recoveryCode || "").trim();
  const newPassword = String(req.body?.newPassword || "");
  if (!recoveryCode || !newPassword) {
    return res.status(400).json({ error: "Recovery code and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const lookup = recoveryLookupFromCode(recoveryCode);
  try {
    const { rows } = await pool.query(
      `SELECT id, email, recovery_token_hash FROM users WHERE recovery_lookup = $1`,
      [lookup]
    );
    const user = rows[0];
    const generic = { error: "Invalid recovery code or password could not be reset" };
    if (!user?.recovery_token_hash) {
      return res.status(400).json(generic);
    }
    const ok = await bcrypt.compare(recoveryCode, user.recovery_token_hash);
    if (!ok) {
      return res.status(400).json(generic);
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users SET password_hash = $1, recovery_lookup = NULL, recovery_token_hash = NULL, recovery_code_ciphertext = NULL WHERE id = $2`,
      [hash, user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("auth/recover-password:", e);
    res.status(500).json({ error: "Password reset failed" });
  }
});

authRouter.get("/me", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password,
        (recovery_lookup IS NOT NULL) AS has_recovery_code
      FROM users WHERE id = $1`,
      [req.userId]
    );
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ user: rows[0] });
  } catch (e) {
    console.error("auth/me:", e);
    res.status(500).json({ error: "Failed to load user" });
  }
});

authRouter.patch("/profile", authRequired, async (req, res) => {
  const emailRaw = req.body?.email;
  const email =
    emailRaw != null && String(emailRaw).trim() !== ""
      ? String(emailRaw).trim().toLowerCase()
      : null;
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  try {
    const { rows: existing } = await pool.query(
      `SELECT id, email, password_hash, avatar_url FROM users WHERE id = $1`,
      [req.userId]
    );
    const user = existing[0];
    if (!user) return res.status(404).json({ error: "Not found" });

    const hasPassword = Boolean(user.password_hash);
    let needPasswordCheck = false;

    if (email && email !== user.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Invalid email" });
      }
      if (hasPassword) needPasswordCheck = true;
    }
    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }
      if (hasPassword) needPasswordCheck = true;
    }

    if (needPasswordCheck && hasPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Current password is required" });
      }
      if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }

    if (email && email !== user.email) {
      try {
        await pool.query(`UPDATE users SET email = $1 WHERE id = $2`, [email, req.userId]);
        await pool.query(`UPDATE oauth_identities SET email = $1 WHERE user_id = $2`, [email, req.userId]);
      } catch (e) {
        if (e.code === "23505") return res.status(409).json({ error: "Email already in use" });
        throw e;
      }
    }

    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, req.userId]);
    }

    const { rows: updated } = await pool.query(
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password,
        (recovery_lookup IS NOT NULL) AS has_recovery_code
      FROM users WHERE id = $1`,
      [req.userId]
    );
    const u = updated[0];
    const token = signUserToken(u);
    res.json({ user: u, token });
  } catch (e) {
    console.error("auth/profile:", e);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

authRouter.post(
  "/avatar",
  authRequired,
  (req, res, next) => {
    uploadAvatar.single("file")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || "Upload failed" });
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (use field name \"file\")" });
    }
    const mime = req.file.mimetype;
    const ext =
      mime === "image/jpeg" || mime === "image/jpg"
        ? "jpg"
        : mime === "image/png"
          ? "png"
          : mime === "image/gif"
            ? "gif"
            : "webp";
    ensureAvatarsDir();
    removeAvatarFiles(req.userId);
    const filename = `${req.userId}.${ext}`;
    fs.writeFileSync(path.join(avatarsDir, filename), req.file.buffer);
    const avatar_url = `/api/uploads/avatars/${filename}`;
    try {
      await pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2`, [avatar_url, req.userId]);
      const { rows } = await pool.query(
        `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password,
          (recovery_lookup IS NOT NULL) AS has_recovery_code
        FROM users WHERE id = $1`,
        [req.userId]
      );
      res.json({ user: rows[0] });
    } catch (e) {
      console.error("auth/avatar:", e);
      res.status(500).json({ error: "Failed to save profile picture" });
    }
  }
);

authRouter.delete("/avatar", authRequired, async (req, res) => {
  try {
    removeAvatarFiles(req.userId);
    await pool.query(`UPDATE users SET avatar_url = NULL WHERE id = $1`, [req.userId]);
    const { rows } = await pool.query(
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password,
        (recovery_lookup IS NOT NULL) AS has_recovery_code
      FROM users WHERE id = $1`,
      [req.userId]
    );
    res.json({ user: rows[0] });
  } catch (e) {
    console.error("auth/avatar delete:", e);
    res.status(500).json({ error: "Failed to remove profile picture" });
  }
});

function dbConnectivityMessage(e) {
  const code = e?.code;
  const msg = String(e?.message || "");
  if (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    /connection refused|connect ECONNREFUSED|getaddrinfo/i.test(msg)
  ) {
    return "Cannot connect to PostgreSQL. Run: docker compose up -d and check DATABASE_URL in server/.env";
  }
  if (code === "28P01" || /password authentication failed/i.test(msg)) {
    return "PostgreSQL rejected the credentials in DATABASE_URL.";
  }
  if (code === "3D000" || /database .* does not exist/i.test(msg)) {
    return "Database does not exist. Create it or fix DATABASE_URL (see docker-compose.yml).";
  }
  return null;
}

authRouter.post("/register", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 8) {
    return res.status(500).json({
      error: "Server misconfigured: set JWT_SECRET (8+ characters) in server/.env",
    });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at, avatar_url`,
      [email, hash]
    );
    const user = rows[0];
    const token = signUserToken(user);
    res.status(201).json({
      user: { id: user.id, email: user.email, avatar_url: user.avatar_url, has_password: true },
      token,
    });
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    const dbHint = dbConnectivityMessage(e);
    if (dbHint) {
      console.error("register db error:", e);
      return res.status(503).json({ error: dbHint });
    }
    console.error("register error:", e);
    res.status(500).json({ error: "Registration failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 8) {
    return res.status(500).json({
      error: "Server misconfigured: set JWT_SECRET (8+ characters) in server/.env",
    });
  }
  let rows;
  try {
    const result = await pool.query(
      `SELECT id, email, password_hash, avatar_url FROM users WHERE email = $1`,
      [email]
    );
    rows = result.rows;
  } catch (e) {
    const dbHint = dbConnectivityMessage(e);
    if (dbHint) {
      console.error("login db error:", e);
      return res.status(503).json({ error: dbHint });
    }
    console.error("login error:", e);
    return res.status(500).json({ error: "Login failed" });
  }
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  if (!user.password_hash) {
    return res.status(401).json({
      error:
        "This account has no password yet. Sign in with Google (Gmail), GitHub, GitLab, or Microsoft 365, then open Profile to set a password if you want email login.",
    });
  }
  if (!(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signUserToken(user);
  res.json({
    user: {
      id: user.id,
      email: user.email,
      avatar_url: user.avatar_url,
      has_password: Boolean(user.password_hash),
    },
    token,
  });
});

/**
 * Issue a new JWT using an existing one, even if expired (signature must verify).
 * Rejects tokens whose expiry is too far in the past (grace window after expiration).
 */
authRouter.post("/refresh", async (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).length < 8) {
    return res.status(500).json({
      error: "Server misconfigured: set JWT_SECRET (8+ characters) in server/.env",
    });
  }
  let payload;
  try {
    payload = jwt.verify(token, secret, { ignoreExpiration: true });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
  const raw = payload.sub;
  const userId = typeof raw === "string" ? parseInt(raw, 10) : Number(raw);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(401).json({ error: "Invalid token" });
  }
  /** Max time after `exp` (when present) that refresh is still allowed — limits stale stolen tokens. */
  const REFRESH_GRACE_SEC = 60 * 60 * 24 * 30;
  if (payload.exp != null && typeof payload.exp === "number") {
    const nowSec = Date.now() / 1000;
    if (nowSec - payload.exp > REFRESH_GRACE_SEC) {
      return res.status(401).json({ error: "Session expired; sign in again" });
    }
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password,
        (recovery_lookup IS NOT NULL) AS has_recovery_code
      FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows[0]) return res.status(401).json({ error: "Invalid token" });
    const u = rows[0];
    const newToken = signUserToken(u);
    res.json({
      token: newToken,
      user: {
        id: u.id,
        email: u.email,
        avatar_url: u.avatar_url,
        has_password: u.has_password,
        has_recovery_code: u.has_recovery_code,
      },
    });
  } catch (e) {
    console.error("auth/refresh:", e);
    res.status(500).json({ error: "Could not refresh session" });
  }
});
