# Docker build images (API and web)

This directory holds **Dockerfiles** used to build container images for Expense Tracker. They are **not** a runnable stack by themselves; Compose and other tooling reference them by path.

| File | Purpose |
|------|---------|
| **`Dockerfile.api`** | Multi-stage build: install production dependencies and run the Express API (`server/`). |
| **`Dockerfile.web`** | Multi-stage build: run `npm run build` for the Vite client, then copy static assets into **nginx** with an `/api` (and `/health`) proxy to the API service. |

The **production** Compose file at [`../docker-compose/docker-compose.yml`](../docker-compose/docker-compose.yml) builds **api** from `Dockerfile.api` and **web** from `Dockerfile.web`.

For a higher-level map of deployment assets, see [`../README.md`](../README.md).

---

## Development environment

Typical development runs **Node.js on the host** (API + Vite) and uses Docker only for **PostgreSQL** and **Redis**.

### Option A — Docker Compose (databases only)

From the **repository root**:

```bash
docker compose up -d
```

This uses the root [`docker-compose.yml`](../../docker-compose.yml): **postgres** (port `5432`) and **redis** (port `6379`). No API or web containers are started. Containers are named **`expense-tracker-dev-postgres`** and **`expense-tracker-dev-redis`** so they do not clash with the production Compose stack on the same host.

Then:

1. Copy `server/.env.example` to `server/.env` and set **`DATABASE_URL`**, **`REDIS_URL`**, **`JWT_SECRET`**, **`CLIENT_ORIGIN`** (for example `http://localhost:5173` for Vite), and optional **`OAUTH_*`** as in the root [README.md](../../README.md).
2. Install dependencies and run the app:
   - **Manual:** `cd server && npm install && npm run dev` in one terminal; `cd client && npm install && npm run dev` in another (with `client/.env` **`API_PROXY_TARGET`** if the API is not on port 4000).
   - **PM2 (repo root):** `npm install`, then `cd server && npm install && cd ..`, `cd client && npm install && cd ..`, then `npm run pm2:start` — see [HOWTO_CONTROLLING_APPLICATIONS.md](../../docs/HOWTO_CONTROLLING_APPLICATIONS.md).

### Option B — Databases without Docker

Install PostgreSQL and Redis locally, point **`DATABASE_URL`** / **`REDIS_URL`** in `server/.env` at those services, then run the API and client as in Option A.

### Option C — Build images locally (optional)

You can verify the production Dockerfiles without starting the full stack:

```bash
docker build -f deployment/docker/Dockerfile.api -t expense-tracker-api:local .
docker build -f deployment/docker/Dockerfile.web -t expense-tracker-web:local .
```

You still need a running API URL and built client configuration for the web image to be useful on its own; the usual path is the Compose stack below.

---

## Production environment

Run the **full stack** (Postgres, Redis, API container built from **`Dockerfile.api`**, nginx + static client from **`Dockerfile.web`**) with **Docker Compose**.

### Recommended (repository root)

```bash
npm run compose:prod
```

This runs **`deployment/docker-compose/ensure-env.mjs`** (creates **`deployment/docker-compose/.env`** and bootstraps **`JWT_SECRET`** when needed), then builds and starts the stack defined in **`deployment/docker-compose/docker-compose.yml`**.

Other helpers from the repo root:

| Script | Purpose |
|--------|---------|
| `npm run compose:ensure-env` | Only run the env bootstrap (no `docker compose up`). |
| `npm run compose:prod:down` | Stop the stack (volumes kept by default). |
| `npm run compose:prod:logs` | Follow logs. |
| `npm run compose:prod:ps` | Show service status. |

### Manual Compose

```bash
node deployment/docker-compose/ensure-env.mjs
docker compose -f deployment/docker-compose/docker-compose.yml --env-file deployment/docker-compose/.env up -d --build
```

Set **`CLIENT_ORIGIN`** in **`deployment/docker-compose/.env`** to the URL users use (for example `http://localhost:8080` if **`HTTP_PORT=8080`**). In production behind TLS, use `https://your-domain`.

**Detailed steps**, OAuth redirect URLs, health checks, and troubleshooting: **[`../docker-compose/README.md`](../docker-compose/README.md)**.

---

## Related documentation

- **[`../README.md`](../README.md)** — Deployment folder overview (Docker, Compose, Kubernetes).  
- **[`../docker-compose/README.md`](../docker-compose/README.md)** — Full production Compose guide.  
- **[`../../README.md`](../../README.md)** — Root prerequisites, local env vars, PM2, API surface.  
- **[`../../docs/USER_GUIDE.md`](../../docs/USER_GUIDE.md)** — End-user and operator topics (backup, OAuth, Compose JWT notes).
