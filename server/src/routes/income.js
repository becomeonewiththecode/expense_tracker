import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import {
  parseFrequency,
  tryParsePaymentDay,
  PAYMENT_DAY_ERROR,
  PAYMENT_DAY_2_ERROR,
  BIMONTHLY_PAYMENT_DAYS_REQUIRED,
} from "../expenseEnums.js";

const badId = "Invalid id";

export const incomeRouter = Router();
incomeRouter.use(authRequired);

function parseDate(d) {
  if (!d) return null;
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (m) return m[1];
  return null;
}

function normalizeIncome(row) {
  let received_at = row.received_at;
  if (received_at != null) {
    const s = String(received_at);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      received_at = s;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      received_at = s.slice(0, 10);
    } else {
      const t = Date.parse(s);
      if (!Number.isNaN(t)) {
        received_at = new Date(t).toISOString().slice(0, 10);
      }
    }
  }
  return {
    ...row,
    received_at,
    amount: row.amount != null ? Number(row.amount) : row.amount,
    payment_day: row.payment_day != null ? Number(row.payment_day) : null,
    payment_day_2: row.payment_day_2 != null ? Number(row.payment_day_2) : null,
  };
}

incomeRouter.get("/", async (req, res) => {
  const { from, to, limit = "100", offset = "0" } = req.query;
  const params = [req.userId];
  let sql = `SELECT id, amount, frequency, description, received_at, payment_day, payment_day_2, created_at
    FROM income_entries WHERE user_id = $1`;
  let i = 2;
  if (from && parseDate(from)) {
    sql += ` AND received_at >= $${i++}`;
    params.push(parseDate(from));
  }
  if (to && parseDate(to)) {
    sql += ` AND received_at <= $${i++}`;
    params.push(parseDate(to));
  }
  sql += ` ORDER BY received_at DESC, id DESC LIMIT $${i++} OFFSET $${i++}`;
  params.push(Math.min(500, Math.max(1, Number(limit) || 100)), Math.max(0, Number(offset) || 0));
  const { rows } = await pool.query(sql, params);
  res.json(rows.map(normalizeIncome));
});

incomeRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rows } = await pool.query(
    `SELECT id, amount, frequency, description, received_at, payment_day, payment_day_2, created_at FROM income_entries
     WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(normalizeIncome(rows[0]));
});

incomeRouter.post("/", async (req, res) => {
  const amount = Number(req.body?.amount);
  const frequency = parseFrequency(req.body?.frequency);
  const description = String(req.body?.description || "").slice(0, 500);
  const received_at = parseDate(req.body?.received_at) || new Date().toISOString().slice(0, 10);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  if (!frequency) {
    return res.status(400).json({
      error: "Invalid frequency (use once, weekly, monthly, bimonthly, yearly)",
    });
  }
  let payment_day = null;
  let payment_day_2 = null;
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
  }
  const { rows } = await pool.query(
    `INSERT INTO income_entries (user_id, amount, frequency, description, received_at, payment_day, payment_day_2)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, amount, frequency, description, received_at, payment_day, payment_day_2, created_at`,
    [req.userId, amount, frequency, description, received_at, payment_day, payment_day_2]
  );
  res.status(201).json(normalizeIncome(rows[0]));
});

incomeRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rows: curRows } = await pool.query(
    `SELECT amount, frequency, description, received_at, payment_day, payment_day_2 FROM income_entries WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!curRows[0]) return res.status(404).json({ error: "Not found" });
  const cur = curRows[0];

  if (
    req.body?.amount === undefined &&
    req.body?.frequency === undefined &&
    req.body?.description === undefined &&
    req.body?.received_at === undefined &&
    req.body?.payment_day === undefined &&
    req.body?.payment_day_2 === undefined
  ) {
    return res.status(400).json({ error: "No updates" });
  }

  let nextAmount = Number(cur.amount);
  if (req.body?.amount !== undefined) {
    nextAmount = Number(req.body.amount);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }
  }

  let nextFrequency = cur.frequency;
  if (req.body?.frequency !== undefined) {
    const f = parseFrequency(req.body.frequency);
    if (!f) {
      return res.status(400).json({
        error: "Invalid frequency (use once, weekly, monthly, bimonthly, yearly)",
      });
    }
    nextFrequency = f;
  }

  let nextDescription = cur.description ?? "";
  if (req.body?.description !== undefined) {
    nextDescription = String(req.body.description || "").slice(0, 500);
  }

  let nextReceived = cur.received_at;
  if (req.body?.received_at !== undefined) {
    const d = parseDate(req.body.received_at);
    if (!d) return res.status(400).json({ error: "Invalid received_at" });
    nextReceived = d;
  }

  let nextPd1 = cur.payment_day;
  let nextPd2 = cur.payment_day_2;
  if (req.body?.payment_day !== undefined) {
    const p = tryParsePaymentDay(req.body.payment_day);
    if (!p.ok) return res.status(400).json({ error: PAYMENT_DAY_ERROR });
    nextPd1 = p.value;
  }
  if (req.body?.payment_day_2 !== undefined) {
    const p = tryParsePaymentDay(req.body.payment_day_2);
    if (!p.ok) return res.status(400).json({ error: PAYMENT_DAY_2_ERROR });
    nextPd2 = p.value;
  }

  if (nextFrequency !== "bimonthly") {
    nextPd1 = null;
    nextPd2 = null;
  } else if (nextPd1 == null || nextPd2 == null) {
    return res.status(400).json({ error: BIMONTHLY_PAYMENT_DAYS_REQUIRED });
  }

  const { rows } = await pool.query(
    `UPDATE income_entries SET
       amount = $1, frequency = $2, description = $3, received_at = $4,
       payment_day = $5, payment_day_2 = $6
     WHERE id = $7 AND user_id = $8
     RETURNING id, amount, frequency, description, received_at, payment_day, payment_day_2, created_at`,
    [nextAmount, nextFrequency, nextDescription, nextReceived, nextPd1, nextPd2, id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(normalizeIncome(rows[0]));
});

incomeRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rowCount } = await pool.query(`DELETE FROM income_entries WHERE id = $1 AND user_id = $2`, [
    id,
    req.userId,
  ]);
  if (!rowCount) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});
