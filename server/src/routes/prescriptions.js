import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import {
  parsePrescriptionCategory,
  parseRenewalPeriod,
  parsePrescriptionState,
  parseIsoDate,
  PRESCRIPTION_CATEGORY_ERROR,
  PRESCRIPTION_RENEWAL_PERIOD_ERROR,
  PRESCRIPTION_STATE_ERROR,
} from "../prescriptionEnums.js";

const badId = "Invalid id";

export const prescriptionsRouter = Router();
prescriptionsRouter.use(authRequired);

function normalizeRow(row) {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount != null ? String(row.amount) : "0",
    renewal_period: row.renewal_period,
    next_renewal_date: row.next_renewal_date,
    vendor: row.vendor ?? "",
    notes: row.notes ?? "",
    category: row.category,
    state: row.state ?? "active",
    created_at: row.created_at,
  };
}

prescriptionsRouter.get("/", async (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const { rows } = await pool.query(
    `SELECT id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state, created_at
     FROM prescriptions WHERE user_id = $1
     ORDER BY next_renewal_date ASC, id ASC
     LIMIT $2`,
    [req.userId, limit]
  );
  res.json(rows.map(normalizeRow));
});

prescriptionsRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rows } = await pool.query(
    `SELECT id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state, created_at
     FROM prescriptions WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(normalizeRow(rows[0]));
});

prescriptionsRouter.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 200);
  const amount = Number(req.body?.amount);
  const renewal_period = parseRenewalPeriod(req.body?.renewal_period);
  const next_renewal_date = parseIsoDate(req.body?.next_renewal_date);
  const vendor = String(req.body?.vendor ?? "").trim().slice(0, 200);
  const notes = String(req.body?.notes ?? "").slice(0, 2000);
  const category = parsePrescriptionCategory(req.body?.category);

  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: "Invalid amount" });
  if (!renewal_period) return res.status(400).json({ error: PRESCRIPTION_RENEWAL_PERIOD_ERROR });
  if (!next_renewal_date) return res.status(400).json({ error: "Invalid next_renewal_date (use YYYY-MM-DD)" });
  if (!category) return res.status(400).json({ error: PRESCRIPTION_CATEGORY_ERROR });

  let state = "active";
  if (req.body?.state !== undefined && req.body?.state !== null && String(req.body.state).trim() !== "") {
    const parsed = parsePrescriptionState(req.body.state);
    if (!parsed) return res.status(400).json({ error: PRESCRIPTION_STATE_ERROR });
    state = parsed;
  }

  const { rows } = await pool.query(
    `INSERT INTO prescriptions (user_id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state, created_at`,
    [req.userId, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state]
  );
  res.status(201).json(normalizeRow(rows[0]));
});

prescriptionsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });

  const { rows: existing } = await pool.query(
    `SELECT id FROM prescriptions WHERE id = $1 AND user_id = $2`,
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
  if (req.body.renewal_period !== undefined) {
    const renewal_period = parseRenewalPeriod(req.body.renewal_period);
    if (!renewal_period) return res.status(400).json({ error: PRESCRIPTION_RENEWAL_PERIOD_ERROR });
    updates.push(`renewal_period = $${i++}`);
    params.push(renewal_period);
  }
  if (req.body.next_renewal_date !== undefined) {
    const next_renewal_date = parseIsoDate(req.body.next_renewal_date);
    if (!next_renewal_date) return res.status(400).json({ error: "Invalid next_renewal_date (use YYYY-MM-DD)" });
    updates.push(`next_renewal_date = $${i++}`);
    params.push(next_renewal_date);
  }
  if (req.body.vendor !== undefined) {
    updates.push(`vendor = $${i++}`);
    params.push(String(req.body.vendor ?? "").trim().slice(0, 200));
  }
  if (req.body.notes !== undefined) {
    updates.push(`notes = $${i++}`);
    params.push(String(req.body.notes ?? "").slice(0, 2000));
  }
  if (req.body.category !== undefined) {
    const category = parsePrescriptionCategory(req.body.category);
    if (!category) return res.status(400).json({ error: PRESCRIPTION_CATEGORY_ERROR });
    updates.push(`category = $${i++}`);
    params.push(category);
  }
  if (req.body.state !== undefined) {
    const state = parsePrescriptionState(req.body.state);
    if (!state) return res.status(400).json({ error: PRESCRIPTION_STATE_ERROR });
    updates.push(`state = $${i++}`);
    params.push(state);
  }

  if (updates.length === 0) {
    const { rows } = await pool.query(
      `SELECT id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state, created_at
       FROM prescriptions WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    return res.json(normalizeRow(rows[0]));
  }

  params.push(id, req.userId);
  const { rows } = await pool.query(
    `UPDATE prescriptions SET ${updates.join(", ")}
     WHERE id = $${i++} AND user_id = $${i++}
     RETURNING id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state, created_at`,
    params
  );
  res.json(normalizeRow(rows[0]));
});

prescriptionsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: badId });
  const { rowCount } = await pool.query(`DELETE FROM prescriptions WHERE id = $1 AND user_id = $2`, [
    id,
    req.userId,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});
