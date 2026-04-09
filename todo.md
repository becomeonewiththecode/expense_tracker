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

## Phase 3 — Automation

- [ ] Merchant / categorization rules on import commit
- [ ] Optional AI-assisted categorization for uncategorized rows (with user confirm)
- [ ] Savings goals with targets and progress UI (beyond payment-plan tags)

## Phase 4 — Platform scale

- [ ] Automatic bank / card sync (e.g. Plaid-class aggregator)
- [ ] Workspaces / sharing for collaborative budgets (or read-only advisor links as MVP)
