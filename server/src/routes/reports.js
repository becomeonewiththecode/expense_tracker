import { Router } from "express";
import PDFDocument from "pdfkit";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { cacheGet, cacheSet } from "../redis.js";
import { loadBudgetPayload, monthRangeStrings } from "./budgets.js";
import { buildRunRateVsIncomeSummary } from "../runRateSummary.js";

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
  const cacheKey = `r:monthly:v2:${req.userId}:${year}-${month}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const { rows } = await pool.query(
    `SELECT spent_at::text AS day, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY spent_at ORDER BY spent_at`,
    [req.userId, startStr, endStr]
  );
  const { rows: byCat } = await pool.query(
    `SELECT category, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY category ORDER BY total DESC`,
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
    byCategory: byCat.map((r) => ({ category: r.category, total: r.total })),
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

/**
 * Annualized run-rate: recurring income vs expenses (excl. synced payment_plan rows), renewals,
 * prescriptions, and payment plans. Detects overspending when recurring income run rate > 0.
 */
reportsRouter.get("/run-rate-vs-income", async (req, res) => {
  const userId = req.userId;
  const [ex, pr, pl, inc] = await Promise.all([
    pool.query(
      `SELECT amount, category, frequency, state FROM expenses WHERE user_id = $1 AND state = 'active'`,
      [userId]
    ),
    pool.query(
      `SELECT amount, renewal_period, state FROM prescriptions WHERE user_id = $1 AND state = 'active'`,
      [userId]
    ),
    pool.query(
      `SELECT amount, payment_schedule, frequency, status FROM payment_plans WHERE user_id = $1 AND LOWER(status) = 'active'`,
      [userId]
    ),
    pool.query(
      `SELECT amount, frequency FROM income_entries WHERE user_id = $1 ORDER BY id DESC LIMIT 500`,
      [userId]
    ),
  ]);

  const summary = buildRunRateVsIncomeSummary({
    expenseRows: ex.rows,
    prescriptionRows: pr.rows,
    paymentPlanRows: pl.rows,
    incomeRows: inc.rows,
  });

  res.json({
    ...summary,
    disclaimer:
      "Estimates use annualized run rates (same idea as the projection from Reports). Renewals are part of expenses. Payment-plan category expenses are excluded here so plans are not double-counted with the Payment Plan list. One-time amounts are not included in the monthly recurring comparison.",
  });
});

/** Logged income vs expenses for a calendar month (actuals, not projections). */
reportsRouter.get("/cashflow/monthly", async (req, res) => {
  const now = new Date();
  const year = Number(req.query.year ?? now.getUTCFullYear());
  const month = Number(req.query.month ?? now.getUTCMonth() + 1);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year/month" });
  }
  const { startStr, endStr, daysInMonth } = monthRangeStrings(year, month);
  const { rows: spendRow } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS t FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3`,
    [req.userId, startStr, endStr]
  );
  const { rows: incRow } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS t FROM income_entries
     WHERE user_id = $1 AND received_at >= $2 AND received_at <= $3`,
    [req.userId, startStr, endStr]
  );
  const spending = spendRow[0]?.t ?? 0;
  const income = incRow[0]?.t ?? 0;
  res.json({
    period: "monthly_cashflow",
    year,
    month,
    start: startStr,
    end: endStr,
    daysInMonth,
    spending,
    income,
    net: income - spending,
  });
});

function csvEscape(cell) {
  if (cell == null) return "";
  const s = String(cell);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Monthly spending + optional budget/variance for spreadsheets or tax prep. */
reportsRouter.get("/export/monthly.csv", async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year/month" });
  }
  const { startStr, endStr, daysInMonth } = monthRangeStrings(year, month);

  const { rows: dayRows } = await pool.query(
    `SELECT spent_at::text AS day, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY spent_at ORDER BY spent_at`,
    [req.userId, startStr, endStr]
  );
  const byDay = new Map(dayRows.map((r) => [r.day, r.total]));

  const budgetPayload = await loadBudgetPayload(req.userId, year, month);
  const budgetTotal = budgetPayload.budget?.totalAmount;

  const lines = [];
  lines.push(csvEscape("Daily spending"));
  lines.push(
    ["date", "daily_total", "cumulative_spending", "linear_budget_pace_to_date"]
      .map(csvEscape)
      .join(",")
  );
  let cumulative = 0;
  const padM = (m) => String(m).padStart(2, "0");
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${padM(month)}-${String(d).padStart(2, "0")}`;
    const dailyTotal = byDay.get(dateStr) ?? 0;
    cumulative += dailyTotal;
    const pace =
      budgetTotal != null && daysInMonth > 0 ? (budgetTotal * d) / daysInMonth : "";
    lines.push(
      [
        csvEscape(dateStr),
        csvEscape(dailyTotal.toFixed(2)),
        csvEscape(cumulative.toFixed(2)),
        pace === "" ? "" : csvEscape(Number(pace).toFixed(2)),
      ].join(",")
    );
  }

  lines.push("");
  lines.push(csvEscape("Month summary"));
  lines.push(["field", "value"].map(csvEscape).join(","));
  lines.push([csvEscape("period_start"), csvEscape(startStr)].join(","));
  lines.push([csvEscape("period_end"), csvEscape(endStr)].join(","));
  lines.push([csvEscape("actual_total"), csvEscape(budgetPayload.actual.total.toFixed(2))].join(","));
  if (budgetPayload.budget) {
    lines.push([csvEscape("budget_total"), csvEscape(budgetPayload.budget.totalAmount.toFixed(2))].join(","));
    lines.push(
      [
        csvEscape("remaining_vs_budget"),
        csvEscape(budgetPayload.variance.total.remaining.toFixed(2)),
      ].join(",")
    );
    lines.push(
      [csvEscape("percent_of_budget_used"), csvEscape(budgetPayload.variance.total.percentUsed.toFixed(2))].join(
        ","
      )
    );
  }

  lines.push("");
  lines.push(csvEscape("By category (actual)"));
  lines.push(["category", "actual"].map(csvEscape).join(","));
  for (const c of budgetPayload.actual.byCategory) {
    lines.push([csvEscape(c.category), csvEscape(Number(c.total).toFixed(2))].join(","));
  }

  if (budgetPayload.variance?.byCategory?.length) {
    lines.push("");
    lines.push(csvEscape("Budget lines vs actual"));
    lines.push(["category", "budgeted", "actual", "variance"].map(csvEscape).join(","));
    for (const row of budgetPayload.variance.byCategory) {
      lines.push(
        [
          csvEscape(row.category),
          csvEscape(Number(row.budgeted).toFixed(2)),
          csvEscape(Number(row.actual).toFixed(2)),
          csvEscape(Number(row.variance).toFixed(2)),
        ].join(",")
      );
    }
  }

  const body = lines.join("\n") + "\n";
  const filename = `spending-${year}-${padM(month)}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(body);
});

/** PDF summary for a month (spending, income, net, budget snapshot). */
reportsRouter.get("/export/monthly.pdf", async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year/month" });
  }
  const { startStr, endStr, daysInMonth } = monthRangeStrings(year, month);
  const padM = (m) => String(m).padStart(2, "0");
  const budgetPayload = await loadBudgetPayload(req.userId, year, month);
  const { rows: incRow } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS t FROM income_entries
     WHERE user_id = $1 AND received_at >= $2 AND received_at <= $3`,
    [req.userId, startStr, endStr]
  );
  const incomeTotal = incRow[0]?.t ?? 0;
  const spending = budgetPayload.actual.total;
  const net = incomeTotal - spending;

  const doc = new PDFDocument({ margin: 56 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report-${year}-${padM(month)}.pdf"`);

  doc.on("error", (err) => {
    console.error("pdf export:", err);
    if (!res.headersSent) res.status(500).json({ error: "PDF failed" });
  });

  doc.pipe(res);
  doc.fontSize(18).text(`Monthly report ${year}-${padM(month)}`, { underline: true });
  doc.moveDown();
  doc.fontSize(10).fillColor("#333333");
  doc.text(`Period: ${startStr} through ${endStr} (${daysInMonth} days)`);
  doc.moveDown();
  doc.fontSize(12).fillColor("#000000");
  doc.text(`Spending (expenses): $${spending.toFixed(2)}`);
  doc.text(`Income (logged): $${incomeTotal.toFixed(2)}`);
  doc.fillColor(net >= 0 ? "#0d6832" : "#a32020").text(`Net: $${net.toFixed(2)}`);
  doc.fillColor("#000000");
  doc.moveDown();
  if (budgetPayload.budget) {
    doc.fontSize(12).text("Budget", { underline: true });
    doc.fontSize(10);
    doc.text(`Budget total: $${budgetPayload.budget.totalAmount.toFixed(2)}`);
    doc.text(`Percent used: ${budgetPayload.variance.total.percentUsed.toFixed(1)}%`);
    doc.text(`Remaining: $${budgetPayload.variance.total.remaining.toFixed(2)}`);
    if (budgetPayload.variance.byCategory?.length) {
      doc.moveDown(0.5);
      doc.text("Category lines:");
      for (const row of budgetPayload.variance.byCategory) {
        doc.text(
          `  ${row.category}: spent $${row.actual.toFixed(2)} / budget $${row.budgeted.toFixed(2)}`
        );
      }
    }
  } else {
    doc.fontSize(10).text("No budget set for this month.");
  }
  doc.moveDown();
  doc.fontSize(9).fillColor("#666666");
  doc.text("Generated from Expense Tracker — amounts reflect logged expenses and income only.");
  doc.end();
});
