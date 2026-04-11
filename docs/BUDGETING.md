# Budgeting

Standalone guide to **monthly budgets**, **category lines**, **variance**, **threshold notifications**, and **exports**. Diagram sources also live in [`docs/diagrams/`](./diagrams/) as `.mmd` files for editors and [mermaid.live](https://mermaid.live).

---

## What budgeting does

- You set a **monthly total** and optional **per-category caps** for a calendar month.
- The app compares those targets to **actual spending** (expenses with `spent_at` in that month, grouped by category).
- Optional **alert percentages** create **in-app notifications** when total or a line crosses a threshold.
- **Income** (header nav label) opens **`/budget`** (**`BudgetHubPage`**). With no **`?view=`** query, the hub opens on the **Income** tab. On the **Budget** tab (**`?view=budget`**), you see budget fields, a **composed chart** (budget vs actual), variance, and **CSV** / **PDF** exports. The **Monthly budget** block can be collapsed with **Show** / **Hide**. The same monthly UI is available under **Reports** tab → **Monthly** period tab, or from the standalone **`/reports`** route.

Related but different: **Income vs spend** (cash-flow actuals, recurring run rate, projection) is documented in [INCOME_VS_SPEND.md](./INCOME_VS_SPEND.md).

---

## User flow (high level)

```mermaid
flowchart TB
  subgraph user [User actions]
    U1[Hub Budget tab or Reports Monthly]
    U2[Set budget total and optional category lines]
    U3[Set alert percentages optional]
    U4[Download CSV or PDF]
  end

  subgraph api [API]
    BGET["GET /api/budgets/:year/:month"]
    BPUT["PUT /api/budgets/:year/:month"]
    BDEL["DELETE /api/budgets/:year/:month"]
    SYNC[syncBudgetThresholdNotifications]
    NGET["GET /api/notifications"]
  end

  subgraph db [PostgreSQL]
    BP[budget_periods]
    BL[budget_lines]
    EX[expenses]
    UN[user_notifications]
  end

  U1 --> BGET
  U2 --> BPUT
  U3 --> BPUT
  BPUT --> BP
  BPUT --> BL
  BPUT --> SYNC
  BGET --> BP
  BGET --> BL
  BGET --> EX
  BGET --> SYNC
  SYNC --> UN
  NGET --> SYNC
  NGET --> UN

  BP -->|"total_amount, total_alert_threshold_percent"| BL
  BL -->|"amount, alert_threshold_percent, category"| VAR[Variance vs actuals by month]
```

**Diagram file:** [`docs/diagrams/budgeting-overview.mmd`](./diagrams/budgeting-overview.mmd)

**Navigation (Budget vs Reports tabs):**

```mermaid
flowchart TB
  Menu["Header: Income → /budget"] --> Hub["BudgetHubPage"]
  Hub --> TabM["Tab: Import — first in bar"]
  Hub --> TabI["Tab: Income — default when ?view omitted"]
  Hub --> TabS["Tab: Savings"]
  Hub --> TabB["Tab: Budget"]
  Hub --> TabR["Tab: Reports"]
  TabI --> EmbI["IncomePage embedded"]
  TabM --> EmbM["ExpensesPage embedded"]
  TabS --> EmbS["SavingsGoalsPage embedded"]
  TabB --> EmbB["ReportsPage monthly_budget embedded"]
  TabR --> EmbR["ReportsPage full embedded"]
```

**Diagram file:** [`docs/diagrams/budget-reports-hub.mmd`](./diagrams/budget-reports-hub.mmd)

---

## How actuals compare to budget

```mermaid
flowchart LR
  subgraph month [Calendar month M]
    A[Sum expenses spent_at in M]
    T[budget_periods.total_amount]
    L[budget_lines per category]
  end

  A --> V{Compare}
  T --> V
  L --> V

  V --> TOT[Total variance remaining percentUsed status]
  V --> CAT[Per line actual vs budgeted]

  TOT --> UI[Budget monthly sidebar and suggestions]
  CAT --> UI

  TOT --> TH{Thresholds set?}
  TH -->|yes| N[Upsert user_notifications]
  TH -->|no| SKIP[No threshold notification]
```

**Diagram file:** [`docs/diagrams/budgeting-vs-actuals.mmd`](./diagrams/budgeting-vs-actuals.mmd)

---

## Data model

| Table | Role |
|--------|------|
| `budget_periods` | One row per `(user_id, year, month)` with `total_amount`, optional `total_alert_threshold_percent`. |
| `budget_lines` | Optional rows: `category`, `amount`, optional `alert_threshold_percent` for that category. |
| `user_notifications` | Rows with **`kind`** **`budget_total_threshold`** or **`budget_category_threshold`** when a threshold is crossed (updated while over threshold via **`dedupe_key`**). |

Schema: [`server/src/db.js`](../server/src/db.js).

---

## API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/budgets/:year/:month` | Budget + `byCategory` actuals vs lines + `variance`. |
| `PUT` | `/api/budgets/:year/:month` | Replace period + lines; syncs threshold notifications. |
| `DELETE` | `/api/budgets/:year/:month` | Remove period and lines. |

Implementation: [`server/src/routes/budgets.js`](../server/src/routes/budgets.js).

---

## UI

- **Income** (header nav label) → **`/budget`** ([`BudgetHubPage.jsx`](../client/src/pages/BudgetHubPage.jsx)): tabs **Import** | **Income** | **Savings** | **Budget** | **Reports** (`?view=import` / `income` / `savings` / `budget` / `reports`; omitting **`?view`** defaults to **Income**). **Budget** tab embeds **`ReportsPage`** **`variant="monthly_budget"`**. **Reports** tab embeds **`variant="full"`** (Daily … Custom; **`?tab=`**). **Import** / **Income** / **Savings** embed **`ExpensesPage`** / **`IncomePage`** / **`SavingsGoalsPage`** with **`embedded`**. Standalone **`/reports`** keeps the full **Reports** title and **← Budget & reports home**.
- **Notification bell** (header): budget-threshold notifications; **Open monthly budget** → **`/budget`**.
- **Theme:** **Profile** → **Appearance**.
- Client: [`BudgetHubPage.jsx`](../client/src/pages/BudgetHubPage.jsx), [`ReportsPage.jsx`](../client/src/pages/ReportsPage.jsx), [`NotificationBell.jsx`](../client/src/components/NotificationBell.jsx).

---

## Exports

- **CSV** — monthly report download from the **Budget** tab (includes budget-related columns where applicable).
- **PDF** — monthly summary via server PDF route (see [ARCHITECTURE.md](./ARCHITECTURE.md) API table).

---

## See also

- [USER_GUIDE.md](./USER_GUIDE.md) — how to use the app end to end.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — modules and API index.
- [INCOME_VS_SPEND.md](./INCOME_VS_SPEND.md) — income, cash flow, and recurring run rate vs obligations.
- Interactive API: **`/api/docs`** (Swagger UI) and **`/api/openapi.json`** — **`/budgets/{year}/{month}`** and **`/notifications`** are described there with other routes. Use [API_AUTHORIZATION.md](./API_AUTHORIZATION.md) for **bearerAuth** in Swagger.
