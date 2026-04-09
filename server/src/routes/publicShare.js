import { Router } from "express";
import { pool } from "../db.js";
import { buildMonthlyExpensePayload } from "../monthlyExpenseAggregate.js";

export const publicShareRouter = Router();

publicShareRouter.get("/share/:token/reports/monthly", async (req, res) => {
  const token = String(req.params.token || "").trim();
  if (!token || token.length > 200) {
    return res.status(400).json({ error: "Invalid token" });
  }
  const { rows } = await pool.query(`SELECT user_id FROM advisor_share_links WHERE token = $1`, [token]);
  const ownerId = rows[0]?.user_id;
  if (!ownerId) {
    return res.status(404).json({ error: "Unknown or revoked link" });
  }

  const now = new Date();
  const year = Number(req.query.year ?? now.getUTCFullYear());
  const month = Number(req.query.month ?? now.getUTCMonth() + 1);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year/month" });
  }

  try {
    const payload = await buildMonthlyExpensePayload(ownerId, year, month);
    res.json({
      ...payload,
      share: { read_only: true },
    });
  } catch (e) {
    console.error("public share monthly:", e);
    res.status(500).json({ error: "Failed to load report" });
  }
});
