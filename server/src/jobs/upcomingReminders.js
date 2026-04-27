import cron from "node-cron";
import { pool } from "../db.js";
import { sendEmail } from "../email.js";
import { upcomingExpensesEmail, upcomingPrescriptionsEmail } from "../emailTemplates.js";

const REMINDER_DAYS = [3, 5, 7];

// --- Renewal date math (mirrors client renewalSchedule.js) ---

function spentAtToIso(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseIso(iso) {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  return new Date(y, mo, d);
}

function sod(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dim(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function clamp(y, m, day) {
  return Math.min(Math.max(1, Number(day)), dim(y, m));
}

function addMonths(d, delta) {
  const r = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  r.setDate(Math.min(d.getDate(), dim(r.getFullYear(), r.getMonth())));
  return sod(r);
}

function isoStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextRenewalDate(expense, from) {
  const freq = String(expense.frequency ?? "monthly").toLowerCase().trim();
  if (freq === "once") return null;
  const iso = spentAtToIso(expense.spent_at);
  if (!iso) return null;
  const spent = parseIso(iso);
  if (!spent) return null;
  const fromS = sod(from);
  const day = Math.min(30, Math.max(1, spent.getDate()));

  if (freq === "weekly") {
    let cur = sod(spent);
    while (cur < fromS) cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
    return cur;
  }
  if (freq === "monthly") {
    const y = fromS.getFullYear(), m = fromS.getMonth();
    const cand = new Date(y, m, clamp(y, m, day));
    return cand < fromS ? addMonths(cand, 1) : cand;
  }
  if (freq === "bimonthly") {
    const day2 = expense.payment_day_2 != null ? Math.min(30, Math.max(1, Number(expense.payment_day_2))) : null;
    const days = [...new Set([day, ...(day2 != null ? [day2] : [])])].sort((a, b) => a - b);
    let y = fromS.getFullYear(), m = fromS.getMonth();
    for (let g = 0; g < 60; g++) {
      for (const d of days) {
        const cand = new Date(y, m, clamp(y, m, d));
        if (cand >= fromS) return cand;
      }
      if (++m > 11) { m = 0; y++; }
    }
    return null;
  }
  if (freq === "yearly") {
    const mi = spent.getMonth();
    let y = fromS.getFullYear();
    let cand = new Date(y, mi, clamp(y, mi, day));
    if (cand < fromS) cand = new Date(++y, mi, clamp(y, mi, day));
    return cand;
  }
  return null;
}

// --- Job ---

async function runReminders() {
  const now = new Date();
  const today = sod(now);

  // Map of ISO date string → daysUntil for each target
  const targetDays = new Map(
    REMINDER_DAYS.map(n => {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
      return [isoStr(d), n];
    })
  );
  const targetDates = [...targetDays.keys()];

  try {
    // === EXPENSES ===
    const { rows: expenses } = await pool.query(`
      SELECT id, user_id, description, amount, financial_institution, bank_name,
             frequency, spent_at, payment_day_2
      FROM expenses
      WHERE state = 'active' AND frequency <> 'once'
    `);

    const expByUser = new Map();
    for (const exp of expenses) {
      const next = nextRenewalDate(exp, now);
      if (!next) continue;
      const nextIso = isoStr(next);
      if (!targetDays.has(nextIso)) continue;
      const daysUntil = targetDays.get(nextIso);
      if (!expByUser.has(exp.user_id)) expByUser.set(exp.user_id, []);
      expByUser.get(exp.user_id).push({
        id: exp.id,
        description: exp.description || "Expense",
        amount: exp.amount,
        institution: exp.financial_institution,
        bankName: exp.bank_name,
        renewsOn: nextIso,
        daysUntil,
      });
    }

    for (const [userId, items] of expByUser) {
      const dedupeKeys = items.map(i => `expense_due:${i.id}:${i.renewsOn}:${i.daysUntil}`);

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const key = dedupeKeys[idx];
        const title = `${item.description} due in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`;
        const body = `$${Number(item.amount).toFixed(2)} — renews on ${item.renewsOn}`;
        await pool.query(
          `INSERT INTO user_notifications (user_id, kind, title, body, dedupe_key)
           VALUES ($1, 'expense_due', $2, $3, $4)
           ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
          [userId, title, body, key]
        );
      }

      const { rows: unsent } = await pool.query(
        `SELECT dedupe_key FROM user_notifications
         WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
        [userId, dedupeKeys]
      );
      if (unsent.length === 0) continue;

      const { rows: users } = await pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
      const email = users[0]?.email;
      if (!email) continue;

      const unsentKeys = new Set(unsent.map(r => r.dedupe_key));
      const itemsToSend = items.filter((item, idx) => unsentKeys.has(dedupeKeys[idx]));

      const tpl = upcomingExpensesEmail(email, itemsToSend);
      await sendEmail({ to: email, ...tpl });

      await pool.query(
        `UPDATE user_notifications SET email_sent_at = NOW()
         WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
        [userId, dedupeKeys]
      );
    }

    // === PRESCRIPTIONS ===
    const { rows: rxRows } = await pool.query(
      `SELECT p.id, p.user_id, p.name, p.category, p.next_renewal_date::text AS next_renewal_date, u.email
       FROM prescriptions p
       JOIN users u ON u.id = p.user_id
       WHERE p.state = 'active' AND p.next_renewal_date::text = ANY($1)`,
      [targetDates]
    );

    const rxByUser = new Map();
    for (const rx of rxRows) {
      if (!rx.email) continue;
      const renewsOn = rx.next_renewal_date;
      const daysUntil = targetDays.get(renewsOn);
      if (daysUntil == null) continue;
      if (!rxByUser.has(rx.user_id)) rxByUser.set(rx.user_id, { email: rx.email, items: [] });
      rxByUser.get(rx.user_id).items.push({ id: rx.id, name: rx.name, category: rx.category, renewsOn, daysUntil });
    }

    for (const [userId, { email, items }] of rxByUser) {
      const dedupeKeys = items.map(i => `prescription_due:${i.id}:${i.renewsOn}:${i.daysUntil}`);

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const key = dedupeKeys[idx];
        const title = `${item.name} prescription renewal in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`;
        const body = `Renewal date: ${item.renewsOn}`;
        await pool.query(
          `INSERT INTO user_notifications (user_id, kind, title, body, dedupe_key)
           VALUES ($1, 'prescription_due', $2, $3, $4)
           ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
          [userId, title, body, key]
        );
      }

      const { rows: unsent } = await pool.query(
        `SELECT dedupe_key FROM user_notifications
         WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
        [userId, dedupeKeys]
      );
      if (unsent.length === 0) continue;

      const unsentKeys = new Set(unsent.map(r => r.dedupe_key));
      const itemsToSend = items.filter((item, idx) => unsentKeys.has(dedupeKeys[idx]));

      const tpl = upcomingPrescriptionsEmail(email, itemsToSend);
      await sendEmail({ to: email, ...tpl });

      await pool.query(
        `UPDATE user_notifications SET email_sent_at = NOW()
         WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
        [userId, dedupeKeys]
      );
    }

    console.log(`Upcoming reminders: ${expenses.length} expenses scanned, ${rxRows.length} prescription renewals found`);
  } catch (e) {
    console.error("Upcoming reminders job failed", e);
  }
}

export function startUpcomingRemindersJob() {
  cron.schedule("0 8 * * *", runReminders);
}
