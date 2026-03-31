import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import {
  parsePaymentPlanCategory,
  parsePaymentSchedule,
  parsePriorityLevel,
  parsePaymentPlanStatus,
  parseAccountType,
  parsePaymentMethod,
  parseInstitution,
  parsePaymentPlanTag,
  parsePaymentPlanFrequency,
  PAYMENT_PLAN_CATEGORY_ERROR,
  PAYMENT_SCHEDULE_ERROR,
  PRIORITY_LEVEL_ERROR,
  PAYMENT_PLAN_STATUS_ERROR,
  ACCOUNT_TYPE_ERROR,
  PAYMENT_METHOD_ERROR,
  INSTITUTION_ERROR,
  PAYMENT_PLAN_TAG_ERROR,
  PAYMENT_PLAN_FREQUENCY_ERROR,
} from "../paymentPlanEnums.js";

const badId = "Invalid id";

export const paymentPlansRouter = Router();
paymentPlansRouter.use(authRequired);

function normalizeRow(row) {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount != null ? String(row.amount) : "0",
    category: row.category,
    payment_schedule: row.payment_schedule,
    priority_level: row.priority_level,
    status: row.status,
    account_type: row.account_type,
    payment_method: row.payment_method,
    institution: row.institution,
    tag: row.tag,
    frequency: row.frequency,
    notes: row.notes ?? "",
    created_at: row.created_at,
  };
}

paymentPlansRouter.get("/", async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const { rows } = await pool.query(
    `SELECT id, name, amount, category, payment_schedule, priority_level, status,
            account_type, payment_method, institution, tag, frequency, notes, created_at
     FROM payment_plans WHERE user_id = $1
     ORDER BY id DESC
     LIMIT $2`,
    [req.userId, limit]
  );
  res.json(rows.map(normalizeRow));
});

paymentPlansRouter.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 200);
  const amount = Number(req.body?.amount);
  const category = parsePaymentPlanCategory(req.body?.category);
  const payment_schedule = parsePaymentSchedule(req.body?.payment_schedule);
  const priority_level = parsePriorityLevel(req.body?.priority_level);
  const status = parsePaymentPlanStatus(req.body?.status);
  const account_type = parseAccountType(req.body?.account_type);
  const payment_method = parsePaymentMethod(req.body?.payment_method);
  const institution = parseInstitution(req.body?.institution);
  const tag = parsePaymentPlanTag(req.body?.tag);
  const frequency = parsePaymentPlanFrequency(req.body?.frequency);
  const notes = String(req.body?.notes ?? "").slice(0, 2000);

  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Invalid amount" });
  if (!category) return res.status(400).json({ error: PAYMENT_PLAN_CATEGORY_ERROR });
  if (!payment_schedule) return res.status(400).json({ error: PAYMENT_SCHEDULE_ERROR });
  if (!priority_level) return res.status(400).json({ error: PRIORITY_LEVEL_ERROR });
  if (!status) return res.status(400).json({ error: PAYMENT_PLAN_STATUS_ERROR });
  if (!account_type) return res.status(400).json({ error: ACCOUNT_TYPE_ERROR });
  if (!payment_method) return res.status(400).json({ error: PAYMENT_METHOD_ERROR });
  if (!institution) return res.status(400).json({ error: INSTITUTION_ERROR });
  if (!tag) return res.status(400).json({ error: PAYMENT_PLAN_TAG_ERROR });
  if (!frequency) return res.status(400).json({ error: PAYMENT_PLAN_FREQUENCY_ERROR });

  const { rows } = await pool.query(
    `INSERT INTO payment_plans (
      user_id, name, amount, category, payment_schedule, priority_level, status,
      account_type, payment_method, institution, tag, frequency, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, name, amount, category, payment_schedule, priority_level, status,
               account_type, payment_method, institution, tag, frequency, notes, created_at`,
    [
      req.userId,
      name,
      amount,
      category,
      payment_schedule,
      priority_level,
      status,
      account_type,
      payment_method,
      institution,
      tag,
      frequency,
      notes,
    ]
  );
  res.status(201).json(normalizeRow(rows[0]));
});

paymentPlansRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });

  const { rows: existing } = await pool.query(
    `SELECT id FROM payment_plans WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!existing[0]) return res.status(404).json({ error: "Not found" });

  const updates = [];
  const params = [];
  let i = 1;

  if (req.body.name !== undefined) {
    const name = String(req.body.name || "").trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: "Name is required" });
    updates.push(`name = $${i++}`);
    params.push(name);
  }
  if (req.body.amount !== undefined) {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Invalid amount" });
    updates.push(`amount = $${i++}`);
    params.push(amount);
  }
  if (req.body.category !== undefined) {
    const x = parsePaymentPlanCategory(req.body.category);
    if (!x) return res.status(400).json({ error: PAYMENT_PLAN_CATEGORY_ERROR });
    updates.push(`category = $${i++}`);
    params.push(x);
  }
  if (req.body.payment_schedule !== undefined) {
    const x = parsePaymentSchedule(req.body.payment_schedule);
    if (!x) return res.status(400).json({ error: PAYMENT_SCHEDULE_ERROR });
    updates.push(`payment_schedule = $${i++}`);
    params.push(x);
  }
  if (req.body.priority_level !== undefined) {
    const x = parsePriorityLevel(req.body.priority_level);
    if (!x) return res.status(400).json({ error: PRIORITY_LEVEL_ERROR });
    updates.push(`priority_level = $${i++}`);
    params.push(x);
  }
  if (req.body.status !== undefined) {
    const x = parsePaymentPlanStatus(req.body.status);
    if (!x) return res.status(400).json({ error: PAYMENT_PLAN_STATUS_ERROR });
    updates.push(`status = $${i++}`);
    params.push(x);
  }
  if (req.body.account_type !== undefined) {
    const x = parseAccountType(req.body.account_type);
    if (!x) return res.status(400).json({ error: ACCOUNT_TYPE_ERROR });
    updates.push(`account_type = $${i++}`);
    params.push(x);
  }
  if (req.body.payment_method !== undefined) {
    const x = parsePaymentMethod(req.body.payment_method);
    if (!x) return res.status(400).json({ error: PAYMENT_METHOD_ERROR });
    updates.push(`payment_method = $${i++}`);
    params.push(x);
  }
  if (req.body.institution !== undefined) {
    const x = parseInstitution(req.body.institution);
    if (!x) return res.status(400).json({ error: INSTITUTION_ERROR });
    updates.push(`institution = $${i++}`);
    params.push(x);
  }
  if (req.body.tag !== undefined) {
    const x = parsePaymentPlanTag(req.body.tag);
    if (!x) return res.status(400).json({ error: PAYMENT_PLAN_TAG_ERROR });
    updates.push(`tag = $${i++}`);
    params.push(x);
  }
  if (req.body.frequency !== undefined) {
    const x = parsePaymentPlanFrequency(req.body.frequency);
    if (!x) return res.status(400).json({ error: PAYMENT_PLAN_FREQUENCY_ERROR });
    updates.push(`frequency = $${i++}`);
    params.push(x);
  }
  if (req.body.notes !== undefined) {
    updates.push(`notes = $${i++}`);
    params.push(String(req.body.notes ?? "").slice(0, 2000));
  }

  if (updates.length === 0) {
    const { rows } = await pool.query(
      `SELECT id, name, amount, category, payment_schedule, priority_level, status,
              account_type, payment_method, institution, tag, frequency, notes, created_at
       FROM payment_plans WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    return res.json(normalizeRow(rows[0]));
  }

  params.push(id, req.userId);
  const { rows } = await pool.query(
    `UPDATE payment_plans SET ${updates.join(", ")}
     WHERE id = $${i++} AND user_id = $${i++}
     RETURNING id, name, amount, category, payment_schedule, priority_level, status,
               account_type, payment_method, institution, tag, frequency, notes, created_at`,
    params
  );
  res.json(normalizeRow(rows[0]));
});

paymentPlansRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rowCount } = await pool.query(`DELETE FROM payment_plans WHERE id = $1 AND user_id = $2`, [
    id,
    req.userId,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});
