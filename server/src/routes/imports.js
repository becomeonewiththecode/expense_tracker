import { Router } from "express";
import multer from "multer";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { parseVisaStatementFile } from "../parsers/visaStatement.js";
import {
  parseCategory,
  parseFinancialInstitution,
  parseFrequency,
  parseRenewalKind,
  parseWebsite,
  CATEGORY_ERROR,
  RENEWAL_KIND_ERROR,
  paymentMetaFromSpentAt,
} from "../expenseEnums.js";

export const importsRouter = Router();
importsRouter.use(authRequired);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function uploadMiddleware(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err?.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 8 MB)" });
    }
    if (err) return next(err);
    next();
  });
}

/** Upload statement → replace any prior staging for this user; rows start with category NULL. */
importsRouter.post("/", uploadMiddleware, async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: "No file uploaded (field name: file)" });
  }
  const lower = (req.file.originalname || "").toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".pdf")) {
    return res.status(400).json({ error: "Upload a .csv or .pdf statement" });
  }

  const financial_institution =
    parseFinancialInstitution(req.body?.financial_institution || "visa") || "visa";
  const frequency = parseFrequency(req.body?.frequency || "once") || "once";

  let transactions;
  let warnings;
  try {
    const parsed = await parseVisaStatementFile(req.file);
    transactions = parsed.transactions;
    warnings = parsed.warnings;
  } catch (e) {
    console.error("statement parse error:", e);
    return res.status(400).json({
      error: e?.message || "Could not read or parse the uploaded file",
      warnings: [],
    });
  }

  if (!transactions.length) {
    return res.status(422).json({
      warnings,
      error:
        warnings.join(" ") ||
        "No transactions found. Try CSV export from your bank, or another PDF.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM import_batches WHERE user_id = $1`, [req.userId]);

    const {
      rows: [batch],
    } = await client.query(
      `INSERT INTO import_batches (user_id, source_filename, default_financial_institution, default_frequency)
       VALUES ($1, $2, $3, $4)
       RETURNING id, source_filename, default_financial_institution, default_frequency, created_at`,
      [req.userId, req.file.originalname || "", financial_institution, frequency]
    );

    const inserted = [];
    for (const t of transactions) {
      const { payment_day, payment_month } = paymentMetaFromSpentAt(t.spent_at);
      const { rows } = await client.query(
        `INSERT INTO import_staging_rows (batch_id, user_id, spent_at, amount, description, category, frequency, payment_day, payment_month, website, renewal_kind)
         VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, NULL, NULL)
         RETURNING id, spent_at, amount, description, category, frequency, payment_day, payment_month, website, renewal_kind`,
        [batch.id, req.userId, t.spent_at, t.amount, t.description, frequency, payment_day, payment_month]
      );
      inserted.push(normalizeStagingRow(rows[0]));
    }

    await client.query("COMMIT");
    res.status(201).json({
      batch: {
        id: batch.id,
        source_filename: batch.source_filename,
        default_financial_institution: batch.default_financial_institution,
        default_frequency: batch.default_frequency,
        created_at: batch.created_at,
      },
      rows: inserted,
      warnings,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("import staging error:", e);
    return res.status(500).json({ error: "Could not save import for review" });
  } finally {
    client.release();
  }
});

importsRouter.get("/latest", async (req, res) => {
  const { rows: batches } = await pool.query(
    `SELECT id, source_filename, default_financial_institution, default_frequency, created_at
     FROM import_batches WHERE user_id = $1 ORDER BY id DESC LIMIT 1`,
    [req.userId]
  );
  if (!batches[0]) {
    return res.json(null);
  }
  const batch = batches[0];
  const { rows } = await pool.query(
    `SELECT id, spent_at, amount, description, category, frequency, payment_day, payment_month, website, renewal_kind
     FROM import_staging_rows WHERE batch_id = $1 AND user_id = $2 ORDER BY id`,
    [batch.id, req.userId]
  );
  res.json({
    batch,
    rows: rows.map(normalizeStagingRow),
  });
});

importsRouter.patch("/rows/:rowId", async (req, res) => {
  const rowId = Number(req.params.rowId);
  if (!Number.isFinite(rowId)) {
    return res.status(400).json({ error: "Invalid row id" });
  }

  const sets = [];
  const params = [];
  let next = 1;

  if (Object.prototype.hasOwnProperty.call(req.body, "category")) {
    const raw = req.body.category;
    let category = null;
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      category = parseCategory(raw);
      if (!category) {
        return res.status(400).json({ error: CATEGORY_ERROR });
      }
    } else {
      category = null;
    }
    sets.push(`category = $${next++}`);
    params.push(category);
    if (category !== "renewal") {
      sets.push(`renewal_kind = NULL`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "renewal_kind")) {
    const raw = req.body.renewal_kind;
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      sets.push(`renewal_kind = NULL`);
    } else {
      const rk = parseRenewalKind(raw);
      if (!rk) {
        return res.status(400).json({ error: RENEWAL_KIND_ERROR });
      }
      sets.push(`renewal_kind = $${next++}`);
      params.push(rk);
    }
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "website")) {
    sets.push(`website = $${next++}`);
    params.push(parseWebsite(req.body.website));
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "frequency")) {
    const frequency = parseFrequency(req.body.frequency);
    if (!frequency) {
      return res.status(400).json({
        error: "Invalid frequency (use once, weekly, monthly, bimonthly, yearly)",
      });
    }
    sets.push(`frequency = $${next++}`);
    params.push(frequency);
  }

  if (!sets.length) {
    return res.status(400).json({
      error: "Provide category, frequency, renewal_kind, and/or website to update",
    });
  }

  sets.push(
    `payment_day = LEAST(30, GREATEST(1, EXTRACT(DAY FROM spent_at)::int))`,
    `payment_month = EXTRACT(MONTH FROM spent_at)::int`
  );

  params.push(rowId, req.userId);
  const { rows } = await pool.query(
    `UPDATE import_staging_rows SET ${sets.join(", ")}
     WHERE id = $${next++} AND user_id = $${next}
     RETURNING id, spent_at, amount, description, category, frequency, payment_day, payment_month, website, renewal_kind`,
    params
  );
  if (!rows[0]) {
    return res.status(404).json({ error: "Staging row not found" });
  }
  res.json(normalizeStagingRow(rows[0]));
});

importsRouter.post("/batches/:batchId/commit", async (req, res) => {
  const batchId = Number(req.params.batchId);
  if (!Number.isFinite(batchId)) {
    return res.status(400).json({ error: "Invalid batch id" });
  }

  const { rows: check } = await pool.query(
    `SELECT id, default_financial_institution FROM import_batches
     WHERE id = $1 AND user_id = $2`,
    [batchId, req.userId]
  );
  if (!check[0]) {
    return res.status(404).json({ error: "Import batch not found" });
  }
  const { default_financial_institution } = check[0];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: toInsert } = await client.query(
      `SELECT s.id, s.spent_at, s.amount, s.description, s.category,
              COALESCE(s.frequency, b.default_frequency) AS frequency,
              s.website, s.renewal_kind
       FROM import_staging_rows s
       JOIN import_batches b ON b.id = s.batch_id
       WHERE s.batch_id = $1 AND s.user_id = $2 AND s.category IS NOT NULL
         AND (s.category <> 'renewal' OR s.renewal_kind IS NOT NULL)`,
      [batchId, req.userId]
    );

    const { rows: skippedRows } = await client.query(
      `SELECT COUNT(*)::int AS c FROM import_staging_rows
       WHERE batch_id = $1 AND user_id = $2
         AND (category IS NULL OR (category = 'renewal' AND renewal_kind IS NULL))`,
      [batchId, req.userId]
    );
    const skipped = skippedRows[0]?.c ?? 0;

    let added = 0;
    for (const t of toInsert) {
      const { payment_day, payment_month } = paymentMetaFromSpentAt(t.spent_at);
      await client.query(
        `INSERT INTO expenses (user_id, amount, category, financial_institution, frequency, state, payment_day, payment_month, description, website, renewal_kind, spent_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10, $11)`,
        [
          req.userId,
          t.amount,
          t.category,
          default_financial_institution,
          t.frequency,
          payment_day,
          payment_month,
          t.description,
          t.category === "renewal" ? t.website ?? null : null,
          t.category === "renewal" ? t.renewal_kind ?? null : null,
          t.spent_at,
        ]
      );
      added++;
    }

    await client.query(`DELETE FROM import_batches WHERE id = $1 AND user_id = $2`, [
      batchId,
      req.userId,
    ]);

    await client.query("COMMIT");
    res.json({ added, skipped, message: skipped ? `${skipped} row(s) had no category and were not imported.` : null });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("commit import error:", e);
    return res.status(500).json({ error: "Could not commit import" });
  } finally {
    client.release();
  }
});

importsRouter.delete("/batches/:batchId", async (req, res) => {
  const batchId = Number(req.params.batchId);
  if (!Number.isFinite(batchId)) {
    return res.status(400).json({ error: "Invalid batch id" });
  }
  const { rowCount } = await pool.query(
    `DELETE FROM import_batches WHERE id = $1 AND user_id = $2`,
    [batchId, req.userId]
  );
  if (!rowCount) {
    return res.status(404).json({ error: "Import batch not found" });
  }
  res.status(204).send();
});

function normalizeStagingRow(row) {
  return {
    ...row,
    amount: row.amount != null ? Number(row.amount) : row.amount,
    category: row.category ?? null,
    frequency: row.frequency ?? null,
    payment_day: row.payment_day != null ? Number(row.payment_day) : null,
    payment_month: row.payment_month != null ? Number(row.payment_month) : null,
    website: row.website ?? null,
    renewal_kind: row.renewal_kind ?? null,
  };
}
