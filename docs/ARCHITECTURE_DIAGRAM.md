# Expense Tracker — Architecture diagrams

This file collects visual overviews of **applications**, **runtime processes**, and **integrations**. For narrative design notes, see [ARCHITECTURE.md](./ARCHITECTURE.md). For the **Renewals** feature (category **`renewal`**, **`renewal_kind`**, **`/renewals`** page, import staging), see [RENEWALS.md](./RENEWALS.md). For **Prescriptions** (**`/prescriptions`**, **`prescriptions`** table, **`renewal_period`** monthly **1–11** or **1–5 years**, 30-day reminders), see [PRESCRIPTIONS.md](./PRESCRIPTIONS.md). For **Docker Compose production**, **`ensure-env.mjs`**, **`JWT_SECRET`**, and **`env_file`**, see [deployment/docker-compose/README.md](../deployment/docker-compose/README.md).

---

## 1. System context (containers)

This diagram shows **who talks to whom** at major boundaries: the user’s browser, the Node.js processes in this repository, and data services.

```mermaid
flowchart TB
  subgraph actor [User]
    B[Web browser]
  end

  subgraph expense_tracker [Expense Tracker — this repo]
    subgraph fe [Frontend app — client/]
      RS[React SPA]
      VT[Vite dev server]
      VT -->|serves bundle and Hot Module Replacement| RS
    end
    subgraph be [Backend app — server/]
      EX[Express API]
      CRON[node-cron monthly job]
      EX -.->|same process| CRON
    end
  end

  subgraph infra [Local infrastructure — Docker Compose]
    PG[(PostgreSQL :5432)]
    RD[(Redis :6379)]
  end

  B -->|HTTPS or http://localhost:5173| VT
  B -->|page JavaScript calls paths under /api/| VT
  VT -->|"proxy /api to API_PROXY_TARGET (default port 4000)"| EX
  EX -->|SQL via node-postgres| PG
  EX -->|optional cache via ioredis| RD
```

**Integrations described by this diagram:**

| From | To | Protocol or mechanism |
|------|-----|----------------------|
| Browser | Vite | Hypertext Transfer Protocol for HTML, JavaScript, and style sheets; WebSocket for Hot Module Replacement during development |
| Browser (via Vite) | Express | Hypertext Transfer Protocol REST calls; paths beginning with `/api` are forwarded by Vite to the API port |
| Express | PostgreSQL | Transmission Control Protocol using `DATABASE_URL`; Structured Query Language queries |
| Express | Redis | Transmission Control Protocol using `REDIS_URL`; optional caching |
| Express | Google, GitHub, GitLab, or Microsoft | OAuth 2.0: browser redirects and HTTPS calls to token and profile endpoints; the redirect URL is registered on the same origin as the single-page application, and `/api` requests reach Express through the Vite proxy during development |

---

## 1b. From development to production (topology)

**Section 1** above shows **development**: Vite plus Express. **After** you run **`npm run build`** in the client and deploy, the **Vite development server is not part of production**. The browser loads **static files** from the **`dist/`** output directory, and a network **edge** (reverse proxy, content delivery network, or host) routes requests whose path begins with **`/api`** to **Express**.

The small diagram below shows the **order of stages**: first development, then a production build that writes `dist/`, then a production deployment.

```mermaid
flowchart LR
  subgraph lifecycle [Lifecycle]
    D[Development]
    B[vite build writes client/dist]
    P[Production]
    D --> B
    B --> P
  end
```

**Development (typical local machine):**

```mermaid
flowchart TB
  subgraph dev [Step 1 — Development, typical local setup]
    BD[Browser]
    VD["Vite dev server on port 5173"]
    AD["Express API on port 4000 by default"]
    PGD[(PostgreSQL)]
    RDV[(Redis optional)]

    BD -->|"HTML, JavaScript, CSS, Hot Module Replacement"| VD
    BD -->|HTTP GET for paths under /api/| VD
    VD -->|forward to API_PROXY_TARGET| AD
    AD --> PGD
    AD --> RDV
  end
```

**Production (after build and deploy):**

```mermaid
flowchart TB
  subgraph prod [Step 2 — Production, after build and deploy]
    BP[Browser]
    EDGE["Transport Layer Security edge: nginx, Caddy, load balancer, or CDN"]
    STATIC["Static files from client/dist after vite build"]
    AP["Express API in its own process or container"]
    PGP[(PostgreSQL)]
    RDP[(Redis optional)]

    BP -->|HTTPS| EDGE
    EDGE -->|routes for the app shell to files| STATIC
    EDGE -->|paths under /api/ to Node| AP
    AP --> PGP
    AP --> RDP
  end
```

| Stage | What runs |
|-------|-------------|
| **Step 1 — Development** | The Vite development server with Hot Module Replacement; the browser uses the same origin for `/api`, which Vite forwards to Express; often plain HTTP on `localhost`. Typical commands: `npm run dev` in the `client` directory and `npm run dev` in the `server` directory. |
| **Step 2 — Production** | Run `npm run build` in the `client` directory, then serve the **`client/dist/`** directory (the Vite development process does not run in production). Express runs behind Transport Layer Security; `/api` is reached through the edge or via Cross-Origin Resource Sharing if the static site and API use different origins. Set `NODE_ENV=production` (or your host’s equivalent) for the API process. **Concrete bundle:** **`deployment/docker-compose/`** builds **`dist/`** inside the **web** image, runs **nginx** plus the **api** container, and exposes one HTTP port. From the repo root, **`npm run compose:prod`** runs **`ensure-env.mjs`** then **`docker compose up`** (see **deployment/docker-compose/README.md**). |

More detail: [ARCHITECTURE.md — From development to production](./ARCHITECTURE.md#from-development-to-production).

---

## 2. Runtime: manual npm or PM2 (during development)

There are two common ways to run the **same** logical applications (`expense-client` and `expense-api`) while you are developing. The databases are the same in both cases.

```mermaid
flowchart LR
  subgraph terminals [Manual npm]
    T1["npm run dev in client/ on port 5173"]
    T2["npm run dev in server/ on port 4000"]
  end

  subgraph pm2 [PM2 — ecosystem.config.cjs]
    P1[expense-client — Vite dev]
    P2[expense-api — Node src/index.js]
  end

  DC[(Docker Compose — Postgres and Redis)]

  T1 & T2 --> DC
  P1 & P2 --> DC
```

- **Manual two-terminal workflow:** Run the client and server in separate shells. The Vite proxy target must match the API **`PORT`**; set **`API_PROXY_TARGET`** in `client/.env` accordingly.  
- **PM2 workflow:** Both processes are started from the repository root; logs go under `logs/`. Other PM2-managed applications on the same machine share the same PM2 daemon but are separate registered apps.

---

## 3. Backend application — modules and integrations

This diagram shows everything that runs inside the **Express** process and how it connects to libraries and data stores.

```mermaid
flowchart TB
  subgraph api [Express server/src/index.js]
    BOOT[index.js bootstrap]
    MW[CORS plus JSON body plus error handler]
    R0["GET /health"]
    R1["/api/auth"]
    R2["/api/expenses"]
    R3["/api/imports"]
    R4["/api/reports"]
    R5["/api/backup"]
    R6["/api/prescriptions"]
    BOOT --> MW
    MW --> R0
    MW --> R1
    MW --> R2
    MW --> R3
    MW --> R4
    MW --> R5
    MW --> R6
  end

  subgraph libs [Libraries]
    JWT[jsonwebtoken]
    BC[bcryptjs]
    MP[multer memory]
    CSV[csv-parse]
    PDF[pdf-parse]
    CC[node-cron]
  end

  subgraph data [Data layer]
    PG[(PostgreSQL)]
    RDX[(Redis)]
  end

  R1 --> BC
  R1 --> JWT
  R2 --> JWT
  R3 --> JWT
  R3 --> MP
  R3 --> CSV
  R3 --> PDF
  R4 --> JWT
  R5 --> JWT
  R6 --> JWT
  R4 --> RDX
  R2 --> PG
  R3 --> PG
  R4 --> PG
  R5 --> PG
  R6 --> PG

  subgraph enumHelpers [Allow-lists and parsers]
    EE[expenseEnums.js]
    PE[prescriptionEnums.js]
  end
  R2 --> EE
  R3 --> EE
  R5 --> EE
  R6 --> PE

  subgraph recovery [Recovery in backups]
    RCS[recoveryCodeStorage.js]
  end
  R5 --> RCS

  subgraph job [Background]
    CC --> PG
  end

  BOOT -.->|schedules| CC
```

| Module file | Role | Integrations |
|--------|------|----------------|
| `routes/auth.js` | Registration, login, **`me`**, **`POST /refresh`** (new JWT from expired-but-signed token within grace), **`PATCH /profile`**, recovery **`POST`/`DELETE /recovery-code`** (persists **`recovery_code_ciphertext`** via **`recoveryCodeStorage.js`**), **`POST /recover-password`**, **`POST`/`DELETE /avatar`**, static **`/uploads`** | `bcryptjs`, `jsonwebtoken`, `pg`, `multer`, `crypto`; mounts **`oauth/*`** from `oauth/oauthRoutes.js` |
| `oauth/oauthRoutes.js` together with `oauthService.js` and `oauthState.js` | Single sign-on: authorize and callback | `fetch` to identity providers, `pg` for **`oauth_identities`** |
| `routes/expenses.js` | Expense create, read, update, delete; optional list filter **`?category=`** (for example **`renewal`**) | JSON Web Token middleware, `pg`, `expenseEnums.js` |
| `routes/imports.js` | Upload, staging, commit; staging **`PATCH`** supports **`renewal_kind`** and **`website`**; commit requires **`renewal_kind`** when **`category`** is **`renewal`** | JSON Web Token, `multer`, `visaStatement.js` for CSV and PDF, `pg` |
| `routes/reports.js` | Aggregates and chart data | JSON Web Token, `pg`, optional `redis.js` |
| `routes/backup.js` | **`GET /export`**, **`POST /restore`** (append or replace expenses; each expense may include **`website`** and **`renewal_kind`**; **`account`** metadata, optional **`recoveryCode`**; restore cross-account **409** / **`confirmCrossAccountRestore`**) | JSON Web Token, `pg`, `expenseEnums.js`, **`recoveryCodeStorage.js`** |
| `routes/prescriptions.js` | **`prescriptions`** CRUD — **`name`**, **`amount`**, **`renewal_period`**, **`next_renewal_date`**, **`vendor`**, **`notes`**, **`category`**, **`state`** | JSON Web Token, `pg`, **`prescriptionEnums.js`** |
| `parsers/visaStatement.js` | Parse uploaded statements | `csv-parse/sync`, `pdf-parse` |
| `jobs/monthlySummary.js` | Monthly rollup job | `node-cron`, `pg` writing **`monthly_summaries`** |
| `db.js` | Connection pool and **`initDb()`** | `pg` |
| `expenseEnums.js` | **Allow-lists** for **`category`** (including **`renewal`**), **`renewal_kind`** (**`RENEWAL_KINDS`**), institution, frequency, **state**; **`spent_at`** → **`payment_day`** / **`payment_month`** helpers | Used by **`routes/expenses.js`**, **`routes/imports.js`**, **`routes/backup.js`** |
| `prescriptionEnums.js` | **`PRESCRIPTION_CATEGORIES`**, **`PRESCRIPTION_RENEWAL_PERIODS`** (**`one_month`** … **`eleven_months`**, **`one_year`** … **`five_years`**), **state**; **`parseIsoDate`** | **`routes/prescriptions.js`** |
| `recoveryCodeStorage.js` | Encrypt/decrypt recovery plaintext for **`users.recovery_code_ciphertext`**; **`persistRecoveryCodeForUser`** shared by **`auth`** and **`backup`** | `crypto`, `bcryptjs` |
| `middleware/auth.js` | Bearer JSON Web Token to **`req.userId`** | `jsonwebtoken` |
| `ensureJwtSecret.js` | Persist stable **`JWT_SECRET`** | filesystem write to `server/.env` |

---

## 4. Frontend application — pages and API surface

These diagrams show how **React** pages map to backend routes. The HTTP client uses Axios with `baseURL: "/api"`.

**Shell navigation (signed-in `Layout.jsx` header):** **Import** links to **`/expenses`**; **Lists** is a dropdown with **Expenses** (`/expenses/list`), **Renewals** (`/renewals`), **Prescriptions** (`/prescriptions`), and **Reports** (`/reports`) in that order. **Profile** and **Sign out** live in the avatar **account menu**, not in the main nav bar.

```mermaid
flowchart TB
  subgraph hdr [Layout header]
    IMP[Import]
    LST[Lists]
  end
  IMP -->|"/expenses"| EPn[ExpensesPage]
  LST --> L1["/expenses/list — YourExpensesPage"]
  LST --> L2["/renewals — RenewalsPage"]
  LST --> L3["/prescriptions — PrescriptionsPage"]
  LST --> L4["/reports — ReportsPage"]
```

**Pages and primary API mounts:**

```mermaid
flowchart TB
  subgraph pages [client/src/pages]
    LP[LoginPage]
    RP[RegisterPage]
    Rcv[RecoverPasswordPage]
    EP[ExpensesPage — Import]
    YEP["YourExpensesPage — /expenses/list (UI omits category renewal)"]
    NRP[RenewalsPage — /renewals]
    PSP[PrescriptionsPage — /prescriptions]
    RPg[ReportsPage]
    PP[ProfilePage]
  end

  subgraph api [Express paths under /api]
    A1["/auth — login register refresh oauth profile avatar recovery"]
    A2["/expenses — CRUD list ?category=renewal"]
    A3["/imports — upload staging commit"]
    A4["/reports"]
    A5["/backup — export restore"]
    A6["/prescriptions — CRUD"]
  end

  LP --> A1
  RP --> A1
  Rcv --> A1
  PP --> A1
  PP --> A5
  EP --> A3
  EP --> A2
  YEP --> A2
  NRP --> A2
  PSP --> A6
  RPg --> A4
```

**Expense, import, renewals, and backup at a glance:**

```mermaid
flowchart LR
  EP[ExpensesPage] --> IM["/imports + /expenses"]
  subgraph YEP["YourExpensesPage — /expenses/list"]
    direction TB
    YG["GET /expenses"]
    YV["Table + combined Projection omit category renewal"]
    YG --- YV
  end
  subgraph NRP["RenewalsPage — /renewals"]
    direction TB
    NG["GET ?category=renewal + CRUD"]
    NV["Header Projection: Active only omit state cancel"]
    NG --- NV
  end
  NRP --> EX["/expenses CRUD"]
  YEP --> EX
  subgraph PSPg["PrescriptionsPage — /prescriptions"]
    direction TB
    PG2["GET POST PATCH DELETE /prescriptions"]
    PG2 --- PGnote["next_renewal_date + renewal_period 1-11 mo or 1-5 yr"]
  end
  PSPg --> PRX["/prescriptions CRUD"]
  PP[ProfilePage] --> BK["/backup export · restore"]
```

### Prescription reminders (client)

**Prescription reminders** are **in-app only** (no email). **`Layout`** renders **`PrescriptionReminders`** after **`RenewalReminders`** on every authenticated shell route. The component loads **`GET /api/prescriptions?limit=500`**, applies **`prescriptionNeedsReminder`** from **`prescriptionSchedule.js`** (**active** rows whose **`next_renewal_date`** is within **30** calendar days or **1–14** days overdue). A **cyan** panel lists qualifying items (name, category, lead time). **`Dismiss for this visit`** hides the panel until the next full load; saves on **`PrescriptionsPage`** dispatch **`prescriptions-changed`** so the banner refreshes. See [PRESCRIPTIONS.md](./PRESCRIPTIONS.md).

```mermaid
flowchart TD
  L[Layout.jsx]
  PR[PrescriptionReminders.jsx]
  API["GET /api/prescriptions"]
  PS[prescriptionSchedule.js]
  L --> PR
  PR --> API
  PR --> PS
  PS --> D[daysUntilPrescriptionRenewal]
  PS --> N[prescriptionNeedsReminder]
```

### Renewal reminders (client)

**Upcoming renewals** are computed entirely in the browser from saved expenses (no dedicated API). **`Layout`** always renders **`RenewalReminders`** then **`PrescriptionReminders`** above the page **`Outlet`** on every authenticated shell route (**`/expenses`**, **`/expenses/list`**, **`/renewals`**, **`/prescriptions`**, **`/reports`**, **`/profile`**, and the index redirect). It loads expenses and keeps **`renewalSchedule.js`** in sync with the same **frequency** + **`spent_at`** rules as the server’s derived **`payment_day`** / **`payment_month`**. Matching rows are **grouped by financial institution** (display labels from **`expenseOptions.js`**): each group is a **section** with its own **sortable** **table** (expense, transaction date, amount, **state** (`active` / `cancel`), renews, **Dismiss**), a **Subtotal** footer, then a **Total (all institutions)** bar (**`formatProjectionCurrency`** in **`projection.js`**); both totals sum **active** rows only—**cancel** lines are excluded from amounts. Rows with **`state === cancel`** use **emerald** (green) styling. For about **two weeks** after a renewal date, the **25–40 day** reminder band is suppressed so the row stays off the list until the next charge is closer (**`isEarlyRenewalTierSuppressedAfterRecentOccurrence`** in **`renewalSchedule.js`**). **`Layout`** holds **`renewalTablesExpanded`** and passes it to **`RenewalReminders`**. Whenever eligible renewals exist, **`RenewalReminders`** passes **`onRenewalChipChange`** to **`Layout`** with a **count** and callbacks; **`Layout`** shows an **amber badge** to the **right** of the avatar that **toggles** table visibility, and an **account menu** (avatar **`details`**) with **Profile**, **Upcoming renewals** (to **show** tables or restore after all rows dismissed), and **Sign out**; choosing **Upcoming renewals** can clear **`sessionStorage`** dismiss keys and **`expandPanel`** so the panel reappears.

```mermaid
flowchart TD
  L[Layout.jsx]
  RR[RenewalReminders.jsx]
  API["GET /api/expenses?limit=500"]
  RS[renewalSchedule.js]
  L --> RR
  RR --> API
  RR --> RS
  RS --> N[nextRenewalDate]
  RS --> D[daysUntilRenewal]
  RS --> T[renewalReminderTier]
  T --> B1["Tier 5: 0-14 days until renewal"]
  T --> B2["Tier 15: 15-24 days"]
  T --> B3["Tier 30: 25-40 days"]
  T --> X[No row: 41+ days or non-recurring]
  RR --> TAB["Sections per institution: tables + subtotals + grand total"]
  RR -.->|"onRenewalChipChange (count, toggle, expand)"| L
```

**Day bands** (inclusive, whole local-calendar days from “today” to the next renewal date): **0–14**, **15–24**, **25–40**. They are **contiguous** so counts such as **12** days are not skipped between separate “about 15” and “about 5” windows. **`leadTimePhrase`** in **`RenewalReminders.jsx`** shows “in about 30 days” or “in about 15 days” only when the count is near those anchors; otherwise it uses **“in N days”**.

**Cross-cutting client pieces:**

| Concern | Implementation |
|---------|------------------|
| HTTP client | `api.js` — Axios with `/api` base URL; `Authorization` from `localStorage`; **401 Invalid token** triggers session-expired flow (except auth endpoints such as **`/auth/refresh`**) |
| Authentication state | `auth.jsx` — `AuthProvider`, protected routes, registers the session-invalid handler for `api.js` |
| Expired session prompt | `SessionExpiredModal.jsx` — **Continue session** → **`POST /auth/refresh`** → reload; **Sign out** → **`/login`** |
| Errors | `apiError.js` — network and proxy error messages |
| Labels versus server enums | `expenseOptions.js` — categories (including **Renewal**), **`RENEWAL_KIND_OPTIONS`** / **`formatRenewalKind`**, frequencies, institutions, **expense state** (**Active** / **Cancel**; API `active` / `cancel`). **`payment_day`** / **`payment_month`** on expenses are **not** client dropdowns; the API derives them from **`spent_at`**. |
| Main navigation (authenticated shell) | **`Layout.jsx`** — **Import**, **Lists** dropdown (**Expenses**, **Renewals**, **Prescriptions**, **Reports** in that order); avatar **account menu** (**Profile**, **Upcoming renewals** when applicable, **Sign out**) |
| Upcoming renewals | **`Layout.jsx`** (avatar menu, **badge** toggles tables, **`renewalTablesExpanded`**) + **`RenewalReminders.jsx`** + **`renewalSchedule.js`** — all main shell routes; see [Renewal reminders (client)](#renewal-reminders-client) |
| Single sign-on return route | `OAuthCallbackPage` at `/oauth/callback` — reads the JSON Web Token from the query string after the API redirect; same post-login navigation as email and password |
| Profile and recovery | `ProfilePage` at `/profile` — **`PATCH /auth/profile`**, **`POST`/`DELETE /auth/recovery-code`** (masked UI when **`has_recovery_code`**), **`POST`/`DELETE /auth/avatar`**, **`GET /backup/export`**, **`POST /backup/restore`** (client confirms when backup **`account.email`** differs from session); `RecoverPasswordPage` at `/recover` — **`POST /auth/recover-password`** |
| Renewals (odd-interval contracts) | `RenewalsPage` at **`/renewals`** — **`GET /expenses?category=renewal`** (list includes **Cancel** rows); manual add defaults to category **Renewal**; **`ExpenseTable`** with **`showRenewalColumns`** and **no** **`onRowProjection`** (no per-row **Projection** in Actions; header **Projection** uses **`projection.js`** on **Active** rows only—**`state`** **`cancel`** excluded client-side). **`YourExpensesPage`** passes **`onRowProjection`**. **Import** (`ExpensesPage`) adds staging columns for **renewal type** and **website** when category is **Renewal**. See [RENEWALS.md](./RENEWALS.md). |
| Prescriptions (health / supplies) | `PrescriptionsPage` at **`/prescriptions`** — **`/api/prescriptions`** CRUD; **`renewal_period`** (**monthly** **1–11** or **years** **1–5**) + **`next_renewal_date`**; **Renewed** advances date by calendar months or years. **`PrescriptionReminders`** + **`prescriptions-changed`**. See [PRESCRIPTIONS.md](./PRESCRIPTIONS.md). |
| Expenses list (`/expenses/list`) | **`YourExpensesPage`** — **`GET /expenses`** for fresh data; **renders** only rows where **`category !== renewal`** in the table and in **combined Projection**; changing a row’s category to **Renewal** (with a type) on save removes it from this view (it remains queryable on **`/renewals`**). |

### Renewals vs. Expenses list vs. Upcoming renewals (diagram)

```mermaid
flowchart TB
  subgraph data [PostgreSQL expenses]
    E["All rows per user"]
  end
  subgraph expList [Expenses page /expenses/list]
    L["GET /expenses — UI shows rows where category is not renewal"]
  end
  subgraph page [Renewals page /renewals]
    R["GET /expenses?category=renewal — renewal_kind from allow-list"]
  end
  subgraph banner [Upcoming renewals banner — client only]
    U["GET /expenses?limit=500 — recurring tiers — any category"]
  end
  E --> L
  E --> R
  E --> U
```

---

## 5. Data model (persistence)

Logical schema owned by the API (PostgreSQL). Redis holds **short-lived** report cache keys only.

```mermaid
erDiagram
  users ||--o{ expenses : has
  users ||--o{ prescriptions : has
  users ||--o{ oauth_identities : has
  users ||--o{ import_batches : has
  users ||--o{ import_staging_rows : has
  users ||--o{ monthly_summaries : has
  import_batches ||--o{ import_staging_rows : contains

  users {
    serial id PK
    text email UK
    text password_hash
    text avatar_url
    text recovery_lookup
    text recovery_token_hash
    text recovery_code_ciphertext
    timestamptz created_at
  }

  oauth_identities {
    serial id PK
    int user_id FK
    text provider
    text provider_user_id
    text email
  }

  expenses {
    serial id PK
    int user_id FK
    numeric amount
    text category
    text financial_institution
    text frequency
    text state
    smallint payment_day
    smallint payment_month
    text description
    text website
    text renewal_kind
    date spent_at
    timestamptz created_at
  }

  import_batches {
    serial id PK
    int user_id FK
    text source_filename
    text default_financial_institution
    text default_frequency
    timestamptz created_at
  }

  import_staging_rows {
    serial id PK
    int batch_id FK
    int user_id FK
    date spent_at
    numeric amount
    text description
    text category
    text frequency
    smallint payment_day
    smallint payment_month
    text website
    text renewal_kind
    timestamptz created_at
  }

  monthly_summaries {
    serial id PK
    int user_id FK
    smallint year
    smallint month
    numeric total
    timestamptz generated_at
  }

  prescriptions {
    serial id PK
    int user_id FK
    text name
    numeric amount
    text renewal_period
    date next_renewal_date
    text vendor
    text notes
    text category
    text state
    timestamptz created_at
  }
```

### Import pipeline (statement → `expenses`)

```mermaid
flowchart TB
  UP[User uploads CSV or PDF] --> PI["POST /api/imports"]
  PI --> ST[(import_staging_rows)]
  ST --> RV[Review UI: category frequency]
  RV --> PR{category is renewal?}
  PR -->|yes| RK[must set renewal_kind optional website]
  PR -->|no| OK[category only]
  RK --> CM
  OK --> CM["POST .../batches/:id/commit"]
  CM --> EX[(expenses)]
  ST --> PT["PATCH /imports/rows/:id"]
  PT --> ST
```

### Backup export and restore

```mermaid
flowchart LR
  PR[ProfilePage] --> EXP["GET /backup/export"]
  EXP --> FILE[JSON: account + expenses]
  FILE --> RST["POST /backup/restore"]
  RST --> PG[(PostgreSQL expenses + optional recovery)]
  PR --> RST
```

**`expenses.payment_day` / `payment_month`:** Persisted for renewals, imports, and backup JSON; the API always sets them from **`spent_at`** (calendar day of month capped at **30**, month **1–12**). **`POST`/`PATCH /api/expenses`** and **`POST /api/backup/restore`** ignore body values for those columns.

**`expenses.state`:** **`active`** (default) or **`cancel`**, constrained in PostgreSQL. Set on create and update via **`POST`/`PATCH /api/expenses`**; **import commit** inserts **`active`**; **backup** export and restore round-trip **`state`** (restore treats a missing **`state`** as **`active`**).

**`expenses.category`:** Allow-list includes **`renewal`**. When **`category`** is **`renewal`**, **`renewal_kind`** is **required** (API + restore validation); **`website`** is optional. Non-renewal rows store **`renewal_kind`** as **`NULL`**.

**`expenses.website` / `renewal_kind`:** Optional portal or URL and renewal subtype; see [RENEWALS.md](./RENEWALS.md).

**`users.recovery_code_ciphertext`:** Optional encrypted copy of the recovery code for **`GET /backup/export`** (see **`recoveryCodeStorage.js`**). **`users.recovery_lookup`** / **`recovery_token_hash`** remain the source of truth for **`POST /recover-password`**.

**Import data flow:** `POST /api/imports` replaces any previous `import_batches` for that user and inserts `import_staging_rows` (with `payment_day` / `payment_month` derived from each line’s `spent_at`). `PATCH /api/imports/rows/:id` may change **`category`**, **`frequency`**, **`renewal_kind`**, or **`website`** and refreshes `payment_day` / `payment_month` from `spent_at`. Changing **`category`** away from **`renewal`** clears **`renewal_kind`** on the staging row. `POST /api/imports/batches/:batchId/commit` moves rows that have a **category** and (for **`renewal`**) a **`renewal_kind`** into `expenses` (each new row **`state = active`**; **`website`** / **`renewal_kind`** on inserted rows apply only when **`category`** is **`renewal`**) and removes the batch.

---

## 6. Auth sequence (typical protected request)

This sequence shows a **development** setup where the browser talks to Vite first. Vite forwards the request to Express.

```mermaid
sequenceDiagram
  participant Browser
  participant Vite
  participant API as Express API
  participant PG as PostgreSQL

  Browser->>Vite: GET /api/expenses
  Vite->>API: proxy GET /api/expenses
  Note over API: auth middleware validates Authorization Bearer token
  API->>PG: SELECT ... WHERE user_id = sub
  PG-->>API: rows
  API-->>Vite: 200 JSON
  Vite-->>Browser: 200 JSON
```

**Expenses list page:** the browser may call **`GET /api/expenses`** the same way (no **`category`** query). The API returns **all** of the user’s rows; **`YourExpensesPage`** then **omits** rows whose **`category`** is **`renewal`** when building the table and the **combined Projection** (those rows are listed only on **`/renewals`**).

**Filtered list (Renewals page):** the same sequence applies with **`GET /api/expenses?category=renewal`** (and optional **`limit`**); the API adds **`AND category = $n`** after validating **`category`** against **`expenseEnums`**.

```mermaid
sequenceDiagram
  participant Browser
  participant Edge as Vite or nginx
  participant API as Express API
  participant PG as PostgreSQL

  Browser->>Edge: GET /api/expenses?category=renewal
  Edge->>API: proxy
  Note over API: JWT + parseCategory renewal
  API->>PG: SELECT ... WHERE user_id AND category = renewal
  PG-->>API: rows
  API-->>Edge: 200 JSON
  Edge-->>Browser: 200 JSON
```

**After you deploy to production**, the first network hop is not Vite: the browser talks to your **edge** server (for example nginx). Requests whose path begins with `/api` (for example `GET /api/expenses`) are forwarded to Express; **`GET /health`** can be proxied the same way (see **`deployment/docker/nginx.conf`**). The single-page application still issues `/api` requests when the static site and API share **one origin** behind that edge.

---

## 7. OAuth single sign-on (redirect flow)

When the user clicks a provider on **Login** or **Register**, this is the high-level flow. The **redirect URI** you register at the identity provider must be `{CLIENT_ORIGIN}/api/auth/oauth/{provider}/callback`. During development, the browser first contacts Vite; Vite proxies to Express. With **deployment Docker Compose**, the browser contacts **nginx** on the published **`HTTP_PORT`**; nginx proxies `/api` to the **api** service (replace **Vite** with **nginx** in the sequence mentally for that topology).

```mermaid
sequenceDiagram
  participant Browser
  participant Vite
  participant API as Express API
  participant IdP as Google/GitHub/GitLab/Microsoft
  participant PG as PostgreSQL

  Browser->>Vite: GET /api/auth/oauth/google (example)
  Vite->>API: proxy
  API->>API: create state, redirect
  API-->>Browser: 302 to IdP authorize URL
  Browser->>IdP: user consents
  IdP-->>Browser: 302 to .../oauth/google/callback?code=&state=
  Browser->>Vite: GET .../callback?code=&state=
  Vite->>API: proxy callback
  API->>IdP: POST token endpoint (code exchange)
  IdP-->>API: access_token
  API->>IdP: GET user profile / email
  IdP-->>API: profile
  API->>PG: find or create user and oauth_identities rows
  PG-->>API: user row
  API-->>Browser: 302 redirect to CLIENT_ORIGIN/oauth/callback with token query parameter (JSON Web Token)
  Browser->>Browser: OAuthCallbackPage stores token and navigates
```

After this flow completes, later API calls follow **section 6** (Bearer JSON Web Token on paths such as `/api/expenses`).

---

## Viewing these diagrams

- **GitHub:** Many Markdown previews render Mermaid diagrams.  
- **Visual Studio Code or Cursor:** Install a Mermaid preview extension if the built-in preview does not render diagrams.  
- **Export:** Copy a diagram into [mermaid.live](https://mermaid.live) to export PNG or SVG.

**Heading anchor identifiers on GitHub:** Links such as `./ARCHITECTURE.md#from-development-to-production` depend on GitHub-generated identifiers for headings. GitHub builds those identifiers using the same rules as the [`github-slugger`](https://github.com/Flet/github-slugger) **`slug()`** function: convert to lowercase, remove punctuation, replace spaces with hyphen characters. Examples used in this repository:

| Heading text in the Markdown file | URL fragment (after the hash) |
|---------|----------|
| `## From development to production` | `from-development-to-production` |
| `## 1b. From development to production (topology)` | `1b-from-development-to-production-topology` |

If you rename a heading, update every link that points to it. If two headings on the same page would produce the same slug, GitHub appends `-1`, `-2`, and so on.

---

[Architecture prose](./ARCHITECTURE.md) — [User guide](./USER_GUIDE.md) — [README: OAuth environment and troubleshooting](../README.md)
