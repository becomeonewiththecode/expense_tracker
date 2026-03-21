import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { registerOAuthRoutes } from "../oauth/oauthRoutes.js";

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

function signUserToken(user) {
  const secret = process.env.JWT_SECRET;
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "7d" });
}

registerOAuthRoutes(authRouter);

authRouter.get("/me", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1`,
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
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1`,
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
        `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1`,
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
      `SELECT id, email, avatar_url, (password_hash IS NOT NULL) AS has_password FROM users WHERE id = $1`,
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
