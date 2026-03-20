# Expense Tracker — Architecture diagrams

Visual overview of **applications**, **runtime processes**, and **integrations**. For narrative design notes, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 1. System context (containers)

Who talks to whom at deployment boundaries: browser, Node apps, and data services.

```mermaid
flowchart TB
  subgraph actor [User]
    B[Web browser]
  end

  subgraph expense_tracker [Expense Tracker — this repo]
    subgraph fe [Frontend app — client/]
      RS[React SPA]
      VT[Vite dev server]
      VT -->|serves bundle + HMR| RS
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
  B -->|page JS calls /api/*| VT
  VT -->|"proxy /api → API_PROXY_TARGET<br/>default :4000"| EX
  EX -->|SQL node-postgres| PG
  EX -->|optional cache ioredis| RD
```

**Integrations (this diagram):**

| From | To | Protocol / mechanism |
|------|-----|----------------------|
| Browser | Vite | HTTP (HTML/JS/CSS), WebSocket (HMR) |
| Browser (via Vite) | Express | HTTP REST, path prefix `/api` proxied by Vite |
| Express | PostgreSQL | TCP, `DATABASE_URL`, SQL |
| Express | Redis | TCP, `REDIS_URL`, optional |
| Express | Google / GitHub / GitLab / Microsoft | OAuth 2.0 (browser redirect + HTTPS token endpoints); redirect URI on the SPA origin, proxied `/api` → API |

---

## 2. Runtime: development vs PM2

Two common ways to run the **same logical apps** (`expense-client`, `expense-api`); databases are unchanged.

```mermaid
flowchart LR
  subgraph terminals [Manual npm]
    T1["npm run dev<br/>client/ :5173"]
    T2["npm run dev<br/>server/ :4000"]
  end

  subgraph pm2 [PM2 — ecosystem.config.cjs]
    P1[expense-client<br/>Vite dev]
    P2[expense-api<br/>Node src/index.js]
  end

  DC[(Docker Compose<br/>Postgres + Redis)]

  T1 & T2 --> DC
  P1 & P2 --> DC
```

- **Manual:** two shells; Vite proxy must match API `PORT` (`client/.env` → `API_PROXY_TARGET`).  
- **PM2:** both processes from repo root; logs under `logs/`. Other PM2 apps on the host (e.g. unrelated projects) share the same PM2 daemon but are separate apps.

---

## 3. Backend application — modules and integrations

Everything inside the **Express** process and how it connects to libraries and data.

```mermaid
flowchart TB
  subgraph api [Express server/src/index.js]
    BOOT[index.js bootstrap]
    MW[CORS + JSON body<br/>+ error handler]
    R0["GET /health"]
    R1["/api/auth"]
    R2["/api/expenses"]
    R3["/api/imports"]
    R4["/api/reports"]
    BOOT --> MW
    MW --> R0
    MW --> R1
    MW --> R2
    MW --> R3
    MW --> R4
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
  R4 --> RDX
  R2 --> PG
  R3 --> PG
  R4 --> PG

  subgraph job [Background]
    CC --> PG
  end

  BOOT -.->|schedules| CC
```

| Module | Role | Integrations |
|--------|------|----------------|
| `routes/auth.js` | Register / login / `me` | `bcryptjs`, `jsonwebtoken`, `pg`; mounts **`oauth/*`** from `oauth/oauthRoutes.js` |
| `oauth/oauthRoutes.js` (+ `oauthService.js`, `oauthState.js`) | SSO: authorize + callback | `fetch` to IdPs, `pg` → `oauth_identities` |
| `routes/expenses.js` | Expense CRUD | JWT middleware, `pg`, `expenseEnums.js` |
| `routes/imports.js` | Upload → staging → commit | JWT, `multer`, `visaStatement.js` (CSV/PDF), `pg` |
| `routes/reports.js` | Aggregates + charts data | JWT, `pg`, optional `redis.js` |
| `parsers/visaStatement.js` | Parse statements | `csv-parse/sync`, `pdf-parse` |
| `jobs/monthlySummary.js` | Monthly rollup | `node-cron`, `pg` → `monthly_summaries` |
| `db.js` | Connection pool, `initDb()` | `pg` |
| `middleware/auth.js` | Bearer JWT → `req.userId` | `jsonwebtoken` |
| `ensureJwtSecret.js` | Stable `JWT_SECRET` | filesystem `server/.env` |

---

## 4. Frontend application — pages and API surface

How the **React** app maps UI to backend routes (all via Axios `baseURL: "/api"`).

```mermaid
flowchart LR
  subgraph pages [client/src/pages]
    LP[LoginPage]
    RP[RegisterPage]
    EP[ExpensesPage]
    YEP[YourExpensesPage]
    RPg[ReportsPage]
  end

  subgraph api [Express /api]
    A1["/auth/login, register, oauth/..."]
    A2["/expenses"]
    A3["/imports ..."]
    A4["/reports/..."]
  end

  LP --> A1
  RP --> A1
  EP --> A2 & A3
  YEP --> A2
  RPg --> A4
```

**Cross-cutting client integrations:**

| Concern | Implementation |
|---------|------------------|
| HTTP client | `api.js` — Axios, `/api` base, `Authorization` from `localStorage` |
| Auth state | `auth.jsx` — `AuthProvider`, protected routes |
| Errors | `apiError.js` — network / proxy messages |
| Labels vs server enums | `expenseOptions.js` |
| SSO return route | `OAuthCallbackPage` (`/oauth/callback`) — reads JWT from query after API redirect; same post-login landing as email/password |

---

## 5. Data model (persistence)

Logical schema the API owns (Postgres). Redis holds **ephemeral** report cache keys only.

```mermaid
erDiagram
  users ||--o{ expenses : has
  users ||--o{ oauth_identities : has
  users ||--o{ import_batches : has
  users ||--o{ import_staging_rows : has
  users ||--o{ monthly_summaries : has
  import_batches ||--o{ import_staging_rows : contains

  users {
    serial id PK
    text email UK
    text password_hash
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
    smallint payment_day
    text description
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
```

**Import flow (data):** `POST /api/imports` replaces prior `import_batches` for the user, inserts `import_staging_rows`; `POST .../commit` moves categorized rows into `expenses` and deletes the batch.

---

## 6. Auth sequence (typical protected request)

```mermaid
sequenceDiagram
  participant Browser
  participant Vite
  participant API as Express API
  participant PG as PostgreSQL

  Browser->>Vite: GET /api/expenses
  Vite->>API: proxy GET /api/expenses
  Note over API: authRequired reads Bearer token
  API->>PG: SELECT ... WHERE user_id = sub
  PG-->>API: rows
  API-->>Vite: 200 JSON
  Vite-->>Browser: 200 JSON
```

---

## 7. OAuth SSO sign-in (redirect flow)

High-level flow when the user clicks a provider on **Login** / **Register**. The **redirect URI** registered at the IdP is `{CLIENT_ORIGIN}/api/auth/oauth/{provider}/callback` (browser hits Vite → proxied to Express).

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
  API->>PG: findOrCreate user + oauth_identities
  PG-->>API: user row
  API-->>Browser: 302 to CLIENT_ORIGIN/oauth/callback?token=JWT
  Browser->>Browser: OAuthCallbackPage stores JWT, navigates
```

After this, subsequent API calls match **§6** (Bearer JWT on `/api/expenses`, etc.).

---

## Viewing these diagrams

- **GitHub:** Markdown preview renders Mermaid in many views.  
- **VS Code / Cursor:** use a Mermaid preview extension if built-in preview does not draw.  
- **Export:** paste into [mermaid.live](https://mermaid.live) for PNG/SVG.

---

[← Architecture prose](./ARCHITECTURE.md) · [User guide](./USER_GUIDE.md) · [README — OAuth env & troubleshooting](../README.md)
