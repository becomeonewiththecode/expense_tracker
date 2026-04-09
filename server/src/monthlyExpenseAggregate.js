import { pool } from "./db.js";

/**
 * Monthly expense aggregates (same shape as GET /api/reports/monthly).
 * @param {number} userId
 * @param {number} year
 * @param {number} month 1–12
 */
export async function buildMonthlyExpensePayload(userId, year, month) {
  const pad = (m) => String(m).padStart(2, "0");
  const startStr = `${year}-${pad(month)}-01`;
  const last = new Date(Date.UTC(year, month, 0));
  const endStr = `${year}-${pad(month)}-${String(last.getUTCDate()).padStart(2, "0")}`;

  const { rows } = await pool.query(
    `SELECT spent_at::text AS day, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY spent_at ORDER BY spent_at`,
    [userId, startStr, endStr]
  );
  const { rows: byCat } = await pool.query(
    `SELECT category, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY category ORDER BY total DESC`,
    [userId, startStr, endStr]
  );
  const series = rows.map((r) => ({ label: r.day, total: r.total }));
  const total = series.reduce((s, p) => s + p.total, 0);
  return {
    period: "monthly",
    year,
    month,
    start: startStr,
    end: endStr,
    total,
    series,
    byCategory: byCat.map((r) => ({ category: r.category, total: r.total })),
  };
}
