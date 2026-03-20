import cron from "node-cron";
import { pool } from "../db.js";

/** Recompute previous calendar month totals for all users (runs 1st of month 03:00 UTC). */
export function startMonthlySummaryJob() {
  cron.schedule("0 3 1 * *", async () => {
    const now = new Date();
    const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prev.getUTCFullYear();
    const month = prev.getUTCMonth() + 1;
    const pad = (m) => String(m).padStart(2, "0");
    const startStr = `${year}-${pad(month)}-01`;
    const last = new Date(Date.UTC(year, month, 0));
    const endStr = `${year}-${pad(month)}-${String(last.getUTCDate()).padStart(2, "0")}`;

    try {
      const { rows: users } = await pool.query(`SELECT id FROM users`);
      for (const u of users) {
        const { rows } = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
           WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3`,
          [u.id, startStr, endStr]
        );
        const total = rows[0]?.total ?? 0;
        await pool.query(
          `INSERT INTO monthly_summaries (user_id, year, month, total)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, year, month) DO UPDATE SET total = EXCLUDED.total, generated_at = NOW()`,
          [u.id, year, month, total]
        );
      }
      console.log(`Monthly summaries generated for ${year}-${pad(month)}`);
    } catch (e) {
      console.error("Monthly summary job failed", e);
    }
  });
}
