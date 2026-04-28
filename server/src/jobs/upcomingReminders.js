import cron from "node-cron";
import { pool } from "../db.js";
import { sendEmail } from "../email.js";
import { upcomingExpensesEmail, upcomingPrescriptionsEmail } from "../emailTemplates.js";
import { isoStr, nextRenewalDate, getHourInTz, getUserTodayIso } from "../renewalDateUtils.js";

const REMINDER_DAYS = [3, 5, 7];
const REMINDER_HOUR = 8;

/** Build a Map of ISO date string -> daysUntil for 3/5/7 days from todayIso. */
function buildTargetDays(todayIso) {
  const [y, m, d] = todayIso.split("-").map(Number);
  return new Map(
    REMINDER_DAYS.map(n => {
      const date = new Date(y, m - 1, d + n);
      return [isoStr(date), n];
    })
  );
}

async function runReminders() {
  const now = new Date();

  try {
    // Load all active recurring expenses with next renewal dates
    const { rows: expenses } = await pool.query(`
      SELECT id, user_id, description, amount, financial_institution, bank_name,
             frequency, spent_at::text AS spent_at, payment_day_2
      FROM expenses
      WHERE state = 'active' AND frequency <> 'once'
    `);

    const expByUser = new Map();
    for (const exp of expenses) {
      const next = nextRenewalDate(exp, now);
      if (!next) continue;
      if (!expByUser.has(exp.user_id)) expByUser.set(exp.user_id, []);
      expByUser.get(exp.user_id).push({ ...exp, nextIso: isoStr(next) });
    }

    // Load all active prescriptions (no date filter — filter per-user below)
    const { rows: allRxRows } = await pool.query(`
      SELECT p.id, p.user_id, p.name, p.category,
             p.next_renewal_date::text AS next_renewal_date
      FROM prescriptions p
      WHERE p.state = 'active'
    `);

    const rxByUser = new Map();
    for (const rx of allRxRows) {
      if (!rx.next_renewal_date) continue;
      if (!rxByUser.has(rx.user_id)) rxByUser.set(rx.user_id, []);
      rxByUser.get(rx.user_id).push(rx);
    }

    // Fetch all affected users with their preferences
    const allUserIds = [...new Set([...expByUser.keys(), ...rxByUser.keys()])];
    if (allUserIds.length === 0) return;

    const { rows: userRows } = await pool.query(
      `SELECT id, COALESCE(notification_email, email) AS email, expense_reminder_days, notification_timezone
       FROM users WHERE id = ANY($1)`,
      [allUserIds]
    );

    for (const user of userRows) {
      const tz = user.notification_timezone || "UTC";

      // Only process this user if it is currently the reminder hour in their timezone
      if (getHourInTz(now, tz) !== REMINDER_HOUR) continue;

      const todayIso = getUserTodayIso(now, tz);
      const targetDays = buildTargetDays(todayIso);

      const email = user.email;
      if (!email) continue;

      const reminderDays = Array.isArray(user.expense_reminder_days) && user.expense_reminder_days.length
        ? user.expense_reminder_days.map(Number)
        : [3, 5, 7];

      // === EXPENSES ===
      const userExps = expByUser.get(user.id) || [];
      const matchedExps = [];
      for (const exp of userExps) {
        const daysUntil = targetDays.get(exp.nextIso);
        if (daysUntil == null) continue;
        matchedExps.push({
          id: exp.id,
          description: exp.description || "Expense",
          amount: exp.amount,
          institution: exp.financial_institution,
          bankName: exp.bank_name,
          renewsOn: exp.nextIso,
          daysUntil,
        });
      }

      if (matchedExps.length > 0) {
        const dedupeKeys = matchedExps.map(i => `expense_due:${i.id}:${i.renewsOn}:${i.daysUntil}`);

        // Always create in-app notifications for all matched days
        for (let idx = 0; idx < matchedExps.length; idx++) {
          const item = matchedExps[idx];
          const title = `${item.description} due in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`;
          const body = `$${Number(item.amount).toFixed(2)} — renews on ${item.renewsOn}`;
          await pool.query(
            `INSERT INTO user_notifications (user_id, kind, title, body, dedupe_key)
             VALUES ($1, 'expense_due', $2, $3, $4)
             ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
            [user.id, title, body, dedupeKeys[idx]]
          );
        }

        // Email only for the user's preferred reminder days
        const eligibleKeys = dedupeKeys.filter((_, idx) => reminderDays.includes(matchedExps[idx].daysUntil));
        if (eligibleKeys.length > 0) {
          const { rows: unsent } = await pool.query(
            `SELECT dedupe_key FROM user_notifications
             WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
            [user.id, eligibleKeys]
          );
          if (unsent.length > 0) {
            const unsentKeys = new Set(unsent.map(r => r.dedupe_key));
            const itemsToSend = matchedExps.filter((item, idx) => unsentKeys.has(dedupeKeys[idx]));
            const tpl = upcomingExpensesEmail(email, itemsToSend);
            await sendEmail({ to: email, ...tpl });
            await pool.query(
              `UPDATE user_notifications SET email_sent_at = NOW()
               WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
              [user.id, eligibleKeys]
            );
          }
        }
      }

      // === PRESCRIPTIONS ===
      const userRxs = rxByUser.get(user.id) || [];
      const matchedRxs = [];
      for (const rx of userRxs) {
        const daysUntil = targetDays.get(rx.next_renewal_date);
        if (daysUntil == null) continue;
        matchedRxs.push({
          id: rx.id,
          name: rx.name,
          category: rx.category,
          renewsOn: rx.next_renewal_date,
          daysUntil,
        });
      }

      if (matchedRxs.length > 0) {
        const dedupeKeys = matchedRxs.map(i => `prescription_due:${i.id}:${i.renewsOn}:${i.daysUntil}`);

        for (let idx = 0; idx < matchedRxs.length; idx++) {
          const item = matchedRxs[idx];
          const title = `${item.name} prescription renewal in ${item.daysUntil} day${item.daysUntil === 1 ? "" : "s"}`;
          await pool.query(
            `INSERT INTO user_notifications (user_id, kind, title, body, dedupe_key)
             VALUES ($1, 'prescription_due', $2, $3, $4)
             ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
            [user.id, title, `Renewal date: ${item.renewsOn}`, dedupeKeys[idx]]
          );
        }

        const eligibleKeys = dedupeKeys.filter((_, idx) => reminderDays.includes(matchedRxs[idx].daysUntil));
        if (eligibleKeys.length > 0) {
          const { rows: unsent } = await pool.query(
            `SELECT dedupe_key FROM user_notifications
             WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
            [user.id, eligibleKeys]
          );
          if (unsent.length > 0) {
            const unsentKeys = new Set(unsent.map(r => r.dedupe_key));
            const itemsToSend = matchedRxs.filter((item, idx) => unsentKeys.has(dedupeKeys[idx]));
            const tpl = upcomingPrescriptionsEmail(email, itemsToSend);
            await sendEmail({ to: email, ...tpl });
            await pool.query(
              `UPDATE user_notifications SET email_sent_at = NOW()
               WHERE user_id = $1 AND dedupe_key = ANY($2) AND email_sent_at IS NULL`,
              [user.id, eligibleKeys]
            );
          }
        }
      }
    }

    console.log(`Upcoming reminders: ${expenses.length} expenses and ${allRxRows.length} prescriptions scanned`);
  } catch (e) {
    console.error("Upcoming reminders job failed", e);
  }
}

export function startUpcomingRemindersJob() {
  // Run every hour; each user is notified at 8 AM in their own timezone
  cron.schedule("0 * * * *", runReminders);
}
