# Deployment

This folder contains **production-oriented** artifacts for Expense Tracker:

| Path | Purpose |
|------|---------|
| [docker/](docker/) | **Dockerfiles** for the API and for nginx serving the Vite build (with `/api` proxy). Dev vs production options: [docker/README.md](docker/README.md). |
| [docker-compose/](docker-compose/) | **Docker Compose** stack: PostgreSQL, Redis, API, web. See [docker-compose/README.md](docker-compose/README.md). |
| [kubernetes/](kubernetes/) | **Kubernetes** manifests (namespace, Postgres, Redis, API, web, optional Ingress). See [kubernetes/README.md](kubernetes/README.md). |

The repository root **`docker-compose.yml`** only starts PostgreSQL and Redis for **local development** (container names **`expense-tracker-dev-*`**). For a **full containerized stack** (Postgres, Redis, API, nginx, persistent volumes), use **`deployment/docker-compose/docker-compose-build.yml`** (build images locally) or **`docker-compose-prod.yml`** (pull tagged images from a registry). Service names are **`expense-tracker-*`**; do not run both full-stack files at once on the same host. Details: [docker-compose/README.md](docker-compose/README.md), [docker/README.md](docker/README.md).

From the **repository root**: **`npm run compose:build`** runs **`ensure-env.mjs`** then **`docker compose … up -d --build`** against **`docker-compose-build.yml`**. **`npm run compose:prod`** uses **`docker-compose-prod.yml`** and **`up -d`** (no local build). **`npm run compose:prod:pull`** fetches newer images first. **`compose:build:*`** and **`compose:prod:*`** scripts wrap **`down`**, **`logs`**, and **`ps`** for the matching file. **`npm run compose:ensure-env`** only runs the bootstrap script.

## Quick links

- **Docker Compose (single host):** [docker-compose/README.md](docker-compose/README.md)  
- **Kubernetes (cluster):** [kubernetes/README.md](kubernetes/README.md)  

For application behavior, environment variables, OAuth, recovery codes, **Renewals**, and **Profile backup/restore**, see the root [README.md](../README.md), [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), [docs/RENEWALS.md](../docs/RENEWALS.md), and [docs/USER_GUIDE.md](../docs/USER_GUIDE.md). The Compose **web** nginx **`client_max_body_size`** (25 MB on `/api/`) is enough for default **backup restore** payloads (15 MB limit on the API).
