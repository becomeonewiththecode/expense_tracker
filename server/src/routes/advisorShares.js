import crypto from "crypto";
import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";

export const advisorSharesRouter = Router();
advisorSharesRouter.use(authRequired);

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

advisorSharesRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, label, created_at FROM advisor_share_links WHERE user_id = $1 ORDER BY id DESC`,
    [req.userId]
  );
  res.json(rows);
});

advisorSharesRouter.post("/", async (req, res) => {
  const label = String(req.body?.label || "").slice(0, 200);
  const token = randomToken();
  const { rows } = await pool.query(
    `INSERT INTO advisor_share_links (user_id, token, label) VALUES ($1, $2, $3)
     RETURNING id, label, created_at`,
    [req.userId, token, label]
  );
  const row = rows[0];
  res.status(201).json({
    id: row.id,
    label: row.label,
    created_at: row.created_at,
    token,
    share_path: `/share/${token}`,
  });
});

advisorSharesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const del = await pool.query(`DELETE FROM advisor_share_links WHERE id = $1 AND user_id = $2`, [id, req.userId]);
  if (!del.rowCount) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});
