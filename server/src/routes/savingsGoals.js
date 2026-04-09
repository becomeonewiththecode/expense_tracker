import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";

export const savingsGoalsRouter = Router();
savingsGoalsRouter.use(authRequired);

savingsGoalsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, target_amount::float AS target_amount, current_amount::float AS current_amount,
            target_date, created_at, updated_at
     FROM savings_goals WHERE user_id = $1 ORDER BY id DESC`,
    [req.userId]
  );
  res.json(
    rows.map((r) => ({
      ...r,
      progress:
        r.target_amount > 0 ? Math.min(100, (Number(r.current_amount) / Number(r.target_amount)) * 100) : 0,
    }))
  );
});

savingsGoalsRouter.post("/", async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 200);
  if (!name) return res.status(400).json({ error: "name is required" });
  const target_amount = Number(req.body?.target_amount);
  if (!Number.isFinite(target_amount) || target_amount <= 0) {
    return res.status(400).json({ error: "target_amount must be a positive number" });
  }
  let current_amount = Number(req.body?.current_amount);
  if (!Number.isFinite(current_amount) || current_amount < 0) current_amount = 0;
  const target_date =
    req.body?.target_date != null && String(req.body.target_date).trim() !== ""
      ? String(req.body.target_date).slice(0, 10)
      : null;
  if (target_date && !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
    return res.status(400).json({ error: "target_date must be YYYY-MM-DD" });
  }

  const { rows } = await pool.query(
    `INSERT INTO savings_goals (user_id, name, target_amount, current_amount, target_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, target_amount::float AS target_amount, current_amount::float AS current_amount, target_date, created_at, updated_at`,
    [req.userId, name, target_amount, current_amount, target_date]
  );
  const row = rows[0];
  res.status(201).json({
    ...row,
    progress: Math.min(100, (row.current_amount / row.target_amount) * 100),
  });
});

savingsGoalsRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const sets = [];
  const params = [];
  let n = 1;

  if (req.body?.name !== undefined) {
    const name = String(req.body.name || "").trim().slice(0, 200);
    if (!name) return res.status(400).json({ error: "name cannot be empty" });
    sets.push(`name = $${n++}`);
    params.push(name);
  }
  if (req.body?.target_amount !== undefined) {
    const target_amount = Number(req.body.target_amount);
    if (!Number.isFinite(target_amount) || target_amount <= 0) {
      return res.status(400).json({ error: "target_amount must be positive" });
    }
    sets.push(`target_amount = $${n++}`);
    params.push(target_amount);
  }
  if (req.body?.current_amount !== undefined) {
    const current_amount = Number(req.body.current_amount);
    if (!Number.isFinite(current_amount) || current_amount < 0) {
      return res.status(400).json({ error: "current_amount must be >= 0" });
    }
    sets.push(`current_amount = $${n++}`);
    params.push(current_amount);
  }
  if (req.body?.target_date !== undefined) {
    const raw = req.body.target_date;
    if (raw === null || String(raw).trim() === "") {
      sets.push(`target_date = NULL`);
    } else {
      const td = String(raw).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(td)) {
        return res.status(400).json({ error: "target_date must be YYYY-MM-DD" });
      }
      sets.push(`target_date = $${n++}`);
      params.push(td);
    }
  }

  if (!sets.length) return res.status(400).json({ error: "No updates" });
  sets.push(`updated_at = NOW()`);

  params.push(id, req.userId);
  const { rows } = await pool.query(
    `UPDATE savings_goals SET ${sets.join(", ")}
     WHERE id = $${n++} AND user_id = $${n}
     RETURNING id, name, target_amount::float AS target_amount, current_amount::float AS current_amount, target_date, created_at, updated_at`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  const row = rows[0];
  res.json({
    ...row,
    progress: Math.min(100, (row.current_amount / row.target_amount) * 100),
  });
});

savingsGoalsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const del = await pool.query(`DELETE FROM savings_goals WHERE id = $1 AND user_id = $2`, [id, req.userId]);
  if (!del.rowCount) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});
