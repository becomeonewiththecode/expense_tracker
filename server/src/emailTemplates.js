const PRIMARY = "#1a7f64";
const BG = "#f0f4f2";
const CARD = "#ffffff";
const TEXT = "#1a1a1a";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";

function base(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BG};padding:32px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;">
        <!-- Header -->
        <tr>
          <td style="padding-bottom:24px;text-align:center;">
            <span style="font-size:22px;font-weight:700;color:${PRIMARY};letter-spacing:-0.5px;">UrExpense</span>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:${CARD};border-radius:12px;border:1px solid ${BORDER};padding:32px 36px;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding-top:24px;text-align:center;font-size:12px;color:${MUTED};">
            &copy; UrExpense &mdash; You are receiving this email because you have an account at UrExpense.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function h1(text) {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT};">${text}</h1>`;
}

function p(text, style = "") {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT};${style}">${text}</p>`;
}

function muted(text) {
  return `<p style="margin:0 0 16px;font-size:13px;color:${MUTED};line-height:1.5;">${text}</p>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0;" />`;
}

function statBox(label, value) {
  return `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
    style="background:${BG};border-radius:8px;margin-bottom:16px;">
    <tr>
      <td style="padding:16px 20px;">
        <div style="font-size:12px;color:${MUTED};margin-bottom:4px;">${label}</div>
        <div style="font-size:24px;font-weight:700;color:${PRIMARY};">${value}</div>
      </td>
    </tr>
  </table>`;
}

// ── Templates ──────────────────────────────────────────────────────────────────

export function welcomeEmail(email) {
  const html = base(
    "Welcome to UrExpense",
    `
    ${h1("Welcome to UrExpense!")}
    ${p(`Hi <strong>${email}</strong>,`)}
    ${p("Your account has been created successfully. You can now log in and start tracking your expenses, setting budgets, and gaining insight into your spending habits.")}
    ${divider()}
    ${muted("If you did not create this account, you can safely ignore this email.")}
    `
  );

  const text = `Welcome to UrExpense!

Hi ${email},

Your account has been created successfully. You can now log in and start tracking your expenses, setting budgets, and gaining insight into your spending habits.

If you did not create this account, you can safely ignore this email.

— The UrExpense Team`;

  return { subject: "Welcome to UrExpense", html, text };
}

export function passwordChangedEmail(email) {
  const html = base(
    "Your password was changed",
    `
    ${h1("Password changed")}
    ${p(`Hi <strong>${email}</strong>,`)}
    ${p("Your UrExpense account password was just changed. If this was you, no further action is needed.")}
    ${divider()}
    ${muted("If you did not make this change, please contact support immediately and secure your account.")}
    `
  );

  const text = `Password changed

Hi ${email},

Your UrExpense account password was just changed. If this was you, no further action is needed.

If you did not make this change, please contact support immediately and secure your account.

— The UrExpense Team`;

  return { subject: "Your UrExpense password was changed", html, text };
}

export function budgetAlertEmail(email, title, body) {
  const html = base(
    "Budget alert",
    `
    ${h1("Budget alert")}
    ${p(`Hi <strong>${email}</strong>,`)}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:#fff7ed;border-left:4px solid #f97316;border-radius:4px;margin-bottom:20px;">
      <tr>
        <td style="padding:16px 20px;">
          <div style="font-size:14px;font-weight:600;color:#9a3412;margin-bottom:4px;">${title}</div>
          <div style="font-size:14px;color:#7c2d12;line-height:1.5;">${body}</div>
        </td>
      </tr>
    </table>
    ${p("Log in to UrExpense to review your spending and adjust your budget if needed.")}
    `
  );

  const text = `Budget alert: ${title}

Hi ${email},

${body}

Log in to UrExpense to review your spending and adjust your budget if needed.

— The UrExpense Team`;

  return { subject: `Budget alert: ${title}`, html, text };
}

export function recoveryCodeGeneratedEmail(email) {
  const html = base(
    "Recovery code generated",
    `
    ${h1("Recovery code generated")}
    ${p(`Hi <strong>${email}</strong>,`)}
    ${p("A new account recovery code was just generated for your UrExpense account.")}
    ${p("Keep your recovery code somewhere safe and private. It can be used to regain access to your account if you ever lose your password.")}
    ${divider()}
    ${muted("If you did not generate this code, your account may be compromised. Sign in and revoke the code immediately from your Profile settings.")}
    `
  );

  const text = `Recovery code generated

Hi ${email},

A new account recovery code was just generated for your UrExpense account.

Keep your recovery code somewhere safe and private. It can be used to regain access to your account if you ever lose your password.

If you did not generate this code, your account may be compromised. Sign in and revoke the code immediately from your Profile settings.

— The UrExpense Team`;

  return { subject: "A recovery code was generated for your UrExpense account", html, text };
}

export function passwordResetEmail(email) {
  const html = base(
    "Your password was reset",
    `
    ${h1("Password reset")}
    ${p(`Hi <strong>${email}</strong>,`)}
    ${p("Your UrExpense account password was just reset using your recovery code. The recovery code has been invalidated and can no longer be used.")}
    ${p("You can now sign in with your new password.")}
    ${divider()}
    ${muted("If you did not reset your password, contact support immediately — your account and recovery code may have been compromised.")}
    `
  );

  const text = `Password reset

Hi ${email},

Your UrExpense account password was just reset using your recovery code. The recovery code has been invalidated and can no longer be used.

You can now sign in with your new password.

If you did not reset your password, contact support immediately — your account and recovery code may have been compromised.

— The UrExpense Team`;

  return { subject: "Your UrExpense password was reset", html, text };
}

export function backupExportedEmail(email, exportedAt, counts) {
  const dateStr = new Date(exportedAt).toUTCString();
  const rows = [
    ["Expenses", counts.expenses ?? 0],
    ["Renewals", counts.renewals ?? 0],
    ["Prescriptions", counts.prescriptions ?? 0],
    ["Payment plans", counts.paymentPlans ?? 0],
    ["Income entries", counts.incomeEntries ?? 0],
  ]
    .filter(([, n]) => n > 0)
    .map(
      ([label, n]) =>
        `<tr>
          <td style="padding:7px 0;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};">${label}</td>
          <td style="padding:7px 0;font-size:14px;color:${TEXT};text-align:right;border-bottom:1px solid ${BORDER};font-weight:600;">${n}</td>
        </tr>`
    )
    .join("");

  const countsText = [
    ["Expenses", counts.expenses ?? 0],
    ["Renewals", counts.renewals ?? 0],
    ["Prescriptions", counts.prescriptions ?? 0],
    ["Payment plans", counts.paymentPlans ?? 0],
    ["Income entries", counts.incomeEntries ?? 0],
  ]
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `  ${label}: ${n}`)
    .join("\n");

  const html = base(
    "Your account backup was downloaded",
    `
    ${h1("Account backup downloaded")}
    ${p(`Hi <strong>${email}</strong>,`)}
    ${p(`A backup of your UrExpense account data was downloaded on <strong>${dateStr}</strong>.`)}
    ${rows ? `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Records exported</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">${rows}</table>` : ""}
    ${divider()}
    ${muted("If you did not initiate this export, someone may have accessed your account. Change your password and enable 2FA immediately.")}
    `
  );

  const text = `Account backup downloaded

Hi ${email},

A backup of your UrExpense account data was downloaded on ${dateStr}.

${countsText ? `Records exported:\n${countsText}\n` : ""}
If you did not initiate this export, someone may have accessed your account. Change your password and enable 2FA immediately.

— The UrExpense Team`;

  return { subject: "Your UrExpense account backup was downloaded", html, text };
}

export function backupRestoredEmail(email, mode, breakdown) {
  const modeLabel = mode === "replace" ? "Replace (existing data cleared)" : "Append (merged with existing data)";
  const rows = [
    ["Expenses", breakdown.expenses ?? 0],
    ["Renewals", breakdown.renewals ?? 0],
    ["Prescriptions", breakdown.prescriptions ?? 0],
    ["Payment plans", breakdown.paymentPlans ?? 0],
    ["Income entries", breakdown.incomeEntries ?? 0],
  ]
    .filter(([, n]) => n > 0)
    .map(
      ([label, n]) =>
        `<tr>
          <td style="padding:7px 0;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};">${label}</td>
          <td style="padding:7px 0;font-size:14px;color:${TEXT};text-align:right;border-bottom:1px solid ${BORDER};font-weight:600;">${n}</td>
        </tr>`
    )
    .join("");

  const countsText = [
    ["Expenses", breakdown.expenses ?? 0],
    ["Renewals", breakdown.renewals ?? 0],
    ["Prescriptions", breakdown.prescriptions ?? 0],
    ["Payment plans", breakdown.paymentPlans ?? 0],
    ["Income entries", breakdown.incomeEntries ?? 0],
  ]
    .filter(([, n]) => n > 0)
    .map(([label, n]) => `  ${label}: ${n}`)
    .join("\n");

  const html = base(
    "Account data restored from backup",
    `
    ${h1("Account data restored")}
    ${p(`Hi <strong>${email}</strong>,`)}
    ${p(`Your UrExpense account data was just restored from a backup file.`)}
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${BG};border-radius:8px;margin-bottom:20px;">
      <tr><td style="padding:12px 16px;font-size:14px;color:${TEXT};">
        <strong>Mode:</strong> ${modeLabel}
      </td></tr>
    </table>
    ${rows ? `<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Records restored</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:20px;">${rows}</table>` : ""}
    ${divider()}
    ${muted("If you did not initiate this restore, your account may be compromised. Change your password and review your data immediately.")}
    `
  );

  const text = `Account data restored from backup

Hi ${email},

Your UrExpense account data was just restored from a backup file.

Mode: ${modeLabel}
${countsText ? `\nRecords restored:\n${countsText}\n` : ""}
If you did not initiate this restore, your account may be compromised. Change your password and review your data immediately.

— The UrExpense Team`;

  return { subject: "Your UrExpense account data was restored from backup", html, text };
}

const BANK_LABELS = {
  cibc: "CIBC", rbc: "RBC", scotiabank: "Scotiabank", td: "TD", bmo: "BMO",
  simplii_financial: "Simplii Financial", eq_bank: "EQ Bank", tangerine: "Tangerine",
  not_listed: "Bank",
};

function formatInstitution(inst, bankName) {
  if (inst === "bank") {
    return (bankName && BANK_LABELS[bankName]) || "Bank";
  }
  const labels = { visa: "Visa", mastercard: "Mastercard", american_express: "American Express" };
  return labels[inst] || inst || "Bank";
}

function formatDate(isoStr) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function groupByDays(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.daysUntil)) groups.set(item.daysUntil, []);
    groups.get(item.daysUntil).push(item);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b);
}

export function upcomingExpensesEmail(email, items) {
  const sortedGroups = groupByDays(items);

  let sectionsHtml = "";
  let sectionsText = "";

  for (const [days, groupItems] of sortedGroups) {
    const dateLabel = formatDate(groupItems[0].renewsOn);
    sectionsHtml += `
      <p style="margin:20px 0 8px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">
        Due in ${days} day${days === 1 ? "" : "s"} &mdash; ${dateLabel}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:4px;">
        ${groupItems.map(item => `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};">
            ${item.description}
            <span style="font-size:12px;color:${MUTED};"> &middot; ${formatInstitution(item.institution, item.bankName)}</span>
          </td>
          <td style="padding:8px 0;font-size:14px;font-weight:600;color:${TEXT};text-align:right;border-bottom:1px solid ${BORDER};">
            $${Number(item.amount).toFixed(2)}
          </td>
        </tr>`).join("")}
      </table>`;

    sectionsText += `\nDue in ${days} day${days === 1 ? "" : "s"} (${dateLabel}):\n`;
    for (const item of groupItems) {
      sectionsText += `  • ${item.description} · ${formatInstitution(item.institution, item.bankName)} · $${Number(item.amount).toFixed(2)}\n`;
    }
  }

  const html = base(
    "Upcoming expenses",
    `${h1("Upcoming expenses")}
     ${p(`Hi <strong>${email}</strong>, here are your expenses coming up soon.`)}
     ${sectionsHtml}
     ${divider()}
     ${muted("Log in to UrExpense to view all upcoming renewals and manage your expenses.")}`
  );

  const text = `Upcoming expenses\n\nHi ${email},\n\nHere are your expenses coming up soon:\n${sectionsText}\nLog in to UrExpense to view all upcoming renewals.\n\n— The UrExpense Team`;

  const subject = items.length === 1
    ? `Upcoming expense: ${items[0].description} due in ${items[0].daysUntil} days`
    : `You have ${items.length} upcoming expenses`;

  return { subject, html, text };
}

export function upcomingPrescriptionsEmail(email, items) {
  const sortedGroups = groupByDays(items);

  let sectionsHtml = "";
  let sectionsText = "";

  for (const [days, groupItems] of sortedGroups) {
    const dateLabel = formatDate(groupItems[0].renewsOn);
    sectionsHtml += `
      <p style="margin:20px 0 8px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">
        Due in ${days} day${days === 1 ? "" : "s"} &mdash; ${dateLabel}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:4px;">
        ${groupItems.map(item => `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};">
            ${item.name}
            <span style="font-size:12px;color:${MUTED};"> &middot; ${item.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
          </td>
        </tr>`).join("")}
      </table>`;

    sectionsText += `\nDue in ${days} day${days === 1 ? "" : "s"} (${dateLabel}):\n`;
    for (const item of groupItems) {
      sectionsText += `  • ${item.name} · ${item.category}\n`;
    }
  }

  const html = base(
    "Prescription renewal reminder",
    `${h1("Prescription renewal reminder")}
     ${p(`Hi <strong>${email}</strong>, the following prescriptions are due for renewal soon.`)}
     ${sectionsHtml}
     ${divider()}
     ${muted("Log in to UrExpense to manage your prescription renewals and schedule refills.")}`
  );

  const text = `Prescription renewal reminder\n\nHi ${email},\n\nThe following prescriptions are due for renewal soon:\n${sectionsText}\nLog in to UrExpense to manage your prescription renewals.\n\n— The UrExpense Team`;

  const subject = items.length === 1
    ? `Prescription reminder: ${items[0].name} due in ${items[0].daysUntil} days`
    : `You have ${items.length} prescription renewals coming up`;

  return { subject, html, text };
}

export function monthlySummaryEmail(email, year, month, total, topCategories = []) {
  const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" });
  const formattedTotal = `$${Number(total).toFixed(2)}`;

  let categoriesHtml = "";
  let categoriesText = "";
  if (topCategories.length > 0) {
    const rows = topCategories
      .slice(0, 5)
      .map(
        (c) =>
          `<tr>
            <td style="padding:8px 0;font-size:14px;color:${TEXT};border-bottom:1px solid ${BORDER};">${c.category}</td>
            <td style="padding:8px 0;font-size:14px;color:${TEXT};text-align:right;border-bottom:1px solid ${BORDER};font-weight:600;">$${Number(c.total).toFixed(2)}</td>
          </tr>`
      )
      .join("");
    categoriesHtml = `
      ${divider()}
      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:0.5px;">Top Categories</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>`;
    categoriesText =
      "\nTop Categories:\n" +
      topCategories
        .slice(0, 5)
        .map((c) => `  ${c.category}: $${Number(c.total).toFixed(2)}`)
        .join("\n");
  }

  const html = base(
    `${monthName} ${year} spending summary`,
    `
    ${h1(`${monthName} ${year} summary`)}
    ${p(`Hi <strong>${email}</strong>, here's your spending summary for ${monthName} ${year}.`)}
    ${statBox("Total spending", formattedTotal)}
    ${categoriesHtml}
    ${divider()}
    ${muted("Log in to UrExpense to view your full report, set new budgets, and plan ahead.")}
    `
  );

  const text = `${monthName} ${year} spending summary

Hi ${email},

Your total spending for ${monthName} ${year}: ${formattedTotal}
${categoriesText}

Log in to UrExpense to view your full report and plan ahead.

— The UrExpense Team`;

  return { subject: `Your ${monthName} ${year} spending summary`, html, text };
}
