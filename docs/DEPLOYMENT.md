# Deployment

## Production on one host (Docker Compose)

Full stack (Postgres, Redis, API, nginx + built client): from the repo root use **`npm run compose:build`** (build images locally via **`docker-compose-build.yml`**) or **`npm run compose:prod`** (pull tagged images via **`docker-compose-prod.yml`**). Both run **`node deployment/docker-compose/ensure-env.mjs`** first, which creates **`deployment/docker-compose/.env`** from **`.env.example`** if needed and writes a random **`JWT_SECRET`** when the line is empty or too short (stable on disk, gitignored). Edit **`CLIENT_ORIGIN`**, optional **`IMAGE_TAG`** / **`DOCKERHUB_USERNAME`** (prod), and optional **`OAUTH_*`** as needed.

You can run **`npm run compose:ensure-env`** alone, or follow the manual **`docker compose …`** flow in [../deployment/docker-compose/README.md](../deployment/docker-compose/README.md) (use **`--env-file deployment/docker-compose/.env`** on the host command so **`HTTP_PORT`** and Postgres-related values interpolate).

For how the **Dockerfiles** fit into dev (DB-only Compose) vs production (full stack), see [../deployment/docker/README.md](../deployment/docker/README.md).

See also:

- [../deployment/README.md](../deployment/README.md) — Overview of Docker Compose and Kubernetes options
- [../deployment/kubernetes/README.md](../deployment/kubernetes/README.md) — Kubernetes deployment

## Database and cache

Run the following command to start local database and cache containers (from the project root):

```bash
docker compose up -d
```

Containers are named **`expense-tracker-dev-postgres`** and **`expense-tracker-dev-redis`** (see [../deployment/docker/README.md](../deployment/docker/README.md)).

## Environment variables

Copy `server/.env.example` to `server/.env` and edit values as needed. The default connection string matches the Docker Compose service names:

- `DATABASE_URL=postgresql://expense:expense@localhost:5432/expense_tracker`
- `REDIS_URL=redis://localhost:6379`

### JWT_SECRET

- **Local API** (`server/`, not `NODE_ENV=production`): if the secret is missing, shorter than 16 characters, or still a `change-me…` placeholder, **`ensureJwtSecret()`** generates one and writes **`server/.env`**.
- **Full-stack Docker Compose** does not auto-generate **`JWT_SECRET`** inside the container; use **`deployment/docker-compose/.env`** on the host. **`npm run compose:build`** and **`npm run compose:prod`** run **`ensure-env.mjs`** so **`JWT_SECRET`** is filled there automatically when unset.
- You can also set secrets manually with `openssl rand -base64 32`.

### BANK_TOKEN_ENCRYPTION_KEY (optional)

- Used to encrypt stored Plaid bank access tokens at rest.
- If unset, the API derives bank-token encryption from `JWT_SECRET`.
- Recommended in production: set a dedicated long random value and keep it stable.

### CLIENT_ORIGIN

Must match the URL users type in the browser to open the single-page application, for example `http://localhost:5173`. Use a **comma-separated list** if more than one origin must call the API (for example separate dev hosts). In **production**, set this explicitly: the API CORS allowlist is derived from it, and an empty or wrong value blocks the SPA from calling **`/api/*`** from the real UI host. This value is also required for OAuth redirect URLs after single sign-on.

### User session cookies

- The SPA authenticates to **`/api/*`** with an **HttpOnly** cookie named **`expense_tracker_session`** (set by **`/api/auth/*`** after login, register, OAuth exchange, profile refresh, and similar). The browser must send **`credentials`** (the client Axios instance uses **`withCredentials: true`**).
- Optional **`SESSION_COOKIE_SECURE`:** forces the cookie **`Secure`** flag on or off. When unset, the API infers **`Secure`** from environment and request (including **`X-Forwarded-Proto`**); **`app.set("trust proxy", 1)`** is enabled so one reverse-proxy hop is honored. If users see **session expired** or **401** immediately after login over **plain HTTP**, set **`SESSION_COOKIE_SECURE=false`** or terminate TLS at the proxy and forward **`X-Forwarded-Proto: https`**.
- Details and Swagger notes: **[API_AUTHORIZATION.md](./API_AUTHORIZATION.md)**.

### Admin site (`/admin`)

The repository includes an **admin site** at **`/admin`** (a separate UI from the normal user app). It is backed by **`/api/admin/*`** endpoints and is designed for operational tasks:

- **Backup and restore** (per-user and whole database)
- **System health checks** (API, web UI, database connectivity, database sanity, and application resources)
- **User account management** (reset passwords, modify permissions/roles)

#### Admin environment variables

For production Docker Compose, set these in **`deployment/docker-compose/.env`** (or the `.env` consumed by your Compose stack):

- `ADMIN_USERNAME`: Bootstrap username (example: `admin`)
- `ADMIN_PASSWORD`: Bootstrap password (**must be changed immediately after first login**)
- `ADMIN_TOTP_SECRET` (optional): Base32 TOTP secret to pre-provision 2FA

If `ADMIN_TOTP_SECRET` is **not** set, the first successful password login will prompt the admin UI to **enroll 2FA** (QR code + one-time code verification) before operations proceed.

#### Web health probe (nginx / UI)

The admin **System health** tab includes a **Web (UI)** probe. By default, the API checks:

- **Production Compose:** `http://web/` (Compose service DNS)
- **Other environments:** `CLIENT_ORIGIN`

You can override the target URL with:

- `ADMIN_WEB_HEALTH_URL` (for example `http://10.0.0.30:8080/`)

#### Re-authentication and timeouts

- Admin sessions time out after **15 minutes of inactivity**.
- Sensitive operations (whole DB backup, restore, user password reset, permission changes) require **re-authentication** (password + 2FA) even during an active session.
- Admin passwords can be rotated anytime from the **Session** tab (first login still enforces an immediate change).

#### Swagger / OpenAPI docs

The API serves interactive docs via Swagger UI:

- **Swagger UI:** `/api/docs`
- **OpenAPI JSON:** `/api/openapi.json`

The spec’s **`info.description`** documents **`GET /health`** (served at the **site root**, not under **`/api`**). **`components.securitySchemes`** define **`bearerAuth`** (user JWT), **`adminBearerAuth`** (admin JWT), and **`adminReauth`** (header **`x-admin-reauth`**). Step-by-step token acquisition and which admin routes require re-auth are documented in **[API_AUTHORIZATION.md](./API_AUTHORIZATION.md)**.

**`components.schemas`** include **`UserBackupExport`**, **`BackupRestoreRequest`**, and **`HealthResponse`**. The **backup** tag summarizes profile export **version** **4** (**`incomeEntries`**). Admin backup endpoints note **version** **2** for full-database and per-user snapshots.

### OAuth (optional)

Set environment variables `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, and the same pattern for GitHub, GitLab, and Microsoft as needed. Optional variables include `OAUTH_GITLAB_BASE_URL` (defaults to GitLab.com if unset) and `OAUTH_MICROSOFT_TENANT` (defaults to `common` if unset). See the comments in `server/.env.example` for the full list.

## Running with PM2

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
| `npm run pm2:delete` | Remove both applications from PM2's list (they will not appear in `pm2 list` until you run `pm2:start` again) |
| `npm run pm2:logs` | Stream logs for all PM2-managed processes (press Control+C to stop following the log stream) |
| `npm run rebuild` | Restart both applications after code changes (same as `pm2 restart ecosystem.config.cjs`) |
| `npm run rebuild:client` | Run a production build of the client, then restart only the `expense-client` process |

Ensure `server/.env` exists and Docker (PostgreSQL and Redis, if you use them) is running before starting.

For PM2 troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

See also: [HOWTO_CONTROLLING_APPLICATIONS.md](./HOWTO_CONTROLLING_APPLICATIONS.md)
