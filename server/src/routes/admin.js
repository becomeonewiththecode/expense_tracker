import os from "os";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { pool } from "../db.js";
import { getRedis } from "../redis.js";
import {
  adminRequired,
  createAdminChallenge,
  consumeAdminChallenge,
  generateTotpSecret,
  getAdminChallenge,
  issueAdminSession,
  issueReauthToken,
  requireReauth,
  setChallengeSetupSecret,
  verifyTotpCode,
} from "../adminSecurity.js";
import { ipRateLimit } from "../rateLimit.js";

export const adminRouter = Router();

const adminLoginLimiter = ipRateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: "admin-login" });
const adminVerify2faLimiter = ipRateLimit({ windowMs: 5 * 60 * 1000, max: 15, name: "admin-verify-2fa" });
const adminSetup2faVerifyLimiter = ipRateLimit({ windowMs: 5 * 60 * 1000, max: 15, name: "admin-setup-2fa-verify" });

function safeInt(v) {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

adminRouter.post("/auth/login", adminLoginLimiter, async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
  try {
    const { rows } = await pool.query(
      `SELECT id, username, password_hash, totp_secret, must_change_password, is_active FROM admins WHERE username = $1`,
      [username]
    );
    const admin = rows[0];
    if (!admin?.is_active) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const challengeId = createAdminChallenge(admin.id);
    const needs2faSetup = !String(admin.totp_secret || "").trim();
    let setup = null;
    if (needs2faSetup) {
      const setupSecret = generateTotpSecret();
      setChallengeSetupSecret(challengeId, setupSecret);
      const issuer = encodeURIComponent("Expense Tracker");
      const account = encodeURIComponent(admin.username);
      setup = {
        manualKey: setupSecret,
        otpauthUrl: `otpauth://totp/${issuer}:${account}?secret=${setupSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
      };
    }
    res.json({
      challengeId,
      requires2fa: !needs2faSetup,
      needs2faSetup,
      setup,
      mustChangePassword: Boolean(admin.must_change_password),
    });
  } catch (e) {
    console.error("admin/auth/login:", e);
    res.status(500).json({ error: "Admin login failed" });
  }
});

adminRouter.post("/auth/verify-2fa", adminVerify2faLimiter, async (req, res) => {
  const challengeId = String(req.body?.challengeId || "");
  const code = String(req.body?.code || "");
  if (!challengeId || !code) return res.status(400).json({ error: "challengeId and code are required" });
  const challenge = getAdminChallenge(challengeId);
  if (!challenge) return res.status(401).json({ error: "2FA challenge expired" });
  try {
    const { rows } = await pool.query(
      `SELECT id, username, totp_secret, must_change_password FROM admins WHERE id = $1 AND is_active = TRUE`,
      [challenge.adminId]
    );
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "Invalid challenge" });
    if (!verifyTotpCode(admin.totp_secret, code)) return res.status(401).json({ error: "Invalid 2FA code" });
    consumeAdminChallenge(challengeId);
    const token = issueAdminSession(admin);
    res.json({ token, mustChangePassword: Boolean(admin.must_change_password) });
  } catch (e) {
    console.error("admin/auth/verify-2fa:", e);
    res.status(500).json({ error: "Could not verify 2FA" });
  }
});

adminRouter.post("/auth/setup-2fa/verify", adminSetup2faVerifyLimiter, async (req, res) => {
  const challengeId = String(req.body?.challengeId || "");
  const code = String(req.body?.code || "");
  if (!challengeId || !code) return res.status(400).json({ error: "challengeId and code are required" });
  const challenge = getAdminChallenge(challengeId);
  if (!challenge) return res.status(401).json({ error: "2FA setup challenge expired" });
  if (!challenge.setupSecret) return res.status(400).json({ error: "No pending 2FA setup for this challenge" });
  if (!verifyTotpCode(challenge.setupSecret, code)) {
    return res.status(401).json({ error: "Invalid 2FA code for setup" });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE admins SET totp_secret = $1, updated_at = NOW()
       WHERE id = $2 AND is_active = TRUE
       RETURNING id, username, must_change_password`,
      [challenge.setupSecret, challenge.adminId]
    );
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "Admin not found" });
    consumeAdminChallenge(challengeId);
    const token = issueAdminSession(admin);
    res.json({ token, mustChangePassword: Boolean(admin.must_change_password) });
  } catch (e) {
    console.error("admin/auth/setup-2fa/verify:", e);
    res.status(500).json({ error: "Could not complete 2FA setup" });
  }
});

adminRouter.post("/auth/change-password", adminRequired, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (newPassword.length < 12) {
    return res.status(400).json({ error: "New password must be at least 12 characters" });
  }
  try {
    const { rows } = await pool.query(`SELECT password_hash FROM admins WHERE id = $1`, [req.adminId]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(currentPassword, admin.password_hash))) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const nextHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE admins SET password_hash = $1, must_change_password = FALSE, updated_at = NOW() WHERE id = $2`,
      [nextHash, req.adminId]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("admin/auth/change-password:", e);
    res.status(500).json({ error: "Failed to change admin password" });
  }
});

adminRouter.post("/auth/reauth", adminRequired, async (req, res) => {
  const password = String(req.body?.password || "");
  const code = String(req.body?.code || "");
  if (!password || !code) return res.status(400).json({ error: "Password and 2FA code are required" });
  try {
    const { rows } = await pool.query(`SELECT password_hash, totp_secret FROM admins WHERE id = $1`, [req.adminId]);
    const admin = rows[0];
    if (!admin) return res.status(401).json({ error: "Admin not found" });
    const passOk = await bcrypt.compare(password, admin.password_hash);
    const otpOk = verifyTotpCode(admin.totp_secret, code);
    if (!passOk || !otpOk) return res.status(401).json({ error: "Re-authentication failed" });
    res.json({ reauthToken: issueReauthToken(req.adminId), expiresInSec: 120 });
  } catch (e) {
    console.error("admin/auth/reauth:", e);
    res.status(500).json({ error: "Failed to re-authenticate" });
  }
});

adminRouter.get("/health", adminRequired, async (_req, res) => {
  const started = Date.now();
  const checkedAt = new Date().toISOString();

  let web = { ok: false, latencyMs: null, status: null, error: null, url: null };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const url = process.env.ADMIN_WEB_HEALTH_URL?.trim()
      ? process.env.ADMIN_WEB_HEALTH_URL.trim()
      : process.env.NODE_ENV === "production"
        ? "http://web/"
        : (process.env.CLIENT_ORIGIN?.trim() ? process.env.CLIENT_ORIGIN.trim() : null);
    if (!url) {
      web = { ok: false, latencyMs: null, status: null, error: "No ADMIN_WEB_HEALTH_URL or CLIENT_ORIGIN configured", url: null };
    } else {
      const t0 = Date.now();
      const resp = await fetch(url, { signal: controller.signal, redirect: "follow" });
      const latencyMs = Date.now() - t0;
      const status = resp.status;
      let ok = resp.ok;
      if (ok) {
        const ct = String(resp.headers.get("content-type") || "");
        ok = ct.includes("text/html") || ct.includes("text/plain") || ct.includes("application/octet-stream") || ct === "";
      }
      web = { ok, latencyMs, status, error: ok ? null : `Unexpected response (status ${status})`, url };
    }
    clearTimeout(timeout);
  } catch (e) {
    web = { ok: false, latencyMs: null, status: null, error: String(e?.name === "AbortError" ? "Timed out" : (e?.message || e)), url: web.url };
  }

  let databaseConnectivity = { ok: false, latencyMs: null, error: null };
  try {
    const t0 = Date.now();
    await pool.query("SELECT 1 AS ping");
    databaseConnectivity = { ok: true, latencyMs: Date.now() - t0, error: null };
  } catch (e) {
    databaseConnectivity = { ok: false, latencyMs: null, error: String(e?.message || e) };
  }

  let databaseHealth = { ok: false, error: null, userCount: null, expenseCount: null };
  if (databaseConnectivity.ok) {
    try {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users) AS user_count,
          (SELECT COUNT(*)::int FROM expenses) AS expense_count
      `);
      databaseHealth = {
        ok: true,
        error: null,
        userCount: rows[0]?.user_count ?? 0,
        expenseCount: rows[0]?.expense_count ?? 0,
      };
    } catch (e) {
      databaseHealth = { ok: false, error: String(e?.message || e), userCount: null, expenseCount: null };
    }
  } else {
    databaseHealth = { ok: false, error: "Database not reachable", userCount: null, expenseCount: null };
  }

  let disk = { ok: false, totalBytes: null, usedBytes: null, freeBytes: null, usedPct: null, error: null };
  try {
    const fsInfo = await import("fs/promises").then((m) => m.statfs(process.cwd()));
    const total = Number(fsInfo.blocks) * Number(fsInfo.bsize);
    const free = Number(fsInfo.bavail) * Number(fsInfo.bsize);
    const used = total - free;
    disk = {
      ok: true,
      totalBytes: total,
      usedBytes: used,
      freeBytes: free,
      usedPct: total > 0 ? Number(((used / total) * 100).toFixed(2)) : null,
      error: null,
    };
  } catch (e) {
    disk = { ok: false, totalBytes: null, usedBytes: null, freeBytes: null, usedPct: null, error: String(e?.message || e) };
  }

  const mem = process.memoryUsage();
  let redis = { configured: Boolean(process.env.REDIS_URL?.trim()), ok: null, error: null };
  if (redis.configured) {
    const r = getRedis();
    if (!r) {
      redis = { ...redis, ok: false, error: "Redis client unavailable" };
    } else {
      try {
        if (r.status === "wait") await r.connect().catch(() => {});
        await r.ping();
        redis = { ...redis, ok: true, error: null };
      } catch (e) {
        redis = { ...redis, ok: false, error: String(e?.message || e) };
      }
    }
  }

  const applicationOk = disk.ok && (!redis.configured || redis.ok === true);

  res.json({
    checkedAt,
    api: { ok: true, message: "Admin API is responding" },
    web,
    databaseConnectivity,
    databaseHealth,
    application: {
      ok: applicationOk,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      disk,
      redis,
    },
    responseMs: Date.now() - started,
    errorLogs: [
      { level: "info", message: "No centralized log store in-app; use container logs for detailed errors." },
    ],
  });
});

adminRouter.get("/backup/user/:userId", adminRequired, async (req, res) => {
  const userId = safeInt(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });
  try {
    const [
      { rows: userRows },
      { rows: expenses },
      { rows: prescriptions },
      { rows: paymentPlans },
      { rows: incomeEntries },
    ] = await Promise.all([
      pool.query(`SELECT id, email, role FROM users WHERE id = $1`, [userId]),
      pool.query(`SELECT * FROM expenses WHERE user_id = $1 ORDER BY id ASC`, [userId]),
      pool.query(`SELECT * FROM prescriptions WHERE user_id = $1 ORDER BY id ASC`, [userId]),
      pool.query(`SELECT * FROM payment_plans WHERE user_id = $1 ORDER BY id ASC`, [userId]),
      pool.query(`SELECT * FROM income_entries WHERE user_id = $1 ORDER BY id ASC`, [userId]),
    ]);
    if (!userRows[0]) return res.status(404).json({ error: "User not found" });
    res.json({
      format: "expense-tracker-admin-user-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      user: userRows[0],
      counts: {
        expenses: expenses.length,
        prescriptions: prescriptions.length,
        paymentPlans: paymentPlans.length,
        incomeEntries: incomeEntries.length,
      },
      expenses,
      prescriptions,
      paymentPlans,
      incomeEntries,
    });
  } catch (e) {
    console.error("admin/backup/user:", e);
    res.status(500).json({ error: "Failed to backup user data" });
  }
});

adminRouter.get("/backup/database", adminRequired, requireReauth, async (_req, res) => {
  try {
    const [users, expenses, prescriptions, paymentPlans, incomeEntries] = await Promise.all([
      pool.query(`SELECT id, email, role, created_at FROM users ORDER BY id ASC`),
      pool.query(`SELECT * FROM expenses ORDER BY id ASC`),
      pool.query(`SELECT * FROM prescriptions ORDER BY id ASC`),
      pool.query(`SELECT * FROM payment_plans ORDER BY id ASC`),
      pool.query(`SELECT * FROM income_entries ORDER BY id ASC`),
    ]);
    res.json({
      format: "expense-tracker-admin-db-backup",
      version: 2,
      exportedAt: new Date().toISOString(),
      users: users.rows,
      expenses: expenses.rows,
      prescriptions: prescriptions.rows,
      paymentPlans: paymentPlans.rows,
      incomeEntries: incomeEntries.rows,
    });
  } catch (e) {
    console.error("admin/backup/database:", e);
    res.status(500).json({ error: "Failed to backup database" });
  }
});

adminRouter.post("/restore/preview", adminRequired, async (req, res) => {
  const payload = req.body || {};
  const format = String(payload.format || "");
  if (!format.startsWith("expense-tracker-admin")) {
    return res.status(400).json({ error: "Unsupported backup format" });
  }
  const fileVer = Number(payload.version);
  const users = Array.isArray(payload.users) ? payload.users : [];
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  const prescriptions = Array.isArray(payload.prescriptions) ? payload.prescriptions : [];
  const paymentPlans = Array.isArray(payload.paymentPlans) ? payload.paymentPlans : [];
  const incomeEntries =
    Number.isFinite(fileVer) && fileVer >= 2 && Array.isArray(payload.incomeEntries) ? payload.incomeEntries : [];
  const userIds = new Set(users.map((u) => Number(u?.id)).filter((n) => Number.isInteger(n) && n > 0));
  const refErrors = [];
  for (const row of expenses) {
    if (!userIds.has(Number(row.user_id))) refErrors.push(`Expense ${row.id ?? "?"} has unknown user_id`);
  }
  for (const row of prescriptions) {
    if (!userIds.has(Number(row.user_id))) refErrors.push(`Prescription ${row.id ?? "?"} has unknown user_id`);
  }
  for (const row of paymentPlans) {
    if (!userIds.has(Number(row.user_id))) refErrors.push(`Payment plan ${row.id ?? "?"} has unknown user_id`);
  }
  for (const row of incomeEntries) {
    if (!userIds.has(Number(row.user_id))) refErrors.push(`Income entry ${row.id ?? "?"} has unknown user_id`);
  }
  const affectedUserIds = [
    ...new Set(
      [...expenses, ...prescriptions, ...paymentPlans, ...incomeEntries]
        .map((r) => Number(r.user_id))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
  res.json({
    ok: refErrors.length === 0,
    backupVersion: payload.version ?? null,
    counts: {
      users: users.length,
      expenses: expenses.length,
      prescriptions: prescriptions.length,
      paymentPlans: paymentPlans.length,
      incomeEntries: incomeEntries.length,
    },
    affectedUserIds,
    integrityErrors: refErrors,
  });
});

adminRouter.post("/restore/database", adminRequired, requireReauth, async (req, res) => {
  const payload = req.body || {};
  const mode = String(req.body?.mode || "replace").toLowerCase();
  if (mode !== "replace") return res.status(400).json({ error: 'mode must be "replace"' });
  if (String(payload.format || "") !== "expense-tracker-admin-db-backup") {
    return res.status(400).json({ error: "Unsupported backup format" });
  }
  const dbFileVer = Number(payload.version);
  const users = Array.isArray(payload.users) ? payload.users : [];
  const expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  const prescriptions = Array.isArray(payload.prescriptions) ? payload.prescriptions : [];
  const paymentPlans = Array.isArray(payload.paymentPlans) ? payload.paymentPlans : [];
  const incomeEntries =
    Number.isFinite(dbFileVer) && dbFileVer >= 2 && Array.isArray(payload.incomeEntries) ? payload.incomeEntries : [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM payment_plans`);
    await client.query(`DELETE FROM prescriptions`);
    await client.query(`DELETE FROM expenses`);
    await client.query(`DELETE FROM income_entries`);
    await client.query(`DELETE FROM users`);
    for (const u of users) {
      await client.query(`INSERT INTO users (id, email, role, created_at) VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))`, [
        Number(u.id),
        String(u.email || "").trim().toLowerCase(),
        ["user", "manager", "admin"].includes(String(u.role)) ? String(u.role) : "user",
        u.created_at ?? null,
      ]);
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), TRUE)`);
    for (const e of expenses) {
      await client.query(
        `INSERT INTO expenses (id, user_id, amount, category, financial_institution, bank_name, frequency, state, payment_day, payment_day_2, payment_month, description, website, renewal_kind, spent_at, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,COALESCE($16::timestamptz,NOW()))`,
        [e.id, e.user_id, e.amount, e.category, e.financial_institution, e.bank_name ?? null, e.frequency, e.state, e.payment_day, e.payment_day_2, e.payment_month, e.description ?? "", e.website ?? null, e.renewal_kind ?? null, e.spent_at, e.created_at ?? null]
      );
    }
    for (const p of prescriptions) {
      await client.query(
        `INSERT INTO prescriptions (id, user_id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11::timestamptz,NOW()))`,
        [p.id, p.user_id, p.name, p.amount, p.renewal_period, p.next_renewal_date, p.vendor ?? "", p.notes ?? "", p.category, p.state, p.created_at ?? null]
      );
    }
    for (const p of paymentPlans) {
      await client.query(
        `INSERT INTO payment_plans (id, user_id, source_expense_id, name, amount, category, payment_schedule, priority_level, status, account_type, payment_method, institution, tag, frequency, remaining_payments, notes, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,COALESCE($17::timestamptz,NOW()))`,
        [
          p.id,
          p.user_id,
          p.source_expense_id ?? null,
          p.name,
          p.amount,
          p.category,
          p.payment_schedule,
          p.priority_level,
          p.status,
          p.account_type,
          p.payment_method,
          p.institution,
          p.tag,
          p.frequency,
          p.remaining_payments != null ? Number(p.remaining_payments) : null,
          p.notes ?? "",
          p.created_at ?? null,
        ]
      );
    }
    for (const row of incomeEntries) {
      await client.query(
        `INSERT INTO income_entries (id, user_id, amount, frequency, description, received_at, payment_day, payment_day_2, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::timestamptz,NOW()))`,
        [
          row.id,
          row.user_id,
          row.amount,
          row.frequency,
          row.description ?? "",
          row.received_at,
          row.payment_day ?? null,
          row.payment_day_2 ?? null,
          row.created_at ?? null,
        ]
      );
    }
    await client.query(`SELECT setval(pg_get_serial_sequence('expenses', 'id'), COALESCE((SELECT MAX(id) FROM expenses), 1), TRUE)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('prescriptions', 'id'), COALESCE((SELECT MAX(id) FROM prescriptions), 1), TRUE)`);
    await client.query(`SELECT setval(pg_get_serial_sequence('payment_plans', 'id'), COALESCE((SELECT MAX(id) FROM payment_plans), 1), TRUE)`);
    await client.query(
      `SELECT setval(pg_get_serial_sequence('income_entries', 'id'), COALESCE((SELECT MAX(id) FROM income_entries), 1), TRUE)`
    );

    const affectedUserIds = [
      ...new Set(
        [...expenses, ...prescriptions, ...paymentPlans, ...incomeEntries]
          .map((r) => Number(r.user_id))
          .filter((n) => Number.isInteger(n) && n > 0)
      ),
    ];
    for (const userId of affectedUserIds) {
      await client.query(
        `INSERT INTO admin_user_notifications (admin_id, user_id, event_type, payload) VALUES ($1, $2, $3, $4::jsonb)`,
        [req.adminId, userId, "restore", JSON.stringify({ hostname: os.hostname(), restoredAt: new Date().toISOString() })]
      );
    }
    await client.query("COMMIT");
    res.json({
      ok: true,
      restored: {
        users: users.length,
        expenses: expenses.length,
        prescriptions: prescriptions.length,
        paymentPlans: paymentPlans.length,
        incomeEntries: incomeEntries.length,
      },
      affectedUsersNotified: affectedUserIds.length,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("admin/restore/database:", e);
    res.status(500).json({ error: "Database restore failed" });
  } finally {
    client.release();
  }
});

adminRouter.get("/users", adminRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, email, role, created_at FROM users ORDER BY id ASC`);
    res.json({ users: rows });
  } catch (e) {
    console.error("admin/users:", e);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

adminRouter.post("/users/:userId/reset-password", adminRequired, requireReauth, async (req, res) => {
  const userId = safeInt(req.params.userId);
  const nextPassword = String(req.body?.newPassword || "");
  if (!userId || nextPassword.length < 8) {
    return res.status(400).json({ error: "userId and a newPassword (8+ chars) are required" });
  }
  try {
    const hash = await bcrypt.hash(nextPassword, 10);
    const { rowCount } = await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, userId]);
    if (!rowCount) return res.status(404).json({ error: "User not found" });
    await pool.query(
      `INSERT INTO admin_user_notifications (admin_id, user_id, event_type, payload) VALUES ($1, $2, $3, $4::jsonb)`,
      [req.adminId, userId, "password_reset", JSON.stringify({ at: new Date().toISOString() })]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("admin/users/reset-password:", e);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

adminRouter.patch("/users/:userId/permissions", adminRequired, requireReauth, async (req, res) => {
  const userId = safeInt(req.params.userId);
  const role = String(req.body?.role || "");
  if (!userId || !["user", "manager", "admin"].includes(role)) {
    return res.status(400).json({ error: "Invalid userId or role" });
  }
  try {
    const { rowCount } = await pool.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, userId]);
    if (!rowCount) return res.status(404).json({ error: "User not found" });
    await pool.query(
      `INSERT INTO admin_user_notifications (admin_id, user_id, event_type, payload) VALUES ($1, $2, $3, $4::jsonb)`,
      [req.adminId, userId, "permission_change", JSON.stringify({ role, at: new Date().toISOString() })]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("admin/users/permissions:", e);
    res.status(500).json({ error: "Failed to update user permissions" });
  }
});
