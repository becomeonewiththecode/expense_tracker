import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import {
  parseCategory,
  parseFinancialInstitution,
  parseFrequency,
  CATEGORY_ERROR,
  PAYMENT_DAY_ERROR,
  tryParsePaymentDay,
} from "../expenseEnums.js";

const badId = "Invalid id";

export const expensesRouter = Router();
expensesRouter.use(authRequired);

function parseDate(d) {
  if (!d) return null;
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (m) return m[1];
  return null;
}

expensesRouter.get("/", async (req, res) => {
  const { from, to, limit = "100", offset = "0" } = req.query;
  const params = [req.userId];
  let sql = `SELECT id, amount, category, financial_institution, frequency, payment_day, description, spent_at, created_at
    FROM expenses WHERE user_id = $1`;
  let i = 2;
  if (from && parseDate(from)) {
    sql += ` AND spent_at >= $${i++}`;
    params.push(parseDate(from));
  }
  if (to && parseDate(to)) {
    sql += ` AND spent_at <= $${i++}`;
    params.push(parseDate(to));
  }
  sql += ` ORDER BY spent_at DESC, id DESC LIMIT $${i++} OFFSET $${i++}`;
  params.push(Math.min(500, Math.max(1, Number(limit) || 100)), Math.max(0, Number(offset) || 0));
  const { rows } = await pool.query(sql, params);
  res.json(rows.map(normalizeExpense));
});

expensesRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rows } = await pool.query(
    `SELECT id, amount, category, financial_institution, frequency, payment_day, description, spent_at, created_at FROM expenses
     WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(normalizeExpense(rows[0]));
});

expensesRouter.post("/", async (req, res) => {
  const amount = Number(req.body?.amount);
  const category = parseCategory(req.body?.category);
  const financial_institution = parseFinancialInstitution(req.body?.financial_institution);
  const frequency = parseFrequency(req.body?.frequency);
  const description = String(req.body?.description || "").slice(0, 500);
  const spent_at = parseDate(req.body?.spent_at) || new Date().toISOString().slice(0, 10);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  if (!category) {
    return res.status(400).json({ error: CATEGORY_ERROR });
  }
  if (!financial_institution) {
    return res.status(400).json({
      error: "Invalid financial institution (use bank, visa, mastercard, american_express)",
    });
  }
  if (!frequency) {
    return res.status(400).json({
      error: "Invalid frequency (use once, weekly, monthly, bimonthly)",
    });
  }
  let payment_day = null;
  if (Object.prototype.hasOwnProperty.call(req.body, "payment_day")) {
    const parsed = tryParsePaymentDay(req.body.payment_day);
    if (!parsed.ok) return res.status(400).json({ error: PAYMENT_DAY_ERROR });
    payment_day = parsed.value;
  }
  const { rows } = await pool.query(
    `INSERT INTO expenses (user_id, amount, category, financial_institution, frequency, payment_day, description, spent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, amount, category, financial_institution, frequency, payment_day, description, spent_at, created_at`,
    [req.userId, amount, category, financial_institution, frequency, payment_day, description, spent_at]
  );
  res.status(201).json(normalizeExpense(rows[0]));
});

expensesRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const updates = [];
  const params = [];
  let i = 1;
  if (req.body.amount !== undefined) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    updates.push(`amount = $${i++}`);
    params.push(amount);
  }
  if (req.body.category !== undefined) {
    const category = parseCategory(req.body.category);
    if (!category) {
      return res.status(400).json({ error: CATEGORY_ERROR });
    }
    updates.push(`category = $${i++}`);
    params.push(category);
  }
  if (req.body.financial_institution !== undefined) {
    const financial_institution = parseFinancialInstitution(req.body.financial_institution);
    if (!financial_institution) {
      return res.status(400).json({
        error:
          "Invalid financial institution (use bank, visa, mastercard, american_express)",
      });
    }
    updates.push(`financial_institution = $${i++}`);
    params.push(financial_institution);
  }
  if (req.body.frequency !== undefined) {
    const frequency = parseFrequency(req.body.frequency);
    if (!frequency) {
      return res.status(400).json({
        error: "Invalid frequency (use once, weekly, monthly, bimonthly)",
      });
    }
    updates.push(`frequency = $${i++}`);
    params.push(frequency);
  }
  if (req.body.description !== undefined) {
    updates.push(`description = $${i++}`);
    params.push(String(req.body.description).slice(0, 500));
  }
  if (req.body.spent_at !== undefined) {
    const d = parseDate(req.body.spent_at);
    if (!d) return res.status(400).json({ error: "Invalid spent_at" });
    updates.push(`spent_at = $${i++}`);
    params.push(d);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "payment_day")) {
    const parsed = tryParsePaymentDay(req.body.payment_day);
    if (!parsed.ok) return res.status(400).json({ error: PAYMENT_DAY_ERROR });
    updates.push(`payment_day = $${i++}`);
    params.push(parsed.value);
  }
  if (!updates.length) return res.status(400).json({ error: "No fields to update" });
  params.push(id, req.userId);
  const { rows } = await pool.query(
    `UPDATE expenses SET ${updates.join(", ")}
     WHERE id = $${i++} AND user_id = $${i++}
     RETURNING id, amount, category, financial_institution, frequency, payment_day, description, spent_at, created_at`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(normalizeExpense(rows[0]));
});

expensesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rowCount } = await pool.query(
    `DELETE FROM expenses WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!rowCount) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});

function normalizeExpense(row) {
  let spent_at = row.spent_at;
  if (spent_at != null) {
    const s = String(spent_at);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      spent_at = s;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      spent_at = s.slice(0, 10);
    } else {
      const t = Date.parse(s);
      if (!Number.isNaN(t)) {
        spent_at = new Date(t).toISOString().slice(0, 10);
      }
    }
  }
  return {
    ...row,
    spent_at,
    amount: row.amount != null ? Number(row.amount) : row.amount,
    payment_day: row.payment_day != null ? Number(row.payment_day) : null,
  };
}
