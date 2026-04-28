import crypto from "crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { sendEmail } from "../email.js";
import { advisorShareLinkEmail } from "../emailTemplates.js";

export const advisorSharesRouter = Router();
advisorSharesRouter.use(authRequired);

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

advisorSharesRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, label, advisor_email, created_at FROM advisor_share_links WHERE user_id = $1 ORDER BY id DESC`,
    [req.userId]
  );
  res.json(rows);
});

advisorSharesRouter.post("/", async (req, res) => {
  const label = String(req.body?.label || "").slice(0, 200);
  const rawEmail = String(req.body?.advisor_email || "").trim().toLowerCase();
  const advisorEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;

  const token = randomToken();
  const { rows } = await pool.query(
    `INSERT INTO advisor_share_links (user_id, token, label, advisor_email) VALUES ($1, $2, $3, $4)
     RETURNING id, label, advisor_email, created_at`,
    [req.userId, token, label, advisorEmail]
  );
  const row = rows[0];

  const sharePath = `/share/${token}`;
  const origin = req.headers.origin || `${req.protocol}://${req.get("host")}`;
  const shareUrl = `${origin}${sharePath}`;

  if (advisorEmail) {
    const { rows: userRows } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.userId]);
    const ownerEmail = userRows[0]?.email || "Someone";
    const tpl = advisorShareLinkEmail({ advisorEmail, ownerEmail, shareUrl, label });
    sendEmail({ to: advisorEmail, ...tpl });
  }

  res.status(201).json({
    id: row.id,
    label: row.label,
    advisor_email: row.advisor_email,
    created_at: row.created_at,
    token,
    share_path: sharePath,
  });
});

advisorSharesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const del = await pool.query(`DELETE FROM advisor_share_links WHERE id = $1 AND user_id = $2`, [id, req.userId]);
  if (!del.rowCount) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});
