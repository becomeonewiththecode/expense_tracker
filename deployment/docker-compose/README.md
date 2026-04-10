# Deploy with Docker Compose

This directory has **two** full-stack Compose files (Postgres, Redis, API, nginx + static client). They use the **same** `container_name` and volume names — **run only one stack at a time** on a host.

| File | Purpose |
|------|---------|
| **`docker-compose-build.yml`** | **Build** API and web images from this repo (`Dockerfile.api` / `Dockerfile.web`). For local dev, QA, or testing a branch. |
| **`docker-compose-prod.yml`** | **Pull** pre-built **`expense-tracker-api`** / **`expense-tracker-web`** images (e.g. from Docker Hub). For production servers after you push tags. |

The **repository root** [`docker-compose.yml`](../../docker-compose.yml) only starts PostgreSQL and Redis for **host-based** API + Vite development (no app containers).

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/) v2.
- Repository clone with `server/package-lock.json` and `client/package-lock.json` present (for **build** compose only).

## Configure environment

1. **Easiest:** copy the example and edit:

   ```bash
   cp deployment/docker-compose/.env.example deployment/docker-compose/.env
   ```

2. Run **`node deployment/docker-compose/ensure-env.mjs`** (or use **`npm run compose:build`** / **`npm run compose:prod`**, which run it first). It creates **`.env`** when missing and **generates a random `JWT_SECRET`** when the line is empty or too short.

3. Set **`CLIENT_ORIGIN`** to the URL users open (e.g. `http://localhost:8080` if `HTTP_PORT=8080`). Use a comma-separated list if several origins must call the API; CORS and OAuth redirects depend on this value.

4. The **`api`** service loads this directory’s **`.env`** via **`env_file`**, so **`JWT_SECRET`**, **`CLIENT_ORIGIN`**, and optional **`OAUTH_*`** reach the container. Always pass **`--env-file deployment/docker-compose/.env`** on **`docker compose`** (or use the npm scripts below) so **`${HTTP_PORT}`**, **`IMAGE_TAG`**, **`DOCKERHUB_USERNAME`**, and Postgres-related variables interpolate on the **host**.

### Variables by workflow

**`docker-compose-build.yml`**

- **`APP_VERSION`** (optional) — Baked into images at build and passed to the API. Default **`dev`**.

**`docker-compose-prod.yml`**

- **`IMAGE_TAG`** — Tag for both **`${DOCKERHUB_USERNAME}/expense-tracker-api`** and **`…/expense-tracker-web`** (must match what you pushed). Default **`1.0`**.
- **`DOCKERHUB_USERNAME`** — Registry namespace. Default **`maxwayne`**.
- **`APP_VERSION`** (optional) — API/runtime display string for **`GET /health`** and the UI. If unset, defaults to **`IMAGE_TAG`**, then **`1.0`**.

## npm scripts (from repository root)

| Script | Compose file | What it does |
|--------|----------------|----------------|
| **`npm run compose:build`** | `docker-compose-build.yml` | `ensure-env`, then **`up -d --build`** |
| **`npm run compose:build:down`** | build | **`down`** |
| **`npm run compose:build:logs`** | build | **`logs -f`** |
| **`npm run compose:build:ps`** | build | **`ps`** |
| **`npm run compose:prod`** | `docker-compose-prod.yml` | `ensure-env`, then **`up -d`** (no build) |
| **`npm run compose:prod:pull`** | prod | **`pull`** (fetch newer images) |
| **`npm run compose:prod:down`** | prod | **`down`** |
| **`npm run compose:prod:logs`** | prod | **`logs -f`** |
| **`npm run compose:prod:ps`** | prod | **`ps`** |
| **`npm run compose:ensure-env`** | — | Only **`ensure-env.mjs`** |

## Manual `docker compose`

**Build stack (from repo root):**

```bash
node deployment/docker-compose/ensure-env.mjs
docker compose -f deployment/docker-compose/docker-compose-build.yml --env-file deployment/docker-compose/.env up -d --build
```

**Production images:**

```bash
node deployment/docker-compose/ensure-env.mjs
docker compose -f deployment/docker-compose/docker-compose-prod.yml --env-file deployment/docker-compose/.env pull
docker compose -f deployment/docker-compose/docker-compose-prod.yml --env-file deployment/docker-compose/.env up -d
```

Wait until **postgres** is healthy and **api** has started (first boot runs migrations). Then open **`CLIENT_ORIGIN`**.

### Notes

- **`--env-file`** is required for host-side substitution (ports, image tags, etc.). **`env_file`** inside the YAML is separate (secrets inside the **api** container).
- For routine **build** stack updates, **`up -d --build`** is enough; use **`down`** when you want to remove containers.
- **`down`** keeps volumes. To remove volumes: add **`-v`** (destructive).

## Container names

| Service  | Container name             |
|----------|----------------------------|
| postgres | `expense-tracker-postgres` |
| redis    | `expense-tracker-redis`    |
| api      | `expense-tracker-api`      |
| web      | `expense-tracker-web`      |

## Verify

- **Web:** Open the app URL; you should see the login page.
- **API health:** `curl -sS http://localhost:8080/health` (adjust **`HTTP_PORT`**).

## Logs and stop

Replace **`FILE`** with **`docker-compose-build.yml`** or **`docker-compose-prod.yml`**:

```bash
docker compose -f deployment/docker-compose/FILE --env-file deployment/docker-compose/.env logs -f api
docker compose -f deployment/docker-compose/FILE --env-file deployment/docker-compose/.env down
```

## HTTPS and a real domain

Publish HTTP on **`HTTP_PORT`**. For HTTPS, terminate TLS in front (Traefik, Caddy, nginx, or a cloud load balancer) and set **`CLIENT_ORIGIN`** to `https://your-domain.example`. Update OAuth redirect URIs accordingly.

## Troubleshooting

- **API exits:** Check **`docker compose … logs api`**. Common causes: invalid **`DATABASE_URL`**, weak **`JWT_SECRET`** in **`NODE_ENV=production`**. Run **`npm run compose:ensure-env`**.
- **Prod stack pulls wrong version:** Set **`IMAGE_TAG`** (and **`DOCKERHUB_USERNAME`**) in **`.env`** to match Docker Hub.
- **502 on `/api`:** Ensure **api** is running and nginx resolves hostname **`api`** on the Compose network.

More context: [deployment/README.md](../README.md) and the root [README.md](../../README.md).
