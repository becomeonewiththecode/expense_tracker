# Expense Tracker — User Guide

This guide describes what the Expense Tracker does and how to run and use it day to day.

## What it is

Expense Tracker is a web application for **recording expenses** and **viewing spending by time period**. Each user has a private account: your expenses are not visible to other users.

You can:

- **Register** and **sign in** with email and password, or **sign in with Google, GitHub, GitLab, or Microsoft** when the server admin has configured OAuth  
- **Add expenses** with amount, transaction date, category, how often the cost occurs, optional **date (1–30)** for the day of the month the payment is made, how you paid, and an optional note  
- **Import** a **CSV / PDF** statement, **review** each line, set **categories** (and frequency / payment day if needed), then commit (see below)  
- **Delete** expenses from the list  
- **View reports** as charts: daily, weekly, monthly, yearly, or a custom date range  
- See **stored monthly summaries** (totals computed by a background job on a schedule)

The interface is **responsive**: it works on phones, tablets, and desktops.

---

## Before you start (developers / self-hosted)

You need **three** things running for the app to work end to end:

| Piece | Purpose |
|--------|---------|
| **PostgreSQL** | Stores users, expenses, OAuth identity links (`oauth_identities`), and related data |
| **Redis** (optional but recommended) | Caches report responses for faster repeats |
| **Node API** (`server/`) | REST backend, JWT auth, and optional OAuth SSO |

The **browser app** (`client/`) is separate and talks to the API through the dev proxy or your deployment setup.

Quick local setup:

1. Start databases: `docker compose up -d` (from the project root)  
2. Configure `server/.env` (copy from `server/.env.example`)  
3. API: `cd server && npm install && npm run dev`  
4. Web UI: `cd client && npm install && npm run dev`  
5. Open **http://localhost:5173**

If **port 4000** is already used by another program, the UI may fail to reach the API. Set `PORT` in `server/.env` (e.g. `4001`) and point `API_PROXY_TARGET` in `client/.env` at the same URL. See the root **README.md** for details.

---

## Account: register and sign in

1. Open the app URL in your browser.  
2. Choose **Create account** (or go to `/register`).  
3. Enter **email** and **password** (minimum length enforced on the form).  
4. After success you are signed in and taken to **Your expenses** if you already have saved expenses, otherwise to **Import** (add/import).  

To sign in later, use **Sign in** (`/login`) with the same email and password.

### Sign in with Google, GitHub, GitLab, or Microsoft

If your deployment has **OAuth** configured on the API, the **Sign in** and **Create account** screens show buttons for those providers. Choosing one sends you to that service to approve access; you are then redirected back to the app (`/oauth/callback`) and signed in with a normal session.

**Self-hosted setup:** In each provider’s developer console, register an OAuth application whose **redirect URI** is exactly:

`{your app origin}/api/auth/oauth/{provider}/callback`

For example, with `CLIENT_ORIGIN=http://localhost:5173` and Google: `http://localhost:5173/api/auth/oauth/google/callback`. The Vite dev server proxies `/api` to the Node API, so this path still hits the backend. Set `OAUTH_*` variables in `server/.env` as described in `server/.env.example`.

If you already registered with **email and password**, signing in with SSO using the **same email** attaches to the same account when the provider returns that email.

**Sign out** clears your session in the browser (you will need to sign in again to use **Import** and **Reports**).

---

## Import screen

The **Import** page (`/expenses`) is where you add and review individual transactions.

- **First-time / no saved expenses:** you see the **manual add** form and **Import from statement** so you can enter data or upload a file. After you save at least one expense, the layout changes.
- **When you already have expenses:** the **Import** page shows **Import from statement** and optional **Add expense manually** (expand the section). Open **Your expenses** in the header (or the button on **Import**) to view, edit, and delete saved rows on a separate page. After your **first** saved expense (from the onboarding form) or after you **commit** an import that adds rows, you are taken to **Your expenses** automatically.

### Add an expense

Fill in the form and click **Add expense**:

| Field | Description |
|--------|-------------|
| **Amount** | Dollar amount (must be zero or positive). |
| **Category** | One of: Home, Entertainment, Personal, Business, Education, Rent, Mortgage, Subscription. |
| **Frequency** | How often this cost applies: Once, Weekly, Monthly, or Bi-monthly. *(Metadata for your records; reports still use the transaction **date**.)* |
| **Financial institution** | Bank, VISA, Mastercard, or American Express. |
| **Date** | The **spent** date for this line item. |
| **Note** | Optional free text. |

On the **Your expenses** page, the table lists your expenses (newest first). **Projection** in the table header opens a **combined** report: **daily**, **monthly**, and **yearly** run-rate totals across **all** saved expenses (one-time amounts summed separately), plus a **pie chart** of annualized share by category (and a **One-time** slice when applicable). Click a slice to list the expenses in that segment; click the same slice again to clear. Each row also has **Projection** for **that expense only** (same numbers plus a single-slice or small pie); if you are editing a row, row **Projection** uses your unsaved values in the form. Click **Enter modification mode** to show **Edit** on each row; then **Edit** / **Save** / **Cancel** work as before. Click **Exit modification mode** to go back to read-only rows (unsaved edits on the active row are cleared). **Delete** is always available. If you have no expenses yet, that page offers a link back to **Import** to add or import.

### Import from a statement (CSV or PDF)

Under **Import from statement**:

1. Set **financial institution**, **frequency**, and optionally **Date (1–30)** for the import (or **From statement** so each row uses that line’s calendar day, capped at 30). **Institution** applies to every row you commit.  
2. Choose a **.csv** or **.pdf** and click **Upload & parse**.  
3. In **Review import**, pick a **category** for each row you want to keep. Change **frequency** or **Date (1–30)** on a row if needed. Rows left as **— Select category —** are **not** imported.  
4. Click **Add categorized rows to expenses**. **Discard import** deletes the staged batch without saving expenses.

Parsing uses **date, amount, and description** from the file; **CSV** usually works best. **PDF** support is best-effort.

---

## Reports screen

The **Reports** page shows **charts** of spending for different periods.

Use the tabs:

- **Daily** — pick a date; total and (if applicable) category breakdown.  
- **Weekly** — current week (Monday–Sunday in UTC-based logic) or adjust via the API; the default UI uses the server’s current week.  
- **Monthly** — pick year and month.  
- **Yearly** — totals by month for a year.  
- **Custom range** — start and end dates.  

Each view shows a **bar chart** (Recharts) and a **total** for the period. **Click the trend chart** (or focus it and press Enter / Space) to open the same **Projection** modal as on **Your expenses** — combined daily / monthly / yearly run rates, pie chart, and slice drill-down — using your **saved expenses** (up to 500 rows). The bar chart reflects the **selected report period**; the projection is always **all saved expenses**, not filtered to that period.

### Stored monthly summaries

The app can show **precomputed monthly totals** from the `monthly_summaries` table. Those rows are filled by a **scheduled job** (first day of the month, UTC) for the **previous** calendar month. Until that runs, the section may be empty or only partially filled.

---

## Session and security (short)

- After **email/password** login or **SSO** completion, the app stores a **JWT** in the browser (`localStorage`) and sends it on API requests — same session model for both.  
- **Password accounts:** do not share your password; choose a strong password for your account.  
- **SSO accounts:** sign-in is delegated to Google, GitHub, GitLab, or Microsoft; use that provider’s account security settings (2FA, etc.) as appropriate.  
- On a shared computer, **sign out** when finished (clears the token from this browser).  

---

## Where to go next

- **Installation, ports, and OAuth env:** root `README.md`  
- **How the system is built (including SSO):** [ARCHITECTURE.md](./ARCHITECTURE.md)  
- **PM2:** [HOWTO_CONTROLLING_APPLICATIONS.md](./HOWTO_CONTROLLING_APPLICATIONS.md)
