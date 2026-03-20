import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { cacheGet, cacheSet } from "../redis.js";

export const reportsRouter = Router();
reportsRouter.use(authRequired);

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function startOfWeekMonday(d) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = x.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

reportsRouter.get("/daily", async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date" });
  }
  const cacheKey = `r:daily:${req.userId}:${date}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at = $2`,
    [req.userId, date]
  );
  const { rows: byCat } = await pool.query(
    `SELECT category, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at = $2 GROUP BY category ORDER BY total DESC`,
    [req.userId, date]
  );
  const total = rows[0]?.total ?? 0;
  const payload = {
    period: "daily",
    date,
    total,
    byCategory: byCat.map((r) => ({ category: r.category, total: r.total })),
    series: [{ label: date, total }],
  };
  await cacheSet(cacheKey, payload, 120);
  res.json(payload);
});

reportsRouter.get("/weekly", async (req, res) => {
  let start;
  if (req.query.weekStart) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.weekStart)) {
      return res.status(400).json({ error: "Invalid weekStart" });
    }
    start = new Date(req.query.weekStart + "T00:00:00.000Z");
  } else {
    start = startOfWeekMonday(new Date());
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const startStr = dayKey(start);
  const endStr = dayKey(end);
  const cacheKey = `r:weekly:${req.userId}:${startStr}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await pool.query(
    `SELECT spent_at::text AS day, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY spent_at ORDER BY spent_at`,
    [req.userId, startStr, endStr]
  );
  const byDay = new Map(rows.map((r) => [r.day, r.total]));
  const series = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const key = dayKey(d);
    series.push({ label: key, total: byDay.get(key) ?? 0 });
  }
  const total = series.reduce((s, p) => s + p.total, 0);
  const payload = { period: "weekly", weekStart: startStr, weekEnd: endStr, total, series };
  await cacheSet(cacheKey, payload, 120);
  res.json(payload);
});

reportsRouter.get("/monthly", async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year ?? now.getUTCFullYear());
  const month = Number(req.query.month ?? now.getUTCMonth() + 1);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year/month" });
  }
  const pad = (m) => String(m).padStart(2, "0");
  const startStr = `${year}-${pad(month)}-01`;
  const last = new Date(Date.UTC(year, month, 0));
  const endStr = `${year}-${pad(month)}-${String(last.getUTCDate()).padStart(2, "0")}`;
  const cacheKey = `r:monthly:${req.userId}:${year}-${month}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await pool.query(
    `SELECT spent_at::text AS day, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY spent_at ORDER BY spent_at`,
    [req.userId, startStr, endStr]
  );
  const series = rows.map((r) => ({ label: r.day, total: r.total }));
  const total = series.reduce((s, p) => s + p.total, 0);
  const payload = {
    period: "monthly",
    year,
    month,
    start: startStr,
    end: endStr,
    total,
    series,
  };
  await cacheSet(cacheKey, payload, 120);
  res.json(payload);
});

reportsRouter.get("/yearly", async (req, res) => {
  const year = Number(req.query.year ?? new Date().getUTCFullYear());
  if (!Number.isFinite(year)) return res.status(400).json({ error: "Invalid year" });
  const startStr = `${year}-01-01`;
  const endStr = `${year}-12-31`;
  const cacheKey = `r:yearly:${req.userId}:${year}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await pool.query(
    `SELECT EXTRACT(MONTH FROM spent_at)::int AS m, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY EXTRACT(MONTH FROM spent_at) ORDER BY m`,
    [req.userId, startStr, endStr]
  );
  const byMonth = new Map(rows.map((r) => [r.m, r.total]));
  const series = [];
  for (let m = 1; m <= 12; m++) {
    series.push({ label: `${year}-${String(m).padStart(2, "0")}`, total: byMonth.get(m) ?? 0 });
  }
  const total = series.reduce((s, p) => s + p.total, 0);
  const payload = { period: "yearly", year, total, series };
  await cacheSet(cacheKey, payload, 120);
  res.json(payload);
});

reportsRouter.get("/range", async (req, res) => {
  const start = String(req.query.start || "");
  const end = String(req.query.end || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return res.status(400).json({ error: "start and end required as YYYY-MM-DD" });
  }
  if (start > end) return res.status(400).json({ error: "start must be <= end" });
  const cacheKey = `r:range:${req.userId}:${start}:${end}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await pool.query(
    `SELECT spent_at::text AS day, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY spent_at ORDER BY spent_at`,
    [req.userId, start, end]
  );
  const series = rows.map((r) => ({ label: r.day, total: r.total }));
  const total = series.reduce((s, p) => s + p.total, 0);
  const payload = { period: "custom", start, end, total, series };
  await cacheSet(cacheKey, payload, 120);
  res.json(payload);
});

reportsRouter.get("/summaries", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT year, month, total::float AS total, generated_at FROM monthly_summaries
     WHERE user_id = $1 ORDER BY year DESC, month DESC LIMIT 36`,
    [req.userId]
  );
  res.json(rows);
});
