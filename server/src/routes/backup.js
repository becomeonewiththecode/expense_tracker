import { Router } from "express";
import express from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import {
  parseCategory,
  parseExpenseState,
  parseFinancialInstitution,
  parseFrequency,
  parseRenewalKind,
  parseWebsite,
  CATEGORY_ERROR,
  STATE_ERROR,
  paymentMetaFromSpentAt,
} from "../expenseEnums.js";
import {
  decryptRecoveryStored,
  isPlausibleRecoveryCode,
  persistRecoveryCodeForUser,
} from "../recoveryCodeStorage.js";
import {
  parsePrescriptionCategory,
  parseRenewalPeriod,
  parsePrescriptionState,
  parseIsoDate,
  PRESCRIPTION_CATEGORY_ERROR,
  PRESCRIPTION_RENEWAL_PERIOD_ERROR,
  PRESCRIPTION_STATE_ERROR,
} from "../prescriptionEnums.js";

export const BACKUP_FORMAT = "expense-tracker-backup";
/** v1: expenses only. v2: adds `prescriptions`, `renewalCount`, `prescriptionCount`. */
export const BACKUP_VERSION = 2;
export const BACKUP_VERSIONS_SUPPORTED = [1, 2];
const MAX_RESTORE_ROWS = 25_000;

export const backupRouter = Router();

function parseDate(d) {
  if (!d) return null;
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T\s]/);
  if (m) return m[1];
  return null;
}

/**
 * PostgreSQL DATE columns often arrive as JS Date objects. Never use String(date).slice(0,10)
 * (that yields locale strings like "Mon Mar 30").
 * @param {unknown} value
 * @returns {string | null}
 */
function normalizePgDateForBackup(value) {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

/**
 * Accept YYYY-MM-DD plus values from older broken exports (bad slice of Date string).
 * @param {unknown} raw
 * @returns {string | null}
 */
function parsePrescriptionNextRenewalForRestore(raw) {
  const strict = parseIsoDate(raw);
  if (strict) return strict;
  if (raw == null || raw === "") return null;
  const t = Date.parse(String(raw));
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  return null;
}

function normalizeExpenseRow(row) {
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
    amount: row.amount != null ? Number(row.amount) : row.amount,
    category: row.category,
    financial_institution: row.financial_institution,
    frequency: row.frequency,
    state: row.state === "cancel" ? "cancel" : "active",
    payment_day: row.payment_day != null ? Number(row.payment_day) : null,
    payment_month: row.payment_month != null ? Number(row.payment_month) : null,
    description: row.description ?? "",
    website: row.website != null && String(row.website).trim() !== "" ? String(row.website).trim() : null,
    renewal_kind: row.renewal_kind ?? null,
    spent_at,
  };
}

function normalizePrescriptionRow(row) {
  return {
    name: row.name ?? "",
    amount: row.amount != null ? Number(row.amount) : 0,
    renewal_period: row.renewal_period,
    next_renewal_date: normalizePgDateForBackup(row.next_renewal_date),
    vendor: row.vendor ?? "",
    notes: row.notes ?? "",
    category: row.category,
    state: row.state === "cancel" ? "cancel" : "active",
  };
}

/**
 * @param {unknown} raw
 * @param {number} index
 * @returns {{ ok: true, values: object } | { ok: false, error: string }}
 */
function validatePrescriptionForRestore(raw, index) {
  const label = `Prescription ${index + 1}`;
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: `${label}: invalid object` };
  }
  const name = String(raw.name || "").trim().slice(0, 200);
  if (!name) {
    return { ok: false, error: `${label}: name is required` };
  }
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: `${label}: invalid amount` };
  }
  const renewal_period = parseRenewalPeriod(raw.renewal_period);
  if (!renewal_period) {
    return { ok: false, error: `${label}: ${PRESCRIPTION_RENEWAL_PERIOD_ERROR}` };
  }
  const next_renewal_date = parsePrescriptionNextRenewalForRestore(raw.next_renewal_date);
  if (!next_renewal_date) {
    return { ok: false, error: `${label}: invalid next_renewal_date (use YYYY-MM-DD)` };
  }
  const vendor = String(raw.vendor ?? "").trim().slice(0, 200);
  const notes = String(raw.notes ?? "").slice(0, 2000);
  const category = parsePrescriptionCategory(raw.category);
  if (!category) {
    return { ok: false, error: `${label}: ${PRESCRIPTION_CATEGORY_ERROR}` };
  }
  let state = "active";
  if (raw.state !== undefined && raw.state !== null && String(raw.state).trim() !== "") {
    const parsed = parsePrescriptionState(raw.state);
    if (!parsed) {
      return { ok: false, error: `${label}: ${PRESCRIPTION_STATE_ERROR}` };
    }
    state = parsed;
  }
  return {
    ok: true,
    values: {
      name,
      amount,
      renewal_period,
      next_renewal_date,
      vendor,
      notes,
      category,
      state,
    },
  };
}

/**
 * @param {unknown} raw
 * @param {number} index
 * @returns {{ ok: true, values: object } | { ok: false, error: string }}
 */
function validateExpenseForRestore(raw, index) {
  const label = `Expense ${index + 1}`;
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: `${label}: invalid object` };
  }
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: `${label}: invalid amount` };
  }
  const category = parseCategory(raw.category);
  if (!category) {
    return { ok: false, error: `${label}: ${CATEGORY_ERROR}` };
  }
  const financial_institution = parseFinancialInstitution(raw.financial_institution);
  if (!financial_institution) {
    return {
      ok: false,
      error: `${label}: invalid financial institution`,
    };
  }
  const frequency = parseFrequency(raw.frequency);
  if (!frequency) {
    return { ok: false, error: `${label}: invalid frequency` };
  }
  const spent_at = parseDate(raw.spent_at) || new Date().toISOString().slice(0, 10);
  const { payment_day, payment_month } = paymentMetaFromSpentAt(spent_at);
  const description = String(raw.description ?? "").slice(0, 500);
  let state = "active";
  if (raw.state !== undefined && raw.state !== null && String(raw.state).trim() !== "") {
    const parsed = parseExpenseState(raw.state);
    if (!parsed) {
      return { ok: false, error: `${label}: ${STATE_ERROR}` };
    }
    state = parsed;
  }
  const website = parseWebsite(raw.website);
  let renewal_kind = null;
  if (category === "renewal") {
    renewal_kind = parseRenewalKind(raw.renewal_kind);
    if (!renewal_kind) {
      return {
        ok: false,
        error: `${label}: renewal category requires a valid renewal_kind (renewal type)`,
      };
    }
  } else if (raw.renewal_kind != null && String(raw.renewal_kind).trim() !== "") {
    return { ok: false, error: `${label}: renewal_kind is only allowed when category is renewal` };
  }
  return {
    ok: true,
    values: {
      amount,
      category,
      financial_institution,
      frequency,
      state,
      payment_day,
      payment_month,
      description,
      website,
      renewal_kind,
      spent_at,
    },
  };
}

function normalizeEmailForCompare(s) {
  return String(s ?? "").trim().toLowerCase();
}

backupRouter.get("/export", authRequired, async (req, res) => {
  try {
    const { rows: userRows } = await pool.query(
      `SELECT id, email, recovery_code_ciphertext,
        (recovery_lookup IS NOT NULL) AS has_recovery_code
       FROM users WHERE id = $1`,
      [req.userId]
    );
    const userRow = userRows[0];
    const userId = userRow?.id ?? req.userId;
    const email = userRow?.email ?? null;
    const hasRecoveryCode = Boolean(userRow?.has_recovery_code);
    const recoveryPlain =
      userRow?.recovery_code_ciphertext && hasRecoveryCode
        ? decryptRecoveryStored(userRow.recovery_code_ciphertext, userId)
        : null;
    const { rows } = await pool.query(
      `SELECT amount, category, financial_institution, frequency, state, payment_day, payment_month, description, website, renewal_kind, spent_at
       FROM expenses WHERE user_id = $1
       ORDER BY spent_at ASC, id ASC`,
      [req.userId]
    );
    const expenses = rows.map(normalizeExpenseRow);
    const renewalCount = expenses.filter((e) => e.category === "renewal").length;

    const { rows: prescRows } = await pool.query(
      `SELECT name, amount, renewal_period, next_renewal_date, vendor, notes, category, state
       FROM prescriptions WHERE user_id = $1
       ORDER BY next_renewal_date ASC, id ASC`,
      [req.userId]
    );
    const prescriptions = prescRows.map(normalizePrescriptionRow);

    const accountLabel = email
      ? `${email} (user id ${userId})`
      : `User id ${userId}`;
    const payload = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      email, // legacy top-level; same as account.email when present
      account: {
        userId,
        email,
        label: accountLabel,
        hasRecoveryCode,
        ...(recoveryPlain ? { recoveryCode: recoveryPlain } : {}),
      },
      expenseCount: expenses.length,
      renewalCount,
      expenses,
      prescriptionCount: prescriptions.length,
      prescriptions,
    };
    const day = new Date().toISOString().slice(0, 10);
    const fileTag = email
      ? String(email)
          .replace(/[^a-zA-Z0-9._+-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80) || `user-${userId}`
      : `user-${userId}`;
    const filename = `expense-tracker-backup-${fileTag}-${day}.json`;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.json(payload);
  } catch (e) {
    console.error("backup/export:", e);
    res.status(500).json({ error: "Export failed" });
  }
});

backupRouter.post(
  "/restore",
  express.json({ limit: "15mb" }),
  authRequired,
  async (req, res) => {
    const mode = String(req.body?.mode || "").toLowerCase();
    if (mode !== "append" && mode !== "replace") {
      return res.status(400).json({ error: 'mode must be "append" or "replace"' });
    }
    const body = req.body;
    const fileVersion = Number(body?.version);
    if (body?.format !== BACKUP_FORMAT || !Number.isFinite(fileVersion) || !BACKUP_VERSIONS_SUPPORTED.includes(fileVersion)) {
      return res.status(400).json({
        error: `Invalid backup file. Expected format "${BACKUP_FORMAT}" and version ${BACKUP_VERSIONS_SUPPORTED.join(" or ")}.`,
      });
    }
    const expenses = body?.expenses;
    if (!Array.isArray(expenses)) {
      return res.status(400).json({ error: "Backup must contain an expenses array" });
    }
    if (expenses.length > MAX_RESTORE_ROWS) {
      return res.status(400).json({
        error: `Too many expenses in file (max ${MAX_RESTORE_ROWS})`,
      });
    }

    let prescriptionsRaw = [];
    if (fileVersion >= 2) {
      if (body.prescriptions !== undefined && !Array.isArray(body.prescriptions)) {
        return res.status(400).json({ error: "Backup must contain a prescriptions array (use [] if none)" });
      }
      prescriptionsRaw = Array.isArray(body.prescriptions) ? body.prescriptions : [];
      if (prescriptionsRaw.length > MAX_RESTORE_ROWS) {
        return res.status(400).json({
          error: `Too many prescriptions in file (max ${MAX_RESTORE_ROWS})`,
        });
      }
    }

    const backupEmail = body?.account?.email ?? body?.email ?? null;
    const { rows: meRows } = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.userId]);
    const currentEmail = meRows[0]?.email ?? null;
    if (
      backupEmail &&
      currentEmail &&
      normalizeEmailForCompare(backupEmail) !== normalizeEmailForCompare(currentEmail) &&
      !req.body?.confirmCrossAccountRestore
    ) {
      return res.status(409).json({
        error:
          "This backup was exported for a different account. Open the JSON and check account.email, or sign in as that user. To import into this account anyway, confirm with confirmCrossAccountRestore.",
        backupEmail,
        currentEmail,
        code: "BACKUP_ACCOUNT_MISMATCH",
      });
    }

    const validated = [];
    for (let i = 0; i < expenses.length; i++) {
      const result = validateExpenseForRestore(expenses[i], i);
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }
      validated.push(result.values);
    }

    const validatedPrescriptions = [];
    for (let i = 0; i < prescriptionsRaw.length; i++) {
      const result = validatePrescriptionForRestore(prescriptionsRaw[i], i);
      if (!result.ok) {
        return res.status(400).json({ error: result.error });
      }
      validatedPrescriptions.push(result.values);
    }

    const restoredRenewals = validated.filter((v) => v.category === "renewal").length;
    const restoredExpenses = validated.length - restoredRenewals;
    const restoredPrescriptions = fileVersion >= 2 ? validatedPrescriptions.length : 0;

    let recoveryPlain = null;
    const rawRecovery = body?.account?.recoveryCode;
    if (rawRecovery !== undefined && rawRecovery !== null && String(rawRecovery).trim() !== "") {
      recoveryPlain = String(rawRecovery).trim();
      if (!isPlausibleRecoveryCode(recoveryPlain)) {
        return res.status(400).json({
          error: "Invalid account.recoveryCode in backup (expected a non-trivial string).",
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (mode === "replace") {
        await client.query(`DELETE FROM expenses WHERE user_id = $1`, [req.userId]);
        if (fileVersion >= 2) {
          await client.query(`DELETE FROM prescriptions WHERE user_id = $1`, [req.userId]);
        }
      }
      for (const v of validated) {
        await client.query(
          `INSERT INTO expenses (user_id, amount, category, financial_institution, frequency, state, payment_day, payment_month, description, website, renewal_kind, spent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            req.userId,
            v.amount,
            v.category,
            v.financial_institution,
            v.frequency,
            v.state,
            v.payment_day,
            v.payment_month,
            v.description,
            v.website,
            v.renewal_kind,
            v.spent_at,
          ]
        );
      }
      if (fileVersion >= 2) {
        for (const p of validatedPrescriptions) {
          await client.query(
            `INSERT INTO prescriptions (user_id, name, amount, renewal_period, next_renewal_date, vendor, notes, category, state)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              req.userId,
              p.name,
              p.amount,
              p.renewal_period,
              p.next_renewal_date,
              p.vendor,
              p.notes,
              p.category,
              p.state,
            ]
          );
        }
      }
      if (recoveryPlain) {
        await persistRecoveryCodeForUser(client, req.userId, recoveryPlain);
      }
      await client.query("COMMIT");
      const restoredTotal =
        validated.length + (fileVersion >= 2 ? validatedPrescriptions.length : 0);
      res.json({
        ok: true,
        mode,
        restored: restoredTotal,
        restoredBreakdown: {
          expenses: restoredExpenses,
          renewals: restoredRenewals,
          prescriptions: restoredPrescriptions,
        },
      });
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("backup/restore:", e);
      res.status(500).json({ error: "Restore failed" });
    } finally {
      client.release();
    }
  }
);
