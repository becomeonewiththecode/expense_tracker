import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { parseCategory } from "../expenseEnums.js";

export const budgetsRouter = Router();
budgetsRouter.use(authRequired);

function padMonth(m) {
  return String(m).padStart(2, "0");
}

export function monthRangeStrings(year, month) {
  const startStr = `${year}-${padMonth(month)}-01`;
  const last = new Date(Date.UTC(year, month, 0));
  const endStr = `${year}-${padMonth(month)}-${String(last.getUTCDate()).padStart(2, "0")}`;
  return { startStr, endStr, daysInMonth: last.getUTCDate() };
}

/** @param {unknown} raw */
function parseAlertThresholdPercent(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 100) return undefined;
  return n;
}

async function fetchActuals(userId, startStr, endStr) {
  const { rows: sumRow } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3`,
    [userId, startStr, endStr]
  );
  const { rows: byCat } = await pool.query(
    `SELECT category, SUM(amount)::float AS total FROM expenses
     WHERE user_id = $1 AND spent_at >= $2 AND spent_at <= $3
     GROUP BY category ORDER BY total DESC`,
    [userId, startStr, endStr]
  );
  return {
    total: sumRow[0]?.total ?? 0,
    byCategory: byCat.map((r) => ({ category: r.category, total: r.total })),
  };
}

function buildInsights(totalBudget, actualTotal, lineVariance) {
  const insights = [];
  if (totalBudget <= 0) return insights;
  const pct = (actualTotal / totalBudget) * 100;
  if (pct >= 100) {
    insights.push("You have reached or exceeded your monthly budget total.");
  } else if (pct >= 90) {
    insights.push("You are within 10% of your monthly budget cap.");
  }
  for (const row of lineVariance) {
    if (row.budgeted == null) continue;
    if (row.actual > row.budgeted * 1.1 && row.budgeted > 0) {
      insights.push(
        `Spending in "${row.category}" is more than 10% above the amount you allocated for this month.`
      );
    }
  }
  return insights;
}

/**
 * Create or refresh in-app notifications when spending crosses user-defined thresholds.
 * @param {number} userId
 * @param {Awaited<ReturnType<typeof loadBudgetPayload>>} payload
 */
export async function syncBudgetThresholdNotifications(userId, payload) {
  if (!payload.budget || !payload.variance) return;

  const { year, month, budget, variance } = payload;
  const totalTh = budget.totalAlertThresholdPercent;
  if (totalTh != null && variance.total.budgeted > 0) {
    const pct = (variance.total.actual / variance.total.budgeted) * 100;
    if (pct >= totalTh) {
      const dedupe = `budget_total:${year}:${month}`;
      const title = "Monthly budget threshold";
      const body = `You have used ${pct.toFixed(1)}% of your ${year}-${padMonth(month)} budget ($${variance.total.actual.toFixed(2)} of $${variance.total.budgeted.toFixed(2)}). Alert at ${totalTh}%.`;
      await pool.query(
        `INSERT INTO user_notifications (user_id, kind, title, body, dedupe_key)
         VALUES ($1, 'budget_total_threshold', $2, $3, $4)
         ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
           title = EXCLUDED.title,
           body = EXCLUDED.body`,
        [userId, title, body, dedupe]
      );
    }
  }

  for (const line of budget.lines) {
    const th = line.alertThresholdPercent;
    if (th == null || line.amount <= 0) continue;
    const vr = variance.byCategory.find((c) => c.category === line.category);
    const act = vr?.actual ?? 0;
    const pct = (act / line.amount) * 100;
    if (pct >= th) {
      const dedupe = `budget_line:${year}:${month}:${line.category}`;
      const title = `Category budget: ${line.category}`;
      const body = `${line.category} is at ${pct.toFixed(1)}% of its line ($${act.toFixed(2)} of $${line.amount.toFixed(2)}). Threshold ${th}%.`;
      await pool.query(
        `INSERT INTO user_notifications (user_id, kind, title, body, dedupe_key)
         VALUES ($1, 'budget_category_threshold', $2, $3, $4)
         ON CONFLICT (user_id, dedupe_key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body`,
        [userId, title, body, dedupe]
      );
    }
  }
}

/** @param {number} userId */
export async function loadBudgetPayload(userId, year, month) {
  const { startStr, endStr, daysInMonth } = monthRangeStrings(year, month);
  const actual = await fetchActuals(userId, startStr, endStr);

  const { rows: periodRows } = await pool.query(
    `SELECT id, total_amount::float AS total_amount, total_alert_threshold_percent
     FROM budget_periods
     WHERE user_id = $1 AND year = $2 AND month = $3`,
    [userId, year, month]
  );
  const period = periodRows[0];
  let budget = null;
  let variance = null;
  let insights = [];

  if (period) {
    const { rows: lineRows } = await pool.query(
      `SELECT category, amount::float AS amount, alert_threshold_percent
       FROM budget_lines WHERE budget_period_id = $1 ORDER BY category`,
      [period.id]
    );
    const lines = lineRows.map((r) => ({
      category: r.category,
      amount: r.amount,
      alertThresholdPercent: r.alert_threshold_percent,
    }));
    const totalAlertThresholdPercent =
      period.total_alert_threshold_percent != null
        ? Number(period.total_alert_threshold_percent)
        : null;
    budget = {
      totalAmount: period.total_amount,
      totalAlertThresholdPercent,
      lines,
    };

    const byCatActual = new Map(actual.byCategory.map((c) => [c.category, c.total]));
    const lineVariance = lines.map((l) => {
      const act = byCatActual.get(l.category) ?? 0;
      return {
        category: l.category,
        budgeted: l.amount,
        actual: act,
        variance: act - l.amount,
        variancePercent: l.amount > 0 ? ((act - l.amount) / l.amount) * 100 : null,
        alertThresholdPercent: l.alertThresholdPercent,
      };
    });

    const b = period.total_amount;
    const pctUsed = b > 0 ? (actual.total / b) * 100 : 0;
    let status = "under";
    if (actual.total > b) status = "over";
    else if (b > 0 && Math.abs(actual.total - b) < 0.005) status = "at";

    variance = {
      total: {
        budgeted: b,
        actual: actual.total,
        remaining: b - actual.total,
        percentUsed: pctUsed,
        status,
      },
      byCategory: lineVariance,
    };

    insights = buildInsights(b, actual.total, lineVariance);
  }

  return {
    year,
    month,
    start: startStr,
    end: endStr,
    daysInMonth,
    budget,
    actual,
    variance,
    insights,
  };
}

budgetsRouter.get("/:year/:month", async (req, res) => {
  const year = Number.parseInt(req.params.year, 10);
  const month = Number.parseInt(req.params.month, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year or month" });
  }
  const payload = await loadBudgetPayload(req.userId, year, month);
  await syncBudgetThresholdNotifications(req.userId, payload);
  res.json(payload);
});

budgetsRouter.put("/:year/:month", async (req, res) => {
  const year = Number.parseInt(req.params.year, 10);
  const month = Number.parseInt(req.params.month, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year or month" });
  }

  const rawTotal = req.body?.totalAmount;
  const totalAmount = typeof rawTotal === "number" ? rawTotal : Number(rawTotal);
  if (!Number.isFinite(totalAmount) || totalAmount < 0) {
    return res.status(400).json({ error: "totalAmount must be a non-negative number" });
  }

  const totalAlertRaw = parseAlertThresholdPercent(req.body?.totalAlertThresholdPercent);
  if (totalAlertRaw === undefined) {
    return res.status(400).json({
      error: "totalAlertThresholdPercent must be empty or an integer from 1 to 100",
    });
  }

  const rawLines = req.body?.lines;
  const linesIn = Array.isArray(rawLines) ? rawLines : [];
  const parsedLines = [];
  const seen = new Set();
  for (const row of linesIn) {
    const cat = parseCategory(row?.category);
    if (!cat) {
      return res.status(400).json({ error: `Invalid category in lines: ${row?.category}` });
    }
    if (seen.has(cat)) {
      return res.status(400).json({ error: `Duplicate category in lines: ${cat}` });
    }
    seen.add(cat);
    const amt = typeof row?.amount === "number" ? row.amount : Number(row?.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      return res.status(400).json({ error: `Invalid amount for category ${cat}` });
    }
    const lineAlert = parseAlertThresholdPercent(row?.alertThresholdPercent);
    if (lineAlert === undefined) {
      return res.status(400).json({
        error: `alertThresholdPercent for ${cat} must be empty or an integer from 1 to 100`,
      });
    }
    parsedLines.push({ category: cat, amount: amt, alertThresholdPercent: lineAlert });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO budget_periods (user_id, year, month, total_amount, total_alert_threshold_percent, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, year, month)
       DO UPDATE SET
         total_amount = EXCLUDED.total_amount,
         total_alert_threshold_percent = EXCLUDED.total_alert_threshold_percent,
         updated_at = NOW()
       RETURNING id`,
      [req.userId, year, month, totalAmount, totalAlertRaw]
    );
    const periodId = rows[0].id;
    await client.query(`DELETE FROM budget_lines WHERE budget_period_id = $1`, [periodId]);
    for (const l of parsedLines) {
      await client.query(
        `INSERT INTO budget_lines (budget_period_id, category, amount, alert_threshold_percent)
         VALUES ($1, $2, $3, $4)`,
        [periodId, l.category, l.amount, l.alertThresholdPercent]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const payload = await loadBudgetPayload(req.userId, year, month);
  await syncBudgetThresholdNotifications(req.userId, payload);
  res.json(payload);
});

budgetsRouter.delete("/:year/:month", async (req, res) => {
  const year = Number.parseInt(req.params.year, 10);
  const month = Number.parseInt(req.params.month, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: "Invalid year or month" });
  }
  await pool.query(`DELETE FROM budget_periods WHERE user_id = $1 AND year = $2 AND month = $3`, [
    req.userId,
    year,
    month,
  ]);
  res.status(204).end();
});
