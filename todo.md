# Budget product roadmap

Phases for evolving the expense tracker toward a full “budget product.”

## Completed so far

### Phase 1 (MVP) — done

- **Database:** `budget_periods` and `budget_lines` in [`server/src/db.js`](server/src/db.js).
- **Budget API:** [`server/src/routes/budgets.js`](server/src/routes/budgets.js) — `GET` / `PUT` / `DELETE` `/api/budgets/:year/:month`.
- **Variance and on-page insights** on Reports.
- **Monthly report** includes `byCategory`.
- **CSV export:** `GET /api/reports/export/monthly.csv`.
- **Reports UI:** budget editor, composed chart, sidebar variance — [`client/src/pages/ReportsPage.jsx`](client/src/pages/ReportsPage.jsx).

### Phase 2 — done

- **Budget alert thresholds:** `total_alert_threshold_percent` on `budget_periods`, `alert_threshold_percent` on `budget_lines`. Saved via budget `PUT`; [`syncBudgetThresholdNotifications`](server/src/routes/budgets.js) upserts rows in `user_notifications` when actual spending crosses thresholds.
- **In-app notifications:** [`user_notifications`](server/src/db.js) table; [`GET/PATCH/POST /api/notifications`](server/src/routes/notifications.js); bell menu [`NotificationBell.jsx`](client/src/components/NotificationBell.jsx) in the header (syncs current month when opened).
- **PDF export:** `GET /api/reports/export/monthly.pdf` using [pdfkit](server/package.json) — [`server/src/routes/reports.js`](server/src/routes/reports.js); **Download PDF** on Reports (monthly).
- **Income:** `income_entries` table; CRUD [`/api/income`](server/src/routes/income.js); [`IncomePage`](client/src/pages/IncomePage.jsx) at `/income` (nav + Lists menu).
- **Cash flow (actuals):** `GET /api/reports/cashflow/monthly` — spending vs logged income and net; card on monthly Reports.
- **Projection net:** [`computeIncomeProjection`](client/src/projection.js) + [`ProjectionModal`](client/src/components/ProjectionModal.jsx) shows income run rate and **net monthly (income − expense run rate)** when opening projection from Reports with income rows loaded.

**Not implemented (optional later):** email/push for budget alerts; income in JSON backup/restore.

---

## Phase 1 — MVP

- [x] Monthly budgets with optional per-category lines (`budget_periods`, `budget_lines`)
- [x] Variance vs actuals in API and Reports UI
- [x] Monthly chart overlay (cumulative spend vs linear budget pace)
- [x] CSV export for the selected month (`GET /api/reports/export/monthly.csv`)

## Phase 2 — Alerts and polish

- [x] Per-category notification thresholds and user-facing budget warnings (in-app; bell + DB-backed notifications)
- [x] PDF report export (in addition to CSV)
- [x] Income model and net cash-flow view (`/reports/cashflow/monthly` actuals + projection net in modal)

## Phase 3 — Automation — done

- **Import rules:** [`import_category_rules`](server/src/db.js); CRUD [`/api/import-rules`](server/src/routes/importRules.js); engine [`importRulesEngine.js`](server/src/importRulesEngine.js). Rules apply in sort order to rows with no category on **commit** and via **Run rules** / [`POST /api/imports/batches/:id/apply-rules`](server/src/routes/imports.js). UI: [`ImportRulesPanel`](client/src/components/ImportRulesPanel.jsx) on Import.
- **AI suggest:** [`POST /api/imports/batches/:id/suggest-categories`](server/src/routes/imports.js) + [`aiImportSuggestions.js`](server/src/aiImportSuggestions.js) (OpenAI JSON). [`ImportAiSuggestModal`](client/src/components/ImportAiSuggestModal.jsx) — user reviews/edits and applies via existing row PATCH. Env: `OPENAI_API_KEY`, optional `OPENAI_MODEL` ([`server/.env.example`](server/.env.example)).
- **Savings goals:** [`savings_goals`](server/src/db.js); [`/api/savings-goals`](server/src/routes/savingsGoals.js); [`SavingsGoalsPage`](client/src/pages/SavingsGoalsPage.jsx) at `/savings` (Lists + desktop nav).

- [x] Merchant / categorization rules on import commit
- [x] Optional AI-assisted categorization for uncategorized rows (with user confirm)
- [x] Savings goals with targets and progress UI (beyond payment-plan tags)

## Phase 4 — Platform scale — done

- **Plaid bank sync:** [`server/src/routes/bank.js`](server/src/routes/bank.js) — link token, public-token exchange, list/disconnect, `transactions/sync` into `expenses` with `bank_import_ref` dedupe; [`BankSyncSection`](client/src/components/BankSyncSection.jsx) on Profile. Env: `PLAID_CLIENT_ID`, `PLAID_SECRET`, optional `PLAID_ENV`, `PLAID_COUNTRY_CODES` ([`server/.env.example`](server/.env.example)).
- **Read-only advisor links:** [`advisor_share_links`](server/src/db.js); [`GET/POST/DELETE /api/advisor-shares`](server/src/routes/advisorShares.js); public [`GET /api/public/share/:token/reports/monthly`](server/src/routes/publicShare.js); [`AdvisorShareSection`](client/src/components/AdvisorShareSection.jsx) on Profile; viewer at [`/share/:token`](client/src/pages/AdvisorShareViewPage.jsx).

- [x] Automatic bank / card sync (e.g. Plaid-class aggregator)
- [x] Workspaces / sharing for collaborative budgets (or read-only advisor links as MVP)
