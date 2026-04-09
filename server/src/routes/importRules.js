import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { parseCategory, parseRenewalKind, CATEGORY_ERROR, RENEWAL_KIND_ERROR } from "../expenseEnums.js";

export const importRulesRouter = Router();
importRulesRouter.use(authRequired);

const MATCH_TYPES = new Set(["contains", "starts_with", "exact"]);

importRulesRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, match_type, pattern, category, renewal_kind, sort_order, created_at
     FROM import_category_rules WHERE user_id = $1 ORDER BY sort_order ASC, id ASC`,
    [req.userId]
  );
  res.json(rows);
});

importRulesRouter.post("/", async (req, res) => {
  const match_type = String(req.body?.match_type || "contains").toLowerCase();
  if (!MATCH_TYPES.has(match_type)) {
    return res.status(400).json({ error: "match_type must be contains, starts_with, or exact" });
  }
  const pattern = String(req.body?.pattern || "").trim();
  if (!pattern) return res.status(400).json({ error: "pattern is required" });
  const category = parseCategory(req.body?.category);
  if (!category) return res.status(400).json({ error: CATEGORY_ERROR });
  let renewal_kind = null;
  if (category === "renewal") {
    renewal_kind = parseRenewalKind(req.body?.renewal_kind);
    if (!renewal_kind) return res.status(400).json({ error: RENEWAL_KIND_ERROR });
  }
  const sort_order = Number(req.body?.sort_order);
  const so = Number.isFinite(sort_order) ? Math.trunc(sort_order) : 0;

  const { rows } = await pool.query(
    `INSERT INTO import_category_rules (user_id, match_type, pattern, category, renewal_kind, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, match_type, pattern, category, renewal_kind, sort_order, created_at`,
    [req.userId, match_type, pattern, category, renewal_kind, so]
  );
  res.status(201).json(rows[0]);
});

importRulesRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

  const { rows: existingRows } = await pool.query(
    `SELECT category, renewal_kind FROM import_category_rules WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: "Not found" });

  let nextCat = existing.category;
  if (req.body?.category !== undefined) {
    const c = parseCategory(req.body.category);
    if (!c) return res.status(400).json({ error: CATEGORY_ERROR });
    nextCat = c;
  }

  let nextRk = existing.renewal_kind;
  if (req.body?.category !== undefined && nextCat !== "renewal") {
    nextRk = null;
  }
  if (req.body?.renewal_kind !== undefined && nextCat === "renewal") {
    const raw = req.body.renewal_kind;
    if (raw === null || String(raw).trim() === "") {
      nextRk = null;
    } else {
      const rk = parseRenewalKind(raw);
      if (!rk) return res.status(400).json({ error: RENEWAL_KIND_ERROR });
      nextRk = rk;
    }
  }
  if (nextCat === "renewal" && !nextRk) {
    return res.status(400).json({ error: "Renewal rules require renewal_kind" });
  }

  const sets = [];
  const params = [];
  let n = 1;

  if (req.body?.match_type !== undefined) {
    const mt = String(req.body.match_type || "").toLowerCase();
    if (!MATCH_TYPES.has(mt)) {
      return res.status(400).json({ error: "match_type must be contains, starts_with, or exact" });
    }
    sets.push(`match_type = $${n++}`);
    params.push(mt);
  }
  if (req.body?.pattern !== undefined) {
    const pattern = String(req.body.pattern || "").trim();
    if (!pattern) return res.status(400).json({ error: "pattern cannot be empty" });
    sets.push(`pattern = $${n++}`);
    params.push(pattern);
  }
  if (req.body?.category !== undefined) {
    sets.push(`category = $${n++}`);
    params.push(nextCat);
    if (nextCat !== "renewal") {
      sets.push(`renewal_kind = NULL`);
    }
  }
  if (req.body?.renewal_kind !== undefined && nextCat === "renewal") {
    if (nextRk === null) {
      sets.push(`renewal_kind = NULL`);
    } else {
      sets.push(`renewal_kind = $${n++}`);
      params.push(nextRk);
    }
  }
  if (req.body?.sort_order !== undefined) {
    const sort_order = Number(req.body.sort_order);
    if (!Number.isFinite(sort_order)) return res.status(400).json({ error: "Invalid sort_order" });
    sets.push(`sort_order = $${n++}`);
    params.push(Math.trunc(sort_order));
  }

  if (!sets.length) return res.status(400).json({ error: "No updates" });

  params.push(id, req.userId);
  const { rows } = await pool.query(
    `UPDATE import_category_rules SET ${sets.join(", ")}
     WHERE id = $${n++} AND user_id = $${n}
     RETURNING id, match_type, pattern, category, renewal_kind, sort_order, created_at`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

importRulesRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const del = await pool.query(`DELETE FROM import_category_rules WHERE id = $1 AND user_id = $2`, [
    id,
    req.userId,
  ]);
  if (!del.rowCount) return res.status(404).json({ error: "Not found" });
  res.status(204).send();
});
