import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { registerOAuthRoutes } from "../oauth/oauthRoutes.js";

export const authRouter = Router();

function signUserToken(user) {
  const secret = process.env.JWT_SECRET;
  return jwt.sign({ sub: user.id, email: user.email }, secret, { expiresIn: "7d" });
}

registerOAuthRoutes(authRouter);

authRouter.get("/me", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, email FROM users WHERE id = $1`, [req.userId]);
    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    res.json({ user: rows[0] });
  } catch (e) {
    console.error("auth/me:", e);
    res.status(500).json({ error: "Failed to load user" });
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
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at`,
      [email, hash]
    );
    const user = rows[0];
    const token = signUserToken(user);
    res.status(201).json({ user: { id: user.id, email: user.email }, token });
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
      `SELECT id, email, password_hash FROM users WHERE email = $1`,
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
        "This account uses single sign-on. Use Google, GitHub, GitLab, or Microsoft to sign in.",
    });
  }
  if (!(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signUserToken(user);
  res.json({ user: { id: user.id, email: user.email }, token });
});
