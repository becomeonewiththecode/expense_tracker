# Deployment

## Production on one host (Docker Compose)

Full stack (Postgres, Redis, API, nginx + built client): from the repo root run **`npm run compose:prod`**. It runs **`node deployment/docker-compose/ensure-env.mjs`**, which creates **`deployment/docker-compose/.env`** from **`.env.example`** if needed and writes a random **`JWT_SECRET`** when the line is empty or too short (stable on disk, gitignored). Edit **`CLIENT_ORIGIN`** (and optional **`OAUTH_*`**) in that **`.env`** as needed.

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
- **Production Docker Compose** does not auto-generate inside the container; use **`deployment/docker-compose/.env`** on the host. **`npm run compose:prod`** runs **`deployment/docker-compose/ensure-env.mjs`** so **`JWT_SECRET`** is filled there automatically when unset.
- You can also set secrets manually with `openssl rand -base64 32`.

### CLIENT_ORIGIN

Must match the URL users type in the browser to open the single-page application, for example `http://localhost:5173`. This value is required for OAuth redirect URLs after single sign-on and for Cross-Origin Resource Sharing in setups that behave like production.

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
