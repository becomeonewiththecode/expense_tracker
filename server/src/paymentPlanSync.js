function scheduleFromExpenseFrequency(freq) {
  if (freq === "weekly") return "weekly";
  if (freq === "yearly") return "annual";
  if (freq === "once") return "one_time";
  return "monthly";
}

function frequencyFromExpenseFrequency(freq) {
  if (freq === "yearly") return "one_year";
  if (freq === "once") return "custom_end_date";
  return "ongoing";
}

function accountTypeFromInstitution(financialInstitution) {
  if (financialInstitution === "bank") return "checking";
  return "credit_card";
}

function institutionFromExpenseInstitution(financialInstitution) {
  if (financialInstitution === "visa") return "visa";
  if (financialInstitution === "mastercard") return "mastercard";
  if (financialInstitution === "american_express") return "american_express";
  return "other";
}

function statusFromExpenseState(state) {
  return state === "cancelled" ? "paused" : "active";
}

function nameFromExpense(row) {
  const d = String(row.description || "").trim();
  return d ? d.slice(0, 200) : `Expense plan #${row.id}`;
}

function notesFromExpense(row) {
  const parts = [];
  if (row.description) parts.push(String(row.description).slice(0, 500));
  parts.push(`Linked from expense #${row.id}`);
  return parts.join(" | ").slice(0, 2000);
}

export async function syncPaymentPlanForExpense(client, userId, row) {
  if (!row || row.category !== "payment_plan") return;
  const values = [
    userId,
    row.id,
    nameFromExpense(row),
    Number(row.amount) || 0,
    "monthly_subscription",
    scheduleFromExpenseFrequency(row.frequency),
    "important",
    statusFromExpenseState(row.state),
    accountTypeFromInstitution(row.financial_institution),
    "manual",
    institutionFromExpenseInstitution(row.financial_institution),
    row.frequency === "once" ? "discretionary" : "recurring",
    frequencyFromExpenseFrequency(row.frequency),
    notesFromExpense(row),
  ];

  await client.query(
    `INSERT INTO payment_plans (
      user_id, source_expense_id, name, amount, category, payment_schedule, priority_level, status,
      account_type, payment_method, institution, tag, frequency, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (user_id, source_expense_id) WHERE source_expense_id IS NOT NULL
    DO UPDATE SET
      name = EXCLUDED.name,
      amount = EXCLUDED.amount,
      payment_schedule = EXCLUDED.payment_schedule,
      status = EXCLUDED.status,
      account_type = EXCLUDED.account_type,
      institution = EXCLUDED.institution,
      tag = EXCLUDED.tag,
      frequency = EXCLUDED.frequency,
      notes = EXCLUDED.notes`,
    values
  );
}

export async function removePaymentPlanForExpense(client, userId, expenseId) {
  await client.query(`DELETE FROM payment_plans WHERE user_id = $1 AND source_expense_id = $2`, [
    userId,
    expenseId,
  ]);
}
