# Expense Tracker

**Documentation index:** [User guide](./docs/USER_GUIDE.md) (accounts, import, **Lists** menu (**Expenses**, **Renewals**, **Prescriptions**, **Reports**), **Expenses** list excluding renewal-category rows, **recovery codes**, **backup/restore** with **`account`** labeling and optional **`recoveryCode`** in JSON, **expired-session refresh**, **production Compose** / **`ensure-env` JWT bootstrap**, expense **State** Active/Cancel, **renewal** and **prescription** reminder banners on main screens; **Profile** / **Sign out** / **Upcoming renewals** in the **avatar menu**; **amber count badge** beside the avatar toggles renewal tables when reminders qualify). [Renewals](./docs/RENEWALS.md) (category **`renewal`**, **`renewal_kind`**, import staging, **`/renewals`**, vs. **Expenses** table; combined **Projection** excludes **State** **Cancel**). [Prescriptions](./docs/PRESCRIPTIONS.md) (**`/prescriptions`**, **`prescriptions`** table, **`renewal_period`** monthly **1–11** or **1–5 years**, **`next_renewal_date`**, ~**30-day** in-app reminders). [Architecture](./docs/ARCHITECTURE.md) and [Architecture diagrams](./docs/ARCHITECTURE_DIAGRAM.md) (OAuth, topology, data model including **`expenses.website`** / **`renewal_kind`**, **`prescriptions`**, **`POST /auth/refresh`**, backup routes and **409** cross-account restore, **`recovery_code_ciphertext`**, **recurring metadata derived from transaction date**, **renewal reminder routes**). [PM2 and controlling applications](./docs/HOWTO_CONTROLLING_APPLICATIONS.md). **[Deployment](./deployment/README.md)** (Docker Compose **`npm run compose:prod`**, Kubernetes).

This is a full-stack application. The **client** uses React, Tailwind CSS, Recharts, React Router, and Axios. The **server** uses Express, PostgreSQL, JSON Web Tokens for authentication, and optional Redis caching. Optional **OAuth**-based single sign-on is supported for Google, GitHub, GitLab, and Microsoft 365. A scheduled **cron** job writes **monthly summary** rows to the database.

## Prerequisites

- Node.js version 20 or newer
- Docker (optional, for running PostgreSQL and Redis locally)

## Production on one host (Docker Compose)

Full stack (Postgres, Redis, API, nginx + built client): from the repo root run **`npm run compose:prod`**. It runs **`node deployment/docker-compose/ensure-env.mjs`**, which creates **`deployment/docker-compose/.env`** from **`.env.example`** if needed and writes a random **`JWT_SECRET`** when the line is empty or too short (stable on disk, gitignored). Edit **`CLIENT_ORIGIN`** (and optional **`OAUTH_*`**) in that **`.env`** as needed. You can run **`npm run compose:ensure-env`** alone, or follow the manual **`docker compose …`** flow in [deployment/docker-compose/README.md](deployment/docker-compose/README.md) (use **`--env-file deployment/docker-compose/.env`** on the host command so **`HTTP_PORT`** and Postgres-related values interpolate). For how the **Dockerfiles** fit into dev (DB-only Compose) vs production (full stack), see [deployment/docker/README.md](deployment/docker/README.md).

## Database and cache

Run the following command to start containers (from the project root):

```bash
docker compose up -d
```

Containers are named **`expense-tracker-dev-postgres`** and **`expense-tracker-dev-redis`** (see [deployment/docker/README.md](deployment/docker/README.md)). Copy `server/.env.example` to `server/.env` and edit values as needed. The default connection string matches the Docker Compose service names:

- `DATABASE_URL=postgresql://expense:expense@localhost:5432/expense_tracker`
- `REDIS_URL=redis://localhost:6379`
- **`JWT_SECRET`** — **Local API** (`server/`, not `NODE_ENV=production`): if the secret is missing, shorter than 16 characters, or still a `change-me…` placeholder, **`ensureJwtSecret()`** generates one and writes **`server/.env`**. **Production Docker Compose** does not auto-generate inside the container; use **`deployment/docker-compose/.env`** on the host. **`npm run compose:prod`** runs **`deployment/docker-compose/ensure-env.mjs`** so **`JWT_SECRET`** is filled there automatically when unset. You can also set secrets manually with `openssl rand -base64 32`.
- **`CLIENT_ORIGIN`** — Must match the URL users type in the browser to open the single-page application, for example `http://localhost:5173`. This value is required for OAuth redirect URLs after single sign-on and for Cross-Origin Resource Sharing in setups that behave like production.
- **OAuth (optional):** Set environment variables `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, and the same pattern for GitHub, GitLab, and Microsoft as needed. Optional variables include `OAUTH_GITLAB_BASE_URL` (defaults to GitLab.com if unset) and `OAUTH_MICROSOFT_TENANT` (defaults to `common` if unset). See the comments in `server/.env.example` for the full list.

## Run with PM2 (optional)

From the **repository root**, after installing dependencies in the root `package.json`, in `server/`, and in `client/`:

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
npm run pm2:start
```

This starts **expense-api** (the Express server, with file watching on `server/src`) and **expense-client** (the Vite development server). Standard output and error logs are written under `logs/`.

| Command | Purpose |
|--------|---------|
| `npm run pm2:start` | Register and start both applications (or start them if they are already registered) |
| `npm run pm2:stop` | Stop both applications |
| `npm run pm2:restart` | Hard restart both applications |
| `npm run pm2:reload` | Reload the ecosystem. Both apps use fork mode here, so this behaves like a coordinated reload rather than true zero-downtime clustering |
| `npm run pm2:delete` | Remove both applications from PM2’s list (they will not appear in `pm2 list` until you run `pm2:start` again) |
| `npm run pm2:logs` | Stream logs for all PM2-managed processes (press Control+C to stop following the log stream) |
| `npm run rebuild` | Restart both applications after code changes (same as `pm2 restart ecosystem.config.cjs`) |
| `npm run rebuild:client` | Run a production build of the client, then restart only the `expense-client` process |

Ensure `server/.env` exists and Docker (PostgreSQL and Redis, if you use them) is running before starting.

If you see **“Process not found”**, no process named `expense-api` has been registered with PM2 yet. Run `npm run pm2:start` once from the repository root.

If the command-line **PM2 client** and the **background PM2 daemon** report different versions (message such as `Use pm2 update`), run `npx pm2 update` from the repository root, or run `npm install` so the CLI matches the dependency version, then use `npx pm2` for all commands.

## API (without PM2)

```bash
cd server
npm install
npm run dev
```

Database tables are created when the server starts. The HTTP API exposes the following behaviors (paths are all under the `/api` prefix; your front end usually calls them through the Vite proxy during development):

- **Registration and password login:** `POST /api/auth/register` creates an account. `POST /api/auth/login` returns a JSON Web Token. `GET /api/auth/me` returns the current user (including **`has_password`**, **`has_recovery_code`**, **`avatar_url`**) when a valid token is sent in the `Authorization` header. **`POST /api/auth/refresh`** (no body) accepts an **expired** token with a valid signature and returns a new token and user object (within a grace window after expiry); the client uses this when the user chooses **Continue session** after their JWT expires.
- **Profile and recovery (authenticated):** `PATCH /api/auth/profile`, `POST`/`DELETE /api/auth/avatar`, `POST`/`DELETE /api/auth/recovery-code` (stores encrypted ciphertext for backup export). **`POST /api/auth/recover-password`** (no auth) resets password from a saved recovery code. **`GET /api/backup/export`** and **`POST /api/backup/restore`** export or import expenses as JSON (`append` or `replace`; **`account`** object with **`userId`**, **`email`**, **`label`**, **`hasRecoveryCode`**, optional **`recoveryCode`**; download filename includes the account email; cross-account restore returns **409** `BACKUP_ACCOUNT_MISMATCH` unless the client sends **`confirmCrossAccountRestore`**: **`true`**). Restore body limit 15 MB, up to 25,000 rows; expense objects include `state` (`active` / `cancel`), `payment_day` and `payment_month` derived from `spent_at`—older files without `state` restore as `active`. See [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).
- **Single sign-on:** `GET /api/auth/oauth/:provider` starts the OAuth flow. Replace `:provider` with one of `google`, `github`, `gitlab`, or `microsoft`. The browser is redirected to that identity provider. After authorization, the provider calls back `GET /api/auth/oauth/:provider/callback`. You must register that callback URL in each provider’s developer console; it must match `{CLIENT_ORIGIN}/api/auth/oauth/<provider>/callback` where `<provider>` is the same name. Set the `OAUTH_*` variables in `server/.env` as documented in `server/.env.example`.
- **Expenses:** List and create with `GET` and `POST /api/expenses`. Read, update, or delete one row with `GET`, `PATCH`, or `DELETE /api/expenses/:id` where `:id` is the expense identifier. The `frequency` field must be one of `once`, `weekly`, `monthly`, `bimonthly`, or `yearly` (same values as the app’s dropdowns). Optional `state` is `active` (default) or `cancel` (shown as **Cancel** in the UI; **Upcoming renewals** highlights those rows in green and **does not** include their amounts in subtotals or the grand total). `payment_day` (1–30) and `payment_month` (1–12) are stored for renewals and exports but are **derived from `spent_at`** on create, update, import commit, and backup restore (client-supplied values for those fields are ignored).
- **Imports:** Upload with `POST /api/imports` using multipart form field `file`, plus `financial_institution` and `frequency` (same allow-list as expenses). List the latest batch with `GET /api/imports/latest`. Update a staging row with `PATCH /api/imports/rows/:rowId` (fields such as `category`, `frequency`). Commit with `POST /api/imports/batches/:batchId/commit`. Delete a batch with `DELETE /api/imports/batches/:batchId`.
- **Reports:** Daily, weekly, monthly, yearly, and range endpoints under `/api/reports/`, plus `GET /api/reports/summaries` for persisted monthly totals from the background job.

Report responses may be cached in Redis for approximately two minutes when `REDIS_URL` is set.

## Web app (without PM2)

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. The Vite development server serves the application and **proxies** any request whose path starts with `/api` to the backend. Set `API_PROXY_TARGET` in `client/.env` if the API does not listen on port 4000.

**Single sign-on note:** OAuth redirect URLs and the redirect back to your application after login use **`CLIENT_ORIGIN` from `server/.env`**. It must be the exact origin users use (scheme, host, and port, with no path), for example `http://localhost:5173`. If you deploy under another hostname or HTTPS, update `CLIENT_ORIGIN` and update the registered redirect URLs in each identity provider’s console.

If you use PM2, the client is still started with Vite in development mode; use the URL PM2 prints in the logs (often `http://localhost:5173`).

## Monthly job

The `node-cron` library schedules a job at **03:00 UTC on the first day** of each calendar month. That job aggregates the **previous** calendar month per user into the `monthly_summaries` table.

## When registration or login fails

The browser talks to the API through the Vite proxy: requests to `/api` are forwarded to your Node server. You need **both** of the following:

1. `docker compose up -d` if you rely on Docker for PostgreSQL and Redis.
2. The server running with `cd server && npm run dev` and a valid `server/.env` (the `JWT_SECRET` is generated automatically if it is weak or missing).

If only the client is running (`npm run dev` inside `client/`), sign-up and sign-in will fail until the API process is started.

### Single sign-on buttons do nothing or return an error

- An HTTP **503** response from `GET /api/auth/oauth/...` means that provider is **not configured**. Set `OAUTH_<PROVIDER>_CLIENT_ID` and `OAUTH_<PROVIDER>_CLIENT_SECRET` in `server/.env` for that provider, then restart the API.
- **Redirect URI mismatch** in the provider’s console: the authorized redirect URL must be exactly `{CLIENT_ORIGIN}/api/auth/oauth/{provider}/callback` as described in `server/.env.example`. Align `CLIENT_ORIGIN` and the provider application settings.
- After OAuth completes, you should land on **`/oauth/callback`**. If you always see “Missing token”, check the API logs for callback errors and confirm the browser’s origin matches `CLIENT_ORIGIN`.

### Port 4000 already in use (“Empty reply from server”)

Another program may be listening on **port 4000** instead of this API (for example `curl` connects but returns an empty reply). The expense tracker will not work correctly if Vite still proxies to port 4000 while nothing valid responds.

**Fix:** In `server/.env`, set `PORT` to another port, for example `4001`. Copy `client/.env.example` to `client/.env` and set `API_PROXY_TARGET=http://127.0.0.1:4001` (or the matching host and port). Restart `npm run dev` in **both** `server/` and `client/`.

To see which process holds a port, run `ss -tlnp | grep ':4000 '` or `lsof -iTCP:4000 -sTCP:LISTEN`, then stop the conflicting service if you want the API to use port 4000.
