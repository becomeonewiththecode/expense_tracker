# Expense Tracker — Architecture and design

This document describes how the application is structured, how major components interact, and the main design choices.

**Diagrams:** See [**ARCHITECTURE_DIAGRAM.md**](./ARCHITECTURE_DIAGRAM.md) for figures that illustrate: the system context (section 1), the topology from local development through a production deployment (section 1b), running processes with manual `npm` commands or PM2 during development, server modules, how client pages map to API routes, **renewal reminder tiers** (client-only math and day bands; **UI on all authenticated shell routes** via **`Layout`**, grouped by institution with a **header chip** when all rows are dismissed), the entity-relationship model, a typical authenticated request sequence, and the OAuth single sign-on redirect sequence. Narrative docs for **Docker Compose production**, **password recovery**, and **backup/restore** are in [USER_GUIDE.md](./USER_GUIDE.md) and [deployment/docker-compose/README.md](../deployment/docker-compose/README.md).

## High-level overview

The diagram in this section describes **local development**. When you are ready to ship: you run the Vite **production build**, serve the generated **`dist/`** directory as static files, and run the API behind **Transport Layer Security** and a **reverse proxy** (or on a separate host). See [**From development to production**](#from-development-to-production) and [Architecture diagrams, section 1b](./ARCHITECTURE_DIAGRAM.md#1b-from-development-to-production-topology).

During local development, the system follows a **three-tier** pattern:

```mermaid
flowchart LR
  subgraph browser [Browser]
    UI[React SPA]
  end
  subgraph host [Host machine]
    Vite[Vite dev server]
    API[Express API]
    PG[(PostgreSQL)]
    RD[(Redis)]
  end
  UI -->|"/api" proxy| Vite
  Vite -->|HTTP| API
  API --> PG
  API --> RD
```

- **Client:** The Vite development server serves a **React** single-page application, styled with Tailwind, with routes handled by React Router and HTTP calls made with Axios.  
- **Server:** A **Node.js** **Express** Representational State Transfer API, **JSON Web Token** bearer authentication, the **node-postgres** library (`pg`) for SQL, and **ioredis** for optional caching.  
- **Infrastructure (local):** Docker Compose can provide **PostgreSQL** and **Redis**. The API and single-page application are started with **npm** scripts; the default `docker-compose.yml` does not containerize those Node processes.

---

## From development to production

The lifecycle is **development first**, **production second**: you run and test on your machine, **then** build and deploy the same codebase to a hosted environment.

### Development (local)

- **Frontend:** The **Vite development server** runs the `vite` command and listens on a port such as **5173**. It serves source files with **Hot Module Replacement** (updates in the editor refresh parts of the page without a full reload) and **proxies** requests whose path begins with **`/api`** to the Express API.  
- **API:** **Express** listens on the port given by the `PORT` environment variable (for example **4000**). It is reachable through the Vite proxy or by calling the API host and port directly.  
- **Single-page application to API:** The browser treats the Vite origin (for example `http://localhost:5173`) as the **same origin** for JavaScript. Requests to **`/api`** are forwarded by Vite to the URL in **`API_PROXY_TARGET`** inside `client/.env`.  
- **PostgreSQL:** Runs locally or via Docker Compose. **Redis** is optional and used to cache report responses.  
- **Configuration:** Environment variables live in `server/.env` and `client/.env`.  
- **OAuth:** **`CLIENT_ORIGIN`** is typically `http://localhost:5173` during development. Identity-provider redirect URLs must match that origin.

### Production (deployed)

- **Build step:** Change into the `client` directory and run **`npm run build`**. That command runs the production build (Vite `build`) and writes static files—HTML, JavaScript, and CSS—into **`client/dist/`**. **Do not** run the Vite **development** server for end users. Serve only the contents of **`dist/`** from a static file server.  
- **Frontend hosting:** Use **nginx**, **Caddy**, a cloud object store with a content delivery network, a platform-as-a-service static host, or similar.  
- **API:** The same **Express** application, typically behind **Transport Layer Security**, a **process manager** (systemd, PM2, Docker), or **orchestration** software.  
- **Single-page application to API:** Often **one public origin** where the edge server routes `/` to static files and `/api` to Node.js, so the built client can keep `baseURL: "/api"`. Alternatively, **two origins** (separate URLs for the static site and the API) with **Cross-Origin Resource Sharing** configured on Express.  
- **Health checks:** **`GET /health`** on the API returns JSON `{ ok: true }`. In **`deployment/docker`**, nginx proxies **`GET /health`** at the same public origin so monitors can hit the edge without a separate API port mapping.  
- **PostgreSQL and Redis:** Managed services or hardened self-hosted instances; backups; **secrets** supplied through environment variables or a secret manager (never commit production secrets to the repository).  
- **OAuth:** **`CLIENT_ORIGIN`** and identity-provider redirect URLs use your public **HTTPS** application URL (scheme, host, and port must match what users type).

**Summary:** During **development**, you run Vite, Express, PostgreSQL, and optionally Redis. **After that**, in **production**, you serve the static bundle produced by **`npm run build`**, run Express with PostgreSQL and optional Redis, terminate **HTTPS** at the edge, and route paths for `/` versus `/api` accordingly.

**Container deployment:** The repository includes **`deployment/docker-compose/`** for a full stack on one host (Postgres, Redis, API, nginx serving **`dist/`** with **`/api`** and **`/health`** proxies; persistent volumes for data, Redis append-only file, and API uploads). From the repo root, **`npm run compose:prod`** runs **`node deployment/docker-compose/ensure-env.mjs`** (creates **`.env`** and a random **`JWT_SECRET`** when needed), then **`docker compose … up -d --build`** with **`--env-file deployment/docker-compose/.env`**. The **api** service uses **`env_file: .env`** beside the Compose file so **`JWT_SECRET`** and **`CLIENT_ORIGIN`** reach the container without being overridden by empty **`${VAR}`** substitution. See [deployment/docker-compose/README.md](../deployment/docker-compose/README.md). **`deployment/kubernetes/`** targets a cluster; see [deployment/README.md](../deployment/README.md).

---

## Repository layout

| Path | Role |
|------|------|
| `client/` | Frontend single-page application (Vite, React, Tailwind). |
| `server/` | Backend API (Express, ECMAScript modules via `"type": "module"` in `package.json`). |
| `docker-compose.yml` | PostgreSQL and Redis for local development. |
| `docs/` | User-facing and architecture documentation. |
| `deployment/` | Dockerfiles, production Docker Compose stack, and Kubernetes manifests. |
| Root `package.json` | Optional scripts: **`npm run compose:prod`** (runs **`ensure-env.mjs`** then Compose **up**), **`npm run compose:ensure-env`**, **`compose:prod:down`**, **`compose:prod:logs`**, **`compose:prod:ps`**. |

---

## Client architecture

### Stack

- **React 18** with function components.  
- **React Router version 6** — Public routes include `/login`, `/register`, **`/recover`** (password reset with a saved recovery code; no email is sent), and **`/oauth/callback`** (return URL after single sign-on). Authenticated users use a private shell with routes such as `/`, `/expenses`, `/expenses/list`, `/reports`, and **`/profile`**. **Post-login navigation:** the app calls `GET /api/expenses?limit=1`. If at least one expense exists, the user is sent to **`/expenses/list`**; otherwise to **`/expenses`**. The same rule applies for the index route `/`, successful login or registration, successful OAuth, and visits to `/login` while already signed in.  
- **Tailwind CSS** — Utility-first styling with a dark theme.  
- **Axios** — A single HTTP client instance with `baseURL: "/api"`. **`FormData`** uploads omit the `Content-Type` header so the browser sets the multipart boundary automatically.  
- **Recharts** — Bar charts on the Reports page.  

### Authentication flow

- Tokens and user profile fragments are stored in the browser’s **`localStorage`** (keys defined in `authStorage.js`).  
- An Axios **request interceptor** in `api.js` adds `Authorization: Bearer <token>` to **every** request, reading the current token from `localStorage`. That avoids a race where child components issued API calls before a `useEffect` could set default headers (a historical “Missing token” issue).  
- A **response interceptor** in `api.js` detects **401** responses whose JSON **`error`** is **`Invalid token`** (for example an **expired** JWT) on protected routes, then notifies **`AuthProvider`** once so the user can choose **Continue session** (see **`SessionExpiredModal.jsx`** and **`POST /api/auth/refresh`**). Login, register, recover-password, and refresh requests are excluded from this hook to avoid loops.  
- **`AuthProvider`** in `auth.jsx` exposes session state (`setSession`, `logout`) to the component tree and renders **`SessionExpiredModal`** when an expired token is detected.  
- **Protected routes** wrap the main layout and redirect unauthenticated users to `/login`.  
- **Single sign-on:** **`SsoButtons`** send the browser to `GET /api/auth/oauth/:provider` (proxied to Express). The API redirects to the identity provider, then handles `GET /api/auth/oauth/:provider/callback`, exchanges the authorization code, issues a JSON Web Token, and redirects the browser to **`/oauth/callback?token=…`** or **`/oauth/callback?error=…`**. **`OAuthCallbackPage`** stores the token and uses the same post-login navigation as email-and-password flows.

### Development-only proxy

- **`vite.config.js`** uses `loadEnv` so **`API_PROXY_TARGET`** from `client/.env` can point the `/api` proxy at the correct host and port (for example when the API does not use port 4000).  
- This proxy runs **only during development**. After **`npm run build`**, static hosting does not run Vite. See [From development to production](#from-development-to-production).

### Domain helpers

- **`expenseOptions.js`** — Canonical option lists and display formatters for **category**, **frequency**, **financial institution**, and **expense state** (**Active** / **Cancel**, API values `active` / `cancel`). **Frequency** allow-list: `once`, `weekly`, `monthly`, `bimonthly`, `yearly`. The server derives **`payment_day`** and **`payment_month`** from **`spent_at`** on create and update.  
- **`projection.js`** — Derives annual recurring totals from each row’s **amount** and **frequency** for **Projection** modals and pie charts: weekly × 52, monthly × 12, bi-monthly × 6, yearly × 1; **once** contributes to one-time totals only. **`payment_day`** and **`payment_month`** are not used in projection math.  
- **`renewalSchedule.js`** — Computes the next local-calendar renewal date from **frequency** and **`spent_at`** (day-of-month capped at 30; yearly uses the transaction’s calendar month). **`renewalReminderTier(daysUntil)`** assigns **three contiguous bands** (whole calendar days until renewal): **0–14**, **15–24**, and **25–40**; outside that range no banner line is shown. For about **two weeks** after a renewal date, the **25–40** day band is suppressed so a row does not reappear immediately for the following cycle’s early window. **`RenewalReminders.jsx`** uses **`nextRenewalDate`**, **`daysUntilRenewal`**, **`isEarlyRenewalTierSuppressedAfterRecentOccurrence`**, and **`renewalReminderTier`** so bands do not leave gaps (for example 12 days still qualifies).

### Pages

- **`LoginPage` and `RegisterPage`** — Email and password forms; **`SsoButtons`** for Google (Gmail), GitHub, GitLab, and Microsoft 365 when OAuth is configured; link to **`/recover`**; error display uses **`apiError.js`** where applicable.  
- **`RecoverPasswordPage`** at `/recover` — **`POST /api/auth/recover-password`** with a **recovery code** (created in Profile) and a new password; does not send email.  
- **`OAuthCallbackPage`** at `/oauth/callback` — Reads **`token`** or **`error`** from the query string after the API redirects from **`GET /api/auth/oauth/:provider/callback`**, stores the JSON Web Token, and applies the same post-login navigation as password-based flows.  
- **`ProfilePage`** at `/profile` — Change **email** and **password**; single-sign-on-only users can **set an initial password** here; **generate or remove a recovery code** (`POST` / `DELETE /api/auth/recovery-code`); when a code exists, the UI shows a **masked placeholder** (the plaintext is shown **only once**, at creation or replace); **profile picture** (`POST` / `DELETE /api/auth/avatar`); **`GET /api/backup/export`** and **`POST /api/backup/restore`** for JSON expense backup and restore (**append** or **replace**); **`PATCH /api/auth/profile`** may return a new token when the email changes.  
- **`ExpensesPage`** — Titled **Import** in navigation; onboarding when there are no saved expenses; later, import plus optional collapsible manual entry; links to the list page. **`YourExpensesPage`** at `/expenses/list` — Table of expenses with modification mode (transaction date, amount, category, frequency, institution, note); manual add (same fields as Import) when empty or under **Add expense manually**; empty state also links to **Import**. Statement import staging lives on **Import**, then commit.  
- **`ReportsPage`** — Tabbed report types, fetches report endpoints, shows monthly summary list.  
- **`Layout`** — Navigation and sign-out; renders **`RenewalReminders`** on every main tab (**Import**, **Your expenses**, **Reports**, **Profile**) (fetches **`GET /api/expenses?limit=500`**, filters recurring rows by **`renewalReminderTier`**, shows **one table per financial institution** with **Subtotal** rows and a **Total (all institutions)** band (**Active** amounts only; **Cancel** excluded), per-row and **Dismiss all** with keys in **`sessionStorage`**). When every visible row is dismissed but eligible renewals remain, **`RenewalReminders`** reports a **count** and expand callback to **`Layout`**, which shows an **amber chip** beside the user profile; clicking it clears dismiss state and restores the panel.  
- **`SessionExpiredModal`** — Global dialog when the API returns **Invalid token**; **Continue session** calls **`POST /api/auth/refresh`** with the stored Bearer token, then **`setSession`** and a full page reload; **Sign out** clears the session and sends the user to **`/login`**.

---

## Server architecture

### Entry and lifecycle

- **`index.js`** loads environment variables (`dotenv`), runs **`ensureJwtSecret()`** (in **non-production**, generate and persist weak/missing `JWT_SECRET` to **`server/.env`**; in **`NODE_ENV=production`**, exit if unset/weak so Docker relies on host **`.env`**—see **`deployment/docker-compose/ensure-env.mjs`**), runs **`initDb()`** (data definition language and additive migrations), starts the **monthly summary** scheduled job, then calls **`listen`** on `PORT`.  
- **Cross-Origin Resource Sharing** allows `CLIENT_ORIGIN` or reflects an open configuration in development.

### Routing

| Mount | Responsibility |
|--------|----------------|
| `GET /health` | Liveness check; no authentication. |
| `/api/auth` | `POST /register` and `POST /login` use bcrypt for passwords and issue JSON Web Tokens; **`GET /me`** requires a token and returns **`id`**, **`email`**, **`avatar_url`**, **`has_password`**, **`has_recovery_code`**; **`POST /refresh`** re-issues a JWT from an **expired** token if the signature is valid and the user still exists (grace period after **`exp`**); **`PATCH /profile`** updates email and/or password (SSO-only users can set a first password without a current password); **`POST /recovery-code`** and **`DELETE /recovery-code`** (authenticated) create or clear an offline **recovery code**; **`POST /recover-password`** (unauthenticated, rate-limited) resets password from that code—**no email**; **`POST /avatar`** (multipart image) and **`DELETE /avatar`** manage profile pictures (files under **`server/uploads`**, served at **`/api/uploads`**); **`GET /oauth/:provider`** and **`GET /oauth/:provider/callback`** implement the OAuth2 authorization code flow for `google`, `github`, `gitlab`, and `microsoft`, find or create users and **`oauth_identities`** rows, then redirect the browser to `CLIENT_ORIGIN/oauth/callback` with a token. |
| `/api/expenses` | Create, read, update, delete for expenses; optional **`state`**: **`active`** (default) or **`cancel`**; **`payment_day`** (1–30) and **`payment_month`** (1–12) are **set from `spent_at`** on create and update (ignored if sent in the body); **JSON Web Token required**. |
| `/api/imports` | Statement upload into **`import_batches`** and **`import_staging_rows`**; per-row **category** and **frequency**; staging and commit derive **`payment_day`** / **`payment_month`** from each line’s **`spent_at`**; **commit** inserts into **`expenses`** only where **category** is set (**`state`** **`active`** on each new row); **JSON Web Token required**. |
| `/api/reports` | Aggregated spending endpoints and list of persisted summaries; **JSON Web Token required**. |
| `/api/backup` | **`GET /export`** — JSON download of all expenses for the signed-in user (`format` **`expense-tracker-backup`**, `version` **1**, metadata + `expenses` array including **`state`** per row). **`POST /restore`** — body is that backup object plus **`mode`**: **`append`** inserts rows, **`replace`** deletes the user’s expenses first (transaction); validates each row like **`POST /expenses`** (missing **`state`** defaults to **`active`**); at most **25,000** expenses per request; JSON body limit **15 MB** on this route. **JSON Web Token required** for both (expired or wrong-secret tokens yield **401**). |

### Authentication

- The **JSON Web Token** payload uses **`sub`** as the user id; **`middleware/auth.js`** normalizes **`sub`** to a positive integer before **`req.userId`** is set.  
- Protected route handlers read **`req.userId`**.  
- Users who registered with a password have **`password_hash`** set. **Single-sign-on-only** users may have **`password_hash`** null until they set a password in **Profile**; until then, password login directs them to sign in with a provider or set a password after SSO (`routes/auth.js`).  
- **Password recovery without email:** Users who generated a code in Profile store **`recovery_lookup`** and a bcrypt hash of the secret token; **`POST /recover-password`** verifies the pasted code, sets a new **`password_hash`**, and clears recovery fields (one-time use).  
- **OAuth** code in `server/src/oauth/`: short-lived random **`state`** (CSRF protection), per-provider token exchange and profile retrieval, **link or create** user by email and identity (`oauth_identities`).  
- **`POST /refresh`** verifies the Bearer JWT with **`ignoreExpiration: true`** (signature and **`sub`** must be valid), reloads the user from **`users`**, and issues a new token. If the token had an **`exp`** claim, refresh is refused when too long after that expiry (grace window in **`routes/auth.js`**).  
- Authentication errors return HTTP **401** with JSON `{ error: ... }`. PostgreSQL connectivity issues may return **503** with a clearer message where detected (`routes/auth.js`).

### Expenses domain

- **Validation** uses **allow-lists** for category, `financial_institution`, `frequency` (`once`, `weekly`, `monthly`, `bimonthly`, `yearly`; matching client dropdowns), and **`state`** (`active`, `cancel`; default **`active`** on create if omitted). **`payment_day`** (1–30) and **`payment_month`** (1–12) are set by the server from **`spent_at`** (request body values for those fields are ignored on create/update).  
- Dates are stored as **`DATE`** (`spent_at`); amounts as **`NUMERIC`**.  
- List endpoints support optional `from` and `to` query filters and pagination limits.  
- **Statement import:** **`multer`** and **`parseVisaStatement.js`** populate staging tables. The upload form sets **institution** and **frequency**. Each staging row’s **`payment_day`** and **`payment_month`** are derived from that line’s **`spent_at`**. The user assigns **category** (required to import) and may adjust **frequency** per row; **commit** writes only categorized rows to **`expenses`**, taking **`financial_institution`** from the batch and **`frequency`** from the row, setting **`state`** to **`active`**, and recomputing **`payment_day`** / **`payment_month`** from **`spent_at`**. **`pdf-parse`** is loaded via a subpath import to avoid an ECMAScript module debug harness issue.

### Reports

- Separate handlers for **daily**, **weekly**, **monthly**, **yearly**, and **custom range** queries; responses include **series** for charts and **totals**.  
- **Redis:** Report payloads may be cached with a short time-to-live (about two minutes) when `REDIS_URL` is set; failures fall back to uncached database queries.  

### Background job

- **`node-cron`** schedules a job (documented as **03:00 UTC on day 1** of each month) that aggregates **the previous calendar month** per user into **`monthly_summaries`**, using upserts.  
- This job is **separate** from interactive reporting (live reports always read **`expenses`**).

---

## Data model

### `users`

Columns include **`id`**, **`email`** (unique), **`password_hash`** (nullable for single-sign-on-only accounts), optional **`avatar_url`** (path to an uploaded profile image), optional **`recovery_lookup`** and **`recovery_token_hash`** (offline password recovery; both cleared after a successful reset), **`created_at`**.

### `oauth_identities`

**`user_id`** references **`users`**. **`provider`** is one of `google`, `github`, `gitlab`, `microsoft`. **`provider_user_id`** and **`email`** store identity data; uniqueness is enforced on **`(provider, provider_user_id)`**.

### `expenses`

**`user_id`** references **`users`**, plus **`amount`**, **`category`**, **`financial_institution`**, **`frequency`**, **`state`** (`active` or `cancel`, default **`active`**), **`payment_day`** (day of month 1–30, derived from **`spent_at`**), **`payment_month`** (calendar month 1–12, derived from **`spent_at`**), **`description`**, **`spent_at`**, **`created_at`**.  
An index on **`(user_id, spent_at)`** supports typical lists and reports.  
Schema changes use **`CREATE TABLE IF NOT EXISTS`** and **`ALTER TABLE … ADD COLUMN IF NOT EXISTS`** so existing databases upgrade when the API starts.

### `monthly_summaries`

**`user_id`**, **`year`**, **`month`**, **`total`**, **`generated_at`**, with a unique constraint on **`(user_id, year, month)`** for idempotent updates from the cron job.

### `import_batches` and `import_staging_rows`

- **`import_batches`:** **`user_id`**, **`source_filename`**, **`default_financial_institution`**, **`default_frequency`**. A new upload **deletes** prior batches for that user (cascade deletes old staging rows).  
- **`import_staging_rows`:** **`batch_id`**, **`spent_at`**, **`amount`**, **`description`**, **`category`** nullable until required for commit, **`frequency`**, **`payment_day`** (1–30; derived from **`spent_at`**), **`payment_month`** (1–12; derived from **`spent_at`**). **`PATCH /api/imports/rows/:id`** updates **`category`** and **`frequency`**; **`payment_day`** / **`payment_month`** are recomputed from **`spent_at`** after each patch.

---

## Cross-cutting design decisions

1. **Stateless JSON Web Token sessions** — No server-side session store; easier horizontal scaling, but no instant server-side revocation without extra machinery (for example a token blocklist). **`POST /refresh`** extends usability after expiry within a bounded grace window without storing refresh tokens.  
2. **Allow-lists on the API** — Prevents arbitrary strings for enum-like fields even if the user interface is bypassed.  
3. **Additive database migrations in `initDb`** — Simple for a small application; larger teams might adopt explicit migration tools.  
4. **Frequency as metadata** — Stored for the user’s records; **reporting** uses **`spent_at`**, not projected recurring charges into future periods.  
5. **`payment_day` / `payment_month` from `spent_at`** — Those columns are denormalized from the transaction date (day capped at 30) for renewals, imports, and backup JSON. Create, update, import commit, and restore **recompute** them; request bodies cannot override them independently of **`spent_at`**.  
6. **Redis optional** — Behavior is correct without Redis; with Redis, repeated report reads cost less.  
7. **OAuth optional** — Each provider is enabled only when its **`OAUTH_*`** client identifier and secret are set; unconfigured providers return HTTP **503** on `GET /oauth/:provider`. Identity linking uses **`oauth_identities`** and email matching for existing **`users`** rows.

---

## Related files

| Concern | Location |
|---------|-----------|
| Database bootstrap | `server/src/db.js` |
| JSON Web Token secret bootstrap | `server/src/ensureJwtSecret.js` (dev **`server/.env`**); Compose host bootstrap **`deployment/docker-compose/ensure-env.mjs`** |
| Authentication routes | `server/src/routes/auth.js` |
| OAuth (single sign-on) | `server/src/oauth/oauthRoutes.js`, `oauthService.js`, `oauthState.js` |
| Expense routes | `server/src/routes/expenses.js` |
| Import staging and commit | `server/src/routes/imports.js` |
| Category, institution, frequency, **state** enums; **`spent_at`** → **`payment_day`** / **`payment_month`** | `server/src/expenseEnums.js` |
| Statement parsing | `server/src/parsers/visaStatement.js` |
| Report routes and cache | `server/src/routes/reports.js`, `server/src/redis.js` |
| Backup and restore | `server/src/routes/backup.js` |
| Monthly job | `server/src/jobs/monthlySummary.js` |
| Client HTTP client, token storage, session-expired UI | `client/src/api.js`, `client/src/authStorage.js`, `client/src/components/SessionExpiredModal.jsx` |
| Renewal date math, grouped reminder UI, header chip when fully dismissed | `client/src/renewalSchedule.js`, `client/src/components/RenewalReminders.jsx`; mounted from **`Layout.jsx`** on all authenticated shell routes |
| Single sign-on user interface | `client/src/components/SsoButtons.jsx`, `client/src/pages/OAuthCallbackPage.jsx` |
| Profile and recovery | `client/src/pages/ProfilePage.jsx`, `client/src/pages/RecoverPasswordPage.jsx` |
| Expense enums and labels | `client/src/expenseOptions.js` |

For day-to-day usage, see [USER_GUIDE.md](./USER_GUIDE.md).
