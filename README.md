# Expense Tracker

A full-stack personal finance application for tracking recurring and one-time expenses, subscription renewals, prescriptions, and payment plans. It provides spending projections, categorized reporting, and CSV/PDF statement imports to help you understand where your money goes.

The **client** is built with React, Tailwind CSS, Recharts, React Router, and Axios. The **server** uses Express, PostgreSQL, and JSON Web Tokens for authentication, with optional Redis caching. OAuth single sign-on is supported for Google, GitHub, GitLab, and Microsoft 365.

## Table of contents

### Guides

- [User Guide](./docs/USER_GUIDE.md) — Accounts, import, navigation, backup/restore, recovery codes, and expense states
- [Renewals](./docs/RENEWALS.md) — Renewal category, renewal kinds, import staging, and the Renewals page
- [Payment Plans](./docs/PAYMENT_PLANS.md) — Payment plans page, expense sync, and add/edit workflow
- [Prescriptions](./docs/PRESCRIPTIONS.md) — Prescriptions table, renewal periods, and in-app reminders
- [Budgeting](./docs/BUDGETING.md) — Monthly budgets, category lines, threshold notifications, variance, and exports (with diagrams)
- [Income versus spend](./docs/INCOME_VS_SPEND.md) — Cash-flow actuals, recurring run rate vs obligations, projection (with diagrams); [legacy link](./docs/INCOME_AND_MINIMUM_CHECK.md) redirects here

### Architecture

- [Architecture](./docs/ARCHITECTURE.md) — OAuth, data model, API routes, backup format, and recurring metadata
- [Architecture Diagrams](./docs/ARCHITECTURE_DIAGRAM.md) — Topology, data model diagrams, and request flows

### Deployment and operations

- [Deployment](./docs/DEPLOYMENT.md) — Docker Compose production, database/cache setup, environment variables, and PM2
- [Deployment overview](./deployment/README.md) — Docker Compose and Kubernetes options
- [Docker images](./deployment/docker/README.md) — Dockerfile details for dev vs production
- [Docker Compose production](./deployment/docker-compose/README.md) — Full-stack Compose configuration
- [Kubernetes](./deployment/kubernetes/README.md) — Kubernetes deployment
- [Controlling applications (PM2)](./docs/HOWTO_CONTROLLING_APPLICATIONS.md) — PM2 process management

### Reference

- [Troubleshooting](./docs/TROUBLESHOOTING.md) — Common issues with login, OAuth, ports, and PM2

## Quick start

### Prerequisites

- Node.js version 20 or newer
- Docker (optional, for running PostgreSQL and Redis locally)

### 1. Start the database

```bash
docker compose up -d
```

### 2. Start the API

```bash
cd server
npm install
npm run dev
```

Copy `server/.env.example` to `server/.env` and edit values as needed. Database tables are created automatically when the server starts. The `JWT_SECRET` is auto-generated if missing or weak.

### 3. Start the client

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies `/api` requests to the backend. Set `API_PROXY_TARGET` in `client/.env` if the API does not listen on port 4000.

**Routes:** Visitors who are not signed in see a public **landing page** at `/` (register and sign-in links go to `/register` and `/login`). After authentication, `/` routes into the main app (same behavior as before for signed-in users). Other app paths (for example `/budget`, `/reports`, `/income`) redirect to the login page when accessed while signed out. The **Budget** hub is at **`/budget`** (tabs **Budget** | **Reports**); **`/reports`** remains a standalone reports page.

**Static landing previews:** Additional standalone HTML variants for design comparison are in [`client/public/landings/`](./client/public/landings/) and are served by Vite at paths such as `/landings/01-aurora-glass.html`.

## API overview

All paths are under the `/api` prefix. During development, the Vite proxy forwards them to the Node server.

- **Auth** — `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/refresh`
- **OAuth** — `GET /api/auth/oauth/:provider` (google, github, gitlab, microsoft)
- **Profile** — `PATCH /api/auth/profile`, avatar and recovery code management
- **Expenses** — CRUD at `/api/expenses` and `/api/expenses/:id`. Frequencies: `once`, `weekly`, `monthly`, `bimonthly` (twice per month), `yearly`. States: `active`, `paused`, `cancelled`. Bimonthly expenses require two payment days (`payment_day` and `payment_day_2`, each 1-30).
- **Imports** — Upload statements via `POST /api/imports`, review staging rows, commit to expenses
- **Reports** — Daily, weekly, monthly, yearly, and custom range endpoints under `/api/reports/`
- **Budgets** — `GET`/`PUT`/`DELETE /api/budgets/:year/:month` for monthly budget periods and category lines
- **Notifications** — `GET /api/notifications`, mark read for budget alerts
- **Savings goals** — CRUD at `/api/savings-goals`
- **Backup** — `GET /api/backup/export` and `POST /api/backup/restore` (JSON format, versions 1–4; v4 adds income entries)
- **API docs** — When signed in (or from **Admin → Swagger**), open **`/api/docs`** for Swagger UI or **`/api/openapi.json`** for the OpenAPI 3 spec (includes backup schemas and **`info`** notes for **`GET /health`** at the site root).

Report responses may be cached in Redis for approximately two minutes when `REDIS_URL` is set.

## Monthly job

The `node-cron` library schedules a job at **03:00 UTC on the first day** of each calendar month. That job aggregates the previous calendar month per user into the `monthly_summaries` table.

## OAuth setup

OAuth redirect URLs use **`CLIENT_ORIGIN` from `server/.env`**. It must be the exact origin users use (scheme, host, and port, with no path), for example `http://localhost:5173`. Register the callback URL `{CLIENT_ORIGIN}/api/auth/oauth/{provider}/callback` in each provider's developer console. See `server/.env.example` for the full list of `OAUTH_*` variables.
