import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import {
  parseCategory,
  parseExpenseState,
  parseFinancialInstitution,
  parseFrequency,
  parseRenewalKind,
  parseWebsite,
  resolveRenewalFieldsForCategory,
  CATEGORY_ERROR,
  RENEWAL_KIND_ERROR,
  RENEWAL_KIND_REQUIRED,
  STATE_ERROR,
  paymentMetaFromSpentAt,
  spentAtToIsoDate,
  tryParsePaymentDay,
  PAYMENT_DAY_ERROR,
  PAYMENT_DAY_2_ERROR,
  BIMONTHLY_PAYMENT_DAYS_REQUIRED,
} from "../expenseEnums.js";
import { removePaymentPlanForExpense, syncPaymentPlanForExpense } from "../paymentPlanSync.js";

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
  const { from, to, limit = "100", offset = "0", category: categoryQ } = req.query;
  const params = [req.userId];
  let sql = `SELECT id, amount, category, financial_institution, frequency, state, payment_day, payment_day_2, payment_month, description, website, renewal_kind, spent_at, created_at
    FROM expenses WHERE user_id = $1`;
  let i = 2;
  if (categoryQ != null && String(categoryQ).trim() !== "") {
    const cat = parseCategory(categoryQ);
    if (!cat) {
      return res.status(400).json({ error: CATEGORY_ERROR });
    }
    sql += ` AND category = $${i++}`;
    params.push(cat);
  }
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
    `SELECT id, amount, category, financial_institution, frequency, state, payment_day, payment_day_2, payment_month, description, website, renewal_kind, spent_at, created_at FROM expenses
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
      error: "Invalid frequency (use once, weekly, monthly, bimonthly, yearly)",
    });
  }
  let state = "active";
  if (req.body?.state !== undefined && req.body?.state !== null && String(req.body.state).trim() !== "") {
    const parsed = parseExpenseState(req.body.state);
    if (!parsed) {
      return res.status(400).json({ error: STATE_ERROR });
    }
    state = parsed;
  }
  const website = parseWebsite(req.body?.website);
  const { renewal_kind, error: renewalErr } = resolveRenewalFieldsForCategory(
    category,
    req.body?.renewal_kind
  );
  if (renewalErr) {
    return res.status(400).json({ error: renewalErr });
  }
  let payment_day, payment_day_2, payment_month;
  if (frequency === "bimonthly") {
    const pd1 = tryParsePaymentDay(req.body?.payment_day);
    if (!pd1.ok) return res.status(400).json({ error: PAYMENT_DAY_ERROR });
    const pd2 = tryParsePaymentDay(req.body?.payment_day_2);
    if (!pd2.ok) return res.status(400).json({ error: PAYMENT_DAY_2_ERROR });
    if (pd1.value == null || pd2.value == null) {
      return res.status(400).json({ error: BIMONTHLY_PAYMENT_DAYS_REQUIRED });
    }
    payment_day = pd1.value;
    payment_day_2 = pd2.value;
    const meta = paymentMetaFromSpentAt(spent_at);
    payment_month = meta.payment_month;
  } else {
    const meta = paymentMetaFromSpentAt(spent_at);
    payment_day = meta.payment_day;
    payment_day_2 = null;
    payment_month = meta.payment_month;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO expenses (user_id, amount, category, financial_institution, frequency, state, payment_day, payment_day_2, payment_month, description, website, renewal_kind, spent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, amount, category, financial_institution, frequency, state, payment_day, payment_day_2, payment_month, description, website, renewal_kind, spent_at, created_at`,
      [
        req.userId,
        amount,
        category,
        financial_institution,
        frequency,
        state,
        payment_day,
        payment_day_2,
        payment_month,
        description,
        website,
        renewal_kind,
        spent_at,
      ]
    );
    const inserted = rows[0];
    if (inserted.category === "payment_plan") {
      await syncPaymentPlanForExpense(client, req.userId, inserted);
    }
    await client.query("COMMIT");
    res.status(201).json(normalizeExpense(inserted));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

expensesRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });

  const { rows: existingRows } = await pool.query(
    `SELECT spent_at, category, renewal_kind, frequency FROM expenses WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!existingRows[0]) return res.status(404).json({ error: "Not found" });

  let nextCategory = existingRows[0].category;
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
    nextCategory = category;
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
        error: "Invalid frequency (use once, weekly, monthly, bimonthly, yearly)",
      });
    }
    updates.push(`frequency = $${i++}`);
    params.push(frequency);
  }
  if (req.body.description !== undefined) {
    updates.push(`description = $${i++}`);
    params.push(String(req.body.description).slice(0, 500));
  }
  if (req.body.state !== undefined) {
    const parsed = parseExpenseState(req.body.state);
    if (!parsed) {
      return res.status(400).json({ error: STATE_ERROR });
    }
    updates.push(`state = $${i++}`);
    params.push(parsed);
  }
  if (req.body.spent_at !== undefined) {
    const d = parseDate(req.body.spent_at);
    if (!d) return res.status(400).json({ error: "Invalid spent_at" });
    updates.push(`spent_at = $${i++}`);
    params.push(d);
  }
  if (req.body.website !== undefined) {
    updates.push(`website = $${i++}`);
    params.push(parseWebsite(req.body.website));
  }

  if (nextCategory === "renewal") {
    if (req.body.renewal_kind !== undefined) {
      const rk = parseRenewalKind(req.body.renewal_kind);
      if (!rk) {
        return res.status(400).json({ error: RENEWAL_KIND_ERROR });
      }
      updates.push(`renewal_kind = $${i++}`);
      params.push(rk);
    } else if (req.body.category !== undefined) {
      if (!existingRows[0].renewal_kind) {
        return res.status(400).json({ error: RENEWAL_KIND_REQUIRED });
      }
    }
  } else if (
    req.body.category !== undefined ||
    req.body.renewal_kind !== undefined
  ) {
    updates.push(`renewal_kind = $${i++}`);
    params.push(null);
  }

  if (!updates.length && req.body.payment_day === undefined && req.body.payment_day_2 === undefined) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const effectiveFrequency = req.body.frequency !== undefined
    ? parseFrequency(req.body.frequency)
    : existingRows[0].frequency;
  const effectiveSpent =
    req.body.spent_at !== undefined
      ? parseDate(req.body.spent_at)
      : spentAtToIsoDate(existingRows[0].spent_at);

  if (effectiveFrequency === "bimonthly") {
    if (req.body.payment_day !== undefined || req.body.payment_day_2 !== undefined) {
      const pd1 = req.body.payment_day !== undefined
        ? tryParsePaymentDay(req.body.payment_day)
        : { ok: true, value: null };
      if (!pd1.ok) return res.status(400).json({ error: PAYMENT_DAY_ERROR });
      const pd2 = req.body.payment_day_2 !== undefined
        ? tryParsePaymentDay(req.body.payment_day_2)
        : { ok: true, value: null };
      if (!pd2.ok) return res.status(400).json({ error: PAYMENT_DAY_2_ERROR });
      if (pd1.value != null) {
        updates.push(`payment_day = $${i++}`);
        params.push(pd1.value);
      }
      if (pd2.value != null) {
        updates.push(`payment_day_2 = $${i++}`);
        params.push(pd2.value);
      }
    }
    const meta = paymentMetaFromSpentAt(effectiveSpent);
    updates.push(`payment_month = $${i++}`);
    params.push(meta.payment_month);
  } else {
    const { payment_day, payment_month } = paymentMetaFromSpentAt(effectiveSpent);
    updates.push(`payment_day = $${i++}`);
    params.push(payment_day);
    updates.push(`payment_day_2 = $${i++}`);
    params.push(null);
    updates.push(`payment_month = $${i++}`);
    params.push(payment_month);
  }

  if (!updates.length) return res.status(400).json({ error: "No fields to update" });

  params.push(id, req.userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `UPDATE expenses SET ${updates.join(", ")}
       WHERE id = $${i++} AND user_id = $${i++}
       RETURNING id, amount, category, financial_institution, frequency, state, payment_day, payment_day_2, payment_month, description, website, renewal_kind, spent_at, created_at`,
      params
    );
    if (!rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    const updated = rows[0];
    if (updated.category === "payment_plan") {
      await syncPaymentPlanForExpense(client, req.userId, updated);
    } else if (existingRows[0].category === "payment_plan") {
      await removePaymentPlanForExpense(client, req.userId, id);
    }
    await client.query("COMMIT");
    res.json(normalizeExpense(updated));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

expensesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(`DELETE FROM expenses WHERE id = $1 AND user_id = $2`, [
      id,
      req.userId,
    ]);
    if (!rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Not found" });
    }
    await removePaymentPlanForExpense(client, req.userId, id);
    await client.query("COMMIT");
    res.status(204).send();
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
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
    payment_day_2: row.payment_day_2 != null ? Number(row.payment_day_2) : null,
    payment_month: row.payment_month != null ? Number(row.payment_month) : null,
  };
}
