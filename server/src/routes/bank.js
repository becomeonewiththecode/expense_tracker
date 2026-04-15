import { Router } from "express";
import { pool } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { getPlaidClient, isPlaidConfigured, plaidCountryCodes, Products } from "../plaidService.js";
import { paymentMetaFromSpentAt } from "../expenseEnums.js";
import { decryptBankToken, encryptBankToken, isEncryptedBankToken } from "../bankTokenCrypto.js";

export const bankRouter = Router();
bankRouter.use(authRequired);

const CLIENT_NAME = "Expense Tracker";

async function resolvePlainAccessToken(connId, userId, storedToken) {
  const plain = decryptBankToken(storedToken);
  if (!plain) return null;
  if (!isEncryptedBankToken(storedToken)) {
    // One-way migration: rewrite legacy plaintext token as encrypted ciphertext.
    await pool.query(`UPDATE bank_connections SET access_token = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`, [
      encryptBankToken(plain),
      connId,
      userId,
    ]);
  }
  return plain;
}

bankRouter.get("/plaid/status", (_req, res) => {
  res.json({
    configured: isPlaidConfigured(),
    env: String(process.env.PLAID_ENV || "sandbox").toLowerCase(),
  });
});

bankRouter.post("/plaid/link-token", async (req, res) => {
  const plaid = getPlaidClient();
  if (!plaid) {
    return res.status(503).json({ error: "Bank sync is not configured (missing Plaid credentials)" });
  }
  try {
    const { data } = await plaid.linkTokenCreate({
      user: { client_user_id: `user_${req.userId}` },
      client_name: CLIENT_NAME,
      products: [Products.Transactions],
      country_codes: plaidCountryCodes(),
      language: "en",
    });
    res.json({ link_token: data.link_token, expiration: data.expiration });
  } catch (e) {
    const msg = e?.response?.data?.error_message || e?.message || "Plaid error";
    console.error("linkTokenCreate:", e?.response?.data || e);
    res.status(502).json({ error: msg });
  }
});

bankRouter.post("/plaid/exchange", async (req, res) => {
  const public_token = String(req.body?.public_token || "").trim();
  if (!public_token) return res.status(400).json({ error: "public_token required" });
  const plaid = getPlaidClient();
  if (!plaid) {
    return res.status(503).json({ error: "Bank sync is not configured" });
  }
  let access_token;
  let item_id;
  try {
    const ex = await plaid.itemPublicTokenExchange({ public_token });
    access_token = ex.data.access_token;
    item_id = ex.data.item_id;
  } catch (e) {
    const msg = e?.response?.data?.error_message || e?.message || "Plaid exchange failed";
    console.error("itemPublicTokenExchange:", e?.response?.data || e);
    return res.status(502).json({ error: msg });
  }

  let institution_name = "";
  try {
    const itemResp = await plaid.itemGet({ access_token });
    const instId = itemResp.data.item.institution_id;
    if (instId) {
      const inst = await plaid.institutionsGetById({
        institution_id: instId,
        country_codes: plaidCountryCodes(),
      });
      institution_name = inst.data.institution?.name || "";
    }
  } catch (e) {
    console.warn("institution lookup failed:", e?.response?.data || e?.message);
  }

  try {
    const encryptedAccessToken = encryptBankToken(access_token);
    const existing = await pool.query(`SELECT id, user_id FROM bank_connections WHERE plaid_item_id = $1`, [
      item_id,
    ]);
    const hit = existing.rows[0];
    if (hit && hit.user_id !== req.userId) {
      return res.status(409).json({ error: "This bank link is already connected to another account" });
    }
    let row;
    if (hit) {
      const up = await pool.query(
        `UPDATE bank_connections SET access_token = $1, institution_name = COALESCE(NULLIF($2, ''), institution_name), updated_at = NOW()
         WHERE id = $3 AND user_id = $4
         RETURNING id, plaid_item_id, institution_name, created_at`,
        [encryptedAccessToken, institution_name || "", hit.id, req.userId]
      );
      row = up.rows[0];
    } else {
      const ins = await pool.query(
        `INSERT INTO bank_connections (user_id, provider, plaid_item_id, access_token, institution_name)
         VALUES ($1, 'plaid', $2, $3, $4)
         RETURNING id, plaid_item_id, institution_name, created_at`,
        [req.userId, item_id, encryptedAccessToken, institution_name || "Linked account"]
      );
      row = ins.rows[0];
    }
    res.json({
      id: row.id,
      plaid_item_id: row.plaid_item_id,
      institution_name: row.institution_name,
      created_at: row.created_at,
    });
  } catch (e) {
    console.error("bank_connections insert:", e);
    res.status(500).json({ error: "Failed to save connection" });
  }
});

bankRouter.get("/plaid/connections", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, plaid_item_id, institution_name, transactions_cursor, created_at, updated_at
     FROM bank_connections WHERE user_id = $1 ORDER BY id DESC`,
    [req.userId]
  );
  res.json(rows);
});

bankRouter.delete("/plaid/connections/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const plaid = getPlaidClient();
  const { rows } = await pool.query(
    `SELECT id, access_token FROM bank_connections WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  const row = rows[0];
  if (!row) return res.status(404).json({ error: "Not found" });
  const plainAccessToken = await resolvePlainAccessToken(id, req.userId, row.access_token);
  if (!plainAccessToken) {
    return res.status(500).json({ error: "Stored bank credential is invalid; reconnect this account" });
  }
  if (plaid) {
    try {
      await plaid.itemRemove({ access_token: plainAccessToken });
    } catch (e) {
      console.warn("itemRemove:", e?.response?.data || e?.message);
    }
  }
  await pool.query(`DELETE FROM bank_connections WHERE id = $1 AND user_id = $2`, [id, req.userId]);
  res.json({ ok: true });
});

bankRouter.post("/plaid/connections/:id/sync", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
  const plaid = getPlaidClient();
  if (!plaid) {
    return res.status(503).json({ error: "Bank sync is not configured" });
  }
  const { rows } = await pool.query(
    `SELECT id, user_id, access_token, transactions_cursor FROM bank_connections WHERE id = $1 AND user_id = $2`,
    [id, req.userId]
  );
  const conn = rows[0];
  if (!conn) return res.status(404).json({ error: "Not found" });
  const plainAccessToken = await resolvePlainAccessToken(id, req.userId, conn.access_token);
  if (!plainAccessToken) {
    return res.status(500).json({ error: "Stored bank credential is invalid; reconnect this account" });
  }

  let cursor = conn.transactions_cursor || undefined;
  let inserted = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data } = await plaid.transactionsSync({
        access_token: plainAccessToken,
        cursor,
      });
      for (const t of data.added || []) {
        if (t.pending) continue;
        if (t.amount <= 0) continue;
        const bank_import_ref = `plaid:${t.transaction_id}`;
        const spent_at = String(t.date || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(spent_at)) continue;
        const amount = Number(t.amount);
        if (!Number.isFinite(amount) || amount < 0) continue;
        const description = String(t.merchant_name || t.name || "Transaction").slice(0, 500);
        const { payment_day, payment_month } = paymentMetaFromSpentAt(spent_at);
        const ins = await pool.query(
          `INSERT INTO expenses (user_id, amount, category, financial_institution, frequency, state, payment_day, payment_day_2, payment_month, description, website, renewal_kind, spent_at, bank_import_ref)
           VALUES ($1, $2, 'personal', 'bank', 'once', 'active', $3, NULL, $4, $5, NULL, NULL, $6, $7)
           ON CONFLICT (user_id, bank_import_ref) DO NOTHING`,
          [req.userId, amount, payment_day, payment_month, description, spent_at, bank_import_ref]
        );
        if (ins.rowCount > 0) inserted += ins.rowCount;
      }
      cursor = data.next_cursor;
      hasMore = Boolean(data.has_more);
      await pool.query(`UPDATE bank_connections SET transactions_cursor = $1, updated_at = NOW() WHERE id = $2`, [
        cursor || null,
        id,
      ]);
    }
    res.json({ ok: true, inserted, cursor_saved: Boolean(cursor) });
  } catch (e) {
    const msg = e?.response?.data?.error_message || e?.message || "Sync failed";
    console.error("transactionsSync:", e?.response?.data || e);
    res.status(502).json({ error: msg });
  }
});
