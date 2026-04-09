import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { loadBudgetPayload, syncBudgetThresholdNotifications } from "./budgets.js";

export const notificationsRouter = Router();
notificationsRouter.use(authRequired);

/** Refresh threshold notifications for the current UTC month, then list recent items. */
notificationsRouter.get("/", async (req, res) => {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  try {
    const payload = await loadBudgetPayload(req.userId, y, m);
    await syncBudgetThresholdNotifications(req.userId, payload);
  } catch (e) {
    console.error("notifications sync:", e);
  }

  const { rows } = await pool.query(
    `SELECT id, kind, title, body, read_at, created_at FROM user_notifications
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.userId]
  );
  res.json(rows);
});

notificationsRouter.patch("/:id/read", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  const { rows } = await pool.query(
    `UPDATE user_notifications SET read_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, kind, title, body, read_at, created_at`,
    [id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

notificationsRouter.post("/read-all", async (req, res) => {
  await pool.query(`UPDATE user_notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [
    req.userId,
  ]);
  res.json({ ok: true });
});
